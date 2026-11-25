import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Trail, User } from '../../types.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet, scopedStorageKey } from '../../utils/storageScope.js';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBackpack,
  IconCalendar,
  IconCheck,
  IconClock,
  IconCloud,
  IconFlame,
  IconHiking,
  IconMountain,
  IconPlus,
  IconShieldCheck,
  IconTrash,
} from '../common/SvgIcons.js';

function parseLocalDateOnly(raw?: string): Date | null {
  if (!raw) return null;
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (dateOnlyMatch) {
    const y = Number(dateOnlyMatch[1]);
    const m = Number(dateOnlyMatch[2]);
    const d = Number(dateOnlyMatch[3]);
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function formatDateVi(raw?: string): string {
  if (!raw) return 'Chưa xác định';
  const d = parseLocalDateOnly(raw);
  if (!d) return raw;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getEffectivePlanReadiness(plan: TrainingPlanRecord): number {
  if (!plan.isLocalOnly && typeof plan.readinessScore === 'number' && Number.isFinite(plan.readinessScore)) {
    return Math.max(0, Math.min(100, Math.round(plan.readinessScore)));
  }
  return computeReadinessScore(plan.sessions);
}

export interface TrainingPlannerViewProps {
  trails: Trail[];
  currentUser?: User | null;
  initialTrailId?: string;
  onSelectTrail?: (trail: Trail) => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onBack?: () => void;
}

type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';
type SessionCategory = 'cardio' | 'leg_strength' | 'stair_elevation' | 'pack_walk' | 'recovery';

interface TrainingSessionItem {
  id: string;
  week: number;
  dayOfWeek: number; // 1 = Mon .. 7 = Sun
  title: string;
  category: SessionCategory;
  durationMin: number;
  targetElevationM?: number;
  packWeightKg?: number;
  notes?: string;
  completed: boolean;
  completedAt?: string;
}

interface TrainingPlanRecord {
  _id: string;
  targetTrailSlug: string;
  targetTrailName: string;
  targetDate: string;
  durationWeeks: 4 | 6 | 8;
  fitnessLevel: FitnessLevel;
  status: 'active' | 'completed' | 'abandoned';
  sessions: TrainingSessionItem[];
  readinessScore: number;
  isLocalOnly?: boolean;
}

const LOCAL_STORAGE_KEY = 'lost_training_plan_v1';

const DAY_LABELS: Record<number, string> = {
  1: 'Thứ 2',
  2: 'Thứ 3',
  3: 'Thứ 4',
  4: 'Thứ 5',
  5: 'Thứ 6',
  6: 'Thứ 7',
  7: 'Chủ nhật',
};

const CATEGORY_META: Record<SessionCategory, { label: string; color: string; weight: number }> = {
  stair_elevation: { label: 'Leo dốc & cầu thang', color: 'var(--color-earth)', weight: 30 },
  pack_walk: { label: 'Đi bộ mang balo', color: 'var(--color-primary)', weight: 30 },
  cardio: { label: 'Chạy bền & nhịp thở', color: 'var(--color-sky)', weight: 20 },
  leg_strength: { label: 'Khỏe đùi & giữ gối', color: 'var(--color-sun)', weight: 15 },
  recovery: { label: 'Giãn cơ & hồi phục', color: 'var(--color-stream)', weight: 5 },
};

const FITNESS_LABELS: Record<FitnessLevel, { label: string; desc: string }> = {
  beginner: { label: 'Mới bắt đầu', desc: 'Chưa quen mang tải leo dốc dài — tăng nhịp từ tốn để êm gối' },
  intermediate: { label: 'Đã có nền tảng', desc: 'Vận động 2–3 buổi/tuần, đã từng đi núi trong ngày' },
  advanced: { label: 'Sức bền tốt', desc: 'Chuẩn bị cho đỉnh trên 2.800m hoặc cung 3N2Đ dài hơi' },
};

function getDefaultTargetDate(weeks: number): string {
  const d = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeReadinessScore(sessions: TrainingSessionItem[]): number {
  if (!sessions.length) return 0;
  let totalWeighted = 0;
  let activeWeightSum = 0;

  (Object.keys(CATEGORY_META) as SessionCategory[]).forEach((cat) => {
    const catSessions = sessions.filter((s) => s.category === cat);
    if (catSessions.length > 0) {
      const doneCount = catSessions.filter((s) => s.completed).length;
      const ratio = doneCount / catSessions.length;
      totalWeighted += ratio * CATEGORY_META[cat].weight;
      activeWeightSum += CATEGORY_META[cat].weight;
    }
  });

  if (activeWeightSum === 0) return 0;
  return Math.round((totalWeighted / activeWeightSum) * 100);
}

function generateDeterministicPlan(params: {
  trail: Trail;
  durationWeeks: 4 | 6 | 8;
  fitnessLevel: FitnessLevel;
  targetDate: string;
}): TrainingPlanRecord {
  const { trail, durationWeeks, fitnessLevel, targetDate } = params;
  const mult = fitnessLevel === 'beginner' ? 0.78 : fitnessLevel === 'advanced' ? 1.22 : 1.0;
  const safeElevGain =
    Number.isFinite(trail.elevationGainM) && trail.elevationGainM > 0 ? trail.elevationGainM : 800;
  const safeDistanceKm =
    Number.isFinite(trail.distanceKm) && trail.distanceKm > 0 ? trail.distanceKm : 12;
  const safeDurationDays =
    Number.isFinite(trail.durationDays) && trail.durationDays > 0 ? trail.durationDays : 1;
  const safeDifficulty =
    Number.isFinite(trail.difficultyLevel) && trail.difficultyLevel >= 1 ? trail.difficultyLevel : 3;
  const isHighAltitude = (trail.maxAltitudeM || 0) >= 2500;

  const basePackKg = Math.min(
    14,
    Math.max(4, Math.round((safeDurationDays >= 2 ? 7.5 : 4.5) + safeDifficulty * 0.9))
  );
  const peakElevTarget = Math.max(250, Math.min(1800, Math.round(safeElevGain * 0.65 * mult)));

  const sessions: TrainingSessionItem[] = [];

  for (let week = 1; week <= durationWeeks; week++) {
    const isTaper = week === durationWeeks;
    const progressFactor = isTaper
      ? 0.55
      : 0.6 + ((week - 1) / Math.max(1, durationWeeks - 2)) * 0.4;

    const cardioMin = Math.max(20, Math.round(35 * mult * progressFactor + (isHighAltitude ? 10 : 0)));
    const strengthMin = Math.max(20, Math.round(35 * mult * progressFactor));
    const stairElev = Math.max(150, Math.round((peakElevTarget * progressFactor) / 10) * 10);
    const stairMin = Math.max(25, Math.round(stairElev / 16 + 15));
    const packKg = Math.max(
      3,
      Math.round(basePackKg * (isTaper ? 0.5 : Math.min(1.05, progressFactor + 0.1)))
    );
    const packWalkMin = Math.max(
      45,
      Math.round((safeDistanceKm * 5.5 + safeDurationDays * 25) * progressFactor * mult)
    );
    const packElev = Math.round((stairElev * (isTaper ? 0.4 : 0.8)) / 10) * 10;

    // Day 2 (Tue): Cardio Zone 2 — matches server trainingPlan.service.ts (w{w}-d2)
    sessions.push({
      id: `w${week}-d2`,
      week,
      dayOfWeek: 2,
      title: isTaper
        ? `Chạy nhẹ giữ nhịp tim Zone 2 (${cardioMin} phút)`
        : `Chạy bền giữ hơi thở đều Zone 2 (${cardioMin} phút)`,
      category: 'cardio',
      durationMin: cardioMin,
      notes: isHighAltitude
        ? 'Giữ nhịp tim 65–75% tối đa, hít thở sâu đều qua mũi để thích nghi sức bền độ cao >2.500m.'
        : 'Giữ nhịp thở 2 bước hít – 2 bước thở (Zone 2) để xây nền tim mạch ổn định.',
      completed: false,
    });

    // Day 3 (Wed): Leg Strength & Knee Stability — matches server (w{w}-d3)
    sessions.push({
      id: `w${week}-d3`,
      week,
      dayOfWeek: 3,
      title: isTaper
        ? `Làm nóng cơ đùi & cổ chân nhẹ (${strengthMin} phút)`
        : `Tập đùi trước, mông & giữ vững khớp gối (${strengthMin} phút)`,
      category: 'leg_strength',
      durationMin: strengthMin,
      notes: isTaper
        ? '2 hiệp squat không tạ nhẹ nhàng, bước hạ bục chậm và đứng thăng bằng 1 chân.'
        : '3–4 hiệp Squat, Step-up, Lunge, nhón bắp chân và Plank để giữ gối chắc lúc đổ dốc dài.',
      completed: false,
    });

    // Day 5 (Fri): Stair / Elevation Climb — matches server (w{w}-d5)
    sessions.push({
      id: `w${week}-d5`,
      week,
      dayOfWeek: 5,
      title: isTaper ? 'Leo cầu thang nhẹ giữ cảm giác chân' : `Leo cầu thang hoặc dốc gắt (+${stairElev}m)`,
      category: 'stair_elevation',
      durationMin: stairMin,
      targetElevationM: stairElev,
      packWeightKg: Math.max(2, Math.round(packKg * 0.7)),
      notes: isTaper
        ? 'Leo chậm rãi, lúc xuống nên đi thang máy để giữ sụn gối êm trước ngày xuất phát.'
        : `Mang balo ${Math.max(2, Math.round(packKg * 0.7))}kg, tập bước nghỉ Rest-Step và ưu tiên xuống bằng thang máy.`,
      completed: false,
    });

    // Day 6 (Sat): Long Pack Walk / Simulation Hike — matches server (w{w}-d6)
    sessions.push({
      id: `w${week}-d6`,
      week,
      dayOfWeek: 6,
      title: isTaper
        ? `Đi bộ thử giày & balo (${packWalkMin} phút, ${packKg}kg)`
        : `Đi bộ đường dài mang balo ${packKg}kg (${packWalkMin} phút, +${packElev}m)`,
      category: 'pack_walk',
      durationMin: packWalkMin,
      targetElevationM: packElev,
      packWeightKg: packKg,
      notes: isTaper
        ? 'Mang đúng đôi giày và đôi vớ sẽ đi rừng, chỉnh lại đai hông xem có chỗ nào cấn vai hay phồng chân không.'
        : `Đi liền mạch cùng gậy trekking trên cung tập tương đương ${safeDistanceKm} km, nhấp nước điện giải mỗi 25 phút.`,
      completed: false,
    });

    // Day 7 (Sun): Mobility & Active Recovery — matches server (w{w}-d7)
    sessions.push({
      id: `w${week}-d7`,
      week,
      dayOfWeek: 7,
      title: isTaper ? 'Nghỉ hẳn, ngủ đủ 8 tiếng & nạp tinh bột' : 'Giãn cơ, lăn ống & thả lỏng gân kheo',
      category: 'recovery',
      durationMin: 25,
      notes: isTaper
        ? 'Rà lại đồ đạc lần cuối, ăn thêm chuối hoặc bổ sung Magie và đi ngủ sớm trước giờ lên đường.'
        : 'Giãn kỹ bắp chân, gân gót chân, cơ gập hông và thả lỏng lưng dưới sau buổi đi tải dài.',
      completed: false,
    });
  }

  return {
    _id: `local-plan-${Date.now()}`,
    targetTrailSlug: trail.id,
    targetTrailName: trail.name,
    targetDate,
    durationWeeks,
    fitnessLevel,
    status: 'active',
    sessions,
    readinessScore: 0,
    isLocalOnly: true,
  };
}

function getReadinessTier(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Sẵn sàng lên đường', color: 'var(--color-primary)' };
  if (score >= 55) return { label: 'Nền tảng khá ổn', color: 'var(--color-sky)' };
  if (score >= 25) return { label: 'Đang tích lũy sức', color: 'var(--color-earth)' };
  return { label: 'Mới khởi động', color: 'var(--color-text-muted)' };
}

function readTrailIdFromUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (new URLSearchParams(window.location.search).get('trailId') || '').trim();
  } catch {
    return '';
  }
}

export const TrainingPlannerView: React.FC<TrainingPlannerViewProps> = ({
  trails,
  currentUser,
  initialTrailId,
  onSelectTrail,
  onShowToast,
  onBack,
}) => {
  const currentUserId = currentUser?.id || '';
  const targetInitialTrailId = initialTrailId || readTrailIdFromUrl();

  const [plans, setPlans] = useState<TrainingPlanRecord[]>([]);
  const [activePlanId, setActivePlanId] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [todayMs] = useState<number>(() => Date.now());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [showBuilder, setShowBuilder] = useState<boolean>(false);
  const [confirmDeletePlanId, setConfirmDeletePlanId] = useState<string | null>(null);

  // Builder form state
  const [builderTrailId, setBuilderTrailId] = useState<string>(
    targetInitialTrailId || trails[0]?.id || 'trail-fansipan'
  );
  const [builderWeeks, setBuilderWeeks] = useState<4 | 6 | 8>(6);
  const [builderFitness, setBuilderFitness] = useState<FitnessLevel>('intermediate');
  const [builderDate, setBuilderDate] = useState<string>(() => getDefaultTargetDate(6));

  const trailById = useMemo(() => {
    const map = new Map<string, Trail>();
    trails.forEach((t) => map.set(t.id, t));
    return map;
  }, [trails]);

  const builderTrail = useMemo(
    () => trailById.get(builderTrailId) || trails[0],
    [trailById, builderTrailId, trails]
  );

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [syncingCloudPlanId, setSyncingCloudPlanId] = useState<string | null>(null);

  const storageKey = useMemo(() => scopedStorageKey(LOCAL_STORAGE_KEY, currentUserId || null), [currentUserId]);

  const persistLocalPlans = useCallback(
    (nextPlans: TrainingPlanRecord[]) => {
      try {
        const localOnly = nextPlans.filter((p) => p.isLocalOnly);
        if (localOnly.length > 0) {
          localStorage.setItem(storageKey, JSON.stringify(localOnly));
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch {
        // ignore storage quota errors
      }
    },
    [storageKey]
  );

  const readLocalPlans = useCallback((): TrainingPlanRecord[] => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
      // Also surface any unsynced guest/legacy plans so newly signed-in trekkers can 1-click sync to Cloud
      const guestKey = scopedStorageKey(LOCAL_STORAGE_KEY, null);
      const guestRaw =
        (guestKey !== storageKey ? localStorage.getItem(guestKey) : null) ??
        localStorage.getItem(LOCAL_STORAGE_KEY);
      if (guestRaw) {
        const parsedGuest = JSON.parse(guestRaw);
        if (Array.isArray(parsedGuest)) {
          return parsedGuest.map((p: TrainingPlanRecord) => ({ ...p, isLocalOnly: true }));
        }
      }
      return [];
    } catch {
      return [];
    }
  }, [storageKey]);

  // Load saved plans (MongoDB if logged in, fallback/guest -> localStorage) with AbortController
  // When targetInitialTrailId is set: auto-select matching plan OR auto-open builder preselected to it
  useEffect(() => {
    const controller = new AbortController();

    const applyLoadedPlans = (combined: TrainingPlanRecord[]) => {
      if (controller.signal.aborted) return;
      setPlans(combined);
      if (targetInitialTrailId) {
        setBuilderTrailId(targetInitialTrailId);
        const matched = combined.find((p) => p.targetTrailSlug === targetInitialTrailId);
        if (matched) {
          setActivePlanId(matched._id);
          setSelectedWeek(1);
          setShowBuilder(false);
        } else {
          if (combined.length > 0) setActivePlanId(combined[0]._id);
          setShowBuilder(true);
        }
        return;
      }

      if (combined.length > 0) {
        setActivePlanId(combined[0]._id);
        setShowBuilder(false);
      } else {
        setShowBuilder(true);
      }
    };

    const loadPlans = async () => {
      setIsLoading(true);
      const localPlans = readLocalPlans();

      if (!currentUserId) {
        applyLoadedPlans(localPlans);
        if (!controller.signal.aborted) setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/training-plans/me', {
          headers: getApiHeaders(),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (res.ok) {
          const json = await res.json();
          if (controller.signal.aborted) return;
          const serverPlans: TrainingPlanRecord[] = Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json?.data?.plans)
              ? json.data.plans
              : [];
          // Keep unsynced local-only plans visible alongside cloud plans so user can 1-click sync
          const unsyncedLocal = localPlans.filter(
            (lp) => lp.isLocalOnly && !serverPlans.some((sp) => sp._id === lp._id)
          );
          const combined = [...serverPlans, ...unsyncedLocal];
          applyLoadedPlans(combined);
        } else {
          applyLoadedPlans(localPlans);
        }
      } catch {
        if (controller.signal.aborted) return;
        applyLoadedPlans(localPlans);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadPlans();
    return () => {
      controller.abort();
    };
  }, [currentUserId, targetInitialTrailId, readLocalPlans]);

  const activePlan = useMemo(
    () => plans.find((p) => p._id === activePlanId) || plans[0] || null,
    [plans, activePlanId]
  );

  const activeTrail = useMemo(
    () => (activePlan ? trailById.get(activePlan.targetTrailSlug) || null : null),
    [activePlan, trailById]
  );

  const effectiveWeek =
    activePlan && selectedWeek > activePlan.durationWeeks ? 1 : selectedWeek;

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!builderTrail) return;
    setIsCreating(true);

    const localFallbackPlan = generateDeterministicPlan({
      trail: builderTrail,
      durationWeeks: builderWeeks,
      fitnessLevel: builderFitness,
      targetDate: builderDate,
    });

    if (!currentUser) {
      const next = [localFallbackPlan, ...plans.filter((p) => p._id !== localFallbackPlan._id)].slice(0, 5);
      setPlans(next);
      persistLocalPlans(next);
      setActivePlanId(localFallbackPlan._id);
      setSelectedWeek(1);
      setShowBuilder(false);
      setIsCreating(false);
      onShowToast?.(`Đã lập lịch tập ${builderWeeks} tuần cho cung ${builderTrail.name}.`, 'success');
      return;
    }

    try {
      const res = await fetch('/api/training-plans', {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          targetTrailId: builderTrail.id,
          targetTrailSlug: builderTrail.id,
          targetDate: builderDate,
          durationWeeks: builderWeeks,
          fitnessLevel: builderFitness,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data?._id) {
        const created: TrainingPlanRecord = json.data;
        const next = [created, ...plans];
        setPlans(next);
        setActivePlanId(created._id);
        setSelectedWeek(1);
        setShowBuilder(false);
        onShowToast?.(`Đã lập và lưu lịch tập ${builderWeeks} tuần vào tài khoản.`, 'success');
        return;
      }

      // Surface client validation/limit errors (HTTP 4xx) instead of silently falling back to localStorage
      if (res.status >= 400 && res.status < 500) {
        onShowToast?.(
          json?.message || 'Thông tin lịch tập chưa hợp lệ (kiểm tra ngày khởi hành hoặc giới hạn giáo án).',
          'error'
        );
        return;
      }

      // Graceful local fallback only when server is unavailable (5xx)
      const next = [localFallbackPlan, ...plans].slice(0, 5);
      setPlans(next);
      persistLocalPlans(next);
      setActivePlanId(localFallbackPlan._id);
      setSelectedWeek(1);
      setShowBuilder(false);
      onShowToast?.('Máy chủ tạm gián đoạn — đã lập lịch tập và lưu sẵn trên trình duyệt.', 'info');
    } catch {
      const next = [localFallbackPlan, ...plans].slice(0, 5);
      setPlans(next);
      persistLocalPlans(next);
      setActivePlanId(localFallbackPlan._id);
      setSelectedWeek(1);
      setShowBuilder(false);
      onShowToast?.('Đã lập lịch tập ngoại tuyến và lưu trên máy này.', 'info');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleSession = async (sessionId: string) => {
    if (!activePlan) return;

    const previousPlan = activePlan;
    const updatedSessions = activePlan.sessions.map((s) =>
      s.id === sessionId
        ? { ...s, completed: !s.completed, completedAt: !s.completed ? new Date().toISOString() : undefined }
        : s
    );
    const prevDoneAny = activePlan.sessions.some((s) => s.completed);
    const prevBase = computeReadinessScore(activePlan.sessions);
    const expBonus =
      !activePlan.isLocalOnly && prevDoneAny ? Math.max(0, (activePlan.readinessScore || 0) - prevBase) : 0;
    const updatedBaseScore = computeReadinessScore(updatedSessions);
    const updatedDoneAny = updatedSessions.some((s) => s.completed);
    const updatedScore = updatedDoneAny ? Math.min(100, updatedBaseScore + expBonus) : 0;
    const updatedPlan: TrainingPlanRecord = {
      ...activePlan,
      sessions: updatedSessions,
      readinessScore: updatedScore,
      status: updatedBaseScore >= 100 ? 'completed' : activePlan.status === 'completed' ? 'active' : activePlan.status,
    };

    const nextPlans = plans.map((p) => (p._id === activePlan._id ? updatedPlan : p));
    setPlans(nextPlans);

    if (activePlan.isLocalOnly || !currentUser) {
      persistLocalPlans(nextPlans);
      return;
    }

    try {
      const res = await fetch(
        `/api/training-plans/${encodeURIComponent(activePlan._id)}/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: 'PATCH',
          headers: getApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            completed: updatedSessions.find((s) => s.id === sessionId)?.completed,
          }),
        }
      );
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data?._id) {
        setPlans((curr) => curr.map((p) => (p._id === previousPlan._id ? json.data : p)));
      } else if (!res.ok) {
        setPlans((curr) => curr.map((p) => (p._id === previousPlan._id ? previousPlan : p)));
        onShowToast?.(json?.message || 'Không thể lưu tiến độ buổi tập lên máy chủ.', 'error');
      }
    } catch {
      setPlans((curr) => curr.map((p) => (p._id === previousPlan._id ? previousPlan : p)));
      onShowToast?.('Mất kết nối máy chủ — chưa lưu được tiến độ buổi tập.', 'error');
    }
  };

  const handleUpdatePlanStatus = async (plan: TrainingPlanRecord, nextStatus: TrainingPlanRecord['status']) => {
    if (updatingStatus) return;
    setUpdatingStatus(true);
    const prevStatus = plan.status;
    setPlans((curr) => curr.map((p) => (p._id === plan._id ? { ...p, status: nextStatus } : p)));

    const statusMsg =
      nextStatus === 'completed'
        ? 'Chúc mừng, bạn đã hoàn thành lịch tập!'
        : nextStatus === 'abandoned'
          ? 'Đã tạm dừng lịch tập.'
          : 'Đã mở lại lịch tập để tiếp tục.';

    if (plan.isLocalOnly || !currentUser) {
      persistLocalPlans(plans.map((p) => (p._id === plan._id ? { ...p, status: nextStatus } : p)));
      setUpdatingStatus(false);
      onShowToast?.(statusMsg, 'success');
      return;
    }

    try {
      const res = await fetch(`/api/training-plans/${encodeURIComponent(plan._id)}/status`, {
        method: 'PATCH',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        if (json.data?._id) {
          setPlans((curr) => curr.map((p) => (p._id === plan._id ? { ...p, status: json.data.status } : p)));
        }
        onShowToast?.(json.message || statusMsg, 'success');
      } else {
        setPlans((curr) => curr.map((p) => (p._id === plan._id ? { ...p, status: prevStatus } : p)));
        onShowToast?.(json?.message || 'Không thể cập nhật trạng thái giáo án.', 'error');
      }
    } catch {
      setPlans((curr) => curr.map((p) => (p._id === plan._id ? { ...p, status: prevStatus } : p)));
      onShowToast?.('Lỗi kết nối máy chủ khi cập nhật trạng thái giáo án.', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSyncLocalPlanToCloud = async (localPlan: TrainingPlanRecord) => {
    if (!currentUser || !localPlan.isLocalOnly || syncingCloudPlanId) return;
    setSyncingCloudPlanId(localPlan._id);
    try {
      const res = await fetch('/api/training-plans', {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          targetTrailId: localPlan.targetTrailSlug,
          targetTrailSlug: localPlan.targetTrailSlug,
          targetDate: localPlan.targetDate,
          durationWeeks: localPlan.durationWeeks,
          fitnessLevel: localPlan.fitnessLevel,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !json.data?._id) {
        throw new Error(json?.message || 'Không thể đồng bộ giáo án lên Cloud.');
      }

      let syncedPlan: TrainingPlanRecord = json.data;
      // Map each completed local session by (week, category) against server sessions so 0 sessions drop or corrupt
      const completedLocalSessions = localPlan.sessions.filter((s) => s.completed);
      const serverSessionIdsToPatch: string[] = [];
      const seenPatchIds = new Set<string>();
      for (const localSession of completedLocalSessions) {
        const matchedServerSession =
          syncedPlan.sessions.find(
            (ss) => ss.week === localSession.week && ss.category === localSession.category && !seenPatchIds.has(ss.id)
          ) ||
          syncedPlan.sessions.find((ss) => ss.id === localSession.id && !seenPatchIds.has(ss.id));
        if (matchedServerSession) {
          seenPatchIds.add(matchedServerSession.id);
          serverSessionIdsToPatch.push(matchedServerSession.id);
        }
      }

      for (const sid of serverSessionIdsToPatch) {
        const sRes = await fetch(
          `/api/training-plans/${encodeURIComponent(syncedPlan._id)}/sessions/${encodeURIComponent(sid)}`,
          {
            method: 'PATCH',
            headers: getApiHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ completed: true }),
          }
        ).catch(() => null);
        if (sRes?.ok) {
          const sJson = await sRes.json().catch(() => null);
          if (sJson?.success && sJson.data?._id) {
            syncedPlan = sJson.data;
          }
        }
      }

      const nextPlans = [syncedPlan, ...plans.filter((p) => p._id !== localPlan._id)];
      setPlans(nextPlans);
      setActivePlanId(syncedPlan._id);
      persistLocalPlans(nextPlans);
      try {
        const guestKey = scopedStorageKey(LOCAL_STORAGE_KEY, null);
        const removeFromKey = (k: string) => {
          const raw = safeLocalStorageGet(k);
          if (!raw) return;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter((x: TrainingPlanRecord) => x._id !== localPlan._id);
            if (cleaned.length > 0) safeLocalStorageSet(k, JSON.stringify(cleaned));
            else safeLocalStorageRemove(k);
          }
        };
        removeFromKey(guestKey);
        removeFromKey(LOCAL_STORAGE_KEY);
      } catch {
        // ignore storage errors
      }
      onShowToast?.(`Đã lưu lịch tập "${syncedPlan.targetTrailName}" lên tài khoản.`, 'success');
    } catch (err: unknown) {
      onShowToast?.(err instanceof Error ? err.message : 'Chưa lưu được lịch tập lên tài khoản lúc này.', 'error');
    } finally {
      setSyncingCloudPlanId(null);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    setConfirmDeletePlanId(null);
    const target = plans.find((p) => p._id === planId);
    const remaining = plans.filter((p) => p._id !== planId);

    if (!target || target.isLocalOnly || !currentUser) {
      setPlans(remaining);
      setActivePlanId(remaining[0]?._id || '');
      if (remaining.length === 0) setShowBuilder(true);
      persistLocalPlans(remaining);
      try {
        const guestKey = scopedStorageKey(LOCAL_STORAGE_KEY, null);
        for (const k of [guestKey, LOCAL_STORAGE_KEY]) {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            const cleaned = arr.filter((x: TrainingPlanRecord) => x._id !== planId);
            if (cleaned.length > 0) localStorage.setItem(k, JSON.stringify(cleaned));
            else localStorage.removeItem(k);
          }
        }
      } catch {
        // ignore
      }
      onShowToast?.('Đã xóa giáo án tập luyện.', 'info');
      return;
    }

    setPlans(remaining);
    setActivePlanId(remaining[0]?._id || '');
    if (remaining.length === 0) setShowBuilder(true);

    try {
      const res = await fetch(`/api/training-plans/${encodeURIComponent(planId)}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
      });
      if (res.ok || res.status === 404) {
        onShowToast?.('Đã xóa giáo án tập luyện.', 'info');
      } else {
        const json = await res.json().catch(() => null);
        setPlans((curr) => [target, ...curr.filter((p) => p._id !== target._id)]);
        setActivePlanId(target._id);
        setShowBuilder(false);
        onShowToast?.(json?.message || 'Không thể xóa giáo án trên máy chủ.', 'error');
      }
    } catch {
      setPlans((curr) => [target, ...curr.filter((p) => p._id !== target._id)]);
      setActivePlanId(target._id);
      setShowBuilder(false);
      onShowToast?.('Mất kết nối máy chủ — chưa xóa được giáo án.', 'error');
    }
  };

  // Computed analytics for activePlan (preserves server's +10 verified summit experience bonus when synced)
  const readinessScore = useMemo(
    () => (activePlan ? getEffectivePlanReadiness(activePlan) : 0),
    [activePlan]
  );
  const readinessTier = getReadinessTier(readinessScore);

  const daysUntilDeparture = useMemo(() => {
    if (!activePlan?.targetDate) return null;
    const targetLocal = parseLocalDateOnly(activePlan.targetDate);
    if (!targetLocal) return null;
    const now = new Date(todayMs);
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((targetLocal.getTime() - todayLocal.getTime()) / (24 * 60 * 60 * 1000));
  }, [activePlan, todayMs]);

  const weeklyStats = useMemo(() => {
    if (!activePlan) return [];
    const list: Array<{
      week: number;
      isTaper: boolean;
      totalElevM: number;
      completedElevM: number;
      totalMin: number;
      doneCount: number;
      totalCount: number;
    }> = [];
    for (let w = 1; w <= activePlan.durationWeeks; w++) {
      const ws = activePlan.sessions.filter((s) => s.week === w);
      list.push({
        week: w,
        isTaper: w === activePlan.durationWeeks,
        totalElevM: ws.reduce((sum, s) => sum + (s.targetElevationM || 0), 0),
        completedElevM: ws.filter((s) => s.completed).reduce((sum, s) => sum + (s.targetElevationM || 0), 0),
        totalMin: ws.reduce((sum, s) => sum + (s.durationMin || 0), 0),
        doneCount: ws.filter((s) => s.completed).length,
        totalCount: ws.length,
      });
    }
    return list;
  }, [activePlan]);

  const categoryBreakdown = useMemo(() => {
    if (!activePlan) return [];
    return (Object.keys(CATEGORY_META) as SessionCategory[]).map((cat) => {
      const list = activePlan.sessions.filter((s) => s.category === cat);
      const done = list.filter((s) => s.completed).length;
      const pct = list.length ? Math.round((done / list.length) * 100) : 0;
      return { cat, ...CATEGORY_META[cat], done, total: list.length, pct };
    });
  }, [activePlan]);

  const weekSessions = useMemo(
    () => (activePlan ? activePlan.sessions.filter((s) => s.week === effectiveWeek) : []),
    [activePlan, effectiveWeek]
  );

  // SVG Ring Math
  const ringRadius = 56;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - readinessScore / 100);

  return (
    <section
      style={{
        maxWidth: 1240,
        margin: '0 auto',
        padding: '24px 16px 64px',
        fontFamily: 'var(--font-family)',
        color: 'var(--color-text-main)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="btn btn-outline"
              style={{ padding: '6px 12px', fontSize: '0.78rem', borderRadius: 4, marginBottom: 12 }}
            >
              <IconArrowLeft size={14} />
              <span>Quay lại</span>
            </button>
          )}
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--color-primary)',
              marginBottom: 4,
            }}
          >
            Chuẩn bị thể lực • Lịch tập 4–8 tuần
          </div>
          <h1
            className="font-editorial"
            style={{ margin: 0, fontSize: 'clamp(1.45rem, 2.6vw, 2rem)', fontWeight: 600, lineHeight: 1.2 }}
          >
            Rèn sức trước chuyến đi
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: 'var(--color-text-muted)', maxWidth: 740, lineHeight: 1.55 }}>
            Lịch tập tự căn theo độ cao, độ dốc và số ngày đi của {trails.length} cung núi Việt Nam — có sẵn tuần giảm tải ngay trước ngày xuất phát để chân nhẹ và khớp gối khỏe.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowBuilder((v) => !v)}
            style={{ borderRadius: 4, fontSize: '0.8rem', padding: '8px 13px' }}
          >
            <IconPlus size={14} color="var(--color-on-primary)" />
            <span>{showBuilder && activePlan ? 'Thu gọn khung tạo lịch' : 'Tạo lịch tập mới'}</span>
          </button>
        </div>
      </div>

      {/* Guest Sync Notice */}
      {!currentUser && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            padding: '10px 14px',
            borderRadius: 6,
            marginBottom: 16,
            background: 'color-mix(in srgb, var(--color-sky) 11%, var(--color-bg-card))',
            border: '1px solid color-mix(in srgb, var(--color-sky) 35%, var(--color-border))',
            fontSize: '0.8rem',
          }}
        >
          <span style={{ color: 'var(--color-text-main)' }}>
            Bạn chưa đăng nhập: lịch tập và các buổi đã đánh dấu vẫn được lưu trên máy này. Đăng nhập nếu muốn mở tiếp trên điện thoại khác.
          </span>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => window.dispatchEvent(new CustomEvent('lost:open-auth-modal'))}
            style={{ padding: '5px 11px', fontSize: '0.75rem', borderRadius: 4 }}
          >
            Đăng nhập để lưu
          </button>
        </div>
      )}

      {/* Plan Builder Form */}
      {showBuilder && (
        <form
          onSubmit={handleCreatePlan}
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border-strong)',
            borderTop: '3px solid var(--color-primary)',
            borderRadius: 6,
            padding: 18,
            marginBottom: 22,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
            Chọn cung núi để lập lịch tập
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 12 }}>
            <div>
              <label htmlFor="training-trail-select" className="form-label" style={{ fontSize: '0.76rem' }}>Đỉnh / Cung đường mục tiêu ({trails.length} cung)</label>
              <select
                id="training-trail-select"
                className="form-input"
                aria-label="Chọn đỉnh hoặc cung đường mục tiêu"
                value={builderTrailId}
                onChange={(e) => setBuilderTrailId(e.target.value)}
                style={{ fontSize: '0.83rem', borderRadius: 4 }}
              >
                {trails.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.maxAltitudeM}m • +{t.elevationGainM}m)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="training-target-date" className="form-label" style={{ fontSize: '0.76rem' }}>Ngày khởi hành dự kiến</label>
              <input
                id="training-target-date"
                type="date"
                className="form-input"
                aria-label="Ngày khởi hành dự kiến"
                value={builderDate}
                onChange={(e) => setBuilderDate(e.target.value)}
                required
                style={{ fontSize: '0.83rem', borderRadius: 4 }}
              />
            </div>

            <div>
              <div className="form-label" style={{ fontSize: '0.76rem' }}>Thời lượng giáo án</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {([4, 6, 8] as const).map((w) => {
                  const active = builderWeeks === w;
                  return (
                    <button
                      key={w}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setBuilderWeeks(w);
                        setBuilderDate(getDefaultTargetDate(w));
                      }}
                      style={{
                        padding: '8px 6px',
                        borderRadius: 4,
                        fontSize: '0.8rem',
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                        border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                        background: active
                          ? 'color-mix(in srgb, var(--color-primary) 16%, var(--color-bg-main))'
                          : 'var(--color-bg-main)',
                        color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        fontFamily: 'var(--font-family)',
                      }}
                    >
                      {w} tuần
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <div className="form-label" style={{ fontSize: '0.76rem' }}>Nền tảng thể lực hiện tại</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))', gap: 8 }}>
              {(['beginner', 'intermediate', 'advanced'] as FitnessLevel[]).map((lvl) => {
                const active = builderFitness === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setBuilderFitness(lvl)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                      background: active
                        ? 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-main))'
                        : 'var(--color-bg-main)',
                      fontFamily: 'var(--font-family)',
                    }}
                  >
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: active ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                      {FITNESS_LABELS[lvl].label}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {FITNESS_LABELS[lvl].desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {builderTrail && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                padding: '10px 12px',
                borderRadius: 4,
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
                fontSize: '0.78rem',
              }}
            >
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                <span><strong style={{ color: 'var(--color-text-main)' }}>{builderTrail.distanceKm} km</strong> cự ly</span>
                <span><strong style={{ color: 'var(--color-text-main)' }}>+{builderTrail.elevationGainM}m</strong> leo dốc</span>
                <span><strong style={{ color: 'var(--color-text-main)' }}>{builderTrail.maxAltitudeM}m</strong> đỉnh</span>
                <span>Cấp <strong style={{ color: 'var(--color-earth)' }}>{builderTrail.difficultyLevel}/5</strong></span>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isCreating}
                style={{ borderRadius: 4, fontSize: '0.82rem', padding: '8px 16px' }}
              >
                <IconHiking size={15} color="var(--color-on-primary)" />
                <span>{isCreating ? 'Đang lập lịch...' : `Lập lịch tập ${builderWeeks} tuần`}</span>
              </button>
            </div>
          )}
        </form>
      )}

      {/* Plan Switcher Chips when multiple plans exist */}
      {plans.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {plans.map((p) => {
            const active = activePlan?._id === p._id;
            const sc = getEffectivePlanReadiness(p);
            return (
              <button
                key={p._id}
                type="button"
                onClick={() => {
                  setActivePlanId(p._id);
                  setSelectedWeek(1);
                  setConfirmDeletePlanId(null);
                }}
                style={{
                  padding: '7px 11px',
                  borderRadius: 4,
                  fontSize: '0.78rem',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: active
                    ? 'color-mix(in srgb, var(--color-primary) 15%, var(--color-bg-card))'
                    : 'var(--color-bg-card)',
                  color: active ? 'var(--color-primary)' : 'var(--color-text-main)',
                  fontFamily: 'var(--font-family)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <IconMountain size={13} />
                <span style={{ maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.targetTrailName}
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.8 }}>({sc}%)</span>
                {p.isLocalOnly && (
                  <span style={{ fontSize: '0.66rem', opacity: 0.85 }}>[Cục bộ]</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.86rem' }}>
          Đang tải giáo án tập luyện...
        </div>
      ) : activePlan ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* 1-Click Cloud Sync Banner when logged in with a local guest plan */}
          {currentUser && activePlan.isLocalOnly && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                padding: '10px 14px',
                borderRadius: 6,
                background: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card))',
                border: '1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border))',
                fontSize: '0.8rem',
              }}
            >
              <span style={{ color: 'var(--color-text-main)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <IconCloud size={15} color="var(--color-primary)" />
                <span>Lịch tập này mới lưu trên trình duyệt — bấm lưu vào tài khoản để xem tiếp trên máy khác.</span>
              </span>
              <button
                type="button"
                className="btn btn-primary"
                disabled={syncingCloudPlanId === activePlan._id}
                onClick={() => void handleSyncLocalPlanToCloud(activePlan)}
                style={{ padding: '6px 12px', fontSize: '0.76rem', borderRadius: 4 }}
              >
                <IconCloud size={13} color="var(--color-on-primary)" />
                <span>
                  {syncingCloudPlanId === activePlan._id ? 'Đang lưu...' : 'Lưu lên tài khoản'}
                </span>
              </button>
            </div>
          )}

          {/* Active Plan Hero + Dual Pure-SVG Visualizations */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 16 }}>
            {/* Readiness Score Ring SVG Card */}
            <div
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 6,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-primary)' }}>
                      Độ sẵn sàng trước ngày đi
                    </span>
                    <span
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: 4,
                        color:
                          activePlan.status === 'completed'
                            ? 'var(--color-primary)'
                            : activePlan.status === 'abandoned'
                              ? 'var(--color-sun)'
                              : 'var(--color-sky)',
                        background:
                          activePlan.status === 'completed'
                            ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)'
                            : activePlan.status === 'abandoned'
                              ? 'color-mix(in srgb, var(--color-sun) 16%, transparent)'
                              : 'color-mix(in srgb, var(--color-sky) 14%, transparent)',
                      }}
                    >
                      {activePlan.status === 'completed'
                        ? 'Đã hoàn thành'
                        : activePlan.status === 'abandoned'
                          ? 'Đang tạm dừng'
                          : 'Đang tập luyện'}
                    </span>
                  </div>
                  <h2 style={{ margin: '3px 0 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-main)', lineHeight: 1.3 }}>
                    {activePlan.targetTrailName}
                  </h2>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <IconCalendar size={13} /> Khởi hành: {formatDateVi(activePlan.targetDate)}
                    </span>
                    {daysUntilDeparture !== null && (
                      <span style={{ fontWeight: 700, color: daysUntilDeparture <= 7 ? 'var(--color-earth)' : 'var(--color-sky)', fontVariantNumeric: 'tabular-nums' }}>
                        {daysUntilDeparture > 0
                          ? `Còn ${daysUntilDeparture} ngày`
                          : daysUntilDeparture === 0
                            ? 'Hôm nay khởi hành'
                            : `Đã qua ${Math.abs(daysUntilDeparture)} ngày`}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {activePlan.status === 'active' ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={updatingStatus}
                        onClick={() => void handleUpdatePlanStatus(activePlan, 'completed')}
                        style={{ padding: '5px 9px', fontSize: '0.72rem', borderRadius: 4, color: 'var(--color-primary)' }}
                      >
                        <IconCheck size={12} color="var(--color-primary)" /> Hoàn thành
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={updatingStatus}
                        onClick={() => void handleUpdatePlanStatus(activePlan, 'abandoned')}
                        style={{ padding: '5px 9px', fontSize: '0.72rem', borderRadius: 4 }}
                      >
                        Tạm dừng
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={updatingStatus}
                      onClick={() => void handleUpdatePlanStatus(activePlan, 'active')}
                      style={{ padding: '5px 10px', fontSize: '0.72rem', borderRadius: 4 }}
                    >
                      Kích hoạt lại
                    </button>
                  )}
                  {activeTrail && onSelectTrail && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => onSelectTrail(activeTrail)}
                      style={{ padding: '5px 9px', fontSize: '0.72rem', borderRadius: 4 }}
                    >
                      Xem cung
                    </button>
                  )}
                  {confirmDeletePlanId === activePlan._id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDeletePlan(activePlan._id)}
                        style={{
                          padding: '5px 9px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          borderRadius: 4,
                          border: '1px solid color-mix(in srgb, var(--color-error) 45%, transparent)',
                          background: 'color-mix(in srgb, var(--color-error) 14%, var(--color-bg-main))',
                          color: 'var(--color-error-text, var(--color-error))',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-family)',
                        }}
                      >
                        Xác nhận xóa
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeletePlanId(null)}
                        className="btn btn-outline"
                        style={{ padding: '5px 8px', fontSize: '0.72rem', borderRadius: 4 }}
                      >
                        Hủy
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeletePlanId(activePlan._id)}
                      title="Xóa giáo án"
                      aria-label="Xóa giáo án"
                      style={{
                        padding: '5px 7px',
                        borderRadius: 4,
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg-main)',
                        color: 'var(--color-text-dim)',
                        cursor: 'pointer',
                      }}
                    >
                      <IconTrash size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Ring + Category Progress */}
              <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: 136, height: 136, flexShrink: 0 }}>
                  <svg viewBox="0 0 136 136" width="136" height="136" role="img" aria-label={`Điểm sẵn sàng ${readinessScore}%`}>
                    <circle
                      cx="68"
                      cy="68"
                      r={ringRadius}
                      fill="none"
                      stroke="var(--color-border-strong)"
                      strokeWidth="10"
                    />
                    <circle
                      cx="68"
                      cy="68"
                      r={ringRadius}
                      fill="none"
                      stroke={readinessTier.color}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                      transform="rotate(-90 68 68)"
                    />
                  </svg>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                    }}
                  >
                    <span style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                      {readinessScore}%
                    </span>
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, color: readinessTier.color, marginTop: 4, maxWidth: 96 }}>
                      {readinessTier.label}
                    </span>
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 'min(190px, 100%)', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {categoryBreakdown.map((item) => (
                    <div key={item.cat}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', marginBottom: 3 }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {item.label} ({item.weight}%)
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                          {item.done}/{item.total}
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--color-bg-main)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                        <div style={{ width: `${item.pct}%`, height: '100%', background: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Weekly Vertical-Gain & Duration Load Bar Chart SVG */}
            <div
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-earth)' }}>
                  Độ dốc &amp; thời lượng tập từng tuần
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
                  Tăng dần từ tuần 1 đến tuần {activePlan.durationWeeks - 1}, rồi giảm tải ở tuần {activePlan.durationWeeks} để cơ thể hồi hẳn trước giờ lên đường.
                </div>
              </div>

              <svg
                viewBox="0 0 520 190"
                role="group"
                aria-label="Biểu đồ tải trọng độ cao theo tuần"
                style={{ display: 'block', width: '100%', height: 'auto', maxWidth: '100%' }}
              >
                {/* Horizontal grid lines */}
                {[30, 75, 120, 155].map((y) => (
                  <line key={y} x1="12" y1={y} x2="508" y2={y} stroke="var(--color-border)" strokeDasharray="3 3" />
                ))}

                {(() => {
                  const maxElev = Math.max(400, ...weeklyStats.map((w) => w.totalElevM));
                  const count = Math.max(1, weeklyStats.length);
                  const slotW = 490 / count;
                  const barW = Math.min(46, slotW * 0.54);

                  return weeklyStats.map((ws, idx) => {
                    const cx = 18 + idx * slotW + slotW / 2;
                    const x = cx - barW / 2;
                    const maxH = 115;
                    const totalH = Math.max(12, (ws.totalElevM / maxElev) * maxH);
                    const doneH = ws.totalElevM > 0 ? (ws.completedElevM / ws.totalElevM) * totalH : 0;
                    const isActive = ws.week === effectiveWeek;
                    const barColor = ws.isTaper ? 'var(--color-sky)' : 'var(--color-primary)';

                    return (
                      <g
                        key={ws.week}
                        role="button"
                        tabIndex={0}
                        aria-label={`Chọn Tuần ${ws.week}${ws.isTaper ? ' (Giảm tải)' : ''}: mục tiêu +${ws.totalElevM}m, ${ws.totalMin} phút`}
                        onClick={() => setSelectedWeek(ws.week)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedWeek(ws.week);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Target elevation bar */}
                        <rect
                          x={x}
                          y={155 - totalH}
                          width={barW}
                          height={totalH}
                          rx={3}
                          fill={`color-mix(in srgb, ${barColor} 22%, var(--color-bg-main))`}
                          stroke={isActive ? barColor : 'var(--color-border-strong)'}
                          strokeWidth={isActive ? 2 : 1}
                        />
                        {/* Completed fill */}
                        {doneH > 0 && (
                          <rect
                            x={x}
                            y={155 - doneH}
                            width={barW}
                            height={doneH}
                            rx={3}
                            fill={barColor}
                          />
                        )}
                        {/* Elevation label on top */}
                        <text
                          x={cx}
                          y={149 - totalH}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="700"
                          fill="var(--color-text-muted)"
                        >
                          +{ws.totalElevM}m
                        </text>
                        {/* Week label */}
                        <text
                          x={cx}
                          y={171}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight={isActive ? '800' : '600'}
                          fill={isActive ? barColor : 'var(--color-text-main)'}
                        >
                          T{ws.week}{ws.isTaper ? '*' : ''}
                        </text>
                        {/* Duration sub-label */}
                        <text
                          x={cx}
                          y={184}
                          textAnchor="middle"
                          fontSize="9"
                          fill="var(--color-text-dim)"
                        >
                          {ws.totalMin}p
                        </text>
                      </g>
                    );
                  });
                })()}
              </svg>

              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: '0.72rem', color: 'var(--color-text-dim)' }}>
                <span>Bấm vào cột tuần để xem từng buổi • *T{activePlan.durationWeeks}: tuần giảm tải</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  Đã tập: {activePlan.sessions.filter((s) => s.completed).length}/{activePlan.sessions.length} buổi
                </span>
              </div>
            </div>
          </div>

          {/* High-Altitude Acclimatization Protocol for peaks >= 2500m */}
          {activeTrail && activeTrail.maxAltitudeM >= 2500 && (
            <div
              style={{
                background: 'color-mix(in srgb, var(--color-earth) 10%, var(--color-bg-card))',
                border: '1px solid color-mix(in srgb, var(--color-earth) 38%, var(--color-border))',
                borderLeft: '3px solid var(--color-earth)',
                borderRadius: 6,
                padding: '12px 15px',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <span style={{ marginTop: 2, flexShrink: 0 }}>
                <IconAlertTriangle size={18} color="var(--color-earth)" />
              </span>
              <div style={{ fontSize: '0.8rem', lineHeight: 1.55, color: 'var(--color-text-main)' }}>
                <strong>Lưu ý khi lên cao trên {activeTrail.maxAltitudeM.toLocaleString('vi-VN')}m: </strong>
                Qua mốc 2.200m cứ giữ nhịp thở đều 2 bước hít – 2 bước thở, uống 3–4 lít nước pha điện giải mỗi ngày và đừng cố bứt tốc sau 2.500m để tránh say độ cao (AMS). Nhớ mang đủ 3 lớp áo chắn gió rét và đôi gậy đỡ gối lúc xuống dốc.
              </div>
            </div>
          )}

          {/* Week Selector Strip */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {weeklyStats.map((ws) => {
              const active = ws.week === effectiveWeek;
              const allDone = ws.doneCount === ws.totalCount && ws.totalCount > 0;
              return (
                <button
                  key={ws.week}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedWeek(ws.week)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: active ? 700 : 500,
                    border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                    background: active
                      ? 'color-mix(in srgb, var(--color-primary) 16%, var(--color-bg-card))'
                      : 'var(--color-bg-card)',
                    color: active ? 'var(--color-primary)' : 'var(--color-text-main)',
                    fontFamily: 'var(--font-family)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span>Tuần {ws.week}{ws.isTaper ? ' (giảm tải)' : ''}</span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: allDone
                        ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)'
                        : 'var(--color-bg-main)',
                      color: allDone ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    }}
                  >
                    {ws.doneCount}/{ws.totalCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Daily Sessions Checklist for Selected Week */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {weekSessions.map((session) => {
              const meta = CATEGORY_META[session.category] || CATEGORY_META.cardio;
              return (
                <div
                  key={session.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '13px 15px',
                    borderRadius: 6,
                    background: session.completed
                      ? 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-card))'
                      : 'var(--color-bg-card)',
                    border: session.completed
                      ? '1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border))'
                      : '1px solid var(--color-border)',
                    borderLeft: `3px solid ${meta.color}`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleSession(session.id)}
                    aria-pressed={session.completed}
                    aria-label={`Đánh dấu hoàn thành ${session.title}`}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      marginTop: 2,
                      flexShrink: 0,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: session.completed ? '1px solid var(--color-primary)' : '1px solid var(--color-border-strong)',
                      background: session.completed ? 'var(--color-primary)' : 'var(--color-bg-main)',
                    }}
                  >
                    {session.completed && <IconCheck size={14} color="var(--color-on-primary)" />}
                  </button>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                        {DAY_LABELS[session.dayOfWeek] || `Ngày ${session.dayOfWeek}`}
                      </span>
                      <span
                        style={{
                          fontSize: '0.67rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 3,
                          color: meta.color,
                          background: `color-mix(in srgb, ${meta.color} 13%, var(--color-bg-main))`,
                        }}
                      >
                        {meta.label}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: session.completed ? 'var(--color-text-muted)' : 'var(--color-text-main)',
                        textDecoration: session.completed ? 'line-through' : 'none',
                      }}
                    >
                      {session.title}
                    </div>

                    {session.notes && (
                      <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                        {session.notes}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: '0.74rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <IconClock size={12} color="var(--color-sky)" /> {session.durationMin} phút
                      </span>
                      {Boolean(session.targetElevationM) && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <IconFlame size={12} color="var(--color-earth)" /> Mục tiêu +{session.targetElevationM}m dốc
                        </span>
                      )}
                      {Boolean(session.packWeightKg) && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <IconBackpack size={12} color="var(--color-primary)" /> Balo {session.packWeightKg} kg
                        </span>
                      )}
                    </div>
                  </div>

                  {session.completed && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>
                      <IconShieldCheck size={14} color="var(--color-primary)" /> Đã xong
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : !showBuilder ? (
        <div
          style={{
            background: 'var(--color-bg-card)',
            border: '1px dashed var(--color-border-strong)',
            borderRadius: 6,
            padding: '32px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <IconHiking size={28} color="var(--color-primary)" />
          <div style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
            Bạn chưa có giáo án tập luyện nào
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)', maxWidth: 460, lineHeight: 1.55 }}>
            Chọn một cung núi sắp đi và số tuần chuẩn bị — hệ thống sẽ tự chia lịch chạy bền, bổ trợ gối, leo dốc và tuần giảm tải trước giờ xuất phát.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowBuilder(true)}
            style={{ borderRadius: 4, fontSize: '0.82rem', padding: '8px 16px', marginTop: 4 }}
          >
            <IconPlus size={14} color="var(--color-on-primary)" />
            <span>Tạo lịch tập đầu tiên</span>
          </button>
        </div>
      ) : null}
    </section>
  );
};
