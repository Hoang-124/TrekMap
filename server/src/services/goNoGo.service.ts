import mongoose from 'mongoose';
import { IncidentModel } from '../models/Incident.js';
import { TrailConditionModel } from '../models/TrailCondition.js';
import { mockTrails, mockIncidents } from '../data/seedData.js';
import { resolveTrailByIdOrSlug } from '../utils/resolveTrail.js';
import { getLiveWeatherForecast } from './publicApis.service.js';
import { normalizeSearchText } from '../data/trekkerKnowledgeDataset.js';
import type { GoNoGoAssessmentPayload, GoNoGoFactorBreakdown } from './ai.types.js';

export type GoNoGoAssessment = GoNoGoAssessmentPayload;

/**
 * Returns today's ISO date string (YYYY-MM-DD) strictly in Vietnam local timezone (Asia/Ho_Chi_Minh, UTC+7).
 * Fixes pre-dawn 00:00–06:59 UTC-vs-VN date offset bug.
 */
export function getVietnamTodayIso(referenceDate: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(referenceDate);
  } catch {
    const vnMs = referenceDate.getTime() + 7 * 60 * 60 * 1000;
    return new Date(vnMs).toISOString().slice(0, 10);
  }
}

/**
 * Validates that a YYYY-MM-DD string represents an actual calendar date (rejects e.g. 2026-02-31).
 */
export function isValidCalendarDateIso(input?: string): boolean {
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
  const [y, m, d] = input.split('-').map(Number);
  if (y < 2020 || y > 2035 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d;
}

/**
 * Moist-adiabatic alpine temperature lapse rate (-6.5°C per 1,000m elevation gain above weather model grid cell).
 */
function adjustTempForSummit(gridTempC: number, gridElevationM: number | null, maxAltitudeM: number): number {
  if (gridElevationM === null || !Number.isFinite(gridElevationM)) return Math.round(gridTempC);
  const deltaM = Math.max(0, maxAltitudeM - gridElevationM);
  const lapseDropC = (deltaM / 1000) * 6.5;
  return Math.round(gridTempC - lapseDropC);
}

/**
 * Standard NWS/Environment Canada Wind Chill formula (valid when T <= 10°C and V >= 4.8 km/h).
 */
function computeWindChillC(tempC: number, windKmH: number): number {
  if (tempC > 10 || windKmH < 4.8) return Math.round(tempC);
  const vPow = Math.pow(windKmH, 0.16);
  return Math.round(13.12 + 0.6215 * tempC - 11.37 * vPow + 0.3965 * tempC * vPow);
}

function mapWmoConditionLabel(code: number): string {
  if (code === 0) return 'Trời quang, nắng ráo';
  if (code <= 3) return 'Có mây rải rác';
  if (code === 45 || code === 48) return 'Sương mù dày';
  if (code >= 95) return 'Mưa giông có sấm sét';
  if (code <= 81) return 'Có mưa';
  return 'Mưa lớn / thời tiết xấu';
}

interface DailyWeatherSlice {
  date: string;
  tempMinC: number;
  tempMaxC: number;
  windSpeedKmH: number;
  precipMm: number;
  humidityPercent: number;
  wmoCode: number;
  conditionLabel: string;
}

export function evaluateGoNoGo(params: {
  trailId: string;
  trailName: string;
  maxAltitudeM: number;
  difficultyLevel: number;
  durationDays?: number;
  bestMonths?: number[];
  avoidMonths?: number[];
  departureDate: string;
  weather: GoNoGoAssessmentPayload['weatherSummary'];
  multiDayWindow?: DailyWeatherSlice[];
  gridElevationM?: number | null;
  weatherOutOfRange?: boolean;
  forecastWindowNote?: string;
  activeIncidents: Array<{ severity?: string; type?: string; description?: string }>;
  recentConditions: Array<{ status: string; note: string; reportedAt: string }>;
}): GoNoGoAssessmentPayload {
  let weatherScore = 95;
  let hazardScore = 100;
  let seasonScore = 100;
  let hardNoGoTrigger = false;

  const risks: string[] = [];
  const gearAdditions: string[] = [];

  const durationDays = Math.max(1, Math.min(5, Number(params.durationDays) || 1));
  const depMonth = Number(params.departureDate.slice(5, 7)) || Number(getVietnamTodayIso().slice(5, 7));
  const gridElevationM =
    typeof params.gridElevationM === 'number' && Number.isFinite(params.gridElevationM)
      ? Math.round(params.gridElevationM)
      : null;

  let summitTempMinC: number | null = null;
  let summitTempMaxC: number | null = null;
  let windChillC: number | null = null;
  let seaOfCloudsIndex: number | null = null;

  // 1. Seasonal assessment (avoidMonths / bestMonths)
  if (Array.isArray(params.avoidMonths) && params.avoidMonths.includes(depMonth)) {
    seasonScore -= 35;
    risks.push(
      `Tháng ${depMonth} nằm trong mùa bất lợi (mưa bão / lũ quét / trơn trượt) của cung ${params.trailName}.`
    );
    gearAdditions.push('Áo mưa bộ chống thấm 2 lớp & túi chống nước cho đồ điện tử');
  } else if (Array.isArray(params.bestMonths) && params.bestMonths.length > 0 && !params.bestMonths.includes(depMonth)) {
    seasonScore -= 10;
  }

  // 2. Live Weather + Multi-day window + Summit Lapse Rate + Wind Chill + Heatstroke + Lightning
  const windowSlices =
    Array.isArray(params.multiDayWindow) && params.multiDayWindow.length > 0
      ? params.multiDayWindow
      : params.weather
      ? [
          {
            date: params.departureDate,
            tempMinC: params.weather.tempMinC,
            tempMaxC: params.weather.tempMaxC,
            windSpeedKmH: params.weather.windSpeedKmH,
            precipMm: params.weather.precipMm,
            humidityPercent: params.weather.humidityPercent,
            wmoCode: 0,
            conditionLabel: params.weather.conditionLabel,
          },
        ]
      : [];

  if (params.weather && windowSlices.length > 0) {
    const worstPrecip = Math.max(...windowSlices.map((d) => d.precipMm));
    const worstWind = Math.max(...windowSlices.map((d) => d.windSpeedKmH));
    const lowestGridTemp = Math.min(...windowSlices.map((d) => d.tempMinC));
    const highestGridTemp = Math.max(...windowSlices.map((d) => d.tempMaxC));
    const hasThunderstorm = windowSlices.some((d) => d.wmoCode >= 95);
    const hasDenseFog = windowSlices.some((d) => d.wmoCode === 45 || d.wmoCode === 48);

    summitTempMinC = adjustTempForSummit(lowestGridTemp, gridElevationM, params.maxAltitudeM);
    summitTempMaxC = adjustTempForSummit(highestGridTemp, gridElevationM, params.maxAltitudeM);
    windChillC = computeWindChillC(summitTempMinC, worstWind);

    const hasHeavyRainOrStorm = hasThunderstorm || windowSlices.some((d) => d.wmoCode >= 61 || d.precipMm >= 10);
    const hasLightRain = windowSlices.some((d) => d.wmoCode >= 51 || d.precipMm >= 2);

    if (params.maxAltitudeM >= 1800) {
      if (hasHeavyRainOrStorm) {
        seaOfCloudsIndex = 5; // Heavy rain/storm destroys inversion cloud sea
      } else {
        const hum = params.weather.humidityPercent;
        const windFactor = worstWind <= 12 ? 1.0 : worstWind <= 22 ? 0.72 : worstWind <= 34 ? 0.38 : 0.15;
        const rainPenalty = hasLightRain ? 0.45 : 1.0;
        seaOfCloudsIndex = Math.max(5, Math.min(96, Math.round(hum * 0.96 * windFactor * rainPenalty)));
      }
    } else {
      seaOfCloudsIndex = hasHeavyRainOrStorm ? 0 : Math.round(params.weather.humidityPercent * (hasLightRain ? 0.12 : 0.3));
    }

    // Rain / flash flood risk
    if (worstPrecip >= 30) {
      weatherScore -= 45;
      risks.push(
        `Mưa rất lớn dự báo (${worstPrecip} mm trong khung ${windowSlices.length} ngày) — nguy cơ cao lũ quét, sạt lở đường mòn.`
      );
      gearAdditions.push(
        'Áo mưa bộ 2 lớp chống thấm & áo trùm balo 100%',
        'Giày đế gai sâu bám bùn + tất khô dự phòng trong túi zip'
      );
    } else if (worstPrecip >= 10) {
      weatherScore -= 20;
      risks.push(`Có mưa vừa (${worstPrecip} mm) — đường đất có thể lầy lội, vắt nhiều.`);
      gearAdditions.push('Áo mưa gọn & xà cạp chống vắt / thuốc bôi DEP');
    }

    // Thunderstorm lightning (lethal on exposed Vietnamese ridges even if rain is brief)
    if (hasThunderstorm) {
      weatherScore -= 32;
      risks.push('Dự báo có mưa giông kèm SẤM SÉT — cực kỳ nguy hiểm trên đỉnh núi và sống lưng trống trải.');
      gearAdditions.push('Áo mưa cách ẩm & tuân thủ tư thế chống sét Lightning Squat khi gặp giông');
    }

    // Wind risk
    if (worstWind >= 50) {
      weatherScore -= 35;
      risks.push(`Gió núi giật rất mạnh (${worstWind} km/h) — nguy hiểm mất thăng bằng trên sống núi hẹp.`);
      gearAdditions.push('Áo khoác cản gió chuyên dụng (Windshell) & kính chắn gió');
    } else if (worstWind >= 32) {
      weatherScore -= 14;
      risks.push(`Gió núi khá mạnh (${worstWind} km/h) tại khu vực sống lưng và đỉnh.`);
      gearAdditions.push('Áo gió giữ nhiệt & dây neo lều tăng cường');
    }

    // Dense fog / whiteout navigation risk
    if (hasDenseFog) {
      weatherScore -= 10;
      risks.push('Sương mù dày làm giảm tầm nhìn — dễ mất dấu đường mòn.');
      gearAdditions.push('Tải sẵn Gói Offline & Tracklog GPX + còi cứu hộ SOS');
    }

    // Summit cold & wind-chill hypothermia risk
    const effectiveColdC = Math.min(summitTempMinC, windChillC);
    if (effectiveColdC <= 2) {
      weatherScore -= 26;
      risks.push(
        `Đỉnh núi rất lạnh (ước tính đỉnh ${summitTempMinC}°C, cảm giác gió rét ${windChillC}°C) — nguy cơ cao hạ thân nhiệt (Hypothermia).`
      );
      gearAdditions.push(
        'Áo lông vũ siêu nhẹ + túi ngủ chịu nhiệt <= 0°C',
        'Miếng dán giữ nhiệt, mũ len bịt tai & găng tay giữ nhiệt'
      );
    } else if (effectiveColdC <= 8) {
      weatherScore -= 10;
      risks.push(`Nhiệt độ ban đêm trên cao lạnh (ước tính đỉnh ~${summitTempMinC}°C).`);
      gearAdditions.push('Áo giữ nhiệt base-layer & áo khoác nỉ/lông vũ mỏng cho ban đêm');
    }

    // Heatstroke risk (South / Central dry season)
    if (highestGridTemp >= 35) {
      weatherScore -= 16;
      risks.push(`Nắng nóng gay gắt (${highestGridTemp}°C) — nguy cơ sốc nhiệt (Heat Stroke) và mất nước nhanh.`);
      gearAdditions.push(
        'Tăng cơ số nước lên tối thiểu 3L/người + 2 gói Oresol điện giải',
        'Mũ rộng vành, khăn rằn chống nắng & xuất phát trước 05:30 sáng'
      );
    }

    // Multi-day worsening note
    if (windowSlices.length > 1) {
      const laterBadDay = windowSlices.slice(1).find((d) => d.precipMm >= 20 || d.windSpeedKmH >= 40 || d.wmoCode >= 95);
      if (laterBadDay) {
        risks.push(
          `Lưu ý lịch trình ${durationDays} ngày: Ngày ${laterBadDay.date} thời tiết chuyển xấu (${laterBadDay.conditionLabel}, mưa ${laterBadDay.precipMm} mm, gió ${laterBadDay.windSpeedKmH} km/h).`
        );
      }
    }
  } else if (params.weatherOutOfRange) {
    weatherScore -= 12;
    risks.push(
      params.forecastWindowNote ||
        `Ngày ${params.departureDate} nằm ngoài khung dự báo khí tượng 9 ngày của MET Norway — điểm số dựa trên quy luật mùa vụ và cảnh báo thực địa.`
    );
  } else {
    weatherScore -= 12;
    risks.push('Không kết nối được nguồn thời tiết trực tuyến — cần kiểm tra lại trước giờ khởi hành.');
  }

  // 3. Active Field Incidents (Critical forces guaranteed NO-GO!)
  for (const inc of params.activeIncidents) {
    const sev = String(inc.severity || 'medium').toLowerCase();
    if (sev === 'critical') {
      hazardScore -= 75;
      hardNoGoTrigger = true;
      risks.push(`Cảnh báo ĐỎ thực địa: ${inc.type || 'Sự cố nghiêm trọng'} — ${inc.description || 'Cấm di chuyển'}`);
    } else if (sev === 'high') {
      hazardScore -= 30;
      risks.push(`Cảnh báo CAO thực địa: ${inc.type || 'Sự cố'} — ${inc.description || ''}`);
    } else {
      hazardScore -= 12;
      risks.push(`Lưu ý thực địa: ${inc.type || 'Cảnh báo'} — ${inc.description || ''}`);
    }
  }

  // 4. Recent Active Trail Conditions (handles full enum: safe | caution | dangerous | closed + Vietnamese note scan)
  for (const cond of params.recentConditions.slice(0, 4)) {
    const st = normalizeSearchText(cond.status);
    const noteNorm = normalizeSearchText(cond.note);
    const combined = `${st} ${noteNorm}`;

    if (st === 'closed' || combined.includes('dong duong') || combined.includes('cam vao rung')) {
      hazardScore -= 75;
      hardNoGoTrigger = true;
      risks.push(`Tuyến đường đang báo ĐÓNG / CẤM DI CHUYỂN: ${cond.note || 'Kiểm tra thông báo BQL VQG / Kiểm lâm.'}`);
    } else if (
      st === 'dangerous' ||
      combined.includes('nguy hiem') ||
      combined.includes('sat lo') ||
      combined.includes('lu quet') ||
      combined.includes('flooded')
    ) {
      hazardScore -= 24;
      risks.push(`Báo cáo thực địa bất lợi (${cond.status}): ${cond.note || 'Đường có nguy cơ nguy hiểm.'}`);
    } else if (
      st === 'caution' ||
      combined.includes('muddy') ||
      combined.includes('lay loi') ||
      combined.includes('tron truot') ||
      combined.includes('slippery')
    ) {
      hazardScore -= 12;
      risks.push(`Lưu ý tình trạng đường (${cond.status}): ${cond.note || 'Đường ẩm trơn / cần thận trọng.'}`);
      gearAdditions.push('Gậy trekking trợ lực & xà cạp (gaiters) chống bùn vắt');
    }
  }

  // Altitude & technical difficulty baseline gear additions
  if (params.maxAltitudeM >= 2500) {
    gearAdditions.push('Đèn pin đội đầu + pin dự phòng & điện giải bù khoáng cho độ cao > 2.500m');
  }
  if (params.difficultyLevel >= 4) {
    gearAdditions.push('Gậy trekking hợp kim nhôm (1 cặp) giảm tải khớp gối khi đổ dốc');
  }

  const clampedWeather = Math.max(0, Math.min(100, Math.round(weatherScore)));
  const clampedHazard = Math.max(0, Math.min(100, Math.round(hazardScore)));
  const clampedSeason = Math.max(0, Math.min(100, Math.round(seasonScore)));

  // Weighted composite score with hard safety ceiling on critical hazards or closed trail
  const totalDeductions =
    (95 - clampedWeather) + (100 - clampedHazard) + Math.round((100 - clampedSeason) * 0.5);
  let rawScore = 95 - totalDeductions;
  if (hardNoGoTrigger) {
    rawScore = Math.min(rawScore, 25);
  }
  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  const verdict: GoNoGoAssessmentPayload['verdict'] =
    finalScore >= 72 ? 'GO' : finalScore >= 45 ? 'CAUTION' : 'NO_GO';
  const verdictLabel =
    verdict === 'GO'
      ? 'AN TOÀN XUẤT PHÁT (GO)'
      : verdict === 'CAUTION'
      ? 'THẬN TRỌNG & CHUẨN BỊ KỸ (CAUTION)'
      : 'KHUYẾN CÁO HOÃN CHUYẾN (NO-GO)';

  const advice =
    verdict === 'GO'
      ? `Điều kiện thực địa và thời tiết ngày ${params.departureDate} thuận lợi cho cung ${params.trailName}. Nên xuất phát sớm trước 06:30 sáng và luôn mang đủ nước + áo gió dự phòng.`
      : verdict === 'CAUTION'
      ? `Cung ${params.trailName} ngày ${params.departureDate} có ${risks.length} yếu tố cần lưu ý. Chỉ nên đi cùng đoàn có Porter/Leader kinh nghiệm và bổ sung đầy đủ trang bị gợi ý bên dưới.`
      : `KHÔNG KHUYẾN KHÍCH xuất phát cung ${params.trailName} vào ngày ${params.departureDate} do có cảnh báo nguy hiểm cao về thời tiết cực đoan hoặc sự cố/đóng tuyến thực địa. Hãy dời lịch và liên hệ Kiểm lâm / BQL VQG.`;

  const altitudeRiskLevel: GoNoGoFactorBreakdown['altitudeRiskLevel'] =
    params.maxAltitudeM >= 2800 ? 'high' : params.maxAltitudeM >= 2000 ? 'moderate' : 'low';

  const enrichedWeather = params.weather
    ? {
        ...params.weather,
        summitTempMinC: summitTempMinC ?? params.weather.tempMinC,
        summitTempMaxC: summitTempMaxC ?? params.weather.tempMaxC,
        windChillC: windChillC ?? params.weather.tempMinC,
        seaOfCloudsIndex: seaOfCloudsIndex ?? undefined,
      }
    : null;

  return {
    trailId: params.trailId,
    trailName: params.trailName,
    departureDate: params.departureDate,
    score: finalScore,
    verdict,
    verdictLabel,
    weatherSummary: enrichedWeather,
    factors: {
      weatherScore: clampedWeather,
      hazardScore: clampedHazard,
      seasonScore: clampedSeason,
      altitudeRiskLevel,
      summitTempMinC,
      summitTempMaxC,
      windChillC,
      seaOfCloudsIndex,
      gridElevationM,
      multiDayCheckedDays: windowSlices.length,
      weatherOutOfRange: Boolean(params.weatherOutOfRange),
      forecastWindowNote: params.forecastWindowNote,
    },
    activeIncidentsCount: params.activeIncidents.length,
    recentConditions: params.recentConditions,
    risks,
    dynamicGearAdditions: Array.from(new Set(gearAdditions)),
    advice,
  };
}

export async function computeTrailGoNoGo(
  trailIdOrSlug: string,
  departureDateInput?: string
): Promise<GoNoGoAssessmentPayload | null> {
  let trail: any = null;
  if (mongoose.connection.readyState === 1) {
    try {
      const dbTrail: any = await resolveTrailByIdOrSlug(trailIdOrSlug);
      if (dbTrail && (!dbTrail.status || dbTrail.status === 'approved')) {
        trail = dbTrail;
      }
    } catch {
      return null;
    }
  } else {
    // Strictly restrict mockTrails fallback to offline DB mode (prevents deleted/unapproved trail drift)
    trail = mockTrails.find((t) => t.id === trailIdOrSlug) || null;
  }
  if (!trail) return null;

  const todayIso = getVietnamTodayIso();
  const departureDate =
    typeof departureDateInput === 'string' && isValidCalendarDateIso(departureDateInput.trim())
      ? departureDateInput.trim()
      : todayIso;

  const durationDays = Math.max(1, Math.min(5, Number(trail.durationDays) || 1));
  const lat = Number(trail.startLat);
  const lng = Number(trail.startLng);

  let weatherSummary: GoNoGoAssessmentPayload['weatherSummary'] = null;
  let multiDayWindow: DailyWeatherSlice[] = [];
  let gridElevationM: number | null = null;
  let weatherOutOfRange = false;
  let forecastWindowNote: string | undefined;

  // Check day delta from VN today to decide if within MET Norway Locationforecast 2.0 (~9-10 day) horizon
  const msPerDay = 24 * 60 * 60 * 1000;
  const dayDelta = Math.round(
    (Date.parse(`${departureDate}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / msPerDay
  );

  if (dayDelta < 0) {
    weatherOutOfRange = true;
    forecastWindowNote = `Ngày ${departureDate} đã qua (hôm nay là ${todayIso}). Chỉ hiển thị đánh giá mùa vụ và sự cố hiện tại.`;
  } else if (dayDelta > 9) {
    weatherOutOfRange = true;
    forecastWindowNote = `Ngày ${departureDate} vượt quá khung dự báo thời tiết 9 ngày của MET Norway (từ ${todayIso}). Đánh giá dựa trên mùa vụ thực địa và sự cố hiện mở.`;
  } else {
    try {
      const live = await getLiveWeatherForecast(lat, lng);

      if (live?.daily?.time?.length) {
        const idx = live.daily.time.indexOf(departureDate);
        if (idx >= 0) {
          gridElevationM = Number.isFinite(Number(live.elevation)) ? Number(live.elevation) : null;
          const endIdx = Math.min(live.daily.time.length, idx + durationDays);
          for (let i = idx; i < endIdx; i++) {
            const code = Number(live.daily.weathercode?.[i] ?? 0);
            multiDayWindow.push({
              date: String(live.daily.time[i]),
              tempMinC: Math.round(Number(live.daily.temperature_2m_min?.[i] ?? 14)),
              tempMaxC: Math.round(Number(live.daily.temperature_2m_max?.[i] ?? 22)),
              windSpeedKmH: Math.round(Number(live.daily.windspeed_10m_max?.[i] ?? 12)),
              precipMm: Math.round(Number(live.daily.precipitation_sum?.[i] ?? 0) * 10) / 10,
              humidityPercent: Math.round(Number(live.daily.relative_humidity_2m_max?.[i] ?? 75)),
              wmoCode: code,
              conditionLabel: mapWmoConditionLabel(code),
            });
          }

          const firstDay = multiDayWindow[0];
          weatherSummary = {
            tempMinC: firstDay.tempMinC,
            tempMaxC: firstDay.tempMaxC,
            windSpeedKmH: firstDay.windSpeedKmH,
            precipMm: firstDay.precipMm,
            humidityPercent: firstDay.humidityPercent,
            conditionLabel: firstDay.conditionLabel,
            source: 'MET Norway Locationforecast 2.0 (CC BY 4.0)',
          };
        } else {
          weatherOutOfRange = true;
          forecastWindowNote = `Ngày ${departureDate} chưa có trong bảng dự báo MET Norway hiện tại.`;
        }
      }
    } catch {
      // Offline / API timeout handled honestly below
    }
  }

  let activeIncidents: Array<{ severity?: string; type?: string; description?: string }> = [];
  let recentConditions: Array<{ status: string; note: string; reportedAt: string }> = [];

  if (mongoose.connection.readyState === 1) {
    const idCandidates = Array.from(
      new Set([trail.id, trail._id, trail._id ? String(trail._id) : ''].filter(Boolean))
    );
    const now = new Date();
    const [incs, conds] = await Promise.all([
      IncidentModel.find({
        trailId: { $in: idCandidates },
        active: { $ne: false },
        resolved: { $ne: true },
      })
        .select('severity type description')
        .limit(10)
        .lean()
        .catch(() => []),
      TrailConditionModel.find({
        trailId: { $in: idCandidates },
        isActive: { $ne: false },
        expiresAt: { $gt: now },
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .catch(() => []),
    ]);
    activeIncidents = incs as any[];
    recentConditions = (conds as any[]).map((c) => ({
      status: String(c.condition || c.status || 'safe'),
      note: String(c.description || c.note || c.weatherNote || ''),
      reportedAt: c.createdAt
        ? new Date(c.createdAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        : 'Gần đây',
    }));
  } else {
    // Offline fallback: check seeded mock incidents for this trail
    activeIncidents = mockIncidents
      .filter((i) => !i.resolved && i.trailId === String(trail.id))
      .map((i) => ({ severity: i.severity, type: i.type, description: i.description }));
  }

  return evaluateGoNoGo({
    trailId: String(trail.id || trail._id),
    trailName: String(trail.name),
    maxAltitudeM: Number(trail.maxAltitudeM) || 1500,
    difficultyLevel: Number(trail.difficultyLevel) || 3,
    durationDays,
    bestMonths: Array.isArray(trail.bestMonths) ? trail.bestMonths : [],
    avoidMonths: Array.isArray(trail.avoidMonths) ? trail.avoidMonths : [],
    departureDate,
    weather: weatherSummary,
    multiDayWindow,
    gridElevationM,
    weatherOutOfRange,
    forecastWindowNote,
    activeIncidents,
    recentConditions,
  });
}
