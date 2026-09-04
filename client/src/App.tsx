import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Navbar } from './components/layout/Navbar.js';
import { Footer } from './components/layout/Footer.js';
import { TrailCard } from './components/trail/TrailCard.js';
import { TrailDetailView } from './components/trail/TrailDetailView.js';
import { AdvancedFilterDrawer } from './components/search/AdvancedFilterDrawer.js';
import { HeroExpeditionSection } from './components/landing/HeroExpeditionSection.js';
import { SeasonExpeditionRadar } from './components/landing/SeasonExpeditionRadar.js';
import { BentoCommandHub } from './components/landing/BentoCommandHub.js';
import { InteractiveMapShowcase } from './components/landing/InteractiveMapShowcase.js';
import { SafetyPledgeSection } from './components/landing/SafetyPledgeSection.js';
import { SocketProvider, useSocket } from './context/SocketContext.js';
import { AuthModal } from './components/auth/AuthModal.js';
import { LogoutConfirmModal } from './components/auth/LogoutConfirmModal.js';
import { Toast } from './components/common/Toast.js';
import { fetchTrails, fetchTrailById, fetchIncidents } from './services/api.js';
import { mockTrails } from './data/seedData.js';
import { getApiHeaders } from './utils/sessionHeaders.js';
import { EmergencyContactsModal } from './components/common/EmergencyContactsModal.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import { TrekAssistantFab } from './components/ai-assistant/TrekAssistantFab.js';

// Lazy-loaded heavy views and modals for peak bundle performance & fast initial load
const TrailComparisonModal = lazy(() => import('./components/trail/TrailComparisonModal.js').then((m) => ({ default: m.TrailComparisonModal })));
const TrailContributionWizard = lazy(() => import('./components/contribution/TrailContributionWizard.js').then((m) => ({ default: m.TrailContributionWizard })));
const IncidentReportModal = lazy(() => import('./components/incidents/IncidentReportModal.js').then((m) => ({ default: m.IncidentReportModal })));
const UserProfileView = lazy(() => import('./components/profile/UserProfileView.js').then((m) => ({ default: m.UserProfileView })));
const AdminDashboardView = lazy(() => import('./components/admin/AdminDashboardView.js').then((m) => ({ default: m.AdminDashboardView })));
const TrekForumView = lazy(() => import('./components/forum/TrekForumView.js').then((m) => ({ default: m.TrekForumView })));
const MessagesPage = lazy(() => import('./components/messages/MessagesPage.js').then((m) => ({ default: m.MessagesPage })));
const NotificationsPage = lazy(() => import('./components/notifications/NotificationsPage.js').then((m) => ({ default: m.NotificationsPage })));
const TrekAssistantModal = lazy(() => import('./components/ai-assistant/TrekAssistantModal.js').then((m) => ({ default: m.TrekAssistantModal })));
const SharedItineraryModal = lazy(() => import('./components/trail/SharedItineraryModal.js').then((m) => ({ default: m.SharedItineraryModal })));

const PageLoadingFallback: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '35vh', gap: 12, color: 'var(--color-primary)' }}>
    <div style={{ width: 24, height: 24, border: '2.5px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Đang tải giao diện...</span>
  </div>
);

import {
  IconHiking,
  IconShieldAlert,
  IconPhone,
  IconAlertTriangle,
  IconMapPin,
  IconMountain,
  IconTent,
  IconDroplet,
  IconClock,
  IconScale,
  IconX,
  IconStar,
  IconCheck,
} from './components/common/SvgIcons.js';
import type { Trail, Incident, ForumThread, UserProfile } from './types.js';
import './App.css';

const DisconnectBanner: React.FC = () => {
  const { isConnected } = useSocket();
  if (isConnected) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
        color: '#ffffff',
        padding: '10px 24px',
        borderRadius: 30,
        fontSize: '0.82rem',
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 8px 32px rgba(220, 38, 38, 0.55)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        backdropFilter: 'blur(12px)',
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#fca5a5',
          display: 'inline-block',
          boxShadow: '0 0 8px #ef4444',
        }}
      />
      Mất kết nối máy chủ — đang tự động thử kết nối lại...
    </div>
  );
};

const Send = ({ size = 18, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

function getInitialRoute(): {
  view: 'home' | 'explore' | 'detail' | 'contribute' | 'profile' | 'forum' | 'admin' | 'messages' | 'notifications';
  trailId: string | null;
  sharedItineraryToken: string | null;
} {
  if (typeof window === 'undefined') return { view: 'home', trailId: null, sharedItineraryToken: null };
  const pathname = window.location.pathname.replace(/^\//, '');
  const hash = window.location.hash;

  if (hash.startsWith('#trail/')) {
    const trailId = hash.replace('#trail/', '');
    return { view: 'detail', trailId, sharedItineraryToken: null };
  }

  if (hash.startsWith('#itinerary/')) {
    const token = hash.replace('#itinerary/', '');
    return { view: 'home', trailId: null, sharedItineraryToken: token };
  }

  if (pathname === 'forum' || hash === '#forum') {
    return { view: 'forum', trailId: null, sharedItineraryToken: null };
  }

  if (['profile', 'messages', 'contribute', 'admin', 'explore', 'notifications', 'forum'].includes(pathname)) {
    return { view: pathname as any, trailId: null, sharedItineraryToken: null };
  }

  if (hash === '#profile') return { view: 'profile', trailId: null, sharedItineraryToken: null };
  if (hash === '#messages') return { view: 'messages', trailId: null, sharedItineraryToken: null };
  if (hash === '#contribute') return { view: 'contribute', trailId: null, sharedItineraryToken: null };
  if (hash === '#admin') return { view: 'admin', trailId: null, sharedItineraryToken: null };
  if (hash === '#explore') return { view: 'explore', trailId: null, sharedItineraryToken: null };
  if (hash === '#notifications') return { view: 'notifications', trailId: null, sharedItineraryToken: null };
  if (hash === '#forum') return { view: 'forum', trailId: null, sharedItineraryToken: null };

  return { view: 'home', trailId: null, sharedItineraryToken: null };
}

function getInitialTrail(trailId: string | null): Trail | null {
  if (!trailId) return null;
  const seedFound = mockTrails.find((t) => t.id === trailId || (t as any)._id === trailId || String(t.id) === trailId);
  if (seedFound) return seedFound;

  try {
    const cachedContribs: any[] = JSON.parse(localStorage.getItem('trekmap_contributions') || '[]');
    const contrib = cachedContribs.find((c) => c.id === trailId || c._id === trailId || `contrib-${c._id}` === trailId || `contrib-${c.id}` === trailId);
    if (contrib) {
      return {
        id: contrib.id || `contrib-${contrib._id || Date.now()}`,
        name: contrib.name,
        altNames: contrib.altNames || [],
        region: contrib.region || 'Miền Bắc',
        province: contrib.province || '',
        district: contrib.district || '',
        hamlet: contrib.hamlet || '',
        distanceKm: Number(contrib.distanceKm) || 15,
        elevationGainM: Number(contrib.elevationGainM) || 800,
        maxAltitudeM: Number(contrib.maxAltitudeM) || 2000,
        durationDays: Math.ceil((Number(contrib.distanceKm) || 15) / 10),
        durationHoursNote: contrib.durationHoursNote || '1 ngày',
        difficultyLevel: Number(contrib.difficultyLevel) || 3,
        difficultyNote: (Number(contrib.difficultyLevel) || 3) >= 4 ? 'Thử thách cao' : 'Trung bình',
        bestMonths: Array.isArray(contrib.bestMonths) && contrib.bestMonths.length > 0 ? contrib.bestMonths : [10, 11, 12, 1, 2, 3, 4],
        avoidMonths: Array.isArray(contrib.avoidMonths) ? contrib.avoidMonths : [],
        startLat: Number(contrib.startLat) || 22.3364,
        startLng: Number(contrib.startLng) || 103.8438,
        endLat: Number(contrib.endLat) || 22.3032,
        endLng: Number(contrib.endLng) || 103.7753,
        description: contrib.description || 'Cung đường đóng góp cộng đồng.',
        transportationInfo: contrib.transportationInfo || '',
        coverImage: contrib.coverImage || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80',
        galleryImages: [contrib.coverImage || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80'],
        permitRequired: !!contrib.permitRequired,
        permitInfo: contrib.permitInfo || '',
        hasCampsite: !!contrib.hasCampsite,
        hasWaterSource: !!contrib.hasWaterSource,
        kidFriendly: !!contrib.kidFriendly,
        gpxTrack: contrib.gpxTrack || [
          [Number(contrib.startLat) || 22.3364, Number(contrib.startLng) || 103.8438],
          [Number(contrib.endLat) || 22.3032, Number(contrib.endLng) || 103.7753],
        ],
        waypoints: contrib.waypoints || [],
        status: contrib.status || 'approved',
        createdAt: contrib.createdAt,
        updatedAt: contrib.updatedAt,
        rescueContact: contrib.rescueContact || {
          name: 'Hạt Kiểm Lâm ' + (contrib.province || 'Địa phương'),
          phone: '114 / 115 (Cứu nạn & Cấp cứu 24/7)',
          rangerContact: 'Trạm Kiểm Lâm ' + (contrib.district || 'Cửa Rừng'),
        },
        rating: 0,
        reviewCount: 0,
      };
    }
  } catch (e) {}

  return null;
}

export function App() {
  const initialRoute = getInitialRoute();
  const [currentView, setCurrentView] = useState<'home' | 'explore' | 'detail' | 'contribute' | 'profile' | 'forum' | 'admin' | 'messages' | 'notifications'>(initialRoute.view);
  const [previousView, setPreviousView] = useState<'home' | 'explore' | 'detail' | 'contribute' | 'profile' | 'forum' | 'admin' | 'messages' | 'notifications'>('home');
  const [sharedItineraryToken, setSharedItineraryToken] = useState<string | null>(initialRoute.sharedItineraryToken);
  const [trails, setTrails] = useState<Trail[]>([]);
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(() => getInitialTrail(initialRoute.trailId));
  const [selectedSeasonMonth, setSelectedSeasonMonth] = useState<number | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncidentDetail, setSelectedIncidentDetail] = useState<Incident | null>(null);
  const [activeIncidentIndex, setActiveIncidentIndex] = useState(0);
  const [isAlertBannerDismissed, setIsAlertBannerDismissed] = useState(false);

  // If initial route is detail and selectedTrail is not found locally, fetch it immediately from API
  useEffect(() => {
    if (initialRoute.view === 'detail' && initialRoute.trailId && !selectedTrail) {
      fetchTrailById(initialRoute.trailId).then((trail) => {
        if (trail) {
          setSelectedTrail(trail);
          setCurrentView('detail');
        }
      });
    }
  }, []);

  // Listen for browser Back/Forward navigation buttons (popstate & hashchange)
  useEffect(() => {
    const handlePopState = () => {
      const route = getInitialRoute();
      setCurrentView(route.view);
      if (route.sharedItineraryToken) {
        setSharedItineraryToken(route.sharedItineraryToken);
      } else if (!window.location.hash.startsWith('#itinerary/')) {
        setSharedItineraryToken(null);
      }
      if (route.trailId) {
        const tr = getInitialTrail(route.trailId);
        if (tr) {
          setSelectedTrail(tr);
        } else {
          fetchTrailById(route.trailId).then((trail) => {
            if (trail) setSelectedTrail(trail);
          });
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

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

  // Trail Comparison State
  const [comparedTrails, setComparedTrails] = useState<Trail[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  const handleToggleCompare = (trail: Trail) => {
    setComparedTrails((prev) => {
      const exists = prev.some((t) => t.id === trail.id);
      if (exists) {
        return prev.filter((t) => t.id !== trail.id);
      }
      if (prev.length >= 3) {
        showToast('Chỉ có thể so sánh tối đa 3 cung đường cùng lúc.', 'info');
        return prev;
      }
      showToast(`Đã thêm "${trail.name}" vào bảng so sánh.`, 'success');
      return [...prev, trail];
    });
  };

  // TrekCopilot AI Assistant State
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);

  // Floating Scroll-to-Top State
  const [showScrollTop, setShowScrollTop] = useState(false);


  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
        if (trailId) {
          setCurrentView('detail');
          if (trails.length > 0) {
            const found = trails.find((t) => t.id === trailId || (t as any)._id === trailId || String(t.id) === trailId);
            if (found) {
              setSelectedTrail(found);
              return;
            }
          }
          fetchTrailById(trailId).then((trail) => {
            if (trail) {
              setSelectedTrail(trail);
            }
          });
        }
        return;
      }

      // Check clean URL pathname (/forum, /profile, /messages, /contribute, /admin, /explore)
      if (pathname === 'forum' || hash === '#forum') {
        setIsAuthModalOpen(false);
        setCurrentView('home');
        window.history.replaceState({ view: 'home' }, '', '/#forum');
        setTimeout(() => {
          const forumEl = document.getElementById('forum-section');
          if (forumEl) {
            forumEl.scrollIntoView({ behavior: 'smooth' });
          }
        }, 200);
        return;
      }

      if (['profile', 'messages', 'contribute', 'admin', 'explore', 'notifications'].includes(pathname)) {
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
      } else if (hash === '#profile' || hash === '#messages' || hash === '#contribute' || hash === '#admin') {
        setIsAuthModalOpen(false);
        const targetView = hash.replace('#', '');
        setCurrentView(targetView as any);
        window.history.replaceState({ view: targetView }, '', `/${targetView}`);
      } else {
        setIsAuthModalOpen(false);
        if (pathname === '' || pathname === 'home') {
          setCurrentView('home');
          setSelectedTrail(null);
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
          showToast(`${event.data.message || 'Tài khoản của bạn đã được KÍCH HOẠT THÀNH CÔNG! Bạn có thể đăng nhập ngay.'}`, 'success');
        } else {
          showToast(`Lỗi kích hoạt: ${event.data.message || 'Mã xác thực không hợp lệ.'}`, 'error');
        }
      };
    }
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'trekmap_activated_signal' && e.newValue) {
        showToast('Tài khoản của bạn đã được KÍCH HOẠT THÀNH CÔNG! Bạn có thể đăng nhập ngay.', 'success');
        setIsAuthModalOpen(true);
      }
    };
    window.addEventListener('storage', handleStorage);

    // 2. Check if URL contains activation parameters
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('resetToken');
    const activateToken = urlParams.get('activateToken');

    if (activateToken) {
      fetch('/api/auth/activate-account', {
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
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const userData = json.user || json.data;
        if (json.success && userData) {
          if (userData.isBanned) {
            localStorage.removeItem('trekmap_token');
            setCurrentUser(null);
            showToast('Tài khoản của bạn đã bị Ban Quản Trị khóa do vi phạm quy định!', 'error');
            return;
          }
          setCurrentUser(userData);
        } else {
          localStorage.removeItem('trekmap_token');
          setCurrentUser(null);
          if (json.isBanned) {
            showToast('Tài khoản của bạn đã bị Ban Quản Trị khóa vĩnh viễn!', 'error');
          }
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
        const forumRes = await fetch('/api/forum', {
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentView]);

  const navigateToTrail = (trail: Trail) => {
    if (!trail) return;
    if (currentView !== 'detail') {
      setPreviousView(currentView);
    }
    setSelectedTrail(trail);
    setCurrentView('detail');
    const tid = trail.id || (trail as any)._id;
    if (tid) {
      window.location.hash = `#trail/${tid}`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectTrail = (trail: Trail) => {
    navigateToTrail(trail);
  };

  const handleSelectTrailById = (trailId: string) => {
    const found = trails.find((t) => t.id === trailId || (t as any)._id === trailId) || mockTrails.find((t) => t.id === trailId);
    if (found) {
      navigateToTrail(found);
    } else {
      fetchTrailById(trailId).then((t) => {
        if (t) navigateToTrail(t);
      });
    }
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

    const [pathPart, queryPart] = viewOrUrl.split('?');
    const targetView = pathPart.replace(/^\//, '');
    const queryString = queryPart ? `?${queryPart}` : '';

    if (targetView === 'home' || targetView === 'explore') {
      setSelectedTrail(null);
    }

    if (targetView === 'forum') {
      setSelectedTrail(null);
      if (currentView !== 'home' && currentView !== 'explore') {
        setPreviousView(currentView);
        setCurrentView('home');
      }
      window.history.pushState({ view: 'home' }, '', `/#forum${queryString}`);
      setTimeout(() => {
        const forumEl = document.getElementById('forum-section');
        if (forumEl) {
          forumEl.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      return;
    }

    const protectedViews = ['contribute', 'profile', 'admin', 'messages', 'notifications'];
    if (protectedViews.includes(targetView) && !currentUser && !localStorage.getItem('trekmap_token')) {
      showToast('Vui lòng đăng nhập tài khoản để sử dụng tính năng này.', 'info');
      setAuthModalInitialMode('login');
      setIsAuthModalOpen(true);
      return;
    }

    if (['home', 'explore', 'detail', 'contribute', 'profile', 'forum', 'admin', 'messages', 'notifications'].includes(targetView)) {
      if (currentView !== targetView && currentView !== 'detail') {
        setPreviousView(currentView);
      }
      setCurrentView(targetView as any);

      // Clean browser address bar URLs
      const cleanPath = targetView === 'home' ? '/' : `/${targetView}`;
      const newUrl = `${cleanPath}${queryString}`;
      window.history.pushState({ view: targetView }, '', newUrl);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const handleOpenIncidentReport = () => {
    if (!currentUser) {
      showToast('Vui lòng đăng nhập tài khoản để gửi báo cáo nguy hiểm thực địa.', 'info');
      setAuthModalInitialMode('login');
      setIsAuthModalOpen(true);
      return;
    }
    setIsIncidentModalOpen(true);
  };

  const handleCreateHomeThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      showToast('Vui lòng đăng nhập tài khoản để đăng bài thảo luận.', 'info');
      setAuthModalInitialMode('login');
      setIsAuthModalOpen(true);
      return;
    }
    if (!newTitle.trim() || !newContent.trim()) return;

    try {
      const token = localStorage.getItem('trekmap_token');
      const res = await fetch('/api/forum', {
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

  const [isEmergencyContactsOpen, setIsEmergencyContactsOpen] = useState(false);

  return (
    <SocketProvider currentUser={currentUser}>
      <DisconnectBanner />
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-main)' }}>
        <EmergencyContactsModal isOpen={isEmergencyContactsOpen} onClose={() => setIsEmergencyContactsOpen(false)} />
        <Navbar
          currentView={currentView}
          currentUser={currentUser}
          onNavigate={handleNavigate}
          onOpenIncidentModal={handleOpenIncidentReport}
          onOpenAuthModal={() => handleNavigate('login')}
          onSearchChange={(q) => setSearchQuery(q)}
          onLogout={() => setIsLogoutModalOpen(true)}
        />

      {/* Emergency Alert Banner - Clean Auto-rotating Ticker with Dismiss Button */}
      {!isAlertBannerDismissed && incidents.length > 0 && (() => {
        const currentInc = incidents[activeIncidentIndex % incidents.length];
        return (
          <div
            style={{
              background: 'linear-gradient(90deg, #991b1b 0%, #b91c1c 50%, #7f1d1d 100%)',
              color: '#fef2f2',
              padding: '8px 20px',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-bold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              borderBottom: '1px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 4px 15px rgba(220, 38, 38, 0.25)',
              position: 'relative',
              zIndex: 40,
            }}
          >
            <div style={{ flex: 1, textAlign: 'center', overflow: 'hidden' }}>
              <span
                key={currentInc.id}
                className="view-fade-in"
                style={{
                  display: 'inline-block',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}
              >
                <strong>CẢNH BÁO SỰ CỐ KHẨN: {currentInc.trailName}</strong> — {currentInc.description}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsAlertBannerDismissed(true)}
              title="Ẩn thông báo khẩn cấp"
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#ffffff',
                borderRadius: 20,
                padding: '3px 12px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                flexShrink: 0,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.45)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.25)')}
            >
              <IconX size={13} />
              <span>Ẩn</span>
            </button>
          </div>
        );
      })()}

      <ErrorBoundary fallbackTitle="Không thể tải nội dung trang">
        <main key={currentView} className="page-view-slide" style={{ flex: 1 }}>
        {/* VIEW 1: HOME & EXPLORE */}
        {(currentView === 'home' || currentView === 'explore') && (
          <div>
            {/* Cinematic Hero Section */}
            <HeroExpeditionSection
              trails={trails}
              selectedRegion={selectedRegion}
              onSelectRegion={setSelectedRegion}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              campsiteOnly={campsiteOnly}
              onToggleCampsite={() => setCampsiteOnly((prev) => !prev)}
              onOpenAdvancedFilter={() => setIsFilterOpen(true)}
              onScrollToMap={() => {
                const mapEl = document.getElementById('gis-map-section');
                if (mapEl) {
                  const offset = 80;
                  const bodyRect = document.body.getBoundingClientRect().top;
                  const elementRect = mapEl.getBoundingClientRect().top;
                  const elementPosition = elementRect - bodyRect;
                  const offsetPosition = elementPosition - offset;
                  window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                }
              }}
              onExploreClick={() => handleNavigate('explore')}
              onSelectTrail={handleSelectTrail}
            />

            {/* Main Content Container */}
            <div style={{ maxWidth: 1320, margin: '8px auto 60px auto', padding: '0 24px', position: 'relative', zIndex: 10 }}>
              {/* GIS Interactive 3D Terrain Map Stage */}
              <div id="gis-map-section">
                <InteractiveMapShowcase
                  trails={trails}
                  selectedTrail={null}
                  onSelectTrail={handleSelectTrail}
                  incidents={incidents}
                  selectedRegion={selectedRegion}
                  onSelectRegion={setSelectedRegion}
                  selectedMonth={selectedSeasonMonth}
                  onClearMonthFilter={() => setSelectedSeasonMonth(null)}
                />
              </div>

              {/* Full Alpine Community, Live Chatroom & Tactical Sidebar Master Hub (ĐẶT NGAY DƯỚI BẢN ĐỒ) */}
              <Suspense fallback={<PageLoadingFallback />}>
                <TrekForumView
                  isEmbedded={true}
                  currentUser={currentUser}
                  trails={trails}
                  onSelectTrail={handleSelectTrail}
                  onShowToast={(msg, type) => showToast(msg, type)}
                  onRequireLogin={(action) => {
                    showToast(`Vui lòng đăng nhập tài khoản để ${action}.`, 'info');
                    setAuthModalInitialMode('login');
                    setIsAuthModalOpen(true);
                  }}
                />
              </Suspense>

              {/* 12-Month Season Radar & Best Season Trails */}
              <SeasonExpeditionRadar
                trails={trails}
                onSelectTrail={handleSelectTrail}
                onFilterSeasonMonth={(month) => {
                  setSelectedSeasonMonth(month);
                  const mapEl = document.getElementById('gis-map-section');
                  if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth' });
                }}
              />

              {/* Bento Command Hub (Basecamp Radio + Livewire Radar + Guides + GPX HUD) */}
              <BentoCommandHub
                incidents={incidents}
                trails={trails}
                onSelectTrail={handleSelectTrail}
                onOpenIncidentModal={handleOpenIncidentReport}
                onNavigateToForum={() => handleNavigate('forum')}
                onShowToast={(msg, type) => showToast(msg, type)}
              />

              {/* All Trails Catalog (Grid vs Compact Mode) */}
              <section style={{ marginBottom: 56 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-primary)', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                      <IconHiking size={16} color="#00ffd5" /> KHO DỮ LIỆU ĐƯỜNG TREK VIỆT NAM
                    </div>
                    <h2 style={{ fontSize: 'clamp(1.3rem, 2.5vw, 1.75rem)', fontWeight: 900, color: 'var(--color-text-main)', margin: 0 }}>
                      Khám Phá Tất Cả Cung Đường ({trails.length})
                    </h2>
                    <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                      Danh sách dữ liệu GPX, cự ly và lán nghỉ được xác thực từ cộng đồng
                    </p>
                  </div>

                  {/* View Mode Switcher */}
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
                          color: viewMode === 'grid' ? '#041108' : 'var(--color-text-muted)',
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
                          color: viewMode === 'compact' ? '#041108' : 'var(--color-text-muted)',
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
                  /* Rich Tactical Compact List Row View */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {trails.slice(0, visibleTrailCount).map((t) => {
                      const isSelected = comparedTrails.some((ct) => ct.id === t.id);
                      let diffBadge = 'badge-info';
                      let diffText = 'Trung bình';
                      if (t.difficultyLevel >= 4) {
                        diffBadge = 'badge-error';
                        diffText = 'Thử thách cao';
                      } else if (t.difficultyLevel <= 2) {
                        diffBadge = 'badge-success';
                        diffText = 'Dễ (Beginner)';
                      }

                      return (
                        <div
                          key={t.id}
                          onClick={() => handleSelectTrail(t)}
                          className="card-hover-lift"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '160px 1.5fr 1.1fr 1fr auto',
                            gap: 18,
                            alignItems: 'center',
                            background: 'var(--color-bg-card)',
                            border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                            borderRadius: 16,
                            padding: '14px 18px',
                            cursor: 'pointer',
                            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                            boxShadow: 'var(--shadow-card)',
                          }}
                        >
                          {/* 1. Thumbnail & Badges */}
                          <div style={{ position: 'relative', width: 160, height: 104, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
                            <img
                              src={t.coverImage}
                              alt={t.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            {/* Altitude Badge at Bottom-Left */}
                            <div
                              style={{
                                position: 'absolute',
                                bottom: 6,
                                left: 6,
                                background: 'rgba(7, 13, 30, 0.88)',
                                backdropFilter: 'blur(6px)',
                                padding: '2px 7px',
                                borderRadius: 6,
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: 'var(--color-sky)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                            >
                              <IconMountain size={11} color="var(--color-sky)" />
                              <span>{t.maxAltitudeM}m</span>
                            </div>

                            {/* Status Badge at Top-Right */}
                            <div
                              style={{
                                position: 'absolute',
                                top: 6,
                                right: 6,
                                background: 'rgba(7, 13, 30, 0.92)',
                                backdropFilter: 'blur(6px)',
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                color: t.reviewCount && t.reviewCount > 0 ? 'var(--color-sun)' : 'var(--color-primary)',
                              }}
                            >
                              {t.reviewCount && t.reviewCount > 0 && t.rating ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <IconStar size={11} color="var(--color-sun)" fill="var(--color-sun)" />
                                  {`${Number(t.rating).toFixed(1)} (${t.reviewCount})`}
                                </span>
                              ) : (
                                'Mới'
                              )}
                            </div>
                          </div>

                          {/* 2. Identity & Geo Info */}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                              <span className="badge badge-success" style={{ fontSize: '0.68rem', fontWeight: 800 }}>{t.region}</span>
                              <span className="badge badge-info" style={{ fontSize: '0.68rem', fontWeight: 700 }}>{t.province}{t.district ? ` • ${t.district}` : ''}</span>
                              <span className={`badge ${diffBadge}`} style={{ fontSize: '0.68rem', fontWeight: 800 }}>
                                Cấp {t.difficultyLevel}/5 ({diffText})
                              </span>
                            </div>
                            <h4
                              style={{
                                fontSize: '1.05rem',
                                fontWeight: 800,
                                color: 'var(--color-text-main)',
                                margin: '0 0 4px 0',
                                lineHeight: 1.35,
                              }}
                            >
                              {t.name}
                            </h4>
                            {t.altNames && t.altNames.length > 0 && (
                              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)', fontStyle: 'italic', marginBottom: 4 }}>
                                Tên khác: {t.altNames.join(', ')}
                              </div>
                            )}
                            <div
                              style={{
                                fontSize: '0.78rem',
                                color: 'var(--color-text-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '100%',
                              }}
                            >
                              {t.description || 'Cung đường trekking với dữ liệu địa hình và trắc diện cao độ.'}
                            </div>
                          </div>

                          {/* 3. Key Metrics (Cự ly, Leo dốc, Thời gian) */}
                          <div
                            style={{
                              background: 'var(--color-bg-main)',
                              padding: '10px 14px',
                              borderRadius: 12,
                              border: '1px solid var(--color-border)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                              fontSize: '0.78rem',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                              <span>Cự ly di chuyển:</span>
                              <strong style={{ color: 'var(--color-primary)' }}>{t.distanceKm} km</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                              <span>Độ dốc tích lũy:</span>
                              <strong style={{ color: '#38bdf8' }}>+{t.elevationGainM}m</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                              <span>Thời gian dự kiến:</span>
                              <strong style={{ color: 'var(--color-sun)' }}>{t.durationHoursNote || `${t.durationDays} ngày`}</strong>
                            </div>
                          </div>

                          {/* 4. Amenities & Best Season */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                              {t.hasCampsite && (
                                <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: 6, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-primary)', border: '1px solid var(--color-border)', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                                  <IconTent size={11} color="var(--color-primary)" /> Bãi trại
                                </span>
                              )}
                              {t.hasWaterSource && (
                                <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: 6, background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid var(--color-border)', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                                  <IconDroplet size={11} color="#38bdf8" /> Nguồn nước
                                </span>
                              )}
                              {t.permitRequired && (
                                <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: 6, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', border: '1px solid var(--color-border)', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                                  Cần giấy phép
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <IconClock size={12} color="var(--color-text-dim)" />
                              <span>Mùa lý tưởng: <strong>{t.bestMonths && t.bestMonths.length > 0 ? `Tháng ${t.bestMonths.join(', ')}` : 'Quanh năm'}</strong></span>
                            </div>
                          </div>

                          {/* 5. Action Buttons */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleToggleCompare(t)}
                              className="btn btn-outline"
                              style={{
                                fontSize: '0.76rem',
                                padding: '6px 12px',
                                borderRadius: 10,
                                fontWeight: 700,
                                background: isSelected ? 'var(--color-primary)' : 'transparent',
                                color: isSelected ? '#041108' : 'var(--color-text-muted)',
                                borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {isSelected ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <IconCheck size={12} /> Đã chọn
                                </span>
                              ) : (
                                '+ So sánh'
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectTrail(t)}
                              className="btn btn-primary"
                              style={{
                                fontSize: '0.78rem',
                                padding: '8px 14px',
                                borderRadius: 10,
                                fontWeight: 800,
                                whiteSpace: 'nowrap',
                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                              }}
                            >
                              Chi Tiết & GPX →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Standard Grid View */
                  <div className="grid-3">
                    {trails.slice(0, visibleTrailCount).map((trail) => (
                      <TrailCard
                        key={trail.id}
                        trail={trail}
                        onSelect={handleSelectTrail}
                        isSelectedForCompare={comparedTrails.some((ct) => ct.id === trail.id)}
                        onToggleCompare={handleToggleCompare}
                      />
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

              {/* Safety & Leave No Trace Pledge */}
              <SafetyPledgeSection
                onOpenEmergencyContacts={() => setIsEmergencyContactsOpen(true)}
                onOpenIncidentReport={handleOpenIncidentReport}
              />
            </div>
          </div>
        )}

        {/* VIEW 2: TRAIL DETAIL */}
        {currentView === 'detail' && (
          selectedTrail ? (
            <TrailDetailView
              trail={selectedTrail}
              currentUser={currentUser}
              onBack={() => {
                const target = previousView && previousView !== 'detail' ? previousView : 'home';
                handleNavigate(target);
              }}
              onOpenIncidentModal={handleOpenIncidentReport}
              onRequireLogin={(action) => {
                showToast(`Vui lòng đăng nhập tài khoản để ${action}.`, 'info');
                setAuthModalInitialMode('login');
                setIsAuthModalOpen(true);
              }}
              incidents={incidents}
            />
          ) : (
            <div style={{ minHeight: '75vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
              <div style={{ width: 48, height: 48, border: '3px solid rgba(0, 255, 213, 0.2)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', fontWeight: 600 }}>
                Đang tải thông số cung đường trekking...
              </div>
            </div>
          )
        )}

        {/* VIEW 3: CONTRIBUTE WIZARD */}
        {currentView === 'contribute' && (
          !currentUser ? (
            <div style={{ maxWidth: 540, margin: '80px auto', textAlign: 'center', padding: '40px 24px', background: 'var(--color-bg-card)', borderRadius: 24, border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px auto', color: 'var(--color-sky)' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
              </div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--color-text-main)', fontWeight: 800, marginBottom: 8 }}>Yêu Cầu Đăng Nhập Tài Khoản</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: 24 }}>
                Tính năng đóng góp cung đường mới và tải tracklog GPX lên cộng đồng yêu cầu bạn phải có tài khoản đã xác thực.
              </p>
              <button className="btn btn-primary" onClick={() => { setAuthModalInitialMode('login'); setIsAuthModalOpen(true); }} style={{ padding: '11px 28px', fontSize: '0.92rem', borderRadius: 30 }}>
                Đăng Nhập Ngay
              </button>
            </div>
          ) : (
            <Suspense fallback={<PageLoadingFallback />}>
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
            </Suspense>
          )
        )}

        {/* VIEW 4: USER PROFILE */}
        {currentView === 'profile' && (
          !currentUser ? (
            <div style={{ maxWidth: 540, margin: '80px auto', textAlign: 'center', padding: '40px 24px', background: 'var(--color-bg-card)', borderRadius: 24, border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px auto', color: 'var(--color-sky)' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--color-text-main)', fontWeight: 800, marginBottom: 8 }}>Yêu Cầu Đăng Nhập Tài Khoản</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: 24 }}>
                Vui lòng đăng nhập để xem thông tin hồ sơ cá nhân, kho cung đường đã lưu, huy hiệu và lịch sử đóng góp.
              </p>
              <button className="btn btn-primary" onClick={() => { setAuthModalInitialMode('login'); setIsAuthModalOpen(true); }} style={{ padding: '11px 28px', fontSize: '0.92rem', borderRadius: 30 }}>
                Đăng Nhập Ngay
              </button>
            </div>
          ) : (
            <Suspense fallback={<PageLoadingFallback />}>
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
            </Suspense>
          )
        )}

        {/* VIEW 5: FORUM VIEW (ALPINE EXPEDITION HUB) */}
        {currentView === 'forum' && (
          <Suspense fallback={<PageLoadingFallback />}>
            <TrekForumView
              currentUser={currentUser}
              onBack={() => handleNavigate('home')}
              onShowToast={(msg, type) => showToast(msg, type)}
              onRequireLogin={(action) => {
                showToast(`Vui lòng đăng nhập tài khoản để ${action}.`, 'info');
                setAuthModalInitialMode('login');
                setIsAuthModalOpen(true);
              }}
            />
          </Suspense>
        )}

        {/* VIEW 6: ADMIN DASHBOARD (APPROVAL PORTAL) */}
        {currentView === 'admin' && (
          !currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'trusted') ? (
            <div style={{ maxWidth: 540, margin: '80px auto', textAlign: 'center', padding: '40px 24px', background: 'var(--color-bg-card)', borderRadius: 24, border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px auto', color: 'var(--color-error)' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--color-text-main)', fontWeight: 800, marginBottom: 8 }}>Từ Chối Quyền Truy Cập</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: 24 }}>
                Trang Quản Trị Hệ Thống chỉ dành riêng cho Quản Trị Viên (Admin). Vui lòng đăng nhập bằng tài khoản Quản Trị.
              </p>
              <button className="btn btn-primary" onClick={() => { setAuthModalInitialMode('login'); setIsAuthModalOpen(true); }} style={{ padding: '11px 28px', fontSize: '0.92rem', borderRadius: 30 }}>
                Đăng Nhập Tài Khoản Admin
              </button>
            </div>
          ) : (
            <Suspense fallback={<PageLoadingFallback />}>
              <AdminDashboardView
                onBack={() => {
                  handleNavigate('home');
                }}
                onShowToast={(msg, type) => showToast(msg, type)}
                currentUser={currentUser}
              />
            </Suspense>
          )
        )}

        {/* VIEW 7: MESSAGES PAGE */}
        {currentView === 'messages' && (
          <Suspense fallback={<PageLoadingFallback />}>
            <MessagesPage
              currentUser={currentUser}
              onShowToast={(msg, type) => showToast(msg, type)}
            />
          </Suspense>
        )}

        {/* VIEW 8: NOTIFICATIONS PAGE */}
        {currentView === 'notifications' && (
          <Suspense fallback={<PageLoadingFallback />}>
            <NotificationsPage
              currentUser={currentUser}
              onNavigate={handleNavigate}
            />
          </Suspense>
        )}
      </main>
      </ErrorBoundary>

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

      {isIncidentModalOpen && (
        <Suspense fallback={null}>
          <IncidentReportModal
            isOpen={isIncidentModalOpen}
            onClose={() => setIsIncidentModalOpen(false)}
            trailName={selectedTrail ? selectedTrail.name : undefined}
            trailId={selectedTrail ? (selectedTrail.id || (selectedTrail as any)._id) : undefined}
            trails={trails}
            incidents={incidents}
            currentUser={currentUser}
            onSuccess={async () => {
              const incData = await fetchIncidents();
              setIncidents(incData);
            }}
            onShowToast={(msg, type) => showToast(msg, type)}
          />
        </Suspense>
      )}

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
                <span style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '4px 8px', borderRadius: 8, display: 'inline-flex' }}>
                  <IconShieldAlert size={18} color="#ef4444" />
                </span>
                Hồ Sơ Cảnh Báo Sự Cố Khẩn & Bằng Chứng
              </h3>
              <button
                type="button"
                onClick={() => setSelectedIncidentDetail(null)}
                title="Đóng"
                aria-label="Đóng"
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}
              >
                <IconX size={18} />
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
                    <IconCheck size={12} color="#10b981" /> ĐÃ XÁC MINH HIỆN TRƯỜNG
                  </span>
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  {selectedIncidentDetail.reportedAt}
                </span>
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '8px 0 4px 0' }}>
                {selectedIncidentDetail.trailName}
              </h4>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-sky)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconMapPin size={13} color="var(--color-sky)" />
                Vị trí: {selectedIncidentDetail.locationNote || 'Đoạn đường nguy hiểm'} {selectedIncidentDetail.elevationM ? `(Độ cao ${selectedIncidentDetail.elevationM}m)` : ''}
              </div>
            </div>

            {/* BẰNG CHỨNG HÌNH ẢNH HIỆN TRƯỜNG */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Bằng Chứng Hình Ảnh Hiện Trường:</span>
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
                      Ảnh bằng chứng #{idx + 1}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <strong style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <IconPhone size={13} color="#ef4444" />
                    Hotline Cứu Hộ Khẩn Cấp:
                  </strong>
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
                style={{ flex: 1.4, borderRadius: 10, background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', border: 'none', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <IconAlertTriangle size={15} color="#ffffff" />
                Gửi Báo Cáo SOS Hỗ Trợ Khẩn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Trail Comparison Quick Bar */}
      {comparedTrails.length >= 1 && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9990,
            background: 'rgba(7, 13, 30, 0.95)',
            border: '1.5px solid var(--color-primary)',
            backdropFilter: 'blur(16px)',
            borderRadius: 30,
            padding: '8px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(74, 222, 128, 0.35)',
          }}
        >
          <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconScale size={18} color="var(--color-primary)" />
            <span>Đã chọn {comparedTrails.length}/3 cung đường</span>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsCompareModalOpen(true)}
            style={{
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 800,
              borderRadius: 20,
            }}
          >
            Mở Bảng So Sánh
          </button>

          <button
            type="button"
            onClick={() => setComparedTrails([])}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-dim)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '4px',
            }}
          >
            Xóa hết
          </button>
        </div>
      )}

      {/* Trail Comparison Modal */}
      {isCompareModalOpen && (
        <Suspense fallback={null}>
          <TrailComparisonModal
            trails={comparedTrails}
            isOpen={isCompareModalOpen}
            onClose={() => setIsCompareModalOpen(false)}
            onRemoveTrail={(trailId) => setComparedTrails((prev) => prev.filter((t) => t.id !== trailId))}
            onSelectTrail={handleSelectTrail}
          />
        </Suspense>
      )}

      {/* Floating Scroll-to-Top Button */}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title="Cuộn lên đầu trang"
          style={{
            position: 'fixed',
            bottom: 28,
            right: 28,
            zIndex: 9000,
            background: 'var(--color-bg-card)',
            border: '1.5px solid var(--color-primary)',
            color: 'var(--color-primary)',
            borderRadius: '50%',
            width: 44,
            height: 44,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 14px rgba(74, 222, 128, 0.3)',
            transition: 'all 0.25s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-primary)';
            e.currentTarget.style.color = '#070d1e';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--color-bg-card)';
            e.currentTarget.style.color = 'var(--color-primary)';
            e.currentTarget.style.transform = 'scale(1.0)';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      )}

      {/* TrekCopilot AI Virtual Assistant */}
      {!isAiAssistantOpen && (
        <TrekAssistantFab
          isOpen={isAiAssistantOpen}
          onToggle={() => setIsAiAssistantOpen((prev) => !prev)}
          hasScrollTop={showScrollTop}
        />
      )}

      {isAiAssistantOpen && (
        <Suspense fallback={null}>
          <TrekAssistantModal
            isOpen={isAiAssistantOpen}
            onClose={() => setIsAiAssistantOpen(false)}
            currentTrail={selectedTrail}
            currentUser={currentUser}
            onSelectTrail={handleSelectTrailById}
          />
        </Suspense>
      )}

      {/* Shared Expedition Itinerary Modal */}
      {sharedItineraryToken && (
        <Suspense fallback={null}>
          <SharedItineraryModal
            shareToken={sharedItineraryToken}
            isOpen={!!sharedItineraryToken}
            onClose={() => {
              setSharedItineraryToken(null);
              if (window.location.hash.startsWith('#itinerary/')) {
                history.replaceState(null, '', window.location.pathname + window.location.search);
              }
            }}
            onViewTrail={(tId) => handleSelectTrailById(tId)}
          />
        </Suspense>
      )}


        <Footer />
      </div>
    </SocketProvider>
  );
}

export default App;

