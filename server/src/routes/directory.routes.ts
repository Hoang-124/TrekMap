import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { routeCache } from '../middleware/cache.middleware.js';
import { inquiryRateLimiter } from '../middleware/rateLimiter.middleware.js';
import {
  getDirectoryGuides,
  getDirectoryGuideById,
  createGuideInquiry,
  getMyGuideInquiries,
  getAllGuideInquiriesAdmin,
  updateGuideInquiryStatus,
  getRangerStations,
  estimateTripCost,
} from '../controllers/directory.controller.js';

const router = Router();

// Mounted at /api/directory
router.get('/guides', routeCache(300), getDirectoryGuides);
router.get('/guides/:id', getDirectoryGuideById);
router.post('/guides/:id/inquiries', inquiryRateLimiter, authMiddleware as any, createGuideInquiry as any);

router.get('/inquiries', authMiddleware as any, requireRole('admin', 'moderator') as any, getAllGuideInquiriesAdmin as any);
router.get('/inquiries/me', authMiddleware as any, getMyGuideInquiries as any);
router.patch('/inquiries/:id/status', authMiddleware as any, updateGuideInquiryStatus as any);

router.get('/rangers', routeCache(600), getRangerStations);
router.get('/cost-estimate', routeCache(300), estimateTripCost);

export default router;
