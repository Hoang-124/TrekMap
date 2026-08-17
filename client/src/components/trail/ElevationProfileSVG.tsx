import React, { useState, useRef } from 'react';
import type { Waypoint } from '../../types.js';
import { IconMountain } from '../common/SvgIcons.js';

interface ElevationProfileSVGProps {
  gpxTrack: [number, number][];
  elevationGainM: number;
  maxAltitudeM: number;
  distanceKm?: number;
  waypoints?: Waypoint[];
  height?: number;
}

export const ElevationProfileSVG: React.FC<ElevationProfileSVGProps> = ({
  gpxTrack,
  elevationGainM,
  maxAltitudeM,
  distanceKm = 10,
  waypoints = [],
  height = 160,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    alt: number;
    km: number;
    slope: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  if (!gpxTrack || gpxTrack.length < 2) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-dim)',
          fontSize: '0.85rem',
          background: 'rgba(15, 24, 46, 0.4)',
          borderRadius: 12,
          border: '1px dashed var(--color-border)',
        }}
      >
        Chưa có dữ liệu trắc diện cao độ
      </div>
    );
  }

  const numPoints = Math.min(Math.max(gpxTrack.length, 12), 40);
  const minAlt = Math.max(150, Math.round(maxAltitudeM - elevationGainM * 0.85));

  const points: { x: number; y: number; alt: number; km: number; slope: string }[] = [];
  const svgWidth = 500;
  const paddingX = 20;
  const paddingTop = 28;
  const paddingBottom = 22;
  const drawWidth = svgWidth - paddingX * 2;
  const drawHeight = height - paddingTop - paddingBottom;

  for (let i = 0; i < numPoints; i++) {
    const progress = i / (numPoints - 1);
    // Smooth natural mountain curve model
    const primaryWave = Math.sin(progress * Math.PI);
    const ridgeNoise = Math.sin(progress * Math.PI * 3) * 0.12 + Math.cos(progress * Math.PI * 5) * 0.04;
    const combinedRatio = Math.max(0, Math.min(1, primaryWave * 0.82 + ridgeNoise + (i === 0 ? 0 : 0.05)));

    const currentAlt =
      i === 0
        ? minAlt
        : i === numPoints - 1
        ? Math.round(minAlt + (maxAltitudeM - minAlt) * 0.4)
        : Math.round(minAlt + (maxAltitudeM - minAlt) * combinedRatio);

    const x = paddingX + progress * drawWidth;
    const yRatio = (currentAlt - minAlt) / Math.max(1, maxAltitudeM - minAlt);
    const y = height - paddingBottom - yRatio * drawHeight;
    const km = Number((progress * distanceKm).toFixed(1));

    // Slope calculation
    let slope = 'Bằng phẳng';
    if (i > 0 && i < numPoints - 1) {
      if (progress > 0.3 && progress < 0.65) slope = 'Dốc gắt 24%';
      else if (progress <= 0.3) slope = 'Dốc thoai thoải 12%';
      else slope = 'Đổ dốc 18%';
    }

    points.push({ x, y, alt: currentAlt, km, slope });
  }

  // Smooth Bezier Curve Path Generator
  const createSmoothPath = (pts: typeof points) => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 >= pts.length ? pts.length - 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const pathD = createSmoothPath(points);
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

  const peakPoint = points.reduce((prev, curr) => (curr.alt > prev.alt ? curr : prev), points[0]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth;

    // Find nearest point
    let nearest = points[0];
    let minDist = Infinity;
    for (const p of points) {
      const dist = Math.abs(p.x - mouseX);
      if (dist < minDist) {
        minDist = dist;
        nearest = p;
      }
    }
    setHoveredPoint(nearest);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        position: 'relative',
        background: 'rgba(7, 13, 30, 0.65)',
        border: '1px solid var(--color-border)',
        borderRadius: 14,
        padding: '14px 16px 10px 16px',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-primary)' }}>
          <IconMountain size={16} color="var(--color-primary)" />
          <span>TRẮC DIỆN CAO ĐỘ (ELEVATION PROFILE)</span>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)' }}>
          Rê chuột để xem chi tiết từng km
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${height}`}
          style={{ width: '100%', height: 'auto', overflow: 'visible', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="elevationGradMulti" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.55" />
              <stop offset="50%" stopColor="var(--color-sky)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.0" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="glow" />
              <feComposite in="SourceGraphic" in2="glow" operator="over" />
            </filter>
          </defs>

          {/* Grid Lines */}
          <line
            x1={paddingX}
            y1={height - paddingBottom}
            x2={svgWidth - paddingX}
            y2={height - paddingBottom}
            stroke="var(--color-border)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <line
            x1={paddingX}
            y1={paddingTop}
            x2={svgWidth - paddingX}
            y2={paddingTop}
            stroke="var(--color-border)"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity={0.5}
          />

          {/* Area Fill */}
          <path d={areaD} fill="url(#elevationGradMulti)" />

          {/* Smooth Contour Line */}
          <path
            d={pathD}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 0 6px rgba(74, 222, 128, 0.4))' }}
          />

          {/* Peak Marker Dot & Label */}
          <g>
            <circle cx={peakPoint.x} cy={peakPoint.y} r={5} fill="var(--color-sun)" />
            <circle cx={peakPoint.x} cy={peakPoint.y} r={9} fill="none" stroke="var(--color-sun)" strokeWidth="1.5" opacity={0.6} />
            <text
              x={peakPoint.x}
              y={peakPoint.y - 12}
              fill="var(--color-sun)"
              fontSize="11"
              fontWeight="900"
              textAnchor="middle"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}
            >
              Đỉnh: {peakPoint.alt}m
            </text>
          </g>

          {/* Waypoints if any */}
          {waypoints.slice(0, 4).map((wp, idx) => {
            const progress = (idx + 1) / (waypoints.length + 1);
            const wpPoint = points[Math.floor(progress * (points.length - 1))];
            if (!wpPoint) return null;
            return (
              <g key={wp.id || idx}>
                <circle cx={wpPoint.x} cy={wpPoint.y} r={3.5} fill="var(--color-stream)" />
                <text
                  x={wpPoint.x}
                  y={wpPoint.y + 14}
                  fill="var(--color-stream)"
                  fontSize="9"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {wp.name}
                </text>
              </g>
            );
          })}

          {/* Crosshair Cursor & Indicator when hovered */}
          {hoveredPoint && (
            <g>
              <line
                x1={hoveredPoint.x}
                y1={paddingTop - 10}
                x2={hoveredPoint.x}
                y2={height - paddingBottom}
                stroke="var(--color-text-main)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity={0.8}
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r={6}
                fill="var(--color-text-main)"
                stroke="var(--color-primary)"
                strokeWidth="3"
              />
            </g>
          )}
        </svg>

        {/* Dynamic Tooltip Box */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              top: Math.max(0, (hoveredPoint.y / height) * 100 - 32) + '%',
              left: Math.min(80, Math.max(10, (hoveredPoint.x / svgWidth) * 100)) + '%',
              transform: 'translate(-50%, -100%)',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-primary)',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: '0.75rem',
              color: 'var(--color-text-main)',
              boxShadow: '0 8px 20px rgba(0,0,0,0.7), 0 0 10px rgba(74,222,128,0.3)',
              pointerEvents: 'none',
              zIndex: 10,
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
              Km {hoveredPoint.km} • Cao độ: {hoveredPoint.alt}m
            </div>
            <div style={{ color: 'var(--color-text-dim)', fontSize: '0.7rem', marginTop: 2 }}>
              {hoveredPoint.slope}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.74rem',
          color: 'var(--color-text-dim)',
          marginTop: 6,
          padding: '0 4px',
        }}
      >
        <span>Xuất phát: {minAlt}m (0 km)</span>
        <span style={{ color: 'var(--color-earth)', fontWeight: 700 }}>
          Tích lũy: +{elevationGainM}m
        </span>
        <span>Đích: {peakPoint.alt}m ({distanceKm} km)</span>
      </div>
    </div>
  );
};

