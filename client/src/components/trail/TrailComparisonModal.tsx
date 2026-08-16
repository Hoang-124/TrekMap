import React from 'react';
import type { Trail } from '../../types.js';
import { ElevationProfileSVG } from './ElevationProfileSVG.js';
import { OptimizedImage } from '../common/OptimizedImage.js';

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
            <span style={{ fontSize: '1.4rem' }}>⚖️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
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
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--color-border)',
              color: '#fff',
              borderRadius: '50%',
              width: 34,
              height: 34,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              transition: 'all 0.2s ease',
            }}
          >
            ✕
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
                {/* Remove from comparison */}
                <button
                  type="button"
                  onClick={() => onRemoveTrail(t.id)}
                  title="Xóa khỏi so sánh"
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 4,
                    background: 'rgba(0, 0, 0, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#f87171',
                    borderRadius: '50%',
                    width: 26,
                    height: 26,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                  }}
                >
                  ✕
                </button>

                {/* Trail Cover Image */}
                <div style={{ position: 'relative', height: 140, borderRadius: 12, overflow: 'hidden' }}>
                  <OptimizedImage
                    src={t.coverImage}
                    alt={t.name}
                    targetWidth={400}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 8,
                      left: 8,
                      background: 'rgba(7, 13, 30, 0.85)',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      color: 'var(--color-primary)',
                    }}
                  >
                    {t.region}
                  </div>
                </div>

                {/* Name & Region */}
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-stream)', fontWeight: 700 }}>
                    {t.province}, {t.district}
                  </div>
                  <h4 style={{ margin: '4px 0 0 0', fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
                    {t.name}
                  </h4>
                </div>

                {/* Elevation Profile Curve */}
                <div>
                  <ElevationProfileSVG
                    gpxTrack={t.gpxTrack}
                    elevationGainM={t.elevationGainM}
                    maxAltitudeM={t.maxAltitudeM}
                    distanceKm={t.distanceKm}
                    waypoints={t.waypoints}
                    height={110}
                  />
                </div>

                {/* Key Metrics Table */}
                <div
                  style={{
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
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-dim)' }}>🏔️ Độ cao đỉnh:</span>
                    <strong style={{ color: 'var(--color-sun)' }}>{t.maxAltitudeM}m</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-dim)' }}>📏 Chiều dài:</span>
                    <strong style={{ color: 'var(--color-primary)' }}>{t.distanceKm} km</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-dim)' }}>⚡ Tích lũy cao độ:</span>
                    <strong style={{ color: 'var(--color-earth)' }}>+{t.elevationGainM}m</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-dim)' }}>⏱️ Thời gian:</span>
                    <strong>{t.durationDays} ngày</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-dim)' }}>💪 Mức khó:</span>
                    <strong style={{ color: t.difficultyLevel >= 4 ? '#f87171' : '#4ade80' }}>
                      {t.difficultyLevel}/5
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-dim)' }}>⭐ Đánh giá:</span>
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
                    color: '#cbd5e1',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🏕️</span>
                    <span>Lán trại: {t.hasCampsite ? '✅ Có điểm cắm trại' : '❌ Chưa có lán'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>💧</span>
                    <span>Nguồn nước: {t.hasWaterSource ? '✅ Có suối/nguồn nước' : '⚠️ Cần mang đủ'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📅</span>
                    <span>
                      Mùa đẹp:{' '}
                      <strong>
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
