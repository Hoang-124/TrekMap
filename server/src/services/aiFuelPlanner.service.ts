import { mockTrails } from '../data/seedData.js';
import { normalizeSearchText } from '../data/trekkerKnowledgeDataset.js';
import { resolveTrailByIdOrSlug } from '../utils/resolveTrail.js';
import { calculateAlpineBioMetrics } from './aiBioCalculator.service.js';
import type {
  AiFitnessLevel,
  FuelDietType,
  FuelPlanInput,
  FuelPlanResult,
  FuelRationItem,
  FuelWaterSpot,
} from './ai.types.js';
import type { Trail, Waypoint } from '../types.js';

function parseStrictFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'boolean' || value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function estimateVietnamTrailClimate(trail: Trail): { tempC: number; humidityPct: number } {
  // Real-world baseline sea-level mean by Vietnam region adjusted by environmental lapse rate (~0.62°C / 100m)
  const avgAltM = Math.max(100, trail.maxAltitudeM - trail.elevationGainM * 0.4);
  const seaLevelTemp =
    trail.region === 'Miền Nam' ? 30.5 : trail.region === 'Miền Trung' ? 27.5 : 24.5;
  const lapsed = Math.round(seaLevelTemp - (avgAltM / 100) * 0.62);
  const tempC = Math.max(4, Math.min(35, lapsed));
  const humidityPct =
    trail.region === 'Miền Nam'
      ? trail.hasWaterSource
        ? 80
        : 72
      : trail.maxAltitudeM >= 2000
      ? 85
      : 80;
  return { tempC, humidityPct };
}

// Strict water-body phrase regex (NEVER bare `\bho\b`, which falsely matches Bác Hồ, Cứu Hộ, Xà Hồ, Phìn Hồ, Hồ Thầu, Ho Tao!)
const STRICT_WATER_NAME_REGEX =
  /\b(suoi|thac|khe nuoc|nguon nuoc|gieng nuoc|bau sau|ngu ho|ho nuoc|ho thac mo|ho nui bau|ho da|song)\b/;
const FALSE_POSITIVE_WATER_NAME_REGEX =
  /\b(bac ho|cuu ho|ho tro|xa ho|phin ho|ho thau|ho mit|nam kang ho tao|hoang lien|trung tam du khach|cong vqg|cong kdl)\b/;
const SUMMIT_OR_SETTLEMENT_PREFIX_REGEX = /^(dinh|chop dinh|cot moc|moc|xa|thon|ban|tram kiem lam|chot kiem lam|cong)\b/;
const CAMP_OR_STATION_NAME_REGEX = /\b(lan nghi|lan dem|lan|bai trai|trai|diem ha trai|tram kiem lam|chot kiem lam)\b/;

function extractWaterResupplySpots(trail: Trail): FuelWaterSpot[] {
  // Rule 11 Safety Gate: NEVER emit stream/camp water resupply spots on dry trails!
  if (!trail.hasWaterSource) return [];

  const wps: Waypoint[] = Array.isArray(trail.waypoints) ? trail.waypoints : [];
  const spots: FuelWaterSpot[] = [];
  const seen = new Set<string>();

  for (const wp of wps) {
    const label = (wp.name || '').trim();
    if (!label) continue;
    const normName = normalizeSearchText(label);
    if (!normName || seen.has(normName)) continue;

    // Explicit water waypoints always qualify unless mislabeled summit
    const isExplicitWater = wp.type === 'water';
    const isPeakOrSummit =
      wp.type === 'viewpoint' ||
      /^(dinh|chop dinh|cot moc)\b/.test(normName) ||
      /\b(dinh|chop dinh)\b/.test(normName);

    const hasStrictWaterPhrase =
      !FALSE_POSITIVE_WATER_NAME_REGEX.test(normName) &&
      STRICT_WATER_NAME_REGEX.test(normName);

    const isWaterSpot = isExplicitWater || (!isPeakOrSummit && hasStrictWaterPhrase);

    const isCampSpot =
      !isWaterSpot &&
      !isPeakOrSummit &&
      !FALSE_POSITIVE_WATER_NAME_REGEX.test(normName) &&
      (wp.type === 'campsite' ||
        (!SUMMIT_OR_SETTLEMENT_PREFIX_REGEX.test(normName) && CAMP_OR_STATION_NAME_REGEX.test(normName)));

    if (!isWaterSpot && !isCampSpot) continue;
    seen.add(normName);

    const elevNum = Number(wp.elevationM);
    const elevationM =
      wp.elevationM !== undefined && wp.elevationM !== null && Number.isFinite(elevNum) && elevNum >= 0
        ? Math.round(elevNum)
        : undefined;

    if (isWaterSpot) {
      spots.push({
        name: label,
        elevationM,
        kind: 'stream',
        treatmentNote: 'Lọc bằng màng lọc 0.1 micron (Sawyer/Katadyn) hoặc đun sôi 100°C ít nhất 1 phút.',
      });
    } else {
      spots.push({
        name: label,
        elevationM,
        kind: /\b(tram|kiem lam)\b/.test(normName) ? 'station' : 'camp',
        treatmentNote: 'Điểm lán/trại gần nguồn nước tự nhiên — luôn đun sôi hoặc lọc trước khi uống.',
      });
    }
    if (spots.length >= 5) break;
  }

  return spots;
}

interface RationBlueprint {
  mealSlot: FuelRationItem['mealSlot'];
  name: string;
  unitLabel: string;
  gramsPerUnit: number;
  kcalPerUnit: number;
  vndPerUnit: number;
  unitsPerDay: number;
  overnightOnly?: boolean;
  fixedUnits?: number;
  scalableWithEnergy?: boolean;
  note: string;
}

const VIETNAMESE_RATIONS_BY_DIET: Record<FuelDietType, RationBlueprint[]> = {
  standard: [
    {
      mealSlot: 'Sáng',
      name: 'Bánh mì tươi chà bông / Xôi đậu phộng muối mè',
      unitLabel: 'phần',
      gramsPerUnit: 170,
      kcalPerUnit: 430,
      vndPerUnit: 25_000,
      unitsPerDay: 1,
      note: 'Nạp tinh bột chậm trước khi vào rừng 45–60 phút để ổn định đường huyết.',
    },
    {
      mealSlot: 'Dọc đường',
      name: 'Hạt điều rang muối Bình Phước + Nho khô (Trail Mix)',
      unitLabel: 'gói 100g',
      gramsPerUnit: 100,
      kcalPerUnit: 490,
      vndPerUnit: 32_000,
      unitsPerDay: 1,
      scalableWithEnergy: true,
      note: 'Ăn rải rác mỗi 60 phút leo dốc; giàu kali, magie & chất béo tốt chống tụt đường.',
    },
    {
      mealSlot: 'Dọc đường',
      name: 'Lương khô bay / Bánh gạo lứt & Kẹo gừng mật ong',
      unitLabel: 'thanh/gói',
      gramsPerUnit: 90,
      kcalPerUnit: 390,
      vndPerUnit: 18_000,
      unitsPerDay: 1,
      scalableWithEnergy: true,
      note: 'Năng lượng nhanh không cần chế biến, giữ ấm cổ họng khi đi trong sương mù.',
    },
    {
      mealSlot: 'Trưa',
      name: 'Cơm nắm muối vừng + Xúc xích tiệt trùng / Khô bò lát',
      unitLabel: 'suất',
      gramsPerUnit: 240,
      kcalPerUnit: 560,
      vndPerUnit: 42_000,
      unitsPerDay: 1,
      scalableWithEnergy: true,
      note: 'Bữa trưa gọn nhẹ giữa cung, cân bằng tinh bột & đạm phục hồi cơ đùi.',
    },
    {
      mealSlot: 'Tối lán',
      name: 'Cháo/Mì ăn liền + Cơm sấy chà bông + Trà gừng nóng',
      unitLabel: 'bữa tối',
      gramsPerUnit: 210,
      kcalPerUnit: 680,
      vndPerUnit: 45_000,
      unitsPerDay: 1,
      overnightOnly: true,
      scalableWithEnergy: true,
      note: 'Bổ sung nước nóng, muối khoáng & đạm buổi tối giúp giữ thân nhiệt trên núi cao.',
    },
    {
      mealSlot: 'Dự phòng',
      name: 'Sô-cô-la đen 70% + Gel năng lượng dự phòng khẩn cấp',
      unitLabel: 'bộ',
      gramsPerUnit: 95,
      kcalPerUnit: 440,
      vndPerUnit: 48_000,
      unitsPerDay: 1,
      fixedUnits: 1,
      note: 'Chỉ mở khi hạ đường huyết, lạnh run hoặc phải đi quá giờ dự kiến.',
    },
  ],
  vegetarian: [
    {
      mealSlot: 'Sáng',
      name: 'Bánh mì nguyên cám bơ đậu phộng / Xôi đậu xanh',
      unitLabel: 'phần',
      gramsPerUnit: 175,
      kcalPerUnit: 450,
      vndPerUnit: 25_000,
      unitsPerDay: 1,
      note: 'Đạm thực vật + tinh bột bền bỉ cho chặng leo dốc buổi sáng.',
    },
    {
      mealSlot: 'Dọc đường',
      name: 'Hạt điều, hạnh nhân & chuối sấy dẻo không đường',
      unitLabel: 'gói 110g',
      gramsPerUnit: 110,
      kcalPerUnit: 510,
      vndPerUnit: 36_000,
      unitsPerDay: 1,
      scalableWithEnergy: true,
      note: 'Bổ sung kali chống chuột rút bắp chân và năng lượng đều đặn mỗi giờ.',
    },
    {
      mealSlot: 'Dọc đường',
      name: 'Lương khô đậu xanh / Thanh yến mạch hạt chia',
      unitLabel: 'thanh/gói',
      gramsPerUnit: 95,
      kcalPerUnit: 410,
      vndPerUnit: 22_000,
      unitsPerDay: 1,
      scalableWithEnergy: true,
      note: 'Thuần chay 100%, gọn nhẹ trong túi hông balo để ăn nhanh khi đang đi.',
    },
    {
      mealSlot: 'Trưa',
      name: 'Cơm nắm rong biển muối mè + Đậu hũ khô / Nấm sấy giòn',
      unitLabel: 'suất',
      gramsPerUnit: 230,
      kcalPerUnit: 520,
      vndPerUnit: 38_000,
      unitsPerDay: 1,
      scalableWithEnergy: true,
      note: 'Cung cấp đạm đậu nành & khoáng chất tự nhiên không gây nặng bụng khi leo tiếp.',
    },
    {
      mealSlot: 'Tối lán',
      name: 'Mì/Cháo nấm đông cô thuần chay + Đậu phộng rang + Trà gừng',
      unitLabel: 'bữa tối',
      gramsPerUnit: 195,
      kcalPerUnit: 640,
      vndPerUnit: 40_000,
      unitsPerDay: 1,
      overnightOnly: true,
      scalableWithEnergy: true,
      note: 'Nước súp ấm giúp phục hồi nhanh và giảm mệt mỏi sau ngày leo dài.',
    },
    {
      mealSlot: 'Dự phòng',
      name: 'Sô-cô-la đen thuần chay + Kẹo gừng đường nâu',
      unitLabel: 'bộ',
      gramsPerUnit: 90,
      kcalPerUnit: 420,
      vndPerUnit: 42_000,
      unitsPerDay: 1,
      fixedUnits: 1,
      note: 'Khẩu phần khẩn cấp chống tụt huyết áp & giữ ấm trong trời sương.',
    },
  ],
  ultralight: [
    {
      mealSlot: 'Sáng',
      name: 'Yến mạch cán dẹt + Bơ đậu phộng gói bóp + Hạt chia',
      unitLabel: 'gói',
      gramsPerUnit: 110,
      kcalPerUnit: 520,
      vndPerUnit: 34_000,
      unitsPerDay: 1,
      note: 'Mật độ năng lượng ~4.7 kcal/g, chỉ cần nước nóng hoặc ngâm lạnh không tốn gas.',
    },
    {
      mealSlot: 'Dọc đường',
      name: 'Hạt mắc ca Tây Nguyên & hạnh nhân rang (siêu nhẹ ~6.7 kcal/g)',
      unitLabel: 'gói 85g',
      gramsPerUnit: 85,
      kcalPerUnit: 560,
      vndPerUnit: 55_000,
      unitsPerDay: 1,
      scalableWithEnergy: true,
      note: 'Tối ưu tỷ lệ calo/gram cao nhất cho balo tối giản (Ultralight).',
    },
    {
      mealSlot: 'Dọc đường',
      name: 'Gel năng lượng (GU/Hammer) + Kẹo dẻo điện giải',
      unitLabel: 'bộ 2 gói',
      gramsPerUnit: 68,
      kcalPerUnit: 220,
      vndPerUnit: 72_000,
      unitsPerDay: 1,
      scalableWithEnergy: true,
      note: 'Hấp thu nhanh trong 10–15 phút ở các con dốc gắt >20% không cần dừng lâu.',
    },
    {
      mealSlot: 'Trưa',
      name: 'Lương khô cao năng lượng nén + Khô gà/Ruốc cá hồi siêu nhẹ',
      unitLabel: 'suất',
      gramsPerUnit: 135,
      kcalPerUnit: 610,
      vndPerUnit: 48_000,
      unitsPerDay: 1,
      scalableWithEnergy: true,
      note: 'Không cần nấu nướng giữa chặng, tổng trọng lượng chỉ 135g nhưng >600 kcal.',
    },
    {
      mealSlot: 'Tối lán',
      name: 'Cơm sấy/Cháo yến mạch đông khô + Ruốc thịt + Trà gừng gói',
      unitLabel: 'bữa tối',
      gramsPerUnit: 145,
      kcalPerUnit: 650,
      vndPerUnit: 65_000,
      unitsPerDay: 1,
      overnightOnly: true,
      scalableWithEnergy: true,
      note: 'Chỉ cần đổ nước sôi 300ml chờ 5 phút, không cần rửa nồi.',
    },
    {
      mealSlot: 'Dự phòng',
      name: 'Thanh Protein bar + Sô-cô-la đen 85% dự phòng',
      unitLabel: 'bộ',
      gramsPerUnit: 85,
      kcalPerUnit: 430,
      vndPerUnit: 60_000,
      unitsPerDay: 1,
      fixedUnits: 1,
      note: 'Dự phòng khẩn cấp chịu ẩm tốt, mật độ năng lượng >5 kcal/g.',
    },
  ],
};

const DIET_LABELS: Record<FuelDietType, string> = {
  standard: 'Tiêu chuẩn Việt Nam',
  vegetarian: 'Thuần chay / Ăn chay',
  ultralight: 'Siêu nhẹ (Ultralight)',
};

const ORESOL_GRAMS_PER_PACKET = 5;
const ORESOL_VND_PER_PACKET = 5_000;

/**
 * Deterministic AI Nutrition, Hydration & Electrolyte Planner (Wave 14A, hardened Wave 15B-5).
 * Uses Pandolf/ACSM load-carriage energy model, Vietnam alpine heat/humidity sweat rate,
 * real trail waypoint water resupply analysis, and authentic Vietnamese trail rations.
 * Strictly serves approved trails only.
 */
export async function computeTrailFuelPlan(
  input: FuelPlanInput,
  availableTrails: Trail[] = []
): Promise<FuelPlanResult | null> {
  const pool = availableTrails.length > 0 ? availableTrails : mockTrails;
  const rawId = (input.trailId || '').trim();
  if (!rawId) return null;

  let rawTrail: any =
    pool.find((t) => t.id === rawId) ||
    pool.find((t) => normalizeSearchText(t.name) === normalizeSearchText(rawId)) ||
    null;

  if (!rawTrail) {
    const dbTrail = await resolveTrailByIdOrSlug(rawId).catch(() => null);
    if (dbTrail && (!dbTrail.status || dbTrail.status === 'approved')) {
      rawTrail = dbTrail;
    }
  }
  if (!rawTrail) return null;
  if (rawTrail.status && rawTrail.status !== 'approved') return null;

  const rawMaxAlt = parseStrictFiniteNumber(rawTrail.maxAltitudeM);
  const rawDistKm = parseStrictFiniteNumber(rawTrail.distanceKm);
  const rawGainM = parseStrictFiniteNumber(rawTrail.elevationGainM);
  const rawDays = parseStrictFiniteNumber(rawTrail.durationDays);
  const rawDiff = parseStrictFiniteNumber(rawTrail.difficultyLevel);

  const trail: Trail = {
    ...(rawTrail as Trail),
    id: String(rawTrail.id || rawTrail._id || rawId),
    name: String(rawTrail.name || 'Cung đường LOST'),
    province: String(rawTrail.province || 'Việt Nam'),
    district: String(rawTrail.district || ''),
    region: rawTrail.region === 'Miền Trung' || rawTrail.region === 'Miền Nam' ? rawTrail.region : 'Miền Bắc',
    maxAltitudeM: Math.max(0, Math.min(4000, Math.round(rawMaxAlt ?? 1500))),
    distanceKm: Math.max(0.5, Math.min(200, Math.round((rawDistKm ?? 12) * 10) / 10)),
    elevationGainM: Math.max(0, Math.min(8000, Math.round(rawGainM ?? 600))),
    durationDays: Math.max(1, Math.min(14, Math.round(rawDays ?? 1))),
    difficultyLevel: Math.max(1, Math.min(5, Math.round(rawDiff ?? 3))),
    hasWaterSource: Boolean(rawTrail.hasWaterSource),
    waypoints: Array.isArray(rawTrail.waypoints) ? rawTrail.waypoints : [],
  };

  const fitnessLevel: AiFitnessLevel =
    input.fitnessLevel === 'beginner' || input.fitnessLevel === 'advanced'
      ? input.fitnessLevel
      : 'intermediate';
  const dietType: FuelDietType =
    input.dietType === 'vegetarian' || input.dietType === 'ultralight'
      ? input.dietType
      : 'standard';

  const rawBodyKg = parseStrictFiniteNumber(input.bodyWeightKg);
  const bodyWeightKg = Math.max(35, Math.min(160, Math.round(rawBodyKg ?? 62)));

  const defaultPack = trail.durationDays >= 2 ? 9 : 5;
  const rawPackKg = parseStrictFiniteNumber(input.packWeightKg);
  const packWeightKg = Math.max(0, Math.min(40, Math.round((rawPackKg ?? defaultPack) * 10) / 10));

  const estimatedClimate = estimateVietnamTrailClimate(trail);
  const rawTempC = parseStrictFiniteNumber(input.ambientTempC);
  const ambientTempC = Math.max(-5, Math.min(45, Math.round(rawTempC ?? estimatedClimate.tempC)));

  const rawHumidity = parseStrictFiniteNumber(input.humidityPct);
  const humidityPct = Math.max(20, Math.min(100, Math.round(rawHumidity ?? estimatedClimate.humidityPct)));

  const rawGroup = parseStrictFiniteNumber(input.groupSize);
  const groupSize = Math.max(1, Math.min(20, Math.round(rawGroup ?? 1)));

  // 1. Calibrated Tobler/Naismith moving duration
  const bio = calculateAlpineBioMetrics({
    trailId: trail.id,
    trailName: trail.name,
    distanceKm: trail.distanceKm,
    elevationGainM: trail.elevationGainM,
    elevationLossM: trail.elevationGainM,
    maxAltitudeM: trail.maxAltitudeM,
    bodyWeightKg,
    packWeightKg,
    fitnessLevel,
    ambientTempC,
    durationDays: trail.durationDays,
  });

  const movingHours = Math.max(1, bio.recommendedMovingHours);
  const ascentHours = movingHours * 0.58;
  const descentHours = movingHours * 0.42;

  // 2. Pandolf / ACSM Load-Carriage Metabolic Expenditure (strictly non-negative)
  const distanceM = Math.max(500, trail.distanceKm * 1000);
  const avgSpeedMs = Math.max(0.45, Math.min(1.4, distanceM / (movingHours * 3600)));
  const avgAscentGradePct = Math.max(0, Math.min(25, (trail.elevationGainM / Math.max(400, distanceM * 0.5)) * 100));
  const terrainFactor = 1.22 + Math.max(0, trail.difficultyLevel - 1) * 0.08;

  const standingWatts =
    1.5 * bodyWeightKg +
    2.0 * (bodyWeightKg + packWeightKg) * Math.pow(packWeightKg / bodyWeightKg, 2);
  const ascentWatts =
    standingWatts +
    terrainFactor * (bodyWeightKg + packWeightKg) * (1.5 * avgSpeedMs * avgSpeedMs + 0.35 * avgSpeedMs * avgAscentGradePct);
  const descentWatts =
    standingWatts +
    terrainFactor * (bodyWeightKg + packWeightKg) * (1.2 * avgSpeedMs * avgSpeedMs);

  // Convert Watts to kcal/h (1 Watt = 0.86042 kcal/h)
  const rawActiveKcal = Math.max(0, (ascentWatts * ascentHours + descentWatts * descentHours) * 0.86042);
  const altitudeColdFactor =
    1 + (trail.maxAltitudeM >= 2500 ? 0.06 : 0) + (ambientTempC <= 12 ? 0.05 : 0);
  const activeKcal = Math.max(0, Math.round((rawActiveKcal * altitudeColdFactor) / 10) * 10);

  // Non-moving baseline metabolic expenditure (camp/rest/sleep) across the expedition
  const nonMovingHours = Math.max(4, trail.durationDays * 24 - movingHours);
  const restBmrKcalPerHour = (bodyWeightKg * 23.5) / 24;
  const restKcal = Math.max(0, Math.round((nonMovingHours * restBmrKcalPerHour) / 10) * 10);
  const totalTripKcal = Math.max(1400, activeKcal + restKcal);
  const dailyKcal = Math.round(totalTripKcal / trail.durationDays / 10) * 10;

  // Endurance alpine macro split: 58% Carbs / 16% Protein / 26% Fat
  const carbsPct = 58;
  const proteinPct = 16;
  const fatPct = 26;
  const carbsGrams = Math.round((totalTripKcal * (carbsPct / 100)) / 4);
  const proteinGrams = Math.round((totalTripKcal * (proteinPct / 100)) / 4);
  const fatGrams = Math.round((totalTripKcal * (fatPct / 100)) / 9);

  // 3. Vietnam Alpine/Tropical Sweat-Rate Hydration & Sodium/Oresol Model
  const packRatioPct = (packWeightKg / bodyWeightKg) * 100;
  const tempDeltaC = ambientTempC - 18;
  const baseSweat = Math.max(0.36, 0.54 + (tempDeltaC >= 0 ? tempDeltaC * 0.032 : tempDeltaC * 0.01));
  const humidityMult = ambientTempC >= 24 && humidityPct >= 75 ? 1 + ((humidityPct - 70) / 100) * 0.55 : 1;
  const altitudeDryBonus = trail.maxAltitudeM >= 2800 ? 0.12 : trail.maxAltitudeM >= 2100 ? 0.07 : 0;
  const loadSweatMult = 1 + Math.max(0, packRatioPct - 12) * 0.012;

  const sweatRateLPerHour =
    Math.round(Math.min(1.45, Math.max(0.38, (baseSweat * humidityMult + altitudeDryBonus) * loadSweatMult)) * 100) / 100;

  const activeWaterL = sweatRateLPerHour * movingHours;
  const overnightCookingL = Math.max(0, trail.durationDays - 1) * 1.1;
  const baselineCampHydrationL = trail.durationDays * 0.75;
  const waterLitersTotal = Math.round(Math.max(1.5, activeWaterL + overnightCookingL + baselineCampHydrationL) * 10) / 10;
  const waterLitersPerDay = Math.round((waterLitersTotal / trail.durationDays) * 10) / 10;

  // Sodium loss (500–800 mg/L active sweat) -> WHO Oresol (~520mg Na / gói) + food salt balance
  const sodiumPerLiterSweat = ambientTempC >= 27 ? 780 : ambientTempC >= 20 ? 620 : 500;
  const totalActiveSodiumMg = activeWaterL * sodiumPerLiterSweat;
  const sodiumMgPerDay = Math.round(totalActiveSodiumMg / trail.durationDays / 10) * 10;
  const oresolPacketsTotal = Math.max(trail.durationDays, Math.min(trail.durationDays * 5, Math.ceil(totalActiveSodiumMg / 650)));
  const oresolPacketsPerDay = Math.max(1, Math.round((oresolPacketsTotal / trail.durationDays) * 10) / 10);

  // 4. Real Trail Waypoint Water Resupply & Honest Uncapped Dry-Trail Carry Water
  const waterResupplySpots = extractWaterResupplySpots(trail);
  let carryWaterPerLegLiters: number;
  const alertParts: string[] = [];

  if (trail.hasWaterSource && waterResupplySpots.length > 0) {
    const legDivisor = Math.min(2.4, 1.35 + waterResupplySpots.length * 0.25);
    carryWaterPerLegLiters = Math.round(Math.max(1.5, Math.min(2.5, waterLitersPerDay / legDivisor)) * 10) / 10;
  } else if (trail.hasWaterSource) {
    carryWaterPerLegLiters = Math.round(Math.max(1.8, Math.min(3.5, waterLitersPerDay * 0.75)) * 10) / 10;
  } else {
    // NEVER cap dry-trail daily carry below physiological waterLitersPerDay!
    carryWaterPerLegLiters = Math.round(Math.max(2.0, waterLitersPerDay) * 10) / 10;
    if (trail.durationDays >= 2) {
      alertParts.push(
        `Tuyến khô ${trail.name} (${trail.durationDays} ngày) KHÔNG có nguồn nước ổn định dọc đường — nhu cầu ${carryWaterPerLegLiters}L/ngày (tổng ${waterLitersTotal}L cả chuyến). Bắt buộc đặt porter/xuồng tiếp nước hoặc gửi nước tại điểm hạ trại cho Ngày 2+.`
      );
    } else {
      alertParts.push(
        `Tuyến khô ${trail.name} KHÔNG có nguồn nước dọc đường — bắt buộc mang đủ tối thiểu ${carryWaterPerLegLiters}L ngay từ cửa rừng (không cắt giảm dưới nhu cầu thực tế).`
      );
    }
  }

  if (ambientTempC >= 28 || (ambientTempC >= 25 && humidityPct >= 82)) {
    alertParts.push(
      `Cảnh báo nắng nóng/ẩm cao (${ambientTempC}°C, độ ẩm ${humidityPct}%): đổ mồ hôi ~${sweatRateLPerHour}L/giờ — pha điện giải WHO Oresol đều đặn, tránh uống ồ ạt nước lọc gây hạ natri máu (hyponatremia).`
    );
  }
  if (trail.maxAltitudeM >= 2600) {
    alertParts.push(
      `Đỉnh cao ${trail.maxAltitudeM.toLocaleString('vi-VN')}m: không khí loãng & lạnh làm mất nước qua hô hấp âm thầm — nhấp 150–200ml mỗi 20 phút kể cả khi không thấy khát.`
    );
  }
  const hydrationAlert = alertParts.length > 0 ? alertParts.join(' | ') : undefined;

  // 5. Build Authentic Vietnamese Trail Rations Scaled to Duration & Heavy Energy Demand + Explicit Oresol Row
  const nights = Math.max(0, trail.durationDays - 1);
  const templates = VIETNAMESE_RATIONS_BY_DIET[dietType];
  const energyScale = Math.max(0.85, Math.min(2.1, dailyKcal / 2550));

  const rations: FuelRationItem[] = [];
  let totalFoodGramsPerPerson = 0;
  let totalVndPerPerson = 0;
  let totalRationKcalPerPerson = 0;

  for (const tpl of templates) {
    if (tpl.overnightOnly && nights === 0) continue;

    let units: number;
    if (tpl.fixedUnits !== undefined) {
      units = tpl.fixedUnits;
    } else if (tpl.overnightOnly) {
      units = Math.max(1, Math.round(nights * tpl.unitsPerDay * (dailyKcal >= 3600 ? 1.35 : 1.0)));
    } else if (tpl.scalableWithEnergy) {
      units = Math.max(1, Math.round(trail.durationDays * tpl.unitsPerDay * energyScale));
    } else {
      units = Math.max(1, trail.durationDays * tpl.unitsPerDay);
    }

    const weightPerPerson = Math.round(units * tpl.gramsPerUnit);
    const kcalPerPerson = Math.round(units * tpl.kcalPerUnit);
    const vndPerPerson = Math.round(units * tpl.vndPerUnit);

    totalFoodGramsPerPerson += weightPerPerson;
    totalVndPerPerson += vndPerPerson;
    totalRationKcalPerPerson += kcalPerPerson;

    rations.push({
      mealSlot: tpl.mealSlot,
      name: tpl.name,
      quantityLabel:
        groupSize > 1 ? `${units} ${tpl.unitLabel}/người (đoàn ${units * groupSize})` : `${units} ${tpl.unitLabel}`,
      weightGramsPerPerson: weightPerPerson,
      totalGramsGroup: weightPerPerson * groupSize,
      kcalPerPerson,
      estimatedVndPerPerson: vndPerPerson,
      note: tpl.note,
    });
  }

  // Add WHO Oresol (~5g/gói, ~5.000 VNĐ/gói) as an explicit ration row so Table Sum === Footer Total 1:1!
  const oresolGramsPerPerson = oresolPacketsTotal * ORESOL_GRAMS_PER_PACKET;
  const oresolVndPerPerson = oresolPacketsTotal * ORESOL_VND_PER_PACKET;
  const oresolKcalPerPerson = oresolPacketsTotal * 15; // ~13.5g glucose/gói WHO 245 mOsm/L (chỉ tính phần nhẹ)
  totalFoodGramsPerPerson += oresolGramsPerPerson;
  totalVndPerPerson += oresolVndPerPerson;
  totalRationKcalPerPerson += oresolKcalPerPerson;

  rations.push({
    mealSlot: 'Dọc đường',
    name: 'Điện giải WHO Oresol 245 mOsm/L (bù Na+/K+)',
    quantityLabel:
      groupSize > 1
        ? `${oresolPacketsTotal} gói/người (đoàn ${oresolPacketsTotal * groupSize} gói)`
        : `${oresolPacketsTotal} gói`,
    weightGramsPerPerson: oresolGramsPerPerson,
    totalGramsGroup: oresolGramsPerPerson * groupSize,
    kcalPerPerson: oresolKcalPerPerson,
    estimatedVndPerPerson: oresolVndPerPerson,
    note: `Pha đúng hướng dẫn trên gói (~${oresolPacketsPerDay} gói/ngày, bù ~${sodiumMgPerDay.toLocaleString('vi-VN')} mg Na/ngày).`,
  });

  const foodWeightKgPerPerson = Math.round((totalFoodGramsPerPerson / 1000) * 100) / 100;
  const carryWaterWeightKgPerPerson = carryWaterPerLegLiters;
  const totalConsumableCarryKg = Math.round((foodWeightKgPerPerson + carryWaterWeightKgPerPerson) * 100) / 100;

  const waterTacticalLine = trail.hasWaterSource
    ? waterResupplySpots.length > 0
      ? `Có nguồn nước tự nhiên dọc tuyến (${waterResupplySpots.length} điểm tham chiếu) — mang ${carryWaterPerLegLiters}L mỗi chặng kèm bộ lọc 0.1 micron để giảm gánh nặng lưng vai.`
      : `Tuyến có nguồn suối/nước tự nhiên theo mùa — mang ${carryWaterPerLegLiters}L/chặng kèm bộ lọc 0.1 micron và kiểm tra tình trạng suối với kiểm lâm/porter trước khi vào rừng.`
    : trail.durationDays >= 2
    ? `Tuyến khô ${trail.durationDays} ngày không có suối dọc đường — mang ${carryWaterPerLegLiters}L/ngày (tổng ${waterLitersTotal}L cả chuyến) và sắp xếp porter/điểm gửi tiếp nước cho Ngày 2+.`
    : `Tuyến khô không có suối dọc đường — chia đủ ${carryWaterPerLegLiters}L vào 2 bình cứng/túi nước chống rò đặt sát lưng giữa balo ngay từ cửa rừng.`;

  const tacticalNotes: string[] = [
    `Mô hình Pandolf/ACSM (${bodyWeightKg}kg + balo ${packWeightKg}kg, ${trail.distanceKm}km / +${trail.elevationGainM}m): tiêu hao ~${activeKcal.toLocaleString('vi-VN')} kcal vận động (tổng ${totalTripKcal.toLocaleString('vi-VN')} kcal cả chuyến).`,
    `Nhịp uống nước thực địa: nhấp 150–200ml mỗi 15–20 phút (tổng ~${waterLitersPerDay}L/ngày + ${oresolPacketsPerDay} gói Oresol/ngày); pha đúng tỷ lệ hướng dẫn trên gói WHO 245 mOsm/L.`,
    waterTacticalLine,
    `Chế độ ${DIET_LABELS[dietType]}: đồ ăn + Oresol ~${foodWeightKgPerPerson} kg/người (~${totalVndPerPerson.toLocaleString('vi-VN')} VNĐ/người) — mang túi zip gom toàn bộ vỏ gói rác xuống núi (Leave No Trace).`,
  ];

  if (totalRationKcalPerPerson < totalTripKcal * 0.88) {
    tacticalNotes.push(
      `Lưu ý năng lượng cường độ cao: khẩu phần mang theo cung cấp ~${totalRationKcalPerPerson.toLocaleString('vi-VN')} kcal vs tiêu hao ước tính ${totalTripKcal.toLocaleString('vi-VN')} kcal — nên bổ sung bữa nóng giàu tinh bột/đạm tại lán hoặc đặt suất ăn porter.`
    );
  }

  return {
    trailId: trail.id,
    trailName: trail.name,
    province: trail.province,
    region: trail.region,
    maxAltitudeM: trail.maxAltitudeM,
    distanceKm: trail.distanceKm,
    elevationGainM: trail.elevationGainM,
    durationDays: trail.durationDays,
    difficultyLevel: trail.difficultyLevel,
    hasWaterSource: trail.hasWaterSource,
    inputs: {
      bodyWeightKg,
      packWeightKg,
      fitnessLevel,
      dietType,
      dietLabel: DIET_LABELS[dietType],
      ambientTempC,
      humidityPct,
      groupSize,
    },
    energy: {
      movingHours: Math.round(movingHours * 10) / 10,
      activeKcal,
      totalTripKcal,
      dailyKcal,
      carbsGrams,
      proteinGrams,
      fatGrams,
      carbsPct,
      proteinPct,
      fatPct,
    },
    hydration: {
      sweatRateLPerHour,
      waterLitersPerDay,
      waterLitersTotal,
      carryWaterPerLegLiters,
      sodiumMgPerDay,
      oresolPacketsPerDay,
      oresolPacketsTotal,
      hydrationAlert,
      waterResupplySpots,
    },
    rations,
    totals: {
      foodWeightKgPerPerson,
      carryWaterWeightKgPerPerson,
      totalConsumableCarryKg,
      estimatedFoodCostVndPerPerson: totalVndPerPerson,
      estimatedFoodCostVndGroup: totalVndPerPerson * groupSize,
      currency: 'VND',
    },
    tacticalNotes,
  };
}
