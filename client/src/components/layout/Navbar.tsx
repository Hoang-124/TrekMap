import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Compass,
  PlusCircle,
  Search,
  ShieldAlert,
  MessageSquare,
  LogIn,
  Radio,
  Navigation,
  MessageCircle,
  User,
  LogOut,
  ShieldCheck,
  ChevronDown,
  Menu,
} from 'lucide-react';
import type { UserProfile, Message } from '../../types.js';
import { ThemeToggle } from '../common/ThemeToggle.js';
import { NotificationBell } from '../notifications/NotificationBell.js';
import { fetchConversations } from '../../services/messageService.js';
import { useSocket } from '../../hooks/useSocket.js';

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
  }, [loadUnreadMessages]);

  useEffect(() => {
    if (!socket || !currentUser) return;

    const handleNewMessage = (msg: Message) => {
      const senderId = typeof msg.sender === 'string' ? msg.sender : msg.sender?._id;
      const myId = currentUser.id || (currentUser as any)._id;
      if (String(senderId) !== String(myId)) {
        if (currentView !== 'messages') {
          loadUnreadMessages();
        }
      }
    };

    socket.on('newMessage', handleNewMessage);
    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, [socket, currentUser, currentView, loadUnreadMessages]);

  // Click outside listener for User Menu Dropdown
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
        <div
          onClick={() => onNavigate('home')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, var(--color-primary) 0%, #16a34a 100%)',
              padding: 8,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-sprout)',
            }}
          >
            <Compass size={22} color="#041108" />
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
                padding: '2px 7px',
              }}
            >
              <Radio size={9} /> VÔ TUYẾN 24/7
            </span>
          </div>
        </div>

        {/* MIDDLE ZONE: Sleek Search Bar */}
        <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: 420, margin: '0 10px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} color="var(--color-primary)" style={{ position: 'absolute', left: 14 }} />
            <input
              type="text"
              placeholder="Tìm kiếm cung đường, địa danh..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
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

        {/* RIGHT ZONE: SOS, Icons Cluster & User Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {/* SOS Emergency Button */}
          <button
            className="btn btn-danger"
            onClick={onOpenIncidentModal}
            style={{
              fontSize: '0.82rem',
              padding: '7px 14px',
              borderRadius: 20,
              fontWeight: 700,
            }}
          >
            <ShieldAlert size={15} />
            Cứu hộ SOS
          </button>

          <div style={{ width: 1, height: 22, background: 'var(--color-border)', margin: '0 2px' }} />

          {/* Action Icon Cluster (Tin nhắn, Thông báo, Theme Toggle) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Messages Icon Button */}
            {currentUser && (
              <button
                type="button"
                className={`btn ${currentView === 'messages' ? 'btn-primary' : 'btn-outline'}`}
                onClick={handleMessageClick}
                title="Tin nhắn"
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
                <MessageCircle size={18} color={currentView === 'messages' ? '#041108' : 'var(--color-primary)'} />
                {unreadMessageCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -3,
                      right: -3,
                      background: '#ef4444',
                      color: '#ffffff',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      borderRadius: 10,
                      padding: '2px 5px',
                      lineHeight: 1,
                      boxShadow: '0 2px 5px rgba(239, 68, 68, 0.4)',
                    }}
                  >
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </span>
                )}
              </button>
            )}

            {/* Notifications Bell */}
            <NotificationBell currentUser={currentUser || null} onNavigate={onNavigate} />

            {/* Theme Toggle */}
            <ThemeToggle />
          </div>

          <div style={{ width: 1, height: 22, background: 'var(--color-border)', margin: '0 2px' }} />

          {/* User Menu Dropdown (Gom toàn bộ Bản đồ, Diễn đàn, Đóng góp, Profile, Admin, Logout) */}
          <div style={{ position: 'relative' }} ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="btn btn-outline"
              style={{
                padding: currentUser ? '4px 10px 4px 5px' : '6px 12px',
                borderRadius: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderColor: isUserMenuOpen ? 'var(--color-primary)' : 'var(--color-border)',
                background: isUserMenuOpen ? 'rgba(14, 215, 181, 0.08)' : 'transparent',
              }}
            >
              {currentUser ? (
                <>
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
                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: 'var(--color-text-main)',
                      maxWidth: 110,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {currentUser.fullName || currentUser.username}
                  </span>
                  <ChevronDown size={14} color="var(--color-text-muted)" />
                </>
              ) : (
                <>
                  <Menu size={16} color="var(--color-primary)" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Menu</span>
                </>
              )}
            </button>

            {/* Dropdown Menu Card */}
            {isUserMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: 250,
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 16,
                  boxShadow: 'var(--shadow-dropdown, 0 10px 30px rgba(0,0,0,0.25))',
                  padding: 8,
                  zIndex: 1000,
                  animation: 'fadeIn 0.2s ease',
                }}
              >
                {/* Header User Info (if logged in) */}
                {currentUser && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--color-border)',
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text-main)' }}>
                      {currentUser.fullName || currentUser.username}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {currentUser.email}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <span
                        className="badge badge-primary"
                        style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px' }}
                      >
                        ⭐ {currentUser.reputationScore || 100} Điểm uy tín
                      </span>
                    </div>
                  </div>
                )}

                {/* Section 1: Main Navigation (Bản đồ, Diễn đàn, Đóng góp) */}
                <div style={{ padding: '4px 8px 2px 8px', fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                  Danh Mục Chính
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onNavigate('home');
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: currentView === 'home' || currentView === 'explore' ? 'rgba(14, 215, 181, 0.12)' : 'transparent',
                    color: currentView === 'home' || currentView === 'explore' ? 'var(--color-primary)' : 'var(--color-text-main)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.2s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = currentView === 'home' || currentView === 'explore' ? 'rgba(14, 215, 181, 0.12)' : 'transparent')}
                >
                  <Navigation size={16} color="var(--color-primary)" />
                  Bản đồ thám hiểm
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onNavigate('forum');
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: currentView === 'forum' ? 'rgba(14, 215, 181, 0.12)' : 'transparent',
                    color: currentView === 'forum' ? 'var(--color-primary)' : 'var(--color-text-main)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.2s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = currentView === 'forum' ? 'rgba(14, 215, 181, 0.12)' : 'transparent')}
                >
                  <MessageSquare size={16} color="var(--color-primary)" />
                  Diễn đàn Trekkers
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onNavigate('contribute');
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: currentView === 'contribute' ? 'rgba(14, 215, 181, 0.12)' : 'transparent',
                    color: currentView === 'contribute' ? 'var(--color-primary)' : 'var(--color-text-main)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.2s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = currentView === 'contribute' ? 'rgba(14, 215, 181, 0.12)' : 'transparent')}
                >
                  <PlusCircle size={16} color="var(--color-primary)" />
                  Đóng góp cung đường
                </button>

                {/* Section 2: Account & Admin (If Logged In) */}
                {currentUser && (
                  <>
                    <div style={{ height: 1, background: 'var(--color-border)', margin: '6px 0' }} />

                    <div style={{ padding: '4px 8px 2px 8px', fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                      Cá Nhân & Quản Trị
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onNavigate('profile');
                      }}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: 'none',
                        background: currentView === 'profile' ? 'rgba(14, 215, 181, 0.12)' : 'transparent',
                        color: currentView === 'profile' ? 'var(--color-primary)' : 'var(--color-text-main)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.2s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = currentView === 'profile' ? 'rgba(14, 215, 181, 0.12)' : 'transparent')}
                    >
                      <User size={16} color="var(--color-primary)" />
                      Hồ sơ cá nhân
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onNavigate('admin');
                        }}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: 10,
                          border: 'none',
                          background: currentView === 'admin' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                          color: '#f59e0b',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.2s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245, 158, 11, 0.12)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = currentView === 'admin' ? 'rgba(245, 158, 11, 0.15)' : 'transparent')}
                      >
                        <ShieldCheck size={16} color="#f59e0b" />
                        Bảng quản trị Admin
                      </button>
                    )}
                  </>
                )}

                {/* Section 3: Auth Actions */}
                <div style={{ height: 1, background: 'var(--color-border)', margin: '6px 0' }} />

                {currentUser ? (
                  onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-error, #ef4444)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.2s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <LogOut size={16} color="#ef4444" />
                      Đăng xuất
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenAuthModal();
                    }}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'rgba(14, 215, 181, 0.1)',
                      color: 'var(--color-primary)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <LogIn size={16} color="var(--color-primary)" />
                    Đăng nhập tài khoản
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
