import React, { useCallback, useMemo, useState } from 'react';
import {
  getOptimizedImageUrl,
  OFFLINE_MOUNTAIN_SVG_FALLBACK,
} from '../../utils/cloudinary.js';
import type { ImageOptimizeOptions } from '../../utils/cloudinary.js';
import { isLitePerfMode } from '../../utils/perfTier.js';

const MAX_LOADED_URL_CACHE = 250;
const loadedImageUrls = new Set<string>();

function markImageLoaded(url: string): void {
  if (!url || loadedImageUrls.has(url)) return;
  if (loadedImageUrls.size >= MAX_LOADED_URL_CACHE) {
    const oldest = loadedImageUrls.values().next().value;
    if (oldest !== undefined) {
      loadedImageUrls.delete(oldest);
    }
  }
  loadedImageUrls.add(url);
}

export interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  targetWidth?: number;
  optimizationOptions?: ImageOptimizeOptions;
  fallbackSrc?: string;
  /** Marks above-the-fold / LCP hero images for eager high-priority loading without opacity fade delay */
  priority?: boolean;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = React.memo(({
  src,
  alt,
  targetWidth = 800,
  optimizationOptions,
  fallbackSrc = OFFLINE_MOUNTAIN_SVG_FALLBACK,
  priority = false,
  loading,
  decoding,
  fetchPriority,
  style,
  className,
  onLoad,
  onError,
  ...restProps
}) => {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [errorSrc, setErrorSrc] = useState<string | null>(null);

  const hasError = errorSrc === src;
  const lite = isLitePerfMode();

  const optWidth = optimizationOptions?.width;
  const optHeight = optimizationOptions?.height;
  const optQuality = optimizationOptions?.quality;
  const optFormat = optimizationOptions?.format;
  const optCrop = optimizationOptions?.crop;

  const optimizedSrc = useMemo(() => {
    const isCompactViewport =
      typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth <= 640;
    const widthCap = lite
      ? targetWidth > 900
        ? 960
        : 560
      : isCompactViewport
        ? 760
        : 1440;
    const adaptiveWidth = Math.min(targetWidth, widthCap);

    return getOptimizedImageUrl(src, {
      width: optWidth ?? adaptiveWidth,
      ...(optHeight !== undefined ? { height: optHeight } : {}),
      quality: optQuality ?? (lite ? 'auto:eco' : 'auto'),
      format: optFormat ?? 'auto',
      ...(optCrop !== undefined ? { crop: optCrop } : {}),
    });
  }, [src, targetWidth, lite, optWidth, optHeight, optQuality, optFormat, optCrop]);

  const finalSrc = hasError ? fallbackSrc : optimizedSrc;
  const isDataUri = finalSrc.startsWith('data:');
  const isAlreadyCached = isDataUri || loadedImageUrls.has(finalSrc);
  const isVisible = priority || hasError || isAlreadyCached || loadedSrc === finalSrc;

  const resolvedLoading = loading ?? (priority ? 'eager' : 'lazy');
  const resolvedDecoding = decoding ?? 'async';
  const resolvedFetchPriority = fetchPriority ?? (priority ? 'high' : undefined);

  const handleImgRef = useCallback(
    (node: HTMLImageElement | null) => {
      if (!node) return;
      if (node.complete && node.naturalWidth > 0) {
        markImageLoaded(finalSrc);
        if (node.style.opacity !== '1') {
          node.style.opacity = '1';
        }
      }
    },
    [finalSrc]
  );

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const alreadyRecorded = loadedImageUrls.has(finalSrc);
      markImageLoaded(finalSrc);
      if (!priority && !alreadyRecorded && loadedSrc !== finalSrc) {
        setLoadedSrc(finalSrc);
      }
      if (onLoad) onLoad(e);
    },
    [finalSrc, priority, loadedSrc, onLoad]
  );

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (errorSrc !== src) {
        setErrorSrc(src);
      }
      if (onError) onError(e);
    },
    [errorSrc, src, onError]
  );

  return (
    <img
      ref={handleImgRef}
      src={finalSrc}
      alt={alt}
      loading={resolvedLoading}
      decoding={resolvedDecoding}
      fetchPriority={resolvedFetchPriority}
      className={className}
      style={{
        transition: isAlreadyCached || priority || lite ? undefined : 'opacity 0.22s ease',
        opacity: isVisible ? 1 : 0.01,
        backgroundColor: 'var(--color-surface-elevated)',
        ...style,
      }}
      onLoad={handleLoad}
      onError={handleError}
      {...restProps}
    />
  );
});
