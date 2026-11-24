import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import {
  resolveAppRoute,
  buildCleanUrl,
  updateDocumentSeoMeta,
  isHubView,
  type AppView,
  type HubViewId,
  type HubQueryParams,
} from './utils/routing.js';
import { listOfflineTrailPacks } from './utils/offlinePack.js';
import { clearSensitiveSessionStorage } from './utils/storageScope.js';
import { triggerSmoothThemeTransition } from './utils/themeTransition.js';
import { isTopmostFocusTrap, useFocusTrap } from './hooks/useFocusTrap.js';
import { useSlidingIndicator } from './hooks/useSlidingIndicator.js';
import { SceneReveal } from './components/common/SceneReveal.js';
import { Navbar } from './components/layout/Navbar.js';
import { Footer } from './components/layout/Footer.js';
import { TrailCard } from './components/trail/TrailCard.js';
import { AdvancedFilterDrawer } from './components/search/AdvancedFilterDrawer.js';
import { HeroExpeditionSection } from './components/landing/HeroExpeditionSection.js';
import { HubShowcaseStrip } from './components/landing/HubShowcaseStrip.js';
import { SeasonExpeditionRadar } from './components/landing/SeasonExpeditionRadar.js';
import { SafetyPledgeSection } from './components/landing/SafetyPledgeSection.js';
import { ExpeditionHubBar } from './components/hub/ExpeditionHubBar.js';
import { SocketProvider, useSocket } from './context/SocketContext.js';
import { AuthModal } from './components/auth/AuthModal.js';
import { LogoutConfirmModal } from './components/auth/LogoutConfirmModal.js';
import { Toast } from './components/common/Toast.js';
import { fetchTrails, fetchTrailById, fetchIncidents } from './services/api.js';
import { mockTrails } from './data/seedData.js';
import { DEFAULT_VIETNAM_TRAIL_COVER } from './utils/cloudinary.js';
import { EmergencyContactsModal } from './components/common/EmergencyContactsModal.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import { TrekAssistantFab } from './components/ai-assistant/TrekAssistantFab.js';
import {
  IconShieldAlert,
  IconPhone,
  IconAlertTriangle,
  IconMapPin,
  IconScale,
  IconX,
  IconCheck,
  IconMountain,
  IconCalendar,
} from './components/common/SvgIcons.js';
import type { Trail, Incident, UserProfile } from './types.js';

// Lazy-loaded heavy views, 8 Flagship Hubs, and modals
const TrailDetailView = lazy(() =>
  import('./components/trail/TrailDetailView.js').then((m) => ({ default: m.TrailDetailView }))
);
const InteractiveMapShowcase = lazy(() =>
  import('./components/landing/InteractiveMapShowcase.js').then((m) => ({
    default: m.InteractiveMapShowcase,
  }))
);
const BentoCommandHub = lazy(() =>
  import('./components/landing/BentoCommandHub.js').then((m) => ({ default: m.BentoCommandHub }))
);
const TrailComparisonModal = lazy(() =>
  import('./components/trail/TrailComparisonModal.js').then((m) => ({
    default: m.TrailComparisonModal,
  }))
);
const TrailContributionWizard = lazy(() =>
  import('./components/contribution/TrailContributionWizard.js').then((m) => ({
    default: m.TrailContributionWizard,
  }))
);
const IncidentReportModal = lazy(() =>
  import('./components/incidents/IncidentReportModal.js').then((m) => ({
    default: m.IncidentReportModal,
  }))
);
const UserProfileView = lazy(() =>
  import('./components/profile/UserProfileView.js').then((m) => ({ default: m.UserProfileView }))
);
const AdminDashboardView = lazy(() =>
  import('./components/admin/AdminDashboardView.js').then((m) => ({ default: m.AdminDashboardView }))
);
const TrekForumView = lazy(() =>
  import('./components/forum/TrekForumView.js').then((m) => ({ default: m.TrekForumView }))
);
const MessagesPage = lazy(() =>
  import('./components/messages/MessagesPage.js').then((m) => ({ default: m.MessagesPage }))
);
const NotificationsPage = lazy(() =>
  import('./components/notifications/NotificationsPage.js').then((m) => ({
    default: m.NotificationsPage,
  }))
);
const TrekAssistantModal = lazy(() =>
  import('./components/ai-assistant/TrekAssistantModal.js').then((m) => ({
    default: m.TrekAssistantModal,
  }))
);
const SharedItineraryModal = lazy(() =>
  import('./components/trail/SharedItineraryModal.js').then((m) => ({
    default: m.SharedItineraryModal,
  }))
);
const SafetyTimerModal = lazy(() =>
  import('./components/safety/SafetyTimerModal.js').then((m) => ({ default: m.SafetyTimerModal }))
);
const AuthorProfileModal = lazy(() =>
  import('./components/forum/AuthorProfileModal.js').then((m) => ({
    default: m.AuthorProfileModal,
  }))
);
const CommandPaletteModal = lazy(() =>
  import('./components/common/CommandPaletteModal.js').then((m) => ({
    default: m.CommandPaletteModal,
  }))
);
const ShortcutsHelpModal = lazy(() =>
  import('./components/common/ShortcutsHelpModal.js').then((m) => ({
    default: m.ShortcutsHelpModal,
  }))
);
const LiveTrekTrackerModal = lazy(() =>
  import('./components/safety/LiveTrekTrackerModal.js').then((m) => ({
    default: m.LiveTrekTrackerModal,
  }))
);
const LiveBeaconViewerPage = lazy(() =>
  import('./components/safety/LiveBeaconViewerPage.js').then((m) => ({
    default: m.LiveBeaconViewerPage,
  }))
);

// 8 Flagship LOST Expedition Hubs
const PeakPassportView = lazy(() =>
  import('./components/hub/PeakPassportView.js').then((m) => ({ default: m.PeakPassportView }))
);
const SeasonAlmanacView = lazy(() =>
  import('./components/hub/SeasonAlmanacView.js').then((m) => ({ default: m.SeasonAlmanacView }))
);
const RoutePlannerView = lazy(() =>
  import('./components/hub/RoutePlannerView.js').then((m) => ({ default: m.RoutePlannerView }))
);
const FieldToolkitView = lazy(() =>
  import('./components/hub/FieldToolkitView.js').then((m) => ({ default: m.FieldToolkitView }))
);
const DirectoryCostView = lazy(() =>
  import('./components/hub/DirectoryCostView.js').then((m) => ({ default: m.DirectoryCostView }))
);
const TrainingPlannerView = lazy(() =>
  import('./components/hub/TrainingPlannerView.js').then((m) => ({ default: m.TrainingPlannerView }))
);
const GearOptimizerView = lazy(() =>
  import('./components/hub/GearOptimizerView.js').then((m) => ({ default: m.GearOptimizerView }))
);
const SafetyRadarView = lazy(() =>
  import('./components/hub/SafetyRadarView.js').then((m) => ({ default: m.SafetyRadarView }))
);

type TrailWithMongoId = Trail & { _id?: string };

interface CachedContributionRecord {
  id?: string;
  _id?: string;
  name: string;
  altNames?: string[];
  region?: Trail['region'];
  province?: string;
  district?: string;
  hamlet?: string;
  distanceKm?: number;
  elevationGainM?: number;
  maxAltitudeM?: number;
  durationHoursNote?: string;
  difficultyLevel?: number;
  bestMonths?: number[];
  avoidMonths?: number[];
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
  description?: string;
  transportationInfo?: string;
  coverImage?: string;
  permitRequired?: boolean;
  permitInfo?: string;
  hasCampsite?: boolean;
  hasWaterSource?: boolean;
  kidFriendly?: boolean;
  gpxTrack?: [number, number][];
  waypoints?: Trail['waypoints'];
  status?: Trail['status'];
  createdAt?: string;
  updatedAt?: string;
  rescueContact?: Trail['rescueContact'];
}

const PageLoadingFallback: React.FC = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '35vh',
      gap: 12,
      color: 'var(--color-primary)',
    }}
  >
    <div
      style={{
        width: 24,
        height: 24,
        border: '2.5px solid var(--color-border)',
        borderTopColor: 'var(--color-primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
      Đang tải giao diện...
    </span>
  </div>
);

const ModalLoadingFallback: React.FC<{ label?: string }> = ({ label = 'Đang mở cửa sổ...' }) =>
  createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={label}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal, 3000)' as unknown as number,
        background: 'var(--overlay-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          borderRadius: 6,
          padding: '18px 24px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: 'var(--shadow-3d)',
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            border: '2.5px solid var(--color-border)',
            borderTopColor: 'var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
          {label}
        </span>
      </div>
    </div>,
    document.body
  );

const DisconnectBanner: React.FC<{ hasCompareDock?: boolean }> = ({ hasCompareDock = false }) => {
  const { isConnected } = useSocket();
  if (isConnected) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: hasCompareDock ? 84 : 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 'var(--z-toast, 5000)' as unknown as number,
        background: 'var(--banner-danger-bg)',
        color: 'var(--banner-danger-text)',
        padding: '9px 18px',
        borderRadius: 6,
        fontSize: '0.8rem',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: 'var(--shadow-card)',
        border: '1px solid var(--banner-danger-border)',
        pointerEvents: 'none',
        maxWidth: 'calc(100vw - 32px)',
        transition: 'bottom 0.2s ease',
      }}
    >
      <span
        className="radar-pulse-dot"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--color-error)',
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      <span>Mất kết nối máy chủ — đang tự động thử kết nối lại...</span>
    </div>
  );
};

/**
 * Isolated incident ticker so its 5s rotation NEVER triggers root App() re-renders.
 * Automatically pauses when the browser tab is hidden.
 */
const IncidentTickerBanner: React.FC<{
  incidents: Incident[];
  onSelectIncident: (inc: Incident) => void;
  onDismiss: () => void;
}> = React.memo(({ incidents, onSelectIncident, onDismiss }) => {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (incidents.length <= 1) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setActiveIdx((prev) => (prev + 1) % incidents.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [incidents.length]);

  if (incidents.length === 0) return null;
  const currentInc = incidents[activeIdx % incidents.length];

  return (
    <div
      style={{
        background: 'var(--banner-danger-bg)',
        color: 'var(--banner-danger-text)',
        padding: '7px 24px',
        fontSize: '0.8rem',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        borderBottom: '1px solid var(--banner-danger-border)',
        position: 'relative',
        zIndex: 40,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectIncident(currentInc)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectIncident(currentInc);
          }
        }}
        title="Bấm để xem hồ sơ cảnh báo sự cố & bằng chứng hiện trường"
        style={{
          flex: 1,
          maxWidth: 1360,
          margin: '0 auto',
          overflow: 'hidden',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-error-text, var(--color-error))',
            flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Cảnh báo {(activeIdx % incidents.length) + 1}/{incidents.length}
        </span>
        <span
          style={{
            width: 1,
            height: 12,
            background: 'var(--banner-danger-border)',
            flexShrink: 0,
          }}
        />
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
          <strong style={{ fontWeight: 700 }}>{currentInc.trailName}:</strong>{' '}
          {currentInc.description}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => onSelectIncident(currentInc)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--banner-danger-text)',
            fontSize: '0.75rem',
            fontWeight: 700,
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            cursor: 'pointer',
          }}
        >
          Chi tiết
        </button>
        <button
          type="button"
          onClick={onDismiss}
          title="Ẩn thông báo"
          aria-label="Ẩn thông báo"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--banner-danger-text)',
            opacity: 0.72,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            padding: 2,
          }}
        >
          <IconX size={14} />
        </button>
      </div>
    </div>
  );
});

function formatIncidentTime(raw?: string): string {
  if (!raw) return 'Vừa cập nhật';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitialRoute() {
  if (typeof window === 'undefined') {
    return {
      view: 'home' as AppView,
      trailId: null as string | null,
      beaconToken: null as string | null,
      queryParams: null as HubQueryParams | null,
      publicProfileUsername: null as string | null,
      sharedItineraryToken: null as string | null,
    };
  }
  const resolved = resolveAppRoute(
    window.location.pathname,
    window.location.hash,
    window.location.search
  );
  return {
    view: resolved.view,
    trailId: resolved.trailId || null,
    beaconToken: resolved.beaconToken || null,
    queryParams: resolved.queryParams || null,
    publicProfileUsername: resolved.publicProfileUsername || null,
    sharedItineraryToken: resolved.sharedItineraryToken || null,
  };
}

function getInitialTrail(trailId: string | null): Trail | null {
  if (!trailId) return null;
  const seedFound = mockTrails.find(
    (t) => t.id === trailId || (t as TrailWithMongoId)._id === trailId || String(t.id) === trailId
  );
  if (seedFound) return seedFound;

  try {
    const cachedContribs = JSON.parse(
      localStorage.getItem('lost_contributions') || '[]'
    ) as CachedContributionRecord[];
    const contrib = cachedContribs.find(
      (c) =>
        c.id === trailId ||
        c._id === trailId ||
        `contrib-${c._id}` === trailId ||
        `contrib-${c.id}` === trailId
    );
    if (contrib) {
      const cover = contrib.coverImage || DEFAULT_VIETNAM_TRAIL_COVER;
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
        bestMonths:
          Array.isArray(contrib.bestMonths) && contrib.bestMonths.length > 0
            ? contrib.bestMonths
            : [10, 11, 12, 1, 2, 3, 4],
        avoidMonths: Array.isArray(contrib.avoidMonths) ? contrib.avoidMonths : [],
        startLat: Number(contrib.startLat) || 22.3364,
        startLng: Number(contrib.startLng) || 103.8438,
        endLat: Number(contrib.endLat) || 22.3032,
        endLng: Number(contrib.endLng) || 103.7753,
        description: contrib.description || 'Cung đường đóng góp cộng đồng.',
        transportationInfo: contrib.transportationInfo || '',
        coverImage: cover,
        galleryImages: [cover],
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
        createdAt: contrib.createdAt || new Date().toISOString(),
        updatedAt: contrib.updatedAt || new Date().toISOString(),
        rescueContact: contrib.rescueContact || {
          name: 'Hạt Kiểm Lâm ' + (contrib.province || 'Địa phương'),
          phone: '112 / 114 (Tổng đài Cứu nạn & PCCC Quốc gia 24/7)',
          rangerContact: 'Trạm Kiểm Lâm ' + (contrib.district || 'Cửa Rừng'),
        },
        rating: 0,
        reviewCount: 0,
      };
    }
  } catch {
    // ignore malformed localStorage
  }

  return null;
}

export function App() {
  const [initialRoute] = useState(getInitialRoute);
  const [currentView, setCurrentView] = useState<AppView>(initialRoute.view);
  const [previousView, setPreviousView] = useState<AppView>('home');
  const [hubInitialTrailId, setHubInitialTrailId] = useState<string | null>(
    isHubView(initialRoute.view) ? initialRoute.trailId : null
  );
  const [hubQueryParams, setHubQueryParams] = useState<HubQueryParams | null>(
    isHubView(initialRoute.view) ? initialRoute.queryParams : null
  );
  const trailFetchSeqRef = useRef<number>(0);
  const didActivateRef = useRef<boolean>(false);
  const forumScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (forumScrollTimerRef.current) {
        clearTimeout(forumScrollTimerRef.current);
      }
    };
  }, []);
  const [publicProfileUsername, setPublicProfileUsername] = useState<string | null>(
    initialRoute.publicProfileUsername
  );
  const [sharedItineraryToken, setSharedItineraryToken] = useState<string | null>(
    initialRoute.sharedItineraryToken
  );
  const [activeBeaconToken, setActiveBeaconToken] = useState<string | null>(
    initialRoute.beaconToken
  );

  // Full unfiltered catalog for all 8 Flagship Hubs & AI + filtered trails for Home Explorer
  const [catalogTrails, setCatalogTrails] = useState<Trail[]>(mockTrails);
  const [trails, setTrails] = useState<Trail[]>(mockTrails);
  const trailsRef = useRef<Trail[]>(catalogTrails);
  useEffect(() => {
    trailsRef.current = catalogTrails.length > 0 ? catalogTrails : trails;
  }, [catalogTrails, trails]);

  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(() =>
    initialRoute.view === 'detail' ? getInitialTrail(initialRoute.trailId) : null
  );
  const [trailLoadStatus, setTrailLoadStatus] = useState<'idle' | 'loading' | 'not_found'>(() =>
    initialRoute.view === 'detail' && initialRoute.trailId && !getInitialTrail(initialRoute.trailId)
      ? 'loading'
      : 'idle'
  );
  const [selectedSeasonMonth, setSelectedSeasonMonth] = useState<number | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncidentDetail, setSelectedIncidentDetail] = useState<Incident | null>(null);
  const incidentDetailDialogRef = useRef<HTMLDivElement>(null);
  const incidentDetailCloseBtnRef = useRef<HTMLButtonElement>(null);
  const [isAlertBannerDismissed, setIsAlertBannerDismissed] = useState(false);

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalInitialMode, setAuthModalInitialMode] = useState<'login' | 'register'>('login');
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [resetTokenUrl, setResetTokenUrl] = useState<string | null>(null);
  const [isEmergencyContactsOpen, setIsEmergencyContactsOpen] = useState(false);
  const [isSafetyTimerOpen, setIsSafetyTimerOpen] = useState(false);
  const [swWaitingWorker, setSwWaitingWorker] = useState<ServiceWorker | null>(null);
  const [deferredPwaInstall, setDeferredPwaInstall] = useState<{
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  } | null>(null);
  const [pwaBannerDismissed, setPwaBannerDismissed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isLiveTrackerOpen, setIsLiveTrackerOpen] = useState(false);
  const [liveTrackerTrail, setLiveTrackerTrail] = useState<Trail | null>(null);

  // Trail Comparison State
  const [comparedTrails, setComparedTrails] = useState<Trail[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // LOST AI Assistant State
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [aiContextTrail, setAiContextTrail] = useState<Trail | null>(null);
  const isAiAssistantOpenRef = useRef(false);
  useEffect(() => {
    isAiAssistantOpenRef.current = isAiAssistantOpen;
  }, [isAiAssistantOpen]);

  // Floating Scroll-to-Top State
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Toast Notification State
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    isOpen: boolean;
  }>({
    message: '',
    type: 'success',
    isOpen: false,
  });

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
      setToast({ message, type, isOpen: true });
    },
    []
  );

  const refreshIncidents = useCallback(async () => {
    const incData = await fetchIncidents();
    setIncidents(incData);
  }, []);

  // Load full catalog once on mount for Hubs, AI, and deep links (with IndexedDB offline-pack hydration)
  useEffect(() => {
    let active = true;
    const hydrateOfflinePacks = async () => {
      try {
        const packs = await listOfflineTrailPacks();
        if (!active || !Array.isArray(packs) || packs.length === 0) return;
        const offlineTrails = packs
          .map((p) => p.trailData)
          .filter((t): t is Trail => Boolean(t && t.id && t.name));
        if (offlineTrails.length === 0) return;
        setCatalogTrails((prev) => {
          const byId = new Map<string, Trail>(prev.map((t) => [t.id, t]));
          offlineTrails.forEach((t) => {
            if (!byId.has(t.id)) byId.set(t.id, t);
          });
          return Array.from(byId.values());
        });
      } catch {
        // IndexedDB unavailable
      }
    };

    void hydrateOfflinePacks();

    fetchTrails()
      .then((fullList) => {
        if (active && Array.isArray(fullList) && fullList.length > 0) {
          setCatalogTrails((prev) => {
            const byId = new Map<string, Trail>(fullList.map((t) => [t.id, t]));
            // Preserve IndexedDB offline packs for community/non-seed trails when offline fallback returns mockTrails
            prev.forEach((t) => {
              if (t?.id && !byId.has(t.id)) byId.set(t.id, t);
            });
            return Array.from(byId.values());
          });
        }
      })
      .catch(() => {
        // Offline: already hydrated from mockTrails + IndexedDB packs
      });
    fetchIncidents()
      .then((incData) => {
        if (active) setIncidents(incData);
      })
      .catch(() => {
        // Offline
      });
    return () => {
      active = false;
    };
  }, []);

  // If initial route is detail and trail wasn't in local seed/cache, fetch from API (or mark 404)
  useEffect(() => {
    if (initialRoute.view !== 'detail' || !initialRoute.trailId || selectedTrail) return;
    const reqId = ++trailFetchSeqRef.current;
    fetchTrailById(initialRoute.trailId)
      .then((trail) => {
        if (reqId !== trailFetchSeqRef.current) return;
        if (trail) {
          setSelectedTrail(trail);
          setTrailLoadStatus('idle');
        } else {
          setTrailLoadStatus('not_found');
        }
      })
      .catch(() => {
        if (reqId === trailFetchSeqRef.current) setTrailLoadStatus('not_found');
      });
  }, [initialRoute.view, initialRoute.trailId, selectedTrail]);

  // Scroll listener for Scroll-to-Top button
  useEffect(() => {
    let rafId = 0;
    const handleScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const next = window.scrollY > 400;
        setShowScrollTop((prev) => (prev === next ? prev : next));
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  useFocusTrap(Boolean(selectedIncidentDetail), incidentDetailDialogRef, {
    initialFocusRef: incidentDetailCloseBtnRef,
  });

  // Escape key closes Incident Detail Modal (strict LIFO via topmost focus trap + IME guard)
  useEffect(() => {
    if (!selectedIncidentDetail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (!isTopmostFocusTrap(incidentDetailDialogRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        setSelectedIncidentDetail(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIncidentDetail]);

  // Global Keyboard Hotkeys: Ctrl+K (Command Palette), ? (Shortcuts Help), Alt+A (LOST AI), Alt+T (Theme)
  useEffect(() => {
    const isEditableElement = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (target.isContentEditable) return true;
      return Boolean(target.closest('[contenteditable="true"]'));
    };

    const hasOtherModalOpen = (): boolean =>
      Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).some((el) => {
        const modalId = el.getAttribute('data-lost-modal');
        return modalId !== 'command-palette' && modalId !== 'shortcuts-help';
      });

    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;

      if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !e.shiftKey &&
        (e.code === 'KeyK' || e.key.toLowerCase() === 'k')
      ) {
        if (hasOtherModalOpen()) return;
        e.preventDefault();
        setIsShortcutsHelpOpen(false);
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (isEditableElement(e.target) || isEditableElement(document.activeElement)) {
        return;
      }

      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (hasOtherModalOpen()) return;
        e.preventDefault();
        setIsCommandPaletteOpen(false);
        setIsShortcutsHelpOpen((prev) => !prev);
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyA') {
        if (!isAiAssistantOpenRef.current && Boolean(document.querySelector('[aria-modal="true"]'))) {
          return;
        }
        e.preventDefault();
        setIsAiAssistantOpen((prev) => {
          if (prev) setAiContextTrail(null);
          return !prev;
        });
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyT') {
        e.preventDefault();
        const current = document.documentElement.getAttribute('data-theme');
        const nextTheme: 'dark' | 'light' = current === 'light' ? 'dark' : 'light';
        triggerSmoothThemeTransition();
        document.documentElement.setAttribute('data-theme', nextTheme);
        try {
          localStorage.setItem('theme', nextTheme);
        } catch {
          // ignore storage errors
        }
        window.dispatchEvent(
          new CustomEvent('lost:toggle-theme', { detail: { theme: nextTheme } })
        );
        showToast(
          nextTheme === 'light'
            ? 'Đã chuyển sang Giao diện Sáng (Alt+T)'
            : 'Đã chuyển sang Giao diện Tối (Alt+T)',
          'info'
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showToast]);

  // Global CustomEvents: lost:show-toast, lost:open-auth-modal, lost:open-ai-assistant, lost:open-live-tracker
  useEffect(() => {
    const handleGlobalToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; type?: 'success' | 'error' | 'info' | 'warning' }>)?.detail;
      if (detail?.message) {
        showToast(String(detail.message), detail.type || 'info');
      }
    };

    const handleGlobalAuthOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: 'login' | 'register' }>)?.detail;
      setAuthModalInitialMode(detail?.mode === 'register' ? 'register' : 'login');
      setIsAuthModalOpen(true);
    };

    const handleGlobalAiOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string; trailId?: string; trailName?: string }>)?.detail;
      if (detail?.trailId) {
        const matched =
          trailsRef.current.find(
            (t) => t.id === detail.trailId || (t as TrailWithMongoId)._id === detail.trailId
          ) || mockTrails.find((t) => t.id === detail.trailId);
        if (matched) setAiContextTrail(matched);
      }
      if (detail?.prompt) {
        try {
          sessionStorage.setItem(
            'lost_ai_pending_prompt',
            JSON.stringify({ prompt: String(detail.prompt), trailId: detail.trailId, ts: Date.now() })
          );
        } catch {
          // ignore storage failures
        }
      }
      setIsAiAssistantOpen(true);
    };

    const handleGlobalLiveTrackerOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ trailId?: string; customRouteId?: string }>)?.detail;
      if (detail?.customRouteId) {
        try {
          sessionStorage.setItem('lost_live_tracker_custom_route_id', String(detail.customRouteId));
        } catch {
          // ignore storage failures
        }
        setLiveTrackerTrail(null);
      } else if (detail?.trailId) {
        const matched =
          trailsRef.current.find(
            (t) => t.id === detail.trailId || (t as TrailWithMongoId)._id === detail.trailId
          ) || mockTrails.find((t) => t.id === detail.trailId);
        setLiveTrackerTrail(matched || null);
      } else {
        setLiveTrackerTrail(null);
      }
      setIsLiveTrackerOpen(true);
    };

    const handleSwUpdateAvailable = (event: Event) => {
      const worker = (event as CustomEvent<{ worker?: ServiceWorker }>)?.detail?.worker || null;
      if (worker) {
        setSwWaitingWorker(worker);
      } else {
        showToast('Đã có phiên bản LOST mới! Tải lại trang để áp dụng bản cập nhật.', 'info');
      }
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const promptEvt = event as unknown as {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
      };
      if (typeof promptEvt.prompt === 'function') {
        setDeferredPwaInstall(promptEvt);
      }
    };

    window.addEventListener('lost:show-toast', handleGlobalToast);
    window.addEventListener('lost:open-auth-modal', handleGlobalAuthOpen);
    window.addEventListener('lost:open-ai-assistant', handleGlobalAiOpen);
    window.addEventListener('lost:open-ai-with-prompt', handleGlobalAiOpen);
    window.addEventListener('lost:open-live-tracker', handleGlobalLiveTrackerOpen);
    window.addEventListener('lost:sw-update-available', handleSwUpdateAvailable);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('lost:show-toast', handleGlobalToast);
      window.removeEventListener('lost:open-auth-modal', handleGlobalAuthOpen);
      window.removeEventListener('lost:open-ai-assistant', handleGlobalAiOpen);
      window.removeEventListener('lost:open-ai-with-prompt', handleGlobalAiOpen);
      window.removeEventListener('lost:open-live-tracker', handleGlobalLiveTrackerOpen);
      window.removeEventListener('lost:sw-update-available', handleSwUpdateAvailable);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [showToast]);

  // Unified Single Router for URL Pathname, Hash & Query Params
  useEffect(() => {
    const syncRouteFromUrl = () => {
      const resolved = resolveAppRoute(
        window.location.pathname,
        window.location.hash,
        window.location.search
      );

      if (resolved.authModal) {
        setAuthModalInitialMode(resolved.authModal);
        setIsAuthModalOpen(true);
        return;
      }

      setIsAuthModalOpen(false);

      if (resolved.sharedItineraryToken) {
        setSharedItineraryToken(resolved.sharedItineraryToken);
        return;
      }
      if (!window.location.hash.startsWith('#itinerary/')) {
        setSharedItineraryToken(null);
      }

      if (resolved.publicProfileUsername) {
        setPublicProfileUsername(resolved.publicProfileUsername);
        setCurrentView(resolved.view);
        return;
      }
      setPublicProfileUsername(null);

      if (resolved.view === 'beacon' && resolved.beaconToken) {
        setCurrentView('beacon');
        setActiveBeaconToken(resolved.beaconToken);
        setSelectedTrail(null);
        setTrailLoadStatus('idle');
        setHubInitialTrailId(null);
        setHubQueryParams(null);
        return;
      }
      setActiveBeaconToken(null);

      if (resolved.view === 'detail' && resolved.trailId) {
        setCurrentView('detail');
        setHubInitialTrailId(null);
        setHubQueryParams(null);
        const targetId = resolved.trailId;
        const found =
          trailsRef.current.find(
            (t) => t.id === targetId || (t as TrailWithMongoId)._id === targetId
          ) || getInitialTrail(targetId);
        if (found) {
          trailFetchSeqRef.current += 1;
          setSelectedTrail(found);
          setTrailLoadStatus('idle');
          return;
        }
        setSelectedTrail(null);
        setTrailLoadStatus('loading');
        const reqId = ++trailFetchSeqRef.current;
        fetchTrailById(targetId)
          .then((trail) => {
            if (reqId !== trailFetchSeqRef.current) return;
            if (trail) {
              setSelectedTrail(trail);
              setTrailLoadStatus('idle');
            } else {
              setTrailLoadStatus('not_found');
            }
          })
          .catch(() => {
            if (reqId === trailFetchSeqRef.current) setTrailLoadStatus('not_found');
          });
        return;
      }

      if (resolved.view === 'forum') {
        const searchParams = new URLSearchParams(window.location.search);
        const hasThreadParam = searchParams.has('threadId');
        if (hasThreadParam) {
          setCurrentView('forum');
          return;
        }
        setCurrentView('home');
        if (forumScrollTimerRef.current) clearTimeout(forumScrollTimerRef.current);
        forumScrollTimerRef.current = setTimeout(() => {
          const forumEl = document.getElementById('forum-section');
          if (forumEl) forumEl.scrollIntoView({ behavior: 'smooth' });
        }, 180);
        return;
      }

      setCurrentView(resolved.view);
      setHubInitialTrailId(isHubView(resolved.view) ? resolved.trailId || null : null);
      setHubQueryParams(isHubView(resolved.view) ? resolved.queryParams || null : null);
      if (resolved.view === 'home' || resolved.view === 'explore' || isHubView(resolved.view)) {
        setSelectedTrail(null);
        setTrailLoadStatus('idle');
      }
    };

    syncRouteFromUrl();
    window.addEventListener('popstate', syncRouteFromUrl);
    window.addEventListener('hashchange', syncRouteFromUrl);
    return () => {
      window.removeEventListener('popstate', syncRouteFromUrl);
      window.removeEventListener('hashchange', syncRouteFromUrl);
    };
  }, []);

  // Cross-Tab Account Activation & Reset Token URL Handler
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('lost_tab_activation');
      channel.onmessage = (event) => {
        if (event.data?.type === 'ACCOUNT_ACTIVATED') {
          showToast(
            `${event.data.message || 'Tài khoản của bạn đã được KÍCH HOẠT THÀNH CÔNG! Bạn có thể đăng nhập ngay.'}`,
            'success'
          );
        } else {
          showToast(`Lỗi kích hoạt: ${event.data.message || 'Mã xác thực không hợp lệ.'}`, 'error');
        }
      };
    }
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'lost_activated_signal' && e.newValue) {
        showToast('Tài khoản của bạn đã được KÍCH HOẠT THÀNH CÔNG! Bạn có thể đăng nhập ngay.', 'success');
        setIsAuthModalOpen(true);
      }
    };
    window.addEventListener('storage', handleStorage);

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('resetToken');
    const activateToken = urlParams.get('activateToken');

    if (activateToken && !didActivateRef.current) {
      didActivateRef.current = true;
      fetch('/api/auth/activate-account', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activateToken }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            if (channel) {
              channel.postMessage({
                type: 'ACCOUNT_ACTIVATED',
                email: data.email,
                message: data.message,
              });
            }
            localStorage.setItem('lost_activated_signal', Date.now().toString());
            if (data.token && data.user) {
              localStorage.setItem('lost_token', data.token);
              setCurrentUser(data.user);
              window.dispatchEvent(new CustomEvent('lost:auth-changed'));
              showToast(data.message || 'Kích hoạt thành công và đã tự động đăng nhập!', 'success');
            } else {
              showToast(data.message || 'Tài khoản của bạn đã được kích hoạt thành công!', 'success');
              setIsAuthModalOpen(true);
            }
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            showToast(data.message || 'Mã kích hoạt không hợp lệ.', 'error');
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        })
        .catch(() => showToast('Không thể kết nối đến máy chủ kích hoạt.', 'error'));
    } else if (token) {
      Promise.resolve().then(() => {
        setResetTokenUrl(token);
        setIsAuthModalOpen(true);
      });
    }

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [showToast]);

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
  const [visibleTrailCount, setVisibleTrailCount] = useState(7);
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');
  const { trackRef: viewModeTrackRef, indicatorStyle: viewModeIndicatorStyle } =
    useSlidingIndicator<'grid' | 'compact'>(viewMode);

  // Auth Session Check + Silent Refresh Rotation
  useEffect(() => {
    async function checkAuthSession() {
      const token = localStorage.getItem('lost_token');

      const tryRefresh = async (): Promise<boolean> => {
        try {
          const rRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });
          const rJson = await rRes.json().catch(() => ({}));
          if (rRes.ok && rJson.success && rJson.token && rJson.user) {
            localStorage.setItem('lost_token', rJson.token);
            setCurrentUser(rJson.user);
            window.dispatchEvent(
              new CustomEvent('lost:auth-changed', { detail: { authenticated: true, user: rJson.user } })
            );
            return true;
          }
        } catch {
          // ignore offline
        }
        return false;
      };

      if (!token) {
        await tryRefresh();
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        const json = await res.json().catch(() => ({}));
        const userData = json.user || json.data;
        if (res.ok && json.success && userData) {
          if (userData.isBanned) {
            localStorage.removeItem('lost_token');
            clearSensitiveSessionStorage();
            setCurrentUser(null);
            window.dispatchEvent(
              new CustomEvent('lost:auth-changed', { detail: { authenticated: false } })
            );
            showToast('Tài khoản của bạn đã bị Ban Quản Trị khóa do vi phạm quy định!', 'error');
            return;
          }
          setCurrentUser(userData);
        } else if (res.status === 401) {
          const refreshed = await tryRefresh();
          if (!refreshed) {
            localStorage.removeItem('lost_token');
            clearSensitiveSessionStorage();
            setCurrentUser(null);
            window.dispatchEvent(
              new CustomEvent('lost:auth-changed', { detail: { authenticated: false } })
            );
          }
        } else if (res.status === 403 || json.isBanned) {
          localStorage.removeItem('lost_token');
          clearSensitiveSessionStorage();
          setCurrentUser(null);
          window.dispatchEvent(
            new CustomEvent('lost:auth-changed', { detail: { authenticated: false } })
          );
          if (json.isBanned) {
            showToast('Tài khoản của bạn đã bị Ban Quản Trị khóa vĩnh viễn!', 'error');
          }
        }
      } catch {
        // preserve session token on transient offline errors
      }
    }
    void checkAuthSession();
  }, [showToast]);

  // Dynamic Document <title> & OpenGraph SEO Metadata across ALL views + 8 Flagship Hubs
  useEffect(() => {
    if (currentView === 'detail' && selectedTrail) {
      updateDocumentSeoMeta({
        title: `${selectedTrail.name} (${selectedTrail.maxAltitudeM}m, ${selectedTrail.distanceKm}km) | LOST Việt Nam`,
        description: `${selectedTrail.name} tại ${selectedTrail.district}, ${selectedTrail.province} — Cao độ ${selectedTrail.maxAltitudeM}m, cự ly ${selectedTrail.distanceKm}km, bản đồ 3D DEM & cảnh báo thời tiết thực tế.`,
        image: selectedTrail.coverImage,
        path: buildCleanUrl('detail', selectedTrail.id),
      });
      return;
    }

    const totalCatalogTrailsCount =
      catalogTrails.length > 0 ? catalogTrails.length : trails.length > 0 ? trails.length : mockTrails.length;

    const viewTitles: Record<AppView, string> = {
      home: 'LOST Việt Nam — Bản Đồ Trekking 3D, Thời Tiết Núi & An Toàn Thực Địa',
      explore: 'Khám Phá Cung Đường Trekking Việt Nam | LOST',
      detail: 'Chi Tiết Cung Đường Trekking | LOST Việt Nam',
      forum: 'Diễn Đàn & Bộ Đàm Ghép Đoàn Trekking | LOST Việt Nam',
      contribute: 'Đóng Góp Cung Đường & GPX Thực Địa | LOST Việt Nam',
      profile: 'Hồ Sơ Thám Hiểm & Phân Tích Hành Trình | LOST Việt Nam',
      messages: 'Tin Nhắn & Nhóm Đoàn Trekking | LOST Việt Nam',
      notifications: 'Trung Tâm Thông Báo & Cảnh Báo | LOST Việt Nam',
      admin: 'Trung Tâm Quản Trị & Kiểm Toán | LOST Việt Nam',
      beacon: 'Theo dõi hành trình trực tiếp | LOST',
      passport: `Hộ Chiếu Đỉnh Núi & Thử Thách ${totalCatalogTrailsCount} Cung Đường Việt Nam | LOST`,
      almanac: 'Lịch Mùa Trekking & Săn Mây 12 Tháng Việt Nam | LOST',
      planner: 'Thiết Kế Cung Đường GPX & Phân Tích Độ Dốc DEM | LOST',
      toolkit: 'Công Cụ Sinh Tồn Thực Địa Offline (La Bàn, Mặt Trời, SOS) | LOST',
      directory: 'Danh Bạ Kiểm Lâm VQG, Porter & Dự Toán Chi Phí VNĐ | LOST',
      training: 'Giáo Án Thể Lực Leo Núi 4–8 Tuần Theo Đỉnh Mục Tiêu | LOST',
      gear: 'Tủ Đồ & Tối Ưu Trọng Lượng Balo Trekking | LOST',
      radar: 'Radar An Toàn Thực Địa & Cảnh Báo Sự Cố 24/7 | LOST',
    };

    updateDocumentSeoMeta({
      title: viewTitles[currentView] || viewTitles.home,
      description:
        'Nền tảng bản đồ trekking chuyên dụng cho địa hình Việt Nam với GPX chuẩn, 8 công cụ thám hiểm thực địa, bản đồ 3D DEM, gói Offline và ghép đoàn minh bạch.',
      path: buildCleanUrl(
        currentView,
        currentView === 'beacon'
          ? activeBeaconToken
          : isHubView(currentView)
            ? hubInitialTrailId
            : null,
        isHubView(currentView) ? hubQueryParams : null
      ),
    });
  }, [
    currentView,
    selectedTrail,
    activeBeaconToken,
    hubInitialTrailId,
    hubQueryParams,
    catalogTrails.length,
    trails.length,
  ]);

  // Debounced trail search & filter fetch
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let active = true;
    fetchTrails({
      region: selectedRegion !== 'All' ? selectedRegion : undefined,
      difficulty: selectedDifficulty || undefined,
      search: debouncedSearch || undefined,
      duration: selectedDuration || undefined,
      campsite: campsiteOnly || undefined,
      kidFriendly: kidFriendlyOnly || undefined,
      sortBy,
    }).then((trailData) => {
      if (active) setTrails(trailData);
    });
    return () => {
      active = false;
    };
  }, [
    selectedRegion,
    selectedDifficulty,
    debouncedSearch,
    selectedDuration,
    campsiteOnly,
    kidFriendlyOnly,
    sortBy,
  ]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentView]);

  // Apply selectedSeasonMonth filter cleanly (consistent with SeasonExpeditionRadar & InteractiveMapShowcase)
  const displayedTrails = useMemo(() => {
    if (!selectedSeasonMonth) return trails;
    return trails.filter((t) => {
      const avoid = Array.isArray(t.avoidMonths) && t.avoidMonths.includes(selectedSeasonMonth);
      if (avoid) return false;
      return !Array.isArray(t.bestMonths) || t.bestMonths.length === 0 || t.bestMonths.includes(selectedSeasonMonth);
    });
  }, [trails, selectedSeasonMonth]);

  const allCatalogTrails = useMemo(
    () => (catalogTrails.length > 0 ? catalogTrails : trails.length > 0 ? trails : mockTrails),
    [catalogTrails, trails]
  );

  const activeFilterCount =
    (selectedRegion !== 'All' ? 1 : 0) +
    (selectedDifficulty ? 1 : 0) +
    (selectedDuration ? 1 : 0) +
    (campsiteOnly ? 1 : 0) +
    (kidFriendlyOnly ? 1 : 0) +
    (sortBy !== 'rating_desc' ? 1 : 0) +
    (selectedSeasonMonth ? 1 : 0);

  const hasAnyActiveFilter = Boolean(searchQuery.trim()) || activeFilterCount > 0;

  const handleToggleCompare = (trail: Trail) => {
    setComparedTrails((prev) => {
      const exists = prev.some((t) => t.id === trail.id);
      if (exists) {
        return prev.filter((t) => t.id !== trail.id);
      }
      if (prev.length >= 4) {
        showToast('Chỉ có thể so sánh tối đa 4 cung đường cùng lúc.', 'info');
        return prev;
      }
      showToast(`Đã thêm "${trail.name}" vào bảng so sánh.`, 'success');
      return [...prev, trail];
    });
  };

  const navigateToTrail = useCallback(
    (trail: Trail) => {
      if (!trail) return;
      if (currentView !== 'detail') {
        setPreviousView(currentView);
      }
      setSelectedTrail(trail);
      setTrailLoadStatus('idle');
      setCurrentView('detail');
      setHubInitialTrailId(null);
      const tid = trail.id || (trail as TrailWithMongoId)._id;
      if (tid) {
        window.history.pushState(
          { view: 'detail', trailId: tid },
          '',
          buildCleanUrl('detail', String(tid))
        );
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [currentView]
  );

  const handleSelectTrail = useCallback(
    (trail: Trail) => {
      navigateToTrail(trail);
    },
    [navigateToTrail]
  );

  const handleSelectTrailById = useCallback(
    (trailId: string) => {
      const found =
        trailsRef.current.find(
          (t) => t.id === trailId || (t as TrailWithMongoId)._id === trailId
        ) || mockTrails.find((t) => t.id === trailId);
      if (found) {
        trailFetchSeqRef.current += 1;
        navigateToTrail(found);
      } else {
        setCurrentView('detail');
        setSelectedTrail(null);
        setTrailLoadStatus('loading');
        window.history.pushState({ view: 'detail', trailId }, '', buildCleanUrl('detail', trailId));
        const reqId = ++trailFetchSeqRef.current;
        fetchTrailById(trailId)
          .then((t) => {
            if (reqId !== trailFetchSeqRef.current) return;
            if (t) {
              setSelectedTrail(t);
              setTrailLoadStatus('idle');
            } else {
              setTrailLoadStatus('not_found');
            }
          })
          .catch(() => {
            if (reqId === trailFetchSeqRef.current) setTrailLoadStatus('not_found');
          });
      }
    },
    [navigateToTrail]
  );

  const handleNavigate = useCallback(
    (viewOrUrl: string) => {
      if (!viewOrUrl) return;
      const trimmed = viewOrUrl.trim();

      if (trimmed === 'login' || trimmed === '#login') {
        setAuthModalInitialMode('login');
        setIsAuthModalOpen(true);
        return;
      }
      if (trimmed === 'register' || trimmed === '#register') {
        setAuthModalInitialMode('register');
        setIsAuthModalOpen(true);
        return;
      }

      // Support full deep-links: /trails/:id, #trail/:id, #profile-<username>, /profile/:username, /hub?trailId=...
      const [beforeHash, hashFrag] = trimmed.split('#');
      const [rawPathPart, rawQueryPart] = (beforeHash || '').split('?');
      const resolved = resolveAppRoute(
        rawPathPart ? (rawPathPart.startsWith('/') ? rawPathPart : `/${rawPathPart}`) : '/',
        hashFrag ? `#${hashFrag}` : '',
        rawQueryPart ? `?${rawQueryPart}` : ''
      );

      if (resolved.publicProfileUsername) {
        setPublicProfileUsername(resolved.publicProfileUsername);
        window.history.pushState(
          { view: currentView },
          '',
          `/#profile-${encodeURIComponent(resolved.publicProfileUsername)}`
        );
        return;
      }

      if (resolved.view === 'detail' && resolved.trailId) {
        setActiveBeaconToken(null);
        handleSelectTrailById(resolved.trailId);
        return;
      }

      if (resolved.view === 'beacon' && resolved.beaconToken) {
        if (currentView !== 'beacon') {
          setPreviousView(currentView);
        }
        setActiveBeaconToken(resolved.beaconToken);
        setSelectedTrail(null);
        setTrailLoadStatus('idle');
        setHubInitialTrailId(null);
        setHubQueryParams(null);
        setCurrentView('beacon');
        window.history.pushState(
          { view: 'beacon', beaconToken: resolved.beaconToken },
          '',
          buildCleanUrl('beacon', resolved.beaconToken)
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setActiveBeaconToken(null);

      const targetView = resolved.view;
      const queryString = rawQueryPart ? `?${rawQueryPart}` : '';

      if (targetView === 'home' || targetView === 'explore') {
        setSelectedTrail(null);
        setTrailLoadStatus('idle');
        setHubInitialTrailId(null);
        setHubQueryParams(null);
      }

      if (targetView === 'forum') {
        setSelectedTrail(null);
        setHubInitialTrailId(null);
        setHubQueryParams(null);
        if (rawQueryPart && rawQueryPart.includes('threadId=')) {
          setPreviousView(currentView);
          setCurrentView('forum');
          window.history.pushState({ view: 'forum' }, '', `/forum${queryString}`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        if (currentView !== 'home' && currentView !== 'explore') {
          setPreviousView(currentView);
          setCurrentView('home');
        }
        window.history.pushState({ view: 'home' }, '', `/#forum${queryString}`);
        if (forumScrollTimerRef.current) clearTimeout(forumScrollTimerRef.current);
        forumScrollTimerRef.current = setTimeout(() => {
          const forumEl = document.getElementById('forum-section');
          if (forumEl) forumEl.scrollIntoView({ behavior: 'smooth' });
        }, 140);
        return;
      }

      if (resolved.isProtected && !currentUser && !localStorage.getItem('lost_token')) {
        showToast('Vui lòng đăng nhập tài khoản để sử dụng tính năng này.', 'info');
        setAuthModalInitialMode('login');
        setIsAuthModalOpen(true);
        return;
      }

      if (currentView !== targetView && currentView !== 'detail') {
        setPreviousView(currentView);
      }
      setCurrentView(targetView);

      if (isHubView(targetView)) {
        const tid = resolved.trailId || null;
        const qParams = resolved.queryParams || null;
        setHubInitialTrailId(tid);
        setHubQueryParams(qParams);
        setSelectedTrail(null);
        window.history.pushState(
          { view: targetView, trailId: tid, queryParams: qParams },
          '',
          buildCleanUrl(targetView, tid, qParams)
        );
      } else {
        setHubInitialTrailId(null);
        setHubQueryParams(null);
        const cleanPath = buildCleanUrl(targetView);
        window.history.pushState({ view: targetView }, '', `${cleanPath}${queryString}`);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [currentView, currentUser, handleSelectTrailById, showToast]
  );

  const handleResetFilters = () => {
    setSelectedRegion('All');
    setSelectedDifficulty(null);
    setSelectedDuration(null);
    setCampsiteOnly(false);
    setKidFriendlyOnly(false);
    setSortBy('rating_desc');
    setSearchQuery('');
    setSelectedSeasonMonth(null);
  };

  const handleConfirmLogout = async () => {
    const token = localStorage.getItem('lost_token');
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Proceed with local logout even if offline
      }
    }
    localStorage.removeItem('lost_token');
    clearSensitiveSessionStorage();
    setCurrentUser(null);
    setIsLogoutModalOpen(false);
    window.dispatchEvent(new CustomEvent('lost:auth-changed', { detail: { authenticated: false } }));
    showToast('Đã đăng xuất tài khoản thành công.', 'info');
    handleNavigate('home');
  };

  const handleOpenIncidentReport = useCallback(() => {
    if (!currentUser) {
      showToast('Vui lòng đăng nhập tài khoản để gửi báo cáo nguy hiểm thực địa.', 'info');
      setAuthModalInitialMode('login');
      setIsAuthModalOpen(true);
      return;
    }
    setIsIncidentModalOpen(true);
  }, [currentUser, showToast]);

  const handleOpenLiveTracker = useCallback(
    (trail?: Trail | null) => {
      setLiveTrackerTrail(trail || selectedTrail || null);
      setIsLiveTrackerOpen(true);
    },
    [selectedTrail]
  );

  const handleOpenAiWithPrompt = useCallback((prompt: string) => {
    window.dispatchEvent(new CustomEvent('lost:open-ai-assistant', { detail: { prompt } }));
  }, []);

  const handleOpenAiAssistant = useCallback(() => {
    setIsAiAssistantOpen(true);
  }, []);

  const handleCloseCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(false);
  }, []);

  const handlePaletteSelectTrail = useCallback(
    (trail: Trail) => {
      setIsCommandPaletteOpen(false);
      handleSelectTrail(trail);
    },
    [handleSelectTrail]
  );

  const handlePaletteNavigateView = useCallback(
    (view: string, trailId?: string) => {
      setIsCommandPaletteOpen(false);
      if (view.includes('?')) {
        handleNavigate(view);
      } else {
        handleNavigate(trailId ? `/${view}?trailId=${encodeURIComponent(trailId)}` : view);
      }
    },
    [handleNavigate]
  );

  const handlePaletteOpenAi = useCallback(
    (prompt: string) => {
      setIsCommandPaletteOpen(false);
      handleOpenAiWithPrompt(prompt);
    },
    [handleOpenAiWithPrompt]
  );

  const handlePaletteOpenEmergency = useCallback(() => {
    setIsCommandPaletteOpen(false);
    setIsEmergencyContactsOpen(true);
  }, []);

  const handlePaletteOpenLiveTracker = useCallback(() => {
    setIsCommandPaletteOpen(false);
    handleOpenLiveTracker();
  }, [handleOpenLiveTracker]);

  const handleCloseLiveTracker = useCallback(() => {
    setIsLiveTrackerOpen(false);
    setLiveTrackerTrail(null);
  }, []);

  const handleOpenShortcutsHelp = useCallback(() => {
    setIsShortcutsHelpOpen(true);
  }, []);

  const handleCloseShortcutsHelp = useCallback(() => {
    setIsShortcutsHelpOpen(false);
  }, []);

  const handleStartTripWithBudget = useCallback(
    (trailId: string, budgetNote: string) => {
      try {
        sessionStorage.setItem(
          'lost_trip_budget_draft',
          JSON.stringify({ trailId, budgetNote, ts: Date.now() })
        );
      } catch {
        // ignore storage quota
      }
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(budgetNote).catch(() => { });
      }
      showToast('Đã sao chép bảng dự toán chi phí & chuyển sang khu vực Lập Đoàn!', 'success');
      handleNavigate('forum');
    },
    [handleNavigate, showToast]
  );

  const isDedicatedAdminShell =
    currentView === 'admin' &&
    Boolean(currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator'));

  return (
    <SocketProvider currentUser={currentUser}>
      <div className="lost-grain-overlay" aria-hidden="true" />
      <DisconnectBanner hasCompareDock={comparedTrails.length >= 1} />
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-bg-main)',
        }}
      >
        <EmergencyContactsModal
          isOpen={isEmergencyContactsOpen}
          onClose={() => setIsEmergencyContactsOpen(false)}
          currentUser={currentUser}
          trails={allCatalogTrails}
        />
        {!isDedicatedAdminShell && (
          <Navbar
            currentView={currentView}
            currentUser={currentUser}
            searchQuery={searchQuery}
            trailsCount={allCatalogTrails.length}
            onNavigate={handleNavigate}
            onOpenIncidentModal={handleOpenIncidentReport}
            onOpenAuthModal={() => handleNavigate('login')}
            onSearchChange={(q) => setSearchQuery(q)}
            onLogout={() => setIsLogoutModalOpen(true)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onOpenLiveTracker={() => handleOpenLiveTracker()}
            onOpenShortcuts={handleOpenShortcutsHelp}
          />
        )}

        {/* Slim Editorial Field Safety Notice Strip (Isolated Memoized Ticker — Zero Root Re-Render) */}
        {!isDedicatedAdminShell && !isAlertBannerDismissed && incidents.length > 0 && (
          <IncidentTickerBanner
            incidents={incidents}
            onSelectIncident={setSelectedIncidentDetail}
            onDismiss={() => setIsAlertBannerDismissed(true)}
          />
        )}

        <ErrorBoundary fallbackTitle="Không thể tải nội dung trang">
          <main key={currentView} tabIndex={-1} className="page-view-slide" style={{ flex: 1, outline: 'none' }}>
            {/* VIEW 1: HOME & EXPLORE */}
            {(currentView === 'home' || currentView === 'explore') && (
              <div>
                <HeroExpeditionSection
                  trails={displayedTrails}
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
                      const offsetPosition = elementRect - bodyRect - offset;
                      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                    }
                  }}
                  onScrollToAllTrails={() => {
                    const trailsEl =
                      document.getElementById('all-trails-section') ||
                      document.getElementById('gis-map-section');
                    if (trailsEl) {
                      const offset = 80;
                      const bodyRect = document.body.getBoundingClientRect().top;
                      const elementRect = trailsEl.getBoundingClientRect().top;
                      const offsetPosition = elementRect - bodyRect - offset;
                      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                    }
                  }}
                  onExploreClick={() => handleNavigate('explore')}
                  onSelectTrail={handleSelectTrail}
                  onOpenEmergencyContacts={() => setIsEmergencyContactsOpen(true)}
                  activeFilterCount={activeFilterCount}
                />

                {/* Main Content Container */}
                <div
                  style={{
                    maxWidth: 1320,
                    margin: '8px auto 60px auto',
                    padding: '0 24px',
                    position: 'relative',
                    zIndex: 10,
                  }}
                >
                  {/* 8 Flagship Expedition Hubs Editorial Showcase Strip */}
                  <SceneReveal>
                    <HubShowcaseStrip
                      trailsCount={allCatalogTrails.length}
                      onNavigateHub={(hub) => handleNavigate(hub)}
                      onOpenLiveTracker={() => handleOpenLiveTracker()}
                      onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
                    />
                  </SceneReveal>

                  {/* GIS Interactive 3D Terrain Map Stage */}
                  <SceneReveal id="gis-map-section">
                    <Suspense fallback={<PageLoadingFallback />}>
                      <InteractiveMapShowcase
                        trails={
                          debouncedSearch.trim() ||
                            selectedDifficulty ||
                            selectedDuration ||
                            campsiteOnly ||
                            kidFriendlyOnly
                            ? displayedTrails
                            : allCatalogTrails
                        }
                        selectedTrail={null}
                        onSelectTrail={handleSelectTrail}
                        incidents={incidents}
                        selectedRegion={selectedRegion}
                        onSelectRegion={setSelectedRegion}
                        selectedMonth={selectedSeasonMonth}
                        onClearMonthFilter={() => setSelectedSeasonMonth(null)}
                        onExploreFullMap={() => handleNavigate('planner')}
                      />
                    </Suspense>
                  </SceneReveal>

                  {/* Full Alpine Community, Live Chatroom & Tactical Sidebar Master Hub */}
                  <SceneReveal id="forum-section">
                    <Suspense fallback={<PageLoadingFallback />}>
                      <TrekForumView
                        isEmbedded={true}
                        currentUser={currentUser}
                        trails={allCatalogTrails}
                        onSelectTrail={handleSelectTrail}
                        onShowToast={(msg, type) => showToast(msg, type)}
                        onRequireLogin={(action) => {
                          showToast(`Vui lòng đăng nhập tài khoản để ${action}.`, 'info');
                          setAuthModalInitialMode('login');
                          setIsAuthModalOpen(true);
                        }}
                      />
                    </Suspense>
                  </SceneReveal>

                  {/* 12-Month Season Radar & Best Season Trails */}
                  <SceneReveal className="cv-auto">
                    <SeasonExpeditionRadar
                      trails={allCatalogTrails}
                      onSelectTrail={handleSelectTrail}
                      onFilterSeasonMonth={(month) => {
                        setSelectedSeasonMonth(month);
                        const mapEl = document.getElementById('gis-map-section');
                        if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth' });
                      }}
                    />
                  </SceneReveal>

                  {/* Bento Command Hub */}
                  <SceneReveal className="cv-auto">
                    <Suspense fallback={<PageLoadingFallback />}>
                      <BentoCommandHub
                        incidents={incidents}
                        trails={allCatalogTrails}
                        onSelectTrail={handleSelectTrail}
                        onOpenIncidentModal={handleOpenIncidentReport}
                        onNavigateToForum={() => handleNavigate('forum')}
                        onShowToast={(msg, type) => showToast(msg, type)}
                      />
                    </Suspense>
                  </SceneReveal>

                  {/* All Trails Catalog (Grid vs Compact Mode) */}
                  <SceneReveal className="cv-auto">
                    <section id="all-trails-section" style={{ marginBottom: 56, paddingTop: 12 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'space-between',
                          marginBottom: 22,
                          flexWrap: 'wrap',
                          gap: 12,
                        }}
                      >
                        <div>
                          <div className="section-eyebrow">04 / Danh mục tuyến trek</div>
                          <h2
                            className="font-editorial"
                            style={{
                              fontSize: 'clamp(1.75rem, 3.2vw, 2.55rem)',
                              fontWeight: 500,
                              color: 'var(--color-text-main)',
                              margin: 0,
                              letterSpacing: '-0.025em',
                              lineHeight: 1.12,
                            }}
                          >
                            Kho cung đường{' '}
                            <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                              Việt Nam ({displayedTrails.length})
                            </span>
                          </h2>
                          <p style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', margin: '6px 0 0 0' }}>
                            Dữ liệu GPX, cự ly, độ dốc và lán hạ trại đã được cộng đồng xác thực.
                            {selectedSeasonMonth ? ` Đang lọc theo mùa đẹp Tháng ${selectedSeasonMonth}.` : ''}
                          </p>
                        </div>

                        {/* Clean View Mode Switcher + Filter Reset */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {selectedSeasonMonth && (
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => setSelectedSeasonMonth(null)}
                              style={{
                                fontSize: '0.78rem',
                                padding: '6px 10px',
                                borderRadius: 4,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                borderColor: 'var(--color-primary)',
                                color: 'var(--color-primary)',
                              }}
                            >
                              <IconCalendar size={13} />
                              <span>Tháng {selectedSeasonMonth}</span>
                              <IconX size={12} />
                            </button>
                          )}

                          <div
                            ref={viewModeTrackRef}
                            className="lost-glider-track"
                            style={{
                              display: 'flex',
                              background: 'var(--color-bg-card)',
                              padding: 3,
                              borderRadius: 6,
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            <span
                              aria-hidden="true"
                              className="lost-glider-pill with-accent"
                              style={viewModeIndicatorStyle}
                            />
                            <button
                              type="button"
                              data-glider-active={viewMode === 'grid' ? 'true' : undefined}
                              className="lost-glider-item"
                              onClick={() => setViewMode('grid')}
                              style={{
                                padding: '6px 12px',
                                borderRadius: 4,
                                border: 'none',
                                background: 'transparent',
                                color:
                                  viewMode === 'grid'
                                    ? 'var(--color-text-main)'
                                    : 'var(--color-text-dim)',
                                fontWeight: viewMode === 'grid' ? 700 : 500,
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                transition: 'color 200ms ease',
                              }}
                            >
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.1"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <rect x="3" y="3" width="7" height="7" />
                                <rect x="14" y="3" width="7" height="7" />
                                <rect x="14" y="14" width="7" height="7" />
                                <rect x="3" y="14" width="7" height="7" />
                              </svg>
                              <span>Lưới</span>
                            </button>
                            <button
                              type="button"
                              data-glider-active={viewMode === 'compact' ? 'true' : undefined}
                              className="lost-glider-item"
                              onClick={() => setViewMode('compact')}
                              style={{
                                padding: '6px 12px',
                                borderRadius: 4,
                                border: 'none',
                                background: 'transparent',
                                color:
                                  viewMode === 'compact'
                                    ? 'var(--color-text-main)'
                                    : 'var(--color-text-dim)',
                                fontWeight: viewMode === 'compact' ? 700 : 500,
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                transition: 'color 200ms ease',
                              }}
                            >
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.1"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <line x1="8" y1="6" x2="21" y2="6" />
                                <line x1="8" y1="12" x2="21" y2="12" />
                                <line x1="8" y1="18" x2="21" y2="18" />
                                <line x1="3" y1="6" x2="3.01" y2="6" />
                                <line x1="3" y1="12" x2="3.01" y2="12" />
                                <line x1="3" y1="18" x2="3.01" y2="18" />
                              </svg>
                              <span>Danh sách</span>
                            </button>
                          </div>

                          {hasAnyActiveFilter && (
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={handleResetFilters}
                              style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: 4 }}
                            >
                              Xóa bộ lọc
                            </button>
                          )}
                        </div>
                      </div>

                      {displayedTrails.length === 0 ? (
                        <div
                          className="card"
                          style={{
                            textAlign: 'center',
                            padding: '48px 24px',
                            color: 'var(--color-text-muted)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 14,
                          }}
                        >
                          <IconMountain size={28} color="var(--color-text-dim)" />
                          <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>
                            Không tìm thấy cung đường phù hợp với bộ lọc hiện tại.
                          </div>
                          {hasAnyActiveFilter && (
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={handleResetFilters}
                              style={{ padding: '8px 18px', fontSize: '0.84rem', borderRadius: 4 }}
                            >
                              Xóa bộ lọc &amp; Xem tất cả
                            </button>
                          )}
                        </div>
                      ) : viewMode === 'compact' ? (
                        /* Swiss Cartographic Expedition Manifest Table */
                        <div
                          key="compact"
                          className="tab-content-slide"
                          style={{
                            borderTop: '1px solid var(--color-border-strong)',
                            background: 'var(--color-bg-card)',
                          }}
                        >
                          <div
                            className="manifest-table-row"
                            style={{
                              cursor: 'default',
                              paddingTop: 11,
                              paddingBottom: 11,
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              letterSpacing: '0.12em',
                              textTransform: 'uppercase',
                              color: 'var(--color-text-dim)',
                              background: 'var(--color-surface-elevated)',
                            }}
                          >
                            <span>#</span>
                            <span>Cung đường &amp; Địa danh</span>
                            <span className="manifest-col-hide-sm">Đỉnh cao</span>
                            <span className="manifest-col-hide-sm">Cự ly</span>
                            <span className="manifest-col-hide-sm">Độ khó</span>
                            <span className="manifest-col-hide-sm">Thời gian</span>
                            <span style={{ textAlign: 'right' }}>Hồ sơ</span>
                          </div>

                          {displayedTrails.slice(0, visibleTrailCount).map((t, idx) => {
                            const isSelected = comparedTrails.some((ct) => ct.id === t.id);
                            const diffLabel =
                              t.difficultyLevel >= 4
                                ? `Khó ${t.difficultyLevel}/5`
                                : t.difficultyLevel === 3
                                  ? 'Trung bình 3/5'
                                  : `Dễ ${t.difficultyLevel}/5`;
                            const diffColor =
                              t.difficultyLevel >= 4
                                ? 'var(--color-earth)'
                                : t.difficultyLevel === 3
                                  ? 'var(--color-sun)'
                                  : 'var(--color-primary)';

                            return (
                              <div
                                key={t.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => handleSelectTrail(t)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleSelectTrail(t);
                                  }
                                }}
                                className="manifest-table-row"
                                style={{
                                  borderLeft: isSelected
                                    ? '2px solid var(--color-primary)'
                                    : '2px solid transparent',
                                }}
                              >
                                <span
                                  className="font-editorial"
                                  style={{
                                    fontSize: '0.96rem',
                                    color: 'var(--color-text-dim)',
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                >
                                  {String(idx + 1).padStart(2, '0')}
                                </span>

                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontWeight: 700,
                                      fontSize: '0.94rem',
                                      color: 'var(--color-text-main)',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {t.name}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '0.74rem',
                                      color: 'var(--color-text-dim)',
                                      marginTop: 2,
                                    }}
                                  >
                                    {t.province} · {t.region}
                                    {t.hasCampsite ? ' · Có bãi trại' : ''}
                                  </div>
                                </div>

                                <span
                                  className="manifest-col-hide-sm"
                                  style={{
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    color: 'var(--color-text-main)',
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                >
                                  {t.maxAltitudeM.toLocaleString('vi-VN')} m
                                </span>

                                <span
                                  className="manifest-col-hide-sm"
                                  style={{
                                    fontSize: '0.82rem',
                                    color: 'var(--color-text-muted)',
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                >
                                  {t.distanceKm} km
                                </span>

                                <span
                                  className="manifest-col-hide-sm"
                                  style={{ fontSize: '0.78rem', fontWeight: 700, color: diffColor }}
                                >
                                  {diffLabel}
                                </span>

                                <span
                                  className="manifest-col-hide-sm"
                                  style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)' }}
                                >
                                  {t.durationHoursNote || `${t.durationDays} ngày`}
                                </span>

                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    alignItems: 'center',
                                    gap: 10,
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCompare(t)}
                                    aria-label={isSelected ? 'Bỏ khỏi bảng so sánh' : 'Thêm vào so sánh'}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: isSelected
                                        ? 'var(--color-primary)'
                                        : 'var(--color-text-dim)',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    {isSelected ? <IconCheck size={13} color="var(--color-primary)" /> : '+SS'}
                                  </button>
                                  <button
                                    type="button"
                                    className="manifest-row-arrow"
                                    onClick={() => handleSelectTrail(t)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: 'var(--color-text-main)',
                                      fontSize: '0.78rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Mở →
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Asymmetric Editorial Spread + Gallery Poster Grid */
                        <div key="grid" className="tab-content-slide">
                          {displayedTrails[0] && (
                            <article
                              role="button"
                              tabIndex={0}
                              className="editorial-lead-spread"
                              onClick={() => handleSelectTrail(displayedTrails[0])}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleSelectTrail(displayedTrails[0]);
                                }
                              }}
                            >
                              <div className="editorial-lead-media">
                                <img
                                  src={displayedTrails[0].coverImage}
                                  alt={displayedTrails[0].name}
                                  loading="lazy"
                                  decoding="async"
                                />
                                <span
                                  style={{
                                    position: 'absolute',
                                    top: 14,
                                    left: 14,
                                    zIndex: 2,
                                    background: 'var(--overlay-bg)',
                                    color: 'var(--color-sun)',
                                    padding: '4px 10px',
                                    borderRadius: 4,
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    letterSpacing: '0.14em',
                                    textTransform: 'uppercase',
                                    border:
                                      '1px solid color-mix(in srgb, var(--color-sun) 40%, transparent)',
                                  }}
                                >
                                  Tuyến tiêu điểm
                                </span>
                              </div>

                              <div
                                style={{
                                  padding: '22px 26px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                  minWidth: 0,
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      letterSpacing: '0.14em',
                                      textTransform: 'uppercase',
                                      color: 'var(--color-primary)',
                                      marginBottom: 8,
                                    }}
                                  >
                                    {displayedTrails[0].province} · {displayedTrails[0].region}
                                  </div>
                                  <h3
                                    className="font-editorial"
                                    style={{
                                      fontSize: 'clamp(1.38rem, 2.1vw, 1.78rem)',
                                      fontWeight: 600,
                                      color: 'var(--color-text-main)',
                                      margin: '0 0 10px 0',
                                      lineHeight: 1.18,
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    {displayedTrails[0].name}
                                  </h3>
                                  <p
                                    style={{
                                      fontSize: '0.84rem',
                                      color: 'var(--color-text-muted)',
                                      lineHeight: 1.58,
                                      margin: '0 0 14px 0',
                                      display: '-webkit-box',
                                      WebkitLineClamp: 3,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    {displayedTrails[0].description}
                                  </p>
                                </div>

                                <div>
                                  <div
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                                      gap: 12,
                                      padding: '11px 0',
                                      borderTop: '1px solid var(--color-border)',
                                      borderBottom: '1px solid var(--color-border)',
                                      marginBottom: 14,
                                      fontVariantNumeric: 'tabular-nums',
                                    }}
                                  >
                                    <div>
                                      <div
                                        style={{
                                          fontSize: '0.68rem',
                                          color: 'var(--color-text-dim)',
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.08em',
                                        }}
                                      >
                                        Đỉnh cao
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '1.02rem',
                                          fontWeight: 700,
                                          color: 'var(--color-text-main)',
                                          marginTop: 2,
                                        }}
                                      >
                                        {displayedTrails[0].maxAltitudeM.toLocaleString('vi-VN')} m
                                      </div>
                                    </div>
                                    <div>
                                      <div
                                        style={{
                                          fontSize: '0.68rem',
                                          color: 'var(--color-text-dim)',
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.08em',
                                        }}
                                      >
                                        Cự ly
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '1.02rem',
                                          fontWeight: 700,
                                          color: 'var(--color-text-main)',
                                          marginTop: 2,
                                        }}
                                      >
                                        {displayedTrails[0].distanceKm} km
                                      </div>
                                    </div>
                                    <div>
                                      <div
                                        style={{
                                          fontSize: '0.68rem',
                                          color: 'var(--color-text-dim)',
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.08em',
                                        }}
                                      >
                                        Độ khó
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '1.02rem',
                                          fontWeight: 700,
                                          color: 'var(--color-earth)',
                                          marginTop: 2,
                                        }}
                                      >
                                        {displayedTrails[0].difficultyLevel}/5
                                      </div>
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: 10,
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: '0.82rem',
                                        fontWeight: 700,
                                        color: 'var(--color-primary)',
                                      }}
                                    >
                                      Mở hồ sơ địa hình &amp; GPX →
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleCompare(displayedTrails[0]);
                                      }}
                                      className="btn btn-outline"
                                      style={{ padding: '6px 12px', fontSize: '0.74rem', borderRadius: 4 }}
                                    >
                                      {comparedTrails.some((ct) => ct.id === displayedTrails[0].id)
                                        ? 'Đã chọn so sánh'
                                        : '+ So sánh'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </article>
                          )}

                          <div className="trail-catalog-grid">
                            {displayedTrails.slice(1, visibleTrailCount).map((trail, idx) => (
                              <div
                                key={trail.id}
                                className="scene-card-enter"
                                style={{ ['--stagger-i' as string]: idx % 6 }}
                              >
                                <TrailCard
                                  trail={trail}
                                  onSelect={handleSelectTrail}
                                  isSelectedForCompare={comparedTrails.some((ct) => ct.id === trail.id)}
                                  onToggleCompare={handleToggleCompare}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Load More Pagination Action Bar */}
                      {visibleTrailCount < displayedTrails.length && (
                        <div style={{ textAlign: 'center', marginTop: 28 }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => setVisibleTrailCount((prev) => prev + 6)}
                            style={{
                              padding: '11px 28px',
                              fontSize: '0.88rem',
                              fontWeight: 800,
                              borderRadius: 6,
                            }}
                          >
                            Xem Thêm {displayedTrails.length - visibleTrailCount} Cung Đường Khác
                          </button>
                        </div>
                      )}
                    </section>
                  </SceneReveal>

                  {/* Safety & Leave No Trace Pledge */}
                  <SceneReveal>
                    <SafetyPledgeSection
                      onOpenEmergencyContacts={() => setIsEmergencyContactsOpen(true)}
                      onOpenIncidentReport={handleOpenIncidentReport}
                    />
                  </SceneReveal>
                </div>
              </div>
            )}

            {/* VIEW 2: TRAIL DETAIL (with crisp 404 panel on invalid slug) */}
            {currentView === 'detail' &&
              (selectedTrail ? (
                <Suspense fallback={<PageLoadingFallback />}>
                  <TrailDetailView
                    trail={selectedTrail}
                    allTrails={allCatalogTrails}
                    onSelectTrail={handleSelectTrail}
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
                </Suspense>
              ) : trailLoadStatus === 'not_found' ? (
                <div
                  style={{
                    maxWidth: 540,
                    margin: '72px auto',
                    textAlign: 'center',
                    padding: '38px 28px',
                    background: 'var(--color-bg-card)',
                    borderRadius: 6,
                    border: '1px solid var(--color-border-strong)',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  <div className="section-eyebrow" style={{ justifyContent: 'center', marginBottom: 10 }}>
                    404 · Không tìm thấy tọa độ
                  </div>
                  <h2
                    className="font-editorial"
                    style={{
                      fontSize: '1.65rem',
                      color: 'var(--color-text-main)',
                      fontWeight: 600,
                      margin: '0 0 10px 0',
                    }}
                  >
                    Cung Đường Không Tồn Tại Hoặc Đã Lưu Trữ
                  </h2>
                  <p
                    style={{
                      color: 'var(--color-text-muted)',
                      fontSize: '0.88rem',
                      lineHeight: 1.6,
                      marginBottom: 24,
                    }}
                  >
                    Đường dẫn cung đường trekking bạn truy cập không có trong kho dữ liệu thực địa LOST Việt Nam.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleNavigate('home')}
                      style={{ borderRadius: 4, padding: '9px 20px' }}
                    >
                      Về Trang Chủ
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => handleNavigate('almanac')}
                      style={{ borderRadius: 4, padding: '9px 20px' }}
                    >
                      Xem Lịch Mùa {allCatalogTrails.length} Cung Đường
                    </button>
                  </div>
                </div>
              ) : (
                <PageLoadingFallback />
              ))}

            {/* 8 FLAGSHIP LOST EXPEDITION HUBS */}
            {isHubView(currentView) && (
              <div>
                <ExpeditionHubBar
                  activeHub={currentView}
                  onSelectHub={(hub: HubViewId) => handleNavigate(hub)}
                  onBackHome={() => handleNavigate('home')}
                />
                <Suspense fallback={<PageLoadingFallback />}>
                  {currentView === 'passport' && (
                    <PeakPassportView
                      trails={allCatalogTrails}
                      currentUser={currentUser}
                      onSelectTrail={handleSelectTrail}
                      onShowToast={(msg, type) => showToast(msg, type)}
                      onBack={() => handleNavigate('home')}
                    />
                  )}
                  {currentView === 'almanac' && (
                    <SeasonAlmanacView
                      trails={allCatalogTrails}
                      onSelectTrail={handleSelectTrail}
                      onNavigateHub={(hub, tId) =>
                        handleNavigate(tId ? `/${hub}?trailId=${encodeURIComponent(tId)}` : hub)
                      }
                      onBack={() => handleNavigate('home')}
                    />
                  )}
                  {currentView === 'planner' && (
                    <RoutePlannerView
                      key={`${hubInitialTrailId || 'default'}-${hubQueryParams?.route || ''}`}
                      trails={allCatalogTrails}
                      currentUser={currentUser}
                      initialTrailId={hubInitialTrailId || undefined}
                      onShowToast={showToast}
                      onOpenContribute={() => handleNavigate('contribute')}
                      onBack={() => handleNavigate('home')}
                    />
                  )}
                  {currentView === 'toolkit' && (
                    <FieldToolkitView
                      key={`${hubInitialTrailId || 'default'}-${hubQueryParams?.tab || ''}`}
                      trails={allCatalogTrails}
                      initialTrailId={hubInitialTrailId || undefined}
                      onShowToast={showToast}
                      onBack={() => handleNavigate('home')}
                    />
                  )}
                  {currentView === 'directory' && (
                    <DirectoryCostView
                      key={`${hubInitialTrailId || 'default'}-${hubQueryParams?.tab || ''}-${hubQueryParams?.q || ''}`}
                      trails={allCatalogTrails}
                      currentUser={currentUser}
                      initialTrailId={hubInitialTrailId || undefined}
                      onSelectTrail={handleSelectTrail}
                      onStartTripWithBudget={handleStartTripWithBudget}
                      onShowToast={showToast}
                      onBack={() => handleNavigate('home')}
                    />
                  )}
                  {currentView === 'training' && (
                    <TrainingPlannerView
                      key={hubInitialTrailId || 'default'}
                      trails={allCatalogTrails}
                      currentUser={currentUser}
                      initialTrailId={hubInitialTrailId || undefined}
                      onSelectTrail={handleSelectTrail}
                      onShowToast={showToast}
                      onBack={() => handleNavigate('home')}
                    />
                  )}
                  {currentView === 'gear' && (
                    <GearOptimizerView
                      key={hubQueryParams?.pack || 'default'}
                      trails={allCatalogTrails}
                      currentUser={currentUser}
                      onShowToast={showToast}
                      onBack={() => handleNavigate('home')}
                    />
                  )}
                  {currentView === 'radar' && (
                    <SafetyRadarView
                      trails={allCatalogTrails}
                      incidents={incidents}
                      currentUser={currentUser}
                      onSelectTrail={handleSelectTrail}
                      onOpenIncidentReport={handleOpenIncidentReport}
                      onOpenSafetyTimer={() => setIsSafetyTimerOpen(true)}
                      onOpenEmergencyContacts={() => setIsEmergencyContactsOpen(true)}
                      onRefreshIncidents={() => {
                        void refreshIncidents();
                      }}
                      onShowToast={showToast}
                      onBack={() => handleNavigate('home')}
                    />
                  )}
                </Suspense>
              </div>
            )}

            {/* VIEW 3: CONTRIBUTE WIZARD */}
            {currentView === 'contribute' &&
              (!currentUser ? (
                <div
                  style={{
                    maxWidth: 520,
                    margin: '72px auto',
                    textAlign: 'center',
                    padding: '36px 28px',
                    background: 'var(--color-bg-card)',
                    borderRadius: 4,
                    border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  <div className="section-eyebrow" style={{ justifyContent: 'center', marginBottom: 10 }}>
                    Xác thực tài khoản
                  </div>
                  <h3
                    className="font-editorial"
                    style={{
                      fontSize: '1.65rem',
                      color: 'var(--color-text-main)',
                      fontWeight: 500,
                      marginBottom: 10,
                    }}
                  >
                    Yêu Cầu Đăng Nhập
                  </h3>
                  <p
                    style={{
                      color: 'var(--color-text-muted)',
                      fontSize: '0.88rem',
                      lineHeight: 1.6,
                      marginBottom: 24,
                    }}
                  >
                    Tính năng đóng góp cung đường mới và tải tracklog GPX lên cộng đồng yêu cầu tài khoản đã xác thực.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setAuthModalInitialMode('login');
                      setIsAuthModalOpen(true);
                    }}
                    style={{ padding: '10px 24px', fontSize: '0.88rem' }}
                  >
                    Đăng Nhập Ngay
                  </button>
                </div>
              ) : (
                <Suspense fallback={<PageLoadingFallback />}>
                  <TrailContributionWizard
                    currentUser={currentUser}
                    onBack={() => {
                      const isEditing = !!localStorage.getItem('lost_editing_contribution');
                      localStorage.removeItem('lost_editing_contribution');
                      handleNavigate(isEditing ? 'profile' : 'home');
                    }}
                    onSuccess={() => {
                      handleNavigate('profile');
                    }}
                    onShowToast={(msg, type) => showToast(msg, type)}
                  />
                </Suspense>
              ))}

            {/* VIEW 4: USER PROFILE */}
            {currentView === 'profile' &&
              (!currentUser ? (
                <div
                  style={{
                    maxWidth: 520,
                    margin: '72px auto',
                    textAlign: 'center',
                    padding: '36px 28px',
                    background: 'var(--color-bg-card)',
                    borderRadius: 4,
                    border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  <div className="section-eyebrow" style={{ justifyContent: 'center', marginBottom: 10 }}>
                    Hồ sơ thám hiểm
                  </div>
                  <h3
                    className="font-editorial"
                    style={{
                      fontSize: '1.65rem',
                      color: 'var(--color-text-main)',
                      fontWeight: 500,
                      marginBottom: 10,
                    }}
                  >
                    Yêu Cầu Đăng Nhập
                  </h3>
                  <p
                    style={{
                      color: 'var(--color-text-muted)',
                      fontSize: '0.88rem',
                      lineHeight: 1.6,
                      marginBottom: 24,
                    }}
                  >
                    Vui lòng đăng nhập để xem hồ sơ cá nhân, phân tích hành trình, kho cung đường đã lưu và huy hiệu.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setAuthModalInitialMode('login');
                      setIsAuthModalOpen(true);
                    }}
                    style={{ padding: '10px 24px', fontSize: '0.88rem' }}
                  >
                    Đăng Nhập Ngay
                  </button>
                </div>
              ) : (
                <Suspense fallback={<PageLoadingFallback />}>
                  <UserProfileView
                    currentUser={currentUser}
                    onBack={() => handleNavigate('home')}
                    onSelectTrail={handleSelectTrail}
                    onShowToast={(msg, type) => showToast(msg, type)}
                    onProfileUpdate={(updatedUser) => setCurrentUser(updatedUser)}
                    onNavigateToContribute={() => handleNavigate('contribute')}
                  />
                </Suspense>
              ))}

            {/* VIEW 5: FORUM VIEW */}
            {currentView === 'forum' && (
              <Suspense fallback={<PageLoadingFallback />}>
                <TrekForumView
                  currentUser={currentUser}
                  trails={allCatalogTrails}
                  onSelectTrail={handleSelectTrail}
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

            {/* VIEW 6: ADMIN DASHBOARD */}
            {currentView === 'admin' &&
              (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'moderator') ? (
                <div
                  style={{
                    maxWidth: 520,
                    margin: '72px auto',
                    textAlign: 'center',
                    padding: '36px 28px',
                    background: 'var(--color-bg-card)',
                    borderRadius: 4,
                    border: '1px solid var(--color-border)',
                    borderTop: '3px solid var(--color-error)',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.68rem',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--color-error-text, var(--color-error))',
                      fontWeight: 700,
                      marginBottom: 10,
                    }}
                  >
                    Phân quyền quản trị
                  </div>
                  <h3
                    className="font-editorial"
                    style={{
                      fontSize: '1.65rem',
                      color: 'var(--color-text-main)',
                      fontWeight: 500,
                      marginBottom: 10,
                    }}
                  >
                    Từ Chối Quyền Truy Cập
                  </h3>
                  <p
                    style={{
                      color: 'var(--color-text-muted)',
                      fontSize: '0.88rem',
                      lineHeight: 1.6,
                      marginBottom: 24,
                    }}
                  >
                    Trang Quản Trị Hệ Thống chỉ dành cho Quản Trị Viên. Vui lòng đăng nhập bằng tài khoản Quản Trị.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setAuthModalInitialMode('login');
                      setIsAuthModalOpen(true);
                    }}
                    style={{ padding: '10px 24px', fontSize: '0.88rem' }}
                  >
                    Đăng Nhập Tài Khoản Admin
                  </button>
                </div>
              ) : (
                <Suspense fallback={<PageLoadingFallback />}>
                  <AdminDashboardView
                    onBack={() => handleNavigate('home')}
                    onShowToast={(msg, type) => showToast(msg, type)}
                    currentUser={currentUser}
                    onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
                  />
                </Suspense>
              ))}

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
                <NotificationsPage currentUser={currentUser} onNavigate={handleNavigate} />
              </Suspense>
            )}

            {/* VIEW 9: PUBLIC LIVE FAMILY GPS BEACON VIEWER (/beacon/:token) */}
            {currentView === 'beacon' && activeBeaconToken && (
              <Suspense fallback={<PageLoadingFallback />}>
                <LiveBeaconViewerPage
                  token={activeBeaconToken}
                  trails={allCatalogTrails}
                  onBack={() => handleNavigate('home')}
                  onSelectTrail={handleSelectTrail}
                />
              </Suspense>
            )}
          </main>
        </ErrorBoundary>

        {/* Authentication Register / Login / Reset Password Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          initialMode={authModalInitialMode}
          onClose={() => {
            setIsAuthModalOpen(false);
            setResetTokenUrl(null);
            const clean = buildCleanUrl(
              currentView,
              currentView === 'detail'
                ? selectedTrail?.id
                : currentView === 'beacon'
                  ? activeBeaconToken
                  : isHubView(currentView)
                    ? hubInitialTrailId
                    : null,
              isHubView(currentView) ? hubQueryParams : null
            );
            window.history.replaceState({ view: currentView }, '', clean);
          }}
          onAuthSuccess={(user) => {
            setCurrentUser(user);
            const clean = buildCleanUrl(
              currentView,
              currentView === 'detail'
                ? selectedTrail?.id
                : currentView === 'beacon'
                  ? activeBeaconToken
                  : isHubView(currentView)
                    ? hubInitialTrailId
                    : null,
              isHubView(currentView) ? hubQueryParams : null
            );
            window.history.replaceState({ view: currentView }, '', clean);
          }}
          onShowToast={showToast}
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
          <Suspense fallback={<ModalLoadingFallback label="Đang mở biểu mẫu báo sự cố..." />}>
            <IncidentReportModal
              isOpen={isIncidentModalOpen}
              onClose={() => setIsIncidentModalOpen(false)}
              trailName={selectedTrail ? selectedTrail.name : undefined}
              trailId={
                selectedTrail
                  ? selectedTrail.id || (selectedTrail as TrailWithMongoId)._id
                  : undefined
              }
              trails={allCatalogTrails}
              incidents={incidents}
              currentUser={currentUser}
              onSuccess={async () => {
                await refreshIncidents();
              }}
              onShowToast={showToast}
            />
          </Suspense>
        )}

        {/* Safety Timer Check-in Modal (opened from Safety Radar Hub) */}
        {isSafetyTimerOpen && (
          <Suspense fallback={<ModalLoadingFallback label="Đang mở bộ hẹn giờ báo bình an..." />}>
            <SafetyTimerModal
              isOpen={isSafetyTimerOpen}
              onClose={() => setIsSafetyTimerOpen(false)}
              currentUser={currentUser}
              selectedTrail={selectedTrail}
              trails={allCatalogTrails}
              onShowToast={showToast}
              onRequireAuth={() => {
                setIsSafetyTimerOpen(false);
                setAuthModalInitialMode('login');
                setIsAuthModalOpen(true);
              }}
            />
          </Suspense>
        )}

        {/* Public Trekker Profile Modal (#profile-<username> / /profile/:username) */}
        {publicProfileUsername && (
          <Suspense fallback={<ModalLoadingFallback label="Đang tải hồ sơ nhà thám hiểm..." />}>
            <AuthorProfileModal
              author={{ name: publicProfileUsername, avatar: '' }}
              currentUser={currentUser}
              onClose={() => {
                setPublicProfileUsername(null);
                const clean = buildCleanUrl(
                  currentView,
                  currentView === 'detail'
                    ? selectedTrail?.id
                    : isHubView(currentView)
                      ? hubInitialTrailId
                      : null,
                  isHubView(currentView) ? hubQueryParams : null
                );
                window.history.replaceState({ view: currentView }, '', clean);
              }}
              onStartChat={() => {
                setPublicProfileUsername(null);
                handleNavigate('messages');
              }}
            />
          </Suspense>
        )}

        {/* Emergency Incident Detail Modal */}
        {selectedIncidentDetail &&
          createPortal(
            <div
              className="modal-overlay"
              onClick={() => setSelectedIncidentDetail(null)}
              style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}
            >
              <div
                ref={incidentDetailDialogRef}
                tabIndex={-1}
                className="modal-content"
                role="dialog"
                aria-modal="true"
                aria-label="Hồ sơ cảnh báo sự cố khẩn"
                onClick={(e) => e.stopPropagation()}
                style={{
                  maxWidth: 600,
                  width: '100%',
                  maxHeight: 'min(90vh, 760px)',
                  overflowY: 'auto',
                  border: '1px solid var(--color-border-strong)',
                  borderTop: '3px solid var(--color-error)',
                  boxShadow: 'var(--shadow-3d)',
                  background: 'var(--color-bg-card)',
                  borderRadius: 6,
                  padding: 24,
                  position: 'relative',
                  outline: 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: 12,
                  }}
                >
                  <h3
                    className="font-editorial"
                    style={{
                      fontSize: '1.35rem',
                      color: 'var(--color-text-main)',
                      fontWeight: 500,
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <IconShieldAlert size={18} color="var(--color-error)" />
                    Hồ Sơ Cảnh Báo Sự Cố Khẩn
                  </h3>
                  <button
                    ref={incidentDetailCloseBtnRef}
                    type="button"
                    onClick={() => setSelectedIncidentDetail(null)}
                    title="Đóng"
                    aria-label="Đóng"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 4,
                    }}
                  >
                    <IconX size={18} />
                  </button>
                </div>

                <div
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    borderLeft: '3px solid var(--color-error)',
                    borderRadius: 4,
                    padding: 16,
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          background: 'var(--color-error)',
                          color: 'var(--color-on-danger)',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          padding: '3px 8px',
                          borderRadius: 4,
                        }}
                      >
                        MỨC ĐỘ: {selectedIncidentDetail.severity?.toUpperCase() || 'KHẨN CẤP'}
                      </span>
                      <span className="badge badge-success">
                        <IconCheck size={12} color="var(--color-primary)" /> Đã xác minh
                      </span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatIncidentTime(selectedIncidentDetail.reportedAt)}
                    </span>
                  </div>
                  <h4
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      color: 'var(--color-text-main)',
                      margin: '8px 0 4px 0',
                    }}
                  >
                    {selectedIncidentDetail.trailName}
                  </h4>
                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--color-sky)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <IconMapPin size={13} color="var(--color-sky)" />
                    Vị trí: {selectedIncidentDetail.locationNote || 'Đoạn đường nguy hiểm'}{' '}
                    {selectedIncidentDetail.elevationM
                      ? `(Độ cao ${selectedIncidentDetail.elevationM}m)`
                      : ''}
                  </div>
                </div>

                {selectedIncidentDetail.images && selectedIncidentDetail.images.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div
                      style={{
                        fontSize: '0.86rem',
                        fontWeight: 800,
                        color: 'var(--color-text-main)',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>Bằng Chứng Hình Ảnh Hiện Trường:</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>
                        (Ảnh thực tế từ hiện trường)
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          selectedIncidentDetail.images.length > 1 ? '1fr 1fr' : '1fr',
                        gap: 10,
                      }}
                    >
                      {selectedIncidentDetail.images.map((imgUrl, idx) => (
                        <div
                          key={idx}
                          style={{
                            height: 160,
                            borderRadius: 6,
                            overflow: 'hidden',
                            border: '1px solid var(--color-border)',
                            position: 'relative',
                            background: 'var(--color-bg-main)',
                          }}
                        >
                          <img
                            src={imgUrl}
                            alt={`Ảnh bằng chứng hiện trường số ${idx + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 6,
                              left: 6,
                              background: 'var(--color-bg-hud)',
                              color: 'var(--color-text-main)',
                              border: '1px solid var(--color-border-strong)',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 4,
                            }}
                          >
                            Ảnh bằng chứng #{idx + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    fontSize: '0.86rem',
                    lineHeight: 1.6,
                    color: 'var(--color-text-muted)',
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--color-text-main)' }}>Mô tả chi tiết sự cố:</strong>
                    <p
                      style={{
                        margin: '6px 0 0 0',
                        color: 'var(--color-text-main)',
                        background: 'var(--color-bg-main)',
                        padding: '12px 14px',
                        borderRadius: 4,
                        border: '1px solid var(--color-border)',
                        fontSize: '0.88rem',
                      }}
                    >
                      {selectedIncidentDetail.description}
                    </p>
                  </div>

                  <div
                    style={{
                      background: 'var(--color-bg-main)',
                      padding: '12px 14px',
                      borderRadius: 4,
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--color-primary)' }}>
                        Cơ quan / Đơn vị xác minh:{' '}
                      </strong>
                      <span style={{ color: 'var(--color-text-main)' }}>
                        {selectedIncidentDetail.verifiedBy ||
                          selectedIncidentDetail.userName ||
                          'Trạm Kiểm Lâm Vườn Quốc Gia & BQT LOST'}
                      </span>
                    </div>
                    {selectedIncidentDetail.coordinates && (
                      <div>
                        <strong style={{ color: 'var(--color-sky)' }}>Tọa độ Vệ Tinh GPS: </strong>
                        <span
                          style={{
                            color: 'var(--color-text-main)',
                            fontFamily: 'var(--font-family)',
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {selectedIncidentDetail.coordinates.lat.toFixed(4)}° N,{' '}
                          {selectedIncidentDetail.coordinates.lng.toFixed(4)}° E
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <strong
                        style={{
                          color: 'var(--color-error-text, var(--color-error))',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <IconPhone size={13} color="var(--color-error-text, var(--color-error))" />
                        Hotline Cứu Hộ Khẩn Cấp:
                      </strong>
                      <span style={{ color: 'var(--color-error-text, var(--color-error))', fontWeight: 800 }}>
                        {selectedIncidentDetail.rescueContact ||
                          '112 / 114 (Tổng đài Tìm kiếm Cứu nạn & PCCC Quốc gia 24/7)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setSelectedIncidentDetail(null)}
                    style={{ flex: 1, borderRadius: 4 }}
                  >
                    Đóng Cửa Sổ
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      setSelectedIncidentDetail(null);
                      handleOpenIncidentReport();
                    }}
                    style={{
                      flex: 1.4,
                      borderRadius: 4,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <IconAlertTriangle size={15} color="var(--color-on-danger)" />
                    Gửi Báo Cáo SOS Hỗ Trợ Khẩn
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* Floating Bottom Trail Comparison Quick Bar */}
        {comparedTrails.length >= 1 && (
          <div
            className="cyber-dock-bar dock-slide-up"
            style={{
              position: 'fixed',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 'var(--z-dropdown, 1100)' as unknown as number,
              borderRadius: 6,
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              maxWidth: 'calc(100vw - 24px)',
            }}
          >
            <div
              style={{
                fontSize: '0.84rem',
                fontWeight: 700,
                color: 'var(--color-text-main)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <IconScale size={16} color="var(--color-primary)" />
              <span>Đã chọn {comparedTrails.length}/4 cung đường</span>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsCompareModalOpen(true)}
              style={{ padding: '6px 14px', fontSize: '0.78rem', borderRadius: 4 }}
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
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 4,
              }}
            >
              Xóa hết
            </button>
          </div>
        )}

        {/* Trail Comparison Modal */}
        {isCompareModalOpen && (
          <Suspense fallback={<ModalLoadingFallback label="Đang tải bảng so sánh..." />}>
            <TrailComparisonModal
              trails={comparedTrails}
              isOpen={isCompareModalOpen}
              onClose={() => setIsCompareModalOpen(false)}
              onRemoveTrail={(trailId) =>
                setComparedTrails((prev) => prev.filter((t) => t.id !== trailId))
              }
              onSelectTrail={handleSelectTrail}
            />
          </Suspense>
        )}

        {/* Floating Scroll-to-Top Button */}
        {showScrollTop && (
          <button
            type="button"
            className="fab-pop-in interactive-click"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="Cuộn lên đầu trang"
            aria-label="Cuộn lên đầu trang"
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 'var(--z-dropdown, 1100)' as unknown as number,
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-strong)',
              color: 'var(--color-text-main)',
              borderRadius: 6,
              width: 40,
              height: 40,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-card)',
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
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
        )}

        {/* LOST AI Virtual Assistant (hidden inside dedicated full-bleed Admin Ops Shell) */}
        {!isDedicatedAdminShell && !isAiAssistantOpen && (
          <TrekAssistantFab
            isOpen={isAiAssistantOpen}
            onToggle={handleOpenAiAssistant}
            hasScrollTop={showScrollTop}
          />
        )}

        {isAiAssistantOpen && (
          <Suspense fallback={<ModalLoadingFallback label="Đang khởi động Trợ lý LOST AI..." />}>
            <TrekAssistantModal
              isOpen={isAiAssistantOpen}
              onClose={() => {
                setIsAiAssistantOpen(false);
                setAiContextTrail(null);
              }}
              currentTrail={aiContextTrail || selectedTrail}
              currentUser={currentUser}
              onSelectTrail={handleSelectTrailById}
              pageView={currentView}
              currentView={currentView}
              trails={allCatalogTrails}
              incidents={incidents}
            />
          </Suspense>
        )}

        {/* Global Ctrl+K Command Palette */}
        {isCommandPaletteOpen && (
          <Suspense fallback={<ModalLoadingFallback label="Đang mở bảng lệnh nhanh..." />}>
            <CommandPaletteModal
              isOpen={isCommandPaletteOpen}
              trails={allCatalogTrails}
              onClose={handleCloseCommandPalette}
              onSelectTrail={handlePaletteSelectTrail}
              onNavigateView={handlePaletteNavigateView}
              onOpenAiWithPrompt={handlePaletteOpenAi}
              onOpenEmergency={handlePaletteOpenEmergency}
              onOpenLiveTracker={handlePaletteOpenLiveTracker}
              onOpenShortcuts={handleOpenShortcutsHelp}
            />
          </Suspense>
        )}

        {/* Global ? Keyboard Shortcuts Cheatsheet Modal */}
        {isShortcutsHelpOpen && (
          <Suspense fallback={<ModalLoadingFallback label="Đang mở bảng phím tắt..." />}>
            <ShortcutsHelpModal
              isOpen={isShortcutsHelpOpen}
              onClose={handleCloseShortcutsHelp}
              onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            />
          </Suspense>
        )}

        {/* Live Field GPS Expedition Computer Modal */}
        {isLiveTrackerOpen && (
          <Suspense fallback={<ModalLoadingFallback label="Đang khởi động Live GPS Tracker..." />}>
            <LiveTrekTrackerModal
              isOpen={isLiveTrackerOpen}
              trail={liveTrackerTrail || selectedTrail}
              trails={allCatalogTrails}
              currentUser={currentUser}
              onClose={handleCloseLiveTracker}
              onShowToast={showToast}
            />
          </Suspense>
        )}

        {/* Shared Expedition Itinerary Modal */}
        {sharedItineraryToken && (
          <Suspense fallback={<ModalLoadingFallback label="Đang mở lịch trình chia sẻ..." />}>
            <SharedItineraryModal
              shareToken={sharedItineraryToken}
              isOpen={!!sharedItineraryToken}
              onClose={() => {
                setSharedItineraryToken(null);
                if (window.location.hash.startsWith('#itinerary/')) {
                  window.history.replaceState(
                    null,
                    '',
                    window.location.pathname + window.location.search
                  );
                }
              }}
              onViewTrail={(tId) => handleSelectTrailById(tId)}
            />
          </Suspense>
        )}

        {/* 1-Click PWA Service Worker Update or App Install Pill */}
        {(swWaitingWorker || (deferredPwaInstall && !pwaBannerDismissed)) && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: 'fixed',
              bottom: 24,
              left: 24,
              zIndex: 'var(--z-dropdown, 1100)' as unknown as number,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 6,
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-strong)',
              boxShadow: 'var(--shadow-card)',
              color: 'var(--color-text-main)',
              maxWidth: 'calc(100vw - 96px)',
              fontSize: '0.8rem',
            }}
          >
            <span style={{ fontWeight: 700 }}>
              {swWaitingWorker
                ? 'Đã có bản cập nhật LOST mới'
                : 'Cài đặt ứng dụng LOST dùng ngoại tuyến'}
            </span>
            {swWaitingWorker ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  swWaitingWorker.postMessage({ type: 'SKIP_WAITING' });
                  setSwWaitingWorker(null);
                  window.location.reload();
                }}
                style={{ padding: '5px 12px', fontSize: '0.75rem', borderRadius: 4 }}
              >
                Cập nhật ngay
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  if (!deferredPwaInstall) return;
                  try {
                    await deferredPwaInstall.prompt();
                    await deferredPwaInstall.userChoice;
                  } catch {
                    // ignore prompt cancel
                  }
                  setDeferredPwaInstall(null);
                }}
                style={{ padding: '5px 12px', fontSize: '0.75rem', borderRadius: 4 }}
              >
                Cài đặt
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (swWaitingWorker) setSwWaitingWorker(null);
                else setPwaBannerDismissed(true);
              }}
              aria-label="Đóng thông báo ứng dụng"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-dim)',
                cursor: 'pointer',
                padding: 2,
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <IconX size={14} />
            </button>
          </div>
        )}

        {!isDedicatedAdminShell && <Footer />}
      </div>
    </SocketProvider>
  );
}

export default App;
