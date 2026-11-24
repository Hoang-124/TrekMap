import React, { useEffect, useState, useMemo, useRef, useCallback, Suspense, lazy } from 'react';
import {
  MapContainer,
  FreeBasemapLayer,
  Marker,
  Popup,
  Tooltip,
  Polyline,
  Circle,
  CircleMarker,
  MarkerClusterGroup,
  useMap,
  useMapEvents,
} from './LeafletPrimitives.js';
import L from 'leaflet';
import type { Trail, Incident } from '../../types.js';
import { FREE_BASEMAPS, FREE_BASEMAP_ORDER, type BasemapKey } from '../../utils/mapTiles.js';
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
  return ({ size = defaultSize, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      {d}
    </svg>
  );
};

const ChevronDown = createSvgIcon(<polyline points="6 9 12 15 18 9" />);
const Layers = createSvgIcon(<><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>);
const Check = createSvgIcon(<polyline points="20 6 9 17 4 12" />);
const Filter = createSvgIcon(<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />);
const Activity = createSvgIcon(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />);
const AlertTriangle = createSvgIcon(<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>);
const X = createSvgIcon(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>);
const ShieldCheck = createSvgIcon(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></>);

// Pure SVG fallback default icon (no external unpkg PNG requests - Rule 12)
const defaultPinSvgUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="36" viewBox="0 0 30 40"><path d="M15 1.5C7.5 1.5 1.5 7.5 1.5 15C1.5 24.8 13.6 36.8 14.5 37.7C14.8 38 15.2 38 15.5 37.7C16.4 36.8 28.5 24.8 28.5 15C28.5 7.5 22.5 1.5 15 1.5Z" fill="#10b981" stroke="#ffffff" stroke-width="2.4"/><circle cx="15" cy="15" r="5" fill="#ffffff"/></svg>'
)}`;
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: defaultPinSvgUrl,
  iconUrl: defaultPinSvgUrl,
  shadowUrl: '',
});

const escapeHtml = (unsafe: string) =>
  String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

// Helper for Leaflet SVG / Polyline hex color scheme (CSS vars do not resolve in Canvas/Leaflet pathOptions)
const getDifficultyColor = (difficulty: number) => {
  const diff = Number(difficulty) || 3;
  if (diff >= 4) return '#dc2626'; // High contrast crimson (Khó - Level 4, 5)
  if (diff === 3) return '#d97706'; // High contrast amber (Trung Bình - Level 3)
  return '#10b981'; // Emerald (Dễ - Level 1, 2)
};

const getDifficultyInfo = (difficulty: number) => {
  const diff = Number(difficulty) || 3;
  if (diff >= 4) {
    return {
      color: '#dc2626',
      token: 'var(--color-error)',
      onToken: 'var(--color-on-danger)',
      label: 'Khó',
    };
  }
  if (diff === 3) {
    return {
      color: '#d97706',
      token: 'var(--color-sun)',
      onToken: 'var(--color-on-primary)',
      label: 'Trung Bình',
    };
  }
  return {
    color: '#10b981',
    token: 'var(--color-primary)',
    onToken: 'var(--color-on-primary)',
    label: 'Dễ',
  };
};

function getAlertToken(severity?: string): { token: string; onToken: string; label: string } {
  if (severity === 'critical') {
    return { token: 'var(--color-error)', onToken: 'var(--color-on-danger)', label: 'Khẩn cấp' };
  }
  if (severity === 'high') {
    return { token: 'var(--color-earth)', onToken: 'var(--color-on-primary)', label: 'Nguy cấp' };
  }
  return { token: 'var(--color-sun)', onToken: 'var(--color-on-primary)', label: 'Chú ý' };
}

function mapWmoWeatherCode(code: number): string {
  if (code === 0) return 'Trời quang';
  if (code >= 1 && code <= 3) return 'Nhiều mây';
  if (code === 45 || code === 48) return 'Sương mù';
  if (code >= 51 && code <= 67) return 'Mưa nhỏ / Phùn';
  if (code >= 71 && code <= 77) return 'Băng giá / Tuyết';
  if (code >= 80 && code <= 82) return 'Mưa rào';
  if (code >= 95) return 'Giông bão';
  return 'Thời tiết thực địa';
}

// Tactical Helper to match an active (unresolved) incident to a trail with Vietnamese NFD normalization
const matchTrailIncident = (trail: Trail, incidents: MapIncident[] = []): MapIncident | undefined => {
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
};

// Module-level DivIcon cache keyed by (difficultyColor, alertSeverity, isFocused)
// Prevents Leaflet from tearing down & recreating DOM pins on unrelated state/hover/focus updates
const trailSvgIconCache = new Map<string, L.DivIcon>();

// Lightweight SVG Teardrop Pin with white border & center dot (Leaflet DivIcon)
const createTrailSvgIcon = (trail: Trail, incident?: MapIncident, isFocused = false) => {
  const diffInfo = getDifficultyInfo(trail.difficultyLevel);

  const hasAlert = !!incident;
  const severity = incident?.severity || 'high';
  const cacheKey = `${diffInfo.color}|${hasAlert ? severity : 'none'}|${isFocused ? '1' : '0'}`;
  const cached = trailSvgIconCache.get(cacheKey);
  if (cached) return cached;

  const alertColor = severity === 'critical' ? '#dc2626' : severity === 'high' ? '#ea580c' : '#d97706';

  const alertBadgeHtml = hasAlert
    ? `
    <div class="trail-pin-alert-badge" style="
      position: absolute;
      top: -6px;
      right: -7px;
      width: 20px;
      height: 20px;
      background: ${alertColor};
      border: 2px solid #ffffff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.55);
      z-index: 50;
      pointer-events: none;
    ">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="13"/>
        <circle cx="12" cy="18" r="1.5" fill="#ffffff" stroke="none"/>
      </svg>
    </div>
  `
    : '';

  const radarRingHtml = hasAlert
    ? `
    <div style="
      position: absolute;
      top: 15px;
      left: 15px;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 2px solid ${alertColor};
      background: ${alertColor}18;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 0;
      animation: warningRadarPulse 1.8s infinite cubic-bezier(0.25, 1, 0.5, 1);
    "></div>
  `
    : '';

  const pinScale = isFocused ? 'transform: scale(1.16);' : '';
  const customSvg = `
    <div class="trail-pin-node" style="
      position: relative;
      width: 30px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    ">
      ${radarRingHtml}
      <svg class="trail-teardrop-svg" width="30" height="40" viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="
        filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.55));
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        overflow: visible;
        position: relative;
        z-index: 1;
        ${pinScale}
      ">
        <path
          d="M15 1.5C7.5 1.5 1.5 7.5 1.5 15C1.5 24.8 13.6 36.8 14.5 37.7C14.8 38 15.2 38 15.5 37.7C16.4 36.8 28.5 24.8 28.5 15C28.5 7.5 22.5 1.5 15 1.5Z"
          fill="${diffInfo.color}"
          stroke="#ffffff"
          stroke-width="${isFocused ? '3' : '2.4'}"
          stroke-linejoin="round"
        />
        <circle cx="15" cy="15" r="5.2" fill="#ffffff" />
      </svg>
      ${alertBadgeHtml}
    </div>
  `;

  const icon = L.divIcon({
    html: customSvg,
    className: 'custom-trail-svg-marker',
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -40],
  });
  trailSvgIconCache.set(cacheKey, icon);
  return icon;
};

// Auto-Positioned Hover Tooltip Component (Strict Dual-Theme Tokens)
export const TacticalTrailTooltip: React.FC<{
  trail: Trail;
  incident?: MapIncident;
  onSelect?: () => void;
}> = React.memo(({ trail, incident, onSelect }) => {
  const diffInfo = getDifficultyInfo(trail.difficultyLevel);
  const hasAlert = !!incident;
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
        width: 300,
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
      {/* Top Badges Row */}
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
          <span>{diffInfo.label} ({trail.difficultyLevel}/5)</span>
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
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>{trail.province}{trail.district ? `, ${trail.district}` : ''}</span>
        </div>
      </div>

      {/* Trail Name Title */}
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

      {/* Telemetry 3-Cell Strip */}
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
          <div style={{ fontSize: '8.5px', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
            Quãng đường
          </div>
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
          <div style={{ fontSize: '8.5px', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
            Cao độ
          </div>
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
          <div style={{ fontSize: '8.5px', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
            Thời gian
          </div>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-sun)', marginTop: 2 }}>
            {trail.durationDays ? `${trail.durationDays}N` : '1-2N'}
          </div>
        </div>
      </div>

      {/* Safety Alert Callout */}
      {hasAlert && (
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '10px', fontWeight: 800, color: alertMeta.token }}>
              <AlertTriangle size={12} color={alertMeta.token} />
              CẢNH BÁO AN TOÀN
            </span>
            <span
              style={{
                fontSize: '8.5px',
                fontWeight: 800,
                background: alertMeta.token,
                color: alertMeta.onToken,
                padding: '1px 6px',
                borderRadius: 3,
                textTransform: 'uppercase',
              }}
            >
              {alertMeta.label}
            </span>
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--banner-danger-text)', fontWeight: 500, lineHeight: 1.4, wordBreak: 'break-word' }}>
            {incident.description || 'Có sự cố an toàn trên cung đường'}
          </div>
        </div>
      )}

      {/* Action Footer Hint */}
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
        <span>Nhấp pin để xem thời tiết &amp; mở hồ sơ</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
    </div>
  );
});

// Tactical Incidents Quick Inspection Drawer
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
      {/* Header */}
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
            <AlertTriangle size={16} color="var(--color-error)" />
          </div>
          <div>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
              Điểm Cảnh Báo An Toàn
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
              {alertTrails.length} cung đường có thông báo thực địa
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
          <X size={14} />
        </button>
      </div>

      {/* Filter Toggle Subheader */}
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
          {isFilterActive ? 'Đang lọc riêng các điểm cảnh báo' : 'Hiển thị tất cả trên bản đồ'}
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
          {isFilterActive ? 'Bỏ lọc cảnh báo' : 'Lọc riêng cảnh báo'}
        </button>
      </div>

      {/* Alert Items List */}
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
              <ShieldCheck size={28} color="var(--color-primary)" />
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
              Không có cảnh báo an toàn nào
            </div>
            <div style={{ fontSize: '0.72rem', marginTop: 4, color: 'var(--color-text-muted)' }}>
              Mọi cung đường hiện đang ở trạng thái ổn định và thông tuyến bình thường.
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
                {/* Title & Badge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1.3 }}>
                      {trail.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {trail.province}{trail.district ? `, ${trail.district}` : ''} · {trail.region}
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
                      textTransform: 'uppercase',
                      flexShrink: 0,
                    }}
                  >
                    {alertMeta.label}
                  </span>
                </div>

                {/* Incident Description — WCAG AA in both Dark & Light mode */}
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
                  {incident.description || 'Có thông báo cảnh báo an toàn thực địa trên cung đường này.'}
                </div>

                {/* Action Buttons */}
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
                    <span>Bay đến vị trí</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
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

// User GPS Pulse Location Marker Icon Helper (Cached Module Singleton Leaflet DivIcon)
let cachedUserGpsIcon: L.DivIcon | null = null;
const createUserGpsIcon = () => {
  if (cachedUserGpsIcon) return cachedUserGpsIcon;
  const customSvg = `
    <div style="
      position: relative;
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        position: absolute;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: rgba(56, 189, 248, 0.28);
        border: 1.5px solid #0284c7;
      "></div>
      <div style="
        width: 13px;
        height: 13px;
        border-radius: 50%;
        background: #0284c7;
        border: 2.5px solid #ffffff;
      "></div>
    </div>
  `;

  cachedUserGpsIcon = L.divIcon({
    html: customSvg,
    className: 'user-gps-marker',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
  return cachedUserGpsIcon;
};

// Start & Finish Peak Marker Icon Helper for GPX Polylines (Cached Leaflet DivIcon)
const startEndIconCache = new Map<string, L.DivIcon>();
const createStartEndIcon = (type: 'start' | 'finish', label?: string) => {
  const cacheKey = `${type}|${label || ''}`;
  const cached = startEndIconCache.get(cacheKey);
  if (cached) return cached;

  const isStart = type === 'start';
  const color = isStart ? '#10b981' : '#d97706';
  const iconSvg = isStart
    ? '<svg width="8" height="8" viewBox="0 0 24 24" fill="#10b981"><circle cx="12" cy="12" r="10"/></svg>'
    : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';
  const text = escapeHtml(label || (isStart ? 'Khởi hành' : 'Đỉnh'));

  const html = `
    <div class="marker-hover-anim" style="
      background: rgba(12, 15, 13, 0.9);
      border: 1px solid ${color};
      color: #f4f3ee;
      font-size: 10px;
      font-weight: 800;
      border-radius: 4px;
      padding: 2px 7px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
      line-height: 1.2;
    ">
      <span style="display: flex; align-items: center;">${iconSvg}</span>
      <span>${text}</span>
    </div>
  `;

  const icon = L.divIcon({
    html,
    className: 'start-finish-marker',
    iconSize: [74, 20],
    iconAnchor: [37, 24],
  });
  startEndIconCache.set(cacheKey, icon);
  return icon;
};

// Pure-SVG Waypoint Marker Icon Helper (distinct icon & accent color by waypoint type - Rule 12)
const WAYPOINT_META: Record<string, { label: string; hex: string; token: string; svg: string }> = {
  campsite: {
    label: 'Bãi cắm trại / Lán',
    hex: '#10b981',
    token: 'var(--color-primary)',
    svg: '<path d="M19 20 10 4"/><path d="m5 20 9-16"/><path d="M3 20h18"/>',
  },
  water: {
    label: 'Nguồn nước suối',
    hex: '#0284c7',
    token: 'var(--color-sky)',
    svg: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  },
  viewpoint: {
    label: 'Điểm ngắm cảnh',
    hex: '#d97706',
    token: 'var(--color-sun)',
    svg: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  },
  danger: {
    label: 'Cảnh báo nguy hiểm',
    hex: '#dc2626',
    token: 'var(--color-error)',
    svg: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  },
  summit: {
    label: 'Đỉnh núi / Cột mốc',
    hex: '#eab308',
    token: 'var(--color-sun)',
    svg: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
  },
  rest: {
    label: 'Trạm dừng chân',
    hex: '#0d9488',
    token: 'var(--color-primary)',
    svg: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
  },
  charging: {
    label: 'Trạm hỗ trợ / Lán',
    hex: '#0d9488',
    token: 'var(--color-primary)',
    svg: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  },
};

const waypointIconCache = new Map<string, L.DivIcon>();
const createWaypointSvgIcon = (type: string): L.DivIcon => {
  const key = WAYPOINT_META[type] ? type : 'rest';
  const cached = waypointIconCache.get(key);
  if (cached) return cached;

  const meta = WAYPOINT_META[key];
  const icon = L.divIcon({
    html: `<div style="
      width:26px;height:26px;border-radius:50%;
      background:${meta.hex};
      border:2px solid #ffffff;
      box-shadow:0 2px 7px rgba(0,0,0,0.48);
      display:flex;align-items:center;justify-content:center;
      cursor:pointer;
    "><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${meta.svg}</svg></div>`,
    className: 'lost-waypoint-svg-marker',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
  waypointIconCache.set(key, icon);
  return icon;
};

// Pure-SVG Community Field POI Marker Icon Helper (water / camp / signal / danger / viewpoint)
const FIELD_POI_META: Record<string, { label: string; hex: string; token: string; svg: string }> = {
  water: {
    label: 'Nguồn nước thực địa',
    hex: '#0284c7',
    token: 'var(--color-sky)',
    svg: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  },
  camp: {
    label: 'Lán / Bãi trại cộng đồng',
    hex: '#10b981',
    token: 'var(--color-primary)',
    svg: '<path d="M19 20 10 4"/><path d="m5 20 9-16"/><path d="M3 20h18"/>',
  },
  signal: {
    label: 'Điểm có sóng 4G',
    hex: '#0891b2',
    token: 'var(--color-sky)',
    svg: '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><circle cx="12" cy="12" r="2"/><path d="M19.1 4.9c3.9 3.9 3.9 10.3 0 14.2"/>',
  },
  danger: {
    label: 'Điểm nguy hiểm thực địa',
    hex: '#dc2626',
    token: 'var(--color-error)',
    svg: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  },
  viewpoint: {
    label: 'Điểm săn mây / Ngắm cảnh',
    hex: '#d97706',
    token: 'var(--color-sun)',
    svg: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  },
};

const fieldPoiIconCache = new Map<string, L.DivIcon>();
const createFieldPoiSvgIcon = (category: string, status?: string): L.DivIcon => {
  const normCategory = FIELD_POI_META[category] ? category : 'water';
  const isClosed = status === 'dry_or_closed';
  const cacheKey = `${normCategory}|${isClosed ? 'closed' : 'open'}`;
  const cached = fieldPoiIconCache.get(cacheKey);
  if (cached) return cached;

  const meta = FIELD_POI_META[normCategory];
  const bg = isClosed ? '#64748b' : meta.hex;
  const icon = L.divIcon({
    html: `<div style="
      width:24px;height:24px;border-radius:6px;
      background:${bg};
      border:2px ${isClosed ? 'dashed' : 'solid'} #ffffff;
      box-shadow:0 2px 6px rgba(0,0,0,0.45);
      display:flex;align-items:center;justify-content:center;
      opacity:${isClosed ? '0.82' : '1'};
      cursor:pointer;
    "><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${meta.svg}</svg></div>`,
    className: 'lost-field-poi-svg-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -13],
  });
  fieldPoiIconCache.set(cacheKey, icon);
  return icon;
};

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

const clusterIconCache = new Map<number, L.DivIcon>();
const createClusterCustomIcon = (cluster: { getChildCount: () => number }): L.DivIcon => {
  const count = cluster.getChildCount();
  const cached = clusterIconCache.get(count);
  if (cached) return cached;

  const size = count >= 10 ? 40 : 34;
  const icon = L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      background:rgba(12,15,13,0.92);
      border:2px solid #52b788;
      border-radius:6px;
      color:#f4f3ee;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      font-family:'Plus Jakarta Sans',system-ui,sans-serif;
      font-weight:800;font-size:${count >= 10 ? '13px' : '12px'};
      line-height:1;
      box-shadow:0 4px 12px rgba(0,0,0,0.42);
      font-variant-numeric:tabular-nums;
    ">
      <span>${count}</span>
      <span style="font-size:8px;letter-spacing:0.06em;color:#52b788;margin-top:2px;text-transform:uppercase;">CUNG</span>
    </div>`,
    className: 'lost-marker-cluster',
    iconSize: L.point(size, size, true),
    iconAnchor: [size / 2, size / 2],
  });
  clusterIconCache.set(count, icon);
  return icon;
};

// Rich Interactive Trail Popup with Live Realtime Weather & Safety Alert
export const TrailPopupContent: React.FC<{ trail: Trail; incident?: MapIncident; onSelect: () => void }> = React.memo(({
  trail,
  incident,
  onSelect,
}) => {
  const [weather, setWeather] = useState<{
    temp: number;
    condition: string;
    humidity?: number;
    windspeed?: number;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const weatherLat = Number.isFinite(trail.endLat) ? trail.endLat : trail.startLat;
    const weatherLng = Number.isFinite(trail.endLng) ? trail.endLng : trail.startLng;
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
          storm: 'Bão dông',
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
            ? condMap[json.data.daily[0].weatherCondition] || 'Thời tiết thực địa'
            : 'Thời tiết thực địa';

          setWeather({
            temp: Math.round(tempVal),
            condition: conditionLabel,
            humidity: typeof curr.humidity === 'number' ? Math.round(curr.humidity) : undefined,
            windspeed: typeof curr.windspeed === 'number' ? Math.round(curr.windspeed) : undefined,
          });
        } else if (Array.isArray(json.data.daily) && json.data.daily.length > 0) {
          const today = json.data.daily[0];
          setWeather({
            temp: Math.round(((today.tempMinC ?? 15) + (today.tempMaxC ?? 22)) / 2),
            condition: condMap[today.weatherCondition] || 'Thời tiết thực địa',
            humidity: typeof today.humidityPercent === 'number' ? Math.round(today.humidityPercent) : undefined,
            windspeed: typeof today.windSpeedKmH === 'number' ? Math.round(today.windSpeedKmH) : undefined,
          });
        } else if (Array.isArray(json.data) && json.data.length > 0) {
          const today = json.data[0];
          setWeather({
            temp: Math.round(((today.tempMinC ?? 15) + (today.tempMaxC ?? 22)) / 2),
            condition: condMap[today.weatherCondition] || 'Thời tiết thực địa',
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
  }, [trail.endLat, trail.endLng, trail.startLat, trail.startLng]);

  const diffInfo = getDifficultyInfo(trail.difficultyLevel);
  const alertMeta = getAlertToken(incident?.severity);

  return (
    <div style={{ width: 268, padding: '2px 0', fontFamily: 'var(--font-family)' }}>
      <div
        style={{
          position: 'relative',
          height: 124,
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
          Mức khó: {trail.difficultyLevel}/5
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
          fontSize: '0.96rem',
          fontWeight: 800,
          color: 'var(--color-text-main)',
          lineHeight: 1.35,
        }}
      >
        {trail.name}
      </h4>

      {/* Incident Warning Alert Banner */}
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, color: alertMeta.token, fontSize: '0.74rem' }}>
              <AlertTriangle size={12} color={alertMeta.token} />
              <span>Cảnh Báo Thực Địa</span>
            </span>
            <span
              style={{
                fontSize: '0.62rem',
                background: alertMeta.token,
                color: alertMeta.onToken,
                padding: '1px 6px',
                borderRadius: 3,
                fontWeight: 800,
                textTransform: 'uppercase',
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
          <div style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Độ dài</div>
          <strong style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>{trail.distanceKm} km</strong>
        </div>
        <div style={{ borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Tích lũy</div>
          <strong style={{ fontSize: '0.8rem', color: 'var(--color-sky)' }}>+{trail.elevationGainM}m</strong>
        </div>
        <div>
          <div style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Thời gian</div>
          <strong style={{ fontSize: '0.8rem', color: 'var(--color-sun)' }}>{trail.durationDays}N</strong>
        </div>
      </div>

      {weather && (
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></svg>
            <span>{weather.condition}</span>
          </span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {weather.temp}°C
            {weather.humidity !== undefined ? ` · ${weather.humidity}%` : ''}
            {weather.windspeed !== undefined ? ` · ${weather.windspeed}km/h` : ''}
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
        <span>Xem Chi Tiết Cung Đường</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
      </button>
    </div>
  );
});

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

const MapController: React.FC<{
  selectedTrail?: Trail | null;
  flyToPos?: [number, number] | null;
  flyToZoom?: number;
  flyTick?: number;
  currentTileKey?: string;
  isLiveTracking?: boolean;
  isScrollZoomUnlocked: boolean;
  onMapCanvasClick?: () => void;
  onUnlockScrollZoom?: () => void;
}> = ({
  selectedTrail,
  flyToPos,
  flyToZoom,
  flyTick = 0,
  currentTileKey,
  isLiveTracking,
  isScrollZoomUnlocked,
  onMapCanvasClick,
  onUnlockScrollZoom,
}) => {
  const map = useMap();
  const prevTileRef = useRef(currentTileKey);
  const selectedTrailId = selectedTrail?.id;
  const selectedTrailStartLat = selectedTrail?.startLat;
  const selectedTrailStartLng = selectedTrail?.startLng;

  useMapEvents({
    click: () => {
      onMapCanvasClick?.();
      if (!isScrollZoomUnlocked) {
        onUnlockScrollZoom?.();
      }
    },
  });

  useEffect(() => {
    if (isScrollZoomUnlocked) {
      map.scrollWheelZoom.enable();
    } else {
      map.scrollWheelZoom.disable();
    }
  }, [isScrollZoomUnlocked, map]);

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const handleResize = () => {
      map.invalidateSize();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  useEffect(() => {
    if (flyToPos) {
      if (isLiveTracking) {
        map.panTo(flyToPos, { animate: true, duration: 0.8 });
      } else {
        map.flyTo(flyToPos, flyToZoom ?? 13, { duration: 1.2 });
      }
    } else if (
      selectedTrailId &&
      typeof selectedTrailStartLat === 'number' &&
      typeof selectedTrailStartLng === 'number'
    ) {
      map.flyTo([selectedTrailStartLat, selectedTrailStartLng], 12, { duration: 1.2 });
    } else {
      map.flyTo([16.0470, 108.2062], 6, { duration: 1.0 });
    }
  }, [selectedTrailId, selectedTrailStartLat, selectedTrailStartLng, flyToPos, flyToZoom, flyTick, isLiveTracking, map]);

  useEffect(() => {
    if (prevTileRef.current !== currentTileKey) {
      const center = map.getCenter();
      const zoom = map.getZoom();
      requestAnimationFrame(() => {
        map.setView(center, zoom, { animate: false });
        map.invalidateSize();
      });
      prevTileRef.current = currentTileKey;
    }
  }, [currentTileKey, map]);

  return null;
};

const CustomMapControls: React.FC<{ onResetView: () => void }> = ({ onResetView }) => {
  const map = useMap();

  return (
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
          onClick={() => map.zoomIn()}
          aria-label="Phóng to"
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
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => map.zoomOut()}
          aria-label="Thu nhỏ"
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
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <button
        type="button"
        onClick={onResetView}
        aria-label="Toàn cảnh Việt Nam"
        title="Đặt lại góc nhìn toàn cảnh bản đồ Việt Nam"
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" fillOpacity="0.35" />
        </svg>
      </button>
    </div>
  );
};

export const MapView: React.FC<MapViewProps> = React.memo(({
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
  const [currentTileKey, setCurrentTileKey] = useState<BasemapKey>(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false ? 'topo' : 'standard'
  );
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isFallbackLocation, setIsFallbackLocation] = useState(false);
  const [flyToPos, setFlyToPos] = useState<[number, number] | null>(null);
  const [flyToZoom, setFlyToZoom] = useState<number>(13);
  const [flyTick, setFlyTick] = useState<number>(0);
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
  const [showWaypoints, setShowWaypoints] = useState<boolean>(true);
  const lastOffTrailBeepRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const locateAbortRef = useRef<AbortController | null>(null);
  const hoverRafRef = useRef<number | null>(null);
  const lastHoverTrackIdxRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<{ lat: number; lng: number; track: [number, number][] } | null>(null);
  const onHoverTrackIndexRef = useRef(onHoverTrackIndex);

  useEffect(() => {
    onHoverTrackIndexRef.current = onHoverTrackIndex;
  }, [onHoverTrackIndex]);

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

  // Reset stale flyToPos cleanly whenever selectedTrail.id changes so MapController always flies to the newly selected trail
  if (trackedSelectedTrailId !== selectedTrail?.id) {
    setTrackedSelectedTrailId(selectedTrail?.id);
    setFlyToPos(null);
  }
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
      setCurrentTileKey('topo');
      onShowToast?.('Đang ở chế độ ngoại tuyến — tự động dùng lớp địa hình AWS Terrarium DEM đã tải.', 'info');
    };
    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, [onShowToast]);
  const [isTileDropdownOpen, setIsTileDropdownOpen] = useState(false);
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

  const centerLat = selectedTrail ? selectedTrail.startLat : 16.0470;
  const centerLng = selectedTrail ? selectedTrail.startLng : 108.2062;
  const zoomLevel = selectedTrail ? 12 : 6;

  // Extract all trails that have active safety alerts across the region or country
  const alertSourceTrails = allTrails && allTrails.length > 0 ? allTrails : trails;
  const alertTrails = useMemo(() => {
    return alertSourceTrails
      .map((trail) => ({ trail, incident: matchTrailIncident(trail, incidents) }))
      .filter((item): item is { trail: Trail; incident: MapIncident } => !!item.incident);
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

  // Memoize Leaflet DivIcons to avoid destroying/recreating DOM pins on every render
  const userGpsIcon = useMemo(() => createUserGpsIcon(), []);
  const startFlagIcon = useMemo(() => createStartEndIcon('start', 'Xuất phát'), []);

  const trailMarkerData = useMemo(() => {
    return filteredTrails.map((trail) => {
      const tid = trail.id || (trail as TrailWithMeta)._id || '';
      const matchingIncident = matchTrailIncident(trail, incidents);
      const isFocused = activeEmphasisTrailId === tid;
      return {
        trail,
        tid,
        matchingIncident,
        icon: createTrailSvgIcon(trail, matchingIncident, isFocused),
      };
    });
  }, [filteredTrails, incidents, activeEmphasisTrailId]);

  // Visible trails with GPX tracklogs (works cleanly both on homepage overview and detail view)
  const activeGpxTrails = useMemo(() => {
    const withTrack = filteredTrails.filter((t) => Array.isArray(t.gpxTrack) && t.gpxTrack.length >= 2);
    if (selectedTrail && Array.isArray(selectedTrail.gpxTrack) && selectedTrail.gpxTrack.length >= 2) {
      if (!withTrack.some((t) => t.id === selectedTrail.id)) {
        return [selectedTrail, ...withTrack];
      }
    }
    return withTrack;
  }, [selectedTrail, filteredTrails]);

  const finishIconsByTrailId = useMemo(() => {
    const map = new Map<string, L.DivIcon>();
    for (const t of activeGpxTrails) {
      map.set(t.id, createStartEndIcon('finish', `${t.maxAltitudeM}m`));
    }
    return map;
  }, [activeGpxTrails]);

  const activeDetailTrail = useMemo(() => {
    if (selectedTrail) return selectedTrail;
    if (focusedTrailId) {
      return filteredTrails.find((t) => (t.id || (t as TrailWithMeta)._id) === focusedTrailId) || null;
    }
    return null;
  }, [selectedTrail, focusedTrailId, filteredTrails]);

  const waypointMarkerData = useMemo(() => {
    const wps = activeDetailTrail?.waypoints;
    if (!Array.isArray(wps) || wps.length === 0) return [];
    return wps
      .filter((wp) => Number.isFinite(Number(wp.lat)) && Number.isFinite(Number(wp.lng)))
      .map((wp, idx) => ({
        wp,
        key: wp.id || `wp-${activeDetailTrail?.id || 't'}-${idx}`,
        meta: WAYPOINT_META[wp.type] || WAYPOINT_META.rest,
        icon: createWaypointSvgIcon(wp.type),
      }));
  }, [activeDetailTrail]);

  const fieldPoiMarkerData = useMemo(() => {
    if (!Array.isArray(trailPois) || trailPois.length === 0) return [];
    return trailPois
      .filter((poi) => Number.isFinite(Number(poi.lat)) && Number.isFinite(Number(poi.lng)))
      .map((poi) => ({
        poi,
        meta: FIELD_POI_META[poi.category] || FIELD_POI_META.water,
        icon: createFieldPoiSvgIcon(poi.category, poi.status),
      }));
  }, [trailPois]);

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
        setFlyToPos([first.startLat, first.startLng]);
        setFlyToZoom(11);
        setFlyTick((n) => n + 1);
        onShowToast?.(`Đang lọc ${alertTrails.length} vị trí có cảnh báo an toàn thực địa`, 'info');
      } else {
        onShowToast?.('Hiện không có cảnh báo an toàn nào trên các cung đường này.', 'info');
      }
    }
  };

  const handleFlyToAlertTrail = (trail: Trail) => {
    if (onSelectRegion && trail.region) {
      onSelectRegion('All');
    }
    setFocusedTrailId(trail.id);
    onFocusTrail?.(trail);
    setFlyToPos([trail.startLat, trail.startLng]);
    setFlyToZoom(13);
    setFlyTick((n) => n + 1);
    setIsAlertsDrawerOpen(false);
    onShowToast?.(`Đang định vị đến cung cảnh báo: ${trail.name}`, 'info');
  };

  const handleResetView = () => {
    setFocusedTrailId(null);
    setFlyToPos([16.0470, 108.2062]);
    setFlyToZoom(6);
    setFlyTick((n) => n + 1);
    onShowToast?.('Đã đặt lại góc nhìn toàn cảnh bản đồ Việt Nam', 'info');
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
      setFlyToPos(coords);
      setFlyToZoom(12);
      setFlyTick((n) => n + 1);
      setIsLocating(false);

      try {
        const [nearby, geoData] = await Promise.all([
          fetchNearbyTrails(lat, lng, 4),
          reverseGeocode(lat, lng),
        ]);
        if (controller.signal.aborted) return;
        setGpsToast({
          lat,
          lng,
          nearby: nearby || [],
          geocodedAddress: geoData?.formattedAddress || geoData?.displayName,
          isFallback,
        });
        if (!isFallback) {
          onShowToast?.('Đã xác định vị trí GPS thực tế của bạn!', 'success');
        }
      } catch {
        if (!controller.signal.aborted) {
          setGpsToast({ lat, lng, nearby: [], isFallback });
        }
      }
    };

    if (!navigator.geolocation) {
      onShowToast?.('Trình duyệt không hỗ trợ định vị GPS. Hiển thị khu vực tham khảo Sa Pa.', 'error');
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
            ? 'Bạn chưa cấp quyền truy cập vị trí GPS. Đang hiển thị khu vực tham khảo Sa Pa.'
            : 'Không thể thu tín hiệu GPS thực tế lúc này. Đang hiển thị khu vực tham khảo Sa Pa.';
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
      onShowToast?.('Đã dừng chế độ ghi & theo dõi GPS thực địa', 'info');
    } else {
      if (!navigator.geolocation) {
        onShowToast?.('Trình duyệt không hỗ trợ cảm biến định vị GPS', 'error');
        return;
      }
      setIsLiveTracking(true);
      setRecordedTrack([]);
      setOffTrailMeters(null);
      setIsFallbackLocation(false);
      onShowToast?.('Đang bật GPS Live Recorder & Cảnh báo lệch tuyến (> 100m)...', 'info');

      try {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, accuracy, altitude, speed } = position.coords;
            const coords: [number, number] = [latitude, longitude];
            setUserLocation(coords);
            setGpsAccuracy(accuracy);
            if (altitude !== null && altitude !== undefined) setGpsAltitude(Math.round(altitude));
            if (speed !== null && speed !== undefined) setGpsSpeed(Math.max(0, Math.round(speed * 3.6)));
            setFlyToPos(coords);

            setRecordedTrack((prev) => [
              ...prev.slice(-999),
              {
                lat: latitude,
                lng: longitude,
                altitudeM: altitude !== null && altitude !== undefined ? Math.round(altitude) : null,
                accuracyM: accuracy ?? null,
                timestamp: Date.now(),
              },
            ]);

            if (selectedTrail?.gpxTrack && selectedTrail.gpxTrack.length >= 2) {
              const distM = distanceToTrackMeters(latitude, longitude, selectedTrail.gpxTrack);
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
            }
          },
          (err) => {
            console.warn('GPS Watch Error:', err);
            if (watchIdRef.current !== null && navigator.geolocation) {
              navigator.geolocation.clearWatch(watchIdRef.current);
              watchIdRef.current = null;
            }
            onShowToast?.('Mất tín hiệu vệ tinh GPS hoặc chưa cấp quyền định vị.', 'error');
            setIsLiveTracking(false);
          },
          { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 }
        );
      } catch {
        setIsLiveTracking(false);
      }
    }
  };

  // Single clean unmount cleanup for active GPS watcher, rAF hover sync & pending locate requests
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

  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: 4, overflow: 'hidden' }}>
      {/* Floating Command Dock (Top Right) */}
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
        {/* GPX Track Toggle Button */}
        <button
          type="button"
          onClick={() => setShowGpxTracks((prev) => !prev)}
          aria-label="Bật tắt đường GPX"
          title="Bật/tắt hiển thị tracklog GPX thực tế"
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
          <Activity size={13} color={showGpxTracks ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
          <span>GPX</span>
        </button>

        {/* Waypoints & Field POIs Layer Toggle Chip */}
        {(waypointMarkerData.length > 0 || fieldPoiMarkerData.length > 0) && (
          <button
            type="button"
            onClick={() => setShowWaypoints((prev) => !prev)}
            aria-pressed={showWaypoints}
            aria-label="Bật tắt điểm mốc và điểm thực địa POI"
            title="Bật/tắt hiển thị điểm mốc (Waypoints) và điểm thực địa cộng đồng (POI)"
            style={{
              height: 28,
              background: showWaypoints ? 'color-mix(in srgb, var(--color-sky) 16%, transparent)' : 'transparent',
              color: showWaypoints ? 'var(--color-sky)' : 'var(--color-text-muted)',
              border: showWaypoints ? '1px solid color-mix(in srgb, var(--color-sky) 42%, transparent)' : '1px solid transparent',
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>Mốc ({waypointMarkerData.length + fieldPoiMarkerData.length})</span>
          </button>
        )}

        {/* Scroll-Wheel Zoom Lock Toggle (Prevents accidental page-scroll hijack on homepage) */}
        {!selectedTrail && (
          <button
            type="button"
            onClick={() => setIsScrollZoomUnlocked((prev) => !prev)}
            aria-label={effectiveScrollZoom ? 'Khóa cuộn phóng to bản đồ' : 'Mở cuộn phóng to bản đồ'}
            title={
              effectiveScrollZoom
                ? 'Đang bật cuộn chuột để phóng to bản đồ (nhấn để khóa khi cuộn trang)'
                : 'Đang khóa cuộn chuột để tránh trượt trang (nhấn hoặc chạm bản đồ để bật)'
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
            <span>{effectiveScrollZoom ? 'Cuộn Zoom: Bật' : 'Cuộn Zoom'}</span>
          </button>
        )}

        {/* Live GPS Tracking Toggle Button */}
        <button
          type="button"
          onClick={handleToggleLiveTracking}
          aria-label="Theo dõi GPS thực địa"
          title="Theo dõi vị trí GPS di chuyển liên tục theo thời gian thực"
          style={{
            height: 28,
            background: isLiveTracking ? 'color-mix(in srgb, var(--color-sky) 16%, transparent)' : 'transparent',
            color: isLiveTracking ? 'var(--color-sky)' : 'var(--color-text-muted)',
            border: isLiveTracking ? '1px solid color-mix(in srgb, var(--color-sky) 45%, transparent)' : '1px solid transparent',
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
          <span>{isLiveTracking ? 'Live: Bật' : 'Live GPS'}</span>
        </button>

        {/* Locate Me GPS Button */}
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={isLocating}
          aria-label="Định vị GPS của tôi"
          title="Xác định tọa độ GPS và tìm các cung trekking gần nhất"
          style={{
            height: 28,
            background: isLocating ? 'color-mix(in srgb, var(--color-sky) 16%, transparent)' : 'var(--color-surface-elevated)',
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
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
          <span>{isLocating ? 'Định vị...' : 'Vị Trí'}</span>
        </button>

        {/* Active Alerts Tactical Drawer Toggle Button */}
        <button
          type="button"
          onClick={() => setIsAlertsDrawerOpen(!isAlertsDrawerOpen)}
          aria-label="Danh sách điểm cảnh báo an toàn"
          title="Xem danh sách tất cả các điểm phát cảnh báo an toàn trên bản đồ"
          style={{
            height: 28,
            background: isAlertsDrawerOpen
              ? 'color-mix(in srgb, var(--color-error) 20%, transparent)'
              : alertTrails.length > 0
              ? 'color-mix(in srgb, var(--color-error) 12%, transparent)'
              : 'var(--color-surface-elevated)',
            color: alertTrails.length > 0 ? 'var(--color-error-text, var(--color-error))' : 'var(--color-text-muted)',
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
          <AlertTriangle size={12} color={alertTrails.length > 0 ? 'var(--color-error)' : 'currentColor'} />
          <span>Cảnh Báo</span>
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

        {/* Real 3D DEM Terrain Launcher */}
        {selectedTrail && (
          <button
            type="button"
            onClick={() => setIsTerrain3DOpen(true)}
            title="Mở chế độ địa hình 3D DEM thật bằng MapLibre WebGL"
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
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
            </svg>
            <span>3D DEM</span>
          </button>
        )}

        {/* Tile Layer Selector Dropdown */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setIsTileDropdownOpen(!isTileDropdownOpen)}
            aria-label="Chọn lớp bản đồ"
            aria-expanded={isTileDropdownOpen}
            style={{
              height: 28,
              background: isTileDropdownOpen
                ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)'
                : 'var(--color-surface-elevated)',
              color: 'var(--color-text-main)',
              border: isTileDropdownOpen ? '1px solid var(--color-border-glow)' : '1px solid var(--color-border)',
              borderRadius: 4,
              padding: '0 8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
            }}
          >
            <Layers size={13} color="var(--color-primary)" />
            <span>{FREE_BASEMAPS[currentTileKey]?.shortLabel || 'Bản Đồ Chuẩn'}</span>
            <ChevronDown size={11} />
          </button>

          {isTileDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 6,
                padding: 5,
                boxShadow: 'var(--shadow-3d)',
                minWidth: 224,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                zIndex: 'calc(var(--z-map-hud, 400) + 1)' as unknown as number,
              }}
            >
              {FREE_BASEMAP_ORDER.map((key) => {
                const isSelected = key === currentTileKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setCurrentTileKey(key);
                      setIsTileDropdownOpen(false);
                    }}
                    style={{
                      background: isSelected ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'transparent',
                      color: isSelected ? 'var(--color-primary)' : 'var(--color-text-main)',
                      border: 'none',
                      borderRadius: 4,
                      padding: '7px 10px',
                      fontSize: '0.76rem',
                      fontWeight: isSelected ? 800 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      textAlign: 'left',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>{FREE_BASEMAPS[key].label}</span>
                    {isSelected && <Check size={13} color="var(--color-primary)" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tactical Incidents Floating Panel / Drawer */}
      <TacticalIncidentsDrawer
        isOpen={isAlertsDrawerOpen}
        onClose={() => setIsAlertsDrawerOpen(false)}
        alertTrails={alertTrails}
        onFlyTo={handleFlyToAlertTrail}
        onSelectTrail={onSelectTrail}
        onFilterAlerts={handleToggleAlertFilter}
        isFilterActive={difficultyFilter === 'alert'}
      />

      {/* Floating Difficulty Filter Toolbar (Bottom Left) */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
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
            fontSize: '0.68rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <Filter size={11} color="var(--color-primary)" />
          <span>Cấp độ</span>
        </div>

        <button
          type="button"
          onClick={() => setDifficultyFilter('all')}
          style={{
            background: difficultyFilter === 'all' ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)' : 'transparent',
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
              background: difficultyFilter === 'all' ? 'color-mix(in srgb, var(--color-primary) 22%, transparent)' : 'var(--color-surface-elevated)',
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
            background: difficultyFilter === 'easy' ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)' : 'transparent',
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
          <span>Dễ (1-2)</span>
          <span
            style={{
              fontSize: '0.66rem',
              background: difficultyFilter === 'easy' ? 'color-mix(in srgb, var(--color-primary) 22%, transparent)' : 'var(--color-surface-elevated)',
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
            background: difficultyFilter === 'medium' ? 'color-mix(in srgb, var(--color-sun) 16%, transparent)' : 'transparent',
            color: difficultyFilter === 'medium' ? 'var(--color-sun)' : 'var(--color-text-main)',
            border: difficultyFilter === 'medium' ? '1px solid color-mix(in srgb, var(--color-sun) 45%, transparent)' : '1px solid transparent',
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
              background: difficultyFilter === 'medium' ? 'color-mix(in srgb, var(--color-sun) 22%, transparent)' : 'var(--color-surface-elevated)',
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
            background: difficultyFilter === 'hard' ? 'color-mix(in srgb, var(--color-error) 16%, transparent)' : 'transparent',
            color: difficultyFilter === 'hard' ? 'var(--color-error-text, var(--color-error))' : 'var(--color-text-main)',
            border: difficultyFilter === 'hard' ? '1px solid color-mix(in srgb, var(--color-error) 45%, transparent)' : '1px solid transparent',
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
          <span>Khó (4-5)</span>
          <span
            style={{
              fontSize: '0.66rem',
              background: difficultyFilter === 'hard' ? 'color-mix(in srgb, var(--color-error) 22%, transparent)' : 'var(--color-surface-elevated)',
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
          aria-label="Lọc các địa điểm phát cảnh báo"
          title="Chỉ hiển thị các cung đường đang có cảnh báo sự cố an toàn"
          style={{
            background: difficultyFilter === 'alert'
              ? 'color-mix(in srgb, var(--color-error) 22%, transparent)'
              : alertTrails.length > 0
              ? 'color-mix(in srgb, var(--color-error) 12%, transparent)'
              : 'transparent',
            color: difficultyFilter === 'alert' || alertTrails.length > 0 ? 'var(--color-error-text, var(--color-error))' : 'var(--color-text-muted)',
            border: difficultyFilter === 'alert'
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
          <span>Cảnh Báo</span>
          <span
            style={{
              fontSize: '0.66rem',
              fontWeight: 800,
              background: difficultyFilter === 'alert' ? 'var(--color-error)' : 'color-mix(in srgb, var(--color-error) 20%, transparent)',
              color: difficultyFilter === 'alert' ? 'var(--color-on-danger)' : 'var(--color-error-text, var(--color-error))',
              padding: '1px 5px',
              borderRadius: 3,
            }}
          >
            {alertTrails.length}
          </span>
        </button>

        {/* Wave 9D: Compact Field-Atlas Quick-Filter Pills (High Altitude, Beginner, Active GPS Radius) */}
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
              title="Lọc nhanh các đỉnh núi cao từ 2.500m trở lên"
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
              title="Lọc nhanh cung đường phù hợp người mới (Độ khó cấp 1–2)"
              style={{
                background: beginnerOnly
                  ? 'color-mix(in srgb, var(--color-primary) 18%, transparent)'
                  : 'transparent',
                color: beginnerOnly ? 'var(--color-primary)' : 'var(--color-text-main)',
                border: beginnerOnly
                  ? '1px solid var(--color-border-glow)'
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
              <span>Người Mới (≤2)</span>
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
                aria-label="Lọc bán kính gần vị trí GPS"
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
                  Gần Tôi:
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
                        background: isActiveRadius
                          ? 'var(--color-sky)'
                          : 'transparent',
                        color: isActiveRadius
                          ? 'var(--color-on-primary)'
                          : 'var(--color-text-muted)',
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

      {/* Map Element Container */}
      <div
        style={{
          height: '100%',
          width: '100%',
          borderRadius: 4,
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
        }}
      >
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={zoomLevel}
          minZoom={5.5}
          maxZoom={18}
          maxBounds={[
            [6.8, 100.8],
            [24.5, 115.2],
          ]}
          maxBoundsViscosity={0.9}
          zoomControl={false}
          scrollWheelZoom={effectiveScrollZoom}
          preferCanvas={true}
          style={{ width: '100%', height: '100%', borderRadius: 4 }}
        >
          <CustomMapControls onResetView={handleResetView} />
          <MapController
            selectedTrail={selectedTrail}
            flyToPos={flyToPos}
            flyToZoom={flyToZoom}
            flyTick={flyTick}
            currentTileKey={currentTileKey}
            isLiveTracking={isLiveTracking}
            isScrollZoomUnlocked={effectiveScrollZoom}
            onMapCanvasClick={() => setFocusedTrailId(null)}
            onUnlockScrollZoom={() => setIsScrollZoomUnlocked(true)}
          />

          <FreeBasemapLayer basemap={currentTileKey} />

          {/* Active GPS Proximity Filter Radius Ring (50 / 150 / 300 km) */}
          {userLocation && gpsRadiusKm && !selectedTrail && (
            <Circle
              center={userLocation}
              radius={gpsRadiusKm * 1000}
              pathOptions={{
                color: '#6fa8c7',
                fillColor: '#6fa8c7',
                fillOpacity: 0.06,
                weight: 1.6,
                dashArray: '6, 6',
              }}
            />
          )}

          {/* User GPS Location Accuracy Radius Circle */}
          {userLocation && !isFallbackLocation && gpsAccuracy && gpsAccuracy > 0 && (
            <Circle
              center={userLocation}
              radius={gpsAccuracy}
              pathOptions={{
                color: '#38bdf8',
                fillColor: '#38bdf8',
                fillOpacity: 0.12,
                weight: 1.5,
                dashArray: '4, 4',
              }}
            />
          )}

          {/* User GPS Location Marker (Memoized Icon) */}
          {userLocation && (
            <Marker position={userLocation} icon={userGpsIcon}>
              <Popup>
                <div style={{ padding: 4, minWidth: 168 }}>
                  <div style={{ color: 'var(--color-sky)', fontWeight: 800, fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-sky)', display: 'inline-block' }} />
                    {isFallbackLocation ? 'Vị Trí Tham Khảo (Sa Pa)' : 'Vị Trí Thực Tế (GPS)'}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--color-text-dim)', marginTop: 4 }}>
                    Tọa độ: {userLocation[0].toFixed(5)}, {userLocation[1].toFixed(5)}
                  </div>
                  {!isFallbackLocation && gpsAccuracy && (
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      Độ chính xác: ±{Math.round(gpsAccuracy)}m
                    </div>
                  )}
                  {!isFallbackLocation && (gpsAltitude !== null || gpsSpeed !== null) && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: '0.72rem', color: 'var(--color-primary)' }}>
                      {gpsAltitude !== null && <span>Cao độ: {gpsAltitude}m</span>}
                      {gpsSpeed !== null && <span>Tốc độ: {gpsSpeed} km/h</span>}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )}

          {/* GPX Polylines: Works cleanly for ALL visible trails on homepage & emphasizes active/selected trail */}
          {showGpxTracks &&
            activeGpxTrails.map((trail) => {
              const track = trail.gpxTrack;
              if (!track || track.length < 2) return null;

              const isEmphasized = activeEmphasisTrailId === trail.id || activeGpxTrails.length === 1;
              const diffColor = getDifficultyColor(trail.difficultyLevel);
              const startPos = track[0];
              const endPos = track[track.length - 1];
              const finishIcon = finishIconsByTrailId.get(trail.id);

              if (!isEmphasized) {
                return (
                  <React.Fragment key={`gpx-overview-${trail.id}`}>
                    <Polyline
                      positions={track}
                      pathOptions={{
                        color: '#020617',
                        weight: 5,
                        opacity: 0.45,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                    />
                    <Polyline
                      positions={track}
                      pathOptions={{
                        color: diffColor,
                        weight: 2.8,
                        opacity: 0.85,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                      eventHandlers={{
                        click: () => {
                          setFocusedTrailId(trail.id);
                          onFocusTrail?.(trail);
                        },
                      }}
                    />
                  </React.Fragment>
                );
              }

              return (
                <React.Fragment key={`gpx-active-${trail.id}`}>
                  <Polyline
                    positions={track}
                    pathOptions={{
                      color: '#020617',
                      weight: 7,
                      opacity: 0.75,
                      lineCap: 'round',
                      lineJoin: 'round',
                    }}
                  />
                  <Polyline
                    positions={track}
                    pathOptions={{
                      color: '#10b981',
                      weight: 4,
                      opacity: 1.0,
                      lineCap: 'round',
                      lineJoin: 'round',
                    }}
                    eventHandlers={{
                      click: () => {
                        setFocusedTrailId(trail.id);
                        onFocusTrail?.(trail);
                      },
                    }}
                  />
                  <Polyline
                    positions={track}
                    pathOptions={{
                      color: '#ffffff',
                      weight: 2,
                      opacity: 0.9,
                      dashArray: '6, 10',
                      lineCap: 'round',
                      lineJoin: 'round',
                    }}
                  />
                  {/* Wide transparent hit-target polyline for smooth Map -> Elevation Chart hover sync */}
                  {onHoverTrackIndex && (
                    <Polyline
                      positions={track}
                      pathOptions={{
                        color: '#10b981',
                        weight: 16,
                        opacity: 0.001,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                      eventHandlers={{
                        mousemove: (e) => {
                          handleTrackMouseMove(e.latlng.lat, e.latlng.lng, track);
                        },
                        mouseout: () => {
                          handleTrackMouseOut();
                        },
                        click: () => {
                          setFocusedTrailId(trail.id);
                          onFocusTrail?.(trail);
                        },
                      }}
                    />
                  )}
                  {startPos && (
                    <Marker
                      position={startPos}
                      icon={startFlagIcon}
                      eventHandlers={{
                        click: () => onFocusTrail?.(trail),
                      }}
                    />
                  )}
                  {endPos && finishIcon && (
                    <Marker
                      position={endPos}
                      icon={finishIcon}
                      eventHandlers={{
                        click: () => onFocusTrail?.(trail),
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}

          {/* Focused/Selected Trail Waypoints as crisp pure-SVG markers */}
          {showWaypoints &&
            waypointMarkerData.map(({ wp, key, meta, icon }) => (
              <Marker key={key} position={[Number(wp.lat), Number(wp.lng)]} icon={icon}>
                {canHover && (
                  <Tooltip direction="top" offset={[0, -14]} opacity={0.98}>
                    <div
                      style={{
                        fontFamily: 'var(--font-family)',
                        color: 'var(--color-text-main)',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                      }}
                    >
                      <span>{wp.name}</span>
                      {typeof wp.elevationM === 'number' && (
                        <span style={{ color: 'var(--color-sky)', marginLeft: 5 }}>
                          ({Math.round(wp.elevationM).toLocaleString('vi-VN')}m)
                        </span>
                      )}
                    </div>
                  </Tooltip>
                )}
                <Popup className="custom-leaflet-popup">
                  <div style={{ minWidth: 185, maxWidth: 240, fontFamily: 'var(--font-family)', padding: '2px 0' }}>
                    <div
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: meta.token,
                        marginBottom: 3,
                      }}
                    >
                      {meta.label}
                    </div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 4 }}>
                      {wp.name}
                    </div>
                    {typeof wp.elevationM === 'number' && Number.isFinite(wp.elevationM) && (
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-sky)', marginBottom: 4 }}>
                        Cao độ: {Math.round(wp.elevationM).toLocaleString('vi-VN')}m
                      </div>
                    )}
                    {wp.description && (
                      <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', lineHeight: 1.45, marginBottom: 5 }}>
                        {wp.description}
                      </div>
                    )}
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                      GPS: {Number(wp.lat).toFixed(5)}, {Number(wp.lng).toFixed(5)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

          {/* Community Field POIs (Water / Camp / 4G Signal / Danger / Viewpoint) */}
          {showWaypoints &&
            fieldPoiMarkerData.map(({ poi, meta, icon }) => {
              const isDryOrClosed = poi.status === 'dry_or_closed';
              return (
                <Marker key={`poi-${poi.id}`} position={[Number(poi.lat), Number(poi.lng)]} icon={icon}>
                  {canHover && (
                    <Tooltip direction="top" offset={[0, -13]} opacity={0.98}>
                      <div
                        style={{
                          fontFamily: 'var(--font-family)',
                          color: 'var(--color-text-main)',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                        }}
                      >
                        <span>{poi.title}</span>
                        {isDryOrClosed && (
                          <span style={{ color: 'var(--color-error-text, var(--color-error))', marginLeft: 5 }}>
                            (Đã cạn / Đóng)
                          </span>
                        )}
                      </div>
                    </Tooltip>
                  )}
                  <Popup className="custom-leaflet-popup">
                    <div style={{ minWidth: 190, maxWidth: 250, fontFamily: 'var(--font-family)', padding: '2px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: meta.token,
                          }}
                        >
                          POI · {meta.label}
                        </span>
                        <span
                          style={{
                            fontSize: '0.64rem',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: 3,
                            background: isDryOrClosed
                              ? 'color-mix(in srgb, var(--color-error) 16%, transparent)'
                              : 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
                            color: isDryOrClosed
                              ? 'var(--color-error-text, var(--color-error))'
                              : 'var(--color-primary)',
                          }}
                        >
                          {isDryOrClosed ? 'Đã cạn / Đóng' : 'Hoạt động'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 4 }}>
                        {poi.title}
                      </div>
                      {poi.notes && (
                        <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', lineHeight: 1.45, marginBottom: 5 }}>
                          {poi.notes}
                        </div>
                      )}
                      <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                        GPS: {Number(poi.lat).toFixed(5)}, {Number(poi.lng).toFixed(5)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

          {/* SVG Mountain Teardrop Markers — Clustered cleanly at national zoom, touch-safe (Tooltip only on hover devices) */}
          {(() => {
            const markerNodes = trailMarkerData.map(({ trail, tid, matchingIncident, icon }) => (
              <Marker
                key={tid}
                position={[trail.startLat, trail.startLng]}
                icon={icon}
                eventHandlers={{
                  click: () => {
                    setFocusedTrailId(tid);
                    onFocusTrail?.(trail);
                  },
                }}
              >
                {canHover && (
                  <Tooltip
                    direction="auto"
                    offset={[0, -25]}
                    opacity={1}
                    className="tactical-leaflet-tooltip"
                  >
                    <TacticalTrailTooltip
                      trail={trail}
                      incident={matchingIncident}
                    />
                  </Tooltip>
                )}
                <Popup className="custom-leaflet-popup">
                  <TrailPopupContent
                    trail={trail}
                    incident={matchingIncident}
                    onSelect={() => onSelectTrail?.(trail)}
                  />
                </Popup>
              </Marker>
            ));

            if (!selectedTrail && trailMarkerData.length > 1) {
              return (
                <MarkerClusterGroup
                  chunkedLoading
                  disableClusteringAtZoom={11}
                  maxClusterRadius={46}
                  showCoverageOnHover={false}
                  iconCreateFunction={createClusterCustomIcon}
                >
                  {markerNodes}
                </MarkerClusterGroup>
              );
            }
            return markerNodes;
          })()}

          {/* Live Recorded GPS Breadcrumb Polyline */}
          {recordedTrackPositions.length >= 2 && (
            <Polyline
              positions={recordedTrackPositions}
              pathOptions={{ color: '#22d3ee', weight: 4, opacity: 0.95, dashArray: '6 4' }}
            />
          )}

          {/* 2-Way Synced Elevation Chart Hover Dot */}
          {highlightedPoint && (
            <CircleMarker
              center={highlightedPoint}
              radius={8}
              pathOptions={{
                color: '#ffffff',
                weight: 3,
                fillColor: '#d97706',
                fillOpacity: 1,
              }}
            />
          )}
        </MapContainer>

        {/* Empty Filter Result HUD Overlay */}
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
              Không có cung đường khớp bộ lọc hiện tại
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
              Hiện tất cả
            </button>
          </div>
        )}

        {/* Off-Trail Alarm & GPS Recording HUD Overlay (Positioned ABOVE bottom-left difficulty bar to prevent collision) */}
        {(offTrailMeters !== null || recordedTrack.length >= 2) && (
          <div
            style={{
              position: 'absolute',
              bottom: 62,
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
                <AlertTriangle size={18} color="var(--color-on-danger)" />
                <div>
                  <div>CẢNH BÁO LỆCH TUYẾN GPX (+{offTrailMeters}m)!</div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.92 }}>
                    Quay lại đường mòn chính theo tuyến xanh trên bản đồ.
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
                    a.download = `lost-recorded-${Date.now()}.gpx`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                    onShowToast?.('Đã xuất file GPX lộ trình thực địa của bạn!', 'success');
                  }}
                  style={{ padding: '4px 10px', fontSize: '0.72rem', borderRadius: 4 }}
                >
                  Xuất GPX
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Real 3D Terrain WebGL Modal (Lazy Loaded) */}
      {isTerrain3DOpen && selectedTrail && (
        <Suspense fallback={null}>
          <Terrain3DModal
            trail={selectedTrail}
            isOpen={isTerrain3DOpen}
            onClose={() => setIsTerrain3DOpen(false)}
          />
        </Suspense>
      )}

      {/* Responsive GPS Nearby Overlay Card */}
      {gpsToast && (
        <div
          style={{
            position: 'absolute',
            bottom: 62,
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--color-border)', gap: 6, flexWrap: 'wrap' }}>
            <div style={{ color: gpsToast.isFallback ? 'var(--color-sun)' : 'var(--color-sky)', fontWeight: 800, fontSize: '0.8rem' }}>
              {gpsToast.isFallback ? 'Tham Khảo (Sa Pa)' : 'Định Vị GPS'} [{gpsToast.lat.toFixed(4)}, {gpsToast.lng.toFixed(4)}]
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
                Thử lại GPS
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
                aria-label="Đóng thẻ GPS"
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
            <div style={{ fontSize: '0.76rem', color: 'var(--color-primary)', fontWeight: 700, marginBottom: 8, background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', padding: '5px 8px', borderRadius: 4 }}>
              {gpsToast.geocodedAddress}
            </div>
          )}

          {gpsToast.nearby.length > 0 ? (
            <div>
              <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginBottom: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z" /></svg>
                  <span>Cung đường gần nhất:</span>
                </span>
                <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>{gpsToast.nearby.length} cung</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 210, overflowY: 'auto' }}>
                {gpsToast.nearby.map((t) => {
                  const diffInfo = getDifficultyInfo(t.difficultyLevel);
                  const trailMeta = t as TrailWithMeta;
                  const dist = trailMeta.distanceFromUserKm;
                  const roadDist = trailMeta.roadDistanceKm || trailMeta.estimatedRoadDistanceKm || (dist ? Math.round(dist * 1.8) : null);
                  const duration = trailMeta.travelDurationFormatted;
                  return (
                    <div
                      key={t.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setFocusedTrailId(t.id);
                        onFocusTrail?.(t);
                        setFlyToPos([t.startLat, t.startLng]);
                        setFlyTick((n) => n + 1);
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
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: diffInfo.token, flexShrink: 0 }} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.name}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', paddingLeft: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
                            title={dist ? `Đường bộ ước tính: ~${roadDist} km (Chim bay: ~${dist} km)` : undefined}
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
              Không tìm thấy cung đường nào trong phạm vi lân cận.
            </div>
          )}
        </div>
      )}
    </div>
  );
});
