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

interface NotificationsPageProps {
  currentUser: UserProfile | null;
  onNavigate?: (link: string) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ currentUser, onNavigate }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [categoryCounts, setCategoryCounts] = useState<{ [key: string]: number }>({});
  const [activeCategory, setActiveCategory] = useState<NotificationCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState<boolean>(true);
  const { socket } = useSocket();

  const loadData = useCallback(async (cat = activeCategory) => {
    if (!currentUser) return;
    setLoading(true);
    const res = await fetchNotifications(1, 50, cat);
    setNotifications(res.notifications || []);
    setUnreadCount(res.unreadCount || 0);
    setCategoryCounts(res.categoryCounts || {});
    setLoading(false);
  }, [currentUser, activeCategory]);

  useEffect(() => {
    loadData(activeCategory);
  }, [activeCategory, loadData]);

  // Real-time socket event
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (newNotif: NotificationItem) => {
      setNotifications((prev) => [newNotif, ...prev.filter((n) => n._id !== newNotif._id)]);
      setUnreadCount((prev) => prev + 1);
    };

    socket.on('newNotification', handleNewNotification);
    socket.on('newSafetyAlert', handleNewNotification);

    return () => {
      socket.off('newNotification', handleNewNotification);
      socket.off('newSafetyAlert', handleNewNotification);
    };
  }, [socket]);

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      await markNotificationAsRead(notif._id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    if (notif.link) {
      if (notif.link.startsWith('/#trail/') || notif.link.startsWith('#trail/')) {
        window.location.hash = notif.link.replace(/^\//, '');
      } else if (notif.link.startsWith('/admin') || notif.link === 'admin') {
        if (onNavigate) onNavigate('admin');
        else window.location.hash = '#admin';
      } else if (notif.link.startsWith('/contribute') || notif.link === 'contribute') {
        if (onNavigate) onNavigate('contribute');
        else window.location.hash = '#contribute';
      } else if (notif.link.startsWith('/forum') || notif.link === 'forum') {
        if (onNavigate) onNavigate('forum');
        else window.location.hash = '#forum';
      } else if (onNavigate) {
        onNavigate(notif.link);
      }
    }
  };

  const handleMarkItemRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await markNotificationAsRead(id);
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleDeleteItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n._id !== id));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead(activeCategory);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleClearRead = async () => {
    await clearReadNotifications();
    setNotifications((prev) => prev.filter((n) => !n.isRead));
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'safety':
        return { color: 'var(--color-error)', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)', name: 'An Toàn' };
      case 'moderation':
        return { color: 'var(--color-primary)', bg: 'rgba(74, 222, 128, 0.15)', border: 'rgba(74, 222, 128, 0.35)', name: 'Kiểm Duyệt' };
      case 'social':
        return { color: 'var(--color-sky)', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.35)', name: 'Cộng Đồng' };
      default:
        return { color: 'var(--color-primary)', bg: 'rgba(74, 222, 128, 0.12)', border: 'var(--color-border)', name: 'Hệ Thống' };
    }
  };

  const renderCategoryIcon = (type: string, category: string) => {
    const style = getCategoryColor(category);
    return (
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
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
      return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • ${d.toLocaleDateString('vi-VN')}`;
    } catch {
      return 'Gần đây';
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (n.title && n.title.toLowerCase().includes(q)) ||
      (n.message && n.message.toLowerCase().includes(q))
    );
  });

  if (!currentUser) {
    return (
      <div className="card" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center', padding: 40 }}>
        <h3>Yêu cầu đăng nhập</h3>
        <p style={{ color: 'var(--color-text-muted)' }}>Vui lòng đăng nhập để xem toàn bộ lịch sử thông báo thực địa.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '30px auto', padding: '0 16px', boxSizing: 'border-box' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            <span>Trung Tâm Thông Báo Thực Địa</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
            Theo dõi các cảnh báo an toàn khẩn cấp, tiến độ duyệt bài đóng góp cung đường và tương tác cộng đồng
          </p>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {unreadCount > 0 && (
            <button className="btn btn-primary" onClick={handleMarkAllRead} style={{ fontSize: '0.8rem', padding: '8px 14px', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Đánh dấu tất cả đã đọc</span>
            </button>
          )}

          {notifications.some((n) => n.isRead) && (
            <button className="btn btn-outline" onClick={handleClearRead} style={{ fontSize: '0.8rem', padding: '8px 14px', gap: 6 }}>
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
          {/* Category Tabs */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'safety', label: 'An Toàn & Cứu Hộ' },
              { id: 'moderation', label: 'Kiểm Duyệt Cung Đường' },
              { id: 'social', label: 'Cộng Đồng & Chat' },
              { id: 'system', label: 'Hệ Thống' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id as any)}
                className={`btn ${activeCategory === tab.id ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.8rem', padding: '6px 14px', borderRadius: 20 }}
              >
                <span>{tab.label}</span>
                {categoryCounts[tab.id] > 0 && (
                  <span
                    style={{
                      background: activeCategory === tab.id ? '#ffffff' : '#ef4444',
                      color: activeCategory === tab.id ? 'var(--color-primary)' : '#ffffff',
                      padding: '1px 6px',
                      borderRadius: 10,
                      fontSize: '0.65rem',
                      fontWeight: 800,
                    }}
                  >
                    {categoryCounts[tab.id]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 220, flex: '1 1 240px', maxWidth: 360 }}>
            <input
              type="text"
              className="input"
              placeholder="Tìm kiếm nội dung thông báo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '7px 12px' }}
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
              Bạn đã cập nhật toàn bộ tin tức mới nhất từ hệ sinh thái TrekMap.
            </p>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const catStyle = getCategoryColor(item.category);
            return (
              <div
                key={item._id}
                onClick={() => handleItemClick(item)}
                className="card"
                style={{
                  padding: 16,
                  display: 'flex',
                  gap: 16,
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  borderLeft: `4px solid ${item.isRead ? 'var(--color-border)' : catStyle.color}`,
                  background: item.isRead ? 'var(--color-bg-card)' : 'rgba(16, 185, 129, 0.03)',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Left Category Icon */}
                {renderCategoryIcon(item.type, item.category)}

                {/* Main Body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: item.isRead ? 600 : 800, color: 'var(--color-text-main)' }}>
                        {item.title}
                      </span>
                      <span
                        style={{
                          background: catStyle.bg,
                          color: catStyle.color,
                          border: `1px solid ${catStyle.border}`,
                          padding: '2px 8px',
                          borderRadius: 12,
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

                  {/* Actions Bar */}
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
                    ) : <span />}

                    <div style={{ display: 'flex', gap: 8 }}>
                      {!item.isRead && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={(e) => handleMarkItemRead(e, item._id)}
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
                        onClick={(e) => handleDeleteItem(e, item._id)}
                        style={{ padding: '4px 8px', fontSize: '0.72rem', color: 'var(--color-text-dim)' }}
                        title="Xóa thông báo"
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
