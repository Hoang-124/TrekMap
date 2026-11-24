import React, { useEffect, useMemo, useRef, useState } from 'react';

interface SceneRevealProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  delayMs?: number;
  threshold?: number;
  rootMargin?: string;
}

const DEFAULT_THRESHOLD = 0.03;
const DEFAULT_ROOT_MARGIN = '0px 0px -32px 0px';

interface SharedObserverPoolEntry {
  observer: IntersectionObserver;
  callbacks: Map<Element, () => void>;
}

// Module-level shared IntersectionObserver pool keyed by `${threshold}|${rootMargin}`
// Eliminates per-instance observer allocation and immediately unobserves revealed elements.
const sharedObserverPool = new Map<string, SharedObserverPoolEntry>();

function getOrCreatePool(threshold: number, rootMargin: string): SharedObserverPoolEntry {
  const key = `${threshold}|${rootMargin}`;
  const existing = sharedObserverPool.get(key);
  if (existing) return existing;

  const callbacks = new Map<Element, () => void>();
  const observer = new IntersectionObserver(
    (entries) => {
      const viewportH = typeof window !== 'undefined' ? window.innerHeight : 0;
      for (const entry of entries) {
        if (entry.isIntersecting || entry.boundingClientRect.top < viewportH) {
          const onReveal = callbacks.get(entry.target);
          observer.unobserve(entry.target);
          callbacks.delete(entry.target);
          if (onReveal) onReveal();
        }
      }
      if (callbacks.size === 0) {
        observer.disconnect();
        sharedObserverPool.delete(key);
      }
    },
    { rootMargin, threshold }
  );

  const created: SharedObserverPoolEntry = { observer, callbacks };
  sharedObserverPool.set(key, created);
  return created;
}

function observeOnce(
  el: Element,
  onReveal: () => void,
  threshold: number,
  rootMargin: string
): () => void {
  const key = `${threshold}|${rootMargin}`;
  const pool = getOrCreatePool(threshold, rootMargin);
  pool.callbacks.set(el, onReveal);
  pool.observer.observe(el);

  return () => {
    pool.observer.unobserve(el);
    pool.callbacks.delete(el);
    if (pool.callbacks.size === 0) {
      pool.observer.disconnect();
      sharedObserverPool.delete(key);
    }
  };
}

/**
 * GPU-composited scroll-triggered cinematic reveal wrapper (runs once cleanly per mount).
 * Shares a pooled IntersectionObserver across all instances and immediately unobserves once visible.
 * Falls back immediately to visible when IntersectionObserver is unavailable.
 */
const SceneRevealBase: React.FC<SceneRevealProps> = ({
  children,
  id,
  className = '',
  style,
  delayMs = 0,
  threshold = DEFAULT_THRESHOLD,
  rootMargin = DEFAULT_ROOT_MARGIN,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState<boolean>(
    () => typeof window === 'undefined' || typeof IntersectionObserver === 'undefined'
  );

  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      return;
    }

    return observeOnce(el, () => setInView(true), threshold, rootMargin);
  }, [inView, threshold, rootMargin]);

  const mergedStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (delayMs > 0) {
      return { ...style, ['--reveal-delay' as string]: `${delayMs}ms` };
    }
    return style;
  }, [style, delayMs]);

  return (
    <div
      id={id}
      ref={ref}
      className={`scene-reveal${inView ? ' in-view' : ''}${className ? ` ${className}` : ''}`}
      style={mergedStyle}
    >
      {children}
    </div>
  );
};

export const SceneReveal = React.memo(SceneRevealBase);
