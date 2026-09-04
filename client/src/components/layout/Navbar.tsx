import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { UserProfile } from '../../types.js';
import { ThemeToggle } from '../common/ThemeToggle.js';
import { NotificationBell } from '../notifications/NotificationBell.js';
import { fetchConversations } from '../../services/messageService.js';
import { useSocket } from '../../hooks/useSocket.js';
import { IconShieldCheck, IconTree, IconStar } from '../common/SvgIcons.js';

interface NavbarProps {
  currentView: string;
  currentUser?: UserProfile | null;
  onNavigate: (view: string) => void;
  onOpenIncidentModal: () => void;
  onOpenAuthModal: () => void;
  onSearchChange: (search: string) => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  currentUser,
  onNavigate,
  onOpenIncidentModal,
  onOpenAuthModal,
  onSearchChange,
  onLogout,
}) => {
  const [searchVal, setSearchVal] = useState('');
  const [unreadMessageCount, setUnreadMessageCount] = useState<number>(0);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocket();

  const loadUnreadMessages = useCallback(async () => {
    if (!currentUser) {
      setUnreadMessageCount(0);
      return;
    }
    const convs = await fetchConversations();
    const totalUnread = convs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
    setUnreadMessageCount(totalUnread);
  }, [currentUser]);

  useEffect(() => {
    loadUnreadMessages();

    if (!socket || !currentUser) return;
    const handleNewMsg = () => loadUnreadMessages();
    socket.on('newMessage', handleNewMsg);
    return () => {
      socket.off('newMessage', handleNewMsg);
    };
  }, [socket, currentUser, currentView, loadUnreadMessages]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(searchVal);
    if (currentView !== 'explore' && currentView !== 'home') {
      onNavigate('home');
    }
  };

  const handleMessageClick = () => {
    setUnreadMessageCount(0);
    onNavigate('messages');
  };

  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.email === 'hoang@trekmap.vn');

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '10px 24px',
        background: 'var(--color-bg-glass)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-header)',
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        {/* LEFT ZONE: Brand Logo & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {/* Brand Logo & Title */}
          <div
            onClick={() => onNavigate('home')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          >
            <div style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              width: 36,
              height: 36,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="#ffffff" fillOpacity="0.3" />
              </svg>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 900,
                  color: 'var(--color-text-main)',
                  letterSpacing: '-0.5px',
                  fontFamily: 'var(--font-family)',
                }}
              >
                Trek<span style={{ color: 'var(--color-primary)' }}>Map</span>
              </span>

              <span
                className="badge badge-info"
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  letterSpacing: '0.5px',
                  padding: '3px 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', boxShadow: '0 0 8px var(--color-primary)' }} />
                VÔ TUYẾN BASECAMP
              </span>
            </div>
          </div>
        </div>

        {/* MIDDLE ZONE: Search Bar */}
        <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: 420, margin: '0 10px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: 'absolute', left: 14, pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Tìm kiếm cung đường, địa danh..."
              value={searchVal}
              onChange={(e) => {
                const v = e.target.value;
                setSearchVal(v);
                onSearchChange(v);
              }}
              style={{
                width: '100%',
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
                borderRadius: 20,
                padding: '8px 16px 8px 38px',
                color: 'var(--color-text-main)',
                fontSize: '0.85rem',
                outline: 'none',
                transition: 'all 0.2s ease',
              }}
            />
          </div>
        </form>

        {/* RIGHT ZONE: SOS, Messages & User Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button
            className="btn btn-danger"
            onClick={onOpenIncidentModal}
            title="Gửi báo cáo nguy hiểm, sạt lở hoặc thời tiết xấu đang xảy ra"
            style={{
              fontSize: '0.82rem',
              padding: '7px 14px',
              borderRadius: 20,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>Báo cáo nguy hiểm</span>
          </button>

          <div style={{ width: 1, height: 22, background: 'var(--color-border)', margin: '0 2px' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {currentUser && (
              <button
                type="button"
                className={`btn ${currentView === 'messages' ? 'btn-primary' : 'btn-outline'}`}
                onClick={handleMessageClick}
                style={{
                  position: 'relative',
                  width: 36,
                  height: 36,
                  padding: 0,
                  borderRadius: '50%',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Tin nhắn"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                {unreadMessageCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      background: 'var(--color-error)',
                      color: '#ffffff',
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      borderRadius: 10,
                      padding: '2px 5px',
                      lineHeight: 1,
                    }}
                  >
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </span>
                )}
              </button>
            )}

            <NotificationBell currentUser={currentUser || null} onNavigate={onNavigate} />
            <ThemeToggle />
          </div>

          <div style={{ width: 1, height: 22, background: 'var(--color-border)', margin: '0 2px' }} />

          <div style={{ position: 'relative' }} ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="btn btn-outline"
              style={{
                padding: currentUser ? '4px 8px' : '7px 14px',
                borderRadius: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderColor: isUserMenuOpen ? 'var(--color-primary)' : 'var(--color-border)',
                background: isUserMenuOpen ? 'rgba(14, 215, 181, 0.08)' : 'transparent',
              }}
              aria-label="Toggle Menu"
              title={currentUser ? (currentUser.fullName || currentUser.username) : 'Menu'}
            >
              {/* 3-Dash Hamburger Icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              {currentUser ? (
                <img
                  src={
                    currentUser.avatarUrl ||
                    currentUser.avatar ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'
                  }
                  alt={currentUser.fullName}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1.5px solid var(--color-primary)',
                  }}
                />
              ) : (
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Menu</span>
              )}
            </button>

            {isUserMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  width: 270,
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 20,
                  boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6), 0 0 24px rgba(16, 185, 129, 0.12)',
                  padding: 10,
                  zIndex: 1000,
                  backdropFilter: 'blur(24px)',
                  animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {currentUser ? (
                  <>
                    {/* User Header Profile Card */}
                    <div
                      style={{
                        padding: '12px 14px',
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, var(--color-bg-main) 100%)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        borderRadius: 14,
                        marginBottom: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <img
                        src={
                          currentUser.avatarUrl ||
                          currentUser.avatar ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'
                        }
                        alt={currentUser.fullName}
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid var(--color-primary)',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: '0.92rem',
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
                              borderRadius: 6,
                              background: isAdmin ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                              color: isAdmin ? '#f59e0b' : 'var(--color-primary)',
                              border: isAdmin ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {isAdmin ? (
                              <>
                                <IconShieldCheck size={12} color="#f59e0b" /> Quản Trị Viên
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
                              borderRadius: 6,
                              background: 'rgba(250, 204, 21, 0.15)',
                              color: 'var(--color-sun)',
                              border: '1px solid rgba(250, 204, 21, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <IconStar size={11} color="var(--color-sun)" fill="var(--color-sun)" /> {currentUser.reputationScore || 100} Điểm
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Section 1: User Actions */}
                    <div style={{ padding: '4px 8px 2px 8px', fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Tài Khoản Của Tôi
                    </div>

                    {/* Profile */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onNavigate('profile');
                      }}
                      className="interactive-click"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: 'none',
                        background: currentView === 'profile' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                        color: currentView === 'profile' ? 'var(--color-primary)' : 'var(--color-text-main)',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        transition: 'background 0.2s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = currentView === 'profile' ? 'rgba(16, 185, 129, 0.15)' : 'transparent')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <span>Hồ sơ & Huy hiệu</span>
                    </button>

                    {/* Contribute Trail */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onNavigate('contribute');
                      }}
                      className="interactive-click"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: 'none',
                        background: currentView === 'contribute' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                        color: currentView === 'contribute' ? 'var(--color-primary)' : 'var(--color-text-main)',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        transition: 'background 0.2s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = currentView === 'contribute' ? 'rgba(16, 185, 129, 0.15)' : 'transparent')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="16" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                      </svg>
                      <span>Đóng góp cung đường mới</span>
                    </button>

                    {/* Forum / Community */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onNavigate('forum');
                      }}
                      className="interactive-click"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: 'none',
                        background: currentView === 'forum' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                        color: currentView === 'forum' ? 'var(--color-primary)' : 'var(--color-text-main)',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        transition: 'background 0.2s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = currentView === 'forum' ? 'rgba(16, 185, 129, 0.15)' : 'transparent')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      <span>Diễn đàn & Ghép đoàn</span>
                    </button>

                    {/* Section 2: Admin Dashboard (If Admin) */}
                    {isAdmin && (
                      <>
                        <div style={{ height: 1, background: 'var(--color-border)', margin: '6px 0' }} />
                        <div style={{ padding: '4px 8px 2px 8px', fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-sun)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Quản Trị Hệ Thống
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onNavigate('admin');
                          }}
                          className="interactive-click"
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: 10,
                            border: '1px solid rgba(250, 204, 21, 0.35)',
                            background: currentView === 'admin' ? 'rgba(250, 204, 21, 0.2)' : 'rgba(250, 204, 21, 0.08)',
                            color: 'var(--color-sun)',
                            fontSize: '0.84rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(250, 204, 21, 0.18)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = currentView === 'admin' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.08)')}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          <span>Bảng Điều Khiển Admin</span>
                        </button>
                      </>
                    )}

                    {/* Section 3: Logout */}
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
                          padding: '9px 12px',
                          borderRadius: 10,
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--color-error, #ef4444)',
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          transition: 'background 0.2s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        <span>Đăng xuất</span>
                      </button>
                    )}
                  </>
                ) : (
                  /* Guest Menu State */
                  <div style={{ padding: '8px 4px' }}>
                    <div style={{ padding: '6px 8px 12px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 4 }}>
                        Chào mừng đến với TrekMap!
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                        Đăng nhập để lưu cung đường yêu thích, gửi phản hồi và tham gia diễn đàn.
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
                        padding: '10px 14px',
                        borderRadius: 12,
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                      </svg>
                      <span>Đăng Nhập / Đăng Ký</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
