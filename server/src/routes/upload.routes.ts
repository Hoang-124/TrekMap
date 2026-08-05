import { Router } from 'express';
import { uploadImageToCloudinary } from '../controllers/upload.controller.js';

const router = Router();

// POST /api/upload - Upload image to Cloudinary CDN
router.post('/upload', uploadImageToCloudinary);

export default router;
