import { Router } from 'express';
import { getIncidents, createIncident, resolveIncident, deleteIncident } from '../controllers/incident.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/incidents', getIncidents);
router.post('/incidents', authMiddleware as any, createIncident as any);
router.put('/incidents/:id/resolve', authMiddleware as any, resolveIncident as any);
router.delete('/incidents/:id', authMiddleware as any, deleteIncident as any);

export default router;
