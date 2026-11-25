import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { HubViewId, UserProfile } from '../../types.js';
import { mockTrails } from '../../data/seedData.js';
import {
  VIETNAM_SUMMIT_CHALLENGES,
  VIETNAM_RANGER_STATIONS,
} from '../../data/vietnamDirectory.js';
import { isHubView } from '../../utils/routing.js';
import { ThemeToggle } from '../common/ThemeToggle.js';
import { NotificationBell } from '../notifications/NotificationBell.js';
import { fetchConversations } from '../../services/messageService.js';
import { useSocketConnection } from '../../context/SocketContext.js';
import { isTopmostFocusTrap, useFocusTrap } from '../../hooks/useFocusTrap.js';
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator.js';
import {
  IconShieldCheck,
  IconTree,
  IconStar,
  IconMountain,
  IconCalendar,
  IconCompass,
  IconHiking,
  IconSatellite,
  IconBackpack,
  IconRadar,
  IconSearch,
  IconX,
  IconAlertTriangle,
  IconMail,
  IconUser,
  IconPlus,
  IconMessageSquare,
  IconRadio,
  IconHelpCircle,
} from '../common/SvgIcons.js';

interface NavbarProps {
  currentView: string;
  currentUser?: UserProfile | null;
  searchQuery?: string;
  trailsCount?: number;
  onNavigate: (view: string) => void;
  onOpenIncidentModal: () => void;
  onOpenAuthModal: () => void;
  onSearchChange: (search: string) => void;
  onLogout?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenLiveTracker?: () => void;
  onOpenShortcuts?: () => void;
}

interface HubMenuItem {
  id: HubViewId;
  label: string;
  desc: string;
  renderIcon: (color: string) => React.ReactNode;
}

function buildPlanningHubItems(trailsCount: number, challengesCount: number): readonly HubMenuItem[] {
  return [
    {
      id: 'passport',
      label: 'Hộ chiếu đỉnh núi',
      desc: `Dấu chân qua ${trailsCount} cung đường & ${challengesCount} thử thách`,
      renderIcon: (color) => <IconMountain size={16} color={color} />,
    },
    {
      id: 'almanac',
      label: 'Lịch mùa 12 tháng',
      desc: 'Canh biển mây, mùa hoa rừng & tránh mùa lũ',
      renderIcon: (color) => <IconCalendar size={16} color={color} />,
    },
    {
      id: 'planner',
      label: 'Vẽ GPX & đo độ dốc',
      desc: 'Chấm cung trên địa hình DEM & ước lượng giờ đi',
      renderIcon: (color) => <IconCompass size={16} color={color} />,
    },
    {
      id: 'training',
      label: 'Rèn sức trước chuyến đi',
      desc: 'Lộ trình 4–8 tuần tập sức bền cho từng đỉnh',
      renderIcon: (color) => <IconHiking size={16} color={color} />,
    },
  ];
}

function buildFieldSafetyHubItems(rangersCount: number): readonly HubMenuItem[] {
  return [
    {
      id: 'toolkit',
      label: 'Đồ nghề đi rừng offline',
      desc: 'La bàn, giờ mặt trời, ước tính nước & SOS',
      renderIcon: (color) => <IconSatellite size={16} color={color} />,
    },
    {
      id: 'gear',
      label: 'Cân balo & tủ đồ',
      desc: 'Cân lại đồ mang theo để đôi vai nhẹ hơn',
      renderIcon: (color) => <IconBackpack size={16} color={color} />,
    },
    {
      id: 'directory',
      label: 'Kiểm lâm, porter & chi phí',
      desc: `${rangersCount} trạm VQG thực tế & bảng dự trù VNĐ`,
      renderIcon: (color) => <IconShieldCheck size={16} color={color} />,
    },
    {
      id: 'radar',
      label: 'Tin cảnh báo trên tuyến',
      desc: 'Sạt lở, suối dâng & tình trạng đường đi',
      renderIcon: (color) => <IconRadar size={16} color={color} />,
    },
  ];
}

const NavbarBase: React.FC<NavbarProps> = ({
  currentView,
  currentUser,
  searchQuery,
  trailsCount,
  onNavigate,
  onOpenIncidentModal,
  onOpenAuthModal,
  onSearchChange,
  onLogout,
  onOpenCommandPalette,
  onOpenLiveTracker,
  onOpenShortcuts,
}) => {
  const effectiveTrailsCount = trailsCount && trailsCount > 0 ? trailsCount : mockTrails.length;
  const challengesCount = VIETNAM_SUMMIT_CHALLENGES.length;
  const rangersCount = VIETNAM_RANGER_STATIONS.length;
  const PLANNING_HUB_ITEMS = useMemo(
    () => buildPlanningHubItems(effectiveTrailsCount, challengesCount),
    [effectiveTrailsCount, challengesCount]
  );
  const FIELD_SAFETY_HUB_ITEMS = useMemo(
    () => buildFieldSafetyHubItems(rangersCount),
    [rangersCount]
  );
  const [internalSearch, setInternalSearch] = useState(searchQuery || '');
  const [unreadMessageCount, setUnreadMessageCount] = useState<number>(0);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [failedAvatarSrc, setFailedAvatarSrc] = useState<string | null>(null);
  const [isHubMenuOpen, setIsHubMenuOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const mobileDrawerCloseBtnRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(isMobileDrawerOpen, mobileDrawerRef, {
    initialFocusRef: mobileDrawerCloseBtnRef,
  });

  // Strict LIFO Escape handler for Mobile Drawer (only closes when drawer is the topmost focus trap)
  useEffect(() => {
    if (!isMobileDrawerOpen) return;
    const handleDrawerEscape = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (!isTopmostFocusTrap(mobileDrawerRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleDrawerEscape);
    return () => window.removeEventListener('keydown', handleDrawerEscape);
  }, [isMobileDrawerOpen]);
  const [isCompactViewport, setIsCompactViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 960px)').matches : false
  );

  const userMenuRef = useRef<HTMLDivElement>(null);
  const hubMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { socket, isConnected } = useSocketConnection();

  const currentUserId = currentUser?.id || '';
  const effectiveSearch = searchQuery !== undefined ? searchQuery : internalSearch;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 960px)');
    const onChange = (e: MediaQueryListEvent) => {
      setIsCompactViewport(e.matches);
      if (!e.matches) setIsMobileDrawerOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Fetch unread message count only when auth identity changes or socket emits message events
  useEffect(() => {
    let active = true;
    const refreshUnread = async () => {
      if (!currentUserId) {
        if (active) setUnreadMessageCount(0);
        return;
      }
      try {
        const convs = await fetchConversations();
        if (!active) return;
        const totalUnread = convs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
        setUnreadMessageCount(totalUnread);
      } catch {
        // Keep existing badge count on transient network errors
      }
    };

    void refreshUnread();

    const handleSocketUpdate = () => {
      void refreshUnread();
    };
    window.addEventListener('lost:messages-unread-changed', handleSocketUpdate);
    if (socket) {
      socket.on('newMessage', handleSocketUpdate);
      socket.on('messageRead', handleSocketUpdate);
      socket.on('messagesRead', handleSocketUpdate);
    }
    return () => {
      active = false;
      window.removeEventListener('lost:messages-unread-changed', handleSocketUpdate);
      if (socket) {
        socket.off('newMessage', handleSocketUpdate);
        socket.off('messageRead', handleSocketUpdate);
        socket.off('messagesRead', handleSocketUpdate);
      }
    };
  }, [socket, currentUserId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
      if (hubMenuRef.current && !hubMenuRef.current.contains(target)) {
        setIsHubMenuOpen(false);
      }
    };

    const isEditableElement = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (target.isContentEditable) return true;
      return Boolean(target.closest('[contenteditable="true"]'));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;

      const hasModalOpen = Boolean(document.querySelector('[aria-modal="true"]'));

      if (e.key === 'Escape') {
        if (hasModalOpen) return;
        setIsUserMenuOpen(false);
        setIsHubMenuOpen(false);
        return;
      }

      if (
        e.key === '/' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !hasModalOpen &&
        !isEditableElement(e.target) &&
        !isEditableElement(document.activeElement)
      ) {
        if (searchInputRef.current) {
          e.preventDefault();
          searchInputRef.current.focus();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSearchInput = (val: string) => {
    setInternalSearch(val);
    onSearchChange(val);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(effectiveSearch);
    setIsMobileDrawerOpen(false);
    if (currentView !== 'explore' && currentView !== 'home') {
      onNavigate('home');
    }
  };

  const handleNavigateAndClose = useCallback(
    (target: string) => {
      setIsHubMenuOpen(false);
      setIsUserMenuOpen(false);
      setIsMobileDrawerOpen(false);
      onNavigate(target);
    },
    [onNavigate]
  );

  const isAdmin = Boolean(currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator'));
  const isHubActive = isHubView(currentView);
  const activeNavKey =
    currentView === 'home' || currentView === 'explore'
      ? 'home'
      : currentView === 'forum'
        ? 'forum'
        : isHubActive || isHubMenuOpen
          ? 'hub'
          : currentView === 'contribute'
            ? 'contribute'
            : '__none__';
  const { trackRef: navTrackRef, indicatorStyle: navIndicatorStyle } =
    useSlidingIndicator<string>(`${activeNavKey}-${isCompactViewport ? 'm' : 'd'}`);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-navbar, 1000)' as unknown as number,
        padding: isCompactViewport ? '0 14px' : '0 24px',
        height: 62,
        display: 'flex',
        alignItems: 'center',
        background: 'var(--color-bg-hud)',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-header)',
      }}
    >
      <div
        style={{
          maxWidth: 1360,
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: isCompactViewport ? 10 : 14,
          minWidth: 0,
        }}
      >
        {/* LEFT ZONE: Editorial Wordmark & 4-Item Desktop Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isCompactViewport ? 10 : 22, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => handleNavigateAndClose('home')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              padding: 0,
            }}
            title={isConnected ? 'LOST — Về trang chủ (Đang kết nối)' : 'LOST — Về trang chủ'}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9.5" />
              <polygon points="15.8 8.2 13.7 13.7 8.2 15.8 10.3 10.3 15.8 8.2" fill="var(--color-primary)" fillOpacity="0.22" />
            </svg>
            <span
              style={{
                fontSize: '1.2rem',
                fontWeight: 900,
                color: 'var(--color-text-main)',
                letterSpacing: '0.06em',
                fontFamily: 'var(--font-family)',
              }}
            >
              LOST<span style={{ color: 'var(--color-primary)' }}>.</span>
            </span>
          </button>

          {/* Clean 4-Item Desktop Navigation with Gliding Active Frame */}
          {!isCompactViewport && (
            <nav
              ref={navTrackRef}
              aria-label="Điều hướng chính"
              className="lost-glider-track"
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <span
                aria-hidden="true"
                className="lost-glider-pill with-accent"
                style={navIndicatorStyle}
              />
              <button
                type="button"
                data-glider-active={activeNavKey === 'home' ? 'true' : undefined}
                className="lost-glider-item"
                onClick={() => handleNavigateAndClose('home')}
                style={{
                  padding: '6px 11px',
                  borderRadius: 4,
                  fontSize: '0.84rem',
                  fontWeight: currentView === 'home' || currentView === 'explore' ? 700 : 500,
                  cursor: 'pointer',
                  border: 'none',
                  background: 'transparent',
                  color:
                    currentView === 'home' || currentView === 'explore'
                      ? 'var(--color-text-main)'
                      : 'var(--color-text-muted)',
                  transition: 'color 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                Khám phá
              </button>

              <button
                type="button"
                data-glider-active={activeNavKey === 'forum' ? 'true' : undefined}
                className="lost-glider-item"
                onClick={() => handleNavigateAndClose('forum')}
                style={{
                  padding: '6px 11px',
                  borderRadius: 4,
                  fontSize: '0.84rem',
                  fontWeight: currentView === 'forum' ? 700 : 500,
                  cursor: 'pointer',
                  border: 'none',
                  background: 'transparent',
                  color: currentView === 'forum' ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                  transition: 'color 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                Diễn đàn
              </button>

              {/* 8-Hub Field-Atlas Dropdown */}
              <div style={{ position: 'relative' }} ref={hubMenuRef} className="lost-glider-item">
                <button
                  type="button"
                  data-glider-active={activeNavKey === 'hub' ? 'true' : undefined}
                  onClick={() => setIsHubMenuOpen((prev) => !prev)}
                  aria-expanded={isHubMenuOpen}
                  aria-haspopup="menu"
                  style={{
                    padding: '6px 11px',
                    borderRadius: 4,
                    fontSize: '0.84rem',
                    fontWeight: isHubActive || isHubMenuOpen ? 700 : 500,
                    cursor: 'pointer',
                    border: '1px solid transparent',
                    background: 'transparent',
                    color: isHubActive ? 'var(--color-primary)' : 'var(--color-text-main)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'color 0.2s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>Công cụ &amp; Hộ chiếu</span>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: isHubMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.22s var(--ease-out-expo)',
                    }}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {isHubMenuOpen && (
                  <div
                    role="menu"
                    className="dropdown-center-pop"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 10px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 'min(580px, calc(100vw - 32px))',
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border-strong)',
                      borderRadius: 6,
                      boxShadow: 'var(--shadow-3d)',
                      padding: 16,
                      zIndex: 'var(--z-dropdown, 1100)' as unknown as number,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 14,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.09em',
                          color: 'var(--color-primary)',
                          padding: '0 8px 8px 8px',
                          borderBottom: '1px solid var(--color-border)',
                          marginBottom: 8,
                        }}
                      >
                        Chuẩn bị chuyến đi
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {PLANNING_HUB_ITEMS.map((hub) => {
                          const active = currentView === hub.id;
                          return (
                            <button
                              key={hub.id}
                              type="button"
                              role="menuitem"
                              onClick={() => handleNavigateAndClose(hub.id)}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '9px 10px',
                                borderRadius: 4,
                                border: active
                                  ? '1px solid color-mix(in srgb, var(--color-primary) 42%, transparent)'
                                  : '1px solid transparent',
                                background: active
                                  ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
                                  : 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 10,
                                transition: 'background-color 0.14s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!active) e.currentTarget.style.background = 'var(--color-surface-elevated)';
                              }}
                              onMouseLeave={(e) => {
                                if (!active) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <span
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 4,
                                  background: active
                                    ? 'color-mix(in srgb, var(--color-primary) 18%, transparent)'
                                    : 'var(--color-bg-main)',
                                  border: '1px solid var(--color-border)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  marginTop: 1,
                                }}
                              >
                                {hub.renderIcon(active ? 'var(--color-primary)' : 'var(--color-text-muted)')}
                              </span>
                              <span style={{ minWidth: 0 }}>
                                <span
                                  style={{
                                    display: 'block',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    color: active ? 'var(--color-primary)' : 'var(--color-text-main)',
                                    lineHeight: 1.25,
                                  }}
                                >
                                  {hub.label}
                                </span>
                                <span
                                  style={{
                                    display: 'block',
                                    fontSize: '0.72rem',
                                    color: 'var(--color-text-dim)',
                                    marginTop: 2,
                                    lineHeight: 1.35,
                                  }}
                                >
                                  {hub.desc}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.09em',
                          color: 'var(--color-earth)',
                          padding: '0 8px 8px 8px',
                          borderBottom: '1px solid var(--color-border)',
                          marginBottom: 8,
                        }}
                      >
                        An toàn trên rừng
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {FIELD_SAFETY_HUB_ITEMS.map((hub) => {
                          const active = currentView === hub.id;
                          return (
                            <button
                              key={hub.id}
                              type="button"
                              role="menuitem"
                              onClick={() => handleNavigateAndClose(hub.id)}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '9px 10px',
                                borderRadius: 4,
                                border: active
                                  ? '1px solid color-mix(in srgb, var(--color-primary) 42%, transparent)'
                                  : '1px solid transparent',
                                background: active
                                  ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
                                  : 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 10,
                                transition: 'background-color 0.14s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!active) e.currentTarget.style.background = 'var(--color-surface-elevated)';
                              }}
                              onMouseLeave={(e) => {
                                if (!active) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <span
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 4,
                                  background: active
                                    ? 'color-mix(in srgb, var(--color-primary) 18%, transparent)'
                                    : 'var(--color-bg-main)',
                                  border: '1px solid var(--color-border)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  marginTop: 1,
                                }}
                              >
                                {hub.renderIcon(active ? 'var(--color-primary)' : 'var(--color-text-muted)')}
                              </span>
                              <span style={{ minWidth: 0 }}>
                                <span
                                  style={{
                                    display: 'block',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    color: active ? 'var(--color-primary)' : 'var(--color-text-main)',
                                    lineHeight: 1.25,
                                  }}
                                >
                                  {hub.label}
                                </span>
                                <span
                                  style={{
                                    display: 'block',
                                    fontSize: '0.72rem',
                                    color: 'var(--color-text-dim)',
                                    marginTop: 2,
                                    lineHeight: 1.35,
                                  }}
                                >
                                  {hub.desc}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Featured Full-Width Live Field GPS Computer Launcher */}
                    {onOpenLiveTracker && (
                      <div
                        style={{
                          gridColumn: '1 / -1',
                          paddingTop: 12,
                          borderTop: '1px solid var(--color-border)',
                        }}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsHubMenuOpen(false);
                            onOpenLiveTracker();
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 4,
                            border: '1px solid color-mix(in srgb, var(--color-primary) 42%, transparent)',
                            background: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-main))',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <span
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 4,
                                background: 'var(--color-primary)',
                                color: 'var(--color-on-primary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <IconRadio size={16} color="var(--color-on-primary)" />
                            </span>
                            <span style={{ minWidth: 0 }}>
                              <span
                                style={{
                                  display: 'block',
                                  fontSize: '0.83rem',
                                  fontWeight: 800,
                                  color: 'var(--color-text-main)',
                                }}
                              >
                                Ghi hành trình trực tiếp (Live GPS)
                              </span>
                              <span
                                style={{
                                  display: 'block',
                                  fontSize: '0.72rem',
                                  color: 'var(--color-text-muted)',
                                }}
                              >
                                Ghi lại đường đi thật, báo lệch cung &gt;100m, đánh dấu mốc &amp; xuất GPX
                              </span>
                            </span>
                          </span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              color: 'var(--color-primary)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              flexShrink: 0,
                            }}
                          >
                            Mở ngay →
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                data-glider-active={activeNavKey === 'contribute' ? 'true' : undefined}
                className="lost-glider-item"
                onClick={() => handleNavigateAndClose('contribute')}
                style={{
                  padding: '6px 11px',
                  borderRadius: 4,
                  fontSize: '0.84rem',
                  fontWeight: currentView === 'contribute' ? 700 : 500,
                  cursor: 'pointer',
                  border: 'none',
                  background: 'transparent',
                  color: currentView === 'contribute' ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                  transition: 'color 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                Đóng góp
              </button>
            </nav>
          )}
        </div>

        {/* MIDDLE ZONE: Quiet Search Bar + Ctrl+K Quick Palette Pill (Desktop) */}
        {!isCompactViewport && (
          <div style={{ flex: 1, maxWidth: 360, minWidth: 160, margin: '0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <form onSubmit={handleSearchSubmit} style={{ flex: 1, minWidth: 0 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <IconSearch
                  size={14}
                  color="var(--color-text-dim)"
                  style={{ position: 'absolute', left: 11, pointerEvents: 'none' }}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  aria-label="Tìm kiếm cung đường, đỉnh núi"
                  placeholder="Tìm cung đường, đỉnh núi..."
                  value={effectiveSearch}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    padding: '7px 32px 7px 32px',
                    color: 'var(--color-text-main)',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
                {effectiveSearch ? (
                  <button
                    type="button"
                    onClick={() => handleSearchInput('')}
                    title="Xóa tìm kiếm"
                    aria-label="Xóa tìm kiếm"
                    style={{
                      position: 'absolute',
                      right: 8,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-text-dim)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 2,
                    }}
                  >
                    <IconX size={14} />
                  </button>
                ) : (
                  <span className="kbd-shortcut" style={{ position: 'absolute', right: 10 }}>
                    /
                  </span>
                )}
              </div>
            </form>

            {onOpenCommandPalette && (
              <button
                type="button"
                onClick={onOpenCommandPalette}
                title="Mở tìm kiếm nhanh (Ctrl+K)"
                aria-label="Mở tìm kiếm nhanh Ctrl+K"
                style={{
                  height: 34,
                  padding: '0 9px',
                  borderRadius: 4,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-elevated)',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                <IconSearch size={12} color="var(--color-primary)" />
                <span>Ctrl+K</span>
              </button>
            )}
          </div>
        )}

        {/* RIGHT ZONE: Desktop Actions OR Compact Mobile Controls */}
        {isCompactViewport ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <NotificationBell currentUser={currentUser || null} onNavigate={handleNavigateAndClose} />
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="btn btn-outline"
              aria-label="Mở menu điều hướng"
              style={{
                width: 38,
                height: 36,
                padding: 0,
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              {unreadMessageCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -3,
                    right: -3,
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: 'var(--color-error)',
                  }}
                />
              )}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={onOpenIncidentModal}
              title="Gửi báo cáo nguy hiểm, sạt lở hoặc thời tiết xấu đang xảy ra"
              style={{
                fontSize: '0.78rem',
                padding: '7px 12px',
                borderRadius: 4,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                background: 'color-mix(in srgb, var(--color-error) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-error) 36%, transparent)',
                color: 'var(--color-error-text, var(--color-error))',
                whiteSpace: 'nowrap',
              }}
            >
              <IconAlertTriangle size={14} color="var(--color-error-text, var(--color-error))" />
              <span>Báo sự cố</span>
            </button>

            <div style={{ width: 1, height: 22, background: 'var(--color-border)', margin: '0 2px' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {currentUser && (
                <button
                  type="button"
                  className={`btn ${currentView === 'messages' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => handleNavigateAndClose('messages')}
                  style={{
                    position: 'relative',
                    width: 36,
                    height: 36,
                    padding: 0,
                    borderRadius: 4,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Tin nhắn"
                  aria-label="Tin nhắn"
                >
                  <IconMail size={16} />
                  {unreadMessageCount > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        background: 'var(--color-error)',
                        color: 'var(--color-on-danger)',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        borderRadius: 4,
                        padding: '2px 5px',
                        lineHeight: 1,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                    </span>
                  )}
                </button>
              )}

              <NotificationBell currentUser={currentUser || null} onNavigate={handleNavigateAndClose} />
              <ThemeToggle />
              {onOpenShortcuts && (
                <button
                  type="button"
                  onClick={onOpenShortcuts}
                  title="Xem bảng phím tắt (?)"
                  aria-label="Mở bảng phím tắt"
                  style={{
                    width: 34,
                    height: 36,
                    borderRadius: 4,
                    background: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border-strong)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                    color: 'var(--color-text-muted)',
                    flexShrink: 0,
                  }}
                >
                  <IconHelpCircle size={16} />
                </button>
              )}
            </div>

            <div style={{ width: 1, height: 22, background: 'var(--color-border)', margin: '0 2px' }} />

            {/* Account Dropdown */}
            <div style={{ position: 'relative' }} ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="btn btn-outline"
                style={{
                  padding: currentUser ? '4px 8px' : '7px 14px',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  borderColor: isUserMenuOpen ? 'var(--color-primary)' : 'var(--color-border)',
                  background: isUserMenuOpen ? 'var(--color-surface-elevated)' : 'var(--color-bg-card)',
                }}
                aria-label="Mở menu tài khoản"
                aria-expanded={isUserMenuOpen}
                title={currentUser ? currentUser.fullName || currentUser.username : 'Tài khoản LOST'}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
                {currentUser ? (
                  (currentUser.avatarUrl || currentUser.avatar) &&
                  failedAvatarSrc !== (currentUser.avatarUrl || currentUser.avatar) ? (
                    <img
                      src={currentUser.avatarUrl || currentUser.avatar}
                      alt={currentUser.fullName}
                      decoding="async"
                      onError={() => setFailedAvatarSrc(currentUser.avatarUrl || currentUser.avatar || null)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '1.5px solid var(--color-primary)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        color: 'var(--color-on-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                      }}
                    >
                      {currentUser.fullName ? currentUser.fullName.charAt(0) : 'T'}
                    </div>
                  )
                ) : (
                  <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Tài khoản</span>
                )}
              </button>

              {isUserMenuOpen && (
                <div
                  className="dropdown-menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 10px)',
                    right: 0,
                    width: 278,
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: 6,
                    boxShadow: 'var(--shadow-3d)',
                    padding: 10,
                    zIndex: 'var(--z-dropdown, 1100)' as unknown as number,
                  }}
                >
                  {currentUser ? (
                    <>
                      <div
                        style={{
                          padding: '12px 14px',
                          background: 'var(--color-bg-main)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 4,
                          marginBottom: 10,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        {(currentUser.avatarUrl || currentUser.avatar) &&
                        failedAvatarSrc !== (currentUser.avatarUrl || currentUser.avatar) ? (
                          <img
                            src={currentUser.avatarUrl || currentUser.avatar}
                            alt={currentUser.fullName}
                            decoding="async"
                            onError={() => setFailedAvatarSrc(currentUser.avatarUrl || currentUser.avatar || null)}
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '2px solid var(--color-primary)',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: '50%',
                              background: 'var(--color-primary)',
                              color: 'var(--color-on-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.05rem',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              flexShrink: 0,
                            }}
                          >
                            {currentUser.fullName ? currentUser.fullName.charAt(0) : 'T'}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: '0.9rem',
                              color: 'var(--color-text-main)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {currentUser.fullName || currentUser.username}
                          </div>
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--color-text-dim)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              marginTop: 1,
                            }}
                          >
                            {currentUser.email}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: 4,
                                background: isAdmin
                                  ? 'color-mix(in srgb, var(--color-sun) 16%, transparent)'
                                  : 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
                                color: isAdmin ? 'var(--color-sun)' : 'var(--color-primary)',
                                border: isAdmin
                                  ? '1px solid color-mix(in srgb, var(--color-sun) 40%, transparent)'
                                  : '1px solid var(--color-border-glow)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              {isAdmin ? (
                                <>
                                  <IconShieldCheck size={12} color="var(--color-sun)" /> Quản trị viên
                                </>
                              ) : (
                                <>
                                  <IconTree size={12} color="var(--color-primary)" /> Trekker
                                </>
                              )}
                            </span>
                            <span
                              style={{
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: 4,
                                background: 'color-mix(in srgb, var(--color-sun) 14%, transparent)',
                                color: 'var(--color-sun)',
                                border: '1px solid color-mix(in srgb, var(--color-sun) 32%, transparent)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              <IconStar size={11} color="var(--color-sun)" fill="var(--color-sun)" />{' '}
                              {currentUser.reputationScore ?? 0} điểm
                            </span>
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '4px 8px 4px 8px',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          color: 'var(--color-text-dim)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        Tài khoản của tôi
                      </div>

                      {[
                        { id: 'profile', label: 'Hồ sơ & nhật ký leo núi', icon: <IconUser size={15} /> },
                        { id: 'passport', label: `Hộ chiếu ${effectiveTrailsCount} cung đường`, icon: <IconMountain size={15} /> },
                        { id: 'contribute', label: 'Gửi cung đường mới', icon: <IconPlus size={15} /> },
                        { id: 'forum', label: 'Diễn đàn & tìm bạn đồng hành', icon: <IconMessageSquare size={15} /> },
                      ].map((item) => {
                        const active = currentView === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleNavigateAndClose(item.id)}
                            className="interactive-click"
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: 4,
                              border: 'none',
                              background: active
                                ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)'
                                : 'transparent',
                              color: active ? 'var(--color-primary)' : 'var(--color-text-main)',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              transition: 'background-color 0.16s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background =
                                'color-mix(in srgb, var(--color-primary) 10%, transparent)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = active
                                ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)'
                                : 'transparent';
                            }}
                          >
                            {item.icon}
                            <span>{item.label}</span>
                          </button>
                        );
                      })}

                      {isAdmin && (
                        <>
                          <div style={{ height: 1, background: 'var(--color-border)', margin: '6px 0' }} />
                          <div
                            style={{
                              padding: '4px 8px 4px 8px',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              color: 'var(--color-sun)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                            }}
                          >
                            Quản trị
                          </div>
                          <button
                            type="button"
                            onClick={() => handleNavigateAndClose('admin')}
                            className="interactive-click"
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: 4,
                              border: '1px solid color-mix(in srgb, var(--color-sun) 38%, transparent)',
                              background:
                                currentView === 'admin'
                                  ? 'color-mix(in srgb, var(--color-sun) 18%, transparent)'
                                  : 'color-mix(in srgb, var(--color-sun) 8%, transparent)',
                              color: 'var(--color-sun)',
                              fontSize: '0.82rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              transition: 'background-color 0.16s ease',
                            }}
                          >
                            <IconShieldCheck size={15} color="var(--color-sun)" />
                            <span>Trang quản trị</span>
                          </button>
                        </>
                      )}

                      <div style={{ height: 1, background: 'var(--color-border)', margin: '6px 0' }} />

                      {onLogout && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onLogout();
                          }}
                          className="interactive-click"
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 4,
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--color-error-text, var(--color-error))',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            transition: 'background-color 0.16s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background =
                              'color-mix(in srgb, var(--color-error) 10%, transparent)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                          </svg>
                          <span>Đăng xuất</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <div style={{ padding: '8px 4px' }}>
                      <div style={{ padding: '6px 8px 12px 8px', textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: '0.9rem',
                            fontWeight: 800,
                            color: 'var(--color-text-main)',
                            marginBottom: 4,
                          }}
                        >
                          Lên núi cùng LOST
                        </div>
                        <div
                          style={{
                            fontSize: '0.74rem',
                            color: 'var(--color-text-muted)',
                            lineHeight: 1.45,
                          }}
                        >
                          Đăng nhập để lưu dấu {effectiveTrailsCount} cung đường, giữ lịch trình GPX, cân balo và rủ thêm bạn cùng nhịp chân.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenAuthModal();
                        }}
                        className="btn btn-primary"
                        style={{
                          width: '100%',
                          padding: '9px 14px',
                          borderRadius: 4,
                          fontSize: '0.84rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                        }}
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                          <polyline points="10 17 15 12 10 7" />
                          <line x1="15" y1="12" x2="3" y2="12" />
                        </svg>
                        <span>Đăng nhập / Đăng ký</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* RESPONSIVE MOBILE SLIDE-OVER DRAWER (< 960px) */}
      {isMobileDrawerOpen &&
        createPortal(
          <div
            className="drawer-backdrop-in"
            onClick={() => setIsMobileDrawerOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 'var(--z-drawer, 2000)' as unknown as number,
              background: 'var(--overlay-bg)',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <aside
              ref={mobileDrawerRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label="Menu điều hướng LOST"
              className="drawer-slide-right"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 'min(340px, 88vw)',
                height: '100%',
                background: 'var(--color-bg-card)',
                borderLeft: '1px solid var(--color-border-strong)',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                padding: '16px 16px 24px 16px',
                gap: 14,
                boxShadow: 'var(--shadow-3d)',
                outline: 'none',
              }}
            >
              {/* Drawer Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: 12,
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <span
                  style={{
                    fontSize: '1.08rem',
                    fontWeight: 900,
                    letterSpacing: '0.06em',
                    color: 'var(--color-text-main)',
                  }}
                >
                  LOST<span style={{ color: 'var(--color-primary)' }}>.</span> MENU
                </span>
                <button
                  ref={mobileDrawerCloseBtnRef}
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  aria-label="Đóng menu"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 4,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-main)',
                    color: 'var(--color-text-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <IconX size={16} />
                </button>
              </div>

              {/* Mobile Search + Command Palette Quick Trigger */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <form onSubmit={handleSearchSubmit}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <IconSearch
                      size={14}
                      color="var(--color-text-dim)"
                      style={{ position: 'absolute', left: 10, pointerEvents: 'none' }}
                    />
                    <input
                      type="text"
                      aria-label="Tìm kiếm cung đường, đỉnh núi trên di động"
                      placeholder="Tìm cung đường, đỉnh núi..."
                      value={effectiveSearch}
                      onChange={(e) => handleSearchInput(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--color-surface-elevated)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 4,
                        padding: '8px 32px 8px 32px',
                        color: 'var(--color-text-main)',
                        fontSize: '0.84rem',
                        outline: 'none',
                      }}
                    />
                    {effectiveSearch && (
                      <button
                        type="button"
                        onClick={() => handleSearchInput('')}
                        aria-label="Xóa tìm kiếm"
                        style={{
                          position: 'absolute',
                          right: 8,
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--color-text-dim)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                        }}
                      >
                        <IconX size={14} />
                      </button>
                    )}
                  </div>
                </form>

                {onOpenCommandPalette && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      onOpenCommandPalette();
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 4,
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg-main)',
                      color: 'var(--color-text-muted)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <IconSearch size={13} color="var(--color-primary)" />
                      <span>Tìm cung, công cụ, kiểm lâm &amp; AI</span>
                    </span>
                    <span className="kbd-shortcut">Ctrl+K</span>
                  </button>
                )}

                {onOpenLiveTracker && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      onOpenLiveTracker();
                    }}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      borderRadius: 4,
                      border: '1px solid color-mix(in srgb, var(--color-primary) 42%, transparent)',
                      background: 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-main))',
                      color: 'var(--color-primary)',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <IconRadio size={15} color="var(--color-primary)" />
                    <span>Ghi hành trình trực tiếp (Live GPS)</span>
                  </button>
                )}
              </div>

              {/* Main Navigation */}
              <div>
                <div
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--color-text-dim)',
                    marginBottom: 6,
                  }}
                >
                  Điều hướng chính
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    { id: 'home', label: 'Khám phá bản đồ' },
                    { id: 'forum', label: 'Diễn đàn & tìm bạn' },
                    { id: 'contribute', label: 'Gửi cung đường mới' },
                    ...(currentUser
                      ? [
                        {
                          id: 'messages',
                          label:
                            unreadMessageCount > 0
                              ? `Tin nhắn (${unreadMessageCount > 99 ? '99+' : unreadMessageCount})`
                              : 'Tin nhắn',
                        },
                        { id: 'profile', label: 'Hồ sơ của tôi' },
                        ...(isAdmin ? [{ id: 'admin', label: 'Trang quản trị' }] : []),
                      ]
                      : []),
                  ].map((item) => {
                    const active =
                      currentView === item.id || (item.id === 'home' && currentView === 'explore');
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigateAndClose(item.id)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '9px 10px',
                          borderRadius: 4,
                          border: active
                            ? '1px solid color-mix(in srgb, var(--color-primary) 42%, transparent)'
                            : '1px solid transparent',
                          background: active
                            ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
                            : 'var(--color-bg-main)',
                          color: active ? 'var(--color-primary)' : 'var(--color-text-main)',
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* All 8 Flagship Hubs */}
              <div>
                <div
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--color-primary)',
                    marginBottom: 6,
                  }}
                >
                  Chuẩn bị chuyến đi
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {PLANNING_HUB_ITEMS.map((hub) => {
                    const active = currentView === hub.id;
                    return (
                      <button
                        key={hub.id}
                        type="button"
                        onClick={() => handleNavigateAndClose(hub.id)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderRadius: 4,
                          border: active
                            ? '1px solid color-mix(in srgb, var(--color-primary) 42%, transparent)'
                            : '1px solid var(--color-border)',
                          background: active
                            ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
                            : 'var(--color-bg-main)',
                          color: active ? 'var(--color-primary)' : 'var(--color-text-main)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                        }}
                      >
                        {hub.renderIcon(active ? 'var(--color-primary)' : 'var(--color-text-muted)')}
                        <span>{hub.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--color-earth)',
                    marginBottom: 6,
                  }}
                >
                  An toàn trên rừng
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {FIELD_SAFETY_HUB_ITEMS.map((hub) => {
                    const active = currentView === hub.id;
                    return (
                      <button
                        key={hub.id}
                        type="button"
                        onClick={() => handleNavigateAndClose(hub.id)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderRadius: 4,
                          border: active
                            ? '1px solid color-mix(in srgb, var(--color-primary) 42%, transparent)'
                            : '1px solid var(--color-border)',
                          background: active
                            ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
                            : 'var(--color-bg-main)',
                          color: active ? 'var(--color-primary)' : 'var(--color-text-main)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                        }}
                      >
                        {hub.renderIcon(active ? 'var(--color-primary)' : 'var(--color-text-muted)')}
                        <span>{hub.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SOS & Account Footer */}
              <div
                style={{
                  marginTop: 'auto',
                  paddingTop: 12,
                  borderTop: '1px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    onOpenIncidentModal();
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 4,
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    background: 'color-mix(in srgb, var(--color-error) 12%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-error) 36%, transparent)',
                    color: 'var(--color-error-text, var(--color-error))',
                  }}
                >
                  <IconAlertTriangle size={15} color="var(--color-error-text, var(--color-error))" />
                  <span>Báo sự cố trên tuyến</span>
                </button>

                {currentUser ? (
                  onLogout && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => {
                        setIsMobileDrawerOpen(false);
                        onLogout();
                      }}
                      style={{ width: '100%', borderRadius: 4, color: 'var(--color-error-text, var(--color-error))' }}
                    >
                      Đăng xuất ({currentUser.fullName || currentUser.username})
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      onOpenAuthModal();
                    }}
                    style={{ width: '100%', borderRadius: 4 }}
                  >
                    Đăng nhập / Đăng ký
                  </button>
                )}
              </div>
            </aside>
          </div>,
          document.body
        )}
    </header>
  );
};

export const Navbar = React.memo(NavbarBase);
