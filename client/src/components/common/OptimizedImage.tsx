import React, { useState } from 'react';
import { getOptimizedImageUrl } from '../../utils/cloudinary.js';
import type { ImageOptimizationOptions } from '../../utils/cloudinary.js';

export interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  targetWidth?: number;
  optimizationOptions?: ImageOptimizationOptions;
  fallbackSrc?: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  targetWidth = 800,
  optimizationOptions,
  fallbackSrc = 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80',
  style,
  className,
  onLoad,
  onError,
  ...restProps
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const optimizedSrc = getOptimizedImageUrl(src, {
    width: targetWidth,
    quality: 'auto',
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
        transition: 'opacity 0.3s ease, filter 0.3s ease',
        opacity: isLoaded ? 1 : 0.85,
        filter: isLoaded ? 'none' : 'blur(2px)',
        ...style,
      }}
      onLoad={(e) => {
        setIsLoaded(true);
        if (onLoad) onLoad(e);
      }}
      onError={(e) => {
        setHasError(true);
        if (onError) onError(e);
      }}
      {...restProps}
    />
  );
};
