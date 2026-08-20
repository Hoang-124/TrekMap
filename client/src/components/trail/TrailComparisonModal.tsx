import React from 'react';
import type { Trail } from '../../types.js';

interface TrailComparisonModalProps {
  trails: Trail[];
  isOpen: boolean;
  onClose: () => void;
  onRemoveTrail: (trailId: string) => void;
  onSelectTrail: (trail: Trail) => void;
}

export const TrailComparisonModal: React.FC<TrailComparisonModalProps> = ({
  trails,
  isOpen,
  onClose,
  onRemoveTrail,
  onSelectTrail,
}) => {
  if (!isOpen || trails.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(4, 8, 20, 0.85)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 24,
          maxWidth: 1100,
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(74, 222, 128, 0.15)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid var(--color-border)',
            background: 'rgba(7, 13, 30, 0.7)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-sky)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                <path d="M7 21h10" />
                <path d="M12 3v18" />
                <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                Bảng So Sánh Cung Đường Trekking
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
                So sánh trực quan địa hình, độ khó, thời tiết và dịch vụ hỗ trợ ({trails.length} cung đường)
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--color-border)',
              border: 'none',
              color: 'var(--color-text-muted)',
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Comparison Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${trails.length}, minmax(260px, 1fr))`,
              gap: 18,
              alignItems: 'start',
            }}
          >
            {trails.map((t) => (
              <div
                key={t.id}
                style={{
                  background: 'rgba(7, 13, 30, 0.5)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 18,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  position: 'relative',
                }}
              >
                <button
                  type="button"
                  onClick={() => onRemoveTrail(t.id)}
                  title="Bỏ khỏi so sánh"
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 4,
                    background: 'rgba(0, 0, 0, 0.75)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: 'var(--color-error)',
                    borderRadius: '50%',
                    width: 26,
                    height: 26,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>

                {/* Trail Cover Image */}
                <div style={{ height: 130, position: 'relative' }}>
                  <img
                    src={t.coverImage}
                    alt={t.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      background: 'rgba(0, 0, 0, 0.7)',
                      backdropFilter: 'blur(6px)',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: 'var(--color-sky)',
                    }}
                  >
                    {t.province}
                  </div>
                </div>

                {/* Trail Name & Region */}
                <div style={{ padding: '12px 14px 4px 14px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1.3 }}>
                    {t.name}
                  </h4>
                  <div style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)', marginTop: 3 }}>
                    {t.region} • {t.district}
                  </div>
                </div>

                {/* Technical Specs Comparison */}
                <div
                  style={{
                    margin: '8px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    background: 'var(--color-bg-card)',
                    padding: '12px 14px',
                    borderRadius: 12,
                    fontSize: '0.82rem',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m8 3 4 8 5-5 5 15H2L8 3z" /></svg>
                      <span>Độ cao đỉnh:</span>
                    </span>
                    <strong style={{ color: 'var(--color-sun)' }}>{t.maxAltitudeM}m</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l-3-3Z"/></svg>
                      <span>Chiều dài:</span>
                    </span>
                    <strong style={{ color: 'var(--color-primary)' }}>{t.distanceKm} km</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                      <span>Tích lũy cao độ:</span>
                    </span>
                    <strong style={{ color: 'var(--color-earth)' }}>+{t.elevationGainM}m</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      <span>Thời gian:</span>
                    </span>
                    <strong>{t.durationDays} ngày</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-dim)' }}>Mức độ khó:</span>
                    <strong style={{ color: t.difficultyLevel >= 4 ? 'var(--color-error)' : 'var(--color-primary)' }}>
                      {t.difficultyLevel}/5
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--color-sun)" stroke="var(--color-sun)" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                      <span>Đánh giá:</span>
                    </span>
                    <strong style={{ color: 'var(--color-sun)' }}>
                      {t.rating} ({t.reviewCount})
                    </strong>
                  </div>
                </div>

                {/* Amenities / Infrastructure */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: '0.78rem',
                    color: 'var(--color-text-muted)',
                    padding: '0 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: t.hasCampsite ? 'var(--color-primary)' : 'var(--color-error)', fontWeight: 600 }}>
                      {t.hasCampsite ? '✓ Có điểm cắm trại / Lán' : '✗ Chưa có lán trại'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: t.hasWaterSource ? 'var(--color-sky)' : 'var(--color-sun)', fontWeight: 600 }}>
                      {t.hasWaterSource ? '✓ Có suối & nguồn nước' : '! Cần tự mang đủ nước'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>
                      Mùa đẹp:{' '}
                      <strong style={{ color: 'var(--color-text-main)' }}>
                        {t.bestMonths && t.bestMonths.length > 0 ? `Tháng ${t.bestMonths.join(', ')}` : 'Quanh năm'}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Action button */}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    onClose();
                    onSelectTrail(t);
                  }}
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    fontWeight: 800,
                    marginTop: 'auto',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                  }}
                >
                  Xem Chi Tiết Cung Này →
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
