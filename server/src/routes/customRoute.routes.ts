import { Router } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.middleware.js';
import {
  analyzeCustomRoute,
  createCustomRoute,
  getMyCustomRoutes,
  getPublicCustomRoutes,
  getCustomRouteByShareSlug,
  updateCustomRoute,
  deleteCustomRoute,
  toggleLikeCustomRoute,
  exportCustomRouteGpx,
} from '../controllers/customRoute.controller.js';

const router = Router();

const routeAnalyzeLimiter = createRateLimiter(
  25,
  5 * 60 * 1000,
  'Phân tích lộ trình quá nhanh. Vui lòng đợi vài phút.',
  'route-analyze'
);

const routeWriteLimiter = createRateLimiter(
  20,
  15 * 60 * 1000,
  'Bạn lưu/cập nhật lộ trình quá nhanh. Vui lòng đợi ít phút.',
  'route-write'
);

// Mounted at /api/custom-routes
router.post('/analyze', routeAnalyzeLimiter, optionalAuthMiddleware as any, analyzeCustomRoute as any);
router.post('/', routeWriteLimiter, authMiddleware as any, createCustomRoute as any);
router.get('/me', authMiddleware as any, getMyCustomRoutes as any);
router.get('/public', optionalAuthMiddleware as any, getPublicCustomRoutes as any);
router.get('/share/:shareSlug/gpx', optionalAuthMiddleware as any, exportCustomRouteGpx as any);
router.get('/share/:shareSlug', optionalAuthMiddleware as any, getCustomRouteByShareSlug as any);
router.put('/:id', routeWriteLimiter, authMiddleware as any, updateCustomRoute as any);
router.delete('/:id', authMiddleware as any, deleteCustomRoute as any);
router.post('/:id/like', authMiddleware as any, toggleLikeCustomRoute as any);

export default router;
