import React, { useState } from 'react';
import {
  getOptimizedImageUrl,
  OFFLINE_MOUNTAIN_SVG_FALLBACK,
} from '../../utils/cloudinary.js';
import type { ImageOptimizeOptions } from '../../utils/cloudinary.js';
import { isLitePerfMode } from '../../utils/perfTier.js';

export interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  targetWidth?: number;
  optimizationOptions?: ImageOptimizeOptions;
  fallbackSrc?: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = React.memo(({
  src,
  alt,
  targetWidth = 800,
  optimizationOptions,
  fallbackSrc = OFFLINE_MOUNTAIN_SVG_FALLBACK,
  style,
  className,
  onLoad,
  onError,
  ...restProps
}) => {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [errorSrc, setErrorSrc] = useState<string | null>(null);

  const isLoaded = loadedSrc === src;
  const hasError = errorSrc === src;
  const lite = isLitePerfMode();
  const adaptiveWidth = lite ? Math.min(targetWidth, targetWidth > 900 ? 1080 : 600) : targetWidth;

  const optimizedSrc = getOptimizedImageUrl(src, {
    width: adaptiveWidth,
    quality: lite ? 'auto:eco' : 'auto',
    format: 'auto',
    ...optimizationOptions,
  });

  const finalSrc = hasError ? fallbackSrc : optimizedSrc;

  return (
    <img
      src={finalSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      style={{
        transition: 'opacity 0.28s ease',
        opacity: isLoaded ? 1 : 0.01,
        backgroundColor: 'var(--color-surface-elevated)',
        ...style,
      }}
      onLoad={(e) => {
        setLoadedSrc(src);
        if (onLoad) onLoad(e);
      }}
      onError={(e) => {
        setErrorSrc(src);
        if (onError) onError(e);
      }}
      {...restProps}
    />
  );
});
