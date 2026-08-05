import { Router } from 'express';
import { getThreads, createThread, reactToThread } from '../controllers/forum.controller.js';

const router = Router();

router.get('/', getThreads);
router.post('/', createThread);
router.post('/threads/:threadId/reaction', reactToThread);

export default router;
