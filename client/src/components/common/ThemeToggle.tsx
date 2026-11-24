import React, { useEffect, useState } from 'react';
import { triggerSmoothThemeTransition } from '../../utils/themeTransition.js';

const resolveInitialTheme = (): 'dark' | 'light' => {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // ignore storage access errors
  }
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
};

export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(resolveInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    const handleExternalToggle = (event: Event) => {
      const detail = (event as CustomEvent<{ theme?: 'dark' | 'light' }>)?.detail;
      triggerSmoothThemeTransition();
      if (detail?.theme === 'light' || detail?.theme === 'dark') {
        setTheme(detail.theme);
      } else {
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
      }
    };
    window.addEventListener('lost:toggle-theme', handleExternalToggle);
    return () => window.removeEventListener('lost:toggle-theme', handleExternalToggle);
  }, []);

  const toggleTheme = () => {
    const next: 'dark' | 'light' = theme === 'dark' ? 'light' : 'dark';
    triggerSmoothThemeTransition();
    setTheme(next);
    window.dispatchEvent(new CustomEvent('lost:toggle-theme', { detail: { theme: next } }));
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-spin interactive-click"
      style={{
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
      }}
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
};
