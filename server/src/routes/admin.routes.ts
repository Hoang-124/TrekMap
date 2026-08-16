import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getUsersAdmin, banUserAdmin, unbanUserAdmin, getAdminStats } from '../controllers/user.controller.js';
import { createTrailAdmin, updateTrailAdmin, deleteTrailAdmin, deleteReview } from '../controllers/trail.controller.js';
import { routeCache } from '../middleware/cache.middleware.js';

const router = Router();

// Scope Auth Middleware to /admin paths
router.use('/admin', authMiddleware as any);

// Admin Stats
router.get('/admin/stats', routeCache(60), getAdminStats as any);

// User Management
router.get('/admin/users', routeCache(60), getUsersAdmin as any);
router.put('/admin/users/:id/ban', banUserAdmin as any);
router.put('/admin/users/:id/unban', unbanUserAdmin as any);

// Trail CRUD
router.post('/admin/trails', createTrailAdmin as any);
router.put('/admin/trails/:id', updateTrailAdmin as any);
router.delete('/admin/trails/:id', deleteTrailAdmin as any);

// Review Management
router.delete('/reviews/:id', authMiddleware as any, deleteReview as any);

export default router;
