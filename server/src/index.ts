import mongoose from 'mongoose';
import { httpServer } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { seedAll13Collections } from './utils/seedDatabase.js';
import { getIO } from './config/socket.js';
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
  // Ensure late MongoDB reconnection also triggers seeding & safety timer sweeper
  mongoose.connection.on('reconnected', () => {
    onDatabaseReady().catch((err) =>
      console.warn('[Bootstrap Reconnect Notice]:', (err as Error).message)
    );
  });

  const connected = await connectDB();
  if (connected) {
    await onDatabaseReady();
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

    const io = getIO();
    if (io) {
      await new Promise<void>((resolve) => io.close(() => resolve()));
    }

    await new Promise<void>((resolve) => {
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
