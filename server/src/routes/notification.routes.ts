import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getNotifications, markAllNotificationsRead } from '../controllers/notification.controller.js';

const router = Router();

router.get('/notifications', requireAuth, getNotifications);
router.put('/notifications/read-all', requireAuth, markAllNotificationsRead);

export default router;
