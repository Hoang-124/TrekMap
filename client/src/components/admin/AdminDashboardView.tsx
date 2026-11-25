import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { UserProfile } from '../../types.js';
import {
  IconPin,
  IconLock,
  IconTrash,
  IconX,
  IconStar,
  IconPhone,
  IconMapPin,
  IconSatellite,
  IconShieldAlert,
  IconBackpack,
  IconMail,
  IconCalendar,
  IconPlus,
  IconArrowLeft,
  IconCheckCircle,
  IconEye,
  IconShieldCheck,
  IconAlertTriangle,
  IconUsers,
  IconMessageSquare,
  IconClock,
  IconCompass,
  IconSearch,
  IconRotateCw,
  IconRadio,
} from '../common/SvgIcons.js';
import { useSocketConnection } from '../../context/SocketContext.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { searchMatchVietnamese } from '../../utils/textUtils.js';
import { isTopmostFocusTrap, useFocusTrap } from '../../hooks/useFocusTrap.js';
import { ThemeToggle } from '../common/ThemeToggle.js';
import type {
  AdminCockpitSectionId,
  CockpitBeaconPoint,
  CockpitContributionPoint,
  CockpitCoordListener,
  CockpitCoordPoint,
  CockpitIncidentPoint,
  CockpitInspectorSelection,
  CockpitOverdueTimerPoint,
  CockpitTrailPoint,
  CockpitTriageItem,
  CockpitUserPoint,
} from './adminCockpitTypes.js';
import { AdminCommandDeck, type AdminCommandDeckStats } from './AdminCommandDeck.js';
import { AdminSpatialInspector } from './AdminSpatialInspector.js';
import { AdminStatusBar, type AdminReadinessLevel } from './AdminStatusBar.js';
import {
  AdminAuthorModal,
  AdminConfirmDialog,
  ContributionDetailModal,
  CreateTrailModal,
  EditTrailModal,
  type AdminAuthorModalState,
  type AdminContributionItem,
  type AdminTrailItem,
  type AdminUserItem,
  type ConfirmDialogState,
  type EntityRef,
  type TrailFormState,
  type ValidRegion,
} from './AdminModals.js';
import { safeLocalStorageSet } from '../../utils/storageScope.js';

const DEFAULT_TRAIL_COVER = '/covers/trail-fansipan.svg';
const DEFAULT_AVATAR = '/covers/avatar-default.svg';
const activeAdminActionLocks = new Set<string>();
const adminFetchControllers = new Map<string, AbortController>();

const createAdminFetchSignal = (key: string): AbortSignal => {
  const existing = adminFetchControllers.get(key);
  if (existing) existing.abort();
  const controller = new AbortController();
  adminFetchControllers.set(key, controller);
  return controller.signal;
};

const abortAllAdminFetches = () => {
  adminFetchControllers.forEach((ctrl) => ctrl.abort());
  adminFetchControllers.clear();
};

const createSvgIcon = (d: React.ReactNode, defaultSize = 18) => {
  return ({
    size = defaultSize,
    color = 'currentColor',
    style,
    className,
  }: {
    size?: number;
    color?: string;
    style?: React.CSSProperties;
    className?: string;
  }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
    >
      {d}
    </svg>
  );
};

// Reuse shared icons from SvgIcons.tsx to avoid duplicate inline SVG declarations
const ArrowLeft = IconArrowLeft;
const CheckCircle2 = IconCheckCircle;
const Trash2 = IconTrash;
const Eye = IconEye;
const ShieldCheck = IconShieldCheck;
const AlertTriangle = IconAlertTriangle;
const Users = IconUsers;
const MessageSquare = IconMessageSquare;
const Clock = IconClock;
const Compass = IconCompass;
const Search = IconSearch;
const RefreshCw = IconRotateCw;
const Radio = IconRadio;

const XCircle = createSvgIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </>
);
const Inbox = createSvgIcon(
  <>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </>
);
const Layers = createSvgIcon(
  <>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </>
);
const BarChart3 = createSvgIcon(
  <>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </>
);
const Database = createSvgIcon(
  <>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </>
);
const ExternalLinkIcon = createSvgIcon(
  <>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </>
);
const MenuIcon = createSvgIcon(
  <>
    <line x1="4" y1="7" x2="20" y2="7" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="17" x2="20" y2="17" />
  </>
);
const PanelLeftClose = createSvgIcon(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <polyline points="16 15 13 12 16 9" />
  </>
);
const PanelLeftOpen = createSvgIcon(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <polyline points="13 9 16 12 13 15" />
  </>
);

const formatDateVi = (value?: string): string => {
  if (!value) return 'Gần đây';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeRegion = (value?: string): ValidRegion => {
  if (value === 'Miền Bắc' || value === 'Miền Trung' || value === 'Miền Nam') {
    return value;
  }
  const norm = (value || '').trim().toLowerCase();
  if (
    norm.includes('tây nguyên') ||
    norm.includes('tay nguyen') ||
    norm.includes('trung') ||
    norm.includes('lâm đồng') ||
    norm.includes('đà lạt') ||
    norm.includes('đắk') ||
    norm.includes('gia lai') ||
    norm.includes('kon tum')
  ) {
    return 'Miền Trung';
  }
  if (norm.includes('nam') || norm.includes('cửu long')) {
    return 'Miền Nam';
  }
  return 'Miền Bắc';
};

const extractEntityId = (ref: EntityRef): string => {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'object') return String(ref._id || ref.id || '');
  return String(ref);
};

type AdminSectionId = AdminCockpitSectionId;

const VALID_ADMIN_SECTIONS = new Set<AdminSectionId>([
  'overview',
  'contributions',
  'trails',
  'incidents',
  'inquiries',
  'safety',
  'field',
  'users',
  'forum',
  'stats',
  'audit',
]);

const resolveInitialAdminSection = (): AdminSectionId => {
  if (typeof window === 'undefined') return 'overview';
  const rawTab = (new URLSearchParams(window.location.search).get('tab') || '').trim().toLowerCase();
  if (VALID_ADMIN_SECTIONS.has(rawTab as AdminSectionId)) {
    return rawTab as AdminSectionId;
  }
  if (rawTab === 'beacons' || rawTab === 'timers') {
    return 'safety';
  }
  if (rawTab === 'pois' || rawTab === 'reviews') {
    return 'field';
  }
  return 'overview';
};

const resolveInitialFieldSubTab = (): 'pois' | 'reviews' => {
  if (typeof window === 'undefined') return 'pois';
  const rawTab = (new URLSearchParams(window.location.search).get('tab') || '').trim().toLowerCase();
  return rawTab === 'reviews' ? 'reviews' : 'pois';
};

const createEmptyTrailForm = (): TrailFormState => ({
  name: '',
  altNames: '',
  province: '',
  district: '',
  region: 'Miền Bắc',
  distanceKm: '',
  elevationGainM: '',
  maxAltitudeM: '',
  durationDays: '2',
  durationHoursNote: '2 ngày 1 đêm',
  difficultyLevel: '3',
  difficultyNote: '',
  startLat: '',
  startLng: '',
  endLat: '',
  endLng: '',
  coverImage: '',
  bestMonths: '',
  avoidMonths: '',
  description: '',
  transportationInfo: '',
  permitRequired: false,
  permitInfo: '',
  hasCampsite: true,
  hasWaterSource: true,
  kidFriendly: false,
  rescueContactName: '',
  rescueContactPhone: '112 / 114',
  rescueContactRanger: '',
  status: 'approved',
});

const parseCommaStrings = (raw: string): string[] =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const parseMonthList = (raw: string): number[] =>
  Array.from(
    new Set(
      raw
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12)
    )
  ).sort((a, b) => a - b);

const hasValidVnCoords = (item: { startLat?: number; startLng?: number }): boolean => {
  const lat = Number(item.startLat);
  const lng = Number(item.startLng);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 7.0 && lat <= 24.0 && lng >= 101.8 && lng <= 115.5;
};

const DUPLICATE_PEAK_RADIUS_KM = 2.0;

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

interface AdminIncidentDispute {
  userName?: string;
  reason?: string;
  disputedAt?: string;
}

interface AdminIncidentItem {
  _id?: string;
  id?: string;
  trailId?: string;
  trailName?: string;
  type?: string;
  severity?: string;
  description?: string;
  locationNote?: string;
  lat?: number;
  lng?: number;
  reportedAt?: string;
  createdAt?: string;
  reportedBy?: EntityRef;
  reporterName?: string;
  reporterEmail?: string;
  userName?: string;
  resolved?: boolean;
  active?: boolean;
  confirmations?: number;
  disputes?: AdminIncidentDispute[];
  isSynthetic?: boolean;
  verifiedBy?: string;
}

const isSyntheticIncident = (inc: AdminIncidentItem): boolean => {
  const idStr = String(inc.id || inc._id || '');
  return Boolean(inc.isSynthetic || idStr.startsWith('weather-live-') || idStr.startsWith('nasa-'));
};

interface AdminForumThreadItem {
  _id?: string;
  id?: string;
  title?: string;
  category?: string;
  authorName?: string;
  createdAt?: string;
  isPinned?: boolean;
  isLocked?: boolean;
  upvotes?: number;
  repliesCount?: number;
}

interface AdminStatsSummary {
  totalUsers?: number;
  totalTrails?: number;
  totalContributions?: number;
  pendingContributions?: number;
  totalIncidents?: number;
  totalThreads?: number;
  totalReviews?: number;
  totalCheckins?: number;
  totalTripPlans?: number;
  totalTripReports?: number;
  totalGuides?: number;
  activeSafetyTimers?: number;
}

interface AdminAuditLogItem {
  _id?: string;
  action?: string;
  targetCollection?: string;
  details?: string;
  ipAddress?: string;
  createdAt?: string;
  userId?: { fullName?: string; username?: string; email?: string } | null;
}

interface AdminGuideInquiryItem {
  _id: string;
  userId?:
    | {
        _id?: string;
        fullName?: string;
        username?: string;
        email?: string;
        avatarUrl?: string;
        phone?: string;
      }
    | string;
  guideId?:
    | {
        _id?: string;
        name?: string;
        phone?: string;
        avatarUrl?: string;
        region?: string;
        roleType?: string;
        priceNote?: string;
        basePricePerDayVnd?: number;
        verified?: boolean;
      }
    | string;
  trailId?:
    | {
        _id?: string;
        id?: string;
        name?: string;
        province?: string;
        region?: string;
        maxAltitudeM?: number;
      }
    | string;
  trailSlug?: string;
  trailName?: string;
  plannedStartDate?: string;
  durationDays?: number;
  groupSize?: number;
  needPortersCount?: number;
  contactPhone?: string;
  notes?: string;
  estimatedTotalVnd?: number;
  status: 'pending' | 'contacted' | 'confirmed' | 'cancelled';
  createdAt?: string;
}

interface AdminSafetyTimerItem {
  _id: string;
  userId?:
    | {
        _id?: string;
        fullName?: string;
        username?: string;
        email?: string;
        avatarUrl?: string;
        phone?: string;
        role?: string;
      }
    | string;
  trailSlug?: string;
  trailName?: string;
  startedAt?: string;
  expectedReturnAt?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactEmail?: string;
  lastKnownLat?: number;
  lastKnownLng?: number;
  notes?: string;
  status: 'active' | 'checked_in_safe' | 'overdue_alerted' | 'cancelled';
  checkedInSafeAt?: string;
  alertedAt?: string;
  createdAt?: string;
}

interface AdminLiveBeaconItem {
  _id?: string;
  token: string;
  sharePath?: string;
  userId?:
    | {
        _id?: string;
        fullName?: string;
        username?: string;
        email?: string;
        phone?: string;
        avatarUrl?: string;
        emergencyContact?: string;
      }
    | string;
  displayName?: string;
  trailId?: string;
  trailName?: string;
  status: 'active' | 'paused' | 'safe' | 'sos';
  batteryPercent?: number | null;
  distanceKm?: number;
  elevationGainM?: number;
  lastPosition?: {
    lat: number;
    lng: number;
    altitudeM?: number | null;
    accuracyM?: number | null;
    recordedAt?: string;
  } | null;
  emergencyNote?: string;
  lastPingAt?: string;
  minutesSinceLastPing?: number;
  isSignalStale?: boolean;
  breadcrumbsCount?: number;
  expiresAt?: string;
  createdAt?: string;
}

interface AdminTrailPoiItem {
  _id: string;
  trailId?: string;
  trailName?: string;
  trailProvince?: string;
  trail?: { id?: string; name?: string; province?: string; region?: string } | null;
  userId?:
    | {
        _id?: string;
        fullName?: string;
        email?: string;
        avatarUrl?: string;
        username?: string;
      }
    | string;
  authorName?: string;
  category: 'water' | 'camp' | 'signal' | 'danger' | 'viewpoint';
  title: string;
  notes?: string;
  lat: number;
  lng: number;
  elevationM?: number | null;
  status: 'active' | 'dry_or_closed';
  upvoteCount?: number;
  lastConfirmedAt?: string;
  createdAt?: string;
}

interface AdminReviewItem {
  _id: string;
  trailId?:
    | {
        _id?: string;
        id?: string;
        name?: string;
        province?: string;
        region?: string;
      }
    | string;
  userId?:
    | {
        _id?: string;
        fullName?: string;
        email?: string;
        avatarUrl?: string;
        username?: string;
      }
    | string;
  userName?: string;
  userAvatar?: string;
  rating: number;
  difficultyRating?: number;
  content: string;
  safetyNote?: string;
  helpfulCount?: number;
  tripDate?: string;
  createdAt?: string;
}

const POI_CATEGORY_LABELS: Record<AdminTrailPoiItem['category'], string> = {
  water: 'Nguồn nước',
  camp: 'Bãi cắm trại',
  signal: 'Sóng di động',
  danger: 'Điểm nguy hiểm',
  viewpoint: 'Điểm ngắm cảnh',
};

const INQUIRY_STATUS_META: Record<
  AdminGuideInquiryItem['status'],
  { label: string; badgeClass: string }
> = {
  pending: { label: 'Chờ xử lý', badgeClass: 'badge badge-sun' },
  contacted: { label: 'Đã liên hệ', badgeClass: 'badge badge-info' },
  confirmed: { label: 'Đã xác nhận', badgeClass: 'badge badge-success' },
  cancelled: { label: 'Đã hủy', badgeClass: 'badge badge-error' },
};

const getRoleLabelVi = (role?: string): string => {
  const norm = (role || 'user').toLowerCase();
  if (norm === 'admin') return 'Quản trị viên';
  if (norm === 'moderator') return 'Điều hành viên';
  if (norm === 'guide') return 'Hướng dẫn viên';
  return 'Thành viên';
};

const getSeverityLabelVi = (severity?: string): string => {
  const norm = (severity || '').toLowerCase();
  if (norm === 'critical' || norm === 'nghiêm trọng') return 'Nghiêm trọng';
  if (norm === 'high' || norm === 'cao') return 'Cao';
  if (norm === 'medium' || norm === 'moderate' || norm === 'trung bình') return 'Trung bình';
  if (norm === 'low' || norm === 'thấp') return 'Thấp';
  return severity || 'Cao';
};

const formatDateOnlyVi = (value?: string): string => {
  if (!value) return 'Chưa rõ';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

interface AdminDashboardViewProps {
  onBack: () => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  currentUser?: (UserProfile & { _id?: string }) | null;
  onOpenCommandPalette?: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onBack,
  onShowToast,
  currentUser,
  onOpenCommandPalette,
}) => {
  const isStrictAdmin = currentUser?.role === 'admin';
  const currentUserId = String(currentUser?._id || currentUser?.id || '').trim();
  const { socket, isConnected: isSocketConnected } = useSocketConnection();
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem('lost_admin_rail_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [inspectorSelection, setInspectorSelection] = useState<CockpitInspectorSelection | null>(null);

  // Zero-re-render coordinate pub-sub channel so mousemove over radar never cascades root state
  const hoverCoordListenersRef = useRef<Set<CockpitCoordListener>>(new Set());
  const emitHoverCoords = useCallback((coords: CockpitCoordPoint | null) => {
    hoverCoordListenersRef.current.forEach((listener) => listener(coords));
  }, []);
  const subscribeHoverCoords = useCallback((listener: CockpitCoordListener) => {
    hoverCoordListenersRef.current.add(listener);
    return () => {
      hoverCoordListenersRef.current.delete(listener);
    };
  }, []);

  const toggleRailCollapsed = useCallback(() => {
    setRailCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('lost_admin_rail_collapsed', next ? '1' : '0');
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const handleCloseInspector = useCallback(() => {
    setInspectorSelection(null);
  }, []);

  const handleSelectInspector = useCallback((nextSelection: CockpitInspectorSelection) => {
    setInspectorSelection(nextSelection);
  }, []);

  const [adminSection, setAdminSection] = useState<AdminSectionId>(resolveInitialAdminSection);
  const [fieldSubTab, setFieldSubTab] = useState<'pois' | 'reviews'>(resolveInitialFieldSubTab);
  const effectiveSection: AdminSectionId =
    !isStrictAdmin && (adminSection === 'users' || adminSection === 'audit')
      ? 'overview'
      : adminSection;

  const handleSelectSection = useCallback(
    (next: AdminSectionId, nextFieldSubTab?: 'pois' | 'reviews') => {
      if (!isStrictAdmin && (next === 'users' || next === 'audit')) return;
      if (next === 'field' && nextFieldSubTab) {
        setFieldSubTab(nextFieldSubTab);
      }
      setAdminSection(next);
      setMobileRailOpen(false);
      try {
        if (typeof window !== 'undefined' && window.location.pathname === '/admin') {
          const urlTab = next === 'field' && nextFieldSubTab === 'reviews' ? 'reviews' : next;
          const nextUrl = `/admin?tab=${encodeURIComponent(urlTab)}`;
          window.history.replaceState(null, '', nextUrl);
        }
      } catch {
        // ignore history API errors
      }
    },
    [isStrictAdmin]
  );

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [incidentFilter, setIncidentFilter] = useState<'active' | 'resolved' | 'all'>('active');
  const [incidentSearchQuery, setIncidentSearchQuery] = useState<string>('');
  const [forumSearchQuery, setForumSearchQuery] = useState<string>('');
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [userRoleFilter, setUserRoleFilter] = useState<
    'all' | 'admin' | 'moderator' | 'guide' | 'user' | 'banned'
  >('all');
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState<
    'all' | 'pending' | 'contacted' | 'confirmed' | 'cancelled'
  >('all');
  const [inquirySearchQuery, setInquirySearchQuery] = useState<string>('');
  const [updatingInquiryId, setUpdatingInquiryId] = useState<string | null>(null);
  const [safetyTimerView, setSafetyTimerView] = useState<'live' | 'checked_in_safe' | 'cancelled'>('live');
  const [fieldSearchQuery, setFieldSearchQuery] = useState<string>('');
  const [togglingPoiId, setTogglingPoiId] = useState<string | null>(null);

  const [selectedContribution, setSelectedContribution] = useState<AdminContributionItem | null>(null);
  const [selectedAuthorModal, setSelectedAuthorModal] = useState<AdminAuthorModalState | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [trailSearchQuery, setTrailSearchQuery] = useState<string>('');
  const [recentlyHiddenTrails, setRecentlyHiddenTrails] = useState<AdminTrailItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [accessNotice, setAccessNotice] = useState<string>('');
  const [sectionErrors, setSectionErrors] = useState<Partial<Record<AdminSectionId, string>>>({});
  const [busyActions, setBusyActions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    return () => {
      activeAdminActionLocks.clear();
    };
  }, []);

  const acquireActionLock = useCallback((key: string): boolean => {
    if (activeAdminActionLocks.has(key)) return false;
    activeAdminActionLocks.add(key);
    setBusyActions((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
    return true;
  }, []);

  const releaseActionLock = useCallback((key: string) => {
    activeAdminActionLocks.delete(key);
    setBusyActions((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmReason, setConfirmReason] = useState<string>('');
  const [isConfirmExecuting, setIsConfirmExecuting] = useState<boolean>(false);
  const [dbHealth, setDbHealth] = useState<{
    status: 'checking' | 'online' | 'connecting' | 'degraded' | 'offline';
    label: string;
  }>({ status: 'checking', label: 'Đang kiểm tra...' });

  const [contributions, setContributions] = useState<AdminContributionItem[]>([]);

  const contribModalRef = useRef<HTMLDivElement>(null);
  const authorModalRef = useRef<HTMLDivElement>(null);
  const editTrailModalRef = useRef<HTMLDivElement>(null);
  const createTrailModalRef = useRef<HTMLDivElement>(null);
  const confirmModalRef = useRef<HTMLDivElement>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (refreshTimerRef.current !== null) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

  const [trailsList, setTrailsList] = useState<AdminTrailItem[]>([]);
  const [incidentsList, setIncidentsList] = useState<AdminIncidentItem[]>([]);
  const [usersList, setUsersList] = useState<AdminUserItem[]>([]);
  const [threadsList, setThreadsList] = useState<AdminForumThreadItem[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStatsSummary | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);
  const [inquiriesList, setInquiriesList] = useState<AdminGuideInquiryItem[]>([]);
  // Keep live safety timers isolated from historical archive views so KHẨN CẤP readiness never drops falsely
  const [liveSafetyTimers, setLiveSafetyTimers] = useState<AdminSafetyTimerItem[]>([]);
  const [archivedSafetyTimers, setArchivedSafetyTimers] = useState<
    Record<'checked_in_safe' | 'cancelled', AdminSafetyTimerItem[]>
  >({
    checked_in_safe: [],
    cancelled: [],
  });
  const [liveBeaconsList, setLiveBeaconsList] = useState<AdminLiveBeaconItem[]>([]);
  const [loadedSections, setLoadedSections] = useState<Set<AdminSectionId>>(() => new Set());
  const loadedSectionsRef = useRef<Set<AdminSectionId>>(loadedSections);
  useEffect(() => {
    loadedSectionsRef.current = loadedSections;
  }, [loadedSections]);

  const markSectionLoaded = useCallback((section: AdminSectionId) => {
    setSectionErrors((prev) => {
      if (!prev[section]) return prev;
      const next = { ...prev };
      delete next[section];
      return next;
    });
    setLoadedSections((prev) => {
      if (prev.has(section)) return prev;
      const next = new Set(prev);
      next.add(section);
      return next;
    });
  }, []);

  const markSectionError = useCallback((section: AdminSectionId, message: string) => {
    setSectionErrors((prev) => (prev[section] === message ? prev : { ...prev, [section]: message }));
  }, []);

  const [poisList, setPoisList] = useState<AdminTrailPoiItem[]>([]);
  const [poisTotal, setPoisTotal] = useState<number>(0);
  const [reviewsList, setReviewsList] = useState<AdminReviewItem[]>([]);
  const [reviewsTotal, setReviewsTotal] = useState<number>(0);

  const [editingTrailModal, setEditingTrailModal] = useState<AdminTrailItem | null>(null);
  const [editTrailForm, setEditTrailForm] = useState<TrailFormState>(createEmptyTrailForm);
  const [isSavingTrail, setIsSavingTrail] = useState(false);

  const [isCreateTrailOpen, setIsCreateTrailOpen] = useState(false);
  const [createTrailForm, setCreateTrailForm] = useState<TrailFormState>(createEmptyTrailForm);
  const [isCreatingTrail, setIsCreatingTrail] = useState(false);

  const createFetchSignal = useCallback((key: string): AbortSignal => {
    return createAdminFetchSignal(key);
  }, []);

  useEffect(() => {
    return () => {
      abortAllAdminFetches();
    };
  }, []);

  const isAbortError = (err: unknown): boolean =>
    err instanceof DOMException
      ? err.name === 'AbortError'
      : Boolean(err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError');

  const openConfirmDialog = useCallback((dialog: ConfirmDialogState) => {
    setConfirmReason(dialog.defaultReason || '');
    setConfirmDialog(dialog);
  }, []);

  const handleOpenContributeWizard = useCallback(() => {
    try {
      localStorage.removeItem('lost_editing_contribution');
    } catch {
      // ignore storage errors
    }
    setIsCreateTrailOpen(false);
    window.location.hash = '#contribute';
  }, []);

  const openEditTrailModal = useCallback(
    (trail: AdminTrailItem) => {
      if (!isStrictAdmin) return;
      setEditingTrailModal(trail);
      setEditTrailForm({
        name: trail.name || '',
        altNames: Array.isArray(trail.altNames) ? trail.altNames.join(', ') : '',
        province: trail.province || '',
        district: trail.district || '',
        region: normalizeRegion(trail.region),
        distanceKm: String(trail.distanceKm ?? 0),
        elevationGainM: String(trail.elevationGainM ?? 0),
        maxAltitudeM: String(trail.maxAltitudeM ?? 0),
        durationDays: String(trail.durationDays ?? 1),
        durationHoursNote: trail.durationHoursNote || '',
        difficultyLevel: String(trail.difficultyLevel ?? 3),
        difficultyNote: trail.difficultyNote || '',
        startLat: trail.startLat !== undefined && trail.startLat !== null ? String(trail.startLat) : '',
        startLng: trail.startLng !== undefined && trail.startLng !== null ? String(trail.startLng) : '',
        endLat: trail.endLat !== undefined && trail.endLat !== null ? String(trail.endLat) : '',
        endLng: trail.endLng !== undefined && trail.endLng !== null ? String(trail.endLng) : '',
        coverImage: trail.coverImage || '',
        bestMonths: Array.isArray(trail.bestMonths) ? trail.bestMonths.join(', ') : '',
        avoidMonths: Array.isArray(trail.avoidMonths) ? trail.avoidMonths.join(', ') : '',
        description: trail.description || '',
        transportationInfo: trail.transportationInfo || '',
        permitRequired: Boolean(trail.permitRequired),
        permitInfo: trail.permitInfo || '',
        hasCampsite: Boolean(trail.hasCampsite),
        hasWaterSource: Boolean(trail.hasWaterSource),
        kidFriendly: Boolean(trail.kidFriendly),
        rescueContactName: trail.rescueContact?.name || '',
        rescueContactPhone: trail.rescueContact?.phone || '',
        rescueContactRanger: trail.rescueContact?.rangerContact || '',
        status:
          trail.status === 'pending' || trail.status === 'rejected' ? trail.status : 'approved',
      });
    },
    [isStrictAdmin]
  );

  useFocusTrap(Boolean(selectedContribution), contribModalRef);
  useFocusTrap(Boolean(selectedAuthorModal), authorModalRef);
  useFocusTrap(Boolean(editingTrailModal), editTrailModalRef);
  useFocusTrap(isCreateTrailOpen, createTrailModalRef);
  useFocusTrap(Boolean(confirmDialog), confirmModalRef);

  // Escape key closes topmost open modal (strict LIFO via topmost focus trap + IME guard)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.key !== 'Escape') return;
      if (confirmDialog && isTopmostFocusTrap(confirmModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!isConfirmExecuting) setConfirmDialog(null);
      } else if (isCreateTrailOpen && isTopmostFocusTrap(createTrailModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!isCreatingTrail) setIsCreateTrailOpen(false);
      } else if (editingTrailModal && isTopmostFocusTrap(editTrailModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!isSavingTrail) setEditingTrailModal(null);
      } else if (selectedAuthorModal && isTopmostFocusTrap(authorModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setSelectedAuthorModal(null);
      } else if (selectedContribution && isTopmostFocusTrap(contribModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setSelectedContribution(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    confirmDialog,
    isConfirmExecuting,
    isCreateTrailOpen,
    isCreatingTrail,
    editingTrailModal,
    isSavingTrail,
    selectedAuthorModal,
    selectedContribution,
  ]);

  const handleForbiddenStatus = useCallback((res: Response, areaLabel: string): boolean => {
    if (res.status === 403) {
      setAccessNotice(
        `Tài khoản này chưa có quyền mở mục "${areaLabel}" (cần quyền quản trị viên).`
      );
      return true;
    }
    return false;
  }, []);

  const fetchHealthStatus = useCallback(async (): Promise<boolean> => {
    const signal = createFetchSignal('health');
    try {
      const res = await fetch('/api/health', { cache: 'no-store', signal });
      const data = await res.json().catch(() => ({}));
      const dbStr = String(data?.database || '');
      if (res.ok && dbStr === 'Connected') {
        setDbHealth({ status: 'online', label: 'Trực tuyến' });
        return true;
      } else if (dbStr === 'Connecting') {
        setDbHealth({ status: 'connecting', label: 'Đang kết nối' });
        return false;
      } else {
        setDbHealth({ status: 'degraded', label: 'Gián đoạn' });
        return false;
      }
    } catch (err) {
      if (isAbortError(err)) return true;
      setDbHealth({ status: 'offline', label: 'Ngoại tuyến' });
      return false;
    }
  }, [createFetchSignal]);

  const fetchFromMongo = useCallback(async (): Promise<boolean> => {
    const signal = createFetchSignal('contributions');
    try {
      const res = await fetch('/api/contributions', {
        headers: getApiHeaders(),
        signal,
      });
      if (handleForbiddenStatus(res, 'Duyệt đóng góp')) return false;
      if (!res.ok) {
        markSectionError('contributions', 'Không thể tải danh sách bài đóng góp.');
        return false;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setContributions(data.data);
        markSectionLoaded('contributions');
        setSelectedContribution((prev) => {
          if (!prev) return null;
          const found = (data.data as AdminContributionItem[]).find(
            (x) => x.id === prev.id || x._id === prev._id
          );
          return found || null;
        });
        return true;
      }
      markSectionError('contributions', 'Dữ liệu bài đóng góp chưa hợp lệ.');
      return false;
    } catch (err) {
      if (isAbortError(err)) return true;
      markSectionError('contributions', 'Không kết nối được máy chủ khi tải bài đóng góp.');
      return false;
    }
  }, [createFetchSignal, handleForbiddenStatus, markSectionLoaded, markSectionError]);

  const fetchAdminUsers = useCallback(async (): Promise<boolean> => {
    if (!isStrictAdmin) return false;
    const signal = createFetchSignal('users');
    try {
      const res = await fetch('/api/admin/users', {
        headers: getApiHeaders(),
        signal,
      });
      if (handleForbiddenStatus(res, 'Thành viên & phân quyền')) return false;
      if (!res.ok) {
        markSectionError('users', 'Không thể tải danh sách thành viên.');
        return false;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setUsersList(data.data);
        markSectionLoaded('users');
        return true;
      }
      markSectionError('users', 'Dữ liệu thành viên chưa hợp lệ.');
      return false;
    } catch (err) {
      if (isAbortError(err)) return true;
      markSectionError('users', 'Không kết nối được máy chủ khi tải danh sách thành viên.');
      return false;
    }
  }, [isStrictAdmin, createFetchSignal, handleForbiddenStatus, markSectionLoaded, markSectionError]);

  const fetchAdminTrails = useCallback(async (): Promise<boolean> => {
    const signal = createFetchSignal('trails');
    try {
      // Live server exposes public catalog on GET /api/trails (no GET /api/admin/trails route)
      const res = await fetch('/api/trails', {
        headers: getApiHeaders(),
        signal,
      });
      if (!res.ok) {
        markSectionError('trails', 'Không thể tải danh sách cung đường.');
        return false;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setTrailsList(data.data);
        markSectionLoaded('trails');
        return true;
      }
      markSectionError('trails', 'Dữ liệu cung đường chưa hợp lệ.');
      return false;
    } catch (err) {
      if (isAbortError(err)) return true;
      markSectionError('trails', 'Không kết nối được máy chủ khi tải cung đường.');
      return false;
    }
  }, [createFetchSignal, markSectionLoaded, markSectionError]);

  const fetchAdminIncidents = useCallback(async (): Promise<boolean> => {
    const signal = createFetchSignal('incidents');
    try {
      const res = await fetch('/api/incidents?includeResolved=true', {
        headers: getApiHeaders(),
        signal,
      });
      if (!res.ok) {
        markSectionError('incidents', 'Không thể tải danh sách sự cố & cảnh báo.');
        return false;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setIncidentsList(data.data);
        markSectionLoaded('incidents');
        return true;
      }
      markSectionError('incidents', 'Dữ liệu sự cố chưa hợp lệ.');
      return false;
    } catch (err) {
      if (isAbortError(err)) return true;
      markSectionError('incidents', 'Không kết nối được máy chủ khi tải sự cố.');
      return false;
    }
  }, [createFetchSignal, markSectionLoaded, markSectionError]);

  const fetchAdminThreads = useCallback(async (): Promise<boolean> => {
    const signal = createFetchSignal('forum');
    try {
      const res = await fetch('/api/forum', {
        headers: getApiHeaders(),
        signal,
      });
      if (!res.ok) {
        markSectionError('forum', 'Không thể tải danh sách bài viết diễn đàn.');
        return false;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const sorted = [...(data.data as AdminForumThreadItem[])].sort(
          (a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)
        );
        setThreadsList(sorted);
        markSectionLoaded('forum');
        return true;
      }
      markSectionError('forum', 'Dữ liệu diễn đàn chưa hợp lệ.');
      return false;
    } catch (err) {
      if (isAbortError(err)) return true;
      markSectionError('forum', 'Không kết nối được máy chủ khi tải diễn đàn.');
      return false;
    }
  }, [createFetchSignal, markSectionLoaded, markSectionError]);

  const fetchAdminStats = useCallback(async (): Promise<boolean> => {
    const signal = createFetchSignal('stats');
    try {
      const res = await fetch('/api/admin/stats', {
        headers: getApiHeaders(),
        signal,
      });
      if (handleForbiddenStatus(res, 'Thống kê')) return false;
      if (!res.ok) {
        markSectionError('stats', 'Không thể tải thống kê hệ thống.');
        return false;
      }
      const data = await res.json();
      if (data.success) {
        setAdminStats(data.data);
        markSectionLoaded('stats');
        return true;
      }
      return false;
    } catch (err) {
      if (isAbortError(err)) return true;
      markSectionError('stats', 'Không kết nối được máy chủ khi tải thống kê.');
      return false;
    }
  }, [createFetchSignal, handleForbiddenStatus, markSectionLoaded, markSectionError]);

  const fetchAuditLogs = useCallback(async (): Promise<boolean> => {
    if (!isStrictAdmin) return false;
    const signal = createFetchSignal('audit');
    try {
      const res = await fetch('/api/admin/audit-logs?limit=60', {
        headers: getApiHeaders(),
        signal,
      });
      if (handleForbiddenStatus(res, 'Nhật ký thao tác')) return false;
      if (!res.ok) {
        markSectionError('audit', 'Không thể tải nhật ký thao tác.');
        return false;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAuditLogs(data.data);
        markSectionLoaded('audit');
        return true;
      }
      markSectionError('audit', 'Dữ liệu nhật ký chưa hợp lệ.');
      return false;
    } catch (err) {
      if (isAbortError(err)) return true;
      markSectionError('audit', 'Không kết nối được máy chủ khi tải nhật ký.');
      return false;
    }
  }, [isStrictAdmin, createFetchSignal, handleForbiddenStatus, markSectionLoaded, markSectionError]);

  const fetchAdminInquiries = useCallback(async (): Promise<boolean> => {
    const signal = createFetchSignal('inquiries');
    try {
      const res = await fetch('/api/directory/inquiries?limit=100', {
        headers: getApiHeaders(),
        signal,
      });
      if (handleForbiddenStatus(res, 'Yêu cầu Porter & HDV')) return false;
      if (!res.ok) {
        markSectionError('inquiries', 'Không thể tải yêu cầu Porter & HDV.');
        return false;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setInquiriesList(data.data);
        markSectionLoaded('inquiries');
        return true;
      }
      markSectionError('inquiries', 'Dữ liệu yêu cầu chưa hợp lệ.');
      return false;
    } catch (err) {
      if (isAbortError(err)) return true;
      markSectionError('inquiries', 'Không kết nối được máy chủ khi tải yêu cầu Porter & HDV.');
      return false;
    }
  }, [createFetchSignal, handleForbiddenStatus, markSectionLoaded, markSectionError]);

  const fetchAdminSafetyTimers = useCallback(
    async (mode: 'live' | 'checked_in_safe' | 'cancelled' = 'live'): Promise<boolean> => {
      const signal = createFetchSignal(`safety-timers-${mode}`);
      try {
        const query = mode === 'live' ? '?limit=100' : `?status=${mode}&limit=60`;
        const res = await fetch(`/api/safety-timers/admin${query}`, {
          headers: getApiHeaders(),
          signal,
        });
        if (handleForbiddenStatus(res, 'Hẹn giờ báo bình an')) return false;
        if (!res.ok) {
          markSectionError('safety', 'Không thể tải danh sách hẹn giờ báo bình an.');
          return false;
        }
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          if (mode === 'live') {
            setLiveSafetyTimers(data.data);
          } else {
            setArchivedSafetyTimers((prev) => ({ ...prev, [mode]: data.data }));
          }
          markSectionLoaded('safety');
          return true;
        }
        return false;
      } catch (err) {
        if (isAbortError(err)) return true;
        markSectionError('safety', 'Không kết nối được máy chủ khi tải hẹn giờ an toàn.');
        return false;
      }
    },
    [createFetchSignal, handleForbiddenStatus, markSectionLoaded, markSectionError]
  );

  const fetchAdminLiveBeacons = useCallback(async (): Promise<boolean> => {
    const signal = createFetchSignal('live-beacons');
    try {
      const res = await fetch('/api/admin/live-beacons?limit=100', {
        headers: getApiHeaders(),
        signal,
      });
      if (handleForbiddenStatus(res, 'Điểm phát tín hiệu trực tiếp')) return false;
      if (!res.ok) {
        markSectionError('safety', 'Không thể tải tín hiệu định vị trực tiếp.');
        return false;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setLiveBeaconsList(data.data);
        markSectionLoaded('safety');
        return true;
      }
      return false;
    } catch (err) {
      if (isAbortError(err)) return true;
      markSectionError('safety', 'Không kết nối được máy chủ khi tải tín hiệu định vị.');
      return false;
    }
  }, [createFetchSignal, handleForbiddenStatus, markSectionLoaded, markSectionError]);

  const fetchAdminPois = useCallback(async (): Promise<boolean> => {
    const signal = createFetchSignal('pois');
    try {
      const res = await fetch('/api/admin/pois?limit=100', {
        headers: getApiHeaders(),
        signal,
      });
      if (handleForbiddenStatus(res, 'Điểm mốc trên tuyến')) return false;
      if (!res.ok) {
        markSectionError('field', 'Không thể tải điểm mốc thực địa.');
        return false;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPoisList(data.data);
        setPoisTotal(Number(data.total) || data.data.length);
        markSectionLoaded('field');
        return true;
      }
      return false;
    } catch (err) {
      if (isAbortError(err)) return true;
      markSectionError('field', 'Không kết nối được máy chủ khi tải điểm mốc.');
      return false;
    }
  }, [createFetchSignal, handleForbiddenStatus, markSectionLoaded, markSectionError]);

  const fetchAdminReviews = useCallback(async (): Promise<boolean> => {
    const signal = createFetchSignal('reviews');
    try {
      const res = await fetch('/api/admin/reviews?limit=100', {
        headers: getApiHeaders(),
        signal,
      });
      if (handleForbiddenStatus(res, 'Đánh giá cung đường')) return false;
      if (!res.ok) {
        markSectionError('field', 'Không thể tải đánh giá cung đường.');
        return false;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setReviewsList(data.data);
        setReviewsTotal(Number(data.total) || data.data.length);
        markSectionLoaded('field');
        return true;
      }
      return false;
    } catch (err) {
      if (isAbortError(err)) return true;
      markSectionError('field', 'Không kết nối được máy chủ khi tải đánh giá.');
      return false;
    }
  }, [createFetchSignal, handleForbiddenStatus, markSectionLoaded, markSectionError]);

  const inFlightSectionsRef = useRef<Set<AdminSectionId>>(new Set());
  const loadedArchiveViewsRef = useRef<Set<'checked_in_safe' | 'cancelled'>>(new Set());

  const fetchSafetyMonitoring = useCallback(async (): Promise<boolean> => {
    const tasks: Promise<boolean>[] = [
      fetchAdminSafetyTimers('live'),
      fetchAdminLiveBeacons(),
    ];
    if (safetyTimerView !== 'live') {
      tasks.push(fetchAdminSafetyTimers(safetyTimerView));
    }
    const results = await Promise.all(tasks);
    return results.every(Boolean);
  }, [fetchAdminSafetyTimers, fetchAdminLiveBeacons, safetyTimerView]);

  const loadSectionById = useCallback(
    async (sec: AdminSectionId): Promise<boolean> => {
      switch (sec) {
        case 'contributions':
          return fetchFromMongo();
        case 'users':
          return isStrictAdmin ? fetchAdminUsers() : false;
        case 'trails':
          return fetchAdminTrails();
        case 'incidents':
          return fetchAdminIncidents();
        case 'inquiries':
          return fetchAdminInquiries();
        case 'safety':
          return fetchSafetyMonitoring();
        case 'field': {
          const [pOk, rOk] = await Promise.all([fetchAdminPois(), fetchAdminReviews()]);
          return pOk && rOk;
        }
        case 'forum':
          return fetchAdminThreads();
        case 'stats':
          return fetchAdminStats();
        case 'audit':
          return isStrictAdmin ? fetchAuditLogs() : false;
        case 'overview': {
          const results = await Promise.all([
            fetchFromMongo(),
            fetchAdminTrails(),
            fetchAdminIncidents(),
            fetchSafetyMonitoring(),
            fetchAdminInquiries(),
          ]);
          return results.every(Boolean);
        }
      }
    },
    [
      isStrictAdmin,
      fetchFromMongo,
      fetchAdminUsers,
      fetchAdminTrails,
      fetchAdminIncidents,
      fetchAdminInquiries,
      fetchSafetyMonitoring,
      fetchAdminPois,
      fetchAdminReviews,
      fetchAdminThreads,
      fetchAdminStats,
      fetchAuditLogs,
    ]
  );

  const retrySection = useCallback(
    (sec: AdminSectionId) => {
      setSectionErrors((prev) => {
        if (!prev[sec]) return prev;
        const next = { ...prev };
        delete next[sec];
        return next;
      });
      void loadSectionById(sec);
    },
    [loadSectionById]
  );

  const refreshAllData = async () => {
    setIsRefreshing(true);
    setAccessNotice('');
    setSectionErrors({});
    const sectionsToSync = new Set<AdminSectionId>(loadedSections);
    sectionsToSync.add(effectiveSection);
    if (effectiveSection === 'overview') {
      sectionsToSync.add('contributions');
      sectionsToSync.add('trails');
      sectionsToSync.add('incidents');
      sectionsToSync.add('safety');
      sectionsToSync.add('inquiries');
    }
    const tasks: Promise<unknown>[] = [fetchHealthStatus(), fetchAdminStats()];
    if (sectionsToSync.has('contributions')) tasks.push(fetchFromMongo());
    if (sectionsToSync.has('trails')) tasks.push(fetchAdminTrails());
    if (sectionsToSync.has('incidents')) tasks.push(fetchAdminIncidents());
    if (sectionsToSync.has('forum')) tasks.push(fetchAdminThreads());
    if (sectionsToSync.has('inquiries')) tasks.push(fetchAdminInquiries());
    if (sectionsToSync.has('safety')) {
      tasks.push(fetchSafetyMonitoring());
    }
    if (sectionsToSync.has('field')) {
      tasks.push(fetchAdminPois(), fetchAdminReviews());
    }
    if (isStrictAdmin) {
      if (sectionsToSync.has('users')) tasks.push(fetchAdminUsers());
      if (sectionsToSync.has('audit')) tasks.push(fetchAuditLogs());
    }
    await Promise.allSettled(tasks);
    if (!isMountedRef.current) return;
    if (refreshTimerRef.current !== null) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      if (!isMountedRef.current) return;
      setIsRefreshing(false);
      onShowToast?.('Đã cập nhật dữ liệu mới nhất.', 'success');
    }, 350);
  };

  // On mount: fetch lightweight health + summary stats
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      void fetchHealthStatus();
      void fetchAdminStats();
    });
    return () => {
      active = false;
    };
  }, [fetchHealthStatus, fetchAdminStats]);

  // Lazy-load sections on demand; failed sections are NOT permanently locked and can retry cleanly
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const inFlight = inFlightSectionsRef.current;
      const loaded = loadedSectionsRef.current;

      const ensureSection = (sec: AdminSectionId, loader: () => Promise<boolean>) => {
        if (loaded.has(sec) || inFlight.has(sec)) return;
        inFlight.add(sec);
        void loader().finally(() => {
          inFlight.delete(sec);
        });
      };

      if (effectiveSection === 'overview') {
        ensureSection('contributions', fetchFromMongo);
        ensureSection('trails', fetchAdminTrails);
        ensureSection('incidents', fetchAdminIncidents);
        ensureSection('safety', fetchSafetyMonitoring);
        ensureSection('inquiries', fetchAdminInquiries);
        return;
      }

      if (effectiveSection === 'contributions') {
        ensureSection('contributions', fetchFromMongo);
        ensureSection('trails', fetchAdminTrails);
      }
      if (effectiveSection === 'users' && isStrictAdmin) ensureSection('users', fetchAdminUsers);
      if (effectiveSection === 'trails') ensureSection('trails', fetchAdminTrails);
      if (effectiveSection === 'incidents') ensureSection('incidents', fetchAdminIncidents);
      if (effectiveSection === 'inquiries') ensureSection('inquiries', fetchAdminInquiries);
      if (effectiveSection === 'safety') {
        ensureSection('safety', fetchSafetyMonitoring);
        if (
          safetyTimerView !== 'live' &&
          !loadedArchiveViewsRef.current.has(safetyTimerView)
        ) {
          loadedArchiveViewsRef.current.add(safetyTimerView);
          void fetchAdminSafetyTimers(safetyTimerView).then((ok) => {
            if (!ok) loadedArchiveViewsRef.current.delete(safetyTimerView);
          });
        }
      }
      if (effectiveSection === 'field') {
        ensureSection('field', async () => {
          const [pOk, rOk] = await Promise.all([fetchAdminPois(), fetchAdminReviews()]);
          return pOk && rOk;
        });
      }
      if (effectiveSection === 'forum') ensureSection('forum', fetchAdminThreads);
      if (effectiveSection === 'stats') ensureSection('stats', fetchAdminStats);
      if (effectiveSection === 'audit' && isStrictAdmin) ensureSection('audit', fetchAuditLogs);
    });
    return () => {
      active = false;
    };
  }, [
    effectiveSection,
    isStrictAdmin,
    safetyTimerView,
    fetchFromMongo,
    fetchAdminUsers,
    fetchAdminTrails,
    fetchAdminIncidents,
    fetchAdminInquiries,
    fetchAdminSafetyTimers,
    fetchSafetyMonitoring,
    fetchAdminPois,
    fetchAdminReviews,
    fetchAdminThreads,
    fetchAdminStats,
    fetchAuditLogs,
  ]);

  // Subscribe to live Socket.IO safety/SOS/incident push events to refresh cockpit immediately
  useEffect(() => {
    if (!socket) return;

    const handleLiveSafetyPush = (payload?: { trailName?: string; message?: string; status?: string }) => {
      void fetchAdminSafetyTimers('live');
      void fetchAdminLiveBeacons();
      void fetchAdminStats();
      const isResolvedEvent =
        payload?.status === 'safe' ||
        payload?.status === 'ended' ||
        payload?.status === 'checked_in_safe' ||
        payload?.status === 'active';
      if (!isResolvedEvent && (payload?.message || payload?.trailName)) {
        onShowToast?.(
          payload.message || `Cảnh báo an toàn mới tại ${payload.trailName}.`,
          'error'
        );
      }
    };

    const handleLiveIncidentPush = () => {
      void fetchAdminIncidents();
      void fetchAdminStats();
    };

    const handleAdminNotification = (payload?: { category?: string; type?: string }) => {
      if (
        payload?.category === 'safety' ||
        payload?.type === 'sos' ||
        payload?.type === 'safety_overdue'
      ) {
        void fetchAdminSafetyTimers('live');
        void fetchAdminLiveBeacons();
        void fetchAdminStats();
      } else if (payload?.category === 'moderation') {
        void fetchFromMongo();
        void fetchAdminStats();
      }
    };

    socket.on('safetyTimerOverdue', handleLiveSafetyPush);
    socket.on('safetyTimerUpdated', handleLiveSafetyPush);
    socket.on('sosAlert', handleLiveSafetyPush);
    socket.on('liveBeaconSos', handleLiveSafetyPush);
    socket.on('liveBeaconUpdated', handleLiveSafetyPush);
    socket.on('newIncident', handleLiveIncidentPush);
    socket.on('incidentUpdated', handleLiveIncidentPush);
    socket.on('newNotification', handleAdminNotification);

    return () => {
      socket.off('safetyTimerOverdue', handleLiveSafetyPush);
      socket.off('safetyTimerUpdated', handleLiveSafetyPush);
      socket.off('sosAlert', handleLiveSafetyPush);
      socket.off('liveBeaconSos', handleLiveSafetyPush);
      socket.off('liveBeaconUpdated', handleLiveSafetyPush);
      socket.off('newIncident', handleLiveIncidentPush);
      socket.off('incidentUpdated', handleLiveIncidentPush);
      socket.off('newNotification', handleAdminNotification);
    };
  }, [
    socket,
    fetchAdminSafetyTimers,
    fetchAdminLiveBeacons,
    fetchAdminIncidents,
    fetchFromMongo,
    fetchAdminStats,
    onShowToast,
  ]);

  // Lazily enrich contribution author card with user metadata only when an admin opens a contribution modal
  useEffect(() => {
    if (!selectedContribution || !isStrictAdmin || loadedSections.has('users')) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      void fetchAdminUsers();
    });
    return () => {
      active = false;
    };
  }, [selectedContribution, isStrictAdmin, loadedSections, fetchAdminUsers]);

  const handleCreateTrailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStrictAdmin) return;

    const sLat = Number(createTrailForm.startLat);
    const sLng = Number(createTrailForm.startLng);
    if (
      !createTrailForm.startLat.trim() ||
      !createTrailForm.startLng.trim() ||
      !Number.isFinite(sLat) ||
      !Number.isFinite(sLng) ||
      sLat < -90 ||
      sLat > 90 ||
      sLng < -180 ||
      sLng > 180
    ) {
      onShowToast?.('Nhập tọa độ xuất phát hợp lệ (vĩ độ và kinh độ).', 'error');
      return;
    }

    const hasEndLat = createTrailForm.endLat.trim() !== '';
    const hasEndLng = createTrailForm.endLng.trim() !== '';
    const eLat = hasEndLat ? Number(createTrailForm.endLat) : sLat;
    const eLng = hasEndLng ? Number(createTrailForm.endLng) : sLng;
    if (!Number.isFinite(eLat) || !Number.isFinite(eLng) || eLat < -90 || eLat > 90 || eLng < -180 || eLng > 180) {
      onShowToast?.('Tọa độ điểm đích chưa hợp lệ.', 'error');
      return;
    }

    setIsCreatingTrail(true);
    try {
      const payload: Record<string, unknown> = {
        name: createTrailForm.name.trim(),
        altNames: parseCommaStrings(createTrailForm.altNames),
        province: createTrailForm.province.trim(),
        district: createTrailForm.district.trim() || createTrailForm.province.trim(),
        region: normalizeRegion(createTrailForm.region),
        distanceKm: Math.max(0.1, Number(createTrailForm.distanceKm) || 10),
        elevationGainM: Math.max(0, Number(createTrailForm.elevationGainM) || 0),
        maxAltitudeM: Math.max(0, Number(createTrailForm.maxAltitudeM) || 0),
        durationDays: Math.max(1, Math.round(Number(createTrailForm.durationDays) || 1)),
        durationHoursNote:
          createTrailForm.durationHoursNote.trim() ||
          `${Math.max(1, Math.round(Number(createTrailForm.durationDays) || 1))} ngày`,
        difficultyLevel: Math.min(5, Math.max(1, Number(createTrailForm.difficultyLevel) || 3)),
        difficultyNote: createTrailForm.difficultyNote.trim(),
        startLat: sLat,
        startLng: sLng,
        endLat: eLat,
        endLng: eLng,
        description: createTrailForm.description.trim(),
        transportationInfo: createTrailForm.transportationInfo.trim(),
        bestMonths: parseMonthList(createTrailForm.bestMonths),
        avoidMonths: parseMonthList(createTrailForm.avoidMonths),
        permitRequired: createTrailForm.permitRequired,
        permitInfo: createTrailForm.permitInfo.trim(),
        hasCampsite: createTrailForm.hasCampsite,
        hasWaterSource: createTrailForm.hasWaterSource,
        kidFriendly: createTrailForm.kidFriendly,
        rescueContact: {
          name:
            createTrailForm.rescueContactName.trim() ||
            `Cứu nạn khẩn cấp ${createTrailForm.province.trim()}`,
          phone: createTrailForm.rescueContactPhone.trim() || '112 / 114',
          rangerContact: createTrailForm.rescueContactRanger.trim(),
        },
      };
      if (createTrailForm.coverImage.trim()) {
        payload.coverImage = createTrailForm.coverImage.trim();
      }

      const res = await fetch('/api/admin/trails', {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể tạo cung đường mới.');
      }

      onShowToast?.(
        `Đã thêm cung đường "${createTrailForm.name.trim()}" lên bản đồ LOST.`,
        'success'
      );
      setCreateTrailForm(createEmptyTrailForm());
      setIsCreateTrailOpen(false);
      void fetchAdminTrails();
      void fetchAdminStats();
      if (isStrictAdmin) void fetchAuditLogs();
    } catch (err: unknown) {
      onShowToast?.(
        err instanceof Error ? err.message : 'Không kết nối được máy chủ khi tạo cung đường.',
        'error'
      );
    } finally {
      setIsCreatingTrail(false);
    }
  };

  const handleSaveTrailEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrailModal || !isStrictAdmin) return;
    const targetId = editingTrailModal._id || editingTrailModal.id;
    if (!targetId) return;

    const payload: Record<string, unknown> = {
      name: editTrailForm.name.trim(),
      altNames: parseCommaStrings(editTrailForm.altNames),
      province: editTrailForm.province.trim(),
      district: editTrailForm.district.trim(),
      region: normalizeRegion(editTrailForm.region),
      distanceKm: Math.max(0.1, Number(editTrailForm.distanceKm) || 0.1),
      elevationGainM: Math.max(0, Number(editTrailForm.elevationGainM) || 0),
      maxAltitudeM: Math.max(0, Number(editTrailForm.maxAltitudeM) || 0),
      durationDays: Math.max(1, Math.round(Number(editTrailForm.durationDays) || 1)),
      durationHoursNote: editTrailForm.durationHoursNote.trim(),
      difficultyLevel: Math.min(5, Math.max(1, Number(editTrailForm.difficultyLevel) || 3)),
      difficultyNote: editTrailForm.difficultyNote.trim(),
      bestMonths: parseMonthList(editTrailForm.bestMonths),
      avoidMonths: parseMonthList(editTrailForm.avoidMonths),
      description: editTrailForm.description.trim(),
      transportationInfo: editTrailForm.transportationInfo.trim(),
      permitRequired: editTrailForm.permitRequired,
      permitInfo: editTrailForm.permitInfo.trim(),
      hasCampsite: editTrailForm.hasCampsite,
      hasWaterSource: editTrailForm.hasWaterSource,
      kidFriendly: editTrailForm.kidFriendly,
      status: editTrailForm.status,
      rescueContact: {
        name: editTrailForm.rescueContactName.trim(),
        phone: editTrailForm.rescueContactPhone.trim(),
        rangerContact: editTrailForm.rescueContactRanger.trim(),
      },
    };

    if (editTrailForm.coverImage.trim()) {
      payload.coverImage = editTrailForm.coverImage.trim();
    }
    if (editTrailForm.startLat.trim() !== '' && editTrailForm.startLng.trim() !== '') {
      const sLat = Number(editTrailForm.startLat);
      const sLng = Number(editTrailForm.startLng);
      if (!Number.isFinite(sLat) || !Number.isFinite(sLng) || sLat < -90 || sLat > 90 || sLng < -180 || sLng > 180) {
        onShowToast?.('Tọa độ xuất phát chưa hợp lệ.', 'error');
        return;
      }
      payload.startLat = sLat;
      payload.startLng = sLng;
    }
    if (editTrailForm.endLat.trim() !== '' && editTrailForm.endLng.trim() !== '') {
      const eLat = Number(editTrailForm.endLat);
      const eLng = Number(editTrailForm.endLng);
      if (!Number.isFinite(eLat) || !Number.isFinite(eLng) || eLat < -90 || eLat > 90 || eLng < -180 || eLng > 180) {
        onShowToast?.('Tọa độ điểm đích chưa hợp lệ.', 'error');
        return;
      }
      payload.endLat = eLat;
      payload.endLng = eLng;
    }

    const targetTrailSnapshot = editingTrailModal;
    const prevStatus = targetTrailSnapshot.status || 'approved';
    const nextStatus = editTrailForm.status;
    const isHidingFromPublicCatalog = prevStatus === 'approved' && nextStatus !== 'approved';

    const executeTrailSave = async () => {
      setIsSavingTrail(true);
      try {
        const res = await fetch(`/api/admin/trails/${targetId}`, {
          method: 'PUT',
          headers: getApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Không thể cập nhật thông tin cung đường.');
        }

        const updatedSnapshot: AdminTrailItem = {
          ...targetTrailSnapshot,
          ...(data.data && typeof data.data === 'object' ? data.data : {}),
          name: editTrailForm.name.trim(),
          province: editTrailForm.province.trim(),
          district: editTrailForm.district.trim(),
          region: normalizeRegion(editTrailForm.region),
          distanceKm: Number(payload.distanceKm),
          elevationGainM: Number(payload.elevationGainM),
          maxAltitudeM: Number(payload.maxAltitudeM),
          status: nextStatus,
        };

        if (nextStatus !== 'approved') {
          setRecentlyHiddenTrails((prev) => {
            const filtered = prev.filter(
              (item) => String(item._id || item.id || '') !== String(targetId)
            );
            return [updatedSnapshot, ...filtered];
          });
          setInspectorSelection((prev) =>
            prev?.kind === 'trail' && prev.data.id === String(targetId) ? null : prev
          );
          onShowToast?.(
            `Đã ẩn cung đường "${editTrailForm.name.trim()}" khỏi danh mục công khai. Có thể công khai lại trong danh sách "Vừa ẩn" bên trên.`,
            'info'
          );
        } else {
          setRecentlyHiddenTrails((prev) =>
            prev.filter((item) => String(item._id || item.id || '') !== String(targetId))
          );
          onShowToast?.(`Đã lưu thay đổi cho cung đường "${editTrailForm.name.trim()}".`, 'success');
        }

        setEditingTrailModal(null);
        void fetchAdminTrails();
        void fetchAdminStats();
        if (isStrictAdmin) void fetchAuditLogs();
      } catch (err: unknown) {
        onShowToast?.(
          err instanceof Error ? err.message : 'Không kết nối được máy chủ khi lưu cung đường.',
          'error'
        );
      } finally {
        setIsSavingTrail(false);
      }
    };

    if (isHidingFromPublicCatalog) {
      const targetStatusLabel = nextStatus === 'rejected' ? 'Từ chối' : 'Chờ duyệt (ẩn)';
      openConfirmDialog({
        title: 'Ẩn cung đường khỏi danh mục công khai?',
        message: `Chuyển "${editTrailForm.name.trim()}" sang "${targetStatusLabel}" sẽ gỡ cung đường này khỏi bản đồ công khai và danh sách cung công khai. Hệ thống sẽ giữ lối tắt trong mục "Vừa ẩn khỏi danh mục công khai" của phiên làm việc này để bạn có thể khôi phục khi cần.`,
        confirmLabel: 'Xác nhận ẩn cung đường',
        danger: true,
        onConfirm: executeTrailSave,
      });
      return;
    }

    await executeTrailSave();
  };

  const handleUpdateRole = (
    userId: string,
    newRole: string,
    userName: string,
    currentRole = 'user'
  ) => {
    if (!isStrictAdmin) return;
    if (!userId || newRole === currentRole) return;
    if (currentUserId && userId === currentUserId && newRole !== 'admin') {
      onShowToast?.('Không thể tự hạ quyền Quản trị viên của chính bạn.', 'error');
      return;
    }

    const lockKey = `role:${userId}`;
    const nextRoleLabel = getRoleLabelVi(newRole);
    const prevRoleLabel = getRoleLabelVi(currentRole);

    openConfirmDialog({
      title: 'Xác nhận thay đổi vai trò',
      message: `Chuyển vai trò của "${userName}" từ "${prevRoleLabel}" sang "${nextRoleLabel}"? Phiên đăng nhập của tài khoản này sẽ tự động làm mới theo quyền mới.`,
      confirmLabel: 'Xác nhận đổi quyền',
      danger: newRole === 'admin',
      reasonInputLabel: 'Lý do thay đổi phân quyền',
      reasonPlaceholder: 'VD: Phân công phụ trách kiểm duyệt khu vực miền Bắc...',
      defaultReason: `Điều chỉnh phân quyền sang ${nextRoleLabel}`,
      onConfirm: async (reasonInput?: string) => {
        if (!isStrictAdmin) return;
        if (!acquireActionLock(lockKey)) return;
        try {
          const finalReason = (reasonInput || '').trim();
          const res = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: getApiHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ role: newRole, reason: finalReason || undefined }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            onShowToast?.(`Đã chuyển vai trò của ${userName} sang "${nextRoleLabel}".`, 'success');
            setUsersList((prev) =>
              prev.map((u) =>
                String(u._id || u.id || '') === userId ? { ...u, role: newRole } : u
              )
            );
            void fetchAdminUsers();
            void fetchAdminStats();
            if (isStrictAdmin) void fetchAuditLogs();
          } else {
            onShowToast?.(data.message || 'Không thể cập nhật vai trò.', 'error');
          }
        } catch {
          onShowToast?.('Không kết nối được máy chủ.', 'error');
        } finally {
          releaseActionLock(lockKey);
        }
      },
    });
  };

  const handlePinThread = async (threadId: string) => {
    const lockKey = `pin:${threadId}`;
    if (!acquireActionLock(lockKey)) return;
    try {
      const res = await fetch(`/api/admin/threads/${threadId}/pin`, {
        method: 'PUT',
        headers: getApiHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast?.(data.message || 'Đã cập nhật trạng thái ghim bài.', 'success');
        setThreadsList((prev) =>
          prev
            .map((t) => {
              if (t.id === threadId || t._id === threadId) {
                const newPinned =
                  data.data?.isPinned !== undefined ? Boolean(data.data.isPinned) : !t.isPinned;
                return { ...t, isPinned: newPinned };
              }
              return t;
            })
            .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0))
        );
        void fetchAdminThreads();
      } else {
        onShowToast?.(data.message || 'Không thể ghim bài viết.', 'error');
      }
    } catch {
      onShowToast?.('Lỗi kết nối máy chủ khi ghim bài viết.', 'error');
    } finally {
      releaseActionLock(lockKey);
    }
  };

  const handleLockThread = async (threadId: string) => {
    const lockKey = `lock:${threadId}`;
    if (!acquireActionLock(lockKey)) return;
    try {
      const res = await fetch(`/api/admin/threads/${threadId}/lock`, {
        method: 'PUT',
        headers: getApiHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast?.(data.message || 'Đã cập nhật trạng thái khóa bình luận.', 'info');
        setThreadsList((prev) =>
          prev.map((t) => {
            if (t.id === threadId || t._id === threadId) {
              const newLocked =
                data.data?.isLocked !== undefined ? Boolean(data.data.isLocked) : !t.isLocked;
              return { ...t, isLocked: newLocked };
            }
            return t;
          })
        );
        void fetchAdminThreads();
      } else {
        onShowToast?.(data.message || 'Không thể khóa bài viết.', 'error');
      }
    } catch {
      onShowToast?.('Lỗi kết nối máy chủ khi khóa bài viết.', 'error');
    } finally {
      releaseActionLock(lockKey);
    }
  };

  const handleDeleteThread = (threadId: string, title: string) => {
    openConfirmDialog({
      title: 'Xóa bài viết diễn đàn',
      message: `Xóa vĩnh viễn bài viết "${title}" khỏi diễn đàn LOST? Thao tác này không thể hoàn tác.`,
      confirmLabel: 'Xóa bài viết',
      danger: true,
      onConfirm: async () => {
        const res = await fetch(`/api/admin/threads/${threadId}`, {
          method: 'DELETE',
          headers: getApiHeaders(),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          onShowToast?.(data.message || 'Đã xóa bài viết.', 'info');
          setThreadsList((prev) => prev.filter((t) => t.id !== threadId && t._id !== threadId));
          void fetchAdminThreads();
          void fetchAdminStats();
          if (isStrictAdmin) void fetchAuditLogs();
        } else {
          onShowToast?.(data.message || 'Không thể xóa bài viết.', 'error');
        }
      },
    });
  };

  const handleResolveDispute = (
    incidentId: string,
    action: 'dismiss_incident' | 'reject_dispute'
  ) => {
    const isDismiss = action === 'dismiss_incident';
    const lockKey = `dispute:${incidentId}`;
    openConfirmDialog({
      title: isDismiss ? 'Gỡ cảnh báo theo phản hồi' : 'Giữ cảnh báo và bác bỏ phản hồi',
      message: isDismiss
        ? 'Xác nhận gỡ cảnh báo sự cố này vì phản hồi từ cộng đồng cho thấy tuyến đường đã ổn?'
        : 'Xác nhận giữ nguyên cảnh báo sự cố này và xóa các phản hồi trái chiều hiện có?',
      confirmLabel: isDismiss ? 'Gỡ cảnh báo' : 'Giữ cảnh báo',
      danger: !isDismiss,
      onConfirm: async () => {
        if (!acquireActionLock(lockKey)) return;
        try {
          const res = await fetch(`/api/admin/incidents/${incidentId}/dispute-resolve`, {
            method: 'PUT',
            headers: getApiHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ action }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            onShowToast?.(data.message || 'Đã xử lý khiếu nại.', 'success');
            void fetchAdminIncidents();
            void fetchAdminStats();
            if (isStrictAdmin) void fetchAuditLogs();
          } else {
            onShowToast?.(data.message || 'Không thể xử lý khiếu nại.', 'error');
          }
        } catch {
          onShowToast?.('Lỗi kết nối máy chủ khi xử lý khiếu nại.', 'error');
        } finally {
          releaseActionLock(lockKey);
        }
      },
    });
  };

  const handleUpdateInquiryStatus = async (
    inquiryId: string,
    nextStatus: 'contacted' | 'confirmed' | 'cancelled'
  ) => {
    setUpdatingInquiryId(inquiryId);
    try {
      const res = await fetch(`/api/directory/inquiries/${inquiryId}/status`, {
        method: 'PATCH',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const label = INQUIRY_STATUS_META[nextStatus].label;
        onShowToast?.(`Đã chuyển yêu cầu Porter & HDV sang "${label}".`, 'success');
        setInquiriesList((prev) =>
          prev.map((item) => (item._id === inquiryId ? { ...item, status: nextStatus } : item))
        );
      } else {
        onShowToast?.(data.message || 'Không thể cập nhật trạng thái đơn đặt.', 'error');
      }
    } catch {
      onShowToast?.('Lỗi kết nối máy chủ khi cập nhật đơn đặt.', 'error');
    } finally {
      setUpdatingInquiryId(null);
    }
  };

  const handleTogglePoiStatus = async (poi: AdminTrailPoiItem) => {
    const nextStatus: 'active' | 'dry_or_closed' =
      poi.status === 'active' ? 'dry_or_closed' : 'active';
    setTogglingPoiId(poi._id);
    try {
      const res = await fetch(`/api/trail-pois/${poi._id}/status`, {
        method: 'PATCH',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast?.(
          data.message ||
            (nextStatus === 'active'
              ? 'Đã mở lại trạng thái hoạt động cho điểm mốc.'
              : 'Đã đánh dấu điểm mốc là cạn hoặc đóng.'),
          'success'
        );
        setPoisList((prev) =>
          prev.map((p) => (p._id === poi._id ? { ...p, status: nextStatus } : p))
        );
      } else {
        onShowToast?.(data.message || 'Không thể cập nhật trạng thái điểm mốc.', 'error');
      }
    } catch {
      onShowToast?.('Lỗi kết nối máy chủ khi cập nhật điểm mốc.', 'error');
    } finally {
      setTogglingPoiId(null);
    }
  };

  const handleDeletePoi = (poi: AdminTrailPoiItem) => {
    openConfirmDialog({
      title: 'Xóa điểm mốc trên tuyến',
      message: `Xóa vĩnh viễn điểm mốc "${poi.title}" khỏi tuyến ${poi.trail?.name || poi.trailName || poi.trailId || ''}?`,
      confirmLabel: 'Xóa điểm mốc',
      danger: true,
      onConfirm: async () => {
        const res = await fetch(`/api/trail-pois/${poi._id}`, {
          method: 'DELETE',
          headers: getApiHeaders(),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          onShowToast?.(data.message || 'Đã xóa điểm mốc.', 'info');
          setPoisList((prev) => prev.filter((p) => p._id !== poi._id));
          setPoisTotal((prev) => Math.max(0, prev - 1));
        } else {
          onShowToast?.(data.message || 'Không thể xóa điểm mốc.', 'error');
        }
      },
    });
  };

  const handleDeleteReview = (review: AdminReviewItem) => {
    const reviewerLabel =
      (typeof review.userId === 'object' && review.userId?.fullName) ||
      review.userName ||
      'Thành viên';
    openConfirmDialog({
      title: 'Xóa đánh giá cung đường',
      message: `Xóa vĩnh viễn đánh giá của "${reviewerLabel}"? Điểm trung bình của cung đường sẽ tự cập nhật lại.`,
      confirmLabel: 'Xóa đánh giá',
      danger: true,
      onConfirm: async () => {
        const res = await fetch(`/api/reviews/${review._id}`, {
          method: 'DELETE',
          headers: getApiHeaders(),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          onShowToast?.(data.message || 'Đã xóa đánh giá.', 'info');
          setReviewsList((prev) => prev.filter((r) => r._id !== review._id));
          setReviewsTotal((prev) => Math.max(0, prev - 1));
          void fetchAdminTrails();
          void fetchAdminStats();
          if (isStrictAdmin) void fetchAuditLogs();
        } else {
          onShowToast?.(data.message || 'Không thể xóa đánh giá.', 'error');
        }
      },
    });
  };

  const { pendingContributions, approvedContributions, rejectedContributions } = useMemo(() => {
    const pending: AdminContributionItem[] = [];
    const approved: AdminContributionItem[] = [];
    const rejected: AdminContributionItem[] = [];
    for (const c of contributions) {
      if (c.status === 'approved') approved.push(c);
      else if (c.status === 'rejected') rejected.push(c);
      else pending.push(c);
    }
    return { pendingContributions: pending, approvedContributions: approved, rejectedContributions: rejected };
  }, [contributions]);

  const displayedContributions = useMemo(() => {
    const rawList =
      activeTab === 'pending'
        ? pendingContributions
        : activeTab === 'approved'
          ? approvedContributions
          : activeTab === 'rejected'
            ? rejectedContributions
            : contributions;
    const q = searchQuery.trim();
    if (!q) return rawList;
    return rawList.filter(
      (c) =>
        searchMatchVietnamese(c.name || '', q) ||
        searchMatchVietnamese(c.authorName || '', q) ||
        searchMatchVietnamese(c.authorEmail || '', q) ||
        searchMatchVietnamese(c.province || '', q)
    );
  }, [activeTab, pendingContributions, approvedContributions, rejectedContributions, contributions, searchQuery]);

  const handleApprove = useCallback(
    (id: string, name: string) => {
      const lockKey = `approve:${id}`;
      openConfirmDialog({
        title: 'Duyệt và công khai cung đường',
        message: `Phê duyệt đóng góp "${name}" và đưa lên bản đồ LOST công khai? Tác giả sẽ được cộng +50 điểm uy tín.`,
        confirmLabel: 'Duyệt & công khai',
        onConfirm: async () => {
          if (!acquireActionLock(lockKey)) return;
          try {
            const approvedAt = new Date().toLocaleDateString('vi-VN');
            const res = await fetch(`/api/contributions/${id}`, {
              method: 'PUT',
              headers: getApiHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({
                status: 'approved',
                approvedAt,
              }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
              throw new Error(data.message || 'Lỗi khi duyệt bài đóng góp');
            }

            setContributions((prev) =>
              prev.map((c) =>
                c.id === id || c._id === id ? { ...c, status: 'approved', approvedAt } : c
              )
            );
            onShowToast?.(
              `Đã duyệt và đưa cung đường "${name}" lên bản đồ LOST.`,
              'success'
            );
            setSelectedContribution((prev) =>
              prev && (prev.id === id || prev._id === id) ? null : prev
            );
            void fetchFromMongo();
            void fetchAdminTrails();
            void fetchAdminStats();
            if (isStrictAdmin) void fetchAuditLogs();
          } catch (e: unknown) {
            onShowToast?.(
              e instanceof Error ? e.message : 'Không thể duyệt bài đóng góp, vui lòng thử lại.',
              'error'
            );
          } finally {
            releaseActionLock(lockKey);
          }
        },
      });
    },
    [
      openConfirmDialog,
      acquireActionLock,
      releaseActionLock,
      onShowToast,
      fetchFromMongo,
      fetchAdminTrails,
      fetchAdminStats,
      isStrictAdmin,
      fetchAuditLogs,
    ]
  );

  const handleReject = useCallback(
    (id: string, name: string) => {
      const target = contributions.find((c) => c.id === id || c._id === id);
      if (target && target.status === 'approved') {
        onShowToast?.(
          'Không thể từ chối bài đóng góp đã công khai. Hãy chỉnh sửa hoặc xóa cung đường trong mục Cung đường.',
          'error'
        );
        return;
      }

      const lockKey = `reject:${id}`;
      openConfirmDialog({
        title: 'Từ chối bài đóng góp',
        message: `Từ chối đóng góp "${name}"? Tác giả sẽ nhận được thông báo để kiểm tra lại tọa độ và thông số tuyến.`,
        confirmLabel: 'Xác nhận từ chối',
        danger: true,
        reasonInputLabel: 'Ghi chú lý do từ chối (tùy chọn)',
        reasonPlaceholder: 'VD: Thiếu tọa độ điểm đích hoặc thông tin giấy phép chưa rõ...',
        onConfirm: async (reasonInput?: string) => {
          if (!acquireActionLock(lockKey)) return;
          try {
            const rejectedAt = new Date().toLocaleDateString('vi-VN');
            const reasonText = (reasonInput || '').trim();
            const res = await fetch(`/api/contributions/${id}`, {
              method: 'PUT',
              headers: getApiHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({
                status: 'rejected',
                rejectedAt,
                ...(reasonText ? { rejectionReason: reasonText } : {}),
              }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
              throw new Error(data.message || 'Lỗi khi từ chối bài đóng góp');
            }

            setContributions((prev) =>
              prev.map((c) =>
                c.id === id || c._id === id ? { ...c, status: 'rejected', rejectedAt } : c
              )
            );
            onShowToast?.(`Đã từ chối bài đóng góp "${name}".`, 'info');
            setSelectedContribution((prev) =>
              prev && (prev.id === id || prev._id === id) ? null : prev
            );
            void fetchFromMongo();
            void fetchAdminStats();
            if (isStrictAdmin) void fetchAuditLogs();
          } catch (e: unknown) {
            onShowToast?.(
              e instanceof Error ? e.message : 'Không thể từ chối bài đóng góp.',
              'error'
            );
          } finally {
            releaseActionLock(lockKey);
          }
        },
      });
    },
    [
      contributions,
      openConfirmDialog,
      acquireActionLock,
      releaseActionLock,
      onShowToast,
      fetchFromMongo,
      fetchAdminStats,
      isStrictAdmin,
      fetchAuditLogs,
    ]
  );

  const handleDeleteContribution = useCallback(
    (id: string, name: string, statusHint?: string) => {
      const target = contributions.find((c) => c.id === id || c._id === id);
      const effectiveStatus = (statusHint || target?.status || 'pending').toLowerCase();
      const isApprovedContrib = effectiveStatus === 'approved';

      if (isApprovedContrib && !isStrictAdmin) {
        onShowToast?.(
          'Chỉ Quản trị viên mới được xóa bài đóng góp đã công khai (vì thao tác sẽ gỡ luôn cung đường khỏi bản đồ).',
          'error'
        );
        return;
      }

      const lockKey = `delete-contrib:${id}`;
      openConfirmDialog({
        title: isApprovedContrib ? 'Xóa đóng góp đã công khai & cung đường' : 'Xóa bài đóng góp',
        message: isApprovedContrib
          ? `CẢNH BÁO: Bài đóng góp "${name}" đã được công khai. Xóa bài đóng góp này sẽ ĐỒNG THỜI gỡ bỏ cung đường "${name}" khỏi bản đồ LOST công khai! Thao tác này không thể hoàn tác.`
          : `Xóa vĩnh viễn bài đóng góp "${name}" khỏi hệ thống? Thao tác này không thể hoàn tác.`,
        confirmLabel: isApprovedContrib ? 'Xóa cả đóng góp & cung đường' : 'Xóa vĩnh viễn',
        danger: true,
        onConfirm: async () => {
          if (isApprovedContrib && !isStrictAdmin) return;
          if (!acquireActionLock(lockKey)) return;
          try {
            const res = await fetch(`/api/contributions/${id}`, {
              method: 'DELETE',
              headers: getApiHeaders(),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
              onShowToast?.(data.message || 'Không thể xóa bài đóng góp.', 'error');
              return;
            }
            setContributions((prev) => prev.filter((c) => c.id !== id && c._id !== id));
            onShowToast?.(
              isApprovedContrib
                ? `Đã xóa bài đóng góp và gỡ cung đường "${name}" khỏi bản đồ.`
                : `Đã xóa bài đóng góp "${name}".`,
              'info'
            );
            setSelectedContribution((prev) =>
              prev && (prev.id === id || prev._id === id) ? null : prev
            );
            setInspectorSelection((prev) =>
              prev?.kind === 'contribution' && prev.data.id === id ? null : prev
            );
            void fetchFromMongo();
            if (isApprovedContrib) void fetchAdminTrails();
            void fetchAdminStats();
            if (isStrictAdmin) void fetchAuditLogs();
          } finally {
            releaseActionLock(lockKey);
          }
        },
      });
    },
    [
      contributions,
      isStrictAdmin,
      openConfirmDialog,
      acquireActionLock,
      releaseActionLock,
      onShowToast,
      fetchFromMongo,
      fetchAdminTrails,
      fetchAdminStats,
      fetchAuditLogs,
    ]
  );

  const handleDeleteTrail = useCallback(
    (id: string, name: string) => {
      if (!isStrictAdmin) return;
      const lockKey = `delete-trail:${id}`;
      openConfirmDialog({
        title: 'Xóa cung đường khỏi bản đồ',
        message: `Xóa cung đường "${name}" khỏi bản đồ LOST? Thao tác này không thể hoàn tác.`,
        confirmLabel: 'Xóa cung đường',
        danger: true,
        onConfirm: async () => {
          if (!isStrictAdmin) return;
          if (!acquireActionLock(lockKey)) return;
          try {
            const res = await fetch(`/api/admin/trails/${id}`, {
              method: 'DELETE',
              headers: getApiHeaders(),
            });
            const data = await res.json();
            if (res.ok && data.success) {
              onShowToast?.(`Đã xóa cung đường "${name}".`, 'info');
              setInspectorSelection((prev) =>
                prev?.kind === 'trail' && prev.data.id === id ? null : prev
              );
              setRecentlyHiddenTrails((prev) =>
                prev.filter((item) => String(item._id || item.id || '') !== id)
              );
              void fetchAdminTrails();
              void fetchAdminStats();
              if (isStrictAdmin) void fetchAuditLogs();
            } else {
              onShowToast?.(data.message || 'Không thể xóa cung đường.', 'error');
            }
          } finally {
            releaseActionLock(lockKey);
          }
        },
      });
    },
    [
      isStrictAdmin,
      openConfirmDialog,
      acquireActionLock,
      releaseActionLock,
      onShowToast,
      fetchAdminTrails,
      fetchAdminStats,
      fetchAuditLogs,
    ]
  );

  const handleResolveIncident = useCallback(
    (id: string) => {
      const lockKey = `resolve:${id}`;
      openConfirmDialog({
        title: 'Gỡ cảnh báo sự cố',
        message: 'Xác nhận đã kiểm tra thực địa và gỡ cảnh báo sự cố này khỏi bản đồ LOST?',
        confirmLabel: 'Gỡ cảnh báo',
        onConfirm: async () => {
          if (!acquireActionLock(lockKey)) return;
          try {
            const res = await fetch(`/api/incidents/${id}/resolve`, {
              method: 'PUT',
              headers: getApiHeaders(),
            });
            const data = await res.json();
            if (res.ok && data.success) {
              onShowToast?.('Đã gỡ cảnh báo sự cố.', 'success');
              void fetchAdminIncidents();
              void fetchAdminStats();
              if (isStrictAdmin) void fetchAuditLogs();
            } else {
              onShowToast?.(data.message || 'Không thể gỡ cảnh báo sự cố.', 'error');
            }
          } catch {
            onShowToast?.('Lỗi kết nối máy chủ khi xử lý sự cố.', 'error');
          } finally {
            releaseActionLock(lockKey);
          }
        },
      });
    },
    [
      openConfirmDialog,
      acquireActionLock,
      releaseActionLock,
      onShowToast,
      fetchAdminIncidents,
      fetchAdminStats,
      isStrictAdmin,
      fetchAuditLogs,
    ]
  );

  const handleDeleteIncident = useCallback(
    (id: string) => {
      const lockKey = `delete-incident:${id}`;
      openConfirmDialog({
        title: 'Xóa báo cáo sự cố',
        message: 'Xóa vĩnh viễn báo cáo sự cố này? Thao tác này không thể hoàn tác.',
        confirmLabel: 'Xóa sự cố',
        danger: true,
        onConfirm: async () => {
          if (!acquireActionLock(lockKey)) return;
          try {
            const res = await fetch(`/api/incidents/${id}`, {
              method: 'DELETE',
              headers: getApiHeaders(),
            });
            const data = await res.json();
            if (res.ok && data.success) {
              onShowToast?.('Đã xóa báo cáo sự cố.', 'info');
              setInspectorSelection((prev) =>
                prev?.kind === 'incident' && prev.data.id === id ? null : prev
              );
              void fetchAdminIncidents();
              void fetchAdminStats();
              if (isStrictAdmin) void fetchAuditLogs();
            } else {
              onShowToast?.(data.message || 'Không thể xóa sự cố.', 'error');
            }
          } finally {
            releaseActionLock(lockKey);
          }
        },
      });
    },
    [
      openConfirmDialog,
      acquireActionLock,
      releaseActionLock,
      onShowToast,
      fetchAdminIncidents,
      fetchAdminStats,
      isStrictAdmin,
      fetchAuditLogs,
    ]
  );

  const handleBanUser = (rawUserId: EntityRef, label: string) => {
    if (!isStrictAdmin) return;
    const id = extractEntityId(rawUserId);
    if (!id) {
      onShowToast?.('Không xác định được mã tài khoản cần khóa.', 'error');
      return;
    }
    if (currentUserId && id === currentUserId) {
      onShowToast?.('Không thể tự khóa tài khoản của chính bạn.', 'error');
      return;
    }
    const lockKey = `ban:${id}`;
    openConfirmDialog({
      title: 'Khóa tài khoản thành viên',
      message: `Khóa tài khoản "${label}"? Tài khoản này sẽ bị đăng xuất ngay và không thể vào LOST.`,
      confirmLabel: 'Khóa tài khoản',
      danger: true,
      reasonInputLabel: 'Lý do khóa tài khoản (lưu trong hồ sơ & nhật ký thao tác)',
      reasonPlaceholder: 'VD: Báo tin giả nhiều lần, gửi nội dung vi phạm...',
      defaultReason: 'Vi phạm quy định cộng đồng LOST',
      onConfirm: async (reasonInput?: string) => {
        if (!isStrictAdmin) return;
        if (!acquireActionLock(lockKey)) return;
        try {
          const finalReason = (reasonInput || '').trim() || 'Vi phạm quy định cộng đồng LOST';
          const res = await fetch(`/api/admin/users/${id}/ban`, {
            method: 'PUT',
            headers: getApiHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ reason: finalReason, banReason: finalReason }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            onShowToast?.(`Đã khóa tài khoản ${label}`, 'info');
            setUsersList((prev) =>
              prev.map((u) =>
                u._id === id || u.id === id ? { ...u, isBanned: true, banReason: finalReason } : u
              )
            );
            void fetchAdminUsers();
            void fetchAdminStats();
            if (isStrictAdmin) void fetchAuditLogs();
          } else {
            onShowToast?.(data.message || 'Không thể khóa tài khoản.', 'error');
          }
        } finally {
          releaseActionLock(lockKey);
        }
      },
    });
  };

  const handleUnbanUser = (id: string, email: string) => {
    if (!isStrictAdmin) return;
    const lockKey = `unban:${id}`;
    openConfirmDialog({
      title: 'Mở khóa tài khoản thành viên',
      message: `Mở khóa cho tài khoản "${email}"? Thành viên này sẽ có thể đăng nhập và hoạt động lại trên LOST.`,
      confirmLabel: 'Mở khóa tài khoản',
      onConfirm: async () => {
        if (!isStrictAdmin) return;
        if (!acquireActionLock(lockKey)) return;
        try {
          const res = await fetch(`/api/admin/users/${id}/unban`, {
            method: 'PUT',
            headers: getApiHeaders(),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            onShowToast?.(`Đã mở khóa tài khoản ${email}`, 'success');
            setUsersList((prev) =>
              prev.map((u) =>
                u._id === id || u.id === id ? { ...u, isBanned: false, banReason: '' } : u
              )
            );
            void fetchAdminUsers();
            void fetchAdminStats();
            if (isStrictAdmin) void fetchAuditLogs();
          } else {
            onShowToast?.(data.message || 'Không thể mở khóa tài khoản.', 'error');
          }
        } catch {
          onShowToast?.('Lỗi kết nối máy chủ khi mở khóa tài khoản.', 'error');
        } finally {
          releaseActionLock(lockKey);
        }
      },
    });
  };

  const handleAdminMarkTimerSafe = useCallback(
    (timerId: string, userName: string, trailName: string) => {
      const lockKey = `timer-safe:${timerId}`;
      openConfirmDialog({
        title: 'Xác nhận trekker đã an toàn?',
        message: `Đánh dấu lịch hẹn báo bình an của "${userName}" trên cung "${trailName}" ở trạng thái đã về an toàn và tắt cảnh báo quá hạn?`,
        confirmLabel: 'Đánh dấu đã an toàn',
        danger: false,
        reasonInputLabel: 'Ghi chú xác minh của điều phối viên (tùy chọn)',
        reasonPlaceholder: 'VD: Đã gọi điện xác nhận trekker đã ra khỏi rừng an toàn...',
        defaultReason: '',
        onConfirm: async (reasonInput?: string) => {
          if (!acquireActionLock(lockKey)) return;
          try {
            const finalReason = (reasonInput || '').trim();
            const res = await fetch(
              `/api/safety-timers/admin/${encodeURIComponent(timerId)}/mark-safe`,
              {
                method: 'PATCH',
                headers: getApiHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ reason: finalReason || undefined }),
              }
            );
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
              onShowToast?.(
                data.message || 'Đã đánh dấu lịch hẹn báo bình an ở trạng thái an toàn.',
                'success'
              );
              setLiveSafetyTimers((prev) => prev.filter((t) => t._id !== timerId));
              setInspectorSelection((prev) =>
                prev?.kind === 'timer' && prev.data.id === timerId ? null : prev
              );
              void fetchAdminSafetyTimers('live');
              void fetchAdminSafetyTimers('checked_in_safe');
              void fetchAdminStats();
              if (isStrictAdmin) void fetchAuditLogs();
            } else {
              onShowToast?.(data.message || 'Không thể đánh dấu an toàn lịch hẹn.', 'error');
            }
          } catch {
            onShowToast?.('Lỗi kết nối máy chủ khi cập nhật lịch hẹn an toàn.', 'error');
          } finally {
            releaseActionLock(lockKey);
          }
        },
      });
    },
    [
      openConfirmDialog,
      acquireActionLock,
      releaseActionLock,
      onShowToast,
      fetchAdminSafetyTimers,
      fetchAdminStats,
      isStrictAdmin,
      fetchAuditLogs,
    ]
  );

  const handleAdminExtendTimer = useCallback(
    (timerId: string, userName: string, trailName: string) => {
      const lockKey = `timer-extend:${timerId}`;
      openConfirmDialog({
        title: 'Gia hạn hẹn giờ báo bình an thêm 2 giờ?',
        message: `Gia hạn thời điểm dự kiến ra khỏi rừng của "${userName}" trên cung "${trailName}" thêm 2 giờ (+120 phút)? Nếu lịch đang quá hạn, hệ thống sẽ chuyển lại trạng thái đang theo dõi.`,
        confirmLabel: 'Gia hạn +2 giờ',
        danger: false,
        reasonInputLabel: 'Ghi chú gia hạn (tùy chọn)',
        reasonPlaceholder: 'VD: Đoàn báo di chuyển chậm do mưa, dự kiến xuống muộn 2 tiếng...',
        defaultReason: '',
        onConfirm: async (reasonInput?: string) => {
          if (!acquireActionLock(lockKey)) return;
          try {
            const finalReason = (reasonInput || '').trim();
            const res = await fetch(
              `/api/safety-timers/admin/${encodeURIComponent(timerId)}/extend`,
              {
                method: 'PATCH',
                headers: getApiHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ extendMinutes: 120, reason: finalReason || undefined }),
              }
            );
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
              onShowToast?.(data.message || 'Đã gia hạn lịch hẹn báo bình an thêm 2 giờ.', 'success');
              setInspectorSelection((prev) =>
                prev?.kind === 'timer' && prev.data.id === timerId ? null : prev
              );
              void fetchAdminSafetyTimers('live');
              void fetchAdminStats();
              if (isStrictAdmin) void fetchAuditLogs();
            } else {
              onShowToast?.(data.message || 'Không thể gia hạn lịch hẹn.', 'error');
            }
          } catch {
            onShowToast?.('Lỗi kết nối máy chủ khi gia hạn lịch hẹn.', 'error');
          } finally {
            releaseActionLock(lockKey);
          }
        },
      });
    },
    [
      openConfirmDialog,
      acquireActionLock,
      releaseActionLock,
      onShowToast,
      fetchAdminSafetyTimers,
      fetchAdminStats,
      isStrictAdmin,
      fetchAuditLogs,
    ]
  );

  const handleAdminResolveBeacon = useCallback(
    (beaconId: string, displayName: string, trailName: string) => {
      const lockKey = `beacon-resolve:${beaconId}`;
      openConfirmDialog({
        title: 'Kết thúc phiên phát tín hiệu trực tiếp?',
        message: `Đóng tín hiệu định vị của "${displayName}" trên cung "${trailName}" và chuyển sang trạng thái đã kết thúc? Người theo dõi sẽ nhận được cập nhật ngay lập tức.`,
        confirmLabel: 'Kết thúc tín hiệu',
        danger: true,
        reasonInputLabel: 'Ghi chú đóng tín hiệu (tùy chọn)',
        reasonPlaceholder: 'VD: Đã liên hệ xác nhận trekker an toàn, quên tắt chia sẻ GPS...',
        defaultReason: '',
        onConfirm: async (reasonInput?: string) => {
          if (!acquireActionLock(lockKey)) return;
          try {
            const finalReason = (reasonInput || '').trim();
            const res = await fetch(
              `/api/live-beacons/admin/${encodeURIComponent(beaconId)}/resolve`,
              {
                method: 'PATCH',
                headers: getApiHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ reason: finalReason || undefined }),
              }
            );
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
              onShowToast?.(
                data.message || 'Đã kết thúc phiên phát tín hiệu trực tiếp.',
                'success'
              );
              setLiveBeaconsList((prev) =>
                prev.filter((b) => String(b._id || b.token || '') !== beaconId)
              );
              setInspectorSelection((prev) =>
                prev?.kind === 'beacon' && prev.data.id === beaconId ? null : prev
              );
              void fetchAdminLiveBeacons();
              void fetchAdminStats();
              if (isStrictAdmin) void fetchAuditLogs();
            } else {
              onShowToast?.(data.message || 'Không thể kết thúc tín hiệu trực tiếp.', 'error');
            }
          } catch {
            onShowToast?.('Lỗi kết nối máy chủ khi kết thúc tín hiệu.', 'error');
          } finally {
            releaseActionLock(lockKey);
          }
        },
      });
    },
    [
      openConfirmDialog,
      acquireActionLock,
      releaseActionLock,
      onShowToast,
      fetchAdminLiveBeacons,
      fetchAdminStats,
      isStrictAdmin,
      fetchAuditLogs,
    ]
  );

  const executeConfirmDialog = async () => {
    if (!confirmDialog || isConfirmExecuting) return;
    setIsConfirmExecuting(true);
    try {
      await confirmDialog.onConfirm(confirmReason);
      setConfirmDialog(null);
      setConfirmReason('');
    } catch {
      onShowToast?.('Đã xảy ra lỗi khi thực hiện thao tác.', 'error');
    } finally {
      setIsConfirmExecuting(false);
    }
  };

  const { activeIncidents, resolvedIncidents, pendingDisputesCount } = useMemo(() => {
    const active: AdminIncidentItem[] = [];
    const resolved: AdminIncidentItem[] = [];
    let disputes = 0;
    for (const i of incidentsList) {
      if (i.resolved) resolved.push(i);
      else active.push(i);
      if (!isSyntheticIncident(i) && Array.isArray(i.disputes) && i.disputes.length > 0) disputes++;
    }
    return { activeIncidents: active, resolvedIncidents: resolved, pendingDisputesCount: disputes };
  }, [incidentsList]);

  const activeIncidentsCount = activeIncidents.length;
  const displayedIncidents = useMemo(() => {
    const base =
      incidentFilter === 'active'
        ? activeIncidents
        : incidentFilter === 'resolved'
          ? resolvedIncidents
          : incidentsList;
    const q = incidentSearchQuery.trim();
    if (!q) return base;
    return base.filter(
      (inc) =>
        searchMatchVietnamese(inc.trailName || '', q) ||
        searchMatchVietnamese(inc.description || '', q) ||
        searchMatchVietnamese(inc.locationNote || '', q) ||
        searchMatchVietnamese(inc.reporterName || inc.userName || inc.verifiedBy || '', q) ||
        searchMatchVietnamese(inc.reporterEmail || '', q) ||
        searchMatchVietnamese(getSeverityLabelVi(inc.severity), q)
    );
  }, [incidentFilter, activeIncidents, resolvedIncidents, incidentsList, incidentSearchQuery]);

  const filteredThreads = useMemo(() => {
    const q = forumSearchQuery.trim();
    if (!q) return threadsList;
    return threadsList.filter(
      (t) =>
        searchMatchVietnamese(t.title || '', q) ||
        searchMatchVietnamese(t.category || '', q) ||
        searchMatchVietnamese(t.authorName || '', q)
    );
  }, [threadsList, forumSearchQuery]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearchQuery.trim();
    if (!q) return auditLogs;
    return auditLogs.filter(
      (log) =>
        searchMatchVietnamese(log.action || '', q) ||
        searchMatchVietnamese(log.targetCollection || '', q) ||
        searchMatchVietnamese(log.details || '', q) ||
        searchMatchVietnamese(log.userId?.fullName || '', q) ||
        searchMatchVietnamese(log.userId?.email || '', q) ||
        searchMatchVietnamese(log.ipAddress || '', q)
    );
  }, [auditLogs, auditSearchQuery]);

  const { inquiryStatusCounts, pendingInquiriesCount, filteredInquiries } = useMemo(() => {
    const counts = { all: inquiriesList.length, pending: 0, contacted: 0, confirmed: 0, cancelled: 0 };
    const q = inquirySearchQuery.trim();
    const matched: AdminGuideInquiryItem[] = [];
    for (const item of inquiriesList) {
      if (item.status === 'pending') counts.pending++;
      else if (item.status === 'contacted') counts.contacted++;
      else if (item.status === 'confirmed') counts.confirmed++;
      else if (item.status === 'cancelled') counts.cancelled++;

      if (inquiryStatusFilter !== 'all' && item.status !== inquiryStatusFilter) continue;
      if (!q) {
        matched.push(item);
        continue;
      }
      const trekkerName =
        typeof item.userId === 'object' ? item.userId?.fullName || item.userId?.username || '' : '';
      const guideName = typeof item.guideId === 'object' ? item.guideId?.name || '' : '';
      const trailLabel =
        item.trailName || (typeof item.trailId === 'object' ? item.trailId?.name || '' : '');
      if (
        searchMatchVietnamese(trekkerName, q) ||
        searchMatchVietnamese(item.contactPhone || '', q) ||
        searchMatchVietnamese(guideName, q) ||
        searchMatchVietnamese(trailLabel, q)
      ) {
        matched.push(item);
      }
    }
    return { inquiryStatusCounts: counts, pendingInquiriesCount: counts.pending, filteredInquiries: matched };
  }, [inquiriesList, inquiryStatusFilter, inquirySearchQuery]);

  const { overdueTimersCount, activeTimersLiveCount, sosBeaconsCount, liveSafetyTotal } = useMemo(() => {
    let overdue = 0;
    let activeOnly = 0;
    let activeOrOverdue = 0;
    for (const t of liveSafetyTimers) {
      if (t.status === 'overdue_alerted') {
        overdue++;
        activeOrOverdue++;
      } else if (t.status === 'active') {
        activeOnly++;
        activeOrOverdue++;
      }
    }
    let sos = 0;
    for (const b of liveBeaconsList) {
      if (b.status === 'sos') sos++;
    }
    return {
      overdueTimersCount: overdue,
      activeTimersLiveCount: activeOnly,
      sosBeaconsCount: sos,
      liveSafetyTotal: activeOrOverdue + liveBeaconsList.length,
    };
  }, [liveSafetyTimers, liveBeaconsList]);
  const displayedSafetyTimers =
    safetyTimerView === 'live' ? liveSafetyTimers : archivedSafetyTimers[safetyTimerView];
  const urgentSafetyCount = overdueTimersCount + sosBeaconsCount;
  const fieldModerationTotal = poisList.length + reviewsList.length;

  const { userRoleCounts, filteredUsers } = useMemo(() => {
    const counts = { all: usersList.length, admin: 0, moderator: 0, guide: 0, user: 0, banned: 0 };
    const q = userSearchQuery.trim();
    const matched: AdminUserItem[] = [];
    for (const u of usersList) {
      if (u.role === 'admin') counts.admin++;
      else if (u.role === 'moderator') counts.moderator++;
      else if (u.role === 'guide') counts.guide++;
      else counts.user++;
      if (u.isBanned) counts.banned++;

      if (userRoleFilter === 'banned' && !u.isBanned) continue;
      if (userRoleFilter !== 'all' && userRoleFilter !== 'banned' && (u.role || 'user') !== userRoleFilter) {
        continue;
      }
      if (
        !q ||
        searchMatchVietnamese(u.fullName || '', q) ||
        searchMatchVietnamese(u.username || '', q) ||
        searchMatchVietnamese(u.email || '', q) ||
        searchMatchVietnamese(u.banReason || '', q)
      ) {
        matched.push(u);
      }
    }
    return { userRoleCounts: counts, filteredUsers: matched };
  }, [usersList, userRoleFilter, userSearchQuery]);

  const { filteredPois, filteredReviews } = useMemo(() => {
    const q = fieldSearchQuery.trim();
    if (!q) return { filteredPois: poisList, filteredReviews: reviewsList };
    const matchedPois = poisList.filter((poi) => {
      const authorEmail = typeof poi.userId === 'object' ? poi.userId?.email || '' : '';
      return (
        searchMatchVietnamese(poi.title || '', q) ||
        searchMatchVietnamese(poi.notes || '', q) ||
        searchMatchVietnamese(poi.trail?.name || poi.trailName || poi.trailId || '', q) ||
        searchMatchVietnamese(poi.authorName || '', q) ||
        searchMatchVietnamese(authorEmail, q)
      );
    });
    const matchedReviews = reviewsList.filter((rev) => {
      const trailName = typeof rev.trailId === 'object' ? rev.trailId?.name || '' : '';
      const reviewerName =
        (typeof rev.userId === 'object' ? rev.userId?.fullName : '') || rev.userName || '';
      const reviewerEmail = typeof rev.userId === 'object' ? rev.userId?.email || '' : '';
      return (
        searchMatchVietnamese(trailName, q) ||
        searchMatchVietnamese(reviewerName, q) ||
        searchMatchVietnamese(reviewerEmail, q) ||
        searchMatchVietnamese(rev.content || '', q)
      );
    });
    return { filteredPois: matchedPois, filteredReviews: matchedReviews };
  }, [poisList, reviewsList, fieldSearchQuery]);

  const { cockpitTrails, cockpitTrailsById, resolveTrailCoords } = useMemo(() => {
    const mapped: CockpitTrailPoint[] = [];
    const byId = new Map<string, CockpitTrailPoint>();
    const coordsEntries: Array<{
      id: string;
      nameNorm: string;
      altNorms: string[];
      lat: number;
      lng: number;
    }> = [];

    for (const t of trailsList) {
      const id = String(t._id || t.id || '');
      if (!id) continue;
      const lat = Number(t.startLat);
      const lng = Number(t.startLng);
      const point: CockpitTrailPoint = {
        id,
        slug: t.id,
        name: t.name || 'Cung đường trekking',
        province: t.province || 'Việt Nam',
        district: t.district,
        region: t.region || 'Miền Bắc',
        startLat: Number.isFinite(lat) ? lat : 0,
        startLng: Number.isFinite(lng) ? lng : 0,
        distanceKm: Number(t.distanceKm) || 0,
        elevationGainM: Number(t.elevationGainM) || 0,
        maxAltitudeM: Number(t.maxAltitudeM) || 0,
        difficultyLevel: t.difficultyLevel,
        durationHoursNote: t.durationHoursNote,
        rating: t.rating,
        reviewCount: t.reviewCount,
        coverImage: t.coverImage,
        permitRequired: t.permitRequired,
        permitInfo: t.permitInfo,
        hasCampsite: t.hasCampsite,
        hasWaterSource: t.hasWaterSource,
        kidFriendly: t.kidFriendly,
        status: t.status,
        gpxTrack: t.gpxTrack,
      };
      mapped.push(point);
      byId.set(id, point);

      if (hasValidVnCoords({ startLat: lat, startLng: lng })) {
        coordsEntries.push({
          id,
          nameNorm: (t.name || '').trim().toLowerCase(),
          altNorms: Array.isArray(t.altNames)
            ? t.altNames.map((a) => a.trim().toLowerCase()).filter(Boolean)
            : [],
          lat,
          lng,
        });
      }
    }

    const resolveCoords = (
      trailName?: string,
      trailId?: string
    ): { lat: number; lng: number } | null => {
      if (trailId) {
        const direct = coordsEntries.find((entry) => entry.id === trailId);
        if (direct) return { lat: direct.lat, lng: direct.lng };
      }
      const q = (trailName || '').trim().toLowerCase();
      if (!q) return null;
      const exact = coordsEntries.find(
        (entry) => entry.nameNorm === q || entry.altNorms.includes(q)
      );
      if (exact) return { lat: exact.lat, lng: exact.lng };
      const partial = coordsEntries.find(
        (entry) =>
          (entry.nameNorm && (entry.nameNorm.includes(q) || q.includes(entry.nameNorm))) ||
          entry.altNorms.some((alt) => alt.includes(q) || q.includes(alt)) ||
          searchMatchVietnamese(entry.nameNorm, q)
      );
      return partial ? { lat: partial.lat, lng: partial.lng } : null;
    };

    return {
      cockpitTrails: mapped,
      cockpitTrailsById: byId,
      resolveTrailCoords: resolveCoords,
    };
  }, [trailsList]);

  const { cockpitContributions, cockpitPendingContributions, cockpitContributionsById } = useMemo(() => {
    const mapped: CockpitContributionPoint[] = [];
    const pendingOnly: CockpitContributionPoint[] = [];
    const byId = new Map<string, CockpitContributionPoint>();
    for (const c of contributions) {
      const id = String(c.id || c._id || '');
      if (!id) continue;
      const point: CockpitContributionPoint = {
        id,
        name: c.name || 'Cung đường trekking mới',
        province: c.province || 'Chưa rõ tỉnh',
        district: c.district,
        region: c.region,
        status: c.status || 'pending',
        distanceKm: c.distanceKm,
        elevationGainM: c.elevationGainM,
        maxAltitudeM: c.maxAltitudeM,
        durationHoursNote: c.durationHoursNote,
        startLat: c.startLat,
        startLng: c.startLng,
        coverImage: c.coverImage,
        authorName: c.authorName,
        authorEmail: c.authorEmail,
        createdAt: c.createdAt || c.submittedAt,
        permitRequired: c.permitRequired,
        hasCampsite: c.hasCampsite,
        hasWaterSource: c.hasWaterSource,
        gpxTrack: c.gpxTrack,
      };
      mapped.push(point);
      byId.set(id, point);
      if (point.status !== 'approved' && point.status !== 'rejected') {
        pendingOnly.push(point);
      }
    }
    return {
      cockpitContributions: mapped,
      cockpitPendingContributions: pendingOnly,
      cockpitContributionsById: byId,
    };
  }, [contributions]);

  const nearbyTrailByContributionId = useMemo(() => {
    const map = new Map<string, { trailName: string; distanceKm: number }>();
    const publishedTrails = trailsList.filter(
      (t) => (!t.status || t.status === 'approved') && hasValidVnCoords(t)
    );
    if (publishedTrails.length === 0) return map;

    for (const contrib of contributions) {
      const statusNorm = (contrib.status || 'pending').toLowerCase();
      if (statusNorm !== 'pending' || !hasValidVnCoords(contrib)) continue;
      const contribId = String(contrib.id || contrib._id || '');
      if (!contribId) continue;
      const cLat = Number(contrib.startLat);
      const cLng = Number(contrib.startLng);
      let closest: { trailName: string; distanceKm: number } | null = null;
      for (const trail of publishedTrails) {
        const distKm = haversineKm(cLat, cLng, Number(trail.startLat), Number(trail.startLng));
        if (distKm <= DUPLICATE_PEAK_RADIUS_KM && (!closest || distKm < closest.distanceKm)) {
          closest = {
            trailName: trail.name || 'Cung đường hiện có',
            distanceKm: distKm,
          };
        }
      }
      if (closest) {
        map.set(contribId, closest);
      }
    }
    return map;
  }, [contributions, trailsList]);

  const { cockpitIncidents, cockpitIncidentsById } = useMemo(() => {
    const mapped: CockpitIncidentPoint[] = [];
    const byId = new Map<string, CockpitIncidentPoint>();
    for (const inc of incidentsList) {
      const id = String(inc._id || inc.id || '');
      if (!id) continue;
      const synthetic = isSyntheticIncident(inc);
      const explicitValid = hasValidVnCoords({ startLat: inc.lat, startLng: inc.lng });
      const matched = explicitValid
        ? { lat: Number(inc.lat), lng: Number(inc.lng) }
        : resolveTrailCoords(inc.trailName, inc.trailId);
      const point: CockpitIncidentPoint = {
        id,
        trailName: inc.trailName || 'Cảnh báo thực địa',
        type: inc.type,
        severity: inc.severity || 'high',
        description: inc.description || 'Cảnh báo an toàn thực địa cần kiểm tra.',
        locationNote: inc.locationNote,
        resolved: Boolean(inc.resolved),
        isSynthetic: synthetic,
        lat: matched?.lat,
        lng: matched?.lng,
        reporterName: inc.reporterName || inc.userName || inc.verifiedBy,
        reportedAt: inc.reportedAt || inc.createdAt,
        disputesCount: Array.isArray(inc.disputes) ? inc.disputes.length : 0,
      };
      mapped.push(point);
      byId.set(id, point);
    }
    return { cockpitIncidents: mapped, cockpitIncidentsById: byId };
  }, [incidentsList, resolveTrailCoords]);

  const { cockpitBeacons, cockpitBeaconsById } = useMemo(() => {
    const mapped: CockpitBeaconPoint[] = [];
    const byId = new Map<string, CockpitBeaconPoint>();
    for (const b of liveBeaconsList) {
      const id = String(b._id || b.token || '');
      if (!id) continue;
      const userObj = typeof b.userId === 'object' ? b.userId : null;
      const posValid =
        b.lastPosition &&
        hasValidVnCoords({ startLat: b.lastPosition.lat, startLng: b.lastPosition.lng });
      const fallbackCoords = posValid
        ? { lat: b.lastPosition!.lat, lng: b.lastPosition!.lng }
        : resolveTrailCoords(b.trailName, b.trailId);
      const mappedStatus: CockpitBeaconPoint['status'] =
        b.status === 'sos' ? 'sos' : b.status === 'safe' ? 'ended' : 'active';
      const point: CockpitBeaconPoint = {
        id,
        token: b.token,
        displayName: b.displayName || userObj?.fullName || userObj?.username || 'Trekker LOST',
        trailName: b.trailName || 'Hành trình thực địa',
        status: mappedStatus,
        lat: fallbackCoords?.lat,
        lng: fallbackCoords?.lng,
        altitudeM: b.lastPosition?.altitudeM ?? null,
        batteryPercent: b.batteryPercent ?? null,
        distanceKm: b.distanceKm,
        lastPingAt: b.lastPingAt,
        isSignalStale: b.isSignalStale,
        minutesSinceLastPing: b.minutesSinceLastPing ?? null,
        emergencyNote: b.emergencyNote,
        phone: userObj?.phone,
        email: userObj?.email,
        emergencyContact: userObj?.emergencyContact,
        sharePath: b.sharePath || `/beacon/${b.token}`,
      };
      mapped.push(point);
      byId.set(id, point);
    }
    return { cockpitBeacons: mapped, cockpitBeaconsById: byId };
  }, [liveBeaconsList, resolveTrailCoords]);

  const { cockpitOverdueTimers, cockpitOverdueTimersById } = useMemo(() => {
    const mapped: CockpitOverdueTimerPoint[] = [];
    const byId = new Map<string, CockpitOverdueTimerPoint>();
    for (const timer of liveSafetyTimers) {
      if (timer.status !== 'overdue_alerted') continue;
      const userObj = typeof timer.userId === 'object' ? timer.userId : null;
      const explicitValid = hasValidVnCoords({
        startLat: timer.lastKnownLat,
        startLng: timer.lastKnownLng,
      });
      const fallback = explicitValid
        ? { lat: Number(timer.lastKnownLat), lng: Number(timer.lastKnownLng) }
        : resolveTrailCoords(timer.trailName, timer.trailSlug);
      const point: CockpitOverdueTimerPoint = {
        id: timer._id,
        userName: userObj?.fullName || userObj?.username || 'Thành viên LOST',
        trailName: timer.trailName || 'Cung đường trekking',
        expectedReturnAt: timer.expectedReturnAt,
        alertedAt: timer.alertedAt,
        emergencyContactName: timer.emergencyContactName,
        emergencyContactPhone: timer.emergencyContactPhone,
        emergencyContactEmail: timer.emergencyContactEmail,
        trekkerPhone: userObj?.phone,
        notes: timer.notes,
        lat: fallback?.lat,
        lng: fallback?.lng,
      };
      mapped.push(point);
      byId.set(point.id, point);
    }
    return { cockpitOverdueTimers: mapped, cockpitOverdueTimersById: byId };
  }, [liveSafetyTimers, resolveTrailCoords]);

  const cockpitUsersById = useMemo(() => {
    const byId = new Map<string, CockpitUserPoint>();
    for (const u of usersList) {
      const id = String(u._id || u.id || '');
      if (!id) continue;
      byId.set(id, {
        id,
        fullName: u.fullName || u.name || u.username || u.email || 'Thành viên LOST',
        email: u.email || '',
        role: u.role || 'user',
        avatarUrl: u.avatarUrl || u.avatar,
        reputationScore: Number(u.reputationScore ?? 0),
        badges: Array.isArray(u.badges) ? u.badges : [],
        isBanned: Boolean(u.isBanned),
        banReason: u.banReason,
      });
    }
    return byId;
  }, [usersList]);

  const cockpitTriageItems = useMemo<CockpitTriageItem[]>(() => {
    const items: CockpitTriageItem[] = [];
    const seenIncidentIds = new Set<string>();

    // P1: SOS Beacons
    for (const beacon of cockpitBeacons) {
      if (beacon.status === 'sos') {
        items.push({
          id: `sos-${beacon.id}`,
          kind: 'sos',
          priority: 1,
          title: `SOS · ${beacon.displayName}`,
          subtitle: `${beacon.trailName}${beacon.emergencyNote ? ` — ${beacon.emergencyNote}` : ''}`,
          meta: beacon.lastPingAt ? formatDateVi(beacon.lastPingAt) : 'Phát tín hiệu SOS',
          targetSection: 'safety',
          lat: beacon.lat,
          lng: beacon.lng,
          selection: { kind: 'beacon', data: beacon },
        });
      }
    }

    // P1: Overdue Safety Timers (always driven by liveSafetyTimers)
    for (const timer of cockpitOverdueTimers) {
      items.push({
        id: `overdue-${timer.id}`,
        kind: 'overdue',
        priority: 1,
        title: `Quá hạn báo bình an · ${timer.userName}`,
        subtitle: `${timer.trailName} · Hạn ${formatDateVi(timer.expectedReturnAt)}`,
        meta: timer.emergencyContactPhone ? `Liên hệ: ${timer.emergencyContactPhone}` : 'Cần kiểm tra ngay',
        targetSection: 'safety',
        lat: timer.lat,
        lng: timer.lng,
        selection: { kind: 'timer', data: timer },
      });
    }

    // P1: Community-disputed incidents & critical active incidents
    for (const inc of cockpitIncidents) {
      if (!inc.isSynthetic && inc.disputesCount > 0) {
        seenIncidentIds.add(inc.id);
        items.push({
          id: `dispute-${inc.id}`,
          kind: 'dispute',
          priority: 1,
          title: `Báo tin chưa đúng · ${inc.trailName}`,
          subtitle: inc.description,
          meta: `${inc.disputesCount} phản hồi trái chiều`,
          targetSection: 'incidents',
          lat: inc.lat,
          lng: inc.lng,
          selection: { kind: 'incident', data: inc },
        });
      } else if (!inc.resolved && inc.severity === 'critical') {
        seenIncidentIds.add(inc.id);
        items.push({
          id: `inc-crit-${inc.id}`,
          kind: 'incident',
          priority: 1,
          title: `Khẩn cấp · ${inc.trailName}`,
          subtitle: inc.description,
          meta: inc.isSynthetic ? 'Dữ liệu vệ tinh' : formatDateVi(inc.reportedAt),
          targetSection: 'incidents',
          lat: inc.lat,
          lng: inc.lng,
          selection: { kind: 'incident', data: inc },
        });
      }
    }

    // P2: Pending Contributions
    for (const contrib of cockpitContributions) {
      if (contrib.status !== 'approved' && contrib.status !== 'rejected') {
        items.push({
          id: `contrib-${contrib.id}`,
          kind: 'contribution',
          priority: 2,
          title: contrib.name,
          subtitle: `${contrib.province} · ${contrib.distanceKm ?? 0} km · +${contrib.elevationGainM ?? 0}m`,
          meta: contrib.authorName || contrib.authorEmail || 'Cộng đồng',
          targetSection: 'contributions',
          lat: contrib.startLat,
          lng: contrib.startLng,
          selection: { kind: 'contribution', data: contrib },
        });
      }
    }

    // P2: Pending Porter / Guide Inquiries
    for (const inq of inquiriesList) {
      if (inq.status === 'pending') {
        const trekkerObj = typeof inq.userId === 'object' ? inq.userId : null;
        const trailObj = typeof inq.trailId === 'object' ? inq.trailId : null;
        const trailLabel = inq.trailName || trailObj?.name || 'Cung đường trekking';
        items.push({
          id: `inq-${inq._id}`,
          kind: 'inquiry',
          priority: 2,
          title: `Thuê Porter & HDV · ${trailLabel}`,
          subtitle: `${trekkerObj?.fullName || trekkerObj?.username || 'Trekker'} · ${inq.groupSize || 1} người · ${inq.durationDays || 1} ngày`,
          meta: formatDateOnlyVi(inq.plannedStartDate),
          targetSection: 'inquiries',
        });
      }
    }

    // P3: Other active unresolved incidents
    for (const inc of cockpitIncidents) {
      if (!inc.resolved && !seenIncidentIds.has(inc.id)) {
        items.push({
          id: `inc-${inc.id}`,
          kind: 'incident',
          priority: 3,
          title: inc.trailName,
          subtitle: inc.description,
          meta: inc.isSynthetic ? 'Vệ tinh · chỉ đọc' : formatDateVi(inc.reportedAt),
          targetSection: 'incidents',
          lat: inc.lat,
          lng: inc.lng,
          selection: { kind: 'incident', data: inc },
        });
      }
    }

    return items.sort((a, b) => a.priority - b.priority);
  }, [cockpitBeacons, cockpitOverdueTimers, cockpitIncidents, cockpitContributions, inquiriesList]);

  const commandDeckStats = useMemo<AdminCommandDeckStats>(() => {
    const activeTimersCount = liveSafetyTimers.filter(
      (t) => t.status === 'active' || t.status === 'overdue_alerted'
    ).length;
    return {
      totalUsers: loadedSections.has('users')
        ? usersList.length
        : (adminStats?.totalUsers ?? usersList.length),
      totalTrails: loadedSections.has('trails')
        ? trailsList.length
        : (adminStats?.totalTrails ?? trailsList.length),
      pendingContributions: loadedSections.has('contributions')
        ? pendingContributions.length
        : (adminStats?.pendingContributions ?? pendingContributions.length),
      activeIncidents: loadedSections.has('incidents')
        ? activeIncidentsCount
        : (adminStats?.totalIncidents ?? activeIncidentsCount),
      activeSafetyTimers: loadedSections.has('safety')
        ? activeTimersCount
        : (adminStats?.activeSafetyTimers ?? activeTimersCount),
      totalReviews: adminStats?.totalReviews ?? reviewsTotal,
      totalThreads: loadedSections.has('forum')
        ? threadsList.length
        : (adminStats?.totalThreads ?? threadsList.length),
      totalCheckins: adminStats?.totalCheckins ?? 0,
      totalGuides: adminStats?.totalGuides ?? 0,
      totalTripPlans: adminStats?.totalTripPlans ?? 0,
      totalTripReports: adminStats?.totalTripReports ?? 0,
      urgentSafetyCount,
    };
  }, [
    loadedSections,
    usersList.length,
    trailsList.length,
    pendingContributions.length,
    activeIncidentsCount,
    liveSafetyTimers,
    reviewsTotal,
    threadsList.length,
    adminStats,
    urgentSafetyCount,
  ]);

  // Keep docked Spatial Inspector synced with live state; return null when an item was deleted (no ghost data)
  const liveInspectorSelection = useMemo<CockpitInspectorSelection | null>(() => {
    if (!inspectorSelection) return null;
    switch (inspectorSelection.kind) {
      case 'trail': {
        const fresh = cockpitTrailsById.get(inspectorSelection.data.id);
        if (fresh) return { kind: 'trail', data: fresh };
        return loadedSections.has('trails') ? null : inspectorSelection;
      }
      case 'contribution': {
        const fresh = cockpitContributionsById.get(inspectorSelection.data.id);
        if (fresh) return { kind: 'contribution', data: fresh };
        return loadedSections.has('contributions') ? null : inspectorSelection;
      }
      case 'incident': {
        const fresh = cockpitIncidentsById.get(inspectorSelection.data.id);
        if (fresh) return { kind: 'incident', data: fresh };
        return loadedSections.has('incidents') ? null : inspectorSelection;
      }
      case 'beacon': {
        const fresh = cockpitBeaconsById.get(inspectorSelection.data.id);
        if (fresh) return { kind: 'beacon', data: fresh };
        return loadedSections.has('safety') ? null : inspectorSelection;
      }
      case 'timer': {
        const fresh = cockpitOverdueTimersById.get(inspectorSelection.data.id);
        if (fresh) return { kind: 'timer', data: fresh };
        return loadedSections.has('safety') ? null : inspectorSelection;
      }
      case 'user': {
        const fresh = cockpitUsersById.get(inspectorSelection.data.id);
        if (fresh) return { kind: 'user', data: fresh };
        return loadedSections.has('users') ? null : inspectorSelection;
      }
    }
  }, [
    inspectorSelection,
    loadedSections,
    cockpitTrailsById,
    cockpitContributionsById,
    cockpitIncidentsById,
    cockpitBeaconsById,
    cockpitOverdueTimersById,
    cockpitUsersById,
  ]);

  const selectedInspectorId = liveInspectorSelection ? liveInspectorSelection.data.id : null;

  const lockedCoords = useMemo<CockpitCoordPoint | null>(() => {
    if (!liveInspectorSelection) return null;
    if (liveInspectorSelection.kind === 'trail') {
      const { startLat, startLng } = liveInspectorSelection.data;
      return hasValidVnCoords({ startLat, startLng }) ? { lat: startLat, lng: startLng } : null;
    }
    if (liveInspectorSelection.kind === 'contribution') {
      const { startLat, startLng } = liveInspectorSelection.data;
      return hasValidVnCoords({ startLat, startLng })
        ? { lat: Number(startLat), lng: Number(startLng) }
        : null;
    }
    if (
      liveInspectorSelection.kind === 'incident' ||
      liveInspectorSelection.kind === 'beacon' ||
      liveInspectorSelection.kind === 'timer'
    ) {
      const { lat, lng } = liveInspectorSelection.data;
      return hasValidVnCoords({ startLat: lat, startLng: lng })
        ? { lat: Number(lat), lng: Number(lng) }
        : null;
    }
    return null;
  }, [liveInspectorSelection]);

  const statusReadiness: AdminReadinessLevel =
    urgentSafetyCount > 0
      ? 'critical'
      : commandDeckStats.activeIncidents > 0 ||
          commandDeckStats.pendingContributions > 0 ||
          pendingInquiriesCount > 0 ||
          pendingDisputesCount > 0
        ? 'attention'
        : 'stable';

  const statusReadinessDetail =
    statusReadiness === 'critical'
      ? `${urgentSafetyCount} cảnh báo SOS / quá hạn`
      : statusReadiness === 'attention'
        ? `${commandDeckStats.activeIncidents} sự cố · ${commandDeckStats.pendingContributions} chờ duyệt`
        : `${commandDeckStats.totalTrails} cung đường`;

  const handleInspectorEditTrail = useCallback(
    (trailId: string) => {
      if (!isStrictAdmin) return;
      const found = trailsList.find((t) => (t._id || t.id) === trailId);
      if (found) openEditTrailModal(found);
    },
    [isStrictAdmin, trailsList, openEditTrailModal]
  );

  const handleInspectorOpenContribModal = useCallback(
    (contribId: string) => {
      const found = contributions.find((c) => (c.id || c._id) === contribId);
      if (found) setSelectedContribution(found);
    },
    [contributions]
  );

  const handleOpenCreateTrail = useCallback(() => {
    if (!isStrictAdmin) return;
    setCreateTrailForm(createEmptyTrailForm());
    setIsCreateTrailOpen(true);
  }, [isStrictAdmin]);

  type AdminNavGroupId = 'command' | 'moderation' | 'operations' | 'system';

  interface NavItemConfig {
    id: AdminSectionId;
    group: AdminNavGroupId;
    label: string;
    icon: React.ComponentType<{ size?: number; color?: string }>;
    count?: number;
    alertTone?: 'danger' | 'warn';
    urgentTooltip?: string;
    adminOnly?: boolean;
  }

  const navGroupLabels: Record<AdminNavGroupId, string> = {
    command: 'Trực vận hành',
    moderation: 'Kiểm duyệt',
    operations: 'Điều phối',
    system: 'Hệ thống',
  };

  const navItems = useMemo<NavItemConfig[]>(() => {
    const pendingContribCount = loadedSections.has('contributions')
      ? pendingContributions.length
      : (adminStats?.pendingContributions ?? pendingContributions.length);
    const totalTrailsCount = loadedSections.has('trails')
      ? trailsList.length
      : (adminStats?.totalTrails ?? trailsList.length);
    const incidentsCount = loadedSections.has('incidents')
      ? activeIncidentsCount
      : (adminStats?.totalIncidents ?? activeIncidentsCount);
    const inquiriesCount = loadedSections.has('inquiries')
      ? pendingInquiriesCount > 0
        ? pendingInquiriesCount
        : inquiriesList.length
      : undefined;
    const safetyCount = loadedSections.has('safety')
      ? urgentSafetyCount > 0
        ? urgentSafetyCount
        : liveSafetyTotal
      : (adminStats?.activeSafetyTimers ?? liveSafetyTotal);
    const fieldCount = loadedSections.has('field')
      ? fieldModerationTotal
      : (adminStats?.totalReviews ?? fieldModerationTotal);
    const usersCount = loadedSections.has('users')
      ? usersList.length
      : (adminStats?.totalUsers ?? usersList.length);
    const forumCount = loadedSections.has('forum')
      ? threadsList.length
      : (adminStats?.totalThreads ?? threadsList.length);

    const allNavItems: NavItemConfig[] = [
      {
        id: 'overview',
        group: 'command',
        label: 'Trực vận hành',
        icon: Compass,
        count: urgentSafetyCount > 0 ? urgentSafetyCount : undefined,
        alertTone: urgentSafetyCount > 0 ? 'danger' : undefined,
        urgentTooltip: urgentSafetyCount > 0 ? `${urgentSafetyCount} tín hiệu khẩn cấp` : undefined,
      },
      {
        id: 'contributions',
        group: 'moderation',
        label: 'Duyệt đóng góp',
        icon: Inbox,
        count: pendingContribCount,
        alertTone: pendingContribCount > 0 ? 'warn' : undefined,
      },
      {
        id: 'incidents',
        group: 'moderation',
        label: 'Sự cố & cảnh báo',
        icon: AlertTriangle,
        count: incidentsCount,
        alertTone: pendingDisputesCount > 0 || incidentsCount > 0 ? 'danger' : undefined,
        urgentTooltip: pendingDisputesCount > 0 ? `${pendingDisputesCount} cảnh báo bị phản bác` : undefined,
      },
      {
        id: 'field',
        group: 'moderation',
        label: 'Điểm mốc & đánh giá',
        icon: IconMapPin,
        count: fieldCount,
      },
      {
        id: 'forum',
        group: 'moderation',
        label: 'Diễn đàn',
        icon: MessageSquare,
        count: forumCount,
      },
      {
        id: 'trails',
        group: 'operations',
        label: 'Cung đường',
        icon: Layers,
        count: totalTrailsCount,
      },
      {
        id: 'inquiries',
        group: 'operations',
        label: 'Porter & HDV',
        icon: IconBackpack,
        count: inquiriesCount,
        alertTone: pendingInquiriesCount > 0 ? 'warn' : undefined,
      },
      {
        id: 'safety',
        group: 'operations',
        label: 'An toàn & tín hiệu',
        icon: IconShieldAlert,
        count: safetyCount,
        alertTone: urgentSafetyCount > 0 ? 'danger' : undefined,
        urgentTooltip: urgentSafetyCount > 0 ? `${urgentSafetyCount} tín hiệu khẩn cấp` : undefined,
      },
      {
        id: 'stats',
        group: 'system',
        label: 'Thống kê',
        icon: BarChart3,
      },
      {
        id: 'users',
        group: 'system',
        label: 'Thành viên & quyền',
        icon: Users,
        count: usersCount,
        adminOnly: true,
      },
      {
        id: 'audit',
        group: 'system',
        label: 'Nhật ký thao tác',
        icon: ShieldCheck,
        count: auditLogs.length > 0 ? auditLogs.length : undefined,
        adminOnly: true,
      },
    ];
    return allNavItems.filter((item) => !item.adminOnly || isStrictAdmin);
  }, [
    loadedSections,
    pendingContributions.length,
    adminStats,
    trailsList.length,
    activeIncidentsCount,
    pendingDisputesCount,
    pendingInquiriesCount,
    inquiriesList.length,
    liveSafetyTotal,
    urgentSafetyCount,
    fieldModerationTotal,
    usersList.length,
    threadsList.length,
    auditLogs.length,
    isStrictAdmin,
  ]);

  // Power-user keyboard shortcuts (ignored inside inputs/textareas/selects and while any modal is open)
  useEffect(() => {
    const hasOpenModal = Boolean(
      confirmDialog ||
        isCreateTrailOpen ||
        editingTrailModal ||
        selectedAuthorModal ||
        selectedContribution
    );

    const handleShortcut = (e: KeyboardEvent) => {
      // Never conflict with global Command Palette (Ctrl+K / Cmd+K) or any open modal/drawer dialog
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey || hasOpenModal) return;
      if (typeof document !== 'undefined' && document.querySelector('[aria-modal="true"]')) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (inspectorSelection) {
          e.preventDefault();
          setInspectorSelection(null);
        } else if (mobileRailOpen) {
          e.preventDefault();
          setMobileRailOpen(false);
        }
        return;
      }

      if (e.key === '[') {
        e.preventDefault();
        toggleRailCollapsed();
        return;
      }

      if (e.key === '/') {
        const searchInput = document.querySelector<HTMLInputElement>(
          '.admin-workspace .admin-search input'
        );
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      if (e.key === '0') {
        e.preventDefault();
        handleSelectSection('overview');
        return;
      }

      if (e.key >= '1' && e.key <= '9') {
        const idx = Number(e.key);
        const targetNav = navItems[idx];
        if (targetNav) {
          e.preventDefault();
          handleSelectSection(targetNav.id);
        }
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [
    confirmDialog,
    isCreateTrailOpen,
    editingTrailModal,
    selectedAuthorModal,
    selectedContribution,
    inspectorSelection,
    mobileRailOpen,
    toggleRailCollapsed,
    handleSelectSection,
    navItems,
  ]);

  const sectionTitles: Record<AdminSectionId, { title: string; subtitle: string }> = {
    overview: {
      title: 'Trực vận hành',
      subtitle: 'Bản đồ cung đường Việt Nam, việc cần xử lý trước và tình trạng an toàn hiện tại.',
    },
    contributions: {
      title: 'Duyệt đóng góp cung đường',
      subtitle: 'Kiểm tra tọa độ GPS, thông số tuyến và duyệt cung đường mới từ cộng đồng lên bản đồ LOST.',
    },
    trails: {
      title: 'Danh sách cung đường',
      subtitle: 'Quản lý dữ liệu các cung trekking Việt Nam: cao độ, cự ly, giấy phép và liên hệ cứu hộ.',
    },
    incidents: {
      title: 'Sự cố & cảnh báo trên tuyến',
      subtitle: 'Theo dõi sạt lở, lũ quét, dữ liệu thời tiết & vệ tinh NASA và rà soát phản hồi từ cộng đồng.',
    },
    inquiries: {
      title: 'Yêu cầu thuê Porter & HDV',
      subtitle: 'Theo dõi đơn đặt người dẫn đường bản địa, dự toán chi phí và trạng thái xác nhận.',
    },
    safety: {
      title: 'An toàn & tín hiệu trực tiếp',
      subtitle: 'Theo dõi điểm phát tín hiệu trực tiếp và lịch hẹn giờ báo bình an của trekker trên núi.',
    },
    field: {
      title: 'Điểm mốc & đánh giá',
      subtitle: 'Cập nhật tình trạng nguồn nước, bãi cắm trại, điểm nguy hiểm và kiểm duyệt đánh giá tuyến.',
    },
    users: {
      title: 'Thành viên & phân quyền',
      subtitle: 'Quản lý tài khoản, cấp quyền hướng dẫn viên hoặc điều hành viên và xử lý vi phạm.',
    },
    forum: {
      title: 'Kiểm duyệt diễn đàn',
      subtitle: 'Ghim thông báo quan trọng, khóa bình luận hoặc gỡ bài viết vi phạm quy định cộng đồng.',
    },
    stats: {
      title: 'Thống kê vận hành',
      subtitle: '12 chỉ số chính về bản đồ, cộng đồng và an toàn cập nhật trực tiếp từ hệ thống.',
    },
    audit: {
      title: 'Nhật ký thao tác',
      subtitle: 'Lưu lịch sử phân quyền, khóa tài khoản và chỉnh sửa dữ liệu trong 180 ngày gần nhất.',
    },
  };

  const filteredTrails = useMemo(() => {
    const q = trailSearchQuery.trim();
    if (!q) return trailsList;
    return trailsList.filter(
      (t) =>
        searchMatchVietnamese(t.name || '', q) ||
        searchMatchVietnamese(t.province || '', q) ||
        searchMatchVietnamese(t.district || '', q) ||
        searchMatchVietnamese(t.region || '', q)
    );
  }, [trailsList, trailSearchQuery]);

  const activeNavItem = navItems.find((n) => n.id === effectiveSection) || navItems[0];
  const dbDotClass =
    dbHealth.status === 'online'
      ? 'admin-dot admin-dot--ok'
      : dbHealth.status === 'connecting'
        ? 'admin-dot admin-dot--warn'
        : dbHealth.status === 'checking'
          ? 'admin-dot'
          : 'admin-dot admin-dot--danger';
  const navGroupsOrder: AdminNavGroupId[] = ['command', 'moderation', 'operations', 'system'];

  return (
    <div className="admin-shell">
      {/* Mobile Off-Canvas Backdrop */}
      <div
        className={`admin-rail-backdrop ${mobileRailOpen ? 'is-open' : ''}`}
        onClick={() => setMobileRailOpen(false)}
        aria-hidden="true"
      />

      {/* 1. LEFT NAVIGATION RAIL */}
      <aside
        className={`admin-rail ${mobileRailOpen ? 'is-open' : ''} ${railCollapsed ? 'is-collapsed' : ''}`}
        aria-label="Điều hướng quản trị"
      >
        <div className="admin-rail-brand">
          <button
            type="button"
            className="admin-brand-mark"
            onClick={() => handleSelectSection('overview')}
            title="Trực vận hành LOST"
          >
            <span className="admin-brand-glyph" aria-hidden="true">
              <Compass size={13} color="var(--color-primary)" />
            </span>
            <span className="admin-brand-title">LOST</span>
            <span className="admin-brand-env">QT</span>
          </button>

          <button
            type="button"
            className="admin-rail-collapse-btn"
            onClick={toggleRailCollapsed}
            title={railCollapsed ? 'Mở rộng thanh điều hướng ([)' : 'Thu gọn thanh điều hướng ([)'}
            aria-label={railCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            aria-pressed={railCollapsed}
          >
            {railCollapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
          </button>

          {mobileRailOpen && (
            <button
              type="button"
              className="admin-icon-btn"
              onClick={() => setMobileRailOpen(false)}
              aria-label="Đóng thanh điều hướng"
            >
              <IconX size={14} />
            </button>
          )}
        </div>

        <nav className="admin-rail-scroll">
          {navGroupsOrder.map((groupId) => {
            const groupItems = navItems.filter((item) => item.group === groupId);
            if (groupItems.length === 0) return null;
            return (
              <div key={groupId} className="admin-rail-group">
                <div className="admin-rail-group-label">{navGroupLabels[groupId]}</div>
                {groupItems.map((item) => {
                  const isActive = effectiveSection === item.id;
                  const hasCount = typeof item.count === 'number' && item.count > 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectSection(item.id)}
                      className={`admin-nav-item ${isActive ? 'active' : ''}`}
                      title={item.urgentTooltip || item.label}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="admin-nav-item-main">
                        <span className="admin-nav-item-icon" aria-hidden="true">
                          <item.icon size={15} />
                        </span>
                        <span className="admin-nav-item-label">{item.label}</span>
                      </span>
                      {hasCount && (
                        <span className="admin-nav-meta">
                          {item.alertTone === 'danger' && (
                            <span className="admin-dot admin-dot--danger" aria-hidden="true" />
                          )}
                          <span
                            className={
                              item.alertTone === 'danger'
                                ? 'admin-nav-count admin-nav-count--alert'
                                : item.alertTone === 'warn'
                                  ? 'admin-nav-count admin-nav-count--warn'
                                  : 'admin-nav-count'
                            }
                          >
                            {item.count}
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="admin-rail-footer">
          <div className="admin-operator-row">
            <img
              loading="lazy"
              decoding="async"
              src={currentUser?.avatarUrl || currentUser?.avatar || DEFAULT_AVATAR}
              alt="Ảnh đại diện quản trị viên"
              className="admin-operator-avatar"
            />
            <div className="admin-operator-meta" style={{ flex: 1, minWidth: 0 }}>
              <div className="admin-operator-name">
                {currentUser?.fullName || currentUser?.name || currentUser?.email || 'Quản trị viên'}
              </div>
              <div className="admin-operator-role">
                {isStrictAdmin ? 'Quản trị viên' : 'Điều hành viên'}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="admin-rail-back"
            onClick={onBack}
            title="Về trang bản đồ"
          >
            <ArrowLeft size={14} />
            <span className="admin-rail-back-label">Về trang bản đồ</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE COLUMN */}
      <div className="admin-main">
        {/* Sticky 52px Command Topbar */}
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-mobile-menu-btn"
              onClick={() => setMobileRailOpen(true)}
              aria-label="Mở danh mục quản trị"
            >
              <MenuIcon size={16} />
            </button>
            <div className="admin-breadcrumb">
              <span>LOST</span>
              <span className="admin-breadcrumb-sep">/</span>
              <span>{activeNavItem ? navGroupLabels[activeNavItem.group] : 'Quản trị'}</span>
              <span className="admin-breadcrumb-sep">/</span>
              <span className="admin-breadcrumb-current">
                {activeNavItem?.label || 'Trực vận hành'}
              </span>
            </div>
          </div>

          <div className="admin-topbar-right">
            <div
              className="admin-health-pill"
              title={`Dữ liệu: ${dbHealth.label} · Kết nối trực tiếp: ${isSocketConnected ? 'Đang hoạt động' : 'Đang kết nối lại'}`}
            >
              <span className="admin-health-item">
                <span className={dbDotClass} aria-hidden="true" />
                <Database size={12} color="var(--color-text-dim)" />
                <span>CSDL</span>
              </span>
              <span style={{ opacity: 0.3 }} aria-hidden="true">·</span>
              <span className="admin-health-item">
                <span
                  className={isSocketConnected ? 'admin-dot admin-dot--ok' : 'admin-dot admin-dot--warn'}
                  aria-hidden="true"
                />
                <Radio size={12} color="var(--color-text-dim)" />
                <span>{isSocketConnected ? 'Trực tiếp' : 'Đang nối'}</span>
              </span>
            </div>

            {onOpenCommandPalette && (
              <button
                type="button"
                className="admin-kbd-trigger"
                onClick={onOpenCommandPalette}
                title="Tìm nhanh mục quản trị (Ctrl+K)"
              >
                <Search size={13} color="var(--color-text-dim)" />
                <span>Tìm nhanh</span>
                <span className="admin-kbd-hint">Ctrl K</span>
              </button>
            )}

            <ThemeToggle compact />

            <button
              type="button"
              className="admin-icon-btn"
              onClick={refreshAllData}
              disabled={isRefreshing}
              title="Làm mới dữ liệu"
              aria-label="Làm mới dữ liệu"
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin-animation' : ''} />
            </button>
          </div>
        </header>

        {/* Split-Pane Workbench: Main Workspace + Docked Spatial Inspector */}
        <div className="admin-workbench">
          <div className="admin-workbench-main">
            {/* Workspace Content Canvas */}
            <div className="admin-workspace">
              {/* Borderless Editorial Page Header */}
              <div className="admin-page-head">
                <div>
                  <h1 className="admin-page-title">{sectionTitles[effectiveSection].title}</h1>
                  <p className="admin-page-subtitle">{sectionTitles[effectiveSection].subtitle}</p>
                </div>

                <div className="admin-page-actions">
                  {effectiveSection === 'trails' && isStrictAdmin && (
                    <button
                      type="button"
                      className="admin-btn admin-btn--primary"
                      onClick={handleOpenCreateTrail}
                    >
                      <IconPlus size={14} />
                      <span>Thêm cung đường</span>
                    </button>
                  )}

                  {effectiveSection === 'contributions' && (
                    <button
                      type="button"
                      className="admin-btn admin-btn--primary"
                      onClick={handleOpenContributeWizard}
                    >
                      <IconPlus size={14} />
                      <span>Đóng góp mới</span>
                    </button>
                  )}

                  {effectiveSection === 'audit' && isStrictAdmin && (
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => void fetchAuditLogs()}
                    >
                      <RefreshCw size={13} />
                      <span>Tải lại nhật ký</span>
                    </button>
                  )}
                </div>
              </div>

              {accessNotice && (
                <div className="admin-notice" role="alert">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={15} color="var(--color-error-text, var(--color-error))" />
                    {accessNotice}
                  </span>
                  <button
                    type="button"
                    className="admin-icon-btn"
                    onClick={() => setAccessNotice('')}
                    aria-label="Đóng thông báo quyền"
                    style={{ border: 'none', width: 24, height: 24 }}
                  >
                    <IconX size={14} />
                  </button>
                </div>
              )}

              {sectionErrors[effectiveSection] && (
                <div className="admin-notice" role="alert">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={15} color="var(--color-error-text, var(--color-error))" />
                    {sectionErrors[effectiveSection]}
                  </span>
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm"
                    onClick={() => retrySection(effectiveSection)}
                  >
                    <RefreshCw size={12} />
                    <span>Thử tải lại</span>
                  </button>
                </div>
              )}

              <div key={effectiveSection} className="tab-content-slide admin-section-block">
                {/* =========================================================================
                 * SECTION 0: TRỰC VẬN HÀNH (COMMAND DECK)
                 * ========================================================================= */}
                {effectiveSection === 'overview' && (
                  <AdminCommandDeck
                    trails={cockpitTrails}
                    incidents={cockpitIncidents}
                    beacons={cockpitBeacons}
                    pendingContributions={cockpitPendingContributions}
                    overdueTimers={cockpitOverdueTimers}
                    triageItems={cockpitTriageItems}
                    stats={commandDeckStats}
                    selectedId={selectedInspectorId}
                    onSelect={handleSelectInspector}
                    onNavigateSection={handleSelectSection}
                    onPointerCoordChange={emitHoverCoords}
                    onOpenContributeWizard={handleOpenContributeWizard}
                    onOpenCreateTrail={isStrictAdmin ? handleOpenCreateTrail : undefined}
                    isStrictAdmin={isStrictAdmin}
                  />
                )}

                {/* =========================================================================
                 * SECTION 1: DUYỆT ĐÓNG GÓP (CONTRIBUTIONS)
                 * ========================================================================= */}
            {effectiveSection === 'contributions' && (() => {
              const validContribCount = contributions.filter(hasValidVnCoords).length;
              const validContribPercent =
                contributions.length > 0
                  ? Math.round((validContribCount / contributions.length) * 100)
                  : null;
              const catalogTrailsCount = loadedSections.has('trails')
                ? trailsList.length
                : (adminStats?.totalTrails ?? trailsList.length);

              return (
                <>
                  <div className="admin-metric-ribbon">
                    <div className="admin-metric-cell">
                      <span className="admin-metric-label">Chờ duyệt</span>
                      <div className="admin-metric-value-row">
                        <span
                          className={`admin-metric-value ${pendingContributions.length > 0 ? 'admin-metric-value--warn' : ''}`}
                        >
                          {pendingContributions.length}
                        </span>
                        <span className="admin-metric-unit">hồ sơ</span>
                      </div>
                      <span className="admin-metric-caption">Cần kiểm tra tọa độ &amp; thông số</span>
                    </div>

                    <div className="admin-metric-cell">
                      <span className="admin-metric-label">Đã duyệt</span>
                      <div className="admin-metric-value-row">
                        <span className="admin-metric-value admin-metric-value--primary">
                          {approvedContributions.length}
                        </span>
                        <span className="admin-metric-unit">/ {contributions.length} đóng góp</span>
                      </div>
                      <span className="admin-metric-caption">Đang hiển thị trên bản đồ</span>
                    </div>

                    <div className="admin-metric-cell">
                      <span className="admin-metric-label">Cung đường hiện có</span>
                      <div className="admin-metric-value-row">
                        <span className="admin-metric-value">{catalogTrailsCount}</span>
                        <span className="admin-metric-unit">cung đường</span>
                      </div>
                      <span className="admin-metric-caption">Đang hiển thị công khai trên LOST</span>
                    </div>

                    <div className="admin-metric-cell">
                      <span className="admin-metric-label">Tọa độ hợp lệ</span>
                      <div className="admin-metric-value-row">
                        <span className="admin-metric-value">
                          {validContribPercent !== null ? `${validContribPercent}%` : '—'}
                        </span>
                        <span className="admin-metric-unit">GPS VN</span>
                      </div>
                      <span className="admin-metric-caption">
                        {validContribCount}/{contributions.length} bài đóng góp có tọa độ hợp lệ
                      </span>
                    </div>
                  </div>

                  {/* Flush Underline Tabs + Search */}
                  <div className="admin-toolbar">
                    <div className="admin-tabs" role="tablist" aria-label="Trạng thái đóng góp">
                      {(
                        [
                          { id: 'pending', label: 'Chờ duyệt', count: pendingContributions.length },
                          { id: 'approved', label: 'Đã công khai', count: approvedContributions.length },
                          { id: 'rejected', label: 'Đã từ chối', count: rejectedContributions.length },
                          { id: 'all', label: 'Tất cả', count: contributions.length },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={activeTab === tab.id}
                          className={`admin-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                          onClick={() => setActiveTab(tab.id)}
                        >
                          <span>{tab.label}</span>
                          <span className="admin-tab-count">{tab.count}</span>
                        </button>
                      ))}
                    </div>

                    <div className="admin-search">
                      <Search size={14} color="var(--color-text-dim)" />
                      <input
                        type="text"
                        placeholder="Tìm tên cung, tác giả, tỉnh thành..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-text-dim)',
                            cursor: 'pointer',
                            display: 'flex',
                            padding: 2,
                          }}
                          aria-label="Xóa tìm kiếm"
                        >
                          <IconX size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Contributions Ledger (stable key avoids remounting on every search keystroke) */}
                  <div key={activeTab} className="admin-ledger tab-content-slide">
                    {displayedContributions.length === 0 ? (
                      <div className="admin-empty">
                        <div className="admin-empty-icon" aria-hidden="true">
                          <Inbox size={18} />
                        </div>
                        <h3 className="admin-empty-title">
                          {searchQuery
                            ? 'Không tìm thấy đóng góp phù hợp'
                            : activeTab === 'pending'
                              ? 'Không còn bài đóng góp chờ duyệt'
                              : 'Chưa có bài đóng góp trong mục này'}
                        </h3>
                        <p className="admin-empty-desc">
                          {searchQuery
                            ? `Không có hồ sơ nào khớp với từ khóa "${searchQuery}".`
                            : activeTab === 'pending'
                              ? 'Toàn bộ đóng góp từ cộng đồng đã được kiểm tra và xử lý xong.'
                              : 'Các đóng góp mới từ thành viên sẽ tự động xuất hiện tại đây.'}
                        </p>
                        <div className="admin-empty-actions">
                          {activeTab === 'pending' && approvedContributions.length > 0 && (
                            <button
                              type="button"
                              className="admin-btn admin-btn--primary"
                              onClick={() => setActiveTab('approved')}
                            >
                              Xem đã công khai ({approvedContributions.length})
                            </button>
                          )}
                          {searchQuery ? (
                            <button
                              type="button"
                              className="admin-btn admin-btn--ghost"
                              onClick={() => setSearchQuery('')}
                            >
                              Xóa bộ lọc
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="admin-btn admin-btn--ghost"
                              onClick={handleOpenContributeWizard}
                            >
                              Gửi cung đường mới
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      displayedContributions.map((contrib) => {
                        const contribId = String(contrib.id || contrib._id || '');
                        const nearbyPublished = nearbyTrailByContributionId.get(contribId);
                        const isRowSelected =
                          liveInspectorSelection?.kind === 'contribution' &&
                          liveInspectorSelection.data.id === contribId;
                        const statusDot =
                          contrib.status === 'approved'
                            ? 'admin-dot admin-dot--ok'
                            : contrib.status === 'rejected'
                              ? 'admin-dot admin-dot--danger'
                              : 'admin-dot admin-dot--warn';
                        const statusLabel =
                          contrib.status === 'approved'
                            ? 'Đã công khai'
                            : contrib.status === 'rejected'
                              ? 'Đã từ chối'
                              : 'Chờ duyệt';

                        return (
                          <article
                            key={contribId}
                            className={`admin-ledger-row admin-ledger-row--center admin-ledger-row--selectable ${isRowSelected ? 'is-selected' : ''}`}
                            onClick={() => {
                              const mapped = cockpitContributionsById.get(contribId);
                              if (mapped) setInspectorSelection({ kind: 'contribution', data: mapped });
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 14,
                                flex: 1,
                                minWidth: 'min(260px, 100%)',
                              }}
                            >
                              <img
                                loading="lazy"
                                decoding="async"
                                src={contrib.coverImage || DEFAULT_TRAIL_COVER}
                                alt={contrib.name || 'Cung đường đóng góp'}
                                className="admin-thumb"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = DEFAULT_TRAIL_COVER;
                                }}
                              />
                              <div className="admin-ledger-main">
                                <div className="admin-ledger-title-line">
                                  <span className="admin-ledger-title">
                                    {contrib.name || 'Cung đường trekking mới'}
                                  </span>
                                  <span className="admin-tag">{contrib.region || 'Việt Nam'}</span>
                                  <span className="admin-status">
                                    <span className={statusDot} aria-hidden="true" />
                                    {statusLabel}
                                  </span>
                                </div>
                                {nearbyPublished && (
                                  <div style={{ marginTop: 4 }}>
                                    <span className="admin-tag admin-tag--warn">
                                      <AlertTriangle size={11} />
                                      <span>
                                        {`Gần tuyến ${nearbyPublished.trailName} (~${nearbyPublished.distanceKm.toFixed(1)} km) — kiểm tra trùng lặp`}
                                      </span>
                                    </span>
                                  </div>
                                )}
                                <div className="admin-ledger-meta">
                                  <span>
                                    {contrib.hamlet ? `${contrib.hamlet}, ` : ''}
                                    {contrib.district ? `${contrib.district}, ` : ''}
                                    {contrib.province || 'Chưa rõ tỉnh'}
                                  </span>
                                  <span>·</span>
                                  <strong>{contrib.distanceKm} km</strong>
                                  <span>·</span>
                                  <strong>+{contrib.elevationGainM}m</strong>
                                  <span>·</span>
                                  <span>{contrib.durationHoursNote || '1 ngày'}</span>
                                  <span>·</span>
                                  <span>
                                    Gửi bởi{' '}
                                    <strong>
                                      {contrib.authorName || contrib.authorEmail || 'Cộng đồng'}
                                    </strong>{' '}
                                    ({formatDateVi(contrib.createdAt)})
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div
                              className="admin-ledger-actions"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="admin-btn admin-btn--sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedContribution(contrib);
                                }}
                              >
                                <Eye size={13} />
                                <span>Chi tiết</span>
                              </button>
                              {contrib.status !== 'approved' && (
                                <button
                                  type="button"
                                  className="admin-btn admin-btn--sm admin-btn--primary"
                                  disabled={Boolean(busyActions[`approve:${contribId}`])}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprove(contribId, contrib.name || '');
                                  }}
                                >
                                  <CheckCircle2 size={13} />
                                  <span>Duyệt</span>
                                </button>
                              )}
                              {contrib.status === 'pending' && (
                                <button
                                  type="button"
                                  className="admin-btn admin-btn--sm admin-btn--warn-ghost"
                                  disabled={Boolean(busyActions[`reject:${contribId}`])}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReject(contribId, contrib.name || '');
                                  }}
                                  title="Từ chối bài đóng góp"
                                  aria-label="Từ chối bài đóng góp"
                                >
                                  <XCircle size={13} />
                                </button>
                              )}
                              {(contrib.status !== 'approved' || isStrictAdmin) && (
                                <button
                                  type="button"
                                  className="admin-btn admin-btn--sm admin-btn--danger-ghost"
                                  disabled={Boolean(busyActions[`delete-contrib:${contribId}`])}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteContribution(
                                      contribId,
                                      contrib.name || '',
                                      contrib.status
                                    );
                                  }}
                                  title={
                                    contrib.status === 'approved'
                                      ? 'Xóa đóng góp đã công khai (đồng thời gỡ cung đường khỏi bản đồ)'
                                      : 'Xóa vĩnh viễn bài đóng góp'
                                  }
                                  aria-label="Xóa bài đóng góp"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </>
              );
            })()}

            {/* =========================================================================
             * SECTION 2: QUẢN LÝ CUNG ĐƯỜNG (TRAILS)
             * ========================================================================= */}
            {effectiveSection === 'trails' && (
              <>
                <div className="admin-toolbar">
                  <div className="admin-subhead" style={{ paddingBottom: 9 }}>
                    <h2 className="admin-subhead-title">
                      <span>Danh sách cung đường</span>
                      <span className="admin-subhead-count">
                        {filteredTrails.length} / {trailsList.length}
                      </span>
                    </h2>
                    {!isStrictAdmin && (
                      <span className="admin-tag admin-tag--info">
                        Chỉ xem · cần quyền quản trị để sửa
                      </span>
                    )}
                  </div>

                  <div className="admin-search">
                    <Search size={14} color="var(--color-text-dim)" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên cung, tỉnh hoặc huyện..."
                      value={trailSearchQuery}
                      onChange={(e) => setTrailSearchQuery(e.target.value)}
                    />
                    {trailSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setTrailSearchQuery('')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-text-dim)',
                          cursor: 'pointer',
                          display: 'flex',
                          padding: 2,
                        }}
                        aria-label="Xóa lọc cung đường"
                      >
                        <IconX size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {recentlyHiddenTrails.length > 0 && (
                  <div className="admin-note-box admin-note-box--warn" style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                        marginBottom: 8,
                      }}
                    >
                      <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={14} color="var(--color-earth)" />
                        <span>
                          Vừa ẩn khỏi danh mục công khai trong phiên này ({recentlyHiddenTrails.length})
                        </span>
                      </strong>
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm admin-btn--ghost"
                        onClick={() => setRecentlyHiddenTrails([])}
                      >
                        Ẩn thông báo
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {recentlyHiddenTrails.map((hidden) => {
                        const hid = String(hidden._id || hidden.id || '');
                        return (
                          <div
                            key={hid}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10,
                              flexWrap: 'wrap',
                              padding: '6px 8px',
                              borderRadius: 4,
                              background: 'var(--color-bg-card)',
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <strong style={{ color: 'var(--color-text-main)' }}>{hidden.name}</strong>
                              <span className="admin-tag">
                                {hidden.province} · {hidden.region}
                              </span>
                              <span
                                className={
                                  hidden.status === 'rejected'
                                    ? 'admin-tag admin-tag--danger'
                                    : 'admin-tag admin-tag--warn'
                                }
                              >
                                {hidden.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt (ẩn)'}
                              </span>
                            </div>
                            {isStrictAdmin && (
                              <button
                                type="button"
                                className="admin-btn admin-btn--sm admin-btn--primary"
                                onClick={() => openEditTrailModal(hidden)}
                              >
                                Chỉnh sửa / Công khai lại
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="admin-ledger">
                  {filteredTrails.length === 0 ? (
                    <div className="admin-empty">
                      <div className="admin-empty-icon" aria-hidden="true">
                        <Layers size={18} />
                      </div>
                      <h3 className="admin-empty-title">Không tìm thấy cung đường phù hợp</h3>
                      <p className="admin-empty-desc">
                        Thử điều chỉnh từ khóa tìm kiếm theo tên đỉnh núi hoặc tỉnh thành.
                      </p>
                    </div>
                  ) : (
                    filteredTrails.map((trail) => {
                      const trailId = String(trail._id || trail.id || '');
                      const isRowSelected =
                        liveInspectorSelection?.kind === 'trail' &&
                        liveInspectorSelection.data.id === trailId;

                      return (
                      <div
                        key={trailId}
                        className={`admin-ledger-row admin-ledger-row--center admin-ledger-row--selectable ${isRowSelected ? 'is-selected' : ''}`}
                        onClick={() => {
                          const mapped = cockpitTrailsById.get(trailId);
                          if (mapped) setInspectorSelection({ kind: 'trail', data: mapped });
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            flex: 1,
                            minWidth: 'min(260px, 100%)',
                          }}
                        >
                          <img
                            loading="lazy"
                            decoding="async"
                            src={trail.coverImage || DEFAULT_TRAIL_COVER}
                            alt={trail.name}
                            className="admin-thumb"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = DEFAULT_TRAIL_COVER;
                            }}
                          />
                          <div className="admin-ledger-main">
                            <div className="admin-ledger-title-line">
                              <span className="admin-ledger-title">{trail.name}</span>
                              <span className="admin-tag">{trail.region}</span>
                              {trail.status && trail.status !== 'approved' && (
                                <span
                                  className={
                                    trail.status === 'rejected'
                                      ? 'admin-tag admin-tag--danger'
                                      : 'admin-tag admin-tag--warn'
                                  }
                                >
                                  {trail.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                                </span>
                              )}
                            </div>
                            <div className="admin-ledger-meta">
                              <span>
                                {trail.district ? `${trail.district}, ` : ''}
                                {trail.province}
                              </span>
                              <span>·</span>
                              <strong>{trail.distanceKm} km</strong>
                              <span>·</span>
                              <span>+{trail.elevationGainM}m</span>
                              <span>·</span>
                              <span>Đỉnh {trail.maxAltitudeM}m</span>
                              <span>·</span>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                              >
                                <IconStar size={11} color="var(--color-earth)" />
                                <strong>
                                  {trail.reviewCount ? Number(trail.rating || 0).toFixed(1) : 'Mới'}
                                </strong>
                                <span>({trail.reviewCount || 0})</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {isStrictAdmin && (
                          <div
                            className="admin-ledger-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditTrailModal(trail);
                              }}
                            >
                              Chỉnh sửa
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm admin-btn--danger-ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTrail(trailId, trail.name || '');
                              }}
                            >
                              Xóa
                            </button>
                          </div>
                        )}
                      </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {/* =========================================================================
             * SECTION 3: QUẢN LÝ SỰ CỐ & CỨU HỘ (INCIDENTS)
             * ========================================================================= */}
            {effectiveSection === 'incidents' && (
              <>
                <div className="admin-toolbar">
                  <div className="admin-tabs" role="tablist" aria-label="Bộ lọc sự cố">
                    {(
                      [
                        { id: 'active', label: 'Đang cảnh báo', count: activeIncidents.length },
                        { id: 'resolved', label: 'Đã xử lý', count: resolvedIncidents.length },
                        { id: 'all', label: 'Tất cả', count: incidentsList.length },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={incidentFilter === tab.id}
                        className={`admin-tab-btn ${incidentFilter === tab.id ? 'active' : ''}`}
                        onClick={() => setIncidentFilter(tab.id)}
                      >
                        <span>{tab.label}</span>
                        <span className="admin-tab-count">{tab.count}</span>
                      </button>
                    ))}
                  </div>

                  <div className="admin-search">
                    <Search size={14} color="var(--color-text-dim)" />
                    <input
                      type="text"
                      placeholder="Tìm theo cung đường, mô tả, vị trí, người báo..."
                      value={incidentSearchQuery}
                      onChange={(e) => setIncidentSearchQuery(e.target.value)}
                    />
                    {incidentSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setIncidentSearchQuery('')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-text-dim)',
                          cursor: 'pointer',
                          display: 'flex',
                          padding: 2,
                        }}
                        aria-label="Xóa tìm kiếm sự cố"
                      >
                        <IconX size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="admin-ledger">
                  {displayedIncidents.length === 0 ? (
                    <div className="admin-empty">
                      <div className="admin-empty-icon" aria-hidden="true">
                        <AlertTriangle size={18} />
                      </div>
                      <h3 className="admin-empty-title">
                        {incidentFilter === 'resolved'
                          ? 'Chưa có sự cố nào được xử lý'
                          : 'Không có cảnh báo sự cố trong mục này'}
                      </h3>
                      <p className="admin-empty-desc">
                        Các tin báo thực địa và cảnh báo thời tiết cực đoan sẽ hiển thị tại đây.
                      </p>
                    </div>
                  ) : (
                    displayedIncidents.map((inc) => {
                      const incId = String(inc._id || inc.id || '');
                      const isRowSelected =
                        liveInspectorSelection?.kind === 'incident' &&
                        liveInspectorSelection.data.id === incId;
                      const synthetic = isSyntheticIncident(inc);
                      const reporterId = extractEntityId(inc.reportedBy);
                      const isCritical = !synthetic && !inc.resolved && inc.severity === 'critical';
                      const sevTagClass =
                        inc.severity === 'critical'
                          ? 'admin-tag admin-tag--danger'
                          : inc.severity === 'high'
                            ? 'admin-tag admin-tag--warn'
                            : 'admin-tag admin-tag--info';

                      return (
                        <div
                          key={incId}
                          className={`admin-ledger-row admin-ledger-row--selectable ${isCritical ? 'admin-ledger-row--urgent' : ''} ${isRowSelected ? 'is-selected' : ''}`}
                          onClick={() => {
                            const mapped = cockpitIncidentsById.get(incId);
                            if (mapped) setInspectorSelection({ kind: 'incident', data: mapped });
                          }}
                        >
                          <div className="admin-ledger-main">
                            <div className="admin-ledger-title-line">
                              <span className={sevTagClass}>
                                {getSeverityLabelVi(inc.severity)}
                              </span>
                              <span className="admin-ledger-title">
                                {inc.trailName ||
                                  (
                                    {
                                      landslide: 'Sạt lở đất đá',
                                      flash_flood: 'Lũ quét / Nước dâng',
                                      flood: 'Lũ lụt / Ngập suối',
                                      bad_weather: 'Thời tiết cực đoan',
                                      weather: 'Thời tiết xấu',
                                      lost: 'Lạc đường cần hỗ trợ',
                                      wildlife: 'Động vật hoang dã',
                                      other: 'Sự cố thực địa',
                                    } as Record<string, string>
                                  )[String(inc.type || '')] ||
                                  'Cảnh báo trên tuyến'}
                              </span>
                              {synthetic ? (
                                <span className="admin-tag admin-tag--info">
                                  <IconSatellite size={11} /> Vệ tinh · chỉ đọc
                                </span>
                              ) : inc.resolved ? (
                                <span className="admin-status">
                                  <span className="admin-dot admin-dot--ok" aria-hidden="true" />
                                  Đã xử lý
                                </span>
                              ) : (
                                <span className="admin-status">
                                  <span className="admin-dot admin-dot--danger" aria-hidden="true" />
                                  Đang cảnh báo
                                </span>
                              )}
                            </div>

                            <p className="admin-ledger-desc">{inc.description}</p>

                            <div className="admin-ledger-meta">
                              <span>
                                {synthetic ? 'Nguồn dữ liệu:' : 'Người báo tin:'}{' '}
                                <strong>
                                  {inc.reporterName || inc.userName || inc.verifiedBy || 'Trekker'}
                                </strong>
                              </span>
                              {inc.reporterEmail && <span>· {inc.reporterEmail}</span>}
                              <span>· {formatDateVi(inc.reportedAt || inc.createdAt)}</span>
                              {inc.locationNote && <span>· Vị trí: {inc.locationNote}</span>}
                              {inc.confirmations && inc.confirmations > 1 && (
                                <span className="admin-tag admin-tag--warn">
                                  {inc.confirmations} xác thực
                                </span>
                              )}
                            </div>

                            {!synthetic && Array.isArray(inc.disputes) && inc.disputes.length > 0 && (
                              <div
                                className="admin-note-box admin-note-box--danger"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    fontWeight: 600,
                                    marginBottom: 6,
                                  }}
                                >
                                  <AlertTriangle size={13} />
                                  <span>
                                    Phản hồi từ cộng đồng: {inc.disputes.length} ý kiến cho rằng tin chưa đúng
                                  </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {inc.disputes.map((d: AdminIncidentDispute, idx: number) => (
                                    <div key={idx} style={{ color: 'var(--color-text-main)' }}>
                                      · <strong>{d.userName || 'Trekker'}</strong> (
                                      {formatDateVi(d.disputedAt)}): &ldquo;{d.reason}&rdquo;
                                    </div>
                                  ))}
                                </div>
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: 8,
                                    marginTop: 10,
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn--sm admin-btn--primary"
                                    disabled={Boolean(busyActions[`dispute:${incId}`])}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleResolveDispute(incId, 'dismiss_incident');
                                    }}
                                  >
                                    <CheckCircle2 size={13} /> Gỡ cảnh báo
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn--sm admin-btn--danger-ghost"
                                    disabled={Boolean(busyActions[`dispute:${incId}`])}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleResolveDispute(incId, 'reject_dispute');
                                    }}
                                  >
                                    <XCircle size={13} /> Giữ cảnh báo
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {!synthetic && (
                            <div
                              className="admin-ledger-actions"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {!inc.resolved && (
                                <button
                                  type="button"
                                  className="admin-btn admin-btn--sm admin-btn--primary"
                                  disabled={Boolean(busyActions[`resolve:${incId}`])}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResolveIncident(incId);
                                  }}
                                >
                                  Gỡ cảnh báo
                                </button>
                              )}
                              {isStrictAdmin && reporterId && (
                                <button
                                  type="button"
                                  className="admin-btn admin-btn--sm admin-btn--warn-ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBanUser(
                                      reporterId,
                                      inc.reporterEmail || inc.reporterName || 'Tài khoản báo tin'
                                    );
                                  }}
                                  title="Khóa tài khoản nếu cố tình báo tin giả"
                                >
                                  Khóa tài khoản
                                </button>
                              )}
                              <button
                                type="button"
                                className="admin-btn admin-btn--sm admin-btn--danger-ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteIncident(incId);
                                }}
                              >
                                Xóa
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {/* =========================================================================
             * SECTION 4: QUẢN LÝ NGƯỜI DÙNG & PHÂN QUYỀN (USERS - ADMIN ONLY)
             * ========================================================================= */}
            {effectiveSection === 'users' && isStrictAdmin && (() => {
              const roleCounts = userRoleCounts;
              const userFilterTabs: { id: typeof userRoleFilter; label: string; count: number }[] = [
                { id: 'all', label: 'Tất cả', count: roleCounts.all },
                { id: 'admin', label: 'Quản trị', count: roleCounts.admin },
                { id: 'moderator', label: 'Điều hành', count: roleCounts.moderator },
                { id: 'guide', label: 'HDV', count: roleCounts.guide },
                { id: 'user', label: 'Thành viên', count: roleCounts.user },
                { id: 'banned', label: 'Đã khóa', count: roleCounts.banned },
              ];

              return (
                <>
                  <div className="admin-toolbar">
                    <div className="admin-tabs" role="tablist" aria-label="Lọc vai trò thành viên">
                      {userFilterTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={userRoleFilter === tab.id}
                          className={`admin-tab-btn ${userRoleFilter === tab.id ? 'active' : ''}`}
                          onClick={() => setUserRoleFilter(tab.id)}
                        >
                          <span>{tab.label}</span>
                          <span className="admin-tab-count">{tab.count}</span>
                        </button>
                      ))}
                    </div>

                    <div className="admin-search">
                      <Search size={14} color="var(--color-text-dim)" />
                      <input
                        type="text"
                        placeholder="Tìm theo tên, tên đăng nhập, email..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                      />
                      {userSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setUserSearchQuery('')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-text-dim)',
                            cursor: 'pointer',
                            display: 'flex',
                            padding: 2,
                          }}
                          aria-label="Xóa tìm kiếm thành viên"
                        >
                          <IconX size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="admin-ledger">
                    {filteredUsers.length === 0 ? (
                      <div className="admin-empty">
                        <div className="admin-empty-icon" aria-hidden="true">
                          <Users size={18} />
                        </div>
                        <h3 className="admin-empty-title">Không tìm thấy thành viên phù hợp</h3>
                        <p className="admin-empty-desc">
                          Thử đổi bộ lọc vai trò hoặc nhập lại email/tên tài khoản.
                        </p>
                      </div>
                    ) : (
                      filteredUsers.map((u) => {
                        const uid = String(u._id || u.id || '');
                        const isSelf = Boolean(
                          (currentUserId && uid && uid === currentUserId) ||
                            (!currentUserId &&
                              currentUser?.email &&
                              u.email &&
                              currentUser.email.trim().toLowerCase() ===
                                u.email.trim().toLowerCase())
                        );
                        const isRowSelected =
                          liveInspectorSelection?.kind === 'user' &&
                          liveInspectorSelection.data.id === uid;
                        return (
                          <div
                            key={uid}
                            className={`admin-ledger-row admin-ledger-row--center admin-ledger-row--selectable ${u.isBanned ? 'admin-ledger-row--urgent' : ''} ${isRowSelected ? 'is-selected' : ''}`}
                            onClick={() => {
                              const mapped = cockpitUsersById.get(uid);
                              if (mapped) setInspectorSelection({ kind: 'user', data: mapped });
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                flex: 1,
                                minWidth: 'min(260px, 100%)',
                              }}
                            >
                              <img
                                loading="lazy"
                                decoding="async"
                                src={u.avatarUrl || DEFAULT_AVATAR}
                                alt={u.fullName || u.username}
                                className="admin-avatar-sm"
                              />
                              <div className="admin-ledger-main">
                                <div className="admin-ledger-title-line">
                                  <span className="admin-ledger-title">
                                    {u.fullName || u.username}
                                  </span>
                                  {u.role === 'admin' && (
                                    <span className="admin-tag admin-tag--warn">Quản trị</span>
                                  )}
                                  {u.role === 'moderator' && (
                                    <span className="admin-tag admin-tag--info">Điều hành</span>
                                  )}
                                  {u.role === 'guide' && (
                                    <span className="admin-tag admin-tag--ok">
                                      <ShieldCheck size={10} /> HDV
                                    </span>
                                  )}
                                  {u.isBanned && (
                                    <span className="admin-tag admin-tag--danger">Đã khóa</span>
                                  )}
                                </div>
                                <div className="admin-ledger-meta">
                                  <span>{u.email}</span>
                                  <span>·</span>
                                  <span>
                                    Uy tín <strong>{u.reputationScore ?? 0}</strong> điểm
                                  </span>
                                  <span>·</span>
                                  <span>{u.badges?.join(', ') || 'Thành viên mới'}</span>
                                </div>
                                {u.isBanned && (
                                  <div className="admin-note-box admin-note-box--danger">
                                    Lý do khóa:{' '}
                                    <strong>
                                      {u.banReason || 'Vi phạm quy định cộng đồng LOST'}
                                    </strong>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div
                              className="admin-ledger-actions"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <select
                                className="form-select"
                                aria-label={`Phân quyền cho ${u.fullName || u.email}`}
                                value={u.role || 'user'}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  handleUpdateRole(
                                    uid,
                                    e.target.value,
                                    u.fullName || u.email || '',
                                    u.role || 'user'
                                  )
                                }
                                disabled={isSelf || Boolean(busyActions[`role:${uid}`])}
                                title={
                                  isSelf
                                    ? 'Không thể tự thay đổi quyền tài khoản đang đăng nhập'
                                    : undefined
                                }
                                style={{
                                  height: 28,
                                  padding: '0 8px',
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                  borderRadius: 5,
                                }}
                              >
                                <option value="user">Thành viên</option>
                                <option value="guide">Hướng dẫn viên</option>
                                <option value="moderator">Điều hành viên</option>
                                <option value="admin">Quản trị viên</option>
                              </select>

                              {u.isBanned ? (
                                <button
                                  type="button"
                                  className="admin-btn admin-btn--sm admin-btn--primary"
                                  disabled={Boolean(busyActions[`unban:${uid}`])}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnbanUser(uid, u.email || '');
                                  }}
                                >
                                  Mở khóa
                                </button>
                              ) : !isSelf && u.role !== 'admin' ? (
                                <button
                                  type="button"
                                  className="admin-btn admin-btn--sm admin-btn--danger-ghost"
                                  disabled={Boolean(busyActions[`ban:${uid}`])}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBanUser(uid, u.email || u.fullName || '');
                                  }}
                                >
                                  Khóa
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              );
            })()}

            {/* =========================================================================
             * SECTION 5: KIỂM DUYỆT DIỄN ĐÀN (FORUM)
             * ========================================================================= */}
            {effectiveSection === 'forum' && (
              <>
                <div className="admin-toolbar">
                  <div className="admin-subhead" style={{ paddingBottom: 9 }}>
                    <h2 className="admin-subhead-title">
                      <span>Bài viết diễn đàn</span>
                      <span className="admin-subhead-count">
                        {filteredThreads.length} / {threadsList.length}
                      </span>
                    </h2>
                  </div>

                  <div className="admin-search">
                    <Search size={14} color="var(--color-text-dim)" />
                    <input
                      type="text"
                      placeholder="Tìm tiêu đề, chuyên mục, tác giả..."
                      value={forumSearchQuery}
                      onChange={(e) => setForumSearchQuery(e.target.value)}
                    />
                    {forumSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setForumSearchQuery('')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-text-dim)',
                          cursor: 'pointer',
                          display: 'flex',
                          padding: 2,
                        }}
                        aria-label="Xóa tìm kiếm diễn đàn"
                      >
                        <IconX size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="admin-ledger">
                  {filteredThreads.length === 0 ? (
                    <div className="admin-empty">
                      <div className="admin-empty-icon" aria-hidden="true">
                        <MessageSquare size={18} />
                      </div>
                      <h3 className="admin-empty-title">
                        {forumSearchQuery
                          ? 'Không tìm thấy bài viết phù hợp'
                          : 'Chưa có bài viết nào trên diễn đàn'}
                      </h3>
                      <p className="admin-empty-desc">
                        {forumSearchQuery
                          ? `Không có bài viết nào khớp với "${forumSearchQuery}".`
                          : 'Bài thảo luận và tìm bạn đồng hành mới sẽ hiển thị tại đây để kiểm duyệt.'}
                      </p>
                    </div>
                  ) : (
                    filteredThreads.map((t) => {
                      const tid = String(t.id || t._id || '');
                      return (
                        <div key={tid} className="admin-ledger-row admin-ledger-row--center">
                          <div className="admin-ledger-main">
                            <div className="admin-ledger-title-line">
                              {t.isPinned && (
                                <span className="admin-tag admin-tag--warn">
                                  <IconPin size={10} color="var(--color-earth)" /> Ghim
                                </span>
                              )}
                              {t.isLocked && (
                                <span className="admin-tag admin-tag--danger">
                                  <IconLock size={10} color="var(--color-error)" /> Khóa
                                </span>
                              )}
                              <span className="admin-tag">{t.category || 'Thảo luận'}</span>
                              <span className="admin-ledger-title">{t.title}</span>
                            </div>
                            <div className="admin-ledger-meta">
                              <span>
                                Tác giả: <strong>{t.authorName}</strong>
                              </span>
                              <span>· {t.repliesCount || 0} bình luận</span>
                              <span>· {t.upvotes || 0} lượt thích</span>
                              <span>· {formatDateVi(t.createdAt)}</span>
                            </div>
                          </div>

                          <div className="admin-ledger-actions">
                            <button
                              type="button"
                              className={`admin-btn admin-btn--sm ${t.isPinned ? 'admin-btn--primary' : ''}`}
                              disabled={Boolean(busyActions[`pin:${tid}`])}
                              onClick={() => void handlePinThread(tid)}
                            >
                              <IconPin size={12} color="currentColor" />
                              <span>{t.isPinned ? 'Bỏ ghim' : 'Ghim'}</span>
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm admin-btn--warn-ghost"
                              disabled={Boolean(busyActions[`lock:${tid}`])}
                              onClick={() => void handleLockThread(tid)}
                            >
                              {!t.isLocked && <IconLock size={12} color="currentColor" />}
                              <span>{t.isLocked ? 'Mở khóa' : 'Khóa'}</span>
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm admin-btn--danger-ghost"
                              onClick={() => handleDeleteThread(tid, t.title || '')}
                            >
                              <IconTrash size={12} color="currentColor" />
                              <span>Xóa</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {/* =========================================================================
             * SECTION 6: THỐNG KÊ TỔNG QUAN (ALL 12 BACKEND METRICS IN 3 DOMAINS)
             * ========================================================================= */}
            {effectiveSection === 'stats' && (() => {
              const statGroups: {
                title: string;
                items: {
                  key: string;
                  label: string;
                  value: number;
                  subtitle: string;
                  tone?: 'default' | 'primary' | 'warn' | 'danger';
                }[];
              }[] = [
                {
                  title: 'Bản đồ & cung đường',
                  items: [
                    {
                      key: 'totalTrails',
                      label: 'Cung đường công khai',
                      value: adminStats?.totalTrails ?? trailsList.length,
                      subtitle: 'Đang hiển thị trên bản đồ LOST',
                      tone: 'primary',
                    },
                    {
                      key: 'totalContributions',
                      label: 'Bài đóng góp',
                      value: adminStats?.totalContributions ?? contributions.length,
                      subtitle: 'Tất cả cung đường cộng đồng gửi lên',
                    },
                    {
                      key: 'pendingContributions',
                      label: 'Chờ duyệt',
                      value: adminStats?.pendingContributions ?? pendingContributions.length,
                      subtitle: 'Cần kiểm tra tọa độ và thông số',
                      tone:
                        (adminStats?.pendingContributions ?? pendingContributions.length) > 0
                          ? 'warn'
                          : 'default',
                    },
                    {
                      key: 'totalCheckins',
                      label: 'Lượt check-in đỉnh',
                      value: adminStats?.totalCheckins ?? 0,
                      subtitle: 'Số lần thành viên ghi dấu qua đỉnh',
                    },
                  ],
                },
                {
                  title: 'Cộng đồng & chia sẻ',
                  items: [
                    {
                      key: 'totalUsers',
                      label: 'Thành viên',
                      value: adminStats?.totalUsers ?? usersList.length,
                      subtitle: 'Tài khoản đã đăng ký trên LOST',
                    },
                    {
                      key: 'totalThreads',
                      label: 'Bài viết diễn đàn',
                      value: adminStats?.totalThreads ?? threadsList.length,
                      subtitle: 'Chủ đề trao đổi của cộng đồng',
                    },
                    {
                      key: 'totalReviews',
                      label: 'Đánh giá tuyến',
                      value: adminStats?.totalReviews ?? reviewsTotal,
                      subtitle: 'Nhận xét sau chuyến đi',
                    },
                    {
                      key: 'totalTripReports',
                      label: 'Nhật ký chuyến đi',
                      value: adminStats?.totalTripReports ?? 0,
                      subtitle: 'Bài kể chuyện và ảnh thực tế',
                    },
                  ],
                },
                {
                  title: 'An toàn & hỗ trợ',
                  items: [
                    {
                      key: 'totalIncidents',
                      label: 'Sự cố đang mở',
                      value: adminStats?.totalIncidents ?? activeIncidentsCount,
                      subtitle: 'Cảnh báo chưa được gỡ',
                      tone:
                        (adminStats?.totalIncidents ?? activeIncidentsCount) > 0
                          ? 'danger'
                          : 'default',
                    },
                    {
                      key: 'activeSafetyTimers',
                      label: 'Hẹn giờ báo bình an',
                      value:
                        adminStats?.activeSafetyTimers ??
                        activeTimersLiveCount,
                      subtitle: 'Lịch hẹn đang được theo dõi',
                      tone:
                        (adminStats?.activeSafetyTimers ?? activeTimersLiveCount) > 0
                          ? 'warn'
                          : 'default',
                    },
                    {
                      key: 'totalGuides',
                      label: 'Porter & HDV',
                      value: adminStats?.totalGuides ?? 0,
                      subtitle: 'Người dẫn đường bản địa đã xác thực',
                    },
                    {
                      key: 'totalTripPlans',
                      label: 'Chuyến ghép đoàn',
                      value: adminStats?.totalTripPlans ?? 0,
                      subtitle: 'Lịch trình đang tìm bạn đồng hành',
                    },
                  ],
                },
              ];

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                  {statGroups.map((group) => (
                    <section key={group.title} className="admin-section-block">
                      <div className="admin-subhead">
                        <h2 className="admin-subhead-title">{group.title}</h2>
                      </div>
                      <div className="admin-stats-matrix">
                        {group.items.map((item) => (
                          <div key={item.key} className="admin-stats-cell">
                            <span className="admin-stats-cell-label">{item.label}</span>
                            <span
                              className={
                                item.tone === 'danger'
                                  ? 'admin-stats-cell-val admin-metric-value--danger'
                                  : item.tone === 'warn'
                                    ? 'admin-stats-cell-val admin-metric-value--warn'
                                    : item.tone === 'primary'
                                      ? 'admin-stats-cell-val admin-metric-value--primary'
                                      : 'admin-stats-cell-val'
                              }
                            >
                              {item.value.toLocaleString('vi-VN')}
                            </span>
                            <span className="admin-stats-cell-sub">{item.subtitle}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              );
            })()}

            {/* =========================================================================
             * SECTION 7: NHẬT KÝ KIỂM TOÁN (AUDIT LOGS - ADMIN ONLY)
             * ========================================================================= */}
            {effectiveSection === 'audit' && isStrictAdmin && (
              <>
                <div className="admin-toolbar">
                  <div className="admin-subhead" style={{ paddingBottom: 9 }}>
                    <h2 className="admin-subhead-title">
                      <span>Lịch sử thao tác quản trị</span>
                      <span className="admin-subhead-count">
                        {filteredAuditLogs.length} / {auditLogs.length}
                      </span>
                    </h2>
                  </div>

                  <div className="admin-search">
                    <Search size={14} color="var(--color-text-dim)" />
                    <input
                      type="text"
                      placeholder="Tìm mã thao tác, chi tiết, người thực hiện, IP..."
                      value={auditSearchQuery}
                      onChange={(e) => setAuditSearchQuery(e.target.value)}
                    />
                    {auditSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setAuditSearchQuery('')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-text-dim)',
                          cursor: 'pointer',
                          display: 'flex',
                          padding: 2,
                        }}
                        aria-label="Xóa tìm kiếm nhật ký"
                      >
                        <IconX size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="admin-ledger">
                  {filteredAuditLogs.length === 0 ? (
                    <div className="admin-empty">
                      <div className="admin-empty-icon" aria-hidden="true">
                        <ShieldCheck size={18} />
                      </div>
                      <h3 className="admin-empty-title">
                        {auditSearchQuery
                          ? 'Không tìm thấy nhật ký thao tác phù hợp'
                          : 'Chưa có nhật ký thao tác'}
                      </h3>
                      <p className="admin-empty-desc">
                        {auditSearchQuery
                          ? `Không có bản ghi nào khớp với "${auditSearchQuery}".`
                          : 'Các thao tác sửa, xóa cung đường, đổi quyền hoặc khóa tài khoản sẽ tự động lưu tại đây.'}
                      </p>
                    </div>
                  ) : (
                    filteredAuditLogs.map((log: AdminAuditLogItem) => (
                      <div key={log._id} className="admin-ledger-row admin-ledger-row--center">
                        <div className="admin-ledger-main">
                          <div className="admin-ledger-title-line">
                            <code className="admin-code">{log.action}</code>
                            <span className="admin-tag">{log.targetCollection}</span>
                            <span className="admin-ledger-title">{log.details}</span>
                          </div>
                          <div className="admin-ledger-meta">
                            <span>
                              Thực hiện bởi:{' '}
                              <strong>
                                {log.userId?.fullName || log.userId?.email || 'Hệ thống'}
                              </strong>
                            </span>
                            <span>· IP: {log.ipAddress || 'N/A'}</span>
                          </div>
                        </div>
                        <span
                          className="admin-ledger-meta"
                          style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                        >
                          {formatDateVi(log.createdAt)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* =========================================================================
             * SECTION 8: ĐƠN ĐẶT PORTER / GUIDE (INQUIRIES)
             * ========================================================================= */}
            {effectiveSection === 'inquiries' && (() => {
              const statusCounts = inquiryStatusCounts;
              const inquiryTabs: { id: typeof inquiryStatusFilter; label: string; count: number }[] = [
                { id: 'all', label: 'Tất cả', count: statusCounts.all },
                { id: 'pending', label: 'Chờ xử lý', count: statusCounts.pending },
                { id: 'contacted', label: 'Đã liên hệ', count: statusCounts.contacted },
                { id: 'confirmed', label: 'Đã xác nhận', count: statusCounts.confirmed },
                { id: 'cancelled', label: 'Đã hủy', count: statusCounts.cancelled },
              ];

              return (
                <>
                  <div className="admin-toolbar">
                    <div className="admin-tabs" role="tablist" aria-label="Trạng thái yêu cầu Porter và HDV">
                      {inquiryTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={inquiryStatusFilter === tab.id}
                          className={`admin-tab-btn ${inquiryStatusFilter === tab.id ? 'active' : ''}`}
                          onClick={() => setInquiryStatusFilter(tab.id)}
                        >
                          <span>{tab.label}</span>
                          <span className="admin-tab-count">{tab.count}</span>
                        </button>
                      ))}
                    </div>

                    <div className="admin-search">
                      <Search size={14} color="var(--color-text-dim)" />
                      <input
                        type="text"
                        placeholder="Tìm khách, SĐT, HDV, cung đường..."
                        value={inquirySearchQuery}
                        onChange={(e) => setInquirySearchQuery(e.target.value)}
                      />
                      {inquirySearchQuery && (
                        <button
                          type="button"
                          onClick={() => setInquirySearchQuery('')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-text-dim)',
                            cursor: 'pointer',
                            display: 'flex',
                            padding: 2,
                          }}
                          aria-label="Xóa tìm kiếm đơn đặt"
                        >
                          <IconX size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="admin-ledger">
                    {filteredInquiries.length === 0 ? (
                      <div className="admin-empty">
                        <div className="admin-empty-icon" aria-hidden="true">
                          <IconBackpack size={18} />
                        </div>
                        <h3 className="admin-empty-title">Chưa có yêu cầu thuê Porter &amp; HDV nào</h3>
                        <p className="admin-empty-desc">
                          Yêu cầu thuê người dẫn đường bản địa từ thành viên sẽ hiển thị tại đây.
                        </p>
                      </div>
                    ) : (
                      filteredInquiries.map((inq) => {
                        const trekkerObj = typeof inq.userId === 'object' ? inq.userId : null;
                        const guideObj = typeof inq.guideId === 'object' ? inq.guideId : null;
                        const trailObj = typeof inq.trailId === 'object' ? inq.trailId : null;
                        const statusMeta = INQUIRY_STATUS_META[inq.status] || INQUIRY_STATUS_META.pending;
                        const statusDot =
                          inq.status === 'confirmed'
                            ? 'admin-dot admin-dot--ok'
                            : inq.status === 'cancelled'
                              ? 'admin-dot admin-dot--danger'
                              : inq.status === 'contacted'
                                ? 'admin-dot admin-dot--info'
                                : 'admin-dot admin-dot--warn';
                        const isBusy = updatingInquiryId === inq._id;

                        return (
                          <div key={inq._id} className="admin-ledger-row">
                            <div className="admin-ledger-main">
                              <div className="admin-ledger-title-line">
                                <span className="admin-status">
                                  <span className={statusDot} aria-hidden="true" />
                                  {statusMeta.label}
                                </span>
                                <span className="admin-ledger-title">
                                  {inq.trailName || trailObj?.name || 'Cung đường trekking'}
                                </span>
                                {trailObj?.province && (
                                  <span className="admin-tag">{trailObj.province}</span>
                                )}
                              </div>

                              <div className="admin-ledger-meta">
                                <span>
                                  Khách:{' '}
                                  <strong>
                                    {trekkerObj?.fullName || trekkerObj?.username || 'Trekker LOST'}
                                  </strong>
                                </span>
                                {inq.contactPhone && (
                                  <a
                                    href={`tel:${inq.contactPhone}`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      color: 'var(--color-primary)',
                                      fontWeight: 600,
                                      textDecoration: 'none',
                                    }}
                                  >
                                    <IconPhone size={11} /> {inq.contactPhone}
                                  </a>
                                )}
                                <span>
                                  · HDV: <strong>{guideObj?.name || 'HDV bản địa'}</strong>
                                  {guideObj?.phone ? ` (${guideObj.phone})` : ''}
                                </span>
                              </div>

                              <div className="admin-ledger-meta">
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <IconCalendar size={11} color="var(--color-text-dim)" />
                                  Khởi hành: <strong>{formatDateOnlyVi(inq.plannedStartDate)}</strong>
                                </span>
                                <span>· {inq.durationDays || 1} ngày</span>
                                <span>· {inq.groupSize || 1} người</span>
                                <span>· {inq.needPortersCount || 0} porter thêm</span>
                                <span>· Gửi {formatDateVi(inq.createdAt)}</span>
                              </div>

                              {inq.notes && (
                                <div className="admin-note-box">
                                  Ghi chú: &ldquo;{inq.notes}&rdquo;
                                </div>
                              )}
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                gap: 10,
                                flexShrink: 0,
                              }}
                            >
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>
                                  Dự toán
                                </div>
                                <div
                                  style={{
                                    fontSize: '0.95rem',
                                    fontWeight: 600,
                                    color: 'var(--color-text-main)',
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                >
                                  {(inq.estimatedTotalVnd || 0).toLocaleString('vi-VN')} đ
                                </div>
                              </div>

                              <div className="admin-ledger-actions">
                                {inq.status !== 'contacted' && inq.status !== 'confirmed' && (
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn--sm"
                                    disabled={isBusy}
                                    onClick={() => void handleUpdateInquiryStatus(inq._id, 'contacted')}
                                  >
                                    Đã liên hệ
                                  </button>
                                )}
                                {inq.status !== 'confirmed' && (
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn--sm admin-btn--primary"
                                    disabled={isBusy}
                                    onClick={() => void handleUpdateInquiryStatus(inq._id, 'confirmed')}
                                  >
                                    Xác nhận
                                  </button>
                                )}
                                {inq.status !== 'cancelled' && (
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn--sm admin-btn--danger-ghost"
                                    disabled={isBusy}
                                    onClick={() => void handleUpdateInquiryStatus(inq._id, 'cancelled')}
                                  >
                                    Hủy đơn
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              );
            })()}

            {/* =========================================================================
             * SECTION 9: AN TOÀN & TÍN HIỆU ĐỊNH VỊ (SAFETY TIMERS + LIVE BEACONS)
             * ========================================================================= */}
            {effectiveSection === 'safety' && (() => {
              const activeBeaconsCount = liveBeaconsList.filter((b) => b.status === 'active').length;
              const activeTimersCount = activeTimersLiveCount;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Hairline Safety Telemetry Ribbon */}
                  <div className="admin-metric-ribbon">
                    <div className="admin-metric-cell">
                      <span className="admin-metric-label">Tín hiệu SOS khẩn cấp</span>
                      <div className="admin-metric-value-row">
                        <span
                          className={`admin-metric-value ${sosBeaconsCount > 0 ? 'admin-metric-value--danger' : ''}`}
                        >
                          {sosBeaconsCount}
                        </span>
                      </div>
                      <span className="admin-metric-caption">Cần liên hệ hỗ trợ ngay</span>
                    </div>

                    <div className="admin-metric-cell">
                      <span className="admin-metric-label">Hẹn giờ quá hạn</span>
                      <div className="admin-metric-value-row">
                        <span
                          className={`admin-metric-value ${overdueTimersCount > 0 ? 'admin-metric-value--danger' : ''}`}
                        >
                          {overdueTimersCount}
                        </span>
                      </div>
                      <span className="admin-metric-caption">Chưa xác nhận ra khỏi rừng</span>
                    </div>

                    <div className="admin-metric-cell">
                      <span className="admin-metric-label">Tín hiệu trực tiếp đang bật</span>
                      <div className="admin-metric-value-row">
                        <span className="admin-metric-value">{activeBeaconsCount}</span>
                      </div>
                      <span className="admin-metric-caption">Trekker đang chia sẻ vị trí GPS</span>
                    </div>

                    <div className="admin-metric-cell">
                      <span className="admin-metric-label">Hẹn giờ đang theo dõi</span>
                      <div className="admin-metric-value-row">
                        <span className="admin-metric-value admin-metric-value--primary">
                          {activeTimersCount}
                        </span>
                      </div>
                      <span className="admin-metric-caption">Vẫn trong khung giờ dự kiến về</span>
                    </div>
                  </div>

                  {/* BLOCK 1: LIVE BEACONS (SOS FIRST) */}
                  <section className="admin-section-block">
                    <div className="admin-subhead">
                      <h2 className="admin-subhead-title">
                        <Radio
                          size={15}
                          color={sosBeaconsCount > 0 ? 'var(--color-error)' : 'var(--color-text-dim)'}
                        />
                        <span>Điểm phát tín hiệu trực tiếp</span>
                        <span className="admin-subhead-count">{liveBeaconsList.length}</span>
                      </h2>
                    </div>

                    <div className="admin-ledger">
                      {liveBeaconsList.length === 0 ? (
                        <div className="admin-empty">
                          <div className="admin-empty-icon" aria-hidden="true">
                            <Radio size={18} />
                          </div>
                          <h3 className="admin-empty-title">Chưa có điểm phát tín hiệu trực tiếp nào</h3>
                          <p className="admin-empty-desc">
                            Khi có người bật chia sẻ GPS trực tiếp hoặc gửi SOS, tín hiệu sẽ hiện lên đầu danh sách.
                          </p>
                        </div>
                      ) : (
                        liveBeaconsList.map((beacon) => {
                          const beaconId = String(beacon._id || beacon.token || '');
                          const isRowSelected =
                            liveInspectorSelection?.kind === 'beacon' &&
                            liveInspectorSelection.data.id === beaconId;
                          const isSos = beacon.status === 'sos';
                          const userObj = typeof beacon.userId === 'object' ? beacon.userId : null;
                          const beaconPath = beacon.sharePath || `/beacon/${beacon.token}`;

                          return (
                            <div
                              key={beaconId}
                              className={`admin-ledger-row admin-ledger-row--selectable ${isSos ? 'admin-ledger-row--urgent' : ''} ${isRowSelected ? 'is-selected' : ''}`}
                              onClick={() => {
                                const mapped = cockpitBeaconsById.get(beaconId);
                                if (mapped) setInspectorSelection({ kind: 'beacon', data: mapped });
                              }}
                            >
                              <div className="admin-ledger-main">
                                <div className="admin-ledger-title-line">
                                  {isSos ? (
                                    <span className="admin-tag admin-tag--danger">
                                      <IconShieldAlert size={11} /> SOS khẩn cấp
                                    </span>
                                  ) : (
                                    <span className="admin-status">
                                      <span className="admin-dot admin-dot--ok" aria-hidden="true" />
                                      Đang phát GPS
                                    </span>
                                  )}
                                  <span className="admin-ledger-title">
                                    {beacon.displayName || userObj?.fullName || 'Trekker LOST'}
                                  </span>
                                  <span className="admin-tag">{beacon.trailName}</span>
                                  {beacon.isSignalStale && (
                                    <span className="admin-tag admin-tag--warn">
                                      Mất tín hiệu {beacon.minutesSinceLastPing} phút
                                    </span>
                                  )}
                                </div>

                                <div className="admin-ledger-meta">
                                  {beacon.lastPosition ? (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                      }}
                                    >
                                      <IconMapPin size={11} color="var(--color-primary)" />
                                      <code className="admin-code">
                                        {beacon.lastPosition.lat.toFixed(5)},{' '}
                                        {beacon.lastPosition.lng.toFixed(5)}
                                      </code>
                                      {beacon.lastPosition.altitudeM !== null &&
                                        beacon.lastPosition.altitudeM !== undefined && (
                                          <span>({Math.round(beacon.lastPosition.altitudeM)}m)</span>
                                        )}
                                    </span>
                                  ) : (
                                    <span>Chưa nhận tọa độ GPS đầu tiên</span>
                                  )}
                                  {beacon.batteryPercent !== null &&
                                    beacon.batteryPercent !== undefined && (
                                      <span>
                                        · Pin:{' '}
                                        <strong
                                          style={{
                                            color:
                                              beacon.batteryPercent <= 20
                                                ? 'var(--color-error-text, var(--color-error))'
                                                : undefined,
                                          }}
                                        >
                                          {beacon.batteryPercent}%
                                        </strong>
                                      </span>
                                    )}
                                  <span>· {beacon.distanceKm ?? 0} km</span>
                                  <span>· Cập nhật {formatDateVi(beacon.lastPingAt)}</span>
                                </div>

                                <div className="admin-ledger-meta">
                                  {userObj?.phone && (
                                    <a
                                      href={`tel:${userObj.phone}`}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        color: 'var(--color-primary)',
                                        fontWeight: 600,
                                        textDecoration: 'none',
                                      }}
                                    >
                                      <IconPhone size={11} /> {userObj.phone}
                                    </a>
                                  )}
                                  {userObj?.email && (
                                    <a
                                      href={`mailto:${userObj.email}`}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        color: 'var(--color-text-muted)',
                                        textDecoration: 'none',
                                      }}
                                    >
                                      <IconMail size={11} /> {userObj.email}
                                    </a>
                                  )}
                                  {userObj?.emergencyContact && (
                                    <span
                                      style={{
                                        color: 'var(--color-error-text, var(--color-error))',
                                        fontWeight: 600,
                                      }}
                                    >
                                      · Khẩn cấp: {userObj.emergencyContact}
                                    </span>
                                  )}
                                </div>

                                {beacon.emergencyNote && (
                                  <div
                                    className={`admin-note-box ${isSos ? 'admin-note-box--danger' : ''}`}
                                  >
                                    Lời nhắn khẩn cấp: &ldquo;{beacon.emergencyNote}&rdquo;
                                  </div>
                                )}
                              </div>

                              <div
                                className="admin-ledger-actions"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <a
                                  href={beaconPath}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className={`admin-btn admin-btn--sm ${isSos ? 'admin-btn--danger' : 'admin-btn--primary'}`}
                                >
                                  <ExternalLinkIcon size={12} />
                                  <span>Xem trên bản đồ</span>
                                </a>
                                {beacon._id && beacon.status !== 'safe' && (
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn--sm admin-btn--danger-ghost"
                                    disabled={Boolean(busyActions[`beacon-resolve:${beaconId}`])}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAdminResolveBeacon(
                                        String(beacon._id),
                                        beacon.displayName || userObj?.fullName || 'Trekker LOST',
                                        beacon.trailName || 'Hành trình thực địa'
                                      );
                                    }}
                                  >
                                    <ShieldCheck size={12} />
                                    <span>Kết thúc tín hiệu</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>

                  {/* BLOCK 2: SAFETY TIMERS (OVERDUE_ALERTED FIRST) */}
                  <section className="admin-section-block">
                    <div className="admin-toolbar">
                      <div className="admin-subhead" style={{ paddingBottom: 9 }}>
                        <h2 className="admin-subhead-title">
                          <Clock
                            size={15}
                            color={
                              overdueTimersCount > 0 ? 'var(--color-error)' : 'var(--color-text-dim)'
                            }
                          />
                          <span>Hẹn giờ báo bình an</span>
                          <span className="admin-subhead-count">{displayedSafetyTimers.length}</span>
                        </h2>
                      </div>

                      <div className="admin-tabs" role="tablist" aria-label="Trạng thái hẹn giờ báo bình an">
                        {(
                          [
                            { id: 'live', label: 'Đang theo dõi & quá hạn' },
                            { id: 'checked_in_safe', label: 'Đã báo bình an' },
                            { id: 'cancelled', label: 'Đã hủy' },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={safetyTimerView === tab.id}
                            className={`admin-tab-btn ${safetyTimerView === tab.id ? 'active' : ''}`}
                            onClick={() => setSafetyTimerView(tab.id)}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="admin-ledger">
                      {displayedSafetyTimers.length === 0 ? (
                        <div className="admin-empty">
                          <div className="admin-empty-icon" aria-hidden="true">
                            <Clock size={18} />
                          </div>
                          <h3 className="admin-empty-title">Không có lịch hẹn trong mục này</h3>
                          <p className="admin-empty-desc">
                            Các lịch hẹn báo bình an đang hoạt động hoặc quá hạn sẽ hiển thị tại đây.
                          </p>
                        </div>
                      ) : (
                        displayedSafetyTimers.map((timer) => {
                          const isOverdue = timer.status === 'overdue_alerted';
                          const isActionableTimer =
                            timer.status === 'active' || timer.status === 'overdue_alerted';
                          const userObj = typeof timer.userId === 'object' ? timer.userId : null;
                          const timerUserName =
                            userObj?.fullName || userObj?.username || 'Thành viên LOST';
                          const timerTrailName = timer.trailName || 'Cung đường trekking';
                          const hasCoords =
                            typeof timer.lastKnownLat === 'number' &&
                            typeof timer.lastKnownLng === 'number';
                          const mappedOverdue = isOverdue ? cockpitOverdueTimersById.get(timer._id) : undefined;
                          const isRowSelected =
                            liveInspectorSelection?.kind === 'timer' &&
                            liveInspectorSelection.data.id === timer._id;

                          return (
                            <div
                              key={timer._id}
                              className={`admin-ledger-row ${isOverdue ? 'admin-ledger-row--urgent' : ''} ${mappedOverdue ? 'admin-ledger-row--selectable' : ''} ${isRowSelected ? 'is-selected' : ''}`}
                              onClick={
                                mappedOverdue
                                  ? () => setInspectorSelection({ kind: 'timer', data: mappedOverdue })
                                  : undefined
                              }
                            >
                              <div className="admin-ledger-main">
                                <div className="admin-ledger-title-line">
                                  {isOverdue ? (
                                    <span className="admin-tag admin-tag--danger">
                                      <AlertTriangle size={11} /> Quá hạn báo bình an
                                    </span>
                                  ) : timer.status === 'active' ? (
                                    <span className="admin-status">
                                      <span className="admin-dot admin-dot--info" aria-hidden="true" />
                                      Đang theo dõi
                                    </span>
                                  ) : timer.status === 'checked_in_safe' ? (
                                    <span className="admin-status">
                                      <span className="admin-dot admin-dot--ok" aria-hidden="true" />
                                      Đã về an toàn
                                    </span>
                                  ) : (
                                    <span className="admin-status">
                                      <span className="admin-dot" aria-hidden="true" />
                                      Đã hủy
                                    </span>
                                  )}
                                  <span className="admin-ledger-title">
                                    {userObj?.fullName || userObj?.username || 'Thành viên LOST'}
                                  </span>
                                  <span className="admin-tag">{timer.trailName}</span>
                                </div>

                                <div className="admin-ledger-meta">
                                  <span>
                                    Dự kiến ra rừng:{' '}
                                    <strong
                                      style={{
                                        color: isOverdue
                                          ? 'var(--color-error-text, var(--color-error))'
                                          : undefined,
                                      }}
                                    >
                                      {formatDateVi(timer.expectedReturnAt)}
                                    </strong>
                                  </span>
                                  {timer.alertedAt && (
                                    <span
                                      style={{ color: 'var(--color-error-text, var(--color-error))' }}
                                    >
                                      · Phát cảnh báo {formatDateVi(timer.alertedAt)}
                                    </span>
                                  )}
                                  {timer.checkedInSafeAt && (
                                    <span style={{ color: 'var(--color-primary)' }}>
                                      · Báo bình an {formatDateVi(timer.checkedInSafeAt)}
                                    </span>
                                  )}
                                </div>

                                <div className="admin-ledger-meta">
                                  <span>
                                    Người thân: <strong>{timer.emergencyContactName || 'Chưa rõ'}</strong>
                                  </span>
                                  {timer.emergencyContactPhone && (
                                    <a
                                      href={`tel:${timer.emergencyContactPhone}`}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        color: isOverdue
                                          ? 'var(--color-error-text, var(--color-error))'
                                          : 'var(--color-primary)',
                                        fontWeight: 600,
                                        textDecoration: 'none',
                                      }}
                                    >
                                      <IconPhone size={11} /> {timer.emergencyContactPhone}
                                    </a>
                                  )}
                                  {timer.emergencyContactEmail && (
                                    <a
                                      href={`mailto:${timer.emergencyContactEmail}`}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        color: 'var(--color-text-muted)',
                                        textDecoration: 'none',
                                      }}
                                    >
                                      <IconMail size={11} /> {timer.emergencyContactEmail}
                                    </a>
                                  )}
                                  {userObj?.phone && <span>· SĐT trekker: {userObj.phone}</span>}
                                </div>

                                {timer.notes && (
                                  <div className="admin-note-box">Ghi chú: {timer.notes}</div>
                                )}
                              </div>

                              {(isActionableTimer || hasCoords) && (
                                <div
                                  className="admin-ledger-actions"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {isActionableTimer && (
                                    <>
                                      <button
                                        type="button"
                                        className="admin-btn admin-btn--sm admin-btn--primary"
                                        disabled={Boolean(busyActions[`timer-safe:${timer._id}`])}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAdminMarkTimerSafe(
                                            timer._id,
                                            timerUserName,
                                            timerTrailName
                                          );
                                        }}
                                      >
                                        <CheckCircle2 size={12} />
                                        <span>Đánh dấu đã an toàn</span>
                                      </button>
                                      <button
                                        type="button"
                                        className="admin-btn admin-btn--sm"
                                        disabled={Boolean(busyActions[`timer-extend:${timer._id}`])}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAdminExtendTimer(
                                            timer._id,
                                            timerUserName,
                                            timerTrailName
                                          );
                                        }}
                                      >
                                        <Clock size={12} />
                                        <span>Gia hạn +2 giờ</span>
                                      </button>
                                    </>
                                  )}
                                  {hasCoords && (
                                    <a
                                      href={`https://www.google.com/maps?q=${timer.lastKnownLat},${timer.lastKnownLng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="admin-btn admin-btn--sm"
                                    >
                                      <IconMapPin size={12} />
                                      <span>
                                        {timer.lastKnownLat!.toFixed(4)},{' '}
                                        {timer.lastKnownLng!.toFixed(4)}
                                      </span>
                                      <ExternalLinkIcon size={11} />
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>
                </div>
              );
            })()}

            {/* =========================================================================
             * SECTION 10: KIỂM DUYỆT THỰC ĐỊA (TRAIL POIS & REVIEWS)
             * ========================================================================= */}
            {effectiveSection === 'field' && (
              <>
                <div className="admin-toolbar">
                  <div className="admin-tabs" role="tablist" aria-label="Phân loại nội dung kiểm duyệt">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={fieldSubTab === 'pois'}
                      className={`admin-tab-btn ${fieldSubTab === 'pois' ? 'active' : ''}`}
                      onClick={() => setFieldSubTab('pois')}
                    >
                      <span>Điểm mốc trên tuyến</span>
                      <span className="admin-tab-count">{poisTotal || poisList.length}</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={fieldSubTab === 'reviews'}
                      className={`admin-tab-btn ${fieldSubTab === 'reviews' ? 'active' : ''}`}
                      onClick={() => setFieldSubTab('reviews')}
                    >
                      <span>Đánh giá cung đường</span>
                      <span className="admin-tab-count">{reviewsTotal || reviewsList.length}</span>
                    </button>
                  </div>

                  <div className="admin-search">
                    <Search size={14} color="var(--color-text-dim)" />
                    <input
                      type="text"
                      placeholder={
                        fieldSubTab === 'pois'
                          ? 'Tìm tên điểm mốc, cung đường, người gửi...'
                          : 'Tìm cung đường, người đánh giá, nội dung...'
                      }
                      value={fieldSearchQuery}
                      onChange={(e) => setFieldSearchQuery(e.target.value)}
                    />
                    {fieldSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setFieldSearchQuery('')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-text-dim)',
                          cursor: 'pointer',
                          display: 'flex',
                          padding: 2,
                        }}
                        aria-label="Xóa lọc tìm kiếm"
                      >
                        <IconX size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* SUB-TAB 1: TRAIL POIS */}
                {fieldSubTab === 'pois' && (
                  <div className="admin-ledger">
                    {filteredPois.length === 0 ? (
                      <div className="admin-empty">
                        <div className="admin-empty-icon" aria-hidden="true">
                          <IconMapPin size={18} />
                        </div>
                        <h3 className="admin-empty-title">Không có điểm mốc phù hợp</h3>
                        <p className="admin-empty-desc">
                          Các điểm nguồn nước, bãi trại và cảnh báo do cộng đồng đánh dấu sẽ hiển thị tại đây.
                        </p>
                      </div>
                    ) : (
                      filteredPois.map((poi) => {
                        const isClosed = poi.status === 'dry_or_closed';
                        const authorObj = typeof poi.userId === 'object' ? poi.userId : null;
                        const isBusy = togglingPoiId === poi._id;

                        return (
                          <div key={poi._id} className="admin-ledger-row">
                            <div className="admin-ledger-main">
                              <div className="admin-ledger-title-line">
                                <span
                                  className={
                                    poi.category === 'danger'
                                      ? 'admin-tag admin-tag--danger'
                                      : 'admin-tag'
                                  }
                                >
                                  {POI_CATEGORY_LABELS[poi.category] || poi.category}
                                </span>
                                <span className="admin-ledger-title">{poi.title}</span>
                                <span className="admin-status">
                                  <span
                                    className={
                                      isClosed
                                        ? 'admin-dot admin-dot--warn'
                                        : 'admin-dot admin-dot--ok'
                                    }
                                    aria-hidden="true"
                                  />
                                  {isClosed ? 'Đã cạn hoặc đóng' : 'Đang hoạt động'}
                                </span>
                              </div>

                              {poi.notes && <p className="admin-ledger-desc">{poi.notes}</p>}

                              <div className="admin-ledger-meta">
                                <span>
                                  Tuyến:{' '}
                                  <strong>{poi.trail?.name || poi.trailName || poi.trailId}</strong>
                                  {poi.trail?.province || poi.trailProvince
                                    ? ` (${poi.trail?.province || poi.trailProvince})`
                                    : ''}
                                </span>
                                <span>
                                  ·{' '}
                                  <code className="admin-code">
                                    {Number(poi.lat).toFixed(5)}, {Number(poi.lng).toFixed(5)}
                                  </code>
                                  {poi.elevationM !== null && poi.elevationM !== undefined
                                    ? ` · ${poi.elevationM}m`
                                    : ''}
                                </span>
                                <span>
                                  ·{' '}
                                  <strong>
                                    {poi.authorName || authorObj?.fullName || 'Trekker'}
                                  </strong>
                                  {authorObj?.email ? ` (${authorObj.email})` : ''}
                                </span>
                                <span>· {poi.upvoteCount || 0} xác nhận</span>
                                <span>· {formatDateVi(poi.createdAt)}</span>
                              </div>
                            </div>

                            <div className="admin-ledger-actions">
                              <button
                                type="button"
                                className="admin-btn admin-btn--sm"
                                disabled={isBusy}
                                onClick={() => void handleTogglePoiStatus(poi)}
                              >
                                {isClosed ? 'Mở lại' : 'Báo cạn / đóng'}
                              </button>
                              <button
                                type="button"
                                className="admin-btn admin-btn--sm admin-btn--danger-ghost"
                                onClick={() => handleDeletePoi(poi)}
                              >
                                <IconTrash size={12} />
                                <span>Xóa</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* SUB-TAB 2: TRAIL REVIEWS */}
                {fieldSubTab === 'reviews' && (
                  <div className="admin-ledger">
                    {filteredReviews.length === 0 ? (
                      <div className="admin-empty">
                        <div className="admin-empty-icon" aria-hidden="true">
                          <IconStar size={18} />
                        </div>
                        <h3 className="admin-empty-title">Không tìm thấy đánh giá phù hợp</h3>
                        <p className="admin-empty-desc">
                          Đánh giá của thành viên sau chuyến đi sẽ hiển thị tại đây.
                        </p>
                      </div>
                    ) : (
                      filteredReviews.map((rev) => {
                        const trailObj = typeof rev.trailId === 'object' ? rev.trailId : null;
                        const userObj = typeof rev.userId === 'object' ? rev.userId : null;
                        const reviewerName = userObj?.fullName || rev.userName || 'Thành viên LOST';
                        const reviewerAvatar = userObj?.avatarUrl || rev.userAvatar || DEFAULT_AVATAR;

                        return (
                          <div key={rev._id} className="admin-ledger-row">
                            <div className="admin-ledger-main">
                              <div className="admin-ledger-title-line">
                                <img
                                  loading="lazy"
                                  decoding="async"
                                  src={reviewerAvatar}
                                  alt={reviewerName}
                                  className="admin-avatar-sm"
                                  style={{ width: 24, height: 24 }}
                                />
                                <span className="admin-ledger-title">{reviewerName}</span>
                                {userObj?.email && (
                                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)' }}>
                                    {userObj.email}
                                  </span>
                                )}
                                <span className="admin-tag">
                                  {trailObj?.name || 'Cung đường'}
                                  {trailObj?.province ? ` · ${trailObj.province}` : ''}
                                </span>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    color: 'var(--color-earth)',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                  aria-label={`Đánh giá ${rev.rating} trên 5 sao`}
                                >
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <IconStar
                                      key={star}
                                      size={11}
                                      color="var(--color-earth)"
                                      fill={star <= Math.round(rev.rating) ? 'var(--color-earth)' : 'none'}
                                    />
                                  ))}
                                  <span style={{ marginLeft: 3 }}>{rev.rating}/5</span>
                                </span>
                              </div>

                              <p
                                className="admin-ledger-desc"
                                style={{ color: 'var(--color-text-main)', whiteSpace: 'pre-line' }}
                              >
                                {rev.content}
                              </p>

                              {rev.safetyNote && (
                                <div className="admin-note-box admin-note-box--warn">
                                  Lưu ý an toàn: {rev.safetyNote}
                                </div>
                              )}

                              <div className="admin-ledger-meta">
                                {rev.difficultyRating && (
                                  <span>Độ khó cảm nhận: {rev.difficultyRating}/5</span>
                                )}
                                {rev.tripDate && <span>· Ngày đi: {rev.tripDate}</span>}
                                <span>· {rev.helpfulCount || 0} hữu ích</span>
                                <span>· {formatDateVi(rev.createdAt)}</span>
                              </div>
                            </div>

                            <div className="admin-ledger-actions">
                              <button
                                type="button"
                                className="admin-btn admin-btn--sm admin-btn--danger-ghost"
                                onClick={() => handleDeleteReview(rev)}
                              >
                                <IconTrash size={12} />
                                <span>Xóa</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </>
            )}
              </div>
            </div>
          </div>

          {liveInspectorSelection && (
            <AdminSpatialInspector
              selection={liveInspectorSelection}
              isStrictAdmin={isStrictAdmin}
              publishedTrails={cockpitTrails}
              onClose={handleCloseInspector}
              onEditTrail={handleInspectorEditTrail}
              onDeleteTrail={handleDeleteTrail}
              onApproveContribution={handleApprove}
              onRejectContribution={handleReject}
              onDeleteContribution={handleDeleteContribution}
              onInspectContributionModal={handleInspectorOpenContribModal}
              onResolveIncident={handleResolveIncident}
              onMarkTimerSafe={handleAdminMarkTimerSafe}
              onExtendTimer={handleAdminExtendTimer}
              onResolveBeacon={handleAdminResolveBeacon}
              onNavigateSection={handleSelectSection}
            />
          )}
        </div>

        {/* Bottom 30px Instrument Status Bar (isolated 1Hz UTC+7 clock & hover readout) */}
        <AdminStatusBar
          readiness={statusReadiness}
          readinessDetail={statusReadinessDetail}
          lockedCoords={lockedCoords}
          subscribeHoverCoords={subscribeHoverCoords}
          dbStatus={dbHealth.status}
          dbLabel={dbHealth.label}
          isSocketConnected={isSocketConnected}
        />
      </div>

      <ContributionDetailModal
        contribution={selectedContribution}
        contributions={contributions}
        usersList={usersList}
        currentUser={currentUser}
        nearbyTrailMatch={
          selectedContribution
            ? nearbyTrailByContributionId.get(
                String(selectedContribution.id || selectedContribution._id || '')
              ) || null
            : null
        }
        busyActions={busyActions}
        dialogRef={contribModalRef}
        onClose={() => setSelectedContribution(null)}
        onOpenAuthorModal={setSelectedAuthorModal}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      <AdminAuthorModal
        author={selectedAuthorModal}
        dialogRef={authorModalRef}
        getRoleLabel={getRoleLabelVi}
        onMessageAuthor={(userId) => {
          safeLocalStorageSet('lost_target_chat_user', userId);
          setSelectedAuthorModal(null);
          setSelectedContribution(null);
          window.location.hash = '#messages';
        }}
        onClose={() => setSelectedAuthorModal(null)}
      />

      <EditTrailModal
        trail={editingTrailModal}
        isStrictAdmin={isStrictAdmin}
        form={editTrailForm}
        isSaving={isSavingTrail}
        dialogRef={editTrailModalRef}
        onChangeForm={setEditTrailForm}
        onSubmit={handleSaveTrailEdit}
        onClose={() => setEditingTrailModal(null)}
      />

      <CreateTrailModal
        isOpen={isCreateTrailOpen}
        isStrictAdmin={isStrictAdmin}
        form={createTrailForm}
        isCreating={isCreatingTrail}
        dialogRef={createTrailModalRef}
        onChangeForm={setCreateTrailForm}
        onSubmit={handleCreateTrailSubmit}
        onOpenContributeWizard={handleOpenContributeWizard}
        onClose={() => setIsCreateTrailOpen(false)}
      />

      <AdminConfirmDialog
        dialog={confirmDialog}
        reason={confirmReason}
        isExecuting={isConfirmExecuting}
        dialogRef={confirmModalRef}
        onChangeReason={setConfirmReason}
        onConfirm={executeConfirmDialog}
        onClose={() => setConfirmDialog(null)}
      />
    </div>
  );
};
