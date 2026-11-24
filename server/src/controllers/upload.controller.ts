import crypto from 'crypto';
import { Request, Response } from 'express';
import { optimizeCloudinaryUrl } from '../utils/cloudinary.js';
import { cloudinary, isCloudinaryConfigured } from '../config/cloudinarySDK.js';

const ALLOWED_CATEGORIES = new Set([
  'trails',
  'avatars',
  'covers',
  'forum',
  'reviews',
  'incidents',
  'trip-reports',
  'checkins',
  'guides',
  'custom-routes',
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_BASE64_STRING_CHARS = 7_000_000; // Guard BEFORE regex matching
const DATA_URI_IMAGE_REGEX = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/;

/**
 * Verifies real image magic bytes to prevent fake MIME / HTML / SVG / script uploads.
 */
function hasValidImageMagicBytes(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  // WEBP: RIFF....WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return true;
  }
  return false;
}

/**
 * Hardened Cloudinary Upload Handler (Zero LFI / Zero SSRF / Strict Image Validation)
 */
export const uploadImageToCloudinary = async (req: Request, res: Response) => {
  const { imageBase64, filename, category = 'trails' } = req.body || {};

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp dữ liệu hình ảnh dạng Base64 hợp lệ (PNG, JPG, WEBP).',
    });
  }

  const trimmed = imageBase64.trim();
  // Check length BEFORE executing regex to prevent CPU/memory spikes on oversized payloads
  if (trimmed.length > MAX_BASE64_STRING_CHARS) {
    return res.status(413).json({
      success: false,
      message: 'Kích thước ảnh vượt quá giới hạn cho phép (tối đa 5MB).',
    });
  }

  const match = DATA_URI_IMAGE_REGEX.exec(trimmed);
  if (!match) {
    return res.status(400).json({
      success: false,
      message: 'Định dạng ảnh không hợp lệ. Chỉ chấp nhận ảnh PNG, JPEG, WEBP hoặc GIF dạng Base64.',
    });
  }

  const rawBuffer = Buffer.from(match[2], 'base64');
  if (rawBuffer.length === 0 || rawBuffer.length > MAX_IMAGE_BYTES) {
    return res.status(413).json({
      success: false,
      message: 'Kích thước ảnh vượt quá giới hạn cho phép (tối đa 5MB).',
    });
  }

  if (!hasValidImageMagicBytes(rawBuffer)) {
    return res.status(400).json({
      success: false,
      message: 'Tệp tải lên không phải là tệp hình ảnh hợp lệ.',
    });
  }

  const safeCategory =
    typeof category === 'string' && ALLOWED_CATEGORIES.has(category.trim()) ? category.trim() : 'trails';
  const targetFolder = `lost/${safeCategory}`;

  if (!isCloudinaryConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'Dịch vụ lưu trữ hình ảnh Cloudinary chưa được cấu hình trên máy chủ.',
    });
  }

  try {
    const cleanFilename =
      typeof filename === 'string' && filename.trim()
        ? filename
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .replace(/\.[^/.]+$/, '')
            .slice(0, 40)
        : 'img';
    const uniquePublicId = `${cleanFilename}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const uploadResult = await cloudinary.uploader.upload(trimmed, {
      folder: targetFolder,
      public_id: uniquePublicId,
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      transformation: [{ width: 1200, quality: 'auto', fetch_format: 'auto' }],
    });

    const optimizedUrl = optimizeCloudinaryUrl(uploadResult.secure_url, { width: 1200 });

    return res.json({
      success: true,
      message: 'Tải ảnh lên Cloudinary thành công!',
      url: optimizedUrl,
      rawCloudinaryUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      bytes: uploadResult.bytes,
      format: uploadResult.format,
      createdAt: uploadResult.created_at,
    });
  } catch (err) {
    console.error('[Cloudinary Upload Error]:', (err as Error).message);
    return res.status(502).json({
      success: false,
      message: 'Không thể tải ảnh lên Cloudinary lúc này. Vui lòng thử lại sau.',
    });
  }
};
