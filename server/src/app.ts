import express, { Request, Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { initSocketServer } from './config/socket.js';
import { getAllowedOrigins } from './config/cors.js';

import authRoutes from './routes/auth.routes.js';
import forumRoutes from './routes/forum.routes.js';
import commentRoutes from './routes/comment.routes.js';
import trailRoutes from './routes/trail.routes.js';
import incidentRoutes from './routes/incident.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import contributionRoutes from './routes/contribution.routes.js';
import messageRoutes from './routes/message.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import adminRoutes from './routes/admin.routes.js';
import followRoutes from './routes/follow.routes.js';
import trailConditionRoutes from './routes/trailCondition.routes.js';
import tripReportRoutes from './routes/tripReport.routes.js';
import tripRoutes from './routes/trip.routes.js';
import aiRoutes from './routes/ai.routes.js';
import checkinRoutes from './routes/checkin.routes.js';
import safetyTimerRoutes from './routes/safetyTimer.routes.js';
import challengeRoutes from './routes/challenge.routes.js';
import trainingRoutes from './routes/training.routes.js';
import directoryRoutes from './routes/directory.routes.js';
import logbookRoutes from './routes/logbook.routes.js';
import customRouteRoutes from './routes/customRoute.routes.js';
import gearPackRoutes from './routes/gearPack.routes.js';
import liveBeaconRoutes from './routes/liveBeacon.routes.js';
import weatherAlertRoutes from './routes/weatherAlert.routes.js';
import trailPoiRoutes, { analyticsRoutes } from './routes/trailPoi.routes.js';

import { globalRateLimiter } from './middleware/rateLimiter.middleware.js';
import { gzipCompression } from './middleware/compression.middleware.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';

dotenv.config();

export const app = express();
export const httpServer = createServer(app);

// Hide framework fingerprint
app.disable('x-powered-by');

// Configure reverse proxy trust explicitly via env (never blind `true`)
const trustProxyEnv = process.env.TRUST_PROXY;
if (trustProxyEnv) {
  const parsed = Number(trustProxyEnv);
  app.set('trust proxy', Number.isFinite(parsed) ? parsed : trustProxyEnv === 'loopback' ? 'loopback' : 1);
} else {
  app.set('trust proxy', false);
}

// Initialize real-time Socket.io server instance
initSocketServer(httpServer);

// Security Headers Middleware
app.use((_req: Request, res: Response, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

const allowedOrigins = getAllowedOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  })
);

// Scoped JSON body limits: 10mb ONLY for base64 image upload / profile avatar / GPX / AI vision & GPX routes; 512kb default for all other APIs
const largeJsonParser = express.json({ limit: '10mb' });
const defaultJsonParser = express.json({ limit: '512kb' });
app.use((req, res, next) => {
  const p = req.path || '';
  if (
    p === '/api/upload' ||
    p === '/api/auth/profile' ||
    p.startsWith('/api/custom-routes') ||
    p === '/api/ai/analyze-image' ||
    p === '/api/ai/analyze-gpx'
  ) {
    return largeJsonParser(req, res, next);
  }
  return defaultJsonParser(req, res, next);
});

app.use(gzipCompression);

// Global Rate Limiter
app.use(globalRateLimiter);

// Comprehensive Health Check Endpoints (returns 503 when DB degraded, zero internal memory leak)
const healthHandler = (_req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap: Record<number, string> = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting',
  };
  const isHealthy = dbState === 1;

  res.status(isHealthy ? 200 : 503).json({
    app: 'LOST API Server',
    status: isHealthy ? 'Online' : 'Degraded',
    version: '3.0.0 (Hardened Security, Real-time Socket.IO & Expedition Hubs)',
    database: dbStatusMap[dbState] || 'Unknown',
    timestamp: new Date().toISOString(),
  });
};

app.get('/', healthHandler);
app.get('/api/health', healthHandler);

// Modular Express Routers
app.use('/api/auth', authRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/forum', commentRoutes);
app.use('/api', commentRoutes);
app.use('/api', uploadRoutes);
app.use('/api', contributionRoutes);
app.use('/api', messageRoutes);
app.use('/api', notificationRoutes);
app.use('/api', trailRoutes);
app.use('/api', incidentRoutes);
app.use('/api', adminRoutes);
app.use('/api', followRoutes);
app.use('/api', trailConditionRoutes);
app.use('/api', tripReportRoutes);
app.use('/api', tripRoutes);
app.use('/api', checkinRoutes);
app.use('/api', safetyTimerRoutes);

// New Flagship LOST Expansion Routers
app.use('/api/challenges', challengeRoutes);
app.use('/api/training-plans', trainingRoutes);
app.use('/api/directory', directoryRoutes);
app.use('/api/logbook', logbookRoutes);
app.use('/api/custom-routes', customRouteRoutes);
app.use('/api/gear-packs', gearPackRoutes);
app.use('/api/live-beacons', liveBeaconRoutes);
app.use('/api/weather-alerts', weatherAlertRoutes);
app.use('/api/trail-pois', trailPoiRoutes);
app.use('/api/analytics', analyticsRoutes);

// AI Assistant Router (untouched mount)
app.use('/api/ai', aiRoutes);

// 404 JSON Catch-All for unknown API routes
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Không tìm thấy endpoint API yêu cầu.' });
});

// Global Error Handler Middleware (Must be last)
app.use(errorHandler);
