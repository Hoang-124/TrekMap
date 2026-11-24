import { mockTrails } from '../data/seedData.js';
import { normalizeSearchText } from '../data/trekkerKnowledgeDataset.js';
import { resolveTrailByIdOrSlug } from '../utils/resolveTrail.js';
import { getVietnamTodayIso, isValidCalendarDateIso } from './goNoGo.service.js';
import { calculateAlpineBioMetrics } from './aiBioCalculator.service.js';
import type {
  AiFitnessLevel,
  NoaaSolarWindow,
  PacePlanCheckpoint,
  PacePlanInput,
  PacePlanResult,
} from './ai.types.js';
import type { Trail, Waypoint } from '../types.js';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const VIETNAM_UTC_OFFSET_MIN = 7 * 60; // Asia/Ho_Chi_Minh (UTC+7)
const STRICT_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimeHHMM(input: unknown): input is string {
  return typeof input === 'string' && STRICT_TIME_REGEX.test(input.trim());
}

export function parseTimeToMinutes(hhmm: string): number {
  const m = hhmm.trim().match(STRICT_TIME_REGEX);
  if (!m) return 6 * 60;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatMinutesToHHMM(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes);
  const wrapped = ((rounded % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const min = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * Exact NOAA Solar Ephemeris calculation for Civil Dawn (96°), Sunrise/Sunset (90.833°),
 * Solar Noon, and Civil Dusk (96°) at exact Vietnam summit coordinates in Asia/Ho_Chi_Minh (UTC+7).
 */
export function computeNoaaSolarTimesVietnam(
  lat: number,
  lng: number,
  dateIso: string
): NoaaSolarWindow {
  const safeLat = Math.max(-65, Math.min(65, Number.isFinite(lat) ? lat : 21.0285));
  const safeLng = Math.max(-180, Math.min(180, Number.isFinite(lng) ? lng : 105.8542));
  const [rawYear, rawMonth, rawDay] = dateIso.split('-').map(Number);
  const safeYear = Number.isFinite(rawYear) && rawYear >= 1900 && rawYear <= 2100 ? rawYear : 2026;
  const safeMonth = Number.isFinite(rawMonth) && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : 1;
  const safeDay = Number.isFinite(rawDay) && rawDay >= 1 && rawDay <= 31 ? rawDay : 1;

  const utcDate = Date.UTC(safeYear, safeMonth - 1, safeDay);
  const startOfYear = Date.UTC(safeYear, 0, 1);
  const dayOfYear = Math.floor((utcDate - startOfYear) / 86_400_000) + 1;
  const isLeap = (safeYear % 4 === 0 && safeYear % 100 !== 0) || safeYear % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;

  // Fractional year in radians at local noon
  const gamma = ((2 * Math.PI) / daysInYear) * (dayOfYear - 1);

  // Equation of time (minutes)
  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  // Solar declination angle (radians)
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const latRad = safeLat * DEG2RAD;

  const hourAngleDeg = (zenithDeg: number): number => {
    const cosH =
      Math.cos(zenithDeg * DEG2RAD) / (Math.cos(latRad) * Math.cos(decl)) -
      Math.tan(latRad) * Math.tan(decl);
    const clamped = Math.max(-1, Math.min(1, cosH));
    return Math.acos(clamped) * RAD2DEG;
  };

  const haSun = hourAngleDeg(90.833);
  const haCivil = hourAngleDeg(96.0);

  // Solar noon in Vietnam local time (UTC+7)
  const solarNoonMin = 720 - 4 * safeLng - eqtime + VIETNAM_UTC_OFFSET_MIN;
  const sunriseMin = Math.round(solarNoonMin - 4 * haSun);
  const sunsetMin = Math.round(solarNoonMin + 4 * haSun);
  const civilDawnMin = Math.round(solarNoonMin - 4 * haCivil);
  const civilDuskMin = Math.round(solarNoonMin + 4 * haCivil);
  const daylightHours = Math.round(((sunsetMin - sunriseMin) / 60) * 10) / 10;

  return {
    date: dateIso,
    timezone: 'Asia/Ho_Chi_Minh',
    summitLat: Math.round(safeLat * 10_000) / 10_000,
    summitLng: Math.round(safeLng * 10_000) / 10_000,
    civilDawn: formatMinutesToHHMM(civilDawnMin),
    sunrise: formatMinutesToHHMM(sunriseMin),
    solarNoon: formatMinutesToHHMM(solarNoonMin),
    sunset: formatMinutesToHHMM(sunsetMin),
    civilDusk: formatMinutesToHHMM(civilDuskMin),
    civilDawnMin,
    sunriseMin,
    sunsetMin,
    civilDuskMin,
    daylightHours,
  };
}

function parseStrictFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'boolean' || value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function dayWithRollover(baseDay: number, minutesFromDayStart: number): number {
  return baseDay + Math.max(0, Math.floor(minutesFromDayStart / 1440));
}

function estimateBaseElevation(trail: Trail): number {
  const maxAlt = Number(trail.maxAltitudeM) || 1500;
  const gain = Number(trail.elevationGainM) || 600;
  return Math.max(20, Math.round(maxAlt - Math.min(maxAlt - 20, gain * 0.85)));
}

function pickRepresentativeWaypoints(trail: Trail): {
  midAscent?: Waypoint;
  campsite?: Waypoint;
  summit?: Waypoint;
} {
  const wps = Array.isArray(trail.waypoints) ? trail.waypoints : [];
  const campsite = wps.find((w) => w.type === 'campsite');
  const summit = wps.find((w) => w.type === 'viewpoint');
  const midAscent = wps.find((w) => w.type === 'water' || w.type === 'rest' || w.type === 'danger');
  return { midAscent, campsite, summit };
}

/**
 * Deterministic AI Turnaround Time & NOAA Sunset Cutoff Pace Planner.
 * Combines Tobler + Naismith + Langmuir + pack-weight fatigue + rest cadence + exact NOAA dawn/sunset.
 * Strictly serves approved trails only.
 */
export async function computeTrailPacePlan(
  input: PacePlanInput,
  availableTrails: Trail[] = []
): Promise<PacePlanResult | null> {
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

  const trail: Trail = {
    ...(rawTrail as Trail),
    id: String(rawTrail.id || rawTrail._id || rawId),
    name: String(rawTrail.name || 'Cung đường LOST'),
    province: String(rawTrail.province || 'Việt Nam'),
    district: String(rawTrail.district || ''),
    region: rawTrail.region === 'Miền Trung' || rawTrail.region === 'Miền Nam' ? rawTrail.region : 'Miền Bắc',
    startLat: Number.isFinite(Number(rawTrail.startLat)) ? Number(rawTrail.startLat) : 21.0285,
    startLng: Number.isFinite(Number(rawTrail.startLng)) ? Number(rawTrail.startLng) : 105.8542,
    endLat: Number.isFinite(Number(rawTrail.endLat)) ? Number(rawTrail.endLat) : Number(rawTrail.startLat) || 21.0285,
    endLng: Number.isFinite(Number(rawTrail.endLng)) ? Number(rawTrail.endLng) : Number(rawTrail.startLng) || 105.8542,
    maxAltitudeM: Number.isFinite(Number(rawTrail.maxAltitudeM)) ? Number(rawTrail.maxAltitudeM) : 1500,
    distanceKm: Number.isFinite(Number(rawTrail.distanceKm)) ? Number(rawTrail.distanceKm) : 12,
    elevationGainM: Number.isFinite(Number(rawTrail.elevationGainM)) ? Number(rawTrail.elevationGainM) : 600,
    durationDays:
      Number.isFinite(Number(rawTrail.durationDays)) && Number(rawTrail.durationDays) >= 1
        ? Math.round(Number(rawTrail.durationDays))
        : 1,
    difficultyLevel: Number.isFinite(Number(rawTrail.difficultyLevel)) ? Number(rawTrail.difficultyLevel) : 3,
    waypoints: Array.isArray(rawTrail.waypoints) ? rawTrail.waypoints : [],
  };

  const departureDate =
    input.departureDate && isValidCalendarDateIso(input.departureDate)
      ? input.departureDate
      : getVietnamTodayIso();

  const defaultStartTime = trail.durationDays <= 1 && trail.distanceKm >= 13 ? '05:30' : '06:00';
  const startTime = isValidTimeHHMM(input.startTime) ? input.startTime.trim() : defaultStartTime;
  const startMin = parseTimeToMinutes(startTime);

  const fitnessLevel: AiFitnessLevel =
    input.fitnessLevel === 'beginner' || input.fitnessLevel === 'advanced'
      ? input.fitnessLevel
      : 'intermediate';
  const rawBodyKg = parseStrictFiniteNumber(input.bodyWeightKg);
  const bodyWeightKg = Math.max(35, Math.min(160, Math.round(rawBodyKg ?? 62)));
  const defaultPack = trail.durationDays >= 2 ? 9 : 5;
  const rawPackKg = parseStrictFiniteNumber(input.packWeightKg);
  const packWeightKg = Math.max(0, Math.min(40, Math.round((rawPackKg ?? defaultPack) * 10) / 10));

  const rawRestMin = parseStrictFiniteNumber(input.restMinutesPerHour);
  const restMinutesPerHour = Math.max(0, Math.min(30, Math.round(rawRestMin ?? 10)));
  const rawSummitStay = parseStrictFiniteNumber(input.summitStayMinutes);
  const summitStayMinutes = Math.max(0, Math.min(180, Math.round(rawSummitStay ?? 30)));

  // 1. Exact NOAA Solar Times at Summit coordinates [endLat, endLng]
  const solar = computeNoaaSolarTimesVietnam(trail.endLat, trail.endLng, departureDate);

  // 2. Bio-calibrated Tobler/Naismith moving time with explicit pack-weight penalty
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
    durationDays: trail.durationDays,
  });

  const packRatioPct = (packWeightKg / bodyWeightKg) * 100;
  const packPenaltyPercent = packRatioPct > 15 ? Math.round((packRatioPct - 15) * 1.5 * 10) / 10 : 0;

  // Ascent takes ~58% of moving hours; technical descent takes ~42%
  const totalMovingMin = Math.max(45, Math.round(bio.recommendedMovingHours * 60));
  const ascentMovingMin = Math.round(totalMovingMin * 0.58);
  const descentMovingMin = Math.max(25, totalMovingMin - ascentMovingMin);

  const restMultUp = 1 + restMinutesPerHour / 60;
  const restMultDown = 1 + (restMinutesPerHour * 0.7) / 60;

  const ascentTotalMin = Math.round(ascentMovingMin * restMultUp);
  const descentTotalMin = Math.round(descentMovingMin * restMultDown);
  const totalRestMin = Math.max(0, ascentTotalMin - ascentMovingMin + (descentTotalMin - descentMovingMin) + summitStayMinutes);
  const totalElapsedMin = ascentTotalMin + summitStayMinutes + descentTotalMin;

  const baseAlt = estimateBaseElevation(trail);
  const { midAscent, campsite, summit } = pickRepresentativeWaypoints(trail);
  const summitLabel = summit?.name || `Đỉnh ${trail.name}`;
  const halfKm = Math.round((trail.distanceKm / 2) * 10) / 10;

  const checkpoints: PacePlanCheckpoint[] = [];
  let summitEtaMin: number;
  let finishEtaMin: number;
  let finishDay: number;
  let safeTurnaroundMin: number;
  let recommendedStartMin: number;
  let daylightMarginMinutes: number;
  let headlampRequired: boolean;
  let governingMarginLeg = 'về đích cửa rừng';
  let isStartPastCutoff = false;

  if (trail.durationDays <= 1) {
    // 1-Day Out-and-Back / Loop Push
    const cp1Min = startMin + Math.round(ascentTotalMin * 0.48);
    summitEtaMin = startMin + ascentTotalMin;
    const departSummitMin = summitEtaMin + summitStayMinutes;
    const cpDownMin = departSummitMin + Math.round(descentTotalMin * 0.5);
    finishEtaMin = departSummitMin + descentTotalMin;
    finishDay = dayWithRollover(1, finishEtaMin);

    // True Safe Turnaround Cutoff = finish 30m BEFORE sunset (NEVER clamp forward past sunset!)
    const rawSafeTurnaroundMin = solar.sunsetMin - 30 - descentTotalMin;
    safeTurnaroundMin = Math.max(solar.civilDawnMin, Math.min(solar.sunsetMin - 30, rawSafeTurnaroundMin));
    isStartPastCutoff = startMin >= rawSafeTurnaroundMin;
    daylightMarginMinutes = solar.sunsetMin - finishEtaMin;
    governingMarginLeg = finishDay > 1 ? `về đích (sang Ngày ${finishDay})` : 'về đích cửa rừng';
    recommendedStartMin = Math.max(
      solar.civilDawnMin - 15,
      Math.min(startMin, solar.sunsetMin - 45 - totalElapsedMin)
    );
    headlampRequired =
      startMin < solar.civilDawnMin ||
      finishEtaMin > solar.sunsetMin - 15 ||
      isStartPastCutoff;

    checkpoints.push(
      {
        day: dayWithRollover(1, startMin),
        etaTime: formatMinutesToHHMM(startMin),
        etaMinutesFromMidnight: startMin,
        label: `Xuất phát cửa rừng (${trail.district || trail.province})`,
        kind: 'start',
        cumulativeKm: 0,
        elevationM: baseAlt,
        note: isStartPastCutoff
          ? `CẢNH BÁO: Xuất phát (${startTime}) đã trễ hơn giờ quay đầu an toàn (${formatMinutesToHHMM(safeTurnaroundMin)}) — bắt buộc đèn pin hoặc dời lịch sang ${formatMinutesToHHMM(recommendedStartMin)}.`
          : startMin < solar.sunriseMin
          ? 'Xuất phát sớm trước bình minh — bật đèn pin đội đầu.'
          : 'Khởi động giãn cơ & đồng bộ GPX Offline.',
      },
      {
        day: dayWithRollover(1, cp1Min),
        etaTime: formatMinutesToHHMM(cp1Min),
        etaMinutesFromMidnight: cp1Min,
        label: midAscent?.name || 'Mốc giữa chặng leo (50% độ dốc)',
        kind: 'waypoint',
        cumulativeKm: Math.round(halfKm * 0.5 * 10) / 10,
        elevationM: midAscent?.elevationM || Math.round((baseAlt + trail.maxAltitudeM) * 0.52),
        note: `Nghỉ ngắn ${restMinutesPerHour} phút/giờ, nhấp nước điện giải Oresol.`,
      },
      {
        day: dayWithRollover(1, summitEtaMin),
        etaTime: formatMinutesToHHMM(summitEtaMin),
        etaMinutesFromMidnight: summitEtaMin,
        label: summitLabel,
        kind: 'summit',
        cumulativeKm: halfKm,
        elevationM: trail.maxAltitudeM,
        note: `Nghỉ đỉnh tối đa ${summitStayMinutes} phút. Kiểm tra gió rét & giờ quay đầu.`,
      },
      {
        day: 1,
        etaTime: formatMinutesToHHMM(safeTurnaroundMin),
        etaMinutesFromMidnight: safeTurnaroundMin,
        label: isStartPastCutoff
          ? 'GIỜ QUAY ĐẦU AN TOÀN (ĐÃ QUÁ HẠN)'
          : 'GIỜ QUAY ĐẦU AN TOÀN (CUTOFF)',
        kind: 'turnaround',
        cumulativeKm: halfKm,
        elevationM: trail.maxAltitudeM,
        note: isStartPastCutoff
          ? `CẢNH BÁO QUÁ HẠN CUTOFF: Giờ xuất phát (${startTime}) muộn hơn giờ quay đầu (${formatMinutesToHHMM(safeTurnaroundMin)}). Không thể kịp ra cửa rừng trước hoàng hôn ${solar.sunset} — khuyến nghị xuất phát lúc ${formatMinutesToHHMM(recommendedStartMin)}.`
          : `Bắt buộc quay đầu dù chưa chạm đỉnh để kịp ra cửa rừng trước hoàng hôn (${solar.sunset}) tối thiểu 30 phút.`,
      },
      {
        day: dayWithRollover(1, cpDownMin),
        etaTime: formatMinutesToHHMM(cpDownMin),
        etaMinutesFromMidnight: cpDownMin,
        label: 'Điểm kiểm soát đổ dốc (50% chặng về)',
        kind: 'waypoint',
        cumulativeKm: Math.round(trail.distanceKm * 0.75 * 10) / 10,
        elevationM: Math.round((baseAlt + trail.maxAltitudeM) * 0.45),
        note: 'Siết dây giày & dùng gậy trekking bảo vệ khớp gối.',
      },
      {
        day: finishDay,
        etaTime: formatMinutesToHHMM(finishEtaMin),
        etaMinutesFromMidnight: finishEtaMin,
        label: finishDay > 1 ? `Hoàn thành tại cửa rừng (qua nửa đêm — Ngày ${finishDay})` : 'Hoàn thành tại cửa rừng',
        kind: 'finish',
        cumulativeKm: trail.distanceKm,
        elevationM: baseAlt,
        note: daylightMarginMinutes >= 30
          ? `An toàn ánh sáng (dư ${daylightMarginMinutes} phút trước hoàng hôn ${solar.sunset}).`
          : `Sát/quá hoàng hôn (${solar.sunset}) — bắt buộc chuẩn bị đèn pin đội đầu >= 300lm.`,
      }
    );
  } else if (trail.durationDays === 2) {
    // 2N1Đ Expedition: Day 1 to Camp + Day 2 Summit Push & Full Descent
    const day1Min = Math.round(ascentTotalMin * 0.72);
    const day1CampEta = startMin + day1Min;
    const day1CampDay = dayWithRollover(1, day1CampEta);
    const campAlt = campsite?.elevationM || Math.round(baseAlt + (trail.maxAltitudeM - baseAlt) * 0.74);
    const campKm = Math.round(halfKm * 0.76 * 10) / 10;

    // Day 2 early summit push: start 90m before sunrise (04:00–05:00) to catch dawn / clouds
    const day2StartMin = Math.max(240, Math.min(300, solar.sunriseMin - 90));
    const day2SummitClimbMin = Math.max(45, ascentTotalMin - day1Min);
    summitEtaMin = day2StartMin + day2SummitClimbMin;
    const departSummitMin = summitEtaMin + summitStayMinutes;
    finishEtaMin = departSummitMin + descentTotalMin;
    finishDay = dayWithRollover(2, finishEtaMin);

    // Safe Turnaround Cutoff on Day 2 = depart summit/ridge 30m+descent before sunset (NEVER clamp past sunset!)
    const rawSafeTurnaroundMin = solar.sunsetMin - 30 - descentTotalMin;
    safeTurnaroundMin = Math.max(solar.civilDawnMin, Math.min(solar.sunsetMin - 30, rawSafeTurnaroundMin));
    isStartPastCutoff = day2StartMin >= rawSafeTurnaroundMin;

    const day1Margin = solar.sunsetMin - day1CampEta;
    const dayFinalMargin = solar.sunsetMin - finishEtaMin;
    if (day1Margin <= dayFinalMargin) {
      daylightMarginMinutes = day1Margin;
      governingMarginLeg = day1CampDay > 1 ? `Ngày 1 tới lán (qua nửa đêm — N${day1CampDay})` : 'Ngày 1 tới lán';
    } else {
      daylightMarginMinutes = dayFinalMargin;
      governingMarginLeg = finishDay > 2 ? `Ngày 2 về đích (qua nửa đêm — N${finishDay})` : 'Ngày 2 về đích';
    }

    recommendedStartMin = Math.max(
      solar.civilDawnMin,
      Math.min(startMin, solar.sunsetMin - 60 - day1Min)
    );
    headlampRequired = true;

    const day1LunchEta = startMin + Math.round(day1Min * 0.5);

    checkpoints.push(
      {
        day: dayWithRollover(1, startMin),
        etaTime: formatMinutesToHHMM(startMin),
        etaMinutesFromMidnight: startMin,
        label: `Ngày 1 — Xuất phát cửa rừng (${trail.district || trail.province})`,
        kind: 'start',
        cumulativeKm: 0,
        elevationM: baseAlt,
        note: `Balo ${packWeightKg}kg (${Math.round(packRatioPct)}% thể trọng). Khai báo kiểm lâm trước khi vào rừng.`,
      },
      {
        day: dayWithRollover(1, day1LunchEta),
        etaTime: formatMinutesToHHMM(day1LunchEta),
        etaMinutesFromMidnight: day1LunchEta,
        label: midAscent?.name || 'Điểm nghỉ trưa & bổ sung điện giải',
        kind: 'waypoint',
        cumulativeKm: Math.round(campKm * 0.5 * 10) / 10,
        elevationM: midAscent?.elevationM || Math.round((baseAlt + campAlt) * 0.5),
        note: 'Ăn trưa nhẹ giàu tinh bột, lọc nước suối nếu tuyến có nước.',
      },
      {
        day: day1CampDay,
        etaTime: formatMinutesToHHMM(day1CampEta),
        etaMinutesFromMidnight: day1CampEta,
        label: campsite?.name || `Lán nghỉ đêm / Bãi trại (~${campAlt.toLocaleString()}m)`,
        kind: 'camp',
        cumulativeKm: campKm,
        elevationM: campAlt,
        note: day1Margin >= 30
          ? `Tới lán trước hoàng hôn ${day1Margin} phút — dư thời gian thay đồ khô & nấu ăn.`
          : `Nguy cơ tới lán sát/sau hoàng hôn (${solar.sunset}) — nên xuất phát lúc ${formatMinutesToHHMM(recommendedStartMin)}.`,
      },
      {
        day: dayWithRollover(2, summitEtaMin),
        etaTime: formatMinutesToHHMM(summitEtaMin),
        etaMinutesFromMidnight: summitEtaMin,
        label: `Ngày 2 — Chạm ${summitLabel} (xuất phát lán ${formatMinutesToHHMM(day2StartMin)})`,
        kind: 'summit',
        cumulativeKm: halfKm,
        elevationM: trail.maxAltitudeM,
        note: `Đón bình minh (${solar.sunrise}) & săn mây; mang balo phụ nhẹ + đèn pin đội đầu.`,
      },
      {
        day: 2,
        etaTime: formatMinutesToHHMM(safeTurnaroundMin),
        etaMinutesFromMidnight: safeTurnaroundMin,
        label: isStartPastCutoff
          ? 'GIỜ QUAY ĐẦU AN TOÀN (CẢNH BÁO CHẶNG QUÁ DÀI)'
          : 'GIỜ QUAY ĐẦU AN TOÀN (CUTOFF HẠ SƠN)',
        kind: 'turnaround',
        cumulativeKm: halfKm,
        elevationM: trail.maxAltitudeM,
        note: isStartPastCutoff
          ? `Chặng hạ sơn ước tính quá dài so với quỹ sáng 1 ngày — cân nhắc tách lịch thành 3N2Đ hoặc hạ tải balo.`
          : `Rời đỉnh chậm nhất ${formatMinutesToHHMM(safeTurnaroundMin)} để xuống cửa rừng trước hoàng hôn ${solar.sunset} tối thiểu 30 phút.`,
      },
      {
        day: finishDay,
        etaTime: formatMinutesToHHMM(finishEtaMin),
        etaMinutesFromMidnight: finishEtaMin,
        label: `Ngày ${finishDay} — Về đích cửa rừng`,
        kind: 'finish',
        cumulativeKm: trail.distanceKm,
        elevationM: baseAlt,
        note: dayFinalMargin >= 30
          ? `Hoàn tất an toàn trước hoàng hôn ${dayFinalMargin} phút.`
          : `Nguy cơ đổ dốc trong trời tối (hoàng hôn ${solar.sunset}) — rút ngắn thời gian nghỉ đỉnh.`,
      }
    );
  } else {
    // 3N2Đ+ High-Alpine Expedition (e.g. Pu Si Lung, Khang Su Văn, Pu Ta Leng 3N2Đ):
    // Day 1: Trailhead -> Base Camp | Day 2: Camp -> Summit -> Turnaround Cutoff -> Return to Camp | Day N: Camp -> Trailhead Exit
    const day1Min = Math.round(ascentTotalMin * 0.62);
    const day1CampEta = startMin + day1Min;
    const day1CampDay = dayWithRollover(1, day1CampEta);
    const campAlt = campsite?.elevationM || Math.round(baseAlt + (trail.maxAltitudeM - baseAlt) * 0.68);
    const campKm = Math.round(halfKm * 0.68 * 10) / 10;

    // Day 2 Summit Push & Return to Camp
    const day2StartMin = Math.max(240, Math.min(300, solar.sunriseMin - 90));
    const day2SummitClimbMin = Math.max(60, ascentTotalMin - day1Min);
    const campReturnDescentMin = Math.max(45, Math.round(descentTotalMin * 0.38));
    summitEtaMin = day2StartMin + day2SummitClimbMin;
    const day2ReturnCampEta = summitEtaMin + summitStayMinutes + campReturnDescentMin;
    const day2ReturnCampDay = dayWithRollover(2, day2ReturnCampEta);

    // Safe Turnaround Cutoff on Day 2 = leave summit in time to return safely to Camp 30m before sunset
    const rawSafeTurnaroundMin = solar.sunsetMin - 30 - campReturnDescentMin;
    safeTurnaroundMin = Math.max(solar.civilDawnMin, Math.min(solar.sunsetMin - 30, rawSafeTurnaroundMin));
    isStartPastCutoff = day2StartMin >= rawSafeTurnaroundMin;

    // Final Exit Day (Day N): Depart Camp after sunrise -> Descend remaining trail to Trailhead
    const exitStartMin = Math.max(360, Math.min(450, solar.sunriseMin + 30));
    const exitDescentMin = Math.max(60, descentTotalMin - campReturnDescentMin);
    finishEtaMin = exitStartMin + exitDescentMin;
    finishDay = dayWithRollover(trail.durationDays, finishEtaMin);

    const day1Margin = solar.sunsetMin - day1CampEta;
    const day2Margin = solar.sunsetMin - day2ReturnCampEta;
    const dayFinalMargin = solar.sunsetMin - finishEtaMin;

    const legMargins: Array<{ margin: number; label: string }> = [
      { margin: day1Margin, label: day1CampDay > 1 ? `Ngày 1 tới lán (qua đêm — N${day1CampDay})` : 'Ngày 1 tới lán' },
      { margin: day2Margin, label: day2ReturnCampDay > 2 ? `Ngày 2 về lán (qua đêm — N${day2ReturnCampDay})` : 'Ngày 2 về lán' },
      { margin: dayFinalMargin, label: `Ngày ${finishDay} về đích` },
    ];
    legMargins.sort((a, b) => a.margin - b.margin);
    daylightMarginMinutes = legMargins[0].margin;
    governingMarginLeg = legMargins[0].label;

    recommendedStartMin = Math.max(
      solar.civilDawnMin,
      Math.min(startMin, solar.sunsetMin - 60 - day1Min)
    );
    headlampRequired = true;

    const day1LunchEta = startMin + Math.round(day1Min * 0.5);

    checkpoints.push(
      {
        day: dayWithRollover(1, startMin),
        etaTime: formatMinutesToHHMM(startMin),
        etaMinutesFromMidnight: startMin,
        label: `Ngày 1 — Xuất phát cửa rừng (${trail.district || trail.province})`,
        kind: 'start',
        cumulativeKm: 0,
        elevationM: baseAlt,
        note: `Balo ${packWeightKg}kg (${Math.round(packRatioPct)}% thể trọng). Khai báo kiểm lâm / đồn biên phòng nếu có.`,
      },
      {
        day: dayWithRollover(1, day1LunchEta),
        etaTime: formatMinutesToHHMM(day1LunchEta),
        etaMinutesFromMidnight: day1LunchEta,
        label: midAscent?.name || 'Điểm nghỉ trưa Ngày 1 & bổ sung điện giải',
        kind: 'waypoint',
        cumulativeKm: Math.round(campKm * 0.5 * 10) / 10,
        elevationM: midAscent?.elevationM || Math.round((baseAlt + campAlt) * 0.5),
        note: 'Ăn trưa nhẹ giàu tinh bột, kiểm tra lượng nước trước chặng dốc lên lán.',
      },
      {
        day: day1CampDay,
        etaTime: formatMinutesToHHMM(day1CampEta),
        etaMinutesFromMidnight: day1CampEta,
        label: campsite?.name || `Lán nghỉ đêm 1 / Bãi trại (~${campAlt.toLocaleString()}m)`,
        kind: 'camp',
        cumulativeKm: campKm,
        elevationM: campAlt,
        note: day1Margin >= 30
          ? `Tới lán trước hoàng hôn ${day1Margin} phút — ổn định trại & nghỉ sớm.`
          : `Nguy cơ tới lán sát/sau hoàng hôn (${solar.sunset}) — nên xuất phát lúc ${formatMinutesToHHMM(recommendedStartMin)}.`,
      },
      {
        day: dayWithRollover(2, summitEtaMin),
        etaTime: formatMinutesToHHMM(summitEtaMin),
        etaMinutesFromMidnight: summitEtaMin,
        label: `Ngày 2 — Chạm ${summitLabel} (rời lán ${formatMinutesToHHMM(day2StartMin)})`,
        kind: 'summit',
        cumulativeKm: halfKm,
        elevationM: trail.maxAltitudeM,
        note: `Ngày săn đỉnh nhẹ balo (~3–4kg); mang đèn pin đội đầu & áo giữ nhiệt.`,
      },
      {
        day: 2,
        etaTime: formatMinutesToHHMM(safeTurnaroundMin),
        etaMinutesFromMidnight: safeTurnaroundMin,
        label: isStartPastCutoff
          ? 'GIỜ QUAY ĐẦU VỀ LÁN (CẢNH BÁO CHẶNG QUÁ DÀI)'
          : 'GIỜ QUAY ĐẦU AN TOÀN NGÀY 2 (CUTOFF VỀ LÁN)',
        kind: 'turnaround',
        cumulativeKm: halfKm,
        elevationM: trail.maxAltitudeM,
        note: isStartPastCutoff
          ? `Chặng săn đỉnh quá dài so với quỹ sáng — bắt buộc xuất phát sớm trước hừng đông hoặc cắt ngắn chặng.`
          : `Rời đỉnh chậm nhất ${formatMinutesToHHMM(safeTurnaroundMin)} để kịp về lán nghỉ đêm 2 trước hoàng hôn ${solar.sunset} tối thiểu 30 phút.`,
      },
      {
        day: day2ReturnCampDay,
        etaTime: formatMinutesToHHMM(day2ReturnCampEta),
        etaMinutesFromMidnight: day2ReturnCampEta,
        label: `Ngày ${day2ReturnCampDay} — Trở về lán nghỉ đêm 2`,
        kind: 'camp',
        cumulativeKm: Math.round((halfKm + (halfKm - campKm)) * 10) / 10,
        elevationM: campAlt,
        note: day2Margin >= 30
          ? `Về lán trước hoàng hôn ${day2Margin} phút — hồi phục thể lực cho ngày hạ sơn.`
          : `Nguy cơ về lán sát/sau hoàng hôn (${solar.sunset}) — cần rút ngắn thời gian chụp ảnh trên đỉnh.`,
      },
      {
        day: finishDay,
        etaTime: formatMinutesToHHMM(finishEtaMin),
        etaMinutesFromMidnight: finishEtaMin,
        label: `Ngày ${finishDay} — Hạ sơn về đích cửa rừng (rời lán ${formatMinutesToHHMM(exitStartMin)})`,
        kind: 'finish',
        cumulativeKm: trail.distanceKm,
        elevationM: baseAlt,
        note: dayFinalMargin >= 30
          ? `Hạ sơn hoàn tất an toàn trước hoàng hôn ${dayFinalMargin} phút.`
          : `Nguy cơ hạ sơn trong trời tối (hoàng hôn ${solar.sunset}) — rời lán sớm hơn lúc ${formatMinutesToHHMM(Math.max(300, exitStartMin - 60))}.`,
      }
    );
  }

  const afterDarkRisk: PacePlanResult['pacing']['afterDarkRisk'] =
    isStartPastCutoff
      ? 'dark_descent'
      : daylightMarginMinutes >= 30
      ? 'safe'
      : daylightMarginMinutes >= -(solar.civilDuskMin - solar.sunsetMin)
      ? 'tight'
      : 'dark_descent';

  const riskSummary = isStartPastCutoff
    ? `CẢNH BÁO QUÁ HẠN CUTOFF (${governingMarginLeg}): Giờ xuất phát dự kiến đã trễ hơn giờ quay đầu an toàn (${formatMinutesToHHMM(safeTurnaroundMin)})! Dự kiến muộn hơn hoàng hôn ${Math.abs(daylightMarginMinutes)} phút — khuyến nghị dời xuất phát lên ${formatMinutesToHHMM(recommendedStartMin)}.`
    : afterDarkRisk === 'safe'
    ? `An toàn ánh sáng (${governingMarginLeg}): hoàn tất trước hoàng hôn (${solar.sunset}) dư ${daylightMarginMinutes} phút.`
    : afterDarkRisk === 'tight'
    ? `Sát giờ hoàng hôn ở chặng ${governingMarginLeg} (${solar.sunset}): biên độ ánh sáng hẹp (${daylightMarginMinutes >= 0 ? `+${daylightMarginMinutes}` : daylightMarginMinutes} phút). Bắt buộc mang đèn pin đội đầu và tuân thủ giờ quay đầu ${formatMinutesToHHMM(safeTurnaroundMin)}.`
    : `CẢNH BÁO ĐỔ DỐC TRONG BÓNG TỐI (${governingMarginLeg}): dự kiến muộn hơn hoàng hôn ${Math.abs(daylightMarginMinutes)} phút! Khuyến nghị dời giờ xuất phát lên ${formatMinutesToHHMM(recommendedStartMin)} hoặc giảm trọng lượng balo.`;

  const tacticalNotes: string[] = [
    `Mặt trời tại đỉnh ${trail.name} ngày ${departureDate} (NOAA UTC+7): Hừng đông ${solar.civilDawn} · Bình minh ${solar.sunrise} · Hoàng hôn ${solar.sunset} · Chạng vạng tắt sáng ${solar.civilDusk} (${solar.daylightHours}h ban ngày).`,
    `Quy tắc giờ quay đầu (Turnaround Cutoff): Chậm nhất ${formatMinutesToHHMM(safeTurnaroundMin)} phải bắt đầu hạ sơn để đảm bảo dư tối thiểu 30 phút ánh sáng trước hoàng hôn.`,
  ];

  if (packPenaltyPercent > 0) {
    tacticalNotes.push(
      `Balo ${packWeightKg} kg chiếm ${Math.round(packRatioPct)}% thể trọng — làm chậm tốc độ ước tính khoảng +${packPenaltyPercent}%. Hạ balo xuống dưới ${Math.round(bodyWeightKg * 0.16 * 10) / 10} kg giúp rút ngắn ~${Math.max(15, Math.round((totalMovingMin * packPenaltyPercent) / 100))} phút.`
    );
  }
  if (afterDarkRisk !== 'safe') {
    tacticalNotes.push(
      `Đề xuất xuất phát lúc ${formatMinutesToHHMM(recommendedStartMin)} để tối ưu quỹ ánh sáng ban ngày và tránh xuống dốc trong sương tối.`
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
    departureDate,
    inputs: {
      startTime,
      startMinutes: startMin,
      packWeightKg,
      bodyWeightKg,
      fitnessLevel,
      restMinutesPerHour,
      summitStayMinutes,
    },
    solar,
    pacing: {
      ascentMovingHours: Math.round((ascentMovingMin / 60) * 10) / 10,
      descentMovingHours: Math.round((descentMovingMin / 60) * 10) / 10,
      totalMovingHours: Math.round((totalMovingMin / 60) * 10) / 10,
      totalRestHours: Math.round((totalRestMin / 60) * 10) / 10,
      totalElapsedHours: Math.round((totalElapsedMin / 60) * 10) / 10,
      packPenaltyPercent,
      summitEta: formatMinutesToHHMM(summitEtaMin),
      summitEtaMin,
      finishEta: formatMinutesToHHMM(finishEtaMin),
      finishEtaMin,
      finishDay,
      safeTurnaroundTime: formatMinutesToHHMM(safeTurnaroundMin),
      safeTurnaroundMin,
      recommendedStartTime: formatMinutesToHHMM(recommendedStartMin),
      daylightMarginMinutes,
      headlampRequired,
      afterDarkRisk,
      riskSummary,
    },
    checkpoints,
    tacticalNotes,
  };
}
