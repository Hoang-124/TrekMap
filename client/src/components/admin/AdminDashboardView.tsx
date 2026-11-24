import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { UserProfile } from '../../types.js';
import { IconPin, IconLock, IconTrash, IconX, IconStar } from '../common/SvgIcons.js';
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

interface AdminTrailItem {
  _id?: string;
  id?: string;
  name?: string;
  province?: string;
  region?: string;
  distanceKm?: number;
  elevationGainM?: number;
  maxAltitudeM?: number;
  difficultyLevel?: number;
  durationHoursNote?: string;
  description?: string;
  coverImage?: string;
  permitRequired?: boolean;
  permitInfo?: string;
  rating?: number;
  reviewCount?: number;
}

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
  confirmations?: number;
  disputes?: AdminIncidentDispute[];
}

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
  isEmailVerified?: boolean;
  authProvider?: string;
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
  onConfirm: () => Promise<void> | void;
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
  const [adminSection, setAdminSection] = useState<
    'contributions' | 'trails' | 'incidents' | 'users' | 'forum' | 'stats' | 'audit'
  >('contributions');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'all'>('pending');
  const [selectedContribution, setSelectedContribution] = useState<AdminContributionItem | null>(null);
  const [selectedAuthorModal, setSelectedAuthorModal] = useState<AdminAuthorModalState | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [trailSearchQuery, setTrailSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [accessNotice, setAccessNotice] = useState<string>('');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [isConfirmExecuting, setIsConfirmExecuting] = useState<boolean>(false);

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
  const [editingTrailModal, setEditingTrailModal] = useState<AdminTrailItem | null>(null);
  const [editTrailForm, setEditTrailForm] = useState<{
    name: string;
    province: string;
    region: ValidRegion;
    distanceKm: string;
    elevationGainM: string;
    maxAltitudeM: string;
    difficultyLevel: string;
    durationHoursNote: string;
    description: string;
    permitRequired: boolean;
    permitInfo: string;
  }>({
    name: '',
    province: '',
    region: 'Miền Bắc',
    distanceKm: '0',
    elevationGainM: '0',
    maxAltitudeM: '0',
    difficultyLevel: '3',
    durationHoursNote: '',
    description: '',
    permitRequired: false,
    permitInfo: '',
  });
  const [isSavingTrail, setIsSavingTrail] = useState(false);
  const [isCreateTrailOpen, setIsCreateTrailOpen] = useState(false);

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
      province: trail.province || '',
      region: normalizeRegion(trail.region),
      distanceKm: String(trail.distanceKm ?? 0),
      elevationGainM: String(trail.elevationGainM ?? 0),
      maxAltitudeM: String(trail.maxAltitudeM ?? 0),
      difficultyLevel: String(trail.difficultyLevel ?? 3),
      durationHoursNote: trail.durationHoursNote || '',
      description: trail.description || '',
      permitRequired: Boolean(trail.permitRequired),
      permitInfo: trail.permitInfo || '',
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
        setIsCreateTrailOpen(false);
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

  const fetchFromMongo = useCallback(async () => {
    try {
      const res = await fetch('/api/contributions', {
        headers: getApiHeaders(),
      });
      if (handleForbiddenStatus(res, 'Duyệt đóng góp')) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setContributions(data.data);
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
  }, [handleForbiddenStatus]);

  const fetchAdminUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: getApiHeaders(),
      });
      if (handleForbiddenStatus(res, 'Người dùng & phân quyền')) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) setUsersList(data.data);
    } catch {
      // fail gracefully
    }
  }, [handleForbiddenStatus]);

  const fetchAdminTrails = useCallback(async () => {
    try {
      const res = await fetch('/api/trails', {
        headers: getApiHeaders(),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) setTrailsList(data.data);
    } catch {
      // fail gracefully
    }
  }, []);

  const fetchAdminIncidents = useCallback(async () => {
    try {
      const res = await fetch('/api/incidents', {
        headers: getApiHeaders(),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) setIncidentsList(data.data);
    } catch {
      // fail gracefully
    }
  }, []);

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
      }
    } catch {
      // fail gracefully
    }
  }, []);

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
    try {
      const res = await fetch('/api/admin/audit-logs?limit=60', {
        headers: getApiHeaders(),
      });
      if (handleForbiddenStatus(res, 'Nhật ký kiểm toán')) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) setAuditLogs(data.data);
    } catch {
      // fail gracefully
    }
  }, [handleForbiddenStatus]);

  const refreshAllData = async () => {
    setIsRefreshing(true);
    setAccessNotice('');
    await Promise.allSettled([
      fetchFromMongo(),
      fetchAdminUsers(),
      fetchAdminTrails(),
      fetchAdminIncidents(),
      fetchAdminThreads(),
      fetchAdminStats(),
      fetchAuditLogs(),
    ]);
    setTimeout(() => {
      setIsRefreshing(false);
      onShowToast?.('Đã đồng bộ dữ liệu toàn hệ thống với máy chủ!', 'success');
    }, 350);
  };

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      void fetchFromMongo();
      void fetchAdminUsers();
      void fetchAdminTrails();
      void fetchAdminIncidents();
      void fetchAdminThreads();
      void fetchAdminStats();
      void fetchAuditLogs();
    });
    return () => {
      active = false;
    };
  }, [
    fetchFromMongo,
    fetchAdminUsers,
    fetchAdminTrails,
    fetchAdminIncidents,
    fetchAdminThreads,
    fetchAdminStats,
    fetchAuditLogs,
  ]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      if (adminSection === 'users') void fetchAdminUsers();
      if (adminSection === 'trails') void fetchAdminTrails();
      if (adminSection === 'incidents') void fetchAdminIncidents();
      if (adminSection === 'forum') void fetchAdminThreads();
      if (adminSection === 'stats') void fetchAdminStats();
      if (adminSection === 'audit') void fetchAuditLogs();
    });
    return () => {
      active = false;
    };
  }, [
    adminSection,
    fetchAdminUsers,
    fetchAdminTrails,
    fetchAdminIncidents,
    fetchAdminThreads,
    fetchAdminStats,
    fetchAuditLogs,
  ]);

  const handleSaveTrailEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrailModal) return;
    const targetId = editingTrailModal._id || editingTrailModal.id;
    if (!targetId) return;

    setIsSavingTrail(true);
    try {
      const res = await fetch(`/api/admin/trails/${targetId}`, {
        method: 'PUT',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: editTrailForm.name.trim(),
          province: editTrailForm.province.trim(),
          region: normalizeRegion(editTrailForm.region),
          distanceKm: Number(editTrailForm.distanceKm) || 0,
          elevationGainM: Number(editTrailForm.elevationGainM) || 0,
          maxAltitudeM: Number(editTrailForm.maxAltitudeM) || 0,
          difficultyLevel: Math.min(5, Math.max(1, Number(editTrailForm.difficultyLevel) || 3)),
          durationHoursNote: editTrailForm.durationHoursNote.trim(),
          description: editTrailForm.description.trim(),
          permitRequired: editTrailForm.permitRequired,
          permitInfo: editTrailForm.permitInfo.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể cập nhật thông tin cung đường.');
      }
      onShowToast?.(`Đã cập nhật cung đường "${editTrailForm.name.trim()}" thành công!`, 'success');
      setEditingTrailModal(null);
      void fetchAdminTrails();
      void fetchAuditLogs();
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
        void fetchAuditLogs();
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
    setConfirmDialog({
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
          void fetchAuditLogs();
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
        void fetchAuditLogs();
      } else {
        onShowToast?.(data.message || 'Không thể xử lý khiếu nại.', 'error');
      }
    } catch {
      onShowToast?.('Lỗi kết nối máy chủ khi xử lý khiếu nại.', 'error');
    }
  };

  const pendingContributions = contributions.filter((c) => c.status === 'pending' || !c.status);
  const approvedContributions = contributions.filter((c) => c.status === 'approved');

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
      void fetchAuditLogs();
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
      void fetchAuditLogs();
    } catch (e: unknown) {
      onShowToast?.(
        e instanceof Error ? e.message : 'Không thể từ chối bài đóng góp.',
        'error'
      );
    }
  };

  const handleDeleteContribution = (id: string, name: string) => {
    setConfirmDialog({
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
        void fetchAuditLogs();
      },
    });
  };

  const handleDeleteTrail = (id: string, name: string) => {
    setConfirmDialog({
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
          void fetchAuditLogs();
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
        void fetchAuditLogs();
      } else {
        onShowToast?.(data.message || 'Không thể gỡ cảnh báo sự cố.', 'error');
      }
    } catch {
      onShowToast?.('Lỗi kết nối máy chủ khi xử lý sự cố.', 'error');
    }
  };

  const handleDeleteIncident = (id: string) => {
    setConfirmDialog({
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
          void fetchAuditLogs();
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
    setConfirmDialog({
      title: 'Khóa tài khoản thành viên',
      message: `Xác nhận khóa tài khoản "${label}"? Người dùng này sẽ bị đăng xuất ngay lập tức và không thể truy cập LOST.`,
      confirmLabel: 'Khóa tài khoản',
      danger: true,
      onConfirm: async () => {
        const res = await fetch(`/api/admin/users/${id}/ban`, {
          method: 'PUT',
          headers: getApiHeaders(),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          onShowToast?.(`Đã khóa tài khoản ${label}`, 'info');
          setUsersList((prev) =>
            prev.map((u) => (u._id === id || u.id === id ? { ...u, isBanned: true } : u))
          );
          void fetchAdminUsers();
          void fetchAdminStats();
          void fetchAuditLogs();
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
          prev.map((u) => (u._id === id || u.id === id ? { ...u, isBanned: false } : u))
        );
        void fetchAdminUsers();
        void fetchAdminStats();
        void fetchAuditLogs();
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
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } catch {
      onShowToast?.('Đã xảy ra lỗi khi thực hiện thao tác.', 'error');
    } finally {
      setIsConfirmExecuting(false);
    }
  };

  const pendingDisputesCount = incidentsList.filter(
    (i) => Array.isArray(i.disputes) && i.disputes.length > 0
  ).length;

  const navItems = [
    {
      id: 'contributions' as const,
      label: 'Duyệt Đóng Góp',
      icon: Inbox,
      badge: pendingContributions.length,
      badgeColor: 'var(--color-sun)',
      badgeTextColor: 'var(--color-on-primary)',
    },
    {
      id: 'trails' as const,
      label: 'Kho Cung Đường',
      icon: Layers,
      badge: trailsList.length,
      badgeColor: 'var(--color-sky)',
      badgeTextColor: 'var(--color-on-primary)',
    },
    {
      id: 'incidents' as const,
      label: 'Quản Lý Sự Cố',
      icon: AlertTriangle,
      badge: incidentsList.length,
      badgeColor: 'var(--color-error)',
      badgeTextColor: 'var(--color-on-danger)',
      urgent: pendingDisputesCount > 0,
      urgentText: `${pendingDisputesCount} Khiếu nại`,
    },
    {
      id: 'users' as const,
      label: 'Người Dùng & Quyền',
      icon: Users,
      badge: usersList.length,
      badgeColor: 'var(--color-primary)',
      badgeTextColor: 'var(--color-on-primary)',
    },
    {
      id: 'forum' as const,
      label: 'Kiểm Duyệt Diễn Đàn',
      icon: MessageSquare,
      badge: threadsList.length,
      badgeColor: 'var(--color-earth)',
      badgeTextColor: 'var(--color-on-primary)',
    },
    {
      id: 'stats' as const,
      label: 'Thống Kê Tổng Quan',
      icon: BarChart3,
    },
    {
      id: 'audit' as const,
      label: 'Nhật Ký Kiểm Toán',
      icon: ShieldCheck,
      badge: auditLogs.length > 0 ? auditLogs.length : undefined,
      badgeColor: 'var(--color-sky)',
      badgeTextColor: 'var(--color-on-primary)',
    },
  ];

  const sectionTitles: Record<typeof adminSection, { title: string; subtitle: string }> = {
    contributions: {
      title: 'Duyệt & Quản Lý Đóng Góp Cung Đường',
      subtitle:
        'Xem chi tiết các bài đóng góp từ cộng đồng, kiểm tra thông tin địa lý và phê duyệt lên bản đồ 3D',
    },
    trails: {
      title: 'Quản Lý Danh Mục Cung Đường Trekking',
      subtitle:
        'Theo dõi, chỉnh sửa trực tiếp thông số và quản lý kho dữ liệu cung đường thực địa Việt Nam',
    },
    incidents: {
      title: 'Trung Tâm Quản Lý Sự Cố & Cứu Hộ',
      subtitle:
        'Kiểm duyệt báo cáo sự cố sạt lở, mất dấu từ cộng đồng và giải quyết khiếu nại thông tin giả',
    },
    users: {
      title: 'Quản Trị Thành Viên & Phân Quyền Vai Trò',
      subtitle:
        'Quản lý tài khoản, cấp quyền Hướng dẫn viên (Guide), Điều hành viên (Mod) hoặc xử lý vi phạm',
    },
    forum: {
      title: 'Kiểm Duyệt & Điều Hành Diễn Đàn',
      subtitle:
        'Ghim bài thông báo quan trọng, khóa bình luận hoặc gỡ bài viết vi phạm chuẩn mực cộng đồng',
    },
    stats: {
      title: 'Báo Cáo Thống Kê & Phân Tích Hệ Thống',
      subtitle:
        'Báo cáo tổng hợp số liệu dữ liệu thực tế lưu trữ trên MongoDB Atlas và hoạt động thời gian thực',
    },
    audit: {
      title: 'Nhật Ký Kiểm Toán Thao Tác Ban Quản Trị (Audit Log)',
      subtitle:
        'Lưu vết minh bạch mọi thay đổi phân quyền, khóa tài khoản, cập nhật/xóa cung đường trong 180 ngày gần nhất',
    },
  };

  const filteredTrails = trailsList.filter(
    (t) =>
      !trailSearchQuery.trim() ||
      searchMatchVietnamese(t.name || '', trailSearchQuery) ||
      searchMatchVietnamese(t.province || '', trailSearchQuery) ||
      searchMatchVietnamese(t.region || '', trailSearchQuery)
  );

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
                  background: 'var(--color-primary)',
                  display: 'inline-block',
                }}
              />
              LOST OPS v2.4
            </div>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'color-mix(in srgb, var(--color-sky) 12%, transparent)',
                color: 'var(--color-sky)',
                border: '1px solid color-mix(in srgb, var(--color-sky) 30%, transparent)',
              }}
            >
              REALTIME
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
                {currentUser?.role === 'admin' ? 'Quản Trị Viên Cấp Cao' : 'BQT · Điều Hành Viên'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map((item) => {
            const isActive = adminSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setAdminSection(item.id)}
                className={`admin-nav-item ${isActive ? 'active' : ''}`}
                style={{ width: '100%', textAlign: 'left' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <item.icon size={15} />
                  <span>{item.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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

        {/* Infrastructure Status Widget & Back Link */}
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
              <Database size={13} color="var(--color-primary)" /> MongoDB Atlas
            </span>
            <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>Trực Tuyến</span>
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
              <Radio size={13} color="var(--color-sky)" /> Kênh Kết Nối
            </span>
            <span style={{ color: 'var(--color-sky)', fontWeight: 700 }}>Socket.IO Live</span>
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
              <span>{navItems.find((n) => n.id === adminSection)?.label}</span>
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
              {sectionTitles[adminSection].title}
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
              {sectionTitles[adminSection].subtitle}
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

            {adminSection === 'trails' && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsCreateTrailOpen(true)}
                style={{ fontSize: '0.8rem', padding: '7px 14px', gap: 6 }}
              >
                + Thêm Cung Đường Mới
              </button>
            )}

            {adminSection === 'contributions' && (
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
                + Mở Trình Đóng Góp
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

        <div key={adminSection} className="tab-content-slide">
          {/* =========================================================================
           * SECTION 1: DUYỆT ĐÓNG GÓP (CONTRIBUTIONS)
           * ========================================================================= */}
          {adminSection === 'contributions' && (
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
                        100%{' '}
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
                    Đã xác thực tọa độ thực địa
                  </div>
                </div>
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
                <div className="admin-segmented-control">
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
                  const rawList =
                    activeTab === 'pending'
                      ? pendingContributions
                      : activeTab === 'approved'
                        ? approvedContributions
                        : contributions;

                  const listToDisplay = rawList.filter((c) => {
                    if (!searchQuery.trim()) return true;
                    return (
                      searchMatchVietnamese(c.name || '', searchQuery) ||
                      searchMatchVietnamese(c.authorName || '', searchQuery) ||
                      searchMatchVietnamese(c.authorEmail || '', searchQuery) ||
                      searchMatchVietnamese(c.province || '', searchQuery)
                    );
                  });

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
          {adminSection === 'trails' && (
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                </div>

                <div className="admin-search-wrapper" style={{ maxWidth: 320 }}>
                  <Search size={15} color="var(--color-text-dim)" />
                  <input
                    type="text"
                    placeholder="Lọc theo tên cung, tỉnh thành..."
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
                              {trail.province} · Cự ly:{' '}
                              <strong style={{ color: 'var(--color-primary)' }}>
                                {trail.distanceKm} km
                              </strong>{' '}
                              · Cao độ: <strong>+{trail.elevationGainM}m</strong> · Đánh giá:
                            </span>
                            <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <IconStar size={12} color="var(--color-sun)" />{' '}
                              {trail.reviewCount ? Number(trail.rating || 0).toFixed(1) : 'Mới'}
                            </strong>
                            <span>({trail.reviewCount || 0} lượt)</span>
                          </div>
                        </div>
                      </div>

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
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
           * SECTION 3: QUẢN LÝ SỰ CỐ & CỨU HỘ (INCIDENTS)
           * ========================================================================= */}
          {adminSection === 'incidents' && (
            <div className="card" style={{ padding: 24, borderRadius: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
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
                    Sự Cố Khẩn Cấp &amp; Cảnh Báo Thực Địa ({incidentsList.length})
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                    Kiểm duyệt tin báo sạt lở, lũ quét, đi lạc và xử lý khiếu nại báo động giả
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {incidentsList.length === 0 ? (
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
                    Hiện không có báo cáo sự cố khẩn cấp nào trên các cung đường.
                  </div>
                ) : (
                  incidentsList.map((inc) => {
                    const reporterId = extractEntityId(inc.reportedBy);
                    return (
                      <div
                        key={inc._id || inc.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          background: 'var(--color-bg-main)',
                          border: '1px solid var(--color-border)',
                          borderLeft:
                            inc.severity === 'critical' || inc.severity === 'high'
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
                              {inc.resolved ? (
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

                            {reporterId && (
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
                            Người phát:{' '}
                            <strong style={{ color: 'var(--color-primary)' }}>
                              {inc.reporterName || inc.userName || 'Trekker Thực Địa'}
                            </strong>
                          </span>
                          {inc.reporterEmail && (
                            <span style={{ color: 'var(--color-text-muted)' }}>· {inc.reporterEmail}</span>
                          )}
                          <span style={{ color: 'var(--color-text-dim)' }}>
                            · Thời gian: {formatDateVi(inc.reportedAt)}
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

                        {Array.isArray(inc.disputes) && inc.disputes.length > 0 && (
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
           * SECTION 4: QUẢN LÝ NGƯỜI DÙNG & PHÂN QUYỀN (USERS)
           * ========================================================================= */}
          {adminSection === 'users' && (
            <div className="card" style={{ padding: 24, borderRadius: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <Users size={18} color="var(--color-primary)" />
                <h3
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    margin: 0,
                  }}
                >
                  Danh Sách Thành Viên &amp; Phân Quyền ({usersList.length})
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {usersList.map((u) => {
                  const uid = u._id || u.id;
                  return (
                    <div
                      key={uid}
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
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img
                          src={u.avatarUrl || DEFAULT_AVATAR}
                          alt={u.fullName || u.username}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 4,
                            objectFit: 'cover',
                            border: '1px solid var(--color-border-strong)',
                          }}
                        />
                        <div>
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
                            onClick={() => handleBanUser(uid, u.email || '')}
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
                })}
              </div>
            </div>
          )}

          {/* =========================================================================
           * SECTION 5: KIỂM DUYỆT DIỄN ĐÀN (FORUM)
           * ========================================================================= */}
          {adminSection === 'forum' && (
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
                {threadsList.map((t) => {
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
                })}
              </div>
            </div>
          )}

          {/* =========================================================================
           * SECTION 6: THỐNG KÊ TỔNG QUAN (STATS)
           * ========================================================================= */}
          {adminSection === 'stats' && (
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
                    Thống Kê Dữ Liệu Thực Địa &amp; Hệ Thống
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                    Tổng hợp số liệu thời gian thực được đồng bộ trên MongoDB Atlas
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 16,
                }}
              >
                <div
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    padding: 18,
                    borderRadius: 4,
                  }}
                >
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    Tổng Thành Viên
                  </div>
                  <div
                    style={{
                      fontSize: '1.9rem',
                      fontWeight: 900,
                      color: 'var(--color-primary)',
                      marginTop: 4,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {adminStats?.totalUsers ?? usersList.length}
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    padding: 18,
                    borderRadius: 4,
                  }}
                >
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    Cung Đường Công Khai
                  </div>
                  <div
                    style={{
                      fontSize: '1.9rem',
                      fontWeight: 900,
                      color: 'var(--color-sky)',
                      marginTop: 4,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {adminStats?.totalTrails ?? trailsList.length}
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    padding: 18,
                    borderRadius: 4,
                  }}
                >
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    Tổng Bài Đóng Góp
                  </div>
                  <div
                    style={{
                      fontSize: '1.9rem',
                      fontWeight: 900,
                      color: 'var(--color-primary)',
                      marginTop: 4,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {adminStats?.totalContributions ?? contributions.length}
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    padding: 18,
                    borderRadius: 4,
                  }}
                >
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    Bài Chờ Kiểm Duyệt
                  </div>
                  <div
                    style={{
                      fontSize: '1.9rem',
                      fontWeight: 900,
                      color: 'var(--color-sun)',
                      marginTop: 4,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {adminStats?.pendingContributions ?? pendingContributions.length}
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    padding: 18,
                    borderRadius: 4,
                  }}
                >
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    Sự Cố Khẩn Cấp
                  </div>
                  <div
                    style={{
                      fontSize: '1.9rem',
                      fontWeight: 900,
                      color: 'var(--color-error-text, var(--color-error))',
                      marginTop: 4,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {adminStats?.totalIncidents ?? incidentsList.length}
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    padding: 18,
                    borderRadius: 4,
                  }}
                >
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    Chủ Đề Diễn Đàn
                  </div>
                  <div
                    style={{
                      fontSize: '1.9rem',
                      fontWeight: 900,
                      color: 'var(--color-earth)',
                      marginTop: 4,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {adminStats?.totalThreads ?? threadsList.length}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
           * SECTION 7: NHẬT KÝ KIỂM TOÁN (AUDIT LOGS)
           * ========================================================================= */}
          {adminSection === 'audit' && (
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
       * INLINE EDIT TRAIL MODAL
       * ========================================================================= */}
      {editingTrailModal &&
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
              aria-label="Chỉnh sửa thông số cung đường"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 620,
                width: '94%',
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
                  onClick={() => setEditingTrailModal(null)}
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
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 12,
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">Tên cung đường</label>
                    <input
                      className="form-input"
                      value={editTrailForm.name}
                      onChange={(e) => setEditTrailForm({ ...editTrailForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tỉnh / Thành phố</label>
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
                    <label className="form-label">Vùng miền</label>
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
                    <label className="form-label">Thời lượng (VD: 2 ngày 1 đêm)</label>
                    <input
                      className="form-input"
                      value={editTrailForm.durationHoursNote}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, durationHoursNote: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cự ly (km)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="form-input"
                      value={editTrailForm.distanceKm}
                      onChange={(e) =>
                        setEditTrailForm({ ...editTrailForm, distanceKm: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Độ cao tích lũy (m)</label>
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
                    <label className="form-label">Độ cao đỉnh (m)</label>
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
                    <label className="form-label">Độ khó (1 - 5)</label>
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
                  Yêu cầu giấy phép Kiểm lâm / Ban quản lý VQG
                </label>

                {editTrailForm.permitRequired && (
                  <div className="form-group">
                    <label className="form-label">Thông tin cấp phép</label>
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
       * CREATE TRAIL WIZARD LAUNCHER MODAL
       * ========================================================================= */}
      {isCreateTrailOpen &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => setIsCreateTrailOpen(false)}
            style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}
          >
            <div
              ref={createTrailModalRef}
              tabIndex={-1}
              className="modal-content"
              role="dialog"
              aria-modal="true"
              aria-label="Thêm cung đường mới"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 500, width: '90%', padding: 24, borderRadius: 6, outline: 'none' }}
            >
              <h3
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  color: 'var(--color-text-main)',
                  marginBottom: 12,
                }}
              >
                Thêm Cung Đường Mới (BQT LOST)
              </h3>
              <p
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--color-text-muted)',
                  marginBottom: 20,
                  lineHeight: 1.5,
                }}
              >
                Để thiết lập thông số kỹ thuật, bản đồ độ cao và tọa độ GPS thực địa đầy đủ cho cung
                đường mới, hãy khởi chạy Trình Wizard đóng góp 5 bước chuẩn hóa.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleOpenContributeWizard}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Mở Wizard Đóng Góp
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsCreateTrailOpen(false)}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Hủy / Đóng
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* =========================================================================
       * STYLED IN-APP CONFIRMATION DIALOG (Replaces window.confirm)
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
                maxWidth: 440,
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
                  margin: '0 0 20px 0',
                }}
              >
                {confirmDialog.message}
              </p>
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
