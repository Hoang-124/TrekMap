import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Trail } from '../../types.js';
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
  const [radarData, setRadarData] = useState<LiveSummitsWeatherResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [offlineFallback, setOfflineFallback] = useState<boolean>(false);
  const [sortMode, setSortMode] = useState<RadarSortMode>('clouds');
  const [regionFilter, setRegionFilter] = useState<string>('All');
  const [refreshTick, setRefreshTick] = useState<number>(0);

  // Wave 12D: Personal Weather Alert Watchlist Strip + Per-Peak Alert Modal
  const [hasAuthToken, setHasAuthToken] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    return Boolean(localStorage.getItem('lost_token'));
  });
  const [myAlerts, setMyAlerts] = useState<WeatherAlertSubItem[]>([]);
  const [alertsMaxLimit, setAlertsMaxLimit] = useState<number>(10);
  const [alertsExpanded, setAlertsExpanded] = useState<boolean>(false);
  const [alertsSyncTick, setAlertsSyncTick] = useState<number>(0);
  const [isEvaluatingAlerts, setIsEvaluatingAlerts] = useState<boolean>(false);
  const [deletingAlertTrailId, setDeletingAlertTrailId] = useState<string | null>(null);
  const [alertModalTrail, setAlertModalTrail] = useState<WeatherAlertTrailRef | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const evaluateAbortRef = useRef<AbortController | null>(null);
  const deleteAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    const syncAuthOnly = () => {
      const nextToken = typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('lost_token'));
      setHasAuthToken(nextToken);
      if (!nextToken) setMyAlerts([]);
    };
    const onAuthChanged = () => {
      const nextToken = typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('lost_token'));
      setHasAuthToken(nextToken);
      if (!nextToken) setMyAlerts([]);
      else setAlertsSyncTick((t) => t + 1);
    };
    const onAlertsUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent<{ source?: string }>).detail;
      if (detail?.source === 'summit-radar' || detail?.source === 'summit-radar-modal') {
        return;
      }
      setAlertsSyncTick((t) => t + 1);
    };
    window.addEventListener('lost:auth-changed', onAuthChanged);
    window.addEventListener('storage', onAuthChanged);
    window.addEventListener('focus', syncAuthOnly);
    window.addEventListener('lost:weather-alerts-updated', onAlertsUpdated);
    return () => {
      isMountedRef.current = false;
      evaluateAbortRef.current?.abort();
      deleteAbortRef.current?.abort();
      window.removeEventListener('lost:auth-changed', onAuthChanged);
      window.removeEventListener('storage', onAuthChanged);
      window.removeEventListener('focus', syncAuthOnly);
      window.removeEventListener('lost:weather-alerts-updated', onAlertsUpdated);
    };
  }, []);

  useEffect(() => {
    if (!hasAuthToken) return;
    const controller = new AbortController();
    fetchMyWeatherAlerts(controller.signal)
      .then((res) => {
        if (controller.signal.aborted || !isMountedRef.current) return;
        if (res.unauthorized) {
          setMyAlerts([]);
          return;
        }
        if (res.success) {
          setMyAlerts(res.data);
          setAlertsMaxLimit(res.maxLimit);
        }
      })
      .catch(() => {
        // Ignore abort / offline gracefully
      });
    return () => controller.abort();
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
        const res = await fetchLiveSummitsWeather(undefined, controller.signal);
        if (!active) return;
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setRadarData(res);
          setOfflineFallback(false);
        } else {
          setOfflineFallback(true);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (active) setOfflineFallback(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [refreshTick]);

  const trailById = useMemo(() => {
    const map = new Map<string, Trail>();
    for (const t of Array.isArray(trails) ? trails : []) {
      map.set(t.id, t);
    }
    return map;
  }, [trails]);

  // Offline graceful fallback list of top 12 alpine peaks from real trails catalog
  const offlineTopPeaks = useMemo(() => {
    return [...(Array.isArray(trails) ? trails : [])]
      .sort((a, b) => (b.maxAltitudeM || 0) - (a.maxAltitudeM || 0))
      .slice(0, 12);
  }, [trails]);

  const filteredPeaks = useMemo(() => {
    const list = radarData?.data || [];
    const byRegion =
      regionFilter === 'All'
        ? list
        : list.filter((p) => p.region === regionFilter);

    return [...byRegion].sort((a, b) => {
      if (sortMode === 'clouds') return (b.seaOfCloudsPercent || 0) - (a.seaOfCloudsPercent || 0);
      if (sortMode === 'coldest') return (a.summitTempC ?? 99) - (b.summitTempC ?? 99);
      if (sortMode === 'wind') return (b.windSpeedKmH || 0) - (a.windSpeedKmH || 0);
      return (b.maxAltitudeM || 0) - (a.maxAltitudeM || 0);
    });
  }, [radarData, regionFilter, sortMode]);

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
    onShowToast?.('Đang cập nhật dữ liệu khí tượng vệ tinh Top 12 đỉnh cao...', 'info');
  };

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
              <span>Radar Đỉnh Cao Live · Open-Meteo</span>
            </span>
            {fetchedTimeLabel && (
              <span
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--color-text-dim)',
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: 600,
                }}
              >
                Cập nhật {fetchedTimeLabel} (VN) · Cache 15 phút
              </span>
            )}
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
            Thời Tiết Thực Địa &amp; Xác Suất Biển Mây Top 12 Đỉnh Núi Việt Nam
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
            <span>Danh Sách Cảnh Báo Của Tôi</span>
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
                  <span>{isEvaluatingAlerts ? 'Đang quét...' : 'Kiểm Tra & Gửi Thông Báo Ngay'}</span>
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
                mưa/gió tối đa và nhận thông báo tự động khi điều kiện chuyển NO-GO hoặc đạt cửa sổ săn mây đẹp.
              </div>
            ) : myAlerts.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                Bạn chưa theo dõi đỉnh núi nào. Bấm nút <strong>&ldquo;Cảnh Báo Thời Tiết&rdquo;</strong> trên bất kỳ thẻ đỉnh núi bên dưới để cài đặt ngưỡng săn mây &amp; an toàn.
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
                            {live.status === 'NO_GO' ? 'NO-GO' : live.status === 'CAUTION' ? 'THẬN TRỌNG' : 'GO'}
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
                { id: 'clouds', label: 'Săn Mây Cao Nhất' },
                { id: 'coldest', label: 'Lạnh Nhất' },
                { id: 'wind', label: 'Gió Mạnh Nhất' },
                { id: 'altitude', label: 'Cao Độ Giảm Dần' },
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
            {offlineTopPeaks.slice(0, 6).map((t) => (
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
          Chưa có đỉnh cao thuộc vùng {regionFilter} trong danh sách Top 12 đỉnh cao nhất. Chọn &ldquo;Toàn quốc&rdquo; để xem toàn bộ.
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
            const condLabel = CONDITION_LABELS[peak.weatherCondition] || peak.weatherCondition;
            const isFrostRisk = peak.summitTempMinC <= 3 || peak.windChillC <= 2;

            return (
              <div
                key={peak.trailId}
                style={{
                  background: 'var(--color-bg-main)',
                  border: `1px solid ${peak.weatherTier === 'danger' ? tier.border : 'var(--color-border)'}`,
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
                      <div style={{ display: 'flex', gap: 6 }}>
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
                          <span>Mở Cung</span>
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
                          <span>AI Go/No-Go</span>
                        </button>
                      </div>
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
                          width: '100%',
                          padding: '5px 8px',
                          borderRadius: 4,
                          fontSize: '0.73rem',
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
                            ? `Đang Cảnh Báo (Mây ≥ ${sub?.minSeaOfCloudsPct}%)`
                            : 'Cảnh Báo Thời Tiết'}
                        </span>
                      </button>
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
            onShowToast={onShowToast}
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
