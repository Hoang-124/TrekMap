export interface ServerImageOptions {
  width?: number;
  height?: number;
  quality?: string;
  format?: string;
}

export function optimizeCloudinaryUrl(
  url: string | undefined | null,
  options: ServerImageOptions = {}
): string {
  if (!url || typeof url !== 'string') {
    return 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80';
  }

  const width = options.width || 800;
  const quality = options.quality || 'auto';
  const format = options.format || 'auto';
  const cleanUrl = url.trim();

  try {
    const parsed = new URL(cleanUrl);

    // Cloudinary URL Optimization Injection (strict hostname check + idempotent)
    if (parsed.hostname === 'res.cloudinary.com') {
      const uploadIndex = cleanUrl.indexOf('/upload/');
      if (uploadIndex !== -1) {
        const prefix = cleanUrl.substring(0, uploadIndex + 8);
        const suffix = cleanUrl.substring(uploadIndex + 8);
        // Avoid duplicating transformation parameters if already present
        if (suffix.startsWith('f_') || suffix.startsWith('q_') || suffix.startsWith('w_')) {
          return cleanUrl;
        }
        const transformParams = `f_${format},q_${quality},w_${width},c_limit`;
        return `${prefix}${transformParams}/${suffix}`;
      }
    }

    // Unsplash Image Auto-Format & WebP Compression
    if (parsed.hostname === 'images.unsplash.com') {
      parsed.searchParams.set('w', width.toString());
      parsed.searchParams.set('q', '80');
      parsed.searchParams.set('auto', 'format,compress');
      parsed.searchParams.set('fm', 'webp');
      return parsed.toString();
    }
  } catch {
    return cleanUrl;
  }

  return cleanUrl;
}
