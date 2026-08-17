import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearReadNotifications,
} from '../controllers/notification.controller.js';

const router = Router();

router.get('/notifications', requireAuth as any, getNotifications as any);
router.put('/notifications/read-all', requireAuth as any, markAllNotificationsRead as any);
router.put('/notifications/:id/read', requireAuth as any, markNotificationRead as any);
router.delete('/notifications/:id', requireAuth as any, deleteNotification as any);
router.delete('/notifications', requireAuth as any, clearReadNotifications as any);

export default router;
