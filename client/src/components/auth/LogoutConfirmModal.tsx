import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { isTopmostFocusTrap, useFocusTrap } from '../../hooks/useFocusTrap.js';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userName?: string;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  userName = 'thành viên',
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(isOpen, dialogRef, { initialFocusRef: cancelBtnRef });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (!isTopmostFocusTrap(dialogRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal-nested, 3100)' as unknown as number,
        background: 'var(--overlay-bg)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-label="Xác nhận đăng xuất"
        onClick={(e) => e.stopPropagation()}
        className="modal-fade-in"
        style={{
          position: 'fixed',
          top: 64,
          right: 20,
          width: 286,
          maxWidth: 'calc(100vw - 32px)',
          padding: '16px 18px',
          borderRadius: 6,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          borderTop: '2px solid var(--color-error)',
          boxShadow: 'var(--shadow-3d)',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div
            style={{
              background: 'color-mix(in srgb, var(--color-error) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
              width: 34,
              height: 34,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>

          <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1.2 }}>
              Xác nhận đăng xuất?
            </div>
            <div
              style={{
                fontSize: '0.74rem',
                color: 'var(--color-text-muted)',
                marginTop: 3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {userName}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            ref={cancelBtnRef}
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            style={{
              flex: 1,
              height: 34,
              padding: '0 12px',
              borderRadius: 4,
              fontSize: '0.78rem',
              fontWeight: 700,
            }}
          >
            Hủy
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            style={{
              flex: 1,
              height: 34,
              padding: '0 12px',
              borderRadius: 4,
              fontSize: '0.78rem',
              fontWeight: 800,
            }}
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
