import React from 'react';
import { IconBot, IconSparkles } from '../common/SvgIcons.js';

interface TrekAssistantFabProps {
  isOpen: boolean;
  onToggle: () => void;
  unreadCount?: number;
}

export const TrekAssistantFab: React.FC<TrekAssistantFabProps> = ({
  isOpen,
  onToggle,
  unreadCount = 0,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 84,
        right: 28,
        zIndex: 9990,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        title={isOpen ? 'Thu nhỏ Trợ lý ảo TrekCopilot AI' : 'Mở Trợ lý ảo TrekCopilot AI (Hỏi đáp, Cứu hộ & Sinh tồn)'}
        aria-label="TrekCopilot AI Virtual Assistant"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: isOpen ? '10px 16px' : '10px 20px',
          background: 'linear-gradient(135deg, rgba(15, 24, 46, 0.95) 0%, rgba(7, 13, 30, 0.98) 100%)',
          border: '1.5px solid var(--color-primary)',
          borderRadius: 30,
          color: 'var(--color-text-main)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(74, 222, 128, 0.35)',
          backdropFilter: 'blur(16px)',
          transition: 'all 0.3s var(--ease-out-expo)',
          transform: isOpen ? 'scale(0.95)' : 'scale(1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)';
          e.currentTarget.style.boxShadow = '0 12px 36px rgba(0, 0, 0, 0.7), 0 0 28px rgba(74, 222, 128, 0.6)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = isOpen ? 'scale(0.95)' : 'scale(1)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(74, 222, 128, 0.35)';
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'rgba(74, 222, 128, 0.15)',
            border: '1px solid var(--color-primary)',
            color: 'var(--color-primary)',
          }}
        >
          <IconBot size={18} color="var(--color-primary)" />
          {/* Pulsing online green dot */}
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 8px #22c55e',
            }}
          />
        </div>

        <span style={{ display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.02em' }}>
          TrekCopilot AI
          <IconSparkles size={14} color="var(--color-primary)" />
        </span>

        {unreadCount > 0 && !isOpen && (
          <span
            style={{
              background: 'var(--color-error)',
              color: '#ffffff',
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: 12,
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};
