import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
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
import { getAuditLogsAdmin } from '../controllers/checkin.controller.js';

const router = Router();

// Base auth gate on all /admin routes; granular RBAC per route below
router.use('/admin', authMiddleware as any);

// Overview stats accessible to both Admin & Moderator
router.get('/admin/stats', requireRole('admin', 'moderator') as any, getAdminStats as any);

// Strict Admin-only Audit Logs & User Management
router.get('/admin/audit-logs', requireRole('admin') as any, getAuditLogsAdmin as any);
router.get('/admin/users', requireRole('admin') as any, getUsersAdmin as any);
router.put('/admin/users/:id/ban', requireRole('admin') as any, banUserAdmin as any);
router.put('/admin/users/:id/unban', requireRole('admin') as any, unbanUserAdmin as any);
router.put('/admin/users/:id/role', requireRole('admin') as any, updateUserRoleAdmin as any);

// Strict Admin-only Trail CRUD
router.post('/admin/trails', requireRole('admin') as any, createTrailAdmin as any);
router.put('/admin/trails/:id', requireRole('admin') as any, updateTrailAdmin as any);
router.delete('/admin/trails/:id', requireRole('admin') as any, deleteTrailAdmin as any);

// Forum Thread & Incident Dispute Moderation (Admin + Moderator)
router.put('/admin/threads/:id/pin', requireRole('admin', 'moderator') as any, pinThreadAdmin as any);
router.put('/admin/threads/:id/lock', requireRole('admin', 'moderator') as any, lockThreadAdmin as any);
router.delete('/admin/threads/:id', requireRole('admin', 'moderator') as any, deleteThreadAdmin as any);
router.put('/admin/incidents/:id/dispute-resolve', requireRole('admin', 'moderator') as any, resolveDisputeIncidentAdmin as any);

// Review deletion (Controller enforces Owner OR Admin/Moderator)
router.delete('/reviews/:id', authMiddleware as any, deleteReview as any);

export default router;
