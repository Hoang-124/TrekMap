import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import type { NotificationItem, UserProfile } from '../../types.js';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../services/notificationService.js';
import { useSocket } from '../../hooks/useSocket.js';

interface NotificationBellProps {
  currentUser: UserProfile | null;
  onNavigate?: (link: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ currentUser, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { socket } = useSocket();

  const loadNotificationsData = useCallback(async () => {
    if (!currentUser) return;
    const { notifications: list, unreadCount: unread } = await fetchNotifications(1, 10);
    setNotifications(list);
    setUnreadCount(unread);
  }, [currentUser]);

  useEffect(() => {
    loadNotificationsData();
  }, [loadNotificationsData]);

  // Real-time socket listener for newNotification
  useEffect(() => {
    if (!socket || !currentUser) return;

    const handleNewNotif = (notif: NotificationItem) => {
      if (notif.type === 'new_message' || (notif.type as string) === 'message') return;
      setNotifications((prev) => [notif, ...prev.slice(0, 9)]);
      setUnreadCount((prev) => prev + 1);
    };

    socket.on('newNotification', handleNewNotif);

    return () => {
      socket.off('newNotification', handleNewNotif);
    };
  }, [socket, currentUser]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      loadNotificationsData();
    }
  };

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      await markNotificationAsRead(notif._id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setIsOpen(false);
    if (notif.link && onNavigate) {
      onNavigate(notif.link);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  if (!currentUser) return null;

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Bell Button Icon */}
      <button
        type="button"
        className="btn btn-outline"
        onClick={handleToggle}
        title="Thông báo hệ thống"
        style={{
          position: 'relative',
          width: 38,
          height: 38,
          padding: 0,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '0.68rem',
              fontWeight: 800,
              borderRadius: 10,
              padding: '2px 6px',
              minWidth: 16,
              textAlign: 'center',
              boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 360,
            maxWidth: '90vw',
            background: 'var(--color-bg-card)',
            border: '1.5px solid var(--color-border)',
            borderRadius: 16,
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.25)',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          {/* Panel Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-bg-main)',
            }}
          >
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
              Thông Báo {unreadCount > 0 ? `(${unreadCount})` : ''}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <CheckCheck size={14} /> Đánh dấu đã đọc
              </button>
            )}
          </div>

          {/* List Items */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                Không có thông báo nào.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif._id}
                  onClick={() => handleItemClick(notif)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    background: notif.isRead ? 'transparent' : 'rgba(16, 185, 129, 0.06)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-main)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = notif.isRead ? 'transparent' : 'rgba(16, 185, 129, 0.06)')
                  }
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div
                      style={{
                        fontSize: '0.88rem',
                        fontWeight: notif.isRead ? 700 : 900,
                        color: 'var(--color-text-main)',
                      }}
                    >
                      {notif.title}
                    </div>

                    {!notif.isRead && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--color-primary)',
                          marginTop: 4,
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--color-text-muted)',
                      marginTop: 4,
                      lineHeight: 1.35,
                    }}
                  >
                    {notif.message}
                  </div>

                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
                    {new Date(notif.createdAt).toLocaleDateString('vi-VN')} {new Date(notif.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer View All Link */}
          <div
            onClick={() => {
              setIsOpen(false);
              onNavigate?.('/#notifications');
            }}
            style={{
              padding: '10px 16px',
              textAlign: 'center',
              fontSize: '0.82rem',
              fontWeight: 800,
              color: 'var(--color-primary)',
              cursor: 'pointer',
              background: 'var(--color-bg-main)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            Xem tất cả lịch sử thông báo →
          </div>
        </div>
      )}
    </div>
  );
};
