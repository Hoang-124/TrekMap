import { useLayoutEffect, useRef, useState } from 'react';
import type React from 'react';

interface IndicatorRect {
  left: number;
  top: number;
  width: number;
  height: number;
  ready: boolean;
}

/**
 * Measures the active element (`[data-glider-active="true"]`) inside `trackRef`
 * and drives a GPU-accelerated gliding highlight frame (matching the Hero peak glider).
 * Destructure `{ trackRef, indicatorStyle }` at the call site for 100% React 19 Compiler safety.
 */
export function useSlidingIndicator<K extends string | number>(activeKey: K) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<IndicatorRect>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false,
  });

  useLayoutEffect(() => {
    const measure = () => {
      const containerEl = trackRef.current;
      if (!containerEl) {
        setRect((prev) => (prev.ready ? { ...prev, ready: false } : prev));
        return;
      }
      const activeEl = containerEl.querySelector<HTMLElement>('[data-glider-active="true"]');
      if (!activeEl) {
        setRect((prev) => (prev.ready ? { ...prev, ready: false } : prev));
        return;
      }
      const cRect = containerEl.getBoundingClientRect();
      const eRect = activeEl.getBoundingClientRect();
      const nextLeft = Math.round(eRect.left - cRect.left + containerEl.scrollLeft);
      const nextTop = Math.round(eRect.top - cRect.top + containerEl.scrollTop);
      const nextWidth = Math.round(eRect.width);
      const nextHeight = Math.round(eRect.height);
      setRect((prev) => {
        if (
          prev.ready &&
          prev.left === nextLeft &&
          prev.top === nextTop &&
          prev.width === nextWidth &&
          prev.height === nextHeight
        ) {
          return prev;
        }
        return {
          left: nextLeft,
          top: nextTop,
          width: nextWidth,
          height: nextHeight,
          ready: true,
        };
      });
    };

    measure();
    const rafId = window.requestAnimationFrame(measure);
    const containerEl = trackRef.current;
    let observer: ResizeObserver | null = null;
    if (containerEl && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(containerEl);
    }
    window.addEventListener('resize', measure, { passive: true });
    return () => {
      window.cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [activeKey]);

  const indicatorStyle: React.CSSProperties = {
    transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`,
    width: rect.width,
    height: rect.height,
    opacity: rect.ready ? 1 : 0,
  };

  return {
    trackRef,
    indicatorStyle,
    ready: rect.ready,
  };
}
