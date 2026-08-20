import express, { Request, Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { seedAll13Collections } from './utils/seedDatabase.js';
import { initSocketServer } from './config/socket.js';

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


import mongoose from 'mongoose';
import { globalRateLimiter, authRateLimiter, uploadRateLimiter } from './middleware/rateLimiter.middleware.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';

dotenv.config();

export const app = express();
export const httpServer = createServer(app);

// Initialize single real-time Socket.io server instance
initSocketServer(httpServer);

// Connect to MongoDB Database & Seed ALL 13 Collections
connectDB().then(async () => {
  await seedAll13Collections();
});

// Security Headers Middleware
app.use((_req: Request, res: Response, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'https://trekmap.vn',
  'https://www.trekmap.vn',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Không được phép truy cập từ origin: ' + origin), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));

// Global Rate Limiter
app.use(globalRateLimiter);

// Comprehensive Health Check Endpoints
const healthHandler = (_req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap: Record<number, string> = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting',
  };

  res.json({
    app: 'TrekMap API Server',
    status: dbState === 1 ? 'Online' : 'Degraded',
    version: '2.5.0 (Socket.io Real-time Enabled)',
    database: dbStatusMap[dbState] || 'Unknown',
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    timestamp: new Date().toISOString(),
  });
};

app.get('/', healthHandler);
app.get('/api/health', healthHandler);

// Modular Express Routers with Specific Protections
app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/forum', commentRoutes);
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
app.use('/api/ai', aiRoutes);

// Global Error Handler Middleware (Must be last)

app.use(errorHandler);


