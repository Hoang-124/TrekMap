import React, { useState, useEffect, useRef } from 'react';
import { IconBell, IconCheckCircle } from '../common/SvgIcons.js';

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  currentUser?: any;
  onNavigate?: (view: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('trekmap_token');
      if (!token) return;

      const res = await fetch('http://localhost:5000/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      // Fail silently
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      const token = localStorage.getItem('trekmap_token');
      if (!token) return;

      await fetch('http://localhost:5000/api/notifications/read-all', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      // Fail silently
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--color-primary)',
          position: 'relative',
          padding: 0,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          flexShrink: 0,
        }}
        title="Thông báo cộng đồng"
        aria-label="Notifications"
      >
        <IconBell size={18} color="var(--color-primary)" />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              padding: '2px 5px',
              fontSize: '9px',
              fontWeight: 800,
              color: '#ffffff',
              background: '#ef4444',
              borderRadius: 10,
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 320,
            maxWidth: '90vw',
            background: 'rgba(10, 28, 36, 0.98)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0, 255, 213, 0.3)',
            borderRadius: 16,
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 255, 213, 0.15)',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: 'rgba(7, 18, 24, 0.9)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconBell size={16} color="#00ffd5" />
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#ffffff' }}>
                Thông Báo Cộng Đồng
              </span>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00ffd5',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: 0,
                }}
              >
                <IconCheckCircle size={13} color="#00ffd5" />
                Đọc hết
              </button>
            )}
          </div>

          {/* List of Notifications */}
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem' }}>
                Chưa có thông báo mới nào.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    background: n.isRead ? 'transparent' : 'rgba(0, 255, 213, 0.05)',
                    transition: 'background 0.2s ease',
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00ffd5', marginBottom: 2 }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#cbd5e1', lineHeight: 1.35 }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 4 }}>
                    {new Date(n.createdAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {onNavigate && (
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(7, 18, 24, 0.9)',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                textAlign: 'center',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onNavigate('notifications');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#38bdf8',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Xem tất cả thông báo →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
