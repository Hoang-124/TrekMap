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

const DEFAULT_TRAIL_COVER =
  'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329097/trekmap/trails/trail_cover_trail-fansipan.jpg';
const DEFAULT_AVATAR =
  'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329093/trekmap/avatars/avatar_user_1.jpg';

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

const EmptyStateIllustration = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" style={{ marginBottom: 16 }}>
    <circle
      cx="60"
      cy="60"
      r="50"
      fill="color-mix(in srgb, var(--color-primary) 5%, transparent)"
      stroke="var(--color-border)"
      strokeWidth="1.5"
      strokeDasharray="4 4"
    />
    <circle
      cx="60"
      cy="60"
      r="36"
      fill="color-mix(in srgb, var(--color-sky) 8%, transparent)"
      stroke="color-mix(in srgb, var(--color-sky) 25%, transparent)"
      strokeWidth="1.5"
    />
    <path
      d="M30 78 L52 48 L64 64 L74 50 L92 78 Z"
      fill="color-mix(in srgb, var(--color-primary) 16%, transparent)"
      stroke="var(--color-primary)"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <circle cx="68" cy="40" r="6" fill="var(--color-sun)" opacity="0.9" />
    <g transform="translate(48, 62)">
      <circle cx="12" cy="12" r="14" fill="var(--color-primary)" />
      <path
        d="M7 12 L10.5 15.5 L17 9"
        stroke="var(--color-on-primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </svg>
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

type AdminSectionId =
  | 'contributions'
  | 'trails'
  | 'incidents'
  | 'inquiries'
  | 'safety'
  | 'field'
  | 'users'
  | 'forum'
  | 'stats'
  | 'audit';

const VALID_ADMIN_SECTIONS = new Set<AdminSectionId>([
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
  if (typeof window === 'undefined') return 'contributions';
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
  return 'contributions';
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
  trailName?: string;
  type?: string;
  severity?: string;
  description?: string;
  locationNote?: string;
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
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onBack,
  onShowToast,
  currentUser,
}) => {
  const isStrictAdmin = currentUser?.role === 'admin';
  const { isConnected: isSocketConnected } = useSocket();

  const [adminSection, setAdminSection] = useState<AdminSectionId>(resolveInitialAdminSection);
  const effectiveSection: AdminSectionId =
    !isStrictAdmin && (adminSection === 'users' || adminSection === 'audit')
      ? 'contributions'
      : adminSection;

  const handleSelectSection = (next: AdminSectionId) => {
    if (!isStrictAdmin && (next === 'users' || next === 'audit')) return;
    setAdminSection(next);
    try {
      if (typeof window !== 'undefined' && window.location.pathname === '/admin') {
        const nextUrl = `/admin?tab=${encodeURIComponent(next)}`;
        window.history.replaceState(null, '', nextUrl);
      }
    } catch {
      // ignore history API errors
    }
  };

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

  const refreshAllData = async () => {
    setIsRefreshing(true);
    setAccessNotice('');
    const sectionsToSync = new Set<AdminSectionId>(loadedSections);
    sectionsToSync.add(effectiveSection);
    const tasks: Promise<void>[] = [fetchHealthStatus(), fetchAdminStats()];
    if (sectionsToSync.has('contributions')) tasks.push(fetchFromMongo());
    if (sectionsToSync.has('trails')) tasks.push(fetchAdminTrails());
    if (sectionsToSync.has('incidents')) tasks.push(fetchAdminIncidents());
    if (sectionsToSync.has('forum')) tasks.push(fetchAdminThreads());
    if (sectionsToSync.has('inquiries')) tasks.push(fetchAdminInquiries());
    if (sectionsToSync.has('safety')) {
      tasks.push(fetchAdminSafetyTimers(safetyTimerView), fetchAdminLiveBeacons());
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

  // On mount: fetch ONLY lightweight health + summary stats (inactive tabs lazy-load on demand)
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

  // Lazy-load data strictly for the active admin section when switching tabs
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      if (effectiveSection === 'contributions') void fetchFromMongo();
      if (effectiveSection === 'users' && isStrictAdmin) void fetchAdminUsers();
      if (effectiveSection === 'trails') void fetchAdminTrails();
      if (effectiveSection === 'incidents') void fetchAdminIncidents();
      if (effectiveSection === 'inquiries') void fetchAdminInquiries();
      if (effectiveSection === 'safety') {
        void fetchAdminSafetyTimers(safetyTimerView);
        void fetchAdminLiveBeacons();
      }
      if (effectiveSection === 'field') {
        void fetchAdminPois();
        void fetchAdminReviews();
      }
      if (effectiveSection === 'forum') void fetchAdminThreads();
      if (effectiveSection === 'stats') void fetchAdminStats();
      if (effectiveSection === 'audit' && isStrictAdmin) void fetchAuditLogs();
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
    fetchAdminLiveBeacons,
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

  interface NavItemConfig {
    id: AdminSectionId;
    label: string;
    icon: React.ComponentType<{ size?: number; color?: string }>;
    badge?: number;
    badgeColor?: string;
    badgeTextColor?: string;
    urgent?: boolean;
    urgentText?: string;
    adminOnly?: boolean;
  }

  const navItems = useMemo<NavItemConfig[]>(() => {
    const allNavItems: NavItemConfig[] = [
      {
        id: 'contributions',
        label: 'Duyệt Đóng Góp',
        icon: Inbox,
        badge: loadedSections.has('contributions')
          ? pendingContributions.length
          : (adminStats?.pendingContributions ?? pendingContributions.length),
        badgeColor: 'var(--color-sun)',
        badgeTextColor: 'var(--color-on-primary)',
      },
      {
        id: 'trails',
        label: 'Kho Cung Đường',
        icon: Layers,
        badge: loadedSections.has('trails')
          ? trailsList.length
          : (adminStats?.totalTrails ?? trailsList.length),
        badgeColor: 'var(--color-sky)',
        badgeTextColor: 'var(--color-on-primary)',
      },
      {
        id: 'incidents',
        label: 'Quản Lý Sự Cố',
        icon: AlertTriangle,
        badge: loadedSections.has('incidents')
          ? activeIncidentsCount
          : (adminStats?.totalIncidents ?? activeIncidentsCount),
        badgeColor: 'var(--color-error)',
        badgeTextColor: 'var(--color-on-danger)',
        urgent: pendingDisputesCount > 0,
        urgentText: `${pendingDisputesCount} Khiếu nại`,
      },
      {
        id: 'inquiries',
        label: 'Đơn Porter / Guide',
        icon: IconBackpack,
        badge: loadedSections.has('inquiries')
          ? pendingInquiriesCount > 0
            ? pendingInquiriesCount
            : inquiriesList.length
          : undefined,
        badgeColor: pendingInquiriesCount > 0 ? 'var(--color-sun)' : 'var(--color-sky)',
        badgeTextColor: 'var(--color-on-primary)',
      },
      {
        id: 'safety',
        label: 'An Toàn & Đèn Hiệu',
        icon: IconShieldAlert,
        badge: loadedSections.has('safety')
          ? liveSafetyTotal
          : (adminStats?.activeSafetyTimers ?? liveSafetyTotal),
        badgeColor: urgentSafetyCount > 0 ? 'var(--color-error)' : 'var(--color-primary)',
        badgeTextColor: urgentSafetyCount > 0 ? 'var(--color-on-danger)' : 'var(--color-on-primary)',
        urgent: urgentSafetyCount > 0,
        urgentText: `${urgentSafetyCount} KHẨN CẤP`,
      },
      {
        id: 'field',
        label: 'Kiểm Duyệt Thực Địa',
        icon: IconMapPin,
        badge: loadedSections.has('field')
          ? fieldModerationTotal
          : (adminStats?.totalReviews ?? fieldModerationTotal),
        badgeColor: 'var(--color-stream)',
        badgeTextColor: 'var(--color-on-primary)',
      },
      {
        id: 'users',
        label: 'Người Dùng & Quyền',
        icon: Users,
        badge: loadedSections.has('users')
          ? usersList.length
          : (adminStats?.totalUsers ?? usersList.length),
        badgeColor: 'var(--color-primary)',
        badgeTextColor: 'var(--color-on-primary)',
        adminOnly: true,
      },
      {
        id: 'forum',
        label: 'Kiểm Duyệt Diễn Đàn',
        icon: MessageSquare,
        badge: loadedSections.has('forum')
          ? threadsList.length
          : (adminStats?.totalThreads ?? threadsList.length),
        badgeColor: 'var(--color-earth)',
        badgeTextColor: 'var(--color-on-primary)',
      },
      {
        id: 'stats',
        label: 'Thống Kê Tổng Quan',
        icon: BarChart3,
      },
      {
        id: 'audit',
        label: 'Nhật Ký Kiểm Toán',
        icon: ShieldCheck,
        badge: auditLogs.length > 0 ? auditLogs.length : undefined,
        badgeColor: 'var(--color-sky)',
        badgeTextColor: 'var(--color-on-primary)',
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

  const sectionTitles: Record<AdminSectionId, { title: string; subtitle: string }> = {
    contributions: {
      title: 'Duyệt & Quản Lý Đóng Góp Cung Đường',
      subtitle:
        'Xem chi tiết các bài đóng góp từ cộng đồng, kiểm tra thông tin địa lý và phê duyệt lên bản đồ 3D',
    },
    trails: {
      title: 'Quản Lý Danh Mục Cung Đường Trekking',
      subtitle:
        'Theo dõi, tạo mới, chỉnh sửa trực tiếp thông số và quản lý kho dữ liệu cung đường thực địa Việt Nam',
    },
    incidents: {
      title: 'Trung Tâm Quản Lý Sự Cố & Cứu Hộ',
      subtitle:
        'Kiểm duyệt báo cáo sự cố sạt lở, lũ quét, dữ liệu vệ tinh Open-Meteo / NASA và giải quyết khiếu nại',
    },
    inquiries: {
      title: 'Quản Lý Đơn Đặt Porter & Hướng Dẫn Viên',
      subtitle:
        'Tiếp nhận yêu cầu thuê Porter/Guide bản địa, kiểm tra dự toán chi phí và cập nhật trạng thái điều phối',
    },
    safety: {
      title: 'Giám Sát An Toàn & Đèn Hiệu Trực Tiếp (SOS)',
      subtitle:
        'Theo dõi Hẹn Giờ Báo Bình An quá hạn và Live Beacon GPS thời gian thực để phối hợp cứu hộ kịp thời',
    },
    field: {
      title: 'Kiểm Duyệt Dữ Liệu Thực Địa (POIs & Đánh Giá)',
      subtitle:
        'Cập nhật tình trạng nguồn nước/bãi trại/điểm nguy hiểm do cộng đồng đóng góp và gỡ nội dung spam',
    },
    users: {
      title: 'Quản Trị Thành Viên & Phân Quyền Vai Trò',
      subtitle:
        'Tìm kiếm thành viên, cấp quyền Hướng dẫn viên (Guide), Điều hành viên (Mod) hoặc xử lý vi phạm',
    },
    forum: {
      title: 'Kiểm Duyệt & Điều Hành Diễn Đàn',
      subtitle:
        'Ghim bài thông báo quan trọng, khóa bình luận hoặc gỡ bài viết vi phạm chuẩn mực cộng đồng',
    },
    stats: {
      title: 'Báo Cáo Thống Kê & Phân Tích Hệ Thống',
      subtitle:
        'Báo cáo tổng hợp đầy đủ 12 chỉ số thời gian thực được đồng bộ trực tiếp từ MongoDB Atlas',
    },
    audit: {
      title: 'Nhật Ký Kiểm Toán Thao Tác Ban Quản Trị (Audit Log)',
      subtitle:
        'Lưu vết minh bạch mọi thay đổi phân quyền, khóa tài khoản, cập nhật/xóa cung đường trong 180 ngày gần nhất',
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

  const dbStatusColor =
    dbHealth.status === 'online'
      ? 'var(--color-primary)'
      : dbHealth.status === 'connecting'
        ? 'var(--color-sun)'
        : dbHealth.status === 'checking'
          ? 'var(--color-text-muted)'
          : 'var(--color-error-text, var(--color-error))';

  return (
    <div className="admin-layout">
      {/* 1. COMMAND SIDEBAR */}
      <aside className="admin-sidebar">
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.72rem',
                fontWeight: 800,
                color: 'var(--color-primary)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: dbStatusColor,
                  display: 'inline-block',
                }}
              />
              LOST OPS v3.0
            </div>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                background: isSocketConnected
                  ? 'color-mix(in srgb, var(--color-sky) 12%, transparent)'
                  : 'color-mix(in srgb, var(--color-sun) 14%, transparent)',
                color: isSocketConnected ? 'var(--color-sky)' : 'var(--color-sun)',
                border: isSocketConnected
                  ? '1px solid color-mix(in srgb, var(--color-sky) 30%, transparent)'
                  : '1px solid color-mix(in srgb, var(--color-sun) 35%, transparent)',
              }}
            >
              {isSocketConnected ? 'REALTIME' : 'RECONNECTING'}
            </span>
          </div>
          <h2
            className="font-editorial"
            style={{
              fontSize: '1.45rem',
              fontWeight: 500,
              color: 'var(--color-text-main)',
              margin: '0 0 2px 0',
            }}
          >
            Trung Tâm Chỉ Huy
          </h2>
          <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', margin: 0 }}>
            Ban Quản Trị Hệ Thống LOST
          </p>
        </div>

        {/* Administrator Profile Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 4,
            background: 'var(--color-bg-main)',
            border: '1px solid var(--color-border)',
          }}
        >
          <img
            loading="lazy"
            decoding="async"
            src={currentUser?.avatarUrl || currentUser?.avatar || DEFAULT_AVATAR}
            alt="Ảnh đại diện Quản trị viên"
            style={{
              width: 36,
              height: 36,
              borderRadius: 4,
              objectFit: 'cover',
              border: '1px solid var(--color-primary)',
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--color-text-main)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {currentUser?.fullName || currentUser?.name || currentUser?.email || 'Quản Trị Viên LOST'}
            </div>
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--color-sky)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ShieldCheck size={11} color="var(--color-sky)" />
              <span>
                {isStrictAdmin ? 'Quản Trị Viên Cấp Cao' : 'BQT · Điều Hành Viên'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map((item) => {
            const isActive = effectiveSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectSection(item.id)}
                className={`admin-nav-item ${isActive ? 'active' : ''}`}
                style={{ width: '100%', textAlign: 'left' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <item.icon size={15} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {item.urgent && (
                    <span
                      style={{
                        background: 'var(--color-error)',
                        color: 'var(--color-on-danger)',
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 3,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {item.urgentText}
                    </span>
                  )}
                  {item.badge !== undefined && (
                    <span
                      style={{
                        background: item.badgeColor || 'var(--color-primary)',
                        color: item.badgeTextColor || 'var(--color-on-primary)',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 3,
                        minWidth: 18,
                        textAlign: 'center',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Live Infrastructure Status Widget & Back Link */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 14,
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: '0.68rem',
              color: 'var(--color-text-dim)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Hạ tầng hệ thống
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.74rem',
              color: 'var(--color-text-muted)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Database size={13} color={dbStatusColor} /> MongoDB Atlas
            </span>
            <span style={{ color: dbStatusColor, fontWeight: 700 }}>{dbHealth.label}</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.74rem',
              color: 'var(--color-text-muted)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Radio
                size={13}
                color={isSocketConnected ? 'var(--color-sky)' : 'var(--color-sun)'}
              />{' '}
              Kênh Kết Nối
            </span>
            <span
              style={{
                color: isSocketConnected ? 'var(--color-sky)' : 'var(--color-sun)',
                fontWeight: 700,
              }}
            >
              {isSocketConnected ? 'Socket.IO Live' : 'Mất Kết Nối'}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-outline"
            onClick={onBack}
            style={{
              width: '100%',
              justifyContent: 'center',
              gap: 8,
              marginTop: 6,
              fontSize: '0.82rem',
              padding: '8px 12px',
            }}
          >
            <ArrowLeft size={14} /> Về Trang Chủ Bản Đồ
          </button>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE CONTENT */}
      <main className="admin-content">
        <header className="admin-top-bar">
          <div>
            <div
              style={{
                fontSize: '0.68rem',
                color: 'var(--color-primary)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>BQT LOST</span>
              <span>·</span>
              <span>{navItems.find((n) => n.id === effectiveSection)?.label}</span>
            </div>
            <h1
              className="font-editorial"
              style={{
                fontSize: '1.65rem',
                fontWeight: 500,
                color: 'var(--color-text-main)',
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              {sectionTitles[effectiveSection].title}
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
              {sectionTitles[effectiveSection].subtitle}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={refreshAllData}
              disabled={isRefreshing}
              style={{ fontSize: '0.8rem', padding: '7px 12px', gap: 6 }}
              title="Đồng bộ dữ liệu thời gian thực từ MongoDB"
            >
              <RefreshCw size={13} className={isRefreshing ? 'spin-animation' : ''} />
              <span>{isRefreshing ? 'Đang tải...' : 'Làm Mới Dữ Liệu'}</span>
            </button>

            {effectiveSection === 'trails' && isStrictAdmin && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setCreateTrailForm(createEmptyTrailForm());
                  setIsCreateTrailOpen(true);
                }}
                style={{ fontSize: '0.8rem', padding: '7px 14px', gap: 6 }}
              >
                <IconPlus size={14} /> Thêm Cung Đường Mới
              </button>
            )}

            {effectiveSection === 'contributions' && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleOpenContributeWizard}
                style={{
                  fontSize: '0.8rem',
                  padding: '7px 12px',
                  gap: 6,
                  color: 'var(--color-primary)',
                  borderColor: 'var(--color-primary)',
                }}
              >
                <IconPlus size={14} /> Mở Trình Đóng Góp
              </button>
            )}
          </div>
        </header>

        {accessNotice && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 16px',
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
              color: 'var(--color-error-text, var(--color-error))',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color="var(--color-error-text, var(--color-error))" />
              {accessNotice}
            </span>
            <button
              type="button"
              onClick={() => setAccessNotice('')}
              aria-label="Đóng thông báo quyền"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-error-text, var(--color-error))',
                cursor: 'pointer',
                padding: 2,
              }}
            >
              <IconX size={15} />
            </button>
          </div>
        )}

        <div key={effectiveSection} className="tab-content-slide">
          {/* =========================================================================
           * SECTION 1: DUYỆT ĐÓNG GÓP (CONTRIBUTIONS)
           * ========================================================================= */}
          {effectiveSection === 'contributions' && (
            <>
              <div className="admin-kpi-grid">
                <div className="admin-kpi-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div
                        style={{
                          fontSize: '0.68rem',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: 'var(--color-text-dim)',
                          fontWeight: 700,
                        }}
                      >
                        Chờ BQT Duyệt
                      </div>
                      <div
                        className="font-editorial"
                        style={{
                          fontSize: '2rem',
                          fontWeight: 500,
                          color: 'var(--color-sun)',
                          marginTop: 4,
                          lineHeight: 1.05,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {pendingContributions.length}{' '}
                        <span
                          style={{
                            fontSize: '0.85rem',
                            fontFamily: 'var(--font-family)',
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          bài
                        </span>
                      </div>
                    </div>
                    <Clock size={18} color="var(--color-sun)" />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 8 }}>
                    Cần xác thực dữ liệu thực địa
                  </div>
                </div>

                <div className="admin-kpi-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div
                        style={{
                          fontSize: '0.68rem',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: 'var(--color-text-dim)',
                          fontWeight: 700,
                        }}
                      >
                        Đã Duyệt &amp; Công Khai
                      </div>
                      <div
                        className="font-editorial"
                        style={{
                          fontSize: '2rem',
                          fontWeight: 500,
                          color: 'var(--color-primary)',
                          marginTop: 4,
                          lineHeight: 1.05,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {approvedContributions.length}{' '}
                        <span
                          style={{
                            fontSize: '0.85rem',
                            fontFamily: 'var(--font-family)',
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          bài
                        </span>
                      </div>
                    </div>
                    <CheckCircle2 size={18} color="var(--color-primary)" />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 8 }}>
                    Đã đồng bộ lên bản đồ 3D
                  </div>
                </div>

                <div className="admin-kpi-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div
                        style={{
                          fontSize: '0.68rem',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: 'var(--color-text-dim)',
                          fontWeight: 700,
                        }}
                      >
                        Tổng Số Đóng Góp
                      </div>
                      <div
                        className="font-editorial"
                        style={{
                          fontSize: '2rem',
                          fontWeight: 500,
                          color: 'var(--color-text-main)',
                          marginTop: 4,
                          lineHeight: 1.05,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {contributions.length}{' '}
                        <span
                          style={{
                            fontSize: '0.85rem',
                            fontFamily: 'var(--font-family)',
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          bài
                        </span>
                      </div>
                    </div>
                    <Layers size={18} color="var(--color-sky)" />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 8 }}>
                    Kho dữ liệu mở từ cộng đồng
                  </div>
                </div>

                {(() => {
                  const gpsPool = [...trailsList, ...contributions];
                  const validGpsCount = gpsPool.filter(hasValidVnCoords).length;
                  const validGpsPercent =
                    gpsPool.length > 0 ? Math.round((validGpsCount / gpsPool.length) * 100) : 0;
                  return (
                    <div className="admin-kpi-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div
                            style={{
                              fontSize: '0.68rem',
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                              color: 'var(--color-text-dim)',
                              fontWeight: 700,
                            }}
                          >
                            Độ Tin Cậy Thực Địa
                          </div>
                          <div
                            className="font-editorial"
                            style={{
                              fontSize: '2rem',
                              fontWeight: 500,
                              color: 'var(--color-text-main)',
                              marginTop: 4,
                              lineHeight: 1.05,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {gpsPool.length > 0 ? `${validGpsPercent}%` : '—'}{' '}
                            <span
                              style={{
                                fontSize: '0.85rem',
                                fontFamily: 'var(--font-family)',
                                color: 'var(--color-text-muted)',
                              }}
                            >
                              GPS VN
                            </span>
                          </div>
                        </div>
                        <Compass size={18} color="var(--color-stream)" />
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 8 }}>
                        {validGpsCount}/{gpsPool.length} cung &amp; đóng góp có tọa độ hợp lệ
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Toolbar: Segmented Switch + Search */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                <div className="admin-segmented-control" style={{ flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`admin-segmented-btn ${activeTab === 'pending' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pending')}
                  >
                    <Clock size={14} />
                    <span>Chờ duyệt</span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '1px 6px',
                        borderRadius: 4,
                        background:
                          activeTab === 'pending'
                            ? 'color-mix(in srgb, var(--color-sun) 18%, transparent)'
                            : 'transparent',
                        color: 'var(--color-sun)',
                        fontWeight: 800,
                      }}
                    >
                      {pendingContributions.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`admin-segmented-btn ${activeTab === 'approved' ? 'active' : ''}`}
                    onClick={() => setActiveTab('approved')}
                  >
                    <CheckCircle2 size={14} />
                    <span>Đã công khai</span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '1px 6px',
                        borderRadius: 4,
                        background:
                          activeTab === 'approved'
                            ? 'color-mix(in srgb, var(--color-primary) 18%, transparent)'
                            : 'transparent',
                        color: 'var(--color-primary)',
                        fontWeight: 800,
                      }}
                    >
                      {approvedContributions.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`admin-segmented-btn ${activeTab === 'rejected' ? 'active' : ''}`}
                    onClick={() => setActiveTab('rejected')}
                  >
                    <XCircle size={14} />
                    <span>Đã từ chối</span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '1px 6px',
                        borderRadius: 4,
                        background:
                          activeTab === 'rejected'
                            ? 'color-mix(in srgb, var(--color-error) 18%, transparent)'
                            : 'transparent',
                        color: 'var(--color-error-text, var(--color-error))',
                        fontWeight: 800,
                      }}
                    >
                      {rejectedContributions.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`admin-segmented-btn ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                  >
                    <Layers size={14} />
                    <span>Tất cả đóng góp</span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '1px 6px',
                        borderRadius: 4,
                        background:
                          activeTab === 'all'
                            ? 'color-mix(in srgb, var(--color-sky) 18%, transparent)'
                            : 'transparent',
                        color: 'var(--color-sky)',
                        fontWeight: 800,
                      }}
                    >
                      {contributions.length}
                    </span>
                  </button>
                </div>

                <div className="admin-search-wrapper">
                  <Search size={16} color="var(--color-text-dim)" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm theo tên cung đường, tác giả, tỉnh thành..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--color-text-main)',
                      fontSize: '0.82rem',
                      width: '100%',
                      outline: 'none',
                      padding: 0,
                    }}
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
                      title="Xóa tìm kiếm"
                      aria-label="Xóa tìm kiếm"
                    >
                      <IconX size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Filtered Contributions Content */}
              <div key={`${activeTab}-${searchQuery}`} className="tab-content-slide">
                {(() => {
                  const listToDisplay = displayedContributions;

                  if (listToDisplay.length === 0) {
                    return (
                      <div className="admin-empty-state">
                        <EmptyStateIllustration />
                        <h3
                          style={{
                            fontSize: '1.2rem',
                            fontWeight: 800,
                            color: 'var(--color-text-main)',
                            margin: '0 0 6px 0',
                          }}
                        >
                          {searchQuery
                            ? 'Không Tìm Thấy Kết Quả Phù Hợp'
                            : activeTab === 'pending'
                              ? 'Hộp Thư Kiểm Duyệt Sạch Sẽ!'
                              : 'Không Có Bài Đóng Góp Nào'}
                        </h3>
                        <p
                          style={{
                            fontSize: '0.84rem',
                            color: 'var(--color-text-muted)',
                            maxWidth: 460,
                            margin: '0 0 20px 0',
                            lineHeight: 1.5,
                          }}
                        >
                          {searchQuery
                            ? `Không có bài đóng góp nào khớp với từ khóa "${searchQuery}". Vui lòng thử lại với từ khóa khác.`
                            : activeTab === 'pending'
                              ? 'Toàn bộ bài đóng góp cung đường gửi về từ cộng đồng đã được kiểm tra và xử lý xong.'
                              : 'Chưa có dữ liệu bài đóng góp trong danh mục này.'}
                        </p>

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {activeTab === 'pending' && (
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => setActiveTab('approved')}
                              style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                            >
                              Xem Các Cung Đường Đã Công Khai ({approvedContributions.length})
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={handleOpenContributeWizard}
                            style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                          >
                            Thêm Cung Đường Mới
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={refreshAllData}
                            style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                          >
                            Làm Mới Danh Sách
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))',
                        gap: 18,
                      }}
                    >
                      {listToDisplay.map((contrib) => {
                        const contribId = contrib.id || contrib._id;
                        return (
                          <article key={contribId} className="admin-item-card">
                            <div
                              style={{
                                height: 180,
                                position: 'relative',
                                overflow: 'hidden',
                                background: 'var(--color-surface-elevated)',
                              }}
                            >
                              <img
                                loading="lazy"
                                decoding="async"
                                src={contrib.coverImage || DEFAULT_TRAIL_COVER}
                                alt={contrib.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = DEFAULT_TRAIL_COVER;
                                }}
                              />
                              <div style={{ position: 'absolute', top: 12, right: 12 }}>
                                <span
                                  style={{
                                    background:
                                      contrib.status === 'approved'
                                        ? 'var(--color-primary)'
                                        : contrib.status === 'rejected'
                                          ? 'var(--color-error)'
                                          : 'var(--color-sun)',
                                    color:
                                      contrib.status === 'rejected'
                                        ? 'var(--color-on-danger)'
                                        : 'var(--color-on-primary)',
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    padding: '4px 10px',
                                    borderRadius: 4,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                  }}
                                >
                                  {contrib.status === 'approved' ? (
                                    <>
                                      <CheckCircle2 size={13} color="currentColor" /> Đã Công Khai
                                    </>
                                  ) : contrib.status === 'rejected' ? (
                                    <>
                                      <XCircle size={13} color="currentColor" /> Đã Từ Chối
                                    </>
                                  ) : (
                                    <>
                                      <Clock size={13} color="currentColor" /> Chờ BQT Duyệt
                                    </>
                                  )}
                                </span>
                              </div>

                              <div style={{ position: 'absolute', bottom: 10, left: 12 }}>
                                <span
                                  style={{
                                    background: 'var(--overlay-bg)',
                                    color: 'var(--color-on-media)',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: 4,
                                    border: '1px solid color-mix(in srgb, var(--color-on-media) 18%, transparent)',
                                  }}
                                >
                                  {contrib.region || 'Việt Nam'}
                                </span>
                              </div>
                            </div>

                            <div
                              style={{
                                padding: 18,
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                              }}
                            >
                              <div>
                                <h4
                                  style={{
                                    fontSize: '1.05rem',
                                    fontWeight: 800,
                                    color: 'var(--color-text-main)',
                                    margin: '0 0 6px 0',
                                    lineHeight: 1.3,
                                  }}
                                >
                                  {contrib.name || 'Cung đường Trekking mới'}
                                </h4>

                                <div
                                  style={{
                                    fontSize: '0.8rem',
                                    color: 'var(--color-text-muted)',
                                    marginBottom: 14,
                                  }}
                                >
                                  {contrib.hamlet ? `${contrib.hamlet}, ` : ''}
                                  {contrib.district}, {contrib.province}
                                </div>

                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: 8,
                                    marginBottom: 14,
                                  }}
                                >
                                  <div
                                    style={{
                                      background: 'var(--color-bg-main)',
                                      padding: 8,
                                      borderRadius: 4,
                                      border: '1px solid var(--color-border)',
                                      textAlign: 'center',
                                    }}
                                  >
                                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                                      Cự ly
                                    </div>
                                    <div
                                      style={{
                                        fontSize: '0.88rem',
                                        fontWeight: 800,
                                        color: 'var(--color-primary)',
                                        fontVariantNumeric: 'tabular-nums',
                                      }}
                                    >
                                      {contrib.distanceKm} km
                                    </div>
                                  </div>
                                  <div
                                    style={{
                                      background: 'var(--color-bg-main)',
                                      padding: 8,
                                      borderRadius: 4,
                                      border: '1px solid var(--color-border)',
                                      textAlign: 'center',
                                    }}
                                  >
                                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                                      Độ dốc nâng
                                    </div>
                                    <div
                                      style={{
                                        fontSize: '0.88rem',
                                        fontWeight: 800,
                                        color: 'var(--color-sky)',
                                        fontVariantNumeric: 'tabular-nums',
                                      }}
                                    >
                                      +{contrib.elevationGainM}m
                                    </div>
                                  </div>
                                  <div
                                    style={{
                                      background: 'var(--color-bg-main)',
                                      padding: 8,
                                      borderRadius: 4,
                                      border: '1px solid var(--color-border)',
                                      textAlign: 'center',
                                    }}
                                  >
                                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                                      Thời lượng
                                    </div>
                                    <div
                                      style={{
                                        fontSize: '0.88rem',
                                        fontWeight: 800,
                                        color: 'var(--color-text-main)',
                                      }}
                                    >
                                      {contrib.durationHoursNote || '1 ngày'}
                                    </div>
                                  </div>
                                </div>

                                <div
                                  style={{
                                    fontSize: '0.76rem',
                                    color: 'var(--color-text-muted)',
                                    marginBottom: 14,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 7,
                                      height: 7,
                                      borderRadius: '50%',
                                      background: 'var(--color-primary)',
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span>
                                    Người gửi:{' '}
                                    <strong style={{ color: 'var(--color-text-main)' }}>
                                      {contrib.authorName || contrib.authorEmail || 'Trekker Cộng Đồng'}
                                    </strong>{' '}
                                    ({formatDateVi(contrib.createdAt)})
                                  </span>
                                </div>
                              </div>

                              <div
                                style={{
                                  borderTop: '1px solid var(--color-border)',
                                  paddingTop: 14,
                                  display: 'flex',
                                  gap: 8,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  onClick={() => setSelectedContribution(contrib)}
                                  style={{
                                    flex: 1,
                                    padding: '7px 12px',
                                    fontSize: '0.8rem',
                                    justifyContent: 'center',
                                    gap: 6,
                                  }}
                                >
                                  <Eye size={14} /> Chi tiết
                                </button>

                                {contrib.status !== 'approved' && (
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => handleApprove(contribId || '', contrib.name || '')}
                                    style={{
                                      flex: 1.2,
                                      padding: '7px 12px',
                                      fontSize: '0.8rem',
                                      justifyContent: 'center',
                                      gap: 6,
                                    }}
                                  >
                                    <CheckCircle2 size={14} /> Phê Duyệt
                                  </button>
                                )}

                                {contrib.status === 'pending' && (
                                  <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => handleReject(contribId || '', contrib.name || '')}
                                    style={{
                                      padding: '7px 10px',
                                      fontSize: '0.8rem',
                                      justifyContent: 'center',
                                      color: 'var(--color-sun)',
                                      borderColor: 'color-mix(in srgb, var(--color-sun) 40%, transparent)',
                                    }}
                                    title="Từ chối bài đóng góp"
                                    aria-label="Từ chối bài đóng góp"
                                  >
                                    <XCircle size={14} />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  onClick={() => handleDeleteContribution(contribId || '', contrib.name || '')}
                                  style={{
                                    padding: '7px 10px',
                                    fontSize: '0.8rem',
                                    justifyContent: 'center',
                                    color: 'var(--color-error-text, var(--color-error))',
                                    borderColor: 'color-mix(in srgb, var(--color-error) 40%, transparent)',
                                  }}
                                  title="Xóa vĩnh viễn khỏi MongoDB"
                                  aria-label="Xóa bài đóng góp"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {/* =========================================================================
           * SECTION 2: QUẢN LÝ CUNG ĐƯỜNG (TRAILS)
           * ========================================================================= */}
          {effectiveSection === 'trails' && (
            <div className="card" style={{ padding: 24, borderRadius: 6 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 20,
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <Layers size={18} color="var(--color-primary)" />
                  <h3
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: 700,
                      color: 'var(--color-text-main)',
                      margin: 0,
                    }}
                  >
                    Kho Cung Đường Trekking Việt Nam ({filteredTrails.length}/{trailsList.length})
                  </h3>
                  {!isStrictAdmin && (
                    <span className="badge badge-info">Chỉ xem · Cần quyền Admin để chỉnh sửa</span>
                  )}
                </div>

                <div className="admin-search-wrapper" style={{ maxWidth: 320 }}>
                  <Search size={15} color="var(--color-text-dim)" />
                  <input
                    type="text"
                    placeholder="Lọc theo tên cung, tỉnh thành, huyện..."
                    value={trailSearchQuery}
                    onChange={(e) => setTrailSearchQuery(e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--color-text-main)',
                      fontSize: '0.82rem',
                      width: '100%',
                      outline: 'none',
                    }}
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
                      <IconX size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredTrails.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: 32,
                      color: 'var(--color-text-muted)',
                      border: '1px dashed var(--color-border)',
                      borderRadius: 4,
                      fontSize: '0.84rem',
                    }}
                  >
                    Không tìm thấy cung đường nào khớp với bộ lọc hiện tại.
                  </div>
                ) : (
                  filteredTrails.map((trail) => (
                    <div
                      key={trail._id || trail.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border)',
                        padding: '12px 16px',
                        borderRadius: 4,
                        flexWrap: 'wrap',
                        gap: 14,
                        transition: 'border-color 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 240 }}>
                        <img
                          loading="lazy"
                          decoding="async"
                          src={trail.coverImage || DEFAULT_TRAIL_COVER}
                          alt={trail.name}
                          style={{
                            width: 64,
                            height: 48,
                            borderRadius: 4,
                            objectFit: 'cover',
                            border: '1px solid var(--color-border)',
                            flexShrink: 0,
                          }}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = DEFAULT_TRAIL_COVER;
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '0.95rem',
                              fontWeight: 700,
                              color: 'var(--color-text-main)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span>{trail.name}</span>
                            <span className="badge badge-info">{trail.region}</span>
                            {trail.status && trail.status !== 'approved' && (
                              <span
                                className={
                                  trail.status === 'rejected' ? 'badge badge-error' : 'badge badge-sun'
                                }
                              >
                                {trail.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: '0.78rem',
                              color: 'var(--color-text-muted)',
                              marginTop: 3,
                              display: 'flex',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 6,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            <span>
                              {trail.district ? `${trail.district}, ` : ''}
                              {trail.province} · Cự ly:{' '}
                              <strong style={{ color: 'var(--color-primary)' }}>
                                {trail.distanceKm} km
                              </strong>{' '}
                              · Cao độ: <strong>+{trail.elevationGainM}m</strong> · Đỉnh:{' '}
                              <strong>{trail.maxAltitudeM}m</strong> · Đánh giá:
                            </span>
                            <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <IconStar size={12} color="var(--color-sun)" />{' '}
                              {trail.reviewCount ? Number(trail.rating || 0).toFixed(1) : 'Mới'}
                            </strong>
                            <span>({trail.reviewCount || 0} lượt)</span>
                          </div>
                        </div>
                      </div>

                      {isStrictAdmin && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => openEditTrailModal(trail)}
                            style={{
                              color: 'var(--color-primary)',
                              padding: '6px 14px',
                              fontSize: '0.8rem',
                            }}
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => handleDeleteTrail(trail._id || trail.id || '', trail.name || '')}
                            style={{
                              color: 'var(--color-error-text, var(--color-error))',
                              borderColor: 'color-mix(in srgb, var(--color-error) 40%, transparent)',
                              padding: '6px 14px',
                              fontSize: '0.8rem',
                            }}
                          >
                            Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
           * SECTION 3: QUẢN LÝ SỰ CỐ & CỨU HỘ (INCIDENTS)
           * ========================================================================= */}
          {effectiveSection === 'incidents' && (
              <div className="card" style={{ padding: 24, borderRadius: 6 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertTriangle size={18} color="var(--color-error)" />
                    <div>
                      <h3
                        style={{
                          fontSize: '1.15rem',
                          fontWeight: 700,
                          color: 'var(--color-text-main)',
                          margin: 0,
                        }}
                      >
                        Sự Cố Khẩn Cấp &amp; Cảnh Báo Thực Địa ({displayedIncidents.length}/{incidentsList.length})
                      </h3>
                      <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                        Kiểm duyệt tin báo cộng đồng, theo dõi cảnh báo đã xử lý và dữ liệu vệ tinh Open-Meteo / NASA
                      </p>
                    </div>
                  </div>

                  <div className="admin-segmented-control" style={{ flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={`admin-segmented-btn ${incidentFilter === 'active' ? 'active' : ''}`}
                      onClick={() => setIncidentFilter('active')}
                    >
                      <AlertTriangle size={13} />
                      <span>Đang cảnh báo</span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '1px 6px',
                          borderRadius: 4,
                          color: 'var(--color-error-text, var(--color-error))',
                          fontWeight: 800,
                        }}
                      >
                        {activeIncidents.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`admin-segmented-btn ${incidentFilter === 'resolved' ? 'active' : ''}`}
                      onClick={() => setIncidentFilter('resolved')}
                    >
                      <CheckCircle2 size={13} />
                      <span>Đã xử lý</span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '1px 6px',
                          borderRadius: 4,
                          color: 'var(--color-primary)',
                          fontWeight: 800,
                        }}
                      >
                        {resolvedIncidents.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`admin-segmented-btn ${incidentFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setIncidentFilter('all')}
                    >
                      <Layers size={13} />
                      <span>Tất cả</span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '1px 6px',
                          borderRadius: 4,
                          color: 'var(--color-sky)',
                          fontWeight: 800,
                        }}
                      >
                        {incidentsList.length}
                      </span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {displayedIncidents.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: 32,
                        color: 'var(--color-text-muted)',
                        border: '1px dashed var(--color-border)',
                        borderRadius: 4,
                        fontSize: '0.84rem',
                      }}
                    >
                      {incidentFilter === 'resolved'
                        ? 'Chưa có báo cáo sự cố nào được đánh dấu đã xử lý.'
                        : 'Hiện không có báo cáo sự cố nào trong danh mục này.'}
                    </div>
                  ) : (
                    displayedIncidents.map((inc) => {
                      const synthetic = isSyntheticIncident(inc);
                      const reporterId = extractEntityId(inc.reportedBy);
                      return (
                        <div
                          key={inc._id || inc.id}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            background: 'var(--color-bg-main)',
                            border: '1px solid var(--color-border)',
                            borderLeft: synthetic
                              ? '3px solid var(--color-sky)'
                              : inc.resolved
                                ? '3px solid var(--color-primary)'
                                : inc.severity === 'critical' || inc.severity === 'high'
                                  ? '3px solid var(--color-error)'
                                  : '3px solid var(--color-sun)',
                            padding: '16px 18px',
                            borderRadius: 4,
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              flexWrap: 'wrap',
                              gap: 10,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 240 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  marginBottom: 6,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span
                                  style={{
                                    background:
                                      inc.severity === 'critical'
                                        ? 'var(--color-error)'
                                        : inc.severity === 'high'
                                          ? 'var(--color-earth)'
                                          : 'var(--color-sky)',
                                    color:
                                      inc.severity === 'critical'
                                        ? 'var(--color-on-danger)'
                                        : 'var(--color-on-primary)',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: 3,
                                    letterSpacing: '0.04em',
                                  }}
                                >
                                  {inc.severity?.toUpperCase() || 'HIGH'}
                                </span>
                                <span
                                  style={{
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    color: 'var(--color-text-main)',
                                  }}
                                >
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
                                  <span
                                    className="badge badge-info"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  >
                                    <IconSatellite size={11} /> Dữ liệu vệ tinh / Tự động (Chỉ đọc)
                                  </span>
                                ) : inc.resolved ? (
                                  <span className="badge badge-success">
                                    <CheckCircle2 size={12} /> Đã an toàn
                                  </span>
                                ) : (
                                  <span className="badge badge-error">
                                    <AlertTriangle size={12} /> Đang phát cảnh báo
                                  </span>
                                )}
                              </div>
                              <p
                                style={{
                                  fontSize: '0.86rem',
                                  color: 'var(--color-text-main)',
                                  margin: 0,
                                  lineHeight: 1.5,
                                }}
                              >
                                {inc.description}
                              </p>
                            </div>

                            {!synthetic && (
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                {!inc.resolved && (
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => handleResolveIncident(inc._id || inc.id || '')}
                                    style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                                  >
                                    Xử Lý Xong (Gỡ Cảnh Báo)
                                  </button>
                                )}

                                {isStrictAdmin && reporterId && (
                                  <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() =>
                                      handleBanUser(
                                        reporterId,
                                        inc.reporterEmail || inc.reporterName || 'Tài khoản báo giả'
                                      )
                                    }
                                    title="Khóa tài khoản này nếu phát hiện báo động giả / spam"
                                    style={{
                                      color: 'var(--color-sun)',
                                      borderColor: 'color-mix(in srgb, var(--color-sun) 40%, transparent)',
                                      padding: '6px 12px',
                                      fontSize: '0.78rem',
                                    }}
                                  >
                                    Khóa Nick (Báo Giả)
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  onClick={() => handleDeleteIncident(inc._id || inc.id || '')}
                                  style={{
                                    color: 'var(--color-error-text, var(--color-error))',
                                    borderColor: 'color-mix(in srgb, var(--color-error) 40%, transparent)',
                                    padding: '6px 12px',
                                    fontSize: '0.78rem',
                                  }}
                                >
                                  Xóa
                                </button>
                              </div>
                            )}
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '8px 12px',
                              background: 'var(--color-bg-card)',
                              borderRadius: 4,
                              border: '1px solid var(--color-border)',
                              flexWrap: 'wrap',
                              fontSize: '0.76rem',
                            }}
                          >
                            <span style={{ color: 'var(--color-text-main)', fontWeight: 700 }}>
                              {synthetic ? 'Nguồn đo:' : 'Người phát:'}{' '}
                              <strong style={{ color: synthetic ? 'var(--color-sky)' : 'var(--color-primary)' }}>
                                {inc.reporterName || inc.userName || inc.verifiedBy || 'Trekker Thực Địa'}
                              </strong>
                            </span>
                            {inc.reporterEmail && (
                              <span style={{ color: 'var(--color-text-muted)' }}>· {inc.reporterEmail}</span>
                            )}
                            <span style={{ color: 'var(--color-text-dim)' }}>
                              · Thời gian: {formatDateVi(inc.reportedAt || inc.createdAt)}
                            </span>
                            {inc.locationNote && (
                              <span style={{ color: 'var(--color-sky)', fontWeight: 600 }}>
                                · Vị trí: {inc.locationNote}
                              </span>
                            )}
                            {inc.confirmations && inc.confirmations > 1 && (
                              <span className="badge badge-sun">
                                <CheckCircle2 size={11} /> {inc.confirmations} Xác thực
                              </span>
                            )}
                          </div>

                          {!synthetic && Array.isArray(inc.disputes) && inc.disputes.length > 0 && (
                            <div
                              style={{
                                padding: '12px 16px',
                                background: 'color-mix(in srgb, var(--color-error) 8%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--color-error) 34%, transparent)',
                                borderRadius: 4,
                                fontSize: '0.8rem',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  fontWeight: 700,
                                  color: 'var(--color-error-text, var(--color-error))',
                                  marginBottom: 6,
                                }}
                              >
                                <AlertTriangle size={14} />
                                <span>
                                  KHIẾU NẠI TỪ CỘNG ĐỒNG: {inc.disputes.length} TREKKER BÁO CÁO TIN GIẢ
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {inc.disputes.map((d: AdminIncidentDispute, idx: number) => (
                                  <div
                                    key={idx}
                                    style={{
                                      background: 'var(--color-bg-card)',
                                      padding: '6px 10px',
                                      borderRadius: 4,
                                      color: 'var(--color-text-main)',
                                    }}
                                  >
                                    · <strong>{d.userName || 'Trekker'}</strong> ({formatDateVi(d.disputedAt)}):
                                    &ldquo;{d.reason}&rdquo;
                                  </div>
                                ))}
                              </div>
                              <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={() =>
                                    handleResolveDispute(inc._id || inc.id || '', 'dismiss_incident')
                                  }
                                  style={{
                                    padding: '6px 14px',
                                    fontSize: '0.78rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}
                                >
                                  <CheckCircle2 size={14} /> Chấp nhận khiếu nại (Gỡ cảnh báo ảo)
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  onClick={() =>
                                    handleResolveDispute(inc._id || inc.id || '', 'reject_dispute')
                                  }
                                  style={{
                                    color: 'var(--color-error-text, var(--color-error))',
                                    borderColor: 'color-mix(in srgb, var(--color-error) 40%, transparent)',
                                    padding: '6px 14px',
                                    fontSize: '0.78rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}
                                >
                                  <XCircle size={14} /> Bác bỏ khiếu nại (Nguy hiểm thật)
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
          )}

          {/* =========================================================================
           * SECTION 4: QUẢN LÝ NGƯỜI DÙNG & PHÂN QUYỀN (USERS - ADMIN ONLY)
           * ========================================================================= */}
          {effectiveSection === 'users' && isStrictAdmin && (() => {
            const roleCounts = userRoleCounts;

            const userFilterPills: {
              id: typeof userRoleFilter;
              label: string;
              count: number;
              color: string;
            }[] = [
              { id: 'all', label: 'Tất cả', count: roleCounts.all, color: 'var(--color-sky)' },
              { id: 'admin', label: 'Admin', count: roleCounts.admin, color: 'var(--color-sun)' },
              { id: 'moderator', label: 'Mod', count: roleCounts.moderator, color: 'var(--color-sky)' },
              { id: 'guide', label: 'Guide', count: roleCounts.guide, color: 'var(--color-primary)' },
              { id: 'user', label: 'Trekker', count: roleCounts.user, color: 'var(--color-text-muted)' },
              {
                id: 'banned',
                label: 'Đã khóa',
                count: roleCounts.banned,
                color: 'var(--color-error-text, var(--color-error))',
              },
            ];

            return (
              <div className="card" style={{ padding: 24, borderRadius: 6 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Users size={18} color="var(--color-primary)" />
                    <h3
                      style={{
                        fontSize: '1.15rem',
                        fontWeight: 700,
                        color: 'var(--color-text-main)',
                        margin: 0,
                      }}
                    >
                      Danh Sách Thành Viên &amp; Phân Quyền ({filteredUsers.length}/{usersList.length})
                    </h3>
                  </div>

                  <div className="admin-search-wrapper" style={{ maxWidth: 320 }}>
                    <Search size={15} color="var(--color-text-dim)" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên, username, email..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-text-main)',
                        fontSize: '0.82rem',
                        width: '100%',
                        outline: 'none',
                      }}
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
                        <IconX size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div className="admin-segmented-control" style={{ flexWrap: 'wrap' }}>
                    {userFilterPills.map((pill) => (
                      <button
                        key={pill.id}
                        type="button"
                        className={`admin-segmented-btn ${userRoleFilter === pill.id ? 'active' : ''}`}
                        onClick={() => setUserRoleFilter(pill.id)}
                      >
                        <span>{pill.label}</span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '1px 6px',
                            borderRadius: 4,
                            color: pill.color,
                            fontWeight: 800,
                          }}
                        >
                          {pill.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredUsers.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: 32,
                        color: 'var(--color-text-muted)',
                        border: '1px dashed var(--color-border)',
                        borderRadius: 4,
                        fontSize: '0.84rem',
                      }}
                    >
                      Không tìm thấy thành viên nào khớp với bộ lọc hiện tại.
                    </div>
                  ) : (
                    filteredUsers.map((u) => {
                      const uid = u._id || u.id;
                      return (
                        <div
                          key={uid}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: u.isBanned
                              ? 'color-mix(in srgb, var(--color-error) 6%, var(--color-bg-main))'
                              : 'var(--color-bg-main)',
                            border: u.isBanned
                              ? '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)'
                              : '1px solid var(--color-border)',
                            padding: '12px 16px',
                            borderRadius: 4,
                            flexWrap: 'wrap',
                            gap: 14,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 240 }}>
                            <img
                              loading="lazy"
                              decoding="async"
                              src={u.avatarUrl || DEFAULT_AVATAR}
                              alt={u.fullName || u.username}
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 4,
                                objectFit: 'cover',
                                border: '1px solid var(--color-border-strong)',
                                flexShrink: 0,
                              }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '0.92rem',
                                  fontWeight: 700,
                                  color: 'var(--color-text-main)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span>{u.fullName || u.username}</span>
                                {u.role === 'admin' && <span className="badge badge-sun">ADMIN</span>}
                                {u.role === 'guide' && (
                                  <span className="badge badge-success">
                                    <ShieldCheck size={10} /> GUIDE
                                  </span>
                                )}
                                {u.role === 'moderator' && (
                                  <span className="badge badge-info">MODERATOR</span>
                                )}
                                {u.isBanned && <span className="badge badge-error">ĐÃ KHÓA</span>}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                {u.email} · Uy tín:{' '}
                                <strong style={{ color: 'var(--color-primary)' }}>
                                  {u.reputationScore ?? 0} pts
                                </strong>{' '}
                                · Huy hiệu: {u.badges?.join(', ') || 'Trekker Mới'}
                              </div>
                              {u.isBanned && (
                                <div
                                  style={{
                                    marginTop: 6,
                                    fontSize: '0.75rem',
                                    color: 'var(--color-error-text, var(--color-error))',
                                    background: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--color-error) 28%, transparent)',
                                    padding: '4px 8px',
                                    borderRadius: 3,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}
                                >
                                  <AlertTriangle size={12} />
                                  <span>
                                    Lý do khóa: <strong>{u.banReason || 'Vi phạm quy định cộng đồng LOST'}</strong>
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  fontSize: '0.76rem',
                                  color: 'var(--color-text-muted)',
                                  fontWeight: 600,
                                }}
                              >
                                Phân quyền:
                              </span>
                              <select
                                className="form-select"
                                value={u.role || 'user'}
                                onChange={(e) => handleUpdateRole(uid || '', e.target.value, u.fullName || u.email || '')}
                                disabled={u.email === currentUser?.email}
                                style={{ padding: '5px 10px', fontSize: '0.8rem', fontWeight: 600 }}
                              >
                                <option value="user">Trekker (Thành viên)</option>
                                <option value="guide">Verified Guide (Hướng dẫn viên)</option>
                                <option value="moderator">Kiểm duyệt viên (Mod)</option>
                                <option value="admin">Quản trị viên (Admin)</option>
                              </select>
                            </div>

                            {u.isBanned ? (
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => handleUnbanUser(uid || '', u.email || '')}
                                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                              >
                                Mở Khóa
                              </button>
                            ) : u.role !== 'admin' ? (
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => handleBanUser(uid, u.email || u.fullName || '')}
                                style={{
                                  color: 'var(--color-error-text, var(--color-error))',
                                  borderColor: 'color-mix(in srgb, var(--color-error) 40%, transparent)',
                                  padding: '6px 14px',
                                  fontSize: '0.8rem',
                                }}
                              >
                                Khóa Nick
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                                Quản trị viên
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}

          {/* =========================================================================
           * SECTION 5: KIỂM DUYỆT DIỄN ĐÀN (FORUM)
           * ========================================================================= */}
          {effectiveSection === 'forum' && (
            <div className="card" style={{ padding: 24, borderRadius: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <MessageSquare size={18} color="var(--color-primary)" />
                <h3
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    margin: 0,
                  }}
                >
                  Kiểm Duyệt Diễn Đàn ({threadsList.length} bài viết)
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {threadsList.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: 32,
                      color: 'var(--color-text-muted)',
                      border: '1px dashed var(--color-border)',
                      borderRadius: 4,
                      fontSize: '0.84rem',
                    }}
                  >
                    Chưa có bài viết nào trên diễn đàn.
                  </div>
                ) : (
                  threadsList.map((t) => {
                    const tid = t.id || t._id;
                    return (
                      <div
                        key={tid}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'var(--color-bg-main)',
                          border: '1px solid var(--color-border)',
                          borderLeft: t.isPinned
                            ? '3px solid var(--color-sun)'
                            : '1px solid var(--color-border)',
                          padding: '12px 16px',
                          borderRadius: 4,
                          flexWrap: 'wrap',
                          gap: 12,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 260 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              flexWrap: 'wrap',
                              marginBottom: 6,
                            }}
                          >
                            {t.isPinned && (
                              <span className="badge badge-sun">
                                <IconPin size={11} color="var(--color-sun)" /> ĐÃ GHIM
                              </span>
                            )}
                            {t.isLocked && (
                              <span className="badge badge-error">
                                <IconLock size={11} color="var(--color-error)" /> ĐÃ KHÓA
                              </span>
                            )}
                            <span className="badge badge-info">{t.category || 'Thảo luận'}</span>
                            <span
                              style={{
                                fontSize: '0.94rem',
                                fontWeight: 700,
                                color: 'var(--color-text-main)',
                              }}
                            >
                              {t.title}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: '0.78rem',
                              color: 'var(--color-text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span>
                              Tác giả: <strong style={{ color: 'var(--color-text-main)' }}>{t.authorName}</strong>
                            </span>
                            <span>· {t.repliesCount || 0} bình luận</span>
                            <span>· {t.upvotes || 0} lượt thích</span>
                            <span>· {formatDateVi(t.createdAt)}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className={`btn ${t.isPinned ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => handlePinThread(tid || '')}
                            style={{
                              padding: '6px 14px',
                              fontSize: '0.78rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <IconPin size={12} color="currentColor" />
                            <span>{t.isPinned ? 'Bỏ Ghim' : 'Ghim Bài'}</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => handleLockThread(tid || '')}
                            style={{
                              padding: '6px 14px',
                              fontSize: '0.78rem',
                              color: t.isLocked ? 'var(--color-primary)' : 'var(--color-sun)',
                              borderColor: t.isLocked
                                ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)'
                                : 'color-mix(in srgb, var(--color-sun) 40%, transparent)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {t.isLocked ? (
                              'Mở Khóa'
                            ) : (
                              <>
                                <IconLock size={12} color="currentColor" /> Khóa
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => handleDeleteThread(tid || '', t.title || '')}
                            style={{
                              padding: '6px 14px',
                              fontSize: '0.78rem',
                              color: 'var(--color-error-text, var(--color-error))',
                              borderColor: 'color-mix(in srgb, var(--color-error) 40%, transparent)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <IconTrash size={12} color="currentColor" /> Xóa
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
           * SECTION 6: THỐNG KÊ TỔNG QUAN (ALL 12 BACKEND METRICS)
           * ========================================================================= */}
          {effectiveSection === 'stats' && (() => {
            const statCards: {
              key: string;
              label: string;
              value: number;
              subtitle: string;
              color: string;
            }[] = [
              {
                key: 'totalUsers',
                label: 'Tổng Thành Viên',
                value: adminStats?.totalUsers ?? usersList.length,
                subtitle: 'Tài khoản đăng ký trên LOST',
                color: 'var(--color-primary)',
              },
              {
                key: 'totalTrails',
                label: 'Cung Đường Công Khai',
                value: adminStats?.totalTrails ?? trailsList.length,
                subtitle: 'Tuyến thực địa đã duyệt bản đồ',
                color: 'var(--color-sky)',
              },
              {
                key: 'totalContributions',
                label: 'Tổng Bài Đóng Góp',
                value: adminStats?.totalContributions ?? contributions.length,
                subtitle: 'Hồ sơ đóng góp từ cộng đồng',
                color: 'var(--color-primary)',
              },
              {
                key: 'pendingContributions',
                label: 'Bài Chờ Kiểm Duyệt',
                value: adminStats?.pendingContributions ?? pendingContributions.length,
                subtitle: 'Cần BQT xác thực tọa độ GPS',
                color: 'var(--color-sun)',
              },
              {
                key: 'totalIncidents',
                label: 'Sự Cố Đang Cảnh Báo',
                value: adminStats?.totalIncidents ?? activeIncidentsCount,
                subtitle: 'Cảnh báo thực địa chưa gỡ',
                color: 'var(--color-error-text, var(--color-error))',
              },
              {
                key: 'totalThreads',
                label: 'Chủ Đề Diễn Đàn',
                value: adminStats?.totalThreads ?? threadsList.length,
                subtitle: 'Thảo luận cộng đồng trekking',
                color: 'var(--color-earth)',
              },
              {
                key: 'totalReviews',
                label: 'Đánh Giá Cung Đường',
                value: adminStats?.totalReviews ?? reviewsTotal,
                subtitle: 'Nhận xét & chấm điểm thực địa',
                color: 'var(--color-sun)',
              },
              {
                key: 'totalCheckins',
                label: 'Lượt Check-in Thực Địa',
                value: adminStats?.totalCheckins ?? 0,
                subtitle: 'Hộ chiếu chinh phục đỉnh núi',
                color: 'var(--color-primary)',
              },
              {
                key: 'totalTripPlans',
                label: 'Kế Hoạch Ghép Đoàn',
                value: adminStats?.totalTripPlans ?? 0,
                subtitle: 'Lịch trình tìm bạn đồng hành',
                color: 'var(--color-sky)',
              },
              {
                key: 'totalTripReports',
                label: 'Nhật Ký Hành Trình',
                value: adminStats?.totalTripReports ?? 0,
                subtitle: 'Ký sự & ảnh chuyến đi chia sẻ',
                color: 'var(--color-stream)',
              },
              {
                key: 'totalGuides',
                label: 'Porter & HDV Hoạt Động',
                value: adminStats?.totalGuides ?? 0,
                subtitle: 'Hướng dẫn viên bản địa xác thực',
                color: 'var(--color-earth)',
              },
              {
                key: 'activeSafetyTimers',
                label: 'Hẹn Giờ An Toàn Chạy',
                value:
                  adminStats?.activeSafetyTimers ??
                  safetyTimersList.filter((t) => t.status === 'active').length,
                subtitle: 'Dead-Man Switch đang giám sát',
                color: 'var(--color-error-text, var(--color-error))',
              },
            ];

            return (
              <div className="card" style={{ padding: 24, borderRadius: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <BarChart3 size={20} color="var(--color-primary)" />
                  <div>
                    <h3
                      style={{
                        fontSize: '1.2rem',
                        fontWeight: 800,
                        color: 'var(--color-text-main)',
                        margin: 0,
                      }}
                    >
                      Thống Kê Dữ Liệu Thực Địa &amp; Hệ Thống (12 Chỉ Số)
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                      Tổng hợp đầy đủ 12 chỉ số thời gian thực đồng bộ trực tiếp từ MongoDB Atlas
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))',
                    gap: 14,
                  }}
                >
                  {statCards.map((card) => (
                    <div
                      key={card.key}
                      style={{
                        background: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border)',
                        padding: 18,
                        borderRadius: 4,
                      }}
                    >
                      <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                        {card.label}
                      </div>
                      <div
                        style={{
                          fontSize: '1.9rem',
                          fontWeight: 900,
                          color: card.color,
                          marginTop: 6,
                          lineHeight: 1.05,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {card.value.toLocaleString('vi-VN')}
                      </div>
                      <div style={{ fontSize: '0.71rem', color: 'var(--color-text-dim)', marginTop: 6 }}>
                        {card.subtitle}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* =========================================================================
           * SECTION 7: NHẬT KÝ KIỂM TOÁN (AUDIT LOGS - ADMIN ONLY)
           * ========================================================================= */}
          {effectiveSection === 'audit' && isStrictAdmin && (
            <div className="card" style={{ padding: 24, borderRadius: 6 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 18,
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ShieldCheck size={20} color="var(--color-primary)" />
                  <h3
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      color: 'var(--color-text-main)',
                      margin: 0,
                    }}
                  >
                    Lịch Sử Thao Tác Quản Trị ({auditLogs.length})
                  </h3>
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => void fetchAuditLogs()}
                  style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                >
                  <RefreshCw size={13} /> Tải Lại Nhật Ký
                </button>
              </div>

              {auditLogs.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 32,
                    color: 'var(--color-text-muted)',
                    border: '1px dashed var(--color-border)',
                    borderRadius: 4,
                  }}
                >
                  Chưa có bản ghi kiểm toán nào. Các thao tác cập nhật/xóa cung đường, khóa tài khoản
                  và đổi quyền sẽ được ghi tự động tại đây.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {auditLogs.map((log: AdminAuditLogItem) => (
                    <div
                      key={log._id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 10,
                        padding: '12px 16px',
                        background: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 4,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                            {log.action}
                          </span>
                          <span style={{ fontSize: '0.76rem', color: 'var(--color-text-dim)' }}>
                            {log.targetCollection}
                          </span>
                          <strong style={{ fontSize: '0.84rem', color: 'var(--color-text-main)' }}>
                            {log.details}
                          </strong>
                        </div>
                        <div
                          style={{
                            fontSize: '0.74rem',
                            color: 'var(--color-text-muted)',
                            marginTop: 4,
                          }}
                        >
                          Thực hiện bởi:{' '}
                          <strong>{log.userId?.fullName || log.userId?.email || 'Hệ thống'}</strong> ·
                          IP: {log.ipAddress || 'N/A'}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)' }}>
                        {formatDateVi(log.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
           * SECTION 8: ĐƠN ĐẶT PORTER / GUIDE (INQUIRIES)
           * ========================================================================= */}
          {effectiveSection === 'inquiries' && (() => {
            const statusCounts = inquiryStatusCounts;

            const inquiryPills: {
              id: typeof inquiryStatusFilter;
              label: string;
              count: number;
              color: string;
            }[] = [
              { id: 'all', label: 'Tất cả', count: statusCounts.all, color: 'var(--color-sky)' },
              { id: 'pending', label: 'Chờ xử lý', count: statusCounts.pending, color: 'var(--color-sun)' },
              { id: 'contacted', label: 'Đã liên hệ', count: statusCounts.contacted, color: 'var(--color-sky)' },
              { id: 'confirmed', label: 'Đã xác nhận', count: statusCounts.confirmed, color: 'var(--color-primary)' },
              {
                id: 'cancelled',
                label: 'Đã hủy',
                count: statusCounts.cancelled,
                color: 'var(--color-error-text, var(--color-error))',
              },
            ];

            return (
              <div className="card" style={{ padding: 24, borderRadius: 6 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <IconBackpack size={18} color="var(--color-primary)" />
                    <h3
                      style={{
                        fontSize: '1.15rem',
                        fontWeight: 700,
                        color: 'var(--color-text-main)',
                        margin: 0,
                      }}
                    >
                      Đơn Yêu Cầu Thuê Porter / Guide ({filteredInquiries.length}/{inquiriesList.length})
                    </h3>
                  </div>

                  <div className="admin-search-wrapper" style={{ maxWidth: 320 }}>
                    <Search size={15} color="var(--color-text-dim)" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên khách, SĐT, Guide, cung đường..."
                      value={inquirySearchQuery}
                      onChange={(e) => setInquirySearchQuery(e.target.value)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-text-main)',
                        fontSize: '0.82rem',
                        width: '100%',
                        outline: 'none',
                      }}
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
                        <IconX size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div className="admin-segmented-control" style={{ flexWrap: 'wrap' }}>
                    {inquiryPills.map((pill) => (
                      <button
                        key={pill.id}
                        type="button"
                        className={`admin-segmented-btn ${inquiryStatusFilter === pill.id ? 'active' : ''}`}
                        onClick={() => setInquiryStatusFilter(pill.id)}
                      >
                        <span>{pill.label}</span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '1px 6px',
                            borderRadius: 4,
                            color: pill.color,
                            fontWeight: 800,
                          }}
                        >
                          {pill.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filteredInquiries.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: 32,
                        color: 'var(--color-text-muted)',
                        border: '1px dashed var(--color-border)',
                        borderRadius: 4,
                        fontSize: '0.84rem',
                      }}
                    >
                      Chưa có đơn đặt Porter/Guide nào khớp với bộ lọc hiện tại.
                    </div>
                  ) : (
                    filteredInquiries.map((inq) => {
                      const trekkerObj = typeof inq.userId === 'object' ? inq.userId : null;
                      const guideObj = typeof inq.guideId === 'object' ? inq.guideId : null;
                      const trailObj = typeof inq.trailId === 'object' ? inq.trailId : null;
                      const statusMeta = INQUIRY_STATUS_META[inq.status] || INQUIRY_STATUS_META.pending;
                      const isBusy = updatingInquiryId === inq._id;

                      return (
                        <div
                          key={inq._id}
                          style={{
                            background: 'var(--color-bg-main)',
                            border: '1px solid var(--color-border)',
                            borderLeft:
                              inq.status === 'pending'
                                ? '3px solid var(--color-sun)'
                                : inq.status === 'confirmed'
                                  ? '3px solid var(--color-primary)'
                                  : inq.status === 'cancelled'
                                    ? '3px solid var(--color-error)'
                                    : '3px solid var(--color-sky)',
                            padding: '16px 18px',
                            borderRadius: 4,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              flexWrap: 'wrap',
                              gap: 12,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 260 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  flexWrap: 'wrap',
                                  marginBottom: 6,
                                }}
                              >
                                <span className={statusMeta.badgeClass}>{statusMeta.label}</span>
                                <strong style={{ fontSize: '0.96rem', color: 'var(--color-text-main)' }}>
                                  {inq.trailName || trailObj?.name || 'Cung đường trekking'}
                                </strong>
                                {trailObj?.province && (
                                  <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                                    ({trailObj.province})
                                  </span>
                                )}
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 12,
                                  fontSize: '0.8rem',
                                  color: 'var(--color-text-muted)',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                <span>
                                  Khách đặt:{' '}
                                  <strong style={{ color: 'var(--color-text-main)' }}>
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
                                      fontWeight: 700,
                                      textDecoration: 'none',
                                    }}
                                  >
                                    <IconPhone size={12} /> {inq.contactPhone}
                                  </a>
                                )}
                                <span>
                                  Porter / Guide:{' '}
                                  <strong style={{ color: 'var(--color-sky)' }}>
                                    {guideObj?.name || 'HDV bản địa'}
                                  </strong>
                                  {guideObj?.phone ? ` (${guideObj.phone})` : ''}
                                </span>
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>
                                Dự toán chi phí
                              </div>
                              <div
                                style={{
                                  fontSize: '1.05rem',
                                  fontWeight: 800,
                                  color: 'var(--color-primary)',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                {(inq.estimatedTotalVnd || 0).toLocaleString('vi-VN')} đ
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 12,
                              padding: '8px 12px',
                              background: 'var(--color-bg-card)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 4,
                              fontSize: '0.76rem',
                              color: 'var(--color-text-muted)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <IconCalendar size={12} color="var(--color-sky)" />
                              Khởi hành:{' '}
                              <strong style={{ color: 'var(--color-text-main)' }}>
                                {formatDateOnlyVi(inq.plannedStartDate)}
                              </strong>
                            </span>
                            <span>
                              · Thời lượng: <strong style={{ color: 'var(--color-text-main)' }}>{inq.durationDays || 1} ngày</strong>
                            </span>
                            <span>
                              · Quy mô đoàn: <strong style={{ color: 'var(--color-text-main)' }}>{inq.groupSize || 1} người</strong>
                            </span>
                            <span>
                              · Porter thêm:{' '}
                              <strong style={{ color: 'var(--color-text-main)' }}>{inq.needPortersCount || 0}</strong>
                            </span>
                            <span>· Gửi lúc: {formatDateVi(inq.createdAt)}</span>
                          </div>

                          {inq.notes && (
                            <div
                              style={{
                                fontSize: '0.8rem',
                                color: 'var(--color-text-main)',
                                background: 'var(--color-surface-elevated)',
                                padding: '8px 12px',
                                borderRadius: 4,
                                lineHeight: 1.45,
                              }}
                            >
                              Ghi chú khách hàng: &ldquo;{inq.notes}&rdquo;
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {inq.status !== 'contacted' && inq.status !== 'confirmed' && (
                              <button
                                type="button"
                                className="btn btn-outline"
                                disabled={isBusy}
                                onClick={() => void handleUpdateInquiryStatus(inq._id, 'contacted')}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '0.78rem',
                                  color: 'var(--color-sky)',
                                  borderColor: 'color-mix(in srgb, var(--color-sky) 45%, transparent)',
                                }}
                              >
                                Đánh Dấu Đã Liên Hệ
                              </button>
                            )}
                            {inq.status !== 'confirmed' && (
                              <button
                                type="button"
                                className="btn btn-primary"
                                disabled={isBusy}
                                onClick={() => void handleUpdateInquiryStatus(inq._id, 'confirmed')}
                                style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                              >
                                Xác Nhận Đơn
                              </button>
                            )}
                            {inq.status !== 'cancelled' && (
                              <button
                                type="button"
                                className="btn btn-outline"
                                disabled={isBusy}
                                onClick={() => void handleUpdateInquiryStatus(inq._id, 'cancelled')}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '0.78rem',
                                  color: 'var(--color-error-text, var(--color-error))',
                                  borderColor: 'color-mix(in srgb, var(--color-error) 40%, transparent)',
                                }}
                              >
                                Hủy Đơn
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}

          {/* =========================================================================
           * SECTION 9: AN TOÀN & ĐÈN HIỆU (SAFETY TIMERS + LIVE BEACONS)
           * ========================================================================= */}
          {effectiveSection === 'safety' && (() => {
            const activeBeaconsCount = liveBeaconsList.filter((b) => b.status === 'active').length;
            const activeTimersCount = safetyTimersList.filter((t) => t.status === 'active').length;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Safety KPI Grid */}
                <div className="admin-kpi-grid">
                  <div className="admin-kpi-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div
                          style={{
                            fontSize: '0.68rem',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: 'var(--color-text-dim)',
                            fontWeight: 700,
                          }}
                        >
                          Đèn Hiệu SOS Khẩn Cấp
                        </div>
                        <div
                          className="font-editorial"
                          style={{
                            fontSize: '2rem',
                            fontWeight: 500,
                            color:
                              sosBeaconsCount > 0
                                ? 'var(--color-error-text, var(--color-error))'
                                : 'var(--color-primary)',
                            marginTop: 4,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {sosBeaconsCount}
                        </div>
                      </div>
                      <IconShieldAlert
                        size={18}
                        color={sosBeaconsCount > 0 ? 'var(--color-error)' : 'var(--color-primary)'}
                      />
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 6 }}>
                      Ưu tiên phối hợp cứu nạn ngay
                    </div>
                  </div>

                  <div className="admin-kpi-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div
                          style={{
                            fontSize: '0.68rem',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: 'var(--color-text-dim)',
                            fontWeight: 700,
                          }}
                        >
                          Hẹn Giờ Quá Hạn
                        </div>
                        <div
                          className="font-editorial"
                          style={{
                            fontSize: '2rem',
                            fontWeight: 500,
                            color:
                              overdueTimersCount > 0
                                ? 'var(--color-error-text, var(--color-error))'
                                : 'var(--color-primary)',
                            marginTop: 4,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {overdueTimersCount}
                        </div>
                      </div>
                      <AlertTriangle
                        size={18}
                        color={overdueTimersCount > 0 ? 'var(--color-error)' : 'var(--color-primary)'}
                      />
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 6 }}>
                      Chưa bấm xác nhận ra khỏi rừng
                    </div>
                  </div>

                  <div className="admin-kpi-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div
                          style={{
                            fontSize: '0.68rem',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: 'var(--color-text-dim)',
                            fontWeight: 700,
                          }}
                        >
                          Live Beacon Đang Phát
                        </div>
                        <div
                          className="font-editorial"
                          style={{
                            fontSize: '2rem',
                            fontWeight: 500,
                            color: 'var(--color-sky)',
                            marginTop: 4,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {activeBeaconsCount}
                        </div>
                      </div>
                      <Radio size={18} color="var(--color-sky)" />
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 6 }}>
                      Tín hiệu GPS chia sẻ trực tiếp
                    </div>
                  </div>

                  <div className="admin-kpi-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div
                          style={{
                            fontSize: '0.68rem',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: 'var(--color-text-dim)',
                            fontWeight: 700,
                          }}
                        >
                          Hẹn Giờ An Toàn Chạy
                        </div>
                        <div
                          className="font-editorial"
                          style={{
                            fontSize: '2rem',
                            fontWeight: 500,
                            color: 'var(--color-primary)',
                            marginTop: 4,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {activeTimersCount}
                        </div>
                      </div>
                      <Clock size={18} color="var(--color-primary)" />
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 6 }}>
                      Dead-Man Switch trong hạn an toàn
                    </div>
                  </div>
                </div>

                {/* BLOCK 1: LIVE BEACONS (SOS FIRST) */}
                <div className="card" style={{ padding: 24, borderRadius: 6 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 10,
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Radio size={18} color={sosBeaconsCount > 0 ? 'var(--color-error)' : 'var(--color-sky)'} />
                      <div>
                        <h3
                          style={{
                            fontSize: '1.1rem',
                            fontWeight: 800,
                            color: 'var(--color-text-main)',
                            margin: 0,
                          }}
                        >
                          Đèn Hiệu GPS Trực Tiếp — Live Beacons ({liveBeaconsList.length})
                        </h3>
                        <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                          Tín hiệu SOS được ưu tiên ghim đỏ trên đầu danh sách · Bấm mở bản đồ trực tiếp /beacon/:token
                        </p>
                      </div>
                    </div>
                  </div>

                  {liveBeaconsList.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: 28,
                        color: 'var(--color-text-muted)',
                        border: '1px dashed var(--color-border)',
                        borderRadius: 4,
                        fontSize: '0.84rem',
                      }}
                    >
                      Hiện không có phiên Live Beacon nào đang phát tín hiệu.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {liveBeaconsList.map((beacon) => {
                        const isSos = beacon.status === 'sos';
                        const userObj = typeof beacon.userId === 'object' ? beacon.userId : null;
                        const beaconPath = beacon.sharePath || `/beacon/${beacon.token}`;

                        return (
                          <div
                            key={beacon._id || beacon.token}
                            style={{
                              background: isSos
                                ? 'color-mix(in srgb, var(--color-error) 10%, var(--color-bg-main))'
                                : 'var(--color-bg-main)',
                              border: isSos
                                ? '1px solid color-mix(in srgb, var(--color-error) 50%, transparent)'
                                : '1px solid var(--color-border)',
                              borderLeft: isSos
                                ? '4px solid var(--color-error)'
                                : '3px solid var(--color-primary)',
                              padding: '16px 18px',
                              borderRadius: 4,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                flexWrap: 'wrap',
                                gap: 12,
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 240 }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    flexWrap: 'wrap',
                                    marginBottom: 6,
                                  }}
                                >
                                  {isSos ? (
                                    <span
                                      style={{
                                        background: 'var(--color-error)',
                                        color: 'var(--color-on-danger)',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        padding: '3px 9px',
                                        borderRadius: 3,
                                        letterSpacing: '0.05em',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                      }}
                                    >
                                      <IconShieldAlert size={12} /> SOS KHẨN CẤP
                                    </span>
                                  ) : (
                                    <span className="badge badge-success">Đang phát GPS</span>
                                  )}
                                  <strong style={{ fontSize: '0.96rem', color: 'var(--color-text-main)' }}>
                                    {beacon.displayName || userObj?.fullName || 'Trekker LOST'}
                                  </strong>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--color-sky)', fontWeight: 600 }}>
                                    · {beacon.trailName}
                                  </span>
                                  {beacon.isSignalStale && (
                                    <span className="badge badge-sun">
                                      Mất ping {beacon.minutesSinceLastPing} phút
                                    </span>
                                  )}
                                </div>

                                <div
                                  style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 12,
                                    fontSize: '0.78rem',
                                    color: 'var(--color-text-muted)',
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                >
                                  {beacon.lastPosition ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                      <IconMapPin size={12} color="var(--color-primary)" />
                                      <code>
                                        {beacon.lastPosition.lat.toFixed(5)}, {beacon.lastPosition.lng.toFixed(5)}
                                      </code>
                                      {beacon.lastPosition.altitudeM !== null &&
                                        beacon.lastPosition.altitudeM !== undefined && (
                                          <span>({Math.round(beacon.lastPosition.altitudeM)}m)</span>
                                        )}
                                    </span>
                                  ) : (
                                    <span>Chưa nhận tọa độ GPS đầu tiên</span>
                                  )}
                                  {beacon.batteryPercent !== null && beacon.batteryPercent !== undefined && (
                                    <span>
                                      · Pin:{' '}
                                      <strong
                                        style={{
                                          color:
                                            beacon.batteryPercent <= 20
                                              ? 'var(--color-error-text, var(--color-error))'
                                              : 'var(--color-text-main)',
                                        }}
                                      >
                                        {beacon.batteryPercent}%
                                      </strong>
                                    </span>
                                  )}
                                  <span>· Quãng đường: {beacon.distanceKm ?? 0} km</span>
                                  <span>· Ping cuối: {formatDateVi(beacon.lastPingAt)}</span>
                                </div>
                              </div>

                              <a
                                href={beaconPath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={isSos ? 'btn btn-danger' : 'btn btn-primary'}
                                style={{
                                  padding: '7px 14px',
                                  fontSize: '0.78rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  textDecoration: 'none',
                                }}
                              >
                                <ExternalLinkIcon size={13} /> Mở Bản Đồ Live Beacon
                              </a>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 12,
                                padding: '8px 12px',
                                background: 'var(--color-bg-card)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 4,
                                fontSize: '0.76rem',
                                color: 'var(--color-text-muted)',
                              }}
                            >
                              {userObj?.phone && (
                                <a
                                  href={`tel:${userObj.phone}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    color: 'var(--color-primary)',
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                  }}
                                >
                                  <IconPhone size={12} /> SĐT Trekker: {userObj.phone}
                                </a>
                              )}
                              {userObj?.email && (
                                <a
                                  href={`mailto:${userObj.email}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    color: 'var(--color-sky)',
                                    textDecoration: 'none',
                                  }}
                                >
                                  <IconMail size={12} /> {userObj.email}
                                </a>
                              )}
                              {userObj?.emergencyContact && (
                                <span style={{ color: 'var(--color-error-text, var(--color-error))', fontWeight: 700 }}>
                                  · Liên hệ khẩn cấp: {userObj.emergencyContact}
                                </span>
                              )}
                              <span>· Đường dẫn: <code>{beaconPath}</code></span>
                            </div>

                            {beacon.emergencyNote && (
                              <div
                                style={{
                                  fontSize: '0.82rem',
                                  color: isSos
                                    ? 'var(--color-error-text, var(--color-error))'
                                    : 'var(--color-text-main)',
                                  fontWeight: isSos ? 700 : 500,
                                  background: 'var(--color-bg-card)',
                                  padding: '8px 12px',
                                  borderRadius: 4,
                                  border: isSos
                                    ? '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)'
                                    : '1px solid var(--color-border)',
                                }}
                              >
                                Lời nhắn khẩn cấp: &ldquo;{beacon.emergencyNote}&rdquo;
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* BLOCK 2: SAFETY TIMERS (OVERDUE_ALERTED FIRST) */}
                <div className="card" style={{ padding: 24, borderRadius: 6 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Clock
                        size={18}
                        color={overdueTimersCount > 0 ? 'var(--color-error)' : 'var(--color-primary)'}
                      />
                      <div>
                        <h3
                          style={{
                            fontSize: '1.1rem',
                            fontWeight: 800,
                            color: 'var(--color-text-main)',
                            margin: 0,
                          }}
                        >
                          Hẹn Giờ Báo Bình An — Safety Timers ({safetyTimersList.length})
                        </h3>
                        <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                          Các lịch hẹn quá hạn chưa báo bình an được đánh dấu đỏ ở đầu danh sách kèm liên hệ người thân
                        </p>
                      </div>
                    </div>

                    <div className="admin-segmented-control" style={{ flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className={`admin-segmented-btn ${safetyTimerView === 'live' ? 'active' : ''}`}
                        onClick={() => setSafetyTimerView('live')}
                      >
                        Đang chạy &amp; Quá hạn
                      </button>
                      <button
                        type="button"
                        className={`admin-segmented-btn ${safetyTimerView === 'checked_in_safe' ? 'active' : ''}`}
                        onClick={() => setSafetyTimerView('checked_in_safe')}
                      >
                        Đã báo bình an
                      </button>
                      <button
                        type="button"
                        className={`admin-segmented-btn ${safetyTimerView === 'cancelled' ? 'active' : ''}`}
                        onClick={() => setSafetyTimerView('cancelled')}
                      >
                        Đã hủy
                      </button>
                    </div>
                  </div>

                  {safetyTimersList.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: 28,
                        color: 'var(--color-text-muted)',
                        border: '1px dashed var(--color-border)',
                        borderRadius: 4,
                        fontSize: '0.84rem',
                      }}
                    >
                      Không có lịch hẹn báo bình an nào trong trạng thái này.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {safetyTimersList.map((timer) => {
                        const isOverdue = timer.status === 'overdue_alerted';
                        const userObj = typeof timer.userId === 'object' ? timer.userId : null;
                        const hasCoords =
                          typeof timer.lastKnownLat === 'number' &&
                          typeof timer.lastKnownLng === 'number';

                        return (
                          <div
                            key={timer._id}
                            style={{
                              background: isOverdue
                                ? 'color-mix(in srgb, var(--color-error) 10%, var(--color-bg-main))'
                                : 'var(--color-bg-main)',
                              border: isOverdue
                                ? '1px solid color-mix(in srgb, var(--color-error) 50%, transparent)'
                                : '1px solid var(--color-border)',
                              borderLeft: isOverdue
                                ? '4px solid var(--color-error)'
                                : timer.status === 'active'
                                  ? '3px solid var(--color-sky)'
                                  : '3px solid var(--color-primary)',
                              padding: '16px 18px',
                              borderRadius: 4,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                flexWrap: 'wrap',
                                gap: 10,
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    flexWrap: 'wrap',
                                    marginBottom: 4,
                                  }}
                                >
                                  {isOverdue ? (
                                    <span
                                      style={{
                                        background: 'var(--color-error)',
                                        color: 'var(--color-on-danger)',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        padding: '3px 9px',
                                        borderRadius: 3,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                      }}
                                    >
                                      <AlertTriangle size={12} /> QUÁ HẠN BÁO BÌNH AN
                                    </span>
                                  ) : timer.status === 'active' ? (
                                    <span className="badge badge-info">Đang giám sát</span>
                                  ) : timer.status === 'checked_in_safe' ? (
                                    <span className="badge badge-success">Đã về an toàn</span>
                                  ) : (
                                    <span className="badge">Đã hủy</span>
                                  )}
                                  <strong style={{ fontSize: '0.95rem', color: 'var(--color-text-main)' }}>
                                    {userObj?.fullName || userObj?.username || 'Thành viên LOST'}
                                  </strong>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--color-sky)', fontWeight: 600 }}>
                                    · {timer.trailName}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    fontSize: '0.78rem',
                                    color: 'var(--color-text-muted)',
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 10,
                                  }}
                                >
                                  <span>
                                    Dự kiến ra rừng:{' '}
                                    <strong
                                      style={{
                                        color: isOverdue
                                          ? 'var(--color-error-text, var(--color-error))'
                                          : 'var(--color-text-main)',
                                      }}
                                    >
                                      {formatDateVi(timer.expectedReturnAt)}
                                    </strong>
                                  </span>
                                  {timer.alertedAt && (
                                    <span style={{ color: 'var(--color-error-text, var(--color-error))' }}>
                                      · Đã phát cảnh báo lúc: {formatDateVi(timer.alertedAt)}
                                    </span>
                                  )}
                                  {timer.checkedInSafeAt && (
                                    <span style={{ color: 'var(--color-primary)' }}>
                                      · Báo bình an lúc: {formatDateVi(timer.checkedInSafeAt)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {hasCoords && (
                                <a
                                  href={`https://www.google.com/maps?q=${timer.lastKnownLat},${timer.lastKnownLng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-outline"
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '0.76rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    textDecoration: 'none',
                                  }}
                                >
                                  <IconMapPin size={12} />{' '}
                                  <code>
                                    {timer.lastKnownLat!.toFixed(4)}, {timer.lastKnownLng!.toFixed(4)}
                                  </code>
                                  <ExternalLinkIcon size={11} />
                                </a>
                              )}
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 12,
                                padding: '8px 12px',
                                background: 'var(--color-bg-card)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 4,
                                fontSize: '0.76rem',
                                color: 'var(--color-text-muted)',
                              }}
                            >
                              <span>
                                Người thân khẩn cấp:{' '}
                                <strong style={{ color: 'var(--color-text-main)' }}>
                                  {timer.emergencyContactName || 'Chưa rõ'}
                                </strong>
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
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                  }}
                                >
                                  <IconPhone size={12} /> {timer.emergencyContactPhone}
                                </a>
                              )}
                              {timer.emergencyContactEmail && (
                                <a
                                  href={`mailto:${timer.emergencyContactEmail}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    color: 'var(--color-sky)',
                                    textDecoration: 'none',
                                  }}
                                >
                                  <IconMail size={12} /> {timer.emergencyContactEmail}
                                </a>
                              )}
                              {userObj?.phone && (
                                <span>· SĐT Trekker: {userObj.phone}</span>
                              )}
                            </div>

                            {timer.notes && (
                              <div
                                style={{
                                  fontSize: '0.78rem',
                                  color: 'var(--color-text-muted)',
                                }}
                              >
                                Ghi chú hành trình: {timer.notes}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* =========================================================================
           * SECTION 10: KIỂM DUYỆT THỰC ĐỊA (TRAIL POIS & REVIEWS)
           * ========================================================================= */}
          {effectiveSection === 'field' && (
              <div className="card" style={{ padding: 24, borderRadius: 6 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                    marginBottom: 18,
                  }}
                >
                  <div className="admin-segmented-control" style={{ flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={`admin-segmented-btn ${fieldSubTab === 'pois' ? 'active' : ''}`}
                      onClick={() => setFieldSubTab('pois')}
                    >
                      <IconMapPin size={14} />
                      <span>Điểm Thực Địa (POIs)</span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '1px 6px',
                          borderRadius: 4,
                          color: 'var(--color-stream)',
                          fontWeight: 800,
                        }}
                      >
                        {poisTotal || poisList.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`admin-segmented-btn ${fieldSubTab === 'reviews' ? 'active' : ''}`}
                      onClick={() => setFieldSubTab('reviews')}
                    >
                      <IconStar size={14} color="var(--color-sun)" />
                      <span>Đánh Giá Cung Đường</span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '1px 6px',
                          borderRadius: 4,
                          color: 'var(--color-sun)',
                          fontWeight: 800,
                        }}
                      >
                        {reviewsTotal || reviewsList.length}
                      </span>
                    </button>
                  </div>

                  <div className="admin-search-wrapper" style={{ maxWidth: 320 }}>
                    <Search size={15} color="var(--color-text-dim)" />
                    <input
                      type="text"
                      placeholder={
                        fieldSubTab === 'pois'
                          ? 'Lọc theo tên POI, cung đường, tác giả...'
                          : 'Lọc theo cung đường, người đánh giá, nội dung...'
                      }
                      value={fieldSearchQuery}
                      onChange={(e) => setFieldSearchQuery(e.target.value)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-text-main)',
                        fontSize: '0.82rem',
                        width: '100%',
                        outline: 'none',
                      }}
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
                        <IconX size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* SUB-TAB 1: TRAIL POIS */}
                {fieldSubTab === 'pois' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredPois.length === 0 ? (
                      <div
                        style={{
                          textAlign: 'center',
                          padding: 32,
                          color: 'var(--color-text-muted)',
                          border: '1px dashed var(--color-border)',
                          borderRadius: 4,
                          fontSize: '0.84rem',
                        }}
                      >
                        Không có điểm thực địa (POI) nào khớp với bộ lọc hiện tại.
                      </div>
                    ) : (
                      filteredPois.map((poi) => {
                        const isClosed = poi.status === 'dry_or_closed';
                        const authorObj = typeof poi.userId === 'object' ? poi.userId : null;
                        const isBusy = togglingPoiId === poi._id;

                        return (
                          <div
                            key={poi._id}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 12,
                              background: 'var(--color-bg-main)',
                              border: '1px solid var(--color-border)',
                              borderLeft: isClosed
                                ? '3px solid var(--color-sun)'
                                : '3px solid var(--color-primary)',
                              padding: '14px 16px',
                              borderRadius: 4,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 260 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  flexWrap: 'wrap',
                                  marginBottom: 6,
                                }}
                              >
                                <span
                                  className={
                                    poi.category === 'danger' ? 'badge badge-error' : 'badge badge-info'
                                  }
                                >
                                  {POI_CATEGORY_LABELS[poi.category] || poi.category}
                                </span>
                                <strong style={{ fontSize: '0.94rem', color: 'var(--color-text-main)' }}>
                                  {poi.title}
                                </strong>
                                <span className={isClosed ? 'badge badge-sun' : 'badge badge-success'}>
                                  {isClosed ? 'Đã cạn / Đóng' : 'Đang hoạt động'}
                                </span>
                              </div>

                              {poi.notes && (
                                <p
                                  style={{
                                    fontSize: '0.82rem',
                                    color: 'var(--color-text-main)',
                                    margin: '0 0 8px 0',
                                    lineHeight: 1.45,
                                  }}
                                >
                                  {poi.notes}
                                </p>
                              )}

                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 10,
                                  fontSize: '0.76rem',
                                  color: 'var(--color-text-muted)',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                <span>
                                  Tuyến:{' '}
                                  <strong style={{ color: 'var(--color-sky)' }}>
                                    {poi.trail?.name || poi.trailName || poi.trailId}
                                  </strong>
                                  {poi.trail?.province || poi.trailProvince
                                    ? ` (${poi.trail?.province || poi.trailProvince})`
                                    : ''}
                                </span>
                                <span>
                                  · Tọa độ:{' '}
                                  <code>
                                    {Number(poi.lat).toFixed(5)}, {Number(poi.lng).toFixed(5)}
                                  </code>
                                  {poi.elevationM !== null && poi.elevationM !== undefined
                                    ? ` · ${poi.elevationM}m`
                                    : ''}
                                </span>
                                <span>
                                  · Người đăng: <strong>{poi.authorName || authorObj?.fullName || 'Trekker'}</strong>
                                  {authorObj?.email ? ` (${authorObj.email})` : ''}
                                </span>
                                <span>· {poi.upvoteCount || 0} xác nhận</span>
                                <span>· {formatDateVi(poi.createdAt)}</span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn btn-outline"
                                disabled={isBusy}
                                onClick={() => void handleTogglePoiStatus(poi)}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '0.78rem',
                                  color: isClosed ? 'var(--color-primary)' : 'var(--color-sun)',
                                  borderColor: isClosed
                                    ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)'
                                    : 'color-mix(in srgb, var(--color-sun) 45%, transparent)',
                                }}
                              >
                                {isClosed ? 'Đánh Dấu Hoạt Động' : 'Đánh Dấu Cạn / Đóng'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => handleDeletePoi(poi)}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '0.78rem',
                                  color: 'var(--color-error-text, var(--color-error))',
                                  borderColor: 'color-mix(in srgb, var(--color-error) 40%, transparent)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <IconTrash size={12} /> Xóa
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredReviews.length === 0 ? (
                      <div
                        style={{
                          textAlign: 'center',
                          padding: 32,
                          color: 'var(--color-text-muted)',
                          border: '1px dashed var(--color-border)',
                          borderRadius: 4,
                          fontSize: '0.84rem',
                        }}
                      >
                        Không có đánh giá cung đường nào khớp với bộ lọc hiện tại.
                      </div>
                    ) : (
                      filteredReviews.map((rev) => {
                        const trailObj = typeof rev.trailId === 'object' ? rev.trailId : null;
                        const userObj = typeof rev.userId === 'object' ? rev.userId : null;
                        const reviewerName = userObj?.fullName || rev.userName || 'Thành viên LOST';
                        const reviewerAvatar = userObj?.avatarUrl || rev.userAvatar || DEFAULT_AVATAR;

                        return (
                          <div
                            key={rev._id}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 12,
                              background: 'var(--color-bg-main)',
                              border: '1px solid var(--color-border)',
                              padding: '14px 16px',
                              borderRadius: 4,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 260 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  flexWrap: 'wrap',
                                  marginBottom: 8,
                                }}
                              >
                                <img
                                  loading="lazy"
                                  decoding="async"
                                  src={reviewerAvatar}
                                  alt={reviewerName}
                                  style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '1px solid var(--color-border-strong)',
                                  }}
                                />
                                <strong style={{ fontSize: '0.9rem', color: 'var(--color-text-main)' }}>
                                  {reviewerName}
                                </strong>
                                {userObj?.email && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                    ({userObj.email})
                                  </span>
                                )}
                                <span className="badge badge-info">
                                  {trailObj?.name || 'Cung đường'}
                                  {trailObj?.province ? ` · ${trailObj.province}` : ''}
                                </span>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    color: 'var(--color-sun)',
                                    fontSize: '0.78rem',
                                    fontWeight: 800,
                                  }}
                                  aria-label={`Đánh giá ${rev.rating} trên 5 sao`}
                                >
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <IconStar
                                      key={star}
                                      size={12}
                                      color="var(--color-sun)"
                                      fill={star <= Math.round(rev.rating) ? 'var(--color-sun)' : 'none'}
                                    />
                                  ))}
                                  <span style={{ marginLeft: 4 }}>{rev.rating}/5</span>
                                </span>
                              </div>

                              <p
                                style={{
                                  fontSize: '0.84rem',
                                  color: 'var(--color-text-main)',
                                  margin: '0 0 8px 0',
                                  lineHeight: 1.5,
                                  whiteSpace: 'pre-line',
                                }}
                              >
                                {rev.content}
                              </p>

                              {rev.safetyNote && (
                                <div
                                  style={{
                                    fontSize: '0.78rem',
                                    color: 'var(--color-sun)',
                                    background: 'color-mix(in srgb, var(--color-sun) 10%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--color-sun) 30%, transparent)',
                                    padding: '6px 10px',
                                    borderRadius: 4,
                                    marginBottom: 8,
                                  }}
                                >
                                  Lưu ý an toàn: {rev.safetyNote}
                                </div>
                              )}

                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 10,
                                  fontSize: '0.74rem',
                                  color: 'var(--color-text-dim)',
                                }}
                              >
                                {rev.difficultyRating && (
                                  <span>Độ khó cảm nhận: {rev.difficultyRating}/5</span>
                                )}
                                {rev.tripDate && <span>· Ngày đi: {rev.tripDate}</span>}
                                <span>· {rev.helpfulCount || 0} lượt thấy hữu ích</span>
                                <span>· Đăng lúc: {formatDateVi(rev.createdAt)}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => handleDeleteReview(rev)}
                              style={{
                                padding: '6px 12px',
                                fontSize: '0.78rem',
                                color: 'var(--color-error-text, var(--color-error))',
                                borderColor: 'color-mix(in srgb, var(--color-error) 40%, transparent)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <IconTrash size={12} /> Xóa Spam
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
          )}
        </div>
      </main>

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
                  liveContrib.authorAvatar &&
                  !liveContrib.authorAvatar.includes('ui-avatars.com/api/?name=Trekker')
                    ? liveContrib.authorAvatar
                    : matchedUser?.avatarUrl ||
                      matchedUser?.avatar ||
                      liveContrib.authorAvatar ||
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
                    placeholder="https://res.cloudinary.com/..."
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
                    placeholder="https://res.cloudinary.com/..."
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
