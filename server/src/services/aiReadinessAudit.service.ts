import { mockTrails } from '../data/seedData.js';
import { normalizeSearchText } from '../data/trekkerKnowledgeDataset.js';
import { resolveTrailByIdOrSlug } from '../utils/resolveTrail.js';
import { computeTrailGoNoGo, getVietnamTodayIso, isValidCalendarDateIso } from './goNoGo.service.js';
import { computeTrailPacePlan, isValidTimeHHMM } from './aiPacePlanner.service.js';
import { computeTrailFuelPlan } from './aiFuelPlanner.service.js';
import type {
  AiFitnessLevel,
  FuelDietType,
  GoNoGoAssessmentPayload,
  ReadinessActionFix,
  ReadinessAuditInput,
  ReadinessAuditResult,
  ReadinessPillarScore,
  ReadinessVerdict,
} from './ai.types.js';
import type { Trail } from '../types.js';

export type ReadinessAuditComputeInput = ReadinessAuditInput & {
  precomputedGoNoGo?: GoNoGoAssessmentPayload | null;
};

function parseStrictFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'boolean' || value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function diffCalendarDaysIso(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  if (![fy, fm, fd, ty, tm, td].every(Number.isFinite)) return 0;
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

const BORDER_PERMIT_TRAIL_IDS = new Set([
  'trail-pusilung',
  'trail-khangsuvan',
  'trail-phaluong',
  'trail-binhlieu',
]);

/**
 * Deterministic AI Expedition Readiness Audit (Wave 16A).
 * Combines live Go/No-Go weather/hazards + NOAA Turnaround Pace + Pandolf Nutrition/Hydration
 * + Pack-to-Body Ratio + Park/Border Permit Lead-Time into a 0-100 Pre-Flight Readiness Audit.
 * Strictly serves approved trails only; NEVER fabricates weather when MET Norway (CC BY 4.0) is unreachable.
 */
export async function computeExpeditionReadinessAudit(
  input: ReadinessAuditComputeInput,
  availableTrails: Trail[] = []
): Promise<ReadinessAuditResult | null> {
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
    permitRequired: Boolean(rawTrail.permitRequired),
    permitInfo: typeof rawTrail.permitInfo === 'string' ? rawTrail.permitInfo : '',
    waypoints: Array.isArray(rawTrail.waypoints) ? rawTrail.waypoints : [],
  };

  const todayIso = getVietnamTodayIso();
  const departureDate =
    input.departureDate && isValidCalendarDateIso(input.departureDate) && input.departureDate >= todayIso
      ? input.departureDate
      : todayIso;
  const daysUntilDeparture = Math.max(0, diffCalendarDaysIso(todayIso, departureDate));

  const fitnessLevel: AiFitnessLevel =
    input.fitnessLevel === 'beginner' || input.fitnessLevel === 'advanced'
      ? input.fitnessLevel
      : 'intermediate';
  const dietType: FuelDietType =
    input.dietType === 'vegetarian' || input.dietType === 'ultralight' ? input.dietType : 'standard';

  const rawBodyKg = parseStrictFiniteNumber(input.bodyWeightKg);
  const bodyWeightKg = Math.max(35, Math.min(160, Math.round(rawBodyKg ?? 62)));

  const defaultPack = trail.durationDays >= 2 ? 9 : 5;
  const rawPackKg = parseStrictFiniteNumber(input.packWeightKg);
  const packWeightKg = Math.max(0, Math.min(40, Math.round((rawPackKg ?? defaultPack) * 10) / 10));

  const rawGroup = parseStrictFiniteNumber(input.groupSize);
  const groupSize = Math.max(1, Math.min(20, Math.round(rawGroup ?? 2)));

  const startTime = isValidTimeHHMM(input.startTime)
    ? input.startTime.trim()
    : trail.durationDays <= 1 && trail.distanceKm >= 13
    ? '05:30'
    : '06:00';
  const hasPermitConfirmed = typeof input.hasPermitConfirmed === 'boolean' ? input.hasPermitConfirmed : false;

  // Bounded live Go/No-Go call (2.2s timeout; reuse precomputedGoNoGo when provided; never emit unhandledRejection)
  const goNoGoPromise: Promise<GoNoGoAssessmentPayload | null> =
    input.precomputedGoNoGo !== undefined
      ? Promise.resolve(input.precomputedGoNoGo)
      : (async () => {
          let timerId: ReturnType<typeof setTimeout> | null = null;
          try {
            const safeGoNoGo = computeTrailGoNoGo(trail.id, departureDate).catch(() => null);
            return await Promise.race([
              safeGoNoGo,
              new Promise<null>((resolve) => {
                timerId = setTimeout(() => resolve(null), 2200);
                timerId.unref?.();
              }),
            ]);
          } catch {
            return null;
          } finally {
            if (timerId) clearTimeout(timerId);
          }
        })();

  const [goNoGo, pacePlan] = await Promise.all([
    goNoGoPromise,
    computeTrailPacePlan(
      {
        trailId: trail.id,
        departureDate,
        startTime,
        packWeightKg,
        bodyWeightKg,
        fitnessLevel,
      },
      pool
    ),
  ]);

  if (!pacePlan) return null;

  // Feed live MET Norway (CC BY 4.0) summit temperature & humidity into Pandolf hydration/electrolyte planner (<1ms pure CPU)
  const liveWeather = goNoGo?.weatherSummary ?? null;
  const liveTempRaw = liveWeather ? (liveWeather.summitTempMaxC ?? liveWeather.tempMaxC) : undefined;
  const liveAmbientTempC =
    typeof liveTempRaw === 'number' && Number.isFinite(liveTempRaw)
      ? Math.max(-5, Math.min(45, Math.round(liveTempRaw)))
      : undefined;
  const liveHumidityPct =
    liveWeather && typeof liveWeather.humidityPercent === 'number' && Number.isFinite(liveWeather.humidityPercent)
      ? Math.max(15, Math.min(100, Math.round(liveWeather.humidityPercent)))
      : undefined;

  const fuelPlan = await computeTrailFuelPlan(
    {
      trailId: trail.id,
      bodyWeightKg,
      packWeightKg,
      fitnessLevel,
      dietType,
      ambientTempC: liveAmbientTempC,
      humidityPct: liveHumidityPct,
      groupSize,
    },
    pool
  );

  if (!fuelPlan) return null;

  const fixes: ReadinessActionFix[] = [];

  // =========================================================================
  // PILLAR 1: WEATHER & FIELD SAFETY (Weight 30%)
  // =========================================================================
  const weatherAvailable = Boolean(goNoGo && goNoGo.weatherSummary);
  let weatherScore = 65;
  let weatherStatus: ReadinessPillarScore['status'] = 'warn';
  let weatherSummary =
    'Chưa tải được dữ liệu thời tiết MET Norway (CC BY 4.0) trực tuyến — bắt buộc kiểm tra dự báo đỉnh núi & tin bão 24h trước giờ G.';

  if (goNoGo) {
    const rawGoScore = Math.max(0, Math.min(100, Math.round(goNoGo.score)));
    // Rule 11 Honesty: when live MET Norway (CC BY 4.0) weather is unavailable/out-of-range, cap weatherScore <= 72 & never show 'good'
    weatherScore = weatherAvailable ? rawGoScore : Math.min(rawGoScore, 72);
    weatherStatus =
      goNoGo.verdict === 'NO_GO'
        ? 'critical'
        : !weatherAvailable || goNoGo.verdict === 'CAUTION'
        ? 'warn'
        : 'good';

    const w = goNoGo.weatherSummary;
    const tempPart = w
      ? `${w.summitTempMinC ?? w.tempMinC}–${w.summitTempMaxC ?? w.tempMaxC}°C, mưa ${w.precipMm}mm, gió ${w.windSpeedKmH} km/h`
      : goNoGo.factors?.weatherOutOfRange
      ? 'Ngoài cửa sổ dự báo 14 ngày'
      : 'Chưa có dữ liệu khí tượng trực tiếp';
    const incPart =
      goNoGo.activeIncidentsCount > 0 ? ` · ${goNoGo.activeIncidentsCount} cảnh báo sự cố mở` : '';
    weatherSummary = `${goNoGo.verdictLabel} (${weatherScore}/100) — ${tempPart}${incPart}.`;

    if (goNoGo.verdict === 'NO_GO') {
      fixes.push({
        priority: 'critical',
        pillar: 'weatherSafety',
        title: 'Điều kiện thời tiết/hiện trường ở mức NO-GO',
        action:
          goNoGo.risks[0] ||
          `Tạm hoãn lịch khởi hành ${departureDate} cho tới khi mưa lớn, gió giật hoặc sự cố sạt lở tại ${trail.name} kết thúc.`,
      });
    } else if (goNoGo.verdict === 'CAUTION') {
      fixes.push({
        priority: 'high',
        pillar: 'weatherSafety',
        title: 'Cảnh báo thời tiết & địa hình mức Thận Trọng',
        action:
          goNoGo.risks[0] ||
          `Mang đủ áo mưa bộ, áo giữ nhiệt và theo dõi lại bảng Go/No-Go 12–24 giờ trước khi xuất phát.`,
      });
    } else if (!weatherAvailable) {
      fixes.push({
        priority: 'medium',
        pillar: 'weatherSafety',
        title: 'Cập nhật lại dự báo thời tiết gần ngày đi',
        action:
          goNoGo.factors?.forecastWindowNote ||
          'Kiểm tra lại dự báo MET Norway (CC BY 4.0) trong vòng 72 giờ trước giờ khởi hành.',
      });
    }
  } else {
    fixes.push({
      priority: 'high',
      pillar: 'weatherSafety',
      title: 'Thiếu dữ liệu thời tiết trực tuyến',
      action: 'Mở lại thẻ Go/No-Go khi có kết nối mạng để xác minh mưa, gió đỉnh và cảnh báo sạt lở.',
    });
  }

  // =========================================================================
  // PILLAR 2: DAYLIGHT & NOAA TURNAROUND PACE (Weight 25%)
  // =========================================================================
  const marginMin = pacePlan.pacing.daylightMarginMinutes;
  let paceScore: number;
  let paceStatus: ReadinessPillarScore['status'];
  if (pacePlan.pacing.afterDarkRisk === 'safe') {
    paceScore = marginMin >= 60 ? 96 : 86;
    paceStatus = 'good';
  } else if (pacePlan.pacing.afterDarkRisk === 'tight') {
    paceScore = 64;
    paceStatus = 'warn';
    fixes.push({
      priority: 'high',
      pillar: 'daylightPace',
      title: 'Quỹ ánh sáng hoàng hôn sát ngưỡng an toàn',
      action: `Dời giờ xuất phát lên ${pacePlan.pacing.recommendedStartTime}, mang đèn pin đội đầu >= 300lm và tuân thủ giờ quay đầu bắt buộc ${pacePlan.pacing.safeTurnaroundTime} (hoàng hôn ${pacePlan.solar.sunset}).`,
    });
  } else {
    paceScore = Math.max(20, 44 - Math.min(24, Math.round(Math.abs(marginMin) / 15)));
    paceStatus = 'critical';
    fixes.push({
      priority: 'critical',
      pillar: 'daylightPace',
      title: 'Nguy cơ đổ dốc trong bóng tối sau hoàng hôn',
      action: `Xuất phát lúc ${pacePlan.inputs.startTime} dự kiến muộn hơn hoàng hôn (${pacePlan.solar.sunset}) ${Math.abs(marginMin)} phút. Dời giờ xuất phát lên ${pacePlan.pacing.recommendedStartTime} và bám sát giờ quay đầu ${pacePlan.pacing.safeTurnaroundTime}.`,
    });
  }
  const paceSummary = `Hoàng hôn NOAA ${pacePlan.solar.sunset} · Quay đầu an toàn ${pacePlan.pacing.safeTurnaroundTime} · Đệm sáng ${marginMin >= 0 ? `+${marginMin}` : marginMin} phút.`;

  // =========================================================================
  // PILLAR 3: PACK LOAD & FITNESS READINESS (Weight 25%)
  // =========================================================================
  const packRatioPercent = Math.round((packWeightKg / bodyWeightKg) * 1000) / 10;
  let loadFitnessScore = 100;

  if (packRatioPercent > 25) {
    loadFitnessScore -= 38;
    fixes.push({
      priority: 'critical',
      pillar: 'loadFitness',
      title: `Balo quá tải nghiêm trọng (${packRatioPercent}% thể trọng)`,
      action: `Hạ tải balo từ ${packWeightKg}kg xuống dưới ${Math.round(bodyWeightKg * 0.18 * 10) / 10}kg (<= 18% thể trọng) bằng cách chia đồ chung với đoàn hoặc thuê porter bản địa.`,
    });
  } else if (packRatioPercent > 20) {
    loadFitnessScore -= 24;
    fixes.push({
      priority: 'high',
      pillar: 'loadFitness',
      title: `Tải balo vượt ngưỡng khuyến nghị (${packRatioPercent}% thể trọng)`,
      action: `Cắt giảm ~${Math.round((packWeightKg - bodyWeightKg * 0.18) * 10) / 10}kg trang bị thừa để giảm áp lực khớp gối khi đổ dốc (+${pacePlan.pacing.packPenaltyPercent}% chậm pace).`,
    });
  } else if (packRatioPercent > 16) {
    loadFitnessScore -= 10;
  }

  if (fitnessLevel === 'beginner' && trail.difficultyLevel >= 5) {
    loadFitnessScore -= 40;
    fixes.push({
      priority: 'critical',
      pillar: 'loadFitness',
      title: 'Độ khó Cấp 5/5 vượt quá mức thể lực Người mới',
      action: `Nên tập lũy tiến 6–8 tuần và chinh phục trước các cung cấp 2–3 (như Ba Vì, Lảo Thẩn, Tà Xùa) hoặc đi cùng đoàn có hướng dẫn viên/porter kèm 1-1.`,
    });
  } else if (fitnessLevel === 'beginner' && trail.difficultyLevel === 4) {
    loadFitnessScore -= 24;
    fixes.push({
      priority: 'high',
      pillar: 'loadFitness',
      title: 'Cung Cấp 4/5 đòi hỏi nền thể lực bền bỉ',
      action: `Tăng cường bài tập leo cầu thang đeo balo 8–10kg tối thiểu 3–4 tuần trước chuyến đi và sử dụng gậy trekking bảo vệ gối.`,
    });
  } else if (fitnessLevel === 'beginner' && trail.difficultyLevel === 3 && trail.maxAltitudeM >= 2500) {
    loadFitnessScore -= 12;
  } else if (fitnessLevel === 'intermediate' && trail.difficultyLevel >= 5) {
    loadFitnessScore -= 10;
    fixes.push({
      priority: 'medium',
      pillar: 'loadFitness',
      title: 'Kiểm tra sức bền & kỹ năng di chuyển đỉnh cấp 5/5',
      action: 'Chú ý nhịp tim, bổ sung điện giải sớm và mang đầy đủ găng tay bám đá, xà cạp, gậy trekking.',
    });
  }

  loadFitnessScore = Math.max(15, Math.min(100, loadFitnessScore));
  const loadFitnessStatus: ReadinessPillarScore['status'] =
    loadFitnessScore >= 75 ? 'good' : loadFitnessScore >= 50 ? 'warn' : 'critical';
  const fitnessLabel =
    fitnessLevel === 'beginner' ? 'Người mới' : fitnessLevel === 'advanced' ? 'Kinh nghiệm' : 'Trung bình';
  const loadFitnessSummary = `Balo ${packWeightKg}kg (${packRatioPercent}% / ${bodyWeightKg}kg) · Thể lực ${fitnessLabel} cho cung Cấp ${trail.difficultyLevel}/5 (${trail.distanceKm}km, +${trail.elevationGainM.toLocaleString('vi-VN')}m).`;

  // =========================================================================
  // PILLAR 4: HYDRATION, PERMIT LEAD-TIME & SQUAD SAFETY (Weight 20%)
  // =========================================================================
  const isBorderPermit =
    BORDER_PERMIT_TRAIL_IDS.has(trail.id) ||
    /biên phòng|biên giới|đồn bp/i.test(trail.permitInfo || '');
  const recommendedPermitLeadDays = isBorderPermit ? 5 : trail.permitRequired ? 2 : 0;

  let hydrationPermitScore = 100;

  if (isBorderPermit && !hasPermitConfirmed) {
    if (daysUntilDeparture < 3) {
      hydrationPermitScore -= 45;
      fixes.push({
        priority: 'critical',
        pillar: 'hydrationPermit',
        title: 'Chưa xác nhận giấy phép biên giới sát ngày khởi hành',
        action: `Tuyến biên giới (${trail.name}) cần nộp hồ sơ Đồn Biên phòng / Công an xã trước tối thiểu 5 ngày (hiện còn ${Math.max(0, daysUntilDeparture)} ngày). Liên hệ ngay đơn vị quản lý trước khi di chuyển.`,
      });
    } else if (daysUntilDeparture < 7) {
      hydrationPermitScore -= 22;
      fixes.push({
        priority: 'high',
        pillar: 'hydrationPermit',
        title: 'Hoàn tất thủ tục giấy phép biên giới sớm',
        action: `Chuẩn bị CCCD gốc và đăng ký trước với Đồn Biên phòng / Kiểm lâm địa phương (${trail.permitInfo || 'yêu cầu giấy phép biên giới'}).`,
      });
    } else {
      hydrationPermitScore -= 8;
    }
  } else if (trail.permitRequired && !hasPermitConfirmed) {
    if (daysUntilDeparture < 1) {
      hydrationPermitScore -= 25;
      fixes.push({
        priority: 'high',
        pillar: 'hydrationPermit',
        title: 'Chưa đăng ký trước với BQL VQG / Kiểm lâm',
        action: `Liên hệ ngay BQL VQG/Kiểm lâm (${trail.rescueContact?.phone || '112'}) để đăng ký danh sách đoàn, mua vé rừng và khai báo hành trình trước khi vào cửa rừng.`,
      });
    } else if (daysUntilDeparture < 2) {
      hydrationPermitScore -= 12;
      fixes.push({
        priority: 'medium',
        pillar: 'hydrationPermit',
        title: 'Đăng ký danh sách đoàn với VQG/Kiểm lâm',
        action: `Hoàn tất khai báo danh sách thành viên & kiểm tra giờ mở cửa trạm kiểm lâm ít nhất 24–48 giờ trước chuyến đi.`,
      });
    }
  }

  if (!trail.hasWaterSource) {
    if (trail.durationDays >= 2) {
      hydrationPermitScore -= 18;
      fixes.push({
        priority: 'high',
        pillar: 'hydrationPermit',
        title: `Tuyến khô ${trail.durationDays} ngày cần phương án tiếp nước`,
        action: `Nhu cầu ${fuelPlan.hydration.carryWaterPerLegLiters}L/ngày (tổng ${fuelPlan.hydration.waterLitersTotal}L + ${fuelPlan.hydration.oresolPacketsTotal} gói Oresol). Bố trí porter/xuồng gửi nước cho Ngày 2+.`,
      });
    } else if (fuelPlan.hydration.carryWaterPerLegLiters >= 4) {
      hydrationPermitScore -= 10;
      fixes.push({
        priority: 'medium',
        pillar: 'hydrationPermit',
        title: `Mang đủ ${fuelPlan.hydration.carryWaterPerLegLiters}L nước trên tuyến khô`,
        action: `Chuẩn bị túi nước/bình cứng đủ ${fuelPlan.hydration.carryWaterPerLegLiters}L + ${fuelPlan.hydration.oresolPacketsTotal} gói Oresol ngay từ điểm xuất phát.`,
      });
    }
  }

  if (groupSize === 1 && (trail.difficultyLevel >= 4 || trail.maxAltitudeM >= 2800)) {
    hydrationPermitScore -= 14;
    fixes.push({
      priority: 'high',
      pillar: 'hydrationPermit',
      title: 'Không khuyến nghị đi một mình (Solo) trên đỉnh khó',
      action: `Cung ${trail.name} (Cấp ${trail.difficultyLevel}/5, ${trail.maxAltitudeM.toLocaleString('vi-VN')}m) nên có tối thiểu 2–3 người hoặc thuê porter bản địa, đồng thời bật Live Beacon báo vị trí cho người thân.`,
    });
  }

  hydrationPermitScore = Math.max(15, Math.min(100, hydrationPermitScore));
  const hydrationPermitStatus: ReadinessPillarScore['status'] =
    hydrationPermitScore >= 75 ? 'good' : hydrationPermitScore >= 50 ? 'warn' : 'critical';

  const safeDaysLeft = Math.max(0, daysUntilDeparture);
  const permitText = isBorderPermit
    ? hasPermitConfirmed
      ? 'Đã xác nhận phép biên giới'
      : `Cần phép biên giới (còn ${safeDaysLeft} ngày)`
    : trail.permitRequired
    ? hasPermitConfirmed
      ? 'Đã xác nhận phép VQG'
      : `Cần khai báo VQG (còn ${safeDaysLeft} ngày)`
    : 'Không cần giấy phép trước (mang CCCD)';
  const hydrationPermitSummary = `Nước ${fuelPlan.hydration.carryWaterPerLegLiters}L/${trail.hasWaterSource ? 'chặng' : 'ngày'} + ${fuelPlan.hydration.oresolPacketsTotal} Oresol · ${permitText}.`;

  // =========================================================================
  // COMPOSITE SCORE & HARD SAFETY OVERRIDES
  // =========================================================================
  let readinessScore = Math.round(
    weatherScore * 0.3 + paceScore * 0.25 + loadFitnessScore * 0.25 + hydrationPermitScore * 0.2
  );
  readinessScore = Math.max(0, Math.min(100, readinessScore));

  const minPillar = Math.min(weatherScore, paceScore, loadFitnessScore, hydrationPermitScore);
  const criticalFixesCount = fixes.filter((f) => f.priority === 'critical').length;
  let verdict: ReadinessVerdict;

  if (goNoGo?.verdict === 'NO_GO' || criticalFixesCount >= 2 || minPillar < 30) {
    readinessScore = Math.min(readinessScore, 44);
    verdict = 'HOLD_OFF';
  } else if (minPillar < 45 || criticalFixesCount === 1) {
    readinessScore = Math.min(readinessScore, 59);
    verdict = readinessScore < 45 ? 'HOLD_OFF' : 'ADJUST_BEFORE_GO';
  } else if (!weatherAvailable) {
    // Rule 11 Safety-First: NEVER grant READY when live MET Norway (CC BY 4.0) weather / Go-No-Go verification is absent
    const unverifiedCap = !goNoGo ? 74 : 77;
    readinessScore = Math.min(readinessScore, unverifiedCap);
    verdict = readinessScore >= 50 ? 'ADJUST_BEFORE_GO' : 'HOLD_OFF';
  } else if (readinessScore >= 78 && minPillar >= 60) {
    verdict = 'READY';
  } else if (readinessScore >= 50) {
    verdict = 'ADJUST_BEFORE_GO';
  } else {
    verdict = 'HOLD_OFF';
  }

  const verdictLabel =
    verdict === 'READY'
      ? 'Sẵn Sàng Xuất Phát'
      : verdict === 'ADJUST_BEFORE_GO'
      ? 'Cần Điều Chỉnh Trước Khi Đi'
      : 'Tạm Hoãn / Chưa Đủ Điều Kiện';

  const priorityRank: Record<ReadinessActionFix['priority'], number> = {
    critical: 0,
    high: 1,
    medium: 2,
  };
  fixes.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

  if (fixes.length === 0) {
    fixes.push({
      priority: 'medium',
      pillar: 'weatherSafety',
      title: 'Duy trì kỷ luật an toàn thực địa trước giờ G',
      action: `Tải bản đồ GPX Offline, nạp đầy pin sạc dự phòng, lưu hotline ${trail.rescueContact?.phone || '112'} và báo người thân lịch về dự kiến (${pacePlan.pacing.finishEta} Ngày ${pacePlan.pacing.finishDay}).`,
    });
  }

  const pillars: ReadinessPillarScore[] = [
    {
      key: 'weatherSafety',
      label: 'Thời Tiết & An Toàn',
      score: weatherScore,
      weightPct: 30,
      status: weatherStatus,
      summary: weatherSummary,
    },
    {
      key: 'daylightPace',
      label: 'Ánh Sáng & Tốc Độ',
      score: paceScore,
      weightPct: 25,
      status: paceStatus,
      summary: paceSummary,
    },
    {
      key: 'loadFitness',
      label: 'Thể Lực & Tải Balo',
      score: loadFitnessScore,
      weightPct: 25,
      status: loadFitnessStatus,
      summary: loadFitnessSummary,
    },
    {
      key: 'hydrationPermit',
      label: 'Nước & Giấy Phép',
      score: hydrationPermitScore,
      weightPct: 20,
      status: hydrationPermitStatus,
      summary: hydrationPermitSummary,
    },
  ];

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
    daysUntilDeparture,
    readinessScore,
    verdict,
    verdictLabel,
    inputs: {
      startTime: pacePlan.inputs.startTime,
      bodyWeightKg,
      packWeightKg,
      packRatioPercent,
      fitnessLevel,
      dietType,
      groupSize,
      hasPermitConfirmed,
    },
    pillars,
    topFixes: fixes.slice(0, 5),
    snapshot: {
      weatherAvailable,
      goNoGoVerdict: goNoGo?.verdict || null,
      goNoGoScore: goNoGo ? Math.round(goNoGo.score) : null,
      noaaSunset: pacePlan.solar.sunset,
      safeTurnaroundTime: pacePlan.pacing.safeTurnaroundTime,
      daylightMarginMinutes: pacePlan.pacing.daylightMarginMinutes,
      waterLitersPerDay: fuelPlan.hydration.waterLitersPerDay,
      carryWaterPerLegLiters: fuelPlan.hydration.carryWaterPerLegLiters,
      oresolPacketsTotal: fuelPlan.hydration.oresolPacketsTotal,
      dailyKcal: fuelPlan.energy.dailyKcal,
      permitRequired: trail.permitRequired || isBorderPermit,
      isBorderPermit,
      recommendedPermitLeadDays,
      emergencyPhone: trail.rescueContact?.phone || '112 / 114',
    },
  };
}
