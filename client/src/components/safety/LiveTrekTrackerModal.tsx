import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Trail, User } from '../../types.js';
import { isTopmostFocusTrap, useFocusTrap } from '../../hooks/useFocusTrap.js';
import { distanceToTrackMeters, haversineMeters } from '../../utils/geoMath.js';
import { exportGpxXml, type PlannerWaypoint, type RouteVertex } from '../../utils/routeMetrics.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import {
  calculateBearingDeg,
  calculateHaversineKm,
  getCardinalDirectionLabel,
} from '../../utils/solarMath.js';
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconClock,
  IconCompass,
  IconCopy,
  IconDownload,
  IconImage,
  IconMapPin,
  IconMountain,
  IconPlus,
  IconRadio,
  IconShare,
  IconShieldAlert,
  IconShieldCheck,
  IconTrash,
  IconX,
} from '../common/SvgIcons.js';
import {
  ExpeditionShareCardModal,
  type ExpeditionShareCardModalProps,
} from '../common/ExpeditionShareCardModal.js';
import type { ExpeditionSharePoint } from '../../utils/expeditionShareCard.js';

export interface LiveTrekTrackerModalProps {
  isOpen: boolean;
  trail?: Trail | null;
  trails?: Trail[];
  currentUser?: User | null;
  onClose: () => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type TrackerMode = 'gps' | 'sim';
type TrackerStatus = 'idle' | 'recording' | 'paused' | 'finished';
type FieldPinKind = 'water' | 'camp' | 'danger' | 'viewpoint';
type LiveBeaconLifecycle = 'idle' | 'starting' | 'active' | 'paused' | 'sos' | 'safe' | 'error';

interface BatteryManagerLike {
  level: number;
  charging?: boolean;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManagerLike>;
}

interface LiveSamplePoint {
  lat: number;
  lng: number;
  altitudeM: number | null;
  accuracyM: number | null;
  speedKmH: number | null;
  timestamp: number;
}

interface OfflineTrekLogEntry {
  id: string;
  trailId: string;
  trailName: string;
  recordedAt: string;
  elapsedSec: number;
  distanceKm: number;
  elevationGainM: number;
  maxAltitudeM: number;
  pointsCount: number;
  pinsCount: number;
  syncedToServer: boolean;
}

interface CustomTrackedRoute {
  id: string;
  shareSlug: string;
  title: string;
  province?: string;
  baseTrailId?: string;
  trackPoints: [number, number][];
  elevations?: number[];
  waypoints: Array<{
    id: string;
    name: string;
    type: string;
    lat: number;
    lng: number;
    elevationM?: number;
  }>;
  distanceKm: number;
  elevationGainM: number;
  maxAltitudeM: number;
  isLocalOnly?: boolean;
}

const OFFLINE_TREKS_STORAGE_KEY = 'lost_live_treks_v1';
const LOCAL_CUSTOM_ROUTES_KEY = 'lost_custom_routes_v1';
const OFF_TRAIL_THRESHOLD_M = 100;
const BEACON_PING_INTERVAL_MS = 20_000;

async function readDeviceBatteryPercent(): Promise<number | null> {
  try {
    if (typeof navigator === 'undefined') return null;
    const nav = navigator as NavigatorWithBattery;
    if (typeof nav.getBattery !== 'function') return null;
    const battery = await nav.getBattery();
    if (!battery || typeof battery.level !== 'number' || !Number.isFinite(battery.level)) return null;
    return Math.max(0, Math.min(100, Math.round(battery.level * 100)));
  } catch {
    return null;
  }
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

function copyTextWithFallback(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => copyTextViaExecCommand(text));
  }
  return Promise.resolve(copyTextViaExecCommand(text));
}

function normalizeCustomRouteRecord(raw: unknown): CustomTrackedRoute | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const rawTrack = Array.isArray(r.trackPoints) ? r.trackPoints : [];
  const trackPoints: [number, number][] = [];
  const extractedEles: number[] = [];
  let hasEmbeddedEle = false;

  for (const pt of rawTrack) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const lat = Number(pt[0]);
    const lng = Number(pt[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    trackPoints.push([lat, lng]);
    if (pt.length >= 3 && Number.isFinite(Number(pt[2]))) {
      extractedEles.push(Math.round(Number(pt[2])));
      hasEmbeddedEle = true;
    }
  }
  if (trackPoints.length < 2) return null;

  const rawEles = Array.isArray(r.elevations)
    ? r.elevations.map((e) => (Number.isFinite(Number(e)) ? Math.round(Number(e)) : 0))
    : undefined;
  const elevations = hasEmbeddedEle && extractedEles.length === trackPoints.length ? extractedEles : rawEles;

  const rawWps = Array.isArray(r.waypoints) ? r.waypoints : [];
  const waypoints: CustomTrackedRoute['waypoints'] = [];
  for (const w of rawWps) {
    if (!w || typeof w !== 'object') continue;
    const wo = w as Record<string, unknown>;
    const lat = Number(wo.lat);
    const lng = Number(wo.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    waypoints.push({
      id: typeof wo.id === 'string' ? wo.id : `wpt-${waypoints.length + 1}`,
      name: typeof wo.name === 'string' && wo.name.trim() ? wo.name : `Mốc #${waypoints.length + 1}`,
      type: typeof wo.type === 'string' ? wo.type : 'viewpoint',
      lat,
      lng,
      elevationM: Number.isFinite(Number(wo.elevationM)) ? Math.round(Number(wo.elevationM)) : undefined,
    });
  }

  const metricsObj = r.metrics && typeof r.metrics === 'object' ? (r.metrics as Record<string, unknown>) : {};
  const id = String(r.id || r._id || r.shareSlug || `custom-${trackPoints.length}`);
  const shareSlug = String(r.shareSlug || id);
  const title = typeof r.title === 'string' && r.title.trim() ? r.title.trim() : 'Cung Tự Vẽ LOST';

  return {
    id,
    shareSlug,
    title,
    province: typeof r.province === 'string' ? r.province : undefined,
    baseTrailId: typeof r.baseTrailId === 'string' ? r.baseTrailId : undefined,
    trackPoints,
    elevations,
    waypoints,
    distanceKm: Number.isFinite(Number(metricsObj.distanceKm)) ? Number(metricsObj.distanceKm) : 0,
    elevationGainM: Number.isFinite(Number(metricsObj.elevationGainM)) ? Math.round(Number(metricsObj.elevationGainM)) : 0,
    maxAltitudeM: Number.isFinite(Number(metricsObj.maxAltitudeM)) ? Math.round(Number(metricsObj.maxAltitudeM)) : 1200,
    isLocalOnly: Boolean(r.isLocalOnly),
  };
}

function loadLocalCustomRoutes(): CustomTrackedRoute[] {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOM_ROUTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeCustomRouteRecord)
      .filter((item): item is CustomTrackedRoute => item !== null);
  } catch {
    return [];
  }
}

const FIELD_PIN_META: Record<FieldPinKind, { label: string; colorVar: string }> = {
  water: { label: 'Nguồn nước / Suối', colorVar: 'var(--color-sky)' },
  camp: { label: 'Điểm hạ trại / Lán', colorVar: 'var(--color-earth)' },
  danger: { label: 'Cảnh báo nguy hiểm', colorVar: 'var(--color-error)' },
  viewpoint: { label: 'Điểm ngắm / Săn mây', colorVar: 'var(--color-primary)' },
};

const IconPlaySvg: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="6 4 20 12 6 20 6 4" />
  </svg>
);

const IconPauseSvg: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

const IconStopSvg: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <rect x="5" y="5" width="14" height="14" rx="2" />
  </svg>
);

const IconVolumeSvg: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

const IconBeaconOpenSvg: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

function formatElapsedHms(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatPaceMinPerKm(distanceKm: number, elapsedSec: number): string {
  if (distanceKm < 0.03 || elapsedSec < 5) return '--:--';
  const minPerKm = elapsedSec / 60 / distanceKm;
  if (!Number.isFinite(minPerKm) || minPerKm > 99) return '--:--';
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  if (secs >= 60) return `${mins + 1}:00`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function buildSimulatedPath(
  trail: Trail | null,
  customRoute: CustomTrackedRoute | null
): Array<{ lat: number; lng: number; altitudeM: number }> {
  const rawTrack: [number, number][] =
    customRoute && customRoute.trackPoints.length >= 2
      ? customRoute.trackPoints
      : trail && Array.isArray(trail.gpxTrack) && trail.gpxTrack.length >= 2
      ? trail.gpxTrack
      : trail
      ? [
          [trail.startLat, trail.startLng],
          [trail.endLat, trail.endLng],
        ]
      : [
          [22.3522, 103.7769],
          [22.339, 103.7765],
          [22.326, 103.7758],
          [22.314, 103.7754],
          [22.3033, 103.775],
        ];

  const maxAlt = customRoute?.maxAltitudeM ?? trail?.maxAltitudeM ?? 3143;
  const gainM = customRoute?.elevationGainM ?? trail?.elevationGainM ?? 1380;
  const baseAlt = Math.max(100, maxAlt - gainM);
  const customEles =
    customRoute && Array.isArray(customRoute.elevations) && customRoute.elevations.length === rawTrack.length
      ? customRoute.elevations
      : null;

  const stepsPerSeg = Math.max(2, Math.ceil(40 / Math.max(1, rawTrack.length - 1)));
  const out: Array<{ lat: number; lng: number; altitudeM: number }> = [];
  const totalSteps = (rawTrack.length - 1) * stepsPerSeg;

  for (let i = 0; i < rawTrack.length - 1; i++) {
    const [lat1, lng1] = rawTrack[i];
    const [lat2, lng2] = rawTrack[i + 1];
    for (let s = 0; s < stepsPerSeg; s++) {
      const t = s / stepsPerSeg;
      const globalIdx = i * stepsPerSeg + s;
      const progress = totalSteps > 0 ? globalIdx / totalSteps : 0;
      const alt = customEles
        ? Math.round(customEles[i] + (customEles[i + 1] - customEles[i]) * t)
        : Math.round(baseAlt + (maxAlt - baseAlt) * Math.pow(progress, 0.85));
      out.push({
        lat: Number((lat1 + (lat2 - lat1) * t).toFixed(6)),
        lng: Number((lng1 + (lng2 - lng1) * t).toFixed(6)),
        altitudeM: alt,
      });
    }
  }
  const last = rawTrack[rawTrack.length - 1];
  const lastAlt = customEles ? customEles[customEles.length - 1] : maxAlt;
  out.push({ lat: last[0], lng: last[1], altitudeM: lastAlt });
  return out;
}

function resolveLiveTrekStorageKey(user?: User | null): string {
  const userObj = user as (User & { _id?: string }) | null | undefined;
  const directUid = userObj?.id || userObj?._id;
  if (typeof directUid === 'string' && directUid.trim()) {
    const clean = directUid.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (clean) return `${OFFLINE_TREKS_STORAGE_KEY}_${clean}`;
  }
  if (typeof window !== 'undefined' && typeof atob === 'function') {
    try {
      const token = window.localStorage.getItem('lost_token');
      const parts = token ? token.split('.') : [];
      if (parts.length >= 2) {
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
        const decoded = JSON.parse(atob(padded)) as Record<string, unknown>;
        const candidate = decoded.id ?? decoded.userId ?? decoded._id ?? decoded.sub;
        if (typeof candidate === 'string' && candidate.trim()) {
          const clean = candidate.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
          if (clean) return `${OFFLINE_TREKS_STORAGE_KEY}_${clean}`;
        }
      }
    } catch {
      // Ignore malformed JWT
    }
  }
  return `${OFFLINE_TREKS_STORAGE_KEY}_guest`;
}

function saveOfflineTrekSummary(entry: OfflineTrekLogEntry, storageKey: string) {
  try {
    const raw = localStorage.getItem(storageKey);
    const existing: OfflineTrekLogEntry[] = raw ? JSON.parse(raw) : [];
    const safeList = Array.isArray(existing) ? existing : [];
    localStorage.setItem(storageKey, JSON.stringify([entry, ...safeList].slice(0, 25)));
    localStorage.removeItem(OFFLINE_TREKS_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export const LiveTrekTrackerModal: React.FC<LiveTrekTrackerModalProps> = ({
  isOpen,
  trail,
  trails = [],
  currentUser,
  onClose,
  onShowToast,
}) => {
  const [manualSelection, setManualSelection] = useState<{
    forPropTrailId: string | undefined;
    trailId: string;
  } | null>(null);
  const selectedTrailId =
    (manualSelection && manualSelection.forPropTrailId === trail?.id ? manualSelection.trailId : null) ??
    trail?.id ??
    trails[0]?.id ??
    'free';
  const [mode, setMode] = useState<TrackerMode>('gps');
  const [status, setStatus] = useState<TrackerStatus>('idle');
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  const [points, setPoints] = useState<LiveSamplePoint[]>([]);
  const [fieldPins, setFieldPins] = useState<PlannerWaypoint[]>([]);
  const [pinKind, setPinKind] = useState<FieldPinKind>('water');
  const [pinNote, setPinNote] = useState<string>('');

  const [alarmSoundEnabled, setAlarmSoundEnabled] = useState<boolean>(true);
  const [shareCardSnapshot, setShareCardSnapshot] = useState<
    ExpeditionShareCardModalProps['initialData'] | null
  >(null);
  const showShareCardModal = Boolean(shareCardSnapshot);
  const [simDeviateOffTrail, setSimDeviateOffTrail] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState<boolean>(false);
  const [checkinCompleted, setCheckinCompleted] = useState<boolean>(false);

  // Live Family GPS Beacon state (/api/live-beacons)
  const [beaconEnabled, setBeaconEnabled] = useState<boolean>(false);
  const [beaconToken, setBeaconToken] = useState<string | null>(null);
  const [beaconSharePath, setBeaconSharePath] = useState<string | null>(null);
  const [beaconState, setBeaconState] = useState<LiveBeaconLifecycle>('idle');
  const [beaconBatteryPct, setBeaconBatteryPct] = useState<number | null>(null);
  const [beaconLastPingLabel, setBeaconLastPingLabel] = useState<string | null>(null);
  const [beaconError, setBeaconError] = useState<string | null>(null);
  const [beaconSosActive, setBeaconSosActive] = useState<boolean>(false);
  const [beaconBusy, setBeaconBusy] = useState<boolean>(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(isOpen, dialogRef);

  const watchIdRef = useRef<number | null>(null);
  const simStepRef = useRef<number>(0);
  const simDeviateRef = useRef<boolean>(false);
  const alarmAudioCtxRef = useRef<AudioContext | null>(null);
  const lastAlarmBeepMsRef = useRef<number>(0);
  const alarmSoundRef = useRef<boolean>(alarmSoundEnabled);
  const onShowToastRef = useRef(onShowToast);
  const isMountedRef = useRef<boolean>(true);
  const statusRef = useRef<TrackerStatus>(status);
  const beaconTokenRef = useRef<string | null>(null);
  const beaconStartingRef = useRef<boolean>(false);
  const beaconStoppingRef = useRef<boolean>(false);
  const beaconSosRef = useRef<boolean>(false);
  const sosInFlightRef = useRef<boolean>(false);
  const beaconHasSentFirstPosRef = useRef<boolean>(false);
  const lastBeaconPingMsRef = useRef<number>(0);
  const beaconPingAbortRef = useRef<AbortController | null>(null);
  const beaconSosAbortRef = useRef<AbortController | null>(null);
  const checkinAbortRef = useRef<AbortController | null>(null);
  const latestTelemetryRef = useRef<{
    latest: LiveSamplePoint | null;
    distanceKm: number;
    gainM: number;
  }>({ latest: null, distanceKm: 0, gainM: 0 });
  const startBeaconRef = useRef<
    (initialPoint?: LiveSamplePoint | null, initialStatus?: 'active' | 'paused') => Promise<void>
  >(async () => undefined);
  const pingBeaconRef = useRef<
    (opts?: {
      force?: boolean;
      statusOverride?: 'active' | 'paused' | 'sos';
      emergencyNote?: string;
      isSosMutation?: boolean;
    }) => Promise<boolean>
  >(async () => false);
  const stopBeaconRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      checkinAbortRef.current?.abort();
      checkinAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    onShowToastRef.current = onShowToast;
  }, [onShowToast]);

  useEffect(() => {
    simDeviateRef.current = simDeviateOffTrail;
  }, [simDeviateOffTrail]);

  useEffect(() => {
    alarmSoundRef.current = alarmSoundEnabled;
  }, [alarmSoundEnabled]);

  const [customRoutes, setCustomRoutes] = useState<CustomTrackedRoute[]>(loadLocalCustomRoutes);
  const currentUserId = currentUser?.id || '';

  // Load saved custom routes from localStorage + GET /api/custom-routes/me when signed in (with AbortController)
  useEffect(() => {
    if (!isOpen) return;
    const localList = loadLocalCustomRoutes();
    const controller = new AbortController();

    const syncCustomRoutes = async () => {
      if (!currentUserId) {
        if (!controller.signal.aborted) setCustomRoutes(localList);
        return;
      }
      try {
        const res = await fetch('/api/custom-routes/me', {
          headers: getApiHeaders(),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const json = (await res.json().catch(() => null)) as { success?: boolean; data?: unknown[] } | null;
        if (controller.signal.aborted) return;
        if (res.ok && json?.success && Array.isArray(json.data)) {
          const localBySlug = new Map(localList.map((r) => [r.shareSlug, r]));
          const cloudList = json.data
            .map(normalizeCustomRouteRecord)
            .filter((item): item is CustomTrackedRoute => item !== null)
            .map((item) => {
              const localMatch = localBySlug.get(item.shareSlug);
              return {
                ...item,
                elevations: item.elevations || localMatch?.elevations,
                isLocalOnly: false,
              };
            });
          const seen = new Set(cloudList.map((c) => c.shareSlug));
          setCustomRoutes([...cloudList, ...localList.filter((l) => !seen.has(l.shareSlug))]);
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
      }
      setCustomRoutes(localList);
    };

    void syncCustomRoutes();
    return () => controller.abort();
  }, [isOpen, currentUserId]);

  const activeCustomRoute = useMemo<CustomTrackedRoute | null>(() => {
    if (!selectedTrailId.startsWith('custom:')) return null;
    const key = selectedTrailId.slice('custom:'.length);
    return customRoutes.find((r) => r.shareSlug === key || r.id === key) || null;
  }, [selectedTrailId, customRoutes]);

  const activeTrail = useMemo<Trail | null>(() => {
    if (selectedTrailId === 'free' || selectedTrailId.startsWith('custom:')) return null;
    if (trail && trail.id === selectedTrailId) return trail;
    return trails.find((t) => t.id === selectedTrailId) || trail || null;
  }, [selectedTrailId, trail, trails]);

  const referenceTrack = useMemo<[number, number][]>(() => {
    if (activeCustomRoute && activeCustomRoute.trackPoints.length >= 2) {
      return activeCustomRoute.trackPoints;
    }
    if (!activeTrail) return [];
    if (Array.isArray(activeTrail.gpxTrack) && activeTrail.gpxTrack.length >= 2) {
      return activeTrail.gpxTrack;
    }
    return [
      [activeTrail.startLat, activeTrail.startLng],
      [activeTrail.endLat, activeTrail.endLng],
    ];
  }, [activeCustomRoute, activeTrail]);

  const simPath = useMemo(() => buildSimulatedPath(activeTrail, activeCustomRoute), [activeTrail, activeCustomRoute]);

  // Guaranteed AudioContext cleanup helper
  const closeAlarmAudioContext = () => {
    if (alarmAudioCtxRef.current) {
      void alarmAudioCtxRef.current.close().catch(() => undefined);
      alarmAudioCtxRef.current = null;
    }
  };

  const triggerOffTrailAlertFeedback = () => {
    const now = Date.now();
    if (now - lastAlarmBeepMsRef.current < 6000) return;
    lastAlarmBeepMsRef.current = now;

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([220, 120, 220]);
      } catch {
        // ignore vibration restrictions
      }
    }

    if (!alarmSoundRef.current) return;
    try {
      const AudioCtxCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxCtor) return;
      if (!alarmAudioCtxRef.current || alarmAudioCtxRef.current.state === 'closed') {
        alarmAudioCtxRef.current = new AudioCtxCtor();
      }
      const ctx = alarmAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(940, ctx.currentTime);
      osc.frequency.setValueAtTime(1180, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.34);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.onended = () => {
        try {
          osc.disconnect();
        } catch {
          // ignore disconnect error
        }
        try {
          gain.disconnect();
        } catch {
          // ignore disconnect error
        }
      };
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.36);
    } catch {
      // ignore audio autoplay restriction
    }
  };

  const handleRequestClose = () => {
    if (showShareCardModal) {
      setShareCardSnapshot(null);
      return;
    }
    if (status === 'recording') {
      onShowToastRef.current?.('Hãy bấm Tạm dừng hoặc Kết thúc trước khi đóng máy tính hành trình.', 'info');
      return;
    }
    if (beaconSosRef.current) {
      onShowToastRef.current?.(
        'Trạng thái SOS Khẩn đang BẬT! Hãy bấm Hủy Trạng Thái SOS hoặc Kết Thúc hành trình trước khi đóng.',
        'error'
      );
      return;
    }
    if (beaconTokenRef.current) {
      void stopBeaconRef.current();
    }
    closeAlarmAudioContext();
    setShareCardSnapshot(null);
    setStatus('idle');
    setGpsError(null);
    onClose();
  };

  // Stop geolocation watcher, audio & beacon abort controllers cleanly when modal closes or unmounts
  useEffect(() => {
    if (!isOpen) {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      beaconPingAbortRef.current?.abort();
      beaconPingAbortRef.current = null;
      beaconSosAbortRef.current?.abort();
      beaconSosAbortRef.current = null;
      closeAlarmAudioContext();
    }
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      beaconPingAbortRef.current?.abort();
      beaconPingAbortRef.current = null;
      beaconSosAbortRef.current?.abort();
      beaconSosAbortRef.current = null;
      closeAlarmAudioContext();
    };
  }, [isOpen]);

  // Escape key close when idle/paused/finished (LIFO guarded against active recording, SOS beacon, IME, or stacked modals)
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (showShareCardModal || !isTopmostFocusTrap(dialogRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (status === 'recording') {
          onShowToastRef.current?.('Hãy bấm Tạm dừng hoặc Kết thúc trước khi đóng máy tính hành trình.', 'info');
        } else if (beaconSosRef.current) {
          onShowToastRef.current?.(
            'Trạng thái SOS Khẩn đang BẬT! Hãy bấm Hủy Trạng Thái SOS hoặc Kết Thúc hành trình trước khi đóng.',
            'error'
          );
        } else {
          if (beaconTokenRef.current) {
            void stopBeaconRef.current();
          }
          closeAlarmAudioContext();
          setShareCardSnapshot(null);
          setStatus('idle');
          setGpsError(null);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, status, showShareCardModal, onClose]);

  // Elapsed seconds ticker while recording
  useEffect(() => {
    if (!isOpen || status !== 'recording') return;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isOpen, status]);

  // Real GPS watchPosition OR Field Simulation stepped interval
  useEffect(() => {
    if (!isOpen || status !== 'recording') {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (mode === 'sim') {
      const simId = window.setInterval(() => {
        const idx = Math.min(simStepRef.current, simPath.length - 1);
        const basePt = simPath[idx];
        // Optional +140m eastward lateral offset (~0.0014 deg lng) to demonstrate live Off-Trail Alarm
        const lngOffset = simDeviateRef.current ? 0.00145 : 0;
        const lat = basePt.lat;
        const lng = Number((basePt.lng + lngOffset).toFixed(6));

        const nextSample: LiveSamplePoint = {
          lat,
          lng,
          altitudeM: basePt.altitudeM,
          accuracyM: 6,
          speedKmH: 3.4,
          timestamp: Date.now(),
        };

        setPoints((prev) => [...prev, nextSample]);

        if (referenceTrack.length >= 2) {
          const devM = distanceToTrackMeters(lat, lng, referenceTrack);
          if (devM > OFF_TRAIL_THRESHOLD_M) {
            triggerOffTrailAlertFeedback();
          }
        }

        if (simStepRef.current < simPath.length - 1) {
          simStepRef.current += 1;
        } else {
          setStatus('paused');
          onShowToastRef.current?.('Mô phỏng đã đi tới điểm cuối / đỉnh của cung đường!', 'success');
        }
      }, 1200);

      return () => window.clearInterval(simId);
    }

    // Real GPS watchPosition mode
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    const wId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const altitudeM =
          typeof pos.coords.altitude === 'number' && Number.isFinite(pos.coords.altitude)
            ? Math.round(pos.coords.altitude)
            : null;
        const accuracyM =
          typeof pos.coords.accuracy === 'number' && Number.isFinite(pos.coords.accuracy)
            ? Math.round(pos.coords.accuracy)
            : null;
        const speedKmH =
          typeof pos.coords.speed === 'number' && Number.isFinite(pos.coords.speed) && pos.coords.speed >= 0
            ? Math.round(pos.coords.speed * 3.6 * 10) / 10
            : null;

        setGpsError(null);
        setPoints((prev) => {
          const last = prev[prev.length - 1];
          if (last) {
            const jumpM = haversineMeters(last.lat, last.lng, lat, lng);
            // Ignore micro jitter (< 3m) or wild satellite jump (> 500m)
            if (jumpM < 3 || jumpM > 500) return prev;
          }
          return [...prev, { lat, lng, altitudeM, accuracyM, speedKmH, timestamp: pos.timestamp || Date.now() }];
        });

        if (referenceTrack.length >= 2) {
          const devM = distanceToTrackMeters(lat, lng, referenceTrack);
          if (devM > OFF_TRAIL_THRESHOLD_M) {
            triggerOffTrailAlertFeedback();
          }
        }
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Quyền GPS bị từ chối. Hãy cấp quyền Vị trí hoặc chuyển sang Chế Độ Mô Phỏng Thực Địa.'
            : 'Đang mất sóng vệ tinh GPS — di chuyển ra vùng thoáng hoặc bật Mô Phỏng để thử nghiệm.';
        setGpsError(msg);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 3_000 }
    );
    watchIdRef.current = wId;

    return () => {
      navigator.geolocation.clearWatch(wId);
      watchIdRef.current = null;
    };
  }, [isOpen, status, mode, simPath, referenceTrack]);

  // Derived Real-Time Telemetry Metrics
  const telemetry = useMemo(() => {
    let totalMeters = 0;
    let gainM = 0;
    let maxAlt = 0;
    let anchorAlt: number | null = null;

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      if (pt.altitudeM !== null) {
        if (pt.altitudeM > maxAlt) maxAlt = pt.altitudeM;
        if (anchorAlt === null) {
          anchorAlt = pt.altitudeM;
        } else if (pt.altitudeM - anchorAlt >= 3) {
          gainM += pt.altitudeM - anchorAlt;
          anchorAlt = pt.altitudeM;
        } else if (anchorAlt - pt.altitudeM >= 3) {
          anchorAlt = pt.altitudeM;
        }
      }
      if (i > 0) {
        const segM = haversineMeters(points[i - 1].lat, points[i - 1].lng, pt.lat, pt.lng);
        if (segM <= 500) totalMeters += segM;
      }
    }

    const distanceKm = Math.round((totalMeters / 1000) * 100) / 100;
    const latest = points[points.length - 1] || null;
    const avgSpeedKmH = elapsedSec >= 5 && distanceKm > 0 ? Math.round((distanceKm / (elapsedSec / 3600)) * 10) / 10 : 0;
    const currentSpeedKmH = latest?.speedKmH ?? avgSpeedKmH;

    const offTrailMeters =
      latest && referenceTrack.length >= 2
        ? distanceToTrackMeters(latest.lat, latest.lng, referenceTrack)
        : 0;

    // Nearest / Next Waypoint (supports both canonical LOST trails and Custom Planned Routes)
    let nextWaypoint: { name: string; distanceKm: number; bearingDeg: number } | null = null;
    if (latest && (activeTrail || activeCustomRoute)) {
      const candidates: Array<{ name: string; lat: number; lng: number }> = activeCustomRoute
        ? [
            ...(activeCustomRoute.waypoints || []).map((w) => ({ name: w.name, lat: w.lat, lng: w.lng })),
            ...(activeCustomRoute.trackPoints.length > 0
              ? [
                  {
                    name: `Đích ${activeCustomRoute.title}`,
                    lat: activeCustomRoute.trackPoints[activeCustomRoute.trackPoints.length - 1][0],
                    lng: activeCustomRoute.trackPoints[activeCustomRoute.trackPoints.length - 1][1],
                  },
                ]
              : []),
          ]
        : activeTrail
        ? [
            ...(activeTrail.waypoints || []).map((w) => ({ name: w.name, lat: w.lat, lng: w.lng })),
            { name: `Đỉnh / Đích ${activeTrail.name}`, lat: activeTrail.endLat, lng: activeTrail.endLng },
          ]
        : [];
      let best: { name: string; distanceKm: number; bearingDeg: number } | null = null;
      for (const c of candidates) {
        const distKm = calculateHaversineKm(latest.lat, latest.lng, c.lat, c.lng);
        if (distKm >= 0.04 && (!best || distKm < best.distanceKm)) {
          best = {
            name: c.name,
            distanceKm: distKm,
            bearingDeg: calculateBearingDeg(latest.lat, latest.lng, c.lat, c.lng),
          };
        }
      }
      if (!best && candidates.length > 0) {
        const summit = candidates[candidates.length - 1];
        best = {
          name: summit.name,
          distanceKm: calculateHaversineKm(latest.lat, latest.lng, summit.lat, summit.lng),
          bearingDeg: calculateBearingDeg(latest.lat, latest.lng, summit.lat, summit.lng),
        };
      }
      nextWaypoint = best;
    }

    return {
      distanceKm,
      gainM: Math.round(gainM),
      maxAlt: Math.round(maxAlt),
      currentAlt: latest?.altitudeM ?? null,
      accuracyM: latest?.accuracyM ?? null,
      currentSpeedKmH,
      paceLabel: formatPaceMinPerKm(distanceKm, elapsedSec),
      offTrailMeters,
      isOffTrail: offTrailMeters > OFF_TRAIL_THRESHOLD_M,
      latest,
      nextWaypoint,
    };
  }, [points, elapsedSec, referenceTrack, activeTrail, activeCustomRoute]);

  // Freeze a clean point-in-time snapshot when opening the PNG share modal (prevents live GPS re-render storms & input wipes)
  const handleOpenShareCard = () => {
    const hasRecordedTrack = points.length >= 2;
    const recordedTrack: ExpeditionSharePoint[] = hasRecordedTrack
      ? points.map((p) => ({
          lat: p.lat,
          lng: p.lng,
          altitudeM: p.altitudeM,
        }))
      : referenceTrack.map(([lat, lng], idx) => {
          const maxA = activeCustomRoute?.maxAltitudeM ?? activeTrail?.maxAltitudeM ?? 0;
          const gainA = activeCustomRoute?.elevationGainM ?? activeTrail?.elevationGainM ?? 0;
          const baseA = Math.max(60, maxA - gainA);
          const ratio = referenceTrack.length > 1 ? idx / (referenceTrack.length - 1) : 1;
          return {
            lat,
            lng,
            altitudeM: maxA > 0 ? Math.round(baseA + (maxA - baseA) * ratio) : null,
          };
        });

    const peakName =
      activeCustomRoute?.title || activeTrail?.name || 'Hành Trình Trekking Tự Do LOST';
    const province = activeCustomRoute?.province || activeTrail?.province || 'Việt Nam';
    const region = activeTrail?.region || (activeCustomRoute ? 'Cung Tự Vẽ' : 'Thực Địa GPS');

    // Honest Rule 11 telemetry: once >= 2 GPS points are recorded, show actual recorded distance/gain (never fabricate catalog stats)
    const hasRealGpsMovement = mode === 'gps' && hasRecordedTrack && telemetry.distanceKm >= 0.02;
    const altitudeM =
      telemetry.maxAlt > 0
        ? telemetry.maxAlt
        : activeCustomRoute?.maxAltitudeM || activeTrail?.maxAltitudeM || 0;
    const distanceKm = hasRecordedTrack
      ? telemetry.distanceKm
      : activeCustomRoute?.distanceKm || activeTrail?.distanceKm || 0;
    const elevationGainM = hasRecordedTrack
      ? telemetry.gainM
      : activeCustomRoute?.elevationGainM || activeTrail?.elevationGainM || 0;

    const latestCoord =
      telemetry.latest && Number.isFinite(telemetry.latest.lat) && Number.isFinite(telemetry.latest.lng)
        ? { lat: telemetry.latest.lat, lng: telemetry.latest.lng }
        : null;
    const trailEndCoord =
      activeTrail && Number.isFinite(activeTrail.endLat) && Number.isFinite(activeTrail.endLng)
        ? { lat: activeTrail.endLat, lng: activeTrail.endLng }
        : null;
    const refEndPt = referenceTrack.length > 0 ? referenceTrack[referenceTrack.length - 1] : null;
    const refEndCoord =
      refEndPt && Number.isFinite(refEndPt[0]) && Number.isFinite(refEndPt[1])
        ? { lat: refEndPt[0], lng: refEndPt[1] }
        : null;

    setShareCardSnapshot({
      peakName,
      province,
      region,
      altitudeM,
      distanceKm,
      elevationGainM,
      durationLabel: formatElapsedHms(elapsedSec),
      dateLabel: new Date().toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
      hikerName: currentUser?.fullName || currentUser?.username || 'Nhà Thám Hiểm LOST',
      verifiedGps: hasRealGpsMovement || (checkinCompleted && mode === 'gps' && hasRecordedTrack),
      coordinates: latestCoord || trailEndCoord || refEndCoord,
      trackPoints: recordedTrack,
      defaultCaption: hasRealGpsMovement
        ? 'Nhật ký GPS thực địa ghi trực tiếp từ LOST Live Tracker'
        : 'Nhật ký lộ trình thực địa từ LOST Live Tracker',
    });
  };

  // Pure-SVG Breadcrumb Mini-Map projection (100% offline, zero tiles needed)
  const miniMapSvg = useMemo(() => {
    const W = 380;
    const H = 136;
    const pad = 16;

    const allLatLng: Array<[number, number]> = [
      ...referenceTrack,
      ...points.map((p) => [p.lat, p.lng] as [number, number]),
      ...fieldPins.map((w) => [w.lat, w.lng] as [number, number]),
    ];

    if (allLatLng.length === 0) {
      return { W, H, refPolyline: '', recPolyline: '', currentDot: null, pinDots: [] };
    }

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const [lat, lng] of allLatLng) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    const latSpan = Math.max(0.002, maxLat - minLat);
    const lngSpan = Math.max(0.002, maxLng - minLng);

    const project = (lat: number, lng: number) => ({
      x: pad + ((lng - minLng) / lngSpan) * (W - pad * 2),
      y: pad + ((maxLat - lat) / latSpan) * (H - pad * 2),
    });

    const refPolyline = referenceTrack
      .map(([lat, lng]) => {
        const pt = project(lat, lng);
        return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      })
      .join(' ');

    const recPolyline = points
      .map((p) => {
        const pt = project(p.lat, p.lng);
        return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      })
      .join(' ');

    const currentDot = telemetry.latest ? project(telemetry.latest.lat, telemetry.latest.lng) : null;
    const pinDots = fieldPins.map((pin) => ({
      id: pin.id,
      ...project(pin.lat, pin.lng),
      colorVar: FIELD_PIN_META[(pin.type as FieldPinKind) || 'viewpoint']?.colorVar || 'var(--color-sun)',
    }));

    return { W, H, refPolyline, recPolyline, currentDot, pinDots };
  }, [referenceTrack, points, fieldPins, telemetry.latest]);

  // Keep Live Beacon telemetry ref fresh without resetting the 20s throttle interval
  useEffect(() => {
    latestTelemetryRef.current = {
      latest: telemetry.latest,
      distanceKm: telemetry.distanceKm,
      gainM: telemetry.gainM,
    };
  }, [telemetry.latest, telemetry.distanceKm, telemetry.gainM]);

  const startBeaconSession = async (
    initialPoint?: LiveSamplePoint | null,
    initialStatus: 'active' | 'paused' = 'active'
  ) => {
    if (!currentUser || beaconStartingRef.current || beaconTokenRef.current || beaconStoppingRef.current) return;
    beaconStartingRef.current = true;
    setBeaconBusy(true);
    setBeaconState('starting');
    setBeaconError(null);

    beaconPingAbortRef.current?.abort();
    const controller = new AbortController();
    beaconPingAbortRef.current = controller;

    try {
      const batteryPct = await readDeviceBatteryPercent();
      if (!isMountedRef.current || controller.signal.aborted) return;
      setBeaconBatteryPct(batteryPct);

      const pos = initialPoint ?? latestTelemetryRef.current.latest;
      const trailIdPayload = activeTrail?.id || activeCustomRoute?.baseTrailId || '';
      const trailNamePayload = activeCustomRoute?.title || activeTrail?.name || 'Hành trình thực địa LOST';
      const displayNamePayload = currentUser.fullName || currentUser.username || 'Trekker LOST';

      const bodyPayload: Record<string, unknown> = {
        trailId: trailIdPayload,
        trailName: trailNamePayload,
        displayName: displayNamePayload,
      };
      if (batteryPct !== null) bodyPayload.batteryPercent = batteryPct;
      if (pos) {
        bodyPayload.lat = pos.lat;
        bodyPayload.lng = pos.lng;
        if (pos.altitudeM !== null) bodyPayload.altitudeM = pos.altitudeM;
        if (pos.accuracyM !== null) bodyPayload.accuracyM = pos.accuracyM;
      }

      const res = await fetch('/api/live-beacons', {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });
      if (!isMountedRef.current || controller.signal.aborted) return;

      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        token?: string;
        sharePath?: string;
        message?: string;
        data?: { token?: string; sharePath?: string };
      } | null;

      const resolvedToken = json?.token || json?.data?.token || '';
      if (res.ok && json?.success && resolvedToken) {
        const resolvedPath = json.sharePath || json.data?.sharePath || `/beacon/${resolvedToken}`;
        beaconTokenRef.current = resolvedToken;
        beaconSosRef.current = false;
        beaconHasSentFirstPosRef.current = Boolean(pos);
        lastBeaconPingMsRef.current = Date.now();
        setBeaconToken(resolvedToken);
        setBeaconSharePath(resolvedPath);
        setBeaconState(initialStatus);
        setBeaconSosActive(false);
        setBeaconError(null);
        setBeaconLastPingLabel(new Date().toLocaleTimeString('vi-VN'));
        onShowToastRef.current?.(
          'Đã bật Live Beacon! Sao chép liên kết để gửi cho người thân theo dõi trực tiếp.',
          'success'
        );
        if (initialStatus === 'paused') {
          void pingBeaconRef.current({ force: true, statusOverride: 'paused' });
        }
      } else {
        setBeaconState('error');
        setBeaconError(json?.message || 'Không thể khởi tạo Live Beacon lúc này.');
      }
    } catch (err) {
      if (!isMountedRef.current || controller.signal.aborted) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setBeaconState('error');
      setBeaconError('Đang ngoại tuyến — Live Beacon sẽ khả dụng khi thiết bị có sóng mạng.');
    } finally {
      beaconStartingRef.current = false;
      if (isMountedRef.current && !controller.signal.aborted) {
        setBeaconBusy(false);
      }
    }
  };

  const pingBeaconSession = async (opts?: {
    force?: boolean;
    statusOverride?: 'active' | 'paused' | 'sos';
    emergencyNote?: string;
    isSosMutation?: boolean;
  }): Promise<boolean> => {
    const token = beaconTokenRef.current;
    if (!token || beaconStoppingRef.current) return false;

    // Never allow a routine/pause ping to abort or race an in-flight SOS escalation ping
    if (!opts?.isSosMutation && sosInFlightRef.current) {
      return false;
    }

    const now = Date.now();
    if (!opts?.force && now - lastBeaconPingMsRef.current < BEACON_PING_INTERVAL_MS - 1000) {
      return false;
    }
    lastBeaconPingMsRef.current = now;

    const controller = new AbortController();
    if (opts?.isSosMutation) {
      // Abort any routine ping so it cannot land after our SOS escalation, then bind dedicated SOS controller
      beaconPingAbortRef.current?.abort();
      beaconPingAbortRef.current = null;
      beaconSosAbortRef.current?.abort();
      beaconSosAbortRef.current = controller;
    } else {
      beaconPingAbortRef.current?.abort();
      beaconPingAbortRef.current = controller;
    }

    try {
      const batteryPct = await readDeviceBatteryPercent();
      if (!isMountedRef.current || controller.signal.aborted) return false;
      if (batteryPct !== null) setBeaconBatteryPct(batteryPct);

      const { latest, distanceKm, gainM } = latestTelemetryRef.current;
      const nextStatus: 'active' | 'paused' | 'sos' =
        opts?.statusOverride ?? (beaconSosRef.current ? 'sos' : 'active');

      const payload: Record<string, unknown> = {
        status: nextStatus,
        distanceKm,
        elevationGainM: gainM,
      };
      if (batteryPct !== null) payload.batteryPercent = batteryPct;
      if (latest) {
        payload.lat = latest.lat;
        payload.lng = latest.lng;
        if (latest.altitudeM !== null) payload.altitudeM = latest.altitudeM;
        if (latest.accuracyM !== null) payload.accuracyM = latest.accuracyM;
      }
      if (opts?.emergencyNote !== undefined) {
        payload.emergencyNote = opts.emergencyNote;
      }

      const res = await fetch(`/api/live-beacons/${encodeURIComponent(token)}/ping`, {
        method: 'PATCH',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!isMountedRef.current || controller.signal.aborted) return false;

      if (res.ok) {
        if (latest) {
          beaconHasSentFirstPosRef.current = true;
        }
        setBeaconState(nextStatus);
        setBeaconError(null);
        setBeaconLastPingLabel(new Date().toLocaleTimeString('vi-VN'));
        return true;
      }
      const errJson = (await res.json().catch(() => null)) as { message?: string } | null;
      setBeaconError(errJson?.message || 'Tạm thời không gửi được ping Live Beacon.');
      return false;
    } catch (err) {
      if (!isMountedRef.current || controller.signal.aborted) return false;
      if (err instanceof DOMException && err.name === 'AbortError') return false;
      setBeaconError('Mất kết nối mạng tạm thời — sẽ tự thử lại sau 20 giây.');
      return false;
    }
  };

  const stopBeaconSession = async () => {
    const token = beaconTokenRef.current;
    if (!token || beaconStoppingRef.current) return;

    // Abort all in-flight pings BEFORE posting /stop so a stale PATCH cannot flip 'safe' back to 'active'
    beaconStoppingRef.current = true;
    beaconPingAbortRef.current?.abort();
    beaconPingAbortRef.current = null;
    beaconSosAbortRef.current?.abort();
    beaconSosAbortRef.current = null;
    beaconTokenRef.current = null;
    beaconSosRef.current = false;
    beaconHasSentFirstPosRef.current = false;
    if (isMountedRef.current) {
      setBeaconSosActive(false);
    }

    try {
      const batteryPct = await readDeviceBatteryPercent();
      const { distanceKm, gainM } = latestTelemetryRef.current;
      const payload: Record<string, unknown> = {
        distanceKm,
        elevationGainM: gainM,
      };
      if (batteryPct !== null) payload.batteryPercent = batteryPct;

      const res = await fetch(`/api/live-beacons/${encodeURIComponent(token)}/stop`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      if (isMountedRef.current) {
        setBeaconState('safe');
        if (res.ok) {
          setBeaconError(null);
          setBeaconLastPingLabel(new Date().toLocaleTimeString('vi-VN'));
        }
      }
    } catch {
      if (isMountedRef.current) {
        setBeaconState('safe');
      }
    } finally {
      beaconStoppingRef.current = false;
    }
  };

  useEffect(() => {
    startBeaconRef.current = startBeaconSession;
    pingBeaconRef.current = pingBeaconSession;
    stopBeaconRef.current = stopBeaconSession;
  });

  // Auto-start Live Beacon if user signs in mid-trek while sharing toggle is already enabled
  useEffect(() => {
    if (!isOpen || !currentUserId || !beaconEnabled) return;
    if (status !== 'recording' && status !== 'paused') return;
    if (beaconTokenRef.current || beaconStartingRef.current || beaconStoppingRef.current) return;

    const timerId = window.setTimeout(() => {
      if (!isMountedRef.current || beaconTokenRef.current || beaconStartingRef.current) return;
      void startBeaconRef.current(
        latestTelemetryRef.current.latest,
        statusRef.current === 'paused' ? 'paused' : 'active'
      );
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [isOpen, currentUserId, beaconEnabled, status]);

  // Immediately ping server once the very first GPS fix arrives after starting a coordinate-less beacon
  useEffect(() => {
    if (!isOpen || !beaconToken || beaconState === 'safe') return;
    if (!telemetry.latest || beaconHasSentFirstPosRef.current) return;

    beaconHasSentFirstPosRef.current = true;
    const timerId = window.setTimeout(() => {
      if (!isMountedRef.current || !beaconTokenRef.current) return;
      void pingBeaconRef.current({
        force: true,
        statusOverride: beaconSosRef.current
          ? 'sos'
          : statusRef.current === 'paused'
          ? 'paused'
          : 'active',
      });
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [isOpen, beaconToken, beaconState, telemetry.latest]);

  // Throttled 20-second Live Beacon telemetry ping interval (strict cleanup on pause/stop/unmount)
  useEffect(() => {
    if (!isOpen || !beaconToken || beaconState === 'safe') return;
    if (status !== 'recording' && status !== 'paused') return;

    const intervalId = window.setInterval(() => {
      const nextStatus: 'active' | 'paused' | 'sos' = beaconSosRef.current
        ? 'sos'
        : status === 'paused'
        ? 'paused'
        : 'active';
      void pingBeaconRef.current({ statusOverride: nextStatus });
    }, BEACON_PING_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isOpen, status, beaconToken, beaconState]);

  const handleToggleBeaconShare = (nextEnabled: boolean) => {
    setBeaconEnabled(nextEnabled);
    setBeaconError(null);

    if (!nextEnabled) {
      if (beaconTokenRef.current) {
        void stopBeaconSession();
        onShowToastRef.current?.('Đã tắt phát Live Beacon và báo trạng thái an toàn.', 'info');
      }
      return;
    }

    if (!currentUser) {
      onShowToastRef.current?.('Hãy đăng nhập tài khoản LOST để bật Live Beacon chia sẻ vị trí.', 'info');
      return;
    }

    if ((status === 'recording' || status === 'paused') && !beaconTokenRef.current) {
      void startBeaconSession(
        latestTelemetryRef.current.latest,
        status === 'paused' ? 'paused' : 'active'
      );
    }
  };

  const handleToggleBeaconSos = async () => {
    if (!beaconTokenRef.current || beaconBusy || sosInFlightRef.current) return;
    const nextSos = !beaconSosRef.current;
    beaconSosRef.current = nextSos;
    sosInFlightRef.current = true;
    setBeaconSosActive(nextSos);
    setBeaconBusy(true);
    try {
      const ok = await pingBeaconSession({
        force: true,
        isSosMutation: true,
        statusOverride: nextSos ? 'sos' : statusRef.current === 'paused' ? 'paused' : 'active',
        emergencyNote: nextSos
          ? 'Tín hiệu SOS khẩn cấp được kích hoạt trực tiếp từ LOST Live GPS Tracker.'
          : '',
      });
      if (!isMountedRef.current) return;
      if (ok) {
        onShowToastRef.current?.(
          nextSos
            ? 'ĐÃ BẬT TRẠNG THÁI SOS KHẨN CẤP! Người thân và quản trị LOST nhận cảnh báo ngay lập tức.'
            : 'Đã hủy trạng thái SOS — Live Beacon trở lại chế độ theo dõi bình thường.',
          nextSos ? 'error' : 'success'
        );
      } else {
        beaconSosRef.current = !nextSos;
        setBeaconSosActive(!nextSos);
        onShowToastRef.current?.(
          nextSos
            ? 'Không gửi được tín hiệu SOS lên máy chủ! Kiểm tra sóng mạng hoặc gọi trực tiếp 112 / 115.'
            : 'Không hủy được trạng thái SOS lúc này — vui lòng thử lại khi có sóng.',
          'error'
        );
      }
    } finally {
      sosInFlightRef.current = false;
      if (isMountedRef.current) {
        setBeaconBusy(false);
      }
    }
  };

  const handleCopyBeaconLink = () => {
    if (!beaconSharePath) return;
    const fullUrl =
      typeof window !== 'undefined' ? `${window.location.origin}${beaconSharePath}` : beaconSharePath;
    void copyTextWithFallback(fullUrl).then((ok) => {
      if (!isMountedRef.current) return;
      if (ok) {
        onShowToastRef.current?.('Đã sao chép liên kết Live Beacon! Gửi ngay cho người thân qua Zalo/SMS.', 'success');
      } else {
        onShowToastRef.current?.(`Liên kết Live Beacon: ${fullUrl}`, 'info');
      }
    });
  };

  const handleStart = () => {
    setGpsError(null);
    setCheckinCompleted(false);
    let initialSimSample: LiveSamplePoint | null = null;
    const isFreshStart = status === 'idle' || status === 'finished';

    if (isFreshStart) {
      if (beaconTokenRef.current) {
        void stopBeaconSession();
      }
      setPoints([]);
      setFieldPins([]);
      setElapsedSec(0);
      simStepRef.current = 0;
      beaconSosRef.current = false;
      beaconHasSentFirstPosRef.current = false;
      setBeaconToken(null);
      setBeaconSharePath(null);
      setBeaconState('idle');
      setBeaconSosActive(false);
      setBeaconError(null);
      setBeaconLastPingLabel(null);

      if (mode === 'sim' && simPath.length > 0) {
        const first = simPath[0];
        initialSimSample = {
          lat: first.lat,
          lng: first.lng,
          altitudeM: first.altitudeM,
          accuracyM: 6,
          speedKmH: 3.2,
          timestamp: Date.now(),
        };
        setPoints([initialSimSample]);
        simStepRef.current = 1;
      }
    }
    if (mode === 'gps' && (typeof navigator === 'undefined' || !navigator.geolocation)) {
      setGpsError('Thiết bị không có GPS — hãy chuyển sang Chế Độ Mô Phỏng Thực Địa.');
      return;
    }
    setStatus('recording');

    if (isFreshStart && beaconEnabled && currentUser) {
      void startBeaconSession(initialSimSample, 'active');
    } else if (!isFreshStart && beaconTokenRef.current) {
      void pingBeaconSession({
        force: true,
        statusOverride: beaconSosRef.current ? 'sos' : 'active',
      });
    }
  };

  const handleDropFieldPin = () => {
    const pos =
      telemetry.latest ||
      (activeCustomRoute && activeCustomRoute.trackPoints.length > 0
        ? {
            lat: activeCustomRoute.trackPoints[0][0],
            lng: activeCustomRoute.trackPoints[0][1],
            altitudeM: activeCustomRoute.elevations?.[0] ?? activeCustomRoute.maxAltitudeM,
          }
        : activeTrail
        ? { lat: activeTrail.startLat, lng: activeTrail.startLng, altitudeM: activeTrail.maxAltitudeM }
        : null);
    if (!pos) {
      onShowToast?.('Chưa có vị trí GPS hiện tại để ghim mốc thực địa.', 'error');
      return;
    }
    const meta = FIELD_PIN_META[pinKind];
    const label = pinNote.trim() || `${meta.label} #${fieldPins.length + 1}`;
    const newPin: PlannerWaypoint = {
      id: `live-pin-${Date.now()}`,
      name: label,
      type: pinKind,
      lat: pos.lat,
      lng: pos.lng,
      elevationM: pos.altitudeM ?? undefined,
      note: `Ghim thực địa lúc ${new Date().toLocaleTimeString('vi-VN')}`,
    };
    setFieldPins((prev) => [newPin, ...prev]);
    setPinNote('');
    onShowToast?.(`Đã đánh dấu "${label}" tại tọa độ hiện tại.`, 'success');
  };

  const handleExportRecordedGpx = () => {
    if (points.length < 2) {
      onShowToast?.('Cần ghi tối thiểu 2 điểm GPS trước khi xuất GPX 1.1.', 'error');
      return;
    }
    const vertices: RouteVertex[] = points.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      elevationM: p.altitudeM,
    }));
    const targetName = activeCustomRoute?.title || activeTrail?.name;
    const targetSlug = activeCustomRoute?.shareSlug || activeTrail?.id || 'track';
    const title = targetName ? `${targetName} — Live GPS Track` : 'LOST Live GPS Track';
    const xml = exportGpxXml({
      title,
      description: `Ghi thực địa trên LOST: ${telemetry.distanceKm} km, +${telemetry.gainM}m, thời gian ${formatElapsedHms(elapsedSec)}.`,
      vertices,
      waypoints: fieldPins,
    });

    const blob = new Blob([xml], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lost-live-${targetSlug}-${new Date().toISOString().slice(0, 10)}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    onShowToast?.('Đã xuất tệp tracklog GPX 1.1 kèm các mốc thực địa.', 'success');
  };

  const handleFinishAndCheckin = async () => {
    setStatus('finished');
    closeAlarmAudioContext();
    await stopBeaconSession();
    if (!isMountedRef.current) return;

    const latest = telemetry.latest;
    const resolvedCheckinTrailId = activeTrail?.id || activeCustomRoute?.baseTrailId || null;
    const displayName = activeCustomRoute?.title || activeTrail?.name || 'Hành trình tự do';
    const summaryEntry: OfflineTrekLogEntry = {
      id: `trek-${Date.now()}`,
      trailId: activeCustomRoute ? `custom:${activeCustomRoute.shareSlug}` : activeTrail?.id || 'free-trek',
      trailName: displayName,
      recordedAt: new Date().toISOString(),
      elapsedSec,
      distanceKm: telemetry.distanceKm,
      elevationGainM: telemetry.gainM,
      maxAltitudeM: telemetry.maxAlt,
      pointsCount: points.length,
      pinsCount: fieldPins.length,
      syncedToServer: false,
    };

    const scopedTrekStorageKey = resolveLiveTrekStorageKey(currentUser);
    if (!currentUser || !resolvedCheckinTrailId) {
      saveOfflineTrekSummary(summaryEntry, scopedTrekStorageKey);
      if (!isMountedRef.current) return;
      setCheckinCompleted(true);
      onShowToastRef.current?.(
        activeCustomRoute
          ? `Đã lưu nhật ký hành trình cho cung tự vẽ "${activeCustomRoute.title}" vào thiết bị!`
          : !currentUser
          ? 'Đã lưu nhật ký hành trình vào bộ nhớ máy. Đăng nhập để Check-in Đỉnh & cộng điểm uy tín!'
          : 'Đã lưu nhật ký hành trình tự do vào bộ nhớ máy.',
        'success'
      );
      return;
    }

    checkinAbortRef.current?.abort();
    const checkinCtrl = new AbortController();
    checkinAbortRef.current = checkinCtrl;
    setIsCheckingIn(true);
    try {
      const completionTimeHours = Math.max(0.2, Math.min(240, Math.round((elapsedSec / 3600) * 100) / 100));
      const fallbackEnd =
        activeCustomRoute && activeCustomRoute.trackPoints.length > 0
          ? activeCustomRoute.trackPoints[activeCustomRoute.trackPoints.length - 1]
          : activeTrail
          ? ([activeTrail.endLat, activeTrail.endLng] as [number, number])
          : ([22.3033, 103.775] as [number, number]);
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        signal: checkinCtrl.signal,
        body: JSON.stringify({
          trailId: resolvedCheckinTrailId,
          completionTimeHours,
          lat: latest?.lat ?? fallbackEnd[0],
          lng: latest?.lng ?? fallbackEnd[1],
          gpxTrackRecorded: points.slice(0, 1500).map((p) => [p.lat, p.lng]),
          distanceRecordedKm: Math.max(0.1, telemetry.distanceKm),
          elevationGainRecordedM: telemetry.gainM,
          notes: `Ghi trực tiếp qua LOST Live GPS (${displayName}, ${formatElapsedHms(elapsedSec)}, ${fieldPins.length} mốc thực địa).`,
          isPublic: true,
        }),
      });
      if (!isMountedRef.current || checkinCtrl.signal.aborted) return;
      const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!isMountedRef.current || checkinCtrl.signal.aborted) return;
      if (res.ok && json?.success) {
        summaryEntry.syncedToServer = true;
        saveOfflineTrekSummary(summaryEntry, scopedTrekStorageKey);
        setCheckinCompleted(true);
        onShowToastRef.current?.(json.message || `Check-in đỉnh ${displayName} thành công!`, 'success');
      } else {
        saveOfflineTrekSummary(summaryEntry, scopedTrekStorageKey);
        setCheckinCompleted(true);
        onShowToastRef.current?.(
          json?.message || 'Đã lưu ngoại tuyến vào thiết bị (chưa đồng bộ được máy chủ lúc này).',
          'info'
        );
      }
    } catch (err) {
      if (checkinCtrl.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) return;
      saveOfflineTrekSummary(summaryEntry, scopedTrekStorageKey);
      if (!isMountedRef.current) return;
      setCheckinCompleted(true);
      onShowToastRef.current?.('Đang ngoại tuyến — đã lưu toàn bộ tracklog vào thiết bị!', 'info');
    } finally {
      if (isMountedRef.current) {
        setIsCheckingIn(false);
      }
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return (
    <>
      {createPortal(
        <div className="modal-overlay" onClick={handleRequestClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Máy Tính Hành Trình GPS Trực Tiếp LOST"
        tabIndex={-1}
        className="modal-content modal-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 820, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16, outline: 'none' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="section-eyebrow" style={{ marginBottom: 6 }}>
              LOST LIVE GPS EXPEDITION COMPUTER
            </div>
            <h2 className="font-editorial" style={{ fontSize: '1.35rem', color: 'var(--color-text-main)' }}>
              Chế Độ Leo Núi Trực Tiếp & Cảnh Báo Lệch Tuyến
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              className={`badge ${
                status === 'recording'
                  ? 'badge-success'
                  : status === 'paused'
                  ? 'badge-sun'
                  : status === 'finished'
                  ? 'badge-info'
                  : 'badge-cloud'
              }`}
            >
              {status === 'recording'
                ? mode === 'sim'
                  ? 'Đang Mô Phỏng'
                  : 'Đang Ghi GPS'
                : status === 'paused'
                ? 'Tạm Dừng'
                : status === 'finished'
                ? 'Đã Hoàn Thành'
                : 'Sẵn Sàng'}
            </span>
            <button
              type="button"
              className="btn btn-outline"
              style={{ padding: '6px 8px' }}
              onClick={handleRequestClose}
              aria-label="Đóng máy tính hành trình"
            >
              <IconX size={16} />
            </button>
          </div>
        </div>

        {/* Trail & Tracking Mode Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            padding: 12,
            borderRadius: 6,
            background: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div>
            <label className="form-label" htmlFor="live-trail-picker" style={{ display: 'block', marginBottom: 4 }}>
              Tuyến đường theo dõi (cảnh báo lệch &gt;100m)
            </label>
            <select
              id="live-trail-picker"
              disabled={status === 'recording' || status === 'paused'}
              value={selectedTrailId}
              onChange={(e) =>
                setManualSelection({ forPropTrailId: trail?.id, trailId: e.target.value })
              }
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: 4,
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-main)',
                fontSize: '0.84rem',
              }}
            >
              <option value="free">Chế Độ Leo Tự Do (Không khóa tuyến)</option>
              {customRoutes.length > 0 && (
                <optgroup label="Cung Tự Vẽ Của Tôi">
                  {customRoutes.map((cr) => (
                    <option key={`custom-${cr.shareSlug}`} value={`custom:${cr.shareSlug}`}>
                      {cr.title} ({cr.distanceKm > 0 ? `${cr.distanceKm} km` : `${cr.trackPoints.length} điểm`}
                      {cr.maxAltitudeM > 0 ? ` • ${cr.maxAltitudeM}m` : ''})
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Cung Đường Thực Địa LOST">
                {trails.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.name} ({tr.distanceKm} km • {tr.maxAltitudeM}m)
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span className="form-label">Nguồn Tín Hiệu Định Vị</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button
                type="button"
                disabled={status === 'recording'}
                className={mode === 'gps' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '7px 8px', fontSize: '0.78rem' }}
                onClick={() => setMode('gps')}
              >
                <IconMapPin size={14} />
                GPS Thực Địa
              </button>
              <button
                type="button"
                disabled={status === 'recording'}
                className={mode === 'sim' ? 'btn btn-sky' : 'btn btn-secondary'}
                style={{ padding: '7px 8px', fontSize: '0.78rem' }}
                onClick={() => setMode('sim')}
              >
                <IconCompass size={14} />
                Mô Phỏng Thực Địa
              </button>
            </div>
          </div>
        </div>

        {/* LIVE FAMILY GPS BEACON SHARING PANEL (/beacon/<token>) */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 6,
            background: beaconSosActive
              ? 'var(--banner-danger-bg)'
              : beaconToken && beaconState !== 'safe'
              ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-surface-elevated))'
              : 'var(--color-surface-elevated)',
            border: beaconSosActive
              ? '1px solid var(--banner-danger-border)'
              : beaconToken && beaconState !== 'safe'
              ? '1px solid var(--color-border-glow)'
              : '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                color: beaconSosActive ? 'var(--banner-danger-text)' : 'var(--color-text-main)',
                fontWeight: 700,
                fontSize: '0.86rem',
              }}
            >
              <input
                type="checkbox"
                aria-label="Chia Sẻ Vị Trí Cho Người Thân (Live Beacon)"
                checked={beaconEnabled}
                onChange={(e) => handleToggleBeaconShare(e.target.checked)}
                style={{ accentColor: 'var(--color-primary)', width: 15, height: 15 }}
              />
              <IconRadio size={16} color={beaconSosActive ? 'var(--banner-danger-text)' : 'var(--color-primary)'} />
              <span>Chia Sẻ Vị Trí Cho Người Thân (Live Beacon)</span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {beaconBatteryPct !== null && (
                <span
                  className="badge badge-cloud"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  Pin {beaconBatteryPct}%
                </span>
              )}
              {beaconState === 'active' && (
                <span className="badge badge-success">Đang phát • 20s/lần</span>
              )}
              {beaconState === 'starting' && (
                <span className="badge badge-sun">Đang khởi tạo...</span>
              )}
              {beaconState === 'paused' && (
                <span className="badge badge-sun">Tạm dừng phát</span>
              )}
              {beaconState === 'sos' && (
                <span className="badge badge-error">SOS KHẨN CẤP</span>
              )}
              {beaconState === 'safe' && beaconSharePath && (
                <span className="badge badge-info">Đã báo an toàn</span>
              )}
            </div>
          </div>

          {beaconEnabled && !currentUser && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
                padding: '8px 10px',
                borderRadius: 4,
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                fontSize: '0.78rem',
                color: 'var(--color-text-muted)',
              }}
            >
              <span>
                Đăng nhập tài khoản LOST để tạo liên kết theo dõi trực tiếp 48 giờ gửi cho gia đình (không tốn phí).
              </span>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '5px 10px', fontSize: '0.74rem' }}
                onClick={() => window.dispatchEvent(new CustomEvent('lost:open-auth-modal'))}
              >
                <IconShare size={13} />
                Đăng nhập ngay
              </button>
            </div>
          )}

          {beaconEnabled && currentUser && !beaconSharePath && beaconState !== 'starting' && (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              Tự động tạo liên kết <strong>/beacon/...</strong> ngay khi bạn bấm <strong>Bắt Đầu Hành Trình</strong>, gửi tọa độ GPS + % pin mỗi 20 giây và tự báo an toàn khi kết thúc.
            </div>
          )}

          {beaconSharePath && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '9px 11px',
                borderRadius: 4,
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <code
                  style={{
                    fontSize: '0.78rem',
                    fontFamily: 'var(--font-family)',
                    fontWeight: 600,
                    color: 'var(--color-primary)',
                    fontVariantNumeric: 'tabular-nums',
                    wordBreak: 'break-all',
                  }}
                >
                  {typeof window !== 'undefined' ? `${window.location.origin}${beaconSharePath}` : beaconSharePath}
                </code>
                {beaconLastPingLabel && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                    Ping gần nhất: {beaconLastPingLabel}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '6px 10px', fontSize: '0.76rem' }}
                  onClick={handleCopyBeaconLink}
                >
                  <IconCopy size={13} />
                  Sao Chép Liên Kết Người Thân
                </button>
                <a
                  href={beaconSharePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                  style={{ padding: '6px 10px', fontSize: '0.76rem', textDecoration: 'none' }}
                >
                  <IconBeaconOpenSvg size={13} />
                  Mở Trang Theo Dõi
                </a>
                {beaconToken && beaconState !== 'safe' && (
                  <button
                    type="button"
                    disabled={beaconBusy}
                    className={beaconSosActive ? 'btn btn-secondary' : 'btn btn-danger'}
                    style={{ padding: '6px 11px', fontSize: '0.76rem' }}
                    onClick={() => void handleToggleBeaconSos()}
                  >
                    <IconShieldAlert size={14} />
                    {beaconSosActive ? 'Hủy Trạng Thái SOS' : 'Bật Trạng Thái SOS Khẩn'}
                  </button>
                )}
              </div>
            </div>
          )}

          {beaconError && (
            <div style={{ fontSize: '0.76rem', color: 'var(--color-error-text, var(--banner-danger-text))', fontWeight: 600 }}>
              {beaconError}
            </div>
          )}
        </div>

        {/* LIVE OFF-TRAIL ALARM BANNER (> 100m) */}
        {telemetry.isOffTrail && (
          <div
            role="alert"
            style={{
              padding: '12px 14px',
              borderRadius: 6,
              background: 'var(--banner-danger-bg)',
              border: '1px solid var(--banner-danger-border)',
              color: 'var(--banner-danger-text)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconShieldAlert size={20} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.92rem', fontVariantNumeric: 'tabular-nums' }}>
                  CẢNH BÁO LỆCH TUYẾN: CÁCH ĐƯỜNG MÒN {telemetry.offTrailMeters} MÉT!
                </strong>
                <span style={{ fontSize: '0.78rem' }}>
                  Áp dụng ngay quy tắc S.T.O.P — Dừng lại và quay ngược theo mũi tên về đường GPX chuẩn.
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-danger"
              style={{ padding: '5px 10px', fontSize: '0.74rem' }}
              onClick={() => setAlarmSoundEnabled((v) => !v)}
            >
              <IconVolumeSvg size={14} />
              {alarmSoundEnabled ? 'Tắt còi báo' : 'Bật còi báo'}
            </button>
          </div>
        )}

        {gpsError && (
          <div
            style={{
              padding: '9px 12px',
              borderRadius: 4,
              background: 'var(--banner-danger-bg)',
              border: '1px solid var(--banner-danger-border)',
              color: 'var(--banner-danger-text)',
              fontSize: '0.8rem',
            }}
          >
            {gpsError}
          </div>
        )}

        {/* Primary Tabular-Nums HUD Telemetry Strip */}
        <div className="editorial-stat-strip">
          <div className="editorial-stat-cell">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
              <IconClock size={12} />
              Thời Gian
            </span>
            <strong style={{ fontSize: '1.45rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
              {formatElapsedHms(elapsedSec)}
            </strong>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {points.length} điểm GPS
            </span>
          </div>

          <div className="editorial-stat-cell">
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
              Quãng Đường
            </span>
            <strong style={{ fontSize: '1.45rem', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {telemetry.distanceKm.toFixed(2)} km
            </strong>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              Lệch tuyến: {telemetry.offTrailMeters} m
            </span>
          </div>

          <div className="editorial-stat-cell">
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
              Pace / Tốc Độ
            </span>
            <strong style={{ fontSize: '1.35rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
              {telemetry.paceLabel} <span style={{ fontSize: '0.78rem', fontWeight: 500 }}>/km</span>
            </strong>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {telemetry.currentSpeedKmH.toFixed(1)} km/h
            </span>
          </div>

          <div className="editorial-stat-cell">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
              <IconMountain size={12} />
              Cao Độ / Leo Tích Lũy
            </span>
            <strong style={{ fontSize: '1.35rem', color: 'var(--color-earth)', fontVariantNumeric: 'tabular-nums' }}>
              {telemetry.currentAlt !== null ? `${telemetry.currentAlt}m` : '--'}
            </strong>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              +{telemetry.gainM}m • GPS {telemetry.accuracyM !== null ? `±${telemetry.accuracyM}m` : '--'}
            </span>
          </div>
        </div>

        {/* Next Waypoint Bearing Compass + Offline Pure-SVG Breadcrumb Track */}
        <div className="hub-grid-2" style={{ gap: 14 }}>
          {/* Next Waypoint Card with Pure-SVG Rotating Direction Arrow */}
          <div
            style={{
              padding: 14,
              borderRadius: 6,
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <svg viewBox="0 0 68 68" width="64" height="64" aria-hidden="true" style={{ flexShrink: 0 }}>
              <circle cx="34" cy="34" r="30" fill="var(--color-surface-elevated)" stroke="var(--color-border-strong)" strokeWidth="1.5" />
              <text x="34" y="13" textAnchor="middle" fill="var(--color-error)" fontSize="8" fontWeight="800" style={{ fontFamily: 'var(--font-family)' }}>
                B
              </text>
              <g transform={`rotate(${telemetry.nextWaypoint?.bearingDeg ?? 0} 34 34)`}>
                <line x1="34" y1="46" x2="34" y2="20" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" />
                <polygon points="34,14 28,25 40,25" fill="var(--color-primary)" />
              </g>
            </svg>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 2 }}>
                Mốc Tiếp Theo / Đích
              </div>
              <strong
                style={{
                  display: 'block',
                  fontSize: '0.92rem',
                  color: 'var(--color-text-main)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {telemetry.nextWaypoint ? telemetry.nextWaypoint.name : 'Chưa bắt đầu ghi GPS'}
              </strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {telemetry.nextWaypoint
                  ? `Còn ${telemetry.nextWaypoint.distanceKm.toFixed(2)} km • Phương vị ${telemetry.nextWaypoint.bearingDeg}° (${getCardinalDirectionLabel(telemetry.nextWaypoint.bearingDeg).split(' ')[0]})`
                  : 'Bấm Bắt Đầu để khóa hướng tới điểm mốc kế tiếp.'}
              </span>
            </div>
          </div>

          {/* Pure-SVG Live Breadcrumb Track Mini-Map */}
          <div
            style={{
              padding: 10,
              borderRadius: 6,
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
              <span>Bản Đồ Vệt Di Chuyển (Offline SVG)</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {telemetry.latest ? `${telemetry.latest.lat.toFixed(4)}, ${telemetry.latest.lng.toFixed(4)}` : 'Đang chờ tọa độ'}
              </span>
            </div>
            <svg
              viewBox={`0 0 ${miniMapSvg.W} ${miniMapSvg.H}`}
              width="100%"
              role="img"
              aria-label="Sơ đồ vệt đường GPX trực tiếp"
              style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 140 }}
            >
              {miniMapSvg.refPolyline && (
                <polyline
                  points={miniMapSvg.refPolyline}
                  fill="none"
                  stroke="var(--color-border-strong)"
                  strokeWidth="2.5"
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {miniMapSvg.recPolyline && (
                <polyline
                  points={miniMapSvg.recPolyline}
                  fill="none"
                  stroke={telemetry.isOffTrail ? 'var(--color-error)' : 'var(--color-primary)'}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {miniMapSvg.pinDots.map((d) => (
                <circle key={d.id} cx={d.x} cy={d.y} r="4" fill={d.colorVar} stroke="var(--color-bg-card)" strokeWidth="1.5" />
              ))}
              {miniMapSvg.currentDot && (
                <g>
                  <circle
                    cx={miniMapSvg.currentDot.x}
                    cy={miniMapSvg.currentDot.y}
                    r="8"
                    fill="color-mix(in srgb, var(--color-primary) 24%, transparent)"
                  />
                  <circle
                    cx={miniMapSvg.currentDot.x}
                    cy={miniMapSvg.currentDot.y}
                    r="4.5"
                    fill={telemetry.isOffTrail ? 'var(--color-error)' : 'var(--color-primary)'}
                    stroke="var(--color-on-media)"
                    strokeWidth="1.5"
                  />
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Simulation Off-Trail Alarm Test Switch + Audio Alarm Toggle */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {status !== 'recording' ? (
              <button type="button" className="btn btn-primary" onClick={handleStart}>
                <IconPlaySvg size={14} />
                {status === 'paused' ? 'Tiếp Tục Ghi' : 'Bắt Đầu Hành Trình'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-earth"
                onClick={() => {
                  setStatus('paused');
                  if (beaconTokenRef.current) {
                    void pingBeaconSession({
                      force: true,
                      statusOverride: beaconSosRef.current ? 'sos' : 'paused',
                    });
                  }
                }}
              >
                <IconPauseSvg size={14} />
                Tạm Dừng
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              disabled={points.length < 2}
              onClick={handleExportRecordedGpx}
            >
              <IconDownload size={15} />
              Xuất GPX 1.1
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={points.length < 2 && status !== 'finished'}
              onClick={handleOpenShareCard}
              title="Tạo ảnh PNG hành trình từ tọa độ GPS đã ghi"
            >
              <IconImage size={15} />
              Xuất Thẻ PNG
            </button>

            <button
              type="button"
              className="btn btn-sky"
              disabled={isCheckingIn || (status === 'idle' && points.length === 0)}
              onClick={() => void handleFinishAndCheckin()}
            >
              <IconStopSvg size={13} />
              {isCheckingIn ? 'Đang gửi Check-in...' : 'Kết Thúc & Check-in Đỉnh'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {mode === 'sim' && status === 'recording' && (
              <button
                type="button"
                className={simDeviateOffTrail ? 'btn btn-danger' : 'btn btn-outline'}
                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                onClick={() => setSimDeviateOffTrail((v) => !v)}
              >
                <IconAlertTriangle size={14} />
                {simDeviateOffTrail ? 'Quay Về Đúng Tuyến' : 'Thử Lệch Tuyến (+140m)'}
              </button>
            )}
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.78rem',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                aria-label="Bật hoặc tắt âm báo lệch tuyến"
                checked={alarmSoundEnabled}
                onChange={(e) => setAlarmSoundEnabled(e.target.checked)}
                style={{ accentColor: 'var(--color-error)' }}
              />
              Âm báo lệch tuyến
            </label>
          </div>
        </div>

        {/* Live Field Pin Drop Bar ("Đánh Dấu Điểm Bắt Gặp") */}
        <div
          style={{
            padding: 12,
            borderRadius: 6,
            background: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <strong style={{ fontSize: '0.86rem', color: 'var(--color-text-main)' }}>
              Đánh Dấu Điểm Bắt Gặp Trên Đường ({fieldPins.length} mốc)
            </strong>
            <span style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)' }}>
              Lưu kèm vào file GPX 1.1 khi xuất
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              aria-label="Loại mốc bắt gặp"
              value={pinKind}
              onChange={(e) => setPinKind(e.target.value as FieldPinKind)}
              style={{
                padding: '7px 9px',
                borderRadius: 4,
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-main)',
                fontSize: '0.8rem',
              }}
            >
              {(Object.keys(FIELD_PIN_META) as FieldPinKind[]).map((k) => (
                <option key={k} value={k}>
                  {FIELD_PIN_META[k].label}
                </option>
              ))}
            </select>

            <input
              type="text"
              aria-label="Ghi chú điểm bắt gặp trên đường"
              value={pinNote}
              onChange={(e) => setPinNote(e.target.value)}
              placeholder="Ghi chú ngắn (VD: Suối nước sạch 2.200m, sạt lở nhẹ...)"
              style={{
                flex: 1,
                minWidth: 180,
                padding: '7px 10px',
                borderRadius: 4,
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-main)',
                fontSize: '0.82rem',
              }}
            />

            <button type="button" className="btn btn-primary" style={{ padding: '7px 12px', fontSize: '0.8rem' }} onClick={handleDropFieldPin}>
              <IconPlus size={14} />
              Ghim Điểm
            </button>
          </div>

          {fieldPins.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
              {fieldPins.map((pin) => (
                <div
                  key={pin.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    borderRadius: 4,
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.78rem',
                  }}
                >
                  <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>
                    {pin.name}{' '}
                    <span style={{ color: 'var(--color-text-dim)', fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>
                      ({pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
                      {typeof pin.elevationM === 'number' ? ` • ${pin.elevationM}m` : ''})
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline"
                    aria-label={`Xóa mốc ${pin.name}`}
                    style={{ padding: '3px 6px', color: 'var(--color-error-text, var(--banner-danger-text))' }}
                    onClick={() => setFieldPins((prev) => prev.filter((item) => item.id !== pin.id))}
                  >
                    <IconTrash size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Post-Checkin Confirmation Strip */}
        {checkinCompleted && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 6,
              background: 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-card))',
              border: '1px solid var(--color-border-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
              fontSize: '0.84rem',
              color: 'var(--color-text-main)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <IconCheckCircle size={18} color="var(--color-primary)" />
              Đã lưu nhật ký hành trình ({telemetry.distanceKm.toFixed(2)} km • +{telemetry.gainM}m • {formatElapsedHms(elapsedSec)}).
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                onClick={handleOpenShareCard}
              >
                <IconImage size={14} />
                Xuất Thẻ PNG Hành Trình
              </button>
              {!currentUser && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                  onClick={() => window.dispatchEvent(new CustomEvent('lost:open-auth-modal'))}
                >
                  <IconShieldCheck size={14} />
                  Đăng nhập để đồng bộ Hộ chiếu
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
        document.body
      )}
      {isOpen && shareCardSnapshot && (
        <ExpeditionShareCardModal
          isOpen={true}
          initialData={shareCardSnapshot}
          onClose={() => setShareCardSnapshot(null)}
          onShowToast={onShowToast}
        />
      )}
    </>
  );
};

export default LiveTrekTrackerModal;
