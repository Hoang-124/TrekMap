import React, { useState, useEffect, useCallback } from 'react';
import type { NotificationItem, UserProfile } from '../../types.js';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../services/notificationService.js';
import { CheckCheck, Bell } from 'lucide-react';

interface NotificationsPageProps {
  currentUser: UserProfile | null;
  onNavigate?: (link: string) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ currentUser, onNavigate }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = useCallback(async (p = 1) => {
    if (!currentUser) return;
    setLoading(true);
    const { notifications: list, unreadCount: unread, pages } = await fetchNotifications(p, 15);
    setNotifications(list);
    setUnreadCount(unread);
    setTotalPages(pages);
    setLoading(false);
  }, [currentUser]);

  useEffect(() => {
    loadData(page);
  }, [page, loadData]);

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      await markNotificationAsRead(notif._id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    if (notif.link && onNavigate) {
      onNavigate(notif.link);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  if (!currentUser) {
    return (
      <div className="card" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center', padding: 40 }}>
        <h3>Yêu cầu đăng nhập</h3>
        <p style={{ color: 'var(--color-text-muted)' }}>Vui lòng đăng nhập để xem lịch sử thông báo.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '30px auto', padding: '0 16px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={24} color="var(--color-primary)" /> Thông Báo Hệ Thống
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
            Xem toàn bộ lịch sử thông báo bài đóng góp, tin nhắn và thông tin từ BQT
          </p>
        </div>

        {unreadCount > 0 && (
          <button className="btn btn-outline" onClick={handleMarkAllRead} style={{ fontSize: '0.82rem', gap: 6 }}>
            <CheckCheck size={16} /> Đánh dấu tất cả đã đọc
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Đang tải danh sách thông báo...
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: 50, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Bạn chưa có thông báo nào.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {notifications.map((notif) => (
              <div
                key={notif._id}
                onClick={() => handleItemClick(notif)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
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
                <div style={{ flex: 1, paddingRight: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: notif.isRead ? 700 : 900, color: 'var(--color-text-main)' }}>
                      {notif.title}
                    </span>
                    {!notif.isRead && (
                      <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                        Mới
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    {notif.message}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
                    {new Date(notif.createdAt).toLocaleDateString('vi-VN')} {new Date(notif.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                  Xem →
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, padding: 16, borderTop: '1px solid var(--color-border)' }}>
            <button
              className="btn btn-outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{ fontSize: '0.82rem' }}
            >
              ← Trang trước
            </button>
            <span style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', fontWeight: 700 }}>
              Trang {page} / {totalPages}
            </span>
            <button
              className="btn btn-outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{ fontSize: '0.82rem' }}
            >
              Trang sau →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
