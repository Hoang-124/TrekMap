import type { AiFitnessLevel, BioCalcInput, BioCalcResult } from './ai.types.js';

const FITNESS_HORIZONTAL_KMH: Record<AiFitnessLevel, number> = {
  beginner: 3.5,
  intermediate: 4.5,
  advanced: 5.4,
};

const FITNESS_TOBLER_MULT: Record<AiFitnessLevel, number> = {
  beginner: 0.8,
  intermediate: 1.0,
  advanced: 1.16,
};

function parseFiniteNumber(val: unknown, fallback: number): number {
  if (val === undefined || val === null || val === '') return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Computes Tobler's Hiking Function walking speed (km/h) for a given slope (rise/run).
 * Adjusted by 0.78 off-road Vietnam forest/rock trail factor.
 */
export function computeToblerSpeedKmH(slopeRiseOverRun: number, fitnessLevel: AiFitnessLevel = 'intermediate'): number {
  const safeSlope = Number.isFinite(slopeRiseOverRun) ? slopeRiseOverRun : 0;
  const clampedSlope = Math.max(-0.65, Math.min(0.65, safeSlope));
  const rawKmH = 6 * Math.exp(-3.5 * Math.abs(clampedSlope + 0.05));
  const vietnamTrailFactor = 0.78;
  return Math.max(0.8, rawKmH * vietnamTrailFactor * FITNESS_TOBLER_MULT[fitnessLevel]);
}

/**
 * Pure deterministic Alpine Bio-Calculator (Naismith + Langmuir + Tobler + Hydration + Calories + Pack Ratio + AMS).
 */
export function calculateAlpineBioMetrics(
  rawInput: Partial<BioCalcInput>,
  segmentStats?: { toblerHoursDirect?: number }
): BioCalcResult {
  const distanceKm = Math.max(0.5, Math.min(250, parseFiniteNumber(rawInput.distanceKm, 12)));
  const elevationGainM = Math.max(0, Math.min(10000, parseFiniteNumber(rawInput.elevationGainM, 700)));
  const elevationLossM = Math.max(0, Math.min(10000, parseFiniteNumber(rawInput.elevationLossM, elevationGainM)));
  const maxAltitudeM = Math.max(50, Math.min(4000, parseFiniteNumber(rawInput.maxAltitudeM, 1800)));
  const bodyWeightKg = Math.max(35, Math.min(160, parseFiniteNumber(rawInput.bodyWeightKg, 62)));
  const packWeightKg = Math.max(0, Math.min(40, parseFiniteNumber(rawInput.packWeightKg, 8)));
  const fitnessLevel: AiFitnessLevel =
    rawInput.fitnessLevel === 'beginner' || rawInput.fitnessLevel === 'advanced'
      ? rawInput.fitnessLevel
      : 'intermediate';
  const defaultTemp = maxAltitudeM >= 2400 ? 16 : maxAltitudeM >= 1400 ? 22 : 28;
  const ambientTempC = Math.max(-5, Math.min(45, parseFiniteNumber(rawInput.ambientTempC, defaultTemp)));
  const defaultDays = distanceKm >= 16 || elevationGainM >= 1300 ? 2 : 1;
  const durationDays = Math.max(1, Math.min(10, Math.round(parseFiniteNumber(rawInput.durationDays, defaultDays))));

  // 1. Pack-weight ratio & fatigue scaling
  const packRatioPercent = Math.round((packWeightKg / bodyWeightKg) * 1000) / 10;
  const packStatus: BioCalcResult['packStatus'] =
    packRatioPercent > 22 ? 'overweight' : packRatioPercent > 18 ? 'caution' : 'optimal';

  const packFatigueMultiplier = packRatioPercent > 15 ? 1 + 0.015 * (packRatioPercent - 15) : 1;

  // 2. Naismith's Rule + Langmuir technical rocky descent penalty
  const baseSpeed = FITNESS_HORIZONTAL_KMH[fitnessLevel];
  const horizontalHrs = distanceKm / baseSpeed;
  const climbHrs = elevationGainM / 600;
  const avgDescentGrade = distanceKm > 0 ? elevationLossM / (distanceKm * 500) : 0;
  const steepDescentHrs = avgDescentGrade > 0.12 ? elevationLossM / 1800 : 0; // +10 min / 300m steep descent
  const naismithHours = Math.round((horizontalHrs + climbHrs + steepDescentHrs) * packFatigueMultiplier * 10) / 10;

  // 3. Tobler's Hiking Function estimate (segment-accurate if GPX provided, else split ascent/descent approximation)
  let toblerRawHours: number;
  if (
    segmentStats?.toblerHoursDirect !== undefined &&
    Number.isFinite(segmentStats.toblerHoursDirect) &&
    segmentStats.toblerHoursDirect > 0
  ) {
    toblerRawHours = segmentStats.toblerHoursDirect * packFatigueMultiplier;
  } else {
    const halfDistKm = Math.max(0.25, distanceKm / 2);
    const upSlope = elevationGainM / (halfDistKm * 1000);
    const downSlope = -elevationLossM / (halfDistKm * 1000);
    const upHrs = halfDistKm / computeToblerSpeedKmH(upSlope, fitnessLevel);
    const downHrs = halfDistKm / computeToblerSpeedKmH(downSlope, fitnessLevel);
    toblerRawHours = (upHrs + downHrs) * packFatigueMultiplier;
  }
  const toblerHours = Math.round(toblerRawHours * 10) / 10;

  // Recommended moving hours blends Naismith & Tobler conservatively
  const recommendedMovingHours = Math.round(((naismithHours * 0.5 + toblerHours * 0.5) * 10)) / 10;
  // Total trip time including rest, meals, summit photos (~22%)
  const estimatedTotalTripHours = Math.round(recommendedMovingHours * 1.22 * 10) / 10;

  // 4. Hydration & Electrolyte Physiology
  const baseLitersPerHour = 0.48;
  const heatAdditionPerHour = ambientTempC > 20 ? ((ambientTempC - 20) / 5) * 0.12 : 0;
  const altitudeWaterMultiplier = maxAltitudeM >= 2500 ? 1.15 : 1.0;
  const waterLitersTotal =
    Math.round(Math.max(1.5, recommendedMovingHours * (baseLitersPerHour + heatAdditionPerHour) * altitudeWaterMultiplier) * 10) / 10;
  const waterLitersPerDay = Math.round((waterLitersTotal / durationDays) * 10) / 10;
  const oresolPackets = Math.max(durationDays, Math.ceil(waterLitersTotal / 1.8));

  // 5. Calorie Burn (METs adjusted for climb rate + pack load)
  const climbRateMPerHr = recommendedMovingHours > 0 ? elevationGainM / recommendedMovingHours : 0;
  const metValue = 5.8 + (climbRateMPerHr / 300) * 1.1 + (packWeightKg / bodyWeightKg) * 3.5;
  const caloriesActiveKcal = Math.round(metValue * bodyWeightKg * recommendedMovingHours);
  const caloriesDailyTotalKcal = Math.round(caloriesActiveKcal / durationDays + 1550);

  // 6. Pack Advice
  const maxRecommendedPackKg = Math.round(bodyWeightKg * 0.18 * 10) / 10;
  const packAdvice =
    packStatus === 'optimal'
      ? `Tỷ lệ tải ${packRatioPercent}% (<= 18% thể trọng) đạt mức tối ưu bảo vệ khớp gối và cột sống.`
      : packStatus === 'caution'
      ? `Tỷ lệ tải ${packRatioPercent}% ở ngưỡng khá nặng (18–22%). Nên siết chặt đai hông trợ lực và cân nhắc san sẻ hoặc thuê Porter.`
      : `CẢNH BÁO QUÁ TẢI (${packRatioPercent}% > 22%). Nên giảm trọng lượng balo về dưới ${maxRecommendedPackKg} kg hoặc thuê Porter gùi đồ chung.`;

  // 7. AMS Altitude Risk
  let amsRiskLevel: BioCalcResult['amsRiskLevel'] = 'none';
  let amsAdvice = 'Cao độ dưới 2.000m, hầu như không có nguy cơ sốc độ cao AMS; ưu tiên phòng tránh sốc nhiệt và mất nước.';
  if (maxAltitudeM >= 2900) {
    amsRiskLevel = 'high';
    amsAdvice = `Đỉnh cao ${maxAltitudeM.toLocaleString()}m (áp suất oxy giảm ~30%). Đi nhịp chậm (Rest Step), uống nước ấm đều mỗi 15 phút và hạ độ cao ngay 300–500m nếu đau đầu buốt hoặc buồn nôn.`;
  } else if (maxAltitudeM >= 2400) {
    amsRiskLevel = 'moderate';
    amsAdvice = `Cao độ ${maxAltitudeM.toLocaleString()}m có thể gây đau đầu nhẹ/mất ngủ đêm tại lán. Tránh uống rượu bia buổi tối và giữ ấm đầu cổ.`;
  } else if (maxAltitudeM >= 2000) {
    amsRiskLevel = 'low';
    amsAdvice = `Cao độ ${maxAltitudeM.toLocaleString()}m có không khí mát loãng nhẹ, chỉ cần giữ nhịp thở đều 2:2 khi leo dốc gắt.`;
  }

  const snackPlan = [
    `Nước uống: ~${waterLitersPerDay}L/ngày (tổng ${waterLitersTotal}L) chia từng ngụm nhỏ mỗi 15–20 phút.`,
    `Điện giải: ${oresolPackets} gói Oresol hoặc viên sủi điện giải chống chuột rút.`,
    `Năng lượng nhanh dọc đường: ${Math.max(2, Math.ceil(caloriesActiveKcal / 1200))} thanh lương khô / gel năng lượng + 100g hạt dinh dưỡng + socola đen 70%.`,
  ];

  return {
    inputs: {
      trailName: rawInput.trailName,
      distanceKm: Math.round(distanceKm * 10) / 10,
      elevationGainM: Math.round(elevationGainM),
      elevationLossM: Math.round(elevationLossM),
      maxAltitudeM: Math.round(maxAltitudeM),
      bodyWeightKg: Math.round(bodyWeightKg),
      packWeightKg: Math.round(packWeightKg * 10) / 10,
      fitnessLevel,
      ambientTempC: Math.round(ambientTempC),
      durationDays,
    },
    naismithHours,
    toblerHours,
    recommendedMovingHours,
    estimatedTotalTripHours,
    waterLitersTotal,
    waterLitersPerDay,
    oresolPackets,
    caloriesActiveKcal,
    caloriesDailyTotalKcal,
    packRatioPercent,
    packStatus,
    packAdvice,
    amsRiskLevel,
    amsAdvice,
    snackPlan,
  };
}
