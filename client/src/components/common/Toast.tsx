import React, { useEffect } from 'react';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  isOpen: boolean;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  isOpen,
  onClose,
  duration = 3000,
}) => {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  let borderColor = '#00ffd5';
  let glowColor = 'rgba(0, 255, 213, 0.35)';

  if (type === 'error') {
    borderColor = '#ef4444';
    glowColor = 'rgba(239, 68, 68, 0.4)';
  } else if (type === 'info') {
    borderColor = '#38bdf8';
    glowColor = 'rgba(56, 189, 248, 0.4)';
  }

  return (
    <div style={{
      position: 'fixed',
      top: 104,
      right: 24,
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      background: 'var(--color-bg-card)',
      border: `1px solid ${borderColor}`,
      borderRadius: 20,
      padding: '14px 22px',
      color: 'var(--color-text-main)',
      boxShadow: `var(--shadow-card), 0 0 24px ${glowColor}`,
      backdropFilter: 'blur(24px)',
      animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      maxWidth: 420,
    }}>
      <div style={{ fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.4, color: 'var(--color-text-main)' }}>
        {message}
      </div>
    </div>
  );
};
