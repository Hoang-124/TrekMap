import { Router } from 'express';
import { getComments, createComment, reactToComment } from '../controllers/comment.controller.js';
import { optionalAuthMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/threads/:threadId/comments', optionalAuthMiddleware as any, getComments);
router.post('/threads/:threadId/comments', optionalAuthMiddleware as any, createComment as any);
router.post('/comments/:commentId/reaction', optionalAuthMiddleware as any, reactToComment as any);

export default router;
