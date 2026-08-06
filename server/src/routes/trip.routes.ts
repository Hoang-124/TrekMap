import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { createTripPlan, getTripPlans, getTripPlanById, requestJoinTrip, approveJoinTrip } from '../controllers/trip.controller.js';

const router = Router();

router.post('/trips', requireAuth, createTripPlan);
router.get('/trips', getTripPlans);
router.get('/trips/:id', getTripPlanById);
router.post('/trips/:id/join', requireAuth, requestJoinTrip);
router.put('/trips/:id/approve', requireAuth, approveJoinTrip);

export default router;
