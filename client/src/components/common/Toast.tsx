import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IconCheckCircle,
  IconAlertTriangle,
  IconCompass,
  IconShieldAlert,
  IconX,
} from './SvgIcons.js';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  isOpen: boolean;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  isOpen,
  onClose,
  duration = 3800,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const remainingRef = useRef(duration);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Trigger smooth exit bounce transition before unmounting
  const triggerClose = useCallback(() => {
    if (exitTimerRef.current) return;
    setIsExiting(true);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    exitTimerRef.current = setTimeout(() => {
      setIsMounted(false);
      setIsExiting(false);
      exitTimerRef.current = null;
      onCloseRef.current();
    }, 260); // 260ms matches @keyframes toastSpringOut 0.28s
  }, []);

  // Handle open / message change
  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      setIsExiting(false);
      setIsHovered(false);
      remainingRef.current = duration;
      startTimeRef.current = Date.now();

      if (timerRef.current) clearTimeout(timerRef.current);
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }

      timerRef.current = setTimeout(() => {
        triggerClose();
      }, duration);
    } else {
      setIsMounted(false);
      setIsExiting(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [isOpen, message, duration, triggerClose]);

  // Pause on hover
  const handleMouseEnter = () => {
    setIsHovered(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const elapsed = Date.now() - startTimeRef.current;
      remainingRef.current = Math.max(600, remainingRef.current - elapsed);
    }
  };

  // Resume on leave
  const handleMouseLeave = () => {
    setIsHovered(false);
    startTimeRef.current = Date.now();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!exitTimerRef.current) {
      timerRef.current = setTimeout(() => {
        triggerClose();
      }, remainingRef.current || 1000);
    }
  };

  if (!isMounted && !isOpen) return null;

  // Type configuration with design tokens & pure SVG icons
  const typeConfig = {
    success: {
      accentColor: 'var(--color-primary)',
      bgGlow: 'rgba(74, 222, 128, 0.15)',
      borderColor: 'rgba(74, 222, 128, 0.4)',
      shadowGlow: 'rgba(74, 222, 128, 0.25)',
      title: 'Thành Công',
      icon: <IconCheckCircle size={20} color="var(--color-primary)" />,
    },
    error: {
      accentColor: 'var(--color-error)',
      bgGlow: 'rgba(239, 68, 68, 0.15)',
      borderColor: 'rgba(239, 68, 68, 0.4)',
      shadowGlow: 'rgba(239, 68, 68, 0.28)',
      title: 'Thông Báo Lỗi',
      icon: <IconAlertTriangle size={20} color="var(--color-error)" />,
    },
    info: {
      accentColor: 'var(--color-sky)',
      bgGlow: 'rgba(56, 189, 248, 0.15)',
      borderColor: 'rgba(56, 189, 248, 0.4)',
      shadowGlow: 'rgba(56, 189, 248, 0.25)',
      title: 'Thông Tin',
      icon: <IconCompass size={20} color="var(--color-sky)" />,
    },
    warning: {
      accentColor: 'var(--color-earth)',
      bgGlow: 'rgba(249, 115, 22, 0.15)',
      borderColor: 'rgba(249, 115, 22, 0.4)',
      shadowGlow: 'rgba(249, 115, 22, 0.25)',
      title: 'Cảnh Báo',
      icon: <IconShieldAlert size={20} color="var(--color-earth)" />,
    },
  }[type] || {
    accentColor: 'var(--color-primary)',
    bgGlow: 'rgba(74, 222, 128, 0.15)',
    borderColor: 'rgba(74, 222, 128, 0.4)',
    shadowGlow: 'rgba(74, 222, 128, 0.25)',
    title: 'Thông Báo',
    icon: <IconCheckCircle size={20} color="var(--color-primary)" />,
  };

  return (
    <aside
      aria-live="polite"
      aria-atomic="true"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`toast-card-responsive ${isExiting ? 'toast-spring-out' : 'toast-spring-in'}`}
      style={{
        position: 'fixed',
        top: 74, // Sát ngay dưới sticky header (chiều cao header ~64px + 10px buffer tinh tế)
        right: 24,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: 'var(--color-bg-glass)',
        border: '1px solid var(--color-border)',
        borderLeft: `4px solid ${typeConfig.accentColor}`,
        borderRadius: 'var(--radius-lg, 14px)',
        padding: '12px 16px 14px 14px',
        color: 'var(--color-text-main)',
        boxShadow: `var(--shadow-card), 0 12px 32px rgba(0, 0, 0, 0.35), 0 0 24px ${typeConfig.shadowGlow}`,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        maxWidth: 440,
        minWidth: 300,
        overflow: 'hidden',
        cursor: 'default',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* Type SVG Icon Container */}
      <div
        className="toast-icon-pop"
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: typeConfig.bgGlow,
          border: `1px solid ${typeConfig.borderColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {typeConfig.icon}
      </div>

      {/* Message and Title */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: typeConfig.accentColor,
            marginBottom: 2,
          }}
        >
          {typeConfig.title}
        </div>
        <div
          style={{
            fontSize: 'var(--font-size-sm, 0.875rem)',
            fontWeight: 600,
            lineHeight: 1.45,
            color: 'var(--color-text-main)',
            wordBreak: 'break-word',
          }}
        >
          {message}
        </div>
      </div>

      {/* Interactive Close Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          triggerClose();
        }}
        aria-label="Đóng thông báo"
        title="Đóng thông báo"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-dim)',
          padding: 6,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          position: 'relative',
          zIndex: 10,
          transition: 'all 0.18s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-text-main)';
          e.currentTarget.style.background = 'var(--color-border)';
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-dim)';
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <IconX size={16} color="currentColor" />
      </button>

      {/* Live Animated Countdown Progress Bar at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 3,
          background: typeConfig.accentColor,
          animation: `toastProgressCountdown ${duration}ms linear forwards`,
          animationPlayState: isHovered ? 'paused' : 'running',
          borderRadius: '0 0 var(--radius-lg, 14px) var(--radius-lg, 14px)',
        }}
      />
    </aside>
  );
};
