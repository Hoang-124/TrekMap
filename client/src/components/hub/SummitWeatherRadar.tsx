import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Trail } from '../../types.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { safeLocalStorageGet } from '../../utils/storageScope.js';
import {
  fetchLiveSummitsWeather,
  fetchMyWeatherAlerts,
  deleteWeatherAlert,
  evaluateMyWeatherAlerts,
  type LiveSummitsWeatherResponse,
  type SummitLiveTelemetry,
  type WeatherAlertSubItem,
} from '../../services/api.js';
import {
  IconBell,
  IconCloud,
  IconMountain,
  IconWind,
  IconSnowflake,
  IconAlertTriangle,
  IconSparkles,
  IconRotateCw,
  IconArrowRight,
  IconDroplet,
  IconTrash,
  IconChevronRight,
  IconCheckCircle,
  IconScale,
  IconX,
} from '../common/SvgIcons.js';
import type { WeatherAlertTrailRef } from '../weather/WeatherAlertModal.js';

const WeatherAlertModal = lazy(() =>
  import('../weather/WeatherAlertModal.js').then((m) => ({ default: m.WeatherAlertModal }))
);

export interface SummitWeatherRadarProps {
  trails: Trail[];
  onSelectTrail?: (trail: Trail) => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type RadarSortMode = 'clouds' | 'coldest' | 'wind' | 'altitude';

const CONDITION_LABELS: Record<string, string> = {
  clear: 'Quang mây',
  cloudy: 'Nhiều mây',
  foggy: 'Sương mù',
  rainy: 'Mưa núi',
  storm: 'Dông bão',
};

type ExtendedSummitTelemetry = SummitLiveTelemetry & {
  condition?: string;
  conditionLabel?: string;
};

type ExtendedSummitsResponse = LiveSummitsWeatherResponse & {
  attribution?: string;
};

interface CompareApiDay {
  date?: string;
  summitTempMinC?: number;
  summitTempMaxC?: number;
  windChillC?: number;
  precipMm?: number;
  windSpeedKmH?: number;
  humidityPercent?: number;
  condition?: string;
  conditionLabel?: string;
  seaOfCloudsPercent?: number;
  weatherTier?: 'ideal' | 'caution' | 'danger';
}

interface CompareApiItem {
  trailId: string;
  name: string;
  province: string;
  region: string;
  maxAltitudeM: number;
  gridElevationM?: number;
  lapseDropC?: number;
  weatherScore?: number;
  bestSeaOfCloudsPercent?: number;
  worstTier?: 'ideal' | 'caution' | 'danger';
  days?: CompareApiDay[];
}

interface ComparePanelState {
  source: 'api' | 'fallback';
  fetchedAt?: string;
  bestWeatherTrailId?: string | null;
  bestCloudTrailId?: string | null;
  items: CompareApiItem[];
}

function formatCompareDayVi(rawDate?: string, fallbackIdx = 0): string {
  if (rawDate) {
    const parts = rawDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
  }
  if (fallbackIdx === 0) return 'Hôm nay';
  if (fallbackIdx === 1) return 'Ngày mai';
  return `Ngày +${fallbackIdx}`;
}

function resolveConditionLabel(peak: SummitLiveTelemetry): string {
  const ext = peak as ExtendedSummitTelemetry;
  if (typeof ext.conditionLabel === 'string' && ext.conditionLabel.trim()) {
    return ext.conditionLabel.trim();
  }
  const code = ext.weatherCondition || ext.condition || '';
  return CONDITION_LABELS[code] || (code ? code : 'Đang quan trắc');
}

function mapCompareItemToTelemetry(item: CompareApiItem): SummitLiveTelemetry | null {
  const today = Array.isArray(item.days) ? item.days[0] : undefined;
  if (!today) return null;
  const tomorrow = Array.isArray(item.days) ? item.days[1] : undefined;
  const minC = Number.isFinite(Number(today.summitTempMinC)) ? Number(today.summitTempMinC) : 16;
  const maxC = Number.isFinite(Number(today.summitTempMaxC)) ? Number(today.summitTempMaxC) : minC + 4;
  const summitTempC = Math.round(((minC + maxC) / 2) * 10) / 10;
  const windChillC = Number.isFinite(Number(today.windChillC)) ? Number(today.windChillC) : summitTempC;
  const windSpeedKmH = Number.isFinite(Number(today.windSpeedKmH)) ? Math.round(Number(today.windSpeedKmH)) : 10;
  const humidityPercent = Number.isFinite(Number(today.humidityPercent)) ? Math.round(Number(today.humidityPercent)) : 75;
  const precipMm = Number.isFinite(Number(today.precipMm)) ? Number(today.precipMm) : 0;
  const seaOfCloudsPercent = Number.isFinite(Number(today.seaOfCloudsPercent))
    ? Math.round(Number(today.seaOfCloudsPercent))
    : 0;
  const weatherTier: SummitLiveTelemetry['weatherTier'] =
    today.weatherTier === 'danger' || today.weatherTier === 'caution' || today.weatherTier === 'ideal'
      ? today.weatherTier
      : 'ideal';
  const condition = today.condition || 'cloudy';
  let advisory = 'Thời tiết thuận lợi cho hành trình leo đỉnh.';
  if (weatherTier === 'danger') {
    advisory = precipMm >= 25
      ? 'Cảnh báo mưa lớn, nguy cơ lũ quét và sạt lở.'
      : windSpeedKmH >= 45
        ? `Gió giật mạnh ${windSpeedKmH} km/h trên sống núi.`
        : 'Thời tiết bất lợi — cân nhắc hoãn lịch leo đỉnh.';
  } else if (weatherTier === 'caution') {
    advisory = windChillC <= 6
      ? `Đỉnh lạnh sâu (${windChillC}°C) — chuẩn bị áo giữ ấm và chống gió.`
      : precipMm >= 5
        ? `Có mưa khoảng ${precipMm} mm — đường trơn, mang áo mưa bộ.`
        : 'Gió khá mạnh hoặc nhiều mây — kiểm tra kỹ trước khi xuất phát.';
  } else if (seaOfCloudsPercent >= 70) {
    advisory = `Khả năng gặp biển mây cao (${seaOfCloudsPercent}%).`;
  }

  const mapped: ExtendedSummitTelemetry = {
    trailId: item.trailId,
    name: item.name,
    province: item.province,
    region: item.region,
    maxAltitudeM: item.maxAltitudeM,
    gridElevationM: Number(item.gridElevationM ?? Math.round(item.maxAltitudeM * 0.65)),
    lapseDropC: Number(item.lapseDropC ?? 0),
    summitTempC,
    summitTempMinC: minC,
    summitTempMaxC: maxC,
    windChillC,
    windSpeedKmH,
    humidityPercent,
    precipMm,
    weatherCondition: condition,
    condition,
    conditionLabel: today.conditionLabel || CONDITION_LABELS[condition] || 'Đang quan trắc',
    seaOfCloudsPercent,
    tomorrowSeaOfCloudsPercent:
      typeof tomorrow?.seaOfCloudsPercent === 'number' ? Math.round(tomorrow.seaOfCloudsPercent) : undefined,
    weatherTier,
    advisory,
  };
  return mapped;
}

function getTierMeta(tier: SummitLiveTelemetry['weatherTier']) {
  if (tier === 'danger') {
    return {
      label: 'Cảnh báo',
      color: 'var(--color-error-text, var(--color-error))',
      accent: 'var(--color-error)',
      bg: 'color-mix(in srgb, var(--color-error) 14%, transparent)',
      border: 'color-mix(in srgb, var(--color-error) 38%, transparent)',
    };
  }
  if (tier === 'caution') {
    return {
      label: 'Thận trọng',
      color: 'var(--color-sun)',
      accent: 'var(--color-sun)',
      bg: 'color-mix(in srgb, var(--color-sun) 14%, transparent)',
      border: 'color-mix(in srgb, var(--color-sun) 36%, transparent)',
    };
  }
  return {
    label: 'Lý tưởng',
    color: 'var(--color-primary)',
    accent: 'var(--color-primary)',
    bg: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
    border: 'color-mix(in srgb, var(--color-primary) 36%, transparent)',
  };
}

function mergeEvaluatedAlertsIntoList(
  prev: WeatherAlertSubItem[],
  evaluated: WeatherAlertSubItem[]
): WeatherAlertSubItem[] {
  if (evaluated.length === 0) return prev;
  const byTrailId = new Map(evaluated.map((item) => [item.trailId, item]));
  const seen = new Set<string>();
  const merged = prev.map((existing) => {
    const updated = byTrailId.get(existing.trailId);
    if (updated) {
      seen.add(existing.trailId);
      return updated;
    }
    return existing;
  });
  for (const item of evaluated) {
    if (!seen.has(item.trailId)) {
      merged.unshift(item);
    }
  }
  return merged;
}

function getCloudColor(pct: number): string {
  if (pct >= 70) return 'var(--color-primary)';
  if (pct >= 45) return 'var(--color-sky)';
  if (pct >= 25) return 'var(--color-sun)';
  return 'var(--color-text-dim)';
}

/** Pure inline SVG semi-circular arc gauge for live Sea-of-Clouds % */
const CloudArcGauge: React.FC<{ percent: number }> = ({ percent }) => {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const radius = 28;
  const semiCircumference = Math.PI * radius;
  const dashOffset = semiCircumference * (1 - clamped / 100);
  const strokeColor = getCloudColor(clamped);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 76, flexShrink: 0 }}>
      <svg width="76" height="46" viewBox="0 0 76 46" aria-hidden="true">
        <path
          d="M 10 40 A 28 28 0 0 1 66 40"
          fill="none"
          stroke="var(--color-surface-elevated)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M 10 40 A 28 28 0 0 1 66 40"
          fill="none"
          stroke={strokeColor}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={semiCircumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        <text
          x="38"
          y="37"
          textAnchor="middle"
          fill="var(--color-text-main)"
          fontSize="13"
          fontWeight="800"
          style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-family)' }}
        >
          {clamped}%
        </text>
      </svg>
      <span
        style={{
          fontSize: '0.62rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--color-text-dim)',
          marginTop: -2,
        }}
      >
        Biển mây
      </span>
    </div>
  );
};

export const SummitWeatherRadar: React.FC<SummitWeatherRadarProps> = ({
  trails,
  onSelectTrail,
  onShowToast,
}) => {
  const [radarData, setRadarData] = useState<ExtendedSummitsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [offlineFallback, setOfflineFallback] = useState<boolean>(false);
  const [lastRefreshFailed, setLastRefreshFailed] = useState<boolean>(false);
  const [sortMode, setSortMode] = useState<RadarSortMode>('clouds');
  const [regionFilter, setRegionFilter] = useState<string>('All');
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [regionalPeaks, setRegionalPeaks] = useState<Record<string, SummitLiveTelemetry[]>>({});
  const [regionalLoading, setRegionalLoading] = useState<boolean>(false);
  const [regionalFailed, setRegionalFailed] = useState<Record<string, boolean>>({});
  const radarDataRef = useRef<ExtendedSummitsResponse | null>(null);

  // Wave 12D: Personal Weather Alert Watchlist Strip + Per-Peak Alert Modal
  const [hasAuthToken, setHasAuthToken] = useState<boolean>(() => Boolean(safeLocalStorageGet('lost_token')));
  const [myAlerts, setMyAlerts] = useState<WeatherAlertSubItem[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState<boolean>(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [alertsMaxLimit, setAlertsMaxLimit] = useState<number>(10);
  const [alertsExpanded, setAlertsExpanded] = useState<boolean>(false);
  const [alertsSyncTick, setAlertsSyncTick] = useState<number>(0);
  const [isEvaluatingAlerts, setIsEvaluatingAlerts] = useState<boolean>(false);
  const [deletingAlertTrailId, setDeletingAlertTrailId] = useState<string | null>(null);
  const [alertModalTrail, setAlertModalTrail] = useState<WeatherAlertTrailRef | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const evaluateAbortRef = useRef<AbortController | null>(null);
  const deleteAbortRef = useRef<AbortController | null>(null);
  const compareAbortRef = useRef<AbortController | null>(null);

  // Interactive 2-3 peak comparator (GET /api/weather/compare?ids=... with offline fallback)
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareLoading, setCompareLoading] = useState<boolean>(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<ComparePanelState | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    const syncAuthOnly = () => {
      const nextToken = Boolean(safeLocalStorageGet('lost_token'));
      setHasAuthToken(nextToken);
      if (!nextToken) {
        setMyAlerts([]);
        setAlertsError(null);
      }
    };
    const onAuthChanged = () => {
      const nextToken = Boolean(safeLocalStorageGet('lost_token'));
      setHasAuthToken(nextToken);
      if (!nextToken) {
        setMyAlerts([]);
        setAlertsError(null);
      } else {
        setAlertsSyncTick((t) => t + 1);
      }
    };
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== null && ev.key !== 'lost_token') return;
      onAuthChanged();
    };
    const onAlertsUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent<{ source?: string }>).detail;
      if (detail?.source === 'summit-radar' || detail?.source === 'summit-radar-modal') {
        return;
      }
      setAlertsSyncTick((t) => t + 1);
    };
    window.addEventListener('lost:auth-changed', onAuthChanged);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', syncAuthOnly);
    window.addEventListener('lost:weather-alerts-updated', onAlertsUpdated);
    return () => {
      isMountedRef.current = false;
      evaluateAbortRef.current?.abort();
      deleteAbortRef.current?.abort();
      compareAbortRef.current?.abort();
      window.removeEventListener('lost:auth-changed', onAuthChanged);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', syncAuthOnly);
      window.removeEventListener('lost:weather-alerts-updated', onAlertsUpdated);
    };
  }, []);

  useEffect(() => {
    if (!hasAuthToken) return;
    const controller = new AbortController();
    let active = true;

    const loadAlerts = async () => {
      setLoadingAlerts(true);
      setAlertsError(null);
      try {
        const res = await fetchMyWeatherAlerts(controller.signal);
        if (!active || controller.signal.aborted || !isMountedRef.current) return;
        if (res.unauthorized) {
          setMyAlerts([]);
          setAlertsError(null);
          return;
        }
        if (res.success) {
          setMyAlerts(res.data);
          setAlertsMaxLimit(res.maxLimit);
        } else {
          setAlertsError('Không thể tải danh sách cảnh báo thời tiết lúc này.');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!active || !isMountedRef.current) return;
        setAlertsError('Mất kết nối khi tải danh sách cảnh báo thời tiết.');
      } finally {
        if (active && isMountedRef.current) setLoadingAlerts(false);
      }
    };

    void loadAlerts();
    return () => {
      active = false;
      controller.abort();
    };
  }, [hasAuthToken, alertsSyncTick]);

  const alertByTrailId = useMemo(() => {
    const map = new Map<string, WeatherAlertSubItem>();
    for (const sub of myAlerts) {
      map.set(sub.trailId, sub);
    }
    return map;
  }, [myAlerts]);

  const triggeredAlertsCount = useMemo(
    () => myAlerts.filter((a) => a.isActive && a.liveEvaluation?.alertTriggered).length,
    [myAlerts]
  );

  const emitToast = useCallback(
    (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
      if (onShowToast) {
        onShowToast(msg, type);
      } else {
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', { detail: { message: msg, type } })
        );
      }
    },
    [onShowToast]
  );

  const handleEvaluateAllAlerts = useCallback(async () => {
    if (!hasAuthToken || isEvaluatingAlerts) return;
    evaluateAbortRef.current?.abort();
    const controller = new AbortController();
    evaluateAbortRef.current = controller;
    setIsEvaluatingAlerts(true);
    try {
      const res = await evaluateMyWeatherAlerts(controller.signal);
      if (controller.signal.aborted || !isMountedRef.current) return;
      // Merge evaluated active subs into existing list without wiping paused (isActive: false) entries
      setMyAlerts((prev) => mergeEvaluatedAlertsIntoList(prev, res.data));
      const msg =
        res.notificationsCreated > 0
          ? `Đã kiểm tra ${res.evaluatedCount} tuyến đang bật và gửi ${res.notificationsCreated} thông báo mới!`
          : `Đã kiểm tra ${res.evaluatedCount} tuyến đang bật — chưa phát sinh thông báo mới (hoặc đang chờ chống spam 6h).`;
      emitToast(msg, res.notificationsCreated > 0 ? 'success' : 'info');
      if (res.notificationsCreated > 0) {
        window.dispatchEvent(new CustomEvent('lost:notifications-synced'));
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!isMountedRef.current) return;
      emitToast(
        err instanceof Error ? err.message : 'Không thể kiểm tra danh sách cảnh báo lúc này.',
        'error'
      );
    } finally {
      if (isMountedRef.current) setIsEvaluatingAlerts(false);
    }
  }, [hasAuthToken, isEvaluatingAlerts, emitToast]);

  const handleDeleteWatchlistAlert = useCallback(
    async (trailId: string, peakLabel: string) => {
      if (deletingAlertTrailId) return;
      deleteAbortRef.current?.abort();
      const controller = new AbortController();
      deleteAbortRef.current = controller;
      setDeletingAlertTrailId(trailId);
      try {
        await deleteWeatherAlert(trailId, controller.signal);
        if (controller.signal.aborted || !isMountedRef.current) return;
        setMyAlerts((prev) => prev.filter((item) => item.trailId !== trailId));
        emitToast(`Đã hủy cảnh báo thời tiết cho ${peakLabel}.`, 'info');
        window.dispatchEvent(
          new CustomEvent('lost:weather-alerts-updated', {
            detail: { source: 'summit-radar', action: 'delete', trailId },
          })
        );
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!isMountedRef.current) return;
        emitToast(
          err instanceof Error ? err.message : 'Không thể hủy cảnh báo lúc này.',
          'error'
        );
      } finally {
        if (isMountedRef.current) setDeletingAlertTrailId(null);
      }
    },
    [deletingAlertTrailId, emitToast]
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        let res: ExtendedSummitsResponse | null = null;
        if (refreshTick > 0) {
          // Bypass client 45s read cache on manual refresh
          const rawRes = await fetch(`/api/weather/summits-live?_ts=${Date.now()}`, {
            headers: getApiHeaders(),
            cache: 'no-store',
            signal: controller.signal,
          });
          if (rawRes.ok) {
            const parsed = (await rawRes.json().catch(() => null)) as ExtendedSummitsResponse | null;
            if (parsed && parsed.success && Array.isArray(parsed.data)) {
              res = parsed;
            }
          }
        } else {
          res = (await fetchLiveSummitsWeather(undefined, controller.signal)) as ExtendedSummitsResponse | null;
        }
        if (!active) return;
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          radarDataRef.current = res;
          setRadarData(res);
          setOfflineFallback(false);
          setLastRefreshFailed(false);
          if (refreshTick > 0) {
            setRegionalPeaks({});
            setRegionalFailed({});
          }
        } else if (radarDataRef.current && radarDataRef.current.data.length > 0) {
          // Preserve existing valid loaded cards on failed manual refresh
          setLastRefreshFailed(true);
          emitToast('Chưa thể đồng bộ dữ liệu mới — đang giữ bản cập nhật gần nhất.', 'info');
        } else {
          setOfflineFallback(true);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!active) return;
        if (radarDataRef.current && radarDataRef.current.data.length > 0) {
          setLastRefreshFailed(true);
          emitToast('Mất kết nối trạm khí tượng — đang hiển thị dữ liệu gần nhất.', 'info');
        } else {
          setOfflineFallback(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [refreshTick, emitToast]);

  const trailById = useMemo(() => {
    const map = new Map<string, Trail>();
    for (const t of Array.isArray(trails) ? trails : []) {
      map.set(t.id, t);
    }
    return map;
  }, [trails]);

  // Real catalog peaks for selected region (used when server's top-12 national list only covers Northern alpine peaks)
  const regionalCatalogPeaks = useMemo(() => {
    if (regionFilter === 'All') return [];
    return [...(Array.isArray(trails) ? trails : [])]
      .filter((t) => t.region === regionFilter)
      .sort((a, b) => (b.maxAltitudeM || 0) - (a.maxAltitudeM || 0))
      .slice(0, 4);
  }, [trails, regionFilter]);

  const hasServerPeaksForRegion = useMemo(() => {
    if (regionFilter === 'All') return true;
    return (radarData?.data || []).some((p) => p.region === regionFilter);
  }, [radarData, regionFilter]);

  // Fetch real live MET Norway weather for Central / South regional peaks via /api/weather/compare?ids=...
  useEffect(() => {
    if (regionFilter === 'All' || hasServerPeaksForRegion || regionalCatalogPeaks.length === 0) {
      return;
    }
    if (regionalPeaks[regionFilter]?.length) return;

    const controller = new AbortController();
    let active = true;
    const ids = regionalCatalogPeaks.map((t) => t.id).join(',');

    const loadRegional = async () => {
      setRegionalLoading(true);
      try {
        const qs = `ids=${encodeURIComponent(ids)}${refreshTick > 0 ? `&_ts=${Date.now()}` : ''}`;
        const res = await fetch(`/api/weather/compare?${qs}`, {
          headers: getApiHeaders(),
          cache: refreshTick > 0 ? 'no-store' : 'default',
          signal: controller.signal,
        });
        if (!active) return;
        if (res.ok) {
          const json = (await res.json().catch(() => null)) as {
            success?: boolean;
            data?: CompareApiItem[];
          } | null;
          if (!active) return;
          if (json?.success && Array.isArray(json.data) && json.data.length > 0) {
            const mapped = json.data
              .map(mapCompareItemToTelemetry)
              .filter((p): p is SummitLiveTelemetry => p !== null);
            if (mapped.length > 0) {
              setRegionalPeaks((prev) => ({ ...prev, [regionFilter]: mapped }));
              setRegionalFailed((prev) => ({ ...prev, [regionFilter]: false }));
              return;
            }
          }
        }
        setRegionalFailed((prev) => ({ ...prev, [regionFilter]: true }));
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (active) setRegionalFailed((prev) => ({ ...prev, [regionFilter]: true }));
      } finally {
        if (active) setRegionalLoading(false);
      }
    };

    void loadRegional();
    return () => {
      active = false;
      controller.abort();
    };
  }, [regionFilter, hasServerPeaksForRegion, regionalCatalogPeaks, regionalPeaks, refreshTick]);

  // Offline graceful fallback list of top 12 alpine peaks from real trails catalog
  const offlineTopPeaks = useMemo(() => {
    const base = Array.isArray(trails) ? trails : [];
    const scoped = regionFilter === 'All' ? base : base.filter((t) => t.region === regionFilter);
    return [...scoped]
      .sort((a, b) => (b.maxAltitudeM || 0) - (a.maxAltitudeM || 0))
      .slice(0, 12);
  }, [trails, regionFilter]);

  const filteredPeaks = useMemo(() => {
    const serverList = radarData?.data || [];
    const byRegion =
      regionFilter === 'All'
        ? serverList
        : hasServerPeaksForRegion
          ? serverList.filter((p) => p.region === regionFilter)
          : regionalPeaks[regionFilter] || [];

    return [...byRegion].sort((a, b) => {
      if (sortMode === 'clouds') return (b.seaOfCloudsPercent || 0) - (a.seaOfCloudsPercent || 0);
      if (sortMode === 'coldest') return (a.summitTempC ?? 99) - (b.summitTempC ?? 99);
      if (sortMode === 'wind') return (b.windSpeedKmH || 0) - (a.windSpeedKmH || 0);
      return (b.maxAltitudeM || 0) - (a.maxAltitudeM || 0);
    });
  }, [radarData, regionFilter, hasServerPeaksForRegion, regionalPeaks, sortMode]);

  const handleOpenTrail = useCallback(
    (trailId: string) => {
      const matched = trailById.get(trailId);
      if (matched && onSelectTrail) {
        onSelectTrail(matched);
      } else {
        window.history.pushState({}, '', `/trails/${encodeURIComponent(trailId)}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    },
    [trailById, onSelectTrail]
  );

  const handleAskGoNoGo = useCallback((peakName: string, trailId: string) => {
    const prompt = `Kiểm tra Go/No-Go hôm nay và khả năng săn biển mây trên đỉnh ${peakName}`;
    try {
      sessionStorage.setItem('lost_ai_pending_prompt', JSON.stringify({ prompt, trailId }));
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(
      new CustomEvent('lost:open-ai-assistant', {
        detail: { trailId, trailName: peakName, prompt },
      })
    );
  }, []);

  const handleRefresh = () => {
    setRefreshTick((t) => t + 1);
    emitToast('Đang đồng bộ dữ liệu khí tượng mới nhất từ MET Norway...', 'info');
  };

  const loadedTelemetryById = useMemo(() => {
    const map = new Map<string, SummitLiveTelemetry>();
    for (const p of radarData?.data || []) {
      map.set(p.trailId, p);
    }
    for (const list of Object.values(regionalPeaks)) {
      for (const p of list) {
        if (!map.has(p.trailId)) map.set(p.trailId, p);
      }
    }
    return map;
  }, [radarData, regionalPeaks]);

  const buildFallbackCompareState = useCallback(
    (ids: string[]): ComparePanelState | null => {
      const items: CompareApiItem[] = [];
      for (const id of ids) {
        const live = loadedTelemetryById.get(id);
        const cat = trailById.get(id);
        if (live) {
          const days: CompareApiDay[] = [
            {
              summitTempMinC: live.summitTempMinC,
              summitTempMaxC: live.summitTempMaxC,
              windChillC: live.windChillC,
              precipMm: live.precipMm ?? 0,
              windSpeedKmH: live.windSpeedKmH,
              humidityPercent: live.humidityPercent,
              condition: live.weatherCondition,
              conditionLabel: resolveConditionLabel(live),
              seaOfCloudsPercent: live.seaOfCloudsPercent,
              weatherTier: live.weatherTier,
            },
          ];
          if (typeof live.tomorrowSeaOfCloudsPercent === 'number') {
            days.push({
              seaOfCloudsPercent: live.tomorrowSeaOfCloudsPercent,
              conditionLabel: 'Dự báo ngày mai',
              weatherTier: live.weatherTier,
            });
          }
          items.push({
            trailId: live.trailId,
            name: live.name,
            province: live.province,
            region: live.region,
            maxAltitudeM: live.maxAltitudeM,
            gridElevationM: live.gridElevationM,
            lapseDropC: live.lapseDropC,
            bestSeaOfCloudsPercent: Math.max(
              live.seaOfCloudsPercent,
              live.tomorrowSeaOfCloudsPercent ?? 0
            ),
            worstTier: live.weatherTier,
            days,
          });
        } else if (cat) {
          items.push({
            trailId: cat.id,
            name: cat.name,
            province: cat.province,
            region: cat.region,
            maxAltitudeM: cat.maxAltitudeM,
            days: [],
          });
        }
      }
      if (items.length < 2) return null;
      const bestCloud = items.reduce<CompareApiItem | null>(
        (best, cur) =>
          !best || (cur.bestSeaOfCloudsPercent ?? 0) > (best.bestSeaOfCloudsPercent ?? 0) ? cur : best,
        null
      );
      return {
        source: 'fallback',
        fetchedAt: radarData?.fetchedAt,
        bestWeatherTrailId: null,
        bestCloudTrailId: bestCloud && (bestCloud.bestSeaOfCloudsPercent ?? 0) > 0 ? bestCloud.trailId : null,
        items,
      };
    },
    [loadedTelemetryById, trailById, radarData?.fetchedAt]
  );

  const handleToggleCompareId = useCallback(
    (trailId: string) => {
      if (compareIds.includes(trailId)) {
        const nextIds = compareIds.filter((id) => id !== trailId);
        setCompareIds(nextIds);
        if (nextIds.length < 2) {
          compareAbortRef.current?.abort();
          setCompareResult(null);
          setCompareError(null);
          setCompareLoading(false);
        } else {
          setCompareResult((prev) => {
            if (!prev) return null;
            const filtered = prev.items.filter((item) => nextIds.includes(item.trailId));
            if (filtered.length < 2) return null;
            const bestWeather = filtered.reduce<CompareApiItem | null>(
              (best, cur) =>
                typeof cur.weatherScore === 'number' &&
                (!best || (cur.weatherScore ?? -1) > (best.weatherScore ?? -1))
                  ? cur
                  : best,
              null
            );
            const bestCloud = filtered.reduce<CompareApiItem | null>(
              (best, cur) =>
                !best || (cur.bestSeaOfCloudsPercent ?? 0) > (best.bestSeaOfCloudsPercent ?? 0)
                  ? cur
                  : best,
              null
            );
            return {
              ...prev,
              bestWeatherTrailId: bestWeather ? bestWeather.trailId : null,
              bestCloudTrailId:
                bestCloud && (bestCloud.bestSeaOfCloudsPercent ?? 0) > 0 ? bestCloud.trailId : null,
              items: filtered,
            };
          });
        }
        return;
      }
      if (compareIds.length >= 3) {
        emitToast('Chỉ so sánh tối đa 3 đỉnh cùng lúc — bạn bỏ chọn 1 đỉnh trước nhé.', 'info');
        return;
      }
      setCompareIds([...compareIds, trailId]);
    },
    [compareIds, emitToast]
  );

  const compareResultOutOfSync = useMemo(() => {
    if (!compareResult || compareIds.length < 2) return false;
    const shownIds = new Set(compareResult.items.map((item) => item.trailId));
    return compareIds.length !== shownIds.size || compareIds.some((id) => !shownIds.has(id));
  }, [compareResult, compareIds]);

  const handleRunCompare = useCallback(
    async (explicitIds?: string[]) => {
      const ids = (explicitIds ?? compareIds).slice(0, 3);
      if (ids.length < 2) {
        emitToast('Chọn ít nhất 2 đỉnh núi để so sánh thời tiết.', 'info');
        return;
      }
      compareAbortRef.current?.abort();
      const controller = new AbortController();
      compareAbortRef.current = controller;
      setCompareLoading(true);
      setCompareError(null);

      try {
        const res = await fetch(`/api/weather/compare?ids=${encodeURIComponent(ids.join(','))}`, {
          headers: getApiHeaders(),
          signal: controller.signal,
        });
        if (controller.signal.aborted || !isMountedRef.current) return;
        if (res.ok) {
          const json = (await res.json().catch(() => null)) as {
            success?: boolean;
            fetchedAt?: string;
            bestWeatherTrailId?: string | null;
            bestCloudTrailId?: string | null;
            data?: CompareApiItem[];
          } | null;
          if (json?.success && Array.isArray(json.data) && json.data.length >= 2) {
            setCompareResult({
              source: 'api',
              fetchedAt: json.fetchedAt,
              bestWeatherTrailId: json.bestWeatherTrailId ?? null,
              bestCloudTrailId: json.bestCloudTrailId ?? null,
              items: json.data,
            });
            return;
          }
        }
        const fallback = buildFallbackCompareState(ids);
        if (fallback) {
          setCompareResult(fallback);
          emitToast('Trạm so sánh 3 ngày tạm gián đoạn — đang đối chiếu bằng dữ liệu Radar đã tải.', 'info');
        } else {
          setCompareError('Không thể đối chiếu thời tiết các đỉnh lúc này.');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!isMountedRef.current) return;
        const fallback = buildFallbackCompareState(ids);
        if (fallback) {
          setCompareResult(fallback);
          emitToast('Đang ngoại tuyến — đối chiếu nhanh bằng dữ liệu Radar đã lưu.', 'info');
        } else {
          setCompareError('Mất kết nối mạng khi so sánh các đỉnh núi.');
        }
      } finally {
        if (isMountedRef.current && !controller.signal.aborted) {
          setCompareLoading(false);
        }
      }
    },
    [compareIds, buildFallbackCompareState, emitToast]
  );

  const handleQuickCompareTopClouds = useCallback(() => {
    const topIds = filteredPeaks.slice(0, 3).map((p) => p.trailId);
    if (topIds.length < 2) {
      const catIds = offlineTopPeaks.slice(0, 3).map((t) => t.id);
      if (catIds.length < 2) return;
      setCompareIds(catIds);
      void handleRunCompare(catIds);
      return;
    }
    setCompareIds(topIds);
    void handleRunCompare(topIds);
  }, [filteredPeaks, offlineTopPeaks, handleRunCompare]);

  const attributionLabel = useMemo(() => {
    const attr = radarData?.attribution?.trim();
    if (attr) return attr;
    const src = radarData?.source?.trim();
    if (src && /met\s*norway|nasa/i.test(src)) return src;
    return 'MET Norway (CC BY 4.0)';
  }, [radarData]);

  const fetchedTimeLabel = useMemo(() => {
    if (!radarData?.fetchedAt) return null;
    const d = new Date(radarData.fetchedAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  }, [radarData]);

  return (
    <section
      aria-label="Radar thời tiết đỉnh cao và săn biển mây thời gian thực"
      className="card"
      style={{
        padding: '20px 22px',
        borderRadius: 6,
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-strong)',
        marginBottom: 24,
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
          paddingBottom: 16,
          marginBottom: 16,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                borderRadius: 4,
                background: 'color-mix(in srgb, var(--color-sky) 14%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-sky) 35%, transparent)',
                color: 'var(--color-sky)',
                fontSize: '0.68rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <IconCloud size={12} color="var(--color-sky)" />
              <span>Radar đỉnh cao</span>
            </span>
            <span
              style={{
                fontSize: '0.72rem',
                color: 'var(--color-text-dim)',
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 600,
              }}
            >
              {attributionLabel}
              {fetchedTimeLabel ? ` · Lúc ${fetchedTimeLabel} (VN)` : ''}
              {' · Cập nhật mỗi 30 phút'}
              {lastRefreshFailed ? ' · Đang giữ dữ liệu gần nhất' : ''}
            </span>
          </div>
          <h3
            style={{
              fontSize: '1.22rem',
              fontWeight: 800,
              color: 'var(--color-text-main)',
              margin: '0 0 4px 0',
              lineHeight: 1.25,
            }}
          >
            Thời tiết thực địa &amp; xác suất biển mây trên các đỉnh núi Việt Nam
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
            Hiệu chỉnh nhiệt độ đỉnh thực tế theo suất giảm nhiệt khí quyển (-6,5°C/1.000m từ cao độ lưới DEM lên đỉnh) kèm chỉ số gió rét NWS.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="btn btn-outline"
          style={{
            padding: '7px 12px',
            borderRadius: 4,
            fontSize: '0.78rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            opacity: loading ? 0.65 : 1,
          }}
        >
          <IconRotateCw size={13} />
          <span>{loading ? 'Đang đồng bộ...' : 'Làm mới vệ tinh'}</span>
        </button>
      </div>

      {/* Live Summary KPI Bar */}
      {radarData?.summary && !offlineFallback && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(185px, 100%), 1fr))',
            gap: 10,
            marginBottom: 16,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 4,
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderLeft: '3px solid var(--color-primary)',
            }}
          >
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
              Săn biển mây đẹp nhất
            </div>
            <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 3 }}>
              {radarData.summary.bestCloudPeak
                ? `${radarData.summary.bestCloudPeak.name} (${radarData.summary.bestCloudPeak.seaOfCloudsPercent}%)`
                : 'Đang quan trắc'}
            </div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: 4,
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderLeft: '3px solid var(--color-sky)',
            }}
          >
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
              Đỉnh lạnh nhất lúc này
            </div>
            <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--color-sky)', marginTop: 3 }}>
              {radarData.summary.coldestPeak
                ? `${radarData.summary.coldestPeak.name} (${radarData.summary.coldestPeak.summitTempC}°C)`
                : 'Đang quan trắc'}
            </div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: 4,
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderLeft: `3px solid ${radarData.summary.warningCount > 0 ? 'var(--color-error)' : 'var(--color-primary)'}`,
            }}
          >
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
              Cảnh báo gió / sương giá
            </div>
            <div
              style={{
                fontSize: '0.94rem',
                fontWeight: 800,
                color:
                  radarData.summary.warningCount > 0
                    ? 'var(--color-error-text, var(--color-error))'
                    : 'var(--color-primary)',
                marginTop: 3,
              }}
            >
              {radarData.summary.warningCount > 0
                ? `${radarData.summary.warningCount}/${radarData.summary.totalPeaks} đỉnh cần lưu ý`
                : 'Không có cảnh báo nguy hiểm'}
            </div>
          </div>
        </div>
      )}

      {/* Wave 12D: Collapsible "Danh Sách Cảnh Báo Của Tôi" Live Strip */}
      <div
        style={{
          marginBottom: 16,
          borderRadius: 6,
          background: 'var(--color-bg-main)',
          border:
            triggeredAlertsCount > 0
              ? '1px solid color-mix(in srgb, var(--color-primary) 42%, var(--color-border))'
              : '1px solid var(--color-border)',
          overflow: 'hidden',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            padding: '10px 14px',
          }}
        >
          <button
            type="button"
            aria-expanded={alertsExpanded}
            onClick={() => setAlertsExpanded((v) => !v)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--color-text-main)',
              fontFamily: 'var(--font-family)',
              fontSize: '0.82rem',
              fontWeight: 800,
            }}
          >
            <IconChevronRight
              size={14}
              color="var(--color-text-muted)"
              style={{
                transform: alertsExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            />
            <IconBell size={14} color="var(--color-sky)" />
            <span>Danh sách cảnh báo của tôi</span>
            {hasAuthToken && (
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: 4,
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                }}
              >
                {myAlerts.length}/{alertsMaxLimit}
              </span>
            )}
            {triggeredAlertsCount > 0 && (
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: 4,
                  background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-primary) 38%, transparent)',
                  color: 'var(--color-primary)',
                }}
              >
                {triggeredAlertsCount} đang chạm ngưỡng
              </span>
            )}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {hasAuthToken ? (
              myAlerts.length > 0 && (
                <button
                  type="button"
                  onClick={handleEvaluateAllAlerts}
                  disabled={isEvaluatingAlerts}
                  className="btn btn-outline"
                  style={{
                    padding: '5px 10px',
                    borderRadius: 4,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderColor: 'color-mix(in srgb, var(--color-sky) 45%, transparent)',
                    color: 'var(--color-sky)',
                    opacity: isEvaluatingAlerts ? 0.65 : 1,
                  }}
                >
                  <IconRotateCw size={12} color="var(--color-sky)" />
                  <span>{isEvaluatingAlerts ? 'Đang quét...' : 'Kiểm tra & gửi thông báo ngay'}</span>
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('lost:open-auth-modal'))}
                className="btn btn-outline"
                style={{
                  padding: '5px 10px',
                  borderRadius: 4,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--color-sky)',
                  borderColor: 'color-mix(in srgb, var(--color-sky) 42%, transparent)',
                }}
              >
                Đăng nhập để bật cảnh báo
              </button>
            )}
          </div>
        </div>

        {alertsExpanded && (
          <div
            style={{
              padding: '12px 14px 14px',
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-bg-card)',
            }}
          >
            {!hasAuthToken ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                Đăng nhập tài khoản LOST để theo dõi tối đa <strong>10 đỉnh núi</strong>, thiết lập ngưỡng săn biển mây (30–95%),
                mưa/gió tối đa và nhận thông báo tự động khi điều kiện chuyển mức không nên đi hoặc đạt cửa sổ săn mây đẹp.
              </div>
            ) : loadingAlerts && myAlerts.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                Đang tải danh sách cảnh báo thời tiết của bạn...
              </div>
            ) : alertsError ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-error-text, var(--color-error))' }}>
                  {alertsError}
                </span>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setAlertsSyncTick((t) => t + 1)}
                  style={{ padding: '4px 10px', fontSize: '0.72rem', borderRadius: 4 }}
                >
                  Thử lại
                </button>
              </div>
            ) : myAlerts.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                Bạn chưa theo dõi đỉnh núi nào. Bấm nút <strong>&ldquo;Cảnh báo thời tiết&rdquo;</strong> trên bất kỳ thẻ đỉnh núi bên dưới để cài đặt ngưỡng săn mây và an toàn.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(265px, 100%), 1fr))',
                  gap: 10,
                }}
              >
                {myAlerts.map((sub) => {
                  const catalogTrail = trailById.get(sub.trailId);
                  const peakName = sub.trailName || catalogTrail?.name || sub.trailId;
                  const peakProvince = sub.province || catalogTrail?.province;
                  const peakAltitude = sub.maxAltitudeM || catalogTrail?.maxAltitudeM;
                  const live = sub.liveEvaluation;
                  const verdictColor =
                    live?.status === 'NO_GO'
                      ? 'var(--color-error-text, var(--color-error))'
                      : live?.status === 'CAUTION'
                      ? 'var(--color-sun)'
                      : 'var(--color-primary)';

                  return (
                    <div
                      key={sub.trailId}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 4,
                        background: 'var(--color-bg-main)',
                        border: live?.alertTriggered
                          ? '1px solid color-mix(in srgb, var(--color-primary) 45%, var(--color-border))'
                          : '1px solid var(--color-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 7,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '0.82rem',
                              fontWeight: 800,
                              color: 'var(--color-text-main)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {peakName}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', marginTop: 1 }}>
                            Mây ≥ {sub.minSeaOfCloudsPct}% · Mưa ≤ {sub.maxRainMm}mm · Gió ≤ {sub.maxWindKmh}km/h
                            {sub.targetDate ? ` · Ngày ${sub.targetDate}` : ''}
                          </div>
                        </div>
                        {!sub.isActive ? (
                          <span
                            style={{
                              fontSize: '0.64rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 3,
                              border: '1px solid var(--color-border-strong)',
                              background: 'var(--color-surface-elevated)',
                              color: 'var(--color-text-muted)',
                              flexShrink: 0,
                            }}
                          >
                            Tạm dừng
                          </span>
                        ) : live ? (
                          <span
                            style={{
                              fontSize: '0.64rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 3,
                              border: `1px solid color-mix(in srgb, ${verdictColor} 40%, transparent)`,
                              background: `color-mix(in srgb, ${verdictColor} 12%, transparent)`,
                              color: verdictColor,
                              flexShrink: 0,
                            }}
                          >
                            {live.status === 'NO_GO' ? 'Không nên đi' : live.status === 'CAUTION' ? 'Thận trọng' : 'Thuận lợi'}
                            {typeof live.seaOfCloudsPercent === 'number' ? ` · ${live.seaOfCloudsPercent}%` : ''}
                          </span>
                        ) : null}
                      </div>

                      {live && live.matchedConditions.length > 0 && (
                        <div
                          style={{
                            fontSize: '0.7rem',
                            color: live.status === 'NO_GO' ? 'var(--color-error-text, var(--color-error))' : 'var(--color-primary)',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <IconCheckCircle size={12} color={live.status === 'NO_GO' ? 'var(--color-error)' : 'var(--color-primary)'} />
                          <span>{live.matchedConditions.join(' · ')}</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
                        <button
                          type="button"
                          onClick={() =>
                            setAlertModalTrail({
                              id: sub.trailId,
                              name: peakName,
                              province: peakProvince,
                              maxAltitudeM: peakAltitude,
                            })
                          }
                          className="btn btn-outline"
                          style={{ flex: 1, padding: '4px 8px', fontSize: '0.72rem', borderRadius: 4, justifyContent: 'center' }}
                        >
                          <IconBell size={12} color="var(--color-sky)" />
                          <span>Chỉnh ngưỡng</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenTrail(sub.trailId)}
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '0.72rem', borderRadius: 4 }}
                        >
                          Mở cung
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteWatchlistAlert(sub.trailId, peakName)}
                          disabled={deletingAlertTrailId === sub.trailId}
                          aria-label={`Hủy cảnh báo cho ${peakName}`}
                          title="Hủy theo dõi đỉnh này"
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 4,
                            background: 'var(--color-bg-card)',
                            border: '1px solid color-mix(in srgb, var(--color-error) 35%, var(--color-border))',
                            color: 'var(--color-error-text, var(--color-error))',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          <IconTrash size={12} color="var(--color-error)" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls: Sort & Region */}
      {!offlineFallback && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {(
              [
                { id: 'clouds', label: 'Săn mây cao nhất' },
                { id: 'coldest', label: 'Lạnh nhất' },
                { id: 'wind', label: 'Gió mạnh nhất' },
                { id: 'altitude', label: 'Cao độ giảm dần' },
              ] as const
            ).map((opt) => {
              const active = sortMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSortMode(opt.id)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 4,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                    background: active
                      ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)'
                      : 'var(--color-bg-main)',
                    color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            {(['All', 'Miền Bắc', 'Miền Trung', 'Miền Nam'] as const).map((reg) => {
              const active = regionFilter === reg;
              return (
                <button
                  key={reg}
                  type="button"
                  onClick={() => setRegionFilter(reg)}
                  style={{
                    padding: '4px 9px',
                    borderRadius: 4,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: active ? '1px solid var(--color-sky)' : '1px solid var(--color-border)',
                    background: active
                      ? 'color-mix(in srgb, var(--color-sky) 14%, transparent)'
                      : 'var(--color-bg-main)',
                    color: active ? 'var(--color-sky)' : 'var(--color-text-muted)',
                  }}
                >
                  {reg === 'All' ? 'Toàn quốc' : reg}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Interactive 2-3 Peak Quick Comparator Strip + Results Matrix */}
      <div
        style={{
          marginBottom: 16,
          padding: '11px 14px',
          borderRadius: 6,
          background: 'var(--color-bg-main)',
          border:
            compareResult || compareIds.length >= 2
              ? '1px solid color-mix(in srgb, var(--color-sky) 42%, var(--color-border))'
              : '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          fontVariantNumeric: 'tabular-nums',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <IconScale size={15} color="var(--color-sky)" />
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
              So sánh 2–3 đỉnh (3 ngày tới)
            </span>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 4,
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              Đã chọn {compareIds.length}/3
            </span>
            {compareIds.length === 0 && (
              <span style={{ fontSize: '0.73rem', color: 'var(--color-text-dim)' }}>
                Bấm &ldquo;So sánh&rdquo; trên thẻ đỉnh bên dưới hoặc dùng gợi ý nhanh
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleQuickCompareTopClouds}
              disabled={compareLoading}
              className="btn btn-outline"
              style={{
                padding: '5px 10px',
                borderRadius: 4,
                fontSize: '0.73rem',
                fontWeight: 700,
              }}
            >
              <IconCloud size={12} color="var(--color-primary)" />
              <span>So sánh nhanh Top 3 săn mây</span>
            </button>
            {compareIds.length >= 2 && (
              <button
                type="button"
                onClick={() => void handleRunCompare()}
                disabled={compareLoading}
                className="btn btn-primary"
                style={{
                  padding: '5px 11px',
                  borderRadius: 4,
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  opacity: compareLoading ? 0.65 : 1,
                }}
              >
                <IconScale size={12} color="var(--color-on-primary)" />
                <span>
                  {compareLoading
                    ? 'Đang đối chiếu...'
                    : compareResultOutOfSync
                      ? `Cập nhật so sánh (${compareIds.length} đỉnh)`
                      : `So sánh ${compareIds.length} đỉnh`}
                </span>
              </button>
            )}
            {(compareIds.length > 0 || compareResult) && (
              <button
                type="button"
                onClick={() => {
                  compareAbortRef.current?.abort();
                  setCompareIds([]);
                  setCompareResult(null);
                  setCompareError(null);
                  setCompareLoading(false);
                }}
                className="btn btn-outline"
                style={{
                  padding: '5px 8px',
                  borderRadius: 4,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                }}
              >
                <IconX size={12} />
                <span>Đóng</span>
              </button>
            )}
          </div>
        </div>

        {compareIds.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {compareIds.map((id) => {
              const name = loadedTelemetryById.get(id)?.name || trailById.get(id)?.name || id;
              return (
                <span
                  key={id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: 'color-mix(in srgb, var(--color-sky) 12%, var(--color-bg-card))',
                    border: '1px solid color-mix(in srgb, var(--color-sky) 36%, var(--color-border))',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                  }}
                >
                  <span>{name}</span>
                  <button
                    type="button"
                    aria-label={`Bỏ chọn ${name}`}
                    onClick={() => handleToggleCompareId(id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                  >
                    <IconX size={11} />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {compareError && (
          <div style={{ fontSize: '0.76rem', color: 'var(--color-error-text, var(--color-error))', fontWeight: 600 }}>
            {compareError}
          </div>
        )}

        {compareResult && compareResult.items.length >= 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>
                {compareResult.source === 'api'
                  ? 'Dự báo chi tiết 3 ngày tới từ MET Norway Locationforecast 2.0 (hiệu chỉnh cao độ đỉnh).'
                  : 'Đang hiển thị đối chiếu ngoại tuyến từ dữ liệu Radar đã tải.'}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(245px, 100%), 1fr))',
                gap: 10,
              }}
            >
              {compareResult.items.map((item) => {
                const isBestWeather = compareResult.bestWeatherTrailId === item.trailId;
                const isBestCloud = compareResult.bestCloudTrailId === item.trailId;
                const worstTier = getTierMeta(item.worstTier || 'ideal');
                const days = Array.isArray(item.days) ? item.days.slice(0, 3) : [];
                return (
                  <div
                    key={item.trailId}
                    style={{
                      padding: '11px 12px',
                      borderRadius: 5,
                      background: 'var(--color-bg-card)',
                      border:
                        isBestWeather || isBestCloud
                          ? '1px solid color-mix(in srgb, var(--color-primary) 45%, var(--color-border))'
                          : '1px solid var(--color-border)',
                      borderTop: `3px solid ${isBestWeather ? 'var(--color-primary)' : worstTier.accent}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
                        {isBestWeather && (
                          <span
                            style={{
                              fontSize: '0.64rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 3,
                              background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
                              border: '1px solid color-mix(in srgb, var(--color-primary) 36%, transparent)',
                              color: 'var(--color-primary)',
                            }}
                          >
                            Thời tiết tốt nhất
                          </span>
                        )}
                        {isBestCloud && (
                          <span
                            style={{
                              fontSize: '0.64rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 3,
                              background: 'color-mix(in srgb, var(--color-sky) 14%, transparent)',
                              border: '1px solid color-mix(in srgb, var(--color-sky) 36%, transparent)',
                              color: 'var(--color-sky)',
                            }}
                          >
                            Săn mây cao nhất ({item.bestSeaOfCloudsPercent ?? 0}%)
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                        <strong style={{ fontSize: '0.86rem', color: 'var(--color-text-main)' }}>
                          {item.name}
                        </strong>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-sun)', flexShrink: 0 }}>
                          {Number(item.maxAltitudeM || 0).toLocaleString('vi-VN')}m
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
                        {item.province}
                        {typeof item.weatherScore === 'number' ? ` · Điểm thời tiết ${item.weatherScore}/100` : ''}
                      </div>
                    </div>

                    {days.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {days.map((d, dIdx) => {
                          const dTier = getTierMeta(d.weatherTier || 'ideal');
                          const hasFrost = typeof d.summitTempMinC === 'number' && d.summitTempMinC <= 2;
                          return (
                            <div
                              key={d.date || dIdx}
                              style={{
                                padding: '6px 8px',
                                borderRadius: 4,
                                background: 'var(--color-bg-main)',
                                border: '1px solid var(--color-border)',
                                fontSize: '0.71rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 3,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                                <strong style={{ color: 'var(--color-text-main)' }}>
                                  {formatCompareDayVi(d.date, dIdx)}
                                </strong>
                                <span
                                  style={{
                                    fontSize: '0.64rem',
                                    fontWeight: 800,
                                    color: dTier.color,
                                  }}
                                >
                                  {dTier.label}
                                  {typeof d.seaOfCloudsPercent === 'number' ? ` · Mây ${d.seaOfCloudsPercent}%` : ''}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, color: 'var(--color-text-muted)' }}>
                                {typeof d.summitTempMinC === 'number' ? (
                                  <span style={{ color: hasFrost ? 'var(--color-sky)' : 'var(--color-text-main)', fontWeight: hasFrost ? 700 : 500 }}>
                                    {d.summitTempMinC}° / {d.summitTempMaxC ?? d.summitTempMinC}°C
                                    {hasFrost ? ' (băng giá)' : ''}
                                  </span>
                                ) : (
                                  <span>{d.conditionLabel || 'Quan trắc'}</span>
                                )}
                                {typeof d.windSpeedKmH === 'number' && (
                                  <span>
                                    Gió {d.windSpeedKmH} km/h
                                    {typeof d.precipMm === 'number' && d.precipMm > 0 ? ` · Mưa ${d.precipMm}mm` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.73rem', color: 'var(--color-text-dim)' }}>
                        Chưa có dữ liệu chi tiết từng ngày cho đỉnh này ở chế độ ngoại tuyến.
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => handleOpenTrail(item.trailId)}
                      style={{ marginTop: 'auto', padding: '5px 8px', fontSize: '0.72rem', borderRadius: 4, justifyContent: 'center' }}
                    >
                      <span>Mở chi tiết cung</span>
                      <IconArrowRight size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Body States */}
      {loading && !radarData ? (
        <div
          style={{
            padding: '28px 16px',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            fontSize: '0.84rem',
            background: 'var(--color-bg-main)',
            borderRadius: 4,
            border: '1px solid var(--color-border)',
          }}
        >
          Đang thu thập dữ liệu khí tượng vệ tinh cho 12 đỉnh núi cao nhất Việt Nam...
        </div>
      ) : offlineFallback ? (
        <div
          style={{
            padding: '16px 18px',
            borderRadius: 4,
            background: 'var(--color-bg-main)',
            border: '1px dashed var(--color-border-strong)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-sun)', fontWeight: 700, fontSize: '0.84rem' }}>
              <IconAlertTriangle size={16} color="var(--color-sun)" />
              <span>Trạm khí tượng trực tuyến tạm gián đoạn — hiển thị danh mục cao độ DEM ngoại tuyến</span>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleRefresh} style={{ padding: '5px 12px', fontSize: '0.76rem', borderRadius: 4 }}>
              Thử kết nối lại
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))',
              gap: 8,
            }}
          >
            {offlineTopPeaks.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleOpenTrail(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 4,
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>{t.province}</div>
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-sun)', flexShrink: 0 }}>
                  {t.maxAltitudeM.toLocaleString('vi-VN')}m
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : regionalLoading && filteredPeaks.length === 0 ? (
        <div
          style={{
            padding: '24px 16px',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            fontSize: '0.84rem',
            background: 'var(--color-bg-main)',
            borderRadius: 4,
            border: '1px solid var(--color-border)',
          }}
        >
          Đang tải dữ liệu khí tượng MET Norway cho các đỉnh cao khu vực {regionFilter}...
        </div>
      ) : filteredPeaks.length === 0 && regionalCatalogPeaks.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
            {regionalFailed[regionFilter]
              ? `Trạm khí tượng trực tuyến cho ${regionFilter} tạm gián đoạn — hiển thị các đỉnh tiêu biểu của vùng để mở xem dự báo chi tiết:`
              : `Các đỉnh núi tiêu biểu khu vực ${regionFilter}:`}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(275px, 100%), 1fr))',
              gap: 12,
            }}
          >
            {regionalCatalogPeaks.map((trail) => {
              const sub = alertByTrailId.get(trail.id) || null;
              const isWatched = Boolean(sub?.isActive);
              return (
                <div
                  key={trail.id}
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    borderTop: '3px solid var(--color-sky)',
                    borderRadius: 6,
                    padding: '13px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 10,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: 3,
                          fontSize: '0.64rem',
                          fontWeight: 800,
                          color: 'var(--color-sky)',
                          background: 'color-mix(in srgb, var(--color-sky) 14%, transparent)',
                          border: '1px solid color-mix(in srgb, var(--color-sky) 36%, transparent)',
                        }}
                      >
                        {trail.region}
                      </span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-sun)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <IconMountain size={11} color="var(--color-sun)" />
                        {trail.maxAltitudeM.toLocaleString('vi-VN')}m
                      </span>
                    </div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1.3 }}>
                      {trail.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
                      {trail.province} · Cự ly {trail.distanceKm} km · Leo +{trail.elevationGainM.toLocaleString('vi-VN')}m
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenTrail(trail.id)}
                        className="btn btn-outline"
                        style={{ flex: 1, padding: '6px 8px', borderRadius: 4, fontSize: '0.74rem', fontWeight: 700, justifyContent: 'center' }}
                      >
                        <span>Mở cung</span>
                        <IconArrowRight size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAskGoNoGo(trail.name, trail.id)}
                        className="btn btn-primary"
                        style={{ flex: 1, padding: '6px 8px', borderRadius: 4, fontSize: '0.74rem', fontWeight: 700, justifyContent: 'center' }}
                      >
                        <IconSparkles size={12} color="var(--color-on-primary)" />
                        <span>Hỏi đi hay hoãn</span>
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(() => {
                        const isRegionalCompared = compareIds.includes(trail.id);
                        return (
                          <button
                            type="button"
                            aria-pressed={isRegionalCompared}
                            onClick={() => handleToggleCompareId(trail.id)}
                            className="btn btn-outline"
                            style={{
                              padding: '5px 8px',
                              borderRadius: 4,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              justifyContent: 'center',
                              borderColor: isRegionalCompared ? 'var(--color-sky)' : 'var(--color-border-strong)',
                              background: isRegionalCompared
                                ? 'color-mix(in srgb, var(--color-sky) 14%, transparent)'
                                : 'var(--color-bg-card)',
                              color: isRegionalCompared ? 'var(--color-sky)' : 'var(--color-text-muted)',
                              flexShrink: 0,
                            }}
                          >
                            <IconScale size={12} color={isRegionalCompared ? 'var(--color-sky)' : 'currentColor'} />
                            <span>{isRegionalCompared ? 'Đã chọn' : 'So sánh'}</span>
                          </button>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() =>
                          setAlertModalTrail({
                            id: trail.id,
                            name: trail.name,
                            province: trail.province,
                            maxAltitudeM: trail.maxAltitudeM,
                          })
                        }
                        className="btn btn-outline"
                        style={{
                          flex: 1,
                          padding: '5px 8px',
                          borderRadius: 4,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          justifyContent: 'center',
                          borderColor: isWatched ? 'var(--color-sky)' : 'var(--color-border-strong)',
                          background: isWatched ? 'color-mix(in srgb, var(--color-sky) 12%, transparent)' : 'var(--color-bg-card)',
                          color: isWatched ? 'var(--color-sky)' : 'var(--color-text-main)',
                        }}
                      >
                        <IconBell size={12} color={isWatched ? 'var(--color-sky)' : 'currentColor'} />
                        <span>
                          {isWatched ? `Cảnh báo (≥ ${sub?.minSeaOfCloudsPct}%)` : 'Cảnh báo thời tiết'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : filteredPeaks.length === 0 ? (
        <div
          style={{
            padding: '24px 16px',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            fontSize: '0.84rem',
            background: 'var(--color-bg-main)',
            borderRadius: 4,
            border: '1px solid var(--color-border)',
          }}
        >
          Chưa có đỉnh cao thuộc vùng {regionFilter}. Chọn &ldquo;Toàn quốc&rdquo; để xem toàn bộ danh sách.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(275px, 100%), 1fr))',
            gap: 12,
          }}
        >
          {filteredPeaks.map((peak) => {
            const tier = getTierMeta(peak.weatherTier);
            const condLabel = resolveConditionLabel(peak);
            const isSevereFreeze = peak.summitTempMinC <= 0;
            const isFrostBadge = peak.summitTempMinC <= 2;
            const isFrostRisk = isFrostBadge || peak.windChillC <= 2;
            const hasTomorrowClouds =
              typeof peak.tomorrowSeaOfCloudsPercent === 'number' &&
              Number.isFinite(peak.tomorrowSeaOfCloudsPercent);
            const tomorrowCloudPct = hasTomorrowClouds
              ? Math.max(0, Math.min(100, Math.round(peak.tomorrowSeaOfCloudsPercent!)))
              : null;
            const tomorrowDelta =
              tomorrowCloudPct !== null ? tomorrowCloudPct - Math.round(peak.seaOfCloudsPercent || 0) : 0;
            const isCompared = compareIds.includes(peak.trailId);

            return (
              <div
                key={peak.trailId}
                style={{
                  background: 'var(--color-bg-main)',
                  border: `1px solid ${
                    isCompared
                      ? 'var(--color-sky)'
                      : peak.weatherTier === 'danger'
                        ? tier.border
                        : 'var(--color-border)'
                  }`,
                  borderTop: `3px solid ${tier.accent}`,
                  borderRadius: 6,
                  padding: '13px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 10,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {/* Peak Header + Cloud Arc Gauge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: 3,
                          fontSize: '0.64rem',
                          fontWeight: 800,
                          color: tier.color,
                          background: tier.bg,
                          border: `1px solid ${tier.border}`,
                        }}
                      >
                        {tier.label}
                      </span>
                      {isFrostBadge && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '2px 6px',
                            borderRadius: 3,
                            fontSize: '0.64rem',
                            fontWeight: 800,
                            color: isSevereFreeze
                              ? 'var(--color-error-text, var(--color-error))'
                              : 'var(--color-sky)',
                            background: isSevereFreeze
                              ? 'color-mix(in srgb, var(--color-error) 14%, transparent)'
                              : 'color-mix(in srgb, var(--color-sky) 14%, transparent)',
                            border: isSevereFreeze
                              ? '1px solid color-mix(in srgb, var(--color-error) 40%, transparent)'
                              : '1px solid color-mix(in srgb, var(--color-sky) 40%, transparent)',
                          }}
                        >
                          <IconSnowflake
                            size={10}
                            color={isSevereFreeze ? 'var(--color-error)' : 'var(--color-sky)'}
                          />
                          <span>{isSevereFreeze ? 'Băng giá ≤ 0°C' : 'Sương muối ≤ 2°C'}</span>
                        </span>
                      )}
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-sun)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <IconMountain size={11} color="var(--color-sun)" />
                        {peak.maxAltitudeM.toLocaleString('vi-VN')}m
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        color: 'var(--color-text-main)',
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {peak.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
                      {peak.province} · {condLabel}
                    </div>
                  </div>

                  <CloudArcGauge percent={peak.seaOfCloudsPercent} />
                </div>

                {/* Telemetry Metrics Strip */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 6,
                    padding: '8px 6px',
                    borderRadius: 4,
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--color-text-dim)', fontWeight: 700 }}>
                      Đỉnh thật
                    </div>
                    <div
                      style={{
                        fontSize: '0.86rem',
                        fontWeight: 800,
                        color: isFrostRisk ? 'var(--color-sky)' : 'var(--color-text-main)',
                        marginTop: 2,
                      }}
                    >
                      {peak.summitTempC}°C
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--color-text-dim)' }}>
                      {peak.summitTempMinC}° / {peak.summitTempMaxC}°
                    </div>
                  </div>

                  <div style={{ borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--color-text-dim)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <IconSnowflake size={10} color="var(--color-sky)" /> Gió rét
                    </div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-sky)', marginTop: 2 }}>
                      {peak.windChillC}°C
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--color-text-dim)' }}>
                      -{peak.lapseDropC}° DEM
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--color-text-dim)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <IconWind size={10} color="var(--color-earth)" /> Gió / Ẩm
                    </div>
                    <div
                      style={{
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        color:
                          peak.windSpeedKmH >= 35
                            ? 'var(--color-error-text, var(--color-error))'
                            : 'var(--color-text-main)',
                        marginTop: 2,
                      }}
                    >
                      {peak.windSpeedKmH} km/h
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--color-text-dim)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <IconDroplet size={9} color="var(--color-sky)" /> {peak.humidityPercent}%
                    </div>
                  </div>
                </div>

                {/* Tomorrow Sea-of-Clouds Forecast Strip (already returned by backend!) */}
                {tomorrowCloudPct !== null && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '6px 9px',
                      borderRadius: 4,
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.72rem',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      <IconCloud size={12} color={getCloudColor(tomorrowCloudPct)} />
                      <span>Khả năng biển mây ngày mai</span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, color: getCloudColor(tomorrowCloudPct) }}>
                      <span>{tomorrowCloudPct}%</span>
                      {tomorrowDelta !== 0 && (
                        <span
                          style={{
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            color: tomorrowDelta > 0 ? 'var(--color-primary)' : 'var(--color-text-dim)',
                          }}
                        >
                          ({tomorrowDelta > 0 ? `+${tomorrowDelta}%` : `${tomorrowDelta}%`})
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {/* Advisory Note */}
                {peak.advisory && (
                  <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                    {peak.advisory}
                  </div>
                )}

                {/* Action Footer */}
                {(() => {
                  const sub = alertByTrailId.get(peak.trailId) || null;
                  const isWatched = Boolean(sub?.isActive);
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenTrail(peak.trailId)}
                          className="btn btn-outline"
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            borderRadius: 4,
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            justifyContent: 'center',
                          }}
                        >
                          <span>Mở cung</span>
                          <IconArrowRight size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskGoNoGo(peak.name, peak.trailId)}
                          className="btn btn-primary"
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            borderRadius: 4,
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            justifyContent: 'center',
                          }}
                        >
                          <IconSparkles size={12} color="var(--color-on-primary)" />
                          <span>Hỏi đi hay hoãn</span>
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          aria-pressed={isCompared}
                          onClick={() => handleToggleCompareId(peak.trailId)}
                          className="btn btn-outline"
                          style={{
                            padding: '5px 8px',
                            borderRadius: 4,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            justifyContent: 'center',
                            borderColor: isCompared ? 'var(--color-sky)' : 'var(--color-border-strong)',
                            background: isCompared
                              ? 'color-mix(in srgb, var(--color-sky) 14%, transparent)'
                              : 'var(--color-bg-card)',
                            color: isCompared ? 'var(--color-sky)' : 'var(--color-text-muted)',
                            flexShrink: 0,
                          }}
                        >
                          <IconScale size={12} color={isCompared ? 'var(--color-sky)' : 'currentColor'} />
                          <span>{isCompared ? 'Đã chọn' : 'So sánh'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setAlertModalTrail({
                              id: peak.trailId,
                              name: peak.name,
                              province: peak.province,
                              maxAltitudeM: peak.maxAltitudeM,
                            })
                          }
                          className="btn btn-outline"
                          style={{
                            flex: 1,
                            padding: '5px 8px',
                            borderRadius: 4,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            justifyContent: 'center',
                            borderColor: isWatched
                              ? 'var(--color-sky)'
                              : 'var(--color-border-strong)',
                            background: isWatched
                              ? 'color-mix(in srgb, var(--color-sky) 12%, transparent)'
                              : 'var(--color-bg-card)',
                            color: isWatched ? 'var(--color-sky)' : 'var(--color-text-main)',
                          }}
                        >
                          <IconBell size={12} color={isWatched ? 'var(--color-sky)' : 'currentColor'} />
                          <span>
                            {isWatched
                              ? `Cảnh báo (≥ ${sub?.minSeaOfCloudsPct}%)`
                              : 'Cảnh báo thời tiết'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {alertModalTrail && (
        <Suspense fallback={null}>
          <WeatherAlertModal
            isOpen={true}
            onClose={() => setAlertModalTrail(null)}
            trail={alertModalTrail}
            isAuthenticated={hasAuthToken}
            existingAlert={alertByTrailId.get(alertModalTrail.id) || null}
            eventSource="summit-radar-modal"
            onShowToast={emitToast}
            onAlertChanged={(change) => {
              if (change.action === 'upsert' && change.sub) {
                const savedSub = change.sub;
                setMyAlerts((prev) => {
                  const exists = prev.some((item) => item.trailId === savedSub.trailId);
                  return exists
                    ? prev.map((item) => (item.trailId === savedSub.trailId ? savedSub : item))
                    : [savedSub, ...prev];
                });
              } else if (change.action === 'delete') {
                setMyAlerts((prev) => prev.filter((item) => item.trailId !== change.trailId));
              } else if (change.action === 'evaluate' && Array.isArray(change.evaluatedActiveSubs)) {
                setMyAlerts((prev) =>
                  mergeEvaluatedAlertsIntoList(prev, change.evaluatedActiveSubs || [])
                );
              }
            }}
          />
        </Suspense>
      )}
    </section>
  );
};
