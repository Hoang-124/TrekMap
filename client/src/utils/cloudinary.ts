/**
 * Cloudinary CDN & Unsplash Image Auto-Optimization Utility
 * Automatically injects responsive widths, modern formats (WebP/AVIF), and quality optimizations.
 */

export interface ImageOptimizeOptions {
  width?: number;
  height?: number;
  quality?: 'auto' | 'good' | 'best' | number;
  format?: 'auto' | 'webp' | 'jpg' | 'png';
  crop?: 'limit' | 'fill' | 'scale' | 'thumb';
}

/**
 * Returns an optimized image URL for fast loading on desktop/mobile
 */
export function getOptimizedImageUrl(url: string, options: ImageOptimizeOptions = {}): string {
  if (!url || typeof url !== 'string') {
    return 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80';
  }

  const width = options.width || 800;
  const quality = options.quality || 'auto';
  const format = options.format || 'auto';
  const crop = options.crop || 'limit';

  // 1. Cloudinary CDN Transformation
  if (url.includes('cloudinary.com') && url.includes('/upload/')) {
    // Avoid double transforming if transformations are already present
    if (url.includes('/f_auto,q_auto')) {
      return url;
    }
    const transformStr = `f_${format},q_${quality},w_${width},c_${crop}/`;
    return url.replace('/upload/', `/upload/${transformStr}`);
  }

  // 2. Unsplash Image Optimization
  if (url.includes('images.unsplash.com')) {
    try {
      const parsedUrl = new URL(url);
      parsedUrl.searchParams.set('auto', 'format');
      parsedUrl.searchParams.set('fit', options.height ? 'crop' : 'max');
      parsedUrl.searchParams.set('w', width.toString());
      if (options.height) {
        parsedUrl.searchParams.set('h', options.height.toString());
      }
      parsedUrl.searchParams.set('q', typeof quality === 'number' ? quality.toString() : '80');
      return parsedUrl.toString();
    } catch (e) {
      return url;
    }
  }

  return url;
}
