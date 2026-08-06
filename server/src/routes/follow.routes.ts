import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { toggleFollowUser, checkFollowStatus } from '../controllers/follow.controller.js';

const router = Router();

router.post('/users/:id/follow', requireAuth, toggleFollowUser);
router.get('/users/:id/follow-status', requireAuth, checkFollowStatus);

export default router;
