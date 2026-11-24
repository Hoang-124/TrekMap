import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getConversations,
  getConversationById,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markConversationAsRead,
} from '../controllers/message.controller.js';

const router = Router();

// All routes require JWT Authentication
router.get('/conversations', authMiddleware as any, getConversations as any);
router.post('/conversations', authMiddleware as any, getOrCreateConversation as any);
router.get('/conversations/:id', authMiddleware as any, getConversationById as any);
router.get('/conversations/:id/messages', authMiddleware as any, getMessages as any);
router.post('/messages', authMiddleware as any, sendMessage as any);
router.patch('/messages/:id', authMiddleware as any, editMessage as any);
router.delete('/messages/:id', authMiddleware as any, deleteMessage as any);
router.patch('/conversations/:id/read', authMiddleware as any, markConversationAsRead as any);

export default router;
