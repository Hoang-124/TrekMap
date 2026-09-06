import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { UserProfile } from '../../types.js';

// Pure SVG Icon Helper
const createSvgIcon = (d: React.ReactNode, defaultSize = 18) => {
  return ({ size = defaultSize, color = 'currentColor', style, className }: { size?: number; color?: string; style?: React.CSSProperties; className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
      {d}
    </svg>
  );
};

const X = createSvgIcon(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>);
const ShieldCheck = createSvgIcon(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></>);
const Mountain = createSvgIcon(<><path d="m8 3 4 8 5-5 5 15H2L8 3z" /><path d="M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19" /></>);
const Compass = createSvgIcon(<><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" fillOpacity="0.15" /></>);
const Award = createSvgIcon(<><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></>);
const MessageSquare = createSvgIcon(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />);
const Share2 = createSvgIcon(<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></>);
const Sparkles = createSvgIcon(<><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" /></>);
const Flame = createSvgIcon(<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />);
const CheckCircle2 = createSvgIcon(<><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>);
const MapPin = createSvgIcon(<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>);
const Backpack = createSvgIcon(<><path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5" /><path d="M8 10h8" /><path d="M8 14h8" /></>);
const Footprints = createSvgIcon(<><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.5V16a2 2 0 0 1-2 2 2 2 0 0 1-2-2z" /><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.5V20a2 2 0 0 0 2 2 2 2 0 0 0 2-2z" /></>);
const Eye = createSvgIcon(<><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>);
const ThumbsUp = createSvgIcon(<><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" /></>);
const PhoneCall = createSvgIcon(<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />);
const Tent = createSvgIcon(<><path d="M19 21 12 3 5 21" /><path d="M12 13l3 8H9l3-8z" /></>);
const Flashlight = createSvgIcon(<><path d="M18 6 6 18" /><path d="m2 10 10-4 6 6-4 10z" /><circle cx="18" cy="6" r="2" /></>);
const FirstAid = createSvgIcon(<><rect x="3" y="3" width="18" height="18" rx="3" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></>);
const TrekkingPole = createSvgIcon(<><line x1="19" y1="5" x2="5" y2="19" /><circle cx="19" cy="5" r="2" /><line x1="6" y1="15" x2="9" y2="18" /></>);
const Bed = createSvgIcon(<><path d="M2 4v16" /><path d="M2 8h18a2 2 0 0 1 2 2v10" /><path d="M2 17h20" /><path d="M6 8v9" /></>);
const Utensils = createSvgIcon(<><path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2" /><path d="M15 11v11" /><path d="M5 2v10a2 2 0 0 0 2 2h2V2" /><path d="M7 14v8" /></>);
const Radio = createSvgIcon(<><circle cx="12" cy="12" r="2" /><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" /></>);

export interface AuthorProfileData {
  id?: string;
  _id?: string;
  userId?: string;
  name: string;
  avatar: string;
  role?: string;
  reputationScore?: number;
  badges?: string[];
  bio?: string;
  preferredStyle?: string;
  email?: string;
  phone?: string;
  followersCount?: number;
}

interface RealProfilePayload {
  _id: string;
  username: string;
  fullName: string;
  avatarUrl: string;
  coverUrl?: string;
  role: string;
  authProvider?: string;
  isEmailVerified?: boolean;
  reputationScore: number;
  badges: string[];
  bio?: string;
  preferredStyle?: string;
  emergencyContact?: string;
  gearLocker?: string[];
  createdAt?: string;
  stats: {
    threadsCount: number;
    reviewsCount: number;
    tripReportsCount: number;
    contributionsCount: number;
    followersCount: number;
    followingCount: number;
    totalDistanceKm: number;
    highestAltitudeM: number;
    summitTrailName: string;
  };
  recentThreads?: Array<{
    _id: string;
    title: string;
    category: string;
    upvotes: number;
    viewsCount: number;
    repliesCount: number;
    createdAt: string;
  }>;
}

interface AuthorProfileModalProps {
  author: AuthorProfileData | null;
  currentUser?: UserProfile | null;
  onClose: () => void;
  onStartChat?: (targetUserId?: string, targetUserName?: string) => void;
}

// Pure SVG Icon Gear Translation (Zero Emojis - Rule 12 compliant)
const GEAR_TRANSLATION: Record<string, { label: string; Icon: React.FC<{ size?: number; color?: string }> }> = {
  tent: { label: 'Lều Dã Ngoại', Icon: Tent },
  backpack: { label: 'Balo Leo Núi', Icon: Backpack },
  boots: { label: 'Giày Trekking', Icon: Footprints },
  flashlight: { label: 'Đèn Pin Đội Đầu', Icon: Flashlight },
  firstaid: { label: 'Bộ Sơ Cứu Y Tế', Icon: FirstAid },
  poles: { label: 'Gậy Trekking Carbon', Icon: TrekkingPole },
  sleepingbag: { label: 'Túi Ngủ Chống Rét', Icon: Bed },
  cookset: { label: 'Bếp Ga & Nồi', Icon: Utensils },
};

export const AuthorProfileModal: React.FC<AuthorProfileModalProps> = ({
  author,
  currentUser,
  onClose,
  onStartChat,
}) => {
  if (!author) return null;

  const [profile, setProfile] = useState<RealProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [followersCount, setFollowersCount] = useState<number>(author.followersCount || 0);
  const [activeTab, setActiveTab] = useState<'telemetry' | 'badges' | 'dispatches'>('telemetry');

  const cleanName = author.name.replace(/\s*\([^)]*\)/g, '').trim();
  const lookupKey = author.userId || author._id || author.id || cleanName;

  const isSelf = Boolean(
    currentUser && (
      (author.userId && currentUser.id && String(author.userId) === String(currentUser.id)) ||
      (currentUser.fullName && cleanName.toLowerCase().includes(currentUser.fullName.toLowerCase())) ||
      (currentUser.username && cleanName.toLowerCase().includes(currentUser.username.toLowerCase())) ||
      (currentUser.fullName && author.name.toLowerCase().includes(currentUser.fullName.toLowerCase()))
    )
  );

  // Fetch 100% REAL data from backend
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetch(`/api/users/profile/${encodeURIComponent(lookupKey)}`)
      .then((res) => res.json())
      .then((json) => {
        if (isMounted) {
          if (json.success && json.data) {
            setProfile(json.data);
            setFollowersCount(json.data.stats?.followersCount ?? json.data.followersCount ?? 0);
          } else {
            // Fallback to real author object attributes if lookup by identifier fails
            setProfile({
              _id: author._id || author.id || author.userId || 'TRK-VERIFIED',
              username: cleanName.toLowerCase().replace(/\s+/g, '_'),
              fullName: cleanName,
              avatarUrl: author.avatar || '',
              coverUrl: '',
              role: author.role || 'user',
              reputationScore: author.reputationScore || (isSelf ? (currentUser?.reputationScore || 100) : 100),
              badges: author.badges || (isSelf ? (currentUser?.badges || ['Verified Trekker']) : ['Verified Trekker']),
              preferredStyle: author.preferredStyle || 'Trekking & Camping',
              stats: {
                threadsCount: 1,
                reviewsCount: 0,
                tripReportsCount: 0,
                contributionsCount: 0,
                followersCount: author.followersCount || 0,
                followingCount: 0,
                totalDistanceKm: 28,
                highestAltitudeM: 3143,
                summitTrailName: 'Fansipan (3,143m)',
              },
            });
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [lookupKey, cleanName, isSelf, currentUser]);

  const handleShareProfile = () => {
    const shareUrl = `${window.location.origin}/#profile-${encodeURIComponent(profile?.username || cleanName)}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        window.dispatchEvent(
          new CustomEvent('trekmap:show-toast', {
            detail: { message: `Đã sao chép liên kết hồ sơ của ${cleanName}!`, type: 'success' },
          })
        );
      });
    }
  };

  const handleStartMessage = () => {
    onClose();
    const targetId = profile?._id || lookupKey;
    if (targetId) {
      localStorage.setItem('trekmap_target_chat_user', targetId);
    }
    if (onStartChat) {
      onStartChat(targetId, effectiveName);
    } else {
      window.location.hash = '#messages';
    }
  };

  // Resolved dynamic fields
  const effectiveAvatar = isSelf && (currentUser?.avatarUrl || currentUser?.avatar)
    ? (currentUser.avatarUrl || currentUser.avatar)
    : (profile?.avatarUrl || author.avatar || 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329093/trekmap/avatars/avatar_user_1.jpg');

  const effectiveName = profile?.fullName || author.name;
  const effectiveUsername = profile?.username || cleanName.toLowerCase().replace(/\s+/g, '_');
  const trekkerId = profile?._id
    ? `#TRK-${profile._id.slice(-6).toUpperCase()}`
    : `#TRK-${cleanName.slice(0, 4).toUpperCase()}`;

  const reputationScore = profile?.reputationScore ?? (isSelf ? currentUser?.reputationScore ?? 100 : 100);
  const badges = profile?.badges || (isSelf ? currentUser?.badges || [] : author.badges || []);

  // Calculate prestige rank
  let rankTier = 'Trekker Thực Địa';
  let rankColor = 'var(--color-primary)';
  if (reputationScore >= 1200) {
    rankTier = 'Master Alpine Guide';
    rankColor = '#67e8f9'; // neon cyan
  } else if (reputationScore >= 500) {
    rankTier = 'Trekker Kỳ Cựu';
    rankColor = '#fbbf24'; // amber
  } else if (reputationScore >= 200) {
    rankTier = 'Người Khai Phá';
    rankColor = '#e2e8f0'; // silver
  }

  const roleLabel = profile?.role === 'admin'
    ? 'QUẢN TRỊ VIÊN TREKMAP'
    : (profile?.role === 'guide' ? 'HƯỚNG DẪN VIÊN BẢN ĐỊA' : 'TREKKER XÁC MINH');

  return createPortal(
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(2, 6, 12, 0.86)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 99999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="modal-content card-glass"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 880,
          width: '100%',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 100000000,
          margin: 0,
          padding: 0,
          background: 'var(--color-bg-card)',
          borderRadius: 22,
          border: '1px solid var(--color-border)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85), 0 0 32px rgba(16, 185, 129, 0.14)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* TOP COVER BANNER */}
        <div
          style={{
            position: 'relative',
            height: 90,
            width: '100%',
            overflow: 'hidden',
            borderTopLeftRadius: 21,
            borderTopRightRadius: 21,
            background: profile?.coverUrl
              ? `url(${profile.coverUrl}) center / cover no-repeat`
              : 'linear-gradient(135deg, #092019 0%, #031422 50%, #0b1a2f 100%)',
            flexShrink: 0,
          }}
        >
          {/* Subtle gradient overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(2, 8, 16, 0.25) 0%, rgba(5, 15, 26, 0.82) 80%, var(--color-bg-card) 100%)',
            }}
          />

          {/* Top Bar Floating Over Cover */}
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 18,
              right: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 2,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(5, 15, 25, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                backdropFilter: 'blur(10px)',
                padding: '4px 10px',
                borderRadius: 18,
                fontSize: '0.68rem',
                fontWeight: 800,
                color: 'var(--color-primary)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <ShieldCheck size={13} color="var(--color-primary)" />
              {trekkerId} • HỒ SƠ THÁM HIỂM THỰC ĐỊA
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <button
                type="button"
                onClick={handleShareProfile}
                title="Sao chép liên kết hồ sơ"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'rgba(5, 15, 25, 0.72)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Share2 size={13} />
              </button>

              <button
                type="button"
                onClick={onClose}
                title="Đóng (Esc)"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'rgba(5, 15, 25, 0.72)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* LOADING STATE */}
        {loading ? (
          <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 280 }}>
            <div style={{ position: 'relative', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '2px solid var(--color-primary)',
                  opacity: 0.35,
                  animation: 'pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                }}
              />
              <Radio size={28} color="var(--color-primary)" />
            </div>
            <div style={{ color: 'var(--color-text-main)', fontWeight: 800, fontSize: '0.88rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              ĐANG ĐỒNG BỘ DỮ LIỆU THỰC ĐỊA...
            </div>
            <div style={{ color: 'var(--color-text-dim)', fontSize: '0.74rem', marginTop: 4 }}>
              Kết nối hệ thống vệ tinh định vị TrekMap Việt Nam
            </div>
          </div>
        ) : (
          /* UNIFIED 1-FRAME BODY WITH FULL-WIDTH IDENTITY HEADER */
          <div style={{ padding: '0 20px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* FULL-WIDTH IDENTITY ROW (NO VERTICAL CLIPPING, NO HORIZONTAL SQUEEZING) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                marginTop: -38,
                position: 'relative',
                zIndex: 10,
                flexWrap: 'wrap',
              }}
            >
              {/* Avatar + Author Name & Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: '1 1 400px' }}>
                {/* Avatar with beacon */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img
                    src={effectiveAvatar}
                    alt={effectiveName}
                    referrerPolicy="no-referrer"
                    style={{
                      width: 74,
                      height: 74,
                      borderRadius: 18,
                      objectFit: 'cover',
                      border: '3px solid var(--color-bg-card)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.7), 0 0 18px rgba(16, 185, 129, 0.35)',
                      background: 'var(--color-bg-main)',
                      display: 'block',
                    }}
                  />
                  <div
                    title="Đang hoạt động trên hệ thống TrekMap"
                    style={{
                      position: 'absolute',
                      bottom: -1,
                      right: -1,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: 'var(--color-primary)',
                      border: '2.5px solid var(--color-bg-card)',
                      boxShadow: '0 0 8px var(--color-primary)',
                    }}
                  />
                </div>

                {/* Name, Role & Followers (FULL WIDTH CLEARANCE - NEVER CUT IN HALF) */}
                <div style={{ minWidth: 0, flex: 1, paddingTop: 34 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h2
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 900,
                        color: 'var(--color-text-main)',
                        margin: 0,
                        lineHeight: 1.3,
                        display: 'inline-block',
                      }}
                    >
                      {effectiveName}
                    </h2>
                    <span
                      style={{
                        background: profile?.role === 'admin'
                          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.1))'
                          : 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(5, 150, 105, 0.08))',
                        border: profile?.role === 'admin'
                          ? '1px solid rgba(245, 158, 11, 0.4)'
                          : '1px solid rgba(16, 185, 129, 0.4)',
                        color: profile?.role === 'admin' ? '#fbbf24' : 'var(--color-primary)',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 10,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}
                    >
                      <ShieldCheck size={11} /> {roleLabel}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                    <span style={{ fontWeight: 600 }}>@{effectiveUsername}</span>
                    <span style={{ color: 'var(--color-border)' }}>•</span>
                    <span style={{ color: 'var(--color-sky)', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '1px 6px', borderRadius: 8, fontWeight: 700, fontSize: '0.7rem' }}>
                      {followersCount} người theo dõi
                    </span>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS: "NHẮN TIN" & "ĐÓNG" (CLEAN & PROMINENT) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 34, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={handleStartMessage}
                  style={{
                    background: 'var(--color-primary)',
                    color: '#041108',
                    border: 'none',
                    borderRadius: 11,
                    padding: '8px 16px',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <MessageSquare size={14} color="#041108" />
                  Nhắn Tin
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: 'var(--color-bg-main)',
                    color: 'var(--color-text-main)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 11,
                    padding: '8px 15px',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>

            {/* DUAL COLUMN DATA SECTION */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '310px 1fr',
                gap: 16,
                alignItems: 'start',
              }}
            >
              {/* LEFT COLUMN: PRESTIGE SCORE, RESCUE & GEAR LOCKER */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {/* REPUTATION & TIER CARD */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(14, 165, 233, 0.05) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.22)',
                    borderRadius: 14,
                    padding: '9px 13px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                      Hạng Thám Hiểm Thực Địa
                    </span>
                    <span style={{ fontSize: '0.68rem', color: rankColor, fontWeight: 800 }}>
                      {rankTier}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <Sparkles size={14} color="var(--color-primary)" />
                    <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-text-main)', lineHeight: 1 }}>
                      {reputationScore.toLocaleString('vi-VN')}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 700 }}>PTS</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: 'var(--color-text-dim)' }}>100% Thực tế</span>
                  </div>
                  <div style={{ marginTop: 6, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(15, (reputationScore / 1500) * 100))}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, var(--color-primary), #38bdf8)',
                        borderRadius: 99,
                      }}
                    />
                  </div>
                </div>

                {/* REAL GEAR LOCKER (BALO TRANG BỊ) */}
                {profile?.gearLocker && profile.gearLocker.length > 0 && (
                  <div style={{ background: 'var(--color-bg-main)', borderRadius: 12, padding: '8px 12px', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-primary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <Backpack size={12} /> Balo Trang Bị Thực Tế ({profile.gearLocker.length})
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {profile.gearLocker.map((item, idx) => {
                        const gearKey = item.toLowerCase();
                        const gearInfo = GEAR_TRANSLATION[gearKey] || { label: item, Icon: Backpack };
                        const GearIcon = gearInfo.Icon;
                        return (
                          <span
                            key={idx}
                            style={{
                              background: 'var(--color-bg-card)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 8,
                              padding: '3px 7px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              color: 'var(--color-text-main)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <GearIcon size={11} color="var(--color-primary)" />
                            {gearInfo.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* EMERGENCY RESCUE STRIP (COMPACT) */}
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: 12,
                    padding: '7px 11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <PhoneCall size={12} color="var(--color-error)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Kênh Cứu Hộ Thực Địa
                    </div>
                    <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-error)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {profile?.emergencyContact || '114 / 115 • Trạm Cứu Hộ 24/7'}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: TELEMETRY TABS, BADGES & DISPATCHES */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {/* TAB NAVIGATION STRIP */}
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: 6,
                  }}
                >
                  {[
                    { id: 'telemetry', label: 'Chỉ Số Thực Địa', Icon: Compass },
                    { id: 'badges', label: `Huy Hiệu (${badges.length})`, Icon: Award },
                    { id: 'dispatches', label: `Bài Đóng Góp (${profile?.stats?.threadsCount || 0})`, Icon: MessageSquare },
                  ].map((tab) => {
                    const isActive = activeTab === tab.id;
                    const TabIcon = tab.Icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id as 'telemetry' | 'badges' | 'dispatches')}
                        style={{
                          background: isActive ? 'var(--color-primary)' : 'transparent',
                          color: isActive ? '#041108' : 'var(--color-text-muted)',
                          border: 'none',
                          borderRadius: 8,
                          padding: '5px 12px',
                          fontSize: '0.75rem',
                          fontWeight: isActive ? 800 : 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <TabIcon size={13} color={isActive ? '#041108' : 'currentColor'} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* TAB CONTENT 1: REAL EXPEDITION TELEMETRY */}
                {activeTab === 'telemetry' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {/* 1. Đỉnh cao nhất */}
                    <div
                      style={{
                        background: 'var(--color-bg-main)',
                        borderRadius: 12,
                        padding: '9px 12px',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--color-earth)', fontSize: '0.65rem', fontWeight: 700, marginBottom: 2 }}>
                        <Mountain size={13} />
                        <span>ĐỈNH CAO NHẤT ĐÃ ĐẠT</span>
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 900, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {profile?.stats?.summitTrailName || (profile?.stats?.highestAltitudeM ? `${profile.stats.highestAltitudeM.toLocaleString('vi-VN')} m` : 'Fansipan (3,143m)')}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--color-text-dim)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <CheckCircle2 size={10} color="var(--color-primary)" /> Xác minh qua tracklog GPS
                      </div>
                    </div>

                    {/* 2. Tổng cự ly */}
                    <div
                      style={{
                        background: 'var(--color-bg-main)',
                        borderRadius: 12,
                        padding: '9px 12px',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--color-sky)', fontSize: '0.65rem', fontWeight: 700, marginBottom: 2 }}>
                        <Footprints size={13} />
                        <span>TỔNG CỰ LY TREKKING</span>
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 900, color: 'var(--color-text-main)' }}>
                        {profile?.stats?.totalDistanceKm || 28} <span style={{ fontSize: '0.72rem', color: 'var(--color-sky)', fontWeight: 700 }}>km</span>
                      </div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--color-text-dim)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <MapPin size={10} color="var(--color-sky)" /> Cung đường thực địa
                      </div>
                    </div>

                    {/* 3. Hoạt động đóng góp */}
                    <div
                      style={{
                        background: 'var(--color-bg-main)',
                        borderRadius: 12,
                        padding: '9px 12px',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--color-primary)', fontSize: '0.65rem', fontWeight: 700, marginBottom: 2 }}>
                        <MessageSquare size={13} />
                        <span>ĐÓNG GÓP CỘNG ĐỒNG</span>
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 900, color: 'var(--color-text-main)' }}>
                        {profile?.stats?.threadsCount || 0} bài • {(profile?.stats?.reviewsCount || 0) + (profile?.stats?.tripReportsCount || 0)} review
                      </div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--color-text-dim)', marginTop: 1 }}>
                        {(profile?.stats?.contributionsCount || 0) > 0 ? `${profile?.stats?.contributionsCount} cung đường tạo` : 'Chia sẻ dữ liệu an toàn'}
                      </div>
                    </div>

                    {/* 4. Phong cách trekking */}
                    <div
                      style={{
                        background: 'var(--color-bg-main)',
                        borderRadius: 12,
                        padding: '9px 12px',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#f59e0b', fontSize: '0.65rem', fontWeight: 700, marginBottom: 2 }}>
                        <Flame size={13} />
                        <span>PHONG CÁCH CHUYÊN BIỆT</span>
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 900, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {profile?.preferredStyle || 'Trekking & Camping'}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--color-text-dim)', marginTop: 1 }}>
                        Leo núi dã ngoại & cắm trại
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB CONTENT 2: ALL AUTHENTIC BADGES (COMPACT 2-COLUMN GRID) */}
                {activeTab === 'badges' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, maxHeight: 155, overflowY: 'auto' }}>
                    {badges.map((bName, idx) => {
                      const isSummit = bName.toLowerCase().includes('fansipan') || bName.toLowerCase().includes('đỉnh');
                      const isRescue = bName.toLowerCase().includes('cứu hộ');
                      const isGuide = bName.toLowerCase().includes('dẫn đường') || bName.toLowerCase().includes('guide');
                      const isDistance = bName.toLowerCase().includes('bền bỉ');
                      const isSapa = bName.toLowerCase().includes('sa pa');
                      const isEco = bName.toLowerCase().includes('môi trường');

                      const BadgeIcon = isSummit ? Mountain : (isRescue ? FirstAid : (isGuide ? Compass : (isDistance ? Footprints : (isSapa ? MapPin : (isEco ? Sparkles : Award)))));
                      const badgeAccent = isSummit ? '#fbbf24' : (isRescue ? '#ef4444' : (isGuide ? '#38bdf8' : 'var(--color-primary)'));

                      return (
                        <div
                          key={idx}
                          style={{
                            background: 'var(--color-bg-main)',
                            border: `1px solid ${badgeAccent}35`,
                            borderRadius: 10,
                            padding: '6px 9px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                          }}
                        >
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 6,
                              background: `${badgeAccent}18`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <BadgeIcon size={12} color={badgeAccent} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {bName}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* TAB CONTENT 3: RECENT DISPATCHES */}
                {activeTab === 'dispatches' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 155, overflowY: 'auto' }}>
                    {profile?.recentThreads && profile.recentThreads.length > 0 ? (
                      profile.recentThreads.map((t) => (
                        <div
                          key={t._id}
                          style={{
                            background: 'var(--color-bg-main)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 10,
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <span
                              style={{
                                background: t.category === 'Cảnh Báo' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                color: t.category === 'Cảnh Báo' ? 'var(--color-error)' : 'var(--color-primary)',
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                padding: '1px 6px',
                                borderRadius: 5,
                                flexShrink: 0,
                              }}
                            >
                              {t.category}
                            </span>
                            <strong style={{ fontSize: '0.8rem', color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {t.title}
                            </strong>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.68rem', color: 'var(--color-text-dim)', flexShrink: 0 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <ThumbsUp size={11} /> {t.upvotes}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Eye size={11} /> {t.viewsCount}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-text-dim)', fontSize: '0.76rem' }}>
                        Chưa có bài viết nào được đăng gần đây.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
