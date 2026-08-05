import React from 'react';
import type { Trail } from '../../types.js';
import { OptimizedImage } from '../common/OptimizedImage.js';

interface TrailCardProps {
  trail: Trail;
  onSelect: (trail: Trail) => void;
}

export const TrailCard: React.FC<TrailCardProps> = ({ trail, onSelect }) => {
  let diffBadgeClass = 'badge-success';
  let diffText = 'Dễ (Beginner)';
  if (trail.difficultyLevel >= 4) {
    diffBadgeClass = 'badge-error';
    diffText = 'Thử thách cao';
  } else if (trail.difficultyLevel === 3) {
    diffBadgeClass = 'badge-info';
    diffText = 'Trung bình';
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Cover Image & Overlay Badges */}
      <div style={{ position: 'relative', height: 200, borderRadius: 14, overflow: 'hidden', marginBottom: 18 }}>
        <OptimizedImage
          src={trail.coverImage}
          alt={trail.name}
          targetWidth={600}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(7, 13, 30, 0.88) 0%, transparent 60%)',
        }} />

        <div style={{
          position: 'absolute',
          top: 12,
          left: 12,
          maxWidth: 'calc(100% - 110px)',
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          alignItems: 'center',
          zIndex: 2,
        }}>
          <span className="badge badge-success">{trail.region}</span>
          <span className={`badge ${diffBadgeClass}`}>{diffText} ({trail.difficultyLevel}/5)</span>
        </div>

        <div style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          background: 'rgba(15, 24, 46, 0.92)',
          backdropFilter: 'blur(6px)',
          padding: '4px 12px',
          borderRadius: 20,
          border: '1px solid var(--color-border)',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-sun)',
        }}>
          {trail.rating} ({trail.reviewCount})
        </div>
      </div>

      {/* Info Section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-stream)', marginBottom: 4, fontWeight: 'var(--font-weight-bold)' }}>
          {trail.province}, {trail.district}
        </div>

        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-main)', marginBottom: 8, lineHeight: 'var(--line-height-tight)' }}>
          {trail.name}
        </h3>

        <p style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-muted)',
          marginBottom: 18,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          lineHeight: 'var(--line-height-normal)',
        }}>
          {trail.description}
        </p>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          background: 'var(--color-bg-main)',
          border: '1px solid var(--color-border)',
          padding: '12px 10px',
          borderRadius: 10,
          marginBottom: 18,
          fontSize: 'var(--font-size-xs)',
          textAlign: 'center',
        }}>
          <div>
            <div style={{ color: 'var(--color-text-dim)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)' }}>Độ dài</div>
            <strong style={{ color: 'var(--color-primary)' }}>{trail.distanceKm} km</strong>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-dim)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)' }}>Tích lũy</div>
            <strong style={{ color: 'var(--color-earth)' }}>+{trail.elevationGainM}m</strong>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-dim)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)' }}>Thời gian</div>
            <strong style={{ color: 'var(--color-sun)' }}>{trail.durationDays} ngày</strong>
          </div>
        </div>

        {/* Action Button */}
        <button
          className="btn btn-primary"
          onClick={() => onSelect(trail)}
          style={{ width: '100%', marginTop: 'auto', justifyContent: 'center' }}
        >
          Xem bản đồ & Chi tiết
        </button>
      </div>
    </div>
  );
};
