import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { UserProfile, Trail, ForumThread } from '../../types.js';
import { fetchTrails, updateSavedTrailMeta } from '../../services/api.js';
import { ThreadDetailModal } from '../forum/ThreadDetailModal.js';
import { AuthorProfileModal } from '../forum/AuthorProfileModal.js';
import { ProfileAnalyticsPanel, type RawCheckinInput } from './ProfileAnalyticsPanel.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { clearSensitiveSessionStorage } from '../../utils/storageScope.js';
import { useFocusTrap, isTopmostFocusTrap } from '../../hooks/useFocusTrap.js';
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator.js';
import { DEFAULT_VIETNAM_TRAIL_COVER } from '../../utils/cloudinary.js';
import { getTrekkerAvatarSvg } from '../../utils/avatarSvg.js';
import { generateQrMatrix, buildQrSvgPath } from '../../utils/qrMatrix.js';

const createSvgIcon = (d: string | React.ReactNode, defaultSize = 18) => {
  return ({ size = defaultSize, color = 'currentColor', style, className }: { size?: number; color?: string; style?: React.CSSProperties; className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
      {typeof d === 'string' ? <path d={d} /> : d}
    </svg>
  );
};

const ArrowLeft = createSvgIcon('M19 12H5M12 19l-7-7 7-7');
const Award = createSvgIcon(<><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></>);
const MapPin = createSvgIcon(<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>);
const User = createSvgIcon(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>);
const Mail = createSvgIcon(<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>);
const Phone = createSvgIcon('M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z');
const Edit3 = createSvgIcon('M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z');
const Save = createSvgIcon(<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>);
const CheckCircle2 = createSvgIcon(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>);
const Lock = createSvgIcon(<><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>);
const Upload = createSvgIcon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>);
const AlertTriangle = createSvgIcon(<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>);
const QrCode = createSvgIcon(<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>);
const Compass = createSvgIcon(<><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></>);
const ShieldCheck = createSvgIcon(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></>);
const Mountain = createSvgIcon(<><path d="M8 3l4 8 5-5 5 15H2L8 3z" /></>);
const Tent = createSvgIcon(<><path d="M19 21L12 3 5 21" /><path d="M12 13l3 8H9l3-8z" /></>);
const ShieldAlert = createSvgIcon(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>);
const Package = createSvgIcon(<><line x1="16.5" y1="9.4" x2="7.5" y2="4.21" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>);
const MessageSquare = createSvgIcon('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
const ThumbsUp = createSvgIcon('M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3');
const X = createSvgIcon('M18 6L6 18M6 6l12 12');
const Check = createSvgIcon('M20 6L9 17l-5-5');
const Camera = createSvgIcon(<><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></>);
const Maximize2 = createSvgIcon(<><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></>);
const ExternalLink = createSvgIcon(<><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></>);
const BarChart3 = createSvgIcon(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>);
const Folder = createSvgIcon(<><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></>);
const CalendarIcon = createSvgIcon(<><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>);
const DownloadIcon = createSvgIcon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>);
const UsersIcon = createSvgIcon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>);
const KeyRoundIcon = createSvgIcon(<><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6" /><path d="m15.5 7.5 3 3L22 7l-3-3" /></>);
const TrashIcon = createSvgIcon(<><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></>);
const EyeIcon = createSvgIcon(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>);
const EyeOffIcon = createSvgIcon(<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>);

type SavedCollectionName = 'Muốn đi' | 'Sắp đi' | 'Đã chinh phục' | 'Mục tiêu năm';

const SAVED_COLLECTION_FOLDERS: readonly SavedCollectionName[] = [
  'Muốn đi',
  'Sắp đi',
  'Đã chinh phục',
  'Mục tiêu năm',
] as const;

const getSavedMetaStorageKey = (uid?: string | null): string =>
  uid ? `lost_saved_meta_v1_${uid}` : 'lost_saved_meta_v1_guest';

interface SavedTrailLocalMeta {
  collectionName: SavedCollectionName;
  personalNote: string;
  plannedMonth: number | null;
  pendingSync?: boolean;
}

const normalizeSavedCollection = (raw?: string | null): SavedCollectionName => {
  const cleaned = String(raw || '').trim().toLowerCase();
  if (!cleaned || cleaned === 'muốn đi' || cleaned === 'cuối tuần nhẹ nhàng' || cleaned === 'khác') {
    return 'Muốn đi';
  }
  if (cleaned === 'sắp đi') return 'Sắp đi';
  if (cleaned === 'đã chinh phục') return 'Đã chinh phục';
  if (
    cleaned === 'mục tiêu năm' ||
    cleaned === 'muốn đi năm nay' ||
    cleaned === 'đỉnh >3.000m' ||
    cleaned === 'đỉnh >3000m'
  ) {
    return 'Mục tiêu năm';
  }
  return 'Muốn đi';
};

/** RFC-4180 CSV cell escaping with leading-whitespace-aware spreadsheet formula-injection neutralization. */
const escapeCsvCell = (value: string | number | boolean | null | undefined): string => {
  let str = value === null || value === undefined ? '' : String(value);
  if (/^[\s\u00A0]*[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const formatCsvDateStamp = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
};

type UserWithMongoId = UserProfile & { _id?: string };
type TrailWithMongoId = Trail & { _id?: string };
type ProfileTabId = 'overview' | 'analytics' | 'saved' | 'contributions' | 'forum' | 'gear';

interface ProfileContributionItem {
  _id?: string;
  id?: string;
  name?: string;
  province?: string;
  district?: string;
  region?: string;
  distanceKm?: number;
  elevationGainM?: number;
  coverImage?: string;
  status?: string;
  createdAt?: string;
  authorEmail?: string;
  authorName?: string;
  userId?: string | { _id?: string };
  createdBy?: string | { _id?: string };
}

interface SavedTrailRecord {
  _id?: string;
  trailId?: Partial<TrailWithMongoId> | string;
  savedOffline?: boolean;
  collectionName?: string;
  personalNote?: string;
  plannedMonth?: number | null;
}

interface ProfileActivityItem {
  _id?: string;
  type?: string;
  title?: string;
  content?: string;
  targetType?: string;
  targetId?: string;
  createdAt?: string;
}

interface LeaderboardRow {
  userId: string;
  rank?: number;
  fullName?: string;
  username?: string;
  avatarUrl?: string;
  trailsConquered?: number;
  summitsCount?: number;
  totalDistanceKm?: number;
  highestAltitudeM?: number;
  verifiedCheckins?: number;
  verifiedCount?: number;
}

interface FollowGraphMember {
  _id: string;
  fullName?: string;
  username?: string;
  avatarUrl?: string;
  reputationScore?: number;
  role?: string;
  badges?: string[];
  isFollowingByMe?: boolean;
}

type ForumThreadExtended = Omit<ForumThread, 'userId'> & {
  userId?: string | { _id?: string };
  authorEmail?: string;
  userEmail?: string;
  authorName?: string;
  userReaction?: string | null;
  replies?: number;
};

const readSavedTrailMetaMap = (uid?: string | null): Record<string, SavedTrailLocalMeta> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(getSavedMetaStorageKey(uid));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, SavedTrailLocalMeta> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, Record<string, unknown>>)) {
      if (!v || typeof v !== 'object') continue;
      const monthNum = typeof v.plannedMonth === 'number' && v.plannedMonth >= 1 && v.plannedMonth <= 12
        ? Math.trunc(v.plannedMonth)
        : null;
      out[k] = {
        collectionName: normalizeSavedCollection(typeof v.collectionName === 'string' ? v.collectionName : undefined),
        personalNote: typeof v.personalNote === 'string' ? v.personalNote.slice(0, 500) : '',
        plannedMonth: monthNum,
        pendingSync: Boolean(v.pendingSync),
      };
    }
    return out;
  } catch {
    return {};
  }
};

const persistSavedTrailMetaMap = (
  uid: string | null | undefined,
  map: Record<string, SavedTrailLocalMeta>
) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getSavedMetaStorageKey(uid), JSON.stringify(map));
  } catch {
    // ignore storage quota
  }
};

const formatShortDate = (value?: string): string => {
  if (!value) return 'Mới cập nhật';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('vi-VN');
};

const getCoverStorageKey = (uid?: string | null): string =>
  uid ? `lost_cover_url_${uid}` : 'lost_cover_url_guest';

interface CoverPreset {
  id: string;
  name: string;
  location: string;
  url: string;
}

const DEFAULT_COVER_URL = '/covers/trail-fansipan.svg';

const COVER_PRESETS: CoverPreset[] = [
  {
    id: 'fansipan',
    name: 'Đỉnh Fansipan - Nóc Nhà Đông Dương',
    location: '3,143m • Hoàng Liên Sơn, Lào Cai',
    url: '/covers/trail-fansipan.svg',
  },
  {
    id: 'taxua',
    name: 'Sống Lưng Khủng Long Tà Xùa',
    location: '2,865m • Bắc Yên, Sơn La',
    url: '/covers/trail-taxua.svg',
  },
  {
    id: 'laothan',
    name: 'Đỉnh Lảo Thẩn - Thiên Đường Săn Mây',
    location: '2,860m • Y Tý, Bát Xát, Lào Cai',
    url: '/covers/trail-laothan.svg',
  },
  {
    id: 'kyquansan',
    name: 'Bạch Mộc Lương Tử (Kỳ Quan San)',
    location: '3,046m • Bát Xát & Phong Thổ',
    url: '/covers/trail-kyquansan.svg',
  },
  {
    id: 'bachma',
    name: 'Vườn Quốc Gia Bạch Mã',
    location: '1,450m • Phú Lộc, Thừa Thiên Huế',
    url: '/covers/trail-bachma.svg',
  },
  {
    id: 'tanangphandung',
    name: 'Cung Trek Tà Năng - Phan Dũng',
    location: '55km • Lâm Đồng - Bình Thuận',
    url: '/covers/trail-tanangphandung.svg',
  },
];

interface ProfileProps {
  currentUser?: UserProfile | null;
  onBack: () => void;
  onSelectTrail: (trail: Trail) => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onProfileUpdate?: (user: UserProfile) => void;
  onNavigateToContribute?: () => void;
}

// Gear locker item definition
interface GearItem {
  id: string;
  name: string;
  category: string;
}

const ALL_GEAR_ITEMS: GearItem[] = [
  { id: 'tent', name: 'Lều cắm trại 2-4 người chống nước', category: 'Trú ẩn' },
  { id: 'backpack', name: 'Balo leo núi chuyên dụng 50L', category: 'Chứa đồ' },
  { id: 'boots', name: 'Giày leo núi gót bám địa hình', category: 'Di chuyển' },
  { id: 'flashlight', name: 'Đèn pin đeo đầu siêu sáng 1000lm', category: 'Chiếu sáng' },
  { id: 'firstaid', name: 'Túi y tế & Bộ sơ cứu khẩn cấp SOS', category: 'Y tế & An toàn' },
  { id: 'stove', name: 'Bộ bếp dã ngoại & Bình gas sinh tồn', category: 'Nấu nướng' },
  { id: 'radio', name: 'Bộ đàm sinh tồn & Còi cứu hộ SOS', category: 'Mạng liên lạc' },
  { id: 'rope', name: 'Dây thừng dã ngoại & Móc leo núi', category: 'Bảo hộ' },
];

// Interactive Trekking Style Options
const TREKKING_STYLE_OPTIONS = [
  { id: 'Trekking & Camping', title: 'Trekking & Camping', sub: 'Leo núi & Cắm trại dã ngoại' },
  { id: 'Alpine Ultra Trail', title: 'Alpine Ultra Trail', sub: 'Chạy trail địa hình cao' },
  { id: 'Expedition Survival', title: 'Expedition Survival', sub: 'Sinh tồn mạo hiểm' },
  { id: 'Lightweight Hiking', title: 'Lightweight Hiking', sub: 'Leo núi nhẹ nhàng' },
];

// Comprehensive System Badges Definition with Vibrant Unique Color Themes
interface SystemBadge {
  id: string;
  name: string;
  rarity: 'Phổ Biến' | 'Hiếm' | 'Huyền Thoại';
  unlocked: boolean;
  unlockedAt?: string;
  description: string;
  requirement: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
}

const getDifficultyText = (level?: number): string => {
  if (!level) return 'Đang cập nhật';
  if (level <= 2) return `Dễ (${level}/5)`;
  if (level === 3) return 'Trung Bình (3/5)';
  if (level === 4) return 'Khó (4/5)';
  return 'Rất Khó (5/5)';
};

const SYSTEM_BADGES: SystemBadge[] = [
  {
    id: 'b-1',
    name: 'Trekker Mới',
    rarity: 'Phổ Biến',
    unlocked: false,
    description: 'Huy hiệu ghi nhận thành viên vừa khởi tạo tài khoản trên LOST thành công.',
    requirement: 'Đăng ký tài khoản hệ thống LOST.',
    color: 'var(--color-primary)',
    bg: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
    border: 'color-mix(in srgb, var(--color-primary) 36%, transparent)',
    glow: 'none',
  },
  {
    id: 'b-2',
    name: 'Verified Trekker',
    rarity: 'Hiếm',
    unlocked: false,
    description: 'Huy hiệu xác thực chính chủ dành cho tài khoản đã xác minh Email OTP hoặc Đăng nhập bằng Google.',
    requirement: 'Kích hoạt xác minh OTP Email hoặc Google OAuth thành công.',
    color: 'var(--color-sky)',
    bg: 'color-mix(in srgb, var(--color-sky) 12%, transparent)',
    border: 'color-mix(in srgb, var(--color-sky) 36%, transparent)',
    glow: 'none',
  },
  {
    id: 'b-3',
    name: 'Fansipan Peak Conqueror',
    rarity: 'Huyền Thoại',
    unlocked: false,
    description: 'Vượt qua tuyến đường Trạm Tôn chinh phục Nóc nhà Đông Dương ở độ cao 3,143m.',
    requirement: 'Check-in thành công tại đỉnh Fansipan (Lào Cai).',
    color: 'var(--color-sun)',
    bg: 'color-mix(in srgb, var(--color-sun) 12%, transparent)',
    border: 'color-mix(in srgb, var(--color-sun) 36%, transparent)',
    glow: 'none',
  },
  {
    id: 'b-4',
    name: 'Alpine Master',
    rarity: 'Hiếm',
    unlocked: false,
    description: 'Đạt cấp độ sinh tồn cao cấp nhờ tích lũy hơn 50 điểm uy tín và hoàn thành nhiều cung đường trek khó.',
    requirement: 'Đạt từ 50 điểm uy tín (Reputation Score) trở lên.',
    color: 'var(--color-sky)',
    bg: 'color-mix(in srgb, var(--color-sky) 12%, transparent)',
    border: 'color-mix(in srgb, var(--color-sky) 36%, transparent)',
    glow: 'none',
  },
  {
    id: 'b-5',
    name: 'Emergency Rescue Hero',
    rarity: 'Huyền Thoại',
    unlocked: false,
    description: 'Vinh danh nhà thám hiểm có những đóng góp cảnh báo sự cố sạt lở hoặc hỗ trợ SOS cho cộng đồng.',
    requirement: 'Gửi từ 3 bài cảnh báo sự cố an toàn trên Diễn đàn được cộng đồng xác minh.',
    color: 'var(--color-error-text, var(--color-error))',
    bg: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
    border: 'color-mix(in srgb, var(--color-error) 34%, transparent)',
    glow: 'none',
  },
  {
    id: 'b-6',
    name: 'Ultra Trail Pioneer',
    rarity: 'Huyền Thoại',
    unlocked: false,
    description: 'Dành riêng cho những nhà thám hiểm bền bỉ chinh phục tổng quãng đường leo núi trên 100 km.',
    requirement: 'Hoàn thành tổng quãng đường trek tích lũy vượt mốc 100 km.',
    color: 'var(--color-stream)',
    bg: 'color-mix(in srgb, var(--color-stream) 12%, transparent)',
    border: 'color-mix(in srgb, var(--color-stream) 36%, transparent)',
    glow: 'none',
  },
];

// Color Theme Palettes for Conquered Trail Cards
const TRAIL_CARD_THEMES = [
  { color: 'var(--color-sun)', border: 'color-mix(in srgb, var(--color-sun) 34%, transparent)', bg: 'var(--color-bg-main)' },
  { color: 'var(--color-sky)', border: 'color-mix(in srgb, var(--color-sky) 34%, transparent)', bg: 'var(--color-bg-main)' },
  { color: 'var(--color-primary)', border: 'color-mix(in srgb, var(--color-primary) 34%, transparent)', bg: 'var(--color-bg-main)' },
  { color: 'var(--color-stream)', border: 'color-mix(in srgb, var(--color-stream) 34%, transparent)', bg: 'var(--color-bg-main)' },
];



export const UserProfileView: React.FC<ProfileProps> = ({ currentUser, onBack, onSelectTrail, onShowToast, onProfileUpdate, onNavigateToContribute }) => {
  const currentUserId = String(currentUser?.id || (currentUser as UserWithMongoId | null)?._id || '');
  const currentUserEmail = String(currentUser?.email || '');
  const currentUserRef = useRef<UserProfile | null>(currentUser || null);
  useEffect(() => {
    currentUserRef.current = currentUser || null;
  }, [currentUser]);

  const [profile, setProfile] = useState<UserProfile | null>(currentUser || null);
  const [profileStats, setProfileStats] = useState<{
    totalDistanceKm: number;
    highestAltitudeM: number;
    summitTrailName: string;
    checkinsCount: number;
    contributionsCount: number;
    threadsCount: number;
    reviewsCount: number;
    tripReportsCount: number;
    followersCount: number;
    followingCount: number;
  }>({
    totalDistanceKm: 0,
    highestAltitudeM: 0,
    summitTrailName: '',
    checkinsCount: 0,
    contributionsCount: 0,
    threadsCount: 0,
    reviewsCount: 0,
    tripReportsCount: 0,
    followersCount: 0,
    followingCount: 0,
  });

  // Followers & Following Modal state
  const [followModalTab, setFollowModalTab] = useState<'followers' | 'following' | null>(null);
  const [followModalList, setFollowModalList] = useState<FollowGraphMember[]>([]);
  const [followModalLoading, setFollowModalLoading] = useState(false);
  const [togglingFollowIds, setTogglingFollowIds] = useState<Set<string>>(() => new Set());

  // Security Modals state (Change Password & Delete Account)
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [cpCurrentPassword, setCpCurrentPassword] = useState('');
  const [cpNewPassword, setCpNewPassword] = useState('');
  const [cpConfirmPassword, setCpConfirmPassword] = useState('');
  const [cpShowCurrent, setCpShowCurrent] = useState(false);
  const [cpShowNew, setCpShowNew] = useState(false);
  const [cpError, setCpError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [delConfirmText, setDelConfirmText] = useState('');
  const [delPassword, setDelPassword] = useState('');
  const [delShowPassword, setDelShowPassword] = useState(false);
  const [delError, setDelError] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [checkedTrails, setCheckedTrails] = useState<Trail[]>([]);
  const [rawCheckins, setRawCheckins] = useState<RawCheckinInput[]>([]);
  const [verifiedCheckinIds, setVerifiedCheckinIds] = useState<string[]>([]);
  const [savedTrails, setSavedTrails] = useState<SavedTrailRecord[]>([]);
  const [savedCollectionFilter, setSavedCollectionFilter] = useState<'all' | SavedCollectionName>('all');
  const [savedMetaMap, setSavedMetaMap] = useState<Record<string, SavedTrailLocalMeta>>(() =>
    readSavedTrailMetaMap(currentUserId)
  );
  const [editingSavedId, setEditingSavedId] = useState<string | null>(null);
  const [savedNoteDraft, setSavedNoteDraft] = useState('');
  const [savingSavedMetaIds, setSavingSavedMetaIds] = useState<Set<string>>(() => new Set());
  const [confirmRemoveSavedId, setConfirmRemoveSavedId] = useState<string | null>(null);
  const [removingSavedIds, setRemovingSavedIds] = useState<Set<string>>(() => new Set());
  const [activities, setActivities] = useState<ProfileActivityItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [allAvailableTrails, setAllAvailableTrails] = useState<Trail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLightTheme, setIsLightTheme] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light'
  );

  // Check-in GPS & Duration controls
  const [checkinHours, setCheckinHours] = useState('8');
  const [checkinCoords, setCheckinCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isCapturingCheckinGps, setIsCapturingCheckinGps] = useState(false);
  const [isSubmittingCheckin, setIsSubmittingCheckin] = useState(false);

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals & Navigation
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'saved' | 'contributions' | 'forum' | 'gear'>('overview');
  const { trackRef: profileTabTrackRef, indicatorStyle: profileTabIndicatorStyle } =
    useSlidingIndicator<string>(activeTab);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showGearModal, setShowGearModal] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<SystemBadge | null>(null);
  const [selectedTrailPassport, setSelectedTrailPassport] = useState<Trail | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  // Cover Photo Customization (scoped per user ID so covers never leak across accounts)
  const [customCoverUrl, setCustomCoverUrl] = useState<string>(() => {
    const storedForUser = currentUserId ? localStorage.getItem(getCoverStorageKey(currentUserId)) : null;
    return currentUser?.coverUrl || storedForUser || DEFAULT_COVER_URL;
  });
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [isSavingCover, setIsSavingCover] = useState(false);
  const [previewCover, setPreviewCover] = useState<string>(customCoverUrl);
  const [customCoverInput, setCustomCoverInput] = useState<string>('');
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const savedTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const csvBlobCleanupRef = useRef<Map<number, string>>(new Map());
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    const cleanupMap = csvBlobCleanupRef.current;
    return () => {
      isMountedRef.current = false;
      cleanupMap.forEach((url, timerId) => {
        window.clearTimeout(timerId);
        URL.revokeObjectURL(url);
      });
      cleanupMap.clear();
    };
  }, []);

  // Lightbox Full Photo View State
  const [fullViewImage, setFullViewImage] = useState<{
    url: string;
    title: string;
    subtitle?: string;
    type: 'cover' | 'avatar';
  } | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const sync = () =>
      setIsLightTheme(document.documentElement.getAttribute('data-theme') === 'light');
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const coverSyncKey = `${currentUserId}|${currentUser?.coverUrl || ''}`;
  const [prevCoverSyncKey, setPrevCoverSyncKey] = useState(coverSyncKey);
  if (prevCoverSyncKey !== coverSyncKey) {
    setPrevCoverSyncKey(coverSyncKey);
    const nextCover =
      currentUser?.coverUrl ||
      (currentUserId ? localStorage.getItem(getCoverStorageKey(currentUserId)) : null) ||
      DEFAULT_COVER_URL;
    setCustomCoverUrl(nextCover);
    setPreviewCover(nextCover);
  }

  const userSyncKey = `${currentUserId}|${currentUserEmail}`;
  const [prevUserSyncKey, setPrevUserSyncKey] = useState(userSyncKey);
  if (prevUserSyncKey !== userSyncKey) {
    setPrevUserSyncKey(userSyncKey);
    setProfile(currentUser || null);
    setSavedTrails([]);
    setSavedMetaMap(readSavedTrailMetaMap(currentUserId));
    setSavedCollectionFilter('all');
    setEditingSavedId(null);
    setSavedNoteDraft('');
    setConfirmRemoveSavedId(null);
    setSavingSavedMetaIds(new Set());
    setRemovingSavedIds(new Set());
  }

  // Gear Locker State (Feature 2)
  const [userGear, setUserGear] = useState<string[]>(['tent', 'backpack', 'boots', 'flashlight', 'firstaid']);

  // User Live Forum Posts State (Feature 3)
  const [userForumPosts, setUserForumPosts] = useState<ForumThread[]>([]);
  const [selectedThreadForModal, setSelectedThreadForModal] = useState<ForumThread | null>(null);
  const [selectedAuthorForModal, setSelectedAuthorForModal] = useState<{ name: string; avatar: string; userId?: string } | null>(null);

  // User Submitted Trail Contributions State (strictly server-backed — no global lost_contributions dump)
  const [userContributions, setUserContributions] = useState<ProfileContributionItem[]>([]);
  const [deletingContribution, setDeletingContribution] = useState<{ id: string; name: string } | null>(null);

  const handleDeleteContribution = (id: string, name: string) => {
    setDeletingContribution({ id, name });
  };

  const confirmDeleteContribution = async () => {
    if (!deletingContribution) return;
    const targetId = deletingContribution.id;
    const targetName = deletingContribution.name;
    const token = localStorage.getItem('lost_token');

    // 1. Delete from Server DB if token exists and verify response
    try {
      if (token) {
        const res = await fetch(`/api/contributions/${targetId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok && res.status !== 404) {
          const errData = await res.json().catch(() => ({}));
          onShowToast?.(errData.message || 'Không thể xóa bài đóng góp trên máy chủ.', 'error');
          setDeletingContribution(null);
          return;
        }
      }
    } catch (err) {
      console.warn('Delete contribution API error:', err);
      onShowToast?.('Lỗi kết nối máy chủ khi xóa bài đóng góp.', 'error');
      setDeletingContribution(null);
      return;
    }

    setUserContributions((prev) => prev.filter((item) => item.id !== targetId && item._id !== targetId));
    setDeletingContribution(null);
    if (onShowToast) {
      onShowToast(`Đã xóa bài đóng góp "${targetName}" thành công!`, 'info');
    }
  };

  const handleEditContribution = (contrib: ProfileContributionItem) => {
    localStorage.setItem('lost_editing_contribution', JSON.stringify(contrib));
    if (onNavigateToContribute) {
      onNavigateToContribute();
    }
  };

  // Edit Profile Modal state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editUsernameSuggestions, setEditUsernameSuggestions] = useState<string[]>([]);
  const [editPhone, setEditPhone] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editEmergency, setEditEmergency] = useState('');
  const [editStyle, setEditStyle] = useState('Trekking & Camping');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');

  // Field-specific Inline Error State
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    fullName?: string;
    phone?: string;
    emergencyContact?: string;
    bio?: string;
    avatarUrl?: string;
    general?: string;
  }>({});

  const populateForm = useCallback((u: UserProfile) => {
    setEditFullName(u.fullName || u.name || '');
    setEditUsername(u.username || '');
    setEditUsernameSuggestions([]);
    setEditPhone(u.phone || '');
    setEditBio(u.bio || '');
    setEditEmergency(u.emergencyContact || '');
    setEditStyle(u.preferredStyle || 'Trekking & Camping');
    setEditAvatarUrl(u.avatarUrl || u.avatar || '');
    setFieldErrors({});
  }, []);

  const loadProfileData = useCallback(async () => {
    setIsLoading(true);
    const token = localStorage.getItem('lost_token');
    let loadedUser: UserProfile | null = currentUserRef.current || null;

    try {
      if (token) {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.user) {
          loadedUser = data.user;
          setProfile(data.user);
          populateForm(data.user);
          if (data.user.coverUrl) {
            setCustomCoverUrl(data.user.coverUrl);
            setPreviewCover(data.user.coverUrl);
            try {
              const uid = String(data.user._id || data.user.id || '');
              localStorage.setItem(getCoverStorageKey(uid), data.user.coverUrl);
            } catch {
              // ignore quota error
            }
          }
          if (data.user.gearLocker && Array.isArray(data.user.gearLocker)) {
            setUserGear(data.user.gearLocker);
          }

          // Fetch live contributions from Server API and merge with localStorage
          let serverContribs: ProfileContributionItem[] = [];
          try {
            const cRes = await fetch('/api/contributions', {
              headers: { Authorization: `Bearer ${token}` },
            });
            const cData = await cRes.json();
            if (cData.success && Array.isArray(cData.data)) {
              serverContribs = cData.data as ProfileContributionItem[];
            }
          } catch (cErr) {
            console.warn('[Profile Contrib API Fetch]:', cErr);
          }

          const contribMap = new Map<string, ProfileContributionItem>();
          serverContribs.forEach((c) => {
            const key = c.id || c._id;
            if (key) contribMap.set(String(key), c);
          });
          const allContribs = Array.from(contribMap.values());

          const userEmail = (data.user.email || '').toLowerCase().trim();
          const userId = String(data.user._id || data.user.id || '').trim();
          const userName = (data.user.fullName || data.user.username || data.user.name || '').toLowerCase().trim();

          const filtered = allContribs.filter((c) => {
            const cEmail = (c.authorEmail || '').toLowerCase().trim();
            const cUserId = String(
              typeof c.userId === 'object'
                ? c.userId?._id || ''
                : c.userId || (typeof c.createdBy === 'object' ? c.createdBy?._id || '' : c.createdBy || '')
            ).trim();
            const cName = (c.authorName || '').toLowerCase().trim();

            const emailMatch = Boolean(userEmail && cEmail && cEmail === userEmail);
            const idMatch = Boolean(userId && cUserId && cUserId === userId);
            const nameMatch = Boolean(userName && cName && cName === userName);

            return emailMatch || idMatch || nameMatch;
          });
          setUserContributions(filtered);
        }
      }
    } catch (err) {
      console.error('[Profile Fetch Error]:', err);
    } finally {
      setIsLoading(false);
    }

    const activeUserId = String((loadedUser as UserWithMongoId | null)?._id || loadedUser?.id || loadedUser?.username || '').trim();
    if (activeUserId) {
      try {
        const statsRes = await fetch(`/api/users/profile/${encodeURIComponent(activeUserId)}`, {
          headers: getApiHeaders(),
        });
        const statsData = await statsRes.json();
        if (statsData.success && statsData.data?.stats) {
          setProfileStats({
            totalDistanceKm: Number(statsData.data.stats.totalDistanceKm) || 0,
            highestAltitudeM: Number(statsData.data.stats.highestAltitudeM) || 0,
            summitTrailName: statsData.data.stats.summitTrailName || '',
            checkinsCount: Number(statsData.data.stats.checkinsCount) || 0,
            contributionsCount: Number(statsData.data.stats.contributionsCount) || 0,
            threadsCount: Number(statsData.data.stats.threadsCount) || 0,
            reviewsCount: Number(statsData.data.stats.reviewsCount) || 0,
            tripReportsCount: Number(statsData.data.stats.tripReportsCount) || 0,
            followersCount: Number(statsData.data.stats.followersCount) || 0,
            followingCount: Number(statsData.data.stats.followingCount) || 0,
          });
        }
      } catch (err) {
        console.warn('[Profile Stats Fetch Error]:', err);
      }
    }

    try {
      const [allTrails, checkinsRes, savedRes, activitiesRes, leaderboardRes] = await Promise.all([
        fetchTrails(),
        token ? fetch('/api/checkins/me', { headers: { Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null),
        token ? fetch('/api/saved-trails', { headers: { Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null),
        token ? fetch('/api/activities/me?limit=15', { headers: { Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null),
        fetch('/api/checkins/leaderboard?limit=10').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      setAllAvailableTrails(allTrails);

      if (savedRes?.success && Array.isArray(savedRes.data)) {
        const refUserId = String(
          currentUserRef.current?.id || (currentUserRef.current as UserWithMongoId | null)?._id || ''
        );
        const metaUid = activeUserId || refUserId || 'guest';
        const localMap = readSavedTrailMetaMap(metaUid);
        let mapChanged = false;
        const pendingReplayList: Array<{ tid: string; entry: SavedTrailLocalMeta }> = [];

        const hydratedSaved = (savedRes.data as SavedTrailRecord[]).map((item) => {
          const trailObj = item.trailId && typeof item.trailId === 'object' ? item.trailId : null;
          const tid = String(trailObj?.id || trailObj?._id || (typeof item.trailId === 'string' ? item.trailId : '') || '');
          const localEntry = tid ? localMap[tid] : undefined;
          const serverCol = normalizeSavedCollection(item.collectionName);
          const serverNote = typeof item.personalNote === 'string' ? item.personalNote : '';
          const serverMonth =
            typeof item.plannedMonth === 'number' && item.plannedMonth >= 1 && item.plannedMonth <= 12
              ? Math.trunc(item.plannedMonth)
              : null;

          if (tid && localEntry?.pendingSync) {
            pendingReplayList.push({ tid, entry: localEntry });
            return {
              ...item,
              collectionName: localEntry.collectionName,
              personalNote: localEntry.personalNote,
              plannedMonth: localEntry.plannedMonth,
            };
          }
          if (tid) {
            localMap[tid] = {
              collectionName: serverCol,
              personalNote: serverNote,
              plannedMonth: serverMonth,
              pendingSync: false,
            };
            mapChanged = true;
          }
          return {
            ...item,
            collectionName: serverCol,
            personalNote: serverNote,
            plannedMonth: serverMonth,
          };
        });
        if (mapChanged) {
          persistSavedTrailMetaMap(metaUid, localMap);
          setSavedMetaMap(localMap);
        }
        setSavedTrails(hydratedSaved);

        // Replay any offline pendingSync entries cleanly once authenticated & online
        if (token && pendingReplayList.length > 0 && (typeof navigator === 'undefined' || navigator.onLine)) {
          void Promise.allSettled(
            pendingReplayList.map(async ({ tid, entry }) => {
              const synced = await updateSavedTrailMeta(tid, {
                collectionName: entry.collectionName,
                personalNote: entry.personalNote,
                plannedMonth: entry.plannedMonth,
              });
              return { tid, synced };
            })
          ).then((results) => {
            if (!isMountedRef.current) return;
            const freshMap = readSavedTrailMetaMap(metaUid);
            let replayedAny = false;
            const updatesByTid = new Map<string, SavedTrailLocalMeta>();
            results.forEach((r) => {
              if (r.status !== 'fulfilled') return;
              const { tid, synced } = r.value;
              const syncedMeta: SavedTrailLocalMeta = {
                collectionName: normalizeSavedCollection(synced.collectionName),
                personalNote: typeof synced.personalNote === 'string' ? synced.personalNote : '',
                plannedMonth:
                  typeof synced.plannedMonth === 'number' &&
                    synced.plannedMonth >= 1 &&
                    synced.plannedMonth <= 12
                    ? Math.trunc(synced.plannedMonth)
                    : null,
                pendingSync: false,
              };
              freshMap[tid] = syncedMeta;
              updatesByTid.set(tid, syncedMeta);
              replayedAny = true;
            });
            if (replayedAny) {
              persistSavedTrailMetaMap(metaUid, freshMap);
              setSavedMetaMap(freshMap);
              setSavedTrails((prev) =>
                prev.map((item) => {
                  const tObj = item.trailId && typeof item.trailId === 'object' ? item.trailId : null;
                  const tid = String(tObj?.id || tObj?._id || (typeof item.trailId === 'string' ? item.trailId : '') || '');
                  const synced = updatesByTid.get(tid);
                  if (!synced) return item;
                  return {
                    ...item,
                    collectionName: synced.collectionName,
                    personalNote: synced.personalNote,
                    plannedMonth: synced.plannedMonth,
                  };
                })
              );
            }
          });
        }
      }
      if (activitiesRes?.success && Array.isArray(activitiesRes.data)) {
        setActivities(activitiesRes.data as ProfileActivityItem[]);
      }
      if (leaderboardRes?.success && Array.isArray(leaderboardRes.data)) {
        setLeaderboard(leaderboardRes.data as LeaderboardRow[]);
      }

      // Populate ONLY genuinely checked-in trails for this user (merging server CheckinModel + user profile + local cache)
      const checkedIds = new Set<string>(
        Array.isArray(loadedUser?.checkedInTrails) ? loadedUser!.checkedInTrails.map(String) : []
      );
      const verifiedIds: string[] = [];
      if (checkinsRes?.success && Array.isArray(checkinsRes.data)) {
        const checkinItems = checkinsRes.data as RawCheckinInput[];
        setRawCheckins(checkinItems);
        checkinItems.forEach((c) => {
          const tObj = c.trailId && typeof c.trailId === 'object' ? c.trailId : null;
          const tid = tObj?.id || tObj?._id || (typeof c.trailId === 'string' ? c.trailId : '');
          if (tid) {
            checkedIds.add(String(tid));
            if (c.verifiedBadge) {
              verifiedIds.push(String(tid));
              if (tObj?.id) verifiedIds.push(String(tObj.id));
            }
          }
        });
      } else {
        setRawCheckins([]);
      }
      setVerifiedCheckinIds(verifiedIds);

      try {
        const savedCheckins = JSON.parse(localStorage.getItem(`lost_checkins_${activeUserId || 'guest'}`) || '[]');
        if (Array.isArray(savedCheckins)) {
          savedCheckins.forEach((id: string) => checkedIds.add(String(id)));
        }
      } catch {
        // ignore invalid local cache
      }
      setCheckedTrails(
        allTrails.filter((t) => {
          const mongoId = (t as TrailWithMongoId)._id;
          return checkedIds.has(String(t.id)) || (mongoId && checkedIds.has(String(mongoId)));
        })
      );
    } catch (err) {
      console.error('[Trails Fetch Error]:', err);
    }

    try {
      const forumRes = await fetch('/api/forum', {
        headers: getApiHeaders(),
      });
      const forumData = await forumRes.json();
      if (forumData.success && Array.isArray(forumData.data)) {
        setUserForumPosts(forumData.data);
      }
    } catch (err) {
      console.error('[Forum Posts Fetch Error]:', err);
    }
  }, [populateForm]);

  useEffect(() => {
    const handleGlobalUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.threadId) {
        setUserForumPosts((prevPosts) =>
          prevPosts.map((t) => {
            if (t.id === detail.threadId) {
              return {
                ...t,
                userReaction: detail.userReaction !== undefined ? detail.userReaction : (t as ForumThreadExtended).userReaction,
                reactions: detail.reactionsSummary || t.reactions,
                upvotes: detail.upvotes !== undefined ? detail.upvotes : t.upvotes,
              };
            }
            return t;
          })
        );
      }
    };
    window.addEventListener('lost:forum-updated', handleGlobalUpdate);
    return () => window.removeEventListener('lost:forum-updated', handleGlobalUpdate);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadProfileData();
    });
    return () => {
      active = false;
    };
  }, [currentUserId, currentUserEmail, loadProfileData]);

  // LIFO Focus Trap refs for all inline profile portal modals
  const qrModalRef = useRef<HTMLDivElement | null>(null);
  const badgeModalRef = useRef<HTMLDivElement | null>(null);
  const passportModalRef = useRef<HTMLDivElement | null>(null);
  const deleteContribModalRef = useRef<HTMLDivElement | null>(null);
  const checkInModalRef = useRef<HTMLDivElement | null>(null);
  const editProfileModalRef = useRef<HTMLDivElement | null>(null);
  const gearModalRef = useRef<HTMLDivElement | null>(null);
  const coverModalRef = useRef<HTMLDivElement | null>(null);
  const lightboxModalRef = useRef<HTMLDivElement | null>(null);
  const followModalRef = useRef<HTMLDivElement | null>(null);
  const changePasswordModalRef = useRef<HTMLDivElement | null>(null);
  const deleteAccountModalRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(showQrModal, qrModalRef);
  useFocusTrap(Boolean(selectedBadge), badgeModalRef);
  useFocusTrap(Boolean(selectedTrailPassport), passportModalRef);
  useFocusTrap(Boolean(deletingContribution), deleteContribModalRef);
  useFocusTrap(showCheckInModal, checkInModalRef);
  useFocusTrap(isEditing, editProfileModalRef);
  useFocusTrap(showGearModal, gearModalRef);
  useFocusTrap(showCoverModal, coverModalRef);
  useFocusTrap(Boolean(fullViewImage), lightboxModalRef);
  useFocusTrap(Boolean(followModalTab), followModalRef);
  useFocusTrap(showChangePasswordModal, changePasswordModalRef);
  useFocusTrap(showDeleteAccountModal, deleteAccountModalRef);

  // Unified Escape key handler for ALL profile modals (LIFO focus-trap + IME safe)
  useEffect(() => {
    const hasOpenModal = Boolean(
      fullViewImage ||
      showDeleteAccountModal ||
      showChangePasswordModal ||
      followModalTab ||
      deletingContribution ||
      showCoverModal ||
      showCheckInModal ||
      isEditing ||
      showGearModal ||
      selectedTrailPassport ||
      selectedBadge ||
      showQrModal
    );
    if (!hasOpenModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing) return;
      if (fullViewImage && isTopmostFocusTrap(lightboxModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setFullViewImage(null);
      } else if (showDeleteAccountModal && isTopmostFocusTrap(deleteAccountModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!isDeletingAccount) setShowDeleteAccountModal(false);
      } else if (showChangePasswordModal && isTopmostFocusTrap(changePasswordModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!isChangingPassword) setShowChangePasswordModal(false);
      } else if (followModalTab && isTopmostFocusTrap(followModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setFollowModalTab(null);
      } else if (deletingContribution && isTopmostFocusTrap(deleteContribModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setDeletingContribution(null);
      } else if (showCoverModal && isTopmostFocusTrap(coverModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!isSavingCover) setShowCoverModal(false);
      } else if (showCheckInModal && isTopmostFocusTrap(checkInModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!isSubmittingCheckin) setShowCheckInModal(false);
      } else if (isEditing && isTopmostFocusTrap(editProfileModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!isSaving) setIsEditing(false);
      } else if (showGearModal && isTopmostFocusTrap(gearModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setShowGearModal(false);
      } else if (selectedTrailPassport && isTopmostFocusTrap(passportModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setSelectedTrailPassport(null);
      } else if (selectedBadge && isTopmostFocusTrap(badgeModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setSelectedBadge(null);
      } else if (showQrModal && isTopmostFocusTrap(qrModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setShowQrModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    fullViewImage,
    showDeleteAccountModal,
    isDeletingAccount,
    showChangePasswordModal,
    isChangingPassword,
    followModalTab,
    deletingContribution,
    showCoverModal,
    isSavingCover,
    showCheckInModal,
    isSubmittingCheckin,
    isEditing,
    isSaving,
    showGearModal,
    selectedTrailPassport,
    selectedBadge,
    showQrModal,
  ]);

  const loadFollowGraphList = useCallback(async (tab: 'followers' | 'following') => {
    const targetUid = String(
      (profile as UserWithMongoId | null)?._id ||
        profile?.id ||
        currentUserId ||
        ''
    ).trim();
    if (!targetUid) {
      setFollowModalList([]);
      return;
    }
    setFollowModalLoading(true);
    try {
      const res = await fetch(
        `/api/users/${encodeURIComponent(targetUid)}/${tab}?limit=50`,
        { headers: getApiHeaders() }
      );
      const data = await res.json().catch(() => null);
      if (!isMountedRef.current) return;
      if (res.ok && data?.success && Array.isArray(data.data)) {
        setFollowModalList(data.data as FollowGraphMember[]);
        const total = Number(data.pagination?.total);
        if (Number.isFinite(total)) {
          setProfileStats((prev) => ({
            ...prev,
            ...(tab === 'followers' ? { followersCount: total } : { followingCount: total }),
          }));
        }
      } else {
        setFollowModalList([]);
      }
    } catch {
      if (isMountedRef.current) setFollowModalList([]);
    } finally {
      if (isMountedRef.current) setFollowModalLoading(false);
    }
  }, [profile, currentUserId]);

  const openFollowModal = (tab: 'followers' | 'following') => {
    setFollowModalTab(tab);
    void loadFollowGraphList(tab);
  };

  const handleToggleFollowMember = async (member: FollowGraphMember) => {
    const token = localStorage.getItem('lost_token');
    if (!token) {
      onShowToast?.('Vui lòng đăng nhập để theo dõi thành viên.', 'info');
      return;
    }
    if (togglingFollowIds.has(member._id)) return;
    setTogglingFollowIds((prev) => new Set(prev).add(member._id));
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(member._id)}/follow`, {
        method: 'POST',
        headers: getApiHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!isMountedRef.current) return;
      if (res.ok && data.success) {
        const nextFollow = Boolean(data.isFollowing);
        setFollowModalList((prev) =>
          prev.map((m) => (m._id === member._id ? { ...m, isFollowingByMe: nextFollow } : m))
        );
        setProfileStats((prev) => ({
          ...prev,
          followingCount: Math.max(0, prev.followingCount + (nextFollow ? 1 : -1)),
        }));
        onShowToast?.(
          data.message || (nextFollow ? 'Đã theo dõi thành viên!' : 'Đã bỏ theo dõi thành viên.'),
          'info'
        );
      } else {
        onShowToast?.(data.message || 'Không thể cập nhật trạng thái theo dõi.', 'error');
      }
    } catch {
      if (isMountedRef.current) {
        onShowToast?.('Lỗi kết nối khi cập nhật trạng thái theo dõi.', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setTogglingFollowIds((prev) => {
          const next = new Set(prev);
          next.delete(member._id);
          return next;
        });
      }
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpError('');

    if (!cpCurrentPassword) {
      setCpError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (
      cpNewPassword.length < 8 ||
      !/[a-z]/.test(cpNewPassword) ||
      !/[A-Z]/.test(cpNewPassword) ||
      !/[0-9]/.test(cpNewPassword)
    ) {
      setCpError('Mật khẩu mới cần tối thiểu 8 ký tự, bao gồm chữ hoa (A-Z), chữ thường (a-z) và chữ số (0-9).');
      return;
    }
    if (cpNewPassword !== cpConfirmPassword) {
      setCpError('Mật khẩu mới xác nhận không trùng khớp.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          currentPassword: cpCurrentPassword,
          newPassword: cpNewPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!isMountedRef.current) return;
      if (!res.ok || !data.success) {
        setCpError(data.message || 'Không thể đổi mật khẩu lúc này.');
        return;
      }

      if (data.token) {
        localStorage.setItem('lost_token', data.token);
      }
      if (data.user) {
        setProfile(data.user);
        onProfileUpdate?.(data.user);
      }
      window.dispatchEvent(
        new CustomEvent('lost:auth-changed', {
          detail: { authenticated: true, ...(data.user ? { user: data.user } : {}) },
        })
      );
      setShowChangePasswordModal(false);
      setCpCurrentPassword('');
      setCpNewPassword('');
      setCpConfirmPassword('');
      setCpError('');
      onShowToast?.(data.message || 'Đổi mật khẩu thành công!', 'success');
    } catch {
      if (isMountedRef.current) {
        setCpError('Không thể kết nối máy chủ để đổi mật khẩu.');
      }
    } finally {
      if (isMountedRef.current) setIsChangingPassword(false);
    }
  };

  const handleDeleteAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDelError('');
    const isGoogleAcct = (profile || currentUser)?.authProvider === 'google';

    if (delConfirmText.trim().normalize('NFC') !== 'XÓA TÀI KHOẢN') {
      setDelError('Vui lòng nhập chính xác cụm từ "XÓA TÀI KHOẢN" (in hoa có dấu).');
      return;
    }
    if (!isGoogleAcct && !delPassword) {
      setDelError('Vui lòng nhập mật khẩu hiện tại để xác nhận xóa tài khoản.');
      return;
    }

    setIsDeletingAccount(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'DELETE',
        credentials: 'include',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          confirmText: delConfirmText.trim(),
          ...(!isGoogleAcct ? { currentPassword: delPassword } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!isMountedRef.current) return;
      if (!res.ok || !data.success) {
        setDelError(data.message || 'Không thể xóa tài khoản lúc này.');
        return;
      }

      try {
        localStorage.removeItem('lost_token');
      } catch {
        // ignore storage restrictions
      }
      clearSensitiveSessionStorage();
      window.dispatchEvent(new CustomEvent('lost:auth-changed', { detail: { authenticated: false } }));
      setShowDeleteAccountModal(false);
      onShowToast?.(data.message || 'Tài khoản của bạn đã được xóa vĩnh viễn.', 'info');
      onBack();
      window.setTimeout(() => {
        window.location.href = '/';
      }, 250);
    } catch {
      if (isMountedRef.current) {
        setDelError('Không thể kết nối máy chủ để xóa tài khoản.');
      }
    } finally {
      if (isMountedRef.current) setIsDeletingAccount(false);
    }
  };

  const handleToggleGear = async (gearId: string) => {
    const previousGear = userGear;
    const nextGear = userGear.includes(gearId)
      ? userGear.filter((g) => g !== gearId)
      : [...userGear, gearId];

    setUserGear(nextGear);
    const token = localStorage.getItem('lost_token');

    if (!token) {
      onShowToast?.('Đã cập nhật tủ đồ thiết bị sinh tồn (cục bộ)!', 'info');
      return;
    }

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ gearLocker: nextGear }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setUserGear(previousGear);
        onShowToast?.(data.message || 'Không thể lưu tủ đồ thiết bị lên máy chủ.', 'error');
        return;
      }
      if (data.user) {
        setProfile(data.user);
        onProfileUpdate?.(data.user);
      }
      onShowToast?.('Đã cập nhật tủ đồ thiết bị sinh tồn!', 'success');
    } catch (err) {
      console.error('[Gear Save Error]:', err);
      setUserGear(previousGear);
      onShowToast?.('Lỗi kết nối khi lưu tủ đồ thiết bị. Đã khôi phục trạng thái trước đó.', 'error');
    }
  };

  const handleCaptureCheckinGps = () => {
    if (!navigator.geolocation) {
      onShowToast?.('Trình duyệt không hỗ trợ định vị GPS.', 'error');
      return;
    }
    setIsCapturingCheckinGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!isMountedRef.current) return;
        setCheckinCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsCapturingCheckinGps(false);
        onShowToast?.('Đã đính kèm tọa độ GPS hiện tại để xác thực đỉnh!', 'success');
      },
      () => {
        if (!isMountedRef.current) return;
        setIsCapturingCheckinGps(false);
        onShowToast?.('Không lấy được tín hiệu GPS. Bạn vẫn có thể check-in thủ công.', 'info');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleAddCheckInTrail = async (trail: Trail) => {
    if (isSubmittingCheckin) return;
    if (checkedTrails.some((t) => t.id === trail.id)) {
      setShowCheckInModal(false);
      return;
    }

    const token = localStorage.getItem('lost_token');
    const hours = Math.max(0.5, Math.min(240, Number(checkinHours) || 8));

    if (token) {
      setIsSubmittingCheckin(true);
      try {
        const res = await fetch('/api/checkins', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            trailId: trail.id,
            completionTimeHours: hours,
            isPublic: true,
            ...(checkinCoords ? { lat: checkinCoords.lat, lng: checkinCoords.lng } : {}),
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          const nextChecked = [trail, ...checkedTrails];
          setCheckedTrails(nextChecked);
          if (data.data?.verifiedBadge) {
            setVerifiedCheckinIds((prev) => Array.from(new Set([...prev, trail.id])));
          }
          const badgeNote =
            Array.isArray(data.unlockedBadges) && data.unlockedBadges.length > 0
              ? ` Mở khóa huy hiệu: ${data.unlockedBadges.join(', ')}!`
              : '';
          onShowToast?.(`${data.message || `Check-in ${trail.name} thành công!`}${badgeNote}`, 'success');
          setShowCheckInModal(false);
          setCheckinCoords(null);
          // Refresh rawCheckins, leaderboard & activities silently
          fetch('/api/checkins/me', { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => {
              if (isMountedRef.current && j?.success && Array.isArray(j.data)) {
                setRawCheckins(j.data as RawCheckinInput[]);
              }
            })
            .catch(() => {});
          fetch('/api/checkins/leaderboard?limit=10')
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => isMountedRef.current && j?.success && Array.isArray(j.data) && setLeaderboard(j.data))
            .catch(() => {});
          fetch('/api/activities/me?limit=15', { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => isMountedRef.current && j?.success && Array.isArray(j.data) && setActivities(j.data))
            .catch(() => {});
          return;
        }
        onShowToast?.(data.message || 'Không thể ghi nhận check-in lên máy chủ.', 'error');
        return;
      } catch {
        // Offline fallback below
      } finally {
        setIsSubmittingCheckin(false);
      }
    }

    const nextChecked = [trail, ...checkedTrails];
    setCheckedTrails(nextChecked);
    const userKey = String((profile as UserWithMongoId | null)?._id || profile?.id || currentUser?.id || 'guest');
    try {
      localStorage.setItem(`lost_checkins_${userKey}`, JSON.stringify(nextChecked.map((t) => t.id)));
    } catch {
      // ignore storage quota
    }
    onShowToast?.(`Đã lưu check-in cục bộ cung đường ${trail.name}!`, 'info');
    setShowCheckInModal(false);
  };

  const getActiveMetaUid = (): string =>
    String((profile as UserWithMongoId | null)?._id || profile?.id || currentUserId || 'guest');

  const resolveSavedItemMeta = useCallback(
    (item: SavedTrailRecord | undefined, trailIdKey: string): SavedTrailLocalMeta => {
      const localOverride = savedMetaMap[trailIdKey];
      if (localOverride?.pendingSync) {
        return localOverride;
      }
      if (item) {
        const serverMonth =
          typeof item.plannedMonth === 'number' && item.plannedMonth >= 1 && item.plannedMonth <= 12
            ? Math.trunc(item.plannedMonth)
            : null;
        return {
          collectionName: normalizeSavedCollection(item.collectionName),
          personalNote: typeof item.personalNote === 'string' ? item.personalNote : '',
          plannedMonth: serverMonth,
        };
      }
      return {
        collectionName: normalizeSavedCollection(localOverride?.collectionName),
        personalNote: localOverride?.personalNote || '',
        plannedMonth: localOverride?.plannedMonth ?? null,
      };
    },
    [savedMetaMap]
  );

  const getSavedTrailId = (item: SavedTrailRecord): string =>
    typeof item.trailId === 'object' && item.trailId
      ? String(item.trailId.id || item.trailId._id || '')
      : String(item.trailId || '');

  const handleUpdateSavedTrailMeta = async (
    trailId: string,
    trailName: string,
    patch: {
      collectionName?: SavedCollectionName;
      personalNote?: string;
      plannedMonth?: number | null;
    }
  ) => {
    const key = String(trailId);
    const metaUid = getActiveMetaUid();
    const existingItem = savedTrails.find((item) => getSavedTrailId(item) === key);
    const currentMeta = resolveSavedItemMeta(existingItem, key);
    const nextMeta: SavedTrailLocalMeta = {
      collectionName: patch.collectionName !== undefined ? normalizeSavedCollection(patch.collectionName) : currentMeta.collectionName,
      personalNote: patch.personalNote !== undefined ? patch.personalNote.trim().slice(0, 500) : currentMeta.personalNote,
      plannedMonth: patch.plannedMonth !== undefined ? patch.plannedMonth : currentMeta.plannedMonth,
    };

    // Optimistic UI + fresh-merged per-user local fallback persistence
    setSavedTrails((prev) =>
      prev.map((item) => {
        if (getSavedTrailId(item) !== key) return item;
        return {
          ...item,
          collectionName: nextMeta.collectionName,
          personalNote: nextMeta.personalNote,
          plannedMonth: nextMeta.plannedMonth,
        };
      })
    );
    const token = typeof window !== 'undefined' ? localStorage.getItem('lost_token') : null;
    const optimisticMap: Record<string, SavedTrailLocalMeta> = {
      ...readSavedTrailMetaMap(metaUid),
      [key]: { ...nextMeta, pendingSync: !token },
    };
    setSavedMetaMap(optimisticMap);
    persistSavedTrailMetaMap(metaUid, optimisticMap);

    if (!token) {
      if (patch.personalNote !== undefined) setEditingSavedId(null);
      onShowToast?.(`Đã lưu cục bộ cho "${trailName}".`, 'info');
      return;
    }

    setSavingSavedMetaIds((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    try {
      const savedRecord = await updateSavedTrailMeta(key, {
        collectionName: nextMeta.collectionName,
        personalNote: nextMeta.personalNote,
        plannedMonth: nextMeta.plannedMonth,
      });
      if (!isMountedRef.current) return;
      const syncedMeta: SavedTrailLocalMeta = {
        collectionName: normalizeSavedCollection(savedRecord.collectionName || nextMeta.collectionName),
        personalNote: typeof savedRecord.personalNote === 'string' ? savedRecord.personalNote : nextMeta.personalNote,
        plannedMonth:
          typeof savedRecord.plannedMonth === 'number' &&
            savedRecord.plannedMonth >= 1 &&
            savedRecord.plannedMonth <= 12
            ? Math.trunc(savedRecord.plannedMonth)
            : null,
        pendingSync: false,
      };
      const syncedMap = { ...readSavedTrailMetaMap(metaUid), [key]: syncedMeta };
      setSavedMetaMap(syncedMap);
      persistSavedTrailMetaMap(metaUid, syncedMap);
      setSavedTrails((prev) =>
        prev.map((item) => {
          if (getSavedTrailId(item) !== key) return item;
          return {
            ...item,
            collectionName: syncedMeta.collectionName,
            personalNote: syncedMeta.personalNote,
            plannedMonth: syncedMeta.plannedMonth,
          };
        })
      );
      if (patch.personalNote !== undefined) setEditingSavedId(null);
      onShowToast?.(`Đã cập nhật thông tin "${trailName}".`, 'success');
    } catch (err) {
      if (!isMountedRef.current) return;
      const errMsg = err instanceof Error ? err.message : '';
      const isTransientOutage =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        err instanceof TypeError ||
        /cơ sở dữ liệu chưa sẵn sàng|lỗi khi cập nhật|máy chủ|failed to fetch|network|502|503|504/i.test(
          errMsg
        );
      if (isTransientOutage) {
        const fallbackMap = {
          ...readSavedTrailMetaMap(metaUid),
          [key]: { ...nextMeta, pendingSync: true },
        };
        setSavedMetaMap(fallbackMap);
        persistSavedTrailMetaMap(metaUid, fallbackMap);
        if (patch.personalNote !== undefined) setEditingSavedId(null);
        onShowToast?.(
          `Đã lưu cục bộ cho "${trailName}" — sẽ tự đồng bộ khi máy chủ sẵn sàng.`,
          'info'
        );
      } else {
        // Revert optimistic update when server rejects invalid 4xx payload (e.g. profanity/validation)
        setSavedTrails((prev) =>
          prev.map((item) => {
            if (getSavedTrailId(item) !== key) return item;
            return {
              ...item,
              collectionName: currentMeta.collectionName,
              personalNote: currentMeta.personalNote,
              plannedMonth: currentMeta.plannedMonth,
            };
          })
        );
        const revertedMap = {
          ...readSavedTrailMetaMap(metaUid),
          [key]: { ...currentMeta, pendingSync: false },
        };
        setSavedMetaMap(revertedMap);
        persistSavedTrailMetaMap(metaUid, revertedMap);
        onShowToast?.(errMsg || 'Nội dung ghi chú hoặc bộ sưu tập không hợp lệ.', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setSavingSavedMetaIds((prev) => {
          if (!prev.has(key)) return prev;
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    }
  };

  const handleRemoveSavedTrail = async (trailId: string, trailName: string) => {
    const key = String(trailId);
    const token = localStorage.getItem('lost_token');
    if (!token) {
      onShowToast?.('Vui lòng đăng nhập để bỏ lưu cung đường.', 'info');
      return;
    }
    if (removingSavedIds.has(key)) return;
    const metaUid = getActiveMetaUid();
    setRemovingSavedIds((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    try {
      const res = await fetch(`/api/saved-trails/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        if (!isMountedRef.current) return;
        setSavedTrails((prev) => prev.filter((item) => getSavedTrailId(item) !== key));
        const nextMap = { ...readSavedTrailMetaMap(metaUid) };
        delete nextMap[key];
        setSavedMetaMap(nextMap);
        persistSavedTrailMetaMap(metaUid, nextMap);
        if (editingSavedId === key) setEditingSavedId(null);
        if (confirmRemoveSavedId === key) setConfirmRemoveSavedId(null);
        onShowToast?.(`Đã bỏ lưu cung đường "${trailName}".`, 'info');
      } else {
        const errData = await res.json().catch(() => null);
        if (isMountedRef.current) {
          onShowToast?.(
            errData?.message || 'Không thể bỏ lưu cung đường trên máy chủ lúc này.',
            'error'
          );
        }
      }
    } catch {
      if (isMountedRef.current) {
        onShowToast?.('Không thể bỏ lưu cung đường lúc này.', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setRemovingSavedIds((prev) => {
          if (!prev.has(key)) return prev;
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    }
  };

  const handleExportProfileCsv = () => {
    if (isLoading) return;
    const headerRow = [
      'Loại Mục',
      'Mã Tuyến',
      'Tên Cung Đường',
      'Tỉnh / Thành',
      'Khu Vực',
      'Cự Ly (km)',
      'Độ Cao Đỉnh (m)',
      'Tổng Dốc (+m)',
      'Trạng Thái / Bộ Sưu Tập',
      'Xác Thực GPS / Offline',
      'Tháng Dự Kiến / Thời Gian',
      'Ngày Ghi Nhận',
      'Ghi Chú Cá Nhân',
    ];

    const dataRows: Array<Array<string | number>> = [];
    const exportedCheckinIds = new Set<string>();

    // 1. Completed Check-ins from server telemetry
    rawCheckins.forEach((c) => {
      const tObj = c.trailId && typeof c.trailId === 'object' ? c.trailId : null;
      const tid = String(tObj?.id || tObj?._id || (typeof c.trailId === 'string' ? c.trailId : '') || '');
      const catalogMatch = allAvailableTrails.find(
        (t) => String(t.id) === tid || String((t as TrailWithMongoId)._id) === tid
      );
      const slug = String(tObj?.id || catalogMatch?.id || tid);
      if (slug) exportedCheckinIds.add(slug);
      if (tid) exportedCheckinIds.add(tid);

      const distanceKm = Number(
        c.effectiveDistanceKm ?? c.distanceRecordedKm ?? c.distanceKm ?? tObj?.distanceKm ?? catalogMatch?.distanceKm ?? 0
      );
      const maxAltM = Number(c.maxAltitudeM ?? tObj?.maxAltitudeM ?? catalogMatch?.maxAltitudeM ?? 0);
      const gainM = Number(
        c.effectiveElevationGainM ??
        c.elevationGainRecordedM ??
        c.elevationGainM ??
        tObj?.elevationGainM ??
        catalogMatch?.elevationGainM ??
        0
      );
      const extraNoteParts = [
        c.notes?.trim() || '',
        c.weatherObserved ? `Thời tiết: ${c.weatherObserved}` : '',
        typeof c.packWeightKg === 'number' && c.packWeightKg > 0 ? `Balo: ${c.packWeightKg}kg` : '',
      ].filter(Boolean);

      dataRows.push([
        'Đã chinh phục (Check-in)',
        slug,
        c.trailName || c.name || tObj?.name || catalogMatch?.name || slug,
        c.province || tObj?.province || catalogMatch?.province || '',
        c.region || tObj?.region || catalogMatch?.region || '',
        Number.isFinite(distanceKm) ? distanceKm : 0,
        Number.isFinite(maxAltM) ? maxAltM : 0,
        Number.isFinite(gainM) ? gainM : 0,
        'Đã chinh phục',
        c.verifiedBadge ? 'Đã xác thực GPS' : 'Check-in thủ công',
        typeof c.completionTimeHours === 'number' && c.completionTimeHours > 0
          ? `${c.completionTimeHours} giờ`
          : '',
        formatShortDate(c.checkinDate || c.createdAt),
        extraNoteParts.join(' | '),
      ]);
    });

    // 2. Any additional checked-in trails from local/profile state not in rawCheckins
    checkedTrails.forEach((t) => {
      const mongoId = String((t as TrailWithMongoId)._id || '');
      if (exportedCheckinIds.has(String(t.id)) || (mongoId && exportedCheckinIds.has(mongoId))) {
        return;
      }
      exportedCheckinIds.add(String(t.id));
      const isGpsVerified =
        verifiedCheckinIds.includes(String(t.id)) ||
        (Boolean(mongoId) && verifiedCheckinIds.includes(mongoId));

      dataRows.push([
        'Đã chinh phục (Check-in)',
        t.id,
        t.name,
        t.province || '',
        t.region || '',
        Number(t.distanceKm) || 0,
        Number(t.maxAltitudeM) || 0,
        Number(t.elevationGainM) || 0,
        'Đã chinh phục',
        isGpsVerified ? 'Đã xác thực GPS' : 'Check-in thủ công',
        '',
        '',
        '',
      ]);
    });

    const exportedCheckinsCount = dataRows.length;

    // 3. Saved Wishlist Trails with Collection, Planned Month & Personal Note
    savedTrails.forEach((item) => {
      const trailObj = item.trailId && typeof item.trailId === 'object' ? item.trailId : null;
      const tid = String(
        trailObj?.id || trailObj?._id || (typeof item.trailId === 'string' ? item.trailId : '') || ''
      );
      const matchedFull = allAvailableTrails.find(
        (t) => String(t.id) === tid || String((t as TrailWithMongoId)._id) === tid
      );
      const meta = resolveSavedItemMeta(item, tid);

      dataRows.push([
        'Cung đường đã lưu',
        String(trailObj?.id || matchedFull?.id || tid),
        trailObj?.name || matchedFull?.name || tid,
        trailObj?.province || matchedFull?.province || '',
        trailObj?.region || matchedFull?.region || '',
        Number(trailObj?.distanceKm || matchedFull?.distanceKm || 0),
        Number(trailObj?.maxAltitudeM || matchedFull?.maxAltitudeM || 0),
        Number(trailObj?.elevationGainM || matchedFull?.elevationGainM || 0),
        meta.collectionName,
        item.savedOffline ? 'Đã lưu Offline' : 'Đám mây',
        meta.plannedMonth ? `Tháng ${meta.plannedMonth}` : '',
        '',
        meta.personalNote || '',
      ]);
    });

    if (dataRows.length === 0) {
      onShowToast?.(
        'Bạn chưa có đỉnh đã check-in hoặc cung đường đã lưu nào để xuất CSV.',
        'info'
      );
      return;
    }

    const csvLines = [
      headerRow.map(escapeCsvCell).join(','),
      ...dataRows.map((row) => row.map(escapeCsvCell).join(',')),
    ];
    const csvContent = `\uFEFF${csvLines.join('\r\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const exportUser = profile || currentUser;
    const exportExpId = `LS-${String(
      exportUser?.id || (exportUser as UserWithMongoId | null)?._id || '000000'
    )
      .slice(-6)
      .toUpperCase()}`;
    const safeHandle =
      (exportUser?.username || exportExpId || 'trekker')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'trekker';
    const fileName = `lost-ho-so-leo-nui-${safeHandle}-${formatCsvDateStamp(new Date())}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const revokeTimer = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      csvBlobCleanupRef.current.delete(revokeTimer);
    }, 1500);
    csvBlobCleanupRef.current.set(revokeTimer, url);

    onShowToast?.(
      `Đã xuất hồ sơ CSV (${exportedCheckinsCount} check-in, ${savedTrails.length} cung đã lưu)!`,
      'success'
    );
  };

  const handleCoverFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      onShowToast?.('Kích thước ảnh bìa không được vượt quá 5MB.', 'error');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result;
        setPreviewCover(base64);
        setCustomCoverInput('');
        onShowToast?.(
          'Đã nạp ảnh từ máy tính vào bản xem trước! Nhấn "Lưu & Áp Dụng Ảnh Bìa" để tải lên và hoàn tất.',
          'info'
        );
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleApplyCover = async (coverUrlToApply?: string) => {
    if (isSavingCover) return;
    let finalUrl = (coverUrlToApply || previewCover || customCoverInput).trim();
    if (!finalUrl) {
      onShowToast?.('Vui lòng chọn hoặc dán đường dẫn ảnh bìa hợp lệ.', 'error');
      return;
    }

    setIsSavingCover(true);
    try {
      // Upload base64 data URIs to Cloudinary under `covers` category
      if (finalUrl.startsWith('data:image/')) {
        onShowToast?.('Đang tải ảnh bìa lên máy chủ lưu trữ...', 'info');
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: getApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            imageBase64: finalUrl,
            filename: `cover_${Date.now()}.jpg`,
            category: 'covers',
          }),
        });
        const uploadJson = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok || !uploadJson.success || !uploadJson.url) {
          onShowToast?.(uploadJson.message || 'Không thể tải ảnh bìa lên Cloudinary.', 'error');
          return;
        }
        finalUrl = String(uploadJson.url);
      }

      const activeUid = String((profile as UserWithMongoId | null)?._id || profile?.id || currentUserId || '');
      const token = localStorage.getItem('lost_token');

      if (token) {
        const res = await fetch('/api/auth/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ coverUrl: finalUrl }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success || !data.user) {
          onShowToast?.(data.message || 'Không thể lưu ảnh bìa lên máy chủ. Vui lòng thử lại.', 'error');
          return;
        }
        const persistedCover = data.user.coverUrl || finalUrl;
        setCustomCoverUrl(persistedCover);
        setPreviewCover(persistedCover);
        try {
          const persistedUid = String(data.user._id || data.user.id || activeUid);
          localStorage.setItem(getCoverStorageKey(persistedUid), persistedCover);
        } catch {
          // ignore quota error
        }
        setProfile(data.user);
        onProfileUpdate?.({ ...data.user, coverUrl: persistedCover });
        setShowCoverModal(false);
        onShowToast?.('Đã lưu và cập nhật ảnh bìa mới thành công!', 'success');
      } else {
        setCustomCoverUrl(finalUrl);
        setPreviewCover(finalUrl);
        try {
          localStorage.setItem(getCoverStorageKey(activeUid), finalUrl);
        } catch (e) {
          console.warn('[Cover LocalStorage Warning]:', e);
        }
        setShowCoverModal(false);
        onShowToast?.('Đã lưu ảnh bìa mới trên thiết bị!', 'info');
      }
    } catch (err) {
      console.error('[Cover Upload Error]:', err);
      onShowToast?.('Lỗi kết nối khi lưu ảnh bìa. Vui lòng thử lại.', 'error');
    } finally {
      if (isMountedRef.current) setIsSavingCover(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      const msg = 'Kích thước tệp ảnh đại diện không được vượt quá 5MB.';
      setFieldErrors((prev) => ({ ...prev, avatarUrl: msg }));
      onShowToast?.(msg, 'error');
      e.target.value = '';
      return;
    }

    const previousAvatar =
      editAvatarUrl || profile?.avatarUrl || profile?.avatar || currentUser?.avatarUrl || '';
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result;
        setEditAvatarUrl(base64);
        setFieldErrors((prev) => ({ ...prev, avatarUrl: '' }));
        onShowToast?.('Đang tải và lưu ảnh đại diện mới lên Cloudinary...', 'info');

        // Send to backend profile update handler which performs Cloudinary upload ONCE
        const token = localStorage.getItem('lost_token');
        if (token) {
          try {
            const res = await fetch('/api/auth/profile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ avatarUrl: base64 }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success || !data.user?.avatarUrl) {
              setEditAvatarUrl(previousAvatar);
              const errMsg = data.message || 'Không thể tải ảnh đại diện lên máy chủ.';
              setFieldErrors((prev) => ({ ...prev, avatarUrl: errMsg }));
              onShowToast?.(errMsg, 'error');
              return;
            }
            setEditAvatarUrl(data.user.avatarUrl);
            setProfile(data.user);
            onProfileUpdate?.(data.user);
            onShowToast?.('Đã lưu ảnh đại diện lên Cloudinary CDN thành công!', 'success');
          } catch (err) {
            console.error('[Avatar Update Error]:', err);
            setEditAvatarUrl(previousAvatar);
            const errMsg = 'Lỗi kết nối khi tải lên ảnh đại diện. Đã khôi phục ảnh cũ.';
            setFieldErrors((prev) => ({ ...prev, avatarUrl: errMsg }));
            onShowToast?.(errMsg, 'error');
          }
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof fieldErrors = {};

    // 0. Username Inline Validation
    const cleanUsername = editUsername.trim();
    if (cleanUsername) {
      if (cleanUsername.length < 3 || cleanUsername.length > 30 || !/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
        newErrors.username =
          'Tên tài khoản phải từ 3–30 ký tự, chỉ gồm chữ không dấu, số, dấu gạch dưới (_) hoặc gạch ngang (-).';
      }
    }

    // 1. Full Name Inline Validation
    if (!editFullName.trim() || editFullName.trim().length < 2) {
      newErrors.fullName = 'Họ và tên phải có ít nhất 2 ký tự.';
    }

    // 2. Phone Number Inline Validation (Vietnamese Format)
    if (editPhone.trim()) {
      const cleanPhone = editPhone.trim().replace(/[\s.-]/g, '');
      const phoneRegex = /^(0|\+84)[35789][0-9]{8}$/;
      if (!phoneRegex.test(cleanPhone)) {
        newErrors.phone = 'Số điện thoại liên lạc không đúng định dạng Việt Nam (Ví dụ hợp lệ: 0912345678).';
      }
    }

    // 3. Emergency Contact Validation
    if (editEmergency.trim() && editEmergency.trim().length > 100) {
      newErrors.emergencyContact = 'Thông tin liên hệ khẩn cấp không được vượt quá 100 ký tự.';
    }

    // 4. Bio Validation
    if (editBio.trim() && editBio.trim().length > 500) {
      newErrors.bio = 'Tiểu sử cá nhân không được vượt quá 500 ký tự.';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }

    setFieldErrors({});
    setEditUsernameSuggestions([]);
    setIsSaving(true);
    const token = localStorage.getItem('lost_token');

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...(cleanUsername ? { username: cleanUsername } : {}),
          fullName: editFullName,
          phone: editPhone,
          bio: editBio,
          emergencyContact: editEmergency,
          preferredStyle: editStyle,
          avatarUrl: editAvatarUrl,
          gearLocker: userGear,
        }),
      });

      const data = await res.json();
      setIsSaving(false);

      if (!res.ok || !data.success) {
        if (data.isDuplicateUsername) {
          setFieldErrors({ username: data.message || 'Tên tài khoản này đã có người sử dụng.' });
          if (Array.isArray(data.suggestions)) {
            setEditUsernameSuggestions(data.suggestions);
          }
          return;
        }
        setFieldErrors({ general: data.message || 'Không thể cập nhật hồ sơ cá nhân.' });
        return;
      }

      setProfile(data.user);
      if (onProfileUpdate) onProfileUpdate(data.user);
      setIsEditing(false);
      if (onShowToast) {
        onShowToast(data.message || 'Cập nhật hồ sơ thành công!', 'success');
      }
    } catch {
      setIsSaving(false);
      setFieldErrors({ general: 'Lỗi máy chủ khi cập nhật hồ sơ cá nhân.' });
    }
  };

  const activeProfile: UserProfile = useMemo(
    () =>
      profile ||
      currentUser || {
        id: '',
        username: 'Trekker',
        email: '',
        fullName: 'Thành Viên',
        avatarUrl: getTrekkerAvatarSvg('Thành Viên'),
        role: 'user',
        reputationScore: 0,
        badges: [],
        checkedInTrails: [],
        contributedTrails: [],
        phone: '',
        bio: '',
        emergencyContact: '',
        preferredStyle: 'Trekking & Camping',
        authProvider: 'local',
        isEmailVerified: false,
      },
    [profile, currentUser]
  );

  // Dynamic Expedition ID computed from user ID (Brand: LOST -> LS-...)
  const expeditionId = `LS-${(activeProfile.id || (activeProfile as UserWithMongoId)?._id || '000000').slice(-6).toUpperCase()}`;

  // Real ISO 18004 Scannable QR Matrix encoding Expedition ID + SOS + Profile URL
  const qrPassPayload = useMemo(() => {
    const uname = activeProfile.username || 'trekker';
    const sos = (activeProfile.emergencyContact || '112').replace(/\s+/g, '');
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://lost.vn';
    return `LOST|${expeditionId}|@${uname}|SOS:${sos}|${origin}/#profile-${uname}`;
  }, [expeditionId, activeProfile.username, activeProfile.emergencyContact]);

  const qrPassSvg = useMemo(() => {
    const qr = generateQrMatrix(qrPassPayload);
    return buildQrSvgPath(qr.matrix, 2);
  }, [qrPassPayload]);

  // Is User Verified (via OTP or Google Login)
  const isVerifiedUser = Boolean(activeProfile.isEmailVerified || activeProfile.authProvider === 'google');

  // Filter equipped gear items (memoized)
  const equippedGearItems = useMemo(
    () => ALL_GEAR_ITEMS.filter((g) => userGear.includes(g.id)),
    [userGear]
  );

  // Memoized lookup & collection filter for Saved Trails tab
  const allAvailableTrailsById = useMemo(() => {
    const map = new Map<string, Trail>();
    for (const t of allAvailableTrails) {
      if (t.id) map.set(String(t.id), t);
      const mongoId = (t as TrailWithMongoId)._id;
      if (mongoId) map.set(String(mongoId), t);
    }
    return map;
  }, [allAvailableTrails]);

  const visibleSavedTrails = useMemo(() => {
    if (savedCollectionFilter === 'all') return savedTrails;
    return savedTrails.filter((item) => {
      const trailObj = item.trailId && typeof item.trailId === 'object' ? item.trailId : null;
      const tid = String(trailObj?.id || trailObj?._id || item.trailId || '');
      return resolveSavedItemMeta(item, tid).collectionName === savedCollectionFilter;
    });
  }, [savedTrails, savedCollectionFilter, resolveSavedItemMeta]);

  // Real computed telemetry combining server profile stats + local check-ins
  const computedTelemetry = React.useMemo(() => {
    const checkedDistance = checkedTrails.reduce((sum, t) => sum + (Number(t.distanceKm) || 0), 0);
    const totalDistanceKm = Math.round(Math.max(profileStats.totalDistanceKm, checkedDistance) * 10) / 10;

    let highestAltitudeM = profileStats.highestAltitudeM;
    let summitTrailName = profileStats.summitTrailName;
    for (const t of checkedTrails) {
      if ((Number(t.maxAltitudeM) || 0) > highestAltitudeM) {
        highestAltitudeM = Number(t.maxAltitudeM) || 0;
        summitTrailName = t.name;
      }
    }

    const rep = Number(activeProfile.reputationScore) || 0;
    const completedTrips = Math.max(profileStats.checkinsCount, checkedTrails.length);
    let rankLabel = 'Trekker Tập Sự';
    let rankProgress = Math.min(100, Math.round((rep / 50) * 100));
    if (rep >= 500) {
      rankLabel = 'Alpine Master';
      rankProgress = 100;
    } else if (rep >= 200) {
      rankLabel = 'Alpine Scout';
      rankProgress = Math.min(100, Math.round(((rep - 200) / 300) * 100));
    } else if (rep >= 50) {
      rankLabel = 'Trail Explorer';
      rankProgress = Math.min(100, Math.round(((rep - 50) / 150) * 100));
    }

    return {
      totalDistanceKm,
      highestAltitudeM,
      summitTrailName: summitTrailName || (highestAltitudeM > 0 ? `${highestAltitudeM.toLocaleString('vi-VN')} m` : 'Chưa ghi nhận đỉnh'),
      completedTrips,
      rep,
      rankLabel,
      rankProgress,
    };
  }, [profileStats, checkedTrails, activeProfile.reputationScore]);

  // Computed Badges derived purely from real account state & telemetry
  const computedBadges = React.useMemo(() => {
    const userBadges = (activeProfile.badges || []).map((b) => b.toLowerCase());
    const hasFansipan = checkedTrails.some((t) => t.id === 'trail-fansipan' || t.name.toLowerCase().includes('fansipan'));
    return SYSTEM_BADGES.map((b) => {
      const explicitMatch = userBadges.some((ub) => ub.includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(ub));
      const dynamicUnlock =
        (b.id === 'b-1' && Boolean(activeProfile.id)) ||
        (b.id === 'b-2' && isVerifiedUser) ||
        (b.id === 'b-3' && hasFansipan) ||
        (b.id === 'b-4' && computedTelemetry.rep >= 50) ||
        (b.id === 'b-6' && computedTelemetry.totalDistanceKm >= 100);
      return { ...b, unlocked: Boolean(explicitMatch || dynamicUnlock) };
    });
  }, [activeProfile.badges, activeProfile.id, isVerifiedUser, checkedTrails, computedTelemetry.rep, computedTelemetry.totalDistanceKm]);
  const unlockedBadgesCount = useMemo(
    () => computedBadges.filter((b) => b.unlocked).length,
    [computedBadges]
  );

  // Filter user's own forum posts (strict exact match on userId / email / authorName)
  const userOwnPosts = React.useMemo(() => {
    const myId = String(activeProfile.id || (activeProfile as UserWithMongoId)?._id || '').trim();
    const myEmail = (activeProfile.email || '').toLowerCase().trim();
    const myFullName = (activeProfile.fullName || activeProfile.name || '').toLowerCase().trim();
    const myUsername = (activeProfile.username || '').toLowerCase().trim();

    return userForumPosts.filter((post) => {
      const p = post as ForumThreadExtended;
      const postUserId = String(typeof p.userId === 'object' ? p.userId?._id || '' : p.userId || '').trim();
      if (myId && postUserId && postUserId === myId) return true;

      const postEmail = String(p.authorEmail || p.userEmail || '').toLowerCase().trim();
      if (myEmail && postEmail && postEmail === myEmail) return true;

      if (!postUserId && !postEmail && p.authorName) {
        const authorClean = String(p.authorName).toLowerCase().trim();
        return (
          (Boolean(myFullName) && authorClean === myFullName) ||
          (Boolean(myUsername) && authorClean === myUsername)
        );
      }
      return false;
    });
  }, [userForumPosts, activeProfile]);

  const hasStoredToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('lost_token'));

  if (isLoading && !profile && !currentUser) {
    return <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-text-dim)' }}>Đang tải thông tin hồ sơ...</div>;
  }

  if (!profile && !currentUser && !hasStoredToken) {
    return (
      <div style={{ maxWidth: 560, margin: '64px auto', padding: '40px 28px', textAlign: 'center', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-strong)', borderRadius: 6, boxShadow: 'var(--shadow-card)' }}>
        <div className="section-eyebrow" style={{ justifyContent: 'center', marginBottom: 10 }}>
          Hồ sơ thám hiểm LOST
        </div>
        <h2 className="font-editorial" style={{ fontSize: '1.6rem', color: 'var(--color-text-main)', margin: '0 0 10px 0' }}>
          Đăng Nhập Để Xem Hồ Sơ Cá Nhân
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', lineHeight: 1.6, margin: '0 auto 22px auto', maxWidth: 440 }}>
          Lưu trữ Hộ chiếu Đỉnh núi, phân tích biểu đồ cự ly, tủ đồ sinh tồn, nhật ký hành trình và mã QR Active Pass cứu hộ.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline" onClick={onBack}>
            <ArrowLeft size={15} /> Quay lại trang chủ
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('lost:open-auth-modal', { detail: { mode: 'login' } }));
            }}
          >
            Đăng nhập ngay
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1040, margin: '20px auto', padding: '0 20px 60px 20px' }}>
      {/* Hidden File Input for Direct Cloudinary Avatar Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <button type="button" className="btn btn-outline" onClick={onBack} style={{ fontSize: '0.86rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <ArrowLeft size={16} /> Quay lại trang chủ
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              window.history.pushState({}, '', '/passport');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Award size={15} color="var(--color-sun)" /> Hộ Chiếu Đỉnh Núi
          </button>

          {onNavigateToContribute && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={onNavigateToContribute}
              style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Compass size={15} color="var(--color-primary)" /> Đóng Góp Cung Mới
            </button>
          )}

          <button
            type="button"
            className="btn btn-outline"
            disabled={isLoading}
            onClick={handleExportProfileCsv}
            aria-label="Xuất hồ sơ leo núi dạng CSV"
            title={
              isLoading
                ? 'Đang tải dữ liệu hồ sơ...'
                : 'Tải xuống toàn bộ check-in đỉnh và danh sách cung đã lưu dạng CSV'
            }
            style={{
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              opacity: isLoading ? 0.6 : 1,
              cursor: isLoading ? 'wait' : 'pointer',
            }}
          >
            <DownloadIcon size={15} color="var(--color-sky)" /> Xuất Hồ Sơ (CSV)
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setShowQrModal(true)}
            style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <QrCode size={15} color="var(--color-primary)" /> Mã QR Pass
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setIsEditing(true);
              populateForm(activeProfile);
            }}
            style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Edit3 size={15} /> Chỉnh sửa hồ sơ
          </button>
        </div>
      </div>

      {/* Hidden File Input for Cover Photo Upload */}
      <input
        type="file"
        ref={coverFileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleCoverFileUpload}
      />

      {/* 1. Unified Swiss Editorial Expedition Dossier */}
      <div
        className="card"
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: 0,
          marginBottom: 20,
          borderRadius: 4,
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-card)',
        }}
      >
        {/* Scenic Mountain Panorama Cover Banner */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setFullViewImage({
              url: customCoverUrl,
              title: 'Ảnh Bìa Cá Nhân',
              subtitle: `${activeProfile.fullName} (@${activeProfile.username || 'trekker'})`,
              type: 'cover',
            });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setFullViewImage({
                url: customCoverUrl,
                title: 'Ảnh Bìa Cá Nhân',
                subtitle: `${activeProfile.fullName} (@${activeProfile.username || 'trekker'})`,
                type: 'cover',
              });
            }
          }}
          title="Nhấn vào ảnh để xem trọn vẹn kích thước đầy đủ"
          style={{
            height: 175,
            position: 'relative',
            overflow: 'hidden',
            background: 'var(--color-bg-card)',
            cursor: 'pointer',
          }}
        >
          <img
            decoding="async"
            key={customCoverUrl}
            src={customCoverUrl}
            alt="Ảnh bìa hồ sơ thám hiểm"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              display: 'block',
              transition: 'transform 0.25s ease',
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = DEFAULT_COVER_URL;
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(to bottom, color-mix(in srgb, var(--overlay-bg) 22%, transparent) 0%, color-mix(in srgb, var(--overlay-bg) 44%, transparent) 55%, var(--color-bg-card) 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* View Full Hint Badge on Cover */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 14,
              zIndex: 3,
              background: 'var(--overlay-bg)',
              border: '1px solid color-mix(in srgb, var(--color-on-media) 22%, transparent)',
              color: 'var(--color-on-media)',
              padding: '4px 10px',
              borderRadius: 3,
              fontSize: '0.72rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              pointerEvents: 'none',
            }}
          >
            <Maximize2 size={12} color="var(--color-primary)" /> Xem trọn vẹn
          </div>

          {/* Change Cover Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewCover(customCoverUrl);
              setCustomCoverInput('');
              setShowCoverModal(true);
            }}
            title="Đổi ảnh bìa trang cá nhân"
            style={{
              position: 'absolute',
              top: 12,
              right: 14,
              zIndex: 3,
              background: 'var(--overlay-bg)',
              border: '1px solid color-mix(in srgb, var(--color-on-media) 24%, transparent)',
              color: 'var(--color-on-media)',
              padding: '5px 12px',
              borderRadius: 3,
              fontSize: '0.74rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            <Camera size={13} /> Đổi Ảnh Bìa
          </button>
        </div>

        {/* Identity Information Body */}
        <div
          style={{
            padding: '0 24px 22px 24px',
            position: 'relative',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          {/* Avatar overlapping cover bottom cleanly */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              const currentAvatar = activeProfile.avatarUrl || activeProfile.avatar || getTrekkerAvatarSvg(activeProfile.fullName || activeProfile.username, activeProfile.role);
              setFullViewImage({
                url: currentAvatar,
                title: 'Ảnh Đại Diện',
                subtitle: `${activeProfile.fullName} (@${activeProfile.username || 'trekker'})`,
                type: 'avatar',
              });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const currentAvatar = activeProfile.avatarUrl || activeProfile.avatar || getTrekkerAvatarSvg(activeProfile.fullName || activeProfile.username, activeProfile.role);
                setFullViewImage({
                  url: currentAvatar,
                  title: 'Ảnh Đại Diện',
                  subtitle: `${activeProfile.fullName} (@${activeProfile.username || 'trekker'})`,
                  type: 'avatar',
                });
              }
            }}
            title="Nhấn để xem ảnh đại diện trọn vẹn"
            style={{ position: 'relative', flexShrink: 0, cursor: 'pointer', marginTop: -42 }}
          >
            <img
              decoding="async"
              src={activeProfile.avatarUrl || activeProfile.avatar || getTrekkerAvatarSvg(activeProfile.fullName || activeProfile.username, activeProfile.role)}
              alt={activeProfile.fullName}
              style={{
                width: 96,
                height: 96,
                borderRadius: 6,
                objectFit: 'cover',
                border: '2px solid var(--color-primary)',
                background: 'var(--color-bg-main)',
                display: 'block',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 6,
                background: 'color-mix(in srgb, var(--overlay-bg) 50%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.2s ease',
                color: 'var(--color-on-media)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
            >
              <Maximize2 size={18} color="var(--color-on-media)" />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              title="Tải ảnh đại diện mới"
              style={{
                position: 'absolute',
                bottom: -5,
                right: -5,
                zIndex: 2,
                width: 28,
                height: 28,
                borderRadius: 4,
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-primary)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Upload size={13} />
            </button>
          </div>

          {/* Profile Details */}
          <div style={{ flex: 1, minWidth: 260, paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <h1 className="font-editorial" style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--color-text-main)', margin: 0, lineHeight: 1.15 }}>
                {activeProfile.fullName}
              </h1>
              <span style={{ fontSize: '0.84rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                @{activeProfile.username || 'trekker'}
              </span>
              <span className="badge badge-success" style={{ textTransform: 'uppercase' }}>
                {activeProfile.role}
              </span>
              {isVerifiedUser ? (
                <span className="badge badge-success">
                  <ShieldCheck size={12} color="var(--color-primary)" /> VERIFIED TREKKER
                </span>
              ) : (
                <span className="badge badge-warning">
                  <ShieldAlert size={12} color="var(--color-earth)" /> CHƯA XÁC THỰC EMAIL
                </span>
              )}
            </div>

            {/* Expedition ID & Contact line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 10 }}>
              <span style={{ color: 'var(--color-primary)', fontWeight: 700, background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', padding: '3px 9px', borderRadius: 3, border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)', fontVariantNumeric: 'tabular-nums' }}>
                ID #{expeditionId}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--color-bg-main)', padding: '3px 9px', borderRadius: 3, border: '1px solid var(--color-border)' }}>
                <Mail size={12} color="var(--color-sky)" /> {activeProfile.email}
              </span>
              <span
                onClick={() => {
                  setIsEditing(true);
                  populateForm(activeProfile);
                }}
                title="Bấm để cập nhật số điện thoại"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--color-bg-main)', padding: '3px 9px', borderRadius: 3, border: '1px solid var(--color-border)', cursor: 'pointer' }}
              >
                <Phone size={12} color="var(--color-primary)" />
                <span style={{ color: activeProfile.phone ? 'var(--color-text-main)' : 'var(--color-text-dim)' }}>
                  {activeProfile.phone || 'Thêm SĐT'}
                </span>
              </span>
              <span
                onClick={() => {
                  setIsEditing(true);
                  populateForm(activeProfile);
                }}
                title="Bấm để thiết lập liên hệ khẩn cấp"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--color-bg-main)', padding: '3px 9px', borderRadius: 3, border: '1px solid var(--color-border)', cursor: 'pointer' }}
              >
                <AlertTriangle size={12} color="var(--color-earth)" />
                <span>SOS: <strong style={{ color: activeProfile.emergencyContact ? 'var(--color-earth)' : 'var(--color-text-dim)' }}>{activeProfile.emergencyContact || 'Chưa thiết lập'}</strong></span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--color-bg-main)', padding: '3px 9px', borderRadius: 3, border: '1px solid var(--color-border)' }}>
                <Compass size={12} color="var(--color-sky)" /> {activeProfile.preferredStyle || 'Trekking & Camping'}
              </span>
              <button
                type="button"
                onClick={() => openFollowModal('followers')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'color-mix(in srgb, var(--color-sky) 10%, var(--color-bg-main))',
                  padding: '3px 9px',
                  borderRadius: 3,
                  border: '1px solid color-mix(in srgb, var(--color-sky) 32%, transparent)',
                  color: 'var(--color-text-main)',
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-family)',
                  cursor: 'pointer',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <UsersIcon size={12} color="var(--color-sky)" />
                <strong>{profileStats.followersCount}</strong>
                <span style={{ color: 'var(--color-text-muted)' }}>Người theo dõi</span>
              </button>
              <button
                type="button"
                onClick={() => openFollowModal('following')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'var(--color-bg-main)',
                  padding: '3px 9px',
                  borderRadius: 3,
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-main)',
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-family)',
                  cursor: 'pointer',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <strong>{profileStats.followingCount}</strong>
                <span style={{ color: 'var(--color-text-muted)' }}>Đang theo dõi</span>
              </button>
            </div>

            {/* Bio snippet */}
            <div style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', lineHeight: 1.55, maxWidth: 680 }}>
              {activeProfile.bio ? (
                <span>&ldquo;{activeProfile.bio}&rdquo;</span>
              ) : (
                <span
                  onClick={() => {
                    setIsEditing(true);
                    populateForm(activeProfile);
                  }}
                  style={{ cursor: 'pointer', color: 'var(--color-text-dim)' }}
                >
                  Chưa cập nhật tiểu sử cá nhân. <span style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>Bấm vào đây để thêm.</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Swiss Hairline Telemetry Strip (100% Real Computed Stats) */}
      <div className="editorial-stat-strip" style={{ marginBottom: 24 }}>
        <div className="editorial-stat-cell">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Compass size={14} color="var(--color-primary)" />
            <span style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-dim)', fontWeight: 700 }}>Tổng Quãng Đường</span>
          </div>
          <div className="font-editorial" style={{ fontSize: '1.75rem', fontWeight: 500, color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05 }}>
            {computedTelemetry.totalDistanceKm.toLocaleString('vi-VN')} km
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--color-primary)', marginTop: 3 }}>
            {computedTelemetry.completedTrips > 0
              ? `Hoàn thành ${computedTelemetry.completedTrips} cung đường`
              : 'Chưa có hành trình check-in'}
          </div>
        </div>

        <div className="editorial-stat-cell">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Mountain size={14} color="var(--color-sky)" />
            <span style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-dim)', fontWeight: 700 }}>Đỉnh Cao Nhất</span>
          </div>
          <div className="font-editorial" style={{ fontSize: '1.75rem', fontWeight: 500, color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05 }}>
            {computedTelemetry.highestAltitudeM > 0
              ? `${computedTelemetry.highestAltitudeM.toLocaleString('vi-VN')} m`
              : '0 m'}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {computedTelemetry.summitTrailName}
          </div>
        </div>

        <div className="editorial-stat-cell">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Tent size={14} color="var(--color-earth)" />
            <span style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-dim)', fontWeight: 700 }}>Đóng Góp Cộng Đồng</span>
          </div>
          <div className="font-editorial" style={{ fontSize: '1.75rem', fontWeight: 500, color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05 }}>
            {userOwnPosts.length + userContributions.length} Bài
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
            {userOwnPosts.length} diễn đàn · {userContributions.length} cung đường
          </div>
        </div>

        <div className="editorial-stat-cell">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Award size={14} color="var(--color-primary)" />
            <span style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-dim)', fontWeight: 700 }}>Cấp Độ ({computedTelemetry.rep} PTS)</span>
          </div>
          <div className="font-editorial" style={{ fontSize: '1.35rem', fontWeight: 500, color: 'var(--color-primary)', lineHeight: 1.2 }}>{computedTelemetry.rankLabel}</div>
          <div style={{ width: '100%', background: 'var(--color-bg-main)', height: 5, borderRadius: 2, marginTop: 8, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            <div style={{ width: `${computedTelemetry.rankProgress}%`, background: 'var(--color-primary)', height: '100%' }} />
          </div>
        </div>
      </div>

      {/* 3. Editorial Tab Navigation Bar with Liquid Glider */}
      <div ref={profileTabTrackRef} className="editorial-tabs-bar has-glider">
        <span aria-hidden="true" className="lost-glider-tab" style={profileTabIndicatorStyle} />
        {[
          { id: 'overview', label: 'Chiến Tích & Tổng Quan', Icon: Mountain, count: checkedTrails.length },
          { id: 'analytics', label: 'Phân Tích & Nhật Ký', Icon: BarChart3, count: rawCheckins.length || checkedTrails.length },
          { id: 'saved', label: 'Đã Lưu & Xếp Hạng', Icon: Award, count: savedTrails.length },
          { id: 'contributions', label: 'Cung Đường Đóng Góp', Icon: Compass, count: userContributions.length },
          { id: 'forum', label: 'Bài Viết Diễn Đàn', Icon: MessageSquare, count: userOwnPosts.length },
          { id: 'gear', label: 'Tủ Đồ Sinh Tồn', Icon: Package, count: equippedGearItems.length },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const TabIcon = tab.Icon;
          return (
            <button
              key={tab.id}
              type="button"
              data-glider-active={isActive ? 'true' : undefined}
              onClick={() => setActiveTab(tab.id as ProfileTabId)}
              className={`editorial-tab-btn${isActive ? ' active' : ''}`}
            >
              <TabIcon size={14} color={isActive ? 'var(--color-primary)' : 'currentColor'} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 3,
                    background: isActive ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
                    color: isActive ? 'var(--color-on-primary)' : 'var(--color-text-dim)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 4. Tab Panels (Unified Cinematic Scene Transition on Every Tab Switch) */}
      <div key={activeTab} className="tab-content-slide">
        {/* Panel: Analytics & Trek Logbook */}
        {activeTab === 'analytics' && (
          <ProfileAnalyticsPanel
            trails={allAvailableTrails}
            checkins={rawCheckins.length > 0 ? rawCheckins : checkedTrails}
            currentUser={activeProfile}
            onSelectTrail={onSelectTrail}
            onShowToast={onShowToast}
            onLogbookChanged={() => {
              void loadProfileData();
            }}
          />
        )}

        {/* Panel 1: Overview & Summits */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 20, animation: 'fadeIn 0.25s ease' }}>
            {/* Left: Conquered Trails List */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={18} color="var(--color-primary)" /> Cung Đường Đã Chinh Phục ({checkedTrails.length})
                </h3>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowCheckInModal(true)}
                  style={{ fontSize: 'var(--font-size-xs)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <MapPin size={13} color="var(--color-primary)" /> + Check-in Cung Mới
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {checkedTrails.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--color-text-muted)', background: 'var(--color-bg-main)', borderRadius: 4, border: '1px dashed var(--color-border)', fontSize: 'var(--font-size-xs)', lineHeight: 1.6 }}>
                    Chưa có cung đường check-in nào. Bấm <strong>"+ Check-in Cung Mới"</strong> để lưu lại các cung đường bạn đã thực sự chinh phục.
                  </div>
                ) : (
                  checkedTrails.map((t, idx) => {
                    const theme = TRAIL_CARD_THEMES[idx % TRAIL_CARD_THEMES.length];
                    return (
                      <div
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedTrailPassport(t)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedTrailPassport(t);
                          }
                        }}
                        style={{
                          background: 'var(--color-bg-main)',
                          border: `1px solid ${theme.border}`,
                          borderRadius: 4,
                          padding: '14px 16px',
                          cursor: 'pointer',
                          transition: 'border-color 0.2s ease, transform 0.2s ease',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = theme.color;
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = theme.border;
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.name}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                            {t.province} ({t.region}) · {t.distanceKm} km
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {verifiedCheckinIds.includes(String(t.id)) && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--color-primary)', background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', padding: '3px 7px', borderRadius: 4, border: '1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <ShieldCheck size={11} color="var(--color-primary)" /> GPS
                            </span>
                          )}
                          <span style={{ fontSize: '0.72rem', color: theme.color, background: 'var(--color-bg-card)', padding: '3px 9px', borderRadius: 4, border: `1px solid ${theme.border}`, whiteSpace: 'nowrap', fontWeight: 'var(--font-weight-bold)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Check size={12} color={theme.color} /> {t.maxAltitudeM ? `${t.maxAltitudeM.toLocaleString('vi-VN')}m` : t.region}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Badges & Gear Quick Look */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* System Badges */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Award size={18} color="var(--color-primary)" /> Huy Hiệu Danh Dự ({unlockedBadgesCount}/{computedBadges.length})
                  </h3>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Bấm xem chi tiết</span>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {computedBadges.map((badge) => (
                    <div
                      key={badge.id}
                      onClick={() => setSelectedBadge(badge)}
                      style={{
                        background: badge.unlocked ? badge.bg : 'var(--color-bg-main)',
                        border: badge.unlocked ? `1px solid ${badge.border}` : '1px dashed var(--color-border)',
                        borderRadius: 4,
                        padding: '7px 14px',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease, opacity 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        opacity: badge.unlocked ? 1 : 0.6,
                        boxShadow: badge.unlocked ? badge.glow : 'none',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                      {badge.unlocked ? (
                        <CheckCircle2 size={15} color={badge.color} />
                      ) : (
                        <Lock size={13} color="var(--color-text-dim)" />
                      )}
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: badge.unlocked ? badge.color : 'var(--color-text-dim)' }}>
                        {badge.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Survival Gear Quick Snapshot */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Package size={18} color="var(--color-sky)" /> Trang Bị Sinh Tồn ({equippedGearItems.length})
                  </h3>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setActiveTab('gear')}
                    style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px' }}
                  >
                    Xem tủ đồ
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {equippedGearItems.map((item) => (
                    <span
                      key={item.id}
                      style={{
                        background: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 8,
                        padding: '5px 10px',
                        fontSize: '0.76rem',
                        color: 'var(--color-text-main)',
                        fontWeight: 600,
                      }}
                    >
                      {item.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Personal Explorer Profile & Safety Dossier Card */}
              <div className="card" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <User size={18} color="var(--color-primary)" /> Thông Tin Cá Nhân & An Toàn Thực Địa
                  </h3>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setIsEditing(true);
                      populateForm(activeProfile);
                    }}
                    style={{ fontSize: 'var(--font-size-xs)', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Edit3 size={13} color="var(--color-primary)" /> Chỉnh Sửa Thông Tin
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: 'var(--font-size-xs)' }}>
                  <div style={{ background: 'var(--color-bg-main)', padding: '10px 14px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
                    <div style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>Họ và tên</div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text-main)', fontSize: '0.86rem' }}>{activeProfile.fullName}</div>
                  </div>

                  <div style={{ background: 'var(--color-bg-main)', padding: '10px 14px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
                    <div style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>Email liên lạc</div>
                    <div style={{ fontWeight: 700, color: 'var(--color-sky)', fontSize: '0.86rem' }}>{activeProfile.email}</div>
                  </div>

                  <div style={{ background: 'var(--color-bg-main)', padding: '10px 14px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
                    <div style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>Số điện thoại cá nhân</div>
                    <div style={{ fontWeight: 700, color: activeProfile.phone ? 'var(--color-primary)' : 'var(--color-text-dim)', fontSize: '0.86rem' }}>
                      {activeProfile.phone || 'Chưa cập nhật'}
                    </div>
                  </div>

                  <div style={{ background: 'var(--color-bg-main)', padding: '10px 14px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
                    <div style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>Liên hệ khẩn cấp (SOS)</div>
                    <div style={{ fontWeight: 700, color: activeProfile.emergencyContact ? 'var(--color-earth)' : 'var(--color-text-dim)', fontSize: '0.86rem' }}>
                      {activeProfile.emergencyContact || 'Chưa thiết lập'}
                    </div>
                  </div>

                  <div style={{ background: 'var(--color-bg-main)', padding: '10px 14px', borderRadius: 4, border: '1px solid var(--color-border)', gridColumn: '1 / -1' }}>
                    <div style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>Giới thiệu bản thân (Bio)</div>
                    <div style={{ color: activeProfile.bio ? 'var(--color-text-main)' : 'var(--color-text-dim)', fontStyle: activeProfile.bio ? 'normal' : 'italic', lineHeight: 1.5 }}>
                      {activeProfile.bio || 'Chưa cập nhật tiểu sử cá nhân. Hãy thêm thông điệp và kinh nghiệm của bạn.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Security Card (Change Password & Delete Account) */}
              <div className="card" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Lock size={18} color="var(--color-sky)" /> Bảo Mật Tài Khoản
                  </h3>
                  <span className="badge badge-cloud" style={{ fontSize: '0.68rem' }}>
                    {activeProfile.authProvider === 'google' ? 'Liên kết Google OAuth' : 'Đăng nhập Email & Mật khẩu'}
                  </span>
                </div>

                <p style={{ margin: '0 0 14px 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  {activeProfile.authProvider === 'google'
                    ? 'Tài khoản này sử dụng bảo mật Google OAuth. Bạn vẫn có thể quản lý quyền riêng tư hoặc xóa tài khoản vĩnh viễn bất cứ lúc nào.'
                    : 'Định kỳ cập nhật mật khẩu mạnh để bảo vệ nhật ký hành trình, liên hệ SOS và thu hồi các phiên đăng nhập cũ.'}
                </p>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {activeProfile.authProvider !== 'google' && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => {
                        setCpCurrentPassword('');
                        setCpNewPassword('');
                        setCpConfirmPassword('');
                        setCpError('');
                        setCpShowCurrent(false);
                        setCpShowNew(false);
                        setShowChangePasswordModal(true);
                      }}
                      style={{ fontSize: 'var(--font-size-xs)', padding: '7px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <KeyRoundIcon size={14} color="var(--color-primary)" /> Đổi Mật Khẩu
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setDelConfirmText('');
                      setDelPassword('');
                      setDelShowPassword(false);
                      setDelError('');
                      setShowDeleteAccountModal(true);
                    }}
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      padding: '7px 14px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      color: 'var(--color-error-text, var(--color-error))',
                      borderColor: 'color-mix(in srgb, var(--color-error) 42%, transparent)',
                    }}
                  >
                    <TrashIcon size={14} color="var(--color-error-text, var(--color-error))" /> Xóa Tài Khoản Vĩnh Viễn
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Panel 2: Contributed Trails */}
        {activeTab === 'contributions' && (
          <div className="card" style={{ animation: 'fadeIn 0.25s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Compass size={18} color="var(--color-primary)" /> Lịch Sử Đóng Góp Cung Đường Trekking Mới ({userContributions.length})
              </h3>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { if (onNavigateToContribute) onNavigateToContribute(); }}
                style={{ padding: '6px 14px', fontSize: '0.78rem' }}
              >
                + Đóng Góp Cung Đường Mới
              </button>
            </div>

            {userContributions.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 14 }}>
                {userContributions.map((contrib) => (
                  <div
                    key={contrib.id || contrib._id}
                    style={{
                      background: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 6,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: 'var(--shadow-card)',
                    }}
                  >
                    <div style={{ height: 120, position: 'relative', overflow: 'hidden', background: 'var(--color-surface-elevated)' }}>
                      <img
                        loading="lazy"
                        decoding="async"
                        src={contrib.coverImage || DEFAULT_VIETNAM_TRAIL_COVER}
                        alt={contrib.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = DEFAULT_VIETNAM_TRAIL_COVER;
                        }}
                      />
                      <div style={{ position: 'absolute', top: 8, right: 8 }}>
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
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 4,
                          }}
                        >
                          {contrib.status === 'approved'
                            ? 'Đã Duyệt & Công Khai'
                            : contrib.status === 'rejected'
                              ? 'Đã Từ Chối'
                              : 'Chờ BQT Duyệt'}
                        </span>
                      </div>
                    </div>

                    <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '0 0 4px 0' }}>
                          {contrib.name}
                        </h4>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                          Vị trí: {contrib.province}, {contrib.district} ({contrib.region})
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          <span>Chiều dài: {contrib.distanceKm} km</span>
                          <span>Độ cao nâng: +{contrib.elevationGainM}m</span>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span>Ngày gửi: {formatShortDate(contrib.createdAt)}</span>
                        {contrib.status !== 'approved' || activeProfile.role === 'admin' || activeProfile.role === 'moderator' ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => handleEditContribution(contrib)}
                              style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: 4 }}
                            >
                              Chỉnh sửa
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => handleDeleteContribution(contrib.id || contrib._id || '', contrib.name || '')}
                              style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: 4, color: 'var(--color-error-text, var(--color-error))', borderColor: 'color-mix(in srgb, var(--color-error) 40%, transparent)' }}
                            >
                              Xóa
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={12} color="var(--color-primary)" /> Đã khóa chỉnh sửa
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--color-text-muted)', fontStyle: 'italic', background: 'var(--color-bg-main)', borderRadius: 4, border: '1px dashed var(--color-border)', fontSize: 'var(--font-size-sm)' }}>
                Bạn chưa có bài đóng góp cung đường mới nào. Hãy bấm <strong>"+ Đóng Góp Cung Đường Mới"</strong> để chia sẻ kinh nghiệm và nhận +50 điểm uy tín!
              </div>
            )}
          </div>
        )}

        {/* Panel 4: Forum Posts */}
        {activeTab === 'forum' && (
          <div className="card" style={{ animation: 'fadeIn 0.25s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={18} color="var(--color-sky)" /> Lịch Sử Bài Viết & Đóng Góp Diễn Đàn ({userOwnPosts.length})
              </h3>
            </div>

            {userOwnPosts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {userOwnPosts.map((post) => (
                  <div
                    key={post.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedThreadForModal(post)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedThreadForModal(post);
                      }
                    }}
                    style={{
                      background: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 4,
                      padding: 16,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                      cursor: 'pointer',
                      transition: 'border-color 0.2s ease, transform 0.2s ease',
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
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span className={post.category === 'Cảnh Báo' ? 'badge badge-error' : 'badge badge-success'}>
                          {post.category}
                        </span>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-dim)' }}>{formatShortDate(post.createdAt)}</span>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', textDecoration: 'underline', marginLeft: 'auto' }}>Xem chi tiết & bình luận</span>
                      </div>
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-main)' }}>{post.title}</div>
                    </div>

                    <div style={{ display: 'flex', gap: 16, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ThumbsUp size={15} color="var(--color-primary)" /> {post.upvotes}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MessageSquare size={15} color="var(--color-sky)" /> {post.repliesCount !== undefined ? post.repliesCount : (post as ForumThreadExtended).replies || 0} phản hồi</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--color-text-muted)', fontStyle: 'italic', background: 'var(--color-bg-main)', borderRadius: 4, border: '1px dashed var(--color-border)', fontSize: 'var(--font-size-sm)' }}>
                Tài khoản này chưa tạo bài viết hoặc bài đóng góp diễn đàn nào. Hãy đăng bài đầu tiên để nhận +10 điểm uy tín!
              </div>
            )}
          </div>
        )}

        {/* Panel 2: Cloud Wishlist, Activity Timeline & Top Summit Leaderboard */}
        {activeTab === 'saved' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 20, animation: 'fadeIn 0.25s ease' }}>
            {/* Saved Trails (Cloud Wishlist + Collections & Notes) */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={18} color="var(--color-primary)" /> Cung Đường Đã Lưu ({savedTrails.length})
                </h3>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Folder size={13} color="var(--color-primary)" /> Bộ sưu tập &amp; lịch dự kiến
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={isLoading}
                    onClick={handleExportProfileCsv}
                    style={{
                      padding: '4px 9px',
                      fontSize: '0.72rem',
                      borderRadius: 4,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      opacity: isLoading ? 0.6 : 1,
                      cursor: isLoading ? 'wait' : 'pointer',
                    }}
                  >
                    <DownloadIcon size={12} color="var(--color-sky)" /> Xuất CSV
                  </button>
                </div>
              </div>

              {/* Collection Filter Chips (WAI-ARIA Tablist) */}
              {savedTrails.length > 0 && (() => {
                const folderCounts: Record<'all' | SavedCollectionName, number> = {
                  all: savedTrails.length,
                  'Muốn đi': 0,
                  'Sắp đi': 0,
                  'Đã chinh phục': 0,
                  'Mục tiêu năm': 0,
                };
                savedTrails.forEach((item) => {
                  const trailObj = item.trailId && typeof item.trailId === 'object' ? item.trailId : null;
                  const tid = String(trailObj?.id || trailObj?._id || item.trailId || '');
                  const meta = resolveSavedItemMeta(item, tid);
                  folderCounts[meta.collectionName] += 1;
                });
                const tabs: Array<{ id: 'all' | SavedCollectionName; label: string }> = [
                  { id: 'all', label: 'Tất cả' },
                  ...SAVED_COLLECTION_FOLDERS.map((folder) => ({ id: folder, label: folder })),
                ];
                return (
                  <div role="tablist" aria-label="Bộ lọc bộ sưu tập cung đường đã lưu" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {tabs.map((tab, tabIdx) => {
                      const isActive = savedCollectionFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          id={`lost-saved-tab-${tab.id}`}
                          ref={(el) => {
                            savedTabRefs.current[tab.id] = el;
                          }}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          aria-controls="lost-saved-trails-tabpanel"
                          tabIndex={isActive ? 0 : -1}
                          onClick={() => setSavedCollectionFilter(tab.id)}
                          onKeyDown={(e) => {
                            let nextIdx: number | null = null;
                            if (e.key === 'ArrowRight') nextIdx = (tabIdx + 1) % tabs.length;
                            else if (e.key === 'ArrowLeft') nextIdx = (tabIdx - 1 + tabs.length) % tabs.length;
                            else if (e.key === 'Home') nextIdx = 0;
                            else if (e.key === 'End') nextIdx = tabs.length - 1;
                            if (nextIdx !== null) {
                              e.preventDefault();
                              const targetTab = tabs[nextIdx];
                              setSavedCollectionFilter(targetTab.id);
                              savedTabRefs.current[targetTab.id]?.focus();
                            }
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '5px 10px',
                            borderRadius: 4,
                            fontSize: '0.74rem',
                            fontWeight: isActive ? 800 : 600,
                            cursor: 'pointer',
                            border: isActive
                              ? '1px solid var(--color-primary)'
                              : '1px solid var(--color-border)',
                            background: isActive
                              ? 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-card))'
                              : 'var(--color-bg-main)',
                            color: isActive ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          <span>{tab.label}</span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              padding: '1px 5px',
                              borderRadius: 3,
                              background: isActive
                                ? 'var(--color-primary)'
                                : 'var(--color-surface-elevated)',
                              color: isActive ? 'var(--color-on-primary)' : 'var(--color-text-dim)',
                              fontWeight: 800,
                            }}
                          >
                            {folderCounts[tab.id]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              <div
                id="lost-saved-trails-tabpanel"
                role="tabpanel"
                aria-labelledby={savedTrails.length > 0 ? `lost-saved-tab-${savedCollectionFilter}` : undefined}
              >
                {savedTrails.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', background: 'var(--color-bg-main)', borderRadius: 4, border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                    Chưa có cung đường nào trong danh sách lưu đám mây. Hãy mở một cung đường và bấm &ldquo;Lưu Cung Đường&rdquo; hoặc &ldquo;Tải Gói Offline&rdquo;.
                  </div>
                ) : (() => {
                  if (visibleSavedTrails.length === 0) {
                    return (
                      <div style={{ padding: 18, textAlign: 'center', background: 'var(--color-bg-main)', borderRadius: 4, border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                        Chưa có cung đường nào trong thư mục &ldquo;{savedCollectionFilter}&rdquo;. Chọn bộ sưu tập ở từng cung đường trong tab &ldquo;Tất cả&rdquo; để phân loại.
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {visibleSavedTrails.map((item, idx) => {
                        const trailObj = item.trailId && typeof item.trailId === 'object' ? item.trailId : null;
                        const tId = String(trailObj?.id || trailObj?._id || (typeof item.trailId === 'string' ? item.trailId : '') || '');
                        const matchedFull = allAvailableTrailsById.get(tId);
                        const tName = trailObj?.name || matchedFull?.name || tId;
                        const meta = resolveSavedItemMeta(item, tId);
                        const isEditingNote = editingSavedId === tId;
                        const isSavingThis = savingSavedMetaIds.has(tId);
                        const isRemovingThis = removingSavedIds.has(tId);
                        const isConfirmingRemove = confirmRemoveSavedId === tId;
                        const requiresConfirmRemove = Boolean(meta.personalNote || meta.plannedMonth);
                        const maxAlt = Number(trailObj?.maxAltitudeM || matchedFull?.maxAltitudeM || 0);

                        return (
                          <div
                            key={item._id || tId || idx}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10,
                              padding: '12px 14px',
                              borderRadius: 4,
                              background: 'var(--color-bg-main)',
                              border: isEditingNote
                                ? '1px solid var(--color-primary)'
                                : '1px solid var(--color-border)',
                            }}
                          >
                            {/* Header row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontWeight: 800, fontSize: '0.86rem', color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span>{tName}</span>
                                  {item.savedOffline && (
                                    <span className="badge badge-success" style={{ fontSize: '0.66rem', padding: '1px 6px' }}>Offline</span>
                                  )}
                                  <span
                                    className="badge badge-cloud"
                                    style={{ fontSize: '0.66rem', padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  >
                                    <Folder size={10} /> {meta.collectionName}
                                  </span>
                                  {meta.plannedMonth && (
                                    <span
                                      className="badge badge-sky"
                                      style={{ fontSize: '0.66rem', padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: 4, fontVariantNumeric: 'tabular-nums' }}
                                    >
                                      <CalendarIcon size={10} /> Tháng {meta.plannedMonth}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                                  {(trailObj?.province || matchedFull?.province || 'Việt Nam')} · {(trailObj?.distanceKm || matchedFull?.distanceKm || 0)} km
                                  {maxAlt > 0 ? ` · Đỉnh ${maxAlt.toLocaleString('vi-VN')}m` : ''}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                                {matchedFull && (
                                  <button
                                    type="button"
                                    className="btn btn-outline"
                                    disabled={isRemovingThis}
                                    onClick={() => onSelectTrail(matchedFull)}
                                    style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                                  >
                                    Mở Cung
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  disabled={isRemovingThis}
                                  onClick={() => {
                                    setConfirmRemoveSavedId(null);
                                    if (isEditingNote) {
                                      setEditingSavedId(null);
                                    } else {
                                      setEditingSavedId(tId);
                                      setSavedNoteDraft(meta.personalNote);
                                    }
                                  }}
                                  style={{ padding: '4px 8px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                >
                                  <Edit3 size={12} /> {meta.personalNote ? 'Sửa Ghi Chú' : 'Ghi Chú'}
                                </button>
                                {isConfirmingRemove ? (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-outline"
                                      disabled={isRemovingThis}
                                      onClick={() => void handleRemoveSavedTrail(tId, tName)}
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: '0.74rem',
                                        fontWeight: 800,
                                        color: 'var(--color-error-text, var(--color-error))',
                                        borderColor: 'var(--color-error)',
                                        background: 'color-mix(in srgb, var(--color-error) 10%, var(--color-bg-card))',
                                      }}
                                    >
                                      {isRemovingThis ? 'Đang bỏ...' : 'Xác nhận bỏ'}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-outline"
                                      disabled={isRemovingThis}
                                      onClick={() => setConfirmRemoveSavedId(null)}
                                      style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                                    >
                                      Hủy
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-outline"
                                    disabled={isRemovingThis}
                                    onClick={() => {
                                      if (requiresConfirmRemove) {
                                        setConfirmRemoveSavedId(tId);
                                      } else {
                                        void handleRemoveSavedTrail(tId, tName);
                                      }
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: '0.74rem',
                                      color: 'var(--color-error-text, var(--color-error))',
                                      borderColor: 'color-mix(in srgb, var(--color-error) 35%, transparent)',
                                    }}
                                  >
                                    {isRemovingThis ? 'Đang bỏ...' : 'Bỏ'}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Inline Collection & Planned-Month Pickers */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)' }}>
                                <span>Thư mục bộ sưu tập</span>
                                <select
                                  aria-label={`Bộ sưu tập cho ${tName}`}
                                  value={meta.collectionName}
                                  disabled={isSavingThis}
                                  onChange={(e) => {
                                    const nextCol = normalizeSavedCollection(e.target.value);
                                    void handleUpdateSavedTrailMeta(tId, tName, { collectionName: nextCol });
                                  }}
                                  className="form-input"
                                  style={{ padding: '5px 8px', fontSize: '0.75rem', borderRadius: 4, width: '100%' }}
                                >
                                  {SAVED_COLLECTION_FOLDERS.map((folder) => (
                                    <option key={folder} value={folder}>
                                      {folder}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)' }}>
                                <span>Tháng dự kiến khởi hành</span>
                                <select
                                  aria-label={`Tháng dự kiến cho ${tName}`}
                                  value={meta.plannedMonth !== null ? String(meta.plannedMonth) : ''}
                                  disabled={isSavingThis}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const nextMonth = val ? Number(val) : null;
                                    void handleUpdateSavedTrailMeta(tId, tName, { plannedMonth: nextMonth });
                                  }}
                                  className="form-input"
                                  style={{ padding: '5px 8px', fontSize: '0.75rem', borderRadius: 4, width: '100%', fontVariantNumeric: 'tabular-nums' }}
                                >
                                  <option value="">Chưa chốt tháng</option>
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                                    <option key={m} value={String(m)}>
                                      Tháng {m}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            {/* Personal Note Readout */}
                            {!isEditingNote && meta.personalNote && (
                              <div
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 4,
                                  background: 'var(--color-bg-card)',
                                  border: '1px solid var(--color-border)',
                                  fontSize: '0.76rem',
                                  color: 'var(--color-text-muted)',
                                  lineHeight: 1.5,
                                  whiteSpace: 'pre-wrap',
                                }}
                              >
                                <span style={{ fontWeight: 800, color: 'var(--color-text-main)', marginRight: 6 }}>Ghi chú:</span>
                                {meta.personalNote}
                              </div>
                            )}

                            {/* Inline Personal Note Editor */}
                            {isEditingNote && (
                              <div
                                style={{
                                  padding: 10,
                                  borderRadius: 4,
                                  background: 'var(--color-bg-card)',
                                  border: '1px solid var(--color-border-strong)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 8,
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>
                                    Ghi chú kế hoạch cá nhân
                                  </span>
                                  <span style={{ color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                                    {savedNoteDraft.length}/500
                                  </span>
                                </div>
                                <textarea
                                  aria-label={`Ghi chú cá nhân cho ${tName}`}
                                  className="form-textarea"
                                  rows={2}
                                  maxLength={500}
                                  placeholder="VD: Đặt xe giường nằm tối thứ 6, thuê porter bản địa, canh mùa hoa đỗ quyên..."
                                  value={savedNoteDraft}
                                  onChange={(e) => setSavedNoteDraft(e.target.value)}
                                  style={{ width: '100%', padding: '6px 9px', fontSize: '0.78rem', borderRadius: 4 }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                                  <button
                                    type="button"
                                    className="btn btn-outline"
                                    disabled={isSavingThis}
                                    onClick={() => setEditingSavedId(null)}
                                    style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                                  >
                                    Hủy
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    disabled={isSavingThis}
                                    onClick={() => void handleUpdateSavedTrailMeta(tId, tName, { personalNote: savedNoteDraft })}
                                    style={{ padding: '4px 12px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  >
                                    <Save size={12} /> {isSavingThis ? 'Đang lưu...' : 'Lưu Ghi Chú'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Recent Activity Timeline */}
              <div style={{ marginTop: 8, paddingTop: 14, borderTop: '1px solid var(--color-border)' }}>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '0 0 10px 0' }}>
                  Nhật Ký Hoạt Động Gần Đây ({activities.length})
                </h4>
                {activities.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)' }}>Chưa có hoạt động nào được ghi nhận.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                    {activities.map((act, idx) => (
                      <div key={act._id || idx} style={{ padding: '8px 10px', borderRadius: 4, background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', fontSize: '0.76rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>
                          {act.title || act.content || 'Hoạt động thực địa'}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
                          {act.createdAt ? new Date(act.createdAt).toLocaleString('vi-VN') : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Top Summit Conquerors Leaderboard */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Award size={18} color="var(--color-earth)" /> Bảng Xếp Hạng Chinh Phục Đỉnh
              </h3>
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                Thống kê thực tế từ hệ thống Check-in GPS &amp; Nhật ký đỉnh đã xác thực trên LOST.
              </p>
              {leaderboard.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', background: 'var(--color-bg-main)', borderRadius: 4, border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                  Chưa có lượt check-in nào trên bảng xếp hạng. Hãy là người đầu tiên chinh phục và check-in đỉnh!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {leaderboard.map((row, idx) => {
                    const rank = row.rank ?? idx + 1;
                    const summits = row.trailsConquered ?? row.summitsCount ?? 0;
                    const verified = row.verifiedCheckins ?? row.verifiedCount ?? 0;
                    return (
                      <div
                        key={row.userId || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 4,
                          background: rank <= 3 ? 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-main))' : 'var(--color-bg-main)',
                          border: rank === 1 ? '1.5px solid var(--color-earth)' : '1px solid var(--color-border)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <span
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 900,
                              fontSize: '0.76rem',
                              background: rank === 1 ? 'var(--color-earth)' : rank === 2 ? 'var(--color-sky)' : 'var(--color-bg-card)',
                              color: rank <= 2 ? 'var(--color-on-primary)' : 'var(--color-text-main)',
                              border: '1px solid var(--color-border)',
                              flexShrink: 0,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            #{rank}
                          </span>
                          <img
                            loading="lazy"
                            decoding="async"
                            src={row.avatarUrl || getTrekkerAvatarSvg(row.fullName || row.username || 'Trekker')}
                            alt={row.fullName}
                            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row.fullName || row.username || 'Trekker'}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                              {Number(row.totalDistanceKm || 0)} km • Đỉnh cao nhất {Number(row.highestAltitudeM || 0).toLocaleString('vi-VN')}m
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                          <div style={{ fontWeight: 900, fontSize: '0.86rem', color: 'var(--color-primary)' }}>
                            {summits} đỉnh
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--color-sky)', fontWeight: 700 }}>
                            {verified} GPS xác thực
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Panel 5: Gear Locker */}
        {activeTab === 'gear' && (
          <div className="card" style={{ animation: 'fadeIn 0.25s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Package size={18} color="var(--color-primary)" /> Quản Lý Tủ Đồ Thiết Bị Sinh Tồn ({userGear.length}/{ALL_GEAR_ITEMS.length})
                </h3>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 3 }}>
                  Bấm trực tiếp vào từng món trang bị để kích hoạt hoặc hủy kích hoạt trong balo dã ngoại
                </div>
              </div>

              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowGearModal(true)}
                style={{ fontSize: 'var(--font-size-xs)', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Edit3 size={14} /> Mở cửa sổ quản lý tủ đồ
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))', gap: 12 }}>
              {ALL_GEAR_ITEMS.map((item) => {
                const isOwned = userGear.includes(item.id);
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleToggleGear(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggleGear(item.id);
                      }
                    }}
                    style={{
                      background: isOwned ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'var(--color-bg-main)',
                      border: isOwned ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                      borderRadius: 4,
                      padding: '14px 16px',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease, border-color 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                    onMouseEnter={(e) => {
                      if (!isOwned) e.currentTarget.style.borderColor = 'var(--color-primary)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isOwned) e.currentTarget.style.borderColor = 'var(--color-border)';
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.68rem', color: isOwned ? 'var(--color-primary)' : 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                        {item.category}
                      </span>
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: isOwned ? 'var(--color-text-main)' : 'var(--color-text-muted)', marginTop: 2 }}>
                        {item.name}
                      </div>
                    </div>
                    {isOwned ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                        <CheckCircle2 size={16} color="var(--color-primary)" /> Đã trang bị
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
                        + Trang bị
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* QR Active Pass Detail Modal (Real ISO 18004 Scannable SVG QR) */}
      {showQrModal &&
        createPortal(
          <div className="modal-overlay" onClick={() => setShowQrModal(false)} style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}>
            <div ref={qrModalRef} tabIndex={-1} className="modal-content" role="dialog" aria-modal="true" aria-label="Mã thông hành QR Active Pass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <QrCode size={20} /> Mã Thông Hành QR Active Pass
                </h3>
                <button type="button" onClick={() => setShowQrModal(false)} aria-label="Đóng" style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <div
                style={{
                  background: 'var(--color-on-media)',
                  padding: 14,
                  borderRadius: 6,
                  textAlign: 'center',
                  margin: '0 auto 16px auto',
                  width: 204,
                  height: 204,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--color-primary)',
                }}
              >
                <svg
                  width="176"
                  height="176"
                  viewBox={`0 0 ${qrPassSvg.viewBoxSize} ${qrPassSvg.viewBoxSize}`}
                  shapeRendering="crispEdges"
                  role="img"
                  aria-label={`Mã QR Active Pass ${expeditionId}`}
                >
                  <rect width={qrPassSvg.viewBoxSize} height={qrPassSvg.viewBoxSize} fill="var(--color-on-media)" />
                  <path
                    d={qrPassSvg.pathD}
                    fill={isLightTheme ? 'var(--color-text-main)' : 'var(--color-bg-main)'}
                  />
                </svg>
              </div>

              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', lineHeight: 'var(--line-height-normal)', textAlign: 'center', marginBottom: 16 }}>
                Mã QR chuẩn ISO mã hóa ID thám hiểm <strong style={{ color: 'var(--color-primary)' }}>#{expeditionId}</strong> dành cho Đội Cứu Hộ SOS và Cán bộ Trạm Kiểm Lâm quét trực tiếp bằng camera.
              </div>

              <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: 12, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>Trạng Thái: <strong style={{ color: 'var(--color-primary)' }}>{isVerifiedUser ? 'Đã Xác Thực' : 'Chưa Kích Hoạt OTP'}</strong></div>
                <div>Liên Hệ Khẩn Cấp: <strong style={{ color: 'var(--color-text-main)' }}>{activeProfile.emergencyContact || 'Chưa thiết lập'}</strong></div>
                <div>Thời Gian Tạo: <strong style={{ color: 'var(--color-sky)' }}>{new Date().toLocaleDateString('vi-VN')}</strong></div>
              </div>

              <button type="button" className="btn btn-outline" onClick={() => setShowQrModal(false)} style={{ width: '100%', marginTop: 16 }}>
                Đóng Cửa Sổ
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* BADGE DETAIL EXPLANATION MODAL */}
      {selectedBadge &&
        createPortal(
          <div className="modal-overlay" onClick={() => setSelectedBadge(null)} style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}>
            <div ref={badgeModalRef} tabIndex={-1} className="modal-content" role="dialog" aria-modal="true" aria-label="Chi tiết huy hiệu danh dự" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, border: `1px solid ${selectedBadge.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 'var(--font-size-base)', color: selectedBadge.color, fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Award size={20} /> Chi Tiết Huy Hiệu Danh Dự
                </h3>
                <button type="button" onClick={() => setSelectedBadge(null)} aria-label="Đóng" style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ background: 'var(--color-bg-main)', borderRadius: 4, padding: 20, textAlign: 'center', border: `1px solid ${selectedBadge.border}`, marginBottom: 16 }}>
                <div style={{ display: 'inline-block', padding: '8px 18px', borderRadius: 4, border: `1px solid ${selectedBadge.color}`, background: 'var(--color-bg-card)' }}>
                  <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-extrabold)', color: selectedBadge.color }}>
                    {selectedBadge.name}
                  </span>
                </div>

                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 10 }}>
                  <span className={selectedBadge.unlocked ? 'badge badge-success' : 'badge badge-sun'}>
                    {selectedBadge.unlocked ? 'Đã Mở Khóa' : 'Chưa Mở Khóa'}
                  </span>
                  <span className="badge badge-cloud">Độ Hiếm: {selectedBadge.rarity}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', lineHeight: 'var(--line-height-relaxed)' }}>
                <div>
                  <strong style={{ color: selectedBadge.color }}>Nguồn gốc &amp; Ý nghĩa: </strong>
                  <span style={{ color: 'var(--color-text-main)' }}>{selectedBadge.description}</span>
                </div>
                <div>
                  <strong style={{ color: 'var(--color-sky)' }}>Điều kiện mở khóa: </strong>
                  <span style={{ color: 'var(--color-text-main)' }}>{selectedBadge.requirement}</span>
                </div>
                {selectedBadge.unlockedAt && (
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-dim)', marginTop: 4 }}>
                    Ngày đạt được: {selectedBadge.unlockedAt}
                  </div>
                )}
              </div>

              <button type="button" className="btn btn-primary" onClick={() => setSelectedBadge(null)} style={{ width: '100%', marginTop: 20 }}>
                Đã Hiểu
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* CONQUERED TRAIL PASSPORT DETAIL MODAL */}
      {selectedTrailPassport &&
        createPortal(
          <div className="modal-overlay" onClick={() => setSelectedTrailPassport(null)} style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}>
            <div ref={passportModalRef} tabIndex={-1} className="modal-content" role="dialog" aria-modal="true" aria-label="Chứng nhận chinh phục cung đường" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, border: '1px solid var(--color-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={20} /> Chứng Nhận Chinh Phục Cung Đường
                </h3>
                <button type="button" onClick={() => setSelectedTrailPassport(null)} aria-label="Đóng" style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ background: 'var(--color-bg-main)', borderRadius: 4, padding: 20, border: '1px dashed var(--color-primary)', textAlign: 'center', marginBottom: 18 }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-extrabold)', textTransform: 'uppercase', letterSpacing: 2 }}>
                  OFFICIAL EXPEDITION CHECK-IN PASSPORT
                </div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)', marginTop: 4 }}>
                  {selectedTrailPassport.name}
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {selectedTrailPassport.province} ({selectedTrailPassport.region})
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12, marginBottom: 18 }}>
                <div style={{ background: 'var(--color-bg-main)', padding: 12, borderRadius: 4, border: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block' }}>Chiều Dài Cung Đường</span>
                  <strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)' }}>{selectedTrailPassport.distanceKm} km</strong>
                </div>

                <div style={{ background: 'var(--color-bg-main)', padding: 12, borderRadius: 4, border: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block' }}>Độ Khó Địa Hình</span>
                  <strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-primary)' }}>
                    {getDifficultyText(selectedTrailPassport.difficultyLevel)}
                  </strong>
                </div>
              </div>

              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', lineHeight: 'var(--line-height-normal)', marginBottom: 20 }}>
                Dữ liệu được ghi nhận qua hệ thống <strong>GPS Trekking Log</strong> và kiểm chứng thông tin tuyến đường.
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn btn-outline" onClick={() => setSelectedTrailPassport(null)} style={{ flex: 1 }}>
                  Đóng
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const trailToNav = selectedTrailPassport;
                    setSelectedTrailPassport(null);
                    onSelectTrail(trailToNav);
                  }}
                  style={{ flex: 1 }}
                >
                  Mở Bản Đồ 3D Cung Đường
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* CUSTOM CONFIRM DELETE CONTRIBUTION MODAL */}
      {deletingContribution &&
        createPortal(
          <div className="modal-overlay" onClick={() => setDeletingContribution(null)} style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}>
            <div ref={deleteContribModalRef} tabIndex={-1} className="modal-content" role="alertdialog" aria-modal="true" aria-label="Xác nhận xóa bài đóng góp" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, border: '1.5px solid var(--color-error)' }}>
              <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-error-text, var(--color-error))', fontWeight: 'var(--font-weight-extrabold)', margin: '0 0 12px 0' }}>
                Xác nhận xóa bài đóng góp
              </h3>

              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)', lineHeight: 1.5, marginBottom: 20 }}>
                Bạn có chắc chắn muốn xóa bài đóng góp cung đường <strong style={{ color: 'var(--color-primary)' }}>"{deletingContribution.name}"</strong> không? Thao tác này sẽ gỡ bài viết khỏi hệ thống và không thể hoàn tác.
              </p>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setDeletingContribution(null)}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={confirmDeleteContribution}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Xác nhận xóa
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* CHECK-IN NEW TRAIL MODAL */}
      {showCheckInModal &&
        createPortal(
          <div className="modal-overlay" onClick={() => !isSubmittingCheckin && setShowCheckInModal(false)} style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}>
            <div ref={checkInModalRef} tabIndex={-1} className="modal-content" role="dialog" aria-modal="true" aria-label="Chọn cung đường vừa chinh phục" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={20} /> Chọn Cung Đường Vừa Chinh Phục
                </h3>
                <button
                  type="button"
                  onClick={() => !isSubmittingCheckin && setShowCheckInModal(false)}
                  disabled={isSubmittingCheckin}
                  aria-label="Đóng"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: isSubmittingCheckin ? 'not-allowed' : 'pointer',
                    opacity: isSubmittingCheckin ? 0.5 : 1,
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: '10px 12px', borderRadius: 4, background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                  <span>Thời gian hoàn thành (giờ):</span>
                  <input
                    type="number"
                    min={0.5}
                    max={240}
                    step={0.5}
                    value={checkinHours}
                    onChange={(e) => setCheckinHours(e.target.value)}
                    className="form-input"
                    style={{ width: 68, padding: '4px 8px', fontSize: '0.8rem' }}
                  />
                </label>
                <button
                  type="button"
                  className={`btn ${checkinCoords ? 'btn-primary' : 'btn-outline'}`}
                  onClick={handleCaptureCheckinGps}
                  disabled={isCapturingCheckinGps}
                  style={{ fontSize: '0.74rem', padding: '5px 10px' }}
                >
                  <ShieldCheck size={13} />
                  <span>
                    {isCapturingCheckinGps
                      ? 'Đang lấy GPS...'
                      : checkinCoords
                        ? `GPS Đã Gắn (${checkinCoords.lat.toFixed(3)}, ${checkinCoords.lng.toFixed(3)})`
                        : 'Đính Kèm GPS Xác Thực Đỉnh'}
                  </span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 340, overflowY: 'auto', paddingRight: 4 }}>
                {allAvailableTrails.map((trail) => {
                  const isAlreadyChecked = checkedTrails.some((t) => t.id === trail.id);
                  if (isAlreadyChecked) {
                    return (
                      <div
                        key={trail.id}
                        style={{
                          background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                          border: '1px solid var(--color-primary)',
                          borderRadius: 4,
                          padding: 14,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)', fontSize: 'var(--font-size-sm)' }}>{trail.name}</div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>{trail.province} ({trail.distanceKm} km)</div>
                        </div>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-bold)', flexShrink: 0 }}>
                          Đã Check-in
                        </span>
                      </div>
                    );
                  }
                  return (
                    <button
                      key={trail.id}
                      type="button"
                      disabled={isSubmittingCheckin}
                      onClick={() => !isSubmittingCheckin && void handleAddCheckInTrail(trail)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        fontFamily: 'var(--font-family)',
                        background: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 4,
                        padding: 14,
                        cursor: isSubmittingCheckin ? 'not-allowed' : 'pointer',
                        opacity: isSubmittingCheckin ? 0.65 : 1,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)', fontSize: 'var(--font-size-sm)' }}>{trail.name}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>{trail.province} ({trail.distanceKm} km)</div>
                      </div>
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-card)',
                          color: 'var(--color-text-main)',
                          flexShrink: 0,
                        }}
                      >
                        {isSubmittingCheckin ? 'Đang lưu...' : '+ Check-in'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* EDIT PROFILE MODAL */}
      {isEditing &&
        createPortal(
          <div className="modal-overlay" onClick={() => !isSaving && setIsEditing(false)} style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}>
            <div
              ref={editProfileModalRef}
              tabIndex={-1}
              className="modal-content"
              role="dialog"
              aria-modal="true"
              aria-label="Chỉnh sửa hồ sơ cá nhân"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 720,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Modal Fixed Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}>
                <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <User size={20} /> Điền & Cập Nhật Thông Tin Cá Nhân
                </h3>
                <button
                  type="button"
                  onClick={() => !isSaving && setIsEditing(false)}
                  disabled={isSaving}
                  aria-label="Đóng"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving ? 0.5 : 1,
                  }}
                >
                  <X size={22} />
                </button>
              </div>

              {/* Modal Inner Scrollable Body */}
              <form
                onSubmit={handleSaveProfile}
                style={{
                  overflowY: 'auto',
                  maxHeight: 'calc(90vh - 100px)',
                  paddingRight: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 20,
                }}
              >
                {fieldErrors.general && (
                  <div style={{ background: 'color-mix(in srgb, var(--color-error) 14%, transparent)', border: '1px solid var(--color-error)', borderRadius: 4, padding: '10px 14px', color: 'var(--color-error-text, var(--color-error))', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)' }}>
                    {fieldErrors.general}
                  </div>
                )}

                {/* RESPONSIVE 2-COLUMN INPUT GRID */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                  {/* Editable Username Input */}
                  <div className="form-group">
                    <label className="form-label" style={{ height: 22, display: 'flex', alignItems: 'center', gap: 6, margin: 0, marginBottom: 8, whiteSpace: 'nowrap' }}>
                      Tên tài khoản (@username)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="minh_trekker"
                      maxLength={30}
                      style={{
                        borderColor: fieldErrors.username ? 'var(--color-error)' : undefined,
                      }}
                      value={editUsername}
                      onChange={(e) => {
                        setEditUsername(e.target.value);
                        setEditUsernameSuggestions([]);
                        setFieldErrors((prev) => ({ ...prev, username: '' }));
                      }}
                    />
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', marginTop: 4 }}>
                      3–30 ký tự không dấu, chữ số, dấu gạch dưới (_) hoặc gạch ngang (-).
                    </div>
                    {fieldErrors.username && (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error-text, var(--color-error))', fontWeight: 600, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={14} color="var(--color-error-text, var(--color-error))" style={{ flexShrink: 0 }} />
                        <span>{fieldErrors.username}</span>
                      </div>
                    )}
                    {editUsernameSuggestions.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {editUsernameSuggestions.map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => {
                              setEditUsername(sug);
                              setEditUsernameSuggestions([]);
                              setFieldErrors((prev) => ({ ...prev, username: '' }));
                            }}
                            style={{
                              background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                              border: '1px solid color-mix(in srgb, var(--color-primary) 36%, transparent)',
                              color: 'var(--color-primary)',
                              borderRadius: 4,
                              padding: '2px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            @{sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Full Name Input */}
                  <div className="form-group">
                    <label className="form-label" style={{ height: 22, display: 'flex', alignItems: 'center', margin: 0, marginBottom: 8, whiteSpace: 'nowrap' }}>
                      Họ và tên đầy đủ
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      style={{
                        borderColor: fieldErrors.fullName ? 'var(--color-error)' : undefined,
                      }}
                      value={editFullName}
                      onChange={(e) => {
                        setEditFullName(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, fullName: '' }));
                      }}
                      required
                    />
                    {fieldErrors.fullName && (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error-text, var(--color-error))', fontWeight: 600, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={14} color="var(--color-error-text, var(--color-error))" style={{ flexShrink: 0 }} />
                        <span>{fieldErrors.fullName}</span>
                      </div>
                    )}
                  </div>

                  {/* Phone Number Input */}
                  <div className="form-group">
                    <label className="form-label" style={{ height: 22, display: 'flex', alignItems: 'center', margin: 0, marginBottom: 8, whiteSpace: 'nowrap' }}>
                      Số điện thoại cá nhân (chuẩn VN)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="0912 345 678"
                      style={{
                        borderColor: fieldErrors.phone ? 'var(--color-error)' : undefined,
                      }}
                      value={editPhone}
                      onChange={(e) => {
                        setEditPhone(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, phone: '' }));
                      }}
                    />
                    {fieldErrors.phone && (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error-text, var(--color-error))', fontWeight: 600, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={14} color="var(--color-error-text, var(--color-error))" style={{ flexShrink: 0 }} />
                        <span>{fieldErrors.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Emergency Contact Input */}
                  <div className="form-group">
                    <label className="form-label" style={{ height: 22, display: 'flex', alignItems: 'center', margin: 0, marginBottom: 8, whiteSpace: 'nowrap' }}>
                      Số điện thoại khẩn cấp (SOS Contact)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="0988 776 655 (Người thân)"
                      style={{
                        borderColor: fieldErrors.emergencyContact ? 'var(--color-error)' : undefined,
                      }}
                      value={editEmergency}
                      onChange={(e) => {
                        setEditEmergency(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, emergencyContact: '' }));
                      }}
                    />
                    {fieldErrors.emergencyContact && (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error-text, var(--color-error))', fontWeight: 600, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={14} color="var(--color-error-text, var(--color-error))" style={{ flexShrink: 0 }} />
                        <span>{fieldErrors.emergencyContact}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* CLEAN VISUAL CARD SELECTOR FOR PHONG CÁCH TREKKING */}
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: 10, display: 'block' }}>
                    Phong cách Trekking yêu thích (Bấm chọn phong cách của bạn)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                    {TREKKING_STYLE_OPTIONS.map((style) => {
                      const isSelected = editStyle === style.id;
                      return (
                        <div
                          key={style.id}
                          onClick={() => setEditStyle(style.id)}
                          style={{
                            background: isSelected ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-main))' : 'var(--color-bg-main)',
                            border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                            borderRadius: 4,
                            padding: '12px 14px',
                            cursor: 'pointer',
                            transition: 'border-color 0.18s ease, background-color 0.18s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-extrabold)', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                              {style.title}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                              {style.sub}
                            </div>
                          </div>
                          {isSelected && <CheckCircle2 size={18} color="var(--color-primary)" style={{ flexShrink: 0 }} />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Avatar Upload from PC & Link URL Input */}
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: 10, display: 'block' }}>
                    Ảnh Đại Diện (Avatar)
                  </label>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                    <img
                      loading="lazy"
                      decoding="async"
                      src={editAvatarUrl || getTrekkerAvatarSvg(activeProfile.fullName || activeProfile.username, activeProfile.role)}
                      alt="Preview"
                      style={{ width: 52, height: 52, borderRadius: 4, objectFit: 'cover', border: '1.5px solid var(--color-primary)', flexShrink: 0 }}
                    />

                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ fontSize: 'var(--font-size-xs)', flexShrink: 0 }}
                    >
                      <Upload size={15} /> Chọn ảnh từ máy tính
                    </button>

                    <div style={{ flex: 1, minWidth: 240 }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Hoặc dán đường dẫn ảnh URL (https://...)"
                        value={editAvatarUrl}
                        onChange={(e) => {
                          setEditAvatarUrl(e.target.value);
                          setFieldErrors((prev) => ({ ...prev, avatarUrl: '' }));
                        }}
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          borderColor: fieldErrors.avatarUrl ? 'var(--color-error)' : undefined,
                        }}
                      />
                    </div>
                  </div>
                  {fieldErrors.avatarUrl && (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error-text, var(--color-error))', fontWeight: 600, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={14} color="var(--color-error-text, var(--color-error))" style={{ flexShrink: 0 }} />
                      <span>{fieldErrors.avatarUrl}</span>
                    </div>
                  )}
                </div>

                {/* Bio Textarea */}
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>
                    Giới thiệu bản thân (Bio)
                  </label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Chia sẻ kinh nghiệm leo núi, các cung đường đã qua hoặc thông điệp của bạn..."
                    style={{
                      borderColor: fieldErrors.bio ? 'var(--color-error)' : undefined,
                    }}
                    value={editBio}
                    onChange={(e) => {
                      setEditBio(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, bio: '' }));
                    }}
                  />
                  {fieldErrors.bio && (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error-text, var(--color-error))', fontWeight: 600, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={14} color="var(--color-error-text, var(--color-error))" style={{ flexShrink: 0 }} />
                      <span>{fieldErrors.bio}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 10 }}>
                  <button type="button" className="btn btn-outline" onClick={() => !isSaving && setIsEditing(false)} disabled={isSaving}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSaving}>
                    <Save size={16} /> {isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi Thông Tin'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* GEAR LOCKER MANAGER MODAL */}
      {showGearModal &&
        createPortal(
          <div className="modal-overlay" onClick={() => setShowGearModal(false)} style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}>
            <div ref={gearModalRef} tabIndex={-1} className="modal-content" role="dialog" aria-modal="true" aria-label="Quản lý tủ đồ thiết bị sinh tồn" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Package size={20} /> Quản Lý Tủ Đồ Thiết Bị Sinh Tồn
                  </h3>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Tích chọn các trang bị dã ngoại bạn đang sở hữu ({userGear.length}/{ALL_GEAR_ITEMS.length})
                  </div>
                </div>
                <button type="button" onClick={() => setShowGearModal(false)} aria-label="Đóng" style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
                {ALL_GEAR_ITEMS.map((item) => {
                  const isOwned = userGear.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleToggleGear(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          void handleToggleGear(item.id);
                        }
                      }}
                      style={{
                        background: isOwned ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'var(--color-bg-main)',
                        border: isOwned ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                        borderRadius: 4,
                        padding: '12px 14px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease, border-color 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)', color: isOwned ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}>{item.name}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: isOwned ? 'var(--color-primary)' : 'var(--color-text-dim)', marginTop: 2 }}>
                          {isOwned ? 'Đã sở hữu' : '+ Bấm để chọn'}
                        </div>
                      </div>
                      {isOwned && <CheckCircle2 size={16} color="var(--color-primary)" style={{ flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>

              <button type="button" className="btn btn-primary" onClick={() => setShowGearModal(false)} style={{ width: '100%', marginTop: 20 }}>
                Đã Xong - Lưu Trang Bị Đã Chọn
              </button>
            </div>
          </div>,
          document.body
        )}



      {/* THREAD DETAIL MODAL */}
      {selectedThreadForModal && (
        <ThreadDetailModal
          thread={selectedThreadForModal}
          currentUser={currentUser}
          onClose={() => {
            setSelectedThreadForModal(null);
            fetch('/api/forum', { headers: getApiHeaders() })
              .then((res) => res.json())
              .then((data) => {
                if (data.success && Array.isArray(data.data)) {
                  setUserForumPosts(data.data);
                }
              })
              .catch((err) => console.error('[Profile Forum Refresh Error]:', err));
          }}
          onOpenAuthorProfile={(author) => setSelectedAuthorForModal(author)}
          onUpdateThreadUpvotes={(threadId, newUpvotes) => {
            setUserForumPosts((prev) =>
              prev.map((t) => (t.id === threadId ? { ...t, upvotes: newUpvotes } : t))
            );
          }}
          onUpdateCommentCount={(threadId, newCount) => {
            setUserForumPosts((prev) =>
              prev.map((t) => (t.id === threadId ? { ...t, repliesCount: newCount } : t))
            );
          }}
        />
      )}

      {/* AUTHOR PROFILE MODAL */}
      {selectedAuthorForModal && (
        <AuthorProfileModal
          author={selectedAuthorForModal}
          currentUser={currentUser}
          onClose={() => setSelectedAuthorForModal(null)}
          onStartChat={(targetUserId) => {
            if (targetUserId) {
              localStorage.setItem('lost_target_chat_user', targetUserId);
            }
            window.location.hash = '#messages';
          }}
        />
      )}

      {/* CUSTOM COVER PHOTO MODAL */}
      {showCoverModal && createPortal(
        <div className="modal-overlay" onClick={() => !isSavingCover && setShowCoverModal(false)} style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}>
          <div
            ref={coverModalRef}
            tabIndex={-1}
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-label="Tùy chỉnh ảnh bìa trang cá nhân"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 680,
              padding: '24px 28px',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 6,
              background: 'var(--color-bg-card)',
              boxShadow: 'var(--shadow-3d)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', color: 'var(--color-text-main)', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Camera size={20} color="var(--color-primary)" /> Tùy Chỉnh Ảnh Bìa Trang Cá Nhân
                </h3>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Tải ảnh từ máy, chọn danh thắng trekking nổi tiếng Việt Nam hoặc dán đường dẫn ảnh bất kỳ.
                </div>
              </div>
              <button
                type="button"
                disabled={isSavingCover}
                onClick={() => !isSavingCover && setShowCoverModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: isSavingCover ? 'not-allowed' : 'pointer', padding: 4, opacity: isSavingCover ? 0.5 : 1 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Live Preview Area */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                Bản Xem Trước Ảnh Bìa
              </div>
              <div
                style={{
                  height: 140,
                  borderRadius: 4,
                  overflow: 'hidden',
                  position: 'relative',
                  background: 'var(--color-bg-card)',
                  border: '2px solid var(--color-primary)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <img
                  loading="lazy"
                  decoding="async"
                  key={previewCover}
                  src={previewCover}
                  alt="Xem trước ảnh bìa"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    display: 'block',
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = DEFAULT_COVER_URL;
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(to bottom, color-mix(in srgb, var(--overlay-bg) 16%, transparent) 0%, var(--overlay-bg) 100%)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: '14px 18px',
                    pointerEvents: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 4, border: '2px solid var(--color-primary)', overflow: 'hidden', flexShrink: 0 }}>
                      <img
                        decoding="async"
                        src={activeProfile.avatarUrl || activeProfile.avatar || getTrekkerAvatarSvg(activeProfile.fullName || activeProfile.username, activeProfile.role)}
                        alt={activeProfile.fullName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: 'var(--color-on-media)', fontSize: '0.92rem' }}>{activeProfile.fullName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'color-mix(in srgb, var(--color-on-media) 78%, transparent)' }}>@{activeProfile.username || 'trekker'} • {activeProfile.role}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Option 1: Upload from local file */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                Cách 1: Tải Ảnh Lên Từ Thiết Bị
              </div>
              <button
                type="button"
                className="btn btn-outline"
                disabled={isSavingCover}
                onClick={() => coverFileInputRef.current?.click()}
                style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 'var(--font-size-sm)', borderRadius: 4 }}
              >
                <Upload size={16} color="var(--color-primary)" /> Chọn Tệp Ảnh Từ Máy Tính (PNG, JPG, WebP - Tối đa 5MB)
              </button>
              {previewCover.startsWith('data:image/') && (
                <div style={{ marginTop: 6, fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                  <Check size={14} /> Đã chọn ảnh từ máy tính (Đang xem trước ở trên)
                </div>
              )}
            </div>

            {/* Option 2: Choose from iconic Vietnam trekking presets */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                Cách 2: Chọn Từ Danh Thắng Trekking Việt Nam
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {COVER_PRESETS.map((preset) => {
                  const isSelected = previewCover === preset.url;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => {
                        setPreviewCover(preset.url);
                        setCustomCoverInput('');
                      }}
                      style={{
                        position: 'relative',
                        height: 76,
                        borderRadius: 4,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        transition: 'border-color 0.18s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.borderColor = 'var(--color-primary)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.borderColor = 'var(--color-border)';
                      }}
                    >
                      <img
                        loading="lazy"
                        decoding="async"
                        src={preset.url}
                        alt={preset.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background:
                            'linear-gradient(to top, var(--overlay-bg) 0%, color-mix(in srgb, var(--overlay-bg) 32%, transparent) 60%, transparent 100%)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-end',
                          padding: '6px 8px',
                        }}
                      >
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-on-media)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {preset.name}
                        </div>
                        <div style={{ fontSize: '0.64rem', color: 'var(--color-primary)' }}>
                          {preset.location}
                        </div>
                      </div>
                      {isSelected && (
                        <div style={{ position: 'absolute', top: 5, right: 5, background: 'var(--color-primary)', borderRadius: 3, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-on-primary)' }}>
                          <Check size={12} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Option 3: Direct URL input */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                Cách 3: Dán Đường Dẫn Ảnh (URL Trực Tiếp)
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="url"
                  className="form-input"
                  placeholder="Dán link ảnh thực địa hoặc chọn mẫu có sẵn bên trên..."
                  value={customCoverInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomCoverInput(val);
                    if (val.trim()) {
                      setPreviewCover(val.trim());
                    }
                  }}
                  style={{ flex: 1, fontSize: 'var(--font-size-xs)' }}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    if (customCoverInput.trim()) {
                      setPreviewCover(customCoverInput.trim());
                      if (onShowToast) onShowToast('Đã áp dụng link ảnh vào bản xem trước!', 'info');
                    }
                  }}
                  style={{ padding: '0 14px', fontSize: 'var(--font-size-xs)' }}
                >
                  Xem Thử Link
                </button>
              </div>
            </div>

            {/* Action Buttons Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: 16, flexWrap: 'wrap', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={isSavingCover}
                onClick={() => {
                  setPreviewCover(DEFAULT_COVER_URL);
                  void handleApplyCover(DEFAULT_COVER_URL);
                }}
                style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}
              >
                Khôi Phục Mặc Định
              </button>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={isSavingCover}
                  onClick={() => setShowCoverModal(false)}
                  style={{ padding: '8px 18px', fontSize: 'var(--font-size-sm)' }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isSavingCover}
                  onClick={() => void handleApplyCover(previewCover)}
                  style={{ padding: '8px 22px', fontSize: 'var(--font-size-sm)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Save size={16} /> {isSavingCover ? 'Đang lưu ảnh bìa...' : 'Lưu & Áp Dụng Ảnh Bìa'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 3. Full-Screen Photo Lightbox Modal */}
      {fullViewImage && createPortal(
        <div
          ref={lightboxModalRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`Xem toàn màn hình ${fullViewImage.title}`}
          onClick={() => setFullViewImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 'var(--z-lightbox, 4000)' as unknown as number,
            background: 'var(--overlay-bg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {/* Top Bar with Title & Actions */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 1100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
              padding: '10px 16px',
              borderRadius: 6,
              background: 'var(--overlay-bg)',
              border: '1px solid color-mix(in srgb, var(--color-on-media) 18%, transparent)',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 4,
                  background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
                  border: '1px solid var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary)',
                }}
              >
                {fullViewImage.type === 'cover' ? <Camera size={18} /> : <User size={18} />}
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-on-media)' }}>
                  {fullViewImage.title}
                </div>
                {fullViewImage.subtitle && (
                  <div style={{ fontSize: '0.74rem', color: 'color-mix(in srgb, var(--color-on-media) 78%, transparent)' }}>
                    {fullViewImage.subtitle}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {fullViewImage.type === 'cover' && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setFullViewImage(null);
                    setPreviewCover(customCoverUrl);
                    setCustomCoverInput('');
                    setShowCoverModal(true);
                  }}
                  style={{ fontSize: '0.76rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-on-media)', borderColor: 'color-mix(in srgb, var(--color-on-media) 28%, transparent)' }}
                >
                  <Camera size={14} color="var(--color-primary)" /> Đổi Ảnh Bìa
                </button>
              )}
              {fullViewImage.type === 'avatar' && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setFullViewImage(null);
                    fileInputRef.current?.click();
                  }}
                  style={{ fontSize: '0.76rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-on-media)', borderColor: 'color-mix(in srgb, var(--color-on-media) 28%, transparent)' }}
                >
                  <Upload size={14} color="var(--color-primary)" /> Đổi Ảnh Đại Diện
                </button>
              )}
              {!fullViewImage.url.startsWith('data:') && (
                <a
                  href={fullViewImage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                  style={{ fontSize: '0.76rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-on-media)', borderColor: 'color-mix(in srgb, var(--color-on-media) 28%, transparent)', textDecoration: 'none' }}
                  title="Mở ảnh gốc trong tab mới"
                >
                  <ExternalLink size={14} /> Mở Ảnh Gốc
                </a>
              )}
              <button
                type="button"
                onClick={() => setFullViewImage(null)}
                title="Đóng (Phím Esc)"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 4,
                  background: 'color-mix(in srgb, var(--color-on-media) 10%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-on-media) 24%, transparent)',
                  color: 'var(--color-on-media)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease, border-color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-error)';
                  e.currentTarget.style.borderColor = 'var(--color-error)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'color-mix(in srgb, var(--color-on-media) 10%, transparent)';
                  e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--color-on-media) 24%, transparent)';
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Full Image Container */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 'min(94vw, 1100px)',
              maxHeight: 'calc(86vh - 80px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              borderRadius: 6,
              overflow: 'hidden',
              boxShadow: 'var(--shadow-3d)',
              border: '1px solid color-mix(in srgb, var(--color-on-media) 18%, transparent)',
              background: 'var(--color-bg-main)',
            }}
          >
            <img
              loading="lazy"
              decoding="async"
              src={fullViewImage.url}
              alt={fullViewImage.title}
              style={{
                maxWidth: '100%',
                maxHeight: 'calc(86vh - 80px)',
                objectFit: 'contain',
                display: 'block',
                borderRadius: 6,
              }}
            />
          </div>

          {/* Bottom Hint */}
          <div
            style={{
              marginTop: 12,
              fontSize: '0.74rem',
              color: 'color-mix(in srgb, var(--color-on-media) 72%, transparent)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>Nhấn phím <strong>ESC</strong> hoặc bấm ra ngoài khoảng tối để đóng xem trọn vẹn</span>
          </div>
        </div>,
        document.body
      )}

      {/* FOLLOWERS & FOLLOWING GRAPH MODAL */}
      {followModalTab &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => setFollowModalTab(null)}
            style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}
          >
            <div
              ref={followModalRef}
              tabIndex={-1}
              className="modal-content"
              role="dialog"
              aria-modal="true"
              aria-label="Danh sách người theo dõi và đang theo dõi"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 500, display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UsersIcon size={18} color="var(--color-sky)" /> Kết Nối Cộng Đồng
                </h3>
                <button
                  type="button"
                  onClick={() => setFollowModalTab(null)}
                  aria-label="Đóng"
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div role="tablist" style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={followModalTab === 'followers'}
                  onClick={() => openFollowModal('followers')}
                  className={followModalTab === 'followers' ? 'btn btn-primary' : 'btn btn-outline'}
                  style={{ flex: 1, fontSize: '0.78rem', padding: '6px 10px', fontVariantNumeric: 'tabular-nums' }}
                >
                  Người theo dõi ({profileStats.followersCount})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={followModalTab === 'following'}
                  onClick={() => openFollowModal('following')}
                  className={followModalTab === 'following' ? 'btn btn-primary' : 'btn btn-outline'}
                  style={{ flex: 1, fontSize: '0.78rem', padding: '6px 10px', fontVariantNumeric: 'tabular-nums' }}
                >
                  Đang theo dõi ({profileStats.followingCount})
                </button>
              </div>

              <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                {followModalLoading ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                    Đang tải danh sách thành viên...
                  </div>
                ) : followModalList.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', background: 'var(--color-bg-main)', borderRadius: 4, border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                    {followModalTab === 'followers'
                      ? 'Chưa có thành viên nào theo dõi bạn.'
                      : 'Bạn chưa theo dõi thành viên nào.'}
                  </div>
                ) : (
                  followModalList.map((member) => {
                    const isSelf =
                      member._id === String((activeProfile as UserWithMongoId)._id || activeProfile.id || '');
                    const isToggling = togglingFollowIds.has(member._id);
                    const memberName = member.fullName || member.username || 'Trekker';
                    const memberAvatar = member.avatarUrl || getTrekkerAvatarSvg(memberName);
                    return (
                      <div
                        key={member._id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '9px 12px',
                          borderRadius: 4,
                          background: 'var(--color-bg-main)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setFollowModalTab(null);
                            setSelectedAuthorForModal({
                              name: memberName,
                              avatar: memberAvatar,
                              userId: member._id,
                            });
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            textAlign: 'left',
                            cursor: 'pointer',
                            flex: 1,
                            minWidth: 0,
                            fontFamily: 'var(--font-family)',
                          }}
                        >
                          <img
                            loading="lazy"
                            decoding="async"
                            src={memberAvatar}
                            alt={memberName}
                            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--color-border)' }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {memberName}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                              @{member.username || 'trekker'} · {Number(member.reputationScore || 0)} pts
                            </div>
                          </div>
                        </button>

                        {!isSelf && (
                          <button
                            type="button"
                            className={member.isFollowingByMe ? 'btn btn-outline' : 'btn btn-primary'}
                            disabled={isToggling}
                            onClick={() => void handleToggleFollowMember(member)}
                            style={{ padding: '4px 10px', fontSize: '0.72rem', flexShrink: 0 }}
                          >
                            {isToggling ? '...' : member.isFollowingByMe ? 'Đang theo dõi' : 'Theo dõi'}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* CHANGE PASSWORD MODAL */}
      {showChangePasswordModal &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => !isChangingPassword && setShowChangePasswordModal(false)}
            style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}
          >
            <div
              ref={changePasswordModalRef}
              tabIndex={-1}
              className="modal-content"
              role="dialog"
              aria-modal="true"
              aria-label="Đổi mật khẩu tài khoản"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 450 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-primary)', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <KeyRoundIcon size={18} /> Đổi Mật Khẩu Tài Khoản
                </h3>
                <button
                  type="button"
                  disabled={isChangingPassword}
                  onClick={() => !isChangingPassword && setShowChangePasswordModal(false)}
                  aria-label="Đóng"
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: isChangingPassword ? 'not-allowed' : 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleChangePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {cpError && (
                  <div
                    role="alert"
                    style={{
                      background: 'color-mix(in srgb, var(--color-error) 12%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--color-error) 42%, transparent)',
                      color: 'var(--color-error-text, var(--color-error))',
                      padding: '8px 12px',
                      borderRadius: 4,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 7,
                    }}
                  >
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{cpError}</span>
                  </div>
                )}

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 5, fontSize: '0.78rem' }}>
                    Mật khẩu hiện tại
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={cpShowCurrent ? 'text' : 'password'}
                      className="form-input"
                      autoComplete="current-password"
                      placeholder="Nhập mật khẩu hiện tại"
                      value={cpCurrentPassword}
                      onChange={(e) => setCpCurrentPassword(e.target.value)}
                      style={{ width: '100%', paddingRight: 36 }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setCpShowCurrent((prev) => !prev)}
                      aria-label={cpShowCurrent ? 'Ẩn mật khẩu hiện tại' : 'Hiện mật khẩu hiện tại'}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-dim)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {cpShowCurrent ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 5, fontSize: '0.78rem' }}>
                    Mật khẩu mới
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={cpShowNew ? 'text' : 'password'}
                      className="form-input"
                      autoComplete="new-password"
                      placeholder="Tối thiểu 8 ký tự (A-Z, a-z, 0-9)"
                      value={cpNewPassword}
                      onChange={(e) => setCpNewPassword(e.target.value)}
                      style={{ width: '100%', paddingRight: 36 }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setCpShowNew((prev) => !prev)}
                      aria-label={cpShowNew ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-dim)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {cpShowNew ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 5, fontSize: '0.78rem' }}>
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    type={cpShowNew ? 'text' : 'password'}
                    className="form-input"
                    autoComplete="new-password"
                    placeholder="Nhập lại mật khẩu mới"
                    value={cpConfirmPassword}
                    onChange={(e) => setCpConfirmPassword(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  />
                </div>

                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
                  Sau khi đổi mật khẩu, tất cả phiên đăng nhập cũ trên các thiết bị khác sẽ tự động bị đăng xuất.
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={isChangingPassword}
                    onClick={() => setShowChangePasswordModal(false)}
                  >
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isChangingPassword}>
                    <Save size={15} /> {isChangingPassword ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* DELETE ACCOUNT PERMANENT CONFIRMATION MODAL */}
      {showDeleteAccountModal &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => !isDeletingAccount && setShowDeleteAccountModal(false)}
            style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}
          >
            <div
              ref={deleteAccountModalRef}
              tabIndex={-1}
              className="modal-content"
              role="alertdialog"
              aria-modal="true"
              aria-label="Xác nhận xóa vĩnh viễn tài khoản"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 460, border: '1.5px solid var(--color-error)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-error-text, var(--color-error))', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrashIcon size={18} /> Xóa Tài Khoản Vĩnh Viễn
                </h3>
                <button
                  type="button"
                  disabled={isDeletingAccount}
                  onClick={() => !isDeletingAccount && setShowDeleteAccountModal(false)}
                  aria-label="Đóng"
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: isDeletingAccount ? 'not-allowed' : 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div
                style={{
                  background: 'color-mix(in srgb, var(--color-error) 10%, var(--color-bg-main))',
                  border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
                  borderRadius: 4,
                  padding: '10px 12px',
                  fontSize: '0.78rem',
                  color: 'var(--color-text-main)',
                  lineHeight: 1.5,
                  marginBottom: 14,
                }}
              >
                Hành động này sẽ <strong>xóa vĩnh viễn</strong> tài khoản <strong>{activeProfile.email}</strong>, nhật ký check-in đỉnh, danh sách cung đã lưu, bộ hẹn giờ an toàn và thu hồi toàn bộ phiên đăng nhập. Thao tác <strong>không thể hoàn tác</strong>.
              </div>

              <form onSubmit={handleDeleteAccountSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {delError && (
                  <div
                    role="alert"
                    style={{
                      background: 'color-mix(in srgb, var(--color-error) 12%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--color-error) 42%, transparent)',
                      color: 'var(--color-error-text, var(--color-error))',
                      padding: '8px 12px',
                      borderRadius: 4,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 7,
                    }}
                  >
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{delError}</span>
                  </div>
                )}

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 5, fontSize: '0.78rem' }}>
                    Nhập chính xác cụm từ <strong style={{ color: 'var(--color-error-text, var(--color-error))' }}>XÓA TÀI KHOẢN</strong> để xác nhận:
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="XÓA TÀI KHOẢN"
                    value={delConfirmText}
                    onChange={(e) => setDelConfirmText(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  />
                </div>

                {activeProfile.authProvider !== 'google' && (
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: 5, fontSize: '0.78rem' }}>
                      Mật khẩu hiện tại
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={delShowPassword ? 'text' : 'password'}
                        className="form-input"
                        autoComplete="current-password"
                        placeholder="Nhập mật khẩu để xác nhận"
                        value={delPassword}
                        onChange={(e) => setDelPassword(e.target.value)}
                        style={{ width: '100%', paddingRight: 36 }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setDelShowPassword((prev) => !prev)}
                        aria-label={delShowPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        style={{
                          position: 'absolute',
                          right: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-text-dim)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {delShowPassword ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={isDeletingAccount}
                    onClick={() => setShowDeleteAccountModal(false)}
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="btn btn-danger"
                    disabled={isDeletingAccount || delConfirmText.trim().normalize('NFC') !== 'XÓA TÀI KHOẢN'}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <TrashIcon size={15} /> {isDeletingAccount ? 'Đang xóa...' : 'Xác Nhận Xóa Vĩnh Viễn'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
