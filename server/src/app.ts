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

dotenv.config();

export const app = express();
export const httpServer = createServer(app);

// Initialize single real-time Socket.io server instance
initSocketServer(httpServer);

// Connect to MongoDB Database & Seed ALL 13 Collections
connectDB().then(async () => {
  await seedAll13Collections();
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health Check Endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    app: 'TrekMap API Server',
    status: 'Online',
    version: '2.5.0 (Socket.io Real-time Enabled)',
    timestamp: new Date().toISOString(),
  });
});

// Modular Express Routers
app.use('/api/auth', authRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/forum', commentRoutes);
app.use('/api', uploadRoutes);
app.use('/api', contributionRoutes);
app.use('/api', messageRoutes);
app.use('/api', notificationRoutes);
app.use('/api', trailRoutes);
app.use('/api', incidentRoutes);

