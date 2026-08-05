import { Router } from 'express';
import { getComments, createComment, reactToComment } from '../controllers/comment.controller.js';

const router = Router();

router.get('/threads/:threadId/comments', getComments);
router.post('/threads/:threadId/comments', createComment);
router.post('/comments/:commentId/reaction', reactToComment);

export default router;
