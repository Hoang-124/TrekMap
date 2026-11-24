import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import {
  getMySafetyTimers,
  createSafetyTimer,
  markSafetyTimerSafe,
  cancelSafetyTimer,
  extendSafetyTimer,
  getAdminSafetyTimers,
} from '../controllers/safetyTimer.controller.js';

const router = Router();

router.get('/safety-timers/admin', authMiddleware as any, requireRole('admin', 'moderator') as any, getAdminSafetyTimers as any);
router.get('/safety-timers/me', authMiddleware as any, getMySafetyTimers as any);
router.post('/safety-timers', authMiddleware as any, createSafetyTimer as any);
router.patch('/safety-timers/:id/extend', authMiddleware as any, extendSafetyTimer as any);
router.put('/safety-timers/:id/safe', authMiddleware as any, markSafetyTimerSafe as any);
router.put('/safety-timers/:id/cancel', authMiddleware as any, cancelSafetyTimer as any);

export default router;
