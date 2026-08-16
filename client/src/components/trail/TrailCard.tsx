import React, { useState } from 'react';
import type { Trail } from '../../types.js';
import { OptimizedImage } from '../common/OptimizedImage.js';

interface TrailCardProps {
  trail: Trail;
  onSelect: (trail: Trail) => void;
  isSelectedForCompare?: boolean;
  onToggleCompare?: (trail: Trail) => void;
}

// Mini SVG sparkline representing elevation contour
const MiniElevationSparkline: React.FC<{ elevationGainM: number; color?: string }> = ({
  elevationGainM,
  color = 'var(--color-earth)',
}) => {
  const points = '0,18 8,14 16,16 26,8 36,12 46,4 56,10 64,2 72,8 80,18';
  return (
    <svg width="48" height="18" viewBox="0 0 80 20" style={{ overflow: 'visible', opacity: 0.9 }}>
      <defs>
        <linearGradient id={`sparkGrad-${elevationGainM}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={`${points} 80,20 0,20`} fill={`url(#sparkGrad-${elevationGainM})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const TrailCard: React.FC<TrailCardProps> = ({
  trail,
  onSelect,
  isSelectedForCompare,
  onToggleCompare,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  let diffBadgeClass = 'badge-success';
  let diffText = 'Dễ (Beginner)';
  let isHard = false;

  if (trail.difficultyLevel >= 4) {
    diffBadgeClass = 'badge-error';
    diffText = 'Thử thách cao';
    isHard = true;
  } else if (trail.difficultyLevel === 3) {
    diffBadgeClass = 'badge-info';
    diffText = 'Trung bình';
  }

  return (
    <div
      className="card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        borderRadius: 16,
        background: 'var(--color-bg-card)',
        border: `1px solid ${isSelectedForCompare ? 'var(--color-primary)' : isHovered ? 'var(--color-border-glow)' : 'var(--color-border)'}`,
        boxShadow: isHovered
          ? '0 20px 35px -8px rgba(0, 0, 0, 0.6), 0 0 20px -2px rgba(74, 222, 128, 0.15)'
          : 'var(--shadow-card)',
        transform: isHovered ? 'translateY(-6px)' : 'translateY(0)',
        transition: 'all 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
      }}
    >
      {/* Cover Image & Overlay Badges */}
      <div
        style={{
          position: 'relative',
          height: 200,
          borderRadius: 12,
          overflow: 'hidden',
          margin: 8,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            transform: isHovered ? 'scale(1.07)' : 'scale(1.0)',
            transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <OptimizedImage
            src={trail.coverImage}
            alt={trail.name}
            targetWidth={600}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        {/* Ambient Top/Bottom Gradients */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: isHovered
              ? 'linear-gradient(to top, rgba(7, 13, 30, 0.92) 0%, rgba(7, 13, 30, 0.2) 50%, rgba(7, 13, 30, 0.4) 100%)'
              : 'linear-gradient(to top, rgba(7, 13, 30, 0.88) 0%, transparent 60%)',
            transition: 'background 0.3s ease',
            pointerEvents: 'none',
          }}
        />

        {/* Top-Left Badges */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            maxWidth: 'calc(100% - 70px)',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            alignItems: 'center',
            zIndex: 2,
          }}
        >
          <span className="badge badge-success" style={{ fontWeight: 800 }}>
            {trail.region}
          </span>
          <span
            className={`badge ${diffBadgeClass}`}
            style={{
              fontWeight: 800,
              boxShadow: isHard ? '0 0 10px rgba(239, 68, 68, 0.4)' : undefined,
            }}
          >
            {diffText} ({trail.difficultyLevel}/5)
          </span>
        </div>

        {/* Compare Toggle Button at Top-Right */}
        {onToggleCompare && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCompare(trail);
            }}
            title={isSelectedForCompare ? 'Bỏ chọn so sánh' : 'Chọn để so sánh'}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 3,
              background: isSelectedForCompare ? 'var(--color-primary)' : 'rgba(15, 24, 46, 0.85)',
              color: isSelectedForCompare ? '#070d1e' : '#cbd5e1',
              border: `1px solid ${isSelectedForCompare ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.2)'}`,
              borderRadius: 20,
              padding: '4px 8px',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s ease',
            }}
          >
            <span>{isSelectedForCompare ? '✓' : '＋'}</span>
            <span>So sánh</span>
          </button>
        )}

        {/* Rating Badge at Bottom-Right */}
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            right: 10,
            background: 'rgba(15, 24, 46, 0.92)',
            backdropFilter: 'blur(6px)',
            padding: '3px 10px',
            borderRadius: 20,
            border: '1px solid var(--color-border)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-sun)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            zIndex: 2,
          }}
        >
          <span>★</span>
          <span>
            {trail.rating} ({trail.reviewCount})
          </span>
        </div>

        {/* Max Altitude Pill at Bottom-Left */}
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            background: 'rgba(7, 13, 30, 0.85)',
            backdropFilter: 'blur(6px)',
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'var(--color-sky)',
            zIndex: 2,
          }}
        >
          🏔️ {trail.maxAltitudeM}m
        </div>
      </div>

      {/* Info Section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 16px 16px 16px' }}>
        <div
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-stream)',
            marginBottom: 4,
            fontWeight: 'var(--font-weight-bold)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>📍</span>
          <span>
            {trail.province}, {trail.district}
          </span>
        </div>

        <h3
          style={{
            fontSize: '1.08rem',
            fontWeight: 800,
            color: isHovered ? 'var(--color-primary)' : 'var(--color-text-main)',
            marginBottom: 6,
            lineHeight: 1.3,
            transition: 'color 0.2s ease',
          }}
        >
          {trail.name}
        </h3>

        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-muted)',
            marginBottom: 14,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 'var(--line-height-normal)',
          }}
        >
          {trail.description}
        </p>

        {/* Stats Grid with Mini Sparkline */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 6,
            background: 'var(--color-bg-main)',
            border: '1px solid var(--color-border)',
            padding: '10px 8px',
            borderRadius: 12,
            marginBottom: 16,
            fontSize: 'var(--font-size-xs)',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ color: 'var(--color-text-dim)', fontSize: '0.72rem', fontWeight: 600 }}>
              Độ dài
            </div>
            <strong style={{ color: 'var(--color-primary)', fontSize: '0.85rem' }}>
              {trail.distanceKm} km
            </strong>
          </div>

          <div>
            <div style={{ color: 'var(--color-text-dim)', fontSize: '0.72rem', fontWeight: 600 }}>
              Tích lũy
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <strong style={{ color: 'var(--color-earth)', fontSize: '0.85rem' }}>
                +{trail.elevationGainM}m
              </strong>
              <MiniElevationSparkline elevationGainM={trail.elevationGainM} />
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--color-text-dim)', fontSize: '0.72rem', fontWeight: 600 }}>
              Thời gian
            </div>
            <strong style={{ color: 'var(--color-sun)', fontSize: '0.85rem' }}>
              {trail.durationDays} ngày
            </strong>
          </div>
        </div>

        {/* Action Button */}
        <button
          className="btn btn-primary"
          onClick={() => onSelect(trail)}
          style={{
            width: '100%',
            marginTop: 'auto',
            justifyContent: 'center',
            fontWeight: 800,
            borderRadius: 10,
            boxShadow: isHovered ? '0 4px 14px rgba(74, 222, 128, 0.35)' : undefined,
            transition: 'all 0.2s ease',
          }}
        >
          Xem Bản Đồ & Chi Tiết →
        </button>
      </div>
    </div>
  );
};
