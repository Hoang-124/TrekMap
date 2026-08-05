import { Router } from 'express';
import {
  getContributions,
  createContribution,
  updateContribution,
  deleteContribution,
} from '../controllers/contribution.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// Public READ routes
router.get('/contributions', getContributions);

// Protected WRITE routes (Require Authentication)
router.post('/contributions', authMiddleware as any, createContribution as any);
router.put('/contributions/:id', authMiddleware as any, updateContribution as any);
router.delete('/contributions/:id', authMiddleware as any, deleteContribution as any);

export default router;
