import React, { useMemo } from 'react';
import type { Trail } from '../../types.js';
import { MapView } from '../map/MapView.js';
import { IconSatellite, IconLightbulb, IconCalendar, IconX } from '../common/SvgIcons.js';

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
  incidents?: any[];
  selectedRegion?: string;
  onSelectRegion?: (region: string) => void;
  selectedMonth?: number | null;
  onClearMonthFilter?: () => void;
  onExploreFullMap?: () => void;
}

const getDifficultyBadge = (difficulty: number) => {
  const diff = Number(difficulty) || 3;
  if (diff >= 4) return { label: 'Khó', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)' };
  if (diff === 3) return { label: 'Trung Bình', color: '#ffd600', bg: 'rgba(255, 214, 0, 0.15)', border: 'rgba(255, 214, 0, 0.4)' };
  return { label: 'Dễ', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)' };
};

export const InteractiveMapShowcase: React.FC<InteractiveMapShowcaseProps> = ({
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
  // Region counts for telemetry badges
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

  // Filter trails based on region and selected month
  const filteredTrails = useMemo(() => {
    return trails.filter((t) => {
      // 1. Region filter
      if (selectedRegion && selectedRegion !== 'All' && selectedRegion !== 'Tất Cả') {
        if (t.region !== selectedRegion) return false;
      }
      // 2. Month filter
      if (selectedMonth) {
        if (Array.isArray(t.bestMonths) && t.bestMonths.length > 0) {
          return t.bestMonths.includes(selectedMonth) && (!t.avoidMonths || !t.avoidMonths.includes(selectedMonth));
        }
        return !t.avoidMonths?.includes(selectedMonth);
      }
      return true;
    });
  }, [trails, selectedRegion, selectedMonth]);

  // Active trail for the Intelligence Card (defaults to selected or first filtered trail)
  const activeTrail = useMemo(() => {
    if (selectedTrail) return selectedTrail;
    return filteredTrails.length > 0 ? filteredTrails[0] : (trails.length > 0 ? trails[0] : null);
  }, [selectedTrail, filteredTrails, trails]);

  const activeDiff = activeTrail ? getDifficultyBadge(activeTrail.difficultyLevel) : null;

  // Real GPX Download Handler
  const handleDownloadGpx = (trail: Trail) => {
    if (!trail.gpxTrack || trail.gpxTrack.length === 0) {
      window.dispatchEvent(
        new CustomEvent('trekmap:show-toast', {
          detail: { message: `Cung đường ${trail.name} đang cập nhật tracklog GPX.`, type: 'info' },
        })
      );
      return;
    }
    const trackPointsXml = trail.gpxTrack
      .map(([lat, lng]) => `      <trkpt lat="${lat}" lon="${lng}"></trkpt>`)
      .join('\n');
    const gpxXml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrekMap Vietnam - https://trekmap.vn">
  <metadata>
    <name>${trail.name}</name>
    <desc>${trail.description || ''}</desc>
  </metadata>
  <trk>
    <name>${trail.name}</name>
    <trkseg>
${trackPointsXml}
    </trkseg>
  </trk>
</gpx>`;
    const blob = new Blob([gpxXml], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${trail.id || 'tracklog'}_TrekMap.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    window.dispatchEvent(
      new CustomEvent('trekmap:show-toast', {
        detail: { message: `Đã tải xuống file GPX của ${trail.name}!`, type: 'success' },
      })
    );
  };

  return (
    <section
      style={{
        padding: '20px 0 36px 0',
        maxWidth: 1360,
        margin: '0 auto',
      }}
    >
      {/* Section Header - Tactical Command Center Style */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 20,
                background: 'rgba(74, 222, 128, 0.12)',
                border: '1px solid var(--color-border-glow)',
                fontSize: '0.72rem',
                fontWeight: 800,
                color: 'var(--color-primary)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--color-primary)',
                  boxShadow: '0 0 8px var(--color-primary)',
                  display: 'inline-block',
                }}
              />
              <IconSatellite size={13} color="var(--color-primary)" />
              <span>GIS Telemetry Việt Nam</span>
            </div>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 20,
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: 'var(--color-sky)',
              }}
            >
              WGS84 • Lãnh Thổ Việt Nam 100% Thực Địa
            </span>
          </div>

          <h2
            style={{
              fontSize: 'clamp(1.4rem, 2.6vw, 1.95rem)',
              fontWeight: 900,
              color: 'var(--color-text-main)',
              letterSpacing: '-0.025em',
              margin: '0 0 6px 0',
              lineHeight: 1.25,
            }}
          >
            Bản Đồ Địa Hình & Thẻ Cung Đường Thực Địa
          </h2>

          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.84rem',
              lineHeight: 1.5,
              margin: 0,
              maxWidth: 760,
            }}
          >
            Không gian viễn thám GIS độ nét cao giới hạn trong phạm vi lãnh thổ Việt Nam. Đồng bộ 2 chiều: Chọn bất kỳ đỉnh núi nào trên bản đồ hoặc danh sách bên cạnh để xem ngay trắc diện thực tế, trạm kiểm lâm và tải file GPX.
          </p>
        </div>

        {/* Region Switcher Pills & Fullscreen Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {selectedMonth && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(74, 222, 128, 0.15)',
                border: '1px solid var(--color-border-glow)',
                padding: '6px 12px',
                borderRadius: 20,
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--color-primary)',
                boxShadow: '0 0 14px rgba(74, 222, 128, 0.2)',
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
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: 'none',
                    color: 'var(--color-text-main)',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: 10,
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
              style={{
                display: 'flex',
                background: 'var(--color-bg-card)',
                padding: 4,
                borderRadius: 24,
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-card)',
                gap: 3,
              }}
            >
              {(['All', 'Miền Bắc', 'Miền Trung', 'Miền Nam'] as const).map((reg) => {
                const isSelected = selectedRegion === reg || (reg === 'All' && selectedRegion === 'Tất Cả');
                const label = reg === 'All' ? 'Tất Cả' : reg;
                const count = regionCounts[reg] || 0;

                return (
                  <button
                    key={reg}
                    type="button"
                    onClick={() => onSelectRegion(reg)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      borderRadius: 18,
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: 'none',
                      background: isSelected ? 'var(--color-primary)' : 'transparent',
                      color: isSelected ? 'var(--color-bg-main)' : 'var(--color-text-dim)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? 'var(--shadow-sprout)' : 'none',
                    }}
                  >
                    <span>{label}</span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: 10,
                        background: isSelected ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                        color: isSelected ? 'var(--color-bg-main)' : 'var(--color-text-muted)',
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
                borderRadius: 20,
                padding: '8px 18px',
                fontSize: '0.82rem',
                fontWeight: 800,
              }}
            >
              Toàn Màn Hình ➔
            </button>
          )}
        </div>
      </div>

      {/* SPLIT SCREEN LAYOUT: 54% MAP VIETNAM + 46% INTERACTIVE TRAIL INTELLIGENCE CONSOLE */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 20,
          alignItems: 'stretch',
        }}
      >
        {/* LEFT COLUMN: Embedded Live Leaflet Map (Firmly bounded to Vietnam) */}
        <div
          id="gis-map-canvas"
          className="tactical-gis-frame"
          style={{
            height: 'min(76vh, 610px)',
            minHeight: '480px',
            borderRadius: 24,
            overflow: 'hidden',
            border: '1.5px solid var(--color-border)',
            boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(74, 222, 128, 0.15)',
            position: 'relative',
          }}
        >
          <MapView
            trails={filteredTrails}
            allTrails={trails}
            onSelectRegion={onSelectRegion}
            selectedTrail={selectedTrail}
            onSelectTrail={onSelectTrail}
            incidents={incidents}
            height="100%"
          />
        </div>

        {/* RIGHT COLUMN: Interactive Trail Intelligence Dossier & Quick Trail Selector */}
        <div
          style={{
            height: 'min(76vh, 610px)',
            minHeight: '480px',
            borderRadius: 24,
            background: 'var(--color-bg-card)',
            border: '1.5px solid var(--color-border)',
            boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(74, 222, 128, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {activeTrail ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Active Trail Hero Image Banner */}
              <div
                style={{
                  position: 'relative',
                  height: 160,
                  width: '100%',
                  background: activeTrail.coverImage
                    ? `url(${activeTrail.coverImage}) center / cover no-repeat`
                    : 'linear-gradient(135deg, #0f2d24 0%, #081726 100%)',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {/* Dark Gradient Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, rgba(2, 6, 12, 0.18) 0%, rgba(3, 10, 20, 0.72) 65%, var(--color-bg-card) 100%)',
                  }}
                />

                {/* Floating Badges (Difficulty, Region, Rating) */}
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 14,
                    right: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    zIndex: 2,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {activeDiff && (
                      <span
                        style={{
                          background: activeDiff.bg,
                          border: `1px solid ${activeDiff.border}`,
                          color: activeDiff.color,
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 12,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: activeDiff.color, boxShadow: `0 0 6px ${activeDiff.color}` }} />
                        Cấp {activeTrail.difficultyLevel}/5 • {activeDiff.label}
                      </span>
                    )}

                    <span
                      style={{
                        background: 'rgba(5, 15, 25, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                        color: 'var(--color-sky)',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 12,
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      {activeTrail.region}
                    </span>
                  </div>

                  <span
                    style={{
                      background: 'rgba(245, 158, 11, 0.2)',
                      border: '1px solid rgba(245, 158, 11, 0.45)',
                      color: '#fbbf24',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: 12,
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    ★ {activeTrail.rating || 5.0} ({activeTrail.reviewCount || 12} đánh giá)
                  </span>
                </div>

                {/* Trail Title & Administrative Location at Bottom of Cover */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    left: 16,
                    right: 16,
                    zIndex: 2,
                  }}
                >
                  <h3
                    style={{
                      fontSize: '1.28rem',
                      fontWeight: 900,
                      color: 'var(--color-text-main)',
                      margin: 0,
                      lineHeight: 1.25,
                      textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                    }}
                  >
                    {activeTrail.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                    <MapPin size={13} color="var(--color-primary)" />
                    <span>
                      {activeTrail.hamlet ? `${activeTrail.hamlet}, ` : ''}{activeTrail.district}, {activeTrail.province}
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Trail Dossier Body */}
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto' }}>
                {/* 4 Telemetry Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  <div style={{ background: 'var(--color-bg-main)', borderRadius: 12, padding: '8px 12px', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.66rem', color: 'var(--color-earth)', fontWeight: 700, marginBottom: 2 }}>
                      <Mountain size={13} color="var(--color-earth)" />
                      <span>ĐỈNH CAO NHẤT</span>
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--color-text-main)' }}>
                      {activeTrail.maxAltitudeM.toLocaleString('vi-VN')} <span style={{ fontSize: '0.72rem', color: 'var(--color-earth)', fontWeight: 700 }}>m</span>
                    </div>
                  </div>

                  <div style={{ background: 'var(--color-bg-main)', borderRadius: 12, padding: '8px 12px', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.66rem', color: 'var(--color-sky)', fontWeight: 700, marginBottom: 2 }}>
                      <Footprints size={13} color="var(--color-sky)" />
                      <span>CHIỀU DÀI CUNG</span>
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--color-text-main)' }}>
                      {activeTrail.distanceKm} <span style={{ fontSize: '0.72rem', color: 'var(--color-sky)', fontWeight: 700 }}>km</span>
                    </div>
                  </div>

                  <div style={{ background: 'var(--color-bg-main)', borderRadius: 12, padding: '8px 12px', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.66rem', color: 'var(--color-primary)', fontWeight: 700, marginBottom: 2 }}>
                      <TrendingUp size={13} color="var(--color-primary)" />
                      <span>ĐỘ DỐC TÍCH LŨY</span>
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--color-text-main)' }}>
                      +{activeTrail.elevationGainM.toLocaleString('vi-VN')} <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 700 }}>m</span>
                    </div>
                  </div>

                  <div style={{ background: 'var(--color-bg-main)', borderRadius: 12, padding: '8px 12px', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.66rem', color: '#f59e0b', fontWeight: 700, marginBottom: 2 }}>
                      <Clock size={13} color="#f59e0b" />
                      <span>THỜI GIAN LÝ TƯỞNG</span>
                    </div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 900, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {activeTrail.durationDays > 1 ? `${activeTrail.durationDays}N${activeTrail.durationDays - 1}Đ` : 'Trong ngày'} • {activeTrail.durationHoursNote || '8-10h'}
                    </div>
                  </div>
                </div>

                {/* Ranger Station & Safety Permit Strip */}
                <div
                  style={{
                    background: 'var(--color-bg-main)',
                    borderRadius: 12,
                    padding: '8px 12px',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ShieldCheck size={15} color="var(--color-primary)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                        Trạm Kiểm Lâm & Giấy Phép
                      </div>
                      <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {activeTrail.rescueContact?.rangerContact || 'Ban Quản Lý Rừng / VQG Hoàng Liên'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    <a
                      href={`tel:${activeTrail.rescueContact?.phone ? activeTrail.rescueContact.phone.replace(/\D/g, '') : '114'}`}
                      title="Hotline cứu hộ trạm"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: 'var(--color-error)',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '4px 8px',
                        borderRadius: 8,
                        textDecoration: 'none',
                      }}
                    >
                      <PhoneCall size={11} color="var(--color-error)" />
                      {activeTrail.rescueContact?.phone || '114 (SOS)'}
                    </a>
                  </div>
                </div>

                {/* Action Buttons: View Details & Download GPX */}
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <button
                    type="button"
                    onClick={() => onSelectTrail(activeTrail)}
                    className="btn btn-primary"
                    style={{
                      flex: 1,
                      padding: '9px 14px',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      borderRadius: 12,
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
                    onClick={() => handleDownloadGpx(activeTrail)}
                    style={{
                      flex: '0 0 auto',
                      background: 'var(--color-bg-main)',
                      color: 'var(--color-text-main)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 12,
                      padding: '9px 14px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease',
                    }}
                    title="Tải tệp GPX Tracklog thực địa để định vị ngoại tuyến"
                  >
                    <Download size={14} color="var(--color-primary)" />
                    <span>Tải GPX</span>
                  </button>
                </div>

                {/* Quick Trail Selector Rail (Interactive 2-Way Sync) */}
                <div style={{ marginTop: 4, borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                    }}
                  >
                    {filteredTrails.map((t) => {
                      const isCur = t.id === activeTrail.id;
                      const tDiff = getDifficultyBadge(t.difficultyLevel);
                      return (
                        <div
                          key={t.id}
                          onClick={() => onSelectTrail(t)}
                          style={{
                            flex: '0 0 160px',
                            background: isCur ? 'rgba(16, 185, 129, 0.12)' : 'var(--color-bg-main)',
                            border: isCur ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                            borderRadius: 10,
                            padding: '6px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            transition: 'all 0.15s ease',
                            boxShadow: isCur ? '0 0 12px rgba(16, 185, 129, 0.2)' : 'none',
                          }}
                        >
                          <img
                            src={t.coverImage || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=120&q=80'}
                            alt={t.name}
                            style={{ width: 34, height: 34, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              title={t.name}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.64rem', color: 'var(--color-text-dim)', marginTop: 1 }}>
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: tDiff.color }} />
                              <span>{t.maxAltitudeM}m</span>
                              <span>•</span>
                              <span>{t.distanceKm}km</span>
                            </div>
                          </div>
                        </div>
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
          padding: '12px 20px',
          background: 'var(--color-bg-card)',
          borderRadius: 18,
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
              borderRadius: '50%',
              background: 'rgba(250, 204, 21, 0.12)',
              border: '1px solid rgba(250, 204, 21, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconLightbulb size={15} color="var(--color-sun)" />
          </div>
          <span>
            <strong>Mẹo tương tác:</strong> Nhấp vào bất kỳ điểm nào trên bản đồ hoặc danh sách bên cạnh để xem trọn vẹn thông số thực địa, trạm kiểm lâm và tải file GPX.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span>
            Đang hiển thị: <strong style={{ color: 'var(--color-primary)' }}>{filteredTrails.length} cung đường</strong>
          </span>
          <span style={{ color: 'var(--color-border)' }}>|</span>
          <span>
            Cao độ đỉnh: <strong style={{ color: 'var(--color-sky)' }}>Fansipan (3,143m)</strong>
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
