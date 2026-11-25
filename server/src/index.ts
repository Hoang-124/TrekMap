import 'dotenv/config';
import mongoose from 'mongoose';
import { httpServer } from './app.js';
import { connectDB, disconnectDB, scheduleDbReconnect, cancelDbReconnect } from './config/db.js';
import { seedAll13Collections } from './utils/seedDatabase.js';
import { getIO, stopSocketTimers } from './config/socket.js';
import { getJwtSecret } from './utils/auth.js';
import { closeMailer } from './utils/mailer.js';
import { stopRateLimiterTimers } from './middleware/rateLimiter.middleware.js';
import { stopCacheCleanupTimer } from './middleware/cache.middleware.js';
import { processOverdueSafetyTimers } from './controllers/safetyTimer.controller.js';
import { processScheduledWeatherAlerts } from './controllers/weatherAlert.controller.js';

const PORT = Number(process.env.PORT) || 5000;
let safetyTimerSweepInterval: NodeJS.Timeout | null = null;
let weatherAlertSweepInterval: NodeJS.Timeout | null = null;
let weatherAlertInitialTimeout: NodeJS.Timeout | null = null;
let seededOnce = false;

function startSafetyTimerSweeper() {
  if (safetyTimerSweepInterval) return;

  const runSweep = () => {
    processOverdueSafetyTimers().catch((err) =>
      console.warn('[SafetyTimer Sweep Notice]:', (err as Error).message)
    );
  };

  // Run an immediate sweep on boot/reconnect so overdue alerts never wait 5 minutes
  runSweep();
  safetyTimerSweepInterval = setInterval(runSweep, 5 * 60 * 1000);
  safetyTimerSweepInterval.unref();
}

function startWeatherAlertSweeper() {
  if (weatherAlertSweepInterval) return;

  const runWeatherSweep = () => {
    processScheduledWeatherAlerts().catch((err) =>
      console.warn('[WeatherAlert Sweep Notice]:', (err as Error).message)
    );
  };

  // Slight startup delay so DB & caches warm up before evaluating active subscriptions
  weatherAlertInitialTimeout = setTimeout(runWeatherSweep, 45 * 1000);
  weatherAlertInitialTimeout.unref();
  weatherAlertSweepInterval = setInterval(runWeatherSweep, 30 * 60 * 1000);
  weatherAlertSweepInterval.unref();
}

async function onDatabaseReady() {
  if (!seededOnce) {
    seededOnce = true;
    const ok = await seedAll13Collections();
    if (!ok) seededOnce = false;
  }
  startSafetyTimerSweeper();
  startWeatherAlertSweeper();
}

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    // Fail fast before binding HTTP port if JWT_SECRET is missing or weak
    const jwtSecret = getJwtSecret();
    if (jwtSecret.length < 32) {
      throw new Error('FATAL SECURITY ERROR: JWT_SECRET must be at least 32 characters in production!');
    }

    if (!(process.env.MONGODB_URI || '').trim()) {
      console.warn(
        '[LOST Startup Warning]: MONGODB_URI is unset in production; falling back to 127.0.0.1:27017.'
      );
    }
    if (!(process.env.CLIENT_URL || '').trim()) {
      console.warn(
        '[LOST Startup Warning]: CLIENT_URL is unset in production; outbound links will default to https://lost.vn.'
      );
    }
    if (!(process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS || '').trim()) {
      console.warn(
        '[LOST Startup Warning]: CORS_ORIGINS is unset in production; CORS allowlist will default to https://lost.vn and https://www.lost.vn.'
      );
    }
  }

  // Ensure late MongoDB reconnection also triggers seeding & safety timer sweeper
  mongoose.connection.on('reconnected', () => {
    onDatabaseReady().catch((err) =>
      console.warn('[Bootstrap Reconnect Notice]:', (err as Error).message)
    );
  });

  const connected = await connectDB();
  if (connected) {
    await onDatabaseReady();
  } else {
    scheduleDbReconnect(() => onDatabaseReady());
  }

  httpServer.listen(PORT, () => {
    console.log(`[LOST Server] Running with Socket.io Real-time on http://localhost:${PORT}`);
  });
}

let isShuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[LOST Server] Received ${signal}. Shutting down gracefully...`);

  const forceExitTimer = setTimeout(() => {
    console.error('[LOST Server] Shutdown timed out after 10s, forcing exit.');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  try {
    cancelDbReconnect();

    if (safetyTimerSweepInterval) {
      clearInterval(safetyTimerSweepInterval);
      safetyTimerSweepInterval = null;
    }
    if (weatherAlertInitialTimeout) {
      clearTimeout(weatherAlertInitialTimeout);
      weatherAlertInitialTimeout = null;
    }
    if (weatherAlertSweepInterval) {
      clearInterval(weatherAlertSweepInterval);
      weatherAlertSweepInterval = null;
    }

    stopRateLimiterTimers();
    stopCacheCleanupTimer();
    stopSocketTimers();
    closeMailer();

    const io = getIO();
    if (io) {
      await new Promise<void>((resolve) => io.close(() => resolve()));
    }

    await new Promise<void>((resolve) => {
      if (!httpServer.listening) {
        resolve();
        return;
      }
      httpServer.close(() => resolve());
      // Terminate idle keep-alive sockets so graceful shutdown never hangs
      if (typeof (httpServer as any).closeIdleConnections === 'function') {
        (httpServer as any).closeIdleConnections();
      }
    });

    await disconnectDB();
    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (err) {
    console.error('[LOST Server] Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));

bootstrap().catch((err) => {
  console.error('[LOST Server] Fatal startup error:', err);
  process.exit(1);
});
