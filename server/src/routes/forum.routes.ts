import { Router } from 'express';
import {
  getThreads,
  createThread,
  reactToThread,
  getTopTrekkers,
  downloadTrailGpx,
  getCommunityChatMessages,
} from '../controllers/forum.controller.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', optionalAuthMiddleware as any, getThreads);
router.get('/top-trekkers', getTopTrekkers);
router.get('/gpx/:trailId', downloadTrailGpx);
router.get('/chat-messages', getCommunityChatMessages);
router.post('/', authMiddleware as any, createThread as any);
router.post('/threads/:threadId/reaction', optionalAuthMiddleware as any, reactToThread as any);

export default router;
