import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Trail, Incident, User, Region } from '../../types.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { removeVietnameseTones, searchMatchVietnamese } from '../../utils/textUtils.js';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconBot,
  IconCheckCircle,
  IconClock,
  IconCompass,
  IconMapPin,
  IconMountain,
  IconPhone,
  IconRadar,
  IconRotateCw,
  IconSearch,
  IconShieldAlert,
  IconShieldCheck,
  IconUsers,
  IconWaveform,
} from '../common/SvgIcons.js';
import { safeLocalStorageGet } from '../../utils/storageScope.js';

const API_BASE_URL = '/api';
const PULSE_FETCH_TIMEOUT_MS = 8_000;

interface PlatformPulseTrendingTrail {
  id: string;
  name: string;
  province: string;
  maxAltitudeM: number;
  activityScore: number;
}

interface PlatformPulseData {
  totalTrails: number;
  activeIncidentsCount: number;
  openTripsCount: number | null;
  verifiedPoisCount: number | null;
  totalCommunityDistanceKm: number | null;
  totalCheckinsCount: number | null;
  trendingTrails: PlatformPulseTrendingTrail[];
}

function toSafeNonNegNumber(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return null;
  return raw;
}

function normalizePlatformPulse(raw: unknown): PlatformPulseData | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const totalTrails = toSafeNonNegNumber(obj.totalTrails);
  const activeIncidentsCount = toSafeNonNegNumber(obj.activeIncidentsCount);
  if (totalTrails === null || activeIncidentsCount === null) return null;

  const rawTrending = Array.isArray(obj.trendingTrails) ? obj.trendingTrails : [];
  const trendingTrails: PlatformPulseTrendingTrail[] = rawTrending
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object' && !Array.isArray(entry)))
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id.trim() : '',
      name: typeof entry.name === 'string' ? entry.name.trim() : '',
      province: typeof entry.province === 'string' ? entry.province.trim() : '',
      maxAltitudeM: toSafeNonNegNumber(entry.maxAltitudeM) ?? 0,
      activityScore: toSafeNonNegNumber(entry.activityScore) ?? 0,
    }))
    .filter((item) => Boolean(item.id && item.name))
    .slice(0, 5);

  return {
    totalTrails,
    activeIncidentsCount,
    openTripsCount: toSafeNonNegNumber(obj.openTripsCount),
    verifiedPoisCount: toSafeNonNegNumber(obj.verifiedPoisCount),
    totalCommunityDistanceKm: toSafeNonNegNumber(obj.totalCommunityDistanceKm),
    totalCheckinsCount: toSafeNonNegNumber(obj.totalCheckinsCount),
    trendingTrails,
  };
}

export interface SafetyRadarViewProps {
  trails: Trail[];
  incidents: Incident[];
  currentUser?: User | null;
  onSelectTrail?: (trail: Trail) => void;
  onOpenIncidentReport?: () => void;
  onOpenSafetyTimer?: () => void;
  onOpenEmergencyContacts?: () => void;
  onRefreshIncidents?: () => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onBack?: () => void;
}

interface TrailConditionReport {
  _id: string;
  condition: 'safe' | 'caution' | 'dangerous' | 'closed';
  description: string;
  section?: string;
  weatherNote?: string;
  upvotes?: number;
  upvotesCount?: number;
  hasUpvoted?: boolean;
  createdAt: string;
  userId?: {
    _id?: string;
    fullName?: string;
    reputationScore?: number;
  };
}

type IncidentWithMeta = Incident & { _id?: string; isSynthetic?: boolean };

function getIncidentId(inc: Incident): string {
  return (inc as Incident & { _id?: string })._id || inc.id;
}

function isSyntheticIncident(inc: IncidentWithMeta): boolean {
  const id = String(inc.id || '');
  return Boolean(inc.isSynthetic || id.startsWith('weather-live-') || id.startsWith('nasa-'));
}

function isBenignWeatherTelemetry(inc: IncidentWithMeta): boolean {
  const id = String(inc.id || '');
  const isWeatherSynthetic = Boolean(
    id.startsWith('weather-live-') || (inc.isSynthetic && inc.type === 'weather')
  );
  return isWeatherSynthetic && inc.severity === 'low';
}

function extractRescueDialNumber(rawPhone?: string): string {
  const firstSegment = String(rawPhone || '').split(/[/,;|–—]|\s+-\s+/)[0] || '';
  const digits = firstSegment.replace(/[^\d+]/g, '');
  return digits.length >= 3 ? digits : '112';
}

function formatTelemetrySource(verifiedBy?: string): string {
  const cleaned = String(verifiedBy || '').trim();
  if (!cleaned) return 'MET Norway (CC BY 4.0)';
  if (/met\s*norway|nasa|eonet|kiểm lâm|lost/i.test(cleaned)) return cleaned;
  return 'MET Norway (CC BY 4.0)';
}

const REGIONS: Region[] = ['Miền Bắc', 'Miền Trung', 'Miền Nam'];

const SEVERITY_META: Record<'critical' | 'high' | 'medium' | 'low', { label: string; color: string }> = {
  critical: { label: 'Khẩn cấp (Cấp 1)', color: 'var(--color-error-text, var(--color-error))' },
  high: { label: 'Nguy hiểm cao (Cấp 2)', color: 'var(--color-earth)' },
  medium: { label: 'Cần chú ý (Cấp 3)', color: 'var(--color-sun)' },
  low: { label: 'Lưu ý nhẹ (Cấp 4)', color: 'var(--color-sky)' },
};

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  landslide: 'Sạt lở đất đá',
  flash_flood: 'Lũ quét / nước dâng',
  flood: 'Mưa lớn / suối xiết',
  bad_weather: 'Thời tiết khắc nghiệt',
  weather: 'Thời tiết xấu / sương mù',
  wildlife: 'Động vật nguy hiểm',
  lost: 'Mất dấu / lạc đường',
  other: 'Cảnh báo khác',
};

const CONDITION_META: Record<
  TrailConditionReport['condition'],
  { label: string; color: string }
> = {
  safe: { label: 'Đường khô ráo, đi ổn', color: 'var(--color-primary)' },
  caution: { label: 'Đường trơn, đi cẩn thận', color: 'var(--color-sun)' },
  dangerous: { label: 'Nguy hiểm, nên tránh', color: 'var(--color-earth)' },
  closed: { label: 'Tạm đóng cung', color: 'var(--color-error-text, var(--color-error))' },
};

function formatDateTime(raw?: string): string {
  if (!raw) return 'Gần đây';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const SafetyRadarView: React.FC<SafetyRadarViewProps> = ({
  trails,
  incidents,
  currentUser,
  onSelectTrail,
  onOpenIncidentReport,
  onOpenSafetyTimer,
  onOpenEmergencyContacts,
  onRefreshIncidents,
  onShowToast,
  onBack,
}) => {
  const [statusFilter, setStatusFilter] = useState<'active' | 'resolved' | 'all'>('active');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [regionFilter, setRegionFilter] = useState<'All' | Region>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch full incidents list including resolved (?includeResolved=true) so "Đã xử lý" tab & KPI reflect real DB data
  const [resolvedFeedIncidents, setResolvedFeedIncidents] = useState<Incident[] | null>(null);
  const [incidentFetchTick, setIncidentFetchTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/incidents?includeResolved=true&limit=100`, {
      headers: getApiHeaders(),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (controller.signal.aborted) return;
        if (json?.success && Array.isArray(json.data)) {
          setResolvedFeedIncidents(json.data as Incident[]);
        }
      })
      .catch(() => {
        // offline safe — fall back to prop incidents
      });
    return () => controller.abort();
  }, [incidents, incidentFetchTick]);

  const effectiveIncidents = useMemo<Incident[]>(() => {
    if (!resolvedFeedIncidents || resolvedFeedIncidents.length === 0) return incidents;
    const byId = new Map<string, Incident>();
    for (const inc of resolvedFeedIncidents) {
      byId.set(getIncidentId(inc), inc);
    }
    for (const inc of incidents) {
      const k = getIncidentId(inc);
      if (!byId.has(k)) byId.set(k, inc);
    }
    return Array.from(byId.values());
  }, [incidents, resolvedFeedIncidents]);

  const currentUserId = String(
    currentUser?.id || (currentUser as (User & { _id?: string }) | null)?._id || ''
  );

  // Optimistic confirmations, disputes & condition upvotes (scoped by user ID so auth changes never leak stale optimistic state)
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [localConfirmedMap, setLocalConfirmedMap] = useState<Record<string, number>>({});
  const [disputingIncidentId, setDisputingIncidentId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [upvotingConditionId, setUpvotingConditionId] = useState<string | null>(null);

  // Live Trail Conditions Inspector state
  const [inspectedTrailId, setInspectedTrailId] = useState<string>(() => trails[0]?.id || '');
  const activeInspectedTrailId = useMemo(() => {
    if (inspectedTrailId && trails.some((t) => t.id === inspectedTrailId)) {
      return inspectedTrailId;
    }
    if (regionFilter !== 'All') {
      const firstInRegion = trails.find((t) => t.region === regionFilter);
      if (firstInRegion) return firstInRegion.id;
    }
    return trails[0]?.id || '';
  }, [trails, inspectedTrailId, regionFilter]);

  const [conditions, setConditions] = useState<TrailConditionReport[]>([]);
  const [loadedConditionsKey, setLoadedConditionsKey] = useState<string | null>(null);
  const targetConditionsKey = activeInspectedTrailId ? `${activeInspectedTrailId}:${currentUserId}` : '';
  const loadingConditions = Boolean(activeInspectedTrailId) && loadedConditionsKey !== targetConditionsKey;

  const handleToggleRegionFilter = (region: Region) => {
    const nextRegion: 'All' | Region = regionFilter === region ? 'All' : region;
    setRegionFilter(nextRegion);
    if (nextRegion !== 'All') {
      const currentTrail = trails.find((t) => t.id === activeInspectedTrailId);
      if (!currentTrail || currentTrail.region !== nextRegion) {
        const firstInRegion = trails.find((t) => t.region === nextRegion);
        if (firstInRegion) setInspectedTrailId(firstInRegion.id);
      }
    }
  };

  // Live Vietnam Platform Pulse telemetry state (GET /api/analytics/platform-pulse)
  const [pulseRefreshTick, setPulseRefreshTick] = useState<number>(0);
  const [pulseState, setPulseState] = useState<{
    loadedTick: number;
    data: PlatformPulseData | null;
    fetchedAt: string | null;
    isLive: boolean;
  }>({
    loadedTick: -1,
    data: null,
    fetchedAt: null,
    isLive: false,
  });
  const isLoadingPulse = pulseState.loadedTick !== pulseRefreshTick;

  const notify = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onShowToast) onShowToast(msg, type);
    else window.dispatchEvent(new CustomEvent('lost:show-toast', { detail: { message: msg, type } }));
  };

  // Helper to resolve matching Trail object for any incident
  const matchTrailForIncident = useMemo(() => {
    const byId = new Map<string, Trail>();
    trails.forEach((t) => {
      byId.set(t.id, t);
      const mongoId = (t as Trail & { _id?: string })._id;
      if (mongoId) byId.set(String(mongoId), t);
    });
    return (inc: Incident): Trail | null => {
      if (inc.trailId && byId.has(String(inc.trailId))) {
        return byId.get(String(inc.trailId)) || null;
      }
      if (inc.trailName) {
        return (
          trails.find(
            (t) =>
              searchMatchVietnamese(t.name, inc.trailName) ||
              searchMatchVietnamese(inc.trailName, t.name)
          ) || null
        );
      }
      return null;
    };
  }, [trails]);

  // Global Safety KPIs (exclude benign low-severity synthetic weather telemetry so KPI matches active alerts)
  const stats = useMemo(() => {
    const activeList = effectiveIncidents.filter(
      (i) => !i.resolved && !isBenignWeatherTelemetry(i as IncidentWithMeta)
    );
    const resolvedList = effectiveIncidents.filter((i) => i.resolved);
    const criticalCount = activeList.filter((i) => i.severity === 'critical').length;
    const highCount = activeList.filter((i) => i.severity === 'high').length;
    const impactedTrailIds = new Set<string>();
    activeList.forEach((inc) => {
      const m = matchTrailForIncident(inc);
      if (m) impactedTrailIds.add(m.id);
      else if (inc.trailId) impactedTrailIds.add(inc.trailId);
    });
    const safeTrailCount = Math.max(0, trails.length - impactedTrailIds.size);

    return {
      activeCount: activeList.length,
      resolvedCount: resolvedList.length,
      criticalCount,
      highCount,
      impactedCount: impactedTrailIds.size,
      safeTrailCount,
    };
  }, [effectiveIncidents, trails.length, matchTrailForIncident]);

  // Pure Inline SVG Regional Risk Matrix data
  const regionalMatrix = useMemo(() => {
    return REGIONS.map((region) => {
      const regionTrails = trails.filter((t) => t.region === region);
      const regionTrailIds = new Set(regionTrails.map((t) => t.id));
      const activeRegionIncidents = effectiveIncidents.filter((inc) => {
        if (inc.resolved || isBenignWeatherTelemetry(inc as IncidentWithMeta)) return false;
        const matched = matchTrailForIncident(inc);
        if (matched) return matched.region === region;
        return regionTrailIds.has(inc.trailId);
      });

      const critical = activeRegionIncidents.filter((i) => i.severity === 'critical').length;
      const high = activeRegionIncidents.filter((i) => i.severity === 'high').length;
      const medium = activeRegionIncidents.filter((i) => i.severity === 'medium').length;
      const low = activeRegionIncidents.filter((i) => i.severity === 'low').length;

      const impactedSet = new Set<string>();
      activeRegionIncidents.forEach((i) => {
        const m = matchTrailForIncident(i);
        if (m) impactedSet.add(m.id);
      });

      const clearTrails = Math.max(0, regionTrails.length - impactedSet.size);
      const riskLevel: 'high' | 'moderate' | 'clear' =
        critical > 0 || high > 0 ? 'high' : medium > 0 || low > 0 ? 'moderate' : 'clear';

      return {
        region,
        totalTrails: regionTrails.length,
        clearTrails,
        impactedTrails: impactedSet.size,
        activeCount: activeRegionIncidents.length,
        critical,
        high,
        medium,
        low,
        riskLevel,
      };
    });
  }, [trails, effectiveIncidents, matchTrailForIncident]);

  // Filtered Incidents
  const filteredIncidents = useMemo(() => {
    return effectiveIncidents
      .filter((inc) => {
        if (statusFilter === 'active') {
          if (inc.resolved) return false;
          if (severityFilter !== 'low' && isBenignWeatherTelemetry(inc as IncidentWithMeta)) return false;
        }
        if (statusFilter === 'resolved' && !inc.resolved) return false;
        if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;
        if (regionFilter !== 'All') {
          const matched = matchTrailForIncident(inc);
          if (!matched || matched.region !== regionFilter) return false;
        }
        if (searchQuery.trim()) {
          const matched = matchTrailForIncident(inc);
          const typeLabel = INCIDENT_TYPE_LABELS[inc.type] || inc.type;
          const ok =
            searchMatchVietnamese(inc.trailName || '', searchQuery) ||
            searchMatchVietnamese(inc.description || '', searchQuery) ||
            searchMatchVietnamese(inc.locationNote || '', searchQuery) ||
            searchMatchVietnamese(typeLabel, searchQuery) ||
            (matched ? searchMatchVietnamese(matched.province, searchQuery) : false);
          if (!ok) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const sevRank = { critical: 4, high: 3, medium: 2, low: 1 };
        const diffSev = (sevRank[b.severity] || 0) - (sevRank[a.severity] || 0);
        if (diffSev !== 0) return diffSev;
        return new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime();
      });
  }, [effectiveIncidents, statusFilter, severityFilter, regionFilter, searchQuery, matchTrailForIncident]);

  // Fetch live trail conditions when activeInspectedTrailId or auth identity changes
  useEffect(() => {
    if (!activeInspectedTrailId) return;
    const controller = new AbortController();
    const requestKey = `${activeInspectedTrailId}:${currentUserId}`;

    fetch(`/api/trail-conditions/trail/${encodeURIComponent(activeInspectedTrailId)}`, {
      headers: getApiHeaders(),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (controller.signal.aborted) return;
        if (json?.success && Array.isArray(json.data)) {
          setConditions(json.data);
        } else {
          setConditions([]);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setConditions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedConditionsKey(requestKey);
      });

    return () => controller.abort();
  }, [activeInspectedTrailId, currentUserId]);

  const onShowToastRef = useRef(onShowToast);
  useEffect(() => {
    onShowToastRef.current = onShowToast;
  }, [onShowToast]);

  // Fetch live platform telemetry pulse with 8s timeout + AbortController + stale-snapshot preservation
  useEffect(() => {
    const controller = new AbortController();
    const requestTick = pulseRefreshTick;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, PULSE_FETCH_TIMEOUT_MS);

    const emitPulseRefreshWarning = (msg: string) => {
      if (requestTick <= 0) return;
      if (onShowToastRef.current) {
        onShowToastRef.current(msg, 'info');
      } else {
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', { detail: { message: msg, type: 'info' } })
        );
      }
    };

    fetch(`${API_BASE_URL}/analytics/platform-pulse`, {
      headers: getApiHeaders(),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (controller.signal.aborted && !timedOut) return;
        const normalized = json?.success ? normalizePlatformPulse(json.data) : null;
        if (normalized) {
          setPulseState({
            loadedTick: requestTick,
            data: normalized,
            fetchedAt: typeof json.fetchedAt === 'string' ? json.fetchedAt : new Date().toISOString(),
            isLive: true,
          });
        } else {
          setPulseState((prev) => ({
            loadedTick: requestTick,
            data: prev.data,
            fetchedAt: prev.fetchedAt,
            isLive: false,
          }));
          emitPulseRefreshWarning(
            'Chưa làm mới được lúc này — tạm xem lại bản ghi gần nhất nhé.'
          );
        }
      })
      .catch(() => {
        if (controller.signal.aborted && !timedOut) return;
        setPulseState((prev) => ({
          loadedTick: requestTick,
          data: prev.data,
          fetchedAt: prev.fetchedAt,
          isLive: false,
        }));
        emitPulseRefreshWarning(
          timedOut
            ? 'Máy chủ phản hồi chậm (quá 8 giây) — đang giữ lại số liệu gần nhất.'
            : 'Mất kết nối mạng — đang hiện số liệu gần nhất.'
        );
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [pulseRefreshTick]);

  const trailLookupById = useMemo(() => {
    const map = new Map<string, Trail>();
    trails.forEach((t) => {
      map.set(t.id, t);
      const mongoId = (t as Trail & { _id?: string })._id;
      if (mongoId) map.set(String(mongoId), t);
    });
    return map;
  }, [trails]);

  const effectivePulse = useMemo<PlatformPulseData>(() => {
    if (pulseState.data) return pulseState.data;
    const fallbackTrending: PlatformPulseTrendingTrail[] = [...trails]
      .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0) || (b.rating || 0) - (a.rating || 0))
      .slice(0, 4)
      .map((t) => ({
        id: t.id,
        name: t.name,
        province: t.province,
        maxAltitudeM: t.maxAltitudeM,
        activityScore: 0,
      }));
    return {
      totalTrails: trails.length,
      activeIncidentsCount: stats.activeCount,
      openTripsCount: null,
      verifiedPoisCount: null,
      totalCommunityDistanceKm: null,
      totalCheckinsCount: null,
      trendingTrails: fallbackTrending,
    };
  }, [pulseState.data, trails, stats.activeCount]);

  const handleOpenTrendingPeak = (peak: PlatformPulseTrendingTrail) => {
    const normPeakName = removeVietnameseTones(peak.name);
    const matched =
      trailLookupById.get(peak.id) ||
      (normPeakName
        ? trails.find((t) => removeVietnameseTones(t.name) === normPeakName)
        : undefined) ||
      trails.find(
        (t) =>
          searchMatchVietnamese(t.name, peak.name) || searchMatchVietnamese(peak.name, t.name)
      ) ||
      null;
    if (matched && onSelectTrail) {
      onSelectTrail(matched);
    } else if (matched) {
      notify(`Đã chọn tuyến ${matched.name} (${matched.province}) trong danh mục thực địa.`, 'info');
    } else {
      notify(`Chưa tìm thấy hồ sơ tuyến "${peak.name}" trong danh mục hiện tại.`, 'info');
    }
  };

  const inspectedTrail = useMemo(
    () => trails.find((t) => t.id === activeInspectedTrailId) || trails[0] || null,
    [trails, activeInspectedTrailId]
  );

  const handleConfirmIncident = async (inc: Incident) => {
    const incId = getIncidentId(inc);
    const confirmKey = `${currentUserId}:${incId}`;
    if (!incId || confirmingId === incId || isSyntheticIncident(inc as IncidentWithMeta)) return;
    const token = safeLocalStorageGet('lost_token');
    if (!currentUser && !token) {
      notify('Đăng nhập để xác nhận cảnh báo này nhé.', 'info');
      window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
      return;
    }

    setConfirmingId(incId);
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(incId)}/confirm`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          action: 'confirm_true',
          note: `Xác nhận hiện trường tại ${inc.trailName}`,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        const nextCount =
          typeof json.data?.confirmations === 'number'
            ? json.data.confirmations
            : (localConfirmedMap[confirmKey] ?? (inc.confirmations || 1)) + 1;
        setLocalConfirmedMap((prev) => ({ ...prev, [confirmKey]: nextCount }));
        notify(json.message || `Đã xác nhận cảnh báo trên cung "${inc.trailName}".`, 'success');
        setIncidentFetchTick((t) => t + 1);
        onRefreshIncidents?.();
      } else {
        notify(json.message || 'Chưa xác nhận được cảnh báo này.', 'error');
      }
    } catch {
      notify('Mất kết nối máy chủ khi gửi xác nhận.', 'error');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleSubmitDisputeIncident = async (inc: Incident) => {
    const incId = getIncidentId(inc);
    if (!incId || confirmingId === incId || isSyntheticIncident(inc as IncidentWithMeta)) return;
    const token = safeLocalStorageGet('lost_token');
    if (!currentUser && !token) {
      notify('Đăng nhập để báo lại nếu tình hình trên cung đã đổi.', 'info');
      window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
      return;
    }

    const cleanReason = disputeReason.trim() || 'Đã qua khu vực này, đường đã thông thoáng hoặc thông tin chưa chính xác.';
    setConfirmingId(incId);
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(incId)}/confirm`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          action: 'dispute_false',
          note: cleanReason,
          reason: cleanReason,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        notify(json.message || 'Đã gửi phản hồi — nhóm kiểm duyệt sẽ rà lại ngay.', 'info');
        setDisputingIncidentId(null);
        setDisputeReason('');
        setIncidentFetchTick((t) => t + 1);
        onRefreshIncidents?.();
      } else {
        notify(json.message || 'Chưa gửi được báo sai lúc này.', 'error');
      }
    } catch {
      notify('Mất kết nối máy chủ khi gửi báo sai.', 'error');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleUpvoteCondition = async (cond: TrailConditionReport) => {
    if (!cond._id || upvotingConditionId === cond._id) return;
    const token = safeLocalStorageGet('lost_token');
    if (!currentUser && !token) {
      notify('Đăng nhập để đánh dấu báo cáo này hữu ích nhé.', 'info');
      window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
      return;
    }
    if (cond.hasUpvoted) {
      notify('Bạn đã đánh dấu hữu ích cho báo cáo này rồi.', 'info');
      return;
    }

    setUpvotingConditionId(cond._id);
    try {
      const res = await fetch(`/api/trail-conditions/${encodeURIComponent(cond._id)}/upvote`, {
        method: 'POST',
        headers: getApiHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        const nextCount =
          typeof json.upvotes === 'number'
            ? json.upvotes
            : (cond.upvotes ?? cond.upvotesCount ?? 0) + 1;
        setConditions((prev) =>
          prev.map((item) =>
            item._id === cond._id
              ? { ...item, upvotes: nextCount, upvotesCount: nextCount, hasUpvoted: true }
              : item
          )
        );
        notify(json.message || 'Đã đánh dấu báo cáo hữu ích.', 'success');
      } else {
        notify(json.message || 'Chưa ghi nhận được lúc này.', 'error');
      }
    } catch {
      notify('Mất kết nối máy chủ khi gửi phản hồi.', 'error');
    } finally {
      setUpvotingConditionId(null);
    }
  };

  const handleOpenAiGoNoGo = (trail: Trail | null, extraContext?: string) => {
    const targetName = trail ? `${trail.name} (${trail.province})` : 'cung đường này';
    const prompt = `Hôm nay đi cung ${targetName} có ổn không?${extraContext ? ` Anh em vừa báo trên đường: ${extraContext}` : ''} Giúp mình xem thời tiết, nguy cơ sạt lở và nên đi hay hoãn.`;
    window.dispatchEvent(
      new CustomEvent('lost:open-ai-assistant', {
        detail: {
          prompt,
          trailId: trail?.id,
          trailName: trail?.name,
        },
      })
    );
  };

  return (
    <section
      style={{
        maxWidth: 1240,
        margin: '0 auto',
        padding: '24px 20px 56px',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* 1. Live Vietnam Safety Command Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          paddingBottom: 18,
          marginBottom: 20,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="btn btn-outline"
              style={{ marginBottom: 10, padding: '6px 12px', fontSize: '0.78rem', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <IconArrowLeft size={14} /> Quay lại
            </button>
          )}
          <div className="section-eyebrow" style={{ marginBottom: 6 }}>
            <IconRadar size={13} color="var(--color-error)" />
            <span>Cảnh báo đường rừng &amp; an toàn toàn quốc</span>
          </div>
          <h1 className="font-editorial" style={{ margin: 0, fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 600, color: 'var(--color-text-main)', lineHeight: 1.12 }}>
            Tình hình đường rừng &amp; cảnh báo
          </h1>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.88rem', color: 'var(--color-text-muted)', maxWidth: 680 }}>
            Cập nhật sạt lở, nước suối dâng, thời tiết xấu và tình trạng mặt đường do anh em vừa đi về báo lại trên {trails.length} cung núi Việt Nam.
          </p>
        </div>

        {/* 3 Quick Safety Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => onOpenIncidentReport?.()}
            style={{ padding: '8px 14px', fontSize: '0.8rem', fontWeight: 800, borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <IconAlertTriangle size={14} color="var(--color-on-danger)" />
            <span>Báo sự cố mới</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onOpenSafetyTimer?.()}
            style={{ padding: '8px 14px', fontSize: '0.8rem', fontWeight: 800, borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <IconClock size={14} color="var(--color-on-primary)" />
            <span>Hẹn giờ báo bình an</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => onOpenEmergencyContacts?.()}
            style={{ padding: '8px 14px', fontSize: '0.8rem', fontWeight: 700, borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <IconPhone size={14} color="var(--color-error)" />
            <span>Số cứu hộ 24/7</span>
          </button>
        </div>
      </div>

      {/* Live Safety KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 10,
          marginBottom: 20,
        }}
      >
        <div
          className="card"
          style={{
            padding: '14px 16px',
            borderRadius: 4,
            background: stats.activeCount > 0 ? 'color-mix(in srgb, var(--color-earth) 9%, var(--color-bg-card))' : 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
            Cảnh báo đang mở
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: stats.activeCount > 0 ? 'var(--color-earth)' : 'var(--color-primary)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {stats.activeCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
            Ảnh hưởng {stats.impactedCount} cung đường
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '14px 16px',
            borderRadius: 4,
            background: stats.criticalCount > 0 ? 'var(--banner-danger-bg)' : 'var(--color-bg-card)',
            border: stats.criticalCount > 0 ? '1px solid var(--banner-danger-border)' : '1px solid var(--color-border)',
          }}
        >
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
            Khẩn cấp / mức cao
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--color-error-text, var(--color-error))', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {stats.criticalCount} <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>/ {stats.highCount} cao</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
            Cần theo dõi sát
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', borderRadius: 4, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
            Đã khắc phục
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--color-sky)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {stats.resolvedCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
            Sự cố đã xử lý xong
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', borderRadius: 4, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
            Cung đang yên ổn
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--color-primary)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {stats.safeTrailCount}/{trails.length}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
            Trong tổng {trails.length} cung núi
          </div>
        </div>
      </div>

      {/* 1.5 Live Vietnam Platform Pulse Telemetry Strip */}
      <div
        className="card"
        style={{
          padding: '16px 18px',
          borderRadius: 4,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          marginBottom: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.7rem',
                fontWeight: 800,
                color: 'var(--color-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              <IconWaveform size={13} color="var(--color-primary)" />
              <span>Chuyện ngoài rừng hôm nay</span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              Ghi nhận mới nhất trên {effectivePulse.totalTrails} cung núi Việt Nam.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 4,
                background: pulseState.isLive
                  ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
                  : 'var(--color-bg-main)',
                border: pulseState.isLive
                  ? '1px solid color-mix(in srgb, var(--color-primary) 34%, transparent)'
                  : '1px solid var(--color-border)',
                color: pulseState.isLive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true">
                <circle
                  cx="4"
                  cy="4"
                  r="4"
                  fill={
                    pulseState.isLive
                      ? 'var(--color-primary)'
                      : pulseState.data
                        ? 'var(--color-sun)'
                        : 'var(--color-text-dim)'
                  }
                />
              </svg>
              <span>
                {isLoadingPulse
                  ? 'Đang đồng bộ...'
                  : pulseState.isLive && pulseState.fetchedAt
                    ? `Trực tuyến · ${formatDateTime(pulseState.fetchedAt)}`
                    : pulseState.data && pulseState.fetchedAt
                      ? `Bản ghi gần nhất · ${formatDateTime(pulseState.fetchedAt)}`
                      : 'Chế độ ngoại tuyến'}
              </span>
            </span>

            <button
              type="button"
              className="btn btn-outline"
              disabled={isLoadingPulse}
              onClick={() => setPulseRefreshTick((prev) => prev + 1)}
              aria-label="Làm mới cập nhật thực địa Việt Nam"
              style={{
                padding: '4px 9px',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <IconRotateCw size={12} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* 4 Live Field Telemetry Metrics */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(145px, 100%), 1fr))',
            gap: 8,
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 4,
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
              <IconShieldAlert size={12} color="var(--color-error-text, var(--color-error))" />
              <span>Sự cố đang mở</span>
            </div>
            <div
              style={{
                fontSize: '1.2rem',
                fontWeight: 900,
                fontVariantNumeric: 'tabular-nums',
                color:
                  effectivePulse.activeIncidentsCount > 0
                    ? 'var(--color-error-text, var(--color-error))'
                    : 'var(--color-primary)',
                marginTop: 4,
              }}
            >
              {effectivePulse.activeIncidentsCount.toLocaleString('vi-VN')}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
              Cảnh báo cần để ý
            </div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: 4,
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
              <IconUsers size={12} color="var(--color-sky)" />
              <span>Đoàn đang rủ người</span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: 'var(--color-sky)', marginTop: 4 }}>
              {effectivePulse.openTripsCount !== null
                ? effectivePulse.openTripsCount.toLocaleString('vi-VN')
                : '—'}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
              {effectivePulse.openTripsCount !== null ? 'Chuyến đang mở ghép đoàn' : 'Cần kết nối mạng'}
            </div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: 4,
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
              <IconMapPin size={12} color="var(--color-primary)" />
              <span>Điểm ghi chú thực địa</span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: 'var(--color-primary)', marginTop: 4 }}>
              {effectivePulse.verifiedPoisCount !== null
                ? effectivePulse.verifiedPoisCount.toLocaleString('vi-VN')
                : '—'}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
              {effectivePulse.verifiedPoisCount !== null ? 'Nguồn nước, lán nghỉ, điểm có sóng' : 'Cần kết nối mạng'}
            </div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: 4,
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
              <IconCompass size={12} color="var(--color-earth)" />
              <span>Quãng đường cả nhà đã đi</span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: 'var(--color-earth)', marginTop: 4 }}>
              {effectivePulse.totalCommunityDistanceKm !== null
                ? `${Math.round(effectivePulse.totalCommunityDistanceKm).toLocaleString('vi-VN')} km`
                : '—'}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {effectivePulse.totalCheckinsCount !== null
                ? `${effectivePulse.totalCheckinsCount.toLocaleString('vi-VN')} lượt đóng dấu đỉnh`
                : 'Cần kết nối mạng'}
            </div>
          </div>
        </div>

        {/* Top Trending Peaks (1-Click Trail Open) */}
        {effectivePulse.trendingTrails.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                color: 'var(--color-text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {pulseState.data
                ? 'Những đỉnh anh em đang quan tâm nhiều (bấm để xem cung)'
                : 'Các cung nổi bật (bấm để xem cung)'}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))',
                gap: 8,
              }}
            >
              {effectivePulse.trendingTrails.map((peak, idx) => (
                <button
                  key={peak.id}
                  type="button"
                  onClick={() => handleOpenTrendingPeak(peak)}
                  style={{
                    textAlign: 'left',
                    padding: '9px 11px',
                    borderRadius: 4,
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        color: 'var(--color-text-main)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: 900,
                          color: 'var(--color-primary)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        #{idx + 1}
                      </span>
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {peak.name}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--color-text-muted)',
                        marginTop: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexWrap: 'wrap',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <span>{peak.province}</span>
                      {peak.maxAltitudeM > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--color-sun)', fontWeight: 700 }}>
                          <IconMountain size={11} color="var(--color-sun)" />
                          {peak.maxAltitudeM.toLocaleString('vi-VN')}m
                        </span>
                      )}
                      {peak.activityScore > 0 && (
                        <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                          · Chỉ số {peak.activityScore}
                        </span>
                      )}
                    </div>
                  </div>
                  <IconArrowRight size={14} color="var(--color-text-dim)" style={{ flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Pure Inline SVG Regional Risk Matrix (Miền Bắc / Miền Trung / Miền Nam) */}
      <div
        className="card"
        style={{
          padding: '18px 20px',
          borderRadius: 4,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          marginBottom: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Tình hình theo ba miền
            </div>
            <h2 style={{ margin: '2px 0 0 0', fontSize: '1.08rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
              Phân bổ cảnh báo theo vùng (bấm vào miền để lọc)
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.72rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--color-primary)' }} /> Đang ổn định
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--color-sun)' }} /> Cần chú ý
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--color-error)' }} /> Mức cao / khẩn cấp
            </span>
          </div>
        </div>

        {/* Pure Inline SVG Stacked Horizontal Risk Chart */}
        <div style={{ width: '100%', overflowX: 'auto', marginBottom: 14 }}>
          <svg
            viewBox="0 0 760 132"
            role="img"
            aria-label="Biểu đồ ma trận rủi ro đường trekking theo 3 miền Việt Nam"
            style={{ width: '100%', minWidth: 520, height: 'auto', display: 'block' }}
          >
            {regionalMatrix.map((row, idx) => {
              const y = 12 + idx * 40;
              const barX = 124;
              const barW = 470;
              const barH = 22;
              const total = Math.max(1, row.totalTrails);
              const safeW = (row.clearTrails / total) * barW;
              const impactedW = barW - safeW;
              const hasSevere = row.critical > 0 || row.high > 0;
              const isSelected = regionFilter === row.region;

              return (
                <g
                  key={row.region}
                  onClick={() => handleToggleRegionFilter(row.region)}
                  style={{ cursor: 'pointer' }}
                >
                  <text
                    x="0"
                    y={y + 15}
                    fill={isSelected ? 'var(--color-primary)' : 'var(--color-text-main)'}
                    style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'var(--font-family)' }}
                  >
                    {row.region}
                  </text>
                  <rect
                    x={barX}
                    y={y}
                    width={barW}
                    height={barH}
                    rx="4"
                    fill="var(--color-surface-elevated)"
                    stroke={isSelected ? 'var(--color-primary)' : 'var(--color-border)'}
                    strokeWidth={isSelected ? 1.5 : 1}
                  />
                  {safeW > 0 && (
                    <rect
                      x={barX}
                      y={y}
                      width={safeW}
                      height={barH}
                      rx="4"
                      fill="var(--color-primary)"
                    />
                  )}
                  {impactedW > 0 && (
                    <rect
                      x={barX + safeW}
                      y={y}
                      width={impactedW}
                      height={barH}
                      rx="2"
                      fill={hasSevere ? 'var(--color-error)' : 'var(--color-sun)'}
                    />
                  )}
                  <text
                    x={barX + barW + 14}
                    y={y + 15}
                    fill="var(--color-text-muted)"
                    style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-family)' }}
                  >
                    {row.clearTrails}/{row.totalTrails} ổn định • {row.activeCount} cảnh báo
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Clickable Regional Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
          {regionalMatrix.map((row) => {
            const active = regionFilter === row.region;
            const statusColor =
              row.riskLevel === 'high'
                ? 'var(--color-error-text, var(--color-error))'
                : row.riskLevel === 'moderate'
                  ? 'var(--color-sun)'
                  : 'var(--color-primary)';
            const statusLabel =
              row.riskLevel === 'high'
                ? 'Cảnh báo cao'
                : row.riskLevel === 'moderate'
                  ? 'Cần lưu ý'
                  : 'Ổn định';

            return (
              <button
                key={row.region}
                type="button"
                onClick={() => handleToggleRegionFilter(row.region)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: active
                    ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-main))'
                    : 'var(--color-bg-main)',
                  border: active ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                    {row.region}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                    {row.totalTrails} tuyến • {row.activeCount} sự cố đang mở
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 4,
                    color: statusColor,
                    background: `color-mix(in srgb, ${statusColor} 14%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${statusColor} 35%, transparent)`,
                    flexShrink: 0,
                  }}
                >
                  {statusLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split: Left Filterable Incident Feed | Right Live Trail Condition Inspector */}
      <div className="wizard-grid-2-wide" style={{ alignItems: 'start' }}>
        {/* LEFT COLUMN: Filterable Incident Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: '14px 16px', borderRadius: 4, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconShieldAlert size={16} color="var(--color-error)" />
                <span>Cảnh báo mới từ đường rừng ({filteredIncidents.length})</span>
              </div>

              {/* Status Switcher */}
              <div style={{ display: 'inline-flex', gap: 4, background: 'var(--color-bg-main)', padding: 3, borderRadius: 4, border: '1px solid var(--color-border)' }}>
                {([
                  { id: 'active', label: 'Đang mở' },
                  { id: 'resolved', label: 'Đã xử lý' },
                  { id: 'all', label: 'Tất cả' },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: statusFilter === tab.id ? 'var(--color-primary)' : 'transparent',
                      color: statusFilter === tab.id ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search + Severity Filter Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <IconSearch
                  size={14}
                  color="var(--color-text-dim)"
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  id="radar-incident-search"
                  type="text"
                  className="form-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm cung đường, tỉnh, loại sự cố..."
                  aria-label="Tìm kiếm sự cố theo cung đường, tỉnh hoặc loại sự cố"
                  style={{ width: '100%', padding: '7px 10px 7px 32px', fontSize: '0.8rem', borderRadius: 4 }}
                />
              </div>

              <select
                id="radar-severity-filter"
                className="form-select"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as 'all' | 'critical' | 'high' | 'medium' | 'low')}
                aria-label="Lọc theo mức độ nghiêm trọng của sự cố"
                style={{ padding: '7px 10px', fontSize: '0.8rem', borderRadius: 4 }}
              >
                <option value="all">Mọi mức độ nghiêm trọng</option>
                <option value="critical">Cấp 1 — Khẩn cấp</option>
                <option value="high">Cấp 2 — Nguy hiểm cao</option>
                <option value="medium">Cấp 3 — Trung bình</option>
                <option value="low">Cấp 4 — Lưu ý nhẹ</option>
              </select>
            </div>
          </div>

          {/* Incident Cards */}
          {filteredIncidents.length === 0 ? (
            <div
              className="card"
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                borderRadius: 4,
                background: 'var(--color-bg-card)',
                border: '1px dashed var(--color-border-strong)',
                color: 'var(--color-text-muted)',
              }}
            >
              <IconShieldCheck size={32} color="var(--color-primary)" style={{ margin: '0 auto 10px', display: 'block', opacity: 0.7 }} />
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 4 }}>
                Chưa có cảnh báo nào khớp bộ lọc này
              </div>
              <p style={{ fontSize: '0.8rem', margin: 0 }}>
                Nếu vừa gặp sạt lở, suối xiết hay cây đổ trên đường, bấm &ldquo;Báo sự cố mới&rdquo; để nhắc anh em đi sau nhé.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredIncidents.map((inc) => {
                const incMeta = inc as IncidentWithMeta;
                const incId = getIncidentId(inc);
                const isSynthetic = isSyntheticIncident(incMeta);
                const sev = SEVERITY_META[inc.severity] || SEVERITY_META.medium;
                const matchedTrail = matchTrailForIncident(inc);
                const confirmations = localConfirmedMap[`${currentUserId}:${incId}`] ?? (inc.confirmations || 1);
                const isConfirming = confirmingId === incId;
                const isDisputeOpen = disputingIncidentId === incId;

                return (
                  <article
                    key={incId}
                    className="card"
                    style={{
                      padding: '16px 18px',
                      borderRadius: 4,
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                      borderLeft: `3px solid ${inc.resolved ? 'var(--color-primary)' : sev.color}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: `color-mix(in srgb, ${inc.resolved ? 'var(--color-primary)' : sev.color} 15%, transparent)`,
                            color: inc.resolved ? 'var(--color-primary)' : sev.color,
                            border: `1px solid color-mix(in srgb, ${inc.resolved ? 'var(--color-primary)' : sev.color} 35%, transparent)`,
                          }}
                        >
                          {inc.resolved ? 'Đã khắc phục' : sev.label}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: 'var(--color-bg-main)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          {INCIDENT_TYPE_LABELS[inc.type] || inc.type}
                        </span>
                        {isSynthetic && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: 'color-mix(in srgb, var(--color-sky) 14%, transparent)',
                              border: '1px solid color-mix(in srgb, var(--color-sky) 35%, transparent)',
                              color: 'var(--color-sky)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <IconRadar size={11} color="var(--color-sky)" />
                            <span>Tín hiệu vệ tinh tự động (chỉ xem)</span>
                          </span>
                        )}
                      </div>

                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatDateTime(inc.reportedAt)}
                      </span>
                    </div>

                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <IconMountain size={15} color="var(--color-primary)" />
                        <span>{inc.trailName || matchedTrail?.name || 'Khu vực thực địa'}</span>
                        {matchedTrail && (
                          <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--color-text-dim)' }}>
                            ({matchedTrail.province} • {matchedTrail.region})
                          </span>
                        )}
                      </h3>
                      {inc.locationNote && (
                        <div style={{ fontSize: '0.76rem', color: 'var(--color-sky)', fontWeight: 700, marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <IconMapPin size={12} color="var(--color-sky)" />
                          <span>{inc.locationNote}</span>
                        </div>
                      )}
                      <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                        {inc.description}
                      </p>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                        paddingTop: 10,
                        borderTop: '1px solid var(--color-border)',
                      }}
                    >
                      <span style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {isSynthetic
                          ? `Nguồn đo tự động: ${formatTelemetrySource(inc.verifiedBy)}`
                          : `${confirmations} người đã xác nhận tại chỗ`}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {!inc.resolved && !isSynthetic && (
                          <>
                            <button
                              type="button"
                              disabled={isConfirming}
                              onClick={() => handleConfirmIncident(inc)}
                              className="btn btn-outline"
                              style={{
                                padding: '5px 10px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                borderRadius: 4,
                                color: 'var(--color-primary)',
                                borderColor: 'color-mix(in srgb, var(--color-primary) 45%, transparent)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <IconCheckCircle size={13} color="var(--color-primary)" />
                              <span>{isConfirming ? 'Đang gửi...' : 'Xác nhận'}</span>
                            </button>
                            <button
                              type="button"
                              disabled={isConfirming}
                              onClick={() => {
                                if (isDisputeOpen) {
                                  setDisputingIncidentId(null);
                                  setDisputeReason('');
                                } else {
                                  setDisputingIncidentId(incId);
                                  setDisputeReason('');
                                }
                              }}
                              className="btn btn-outline"
                              style={{
                                padding: '5px 10px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                borderRadius: 4,
                                color: 'var(--color-error-text, var(--color-error))',
                                borderColor: 'color-mix(in srgb, var(--color-error) 42%, transparent)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <IconAlertTriangle size={13} color="var(--color-error-text, var(--color-error))" />
                              <span>Báo sai</span>
                            </button>
                          </>
                        )}

                        {matchedTrail && onSelectTrail && (
                          <button
                            type="button"
                            onClick={() => onSelectTrail(matchedTrail)}
                            className="btn btn-outline"
                            style={{ padding: '5px 10px', fontSize: '0.74rem', fontWeight: 700, borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <span>Xem cung</span>
                            <IconArrowRight size={12} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenAiGoNoGo(matchedTrail, inc.description)}
                          className="btn btn-sky"
                          style={{ padding: '5px 10px', fontSize: '0.74rem', fontWeight: 700, borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <IconBot size={13} color="var(--color-on-primary)" />
                          <span>Đi hay hoãn?</span>
                        </button>
                      </div>
                    </div>

                    {isDisputeOpen && !inc.resolved && !isSynthetic && (
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 4,
                          background: 'var(--color-bg-main)',
                          border: '1px solid color-mix(in srgb, var(--color-error) 35%, var(--color-border))',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <label
                          htmlFor={`dispute-reason-${incId}`}
                          style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-main)' }}
                        >
                          Lý do báo sai / hiện trường đã thông thoáng:
                        </label>
                        <input
                          id={`dispute-reason-${incId}`}
                          type="text"
                          className="form-input"
                          value={disputeReason}
                          onChange={(e) => setDisputeReason(e.target.value)}
                          placeholder="VD: Đoàn mình vừa qua sáng nay, đường đã dọn sạch và đi lại an toàn..."
                          maxLength={300}
                          style={{ fontSize: '0.78rem', padding: '6px 10px', borderRadius: 4 }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-outline"
                            disabled={isConfirming}
                            onClick={() => {
                              setDisputingIncidentId(null);
                              setDisputeReason('');
                            }}
                            style={{ padding: '4px 10px', fontSize: '0.72rem', borderRadius: 4 }}
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            disabled={isConfirming}
                            onClick={() => void handleSubmitDisputeIncident(inc)}
                            style={{ padding: '4px 12px', fontSize: '0.72rem', borderRadius: 4 }}
                          >
                            {isConfirming ? 'Đang gửi...' : 'Gửi báo sai'}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Tình trạng mặt đường mới nhất */}
        <div
          className="card"
          style={{
            padding: '18px 20px',
            borderRadius: 4,
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-sky)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconCompass size={13} color="var(--color-sky)" />
              <span>Mặt đường mấy hôm nay ra sao</span>
            </div>
            <h3 style={{ margin: '4px 0 6px 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
              Hỏi thăm tình trạng từng cung ({trails.length} cung)
            </h3>
            <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
              Xem ghi nhận mặt đường, độ trơn, nguồn nước của anh em vừa đi về trong 7 ngày gần nhất.
            </p>
          </div>

          <label
            htmlFor="radar-inspected-trail"
            style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', marginBottom: 4 }}
          >
            Chọn cung muốn xem
          </label>
          <select
            id="radar-inspected-trail"
            className="form-select"
            value={activeInspectedTrailId}
            onChange={(e) => setInspectedTrailId(e.target.value)}
            aria-label="Chọn cung đường để xem tình trạng mặt đường thực địa"
            style={{ width: '100%', padding: '9px 10px', fontSize: '0.82rem', borderRadius: 4 }}
          >
            {trails.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.province} • {t.maxAltitudeM}m)
              </option>
            ))}
          </select>

          {inspectedTrail && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 4,
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '0.86rem', color: 'var(--color-text-main)' }}>
                  {inspectedTrail.name}
                </strong>
                <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                  Cấp {inspectedTrail.difficultyLevel}/5
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                Cứu hộ địa bàn:{' '}
                <a
                  href={`tel:${extractRescueDialNumber(inspectedTrail.rescueContact?.phone)}`}
                  style={{
                    color: 'var(--color-error-text, var(--color-error))',
                    fontWeight: 800,
                    textDecoration: 'underline',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {inspectedTrail.rescueContact?.phone || '112 / 114'}
                </a>{' '}
                ({inspectedTrail.rescueContact?.name || 'Cứu hộ quốc gia'})
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleOpenAiGoNoGo(inspectedTrail)}
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center', padding: '7px 10px', fontSize: '0.76rem', fontWeight: 800, borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <IconBot size={14} color="var(--color-on-primary)" />
                  <span>Xem nên đi hay hoãn</span>
                </button>
                {onSelectTrail && (
                  <button
                    type="button"
                    onClick={() => onSelectTrail(inspectedTrail)}
                    className="btn btn-outline"
                    style={{ padding: '7px 12px', fontSize: '0.76rem', fontWeight: 700, borderRadius: 4 }}
                  >
                    Chi tiết cung
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Live Condition Reports List */}
          {loadingConditions ? (
            <div style={{ textAlign: 'center', padding: '20px 12px', fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>
              Đang tải ghi nhận mặt đường...
            </div>
          ) : conditions.length === 0 ? (
            <div
              style={{
                padding: '18px 14px',
                borderRadius: 4,
                background: 'var(--color-bg-main)',
                border: '1px dashed var(--color-border)',
                textAlign: 'center',
                fontSize: '0.78rem',
                color: 'var(--color-text-muted)',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ display: 'block', color: 'var(--color-text-main)', marginBottom: 4 }}>
                7 ngày qua chưa có ai báo thêm về cung này
              </strong>
              Bạn nhớ xem thêm dự báo thời tiết đỉnh và gọi trước cho kiểm lâm địa phương trước khi lên đường nhé.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
              {conditions.map((c) => {
                const cMeta = CONDITION_META[c.condition] || CONDITION_META.caution;
                const upvoteCount = c.upvotes ?? c.upvotesCount ?? 0;
                const isUpvoting = upvotingConditionId === c._id;
                return (
                  <div
                    key={c._id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 4,
                      background: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border)',
                      borderLeft: `3px solid ${cMeta.color}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          color: cMeta.color,
                          background: `color-mix(in srgb, ${cMeta.color} 14%, transparent)`,
                          padding: '2px 7px',
                          borderRadius: 4,
                        }}
                      >
                        {cMeta.label}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>
                        {formatDateTime(c.createdAt)}
                      </span>
                    </div>
                    {c.section && (
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                        Đoạn tuyến: {c.section}
                      </div>
                    )}
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                      {c.description}
                    </div>
                    {c.weatherNote && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-sky)', fontWeight: 600 }}>
                        Thời tiết ghi nhận: {c.weatherNote}
                      </div>
                    )}
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <span>Bởi: {c.userId?.fullName || 'Người đi rừng'}</span>
                      <button
                        type="button"
                        disabled={isUpvoting || Boolean(c.hasUpvoted)}
                        onClick={() => void handleUpvoteCondition(c)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          cursor: c.hasUpvoted ? 'default' : 'pointer',
                          border: c.hasUpvoted
                            ? '1px solid var(--color-primary)'
                            : '1px solid var(--color-border-strong)',
                          background: c.hasUpvoted
                            ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)'
                            : 'var(--color-bg-card)',
                          color: c.hasUpvoted ? 'var(--color-primary)' : 'var(--color-text-main)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        <IconCheckCircle size={11} color={c.hasUpvoted ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
                        <span>{c.hasUpvoted ? 'Đã hữu ích' : 'Hữu ích'} ({upvoteCount})</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
