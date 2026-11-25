import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  toastId?: number | string;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  isOpen,
  onClose,
  duration = 3800,
  toastId = 0,
}) => {
  const toastKey = isOpen ? `${toastId}::${message}::${type}` : '';
  const [exitingKey, setExitingKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const isExiting = Boolean(toastKey && exitingKey === toastKey);
  const isHovered = Boolean(toastKey && hoveredKey === toastKey);

  const remainingRef = useRef(duration);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Trigger smooth exit bounce transition before unmounting
  const triggerClose = useCallback(() => {
    if (exitTimerRef.current) return;
    setExitingKey(toastKey || null);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    exitTimerRef.current = setTimeout(() => {
      setExitingKey(null);
      setHoveredKey(null);
      exitTimerRef.current = null;
      onCloseRef.current();
    }, 260); // 260ms matches @keyframes toastSpringOut 0.28s
  }, [toastKey]);

  // Handle open / message change
  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen, message, type, toastId, duration, triggerClose]);

  // Pause on hover
  const handleMouseEnter = () => {
    setHoveredKey(toastKey || null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const elapsed = Date.now() - startTimeRef.current;
      remainingRef.current = Math.max(600, remainingRef.current - elapsed);
    }
  };

  // Resume on leave
  const handleMouseLeave = () => {
    setHoveredKey(null);
    startTimeRef.current = Date.now();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!exitTimerRef.current) {
      timerRef.current = setTimeout(() => {
        triggerClose();
      }, remainingRef.current || 1000);
    }
  };

  if (!isOpen) return null;

  // Type configuration with design tokens & pure SVG icons
  const typeConfig = {
    success: {
      accentColor: 'var(--color-primary)',
      textColor: 'var(--color-primary)',
      bgTint: 'color-mix(in srgb, var(--color-primary) 13%, transparent)',
      borderColor: 'color-mix(in srgb, var(--color-primary) 36%, transparent)',
      title: 'Thành Công',
      icon: <IconCheckCircle size={19} color="var(--color-primary)" />,
    },
    error: {
      accentColor: 'var(--color-error)',
      textColor: 'var(--color-error-text, var(--color-error))',
      bgTint: 'color-mix(in srgb, var(--color-error) 13%, transparent)',
      borderColor: 'color-mix(in srgb, var(--color-error) 36%, transparent)',
      title: 'Thông Báo Lỗi',
      icon: <IconAlertTriangle size={19} color="var(--color-error-text, var(--color-error))" />,
    },
    info: {
      accentColor: 'var(--color-sky)',
      textColor: 'var(--color-sky)',
      bgTint: 'color-mix(in srgb, var(--color-sky) 13%, transparent)',
      borderColor: 'color-mix(in srgb, var(--color-sky) 36%, transparent)',
      title: 'Thông Tin',
      icon: <IconCompass size={19} color="var(--color-sky)" />,
    },
    warning: {
      accentColor: 'var(--color-earth)',
      textColor: 'var(--color-earth)',
      bgTint: 'color-mix(in srgb, var(--color-earth) 13%, transparent)',
      borderColor: 'color-mix(in srgb, var(--color-earth) 36%, transparent)',
      title: 'Cảnh Báo',
      icon: <IconShieldAlert size={19} color="var(--color-earth)" />,
    },
  }[type] || {
    accentColor: 'var(--color-primary)',
    textColor: 'var(--color-primary)',
    bgTint: 'color-mix(in srgb, var(--color-primary) 13%, transparent)',
    borderColor: 'color-mix(in srgb, var(--color-primary) 36%, transparent)',
    title: 'Thông Báo',
    icon: <IconCheckCircle size={19} color="var(--color-primary)" />,
  };

  const toastNode = (
    <aside
      aria-live="polite"
      aria-atomic="true"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`toast-card-responsive ${isExiting ? 'toast-spring-out' : 'toast-spring-in'}`}
      style={{
        position: 'fixed',
        top: 74,
        right: 24,
        zIndex: 'var(--z-toast, 5000)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-strong)',
        borderLeft: `4px solid ${typeConfig.accentColor}`,
        borderRadius: 6,
        padding: '12px 16px 14px 14px',
        color: 'var(--color-text-main)',
        boxShadow: 'var(--shadow-3d)',
        maxWidth: 440,
        minWidth: 300,
        overflow: 'hidden',
        cursor: 'default',
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* Type SVG Icon Container */}
      <div
        className="toast-icon-pop"
        style={{
          width: 34,
          height: 34,
          borderRadius: 4,
          background: typeConfig.bgTint,
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
            color: typeConfig.textColor,
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
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          position: 'relative',
          zIndex: 10,
          transition: 'color 0.18s ease, background-color 0.18s ease, transform 0.18s var(--ease-out-expo)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-text-main)';
          e.currentTarget.style.background = 'var(--color-surface-elevated)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-dim)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <IconX size={16} color="currentColor" />
      </button>

      {/* Live Animated Countdown Progress Bar at bottom (100% GPU scaleX) */}
      <div
        key={`${toastId}-${message}-${type}`}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: 3,
          background: typeConfig.accentColor,
          transformOrigin: 'left center',
          animation: `toastProgressCountdown ${duration}ms linear forwards`,
          animationPlayState: isHovered ? 'paused' : 'running',
        }}
      />
    </aside>
  );

  if (typeof document !== 'undefined') {
    return createPortal(toastNode, document.body);
  }
  return toastNode;
};
