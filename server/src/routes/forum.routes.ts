import { Router } from 'express';
import { getThreads, createThread, reactToThread } from '../controllers/forum.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', getThreads);
router.post('/', authMiddleware as any, createThread as any);
router.post('/threads/:threadId/reaction', authMiddleware as any, reactToThread as any);

export default router;
