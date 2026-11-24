import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getMyTrainingPlans,
  createTrainingPlan,
  getTrainingPlanById,
  toggleTrainingSession,
  updateTrainingPlanStatus,
  deleteTrainingPlan,
} from '../controllers/training.controller.js';

const router = Router();

// Mounted at /api/training-plans (all private per-user routes)
router.use(authMiddleware as any);

router.get('/me', getMyTrainingPlans as any);
router.post('/', createTrainingPlan as any);
router.get('/:id', getTrainingPlanById as any);
router.patch('/:id/sessions/:sessionId', toggleTrainingSession as any);
router.patch('/:id/status', updateTrainingPlanStatus as any);
router.delete('/:id', deleteTrainingPlan as any);

export default router;
