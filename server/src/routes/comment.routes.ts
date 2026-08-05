import { Router } from 'express';
import { getComments, createComment, reactToComment } from '../controllers/comment.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/threads/:threadId/comments', getComments);
router.post('/threads/:threadId/comments', authMiddleware as any, createComment as any);
router.post('/comments/:commentId/reaction', authMiddleware as any, reactToComment as any);

export default router;
