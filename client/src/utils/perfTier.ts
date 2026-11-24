export type PerfTier = 'full' | 'lite';

let cachedTier: PerfTier | null = null;

interface NavigatorPerfHints extends Navigator {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
}

/**
 * Automatically detects lower-powered laptops, budget phones, or Data-Saver networks
 * and applies `data-perf="lite"` on <html> to disable costly backdrop-filter & grain fills
 * while preserving silky GPU transform/opacity transitions.
 */
export function detectPerfTier(): PerfTier {
  if (cachedTier) return cachedTier;
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    cachedTier = 'full';
    return cachedTier;
  }

  const nav = navigator as NavigatorPerfHints;
  const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
  const lowCores = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4;
  const saveData = Boolean(nav.connection?.saveData);
  const slowNet =
    nav.connection?.effectiveType === 'slow-2g' ||
    nav.connection?.effectiveType === '2g' ||
    nav.connection?.effectiveType === '3g';

  cachedTier = lowMemory || lowCores || saveData || slowNet ? 'lite' : 'full';
  return cachedTier;
}

export function isLitePerfMode(): boolean {
  return detectPerfTier() === 'lite';
}

export function initPerfTierAttribute(): PerfTier {
  const tier = detectPerfTier();
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-perf', tier);
  }
  return tier;
}
