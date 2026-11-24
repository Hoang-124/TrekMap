import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Trail } from '../../types.js';
import { OptimizedImage } from '../common/OptimizedImage.js';
import { haversineMeters } from '../../utils/geoMath.js';
import { useFocusTrap, isTopmostFocusTrap } from '../../hooks/useFocusTrap.js';
import {
  fetchMultiTrailWeatherCompare,
  type TrailWeatherCompareEntry,
} from '../../services/api.js';

interface TrailComparisonModalProps {
  trails: Trail[];
  isOpen: boolean;
  onClose: () => void;
  onRemoveTrail: (trailId: string) => void;
  onSelectTrail: (trail: Trail) => void;
}

const SERIES_TOKENS = [
  'var(--color-primary)',
  'var(--color-sky)',
  'var(--color-sun)',
  'var(--color-earth)',
] as const;

const SAMPLE_COUNT = 48;

interface NormalizedElevationSeries {
  trailId: string;
  name: string;
  distanceKm: number;
  maxAltitudeM: number;
  token: string;
  samples: number[]; // length SAMPLE_COUNT + 1 (0%..100%)
  peakIndex: number;
  isDem: boolean;
}

function buildDeterministicNormalizedCurve(trail: Trail): number[] {
  const maxAlt = Math.max(100, Number(trail.maxAltitudeM) || 1000);
  const gain = Math.max(80, Number(trail.elevationGainM) || Math.round(maxAlt * 0.45));
  const baseAlt = Math.max(40, Math.round(maxAlt - Math.min(gain, maxAlt * 0.85)));

  const track = Array.isArray(trail.gpxTrack) ? trail.gpxTrack : [];
  const isLoop =
    track.length >= 2 &&
    haversineMeters(track[0][0], track[0][1], track[track.length - 1][0], track[track.length - 1][1]) <= 500;

  // Build waypoint anchors along normalized route progress when elevationM is present
  const anchors: Array<{ t: number; alt: number }> = [{ t: 0, alt: baseAlt }];
  const wps = Array.isArray(trail.waypoints)
    ? trail.waypoints.filter((wp) => typeof wp.elevationM === 'number' && Number.isFinite(wp.elevationM))
    : [];

  if (wps.length > 0 && track.length >= 2) {
    const cumDist: number[] = [0];
    for (let i = 1; i < track.length; i++) {
      cumDist.push(cumDist[i - 1] + haversineMeters(track[i - 1][0], track[i - 1][1], track[i][0], track[i][1]));
    }
    const totalM = cumDist[cumDist.length - 1] || 1;
    for (const wp of wps) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < track.length; i++) {
        const d = haversineMeters(wp.lat, wp.lng, track[i][0], track[i][1]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const t = Math.min(0.98, Math.max(0.02, cumDist[bestIdx] / totalM));
      anchors.push({ t, alt: Math.round(wp.elevationM as number) });
    }
  } else if (wps.length > 0) {
    wps.forEach((wp, idx) => {
      const t = (idx + 1) / (wps.length + 1);
      anchors.push({ t, alt: Math.round(wp.elevationM as number) });
    });
  }

  // Ensure summit altitude is represented
  const hasNearPeak = anchors.some((a) => a.alt >= maxAlt - 40);
  if (!hasNearPeak) {
    anchors.push({ t: isLoop ? 0.56 : 0.92, alt: maxAlt });
  }
  anchors.push({ t: 1, alt: isLoop ? baseAlt : Math.max(baseAlt, Math.round(maxAlt - gain * 0.08)) });

  anchors.sort((a, b) => a.t - b.t);
  // Deduplicate closely spaced anchors
  const merged: Array<{ t: number; alt: number }> = [];
  for (const a of anchors) {
    const prev = merged[merged.length - 1];
    if (prev && Math.abs(a.t - prev.t) < 0.025) {
      if (a.alt > prev.alt) merged[merged.length - 1] = a;
    } else {
      merged.push(a);
    }
  }

  const samples: number[] = [];
  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const t = i / SAMPLE_COUNT;
    let left = merged[0];
    let right = merged[merged.length - 1];
    for (let k = 0; k < merged.length - 1; k++) {
      if (t >= merged[k].t && t <= merged[k + 1].t) {
        left = merged[k];
        right = merged[k + 1];
        break;
      }
    }
    const span = Math.max(0.0001, right.t - left.t);
    const localT = (t - left.t) / span;
    // Smoothstep cosine interpolation for natural mountain ridge profile
    const smooth = (1 - Math.cos(localT * Math.PI)) / 2;
    const baseInterp = left.alt + (right.alt - left.alt) * smooth;
    // Subtle deterministic ridge micro-undulation (0% random)
    const micro = Math.sin(t * Math.PI * 5 + (maxAlt % 7)) * Math.min(28, gain * 0.018);
    samples.push(Math.round(Math.max(0, Math.min(maxAlt, baseInterp + (i === 0 || i === SAMPLE_COUNT ? 0 : micro)))));
  }
  return samples;
}

function resampleDemPoints(
  points: Array<{ distanceKm?: number; elevationM?: number; altitudeM?: number }>
): number[] | null {
  const valid = points
    .map((p) => {
      const alt =
        typeof p.elevationM === 'number' && Number.isFinite(p.elevationM)
          ? p.elevationM
          : typeof p.altitudeM === 'number' && Number.isFinite(p.altitudeM)
          ? p.altitudeM
          : NaN;
      return { distanceKm: p.distanceKm, alt };
    })
    .filter((p) => Number.isFinite(p.alt));
  if (valid.length < 3) return null;

  const totalDist =
    typeof valid[valid.length - 1].distanceKm === 'number' && (valid[valid.length - 1].distanceKm as number) > 0
      ? (valid[valid.length - 1].distanceKm as number)
      : valid.length - 1;

  const normalized = valid.map((p, idx) => ({
    t:
      typeof p.distanceKm === 'number' && totalDist > 0
        ? Math.min(1, Math.max(0, p.distanceKm / totalDist))
        : idx / (valid.length - 1),
    alt: Math.round(p.alt),
  }));

  const out: number[] = [];
  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const targetT = i / SAMPLE_COUNT;
    let lo = normalized[0];
    let hi = normalized[normalized.length - 1];
    for (let k = 0; k < normalized.length - 1; k++) {
      if (targetT >= normalized[k].t && targetT <= normalized[k + 1].t) {
        lo = normalized[k];
        hi = normalized[k + 1];
        break;
      }
    }
    const span = Math.max(0.0001, hi.t - lo.t);
    const ratio = (targetT - lo.t) / span;
    out.push(Math.round(lo.alt + (hi.alt - lo.alt) * ratio));
  }
  return out;
}

function formatVnForecastDate(isoDate: string): string {
  if (!isoDate) return '—';
  const parsed = new Date(`${isoDate.slice(0, 10)}T12:00:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  const weekdayMap = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const wd = weekdayMap[parsed.getDay()] || '';
  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${wd} ${dd}/${mm}`;
}

function formatWeatherTierLabel(tier: 'ideal' | 'caution' | 'danger'): {
  label: string;
  color: string;
} {
  if (tier === 'danger') return { label: 'Cảnh báo', color: 'var(--color-error-text, var(--color-error))' };
  if (tier === 'caution') return { label: 'Lưu ý', color: 'var(--color-sun)' };
  return { label: 'Thuận lợi', color: 'var(--color-primary)' };
}

function scoreTrailWeather(entry: TrailWeatherCompareEntry): number {
  if (typeof entry.summaryScore === 'number' && Number.isFinite(entry.summaryScore)) {
    return entry.summaryScore;
  }
  if (!entry.days.length) return -999;
  const precip = entry.days.reduce((s, d) => s + d.precipMm, 0);
  const avgWind = entry.days.reduce((s, d) => s + d.windSpeedKmH, 0) / entry.days.length;
  const avgCloud = entry.days.reduce((s, d) => s + d.seaOfCloudsPercent, 0) / entry.days.length;
  const dangerPenalty = entry.days.filter((d) => d.weatherTier === 'danger').length * 35;
  const cautionPenalty = entry.days.filter((d) => d.weatherTier === 'caution').length * 10;
  return 100 - precip * 1.4 - avgWind * 0.6 + avgCloud * 0.18 - dangerPenalty - cautionPenalty;
}

export const TrailComparisonModal: React.FC<TrailComparisonModalProps> = ({
  trails,
  isOpen,
  onClose,
  onRemoveTrail,
  onSelectTrail,
}) => {
  const chartUid = useId().replace(/:/g, '');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [demByTrailId, setDemByTrailId] = useState<Record<string, number[]>>({});
  const demCacheRef = useRef<Record<string, number[]>>({});
  const [weatherState, setWeatherState] = useState<{
    key: string;
    loading: boolean;
    error: boolean;
    entries: TrailWeatherCompareEntry[];
    bestWeatherTrailId: string | null;
    bestCloudTrailId: string | null;
  }>({
    key: '',
    loading: false,
    error: false,
    entries: [],
    bestWeatherTrailId: null,
    bestCloudTrailId: null,
  });
  const [weatherRetryTick, setWeatherRetryTick] = useState(0);

  const visibleTrails = useMemo(() => trails.slice(0, 4), [trails]);
  const trailIdsKey = useMemo(() => visibleTrails.map((t) => t.id).join('|'), [visibleTrails]);

  // Fetch live batched 3-day summit weather comparison (Wave 10B GET /api/weather/compare)
  useEffect(() => {
    if (!isOpen || !trailIdsKey) return;
    const controller = new AbortController();
    const ids = trailIdsKey.split('|').filter(Boolean);

    fetchMultiTrailWeatherCompare(ids, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        if (!res || res.data.length === 0) {
          setWeatherState({
            key: trailIdsKey,
            loading: false,
            error: true,
            entries: [],
            bestWeatherTrailId: null,
            bestCloudTrailId: null,
          });
          return;
        }
        const computedBestWeather =
          res.bestWeatherTrailId ||
          [...res.data].sort((a, b) => scoreTrailWeather(b) - scoreTrailWeather(a))[0]?.trailId ||
          null;
        const computedBestCloud =
          res.bestCloudTrailId ||
          [...res.data].sort(
            (a, b) => (b.avgSeaOfCloudsPercent || 0) - (a.avgSeaOfCloudsPercent || 0)
          )[0]?.trailId ||
          null;
        setWeatherState({
          key: trailIdsKey,
          loading: false,
          error: false,
          entries: res.data,
          bestWeatherTrailId: computedBestWeather,
          bestCloudTrailId: computedBestCloud,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setWeatherState({
            key: trailIdsKey,
            loading: false,
            error: true,
            entries: [],
            bestWeatherTrailId: null,
            bestCloudTrailId: null,
          });
        }
      });

    return () => controller.abort();
  }, [isOpen, trailIdsKey, weatherRetryTick]);

  const weatherByTrailId = useMemo(() => {
    const map = new Map<string, TrailWeatherCompareEntry>();
    if (weatherState.key === trailIdsKey) {
      for (const entry of weatherState.entries) {
        map.set(entry.trailId, entry);
      }
    }
    return map;
  }, [weatherState, trailIdsKey]);

  const isWeatherLoading = isOpen && Boolean(trailIdsKey) && weatherState.key !== trailIdsKey;
  const isWeatherError = weatherState.key === trailIdsKey && weatherState.error;
  const weatherDates = useMemo(() => {
    const firstWithDays =
      weatherState.key === trailIdsKey
        ? weatherState.entries.find((e) => Array.isArray(e.days) && e.days.length > 0)
        : undefined;
    return firstWithDays ? firstWithDays.days.map((d) => d.date) : [];
  }, [weatherState, trailIdsKey]);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(isOpen && visibleTrails.length > 0, dialogRef);

  useEffect(() => {
    if (!isOpen || visibleTrails.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (!isTopmostFocusTrap(dialogRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, visibleTrails.length, onClose]);

  // Progressively enrich comparison curves with real Copernicus DEM data (keyed on trailIdsKey, skips cached IDs)
  useEffect(() => {
    if (!isOpen || !trailIdsKey) return;
    const idsToFetch = trailIdsKey
      .split('|')
      .filter((id) => Boolean(id) && !demCacheRef.current[id]);
    if (idsToFetch.length === 0) return;

    const controller = new AbortController();

    Promise.all(
      idsToFetch.map(async (id) => {
        try {
          const res = await fetch(
            `/api/trails/${encodeURIComponent(id)}/elevation`,
            { signal: controller.signal }
          );
          if (!res.ok) return null;
          const json = await res.json();
          const pts = Array.isArray(json?.data?.points)
            ? json.data.points
            : Array.isArray(json?.data)
            ? json.data
            : null;
          if (!pts) return null;
          const resampled = resampleDemPoints(pts);
          return resampled ? { id, samples: resampled } : null;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (controller.signal.aborted) return;
      const updates: Record<string, number[]> = {};
      for (const item of results) {
        if (item) {
          updates[item.id] = item.samples;
          demCacheRef.current[item.id] = item.samples;
        }
      }
      if (Object.keys(updates).length > 0) {
        setDemByTrailId((prev) => ({ ...prev, ...updates }));
      }
    });

    return () => controller.abort();
  }, [isOpen, trailIdsKey]);

  const elevationSeries = useMemo<NormalizedElevationSeries[]>(() => {
    return visibleTrails.map((t, idx) => {
      const demSamples = demByTrailId[t.id];
      const samples = demSamples || buildDeterministicNormalizedCurve(t);
      let peakIndex = 0;
      let peakVal = -Infinity;
      for (let i = 0; i < samples.length; i++) {
        if (samples[i] > peakVal) {
          peakVal = samples[i];
          peakIndex = i;
        }
      }
      return {
        trailId: t.id,
        name: t.name,
        distanceKm: Number(t.distanceKm) || 0,
        maxAltitudeM: Math.max(Number(t.maxAltitudeM) || 0, peakVal > 0 ? peakVal : 0),
        token: SERIES_TOKENS[idx % SERIES_TOKENS.length],
        samples,
        peakIndex,
        isDem: Boolean(demSamples),
      };
    });
  }, [visibleTrails, demByTrailId]);

  const chartBounds = useMemo(() => {
    let minAlt = Infinity;
    let maxAlt = -Infinity;
    for (const s of elevationSeries) {
      for (const v of s.samples) {
        if (v < minAlt) minAlt = v;
        if (v > maxAlt) maxAlt = v;
      }
    }
    if (!Number.isFinite(minAlt) || !Number.isFinite(maxAlt)) {
      return { minAlt: 0, maxAlt: 3200 };
    }
    const roundedMin = Math.max(0, Math.floor((minAlt - 100) / 200) * 200);
    const roundedMax = Math.ceil((maxAlt + 150) / 200) * 200;
    return {
      minAlt: roundedMin,
      maxAlt: Math.max(roundedMin + 400, roundedMax),
    };
  }, [elevationSeries]);

  if (!isOpen || visibleTrails.length === 0) return null;

  const handleAskLostAiCompare = () => {
    const names = visibleTrails
      .map((t) => `${t.name} (${t.maxAltitudeM}m, ${t.distanceKm}km, cấp ${t.difficultyLevel}/5)`)
      .join(' và ');
    const prompt =
      visibleTrails.length >= 2
        ? `So sánh chi tiết ${names} — phân tích ưu nhược điểm địa hình, thời tiết mùa này, mức thể lực yêu cầu và gợi ý tôi nên chọn 1 cung phù hợp nhất.`
        : `Phân tích chi tiết cung ${names} — địa hình, thời tiết mùa này, độ khó thực tế và lời khuyên chuẩn bị.`;
    onClose();
    window.dispatchEvent(
      new CustomEvent('lost:open-ai-assistant', {
        detail: {
          prompt,
          trailId: visibleTrails[0]?.id,
          trailName: visibleTrails[0]?.name,
        },
      })
    );
  };

  // SVG Coordinate Geometry
  const vbW = 760;
  const vbH = 210;
  const padL = 52;
  const padR = 20;
  const padT = 18;
  const padB = 30;
  const plotW = vbW - padL - padR;
  const plotH = vbH - padT - padB;
  const altSpan = Math.max(1, chartBounds.maxAlt - chartBounds.minAlt);

  const xAt = (sampleIdx: number) => padL + (sampleIdx / SAMPLE_COUNT) * plotW;
  const yAt = (altM: number) => padT + plotH - ((altM - chartBounds.minAlt) / altSpan) * plotH;

  const gridTicks = [0, 0.333, 0.666, 1].map((ratio) =>
    Math.round(chartBounds.minAlt + altSpan * ratio)
  );

  const handleSvgPointer = (clientX: number, svgEl: SVGSVGElement | null) => {
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    if (rect.width <= 0) return;
    const relX = ((clientX - rect.left) / rect.width) * vbW;
    const clamped = Math.max(padL, Math.min(vbW - padR, relX));
    const idx = Math.round(((clamped - padL) / plotW) * SAMPLE_COUNT);
    setHoverIdx(Math.max(0, Math.min(SAMPLE_COUNT, idx)));
  };

  const activePct = hoverIdx !== null ? Math.round((hoverIdx / SAMPLE_COUNT) * 100) : null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal, 3000)' as unknown as number,
        background: 'var(--overlay-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 14px',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Bảng so sánh cung đường trekking"
        tabIndex={-1}
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          borderRadius: 6,
          maxWidth: 1120,
          outline: 'none',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-3d)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            padding: '14px 20px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg-main)',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 4,
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-border-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-sky)',
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                <path d="M7 21h10" />
                <path d="M12 3v18" />
                <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
              </svg>
            </div>
            <div>
              <h3 className="font-editorial" style={{ margin: 0, fontSize: '1.28rem', fontWeight: 500, color: 'var(--color-text-main)' }}>
                Bảng So Sánh Cung Đường Trekking
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
                Đối chiếu mặt cắt cao độ DEM, độ khó, thời tiết và tiện ích thực địa ({visibleTrails.length} cung đường)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleAskLostAiCompare}
              className="btn btn-primary"
              style={{
                padding: '7px 13px',
                fontSize: '0.78rem',
                fontWeight: 800,
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
              <span>Nhờ LOST AI Phân Tích Chọn 1 Cung</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng bảng so sánh"
              style={{
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
                borderRadius: 4,
                width: 32,
                height: 32,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '16px 20px 20px', overflowY: 'auto', overflowX: 'auto', flex: 1 }}>
          {/* Pure Inline SVG Overlaid Normalized Elevation Profile Chart */}
          <div
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: '14px 16px',
              marginBottom: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
                </svg>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)', letterSpacing: '0.02em' }}>
                  Biểu Đồ Chồng Mặt Cắt Cao Độ Chuẩn Hóa (0% – 100% Lộ Trình)
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                {activePct !== null
                  ? `Đang soi mốc ${activePct}% lộ trình`
                  : 'Di chuột hoặc chạm vào biểu đồ để đối chiếu độ cao từng cung'}
              </span>
            </div>

            {/* Interactive Legend / Live Scrub Readout */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {elevationSeries.map((s) => {
                const sampleAlt = hoverIdx !== null ? s.samples[hoverIdx] : s.maxAltitudeM;
                const sampleKm =
                  hoverIdx !== null ? ((hoverIdx / SAMPLE_COUNT) * s.distanceKm).toFixed(1) : s.distanceKm.toFixed(1);
                return (
                  <div
                    key={`legend-${s.trailId}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '4px 9px',
                      borderRadius: 4,
                      background: 'var(--color-bg-card)',
                      border: `1px solid color-mix(in srgb, ${s.token} 42%, var(--color-border))`,
                      fontSize: '0.74rem',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span style={{ width: 10, height: 3, borderRadius: 2, background: s.token, flexShrink: 0 }} />
                    <strong style={{ color: 'var(--color-text-main)', fontWeight: 700 }}>{s.name}</strong>
                    <span style={{ color: s.token, fontWeight: 800 }}>
                      {sampleAlt.toLocaleString('vi-VN')}m
                    </span>
                    <span style={{ color: 'var(--color-text-dim)', fontSize: '0.7rem' }}>
                      {hoverIdx !== null ? `@ ${sampleKm} km` : `· ${s.distanceKm} km`}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Responsive Pure SVG Elevation Overlay */}
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <svg
                viewBox={`0 0 ${vbW} ${vbH}`}
                role="img"
                aria-label="Biểu đồ chồng mặt cắt cao độ các cung đường đang so sánh"
                style={{
                  width: '100%',
                  minWidth: 420,
                  height: 'auto',
                  maxHeight: 220,
                  display: 'block',
                  cursor: 'crosshair',
                  touchAction: 'pan-y',
                }}
                onMouseMove={(e) => handleSvgPointer(e.clientX, e.currentTarget)}
                onMouseLeave={() => setHoverIdx(null)}
                onTouchMove={(e) => {
                  if (e.touches[0]) handleSvgPointer(e.touches[0].clientX, e.currentTarget);
                }}
                onTouchEnd={() => setHoverIdx(null)}
              >
                <defs>
                  {elevationSeries.map((s) => (
                    <linearGradient key={`grad-${s.trailId}`} id={`cmp-grad-${chartUid}-${s.trailId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.token} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={s.token} stopOpacity={0.01} />
                    </linearGradient>
                  ))}
                </defs>

                {/* Horizontal Elevation Gridlines */}
                {gridTicks.map((alt) => {
                  const y = yAt(alt);
                  return (
                    <g key={`grid-${alt}`}>
                      <line
                        x1={padL}
                        x2={vbW - padR}
                        y1={y}
                        y2={y}
                        stroke="var(--color-border-strong)"
                        strokeWidth={0.8}
                        strokeDasharray="3 4"
                      />
                      <text
                        x={padL - 8}
                        y={y + 3.5}
                        textAnchor="end"
                        fill="var(--color-text-dim)"
                        fontSize="10"
                        fontFamily="var(--font-family)"
                        fontWeight="600"
                      >
                        {alt.toLocaleString('vi-VN')}m
                      </text>
                    </g>
                  );
                })}

                {/* X-Axis Normalized Progress Ticks */}
                {[0, 25, 50, 75, 100].map((pct) => {
                  const x = padL + (pct / 100) * plotW;
                  return (
                    <g key={`pct-${pct}`}>
                      <line
                        x1={x}
                        x2={x}
                        y1={padT}
                        y2={padT + plotH}
                        stroke="var(--color-border)"
                        strokeWidth={0.6}
                      />
                      <text
                        x={x}
                        y={vbH - 9}
                        textAnchor={pct === 0 ? 'start' : pct === 100 ? 'end' : 'middle'}
                        fill="var(--color-text-dim)"
                        fontSize="10"
                        fontFamily="var(--font-family)"
                        fontWeight="600"
                      >
                        {pct}%
                      </text>
                    </g>
                  );
                })}

                {/* Overlaid Area + Stroke Paths for Every Compared Trail */}
                {elevationSeries.map((s) => {
                  const linePts = s.samples.map((alt, i) => `${xAt(i).toFixed(1)},${yAt(alt).toFixed(1)}`);
                  const linePath = `M ${linePts.join(' L ')}`;
                  const areaPath = `${linePath} L ${xAt(SAMPLE_COUNT).toFixed(1)},${(padT + plotH).toFixed(1)} L ${xAt(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;
                  const peakX = xAt(s.peakIndex);
                  const peakY = yAt(s.samples[s.peakIndex]);

                  return (
                    <g key={`curve-${s.trailId}`}>
                      <path d={areaPath} fill={`url(#cmp-grad-${chartUid}-${s.trailId})`} />
                      <path
                        d={linePath}
                        fill="none"
                        stroke={s.token}
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx={peakX}
                        cy={peakY}
                        r={3.5}
                        fill={s.token}
                        stroke="var(--color-bg-card)"
                        strokeWidth={1.5}
                      >
                        <title>{`${s.name}: Đỉnh ${s.samples[s.peakIndex].toLocaleString('vi-VN')}m`}</title>
                      </circle>
                    </g>
                  );
                })}

                {/* Hover Crosshair & Active Curve Dots */}
                {hoverIdx !== null && (
                  <g pointerEvents="none">
                    <line
                      x1={xAt(hoverIdx)}
                      x2={xAt(hoverIdx)}
                      y1={padT}
                      y2={padT + plotH}
                      stroke="var(--color-text-muted)"
                      strokeWidth={1.1}
                      strokeDasharray="3 3"
                    />
                    {elevationSeries.map((s) => (
                      <circle
                        key={`hover-dot-${s.trailId}`}
                        cx={xAt(hoverIdx)}
                        cy={yAt(s.samples[hoverIdx])}
                        r={4.5}
                        fill={s.token}
                        stroke="var(--color-bg-card)"
                        strokeWidth={2}
                      />
                    ))}
                  </g>
                )}
              </svg>
            </div>
          </div>

          {/* Wave 10D: Live 3-Day Summit Weather Comparison Matrix */}
          <div
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: '14px 16px',
              marginBottom: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-sky)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                </svg>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)', letterSpacing: '0.02em' }}>
                  Dự Báo Thời Tiết Đỉnh 3 Ngày Trực Tiếp (Hiệu Chỉnh Cao Độ -6,5°C/1.000m)
                </span>
              </div>

              {weatherState.key === trailIdsKey && !isWeatherError && weatherState.entries.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {weatherState.bestWeatherTrailId && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        color: 'var(--color-primary)',
                        background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
                        border: '1px solid var(--color-border-glow)',
                        borderRadius: 4,
                        padding: '2px 8px',
                      }}
                    >
                      Thời tiết đẹp nhất: {weatherByTrailId.get(weatherState.bestWeatherTrailId)?.name || '—'}
                    </span>
                  )}
                  {weatherState.bestCloudTrailId && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        color: 'var(--color-sky)',
                        background: 'color-mix(in srgb, var(--color-sky) 14%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--color-sky) 40%, transparent)',
                        borderRadius: 4,
                        padding: '2px 8px',
                      }}
                    >
                      Săn mây tốt nhất: {weatherByTrailId.get(weatherState.bestCloudTrailId)?.name || '—'}
                    </span>
                  )}
                </div>
              )}
            </div>

            {isWeatherLoading ? (
              <div style={{ overflowX: 'auto' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${visibleTrails.length}, minmax(210px, 1fr))`,
                    gap: 10,
                    minWidth: visibleTrails.length > 1 ? visibleTrails.length * 220 : 'auto',
                  }}
                >
                  {visibleTrails.map((t) => (
                    <div
                      key={`wx-skel-${t.id}`}
                      style={{
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 4,
                        padding: 12,
                        fontSize: '0.76rem',
                        color: 'var(--color-text-dim)',
                      }}
                    >
                      Đang tải khí tượng đỉnh 3 ngày cho {t.name}...
                    </div>
                  ))}
                </div>
              </div>
            ) : isWeatherError || weatherDates.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 4,
                  background: 'var(--color-bg-card)',
                  border: '1px dashed var(--color-border-strong)',
                  fontSize: '0.78rem',
                  color: 'var(--color-text-muted)',
                }}
              >
                <span>Không thể tải dự báo thời tiết đỉnh 3 ngày lúc này (mất kết nối hoặc Open-Meteo đang bận).</span>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setWeatherState((prev) => ({ ...prev, key: '' }));
                    setWeatherRetryTick((n) => n + 1);
                  }}
                  style={{ padding: '4px 10px', fontSize: '0.74rem', borderRadius: 4 }}
                >
                  Thử tải lại
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${visibleTrails.length}, minmax(230px, 1fr))`,
                    gap: 12,
                    minWidth: visibleTrails.length > 1 ? visibleTrails.length * 240 : 'auto',
                  }}
                >
                  {visibleTrails.map((t, idx) => {
                    const wx = weatherByTrailId.get(t.id);
                    const isBestWeather = weatherState.bestWeatherTrailId === t.id && visibleTrails.length > 1;
                    const accentToken = SERIES_TOKENS[idx % SERIES_TOKENS.length];

                    return (
                      <div
                        key={`wx-col-${t.id}`}
                        style={{
                          background: isBestWeather
                            ? 'color-mix(in srgb, var(--color-primary) 7%, var(--color-bg-card))'
                            : 'var(--color-bg-card)',
                          border: isBestWeather
                            ? '1px solid var(--color-border-glow)'
                            : '1px solid var(--color-border)',
                          borderTop: `2px solid ${accentToken}`,
                          borderRadius: 4,
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <strong style={{ fontSize: '0.8rem', color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.name}
                          </strong>
                          {isBestWeather && (
                            <span
                              style={{
                                fontSize: '0.64rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                padding: '1px 6px',
                                borderRadius: 3,
                                background: 'var(--color-primary)',
                                color: 'var(--color-on-primary)',
                                flexShrink: 0,
                              }}
                            >
                              Tốt nhất
                            </span>
                          )}
                        </div>

                        {wx && Array.isArray(wx.days) && wx.days.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {wx.days.slice(0, 3).map((day) => {
                              const tierInfo = formatWeatherTierLabel(day.weatherTier);
                              return (
                                <div
                                  key={`${t.id}-${day.date}`}
                                  style={{
                                    background: 'var(--color-bg-main)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 4,
                                    padding: '7px 9px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 4,
                                    fontSize: '0.72rem',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                    <span style={{ fontWeight: 800, color: 'var(--color-text-main)' }}>
                                      {formatVnForecastDate(day.date)}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '0.66rem',
                                        fontWeight: 800,
                                        color: tierInfo.color,
                                      }}
                                    >
                                      {day.conditionLabel ? `${day.conditionLabel} · ${tierInfo.label}` : tierInfo.label}
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                                    <span>Đỉnh: <strong style={{ color: 'var(--color-text-main)' }}>{day.summitTempMinC}°–{day.summitTempMaxC}°C</strong></span>
                                    <span style={{ color: day.windChillC <= 5 ? 'var(--color-sky)' : 'var(--color-text-dim)' }}>
                                      Lạnh gió {day.windChillC}°C
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--color-text-dim)' }}>
                                    <span style={{ color: day.precipMm >= 10 ? 'var(--color-error-text, var(--color-error))' : day.precipMm >= 2 ? 'var(--color-sun)' : 'var(--color-text-muted)' }}>
                                      Mưa: <strong>{day.precipMm}mm</strong>
                                    </span>
                                    <span>Gió: <strong style={{ color: 'var(--color-text-main)' }}>{day.windSpeedKmH} km/h</strong></span>
                                  </div>

                                  {/* Pure SVG Sea-of-Clouds micro bar */}
                                  {(() => {
                                    const cloudPct = Math.max(0, Math.min(100, Number(day.seaOfCloudsPercent) || 0));
                                    return (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                                        <span style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)', minWidth: 52 }}>
                                          Mây {cloudPct}%
                                        </span>
                                        <svg
                                          viewBox="0 0 100 6"
                                          preserveAspectRatio="none"
                                          aria-hidden="true"
                                          style={{ flex: 1, height: 5, display: 'block', borderRadius: 2, overflow: 'hidden' }}
                                        >
                                          <rect x="0" y="0" width="100" height="6" fill="var(--color-surface-elevated)" />
                                          <rect
                                            x="0"
                                            y="0"
                                            width={cloudPct}
                                            height="6"
                                            fill={cloudPct >= 70 ? 'var(--color-sky)' : 'var(--color-primary)'}
                                          />
                                        </svg>
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)', padding: '8px 0' }}>
                            Chưa có dữ liệu khí tượng cho cung này.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Side-by-Side Comparison Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${visibleTrails.length}, minmax(250px, 1fr))`,
              gap: 16,
              alignItems: 'stretch',
              minWidth: visibleTrails.length > 1 ? visibleTrails.length * 260 : 'auto',
            }}
          >
            {visibleTrails.map((t, idx) => {
              const accentToken = SERIES_TOKENS[idx % SERIES_TOKENS.length];
              return (
                <div
                  key={t.id}
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    borderTop: `3px solid ${accentToken}`,
                    borderRadius: 6,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    position: 'relative',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onRemoveTrail(t.id)}
                    title="Bỏ khỏi so sánh"
                    aria-label={`Bỏ ${t.name} khỏi so sánh`}
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      zIndex: 4,
                      background: 'var(--color-bg-card)',
                      border: '1px solid color-mix(in srgb, var(--color-error) 45%, transparent)',
                      color: 'var(--color-error-text, var(--color-error))',
                      borderRadius: 4,
                      width: 26,
                      height: 26,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>

                  {/* Trail Cover Image */}
                  <div style={{ height: 128, position: 'relative', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                    <OptimizedImage
                      src={t.coverImage}
                      alt={t.name}
                      targetWidth={520}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        background: 'var(--color-bg-hud)',
                        padding: '2px 8px',
                        borderRadius: 4,
                        border: '1px solid var(--color-border)',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: 'var(--color-sky)',
                      }}
                    >
                      {t.province}
                    </div>
                  </div>

                  {/* Trail Name & Region */}
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1.3 }}>
                      {t.name}
                    </h4>
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)', marginTop: 3 }}>
                      {t.region} · {t.district}
                    </div>
                  </div>

                  {/* Technical Specs Comparison */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      background: 'var(--color-bg-card)',
                      padding: '12px 14px',
                      borderRadius: 4,
                      fontSize: '0.82rem',
                      border: '1px solid var(--color-border)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m8 3 4 8 5-5 5 15H2L8 3z" /></svg>
                        <span>Độ cao đỉnh:</span>
                      </span>
                      <strong style={{ color: 'var(--color-sun)' }}>{t.maxAltitudeM.toLocaleString('vi-VN')}m</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l-3-3Z" /></svg>
                        <span>Chiều dài:</span>
                      </span>
                      <strong style={{ color: 'var(--color-primary)' }}>{t.distanceKm} km</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                        <span>Tích lũy cao độ:</span>
                      </span>
                      <strong style={{ color: 'var(--color-earth)' }}>+{t.elevationGainM.toLocaleString('vi-VN')}m</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        <span>Thời gian:</span>
                      </span>
                      <strong>{t.durationDays} ngày</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--color-text-dim)' }}>Mức độ khó:</span>
                      <strong style={{ color: t.difficultyLevel >= 4 ? 'var(--color-error-text, var(--color-error))' : 'var(--color-primary)' }}>
                        {t.difficultyLevel}/5
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--color-sun)" stroke="var(--color-sun)" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                        <span>Đánh giá:</span>
                      </span>
                      <strong style={{ color: 'var(--color-sun)' }}>
                        {t.reviewCount > 0 ? `${t.rating} (${t.reviewCount})` : 'Chưa có đánh giá'}
                      </strong>
                    </div>
                  </div>

                  {/* Amenities / Infrastructure */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      fontSize: '0.78rem',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: t.hasCampsite ? 'var(--color-primary)' : 'var(--color-error-text, var(--color-error))', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {t.hasCampsite ? (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            <span>Có điểm cắm trại / Lán</span>
                          </>
                        ) : (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            <span>Chưa có lán trại</span>
                          </>
                        )}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: t.hasWaterSource ? 'var(--color-sky)' : 'var(--color-sun)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {t.hasWaterSource ? (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            <span>Có suối &amp; nguồn nước</span>
                          </>
                        ) : (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                            <span>Cần tự mang đủ nước</span>
                          </>
                        )}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>
                        Mùa đẹp:{' '}
                        <strong style={{ color: 'var(--color-text-main)' }}>
                          {t.bestMonths && t.bestMonths.length > 0 ? `Tháng ${t.bestMonths.join(', ')}` : 'Quanh năm'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Action button */}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      onClose();
                      onSelectTrail(t);
                    }}
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      fontWeight: 800,
                      marginTop: 'auto',
                      padding: '8px 12px',
                      fontSize: '0.82rem',
                      borderRadius: 4,
                    }}
                  >
                    <span>Xem Chi Tiết Cung Này</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
