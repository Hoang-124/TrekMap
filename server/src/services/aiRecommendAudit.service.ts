import mongoose from 'mongoose';
import { IncidentModel } from '../models/Incident.js';
import { mockTrails, mockIncidents } from '../data/seedData.js';
import { calculateHaversineDistanceKm } from '../utils/spatial.js';
import { getLiveWeatherForecast } from './publicApis.service.js';
import { getVietnamTodayIso } from './goNoGo.service.js';
import {
  normalizeSearchText,
  hasWholePhrase,
  levenshteinDistance,
  VIETNAM_PEAKS_MATRIX,
} from '../data/trekkerKnowledgeDataset.js';
import { calculateAlpineBioMetrics } from './aiBioCalculator.service.js';

function getVietnamCurrentMonth(): number {
  const m = Number(getVietnamTodayIso().split('-')[1]);
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : new Date().getMonth() + 1;
}
import type { Trail } from '../types.js';
import type {
  PackAuditInput,
  PackAuditMissingItem,
  PackAuditResult,
  TrailCompareData,
  TrailCompareInput,
  TrailCompareItem,
  TrailMatchResultItem,
  TrailRecommendInput,
  TrailRecommendResponse,
} from './ai.types.js';

const CLOUD_HUNTING_SLUGS = new Set([
  'trail-laothan',
  'trail-taxua',
  'trail-kyquansan',
  'trail-fansipan',
  'trail-tachinhu',
  'trail-lungcung',
  'trail-nguchison',
  'trail-tayconlinh',
  'trail-putaleng',
  'trail-pusilung',
]);

const WATERFALL_FOREST_SLUGS = new Set([
  'trail-giengtroi',
  'trail-bachma',
  'trail-thack50',
  'trail-nhiucosan',
  'trail-nuidinh',
  'trail-cattien-bausau',
  'trail-puluong',
  'trail-putaleng',
  'trail-bidoup',
  'trail-chuyangsin',
]);

const ARID_DRY_TRAIL_SLUGS = new Set(['trail-muidoi', 'trail-nuichua', 'trail-badenh', 'trail-chuachan', 'trail-tanangphandung']);

function mergeWithAllSeedTrails(availableTrails: Trail[]): Trail[] {
  const byId = new Map<string, Trail>();
  for (const t of mockTrails) {
    byId.set(t.id, t);
  }
  for (const t of availableTrails) {
    if (t.id) byId.set(t.id, t);
  }
  return Array.from(byId.values());
}

function estimateBudgetVnd(trail: Trail): { min: number; max: number; note: string } {
  const days = Math.max(1, Number(trail.durationDays) || 1);
  const isNorthHigh = trail.region === 'Miền Bắc' && trail.maxAltitudeM >= 2000;
  const permitFee = trail.permitRequired ? 200_000 : 50_000;

  if (days <= 1) {
    const min = 350_000 + permitFee;
    const max = 850_000 + permitFee;
    return {
      min,
      max,
      note: 'Tự túc trong ngày (xăng/xe, ăn uống, gửi xe & phí VQG nếu có)',
    };
  }

  const transport = isNorthHigh ? 650_000 : 500_000;
  const porterShare = Math.round((days * 600_000) / 3); // Shared by 3-person group
  const foodShelter = days * 350_000;
  const min = Math.round((transport + foodShelter + permitFee + porterShare * 0.7) / 50_000) * 50_000;
  const max = Math.round((transport + foodShelter * 1.35 + permitFee + porterShare * 1.4) / 50_000) * 50_000;

  return {
    min,
    max,
    note: `Dự toán ${days}N${days - 1}Đ tự túc chia nhóm 3–4 người (đã gồm Porter chung & lán ngủ)`,
  };
}

/**
 * Deterministic Weighted Matchmaker over ALL 36 verified Vietnam trails + live active Incidents.
 */
export async function recommendVietnamTrails(
  input: TrailRecommendInput,
  availableTrails: Trail[]
): Promise<TrailRecommendResponse> {
  const allTrails = mergeWithAllSeedTrails(availableTrails);
  const targetMonth = Math.max(1, Math.min(12, Math.round(Number(input.targetMonth) || getVietnamCurrentMonth())));
  const prefs = new Set(Array.isArray(input.preferences) ? input.preferences : []);

  // Load active unresolved incidents in a single bounded query (zero N+1)
  const incidentsByTrailKey = new Map<string, Array<{ severity: string; type: string; description: string }>>();
  const pushIncident = (key: string, entry: { severity: string; type: string; description: string }) => {
    const list = incidentsByTrailKey.get(key) || [];
    list.push(entry);
    incidentsByTrailKey.set(key, list);
  };

  if (mongoose.connection.readyState === 1) {
    const activeIncs = await IncidentModel.find({ active: { $ne: false }, resolved: { $ne: true } })
      .select('trailId trailName severity type description')
      .limit(50)
      .lean()
      .maxTimeMS(900)
      .catch(() => []);
    for (const inc of activeIncs as any[]) {
      const entry = {
        severity: String(inc.severity || 'medium').toLowerCase(),
        type: String(inc.type || 'other'),
        description: String(inc.description || '').slice(0, 120),
      };
      if (inc.trailId) pushIncident(String(inc.trailId), entry);
      if (inc.trailName) pushIncident(normalizeSearchText(String(inc.trailName)), entry);
    }
  } else {
    for (const inc of mockIncidents) {
      if (!inc.resolved) {
        const entry = { severity: inc.severity, type: inc.type, description: inc.description };
        pushIncident(inc.trailId, entry);
        pushIncident(normalizeSearchText(inc.trailName), entry);
      }
    }
  }

  // Strict region pool when user explicitly picks a region; fallback to full pool if empty
  let pool =
    input.region && input.region !== 'all'
      ? allTrails.filter((t) => t.region === input.region)
      : allTrails;
  if (pool.length === 0) pool = allTrails;

  const scored: TrailMatchResultItem[] = pool.map((trail) => {
    let score = 54;
    const pros: string[] = [];
    const warnings: string[] = [];

    // 1. Fitness vs Difficulty
    const diff = Number(trail.difficultyLevel) || 3;
    if (input.fitness === 'beginner') {
      if (diff <= 2) {
        score += 24;
        pros.push(`Độ khó cấp ${diff}/5 rất phù hợp cho người mới bắt đầu.`);
      } else if (diff === 3) {
        score += 10;
        pros.push('Độ khó cấp 3/5 — người mới có thể chinh phục nếu tập thể lực 2–3 tuần.');
      } else if (diff === 4) {
        score -= 18;
        warnings.push('Độ khó cấp 4/5 khá gắt với người mới, cần có Porter đi cùng.');
      } else {
        score -= 34;
        warnings.push('Độ khó cấp 5/5 vượt ngưỡng người mới — nên chinh phục cung cấp 2–3 trước.');
      }
    } else if (input.fitness === 'intermediate') {
      if (diff === 3 || diff === 4) {
        score += 20;
        pros.push(`Độ khó cấp ${diff}/5 khớp hoàn hảo với thể lực trung bình - khá.`);
      } else if (diff === 2) {
        score += 12;
        pros.push('Cung nhẹ nhàng, dễ hoàn thành trong lịch trình thoải mái.');
      } else if (diff === 5) {
        score += 4;
        warnings.push('Đỉnh cấp 5/5 đòi hỏi chuẩn bị sức bền tim mạch & vác tải trước 4 tuần.');
      }
    } else {
      // advanced
      if (diff >= 4) {
        score += 24;
        pros.push(`Thử thách địa hình cấp ${diff}/5 (${trail.maxAltitudeM.toLocaleString()}m, +${trail.elevationGainM}m).`);
      } else if (diff === 3) {
        score += 12;
      } else {
        score += 2;
      }
    }

    // 2. Duration match
    const days = Math.max(1, Number(trail.durationDays) || 1);
    if (input.durationDays !== 'any') {
      if (input.durationDays === 1) {
        if (days <= 1) {
          score += 18;
          pros.push(`Gọn trong 1 ngày (${trail.durationHoursNote}).`);
        } else {
          score -= 16;
          warnings.push(`Tuyến tiêu chuẩn cần ${days} ngày (dài hơn quỹ 1 ngày).`);
        }
      } else if (input.durationDays === 2) {
        if (days === 2) {
          score += 18;
          pros.push('Hành trình 2N1Đ vừa vặn dịp cuối tuần.');
        } else if (days === 1) {
          score += 8;
        } else {
          score -= 14;
          warnings.push(`Cần tối thiểu ${days} ngày để hoàn thành an toàn.`);
        }
      } else if (input.durationDays === 3) {
        if (days >= 3) {
          score += 20;
          pros.push(`Hành trình dài ngày ${days}N${days - 1}Đ giàu trải nghiệm.`);
        } else if (days === 2) {
          score += 8;
        } else {
          score -= 8;
        }
      }
    }

    // 3. Seasonality for targetMonth
    let seasonStatus: TrailMatchResultItem['seasonStatus'] = 'ok';
    if (Array.isArray(trail.bestMonths) && trail.bestMonths.includes(targetMonth)) {
      seasonStatus = 'ideal';
      score += 16;
      pros.push(`Tháng ${targetMonth} là mùa đẹp lý tưởng của tuyến.`);
    } else if (Array.isArray(trail.avoidMonths) && trail.avoidMonths.includes(targetMonth)) {
      seasonStatus = 'avoid';
      score -= 22;
      warnings.push(`Tháng ${targetMonth} nằm trong mùa bất lợi (mưa lớn / lũ quét / trơn trượt).`);
    }

    // 4. Multi-select Preferences
    if (prefs.has('san_may')) {
      if (CLOUD_HUNTING_SLUGS.has(trail.id) || trail.maxAltitudeM >= 2200) {
        score += 20;
        pros.push('Tọa độ săn biển mây & đón bình minh đỉnh cao.');
      } else {
        score -= 10;
      }
    }
    if (prefs.has('high_peak_2800')) {
      if (trail.maxAltitudeM >= 2800) {
        score += 22;
        pros.push(`Thuộc nhóm đại đỉnh > 2.800m (${trail.maxAltitudeM.toLocaleString()}m).`);
      } else {
        score -= 16;
      }
    }
    if (prefs.has('waterfall_forest')) {
      if (WATERFALL_FOREST_SLUGS.has(trail.id)) {
        score += 20;
        pros.push('Cảnh quan rừng nguyên sinh & suối thác đặc sắc.');
      } else if (trail.hasWaterSource) {
        score += 6;
      } else {
        score -= 8;
      }
    }
    if (prefs.has('kid_friendly')) {
      if (trail.kidFriendly) {
        score += 22;
        pros.push('Phù hợp đi cùng gia đình / trẻ nhỏ có người lớn kèm.');
      } else {
        score -= 22;
        warnings.push('Không khuyến nghị dẫn trẻ nhỏ do địa hình dốc / dài.');
      }
    }
    if (prefs.has('no_permit_needed')) {
      if (!trail.permitRequired) {
        score += 16;
        pros.push('Thủ tục đơn giản, không cần xin giấy phép phức tạp.');
      } else {
        score -= 14;
        warnings.push(`Cần làm thủ tục giấy phép trước (${trail.permitInfo || 'BQL VQG / Biên phòng'}).`);
      }
    }

    // 5. GPS Proximity bonus
    let distanceFromUserKm: number | undefined;
    if (input.userCoordinates) {
      distanceFromUserKm = Math.round(
        calculateHaversineDistanceKm(
          input.userCoordinates.lat,
          input.userCoordinates.lng,
          trail.startLat,
          trail.startLng
        )
      );
      if (distanceFromUserKm <= 100) {
        score += 14;
        pros.push(`Rất gần vị trí của bạn (~${distanceFromUserKm} km đường chim bay).`);
      } else if (distanceFromUserKm <= 250) {
        score += 7;
      }
    }

    // 6. Live Active Incidents Penalty
    const matchedIncs = [
      ...(incidentsByTrailKey.get(trail.id) || []),
      ...(incidentsByTrailKey.get(normalizeSearchText(trail.name)) || []),
    ];
    // Deduplicate by description
    const uniqueIncs = matchedIncs.filter(
      (inc, idx, arr) => arr.findIndex((x) => x.description === inc.description) === idx
    );
    for (const inc of uniqueIncs) {
      if (inc.severity === 'critical') {
        score -= 30;
        warnings.push(`CẢNH BÁO ĐỎ đang mở: ${inc.description}`);
      } else if (inc.severity === 'high') {
        score -= 15;
        warnings.push(`Cảnh báo thực địa cao: ${inc.description}`);
      } else {
        score -= 6;
        warnings.push(`Lưu ý thực địa: ${inc.description}`);
      }
    }

    if (pros.length === 0) {
      pros.push(`${trail.maxAltitudeM.toLocaleString()}m · ${trail.distanceKm} km · ${trail.province}`);
    }

    return {
      id: trail.id,
      name: trail.name,
      province: trail.province,
      district: trail.district,
      region: trail.region,
      maxAltitudeM: trail.maxAltitudeM,
      distanceKm: trail.distanceKm,
      elevationGainM: trail.elevationGainM,
      durationDays: days,
      durationHoursNote: trail.durationHoursNote,
      difficultyLevel: diff,
      difficultyNote: trail.difficultyNote || '',
      permitRequired: Boolean(trail.permitRequired),
      kidFriendly: Boolean(trail.kidFriendly),
      hasWaterSource: Boolean(trail.hasWaterSource),
      hasCampsite: Boolean(trail.hasCampsite),
      coverImage: trail.coverImage,
      bestMonths: Array.isArray(trail.bestMonths) ? trail.bestMonths : [],
      avoidMonths: Array.isArray(trail.avoidMonths) ? trail.avoidMonths : [],
      matchScore: Math.max(15, Math.min(99, Math.round(score))),
      seasonStatus,
      pros: pros.slice(0, 3),
      warnings: warnings.slice(0, 3),
      activeIncidentsCount: uniqueIncs.length,
      distanceFromUserKm,
      estimatedBudgetRangeVnd: estimateBudgetVnd(trail),
    };
  });

  scored.sort(
    (a, b) =>
      b.matchScore - a.matchScore ||
      a.activeIncidentsCount - b.activeIncidentsCount ||
      (a.distanceFromUserKm ?? 9999) - (b.distanceFromUserKm ?? 9999)
  );

  const topMatches = scored.slice(0, 5);
  const summaryNote = `Đã chấm điểm ${pool.length} cung đường thực địa Việt Nam cho tháng ${targetMonth} (trình độ ${
    input.fitness === 'beginner' ? 'Người mới' : input.fitness === 'advanced' ? 'Thể lực tốt' : 'Trung bình - Khá'
  }).`;

  return {
    matches: topMatches,
    totalEvaluated: pool.length,
    targetMonth,
    summaryNote,
  };
}

/**
 * Whole-phrase matcher over user's packed items so 'dep' never matches 'dép lê' and 'pad' never matches 'iPad'.
 */
function hasPackedItem(packedNormList: string[], aliases: string[]): boolean {
  return packedNormList.some((itemNorm) => aliases.some((alias) => hasWholePhrase(itemNorm, alias)));
}

/**
 * AI Pack & Survival Readiness Auditor for any of the 36 real Vietnam trails.
 * Evaluates against real maxAltitudeM, hasWaterSource, hasCampsite, permitRequired, difficultyLevel, and live summit min temp.
 */
export async function auditTrailPackReadiness(
  input: PackAuditInput,
  availableTrails: Trail[]
): Promise<PackAuditResult | null> {
  const allTrails = mergeWithAllSeedTrails(availableTrails);
  const trail = allTrails.find((t) => t.id === input.trailId || String((t as any)._id || '') === input.trailId);
  if (!trail) return null;

  const bodyWeightKg = Math.max(35, Math.min(160, Number(input.bodyWeightKg) || 62));
  const checkedItems = (Array.isArray(input.packedItems) ? input.packedItems : []).filter(
    (it) => it && typeof it.name === 'string' && it.name.trim() && it.checked !== false
  );
  const packedNormList = checkedItems.map((it) => normalizeSearchText(it.name));
  const summedGrams = checkedItems.reduce((sum, it) => sum + Math.max(0, Number(it.weightGrams) || 0), 0);
  const hasExplicitPackKg =
    input.packWeightKg !== undefined &&
    input.packWeightKg !== null &&
    Number.isFinite(Number(input.packWeightKg)) &&
    Number(input.packWeightKg) >= 0;
  const effectivePackKg = hasExplicitPackKg
    ? Number(input.packWeightKg)
    : checkedItems.length === 0
    ? 0
    : Math.round((summedGrams / 1000) * 10) / 10;

  // Live Open-Meteo summit min temp via -6.5°C / 1000m moist-adiabatic lapse rate
  let summitTempMinC: number | null = null;
  let weatherNote = `Ước tính nhiệt độ theo cao độ ${trail.maxAltitudeM.toLocaleString()}m.`;
  try {
    const live = await getLiveWeatherForecast(trail.startLat, trail.startLng);
    if (live?.daily?.temperature_2m_min?.length) {
      const gridMin = Number(live.daily.temperature_2m_min[0]);
      const gridEle = Number.isFinite(Number(live.elevation)) ? Number(live.elevation) : null;
      const deltaM = gridEle !== null ? Math.max(0, trail.maxAltitudeM - gridEle) : 0;
      summitTempMinC = Math.round(gridMin - (deltaM / 1000) * 6.5);
      weatherNote = `Open-Meteo trực tuyến: chân núi ${Math.round(gridMin)}°C -> đỉnh ${trail.maxAltitudeM.toLocaleString()}m ước tính ~${summitTempMinC}°C.`;
    }
  } catch {
    // Offline altitude estimate
  }
  if (summitTempMinC === null) {
    summitTempMinC = trail.maxAltitudeM >= 2800 ? 4 : trail.maxAltitudeM >= 2000 ? 10 : 18;
  }

  let score = 100;
  const criticalMissing: PackAuditMissingItem[] = [];
  const recommendedAdditions: PackAuditMissingItem[] = [];
  const weightSavingTips: string[] = [];
  const checklistHighlights: string[] = [];

  const isColdSummit = trail.maxAltitudeM >= 2200 || summitTempMinC <= 9;
  const isVeryCold = trail.maxAltitudeM >= 2700 || summitTempMinC <= 5;
  const isDryTrail = !trail.hasWaterSource || ARID_DRY_TRAIL_SLUGS.has(trail.id);
  const isMultiDay = trail.durationDays >= 2;
  const isSteep = trail.difficultyLevel >= 4;

  // 1. Footwear
  if (!hasPackedItem(packedNormList, ['giay', 'boot', 'vibram'])) {
    score -= 16;
    criticalMissing.push({
      name: 'Giày trekking cổ lửng đế gai sâu (rộng hơn 0.5–1 size)',
      category: 'Trang phục',
      weightGrams: 850,
      reason: 'Bảo vệ cổ chân chống lật sơ mi và bám đá rêu trơn.',
      severity: 'critical',
    });
  } else {
    checklistHighlights.push('Đã có giày trekking chuyên dụng');
  }

  // 2. Headlamp & backup light
  if (!hasPackedItem(packedNormList, ['den pin', 'headlamp', 'den doi dau'])) {
    score -= 14;
    criticalMissing.push({
      name: 'Đèn pin đội đầu (Headlamp) + 2 viên pin dự phòng',
      category: 'Điện tử',
      weightGrams: 200,
      reason: 'Bắt buộc cho đẩy đỉnh đón bình minh hoặc phòng hạ sơn muộn trời tối.',
      severity: 'critical',
    });
  }

  // 3. First Aid Kit
  if (!hasPackedItem(packedNormList, ['so cuu', 'y te', 'bang gac', 'thuoc', 'first aid'])) {
    score -= 14;
    criticalMissing.push({
      name: 'Túi sơ cứu y tế dã ngoại (gạc, băng thun, Povidine, Paracetamol, Berberin)',
      category: 'Y tế & An toàn',
      weightGrams: 350,
      reason: 'Xử lý kịp thời lật sơ mi, trầy xước, đau bụng và hạ sốt giữa rừng.',
      severity: 'critical',
    });
  }

  // 4. Whistle / SOS gear
  if (!hasPackedItem(packedNormList, ['coi', 'sos', 'bat lua'])) {
    score -= 8;
    criticalMissing.push({
      name: 'Còi cứu hộ SOS + Bật lửa sinh tồn chống gió',
      category: 'Y tế & An toàn',
      weightGrams: 80,
      reason: 'Phát tín hiệu 3 hồi ngắn quốc tế khi sương mù dày hoặc lạc dấu.',
      severity: 'critical',
    });
  }

  // 5. Rain shell
  if (!hasPackedItem(packedNormList, ['ao mua', 'chong tham', 'gore tex', 'poncho'])) {
    score -= 12;
    criticalMissing.push({
      name: 'Áo mưa bộ 2 lớp chống thấm & Áo trùm balo',
      category: 'Trang phục',
      weightGrams: 450,
      reason: 'Ngăn ướt lạnh gây hạ thân nhiệt đột ngột khi mưa rừng.',
      severity: 'critical',
    });
  }

  // 6. Hydration & Water Source Audit
  const hasWaterCarry = hasPackedItem(packedNormList, ['nuoc', 'binh', 'tui nuoc', 'water']);
  const hasWaterFilter = hasPackedItem(packedNormList, ['loc nuoc', 'sawyer', 'aquatabs']);
  const hasElectrolyte = hasPackedItem(packedNormList, ['oresol', 'dien giai', 'bu khoang']);

  if (isDryTrail) {
    if (!hasWaterCarry) {
      score -= 22;
      criticalMissing.push({
        name: 'Bình / Túi nước dung tích tối thiểu 3 – 4 lít (Tuyến khô / ít nước)',
        category: 'Ăn uống & Nước',
        weightGrams: 300,
        reason: `${trail.name} có đoạn nắng gắt / thiếu nguồn nước tự nhiên — nguy cơ sốc nhiệt và mất nước cao.`,
        severity: 'critical',
      });
    }
    if (!hasElectrolyte) {
      score -= 8;
      criticalMissing.push({
        name: '3 gói Oresol / Viên sủi bù điện giải chống chuột rút',
        category: 'Ăn uống & Nước',
        weightGrams: 60,
        reason: 'Bù muối khoáng mất qua mồ hôi trên địa hình nắng nóng / khô.',
        severity: 'critical',
      });
    }
  } else {
    if (!hasWaterCarry) {
      score -= 14;
      criticalMissing.push({
        name: 'Bình / Túi nước sinh tồn 2 – 2.5 lít',
        category: 'Ăn uống & Nước',
        weightGrams: 250,
        reason: 'Duy trì uống từng ngụm nhỏ mỗi 15–20 phút suốt chặng leo.',
        severity: 'critical',
      });
    }
    if (!hasWaterFilter) {
      score -= 5;
      recommendedAdditions.push({
        name: 'Màng lọc Sawyer Squeeze hoặc viên lọc Aquatabs',
        category: 'Ăn uống & Nước',
        weightGrams: 120,
        reason: 'Tuyến có suối tự nhiên — lọc nước dọc đường giúp giảm 1.5–2kg nước phải vác từ đầu.',
        severity: 'recommended',
      });
    }
  }

  // 7. Cold Summit & Hypothermia Audit
  if (isColdSummit) {
    if (!hasPackedItem(packedNormList, ['long vu', 'giu nhiet', 'ao am', 'ao ni', 'fleece', 'ao khoac'])) {
      score -= 16;
      criticalMissing.push({
        name: isVeryCold ? 'Áo khoác lông vũ giữ ấm (-5°C) + Áo giữ nhiệt Base-Layer' : 'Áo nỉ / lông vũ giữ nhiệt (Mid-Layer)',
        category: 'Trang phục',
        weightGrams: 420,
        reason: `Nhiệt độ đỉnh ${trail.maxAltitudeM.toLocaleString()}m ước tính hạ xuống ~${summitTempMinC}°C vào ban đêm.`,
        severity: 'critical',
      });
    } else {
      checklistHighlights.push(`Đã có lớp giữ nhiệt cho đỉnh ~${summitTempMinC}°C`);
    }
  }

  if (isVeryCold && !hasPackedItem(packedNormList, ['gang tay', 'mu len', 'mieng dan giu nhiet'])) {
    score -= 6;
    recommendedAdditions.push({
      name: 'Mũ len bịt tai, găng tay giữ nhiệt & 2 miếng dán nhiệt',
      category: 'Trang phục',
      weightGrams: 180,
      reason: 'Chống tê cóng đầu chi & giữ ấm khi săn mây lúc 04:30 sáng.',
      severity: 'recommended',
    });
  }

  // 8. Overnight / Shelter Audit
  if (isMultiDay) {
    if (!hasPackedItem(packedNormList, ['tui ngu', 'sleeping bag'])) {
      score -= 14;
      criticalMissing.push({
        name: isVeryCold ? 'Túi ngủ chịu nhiệt 0°C – 5°C' : 'Túi ngủ dã ngoại 10°C',
        category: 'Đồ ngủ & Lán',
        weightGrams: 1100,
        reason: `Hành trình ${trail.durationDays} ngày qua đêm trên núi bắt buộc có túi ngủ giữ nhiệt.`,
        severity: 'critical',
      });
    }
    if (!hasPackedItem(packedNormList, ['dem cach nhiet', 'tham cach nhiet', 'pad'])) {
      score -= 5;
      recommendedAdditions.push({
        name: 'Đệm cách nhiệt trải lán / nền lều',
        category: 'Đồ ngủ & Lán',
        weightGrams: 350,
        reason: 'Ngăn hơi lạnh từ nền đất hút cạn thân nhiệt khi ngủ đêm.',
        severity: 'recommended',
      });
    }
  }

  // 9. Permit & Identity Document Audit
  if (trail.permitRequired && !hasPackedItem(packedNormList, ['cccd', 'cmnd', 'giay to', 'giay phep', 'ho chieu'])) {
    score -= 12;
    criticalMissing.push({
      name: 'CCCD bản gốc + Bản in hồ sơ khai báo VQG / Đồn Biên phòng',
      category: 'Khác',
      weightGrams: 20,
      reason: `Tuyến yêu cầu thủ tục: ${trail.permitInfo || 'Khai báo Trạm Kiểm lâm / Biên phòng'}.`,
      severity: 'critical',
    });
  }

  // 10. Steep terrain & Leech protection
  if (isSteep && !hasPackedItem(packedNormList, ['gay trekking', 'gay leo nui', 'pole'])) {
    score -= 6;
    recommendedAdditions.push({
      name: 'Cặp gậy trekking hợp kim nhôm',
      category: 'Trang phục',
      weightGrams: 500,
      reason: `Cung cấp độ ${trail.difficultyLevel}/5 có độ dốc cao — gậy giảm 25% tải khớp gối khi đổ dốc.`,
      severity: 'recommended',
    });
  }

  if (trail.hasWaterSource && !hasPackedItem(packedNormList, ['chong vat', 'dep', 'deet', 'xa cap', 'gaiter'])) {
    recommendedAdditions.push({
      name: 'Thuốc bôi chống vắt DEP / Xịt côn trùng DEET & Xà cạp (Gaiters)',
      category: 'Y tế & An toàn',
      weightGrams: 140,
      reason: 'Rừng ẩm Việt Nam gần suối có nhiều vắt và muỗi rừng.',
      severity: 'recommended',
    });
  }

  // 11. Powerbank & Zero-waste bag
  if (!hasPackedItem(packedNormList, ['sac du phong', 'pin du phong', 'powerbank'])) {
    recommendedAdditions.push({
      name: 'Sạc dự phòng 10.000–20.000mAh bọc túi zip chống ẩm',
      category: 'Điện tử',
      weightGrams: 350,
      reason: 'Duy trì GPS Offline & liên lạc khẩn cấp suốt hành trình.',
      severity: 'recommended',
    });
  }
  if (!hasPackedItem(packedNormList, ['tui rac', 'zero waste', 'rac'])) {
    recommendedAdditions.push({
      name: 'Túi đựng rác cá nhân (Leave No Trace)',
      category: 'Khác',
      weightGrams: 40,
      reason: 'Mang 100% rác vô cơ xuống chân núi theo quy chuẩn VQG.',
      severity: 'recommended',
    });
  }

  // 12. Pack-to-Body Ratio Evaluation & Ultralight Tips
  const packRatioPercent = Math.round((effectivePackKg / bodyWeightKg) * 1000) / 10;
  const packStatus: PackAuditResult['packStatus'] =
    packRatioPercent > 22 ? 'overweight' : packRatioPercent > 18 ? 'caution' : 'optimal';

  if (packStatus === 'overweight') {
    score -= 14;
    const targetKg = Math.round(bodyWeightKg * 0.18 * 10) / 10;
    weightSavingTips.push(
      `Balo hiện chiếm ${packRatioPercent}% thể trọng (> 22%): hãy cắt giảm về <= ${targetKg} kg để tránh chấn thương khớp gối.`,
      'Chia chung lều, bếp và đồ nấu ăn với đồng đội hoặc thuê Porter bản địa (500.000–800.000 VNĐ/ngày, gùi tới 15kg).'
    );
  } else if (packStatus === 'caution') {
    score -= 5;
    weightSavingTips.push(
      `Tỷ lệ tải ${packRatioPercent}% ở ngưỡng khá nặng (18–22%): siết chặt đai trợ lực hông và đặt vật nặng sát sống lưng.`
    );
  } else {
    checklistHighlights.push(`Tỷ lệ balo ${packRatioPercent}% thể trọng đạt mức tối ưu`);
  }

  if (trail.hasWaterSource) {
    weightSavingTips.push('Tuyến có điểm tiếp nước suối: chỉ cần vác 1.5–2L từ chân núi và dùng màng lọc Sawyer thay vì vác 4L nước nặng.');
  }
  if (hasPackedItem(packedNormList, ['may anh', 'mirrorless', 'dslr', 'loa'])) {
    weightSavingTips.push('Cân nhắc rút gọn ống kính phụ / thiết bị nặng không thiết yếu để tiết kiệm 0.8–1.5kg.');
  }
  if (weightSavingTips.length === 0) {
    weightSavingTips.push('Thay chai nhựa cứng bằng túi nước mềm (Soft Flask) và hạn chế quần áo cotton dày lâu khô.');
  }

  const readinessScore = Math.max(0, Math.min(100, Math.round(score)));
  const readinessGrade: PackAuditResult['readinessGrade'] =
    criticalMissing.length === 0 && readinessScore >= 80
      ? 'SẴN SÀNG'
      : criticalMissing.length <= 2 && readinessScore >= 55
      ? 'CẦN BỔ SUNG'
      : 'THIẾU ĐỒ AN TOÀN';

  return {
    trailId: trail.id,
    trailName: trail.name,
    province: trail.province,
    maxAltitudeM: trail.maxAltitudeM,
    difficultyLevel: trail.difficultyLevel,
    durationDays: trail.durationDays,
    hasWaterSource: Boolean(trail.hasWaterSource),
    hasCampsite: Boolean(trail.hasCampsite),
    permitRequired: Boolean(trail.permitRequired),
    summitTempMinC,
    weatherNote,
    readinessScore,
    readinessGrade,
    packRatioPercent,
    packStatus,
    totalPackedGrams: summedGrams > 0 ? summedGrams : hasExplicitPackKg ? Math.round(effectivePackKg * 1000) : 0,
    packedCount: checkedItems.length,
    criticalMissing,
    recommendedAdditions,
    weightSavingTips,
    checklistHighlights,
  };
}

// =========================================================================
// WAVE 4C: HEAD-TO-HEAD MULTI-TRAIL COMPARISON ENGINE
// =========================================================================

const COMPARE_INTENT_PHRASES = [
  'so sanh',
  'tot hon',
  'dep hon',
  'kho hon',
  'de hon',
  'nen di',
  'nen leo',
  'chon cung nao',
  'chon nui nao',
  'doi dau',
  'khac nhau',
  'giua',
  ' vs ',
  'hay la',
];

const TRAIL_DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Cấp 1/5 — Dễ (Người mới)',
  2: 'Cấp 2/5 — Nhẹ nhàng',
  3: 'Cấp 3/5 — Trung bình',
  4: 'Cấp 4/5 — Khó (Dốc gắt)',
  5: 'Cấp 5/5 — Rất khó (Chuyên sâu)',
};

/**
 * Checks whether a normalized Vietnamese query is asking for a head-to-head trail comparison.
 */
export function isComparisonIntent(normalizedQ: string): boolean {
  if (!normalizedQ) return false;
  if (COMPARE_INTENT_PHRASES.some((p) => (p.startsWith(' ') ? normalizedQ.includes(p) : hasWholePhrase(normalizedQ, p)))) {
    return true;
  }
  // Pattern: "<trail A> hay <trail B>" or "<trail A> vs <trail B>"
  if (hasWholePhrase(normalizedQ, 'vs') || hasWholePhrase(normalizedQ, 'hay')) {
    return true;
  }
  return false;
}

/**
 * Finds 2–3 distinct verified Vietnam trails mentioned in a Vietnamese query (diacritic & typo tolerant),
 * preserving left-to-right appearance order. Falls back to pairing with `activeTrailId` when only 1 trail
 * is named alongside a comparison cue (e.g. "so sánh với Tà Xùa").
 */
export function detectTrailsForComparison(
  rawQuery: string,
  availableTrails: Trail[] = [],
  activeTrailId?: string
): Trail[] {
  const allTrails = mergeWithAllSeedTrails(availableTrails);
  const normalizedQ = normalizeSearchText(rawQuery);
  if (!normalizedQ) return [];

  const queryTokens = normalizedQ.split(' ').filter((w) => w.length >= 4);
  const matchedWithPos: Array<{ trail: Trail; pos: number; score: number }> = [];
  const seenIds = new Set<string>();

  const recordMatch = (trail: Trail, pos: number, score: number) => {
    const existing = matchedWithPos.find((m) => m.trail.id === trail.id);
    if (existing) {
      if (score > existing.score || (score === existing.score && pos < existing.pos)) {
        existing.pos = pos;
        existing.score = score;
      }
      return;
    }
    seenIds.add(trail.id);
    matchedWithPos.push({ trail, pos, score });
  };

  // 1. Build candidate alias lists once, then run Exact Whole-Phrase pass BEFORE Fuzzy pass so consumed tokens never trigger false neighbors (e.g. "Pha Luông" -> "Pù Luông")
  const trailCandidates: Array<{ trail: Trail; candidates: string[] }> = allTrails.map((trail) => {
    const candidates = [
      trail.name,
      ...(Array.isArray(trail.altNames) ? trail.altNames : []),
    ]
      .map((s) => normalizeSearchText(s))
      .filter((s) => s.length >= 3);

    const matrixEntry = VIETNAM_PEAKS_MATRIX.find((p) => p.canonicalTrailId === trail.id);
    if (matrixEntry) {
      for (const alias of matrixEntry.aliases) {
        const normAlias = normalizeSearchText(alias);
        if (normAlias.length >= 3) candidates.push(normAlias);
      }
    }
    return { trail, candidates };
  });

  const consumedExactTokens = new Set<string>();

  for (const { trail, candidates } of trailCandidates) {
    for (const alias of candidates) {
      if (hasWholePhrase(normalizedQ, alias)) {
        const pos = normalizedQ.indexOf(alias);
        recordMatch(trail, pos >= 0 ? pos : 999, alias.includes(' ') ? 100 + alias.length : 80 + alias.length);
        if (alias.includes(' ')) {
          for (const tok of alias.split(' ')) {
            if (tok.length >= 3) consumedExactTokens.add(tok);
          }
        }
      }
    }
  }

  const remainingFuzzyTokens = queryTokens.filter((tok) => !consumedExactTokens.has(tok));
  if (remainingFuzzyTokens.length > 0) {
    for (const { trail, candidates } of trailCandidates) {
      if (seenIds.has(trail.id)) continue;
      for (const alias of candidates) {
        if (!alias.includes(' ') && alias.length >= 5) {
          const maxDist = alias.length >= 7 ? 2 : 1;
          for (const tok of remainingFuzzyTokens) {
            if (Math.abs(tok.length - alias.length) <= maxDist && levenshteinDistance(tok, alias, maxDist) <= maxDist) {
              const pos = normalizedQ.indexOf(tok);
              recordMatch(trail, pos >= 0 ? pos : 999, 60);
              break;
            }
          }
        }
      }
    }
  }

  // Sort left-to-right by appearance in user's prompt so "So sánh A và B" renders [A, B]
  matchedWithPos.sort((a, b) => a.pos - b.pos || b.score - a.score);
  const picked = matchedWithPos.slice(0, 3).map((m) => m.trail);

  // If user is currently viewing a trail and asks "so sánh với <Trail B>", pair activeTrail + mentioned trail
  if (picked.length === 1 && activeTrailId && !seenIds.has(activeTrailId)) {
    const activeTrail = allTrails.find((t) => t.id === activeTrailId);
    if (activeTrail) {
      return [activeTrail, picked[0]];
    }
  }

  return picked;
}

function getHighlightTag(trail: Trail): string {
  if (CLOUD_HUNTING_SLUGS.has(trail.id) && trail.maxAltitudeM >= 2800) return 'Săn mây · Đỉnh >2.800m';
  if (CLOUD_HUNTING_SLUGS.has(trail.id)) return 'Săn biển mây & bình minh';
  if (WATERFALL_FOREST_SLUGS.has(trail.id)) return 'Suối thác & rừng nguyên sinh';
  if (ARID_DRY_TRAIL_SLUGS.has(trail.id)) return 'Cung đồi cỏ / ven biển nắng gió';
  return `${trail.region} · ${trail.maxAltitudeM.toLocaleString()}m`;
}

function getRecommendedFitnessLabel(level: number): string {
  if (level <= 2) return 'Người mới / Gia đình';
  if (level === 3) return 'Trung bình (tập nhẹ 2 tuần)';
  if (level === 4) return 'Khá - Tốt (đã leo >= 1 đỉnh)';
  return 'Thể lực cao & kinh nghiệm đa ngày';
}

/**
 * Head-to-Head Multi-Trail Comparison over 2–3 verified Vietnam trails with live active incidents,
 * Naismith ETA, water needs, seasonal suitability, VND budget & Beginner vs Veteran verdicts.
 */
export async function compareVietnamTrails(
  input: TrailCompareInput,
  availableTrails: Trail[] = []
): Promise<TrailCompareData | null> {
  const allTrails = mergeWithAllSeedTrails(availableTrails);
  const selectedTrails: Trail[] = [];
  const seen = new Set<string>();

  if (Array.isArray(input.trailIds) && input.trailIds.length > 0) {
    for (const rawId of input.trailIds) {
      const id = String(rawId || '').trim();
      if (!id || seen.has(id)) continue;
      const found = allTrails.find(
        (t) =>
          t.id === id ||
          String((t as { _id?: unknown })._id || '') === id ||
          normalizeSearchText(t.name) === normalizeSearchText(id)
      );
      if (found && !seen.has(found.id)) {
        seen.add(found.id);
        selectedTrails.push(found);
      }
      if (selectedTrails.length >= 3) break;
    }
  }

  if (selectedTrails.length < 2 && typeof input.query === 'string' && input.query.trim()) {
    const detected = detectTrailsForComparison(input.query, allTrails, input.activeTrailId);
    for (const t of detected) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        selectedTrails.push(t);
      }
      if (selectedTrails.length >= 3) break;
    }
  }

  if (selectedTrails.length < 2) return null;

  const targetMonth = getVietnamCurrentMonth();

  // Single bounded query for live unresolved incidents
  const incidentsByTrailKey = new Map<string, Array<{ severity: string; type: string; description: string }>>();
  const pushInc = (key: string, entry: { severity: string; type: string; description: string }) => {
    const arr = incidentsByTrailKey.get(key) || [];
    arr.push(entry);
    incidentsByTrailKey.set(key, arr);
  };

  if (mongoose.connection.readyState === 1) {
    const activeIncs = await IncidentModel.find({ active: { $ne: false }, resolved: { $ne: true } })
      .select('trailId trailName severity type description')
      .limit(50)
      .lean()
      .maxTimeMS(900)
      .catch(() => []);
    for (const inc of activeIncs as Array<Record<string, unknown>>) {
      const entry = {
        severity: String(inc.severity || 'medium').toLowerCase(),
        type: String(inc.type || 'other'),
        description: String(inc.description || '').slice(0, 110),
      };
      if (inc.trailId) pushInc(String(inc.trailId), entry);
      if (inc.trailName) pushInc(normalizeSearchText(String(inc.trailName)), entry);
    }
  } else {
    for (const inc of mockIncidents) {
      if (!inc.resolved) {
        const entry = {
          severity: String(inc.severity || 'medium').toLowerCase(),
          type: String(inc.type || 'other'),
          description: String(inc.description || '').slice(0, 110),
        };
        if (inc.trailId) pushInc(String(inc.trailId), entry);
        if (inc.trailName) pushInc(normalizeSearchText(String(inc.trailName)), entry);
      }
    }
  }

  const items: TrailCompareItem[] = selectedTrails.map((t) => {
    const bio = calculateAlpineBioMetrics({
      trailId: t.id,
      trailName: t.name,
      distanceKm: t.distanceKm,
      elevationGainM: t.elevationGainM,
      elevationLossM: t.elevationGainM,
      maxAltitudeM: t.maxAltitudeM,
      bodyWeightKg: 62,
      packWeightKg: t.durationDays >= 2 ? 9 : 4.5,
      fitnessLevel: 'intermediate',
      durationDays: t.durationDays,
    });

    const bestMonths = Array.isArray(t.bestMonths) ? t.bestMonths : [10, 11, 12, 1, 2, 3, 4];
    const avoidMonths = Array.isArray(t.avoidMonths) ? t.avoidMonths : [];
    const seasonStatus: 'ideal' | 'ok' | 'avoid' = avoidMonths.includes(targetMonth)
      ? 'avoid'
      : bestMonths.includes(targetMonth)
      ? 'ideal'
      : 'ok';

    const byId = incidentsByTrailKey.get(t.id) || [];
    const byName = incidentsByTrailKey.get(normalizeSearchText(t.name)) || [];
    const seenDesc = new Set<string>();
    const activeIncs = [...byId, ...byName].filter((inc) => {
      const k = `${inc.type}|${inc.description}`;
      if (seenDesc.has(k)) return false;
      seenDesc.add(k);
      return true;
    });

    const budget = estimateBudgetVnd(t);
    return {
      trailId: t.id,
      name: t.name,
      province: t.province,
      region: t.region,
      difficultyLevel: t.difficultyLevel,
      difficultyLabel: TRAIL_DIFFICULTY_LABELS[t.difficultyLevel] || `Cấp ${t.difficultyLevel}/5`,
      maxAltitudeM: t.maxAltitudeM,
      distanceKm: t.distanceKm,
      elevationGainM: t.elevationGainM,
      durationDays: t.durationDays,
      durationLabel: t.durationHoursNote || `${t.durationDays} ngày`,
      naismithHours: bio.naismithHours,
      waterLitersTotal: bio.waterLitersTotal,
      permitRequired: Boolean(t.permitRequired),
      permitSummary: t.permitRequired ? t.permitInfo || 'Cần giấy phép VQG / Kiểm lâm' : 'Tự do (mang CCCD gốc)',
      hasWaterSource: Boolean(t.hasWaterSource),
      bestMonths,
      seasonStatus,
      activeIncidentsCount: activeIncs.length,
      activeIncidentNote: activeIncs[0] ? `${activeIncs[0].severity.toUpperCase()}: ${activeIncs[0].description}` : undefined,
      estimatedBudgetVnd: budget,
      highlightTag: getHighlightTag(t),
      fitnessRecommended: getRecommendedFitnessLabel(t.difficultyLevel),
    };
  });

  // Beginner pick: lowest difficulty + shorter duration + fewest active incidents + accessible elevation
  const beginnerSorted = [...items].sort((a, b) => {
    const scoreA = a.difficultyLevel * 30 + a.durationDays * 10 + a.elevationGainM / 120 + a.activeIncidentsCount * 25 + (a.seasonStatus === 'avoid' ? 18 : 0);
    const scoreB = b.difficultyLevel * 30 + b.durationDays * 10 + b.elevationGainM / 120 + b.activeIncidentsCount * 25 + (b.seasonStatus === 'avoid' ? 18 : 0);
    return scoreA - scoreB;
  });
  const beginnerTop = beginnerSorted[0];

  // Veteran pick: highest altitude + elevation gain + difficulty challenge (prefer different from beginner if possible)
  const veteranSorted = [...items].sort((a, b) => {
    const scoreA = a.difficultyLevel * 28 + a.maxAltitudeM / 70 + a.elevationGainM / 35 + a.distanceKm * 1.4;
    const scoreB = b.difficultyLevel * 28 + b.maxAltitudeM / 70 + b.elevationGainM / 35 + b.distanceKm * 1.4;
    return scoreB - scoreA;
  });
  const veteranTop = veteranSorted.find((x) => x.trailId !== beginnerTop.trailId) || veteranSorted[0];

  const idealThisMonth = items.filter((i) => i.seasonStatus === 'ideal').map((i) => i.name);
  const avoidThisMonth = items.filter((i) => i.seasonStatus === 'avoid').map((i) => i.name);

  let bestSeasonNote = `Tháng ${targetMonth}: `;
  if (idealThisMonth.length > 0) {
    bestSeasonNote += `${idealThisMonth.join(', ')} đang vào mùa đẹp nhất`;
    if (avoidThisMonth.length > 0) bestSeasonNote += ` (cần thận trọng mưa/bão tại ${avoidThisMonth.join(', ')})`;
    bestSeasonNote += '.';
  } else if (avoidThisMonth.length > 0) {
    bestSeasonNote += `${avoidThisMonth.join(', ')} đang trong giai đoạn mưa/khắc nghiệt — bắt buộc kiểm tra Go/No-Go trước khi xuất phát.`;
  } else {
    bestSeasonNote += 'cả hai tuyến đều ở mùa chuyển tiếp, cần theo dõi gió & lượng mưa 48h trước khi đi.';
  }

  const namesList = items.map((i) => i.name).join(' vs ');
  const summaryVerdict = `So sánh thực địa **${namesList}**: **${beginnerTop.name}** dễ tiếp cận hơn cho người mới (cấp ${beginnerTop.difficultyLevel}/5, ~${beginnerTop.naismithHours}h di chuyển), trong khi **${veteranTop.name}** mang lại thử thách cao hơn (${veteranTop.maxAltitudeM.toLocaleString()}m, +${veteranTop.elevationGainM}m dốc).`;

  return {
    trails: items,
    targetMonth,
    summaryVerdict,
    beginnerPick: {
      trailId: beginnerTop.trailId,
      name: beginnerTop.name,
      reason: `Độ khó cấp ${beginnerTop.difficultyLevel}/5, tổng leo +${beginnerTop.elevationGainM}m (~${beginnerTop.naismithHours}h Naismith)${beginnerTop.hasWaterSource ? ', có nguồn nước dọc tuyến' : ''}.`,
    },
    veteranPick: {
      trailId: veteranTop.trailId,
      name: veteranTop.name,
      reason: `Đỉnh ${veteranTop.maxAltitudeM.toLocaleString()}m, cự ly ${veteranTop.distanceKm} km (+${veteranTop.elevationGainM}m dốc) — phù hợp trekker ưa thử thách kỹ thuật.`,
    },
    bestSeasonNote,
  };
}
