import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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
} from '../common/SvgIcons.js';
import { useSocket } from '../../context/SocketContext.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { searchMatchVietnamese } from '../../utils/textUtils.js';
import { isTopmostFocusTrap, useFocusTrap } from '../../hooks/useFocusTrap.js';
import { ThemeToggle } from '../common/ThemeToggle.js';
import type {
  AdminCockpitSectionId,
  CockpitBeaconPoint,
  CockpitContributionPoint,
  CockpitIncidentPoint,
  CockpitInspectorSelection,
  CockpitTrailPoint,
  CockpitTriageItem,
  CockpitUserPoint,
} from './adminCockpitTypes.js';
import { AdminCommandDeck, type AdminCommandDeckStats } from './AdminCommandDeck.js';
import { AdminSpatialInspector } from './AdminSpatialInspector.js';
import { AdminStatusBar, type AdminReadinessLevel } from './AdminStatusBar.js';

const DEFAULT_TRAIL_COVER = '/covers/trail-fansipan.svg';
const DEFAULT_AVATAR = '/covers/avatar-default.svg';

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

const ArrowLeft = createSvgIcon(
  <>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </>
);
const CheckCircle2 = createSvgIcon(
  <>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </>
);
const XCircle = createSvgIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </>
);
const Trash2 = createSvgIcon(
  <>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </>
);
const Eye = createSvgIcon(
  <>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </>
);
const ShieldCheck = createSvgIcon(
  <>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
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
const AlertTriangle = createSvgIcon(
  <>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </>
);
const Users = createSvgIcon(
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>
);
const MessageSquare = createSvgIcon(
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
);
const BarChart3 = createSvgIcon(
  <>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </>
);
const Clock = createSvgIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </>
);
const Database = createSvgIcon(
  <>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </>
);
const Compass = createSvgIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </>
);
const Search = createSvgIcon(
  <>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </>
);
const RefreshCw = createSvgIcon(
  <>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </>
);
const Radio = createSvgIcon(
  <>
    <circle cx="12" cy="12" r="2" />
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
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

type ValidRegion = 'Miền Bắc' | 'Miền Trung' | 'Miền Nam';

const normalizeRegion = (value?: string): ValidRegion => {
  if (value === 'Miền Bắc' || value === 'Miền Trung' || value === 'Miền Nam') {
    return value;
  }
  return 'Miền Bắc';
};

type EntityRef = string | { _id?: string; id?: string } | null | undefined;

interface AdminContributionItem {
  _id?: string;
  id?: string;
  name?: string;
  province?: string;
  district?: string;
  hamlet?: string;
  region?: string;
  distanceKm?: number;
  elevationGainM?: number;
  maxAltitudeM?: number;
  difficultyLevel?: number;
  durationHoursNote?: string;
  description?: string;
  transportationInfo?: string;
  coverImage?: string;
  permitRequired?: boolean;
  permitInfo?: string;
  hasCampsite?: boolean;
  hasWaterSource?: boolean;
  kidFriendly?: boolean;
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
  status?: string;
  authorName?: string;
  authorEmail?: string;
  authorAvatar?: string;
  userId?: EntityRef;
  createdBy?: EntityRef;
  createdAt?: string;
  submittedAt?: string;
}

interface AdminAuthorModalState {
  name?: string;
  email?: string;
  avatar?: string;
  userId?: string;
  role?: string;
  reputationScore?: number;
  contribCount?: number;
  approvedCount?: number;
  pendingCount?: number;
  authorContribs?: AdminContributionItem[];
  expeditionId?: string;
  isVerified?: boolean;
  authProvider?: string;
  date?: string;
}

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

interface AdminTrailItem {
  _id?: string;
  id?: string;
  name?: string;
  altNames?: string[];
  province?: string;
  district?: string;
  region?: string;
  distanceKm?: number;
  elevationGainM?: number;
  maxAltitudeM?: number;
  durationDays?: number;
  difficultyLevel?: number;
  difficultyNote?: string;
  durationHoursNote?: string;
  description?: string;
  transportationInfo?: string;
  coverImage?: string;
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
  bestMonths?: number[];
  avoidMonths?: number[];
  permitRequired?: boolean;
  permitInfo?: string;
  rescueContact?: {
    name?: string;
    phone?: string;
    rangerContact?: string;
  };
  hasCampsite?: boolean;
  hasWaterSource?: boolean;
  kidFriendly?: boolean;
  status?: 'approved' | 'pending' | 'rejected';
  rating?: number;
  reviewCount?: number;
}

interface TrailFormState {
  name: string;
  altNames: string;
  province: string;
  district: string;
  region: ValidRegion;
  distanceKm: string;
  elevationGainM: string;
  maxAltitudeM: string;
  durationDays: string;
  durationHoursNote: string;
  difficultyLevel: string;
  difficultyNote: string;
  startLat: string;
  startLng: string;
  endLat: string;
  endLng: string;
  coverImage: string;
  bestMonths: string;
  avoidMonths: string;
  description: string;
  transportationInfo: string;
  permitRequired: boolean;
  permitInfo: string;
  hasCampsite: boolean;
  hasWaterSource: boolean;
  kidFriendly: boolean;
  rescueContactName: string;
  rescueContactPhone: string;
  rescueContactRanger: string;
  status: 'approved' | 'pending' | 'rejected';
}

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
  rescueContactRanger: '115',
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
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110;
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

interface AdminUserItem {
  _id?: string;
  id?: string;
  fullName?: string;
  name?: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  avatar?: string;
  role?: string;
  reputationScore?: number;
  badges?: string[];
  isBanned?: boolean;
  banReason?: string;
  isEmailVerified?: boolean;
  authProvider?: string;
  createdAt?: string;
}

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

const extractEntityId = (ref: EntityRef): string => {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'object') return String(ref._id || ref.id || '');
  return String(ref);
};

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  reasonInputLabel?: string;
  reasonPlaceholder?: string;
  defaultReason?: string;
  onConfirm: (reason?: string) => Promise<void> | void;
}

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
  const { isConnected: isSocketConnected } = useSocket();
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem('lost_admin_rail_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [inspectorSelection, setInspectorSelection] = useState<CockpitInspectorSelection | null>(null);
  const [hoverCoords, setHoverCoords] = useState<{ lat: number; lng: number } | null>(null);

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
  const effectiveSection: AdminSectionId =
    !isStrictAdmin && (adminSection === 'users' || adminSection === 'audit')
      ? 'overview'
      : adminSection;

  const handleSelectSection = useCallback(
    (next: AdminSectionId) => {
      if (!isStrictAdmin && (next === 'users' || next === 'audit')) return;
      setAdminSection(next);
      setMobileRailOpen(false);
      try {
        if (typeof window !== 'undefined' && window.location.pathname === '/admin') {
          const nextUrl = `/admin?tab=${encodeURIComponent(next)}`;
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
  const [fieldSubTab, setFieldSubTab] = useState<'pois' | 'reviews'>(resolveInitialFieldSubTab);
  const [fieldSearchQuery, setFieldSearchQuery] = useState<string>('');
  const [togglingPoiId, setTogglingPoiId] = useState<string | null>(null);

  const [selectedContribution, setSelectedContribution] = useState<AdminContributionItem | null>(null);
  const [selectedAuthorModal, setSelectedAuthorModal] = useState<AdminAuthorModalState | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [trailSearchQuery, setTrailSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [accessNotice, setAccessNotice] = useState<string>('');
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

  const [trailsList, setTrailsList] = useState<AdminTrailItem[]>([]);
  const [incidentsList, setIncidentsList] = useState<AdminIncidentItem[]>([]);
  const [usersList, setUsersList] = useState<AdminUserItem[]>([]);
  const [threadsList, setThreadsList] = useState<AdminForumThreadItem[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStatsSummary | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);
  const [inquiriesList, setInquiriesList] = useState<AdminGuideInquiryItem[]>([]);
  const [safetyTimersList, setSafetyTimersList] = useState<AdminSafetyTimerItem[]>([]);
  const [liveBeaconsList, setLiveBeaconsList] = useState<AdminLiveBeaconItem[]>([]);
  const [loadedSections, setLoadedSections] = useState<Set<AdminSectionId>>(() => new Set());
  const markSectionLoaded = useCallback((section: AdminSectionId) => {
    setLoadedSections((prev) => {
      if (prev.has(section)) return prev;
      const next = new Set(prev);
      next.add(section);
      return next;
    });
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

  const openConfirmDialog = (dialog: ConfirmDialogState) => {
    setConfirmReason(dialog.defaultReason || '');
    setConfirmDialog(dialog);
  };

  const handleOpenContributeWizard = () => {
    try {
      localStorage.removeItem('lost_editing_contribution');
    } catch {
      // ignore storage errors
    }
    setIsCreateTrailOpen(false);
    window.location.hash = '#contribute';
  };

  const openEditTrailModal = (trail: AdminTrailItem) => {
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
  };

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
        `Tài khoản hiện tại không đủ quyền truy cập mục "${areaLabel}" (yêu cầu quyền Quản trị viên cấp cao).`
      );
      return true;
    }
    return false;
  }, []);

  const fetchHealthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const dbStr = String(data?.database || '');
      if (res.ok && dbStr === 'Connected') {
        setDbHealth({ status: 'online', label: 'Trực Tuyến' });
      } else if (dbStr === 'Connecting') {
        setDbHealth({ status: 'connecting', label: 'Đang Kết Nối' });
      } else {
        setDbHealth({ status: 'degraded', label: 'Gián Đoạn' });
      }
    } catch {
      setDbHealth({ status: 'offline', label: 'Ngoại Tuyến' });
    }
  }, []);

  const fetchFromMongo = useCallback(async () => {
    try {
      const res = await fetch('/api/contributions', {
        headers: getApiHeaders(),
      });
      if (handleForbiddenStatus(res, 'Duyệt đóng góp')) return;
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
      }
    } catch (err) {
      console.warn('[MongoDB Admin Fetch Notice]: Using local cache.', err);
    }
  }, [handleForbiddenStatus, markSectionLoaded]);

  const fetchAdminUsers = useCallback(async () => {
    if (!isStrictAdmin) return;
    try {
      const res = await fetch('/api/admin/users', {
        headers: getApiHeaders(),
      });
      if (handleForbiddenStatus(res, 'Người dùng & phân quyền')) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setUsersList(data.data);
        markSectionLoaded('users');
      }
    } catch {
      // fail gracefully
    }
  }, [isStrictAdmin, handleForbiddenStatus, markSectionLoaded]);

  const fetchAdminTrails = useCallback(async () => {
    try {
      const res = await fetch('/api/trails', {
        headers: getApiHeaders(),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setTrailsList(data.data);
        markSectionLoaded('trails');
      }
    } catch {
      // fail gracefully
    }
  }, [markSectionLoaded]);

  const fetchAdminIncidents = useCallback(async () => {
    try {
      const res = await fetch('/api/incidents?includeResolved=true', {
        headers: getApiHeaders(),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setIncidentsList(data.data);
        markSectionLoaded('incidents');
      }
    } catch {
      // fail gracefully
    }
  }, [markSectionLoaded]);

  const fetchAdminThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/forum', {
        headers: getApiHeaders(),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const sorted = [...(data.data as AdminForumThreadItem[])].sort(
          (a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)
        );
        setThreadsList(sorted);
        markSectionLoaded('forum');
      }
    } catch {
      // fail gracefully
    }
  }, [markSectionLoaded]);

  const fetchAdminStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: getApiHeaders(),
      });
      if (handleForbiddenStatus(res, 'Thống kê hệ thống')) return;
      const data = await res.json();
      if (data.success) setAdminStats(data.data);
    } catch {
      // fail gracefully
    }
  }, [handleForbiddenStatus]);

  const fetchAuditLogs = useCallback(async () => {
    if (!isStrictAdmin) return;
    try {
      const res = await fetch('/api/admin/audit-logs?limit=60', {
        headers: getApiHeaders(),
      });
      if (handleForbiddenStatus(res, 'Nhật ký kiểm toán')) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAuditLogs(data.data);
        markSectionLoaded('audit');
      }
    } catch {
      // fail gracefully
    }
  }, [isStrictAdmin, handleForbiddenStatus, markSectionLoaded]);

  const fetchAdminInquiries = useCallback(async () => {
    try {
      const res = await fetch('/api/directory/inquiries?limit=100', {
        headers: getApiHeaders(),
      });
      if (handleForbiddenStatus(res, 'Đơn đặt Porter/Guide')) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setInquiriesList(data.data);
        markSectionLoaded('inquiries');
      }
    } catch {
      // fail gracefully
    }
  }, [handleForbiddenStatus, markSectionLoaded]);

  const fetchAdminSafetyTimers = useCallback(
    async (mode: 'live' | 'checked_in_safe' | 'cancelled' = 'live') => {
      try {
        const query = mode === 'live' ? '?limit=100' : `?status=${mode}&limit=60`;
        const res = await fetch(`/api/safety-timers/admin${query}`, {
          headers: getApiHeaders(),
        });
        if (handleForbiddenStatus(res, 'Hẹn giờ an toàn')) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setSafetyTimersList(data.data);
          markSectionLoaded('safety');
        }
      } catch {
        // fail gracefully
      }
    },
    [handleForbiddenStatus, markSectionLoaded]
  );

  const fetchAdminLiveBeacons = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/live-beacons?limit=100', {
        headers: getApiHeaders(),
      });
      if (handleForbiddenStatus(res, 'Đèn hiệu trực tiếp')) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setLiveBeaconsList(data.data);
        markSectionLoaded('safety');
      }
    } catch {
      // fail gracefully
    }
  }, [handleForbiddenStatus, markSectionLoaded]);

  const fetchAdminPois = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pois?limit=100', {
        headers: getApiHeaders(),
      });
      if (handleForbiddenStatus(res, 'Kiểm duyệt điểm thực địa')) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPoisList(data.data);
        setPoisTotal(Number(data.total) || data.data.length);
        markSectionLoaded('field');
      }
    } catch {
      // fail gracefully
    }
  }, [handleForbiddenStatus, markSectionLoaded]);

  const fetchAdminReviews = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reviews?limit=100', {
        headers: getApiHeaders(),
      });
      if (handleForbiddenStatus(res, 'Kiểm duyệt đánh giá')) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setReviewsList(data.data);
        setReviewsTotal(Number(data.total) || data.data.length);
        markSectionLoaded('field');
      }
    } catch {
      // fail gracefully
    }
  }, [handleForbiddenStatus, markSectionLoaded]);

  const requestedSectionsRef = useRef<Set<AdminSectionId>>(new Set());
  const lastSafetyTimerViewRef = useRef<'live' | 'checked_in_safe' | 'cancelled'>(safetyTimerView);

  const fetchSafetyMonitoring = useCallback(async () => {
    lastSafetyTimerViewRef.current = safetyTimerView;
    await Promise.all([
      fetchAdminSafetyTimers(safetyTimerView),
      fetchAdminLiveBeacons(),
    ]);
  }, [fetchAdminSafetyTimers, fetchAdminLiveBeacons, safetyTimerView]);

  const refreshAllData = async () => {
    setIsRefreshing(true);
    setAccessNotice('');
    const sectionsToSync = new Set<AdminSectionId>(loadedSections);
    sectionsToSync.add(effectiveSection);
    if (effectiveSection === 'overview') {
      sectionsToSync.add('contributions');
      sectionsToSync.add('trails');
      sectionsToSync.add('incidents');
      sectionsToSync.add('safety');
      sectionsToSync.add('inquiries');
    }
    const tasks: Promise<void>[] = [fetchHealthStatus(), fetchAdminStats()];
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
    setTimeout(() => {
      setIsRefreshing(false);
      onShowToast?.('Đã đồng bộ dữ liệu với máy chủ!', 'success');
    }, 350);
  };

  // On mount: fetch lightweight health + summary stats (section datasets load on demand via guard below)
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

  // Load rich live datasets for 'overview' and lazy-load inactive tabs once via requestedSectionsRef guard
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const requested = requestedSectionsRef.current;

      const ensureSection = (sec: AdminSectionId, loader: () => Promise<void>) => {
        if (requested.has(sec)) return;
        requested.add(sec);
        void loader();
      };

      if (effectiveSection === 'overview') {
        ensureSection('contributions', fetchFromMongo);
        ensureSection('trails', fetchAdminTrails);
        ensureSection('incidents', fetchAdminIncidents);
        ensureSection('safety', fetchSafetyMonitoring);
        ensureSection('inquiries', fetchAdminInquiries);
        return;
      }

      if (effectiveSection === 'contributions') ensureSection('contributions', fetchFromMongo);
      if (effectiveSection === 'users' && isStrictAdmin) ensureSection('users', fetchAdminUsers);
      if (effectiveSection === 'trails') ensureSection('trails', fetchAdminTrails);
      if (effectiveSection === 'incidents') ensureSection('incidents', fetchAdminIncidents);
      if (effectiveSection === 'inquiries') ensureSection('inquiries', fetchAdminInquiries);
      if (effectiveSection === 'safety') {
        if (!requested.has('safety')) {
          requested.add('safety');
          void fetchSafetyMonitoring();
        } else if (lastSafetyTimerViewRef.current !== safetyTimerView) {
          lastSafetyTimerViewRef.current = safetyTimerView;
          void fetchAdminSafetyTimers(safetyTimerView);
        }
      }
      if (effectiveSection === 'field') {
        ensureSection('field', async () => {
          await Promise.all([fetchAdminPois(), fetchAdminReviews()]);
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
      onShowToast?.('Vui lòng nhập tọa độ GPS xuất phát (Start Lat/Lng) hợp lệ.', 'error');
      return;
    }

    const hasEndLat = createTrailForm.endLat.trim() !== '';
    const hasEndLng = createTrailForm.endLng.trim() !== '';
    const eLat = hasEndLat ? Number(createTrailForm.endLat) : sLat;
    const eLng = hasEndLng ? Number(createTrailForm.endLng) : sLng;
    if (!Number.isFinite(eLat) || !Number.isFinite(eLng) || eLat < -90 || eLat > 90 || eLng < -180 || eLng > 180) {
      onShowToast?.('Tọa độ GPS điểm đích (End Lat/Lng) không hợp lệ.', 'error');
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
            `Cứu nạn Khẩn cấp ${createTrailForm.province.trim()}`,
          phone: createTrailForm.rescueContactPhone.trim() || '112 / 114',
          rangerContact: createTrailForm.rescueContactRanger.trim() || '115',
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
        `Đã tạo và công khai cung đường "${createTrailForm.name.trim()}" lên bản đồ LOST!`,
        'success'
      );
      setCreateTrailForm(createEmptyTrailForm());
      setIsCreateTrailOpen(false);
      void fetchAdminTrails();
      void fetchAdminStats();
      if (isStrictAdmin) void fetchAuditLogs();
    } catch (err: unknown) {
      onShowToast?.(
        err instanceof Error ? err.message : 'Lỗi máy chủ khi tạo cung đường mới.',
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
        onShowToast?.('Tọa độ GPS xuất phát (Start Lat/Lng) không hợp lệ.', 'error');
        return;
      }
      payload.startLat = sLat;
      payload.startLng = sLng;
    }
    if (editTrailForm.endLat.trim() !== '' && editTrailForm.endLng.trim() !== '') {
      const eLat = Number(editTrailForm.endLat);
      const eLng = Number(editTrailForm.endLng);
      if (!Number.isFinite(eLat) || !Number.isFinite(eLng) || eLat < -90 || eLat > 90 || eLng < -180 || eLng > 180) {
        onShowToast?.('Tọa độ GPS đích (End Lat/Lng) không hợp lệ.', 'error');
        return;
      }
      payload.endLat = eLat;
      payload.endLng = eLng;
    }

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
      onShowToast?.(`Đã cập nhật cung đường "${editTrailForm.name.trim()}" thành công!`, 'success');
      setEditingTrailModal(null);
      void fetchAdminTrails();
      void fetchAdminStats();
      if (isStrictAdmin) void fetchAuditLogs();
    } catch (err: unknown) {
      onShowToast?.(
        err instanceof Error ? err.message : 'Lỗi máy chủ khi cập nhật cung đường.',
        'error'
      );
    } finally {
      setIsSavingTrail(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string, userName: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast?.(`Đã đổi vai trò của ${userName} thành "${newRole}"!`, 'success');
        void fetchAdminUsers();
        void fetchAdminStats();
        if (isStrictAdmin) void fetchAuditLogs();
      } else {
        onShowToast?.(data.message || 'Lỗi khi cập nhật vai trò', 'error');
      }
    } catch {
      onShowToast?.('Lỗi kết nối máy chủ', 'error');
    }
  };

  const handlePinThread = async (threadId: string) => {
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
    }
  };

  const handleLockThread = async (threadId: string) => {
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
    }
  };

  const handleDeleteThread = (threadId: string, title: string) => {
    openConfirmDialog({
      title: 'Xóa bài viết diễn đàn',
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn bài viết "${title}" khỏi diễn đàn LOST?`,
      confirmLabel: 'Xóa bài viết',
      danger: true,
      onConfirm: async () => {
        const res = await fetch(`/api/admin/threads/${threadId}`, {
          method: 'DELETE',
          headers: getApiHeaders(),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          onShowToast?.(data.message || 'Đã xóa bài viết!', 'info');
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

  const handleResolveDispute = async (
    incidentId: string,
    action: 'dismiss_incident' | 'reject_dispute'
  ) => {
    try {
      const res = await fetch(`/api/admin/incidents/${incidentId}/dispute-resolve`, {
        method: 'PUT',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast?.(data.message || 'Đã xử lý khiếu nại thành công!', 'success');
        void fetchAdminIncidents();
        void fetchAdminStats();
        if (isStrictAdmin) void fetchAuditLogs();
      } else {
        onShowToast?.(data.message || 'Không thể xử lý khiếu nại.', 'error');
      }
    } catch {
      onShowToast?.('Lỗi kết nối máy chủ khi xử lý khiếu nại.', 'error');
    }
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
        onShowToast?.(`Đã chuyển trạng thái đơn đặt Porter/Guide sang "${label}".`, 'success');
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
              ? 'Đã chuyển trạng thái POI sang Đang hoạt động.'
              : 'Đã đánh dấu POI: Đã cạn / Đóng.'),
          'success'
        );
        setPoisList((prev) =>
          prev.map((p) => (p._id === poi._id ? { ...p, status: nextStatus } : p))
        );
      } else {
        onShowToast?.(data.message || 'Không thể cập nhật trạng thái điểm thực địa.', 'error');
      }
    } catch {
      onShowToast?.('Lỗi kết nối máy chủ khi cập nhật điểm thực địa.', 'error');
    } finally {
      setTogglingPoiId(null);
    }
  };

  const handleDeletePoi = (poi: AdminTrailPoiItem) => {
    openConfirmDialog({
      title: 'Xóa điểm thực địa (POI)',
      message: `Xác nhận xóa vĩnh viễn điểm thực địa "${poi.title}" khỏi tuyến ${poi.trail?.name || poi.trailName || poi.trailId || ''}?`,
      confirmLabel: 'Xóa POI',
      danger: true,
      onConfirm: async () => {
        const res = await fetch(`/api/trail-pois/${poi._id}`, {
          method: 'DELETE',
          headers: getApiHeaders(),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          onShowToast?.(data.message || 'Đã xóa điểm thực địa thành công!', 'info');
          setPoisList((prev) => prev.filter((p) => p._id !== poi._id));
          setPoisTotal((prev) => Math.max(0, prev - 1));
        } else {
          onShowToast?.(data.message || 'Không thể xóa điểm thực địa.', 'error');
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
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn đánh giá của "${reviewerLabel}"? Điểm trung bình của cung đường sẽ được tính lại tự động.`,
      confirmLabel: 'Xóa đánh giá',
      danger: true,
      onConfirm: async () => {
        const res = await fetch(`/api/reviews/${review._id}`, {
          method: 'DELETE',
          headers: getApiHeaders(),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          onShowToast?.(data.message || 'Đã xóa đánh giá thành công!', 'info');
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

  const handleApprove = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/contributions/${id}`, {
        method: 'PUT',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          status: 'approved',
          approvedAt: new Date().toLocaleDateString('vi-VN'),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi khi duyệt bài đóng góp');
      }

      const updated = contributions.map((c) =>
        c.id === id || c._id === id
          ? { ...c, status: 'approved', approvedAt: new Date().toLocaleDateString('vi-VN') }
          : c
      );
      setContributions(updated);
      onShowToast?.(
        `Đã duyệt & công khai cung đường "${name}" vào bản đồ 3D thành công!`,
        'success'
      );
      if (selectedContribution?.id === id || selectedContribution?._id === id) {
        setSelectedContribution(null);
      }
      void fetchFromMongo();
      void fetchAdminTrails();
      void fetchAdminStats();
      if (isStrictAdmin) void fetchAuditLogs();
    } catch (e: unknown) {
      onShowToast?.(
        e instanceof Error ? e.message : 'Không thể duyệt bài đóng góp, vui lòng thử lại.',
        'error'
      );
    }
  };

  const handleReject = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/contributions/${id}`, {
        method: 'PUT',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          status: 'rejected',
          rejectedAt: new Date().toLocaleDateString('vi-VN'),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi khi từ chối bài đóng góp');
      }

      const updated = contributions.map((c) =>
        c.id === id || c._id === id
          ? { ...c, status: 'rejected', rejectedAt: new Date().toLocaleDateString('vi-VN') }
          : c
      );
      setContributions(updated);
      onShowToast?.(`Đã từ chối bài đóng góp "${name}".`, 'info');
      if (selectedContribution?.id === id || selectedContribution?._id === id) {
        setSelectedContribution(null);
      }
      void fetchFromMongo();
      void fetchAdminStats();
      if (isStrictAdmin) void fetchAuditLogs();
    } catch (e: unknown) {
      onShowToast?.(
        e instanceof Error ? e.message : 'Không thể từ chối bài đóng góp.',
        'error'
      );
    }
  };

  const handleDeleteContribution = (id: string, name: string) => {
    openConfirmDialog({
      title: 'Xóa bài đóng góp',
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn bài đóng góp "${name}" khỏi hệ thống MongoDB không?`,
      confirmLabel: 'Xóa vĩnh viễn',
      danger: true,
      onConfirm: async () => {
        const res = await fetch(`/api/contributions/${id}`, {
          method: 'DELETE',
          headers: getApiHeaders(),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          onShowToast?.(data.message || 'Không thể xóa bài đóng góp.', 'error');
          return;
        }
        const updated = contributions.filter((c) => c.id !== id && c._id !== id);
        setContributions(updated);
        onShowToast?.(`Đã xóa bài đóng góp "${name}" khỏi hệ thống!`, 'info');
        if (selectedContribution?.id === id || selectedContribution?._id === id) {
          setSelectedContribution(null);
        }
        setInspectorSelection((prev) => (prev?.kind === 'contribution' && prev.data.id === id ? null : prev));
        void fetchFromMongo();
        void fetchAdminStats();
        if (isStrictAdmin) void fetchAuditLogs();
      },
    });
  };

  const handleDeleteTrail = (id: string, name: string) => {
    openConfirmDialog({
      title: 'Xóa cung đường khỏi bản đồ',
      message: `Bạn có chắc chắn muốn xóa cung đường "${name}" khỏi kho dữ liệu bản đồ LOST? Thao tác này không thể hoàn tác.`,
      confirmLabel: 'Xóa cung đường',
      danger: true,
      onConfirm: async () => {
        const res = await fetch(`/api/admin/trails/${id}`, {
          method: 'DELETE',
          headers: getApiHeaders(),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          onShowToast?.(`Đã xóa cung đường "${name}"!`, 'info');
          setInspectorSelection((prev) => (prev?.kind === 'trail' && prev.data.id === id ? null : prev));
          void fetchAdminTrails();
          void fetchAdminStats();
          if (isStrictAdmin) void fetchAuditLogs();
        } else {
          onShowToast?.(data.message || 'Không thể xóa cung đường.', 'error');
        }
      },
    });
  };

  const handleResolveIncident = async (id: string) => {
    try {
      const res = await fetch(`/api/incidents/${id}/resolve`, {
        method: 'PUT',
        headers: getApiHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast?.('Đã đánh dấu xử lý xong sự cố (Đã gỡ cảnh báo)!', 'success');
        void fetchAdminIncidents();
        void fetchAdminStats();
        if (isStrictAdmin) void fetchAuditLogs();
      } else {
        onShowToast?.(data.message || 'Không thể gỡ cảnh báo sự cố.', 'error');
      }
    } catch {
      onShowToast?.('Lỗi kết nối máy chủ khi xử lý sự cố.', 'error');
    }
  };

  const handleDeleteIncident = (id: string) => {
    openConfirmDialog({
      title: 'Xóa báo cáo sự cố',
      message: 'Bạn có chắc chắn muốn xóa vĩnh viễn báo cáo sự cố thực địa này khỏi hệ thống?',
      confirmLabel: 'Xóa sự cố',
      danger: true,
      onConfirm: async () => {
        const res = await fetch(`/api/incidents/${id}`, {
          method: 'DELETE',
          headers: getApiHeaders(),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          onShowToast?.('Đã xóa sự cố khỏi hệ thống!', 'info');
          setInspectorSelection((prev) => (prev?.kind === 'incident' && prev.data.id === id ? null : prev));
          void fetchAdminIncidents();
          void fetchAdminStats();
          if (isStrictAdmin) void fetchAuditLogs();
        } else {
          onShowToast?.(data.message || 'Không thể xóa sự cố.', 'error');
        }
      },
    });
  };

  const handleBanUser = (rawUserId: EntityRef, label: string) => {
    const id = extractEntityId(rawUserId);
    if (!id) {
      onShowToast?.('Không xác định được mã tài khoản cần khóa.', 'error');
      return;
    }
    openConfirmDialog({
      title: 'Khóa tài khoản thành viên',
      message: `Xác nhận khóa tài khoản "${label}"? Người dùng này sẽ bị đăng xuất ngay lập tức và không thể truy cập LOST.`,
      confirmLabel: 'Khóa tài khoản',
      danger: true,
      reasonInputLabel: 'Lý do khóa tài khoản (lưu vào hồ sơ & nhật ký kiểm toán)',
      reasonPlaceholder: 'VD: Báo động giả sự cố nhiều lần, spam nội dung vi phạm...',
      defaultReason: 'Vi phạm quy định cộng đồng LOST',
      onConfirm: async (reasonInput?: string) => {
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
      },
    });
  };

  const handleUnbanUser = async (id: string, email: string) => {
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
    }
  };

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
  const displayedIncidents = useMemo(
    () =>
      incidentFilter === 'active'
        ? activeIncidents
        : incidentFilter === 'resolved'
          ? resolvedIncidents
          : incidentsList,
    [incidentFilter, activeIncidents, resolvedIncidents, incidentsList]
  );

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

  const { overdueTimersCount, sosBeaconsCount, liveSafetyTotal } = useMemo(() => {
    let overdue = 0;
    let activeOrOverdue = 0;
    for (const t of safetyTimersList) {
      if (t.status === 'overdue_alerted') {
        overdue++;
        activeOrOverdue++;
      } else if (t.status === 'active') {
        activeOrOverdue++;
      }
    }
    let sos = 0;
    for (const b of liveBeaconsList) {
      if (b.status === 'sos') sos++;
    }
    return { overdueTimersCount: overdue, sosBeaconsCount: sos, liveSafetyTotal: activeOrOverdue + liveBeaconsList.length };
  }, [safetyTimersList, liveBeaconsList]);
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

  const { cockpitContributions, cockpitContributionsById } = useMemo(() => {
    const mapped: CockpitContributionPoint[] = [];
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
      };
      mapped.push(point);
      byId.set(id, point);
    }
    return { cockpitContributions: mapped, cockpitContributionsById: byId };
  }, [contributions]);

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

    // P1: Overdue Safety Timers
    for (const timer of safetyTimersList) {
      if (timer.status === 'overdue_alerted') {
        const userObj = typeof timer.userId === 'object' ? timer.userId : null;
        const trekkerName = userObj?.fullName || userObj?.username || 'Thành viên LOST';
        const fallback =
          typeof timer.lastKnownLat === 'number' && typeof timer.lastKnownLng === 'number'
            ? { lat: timer.lastKnownLat, lng: timer.lastKnownLng }
            : resolveTrailCoords(timer.trailName, timer.trailSlug);
        items.push({
          id: `overdue-${timer._id}`,
          kind: 'overdue',
          priority: 1,
          title: `Quá hạn báo bình an · ${trekkerName}`,
          subtitle: `${timer.trailName || 'Tuyến thực địa'} · Hạn ${formatDateVi(timer.expectedReturnAt)}`,
          meta: timer.emergencyContactPhone ? `Liên hệ: ${timer.emergencyContactPhone}` : 'Cần kiểm tra ngay',
          targetSection: 'safety',
          lat: fallback?.lat,
          lng: fallback?.lng,
        });
      }
    }

    // P1: Community-disputed incidents & critical active incidents
    for (const inc of cockpitIncidents) {
      if (!inc.isSynthetic && inc.disputesCount > 0) {
        seenIncidentIds.add(inc.id);
        items.push({
          id: `dispute-${inc.id}`,
          kind: 'dispute',
          priority: 1,
          title: `Khiếu nại tin giả · ${inc.trailName}`,
          subtitle: inc.description,
          meta: `${inc.disputesCount} báo cáo tranh chấp`,
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
          meta: inc.isSynthetic ? 'Nguồn vệ tinh' : formatDateVi(inc.reportedAt),
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
          title: `Đơn Porter/Guide · ${trailLabel}`,
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
          meta: inc.isSynthetic ? 'Vệ tinh · Chỉ đọc' : formatDateVi(inc.reportedAt),
          targetSection: 'incidents',
          lat: inc.lat,
          lng: inc.lng,
          selection: { kind: 'incident', data: inc },
        });
      }
    }

    return items.sort((a, b) => a.priority - b.priority);
  }, [cockpitBeacons, safetyTimersList, resolveTrailCoords, cockpitIncidents, cockpitContributions, inquiriesList]);

  const commandDeckStats = useMemo<AdminCommandDeckStats>(() => {
    const activeTimersCount = safetyTimersList.filter(
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
    safetyTimersList,
    reviewsTotal,
    threadsList.length,
    adminStats,
    urgentSafetyCount,
  ]);

  // Keep docked Spatial Inspector synced with live state mutations (approve, reject, resolve, role/ban)
  const liveInspectorSelection = useMemo<CockpitInspectorSelection | null>(() => {
    if (!inspectorSelection) return null;
    switch (inspectorSelection.kind) {
      case 'trail': {
        const fresh = cockpitTrailsById.get(inspectorSelection.data.id);
        return fresh ? { kind: 'trail', data: fresh } : inspectorSelection;
      }
      case 'contribution': {
        const fresh = cockpitContributionsById.get(inspectorSelection.data.id);
        return fresh ? { kind: 'contribution', data: fresh } : inspectorSelection;
      }
      case 'incident': {
        const fresh = cockpitIncidentsById.get(inspectorSelection.data.id);
        return fresh ? { kind: 'incident', data: fresh } : inspectorSelection;
      }
      case 'beacon': {
        const fresh = cockpitBeaconsById.get(inspectorSelection.data.id);
        return fresh ? { kind: 'beacon', data: fresh } : inspectorSelection;
      }
      case 'user': {
        const fresh = cockpitUsersById.get(inspectorSelection.data.id);
        return fresh ? { kind: 'user', data: fresh } : inspectorSelection;
      }
    }
  }, [
    inspectorSelection,
    cockpitTrailsById,
    cockpitContributionsById,
    cockpitIncidentsById,
    cockpitBeaconsById,
    cockpitUsersById,
  ]);

  const selectedInspectorId = liveInspectorSelection ? liveInspectorSelection.data.id : null;

  const lockedCoords = useMemo<{ lat: number; lng: number } | null>(() => {
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
    if (liveInspectorSelection.kind === 'incident' || liveInspectorSelection.kind === 'beacon') {
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
        : `${commandDeckStats.totalTrails} tuyến VN`;

  const handleInspectorEditTrail = useCallback(
    (trailId: string) => {
      const found = trailsList.find((t) => (t._id || t.id) === trailId);
      if (found) openEditTrailModal(found);
    },
    [trailsList]
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
    command: 'Chỉ huy',
    moderation: 'Kiểm duyệt',
    operations: 'Vận hành',
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
        label: 'Trung tâm Điều hành',
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
        label: 'Quản lý sự cố',
        icon: AlertTriangle,
        count: incidentsCount,
        alertTone: pendingDisputesCount > 0 || incidentsCount > 0 ? 'danger' : undefined,
        urgentTooltip: pendingDisputesCount > 0 ? `${pendingDisputesCount} khiếu nại tin giả` : undefined,
      },
      {
        id: 'field',
        group: 'moderation',
        label: 'Thực địa & Đánh giá',
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
        label: 'Kho cung đường',
        icon: Layers,
        count: totalTrailsCount,
      },
      {
        id: 'inquiries',
        group: 'operations',
        label: 'Đơn Porter / Guide',
        icon: IconBackpack,
        count: inquiriesCount,
        alertTone: pendingInquiriesCount > 0 ? 'warn' : undefined,
      },
      {
        id: 'safety',
        group: 'operations',
        label: 'An toàn & Đèn hiệu',
        icon: IconShieldAlert,
        count: safetyCount,
        alertTone: urgentSafetyCount > 0 ? 'danger' : undefined,
        urgentTooltip: urgentSafetyCount > 0 ? `${urgentSafetyCount} tín hiệu khẩn cấp` : undefined,
      },
      {
        id: 'stats',
        group: 'system',
        label: 'Thống kê hệ thống',
        icon: BarChart3,
      },
      {
        id: 'users',
        group: 'system',
        label: 'Thành viên & Quyền',
        icon: Users,
        count: usersCount,
        adminOnly: true,
      },
      {
        id: 'audit',
        group: 'system',
        label: 'Nhật ký kiểm toán',
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
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey || hasOpenModal) return;
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
      title: 'Trung tâm Điều hành',
      subtitle: 'Bản đồ tác chiến thực địa Việt Nam, hàng đợi ưu tiên và chỉ số vận hành thời gian thực.',
    },
    contributions: {
      title: 'Duyệt đóng góp cung đường',
      subtitle: 'Thẩm định tọa độ GPS, thông số địa hình và phê duyệt đóng góp cộng đồng lên bản đồ LOST.',
    },
    trails: {
      title: 'Kho cung đường trekking',
      subtitle: 'Quản lý danh mục tuyến thực địa Việt Nam, cập nhật cao độ, giấy phép và dữ liệu bản đồ.',
    },
    incidents: {
      title: 'Sự cố thực địa & Cứu hộ',
      subtitle: 'Theo dõi cảnh báo sạt lở, lũ quét, nguồn vệ tinh Open-Meteo / NASA và xử lý khiếu nại.',
    },
    inquiries: {
      title: 'Đơn đặt Porter & Hướng dẫn viên',
      subtitle: 'Điều phối yêu cầu thuê Porter/Guide bản địa, theo dõi dự toán và trạng thái xác nhận.',
    },
    safety: {
      title: 'An toàn & Đèn hiệu trực tiếp',
      subtitle: 'Giám sát Live Beacon GPS và Hẹn giờ báo bình an (Dead-Man Switch) theo thời gian thực.',
    },
    field: {
      title: 'Kiểm duyệt thực địa (POIs & Đánh giá)',
      subtitle: 'Cập nhật tình trạng nguồn nước, bãi trại, điểm nguy hiểm và xử lý đánh giá vi phạm.',
    },
    users: {
      title: 'Thành viên & Phân quyền',
      subtitle: 'Quản lý tài khoản, cấp vai trò Hướng dẫn viên (Guide), Điều hành viên (Mod) và xử lý vi phạm.',
    },
    forum: {
      title: 'Kiểm duyệt diễn đàn',
      subtitle: 'Ghim thông báo quan trọng, khóa bình luận hoặc gỡ bài viết vi phạm chuẩn mực cộng đồng.',
    },
    stats: {
      title: 'Thống kê hệ thống',
      subtitle: '12 chỉ số vận hành thời gian thực đồng bộ trực tiếp từ cơ sở dữ liệu MongoDB.',
    },
    audit: {
      title: 'Nhật ký kiểm toán',
      subtitle: 'Lưu vết minh bạch thao tác phân quyền, khóa tài khoản và thay đổi dữ liệu trong 180 ngày.',
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
            title="Trung tâm Điều hành LOST OPS"
          >
            <span className="admin-brand-glyph" aria-hidden="true">
              <Compass size={13} color="var(--color-primary)" />
            </span>
            <span className="admin-brand-title">LOST</span>
            <span className="admin-brand-env">OPS</span>
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
              alt="Ảnh đại diện Quản trị viên"
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
              <span>LOST Ops</span>
              <span className="admin-breadcrumb-sep">/</span>
              <span>{activeNavItem ? navGroupLabels[activeNavItem.group] : 'Quản trị'}</span>
              <span className="admin-breadcrumb-sep">/</span>
              <span className="admin-breadcrumb-current">
                {activeNavItem?.label || 'Bảng điều khiển'}
              </span>
            </div>
          </div>

          <div className="admin-topbar-right">
            <div
              className="admin-health-pill"
              title={`Cơ sở dữ liệu: ${dbHealth.label} · Kênh realtime: ${isSocketConnected ? 'Socket.IO đang kết nối' : 'Đang kết nối lại'}`}
            >
              <span className="admin-health-item">
                <span className={dbDotClass} aria-hidden="true" />
                <Database size={12} color="var(--color-text-dim)" />
                <span>DB</span>
              </span>
              <span style={{ opacity: 0.3 }} aria-hidden="true">·</span>
              <span className="admin-health-item">
                <span
                  className={isSocketConnected ? 'admin-dot admin-dot--ok' : 'admin-dot admin-dot--warn'}
                  aria-hidden="true"
                />
                <Radio size={12} color="var(--color-text-dim)" />
                <span>{isSocketConnected ? 'Live' : 'Sync'}</span>
              </span>
            </div>

            {onOpenCommandPalette && (
              <button
                type="button"
                className="admin-kbd-trigger"
                onClick={onOpenCommandPalette}
                title="Mở bảng lệnh nhanh (Ctrl+K)"
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
              title="Làm mới dữ liệu từ máy chủ"
              aria-label="Làm mới dữ liệu từ máy chủ"
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

              <div key={effectiveSection} className="tab-content-slide admin-section-block">
                {/* =========================================================================
                 * SECTION 0: TRUNG TÂM ĐIỀU HÀNH (GEO-OPS COMMAND DECK)
                 * ========================================================================= */}
                {effectiveSection === 'overview' && (
                  <AdminCommandDeck
                    trails={cockpitTrails}
                    incidents={cockpitIncidents}
                    beacons={cockpitBeacons}
                    triageItems={cockpitTriageItems}
                    stats={commandDeckStats}
                    selectedId={selectedInspectorId}
                    onSelect={handleSelectInspector}
                    onNavigateSection={handleSelectSection}
                    onPointerCoordChange={setHoverCoords}
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
                      <span className="admin-metric-label">Chờ phê duyệt</span>
                      <div className="admin-metric-value-row">
                        <span
                          className={`admin-metric-value ${pendingContributions.length > 0 ? 'admin-metric-value--warn' : ''}`}
                        >
                          {pendingContributions.length}
                        </span>
                        <span className="admin-metric-unit">hồ sơ</span>
                      </div>
                      <span className="admin-metric-caption">Cần thẩm định tọa độ &amp; thông số</span>
                    </div>

                    <div className="admin-metric-cell">
                      <span className="admin-metric-label">Đã duyệt công khai</span>
                      <div className="admin-metric-value-row">
                        <span className="admin-metric-value admin-metric-value--primary">
                          {approvedContributions.length}
                        </span>
                        <span className="admin-metric-unit">/ {contributions.length} đóng góp</span>
                      </div>
                      <span className="admin-metric-caption">Đã đồng bộ lên bản đồ 3D</span>
                    </div>

                    <div className="admin-metric-cell">
                      <span className="admin-metric-label">Kho cung hoạt động</span>
                      <div className="admin-metric-value-row">
                        <span className="admin-metric-value">{catalogTrailsCount}</span>
                        <span className="admin-metric-unit">tuyến VN</span>
                      </div>
                      <span className="admin-metric-caption">Đang hiển thị công khai trên LOST</span>
                    </div>

                    <div className="admin-metric-cell">
                      <span className="admin-metric-label">Độ chuẩn tọa độ đóng góp</span>
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

                  {/* Contributions Ledger */}
                  <div key={`${activeTab}-${searchQuery}`} className="admin-ledger tab-content-slide">
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
                              Mở trình đóng góp
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      displayedContributions.map((contrib) => {
                        const contribId = String(contrib.id || contrib._id || '');
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
                                minWidth: 260,
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleApprove(contribId, contrib.name || '');
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleReject(contribId, contrib.name || '');
                                  }}
                                  title="Từ chối bài đóng góp"
                                  aria-label="Từ chối bài đóng góp"
                                >
                                  <XCircle size={13} />
                                </button>
                              )}
                              <button
                                type="button"
                                className="admin-btn admin-btn--sm admin-btn--danger-ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteContribution(contribId, contrib.name || '');
                                }}
                                title="Xóa vĩnh viễn khỏi MongoDB"
                                aria-label="Xóa bài đóng góp"
                              >
                                <Trash2 size={13} />
                              </button>
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
                      <span>Danh mục tuyến thực địa</span>
                      <span className="admin-subhead-count">
                        {filteredTrails.length} / {trailsList.length}
                      </span>
                    </h2>
                    {!isStrictAdmin && (
                      <span className="admin-tag admin-tag--info">
                        Chỉ xem · Cần quyền Admin để sửa
                      </span>
                    )}
                  </div>

                  <div className="admin-search">
                    <Search size={14} color="var(--color-text-dim)" />
                    <input
                      type="text"
                      placeholder="Lọc theo tên cung, tỉnh thành, huyện..."
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
                            minWidth: 260,
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
                                <IconStar size={11} color="var(--color-sun)" />
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
                                {inc.severity?.toUpperCase() || 'HIGH'}
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
                                  'Cảnh báo thực địa'}
                              </span>
                              {synthetic ? (
                                <span className="admin-tag admin-tag--info">
                                  <IconSatellite size={11} /> Vệ tinh · Chỉ đọc
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
                                {synthetic ? 'Nguồn đo:' : 'Người phát:'}{' '}
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
                                    Khiếu nại cộng đồng: {inc.disputes.length} báo cáo tin giả
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
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleResolveDispute(incId, 'dismiss_incident');
                                    }}
                                  >
                                    <CheckCircle2 size={13} /> Chấp nhận khiếu nại (Gỡ cảnh báo)
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn--sm admin-btn--danger-ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleResolveDispute(incId, 'reject_dispute');
                                    }}
                                  >
                                    <XCircle size={13} /> Bác bỏ khiếu nại (Nguy hiểm thật)
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleResolveIncident(incId);
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
                                      inc.reporterEmail || inc.reporterName || 'Tài khoản báo giả'
                                    );
                                  }}
                                  title="Khóa tài khoản nếu phát hiện báo động giả"
                                >
                                  Khóa nick
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
                { id: 'admin', label: 'Admin', count: roleCounts.admin },
                { id: 'moderator', label: 'Mod', count: roleCounts.moderator },
                { id: 'guide', label: 'Guide', count: roleCounts.guide },
                { id: 'user', label: 'Trekker', count: roleCounts.user },
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
                        placeholder="Tìm theo tên, username, email..."
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
                                minWidth: 260,
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
                                    <span className="admin-tag admin-tag--warn">Admin</span>
                                  )}
                                  {u.role === 'moderator' && (
                                    <span className="admin-tag admin-tag--info">Mod</span>
                                  )}
                                  {u.role === 'guide' && (
                                    <span className="admin-tag admin-tag--ok">
                                      <ShieldCheck size={10} /> Guide
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
                                    Uy tín <strong>{u.reputationScore ?? 0}</strong> pts
                                  </span>
                                  <span>·</span>
                                  <span>{u.badges?.join(', ') || 'Trekker mới'}</span>
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
                                  void handleUpdateRole(uid, e.target.value, u.fullName || u.email || '')
                                }
                                disabled={u.email === currentUser?.email}
                                style={{
                                  height: 28,
                                  padding: '0 8px',
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                  borderRadius: 5,
                                }}
                              >
                                <option value="user">Trekker</option>
                                <option value="guide">Verified Guide</option>
                                <option value="moderator">Moderator</option>
                                <option value="admin">Admin</option>
                              </select>

                              {u.isBanned ? (
                                <button
                                  type="button"
                                  className="admin-btn admin-btn--sm admin-btn--primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleUnbanUser(uid, u.email || '');
                                  }}
                                >
                                  Mở khóa
                                </button>
                              ) : u.role !== 'admin' ? (
                                <button
                                  type="button"
                                  className="admin-btn admin-btn--sm admin-btn--danger-ghost"
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
                <div className="admin-subhead">
                  <h2 className="admin-subhead-title">
                    <span>Bài viết diễn đàn</span>
                    <span className="admin-subhead-count">{threadsList.length}</span>
                  </h2>
                </div>

                <div className="admin-ledger">
                  {threadsList.length === 0 ? (
                    <div className="admin-empty">
                      <div className="admin-empty-icon" aria-hidden="true">
                        <MessageSquare size={18} />
                      </div>
                      <h3 className="admin-empty-title">Chưa có bài viết nào trên diễn đàn</h3>
                      <p className="admin-empty-desc">
                        Bài thảo luận và tìm bạn đồng hành mới sẽ hiển thị tại đây để kiểm duyệt.
                      </p>
                    </div>
                  ) : (
                    threadsList.map((t) => {
                      const tid = t.id || t._id;
                      return (
                        <div key={tid} className="admin-ledger-row admin-ledger-row--center">
                          <div className="admin-ledger-main">
                            <div className="admin-ledger-title-line">
                              {t.isPinned && (
                                <span className="admin-tag admin-tag--warn">
                                  <IconPin size={10} color="var(--color-sun)" /> Ghim
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
                              onClick={() => handlePinThread(tid || '')}
                            >
                              <IconPin size={12} color="currentColor" />
                              <span>{t.isPinned ? 'Bỏ ghim' : 'Ghim'}</span>
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm admin-btn--warn-ghost"
                              onClick={() => handleLockThread(tid || '')}
                            >
                              {!t.isLocked && <IconLock size={12} color="currentColor" />}
                              <span>{t.isLocked ? 'Mở khóa' : 'Khóa'}</span>
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm admin-btn--danger-ghost"
                              onClick={() => handleDeleteThread(tid || '', t.title || '')}
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
                  title: 'Dữ liệu bản đồ & Thực địa',
                  items: [
                    {
                      key: 'totalTrails',
                      label: 'Cung đường công khai',
                      value: adminStats?.totalTrails ?? trailsList.length,
                      subtitle: 'Tuyến thực địa đã duyệt bản đồ',
                      tone: 'primary',
                    },
                    {
                      key: 'totalContributions',
                      label: 'Tổng bài đóng góp',
                      value: adminStats?.totalContributions ?? contributions.length,
                      subtitle: 'Hồ sơ đóng góp từ cộng đồng',
                    },
                    {
                      key: 'pendingContributions',
                      label: 'Chờ kiểm duyệt',
                      value: adminStats?.pendingContributions ?? pendingContributions.length,
                      subtitle: 'Cần BQT xác thực tọa độ GPS',
                      tone:
                        (adminStats?.pendingContributions ?? pendingContributions.length) > 0
                          ? 'warn'
                          : 'default',
                    },
                    {
                      key: 'totalCheckins',
                      label: 'Lượt check-in đỉnh',
                      value: adminStats?.totalCheckins ?? 0,
                      subtitle: 'Hộ chiếu chinh phục thực địa',
                    },
                  ],
                },
                {
                  title: 'Cộng đồng & Nội dung',
                  items: [
                    {
                      key: 'totalUsers',
                      label: 'Tổng thành viên',
                      value: adminStats?.totalUsers ?? usersList.length,
                      subtitle: 'Tài khoản đăng ký trên LOST',
                    },
                    {
                      key: 'totalThreads',
                      label: 'Chủ đề diễn đàn',
                      value: adminStats?.totalThreads ?? threadsList.length,
                      subtitle: 'Thảo luận cộng đồng trekking',
                    },
                    {
                      key: 'totalReviews',
                      label: 'Đánh giá cung đường',
                      value: adminStats?.totalReviews ?? reviewsTotal,
                      subtitle: 'Nhận xét & chấm điểm thực địa',
                    },
                    {
                      key: 'totalTripReports',
                      label: 'Nhật ký hành trình',
                      value: adminStats?.totalTripReports ?? 0,
                      subtitle: 'Ký sự & ảnh chuyến đi chia sẻ',
                    },
                  ],
                },
                {
                  title: 'An toàn & Điều phối',
                  items: [
                    {
                      key: 'totalIncidents',
                      label: 'Sự cố đang cảnh báo',
                      value: adminStats?.totalIncidents ?? activeIncidentsCount,
                      subtitle: 'Cảnh báo thực địa chưa gỡ',
                      tone:
                        (adminStats?.totalIncidents ?? activeIncidentsCount) > 0
                          ? 'danger'
                          : 'default',
                    },
                    {
                      key: 'activeSafetyTimers',
                      label: 'Hẹn giờ an toàn chạy',
                      value:
                        adminStats?.activeSafetyTimers ??
                        safetyTimersList.filter((t) => t.status === 'active').length,
                      subtitle: 'Dead-Man Switch đang giám sát',
                      tone:
                        (adminStats?.activeSafetyTimers ?? 0) > 0 ? 'warn' : 'default',
                    },
                    {
                      key: 'totalGuides',
                      label: 'Porter & HDV hoạt động',
                      value: adminStats?.totalGuides ?? 0,
                      subtitle: 'Hướng dẫn viên bản địa xác thực',
                    },
                    {
                      key: 'totalTripPlans',
                      label: 'Kế hoạch ghép đoàn',
                      value: adminStats?.totalTripPlans ?? 0,
                      subtitle: 'Lịch trình tìm bạn đồng hành',
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
                <div className="admin-subhead">
                  <h2 className="admin-subhead-title">
                    <span>Lịch sử thao tác quản trị</span>
                    <span className="admin-subhead-count">{auditLogs.length}</span>
                  </h2>
                </div>

                <div className="admin-ledger">
                  {auditLogs.length === 0 ? (
                    <div className="admin-empty">
                      <div className="admin-empty-icon" aria-hidden="true">
                        <ShieldCheck size={18} />
                      </div>
                      <h3 className="admin-empty-title">Chưa có bản ghi kiểm toán</h3>
                      <p className="admin-empty-desc">
                        Mọi thao tác sửa/xóa cung đường, khóa tài khoản và đổi quyền sẽ được lưu vết tự động tại đây.
                      </p>
                    </div>
                  ) : (
                    auditLogs.map((log: AdminAuditLogItem) => (
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
                    <div className="admin-tabs" role="tablist" aria-label="Trạng thái đơn Porter/Guide">
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
                        placeholder="Tìm khách, SĐT, Guide, cung đường..."
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
                        <h3 className="admin-empty-title">Chưa có đơn đặt Porter / Guide phù hợp</h3>
                        <p className="admin-empty-desc">
                          Yêu cầu thuê hướng dẫn viên bản địa từ người dùng sẽ hiển thị tại đây.
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
                                  · Guide: <strong>{guideObj?.name || 'HDV bản địa'}</strong>
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
                                <span>· {inq.needPortersCount || 0} Porter thêm</span>
                                <span>· Gửi {formatDateVi(inq.createdAt)}</span>
                              </div>

                              {inq.notes && (
                                <div className="admin-note-box">
                                  Ghi chú khách hàng: &ldquo;{inq.notes}&rdquo;
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
             * SECTION 9: AN TOÀN & ĐÈN HIỆU (SAFETY TIMERS + LIVE BEACONS)
             * ========================================================================= */}
            {effectiveSection === 'safety' && (() => {
              const activeBeaconsCount = liveBeaconsList.filter((b) => b.status === 'active').length;
              const activeTimersCount = safetyTimersList.filter((t) => t.status === 'active').length;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Hairline Safety Telemetry Ribbon */}
                  <div className="admin-metric-ribbon">
                    <div className="admin-metric-cell">
                      <span className="admin-metric-label">Đèn hiệu SOS khẩn cấp</span>
                      <div className="admin-metric-value-row">
                        <span
                          className={`admin-metric-value ${sosBeaconsCount > 0 ? 'admin-metric-value--danger' : ''}`}
                        >
                          {sosBeaconsCount}
                        </span>
                      </div>
                      <span className="admin-metric-caption">Ưu tiên phối hợp cứu nạn ngay</span>
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
                      <span className="admin-metric-label">Live Beacon đang phát</span>
                      <div className="admin-metric-value-row">
                        <span className="admin-metric-value">{activeBeaconsCount}</span>
                      </div>
                      <span className="admin-metric-caption">Tín hiệu GPS chia sẻ trực tiếp</span>
                    </div>

                    <div className="admin-metric-cell">
                      <span className="admin-metric-label">Hẹn giờ an toàn chạy</span>
                      <div className="admin-metric-value-row">
                        <span className="admin-metric-value admin-metric-value--primary">
                          {activeTimersCount}
                        </span>
                      </div>
                      <span className="admin-metric-caption">Dead-Man Switch trong hạn an toàn</span>
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
                        <span>Đèn hiệu GPS trực tiếp (Live Beacons)</span>
                        <span className="admin-subhead-count">{liveBeaconsList.length}</span>
                      </h2>
                    </div>

                    <div className="admin-ledger">
                      {liveBeaconsList.length === 0 ? (
                        <div className="admin-empty">
                          <div className="admin-empty-icon" aria-hidden="true">
                            <Radio size={18} />
                          </div>
                          <h3 className="admin-empty-title">Không có phiên Live Beacon đang phát</h3>
                          <p className="admin-empty-desc">
                            Tín hiệu SOS hoặc chia sẻ hành trình GPS trực tiếp sẽ tự động ghim lên đầu danh sách.
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
                                      <IconShieldAlert size={11} /> SOS Khẩn cấp
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
                                      Mất ping {beacon.minutesSinceLastPing} phút
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
                                  <span>· Ping cuối {formatDateVi(beacon.lastPingAt)}</span>
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
                                  <span>Mở bản đồ</span>
                                </a>
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
                          <span>Hẹn giờ báo bình an (Safety Timers)</span>
                          <span className="admin-subhead-count">{safetyTimersList.length}</span>
                        </h2>
                      </div>

                      <div className="admin-tabs" role="tablist" aria-label="Trạng thái hẹn giờ an toàn">
                        {(
                          [
                            { id: 'live', label: 'Đang chạy & Quá hạn' },
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
                      {safetyTimersList.length === 0 ? (
                        <div className="admin-empty">
                          <div className="admin-empty-icon" aria-hidden="true">
                            <Clock size={18} />
                          </div>
                          <h3 className="admin-empty-title">Không có lịch hẹn trong trạng thái này</h3>
                          <p className="admin-empty-desc">
                            Các lịch hẹn báo bình an đang hoạt động hoặc quá hạn sẽ hiển thị tại đây.
                          </p>
                        </div>
                      ) : (
                        safetyTimersList.map((timer) => {
                          const isOverdue = timer.status === 'overdue_alerted';
                          const userObj = typeof timer.userId === 'object' ? timer.userId : null;
                          const hasCoords =
                            typeof timer.lastKnownLat === 'number' &&
                            typeof timer.lastKnownLng === 'number';

                          return (
                            <div
                              key={timer._id}
                              className={`admin-ledger-row ${isOverdue ? 'admin-ledger-row--urgent' : ''}`}
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
                                      Đang giám sát
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
                                  {userObj?.phone && <span>· SĐT Trekker: {userObj.phone}</span>}
                                </div>

                                {timer.notes && (
                                  <div className="admin-note-box">Ghi chú: {timer.notes}</div>
                                )}
                              </div>

                              {hasCoords && (
                                <div className="admin-ledger-actions">
                                  <a
                                    href={`https://www.google.com/maps?q=${timer.lastKnownLat},${timer.lastKnownLng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="admin-btn admin-btn--sm"
                                  >
                                    <IconMapPin size={12} />
                                    <span>
                                      {timer.lastKnownLat!.toFixed(4)},{' '}
                                      {timer.lastKnownLng!.toFixed(4)}
                                    </span>
                                    <ExternalLinkIcon size={11} />
                                  </a>
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
                  <div className="admin-tabs" role="tablist" aria-label="Phân loại dữ liệu thực địa">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={fieldSubTab === 'pois'}
                      className={`admin-tab-btn ${fieldSubTab === 'pois' ? 'active' : ''}`}
                      onClick={() => setFieldSubTab('pois')}
                    >
                      <span>Điểm thực địa (POIs)</span>
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
                          ? 'Lọc tên POI, cung đường, tác giả...'
                          : 'Lọc cung đường, người đánh giá, nội dung...'
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
                        aria-label="Xóa lọc kiểm duyệt thực địa"
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
                        <h3 className="admin-empty-title">Không tìm thấy điểm thực địa phù hợp</h3>
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
                                  {isClosed ? 'Đã cạn / Đóng' : 'Đang hoạt động'}
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
                                {isClosed ? 'Mở hoạt động' : 'Đánh dấu cạn/đóng'}
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
                          Đánh giá thực địa của người dùng sẽ hiển thị tại đây để kiểm duyệt.
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
                                    color: 'var(--color-sun)',
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
                                      color="var(--color-sun)"
                                      fill={star <= Math.round(rev.rating) ? 'var(--color-sun)' : 'none'}
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
              onClose={handleCloseInspector}
              onEditTrail={handleInspectorEditTrail}
              onDeleteTrail={handleDeleteTrail}
              onApproveContribution={handleApprove}
              onRejectContribution={handleReject}
              onInspectContributionModal={handleInspectorOpenContribModal}
              onResolveIncident={handleResolveIncident}
              onNavigateSection={handleSelectSection}
            />
          )}
        </div>

        {/* Bottom 30px Tactile Instrument Status Bar (isolated 1Hz Vietnam ICT clock) */}
        <AdminStatusBar
          readiness={statusReadiness}
          readinessDetail={statusReadinessDetail}
          activeCoords={hoverCoords ?? lockedCoords}
          isCoordLocked={!hoverCoords && Boolean(lockedCoords)}
          dbStatus={dbHealth.status}
          dbLabel={dbHealth.label}
          isSocketConnected={isSocketConnected}
        />
      </div>

      {/* =========================================================================
       * CONTRIBUTION DETAIL INSPECTION MODAL
       * ========================================================================= */}
      {selectedContribution &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => setSelectedContribution(null)}
            style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}
          >
            <div
              ref={contribModalRef}
              tabIndex={-1}
              className="modal-content"
              role="dialog"
              aria-modal="true"
              aria-label="Kiểm duyệt hồ sơ đóng góp cung đường"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 780,
                width: '95%',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: 24,
                borderRadius: 6,
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-strong)',
                boxShadow: 'var(--shadow-3d)',
                outline: 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 18,
                  borderBottom: '1px solid var(--color-border)',
                  paddingBottom: 14,
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      color: 'var(--color-primary)',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Hồ sơ đóng góp cung đường #<code>{selectedContribution.id || selectedContribution._id}</code>
                  </span>
                  <h3
                    style={{
                      fontSize: '1.35rem',
                      color: 'var(--color-text-main)',
                      fontWeight: 800,
                      margin: '4px 0 0 0',
                    }}
                  >
                    {selectedContribution.name || 'Cung đường Trekking mới'}
                  </h3>
                </div>
                <span
                  style={{
                    background:
                      selectedContribution.status === 'approved'
                        ? 'var(--color-primary)'
                        : selectedContribution.status === 'rejected'
                          ? 'var(--color-error)'
                          : 'var(--color-sun)',
                    color:
                      selectedContribution.status === 'rejected'
                        ? 'var(--color-on-danger)'
                        : 'var(--color-on-primary)',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    padding: '5px 12px',
                    borderRadius: 4,
                  }}
                >
                  {selectedContribution.status === 'approved'
                    ? 'Đã Duyệt & Công Khai'
                    : selectedContribution.status === 'rejected'
                      ? 'Đã Từ Chối'
                      : 'Chờ BQT Duyệt (+50 PTS)'}
                </span>
              </div>

              {selectedContribution.coverImage && (
                <div
                  style={{
                    height: 240,
                    borderRadius: 4,
                    overflow: 'hidden',
                    marginBottom: 20,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    loading="lazy"
                    decoding="async"
                    src={selectedContribution.coverImage}
                    alt={selectedContribution.name}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = DEFAULT_TRAIL_COVER;
                    }}
                  />
                </div>
              )}

              {/* SECTION 1 */}
              <div
                style={{
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  padding: 16,
                  borderRadius: 4,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    color: 'var(--color-primary)',
                    textTransform: 'uppercase',
                    marginBottom: 10,
                  }}
                >
                  1. ĐỊA ĐIỂM HÀNH CHÍNH &amp; VÙNG MIỀN
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 10,
                    fontSize: '0.82rem',
                    color: 'var(--color-text-main)',
                  }}
                >
                  <div>
                    · <strong>Vùng miền:</strong> {selectedContribution.region || 'Chưa cập nhật'}
                  </div>
                  <div>
                    · <strong>Tỉnh / Thành:</strong> {selectedContribution.province || 'Chưa cập nhật'}
                  </div>
                  <div>
                    · <strong>Quận / Huyện / Xã:</strong> {selectedContribution.district || 'Chưa cập nhật'}
                  </div>
                  <div>
                    · <strong>Thôn / Cửa rừng:</strong> {selectedContribution.hamlet || 'Chưa nhập'}
                  </div>
                </div>
              </div>

              {/* SECTION 2 */}
              <div
                style={{
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  padding: 16,
                  borderRadius: 4,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    color: 'var(--color-primary)',
                    textTransform: 'uppercase',
                    marginBottom: 10,
                  }}
                >
                  2. THÔNG SỐ KỸ THUẬT CUNG ĐƯỜNG
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      background: 'var(--color-bg-card)',
                      padding: 10,
                      borderRadius: 4,
                      border: '1px solid var(--color-border)',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Chiều dài</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 2 }}>
                      {selectedContribution.distanceKm} km
                    </div>
                  </div>
                  <div
                    style={{
                      background: 'var(--color-bg-card)',
                      padding: 10,
                      borderRadius: 4,
                      border: '1px solid var(--color-border)',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Độ cao nâng</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-sky)', marginTop: 2 }}>
                      +{selectedContribution.elevationGainM} m
                    </div>
                  </div>
                  <div
                    style={{
                      background: 'var(--color-bg-card)',
                      padding: 10,
                      borderRadius: 4,
                      border: '1px solid var(--color-border)',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Đỉnh cao nhất</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-earth)', marginTop: 2 }}>
                      {selectedContribution.maxAltitudeM} m
                    </div>
                  </div>
                  <div
                    style={{
                      background: 'var(--color-bg-card)',
                      padding: 10,
                      borderRadius: 4,
                      border: '1px solid var(--color-border)',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Mức độ khó</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-sun)', marginTop: 2 }}>
                      {selectedContribution.difficultyLevel}/5
                    </div>
                  </div>
                  <div
                    style={{
                      background: 'var(--color-bg-card)',
                      padding: 10,
                      borderRadius: 4,
                      border: '1px solid var(--color-border)',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Thời gian đi</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 2 }}>
                      {selectedContribution.durationHoursNote || '1 ngày'}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3 */}
              <div
                style={{
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  padding: 16,
                  borderRadius: 4,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    color: 'var(--color-primary)',
                    textTransform: 'uppercase',
                    marginBottom: 10,
                  }}
                >
                  3. TỌA ĐỘ GPS ĐÁNH DẤU TRÊN BẢN ĐỒ
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 12,
                    fontSize: '0.82rem',
                    color: 'var(--color-text-main)',
                  }}
                >
                  <div
                    style={{
                      background: 'var(--color-bg-card)',
                      padding: 10,
                      borderRadius: 4,
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <strong style={{ color: 'var(--color-primary)' }}>· Tọa độ Xuất Phát (Start):</strong>
                    <div style={{ marginTop: 4 }}>
                      <code>
                        Lat: {selectedContribution.startLat}, Lng: {selectedContribution.startLng}
                      </code>
                    </div>
                  </div>
                  <div
                    style={{
                      background: 'var(--color-bg-card)',
                      padding: 10,
                      borderRadius: 4,
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <strong style={{ color: 'var(--color-error-text, var(--color-error))' }}>· Tọa độ Kết Thúc (End):</strong>
                    <div style={{ marginTop: 4 }}>
                      <code>
                        Lat: {selectedContribution.endLat}, Lng: {selectedContribution.endLng}
                      </code>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4 */}
              <div
                style={{
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  padding: 16,
                  borderRadius: 4,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    color: 'var(--color-primary)',
                    textTransform: 'uppercase',
                    marginBottom: 10,
                  }}
                >
                  4. MÔ TẢ CHI TIẾT &amp; HƯỚNG DẪN DI CHUYỂN
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: 'var(--color-text-main)',
                      marginBottom: 4,
                    }}
                  >
                    Mô tả tổng quan:
                  </div>
                  <p
                    style={{
                      color: 'var(--color-text-main)',
                      fontSize: '0.84rem',
                      lineHeight: 1.6,
                      margin: 0,
                      whiteSpace: 'pre-line',
                      background: 'var(--color-bg-card)',
                      padding: 12,
                      borderRadius: 4,
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {selectedContribution.description || 'Chưa nhập nội dung mô tả.'}
                  </p>
                </div>

                {selectedContribution.transportationInfo && (
                  <div>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: 'var(--color-text-main)',
                        marginBottom: 4,
                      }}
                    >
                      Hướng dẫn di chuyển &amp; Phương tiện:
                    </div>
                    <p
                      style={{
                        color: 'var(--color-text-muted)',
                        fontSize: '0.82rem',
                        lineHeight: 1.5,
                        margin: 0,
                        whiteSpace: 'pre-line',
                        background: 'var(--color-bg-card)',
                        padding: 12,
                        borderRadius: 4,
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      {selectedContribution.transportationInfo}
                    </p>
                  </div>
                )}
              </div>

              {/* SECTION 5 */}
              <div
                style={{
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  padding: 16,
                  borderRadius: 4,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    color: 'var(--color-primary)',
                    textTransform: 'uppercase',
                    marginBottom: 10,
                  }}
                >
                  5. QUY ĐỊNH GIẤY PHÉP &amp; TIỆN ÍCH
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 10,
                    fontSize: '0.82rem',
                    color: 'var(--color-text-main)',
                  }}
                >
                  <div>
                    · <strong>Giấy phép:</strong>{' '}
                    {selectedContribution.permitRequired
                      ? selectedContribution.permitInfo || 'Cần xin giấy phép'
                      : 'Không cần giấy phép'}
                  </div>
                  <div>
                    · <strong>Bãi cắm trại:</strong>{' '}
                    {selectedContribution.hasCampsite ? 'Có bãi cắm trại' : 'Không có'}
                  </div>
                  <div>
                    · <strong>Nguồn nước:</strong>{' '}
                    {selectedContribution.hasWaterSource ? 'Có nguồn nước' : 'Không có'}
                  </div>
                  <div>
                    · <strong>Trẻ em:</strong>{' '}
                    {selectedContribution.kidFriendly ? 'Phù hợp cho trẻ em' : 'Không phù hợp'}
                  </div>
                </div>
              </div>

              {/* SECTION 6: Thành Viên Đóng Góp */}
              {(() => {
                const liveContrib =
                  contributions.find(
                    (c) =>
                      c.id === selectedContribution.id || c._id === selectedContribution._id
                  ) || selectedContribution;
                const matchedUser =
                  usersList.find(
                    (u) =>
                      (liveContrib.userId &&
                        (u._id === liveContrib.userId || u.id === liveContrib.userId)) ||
                      (liveContrib.authorEmail &&
                        u.email?.toLowerCase() === liveContrib.authorEmail.toLowerCase())
                  ) ||
                  (currentUser?.email &&
                  liveContrib.authorEmail &&
                  currentUser.email.toLowerCase() === liveContrib.authorEmail.toLowerCase()
                    ? currentUser
                    : null);

                const displayAuthorName =
                  liveContrib.authorName &&
                  liveContrib.authorName !== 'Trekker Đóng Góp' &&
                  liveContrib.authorName !== 'Người dùng LOST'
                    ? liveContrib.authorName
                    : matchedUser?.fullName ||
                      matchedUser?.name ||
                      liveContrib.authorName ||
                      'Trekker Đóng Góp';

                const displayAuthorEmail =
                  liveContrib.authorEmail || matchedUser?.email || 'Chưa cập nhật email';

                const displayAuthorAvatar =
                  liveContrib.authorAvatar ||
                  matchedUser?.avatarUrl ||
                  matchedUser?.avatar ||
                  DEFAULT_AVATAR;

                const handleOpenAuthorProfile = () => {
                  const authorContribs = contributions.filter(
                    (c) =>
                      (c.authorEmail &&
                        displayAuthorEmail &&
                        c.authorEmail.toLowerCase() === displayAuthorEmail.toLowerCase()) ||
                      (c.authorName &&
                        displayAuthorName &&
                        c.authorName.toLowerCase() === displayAuthorName.toLowerCase())
                  );

                  const approvedCount = authorContribs.filter((c) => c.status === 'approved').length;
                  const pendingCount = authorContribs.filter((c) => c.status === 'pending').length;
                  const realId = String(
                    matchedUser?._id || matchedUser?.id || liveContrib.userId || ''
                  ).trim();
                  const realRep = Number(matchedUser?.reputationScore ?? 0);
                  const realRole = matchedUser?.role || 'user';
                  const realProvider =
                    matchedUser?.authProvider === 'google' ? 'Google OAuth 2.0' : 'Email / OTP';
                  const isVerified = Boolean(
                    matchedUser?.isEmailVerified || matchedUser?.authProvider === 'google'
                  );

                  setSelectedAuthorModal({
                    userId: realId,
                    name: displayAuthorName,
                    email: displayAuthorEmail,
                    avatar: displayAuthorAvatar,
                    date: liveContrib.createdAt || 'Chưa ghi nhận',
                    contribCount: authorContribs.length || 1,
                    approvedCount,
                    pendingCount,
                    authorContribs,
                    reputationScore: realRep,
                    role: realRole,
                    authProvider: realProvider,
                    isVerified,
                    expeditionId: realId ? `LS-${realId.slice(-6).toUpperCase()}` : 'Chưa đồng bộ ID',
                  });
                };

                return (
                  <div
                    style={{
                      background: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border)',
                      padding: 16,
                      borderRadius: 4,
                      marginBottom: 20,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 12,
                        flexWrap: 'wrap',
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          color: 'var(--color-primary)',
                          textTransform: 'uppercase',
                        }}
                      >
                        6. THÔNG TIN THÀNH VIÊN ĐÓNG GÓP
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-sky)', fontWeight: 700 }}>
                        Bấm vào thẻ để xem hồ sơ năng lực chi tiết
                      </span>
                    </div>

                    <div
                      role="button"
                      tabIndex={0}
                      onClick={handleOpenAuthorProfile}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleOpenAuthorProfile();
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        background: 'var(--color-bg-card)',
                        padding: 14,
                        borderRadius: 4,
                        border: '1px solid var(--color-border)',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s ease',
                      }}
                    >
                      <img
                        loading="lazy"
                        decoding="async"
                        src={displayAuthorAvatar}
                        alt={displayAuthorName}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          border: '2px solid var(--color-primary)',
                          objectFit: 'cover',
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.98rem',
                              fontWeight: 800,
                              color: 'var(--color-text-main)',
                            }}
                          >
                            {displayAuthorName}
                          </span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                              color: 'var(--color-primary)',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <ShieldCheck size={11} /> Thành viên đóng góp
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.78rem',
                            color: 'var(--color-text-muted)',
                            marginTop: 3,
                          }}
                        >
                          Email:{' '}
                          <strong style={{ color: 'var(--color-primary)' }}>{displayAuthorEmail}</strong> ·
                          Ngày gửi: <strong>{formatDateVi(liveContrib.createdAt)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: 16,
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setSelectedContribution(null)}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Đóng
                </button>

                {selectedContribution.status === 'pending' && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() =>
                      handleReject(
                        selectedContribution.id || selectedContribution._id || '',
                        selectedContribution.name || ''
                      )
                    }
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      color: 'var(--color-sun)',
                      borderColor: 'color-mix(in srgb, var(--color-sun) 40%, transparent)',
                      gap: 6,
                    }}
                  >
                    <XCircle size={16} /> Từ Chối
                  </button>
                )}

                {selectedContribution.status !== 'approved' && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() =>
                      handleApprove(
                        selectedContribution.id || selectedContribution._id || '',
                        selectedContribution.name || ''
                      )
                    }
                    style={{ flex: 1.5, justifyContent: 'center', gap: 6 }}
                  >
                    <CheckCircle2 size={16} /> Phê Duyệt &amp; Đưa Lên Bản Đồ
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* =========================================================================
       * MEMBER PROFILE DOSSIER MODAL
       * ========================================================================= */}
      {selectedAuthorModal &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => setSelectedAuthorModal(null)}
            style={{ zIndex: 'var(--z-modal-nested, 3100)' as unknown as number }}
          >
            <div
              ref={authorModalRef}
              tabIndex={-1}
              className="modal-content"
              role="dialog"
              aria-modal="true"
              aria-label="Hồ sơ tác giả đóng góp"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 580,
                width: '95%',
                maxHeight: '90vh',
                overflowY: 'auto',
                border: '1px solid var(--color-border-strong)',
                padding: 24,
                borderRadius: 6,
                background: 'var(--color-bg-card)',
                boxShadow: 'var(--shadow-3d)',
                outline: 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 18,
                  borderBottom: '1px solid var(--color-border)',
                  paddingBottom: 12,
                }}
              >
                <div
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <ShieldCheck size={20} /> Hồ Sơ Thám Hiểm &amp; Năng Lực Thành Viên
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAuthorModal(null)}
                  aria-label="Đóng hồ sơ thành viên"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    padding: 4,
                  }}
                >
                  <IconX size={20} />
                </button>
              </div>

              <div
                style={{
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-primary)',
                  padding: 18,
                  borderRadius: 4,
                  marginBottom: 20,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <img
                    loading="lazy"
                    decoding="async"
                    src={selectedAuthorModal.avatar}
                    alt={selectedAuthorModal.name}
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      border: '2px solid var(--color-primary)',
                      objectFit: 'cover',
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 900,
                          color: 'var(--color-text-main)',
                        }}
                      >
                        {selectedAuthorModal.name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: selectedAuthorModal.isVerified
                            ? 'var(--color-primary)'
                            : 'var(--color-sun)',
                          color: 'var(--color-on-primary)',
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <ShieldCheck size={11} />{' '}
                        {selectedAuthorModal.isVerified ? 'Đã Xác Thực' : 'Chưa Xác Thực'}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--color-primary)',
                        fontWeight: 800,
                        marginTop: 4,
                      }}
                    >
                      Mã Thành Viên: {selectedAuthorModal.expeditionId} · Vai trò:{' '}
                      {(selectedAuthorModal.role || 'user').toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    padding: 12,
                    borderRadius: 4,
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Email</div>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      color: 'var(--color-primary)',
                      wordBreak: 'break-all',
                      marginTop: 2,
                    }}
                  >
                    {selectedAuthorModal.email}
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    padding: 12,
                    borderRadius: 4,
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    Số Bài Đóng Góp
                  </div>
                  <div
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 900,
                      color: 'var(--color-text-main)',
                      marginTop: 2,
                    }}
                  >
                    {selectedAuthorModal.contribCount} bài ({selectedAuthorModal.approvedCount} đã duyệt)
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    padding: 12,
                    borderRadius: 4,
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    Điểm Uy Tín Hệ Thống
                  </div>
                  <div
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 900,
                      color: 'var(--color-primary)',
                      marginTop: 2,
                    }}
                  >
                    {selectedAuthorModal.reputationScore ?? 0} PTS
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    padding: 12,
                    borderRadius: 4,
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    Phương Thức Xác Thực
                  </div>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      color: 'var(--color-sky)',
                      marginTop: 2,
                    }}
                  >
                    {selectedAuthorModal.authProvider || 'Email / OTP'}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: 16,
                }}
              >
                {selectedAuthorModal.userId && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      localStorage.setItem('lost_target_chat_user', selectedAuthorModal.userId || '');
                      setSelectedAuthorModal(null);
                      setSelectedContribution(null);
                      window.location.hash = '#messages';
                    }}
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      padding: '10px 16px',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                    }}
                  >
                    Nhắn Tin Trực Tiếp
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setSelectedAuthorModal(null)}
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    padding: '10px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* =========================================================================
       * EXPANDED INLINE EDIT TRAIL MODAL (ALL BACKEND EDITABLE FIELDS)
       * ========================================================================= */}
      {editingTrailModal &&
        isStrictAdmin &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => !isSavingTrail && setEditingTrailModal(null)}
            style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}
          >
            <div
              ref={editTrailModalRef}
              tabIndex={-1}
              className="modal-content"
              role="dialog"
              aria-modal="true"
              aria-label="Chỉnh sửa đầy đủ thông số cung đường"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 780,
                width: '95%',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: 24,
                borderRadius: 6,
                outline: 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <h3
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    color: 'var(--color-text-main)',
                    margin: 0,
                  }}
                >
                  Chỉnh Sửa Cung Đường: {editingTrailModal.name}
                </h3>
                <button
                  type="button"
                  onClick={() => !isSavingTrail && setEditingTrailModal(null)}
                  aria-label="Đóng cửa sổ chỉnh sửa"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <IconX size={20} />
                </button>
              </div>

              <form
                onSubmit={handleSaveTrailEdit}
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                <div
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    color: 'var(--color-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  1. Định danh &amp; Địa lý hành chính
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                    gap: 12,
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">Tên cung đường *</label>
                    <input
                      className="form-input"
                      value={editTrailForm.name}
                      onChange={(e) => setEditTrailForm({ ...editTrailForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tên gọi khác (cách nhau bằng dấu phẩy)</label>
                    <input
                      className="form-input"
                      placeholder="VD: Bạch Mộc Lương Tử, Ky Quan San"
                      value={editTrailForm.altNames}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, altNames: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tỉnh / Thành phố *</label>
                    <input
                      className="form-input"
                      value={editTrailForm.province}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, province: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quận / Huyện / Thị xã</label>
                    <input
                      className="form-input"
                      value={editTrailForm.district}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, district: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vùng miền *</label>
                    <select
                      className="form-select"
                      value={editTrailForm.region}
                      onChange={(e) =>
                        setEditTrailForm({
                          ...editTrailForm,
                          region: normalizeRegion(e.target.value),
                        })
                      }
                    >
                      <option value="Miền Bắc">Miền Bắc</option>
                      <option value="Miền Trung">Miền Trung</option>
                      <option value="Miền Nam">Miền Nam</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Trạng thái hiển thị</label>
                    <select
                      className="form-select"
                      value={editTrailForm.status}
                      onChange={(e) =>
                        setEditTrailForm({
                          ...editTrailForm,
                          status:
                            e.target.value === 'pending' || e.target.value === 'rejected'
                              ? e.target.value
                              : 'approved',
                        })
                      }
                    >
                      <option value="approved">Đã duyệt (Công khai)</option>
                      <option value="pending">Chờ duyệt (Ẩn công khai)</option>
                      <option value="rejected">Từ chối</option>
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    color: 'var(--color-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginTop: 4,
                  }}
                >
                  2. Thông số kỹ thuật &amp; Mùa đẹp
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: 12,
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">Cự ly (km) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      className="form-input"
                      value={editTrailForm.distanceKm}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, distanceKm: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Độ cao tích lũy (m) *</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      value={editTrailForm.elevationGainM}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, elevationGainM: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Độ cao đỉnh (m) *</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      value={editTrailForm.maxAltitudeM}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, maxAltitudeM: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Số ngày (durationDays)</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      className="form-input"
                      value={editTrailForm.durationDays}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, durationDays: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ghi chú thời lượng</label>
                    <input
                      className="form-input"
                      placeholder="VD: 2 ngày 1 đêm"
                      value={editTrailForm.durationHoursNote}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, durationHoursNote: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Độ khó (1 - 5) *</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      className="form-input"
                      value={editTrailForm.difficultyLevel}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, difficultyLevel: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tháng đẹp nhất (1–12)</label>
                    <input
                      className="form-input"
                      placeholder="VD: 10, 11, 12, 1, 2, 3"
                      value={editTrailForm.bestMonths}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, bestMonths: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tháng nên tránh (1–12)</label>
                    <input
                      className="form-input"
                      placeholder="VD: 6, 7, 8"
                      value={editTrailForm.avoidMonths}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, avoidMonths: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Ghi chú độ khó thực địa</label>
                  <input
                    className="form-input"
                    placeholder="VD: Dốc đứng kéo dài, nhiều đoạn bám rễ cây trơn trượt khi mưa"
                    value={editTrailForm.difficultyNote}
                    onChange={(e) =>
                      setEditTrailForm({ ...editTrailForm, difficultyNote: e.target.value })
                    }
                  />
                </div>

                <div
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    color: 'var(--color-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginTop: 4,
                  }}
                >
                  3. Tọa độ GPS &amp; Ảnh bìa
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 12,
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">Start Lat (Vĩ độ xuất phát)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      value={editTrailForm.startLat}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, startLat: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Start Lng (Kinh độ xuất phát)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      value={editTrailForm.startLng}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, startLng: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Lat (Vĩ độ đích)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      value={editTrailForm.endLat}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, endLat: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Lng (Kinh độ đích)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      value={editTrailForm.endLng}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, endLng: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">URL Ảnh bìa (https://...)</label>
                  <input
                    className="form-input"
                    placeholder="/covers/trail-fansipan.svg hoặc URL ảnh thực địa"
                    value={editTrailForm.coverImage}
                    onChange={(e) =>
                      setEditTrailForm({ ...editTrailForm, coverImage: e.target.value })
                    }
                  />
                </div>

                <div
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    color: 'var(--color-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginTop: 4,
                  }}
                >
                  4. Mô tả, Di chuyển, Cứu hộ &amp; Tiện ích
                </div>
                <div className="form-group">
                  <label className="form-label">Mô tả thực địa</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={editTrailForm.description}
                    onChange={(e) =>
                      setEditTrailForm({ ...editTrailForm, description: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Hướng dẫn di chuyển tới cửa rừng</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={editTrailForm.transportationInfo}
                    onChange={(e) =>
                      setEditTrailForm({ ...editTrailForm, transportationInfo: e.target.value })
                    }
                  />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 12,
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">Đầu mối cứu hộ / Kiểm lâm</label>
                    <input
                      className="form-input"
                      placeholder="VD: Trạm Kiểm lâm VQG Hoàng Liên"
                      value={editTrailForm.rescueContactName}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, rescueContactName: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SĐT cứu hộ khẩn cấp</label>
                    <input
                      className="form-input"
                      placeholder="VD: 112 / 114"
                      value={editTrailForm.rescueContactPhone}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, rescueContactPhone: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Liên hệ Kiểm lâm bổ sung</label>
                    <input
                      className="form-input"
                      placeholder="VD: 115 hoặc SĐT trực ban"
                      value={editTrailForm.rescueContactRanger}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, rescueContactRanger: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: '0.84rem',
                      color: 'var(--color-text-main)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editTrailForm.permitRequired}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, permitRequired: e.target.checked })
                      }
                    />
                    Yêu cầu giấy phép VQG / Kiểm lâm
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: '0.84rem',
                      color: 'var(--color-text-main)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editTrailForm.hasCampsite}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, hasCampsite: e.target.checked })
                      }
                    />
                    Có bãi cắm trại / lán nghỉ
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: '0.84rem',
                      color: 'var(--color-text-main)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editTrailForm.hasWaterSource}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, hasWaterSource: e.target.checked })
                      }
                    />
                    Có nguồn nước dọc tuyến
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: '0.84rem',
                      color: 'var(--color-text-main)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editTrailForm.kidFriendly}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, kidFriendly: e.target.checked })
                      }
                    />
                    Phù hợp cho trẻ em
                  </label>
                </div>

                {editTrailForm.permitRequired && (
                  <div className="form-group">
                    <label className="form-label">Thông tin thủ tục cấp phép</label>
                    <input
                      className="form-input"
                      value={editTrailForm.permitInfo}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, permitInfo: e.target.value })
                      }
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSavingTrail}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    {isSavingTrail ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setEditingTrailModal(null)}
                    disabled={isSavingTrail}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Hủy / Đóng
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* =========================================================================
       * DIRECT CREATE VERIFIED TRAIL MODAL (POST /api/admin/trails) + GPX WIZARD
       * ========================================================================= */}
      {isCreateTrailOpen &&
        isStrictAdmin &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => !isCreatingTrail && setIsCreateTrailOpen(false)}
            style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}
          >
            <div
              ref={createTrailModalRef}
              tabIndex={-1}
              className="modal-content"
              role="dialog"
              aria-modal="true"
              aria-label="Tạo trực tiếp cung đường mới"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 780,
                width: '95%',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: 24,
                borderRadius: 6,
                outline: 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      color: 'var(--color-text-main)',
                      margin: 0,
                    }}
                  >
                    Tạo Trực Tiếp Cung Đường Đã Xác Thực (BQT LOST)
                  </h3>
                  <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', margin: '3px 0 0 0' }}>
                    Công khai trực tiếp lên kho dữ liệu bản đồ qua API Quản trị, hoặc chuyển sang Wizard 5 bước để vẽ GPX.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleOpenContributeWizard}
                    style={{
                      fontSize: '0.76rem',
                      padding: '6px 12px',
                      color: 'var(--color-sky)',
                      borderColor: 'color-mix(in srgb, var(--color-sky) 45%, transparent)',
                    }}
                  >
                    Mở Wizard GPX 5 Bước
                  </button>
                  <button
                    type="button"
                    onClick={() => !isCreatingTrail && setIsCreateTrailOpen(false)}
                    aria-label="Đóng cửa sổ tạo cung đường"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <IconX size={20} />
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleCreateTrailSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                <div
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    color: 'var(--color-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  1. Thông tin cơ bản &amp; Hành chính
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                    gap: 12,
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">Tên cung đường *</label>
                    <input
                      className="form-input"
                      placeholder="VD: Đỉnh Lảo Thẩn (Nóc nhà Y Tý)"
                      value={createTrailForm.name}
                      onChange={(e) =>
                        setCreateTrailForm({ ...createTrailForm, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tỉnh / Thành phố *</label>
                    <input
                      className="form-input"
                      placeholder="VD: Lào Cai"
                      value={createTrailForm.province}
                      onChange={(e) =>
                        setCreateTrailForm({ ...createTrailForm, province: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quận / Huyện / Xã</label>
                    <input
                      className="form-input"
                      placeholder="VD: Huyện Bát Xát"
                      value={createTrailForm.district}
                      onChange={(e) =>
                        setCreateTrailForm({ ...createTrailForm, district: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vùng miền *</label>
                    <select
                      className="form-select"
                      value={createTrailForm.region}
                      onChange={(e) =>
                        setCreateTrailForm({
                          ...createTrailForm,
                          region: normalizeRegion(e.target.value),
                        })
                      }
                    >
                      <option value="Miền Bắc">Miền Bắc</option>
                      <option value="Miền Trung">Miền Trung</option>
                      <option value="Miền Nam">Miền Nam</option>
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    color: 'var(--color-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginTop: 4,
                  }}
                >
                  2. Thông số kỹ thuật &amp; Độ khó
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
                    gap: 12,
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">Cự ly (km) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      className="form-input"
                      placeholder="VD: 16"
                      value={createTrailForm.distanceKm}
                      onChange={(e) =>
                        setCreateTrailForm({ ...createTrailForm, distanceKm: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Độ cao tích lũy (m) *</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      placeholder="VD: 1100"
                      value={createTrailForm.elevationGainM}
                      onChange={(e) =>
                        setCreateTrailForm({ ...createTrailForm, elevationGainM: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cao độ đỉnh (m) *</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      placeholder="VD: 2860"
                      value={createTrailForm.maxAltitudeM}
                      onChange={(e) =>
                        setCreateTrailForm({ ...createTrailForm, maxAltitudeM: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Số ngày *</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      className="form-input"
                      value={createTrailForm.durationDays}
                      onChange={(e) =>
                        setCreateTrailForm({ ...createTrailForm, durationDays: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ghi chú thời lượng</label>
                    <input
                      className="form-input"
                      placeholder="VD: 2 ngày 1 đêm"
                      value={createTrailForm.durationHoursNote}
                      onChange={(e) =>
                        setCreateTrailForm({
                          ...createTrailForm,
                          durationHoursNote: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Độ khó (1 - 5) *</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      className="form-input"
                      value={createTrailForm.difficultyLevel}
                      onChange={(e) =>
                        setCreateTrailForm({ ...createTrailForm, difficultyLevel: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Ghi chú độ khó thực địa</label>
                  <input
                    className="form-input"
                    placeholder="VD: Đường thoáng dễ định hướng, nhiều gió lớn ở sống núi"
                    value={createTrailForm.difficultyNote}
                    onChange={(e) =>
                      setCreateTrailForm({ ...createTrailForm, difficultyNote: e.target.value })
                    }
                  />
                </div>

                <div
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    color: 'var(--color-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginTop: 4,
                  }}
                >
                  3. Tọa độ GPS thực địa (Việt Nam) &amp; Ảnh bìa
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 12,
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">Start Lat *</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      placeholder="VD: 22.6251"
                      value={createTrailForm.startLat}
                      onChange={(e) =>
                        setCreateTrailForm({ ...createTrailForm, startLat: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Start Lng *</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      placeholder="VD: 103.6812"
                      value={createTrailForm.startLng}
                      onChange={(e) =>
                        setCreateTrailForm({ ...createTrailForm, startLng: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Lat (tùy chọn)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      placeholder="Để trống = Start Lat"
                      value={createTrailForm.endLat}
                      onChange={(e) =>
                        setCreateTrailForm({ ...createTrailForm, endLat: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Lng (tùy chọn)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      placeholder="Để trống = Start Lng"
                      value={createTrailForm.endLng}
                      onChange={(e) =>
                        setCreateTrailForm({ ...createTrailForm, endLng: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">URL Ảnh bìa (tùy chọn, https://...)</label>
                  <input
                    className="form-input"
                    placeholder="/covers/trail-fansipan.svg hoặc URL ảnh thực địa"
                    value={createTrailForm.coverImage}
                    onChange={(e) =>
                      setCreateTrailForm({ ...createTrailForm, coverImage: e.target.value })
                    }
                  />
                </div>

                <div
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    color: 'var(--color-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginTop: 4,
                  }}
                >
                  4. Mô tả, Di chuyển, Cứu hộ &amp; Quy định
                </div>
                <div className="form-group">
                  <label className="form-label">Mô tả thực địa *</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Mô tả địa hình, cảnh quan, lưu ý thời tiết và điểm nhấn của cung đường..."
                    value={createTrailForm.description}
                    onChange={(e) =>
                      setCreateTrailForm({ ...createTrailForm, description: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Hướng dẫn di chuyển tới cửa rừng</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="VD: Xe giường nằm lên Lào Cai/Sa Pa, tiếp tục thuê xe máy hoặc ô tô trung chuyển..."
                    value={createTrailForm.transportationInfo}
                    onChange={(e) =>
                      setCreateTrailForm({
                        ...createTrailForm,
                        transportationInfo: e.target.value,
                      })
                    }
                  />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                    gap: 12,
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">Đầu mối cứu hộ / Trạm kiểm lâm</label>
                    <input
                      className="form-input"
                      placeholder="VD: Ban Quản lý VQG / Kiểm lâm địa phương"
                      value={createTrailForm.rescueContactName}
                      onChange={(e) =>
                        setCreateTrailForm({
                          ...createTrailForm,
                          rescueContactName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hotline cứu hộ</label>
                    <input
                      className="form-input"
                      placeholder="112 / 114"
                      value={createTrailForm.rescueContactPhone}
                      onChange={(e) =>
                        setCreateTrailForm({
                          ...createTrailForm,
                          rescueContactPhone: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: '0.84rem',
                      color: 'var(--color-text-main)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={createTrailForm.permitRequired}
                      onChange={(e) =>
                        setCreateTrailForm({
                          ...createTrailForm,
                          permitRequired: e.target.checked,
                        })
                      }
                    />
                    Yêu cầu giấy phép Kiểm lâm / VQG
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: '0.84rem',
                      color: 'var(--color-text-main)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={createTrailForm.hasCampsite}
                      onChange={(e) =>
                        setCreateTrailForm({ ...createTrailForm, hasCampsite: e.target.checked })
                      }
                    />
                    Có bãi cắm trại
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: '0.84rem',
                      color: 'var(--color-text-main)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={createTrailForm.hasWaterSource}
                      onChange={(e) =>
                        setCreateTrailForm({
                          ...createTrailForm,
                          hasWaterSource: e.target.checked,
                        })
                      }
                    />
                    Có nguồn nước
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: '0.84rem',
                      color: 'var(--color-text-main)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={createTrailForm.kidFriendly}
                      onChange={(e) =>
                        setCreateTrailForm({ ...createTrailForm, kidFriendly: e.target.checked })
                      }
                    />
                    Phù hợp trẻ em
                  </label>
                </div>

                {createTrailForm.permitRequired && (
                  <div className="form-group">
                    <label className="form-label">Thông tin đăng ký giấy phép</label>
                    <input
                      className="form-input"
                      placeholder="VD: Đăng ký tại Trạm Kiểm lâm / Đồn Biên phòng trước 3 ngày"
                      value={createTrailForm.permitInfo}
                      onChange={(e) =>
                        setCreateTrailForm({ ...createTrailForm, permitInfo: e.target.value })
                      }
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isCreatingTrail}
                    style={{ flex: 1.4, justifyContent: 'center' }}
                  >
                    {isCreatingTrail ? 'Đang tạo cung đường...' : 'Tạo & Công Khai Cung Đường'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setIsCreateTrailOpen(false)}
                    disabled={isCreatingTrail}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Hủy / Đóng
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* =========================================================================
       * STYLED IN-APP CONFIRMATION DIALOG (With optional custom banReason input)
       * ========================================================================= */}
      {confirmDialog &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => !isConfirmExecuting && setConfirmDialog(null)}
            style={{ zIndex: 'calc(var(--z-modal-nested, 3100) + 10)' as unknown as number }}
          >
            <div
              ref={confirmModalRef}
              tabIndex={-1}
              className="modal-content"
              role="alertdialog"
              aria-modal="true"
              aria-label={confirmDialog.title}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 460,
                width: '92%',
                padding: 22,
                borderRadius: 6,
                border: `1px solid ${confirmDialog.danger ? 'var(--color-error)' : 'var(--color-border-strong)'}`,
                outline: 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <h3
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    color: confirmDialog.danger ? 'var(--color-error-text, var(--color-error))' : 'var(--color-text-main)',
                    margin: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AlertTriangle
                    size={18}
                    color={confirmDialog.danger ? 'var(--color-error)' : 'var(--color-sun)'}
                  />
                  {confirmDialog.title}
                </h3>
                <button
                  type="button"
                  onClick={() => !isConfirmExecuting && setConfirmDialog(null)}
                  aria-label="Đóng hộp thoại xác nhận"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <IconX size={18} />
                </button>
              </div>
              <p
                style={{
                  fontSize: '0.84rem',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.55,
                  margin: confirmDialog.reasonInputLabel ? '0 0 14px 0' : '0 0 20px 0',
                }}
              >
                {confirmDialog.message}
              </p>

              {confirmDialog.reasonInputLabel && (
                <div className="form-group" style={{ marginBottom: 18 }}>
                  <label className="form-label">{confirmDialog.reasonInputLabel}</label>
                  <input
                    className="form-input"
                    value={confirmReason}
                    onChange={(e) => setConfirmReason(e.target.value)}
                    placeholder={confirmDialog.reasonPlaceholder || 'Nhập lý do...'}
                    maxLength={300}
                    disabled={isConfirmExecuting}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setConfirmDialog(null)}
                  disabled={isConfirmExecuting}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  className={confirmDialog.danger ? 'btn btn-danger' : 'btn btn-primary'}
                  onClick={() => void executeConfirmDialog()}
                  disabled={isConfirmExecuting}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {isConfirmExecuting ? 'Đang xử lý...' : confirmDialog.confirmLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
