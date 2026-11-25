import React from 'react';
import { createPortal } from 'react-dom';
import type { UserProfile } from '../../types.js';
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconShieldCheck,
  IconX,
} from '../common/SvgIcons.js';
import type { CockpitGpxTrackPoint } from './adminCockpitTypes.js';

const DEFAULT_TRAIL_COVER = '/covers/trail-fansipan.svg';
const DEFAULT_AVATAR = '/covers/avatar-default.svg';

export type ValidRegion = 'Miền Bắc' | 'Miền Trung' | 'Miền Nam';

export type EntityRef = string | { _id?: string; id?: string } | null | undefined;

export interface NearbyTrailMatchInfo {
  trailName: string;
  distanceKm: number;
}

export interface AdminContributionItem {
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
  gpxTrack?: CockpitGpxTrackPoint[];
}

export interface AdminAuthorModalState {
  name?: string;
  email?: string;
  avatar?: string;
  userId?: string;
  hasUserDetails?: boolean;
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

export interface AdminTrailItem {
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
  gpxTrack?: CockpitGpxTrackPoint[];
}

export interface TrailFormState {
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

export interface AdminUserItem {
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

export interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  reasonInputLabel?: string;
  reasonPlaceholder?: string;
  defaultReason?: string;
  onConfirm: (reason?: string) => Promise<void> | void;
}

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

const XCircleIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 16,
  color = 'currentColor',
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
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

/* ============================================================================
 * 1. CONTRIBUTION DETAIL INSPECTION MODAL
 * ============================================================================ */
export interface ContributionDetailModalProps {
  contribution: AdminContributionItem | null;
  contributions: AdminContributionItem[];
  usersList: AdminUserItem[];
  currentUser?: (UserProfile & { _id?: string }) | null;
  nearbyTrailMatch: NearbyTrailMatchInfo | null;
  busyActions: Record<string, boolean>;
  dialogRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onOpenAuthorModal: (author: AdminAuthorModalState) => void;
  onApprove: (id: string, name: string) => void | Promise<void>;
  onReject: (id: string, name: string) => void | Promise<void>;
}

export const ContributionDetailModal: React.FC<ContributionDetailModalProps> = ({
  contribution,
  contributions,
  usersList,
  currentUser,
  nearbyTrailMatch,
  busyActions,
  dialogRef,
  onClose,
  onOpenAuthorModal,
  onApprove,
  onReject,
}) => {
  if (!contribution || typeof document === 'undefined') return null;

  const liveContrib =
    contributions.find(
      (c) => c.id === contribution.id || c._id === contribution._id
    ) || contribution;
  const contribUserId = extractEntityId(liveContrib.userId);
  const populatedUser =
    liveContrib.userId && typeof liveContrib.userId === 'object'
      ? (liveContrib.userId as Partial<AdminUserItem>)
      : null;
  const matchedUser =
    usersList.find(
      (u) =>
        (contribUserId &&
          (String(u._id || '') === contribUserId || String(u.id || '') === contribUserId)) ||
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
        populatedUser?.fullName ||
        populatedUser?.name ||
        liveContrib.authorName ||
        'Thành viên đóng góp';

  const displayAuthorEmail =
    liveContrib.authorEmail ||
    matchedUser?.email ||
    populatedUser?.email ||
    'Chưa cập nhật email';

  const displayAuthorAvatar =
    liveContrib.authorAvatar ||
    matchedUser?.avatarUrl ||
    matchedUser?.avatar ||
    populatedUser?.avatarUrl ||
    DEFAULT_AVATAR;

  const handleOpenAuthorProfile = () => {
    const authorContribs = contributions.filter(
      (c) =>
        (contribUserId && extractEntityId(c.userId) === contribUserId) ||
        (c.authorEmail &&
          displayAuthorEmail &&
          displayAuthorEmail !== 'Chưa cập nhật email' &&
          c.authorEmail.toLowerCase() === displayAuthorEmail.toLowerCase()) ||
        (c.authorName &&
          displayAuthorName &&
          c.authorName.toLowerCase() === displayAuthorName.toLowerCase())
    );

    const approvedCount = authorContribs.filter((c) => c.status === 'approved').length;
    const pendingCount = authorContribs.filter((c) => c.status === 'pending').length;
    const realId = String(matchedUser?._id || matchedUser?.id || contribUserId || '').trim();
    const hasUserDetails = Boolean(matchedUser);

    onOpenAuthorModal({
      userId: realId,
      hasUserDetails,
      name: displayAuthorName,
      email: displayAuthorEmail,
      avatar: displayAuthorAvatar,
      date: liveContrib.createdAt || 'Chưa ghi nhận',
      contribCount: authorContribs.length || 1,
      approvedCount,
      pendingCount,
      authorContribs,
      reputationScore: hasUserDetails ? Number(matchedUser?.reputationScore ?? 0) : undefined,
      role: hasUserDetails ? matchedUser?.role || 'user' : undefined,
      authProvider: hasUserDetails
        ? matchedUser?.authProvider === 'google'
          ? 'Google OAuth 2.0'
          : 'Email / OTP'
        : undefined,
      isVerified: hasUserDetails
        ? Boolean(matchedUser?.isEmailVerified || matchedUser?.authProvider === 'google')
        : undefined,
      expeditionId: realId ? `LS-${realId.slice(-6).toUpperCase()}` : 'Chưa có mã định danh',
    });
  };

  const targetId = contribution.id || contribution._id || '';

  return createPortal(
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}
    >
      <div
        ref={dialogRef}
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
              Bài đóng góp #<code>{contribution.id || contribution._id}</code>
            </span>
            <h3
              style={{
                fontSize: '1.35rem',
                color: 'var(--color-text-main)',
                fontWeight: 800,
                margin: '4px 0 0 0',
              }}
            >
              {contribution.name || 'Cung đường mới'}
            </h3>
          </div>
          <span
            style={{
              background:
                contribution.status === 'approved'
                  ? 'var(--color-primary)'
                  : contribution.status === 'rejected'
                    ? 'var(--color-error)'
                    : 'var(--color-earth)',
              color:
                contribution.status === 'rejected'
                  ? 'var(--color-on-danger)'
                  : 'var(--color-on-primary)',
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '5px 12px',
              borderRadius: 4,
            }}
          >
            {contribution.status === 'approved'
              ? 'Đã duyệt & công khai'
              : contribution.status === 'rejected'
                ? 'Đã từ chối'
                : 'Chờ duyệt'}
          </span>
        </div>

        {contribution.coverImage && (
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
              src={contribution.coverImage}
              alt={contribution.name}
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
            1. Địa điểm &amp; vùng miền
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
              · <strong>Vùng miền:</strong> {contribution.region || 'Chưa cập nhật'}
            </div>
            <div>
              · <strong>Tỉnh / Thành:</strong> {contribution.province || 'Chưa cập nhật'}
            </div>
            <div>
              · <strong>Quận / Huyện / Xã:</strong> {contribution.district || 'Chưa cập nhật'}
            </div>
            <div>
              · <strong>Thôn / Cửa rừng:</strong> {contribution.hamlet || 'Chưa nhập'}
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
            2. Thông số cung đường
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
                {contribution.distanceKm} km
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
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Độ cao tích lũy</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-sky)', marginTop: 2 }}>
                +{contribution.elevationGainM} m
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
                {contribution.maxAltitudeM} m
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
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-earth)', marginTop: 2 }}>
                {contribution.difficultyLevel}/5
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
                {contribution.durationHoursNote || '1 ngày'}
              </div>
            </div>
          </div>
        </div>

        {/* DUPLICATE PEAK GUARD (2km Haversine) */}
        {nearbyTrailMatch && (
          <div
            className="admin-note-box admin-note-box--warn"
            role="alert"
            style={{ marginBottom: 16 }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
                marginBottom: 4,
              }}
            >
              <span className="admin-tag admin-tag--warn">
                <IconAlertTriangle size={12} />
                <span>
                  {`Gần tuyến ${nearbyTrailMatch.trailName} (~${nearbyTrailMatch.distanceKm.toFixed(1)} km) — kiểm tra trùng lặp`}
                </span>
              </span>
            </div>
            <span>
              Tọa độ điểm xuất phát nằm trong bán kính 2 km quanh cung đường đã công khai trên LOST. Hãy kiểm tra kỹ trước khi duyệt để tránh xuất bản đỉnh trùng lặp.
            </span>
          </div>
        )}

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
            3. Tọa độ GPS trên bản đồ
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
              <strong style={{ color: 'var(--color-primary)' }}>· Điểm xuất phát:</strong>
              <div style={{ marginTop: 4 }}>
                <code>
                  Lat: {contribution.startLat}, Lng: {contribution.startLng}
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
              <strong style={{ color: 'var(--color-error-text, var(--color-error))' }}>· Điểm kết thúc:</strong>
              <div style={{ marginTop: 4 }}>
                <code>
                  Lat: {contribution.endLat}, Lng: {contribution.endLng}
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
            4. Mô tả &amp; hướng dẫn di chuyển
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
              {contribution.description || 'Chưa nhập nội dung mô tả.'}
            </p>
          </div>

          {contribution.transportationInfo && (
            <div>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--color-text-main)',
                  marginBottom: 4,
                }}
              >
                Hướng dẫn di chuyển &amp; phương tiện:
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
                {contribution.transportationInfo}
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
            5. Giấy phép &amp; tiện ích
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
              {contribution.permitRequired
                ? contribution.permitInfo || 'Cần xin giấy phép'
                : 'Không cần giấy phép'}
            </div>
            <div>
              · <strong>Bãi cắm trại:</strong>{' '}
              {contribution.hasCampsite ? 'Có bãi cắm trại' : 'Không có'}
            </div>
            <div>
              · <strong>Nguồn nước:</strong>{' '}
              {contribution.hasWaterSource ? 'Có nguồn nước' : 'Không có'}
            </div>
            <div>
              · <strong>Trẻ em:</strong>{' '}
              {contribution.kidFriendly ? 'Phù hợp cho trẻ em' : 'Không phù hợp'}
            </div>
          </div>
        </div>

        {/* SECTION 6: Thành viên đóng góp */}
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
              6. Người đóng góp
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-sky)', fontWeight: 700 }}>
              Nhấn vào thẻ để xem chi tiết thành viên
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
                  <IconShieldCheck size={11} /> Thành viên đóng góp
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
            onClick={onClose}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Đóng
          </button>

          {contribution.status === 'pending' && (
            <button
              type="button"
              className="btn btn-outline"
              disabled={Boolean(busyActions[`reject:${targetId}`])}
              onClick={() => void onReject(targetId, contribution.name || '')}
              style={{
                flex: 1,
                justifyContent: 'center',
                color: 'var(--color-earth)',
                borderColor: 'color-mix(in srgb, var(--color-earth) 45%, transparent)',
                gap: 6,
              }}
            >
              <XCircleIcon size={16} /> Từ chối
            </button>
          )}

          {contribution.status !== 'approved' && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={Boolean(busyActions[`approve:${targetId}`])}
              onClick={() => void onApprove(targetId, contribution.name || '')}
              style={{ flex: 1.5, justifyContent: 'center', gap: 6 }}
            >
              <IconCheckCircle size={16} /> Duyệt và đưa lên bản đồ
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ============================================================================
 * 2. MEMBER PROFILE DOSSIER MODAL (NESTED OVERLAY --z-modal-nested)
 * ============================================================================ */
export interface AdminAuthorModalProps {
  author: AdminAuthorModalState | null;
  dialogRef: React.RefObject<HTMLDivElement | null>;
  getRoleLabel: (role?: string) => string;
  onMessageAuthor: (userId: string) => void;
  onClose: () => void;
}

export const AdminAuthorModal: React.FC<AdminAuthorModalProps> = ({
  author,
  dialogRef,
  getRoleLabel,
  onMessageAuthor,
  onClose,
}) => {
  if (!author || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ zIndex: 'var(--z-modal-nested, 3100)' as unknown as number }}
    >
      <div
        ref={dialogRef}
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
            <IconShieldCheck size={20} /> Hồ sơ thành viên
          </div>
          <button
            type="button"
            onClick={onClose}
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
              src={author.avatar}
              alt={author.name}
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
                  {author.name}
                </span>
                {author.hasUserDetails ? (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: author.isVerified ? 'var(--color-primary)' : 'var(--color-earth)',
                      color: 'var(--color-on-primary)',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <IconShieldCheck size={11} />{' '}
                    {author.isVerified ? 'Đã xác thực' : 'Chưa xác thực'}
                  </span>
                ) : (
                  <span className="admin-tag admin-tag--info">
                    Thông tin hồ sơ giới hạn
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--color-primary)',
                  fontWeight: 800,
                  marginTop: 4,
                }}
              >
                Mã thành viên: {author.expeditionId}
                {author.hasUserDetails && author.role
                  ? ` · Vai trò: ${getRoleLabel(author.role)}`
                  : ''}
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
              {author.email}
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
              Số bài đóng góp
            </div>
            <div
              style={{
                fontSize: '0.88rem',
                fontWeight: 900,
                color: 'var(--color-text-main)',
                marginTop: 2,
              }}
            >
              {author.contribCount} bài ({author.approvedCount} đã duyệt)
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
              Điểm uy tín
            </div>
            <div
              style={{
                fontSize: '0.88rem',
                fontWeight: 900,
                color: author.hasUserDetails ? 'var(--color-primary)' : 'var(--color-text-muted)',
                marginTop: 2,
              }}
            >
              {author.hasUserDetails && typeof author.reputationScore === 'number'
                ? `${author.reputationScore} điểm`
                : 'Chỉ hiển thị cho quản trị viên'}
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
              Phương thức đăng nhập
            </div>
            <div
              style={{
                fontSize: '0.82rem',
                fontWeight: 800,
                color: author.hasUserDetails ? 'var(--color-sky)' : 'var(--color-text-muted)',
                marginTop: 2,
              }}
            >
              {author.hasUserDetails && author.authProvider
                ? author.authProvider
                : 'Chỉ hiển thị cho quản trị viên'}
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
          {author.userId && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onMessageAuthor(author.userId || '')}
              style={{
                flex: 1,
                justifyContent: 'center',
                padding: '10px 16px',
                fontSize: '0.85rem',
                fontWeight: 800,
              }}
            >
              Nhắn tin trực tiếp
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
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
  );
};

/* ============================================================================
 * 3. EXPANDED INLINE EDIT TRAIL MODAL (ALL BACKEND EDITABLE FIELDS — ADMIN ONLY)
 * ============================================================================ */
export interface EditTrailModalProps {
  trail: AdminTrailItem | null;
  isStrictAdmin: boolean;
  form: TrailFormState;
  isSaving: boolean;
  dialogRef: React.RefObject<HTMLDivElement | null>;
  onChangeForm: (next: TrailFormState) => void;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  onClose: () => void;
}

export const EditTrailModal: React.FC<EditTrailModalProps> = ({
  trail,
  isStrictAdmin,
  form,
  isSaving,
  dialogRef,
  onChangeForm,
  onSubmit,
  onClose,
}) => {
  if (!trail || !isStrictAdmin || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={() => !isSaving && onClose()}
      style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}
    >
      <div
        ref={dialogRef}
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
            Chỉnh sửa cung đường: {trail.name}
          </h3>
          <button
            type="button"
            onClick={() => !isSaving && onClose()}
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
          onSubmit={onSubmit}
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
            1. Tên tuyến &amp; địa danh
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
                value={form.name}
                onChange={(e) => onChangeForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tên gọi khác (cách nhau bằng dấu phẩy)</label>
              <input
                className="form-input"
                placeholder="VD: Bạch Mộc Lương Tử, Ky Quan San"
                value={form.altNames}
                onChange={(e) => onChangeForm({ ...form, altNames: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tỉnh / Thành phố *</label>
              <input
                className="form-input"
                value={form.province}
                onChange={(e) => onChangeForm({ ...form, province: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Quận / Huyện / Thị xã</label>
              <input
                className="form-input"
                value={form.district}
                onChange={(e) => onChangeForm({ ...form, district: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Vùng miền *</label>
              <select
                className="form-select"
                value={form.region}
                onChange={(e) =>
                  onChangeForm({
                    ...form,
                    region: normalizeRegion(e.target.value),
                  })
                }
              >
                <option value="Miền Bắc">Miền Bắc</option>
                <option value="Miền Trung">Miền Trung &amp; Tây Nguyên</option>
                <option value="Miền Nam">Miền Nam</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Trạng thái hiển thị</label>
              <select
                className="form-select"
                value={form.status}
                onChange={(e) =>
                  onChangeForm({
                    ...form,
                    status:
                      e.target.value === 'pending' || e.target.value === 'rejected'
                        ? e.target.value
                        : 'approved',
                  })
                }
              >
                <option value="approved">Đã duyệt (công khai)</option>
                <option value="pending">Chờ duyệt (ẩn)</option>
                <option value="rejected">Từ chối</option>
              </select>
            </div>
          </div>

          {form.status !== 'approved' && (
            <div className="admin-note-box admin-note-box--warn">
              <strong>Lưu ý:</strong> Chuyển trạng thái sang{' '}
              <strong>{form.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt (ẩn)'}</strong>{' '}
              sẽ gỡ cung đường khỏi danh mục công khai. Sau khi lưu, cung đường sẽ hiển thị trong mục{' '}
              <strong>&ldquo;Vừa ẩn khỏi danh mục công khai&rdquo;</strong> trong phiên này để bạn dễ
              theo dõi hoặc công khai lại.
            </div>
          )}

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
            2. Thông số &amp; mùa đẹp
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
                value={form.distanceKm}
                onChange={(e) => onChangeForm({ ...form, distanceKm: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Độ cao tích lũy (m) *</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={form.elevationGainM}
                onChange={(e) => onChangeForm({ ...form, elevationGainM: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Độ cao đỉnh (m) *</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={form.maxAltitudeM}
                onChange={(e) => onChangeForm({ ...form, maxAltitudeM: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Số ngày</label>
              <input
                type="number"
                min="1"
                max="30"
                className="form-input"
                value={form.durationDays}
                onChange={(e) => onChangeForm({ ...form, durationDays: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ghi chú thời lượng</label>
              <input
                className="form-input"
                placeholder="VD: 2 ngày 1 đêm"
                value={form.durationHoursNote}
                onChange={(e) => onChangeForm({ ...form, durationHoursNote: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Độ khó (1 - 5) *</label>
              <input
                type="number"
                min="1"
                max="5"
                className="form-input"
                value={form.difficultyLevel}
                onChange={(e) => onChangeForm({ ...form, difficultyLevel: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tháng đẹp nhất (1–12)</label>
              <input
                className="form-input"
                placeholder="VD: 10, 11, 12, 1, 2, 3"
                value={form.bestMonths}
                onChange={(e) => onChangeForm({ ...form, bestMonths: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tháng nên tránh (1–12)</label>
              <input
                className="form-input"
                placeholder="VD: 6, 7, 8"
                value={form.avoidMonths}
                onChange={(e) => onChangeForm({ ...form, avoidMonths: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Ghi chú độ khó thực tế</label>
            <input
              className="form-input"
              placeholder="VD: Dốc đứng kéo dài, nhiều đoạn bám rễ cây trơn trượt khi mưa"
              value={form.difficultyNote}
              onChange={(e) => onChangeForm({ ...form, difficultyNote: e.target.value })}
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
            3. Tọa độ GPS &amp; ảnh bìa
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
            }}
          >
            <div className="form-group">
              <label className="form-label">Vĩ độ xuất phát</label>
              <input
                type="number"
                step="any"
                className="form-input"
                value={form.startLat}
                onChange={(e) => onChangeForm({ ...form, startLat: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Kinh độ xuất phát</label>
              <input
                type="number"
                step="any"
                className="form-input"
                value={form.startLng}
                onChange={(e) => onChangeForm({ ...form, startLng: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Vĩ độ đích</label>
              <input
                type="number"
                step="any"
                className="form-input"
                value={form.endLat}
                onChange={(e) => onChangeForm({ ...form, endLat: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Kinh độ đích</label>
              <input
                type="number"
                step="any"
                className="form-input"
                value={form.endLng}
                onChange={(e) => onChangeForm({ ...form, endLng: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Đường dẫn ảnh bìa</label>
            <input
              className="form-input"
              placeholder="/covers/trail-fansipan.svg hoặc URL ảnh tuyến"
              value={form.coverImage}
              onChange={(e) => onChangeForm({ ...form, coverImage: e.target.value })}
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
            4. Mô tả, di chuyển, cứu hộ &amp; tiện ích
          </div>
          <div className="form-group">
            <label className="form-label">Mô tả cung đường</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={form.description}
              onChange={(e) => onChangeForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Hướng dẫn di chuyển tới cửa rừng</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={form.transportationInfo}
              onChange={(e) => onChangeForm({ ...form, transportationInfo: e.target.value })}
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
              <label className="form-label">Đầu mối cứu hộ / kiểm lâm</label>
              <input
                className="form-input"
                placeholder="VD: Trạm Kiểm lâm VQG Hoàng Liên"
                value={form.rescueContactName}
                onChange={(e) => onChangeForm({ ...form, rescueContactName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">SĐT cứu hộ khẩn cấp</label>
              <input
                className="form-input"
                placeholder="VD: 112 / 114"
                value={form.rescueContactPhone}
                onChange={(e) => onChangeForm({ ...form, rescueContactPhone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Liên hệ kiểm lâm bổ sung</label>
              <input
                className="form-input"
                placeholder="VD: 02143.871.494 (Kiểm lâm VQG)"
                value={form.rescueContactRanger}
                onChange={(e) => onChangeForm({ ...form, rescueContactRanger: e.target.value })}
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
                checked={form.permitRequired}
                onChange={(e) => onChangeForm({ ...form, permitRequired: e.target.checked })}
              />
              Yêu cầu giấy phép VQG / kiểm lâm
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
                checked={form.hasCampsite}
                onChange={(e) => onChangeForm({ ...form, hasCampsite: e.target.checked })}
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
                checked={form.hasWaterSource}
                onChange={(e) => onChangeForm({ ...form, hasWaterSource: e.target.checked })}
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
                checked={form.kidFriendly}
                onChange={(e) => onChangeForm({ ...form, kidFriendly: e.target.checked })}
              />
              Phù hợp cho trẻ em
            </label>
          </div>

          {form.permitRequired && (
            <div className="form-group">
              <label className="form-label">Thông tin thủ tục cấp phép</label>
              <input
                className="form-input"
                value={form.permitInfo}
                onChange={(e) => onChangeForm({ ...form, permitInfo: e.target.value })}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={isSaving}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

/* ============================================================================
 * 4. DIRECT CREATE VERIFIED TRAIL MODAL (POST /api/admin/trails — ADMIN ONLY)
 * ============================================================================ */
export interface CreateTrailModalProps {
  isOpen: boolean;
  isStrictAdmin: boolean;
  form: TrailFormState;
  isCreating: boolean;
  dialogRef: React.RefObject<HTMLDivElement | null>;
  onChangeForm: (next: TrailFormState) => void;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  onOpenContributeWizard: () => void;
  onClose: () => void;
}

export const CreateTrailModal: React.FC<CreateTrailModalProps> = ({
  isOpen,
  isStrictAdmin,
  form,
  isCreating,
  dialogRef,
  onChangeForm,
  onSubmit,
  onOpenContributeWizard,
  onClose,
}) => {
  if (!isOpen || !isStrictAdmin || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={() => !isCreating && onClose()}
      style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}
    >
      <div
        ref={dialogRef}
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
              Thêm cung đường mới
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', margin: '3px 0 0 0' }}>
              Đăng trực tiếp lên bản đồ LOST, hoặc chuyển sang trình tạo 5 bước để vẽ tuyến GPX.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onOpenContributeWizard}
              style={{
                fontSize: '0.76rem',
                padding: '6px 12px',
                color: 'var(--color-sky)',
                borderColor: 'color-mix(in srgb, var(--color-sky) 45%, transparent)',
              }}
            >
              Mở trình tạo GPX 5 bước
            </button>
            <button
              type="button"
              onClick={() => !isCreating && onClose()}
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
          onSubmit={onSubmit}
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
            1. Thông tin cơ bản &amp; địa danh
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
                value={form.name}
                onChange={(e) => onChangeForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tỉnh / Thành phố *</label>
              <input
                className="form-input"
                placeholder="VD: Lào Cai"
                value={form.province}
                onChange={(e) => onChangeForm({ ...form, province: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Quận / Huyện / Xã</label>
              <input
                className="form-input"
                placeholder="VD: Huyện Bát Xát"
                value={form.district}
                onChange={(e) => onChangeForm({ ...form, district: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Vùng miền *</label>
              <select
                className="form-select"
                value={form.region}
                onChange={(e) =>
                  onChangeForm({
                    ...form,
                    region: normalizeRegion(e.target.value),
                  })
                }
              >
                <option value="Miền Bắc">Miền Bắc</option>
                <option value="Miền Trung">Miền Trung &amp; Tây Nguyên</option>
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
            2. Thông số &amp; độ khó
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
                value={form.distanceKm}
                onChange={(e) => onChangeForm({ ...form, distanceKm: e.target.value })}
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
                value={form.elevationGainM}
                onChange={(e) => onChangeForm({ ...form, elevationGainM: e.target.value })}
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
                value={form.maxAltitudeM}
                onChange={(e) => onChangeForm({ ...form, maxAltitudeM: e.target.value })}
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
                value={form.durationDays}
                onChange={(e) => onChangeForm({ ...form, durationDays: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ghi chú thời lượng</label>
              <input
                className="form-input"
                placeholder="VD: 2 ngày 1 đêm"
                value={form.durationHoursNote}
                onChange={(e) => onChangeForm({ ...form, durationHoursNote: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Độ khó (1 - 5) *</label>
              <input
                type="number"
                min="1"
                max="5"
                className="form-input"
                value={form.difficultyLevel}
                onChange={(e) => onChangeForm({ ...form, difficultyLevel: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Ghi chú độ khó thực tế</label>
            <input
              className="form-input"
              placeholder="VD: Đường thoáng dễ định hướng, nhiều gió lớn ở sống núi"
              value={form.difficultyNote}
              onChange={(e) => onChangeForm({ ...form, difficultyNote: e.target.value })}
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
            3. Tọa độ GPS &amp; ảnh bìa
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
            }}
          >
            <div className="form-group">
              <label className="form-label">Vĩ độ xuất phát *</label>
              <input
                type="number"
                step="any"
                className="form-input"
                placeholder="VD: 22.6251"
                value={form.startLat}
                onChange={(e) => onChangeForm({ ...form, startLat: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Kinh độ xuất phát *</label>
              <input
                type="number"
                step="any"
                className="form-input"
                placeholder="VD: 103.6812"
                value={form.startLng}
                onChange={(e) => onChangeForm({ ...form, startLng: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Vĩ độ đích (tùy chọn)</label>
              <input
                type="number"
                step="any"
                className="form-input"
                placeholder="Để trống nếu trùng điểm xuất phát"
                value={form.endLat}
                onChange={(e) => onChangeForm({ ...form, endLat: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Kinh độ đích (tùy chọn)</label>
              <input
                type="number"
                step="any"
                className="form-input"
                placeholder="Để trống nếu trùng điểm xuất phát"
                value={form.endLng}
                onChange={(e) => onChangeForm({ ...form, endLng: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Đường dẫn ảnh bìa (tùy chọn)</label>
            <input
              className="form-input"
              placeholder="/covers/trail-fansipan.svg hoặc URL ảnh tuyến"
              value={form.coverImage}
              onChange={(e) => onChangeForm({ ...form, coverImage: e.target.value })}
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
            4. Mô tả, di chuyển, cứu hộ &amp; quy định
          </div>
          <div className="form-group">
            <label className="form-label">Mô tả cung đường *</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Mô tả địa hình, cảnh quan, lưu ý thời tiết và điểm nhấn của cung đường..."
              value={form.description}
              onChange={(e) => onChangeForm({ ...form, description: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Hướng dẫn di chuyển tới cửa rừng</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="VD: Xe giường nằm lên Lào Cai/Sa Pa, tiếp tục thuê xe máy hoặc ô tô trung chuyển..."
              value={form.transportationInfo}
              onChange={(e) => onChangeForm({ ...form, transportationInfo: e.target.value })}
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
              <label className="form-label">Đầu mối cứu hộ / trạm kiểm lâm</label>
              <input
                className="form-input"
                placeholder="VD: Ban Quản lý VQG / Kiểm lâm địa phương"
                value={form.rescueContactName}
                onChange={(e) => onChangeForm({ ...form, rescueContactName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Số cứu hộ khẩn cấp</label>
              <input
                className="form-input"
                placeholder="112 / 114"
                value={form.rescueContactPhone}
                onChange={(e) => onChangeForm({ ...form, rescueContactPhone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Liên hệ kiểm lâm bổ sung</label>
              <input
                className="form-input"
                placeholder="VD: 02143.871.494 (Kiểm lâm VQG)"
                value={form.rescueContactRanger}
                onChange={(e) => onChangeForm({ ...form, rescueContactRanger: e.target.value })}
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
                checked={form.permitRequired}
                onChange={(e) => onChangeForm({ ...form, permitRequired: e.target.checked })}
              />
              Yêu cầu giấy phép kiểm lâm / VQG
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
                checked={form.hasCampsite}
                onChange={(e) => onChangeForm({ ...form, hasCampsite: e.target.checked })}
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
                checked={form.hasWaterSource}
                onChange={(e) => onChangeForm({ ...form, hasWaterSource: e.target.checked })}
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
                checked={form.kidFriendly}
                onChange={(e) => onChangeForm({ ...form, kidFriendly: e.target.checked })}
              />
              Phù hợp trẻ em
            </label>
          </div>

          {form.permitRequired && (
            <div className="form-group">
              <label className="form-label">Thông tin đăng ký giấy phép</label>
              <input
                className="form-input"
                placeholder="VD: Đăng ký tại Trạm Kiểm lâm / Đồn Biên phòng trước 3 ngày"
                value={form.permitInfo}
                onChange={(e) => onChangeForm({ ...form, permitInfo: e.target.value })}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isCreating}
              style={{ flex: 1.4, justifyContent: 'center' }}
            >
              {isCreating ? 'Đang tạo cung đường...' : 'Tạo và đưa lên bản đồ'}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={isCreating}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

/* ============================================================================
 * 5. STYLED IN-APP CONFIRMATION DIALOG (NESTED OVERLAY + OPTIONAL REASON INPUT)
 * ============================================================================ */
export interface AdminConfirmDialogProps {
  dialog: ConfirmDialogState | null;
  reason: string;
  isExecuting: boolean;
  dialogRef: React.RefObject<HTMLDivElement | null>;
  onChangeReason: (next: string) => void;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const AdminConfirmDialog: React.FC<AdminConfirmDialogProps> = ({
  dialog,
  reason,
  isExecuting,
  dialogRef,
  onChangeReason,
  onConfirm,
  onClose,
}) => {
  if (!dialog || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={() => !isExecuting && onClose()}
      style={{ zIndex: 'calc(var(--z-modal-nested, 3100) + 10)' as unknown as number }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="modal-content"
        role="alertdialog"
        aria-modal="true"
        aria-label={dialog.title}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 460,
          width: '92%',
          padding: 22,
          borderRadius: 6,
          border: `1px solid ${dialog.danger ? 'var(--color-error)' : 'var(--color-border-strong)'}`,
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
              color: dialog.danger ? 'var(--color-error-text, var(--color-error))' : 'var(--color-text-main)',
              margin: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <IconAlertTriangle
              size={18}
              color={dialog.danger ? 'var(--color-error)' : 'var(--color-earth)'}
            />
            {dialog.title}
          </h3>
          <button
            type="button"
            onClick={() => !isExecuting && onClose()}
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
            margin: dialog.reasonInputLabel ? '0 0 14px 0' : '0 0 20px 0',
          }}
        >
          {dialog.message}
        </p>

        {dialog.reasonInputLabel && (
          <div className="form-group" style={{ marginBottom: 18 }}>
            <label className="form-label">{dialog.reasonInputLabel}</label>
            <input
              className="form-input"
              value={reason}
              onChange={(e) => onChangeReason(e.target.value)}
              placeholder={dialog.reasonPlaceholder || 'Nhập lý do...'}
              maxLength={300}
              disabled={isExecuting}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={isExecuting}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            className={dialog.danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={() => void onConfirm()}
            disabled={isExecuting}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {isExecuting ? 'Đang xử lý...' : dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
