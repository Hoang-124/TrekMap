import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  AdminCockpitSectionId,
  CockpitBeaconPoint,
  CockpitContributionPoint,
  CockpitGpxTrackPoint,
  CockpitIncidentPoint,
  CockpitInspectorSelection,
  CockpitOverdueTimerPoint,
  CockpitTrailPoint,
} from './adminCockpitTypes.js';
import { isTopmostFocusTrap, useFocusTrap } from '../../hooks/useFocusTrap.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import {
  IconAlertTriangle,
  IconCheck,
  IconCheckCircle,
  IconClock,
  IconCompass,
  IconCopy,
  IconDroplet,
  IconEdit,
  IconEye,
  IconMail,
  IconMapPin,
  IconMountain,
  IconPhone,
  IconRadio,
  IconSatellite,
  IconShieldAlert,
  IconShieldCheck,
  IconStar,
  IconTent,
  IconTrash,
  IconUser,
  IconUsers,
  IconX,
} from '../common/SvgIcons.js';

export interface AdminSpatialInspectorProps {
  selection: CockpitInspectorSelection | null;
  isStrictAdmin: boolean;
  publishedTrails?: CockpitTrailPoint[];
  onClose: () => void;
  onEditTrail?: (trailId: string) => void;
  onDeleteTrail?: (trailId: string, name: string) => void;
  onApproveContribution?: (id: string, name: string) => void;
  onRejectContribution?: (id: string, name: string) => void;
  onDeleteContribution?: (id: string, name: string, status: string) => void;
  onInspectContributionModal?: (id: string) => void;
  onResolveIncident?: (id: string) => void;
  onMarkTimerSafe?: (id: string, userName: string, trailName: string) => void;
  onExtendTimer?: (id: string, userName: string, trailName: string) => void;
  onResolveBeacon?: (id: string, displayName: string, trailName: string) => void;
  onNavigateSection?: (section: AdminCockpitSectionId) => void;
}

const ExternalLinkGlyph: React.FC<{ size?: number }> = ({ size = 14 }) => (
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

const CrosshairGlyph: React.FC<{ size?: number }> = ({ size = 13 }) => (
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
    <circle cx="12" cy="12" r="7" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
  </svg>
);

const BatteryGlyph: React.FC<{ size?: number }> = ({ size = 14 }) => (
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
    <rect x="2" y="7" width="16" height="10" rx="2" ry="2" />
    <line x1="22" y1="11" x2="22" y2="13" />
  </svg>
);

const formatCoordDisplay = (lat: number, lng: number): string => {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
};

const formatDateVi = (value?: string): string => {
  if (!value) return 'Chưa rõ thời gian';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const sanitizeTelHref = (raw: string): string => {
  const cleaned = raw.replace(/[^\d+]/g, '');
  return cleaned ? `tel:${cleaned}` : '';
};

const extractPhoneFromText = (raw?: string): string | null => {
  if (!raw) return null;
  const match = raw.match(/(?:\+84|0)[\d\s.-]{8,13}/);
  if (!match) return null;
  const digits = match[0].replace(/[^\d+]/g, '');
  return digits.length >= 9 ? digits : null;
};

const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback
    }
  }
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
};

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const DUPLICATE_PEAK_RADIUS_KM = 2.0;

const findNearestPublishedTrail = (
  startLat?: number,
  startLng?: number,
  publishedTrails?: CockpitTrailPoint[]
): { name: string; distanceKm: number } | null => {
  if (
    typeof startLat !== 'number' ||
    typeof startLng !== 'number' ||
    !Number.isFinite(startLat) ||
    !Number.isFinite(startLng) ||
    (startLat === 0 && startLng === 0) ||
    !Array.isArray(publishedTrails) ||
    publishedTrails.length === 0
  ) {
    return null;
  }

  let closest: { name: string; distanceKm: number } | null = null;
  for (const trail of publishedTrails) {
    if (trail.status && trail.status !== 'approved') continue;
    const tLat = Number(trail.startLat);
    const tLng = Number(trail.startLng);
    if (!Number.isFinite(tLat) || !Number.isFinite(tLng) || (tLat === 0 && tLng === 0)) continue;
    const distKm = haversineKm(startLat, startLng, tLat, tLng);
    if (distKm <= DUPLICATE_PEAK_RADIUS_KM && (!closest || distKm < closest.distanceKm)) {
      closest = { name: trail.name, distanceKm: distKm };
    }
  }
  return closest;
};

interface RealElevationPoint {
  km: number;
  altitudeM: number;
  slopePercent?: number;
}

interface RealElevationProfileData {
  points: RealElevationPoint[];
  minElevationM: number;
  maxElevationM: number;
  totalDistanceKm: number;
  maxSlopePercent: number | null;
  attribution: string;
}

const MAX_ELEVATION_CACHE = 80;
const trailElevationCache = new Map<string, RealElevationProfileData | null>();

const setElevationCache = (key: string, value: RealElevationProfileData | null) => {
  if (trailElevationCache.size >= MAX_ELEVATION_CACHE) {
    const oldest = trailElevationCache.keys().next().value;
    if (oldest !== undefined) trailElevationCache.delete(oldest);
  }
  trailElevationCache.delete(key);
  trailElevationCache.set(key, value);
};

const extractRealGpxElevation = (
  gpxTrack?: CockpitGpxTrackPoint[]
): RealElevationProfileData | null => {
  if (!Array.isArray(gpxTrack) || gpxTrack.length < 2) return null;
  const parsed: Array<{ lat: number; lng: number; ele: number }> = [];

  for (const pt of gpxTrack) {
    if (Array.isArray(pt) && pt.length >= 3) {
      const lat = Number(pt[0]);
      const lng = Number(pt[1]);
      const ele = Number(pt[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(ele)) {
        parsed.push({ lat, lng, ele });
      }
    } else if (pt && !Array.isArray(pt) && typeof pt === 'object') {
      const lat = Number(pt.lat);
      const lng = Number(pt.lng);
      const ele = Number(pt.elevationM ?? pt.ele);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(ele)) {
        parsed.push({ lat, lng, ele });
      }
    }
  }

  if (parsed.length < 2) return null;

  let cumKm = 0;
  let minAlt = Infinity;
  let maxAlt = -Infinity;
  let maxSlope = 0;
  const points: RealElevationPoint[] = [];

  for (let i = 0; i < parsed.length; i += 1) {
    let slopePercent = 0;
    if (i > 0) {
      const segKm = haversineKm(parsed[i - 1].lat, parsed[i - 1].lng, parsed[i].lat, parsed[i].lng);
      cumKm += segKm;
      if (segKm > 0.005) {
        slopePercent = Number((((parsed[i].ele - parsed[i - 1].ele) / (segKm * 1000)) * 100).toFixed(1));
        if (Math.abs(slopePercent) > maxSlope) maxSlope = Math.abs(slopePercent);
      }
    }
    const alt = Math.round(parsed[i].ele);
    if (alt < minAlt) minAlt = alt;
    if (alt > maxAlt) maxAlt = alt;
    points.push({
      km: Number(cumKm.toFixed(2)),
      altitudeM: alt,
      slopePercent,
    });
  }

  return {
    points,
    minElevationM: minAlt,
    maxElevationM: maxAlt,
    totalDistanceKm: Number(cumKm.toFixed(1)),
    maxSlopePercent: maxSlope > 0 ? Number(maxSlope.toFixed(1)) : null,
    attribution: 'Cao độ GPX thực tế từ tệp tuyến',
  };
};

interface RealTopographicProfileProps {
  trailApiId?: string;
  gpxTrack?: CockpitGpxTrackPoint[];
}

const RealTopographicProfile: React.FC<RealTopographicProfileProps> = React.memo(
  ({ trailApiId, gpxTrack }) => {
    const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
    const areaGradId = `inspector-elev-area-${uid}`;
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    const localGpxProfile = useMemo(() => extractRealGpxElevation(gpxTrack), [gpxTrack]);

    const cachedProfile = useMemo(() => {
      if (localGpxProfile || !trailApiId) return undefined;
      return trailElevationCache.has(trailApiId)
        ? (trailElevationCache.get(trailApiId) ?? null)
        : undefined;
    }, [localGpxProfile, trailApiId]);

    const [fetchedState, setFetchedState] = useState<{
      key: string;
      status: 'ready' | 'unavailable';
      data: RealElevationProfileData | null;
    } | null>(null);

    useEffect(() => {
      if (localGpxProfile || !trailApiId || cachedProfile !== undefined) return;

      const controller = new AbortController();

      fetch(`/api/trails/${encodeURIComponent(trailApiId)}/elevation`, {
        headers: getApiHeaders(),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) return null;
          const json = await res.json().catch(() => null);
          const raw = json?.success ? json.data : null;
          if (
            !raw ||
            raw.source === 'interpolated-fallback' ||
            !Array.isArray(raw.points) ||
            raw.points.length < 2
          ) {
            return null;
          }
          const points: RealElevationPoint[] = [];
          let minAlt = Infinity;
          let maxAlt = -Infinity;
          for (const pt of raw.points) {
            const km = Number(pt?.distanceKm);
            const alt = Number(pt?.elevationM);
            if (!Number.isFinite(km) || !Number.isFinite(alt)) continue;
            const roundedAlt = Math.round(alt);
            if (roundedAlt < minAlt) minAlt = roundedAlt;
            if (roundedAlt > maxAlt) maxAlt = roundedAlt;
            points.push({
              km: Number(km.toFixed(2)),
              altitudeM: roundedAlt,
              slopePercent: Number.isFinite(Number(pt?.slopePercent))
                ? Number(Number(pt.slopePercent).toFixed(1))
                : undefined,
            });
          }
          if (points.length < 2) return null;
          const totalDistanceKm =
            Number.isFinite(Number(raw.totalDistanceKm)) && Number(raw.totalDistanceKm) > 0
              ? Number(Number(raw.totalDistanceKm).toFixed(1))
              : points[points.length - 1].km;
          const maxSlopePercent =
            Number.isFinite(Number(raw.maxSlopePercent)) && Number(raw.maxSlopePercent) > 0
              ? Number(Number(raw.maxSlopePercent).toFixed(1))
              : null;
          const result: RealElevationProfileData = {
            points,
            minElevationM: Number.isFinite(minAlt) ? minAlt : Math.round(Number(raw.minElevationM) || 0),
            maxElevationM: Number.isFinite(maxAlt) ? maxAlt : Math.round(Number(raw.maxElevationM) || 0),
            totalDistanceKm,
            maxSlopePercent,
            attribution:
              typeof raw.attribution === 'string' && raw.attribution.trim()
                ? raw.attribution.trim()
                : 'Dữ liệu cao độ DEM thực tế',
          };
          return result;
        })
        .then((profileData) => {
          if (controller.signal.aborted) return;
          setElevationCache(trailApiId, profileData);
          setFetchedState({
            key: trailApiId,
            status: profileData ? 'ready' : 'unavailable',
            data: profileData,
          });
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setFetchedState({ key: trailApiId, status: 'unavailable', data: null });
        });

      return () => {
        controller.abort();
      };
    }, [trailApiId, localGpxProfile, cachedProfile]);

    const activeProfile: RealElevationProfileData | null = localGpxProfile
      ? localGpxProfile
      : cachedProfile !== undefined
        ? cachedProfile
        : fetchedState && fetchedState.key === trailApiId
          ? fetchedState.data
          : null;

    const isLoading =
      !localGpxProfile &&
      Boolean(trailApiId) &&
      cachedProfile === undefined &&
      (!fetchedState || fetchedState.key !== trailApiId);

    const svgWidth = 340;
    const svgHeight = 132;
    const padLeft = 10;
    const padRight = 10;
    const padTop = 24;
    const padBottom = 26;
    const plotW = svgWidth - padLeft - padRight;
    const plotH = svgHeight - padTop - padBottom;

    const geometry = useMemo(() => {
      if (!activeProfile || activeProfile.points.length < 2) return null;
      const pts = activeProfile.points;
      const totalKm = Math.max(0.01, pts[pts.length - 1].km || activeProfile.totalDistanceKm || 1);
      const altRange = Math.max(20, activeProfile.maxElevationM - activeProfile.minElevationM);

      let summitIdx = 0;
      const samples = pts.map((pt, idx) => {
        if (pt.altitudeM > pts[summitIdx].altitudeM) summitIdx = idx;
        const ratio = pts[pts.length - 1].km > 0 ? pt.km / totalKm : idx / (pts.length - 1);
        const x = padLeft + Math.max(0, Math.min(1, ratio)) * plotW;
        const normY = (pt.altitudeM - activeProfile.minElevationM) / altRange;
        const y = padTop + (1 - Math.max(0, Math.min(1, normY))) * plotH;
        return { ...pt, x, y };
      });

      const linePath = samples
        .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
        .join(' ');
      const baselineY = padTop + plotH;
      const areaPath = `${linePath} L ${samples[samples.length - 1].x.toFixed(1)} ${baselineY.toFixed(1)} L ${samples[0].x.toFixed(1)} ${baselineY.toFixed(1)} Z`;

      return {
        samples,
        summit: samples[summitIdx],
        start: samples[0],
        end: samples[samples.length - 1],
        linePath,
        areaPath,
        baselineY,
      };
    }, [activeProfile, plotH, plotW]);

    const handlePointerMove = useCallback(
      (e: React.MouseEvent<SVGSVGElement>) => {
        if (!geometry || geometry.samples.length < 2) return;
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width <= 0) return;
        const relX = ((e.clientX - rect.left) / rect.width) * svgWidth;
        const clamped = Math.max(padLeft, Math.min(padLeft + plotW, relX));
        let closestIdx = 0;
        let closestDist = Infinity;
        for (let i = 0; i < geometry.samples.length; i += 1) {
          const d = Math.abs(geometry.samples[i].x - clamped);
          if (d < closestDist) {
            closestDist = d;
            closestIdx = i;
          }
        }
        setHoverIdx(closestIdx);
      },
      [geometry, plotW]
    );

    const handlePointerLeave = useCallback(() => {
      setHoverIdx(null);
    }, []);

    if (isLoading) {
      return (
        <div className="admin-elev-chart" aria-busy="true">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconMountain size={12} color="var(--color-primary)" />
            <span
              style={{
                fontSize: '0.67rem',
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: 'var(--color-text-dim)',
              }}
            >
              Mặt cắt cao độ thực tế
            </span>
          </div>
          <div
            style={{
              padding: '22px 10px',
              textAlign: 'center',
              fontSize: '0.75rem',
              color: 'var(--color-text-muted)',
            }}
          >
            Đang tải dữ liệu cao độ DEM thực tế...
          </div>
        </div>
      );
    }

    if (!activeProfile || !geometry) {
      return (
        <div className="admin-elev-chart">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconMountain size={12} color="var(--color-text-dim)" />
            <span
              style={{
                fontSize: '0.67rem',
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: 'var(--color-text-dim)',
              }}
            >
              Mặt cắt cao độ thực tế
            </span>
          </div>
          <div
            style={{
              padding: '16px 10px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              alignItems: 'center',
            }}
          >
            <strong style={{ fontSize: '0.78rem', color: 'var(--color-text-main)' }}>
              Chưa có dữ liệu cao độ GPX thực tế
            </strong>
            <span style={{ fontSize: '0.71rem', color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
              Hệ thống không vẽ biểu đồ mô phỏng khi chưa có tracklog GPX hoặc dữ liệu DEM thật.
            </span>
          </div>
        </div>
      );
    }

    const activeSample = hoverIdx !== null ? geometry.samples[hoverIdx] ?? null : null;

    return (
      <div className="admin-elev-chart">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: '0.67rem',
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'var(--color-text-dim)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <IconMountain size={12} color="var(--color-primary)" />
            Mặt cắt cao độ thực tế
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: activeSample ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {activeSample
              ? `${activeSample.km.toFixed(1)} km · ${activeSample.altitudeM.toLocaleString('vi-VN')} m${
                  typeof activeSample.slopePercent === 'number' ? ` (${activeSample.slopePercent}%)` : ''
                }`
              : activeProfile.maxSlopePercent !== null
                ? `Dốc cực đại ${activeProfile.maxSlopePercent}%`
                : `${geometry.samples.length} điểm đo`}
          </span>
        </div>

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          width="100%"
          height={svgHeight}
          role="img"
          aria-label={`Biểu đồ cao độ thực tế, đỉnh ${geometry.summit.altitudeM} mét`}
          onMouseMove={handlePointerMove}
          onMouseLeave={handlePointerLeave}
          style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
        >
          <defs>
            <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {[0, 0.5, 1].map((frac) => {
            const y = padTop + frac * plotH;
            return (
              <line
                key={frac}
                x1={padLeft}
                y1={y}
                x2={padLeft + plotW}
                y2={y}
                stroke="var(--color-border-strong)"
                strokeWidth="0.75"
                strokeDasharray={frac === 1 ? undefined : '2.5 3.5'}
                opacity={frac === 1 ? 0.9 : 0.45}
              />
            );
          })}

          <line
            x1={geometry.summit.x}
            y1={geometry.summit.y}
            x2={geometry.summit.x}
            y2={geometry.baselineY}
            stroke="var(--color-primary)"
            strokeWidth="0.85"
            strokeDasharray="2 3"
            opacity="0.45"
          />

          <path d={geometry.areaPath} fill={`url(#${areaGradId})`} />

          <path
            d={geometry.linePath}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          <circle
            cx={geometry.start.x}
            cy={geometry.start.y}
            r="2.6"
            fill="var(--color-bg-card)"
            stroke="var(--color-text-muted)"
            strokeWidth="1.5"
          />
          <circle
            cx={geometry.end.x}
            cy={geometry.end.y}
            r="2.6"
            fill="var(--color-bg-card)"
            stroke="var(--color-text-muted)"
            strokeWidth="1.5"
          />

          <g transform={`translate(${geometry.summit.x.toFixed(1)}, ${geometry.summit.y.toFixed(1)})`}>
            <circle r="7" fill="none" stroke="var(--color-primary)" strokeWidth="1" opacity="0.45" />
            <polygon
              points="0,-3.8 3.8,0 0,3.8 -3.8,0"
              fill="var(--color-primary)"
              stroke="var(--color-bg-card)"
              strokeWidth="1"
            />
          </g>

          <text
            x={Math.min(svgWidth - 42, Math.max(44, geometry.summit.x))}
            y={Math.max(11, geometry.summit.y - 11)}
            textAnchor="middle"
            fill="var(--color-text-main)"
            fontSize="10"
            fontWeight="700"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {`${geometry.summit.altitudeM.toLocaleString('vi-VN')}m`}
          </text>

          {activeSample && (
            <g>
              <line
                x1={activeSample.x}
                y1={padTop}
                x2={activeSample.x}
                y2={geometry.baselineY}
                stroke="var(--color-text-muted)"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.7"
              />
              <circle
                cx={activeSample.x}
                cy={activeSample.y}
                r="4"
                fill="var(--color-bg-card)"
                stroke="var(--color-primary)"
                strokeWidth="2"
              />
            </g>
          )}

          <text
            x={padLeft}
            y={svgHeight - 6}
            textAnchor="start"
            fill="var(--color-text-dim)"
            fontSize="9.5"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {`${geometry.start.km.toFixed(1)} km · ${geometry.start.altitudeM.toLocaleString('vi-VN')}m`}
          </text>
          <text
            x={Math.min(svgWidth - 72, Math.max(72, geometry.summit.x))}
            y={svgHeight - 6}
            textAnchor="middle"
            fill="var(--color-primary)"
            fontSize="9.5"
            fontWeight="600"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {`Đỉnh ${geometry.summit.km.toFixed(1)} km`}
          </text>
          <text
            x={padLeft + plotW}
            y={svgHeight - 6}
            textAnchor="end"
            fill="var(--color-text-dim)"
            fontSize="9.5"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {`${activeProfile.totalDistanceKm.toFixed(1)} km · ${geometry.end.altitudeM.toLocaleString('vi-VN')}m`}
          </text>
        </svg>

        <span style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)', lineHeight: 1.3 }}>
          {activeProfile.attribution}
        </span>
      </div>
    );
  }
);

RealTopographicProfile.displayName = 'RealTopographicProfile';

interface CoverStripProps {
  coverImage?: string;
  title: string;
  region?: string;
  maxAltitudeM?: number;
  badgeText?: string;
  badgeTone?: 'ok' | 'warn' | 'danger' | 'info';
}

const CoverMediaStrip: React.FC<CoverStripProps> = React.memo(
  ({ coverImage, title, region, maxAltitudeM, badgeText, badgeTone }) => {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const showImage = Boolean(coverImage) && failedUrl !== coverImage;

    const handleImgError = useCallback(() => {
      if (coverImage) setFailedUrl(coverImage);
    }, [coverImage]);

    return (
      <div
        style={{
          position: 'relative',
          height: 142,
          borderRadius: 5,
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
          background: 'color-mix(in srgb, var(--color-primary) 6%, var(--color-surface-elevated))',
          flexShrink: 0,
        }}
      >
        {showImage && coverImage ? (
          <img
            src={coverImage}
            alt={title}
            loading="lazy"
            decoding="async"
            onError={handleImgError}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <svg
            viewBox="0 0 360 142"
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
            style={{ display: 'block' }}
          >
            <path
              d="M0 112 Q 70 86 140 98 T 280 76 T 360 92 L360 142 L0 142 Z"
              fill="var(--color-primary)"
              opacity="0.14"
            />
            <path
              d="M0 94 Q 88 52 174 72 T 360 54"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="1.2"
              opacity="0.35"
            />
            <path
              d="M0 72 Q 112 34 210 56 T 360 36"
              fill="none"
              stroke="var(--color-sky)"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.35"
            />
            <g transform="translate(180, 62)" opacity="0.55">
              <path
                d="M-18 14 L-4 -10 L6 4 L12 -4 L22 14 Z"
                fill="none"
                stroke="var(--color-text-muted)"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        )}

        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            pointerEvents: 'none',
          }}
        >
          {region ? (
            <span
              style={{
                padding: '2px 7px',
                borderRadius: 4,
                fontSize: '0.67rem',
                fontWeight: 700,
                letterSpacing: '0.03em',
                background: 'var(--overlay-bg)',
                color: 'var(--color-on-media)',
              }}
            >
              {region}
            </span>
          ) : (
            <span />
          )}

          {badgeText && (
            <span
              style={{
                padding: '2px 7px',
                borderRadius: 4,
                fontSize: '0.67rem',
                fontWeight: 700,
                background:
                  badgeTone === 'danger'
                    ? 'var(--color-error)'
                    : badgeTone === 'ok'
                      ? 'var(--color-primary)'
                      : 'var(--overlay-bg)',
                color:
                  badgeTone === 'danger'
                    ? 'var(--color-on-danger)'
                    : badgeTone === 'ok'
                      ? 'var(--color-on-primary)'
                      : 'var(--color-on-media)',
              }}
            >
              {badgeText}
            </span>
          )}
        </div>

        {typeof maxAltitudeM === 'number' && maxAltitudeM > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              padding: '3px 8px',
              borderRadius: 4,
              background: 'var(--overlay-bg)',
              color: 'var(--color-on-media)',
              fontSize: '0.72rem',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <IconMountain size={12} color="var(--color-on-media)" />
            {`${Math.round(maxAltitudeM).toLocaleString('vi-VN')} m`}
          </div>
        )}
      </div>
    );
  }
);

CoverMediaStrip.displayName = 'CoverMediaStrip';

interface CapabilityBadgeProps {
  label: string;
  active: boolean;
  tone?: 'ok' | 'warn' | 'info';
  icon: React.ReactNode;
}

const CapabilityBadge: React.FC<CapabilityBadgeProps> = ({ label, active, tone = 'ok', icon }) => {
  const toneClass = active
    ? tone === 'warn'
      ? 'admin-tag admin-tag--warn'
      : tone === 'info'
        ? 'admin-tag admin-tag--info'
        : 'admin-tag admin-tag--ok'
    : 'admin-tag';

  return (
    <span
      className={toneClass}
      style={{
        padding: '4px 8px',
        opacity: active ? 1 : 0.56,
        fontWeight: active ? 600 : 500,
      }}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
};

const getSeverityMeta = (severity: string): { label: string; tagClass: string; dotClass: string } => {
  const norm = (severity || '').toLowerCase();
  if (norm === 'critical' || norm === 'nghiêm trọng' || norm === 'khẩn cấp') {
    return {
      label: 'Khẩn cấp',
      tagClass: 'admin-tag admin-tag--danger',
      dotClass: 'admin-dot admin-dot--danger',
    };
  }
  if (norm === 'high' || norm === 'cao') {
    return {
      label: 'Cao',
      tagClass: 'admin-tag admin-tag--danger',
      dotClass: 'admin-dot admin-dot--danger',
    };
  }
  if (norm === 'medium' || norm === 'moderate' || norm === 'trung bình') {
    return {
      label: 'Trung bình',
      tagClass: 'admin-tag admin-tag--warn',
      dotClass: 'admin-dot admin-dot--warn',
    };
  }
  return {
    label: 'Thấp',
    tagClass: 'admin-tag admin-tag--info',
    dotClass: 'admin-dot admin-dot--info',
  };
};

const getContributionStatusMeta = (status: string): { label: string; tone: 'ok' | 'warn' | 'danger' | 'info' } => {
  const norm = (status || '').toLowerCase();
  if (norm === 'approved') return { label: 'Đã duyệt', tone: 'ok' };
  if (norm === 'rejected') return { label: 'Đã từ chối', tone: 'danger' };
  return { label: 'Chờ duyệt', tone: 'warn' };
};

const getReputationTier = (score: number): { label: string; nextCap: number; percent: number } => {
  if (score >= 1500) {
    return { label: 'Người đi rừng kỳ cựu', nextCap: 2500, percent: Math.min(100, Math.round((score / 2500) * 100)) };
  }
  if (score >= 600) {
    return { label: 'Am hiểu địa hình', nextCap: 1500, percent: Math.min(100, Math.round((score / 1500) * 100)) };
  }
  if (score >= 200) {
    return { label: 'Người dẫn đường', nextCap: 600, percent: Math.min(100, Math.round((score / 600) * 100)) };
  }
  return { label: 'Thành viên mới', nextCap: 200, percent: Math.min(100, Math.max(4, Math.round((score / 200) * 100))) };
};

const getRoleDisplayLabel = (role?: string): string => {
  const norm = (role || 'user').toLowerCase();
  if (norm === 'admin') return 'Quản trị viên';
  if (norm === 'moderator') return 'Điều hành viên';
  if (norm === 'guide') return 'Hướng dẫn viên';
  return 'Thành viên';
};

const extractSelectionHeader = (
  selection: CockpitInspectorSelection
): {
  typeLabel: string;
  typeTagClass: string;
  title: string;
  subtitle: string;
  coords: { lat: number; lng: number } | null;
} => {
  switch (selection.kind) {
    case 'trail': {
      const t: CockpitTrailPoint = selection.data;
      const hasCoords = Number.isFinite(t.startLat) && Number.isFinite(t.startLng) && (t.startLat !== 0 || t.startLng !== 0);
      return {
        typeLabel: 'Cung đường',
        typeTagClass: 'admin-tag admin-tag--ok',
        title: t.name,
        subtitle: [t.district, t.province, t.region].filter(Boolean).join(' · '),
        coords: hasCoords ? { lat: t.startLat, lng: t.startLng } : null,
      };
    }
    case 'contribution': {
      const c: CockpitContributionPoint = selection.data;
      const hasCoords =
        typeof c.startLat === 'number' &&
        typeof c.startLng === 'number' &&
        Number.isFinite(c.startLat) &&
        Number.isFinite(c.startLng) &&
        (c.startLat !== 0 || c.startLng !== 0);
      return {
        typeLabel: 'Đóng góp mới',
        typeTagClass: 'admin-tag admin-tag--warn',
        title: c.name,
        subtitle: [c.district, c.province, c.region].filter(Boolean).join(' · ') || 'Cung đường đề xuất',
        coords: hasCoords && c.startLat !== undefined && c.startLng !== undefined ? { lat: c.startLat, lng: c.startLng } : null,
      };
    }
    case 'incident': {
      const inc: CockpitIncidentPoint = selection.data;
      const hasCoords =
        typeof inc.lat === 'number' &&
        typeof inc.lng === 'number' &&
        Number.isFinite(inc.lat) &&
        Number.isFinite(inc.lng) &&
        (inc.lat !== 0 || inc.lng !== 0);
      return {
        typeLabel: 'Sự cố',
        typeTagClass: inc.resolved ? 'admin-tag admin-tag--ok' : 'admin-tag admin-tag--danger',
        title: inc.trailName,
        subtitle: [inc.type, inc.locationNote].filter(Boolean).join(' · ') || 'Cảnh báo trên tuyến',
        coords: hasCoords && inc.lat !== undefined && inc.lng !== undefined ? { lat: inc.lat, lng: inc.lng } : null,
      };
    }
    case 'beacon': {
      const b: CockpitBeaconPoint = selection.data;
      const hasCoords =
        typeof b.lat === 'number' &&
        typeof b.lng === 'number' &&
        Number.isFinite(b.lat) &&
        Number.isFinite(b.lng) &&
        (b.lat !== 0 || b.lng !== 0);
      return {
        typeLabel: 'Tín hiệu định vị',
        typeTagClass:
          b.status === 'sos'
            ? 'admin-tag admin-tag--danger'
            : b.status === 'active'
              ? 'admin-tag admin-tag--ok'
              : 'admin-tag',
        title: b.displayName,
        subtitle: b.trailName || 'Điểm phát tín hiệu trực tiếp',
        coords: hasCoords && b.lat !== undefined && b.lng !== undefined ? { lat: b.lat, lng: b.lng } : null,
      };
    }
    case 'timer': {
      const tm: CockpitOverdueTimerPoint = selection.data;
      const hasCoords =
        typeof tm.lat === 'number' &&
        typeof tm.lng === 'number' &&
        Number.isFinite(tm.lat) &&
        Number.isFinite(tm.lng) &&
        (tm.lat !== 0 || tm.lng !== 0);
      return {
        typeLabel: 'Quá hạn báo bình an',
        typeTagClass: 'admin-tag admin-tag--danger',
        title: tm.userName,
        subtitle: tm.trailName || 'Lịch hẹn giờ báo bình an',
        coords: hasCoords && tm.lat !== undefined && tm.lng !== undefined ? { lat: tm.lat, lng: tm.lng } : null,
      };
    }
    case 'user': {
      const u = selection.data;
      return {
        typeLabel: 'Thành viên',
        typeTagClass: u.isBanned ? 'admin-tag admin-tag--danger' : 'admin-tag admin-tag--info',
        title: u.fullName,
        subtitle: u.email,
        coords: null,
      };
    }
  }
};

export const AdminSpatialInspector: React.FC<AdminSpatialInspectorProps> = React.memo(
  ({
    selection,
    isStrictAdmin,
    publishedTrails,
    onClose,
    onEditTrail,
    onDeleteTrail,
    onApproveContribution,
    onRejectContribution,
    onDeleteContribution,
    onInspectContributionModal,
    onResolveIncident,
    onMarkTimerSafe,
    onExtendTimer,
    onResolveBeacon,
    onNavigateSection,
  }) => {
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const copyTimerRef = useRef<number | null>(null);
    const [avatarBrokenUrl, setAvatarBrokenUrl] = useState<string | null>(null);
    const inspectorRef = useRef<HTMLElement | null>(null);
    const [isMobileDrawer, setIsMobileDrawer] = useState<boolean>(() => {
      if (typeof window === 'undefined') return false;
      return window.matchMedia('(max-width: 1240px)').matches;
    });

    useEffect(() => {
      if (typeof window === 'undefined') return;
      const mq = window.matchMedia('(max-width: 1240px)');
      const handleChange = () => setIsMobileDrawer(mq.matches);
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', handleChange);
        return () => mq.removeEventListener('change', handleChange);
      }
      mq.addListener(handleChange);
      return () => mq.removeListener(handleChange);
    }, []);

    useFocusTrap(Boolean(selection) && isMobileDrawer, inspectorRef);

    useEffect(() => {
      if (!selection || !isMobileDrawer) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.isComposing || e.key !== 'Escape') return;
        if (isTopmostFocusTrap(inspectorRef.current)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selection, isMobileDrawer, onClose]);

    useEffect(() => {
      return () => {
        if (copyTimerRef.current !== null) {
          window.clearTimeout(copyTimerRef.current);
        }
      };
    }, []);

    const header = useMemo(() => (selection ? extractSelectionHeader(selection) : null), [selection]);

    const coordKey = header?.coords
      ? `${header.coords.lat.toFixed(6)}, ${header.coords.lng.toFixed(6)}`
      : null;

    const handleCopyCoords = useCallback(() => {
      if (!coordKey) return;
      void copyTextToClipboard(coordKey).then((copied) => {
        if (!copied) return;
        setCopiedKey(coordKey);
        if (copyTimerRef.current !== null) {
          window.clearTimeout(copyTimerRef.current);
        }
        copyTimerRef.current = window.setTimeout(() => {
          setCopiedKey(null);
          copyTimerRef.current = null;
        }, 1800);
      });
    }, [coordKey]);

    if (!selection || !header) {
      return null;
    }

    const isCopied = coordKey !== null && copiedKey === coordKey;

    const renderBody = (): React.ReactNode => {
      if (selection.kind === 'trail') {
        const t = selection.data;
        const difficultyLabel =
          typeof t.difficultyLevel === 'number' && t.difficultyLevel > 0
            ? `Độ khó ${t.difficultyLevel}/5`
            : undefined;

        return (
          <>
            <CoverMediaStrip
              coverImage={t.coverImage}
              title={t.name}
              region={t.region}
              maxAltitudeM={t.maxAltitudeM}
              badgeText={difficultyLabel}
              badgeTone={t.difficultyLevel && t.difficultyLevel >= 4 ? 'danger' : 'info'}
            />

            <RealTopographicProfile
              trailApiId={t.slug || t.id}
              gpxTrack={t.gpxTrack}
            />

            <div className="admin-spec-grid">
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Quãng đường</span>
                <strong
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {`${t.distanceKm} km`}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Độ cao tích lũy</span>
                <strong
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: 'var(--color-primary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {`+${Math.round(t.elevationGainM).toLocaleString('vi-VN')} m`}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Đỉnh cao nhất</span>
                <strong
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {`${Math.round(t.maxAltitudeM).toLocaleString('vi-VN')} m`}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">
                  {typeof t.rating === 'number' && t.rating > 0 ? 'Đánh giá & thời lượng' : 'Thời lượng'}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {typeof t.rating === 'number' && t.rating > 0 ? (
                    <strong
                      style={{
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: 'var(--color-text-main)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <IconStar size={13} color="var(--color-earth)" fill="var(--color-earth)" />
                      {t.rating.toFixed(1)}
                      <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--color-text-dim)' }}>
                        {`(${t.reviewCount ?? 0})`}
                      </span>
                    </strong>
                  ) : null}
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                    {t.durationHoursNote || 'Chưa cập nhật'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-dim)',
                }}
              >
                Tiện ích &amp; quy định trên tuyến
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <CapabilityBadge
                  label={t.permitRequired ? 'Cần giấy phép kiểm lâm' : 'Không cần giấy phép'}
                  active={Boolean(t.permitRequired)}
                  tone="warn"
                  icon={<IconShieldAlert size={12} />}
                />
                <CapabilityBadge
                  label="Bãi cắm trại"
                  active={Boolean(t.hasCampsite)}
                  tone="ok"
                  icon={<IconTent size={12} />}
                />
                <CapabilityBadge
                  label="Nguồn nước"
                  active={Boolean(t.hasWaterSource)}
                  tone="info"
                  icon={<IconDroplet size={12} />}
                />
                <CapabilityBadge
                  label="Phù hợp gia đình"
                  active={Boolean(t.kidFriendly)}
                  tone="ok"
                  icon={<IconUsers size={12} />}
                />
              </div>
            </div>

            {t.permitRequired && t.permitInfo && (
              <div className="admin-note-box admin-note-box--warn">
                <strong style={{ display: 'block', marginBottom: 3 }}>Thủ tục kiểm lâm</strong>
                <span>{t.permitInfo}</span>
              </div>
            )}
          </>
        );
      }

      if (selection.kind === 'contribution') {
        const c = selection.data;
        const normStatus = (c.status || 'pending').toLowerCase();
        const statusMeta = getContributionStatusMeta(c.status);
        const dist = c.distanceKm ?? 0;
        const gain = c.elevationGainM ?? 0;
        const peak = c.maxAltitudeM ?? 0;
        const nearbyPublishedTrail =
          normStatus === 'pending'
            ? findNearestPublishedTrail(c.startLat, c.startLng, publishedTrails)
            : null;

        return (
          <>
            <CoverMediaStrip
              coverImage={c.coverImage}
              title={c.name}
              region={c.region}
              maxAltitudeM={peak > 0 ? peak : undefined}
              badgeText={statusMeta.label}
              badgeTone={statusMeta.tone}
            />

            {nearbyPublishedTrail && (
              <div className="admin-note-box admin-note-box--warn" role="alert">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span className="admin-tag admin-tag--warn">
                    <IconAlertTriangle size={12} />
                    <span>
                      {`Gần tuyến ${nearbyPublishedTrail.name} (~${nearbyPublishedTrail.distanceKm.toFixed(1)} km) — kiểm tra trùng lặp`}
                    </span>
                  </span>
                </div>
                <span>
                  Tọa độ xuất phát nằm trong bán kính 2 km quanh cung đã công khai. Đối chiếu kỹ trước khi duyệt để tránh trùng đỉnh.
                </span>
              </div>
            )}

            <RealTopographicProfile
              trailApiId={c.status === 'approved' ? c.id : undefined}
              gpxTrack={c.gpxTrack}
            />

            <div className="admin-spec-grid">
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Quãng đường</span>
                <strong
                  style={{
                    fontSize: '1.02rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {dist > 0 ? `${dist} km` : 'Chưa rõ'}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Độ cao tích lũy</span>
                <strong
                  style={{
                    fontSize: '1.02rem',
                    fontWeight: 700,
                    color: 'var(--color-primary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {gain > 0 ? `+${Math.round(gain).toLocaleString('vi-VN')} m` : 'Chưa rõ'}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Đỉnh cao nhất</span>
                <strong
                  style={{
                    fontSize: '1.02rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {peak > 0 ? `${Math.round(peak).toLocaleString('vi-VN')} m` : 'Chưa rõ'}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Thời lượng</span>
                <strong style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
                  {c.durationHoursNote || 'Chưa ghi rõ'}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-dim)',
                }}
              >
                Thông tin đi kèm
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <CapabilityBadge
                  label="Giấy phép kiểm lâm"
                  active={Boolean(c.permitRequired)}
                  tone="warn"
                  icon={<IconShieldAlert size={12} />}
                />
                <CapabilityBadge
                  label="Bãi cắm trại"
                  active={Boolean(c.hasCampsite)}
                  tone="ok"
                  icon={<IconTent size={12} />}
                />
                <CapabilityBadge
                  label="Nguồn nước"
                  active={Boolean(c.hasWaterSource)}
                  tone="info"
                  icon={<IconDroplet size={12} />}
                />
              </div>
            </div>

            <div className="admin-note-box">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <strong style={{ color: 'var(--color-text-main)', fontSize: '0.78rem' }}>
                  {c.authorName || 'Thành viên đóng góp'}
                </strong>
                <span className={`admin-tag admin-tag--${statusMeta.tone}`}>{statusMeta.label}</span>
              </div>
              {c.authorEmail && (
                <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)' }}>{c.authorEmail}</div>
              )}
              <div style={{ fontSize: '0.71rem', color: 'var(--color-text-dim)', marginTop: 4 }}>
                {`Gửi lúc: ${formatDateVi(c.createdAt)}`}
              </div>
            </div>
          </>
        );
      }

      if (selection.kind === 'incident') {
        const inc = selection.data;
        const sev = getSeverityMeta(inc.severity);

        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className={sev.tagClass}>
                <span className={sev.dotClass} />
                {`Mức độ: ${sev.label}`}
              </span>
              <span className={inc.isSynthetic ? 'admin-tag admin-tag--info' : 'admin-tag'}>
                {inc.isSynthetic ? <IconSatellite size={12} /> : <IconUsers size={12} />}
                {inc.isSynthetic ? 'Nguồn thời tiết / vệ tinh' : 'Cộng đồng báo tin'}
              </span>
              <span className={inc.resolved ? 'admin-tag admin-tag--ok' : 'admin-tag admin-tag--danger'}>
                {inc.resolved ? 'Đã xử lý' : 'Đang cảnh báo'}
              </span>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: 5,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-main)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: '0.67rem',
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-dim)',
                }}
              >
                Mô tả sự cố
              </span>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.82rem',
                  lineHeight: 1.55,
                  color: 'var(--color-text-main)',
                }}
              >
                {inc.description || 'Chưa có mô tả chi tiết cho cảnh báo này.'}
              </p>
            </div>

            <div className="admin-spec-grid">
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Cung đường</span>
                <strong style={{ fontSize: '0.84rem', color: 'var(--color-text-main)' }}>{inc.trailName}</strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Vị trí</span>
                <strong style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {inc.locationNote || 'Theo tọa độ tuyến'}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Người báo tin</span>
                <strong style={{ fontSize: '0.82rem', color: 'var(--color-text-main)', fontWeight: 600 }}>
                  {inc.reporterName || (inc.isSynthetic ? 'Dữ liệu vệ tinh' : 'Thành viên')}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Thời điểm báo</span>
                <strong
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--color-text-muted)',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatDateVi(inc.reportedAt)}
                </strong>
              </div>
            </div>

            {inc.disputesCount > 0 && (
              <div
                className={
                  inc.disputesCount >= 3
                    ? 'admin-note-box admin-note-box--danger'
                    : 'admin-note-box admin-note-box--warn'
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 3 }}>
                  <IconAlertTriangle size={14} />
                  <span>{`${inc.disputesCount} ý kiến báo tin chưa đúng`}</span>
                </div>
                <span>
                  Có trekker đi qua cho biết thực tế khác với cảnh báo này. Kiểm tra lại và gỡ nếu đường đã ổn.
                </span>
              </div>
            )}
          </>
        );
      }

      if (selection.kind === 'beacon') {
        const b = selection.data;
        const isSos = b.status === 'sos';
        const isActive = b.status === 'active';
        const battery = typeof b.batteryPercent === 'number' ? Math.max(0, Math.min(100, Math.round(b.batteryPercent))) : null;
        const isBatteryCritical = battery !== null && battery <= 20;
        const isBatteryWarn = battery !== null && battery > 20 && battery <= 40;
        const batteryColor = isBatteryCritical
          ? 'var(--color-error)'
          : isBatteryWarn
            ? 'var(--color-earth)'
            : 'var(--color-primary)';

        const pingText =
          typeof b.minutesSinceLastPing === 'number'
            ? b.minutesSinceLastPing <= 1
              ? 'Vừa cập nhật (<1 phút)'
              : `${b.minutesSinceLastPing} phút trước`
            : formatDateVi(b.lastPingAt);

        const telHref = b.phone ? sanitizeTelHref(b.phone) : '';
        const emergencyPhone = extractPhoneFromText(b.emergencyContact);

        return (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 5,
                border: `1px solid ${
                  isSos
                    ? 'color-mix(in srgb, var(--color-error) 35%, transparent)'
                    : 'var(--color-border)'
                }`,
                background: isSos
                  ? 'color-mix(in srgb, var(--color-error) 8%, var(--color-bg-main))'
                  : 'var(--color-bg-main)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className={
                    isSos
                      ? 'admin-readiness-lamp admin-readiness-lamp--danger'
                      : isActive
                        ? 'admin-readiness-lamp admin-readiness-lamp--ok'
                        : 'admin-readiness-lamp'
                  }
                />
                <strong
                  style={{
                    fontSize: '0.78rem',
                    letterSpacing: '0.03em',
                    color: isSos
                      ? 'var(--color-error-text, var(--color-error))'
                      : isActive
                        ? 'var(--color-primary)'
                        : 'var(--color-text-muted)',
                  }}
                >
                  {isSos ? 'Tín hiệu khẩn cấp SOS' : isActive ? 'Đang phát tín hiệu trực tiếp' : 'Phiên đã kết thúc'}
                </strong>
              </div>
              {b.isSignalStale && <span className="admin-tag admin-tag--warn">Mất tín hiệu</span>}
            </div>

            <div
              style={{
                padding: '11px 12px',
                borderRadius: 5,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-main)',
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: 'var(--color-text-dim)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <BatteryGlyph size={13} />
                  Pin thiết bị
                </span>
                <strong
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: battery === null ? 'var(--color-text-dim)' : batteryColor,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {battery !== null ? `${battery}%` : 'Chưa rõ'}
                </strong>
              </div>
              <div
                role="progressbar"
                aria-valuenow={battery ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Mức pin thiết bị"
                style={{
                  height: 7,
                  borderRadius: 3,
                  background: 'var(--color-surface-elevated)',
                  border: '1px solid var(--color-border)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${battery ?? 0}%`,
                    height: '100%',
                    background: batteryColor,
                    transition: 'width var(--dur-base) var(--ease-out-expo)',
                  }}
                />
              </div>
              {isBatteryCritical && (
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-error-text, var(--color-error))' }}>
                  Pin dưới 20% — có thể sớm mất tín hiệu GPS.
                </span>
              )}
            </div>

            <div className="admin-spec-grid">
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Cao độ</span>
                <strong
                  style={{
                    fontSize: '0.98rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {typeof b.altitudeM === 'number' ? `${Math.round(b.altitudeM).toLocaleString('vi-VN')} m` : '—'}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Quãng đường</span>
                <strong
                  style={{
                    fontSize: '0.98rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {typeof b.distanceKm === 'number' ? `${b.distanceKm.toFixed(1)} km` : '—'}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Cập nhật gần nhất</span>
                <strong
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: b.isSignalStale ? 'var(--color-earth)' : 'var(--color-text-main)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {pingText}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Mã phiên</span>
                <span className="admin-code">{b.token.slice(0, 12)}</span>
              </div>
            </div>

            {b.emergencyNote && (
              <div className={isSos ? 'admin-note-box admin-note-box--danger' : 'admin-note-box admin-note-box--warn'}>
                <strong style={{ display: 'block', marginBottom: 3 }}>Lời nhắn khẩn cấp</strong>
                <span>{b.emergencyNote}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-dim)',
                }}
              >
                Liên hệ trực tiếp
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {telHref && b.phone && (
                  <a href={telHref} className="admin-btn admin-btn--sm">
                    <IconPhone size={13} />
                    <span>{b.phone}</span>
                  </a>
                )}
                {b.email && (
                  <a href={`mailto:${b.email}`} className="admin-btn admin-btn--sm">
                    <IconMail size={13} />
                    <span>{b.email}</span>
                  </a>
                )}
                {!telHref && !b.email && (
                  <span style={{ fontSize: '0.76rem', color: 'var(--color-text-dim)' }}>
                    Chưa có số điện thoại hoặc email trực tiếp.
                  </span>
                )}
              </div>
              {b.emergencyContact && (
                <div className="admin-note-box" style={{ marginTop: 2 }}>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--color-text-dim)', marginBottom: 2 }}>
                    Người thân / cứu hộ
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ color: 'var(--color-text-main)', fontSize: '0.79rem' }}>
                      {b.emergencyContact}
                    </strong>
                    {emergencyPhone && (
                      <a href={`tel:${emergencyPhone}`} className="admin-btn admin-btn--sm admin-btn--danger-ghost">
                        <IconPhone size={12} />
                        <span>Gọi ngay</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        );
      }

      if (selection.kind === 'timer') {
        const tm = selection.data;
        const emergencyTel = tm.emergencyContactPhone ? sanitizeTelHref(tm.emergencyContactPhone) : '';
        const trekkerTel = tm.trekkerPhone ? sanitizeTelHref(tm.trekkerPhone) : '';

        return (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 5,
                border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
                background: 'color-mix(in srgb, var(--color-error) 8%, var(--color-bg-main))',
              }}
            >
              <span className="admin-readiness-lamp admin-readiness-lamp--danger" />
              <strong style={{ fontSize: '0.79rem', color: 'var(--color-error-text, var(--color-error))' }}>
                Quá hạn báo bình an — cần liên hệ xác minh ngay
              </strong>
            </div>

            <div className="admin-spec-grid">
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Dự kiến ra rừng</span>
                <strong style={{ fontSize: '0.82rem', color: 'var(--color-error-text, var(--color-error))', fontVariantNumeric: 'tabular-nums' }}>
                  {formatDateVi(tm.expectedReturnAt)}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Phát cảnh báo lúc</span>
                <strong style={{ fontSize: '0.8rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatDateVi(tm.alertedAt)}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">Người thân liên hệ</span>
                <strong style={{ fontSize: '0.82rem', color: 'var(--color-text-main)' }}>
                  {tm.emergencyContactName || 'Chưa rõ'}
                </strong>
              </div>
              <div className="admin-spec-cell">
                <span className="admin-spec-label">SĐT người thân</span>
                <strong style={{ fontSize: '0.82rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                  {tm.emergencyContactPhone || 'Chưa cập nhật'}
                </strong>
              </div>
            </div>

            {tm.notes && (
              <div className="admin-note-box admin-note-box--warn">
                <strong style={{ display: 'block', marginBottom: 3 }}>Ghi chú hành trình</strong>
                <span>{tm.notes}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {emergencyTel && tm.emergencyContactPhone && (
                <a href={emergencyTel} className="admin-btn admin-btn--sm admin-btn--danger">
                  <IconPhone size={13} />
                  <span>Gọi người thân</span>
                </a>
              )}
              {trekkerTel && tm.trekkerPhone && (
                <a href={trekkerTel} className="admin-btn admin-btn--sm">
                  <IconPhone size={13} />
                  <span>Gọi trekker</span>
                </a>
              )}
              {tm.emergencyContactEmail && (
                <a href={`mailto:${tm.emergencyContactEmail}`} className="admin-btn admin-btn--sm">
                  <IconMail size={13} />
                  <span>{tm.emergencyContactEmail}</span>
                </a>
              )}
            </div>
          </>
        );
      }

      // User selection
      const u = selection.data;
      const tier = getReputationTier(u.reputationScore);
      const roleUpper = (u.role || 'user').toUpperCase();
      const roleLabel = getRoleDisplayLabel(u.role);
      const roleTagClass =
        roleUpper === 'ADMIN'
          ? 'admin-tag admin-tag--ok'
          : roleUpper === 'MODERATOR'
            ? 'admin-tag admin-tag--info'
            : 'admin-tag';
      const showAvatar = Boolean(u.avatarUrl) && avatarBrokenUrl !== u.avatarUrl;
      const initials = (u.fullName || 'U')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');

      return (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px',
              borderRadius: 5,
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-main)',
            }}
          >
            {showAvatar && u.avatarUrl ? (
              <img
                src={u.avatarUrl}
                alt={u.fullName}
                loading="lazy"
                decoding="async"
                onError={() => setAvatarBrokenUrl(u.avatarUrl ?? null)}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1px solid var(--color-border-strong)',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: '50%',
                  border: '1px solid var(--color-border-strong)',
                  background: 'var(--color-surface-elevated)',
                  color: 'var(--color-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {initials || <IconUser size={18} />}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span className={roleTagClass}>{roleLabel}</span>
                {u.isBanned ? (
                  <span className="admin-tag admin-tag--danger">Đang khóa</span>
                ) : (
                  <span className="admin-tag admin-tag--ok">Hoạt động</span>
                )}
              </div>
              <span
                style={{
                  fontSize: '0.73rem',
                  color: 'var(--color-text-dim)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {`ID: ${u.id}`}
              </span>
            </div>
          </div>

          {u.isBanned && (
            <div className="admin-note-box admin-note-box--danger">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 3 }}>
                <IconShieldAlert size={14} />
                <span>Tài khoản đang bị khóa</span>
              </div>
              <span>{u.banReason || 'Vi phạm quy định cộng đồng LOST.'}</span>
            </div>
          )}

          <div
            style={{
              padding: '12px',
              borderRadius: 5,
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-main)',
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                {`Điểm uy tín · ${tier.label}`}
              </span>
              <strong
                style={{
                  fontSize: '0.98rem',
                  fontWeight: 700,
                  color: 'var(--color-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {u.reputationScore.toLocaleString('vi-VN')}
              </strong>
            </div>
            <div
              role="progressbar"
              aria-valuenow={tier.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Điểm uy tín thành viên"
              style={{
                height: 6,
                borderRadius: 3,
                background: 'var(--color-surface-elevated)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${tier.percent}%`,
                  height: '100%',
                  background: 'var(--color-primary)',
                  transition: 'width var(--dur-base) var(--ease-out-expo)',
                }}
              />
            </div>
            <span style={{ fontSize: '0.69rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
              {`Mốc tiếp theo: ${tier.nextCap.toLocaleString('vi-VN')} điểm`}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: 'var(--color-text-dim)',
              }}
            >
              {`Huy hiệu (${u.badges.length})`}
            </span>
            {u.badges.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {u.badges.map((badge) => (
                  <span key={badge} className="admin-tag admin-tag--ok">
                    <IconShieldCheck size={11} />
                    <span>{badge}</span>
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: '0.76rem', color: 'var(--color-text-dim)' }}>
                Chưa có huy hiệu nào.
              </span>
            )}
          </div>
        </>
      );
    };

    const renderFooter = (): React.ReactNode => {
      switch (selection.kind) {
        case 'trail': {
          const t = selection.data;
          return (
            <>
              {isStrictAdmin && onEditTrail && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--primary"
                  onClick={() => onEditTrail(t.id)}
                >
                  <IconEdit size={13} />
                  <span>Chỉnh sửa</span>
                </button>
              )}
              {onNavigateSection && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm"
                  onClick={() => onNavigateSection('trails')}
                >
                  <IconCompass size={13} />
                  <span>Danh sách cung</span>
                </button>
              )}
              {isStrictAdmin && onDeleteTrail && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--danger-ghost"
                  onClick={() => onDeleteTrail(t.id, t.name)}
                  aria-label={`Xóa cung đường ${t.name}`}
                  style={{ marginLeft: 'auto' }}
                >
                  <IconTrash size={13} />
                  <span>Xóa</span>
                </button>
              )}
            </>
          );
        }

        case 'contribution': {
          const c = selection.data;
          const normStatus = (c.status || '').toLowerCase();
          const canDelete = normStatus !== 'approved' || isStrictAdmin;
          return (
            <>
              {onInspectContributionModal && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm"
                  onClick={() => onInspectContributionModal(c.id)}
                >
                  <IconEye size={13} />
                  <span>Xem đầy đủ</span>
                </button>
              )}
              {normStatus !== 'approved' && onApproveContribution && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--primary"
                  onClick={() => onApproveContribution(c.id, c.name)}
                >
                  <IconCheckCircle size={13} />
                  <span>Duyệt</span>
                </button>
              )}
              {normStatus === 'pending' && onRejectContribution && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--danger-ghost"
                  onClick={() => onRejectContribution(c.id, c.name)}
                >
                  <IconX size={13} />
                  <span>Từ chối</span>
                </button>
              )}
              {canDelete && onDeleteContribution && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--danger-ghost"
                  onClick={() => onDeleteContribution(c.id, c.name, normStatus)}
                  aria-label={`Xóa đóng góp ${c.name}`}
                  style={{ marginLeft: 'auto' }}
                >
                  <IconTrash size={13} />
                  <span>Xóa</span>
                </button>
              )}
            </>
          );
        }

        case 'incident': {
          const inc = selection.data;
          return (
            <>
              {!inc.isSynthetic && !inc.resolved && onResolveIncident && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--primary"
                  onClick={() => onResolveIncident(inc.id)}
                >
                  <IconCheckCircle size={13} />
                  <span>Gỡ cảnh báo</span>
                </button>
              )}
              {onNavigateSection && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm"
                  onClick={() => onNavigateSection('incidents')}
                >
                  <IconAlertTriangle size={13} />
                  <span>Danh sách sự cố</span>
                </button>
              )}
            </>
          );
        }

        case 'beacon': {
          const b = selection.data;
          return (
            <>
              <a
                href={b.sharePath}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-btn admin-btn--sm admin-btn--primary"
              >
                <IconRadio size={13} />
                <span>Xem trên bản đồ</span>
                <ExternalLinkGlyph size={12} />
              </a>
              {b.status !== 'ended' && onResolveBeacon && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--danger-ghost"
                  onClick={() => onResolveBeacon(b.id, b.displayName, b.trailName)}
                >
                  <IconShieldCheck size={13} />
                  <span>Kết thúc tín hiệu</span>
                </button>
              )}
              {onNavigateSection && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm"
                  onClick={() => onNavigateSection('safety')}
                >
                  <IconClock size={13} />
                  <span>Mở mục an toàn</span>
                </button>
              )}
            </>
          );
        }

        case 'timer': {
          const tm = selection.data;
          return (
            <>
              {onMarkTimerSafe && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--primary"
                  onClick={() => onMarkTimerSafe(tm.id, tm.userName, tm.trailName)}
                >
                  <IconCheckCircle size={13} />
                  <span>Đánh dấu đã an toàn</span>
                </button>
              )}
              {onExtendTimer && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm"
                  onClick={() => onExtendTimer(tm.id, tm.userName, tm.trailName)}
                >
                  <IconClock size={13} />
                  <span>Gia hạn +2 giờ</span>
                </button>
              )}
              {typeof tm.lat === 'number' && typeof tm.lng === 'number' && (
                <a
                  href={`https://www.google.com/maps?q=${tm.lat},${tm.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-btn admin-btn--sm admin-btn--danger"
                >
                  <IconMapPin size={13} />
                  <span>Mở vị trí</span>
                  <ExternalLinkGlyph size={12} />
                </a>
              )}
              {onNavigateSection && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm"
                  onClick={() => onNavigateSection('safety')}
                >
                  <IconClock size={13} />
                  <span>Mở mục an toàn</span>
                </button>
              )}
            </>
          );
        }

        case 'user':
          return onNavigateSection ? (
            <button
              type="button"
              className="admin-btn admin-btn--sm admin-btn--primary"
              onClick={() => onNavigateSection('users')}
            >
              <IconUsers size={13} />
              <span>Danh sách thành viên</span>
            </button>
          ) : null;
      }
    };

    const footerContent = renderFooter();

    return (
      <>
        <div className="admin-inspector-backdrop" onClick={onClose} aria-hidden="true" />
        <aside
          ref={inspectorRef}
          tabIndex={isMobileDrawer ? -1 : undefined}
          role={isMobileDrawer ? 'dialog' : undefined}
          aria-modal={isMobileDrawer ? true : undefined}
          className="admin-inspector-pane"
          aria-label="Bảng chi tiết mục đang chọn"
          style={isMobileDrawer ? { outline: 'none' } : undefined}
        >
          <div className="admin-inspector-head">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span className={header.typeTagClass} style={{ letterSpacing: '0.02em' }}>
                {header.typeLabel}
              </span>
              <button
                type="button"
                className="admin-btn admin-btn--sm admin-btn--ghost"
                onClick={onClose}
                aria-label="Đóng bảng chi tiết"
                title="Đóng bảng chi tiết (Esc)"
                style={{ padding: '0 7px', gap: 5 }}
              >
                <span className="admin-kbd-chip">Esc</span>
                <IconX size={14} />
              </button>
            </div>

            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  lineHeight: 1.3,
                  letterSpacing: '-0.02em',
                  color: 'var(--color-text-main)',
                }}
              >
                {header.title}
              </h3>

              {header.subtitle && (
                <p
                  style={{
                    margin: '3px 0 0 0',
                    fontSize: '0.78rem',
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  {selection.kind !== 'user' && <IconMapPin size={12} color="var(--color-text-dim)" />}
                  <span>{header.subtitle}</span>
                </p>
              )}
            </div>

            {header.coords && (
              <button
                type="button"
                className="admin-coord-readout"
                onClick={handleCopyCoords}
                title="Nhấn để sao chép tọa độ GPS"
                style={{
                  alignSelf: 'flex-start',
                  maxWidth: '100%',
                  fontFamily: 'var(--font-family)',
                  fontVariantNumeric: 'tabular-nums',
                  color: isCopied ? 'var(--color-primary)' : undefined,
                  borderColor: isCopied
                    ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)'
                    : undefined,
                }}
              >
                <CrosshairGlyph size={12} />
                <span>{formatCoordDisplay(header.coords.lat, header.coords.lng)}</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    marginLeft: 4,
                    fontSize: '0.66rem',
                    fontWeight: 600,
                    color: isCopied ? 'var(--color-primary)' : 'var(--color-text-dim)',
                  }}
                >
                  {isCopied ? (
                    <>
                      <IconCheck size={11} />
                      <span>Đã sao chép</span>
                    </>
                  ) : (
                    <IconCopy size={11} />
                  )}
                </span>
              </button>
            )}
          </div>

          <div className="admin-inspector-body">{renderBody()}</div>

          {footerContent && <div className="admin-inspector-foot">{footerContent}</div>}
        </aside>
      </>
    );
  }
);

AdminSpatialInspector.displayName = 'AdminSpatialInspector';
