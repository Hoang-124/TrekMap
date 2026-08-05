import React from 'react';

interface ElevationProfileSVGProps {
  gpxTrack: [number, number][];
  elevationGainM: number;
  maxAltitudeM: number;
  height?: number;
}

export const ElevationProfileSVG: React.FC<ElevationProfileSVGProps> = ({
  gpxTrack,
  elevationGainM,
  maxAltitudeM,
  height = 140,
}) => {
  if (!gpxTrack || gpxTrack.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-dim)', fontSize: '0.85rem' }}>
        Chưa có dữ liệu trắc diện cao độ
      </div>
    );
  }

  // Generate smooth synthetic elevation profile points from coordinates & maxAltitudeM
  const numPoints = Math.min(gpxTrack.length, 30);
  const minAlt = Math.max(200, maxAltitudeM - elevationGainM * 0.85);

  const points: { x: number; y: number; alt: number }[] = [];
  const svgWidth = 400;
  const padding = 15;
  const drawWidth = svgWidth - padding * 2;
  const drawHeight = height - padding * 2;

  for (let i = 0; i < numPoints; i++) {
    const progress = i / (numPoints - 1);
    // Smooth altitude arc
    const altRatio = Math.sin(progress * Math.PI) * 0.7 + (i % 2 === 0 ? 0.15 : 0.05);
    const currentAlt = Math.round(minAlt + (maxAltitudeM - minAlt) * altRatio);
    
    const x = padding + progress * drawWidth;
    const yRatio = (currentAlt - minAlt) / Math.max(1, maxAltitudeM - minAlt);
    const y = height - padding - yRatio * drawHeight;

    points.push({ x, y, alt: currentAlt });
  }

  const pathD = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <svg viewBox={`0 0 ${svgWidth} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        <defs>
          <linearGradient id="elevationGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Gradient Area Fill */}
        <path d={areaD} fill="url(#elevationGrad)" />

        {/* Contour Line */}
        <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" />

        {/* Peak Dot */}
        {points.map((p, i) => {
          const isPeak = p.alt === Math.max(...points.map((pt) => pt.alt));
          if (!isPeak && i !== 0 && i !== points.length - 1) return null;
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={isPeak ? 4.5 : 3} fill={isPeak ? 'var(--color-sun)' : 'var(--color-stream)'} />
              {isPeak && (
                <text
                  x={p.x}
                  y={p.y - 8}
                  fill="var(--color-sun)"
                  fontSize="10"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  Đỉnh {p.alt}m
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-dim)', marginTop: 4 }}>
        <span>Điểm xuất phát ({Math.round(minAlt)}m)</span>
        <span>Độ cao tích lũy: +{elevationGainM}m</span>
        <span>Đỉnh cao nhất ({maxAltitudeM}m)</span>
      </div>
    </div>
  );
};
