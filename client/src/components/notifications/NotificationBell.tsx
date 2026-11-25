import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext.js';
import {
  NOTIFICATIONS_SYNC_EVENT,
  dispatchNotificationsSynced,
  dispatchNotificationToast,
  navigateNotificationLink,
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../../services/notificationService.js';
import type { NotificationItem, NotificationCategory, UserProfile } from '../../types.js';

interface NotificationBellProps {
  currentUser?: (UserProfile & { _id?: string }) | null;
  onNavigate?: (view: string) => void;
}

const MAX_SEEN_NOTIF_IDS = 500;

const NOTIFICATION_TABS: Array<{ id: NotificationCategory | 'all'; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'safety', label: 'An toàn' },
  { id: 'moderation', label: 'Duyệt bài' },
  { id: 'social', label: 'Cộng đồng' },
  { id: 'system', label: 'Hệ thống' },
];

export const NotificationBell: React.FC<NotificationBellProps> = ({ currentUser, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<{ [key: string]: number }>({});
  const [activeCategory, setActiveCategory] = useState<NotificationCategory | 'all'>('all');
  const [loadedKey, setLoadedKey] = useState<string>('');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  const [isNarrowViewport, setIsNarrowViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 520 : false
  );
  const [mobileDropdownTop, setMobileDropdownTop] = useState<number>(64);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const { socket } = useSocket();
  const currentUserId = currentUser?.id || currentUser?._id || null;

  const currentRequestKey = currentUserId ? `${currentUserId}:${activeCategory}:${refreshTick}` : '';
  const loading = Boolean(currentUserId) && loadedKey !== currentRequestKey;
  const visibleNotifications = currentUserId ? notifications : [];
  const visibleUnreadCount = currentUserId ? unreadCount : 0;
  const visibleCategoryCounts = currentUserId ? categoryCounts : {};
  const activeCategoryUnreadCount =
    activeCategory === 'all'
      ? visibleUnreadCount
      : visibleCategoryCounts[activeCategory] || 0;

  const triggerReload = useCallback(() => {
    setRefreshTick((prev) => prev + 1);
  }, []);

  // Track narrow mobile viewports to prevent 380px dropdown left-edge clipping
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 520px)');
    const onChange = () => setIsNarrowViewport(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    const controller = new AbortController();
    const reqKey = `${currentUserId}:${activeCategory}:${refreshTick}`;

    fetchNotifications(1, 30, activeCategory, controller.signal)
      .then((res) => {
        if (cancelled || controller.signal.aborted) return;
        if (!res.ok) {
          // Surface error instead of overwriting badge & list with empty zeros
          setFetchError(res.error || 'Không thể tải thông báo. Vui lòng thử lại.');
          return;
        }
        const list = res.notifications || [];
        seenNotifIdsRef.current = new Set(list.map((n) => n._id));
        setFetchError(null);
        setNotifications(list);
        setUnreadCount(res.unreadCount || 0);
        setCategoryCounts(res.categoryCounts || {});
        setNowTs(Date.now());
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!cancelled) {
          setFetchError('Không thể tải thông báo. Vui lòng thử lại.');
        }
      })
      .finally(() => {
        if (!cancelled && !controller.signal.aborted) {
          setLoadedKey(reqKey);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentUserId, activeCategory, refreshTick]);

  // Cross-component sync with NotificationsPage (ignore self-dispatched events to avoid double fetch loop)
  useEffect(() => {
    const handleSynced = (e: Event) => {
      const detail = (e as CustomEvent<{ source?: string }>).detail;
      if (detail?.source === 'bell') return;
      triggerReload();
    };
    window.addEventListener(NOTIFICATIONS_SYNC_EVENT, handleSynced);
    return () => window.removeEventListener(NOTIFICATIONS_SYNC_EVENT, handleSynced);
  }, [triggerReload]);

  // Realtime Socket.io Notification Listener + Reconnect Backfill
  useEffect(() => {
    if (!socket || !currentUserId) return;

    const handleReconnect = () => {
      triggerReload();
    };

    const handleNewNotification = (newNotif: NotificationItem) => {
      const notifId = newNotif._id ? String(newNotif._id) : '';
      const isDuplicate = Boolean(notifId && seenNotifIdsRef.current.has(notifId));
      if (notifId) {
        seenNotifIdsRef.current.add(notifId);
        if (seenNotifIdsRef.current.size > MAX_SEEN_NOTIF_IDS) {
          const oldest = seenNotifIdsRef.current.values().next().value;
          if (oldest !== undefined) seenNotifIdsRef.current.delete(oldest);
        }
      }
      if (activeCategory === 'all' || newNotif.category === activeCategory) {
        setNotifications((prev) => [newNotif, ...prev.filter((n) => n._id !== newNotif._id)]);
      }
      if (!isDuplicate) {
        setUnreadCount((prev) => prev + 1);
        const catKey = newNotif.category || 'system';
        setCategoryCounts((prev) => ({
          ...prev,
          [catKey]: (prev[catKey] || 0) + 1,
          all: (prev.all || 0) + 1,
        }));
      }
    };

    socket.on('connect', handleReconnect);
    socket.on('newNotification', handleNewNotification);

    return () => {
      socket.off('connect', handleReconnect);
      socket.off('newNotification', handleNewNotification);
    };
  }, [socket, currentUserId, activeCategory, triggerReload]);

  // Click outside & Escape key to close dropdown
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (document.querySelector('[aria-modal="true"]')) return;
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

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

  const handleMarkAllRead = async () => {
    const ok = await markAllNotificationsAsRead(activeCategory);
    if (!ok) {
      dispatchNotificationToast('Không thể đánh dấu tất cả thông báo đã đọc. Vui lòng thử lại.', 'error');
      return;
    }
    triggerReload();
    dispatchNotificationsSynced('bell');
  };

  const handleMarkItemRead = async (e: React.MouseEvent, item: NotificationItem) => {
    e.stopPropagation();
    if (item.isRead) return;
    const ok = await markNotificationAsRead(item._id);
    if (!ok) {
      dispatchNotificationToast('Không thể cập nhật trạng thái thông báo. Vui lòng thử lại.', 'error');
      return;
    }
    setNotifications((prev) =>
      prev.map((n) => (n._id === item._id ? { ...n, isRead: true } : n))
    );
    decrementCountsForItem(item);
    dispatchNotificationsSynced('bell');
  };

  const handleDeleteItem = async (e: React.MouseEvent, item: NotificationItem) => {
    e.stopPropagation();
    const ok = await deleteNotification(item._id);
    if (!ok) {
      dispatchNotificationToast('Không thể xóa thông báo lúc này. Vui lòng thử lại.', 'error');
      return;
    }
    setNotifications((prev) => prev.filter((n) => n._id !== item._id));
    decrementCountsForItem(item);
    dispatchNotificationsSynced('bell');
  };

  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) {
      void markNotificationAsRead(item._id).then((ok) => {
        if (ok) {
          setNotifications((prev) =>
            prev.map((n) => (n._id === item._id ? { ...n, isRead: true } : n))
          );
          decrementCountsForItem(item);
          dispatchNotificationsSynced('bell');
        } else {
          dispatchNotificationToast('Không thể đánh dấu thông báo đã đọc.', 'error');
        }
      });
    }

    setIsOpen(false);
    if (item.link) {
      navigateNotificationLink(item.link, onNavigate);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'safety':
        return {
          color: 'var(--color-error-text, var(--color-error))',
          bg: 'color-mix(in srgb, var(--color-error) 14%, transparent)',
          border: 'color-mix(in srgb, var(--color-error) 34%, transparent)',
        };
      case 'moderation':
        return {
          color: 'var(--color-primary)',
          bg: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
          border: 'color-mix(in srgb, var(--color-primary) 34%, transparent)',
        };
      case 'social':
        return {
          color: 'var(--color-sky)',
          bg: 'color-mix(in srgb, var(--color-sky) 14%, transparent)',
          border: 'color-mix(in srgb, var(--color-sky) 34%, transparent)',
        };
      default:
        return {
          color: 'var(--color-primary)',
          bg: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
          border: 'var(--color-border)',
        };
    }
  };

  const renderIcon = (type: string, category: string) => {
    const style = getCategoryColor(category);
    return (
      <div
        style={{
          width: 32,
          height: 32,
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
      const diffMs = Math.max(0, nowTs - new Date(dateStr).getTime());
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

  const handleToggleOpen = () => {
    setNowTs(Date.now());
    if (!isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      setMobileDropdownTop(Math.max(56, Math.round(rect.bottom + 8)));
    }
    setIsOpen((prev) => !prev);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={handleToggleOpen}
        aria-expanded={isOpen}
        aria-haspopup="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: 4,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: visibleUnreadCount > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)',
          position: 'relative',
          padding: 0,
          boxShadow: 'var(--shadow-card)',
          flexShrink: 0,
          transition: 'border-color 0.2s ease, color 0.2s ease',
        }}
        title="Thông báo"
        aria-label={`Thông báo${visibleUnreadCount > 0 ? ` (${visibleUnreadCount} chưa đọc)` : ''}`}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>

        {visibleUnreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: '0 4px',
              fontSize: '0.65rem',
              fontWeight: 800,
              color: 'var(--color-on-danger)',
              background: 'var(--color-error)',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {visibleUnreadCount > 99 ? '99+' : visibleUnreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="notification-dropdown"
          style={
            isNarrowViewport
              ? {
                  position: 'fixed',
                  top: mobileDropdownTop,
                  left: 12,
                  right: 12,
                  width: 'auto',
                  maxWidth: 'calc(100vw - 24px)',
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: 6,
                  boxShadow: 'var(--shadow-3d)',
                  zIndex: 'var(--z-dropdown, 1100)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }
              : {
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  width: 'min(380px, calc(100vw - 24px))',
                  maxWidth: 'calc(100vw - 24px)',
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: 6,
                  boxShadow: 'var(--shadow-3d)',
                  zIndex: 'var(--z-dropdown, 1100)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }
          }
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
                Thông báo
              </span>
              {visibleUnreadCount > 0 && (
                <span
                  style={{
                    background: 'color-mix(in srgb, var(--color-error) 14%, transparent)',
                    color: 'var(--color-error-text, var(--color-error))',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {visibleUnreadCount} mới
                </span>
              )}
            </div>

            {activeCategoryUnreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
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
              background: 'var(--color-bg-main)',
              borderBottom: '1px solid var(--color-border)',
              overflowX: 'auto',
            }}
          >
            {NOTIFICATION_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: '0.72rem',
                  fontWeight: activeCategory === tab.id ? 800 : 600,
                  background: activeCategory === tab.id ? 'var(--color-primary)' : 'transparent',
                  color: activeCategory === tab.id ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background-color 0.15s ease, color 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>{tab.label}</span>
                {(visibleCategoryCounts[tab.id] || 0) > 0 && (
                  <span
                    style={{
                      background:
                        activeCategory === tab.id ? 'var(--color-on-primary)' : 'var(--color-error)',
                      color:
                        activeCategory === tab.id ? 'var(--color-primary)' : 'var(--color-on-danger)',
                      padding: '1px 5px',
                      borderRadius: 3,
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {visibleCategoryCounts[tab.id]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Inline Error Banner when cached items still exist */}
          {fetchError && visibleNotifications.length > 0 && (
            <div
              style={{
                padding: '8px 14px',
                background: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                fontSize: '0.74rem',
                color: 'var(--color-error-text, var(--color-error))',
              }}
            >
              <span>{fetchError}</span>
              <button
                type="button"
                onClick={triggerReload}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0,
                  fontSize: '0.74rem',
                }}
              >
                Thử lại
              </button>
            </div>
          )}

          {/* Notification List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {loading && visibleNotifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                Đang tải thông báo...
              </div>
            ) : fetchError && visibleNotifications.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: '0.8rem' }}>
                <div style={{ color: 'var(--color-error-text, var(--color-error))', fontWeight: 700, marginBottom: 10 }}>
                  {fetchError}
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={triggerReload}
                  style={{ padding: '5px 14px', fontSize: '0.76rem', fontWeight: 700, borderRadius: 4 }}
                >
                  Thử lại
                </button>
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, marginBottom: 8 }}>
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                <div>Chưa có thông báo nào trong mục này</div>
              </div>
            ) : (
              visibleNotifications.map((item) => {
                const baseBg = item.isRead
                  ? 'transparent'
                  : 'color-mix(in srgb, var(--color-primary) 6%, transparent)';
                return (
                  <div
                    key={item._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleItemClick(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleItemClick(item);
                      }
                    }}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--color-border)',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      cursor: 'pointer',
                      background: baseBg,
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-surface-elevated)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = baseBg;
                    }}
                  >
                    {renderIcon(item.type, item.category)}

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
                              onClick={(e) => void handleMarkItemRead(e, item)}
                              title="Đánh dấu đã đọc"
                              aria-label="Đánh dấu đã đọc"
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
                            onClick={(e) => void handleDeleteItem(e, item)}
                            title="Xóa thông báo"
                            aria-label="Xóa thông báo"
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
                );
              })
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--color-border)',
              textAlign: 'center',
              background: 'var(--color-bg-main)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigateNotificationLink('/notifications', onNavigate);
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
              <span>Xem tất cả thông báo</span>
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
