import { Router } from 'express';
import { requireAuth, optionalAuthMiddleware } from '../middleware/auth.middleware.js';
import {
  createTripReport,
  getTripReports,
  getTripReportById,
  reactTripReport,
  updateTripReport,
  deleteTripReport,
  addTripReportComment,
  deleteTripReportComment,
} from '../controllers/tripReport.controller.js';

const router = Router();

router.post('/trip-reports', requireAuth as any, createTripReport as any);
router.get('/trip-reports', optionalAuthMiddleware as any, getTripReports as any);
router.get('/trip-reports/:id', optionalAuthMiddleware as any, getTripReportById as any);
router.post('/trip-reports/:id/react', requireAuth as any, reactTripReport as any);
router.post('/trip-reports/:id/comments', requireAuth as any, addTripReportComment as any);
router.delete('/trip-reports/:id/comments/:commentId', requireAuth as any, deleteTripReportComment as any);
router.patch('/trip-reports/:id', requireAuth as any, updateTripReport as any);
router.delete('/trip-reports/:id', requireAuth as any, deleteTripReport as any);

export default router;
