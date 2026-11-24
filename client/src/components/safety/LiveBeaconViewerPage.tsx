import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { Trail } from '../../types.js';
import { VIETNAM_RANGER_STATIONS, type RangerStationSeed } from '../../data/vietnamDirectory.js';
import { calculateHaversineKm, decimalToDms } from '../../utils/solarMath.js';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconCheckCircle,
  IconClock,
  IconCompass,
  IconCopy,
  IconMapPin,
  IconMountain,
  IconPhoneCall,
  IconRadio,
  IconRotateCw,
  IconShare,
  IconShieldAlert,
  IconShieldCheck,
} from '../common/SvgIcons.js';

export interface LiveBeaconViewerPageProps {
  token: string;
  trails: Trail[];
  onBack?: () => void;
  onSelectTrail?: (trail: Trail) => void;
}

type BeaconStatus = 'active' | 'paused' | 'safe' | 'sos';
type TileLayerKey = 'topo' | 'satellite' | 'osm';

interface BeaconPoint {
  lat: number;
  lng: number;
  altitudeM: number | null;
  accuracyM?: number | null;
  recordedAt: string | null;
}

interface BeaconTrailSummary {
  id: string;
  name: string;
  province: string;
  distanceKm: number;
  maxAltitudeM: number;
  elevationGainM: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  gpxTrack: [number, number][];
}

interface NormalizedLiveBeacon {
  token: string;
  displayName: string;
  trailId: string | null;
  trailName: string;
  status: BeaconStatus;
  batteryPercent: number | null;
  distanceKm: number;
  elevationGainM: number;
  lastPosition: BeaconPoint | null;
  breadcrumbs: BeaconPoint[];
  emergencyNote: string | null;
  minutesSinceLastPing: number | null;
  isSignalStale: boolean;
  expiresAt: string | null;
  updatedAt: string | null;
  trailSummary: BeaconTrailSummary | null;
}

const POLL_INTERVAL_MS = 15_000;
const STALE_SIGNAL_THRESHOLD_MIN = 45;

const TILE_LAYERS: Record<TileLayerKey, { label: string; url: string; attribution: string; maxZoom: number }> = {
  topo: {
    label: 'Địa Hình Topo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap, SRTM | OpenTopoMap',
    maxZoom: 17,
  },
  satellite: {
    label: 'Vệ Tinh',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri World Imagery',
    maxZoom: 18,
  },
  osm: {
    label: 'Bản Đồ Chuẩn',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
};

const IconBatterySvg: React.FC<{ percent: number | null; size?: number }> = ({ percent, size = 18 }) => {
  const safe = typeof percent === 'number' && Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : null;
  const fillWidth = safe !== null ? Math.max(1.5, (safe / 100) * 14) : 0;
  const fillColor =
    safe === null
      ? 'var(--color-text-dim)'
      : safe <= 20
      ? 'var(--color-error)'
      : safe <= 45
      ? 'var(--color-sun)'
      : 'var(--color-primary)';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="7" width="18" height="10" rx="2" ry="2" />
      <line x1="22" y1="10.5" x2="22" y2="13.5" />
      {safe !== null && <rect x="4" y="9" width={fillWidth} height="6" rx="1" fill={fillColor} stroke="none" />}
    </svg>
  );
};

const IconCrosshairSvg: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="8" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
  </svg>
);

const IconExternalSvg: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

function parseBeaconStatus(val: unknown): BeaconStatus {
  if (val === 'active' || val === 'paused' || val === 'safe' || val === 'sos') return val;
  return 'active';
}

function parsePoint(raw: unknown): BeaconPoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const lat = Number(r.lat);
  const lng = Number(r.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  const altNum = r.altitudeM !== undefined && r.altitudeM !== null ? Number(r.altitudeM) : NaN;
  const accNum = r.accuracyM !== undefined && r.accuracyM !== null ? Number(r.accuracyM) : NaN;
  return {
    lat,
    lng,
    altitudeM: Number.isFinite(altNum) ? Math.round(altNum) : null,
    accuracyM: Number.isFinite(accNum) ? Math.round(accNum) : null,
    recordedAt: typeof r.recordedAt === 'string' ? r.recordedAt : null,
  };
}

function normalizeLiveBeaconPayload(rawJson: unknown, fallbackToken: string): NormalizedLiveBeacon | null {
  if (!rawJson || typeof rawJson !== 'object') return null;
  const wrapper = rawJson as Record<string, unknown>;
  const src =
    wrapper.data && typeof wrapper.data === 'object' ? (wrapper.data as Record<string, unknown>) : wrapper;

  const lastPosition = parsePoint(src.lastPosition);
  const rawCrumbs = Array.isArray(src.breadcrumbs) ? src.breadcrumbs : [];
  const breadcrumbs = rawCrumbs.map(parsePoint).filter((pt): pt is BeaconPoint => pt !== null);

  if (!src.token && !lastPosition && breadcrumbs.length === 0 && !src.trailName) {
    return null;
  }

  const effectiveLast = lastPosition || (breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null);
  const status = parseBeaconStatus(src.status);
  const updatedAt =
    typeof src.updatedAt === 'string'
      ? src.updatedAt
      : effectiveLast?.recordedAt || null;

  let minutesSinceLastPing: number | null =
    typeof src.minutesSinceLastPing === 'number' && Number.isFinite(src.minutesSinceLastPing)
      ? Math.max(0, Math.round(src.minutesSinceLastPing))
      : null;

  if (minutesSinceLastPing === null && updatedAt) {
    const parsedMs = Date.parse(updatedAt);
    if (Number.isFinite(parsedMs)) {
      minutesSinceLastPing = Math.max(0, Math.round((Date.now() - parsedMs) / 60_000));
    }
  }

  const isSignalStale =
    typeof src.isSignalStale === 'boolean'
      ? src.isSignalStale
      : status !== 'safe' && minutesSinceLastPing !== null && minutesSinceLastPing > STALE_SIGNAL_THRESHOLD_MIN;

  const rawBatt = src.batteryPercent !== undefined && src.batteryPercent !== null ? Number(src.batteryPercent) : NaN;
  const batteryPercent = Number.isFinite(rawBatt) ? Math.max(0, Math.min(100, Math.round(rawBatt))) : null;

  const distNum = Number(src.distanceKm);
  const gainNum = Number(src.elevationGainM);

  let trailSummary: BeaconTrailSummary | null = null;
  if (src.trailSummary && typeof src.trailSummary === 'object') {
    const ts = src.trailSummary as Record<string, unknown>;
    const rawGpx = Array.isArray(ts.gpxTrack) ? ts.gpxTrack : [];
    const gpxTrack: [number, number][] = [];
    for (const pair of rawGpx) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const lat = Number(pair[0]);
      const lng = Number(pair[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) gpxTrack.push([lat, lng]);
    }
    const startLat = Number(ts.startLat);
    const startLng = Number(ts.startLng);
    const endLat = Number(ts.endLat);
    const endLng = Number(ts.endLng);
    if (Number.isFinite(startLat) && Number.isFinite(startLng)) {
      trailSummary = {
        id: String(ts.id || ''),
        name: typeof ts.name === 'string' ? ts.name : '',
        province: typeof ts.province === 'string' ? ts.province : '',
        distanceKm: Number.isFinite(Number(ts.distanceKm)) ? Number(ts.distanceKm) : 0,
        maxAltitudeM: Number.isFinite(Number(ts.maxAltitudeM)) ? Math.round(Number(ts.maxAltitudeM)) : 0,
        elevationGainM: Number.isFinite(Number(ts.elevationGainM)) ? Math.round(Number(ts.elevationGainM)) : 0,
        startLat,
        startLng,
        endLat: Number.isFinite(endLat) ? endLat : startLat,
        endLng: Number.isFinite(endLng) ? endLng : startLng,
        gpxTrack,
      };
    }
  }

  return {
    token: typeof src.token === 'string' && src.token.trim() ? src.token.trim() : fallbackToken,
    displayName:
      typeof src.displayName === 'string' && src.displayName.trim()
        ? src.displayName.trim()
        : 'Nhà thám hiểm LOST',
    trailId: typeof src.trailId === 'string' && src.trailId.trim() ? src.trailId.trim() : null,
    trailName:
      typeof src.trailName === 'string' && src.trailName.trim()
        ? src.trailName.trim()
        : 'Hành trình leo núi LOST',
    status,
    batteryPercent,
    distanceKm: Number.isFinite(distNum) && distNum >= 0 ? Math.round(distNum * 100) / 100 : 0,
    elevationGainM: Number.isFinite(gainNum) && gainNum >= 0 ? Math.round(gainNum) : 0,
    lastPosition: effectiveLast,
    breadcrumbs,
    emergencyNote: typeof src.emergencyNote === 'string' && src.emergencyNote.trim() ? src.emergencyNote.trim() : null,
    minutesSinceLastPing,
    isSignalStale,
    expiresAt: typeof src.expiresAt === 'string' ? src.expiresAt : null,
    updatedAt,
    trailSummary,
  };
}

function formatRelativeMinutesVi(minutes: number | null): string {
  if (minutes === null) return 'Đang chờ tín hiệu';
  if (minutes < 1) return 'Vừa cập nhật (<1 phút)';
  if (minutes < 60) return `${minutes} phút trước`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} giờ ${m} phút trước` : `${h} giờ trước`;
}

function formatTimestampVi(iso: string | null): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function sanitizeSingleDialPhone(raw: string): string {
  const firstSegment = (raw || '').split(/[/,;|\-–—]/)[0] || raw || '';
  const cleaned = firstSegment.replace(/[^\d+]/g, '');
  return cleaned || '115';
}

function createPulsingBeaconIcon(status: BeaconStatus): L.DivIcon {
  const fillVar =
    status === 'sos'
      ? 'var(--color-error)'
      : status === 'paused'
      ? 'var(--color-sun)'
      : status === 'safe'
      ? 'var(--color-sky)'
      : 'var(--color-primary)';

  const pulseRing =
    status === 'active' || status === 'sos'
      ? `<circle cx="20" cy="20" r="8" fill="${fillVar}" opacity="0.36">
          <animate attributeName="r" from="7" to="19" dur="${status === 'sos' ? '1.1s' : '1.9s'}" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.55" to="0" dur="${status === 'sos' ? '1.1s' : '1.9s'}" repeatCount="indefinite" />
        </circle>`
      : '';

  return L.divIcon({
    className: 'lost-live-beacon-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -16],
    html: `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">${pulseRing}<circle cx="20" cy="20" r="9.5" fill="var(--color-bg-card)" stroke="${fillVar}" stroke-width="2.5" /><circle cx="20" cy="20" r="5.5" fill="${fillVar}" /></svg>`,
  });
}

function copyTextWithFallback(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => copyTextViaExecCommand(text));
  }
  return Promise.resolve(copyTextViaExecCommand(text));
}

function copyTextViaExecCommand(text: string): boolean {
  if (typeof document === 'undefined' || !document.body) return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

const BeaconMapViewportController: React.FC<{
  token: string;
  boundsPoints: [number, number][];
  recenterSignal: number;
}> = ({ token, boundsPoints, recenterSignal }) => {
  const map = useMap();
  const lastFittedTokenRef = useRef<string>('');
  const lastHandledSignalRef = useRef<number>(0);

  useEffect(() => {
    if (boundsPoints.length === 0) return;
    const needsInitialFit = lastFittedTokenRef.current !== token;
    const needsRecenter = recenterSignal > lastHandledSignalRef.current;
    if (!needsInitialFit && !needsRecenter) return;

    lastFittedTokenRef.current = token;
    lastHandledSignalRef.current = recenterSignal;

    if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 14, { animate: true });
    } else {
      const bounds = L.latLngBounds(boundsPoints);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
      }
    }
  }, [map, token, boundsPoints, recenterSignal]);

  return null;
};

interface BeaconFetchOutcome {
  kind: 'ready' | 'expired' | 'error' | 'aborted';
  beacon: NormalizedLiveBeacon | null;
  errorDetail: string;
}

async function loadLiveBeaconOnce(cleanToken: string, signal: AbortSignal): Promise<BeaconFetchOutcome> {
  try {
    const res = await fetch(`/api/live-beacons/${encodeURIComponent(cleanToken)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
    if (signal.aborted) {
      return { kind: 'aborted', beacon: null, errorDetail: '' };
    }

    if (res.status === 404 || res.status === 410) {
      return {
        kind: 'expired',
        beacon: null,
        errorDetail: 'Liên kết Live Beacon này đã hết hạn sau 48 giờ hoặc không tồn tại trên hệ thống LOST.',
      };
    }

    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (signal.aborted) {
      return { kind: 'aborted', beacon: null, errorDetail: '' };
    }

    if (!res.ok) {
      const msg =
        json && typeof json.message === 'string'
          ? json.message
          : `Không thể tải tín hiệu trực tiếp (Mã ${res.status}).`;
      return { kind: 'error', beacon: null, errorDetail: msg };
    }

    const normalized = normalizeLiveBeaconPayload(json, cleanToken);
    if (!normalized) {
      return {
        kind: 'expired',
        beacon: null,
        errorDetail: 'Dữ liệu hành trình trực tiếp không hợp lệ hoặc đã được thu hồi.',
      };
    }

    return { kind: 'ready', beacon: normalized, errorDetail: '' };
  } catch (err) {
    if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      return { kind: 'aborted', beacon: null, errorDetail: '' };
    }
    return {
      kind: 'error',
      beacon: null,
      errorDetail: 'Không kết nối được tới máy chủ LOST. Kiểm tra kết nối mạng và thử lại.',
    };
  }
}

export const LiveBeaconViewerPage: React.FC<LiveBeaconViewerPageProps> = ({
  token,
  trails,
  onBack,
  onSelectTrail,
}) => {
  const cleanToken = token.trim();
  const [beacon, setBeacon] = useState<NormalizedLiveBeacon | null>(null);
  const [loadState, setLoadState] = useState<{
    forToken: string;
    state: 'ready' | 'expired' | 'error';
  } | null>(null);
  const [errorDetail, setErrorDetail] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastPolledAt, setLastPolledAt] = useState<string | null>(null);
  const [tileKey, setTileKey] = useState<TileLayerKey>('topo');
  const [recenterSignal, setRecenterSignal] = useState<number>(0);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const [clockNowMs, setClockNowMs] = useState<number>(() => Date.now());

  const effectiveLoadState: 'loading' | 'ready' | 'expired' | 'error' = !cleanToken
    ? 'expired'
    : loadState && loadState.forToken === cleanToken
    ? loadState.state
    : 'loading';
  const activeFetchRef = useRef<AbortController | null>(null);
  const copiedTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const beaconStatusRef = useRef<BeaconStatus | null>(null);
  const loadStateRef = useRef<'loading' | 'ready' | 'expired' | 'error'>(effectiveLoadState);

  useEffect(() => {
    isMountedRef.current = true;
    const clockId = window.setInterval(() => {
      setClockNowMs(Date.now());
    }, 30_000);
    return () => {
      isMountedRef.current = false;
      window.clearInterval(clockId);
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    beaconStatusRef.current = beacon?.status ?? null;
  }, [beacon?.status]);

  useEffect(() => {
    loadStateRef.current = effectiveLoadState;
  }, [effectiveLoadState]);

  const handleManualRefresh = async () => {
    if (!cleanToken) return;
    activeFetchRef.current?.abort();
    const controller = new AbortController();
    activeFetchRef.current = controller;
    setIsRefreshing(true);

    const result = await loadLiveBeaconOnce(cleanToken, controller.signal);
    if (controller.signal.aborted || result.kind === 'aborted') return;

    if (result.kind === 'ready' && result.beacon) {
      setBeacon(result.beacon);
      setLoadState({ forToken: cleanToken, state: 'ready' });
      setErrorDetail('');
      setLastPolledAt(new Date().toISOString());
    } else if (result.kind === 'expired') {
      setBeacon(null);
      setLoadState({ forToken: cleanToken, state: 'expired' });
      setErrorDetail(result.errorDetail);
    } else {
      if (loadStateRef.current !== 'ready') {
        setLoadState({ forToken: cleanToken, state: 'error' });
      }
      setErrorDetail(result.errorDetail);
    }
    setIsRefreshing(false);
  };

  // Initial load + 15s auto-polling (pauses when status === 'safe' or document.hidden; cleans up on unmount)
  useEffect(() => {
    if (!cleanToken) return;

    const runPoll = async () => {
      activeFetchRef.current?.abort();
      const controller = new AbortController();
      activeFetchRef.current = controller;

      const result = await loadLiveBeaconOnce(cleanToken, controller.signal);
      if (controller.signal.aborted || result.kind === 'aborted') return;

      if (result.kind === 'ready' && result.beacon) {
        setBeacon(result.beacon);
        setLoadState({ forToken: cleanToken, state: 'ready' });
        setErrorDetail('');
        setLastPolledAt(new Date().toISOString());
      } else if (result.kind === 'expired') {
        setBeacon(null);
        setLoadState({ forToken: cleanToken, state: 'expired' });
        setErrorDetail(result.errorDetail);
      } else {
        if (loadStateRef.current !== 'ready') {
          setLoadState({ forToken: cleanToken, state: 'error' });
        }
        setErrorDetail(result.errorDetail);
      }
      setIsRefreshing(false);
    };

    void runPoll();

    const intervalId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (beaconStatusRef.current === 'safe') return;
      if (loadStateRef.current === 'expired') return;
      void runPoll();
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (typeof document === 'undefined' || document.hidden) return;
      if (beaconStatusRef.current === 'safe' || loadStateRef.current === 'expired') return;
      void runPoll();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      window.clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      activeFetchRef.current?.abort();
    };
  }, [cleanToken]);

  const matchedTrail = useMemo<Trail | null>(() => {
    if (!beacon || trails.length === 0) return null;
    if (beacon.trailId) {
      const exact = trails.find(
        (t) => t.id === beacon.trailId || (t as Trail & { _id?: string })._id === beacon.trailId
      );
      if (exact) return exact;
    }
    const lowerName = beacon.trailName.trim().toLowerCase();
    if (!lowerName) return null;
    const exactByName = trails.find((t) => t.name.trim().toLowerCase() === lowerName);
    if (exactByName) return exactByName;
    const byName = trails.find((t) => {
      const n = t.name.trim().toLowerCase();
      return n.length >= 5 && lowerName.includes(n);
    });
    return byName || null;
  }, [beacon, trails]);

  const referenceTrack = useMemo<[number, number][]>(() => {
    if (matchedTrail) {
      if (Array.isArray(matchedTrail.gpxTrack) && matchedTrail.gpxTrack.length >= 2) {
        return matchedTrail.gpxTrack;
      }
      return [
        [matchedTrail.startLat, matchedTrail.startLng],
        [matchedTrail.endLat, matchedTrail.endLng],
      ];
    }
    const summary = beacon?.trailSummary;
    if (!summary) return [];
    if (summary.gpxTrack.length >= 2) return summary.gpxTrack;
    return [
      [summary.startLat, summary.startLng],
      [summary.endLat, summary.endLng],
    ];
  }, [matchedTrail, beacon]);

  const breadcrumbCoords = useMemo<[number, number][]>(() => {
    if (!beacon) return [];
    const pts = beacon.breadcrumbs.map((b) => [b.lat, b.lng] as [number, number]);
    if (beacon.lastPosition) {
      const tail = pts[pts.length - 1];
      if (!tail || tail[0] !== beacon.lastPosition.lat || tail[1] !== beacon.lastPosition.lng) {
        pts.push([beacon.lastPosition.lat, beacon.lastPosition.lng]);
      }
    }
    return pts;
  }, [beacon]);

  const mapBoundsPoints = useMemo<[number, number][]>(() => {
    const out: [number, number][] = [];
    for (const pt of breadcrumbCoords) out.push(pt);
    for (const pt of referenceTrack) out.push(pt);
    if (out.length === 0 && beacon?.lastPosition) {
      out.push([beacon.lastPosition.lat, beacon.lastPosition.lng]);
    }
    return out;
  }, [breadcrumbCoords, referenceTrack, beacon]);

  const nearestRangers = useMemo<Array<{ station: RangerStationSeed; distanceKm: number }>>(() => {
    const anchor = beacon?.lastPosition
      ? { lat: beacon.lastPosition.lat, lng: beacon.lastPosition.lng }
      : matchedTrail
      ? { lat: matchedTrail.startLat, lng: matchedTrail.startLng }
      : beacon?.trailSummary
      ? { lat: beacon.trailSummary.startLat, lng: beacon.trailSummary.startLng }
      : { lat: 22.3364, lng: 103.8438 };

    return VIETNAM_RANGER_STATIONS.map((station) => ({
      station,
      distanceKm: calculateHaversineKm(
        anchor.lat,
        anchor.lng,
        station.coordinates.lat,
        station.coordinates.lng
      ),
    }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 3);
  }, [beacon, matchedTrail]);

  const pulsingIcon = useMemo(
    () => createPulsingBeaconIcon(beacon?.status ?? 'active'),
    [beacon?.status]
  );

  const handleCopyText = (text: string, label: string) => {
    void copyTextWithFallback(text).then((ok) => {
      if (!isMountedRef.current) return;
      setCopiedNotice(
        ok ? `Đã sao chép ${label}.` : 'Không thể sao chép tự động — hãy chọn và sao chép thủ công.'
      );
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = window.setTimeout(() => {
        if (isMountedRef.current) {
          setCopiedNotice(null);
        }
        copiedTimerRef.current = null;
      }, 2600);
    });
  };

  const activeTile = TILE_LAYERS[tileKey];

  // Loading Skeleton View
  if (effectiveLoadState === 'loading') {
    return (
      <section className="hub-container page-view-slide" aria-label="Đang tải tín hiệu Live Beacon LOST">
        <div className="card" style={{ padding: '32px 24px', textAlign: 'center', maxWidth: 640, margin: '32px auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--color-primary)', marginBottom: 12 }}>
            <IconRadio size={26} />
            <span className="section-eyebrow" style={{ margin: 0 }}>LOST LIVE FAMILY BEACON</span>
          </div>
          <h1 className="font-editorial" style={{ fontSize: '1.45rem', color: 'var(--color-text-main)', marginBottom: 8 }}>
            Đang kết nối tín hiệu hành trình trực tiếp...
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            Mã phiên theo dõi: {cleanToken.slice(0, 12)}...
          </p>
        </div>
      </section>
    );
  }

  // Clean 404 / Expired / Network Error View
  if (effectiveLoadState === 'expired' || effectiveLoadState === 'error' || !beacon) {
    const isExpired = effectiveLoadState === 'expired';
    return (
      <section className="hub-container page-view-slide" aria-label="Trạng thái liên kết Live Beacon">
        <div
          className="card"
          style={{
            maxWidth: 640,
            margin: '32px auto',
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 6,
                background: isExpired
                  ? 'color-mix(in srgb, var(--color-sun) 16%, var(--color-bg-card))'
                  : 'var(--banner-danger-bg)',
                border: isExpired
                  ? '1px solid color-mix(in srgb, var(--color-sun) 40%, var(--color-border))'
                  : '1px solid var(--banner-danger-border)',
                color: isExpired ? 'var(--color-sun)' : 'var(--banner-danger-text)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {isExpired ? <IconClock size={22} /> : <IconAlertTriangle size={22} />}
            </div>
            <div>
              <div className="section-eyebrow" style={{ marginBottom: 2 }}>
                LOST LIVE FAMILY BEACON
              </div>
              <h1 className="font-editorial" style={{ fontSize: '1.35rem', color: 'var(--color-text-main)' }}>
                {isExpired
                  ? 'Liên Kết Theo Dõi Đã Hết Hạn Hoặc Không Tồn Tại'
                  : 'Tạm Thời Không Tải Được Tín Hiệu Trực Tiếp'}
              </h1>
            </div>
          </div>

          <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            {errorDetail ||
              'Vì lý do bảo mật vị trí cá nhân, mỗi phiên chia sẻ vị trí Live Beacon trên LOST tự động hết hạn sau 48 giờ kể từ khi khởi tạo.'}
          </p>

          <div
            style={{
              padding: '12px 14px',
              borderRadius: 6,
              background: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border)',
              fontSize: '0.82rem',
              color: 'var(--color-text-muted)',
              lineHeight: 1.55,
            }}
          >
            Nếu bạn đang lo lắng về an toàn của người thân trên núi, hãy gọi trực tiếp đường dây nóng cấp cứu quốc gia{' '}
            <a href="tel:115" style={{ color: 'var(--color-error-text, var(--banner-danger-text))', fontWeight: 700, textDecoration: 'underline' }}>
              115
            </a>{' '}
            hoặc Cứu nạn cứu hộ{' '}
            <a href="tel:114" style={{ color: 'var(--color-error-text, var(--banner-danger-text))', fontWeight: 700, textDecoration: 'underline' }}>
              114
            </a>
            .
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {cleanToken && (
              <button type="button" className="btn btn-primary" onClick={handleManualRefresh}>
                <IconRotateCw size={15} />
                Thử Tải Lại
              </button>
            )}
            {onBack && (
              <button type="button" className="btn btn-secondary" onClick={onBack}>
                <IconArrowLeft size={15} />
                Về Trang Chủ LOST
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Drive elapsed minutes & stale-signal warning from live 30s local clock so outages never freeze display
  const liveMinutesSinceLastPing = (() => {
    const refIso = beacon.lastPosition?.recordedAt || beacon.updatedAt;
    if (refIso) {
      const parsedMs = Date.parse(refIso);
      if (Number.isFinite(parsedMs)) {
        return Math.max(0, Math.floor((clockNowMs - parsedMs) / 60_000));
      }
    }
    return beacon.minutesSinceLastPing;
  })();

  const liveIsSignalStale =
    beacon.status !== 'safe' &&
    (beacon.isSignalStale ||
      (liveMinutesSinceLastPing !== null && liveMinutesSinceLastPing > STALE_SIGNAL_THRESHOLD_MIN));

  // Status Banner Styling (100% CSS tokens + WCAG AA contrast)
  const statusBanner =
    beacon.status === 'sos'
      ? {
          bg: 'var(--banner-danger-bg)',
          border: 'var(--banner-danger-border)',
          text: 'var(--banner-danger-text)',
          badgeClass: 'badge-error',
          title: 'CẢNH BÁO SOS KHẨN CẤP',
          subtitle:
            beacon.emergencyNote ||
            'Người leo núi đã kích hoạt tín hiệu SOS khẩn cấp. Hãy liên hệ ngay Kiểm lâm / Cứu hộ gần nhất bên dưới và cung cấp chính xác tọa độ GPS.',
          icon: <IconShieldAlert size={22} />,
        }
      : beacon.status === 'safe'
      ? {
          bg: 'color-mix(in srgb, var(--color-sky) 13%, var(--color-bg-card))',
          border: 'color-mix(in srgb, var(--color-sky) 42%, var(--color-border))',
          text: 'var(--color-text-main)',
          badgeClass: 'badge-info',
          title: 'Đã Về Đích An Toàn',
          subtitle: 'Người leo núi đã xác nhận kết thúc hành trình an toàn. Tự động cập nhật đã tạm dừng.',
          icon: <IconCheckCircle size={22} color="var(--color-sky)" />,
        }
      : beacon.status === 'paused'
      ? {
          bg: 'color-mix(in srgb, var(--color-sun) 13%, var(--color-bg-card))',
          border: 'color-mix(in srgb, var(--color-sun) 44%, var(--color-border))',
          text: 'var(--color-text-main)',
          badgeClass: 'badge-sun',
          title: 'Tạm Dừng Nghỉ Chân',
          subtitle: 'Thiết bị đang tạm dừng ghi GPS. Trang vẫn tự động làm mới mỗi 15 giây.',
          icon: <IconClock size={22} color="var(--color-sun)" />,
        }
      : {
          bg: 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-card))',
          border: 'var(--color-border-glow)',
          text: 'var(--color-text-main)',
          badgeClass: 'badge-success',
          title: 'Đang Di Chuyển — Phát Tín Hiệu Trực Tiếp',
          subtitle: 'Tự động cập nhật vị trí GPS mỗi 15 giây khi đang mở trang.',
          icon: <IconRadio size={22} color="var(--color-primary)" />,
        };

  const latDms = beacon.lastPosition ? decimalToDms(beacon.lastPosition.lat, true) : null;
  const lngDms = beacon.lastPosition ? decimalToDms(beacon.lastPosition.lng, false) : null;
  const initialMapCenter: [number, number] = beacon.lastPosition
    ? [beacon.lastPosition.lat, beacon.lastPosition.lng]
    : referenceTrack[0] || [22.3033, 103.775];

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/beacon/${encodeURIComponent(beacon.token)}`
      : `/beacon/${beacon.token}`;

  const googleMapsUrl = beacon.lastPosition
    ? `https://www.google.com/maps?q=${beacon.lastPosition.lat.toFixed(6)},${beacon.lastPosition.lng.toFixed(6)}`
    : null;

  return (
    <section className="hub-container page-view-slide" aria-label={`Theo dõi hành trình trực tiếp của ${beacon.displayName}`}>
      {/* Top Action Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 14,
          marginBottom: 16,
        }}
      >
        <div>
          <div className="section-eyebrow">LOST LIVE FAMILY BEACON • THEO DÕI AN TOÀN TRỰC TIẾP</div>
          <h1
            className="font-editorial"
            style={{
              fontSize: 'clamp(1.45rem, 3vw, 2.15rem)',
              color: 'var(--color-text-main)',
              lineHeight: 1.18,
              marginBottom: 4,
            }}
          >
            {beacon.displayName} — {beacon.trailName}
          </h1>
          <p style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            Cập nhật gần nhất: <strong>{formatRelativeMinutesVi(liveMinutesSinceLastPing)}</strong> ({formatTimestampVi(beacon.updatedAt)})
            {lastPolledAt ? ` • Đồng bộ trang lúc ${formatTimestampVi(lastPolledAt)}` : ''}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isRefreshing}
            onClick={handleManualRefresh}
          >
            <IconRotateCw size={15} />
            {isRefreshing ? 'Đang tải...' : 'Làm Mới'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleCopyText(shareUrl, 'liên kết theo dõi Live Beacon')}
          >
            <IconShare size={15} />
            Sao Chép Link
          </button>
          {onBack && (
            <button type="button" className="btn btn-outline" onClick={onBack}>
              <IconArrowLeft size={15} />
              Trang Chủ
            </button>
          )}
        </div>
      </div>

      {copiedNotice && (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: '8px 12px',
            borderRadius: 4,
            background: 'color-mix(in srgb, var(--color-primary) 14%, var(--color-bg-card))',
            border: '1px solid var(--color-border-glow)',
            color: 'var(--color-text-main)',
            fontSize: '0.82rem',
            fontWeight: 600,
          }}
        >
          {copiedNotice}
        </div>
      )}

      {/* High-Contrast Status Banner */}
      <div
        role={beacon.status === 'sos' ? 'alert' : 'status'}
        style={{
          padding: '14px 16px',
          borderRadius: 6,
          background: statusBanner.bg,
          border: `1px solid ${statusBanner.border}`,
          color: statusBanner.text,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: '1 1 300px' }}>
          <div style={{ marginTop: 2, flexShrink: 0 }}>{statusBanner.icon}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
              <strong style={{ fontSize: '1rem' }}>{statusBanner.title}</strong>
              <span className={`badge ${statusBanner.badgeClass}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {beacon.status === 'sos'
                  ? 'SOS'
                  : beacon.status === 'safe'
                  ? 'AN TOÀN'
                  : beacon.status === 'paused'
                  ? 'TẠM DỪNG'
                  : 'LIVE 15s'}
              </span>
            </div>
            <p style={{ fontSize: '0.84rem', lineHeight: 1.5, margin: 0, opacity: 0.94 }}>
              {statusBanner.subtitle}
            </p>
          </div>
        </div>

        {beacon.status === 'sos' && nearestRangers[0] && (
          <a
            href={`tel:${sanitizeSingleDialPhone(
              nearestRangers[0].station.emergencyPhone || nearestRangers[0].station.hotlinePhone
            )}`}
            className="btn btn-danger"
            style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            <IconPhoneCall size={15} />
            Gọi Khẩn Kiểm Lâm Gần Nhất
          </a>
        )}
      </div>

      {/* Stale Signal Warning (>45 minutes while not safe) */}
      {liveIsSignalStale && (
        <div
          role="alert"
          style={{
            padding: '12px 15px',
            borderRadius: 6,
            background: 'color-mix(in srgb, var(--color-sun) 16%, var(--color-bg-card))',
            border: '1px solid color-mix(in srgb, var(--color-sun) 50%, var(--color-border))',
            color: 'var(--color-text-main)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <IconAlertTriangle size={20} color="var(--color-sun)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: '0.84rem', lineHeight: 1.55 }}>
            <strong style={{ display: 'block', marginBottom: 2 }}>
              Cảnh báo tín hiệu chậm ({formatRelativeMinutesVi(liveMinutesSinceLastPing)})
            </strong>
            <span>
              Chưa nhận được ping GPS mới trong hơn 45 phút. Các sườn núi cao hoặc thung lũng rừng sâu tại Việt Nam thường
              mất sóng 4G/2G tạm thời — hãy đối chiếu lịch trình dự kiến và liên hệ trạm Kiểm lâm gần nhất bên dưới nếu quá
              giờ hẹn an toàn.
            </span>
          </div>
        </div>
      )}

      {/* Primary Telemetry Strip */}
      <div className="editorial-stat-strip" style={{ marginBottom: 16 }}>
        <div className="editorial-stat-cell">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
            <IconClock size={12} />
            Tín Hiệu Cuối
          </span>
          <strong style={{ fontSize: '1.1rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
            {formatRelativeMinutesVi(liveMinutesSinceLastPing)}
          </strong>
          <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {formatTimestampVi(beacon.updatedAt)} • {beacon.breadcrumbs.length} điểm vệt
          </span>
        </div>

        <div className="editorial-stat-cell">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
            <IconMountain size={12} />
            Cao Độ / Leo Tích Lũy
          </span>
          <strong style={{ fontSize: '1.3rem', color: 'var(--color-earth)', fontVariantNumeric: 'tabular-nums' }}>
            {beacon.lastPosition?.altitudeM !== null && beacon.lastPosition?.altitudeM !== undefined
              ? `${beacon.lastPosition.altitudeM}m`
              : '--'}
          </strong>
          <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            +{beacon.elevationGainM}m • Quãng đường {beacon.distanceKm.toFixed(2)} km
          </span>
        </div>

        <div className="editorial-stat-cell" style={{ minWidth: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
            <IconMapPin size={12} />
            Tọa Độ WGS84
          </span>
          <strong
            style={{
              fontSize: '0.98rem',
              color: 'var(--color-primary)',
              fontVariantNumeric: 'tabular-nums',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            {beacon.lastPosition
              ? `${beacon.lastPosition.lat.toFixed(5)}, ${beacon.lastPosition.lng.toFixed(5)}`
              : 'Chưa có tọa độ'}
          </strong>
          <span
            style={{
              fontSize: '0.72rem',
              color: 'var(--color-text-muted)',
              fontVariantNumeric: 'tabular-nums',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            {latDms && lngDms ? `${latDms.formatted} • ${lngDms.formatted}` : 'Đang chờ vệ tinh GPS'}
          </span>
        </div>

        <div className="editorial-stat-cell">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
            <IconBatterySvg percent={beacon.batteryPercent} size={14} />
            Pin Thiết Bị
          </span>
          <strong
            style={{
              fontSize: '1.3rem',
              color:
                beacon.batteryPercent !== null && beacon.batteryPercent <= 20
                  ? 'var(--color-error-text, var(--banner-danger-text))'
                  : 'var(--color-text-main)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {beacon.batteryPercent !== null ? `${beacon.batteryPercent}%` : 'Không rõ'}
          </strong>
          <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {beacon.lastPosition?.accuracyM !== null && beacon.lastPosition?.accuracyM !== undefined
              ? `Độ chính xác ±${beacon.lastPosition.accuracyM}m`
              : beacon.expiresAt
              ? `Hết hạn ${formatTimestampVi(beacon.expiresAt)}`
              : 'Hiệu lực 48 giờ'}
          </span>
        </div>
      </div>

      {/* Interactive Live Leaflet Map + Right Tactical Sidebar */}
      <div className="route-planner-split" style={{ gap: 16 }}>
        {/* Left: Interactive Leaflet Map */}
        <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(Object.keys(TILE_LAYERS) as TileLayerKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={tileKey === key ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                  onClick={() => setTileKey(key)}
                >
                  {TILE_LAYERS[key].label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '5px 9px', fontSize: '0.75rem' }}
                onClick={() => setRecenterSignal((c) => c + 1)}
              >
                <IconCrosshairSvg size={14} />
                Căn Giữa Vị Trí
              </button>
              {beacon.lastPosition && (
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '5px 9px', fontSize: '0.75rem' }}
                  onClick={() =>
                    handleCopyText(
                      `${beacon.lastPosition!.lat.toFixed(6)}, ${beacon.lastPosition!.lng.toFixed(6)}`,
                      'tọa độ GPS'
                    )
                  }
                >
                  <IconCopy size={13} />
                  Chép GPS
                </button>
              )}
              {googleMapsUrl && (
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                  style={{ padding: '5px 9px', fontSize: '0.75rem', textDecoration: 'none' }}
                >
                  <IconExternalSvg size={13} />
                  Google Maps
                </a>
              )}
            </div>
          </div>

          <div
            style={{
              height: 'clamp(340px, 50vh, 520px)',
              width: '100%',
              borderRadius: 6,
              overflow: 'hidden',
              border: '1px solid var(--color-border)',
            }}
          >
            <MapContainer
              key={beacon.token}
              center={initialMapCenter}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                key={tileKey}
                url={activeTile.url}
                attribution={activeTile.attribution}
                maxZoom={activeTile.maxZoom}
              />
              <BeaconMapViewportController
                token={beacon.token}
                boundsPoints={mapBoundsPoints}
                recenterSignal={recenterSignal}
              />

              {/* Canonical LOST Reference GPX Track (dashed) */}
              {referenceTrack.length >= 2 && (
                <Polyline
                  positions={referenceTrack}
                  pathOptions={{
                    color: 'var(--color-sky)',
                    weight: 3,
                    opacity: 0.72,
                    dashArray: '6 6',
                  }}
                />
              )}

              {/* Live Hiker Breadcrumbs Track */}
              {breadcrumbCoords.length >= 2 && (
                <Polyline
                  positions={breadcrumbCoords}
                  pathOptions={{
                    color: beacon.status === 'sos' ? 'var(--color-error)' : 'var(--color-primary)',
                    weight: 4,
                    opacity: 0.95,
                  }}
                />
              )}

              {/* First Recorded Breadcrumb Anchor */}
              {breadcrumbCoords.length >= 2 && (
                <CircleMarker
                  center={breadcrumbCoords[0]}
                  radius={5}
                  pathOptions={{
                    color: 'var(--color-on-media)',
                    fillColor: 'var(--color-earth)',
                    fillOpacity: 1,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <strong>Điểm bắt đầu phát tín hiệu</strong>
                    <br />
                    {formatTimestampVi(beacon.breadcrumbs[0]?.recordedAt || null)}
                  </Popup>
                </CircleMarker>
              )}

              {/* Pulsing Current Hiker Position Marker */}
              {beacon.lastPosition && (
                <Marker
                  position={[beacon.lastPosition.lat, beacon.lastPosition.lng]}
                  icon={pulsingIcon}
                >
                  <Popup>
                    <div style={{ fontSize: '0.82rem', lineHeight: 1.45 }}>
                      <strong>{beacon.displayName}</strong>
                      <br />
                      {beacon.trailName}
                      <br />
                      Tọa độ: {beacon.lastPosition.lat.toFixed(5)}, {beacon.lastPosition.lng.toFixed(5)}
                      {beacon.lastPosition.altitudeM !== null ? (
                        <>
                          <br />
                          Cao độ: {beacon.lastPosition.altitudeM}m
                        </>
                      ) : null}
                      <br />
                      Cập nhật: {formatTimestampVi(beacon.lastPosition.recordedAt || beacon.updatedAt)}
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 14,
              fontSize: '0.75rem',
              color: 'var(--color-text-muted)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 16,
                  height: 3,
                  background: beacon.status === 'sos' ? 'var(--color-error)' : 'var(--color-primary)',
                  display: 'inline-block',
                  borderRadius: 2,
                }}
              />
              Vệt GPS thực tế ({breadcrumbCoords.length} điểm)
            </span>
            {referenceTrack.length >= 2 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 16,
                    height: 0,
                    borderTop: '2px dashed var(--color-sky)',
                    display: 'inline-block',
                  }}
                />
                Tuyến GPX chuẩn LOST
              </span>
            )}
          </div>
        </div>

        {/* Right: Matched Trail + Nearest Verified VQG / Ranger Hotlines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Trail Info Card */}
          <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconCompass size={17} color="var(--color-primary)" />
              <h2 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                Thông Tin Cung Đường
              </h2>
            </div>

            <div style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
              <strong style={{ color: 'var(--color-text-main)', display: 'block', marginBottom: 2 }}>
                {beacon.trailName}
              </strong>
              {matchedTrail ? (
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {matchedTrail.province} • {matchedTrail.distanceKm} km • Đỉnh {matchedTrail.maxAltitudeM}m • Leo +
                  {matchedTrail.elevationGainM}m
                </span>
              ) : beacon.trailSummary ? (
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {beacon.trailSummary.province ? `${beacon.trailSummary.province} • ` : ''}
                  {beacon.trailSummary.distanceKm} km • Đỉnh {beacon.trailSummary.maxAltitudeM}m • Leo +
                  {beacon.trailSummary.elevationGainM}m
                </span>
              ) : (
                <span>Hành trình tự thiết kế hoặc leo núi tự do trên hệ thống LOST.</span>
              )}
            </div>

            {matchedTrail && onSelectTrail && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ alignSelf: 'flex-start', padding: '7px 12px', fontSize: '0.8rem' }}
                onClick={() => onSelectTrail(matchedTrail)}
              >
                Xem Chi Tiết Cung Đường
                <IconArrowRight size={14} />
              </button>
            )}
          </div>

          {/* Nearest Verified Vietnam Ranger Stations */}
          <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconShieldCheck size={17} color="var(--color-error-text, var(--color-error))" />
                <h2 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                  Trạm Kiểm Lâm & Cứu Hộ Gần Nhất
                </h2>
              </div>
              <span className="badge badge-cloud">Xác thực 100%</span>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.45, margin: 0 }}>
              Tự động sắp xếp theo khoảng cách thực tế tới tọa độ GPS cuối cùng của người leo núi.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {nearestRangers.map(({ station, distanceKm }) => {
                const dialNumber = sanitizeSingleDialPhone(station.emergencyPhone || station.hotlinePhone);
                return (
                  <div
                    key={station.slug}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      background: 'var(--color-surface-elevated)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <strong style={{ fontSize: '0.84rem', color: 'var(--color-text-main)', lineHeight: 1.35 }}>
                        {station.name}
                      </strong>
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: 'var(--color-primary)',
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        ~{distanceKm.toFixed(1)} km
                      </span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {station.district}, {station.province} • {station.officeHours}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                        {station.emergencyPhone || station.hotlinePhone}
                      </span>
                      <a
                        href={`tel:${dialNumber}`}
                        className="btn btn-danger"
                        style={{ padding: '5px 10px', fontSize: '0.74rem', textDecoration: 'none' }}
                      >
                        <IconPhoneCall size={13} />
                        Gọi Ngay
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* National Vietnam Emergency Numbers */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 6,
                paddingTop: 8,
                borderTop: '1px solid var(--color-border)',
              }}
            >
              {[
                { num: '115', label: 'Cấp Cứu' },
                { num: '114', label: 'Cứu Nạn' },
                { num: '112', label: 'Tìm Kiếm VN' },
              ].map((em) => (
                <a
                  key={em.num}
                  href={`tel:${em.num}`}
                  className="btn btn-outline"
                  style={{
                    padding: '6px 4px',
                    fontSize: '0.74rem',
                    textDecoration: 'none',
                    flexDirection: 'column',
                    gap: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <strong style={{ color: 'var(--color-error-text, var(--banner-danger-text))', fontSize: '0.88rem' }}>{em.num}</strong>
                  <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{em.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LiveBeaconViewerPage;
