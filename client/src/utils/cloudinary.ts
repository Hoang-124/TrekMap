/**
 * Cloudinary & Image CDN Auto-Optimization Helper Utility
 * Enforces automatic format (f_auto: WebP/AVIF), quality (q_auto), and responsive resizing (default: w_800)
 */

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: string | number; // 'auto', 'auto:eco', 80, etc.
  format?: string; // 'auto', 'webp', 'avif'
  crop?: string; // 'limit', 'fill', 'scale', 'thumb'
}

/**
 * Returns optimized image URL using Cloudinary CDN transformations (f_auto, q_auto, w_800)
 * Works for Cloudinary URLs, Unsplash URLs, and generic image links.
 */
export function getOptimizedImageUrl(
  originalUrl: string | undefined | null,
  options: ImageOptimizationOptions = {}
): string {
  if (!originalUrl) {
    return 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80';
  }

  const {
    width = 800,
    height,
    quality = 'auto',
    format = 'auto',
    crop = 'limit',
  } = options;

  const url = originalUrl.trim();

  // 1. Cloudinary CDN Transformation Injection
  if (url.includes('res.cloudinary.com')) {
    const uploadIndex = url.indexOf('/upload/');
    if (uploadIndex !== -1) {
      const transformParams = [
        `f_${format}`,
        `q_${quality}`,
        `w_${width}`,
        height ? `h_${height}` : null,
        `c_${crop}`,
      ]
        .filter(Boolean)
        .join(',');

      const prefix = url.substring(0, uploadIndex + 8); // includes '/upload/'
      const suffix = url.substring(uploadIndex + 8);
      return `${prefix}${transformParams}/${suffix}`;
    }
  }

  // 2. Unsplash Auto-Optimization Transformation
  if (url.includes('images.unsplash.com')) {
    try {
      const parsedUrl = new URL(url);
      parsedUrl.searchParams.set('w', width.toString());
      if (height) parsedUrl.searchParams.set('h', height.toString());
      parsedUrl.searchParams.set('q', typeof quality === 'number' ? quality.toString() : '80');
      parsedUrl.searchParams.set('auto', 'format,compress');
      parsedUrl.searchParams.set('fm', 'webp');
      return parsedUrl.toString();
    } catch (e) {
      return url;
    }
  }

  // 3. Generic Cloudinary Helper CDN Proxy Fallback
  return url;
}
