import React, { useState } from 'react';
import {
  IconCalendar,
  IconUsers,
  IconMapPin,
  IconUserPlus,
  IconCheckCircle,
  IconMountain,
  IconFlame,
  IconStar,
  IconX,
} from '../common/SvgIcons.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import type { UserProfile } from '../../types.js';
import { SquadWorkspaceModal } from './SquadWorkspaceModal.js';

export interface TripPlanItem {
  _id: string;
  creatorId: {
    _id: string;
    fullName: string;
    avatarUrl?: string;
    reputationScore?: number;
    badges?: string[];
  };
  trailId?: string | { _id?: string; id?: string; name?: string; region?: string; province?: string };
  trailName?: string;
  region?: string;
  title: string;
  description: string;
  requirements?: string;
  startDate: string;
  endDate: string;
  maxMembers: number;
  currentMembers: Array<string | { _id?: string; id?: string; fullName?: string; avatarUrl?: string }>;
  meetingPoint: string;
  estimatedCost: string;
  difficultyLevel: number;
  status: 'recruiting' | 'full' | 'in_progress' | 'completed' | 'cancelled';
  tags: string[];
  hasPendingRequest?: boolean;
}

interface TripPlanCardProps {
  trip: TripPlanItem;
  currentUser?: UserProfile | null;
  onJoinSuccess?: () => void;
}

const TRIP_STATUS_META: Record<
  TripPlanItem['status'],
  { label: string; badgeClass: string; joinDisabledText: string }
> = {
  recruiting: { label: 'Đang Tuyển', badgeClass: 'badge-success', joinDisabledText: 'Hết chỗ (Đủ thành viên)' },
  full: { label: 'Đã Đủ', badgeClass: 'badge-error', joinDisabledText: 'Đã Đủ Thành Viên' },
  in_progress: { label: 'Đang Diễn Ra', badgeClass: 'badge-info', joinDisabledText: 'Đoàn Đang Diễn Ra' },
  completed: { label: 'Đã Hoàn Thành', badgeClass: 'badge-cloud', joinDisabledText: 'Chuyến Đi Đã Kết Thúc' },
  cancelled: { label: 'Đã Hủy', badgeClass: 'badge-error', joinDisabledText: 'Chuyến Đi Đã Hủy' },
};

export const TripPlanCard: React.FC<TripPlanCardProps> = React.memo(({ trip, currentUser, onJoinSuccess }) => {
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);
  const [joinMsg, setJoinMsg] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [withdrewPending, setWithdrewPending] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSquadModalOpen, setIsSquadModalOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const loggedInUser = currentUser || null;
  const currentUserId = String(loggedInUser?.id || (loggedInUser as (UserProfile & { _id?: string }) | null)?._id || '');

  const isCreatorSelf = Boolean(
    currentUserId && trip.creatorId?._id && String(trip.creatorId._id) === currentUserId
  );
  const isSquadMember = Boolean(
    isCreatorSelf ||
      (currentUserId &&
        Array.isArray(trip.currentMembers) &&
        trip.currentMembers.some((m) => {
          const memberId = typeof m === 'string' ? m : m?._id || m?.id || '';
          return String(memberId) === currentUserId;
        }))
  );
  const isPendingRequest = !isSquadMember && (submitted || Boolean(trip.hasPendingRequest && !withdrewPending));
  const creatorName = trip.creatorId?.fullName || 'Trưởng đoàn';
  const effectiveCreatorAvatar =
    isCreatorSelf && (loggedInUser?.avatarUrl || loggedInUser?.avatar)
      ? loggedInUser.avatarUrl || loggedInUser.avatar
      : trip.creatorId?.avatarUrl || '';

  const formattedStartDate = (() => {
    const d = new Date(trip.startDate);
    if (Number.isNaN(d.getTime())) return trip.startDate || '';
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  })();

  const memberCount = Array.isArray(trip.currentMembers) ? trip.currentMembers.length : 1;
  const maxCount = Math.max(1, Number(trip.maxMembers) || 8);
  const remainingSeats = Math.max(0, maxCount - memberCount);
  const isFull = trip.status === 'full' || remainingSeats === 0;
  const isClosedForJoin = trip.status !== 'recruiting' || isFull;
  const effectiveStatusMeta =
    trip.status === 'recruiting' && isFull
      ? TRIP_STATUS_META.full
      : TRIP_STATUS_META[trip.status] || TRIP_STATUS_META.recruiting;
  const fillRatioPercent = Math.min(100, Math.round((memberCount / maxCount) * 100));

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingJoin) return;
    setErrorMsg('');
    try {
      const token = localStorage.getItem('lost_token');
      if (!token) {
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: 'Vui lòng đăng nhập để tham gia nhóm leo núi!', type: 'info' },
          })
        );
        window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
        return;
      }

      setIsSubmittingJoin(true);
      const res = await fetch(`/api/trips/${encodeURIComponent(trip._id)}/join`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message: joinMsg }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitted(true);
        setWithdrewPending(false);
        setShowJoinForm(false);
        setJoinMsg('');
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: data.message || 'Đã gửi yêu cầu ghép đoàn thành công!', type: 'success' },
          })
        );
        onJoinSuccess?.();
      } else {
        setErrorMsg(data.message || 'Không thể gửi yêu cầu.');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ.');
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  const handleWithdrawRequest = async () => {
    if (isWithdrawing) return;
    setIsWithdrawing(true);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(trip._id)}/leave`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setSubmitted(false);
        setWithdrewPending(true);
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: data.message || 'Đã rút yêu cầu ghép đoàn.', type: 'info' },
          })
        );
        onJoinSuccess?.();
      } else {
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: data.message || 'Không thể rút yêu cầu lúc này.', type: 'error' },
          })
        );
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: { message: 'Lỗi kết nối máy chủ khi rút yêu cầu.', type: 'error' },
        })
      );
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleLeaveTrip = async () => {
    if (isLeaving) return;
    setIsLeaving(true);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(trip._id)}/leave`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setConfirmLeave(false);
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: data.message || 'Bạn đã rời khỏi đoàn thành công.', type: 'info' },
          })
        );
        onJoinSuccess?.();
      } else {
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: data.message || 'Không thể rời đoàn lúc này.', type: 'error' },
          })
        );
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: { message: 'Lỗi kết nối máy chủ khi rời đoàn.', type: 'error' },
        })
      );
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRadius: 4,
        padding: 20,
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div>
        {/* Creator & Status Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {effectiveCreatorAvatar ? (
              <img
                loading="lazy"
                decoding="async"
                src={effectiveCreatorAvatar}
                alt={creatorName}
                referrerPolicy="no-referrer"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 4,
                  border: '1px solid var(--color-border-strong)',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 4,
                  background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
                  border: '1px solid var(--color-border-strong)',
                  color: 'var(--color-primary)',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {creatorName.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const target = trip.creatorId?._id || creatorName;
                  if (!target) return;
                  window.history.pushState(null, '', `#profile-${encodeURIComponent(target)}`);
                  window.dispatchEvent(new HashChangeEvent('hashchange'));
                }}
                title={`Xem hồ sơ trưởng đoàn ${creatorName}`}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  color: 'var(--color-text-main)',
                  lineHeight: 1.2,
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                }}
              >
                {creatorName}
              </button>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 600, marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <IconStar size={11} color="var(--color-primary)" fill="var(--color-primary)" />
                <span>{trip.creatorId?.reputationScore ?? 0} Uy tín</span>
              </div>
            </div>
          </div>

          <span className={`badge ${effectiveStatusMeta.badgeClass}`}>
            {effectiveStatusMeta.label}
          </span>
        </div>

        {/* Trail Destination Tag */}
        {trip.trailName && (
          <div className="badge badge-info" style={{ marginBottom: 10 }}>
            <IconMountain size={12} color="var(--color-sky)" />
            {trip.trailName}
          </div>
        )}

        {/* Trip Title */}
        <h3 className="font-editorial" style={{ fontSize: '1.22rem', fontWeight: 600, color: 'var(--color-text-main)', margin: '0 0 8px 0', lineHeight: 1.25 }}>
          {trip.title}
        </h3>

        {/* Description */}
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: '0 0 14px 0' }}>
          {trip.description}
        </p>

        {/* Telemetry Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
            gap: 8,
            background: 'var(--color-bg-main)',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            padding: '10px 12px',
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', color: 'var(--color-text-main)' }}>
            <IconCalendar size={14} color="var(--color-primary)" />
            <span>Khởi hành: <strong>{formattedStartDate}</strong></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', color: 'var(--color-text-main)' }}>
            <IconUsers size={14} color="var(--color-sky)" />
            <span>
              Thành viên:{' '}
              <strong>
                {memberCount}/{maxCount} ({remainingSeats === 0 ? 'Hết chỗ' : `còn ${remainingSeats} chỗ`})
              </strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', color: 'var(--color-text-main)', gridColumn: '1 / -1' }}>
            <IconMapPin size={14} color="var(--color-earth)" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Điểm hẹn: <strong>{trip.meetingPoint}</strong>
            </span>
          </div>

          {trip.estimatedCost && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', color: 'var(--color-text-main)', gridColumn: '1 / -1' }}>
              <IconFlame size={14} color="var(--color-sun)" />
              <span>Dự toán: <strong style={{ color: 'var(--color-sun)' }}>{trip.estimatedCost}</strong></span>
            </div>
          )}
        </div>

        {/* Member Fill Ratio Progress Bar */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--color-text-dim)', marginBottom: 4 }}>
            <span>Tiến độ ghép đoàn</span>
            <span>{fillRatioPercent}%</span>
          </div>
          <div style={{ width: '100%', height: 6, background: 'var(--color-bg-main)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            <div
              style={{
                width: `${fillRatioPercent}%`,
                height: '100%',
                background: isFull ? 'var(--color-error)' : 'var(--color-primary)',
                borderRadius: 3,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* Action / Join Form Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isSquadMember && (
          <>
            <button
              type="button"
              onClick={() => setIsSquadModalOpen(true)}
              className="btn btn-sky interactive-click"
              style={{
                width: '100%',
                borderRadius: 4,
                padding: '9px 14px',
                fontSize: '0.82rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <IconUsers size={15} color="var(--color-on-primary)" />
              <span>
                {isCreatorSelf
                  ? 'Quản Lý Đoàn (Duyệt • Đồ Chung • Chi Phí)'
                  : 'Không Gian Đoàn (Chat • Đồ Chung • Chia Tiền)'}
              </span>
            </button>

            {!isCreatorSelf && (
              confirmLeave ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 4,
                    background: 'var(--banner-danger-bg)',
                    border: '1px solid var(--banner-danger-border)',
                    fontSize: '0.76rem',
                    color: 'var(--banner-danger-text)',
                  }}
                >
                  <span style={{ fontWeight: 700 }}>Xác nhận rời đoàn?</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      disabled={isLeaving}
                      onClick={handleLeaveTrip}
                      className="btn btn-danger"
                      style={{ padding: '4px 10px', fontSize: '0.74rem', borderRadius: 4 }}
                    >
                      {isLeaving ? 'Đang xử lý...' : 'Rời đoàn'}
                    </button>
                    <button
                      type="button"
                      disabled={isLeaving}
                      onClick={() => setConfirmLeave(false)}
                      className="btn btn-outline"
                      style={{ padding: '4px 8px', fontSize: '0.74rem', borderRadius: 4 }}
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmLeave(true)}
                  className="btn btn-outline"
                  style={{
                    width: '100%',
                    borderRadius: 4,
                    padding: '7px 12px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    color: 'var(--color-error-text, var(--color-error))',
                    borderColor: 'color-mix(in srgb, var(--color-error) 40%, transparent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                  }}
                >
                  <IconX size={13} color="var(--color-error-text, var(--color-error))" />
                  <span>Rời Khỏi Đoàn</span>
                </button>
              )
            )}
          </>
        )}

        {isSquadMember ? null : isPendingRequest ? (
          <div
            style={{
              background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
              border: '1px solid var(--color-primary)',
              borderRadius: 4,
              padding: '9px 12px',
              color: 'var(--color-primary)',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconCheckCircle size={15} color="var(--color-primary)" />
              <span>Đang chờ Trưởng đoàn duyệt</span>
            </span>
            <button
              type="button"
              disabled={isWithdrawing}
              onClick={handleWithdrawRequest}
              className="btn btn-outline"
              style={{
                padding: '4px 10px',
                fontSize: '0.74rem',
                fontWeight: 700,
                borderRadius: 4,
                color: 'var(--color-error-text, var(--color-error))',
                borderColor: 'color-mix(in srgb, var(--color-error) 40%, transparent)',
              }}
            >
              {isWithdrawing ? 'Đang rút...' : 'Rút yêu cầu'}
            </button>
          </div>
        ) : showJoinForm ? (
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Lời nhắn (kinh nghiệm, thể lực của bạn)..."
              value={joinMsg}
              onChange={(e) => setJoinMsg(e.target.value)}
              style={{ fontSize: '0.8rem', padding: '8px 12px', borderRadius: 4 }}
              autoFocus
            />
            {errorMsg && (
              <div style={{ fontSize: '0.72rem', color: 'var(--color-error-text, var(--color-error))' }}>{errorMsg}</div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="submit"
                disabled={isSubmittingJoin}
                className="btn btn-primary interactive-click"
                style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem', fontWeight: 800, borderRadius: 4 }}
              >
                {isSubmittingJoin ? 'Đang gửi...' : 'Gửi Yêu Cầu'}
              </button>
              <button
                type="button"
                className="btn btn-outline interactive-click"
                onClick={() => {
                  setShowJoinForm(false);
                  setErrorMsg('');
                }}
                style={{ padding: '8px 12px', fontSize: '0.8rem', borderRadius: 4 }}
              >
                Hủy
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            disabled={isClosedForJoin}
            onClick={() => setShowJoinForm(true)}
            className={`btn ${isClosedForJoin ? 'btn-outline' : 'btn-primary'} interactive-click`}
            style={{
              width: '100%',
              borderRadius: 4,
              padding: '9px 14px',
              fontSize: '0.84rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              opacity: isClosedForJoin ? 0.65 : 1,
              cursor: isClosedForJoin ? 'default' : 'pointer',
            }}
          >
            <IconUserPlus size={15} color={isClosedForJoin ? 'var(--color-text-dim)' : 'var(--color-on-primary)'} />
            {isClosedForJoin ? effectiveStatusMeta.joinDisabledText : 'Xin Ghép Đoàn Ngay'}
          </button>
        )}
      </div>

      {isSquadModalOpen && (
        <SquadWorkspaceModal
          tripId={trip._id}
          tripTitle={trip.title}
          memberCount={memberCount}
          currentUserId={currentUserId}
          isCreator={isCreatorSelf}
          isMember={isSquadMember}
          isOpen={isSquadModalOpen}
          onClose={() => setIsSquadModalOpen(false)}
          onTripUpdated={onJoinSuccess}
          onShowToast={(message, type) => {
            window.dispatchEvent(new CustomEvent('lost:show-toast', { detail: { message, type } }));
          }}
        />
      )}
    </div>
  );
});
