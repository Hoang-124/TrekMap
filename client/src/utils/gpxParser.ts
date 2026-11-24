import { haversineMeters } from './geoMath.js';
import type { AiFitnessLevel, BioCalcResult, GpxAnalysisResult, GpxElevationSample } from '../components/ai-assistant/ai.types.js';

export interface ParsedClientGpx {
  fileName: string;
  points: Array<[number, number, number | null]>;
  hasElevation: boolean;
  offlineAnalysis: GpxAnalysisResult;
}

const MAX_GPX_FILE_BYTES = 2.5 * 1024 * 1024; // 2.5 MB
const MAX_POINTS_SENT = 1500;

function smoothElevations(raw: number[]): number[] {
  if (raw.length < 3) return raw;
  return raw.map((val, idx) => {
    if (idx === 0 || idx === raw.length - 1) return val;
    return Math.round((raw[idx - 1] * 0.25 + val * 0.5 + raw[idx + 1] * 0.25) * 10) / 10;
  });
}

function downsamplePoints<T>(items: T[], maxCount: number): T[] {
  if (items.length <= maxCount) return items;
  const out: T[] = [];
  for (let i = 0; i < maxCount; i++) {
    const idx = Math.round((i * (items.length - 1)) / (maxCount - 1));
    out.push(items[idx]);
  }
  return out;
}

function computeClientToblerSpeedKmH(slopeRiseOverRun: number, fitness: AiFitnessLevel): number {
  const clamped = Math.max(-0.65, Math.min(0.65, slopeRiseOverRun));
  const rawKmH = 6 * Math.exp(-3.5 * Math.abs(clamped + 0.05));
  const mult = fitness === 'beginner' ? 0.8 : fitness === 'advanced' ? 1.16 : 1.0;
  return Math.max(0.8, rawKmH * 0.78 * mult);
}

/**
 * Pure client-side Alpine Bio-Calculator (instant 0ms interactive sliders & offline GPX preview).
 */
export function computeClientBioMetrics(params: {
  trailName?: string;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM?: number;
  maxAltitudeM: number;
  bodyWeightKg: number;
  packWeightKg: number;
  fitnessLevel: AiFitnessLevel;
  ambientTempC?: number;
  durationDays?: number;
  toblerHoursDirect?: number;
}): BioCalcResult {
  const distanceKm = Math.max(0.5, Math.min(250, params.distanceKm || 12));
  const elevationGainM = Math.max(0, Math.min(10000, params.elevationGainM || 700));
  const elevationLossM = Math.max(0, Math.min(10000, params.elevationLossM ?? elevationGainM));
  const maxAltitudeM = Math.max(50, Math.min(4000, params.maxAltitudeM || 1800));
  const bodyWeightKg = Math.max(35, Math.min(160, params.bodyWeightKg || 62));
  const packWeightKg = Math.max(0, Math.min(40, params.packWeightKg || 8));
  const fitnessLevel = params.fitnessLevel || 'intermediate';
  const ambientTempC =
    params.ambientTempC !== undefined
      ? Math.max(-5, Math.min(45, params.ambientTempC))
      : maxAltitudeM >= 2400
      ? 16
      : maxAltitudeM >= 1400
      ? 22
      : 28;
  const durationDays = Math.max(1, Math.min(10, Math.round(params.durationDays || (distanceKm >= 16 || elevationGainM >= 1300 ? 2 : 1))));

  const packRatioPercent = Math.round((packWeightKg / bodyWeightKg) * 1000) / 10;
  const packStatus: BioCalcResult['packStatus'] =
    packRatioPercent > 22 ? 'overweight' : packRatioPercent > 18 ? 'caution' : 'optimal';
  const packFatigue = packRatioPercent > 15 ? 1 + 0.015 * (packRatioPercent - 15) : 1;

  const baseSpeed = fitnessLevel === 'beginner' ? 3.5 : fitnessLevel === 'advanced' ? 5.4 : 4.5;
  const avgDescentGrade = distanceKm > 0 ? elevationLossM / (distanceKm * 500) : 0;
  const steepDescentHrs = avgDescentGrade > 0.12 ? elevationLossM / 1800 : 0;
  const naismithHours = Math.round((distanceKm / baseSpeed + elevationGainM / 600 + steepDescentHrs) * packFatigue * 10) / 10;

  let toblerRaw: number;
  if (params.toblerHoursDirect && params.toblerHoursDirect > 0) {
    toblerRaw = params.toblerHoursDirect * packFatigue;
  } else {
    const halfKm = Math.max(0.25, distanceKm / 2);
    const upHrs = halfKm / computeClientToblerSpeedKmH(elevationGainM / (halfKm * 1000), fitnessLevel);
    const downHrs = halfKm / computeClientToblerSpeedKmH(-elevationLossM / (halfKm * 1000), fitnessLevel);
    toblerRaw = (upHrs + downHrs) * packFatigue;
  }
  const toblerHours = Math.round(toblerRaw * 10) / 10;
  const recommendedMovingHours = Math.round((naismithHours * 0.5 + toblerHours * 0.5) * 10) / 10;
  const estimatedTotalTripHours = Math.round(recommendedMovingHours * 1.22 * 10) / 10;

  const heatRate = ambientTempC > 20 ? ((ambientTempC - 20) / 5) * 0.12 : 0;
  const altMult = maxAltitudeM >= 2500 ? 1.15 : 1;
  const waterLitersTotal = Math.round(Math.max(1.5, recommendedMovingHours * (0.48 + heatRate) * altMult) * 10) / 10;
  const waterLitersPerDay = Math.round((waterLitersTotal / durationDays) * 10) / 10;
  const oresolPackets = Math.max(durationDays, Math.ceil(waterLitersTotal / 1.8));

  const climbRate = recommendedMovingHours > 0 ? elevationGainM / recommendedMovingHours : 0;
  const met = 5.8 + (climbRate / 300) * 1.1 + (packWeightKg / bodyWeightKg) * 3.5;
  const caloriesActiveKcal = Math.round(met * bodyWeightKg * recommendedMovingHours);
  const caloriesDailyTotalKcal = Math.round(caloriesActiveKcal / durationDays + 1550);

  const maxRecKg = Math.round(bodyWeightKg * 0.18 * 10) / 10;
  const packAdvice =
    packStatus === 'optimal'
      ? `Tỷ lệ tải ${packRatioPercent}% (<= 18% thể trọng) đạt mức tối ưu bảo vệ khớp gối.`
      : packStatus === 'caution'
      ? `Tỷ lệ tải ${packRatioPercent}% ở mức khá nặng (18–22%). Siết chặt đai trợ lực hông.`
      : `QUÁ TẢI (${packRatioPercent}% > 22%). Nên giảm balo dưới ${maxRecKg} kg hoặc thuê Porter.`;

  const amsRiskLevel: BioCalcResult['amsRiskLevel'] =
    maxAltitudeM >= 2900 ? 'high' : maxAltitudeM >= 2400 ? 'moderate' : maxAltitudeM >= 2000 ? 'low' : 'none';
  const amsAdvice =
    amsRiskLevel === 'high'
      ? `Đỉnh cao ${maxAltitudeM.toLocaleString()}m: đi nhịp chậm Rest Step, uống nước ấm đều và hạ độ cao 300–500m ngay nếu đau đầu/buồn nôn.`
      : amsRiskLevel === 'moderate'
      ? `Cao độ ${maxAltitudeM.toLocaleString()}m: dễ đau đầu nhẹ đêm lán, tránh rượu bia và giữ ấm đầu cổ.`
      : amsRiskLevel === 'low'
      ? `Cao độ ${maxAltitudeM.toLocaleString()}m: giữ nhịp thở đều 2:2 khi lên dốc gắt.`
      : 'Dưới 2.000m, ưu tiên chống sốc nhiệt và bù điện giải.';

  return {
    inputs: {
      trailName: params.trailName,
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
    snackPlan: [
      `Nước uống: ~${waterLitersPerDay}L/ngày (tổng ${waterLitersTotal}L) nhấp từng ngụm mỗi 15–20 phút.`,
      `Điện giải: ${oresolPackets} gói Oresol / viên sủi khoáng.`,
      `Snacks: ${Math.max(2, Math.ceil(caloriesActiveKcal / 1200))} thanh lương khô / gel năng lượng + hạt dinh dưỡng + socola đen.`,
    ],
  };
}

/**
 * Parses a GPX 1.1 XML file strictly client-side via DOMParser (safe, no external deps, offline-ready).
 */
export async function parseGpxFileClient(file: File): Promise<ParsedClientGpx> {
  if (!file) throw new Error('Chưa chọn tệp GPX.');
  if (file.size > MAX_GPX_FILE_BYTES) {
    throw new Error('File GPX quá lớn (tối đa 2.5 MB).');
  }

  const xmlText = await file.text();
  if (!xmlText || !xmlText.includes('<gpx')) {
    throw new Error('Tệp không đúng định dạng GPX 1.1 hợp lệ.');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Cấu trúc XML của file GPX bị lỗi, không thể đọc tọa độ.');
  }

  let nodes = Array.from(doc.getElementsByTagName('trkpt'));
  if (nodes.length < 2) {
    nodes = Array.from(doc.getElementsByTagName('rtept'));
  }
  if (nodes.length < 2) {
    nodes = Array.from(doc.getElementsByTagName('wpt'));
  }

  const extracted: Array<[number, number, number | null]> = [];
  for (const el of nodes) {
    const lat = Number(el.getAttribute('lat'));
    const lon = Number(el.getAttribute('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      continue;
    }
    const eleNode = el.getElementsByTagName('ele')[0];
    const parsedEle = eleNode?.textContent ? Number(eleNode.textContent.trim()) : null;
    const ele = parsedEle !== null && Number.isFinite(parsedEle) ? Math.round(parsedEle * 10) / 10 : null;
    extracted.push([lat, lon, ele]);
  }

  if (extracted.length < 2) {
    throw new Error('File GPX phải chứa tối thiểu 2 điểm tọa độ (<trkpt> hoặc <rtept>).');
  }

  const boundedPoints = downsamplePoints(extracted, MAX_POINTS_SENT);
  const validEleCount = boundedPoints.filter((p) => p[2] !== null).length;
  const hasElevation = validEleCount >= Math.max(2, Math.floor(boundedPoints.length * 0.6));

  // Build instant offline analysis preview
  const cumKm: number[] = [0];
  for (let i = 1; i < boundedPoints.length; i++) {
    const segM = haversineMeters(boundedPoints[i - 1][0], boundedPoints[i - 1][1], boundedPoints[i][0], boundedPoints[i][1]);
    const segKm = boundedPoints.length > 25 && segM > 5000 ? 0 : segM / 1000;
    cumKm.push(cumKm[i - 1] + segKm);
  }
  const distanceKm = Math.max(0.1, Math.round(cumKm[cumKm.length - 1] * 10) / 10);

  let lastEle = boundedPoints.find((p) => p[2] !== null)?.[2] ?? 0;
  const filledEle = boundedPoints.map((p) => {
    if (p[2] !== null) {
      lastEle = p[2];
      return p[2];
    }
    return lastEle;
  });
  const smoothed = smoothElevations(filledEle);

  let gainM = 0;
  let lossM = 0;
  let minAlt = Infinity;
  let maxAlt = -Infinity;
  let maxSlope = 0;
  let steepKm = 0;
  let gradeSumWeighted = 0;
  let validSegKm = 0;
  let toblerHoursDirect = 0;
  let anchorEle = smoothed[0] ?? 0;
  const profile: GpxElevationSample[] = [];

  for (let i = 0; i < smoothed.length; i++) {
    const ele = Math.round(smoothed[i]);
    if (ele < minAlt) minAlt = ele;
    if (ele > maxAlt) maxAlt = ele;
    let slopePercent = 0;
    if (i > 0) {
      const segKm = Math.max(0.005, cumKm[i] - cumKm[i - 1]);
      const segM = Math.max(20, segKm * 1000);
      if (ele - anchorEle >= 2) {
        gainM += ele - anchorEle;
        anchorEle = ele;
      } else if (anchorEle - ele >= 2) {
        lossM += anchorEle - ele;
        anchorEle = ele;
      }
      const rawSlope = (ele - smoothed[i - 1]) / segM;
      slopePercent = Math.max(-65, Math.min(65, Math.round(rawSlope * 1000) / 10));
      const absG = Math.abs(slopePercent);
      if (absG > maxSlope) maxSlope = absG;
      if (absG >= 15) steepKm += segKm;
      gradeSumWeighted += absG * segKm;
      validSegKm += segKm;
      toblerHoursDirect += segKm / computeClientToblerSpeedKmH(rawSlope, 'intermediate');
    }
    profile.push({ distanceKm: Math.round(cumKm[i] * 100) / 100, elevationM: ele, slopePercent });
  }

  const avgGradePercent = validSegKm > 0 ? Math.round((gradeSumWeighted / validSegKm) * 10) / 10 : 0;
  const steepSegmentsPercent = validSegKm > 0 ? Math.round((steepKm / validSegKm) * 100) : 0;
  const effortIndex = distanceKm * 1.1 + (gainM / 100) * 2.4 + (maxAlt >= 2500 ? 6 : maxAlt >= 1800 ? 3 : 0);
  const estimatedDifficulty =
    effortIndex >= 48 ? 5 : effortIndex >= 34 ? 4 : effortIndex >= 22 ? 3 : effortIndex >= 12 ? 2 : 1;
  const difficultyLabel =
    estimatedDifficulty === 5
      ? 'Cực khó (Thử thách cao độ / Dài ngày)'
      : estimatedDifficulty === 4
      ? 'Khó (Yêu cầu thể lực tốt & kỹ năng dốc)'
      : estimatedDifficulty === 3
      ? 'Trung bình - Khá'
      : estimatedDifficulty === 2
      ? 'Trung bình - Dễ'
      : 'Rất dễ (Dã ngoại nhẹ)';

  const bioMetrics = computeClientBioMetrics({
    trailName: file.name.replace(/\.gpx$/i, ''),
    distanceKm,
    elevationGainM: Math.round(gainM),
    elevationLossM: Math.round(lossM),
    maxAltitudeM: Math.max(50, Number.isFinite(maxAlt) ? maxAlt : 500),
    bodyWeightKg: 62,
    packWeightKg: distanceKm >= 16 ? 9 : 6,
    fitnessLevel: 'intermediate',
    toblerHoursDirect,
  });

  const safetyWarnings: string[] = [];
  if (!hasElevation) {
    safetyWarnings.push('File GPX gốc thiếu trường cao độ <ele> — hệ thống đang bổ sung dữ liệu DEM từ Open-Meteo.');
  }
  if (maxAlt >= 2500) {
    safetyWarnings.push(`Độ cao đỉnh ${maxAlt.toLocaleString()}m: chú ý sốc độ cao AMS và trang phục giữ nhiệt 3 lớp.`);
  }
  if (maxSlope >= 25 || steepSegmentsPercent >= 25) {
    safetyWarnings.push(`Có ${steepSegmentsPercent}% đoạn dốc >= 15% (cực đại ${maxSlope}%): cần gậy trekking và giày đế gai sâu.`);
  }
  if (safetyWarnings.length === 0) {
    safetyWarnings.push('Tracklog có thông số địa hình ổn định. Tải sẵn bản đồ Offline trước khi xuất phát.');
  }

  return {
    fileName: file.name,
    points: boundedPoints,
    hasElevation,
    offlineAnalysis: {
      fileName: file.name,
      pointCount: boundedPoints.length,
      elevationSource: hasElevation ? 'gpx-elevation' : 'interpolated-fallback',
      distanceKm,
      elevationGainM: Math.round(gainM),
      elevationLossM: Math.round(lossM),
      minAltitudeM: Number.isFinite(minAlt) ? Math.round(minAlt) : 0,
      maxAltitudeM: Number.isFinite(maxAlt) ? Math.round(maxAlt) : 0,
      avgGradePercent,
      maxSlopePercent: Math.round(maxSlope * 10) / 10,
      steepSegmentsPercent,
      estimatedDifficulty,
      difficultyLabel,
      startCoord: { lat: boundedPoints[0][0], lng: boundedPoints[0][1] },
      endCoord: { lat: boundedPoints[boundedPoints.length - 1][0], lng: boundedPoints[boundedPoints.length - 1][1] },
      elevationProfile: downsamplePoints(profile, 48),
      bioMetrics,
      nearestTrail: null,
      weatherAtStart: null,
      safetyWarnings,
      waterAdvice: `Dự kiến cần ~${bioMetrics.waterLitersTotal}L nước (${bioMetrics.waterLitersPerDay}L/ngày) + ${bioMetrics.oresolPackets} gói Oresol.`,
    },
  };
}
