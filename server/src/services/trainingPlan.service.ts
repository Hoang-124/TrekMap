import { FitnessLevel, ITrainingSession, TrainingCategory } from '../models/TrainingPlan.js';

export interface TrailTrainingTarget {
  name: string;
  distanceKm: number;
  elevationGainM: number;
  maxAltitudeM: number;
  difficultyLevel: number;
  durationDays: number;
}

const LEVEL_MULTIPLIER: Record<FitnessLevel, number> = {
  beginner: 0.78,
  intermediate: 1.0,
  advanced: 1.22,
};

const CATEGORY_WEIGHTS: Record<TrainingCategory, number> = {
  stair_elevation: 30,
  pack_walk: 30,
  cardio: 20,
  leg_strength: 15,
  recovery: 5,
};

/**
 * Generates a realistic, progressive-overload Vietnamese mountain trekking training plan
 * with a peak volume week and a final taper week before summit departure.
 */
export function generateTrainingSessions(params: {
  trail: TrailTrainingTarget;
  durationWeeks: 4 | 6 | 8;
  fitnessLevel: FitnessLevel;
}): ITrainingSession[] {
  const { trail, durationWeeks, fitnessLevel } = params;
  const mult = LEVEL_MULTIPLIER[fitnessLevel];
  const basePackKg = Math.min(
    14,
    Math.max(4, Math.round((trail.durationDays >= 2 ? 7.5 : 4.5) + trail.difficultyLevel * 0.9))
  );
  const peakElevTarget = Math.max(250, Math.min(1800, Math.round(trail.elevationGainM * 0.65 * mult)));
  const isHighAltitude = trail.maxAltitudeM >= 2500;

  const sessions: ITrainingSession[] = [];

  for (let week = 1; week <= durationWeeks; week++) {
    const isTaperWeek = week === durationWeeks;
    const isPeakWeek = week === durationWeeks - 1;
    // Smooth progression curve peaking at week N-1, then tapering to 55% in final week
    const progressFactor = isTaperWeek
      ? 0.55
      : 0.6 + ((week - 1) / Math.max(1, durationWeeks - 2)) * 0.4;

    const cardioMin = Math.round(35 * mult * progressFactor + (isHighAltitude ? 10 : 0));
    const strengthMin = Math.round(35 * mult * progressFactor);
    const stairElev = Math.max(150, Math.round(peakElevTarget * progressFactor));
    const stairMin = Math.max(25, Math.round((stairElev / 16) + 15));
    const packKg = Math.max(3, Math.round(basePackKg * (isTaperWeek ? 0.5 : Math.min(1.05, progressFactor + 0.1))));
    const packWalkMin = Math.max(
      45,
      Math.round((trail.distanceKm * 5.5 + trail.durationDays * 25) * progressFactor * mult)
    );

    const phaseLabel = isTaperWeek
      ? 'Giảm tải (Taper)'
      : isPeakWeek
        ? 'Tuần đỉnh tải (Peak)'
        : week === 1
          ? 'Khởi động nền tảng'
          : `Tăng tiến tuần ${week}`;

    // Day 2 (Tue): Zone-2 Aerobic Cardio
    sessions.push({
      id: `w${week}-d2`,
      week,
      dayOfWeek: 2,
      title: `Chạy bền / Đạp xe Zone 2 (${cardioMin} phút) — ${phaseLabel}`,
      category: 'cardio',
      durationMin: cardioMin,
      notes: isHighAltitude
        ? 'Giữ nhịp tim 65–75% tối đa, hít thở sâu đều qua mũi để thích nghi sức bền độ cao >2.500m.'
        : 'Duy trì nhịp thở đều, nói chuyện được thành câu ngắn (Zone 2) để xây nền tim mạch.',
      completed: false,
    });

    // Day 3 (Wed): Trail Leg & Core Strength
    sessions.push({
      id: `w${week}-d3`,
      week,
      dayOfWeek: 3,
      title: `Bổ trợ cơ chân & gối (Step-up, Lunge, Squat, Plank — ${strengthMin} phút)`,
      category: 'leg_strength',
      durationMin: strengthMin,
      notes: 'Tập trung kiểm soát pha hạ chân (eccentric) để bảo vệ khớp gối khi đổ dốc dài.',
      completed: false,
    });

    // Day 5 (Fri): Stair / Elevation Climb Simulation
    sessions.push({
      id: `w${week}-d5`,
      week,
      dayOfWeek: 5,
      title: `Leo cầu thang / dốc mô phỏng +${stairElev}m độ cao`,
      category: 'stair_elevation',
      durationMin: stairMin,
      targetElevationM: stairElev,
      packWeightKg: Math.max(2, Math.round(packKg * 0.7)),
      notes: `Mục tiêu tích lũy ~${stairElev}m độ cao (tương đương ~${Math.round(stairElev / 3.2)} tầng cầu thang). Đeo balo ${Math.max(2, Math.round(packKg * 0.7))}kg.`,
      completed: false,
    });

    // Day 6 (Sat): Weekend Weighted Pack Walk / Long Hike
    sessions.push({
      id: `w${week}-d6`,
      week,
      dayOfWeek: 6,
      title: isTaperWeek
        ? `Đi bộ nhẹ kiểm tra giày & balo (${packWalkMin} phút, ${packKg}kg)`
        : `Trekking / Đi bộ đường dài đeo balo ${packKg}kg (${packWalkMin} phút)`,
      category: 'pack_walk',
      durationMin: packWalkMin,
      packWeightKg: packKg,
      targetElevationM: isTaperWeek ? Math.round(stairElev * 0.4) : Math.round(stairElev * 0.8),
      notes: `Đi đúng đôi giày trek và vớ dự kiến dùng trên cung ${trail.name} để break-in và kiểm tra điểm cấn.`,
      completed: false,
    });

    // Day 7 (Sun): Active Mobility & Recovery
    sessions.push({
      id: `w${week}-d7`,
      week,
      dayOfWeek: 7,
      title: isTaperWeek
        ? 'Nghỉ ngơi hoàn toàn, giãn cơ nhẹ & nạp carb trước ngày khởi hành'
        : 'Giãn cơ chân, hông, cổ chân & phục hồi chủ động (25 phút)',
      category: 'recovery',
      durationMin: 25,
      notes: 'Tập trung giãn bắp chân, đùi trước/sau, cơ mông và cổ chân; ngủ đủ 7–8 tiếng.',
      completed: false,
    });
  }

  return sessions;
}

/**
 * Computes deterministic Readiness Score (0..100) from weighted session completions
 * plus an optional real Checkin experience bonus (capped at +10 pts).
 */
export function calculateReadinessScore(
  sessions: ITrainingSession[],
  verifiedCheckinsBonusCount = 0
): {
  readinessScore: number;
  completedSessions: number;
  totalSessions: number;
  categoryProgress: Record<TrainingCategory, { completed: number; total: number; percent: number }>;
} {
  const categories: TrainingCategory[] = ['stair_elevation', 'pack_walk', 'cardio', 'leg_strength', 'recovery'];
  const categoryProgress = {} as Record<TrainingCategory, { completed: number; total: number; percent: number }>;

  let weightedScore = 0;
  let totalWeight = 0;
  let completedSessions = 0;

  for (const cat of categories) {
    const items = sessions.filter((s) => s.category === cat);
    const done = items.filter((s) => s.completed).length;
    completedSessions += done;
    const ratio = items.length > 0 ? done / items.length : 0;
    categoryProgress[cat] = {
      completed: done,
      total: items.length,
      percent: Math.round(ratio * 100),
    };
    if (items.length > 0) {
      weightedScore += ratio * CATEGORY_WEIGHTS[cat];
      totalWeight += CATEGORY_WEIGHTS[cat];
    }
  }

  const baseScore = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;
  const experienceBonus = Math.min(10, Math.max(0, verifiedCheckinsBonusCount) * 2);
  // Only add experience bonus once user has started training (>0 completed sessions); new plans start at 0%
  const finalScore = Math.min(100, Math.round(baseScore + (completedSessions > 0 ? experienceBonus : 0)));

  return {
    readinessScore: finalScore,
    completedSessions,
    totalSessions: sessions.length,
    categoryProgress,
  };
}
