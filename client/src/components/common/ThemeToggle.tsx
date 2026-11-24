import React, { memo, useEffect, useId, useRef, useState } from 'react';
import { applyDocumentTheme, type ThemeMode } from '../../utils/themeTransition.js';

interface ThemeToggleEventDetail {
  theme?: ThemeMode;
  sourceId?: string;
}

const resolveInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = window.localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Ignore storage access errors
  }
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
};

interface ThemeToggleProps {
  compact?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = memo(({ compact = false }) => {
  const instanceId = useId();
  const [theme, setTheme] = useState<ThemeMode>(resolveInitialTheme);
  const themeRef = useRef<ThemeMode>(theme);

  // Ensure initial mount aligns `data-theme` and `color-scheme` (no-op if already aligned)
  useEffect(() => {
    themeRef.current = theme;
    applyDocumentTheme(theme);
  }, [theme]);

  useEffect(() => {
    const handleExternalToggle = (event: Event) => {
      const detail = (event as CustomEvent<ThemeToggleEventDetail>)?.detail;
      // Ignore self-dispatched events to prevent double-toggle feedback loops
      if (detail?.sourceId && detail.sourceId === instanceId) {
        return;
      }

      const next: ThemeMode =
        detail?.theme === 'light' || detail?.theme === 'dark'
          ? detail.theme
          : themeRef.current === 'dark'
            ? 'light'
            : 'dark';

      applyDocumentTheme(next);
      themeRef.current = next;
      setTheme((prev) => (prev === next ? prev : next));
    };

    window.addEventListener('lost:toggle-theme', handleExternalToggle);
    return () => window.removeEventListener('lost:toggle-theme', handleExternalToggle);
  }, [instanceId]);

  const toggleTheme = () => {
    const next: ThemeMode = themeRef.current === 'dark' ? 'light' : 'dark';
    // Flip DOM attribute + color-scheme synchronously in 1 frame before React commits
    applyDocumentTheme(next);
    themeRef.current = next;
    setTheme(next);
    window.dispatchEvent(
      new CustomEvent<ThemeToggleEventDetail>('lost:toggle-theme', {
        detail: { theme: next, sourceId: instanceId },
      })
    );
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={compact ? 'admin-icon-btn theme-spin' : 'theme-spin interactive-click'}
      style={
        compact
          ? undefined
          : {
              width: 36,
              height: 36,
              borderRadius: 4,
              background: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              color: 'var(--color-primary)',
              boxShadow: 'var(--shadow-card)',
              flexShrink: 0,
            }
      }
      title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
      aria-label={theme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
      aria-pressed={theme === 'light'}
    >
      {theme === 'dark' ? (
        <svg
          key="moon"
          className="theme-icon-enter"
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg
          key="sun"
          className="theme-icon-enter"
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}
    </button>
  );
});

ThemeToggle.displayName = 'ThemeToggle';
