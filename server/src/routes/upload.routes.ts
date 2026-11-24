import { Router } from 'express';
import { uploadImageToCloudinary, deleteImageFromCloudinary } from '../controllers/upload.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { uploadRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

// POST /api/upload - Upload image to Cloudinary CDN (Requires Authentication & Rate Limiter)
router.post('/upload', uploadRateLimiter, authMiddleware as any, uploadImageToCloudinary as any);

// DELETE /api/upload - Safely destroy orphaned `lost/`-scoped Cloudinary image asset
router.delete('/upload', uploadRateLimiter, authMiddleware as any, deleteImageFromCloudinary as any);

export default router;
