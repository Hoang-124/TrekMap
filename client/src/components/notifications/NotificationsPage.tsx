import React, { useState, useEffect, useCallback } from 'react';
import type { NotificationItem, NotificationCategory, UserProfile } from '../../types.js';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearReadNotifications,
} from '../../services/notificationService.js';
import { useSocket } from '../../context/SocketContext.js';
import { searchMatchVietnamese } from '../../utils/textUtils.js';

interface NotificationsPageProps {
  currentUser: UserProfile | null;
  onNavigate?: (link: string) => void;
}

const navigateNotificationLink = (link: string, onNavigate?: (link: string) => void) => {
  const trimmed = link.trim();
  if (!trimmed) return;

  if (trimmed.startsWith('/#trail/') || trimmed.startsWith('#trail/')) {
    const trailId = trimmed.replace(/^\/?#trail\//, '');
    if (trailId) {
      window.history.pushState({}, '', `/trails/${encodeURIComponent(trailId)}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
  }

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    window.history.pushState({}, '', trimmed);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (onNavigate) {
    onNavigate(trimmed.replace(/^#/, ''));
  } else {
    window.location.hash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  }
};

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ currentUser, onNavigate }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [categoryCounts, setCategoryCounts] = useState<{ [key: string]: number }>({});
  const [activeCategory, setActiveCategory] = useState<NotificationCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState<boolean>(true);
  const { socket } = useSocket();

  const loadData = useCallback(
    async (cat: NotificationCategory | 'all' = activeCategory) => {
      if (!currentUser) return;
      setLoading(true);
      const res = await fetchNotifications(1, 50, cat);
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
      setCategoryCounts(res.categoryCounts || {});
      setLoading(false);
    },
    [currentUser, activeCategory]
  );

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    fetchNotifications(1, 50, activeCategory)
      .then((res) => {
        if (!active) return;
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
        setCategoryCounts(res.categoryCounts || {});
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentUser, activeCategory]);

  // Keep synced with NotificationBell
  useEffect(() => {
    const handleSynced = () => {
      void loadData(activeCategory);
    };
    window.addEventListener('lost:notifications-synced', handleSynced);
    return () => window.removeEventListener('lost:notifications-synced', handleSynced);
  }, [activeCategory, loadData]);

  // Real-time socket event (respects activeCategory tab filter)
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (newNotif: NotificationItem) => {
      if (activeCategory === 'all' || newNotif.category === activeCategory) {
        setNotifications((prev) => [newNotif, ...prev.filter((n) => n._id !== newNotif._id)]);
      }
      setUnreadCount((prev) => prev + 1);
      const catKey = newNotif.category || 'system';
      setCategoryCounts((prev) => ({
        ...prev,
        [catKey]: (prev[catKey] || 0) + 1,
        all: (prev.all || 0) + 1,
      }));
    };

    socket.on('newNotification', handleNewNotification);
    socket.on('newSafetyAlert', handleNewNotification);

    return () => {
      socket.off('newNotification', handleNewNotification);
      socket.off('newSafetyAlert', handleNewNotification);
    };
  }, [socket, activeCategory]);

  const decrementCountsForItem = (item?: NotificationItem) => {
    if (!item || item.isRead) return;
    const catKey = item.category || 'system';
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setCategoryCounts((prev) => ({
      ...prev,
      [catKey]: Math.max(0, (prev[catKey] || 0) - 1),
      all: Math.max(0, (prev.all || 0) - 1),
    }));
  };

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      await markNotificationAsRead(notif._id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
      );
      decrementCountsForItem(notif);
      window.dispatchEvent(new CustomEvent('lost:notifications-synced'));
    }
    if (notif.link) {
      navigateNotificationLink(notif.link, onNavigate);
    }
  };

  const handleMarkItemRead = async (e: React.MouseEvent, item: NotificationItem) => {
    e.stopPropagation();
    if (item.isRead) return;
    await markNotificationAsRead(item._id);
    setNotifications((prev) =>
      prev.map((n) => (n._id === item._id ? { ...n, isRead: true } : n))
    );
    decrementCountsForItem(item);
    window.dispatchEvent(new CustomEvent('lost:notifications-synced'));
  };

  const handleDeleteItem = async (e: React.MouseEvent, item: NotificationItem) => {
    e.stopPropagation();
    await deleteNotification(item._id);
    setNotifications((prev) => prev.filter((n) => n._id !== item._id));
    decrementCountsForItem(item);
    window.dispatchEvent(new CustomEvent('lost:notifications-synced'));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead(activeCategory);
    await loadData(activeCategory);
    window.dispatchEvent(new CustomEvent('lost:notifications-synced'));
  };

  const handleClearRead = async () => {
    await clearReadNotifications();
    setNotifications((prev) => prev.filter((n) => !n.isRead));
    window.dispatchEvent(new CustomEvent('lost:notifications-synced'));
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'safety':
        return {
          color: 'var(--color-error-text, var(--color-error))',
          bg: 'color-mix(in srgb, var(--color-error) 12%, transparent)',
          border: 'color-mix(in srgb, var(--color-error) 32%, transparent)',
          name: 'An Toàn',
        };
      case 'moderation':
        return {
          color: 'var(--color-primary)',
          bg: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
          border: 'color-mix(in srgb, var(--color-primary) 32%, transparent)',
          name: 'Kiểm Duyệt',
        };
      case 'social':
        return {
          color: 'var(--color-sky)',
          bg: 'color-mix(in srgb, var(--color-sky) 12%, transparent)',
          border: 'color-mix(in srgb, var(--color-sky) 32%, transparent)',
          name: 'Cộng Đồng',
        };
      default:
        return {
          color: 'var(--color-primary)',
          bg: 'var(--color-surface-elevated)',
          border: 'var(--color-border)',
          name: 'Hệ Thống',
        };
    }
  };

  const renderCategoryIcon = (type: string, category: string) => {
    const style = getCategoryColor(category);
    return (
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 4,
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ) : category === 'moderation' || type === 'contribution_approved' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ) : category === 'social' || type === 'community_comment' || type === 'direct_message' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        )}
      </div>
    );
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return 'Vừa xong';
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · ${d.toLocaleDateString('vi-VN')}`;
    } catch {
      return 'Gần đây';
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (!searchQuery.trim()) return true;
    return (
      searchMatchVietnamese(n.title || '', searchQuery) ||
      searchMatchVietnamese(n.message || '', searchQuery)
    );
  });

  if (!currentUser) {
    return (
      <div className="card" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center', padding: 40 }}>
        <h3>Yêu cầu đăng nhập</h3>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Vui lòng đăng nhập để xem toàn bộ lịch sử thông báo thực địa.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '30px auto', padding: '0 16px', boxSizing: 'border-box' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 22,
          paddingBottom: 16,
          borderBottom: '1px solid var(--color-border)',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div>
          <div className="section-eyebrow" style={{ marginBottom: 6 }}>
            Nhật ký hệ thống
          </div>
          <h2
            className="font-editorial"
            style={{
              fontSize: 'clamp(1.65rem, 3vw, 2.2rem)',
              fontWeight: 500,
              color: 'var(--color-text-main)',
              margin: 0,
              lineHeight: 1.08,
            }}
          >
            Trung Tâm Thông Báo Thực Địa
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', margin: '6px 0 0 0' }}>
            Cảnh báo an toàn khẩn cấp, tiến độ duyệt cung đường và tương tác cộng đồng.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {unreadCount > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleMarkAllRead()}
              style={{ fontSize: '0.8rem', padding: '8px 14px', gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Đánh dấu tất cả đã đọc</span>
            </button>
          )}

          {notifications.some((n) => n.isRead) && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => void handleClearRead()}
              style={{ fontSize: '0.8rem', padding: '8px 14px', gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>Dọn sạch tin đã đọc</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="card" style={{ padding: 14, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(
              [
                { id: 'all', label: 'Tất cả' },
                { id: 'safety', label: 'An Toàn & Cứu Hộ' },
                { id: 'moderation', label: 'Kiểm Duyệt Cung Đường' },
                { id: 'social', label: 'Cộng Đồng & Chat' },
                { id: 'system', label: 'Hệ Thống' },
              ] as ReadonlyArray<{ id: NotificationCategory | 'all'; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setLoading(true);
                  setActiveCategory(tab.id);
                }}
                className={`btn ${activeCategory === tab.id ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.8rem', padding: '6px 13px' }}
              >
                <span>{tab.label}</span>
                {(categoryCounts[tab.id] || 0) > 0 && (
                  <span
                    style={{
                      background:
                        activeCategory === tab.id ? 'var(--color-on-primary)' : 'var(--color-error)',
                      color:
                        activeCategory === tab.id ? 'var(--color-primary)' : 'var(--color-on-danger)',
                      padding: '1px 6px',
                      borderRadius: 3,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {categoryCounts[tab.id]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', minWidth: 220, flex: '1 1 240px', maxWidth: 360 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Tìm kiếm nội dung thông báo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '7px 12px', width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Main Notification Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Đang tải danh sách thông báo thực địa...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35, marginBottom: 12 }}>
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
              Không có thông báo nào
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
              Bạn đã cập nhật toàn bộ tin tức mới nhất từ hệ sinh thái LOST.
            </p>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const catStyle = getCategoryColor(item.category);
            return (
              <div
                key={item._id}
                role="button"
                tabIndex={0}
                onClick={() => void handleItemClick(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void handleItemClick(item);
                  }
                }}
                className="card"
                style={{
                  padding: 16,
                  display: 'flex',
                  gap: 16,
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  borderLeft: `4px solid ${item.isRead ? 'var(--color-border)' : catStyle.color}`,
                  background: item.isRead
                    ? 'var(--color-bg-card)'
                    : 'color-mix(in srgb, var(--color-primary) 5%, var(--color-bg-card))',
                  transition: 'all 0.2s ease',
                }}
              >
                {renderCategoryIcon(item.type, item.category)}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: item.isRead ? 600 : 800, color: 'var(--color-text-main)' }}>
                        {item.title}
                      </span>
                      <span
                        style={{
                          background: catStyle.bg,
                          color: catStyle.color,
                          border: `1px solid ${catStyle.border}`,
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: '0.68rem',
                          fontWeight: 700,
                        }}
                      >
                        {catStyle.name}
                      </span>
                    </div>

                    <span style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)' }}>
                      {formatTime(item.createdAt)}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '4px 0 8px 0', lineHeight: 1.45 }}>
                    {item.message}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    {item.link ? (
                      <span
                        style={{
                          color: 'var(--color-primary)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>Xem chi tiết nội dung</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </span>
                    ) : (
                      <span />
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                      {!item.isRead && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={(e) => void handleMarkItemRead(e, item)}
                          style={{ padding: '4px 10px', fontSize: '0.72rem', gap: 4 }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>Đã đọc</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={(e) => void handleDeleteItem(e, item)}
                        style={{ padding: '4px 8px', fontSize: '0.72rem', color: 'var(--color-text-dim)' }}
                        title="Xóa thông báo"
                        aria-label="Xóa thông báo"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
