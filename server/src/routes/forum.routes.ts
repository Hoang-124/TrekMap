import { Router } from 'express';
import {
  getThreads,
  getThreadById,
  createThread,
  updateThread,
  deleteOwnThread,
  reactToThread,
  getTopTrekkers,
  downloadTrailGpx,
  getCommunityChatMessages,
  deleteCommunityChatMessage,
} from '../controllers/forum.controller.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', optionalAuthMiddleware as any, getThreads);
router.get('/top-trekkers', getTopTrekkers);
router.get('/gpx/:trailId', downloadTrailGpx);
router.get('/chat-messages', getCommunityChatMessages);
router.delete('/chat-messages/:id', authMiddleware as any, deleteCommunityChatMessage as any);
router.get('/threads/:threadId', optionalAuthMiddleware as any, getThreadById);
router.post('/', authMiddleware as any, createThread as any);
router.post('/threads/:threadId/reaction', authMiddleware as any, reactToThread as any);
router.patch('/threads/:threadId', authMiddleware as any, updateThread as any);
router.delete('/threads/:threadId', authMiddleware as any, deleteOwnThread as any);

export default router;
