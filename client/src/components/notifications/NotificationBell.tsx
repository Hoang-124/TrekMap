import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../context/SocketContext.js';
import {
  fetchNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  deleteNotificationApi,
} from '../../services/api.js';
import type { NotificationItem, NotificationCategory } from '../../types.js';

interface NotificationBellProps {
  currentUser?: any;
  onNavigate?: (view: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<{ [key: string]: number }>({});
  const [activeCategory, setActiveCategory] = useState<NotificationCategory | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocket();

  const loadNotifications = async (cat = activeCategory) => {
    setLoading(true);
    try {
      const res = await fetchNotificationsApi({ category: cat, limit: 30 });
      if (res.success) {
        setNotifications(res.data || []);
        setUnreadCount(res.unreadCount || 0);
        if (res.categoryCounts) {
          setCategoryCounts(res.categoryCounts);
        }
      }
    } catch (err) {
      // Fail gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications(activeCategory);
  }, [activeCategory]);

  // Realtime Socket.io Notification Listener
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (newNotif: NotificationItem) => {
      setNotifications((prev) => [newNotif, ...prev.filter((n) => n._id !== newNotif._id)]);
      setUnreadCount((prev) => prev + 1);
      setCategoryCounts((prev) => ({
        ...prev,
        [newNotif.category || 'system']: (prev[newNotif.category || 'system'] || 0) + 1,
        all: (prev.all || 0) + 1,
      }));
    };

    socket.on('newNotification', handleNewNotification);
    socket.on('newSafetyAlert', handleNewNotification);

    return () => {
      socket.off('newNotification', handleNewNotification);
      socket.off('newSafetyAlert', handleNewNotification);
    };
  }, [socket]);

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

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsReadApi(activeCategory);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      setCategoryCounts((prev) => ({ ...prev, [activeCategory]: 0, all: 0 }));
    } catch (err) {}
  };

  const handleMarkItemRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await markNotificationReadApi(id);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {}
  };

  const handleDeleteItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteNotificationApi(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch (err) {}
  };

  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) {
      markNotificationReadApi(item._id).catch(() => {});
      setNotifications((prev) => prev.map((n) => (n._id === item._id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    setIsOpen(false);

    if (item.link) {
      if (item.link.startsWith('/#trail/') || item.link.startsWith('#trail/')) {
        window.location.hash = item.link.replace(/^\//, '');
      } else if (item.link.startsWith('/admin') || item.link === 'admin') {
        if (onNavigate) onNavigate('admin');
        else window.location.hash = '#admin';
      } else if (item.link.startsWith('/contribute') || item.link === 'contribute') {
        if (onNavigate) onNavigate('contribute');
        else window.location.hash = '#contribute';
      } else if (item.link.startsWith('/forum') || item.link === 'forum') {
        if (onNavigate) onNavigate('forum');
        else window.location.hash = '#forum';
      } else {
        window.location.href = item.link;
      }
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'safety':
        return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)' };
      case 'moderation':
        return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)' };
      case 'social':
        return { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.35)' };
      default:
        return { color: 'var(--color-primary)', bg: 'rgba(16, 185, 129, 0.12)', border: 'var(--color-border)' };
    }
  };

  const renderIcon = (type: string, category: string) => {
    const style = getCategoryColor(category);
    return (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: style.bg,
          border: `1px solid ${style.border}`,
          color: style.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {category === 'safety' || type === 'safety_alert' || type === 'dispute_alert' ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ) : category === 'moderation' || type === 'contribution_approved' ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ) : category === 'social' || type === 'community_comment' || type === 'direct_message' ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        )}
      </div>
    );
  };

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'Vừa xong';
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins} phút trước`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} giờ trước`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays} ngày trước`;
      return new Date(dateStr).toLocaleDateString('vi-VN');
    } catch {
      return 'Gần đây';
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: unreadCount > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)',
          position: 'relative',
          padding: 0,
          boxShadow: 'var(--shadow-card)',
          flexShrink: 0,
          transition: 'all 0.2s ease',
        }}
        title="Thông báo thực địa TrekMap"
        aria-label="Thông báo"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>

        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              minWidth: 18,
              height: 18,
              padding: '0 4px',
              fontSize: '0.65rem',
              fontWeight: 800,
              color: '#ffffff',
              background: '#ef4444',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.7)',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 380,
            maxWidth: '92vw',
            background: 'var(--color-bg-card)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--color-border)',
            borderRadius: 16,
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px 10px',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                Thông Báo Thực Địa
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    padding: '2px 6px',
                    borderRadius: 10,
                    fontSize: '0.68rem',
                    fontWeight: 800,
                  }}
                >
                  {unreadCount} mới
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Đã đọc hết</span>
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: '8px 12px',
              background: 'rgba(0, 0, 0, 0.08)',
              borderBottom: '1px solid var(--color-border)',
              overflowX: 'auto',
            }}
          >
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'safety', label: 'An toàn' },
              { id: 'moderation', label: 'Duyệt bài' },
              { id: 'social', label: 'Cộng đồng' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id as any)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: '0.72rem',
                  fontWeight: activeCategory === tab.id ? 800 : 600,
                  background: activeCategory === tab.id ? 'var(--color-primary)' : 'transparent',
                  color: activeCategory === tab.id ? '#ffffff' : 'var(--color-text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>{tab.label}</span>
                {categoryCounts[tab.id] > 0 && (
                  <span
                    style={{
                      background: activeCategory === tab.id ? '#ffffff' : '#ef4444',
                      color: activeCategory === tab.id ? 'var(--color-primary)' : '#ffffff',
                      padding: '1px 5px',
                      borderRadius: 10,
                      fontSize: '0.62rem',
                      fontWeight: 800,
                    }}
                  >
                    {categoryCounts[tab.id]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Notification List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {loading && notifications.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                Đang tải thông báo...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, marginBottom: 8 }}>
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                <div>Chưa có thông báo nào trong mục này</div>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item._id}
                  onClick={() => handleItemClick(item)}
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    cursor: 'pointer',
                    background: item.isRead ? 'transparent' : 'rgba(16, 185, 129, 0.04)',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = item.isRead ? 'transparent' : 'rgba(16, 185, 129, 0.04)')}
                >
                  {/* Category / Type Icon */}
                  {renderIcon(item.type, item.category)}

                  {/* Body Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: item.isRead ? 600 : 800, color: 'var(--color-text-main)' }}>
                        {item.title}
                      </span>
                      {!item.isRead && (
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-text-muted)', lineHeight: 1.35, wordBreak: 'break-word' }}>
                      {item.message}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>
                        {formatTimeAgo(item.createdAt)}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {!item.isRead && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkItemRead(e, item._id)}
                            title="Đánh dấu đã đọc"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-primary)',
                              cursor: 'pointer',
                              padding: 2,
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteItem(e, item._id)}
                          title="Xóa thông báo"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-text-dim)',
                            cursor: 'pointer',
                            padding: 2,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--color-border)',
              textAlign: 'center',
              background: 'rgba(0, 0, 0, 0.05)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (onNavigate) onNavigate('notifications');
                else window.location.hash = '#notifications';
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '4px 8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>Xem tất cả thông báo chi tiết</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
