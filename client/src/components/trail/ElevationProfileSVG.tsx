import React, { useState, useEffect, useRef, useMemo, useId, useCallback } from 'react';
import type { Waypoint } from '../../types.js';
import { haversineMeters } from '../../utils/geoMath.js';
import { IconMountain } from '../common/SvgIcons.js';

interface ElevationSamplePoint {
  lat: number;
  lng: number;
  elevationM: number;
  distanceKm: number;
  slopePercent: number;
}

interface ElevationProfileSVGProps {
  trailId?: string;
  gpxTrack: [number, number][];
  elevationGainM: number;
  maxAltitudeM: number;
  distanceKm?: number;
  waypoints?: Waypoint[];
  height?: number;
  onHoverCoordinate?: (coord: [number, number] | null) => void;
  externalHoverIndex?: number | null;
}

function formatSlopeLabel(slopePercent: number): string {
  const abs = Math.abs(slopePercent);
  if (abs < 4) return `Bằng phẳng (${slopePercent > 0 ? '+' : ''}${slopePercent}%)`;
  if (slopePercent >= 25) return `Dốc rất gắt +${slopePercent}%`;
  if (slopePercent >= 12) return `Leo dốc +${slopePercent}%`;
  if (slopePercent > 0) return `Dốc thoai thoải +${slopePercent}%`;
  if (slopePercent <= -25) return `Đổ dốc gắt ${slopePercent}%`;
  return `Đổ dốc ${slopePercent}%`;
}

function haversineDistSqApprox(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = lat1 - lat2;
  const cosLat = Math.cos(((lat1 + lat2) * 0.5 * Math.PI) / 180);
  const dLng = (lng1 - lng2) * cosLat;
  return dLat * dLat + dLng * dLng;
}

export const ElevationProfileSVG: React.FC<ElevationProfileSVGProps> = React.memo(({
  trailId,
  gpxTrack,
  elevationGainM,
  maxAltitudeM,
  distanceKm = 10,
  waypoints = [],
  height = 170,
  onHoverCoordinate,
  externalHoverIndex = null,
}) => {
  const uniqueId = useId();
  const gradientId = `elevation-grad-${uniqueId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const [trackedTrailId, setTrackedTrailId] = useState<string | undefined>(trailId);
  const [demPoints, setDemPoints] = useState<ElevationSamplePoint[] | null>(null);
  const [demSource, setDemSource] = useState<'aws-terrarium-dem' | 'interpolated-fallback' | 'local'>('local');
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    alt: number;
    km: number;
    slope: string;
    slopePercent: number;
    lat: number;
    lng: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrubRafRef = useRef<number | null>(null);
  const pendingScrubRef = useRef<{ svgEl: SVGSVGElement; clientX: number } | null>(null);
  const lastHoveredIdxRef = useRef<number | null>(null);
  const onHoverCoordinateRef = useRef(onHoverCoordinate);

  useEffect(() => {
    onHoverCoordinateRef.current = onHoverCoordinate;
  }, [onHoverCoordinate]);

  // Immediately clear stale DEM curve when trailId changes (prevents Trail A curve lingering on Trail B)
  if (trackedTrailId !== trailId) {
    setTrackedTrailId(trailId);
    setDemPoints(null);
    setDemSource('local');
    setHoveredPoint(null);
  }

  useEffect(() => {
    if (!trailId) return;
    const controller = new AbortController();
    let cancelled = false;
    fetch(`/api/trails/${encodeURIComponent(trailId)}/elevation`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || controller.signal.aborted) return;
        if (json?.success && Array.isArray(json.data?.points) && json.data.points.length >= 2) {
          setDemPoints(json.data.points);
          const rawSrc = String(json.data.source || '').toLowerCase();
          setDemSource(
            rawSrc.includes('dem') && !rawSrc.includes('fallback') ? 'aws-terrarium-dem' : 'interpolated-fallback'
          );
        }
      })
      .catch(() => {
        // Offline / aborted -> keep local geometric fallback cleanly
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [trailId]);

  const svgWidth = 520;
  const paddingX = 20;
  const paddingTop = 28;
  const paddingBottom = 24;
  const drawWidth = svgWidth - paddingX * 2;
  const drawHeight = height - paddingTop - paddingBottom;

  const { points, minAlt, maxAlt, maxSlope } = useMemo(() => {
    if (demPoints && demPoints.length >= 2) {
      const alts = demPoints.map((p) => p.elevationM);
      const minA = Math.min(...alts);
      const maxA = Math.max(...alts, minA + 10);
      const totalKm = Math.max(0.1, demPoints[demPoints.length - 1].distanceKm || distanceKm || 1);
      let topSlope = 0;

      const mapped = demPoints.map((p) => {
        const progress = p.distanceKm / totalKm;
        const x = paddingX + progress * drawWidth;
        const yRatio = (p.elevationM - minA) / Math.max(1, maxA - minA);
        const y = height - paddingBottom - yRatio * drawHeight;
        if (Math.abs(p.slopePercent) > topSlope) topSlope = Math.abs(p.slopePercent);
        return {
          x,
          y,
          alt: p.elevationM,
          km: Math.round(p.distanceKm * 10) / 10,
          slope: formatSlopeLabel(p.slopePercent),
          slopePercent: p.slopePercent,
          lat: p.lat,
          lng: p.lng,
        };
      });
      return { points: mapped, minAlt: minA, maxAlt: maxA, maxSlope: Math.round(topSlope) };
    }

    if (!gpxTrack || gpxTrack.length < 2) {
      return { points: [], minAlt: 0, maxAlt: maxAltitudeM, maxSlope: 0 };
    }

    const numPoints = Math.min(Math.max(gpxTrack.length, 12), 36);
    const minA = Math.max(100, Math.round(maxAltitudeM - elevationGainM * 0.85));
    const maxA = Math.max(maxAltitudeM, minA + 10);

    // Detect whether track is a loop (start ~ end within 500m) vs point-to-point ascent to summit
    const firstPt = gpxTrack[0];
    const lastPt = gpxTrack[gpxTrack.length - 1];
    const isLoopTrack =
      Array.isArray(firstPt) &&
      Array.isArray(lastPt) &&
      haversineMeters(firstPt[0], firstPt[1], lastPt[0], lastPt[1]) <= 500;

    const generated: Array<{
      x: number;
      y: number;
      alt: number;
      km: number;
      slope: string;
      slopePercent: number;
      lat: number;
      lng: number;
    }> = [];

    for (let i = 0; i < numPoints; i++) {
      const progress = i / (numPoints - 1);
      const trackIdx = Math.min(gpxTrack.length - 1, Math.round(progress * (gpxTrack.length - 1)));
      const [lat, lng] = gpxTrack[trackIdx];
      // Point-to-point tracks climb smoothly to summit instead of plunging back to valley
      const curve = isLoopTrack ? Math.sin(progress * Math.PI) : Math.pow(progress, 0.85);
      const alt = Math.round(minA + (maxA - minA) * curve);
      const x = paddingX + progress * drawWidth;
      const yRatio = (alt - minA) / Math.max(1, maxA - minA);
      const y = height - paddingBottom - yRatio * drawHeight;
      const km = Number((progress * distanceKm).toFixed(1));
      const slopePercent =
        i === 0
          ? 0
          : Math.round(((alt - generated[i - 1].alt) / Math.max(50, (distanceKm * 1000) / numPoints)) * 100);
      generated.push({
        x,
        y,
        alt,
        km,
        slope: formatSlopeLabel(slopePercent),
        slopePercent,
        lat,
        lng,
      });
    }

    const topSlope = generated.reduce((m, p) => Math.max(m, Math.abs(p.slopePercent)), 0);
    return { points: generated, minAlt: minA, maxAlt: maxA, maxSlope: topSlope };
  }, [demPoints, gpxTrack, elevationGainM, maxAltitudeM, distanceKm, drawWidth, drawHeight, height]);

  // Project ALL waypoints onto nearest track coordinates & de-clutter horizontal label collisions
  const projectedWaypoints = useMemo(() => {
    if (points.length < 2 || !waypoints || waypoints.length === 0) return [];
    const mapped = waypoints.map((wp, idx) => {
      const hasValidCoords = Number.isFinite(wp.lat) && Number.isFinite(wp.lng) && (wp.lat !== 0 || wp.lng !== 0);
      if (hasValidCoords) {
        let nearestPt = points[0];
        let bestDistSq = Infinity;
        for (const p of points) {
          const dSq = haversineDistSqApprox(wp.lat, wp.lng, p.lat, p.lng);
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            nearestPt = p;
          }
        }
        return { wp, pt: nearestPt };
      }
      const fallbackProgress = (idx + 1) / (waypoints.length + 1);
      return { wp, pt: points[Math.floor(fallbackProgress * (points.length - 1))] };
    });

    // Sort left-to-right to suppress colliding text labels while keeping every waypoint marker visible
    const sorted = [...mapped].sort((a, b) => a.pt.x - b.pt.x);
    let lastLabeledX = -Infinity;
    return sorted.map((entry) => {
      const clampedX = Math.min(svgWidth - 52, Math.max(52, entry.pt.x));
      const showLabel = clampedX - lastLabeledX >= 72;
      if (showLabel) lastLabeledX = clampedX;
      return { ...entry, clampedX, showLabel };
    });
  }, [points, waypoints, svgWidth]);

  // Map -> Chart reverse hover sync: resolve external GPX track index onto nearest elevation point
  const externalHoveredPoint = useMemo(() => {
    if (
      externalHoverIndex === null ||
      externalHoverIndex === undefined ||
      points.length < 2 ||
      !Array.isArray(gpxTrack) ||
      gpxTrack.length < 2
    ) {
      return null;
    }
    const clampedIdx = Math.max(0, Math.min(gpxTrack.length - 1, Math.round(externalHoverIndex)));
    const targetCoord = gpxTrack[clampedIdx];
    if (
      Array.isArray(targetCoord) &&
      Number.isFinite(targetCoord[0]) &&
      Number.isFinite(targetCoord[1])
    ) {
      let nearest = points[0];
      let bestDistSq = Infinity;
      for (const p of points) {
        const dSq = haversineDistSqApprox(targetCoord[0], targetCoord[1], p.lat, p.lng);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          nearest = p;
        }
      }
      return nearest;
    }
    const ratio = clampedIdx / Math.max(1, gpxTrack.length - 1);
    return points[Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))];
  }, [externalHoverIndex, gpxTrack, points]);

  const activeHoverPoint = hoveredPoint || externalHoveredPoint;

  // Reset deduplicated hover index whenever trail or point array changes, and cancel pending rAF on unmount
  useEffect(() => {
    lastHoveredIdxRef.current = null;
  }, [trailId, points]);

  useEffect(() => {
    return () => {
      if (scrubRafRef.current !== null) {
        window.cancelAnimationFrame(scrubRafRef.current);
        scrubRafRef.current = null;
      }
    };
  }, []);

  // Memoize Catmull-Rom smooth SVG path, fill area & peak marker geometry
  const svgGeometry = useMemo(() => {
    if (points.length < 2) return null;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    const areaD = `${d} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
    const peakPoint = points.reduce((prev, curr) => (curr.alt > prev.alt ? curr : prev), points[0]);
    const clampedPeakLabelX = Math.min(svgWidth - 82, Math.max(82, peakPoint.x));
    return { pathD: d, areaD, peakPoint, clampedPeakLabelX };
  }, [points, height, paddingBottom, svgWidth]);

  const scheduleScrub = useCallback(
    (svgEl: SVGSVGElement, clientX: number) => {
      pendingScrubRef.current = { svgEl, clientX };
      if (scrubRafRef.current !== null) return;
      scrubRafRef.current = window.requestAnimationFrame(() => {
        scrubRafRef.current = null;
        const pending = pendingScrubRef.current;
        if (!pending || points.length < 2) return;
        const rect = pending.svgEl.getBoundingClientRect();
        if (rect.width <= 0) return;
        const svgX = ((pending.clientX - rect.left) / rect.width) * svgWidth;

        let nearestIdx = 0;
        let minDist = Infinity;
        for (let i = 0; i < points.length; i++) {
          const dist = Math.abs(points[i].x - svgX);
          if (dist < minDist) {
            minDist = dist;
            nearestIdx = i;
          }
        }
        if (nearestIdx === lastHoveredIdxRef.current) return;
        lastHoveredIdxRef.current = nearestIdx;
        const nearest = points[nearestIdx];
        setHoveredPoint(nearest);
        onHoverCoordinateRef.current?.([nearest.lat, nearest.lng]);
      });
    },
    [points, svgWidth]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      scheduleScrub(e.currentTarget, e.clientX);
    },
    [scheduleScrub]
  );

  const handleTouchScrub = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (e.touches && e.touches.length > 0) {
        scheduleScrub(e.currentTarget, e.touches[0].clientX);
      }
    },
    [scheduleScrub]
  );

  const handleScrubEnd = useCallback(() => {
    pendingScrubRef.current = null;
    if (scrubRafRef.current !== null) {
      window.cancelAnimationFrame(scrubRafRef.current);
      scrubRafRef.current = null;
    }
    if (lastHoveredIdxRef.current !== null) {
      lastHoveredIdxRef.current = null;
      setHoveredPoint(null);
      onHoverCoordinateRef.current?.(null);
    }
  }, []);

  if (!svgGeometry) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-dim)',
          fontSize: '0.85rem',
          background: 'var(--color-bg-main)',
          borderRadius: 6,
          border: '1px dashed var(--color-border)',
        }}
      >
        Chưa có dữ liệu trắc diện cao độ
      </div>
    );
  }

  const { pathD, areaD, peakPoint, clampedPeakLabelX } = svgGeometry;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        position: 'relative',
        background: 'var(--color-bg-main)',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        padding: '14px 16px 10px 16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-primary)' }}>
          <IconMountain size={16} color="var(--color-primary)" />
          <span>TRẮC DIỆN CAO ĐỘ THỰC ĐỊA</span>
          {demSource === 'aws-terrarium-dem' && (
            <span
              style={{
                fontSize: '0.66rem',
                padding: '2px 7px',
                borderRadius: 4,
                background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)',
                color: 'var(--color-primary)',
                fontWeight: 700,
              }}
            >
              AWS Open Data Terrarium DEM
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)' }}>
          Chạm hoặc rê chuột để đồng bộ bản đồ · Dốc tối đa {maxSlope}%
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${height}`}
          style={{ width: '100%', height: 'auto', overflow: 'visible', cursor: 'crosshair', touchAction: 'pan-y' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleScrubEnd}
          onTouchStart={handleTouchScrub}
          onTouchMove={handleTouchScrub}
          onTouchEnd={handleScrubEnd}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.48" />
              <stop offset="55%" stopColor="var(--color-sky)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

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

          <path d={areaD} fill={`url(#${gradientId})`} />
          <path
            d={pathD}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Peak Marker with Clamped Label Inside ViewBox */}
          <g>
            <circle cx={peakPoint.x} cy={peakPoint.y} r={5} fill="var(--color-sun)" />
            <circle cx={peakPoint.x} cy={peakPoint.y} r={9} fill="none" stroke="var(--color-sun)" strokeWidth="1.5" opacity={0.6} />
            <text
              x={clampedPeakLabelX}
              y={Math.max(14, peakPoint.y - 12)}
              fill="var(--color-sun)"
              fontSize="11"
              fontWeight="900"
              textAnchor="middle"
            >
              Đỉnh DEM: {peakPoint.alt.toLocaleString('vi-VN')}m
            </text>
          </g>

          {/* GPS-Projected Waypoints (All Waypoints with Collision-Free Labels) */}
          {projectedWaypoints.map(({ wp, pt, clampedX, showLabel }, idx) => {
            if (!pt) return null;
            const shortName = wp.name.length > 16 ? `${wp.name.slice(0, 15)}…` : wp.name;
            return (
              <g key={wp.id || idx}>
                <title>{wp.name}</title>
                <circle cx={pt.x} cy={pt.y} r={3.5} fill="var(--color-stream)" />
                {showLabel && (
                  <text
                    x={clampedX}
                    y={Math.min(height - 4, pt.y + 14)}
                    fill="var(--color-stream)"
                    fontSize="9"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {shortName}
                  </text>
                )}
              </g>
            );
          })}

          {/* Interactive Crosshair (supports both Chart scrub & Map -> Chart reverse hover sync) */}
          {activeHoverPoint && (
            <g>
              <line
                x1={activeHoverPoint.x}
                y1={paddingTop - 10}
                x2={activeHoverPoint.x}
                y2={height - paddingBottom}
                stroke="var(--color-text-main)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity={0.8}
              />
              <circle
                cx={activeHoverPoint.x}
                cy={activeHoverPoint.y}
                r={6}
                fill="var(--color-bg-card)"
                stroke="var(--color-primary)"
                strokeWidth="3"
              />
            </g>
          )}
        </svg>

        {activeHoverPoint && (
          <div
            style={{
              position: 'absolute',
              top: Math.max(0, (activeHoverPoint.y / height) * 100 - 30) + '%',
              left: Math.min(80, Math.max(16, (activeHoverPoint.x / svgWidth) * 100)) + '%',
              transform: 'translate(-50%, -100%)',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-primary)',
              borderRadius: 4,
              padding: '6px 10px',
              fontSize: '0.75rem',
              color: 'var(--color-text-main)',
              boxShadow: 'var(--shadow-card)',
              pointerEvents: 'none',
              zIndex: 10,
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
              Km {activeHoverPoint.km} · Cao độ: {activeHoverPoint.alt.toLocaleString('vi-VN')}m
            </div>
            <div
              style={{
                color: Math.abs(activeHoverPoint.slopePercent) >= 25 ? 'var(--color-error-text, var(--color-error))' : 'var(--color-text-muted)',
                fontSize: '0.7rem',
                marginTop: 2,
                fontWeight: 700,
              }}
            >
              {activeHoverPoint.slope}
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
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        <span>Thấp nhất: {minAlt.toLocaleString('vi-VN')}m</span>
        <span style={{ color: 'var(--color-earth)', fontWeight: 700 }}>
          Tích lũy: +{elevationGainM.toLocaleString('vi-VN')}m
        </span>
        <span>Cao nhất: {maxAlt.toLocaleString('vi-VN')}m ({distanceKm} km)</span>
      </div>
    </div>
  );
});
