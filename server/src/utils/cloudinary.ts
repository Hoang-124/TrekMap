/**
 * Server-Side Cloudinary & CDN Auto-Optimization Helper
 */

export interface ServerImageOptions {
  width?: number;
  height?: number;
  quality?: string;
  format?: string;
}

/**
 * Transforms any image URL into a Cloudinary/CDN optimized URL with f_auto, q_auto, w_800
 */
export function optimizeCloudinaryUrl(
  url: string | undefined | null,
  options: ServerImageOptions = {}
): string {
  if (!url) {
    return 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80';
  }

  const width = options.width || 800;
  const quality = options.quality || 'auto';
  const format = options.format || 'auto';

  const cleanUrl = url.trim();

  // Cloudinary URL Optimization Injection
  if (cleanUrl.includes('res.cloudinary.com')) {
    const uploadIndex = cleanUrl.indexOf('/upload/');
    if (uploadIndex !== -1) {
      const transformParams = `f_${format},q_${quality},w_${width},c_limit`;
      const prefix = cleanUrl.substring(0, uploadIndex + 8);
      const suffix = cleanUrl.substring(uploadIndex + 8);
      return `${prefix}${transformParams}/${suffix}`;
    }
  }

  // Unsplash Image Auto-Format & WebP Compression
  if (cleanUrl.includes('images.unsplash.com')) {
    try {
      const parsed = new URL(cleanUrl);
      parsed.searchParams.set('w', width.toString());
      parsed.searchParams.set('q', '80');
      parsed.searchParams.set('auto', 'format,compress');
      parsed.searchParams.set('fm', 'webp');
      return parsed.toString();
    } catch (e) {
      return cleanUrl;
    }
  }

  return cleanUrl;
}
