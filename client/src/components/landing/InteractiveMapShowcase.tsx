import React from 'react';
import type { Trail } from '../../types.js';
import { MapView } from '../map/MapView.js';
import { IconSatellite, IconLightbulb, IconCalendar, IconX } from '../common/SvgIcons.js';

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
  // Filter trails based on region and selected month
  const filteredTrails = trails.filter((t) => {
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

  return (
    <section
      style={{
        padding: '16px 0 32px 0',
        maxWidth: 1320,
        margin: '0 auto',
      }}
    >
      {/* Section Header - Streamlined & Compact */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2
              style={{
                fontSize: 'clamp(1.3rem, 2.4vw, 1.75rem)',
                fontWeight: 900,
                color: 'var(--color-text-main)',
                margin: 0,
              }}
            >
              Bản Đồ Địa Hình & Tracklog GPX 3D
            </h2>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 10px',
                borderRadius: 14,
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid var(--color-border)',
                fontSize: '0.72rem',
                fontWeight: 800,
                color: 'var(--color-primary)',
                textTransform: 'uppercase',
              }}
            >
              <IconSatellite size={13} color="var(--color-primary)" />
              Thời Gian Thực
            </span>
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', margin: '4px 0 0 0', maxWidth: 680 }}>
            Tương tác đa lớp: Bản đồ vệ tinh, địa hình topo cao độ, tọa độ trạm kiểm lâm và điểm hạ trại.
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
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid var(--color-primary)',
                padding: '5px 12px',
                borderRadius: 20,
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--color-primary)',
                boxShadow: '0 0 12px rgba(16, 185, 129, 0.25)',
              }}
            >
              <IconCalendar size={14} color="var(--color-primary)" />
              <span>Đang lọc: Tháng {selectedMonth} ({filteredTrails.length} cung đường)</span>
              {onClearMonthFilter && (
                <button
                  type="button"
                  onClick={onClearMonthFilter}
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
                borderRadius: 20,
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {['All', 'Miền Bắc', 'Miền Trung', 'Miền Nam'].map((reg) => (
                <button
                  key={reg}
                  type="button"
                  onClick={() => onSelectRegion(reg)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 16,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    border: 'none',
                    background: selectedRegion === reg ? 'rgba(5, 150, 105, 0.15)' : 'transparent',
                    color: selectedRegion === reg ? 'var(--color-primary)' : 'var(--color-text-dim)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {reg === 'All' ? 'Tất Cả' : reg}
                </button>
              ))}
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

      {/* Embedded Live Leaflet Map Container */}
      <div
        id="gis-map-canvas"
        style={{
          height: 'min(70vh, 540px)',
          minHeight: '440px',
          borderRadius: 24,
          overflow: 'hidden',
          border: '1.5px solid var(--color-border)',
          boxShadow: 'var(--shadow-card)',
          position: 'relative',
        }}
      >
        <MapView
          trails={filteredTrails}
          selectedTrail={selectedTrail}
          onSelectTrail={onSelectTrail}
          incidents={incidents}
          height="100%"
        />
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
          borderRadius: 16,
          border: '1px solid var(--color-border)',
          fontSize: '0.78rem',
          color: 'var(--color-text-dim)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconLightbulb size={16} color="var(--color-sun)" />
          <span>Mẹo: Bạn có thể nhấp vào bất kỳ đường tracklog nào trên bản đồ để xem đồ thị cao độ và tọa độ GPS chi tiết.</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span>Tổng số cung đường hiển thị: <strong style={{ color: 'var(--color-primary)' }}>{filteredTrails.length}</strong></span>
          <span>Hệ toạ độ: <strong style={{ color: 'var(--color-sky)' }}>WGS84 chuẩn</strong></span>
        </div>
      </div>
    </section>
  );
};
