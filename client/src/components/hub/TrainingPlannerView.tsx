import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Trail, User } from '../../types.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { scopedStorageKey } from '../../utils/storageScope.js';
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

function formatDateVi(raw?: string): string {
  if (!raw) return 'Chưa xác định';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
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
  7: 'Chủ Nhật',
};

const CATEGORY_META: Record<SessionCategory, { label: string; color: string; weight: number }> = {
  stair_elevation: { label: 'Leo Dốc / Cầu Thang', color: 'var(--color-earth)', weight: 30 },
  pack_walk: { label: 'Đi Bộ Gùi Balo', color: 'var(--color-primary)', weight: 30 },
  cardio: { label: 'Sức Bền Tim Mạch', color: 'var(--color-sky)', weight: 20 },
  leg_strength: { label: 'Cơ Chân & Gối', color: 'var(--color-sun)', weight: 15 },
  recovery: { label: 'Giãn Cơ & Hồi Phục', color: 'var(--color-stream)', weight: 5 },
};

const FITNESS_LABELS: Record<FitnessLevel, { label: string; desc: string }> = {
  beginner: { label: 'Người Mới', desc: 'Chưa quen mang tải dốc dài — tăng tiến êm và bảo vệ gối' },
  intermediate: { label: 'Trung Bình', desc: 'Chạy bộ / vận động 2–3 buổi/tuần, đã từng đi núi 1N' },
  advanced: { label: 'Nâng Cao', desc: 'Hướng tới đỉnh >2.800m hoặc hành trình 3N2Đ khắc nghiệt' },
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
  const levelFactor = fitnessLevel === 'beginner' ? 0.72 : fitnessLevel === 'advanced' ? 1.15 : 0.94;
  const safeElevGain =
    Number.isFinite(trail.elevationGainM) && trail.elevationGainM > 0 ? trail.elevationGainM : 800;
  const safeDurationDays =
    Number.isFinite(trail.durationDays) && trail.durationDays > 0 ? trail.durationDays : 1;
  const dailyGainTarget = Math.max(
    250,
    Math.round((safeElevGain / safeDurationDays) * levelFactor)
  );
  const basePackKg = fitnessLevel === 'beginner' ? 4 : fitnessLevel === 'advanced' ? 8 : 6;
  const maxPackKg = Math.min(
    14,
    basePackKg + (safeDurationDays >= 3 ? 5 : safeDurationDays === 2 ? 4 : 2)
  );

  const sessions: TrainingSessionItem[] = [];

  for (let week = 1; week <= durationWeeks; week++) {
    const isTaper = week === durationWeeks;
    const progress = (week - 1) / Math.max(1, durationWeeks - 2);
    const loadRatio = isTaper ? 0.5 : Math.min(1, 0.52 + progress * 0.48);

    const stairElev = Math.round((dailyGainTarget * 0.45 * loadRatio) / 10) * 10;
    const packElev = Math.round((dailyGainTarget * 0.72 * loadRatio) / 10) * 10;
    const packKg = isTaper
      ? Math.max(3, Math.round(basePackKg * 0.7))
      : Math.min(maxPackKg, Math.round(basePackKg + (maxPackKg - basePackKg) * progress));

    // Mon: Cardio Zone 2
    sessions.push({
      id: `w${week}-d1`,
      week,
      dayOfWeek: 1,
      title: isTaper ? 'Chạy Nhẹ Nhịp Zone 2 (Giữ Nhịp Tim)' : 'Chạy Bộ Sức Bền Hô Hấp Zone 2',
      category: 'cardio',
      durationMin: Math.round((35 + (isTaper ? -5 : week * 4)) * levelFactor),
      notes: isTaper
        ? 'Giữ nhịp tim thấp (65% HRmax), tập thở mũi 2:2, không chạy nước rút.'
        : 'Giữ nhịp thở đều 2 bước hít - 2 bước thở để tăng dung tích phổi khi lên cao.',
      completed: false,
    });

    // Tue: Leg Strength & Knee Stability
    sessions.push({
      id: `w${week}-d2`,
      week,
      dayOfWeek: 2,
      title: isTaper ? 'Kích Hoạt Cơ Đùi & Ổn Định Cổ Chân' : 'Sức Mạnh Đùi Trước, Mông & Bảo Vệ Khớp Gối',
      category: 'leg_strength',
      durationMin: isTaper ? 25 : Math.round(35 + week * 2),
      notes: isTaper
        ? '2 hiệp nhẹ Bodyweight Squats, Step-downs chậm và giữ thăng bằng 1 chân.'
        : '3–4 hiệp Squats, Bulgarian Split Squats, Calf Raises & Plank bảo vệ gối khi đổ dốc.',
      completed: false,
    });

    // Thu: Stair / Elevation Climb
    sessions.push({
      id: `w${week}-d4`,
      week,
      dayOfWeek: 4,
      title: isTaper ? 'Leo Cầu Thang Nhẹ Duy Trì Cảm Giác Dốc' : `Leo Cầu Thang / Dốc Gắt Tích Lũy +${stairElev}m`,
      category: 'stair_elevation',
      durationMin: isTaper ? 30 : Math.round(45 + week * 4),
      targetElevationM: stairElev,
      packWeightKg: Math.max(3, packKg - 2),
      notes: isTaper
        ? 'Leo nhịp chậm, xuống bằng thang máy để bảo toàn sụn gối trước ngày xuất phát.'
        : `Mang balo ${Math.max(3, packKg - 2)}kg, tập bước Rest-Step trụ thẳng chân sau, ưu tiên xuống thang máy.`,
      completed: false,
    });

    // Sat: Long Pack Walk / Simulation Hike
    sessions.push({
      id: `w${week}-d6`,
      week,
      dayOfWeek: 6,
      title: isTaper
        ? 'Đi Bộ Thử Giày & Balo (Kiểm Tra Ma Sát)'
        : `Hành Quân Mô Phỏng Balo ${packKg}kg (+${packElev}m)`,
      category: 'pack_walk',
      durationMin: isTaper ? 45 : Math.round(75 + week * 12),
      targetElevationM: isTaper ? Math.round(stairElev * 0.6) : packElev,
      packWeightKg: packKg,
      notes: isTaper
        ? 'Mang đúng đôi giày & vớ trekking sẽ dùng, kiểm tra dây đai hông và điểm cọ xát.'
        : `Đi liên tục kèm gậy trekking, thử nạp nước điện giải mỗi 25 phút và kiểm tra nhịp bước.`,
      completed: false,
    });

    // Sun: Mobility & Active Recovery
    sessions.push({
      id: `w${week}-d7`,
      week,
      dayOfWeek: 7,
      title: isTaper ? 'Nghỉ Ngơi Hoàn Toàn, Ngủ 8 Tiếng & Tích Tinh Bột' : 'Giãn Cơ Chủ Động, Lăn Ống & Hồi Phục Gân Khoeo',
      category: 'recovery',
      durationMin: 25,
      notes: isTaper
        ? 'Kiểm tra lại Checklist đồ, bổ sung chuối/Magie và ngủ đủ giấc trước khi khởi hành.'
        : 'Giãn cơ bắp chân, gân Achilles, cơ gập hông và thả lỏng lưng dưới sau buổi hành quân.',
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
  if (score >= 80) return { label: 'Sẵn Sàng Xuất Phát', color: 'var(--color-primary)' };
  if (score >= 55) return { label: 'Đủ Nền Tảng Cơ Bản', color: 'var(--color-sky)' };
  if (score >= 25) return { label: 'Đang Tích Lũy Thể Lực', color: 'var(--color-earth)' };
  return { label: 'Mới Khởi Động Giáo Án', color: 'var(--color-text-muted)' };
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
        localStorage.setItem(storageKey, JSON.stringify(nextPlans));
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
      onShowToast?.(`Đã tạo giáo án ${builderWeeks} tuần chinh phục ${builderTrail.name}!`, 'success');
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
        onShowToast?.(`Đã tạo và đồng bộ giáo án ${builderWeeks} tuần lên đám mây!`, 'success');
        return;
      }

      // Graceful local fallback if server endpoint unavailable
      const next = [localFallbackPlan, ...plans].slice(0, 5);
      setPlans(next);
      persistLocalPlans(next);
      setActivePlanId(localFallbackPlan._id);
      setSelectedWeek(1);
      setShowBuilder(false);
      onShowToast?.('Đã tạo giáo án và lưu cục bộ trên trình duyệt.', 'info');
    } catch {
      const next = [localFallbackPlan, ...plans].slice(0, 5);
      setPlans(next);
      persistLocalPlans(next);
      setActivePlanId(localFallbackPlan._id);
      setSelectedWeek(1);
      setShowBuilder(false);
      onShowToast?.('Đã tạo giáo án ngoại tuyến (tự lưu trên thiết bị).', 'info');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleSession = async (sessionId: string) => {
    if (!activePlan) return;

    const updatedSessions = activePlan.sessions.map((s) =>
      s.id === sessionId
        ? { ...s, completed: !s.completed, completedAt: !s.completed ? new Date().toISOString() : undefined }
        : s
    );
    const prevBase = computeReadinessScore(activePlan.sessions);
    const expBonus = !activePlan.isLocalOnly ? Math.max(0, (activePlan.readinessScore || 0) - prevBase) : 0;
    const updatedBaseScore = computeReadinessScore(updatedSessions);
    const updatedScore = Math.min(100, updatedBaseScore + expBonus);
    const updatedPlan: TrainingPlanRecord = {
      ...activePlan,
      sessions: updatedSessions,
      readinessScore: updatedScore,
      status: updatedBaseScore >= 100 ? 'completed' : activePlan.status === 'completed' ? 'active' : activePlan.status,
    };

    const nextPlans = plans.map((p) => (p._id === activePlan._id ? updatedPlan : p));
    setPlans(nextPlans);

    if (activePlan.isLocalOnly || !currentUser) {
      persistLocalPlans(nextPlans.filter((p) => p.isLocalOnly));
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
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.success && json.data?._id) {
          setPlans((curr) => curr.map((p) => (p._id === activePlan._id ? json.data : p)));
        }
      }
    } catch {
      // Optimistic state already applied
    }
  };

  const handleUpdatePlanStatus = async (plan: TrainingPlanRecord, nextStatus: TrainingPlanRecord['status']) => {
    if (updatingStatus) return;
    setUpdatingStatus(true);
    const optimistic = plans.map((p) => (p._id === plan._id ? { ...p, status: nextStatus } : p));
    setPlans(optimistic);

    const statusMsg =
      nextStatus === 'completed'
        ? 'Đã đánh dấu hoàn thành giáo án!'
        : nextStatus === 'abandoned'
          ? 'Đã tạm dừng giáo án.'
          : 'Đã kích hoạt lại giáo án!';

    if (plan.isLocalOnly || !currentUser) {
      persistLocalPlans(optimistic.filter((p) => p.isLocalOnly));
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
        setPlans(plans);
        onShowToast?.(json?.message || 'Không thể cập nhật trạng thái giáo án.', 'error');
      }
    } catch {
      setPlans(plans);
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
      const completedSessionIds = localPlan.sessions.filter((s) => s.completed).map((s) => s.id);
      for (const sid of completedSessionIds) {
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
      const remainingLocal = nextPlans.filter((p) => p.isLocalOnly);
      persistLocalPlans(remainingLocal);
      try {
        const guestKey = scopedStorageKey(LOCAL_STORAGE_KEY, null);
        const removeFromKey = (k: string) => {
          const raw = localStorage.getItem(k);
          if (!raw) return;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter((x: TrainingPlanRecord) => x._id !== localPlan._id);
            if (cleaned.length > 0) localStorage.setItem(k, JSON.stringify(cleaned));
            else localStorage.removeItem(k);
          }
        };
        removeFromKey(guestKey);
        removeFromKey(LOCAL_STORAGE_KEY);
      } catch {
        // ignore storage errors
      }
      onShowToast?.(`Đã đồng bộ giáo án "${syncedPlan.targetTrailName}" lên LOST Cloud!`, 'success');
    } catch (err: unknown) {
      onShowToast?.(err instanceof Error ? err.message : 'Lỗi khi đồng bộ giáo án lên Cloud.', 'error');
    } finally {
      setSyncingCloudPlanId(null);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    setConfirmDeletePlanId(null);
    const target = plans.find((p) => p._id === planId);
    const remaining = plans.filter((p) => p._id !== planId);
    setPlans(remaining);
    setActivePlanId(remaining[0]?._id || '');
    if (remaining.length === 0) setShowBuilder(true);

    if (!target || target.isLocalOnly || !currentUser) {
      persistLocalPlans(remaining.filter((p) => p.isLocalOnly));
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

    try {
      await fetch(`/api/training-plans/${encodeURIComponent(planId)}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
      });
      onShowToast?.('Đã xóa giáo án tập luyện.', 'info');
    } catch {
      onShowToast?.('Đã xóa khỏi danh sách hiện tại.', 'info');
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
    const diffMs = new Date(activePlan.targetDate).getTime() - todayMs;
    return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
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
            LOST Expedition Prep • Giáo Án Thể Lực Khoa Học 4–8 Tuần
          </div>
          <h1
            className="font-editorial"
            style={{ margin: 0, fontSize: 'clamp(1.45rem, 2.6vw, 2rem)', fontWeight: 600, lineHeight: 1.2 }}
          >
            Lộ Trình Rèn Thể Lực Chinh Phục Đỉnh Cao
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: 'var(--color-text-muted)', maxWidth: 740, lineHeight: 1.55 }}>
            Tự động hiệu chỉnh tải trọng balo, độ dốc tích lũy cầu thang và tuần giảm tải (Taper Week) theo đúng thông số thực địa của {trails.length} đỉnh núi &amp; cung đường Việt Nam.
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
            <span>{showBuilder && activePlan ? 'Ẩn Trình Tạo Giáo Án' : 'Tạo Giáo Án Mới'}</span>
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
            Chế độ khách: Giáo án và tiến độ đánh dấu buổi tập được tự động lưu trên thiết bị này. Đăng nhập để đồng bộ lên tài khoản LOST.
          </span>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => window.dispatchEvent(new CustomEvent('lost:open-auth-modal'))}
            style={{ padding: '5px 11px', fontSize: '0.75rem', borderRadius: 4 }}
          >
            Đăng Nhập Đồng Bộ
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
            Thiết Lập Giáo Án Theo Đỉnh Mục Tiêu
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
                      {w} Tuần
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
                <span>{isCreating ? 'Đang khởi tạo...' : `Khởi Tạo Giáo Án ${builderWeeks} Tuần`}</span>
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
                <span>Giáo án này đang lưu cục bộ trên trình duyệt — đồng bộ lên LOST Cloud để lưu tiến độ đa thiết bị.</span>
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
                  {syncingCloudPlanId === activePlan._id ? 'Đang đồng bộ...' : 'Đồng bộ giáo án lên Cloud'}
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
                      Chỉ Số Sẵn Sàng Thực Địa
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
                        {daysUntilDeparture > 0 ? `Còn ${daysUntilDeparture} ngày` : 'Đã đến ngày khởi hành'}
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
                  Tải Trọng Độ Cao &amp; Thời Lượng Theo Tuần
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
                  Tăng tiến khoa học từ Tuần 1–{activePlan.durationWeeks - 1} và giảm tải hồi phục ở Tuần {activePlan.durationWeeks} (Taper Week).
                </div>
              </div>

              <svg
                viewBox="0 0 520 190"
                role="img"
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
                <span>Bấm vào cột tuần để xem giáo án chi tiết • *T{activePlan.durationWeeks}: Tuần giảm tải (Taper)</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  Hoàn thành: {activePlan.sessions.filter((s) => s.completed).length}/{activePlan.sessions.length} buổi
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
                <strong>Lưu ý thích nghi độ cao cho đỉnh {activeTrail.maxAltitudeM.toLocaleString('vi-VN')}m: </strong>
                Giữ nhịp thở 2:2 trên 2.200m, uống 3–4 lít nước + điện giải/ngày, không tăng tốc đột ngột sau 2.500m để phòng Sốc độ cao (AMS). Chuẩn bị hệ thống 3 lớp áo chống gió lạnh và đôi gậy bảo vệ khớp gối khi đổ dốc.
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
                  <span>Tuần {ws.week}{ws.isTaper ? ' (Giảm Tải)' : ''}</span>
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
      ) : null}
    </section>
  );
};
