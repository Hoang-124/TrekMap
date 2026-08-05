import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../controllers/notification.controller.js';

const router = Router();

// All routes require JWT Authentication
router.get('/notifications', authMiddleware as any, getNotifications as any);
router.get('/notifications/unread-count', authMiddleware as any, getUnreadCount as any);
router.patch('/notifications/read-all', authMiddleware as any, markAllNotificationsAsRead as any);
router.patch('/notifications/:id/read', authMiddleware as any, markNotificationAsRead as any);

export default router;
