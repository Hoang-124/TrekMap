import React from 'react';
import type { Trail } from '../../types.js';
import { MapView } from '../map/MapView.js';
import { IconSatellite, IconLightbulb } from '../common/SvgIcons.js';

interface InteractiveMapShowcaseProps {
  trails: Trail[];
  selectedTrail: Trail | null;
  onSelectTrail: (trail: Trail) => void;
  incidents?: any[];
  selectedRegion?: string;
  onSelectRegion?: (region: string) => void;
  onExploreFullMap?: () => void;
}

export const InteractiveMapShowcase: React.FC<InteractiveMapShowcaseProps> = ({
  trails,
  selectedTrail,
  onSelectTrail,
  incidents = [],
  selectedRegion = 'All',
  onSelectRegion,
  onExploreFullMap,
}) => {
  // Filter trails based on region filter
  const filteredTrails = trails.filter((t) => {
    if (!selectedRegion || selectedRegion === 'All' || selectedRegion === 'Tất Cả') return true;
    return t.region === selectedRegion;
  });

  return (
    <section
      style={{
        padding: '50px 0',
        maxWidth: 1320,
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
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 14px',
              borderRadius: 20,
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 800,
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 10,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <IconSatellite size={16} color="var(--color-primary)" />
            Bản Đồ 3D Không Gian Thực
          </div>

          <h2
            style={{
              fontSize: 'clamp(1.6rem, 3.2vw, 2.4rem)',
              fontWeight: 900,
              color: 'var(--color-text-main)',
              marginBottom: 6,
            }}
          >
            Khám Phá Track Log GPX Thực Địa
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', maxWidth: 620 }}>
            Tương tác trực tiếp với các cung đường trekking: chuyển đổi lớp bản đồ vệ tinh, topo cao độ và xem chi tiết điểm hạ trại nguồn nước.
          </p>
        </div>

        {/* Region Switcher Pills & Fullscreen Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
        style={{
          height: '620px',
          borderRadius: 24,
          overflow: 'hidden',
          border: '1.5px solid var(--color-border)',
          boxShadow: 'var(--shadow-card)',
          position: 'relative',
          background: 'var(--color-bg-card)',
        }}
      >
        <MapView
          trails={filteredTrails}
          selectedTrail={selectedTrail}
          onSelectTrail={onSelectTrail}
          incidents={incidents}
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
