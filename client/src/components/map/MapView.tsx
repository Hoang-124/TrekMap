import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Trail } from '../../types.js';
import { fetchNearbyTrails, reverseGeocode } from '../../services/api.js';

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

// Fix default leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Helper for trail difficulty color scheme
export const getDifficultyColor = (difficulty: number) => {
  const diff = Number(difficulty) || 3;
  if (diff >= 4) return '#ef4444'; // Red (Khó - Level 4, 5)
  if (diff === 3) return '#ffd600'; // Bright Vivid Yellow (Trung Bình - Level 3)
  return '#10b981'; // Fresh Emerald Green (Dễ - Level 1, 2)
};

export const getDifficultyInfo = (difficulty: number) => {
  const diff = Number(difficulty) || 3;
  if (diff >= 4) {
    return {
      color: '#ef4444',
      glow: 'rgba(239, 68, 68, 0.8)',
      label: 'Khó',
    };
  }
  if (diff === 3) {
    return {
      color: '#ffd600',
      glow: 'rgba(255, 214, 0, 0.85)',
      label: 'Trung Bình',
    };
  }
  return {
    color: '#10b981',
    glow: 'rgba(16, 185, 129, 0.8)',
    label: 'Dễ',
  };
};

// Super lightweight SVG Teardrop Pin with white border & center dot (Google Maps style)
export const createTrailSvgIcon = (trail: Trail, incident?: any) => {
  const diffInfo = getDifficultyInfo(trail.difficultyLevel);

  const hasAlert = !!incident;
  const severity = incident?.severity || 'high';
  const alertColor = severity === 'critical' ? '#ef4444' : severity === 'high' ? '#f97316' : '#eab308';

  const alertBadgeHtml = hasAlert ? `
    <div class="trail-pin-alert-badge" style="
      position: absolute;
      top: -6px;
      right: -7px;
      width: 20px;
      height: 20px;
      background: ${alertColor};
      border: 2.2px solid #ffffff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 14px ${alertColor}, 0 3px 8px rgba(0, 0, 0, 0.85);
      z-index: 50;
      pointer-events: none;
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    ">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="13"/>
        <circle cx="12" cy="18" r="1.5" fill="#ffffff" stroke="none"/>
      </svg>
    </div>
  ` : '';

  const alertTooltipHtml = hasAlert ? `
    <div style="
      margin-top: 4px;
      padding: 3px 6px;
      background: rgba(239, 68, 68, 0.25);
      border: 1px solid ${alertColor};
      border-radius: 5px;
      color: #fecaca;
      font-size: 9.5px;
      font-weight: 700;
      line-height: 1.2;
      text-align: left;
      display: flex;
      align-items: center;
      gap: 4px;
    ">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${alertColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span>Cảnh báo: ${incident.description || 'Có sự cố an toàn trên cung đường'}</span>
    </div>
  ` : '';

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
      <!-- Teardrop Map Pin SVG matching user reference photo -->
      <svg class="trail-teardrop-svg" width="30" height="40" viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="
        filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.75)) drop-shadow(0 0 8px ${hasAlert ? alertColor : diffInfo.glow});
        transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        overflow: visible;
        position: relative;
        z-index: 1;
      ">
        <!-- Teardrop Shape with Color categorized by Difficulty -->
        <path
          d="M15 1.5C7.5 1.5 1.5 7.5 1.5 15C1.5 24.8 13.6 36.8 14.5 37.7C14.8 38 15.2 38 15.5 37.7C16.4 36.8 28.5 24.8 28.5 15C28.5 7.5 22.5 1.5 15 1.5Z"
          fill="${diffInfo.color}"
          stroke="#ffffff"
          stroke-width="2.4"
          stroke-linejoin="round"
        />

        <!-- Inner White Circle Core (like reference photo) -->
        <circle cx="15" cy="15" r="5.2" fill="#ffffff" />
      </svg>

      <!-- Alert Badge directly overlaying the pin in front -->
      ${alertBadgeHtml}

      <!-- Pure CSS Hover Tooltip (Only visible on hover) -->
      <div class="trail-pin-hover-tooltip">
        <div style="font-size: 12px; font-weight: 800; color: #ffffff; line-height: 1.2;">
          ${trail.name}
        </div>
        <div style="font-size: 10px; font-weight: 700; color: ${diffInfo.color}; margin-top: 3px; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <span>● Cấp ${diffInfo.label} (${trail.difficultyLevel}/5)</span>
          <span style="display: inline-flex; align-items: center; gap: 2px;">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>
            ${trail.maxAltitudeM}m
          </span>
        </div>
        <div style="font-size: 9.5px; color: #94a3b8; margin-top: 2px; display: flex; align-items: center; justify-content: center; gap: 3px;">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>${trail.province}${trail.district ? `, ${trail.district}` : ''}</span>
        </div>
        ${alertTooltipHtml}
      </div>
    </div>
  `;

  return L.divIcon({
    html: customSvg,
    className: 'custom-trail-svg-marker',
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -40],
  });
};

// User GPS Pulse Location Marker Icon Helper
const createUserGpsIcon = () => {
  const customSvg = `
    <div style="
      position: relative;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        position: absolute;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: rgba(56, 189, 248, 0.35);
        border: 1.5px solid #38bdf8;
      "></div>
      <div style="
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #38bdf8;
        border: 3px solid #ffffff;
        box-shadow: 0 0 14px #38bdf8;
      "></div>
    </div>
  `;

  return L.divIcon({
    html: customSvg,
    className: 'user-gps-marker',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19],
  });
};

// Start & Finish Peak Marker Icon Helper for GPX Polylines (Sleek Strava/AllTrails Style)
const createStartEndIcon = (type: 'start' | 'finish', label?: string) => {
  const isStart = type === 'start';
  const color = isStart ? '#10b981' : '#f59e0b';
  const iconSvg = isStart
    ? '<svg width="8" height="8" viewBox="0 0 24 24" fill="#10b981"><circle cx="12" cy="12" r="10"/></svg>'
    : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';
  const text = label || (isStart ? 'Khởi hành' : 'Đỉnh');

  const html = `
    <div class="marker-hover-anim" style="
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(8px);
      border: 1px solid ${color};
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      border-radius: 12px;
      padding: 2px 7px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
      line-height: 1.2;
    ">
      <span style="display: flex; align-items: center;">${iconSvg}</span>
      <span style="letter-spacing: 0.2px;">${text}</span>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'start-finish-marker',
    iconSize: [70, 20],
    iconAnchor: [35, 24],
  });
};

export const createWaypointIcon = (type: string) => {
  let badgeColor = '#4ade80';
  let bgGlow = 'rgba(74, 222, 128, 0.4)';
  let iconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

  if (type === 'campsite') {
    badgeColor = '#38bdf8';
    bgGlow = 'rgba(56, 189, 248, 0.4)';
    iconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 20 10 4"/><path d="m5 20 9-16"/><path d="M3 20h18"/><path d="m12 15-3 5h6z"/></svg>';
  } else if (type === 'water') {
    badgeColor = '#22d3ee';
    bgGlow = 'rgba(34, 211, 238, 0.4)';
    iconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>';
  } else if (type === 'viewpoint') {
    badgeColor = '#facc15';
    bgGlow = 'rgba(250, 204, 21, 0.4)';
    iconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';
  } else if (type === 'danger') {
    badgeColor = '#ef4444';
    bgGlow = 'rgba(239, 68, 68, 0.4)';
    iconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  }

  const html = `
    <div class="marker-hover-anim" style="
      background: rgba(15, 24, 46, 0.94);
      backdrop-filter: blur(12px);
      border: 1.5px solid ${badgeColor};
      border-radius: 50%;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 10px ${bgGlow};
      cursor: pointer;
    ">
      ${iconSvg}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'waypoint-marker',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
};

// Rich Interactive Trail Popup with Live Realtime Weather & Safety Alert
export const TrailPopupContent: React.FC<{ trail: Trail; incident?: any; onSelect: () => void }> = ({ trail, incident, onSelect }) => {
  const [weather, setWeather] = useState<{ temp: number; condition: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchWeather = async () => {
      try {
        const res = await fetch(`/api/weather/forecast?lat=${trail.startLat}&lng=${trail.startLng}`);
        const json = await res.json();
        if (isMounted && json.success && json.data && json.data.length > 0) {
          const today = json.data[0];
          const condMap: Record<string, string> = {
            clear: 'Trời trong',
            cloudy: 'Nhiều mây',
            foggy: 'Sương mù',
            rainy: 'Mưa rào',
            storm: 'Bão dông',
          };
          setWeather({
            temp: Math.round((today.tempMinC + today.tempMaxC) / 2),
            condition: condMap[today.weatherCondition] || 'Thời tiết tốt',
          });
        }
      } catch (err) {}
    };
    fetchWeather();
    return () => {
      isMounted = false;
    };
  }, [trail.startLat, trail.startLng]);

  const severity = incident?.severity || 'high';
  const alertColor = severity === 'critical' ? '#ef4444' : severity === 'high' ? '#f97316' : '#eab308';

  return (
    <div style={{ width: 250, padding: '4px 2px' }}>
      <div
        style={{
          position: 'relative',
          height: 120,
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 10,
        }}
      >
        <img
          src={trail.coverImage}
          alt={trail.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: getDifficultyColor(trail.difficultyLevel),
            color: '#030a0e',
            fontWeight: 800,
            fontSize: '0.72rem',
            padding: '2px 8px',
            borderRadius: 10,
          }}
        >
          Mức khó: {trail.difficultyLevel}/5
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            background: 'rgba(3, 10, 14, 0.85)',
            color: '#00ffd5',
            fontWeight: 700,
            fontSize: '0.72rem',
            padding: '2px 8px',
            borderRadius: 10,
            backdropFilter: 'blur(8px)',
          }}
        >
          {trail.region}
        </div>
      </div>

      <h4
        style={{
          margin: '0 0 6px 0',
          fontSize: '0.98rem',
          fontWeight: 800,
          color: '#f8fafc',
          lineHeight: 1.3,
        }}
      >
        {trail.name}
      </h4>

      {/* ⚠️ Incident Warning Alert Banner */}
      {incident && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.2)',
            border: `1.5px solid ${alertColor}`,
            borderRadius: 8,
            padding: '7px 9px',
            marginBottom: 8,
            lineHeight: 1.35,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, color: alertColor, fontSize: '0.78rem' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>Cảnh Báo Thực Địa</span>
            </span>
            <span style={{
              fontSize: '0.62rem',
              background: alertColor,
              color: '#ffffff',
              padding: '1px 5px',
              borderRadius: 4,
              fontWeight: 800,
              textTransform: 'uppercase'
            }}>
              {severity === 'critical' ? 'Khẩn cấp SOS' : severity === 'high' ? 'Nguy cấp' : 'Chú ý'}
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#fca5a5' }}>
            {incident.description}
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 4,
          background: 'rgba(7, 13, 30, 0.6)',
          padding: '6px 8px',
          borderRadius: 8,
          textAlign: 'center',
          marginBottom: 8,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Độ dài</div>
          <strong style={{ fontSize: '0.78rem', color: '#4ade80' }}>{trail.distanceKm}km</strong>
        </div>
        <div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Tích lũy</div>
          <strong style={{ fontSize: '0.78rem', color: '#f97316' }}>+{trail.elevationGainM}m</strong>
        </div>
        <div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Thời gian</div>
          <strong style={{ fontSize: '0.78rem', color: '#facc15' }}>{trail.durationDays}N</strong>
        </div>
      </div>

      {weather && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 8,
            padding: '4px 10px',
            fontSize: '0.74rem',
            color: '#38bdf8',
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          <span>{weather.condition}</span>
          <span>{weather.temp}°C</span>
        </div>
      )}

      <button
        type="button"
        onClick={onSelect}
        style={{
          width: '100%',
          background: 'linear-gradient(135deg, #00ffd5 0%, #10b981 100%)',
          color: '#030a0e',
          border: 'none',
          borderRadius: 8,
          padding: '8px 10px',
          fontWeight: 800,
          fontSize: '0.78rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          boxShadow: '0 4px 14px rgba(0, 255, 213, 0.3)',
        }}
      >
        <span>Xem Chi Tiết Cung Đường →</span>
      </button>
    </div>
  );
};

export interface MapViewProps {
  trails: Trail[];
  selectedTrail?: Trail | null;
  onSelectTrail?: (trail: Trail) => void;
  incidents?: any[];
  height?: string;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

// Map Tile Providers (ToS-compliant open-source tile layers)
const TILE_PROVIDERS = {
  satellite: {
    name: 'Vệ Tinh (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and GIS User Community',
  },
  terrain: {
    name: 'Địa Hình (OpenTopoMap)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
  },
  roadmap: {
    name: 'Đường Phố (OpenStreetMap)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
};

// Controller to auto-center map when selected trail changes or user locates and preserve zoom/center on tile switch
const MapController: React.FC<{
  selectedTrail?: Trail | null;
  flyToPos?: [number, number] | null;
  currentTileKey?: string;
}> = ({ selectedTrail, flyToPos, currentTileKey }) => {
  const map = useMap();
  const prevTileRef = useRef(currentTileKey);

  // Invalidate map size on mount and window resize to eliminate tile gaps
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
      map.flyTo(flyToPos, 13, { duration: 1.5 });
    } else if (selectedTrail) {
      map.flyTo([selectedTrail.startLat, selectedTrail.startLng], 12, { duration: 1.5 });
    } else {
      map.flyTo([16.0470, 108.2062], 6, { duration: 1.2 });
    }
  }, [selectedTrail, flyToPos, map]);

  // Keep center and zoom persistent when changing map tile layers
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

export const MapView: React.FC<MapViewProps> = ({
  trails,
  selectedTrail,
  onSelectTrail,
  incidents = [],
  height = '100%',
  onShowToast,
}) => {
  const [currentTileKey, setCurrentTileKey] = useState<keyof typeof TILE_PROVIDERS>('satellite');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [flyToPos, setFlyToPos] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isTileDropdownOpen, setIsTileDropdownOpen] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [showGpxTracks, setShowGpxTracks] = useState(true);
  const [gpsToast, setGpsToast] = useState<{
    lat: number;
    lng: number;
    nearby: Trail[];
    geocodedAddress?: string;
  } | null>(null);

  const centerLat = selectedTrail ? selectedTrail.startLat : 16.0470;
  const centerLng = selectedTrail ? selectedTrail.startLng : 108.2062;
  const zoomLevel = selectedTrail ? 12 : 6;

  // Memoize filtered trails calculation for 60 FPS performance
  const filteredTrails = useMemo(() => {
    return trails.filter((trail) => {
      if (difficultyFilter === 'easy') return trail.difficultyLevel <= 2;
      if (difficultyFilter === 'medium') return trail.difficultyLevel === 3;
      if (difficultyFilter === 'hard') return trail.difficultyLevel >= 4;
      return true;
    });
  }, [trails, difficultyFilter]);

  const currentTile = TILE_PROVIDERS[currentTileKey];

  const handleLocateMe = async () => {
    setIsLocating(true);
    
    const performSpatialSearch = async (lat: number, lng: number) => {
      const coords: [number, number] = [lat, lng];
      setUserLocation(coords);
      setFlyToPos(coords);
      setIsLocating(false);

      try {
        const [nearby, geoData] = await Promise.all([
          fetchNearbyTrails(lat, lng, 4),
          reverseGeocode(lat, lng),
        ]);
        setGpsToast({
          lat,
          lng,
          nearby: nearby || [],
          geocodedAddress: geoData?.formattedAddress || geoData?.displayName,
        });
        if (onShowToast) {
          onShowToast('Đã xác định vị trí GPS thực tế của bạn!', 'info');
        }
      } catch (err) {
        setGpsToast({ lat, lng, nearby: [] });
      }
    };

    if (!navigator.geolocation) {
      if (onShowToast) {
        onShowToast('Trình duyệt không hỗ trợ GPS Geolocation', 'error');
      }
      performSpatialSearch(22.3364, 103.8438);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        performSpatialSearch(position.coords.latitude, position.coords.longitude);
      },
      () => {
        if (onShowToast) {
          onShowToast('Không thể lấy vị trí GPS chính xác, hiển thị vị trí mặc định', 'info');
        }
        performSpatialSearch(22.3364, 103.8438);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Memoize active trails to render GPX track polylines for
  const activeGpxTrails = useMemo(() => {
    return selectedTrail
      ? [selectedTrail]
      : filteredTrails.filter((t) => t.gpxTrack && t.gpxTrack.length > 0);
  }, [selectedTrail, filteredTrails]);

  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: 24, overflow: 'hidden' }}>
      {/* Floating Control Bar */}
      <div style={{
        position: 'absolute',
        top: 18,
        right: 18,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--color-bg-glass)',
        backdropFilter: 'blur(16px)',
        padding: '6px 10px',
        borderRadius: 30,
        border: '1px solid var(--color-border)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
      }}>
        {/* GPX Track Toggle Button */}
        <button
          onClick={() => setShowGpxTracks(!showGpxTracks)}
          style={{
            background: showGpxTracks
              ? 'rgba(74, 222, 128, 0.18)'
              : 'rgba(255, 255, 255, 0.05)',
            color: showGpxTracks ? 'var(--color-primary)' : 'var(--color-text-dim)',
            border: '1px solid rgba(74, 222, 128, 0.4)',
            borderRadius: 24,
            padding: '8px 14px',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-bold)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <Activity size={15} color={showGpxTracks ? 'var(--color-primary)' : 'var(--color-text-dim)'} />
          <span>{showGpxTracks ? 'Đường GPX' : 'Tắt GPX'}</span>
        </button>

        {/* Locate Me GPS Button */}
        <button
          onClick={handleLocateMe}
          disabled={isLocating}
          style={{
            background: 'linear-gradient(135deg, var(--color-sky) 0%, #0284c7 100%)',
            color: '#041108',
            border: 'none',
            borderRadius: 24,
            padding: '8px 16px',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-extrabold)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: 'var(--shadow-sky)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <span>{isLocating ? 'Đang định vị...' : 'Định vị của tôi'}</span>
        </button>

        {/* Tile Layer Selector Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsTileDropdownOpen(!isTileDropdownOpen)}
            style={{
              background: 'var(--color-bg-main)',
              color: 'var(--color-text-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 24,
              padding: '8px 14px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s ease',
            }}
          >
            <Layers size={16} color="var(--color-primary)" />
            <span>{currentTile.name}</span>
            <ChevronDown size={14} />
          </button>

          {isTileDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              right: 0,
              background: 'var(--color-bg-card)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--color-border-glow)',
              borderRadius: 18,
              padding: 8,
              boxShadow: 'var(--shadow-card)',
              minWidth: 220,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              zIndex: 1001,
            }}>
              {(Object.keys(TILE_PROVIDERS) as Array<keyof typeof TILE_PROVIDERS>).map((key) => {
                const isSelected = key === currentTileKey;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setCurrentTileKey(key);
                      setIsTileDropdownOpen(false);
                    }}
                    style={{
                      background: isSelected ? 'rgba(74, 222, 128, 0.18)' : 'transparent',
                      color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      border: 'none',
                      borderRadius: 12,
                      padding: '10px 14px',
                      fontSize: '0.82rem',
                      fontWeight: isSelected ? 800 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{TILE_PROVIDERS[key].name}</span>
                    {isSelected && <Check size={14} color="var(--color-primary)" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Difficulty Filter Toolbar (Bottom Left) */}
      <div style={{
        position: 'absolute',
        bottom: 24,
        left: 18,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'var(--color-bg-glass)',
        backdropFilter: 'blur(20px)',
        padding: '6px 10px',
        borderRadius: 30,
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-header)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 6, borderRight: '1px solid var(--color-border)' }}>
          <Filter size={14} color="var(--color-primary)" />
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-dim)' }}>Lọc:</span>
        </div>
        <button
          onClick={() => setDifficultyFilter('all')}
          style={{
            background: difficultyFilter === 'all' ? 'rgba(74, 222, 128, 0.25)' : 'transparent',
            color: difficultyFilter === 'all' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            border: 'none',
            borderRadius: 16,
            padding: '5px 12px',
            fontSize: '0.78rem',
            fontWeight: difficultyFilter === 'all' ? 800 : 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Tất cả
        </button>
        <button
          onClick={() => setDifficultyFilter('easy')}
          style={{
            background: difficultyFilter === 'easy' ? 'rgba(16, 185, 129, 0.22)' : 'transparent',
            color: difficultyFilter === 'easy' ? '#10b981' : 'var(--color-text-muted)',
            border: difficultyFilter === 'easy' ? '1px solid #10b981' : '1px solid transparent',
            borderRadius: 16,
            padding: '5px 12px',
            fontSize: '0.78rem',
            fontWeight: difficultyFilter === 'easy' ? 800 : 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ color: '#10b981', marginRight: 4, fontWeight: 900 }}>●</span> Dễ (1-2)
        </button>
        <button
          onClick={() => setDifficultyFilter('medium')}
          style={{
            background: difficultyFilter === 'medium' ? 'rgba(255, 214, 0, 0.22)' : 'transparent',
            color: difficultyFilter === 'medium' ? '#ffd600' : 'var(--color-text-muted)',
            border: difficultyFilter === 'medium' ? '1px solid #ffd600' : '1px solid transparent',
            borderRadius: 16,
            padding: '5px 12px',
            fontSize: '0.78rem',
            fontWeight: difficultyFilter === 'medium' ? 800 : 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ color: '#ffd600', marginRight: 4, fontWeight: 900 }}>●</span> Trung Bình (3)
        </button>
        <button
          onClick={() => setDifficultyFilter('hard')}
          style={{
            background: difficultyFilter === 'hard' ? 'rgba(239, 68, 68, 0.22)' : 'transparent',
            color: difficultyFilter === 'hard' ? '#ef4444' : 'var(--color-text-muted)',
            border: difficultyFilter === 'hard' ? '1px solid #ef4444' : '1px solid transparent',
            borderRadius: 16,
            padding: '5px 12px',
            fontSize: '0.78rem',
            fontWeight: difficultyFilter === 'hard' ? 800 : 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ color: '#ef4444', marginRight: 4, fontWeight: 900 }}>●</span> Khó (4-5)
        </button>
      </div>

      {/* Map Element Container */}
      <div style={{
        height: '100%',
        width: '100%',
        borderRadius: 24,
        overflow: 'hidden',
        border: '1px solid var(--color-border)',
      }}>
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={zoomLevel}
          scrollWheelZoom={true}
          preferCanvas={true}
          style={{ width: '100%', height: '100%', borderRadius: 24 }}
        >
          <MapController selectedTrail={selectedTrail} flyToPos={flyToPos} currentTileKey={currentTileKey} />

          <TileLayer
            key={currentTileKey}
            attribution={currentTile.attribution}
            url={currentTile.url}
          />

          {/* User GPS Location Marker */}
          {userLocation && (
            <Marker position={userLocation} icon={createUserGpsIcon()}>
              <Popup>
                <div style={{ padding: 4 }}>
                  <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    Vị Trí Thực Tế Của Bạn
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>
                    Tọa độ: {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Ultra-Sleek Strava/AllTrails Style Dual-Layer GPX Polylines (Rendered ONLY for Selected Trail) */}
          {showGpxTracks &&
            activeGpxTrails
              .filter((trail) => selectedTrail && selectedTrail.id === trail.id)
              .map((trail) => {
                const track = trail.gpxTrack;
                if (!track || track.length === 0) return null;

                const startPos = track[0];
                const endPos = track[track.length - 1];

                return (
                  <React.Fragment key={`gpx-group-${trail.id}`}>
                    {/* Layer 1: Dark Outline Halo for High Contrast against Satellite Terrain */}
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
                    {/* Layer 2: Sleek Core Track Line (Clickable to open TrailDetailView) */}
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
                        click: () => onSelectTrail?.(trail),
                      }}
                    />
                    {/* Layer 3: Accent Vector Dash for Selected Track */}
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
                      eventHandlers={{
                        click: () => onSelectTrail?.(trail),
                      }}
                    />
                    {/* Start Flag Marker at gpxTrack[0] */}
                    {startPos && (
                      <Marker
                        position={startPos}
                        icon={createStartEndIcon('start', 'Xuất phát')}
                        eventHandlers={{
                          click: () => onSelectTrail?.(trail),
                        }}
                      />
                    )}
                    {/* Summit Finish Flag Marker at gpxTrack[last] */}
                    {endPos && (
                      <Marker
                        position={endPos}
                        icon={createStartEndIcon('finish', `${trail.maxAltitudeM}m`)}
                        eventHandlers={{
                          click: () => onSelectTrail?.(trail),
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}

          {/* SVG Mountain Teardrop Markers with Integrated Warning Badges */}
          {filteredTrails.map((trail) => {
            const tid = trail.id || (trail as any)._id;
            const matchingIncident = incidents?.find((inc) => {
              if (!inc) return false;
              if (inc.trailId && (inc.trailId === tid || inc.trailId === trail.id)) return true;
              if (inc.trailName && trail.name) {
                const normInc = inc.trailName.toLowerCase().replace(/[^a-z0-9]/g, '');
                const normTrail = trail.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (normInc.includes(normTrail) || normTrail.includes(normInc)) return true;
              }
              return false;
            });

            return (
              <Marker
                key={tid}
                position={[trail.startLat, trail.startLng]}
                icon={createTrailSvgIcon(trail, matchingIncident)}
                eventHandlers={{
                  click: () => onSelectTrail?.(trail),
                }}
              >
                <Popup className="custom-leaflet-popup">
                  <TrailPopupContent
                    trail={trail}
                    incident={matchingIncident}
                    onSelect={() => onSelectTrail?.(trail)}
                  />
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Organic Nature GPS Toast Notification Card Overlay */}
      {gpsToast && (
        <div style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          zIndex: 1050,
          width: 350,
          background: 'var(--color-bg-glass)',
          backdropFilter: 'blur(20px)',
          border: '1.5px solid var(--color-border)',
          borderRadius: 20,
          padding: 16,
          boxShadow: 'var(--shadow-card)',
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-sky)', fontWeight: 800, fontSize: '0.88rem' }}>
              <span>Định Vị GPS [ {gpsToast.lat.toFixed(4)}, {gpsToast.lng.toFixed(4)} ]</span>
            </div>
            <button
              onClick={() => setGpsToast(null)}
              style={{
                background: 'var(--color-border)',
                border: 'none',
                color: 'var(--color-text-muted)',
                borderRadius: 6,
                padding: '2px 8px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Đóng
            </button>
          </div>

          {gpsToast.geocodedAddress && (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: 700, marginBottom: 8, background: 'rgba(74, 222, 128, 0.12)', padding: '4px 8px', borderRadius: 6 }}>
              {gpsToast.geocodedAddress}
            </div>
          )}

          {gpsToast.nearby.length > 0 ? (
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>
                  <span>Cung đường gần bạn nhất:</span>
                </span>
                <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>{gpsToast.nearby.length} cung đường</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                {gpsToast.nearby.map((t) => {
                  const color = getDifficultyColor(t.difficultyLevel);
                  const diffInfo = getDifficultyInfo(t.difficultyLevel);
                  const dist = (t as any).distanceFromUserKm;
                  const roadDist = (t as any).roadDistanceKm || (t as any).estimatedRoadDistanceKm || (dist ? Math.round(dist * 1.8) : null);
                  const duration = (t as any).travelDurationFormatted;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        onSelectTrail?.(t);
                        setFlyToPos([t.startLat, t.startLng]);
                      }}
                      style={{
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 12,
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-glow)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflow: 'hidden', marginRight: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }}></div>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.name}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', paddingLeft: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                            {t.province}
                          </span>
                          <span>•</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>
                            {t.maxAltitudeM}m
                          </span>
                          <span>•</span>
                          <span>Cấp {diffInfo.label}</span>
                        </div>
                      </div>
                      
                      {roadDist && (
                        <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          <span
                            title={dist ? `Khoảng cách đường bộ di chuyển thực tế: ~${roadDist} km (Đường chim bay: ~${dist} km)` : undefined}
                            style={{
                              fontSize: '0.78rem',
                              color: 'var(--color-sky)',
                              fontWeight: 800,
                              background: 'rgba(56, 189, 248, 0.16)',
                              padding: '3px 8px',
                              borderRadius: 8,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.7 2 11 2 11.4V16c0 .6.4 1 1 1h2" />
                              <circle cx="7" cy="17" r="2" />
                              <path d="M9 17h6" />
                              <circle cx="17" cy="17" r="2" />
                            </svg>
                            ~{roadDist} km
                          </span>
                          {duration && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>
                              ~{duration} đi xe
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
              Đang xác định các cung đường trekking gần nhất...
            </div>
          )}
        </div>
      )}
    </div>
  );
};
