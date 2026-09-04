import React, { useState } from 'react';
import { IconBot, IconSparkles } from '../common/SvgIcons.js';

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

  // Position nicely: bottom 28px when scroll-to-top is hidden, bottom 84px when scroll-to-top is shown
  const bottomPosition = hasScrollTop ? 84 : 28;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: bottomPosition,
        right: 28,
        zIndex: 9990,
        transition: 'bottom 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={isOpen ? 'Đóng cửa sổ Hỏi đáp AI' : 'Mở trợ lý Hỏi đáp AI (Tư vấn cung đường, thời tiết & sinh tồn)'}
        aria-label="Mở trợ lý Hỏi đáp AI"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 16px 8px 10px',
          background: isHovered
            ? 'linear-gradient(135deg, rgba(20, 32, 60, 0.98) 0%, rgba(12, 20, 42, 0.98) 100%)'
            : 'linear-gradient(135deg, rgba(14, 23, 44, 0.94) 0%, rgba(8, 14, 28, 0.96) 100%)',
          border: isHovered
            ? '1px solid rgba(74, 222, 128, 0.55)'
            : '1px solid rgba(74, 222, 128, 0.28)',
          borderRadius: 9999,
          color: 'var(--color-text-main)',
          cursor: 'pointer',
          boxShadow: isHovered
            ? '0 12px 32px rgba(0, 0, 0, 0.65), 0 0 20px rgba(74, 222, 128, 0.35)'
            : '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 12px rgba(74, 222, 128, 0.15)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: isHovered ? 'translateY(-2px) scale(1.02)' : 'translateY(0) scale(1)',
          userSelect: 'none',
        }}
      >
        {/* Modern Bot Icon Avatar with Live Pulse Indicator */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.18) 0%, rgba(56, 189, 248, 0.12) 100%)',
            border: '1px solid rgba(74, 222, 128, 0.35)',
            color: 'var(--color-primary)',
            flexShrink: 0,
          }}
        >
          <IconBot size={17} color="var(--color-primary)" />
          {/* Subtle Live Beacon Dot */}
          <span
            style={{
              position: 'absolute',
              bottom: -1,
              right: -1,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#22c55e',
              border: '1.5px solid #0b1326',
              boxShadow: '0 0 6px #22c55e',
            }}
          />
        </div>

        {/* Text Label: Hỏi đáp AI */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: '0.86rem',
              letterSpacing: '-0.01em',
              color: 'var(--color-text-main)',
              whiteSpace: 'nowrap',
            }}
          >
            Hỏi đáp AI
          </span>
          <IconSparkles
            size={14}
            color={isHovered ? 'var(--color-primary)' : 'rgba(74, 222, 128, 0.75)'}
            style={{
              transition: 'transform 0.25s ease, color 0.25s ease',
              transform: isHovered ? 'rotate(15deg) scale(1.15)' : 'none',
            }}
          />
        </div>

        {/* Unread Counter Badge (if any) */}
        {unreadCount > 0 && !isOpen && (
          <span
            style={{
              background: 'var(--color-error)',
              color: '#ffffff',
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: 9999,
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
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

