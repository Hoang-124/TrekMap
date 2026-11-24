import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';

interface IndicatorRect {
  left: number;
  top: number;
  width: number;
  height: number;
  ready: boolean;
}

const INITIAL_RECT: IndicatorRect = {
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  ready: false,
};

// Shared module-level rAF batcher so all sliding indicator bars measure in ONE layout pass per frame
const pendingMeasures = new Set<() => void>();
let batchRafId = 0;

function scheduleBatchedMeasure(fn: () => void): void {
  pendingMeasures.add(fn);
  if (batchRafId || typeof window === 'undefined') return;
  batchRafId = window.requestAnimationFrame(() => {
    batchRafId = 0;
    const tasks = Array.from(pendingMeasures);
    pendingMeasures.clear();
    for (const task of tasks) {
      task();
    }
  });
}

function cancelBatchedMeasure(fn: () => void): void {
  pendingMeasures.delete(fn);
  if (pendingMeasures.size === 0 && batchRafId && typeof window !== 'undefined') {
    window.cancelAnimationFrame(batchRafId);
    batchRafId = 0;
  }
}

// Single shared debounced window resize dispatcher across all mounted sliding bars
const resizeSubscribers = new Set<() => void>();
let resizeDebounceTimer = 0;
let isWindowResizeBound = false;

function handleSharedWindowResize(): void {
  if (resizeDebounceTimer) window.clearTimeout(resizeDebounceTimer);
  resizeDebounceTimer = window.setTimeout(() => {
    resizeDebounceTimer = 0;
    for (const cb of resizeSubscribers) {
      scheduleBatchedMeasure(cb);
    }
  }, 64);
}

function subscribeWindowResize(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  resizeSubscribers.add(cb);
  if (!isWindowResizeBound) {
    isWindowResizeBound = true;
    window.addEventListener('resize', handleSharedWindowResize, { passive: true });
  }
  return () => {
    resizeSubscribers.delete(cb);
    if (resizeSubscribers.size === 0 && isWindowResizeBound) {
      isWindowResizeBound = false;
      window.removeEventListener('resize', handleSharedWindowResize);
      if (resizeDebounceTimer) {
        window.clearTimeout(resizeDebounceTimer);
        resizeDebounceTimer = 0;
      }
    }
  };
}

function readRelativeGeometry(
  containerEl: HTMLElement,
  activeEl: HTMLElement
): { left: number; top: number; width: number; height: number } {
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = activeEl;
  let reachedContainer = false;

  // Walk offsetParent chain to read cheap offsetLeft/offsetTop without transform distortion
  while (node && node !== containerEl) {
    left += node.offsetLeft;
    top += node.offsetTop;
    const parent = node.offsetParent as HTMLElement | null;
    if (parent === containerEl) {
      reachedContainer = true;
      break;
    }
    node = parent;
  }

  if (reachedContainer) {
    return {
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(activeEl.offsetWidth),
      height: Math.round(activeEl.offsetHeight),
    };
  }

  // Fallback when containerEl is not an offsetParent ancestor
  const cRect = containerEl.getBoundingClientRect();
  const eRect = activeEl.getBoundingClientRect();
  return {
    left: Math.round(eRect.left - cRect.left + containerEl.scrollLeft),
    top: Math.round(eRect.top - cRect.top + containerEl.scrollTop),
    width: Math.round(eRect.width),
    height: Math.round(eRect.height),
  };
}

/**
 * Measures the active element (`[data-glider-active="true"]`) inside `trackRef`
 * and drives a GPU-accelerated gliding highlight frame (matching the Hero peak glider).
 * All DOM geometry reads are batched into a single shared rAF pass and debounced on resize.
 * Destructure `{ trackRef, indicatorStyle }` at the call site for 100% React 19 Compiler safety.
 */
export function useSlidingIndicator<K extends string | number>(activeKey: K) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const lastRectRef = useRef<IndicatorRect>(INITIAL_RECT);
  const [rect, setRect] = useState<IndicatorRect>(INITIAL_RECT);

  useLayoutEffect(() => {
    let mounted = true;
    let roDebounceTimer = 0;

    const measure = () => {
      if (!mounted) return;
      const containerEl = trackRef.current;
      if (!containerEl) {
        if (lastRectRef.current.ready) {
          const next = { ...lastRectRef.current, ready: false };
          lastRectRef.current = next;
          setRect(next);
        }
        return;
      }

      const activeEl = containerEl.querySelector<HTMLElement>('[data-glider-active="true"]');
      if (!activeEl) {
        if (lastRectRef.current.ready) {
          const next = { ...lastRectRef.current, ready: false };
          lastRectRef.current = next;
          setRect(next);
        }
        return;
      }

      const { left, top, width, height } = readRelativeGeometry(containerEl, activeEl);
      const prev = lastRectRef.current;
      if (
        prev.ready &&
        prev.left === left &&
        prev.top === top &&
        prev.width === width &&
        prev.height === height
      ) {
        return;
      }

      const next: IndicatorRect = { left, top, width, height, ready: true };
      lastRectRef.current = next;
      setRect(next);
    };

    scheduleBatchedMeasure(measure);

    const containerEl = trackRef.current;
    let observer: ResizeObserver | null = null;
    if (containerEl && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        if (roDebounceTimer) window.clearTimeout(roDebounceTimer);
        roDebounceTimer = window.setTimeout(() => {
          roDebounceTimer = 0;
          scheduleBatchedMeasure(measure);
        }, 64);
      });
      observer.observe(containerEl);
    }

    const unsubscribeResize = subscribeWindowResize(measure);

    return () => {
      mounted = false;
      cancelBatchedMeasure(measure);
      if (roDebounceTimer) window.clearTimeout(roDebounceTimer);
      observer?.disconnect();
      unsubscribeResize();
    };
  }, [activeKey]);

  const indicatorStyle = useMemo<React.CSSProperties>(
    () => ({
      transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`,
      width: rect.width,
      height: rect.height,
      opacity: rect.ready ? 1 : 0,
    }),
    [rect.left, rect.top, rect.width, rect.height, rect.ready]
  );

  return {
    trackRef,
    indicatorStyle,
    ready: rect.ready,
  };
}
