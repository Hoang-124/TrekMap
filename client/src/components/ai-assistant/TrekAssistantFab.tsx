import React, { useState } from 'react';
import { IconBot } from '../common/SvgIcons.js';

interface TrekAssistantFabProps {
  isOpen: boolean;
  onToggle: () => void;
  unreadCount?: number;
  hasScrollTop?: boolean;
}

export const TrekAssistantFab: React.FC<TrekAssistantFabProps> = ({
  isOpen,
  onToggle,
  unreadCount = 0,
  hasScrollTop = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const bottomPosition = hasScrollTop ? 82 : 24;

  // Global Alt+A toggle is owned atomically by App.tsx so it can both open and close LOST AI.

  return (
    <div
      className="fab-pop-in"
      style={{
        position: 'fixed',
        bottom: bottomPosition,
        right: 20,
        zIndex: 'var(--z-dropdown, 1100)',
        transition: 'bottom 0.26s var(--ease-out-expo)',
      }}
    >
      <button
        type="button"
        className="interactive-click"
        onClick={onToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={isOpen ? 'Đóng LOST AI (Alt+A)' : 'Mở trợ lý LOST AI (Alt+A)'}
        aria-label={isOpen ? 'Đóng trợ lý LOST AI' : 'Mở trợ lý LOST AI'}
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 14px 9px 12px',
          background: 'var(--color-bg-card)',
          border: `1px solid ${isHovered ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
          borderRadius: 6,
          color: 'var(--color-text-main)',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-3d)',
          transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'transform 0.18s ease, border-color 0.18s ease',
          userSelect: 'none',
          fontFamily: 'var(--font-family)',
        }}
      >
        <IconBot size={17} color="var(--color-primary)" />
        <span style={{ fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
          Trợ lý LOST
        </span>
        {unreadCount > 0 && !isOpen && (
          <span
            style={{
              background: 'var(--color-error)',
              color: 'var(--color-on-danger)',
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 9999,
              lineHeight: 1,
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};
