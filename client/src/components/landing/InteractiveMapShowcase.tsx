import React, { useCallback, useMemo, useState } from 'react';
import type { Trail, Incident } from '../../types.js';
import { MapView } from '../map/MapView.js';
import { IconLightbulb, IconCalendar, IconX, IconStar } from '../common/SvgIcons.js';
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator.js';

const VERIFIED_TRAIL_FALLBACK =
  'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329097/trekmap/trails/trail_cover_trail-fansipan.jpg';

// Pure Vector SVG Components (Rule 12 compliant)
const Mountain = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    <path d="M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19" />
  </svg>
);

const Footprints = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.5V16a2 2 0 0 1-2 2 2 2 0 0 1-2-2z" />
    <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.5V20a2 2 0 0 0 2 2 2 2 0 0 0 2-2z" />
  </svg>
);

const TrendingUp = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

const Clock = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const Download = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const PhoneCall = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const ShieldCheck = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const MapPin = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const ArrowRight = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

interface InteractiveMapShowcaseProps {
  trails: Trail[];
  selectedTrail: Trail | null;
  onSelectTrail: (trail: Trail) => void;
  incidents?: Incident[];
  selectedRegion?: string;
  onSelectRegion?: (region: string) => void;
  selectedMonth?: number | null;
  onClearMonthFilter?: () => void;
  onExploreFullMap?: () => void;
}

const getDifficultyBadge = (difficulty: number) => {
  const diff = Number(difficulty) || 3;
  if (diff >= 4) {
    return {
      label: 'Khó',
      color: 'var(--color-error-text, var(--color-error))',
      bg: 'color-mix(in srgb, var(--color-error) 16%, transparent)',
      border: 'color-mix(in srgb, var(--color-error) 42%, transparent)',
    };
  }
  if (diff === 3) {
    return {
      label: 'Trung Bình',
      color: 'var(--color-sun)',
      bg: 'color-mix(in srgb, var(--color-sun) 16%, transparent)',
      border: 'color-mix(in srgb, var(--color-sun) 42%, transparent)',
    };
  }
  return {
    label: 'Dễ',
    color: 'var(--color-primary)',
    bg: 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
    border: 'color-mix(in srgb, var(--color-primary) 42%, transparent)',
  };
};

function extractPrimaryDialNumber(phone?: string): string {
  if (!phone) return '112';
  const primary = String(phone).split('/')[0] || '';
  return primary.replace(/[^0-9+]/g, '') || '112';
}

const InteractiveMapShowcaseBase: React.FC<InteractiveMapShowcaseProps> = ({
  trails,
  selectedTrail,
  onSelectTrail,
  incidents = [],
  selectedRegion = 'All',
  onSelectRegion,
  selectedMonth,
  onClearMonthFilter,
  onExploreFullMap,
}) => {
  const regionCounts = useMemo(() => {
    const counts = {
      All: trails.length,
      'Miền Bắc': 0,
      'Miền Trung': 0,
      'Miền Nam': 0,
    };
    for (const t of trails) {
      if (t.region === 'Miền Bắc') counts['Miền Bắc']++;
      else if (t.region === 'Miền Trung') counts['Miền Trung']++;
      else if (t.region === 'Miền Nam') counts['Miền Nam']++;
    }
    return counts;
  }, [trails]);

  const filteredTrails = useMemo(() => {
    return trails.filter((t) => {
      if (selectedRegion && selectedRegion !== 'All' && selectedRegion !== 'Tất Cả') {
        if (t.region !== selectedRegion) return false;
      }
      if (selectedMonth) {
        if (Array.isArray(t.bestMonths) && t.bestMonths.length > 0) {
          return t.bestMonths.includes(selectedMonth) && (!t.avoidMonths || !t.avoidMonths.includes(selectedMonth));
        }
        return !t.avoidMonths?.includes(selectedMonth);
      }
      return true;
    });
  }, [trails, selectedRegion, selectedMonth]);

  const [focusedTrail, setFocusedTrail] = useState<Trail | null>(null);
  const normalizedRegionKey = selectedRegion === 'Tất Cả' ? 'All' : selectedRegion || 'All';
  const { trackRef: regionTrackRef, indicatorStyle: regionIndicatorStyle } =
    useSlidingIndicator<string>(normalizedRegionKey);

  const activeTrail = useMemo(() => {
    if (selectedTrail) return selectedTrail;
    if (focusedTrail && filteredTrails.some((t) => t.id === focusedTrail.id)) {
      return focusedTrail;
    }
    return filteredTrails.length > 0 ? filteredTrails[0] : trails.length > 0 ? trails[0] : null;
  }, [selectedTrail, focusedTrail, filteredTrails, trails]);

  const activeDiff = activeTrail ? getDifficultyBadge(activeTrail.difficultyLevel) : null;

  const handleDownloadGpx = useCallback((trail: Trail) => {
    if (!trail.gpxTrack || trail.gpxTrack.length === 0) {
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: { message: `Cung đường ${trail.name} đang cập nhật tracklog GPX.`, type: 'info' },
        })
      );
      return;
    }
    const escapeXml = (str: string) =>
      String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    const trackPointsXml = trail.gpxTrack
      .map(([lat, lng]) => `      <trkpt lat="${Number(lat)}" lon="${Number(lng)}"></trkpt>`)
      .join('\n');
    const safeName = escapeXml(trail.name);
    const safeDesc = escapeXml(trail.description || '');
    const gpxXml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LOST Vietnam - https://lost.vn">
  <metadata>
    <name>${safeName}</name>
    <desc>${safeDesc}</desc>
  </metadata>
  <trk>
    <name>${safeName}</name>
    <trkseg>
${trackPointsXml}
    </trkseg>
  </trk>
</gpx>`;
    const blob = new Blob([gpxXml], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${trail.id || 'tracklog'}_LOST.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    window.dispatchEvent(
      new CustomEvent('lost:show-toast', {
        detail: { message: `Đã tải xuống file GPX của ${trail.name}!`, type: 'success' },
      })
    );
  }, []);

  return (
    <section
      style={{
        padding: '20px 0 36px 0',
        maxWidth: 1360,
        margin: '0 auto',
      }}
    >
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 22,
        }}
      >
        <div>
          <div className="section-eyebrow">01 / Bản đồ thực địa Việt Nam</div>

          <h2
            className="font-editorial"
            style={{
              fontSize: 'clamp(1.75rem, 3.2vw, 2.55rem)',
              fontWeight: 500,
              color: 'var(--color-text-main)',
              letterSpacing: '-0.025em',
              margin: '0 0 6px 0',
              lineHeight: 1.12,
            }}
          >
            Bản đồ địa hình{' '}
            <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
              &amp; hồ sơ tuyến trek
            </span>
          </h2>

          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.88rem',
              lineHeight: 1.55,
              margin: 0,
              maxWidth: 660,
            }}
          >
            Chọn trực tiếp một đỉnh núi trên bản đồ hoặc từ danh sách bên phải để xem trắc diện cao độ, thông tin kiểm lâm và tải tệp GPX.
          </p>
        </div>

        {/* Region Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {selectedMonth && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-border-glow)',
                padding: '6px 12px',
                borderRadius: 4,
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--color-primary)',
              }}
            >
              <IconCalendar size={14} color="var(--color-primary)" />
              <span>Tháng {selectedMonth} ({filteredTrails.length} cung)</span>
              {onClearMonthFilter && (
                <button
                  type="button"
                  onClick={onClearMonthFilter}
                  aria-label="Xóa bộ lọc tháng"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-main)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Bỏ lọc theo tháng (Hiện tất cả)"
                >
                  <IconX size={12} color="var(--color-text-main)" />
                </button>
              )}
            </div>
          )}

          {onSelectRegion && (
            <div
              ref={regionTrackRef}
              className="lost-glider-track"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                background: 'var(--color-bg-card)',
                padding: 3,
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                gap: 2,
              }}
            >
              <span
                aria-hidden="true"
                className="lost-glider-pill with-accent"
                style={regionIndicatorStyle}
              />
              {(['All', 'Miền Bắc', 'Miền Trung', 'Miền Nam'] as const).map((reg) => {
                const isSelected = selectedRegion === reg || (reg === 'All' && selectedRegion === 'Tất Cả');
                const label = reg === 'All' ? 'Tất cả' : reg;
                const count = regionCounts[reg] || 0;

                return (
                  <button
                    key={reg}
                    type="button"
                    data-glider-active={isSelected ? 'true' : undefined}
                    className="lost-glider-item"
                    onClick={() => onSelectRegion(reg)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 4,
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 700 : 500,
                      border: 'none',
                      background: 'transparent',
                      color: isSelected ? 'var(--color-text-main)' : 'var(--color-text-dim)',
                      cursor: 'pointer',
                      transition: 'color 200ms ease',
                    }}
                  >
                    <span>{label}</span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: isSelected ? 'var(--color-primary)' : 'var(--color-text-dim)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {onExploreFullMap && (
            <button
              type="button"
              onClick={onExploreFullMap}
              className="btn btn-primary"
              style={{
                borderRadius: 4,
                padding: '8px 16px',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>Toàn màn hình</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* SPLIT SCREEN LAYOUT (Matched Height, Zero Overflow or Vertical Clipping) */}
      <div className="map-showcase-split">
        {/* LEFT COLUMN: Embedded Live Leaflet Map */}
        <div
          id="gis-map-canvas"
          style={{
            minHeight: 530,
            height: '100%',
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid var(--color-border-strong)',
            boxShadow: 'var(--shadow-card)',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', inset: 0 }}>
            <MapView
              trails={filteredTrails}
              allTrails={trails}
              onSelectRegion={onSelectRegion}
              selectedTrail={focusedTrail || selectedTrail}
              onFocusTrail={setFocusedTrail}
              onSelectTrail={onSelectTrail}
              incidents={incidents}
              height="100%"
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Trail Field Dossier (Fits 100% Cleanly in One Frame) */}
        <div
          style={{
            minHeight: 530,
            minWidth: 0,
            borderRadius: 4,
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {activeTrail ? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              {/* Active Trail Hero Image Banner (<img> with reliable onError fallback) */}
              <div
                style={{
                  position: 'relative',
                  height: 152,
                  width: '100%',
                  background: 'var(--color-surface-elevated)',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                <img
                  key={activeTrail.id}
                  className="scene-cover-cinematic"
                  src={activeTrail.coverImage || VERIFIED_TRAIL_FALLBACK}
                  alt={activeTrail.name}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (img.src !== VERIFIED_TRAIL_FALLBACK) {
                      img.src = VERIFIED_TRAIL_FALLBACK;
                    }
                  }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <div key={`veil-${activeTrail.id}`} className="hero-scene-veil" aria-hidden="true" />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage:
                      'linear-gradient(180deg, color-mix(in srgb, var(--overlay-bg) 35%, transparent) 0%, var(--overlay-bg) 74%, var(--color-bg-card) 100%), linear-gradient(180deg, transparent 35%, var(--overlay-bg) 82%, var(--color-bg-card) 100%)',
                  }}
                />

                {/* Floating Badges */}
                <div
                  style={{
                    position: 'absolute',
                    top: 10,
                    left: 14,
                    right: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 6,
                    zIndex: 2,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {activeDiff && (
                      <span
                        style={{
                          background: 'var(--color-bg-card)',
                          border: `1px solid ${activeDiff.border}`,
                          color: activeDiff.color,
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 4,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: activeDiff.color }} />
                        Cấp {activeTrail.difficultyLevel}/5 · {activeDiff.label}
                      </span>
                    )}

                    <span
                      style={{
                        background: 'var(--color-bg-hud)',
                        border: '1px solid var(--color-border-strong)',
                        color: 'var(--color-sky)',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {activeTrail.region}
                    </span>
                  </div>

                  <span
                    style={{
                      background: 'var(--color-bg-hud)',
                      border: '1px solid color-mix(in srgb, var(--color-sun) 45%, transparent)',
                      color: 'var(--color-sun)',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: 4,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <IconStar size={12} color="var(--color-sun)" fill="var(--color-sun)" />
                    {activeTrail.reviewCount && activeTrail.reviewCount > 0 && activeTrail.rating
                      ? `${Number(activeTrail.rating).toFixed(1)} (${activeTrail.reviewCount})`
                      : 'Chưa có đánh giá'}
                  </span>
                </div>

                {/* Trail Title & Administrative Location */}
                <div
                  key={`title-${activeTrail.id}`}
                  className="hero-peak-drop-in"
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    left: 14,
                    right: 14,
                    zIndex: 2,
                  }}
                >
                  <h3
                    style={{
                      fontSize: '1.16rem',
                      fontWeight: 900,
                      color: 'var(--color-on-media)',
                      margin: 0,
                      lineHeight: 1.24,
                      textShadow: '0 2px 10px var(--overlay-bg)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {activeTrail.name}
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      marginTop: 3,
                      fontSize: '0.75rem',
                      color: 'color-mix(in srgb, var(--color-on-media) 90%, transparent)',
                      textShadow: '0 1px 6px var(--overlay-bg)',
                      minWidth: 0,
                    }}
                  >
                    <MapPin size={13} color="var(--color-primary)" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {activeTrail.hamlet ? `${activeTrail.hamlet}, ` : ''}{activeTrail.district}, {activeTrail.province}
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Trail Dossier Body (Zero Overflow — Everything Visible in One Frame) */}
              <div
                style={{
                  padding: '12px 14px 14px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 8,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <div
                    style={{
                      background: 'var(--color-bg-main)',
                      borderRadius: 4,
                      padding: '9px 11px',
                      border: '1px solid var(--color-border)',
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: '0.66rem',
                        color: 'var(--color-earth)',
                        fontWeight: 700,
                        marginBottom: 3,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Mountain size={13} color="var(--color-earth)" />
                      <span>ĐỈNH CAO NHẤT</span>
                    </div>
                    <div style={{ fontSize: '1.02rem', fontWeight: 900, color: 'var(--color-text-main)' }}>
                      {activeTrail.maxAltitudeM.toLocaleString('vi-VN')}{' '}
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-earth)', fontWeight: 700 }}>m</span>
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'var(--color-bg-main)',
                      borderRadius: 4,
                      padding: '9px 11px',
                      border: '1px solid var(--color-border)',
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: '0.66rem',
                        color: 'var(--color-sky)',
                        fontWeight: 700,
                        marginBottom: 3,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Footprints size={13} color="var(--color-sky)" />
                      <span>CHIỀU DÀI CUNG</span>
                    </div>
                    <div style={{ fontSize: '1.02rem', fontWeight: 900, color: 'var(--color-text-main)' }}>
                      {activeTrail.distanceKm}{' '}
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-sky)', fontWeight: 700 }}>km</span>
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'var(--color-bg-main)',
                      borderRadius: 4,
                      padding: '9px 11px',
                      border: '1px solid var(--color-border)',
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: '0.66rem',
                        color: 'var(--color-primary)',
                        fontWeight: 700,
                        marginBottom: 3,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <TrendingUp size={13} color="var(--color-primary)" />
                      <span>ĐỘ DỐC TÍCH LŨY</span>
                    </div>
                    <div style={{ fontSize: '1.02rem', fontWeight: 900, color: 'var(--color-text-main)' }}>
                      +{activeTrail.elevationGainM.toLocaleString('vi-VN')}{' '}
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 700 }}>m</span>
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'var(--color-bg-main)',
                      borderRadius: 4,
                      padding: '9px 11px',
                      border: '1px solid var(--color-border)',
                      minWidth: 0,
                    }}
                    title={`${activeTrail.durationDays > 1 ? `${activeTrail.durationDays}N${activeTrail.durationDays - 1}Đ` : 'Trong ngày'} · ${activeTrail.durationHoursNote || '8-10h'}`}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: '0.66rem',
                        color: 'var(--color-sun)',
                        fontWeight: 700,
                        marginBottom: 3,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Clock size={13} color="var(--color-sun)" />
                      <span>THỜI GIAN LÝ TƯỞNG</span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.92rem',
                        fontWeight: 900,
                        color: 'var(--color-text-main)',
                        lineHeight: 1.2,
                      }}
                    >
                      {activeTrail.durationDays > 1
                        ? `${activeTrail.durationDays}N${activeTrail.durationDays - 1}Đ`
                        : 'Trong ngày'}
                    </div>
                    <div
                      style={{
                        fontSize: '0.71rem',
                        fontWeight: 500,
                        color: 'var(--color-text-muted)',
                        lineHeight: 1.35,
                        marginTop: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        wordBreak: 'break-word',
                      }}
                    >
                      {activeTrail.durationHoursNote || '8–10 giờ trekking'}
                    </div>
                  </div>
                </div>

                {/* Ranger Station & Safety Permit Strip */}
                <div
                  style={{
                    background: 'var(--color-bg-main)',
                    borderRadius: 4,
                    padding: '8px 11px',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 4,
                        background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <ShieldCheck size={15} color="var(--color-primary)" />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '0.65rem',
                          color: 'var(--color-text-dim)',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        Trạm Kiểm Lâm &amp; Giấy Phép
                      </div>
                      <div
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 800,
                          color: 'var(--color-text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {activeTrail.rescueContact?.rangerContact || `Ban Quản Lý Rừng / Kiểm Lâm ${activeTrail.province}`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    <a
                      href={`tel:${extractPrimaryDialNumber(activeTrail.rescueContact?.phone)}`}
                      title="Hotline cứu hộ trạm"
                      className="interactive-click"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'color-mix(in srgb, var(--color-error) 12%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
                        color: 'var(--color-error-text, var(--color-error))',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '4px 8px',
                        borderRadius: 4,
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <PhoneCall size={11} color="var(--color-error)" />
                      {activeTrail.rescueContact?.phone || '112 / 114'}
                    </a>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => onSelectTrail(activeTrail)}
                    className="btn btn-primary"
                    style={{
                      flex: 1,
                      padding: '9px 14px',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <span>Xem Hồ Sơ Chi Tiết</span>
                    <ArrowRight size={14} />
                  </button>

                  <button
                    type="button"
                    className="interactive-click"
                    onClick={() => handleDownloadGpx(activeTrail)}
                    style={{
                      flex: '0 0 auto',
                      background: 'var(--color-bg-main)',
                      color: 'var(--color-text-main)',
                      border: '1px solid var(--color-border-strong)',
                      borderRadius: 4,
                      padding: '9px 14px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      whiteSpace: 'nowrap',
                    }}
                    title="Tải tệp GPX Tracklog thực địa để định vị ngoại tuyến"
                  >
                    <Download size={14} color="var(--color-primary)" />
                    <span>Tải GPX</span>
                  </button>
                </div>

                {/* Quick Trail Selector Rail (Fully Visible at Bottom of Frame) */}
                <div
                  style={{
                    marginTop: 'auto',
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: 10,
                    minWidth: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7, gap: 8 }}>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: 'var(--color-text-dim)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Cung Đường Cùng Vùng ({filteredTrails.length})
                    </span>
                    <span style={{ fontSize: '0.64rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                      Nhấp để bản đồ bay đến
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 7,
                      overflowX: 'auto',
                      paddingBottom: 4,
                      scrollbarWidth: 'thin',
                      minWidth: 0,
                    }}
                  >
                    {filteredTrails.map((t) => {
                      const isCur = t.id === activeTrail.id;
                      const tDiff = getDifficultyBadge(t.difficultyLevel);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className="interactive-click"
                          onClick={() => setFocusedTrail(t)}
                          onDoubleClick={() => onSelectTrail(t)}
                          title="Nhấp để bản đồ bay đến, nhấp đúp để mở hồ sơ chi tiết"
                          style={{
                            flex: '0 0 166px',
                            background: isCur ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'var(--color-bg-main)',
                            border: isCur ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                            borderRadius: 4,
                            padding: '7px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            textAlign: 'left',
                          }}
                        >
                          <img
                            src={t.coverImage || VERIFIED_TRAIL_FALLBACK}
                            alt={t.name}
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              const img = e.currentTarget;
                              if (img.src !== VERIFIED_TRAIL_FALLBACK) {
                                img.src = VERIFIED_TRAIL_FALLBACK;
                              }
                            }}
                            style={{ width: 34, height: 34, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                color: isCur ? 'var(--color-primary)' : 'var(--color-text-main)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {t.name}
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: '0.64rem',
                                color: 'var(--color-text-dim)',
                                marginTop: 2,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: tDiff.color }} />
                              <span>{t.maxAltitudeM}m</span>
                              <span>·</span>
                              <span>{t.distanceKm}km</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-dim)', margin: 'auto' }}>
              Vui lòng chọn một cung đường để xem thông tin thực địa chi tiết.
            </div>
          )}
        </div>
      </div>

      {/* Map Interactive Footnote Info Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginTop: 14,
          padding: '12px 18px',
          background: 'var(--color-bg-card)',
          borderRadius: 6,
          border: '1px solid var(--color-border)',
          fontSize: '0.78rem',
          color: 'var(--color-text-dim)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--color-sun) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-sun) 35%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconLightbulb size={15} color="var(--color-sun)" />
          </div>
          <span>
            <strong>Mẹo tương tác:</strong> Nhấp vào bất kỳ điểm nào trên bản đồ để mở popup thời tiết thực địa, xem hồ sơ kiểm lâm và tải file GPX.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span>
            Đang hiển thị: <strong style={{ color: 'var(--color-primary)' }}>{filteredTrails.length} cung đường</strong>
          </span>
          <span style={{ color: 'var(--color-border)' }}>|</span>
          <span>
            Cao độ đỉnh: <strong style={{ color: 'var(--color-sky)' }}>Fansipan (3.143m)</strong>
          </span>
          <span style={{ color: 'var(--color-border)' }}>|</span>
          <span>
            Hệ quy chiếu: <strong style={{ color: 'var(--color-text-muted)' }}>WGS84 EPSG:4326</strong>
          </span>
        </div>
      </div>
    </section>
  );
};

export const InteractiveMapShowcase = React.memo(InteractiveMapShowcaseBase);
