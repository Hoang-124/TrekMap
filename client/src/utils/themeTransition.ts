let themeTransitionTimer: number | null = null;

/**
 * Briefly enables smooth Dark <-> Light surface cross-fade on <html>
 * without leaving permanent transition overhead on everyday hover/scroll.
 */
export function triggerSmoothThemeTransition(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.add('theme-transitioning');
  if (themeTransitionTimer !== null) {
    window.clearTimeout(themeTransitionTimer);
  }
  themeTransitionTimer = window.setTimeout(() => {
    root.classList.remove('theme-transitioning');
    themeTransitionTimer = null;
  }, 300);
}
