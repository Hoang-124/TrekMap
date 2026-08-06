import { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar.js';
import { Footer } from './components/layout/Footer.js';
import { MapView } from './components/map/MapView.js';
import { TrailCard } from './components/trail/TrailCard.js';
import { TrailDetailView } from './components/trail/TrailDetailView.js';
import { TrailContributionWizard } from './components/contribution/TrailContributionWizard.js';
import { IncidentReportModal } from './components/incidents/IncidentReportModal.js';
import { UserProfileView } from './components/profile/UserProfileView.js';
import { AdminDashboardView } from './components/admin/AdminDashboardView.js';
import { AdvancedFilterDrawer } from './components/search/AdvancedFilterDrawer.js';
import { TrekForumView } from './components/forum/TrekForumView.js';
import { TrekkerRadioBasecamp } from './components/forum/TrekkerRadioBasecamp.js';
import { AlpineExpeditionFeed } from './components/forum/AlpineExpeditionFeed.js';
import { MessagesPage } from './components/messages/MessagesPage.js';
import { NotificationsPage } from './components/notifications/NotificationsPage.js';
import { SocketProvider } from './context/SocketContext.js';
import { AuthModal } from './components/auth/AuthModal.js';
import { LogoutConfirmModal } from './components/auth/LogoutConfirmModal.js';
import { Toast } from './components/common/Toast.js';
import { fetchTrails, fetchIncidents } from './services/api.js';
import { getApiHeaders } from './utils/sessionHeaders.js';
import { EmergencyBanner } from './components/common/EmergencyBanner.js';
import { EmergencyContactsModal } from './components/common/EmergencyContactsModal.js';
import type { Trail, Incident, ForumThread, UserProfile } from './types.js';
import './App.css';

const Filter = ({ size = 18, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const Send = ({ size = 18, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

export function App() {
  const [currentView, setCurrentView] = useState<'home' | 'explore' | 'detail' | 'contribute' | 'profile' | 'forum' | 'admin' | 'messages' | 'notifications'>('home');
  const [trails, setTrails] = useState<Trail[]>([]);
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncidentDetail, setSelectedIncidentDetail] = useState<Incident | null>(null);
  const [activeIncidentIndex, setActiveIncidentIndex] = useState(0);

  // Auto-rotate ticker every 5 seconds
  useEffect(() => {
    if (incidents.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIncidentIndex((prev) => (prev + 1) % incidents.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [incidents.length]);
  const [forumThreads, setForumThreads] = useState<ForumThread[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const [isHomeNewThreadOpen, setIsHomeNewThreadOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalInitialMode, setAuthModalInitialMode] = useState<'login' | 'register'>('login');
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [resetTokenUrl, setResetTokenUrl] = useState<string | null>(null);

  // Unified Clean URL Pathname & Hash Router
  useEffect(() => {
    const syncRouteFromUrl = () => {
      const pathname = window.location.pathname.replace(/^\//, ''); // e.g. 'forum', 'profile'
      const hash = window.location.hash;

      if (hash === '#login') {
        setAuthModalInitialMode('login');
        setIsAuthModalOpen(true);
        return;
      }
      if (hash === '#register') {
        setAuthModalInitialMode('register');
        setIsAuthModalOpen(true);
        return;
      }

      if (hash.startsWith('#trail/')) {
        setIsAuthModalOpen(false);
        const trailId = hash.replace('#trail/', '');
        if (trailId && trails.length > 0) {
          const found = trails.find((t) => t.id === trailId);
          if (found) {
            setSelectedTrail(found);
            setCurrentView('detail');
            return;
          }
        }
      }

      // Check clean URL pathname (/forum, /profile, /messages, /contribute, /admin, /explore)
      if (['forum', 'profile', 'messages', 'contribute', 'admin', 'explore', 'notifications'].includes(pathname)) {
        setIsAuthModalOpen(false);
        if (hash === '#contribute') {
          setCurrentView('contribute');
          window.history.replaceState({ view: 'contribute' }, '', '/contribute');
        } else {
          setCurrentView(pathname as any);
          if (hash && hash !== '#login' && hash !== '#register') {
            window.history.replaceState({ view: pathname }, '', `/${pathname}`);
          }
        }
      } else if (hash === '#forum' || hash === '#profile' || hash === '#messages' || hash === '#contribute' || hash === '#admin') {
        setIsAuthModalOpen(false);
        const targetView = hash.replace('#', '');
        setCurrentView(targetView as any);
        window.history.replaceState({ view: targetView }, '', `/${targetView}`);
      } else {
        setIsAuthModalOpen(false);
        if (pathname === '' || pathname === 'home') {
          setCurrentView('home');
        }
      }
    };

    syncRouteFromUrl();
    window.addEventListener('popstate', syncRouteFromUrl);
    window.addEventListener('hashchange', syncRouteFromUrl);
    return () => {
      window.removeEventListener('popstate', syncRouteFromUrl);
      window.removeEventListener('hashchange', syncRouteFromUrl);
    };
  }, [trails]);

  useEffect(() => {
    // 1. Cross-Tab Synchronization via BroadcastChannel & LocalStorage
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('trekmap_tab_activation');
      channel.onmessage = (event) => {
        if (event.data?.type === 'ACCOUNT_ACTIVATED') {
          showToast(`🎉 ${event.data.message || 'Tài khoản của bạn đã được KÍCH HOẠT THÀNH CÔNG! Bạn có thể đăng nhập ngay.'}`, 'success');
          setIsAuthModalOpen(true);
        }
      };
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'trekmap_activated_signal' && e.newValue) {
        showToast('🎉 Tài khoản của bạn đã được KÍCH HOẠT THÀNH CÔNG! Bạn có thể đăng nhập ngay.', 'success');
        setIsAuthModalOpen(true);
      }
    };
    window.addEventListener('storage', handleStorage);

    // 2. Check if URL contains activation parameters
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('resetToken');
    const activateToken = urlParams.get('activateToken');

    if (activateToken) {
      fetch('http://localhost:5000/api/auth/activate-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activateToken }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            // Send activation message to the main open tab
            if (channel) {
              channel.postMessage({
                type: 'ACCOUNT_ACTIVATED',
                email: data.email,
                message: data.message,
              });
            }
            localStorage.setItem('trekmap_activated_signal', Date.now().toString());

            showToast(data.message || 'Tài khoản của bạn đã được kích hoạt thành công!', 'success');
            setIsAuthModalOpen(true);

            // If this is a secondary tab created from webmail link, clean up URL and focus main tab
            window.history.replaceState({}, document.title, window.location.pathname);

            // Attempt to auto-close secondary tab if opened via link click
            setTimeout(() => {
              if (window.history.length <= 2) {
                try {
                  window.close();
                } catch (e) {}
              }
            }, 1000);
          } else {
            showToast(data.message || 'Mã kích hoạt không hợp lệ.', 'error');
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        })
        .catch(() => showToast('Không thể kết nối đến máy chủ kích hoạt.', 'error'));
    } else if (token) {
      setResetTokenUrl(token);
      setIsAuthModalOpen(true);
    }

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({
    message: '',
    type: 'success',
    isOpen: false,
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type, isOpen: true });
  };

  // New Thread Form on Homepage
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'Hỏi Đáp' | 'Kinh Nghiệm' | 'Tìm Đồng Đội' | 'Cảnh Báo'>('Hỏi Đáp');
  const [newContent, setNewContent] = useState('');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<number | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [campsiteOnly, setCampsiteOnly] = useState(false);
  const [kidFriendlyOnly, setKidFriendlyOnly] = useState(false);
  const [sortBy, setSortBy] = useState('rating_desc');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);

  // Pagination & Layout View Mode State for Homepage Trail Optimization
  const [visibleTrailCount, setVisibleTrailCount] = useState(6);
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');

  // Load real user session from localStorage
  useEffect(() => {
    async function checkAuthSession() {
      const token = localStorage.getItem('trekmap_token');
      if (!token) return;

      try {
        const res = await fetch('http://localhost:5000/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const userData = json.user || json.data;
        if (json.success && userData) {
          setCurrentUser(userData);
        } else {
          localStorage.removeItem('trekmap_token');
          setCurrentUser(null);
        }
      } catch (err) {
        console.log('Session expired or server unavailable');
        localStorage.removeItem('trekmap_token');
        setCurrentUser(null);
      }
    }
    checkAuthSession();
  }, []);

  // Load trails, incidents & forum threads
  useEffect(() => {
    async function loadData() {
      const trailData = await fetchTrails({
        region: selectedRegion !== 'All' ? selectedRegion : undefined,
        difficulty: selectedDifficulty || undefined,
        search: searchQuery || undefined,
        duration: selectedDuration || undefined,
        campsite: campsiteOnly || undefined,
        kidFriendly: kidFriendlyOnly || undefined,
        sortBy,
      });
      setTrails(trailData);

      const incData = await fetchIncidents();
      setIncidents(incData);

      try {
        const forumRes = await fetch('http://localhost:5000/api/forum', {
          headers: getApiHeaders(),
        });
        const forumJson = await forumRes.json();
        if (forumJson.success) setForumThreads(forumJson.data);
      } catch (err) {
        console.log('Using local forum data');
      }
    }
    loadData();
  }, [selectedRegion, selectedDifficulty, searchQuery, selectedDuration, campsiteOnly, kidFriendlyOnly, sortBy]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentView]);

  const handleSelectTrail = (trail: Trail) => {
    setSelectedTrail(trail);
    window.location.hash = `#trail/${trail.id}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (viewOrUrl: string) => {
    if (!viewOrUrl) return;

    if (viewOrUrl === 'login' || viewOrUrl === '#login') {
      window.location.hash = '#login';
      return;
    }
    if (viewOrUrl === 'register' || viewOrUrl === '#register') {
      window.location.hash = '#register';
      return;
    }

    let targetView = viewOrUrl;
    let queryString = '';

    if (viewOrUrl.includes('?')) {
      const parts = viewOrUrl.split('?');
      targetView = parts[0].replace(/^\//, '');
      queryString = `?${parts[1]}`;
    } else {
      targetView = viewOrUrl.replace(/^\//, '');
    }

    if (targetView === 'home') {
      setSelectedTrail(null);
    }

    if (['home', 'explore', 'detail', 'contribute', 'profile', 'forum', 'admin', 'messages', 'notifications'].includes(targetView)) {
      setCurrentView(targetView as any);

      // Clean browser address bar URLs
      const cleanPath = targetView === 'home' ? '/' : `/${targetView}`;
      const newUrl = `${cleanPath}${queryString}`;
      window.history.pushState({ view: targetView }, '', newUrl);
    }
    window.scrollTo(0, 0);
  };

  const handleResetFilters = () => {
    setSelectedRegion('All');
    setSelectedDifficulty(null);
    setSelectedDuration(null);
    setCampsiteOnly(false);
    setKidFriendlyOnly(false);
    setSortBy('rating_desc');
    setSearchQuery('');
  };

  const handleConfirmLogout = () => {
    localStorage.removeItem('trekmap_token');
    setCurrentUser(null);
    setIsLogoutModalOpen(false);
    showToast('Đã đăng xuất tài khoản thành công.', 'info');
    handleNavigate('home');
  };

  const handleCreateHomeThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    try {
      const token = localStorage.getItem('trekmap_token');
      const res = await fetch('http://localhost:5000/api/forum', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: newTitle,
          category: newCategory,
          content: newContent,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setForumThreads([data.data, ...forumThreads]);
        setIsHomeNewThreadOpen(false);
        setNewTitle('');
        setNewContent('');
        showToast('Tạo bài đóng góp nhật ký mới thành công!', 'success');
      }
    } catch (err) {
      showToast('Không thể đăng bài, vui lòng thử lại.', 'error');
    }
  };

  const featuredTrails = trails.filter((t) => t.rating >= 4.8);
  const bestSeasonTrails = trails.filter((t) => t.bestMonths.includes(new Date().getMonth() + 1));

  const [isEmergencyContactsOpen, setIsEmergencyContactsOpen] = useState(false);

  return (
    <SocketProvider currentUser={currentUser}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-main)' }}>
        <EmergencyBanner onOpenContacts={() => setIsEmergencyContactsOpen(true)} />
        <EmergencyContactsModal isOpen={isEmergencyContactsOpen} onClose={() => setIsEmergencyContactsOpen(false)} />
        <Navbar
          currentView={currentView}
          currentUser={currentUser}
          onNavigate={handleNavigate}
          onOpenIncidentModal={() => setIsIncidentModalOpen(true)}
          onOpenAuthModal={() => handleNavigate('login')}
          onSearchChange={(q) => setSearchQuery(q)}
          onLogout={() => setIsLogoutModalOpen(true)}
        />

      {/* Emergency Alert Banner - Clean Auto-rotating Ticker */}
      {incidents.length > 0 && (() => {
        const currentInc = incidents[activeIncidentIndex % incidents.length];
        return (
          <div
            style={{
              background: 'linear-gradient(90deg, #991b1b 0%, #b91c1c 50%, #7f1d1d 100%)',
              color: '#fef2f2',
              padding: '10px 24px',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-bold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              borderBottom: '1px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 4px 15px rgba(220, 38, 38, 0.25)',
              textAlign: 'center',
            }}
          >
            <span key={currentInc.id} className="view-fade-in" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <strong>CẢNH BÁO SỰ CỐ KHẨN: {currentInc.trailName}</strong> - {currentInc.description}
            </span>
          </div>
        );
      })()}

      <main key={currentView} className="view-fade-in" style={{ flex: 1 }}>
        {/* VIEW 1: HOME & EXPLORE */}
        {(currentView === 'home' || currentView === 'explore') && (
          <div>
            {/* Hero Section */}
            <div style={{
              background: 'var(--hero-overlay), url(https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              padding: '70px 24px 50px 24px',
              textAlign: 'center',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <div style={{ maxWidth: 920, margin: '0 auto' }}>
                <span className="badge badge-success" style={{ marginBottom: 16, padding: '6px 16px', fontSize: 'var(--font-size-xs)' }}>
                  CỘNG ĐỒNG TREKKING VIỆT NAM
                </span>

                <h1 style={{ fontSize: 'var(--font-size-hero)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)', marginBottom: 16, lineHeight: 'var(--line-height-tight)', letterSpacing: '-0.02em' }}>
                  Bản đồ trekking do chính <span style={{ color: 'var(--color-primary)' }}>cộng đồng người đi</span> xây dựng
                </h1>

                <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-muted)', marginBottom: 32, lineHeight: 'var(--line-height-normal)', maxWidth: 760, margin: '0 auto 32px auto' }}>
                  Tra cứu dữ liệu GPX đường đi thực tế, thông tin Porter bản địa, độ khó chuẩn mực và diễn đàn thảo luận cộng đồng.
                </p>

                {/* Regional Quick Filter Pills */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
                  {['All', 'Miền Bắc', 'Miền Trung', 'Miền Nam'].map((r) => (
                    <button
                      key={r}
                      onClick={() => setSelectedRegion(r)}
                      className={`btn ${selectedRegion === r ? 'btn-primary' : 'btn-outline'}`}
                      style={{ borderRadius: 24, padding: '9px 22px', fontSize: 'var(--font-size-sm)' }}
                    >
                      {r === 'All' ? 'Tất cả vùng miền' : r}
                    </button>
                  ))}

                  <button
                    className="btn btn-outline"
                    onClick={() => setIsFilterOpen(true)}
                    style={{ borderRadius: 24, padding: '9px 22px', fontSize: 'var(--font-size-sm)', borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                  >
                    <Filter size={15} /> Bộ lọc nâng cao
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Map Container */}
            <div style={{ maxWidth: 1320, margin: '-30px auto 50px auto', padding: '0 24px' }}>
              <div className="card" style={{ padding: 20, border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)' }}>
                    Bản đồ Tương tác Trekking Việt Nam ({trails.length} cung đường)
                  </h3>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    Chọn marker để xem chi tiết tuyến đường
                  </span>
                </div>

                <MapView trails={trails} selectedTrail={selectedTrail} onSelectTrail={handleSelectTrail} height="560px" />
              </div>
            </div>

            {/* Main Content Sections */}
            <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 24px' }}>

              {/* UNIQUE FEATURE 1: TRẠM VÔ TUYẾN BASECAMP RADIO */}
              <section>
                <TrekkerRadioBasecamp />
              </section>

              {/* UNIQUE FEATURE 2: NHẬT KÝ BẰNG RỪNG & RADAR ĐƯỜNG TREK */}
              <section>
                <AlpineExpeditionFeed
                  threads={forumThreads}
                  onOpenNewThreadModal={() => setIsHomeNewThreadOpen(true)}
                />
              </section>

              {/* SECTION: Featured Trails */}
              <section style={{ marginBottom: 44 }}>
                <div style={{ marginBottom: 20 }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                    Cung Đường Nổi Bật
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Được cộng đồng đánh giá cao nhất về cảnh quan và độ uy tín</p>
                </div>

                <div className="grid-3">
                  {featuredTrails.slice(0, 3).map((trail) => (
                    <TrailCard key={trail.id} trail={trail} onSelect={handleSelectTrail} />
                  ))}
                </div>
              </section>

              {/* SECTION: Best Season Right Now */}
              <section style={{ marginBottom: 44 }}>
                <div style={{ marginBottom: 20 }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                    Thời Tiết Phù Hợp Tháng {new Date().getMonth() + 1}
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Các cung đường trong mùa khô ráo, cảnh quan đẹp nhất năm</p>
                </div>

                <div className="grid-3">
                  {bestSeasonTrails.slice(0, 3).map((trail) => (
                    <TrailCard key={trail.id} trail={trail} onSelect={handleSelectTrail} />
                  ))}
                </div>
              </section>

              {/* SECTION: All Trails Grid / Compact View */}
              <section style={{ marginBottom: 56 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>
                      Khám Phá Cung Đường ({trails.length})
                    </h2>
                    <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                      Danh sách đã được tối ưu hóa giao diện chống mỏi mắt người dùng
                    </p>
                  </div>

                  {/* View Mode Switcher: Grid vs Compact Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', background: 'var(--color-bg-card)', padding: 3, borderRadius: 10, border: '1px solid var(--color-border)' }}>
                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 8,
                          border: 'none',
                          background: viewMode === 'grid' ? 'var(--color-primary)' : 'transparent',
                          color: viewMode === 'grid' ? '#ffffff' : 'var(--color-text-muted)',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="7" height="7" />
                          <rect x="14" y="3" width="7" height="7" />
                          <rect x="14" y="14" width="7" height="7" />
                          <rect x="3" y="14" width="7" height="7" />
                        </svg>
                        <span>Dạng Lưới</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('compact')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 8,
                          border: 'none',
                          background: viewMode === 'compact' ? 'var(--color-primary)' : 'transparent',
                          color: viewMode === 'compact' ? '#ffffff' : 'var(--color-text-muted)',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="8" y1="6" x2="21" y2="6" />
                          <line x1="8" y1="12" x2="21" y2="12" />
                          <line x1="8" y1="18" x2="21" y2="18" />
                          <line x1="3" y1="6" x2="3.01" y2="6" />
                          <line x1="3" y1="12" x2="3.01" y2="12" />
                          <line x1="3" y1="18" x2="3.01" y2="18" />
                        </svg>
                        <span>Danh Sách Tóm Tắt</span>
                      </button>
                    </div>

                    {searchQuery && (
                      <button className="btn btn-outline" onClick={handleResetFilters} style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
                        Xóa tìm kiếm
                      </button>
                    )}
                  </div>
                </div>

                {trails.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: 50, color: 'var(--color-text-muted)' }}>
                    Không tìm thấy cung đường phù hợp với bộ lọc. Vui lòng đặt lại tiêu chí tìm kiếm.
                  </div>
                ) : viewMode === 'compact' ? (
                  /* Compact Horizontal Row View (70% Less Vertical Height) */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {trails.slice(0, visibleTrailCount).map((t) => (
                      <div
                        key={t.id}
                        onClick={() => handleSelectTrail(t)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 16,
                          background: 'var(--color-bg-card)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 14,
                          padding: 12,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-primary)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-border)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <img
                          src={t.coverImage}
                          alt={t.name}
                          style={{ width: 90, height: 68, borderRadius: 10, objectFit: 'cover' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--color-text-main)' }}>{t.name}</span>
                            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>{t.region}</span>
                            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{t.province}</span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                            Độ dài: <strong style={{ color: 'var(--color-primary)' }}>{t.distanceKm} km</strong> • Nâng độ cao: <strong style={{ color: '#38bdf8' }}>+{t.elevationGainM}m</strong> • Thời gian: {t.durationHoursNote}
                          </div>
                        </div>
                        <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '8px 16px', whiteSpace: 'nowrap' }}>
                          Xem Chi Tiết
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Standard Grid View */
                  <div className="grid-3">
                    {trails.slice(0, visibleTrailCount).map((trail) => (
                      <TrailCard key={trail.id} trail={trail} onSelect={handleSelectTrail} />
                    ))}
                  </div>
                )}

                {/* Load More Pagination Action Bar */}
                {visibleTrailCount < trails.length && (
                  <div style={{ textAlign: 'center', marginTop: 28 }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => setVisibleTrailCount((prev) => prev + 6)}
                      style={{
                        padding: '12px 32px',
                        fontSize: '0.9rem',
                        fontWeight: 800,
                        borderRadius: 30,
                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
                      }}
                    >
                      Xem Thêm {trails.length - visibleTrailCount} Cung Đường Khác
                    </button>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* VIEW 2: TRAIL DETAIL */}
        {currentView === 'detail' && selectedTrail && (
          <TrailDetailView
            trail={selectedTrail}
            onBack={() => setCurrentView('home')}
            onOpenIncidentModal={() => setIsIncidentModalOpen(true)}
          />
        )}

        {/* VIEW 3: CONTRIBUTE WIZARD */}
        {currentView === 'contribute' && (
          <TrailContributionWizard
            currentUser={currentUser}
            onBack={() => {
              const isEditing = !!localStorage.getItem('trekmap_editing_contribution');
              localStorage.removeItem('trekmap_editing_contribution');
              if (isEditing) {
                handleNavigate('profile');
              } else {
                handleNavigate('home');
              }
            }}
            onSuccess={() => {
              handleNavigate('profile');
            }}
            onShowToast={(msg, type) => showToast(msg, type)}
          />
        )}

        {/* VIEW 4: USER PROFILE */}
        {currentView === 'profile' && (
          <UserProfileView
            currentUser={currentUser}
            onBack={() => {
              handleNavigate('home');
            }}
            onSelectTrail={handleSelectTrail}
            onShowToast={(msg, type) => showToast(msg, type)}
            onProfileUpdate={(updatedUser) => setCurrentUser(updatedUser)}
            onNavigateToContribute={() => {
              handleNavigate('contribute');
            }}
          />
        )}

        {/* VIEW 5: FORUM VIEW (ALPINE EXPEDITION HUB) */}
        {currentView === 'forum' && (
          <TrekForumView
            onBack={() => handleNavigate('home')}
            onShowToast={(msg, type) => showToast(msg, type)}
          />
        )}

        {/* VIEW 6: ADMIN DASHBOARD (APPROVAL PORTAL) */}
        {currentView === 'admin' && (
          <AdminDashboardView
            onBack={() => {
              handleNavigate('home');
            }}
            onShowToast={(msg, type) => showToast(msg, type)}
          />
        )}

        {/* VIEW 7: MESSAGES PAGE */}
        {currentView === 'messages' && (
          <MessagesPage
            currentUser={currentUser}
            onShowToast={(msg, type) => showToast(msg, type)}
          />
        )}

        {/* VIEW 8: NOTIFICATIONS PAGE */}
        {currentView === 'notifications' && (
          <NotificationsPage
            currentUser={currentUser}
            onNavigate={handleNavigate}
          />
        )}
      </main>

      {/* Modal New Thread on Homepage */}
      {isHomeNewThreadOpen && (
        <div className="modal-overlay" onClick={() => setIsHomeNewThreadOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.3rem', color: '#fff', fontWeight: 800, marginBottom: 20 }}>
              Viết bài đóng góp nhật ký băng rừng
            </h3>

            <form onSubmit={handleCreateHomeThread}>
              <div className="form-group">
                <label className="form-label">Tiêu đề nhật ký</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Cẩm nang leo Lảo Thẩn 2N1Đ tự túc mới nhất"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Chuyên mục</label>
                <select
                  className="form-select"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                >
                  <option value="Hỏi Đáp">Hỏi Đáp</option>
                  <option value="Kinh Nghiệm">Kinh Nghiệm</option>
                  <option value="Tìm Đồng Đội">Tìm Đồng Đội</option>
                  <option value="Cảnh Báo">Cảnh Báo</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Nội dung chi tiết</label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  placeholder="Nhập nội dung chia sẻ trải nghiệm thực tế của bạn..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsHomeNewThreadOpen(false)} style={{ flex: 1 }}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                  <Send size={16} /> Đăng nhật ký
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Authentication Register / Login / Reset Password Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authModalInitialMode}
        onClose={() => {
          setIsAuthModalOpen(false);
          setResetTokenUrl(null);
          if (currentView === 'detail' && selectedTrail) {
            window.location.hash = `#trail/${selectedTrail.id}`;
          } else {
            window.location.hash = `#${currentView}`;
          }
        }}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          if (currentView === 'detail' && selectedTrail) {
            window.location.hash = `#trail/${selectedTrail.id}`;
          } else {
            window.location.hash = `#${currentView}`;
          }
        }}
        onShowToast={(msg, type) => showToast(msg, type)}
        initialResetToken={resetTokenUrl}
      />

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleConfirmLogout}
        userName={currentUser?.username || currentUser?.fullName}
      />
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, isOpen: false }))}
      />

      <AdvancedFilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        selectedRegion={selectedRegion}
        onSelectRegion={setSelectedRegion}
        selectedDifficulty={selectedDifficulty}
        onSelectDifficulty={setSelectedDifficulty}
        selectedDuration={selectedDuration}
        onSelectDuration={setSelectedDuration}
        campsiteOnly={campsiteOnly}
        onToggleCampsite={setCampsiteOnly}
        kidFriendlyOnly={kidFriendlyOnly}
        onToggleKidFriendly={setKidFriendlyOnly}
        sortBy={sortBy}
        onSelectSortBy={setSortBy}
        onReset={handleResetFilters}
      />

      <IncidentReportModal
        isOpen={isIncidentModalOpen}
        onClose={() => setIsIncidentModalOpen(false)}
        trailName={selectedTrail ? selectedTrail.name : 'Vùng Trekking'}
        trailId={selectedTrail ? selectedTrail.id : 'trail-fansipan'}
      />

      {/* Emergency Incident Detail Modal */}
      {selectedIncidentDetail && (
        <div className="modal-overlay" onClick={() => setSelectedIncidentDetail(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 600, border: '1.5px solid #ef4444', boxShadow: '0 0 50px rgba(239, 68, 68, 0.4)' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
              <h3 style={{ fontSize: '1.15rem', color: '#ef4444', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '4px 8px', borderRadius: 8, display: 'inline-flex' }}>🚨</span>
                Hồ Sơ Cảnh Báo Sự Cố Khẩn & Bằng Chứng
              </h3>
              <button
                type="button"
                onClick={() => setSelectedIncidentDetail(null)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '1.2rem', padding: 4 }}
              >
                ✕
              </button>
            </div>

            {/* Verification Status Card */}
            <div style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: 16, padding: 16, marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.74rem', fontWeight: 900, padding: '3px 10px', borderRadius: 20 }}>
                    MỨC ĐỘ: {selectedIncidentDetail.severity?.toUpperCase() || 'KHẨN CẤP'}
                  </span>
                  <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)', fontSize: '0.74rem', fontWeight: 800, padding: '3px 10px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    ✓ ĐÃ XÁC MINH HIỆN TRƯỜNG
                  </span>
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  {selectedIncidentDetail.reportedAt}
                </span>
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '8px 0 4px 0' }}>
                {selectedIncidentDetail.trailName}
              </h4>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-sky)', fontWeight: 600 }}>
                📍 Vị trí: {selectedIncidentDetail.locationNote || 'Đoạn đường nguy hiểm'} {selectedIncidentDetail.elevationM ? `(Độ cao ${selectedIncidentDetail.elevationM}m)` : ''}
              </div>
            </div>

            {/* BẰNG CHỨNG HÌNH ẢNH HIỆN TRƯỜNG */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📸 Bằng Chứng Hình Ảnh Hiện Trường:</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>(Ảnh thực tế từ Đội Cứu Hộ & Vệ Tinh)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: selectedIncidentDetail.images && selectedIncidentDetail.images.length > 1 ? '1fr 1fr' : '1fr', gap: 10 }}>
                {(selectedIncidentDetail.images && selectedIncidentDetail.images.length > 0
                  ? selectedIncidentDetail.images
                  : ['https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80']
                ).map((imgUrl, idx) => (
                  <div key={idx} style={{ height: 160, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)', position: 'relative', background: '#000' }}>
                    <img src={imgUrl} alt={`Evidence photo ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 6, left: 6, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.68rem', padding: '2px 6px', borderRadius: 4, backdropFilter: 'blur(4px)' }}>
                      📷 Ảnh bằng chứng #{idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chi tiết mô tả & Đơn vị xác minh */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.86rem', lineHeight: 1.6, color: 'var(--color-text-muted)', marginBottom: 20 }}>
              <div>
                <strong style={{ color: 'var(--color-text-main)' }}>Mô tả chi tiết sự cố:</strong>
                <p style={{ margin: '6px 0 0 0', color: 'var(--color-text-main)', background: 'var(--color-bg-main)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--color-border)', fontSize: '0.88rem' }}>
                  {selectedIncidentDetail.description}
                </p>
              </div>

              <div style={{ background: 'var(--color-bg-main)', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>
                  <strong style={{ color: 'var(--color-primary)' }}>Cơ quan / Đơn vị xác minh: </strong>
                  <span style={{ color: 'var(--color-text-main)' }}>{selectedIncidentDetail.verifiedBy || selectedIncidentDetail.userName || 'Trạm Kiểm Lâm Vườn Quốc Gia & BQT TrekMap'}</span>
                </div>
                {selectedIncidentDetail.coordinates && (
                  <div>
                    <strong style={{ color: 'var(--color-sky)' }}>Tọa độ Vệ Tinh GPS: </strong>
                    <span style={{ color: 'var(--color-text-main)', fontFamily: 'monospace' }}>
                      {selectedIncidentDetail.coordinates.lat.toFixed(4)}° N, {selectedIncidentDetail.coordinates.lng.toFixed(4)}° E
                    </span>
                  </div>
                )}
                <div>
                  <strong style={{ color: '#ef4444' }}>📞 Hotline Cứu Hộ Khẩn Cấp: </strong>
                  <span style={{ color: '#ef4444', fontWeight: 900 }}>{selectedIncidentDetail.rescueContact || '0214.3871.234 (Tổng đài cứu hộ Sapa 24/7)'}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setSelectedIncidentDetail(null)}
                style={{ flex: 1, borderRadius: 10 }}
              >
                Đóng Cửa Sổ
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setSelectedIncidentDetail(null);
                  setIsIncidentModalOpen(true);
                }}
                style={{ flex: 1.4, borderRadius: 10, background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', border: 'none', fontWeight: 800 }}
              >
                🚨 Gửi Báo Cáo SOS Hỗ Trợ Khẩn
              </button>
            </div>
          </div>
        </div>
      )}

        <Footer />
      </div>
    </SocketProvider>
  );
}

export default App;
