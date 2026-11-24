import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getMyLogbook,
  getMyLogbookAnalytics,
  updateLogbookEntry,
  deleteLogbookEntry,
  exportLogbookGpx,
} from '../controllers/logbook.controller.js';

const router = Router();

// Mounted at /api/logbook
router.use(authMiddleware as any);

router.get('/me', getMyLogbook as any);
router.get('/analytics/me', getMyLogbookAnalytics as any);
router.patch('/:checkinId', updateLogbookEntry as any);
router.delete('/:checkinId', deleteLogbookEntry as any);
router.get('/:checkinId/gpx', exportLogbookGpx as any);

export default router;
