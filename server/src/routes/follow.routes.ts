import { Router } from 'express';
import { requireAuth, optionalAuthMiddleware } from '../middleware/auth.middleware.js';
import {
  toggleFollowUser,
  checkFollowStatus,
  getUserFollowers,
  getUserFollowing,
} from '../controllers/follow.controller.js';
import { getUserPublicProfile } from '../controllers/user.controller.js';

const router = Router();

router.get('/users/profile/:identifier', getUserPublicProfile);
router.post('/users/:id/follow', requireAuth as any, toggleFollowUser as any);
router.get('/users/:id/follow-status', requireAuth as any, checkFollowStatus as any);
router.get('/users/:id/followers', optionalAuthMiddleware as any, getUserFollowers as any);
router.get('/users/:id/following', optionalAuthMiddleware as any, getUserFollowing as any);

export default router;
