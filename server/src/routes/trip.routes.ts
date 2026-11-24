import { Router } from 'express';
import { requireAuth, optionalAuthMiddleware } from '../middleware/auth.middleware.js';
import {
  createTripPlan,
  getTripPlans,
  getTripCalendar,
  getTripPlanById,
  requestJoinTrip,
  approveJoinTrip,
  rejectJoinTrip,
  leaveTrip,
  updateTripStatus,
  deleteTripPlan,
  openTripGroupChat,
  addSharedGear,
  updateSharedGear,
  deleteSharedGear,
  addTripExpense,
  deleteTripExpense,
} from '../controllers/trip.controller.js';

const router = Router();

router.post('/trips', requireAuth as any, createTripPlan as any);
router.get('/trips', optionalAuthMiddleware as any, getTripPlans as any);
// IMPORTANT: Register /trips/calendar BEFORE /trips/:id
router.get('/trips/calendar', getTripCalendar as any);
router.get('/trips/:id', optionalAuthMiddleware as any, getTripPlanById as any);

router.post('/trips/:id/join', requireAuth as any, requestJoinTrip as any);
router.put('/trips/:id/approve', requireAuth as any, approveJoinTrip as any);
router.put('/trips/:id/reject', requireAuth as any, rejectJoinTrip as any);
router.post('/trips/:id/leave', requireAuth as any, leaveTrip as any);
router.patch('/trips/:id/status', requireAuth as any, updateTripStatus as any);
router.delete('/trips/:id', requireAuth as any, deleteTripPlan as any);

// Expedition Squad Workspace (Group Chat, Shared Gear & Expense Splitter)
router.post('/trips/:id/group-chat', requireAuth as any, openTripGroupChat as any);
router.post('/trips/:id/gear', requireAuth as any, addSharedGear as any);
router.patch('/trips/:id/gear/:gearId', requireAuth as any, updateSharedGear as any);
router.delete('/trips/:id/gear/:gearId', requireAuth as any, deleteSharedGear as any);
router.post('/trips/:id/expenses', requireAuth as any, addTripExpense as any);
router.delete('/trips/:id/expenses/:expenseId', requireAuth as any, deleteTripExpense as any);

export default router;
