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
import { clearSensitiveSessionStorage, safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from './utils/storageScope.js';
import { applyDocumentTheme, triggerSmoothThemeTransition } from './utils/themeTransition.js';
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
import { SocketProvider, useSocketConnection } from './context/SocketContext.js';
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
      Đang mở trang...
    </span>
  </div>
);

const ModalLoadingFallback: React.FC<{ label?: string }> = ({ label = 'Đang mở...' }) =>
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

const DisconnectBanner: React.FC<{ hasBottomBar?: boolean }> = ({ hasBottomBar = false }) => {
  const { isConnected } = useSocketConnection();
  const [hasConnectedOnce, setHasConnectedOnce] = useState<boolean>(isConnected);
  const [graceElapsed, setGraceElapsed] = useState<boolean>(false);

  if (isConnected && !hasConnectedOnce) {
    setHasConnectedOnce(true);
  }

  useEffect(() => {
    if (isConnected || graceElapsed) return;
    const timer = window.setTimeout(() => {
      setGraceElapsed(true);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [isConnected, graceElapsed]);

  if (isConnected || (!hasConnectedOnce && !graceElapsed)) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: hasBottomBar ? 88 : 24,
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
      <span>Mạng hơi chập chờn — đang tự kết nối lại...</span>
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
        title="Bấm để xem chi tiết cảnh báo & ảnh hiện trường"
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

function formatIncidentSeverityVi(raw?: string): string {
  const normalized = String(raw || '').trim().toLowerCase();
  if (normalized === 'critical' || normalized === 'urgent' || normalized === 'emergency') return 'KHẨN CẤP';
  if (normalized === 'high' || normalized === 'severe') return 'NGUY HIỂM CAO';
  if (normalized === 'medium' || normalized === 'moderate') return 'CẢNH BÁO TRUNG BÌNH';
  if (normalized === 'low' || normalized === 'info') return 'LƯU Ý AN TOÀN';
  return normalized ? normalized.toUpperCase() : 'KHẨN CẤP';
}

function extractTelHref(raw?: string): string {
  const clean = String(raw || '').trim();
  const match = clean.match(/(?:\+84|0)[0-9\s.-]{7,13}|\b11[2345]\b/);
  const digits = match ? match[0].replace(/[\s.-]/g, '') : '112';
  return `tel:${digits}`;
}

function sweepUserScopedStorageKeys(): void {
  if (typeof window === 'undefined') return;
  const scopedPrefixes = [
    'lost_cover_url_',
    'lost_saved_meta_v1_',
    'lost_checkins_',
    'lost_annual_goals_v2_',
    'lost_gear_locker_',
  ];
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && scopedPrefixes.some((p) => k.startsWith(p))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem('lost_live_tracker_custom_route_id');
  } catch {
    // ignore storage access errors
  }
}

function safeResolveAppRoute(path: string, hash: string, search?: string) {
  try {
    return resolveAppRoute(path, hash, search);
  } catch {
    return {
      view: 'home' as AppView,
      isProtected: false,
    };
  }
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
  const resolved = safeResolveAppRoute(
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
      const startLat = Number(contrib.startLat);
      const startLng = Number(contrib.startLng);
      const endLat = Number(contrib.endLat);
      const endLng = Number(contrib.endLng);
      const isValidVnCoord = (lat: number, lng: number) =>
        Number.isFinite(lat) && Number.isFinite(lng) && lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110;
      const validTrack = Array.isArray(contrib.gpxTrack)
        ? contrib.gpxTrack.filter(
            (pt): pt is [number, number] =>
              Array.isArray(pt) && pt.length >= 2 && isValidVnCoord(Number(pt[0]), Number(pt[1]))
          )
        : [];
      const hasRealCoords = isValidVnCoord(startLat, startLng) && isValidVnCoord(endLat, endLng);
      if (!hasRealCoords && validTrack.length < 2) {
        return null;
      }
      const safeStartLat = hasRealCoords ? startLat : validTrack[0][0];
      const safeStartLng = hasRealCoords ? startLng : validTrack[0][1];
      const safeEndLat = hasRealCoords ? endLat : validTrack[validTrack.length - 1][0];
      const safeEndLng = hasRealCoords ? endLng : validTrack[validTrack.length - 1][1];
      const distanceKm = Number.isFinite(Number(contrib.distanceKm)) && Number(contrib.distanceKm) > 0
        ? Number(contrib.distanceKm)
        : 0;
      const elevationGainM = Number.isFinite(Number(contrib.elevationGainM)) && Number(contrib.elevationGainM) >= 0
        ? Number(contrib.elevationGainM)
        : 0;
      const maxAltitudeM = Number.isFinite(Number(contrib.maxAltitudeM)) && Number(contrib.maxAltitudeM) > 0
        ? Number(contrib.maxAltitudeM)
        : 0;
      if (distanceKm <= 0) {
        return null;
      }
      const cover = contrib.coverImage || DEFAULT_VIETNAM_TRAIL_COVER;
      return {
        id: contrib.id || `contrib-${contrib._id || Date.now()}`,
        name: contrib.name,
        altNames: contrib.altNames || [],
        region: contrib.region || 'Miền Bắc',
        province: contrib.province || '',
        district: contrib.district || '',
        hamlet: contrib.hamlet || '',
        distanceKm,
        elevationGainM,
        maxAltitudeM,
        durationDays: Math.max(1, Math.ceil(distanceKm / 12)),
        durationHoursNote: contrib.durationHoursNote || '1 ngày',
        difficultyLevel: Number(contrib.difficultyLevel) || 3,
        difficultyNote: (Number(contrib.difficultyLevel) || 3) >= 4 ? 'Thử thách cao' : 'Trung bình',
        bestMonths: Array.isArray(contrib.bestMonths) ? contrib.bestMonths : [],
        avoidMonths: Array.isArray(contrib.avoidMonths) ? contrib.avoidMonths : [],
        startLat: safeStartLat,
        startLng: safeStartLng,
        endLat: safeEndLat,
        endLng: safeEndLng,
        description: contrib.description || 'Cung đường do cộng đồng đóng góp.',
        transportationInfo: contrib.transportationInfo || '',
        coverImage: cover,
        galleryImages: [cover],
        permitRequired: !!contrib.permitRequired,
        permitInfo: contrib.permitInfo || '',
        hasCampsite: !!contrib.hasCampsite,
        hasWaterSource: !!contrib.hasWaterSource,
        kidFriendly: !!contrib.kidFriendly,
        gpxTrack:
          validTrack.length >= 2
            ? validTrack
            : [
                [safeStartLat, safeStartLng],
                [safeEndLat, safeEndLng],
              ],
        waypoints: contrib.waypoints || [],
        status: contrib.status || 'approved',
        createdAt: contrib.createdAt || new Date().toISOString(),
        updatedAt: contrib.updatedAt || new Date().toISOString(),
        rescueContact: contrib.rescueContact || {
          name: 'Hạt Kiểm lâm ' + (contrib.province || 'địa phương'),
          phone: '112 / 114 (Tổng đài cứu nạn & PCCC quốc gia 24/7)',
          rangerContact: 'Trạm Kiểm lâm ' + (contrib.district || 'cửa rừng'),
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

  // Floating Scroll-to-Top & Compact Mobile Viewport State
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isCompactMobile, setIsCompactMobile] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 600px)').matches
      : false
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 600px)');
    const onChange = () => setIsCompactMobile(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Toast Notification State (with monotonic ID so duplicate messages reset countdown cleanly)
  const toastSeqRef = useRef(0);
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    isOpen: boolean;
  }>({
    id: 0,
    message: '',
    type: 'success',
    isOpen: false,
  });

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
      toastSeqRef.current += 1;
      setToast({ id: toastSeqRef.current, message, type, isOpen: true });
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
        applyDocumentTheme(nextTheme);
        window.dispatchEvent(
          new CustomEvent('lost:toggle-theme', { detail: { theme: nextTheme } })
        );
        showToast(
          nextTheme === 'light'
            ? 'Đã đổi sang giao diện sáng (Alt+T)'
            : 'Đã đổi sang giao diện tối (Alt+T)',
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
        showToast('LOST vừa có bản mới — tải lại trang để dùng ngay nhé.', 'info');
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

    const handleAuthChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ authenticated?: boolean; user?: UserProfile | null }>)?.detail;
      if (detail?.authenticated === false || !safeLocalStorageGet('lost_token')) {
        setCurrentUser(null);
      } else if (detail?.user) {
        setCurrentUser(detail.user);
      }
    };

    window.addEventListener('lost:show-toast', handleGlobalToast);
    window.addEventListener('lost:open-auth-modal', handleGlobalAuthOpen);
    window.addEventListener('lost:open-ai-assistant', handleGlobalAiOpen);
    window.addEventListener('lost:open-ai-with-prompt', handleGlobalAiOpen);
    window.addEventListener('lost:open-live-tracker', handleGlobalLiveTrackerOpen);
    window.addEventListener('lost:sw-update-available', handleSwUpdateAvailable);
    window.addEventListener('lost:auth-changed', handleAuthChanged);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('lost:show-toast', handleGlobalToast);
      window.removeEventListener('lost:open-auth-modal', handleGlobalAuthOpen);
      window.removeEventListener('lost:open-ai-assistant', handleGlobalAiOpen);
      window.removeEventListener('lost:open-ai-with-prompt', handleGlobalAiOpen);
      window.removeEventListener('lost:open-live-tracker', handleGlobalLiveTrackerOpen);
      window.removeEventListener('lost:sw-update-available', handleSwUpdateAvailable);
      window.removeEventListener('lost:auth-changed', handleAuthChanged);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [showToast]);

  // Unified Single Router for URL Pathname, Hash & Query Params
  useEffect(() => {
    const syncRouteFromUrl = () => {
      const resolved = safeResolveAppRoute(
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
            `${event.data.message || 'Tài khoản đã kích hoạt xong! Giờ bạn đăng nhập được rồi.'}`,
            'success'
          );
        } else {
          showToast(`Chưa kích hoạt được: ${event.data.message || 'Mã xác thực không đúng hoặc đã hết hạn.'}`, 'error');
        }
      };
    }
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'lost_activated_signal' && e.newValue) {
        showToast('Tài khoản đã kích hoạt xong! Giờ bạn đăng nhập được rồi.', 'success');
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
        .then((res) => res.json().catch(() => ({})))
        .then((data) => {
          if (data.success) {
            if (channel) {
              channel.postMessage({
                type: 'ACCOUNT_ACTIVATED',
                email: data.email,
                message: data.message,
              });
            }
            safeLocalStorageSet('lost_activated_signal', Date.now().toString());
            if (data.token && data.user) {
              safeLocalStorageSet('lost_token', data.token);
              setCurrentUser(data.user);
              window.dispatchEvent(new CustomEvent('lost:auth-changed', { detail: { authenticated: true, user: data.user } }));
              showToast(data.message || 'Kích hoạt xong và đăng nhập luôn cho bạn rồi!', 'success');
            } else {
              showToast(data.message || 'Tài khoản đã kích hoạt xong!', 'success');
              setIsAuthModalOpen(true);
            }
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            showToast(data.message || 'Liên kết kích hoạt không hợp lệ hoặc đã hết hạn.', 'error');
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        })
        .catch(() => showToast('Mạng hơi chập chờn, chưa kết nối được tới máy chủ kích hoạt.', 'error'));
    } else if (token) {
      try {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('resetToken');
        window.history.replaceState({}, document.title, `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
      } catch {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
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
      const token = safeLocalStorageGet('lost_token');

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
            sweepUserScopedStorageKeys();
            clearSensitiveSessionStorage();
            setCurrentUser(null);
            window.dispatchEvent(
              new CustomEvent('lost:auth-changed', { detail: { authenticated: false } })
            );
            showToast('Tài khoản của bạn đã bị ban quản trị khóa do vi phạm quy định.', 'error');
            return;
          }
          setCurrentUser(userData);
        } else if (res.status === 401) {
          const refreshed = await tryRefresh();
          if (!refreshed) {
            localStorage.removeItem('lost_token');
            sweepUserScopedStorageKeys();
            clearSensitiveSessionStorage();
            setCurrentUser(null);
            window.dispatchEvent(
              new CustomEvent('lost:auth-changed', { detail: { authenticated: false } })
            );
          }
        } else if (res.status === 403 || json.isBanned) {
          localStorage.removeItem('lost_token');
          sweepUserScopedStorageKeys();
          clearSensitiveSessionStorage();
          setCurrentUser(null);
          window.dispatchEvent(
            new CustomEvent('lost:auth-changed', { detail: { authenticated: false } })
          );
          if (json.isBanned) {
            showToast('Tài khoản của bạn đã bị ban quản trị khóa vĩnh viễn.', 'error');
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
      home: 'LOST Việt Nam — Bản đồ trekking 3D, thời tiết núi & an toàn đi rừng',
      explore: 'Khám phá cung đường trekking Việt Nam | LOST',
      detail: 'Chi tiết cung đường trekking | LOST Việt Nam',
      forum: 'Diễn đàn & tìm bạn ghép đoàn | LOST Việt Nam',
      contribute: 'Gửi cung đường & tracklog GPX mới | LOST Việt Nam',
      profile: 'Hồ sơ & nhật ký leo núi | LOST Việt Nam',
      messages: 'Tin nhắn & nhóm bạn đồng hành | LOST Việt Nam',
      notifications: 'Thông báo & tin cảnh báo | LOST Việt Nam',
      admin: 'Quản trị & kiểm duyệt | LOST Việt Nam',
      beacon: 'Theo dõi hành trình trực tiếp | LOST',
      passport: `Hộ chiếu đỉnh núi & ${totalCatalogTrailsCount} cung đường Việt Nam | LOST`,
      almanac: 'Lịch mùa trekking & săn mây 12 tháng | LOST',
      planner: 'Vẽ cung GPX & đo độ dốc địa hình | LOST',
      toolkit: 'Đồ nghề đi rừng offline (la bàn, mặt trời, SOS) | LOST',
      directory: 'Danh bạ kiểm lâm, porter & dự trù chi phí | LOST',
      training: 'Rèn sức trước chuyến leo núi (4–8 tuần) | LOST',
      gear: 'Cân balo & tủ đồ đi rừng | LOST',
      radar: 'Tin cảnh báo an toàn trên tuyến 24/7 | LOST',
    };

    updateDocumentSeoMeta({
      title: viewTitles[currentView] || viewTitles.home,
      description:
        'Bản đồ cộng đồng cho người đi rừng Việt Nam với tracklog GPX đi thật, địa hình 3D, gói tải dùng khi mất sóng, danh bạ kiểm lâm và góc tìm bạn đồng hành.',
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
    })
      .then((trailData) => {
        if (active) setTrails(trailData);
      })
      .catch(() => {
        // Offline / aborted filter request: keep existing list
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

  const handleToggleCompare = useCallback(
    (trail: Trail) => {
      setComparedTrails((prev) => {
        const exists = prev.some((t) => t.id === trail.id);
        if (exists) {
          return prev.filter((t) => t.id !== trail.id);
        }
        if (prev.length >= 4) {
          showToast('Chỉ so sánh tối đa 4 cung một lúc thôi nhé.', 'info');
          return prev;
        }
        showToast(`Đã thêm "${trail.name}" vào danh sách so sánh.`, 'success');
        return [...prev, trail];
      });
    },
    [showToast]
  );

  const navigateToTrail = useCallback(
    (trail: Trail, initialTab?: string) => {
      if (!trail) return;
      if (currentView !== 'detail') {
        setPreviousView(currentView);
      }
      const tid = trail.id || (trail as TrailWithMongoId)._id;
      if (tid) {
        const basePath = buildCleanUrl('detail', String(tid));
        const nextUrl = initialTab
          ? `${basePath}?tab=${encodeURIComponent(initialTab)}`
          : basePath;
        window.history.pushState(
          { view: 'detail', trailId: tid, ...(initialTab ? { tab: initialTab } : {}) },
          '',
          nextUrl
        );
      }
      setSelectedTrail(trail);
      setTrailLoadStatus('idle');
      setCurrentView('detail');
      setHubInitialTrailId(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [currentView]
  );

  const handleSelectTrail = useCallback(
    (trail: Trail, initialTab?: string) => {
      navigateToTrail(trail, initialTab);
    },
    [navigateToTrail]
  );

  const handleSelectTrailById = useCallback(
    (trailId: string, initialTab?: string) => {
      const found =
        trailsRef.current.find(
          (t) => t.id === trailId || (t as TrailWithMongoId)._id === trailId
        ) || mockTrails.find((t) => t.id === trailId);
      if (found) {
        trailFetchSeqRef.current += 1;
        navigateToTrail(found, initialTab);
      } else {
        const basePath = buildCleanUrl('detail', trailId);
        const nextUrl = initialTab
          ? `${basePath}?tab=${encodeURIComponent(initialTab)}`
          : basePath;
        window.history.pushState(
          { view: 'detail', trailId, ...(initialTab ? { tab: initialTab } : {}) },
          '',
          nextUrl
        );
        setCurrentView('detail');
        setSelectedTrail(null);
        setTrailLoadStatus('loading');
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

      // Support full deep-links: /trails/:id?tab=map, #trail/:id, #profile-<username>, /profile/:username, /hub?trailId=...
      const [beforeHash, hashFrag] = trimmed.split('#');
      const [rawPathPart, rawQueryPart] = (beforeHash || '').split('?');
      const resolved = safeResolveAppRoute(
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
        const detailTab = rawQueryPart
          ? new URLSearchParams(rawQueryPart).get('tab')?.trim() || undefined
          : undefined;
        handleSelectTrailById(resolved.trailId, detailTab);
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

      if (resolved.isProtected && !currentUser && !safeLocalStorageGet('lost_token')) {
        showToast('Đăng nhập một chút để dùng tính năng này nhé.', 'info');
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

  const handleResetFilters = useCallback(() => {
    setSelectedRegion('All');
    setSelectedDifficulty(null);
    setSelectedDuration(null);
    setCampsiteOnly(false);
    setKidFriendlyOnly(false);
    setSortBy('rating_desc');
    setSearchQuery('');
    setSelectedSeasonMonth(null);
  }, []);

  const handleConfirmLogout = async () => {
    const token = safeLocalStorageGet('lost_token');
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
    safeLocalStorageRemove('lost_token');
    sweepUserScopedStorageKeys();
    clearSensitiveSessionStorage();
    setCurrentUser(null);
    setIsLogoutModalOpen(false);
    window.dispatchEvent(new CustomEvent('lost:auth-changed', { detail: { authenticated: false } }));
    showToast('Đã đăng xuất. Hẹn gặp lại bạn ở cung đường tiếp theo.', 'info');
    handleNavigate('home');
  };

  const handleOpenIncidentReport = useCallback(() => {
    if (!currentUser) {
      showToast('Đăng nhập một chút để gửi cảnh báo đường rừng nhé.', 'info');
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
      showToast('Đã chép bảng dự trù chi phí và chuyển sang góc tìm bạn ghép đoàn!', 'success');
      handleNavigate('forum');
    },
    [handleNavigate, showToast]
  );

  const handleOpenAuthModalLogin = useCallback(() => handleNavigate('login'), [handleNavigate]);
  const handleOpenLogoutModal = useCallback(() => setIsLogoutModalOpen(true), []);
  const handleOpenCommandPaletteModal = useCallback(() => setIsCommandPaletteOpen(true), []);
  const handleOpenLiveTrackerDefault = useCallback(() => handleOpenLiveTracker(), [handleOpenLiveTracker]);
  const handleDismissAlertBanner = useCallback(() => setIsAlertBannerDismissed(true), []);
  const handleToggleCampsite = useCallback(() => setCampsiteOnly((prev) => !prev), []);
  const handleOpenAdvancedFilter = useCallback(() => setIsFilterOpen(true), []);
  const handleOpenEmergencyContacts = useCallback(() => setIsEmergencyContactsOpen(true), []);
  const handleCloseEmergencyContacts = useCallback(() => setIsEmergencyContactsOpen(false), []);
  const handleExploreClick = useCallback(() => handleNavigate('explore'), [handleNavigate]);
  const handleExploreFullMap = useCallback(() => handleNavigate('planner'), [handleNavigate]);
  const handleNavigateToForum = useCallback(() => handleNavigate('forum'), [handleNavigate]);
  const handleClearMonthFilter = useCallback(() => setSelectedSeasonMonth(null), []);
  const handleScrollToMap = useCallback(() => {
    const mapEl = document.getElementById('gis-map-section');
    if (mapEl) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = mapEl.getBoundingClientRect().top;
      const offsetPosition = elementRect - bodyRect - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  }, []);
  const handleScrollToAllTrails = useCallback(() => {
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
  }, []);
  const handleFilterSeasonMonth = useCallback((month: number) => {
    setSelectedSeasonMonth(month);
    const mapEl = document.getElementById('gis-map-section');
    if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth' });
  }, []);
  const buildPreservedCleanUrl = useCallback(() => {
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
    if (typeof window === 'undefined') return clean;
    try {
      const currentParams = new URLSearchParams(window.location.search);
      const preserved = new URLSearchParams();
      if (currentView === 'detail') {
        const tab = currentParams.get('tab')?.trim();
        if (tab) preserved.set('tab', tab);
      } else if (currentView === 'forum') {
        const threadId = currentParams.get('threadId')?.trim();
        if (threadId) preserved.set('threadId', threadId);
      }
      const q = preserved.toString();
      if (!q) return clean;
      return clean.includes('?') ? `${clean}&${q}` : `${clean}?${q}`;
    } catch {
      return clean;
    }
  }, [currentView, selectedTrail?.id, activeBeaconToken, hubInitialTrailId, hubQueryParams]);

  const isDedicatedAdminShell =
    currentView === 'admin' &&
    Boolean(currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator'));
  const hasPwaBanner = Boolean(swWaitingWorker || (deferredPwaInstall && !pwaBannerDismissed));
  const hasCompareDock = comparedTrails.length >= 1;
  const shouldShowScrollTop = showScrollTop && !(isCompactMobile && (hasCompareDock || hasPwaBanner));

  return (
    <SocketProvider currentUser={currentUser}>
      <div className="lost-grain-overlay" aria-hidden="true" />
      <DisconnectBanner hasBottomBar={hasCompareDock || hasPwaBanner} />
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
          onClose={handleCloseEmergencyContacts}
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
            onOpenAuthModal={handleOpenAuthModalLogin}
            onSearchChange={setSearchQuery}
            onLogout={handleOpenLogoutModal}
            onOpenCommandPalette={handleOpenCommandPaletteModal}
            onOpenLiveTracker={handleOpenLiveTrackerDefault}
            onOpenShortcuts={handleOpenShortcutsHelp}
          />
        )}

        {/* Slim Editorial Field Safety Notice Strip (Isolated Memoized Ticker — Zero Root Re-Render) */}
        {!isDedicatedAdminShell && !isAlertBannerDismissed && incidents.length > 0 && (
          <IncidentTickerBanner
            incidents={incidents}
            onSelectIncident={setSelectedIncidentDetail}
            onDismiss={handleDismissAlertBanner}
          />
        )}

        <ErrorBoundary fallbackTitle="Không thể tải nội dung trang">
          <main key={currentView} tabIndex={-1} className="page-view-slide" style={{ flex: 1, outline: 'none' }}>
            {/* VIEW 1: HOME & EXPLORE */}
            {(currentView === 'home' || currentView === 'explore') && (
              <div>
                <HeroExpeditionSection
                  trails={allCatalogTrails}
                  selectedRegion={selectedRegion}
                  onSelectRegion={setSelectedRegion}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  campsiteOnly={campsiteOnly}
                  onToggleCampsite={handleToggleCampsite}
                  onOpenAdvancedFilter={handleOpenAdvancedFilter}
                  onScrollToMap={handleScrollToMap}
                  onScrollToAllTrails={handleScrollToAllTrails}
                  onExploreClick={handleExploreClick}
                  onSelectTrail={handleSelectTrail}
                  onOpenEmergencyContacts={handleOpenEmergencyContacts}
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
                      onNavigateHub={handleNavigate}
                      onOpenLiveTracker={handleOpenLiveTrackerDefault}
                      onOpenCommandPalette={handleOpenCommandPaletteModal}
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
                        onClearMonthFilter={handleClearMonthFilter}
                        onExploreFullMap={handleExploreFullMap}
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
                        onShowToast={showToast}
                        onRequireLogin={(action) => {
                          showToast(`Đăng nhập để ${action} nhé.`, 'info');
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
                      onFilterSeasonMonth={handleFilterSeasonMonth}
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
                        onNavigateToForum={handleNavigateToForum}
                        onShowToast={showToast}
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
                          <div className="section-eyebrow">04 / Kho cung đường</div>
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
                            Tất cả cung đường{' '}
                            <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                              Việt Nam ({displayedTrails.length})
                            </span>
                          </h2>
                          <p style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', margin: '6px 0 0 0' }}>
                            Tracklog GPX, cự ly, độ dốc và bãi hạ trại gom từ những bước chân đi thật.
                            {selectedSeasonMonth ? ` Đang lọc các cung vào mùa đẹp tháng ${selectedSeasonMonth}.` : ''}
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
                            Chưa thấy cung nào khớp với bộ lọc bạn chọn.
                          </div>
                          {hasAnyActiveFilter && (
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={handleResetFilters}
                              style={{ padding: '8px 18px', fontSize: '0.84rem', borderRadius: 4 }}
                            >
                              Xóa lọc, xem tất cả
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
                                className="manifest-table-row"
                                style={{
                                  position: 'relative',
                                  borderLeft: isSelected
                                    ? '2px solid var(--color-primary)'
                                    : '2px solid transparent',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleSelectTrail(t)}
                                  aria-label={`Mở chi tiết cung đường ${t.name}`}
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    zIndex: 1,
                                    background: 'transparent',
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                  }}
                                />
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
                                    position: 'relative',
                                    zIndex: 2,
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    alignItems: 'center',
                                    gap: 10,
                                  }}
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
                              className="editorial-lead-spread"
                              style={{ position: 'relative' }}
                            >
                              <button
                                type="button"
                                onClick={() => handleSelectTrail(displayedTrails[0])}
                                aria-label={`Mở chi tiết tuyến nổi bật ${displayedTrails[0].name}`}
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  zIndex: 1,
                                  background: 'transparent',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                }}
                              />
                              <div className="editorial-lead-media">
                                <img
                                  src={displayedTrails[0].coverImage}
                                  alt={displayedTrails[0].name}
                                  loading="lazy"
                                  decoding="async"
                                  onError={(e) => {
                                    const img = e.currentTarget as HTMLImageElement;
                                    if (img.dataset.fallbackApplied === '1') return;
                                    img.dataset.fallbackApplied = '1';
                                    img.src = DEFAULT_VIETNAM_TRAIL_COVER;
                                  }}
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
                                  Tuyến nổi bật
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
                                      Xem bản đồ &amp; GPX →
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleCompare(displayedTrails[0])}
                                      className="btn btn-outline"
                                      style={{ position: 'relative', zIndex: 2, padding: '6px 12px', fontSize: '0.74rem', borderRadius: 4 }}
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
                            Xem thêm {displayedTrails.length - visibleTrailCount} cung nữa
                          </button>
                        </div>
                      )}
                    </section>
                  </SceneReveal>

                  {/* Safety & Leave No Trace Pledge */}
                  <SceneReveal>
                    <SafetyPledgeSection
                      onOpenEmergencyContacts={handleOpenEmergencyContacts}
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
                      showToast(`Đăng nhập để ${action} nhé.`, 'info');
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
                    404 · Lạc mất tọa độ
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
                    Không tìm thấy cung đường này
                  </h2>
                  <p
                    style={{
                      color: 'var(--color-text-muted)',
                      fontSize: '0.88rem',
                      lineHeight: 1.6,
                      marginBottom: 24,
                    }}
                  >
                    Có vẻ lối rẽ này chưa có trên bản đồ LOST hoặc đã được gộp sang một tuyến khác.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleNavigate('home')}
                      style={{ borderRadius: 4, padding: '9px 20px' }}
                    >
                      Về trang chủ
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => handleNavigate('almanac')}
                      style={{ borderRadius: 4, padding: '9px 20px' }}
                    >
                      Xem lịch mùa {allCatalogTrails.length} cung
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
                    Gửi cung đường mới
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
                    Đăng nhập để đóng góp
                  </h3>
                  <p
                    style={{
                      color: 'var(--color-text-muted)',
                      fontSize: '0.88rem',
                      lineHeight: 1.6,
                      marginBottom: 24,
                    }}
                  >
                    Đăng nhập trước để gửi cung đường mới và file GPX bạn vừa đi về cho anh em cùng tham khảo nhé.
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
                    Đăng nhập
                  </button>
                </div>
              ) : (
                <Suspense fallback={<PageLoadingFallback />}>
                  <TrailContributionWizard
                    currentUser={currentUser}
                    onBack={() => {
                      const isEditing = !!safeLocalStorageGet('lost_editing_contribution');
                      safeLocalStorageRemove('lost_editing_contribution');
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
                    Hồ sơ cá nhân
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
                    Đăng nhập để mở hồ sơ
                  </h3>
                  <p
                    style={{
                      color: 'var(--color-text-muted)',
                      fontSize: '0.88rem',
                      lineHeight: 1.6,
                      marginBottom: 24,
                    }}
                  >
                    Đăng nhập để xem lại các đỉnh đã chạm, nhật ký chuyến đi, cung muốn đi và huy hiệu của bạn.
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
                    Đăng nhập
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
                    showToast(`Đăng nhập để ${action} nhé.`, 'info');
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
                    Khu vực dành riêng cho quản trị viên
                  </h3>
                  <p
                    style={{
                      color: 'var(--color-text-muted)',
                      fontSize: '0.88rem',
                      lineHeight: 1.6,
                      marginBottom: 24,
                    }}
                  >
                    Trang này chỉ mở cho tài khoản quản trị hoặc kiểm duyệt viên của LOST.
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
                    Đăng nhập tài khoản quản trị
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
            window.history.replaceState({ view: currentView }, '', buildPreservedCleanUrl());
          }}
          onAuthSuccess={(user) => {
            setCurrentUser(user);
            window.history.replaceState({ view: currentView }, '', buildPreservedCleanUrl());
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
          toastId={toast.id}
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
          <Suspense fallback={<ModalLoadingFallback label="Đang mở phiếu báo sự cố..." />}>
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
          <Suspense fallback={<ModalLoadingFallback label="Đang mở hẹn giờ báo bình an..." />}>
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
          <Suspense fallback={<ModalLoadingFallback label="Đang mở hồ sơ thành viên..." />}>
            <AuthorProfileModal
              author={{ name: publicProfileUsername, avatar: '' }}
              currentUser={currentUser}
              onClose={() => {
                setPublicProfileUsername(null);
                window.history.replaceState({ view: currentView }, '', buildPreservedCleanUrl());
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
                    Chi tiết cảnh báo trên tuyến
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                        MỨC ĐỘ: {formatIncidentSeverityVi(selectedIncidentDetail.severity)}
                      </span>
                      {selectedIncidentDetail.verifiedBy ? (
                        <span className="badge badge-success">
                          <IconCheck size={12} color="var(--color-primary)" /> Đã xác minh
                        </span>
                      ) : (
                        <span className="badge badge-warning">
                          Chờ kiểm chứng hiện trường
                        </span>
                      )}
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
                      <span>Ảnh chụp từ hiện trường:</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>
                        (Ảnh thực tế do người đi gửi về)
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
                    <strong style={{ color: 'var(--color-text-main)' }}>Diễn biến trên tuyến:</strong>
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
                        {selectedIncidentDetail.verifiedBy ? 'Đơn vị xác minh: ' : 'Người báo tin: '}
                      </strong>
                      <span style={{ color: 'var(--color-text-main)' }}>
                        {selectedIncidentDetail.verifiedBy ||
                          selectedIncidentDetail.userName ||
                          'Thành viên cộng đồng LOST'}
                      </span>
                    </div>
                    {selectedIncidentDetail.coordinates && (
                      <div>
                        <strong style={{ color: 'var(--color-sky)' }}>Tọa độ GPS: </strong>
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
                        Số cứu hộ khẩn cấp:
                      </strong>
                      <a
                        href={extractTelHref(selectedIncidentDetail.rescueContact)}
                        style={{
                          color: 'var(--color-error-text, var(--color-error))',
                          fontWeight: 800,
                          textDecoration: 'underline',
                          textUnderlineOffset: 3,
                        }}
                      >
                        {selectedIncidentDetail.rescueContact ||
                          '112 / 114 (Tổng đài Tìm kiếm cứu nạn & PCCC quốc gia 24/7)'}
                      </a>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
                      Lưu ý sóng rừng VN: 112/114/115 hỗ trợ gọi thoại miễn phí (không nhận SMS). Nếu chỉ có sóng yếu 2G, hãy gửi SMS tọa độ GPS tới SĐT người thân hoặc porter.
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
                    Đóng
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
                    Báo sự cố / gọi hỗ trợ
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
              <span>Đang chọn {comparedTrails.length}/4 cung</span>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsCompareModalOpen(true)}
              style={{ padding: '6px 14px', fontSize: '0.78rem', borderRadius: 4 }}
            >
              So sánh ngay
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
              Bỏ chọn
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
        {shouldShowScrollTop && (
          <button
            type="button"
            className="fab-pop-in interactive-click"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="Cuộn lên đầu trang"
            aria-label="Cuộn lên đầu trang"
            style={{
              position: 'fixed',
              bottom: hasCompareDock ? 82 : 24,
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
            hasScrollTop={shouldShowScrollTop || hasCompareDock}
          />
        )}

        {isAiAssistantOpen && (
          <Suspense fallback={<ModalLoadingFallback label="Đang mở trợ lý LOST AI..." />}>
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
          <Suspense fallback={<ModalLoadingFallback label="Đang mở tìm kiếm nhanh..." />}>
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
          <Suspense fallback={<ModalLoadingFallback label="Đang bật Live GPS..." />}>
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
        {hasPwaBanner && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: 'fixed',
              bottom: hasCompareDock ? 84 : 24,
              left: isCompactMobile ? 12 : 24,
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
              maxWidth: isCompactMobile ? 'calc(100vw - 88px)' : 'calc(100vw - 96px)',
              fontSize: '0.8rem',
            }}
          >
            <span style={{ fontWeight: 700 }}>
              {swWaitingWorker
                ? 'LOST vừa có bản mới'
                : 'Cài LOST về máy để dùng khi mất sóng'}
            </span>
            {swWaitingWorker ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const worker = swWaitingWorker;
                  setSwWaitingWorker(null);
                  let reloaded = false;
                  const triggerReload = () => {
                    if (reloaded) return;
                    reloaded = true;
                    window.location.reload();
                  };
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.addEventListener('controllerchange', triggerReload, {
                      once: true,
                    });
                  }
                  worker.postMessage({ type: 'SKIP_WAITING' });
                  window.setTimeout(triggerReload, 2500);
                }}
                style={{ padding: '5px 12px', fontSize: '0.75rem', borderRadius: 4 }}
              >
                Cập nhật
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
                Cài ngay
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
