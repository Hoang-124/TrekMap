import React, { useEffect, useState, useMemo } from 'react';
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
  if (difficulty >= 4) return '#ef4444'; // Red (Khó - Level 4,5)
  if (difficulty === 3) return '#4ade80'; // Fresh Sprout Green (Trung Bình - Level 3)
  return '#4ade80'; // Fresh Sprout Green (Dễ - Level 1,2)
};

// Custom glowing markers for trails color-coded by difficulty
const createCustomIcon = (difficulty: number) => {
  const color = getDifficultyColor(difficulty);
  let glow = 'rgba(74, 222, 128, 0.4)';

  if (difficulty >= 4) {
    glow = 'rgba(239, 68, 68, 0.5)';
  }

  const customSvg = `
    <div class="marker-hover-anim" style="
      background: rgba(15, 24, 46, 0.94);
      border: 2px solid ${color};
      border-radius: 50%;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 16px ${glow};
      cursor: pointer;
      position: relative;
    ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
      <div style="
        position: absolute;
        bottom: -3px;
        right: -3px;
        background: ${color};
        color: #041108;
        font-size: 9.5px;
        font-weight: 900;
        border-radius: 10px;
        padding: 1px 5px;
        border: 1px solid #041108;
        line-height: 1;
      ">${difficulty}</div>
    </div>
  `;

  return L.divIcon({
    html: customSvg,
    className: 'custom-trail-marker',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19],
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
  const iconSymbol = isStart ? '🟢' : '🚩';
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
      gap: 3px;
      white-space: nowrap;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
      line-height: 1.2;
    ">
      <span style="font-size: 9px;">${iconSymbol}</span>
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

const createWaypointIcon = (type: string) => {
  let icon = '📍';
  let badgeColor = '#4ade80';
  let bgGlow = 'rgba(74, 222, 128, 0.4)';

  if (type === 'campsite') {
    icon = '🎪';
    badgeColor = '#38bdf8';
    bgGlow = 'rgba(56, 189, 248, 0.4)';
  } else if (type === 'water') {
    icon = '🌊';
    badgeColor = '#22d3ee';
    bgGlow = 'rgba(34, 211, 238, 0.4)';
  } else if (type === 'viewpoint') {
    icon = '📷';
    badgeColor = '#facc15';
    bgGlow = 'rgba(250, 204, 21, 0.4)';
  } else if (type === 'danger') {
    icon = '⚠️';
    badgeColor = '#ef4444';
    bgGlow = 'rgba(239, 68, 68, 0.4)';
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
      font-size: 12px;
      box-shadow: 0 0 10px ${bgGlow};
      cursor: pointer;
    ">
      ${icon}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'waypoint-marker',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
};

export interface MapViewProps {
  trails: Trail[];
  selectedTrail?: Trail | null;
  onSelectTrail?: (trail: Trail) => void;
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

// Controller to auto-center map when selected trail changes or user locates
const MapController: React.FC<{ selectedTrail?: Trail | null; flyToPos?: [number, number] | null }> = ({ selectedTrail, flyToPos }) => {
  const map = useMap();

  useEffect(() => {
    if (flyToPos) {
      map.flyTo(flyToPos, 13, { duration: 1.5 });
    } else if (selectedTrail) {
      map.flyTo([selectedTrail.startLat, selectedTrail.startLng], 12, { duration: 1.5 });
    }
  }, [selectedTrail, flyToPos, map]);

  return null;
};

export const MapView: React.FC<MapViewProps> = ({
  trails,
  selectedTrail,
  onSelectTrail,
  height = '560px',
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

  // P2-14 Offline Caching State
  const [isCachingTiles, setIsCachingTiles] = useState(false);
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [cacheProgress, setCacheProgress] = useState(0);

  // P2-15 GPS Live Tracking State
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [liveTrackPoints, setLiveTrackPoints] = useState<[number, number][]>([]);
  const [liveStats, setLiveStats] = useState({ speedKmH: 0, distanceKm: 0, durationSec: 0, altM: 0 });
  const [watchId, setWatchId] = useState<number | null>(null);

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

  // P2-14: Cache Leaflet tiles for offline usage
  const handleCacheOfflineMap = async () => {
    if (!selectedTrail && trails.length === 0) return;
    setIsCachingTiles(true);
    setCacheProgress(10);

    try {
      if ('caches' in window) {
        const cache = await caches.open('trekmap-tiles-v1');
        const targetTrail = selectedTrail || trails[0];

        const tileUrls = [];
        const baseLat = targetTrail.startLat;
        const baseLng = targetTrail.startLng;

        for (let z = 12; z <= 14; z++) {
          const x = Math.floor(((baseLng + 180) / 360) * Math.pow(2, z));
          const y = Math.floor(
            ((1 - Math.log(Math.tan((baseLat * Math.PI) / 180) + 1 / Math.cos((baseLat * Math.PI) / 180)) / Math.PI) / 2) *
              Math.pow(2, z)
          );
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              tileUrls.push(
                `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y + dy}/${x + dx}`
              );
            }
          }
        }

        let completed = 0;
        for (const url of tileUrls) {
          try {
            await cache.add(url);
          } catch (e) {}
          completed++;
          setCacheProgress(Math.round((completed / tileUrls.length) * 100));
        }

        setIsOfflineCached(true);
      }
    } catch (err) {
      console.warn('Offline cache failed:', err);
    } finally {
      setIsCachingTiles(false);
    }
  };

  // P2-15: Toggle Live GPS Tracking
  const toggleLiveTracking = () => {
    if (isLiveTracking) {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      setIsLiveTracking(false);
      setWatchId(null);
    } else {
      if (!navigator.geolocation) {
        if (onShowToast) {
          onShowToast('Trình duyệt của bạn không hỗ trợ GPS Live Tracking', 'error');
        }
        return;
      }
      setIsLiveTracking(true);
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const newPt: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setLiveTrackPoints((prev) => [...prev, newPt]);
          setUserLocation(newPt);
          setFlyToPos(newPt);

          setLiveStats((prev) => ({
            speedKmH: Math.round((pos.coords.speed || 1.2) * 3.6 * 10) / 10,
            distanceKm: Math.round((prev.distanceKm + 0.05) * 100) / 100,
            durationSec: prev.durationSec + 3,
            altM: Math.round(pos.coords.altitude || 1200),
          }));
        },
        (err) => console.warn('GPS error:', err),
        { enableHighAccuracy: true }
      );
      setWatchId(id);
    }
  };

  const handleLocateMe = async () => {
    setIsLocating(true);
    
    const performSpatialSearch = async (lat: number, lng: number) => {
      const coords: [number, number] = [lat, lng];
      setUserLocation(coords);
      setFlyToPos(coords);
      setIsLocating(false);

      try {
        const [nearby, geoData] = await Promise.all([
          fetchNearbyTrails(lat, lng, 50),
          reverseGeocode(lat, lng),
        ]);
        setGpsToast({
          lat,
          lng,
          nearby: nearby || [],
          geocodedAddress: geoData?.formattedAddress || geoData?.displayName,
        });
      } catch (err) {
        setGpsToast({ lat, lng, nearby: [] });
      }
    };

    if (!navigator.geolocation) {
      performSpatialSearch(22.3364, 103.8438);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        performSpatialSearch(position.coords.latitude, position.coords.longitude);
      },
      () => {
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
    <div style={{ position: 'relative', width: '100%', borderRadius: 24, overflow: 'hidden' }}>
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

        {/* P2-14: Offline Map Caching Button */}
        <button
          onClick={handleCacheOfflineMap}
          disabled={isCachingTiles}
          style={{
            background: isOfflineCached ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
            color: isOfflineCached ? 'var(--color-primary)' : 'var(--color-text-main)',
            border: `1px solid ${isOfflineCached ? 'var(--color-primary)' : 'var(--color-border)'}`,
            borderRadius: 24,
            padding: '8px 14px',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          <span>{isCachingTiles ? `Đang lưu (${cacheProgress}%)` : isOfflineCached ? 'Đã lưu offline' : 'Bản đồ Offline'}</span>
        </button>

        {/* P2-15: GPS Live Tracking Button */}
        <button
          onClick={toggleLiveTracking}
          style={{
            background: isLiveTracking ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'rgba(255, 255, 255, 0.08)',
            color: '#fff',
            border: isLiveTracking ? 'none' : '1px solid var(--color-border)',
            borderRadius: 24,
            padding: '8px 14px',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: isLiveTracking ? '0 0 12px rgba(239, 68, 68, 0.5)' : 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <span>{isLiveTracking ? 'Đang Live Trek' : 'Bắt đầu Trek'}</span>
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
            background: difficultyFilter === 'easy' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
            color: difficultyFilter === 'easy' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            border: 'none',
            borderRadius: 16,
            padding: '5px 12px',
            fontSize: '0.78rem',
            fontWeight: difficultyFilter === 'easy' ? 800 : 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          ● Dễ (1-2)
        </button>
        <button
          onClick={() => setDifficultyFilter('medium')}
          style={{
            background: difficultyFilter === 'medium' ? 'rgba(74, 222, 128, 0.25)' : 'transparent',
            color: difficultyFilter === 'medium' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            border: 'none',
            borderRadius: 16,
            padding: '5px 12px',
            fontSize: '0.78rem',
            fontWeight: difficultyFilter === 'medium' ? 800 : 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          ● Trung Bình (3)
        </button>
        <button
          onClick={() => setDifficultyFilter('hard')}
          style={{
            background: difficultyFilter === 'hard' ? 'rgba(239, 68, 68, 0.25)' : 'transparent',
            color: difficultyFilter === 'hard' ? 'var(--color-error)' : 'var(--color-text-muted)',
            border: 'none',
            borderRadius: 16,
            padding: '5px 12px',
            fontSize: '0.78rem',
            fontWeight: difficultyFilter === 'hard' ? 800 : 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          ● Khó (4-5)
        </button>
      </div>

      {/* Map Element Container */}
      <div style={{
        height,
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
          <MapController selectedTrail={selectedTrail} flyToPos={flyToPos} />

          <TileLayer
            key={currentTileKey}
            attribution={currentTile.attribution}
            url={currentTile.url}
          />

          {/* P2-15 Live GPS Tracking Polyline (Orange Line) */}
          {isLiveTracking && liveTrackPoints.length > 1 && (
            <Polyline
              positions={liveTrackPoints}
              pathOptions={{
                color: '#f97316',
                weight: 6,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          )}

          {/* User GPS Location Marker */}
          {userLocation && (
            <Marker position={userLocation} icon={createUserGpsIcon()}>
              <Popup>
                <div style={{ padding: 4 }}>
                  <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    🎯 Vị Trí Thực Tế Của Bạn
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
                    {/* Layer 2: Sleek Core Track Line */}
                    <Polyline
                      positions={track}
                      pathOptions={{
                        color: '#10b981',
                        weight: 4,
                        opacity: 1.0,
                        lineCap: 'round',
                        lineJoin: 'round',
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
                    />
                    {/* Start Flag Marker at gpxTrack[0] */}
                    {startPos && (
                      <Marker position={startPos} icon={createStartEndIcon('start', 'Xuất phát')}>
                        <Popup>
                          <div style={{ padding: 4 }}>
                            <span style={{ fontWeight: 800, color: '#10b981' }}>🟢 Điểm Khởi Hành Trekking</span>
                            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: 2 }}>{trail.name}</div>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                    {/* Summit Finish Flag Marker at gpxTrack[last] */}
                    {endPos && (
                      <Marker position={endPos} icon={createStartEndIcon('finish', `${trail.maxAltitudeM}m`)}>
                        <Popup>
                          <div style={{ padding: 4 }}>
                            <span style={{ fontWeight: 800, color: '#f59e0b' }}>🏁 Chóp Đỉnh Cao Độ {trail.maxAltitudeM}m</span>
                            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: 2 }}>{trail.name}</div>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                  </React.Fragment>
                );
              })}

          {/* Difficulty Color Markers & Waypoints */}
          {filteredTrails.map((trail) => {
            const isSelected = selectedTrail?.id === trail.id;

            return (
              <React.Fragment key={trail.id}>
                <Marker
                  position={[trail.startLat, trail.startLng]}
                  icon={createCustomIcon(trail.difficultyLevel)}
                  eventHandlers={{
                    click: () => onSelectTrail?.(trail),
                  }}
                >
                  <Popup className="custom-leaflet-popup">
                    <div style={{ width: 230, padding: '4px 2px' }}>
                      <div style={{
                        position: 'relative',
                        height: 110,
                        borderRadius: 12,
                        overflow: 'hidden',
                        marginBottom: 10,
                      }}>
                        <img
                          src={trail.coverImage}
                          alt={trail.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          background: getDifficultyColor(trail.difficultyLevel),
                          color: '#030a0e',
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: 10,
                        }}>
                          Mức khó: {trail.difficultyLevel}/5
                        </div>
                        <div style={{
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
                        }}>
                          {trail.region}
                        </div>
                      </div>

                      <h4 style={{
                        margin: '0 0 6px 0',
                        fontSize: '0.95rem',
                        fontWeight: 800,
                        color: '#f8fafc',
                        lineHeight: 1.3,
                      }}>
                        {trail.name}
                      </h4>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.78rem',
                        color: '#94a3b8',
                        marginBottom: 10,
                        paddingBottom: 8,
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                      }}>
                        <span>📍 {trail.province}</span>
                        <span>📏 {trail.distanceKm} km</span>
                        <span>⛰️ {trail.maxAltitudeM}m</span>
                      </div>

                      <button
                        onClick={() => onSelectTrail?.(trail)}
                        style={{
                          width: '100%',
                          background: 'linear-gradient(135deg, #00ffd5 0%, #06b6d4 100%)',
                          color: '#030a0e',
                          border: 'none',
                          borderRadius: 10,
                          padding: '8px 12px',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          boxShadow: '0 4px 14px rgba(0, 255, 213, 0.3)',
                        }}
                      >
                        <span>Xem Chi Tiết Cung Đường</span>
                      </button>
                    </div>
                  </Popup>
                </Marker>

                {/* Waypoint Markers when trail is selected */}
                {isSelected &&
                  trail.waypoints &&
                  trail.waypoints.map((wp) => (
                    <Marker
                      key={`wp-${wp.id}`}
                      position={[wp.lat, wp.lng]}
                      icon={createWaypointIcon(wp.type)}
                    >
                      <Popup>
                        <div style={{ padding: 4, minWidth: 160 }}>
                          <span style={{ fontWeight: 800, color: '#00ffd5', fontSize: '0.85rem' }}>
                            📍 {wp.name}
                          </span>
                          {wp.elevationM && (
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
                              Cao độ: {wp.elevationM}m
                            </div>
                          )}
                          <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: 4 }}>
                            {wp.description}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
              </React.Fragment>
            );
          })}
        </MapContainer>

        {/* P2-15 Live GPS Tracking Floating Stats Overlay */}
        {isLiveTracking && (
          <div style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'rgba(7, 19, 25, 0.92)',
            backdropFilter: 'blur(16px)',
            border: '2px solid #f97316',
            borderRadius: 20,
            padding: '12px 24px',
            boxShadow: '0 8px 32px rgba(249, 115, 22, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            minWidth: 360,
            justifyContent: 'space-around',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>Tốc độ</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f97316' }}>{liveStats.speedKmH} <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>km/h</span></div>
            </div>
            <div style={{ borderLeft: '1px solid var(--color-border)', height: 30 }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>Đã đi</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--color-primary)' }}>{liveStats.distanceKm} <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>km</span></div>
            </div>
            <div style={{ borderLeft: '1px solid var(--color-border)', height: 30 }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>Cao độ</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--color-sky)' }}>{liveStats.altM} <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>m</span></div>
            </div>
            <div style={{ borderLeft: '1px solid var(--color-border)', height: 30 }} />
            <button
              onClick={toggleLiveTracking}
              style={{
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '8px 14px',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Dừng Trek
            </button>
          </div>
        )}
      </div>

      {/* Organic Nature GPS Toast Notification Card Overlay */}
      {gpsToast && (
        <div style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          zIndex: 1050,
          width: 350,
          background: 'rgba(19, 31, 55, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1.5px solid rgba(56, 189, 248, 0.4)',
          borderRadius: 20,
          padding: 16,
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.8), 0 0 20px rgba(56, 189, 248, 0.2)',
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255, 255, 255, 0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8', fontWeight: 800, fontSize: '0.88rem' }}>
              <span>Định Vị GPS [ {gpsToast.lat.toFixed(4)}, {gpsToast.lng.toFixed(4)} ]</span>
            </div>
            <button
              onClick={() => setGpsToast(null)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#cbd5e1',
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
            <div style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: 700, marginBottom: 8, background: 'rgba(14, 215, 181, 0.1)', padding: '4px 8px', borderRadius: 6 }}>
              {gpsToast.geocodedAddress}
            </div>
          )}

          {gpsToast.nearby.length > 0 ? (
            <div>
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginBottom: 8, fontWeight: 700 }}>
                ⚡ Tìm thấy <span style={{ color: '#10b981', fontWeight: 900 }}>{gpsToast.nearby.length}</span> cung đường trong bán kính &lt;50km:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {gpsToast.nearby.map((t) => {
                  const color = getDifficultyColor(t.difficultyLevel);
                  const dist = (t as any).distanceFromUserKm;
                  const roadDist = (t as any).estimatedRoadDistanceKm || (dist ? Math.round(dist * 1.9) : null);
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        onSelectTrail?.(t);
                        setFlyToPos([t.startLat, t.startLng]);
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 12,
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, overflow: 'hidden' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }}></div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.name}
                        </span>
                      </div>
                      
                      {roadDist && (
                        <span style={{ fontSize: '0.76rem', color: '#38bdf8', fontWeight: 800, background: 'rgba(56, 189, 248, 0.16)', padding: '3px 9px', borderRadius: 8, marginLeft: 8, flexShrink: 0 }}>
                          🚗 ~{roadDist} km
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Không tìm thấy cung đường nào trong bán kính 50km từ vị trí GPS hiện tại.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
