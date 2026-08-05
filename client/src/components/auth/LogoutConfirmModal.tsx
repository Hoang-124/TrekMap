import React from 'react';
import { LogOut, X } from 'lucide-react';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  username?: string;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  username,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Click-away transparent overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          background: 'rgba(0, 0, 0, 0.25)',
        }}
      />

      {/* Floating Tactical Popover Box - Positioned right below the Navbar Logout button */}
      <div
        style={{
          position: 'fixed',
          top: 74,
          right: 24,
          zIndex: 9999,
          maxWidth: 320,
          width: 'calc(100vw - 48px)',
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 20,
          padding: '18px 20px',
          boxShadow: 'var(--shadow-card)',
          backdropFilter: 'blur(24px)',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Top Pointer Arrow */}
        <div
          style={{
            position: 'absolute',
            top: -7,
            right: 22,
            width: 12,
            height: 12,
            background: 'var(--color-bg-card)',
            borderLeft: '1px solid var(--color-border)',
            borderTop: '1px solid var(--color-border)',
            transform: 'rotate(45deg)',
          }}
        />

        {/* Popover Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              padding: 6,
              borderRadius: 10,
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <LogOut size={16} color="var(--color-error)" />
            </div>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)' }}>
              Đăng xuất tài khoản?
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Popover Body Description */}
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '0 0 16px 0', lineHeight: 1.45, textAlign: 'left' }}>
          Bạn có muốn đăng xuất khỏi <strong style={{ color: 'var(--color-primary)' }}>{username || 'TrekMap'}</strong> không?
        </p>

        {/* Compact Action Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 12,
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-main)',
              color: 'var(--color-text-main)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#00ffd5')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(0, 255, 213, 0.25)')}
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <LogOut size={14} /> Đăng xuất
          </button>
        </div>
      </div>
    </>
  );
};
