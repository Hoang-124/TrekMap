import { Router } from 'express';
import { uploadImageToCloudinary } from '../controllers/upload.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { uploadRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

// POST /api/upload - Upload image to Cloudinary CDN (Requires Authentication & Rate Limiter)
router.post('/upload', uploadRateLimiter, authMiddleware as any, uploadImageToCloudinary as any);

export default router;
