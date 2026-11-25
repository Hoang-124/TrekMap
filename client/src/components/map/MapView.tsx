import React, { useEffect, useState, useMemo, useRef, useCallback, Suspense, lazy } from 'react';
import type * as maplibregl from 'maplibre-gl';
import {
  LostVectorMap,
  type LostMapBasemap,
  type LostMapCircleItem,
  type LostMapClusterPoint,
  type LostMapMarkerItem,
  type LostMapPolylineItem,
} from './LostVectorMap.js';
import type { Trail, Incident, Waypoint } from '../../types.js';
import { FREE_BASEMAPS, FREE_BASEMAP_ORDER } from '../../utils/mapTiles.js';
import { fetchNearbyTrails, reverseGeocode } from '../../services/api.js';
import {
  distanceToTrackMeters,
  calculateRecordedDistanceKm,
  buildRecordedGpxXml,
  haversineMeters,
  type RecordedTrackPoint,
} from '../../utils/geoMath.js';

type MapIncident = Incident & { _id?: string; active?: boolean };
type TrailWithMeta = Trail & { _id?: string; estimatedRoadDistanceKm?: number };

const Terrain3DModal = lazy(() => import('./Terrain3DModal.js'));

const VIETNAM_CENTER: [number, number] = [16.047, 108.2062];
const VIETNAM_OVERVIEW_ZOOM = 5.1;
const VIETNAM_MAX_BOUNDS: [[number, number], [number, number]] = [
  [6.5, 100.5],
  [24.8, 115.5],
];

function playOffTrailWarningBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    setTimeout(() => void ctx.close(), 500);
  } catch {
    // Audio playback blocked by browser autoplay policy
  }
}

const createSvgIcon = (d: React.ReactNode, defaultSize = 18) => {
  return ({
    size = defaultSize,
    color = 'currentColor',
    style,
  }: {
    size?: number;
    color?: string;
    style?: React.CSSProperties;
  }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {d}
    </svg>
  );
};

const FilterIcon = createSvgIcon(<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />);
const ActivityIcon = createSvgIcon(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />);
const AlertTriangleIcon = createSvgIcon(
  <>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </>
);
const CloseIcon = createSvgIcon(
  <>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </>
);
const ShieldCheckIcon = createSvgIcon(
  <>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </>
);

function getDifficultyInfo(difficulty: number) {
  const diff = Number(difficulty) || 3;
  if (diff >= 4) {
    return {
      semantic: 'danger' as const,
      token: 'var(--color-error)',
      onToken: 'var(--color-on-danger)',
      label: 'Khó',
    };
  }
  if (diff === 3) {
    return {
      semantic: 'warn' as const,
      token: 'var(--color-sun)',
      onToken: 'var(--color-on-primary)',
      label: 'Vừa sức',
    };
  }
  return {
    semantic: 'primary' as const,
    token: 'var(--color-primary)',
    onToken: 'var(--color-on-primary)',
    label: 'Dễ đi',
  };
}

function getAlertToken(severity?: string): { token: string; onToken: string; label: string } {
  if (severity === 'critical') {
    return { token: 'var(--color-error)', onToken: 'var(--color-on-danger)', label: 'Khẩn cấp' };
  }
  if (severity === 'high') {
    return { token: 'var(--color-earth)', onToken: 'var(--color-on-primary)', label: 'Cẩn trọng' };
  }
  return { token: 'var(--color-sun)', onToken: 'var(--color-on-primary)', label: 'Lưu ý' };
}

function mapWmoWeatherCode(code: number): string {
  if (code === 0) return 'Trời quang';
  if (code >= 1 && code <= 3) return 'Nhiều mây';
  if (code === 45 || code === 48) return 'Sương mù dày';
  if (code >= 51 && code <= 67) return 'Mưa nhỏ / mưa phùn';
  if (code >= 71 && code <= 77) return 'Băng giá trên đỉnh';
  if (code >= 80 && code <= 82) return 'Mưa rào';
  if (code >= 95) return 'Giông lốc';
  return 'Thời tiết vùng núi';
}

function matchTrailIncident(trail: Trail, incidents: MapIncident[] = []): MapIncident | undefined {
  if (!incidents || incidents.length === 0) return undefined;
  const tid = trail.id || (trail as TrailWithMeta)._id;
  const normalizeVn = (s: string) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, '');
  const normTrail = normalizeVn(trail.name);

  return incidents.find((inc) => {
    if (!inc || inc.resolved || inc.active === false) return false;
    if (inc.trailId && (inc.trailId === tid || inc.trailId === trail.id)) return true;
    if (inc.trailName && normTrail) {
      const normInc = normalizeVn(inc.trailName);
      if (normInc && (normInc.includes(normTrail) || normTrail.includes(normInc))) return true;
    }
    return false;
  });
}

function findNearestTrackIndex(lat: number, lng: number, track: [number, number][]): number {
  let bestIdx = 0;
  let bestDistSq = Infinity;
  for (let i = 0; i < track.length; i++) {
    const pt = track[i];
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const dLat = pt[0] - lat;
    const cosLat = Math.cos(((pt[0] + lat) * 0.5 * Math.PI) / 180);
    const dLng = (pt[1] - lng) * cosLat;
    const dSq = dLat * dLat + dLng * dLng;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function computeTrackBounds(track: [number, number][]): [[number, number], [number, number]] | null {
  if (!Array.isArray(track) || track.length < 2) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const pt of track) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const lat = Number(pt[0]);
    const lng = Number(pt[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  if (!Number.isFinite(minLat) || !Number.isFinite(maxLat)) return null;
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

const WAYPOINT_META: Record<
  string,
  { label: string; color: 'primary' | 'danger' | 'warn' | 'info' | 'muted'; badge: string; token: string }
> = {
  campsite: { label: 'Lán nghỉ / bãi trại', color: 'primary', badge: 'L', token: 'var(--color-primary)' },
  water: { label: 'Nguồn nước suối', color: 'info', badge: 'N', token: 'var(--color-sky)' },
  viewpoint: { label: 'Điểm ngắm cảnh', color: 'warn', badge: 'C', token: 'var(--color-sun)' },
  danger: { label: 'Đoạn cần lưu ý', color: 'danger', badge: '!', token: 'var(--color-error)' },
  summit: { label: 'Đỉnh / cột mốc', color: 'warn', badge: 'Đ', token: 'var(--color-sun)' },
  rest: { label: 'Điểm dừng chân', color: 'primary', badge: 'D', token: 'var(--color-primary)' },
  charging: { label: 'Lán có hỗ trợ', color: 'primary', badge: 'H', token: 'var(--color-primary)' },
};

const FIELD_POI_META: Record<
  string,
  { label: string; color: 'primary' | 'danger' | 'warn' | 'info' | 'muted'; badge: string; token: string }
> = {
  water: { label: 'Nguồn nước anh em chia sẻ', color: 'info', badge: 'N', token: 'var(--color-sky)' },
  camp: { label: 'Bãi trại cộng đồng', color: 'primary', badge: 'T', token: 'var(--color-primary)' },
  signal: { label: 'Điểm bắt được sóng 4G', color: 'info', badge: '4G', token: 'var(--color-sky)' },
  danger: { label: 'Điểm cảnh báo đường rừng', color: 'danger', badge: '!', token: 'var(--color-error)' },
  viewpoint: { label: 'Điểm săn mây / ngắm cảnh', color: 'warn', badge: 'M', token: 'var(--color-sun)' },
};

// Hover Preview Card (Strict Dual-Theme Tokens)
export const TacticalTrailTooltip: React.FC<{
  trail: Trail;
  incident?: MapIncident;
  onSelect?: () => void;
}> = React.memo(({ trail, incident, onSelect }) => {
  const diffInfo = getDifficultyInfo(trail.difficultyLevel);
  const hasAlert = Boolean(incident);
  const alertMeta = getAlertToken(incident?.severity);

  return (
    <div
      onClick={(e) => {
        if (onSelect) {
          e.stopPropagation();
          onSelect();
        }
      }}
      style={{
        width: 292,
        maxWidth: 'calc(100vw - 32px)',
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-strong)',
        borderRadius: 6,
        padding: '12px 14px',
        boxShadow: 'var(--shadow-card)',
        color: 'var(--color-text-main)',
        textAlign: 'left',
        fontFamily: 'var(--font-family)',
        cursor: onSelect ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 8px',
            borderRadius: 4,
            background: `color-mix(in srgb, ${diffInfo.token} 14%, transparent)`,
            border: `1px solid color-mix(in srgb, ${diffInfo.token} 38%, transparent)`,
            fontSize: '10.5px',
            fontWeight: 800,
            color: diffInfo.token,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: diffInfo.token,
              display: 'inline-block',
            }}
          />
          <span>
            {diffInfo.label} ({trail.difficultyLevel}/5)
          </span>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            background: 'var(--color-surface-elevated)',
            padding: '2px 8px',
            borderRadius: 4,
            border: '1px solid var(--color-border)',
            maxWidth: 150,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>
            {trail.province}
            {trail.district ? `, ${trail.district}` : ''}
          </span>
        </div>
      </div>

      <div
        style={{
          fontSize: '13.5px',
          fontWeight: 800,
          color: 'var(--color-text-main)',
          lineHeight: 1.38,
          marginBottom: 9,
          wordBreak: 'break-word',
        }}
      >
        {trail.name}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
          marginBottom: 9,
        }}
      >
        <div
          style={{
            background: 'var(--color-bg-main)',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            padding: '6px 4px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '9px', color: 'var(--color-text-dim)', fontWeight: 700 }}>Quãng đường</div>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary)', marginTop: 2 }}>
            {trail.distanceKm || '--'} km
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-bg-main)',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            padding: '6px 4px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '9px', color: 'var(--color-text-dim)', fontWeight: 700 }}>Độ cao đỉnh</div>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-sky)', marginTop: 2 }}>
            {trail.maxAltitudeM || '--'}m
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-bg-main)',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            padding: '6px 4px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '9px', color: 'var(--color-text-dim)', fontWeight: 700 }}>Lịch trình</div>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-sun)', marginTop: 2 }}>
            {trail.durationDays ? `${trail.durationDays} ngày` : '1–2 ngày'}
          </div>
        </div>
      </div>

      {hasAlert && incident && (
        <div
          style={{
            marginBottom: 9,
            padding: '8px 10px',
            background: 'var(--banner-danger-bg)',
            border: '1px solid var(--banner-danger-border)',
            borderLeft: `3px solid ${alertMeta.token}`,
            borderRadius: 4,
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: '10px',
                fontWeight: 800,
                color: alertMeta.token,
              }}
            >
              <AlertTriangleIcon size={12} color={alertMeta.token} />
              <span>Lưu ý an toàn</span>
            </span>
            <span
              style={{
                fontSize: '8.5px',
                fontWeight: 800,
                background: alertMeta.token,
                color: alertMeta.onToken,
                padding: '1px 6px',
                borderRadius: 3,
              }}
            >
              {alertMeta.label}
            </span>
          </div>
          <div
            style={{
              fontSize: '10.5px',
              color: 'var(--banner-danger-text)',
              fontWeight: 500,
              lineHeight: 1.4,
              wordBreak: 'break-word',
            }}
          >
            {incident.description || 'Đang có lưu ý an toàn trên đoạn đường này.'}
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 10px',
          borderRadius: 4,
          background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-primary) 32%, transparent)',
          color: 'var(--color-primary)',
          fontSize: '11px',
          fontWeight: 800,
        }}
      >
        <span>Chạm để xem thời tiết đỉnh &amp; chi tiết cung</span>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
    </div>
  );
});

// Safety Incidents Drawer
export const TacticalIncidentsDrawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  alertTrails: Array<{ trail: Trail; incident: MapIncident }>;
  onFlyTo: (trail: Trail) => void;
  onSelectTrail?: (trail: Trail) => void;
  onFilterAlerts: () => void;
  isFilterActive: boolean;
}> = React.memo(({ isOpen, onClose, alertTrails, onFlyTo, onSelectTrail, onFilterAlerts, isFilterActive }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 56,
        right: 12,
        width: 'min(360px, calc(100% - 24px))',
        maxHeight: 'calc(100% - 76px)',
        background: 'var(--color-bg-card)',
        border: '1px solid var(--banner-danger-border)',
        borderRadius: 6,
        boxShadow: 'var(--shadow-3d)',
        zIndex: 'calc(var(--z-map-hud, 400) + 2)' as unknown as number,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          background: 'var(--banner-danger-bg)',
          borderBottom: '1px solid var(--banner-danger-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--color-error) 18%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-error) 45%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertTriangleIcon size={16} color="var(--color-error)" />
          </div>
          <div>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
              Cảnh báo trên đường mòn
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
              {alertTrails.length} cung đang có lưu ý từ anh em đi trước
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng bảng cảnh báo"
          style={{
            background: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          <CloseIcon size={14} />
        </button>
      </div>

      <div
        style={{
          padding: '8px 14px',
          background: 'var(--color-bg-main)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
          {isFilterActive ? 'Đang chỉ hiện các cung có cảnh báo' : 'Đang hiện toàn bộ các cung trên bản đồ'}
        </span>
        <button
          type="button"
          onClick={onFilterAlerts}
          style={{
            background: isFilterActive
              ? 'color-mix(in srgb, var(--color-error) 18%, transparent)'
              : 'var(--color-surface-elevated)',
            border: isFilterActive ? '1px solid var(--color-error)' : '1px solid var(--color-border)',
            color: isFilterActive ? 'var(--color-error-text, var(--color-error))' : 'var(--color-text-main)',
            borderRadius: 4,
            padding: '3px 8px',
            fontSize: '0.7rem',
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {isFilterActive ? 'Hiện lại tất cả' : 'Chỉ xem điểm cảnh báo'}
        </button>
      </div>

      <div
        style={{
          padding: 12,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxHeight: 360,
        }}
      >
        {alertTrails.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 14px', color: 'var(--color-text-dim)' }}>
            <div style={{ display: 'inline-flex', marginBottom: 8, color: 'var(--color-primary)' }}>
              <ShieldCheckIcon size={28} color="var(--color-primary)" />
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
              Đường rừng đang êm
            </div>
            <div style={{ fontSize: '0.72rem', marginTop: 4, color: 'var(--color-text-muted)' }}>
              Hiện chưa có ghi nhận sạt lở, lũ suối hay thời tiết bất thường trên các cung đường.
            </div>
          </div>
        ) : (
          alertTrails.map(({ trail, incident }) => {
            const alertMeta = getAlertToken(incident?.severity);
            return (
              <div
                key={trail.id || trail.name}
                style={{
                  background: 'var(--color-bg-main)',
                  border: `1px solid color-mix(in srgb, ${alertMeta.token} 35%, transparent)`,
                  borderLeft: `3px solid ${alertMeta.token}`,
                  borderRadius: 4,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div
                      style={{
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        color: 'var(--color-text-main)',
                        lineHeight: 1.3,
                      }}
                    >
                      {trail.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {trail.province}
                      {trail.district ? `, ${trail.district}` : ''} · {trail.region}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.64rem',
                      fontWeight: 800,
                      background: alertMeta.token,
                      color: alertMeta.onToken,
                      padding: '2px 7px',
                      borderRadius: 3,
                      flexShrink: 0,
                    }}
                  >
                    {alertMeta.label}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--banner-danger-text)',
                    background: 'var(--banner-danger-bg)',
                    borderLeft: `3px solid ${alertMeta.token}`,
                    padding: '6px 8px',
                    borderRadius: 4,
                    lineHeight: 1.45,
                  }}
                >
                  {incident.description || 'Có lưu ý an toàn mới trên cung đường này.'}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <button
                    type="button"
                    onClick={() => onFlyTo(trail)}
                    style={{
                      flex: 1,
                      background: 'color-mix(in srgb, var(--color-sky) 14%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--color-sky) 38%, transparent)',
                      color: 'var(--color-sky)',
                      borderRadius: 4,
                      padding: '6px 10px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                    }}
                  >
                    <span>Xem trên bản đồ</span>
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </button>

                  {onSelectTrail && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectTrail(trail);
                        onClose();
                      }}
                      style={{
                        flex: 1,
                        background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--color-primary) 38%, transparent)',
                        color: 'var(--color-primary)',
                        borderRadius: 4,
                        padding: '6px 10px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                      }}
                    >
                      <span>Chi tiết cung</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

// Interactive Trail Inspect Card with Live Summit Weather & Safety Notice
export const TrailPopupContent: React.FC<{ trail: Trail; incident?: MapIncident; onSelect: () => void }> = React.memo(
  ({ trail, incident, onSelect }) => {
    const weatherLat = Number.isFinite(trail.endLat) ? trail.endLat : trail.startLat;
    const weatherLng = Number.isFinite(trail.endLng) ? trail.endLng : trail.startLng;
    const weatherKey = `${trail.id}:${weatherLat}:${weatherLng}`;
    const [weather, setWeather] = useState<{
      key: string;
      temp: number;
      condition: string;
      humidity?: number;
      windspeed?: number;
    } | null>(null);

    useEffect(() => {
      const controller = new AbortController();
      const fetchWeather = async () => {
        try {
          const res = await fetch(`/api/weather/forecast?lat=${weatherLat}&lng=${weatherLng}`, {
            signal: controller.signal,
          });
          const json = await res.json();
          const condMap: Record<string, string> = {
            clear: 'Trời quang',
            cloudy: 'Nhiều mây',
            foggy: 'Sương mù',
            rainy: 'Mưa rào',
            storm: 'Giông bão',
          };
          if (controller.signal.aborted || !json?.success || !json.data) return;

          const curr = json.data.current;
          if (curr && (typeof curr.tempC === 'number' || typeof curr.temp === 'number')) {
            const tempVal = typeof curr.tempC === 'number' ? curr.tempC : curr.temp;
            const conditionLabel = curr.condition
              ? condMap[curr.condition] || String(curr.condition)
              : typeof curr.weathercode === 'number'
              ? mapWmoWeatherCode(curr.weathercode)
              : Array.isArray(json.data.daily) && json.data.daily[0]?.weatherCondition
              ? condMap[json.data.daily[0].weatherCondition] || 'Thời tiết vùng núi'
              : 'Thời tiết vùng núi';

            setWeather({
              key: weatherKey,
              temp: Math.round(tempVal),
              condition: conditionLabel,
              humidity: typeof curr.humidity === 'number' ? Math.round(curr.humidity) : undefined,
              windspeed: typeof curr.windspeed === 'number' ? Math.round(curr.windspeed) : undefined,
            });
          } else if (Array.isArray(json.data.daily) && json.data.daily.length > 0) {
            const today = json.data.daily[0];
            setWeather({
              key: weatherKey,
              temp: Math.round(((today.tempMinC ?? 15) + (today.tempMaxC ?? 22)) / 2),
              condition: condMap[today.weatherCondition] || 'Thời tiết vùng núi',
              humidity: typeof today.humidityPercent === 'number' ? Math.round(today.humidityPercent) : undefined,
              windspeed: typeof today.windSpeedKmH === 'number' ? Math.round(today.windSpeedKmH) : undefined,
            });
          } else if (Array.isArray(json.data) && json.data.length > 0) {
            const today = json.data[0];
            setWeather({
              key: weatherKey,
              temp: Math.round(((today.tempMinC ?? 15) + (today.tempMaxC ?? 22)) / 2),
              condition: condMap[today.weatherCondition] || 'Thời tiết vùng núi',
              humidity: typeof today.humidityPercent === 'number' ? Math.round(today.humidityPercent) : undefined,
              windspeed: typeof today.windSpeedKmH === 'number' ? Math.round(today.windSpeedKmH) : undefined,
            });
          }
        } catch {
          // Ignore abort / offline weather failure cleanly
        }
      };
      void fetchWeather();
      return () => {
        controller.abort();
      };
    }, [weatherKey, weatherLat, weatherLng]);

    const activeWeather = weather && weather.key === weatherKey ? weather : null;

    const diffInfo = getDifficultyInfo(trail.difficultyLevel);
    const alertMeta = getAlertToken(incident?.severity);

    return (
      <div style={{ width: '100%', padding: '2px 0', fontFamily: 'var(--font-family)' }}>
        <div
          style={{
            position: 'relative',
            height: 118,
            borderRadius: 4,
            overflow: 'hidden',
            marginBottom: 10,
            border: '1px solid var(--color-border)',
          }}
        >
          <img
            src={trail.coverImage}
            alt={trail.name}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              background: diffInfo.token,
              color: diffInfo.onToken,
              fontWeight: 800,
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: 3,
            }}
          >
            {diffInfo.label} · {trail.difficultyLevel}/5
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              background: 'var(--color-bg-hud)',
              color: 'var(--color-primary)',
              fontWeight: 800,
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: 3,
              border: '1px solid var(--color-border)',
            }}
          >
            {trail.region}
          </div>
        </div>

        <h4
          style={{
            margin: '0 0 8px 0',
            fontSize: '0.95rem',
            fontWeight: 800,
            color: 'var(--color-text-main)',
            lineHeight: 1.35,
          }}
        >
          {trail.name}
        </h4>

        {incident && (
          <div
            style={{
              background: 'var(--banner-danger-bg)',
              border: '1px solid var(--banner-danger-border)',
              borderLeft: `3px solid ${alertMeta.token}`,
              borderRadius: 4,
              padding: '8px 10px',
              marginBottom: 8,
              lineHeight: 1.35,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontWeight: 800,
                  color: alertMeta.token,
                  fontSize: '0.74rem',
                }}
              >
                <AlertTriangleIcon size={12} color={alertMeta.token} />
                <span>Lưu ý trên đường</span>
              </span>
              <span
                style={{
                  fontSize: '0.62rem',
                  background: alertMeta.token,
                  color: alertMeta.onToken,
                  padding: '1px 6px',
                  borderRadius: 3,
                  fontWeight: 800,
                }}
              >
                {alertMeta.label}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--banner-danger-text)', lineHeight: 1.4 }}>
              {incident.description}
            </div>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 4,
            background: 'var(--color-bg-main)',
            padding: '7px 8px',
            borderRadius: 4,
            textAlign: 'center',
            marginBottom: 8,
            border: '1px solid var(--color-border)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)', fontWeight: 700 }}>Quãng đường</div>
            <strong style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>{trail.distanceKm} km</strong>
          </div>
          <div style={{ borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)', fontWeight: 700 }}>Tổng leo</div>
            <strong style={{ fontSize: '0.8rem', color: 'var(--color-sky)' }}>+{trail.elevationGainM}m</strong>
          </div>
          <div>
            <div style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)', fontWeight: 700 }}>Thời gian</div>
            <strong style={{ fontSize: '0.8rem', color: 'var(--color-sun)' }}>{trail.durationDays} ngày</strong>
          </div>
        </div>

        {activeWeather && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 6,
              background: 'color-mix(in srgb, var(--color-sky) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-sky) 32%, transparent)',
              borderRadius: 4,
              padding: '5px 9px',
              fontSize: '0.73rem',
              color: 'var(--color-sky)',
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
              </svg>
              <span>{activeWeather.condition}</span>
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {activeWeather.temp}°C
              {activeWeather.humidity !== undefined ? ` · ${activeWeather.humidity}%` : ''}
              {activeWeather.windspeed !== undefined ? ` · ${activeWeather.windspeed}km/h` : ''}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onSelect}
          style={{
            width: '100%',
            background: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            border: 'none',
            borderRadius: 4,
            padding: '9px 12px',
            fontWeight: 800,
            fontSize: '0.78rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span>Mở hồ sơ cung đường</span>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    );
  }
);

export interface MapFieldPoi {
  id: string;
  title: string;
  category: string;
  lat: number;
  lng: number;
  status?: string;
  notes?: string;
}

export interface MapViewProps {
  trails: Trail[];
  selectedTrail?: Trail | null;
  onSelectTrail?: (trail: Trail) => void;
  onFocusTrail?: (trail: Trail) => void;
  incidents?: MapIncident[];
  height?: string;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  allTrails?: Trail[];
  onSelectRegion?: (region: string) => void;
  highlightedPoint?: [number, number] | null;
  trailPois?: MapFieldPoi[];
  onHoverTrackIndex?: (index: number | null) => void;
}

type InspectedDetailCard =
  | { kind: 'waypoint'; wp: Waypoint; metaLabel: string; token: string }
  | { kind: 'poi'; poi: MapFieldPoi; metaLabel: string; token: string }
  | { kind: 'user-gps' };

export const MapView: React.FC<MapViewProps> = React.memo(
  ({
    trails,
    selectedTrail,
    onSelectTrail,
    onFocusTrail,
    incidents = [],
    height = '100%',
    onShowToast,
    allTrails,
    onSelectRegion,
    highlightedPoint,
    trailPois = [],
    onHoverTrackIndex,
  }) => {
    const mapInstanceRef = useRef<maplibregl.Map | null>(null);
    const mapWrapperRef = useRef<HTMLDivElement | null>(null);

    const [basemap, setBasemap] = useState<LostMapBasemap>('topo');
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [isFallbackLocation, setIsFallbackLocation] = useState(false);
    const [flyToReq, setFlyToReq] = useState<{
      lat: number;
      lng: number;
      zoom?: number;
      duration?: number;
      key: number;
    } | null>(null);
    const [trackedSelectedTrailId, setTrackedSelectedTrailId] = useState<string | undefined>(selectedTrail?.id);
    const [isScrollZoomUnlocked, setIsScrollZoomUnlocked] = useState<boolean>(() => Boolean(selectedTrail));
    const [isLocating, setIsLocating] = useState(false);
    const [isLiveTracking, setIsLiveTracking] = useState(false);
    const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
    const [gpsAltitude, setGpsAltitude] = useState<number | null>(null);
    const [gpsSpeed, setGpsSpeed] = useState<number | null>(null);
    const [recordedTrack, setRecordedTrack] = useState<RecordedTrackPoint[]>([]);
    const [offTrailMeters, setOffTrailMeters] = useState<number | null>(null);
    const [isTerrain3DOpen, setIsTerrain3DOpen] = useState(false);
    const [focusedTrailId, setFocusedTrailId] = useState<string | null>(null);
    const [inspectedTrailId, setInspectedTrailId] = useState<string | null>(null);
    const [inspectedDetailCard, setInspectedDetailCard] = useState<InspectedDetailCard | null>(null);
    const [hoveredTrailPreview, setHoveredTrailPreview] = useState<{
      trailId: string;
      x: number;
      y: number;
    } | null>(null);
    const [showWaypoints, setShowWaypoints] = useState<boolean>(true);
    const [isAlertsDrawerOpen, setIsAlertsDrawerOpen] = useState(false);
    const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard' | 'alert'>('all');
    const [highAltitudeOnly, setHighAltitudeOnly] = useState(false);
    const [beginnerOnly, setBeginnerOnly] = useState(false);
    const [gpsRadiusKm, setGpsRadiusKm] = useState<null | 50 | 150 | 300>(null);
    const [showGpxTracks, setShowGpxTracks] = useState(true);
    const [gpsToast, setGpsToast] = useState<{
      lat: number;
      lng: number;
      nearby: Trail[];
      geocodedAddress?: string;
      isFallback?: boolean;
    } | null>(null);

    const lastOffTrailBeepRef = useRef<number>(0);
    const lastGpsTimeoutWarnRef = useRef<number>(0);
    const hasCenteredLiveGpsRef = useRef<boolean>(false);
    const basemapRef = useRef<LostMapBasemap>(basemap);
    const selectedTrailRef = useRef<Trail | null | undefined>(selectedTrail);
    const watchIdRef = useRef<number | null>(null);
    const locateAbortRef = useRef<AbortController | null>(null);
    const hoverRafRef = useRef<number | null>(null);
    const lastHoverTrackIdxRef = useRef<number | null>(null);
    const pendingHoverRef = useRef<{ lat: number; lng: number; track: [number, number][] } | null>(null);
    const onHoverTrackIndexRef = useRef(onHoverTrackIndex);
    const flySeqRef = useRef<number>(0);
    const [wrapperWidth, setWrapperWidth] = useState<number>(0);

    useEffect(() => {
      onHoverTrackIndexRef.current = onHoverTrackIndex;
    }, [onHoverTrackIndex]);

    useEffect(() => {
      basemapRef.current = basemap;
    }, [basemap]);

    useEffect(() => {
      selectedTrailRef.current = selectedTrail;
    }, [selectedTrail]);

    useEffect(() => {
      const el = mapWrapperRef.current;
      if (!el) return;
      const syncWidth = () => {
        setWrapperWidth((prev) => (prev === el.clientWidth ? prev : el.clientWidth));
      };
      syncWidth();
      if (typeof ResizeObserver === 'undefined') return;
      const obs = new ResizeObserver(syncWidth);
      obs.observe(el);
      return () => obs.disconnect();
    }, []);

    const triggerFlyTo = useCallback((lat: number, lng: number, zoom?: number, duration?: number) => {
      flySeqRef.current += 1;
      setFlyToReq({ lat, lng, zoom, duration, key: flySeqRef.current });
    }, []);

    // Sync camera smoothly whenever selectedTrail changes externally
    if (trackedSelectedTrailId !== selectedTrail?.id) {
      setTrackedSelectedTrailId(selectedTrail?.id);
      setInspectedTrailId(null);
      setInspectedDetailCard(null);
      setHoveredTrailPreview(null);
      if (
        selectedTrail &&
        (!Array.isArray(selectedTrail.gpxTrack) || selectedTrail.gpxTrack.length < 2) &&
        Number.isFinite(selectedTrail.startLat) &&
        Number.isFinite(selectedTrail.startLng)
      ) {
        flySeqRef.current += 1;
        setFlyToReq({
          lat: selectedTrail.startLat,
          lng: selectedTrail.startLng,
          zoom: 11.5,
          key: flySeqRef.current,
        });
      } else if (!selectedTrail) {
        flySeqRef.current += 1;
        setFlyToReq({
          lat: VIETNAM_CENTER[0],
          lng: VIETNAM_CENTER[1],
          zoom: VIETNAM_OVERVIEW_ZOOM,
          key: flySeqRef.current,
        });
      }
    }

    const selectedTrailBounds = useMemo(() => {
      if (!selectedTrail?.gpxTrack || selectedTrail.gpxTrack.length < 2) return null;
      return computeTrackBounds(selectedTrail.gpxTrack);
    }, [selectedTrail]);

    const handleTrackMouseMove = useCallback((lat: number, lng: number, track: [number, number][]) => {
      pendingHoverRef.current = { lat, lng, track };
      if (hoverRafRef.current !== null) return;
      hoverRafRef.current = window.requestAnimationFrame(() => {
        hoverRafRef.current = null;
        const pending = pendingHoverRef.current;
        if (!pending) return;
        const nearestIdx = findNearestTrackIndex(pending.lat, pending.lng, pending.track);
        if (nearestIdx !== lastHoverTrackIdxRef.current) {
          lastHoverTrackIdxRef.current = nearestIdx;
          onHoverTrackIndexRef.current?.(nearestIdx);
        }
      });
    }, []);

    const handleTrackMouseOut = useCallback(() => {
      pendingHoverRef.current = null;
      if (hoverRafRef.current !== null) {
        window.cancelAnimationFrame(hoverRafRef.current);
        hoverRafRef.current = null;
      }
      if (lastHoverTrackIdxRef.current !== null) {
        lastHoverTrackIdxRef.current = null;
        onHoverTrackIndexRef.current?.(null);
      }
    }, []);

    const recordedTrackPositions = useMemo(
      () => recordedTrack.map((p) => [p.lat, p.lng] as [number, number]),
      [recordedTrack]
    );

    const canHover = useMemo(
      () =>
        typeof window !== 'undefined' && typeof window.matchMedia === 'function'
          ? window.matchMedia('(hover: hover)').matches
          : true,
      []
    );
    const effectiveScrollZoom = Boolean(selectedTrail) || isScrollZoomUnlocked;

    useEffect(() => {
      const handleOffline = () => {
        if (basemapRef.current !== 'topo') {
          setBasemap('topo');
          onShowToast?.('Mất kết nối mạng — chuyển sang bản đồ địa hình AWS DEM đã lưu.', 'info');
        } else {
          onShowToast?.('Đang ngoại tuyến — bản đồ đang dùng lớp địa hình AWS DEM đã lưu trên máy.', 'info');
        }
      };
      window.addEventListener('offline', handleOffline);
      return () => window.removeEventListener('offline', handleOffline);
    }, [onShowToast]);

    const initialCenter = useMemo<[number, number]>(
      () =>
        selectedTrail && Number.isFinite(selectedTrail.startLat) && Number.isFinite(selectedTrail.startLng)
          ? [selectedTrail.startLat, selectedTrail.startLng]
          : VIETNAM_CENTER,
      [selectedTrail]
    );
    const initialZoom = selectedTrail ? 11.4 : VIETNAM_OVERVIEW_ZOOM;

    const alertSourceTrails = allTrails && allTrails.length > 0 ? allTrails : trails;
    const alertTrails = useMemo(() => {
      return alertSourceTrails
        .map((trail) => ({ trail, incident: matchTrailIncident(trail, incidents) }))
        .filter((item): item is { trail: Trail; incident: MapIncident } => Boolean(item.incident));
    }, [alertSourceTrails, incidents]);

    const filteredTrails = useMemo(() => {
      const baseList =
        difficultyFilter === 'alert'
          ? alertTrails.map((a) => a.trail)
          : trails.filter((trail) => {
              if (difficultyFilter === 'easy') return trail.difficultyLevel <= 2;
              if (difficultyFilter === 'medium') return trail.difficultyLevel === 3;
              if (difficultyFilter === 'hard') return trail.difficultyLevel >= 4;
              return true;
            });

      return baseList.filter((trail) => {
        if (highAltitudeOnly && (Number(trail.maxAltitudeM) || 0) < 2500) return false;
        if (beginnerOnly && (Number(trail.difficultyLevel) || 5) > 2) return false;
        if (gpsRadiusKm && userLocation) {
          const distKm = haversineMeters(userLocation[0], userLocation[1], trail.startLat, trail.startLng) / 1000;
          if (!Number.isFinite(distKm) || distKm > gpsRadiusKm) return false;
        }
        return true;
      });
    }, [trails, difficultyFilter, alertTrails, highAltitudeOnly, beginnerOnly, gpsRadiusKm, userLocation]);

    const difficultyCounts = useMemo(() => {
      let easy = 0;
      let medium = 0;
      let hard = 0;
      let highAlt = 0;
      for (const t of trails) {
        if (t.difficultyLevel <= 2) easy++;
        else if (t.difficultyLevel === 3) medium++;
        else hard++;
        if ((Number(t.maxAltitudeM) || 0) >= 2500) highAlt++;
      }
      return { all: trails.length, easy, medium, hard, highAlt };
    }, [trails]);

    const activeEmphasisTrailId = selectedTrail?.id || focusedTrailId;

    const trailLookupById = useMemo(() => {
      const map = new Map<string, { trail: Trail; incident?: MapIncident }>();
      for (const trail of filteredTrails) {
        const tid = trail.id || (trail as TrailWithMeta)._id || '';
        if (tid) {
          map.set(tid, { trail, incident: matchTrailIncident(trail, incidents) });
        }
      }
      if (selectedTrail) {
        const sid = selectedTrail.id || (selectedTrail as TrailWithMeta)._id || '';
        if (sid && !map.has(sid)) {
          map.set(sid, { trail: selectedTrail, incident: matchTrailIncident(selectedTrail, incidents) });
        }
      }
      return map;
    }, [filteredTrails, incidents, selectedTrail]);

    const clusterPoints = useMemo<LostMapClusterPoint[]>(() => {
      return filteredTrails.map((trail) => {
        const tid = trail.id || (trail as TrailWithMeta)._id || '';
        const matchingIncident = matchTrailIncident(trail, incidents);
        return {
          id: tid,
          lat: trail.startLat,
          lng: trail.startLng,
          title: trail.name,
          subtitle: trail.province,
          difficulty: trail.difficultyLevel,
          altitudeM: trail.maxAltitudeM,
          distanceKm: trail.distanceKm,
          hasIncident: Boolean(matchingIncident),
          selected: activeEmphasisTrailId === tid,
        };
      });
    }, [filteredTrails, incidents, activeEmphasisTrailId]);

    const activeGpxTrails = useMemo(() => {
      const withTrack = filteredTrails.filter((t) => Array.isArray(t.gpxTrack) && t.gpxTrack.length >= 2);
      if (selectedTrail && Array.isArray(selectedTrail.gpxTrack) && selectedTrail.gpxTrack.length >= 2) {
        if (!withTrack.some((t) => t.id === selectedTrail.id)) {
          return [selectedTrail, ...withTrack];
        }
      }
      return withTrack;
    }, [selectedTrail, filteredTrails]);

    const activeDetailTrail = useMemo(() => {
      if (selectedTrail) return selectedTrail;
      if (focusedTrailId) {
        return filteredTrails.find((t) => (t.id || (t as TrailWithMeta)._id) === focusedTrailId) || null;
      }
      return null;
    }, [selectedTrail, focusedTrailId, filteredTrails]);

    const polylines = useMemo<LostMapPolylineItem[]>(() => {
      const lines: LostMapPolylineItem[] = [];

      if (showGpxTracks) {
        for (const trail of activeGpxTrails) {
          const track = trail.gpxTrack;
          if (!track || track.length < 2) continue;

          const isEmphasized = activeEmphasisTrailId === trail.id || activeGpxTrails.length === 1;
          const diffInfo = getDifficultyInfo(trail.difficultyLevel);

          lines.push({
            id: `gpx-${trail.id}`,
            coords: track,
            color: isEmphasized ? 'primary' : diffInfo.semantic,
            width: isEmphasized ? 4.2 : 2.6,
            opacity: isEmphasized ? 0.98 : 0.8,
            interactive: true,
            onClick: () => {
              setFocusedTrailId(trail.id);
              setInspectedTrailId(trail.id);
              setInspectedDetailCard(null);
              onFocusTrail?.(trail);
            },
            onHover:
              isEmphasized && onHoverTrackIndex
                ? (lat, lng) => handleTrackMouseMove(lat, lng, track)
                : undefined,
            onHoverOut: isEmphasized && onHoverTrackIndex ? handleTrackMouseOut : undefined,
          });
        }
      }

      if (recordedTrackPositions.length >= 2) {
        lines.push({
          id: 'live-gps-recorded',
          coords: recordedTrackPositions,
          color: 'info',
          width: 4,
          dashed: true,
          opacity: 0.95,
        });
      }

      return lines;
    }, [
      showGpxTracks,
      activeGpxTrails,
      activeEmphasisTrailId,
      onFocusTrail,
      onHoverTrackIndex,
      handleTrackMouseMove,
      handleTrackMouseOut,
      recordedTrackPositions,
    ]);

    const circles = useMemo<LostMapCircleItem[]>(() => {
      const items: LostMapCircleItem[] = [];

      // Subtle alert warning rings around trails with active field incidents
      for (const trail of filteredTrails) {
        const inc = matchTrailIncident(trail, incidents);
        if (!inc) continue;
        items.push({
          id: `incident-ring-${trail.id}`,
          lat: trail.startLat,
          lng: trail.startLng,
          radiusMeters: inc.severity === 'critical' ? 3500 : 2200,
          color: 'danger',
          dashed: true,
          fillOpacity: 0.1,
        });
      }

      // Active GPS proximity filter ring (50 / 150 / 300km)
      if (userLocation && gpsRadiusKm && !selectedTrail) {
        items.push({
          id: 'gps-filter-radius',
          lat: userLocation[0],
          lng: userLocation[1],
          radiusMeters: gpsRadiusKm * 1000,
          color: 'info',
          dashed: true,
          fillOpacity: 0.06,
        });
      }

      // User GPS accuracy circle
      if (userLocation && !isFallbackLocation && gpsAccuracy && gpsAccuracy > 0) {
        items.push({
          id: 'user-gps-accuracy',
          lat: userLocation[0],
          lng: userLocation[1],
          radiusMeters: gpsAccuracy,
          color: 'info',
          dashed: true,
          fillOpacity: 0.12,
        });
      }

      return items;
    }, [filteredTrails, incidents, userLocation, gpsRadiusKm, selectedTrail, isFallbackLocation, gpsAccuracy]);

    const waypointCount = useMemo(() => {
      const wps = Array.isArray(activeDetailTrail?.waypoints)
        ? activeDetailTrail.waypoints.filter((wp) => Number.isFinite(Number(wp.lat)) && Number.isFinite(Number(wp.lng)))
            .length
        : 0;
      const pois = Array.isArray(trailPois)
        ? trailPois.filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))).length
        : 0;
      return wps + pois;
    }, [activeDetailTrail, trailPois]);

    const markers = useMemo<LostMapMarkerItem[]>(() => {
      const list: LostMapMarkerItem[] = [];

      // Start & Summit markers for emphasized GPX trail
      if (showGpxTracks && activeDetailTrail && Array.isArray(activeDetailTrail.gpxTrack) && activeDetailTrail.gpxTrack.length >= 2) {
        const startPos = activeDetailTrail.gpxTrack[0];
        const endPos = activeDetailTrail.gpxTrack[activeDetailTrail.gpxTrack.length - 1];
        if (startPos) {
          list.push({
            id: `gpx-start-${activeDetailTrail.id}`,
            lat: startPos[0],
            lng: startPos[1],
            label: 'Xuất phát',
            sublabel: activeDetailTrail.name,
            color: 'primary',
            size: 'md',
            badge: 'S',
            onClick: () => onFocusTrail?.(activeDetailTrail),
          });
        }
        if (endPos) {
          list.push({
            id: `gpx-end-${activeDetailTrail.id}`,
            lat: endPos[0],
            lng: endPos[1],
            label: `Đỉnh ${(Number(activeDetailTrail.maxAltitudeM) || 0).toLocaleString('vi-VN')}m`,
            sublabel: activeDetailTrail.name,
            color: 'warn',
            size: 'md',
            badge: 'Đ',
            onClick: () => onFocusTrail?.(activeDetailTrail),
          });
        }
      }

      // Waypoints for focused/selected trail
      if (showWaypoints && Array.isArray(activeDetailTrail?.waypoints)) {
        activeDetailTrail.waypoints.forEach((wp, idx) => {
          const wpLat = Number(wp.lat);
          const wpLng = Number(wp.lng);
          if (!Number.isFinite(wpLat) || !Number.isFinite(wpLng)) return;
          const meta = WAYPOINT_META[wp.type] || WAYPOINT_META.rest;
          list.push({
            id: wp.id || `wp-${activeDetailTrail.id}-${idx}`,
            lat: wpLat,
            lng: wpLng,
            label: wp.name,
            sublabel:
              typeof wp.elevationM === 'number' && Number.isFinite(wp.elevationM)
                ? `${meta.label} · ${Math.round(wp.elevationM).toLocaleString('vi-VN')}m`
                : meta.label,
            color: meta.color,
            size: 'md',
            badge: meta.badge,
            onClick: () => {
              setInspectedTrailId(null);
              setInspectedDetailCard({ kind: 'waypoint', wp, metaLabel: meta.label, token: meta.token });
            },
          });
        });
      }

      // Community Field POIs
      if (showWaypoints && Array.isArray(trailPois)) {
        for (const poi of trailPois) {
          const pLat = Number(poi.lat);
          const pLng = Number(poi.lng);
          if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) continue;
          const meta = FIELD_POI_META[poi.category] || FIELD_POI_META.water;
          const isClosed = poi.status === 'dry_or_closed';
          list.push({
            id: `poi-${poi.id}`,
            lat: pLat,
            lng: pLng,
            label: poi.title,
            sublabel: isClosed ? `${meta.label} · Đã cạn / đóng` : meta.label,
            color: isClosed ? 'muted' : meta.color,
            size: 'sm',
            badge: meta.badge,
            onClick: () => {
              setInspectedTrailId(null);
              setInspectedDetailCard({ kind: 'poi', poi, metaLabel: meta.label, token: meta.token });
            },
          });
        }
      }

      // User GPS pulsing marker
      if (userLocation) {
        list.push({
          id: 'user-gps-location',
          lat: userLocation[0],
          lng: userLocation[1],
          label: isFallbackLocation ? 'Điểm tham khảo (Sa Pa)' : 'Vị trí của bạn',
          sublabel:
            !isFallbackLocation && gpsAccuracy ? `Sai số ±${Math.round(gpsAccuracy)}m` : undefined,
          color: 'info',
          size: 'md',
          pulse: true,
          onClick: () => {
            setInspectedTrailId(null);
            setInspectedDetailCard({ kind: 'user-gps' });
          },
        });
      }

      // 2-way synced Elevation Profile hover dot
      if (highlightedPoint && Number.isFinite(highlightedPoint[0]) && Number.isFinite(highlightedPoint[1])) {
        list.push({
          id: 'elevation-hover-dot',
          lat: highlightedPoint[0],
          lng: highlightedPoint[1],
          color: 'warn',
          size: 'sm',
          active: true,
        });
      }

      return list;
    }, [
      showGpxTracks,
      activeDetailTrail,
      onFocusTrail,
      showWaypoints,
      trailPois,
      userLocation,
      isFallbackLocation,
      gpsAccuracy,
      highlightedPoint,
    ]);

    const handleClusterPointClick = useCallback(
      (trailId: string) => {
        const entry = trailLookupById.get(trailId);
        if (!entry) return;
        setFocusedTrailId(trailId);
        setInspectedTrailId(trailId);
        setInspectedDetailCard(null);
        setHoveredTrailPreview(null);
        onFocusTrail?.(entry.trail);
      },
      [trailLookupById, onFocusTrail]
    );

    const handleClusterPointHover = useCallback(
      (trailId: string | null, screenPoint?: { x: number; y: number }) => {
        if (!canHover) return;
        if (!trailId || !screenPoint) {
          setHoveredTrailPreview(null);
          return;
        }
        setHoveredTrailPreview({ trailId, x: screenPoint.x, y: screenPoint.y });
      },
      [canHover]
    );

    const handleMapCanvasClick = useCallback(() => {
      setFocusedTrailId(null);
      setInspectedTrailId(null);
      setInspectedDetailCard(null);
      setHoveredTrailPreview(null);
      if (!isScrollZoomUnlocked) {
        setIsScrollZoomUnlocked(true);
      }
    }, [isScrollZoomUnlocked]);

    const handleToggleAlertFilter = () => {
      if (difficultyFilter === 'alert') {
        setDifficultyFilter('all');
      } else {
        setDifficultyFilter('alert');
        if (alertTrails.length > 0) {
          const first = alertTrails[0].trail;
          if (onSelectRegion && first.region) {
            onSelectRegion('All');
          }
          triggerFlyTo(first.startLat, first.startLng, 10.2);
          onShowToast?.(`Đang hiện ${alertTrails.length} cung có lưu ý an toàn trên đường mòn.`, 'info');
        } else {
          onShowToast?.('Các cung đường hiện tại đều êm, chưa có cảnh báo nào.', 'info');
        }
      }
    };

    const handleFlyToAlertTrail = (trail: Trail) => {
      if (onSelectRegion && trail.region) {
        onSelectRegion('All');
      }
      setFocusedTrailId(trail.id);
      setInspectedTrailId(trail.id);
      setInspectedDetailCard(null);
      onFocusTrail?.(trail);
      triggerFlyTo(trail.startLat, trail.startLng, 12.2);
      setIsAlertsDrawerOpen(false);
      onShowToast?.(`Đang đưa bản đồ về cung ${trail.name}.`, 'info');
    };

    const handleResetView = () => {
      setFocusedTrailId(null);
      setInspectedTrailId(null);
      setInspectedDetailCard(null);
      triggerFlyTo(VIETNAM_CENTER[0], VIETNAM_CENTER[1], VIETNAM_OVERVIEW_ZOOM);
      onShowToast?.('Đã thu về góc nhìn toàn dải núi Việt Nam.', 'info');
    };

    const handleLocateMe = async () => {
      locateAbortRef.current?.abort();
      const controller = new AbortController();
      locateAbortRef.current = controller;
      setIsLocating(true);

      const performSpatialSearch = async (lat: number, lng: number, isFallback: boolean) => {
        if (controller.signal.aborted) return;
        const coords: [number, number] = [lat, lng];
        setUserLocation(coords);
        setIsFallbackLocation(isFallback);
        triggerFlyTo(lat, lng, 11.2);
        setIsLocating(false);

        try {
          const [nearby, geoData] = await Promise.all([fetchNearbyTrails(lat, lng, 4), reverseGeocode(lat, lng)]);
          if (controller.signal.aborted) return;
          setGpsToast({
            lat,
            lng,
            nearby: nearby || [],
            geocodedAddress: geoData?.formattedAddress || geoData?.displayName,
            isFallback,
          });
          if (!isFallback) {
            onShowToast?.('Đã bắt được vị trí của bạn trên bản đồ.', 'success');
          }
        } catch {
          if (!controller.signal.aborted) {
            setGpsToast({ lat, lng, nearby: [], isFallback });
          }
        }
      };

      if (!navigator.geolocation) {
        onShowToast?.('Trình duyệt chưa hỗ trợ định vị GPS — tạm lấy khu vực Sa Pa để bạn tham khảo.', 'error');
        void performSpatialSearch(22.3364, 103.8438, true);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          void performSpatialSearch(position.coords.latitude, position.coords.longitude, false);
        },
        (err) => {
          const msg =
            err?.code === 1
              ? 'Bạn chưa bật quyền định vị — tạm lấy khu vực Sa Pa để bạn tham khảo.'
              : 'Chưa bắt được sóng GPS lúc này — tạm lấy khu vực Sa Pa để bạn tham khảo.';
          onShowToast?.(msg, 'error');
          void performSpatialSearch(22.3364, 103.8438, true);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };

    const handleToggleLiveTracking = () => {
      if (isLiveTracking) {
        if (watchIdRef.current !== null && navigator.geolocation) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        setIsLiveTracking(false);
        setOffTrailMeters(null);
        onShowToast?.('Đã dừng ghi hành trình GPS.', 'info');
      } else {
        if (!navigator.geolocation) {
          onShowToast?.('Thiết bị này chưa hỗ trợ cảm biến GPS.', 'error');
          return;
        }
        setIsLiveTracking(true);
        setRecordedTrack([]);
        setOffTrailMeters(null);
        setIsFallbackLocation(false);
        hasCenteredLiveGpsRef.current = false;
        lastGpsTimeoutWarnRef.current = 0;
        const hasActiveTrackForAlarm = Boolean(
          selectedTrailRef.current?.gpxTrack && selectedTrailRef.current.gpxTrack.length >= 2
        );
        onShowToast?.(
          hasActiveTrackForAlarm
            ? 'Đang ghi hành trình GPS — sẽ báo chuông nếu bạn đi lệch quá 100m.'
            : 'Đang ghi hành trình GPS trực tiếp trên bản đồ.',
          'info'
        );

        try {
          watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
              const { latitude, longitude, accuracy, altitude, speed } = position.coords;
              const coords: [number, number] = [latitude, longitude];
              setUserLocation(coords);
              setGpsAccuracy(accuracy);
              if (altitude !== null && altitude !== undefined) setGpsAltitude(Math.round(altitude));
              if (speed !== null && speed !== undefined) setGpsSpeed(Math.max(0, Math.round(speed * 3.6)));

              // Center camera only on the first GPS lock so users can freely pan/inspect while recording
              if (!hasCenteredLiveGpsRef.current) {
                hasCenteredLiveGpsRef.current = true;
                triggerFlyTo(latitude, longitude, Math.max(13, mapInstanceRef.current?.getZoom() || 13), 650);
              }

              setRecordedTrack((prev) => {
                const lastPt = prev[prev.length - 1];
                if (lastPt && haversineMeters(lastPt.lat, lastPt.lng, latitude, longitude) < 4) {
                  return prev;
                }
                const nextPt: RecordedTrackPoint = {
                  lat: latitude,
                  lng: longitude,
                  altitudeM: altitude !== null && altitude !== undefined ? Math.round(altitude) : null,
                  accuracyM: accuracy ?? null,
                  timestamp: Date.now(),
                };
                return prev.length >= 12000 ? [...prev.slice(-11999), nextPt] : [...prev, nextPt];
              });

              const liveTrailTrack = selectedTrailRef.current?.gpxTrack;
              if (liveTrailTrack && liveTrailTrack.length >= 2) {
                const distM = distanceToTrackMeters(latitude, longitude, liveTrailTrack);
                if (distM > 100) {
                  setOffTrailMeters(distM);
                  const now = Date.now();
                  if (now - lastOffTrailBeepRef.current > 15_000) {
                    lastOffTrailBeepRef.current = now;
                    playOffTrailWarningBeep();
                    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                      navigator.vibrate([250, 120, 250]);
                    }
                  }
                } else {
                  setOffTrailMeters(null);
                }
              } else {
                setOffTrailMeters(null);
              }
            },
            (err) => {
              // Only abort tracking permanently on explicit PERMISSION_DENIED; keep watching through canopy TIMEOUT
              if (err?.code === 1) {
                if (watchIdRef.current !== null && navigator.geolocation) {
                  navigator.geolocation.clearWatch(watchIdRef.current);
                  watchIdRef.current = null;
                }
                onShowToast?.('Quyền truy cập GPS bị từ chối — đã dừng ghi hành trình.', 'error');
                setIsLiveTracking(false);
                return;
              }
              const now = Date.now();
              if (now - lastGpsTimeoutWarnRef.current > 30_000) {
                lastGpsTimeoutWarnRef.current = now;
                onShowToast?.('Tín hiệu GPS dưới tán rừng đang yếu — hệ thống tiếp tục tự bắt lại.', 'info');
              }
            },
            { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
          );
        } catch {
          setIsLiveTracking(false);
        }
      }
    };

    useEffect(() => {
      return () => {
        if (hoverRafRef.current !== null) {
          window.cancelAnimationFrame(hoverRafRef.current);
          hoverRafRef.current = null;
        }
        locateAbortRef.current?.abort();
        if (watchIdRef.current !== null && navigator.geolocation) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      };
    }, []);

    const inspectedTrailEntry = inspectedTrailId ? trailLookupById.get(inspectedTrailId) : undefined;
    const hoveredTrailEntry = hoveredTrailPreview ? trailLookupById.get(hoveredTrailPreview.trailId) : undefined;

    // Clamp hover tooltip inside map wrapper bounds using cached ResizeObserver width (0 layout reflow on hover)
    const clampedHoverPos = useMemo(() => {
      if (!hoveredTrailPreview) return null;
      const maxX = wrapperWidth > 0 ? Math.max(160, wrapperWidth - 156) : hoveredTrailPreview.x;
      const clampedX = Math.max(156, Math.min(maxX, hoveredTrailPreview.x));
      const preferBelow = hoveredTrailPreview.y < 235;
      return {
        left: clampedX,
        top: preferBelow ? hoveredTrailPreview.y + 18 : Math.max(12, hoveredTrailPreview.y - 16),
        transform: preferBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
      };
    }, [hoveredTrailPreview, wrapperWidth]);

    return (
      <div
        ref={mapWrapperRef}
        style={{ position: 'relative', width: '100%', height, borderRadius: 4, overflow: 'hidden' }}
      >
        {/* Top-Left Zoom & Overview Controls */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 'var(--z-map-hud, 400)' as unknown as number,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--color-bg-hud)',
              borderRadius: 4,
              border: '1px solid var(--color-border-strong)',
              boxShadow: 'var(--shadow-card)',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => mapInstanceRef.current?.zoomIn({ duration: 220 })}
              aria-label="Phóng to bản đồ"
              title="Phóng to (+)"
              style={{
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-main)',
                cursor: 'pointer',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => mapInstanceRef.current?.zoomOut({ duration: 220 })}
              aria-label="Thu nhỏ bản đồ"
              title="Thu nhỏ (-)"
              style={{
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-main)',
                cursor: 'pointer',
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetView}
            aria-label="Toàn cảnh Việt Nam"
            title="Thu về góc nhìn toàn dải núi Việt Nam"
            style={{
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--color-bg-hud)',
              borderRadius: 4,
              border: '1px solid var(--color-border-strong)',
              boxShadow: 'var(--shadow-card)',
              color: 'var(--color-text-main)',
              cursor: 'pointer',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon
                points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"
                fill="currentColor"
                fillOpacity="0.35"
              />
            </svg>
          </button>
        </div>

        {/* Floating Action & Basemap Dock (Top Right) */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 'var(--z-map-hud, 400)' as unknown as number,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--color-bg-hud)',
            padding: '4px 5px',
            borderRadius: 6,
            border: '1px solid var(--color-border-strong)',
            boxShadow: 'var(--shadow-card)',
            maxWidth: 'calc(100% - 62px)',
            flexWrap: 'wrap',
            overflow: 'visible',
          }}
        >
          <button
            type="button"
            onClick={() => setShowGpxTracks((prev) => !prev)}
            aria-pressed={showGpxTracks}
            aria-label="Bật tắt đường mòn GPX"
            title="Hiện hoặc ẩn vệt đường mòn GPX trên bản đồ"
            style={{
              height: 28,
              background: showGpxTracks ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)' : 'transparent',
              color: showGpxTracks ? 'var(--color-primary)' : 'var(--color-text-muted)',
              border: showGpxTracks ? '1px solid var(--color-border-glow)' : '1px solid transparent',
              borderRadius: 4,
              padding: '0 8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <ActivityIcon size={13} color={showGpxTracks ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
            <span>Đường GPX</span>
          </button>

          {waypointCount > 0 && (
            <button
              type="button"
              onClick={() => setShowWaypoints((prev) => !prev)}
              aria-pressed={showWaypoints}
              aria-label="Bật tắt điểm mốc và điểm dừng chân"
              title="Hiện hoặc ẩn lán nghỉ, nguồn nước, điểm dừng chân trên tuyến"
              style={{
                height: 28,
                background: showWaypoints ? 'color-mix(in srgb, var(--color-sky) 16%, transparent)' : 'transparent',
                color: showWaypoints ? 'var(--color-sky)' : 'var(--color-text-muted)',
                border: showWaypoints
                  ? '1px solid color-mix(in srgb, var(--color-sky) 42%, transparent)'
                  : '1px solid transparent',
                borderRadius: 4,
                padding: '0 8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>Mốc ({waypointCount})</span>
            </button>
          )}

          {!selectedTrail && (
            <button
              type="button"
              onClick={() => setIsScrollZoomUnlocked((prev) => !prev)}
              aria-pressed={effectiveScrollZoom}
              aria-label={effectiveScrollZoom ? 'Khóa cuộn chuột phóng to' : 'Mở cuộn chuột phóng to'}
              title={
                effectiveScrollZoom
                  ? 'Đang bật cuộn chuột phóng to (nhấn để khóa khi cuộn trang)'
                  : 'Đang khóa cuộn chuột để tránh trôi trang (chạm bản đồ để mở)'
              }
              style={{
                height: 28,
                background: effectiveScrollZoom
                  ? 'color-mix(in srgb, var(--color-sun) 16%, transparent)'
                  : 'transparent',
                color: effectiveScrollZoom ? 'var(--color-sun)' : 'var(--color-text-muted)',
                border: effectiveScrollZoom
                  ? '1px solid color-mix(in srgb, var(--color-sun) 42%, transparent)'
                  : '1px solid transparent',
                borderRadius: 4,
                padding: '0 8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <span>{effectiveScrollZoom ? 'Cuộn phóng: bật' : 'Cuộn phóng'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleLiveTracking}
            aria-pressed={isLiveTracking}
            aria-label="Ghi hành trình GPS"
            title="Ghi đường đi GPS trực tiếp và báo chuông nếu đi lệch đường mòn"
            style={{
              height: 28,
              background: isLiveTracking ? 'color-mix(in srgb, var(--color-sky) 16%, transparent)' : 'transparent',
              color: isLiveTracking ? 'var(--color-sky)' : 'var(--color-text-muted)',
              border: isLiveTracking
                ? '1px solid color-mix(in srgb, var(--color-sky) 45%, transparent)'
                : '1px solid transparent',
              borderRadius: 4,
              padding: '0 8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: isLiveTracking ? 'var(--color-sky)' : 'var(--color-text-dim)',
                display: 'inline-block',
              }}
            />
            <span>{isLiveTracking ? 'Đang ghi GPS' : 'Ghi GPS'}</span>
          </button>

          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocating}
            aria-label="Tìm vị trí của tôi"
            title="Bắt tọa độ GPS hiện tại và tìm cung trekking gần bạn"
            style={{
              height: 28,
              background: isLocating
                ? 'color-mix(in srgb, var(--color-sky) 16%, transparent)'
                : 'var(--color-surface-elevated)',
              color: 'var(--color-text-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              padding: '0 8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: isLocating ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
              <circle cx="12" cy="12" r="7" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
            <span>{isLocating ? 'Đang định vị...' : 'Định vị'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAlertsDrawerOpen((prev) => !prev)}
            aria-expanded={isAlertsDrawerOpen}
            aria-label="Xem danh sách cảnh báo an toàn"
            title="Xem các cung đường đang có lưu ý an toàn"
            style={{
              height: 28,
              background: isAlertsDrawerOpen
                ? 'color-mix(in srgb, var(--color-error) 20%, transparent)'
                : alertTrails.length > 0
                ? 'color-mix(in srgb, var(--color-error) 12%, transparent)'
                : 'var(--color-surface-elevated)',
              color:
                alertTrails.length > 0 ? 'var(--color-error-text, var(--color-error))' : 'var(--color-text-muted)',
              border: isAlertsDrawerOpen
                ? '1px solid var(--color-error)'
                : alertTrails.length > 0
                ? '1px solid color-mix(in srgb, var(--color-error) 45%, transparent)'
                : '1px solid var(--color-border)',
              borderRadius: 4,
              padding: '0 8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <AlertTriangleIcon size={12} color={alertTrails.length > 0 ? 'var(--color-error)' : 'currentColor'} />
            <span>Cảnh báo</span>
            {alertTrails.length > 0 && (
              <span
                style={{
                  fontSize: '0.64rem',
                  fontWeight: 800,
                  background: 'var(--color-error)',
                  color: 'var(--color-on-danger)',
                  padding: '1px 5px',
                  borderRadius: 3,
                }}
              >
                {alertTrails.length}
              </span>
            )}
          </button>

          {selectedTrail && (
            <button
              type="button"
              onClick={() => setIsTerrain3DOpen(true)}
              title="Xem mô hình địa hình 3D thật của cung đường"
              style={{
                height: 28,
                background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-border-glow)',
                borderRadius: 4,
                padding: '0 8px',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
              </svg>
              <span>Địa hình 3D</span>
            </button>
          )}

          {/* 1-Click GPU Basemap Switcher: Địa hình / Bản đồ / Vệ tinh */}
          <div
            role="group"
            aria-label="Chọn lớp nền bản đồ"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              padding: 2,
              borderRadius: 4,
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              flexShrink: 0,
            }}
          >
            {FREE_BASEMAP_ORDER.map((key) => {
              const active = basemap === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setBasemap(key)}
                  title={FREE_BASEMAPS[key].label}
                  style={{
                    height: 24,
                    padding: '0 8px',
                    borderRadius: 3,
                    border: 'none',
                    background: active ? 'var(--color-primary)' : 'transparent',
                    color: active ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                    fontSize: '0.71rem',
                    fontWeight: active ? 800 : 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {FREE_BASEMAPS[key].shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Safety Incidents Floating Drawer */}
        <TacticalIncidentsDrawer
          isOpen={isAlertsDrawerOpen}
          onClose={() => setIsAlertsDrawerOpen(false)}
          alertTrails={alertTrails}
          onFlyTo={handleFlyToAlertTrail}
          onSelectTrail={onSelectTrail}
          onFilterAlerts={handleToggleAlertFilter}
          isFilterActive={difficultyFilter === 'alert'}
        />

        {/* Difficulty & Quick-Filter Toolbar (lifted cleanly above bottom-right MapLibre legal attribution) */}
        <div
          style={{
            position: 'absolute',
            bottom: 34,
            left: 12,
            zIndex: 'var(--z-map-hud, 400)' as unknown as number,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            background: 'var(--color-bg-hud)',
            padding: '4px 6px',
            borderRadius: 6,
            border: '1px solid var(--color-border-strong)',
            boxShadow: 'var(--shadow-card)',
            maxWidth: 'calc(100% - 24px)',
            flexWrap: 'wrap',
            overflow: 'visible',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '2px 7px',
              borderRight: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
              fontSize: '0.7rem',
              fontWeight: 800,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <FilterIcon size={11} color="var(--color-primary)" />
            <span>Độ khó</span>
          </div>

          <button
            type="button"
            onClick={() => setDifficultyFilter('all')}
            style={{
              background:
                difficultyFilter === 'all' ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)' : 'transparent',
              color: difficultyFilter === 'all' ? 'var(--color-primary)' : 'var(--color-text-main)',
              border: difficultyFilter === 'all' ? '1px solid var(--color-border-glow)' : '1px solid transparent',
              borderRadius: 4,
              padding: '3px 7px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <span>Tất cả</span>
            <span
              style={{
                fontSize: '0.66rem',
                background:
                  difficultyFilter === 'all'
                    ? 'color-mix(in srgb, var(--color-primary) 22%, transparent)'
                    : 'var(--color-surface-elevated)',
                padding: '1px 5px',
                borderRadius: 3,
              }}
            >
              {difficultyCounts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDifficultyFilter('easy')}
            style={{
              background:
                difficultyFilter === 'easy'
                  ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)'
                  : 'transparent',
              color: difficultyFilter === 'easy' ? 'var(--color-primary)' : 'var(--color-text-main)',
              border: difficultyFilter === 'easy' ? '1px solid var(--color-border-glow)' : '1px solid transparent',
              borderRadius: 4,
              padding: '3px 7px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
            <span>Dễ (1–2)</span>
            <span
              style={{
                fontSize: '0.66rem',
                background:
                  difficultyFilter === 'easy'
                    ? 'color-mix(in srgb, var(--color-primary) 22%, transparent)'
                    : 'var(--color-surface-elevated)',
                padding: '1px 5px',
                borderRadius: 3,
              }}
            >
              {difficultyCounts.easy}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDifficultyFilter('medium')}
            style={{
              background:
                difficultyFilter === 'medium' ? 'color-mix(in srgb, var(--color-sun) 16%, transparent)' : 'transparent',
              color: difficultyFilter === 'medium' ? 'var(--color-sun)' : 'var(--color-text-main)',
              border:
                difficultyFilter === 'medium'
                  ? '1px solid color-mix(in srgb, var(--color-sun) 45%, transparent)'
                  : '1px solid transparent',
              borderRadius: 4,
              padding: '3px 7px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-sun)', flexShrink: 0 }} />
            <span>Vừa (3)</span>
            <span
              style={{
                fontSize: '0.66rem',
                background:
                  difficultyFilter === 'medium'
                    ? 'color-mix(in srgb, var(--color-sun) 22%, transparent)'
                    : 'var(--color-surface-elevated)',
                padding: '1px 5px',
                borderRadius: 3,
              }}
            >
              {difficultyCounts.medium}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDifficultyFilter('hard')}
            style={{
              background:
                difficultyFilter === 'hard' ? 'color-mix(in srgb, var(--color-error) 16%, transparent)' : 'transparent',
              color:
                difficultyFilter === 'hard'
                  ? 'var(--color-error-text, var(--color-error))'
                  : 'var(--color-text-main)',
              border:
                difficultyFilter === 'hard'
                  ? '1px solid color-mix(in srgb, var(--color-error) 45%, transparent)'
                  : '1px solid transparent',
              borderRadius: 4,
              padding: '3px 7px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-error)', flexShrink: 0 }} />
            <span>Khó (4–5)</span>
            <span
              style={{
                fontSize: '0.66rem',
                background:
                  difficultyFilter === 'hard'
                    ? 'color-mix(in srgb, var(--color-error) 22%, transparent)'
                    : 'var(--color-surface-elevated)',
                padding: '1px 5px',
                borderRadius: 3,
              }}
            >
              {difficultyCounts.hard}
            </span>
          </button>

          <button
            type="button"
            onClick={handleToggleAlertFilter}
            aria-label="Lọc các cung đang có cảnh báo"
            title="Chỉ hiện những cung đang có lưu ý an toàn"
            style={{
              background:
                difficultyFilter === 'alert'
                  ? 'color-mix(in srgb, var(--color-error) 22%, transparent)'
                  : alertTrails.length > 0
                  ? 'color-mix(in srgb, var(--color-error) 12%, transparent)'
                  : 'transparent',
              color:
                difficultyFilter === 'alert' || alertTrails.length > 0
                  ? 'var(--color-error-text, var(--color-error))'
                  : 'var(--color-text-muted)',
              border:
                difficultyFilter === 'alert'
                  ? '1px solid var(--color-error)'
                  : alertTrails.length > 0
                  ? '1px solid color-mix(in srgb, var(--color-error) 40%, transparent)'
                  : '1px solid transparent',
              borderRadius: 4,
              padding: '3px 7px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-error)', flexShrink: 0 }} />
            <span>Cảnh báo</span>
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                background:
                  difficultyFilter === 'alert'
                    ? 'var(--color-error)'
                    : 'color-mix(in srgb, var(--color-error) 20%, transparent)',
                color:
                  difficultyFilter === 'alert'
                    ? 'var(--color-on-danger)'
                    : 'var(--color-error-text, var(--color-error))',
                padding: '1px 5px',
                borderRadius: 3,
              }}
            >
              {alertTrails.length}
            </span>
          </button>

          {!selectedTrail && (
            <>
              <span
                aria-hidden="true"
                style={{
                  width: 1,
                  height: 16,
                  background: 'var(--color-border-strong)',
                  margin: '0 3px',
                  flexShrink: 0,
                }}
              />

              <button
                type="button"
                aria-pressed={highAltitudeOnly}
                onClick={() => setHighAltitudeOnly((prev) => !prev)}
                title="Lọc nhanh các đỉnh cao từ 2.500m trở lên"
                style={{
                  background: highAltitudeOnly
                    ? 'color-mix(in srgb, var(--color-sun) 18%, transparent)'
                    : 'transparent',
                  color: highAltitudeOnly ? 'var(--color-sun)' : 'var(--color-text-main)',
                  border: highAltitudeOnly
                    ? '1px solid color-mix(in srgb, var(--color-sun) 48%, transparent)'
                    : '1px solid transparent',
                  borderRadius: 4,
                  padding: '3px 7px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <span>Đỉnh &gt;2.500m</span>
                <span
                  style={{
                    fontSize: '0.66rem',
                    background: highAltitudeOnly
                      ? 'color-mix(in srgb, var(--color-sun) 24%, transparent)'
                      : 'var(--color-surface-elevated)',
                    padding: '1px 5px',
                    borderRadius: 3,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {difficultyCounts.highAlt}
                </span>
              </button>

              <button
                type="button"
                aria-pressed={beginnerOnly}
                onClick={() => setBeginnerOnly((prev) => !prev)}
                title="Lọc các cung nhẹ nhàng phù hợp người mới đi rừng (cấp 1–2)"
                style={{
                  background: beginnerOnly
                    ? 'color-mix(in srgb, var(--color-primary) 18%, transparent)'
                    : 'transparent',
                  color: beginnerOnly ? 'var(--color-primary)' : 'var(--color-text-main)',
                  border: beginnerOnly ? '1px solid var(--color-border-glow)' : '1px solid transparent',
                  borderRadius: 4,
                  padding: '3px 7px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <span>Cho người mới</span>
                <span
                  style={{
                    fontSize: '0.66rem',
                    background: beginnerOnly
                      ? 'color-mix(in srgb, var(--color-primary) 24%, transparent)'
                      : 'var(--color-surface-elevated)',
                    padding: '1px 5px',
                    borderRadius: 3,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {difficultyCounts.easy}
                </span>
              </button>

              {userLocation && (
                <div
                  role="group"
                  aria-label="Lọc theo bán kính quanh bạn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                    padding: '2px 4px',
                    borderRadius: 4,
                    background: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border)',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 800,
                      color: 'var(--color-sky)',
                      padding: '0 4px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Gần bạn:
                  </span>
                  {([50, 150, 300] as const).map((radiusVal) => {
                    const isActiveRadius = gpsRadiusKm === radiusVal;
                    return (
                      <button
                        key={`rad-${radiusVal}`}
                        type="button"
                        aria-pressed={isActiveRadius}
                        onClick={() => setGpsRadiusKm((prev) => (prev === radiusVal ? null : radiusVal))}
                        style={{
                          background: isActiveRadius ? 'var(--color-sky)' : 'transparent',
                          color: isActiveRadius ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                          border: 'none',
                          borderRadius: 3,
                          padding: '2px 6px',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {radiusVal}km
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Pure GPU MapLibre GL JS Canvas */}
        <div
          style={{
            height: '100%',
            width: '100%',
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid var(--color-border)',
          }}
        >
          <LostVectorMap
            center={initialCenter}
            zoom={initialZoom}
            minZoom={4.2}
            maxZoom={18}
            maxBounds={VIETNAM_MAX_BOUNDS}
            basemap={basemap}
            scrollZoom={effectiveScrollZoom}
            clusterPoints={clusterPoints}
            onClusterPointClick={handleClusterPointClick}
            onClusterPointHover={handleClusterPointHover}
            markers={markers}
            polylines={polylines}
            circles={circles}
            fitBounds={selectedTrailBounds}
            fitBoundsKey={selectedTrail?.id}
            flyTo={flyToReq}
            onMapClick={handleMapCanvasClick}
            onMapReady={(map) => {
              mapInstanceRef.current = map;
            }}
          />
        </div>

        {/* Desktop Hover Preview Card */}
        {canHover && hoveredTrailEntry && clampedHoverPos && !inspectedTrailEntry && (
          <div
            style={{
              position: 'absolute',
              left: clampedHoverPos.left,
              top: clampedHoverPos.top,
              transform: clampedHoverPos.transform,
              zIndex: 'calc(var(--z-map-hud, 400) + 3)' as unknown as number,
              pointerEvents: 'none',
            }}
          >
            <TacticalTrailTooltip trail={hoveredTrailEntry.trail} incident={hoveredTrailEntry.incident} />
          </div>
        )}

        {/* Clicked Trail Floating Inspect Card (Weather + Safety + Open Detail) */}
        {inspectedTrailEntry && (
          <div
            style={{
              position: 'absolute',
              top: 56,
              left: 56,
              zIndex: 'calc(var(--z-map-hud, 400) + 2)' as unknown as number,
              width: 'min(296px, calc(100% - 68px))',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 6,
              padding: '10px 12px 12px',
              boxShadow: 'var(--shadow-3d)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
              <button
                type="button"
                onClick={() => setInspectedTrailId(null)}
                aria-label="Đóng thẻ thông tin cung đường"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  background: 'var(--color-surface-elevated)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <CloseIcon size={13} />
              </button>
            </div>
            <TrailPopupContent
              trail={inspectedTrailEntry.trail}
              incident={inspectedTrailEntry.incident}
              onSelect={() => {
                onSelectTrail?.(inspectedTrailEntry.trail);
                setInspectedTrailId(null);
              }}
            />
          </div>
        )}

        {/* Clicked Waypoint / Field POI / User GPS Floating Detail Card */}
        {inspectedDetailCard && (
          <div
            style={{
              position: 'absolute',
              top: 56,
              left: 56,
              zIndex: 'calc(var(--z-map-hud, 400) + 2)' as unknown as number,
              width: 'min(276px, calc(100% - 68px))',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 6,
              padding: '10px 12px',
              boxShadow: 'var(--shadow-3d)',
              fontFamily: 'var(--font-family)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color:
                    inspectedDetailCard.kind === 'user-gps' ? 'var(--color-sky)' : inspectedDetailCard.token,
                }}
              >
                {inspectedDetailCard.kind === 'user-gps'
                  ? isFallbackLocation
                    ? 'Điểm tham khảo (Sa Pa)'
                    : 'Vị trí GPS của bạn'
                  : inspectedDetailCard.metaLabel}
              </span>
              <button
                type="button"
                onClick={() => setInspectedDetailCard(null)}
                aria-label="Đóng thông tin điểm mốc"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  background: 'var(--color-surface-elevated)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <CloseIcon size={12} />
              </button>
            </div>

            {inspectedDetailCard.kind === 'waypoint' && (
              <>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 4 }}>
                  {inspectedDetailCard.wp.name}
                </div>
                {typeof inspectedDetailCard.wp.elevationM === 'number' &&
                  Number.isFinite(inspectedDetailCard.wp.elevationM) && (
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-sky)', marginBottom: 4 }}>
                      Độ cao: {Math.round(inspectedDetailCard.wp.elevationM).toLocaleString('vi-VN')}m
                    </div>
                  )}
                {inspectedDetailCard.wp.description && (
                  <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', lineHeight: 1.45, marginBottom: 5 }}>
                    {inspectedDetailCard.wp.description}
                  </div>
                )}
                <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                  Tọa độ: {Number(inspectedDetailCard.wp.lat).toFixed(5)}, {Number(inspectedDetailCard.wp.lng).toFixed(5)}
                </div>
              </>
            )}

            {inspectedDetailCard.kind === 'poi' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                    {inspectedDetailCard.poi.title}
                  </div>
                  <span
                    style={{
                      fontSize: '0.64rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 3,
                      flexShrink: 0,
                      background:
                        inspectedDetailCard.poi.status === 'dry_or_closed'
                          ? 'color-mix(in srgb, var(--color-error) 16%, transparent)'
                          : 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
                      color:
                        inspectedDetailCard.poi.status === 'dry_or_closed'
                          ? 'var(--color-error-text, var(--color-error))'
                          : 'var(--color-primary)',
                    }}
                  >
                    {inspectedDetailCard.poi.status === 'dry_or_closed' ? 'Đã cạn / đóng' : 'Còn dùng được'}
                  </span>
                </div>
                {inspectedDetailCard.poi.notes && (
                  <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', lineHeight: 1.45, marginBottom: 5 }}>
                    {inspectedDetailCard.poi.notes}
                  </div>
                )}
                <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                  Tọa độ: {Number(inspectedDetailCard.poi.lat).toFixed(5)}, {Number(inspectedDetailCard.poi.lng).toFixed(5)}
                </div>
              </>
            )}

            {inspectedDetailCard.kind === 'user-gps' && userLocation && (
              <>
                <div style={{ fontSize: '0.76rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                  Tọa độ: {userLocation[0].toFixed(5)}, {userLocation[1].toFixed(5)}
                </div>
                {!isFallbackLocation && gpsAccuracy && (
                  <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
                    Sai số ước tính: ±{Math.round(gpsAccuracy)}m
                  </div>
                )}
                {!isFallbackLocation && (gpsAltitude !== null || gpsSpeed !== null) && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: '0.74rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                    {gpsAltitude !== null && <span>Cao độ: {gpsAltitude}m</span>}
                    {gpsSpeed !== null && <span>Tốc độ: {gpsSpeed} km/h</span>}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Empty Filter Result Overlay */}
        {filteredTrails.length === 0 && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 'var(--z-map-hud, 400)' as unknown as number,
              background: 'var(--color-bg-hud)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 6,
              padding: '12px 16px',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              justifyContent: 'center',
              maxWidth: 'calc(100% - 32px)',
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
              Chưa có cung nào hợp bộ lọc này.
            </span>
            <button
              type="button"
              onClick={() => {
                setDifficultyFilter('all');
                setHighAltitudeOnly(false);
                setBeginnerOnly(false);
                setGpsRadiusKm(null);
                onSelectRegion?.('All');
              }}
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                border: 'none',
                borderRadius: 4,
                padding: '5px 10px',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Xem lại tất cả
            </button>
          </div>
        )}

        {/* Off-Trail Alarm & Live GPS Track Export HUD */}
        {(offTrailMeters !== null || recordedTrack.length >= 2) && (
          <div
            style={{
              position: 'absolute',
              bottom: 84,
              left: 12,
              zIndex: 'calc(var(--z-map-hud, 400) + 1)' as unknown as number,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              maxWidth: 'min(calc(100% - 24px), 380px)',
            }}
          >
            {offTrailMeters !== null && (
              <div
                style={{
                  background: 'var(--color-error)',
                  color: 'var(--color-on-danger)',
                  padding: '10px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--banner-danger-border)',
                  boxShadow: 'var(--shadow-card)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: '0.8rem',
                  fontWeight: 800,
                }}
              >
                <AlertTriangleIcon size={18} color="var(--color-on-danger)" />
                <div>
                  <div>Bạn đang đi lệch khỏi đường mòn (+{offTrailMeters}m)</div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.92 }}>
                    Hãy ngoặt lại theo vệt xanh trên bản đồ để về đúng lối mòn.
                  </div>
                </div>
              </div>
            )}

            {recordedTrack.length >= 2 && (
              <div
                style={{
                  background: 'var(--color-bg-hud)',
                  border: '1px solid var(--color-border-glow)',
                  borderRadius: 6,
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  fontSize: '0.76rem',
                  color: 'var(--color-text-main)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <span>
                  Đã ghi <strong>{calculateRecordedDistanceKm(recordedTrack)} km</strong> ({recordedTrack.length} điểm)
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const gpxXml = buildRecordedGpxXml(selectedTrail?.name || 'LOST Track', recordedTrack);
                    const blob = new Blob([gpxXml], { type: 'application/gpx+xml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `lost-track-${Date.now()}.gpx`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                    onShowToast?.('Đã lưu tệp GPX hành trình của bạn về máy.', 'success');
                  }}
                  style={{ padding: '4px 10px', fontSize: '0.72rem', borderRadius: 4 }}
                >
                  Lưu GPX
                </button>
              </div>
            )}
          </div>
        )}

        {/* Lazy-Loaded 3D Terrain WebGL Modal */}
        {isTerrain3DOpen && selectedTrail && (
          <Suspense fallback={null}>
            <Terrain3DModal
              trail={selectedTrail}
              isOpen={isTerrain3DOpen}
              onClose={() => setIsTerrain3DOpen(false)}
            />
          </Suspense>
        )}

        {/* Nearby Trails GPS Overlay Card */}
        {gpsToast && (
          <div
            style={{
              position: 'absolute',
              bottom: 84,
              right: 12,
              zIndex: 'calc(var(--z-map-hud, 400) + 1)' as unknown as number,
              width: 'min(350px, calc(100% - 24px))',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 6,
              padding: 14,
              boxShadow: 'var(--shadow-3d)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
                paddingBottom: 8,
                borderBottom: '1px solid var(--color-border)',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  color: gpsToast.isFallback ? 'var(--color-sun)' : 'var(--color-sky)',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {gpsToast.isFallback ? 'Tham khảo (Sa Pa)' : 'Vị trí GPS'} [{gpsToast.lat.toFixed(4)},{' '}
                {gpsToast.lng.toFixed(4)}]
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={handleLocateMe}
                  disabled={isLocating}
                  style={{
                    background: 'color-mix(in srgb, var(--color-sky) 14%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-sky) 40%, transparent)',
                    color: 'var(--color-sky)',
                    borderRadius: 4,
                    padding: '2px 7px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: isLocating ? 'wait' : 'pointer',
                  }}
                >
                  Định vị lại
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGpsToast(null);
                    handleResetView();
                  }}
                  style={{
                    background: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-muted)',
                    borderRadius: 4,
                    padding: '2px 7px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Toàn cảnh
                </button>
                <button
                  type="button"
                  onClick={() => setGpsToast(null)}
                  aria-label="Đóng thẻ định vị"
                  style={{
                    background: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-muted)',
                    borderRadius: 4,
                    padding: '2px 7px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>

            {gpsToast.geocodedAddress && (
              <div
                style={{
                  fontSize: '0.76rem',
                  color: 'var(--color-primary)',
                  fontWeight: 700,
                  marginBottom: 8,
                  background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                  padding: '5px 8px',
                  borderRadius: 4,
                }}
              >
                {gpsToast.geocodedAddress}
              </div>
            )}

            {gpsToast.nearby.length > 0 ? (
              <div>
                <div
                  style={{
                    fontSize: '0.76rem',
                    color: 'var(--color-text-muted)',
                    marginBottom: 8,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--color-primary)"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
                    </svg>
                    <span>Cung gần bạn nhất:</span>
                  </span>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>{gpsToast.nearby.length} cung</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 210, overflowY: 'auto' }}>
                  {gpsToast.nearby.map((t) => {
                    const diffInfo = getDifficultyInfo(t.difficultyLevel);
                    const trailMeta = t as TrailWithMeta;
                    const dist = trailMeta.distanceFromUserKm;
                    const roadDist =
                      trailMeta.roadDistanceKm || trailMeta.estimatedRoadDistanceKm || (dist ? Math.round(dist * 1.8) : null);
                    const duration = trailMeta.travelDurationFormatted;
                    return (
                      <div
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setFocusedTrailId(t.id);
                          onFocusTrail?.(t);
                          triggerFlyTo(t.startLat, t.startLng, 11.8);
                          onSelectTrail?.(t);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectTrail?.(t);
                          }
                        }}
                        style={{
                          background: 'var(--color-bg-main)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 4,
                          padding: '9px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflow: 'hidden', marginRight: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                background: diffInfo.token,
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                color: 'var(--color-text-main)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {t.name}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: '0.68rem',
                              color: 'var(--color-text-dim)',
                              paddingLeft: 13,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span>{t.province}</span>
                            <span>·</span>
                            <span>{t.maxAltitudeM}m</span>
                            <span>·</span>
                            <span>{diffInfo.label}</span>
                          </div>
                        </div>

                        {roadDist && (
                          <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                            <span
                              title={dist ? `Ước tính đường bộ ~${roadDist} km (đường chim bay ~${dist} km)` : undefined}
                              style={{
                                fontSize: '0.74rem',
                                color: 'var(--color-sky)',
                                fontWeight: 800,
                                background: 'color-mix(in srgb, var(--color-sky) 14%, transparent)',
                                padding: '2px 7px',
                                borderRadius: 4,
                              }}
                            >
                              ~{roadDist} km
                            </span>
                            {duration && (
                              <span style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>
                                ~{duration}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)' }}>
                Quanh khu vực này hiện chưa có cung trekking nào được ghi nhận.
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);
