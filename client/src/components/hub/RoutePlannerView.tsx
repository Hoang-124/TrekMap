import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LostVectorMap,
  type LostMapMarkerItem,
  type LostMapPolylineItem,
} from '../map/LostVectorMap.js';
import {
  FREE_BASEMAPS,
  FREE_BASEMAP_ORDER,
  sampleTerrariumElevations,
  type BasemapKey,
} from '../../utils/mapTiles.js';
import type { Region, Trail, User } from '../../types.js';
import { isTopmostFocusTrap, useFocusTrap } from '../../hooks/useFocusTrap.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { scopedStorageKey } from '../../utils/storageScope.js';
import { calculateHaversineKm } from '../../utils/solarMath.js';
import {
  computeRouteMetrics,
  computeWaypointLegSplits,
  exportGpxXml,
  formatDurationHoursVi,
  formatLegSplitsPlainText,
  interpolateVerticesForDem,
  parseGpxXml,
  type PlannerWaypoint,
  type RouteFitnessLevel,
  type RouteMetricsSummary,
  type RouteVertex,
  type RouteWaypointType,
  type WaypointLegSplit,
} from '../../utils/routeMetrics.js';
import {
  IconArrowLeft,
  IconBot,
  IconClock,
  IconCompass,
  IconCopy,
  IconDownload,
  IconDroplet,
  IconFlame,
  IconHeart,
  IconImage,
  IconMapPin,
  IconMountain,
  IconPlus,
  IconRotateCw,
  IconSend,
  IconShare,
  IconShieldCheck,
  IconTrash,
  IconX,
} from '../common/SvgIcons.js';
import {
  ExpeditionShareCardModal,
  type ExpeditionShareCardModalProps,
} from '../common/ExpeditionShareCardModal.js';

export interface RoutePlannerViewProps {
  trails: Trail[];
  currentUser?: User | null;
  initialTrailId?: string;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onOpenContribute?: () => void;
  onBack?: () => void;
}

type MapTileKey = BasemapKey;
type ClickToolMode = 'vertex' | 'waypoint';
type ElevationSourceState =
  | 'none'
  | 'server-dem'
  | 'terrarium-dem'
  | 'gpx-elevation'
  | 'interpolated'
  | 'interpolated-fallback';

interface SavedCustomRouteRecord {
  id: string;
  _id?: string;
  shareSlug: string;
  creatorId?: string | { _id?: string; id?: string };
  title: string;
  description?: string;
  region?: string;
  province?: string;
  baseTrailId?: string;
  waypoints: PlannerWaypoint[];
  trackPoints: Array<[number, number] | [number, number, number]>;
  elevations?: number[];
  metrics: {
    distanceKm: number;
    elevationGainM: number;
    elevationLossM: number;
    maxAltitudeM: number;
    minAltitudeM: number;
    maxSlopePercent: number;
    naismithHours: number;
    toblerHours?: number;
    difficultyEstimate: number;
  };
  visibility: 'private' | 'unlisted' | 'public';
  likesCount?: number;
  isLiked?: boolean;
  isLocalOnly?: boolean;
  createdAt?: string;
}

interface LoadedRouteMeta {
  id: string;
  shareSlug: string;
  isOwner: boolean;
  creatorId?: string;
  isLocalOnly?: boolean;
}

const LOCAL_ROUTES_STORAGE_KEY = 'lost_custom_routes_v1';
const DRAFT_CONTRIBUTION_KEY = 'lost_planner_draft_contribution';
const AI_PENDING_PROMPT_KEY = 'lost_ai_pending_prompt';

const WAYPOINT_TYPE_META: Record<
  RouteWaypointType,
  { label: string; shortLabel: string; shortCode: string; gpxSym: string; colorVar: string; textColorVar: string }
> = {
  start: {
    label: 'Điểm xuất phát',
    shortLabel: 'Xuất phát',
    shortCode: 'XP',
    gpxSym: 'Trail Head',
    colorVar: 'var(--color-primary)',
    textColorVar: 'var(--color-primary)',
  },
  peak: {
    label: 'Đỉnh núi',
    shortLabel: 'Đỉnh núi',
    shortCode: 'ĐN',
    gpxSym: 'Summit',
    colorVar: 'var(--color-sun)',
    textColorVar: 'var(--color-sun)',
  },
  water: {
    label: 'Suối / nguồn nước',
    shortLabel: 'Nguồn nước',
    shortCode: 'NC',
    gpxSym: 'Water Source',
    colorVar: 'var(--color-sky)',
    textColorVar: 'var(--color-sky)',
  },
  camp: {
    label: 'Lán / bãi trại',
    shortLabel: 'Lán trại',
    shortCode: 'TR',
    gpxSym: 'Campground',
    colorVar: 'var(--color-earth)',
    textColorVar: 'var(--color-earth)',
  },
  danger: {
    label: 'Đoạn nguy hiểm',
    shortLabel: 'Cảnh báo',
    shortCode: 'CB',
    gpxSym: 'Danger Area',
    colorVar: 'var(--color-error)',
    textColorVar: 'var(--color-error-text, var(--color-error))',
  },
  viewpoint: {
    label: 'Điểm ngắm cảnh',
    shortLabel: 'Ngắm cảnh',
    shortCode: 'NG',
    gpxSym: 'Scenic Area',
    colorVar: 'var(--color-stream)',
    textColorVar: 'var(--color-stream)',
  },
  end: {
    label: 'Điểm kết thúc',
    shortLabel: 'Kết thúc',
    shortCode: 'KT',
    gpxSym: 'Flag, Red',
    colorVar: 'var(--color-primary)',
    textColorVar: 'var(--color-primary)',
  },
};

const PRIMARY_WAYPOINT_TAGS: RouteWaypointType[] = ['start', 'peak', 'water', 'camp', 'danger'];
const ALL_WAYPOINT_TAGS: RouteWaypointType[] = ['start', 'peak', 'water', 'camp', 'danger', 'viewpoint', 'end'];

const WaypointTypeIcon: React.FC<{ type: RouteWaypointType; size?: number; color?: string }> = ({
  type,
  size = 13,
  color = 'currentColor',
}) => {
  if (type === 'start') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 21V4" />
        <path d="M4 5h12l-2.5 4.5L16 14H4" />
      </svg>
    );
  }
  if (type === 'peak') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
      </svg>
    );
  }
  if (type === 'water') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2.7 6.3 9.2a7 7 0 1 0 11.4 0L12 2.7Z" />
      </svg>
    );
  }
  if (type === 'camp') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 20 12 4l9 16H3Z" />
        <path d="M9.5 20 12 14l2.5 6" />
      </svg>
    );
  }
  if (type === 'danger') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <line x1="12" y1="9" x2="12" y2="13.5" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  if (type === 'end') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 21V4" />
        <rect x="4" y="4" width="14" height="10" rx="1" />
        <path d="M11 4v10" />
        <path d="M4 9h14" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
};

interface FourTierSlopeBreakdown {
  flatKm: number;
  moderateKm: number;
  steepKm: number;
  extremeKm: number;
  flatPct: number;
  moderatePct: number;
  steepPct: number;
  extremePct: number;
  totalKm: number;
}

function computeFourTierSlopeBreakdown(profile: RouteMetricsSummary['profile']): FourTierSlopeBreakdown {
  if (!Array.isArray(profile) || profile.length < 2) {
    return {
      flatKm: 0,
      moderateKm: 0,
      steepKm: 0,
      extremeKm: 0,
      flatPct: 0,
      moderatePct: 0,
      steepPct: 0,
      extremePct: 0,
      totalKm: 0,
    };
  }
  let flatRaw = 0;
  let moderateRaw = 0;
  let steepRaw = 0;
  let extremeRaw = 0;
  for (let i = 1; i < profile.length; i++) {
    const prev = profile[i - 1];
    const curr = profile[i];
    const segKm =
      Number.isFinite(prev.lat) &&
        Number.isFinite(prev.lng) &&
        Number.isFinite(curr.lat) &&
        Number.isFinite(curr.lng)
        ? calculateHaversineKm(prev.lat, prev.lng, curr.lat, curr.lng)
        : Math.max(0, curr.distanceKm - prev.distanceKm);
    if (!Number.isFinite(segKm) || segKm <= 0) continue;
    const rawSlope = curr.slopePercent;
    const absSlope = Number.isFinite(rawSlope) ? Math.abs(rawSlope) : 0;
    if (absSlope < 5) flatRaw += segKm;
    else if (absSlope < 12) moderateRaw += segKm;
    else if (absSlope <= 20) steepRaw += segKm;
    else extremeRaw += segKm;
  }
  const totalKm = flatRaw + moderateRaw + steepRaw + extremeRaw;
  if (totalKm <= 0) {
    return {
      flatKm: 0,
      moderateKm: 0,
      steepKm: 0,
      extremeKm: 0,
      flatPct: 0,
      moderatePct: 0,
      steepPct: 0,
      extremePct: 0,
      totalKm: 0,
    };
  }
  // Largest-remainder normalization ensures the 4 integer percentages always sum to exactly 100%
  const rawPcts = [flatRaw, moderateRaw, steepRaw, extremeRaw].map((km) => (km / totalKm) * 100);
  const floors = rawPcts.map((p) => Math.floor(p));
  let remainder = 100 - floors.reduce((a, b) => a + b, 0);
  const order = rawPcts
    .map((p, idx) => ({ idx, frac: p - floors[idx] }))
    .sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < order.length && remainder > 0; i++) {
    floors[order[i].idx] += 1;
    remainder -= 1;
  }
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    flatKm: r2(flatRaw),
    moderateKm: r2(moderateRaw),
    steepKm: r2(steepRaw),
    extremeKm: r2(extremeRaw),
    flatPct: floors[0],
    moderatePct: floors[1],
    steepPct: floors[2],
    extremePct: floors[3],
    totalKm: r2(totalKm),
  };
}

function escapeXmlLocal(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Injects GPX 1.1 XSD-ordered <sym>...</sym> elements directly before <type> inside each <wpt> block.
 */
function enrichGpxXmlWithWaypointSymbols(xml: string, wpts: PlannerWaypoint[]): string {
  if (!wpts.length) return xml;
  let wptIdx = 0;
  return xml.replace(/<wpt\b[^>]*>[\s\S]*?<\/wpt>/g, (block) => {
    const wp = wpts[wptIdx++];
    if (!wp || block.includes('<sym>')) return block;
    const symName = WAYPOINT_TYPE_META[wp.type]?.gpxSym || 'Waypoint';
    const symLine = `\n    <sym>${escapeXmlLocal(symName)}</sym>`;
    if (block.includes('\n    <type>')) {
      return block.replace('\n    <type>', () => `${symLine}\n    <type>`);
    }
    return block.replace('\n  </wpt>', () => `${symLine}\n  </wpt>`);
  });
}

async function copyTextSafe(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to execCommand fallback
    }
  }
  if (typeof document === 'undefined') return false;
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

const IconUploadSvg: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconUndoSvg: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </svg>
);

const IconSwapSvg: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

const IconLayersSvg: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const IconFolderSvg: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
  </svg>
);

function mapTrailWaypointType(type: string, name?: string): RouteWaypointType {
  if (type === 'trailhead' || type === 'start') return 'start';
  if (type === 'campsite' || type === 'camp') return 'camp';
  if (type === 'water') return 'water';
  if (type === 'summit' || type === 'peak') return 'peak';
  if (type === 'danger') return 'danger';
  if (type === 'end') return 'end';
  if (type === 'rest' && name) {
    const folded = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase();
    if (folded.includes('ket thuc') || folded.includes('dich') || folded.includes('end')) {
      return 'end';
    }
  }
  return 'viewpoint';
}

function mapPlannerToBackendWaypointType(
  type: RouteWaypointType
): 'campsite' | 'water' | 'viewpoint' | 'danger' | 'summit' | 'trailhead' | 'rest' {
  if (type === 'start') return 'trailhead';
  if (type === 'camp') return 'campsite';
  if (type === 'water') return 'water';
  if (type === 'peak') return 'summit';
  if (type === 'danger') return 'danger';
  if (type === 'end') return 'rest';
  return 'viewpoint';
}

function mapPlannerToTrailWaypointType(type: RouteWaypointType): 'campsite' | 'water' | 'viewpoint' | 'danger' | 'rest' {
  if (type === 'camp') return 'campsite';
  if (type === 'water') return 'water';
  if (type === 'danger') return 'danger';
  if (type === 'peak' || type === 'viewpoint') return 'viewpoint';
  return 'rest';
}

function mapWaypointToMarkerColor(
  type: RouteWaypointType
): 'primary' | 'danger' | 'warn' | 'info' | 'muted' {
  if (type === 'danger') return 'danger';
  if (type === 'peak' || type === 'camp') return 'warn';
  if (type === 'water' || type === 'viewpoint') return 'info';
  return 'primary';
}

function computeRouteBounds(
  vertices: RouteVertex[]
): [[number, number], [number, number]] | null {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let validCount = 0;

  for (const v of vertices) {
    if (!Number.isFinite(v.lat) || !Number.isFinite(v.lng)) continue;
    if (v.lat < minLat) minLat = v.lat;
    if (v.lat > maxLat) maxLat = v.lat;
    if (v.lng < minLng) minLng = v.lng;
    if (v.lng > maxLng) maxLng = v.lng;
    validCount += 1;
  }

  if (validCount < 2) return null;
  if (Math.abs(maxLat - minLat) < 1e-6 && Math.abs(maxLng - minLng) < 1e-6) return null;
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

function loadLocalSavedRoutes(): SavedCustomRouteRecord[] {
  try {
    const raw =
      localStorage.getItem(scopedStorageKey(LOCAL_ROUTES_STORAGE_KEY)) ||
      localStorage.getItem(LOCAL_ROUTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalSavedRoutes(items: SavedCustomRouteRecord[]) {
  try {
    localStorage.setItem(scopedStorageKey(LOCAL_ROUTES_STORAGE_KEY), JSON.stringify(items.slice(0, 30)));
  } catch {
    // ignore storage quota errors
  }
}

function buildVerticesFromTrail(trail: Trail): { vertices: RouteVertex[]; waypoints: PlannerWaypoint[] } {
  const track: Array<[number, number] | [number, number, number]> =
    Array.isArray(trail.gpxTrack) && trail.gpxTrack.length >= 2
      ? (trail.gpxTrack as Array<[number, number] | [number, number, number]>)
      : [
        [trail.startLat, trail.startLng] as [number, number],
        [trail.endLat, trail.endLng] as [number, number],
      ];

  const baseAlt = Math.max(80, trail.maxAltitudeM - trail.elevationGainM);
  const allHaveExplicitEle = track.every((pt) => pt.length >= 3 && Number.isFinite(Number(pt[2])));

  // Build cumulative distances along track for anchor projection & loop detection
  const cumKm: number[] = [0];
  for (let i = 1; i < track.length; i += 1) {
    cumKm.push(
      cumKm[i - 1] +
      calculateHaversineKm(track[i - 1][0], track[i - 1][1], track[i][0], track[i][1])
    );
  }
  const totalKm = cumKm[cumKm.length - 1] || 0;
  const startToEndKm = calculateHaversineKm(
    track[0][0],
    track[0][1],
    track[track.length - 1][0],
    track[track.length - 1][1]
  );
  const isLoopLike = totalKm > 0.5 && startToEndKm < Math.min(0.8, totalKm * 0.25);

  let vertices: RouteVertex[];
  if (allHaveExplicitEle) {
    vertices = track.map((pt) => ({
      lat: Number(pt[0]),
      lng: Number(pt[1]),
      elevationM: Math.round(Number(pt[2])),
    }));
  } else {
    // Use real waypoint elevations projected onto closest track indices as anchors
    const rawAnchors: Array<{ idx: number; ele: number }> = [];
    for (const wp of trail.waypoints || []) {
      if (typeof wp.elevationM !== 'number' || !Number.isFinite(wp.elevationM)) continue;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < track.length; i += 1) {
        const d = calculateHaversineKm(track[i][0], track[i][1], wp.lat, wp.lng);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      rawAnchors.push({ idx: bestIdx, ele: Math.round(wp.elevationM) });
    }

    if (rawAnchors.length >= 2) {
      rawAnchors.sort((a, b) => a.idx - b.idx);
      const deduped: Array<{ idx: number; ele: number }> = [];
      for (const a of rawAnchors) {
        if (deduped.length > 0 && deduped[deduped.length - 1].idx === a.idx) {
          deduped[deduped.length - 1] = a;
        } else {
          deduped.push(a);
        }
      }
      if (deduped[0].idx > 0) {
        deduped.unshift({ idx: 0, ele: baseAlt });
      }
      if (deduped[deduped.length - 1].idx < track.length - 1) {
        deduped.push({
          idx: track.length - 1,
          ele: isLoopLike ? baseAlt : trail.maxAltitudeM,
        });
      }
      vertices = track.map(([lat, lng], idx) => {
        let lo = deduped[0];
        let hi = deduped[deduped.length - 1];
        for (let j = 0; j < deduped.length - 1; j += 1) {
          if (idx >= deduped[j].idx && idx <= deduped[j + 1].idx) {
            lo = deduped[j];
            hi = deduped[j + 1];
            break;
          }
        }
        const span = Math.max(1, hi.idx - lo.idx);
        const t = Math.max(0, Math.min(1, (idx - lo.idx) / span));
        const estEle = Math.round(lo.ele + (hi.ele - lo.ele) * t);
        return { lat, lng, elevationM: estEle };
      });
    } else {
      vertices = track.map(([lat, lng], idx) => {
        const ratio = track.length > 1 ? idx / (track.length - 1) : 0;
        const curve = isLoopLike ? Math.sin(ratio * Math.PI) : Math.sin(ratio * Math.PI * 0.5);
        const estEle = Math.round(baseAlt + (trail.maxAltitudeM - baseAlt) * curve);
        return { lat, lng, elevationM: estEle };
      });
    }
  }

  let peakVertex = vertices[vertices.length - 1];
  for (const v of vertices) {
    if ((v.elevationM ?? -Infinity) > (peakVertex?.elevationM ?? -Infinity)) {
      peakVertex = v;
    }
  }

  const waypoints: PlannerWaypoint[] = [
    {
      id: `${trail.id}-start`,
      name: `Xuất phát — ${trail.district}`,
      type: 'start',
      lat: trail.startLat,
      lng: trail.startLng,
      elevationM: vertices[0]?.elevationM ?? baseAlt,
    },
    ...(trail.waypoints || []).map((wp) => ({
      id: wp.id,
      name: wp.name,
      type: mapTrailWaypointType(wp.type),
      lat: wp.lat,
      lng: wp.lng,
      elevationM: wp.elevationM,
      note: wp.description,
    })),
    {
      id: `${trail.id}-summit`,
      name: isLoopLike ? `Điểm cao nhất — ${trail.name}` : `Đích / Đỉnh ${trail.name}`,
      type: 'peak',
      lat: isLoopLike && peakVertex ? peakVertex.lat : trail.endLat,
      lng: isLoopLike && peakVertex ? peakVertex.lng : trail.endLng,
      elevationM: peakVertex?.elevationM ?? trail.maxAltitudeM,
    },
  ];

  return { vertices, waypoints };
}

function projectSampledElevationsOntoVertices(
  original: RouteVertex[],
  sampledCoords: [number, number][],
  sampledElevations: number[]
): RouteVertex[] {
  if (original.length === 0 || sampledCoords.length < 2 || sampledElevations.length < 2) {
    return original;
  }
  const origCum: number[] = [0];
  for (let i = 1; i < original.length; i += 1) {
    origCum.push(
      origCum[i - 1] +
      calculateHaversineKm(original[i - 1].lat, original[i - 1].lng, original[i].lat, original[i].lng)
    );
  }
  const sampCum: number[] = [0];
  for (let i = 1; i < sampledCoords.length; i += 1) {
    sampCum.push(
      sampCum[i - 1] +
      calculateHaversineKm(
        sampledCoords[i - 1][0],
        sampledCoords[i - 1][1],
        sampledCoords[i][0],
        sampledCoords[i][1]
      )
    );
  }
  const origTotal = origCum[origCum.length - 1] || 1;
  const sampTotal = sampCum[sampCum.length - 1] || 1;

  let j = 0;
  return original.map((v, idx) => {
    const targetDist = (origCum[idx] / origTotal) * sampTotal;
    while (j < sampCum.length - 2 && sampCum[j + 1] < targetDist) {
      j += 1;
    }
    const segLen = sampCum[j + 1] - sampCum[j];
    const t = segLen > 1e-9 ? Math.max(0, Math.min(1, (targetDist - sampCum[j]) / segLen)) : 0;
    const e0 = Number.isFinite(sampledElevations[j]) ? sampledElevations[j] : 0;
    const e1 = Number.isFinite(sampledElevations[j + 1]) ? sampledElevations[j + 1] : e0;
    return {
      lat: v.lat,
      lng: v.lng,
      elevationM: Math.round(e0 + (e1 - e0) * t),
    };
  });
}

export const RoutePlannerView: React.FC<RoutePlannerViewProps> = ({
  trails,
  currentUser,
  initialTrailId,
  onShowToast,
  onOpenContribute,
  onBack,
}) => {
  const svgUid = useId().replace(/:/g, '');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const demReqIdRef = useRef<number>(0);
  const libraryReqIdRef = useRef<number>(0);
  const libraryAbortRef = useRef<AbortController | null>(null);
  const saveAbortRef = useRef<AbortController | null>(null);
  const saveDialogRef = useRef<HTMLDivElement | null>(null);
  const libraryDrawerRef = useRef<HTMLDivElement | null>(null);
  const onShowToastRef = useRef(onShowToast);
  const lastInitialTrailIdRef = useRef<string | undefined>(initialTrailId);
  const hydratedShareSlugRef = useRef<string | null>(null);

  useEffect(() => {
    onShowToastRef.current = onShowToast;
  }, [onShowToast]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      libraryAbortRef.current?.abort();
      saveAbortRef.current?.abort();
    };
  }, []);

  const preselectedTrail = useMemo(() => {
    if (!initialTrailId) return null;
    return trails.find((t) => t.id === initialTrailId) || null;
  }, [trails, initialTrailId]);

  const initialSeed = useMemo(() => {
    if (preselectedTrail) return buildVerticesFromTrail(preselectedTrail);
    return { vertices: [] as RouteVertex[], waypoints: [] as PlannerWaypoint[] };
  }, [preselectedTrail]);

  const [routeTitle, setRouteTitle] = useState<string>(
    preselectedTrail ? `${preselectedTrail.name} (bản tự chỉnh)` : 'Cung đường mới'
  );
  const [routeDescription, setRouteDescription] = useState<string>(
    preselectedTrail ? preselectedTrail.description.slice(0, 220) : ''
  );
  const [routeRegion, setRouteRegion] = useState<Region>(preselectedTrail?.region || 'Miền Bắc');
  const [routeProvince, setRouteProvince] = useState<string>(preselectedTrail?.province || 'Lào Cai');
  const [baseTrailId, setBaseTrailId] = useState<string>(preselectedTrail?.id || '');

  const [vertices, setVertices] = useState<RouteVertex[]>(initialSeed.vertices);
  const [waypoints, setWaypoints] = useState<PlannerWaypoint[]>(initialSeed.waypoints);
  const [undoStack, setUndoStack] = useState<Array<{ vertices: RouteVertex[]; waypoints: PlannerWaypoint[] }>>([]);

  const [tileKey, setTileKey] = useState<MapTileKey>('topo');
  const [clickMode, setClickMode] = useState<ClickToolMode>('vertex');
  const [activeWaypointType, setActiveWaypointType] = useState<RouteWaypointType>('camp');
  const [fitBoundsToken, setFitBoundsToken] = useState<number>(initialSeed.vertices.length > 0 ? 1 : 0);
  const [selectedPin, setSelectedPin] = useState<
    { kind: 'vertex'; idx: number } | { kind: 'waypoint'; id: string } | null
  >(null);
  const [repositioningPin, setRepositioningPin] = useState<boolean>(false);

  // Adjustable ETA & Bio settings
  const [packWeightKg, setPackWeightKg] = useState<number>(8);
  const [fitnessLevel, setFitnessLevel] = useState<RouteFitnessLevel>('intermediate');

  // DEM Elevation & SVG Hover Scrub state
  const [demLoading, setDemLoading] = useState<boolean>(false);
  const [elevationSource, setElevationSource] = useState<ElevationSourceState>(
    initialSeed.vertices.length > 0 ? 'interpolated' : 'none'
  );
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Save & Share modal + My Routes / Community drawer
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [saveVisibility, setSaveVisibility] = useState<'private' | 'unlisted' | 'public'>('public');
  const [savingRoute, setSavingRoute] = useState<boolean>(false);
  const [loadedRouteMeta, setLoadedRouteMeta] = useState<LoadedRouteMeta | null>(null);
  const currentUserId = String(currentUser?.id || (currentUser as (User & { _id?: string }) | null)?._id || '');

  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [libraryTab, setLibraryTab] = useState<'mine' | 'public'>('mine');
  const [myRoutes, setMyRoutes] = useState<SavedCustomRouteRecord[]>(loadLocalSavedRoutes);
  const [publicRoutes, setPublicRoutes] = useState<SavedCustomRouteRecord[]>([]);
  const [libraryLoading, setLibraryLoading] = useState<boolean>(false);
  const [confirmDeleteRouteId, setConfirmDeleteRouteId] = useState<string | null>(null);
  const [deletingRouteId, setDeletingRouteId] = useState<string | null>(null);
  const [shareCardSnapshot, setShareCardSnapshot] = useState<
    ExpeditionShareCardModalProps['initialData'] | null
  >(null);

  useFocusTrap(isSaveModalOpen, saveDialogRef);
  useFocusTrap(isLibraryOpen, libraryDrawerRef);

  // Compute live terrain/ETA/slope metrics
  const metrics = useMemo<RouteMetricsSummary>(
    () =>
      computeRouteMetrics(vertices, {
        packWeightKg,
        fitnessLevel,
      }),
    [vertices, packWeightKg, fitnessLevel]
  );

  // Compute segment-by-segment Waypoint Leg Splits (distance, +m/-m, avg slope, Naismith/Tobler ETA, cumulative ETA)
  const legSplits = useMemo<WaypointLegSplit[]>(
    () =>
      computeWaypointLegSplits(vertices, waypoints, {
        packWeightKg,
        fitnessLevel,
      }),
    [vertices, waypoints, packWeightKg, fitnessLevel]
  );

  // Compute 4-tier Slope Grade Breakdown (<5% Bằng, 5-12% Dốc vừa, 12-20% Dốc gắt, >20% Đứng)
  const slopeBreakdown = useMemo<FourTierSlopeBreakdown>(
    () => computeFourTierSlopeBreakdown(metrics.profile),
    [metrics.profile]
  );

  const cancelPendingDem = useCallback(() => {
    demReqIdRef.current += 1;
    setDemLoading(false);
  }, []);

  const handleCopyLegSplits = () => {
    if (legSplits.length === 0) return;
    const text = formatLegSplitsPlainText(routeTitle, legSplits);
    void copyTextSafe(text).then((ok) => {
      if (!isMountedRef.current) return;
      if (ok) {
        onShowToastRef.current?.(`Đã sao chép bảng phân chặng (${legSplits.length} chặng) vào bộ nhớ tạm.`, 'success');
      } else {
        onShowToastRef.current?.('Không thể sao chép bảng phân chặng lúc này.', 'error');
      }
    });
  };

  // Push history snapshot before destructive/edit ops
  const pushUndoSnapshot = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-19), { vertices, waypoints }]);
  }, [vertices, waypoints]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    cancelPendingDem();
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setVertices(prev.vertices);
    setWaypoints(prev.waypoints);
    setHoverIdx(null);
    setSelectedPin(null);
    setRepositioningPin(false);
  };

  const handleReverseRoute = () => {
    if (vertices.length < 2) return;
    cancelPendingDem();
    pushUndoSnapshot();
    const reversedVertices = [...vertices].reverse();
    const flipEndpointName = (name: string): string => {
      if (/^Xuất phát\s*[—–-]\s*/i.test(name)) return name.replace(/^Xuất phát\s*[—–-]\s*/i, 'Kết thúc — ');
      if (/^Kết thúc\s*[—–-]\s*/i.test(name)) return name.replace(/^Kết thúc\s*[—–-]\s*/i, 'Xuất phát — ');
      if (/^Đích\s*\/\s*Đỉnh\s+/i.test(name)) return name.replace(/^Đích\s*\/\s*Đỉnh\s+/i, 'Xuất phát / Đỉnh ');
      if (/^Xuất phát\s*\/\s*Đỉnh\s+/i.test(name)) return name.replace(/^Xuất phát\s*\/\s*Đỉnh\s+/i, 'Đích / Đỉnh ');
      return name;
    };
    const reversedWaypoints = [...waypoints].reverse().map((wp) => {
      if (wp.type === 'start') {
        return { ...wp, type: 'end' as RouteWaypointType, name: flipEndpointName(wp.name) };
      }
      if (wp.type === 'end') {
        return { ...wp, type: 'start' as RouteWaypointType, name: flipEndpointName(wp.name) };
      }
      if (wp.type === 'peak') {
        return { ...wp, name: flipEndpointName(wp.name) };
      }
      return wp;
    });
    const recomputed = computeRouteMetrics(reversedVertices, {
      packWeightKg,
      fitnessLevel,
    });
    setVertices(reversedVertices);
    setWaypoints(reversedWaypoints);
    setHoverIdx(null);
    setSelectedPin(null);
    setRepositioningPin(false);
    onShowToast?.(
      `Đã đảo chiều đi — leo +${recomputed.elevationGainM}m / xuống -${recomputed.elevationLossM}m (~${formatDurationHoursVi(recomputed.recommendedHours)}).`,
      'info'
    );
  };

  const handleOpenShareCard = () => {
    if (vertices.length < 2) {
      onShowToast?.('Hãy chấm hoặc mở tối thiểu 2 điểm trước khi tạo thẻ ảnh nhé.', 'error');
      return;
    }
    const trackPoints = vertices
      .filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lng))
      .map((v) => ({
        lat: v.lat,
        lng: v.lng,
        altitudeM:
          typeof v.elevationM === 'number' && Number.isFinite(v.elevationM)
            ? Math.round(v.elevationM)
            : null,
      }));

    // Pick highest-elevation finite vertex (or last vertex) as focal summit coordinate
    let focalPt = trackPoints[trackPoints.length - 1] || null;
    for (const pt of trackPoints) {
      if (
        typeof pt.altitudeM === 'number' &&
        (focalPt === null || typeof focalPt.altitudeM !== 'number' || pt.altitudeM > focalPt.altitudeM)
      ) {
        focalPt = pt;
      }
    }

    const hasElevationMetrics = metrics.hasRealElevation && elevationSource !== 'none';
    if (!hasElevationMetrics) {
      onShowToast?.(
        'Mẹo nhỏ: bấm "Đo cao độ địa hình" trước để thẻ ảnh hiện đủ độ cao đỉnh và độ dốc thật.',
        'info'
      );
    }

    setShareCardSnapshot({
      peakName: routeTitle.trim() || 'Cung đường mới',
      province: routeProvince.trim() || 'Việt Nam',
      region: routeRegion,
      altitudeM: hasElevationMetrics ? metrics.maxAltitudeM : 0,
      distanceKm: metrics.distanceKm,
      elevationGainM: hasElevationMetrics ? metrics.elevationGainM : 0,
      durationLabel: formatDurationHoursVi(metrics.recommendedHours),
      dateLabel: new Date().toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
      hikerName: currentUser?.fullName || currentUser?.username || 'Người đi rừng',
      verifiedGps: false,
      coordinates: focalPt ? { lat: focalPt.lat, lng: focalPt.lng } : null,
      trackPoints,
      defaultCaption: hasElevationMetrics
        ? `Cung tự vẽ ${metrics.distanceKm.toFixed(1)} km (+${metrics.elevationGainM}m · dốc gắt nhất ${metrics.maxSlopePercent}%) trên LOST`
        : `Cung tự vẽ ${metrics.distanceKm.toFixed(1)} km trên LOST`,
    });
  };

  const handleClearRoute = () => {
    if (vertices.length === 0 && waypoints.length === 0) return;
    cancelPendingDem();
    pushUndoSnapshot();
    setVertices([]);
    setWaypoints([]);
    setBaseTrailId('');
    setLoadedRouteMeta(null);
    setElevationSource('none');
    setHoverIdx(null);
    setSelectedPin(null);
    setRepositioningPin(false);
    onShowToast?.('Đã xóa sạch các điểm trên bản đồ.', 'info');
  };

  const handleMoveVertex = useCallback(
    (idx: number, lat: number, lng: number) => {
      cancelPendingDem();
      pushUndoSnapshot();
      setVertices((prev) =>
        prev.map((v, i) =>
          i === idx
            ? { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), elevationM: null }
            : v
        )
      );
      setHoverIdx(null);
      if (elevationSource === 'server-dem' || elevationSource === 'terrarium-dem') {
        setElevationSource('interpolated');
      }
    },
    [cancelPendingDem, pushUndoSnapshot, elevationSource]
  );

  const handleMoveWaypoint = useCallback(
    (wpId: string, lat: number, lng: number) => {
      pushUndoSnapshot();
      setWaypoints((prev) =>
        prev.map((wp) => (wp.id === wpId ? { ...wp, lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) } : wp))
      );
    },
    [pushUndoSnapshot]
  );

  const handleMapClick = useCallback(
    (rawLat: number, rawLng: number) => {
      const lat = Number(rawLat.toFixed(6));
      const lng = Number(rawLng.toFixed(6));
      if (repositioningPin && selectedPin) {
        if (selectedPin.kind === 'vertex') {
          handleMoveVertex(selectedPin.idx, lat, lng);
          onShowToastRef.current?.(`Đã dời điểm #${selectedPin.idx + 1} sang vị trí mới.`, 'info');
        } else {
          handleMoveWaypoint(selectedPin.id, lat, lng);
          onShowToastRef.current?.('Đã dời vị trí mốc trên bản đồ.', 'info');
        }
        setRepositioningPin(false);
        return;
      }

      pushUndoSnapshot();
      if (clickMode === 'waypoint') {
        // Waypoint mode ONLY drops a marker — never mutates route polyline geometry or DEM source
        let nearestEle: number | undefined;
        let nearestDistKm = 0.25;
        for (const v of vertices) {
          if (typeof v.elevationM !== 'number' || !Number.isFinite(v.elevationM)) continue;
          const d = calculateHaversineKm(v.lat, v.lng, lat, lng);
          if (d < nearestDistKm) {
            nearestDistKm = d;
            nearestEle = v.elevationM;
          }
        }
        const meta = WAYPOINT_TYPE_META[activeWaypointType];
        const newWp: PlannerWaypoint = {
          id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: `${meta.label} #${waypoints.length + 1}`,
          type: activeWaypointType,
          lat,
          lng,
          ...(typeof nearestEle === 'number' ? { elevationM: nearestEle } : {}),
        };
        setWaypoints((prev) => [...prev, newWp]);
        return;
      }

      const nextVertex: RouteVertex = { lat, lng, elevationM: null };
      setVertices((prev) => [...prev, nextVertex]);
      if (elevationSource === 'server-dem' || elevationSource === 'terrarium-dem') {
        setElevationSource('interpolated');
      }
    },
    [
      repositioningPin,
      selectedPin,
      handleMoveVertex,
      handleMoveWaypoint,
      pushUndoSnapshot,
      clickMode,
      activeWaypointType,
      vertices,
      waypoints.length,
      elevationSource,
    ]
  );

  const handleLoadTrailTemplate = (tid: string) => {
    const tr = trails.find((t) => t.id === tid);
    if (!tr) return;
    cancelPendingDem();
    pushUndoSnapshot();
    const built = buildVerticesFromTrail(tr);
    setVertices(built.vertices);
    setWaypoints(built.waypoints);
    setRouteTitle(`${tr.name} (bản tự chỉnh)`);
    setRouteDescription(tr.description.slice(0, 220));
    setRouteRegion(tr.region);
    setRouteProvince(tr.province);
    setBaseTrailId(tr.id);
    setElevationSource('interpolated');
    setHoverIdx(null);
    setSelectedPin(null);
    setRepositioningPin(false);
    setFitBoundsToken((n) => n + 1);
    onShowToast?.(`Đã mở khung cung ${tr.name} (${built.vertices.length} điểm). Bấm "Đo cao độ địa hình" để cập nhật mặt cắt thật.`, 'success');
  };

  // Local GPX File Import
  const handleImportGpxFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      onShowToast?.('Tệp GPX nặng quá 4 MB, bạn chọn tệp gọn hơn nhé.', 'error');
      return;
    }
    try {
      const xmlText = await file.text();
      const parsed = parseGpxXml(xmlText);
      cancelPendingDem();
      pushUndoSnapshot();
      setVertices(parsed.vertices);
      setWaypoints(parsed.waypoints);
      setRouteTitle(parsed.title || file.name.replace(/\.gpx$/i, ''));
      if (parsed.description) setRouteDescription(parsed.description);
      setBaseTrailId('');
      setElevationSource(parsed.hasElevation ? 'gpx-elevation' : 'none');
      setHoverIdx(null);
      setSelectedPin(null);
      setRepositioningPin(false);
      setFitBoundsToken((n) => n + 1);
      onShowToast?.(
        `Đã mở tệp GPX (${parsed.vertices.length} điểm đường đi, ${parsed.waypoints.length} mốc).`,
        'success'
      );
    } catch (err) {
      onShowToast?.(err instanceof Error ? err.message : 'Chưa đọc được tệp GPX này.', 'error');
    }
  };

  // Fetch Real DEM Elevation (Backend POST /api/custom-routes/analyze -> AWS Terrarium PNG Canvas Decoder -> Honest offline error)
  const handleFetchRealDem = async () => {
    if (vertices.length < 2) {
      onShowToast?.('Hãy chấm tối thiểu 2 điểm trên bản đồ trước khi đo cao độ nhé.', 'error');
      return;
    }

    const reqId = ++demReqIdRef.current;
    const sourceVertices = vertices;
    const preserveDenseGeometry = sourceVertices.length > 64;
    setDemLoading(true);
    const densifiedCoords = interpolateVerticesForDem(sourceVertices, 64);

    // 1. Primary: LOST Backend POST /api/custom-routes/analyze (powered by AWS Open Data Terrarium DEM)
    try {
      const res = await fetch('/api/custom-routes/analyze', {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        signal: AbortSignal.timeout(8_000),
        body: JSON.stringify({
          trackPoints: densifiedCoords,
          baseTrailId: baseTrailId || undefined,
        }),
      });
      if (!isMountedRef.current || demReqIdRef.current !== reqId) return;
      if (res.ok) {
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: {
            elevationProfile?:
            | Array<{ lat?: number; lng?: number; elevationM?: number }>
            | {
              source?: string;
              points?: Array<{ lat?: number; lng?: number; elevationM?: number }>;
            };
            points?: Array<{ lat?: number; lng?: number; elevationM?: number }>;
            source?: string;
          };
        } | null;
        if (!isMountedRef.current || demReqIdRef.current !== reqId) return;
        const rawProfile = json?.data?.elevationProfile;
        const pts = Array.isArray(rawProfile)
          ? rawProfile
          : Array.isArray(rawProfile?.points)
            ? rawProfile.points
            : json?.data?.points;
        const profileSource =
          (!Array.isArray(rawProfile) ? rawProfile?.source : undefined) || json?.data?.source || '';
        const isFallbackSource = profileSource === 'interpolated-fallback';
        if (json?.success && Array.isArray(pts) && pts.length >= 2 && !isFallbackSource) {
          const sampledCoords: [number, number][] = pts.map((p, idx) => [
            typeof p.lat === 'number' ? p.lat : densifiedCoords[Math.min(idx, densifiedCoords.length - 1)][0],
            typeof p.lng === 'number' ? p.lng : densifiedCoords[Math.min(idx, densifiedCoords.length - 1)][1],
          ]);
          const sampledElevations: number[] = pts.map((p) =>
            typeof p.elevationM === 'number' && Number.isFinite(p.elevationM) ? Math.round(p.elevationM) : 0
          );
          const updated: RouteVertex[] = preserveDenseGeometry
            ? projectSampledElevationsOntoVertices(sourceVertices, sampledCoords, sampledElevations)
            : sampledCoords.map(([lat, lng], idx) => ({
                lat,
                lng,
                elevationM: sampledElevations[idx],
              }));
          pushUndoSnapshot();
          setVertices(updated);
          setElevationSource('server-dem');
          setDemLoading(false);
          onShowToastRef.current?.(
            preserveDenseGeometry
              ? `Đã đo xong cao độ địa hình thật và áp lên đủ ${updated.length} điểm tuyến.`
              : `Đã đo xong cao độ địa hình thực tế (${updated.length} điểm mẫu).`,
            'success'
          );
          return;
        }
      }
    } catch {
      if (!isMountedRef.current || demReqIdRef.current !== reqId) return;
      // Fall through to direct browser AWS Terrarium DEM PNG decoder
    }

    // 2. Fallback: Direct browser AWS Open Data Terrarium PNG decoder (100% free commercial & works offline with cached packs)
    try {
      const terrariumElevations = await sampleTerrariumElevations(densifiedCoords, {
        zoom: 12,
        signal: AbortSignal.timeout(8_000),
      });
      if (!isMountedRef.current || demReqIdRef.current !== reqId) return;
      if (Array.isArray(terrariumElevations) && terrariumElevations.length === densifiedCoords.length) {
        const cleanEles = terrariumElevations.map((e) => (Number.isFinite(e) ? Math.round(e) : 0));
        const updated: RouteVertex[] = preserveDenseGeometry
          ? projectSampledElevationsOntoVertices(sourceVertices, densifiedCoords, cleanEles)
          : densifiedCoords.map(([lat, lng], i) => ({
              lat,
              lng,
              elevationM: cleanEles[i],
            }));
        pushUndoSnapshot();
        setVertices(updated);
        setElevationSource('terrarium-dem');
        setDemLoading(false);
        onShowToastRef.current?.(
          preserveDenseGeometry
            ? `Đã đo xong cao độ AWS Terrarium và áp lên đủ ${updated.length} điểm tuyến.`
            : `Đã đo xong cao độ từ dữ liệu AWS Terrarium (${updated.length} điểm).`,
          'success'
        );
        return;
      }
    } catch {
      if (!isMountedRef.current || demReqIdRef.current !== reqId) return;
      // Both online DEM sources failed — never invent fake mountain heights (Rule 11)
    }

    if (!isMountedRef.current || demReqIdRef.current !== reqId) return;
    setDemLoading(false);
    onShowToastRef.current?.(
      'Không thể kết nối dữ liệu địa hình DEM khi ngoại tuyến — vui lòng kết nối mạng hoặc tải gói bản đồ ngoại tuyến rồi đo lại.',
      'error'
    );
  };

  // Export GPX 1.1 XML file (including standard <wpt><sym>...</sym><type>...</type></wpt>)
  const handleExportGpx = () => {
    if (vertices.length < 2) {
      onShowToast?.('Cần tối thiểu 2 điểm để xuất file GPX 1.1.', 'error');
      return;
    }
    const baseXml = exportGpxXml({
      title: routeTitle || 'LOST Custom Route',
      description: routeDescription,
      vertices,
      waypoints,
    });
    const xml = enrichGpxXmlWithWaypointSymbols(baseXml, waypoints);
    const slug = (routeTitle || 'lost-route')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'lost-route';

    const blob = new Blob([xml], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    onShowToast?.(`Đã xuất tệp ${slug}.gpx (chuẩn GPX 1.1).`, 'success');
  };

  const isLoadedRouteOwner = Boolean(
    loadedRouteMeta &&
    (loadedRouteMeta.isOwner ||
      (currentUserId && loadedRouteMeta.creatorId && loadedRouteMeta.creatorId === currentUserId))
  );

  const canUpdateLoadedRoute = Boolean(
    currentUser &&
    isLoadedRouteOwner &&
    !loadedRouteMeta?.isLocalOnly &&
    loadedRouteMeta?.id &&
    /^[a-fA-F0-9]{24}$/.test(loadedRouteMeta.id)
  );

  // Save & Share Custom Route (PUT /api/custom-routes/:id for owned loaded route, or POST for new / copy)
  const submitSaveCustomRoute = async (saveAsCopy: boolean) => {
    if (vertices.length < 2) {
      onShowToast?.('Cần chấm tối thiểu 2 điểm trước khi lưu.', 'error');
      return;
    }
    const cleanTitle = routeTitle.trim() || 'Cung đường tự vẽ LOST';
    setSavingRoute(true);

    const serializedTrackPoints: Array<[number, number] | [number, number, number]> = vertices.map((v) =>
      typeof v.elevationM === 'number' && Number.isFinite(v.elevationM)
        ? ([v.lat, v.lng, Math.round(v.elevationM)] as [number, number, number])
        : ([v.lat, v.lng] as [number, number])
    );

    const payload = {
      title: cleanTitle,
      description: routeDescription.trim(),
      region: routeRegion,
      province: routeProvince.trim() || 'Việt Nam',
      baseTrailId: baseTrailId || undefined,
      waypoints: waypoints.map((w) => ({
        id: w.id,
        name: w.name,
        type: mapPlannerToBackendWaypointType(w.type),
        lat: w.lat,
        lng: w.lng,
        elevationM: w.elevationM,
        note: w.note,
      })),
      trackPoints: serializedTrackPoints,
      visibility: saveVisibility,
    };

    const shouldUpdateExisting = !saveAsCopy && canUpdateLoadedRoute && Boolean(loadedRouteMeta?.id);
    const localSlug =
      !saveAsCopy && loadedRouteMeta?.isLocalOnly && loadedRouteMeta.shareSlug
        ? loadedRouteMeta.shareSlug
        : `local-${Date.now().toString(36)}`;
    const localId =
      !saveAsCopy && loadedRouteMeta?.isLocalOnly && loadedRouteMeta.id
        ? loadedRouteMeta.id
        : `local-route-${Date.now()}`;

    const localRecord: SavedCustomRouteRecord = {
      id: localId,
      shareSlug: localSlug,
      ...payload,
      waypoints,
      elevations: vertices.map((v) => (typeof v.elevationM === 'number' ? v.elevationM : 0)),
      metrics: {
        distanceKm: metrics.distanceKm,
        elevationGainM: metrics.elevationGainM,
        elevationLossM: metrics.elevationLossM,
        maxAltitudeM: metrics.maxAltitudeM,
        minAltitudeM: metrics.minAltitudeM,
        maxSlopePercent: metrics.maxSlopePercent,
        naismithHours: metrics.naismithLangmuirHours,
        toblerHours: metrics.toblerHours,
        difficultyEstimate: metrics.estimatedDifficulty,
      },
      likesCount: 0,
      isLocalOnly: true,
      createdAt: new Date().toISOString(),
    };

    let savedRecord = localRecord;
    let syncedCloud = false;
    saveAbortRef.current?.abort();
    const saveController = new AbortController();
    saveAbortRef.current = saveController;

    if (currentUser) {
      try {
        const endpoint = shouldUpdateExisting
          ? `/api/custom-routes/${encodeURIComponent(loadedRouteMeta!.id)}`
          : '/api/custom-routes';
        const res = await fetch(endpoint, {
          method: shouldUpdateExisting ? 'PUT' : 'POST',
          headers: getApiHeaders({ 'Content-Type': 'application/json' }),
          signal: saveController.signal,
          body: JSON.stringify(payload),
        });
        if (!isMountedRef.current || saveController.signal.aborted) return;
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          message?: string;
          data?: SavedCustomRouteRecord;
        } | null;
        if (!isMountedRef.current || saveController.signal.aborted) return;
        if (res.ok && json?.success && json.data) {
          const resolvedId = json.data._id || json.data.id || localRecord.id;
          savedRecord = {
            ...json.data,
            id: resolvedId,
            waypoints,
            elevations: localRecord.elevations,
            isLocalOnly: false,
          };
          syncedCloud = true;
          setLoadedRouteMeta({
            id: resolvedId,
            shareSlug: savedRecord.shareSlug,
            isOwner: true,
            creatorId: currentUserId || undefined,
            isLocalOnly: false,
          });
        } else if (res.status >= 400 && res.status < 500) {
          setSavingRoute(false);
          onShowToastRef.current?.(
            json?.message || 'Không thể lưu cung đường — vui lòng kiểm tra lại thông tin tuyến.',
            'error'
          );
          return;
        }
      } catch {
        if (!isMountedRef.current || saveController.signal.aborted) return;
        // Fallback cleanly to localStorage below
      }
    }

    if (!syncedCloud) {
      setLoadedRouteMeta({
        id: savedRecord.id,
        shareSlug: savedRecord.shareSlug,
        isOwner: true,
        isLocalOnly: true,
      });
    }

    if (!isMountedRef.current || saveController.signal.aborted) return;
    const existingLocal = loadLocalSavedRoutes().filter((r) => r.shareSlug !== savedRecord.shareSlug);
    const updatedLocal = [savedRecord, ...existingLocal];
    saveLocalSavedRoutes(updatedLocal);
    setMyRoutes((prev) => [
      savedRecord,
      ...prev.filter((r) => r.shareSlug !== savedRecord.shareSlug && r.id !== savedRecord.id),
    ]);
    setSavingRoute(false);
    setIsSaveModalOpen(false);

    onShowToastRef.current?.(
      syncedCloud
        ? shouldUpdateExisting
          ? `Đã cập nhật cung "${cleanTitle}".`
          : `Đã lưu cung "${cleanTitle}" lên tài khoản của bạn.`
        : currentUser
          ? `Đã lưu tạm "${cleanTitle}" trên máy (ngoại tuyến).`
          : `Đã lưu "${cleanTitle}" trên trình duyệt. Đăng nhập để chia sẻ cùng anh em nhé.`,
      'success'
    );
  };

  const handleSaveCustomRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitSaveCustomRoute(false);
  };

  const handleOpenLiveGpsForRoute = () => {
    if (vertices.length < 2) {
      onShowToast?.('Hãy chấm hoặc mở tối thiểu 2 điểm trước khi mở GPS dẫn đường nhé.', 'error');
      return;
    }
    const cleanTitle = routeTitle.trim() || 'Cung đường mới';
    const targetSlug = loadedRouteMeta?.shareSlug || `local-live-${Date.now().toString(36)}`;
    const draftRecord: SavedCustomRouteRecord = {
      id: loadedRouteMeta?.id || `local-route-${Date.now()}`,
      shareSlug: targetSlug,
      title: cleanTitle,
      description: routeDescription.trim(),
      region: routeRegion,
      province: routeProvince.trim() || 'Việt Nam',
      baseTrailId: baseTrailId || undefined,
      waypoints,
      trackPoints: vertices.map((v) =>
        typeof v.elevationM === 'number' && Number.isFinite(v.elevationM)
          ? ([v.lat, v.lng, Math.round(v.elevationM)] as [number, number, number])
          : ([v.lat, v.lng] as [number, number])
      ),
      elevations: vertices.map((v) => (typeof v.elevationM === 'number' ? v.elevationM : 0)),
      metrics: {
        distanceKm: metrics.distanceKm,
        elevationGainM: metrics.elevationGainM,
        elevationLossM: metrics.elevationLossM,
        maxAltitudeM: metrics.maxAltitudeM,
        minAltitudeM: metrics.minAltitudeM,
        maxSlopePercent: metrics.maxSlopePercent,
        naismithHours: metrics.naismithLangmuirHours,
        toblerHours: metrics.toblerHours,
        difficultyEstimate: metrics.estimatedDifficulty,
      },
      visibility: saveVisibility,
      isLocalOnly: loadedRouteMeta?.isLocalOnly ?? true,
      createdAt: new Date().toISOString(),
    };
    const existingLocal = loadLocalSavedRoutes().filter((r) => r.shareSlug !== targetSlug);
    saveLocalSavedRoutes([draftRecord, ...existingLocal]);
    window.dispatchEvent(
      new CustomEvent('lost:open-live-tracker', {
        detail: { customRouteId: targetSlug, trailId: baseTrailId || undefined },
      })
    );
    onShowToast?.(`Đang mở Live GPS dẫn đường theo tuyến "${cleanTitle}"...`, 'info');
  };

  // Hydrate shared /planner?route=<shareSlug> once per shareSlug (never wipe unsaved edits on auth change)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const shareSlug = new URLSearchParams(window.location.search).get('route')?.trim();
    if (!shareSlug || hydratedShareSlugRef.current === shareSlug) return;
    hydratedShareSlugRef.current = shareSlug;

    const controller = new AbortController();
    const hydrateShared = async () => {
      const applySharedRoute = (rec: SavedCustomRouteRecord, sourceLabel: string) => {
        if (controller.signal.aborted || !isMountedRef.current) return;
        const pts = Array.isArray(rec.trackPoints) ? rec.trackPoints : [];
        if (pts.length < 2) return;
        const loadedVertices: RouteVertex[] = pts.map((rawPt, idx) => {
          const ptArr = rawPt as unknown as number[];
          const thirdEle = ptArr.length >= 3 && Number.isFinite(Number(ptArr[2])) ? Math.round(Number(ptArr[2])) : null;
          const arrEle = Array.isArray(rec.elevations) && typeof rec.elevations[idx] === 'number' ? rec.elevations[idx] : null;
          return {
            lat: Number(ptArr[0]),
            lng: Number(ptArr[1]),
            elevationM: thirdEle ?? arrEle,
          };
        });
        setVertices(loadedVertices);
        setWaypoints(
          Array.isArray(rec.waypoints)
            ? rec.waypoints.map((w) => ({ ...w, type: mapTrailWaypointType(w.type, w.name) }))
            : []
        );
        setRouteTitle(rec.title || 'Cung chia sẻ LOST');
        setRouteDescription(rec.description || '');
        if (rec.region === 'Miền Bắc' || rec.region === 'Miền Trung' || rec.region === 'Miền Nam') {
          setRouteRegion(rec.region);
        }
        if (rec.province) setRouteProvince(rec.province);
        setBaseTrailId(rec.baseTrailId || '');
        setSaveVisibility(rec.visibility || 'public');
        const ownerIdRaw =
          typeof rec.creatorId === 'object' && rec.creatorId
            ? String(rec.creatorId._id || rec.creatorId.id || '')
            : String(rec.creatorId || '');
        setLoadedRouteMeta({
          id: rec._id || rec.id,
          shareSlug: rec.shareSlug,
          isOwner: Boolean(rec.isLocalOnly),
          creatorId: ownerIdRaw || undefined,
          isLocalOnly: rec.isLocalOnly,
        });
        setElevationSource(loadedVertices.some((v) => typeof v.elevationM === 'number') ? 'server-dem' : 'none');
        setFitBoundsToken((n) => n + 1);
        onShowToastRef.current?.(`Đã mở cung chia sẻ "${rec.title}" (${sourceLabel}).`, 'success');
      };

      try {
        const res = await fetch(`/api/custom-routes/share/${encodeURIComponent(shareSlug)}`, {
          headers: getApiHeaders(),
          signal: controller.signal,
        });
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: SavedCustomRouteRecord;
        } | null;
        if (res.ok && json?.success && json.data) {
          applySharedRoute(json.data, 'LOST Cloud');
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
      }

      const localMatch = loadLocalSavedRoutes().find((r) => r.shareSlug === shareSlug);
      if (localMatch) {
        applySharedRoute(localMatch, 'Offline');
      } else if (!controller.signal.aborted && isMountedRef.current) {
        onShowToastRef.current?.(`Không tìm thấy cung chia sẻ "${shareSlug}".`, 'error');
      }
    };

    void hydrateShared();
    return () => controller.abort();
  }, []);

  // Sync initialTrailId when switching trails in-place
  useEffect(() => {
    if (!initialTrailId || initialTrailId === lastInitialTrailIdRef.current) return;
    lastInitialTrailIdRef.current = initialTrailId;
    const shareSlug = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('route') : null;
    if (shareSlug) return;
    const tr = trails.find((t) => t.id === initialTrailId);
    if (!tr) return;
    const built = buildVerticesFromTrail(tr);
    const rafId = window.requestAnimationFrame(() => {
      if (!isMountedRef.current) return;
      setVertices(built.vertices);
      setWaypoints(built.waypoints);
      setRouteTitle(`${tr.name} (bản tự chỉnh)`);
      setRouteDescription(tr.description.slice(0, 220));
      setRouteRegion(tr.region);
      setRouteProvince(tr.province);
      setBaseTrailId(tr.id);
      setLoadedRouteMeta(null);
      setElevationSource('interpolated');
      setSelectedPin(null);
      setRepositioningPin(false);
      setFitBoundsToken((n) => n + 1);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [initialTrailId, trails]);

  // Load My Routes & Community Public Routes when opening drawer
  const refreshLibrary = useCallback(async () => {
    const reqId = ++libraryReqIdRef.current;
    libraryAbortRef.current?.abort();
    const controller = new AbortController();
    libraryAbortRef.current = controller;

    setLibraryLoading(true);
    const localItems = loadLocalSavedRoutes();

    const [meResult, pubResult] = await Promise.allSettled([
      currentUser
        ? fetch('/api/custom-routes/me', { headers: getApiHeaders(), signal: controller.signal }).then((r) => r.json())
        : Promise.resolve(null),
      fetch('/api/custom-routes/public?limit=24', { headers: getApiHeaders(), signal: controller.signal }).then((r) => r.json()),
    ]);

    if (!isMountedRef.current || controller.signal.aborted || libraryReqIdRef.current !== reqId) return;

    if (meResult.status === 'fulfilled' && meResult.value?.success && Array.isArray(meResult.value.data)) {
      const serverMine = (meResult.value.data as SavedCustomRouteRecord[]).map((item) => ({
        ...item,
        id: item.id || item._id || item.shareSlug,
        isLocalOnly: false,
      }));
      const seenSlugs = new Set(serverMine.map((s) => s.shareSlug));
      setMyRoutes([...serverMine, ...localItems.filter((l) => !seenSlugs.has(l.shareSlug))]);
    } else {
      setMyRoutes(localItems);
    }

    if (pubResult.status === 'fulfilled' && pubResult.value?.success && Array.isArray(pubResult.value.data)) {
      setPublicRoutes(
        (pubResult.value.data as SavedCustomRouteRecord[]).map((item) => ({
          ...item,
          id: item.id || item._id || item.shareSlug,
        }))
      );
    } else {
      setPublicRoutes([]);
    }

    setLibraryLoading(false);
  }, [currentUser]);

  const handleOpenLibrary = () => {
    setIsLibraryOpen(true);
    void refreshLibrary();
  };

  const handleLoadSavedRoute = (rec: SavedCustomRouteRecord) => {
    cancelPendingDem();
    pushUndoSnapshot();
    const loadedVertices: RouteVertex[] = (rec.trackPoints || []).map((rawPt, idx) => {
      const ptArr = rawPt as unknown as number[];
      const thirdEle =
        ptArr.length >= 3 && Number.isFinite(Number(ptArr[2])) ? Math.round(Number(ptArr[2])) : null;
      const arrEle =
        Array.isArray(rec.elevations) && typeof rec.elevations[idx] === 'number' && Number.isFinite(rec.elevations[idx])
          ? Math.round(rec.elevations[idx])
          : null;
      return {
        lat: Number(ptArr[0]),
        lng: Number(ptArr[1]),
        elevationM: thirdEle ?? arrEle,
      };
    });
    const hasEle = loadedVertices.some((v) => typeof v.elevationM === 'number');
    setVertices(loadedVertices);
    setWaypoints(
      Array.isArray(rec.waypoints)
        ? rec.waypoints.map((w) => ({ ...w, type: mapTrailWaypointType(w.type, w.name) }))
        : []
    );
    setRouteTitle(rec.title);
    setRouteDescription(rec.description || '');
    if (rec.region === 'Miền Bắc' || rec.region === 'Miền Trung' || rec.region === 'Miền Nam') {
      setRouteRegion(rec.region);
    }
    if (rec.province) setRouteProvince(rec.province);
    setBaseTrailId(rec.baseTrailId || '');
    setSaveVisibility(rec.visibility || 'public');
    const ownerIdRaw =
      typeof rec.creatorId === 'object' && rec.creatorId
        ? String(rec.creatorId._id || rec.creatorId.id || '')
        : String(rec.creatorId || '');
    const isOwner = Boolean(
      libraryTab === 'mine' ||
      rec.isLocalOnly ||
      (currentUserId && ownerIdRaw && ownerIdRaw === currentUserId)
    );
    setLoadedRouteMeta({
      id: rec._id || rec.id,
      shareSlug: rec.shareSlug,
      isOwner,
      creatorId: ownerIdRaw || undefined,
      isLocalOnly: rec.isLocalOnly,
    });
    setElevationSource(hasEle ? (rec.isLocalOnly ? 'interpolated' : 'server-dem') : 'none');
    setHoverIdx(null);
    setSelectedPin(null);
    setRepositioningPin(false);
    setFitBoundsToken((n) => n + 1);
    setIsLibraryOpen(false);
    onShowToast?.(
      hasEle
        ? `Đã mở cung "${rec.title}" kèm mặt cắt cao độ.`
        : `Đã mở cung "${rec.title}". Bấm "Đo cao độ địa hình" để cập nhật độ dốc.`,
      'success'
    );
  };

  const handleDeleteSavedRoute = async (rec: SavedCustomRouteRecord) => {
    const recKey = rec._id || rec.id;
    if (deletingRouteId) return;

    if (!rec.isLocalOnly && currentUser) {
      setDeletingRouteId(recKey);
      try {
        const res = await fetch(`/api/custom-routes/${encodeURIComponent(recKey)}`, {
          method: 'DELETE',
          headers: getApiHeaders(),
        });
        if (!res.ok && res.status !== 404) {
          const json = (await res.json().catch(() => null)) as { message?: string } | null;
          onShowToastRef.current?.(
            json?.message || 'Không thể xóa cung đường trên máy chủ lúc này.',
            'error'
          );
          setDeletingRouteId(null);
          setConfirmDeleteRouteId(null);
          return;
        }
      } catch {
        onShowToastRef.current?.(
          'Mất kết nối máy chủ — chưa xóa được cung đường khỏi tài khoản.',
          'error'
        );
        setDeletingRouteId(null);
        setConfirmDeleteRouteId(null);
        return;
      } finally {
        if (isMountedRef.current) setDeletingRouteId(null);
      }
    }

    const nextLocal = loadLocalSavedRoutes().filter((r) => r.id !== rec.id && r.shareSlug !== rec.shareSlug);
    saveLocalSavedRoutes(nextLocal);
    setMyRoutes((prev) => prev.filter((r) => r.id !== rec.id && r.shareSlug !== rec.shareSlug));
    setConfirmDeleteRouteId(null);
    setLoadedRouteMeta((prev) =>
      prev && (prev.id === recKey || prev.id === rec.id || prev.shareSlug === rec.shareSlug)
        ? null
        : prev
    );
    onShowToastRef.current?.(`Đã xóa cung "${rec.title}".`, 'info');
  };

  const handleToggleLikePublic = async (rec: SavedCustomRouteRecord) => {
    if (!currentUser) {
      window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
      onShowToast?.('Đăng nhập để thích cung đường cộng đồng.', 'info');
      return;
    }
    try {
      const res = await fetch(`/api/custom-routes/${encodeURIComponent(rec._id || rec.id)}/like`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({}),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        liked?: boolean;
        likesCount?: number;
        data?: { liked?: boolean; likesCount?: number };
      } | null;
      if (res.ok && json?.success) {
        const liked = Boolean(json.liked ?? json.data?.liked);
        const likesCount = Number(json.likesCount ?? json.data?.likesCount ?? rec.likesCount ?? 0);
        setPublicRoutes((prev) =>
          prev.map((item) => (item.id === rec.id ? { ...item, isLiked: liked, likesCount } : item))
        );
      }
    } catch {
      onShowToast?.('Không thể cập nhật lượt thích lúc này.', 'error');
    }
  };

  // Action: Analyze with LOST AI
  const handleAnalyzeWithAi = () => {
    if (vertices.length < 2) {
      onShowToast?.('Hãy chấm điểm hoặc mở cung đường trước khi gửi sang LOST AI.', 'error');
      return;
    }
    const wpSummary =
      waypoints.length > 0
        ? ` Các mốc chính: ${waypoints.slice(0, 5).map((w) => w.name).join(', ')}.`
        : '';
    const prompt = `Phân tích an toàn & thể lực cho cung tự vẽ "${routeTitle}" (${routeProvince}, ${routeRegion}): cự ly ${metrics.distanceKm} km, leo tích lũy +${metrics.elevationGainM}m / hạ -${metrics.elevationLossM}m, cao độ tối đa ${metrics.maxAltitudeM}m, dốc cực đại ${metrics.maxSlopePercent}% (${metrics.slopeBuckets.steepPercent}% đoạn dốc >20%), ước tính thời gian Naismith ${metrics.naismithLangmuirHours}h / Tobler ${metrics.toblerHours}h (balo ${packWeightKg}kg), nước dự kiến ${metrics.waterLiters}L.${wpSummary} Hãy đánh giá rủi ro địa hình, lịch trình chia chặng và trang bị bắt buộc.`;

    try {
      sessionStorage.setItem(
        AI_PENDING_PROMPT_KEY,
        JSON.stringify({ prompt, trailId: baseTrailId || undefined, ts: Date.now() })
      );
    } catch {
      // ignore sessionStorage error
    }
    window.dispatchEvent(
      new CustomEvent('lost:open-ai-assistant', {
        detail: { prompt, trailId: baseTrailId || undefined },
      })
    );
    onShowToast?.('Đã chuyển thông số cung tự vẽ sang Trợ lý LOST AI.', 'success');
  };

  // Action: Send Draft to TrailContributionWizard (#contribute)
  const handleSendToContribute = () => {
    if (vertices.length < 2) {
      onShowToast?.('Cần chấm tối thiểu 2 điểm tọa độ trước khi gửi đóng góp cung mới.', 'error');
      return;
    }
    const startPt = vertices[0];
    const endPt = vertices[vertices.length - 1];
    const durationDays =
      metrics.recommendedHours >= 18 || metrics.distanceKm >= 32
        ? 3
        : metrics.recommendedHours >= 10 || metrics.distanceKm >= 18
          ? 2
          : 1;
    const durationHoursNote =
      durationDays >= 3
        ? '3 ngày 2 đêm'
        : durationDays === 2
          ? '2 ngày 1 đêm'
          : metrics.recommendedHours <= 5
            ? 'Nửa ngày'
            : '1 ngày';

    const draft = {
      name: routeTitle.trim() || 'Cung đường đóng góp từ bản đồ vẽ tuyến',
      description:
        routeDescription.trim() ||
        `Tuyến trekking tự thiết kế tại ${routeProvince}: cự ly ${metrics.distanceKm} km, độ cao leo tích lũy +${metrics.elevationGainM}m, cao độ đỉnh ${metrics.maxAltitudeM}m.`,
      region: routeRegion,
      province: routeProvince,
      distanceKm: Math.max(1, Math.round(metrics.distanceKm * 10) / 10),
      elevationGainM: Math.max(50, metrics.elevationGainM),
      maxAltitudeM: Math.max(100, metrics.maxAltitudeM),
      difficultyLevel: metrics.estimatedDifficulty,
      durationDays,
      durationHoursNote,
      startLat: startPt.lat,
      startLng: startPt.lng,
      endLat: endPt.lat,
      endLng: endPt.lng,
      gpxTrack: vertices.map((v) => [v.lat, v.lng] as [number, number]),
      waypoints: waypoints.map((w) => ({
        id: w.id,
        name: w.name,
        type: mapPlannerToTrailWaypointType(w.type),
        description: w.note || WAYPOINT_TYPE_META[w.type].label,
        elevationM: w.elevationM,
        lat: w.lat,
        lng: w.lng,
      })),
      createdAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(DRAFT_CONTRIBUTION_KEY, JSON.stringify(draft));
    } catch {
      // ignore storage restrictions
    }

    onShowToast?.('Đã lưu bản nháp cung đường — đang mở biểu mẫu đóng góp cung mới.', 'success');
    if (onOpenContribute) {
      onOpenContribute();
    } else {
      window.location.hash = '#contribute';
    }
  };

  // Escape key closes topmost Save Modal or Library Drawer (LIFO guarded against ExpeditionShareCardModal & IME)
  useEffect(() => {
    if (!isSaveModalOpen && !isLibraryOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (shareCardSnapshot) return;
        if (isSaveModalOpen) {
          if (!isTopmostFocusTrap(saveDialogRef.current)) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          if (!savingRoute) setIsSaveModalOpen(false);
        } else if (isLibraryOpen) {
          if (!isTopmostFocusTrap(libraryDrawerRef.current)) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          setIsLibraryOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSaveModalOpen, isLibraryOpen, shareCardSnapshot, savingRoute]);

  // =========================================================================
  // PURE-SVG SLOPE-COLORED ELEVATION PROFILE GEOMETRY
  // =========================================================================
  const profileSvg = useMemo(() => {
    const pts = metrics.profile;
    const W = 760;
    const H = 220;
    const padL = 48;
    const padR = 18;
    const padT = 18;
    const padB = 30;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    if (pts.length < 2) {
      return { W, H, padL, padR, padT, padB, plotW, plotH, segments: [], areaPath: '', yTicks: [], xTicks: [], coords: [] };
    }

    const totalKm = Math.max(0.05, pts[pts.length - 1].distanceKm);
    const minEleRaw = metrics.minAltitudeM;
    const maxEleRaw = metrics.maxAltitudeM;
    const span = Math.max(60, maxEleRaw - minEleRaw);
    const minEle = Math.max(0, Math.floor((minEleRaw - span * 0.1) / 20) * 20);
    const maxEle = Math.ceil((maxEleRaw + span * 0.14) / 20) * 20;
    const eleRange = Math.max(20, maxEle - minEle);

    const toX = (distKm: number) => padL + (distKm / totalKm) * plotW;
    const toY = (eleM: number) => padT + ((maxEle - eleM) / eleRange) * plotH;

    const coords = pts.map((p) => ({
      ...p,
      x: toX(p.distanceKm),
      y: toY(p.elevationM),
    }));

    const segments = coords.slice(1).map((curr, idx) => {
      const prev = coords[idx];
      const absSlope = Math.abs(curr.slopePercent);
      const color =
        absSlope > 20
          ? 'var(--color-error)'
          : absSlope >= 12
            ? 'var(--color-sun)'
            : absSlope >= 5
              ? 'var(--color-sky)'
              : 'var(--color-primary)';
      return {
        key: idx,
        x1: prev.x,
        y1: prev.y,
        x2: curr.x,
        y2: curr.y,
        color,
      };
    });

    const baseLineY = padT + plotH;
    const areaPath = [
      `M ${coords[0].x.toFixed(1)} ${baseLineY.toFixed(1)}`,
      ...coords.map((c) => `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`),
      `L ${coords[coords.length - 1].x.toFixed(1)} ${baseLineY.toFixed(1)}`,
      'Z',
    ].join(' ');

    const yTicks = [0, 0.33, 0.66, 1].map((t) => {
      const val = Math.round(minEle + eleRange * t);
      return { val, y: toY(val) };
    });

    const xTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const val = Math.round(totalKm * t * 10) / 10;
      return { val, x: toX(val) };
    });

    return { W, H, padL, padR, padT, padB, plotW, plotH, segments, areaPath, yTicks, xTicks, coords };
  }, [metrics.profile, metrics.minAltitudeM, metrics.maxAltitudeM]);

  const handleProfileScrub = (clientX: number, rect: DOMRect) => {
    if (profileSvg.coords.length < 2 || rect.width <= 0) return;
    const relX = ((clientX - rect.left) / rect.width) * profileSvg.W;
    let bestIdx = 0;
    let bestDiff = Infinity;
    profileSvg.coords.forEach((c, idx) => {
      const diff = Math.abs(c.x - relX);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = idx;
      }
    });
    setHoverIdx(bestIdx);
  };

  const hoveredPoint =
    hoverIdx !== null && profileSvg.coords[hoverIdx] ? profileSvg.coords[hoverIdx] : null;

  const polylinePositions = useMemo(
    () => vertices.map((v) => [v.lat, v.lng] as [number, number]),
    [vertices]
  );

  // Downsample interactive vertex pins if GPX has > 45 points so canvas stays crisp (keeps endpoints + every Nth)
  const visibleVertices = useMemo(() => {
    if (vertices.length <= 45) {
      return vertices.map((v, idx) => ({ vertex: v, idx }));
    }
    const stride = Math.ceil(vertices.length / 36);
    const out: Array<{ vertex: RouteVertex; idx: number }> = [];
    for (let i = 0; i < vertices.length; i += stride) {
      out.push({ vertex: vertices[i], idx: i });
    }
    if (out[out.length - 1]?.idx !== vertices.length - 1) {
      out.push({ vertex: vertices[vertices.length - 1], idx: vertices.length - 1 });
    }
    return out;
  }, [vertices]);

  const plannerInitialCenter = useMemo<[number, number]>(
    () => (initialSeed.vertices[0] ? [initialSeed.vertices[0].lat, initialSeed.vertices[0].lng] : [22.3364, 103.8438]),
    [initialSeed.vertices]
  );

  const plannerBounds = useMemo(
    () => (fitBoundsToken > 0 ? computeRouteBounds(vertices) : null),
    [fitBoundsToken, vertices]
  );

  const plannerFlyTo = useMemo(() => {
    if (fitBoundsToken === 0 || plannerBounds || vertices.length === 0) return null;
    const first = vertices[0];
    if (!Number.isFinite(first.lat) || !Number.isFinite(first.lng)) return null;
    return {
      lat: first.lat,
      lng: first.lng,
      zoom: 12.5,
      key: fitBoundsToken,
    };
  }, [fitBoundsToken, plannerBounds, vertices]);

  const plannerPolylines = useMemo<LostMapPolylineItem[]>(() => {
    if (polylinePositions.length < 2) return [];
    const profileCoords = profileSvg.coords;
    return [
      {
        id: 'planner-main-route',
        coords: polylinePositions,
        color: 'primary',
        width: 4,
        opacity: 0.92,
        interactive: profileCoords.length >= 2,
        onHover: (lat, lng) => {
          if (profileCoords.length < 2) return;
          let bestIdx = 0;
          let bestDistSq = Infinity;
          for (let i = 0; i < profileCoords.length; i++) {
            const dLat = profileCoords[i].lat - lat;
            const dLng = profileCoords[i].lng - lng;
            const dSq = dLat * dLat + dLng * dLng;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              bestIdx = i;
            }
          }
          setHoverIdx(bestIdx);
        },
        onHoverOut: () => setHoverIdx(null),
      },
    ];
  }, [polylinePositions, profileSvg.coords]);

  const plannerMarkers = useMemo<LostMapMarkerItem[]>(() => {
    const items: LostMapMarkerItem[] = [];

    for (const { vertex, idx } of visibleVertices) {
      const isStart = idx === 0;
      const isEnd = idx === vertices.length - 1 && vertices.length > 1;
      const isSelected = selectedPin?.kind === 'vertex' && selectedPin.idx === idx;
      items.push({
        id: `vtx-${idx}`,
        lat: vertex.lat,
        lng: vertex.lng,
        label: isStart ? 'Điểm xuất phát' : isEnd ? 'Điểm kết thúc' : `Điểm #${idx + 1}`,
        sublabel: `${vertex.lat.toFixed(5)}, ${vertex.lng.toFixed(5)}${
          typeof vertex.elevationM === 'number' ? ` · ${Math.round(vertex.elevationM)}m` : ''
        }`,
        color: isStart ? 'primary' : isEnd ? 'danger' : 'muted',
        size: isStart || isEnd ? 'md' : 'sm',
        badge: isStart ? 'XP' : isEnd ? 'KT' : undefined,
        active: isSelected,
        onClick: () => {
          setSelectedPin({ kind: 'vertex', idx });
          setRepositioningPin(false);
        },
      });
    }

    for (const wp of waypoints) {
      const meta = WAYPOINT_TYPE_META[wp.type] || WAYPOINT_TYPE_META.viewpoint;
      const isSelected = selectedPin?.kind === 'waypoint' && selectedPin.id === wp.id;
      items.push({
        id: `wpt-${wp.id}`,
        lat: wp.lat,
        lng: wp.lng,
        label: wp.name,
        sublabel: `${meta.shortLabel}${typeof wp.elevationM === 'number' ? ` · ${wp.elevationM}m` : ''}`,
        color: mapWaypointToMarkerColor(wp.type),
        size: 'lg',
        badge: meta.shortCode,
        active: isSelected,
        onClick: () => {
          setSelectedPin({ kind: 'waypoint', id: wp.id });
          setRepositioningPin(false);
        },
      });
    }

    if (hoveredPoint) {
      items.push({
        id: 'planner-hover-scrub',
        lat: hoveredPoint.lat,
        lng: hoveredPoint.lng,
        label: `${hoveredPoint.distanceKm.toFixed(2)} km · ${hoveredPoint.elevationM}m`,
        sublabel: `Độ dốc ${hoveredPoint.slopePercent > 0 ? '+' : ''}${hoveredPoint.slopePercent}%`,
        color: 'warn',
        size: 'md',
        active: true,
      });
    }

    return items;
  }, [visibleVertices, vertices.length, waypoints, selectedPin, hoveredPoint]);

  const selectedPinDetail = useMemo(() => {
    if (!selectedPin) return null;
    if (selectedPin.kind === 'vertex') {
      const v = vertices[selectedPin.idx];
      if (!v) return null;
      return {
        title:
          selectedPin.idx === 0
            ? 'Điểm xuất phát (#1)'
            : selectedPin.idx === vertices.length - 1 && vertices.length > 1
              ? `Điểm kết thúc (#${selectedPin.idx + 1})`
              : `Điểm đường đi #${selectedPin.idx + 1}`,
        coords: `${v.lat.toFixed(5)}, ${v.lng.toFixed(5)}`,
        elevation: typeof v.elevationM === 'number' ? `${Math.round(v.elevationM)}m` : null,
      };
    }
    const wp = waypoints.find((w) => w.id === selectedPin.id);
    if (!wp) return null;
    return {
      title: wp.name,
      coords: `${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)}`,
      elevation: typeof wp.elevationM === 'number' ? `${wp.elevationM}m` : null,
    };
  }, [selectedPin, vertices, waypoints]);

  const handleDeleteSelectedPin = () => {
    if (!selectedPin) return;
    cancelPendingDem();
    pushUndoSnapshot();
    if (selectedPin.kind === 'vertex') {
      const targetIdx = selectedPin.idx;
      setVertices((prev) => prev.filter((_, i) => i !== targetIdx));
      setHoverIdx(null);
    } else {
      const targetId = selectedPin.id;
      setWaypoints((prev) => prev.filter((wp) => wp.id !== targetId));
    }
    setSelectedPin(null);
    setRepositioningPin(false);
  };

  return (
    <section className="hub-container page-view-slide" aria-label="Tự vẽ cung đường và đo độ dốc GPX">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div>
          <div className="section-eyebrow">Bản đồ vẽ tuyến GPX · Địa hình DEM</div>
          <h1
            className="font-editorial"
            style={{
              fontSize: 'clamp(1.65rem, 3.2vw, 2.35rem)',
              color: 'var(--color-text-main)',
              lineHeight: 1.15,
              marginBottom: 6,
            }}
          >
            Tự vẽ cung đường và đo độ dốc
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', maxWidth: 700, lineHeight: 1.55 }}>
            Chạm lên bản đồ để phác thảo đường đi, cắm mốc lán nghỉ, suối nước hay đỉnh dốc. Hệ thống sẽ đo cao độ địa hình thực, tính giờ đi dự kiến và xuất tệp GPX 1.1 mang theo vào rừng.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={handleOpenLibrary}>
            <IconFolderSvg size={15} />
            Tuyến đã lưu
          </button>
          {onBack && (
            <button type="button" className="btn btn-outline" onClick={onBack}>
              <IconArrowLeft size={16} />
              Quay lại
            </button>
          )}
        </div>
      </div>

      {/* Top Route Controls Toolbar */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="hub-grid-3" style={{ gap: 12 }}>
          <div>
            <label className="form-label" htmlFor="planner-route-title" style={{ display: 'block', marginBottom: 4 }}>
              Tên cung đường
            </label>
            <input
              id="planner-route-title"
              type="text"
              value={routeTitle}
              onChange={(e) => setRouteTitle(e.target.value)}
              placeholder="VD: Sống lưng khủng long Tà Xùa mở rộng"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 4,
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-bg-main)',
                color: 'var(--color-text-main)',
                fontSize: '0.86rem',
              }}
            />
          </div>

          <div>
            <label className="form-label" htmlFor="planner-template-select" style={{ display: 'block', marginBottom: 4 }}>
              Lấy khung từ {trails.length} cung có sẵn
            </label>
            <select
              id="planner-template-select"
              value={baseTrailId}
              onChange={(e) => handleLoadTrailTemplate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 4,
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-surface-elevated)',
                color: 'var(--color-text-main)',
                fontSize: '0.84rem',
              }}
            >
              <option value="">-- Chọn một cung có sẵn để chỉnh lại --</option>
              {trails.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name} ({tr.distanceKm}km · {tr.maxAltitudeM}m)
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx,application/gpx+xml,text/xml"
              onChange={handleImportGpxFile}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, fontSize: '0.8rem', padding: '8px 10px' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <IconUploadSvg size={15} />
                Mở tệp .GPX
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, fontSize: '0.8rem', padding: '8px 10px' }}
                disabled={demLoading || vertices.length < 2}
                onClick={handleFetchRealDem}
              >
                <IconMountain size={15} />
                {demLoading ? 'Đang đo cao độ...' : 'Đo cao độ địa hình'}
              </button>
            </div>
          </div>
        </div>

        {/* Drawing Mode, Waypoint Type & Map Actions Row */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            paddingTop: 10,
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className={clickMode === 'vertex' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ padding: '6px 11px', fontSize: '0.78rem' }}
              onClick={() => setClickMode('vertex')}
            >
              <IconPlus size={14} />
              Chấm đường đi ({vertices.length})
            </button>
            <button
              type="button"
              className={clickMode === 'waypoint' ? 'btn btn-earth' : 'btn btn-secondary'}
              style={{ padding: '6px 11px', fontSize: '0.78rem' }}
              onClick={() => setClickMode('waypoint')}
            >
              <IconMapPin size={14} />
              Cắm mốc ({waypoints.length})
            </button>

            {clickMode === 'waypoint' && (
              <div style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                {PRIMARY_WAYPOINT_TAGS.map((wt) => {
                  const meta = WAYPOINT_TYPE_META[wt];
                  const active = activeWaypointType === wt;
                  return (
                    <button
                      key={wt}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setActiveWaypointType(wt)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: '0.73rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: active ? `1px solid ${meta.colorVar}` : '1px solid var(--color-border-strong)',
                        background: active
                          ? `color-mix(in srgb, ${meta.colorVar} 16%, var(--color-bg-card))`
                          : 'var(--color-surface-elevated)',
                        color: active ? meta.textColorVar : 'var(--color-text-muted)',
                      }}
                    >
                      <WaypointTypeIcon type={wt} size={12} color={active ? meta.textColorVar : meta.colorVar} />
                      <span>{meta.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            {/* Tile Layer Toggle */}
            <div style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginRight: 4 }}>
              <IconLayersSvg size={14} />
              {FREE_BASEMAP_ORDER.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={tileKey === key ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ padding: '5px 9px', fontSize: '0.74rem' }}
                  onClick={() => setTileKey(key)}
                >
                  {FREE_BASEMAPS[key].shortLabel}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '5px 9px', fontSize: '0.76rem' }}
              disabled={undoStack.length === 0}
              onClick={handleUndo}
              title="Hoàn tác thao tác gần nhất"
            >
              <IconUndoSvg size={14} />
              Hoàn tác
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '5px 9px', fontSize: '0.76rem' }}
              disabled={vertices.length < 2}
              onClick={handleReverseRoute}
              title="Đảo chiều đi và tính lại độ dốc, leo/hạ cùng bảng chia chặng"
            >
              <IconSwapSvg size={14} />
              Đảo chiều đi
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '5px 9px', fontSize: '0.76rem' }}
              disabled={vertices.length === 0}
              onClick={() => setFitBoundsToken((n) => n + 1)}
              title="Căn khung toàn tuyến"
            >
              <IconCompass size={14} />
              Căn khung
            </button>
            <button
              type="button"
              className="btn btn-outline"
              style={{ padding: '5px 9px', fontSize: '0.76rem', color: 'var(--color-error-text, var(--color-error))' }}
              disabled={vertices.length === 0 && waypoints.length === 0}
              onClick={handleClearRoute}
            >
              <IconTrash size={14} />
              Xóa
            </button>
          </div>
        </div>
      </div>

      {/* Native GPU MapLibre Vector Map Canvas */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: 'hidden',
          marginBottom: 16,
          position: 'relative',
          height: 'clamp(360px, 52vh, 560px)',
        }}
      >
        <LostVectorMap
          center={plannerInitialCenter}
          zoom={10.5}
          basemap={tileKey}
          polylines={plannerPolylines}
          markers={plannerMarkers}
          fitBounds={plannerBounds}
          fitBoundsKey={fitBoundsToken}
          flyTo={plannerFlyTo}
          onMapClick={handleMapClick}
        >
          {/* Selected Marker Quick Edit HUD */}
          {selectedPinDetail && (
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                zIndex: 'var(--z-map-hud, 400)',
                maxWidth: 'min(340px, calc(100% - 24px))',
              }}
            >
              <div
                className="cyber-dock-bar"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: '9px 11px',
                  fontSize: '0.76rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ color: 'var(--color-text-main)', display: 'block' }}>{selectedPinDetail.title}</strong>
                    <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {selectedPinDetail.coords}
                      {selectedPinDetail.elevation ? ` · ${selectedPinDetail.elevation}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ padding: '2px 5px' }}
                    aria-label="Đóng bảng chọn điểm"
                    onClick={() => {
                      setSelectedPin(null);
                      setRepositioningPin(false);
                    }}
                  >
                    <IconX size={13} />
                  </button>
                </div>
                {repositioningPin && (
                  <div style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.73rem' }}>
                    Chạm vào vị trí mới trên bản đồ để dời điểm này...
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={repositioningPin ? 'btn btn-primary' : 'btn btn-secondary'}
                    style={{ padding: '4px 9px', fontSize: '0.73rem' }}
                    onClick={() => setRepositioningPin((v) => !v)}
                  >
                    <IconMapPin size={12} />
                    {repositioningPin ? 'Đang chọn vị trí...' : 'Dời vị trí'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ padding: '4px 9px', fontSize: '0.73rem', color: 'var(--color-error-text, var(--color-error))' }}
                    onClick={handleDeleteSelectedPin}
                  >
                    <IconTrash size={12} />
                    Xóa điểm này
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Empty Canvas Overlay Tip */}
          {vertices.length === 0 && (
            <div
              style={{
                position: 'absolute',
                bottom: 34,
                left: 14,
                right: 14,
                zIndex: 'var(--z-map-hud, 400)',
                pointerEvents: 'none',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <div
                className="cyber-dock-bar"
                style={{
                  pointerEvents: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  fontSize: '0.8rem',
                }}
              >
                <span>Chạm lên bản đồ để bắt đầu vẽ tuyến, hoặc mở nhanh:</span>
                {trails.slice(0, 3).map((tr) => (
                  <button
                    key={tr.id}
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                    onClick={() => handleLoadTrailTemplate(tr.id)}
                  >
                    {tr.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </LostVectorMap>
      </div>

      {/* Real-Time Telemetry Bar */}
      <div className="editorial-stat-strip" style={{ marginBottom: 16 }}>
        <div className="editorial-stat-cell">
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>Cự ly dự kiến</span>
          <strong style={{ fontSize: '1.22rem', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {metrics.distanceKm.toFixed(2)} km
          </strong>
          <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>{vertices.length} điểm trên tuyến</span>
        </div>
        <div className="editorial-stat-cell">
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>Leo / hạ tích lũy</span>
          <strong style={{ fontSize: '1.15rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
            +{metrics.elevationGainM}m / -{metrics.elevationLossM}m
          </strong>
          <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            Thấp nhất {metrics.minAltitudeM}m → Cao nhất {metrics.maxAltitudeM}m
          </span>
        </div>
        <div className="editorial-stat-cell">
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>Độ dốc gắt nhất</span>
          <strong
            style={{
              fontSize: '1.22rem',
              color:
                metrics.maxSlopePercent > 20
                  ? 'var(--color-error-text, var(--color-error))'
                  : metrics.maxSlopePercent >= 12
                    ? 'var(--color-sun)'
                    : metrics.maxSlopePercent >= 5
                      ? 'var(--color-sky)'
                      : 'var(--color-primary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {metrics.maxSlopePercent}%
          </strong>
          <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            Trung bình {metrics.avgSlopePercent}%
          </span>
        </div>
        <div className="editorial-stat-cell">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
            <IconClock size={12} />
            Thời gian dự kiến
          </span>
          <strong style={{ fontSize: '1.18rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
            {formatDurationHoursVi(metrics.recommendedHours)}
          </strong>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            Naismith {metrics.naismithLangmuirHours}h · Tobler {metrics.toblerHours}h
          </span>
        </div>
        <div className="editorial-stat-cell">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: 'var(--color-sky)', textTransform: 'uppercase', fontWeight: 700 }}>
            <IconDroplet size={12} />
            Nước và năng lượng
          </span>
          <strong style={{ fontSize: '1.18rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
            {metrics.waterLiters} L + {metrics.oresolPackets} Oresol
          </strong>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            <IconFlame size={11} />
            ~{metrics.caloriesKcal.toLocaleString('vi-VN')} kcal · Cấp {metrics.estimatedDifficulty}/5
          </span>
        </div>
      </div>

      {/* Pure-SVG Slope-Colored Elevation Profile + Pace Controls + Action Bar */}
      <div className="route-planner-split">
        {/* Left: Elevation Profile Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 2 }}>
                Mặt cắt cao độ và độ dốc
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {hoveredPoint
                  ? `Tại mốc ${hoveredPoint.distanceKm.toFixed(2)} km · Cao độ ${hoveredPoint.elevationM} m · Độ dốc ${hoveredPoint.slopePercent > 0 ? '+' : ''}${hoveredPoint.slopePercent}%`
                  : 'Lướt chuột hoặc chạm trên biểu đồ để xem từng đoạn dốc tương ứng trên bản đồ.'}
              </span>
            </div>
            <span
              className={`badge ${elevationSource === 'server-dem' || elevationSource === 'terrarium-dem'
                ? 'badge-success'
                : elevationSource === 'gpx-elevation'
                  ? 'badge-info'
                  : elevationSource === 'interpolated-fallback'
                    ? 'badge-sun'
                    : 'badge-cloud'
                }`}
            >
              {elevationSource === 'server-dem'
                ? 'Cao độ DEM thực tế'
                : elevationSource === 'terrarium-dem'
                  ? 'AWS Terrarium DEM'
                  : elevationSource === 'gpx-elevation'
                    ? 'Cao độ từ tệp GPX'
                    : elevationSource === 'interpolated-fallback'
                      ? 'Ước tính ngoại tuyến'
                      : elevationSource === 'interpolated'
                        ? 'Ước tính sơ bộ'
                        : 'Chưa đo cao độ'}
            </span>
          </div>

          {profileSvg.coords.length >= 2 ? (
            <>
              <svg
                viewBox={`0 0 ${profileSvg.W} ${profileSvg.H}`}
                width="100%"
                role="img"
                aria-label="Biểu đồ cao độ và độ dốc tuyến đường"
                onMouseMove={(e) => handleProfileScrub(e.clientX, e.currentTarget.getBoundingClientRect())}
                onTouchMove={(e) => {
                  const t = e.touches[0];
                  if (t) handleProfileScrub(t.clientX, e.currentTarget.getBoundingClientRect());
                }}
                onMouseLeave={() => setHoverIdx(null)}
                style={{
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                  background: 'var(--color-bg-main)',
                  borderRadius: 4,
                  border: '1px solid var(--color-border)',
                  cursor: 'crosshair',
                  touchAction: 'none',
                }}
              >
                <defs>
                  <linearGradient id={`routeArea-${svgUid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Horizontal Gridlines & Elevation Labels */}
                {profileSvg.yTicks.map((t, i) => (
                  <g key={i}>
                    <line
                      x1={profileSvg.padL}
                      y1={t.y}
                      x2={profileSvg.W - profileSvg.padR}
                      y2={t.y}
                      stroke="var(--color-border)"
                      strokeDasharray="3 4"
                    />
                    <text
                      x={profileSvg.padL - 8}
                      y={t.y + 3.5}
                      textAnchor="end"
                      fill="var(--color-text-dim)"
                      fontSize="10"
                      style={{ fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {t.val}m
                    </text>
                  </g>
                ))}

                {/* Distance Axis Labels */}
                {profileSvg.xTicks.map((t, i) => (
                  <text
                    key={i}
                    x={t.x}
                    y={profileSvg.H - 8}
                    textAnchor={
                      i === 0
                        ? 'start'
                        : i === profileSvg.xTicks.length - 1
                          ? 'end'
                          : 'middle'
                    }
                    fill="var(--color-text-muted)"
                    fontSize="10"
                    style={{ fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {t.val} km
                  </text>
                ))}

                {/* Soft Fill Silhouette */}
                <path d={profileSvg.areaPath} fill={`url(#routeArea-${svgUid})`} />

                {/* Per-Segment Slope-Colored Profile Strokes */}
                {profileSvg.segments.map((seg) => (
                  <line
                    key={seg.key}
                    x1={seg.x1.toFixed(1)}
                    y1={seg.y1.toFixed(1)}
                    x2={seg.x2.toFixed(1)}
                    y2={seg.y2.toFixed(1)}
                    stroke={seg.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                ))}

                {/* Hover Crosshair & Readout Dot */}
                {hoveredPoint && (
                  <g>
                    <line
                      x1={hoveredPoint.x}
                      y1={profileSvg.padT}
                      x2={hoveredPoint.x}
                      y2={profileSvg.H - profileSvg.padB}
                      stroke="var(--color-text-muted)"
                      strokeDasharray="3 3"
                      strokeWidth="1.2"
                    />
                    <circle
                      cx={hoveredPoint.x}
                      cy={hoveredPoint.y}
                      r="5.5"
                      fill="var(--color-bg-card)"
                      stroke="var(--color-earth)"
                      strokeWidth="2.5"
                    />
                  </g>
                )}
              </svg>

              {/* 4-Tier Slope Grade Breakdown Bar (<5% Bằng, 5-12% Dốc vừa, 12-20% Dốc gắt, >20% Đứng) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-dim)' }}>
                    Tỷ lệ độ dốc trên toàn tuyến
                  </span>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    Tổng {slopeBreakdown.totalKm.toFixed(2)} km
                  </span>
                </div>

                <div
                  role="img"
                  aria-label={`Phân tầng độ dốc: Dưới 5% bằng ${slopeBreakdown.flatPct}% (${slopeBreakdown.flatKm} km), 5 đến 12% dốc vừa ${slopeBreakdown.moderatePct}% (${slopeBreakdown.moderateKm} km), 12 đến 20% dốc gắt ${slopeBreakdown.steepPct}% (${slopeBreakdown.steepKm} km), trên 20% đứng ${slopeBreakdown.extremePct}% (${slopeBreakdown.extremeKm} km)`}
                  style={{
                    height: 10,
                    borderRadius: 4,
                    overflow: 'hidden',
                    display: 'flex',
                    background: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {slopeBreakdown.flatPct > 0 && (
                    <div
                      title={`<5% Bằng: ${slopeBreakdown.flatPct}% (${slopeBreakdown.flatKm.toFixed(2)} km)`}
                      style={{ width: `${slopeBreakdown.flatPct}%`, background: 'var(--color-primary)' }}
                    />
                  )}
                  {slopeBreakdown.moderatePct > 0 && (
                    <div
                      title={`5–12% Dốc vừa: ${slopeBreakdown.moderatePct}% (${slopeBreakdown.moderateKm.toFixed(2)} km)`}
                      style={{ width: `${slopeBreakdown.moderatePct}%`, background: 'var(--color-sky)' }}
                    />
                  )}
                  {slopeBreakdown.steepPct > 0 && (
                    <div
                      title={`12–20% Dốc gắt: ${slopeBreakdown.steepPct}% (${slopeBreakdown.steepKm.toFixed(2)} km)`}
                      style={{ width: `${slopeBreakdown.steepPct}%`, background: 'var(--color-sun)' }}
                    />
                  )}
                  {slopeBreakdown.extremePct > 0 && (
                    <div
                      title={`>20% Đứng: ${slopeBreakdown.extremePct}% (${slopeBreakdown.extremeKm.toFixed(2)} km)`}
                      style={{ width: `${slopeBreakdown.extremePct}%`, background: 'var(--color-error)' }}
                    />
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(138px, 100%), 1fr))',
                    gap: 8,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {(
                    [
                      {
                        key: 'flat',
                        label: '<5% Bằng',
                        pct: slopeBreakdown.flatPct,
                        km: slopeBreakdown.flatKm,
                        swatch: 'var(--color-primary)',
                        text: 'var(--color-primary)',
                      },
                      {
                        key: 'moderate',
                        label: '5–12% Dốc vừa',
                        pct: slopeBreakdown.moderatePct,
                        km: slopeBreakdown.moderateKm,
                        swatch: 'var(--color-sky)',
                        text: 'var(--color-sky)',
                      },
                      {
                        key: 'steep',
                        label: '12–20% Dốc gắt',
                        pct: slopeBreakdown.steepPct,
                        km: slopeBreakdown.steepKm,
                        swatch: 'var(--color-sun)',
                        text: 'var(--color-sun)',
                      },
                      {
                        key: 'extreme',
                        label: '>20% Đứng',
                        pct: slopeBreakdown.extremePct,
                        km: slopeBreakdown.extremeKm,
                        swatch: 'var(--color-error)',
                        text: 'var(--color-error-text, var(--color-error))',
                      },
                    ] as const
                  ).map((tier) => (
                    <div
                      key={tier.key}
                      style={{
                        padding: '7px 9px',
                        borderRadius: 4,
                        background: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border)',
                        borderLeft: `3px solid ${tier.swatch}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                        {tier.label}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
                        <strong style={{ fontSize: '0.92rem', fontWeight: 800, color: tier.text }}>
                          {tier.pct}%
                        </strong>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-dim)' }}>
                          {tier.km.toFixed(2)} km
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                borderRadius: 4,
                border: '1px dashed var(--color-border-strong)',
                color: 'var(--color-text-muted)',
                fontSize: '0.86rem',
              }}
            >
              Chấm tối thiểu 2 điểm trên bản đồ hoặc nạp 1 cung mẫu để xem biểu đồ trắc dọc cao độ và độ dốc.
            </div>
          )}

          {/* Adjustable ETA Parameters (Pack Weight & Fitness) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))',
              gap: 14,
              paddingTop: 12,
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Trọng lượng balo (hiệu chỉnh ETA)</span>
                <strong style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>{packWeightKg} kg</strong>
              </div>
              <input
                type="range"
                min={2}
                max={24}
                step={0.5}
                value={packWeightKg}
                aria-label="Trọng lượng balo tính ETA"
                onChange={(e) => setPackWeightKg(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-earth)' }}
              />
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Mức thể lực (Tobler & Naismith)
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {(
                  [
                    { id: 'beginner', label: 'Mới đi' },
                    { id: 'intermediate', label: 'Trung bình' },
                    { id: 'advanced', label: 'Chuyên sâu' },
                  ] as const
                ).map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    className={fitnessLevel === lvl.id ? 'btn btn-primary' : 'btn btn-secondary'}
                    style={{ padding: '5px 6px', fontSize: '0.74rem' }}
                    onClick={() => setFitnessLevel(lvl.id)}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Actions + Waypoints Manager */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Primary Route Actions */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 2 }}>
              Mang tuyến này ra thực địa
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(175px, 100%), 1fr))', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={vertices.length < 2}
                onClick={handleExportGpx}
              >
                <IconDownload size={15} />
                Tải tệp GPX 1.1
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={vertices.length < 2}
                onClick={handleOpenShareCard}
                title="Tạo thẻ ảnh PNG tóm tắt cung đường dùng ngay khi ngoại tuyến"
              >
                <IconImage size={15} />
                Tạo thẻ ảnh PNG
              </button>
              <button
                type="button"
                className="btn btn-earth"
                disabled={vertices.length < 2}
                onClick={() => setIsSaveModalOpen(true)}
              >
                <IconShare size={15} />
                Lưu và chia sẻ
              </button>
              <button
                type="button"
                className="btn btn-sky"
                disabled={vertices.length < 2}
                onClick={handleAnalyzeWithAi}
              >
                <IconBot size={15} />
                Nhờ trợ lý góp ý cung
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={vertices.length < 2}
                onClick={handleOpenLiveGpsForRoute}
                style={{ gridColumn: '1 / -1' }}
              >
                <IconCompass size={15} color="var(--color-on-primary)" />
                Mở GPS dẫn đường theo tuyến này
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={vertices.length < 2}
                onClick={handleSendToContribute}
                style={{ gridColumn: '1 / -1' }}
              >
                <IconSend size={15} />
                Gửi đóng góp lên bản đồ chung
              </button>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconShieldCheck size={14} color="var(--color-primary)" />
              <span>{metrics.difficultyLabel}</span>
            </div>
          </div>

          {/* Named Waypoints List with Inline GIS Type Tags & GPX <sym> Preview */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>
                Các mốc trên đường ({waypoints.length})
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)' }}>
                Chuẩn GPX &lt;sym&gt; · Chạm ghim để dời
              </span>
            </div>

            {waypoints.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
                Chưa có mốc nào. Bấm nút <strong>Cắm mốc</strong> rồi chạm bản đồ để đánh dấu điểm xuất phát, đỉnh núi, suối nước, lán trại hay đoạn nguy hiểm.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {waypoints.map((wp, wpIdx) => {
                  const wpMeta = WAYPOINT_TYPE_META[wp.type] || WAYPOINT_TYPE_META.viewpoint;
                  const tagChoices: RouteWaypointType[] = ALL_WAYPOINT_TAGS;
                  return (
                    <div
                      key={wp.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 7,
                        padding: '8px 10px',
                        borderRadius: 4,
                        background: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border)',
                        borderLeft: `3px solid ${wpMeta.colorVar}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 4,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: `color-mix(in srgb, ${wpMeta.colorVar} 14%, var(--color-bg-card))`,
                            color: wpMeta.textColorVar,
                            flexShrink: 0,
                          }}
                          title={`${wpMeta.label} — GPX <sym>${wpMeta.gpxSym}</sym>`}
                        >
                          <WaypointTypeIcon type={wp.type} size={13} color={wpMeta.textColorVar} />
                        </span>
                        <input
                          type="text"
                          maxLength={100}
                          value={wp.name}
                          aria-label={`Tên mốc ${wpIdx + 1}: ${wp.name}`}
                          onChange={(e) =>
                            setWaypoints((prev) =>
                              prev.map((item) => (item.id === wp.id ? { ...item, name: e.target.value } : item))
                            )
                          }
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '4px 7px',
                            borderRadius: 4,
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface-elevated)',
                            color: 'var(--color-text-main)',
                            fontSize: '0.8rem',
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-outline"
                          aria-label={`Xóa mốc ${wp.name}`}
                          style={{ padding: '4px 6px', color: 'var(--color-error-text, var(--color-error))', flexShrink: 0 }}
                          onClick={() => {
                            pushUndoSnapshot();
                            setWaypoints((prev) => prev.filter((item) => item.id !== wp.id));
                          }}
                        >
                          <IconX size={13} />
                        </button>
                      </div>

                      {/* Inline Editable Waypoint Type Tag Pills */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                        {tagChoices.map((wt) => {
                          const meta = WAYPOINT_TYPE_META[wt];
                          const isSelected = wp.type === wt;
                          return (
                            <button
                              key={wt}
                              type="button"
                              aria-pressed={isSelected}
                              title={`Đặt loại mốc: ${meta.label} (GPX <sym>${meta.gpxSym}</sym>)`}
                              onClick={() => {
                                if (wp.type === wt) return;
                                pushUndoSnapshot();
                                setWaypoints((prev) =>
                                  prev.map((item) => (item.id === wp.id ? { ...item, type: wt } : item))
                                );
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '2px 7px',
                                borderRadius: 4,
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: isSelected
                                  ? `1px solid ${meta.colorVar}`
                                  : '1px solid var(--color-border)',
                                background: isSelected
                                  ? `color-mix(in srgb, ${meta.colorVar} 16%, var(--color-bg-card))`
                                  : 'var(--color-bg-card)',
                                color: isSelected ? meta.textColorVar : 'var(--color-text-muted)',
                              }}
                            >
                              <WaypointTypeIcon
                                type={wt}
                                size={11}
                                color={isSelected ? meta.textColorVar : meta.colorVar}
                              />
                              <span>{meta.shortLabel}</span>
                            </button>
                          );
                        })}
                        <span
                          style={{
                            marginLeft: 'auto',
                            fontSize: '0.66rem',
                            color: 'var(--color-text-dim)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {typeof wp.elevationM === 'number' ? `${wp.elevationM}m · ` : ''}
                          {wpMeta.gpxSym}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Waypoint Leg-Split Table ("Bảng Phân Chặng Theo Mốc") */}
      {legSplits.length > 0 && (
        <div className="card" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 2 }}>
                Chia chặng theo từng mốc
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {legSplits.length} chặng · Tính theo balo {packWeightKg} kg và sức đi{' '}
                {fitnessLevel === 'beginner' ? 'mới đi' : fitnessLevel === 'advanced' ? 'chuyên sâu' : 'trung bình'}
                {waypoints.length === 0
                  ? ' — cắm thêm mốc lán, suối hay đỉnh bằng nút Cắm mốc để chia chi tiết từng chặng.'
                  : '.'}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '7px 12px', fontSize: '0.78rem' }}
              onClick={handleCopyLegSplits}
            >
              <IconCopy size={14} />
              Sao chép bảng chặng
            </button>
          </div>

          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', borderRadius: 4, border: '1px solid var(--color-border)' }}>
            <table
              style={{
                width: '100%',
                minWidth: 640,
                borderCollapse: 'collapse',
                fontSize: '0.8rem',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <thead>
                <tr
                  style={{
                    background: 'var(--color-surface-elevated)',
                    borderBottom: '1px solid var(--color-border-strong)',
                    textAlign: 'left',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <th style={{ padding: '9px 10px' }}>Chặng</th>
                  <th style={{ padding: '9px 10px' }}>Từ mốc → đến mốc</th>
                  <th style={{ padding: '9px 10px', textAlign: 'right' }}>Cự ly</th>
                  <th style={{ padding: '9px 10px', textAlign: 'right' }}>Leo / hạ</th>
                  <th style={{ padding: '9px 10px', textAlign: 'right' }}>Dốc TB</th>
                  <th style={{ padding: '9px 10px', textAlign: 'right' }}>Giờ đi chặng</th>
                  <th style={{ padding: '9px 10px', textAlign: 'right' }}>Tổng giờ tích lũy</th>
                </tr>
              </thead>
              <tbody>
                {legSplits.map((leg) => {
                  const slopeColor =
                    leg.avgSlopePercent > 20
                      ? 'var(--color-error-text, var(--color-error))'
                      : leg.avgSlopePercent >= 12
                        ? 'var(--color-sun)'
                        : leg.avgSlopePercent >= 5
                          ? 'var(--color-sky)'
                          : 'var(--color-primary)';
                  return (
                    <tr
                      key={`${leg.legIndex}-${leg.fromVertexIdx}-${leg.toVertexIdx}`}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        background: 'var(--color-bg-card)',
                      }}
                    >
                      <td style={{ padding: '9px 10px', fontWeight: 700, color: 'var(--color-primary)' }}>
                        #{leg.legIndex}
                      </td>
                      <td style={{ padding: '9px 10px', color: 'var(--color-text-main)', fontWeight: 600 }}>
                        <span>{leg.fromName}</span>
                        <span style={{ color: 'var(--color-text-dim)', margin: '0 6px' }}>→</span>
                        <span>{leg.toName}</span>
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--color-text-main)', fontWeight: 700 }}>
                        {leg.distanceKm.toFixed(2)} km
                        <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--color-text-dim)' }}>
                          Lũy kế {leg.cumulativeDistanceKm.toFixed(2)} km
                        </div>
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--color-text-main)' }}>
                        <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>+{leg.elevationGainM}m</span>
                        {' / '}
                        <span style={{ color: 'var(--color-text-muted)' }}>-{leg.elevationLossM}m</span>
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: slopeColor }}>
                        {leg.avgSlopePercent}%
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--color-text-main)', fontWeight: 700 }}>
                        {formatDurationHoursVi(leg.recommendedHours)}
                        <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--color-text-dim)' }}>
                          {leg.naismithHours}h / {leg.toblerHours}h
                        </div>
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 800, color: 'var(--color-sky)' }}>
                        {formatDurationHoursVi(leg.cumulativeHours)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr
                  style={{
                    background: 'var(--color-surface-elevated)',
                    fontWeight: 800,
                    color: 'var(--color-text-main)',
                  }}
                >
                  <td colSpan={2} style={{ padding: '9px 10px' }}>
                    Tổng cả chuyến ({legSplits.length} chặng)
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--color-primary)' }}>
                    {legSplits[legSplits.length - 1].cumulativeDistanceKm.toFixed(2)} km
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                    +{legSplits.reduce((s, l) => s + l.elevationGainM, 0)}m / -{legSplits.reduce((s, l) => s + l.elevationLossM, 0)}m
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                    {metrics.avgSlopePercent}%
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                    {metrics.naismithLangmuirHours}h / {metrics.toblerHours}h
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--color-sky)' }}>
                    {formatDurationHoursVi(legSplits[legSplits.length - 1].cumulativeHours)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Save & Share Custom Route Modal */}
      {isSaveModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => {
              if (!savingRoute) setIsSaveModalOpen(false);
            }}
          >
            <div
              ref={saveDialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Lưu và chia sẻ cung tự vẽ"
              tabIndex={-1}
              className="modal-content modal-fade-in"
              onClick={(e) => e.stopPropagation()}
              style={{ outline: 'none' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                  Lưu và chia sẻ cung đường
                </h2>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={savingRoute}
                  style={{ padding: '5px 8px' }}
                  onClick={() => setIsSaveModalOpen(false)}
                  aria-label="Đóng"
                >
                  <IconX size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveCustomRoute} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label" htmlFor="save-title" style={{ display: 'block', marginBottom: 4 }}>
                    Tên cung đường
                  </label>
                  <input
                    id="save-title"
                    type="text"
                    required
                    value={routeTitle}
                    onChange={(e) => setRouteTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 4,
                      border: '1px solid var(--color-border-strong)',
                      background: 'var(--color-bg-main)',
                      color: 'var(--color-text-main)',
                    }}
                  />
                </div>

                <div className="hub-grid-2" style={{ gap: 10 }}>
                  <div>
                    <label className="form-label" htmlFor="save-region" style={{ display: 'block', marginBottom: 4 }}>
                      Khu vực
                    </label>
                    <select
                      id="save-region"
                      value={routeRegion}
                      onChange={(e) => setRouteRegion(e.target.value as Region)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 4,
                        border: '1px solid var(--color-border-strong)',
                        background: 'var(--color-surface-elevated)',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      <option value="Miền Bắc">Miền Bắc</option>
                      <option value="Miền Trung">Miền Trung</option>
                      <option value="Miền Nam">Miền Nam</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label" htmlFor="save-province" style={{ display: 'block', marginBottom: 4 }}>
                      Tỉnh / Thành phố
                    </label>
                    <input
                      id="save-province"
                      type="text"
                      value={routeProvince}
                      onChange={(e) => setRouteProvince(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 4,
                        border: '1px solid var(--color-border-strong)',
                        background: 'var(--color-bg-main)',
                        color: 'var(--color-text-main)',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" htmlFor="save-desc" style={{ display: 'block', marginBottom: 4 }}>
                    Ghi chú địa hình & nguồn nước
                  </label>
                  <textarea
                    id="save-desc"
                    rows={3}
                    value={routeDescription}
                    onChange={(e) => setRouteDescription(e.target.value)}
                    placeholder="Ghi chú lối rẽ, tình trạng dốc, điểm lấy nước, vị trí hạ trại..."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 4,
                      border: '1px solid var(--color-border-strong)',
                      background: 'var(--color-bg-main)',
                      color: 'var(--color-text-main)',
                    }}
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="save-visibility" style={{ display: 'block', marginBottom: 4 }}>
                    Chế độ chia sẻ
                  </label>
                  <select
                    id="save-visibility"
                    value={saveVisibility}
                    onChange={(e) => setSaveVisibility(e.target.value as 'private' | 'unlisted' | 'public')}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 4,
                      border: '1px solid var(--color-border-strong)',
                      background: 'var(--color-surface-elevated)',
                      color: 'var(--color-text-main)',
                    }}
                  >
                    <option value="public">Công khai (Hiển thị trong Cộng đồng chia sẻ)</option>
                    <option value="unlisted">Không công khai (Chỉ ai có link mới xem được)</option>
                    <option value="private">Riêng tư (Chỉ mình tôi)</option>
                  </select>
                </div>

                {canUpdateLoadedRoute && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-primary)', margin: 0 }}>
                    Bạn đang chỉnh lại tuyến đã lưu — bấm <strong>Cập nhật tuyến</strong> để lưu đè hoặc chọn <strong>Lưu thành bản mới</strong>.
                  </p>
                )}

                {!currentUser && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    Bạn chưa đăng nhập — tuyến này sẽ được lưu tạm trên trình duyệt để dùng ngoại tuyến.
                  </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={savingRoute}
                    onClick={() => setIsSaveModalOpen(false)}
                  >
                    Hủy
                  </button>
                  {canUpdateLoadedRoute && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={savingRoute}
                      onClick={() => void submitSaveCustomRoute(true)}
                    >
                      {savingRoute ? 'Đang lưu...' : 'Lưu thành bản mới'}
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary" disabled={savingRoute}>
                    {savingRoute
                      ? 'Đang lưu...'
                      : canUpdateLoadedRoute
                        ? 'Cập nhật tuyến'
                        : 'Lưu cung này'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* My Routes & Community Shared Routes Drawer */}
      {isLibraryOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setIsLibraryOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 'var(--z-drawer, 2000)',
              background: 'var(--overlay-bg)',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <div
              ref={libraryDrawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Kho cung tự vẽ và cộng đồng chia sẻ"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 'min(480px, 100vw)',
                height: '100%',
                background: 'var(--color-bg-card)',
                borderLeft: '1px solid var(--color-border-strong)',
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                overflowY: 'auto',
                outline: 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                  Tuyến đã lưu
                </h2>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '5px 8px' }}
                    onClick={() => void refreshLibrary()}
                    aria-label="Làm mới danh sách"
                  >
                    <IconRotateCw size={15} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ padding: '5px 8px' }}
                    onClick={() => setIsLibraryOpen(false)}
                    aria-label="Đóng ngăn kéo"
                  >
                    <IconX size={16} />
                  </button>
                </div>
              </div>

              <div className="editorial-tabs-bar" style={{ marginBottom: 4 }}>
                <button
                  type="button"
                  className={`editorial-tab-btn${libraryTab === 'mine' ? ' active' : ''}`}
                  onClick={() => setLibraryTab('mine')}
                >
                  Của tôi ({myRoutes.length})
                </button>
                <button
                  type="button"
                  className={`editorial-tab-btn${libraryTab === 'public' ? ' active' : ''}`}
                  onClick={() => setLibraryTab('public')}
                >
                  Anh em chia sẻ ({publicRoutes.length})
                </button>
              </div>

              {libraryLoading ? (
                <p style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>Đang tải danh sách tuyến...</p>
              ) : (libraryTab === 'mine' ? myRoutes : publicRoutes).length === 0 ? (
                <div
                  style={{
                    padding: '28px 16px',
                    textAlign: 'center',
                    borderRadius: 4,
                    border: '1px dashed var(--color-border-strong)',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.84rem',
                  }}
                >
                  {libraryTab === 'mine'
                    ? 'Bạn chưa lưu cung nào. Vẽ trên bản đồ rồi bấm "Lưu và chia sẻ" nhé.'
                    : 'Chưa có tuyến công khai nào từ cộng đồng (hoặc máy đang ngoại tuyến).'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(libraryTab === 'mine' ? myRoutes : publicRoutes).map((rec) => (
                    <div
                      key={rec.id || rec.shareSlug}
                      style={{
                        padding: 12,
                        borderRadius: 6,
                        background: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--color-text-main)', display: 'block' }}>
                            {rec.title}
                          </strong>
                          <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                            {rec.province || rec.region || 'Việt Nam'} · {rec.metrics?.distanceKm ?? 0} km · +{rec.metrics?.elevationGainM ?? 0}m · Đỉnh {rec.metrics?.maxAltitudeM ?? 0}m
                          </span>
                        </div>
                        {rec.isLocalOnly && <span className="badge badge-cloud">Ngoại tuyến</span>}
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                          onClick={() => handleLoadSavedRoute(rec)}
                        >
                          Mở lên bản đồ
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                          onClick={() => {
                            const url = `${window.location.origin}/planner?route=${encodeURIComponent(rec.shareSlug)}`;
                            void copyTextSafe(url).then((ok) => {
                              if (!isMountedRef.current) return;
                              if (ok) onShowToastRef.current?.('Đã sao chép liên kết chia sẻ cung.', 'success');
                              else onShowToastRef.current?.('Không thể sao chép liên kết.', 'error');
                            });
                          }}
                        >
                          <IconCopy size={13} />
                          Chép link
                        </button>
                        {libraryTab === 'public' ? (
                          <button
                            type="button"
                            className={rec.isLiked ? 'btn btn-danger' : 'btn btn-outline'}
                            style={{ padding: '5px 10px', fontSize: '0.76rem', fontVariantNumeric: 'tabular-nums' }}
                            onClick={() => void handleToggleLikePublic(rec)}
                          >
                            <IconHeart size={13} />
                            {rec.likesCount ?? 0}
                          </button>
                        ) : confirmDeleteRouteId === (rec._id || rec.id) ? (
                          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-danger"
                              disabled={deletingRouteId === (rec._id || rec.id)}
                              style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                              onClick={() => void handleDeleteSavedRoute(rec)}
                            >
                              {deletingRouteId === (rec._id || rec.id) ? 'Đang xóa...' : 'Xác nhận xóa'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline"
                              disabled={deletingRouteId === (rec._id || rec.id)}
                              style={{ padding: '5px 9px', fontSize: '0.76rem' }}
                              onClick={() => setConfirmDeleteRouteId(null)}
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ padding: '5px 10px', fontSize: '0.76rem', color: 'var(--color-error-text, var(--color-error))' }}
                            onClick={() => setConfirmDeleteRouteId(rec._id || rec.id)}
                          >
                            <IconTrash size={13} />
                            Xóa
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* Offline Canvas PNG Share Card Modal for Custom Planned Route */}
      {shareCardSnapshot && (
        <ExpeditionShareCardModal
          isOpen={true}
          initialData={shareCardSnapshot}
          onClose={() => setShareCardSnapshot(null)}
          onShowToast={onShowToast}
        />
      )}
    </section>
  );
};

export default RoutePlannerView;
