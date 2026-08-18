import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getUsersAdmin,
  banUserAdmin,
  unbanUserAdmin,
  updateUserRoleAdmin,
  getAdminStats,
} from '../controllers/user.controller.js';
import {
  createTrailAdmin,
  updateTrailAdmin,
  deleteTrailAdmin,
  deleteReview,
} from '../controllers/trail.controller.js';
import {
  pinThreadAdmin,
  lockThreadAdmin,
  deleteThreadAdmin,
} from '../controllers/forum.controller.js';
import { resolveDisputeIncidentAdmin } from '../controllers/incident.controller.js';

const router = Router();

// Scope Auth Middleware to /admin paths
router.use('/admin', authMiddleware as any);

// Admin Stats
router.get('/admin/stats', getAdminStats as any);

// User Management
router.get('/admin/users', getUsersAdmin as any);
router.put('/admin/users/:id/ban', banUserAdmin as any);
router.put('/admin/users/:id/unban', unbanUserAdmin as any);
router.put('/admin/users/:id/role', updateUserRoleAdmin as any);

// Trail CRUD
router.post('/admin/trails', createTrailAdmin as any);
router.put('/admin/trails/:id', updateTrailAdmin as any);
router.delete('/admin/trails/:id', deleteTrailAdmin as any);

// Forum Thread Moderation
router.put('/admin/threads/:id/pin', pinThreadAdmin as any);
router.put('/admin/threads/:id/lock', lockThreadAdmin as any);
router.delete('/admin/threads/:id', deleteThreadAdmin as any);

// Incident Dispute Resolution
router.put('/admin/incidents/:id/dispute-resolve', resolveDisputeIncidentAdmin as any);

// Review Management
router.delete('/reviews/:id', authMiddleware as any, deleteReview as any);

export default router;
