import React from 'react';
import type { Trail } from '../../types.js';
import { OptimizedImage } from '../common/OptimizedImage.js';
import { IconStar, IconArrowRight } from '../common/SvgIcons.js';

interface TrailCardProps {
  trail: Trail;
  onSelect: (trail: Trail) => void;
  isSelectedForCompare?: boolean;
  onToggleCompare?: (trail: Trail) => void;
}

export const TrailCard: React.FC<TrailCardProps> = React.memo(({
  trail,
  onSelect,
  isSelectedForCompare,
  onToggleCompare,
}) => {
  let diffText = 'Dễ';
  if (trail.difficultyLevel >= 4) diffText = 'Khó';
  else if (trail.difficultyLevel === 3) diffText = 'Trung bình';

  const hasRating = Boolean(
    trail.reviewCount &&
      trail.reviewCount > 0 &&
      trail.rating &&
      trail.rating > 0
  );

  return (
    <article
      className="trail-editorial-card"
      data-selected={isSelectedForCompare ? 'true' : undefined}
    >
      {/* Full-card accessible sibling trigger (eliminates invalid nested interactive elements) */}
      <button
        type="button"
        aria-label={`Xem chi tiết cung ${trail.name}`}
        onClick={() => onSelect(trail)}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'pointer',
        }}
      />

      {/* Full-Bleed Editorial Mountain Photograph (Pure-CSS GPU Zoom) */}
      <div className="trail-editorial-media" style={{ pointerEvents: 'none' }}>
        <OptimizedImage
          src={trail.coverImage}
          alt={trail.name}
          targetWidth={720}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* Dual-Layer Tokenized Scrim (True Opacity Cross-Fade on Hover) */}
      <div className="trail-editorial-scrim-base" aria-hidden="true" />
      <div className="trail-editorial-scrim-hover" aria-hidden="true" />

      {/* Top Margin Metadata */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontSize: '0.66rem',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'color-mix(in srgb, var(--color-on-media) 88%, transparent)',
            textShadow: '0 1px 4px var(--overlay-bg)',
          }}
        >
          {trail.region} · {diffText} {trail.difficultyLevel}/5
        </span>

        {onToggleCompare && (
          <button
            type="button"
            className="interactive-click"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCompare(trail);
            }}
            title={isSelectedForCompare ? 'Bỏ khỏi so sánh' : 'Thêm vào so sánh'}
            style={{
              position: 'relative',
              zIndex: 3,
              pointerEvents: 'auto',
              background: isSelectedForCompare
                ? 'var(--color-primary)'
                : 'var(--overlay-bg)',
              color: isSelectedForCompare ? 'var(--color-on-primary)' : 'var(--color-on-media)',
              border: `1px solid ${
                isSelectedForCompare
                  ? 'var(--color-primary)'
                  : 'color-mix(in srgb, var(--color-on-media) 28%, transparent)'
              }`,
              borderRadius: 4,
              padding: '3px 8px',
              fontSize: '0.68rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {isSelectedForCompare ? 'Đã chọn' : '+ So sánh'}
          </button>
        )}
      </div>

      {/* Bottom Editorial Plate Typography */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2,
          padding: '18px 18px 16px 18px',
          color: 'var(--color-on-media)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.7rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-sun)',
            fontWeight: 700,
            marginBottom: 6,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {trail.province}
          </span>
          <span style={{ flexShrink: 0, marginLeft: 8 }}>
            {trail.maxAltitudeM.toLocaleString('vi-VN')} M
          </span>
        </div>

        <h3
          className="font-editorial"
          style={{
            fontSize: '1.38rem',
            fontWeight: 500,
            color: 'var(--color-on-media)',
            margin: '0 0 10px 0',
            lineHeight: 1.18,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {trail.name}
        </h3>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 10,
            borderTop: '1px solid color-mix(in srgb, var(--color-on-media) 18%, transparent)',
            fontSize: '0.74rem',
            color: 'color-mix(in srgb, var(--color-on-media) 80%, transparent)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span>
              {trail.distanceKm} km · +{trail.elevationGainM} m
            </span>
            {hasRating && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--color-sun)', fontWeight: 700 }}>
                <span>·</span>
                <IconStar size={11} color="var(--color-sun)" fill="var(--color-sun)" />
                <span>{Number(trail.rating).toFixed(1)}</span>
              </span>
            )}
          </span>
          <span className="trail-editorial-cta">
            <span>Xem cung</span>
            <IconArrowRight size={13} />
          </span>
        </div>
      </div>
    </article>
  );
});
