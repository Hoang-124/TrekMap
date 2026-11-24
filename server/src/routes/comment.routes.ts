import { Router } from 'express';
import { getComments, createComment, reactToComment, updateComment, deleteComment } from '../controllers/comment.controller.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/threads/:threadId/comments', optionalAuthMiddleware as any, getComments);
router.post('/threads/:threadId/comments', authMiddleware as any, createComment as any);
router.post('/comments/:commentId/reaction', authMiddleware as any, reactToComment as any);
router.patch('/comments/:commentId', authMiddleware as any, updateComment as any);
router.delete('/comments/:commentId', authMiddleware as any, deleteComment as any);

export default router;
