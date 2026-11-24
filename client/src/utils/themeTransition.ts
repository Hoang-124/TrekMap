export type ThemeMode = 'dark' | 'light';

/**
 * Synchronously updates `<html data-theme>`, native `color-scheme`, and
 * `localStorage` in a single frame (<16ms) with zero layout or transition stall.
 */
export function applyDocumentTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (root.getAttribute('data-theme') !== theme) {
    root.setAttribute('data-theme', theme);
  }
  if (root.style.colorScheme !== theme) {
    root.style.colorScheme = theme;
  }
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', theme);
    }
  } catch {
    // Ignore storage access errors (private mode / quota)
  }
}

/**
 * Backwards-compatible hook for callers (e.g. Alt+T keyboard shortcut in App.tsx).
 *
 * Theme switching is intentionally instantaneous (1 single paint frame) with
 * NO universal `*` CSS transition, NO `box-shadow` transition, and NO full-viewport
 * ViewTransition screenshot stall across dense DOM trees and Leaflet map tiles.
 * Visual transition polish lives on the ThemeToggle SVG icon (`.theme-icon-enter`).
 */
export function triggerSmoothThemeTransition(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (root.classList.contains('theme-transitioning')) {
    root.classList.remove('theme-transitioning');
  }
}
