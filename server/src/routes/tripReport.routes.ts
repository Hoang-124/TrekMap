import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { createTripReport, getTripReports, getTripReportById, reactTripReport } from '../controllers/tripReport.controller.js';

const router = Router();

router.post('/trip-reports', requireAuth, createTripReport);
router.get('/trip-reports', getTripReports);
router.get('/trip-reports/:id', getTripReportById);
router.post('/trip-reports/:id/react', requireAuth, reactTripReport);

export default router;
