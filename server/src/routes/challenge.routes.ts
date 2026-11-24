import { Router } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware.js';
import { routeCache } from '../middleware/cache.middleware.js';
import {
  getChallenges,
  getMyPeakPassport,
  getChallengeLeaderboard,
  getChallengeBySlug,
  claimChallengeReward,
} from '../controllers/challenge.controller.js';

const router = Router();

// Mounted at /api/challenges
router.get('/', optionalAuthMiddleware as any, getChallenges as any);
router.get('/leaderboard', routeCache(120), getChallengeLeaderboard);
router.get('/passport/me', authMiddleware as any, getMyPeakPassport as any);
router.get('/:slug', optionalAuthMiddleware as any, getChallengeBySlug as any);
router.post('/:slug/claim', authMiddleware as any, claimChallengeReward as any);

export default router;
