import { Router } from 'express';
import { requireAuth, optionalAuthMiddleware } from '../middleware/auth.middleware.js';
import {
  createTrailCondition,
  getTrailConditions,
  upvoteTrailCondition,
  deleteTrailCondition,
} from '../controllers/trailCondition.controller.js';

const router = Router();

router.post('/trail-conditions', requireAuth as any, createTrailCondition as any);
router.get('/trail-conditions/trail/:trailId', optionalAuthMiddleware as any, getTrailConditions as any);
router.post('/trail-conditions/:id/upvote', requireAuth as any, upvoteTrailCondition as any);
router.delete('/trail-conditions/:conditionId', requireAuth as any, deleteTrailCondition as any);
router.delete('/trails/:id/conditions/:conditionId', requireAuth as any, deleteTrailCondition as any);

export default router;
