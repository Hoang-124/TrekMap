import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Trail } from '../../types.js';
import {
  fetchTrailClimateNormals,
  type TrailClimateMonth,
  type TrailClimateResponse,
} from '../../services/api.js';
import {
  IconAlertTriangle,
  IconCalendar,
  IconCloud,
  IconDroplet,
  IconMountain,
  IconRotateCw,
  IconSun,
} from '../common/SvgIcons.js';

export interface SummitClimateChartProps {
  trail: Pick<Trail, 'id' | 'name' | 'province' | 'maxAltitudeM' | 'bestMonths' | 'avoidMonths'>;
  selectedMonth?: number;
  onSelectMonth?: (month: number) => void;
  compact?: boolean;
}

const CLIENT_CLIMATE_CACHE_TTL_MS = 10 * 60 * 1000;
const CLIENT_CLIMATE_CACHE_MAX = 40;
const clientClimateCache = new Map<string, { storedAtMs: number; response: TrailClimateResponse }>();

function peekClimateCache(trailId: string): TrailClimateResponse | null {
  const entry = clientClimateCache.get(trailId);
  return entry ? entry.response : null;
}

function readFreshClimateCacheLru(trailId: string): TrailClimateResponse | null {
  const now = Date.now();
  const entry = clientClimateCache.get(trailId);
  if (!entry) return null;
  if (now - entry.storedAtMs >= CLIENT_CLIMATE_CACHE_TTL_MS) {
    clientClimateCache.delete(trailId);
    return null;
  }
  // Touch LRU order
  clientClimateCache.delete(trailId);
  clientClimateCache.set(trailId, entry);
  return entry.response;
}

function writeClimateCacheLru(trailId: string, response: TrailClimateResponse): void {
  const now = Date.now();
  // Purge expired entries before LRU eviction
  for (const [key, val] of clientClimateCache.entries()) {
    if (now - val.storedAtMs >= CLIENT_CLIMATE_CACHE_TTL_MS) {
      clientClimateCache.delete(key);
    }
  }
  if (clientClimateCache.has(trailId)) {
    clientClimateCache.delete(trailId);
  } else if (clientClimateCache.size >= CLIENT_CLIMATE_CACHE_MAX) {
    const oldestKey = clientClimateCache.keys().next().value;
    if (oldestKey) clientClimateCache.delete(oldestKey);
  }
  clientClimateCache.set(trailId, { storedAtMs: now, response });
}

function getCurrentVietnamMonth(): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      month: 'numeric',
    }).formatToParts(new Date());
    const monthVal = Number(parts.find((p) => p.type === 'month')?.value);
    if (Number.isFinite(monthVal) && monthVal >= 1 && monthVal <= 12) return monthVal;
  } catch {
    // Fallback to local clock
  }
  return new Date().getMonth() + 1;
}

function formatFetchedTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getScoreVerdict(score: number): {
  label: string;
  accent: string;
  textColor: string;
  note: string;
} {
  if (score >= 70) {
    return {
      label: 'Mùa lý tưởng',
      accent: 'var(--color-primary)',
      textColor: 'var(--color-text-main)',
      note: 'Mưa ít, nền nhiệt ổn định — thuận lợi nhất để lên đỉnh và săn mây.',
    };
  }
  if (score >= 45) {
    return {
      label: 'Giao mùa / Cân nhắc',
      accent: 'var(--color-sun)',
      textColor: 'var(--color-text-main)',
      note: 'Có thể xuất hiện mưa rào cục bộ hoặc rét sâu về đêm — cần theo dõi dự báo 7 ngày.',
    };
  }
  return {
    label: 'Mưa nhiều / Hạn chế',
    accent: 'var(--color-error)',
    textColor: 'var(--color-error-text, var(--color-error))',
    note: 'Lượng mưa trung bình cao, nguy cơ trơn trượt, vắt rừng và sạt lở — cân nhắc dời lịch.',
  };
}

export const SummitClimateChart: React.FC<SummitClimateChartProps> = ({
  trail,
  selectedMonth,
  onSelectMonth,
  compact = false,
}) => {
  const reactUid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tempBandGradientId = `climate-temp-band-${reactUid}`;

  const defaultMonth =
    typeof selectedMonth === 'number' && selectedMonth >= 1 && selectedMonth <= 12
      ? selectedMonth
      : getCurrentVietnamMonth();

  const [trackedTrailId, setTrackedTrailId] = useState<string>(trail.id);
  const [trackedPropMonth, setTrackedPropMonth] = useState<number | undefined>(selectedMonth);
  const [activeMonth, setActiveMonth] = useState<number>(defaultMonth);
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const [focusedSvgMonth, setFocusedSvgMonth] = useState<number | null>(null);
  const [reloadTick, setReloadTick] = useState<number>(0);

  const [fetchState, setFetchState] = useState<{
    key: string;
    data: TrailClimateResponse | null;
    offline: boolean;
    error: string | null;
    refreshError: string | null;
  }>(() => {
    const cached = readFreshClimateCacheLru(trail.id);
    if (cached) {
      return {
        key: `${trail.id}:0`,
        data: cached,
        offline: false,
        error: null,
        refreshError: null,
      };
    }
    return {
      key: '',
      data: null,
      offline: false,
      error: null,
      refreshError: null,
    };
  });

  // Sync activeMonth, reset hover/reload & hydrate cached trail synchronously during render (zero skeleton flash)
  if (trackedTrailId !== trail.id) {
    setTrackedTrailId(trail.id);
    setHoveredMonth(null);
    setFocusedSvgMonth(null);
    setReloadTick(0);
    if (typeof selectedMonth === 'number' && selectedMonth >= 1 && selectedMonth <= 12) {
      setActiveMonth(selectedMonth);
    }
    const cachedHit = peekClimateCache(trail.id);
    if (cachedHit) {
      setFetchState({
        key: `${trail.id}:0`,
        data: cachedHit,
        offline: false,
        error: null,
        refreshError: null,
      });
    } else {
      setFetchState({
        key: '',
        data: null,
        offline: false,
        error: null,
        refreshError: null,
      });
    }
  }
  if (selectedMonth !== trackedPropMonth) {
    setTrackedPropMonth(selectedMonth);
    if (typeof selectedMonth === 'number' && selectedMonth >= 1 && selectedMonth <= 12) {
      setActiveMonth(selectedMonth);
    }
  }

  const requestKey = `${trail.id}:${reloadTick}`;
  const isMountedRef = useRef<boolean>(true);
  const activeTrailIdRef = useRef<string>(trail.id);
  const svgColumnRefs = useRef<Map<number, SVGGElement | null>>(new Map());

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    activeTrailIdRef.current = trail.id;
    const capturedKey = requestKey;
    const capturedTrailId = trail.id;

    // On normal mount/switch, validate TTL & LRU touch; if still fresh, skip redundant network call
    if (reloadTick === 0) {
      const freshCached = readFreshClimateCacheLru(capturedTrailId);
      if (freshCached) {
        return;
      }
    }

    const controller = new AbortController();
    fetchTrailClimateNormals(capturedTrailId, controller.signal)
      .then((res) => {
        if (
          controller.signal.aborted ||
          !isMountedRef.current ||
          activeTrailIdRef.current !== capturedTrailId
        ) {
          return;
        }
        if (res.success && res.months.length > 0) {
          writeClimateCacheLru(capturedTrailId, res);
          setFetchState({
            key: capturedKey,
            data: res,
            offline: false,
            error: null,
            refreshError: null,
          });
        } else {
          const errMsg = res.error || 'Chưa tải được dữ liệu khí hậu NASA POWER (MERRA-2) cho tuyến này.';
          setFetchState((prev) => {
            const hasValidCurrent =
              prev.key.startsWith(`${capturedTrailId}:`) &&
              prev.data !== null &&
              prev.data.months.length > 0;
            if (hasValidCurrent) {
              return {
                ...prev,
                key: capturedKey,
                offline: Boolean(res.offline),
                refreshError: errMsg,
              };
            }
            return {
              key: capturedKey,
              data: null,
              offline: Boolean(res.offline),
              error: errMsg,
              refreshError: null,
            };
          });
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!isMountedRef.current || activeTrailIdRef.current !== capturedTrailId) return;
        const offlineMsg = 'Không thể kết nối máy chủ khí hậu NASA POWER (MERRA-2) lúc này (ngoại tuyến).';
        setFetchState((prev) => {
          const hasValidCurrent =
            prev.key.startsWith(`${capturedTrailId}:`) &&
            prev.data !== null &&
            prev.data.months.length > 0;
          if (hasValidCurrent) {
            return {
              ...prev,
              key: capturedKey,
              offline: true,
              refreshError: offlineMsg,
            };
          }
          return {
            key: capturedKey,
            data: null,
            offline: true,
            error: offlineMsg,
            refreshError: null,
          };
        });
      });

    return () => controller.abort();
  }, [requestKey, trail.id, reloadTick]);

  const isLoading = fetchState.key !== requestKey;
  const isCurrentTrailData =
    fetchState.key.startsWith(`${trail.id}:`) &&
    fetchState.data !== null &&
    fetchState.data.months.length > 0;
  const climateData = isCurrentTrailData ? fetchState.data : null;

  const months = useMemo<TrailClimateMonth[]>(() => {
    if (!climateData) return [];
    return climateData.months;
  }, [climateData]);

  const focusedMonthNum = hoveredMonth ?? activeMonth;
  const focusedMonthData = useMemo<TrailClimateMonth | null>(() => {
    if (months.length === 0) return null;
    return months.find((m) => m.month === focusedMonthNum) || months[0];
  }, [months, focusedMonthNum]);

  const effectiveActiveMonth = useMemo<number>(() => {
    if (months.length === 0) return activeMonth;
    return months.some((m) => m.month === activeMonth) ? activeMonth : months[0].month;
  }, [months, activeMonth]);

  const annualInsights = useMemo(() => {
    if (months.length === 0) return null;
    const byScore = [...months].sort((a, b) => b.bestScore - a.bestScore || a.avgRainMm - b.avgRainMm);
    const bestTop3 = byScore
      .slice(0, 3)
      .map((m) => m.month)
      .sort((a, b) => a - b);
    const wettest = [...months].sort((a, b) => b.avgRainMm - a.avgRainMm)[0];
    const coldest = [...months].sort((a, b) => a.avgTempMinC - b.avgTempMinC)[0];
    return { bestTop3, wettest, coldest };
  }, [months]);

  // Dual-axis SVG geometry (640 x 248 viewBox, responsive horizontal scroll on 375px)
  const chartGeometry = useMemo(() => {
    if (months.length === 0) return null;
    const width = 640;
    const height = 248;
    const padLeft = 44;
    const padRight = 48;
    const padTop = 22;
    const padBottom = 38;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const baseY = padTop + plotH;

    const rawMinTemp = Math.min(...months.map((m) => m.avgTempMinC));
    const rawMaxTemp = Math.max(...months.map((m) => m.avgTempMaxC));
    const minTemp = Math.floor((rawMinTemp - 3) / 5) * 5;
    const maxTemp = Math.max(minTemp + 15, Math.ceil((rawMaxTemp + 3) / 5) * 5);

    const rawMaxRain = Math.max(...months.map((m) => m.avgRainMm), 0);
    const rainStep = rawMaxRain > 400 ? 150 : rawMaxRain > 200 ? 100 : 50;
    const maxRain = Math.max(200, Math.ceil((rawMaxRain * 1.12) / rainStep) * rainStep);

    const yForTemp = (tempC: number) => {
      const ratio = (tempC - minTemp) / Math.max(1, maxTemp - minTemp);
      return baseY - ratio * plotH;
    };
    const yForRain = (rainMm: number) => {
      const ratio = Math.max(0, rainMm) / Math.max(1, maxRain);
      return baseY - ratio * plotH;
    };

    const tempTicks: number[] = [];
    const tickCount = 4;
    for (let i = 0; i <= tickCount; i += 1) {
      const val = minTemp + ((maxTemp - minTemp) * i) / tickCount;
      tempTicks.push(Math.round(val));
    }

    const rainTicks = [0, Math.round(maxRain * 0.5), maxRain];
    const slotW = plotW / 12;
    const barW = Math.min(22, slotW * 0.54);

    const points = months.map((m) => {
      const slotIdx = Math.max(0, Math.min(11, m.month - 1));
      const cx = padLeft + slotIdx * slotW + slotW / 2;
      const yMax = yForTemp(m.avgTempMaxC);
      const yMin = yForTemp(m.avgTempMinC);
      const yRain = yForRain(m.avgRainMm);
      const rainBarH = m.avgRainMm > 0 ? Math.max(2, baseY - yRain) : 0;
      const barY = baseY - rainBarH;
      return {
        ...m,
        cx,
        slotX: padLeft + slotIdx * slotW,
        barX: cx - barW / 2,
        barW,
        yMax,
        yMin,
        barY,
        rainBarH,
      };
    });

    const maxLinePoints = points.map((p) => `${p.cx.toFixed(1)},${p.yMax.toFixed(1)}`).join(' ');
    const minLinePoints = points.map((p) => `${p.cx.toFixed(1)},${p.yMin.toFixed(1)}`).join(' ');
    const bandPolygon = [
      ...points.map((p) => `${p.cx.toFixed(1)},${p.yMax.toFixed(1)}`),
      ...[...points].reverse().map((p) => `${p.cx.toFixed(1)},${p.yMin.toFixed(1)}`),
    ].join(' ');

    // Only draw 0°C frost reference line when domain strictly straddles freezing (never colliding with baseline)
    const zeroLineY = minTemp < 0 && maxTemp > 0 ? yForTemp(0) : null;

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotW,
      plotH,
      baseY,
      slotW,
      tempTicks,
      rainTicks,
      yForTemp,
      yForRain,
      points,
      maxLinePoints,
      minLinePoints,
      bandPolygon,
      zeroLineY,
    };
  }, [months]);

  const handleSelectMonth = (month: number) => {
    setActiveMonth(month);
    onSelectMonth?.(month);
  };

  const handleColumnKeyDown = (e: React.KeyboardEvent, month: number) => {
    if (!chartGeometry || chartGeometry.points.length === 0) return;
    const pts = chartGeometry.points;
    const currentIdx = pts.findIndex((p) => p.month === month);
    if (currentIdx === -1) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelectMonth(month);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const target = pts[(currentIdx + 1) % pts.length];
      setHoveredMonth(null);
      handleSelectMonth(target.month);
      svgColumnRefs.current.get(target.month)?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const target = pts[(currentIdx - 1 + pts.length) % pts.length];
      setHoveredMonth(null);
      handleSelectMonth(target.month);
      svgColumnRefs.current.get(target.month)?.focus();
    }
  };

  const displayAltitudeM =
    climateData && climateData.maxAltitudeM > 0 ? climateData.maxAltitudeM : trail.maxAltitudeM;
  const periodLabel = climateData?.period || '3 năm gần nhất';

  return (
    <section
      aria-label={`Biểu đồ khí hậu thực đo 12 tháng (NASA POWER MERRA-2) trên đỉnh ${trail.name}`}
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-strong)',
        borderTop: '3px solid var(--color-sky)',
        borderRadius: 6,
        padding: compact ? '14px 15px' : '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        fontFamily: 'var(--font-family)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'color-mix(in srgb, var(--color-sky) 8%, var(--color-bg-card))',
                border: '1px solid color-mix(in srgb, var(--color-sky) 40%, var(--color-border))',
                color: 'var(--color-text-main)',
                fontSize: '0.67rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <IconCloud size={12} color="var(--color-sky)" />
              <span>Khí Hậu Lịch Sử {climateData?.period || '3 Năm'} · NASA POWER (MERRA-2)</span>
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.72rem',
                fontWeight: 700,
                color: 'var(--color-text-dim)',
              }}
            >
              <IconMountain size={12} color="var(--color-primary)" />
              <span>
                Đỉnh {displayAltitudeM.toLocaleString('vi-VN')}m
                {typeof climateData?.lapseDropC === 'number' && climateData.lapseDropC !== 0
                  ? ` (${climateData.lapseDropC > 0 ? '+' : ''}${climateData.lapseDropC.toFixed(1)}°C)`
                  : ''}
              </span>
            </span>
          </div>
          <h4
            style={{
              margin: 0,
              fontSize: compact ? '0.96rem' : '1.06rem',
              fontWeight: 800,
              color: 'var(--color-text-main)',
              lineHeight: 1.3,
            }}
          >
            Nhiệt Độ Đỉnh &amp; Lượng Mưa 12 Tháng — {trail.name}
          </h4>
        </div>

        <button
          type="button"
          className="btn btn-outline"
          disabled={isLoading}
          onClick={() => setReloadTick((n) => n + 1)}
          aria-label={`Tải lại dữ liệu khí hậu NASA POWER cho ${trail.name}`}
          style={{
            padding: '5px 10px',
            fontSize: '0.73rem',
            borderRadius: 4,
            opacity: isLoading ? 0.65 : 1,
          }}
        >
          <IconRotateCw size={12} />
          <span>{isLoading ? 'Đang tải...' : 'Làm mới'}</span>
        </button>
      </div>

      {/* Non-destructive Refresh Error Banner (preserves last valid real NASA POWER chart on transient 503/offline) */}
      {climateData && fetchState.refreshError && (
        <div
          role="alert"
          style={{
            padding: '8px 12px',
            borderRadius: 4,
            background: 'color-mix(in srgb, var(--color-error) 8%, var(--color-bg-card))',
            border: '1px solid color-mix(in srgb, var(--color-error) 35%, var(--color-border))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            fontSize: '0.75rem',
            color: 'var(--color-error-text, var(--color-error))',
            fontWeight: 600,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconAlertTriangle size={14} color="var(--color-error-text, var(--color-error))" />
            <span>{fetchState.refreshError} Đang giữ bản thực đo gần nhất.</span>
          </span>
          <button
            type="button"
            className="btn btn-outline"
            disabled={isLoading}
            onClick={() => setReloadTick((n) => n + 1)}
            style={{ padding: '4px 9px', fontSize: '0.71rem', borderRadius: 4 }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Body: Loading / Error / Chart */}
      {isLoading && !climateData ? (
        <div
          style={{
            padding: '28px 16px',
            borderRadius: 6,
            background: 'var(--color-bg-main)',
            border: '1px dashed var(--color-border-strong)',
            textAlign: 'center',
            fontSize: '0.82rem',
            color: 'var(--color-text-muted)',
          }}
        >
          Đang tổng hợp dữ liệu khí hậu thực đo 3 năm (NASA POWER MERRA-2) và tính mức giảm nhiệt -6,5°C/1.000m cho đỉnh {trail.name}...
        </div>
      ) : !climateData || !chartGeometry || !focusedMonthData ? (
        <div
          role="alert"
          style={{
            padding: '16px 16px',
            borderRadius: 6,
            background: 'color-mix(in srgb, var(--color-error) 8%, var(--color-bg-card))',
            border: '1px solid color-mix(in srgb, var(--color-error) 35%, var(--color-border))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <IconAlertTriangle size={16} color="var(--color-error-text, var(--color-error))" />
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--color-error-text, var(--color-error))',
                lineHeight: 1.45,
              }}
            >
              {fetchState.error ||
                'Chưa thể tải dữ liệu khí hậu thực đo NASA POWER (MERRA-2) từ máy chủ lúc này. Dữ liệu thật không được mô phỏng khi ngoại tuyến.'}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setReloadTick((n) => n + 1)}
            style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: 4, flexShrink: 0 }}
          >
            Thử tải lại
          </button>
        </div>
      ) : (
        <>
          {/* Pure-SVG Dual-Axis Chart (horizontally scrollable on 375px for crisp axis legibility) */}
          <div
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: '10px 8px 6px',
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
              <svg
                viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
                width="100%"
                role="group"
                aria-label={`Biểu đồ nhiệt độ đỉnh và lượng mưa trung bình 12 tháng của ${trail.name}`}
                style={{ display: 'block', width: '100%', minWidth: 440, height: 'auto' }}
              >
                <defs>
                  <linearGradient id={tempBandGradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-earth)" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="var(--color-sun)" stopOpacity="0.1" />
                  </linearGradient>
                </defs>

                {/* Axis Unit Titles */}
                <text
                  x={chartGeometry.padLeft - 6}
                  y={13}
                  textAnchor="end"
                  fontSize="10"
                  fontWeight="700"
                  fill="var(--color-text-dim)"
                >
                  °C
                </text>
                <text
                  x={chartGeometry.width - chartGeometry.padRight + 6}
                  y={13}
                  textAnchor="start"
                  fontSize="10"
                  fontWeight="700"
                  fill="var(--color-sky)"
                >
                  mm
                </text>

                {/* Horizontal Gridlines & Left Temperature Axis Labels */}
                {chartGeometry.tempTicks.map((tempVal) => {
                  const y = chartGeometry.yForTemp(tempVal);
                  return (
                    <g key={`temp-tick-${tempVal}`}>
                      <line
                        x1={chartGeometry.padLeft}
                        y1={y}
                        x2={chartGeometry.width - chartGeometry.padRight}
                        y2={y}
                        stroke="var(--color-border)"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={chartGeometry.padLeft - 6}
                        y={y + 3.5}
                        textAnchor="end"
                        fontSize="10.5"
                        fontWeight="600"
                        fill="var(--color-text-dim)"
                      >
                        {tempVal}°
                      </text>
                    </g>
                  );
                })}

                {/* Right Rainfall Axis Labels */}
                {chartGeometry.rainTicks.map((rainVal) => {
                  const y = chartGeometry.yForRain(rainVal);
                  return (
                    <text
                      key={`rain-tick-${rainVal}`}
                      x={chartGeometry.width - chartGeometry.padRight + 6}
                      y={y + 3.5}
                      textAnchor="start"
                      fontSize="10.5"
                      fontWeight="600"
                      fill="var(--color-sky)"
                    >
                      {rainVal}
                    </text>
                  );
                })}

                {/* 0°C Frost Reference Line (strictly when minTemp < 0 < maxTemp, clearly labeled) */}
                {chartGeometry.zeroLineY !== null && (
                  <g>
                    <line
                      x1={chartGeometry.padLeft}
                      y1={chartGeometry.zeroLineY}
                      x2={chartGeometry.width - chartGeometry.padRight}
                      y2={chartGeometry.zeroLineY}
                      stroke="var(--color-text-dim)"
                      strokeWidth="1.2"
                      strokeDasharray="4 3"
                    />
                    <text
                      x={chartGeometry.padLeft + 4}
                      y={chartGeometry.zeroLineY - 3.5}
                      textAnchor="start"
                      fontSize="9.5"
                      fontWeight="800"
                      fill="var(--color-text-main)"
                    >
                      0°C (Băng giá)
                    </text>
                  </g>
                )}

                {/* Focused Month Column Highlight Band + Visible Keyboard Focus Ring */}
                {chartGeometry.points.map((pt) => {
                  const isVisualFocus = pt.month === focusedMonthNum;
                  const isKeyboardFocus = pt.month === focusedSvgMonth;
                  if (!isVisualFocus && !isKeyboardFocus) return null;
                  return (
                    <rect
                      key={`focus-band-${pt.month}`}
                      x={pt.slotX + 2}
                      y={chartGeometry.padTop - 2}
                      width={Math.max(4, chartGeometry.slotW - 4)}
                      height={chartGeometry.plotH + 4}
                      rx={3}
                      fill="color-mix(in srgb, var(--color-primary) 10%, transparent)"
                      stroke={isKeyboardFocus ? 'var(--color-text-main)' : 'var(--color-primary)'}
                      strokeWidth={isKeyboardFocus ? '1.8' : '1'}
                      strokeDasharray={isKeyboardFocus ? '3 2' : undefined}
                      strokeOpacity={isKeyboardFocus ? '0.95' : '0.55'}
                    />
                  );
                })}

                {/* Monthly Rainfall Bars (strictly anchored on baseY, zero protrusion below axis) */}
                {chartGeometry.points.map((pt) => {
                  if (pt.rainBarH <= 0) return null;
                  const isFocused = pt.month === focusedMonthNum;
                  return (
                    <rect
                      key={`rain-bar-${pt.month}`}
                      x={pt.barX}
                      y={pt.barY}
                      width={pt.barW}
                      height={pt.rainBarH}
                      rx={1.5}
                      fill="var(--color-sky)"
                      fillOpacity={isFocused ? 0.56 : 0.26}
                      stroke="var(--color-sky)"
                      strokeWidth={isFocused ? 1.2 : 0.6}
                      strokeOpacity={isFocused ? 0.9 : 0.45}
                    />
                  );
                })}

                {/* Summit Temperature Min-Max Band & Lines */}
                <polygon points={chartGeometry.bandPolygon} fill={`url(#${tempBandGradientId})`} />
                <polyline
                  points={chartGeometry.maxLinePoints}
                  fill="none"
                  stroke="var(--color-earth)"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <polyline
                  points={chartGeometry.minLinePoints}
                  fill="none"
                  stroke="var(--color-sun)"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Temperature Vertices */}
                {chartGeometry.points.map((pt) => {
                  const isFocused = pt.month === focusedMonthNum;
                  return (
                    <g key={`temp-dots-${pt.month}`}>
                      <circle
                        cx={pt.cx}
                        cy={pt.yMax}
                        r={isFocused ? 4.5 : 2.8}
                        fill="var(--color-earth)"
                        stroke="var(--color-bg-card)"
                        strokeWidth={isFocused ? 1.5 : 1}
                      />
                      <circle
                        cx={pt.cx}
                        cy={pt.yMin}
                        r={isFocused ? 4.5 : 2.8}
                        fill="var(--color-sun)"
                        stroke="var(--color-bg-card)"
                        strokeWidth={isFocused ? 1.5 : 1}
                      />
                    </g>
                  );
                })}

                {/* Interactive Month Columns (Roving Tabindex + ArrowLeft/ArrowRight) */}
                {chartGeometry.points.map((pt) => {
                  const isFocused = pt.month === focusedMonthNum;
                  const isActive = pt.month === effectiveActiveMonth;
                  const dotColor =
                    pt.bestScore >= 70
                      ? 'var(--color-primary)'
                      : pt.bestScore >= 45
                      ? 'var(--color-sun)'
                      : 'var(--color-error)';
                  return (
                    <g
                      key={`col-hit-${pt.month}`}
                      ref={(el) => {
                        svgColumnRefs.current.set(pt.month, el);
                      }}
                      role="button"
                      tabIndex={isActive ? 0 : -1}
                      aria-pressed={isActive}
                      aria-label={`Tháng ${pt.month}: nhiệt độ đỉnh ${pt.avgTempMinC.toFixed(1)}°C đến ${pt.avgTempMaxC.toFixed(1)}°C, mưa ${pt.avgRainMm}mm (${pt.rainyDays.toFixed(1)} ngày mưa), điểm thuận lợi ${pt.bestScore}/100`}
                      onClick={() => handleSelectMonth(pt.month)}
                      onMouseEnter={() => setHoveredMonth(pt.month)}
                      onMouseLeave={() => setHoveredMonth(null)}
                      onFocus={() => {
                        setHoveredMonth(pt.month);
                        setFocusedSvgMonth(pt.month);
                      }}
                      onBlur={() => {
                        setHoveredMonth(null);
                        setFocusedSvgMonth(null);
                      }}
                      onKeyDown={(e) => handleColumnKeyDown(e, pt.month)}
                      style={{ cursor: 'pointer', outline: 'none' }}
                    >
                      <rect
                        x={pt.slotX}
                        y={chartGeometry.padTop - 4}
                        width={chartGeometry.slotW}
                        height={chartGeometry.plotH + chartGeometry.padBottom}
                        fill="transparent"
                      />
                      <text
                        x={pt.cx}
                        y={chartGeometry.baseY + 16}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight={isFocused ? '800' : '600'}
                        fill={isFocused ? 'var(--color-text-main)' : 'var(--color-text-muted)'}
                      >
                        T{pt.month}
                      </text>
                      <circle
                        cx={pt.cx}
                        cy={chartGeometry.baseY + 27}
                        r={isFocused ? 3.5 : 2.6}
                        fill={dotColor}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Legend Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
                padding: '6px 8px 4px',
                borderTop: '1px solid var(--color-border)',
                fontSize: '0.71rem',
                color: 'var(--color-text-muted)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 12, height: 2.5, background: 'var(--color-earth)', display: 'inline-block' }} />
                  Nhiệt độ đỉnh cao nhất (°C)
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 12, height: 0, borderTop: '2px dashed var(--color-sun)', display: 'inline-block' }} />
                  Nhiệt độ đỉnh thấp nhất (°C)
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: 'color-mix(in srgb, var(--color-sky) 45%, var(--color-bg-card))',
                      border: '1px solid var(--color-sky)',
                      display: 'inline-block',
                    }}
                  />
                  Lượng mưa tháng (mm)
                </span>
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>
                Chạm, dùng phím ←/→ hoặc di chuột vào cột tháng
              </span>
            </div>
          </div>

          {/* Interactive Month Tap Strip (balanced 6+6 grid on mobile & desktop) */}
          <div
            role="group"
            aria-label="Chọn nhanh tháng khí hậu lịch sử"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
              gap: 5,
            }}
          >
            {months.map((m) => {
              const isSelected = m.month === effectiveActiveMonth;
              const verdict = getScoreVerdict(m.bestScore);
              return (
                <button
                  key={`climate-btn-${m.month}`}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleSelectMonth(m.month)}
                  style={{
                    padding: '5px 4px',
                    borderRadius: 4,
                    fontSize: '0.72rem',
                    fontWeight: isSelected ? 800 : 600,
                    cursor: 'pointer',
                    border: isSelected
                      ? `1px solid ${verdict.accent}`
                      : '1px solid var(--color-border)',
                    background: isSelected
                      ? `color-mix(in srgb, ${verdict.accent} 10%, var(--color-bg-card))`
                      : 'var(--color-bg-main)',
                    color: isSelected ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  T{m.month}
                </button>
              );
            })}
          </div>

          {/* Focused Month Telemetry Inspector */}
          {(() => {
            const verdict = getScoreVerdict(focusedMonthData.bestScore);
            const lapseSublabel =
              typeof climateData.lapseDropC === 'number'
                ? climateData.lapseDropC === 0
                  ? `Cùng cao độ lưới MERRA-2 (${climateData.gridElevationM ?? displayAltitudeM}m)`
                  : `Đã hiệu chỉnh ${climateData.lapseDropC > 0 ? '+' : ''}${climateData.lapseDropC.toFixed(1)}°C từ lưới ${typeof climateData.gridElevationM === 'number' ? `${climateData.gridElevationM.toLocaleString('vi-VN')}m` : 'MERRA-2'} lên đỉnh`
                : 'Đã hiệu chỉnh theo cao độ đỉnh thực địa';

            const tempAdvisory =
              focusedMonthData.avgTempMinC <= 5
                ? 'Đêm đỉnh rét sâu / nguy cơ băng giá — cần túi ngủ ấm'
                : focusedMonthData.avgTempMaxC >= 30
                ? 'Nắng nóng cao điểm — mang dư nước & điện giải'
                : lapseSublabel;

            return (
              <div
                style={{
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  borderLeft: `3px solid ${verdict.accent}`,
                  borderRadius: 6,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                    <IconCalendar size={14} color="var(--color-primary)" />
                    <span>Chi Tiết Khí Hậu Thực Đo Tháng {focusedMonthData.month}</span>
                  </div>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      background: `color-mix(in srgb, ${verdict.accent} 10%, var(--color-bg-card))`,
                      border: `1px solid color-mix(in srgb, ${verdict.accent} 40%, var(--color-border))`,
                      color: verdict.textColor,
                    }}
                  >
                    <span>{verdict.label}</span>
                    <span>· {focusedMonthData.bestScore}/100</span>
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(145px, 100%), 1fr))',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 4,
                      padding: '8px 10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                      <IconSun size={11} color="var(--color-earth)" />
                      <span>Nhiệt độ đỉnh</span>
                    </div>
                    <div style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 3 }}>
                      {focusedMonthData.avgTempMinC.toFixed(1)}°C – {focusedMonthData.avgTempMaxC.toFixed(1)}°C
                    </div>
                    <div style={{ fontSize: '0.69rem', color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.35 }}>
                      {tempAdvisory}
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 4,
                      padding: '8px 10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                      <IconDroplet size={11} color="var(--color-sky)" />
                      <span>Lượng mưa tháng</span>
                    </div>
                    <div style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 3 }}>
                      {focusedMonthData.avgRainMm.toLocaleString('vi-VN')} mm
                    </div>
                    <div style={{ fontSize: '0.69rem', color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.35 }}>
                      Trung bình {focusedMonthData.rainyDays.toFixed(1)} ngày mưa / tháng
                    </div>
                  </div>

                  {annualInsights && (
                    <div
                      style={{
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 4,
                        padding: '8px 10px',
                      }}
                    >
                      <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                        Cửa sổ vàng NASA POWER
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 3 }}>
                        {annualInsights.bestTop3.map((m) => `T${m}`).join(', ')}
                      </div>
                      <div style={{ fontSize: '0.69rem', color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.35 }}>
                        Mưa lớn nhất: T{annualInsights.wettest.month} ({annualInsights.wettest.avgRainMm}mm) · Lạnh nhất: T{annualInsights.coldest.month} ({annualInsights.coldest.avgTempMinC.toFixed(1)}°C)
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                  {verdict.note}
                </div>
              </div>
            );
          })()}

          {/* Attribution Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 6,
              fontSize: '0.69rem',
              color: 'var(--color-text-dim)',
            }}
          >
            <span>
              Nguồn thực đo: NASA POWER (MERRA-2) Historical Archive ({periodLabel}
              {typeof climateData.gridElevationM === 'number'
                ? `, lưới DEM ${climateData.gridElevationM.toLocaleString('vi-VN')}m → đỉnh ${displayAltitudeM.toLocaleString('vi-VN')}m`
                : `, đỉnh ${displayAltitudeM.toLocaleString('vi-VN')}m`}
              ).
            </span>
            {climateData.fetchedAt && (
              <span>
                Đồng bộ: {formatFetchedTime(climateData.fetchedAt)}
                {climateData.cached ? ' · Bộ đệm 24h' : ''}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default SummitClimateChart;
