import { Router } from 'express';
import { uploadImageToCloudinary } from '../controllers/upload.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// POST /api/upload - Upload image to Cloudinary CDN (Requires Authentication)
router.post('/upload', authMiddleware as any, uploadImageToCloudinary as any);

export default router;
