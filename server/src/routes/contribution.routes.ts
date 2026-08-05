import { Router } from 'express';
import {
  getContributions,
  createContribution,
  updateContribution,
  deleteContribution,
} from '../controllers/contribution.controller.js';

const router = Router();

router.get('/contributions', getContributions);
router.post('/contributions', createContribution);
router.put('/contributions/:id', updateContribution);
router.delete('/contributions/:id', deleteContribution);

export default router;
