import { Router } from 'express';
import {
  getMyGearPacks,
  createGearPack,
  updateGearPack,
  deleteGearPack,
  getSharedGearPack,
} from '../controllers/gearPack.controller.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/me', authMiddleware as any, getMyGearPacks as any);
router.get('/share/:shareSlug', optionalAuthMiddleware as any, getSharedGearPack as any);
router.post('/', authMiddleware as any, createGearPack as any);
router.put('/:id', authMiddleware as any, updateGearPack as any);
router.patch('/:id', authMiddleware as any, updateGearPack as any);
router.delete('/:id', authMiddleware as any, deleteGearPack as any);

export default router;
