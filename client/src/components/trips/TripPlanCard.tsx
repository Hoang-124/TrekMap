import React, { useState } from 'react';
import {
  IconCalendar,
  IconUsers,
  IconMapPin,
  IconUserPlus,
  IconCheckCircle,
  IconMountain,
  IconFlame,
} from '../common/SvgIcons.js';

export interface TripPlanItem {
  _id: string;
  creatorId: {
    _id: string;
    fullName: string;
    avatarUrl: string;
    reputationScore?: number;
    badges?: string[];
  };
  trailName?: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  maxMembers: number;
  currentMembers: any[];
  meetingPoint: string;
  estimatedCost: string;
  difficultyLevel: number;
  status: 'recruiting' | 'full' | 'in_progress' | 'completed' | 'cancelled';
  tags: string[];
}

interface TripPlanCardProps {
  trip: TripPlanItem;
  onJoinSuccess?: () => void;
}

export const TripPlanCard: React.FC<TripPlanCardProps> = ({ trip, onJoinSuccess }) => {
  const [isJoining, setIsJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  let loggedInUser: any = null;
  try {
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('trekmap_user') : null;
    loggedInUser = userStr ? JSON.parse(userStr) : null;
  } catch (e) {}

  const isCreatorSelf = Boolean(
    loggedInUser && (
      (trip.creatorId?._id && loggedInUser.id && String(trip.creatorId._id) === String(loggedInUser.id)) ||
      (loggedInUser.fullName && trip.creatorId?.fullName && trip.creatorId.fullName.toLowerCase() === loggedInUser.fullName.toLowerCase())
    )
  );
  const effectiveCreatorAvatar = (isCreatorSelf && (loggedInUser?.avatarUrl || loggedInUser?.avatar))
    ? (loggedInUser.avatarUrl || loggedInUser.avatar)
    : (trip.creatorId?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80');

  const formattedStartDate = new Date(trip.startDate).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const memberCount = Array.isArray(trip.currentMembers) ? trip.currentMembers.length : 1;
  const maxCount = trip.maxMembers || 8;
  const isFull = trip.status === 'full' || memberCount >= maxCount;
  const fillRatioPercent = Math.min(100, Math.round((memberCount / maxCount) * 100));

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const token = localStorage.getItem('trekmap_token');
      if (!token) {
        window.dispatchEvent(
          new CustomEvent('trekmap:show-toast', {
            detail: { message: 'Vui lòng đăng nhập để tham gia nhóm leo núi!', type: 'info' },
          })
        );
        return;
      }

      setIsJoining(true);
      const res = await fetch(`/api/trips/${trip._id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: joinMsg }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        if (onJoinSuccess) onJoinSuccess();
      } else {
        setErrorMsg(data.message || 'Không thể gửi yêu cầu.');
      }
    } catch (err) {
      setErrorMsg('Lỗi kết nối máy chủ.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div
      className="card interactive-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRadius: 20,
        padding: 22,
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
        transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div>
        {/* Creator & Status Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src={effectiveCreatorAvatar}
              alt={trip.creatorId?.fullName || 'Trekker'}
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                border: '2px solid var(--color-primary)',
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1.2 }}>
                {trip.creatorId?.fullName || 'Hoàng Trekker (Leader)'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 700, marginTop: 2 }}>
                ★ {trip.creatorId?.reputationScore || 1430} Điểm uy tín
              </div>
            </div>
          </div>

          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: 20,
              background: isFull ? 'rgba(239, 68, 68, 0.14)' : 'rgba(5, 150, 105, 0.14)',
              color: isFull ? 'var(--color-error)' : 'var(--color-primary)',
              border: `1px solid ${isFull ? 'rgba(239, 68, 68, 0.3)' : 'rgba(5, 150, 105, 0.3)'}`,
            }}
          >
            {isFull ? '● Đã Đủ Chỗ' : '● Đang Tuyển'}
          </span>
        </div>

        {/* Trail Destination Tag */}
        {trip.trailName && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', color: 'var(--color-sky)', fontWeight: 700, marginBottom: 8 }}>
            <IconMountain size={12} color="var(--color-sky)" />
            {trip.trailName}
          </div>
        )}

        {/* Trip Title */}
        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '0 0 8px 0', lineHeight: 1.35 }}>
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
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 8,
            background: 'var(--color-bg-main)',
            border: '1px solid var(--color-border)',
            borderRadius: 14,
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
            <span>Thành viên: <strong>{memberCount}/{maxCount} ({maxCount - memberCount} chỗ)</strong></span>
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
      <div>
        {submitted ? (
          <div style={{ background: 'rgba(5, 150, 105, 0.12)', border: '1px solid var(--color-primary)', borderRadius: 12, padding: '10px 14px', textAlign: 'center', color: 'var(--color-primary)', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <IconCheckCircle size={16} color="var(--color-primary)" />
            Đã gửi yêu cầu ghép đoàn tới Leader!
          </div>
        ) : isJoining ? (
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Lời nhắn (kinh nghiệm, thể lực của bạn)..."
              value={joinMsg}
              onChange={(e) => setJoinMsg(e.target.value)}
              style={{ fontSize: '0.8rem', padding: '8px 12px', borderRadius: 10 }}
              autoFocus
            />
            {errorMsg && (
              <div style={{ fontSize: '0.72rem', color: 'var(--color-error)' }}>{errorMsg}</div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="submit"
                className="btn btn-primary interactive-click"
                style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem', fontWeight: 800, borderRadius: 10 }}
              >
                Gửi Yêu Cầu
              </button>
              <button
                type="button"
                className="btn btn-outline interactive-click"
                onClick={() => setIsJoining(false)}
                style={{ padding: '8px 12px', fontSize: '0.8rem', borderRadius: 10 }}
              >
                Hủy
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            disabled={isFull}
            onClick={() => setIsJoining(true)}
            className={`btn ${isFull ? 'btn-outline' : 'btn-primary'} interactive-click ripple-fx`}
            style={{
              width: '100%',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: '0.84rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              opacity: isFull ? 0.6 : 1,
              cursor: isFull ? 'default' : 'pointer',
              boxShadow: isFull ? 'none' : '0 4px 14px rgba(5, 150, 105, 0.3)',
            }}
          >
            <IconUserPlus size={15} color={isFull ? 'var(--color-text-dim)' : '#ffffff'} />
            {isFull ? 'Chuyến Đi Đã Đủ Thành Viên' : 'Xin Ghép Đoàn Ngay'}
          </button>
        )}
      </div>
    </div>
  );
};
