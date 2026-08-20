import React from 'react';

const createSvgIcon = (d: React.ReactNode, defaultSize = 18) => {
  return ({ size = defaultSize, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      {d}
    </svg>
  );
};

const X = createSvgIcon(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>);
const ShieldCheck = createSvgIcon(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></>);
const Mountain = createSvgIcon(<path d="M8 3l4 8 5-5 5 15H2L8 3z" />);
const Compass = createSvgIcon(<><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></>);
const Tent = createSvgIcon(<><path d="M19 21L12 3 5 21" /><path d="M12 13l3 8H9l3-8z" /></>);
const Award = createSvgIcon(<><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></>);
const QrCode = createSvgIcon(<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>);

export interface AuthorProfileData {
  name: string;
  avatar: string;
  role?: string;
  reputationScore?: number;
  badges?: string[];
  bio?: string;
  preferredStyle?: string;
  email?: string;
  phone?: string;
}

interface AuthorProfileModalProps {
  author: AuthorProfileData | null;
  onClose: () => void;
  onStartChat?: (targetUserId?: string, targetUserName?: string) => void;
}

export const AuthorProfileModal: React.FC<AuthorProfileModalProps> = ({ author, onClose, onStartChat }) => {
  if (!author) return null;

  const isTop = author.name.includes('Top Contributor') || (author.badges && author.badges.includes('Top Contributor'));
  const cleanName = author.name.replace(/\s*\([^)]*\)/g, '');

  const score = author.reputationScore !== undefined ? author.reputationScore : (isTop ? 85 : 50);
  const badgesList = author.badges || (isTop ? ['Trekker Mới', 'Verified Trekker', 'Top Contributor', 'Alpine Master'] : ['Trekker Mới', 'Verified Trekker']);

  const expeditionId = `TRK-${Math.abs(cleanName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) * 8848).toString(16).slice(0, 6).toUpperCase()}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 540,
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            right: 20,
            top: 20,
            background: 'none',
            border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={22} />
        </button>

        {/* Top Header Label */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-extrabold)', letterSpacing: 2, textTransform: 'uppercase' }}>
              TREKMAP OFFICIAL AUTHOR EXPEDITION PROFILE
            </div>
            <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)', marginTop: 2 }}>
              HỒ SƠ TÁC GIẢ BÀI ĐÓNG GÓP
            </div>
          </div>
        </div>

        {/* Avatar & Name Header Row */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 24, background: 'var(--color-bg-main)', padding: 16, borderRadius: 18, border: '1px solid var(--color-border)' }}>
          <div style={{ position: 'relative' }}>
            <img
              src={author.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80'}
              alt={cleanName}
              referrerPolicy="no-referrer"
              style={{
                width: 84,
                height: 84,
                borderRadius: 18,
                objectFit: 'cover',
                border: '2px solid var(--color-primary)',
                boxShadow: 'var(--shadow-sprout)',
              }}
            />
            <div style={{ position: 'absolute', bottom: -6, right: -6, background: 'var(--color-bg-card)', border: '1px solid var(--color-primary)', borderRadius: 8, padding: 3 }}>
              <QrCode size={16} color="var(--color-primary)" />
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)', margin: 0 }}>
              {cleanName}
            </h3>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-bold)', marginTop: 2 }}>
              ID Thám Hiểm: #{expeditionId}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-success" style={{ fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ShieldCheck size={13} color="var(--color-primary)" /> VERIFIED TREKKER
              </span>
              {isTop && (
                <span className="badge badge-amber" style={{ fontSize: 'var(--font-size-xs)' }}>
                  TOP CONTRIBUTOR
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 4 Detailed Expedition Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 22 }}>
          <div style={{ background: 'var(--color-bg-main)', padding: 14, borderRadius: 14, border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Award size={16} color="var(--color-primary)" />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Điểm Uy Tín</span>
            </div>
            <strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-primary)' }}>{score} PTS</strong>
          </div>

          <div style={{ background: 'var(--color-bg-main)', padding: 14, borderRadius: 14, border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Compass size={16} color="var(--color-sky)" />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Tổng Quãng Đường</span>
            </div>
            <strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-sky)' }}>58 km</strong>
          </div>

          <div style={{ background: 'var(--color-bg-main)', padding: 14, borderRadius: 14, border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Mountain size={16} color="var(--color-earth)" />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Đỉnh Cao Nhất</span>
            </div>
            <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-earth)' }}>3,143 m (Fansipan)</strong>
          </div>

          <div style={{ background: 'var(--color-bg-main)', padding: 14, borderRadius: 14, border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Tent size={16} color="var(--color-primary)" />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Phong Cách Trek</span>
            </div>
            <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)' }}>{author.preferredStyle || 'Trekking & Camping'}</strong>
          </div>
        </div>

        {/* Badges Collection List */}
        <div style={{ marginBottom: 22, background: 'var(--color-bg-main)', padding: 16, borderRadius: 16, border: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', display: 'block', marginBottom: 12 }}>
            Bộ Sưu Tập Huy Hiệu Danh Dự Sở Hữu ({badgesList.length}):
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {badgesList.map((badge, idx) => (
              <span
                key={idx}
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-primary)',
                  borderRadius: 12,
                  padding: '6px 14px',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Award size={13} /> {badge}
              </span>
            ))}
          </div>
        </div>

        {/* SOS Emergency Contact Box */}
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '12px 16px', borderRadius: 14, border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: 22, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>SOS Emergency Contact:</span>
          <strong style={{ color: 'var(--color-error)' }}>0988 776 655 (Liên hệ cứu hộ)</strong>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              onClose();
              const target = author.email || author.name;
              if (target) {
                localStorage.setItem('trekmap_target_chat_user', target);
              }
              if (onStartChat) {
                onStartChat(target, author.name);
              } else {
                window.location.hash = '#messages';
              }
            }}
            style={{ flex: 1, fontWeight: 800, justifyContent: 'center' }}
          >
            Nhắn Tin Trực Tiếp
          </button>
          <button className="btn btn-outline" onClick={onClose} style={{ flex: 1, fontWeight: 800, justifyContent: 'center' }}>
            Đóng Cửa Sổ
          </button>
        </div>
      </div>
    </div>
  );
};
