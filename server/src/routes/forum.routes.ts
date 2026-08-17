import { Router } from 'express';
import {
  getThreads,
  createThread,
  reactToThread,
  getTopTrekkers,
  downloadTrailGpx,
  getCommunityChatMessages,
} from '../controllers/forum.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', getThreads);
router.get('/top-trekkers', getTopTrekkers);
router.get('/gpx/:trailId', downloadTrailGpx);
router.get('/chat-messages', getCommunityChatMessages);
router.post('/', authMiddleware as any, createThread as any);
router.post('/threads/:threadId/reaction', authMiddleware as any, reactToThread as any);

export default router;
