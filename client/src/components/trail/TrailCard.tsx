import React, { useState } from 'react';
import type { Trail } from '../../types.js';
import { OptimizedImage } from '../common/OptimizedImage.js';
import {
  IconMountain,
  IconMapPin,
  IconTent,
  IconDroplet,
  IconClock,
  IconShieldAlert,
} from '../common/SvgIcons.js';

interface TrailCardProps {
  trail: Trail;
  onSelect: (trail: Trail) => void;
  isSelectedForCompare?: boolean;
  onToggleCompare?: (trail: Trail) => void;
}

export const TrailCard: React.FC<TrailCardProps> = ({
  trail,
  onSelect,
  isSelectedForCompare,
  onToggleCompare,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  let diffBadgeClass = 'badge-success';
  let diffText = 'Dễ';
  let isHard = false;

  if (trail.difficultyLevel >= 4) {
    diffBadgeClass = 'badge-error';
    diffText = 'Khó';
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
        borderRadius: 14,
        background: 'var(--color-bg-card)',
        border: `1px solid ${isSelectedForCompare ? 'var(--color-primary)' : isHovered ? 'var(--color-border-glow)' : 'var(--color-border)'}`,
        boxShadow: isHovered
          ? '0 12px 28px -6px rgba(0, 0, 0, 0.5), 0 0 16px -2px rgba(74, 222, 128, 0.15)'
          : 'var(--shadow-card)',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
      }}
    >
      {/* Cover Image & Overlay Badges */}
      <div
        style={{
          position: 'relative',
          height: 135,
          borderRadius: 10,
          overflow: 'hidden',
          margin: '6px 6px 8px 6px',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            transform: isHovered ? 'scale(1.05)' : 'scale(1.0)',
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <OptimizedImage
            src={trail.coverImage}
            alt={trail.name}
            targetWidth={500}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        {/* Ambient Top/Bottom Gradients */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: isHovered
              ? 'linear-gradient(to top, rgba(7, 13, 30, 0.9) 0%, rgba(7, 13, 30, 0.15) 50%, rgba(7, 13, 30, 0.4) 100%)'
              : 'linear-gradient(to top, rgba(7, 13, 30, 0.85) 0%, transparent 60%)',
            transition: 'background 0.3s ease',
            pointerEvents: 'none',
          }}
        />

        {/* Top-Left Badges */}
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            maxWidth: 'calc(100% - 65px)',
            display: 'flex',
            gap: 4,
            flexWrap: 'wrap',
            alignItems: 'center',
            zIndex: 2,
          }}
        >
          <span className="badge badge-success" style={{ fontWeight: 800, fontSize: '0.66rem', padding: '2px 6px' }}>
            {trail.region}
          </span>
          <span
            className={`badge ${diffBadgeClass}`}
            style={{
              fontWeight: 800,
              fontSize: '0.66rem',
              padding: '2px 6px',
              boxShadow: isHard ? '0 0 8px rgba(239, 68, 68, 0.4)' : undefined,
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
              top: 6,
              right: 6,
              zIndex: 3,
              background: isSelectedForCompare ? 'var(--color-primary)' : 'rgba(15, 24, 46, 0.85)',
              color: isSelectedForCompare ? 'var(--color-bg-main)' : 'var(--color-text-muted)',
              border: `1px solid ${isSelectedForCompare ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.2)'}`,
              borderRadius: 16,
              padding: '2px 7px',
              fontSize: '0.68rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s ease',
            }}
          >
            {isSelectedForCompare ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
            <span>So sánh</span>
          </button>
        )}

        {/* Rating Badge at Bottom-Right */}
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            right: 6,
            background: 'rgba(15, 24, 46, 0.92)',
            backdropFilter: 'blur(6px)',
            padding: '2px 7px',
            borderRadius: 16,
            border: '1px solid var(--color-border)',
            fontSize: '0.68rem',
            fontWeight: 800,
            color: 'var(--color-sun)',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            zIndex: 2,
          }}
        >
          {trail.reviewCount && trail.reviewCount > 0 && trail.rating && trail.rating > 0 && !(String(trail.id).startsWith('contrib-') && trail.reviewCount === 1) ? (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--color-sun)" stroke="var(--color-sun)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>
                {Number(trail.rating).toFixed(1)} ({trail.reviewCount})
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>Mới</span>
          )}
        </div>

        {/* Max Altitude Pill at Bottom-Left */}
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            left: 6,
            background: 'rgba(7, 13, 30, 0.85)',
            backdropFilter: 'blur(6px)',
            padding: '2px 6px',
            borderRadius: 5,
            fontSize: '0.68rem',
            fontWeight: 800,
            color: 'var(--color-sky)',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <IconMountain size={11} color="var(--color-sky)" />
          <span>{trail.maxAltitudeM}m</span>
        </div>
      </div>

      {/* Info Section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 12px 12px 12px' }}>
        <div
          style={{
            fontSize: '0.7rem',
            color: 'var(--color-stream)',
            marginBottom: 2,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <IconMapPin size={11} color="var(--color-stream)" />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {trail.province}{trail.district ? `, ${trail.district}` : ''}
          </span>
        </div>

        <h3
          style={{
            fontSize: '0.92rem',
            fontWeight: 800,
            color: isHovered ? 'var(--color-primary)' : 'var(--color-text-main)',
            marginBottom: trail.altNames && trail.altNames.length > 0 ? 1 : 4,
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            transition: 'color 0.2s ease',
          }}
          title={trail.name}
        >
          {trail.name}
        </h3>

        {trail.altNames && trail.altNames.length > 0 && (
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontStyle: 'italic', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Tên khác: {trail.altNames.join(', ')}
          </div>
        )}

        <p
          style={{
            fontSize: '0.74rem',
            color: 'var(--color-text-muted)',
            marginBottom: 8,
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.35,
          }}
        >
          {trail.description}
        </p>

        {/* Stats Grid with Mini Sparkline */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 4,
            background: 'var(--color-bg-main)',
            border: '1px solid var(--color-border)',
            padding: '6px 4px',
            borderRadius: 8,
            marginBottom: 8,
            fontSize: '0.72rem',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ color: 'var(--color-text-dim)', fontSize: '0.65rem', fontWeight: 600 }}>
              Độ dài
            </div>
            <strong style={{ color: 'var(--color-primary)', fontSize: '0.78rem' }}>
              {trail.distanceKm} km
            </strong>
          </div>

          <div>
            <div style={{ color: 'var(--color-text-dim)', fontSize: '0.65rem', fontWeight: 600 }}>
              Tích lũy
            </div>
            <strong style={{ color: 'var(--color-earth)', fontSize: '0.78rem' }}>
              +{trail.elevationGainM}m
            </strong>
          </div>

          <div>
            <div style={{ color: 'var(--color-text-dim)', fontSize: '0.65rem', fontWeight: 600 }}>
              Thời gian
            </div>
            <strong style={{ color: 'var(--color-sun)', fontSize: '0.74rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
              {trail.durationHoursNote || `${trail.durationDays} ngày`}
            </strong>
          </div>
        </div>

        {/* Amenities Pills & Season Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {trail.hasCampsite && (
              <span style={{ fontSize: '0.64rem', padding: '1px 5px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-primary)', border: '1px solid var(--color-border)', display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 700 }}>
                <IconTent size={10} color="var(--color-primary)" /> Bãi trại
              </span>
            )}
            {trail.hasWaterSource && (
              <span style={{ fontSize: '0.64rem', padding: '1px 5px', borderRadius: 4, background: 'rgba(56, 189, 248, 0.12)', color: 'var(--color-sky)', border: '1px solid var(--color-border)', display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 700 }}>
                <IconDroplet size={10} color="var(--color-sky)" /> Nước
              </span>
            )}
            {trail.permitRequired && (
              <span style={{ fontSize: '0.64rem', padding: '1px 5px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.12)', color: 'var(--color-error)', border: '1px solid var(--color-border)', display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 700 }}>
                <IconShieldAlert size={10} color="var(--color-error)" /> Giấy phép
              </span>
            )}
          </div>
          {trail.bestMonths && trail.bestMonths.length > 0 && (
            <div style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <IconClock size={10} color="var(--color-text-dim)" />
              <span>T.{trail.bestMonths.slice(0, 3).join(', ')}{trail.bestMonths.length > 3 ? '...' : ''}</span>
            </div>
          )}
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
            fontSize: '0.78rem',
            padding: '7px 10px',
            borderRadius: 8,
            boxShadow: isHovered ? '0 4px 12px rgba(74, 222, 128, 0.35)' : undefined,
            transition: 'all 0.2s ease',
          }}
        >
          Xem Bản Đồ & Chi Tiết →
        </button>
      </div>
    </div>
  );
};
