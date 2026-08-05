import React, { useEffect } from 'react';
import { CheckCircle2, ShieldAlert, Info } from 'lucide-react';

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
  let textColor = '#00ffd5';
  let IconComponent = CheckCircle2;

  if (type === 'error') {
    borderColor = '#ef4444';
    glowColor = 'rgba(239, 68, 68, 0.4)';
    textColor = '#f87171';
    IconComponent = ShieldAlert;
  } else if (type === 'info') {
    borderColor = '#38bdf8';
    glowColor = 'rgba(56, 189, 248, 0.4)';
    textColor = '#38bdf8';
    IconComponent = Info;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 24,
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
      <div style={{
        padding: 8,
        borderRadius: 12,
        background: `rgba(${type === 'error' ? '239, 68, 68' : type === 'info' ? '56, 189, 248' : '74, 222, 128'}, 0.12)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <IconComponent size={20} color={textColor} />
      </div>
      <div style={{ fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.4, color: 'var(--color-text-main)' }}>
        {message}
      </div>
    </div>
  );
};
