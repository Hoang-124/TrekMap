import { Router } from 'express';
import { chatWithAi, getQuickPrompts } from '../controllers/ai.controller.js';

const router = Router();

// AI Chat Endpoint
router.post('/chat', chatWithAi as any);

// Contextual Quick Prompts Endpoint
router.get('/quick-prompts', getQuickPrompts as any);

export default router;
