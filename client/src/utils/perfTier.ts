export type PerfTier = 'full' | 'lite';

let cachedTier: PerfTier | null = null;
let connectionListenerBound = false;

interface NetworkConnectionHints {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: 'change', listener: () => void) => void;
}

interface NavigatorPerfHints extends Navigator {
  deviceMemory?: number;
  connection?: NetworkConnectionHints;
}

function evaluatePerfTier(): PerfTier {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'full';
  }

  try {
    const nav = navigator as NavigatorPerfHints;
    const deviceMemory = nav.deviceMemory;
    const hardwareConcurrency = nav.hardwareConcurrency;
    const conn = nav.connection;

    const lowMemory =
      typeof deviceMemory === 'number' && deviceMemory > 0 && deviceMemory <= 4;
    const lowCores =
      typeof hardwareConcurrency === 'number' &&
      hardwareConcurrency > 0 &&
      hardwareConcurrency <= 4;
    const saveData = Boolean(conn?.saveData);
    const effectiveType = conn?.effectiveType;
    const slowNet =
      effectiveType === 'slow-2g' ||
      effectiveType === '2g' ||
      effectiveType === '3g';

    return lowMemory || lowCores || saveData || slowNet ? 'lite' : 'full';
  } catch {
    return 'full';
  }
}

function syncPerfAttribute(tier: PerfTier): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (root.getAttribute('data-perf') !== tier) {
    root.setAttribute('data-perf', tier);
  }
}

/**
 * Automatically detects lower-powered laptops, budget phones, or Data-Saver / 2G-3G networks
 * and applies `data-perf="lite"` on <html> to disable costly backdrop-filter & grain fills
 * while preserving silky GPU transform/opacity transitions.
 */
export function detectPerfTier(): PerfTier {
  if (cachedTier) return cachedTier;
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'full';
  }

  cachedTier = evaluatePerfTier();
  return cachedTier;
}

export function isLitePerfMode(): boolean {
  return detectPerfTier() === 'lite';
}

export function initPerfTierAttribute(): PerfTier {
  const tier = detectPerfTier();
  syncPerfAttribute(tier);

  if (
    !connectionListenerBound &&
    typeof navigator !== 'undefined'
  ) {
    try {
      const conn = (navigator as NavigatorPerfHints).connection;
      if (conn && typeof conn.addEventListener === 'function') {
        connectionListenerBound = true;
        conn.addEventListener('change', () => {
          const nextTier = evaluatePerfTier();
          if (nextTier !== cachedTier) {
            cachedTier = nextTier;
            syncPerfAttribute(nextTier);
          }
        });
      }
    } catch {
      // Ignore restricted Navigator.connection implementations
    }
  }

  return tier;
}
