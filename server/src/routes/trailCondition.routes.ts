import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { createTrailCondition, getTrailConditions, upvoteTrailCondition } from '../controllers/trailCondition.controller.js';

const router = Router();

router.post('/trail-conditions', requireAuth, createTrailCondition);
router.get('/trail-conditions/trail/:trailId', getTrailConditions);
router.post('/trail-conditions/:id/upvote', requireAuth, upvoteTrailCondition);

export default router;
