import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Trail, UserProfile } from '../../types.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { buildRecordedGpxXml } from '../../utils/geoMath.js';
import {
  IconMountain,
  IconCompass,
  IconDownload,
  IconEdit,
  IconCheck,
  IconX,
  IconShieldCheck,
  IconTrash,
} from '../common/SvgIcons.js';

type TrailWithMongoId = Trail & { _id?: string };

export interface RawCheckinInput {
  _id?: string;
  id?: string;
  trailId?: Partial<TrailWithMongoId> | string;
  trailName?: string;
  name?: string;
  province?: string;
  region?: string;
  distanceKm?: number;
  distanceRecordedKm?: number;
  effectiveDistanceKm?: number;
  elevationGainM?: number;
  elevationGainRecordedM?: number;
  effectiveElevationGainM?: number;
  maxAltitudeM?: number;
  difficultyLevel?: number;
  checkinDate?: string;
  createdAt?: string;
  completionTimeHours?: number;
  verifiedBadge?: boolean;
  notes?: string;
  weatherObserved?: string;
  packWeightKg?: number;
  companionsCount?: number;
  isPublic?: boolean;
}

export type ProfileAnalyticsUser = (Partial<UserProfile> & { _id?: string }) | null;

interface ServerAnalyticsMonthlyPoint {
  month?: string;
  key?: string;
  label?: string;
  distanceKm?: number;
  km?: number;
  elevationGainM?: number;
  gainM?: number;
  trips?: number;
  count?: number;
}

interface ServerAnalyticsRegionRow {
  region?: string;
  uniqueConquered?: number;
  conqueredCount?: number;
  count?: number;
  totalAvailable?: number;
  totalTrails?: number;
}

interface ServerAnalyticsPayload {
  summary?: {
    totalDistanceKm?: number;
    totalElevationGainM?: number;
  };
  monthlySeries?: ServerAnalyticsMonthlyPoint[];
  regionBreakdown?: ServerAnalyticsRegionRow[];
}

export interface ProfileAnalyticsPanelProps {
  trails: Trail[];
  checkins: RawCheckinInput[];
  currentUser: ProfileAnalyticsUser;
  onSelectTrail?: (trail: Trail) => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onLogbookChanged?: () => void;
}

interface MonthlyPoint {
  key: string;
  label: string;
  km: number;
  gainM: number;
  trips: number;
}

interface LogbookItem {
  id: string;
  trailId: string;
  trailName: string;
  province: string;
  region: string;
  distanceKm: number;
  elevationGainM: number;
  maxAltitudeM: number;
  difficultyLevel: number;
  checkinDate: string;
  completionTimeHours: number;
  verifiedBadge: boolean;
  notes: string;
  weatherObserved: string;
  packWeightKg?: number;
  companionsCount: number;
  isPublic: boolean;
  isServerEntry: boolean;
}

const buildLast12MonthsSkeleton = (): MonthlyPoint[] => {
  const now = new Date();
  const out: MonthlyPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({
      key,
      label: `T${d.getMonth() + 1}`,
      km: 0,
      gainM: 0,
      trips: 0,
    });
  }
  return out;
};

const API_BASE_URL = '/api';

const getCurrentVietnamYear = (): number => {
  try {
    const yearStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
    }).format(new Date());
    const parsed = Number(yearStr);
    if (Number.isFinite(parsed)) {
      return Math.max(2024, Math.min(2035, Math.round(parsed)));
    }
  } catch {
    // Fallback to local clock if Intl timeZone is unavailable
  }
  return Math.max(2024, Math.min(2035, new Date().getFullYear()));
};

const getDefaultAnnualGoals = (): AnnualTrekGoals => ({
  year: getCurrentVietnamYear(),
  targetKm: 120,
  targetElevationM: 8000,
  targetPeaks: 6,
});

interface AnnualTrekGoals {
  year: number;
  targetKm: number;
  targetElevationM: number;
  targetPeaks: number;
}

interface StoredAnnualGoalsRecord {
  goals: AnnualTrekGoals;
  pendingSync: boolean;
}

type GoalSyncState = 'syncing' | 'synced' | 'local_only';

const getAnnualGoalsStorageKey = (uid?: string | null): string =>
  uid ? `lost_annual_goals_v2_${uid}` : 'lost_annual_goals_v2_guest';

const normalizeAnnualGoals = (raw: unknown): AnnualTrekGoals => {
  const defaults = getDefaultAnnualGoals();
  const currentVnYear = defaults.year;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaults;
  }
  const rec = raw as Record<string, unknown>;
  const parseIntRange = (val: unknown, min: number, max: number, fallback: number): number => {
    if (typeof val === 'boolean' || val === null || val === undefined || val === '') return fallback;
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    const rounded = Math.round(n);
    return rounded >= min && rounded <= max ? rounded : fallback;
  };
  const parsedYear = parseIntRange(rec.year, 2024, 2035, currentVnYear);
  return {
    // Automatically roll forward stale prior-year records to current Vietnam year
    year: Math.max(currentVnYear, parsedYear),
    targetKm: parseIntRange(rec.targetKm, 10, 5000, defaults.targetKm),
    targetElevationM: parseIntRange(rec.targetElevationM, 500, 200000, defaults.targetElevationM),
    targetPeaks: parseIntRange(rec.targetPeaks, 1, 36, defaults.targetPeaks),
  };
};

const readAnnualTrekGoals = (uid?: string | null): StoredAnnualGoalsRecord => {
  if (typeof window === 'undefined') {
    return { goals: getDefaultAnnualGoals(), pendingSync: false };
  }
  try {
    const raw = localStorage.getItem(getAnnualGoalsStorageKey(uid));
    if (!raw) return { goals: getDefaultAnnualGoals(), pendingSync: false };
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    return {
      goals: normalizeAnnualGoals(parsed),
      pendingSync: Boolean(parsed && typeof parsed === 'object' && parsed.pendingSync === true),
    };
  } catch {
    return { goals: getDefaultAnnualGoals(), pendingSync: false };
  }
};

const persistAnnualTrekGoals = (
  uid: string | null | undefined,
  goals: AnnualTrekGoals,
  pendingSync = false
): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      getAnnualGoalsStorageKey(uid),
      JSON.stringify({ ...goals, pendingSync })
    );
  } catch {
    // ignore storage quota errors
  }
};

const GOAL_PRESETS: ReadonlyArray<{
  label: string;
  targetKm: number;
  targetElevationM: number;
  targetPeaks: number;
}> = [
  { label: 'Khởi Động', targetKm: 80, targetElevationM: 4500, targetPeaks: 4 },
  { label: 'Chinh Phục', targetKm: 120, targetElevationM: 8000, targetPeaks: 6 },
  { label: 'Alpine Chuyên Sâu', targetKm: 300, targetElevationM: 20000, targetPeaks: 12 },
];

export const ProfileAnalyticsPanel: React.FC<ProfileAnalyticsPanelProps> = ({
  trails,
  checkins,
  currentUser,
  onSelectTrail,
  onShowToast,
  onLogbookChanged,
}) => {
  const userId = String(currentUser?.id || currentUser?._id || '');
  const hasStoredToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('lost_token'));
  const [serverAnalytics, setServerAnalytics] = useState<ServerAnalyticsPayload | null>(null);
  const [serverLogs, setServerLogs] = useState<RawCheckinInput[] | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(hasStoredToken && userId));
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);
  const [logRegionFilter, setLogRegionFilter] = useState<string>('all');
  const [logYearFilter, setLogYearFilter] = useState<string>('all');
  const [logVerifiedOnly, setLogVerifiedOnly] = useState<boolean>(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editWeather, setEditWeather] = useState('');
  const [editPackKg, setEditPackKg] = useState('');
  const [editCompletionHours, setEditCompletionHours] = useState('');
  const [editDistanceKm, setEditDistanceKm] = useState('');
  const [editElevationGainM, setEditElevationGainM] = useState('');
  const [editCompanionsCount, setEditCompanionsCount] = useState('1');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const [confirmDeleteLogId, setConfirmDeleteLogId] = useState<string | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

  const [annualGoals, setAnnualGoals] = useState<AnnualTrekGoals>(
    () => readAnnualTrekGoals(userId).goals
  );
  const [goalSyncState, setGoalSyncState] = useState<GoalSyncState>(() =>
    hasStoredToken && userId ? 'syncing' : 'local_only'
  );
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [isSavingGoals, setIsSavingGoals] = useState(false);
  const [draftTargetKm, setDraftTargetKm] = useState<string>(() =>
    String(readAnnualTrekGoals(userId).goals.targetKm)
  );
  const [draftTargetElevationM, setDraftTargetElevationM] = useState<string>(() =>
    String(readAnnualTrekGoals(userId).goals.targetElevationM)
  );
  const [draftTargetPeaks, setDraftTargetPeaks] = useState<string>(() =>
    String(readAnnualTrekGoals(userId).goals.targetPeaks)
  );
  const [authSyncTick, setAuthSyncTick] = useState(0);
  const saveGoalsAbortRef = useRef<AbortController | null>(null);
  const goalsRevisionRef = useRef<number>(0);
  const activeUserIdRef = useRef<string>(userId);
  const isEditingGoalsRef = useRef<boolean>(isEditingGoals);
  const onShowToastRef = useRef(onShowToast);

  useEffect(() => {
    activeUserIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    isEditingGoalsRef.current = isEditingGoals;
  }, [isEditingGoals]);

  useEffect(() => {
    onShowToastRef.current = onShowToast;
  }, [onShowToast]);

  // Reset per-user annual goal & cloud analytics state cleanly whenever active account or auth status changes
  const authSessionKey = `${userId}:${hasStoredToken ? 'auth' : 'guest'}`;
  const [prevAuthSessionKey, setPrevAuthSessionKey] = useState(authSessionKey);
  if (prevAuthSessionKey !== authSessionKey) {
    setPrevAuthSessionKey(authSessionKey);
    const localNext = readAnnualTrekGoals(userId);
    setAnnualGoals(localNext.goals);
    setDraftTargetKm(String(localNext.goals.targetKm));
    setDraftTargetElevationM(String(localNext.goals.targetElevationM));
    setDraftTargetPeaks(String(localNext.goals.targetPeaks));
    setIsEditingGoals(false);
    setIsSavingGoals(false);
    setServerAnalytics(null);
    setServerLogs(null);
    setLoading(Boolean(hasStoredToken && userId));
    setGoalSyncState(hasStoredToken && userId ? 'syncing' : 'local_only');
  }

  useEffect(() => {
    const handleAuthChanged = () => {
      setAuthSyncTick((prev) => prev + 1);
    };
    window.addEventListener('lost:auth-changed', handleAuthChanged);
    return () => {
      window.removeEventListener('lost:auth-changed', handleAuthChanged);
      saveGoalsAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    // Abort any in-flight PATCH belonging to a previous account / auth session
    saveGoalsAbortRef.current?.abort();
    saveGoalsAbortRef.current = null;
    goalsRevisionRef.current += 1;

    const token = typeof window !== 'undefined' ? localStorage.getItem('lost_token') : null;
    if (!token || !userId) {
      return;
    }

    const fetchRev = goalsRevisionRef.current;
    const localSnapshot = readAnnualTrekGoals(userId);
    const controller = new AbortController();
    const { signal } = controller;
    const run = async () => {
      try {
        const [analyticsRes, logsRes, goalsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/logbook/analytics/me`, { headers: getApiHeaders(), signal })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch(`${API_BASE_URL}/logbook/me?limit=200`, { headers: getApiHeaders(), signal })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch(`${API_BASE_URL}/users/me/goals`, { headers: getApiHeaders(), signal })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ]);
        if (signal.aborted) return;
        if (analyticsRes?.success && analyticsRes.data) {
          setServerAnalytics(analyticsRes.data as ServerAnalyticsPayload);
        }
        if (logsRes?.success && Array.isArray(logsRes.data)) {
          setServerLogs(logsRes.data as RawCheckinInput[]);
        }

        // Skip goal overwrite if user has already started a newer PATCH revision
        if (goalsRevisionRef.current !== fetchRev) {
          return;
        }

        // If user has unsynced offline edits, replay PATCH to cloud instead of clobbering them
        if (localSnapshot.pendingSync) {
          try {
            const replayRes = await fetch(`${API_BASE_URL}/users/me/goals`, {
              method: 'PATCH',
              headers: getApiHeaders({ 'Content-Type': 'application/json' }),
              signal,
              body: JSON.stringify(localSnapshot.goals),
            });
            const replayJson = await replayRes.json().catch(() => null);
            if (signal.aborted || goalsRevisionRef.current !== fetchRev) return;
            if (replayRes.ok && replayJson?.success) {
              const synced = normalizeAnnualGoals(replayJson.data || replayJson.goals || localSnapshot.goals);
              setAnnualGoals(synced);
              persistAnnualTrekGoals(userId, synced, false);
              setGoalSyncState('synced');
              return;
            }
          } catch {
            if (signal.aborted) return;
          }
          setGoalSyncState('local_only');
          return;
        }

        const rawGoals = goalsRes?.success ? (goalsRes.data || goalsRes.goals) : null;
        if (rawGoals && typeof rawGoals === 'object') {
          const synced = normalizeAnnualGoals(rawGoals);
          setAnnualGoals(synced);
          persistAnnualTrekGoals(userId, synced, false);
          setGoalSyncState('synced');
          if (isEditingGoalsRef.current) {
            onShowToastRef.current?.(
              `Đã cập nhật mục tiêu năm ${synced.year} từ đám mây (bản nháp của bạn vẫn được giữ nguyên).`,
              'info'
            );
          }
        } else {
          setGoalSyncState('local_only');
        }
      } catch {
        if (!signal.aborted && goalsRevisionRef.current === fetchRev) {
          setGoalSyncState('local_only');
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };
    void run();
    return () => {
      controller.abort();
      saveGoalsAbortRef.current?.abort();
    };
  }, [userId, authSyncTick]);

  const trailLookup = useMemo(() => {
    const m = new Map<string, Trail>();
    trails.forEach((t) => {
      m.set(String(t.id), t);
      const mid = (t as TrailWithMongoId)._id;
      if (mid) m.set(String(mid), t);
    });
    return m;
  }, [trails]);

  // Unified normalized logbook entries (prefers server /api/logbook/me, falls back to checkins prop)
  const logEntries: LogbookItem[] = useMemo(() => {
    const source = serverLogs && serverLogs.length > 0 ? serverLogs : checkins;
    if (!Array.isArray(source)) return [];

    return source
      .map((item, idx) => {
        const rawTrailObj =
          item.trailId && typeof item.trailId === 'object' ? item.trailId : null;
        const resolvedId = String(
          rawTrailObj?.id ||
            rawTrailObj?._id ||
            (typeof item.trailId === 'string' ? item.trailId : '') ||
            item.id ||
            `entry-${idx}`
        );
        const matched = trailLookup.get(resolvedId) || rawTrailObj;

        return {
          id: String(item._id || item.id || `local-${resolvedId}-${idx}`),
          trailId: String(matched?.id || resolvedId),
          trailName: matched?.name || item.trailName || item.name || 'Cung đường LOST',
          province: matched?.province || item.province || 'Việt Nam',
          region: matched?.region || item.region || 'Miền Bắc',
          distanceKm: Number(
            item.distanceRecordedKm ?? item.effectiveDistanceKm ?? matched?.distanceKm ?? item.distanceKm ?? 0
          ),
          elevationGainM: Number(
            item.elevationGainRecordedM ??
              item.effectiveElevationGainM ??
              matched?.elevationGainM ??
              item.elevationGainM ??
              0
          ),
          maxAltitudeM: Number(matched?.maxAltitudeM ?? item.maxAltitudeM ?? 0),
          difficultyLevel: Number(matched?.difficultyLevel ?? item.difficultyLevel ?? 3),
          checkinDate: item.checkinDate || item.createdAt || new Date().toISOString(),
          completionTimeHours: Number(item.completionTimeHours || (matched?.durationDays || 1) * 7),
          verifiedBadge: Boolean(item.verifiedBadge),
          notes: item.notes || '',
          weatherObserved: item.weatherObserved || '',
          packWeightKg: item.packWeightKg !== undefined ? Number(item.packWeightKg) : undefined,
          companionsCount:
            item.companionsCount !== undefined && Number.isFinite(Number(item.companionsCount))
              ? Math.max(1, Math.round(Number(item.companionsCount)))
              : 1,
          isPublic: Boolean(item.isPublic),
          isServerEntry: Boolean(serverLogs && item._id),
        };
      })
      .sort((a, b) => new Date(b.checkinDate).getTime() - new Date(a.checkinDate).getTime());
  }, [serverLogs, checkins, trailLookup]);

  // Monthly 12-month dual-bar data
  const monthlySeries: MonthlyPoint[] = useMemo(() => {
    if (Array.isArray(serverAnalytics?.monthlySeries) && serverAnalytics.monthlySeries.length > 0) {
      return serverAnalytics.monthlySeries.slice(-12).map((pt) => ({
        key: String(pt.month || pt.key || ''),
        label: pt.label || `T${Number(String(pt.month || '01').slice(-2)) || 1}`,
        km: Math.round(Number(pt.distanceKm ?? pt.km ?? 0) * 10) / 10,
        gainM: Math.round(Number(pt.elevationGainM ?? pt.gainM ?? 0)),
        trips: Number(pt.trips ?? pt.count ?? 0),
      }));
    }
    const base = buildLast12MonthsSkeleton();
    const byKey = new Map(base.map((b) => [b.key, b]));
    logEntries.forEach((entry) => {
      const d = new Date(entry.checkinDate);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = byKey.get(key);
      if (bucket) {
        bucket.km = Math.round((bucket.km + entry.distanceKm) * 10) / 10;
        bucket.gainM += entry.elevationGainM;
        bucket.trips += 1;
      }
    });
    return base;
  }, [serverAnalytics, logEntries]);

  // Regional conquest breakdown
  const regionalStats = useMemo(() => {
    const regions: Array<{ name: 'Miền Bắc' | 'Miền Trung' | 'Miền Nam'; color: string }> = [
      { name: 'Miền Bắc', color: 'var(--color-primary)' },
      { name: 'Miền Trung', color: 'var(--color-sky)' },
      { name: 'Miền Nam', color: 'var(--color-earth)' },
    ];
    const uniqueConqueredIds = new Set(logEntries.map((e) => e.trailId));
    return regions.map((r) => {
      const serverRow = Array.isArray(serverAnalytics?.regionBreakdown)
        ? serverAnalytics.regionBreakdown.find((x) => x.region === r.name)
        : null;
      const catalogTotal = trails.filter((t) => t.region === r.name).length || 1;
      const conquered = serverRow
        ? Number(serverRow.uniqueConquered ?? serverRow.conqueredCount ?? serverRow.count ?? 0)
        : trails.filter((t) => t.region === r.name && uniqueConqueredIds.has(String(t.id))).length;
      const total = serverRow
        ? Number(serverRow.totalAvailable ?? serverRow.totalTrails ?? catalogTotal) || catalogTotal
        : catalogTotal;
      return {
        ...r,
        conquered,
        total,
        percent: Math.min(100, Math.round((conquered / Math.max(1, total)) * 100)),
      };
    });
  }, [trails, logEntries, serverAnalytics]);

  // Difficulty distribution (1..5)
  const difficultyBars = useMemo(() => {
    const labels = ['1/5 Rất dễ', '2/5 Dễ', '3/5 Trung bình', '4/5 Thử thách', '5/5 Khắc nghiệt'];
    const counts = [0, 0, 0, 0, 0];
    logEntries.forEach((e) => {
      const lvl = Math.min(5, Math.max(1, Math.round(e.difficultyLevel || 3)));
      counts[lvl - 1] += 1;
    });
    const maxVal = Math.max(1, ...counts);
    return counts.map((count, i) => ({
      level: i + 1,
      label: labels[i],
      count,
      pct: Math.round((count / maxVal) * 100),
    }));
  }, [logEntries]);

  // Altitude band distribution
  const altitudeBands = useMemo(() => {
    const bands = [
      { key: '<1000m', label: 'Dưới 1.000m (Đồi / Rừng thấp)', min: 0, max: 999, color: 'var(--color-stream)', count: 0 },
      { key: '1000-2000m', label: '1.000m – 2.000m (Cao nguyên)', min: 1000, max: 1999, color: 'var(--color-sky)', count: 0 },
      { key: '2000-2800m', label: '2.000m – 2.800m (Săn mây)', min: 2000, max: 2799, color: 'var(--color-sun)', count: 0 },
      { key: '>2800m', label: 'Trên 2.800m (Đỉnh Alpine)', min: 2800, max: 9999, color: 'var(--color-primary)', count: 0 },
    ];
    logEntries.forEach((e) => {
      const alt = e.maxAltitudeM || 0;
      const b = bands.find((x) => alt >= x.min && alt <= x.max);
      if (b) b.count += 1;
    });
    const maxVal = Math.max(1, ...bands.map((b) => b.count));
    return bands.map((b) => ({ ...b, pct: Math.round((b.count / maxVal) * 100) }));
  }, [logEntries]);

  // Personal records
  const personalRecords = useMemo(() => {
    const totalKm =
      serverAnalytics?.summary?.totalDistanceKm ??
      Math.round(logEntries.reduce((s, e) => s + e.distanceKm, 0) * 10) / 10;
    const totalGain =
      serverAnalytics?.summary?.totalElevationGainM ??
      logEntries.reduce((s, e) => s + e.elevationGainM, 0);
    const highest = logEntries.reduce<LogbookItem | null>(
      (best, e) => (!best || e.maxAltitudeM > best.maxAltitudeM ? e : best),
      null
    );
    const longest = logEntries.reduce<LogbookItem | null>(
      (best, e) => (!best || e.distanceKm > best.distanceKm ? e : best),
      null
    );
    const verifiedPct =
      logEntries.length > 0
        ? Math.round((logEntries.filter((e) => e.verifiedBadge).length / logEntries.length) * 100)
        : 0;
    return { totalKm, totalGain, highest, longest, verifiedPct };
  }, [serverAnalytics, logEntries]);

  // Annual Trek Goals Progress (km, elevation gain, unique peaks)
  const annualProgress = useMemo(() => {
    const targetYear = annualGoals.year;
    const entriesForYear = logEntries.filter((e) => {
      const d = new Date(e.checkinDate);
      return !Number.isNaN(d.getTime()) && d.getFullYear() === targetYear;
    });
    const achievedKm = Math.round(entriesForYear.reduce((s, e) => s + e.distanceKm, 0) * 10) / 10;
    const achievedPeaks = new Set(entriesForYear.map((e) => e.trailId)).size;
    const achievedGainM = Math.round(entriesForYear.reduce((s, e) => s + e.elevationGainM, 0));
    const kmPct = Math.min(100, Math.round((achievedKm / Math.max(1, annualGoals.targetKm)) * 100));
    const gainPct = Math.min(
      100,
      Math.round((achievedGainM / Math.max(1, annualGoals.targetElevationM)) * 100)
    );
    const peaksPct = Math.min(
      100,
      Math.round((achievedPeaks / Math.max(1, annualGoals.targetPeaks)) * 100)
    );
    const kmRemaining = Math.max(0, Math.round((annualGoals.targetKm - achievedKm) * 10) / 10);
    const gainRemainingM = Math.max(0, annualGoals.targetElevationM - achievedGainM);
    const peaksRemaining = Math.max(0, annualGoals.targetPeaks - achievedPeaks);
    return {
      year: targetYear,
      entriesCount: entriesForYear.length,
      achievedKm,
      achievedPeaks,
      achievedGainM,
      kmPct,
      gainPct,
      peaksPct,
      kmRemaining,
      gainRemainingM,
      peaksRemaining,
    };
  }, [logEntries, annualGoals]);

  const handleOpenGoalEditor = () => {
    setDraftTargetKm(String(annualGoals.targetKm));
    setDraftTargetElevationM(String(annualGoals.targetElevationM));
    setDraftTargetPeaks(String(annualGoals.targetPeaks));
    setIsEditingGoals(true);
  };

  const handleSaveAnnualGoals = async () => {
    if (isSavingGoals) return;
    const parsedKm = Number(draftTargetKm);
    const parsedElev = Number(draftTargetElevationM);
    const parsedPeaks = Number(draftTargetPeaks);

    if (!Number.isInteger(parsedKm) || parsedKm < 10 || parsedKm > 5000) {
      onShowToast?.('Mục tiêu quãng đường năm phải là số nguyên từ 10 km đến 5.000 km.', 'error');
      return;
    }
    if (!Number.isInteger(parsedElev) || parsedElev < 500 || parsedElev > 200000) {
      onShowToast?.('Mục tiêu độ cao nâng năm phải là số nguyên từ 500 m đến 200.000 m.', 'error');
      return;
    }
    if (!Number.isInteger(parsedPeaks) || parsedPeaks < 1 || parsedPeaks > 36) {
      onShowToast?.('Mục tiêu số đỉnh năm phải là số nguyên từ 1 đến 36 đỉnh.', 'error');
      return;
    }

    const previousGoals = annualGoals;
    const previousSyncState: GoalSyncState = goalSyncState === 'syncing' ? 'local_only' : goalSyncState;
    const targetYear = Math.max(annualGoals.year, getCurrentVietnamYear());
    const next: AnnualTrekGoals = {
      year: targetYear,
      targetKm: parsedKm,
      targetElevationM: parsedElev,
      targetPeaks: parsedPeaks,
    };

    // Bump monotonic revision so any slower initial GET cannot clobber this PATCH
    goalsRevisionRef.current += 1;
    const saveUserId = userId;

    // Optimistic update + per-user localStorage persistence
    setAnnualGoals(next);

    const token = typeof window !== 'undefined' ? localStorage.getItem('lost_token') : null;
    if (!token || !saveUserId) {
      persistAnnualTrekGoals(saveUserId, next, false);
      setGoalSyncState('local_only');
      setIsEditingGoals(false);
      onShowToast?.(
        `Đã lưu mục tiêu năm ${next.year} cục bộ: ${next.targetKm} km · +${next.targetElevationM.toLocaleString('vi-VN')}m · ${next.targetPeaks} đỉnh.`,
        'info'
      );
      return;
    }

    persistAnnualTrekGoals(saveUserId, next, true);
    saveGoalsAbortRef.current?.abort();
    const controller = new AbortController();
    saveGoalsAbortRef.current = controller;

    setIsSavingGoals(true);
    setGoalSyncState('syncing');
    try {
      const res = await fetch(`${API_BASE_URL}/users/me/goals`, {
        method: 'PATCH',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        signal: controller.signal,
        body: JSON.stringify({
          year: next.year,
          targetKm: next.targetKm,
          targetElevationM: next.targetElevationM,
          targetPeaks: next.targetPeaks,
        }),
      });
      const json = await res.json().catch(() => null);
      if (controller.signal.aborted || activeUserIdRef.current !== saveUserId) return;

      if (res.ok && json?.success) {
        const authoritative = normalizeAnnualGoals(json.data || json.goals || next);
        setAnnualGoals(authoritative);
        persistAnnualTrekGoals(saveUserId, authoritative, false);
        setGoalSyncState('synced');
        setIsEditingGoals(false);
        onShowToast?.(
          `Đã đồng bộ mục tiêu năm ${authoritative.year}: ${authoritative.targetKm} km · +${authoritative.targetElevationM.toLocaleString('vi-VN')}m · ${authoritative.targetPeaks} đỉnh!`,
          'success'
        );
      } else if (res.status === 400) {
        // Revert optimistic update and restore prior sync state on server validation failure
        setAnnualGoals(previousGoals);
        persistAnnualTrekGoals(saveUserId, previousGoals, previousSyncState === 'local_only');
        setGoalSyncState(previousSyncState);
        onShowToast?.(json?.message || 'Giá trị mục tiêu năm không hợp lệ.', 'error');
      } else if (res.status === 401 || res.status === 403) {
        persistAnnualTrekGoals(saveUserId, next, true);
        setGoalSyncState('local_only');
        setIsEditingGoals(false);
        onShowToast?.(
          `Phiên đăng nhập đã hết hạn — mục tiêu năm ${next.year} đã lưu cục bộ. Vui lòng đăng nhập lại để đồng bộ đám mây.`,
          'error'
        );
      } else {
        persistAnnualTrekGoals(saveUserId, next, true);
        setGoalSyncState('local_only');
        setIsEditingGoals(false);
        onShowToast?.(
          `Đã lưu cục bộ mục tiêu năm ${next.year} (sẽ tự đồng bộ đám mây khi máy chủ sẵn sàng).`,
          'info'
        );
      }
    } catch {
      if (controller.signal.aborted || activeUserIdRef.current !== saveUserId) return;
      persistAnnualTrekGoals(saveUserId, next, true);
      setGoalSyncState('local_only');
      setIsEditingGoals(false);
      onShowToast?.(`Đã lưu cục bộ mục tiêu năm ${next.year} (chế độ ngoại tuyến — tự đồng bộ khi có mạng).`, 'info');
    } finally {
      if (!controller.signal.aborted && activeUserIdRef.current === saveUserId) {
        setIsSavingGoals(false);
      }
    }
  };

  const refreshServerAnalytics = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('lost_token') : null;
    if (!token || !userId) return;
    try {
      const r = await fetch(`${API_BASE_URL}/logbook/analytics/me`, { headers: getApiHeaders() });
      if (r.ok) {
        const json = (await r.json().catch(() => null)) as {
          success?: boolean;
          data?: ServerAnalyticsPayload;
        } | null;
        if (json?.success && json.data) {
          setServerAnalytics(json.data);
        }
      }
    } catch {
      // Ignore analytics refresh error
    }
  };

  const handleStartEdit = (entry: LogbookItem) => {
    setConfirmDeleteLogId(null);
    setEditingLogId(entry.id);
    setEditNotes(entry.notes);
    setEditWeather(entry.weatherObserved);
    setEditPackKg(entry.packWeightKg !== undefined ? String(entry.packWeightKg) : '');
    setEditCompletionHours(entry.completionTimeHours > 0 ? String(entry.completionTimeHours) : '');
    setEditDistanceKm(entry.distanceKm > 0 ? String(entry.distanceKm) : '');
    setEditElevationGainM(entry.elevationGainM >= 0 ? String(entry.elevationGainM) : '');
    setEditCompanionsCount(String(entry.companionsCount || 1));
    setEditIsPublic(entry.isPublic);
  };

  const handleSaveLogNote = async (entry: LogbookItem) => {
    if (savingLog) return;
    if (!entry.isServerEntry) {
      onShowToast?.('Chỉ ghi chú nhật ký đã đồng bộ máy chủ mới có thể chỉnh sửa trực tuyến.', 'info');
      setEditingLogId(null);
      return;
    }

    const payload: Record<string, unknown> = {
      notes: editNotes.trim(),
      weatherObserved: editWeather.trim(),
      isPublic: editIsPublic,
    };

    if (editCompletionHours.trim() !== '') {
      const hrs = Number(editCompletionHours);
      if (!Number.isFinite(hrs) || hrs < 0.2 || hrs > 240) {
        onShowToast?.('Thời gian hoàn thành phải nằm trong khoảng 0.2 – 240 giờ.', 'error');
        return;
      }
      payload.completionTimeHours = hrs;
    }
    if (editDistanceKm.trim() !== '') {
      const km = Number(editDistanceKm);
      if (!Number.isFinite(km) || km < 0 || km > 500) {
        onShowToast?.('Quãng đường ghi nhận phải nằm trong khoảng 0 – 500 km.', 'error');
        return;
      }
      payload.distanceRecordedKm = Math.round(km * 100) / 100;
    }
    if (editElevationGainM.trim() !== '') {
      const gain = Number(editElevationGainM);
      if (!Number.isFinite(gain) || gain < 0 || gain > 30000) {
        onShowToast?.('Tổng độ cao nâng phải nằm trong khoảng 0 – 30.000 m.', 'error');
        return;
      }
      payload.elevationGainRecordedM = Math.round(gain);
    }
    if (editCompanionsCount.trim() !== '') {
      const comp = Math.round(Number(editCompanionsCount));
      if (!Number.isFinite(comp) || comp < 1 || comp > 100) {
        onShowToast?.('Số thành viên đồng hành phải từ 1 đến 100 người.', 'error');
        return;
      }
      payload.companionsCount = comp;
    }
    if (editPackKg.trim() !== '') {
      const kg = Number(editPackKg);
      if (!Number.isFinite(kg) || kg < 0 || kg > 60) {
        onShowToast?.('Trọng lượng balo phải từ 0 đến 60 kg.', 'error');
        return;
      }
      payload.packWeightKg = Math.round(kg * 10) / 10;
    }

    setSavingLog(true);
    try {
      const res = await fetch(`/api/logbook/${encodeURIComponent(entry.id)}`, {
        method: 'PATCH',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setServerLogs((prev) =>
          (prev || []).map((item) =>
            String(item._id) === entry.id
              ? {
                  ...item,
                  notes: editNotes.trim(),
                  weatherObserved: editWeather.trim(),
                  isPublic: editIsPublic,
                  ...(payload.completionTimeHours !== undefined
                    ? { completionTimeHours: Number(payload.completionTimeHours) }
                    : {}),
                  ...(payload.distanceRecordedKm !== undefined
                    ? {
                        distanceRecordedKm: Number(payload.distanceRecordedKm),
                        effectiveDistanceKm: Number(payload.distanceRecordedKm),
                      }
                    : {}),
                  ...(payload.elevationGainRecordedM !== undefined
                    ? {
                        elevationGainRecordedM: Number(payload.elevationGainRecordedM),
                        effectiveElevationGainM: Number(payload.elevationGainRecordedM),
                      }
                    : {}),
                  ...(payload.companionsCount !== undefined
                    ? { companionsCount: Number(payload.companionsCount) }
                    : {}),
                  ...(payload.packWeightKg !== undefined
                    ? { packWeightKg: Number(payload.packWeightKg) }
                    : {}),
                }
              : item
          )
        );
        onShowToast?.('Đã lưu thông số & ghi chú nhật ký hành trình!', 'success');
        setEditingLogId(null);
        void refreshServerAnalytics();
        onLogbookChanged?.();
      } else {
        onShowToast?.(data.message || 'Không thể cập nhật nhật ký hành trình.', 'error');
      }
    } catch {
      onShowToast?.('Lỗi kết nối khi lưu nhật ký.', 'error');
    } finally {
      setSavingLog(false);
    }
  };

  const handleDeleteLogEntry = async (entry: LogbookItem) => {
    if (deletingLogId || !entry.isServerEntry) return;
    setDeletingLogId(entry.id);
    try {
      const res = await fetch(`/api/logbook/${encodeURIComponent(entry.id)}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setServerLogs((prev) => (prev || []).filter((item) => String(item._id) !== entry.id));
        if (editingLogId === entry.id) setEditingLogId(null);
        setConfirmDeleteLogId(null);
        onShowToast?.(data.message || 'Đã xóa bản ghi nhật ký hành trình.', 'success');
        void refreshServerAnalytics();
        onLogbookChanged?.();
      } else {
        onShowToast?.(data.message || 'Không thể xóa bản ghi nhật ký này.', 'error');
      }
    } catch {
      onShowToast?.('Lỗi kết nối khi xóa bản ghi nhật ký.', 'error');
    } finally {
      setDeletingLogId(null);
    }
  };

  const handleDownloadLogGpx = async (entry: LogbookItem) => {
    try {
      if (entry.isServerEntry) {
        const res = await fetch(`/api/logbook/${encodeURIComponent(entry.id)}/gpx`, {
          headers: getApiHeaders(),
        });
        if (res.ok) {
          const gpxText = await res.text();
          const blob = new Blob([gpxText], { type: 'application/gpx+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `LOST_${entry.trailId}.gpx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          onShowToast?.(`Đã tải file GPX "${entry.trailName}"!`, 'success');
          return;
        }
      }

      // Offline fallback from trail track
      const trailObj = trailLookup.get(entry.trailId);
      const pts = (trailObj?.gpxTrack || []).map(([lat, lng], idx) => ({
        lat,
        lng,
        altitudeM: trailObj?.maxAltitudeM ? Math.round((trailObj.maxAltitudeM * (idx + 1)) / Math.max(1, (trailObj.gpxTrack || []).length)) : null,
        timestamp: Date.now() + idx * 60000,
      }));
      if (pts.length === 0) {
        onShowToast?.('Chưa có tọa độ GPX cho nhật ký này.', 'info');
        return;
      }
      const xml = buildRecordedGpxXml(entry.trailName, pts);
      const blob = new Blob([xml], { type: 'application/gpx+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LOST_${entry.trailId}.gpx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onShowToast?.(`Đã xuất GPX tuyến "${entry.trailName}"!`, 'success');
    } catch {
      onShowToast?.('Không thể tải file GPX lúc này.', 'error');
    }
  };

  // SVG Donut math
  const totalRegionalConquered = regionalStats.reduce((s, r) => s + r.conquered, 0);
  const donutRadius = 52;
  const donutCircumference = 2 * Math.PI * donutRadius;

  // Dual-bar chart scales
  const maxKm = Math.max(10, ...monthlySeries.map((m) => m.km));
  const maxGain = Math.max(500, ...monthlySeries.map((m) => m.gainM));
  const activeHoverPoint = hoveredMonthIdx !== null ? monthlySeries[hoveredMonthIdx] : null;

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    logEntries.forEach((entry) => {
      const d = new Date(entry.checkinDate);
      if (!Number.isNaN(d.getTime())) {
        years.add(String(d.getFullYear()));
      }
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [logEntries]);

  const filteredLogs = useMemo(
    () =>
      logEntries.filter((e) => {
        if (logRegionFilter !== 'all' && e.region !== logRegionFilter) return false;
        if (logYearFilter !== 'all') {
          const d = new Date(e.checkinDate);
          if (Number.isNaN(d.getTime()) || String(d.getFullYear()) !== logYearFilter) return false;
        }
        if (logVerifiedOnly && !e.verifiedBadge) return false;
        return true;
      }),
    [logEntries, logRegionFilter, logYearFilter, logVerifiedOnly]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'fadeIn 0.25s ease' }}>
      {/* 1. Personal Records Strip */}
      <div className="hub-grid-4">
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Tổng Quãng Đường
          </div>
          <div className="font-editorial" style={{ fontSize: '1.5rem', color: 'var(--color-primary)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {personalRecords.totalKm} km
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            Qua {logEntries.length} nhật ký hành trình
          </div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Tổng Độ Cao Nâng
          </div>
          <div className="font-editorial" style={{ fontSize: '1.5rem', color: 'var(--color-sun)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            +{personalRecords.totalGain.toLocaleString('vi-VN')}m
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            GPS xác thực: {personalRecords.verifiedPct}%
          </div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Kỷ Lục Đỉnh Cao Nhất
          </div>
          <div className="font-editorial" style={{ fontSize: '1.5rem', color: 'var(--color-sky)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {personalRecords.highest ? `${personalRecords.highest.maxAltitudeM.toLocaleString('vi-VN')}m` : '0m'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {personalRecords.highest ? personalRecords.highest.trailName : 'Chưa ghi nhận'}
          </div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Cung Dài Nhất
          </div>
          <div className="font-editorial" style={{ fontSize: '1.5rem', color: 'var(--color-earth)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {personalRecords.longest ? `${personalRecords.longest.distanceKm} km` : '0 km'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {personalRecords.longest ? personalRecords.longest.trailName : 'Chưa ghi nhận'}
          </div>
        </div>
      </div>

      {/* 1B. Cloud-Synced Annual Trek Goal Card with 3 Pure Inline SVG Circular Progress Rings */}
      {(() => {
        const ringRadius = 44;
        const ringCirc = 2 * Math.PI * ringRadius;
        const kmDashOffset = ringCirc * (1 - annualProgress.kmPct / 100);
        const gainDashOffset = ringCirc * (1 - annualProgress.gainPct / 100);
        const peaksDashOffset = ringCirc * (1 - annualProgress.peaksPct / 100);
        const syncBadgeText =
          goalSyncState === 'synced'
            ? 'Đã đồng bộ đám mây'
            : goalSyncState === 'syncing'
              ? 'Đang đồng bộ...'
              : 'Lưu cục bộ trên thiết bị';
        const syncBadgeClass =
          goalSyncState === 'synced'
            ? 'badge badge-success'
            : goalSyncState === 'syncing'
              ? 'badge badge-sky'
              : 'badge badge-cloud';

        return (
          <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: 'var(--color-text-main)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <IconMountain size={16} color="var(--color-primary)" /> Mục Tiêu Trekking Năm {annualProgress.year}
                  </h3>
                  <span className={syncBadgeClass} style={{ fontSize: '0.66rem', padding: '2px 7px' }}>
                    {syncBadgeText}
                  </span>
                </div>
                <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                  {annualProgress.entriesCount > 0
                    ? `Đã ghi nhận ${annualProgress.entriesCount} hành trình trong năm ${annualProgress.year} (+${annualProgress.achievedGainM.toLocaleString('vi-VN')}m độ cao nâng)`
                    : `Chưa có lượt check-in nào trong năm ${annualProgress.year} · Check-in đỉnh đầu tiên để khởi động tiến độ`}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline"
                disabled={isSavingGoals}
                onClick={() => (isEditingGoals ? setIsEditingGoals(false) : handleOpenGoalEditor())}
                style={{ padding: '5px 11px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <IconEdit size={13} /> {isEditingGoals ? 'Đóng' : 'Chỉnh Mục Tiêu Năm'}
              </button>
            </div>

            {isEditingGoals && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSaveAnnualGoals();
                }}
                style={{
                  padding: 12,
                  borderRadius: 4,
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-dim)' }}>Gợi ý nhanh:</span>
                  {GOAL_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className="btn btn-outline"
                      disabled={isSavingGoals}
                      onClick={() => {
                        setDraftTargetKm(String(preset.targetKm));
                        setDraftTargetElevationM(String(preset.targetElevationM));
                        setDraftTargetPeaks(String(preset.targetPeaks));
                      }}
                      style={{ padding: '3px 9px', fontSize: '0.71rem', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {preset.label} ({preset.targetKm}km · +{preset.targetElevationM.toLocaleString('vi-VN')}m · {preset.targetPeaks} đỉnh)
                    </button>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                    <span>Mục tiêu cự ly năm {annualProgress.year} (10–5.000 km)</span>
                    <input
                      type="number"
                      min={10}
                      max={5000}
                      step={5}
                      disabled={isSavingGoals}
                      aria-label={`Mục tiêu cự ly năm ${annualProgress.year} tính bằng km`}
                      className="form-input"
                      value={draftTargetKm}
                      onChange={(e) => setDraftTargetKm(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                    <span>Mục tiêu độ cao nâng (500–200.000 m)</span>
                    <input
                      type="number"
                      min={500}
                      max={200000}
                      step={500}
                      disabled={isSavingGoals}
                      aria-label={`Mục tiêu độ cao nâng năm ${annualProgress.year} tính bằng mét`}
                      className="form-input"
                      value={draftTargetElevationM}
                      onChange={(e) => setDraftTargetElevationM(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                    <span>Mục tiêu số đỉnh (1–36 đỉnh)</span>
                    <input
                      type="number"
                      min={1}
                      max={36}
                      step={1}
                      disabled={isSavingGoals}
                      aria-label={`Mục tiêu số đỉnh năm ${annualProgress.year}`}
                      className="form-input"
                      value={draftTargetPeaks}
                      onChange={(e) => setDraftTargetPeaks(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}
                    />
                  </label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={isSavingGoals}
                    onClick={() => setIsEditingGoals(false)}
                    style={{ padding: '5px 11px', fontSize: '0.74rem' }}
                  >
                    <IconX size={13} /> Hủy
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSavingGoals}
                    style={{ padding: '5px 12px', fontSize: '0.74rem' }}
                  >
                    <IconCheck size={13} /> {isSavingGoals ? 'Đang đồng bộ...' : `Lưu Mục Tiêu ${annualProgress.year}`}
                  </button>
                </div>
              </form>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 12 }}>
              {/* Ring 1: Annual Distance Goal */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 14px',
                  borderRadius: 4,
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  flexWrap: 'wrap',
                }}
              >
                <svg
                  width="108"
                  height="108"
                  viewBox="0 0 112 112"
                  role="img"
                  aria-label={`Tiến độ cự ly năm ${annualProgress.year}: ${annualProgress.achievedKm} trên ${annualGoals.targetKm} km (${annualProgress.kmPct}%)`}
                  style={{ flexShrink: 0 }}
                >
                  <circle cx="56" cy="56" r={ringRadius} fill="none" stroke="var(--color-border)" strokeWidth="8.5" />
                  <circle
                    cx="56"
                    cy="56"
                    r="35"
                    fill="none"
                    stroke="color-mix(in srgb, var(--color-border) 55%, transparent)"
                    strokeWidth="1"
                    strokeDasharray="2 5"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r={ringRadius}
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth="8.5"
                    strokeLinecap="round"
                    strokeDasharray={ringCirc}
                    strokeDashoffset={kmDashOffset}
                    transform="rotate(-90 56 56)"
                    style={{ transition: 'stroke-dashoffset 0.45s ease' }}
                  />
                  <text
                    x="56"
                    y="53"
                    textAnchor="middle"
                    fill="var(--color-text-main)"
                    fontSize="17"
                    fontWeight="800"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {annualProgress.kmPct}%
                  </text>
                  <text x="56" y="69" textAnchor="middle" fill="var(--color-text-dim)" fontSize="9.5" fontWeight="700">
                    CỰ LY KM
                  </text>
                </svg>

                <div style={{ flex: 1, minWidth: 135, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Quãng Đường {annualProgress.year}
                  </div>
                  <div className="font-editorial" style={{ fontSize: '1.22rem', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                    {annualProgress.achievedKm} / {annualGoals.targetKm.toLocaleString('vi-VN')} km
                  </div>
                  {annualProgress.kmRemaining === 0 ? (
                    <span className="badge badge-success" style={{ alignSelf: 'flex-start', fontSize: '0.68rem' }}>
                      <IconCheck size={11} /> Đạt Mục Tiêu Cự Ly
                    </span>
                  ) : (
                    <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      Còn <strong style={{ color: 'var(--color-text-main)' }}>{annualProgress.kmRemaining} km</strong> nữa để hoàn thành.
                    </div>
                  )}
                </div>
              </div>

              {/* Ring 2: Annual Elevation Gain Goal */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 14px',
                  borderRadius: 4,
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  flexWrap: 'wrap',
                }}
              >
                <svg
                  width="108"
                  height="108"
                  viewBox="0 0 112 112"
                  role="img"
                  aria-label={`Tiến độ độ cao nâng năm ${annualProgress.year}: +${annualProgress.achievedGainM} trên +${annualGoals.targetElevationM} mét (${annualProgress.gainPct}%)`}
                  style={{ flexShrink: 0 }}
                >
                  <circle cx="56" cy="56" r={ringRadius} fill="none" stroke="var(--color-border)" strokeWidth="8.5" />
                  <circle
                    cx="56"
                    cy="56"
                    r="35"
                    fill="none"
                    stroke="color-mix(in srgb, var(--color-border) 55%, transparent)"
                    strokeWidth="1"
                    strokeDasharray="2 5"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r={ringRadius}
                    fill="none"
                    stroke="var(--color-sky)"
                    strokeWidth="8.5"
                    strokeLinecap="round"
                    strokeDasharray={ringCirc}
                    strokeDashoffset={gainDashOffset}
                    transform="rotate(-90 56 56)"
                    style={{ transition: 'stroke-dashoffset 0.45s ease' }}
                  />
                  <text
                    x="56"
                    y="53"
                    textAnchor="middle"
                    fill="var(--color-text-main)"
                    fontSize="17"
                    fontWeight="800"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {annualProgress.gainPct}%
                  </text>
                  <text x="56" y="69" textAnchor="middle" fill="var(--color-text-dim)" fontSize="9.5" fontWeight="700">
                    ĐỘ CAO +M
                  </text>
                </svg>

                <div style={{ flex: 1, minWidth: 135, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Độ Cao Nâng {annualProgress.year}
                  </div>
                  <div className="font-editorial" style={{ fontSize: '1.22rem', color: 'var(--color-sky)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                    +{annualProgress.achievedGainM.toLocaleString('vi-VN')} / +{annualGoals.targetElevationM.toLocaleString('vi-VN')}m
                  </div>
                  {annualProgress.gainRemainingM === 0 ? (
                    <span className="badge badge-success" style={{ alignSelf: 'flex-start', fontSize: '0.68rem' }}>
                      <IconCheck size={11} /> Đạt Mục Tiêu Độ Cao
                    </span>
                  ) : (
                    <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      Còn <strong style={{ color: 'var(--color-text-main)' }}>+{annualProgress.gainRemainingM.toLocaleString('vi-VN')}m</strong> nữa để cán mốc.
                    </div>
                  )}
                </div>
              </div>

              {/* Ring 3: Annual Peaks Goal */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 14px',
                  borderRadius: 4,
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  flexWrap: 'wrap',
                }}
              >
                <svg
                  width="108"
                  height="108"
                  viewBox="0 0 112 112"
                  role="img"
                  aria-label={`Tiến độ chinh phục đỉnh năm ${annualProgress.year}: ${annualProgress.achievedPeaks} trên ${annualGoals.targetPeaks} đỉnh (${annualProgress.peaksPct}%)`}
                  style={{ flexShrink: 0 }}
                >
                  <circle cx="56" cy="56" r={ringRadius} fill="none" stroke="var(--color-border)" strokeWidth="8.5" />
                  <circle
                    cx="56"
                    cy="56"
                    r="35"
                    fill="none"
                    stroke="color-mix(in srgb, var(--color-border) 55%, transparent)"
                    strokeWidth="1"
                    strokeDasharray="2 5"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r={ringRadius}
                    fill="none"
                    stroke="var(--color-sun)"
                    strokeWidth="8.5"
                    strokeLinecap="round"
                    strokeDasharray={ringCirc}
                    strokeDashoffset={peaksDashOffset}
                    transform="rotate(-90 56 56)"
                    style={{ transition: 'stroke-dashoffset 0.45s ease' }}
                  />
                  <text
                    x="56"
                    y="53"
                    textAnchor="middle"
                    fill="var(--color-text-main)"
                    fontSize="17"
                    fontWeight="800"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {annualProgress.peaksPct}%
                  </text>
                  <text x="56" y="69" textAnchor="middle" fill="var(--color-text-dim)" fontSize="9.5" fontWeight="700">
                    SỐ ĐỈNH
                  </text>
                </svg>

                <div style={{ flex: 1, minWidth: 135, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Chinh Phục Đỉnh {annualProgress.year}
                  </div>
                  <div className="font-editorial" style={{ fontSize: '1.22rem', color: 'var(--color-sun)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                    {annualProgress.achievedPeaks} / {annualGoals.targetPeaks} đỉnh
                  </div>
                  {annualProgress.peaksRemaining === 0 ? (
                    <span className="badge badge-success" style={{ alignSelf: 'flex-start', fontSize: '0.68rem' }}>
                      <IconCheck size={11} /> Đạt Mục Tiêu Đỉnh
                    </span>
                  ) : (
                    <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      Còn <strong style={{ color: 'var(--color-text-main)' }}>{annualProgress.peaksRemaining} đỉnh</strong> mới nữa để cán đích.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 2. Monthly Dual-Bar SVG Chart & Regional Conquest Donut SVG */}
      <div className="hub-grid-2">
        {/* Monthly Distance & Gain Dual-Bar Chart */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconCompass size={16} color="var(--color-primary)" /> Biểu Đồ 12 Tháng (Cự Ly &amp; Độ Dốc)
              </h3>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                {activeHoverPoint
                  ? `${activeHoverPoint.key}: ${activeHoverPoint.km} km · +${activeHoverPoint.gainM}m (${activeHoverPoint.trips} chuyến)`
                  : 'Di chuột lên từng cột tháng để xem chi tiết'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--color-primary)', display: 'inline-block' }} />
                Cự ly (km)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--color-sky)', display: 'inline-block' }} />
                Độ dốc (+m)
              </span>
            </div>
          </div>

          <div style={{ width: '100%', overflowX: 'auto' }}>
            <svg viewBox="0 0 540 190" role="img" aria-label="Biểu đồ cự ly và độ dốc 12 tháng" style={{ width: '100%', height: 'auto', minWidth: 320, display: 'block' }}>
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const y = 152 - t * 124;
                return (
                  <line
                    key={t}
                    x1="28"
                    y1={y}
                    x2="532"
                    y2={y}
                    stroke="var(--color-border)"
                    strokeDasharray={t === 0 ? undefined : '3 3'}
                    strokeWidth="1"
                  />
                );
              })}

              {monthlySeries.map((pt, idx) => {
                const slotW = 500 / 12;
                const xBase = 30 + idx * slotW;
                const kmH = Math.max(pt.km > 0 ? 4 : 1, (pt.km / maxKm) * 120);
                const gainH = Math.max(pt.gainM > 0 ? 4 : 1, (pt.gainM / maxGain) * 120);
                const isHovered = hoveredMonthIdx === idx;
                return (
                  <g
                    key={pt.key || idx}
                    onMouseEnter={() => setHoveredMonthIdx(idx)}
                    onMouseLeave={() => setHoveredMonthIdx(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x={xBase}
                      y={22}
                      width={slotW - 4}
                      height={134}
                      fill={isHovered ? 'color-mix(in srgb, var(--color-surface-elevated) 70%, transparent)' : 'transparent'}
                      rx="3"
                    />
                    <rect
                      x={xBase + 6}
                      y={152 - kmH}
                      width={11}
                      height={kmH}
                      rx="2"
                      fill="var(--color-primary)"
                      opacity={isHovered ? 1 : 0.85}
                    />
                    <rect
                      x={xBase + 20}
                      y={152 - gainH}
                      width={11}
                      height={gainH}
                      rx="2"
                      fill="var(--color-sky)"
                      opacity={isHovered ? 1 : 0.85}
                    />
                    <text
                      x={xBase + 18}
                      y={172}
                      textAnchor="middle"
                      fill={isHovered ? 'var(--color-text-main)' : 'var(--color-text-dim)'}
                      fontSize="10"
                      fontWeight={isHovered ? '700' : '600'}
                    >
                      {pt.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Regional Conquest Donut SVG */}
        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconMountain size={16} color="var(--color-sky)" /> Bản Đồ Chinh Phục 3 Miền
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
            <svg width="144" height="144" viewBox="0 0 144 144" role="img" aria-label="Biểu đồ chinh phục 3 miền" style={{ flexShrink: 0 }}>
              <circle
                cx="72"
                cy="72"
                r={donutRadius}
                fill="none"
                stroke="var(--color-surface-elevated)"
                strokeWidth="16"
              />
              {(() => {
                let offsetAcc = 0;
                return regionalStats.map((r) => {
                  const share = totalRegionalConquered > 0 ? r.conquered / totalRegionalConquered : 0;
                  const segLen = share * donutCircumference;
                  const dashOffset = -offsetAcc;
                  offsetAcc += segLen;
                  if (segLen <= 0.5) return null;
                  return (
                    <circle
                      key={r.name}
                      cx="72"
                      cy="72"
                      r={donutRadius}
                      fill="none"
                      stroke={r.color}
                      strokeWidth="16"
                      strokeDasharray={`${segLen} ${donutCircumference - segLen}`}
                      strokeDashoffset={dashOffset}
                      transform="rotate(-90 72 72)"
                    />
                  );
                });
              })()}
              <text x="72" y="68" textAnchor="middle" fill="var(--color-text-main)" fontSize="22" fontWeight="800">
                {totalRegionalConquered}
              </text>
              <text x="72" y="86" textAnchor="middle" fill="var(--color-text-dim)" fontSize="10" fontWeight="700">
                / {trails.length} CUNG
              </text>
            </svg>

            <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {regionalStats.map((r) => (
                <div key={r.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-text-main)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, display: 'inline-block' }} />
                      {r.name}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                      {r.conquered}/{r.total} ({r.percent}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: 'var(--color-bg-main)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${r.percent}%`, height: '100%', background: r.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Difficulty (1-5) & Altitude Band Horizontal Mastery Bars */}
      <div className="hub-grid-2">
        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
            Phân Bố Độ Khó Địa Hình (1 – 5)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {difficultyBars.map((d) => (
              <div key={d.level}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: 3 }}>
                  <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{d.label}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                    {d.count} lượt
                  </span>
                </div>
                <div style={{ width: '100%', height: 7, background: 'var(--color-bg-main)', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${d.count > 0 ? Math.max(8, d.pct) : 0}%`,
                      height: '100%',
                      background:
                        d.level >= 5
                          ? 'var(--color-error)'
                          : d.level === 4
                            ? 'var(--color-earth)'
                            : d.level === 3
                              ? 'var(--color-sun)'
                              : 'var(--color-primary)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
            Phân Tầng Cao Độ Đỉnh Đã Leo
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {altitudeBands.map((b) => (
              <div key={b.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: 3 }}>
                  <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{b.label}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                    {b.count} đỉnh
                  </span>
                </div>
                <div style={{ width: '100%', height: 7, background: 'var(--color-bg-main)', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${b.count > 0 ? Math.max(8, b.pct) : 0}%`,
                      height: '100%',
                      background: b.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Personal Trek Logbook with Inline Editing, Delete & GPX Export */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
              Nhật Ký Hành Trình Cá Nhân ({filteredLogs.length})
            </h3>
            <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              Ghi chú thời tiết thực địa, trọng lượng balo, thông số hành trình và tải lại tracklog GPX từng chuyến đi.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <select
              className="form-select"
              value={logRegionFilter}
              onChange={(e) => setLogRegionFilter(e.target.value)}
              style={{ fontSize: '0.78rem', padding: '5px 10px' }}
              aria-label="Lọc nhật ký theo vùng miền"
            >
              <option value="all">Tất cả vùng miền</option>
              <option value="Miền Bắc">Miền Bắc</option>
              <option value="Miền Trung">Miền Trung</option>
              <option value="Miền Nam">Miền Nam</option>
            </select>

            <select
              className="form-select"
              value={logYearFilter}
              onChange={(e) => setLogYearFilter(e.target.value)}
              style={{ fontSize: '0.78rem', padding: '5px 10px', fontVariantNumeric: 'tabular-nums' }}
              aria-label="Lọc nhật ký theo năm"
            >
              <option value="all">Tất cả các năm</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  Năm {yr}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setLogVerifiedOnly((prev) => !prev)}
              aria-pressed={logVerifiedOnly}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                borderRadius: 4,
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: logVerifiedOnly
                  ? '1px solid var(--color-primary)'
                  : '1px solid var(--color-border)',
                background: logVerifiedOnly
                  ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)'
                  : 'var(--color-bg-main)',
                color: logVerifiedOnly ? 'var(--color-primary)' : 'var(--color-text-muted)',
              }}
            >
              <IconShieldCheck size={13} color={logVerifiedOnly ? 'var(--color-primary)' : 'currentColor'} />
              <span>Chỉ GPS xác thực</span>
            </button>
          </div>
        </div>

        {loading && filteredLogs.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
            Đang tải nhật ký hành trình...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', background: 'var(--color-bg-main)', borderRadius: 4, border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
            {logEntries.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <span>Không có nhật ký nào khớp bộ lọc hiện tại.</span>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setLogRegionFilter('all');
                    setLogYearFilter('all');
                    setLogVerifiedOnly(false);
                  }}
                  style={{ fontSize: '0.74rem', padding: '4px 12px' }}
                >
                  Đặt lại bộ lọc
                </button>
              </div>
            ) : (
              'Chưa có nhật ký hành trình nào. Hãy check-in cung đường vừa chinh phục để hệ thống tự động lập biểu đồ phân tích!'
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredLogs.map((entry) => {
              const isEditingThis = editingLogId === entry.id;
              const isConfirmingDelete = confirmDeleteLogId === entry.id;
              const isDeletingThis = deletingLogId === entry.id;
              const matchedTrail = trailLookup.get(entry.trailId);
              return (
                <div
                  key={entry.id}
                  style={{
                    padding: '12px 14px',
                    background: 'var(--color-bg-main)',
                    border: isConfirmingDelete
                      ? '1px solid var(--color-error)'
                      : isEditingThis
                        ? '1px solid var(--color-primary)'
                        : '1px solid var(--color-border)',
                    borderRadius: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => matchedTrail && onSelectTrail?.(matchedTrail)}
                          style={{
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            color: 'var(--color-text-main)',
                            cursor: matchedTrail && onSelectTrail ? 'pointer' : 'default',
                            padding: 0,
                            textAlign: 'left',
                          }}
                        >
                          {entry.trailName}
                        </button>
                        {entry.verifiedBadge && (
                          <span className="badge badge-success">
                            <IconShieldCheck size={11} /> GPS
                          </span>
                        )}
                        <span className="badge badge-cloud">{entry.region}</span>
                        {entry.isServerEntry && (
                          <span className={entry.isPublic ? 'badge badge-sky' : 'badge badge-cloud'} style={{ fontSize: '0.66rem' }}>
                            {entry.isPublic ? 'Công khai' : 'Riêng tư'}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                        {new Date(entry.checkinDate).toLocaleDateString('vi-VN')} · {entry.distanceKm} km · +{entry.elevationGainM}m · Đỉnh {entry.maxAltitudeM}m · {entry.completionTimeHours}h
                        {entry.companionsCount > 1 ? ` · ${entry.companionsCount} người` : ''}
                        {entry.packWeightKg !== undefined ? ` · Balo ${entry.packWeightKg}kg` : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={isDeletingThis}
                        onClick={() => handleStartEdit(entry)}
                        style={{ padding: '4px 9px', fontSize: '0.72rem' }}
                      >
                        <IconEdit size={12} /> Chỉnh sửa
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={isDeletingThis}
                        onClick={() => void handleDownloadLogGpx(entry)}
                        style={{ padding: '4px 9px', fontSize: '0.72rem' }}
                      >
                        <IconDownload size={12} /> GPX
                      </button>
                      {entry.isServerEntry && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          disabled={isDeletingThis}
                          onClick={() => {
                            setEditingLogId(null);
                            setConfirmDeleteLogId(isConfirmingDelete ? null : entry.id);
                          }}
                          style={{
                            padding: '4px 9px',
                            fontSize: '0.72rem',
                            color: 'var(--color-error-text, var(--color-error))',
                            borderColor: 'color-mix(in srgb, var(--color-error) 38%, transparent)',
                          }}
                        >
                          <IconTrash size={12} /> Xóa
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Confirm Bar for Deleting Logbook Entry (zero window.confirm) */}
                  {isConfirmingDelete && (
                    <div
                      role="alert"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 10,
                        padding: '9px 12px',
                        borderRadius: 4,
                        background: 'color-mix(in srgb, var(--color-error) 10%, var(--color-bg-card))',
                        border: '1px solid color-mix(in srgb, var(--color-error) 45%, transparent)',
                      }}
                    >
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-error-text, var(--color-error))' }}>
                        Xác nhận xóa vĩnh viễn bản ghi nhật ký &ldquo;{entry.trailName}&rdquo;? Thao tác này không thể hoàn tác.
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          disabled={isDeletingThis}
                          onClick={() => setConfirmDeleteLogId(null)}
                          style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={isDeletingThis}
                          onClick={() => void handleDeleteLogEntry(entry)}
                          style={{ padding: '4px 12px', fontSize: '0.72rem', fontWeight: 800 }}
                        >
                          <IconTrash size={12} /> {isDeletingThis ? 'Đang xóa...' : 'Xác nhận xóa'}
                        </button>
                      </div>
                    </div>
                  )}

                  {!isEditingThis && (entry.notes || entry.weatherObserved) && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', background: 'var(--color-bg-card)', padding: '8px 10px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
                      {entry.weatherObserved && (
                        <div style={{ fontWeight: 700, color: 'var(--color-sky)', marginBottom: entry.notes ? 4 : 0 }}>
                          Thời tiết thực địa: {entry.weatherObserved}
                        </div>
                      )}
                      {entry.notes && <div>{entry.notes}</div>}
                    </div>
                  )}

                  {isEditingThis && (
                    <div style={{ background: 'var(--color-bg-card)', padding: 12, borderRadius: 4, border: '1px solid var(--color-primary)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 3 }}>
                            Thời gian hoàn thành (giờ)
                          </label>
                          <input
                            type="number"
                            min={0.2}
                            max={240}
                            step={0.5}
                            className="form-input"
                            placeholder="VD: 8.5"
                            value={editCompletionHours}
                            onChange={(e) => setEditCompletionHours(e.target.value)}
                            style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 3 }}>
                            Quãng đường ghi nhận (km)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={500}
                            step={0.1}
                            className="form-input"
                            placeholder="VD: 22.5"
                            value={editDistanceKm}
                            onChange={(e) => setEditDistanceKm(e.target.value)}
                            style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 3 }}>
                            Độ cao nâng tích lũy (+m)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={30000}
                            step={10}
                            className="form-input"
                            placeholder="VD: 1450"
                            value={editElevationGainM}
                            onChange={(e) => setEditElevationGainM(e.target.value)}
                            style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 3 }}>
                            Số người đồng hành
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            step={1}
                            className="form-input"
                            placeholder="VD: 4"
                            value={editCompanionsCount}
                            onChange={(e) => setEditCompanionsCount(e.target.value)}
                            style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 3 }}>
                            Trọng lượng balo (0–60 kg)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={60}
                            step={0.5}
                            className="form-input"
                            placeholder="VD: 9.5"
                            value={editPackKg}
                            onChange={(e) => setEditPackKg(e.target.value)}
                            style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 3 }}>
                            Thời tiết ghi nhận
                          </label>
                          <input
                            type="text"
                            maxLength={160}
                            className="form-input"
                            placeholder="VD: Nắng nhẹ, biển mây dày lúc 5h30"
                            value={editWeather}
                            onChange={(e) => setEditWeather(e.target.value)}
                            style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem' }}
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 3 }}>
                          Ghi chú thực địa
                        </label>
                        <textarea
                          className="form-textarea"
                          rows={2}
                          maxLength={1500}
                          placeholder="Ghi lại trạng thái đường mòn, nguồn nước, kinh nghiệm cho chuyến sau..."
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem' }}
                        />
                      </div>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          color: 'var(--color-text-main)',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editIsPublic}
                          onChange={(e) => setEditIsPublic(e.target.checked)}
                          style={{ accentColor: 'var(--color-primary)', width: 15, height: 15, cursor: 'pointer' }}
                        />
                        <span>Công khai nhật ký &amp; tracklog GPX này cho cộng đồng</span>
                      </label>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => setEditingLogId(null)}
                          disabled={savingLog}
                          style={{ padding: '5px 12px', fontSize: '0.75rem' }}
                        >
                          <IconX size={13} /> Hủy
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => void handleSaveLogNote(entry)}
                          disabled={savingLog}
                          style={{ padding: '5px 12px', fontSize: '0.75rem' }}
                        >
                          <IconCheck size={13} /> {savingLog ? 'Đang lưu...' : 'Lưu Nhật Ký'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
