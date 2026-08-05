import { Router } from 'express';
import { getIncidents, createIncident } from '../controllers/incident.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/incidents', getIncidents);
router.post('/incidents', authMiddleware as any, createIncident as any);

export default router;
