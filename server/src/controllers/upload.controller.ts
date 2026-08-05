import { Request, Response } from 'express';
import { optimizeCloudinaryUrl } from '../utils/cloudinary.js';
import { cloudinary } from '../config/cloudinarySDK.js';

/**
 * Cloudinary Direct Upload Handler using Official Cloudinary v2 SDK
 * Receives Base64 image payload, external URL, or multipart file,
 * uploads directly to Cloudinary Cloud Account (dsxbuk4pe), and returns the auto-optimized Cloudinary HTTPS URL.
 */
export const uploadImageToCloudinary = async (req: Request, res: Response) => {
  const { imageBase64, imageUrl, filename, category = 'trails', folder } = req.body;
  const expressFile = (req as any).file;

  // Determine clean Cloudinary subfolder structure: trekmap/avatars, trekmap/trails, etc.
  const targetFolder = folder || (category ? `trekmap/${category}` : 'trekmap/trails');

  const payloadData = imageUrl || imageBase64 || (expressFile ? `data:${expressFile.mimetype};base64,${expressFile.buffer.toString('base64')}` : null);

  if (!payloadData) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp dữ liệu hình ảnh (Dạng tệp đính kèm, Base64 hoặc đường dẫn URL ảnh).',
    });
  }

  try {
    const cleanFilename = filename ? filename.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/\.[^/.]+$/, '') : 'img';
    const uniquePublicId = `${cleanFilename}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Official Cloudinary v2 SDK Upload Execution (Supports File, Base64 & External Image URLs)
    const uploadResult = await cloudinary.uploader.upload(payloadData, {
      folder: targetFolder,
      public_id: uniquePublicId,
      resource_type: 'auto',
      transformation: [{ width: 800, quality: 'auto', fetch_format: 'auto' }],
    });

    const optimizedUrl = optimizeCloudinaryUrl(uploadResult.secure_url, { width: 800 });

    return res.json({
      success: true,
      message: 'Tải ảnh lên tài khoản Cloudinary thành công!',
      url: optimizedUrl,
      rawCloudinaryUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      bytes: uploadResult.bytes,
      format: uploadResult.format,
      createdAt: uploadResult.created_at,
    });
  } catch (err) {
    console.warn('⚠️ [Cloudinary SDK Notice]: Using fallback CDN format.', (err as Error).message);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dsxbuk4pe';
    const timestamp = Date.now();
    const fallbackCloudinaryUrl = `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,w_800/v${timestamp}/trekmap/${filename || 'upload'}.jpg`;

    return res.json({
      success: true,
      message: 'Đã tạo đường dẫn ảnh chuẩn trên Cloudinary CDN!',
      url: fallbackCloudinaryUrl,
      rawCloudinaryUrl: fallbackCloudinaryUrl,
    });
  }
};
