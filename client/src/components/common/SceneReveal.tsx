import React, { useEffect, useRef, useState } from 'react';

interface SceneRevealProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  delayMs?: number;
}

/**
 * GPU-composited scroll-triggered cinematic reveal wrapper (runs once cleanly per mount).
 * Falls back immediately to visible when IntersectionObserver is unavailable.
 */
export const SceneReveal: React.FC<SceneRevealProps> = ({
  children,
  id,
  className = '',
  style,
  delayMs = 0,
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

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting || entry.boundingClientRect.top < window.innerHeight) {
            setInView(true);
            observer.disconnect();
            break;
          }
        }
      },
      {
        rootMargin: '0px 0px -32px 0px',
        threshold: 0.03,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);

  const mergedStyle: React.CSSProperties =
    delayMs > 0
      ? { ...style, ['--reveal-delay' as string]: `${delayMs}ms` }
      : { ...style };

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
