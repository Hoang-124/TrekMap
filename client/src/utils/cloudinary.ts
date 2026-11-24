/**
 * Media Image Auto-Optimization Utility
 * - Serves local Field-Atlas SVG covers & inline data URIs directly with zero external requests
 * - Applies responsive WebP/AVIF & width transformations for user-uploaded Cloudinary assets
 */

export interface ImageOptimizeOptions {
  width?: number;
  height?: number;
  quality?: 'auto' | 'auto:eco' | 'good' | 'best' | number;
  format?: 'auto' | 'webp' | 'jpg' | 'png';
  crop?: 'limit' | 'fill' | 'scale' | 'thumb';
}

export const DEFAULT_VIETNAM_TRAIL_COVER = '/covers/trail-fansipan.svg';

export const OFFLINE_MOUNTAIN_SVG_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 480'%3E%3Crect width='800' height='480' fill='%23141916'/%3E%3Cpath d='M0 390 L185 210 L310 315 L470 155 L635 295 L800 220 L800 480 L0 480 Z' fill='%231c231f'/%3E%3Cpath d='M120 480 L345 250 L490 385 L620 265 L800 420 L800 480 Z' fill='%231f6f4a' fill-opacity='0.32'/%3E%3Ccircle cx='610' cy='115' r='26' fill='%23d4a348' fill-opacity='0.45'/%3E%3Ctext x='400' y='438' text-anchor='middle' fill='%23a8b0aa' font-family='sans-serif' font-size='14' letter-spacing='3'%3ELOST VIETNAM ATLAS%3C/text%3E%3C/svg%3E";

/**
 * Returns an optimized image URL for fast loading on desktop/mobile
 */
export function getOptimizedImageUrl(url: string, options: ImageOptimizeOptions = {}): string {
  if (!url || typeof url !== 'string') {
    return DEFAULT_VIETNAM_TRAIL_COVER;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return DEFAULT_VIETNAM_TRAIL_COVER;
  }

  // Local static covers & inline SVG data URIs require zero remote transforms
  if (trimmed.startsWith('/') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  const width = options.width || 800;
  const quality = options.quality || 'auto';
  const format = options.format || 'auto';
  const crop = options.crop || 'limit';

  // User-uploaded Cloudinary CDN Transformation
  if (trimmed.includes('cloudinary.com') && trimmed.includes('/upload/')) {
    if (trimmed.includes('/f_auto,q_auto')) {
      return trimmed;
    }
    const transformStr = `f_${format},q_${quality},w_${width},c_${crop}/`;
    return trimmed.replace('/upload/', `/upload/${transformStr}`);
  }

  return trimmed;
}
