import { Router } from 'express';
import { getTrails, getNearbyTrails, getTrailById, getGuides, createContribution, createReview } from '../controllers/trail.controller.js';

const router = Router();

router.get('/trails/nearby', getNearbyTrails);
router.get('/trails', getTrails);
router.get('/trails/:id', getTrailById);
router.get('/guides', getGuides);
router.post('/contributions', createContribution);
router.post('/reviews', createReview);

export default router;
