import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Trail } from '../../types.js';
import { haversineMeters } from '../../utils/geoMath.js';
import { useFocusTrap, isTopmostFocusTrap } from '../../hooks/useFocusTrap.js';
import { IconX, IconMountain, IconCompass, IconAlertTriangle } from '../common/SvgIcons.js';

interface Terrain3DModalProps {
  trail: Trail;
  isOpen: boolean;
  onClose: () => void;
}

interface FlyTrackData {
  coords: [number, number][]; // [lng, lat]
  cumDistM: number[];
  totalDistM: number;
}

function escapePopupHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function computeForwardBearingDeg(
  fromLngLat: [number, number],
  toLngLat: [number, number]
): number {
  const lat1 = (fromLngLat[1] * Math.PI) / 180;
  const lat2 = (toLngLat[1] * Math.PI) / 180;
  const dLng = ((toLngLat[0] - fromLngLat[0]) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

function normalizeBearingLerp(currentDeg: number, targetDeg: number, alpha: number): number {
  const delta = ((targetDeg - currentDeg + 540) % 360) - 180;
  return currentDeg + delta * alpha;
}

function sampleLngLatAtDistance(track: FlyTrackData, distM: number): [number, number] {
  const { coords, cumDistM, totalDistM } = track;
  if (coords.length === 0) return [103.775, 22.3033];
  if (coords.length === 1 || totalDistM <= 0) return coords[0];
  const clamped = Math.max(0, Math.min(totalDistM, distM));
  for (let i = 0; i < cumDistM.length - 1; i++) {
    if (clamped >= cumDistM[i] && clamped <= cumDistM[i + 1]) {
      const segLen = Math.max(0.001, cumDistM[i + 1] - cumDistM[i]);
      const ratio = (clamped - cumDistM[i]) / segLen;
      const lng = coords[i][0] + (coords[i + 1][0] - coords[i][0]) * ratio;
      const lat = coords[i][1] + (coords[i + 1][1] - coords[i][1]) * ratio;
      return [lng, lat];
    }
  }
  return coords[coords.length - 1];
}

export const Terrain3DModal: React.FC<Terrain3DModalProps> = ({ trail, isOpen, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const trailRef = useRef<Trail>(trail);
  const flyTrackRef = useRef<FlyTrackData>({ coords: [], cumDistM: [0], totalDistM: 0 });
  const flyRafRef = useRef<number | null>(null);
  const flyProgressRef = useRef<number>(0);
  const lastReportedFlyPctRef = useRef<number>(0);
  const flyLastFrameMsRef = useRef<number | null>(null);
  const flyBearingRef = useRef<number>(-28);
  const pitchRef = useRef<number>(64);
  const flySpeedRef = useRef<1 | 2>(1);
  const isFlyingRef = useRef<boolean>(false);

  useEffect(() => {
    trailRef.current = trail;
  }, [trail]);

  const [trackedTrailId, setTrackedTrailId] = useState<string>(trail.id);
  const [exaggeration, setExaggeration] = useState<number>(1.6);
  const [pitch, setPitch] = useState<number>(64);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [retryTick, setRetryTick] = useState<number>(0);
  const [isFlying, setIsFlying] = useState<boolean>(false);
  const [flyProgress, setFlyProgress] = useState<number>(0);
  const [flySpeed, setFlySpeed] = useState<1 | 2>(1);
  const [flyTrackDistM, setFlyTrackDistM] = useState<number>(0);

  const canFlyThrough = flyTrackDistM >= 10;

  const cancelFlyRaf = useCallback(() => {
    if (flyRafRef.current !== null) {
      window.cancelAnimationFrame(flyRafRef.current);
      flyRafRef.current = null;
    }
    flyLastFrameMsRef.current = null;
  }, []);

  const stopFlyThrough = useCallback(() => {
    cancelFlyRaf();
    if (isFlyingRef.current) {
      isFlyingRef.current = false;
      setIsFlying(false);
    }
  }, [cancelFlyRaf]);

  const applyCameraAtProgress = useCallback((pct: number, smoothBearing: boolean) => {
    const map = mapRef.current;
    const track = flyTrackRef.current;
    if (!map || track.coords.length < 2 || track.totalDistM < 10) return;

    const clampedPct = Math.max(0, Math.min(100, pct));
    const distM = (clampedPct / 100) * track.totalDistM;
    const currentPos = sampleLngLatAtDistance(track, distM);

    // Clamp look-ahead strictly <= totalDistM * 0.5 so short tracks never collapse onto identical points
    const maxOffset = track.totalDistM * 0.5;
    const desiredOffset = Math.min(450, Math.max(Math.min(120, track.totalDistM * 0.25), track.totalDistM * 0.07));
    const lookAheadOffsetM = Math.max(1, Math.min(maxOffset, desiredOffset));

    const canLookForward = distM + lookAheadOffsetM <= track.totalDistM;
    const lookAheadPos = canLookForward
      ? sampleLngLatAtDistance(track, distM + lookAheadOffsetM)
      : sampleLngLatAtDistance(track, Math.max(0, distM - lookAheadOffsetM));

    const rawBearing = canLookForward
      ? computeForwardBearingDeg(currentPos, lookAheadPos)
      : computeForwardBearingDeg(lookAheadPos, currentPos);

    const nextBearing = smoothBearing
      ? normalizeBearingLerp(flyBearingRef.current, rawBearing, 0.08)
      : rawBearing;
    flyBearingRef.current = nextBearing;

    // Update pulsing fly-through cursor point on the 3D track
    const cursorSource = map.getSource('trail-fly-cursor') as maplibregl.GeoJSONSource | undefined;
    if (cursorSource) {
      cursorSource.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: currentPos,
        },
      });
    }

    const currentZoom = map.getZoom();
    const targetZoom = Number.isFinite(currentZoom) ? Math.max(13.4, Math.min(14.8, currentZoom)) : 14;
    map.jumpTo({
      center: currentPos,
      bearing: nextBearing,
      pitch: Math.max(pitchRef.current, 60),
      zoom: targetZoom,
    });
  }, []);

  // Reset terrain & fly-through controls cleanly during render when switching trails
  if (trackedTrailId !== trail.id) {
    setTrackedTrailId(trail.id);
    setExaggeration(1.6);
    setPitch(64);
    setMapError(null);
    setIsLoaded(false);
    setIsFlying(false);
    setFlyProgress(0);
    setFlyTrackDistM(0);
  }

  useEffect(() => {
    pitchRef.current = pitch;
  }, [pitch]);

  useEffect(() => {
    flySpeedRef.current = flySpeed;
  }, [flySpeed]);

  // Cancel RAF cleanly whenever modal closes or trail changes
  useEffect(() => {
    if (!isOpen) {
      cancelFlyRaf();
      isFlyingRef.current = false;
    }
    return () => {
      cancelFlyRaf();
      isFlyingRef.current = false;
    };
  }, [isOpen, trail.id, cancelFlyRaf]);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(isOpen, dialogRef);

  // Escape key close (LIFO topmost + IME safe)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (!isTopmostFocusTrap(dialogRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        stopFlyThrough();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, stopFlyThrough]);

  // Stabilized WebGL lifecycle keyed on trail.id (not trail object identity)
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const currentTrail = trailRef.current;

    const rawCoords: [number, number][] =
      Array.isArray(currentTrail.gpxTrack) && currentTrail.gpxTrack.length >= 2
        ? currentTrail.gpxTrack
            .map(([lat, lng]): [number, number] => [Number(lng), Number(lat)])
            .filter(
              ([lng, lat]) =>
                Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
            )
        : [];

    const fallbackStartLng = Number.isFinite(Number(currentTrail.startLng)) ? Number(currentTrail.startLng) : 103.775;
    const fallbackStartLat = Number.isFinite(Number(currentTrail.startLat)) ? Number(currentTrail.startLat) : 22.3033;
    const fallbackEndLng = Number.isFinite(Number(currentTrail.endLng)) ? Number(currentTrail.endLng) : fallbackStartLng;
    const fallbackEndLat = Number.isFinite(Number(currentTrail.endLat)) ? Number(currentTrail.endLat) : fallbackStartLat;

    const trackCoords: [number, number][] =
      rawCoords.length >= 2
        ? rawCoords
        : [
            [fallbackStartLng, fallbackStartLat],
            [fallbackEndLng, fallbackEndLat],
          ];

    // Precompute cumulative arc-length table for smooth uniform-speed 3D fly-through
    const cumDistM: number[] = [0];
    for (let i = 1; i < trackCoords.length; i++) {
      const segM = haversineMeters(
        trackCoords[i - 1][1],
        trackCoords[i - 1][0],
        trackCoords[i][1],
        trackCoords[i][0]
      );
      cumDistM.push(cumDistM[i - 1] + (Number.isFinite(segM) ? segM : 0));
    }
    const totalDistM = cumDistM[cumDistM.length - 1] || 0;
    flyTrackRef.current = { coords: trackCoords, cumDistM, totalDistM };
    flyProgressRef.current = 0;
    flyBearingRef.current = -28;

    const avgLng = trackCoords.reduce((s, c) => s + c[0], 0) / trackCoords.length;
    const avgLat = trackCoords.reduce((s, c) => s + c[1], 0) / trackCoords.length;
    const centerLng = Number.isFinite(avgLng) ? avgLng : 103.775;
    const centerLat = Number.isFinite(avgLat) ? avgLat : 22.3033;

    let map: maplibregl.Map | null = null;
    let loaded = false;
    let errorCount = 0;

    // Prevent infinite spinner when offline or tile CDN is unreachable
    const loadTimeout = window.setTimeout(() => {
      if (!loaded) {
        setMapError(
          'Không thể tải dữ liệu địa hình 3D DEM (AWS Terrarium / Esri). Vui lòng kiểm tra kết nối mạng hoặc thử tải lại.'
        );
      }
    }, 12000);

    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        center: [centerLng, centerLat],
        zoom: 12.8,
        pitch: 64,
        bearing: -28,
        maxPitch: 85,
        style: {
          version: 8,
          sources: {
            esriSatellite: {
              type: 'raster',
              tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
              ],
              tileSize: 256,
              attribution: '© Esri World Imagery',
              maxzoom: 17,
            },
            awsTerrainDem: {
              type: 'raster-dem',
              tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
              encoding: 'terrarium',
              tileSize: 256,
              maxzoom: 15,
            },
          },
          layers: [
            {
              id: 'satellite-layer',
              type: 'raster',
              source: 'esriSatellite',
            },
          ],
          terrain: {
            source: 'awsTerrainDem',
            exaggeration: 1.6,
          },
          sky: {
            'sky-color': '#1e3a5f',
            'horizon-color': '#93c5fd',
            'fog-color': '#cbd5e1',
            'fog-ground-blend': 0.5,
            'horizon-fog-blend': 0.6,
            'sky-horizon-blend': 0.8,
            'atmosphere-blend': 0.7,
          },
        },
      });

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

      // Pause 3D Fly-Through automatically whenever the user manually grabs, drags, or zooms the map
      const handleUserMapInteraction = () => {
        stopFlyThrough();
      };
      map.on('dragstart', handleUserMapInteraction);
      map.on('mousedown', handleUserMapInteraction);
      map.on('touchstart', handleUserMapInteraction);
      map.on('wheel', handleUserMapInteraction);

      map.on('load', () => {
        if (!map) return;
        loaded = true;
        window.clearTimeout(loadTimeout);
        lastReportedFlyPctRef.current = 0;
        setFlyTrackDistM(totalDistM);
        setIsLoaded(true);
        setMapError(null);

        map.addSource('trail-gpx-3d', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: { name: currentTrail.name },
            geometry: {
              type: 'LineString',
              coordinates: trackCoords,
            },
          },
        });

        // Draped track halo for contrast on real 3D satellite terrain
        map.addLayer({
          id: 'trail-gpx-3d-glow',
          type: 'line',
          source: 'trail-gpx-3d',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#4ade80',
            'line-width': 8,
            'line-opacity': 0.45,
            'line-blur': 4,
          },
        });

        // Crisp core GPX polyline
        map.addLayer({
          id: 'trail-gpx-3d-core',
          type: 'line',
          source: 'trail-gpx-3d',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#ffffff',
            'line-width': 3,
          },
        });

        // Live 3D Fly-Through camera position beacon on the trail
        map.addSource('trail-fly-cursor', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: trackCoords[0],
            },
          },
        });

        map.addLayer({
          id: 'trail-fly-cursor-halo',
          type: 'circle',
          source: 'trail-fly-cursor',
          paint: {
            'circle-radius': 11,
            'circle-color': '#d4a348',
            'circle-opacity': 0.32,
          },
        });

        map.addLayer({
          id: 'trail-fly-cursor-dot',
          type: 'circle',
          source: 'trail-fly-cursor',
          paint: {
            'circle-radius': 5.5,
            'circle-color': '#d4a348',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
          },
        });

        // Auto-frame full track bounds so long 30-55km traverses (Ta Nang, Ky Quan San) never get cropped
        try {
          const bounds = new maplibregl.LngLatBounds();
          for (const pt of trackCoords) {
            bounds.extend(pt);
          }
          if (!bounds.isEmpty()) {
            map.fitBounds(bounds, {
              padding: 72,
              pitch: 64,
              bearing: -28,
              maxZoom: 13.8,
              duration: 0,
            });
          }
        } catch {
          // Keep default center/zoom if bounds collapse to single point
        }

        const safeName = escapePopupHtml(currentTrail.name);
        const altLabel = `${(currentTrail.maxAltitudeM || 0).toLocaleString('vi-VN')}m`;

        // High-contrast popup HTML safe in both Dark & Light modes (MapLibre popup surface is light)
        new maplibregl.Marker({ color: '#10b981' })
          .setLngLat(trackCoords[0])
          .setPopup(
            new maplibregl.Popup({ offset: 20 }).setHTML(
              `<div style="color:#171c19;font-family:var(--font-family);font-size:12px;font-weight:700;padding:2px 4px;">Điểm xuất phát: ${safeName}</div>`
            )
          )
          .addTo(map);

        new maplibregl.Marker({ color: '#ef4444' })
          .setLngLat(trackCoords[trackCoords.length - 1])
          .setPopup(
            new maplibregl.Popup({ offset: 20 }).setHTML(
              `<div style="color:#171c19;font-family:var(--font-family);font-size:12px;font-weight:700;padding:2px 4px;">Đích / Đỉnh (${altLabel})</div>`
            )
          )
          .addTo(map);
      });

      map.on('error', (evt: { error?: { message?: string } }) => {
        errorCount += 1;
        const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
        const isFatalWebGl =
          evt?.error?.message &&
          /webgl|context|shader|not supported/i.test(String(evt.error.message));
        if (isFatalWebGl) {
          window.clearTimeout(loadTimeout);
          setMapError(
            'Thiết bị hoặc trình duyệt hiện không hỗ trợ WebGL 3D. Vui lòng thử trên trình duyệt Chrome/Edge/Safari mới nhất.'
          );
        } else if (isOffline || (!loaded && errorCount >= 3)) {
          window.clearTimeout(loadTimeout);
          setMapError(
            isOffline
              ? 'Bạn đang ngoại tuyến — chế độ địa hình 3D DEM yêu cầu kết nối mạng để tải khối ảnh vệ tinh và cao độ.'
              : 'Không thể kết nối máy chủ bản đồ địa hình 3D lúc này. Vui lòng thử tải lại.'
          );
        }
      });

      mapRef.current = map;
    } catch {
      window.clearTimeout(loadTimeout);
      queueMicrotask(() => {
        setMapError(
          'Thiết bị hoặc trình duyệt hiện không hỗ trợ WebGL 3D. Vui lòng thử trên trình duyệt Chrome/Edge/Safari mới nhất.'
        );
      });
    }

    return () => {
      cancelFlyRaf();
      isFlyingRef.current = false;
      window.clearTimeout(loadTimeout);
      if (map) map.remove();
      mapRef.current = null;
      setIsLoaded(false);
    };
  }, [isOpen, trail.id, retryTick, cancelFlyRaf, stopFlyThrough]);

  // Smooth requestAnimationFrame Fly-Through playback loop
  useEffect(() => {
    if (!isFlying || !isLoaded || !isOpen) {
      cancelFlyRaf();
      isFlyingRef.current = false;
      return;
    }

    isFlyingRef.current = true;
    flyLastFrameMsRef.current = null;

    const step = (nowMs: number) => {
      if (!isFlyingRef.current) return;
      if (flyLastFrameMsRef.current === null) {
        flyLastFrameMsRef.current = nowMs;
      }
      const dtMs = Math.min(100, Math.max(0, nowMs - flyLastFrameMsRef.current));
      flyLastFrameMsRef.current = nowMs;

      // Full route fly-through duration: 24s at 1x, 12s at 2x
      const totalDurationMs = flySpeedRef.current === 2 ? 12000 : 24000;
      const nextPct = Math.min(100, flyProgressRef.current + (dtMs / totalDurationMs) * 100);
      flyProgressRef.current = nextPct;

      applyCameraAtProgress(nextPct, true);
      const roundedHalf = Math.round(nextPct * 2) / 2;
      if (Math.abs(roundedHalf - lastReportedFlyPctRef.current) >= 0.5 || nextPct >= 100) {
        const reported = nextPct >= 100 ? 100 : roundedHalf;
        lastReportedFlyPctRef.current = reported;
        setFlyProgress(reported);
      }

      if (nextPct >= 100) {
        isFlyingRef.current = false;
        flyRafRef.current = null;
        setIsFlying(false);
        return;
      }

      flyRafRef.current = window.requestAnimationFrame(step);
    };

    flyRafRef.current = window.requestAnimationFrame(step);
    return () => {
      cancelFlyRaf();
    };
  }, [isFlying, isLoaded, isOpen, applyCameraAtProgress, cancelFlyRaf]);

  const handleToggleFlyThrough = () => {
    if (!isLoaded || mapError || !canFlyThrough) return;
    if (isFlying) {
      stopFlyThrough();
      return;
    }
    if (flyProgressRef.current >= 99.5) {
      flyProgressRef.current = 0;
      lastReportedFlyPctRef.current = 0;
      setFlyProgress(0);
    }
    // Snap initial bearing cleanly toward forward ridge before starting RAF
    applyCameraAtProgress(flyProgressRef.current, false);
    setIsFlying(true);
  };

  const handleScrubFlyProgress = (nextVal: number) => {
    if (!canFlyThrough) return;
    stopFlyThrough();
    flyProgressRef.current = nextVal;
    lastReportedFlyPctRef.current = nextVal;
    setFlyProgress(nextVal);
    applyCameraAtProgress(nextVal, false);
  };

  const handleResetOverview = () => {
    stopFlyThrough();
    const map = mapRef.current;
    const coords = flyTrackRef.current.coords;
    if (!map || coords.length < 2) return;
    try {
      const bounds = new maplibregl.LngLatBounds();
      for (const pt of coords) bounds.extend(pt);
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: 72,
          pitch: pitchRef.current,
          bearing: -28,
          maxZoom: 13.8,
          duration: 750,
        });
      }
    } catch {
      // ignore bounds failure
    }
  };

  const handleExaggerationChange = (val: number) => {
    setExaggeration(val);
    if (mapRef.current && isLoaded) {
      mapRef.current.setTerrain({ source: 'awsTerrainDem', exaggeration: val });
    }
  };

  const handlePitchChange = (val: number) => {
    setPitch(val);
    if (mapRef.current) {
      mapRef.current.easeTo({ pitch: val, duration: 350 });
    }
  };

  const handleOrbit = () => {
    stopFlyThrough();
    if (!mapRef.current) return;
    const currentBearing = mapRef.current.getBearing();
    mapRef.current.easeTo({ bearing: currentBearing + 90, duration: 900 });
  };

  if (!isOpen) return null;

  const estimatedRouteKm = Number(trail.distanceKm) || 0;
  const currentFlyKm = ((flyProgress / 100) * estimatedRouteKm).toFixed(1);

  return createPortal(
    <div
      className="modal-overlay"
      onClick={() => {
        stopFlyThrough();
        onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 'var(--z-modal, 3000)' as unknown as number,
        padding: 'clamp(6px, 2vw, 16px)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Địa hình 3D DEM ${trail.name}`}
        tabIndex={-1}
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 1180,
          width: '96vw',
          height: '86vh',
          maxHeight: 820,
          padding: 0,
          borderRadius: 6,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: 'var(--shadow-3d)',
          outline: 'none',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '10px 14px',
            background: 'var(--color-bg-card)',
            borderBottom: '1px solid var(--color-border)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 4,
                background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
                flexShrink: 0,
              }}
            >
              <IconMountain size={18} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                Địa Hình 3D DEM Thực Tế — {trail.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                MapLibre WebGL + AWS Terrarium DEM · Đỉnh {trail.maxAltitudeM.toLocaleString('vi-VN')}m · Giữ chuột phải / 2 ngón tay để xoay 360°
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
              <span>Độ nổi núi ({exaggeration.toFixed(1)}x)</span>
              <input
                type="range"
                aria-label="Độ nổi địa hình 3D"
                min="1"
                max="2.5"
                step="0.1"
                value={exaggeration}
                onChange={(e) => handleExaggerationChange(Number(e.target.value))}
                style={{ width: 80, accentColor: 'var(--color-primary)' }}
              />
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
              <span>Góc nghiêng ({pitch}°)</span>
              <input
                type="range"
                aria-label="Góc nghiêng camera 3D"
                min="0"
                max="80"
                step="4"
                value={pitch}
                onChange={(e) => handlePitchChange(Number(e.target.value))}
                style={{ width: 80, accentColor: 'var(--color-sky)' }}
              />
            </label>

            <button
              type="button"
              className="btn btn-outline"
              onClick={handleOrbit}
              style={{ padding: '6px 11px', fontSize: '0.76rem', borderRadius: 4 }}
            >
              <IconCompass size={14} color="var(--color-sky)" />
              <span>Xoay 90°</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopFlyThrough();
                onClose();
              }}
              aria-label="Đóng bản đồ 3D"
              style={{
                width: 34,
                height: 34,
                borderRadius: 4,
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <IconX size={16} />
            </button>
          </div>
        </div>

        {/* 3D WebGL Map Canvas */}
        <div style={{ flex: 1, position: 'relative', minHeight: 240, background: 'var(--color-bg-main)' }}>
          {mapError ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 32,
                textAlign: 'center',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 6,
                  background: 'color-mix(in srgb, var(--color-error) 14%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-error-text, var(--color-error))',
                }}
              >
                <IconAlertTriangle size={24} color="var(--color-error-text, var(--color-error))" />
              </div>
              <div style={{ maxWidth: 460, fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-main)', lineHeight: 1.55 }}>
                {mapError}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setMapError(null);
                    setRetryTick((t) => t + 1);
                  }}
                  style={{ borderRadius: 4, padding: '8px 16px', fontSize: '0.82rem' }}
                >
                  Thử tải lại mô hình 3D
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={onClose}
                  style={{ borderRadius: 4, padding: '8px 16px', fontSize: '0.82rem' }}
                >
                  Đóng (Esc)
                </button>
              </div>
            </div>
          ) : (
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
          )}

          {/* Wave 10D: 3D Terrain Fly-Through Floating Control Dock */}
          {isLoaded && !mapError && (
            <div
              role="region"
              aria-label="Điều khiển bay dọc tuyến 3D"
              style={{
                position: 'absolute',
                bottom: 26,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'min(640px, calc(100% - 24px))',
                background: 'var(--color-bg-glass)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 6,
                padding: '7px 11px',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                zIndex: 5,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <button
                type="button"
                className={isFlying ? 'btn btn-outline' : 'btn btn-primary'}
                onClick={handleToggleFlyThrough}
                disabled={!canFlyThrough}
                title={!canFlyThrough ? 'Cần tuyến GPX dài trên 10m để bay dọc tuyến 3D' : undefined}
                aria-label={isFlying ? 'Tạm dừng bay dọc tuyến 3D' : 'Bắt đầu bay dọc tuyến 3D'}
                style={{
                  padding: '6px 11px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  borderRadius: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  flexShrink: 0,
                  opacity: canFlyThrough ? 1 : 0.5,
                  cursor: canFlyThrough ? 'pointer' : 'not-allowed',
                  borderColor: isFlying ? 'var(--color-sun)' : undefined,
                  color: isFlying ? 'var(--color-sun)' : undefined,
                }}
              >
                {isFlying ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                    <span>Tạm Dừng</span>
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span>Bay Dọc Tuyến 3D</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setFlySpeed((s) => (s === 1 ? 2 : 1))}
                aria-label={`Tốc độ bay ${flySpeed}x`}
                title="Đổi tốc độ bay dọc tuyến (1x / 2x)"
                style={{
                  padding: '5px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  borderRadius: 4,
                  background: 'var(--color-surface-elevated)',
                  border: '1px solid var(--color-border-strong)',
                  color: flySpeed === 2 ? 'var(--color-sun)' : 'var(--color-text-main)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {flySpeed}x
              </button>

              <div style={{ flex: '1 1 180px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={flyProgress}
                  disabled={!canFlyThrough}
                  aria-label="Thanh tua tiến độ bay dọc tuyến 3D"
                  onChange={(e) => handleScrubFlyProgress(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--color-primary)', cursor: canFlyThrough ? 'pointer' : 'not-allowed' }}
                />
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-main)', whiteSpace: 'nowrap' }}>
                  {Math.round(flyProgress)}%
                  {estimatedRouteKm > 0 ? ` · ${currentFlyKm}/${estimatedRouteKm}km` : ''}
                </span>
              </div>

              <button
                type="button"
                onClick={handleResetOverview}
                title="Thu góc nhìn toàn bộ cung đường"
                style={{
                  padding: '5px 9px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  borderRadius: 4,
                  background: 'var(--color-surface-elevated)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Toàn Tuyến
              </button>
            </div>
          )}

          {!isLoaded && !mapError && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-bg-main)',
                color: 'var(--color-text-muted)',
                fontSize: '0.88rem',
                fontWeight: 700,
                pointerEvents: 'none',
              }}
            >
              Đang dựng mô hình địa hình 3D DEM...
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Terrain3DModal;
