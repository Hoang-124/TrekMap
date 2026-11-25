import crypto from 'crypto';
import { calculateHaversineDistanceKm } from '../utils/spatial.js';
import { fetchTrailDemElevation } from './elevation.service.js';
import { getLiveWeatherForecast } from './publicApis.service.js';
import { calculateAlpineBioMetrics, computeToblerSpeedKmH } from './aiBioCalculator.service.js';
import { mockTrails } from '../data/seedData.js';
import type { Trail } from '../types.js';
import type { AiFitnessLevel, GpxAnalysisResult, GpxElevationSample } from './ai.types.js';

export type RawGpxPoint = [number, number] | [number, number, number | null];

const MAX_ANALYZED_POINTS = 2000;
const GPX_DEM_CACHE_MAX = 100;
const GPX_DEM_CACHE_TTL_MS = 30 * 60 * 1000;
const gpxDemLocalCache = new Map<
  string,
  {
    expiry: number;
    points: Array<{ lat: number; lng: number; elevationM: number; distanceKm: number }>;
    source: GpxAnalysisResult['elevationSource'];
  }
>();

function uniformDownsampleRawPoints(raw: RawGpxPoint[], maxCount: number): RawGpxPoint[] {
  if (raw.length <= maxCount) return raw;
  const out: RawGpxPoint[] = [];
  for (let i = 0; i < maxCount; i++) {
    const idx = Math.round((i * (raw.length - 1)) / (maxCount - 1));
    out.push(raw[idx]);
  }
  return out;
}

function interpolateMissingElevations(raw: Array<number | null>): number[] {
  const firstValidIdx = raw.findIndex((v) => v !== null);
  if (firstValidIdx === -1) return raw.map(() => 0);

  const out: number[] = new Array(raw.length);
  for (let i = 0; i <= firstValidIdx; i++) {
    out[i] = raw[firstValidIdx] as number;
  }

  let prevIdx = firstValidIdx;
  for (let i = firstValidIdx + 1; i < raw.length; i++) {
    if (raw[i] !== null) {
      const startVal = raw[prevIdx] as number;
      const endVal = raw[i] as number;
      const span = i - prevIdx;
      for (let j = prevIdx + 1; j <= i; j++) {
        out[j] = startVal + ((endVal - startVal) * (j - prevIdx)) / span;
      }
      prevIdx = i;
    }
  }
  for (let i = prevIdx + 1; i < raw.length; i++) {
    out[i] = raw[prevIdx] as number;
  }
  return out;
}

export interface AnalyzeGpxParams {
  fileName?: string;
  points: RawGpxPoint[];
  bodyWeightKg?: number;
  packWeightKg?: number;
  fitnessLevel?: AiFitnessLevel;
  availableTrails?: Trail[];
}

function smoothElevations(raw: number[]): number[] {
  if (raw.length < 3) return raw;
  return raw.map((val, idx) => {
    if (idx === 0 || idx === raw.length - 1) return val;
    return Math.round((raw[idx - 1] * 0.25 + val * 0.5 + raw[idx + 1] * 0.25) * 10) / 10;
  });
}

function downsampleProfile(samples: GpxElevationSample[], maxCount = 48): GpxElevationSample[] {
  if (samples.length <= maxCount) return samples;
  const out: GpxElevationSample[] = [];
  for (let i = 0; i < maxCount; i++) {
    const idx = Math.round((i * (samples.length - 1)) / (maxCount - 1));
    out.push(samples[idx]);
  }
  return out;
}

function mapWmoLabel(code: number): string {
  if (code === 0) return 'Trời quang, nắng ráo';
  if (code <= 3) return 'Có mây rải rác';
  if (code === 45 || code === 48) return 'Sương mù dày';
  if (code >= 95) return 'Mưa giông có sấm sét';
  if (code <= 81) return 'Có mưa rải rác';
  return 'Mưa lớn / thời tiết xấu';
}

export async function analyzeGpxTrack(params: AnalyzeGpxParams): Promise<GpxAnalysisResult> {
  const fileName = String(params.fileName || 'tracklog.gpx').slice(0, 120);
  const fitnessLevel: AiFitnessLevel =
    params.fitnessLevel === 'beginner' || params.fitnessLevel === 'advanced'
      ? params.fitnessLevel
      : 'intermediate';

  // Filter valid geographic coordinates first, then uniformly downsample > 2000 points preserving start & end
  const validRawPoints: RawGpxPoint[] = [];
  for (const pt of params.points) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const lat = Number(pt[0]);
    const lng = Number(pt[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      continue;
    }
    validRawPoints.push(pt);
  }
  const sampledRaw = uniformDownsampleRawPoints(validRawPoints, MAX_ANALYZED_POINTS);
  const cleanPoints: Array<{ lat: number; lng: number; ele: number | null }> = sampledRaw.map((pt) => {
    const lat = Number(pt[0]);
    const lng = Number(pt[1]);
    const rawEle = pt.length >= 3 && pt[2] !== null && pt[2] !== undefined ? Number(pt[2]) : null;
    const ele = rawEle !== null && Number.isFinite(rawEle) && rawEle >= -100 && rawEle <= 9000 ? rawEle : null;
    return { lat, lng, ele };
  });

  if (cleanPoints.length < 2) {
    throw new Error('File GPX cần tối thiểu 2 điểm tọa độ GPS hợp lệ để phân tích.');
  }

  // Compute cumulative Haversine distance
  const cumDistancesKm: number[] = [0];
  for (let i = 1; i < cleanPoints.length; i++) {
    const segKm = calculateHaversineDistanceKm(
      cleanPoints[i - 1].lat,
      cleanPoints[i - 1].lng,
      cleanPoints[i].lat,
      cleanPoints[i].lng
    );
    // Ignore extreme GPS jump spikes > 5km in one hop unless sparse track (< 25 pts)
    const effectiveSeg = cleanPoints.length > 25 && segKm > 5 ? 0 : segKm;
    cumDistancesKm.push(cumDistancesKm[i - 1] + effectiveSeg);
  }
  const totalDistanceKm = Math.max(0.1, Math.round(cumDistancesKm[cumDistancesKm.length - 1] * 10) / 10);

  // Null-safe elevation span check (never converts null -> 0 before computing span!)
  const validEleValues = cleanPoints.filter((p) => p.ele !== null).map((p) => p.ele as number);
  const validEleCount = validEleValues.length;
  const eleSpan =
    validEleCount >= Math.max(2, Math.floor(cleanPoints.length * 0.6))
      ? Math.max(...validEleValues) - Math.min(...validEleValues)
      : 0;

  let workingElevations: number[] = [];
  let elevationSource: GpxAnalysisResult['elevationSource'] = 'gpx-elevation';
  let workingCoords: [number, number][] = cleanPoints.map((p) => [p.lat, p.lng]);
  let workingCumKm = cumDistancesKm;

  if (validEleCount >= Math.max(2, Math.floor(cleanPoints.length * 0.6)) && eleSpan >= 5) {
    // True linear interpolation across internal missing elevation samples (no flat-cliff jumps)
    const filled = interpolateMissingElevations(cleanPoints.map((p) => p.ele));
    workingElevations = smoothElevations(filled);
    elevationSource = 'gpx-elevation';
  } else {
    // Isolated SHA-1 cache key across start, midpoint & end coordinates so user GPX uploads never collide
    const midPt = cleanPoints[Math.floor(cleanPoints.length / 2)];
    const endPt = cleanPoints[cleanPoints.length - 1];
    const sig = `${cleanPoints[0].lat.toFixed(4)},${cleanPoints[0].lng.toFixed(4)}|${midPt.lat.toFixed(4)},${midPt.lng.toFixed(4)}|${endPt.lat.toFixed(4)},${endPt.lng.toFixed(4)}|${cleanPoints.length}|${totalDistanceKm}`;
    const isolatedKey = `gpx-usr-${crypto.createHash('sha1').update(sig).digest('hex').slice(0, 16)}`;

    const nowTs = Date.now();
    const cachedDem = gpxDemLocalCache.get(isolatedKey);
    if (cachedDem && cachedDem.expiry > nowTs && cachedDem.points.length >= 2) {
      workingCoords = cachedDem.points.map((p) => [p.lat, p.lng]);
      workingElevations = smoothElevations(cachedDem.points.map((p) => p.elevationM));
      workingCumKm = cachedDem.points.map((p) => p.distanceKm);
      elevationSource = cachedDem.source;
    } else {
      const dem = await fetchTrailDemElevation({
        cacheKey: isolatedKey,
        gpxTrack: workingCoords,
        distanceKm: totalDistanceKm,
        maxAltitudeM: 1200,
        elevationGainM: 450,
      });
      if (dem.points.length >= 2) {
        if (gpxDemLocalCache.size >= GPX_DEM_CACHE_MAX) {
          const oldest = gpxDemLocalCache.keys().next().value;
          if (oldest) gpxDemLocalCache.delete(oldest);
        }
        gpxDemLocalCache.set(isolatedKey, {
          expiry: nowTs + GPX_DEM_CACHE_TTL_MS,
          points: dem.points.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            elevationM: p.elevationM,
            distanceKm: p.distanceKm,
          })),
          source: dem.source,
        });
        workingCoords = dem.points.map((p) => [p.lat, p.lng]);
        workingElevations = smoothElevations(dem.points.map((p) => p.elevationM));
        workingCumKm = dem.points.map((p) => p.distanceKm);
        elevationSource = dem.source;
      } else {
        workingElevations = cleanPoints.map(() => 500);
        elevationSource = 'interpolated-fallback';
      }
    }
  }

  // Compute elevation gain/loss, slope grades & Tobler segment hours
  let elevationGainM = 0;
  let elevationLossM = 0;
  let minAltitudeM = Infinity;
  let maxAltitudeM = -Infinity;
  let maxSlopePercent = 0;
  let steepDistanceKm = 0;
  let gradeAbsSumWeighted = 0;
  let totalValidSegKm = 0;
  let toblerHoursDirect = 0;

  const fullProfile: GpxElevationSample[] = [];
  const GAIN_HYSTERESIS_M = 2; // Reduces GPS elevation noise inflation
  let lastAnchorEle = workingElevations[0] ?? 0;

  for (let i = 0; i < workingElevations.length; i++) {
    const ele = Math.round(workingElevations[i]);
    if (ele < minAltitudeM) minAltitudeM = ele;
    if (ele > maxAltitudeM) maxAltitudeM = ele;

    let slopePercent = 0;
    if (i > 0) {
      const prevEle = workingElevations[i - 1];
      const deltaEle = ele - prevEle;
      const segKm = Math.max(0.005, (workingCumKm[i] ?? 0) - (workingCumKm[i - 1] ?? 0));
      const segMeters = Math.max(20, segKm * 1000);

      if (ele - lastAnchorEle >= GAIN_HYSTERESIS_M) {
        elevationGainM += ele - lastAnchorEle;
        lastAnchorEle = ele;
      } else if (lastAnchorEle - ele >= GAIN_HYSTERESIS_M) {
        elevationLossM += lastAnchorEle - ele;
        lastAnchorEle = ele;
      }

      const rawSlope = deltaEle / segMeters;
      slopePercent = Math.max(-65, Math.min(65, Math.round(rawSlope * 1000) / 10));
      const absGrade = Math.abs(slopePercent);
      if (absGrade > maxSlopePercent) maxSlopePercent = absGrade;
      if (absGrade >= 15) steepDistanceKm += segKm;
      gradeAbsSumWeighted += absGrade * segKm;
      totalValidSegKm += segKm;

      const toblerSpeed = computeToblerSpeedKmH(rawSlope, fitnessLevel);
      toblerHoursDirect += segKm / toblerSpeed;
    }

    fullProfile.push({
      distanceKm: Math.round((workingCumKm[i] ?? 0) * 100) / 100,
      elevationM: ele,
      slopePercent,
    });
  }

  elevationGainM = Math.round(elevationGainM);
  elevationLossM = Math.round(elevationLossM);
  minAltitudeM = Number.isFinite(minAltitudeM) ? Math.round(minAltitudeM) : 0;
  maxAltitudeM = Number.isFinite(maxAltitudeM) ? Math.round(maxAltitudeM) : 0;
  const avgGradePercent = totalValidSegKm > 0 ? Math.round((gradeAbsSumWeighted / totalValidSegKm) * 10) / 10 : 0;
  const steepSegmentsPercent = totalValidSegKm > 0 ? Math.round((steepDistanceKm / totalValidSegKm) * 100) : 0;

  // Estimate alpine difficulty (1..5) from distance + elevation gain + steepness + max altitude
  const effortIndex =
    totalDistanceKm * 1.1 +
    (elevationGainM / 100) * 2.4 +
    (maxAltitudeM >= 2500 ? 6 : maxAltitudeM >= 1800 ? 3 : 0) +
    (steepSegmentsPercent >= 30 ? 4 : 0);

  let estimatedDifficulty = 1;
  let difficultyLabel = 'Rất dễ (Dã ngoại nhẹ)';
  if (effortIndex >= 48) {
    estimatedDifficulty = 5;
    difficultyLabel = 'Cực khó (Thử thách cao độ / Dài ngày)';
  } else if (effortIndex >= 34) {
    estimatedDifficulty = 4;
    difficultyLabel = 'Khó (Yêu cầu thể lực tốt & kỹ năng dốc)';
  } else if (effortIndex >= 22) {
    estimatedDifficulty = 3;
    difficultyLabel = 'Trung bình - Khá (Phù hợp người có nền thể lực)';
  } else if (effortIndex >= 12) {
    estimatedDifficulty = 2;
    difficultyLabel = 'Trung bình - Dễ (Phù hợp người mới tập)';
  }

  const startCoord = { lat: cleanPoints[0].lat, lng: cleanPoints[0].lng };
  const endCoord = { lat: cleanPoints[cleanPoints.length - 1].lat, lng: cleanPoints[cleanPoints.length - 1].lng };

  // Find nearest verified LOST Vietnam trail
  const trails = params.availableTrails && params.availableTrails.length > 0 ? params.availableTrails : mockTrails;
  let nearestTrail: GpxAnalysisResult['nearestTrail'] = null;
  let bestDist = Infinity;
  for (const t of trails) {
    const d = calculateHaversineDistanceKm(startCoord.lat, startCoord.lng, t.startLat, t.startLng);
    if (d < bestDist) {
      bestDist = d;
      nearestTrail = {
        id: t.id,
        name: t.name,
        province: t.province,
        distanceFromStartKm: Math.round(d * 10) / 10,
      };
    }
  }
  if (nearestTrail && nearestTrail.distanceFromStartKm > 60) {
    nearestTrail = null;
  }

  // Fetch live MET Norway (CC BY 4.0) weather at trailhead (best-effort)
  let weatherAtStart: GpxAnalysisResult['weatherAtStart'] = null;
  let ambientTempC: number | undefined;
  try {
    const live = await getLiveWeatherForecast(startCoord.lat, startCoord.lng);
    if (live?.daily?.time?.length) {
      const tMin = Math.round(Number(live.daily.temperature_2m_min?.[0] ?? 16));
      const tMax = Math.round(Number(live.daily.temperature_2m_max?.[0] ?? 24));
      const precip = Math.round(Number(live.daily.precipitation_sum?.[0] ?? 0) * 10) / 10;
      const wind = Math.round(Number(live.daily.windspeed_10m_max?.[0] ?? 10));
      const code = Number(live.daily.weathercode?.[0] ?? 0);
      weatherAtStart = {
        tempMinC: tMin,
        tempMaxC: tMax,
        precipMm: precip,
        windSpeedKmH: wind,
        conditionLabel: mapWmoLabel(code),
      };
      ambientTempC = Math.round((tMin + tMax) / 2);
    }
  } catch {
    // Offline gracefully
  }

  const durationDays = totalDistanceKm >= 18 || elevationGainM >= 1300 ? Math.min(4, Math.ceil(totalDistanceKm / 12)) : 1;
  const bioMetrics = calculateAlpineBioMetrics(
    {
      trailName: fileName.replace(/\.gpx$/i, ''),
      distanceKm: totalDistanceKm,
      elevationGainM,
      elevationLossM,
      maxAltitudeM: Math.max(50, maxAltitudeM),
      bodyWeightKg: params.bodyWeightKg,
      packWeightKg: params.packWeightKg,
      fitnessLevel,
      ambientTempC,
      durationDays,
    },
    { toblerHoursDirect }
  );

  // Build tactical Vietnam alpine warnings
  const safetyWarnings: string[] = [];
  if (maxAltitudeM >= 2500) {
    safetyWarnings.push(`Độ cao tối đa ${maxAltitudeM.toLocaleString()}m: lưu ý sốc độ cao AMS, nhiệt độ đêm giảm mạnh và giữ ấm theo quy tắc 3 lớp.`);
  }
  if (maxSlopePercent >= 25 || steepSegmentsPercent >= 25) {
    safetyWarnings.push(`Track có ${steepSegmentsPercent}% đoạn dốc gắt >= 15% (cực đại ${maxSlopePercent}%): bắt buộc mang gậy trekking và giày đế gai bám tốt.`);
  }
  if (totalDistanceKm >= 18) {
    safetyWarnings.push(`Cự ly dài (${totalDistanceKm} km, ước tính ${bioMetrics.estimatedTotalTripHours} giờ gồm nghỉ): mang đèn pin đội đầu + pin dự phòng phòng xuống núi muộn.`);
  }
  if (weatherAtStart && weatherAtStart.precipMm >= 10) {
    safetyWarnings.push(`Thời tiết điểm xuất phát đang có mưa (${weatherAtStart.precipMm} mm): đề phòng trơn trượt, vắt rừng và lũ quét khe suối.`);
  }
  if (safetyWarnings.length === 0) {
    safetyWarnings.push('Địa hình tracklog ở mức ổn định. Luôn tải sẵn bản đồ Offline và giữ cự ly nhóm an toàn.');
  }

  const waterAdvice = `Dự kiến cần tổng ${bioMetrics.waterLitersTotal}L nước (${bioMetrics.waterLitersPerDay}L/ngày) kèm ${bioMetrics.oresolPackets} gói Oresol. Nên mang theo màng lọc Sawyer hoặc viên lọc Aquatabs nếu có điểm tiếp nước suối dọc tuyến.`;

  return {
    fileName,
    pointCount: cleanPoints.length,
    elevationSource,
    distanceKm: totalDistanceKm,
    elevationGainM,
    elevationLossM,
    minAltitudeM,
    maxAltitudeM,
    avgGradePercent,
    maxSlopePercent,
    steepSegmentsPercent,
    estimatedDifficulty,
    difficultyLabel,
    startCoord,
    endCoord,
    elevationProfile: downsampleProfile(fullProfile, 48),
    bioMetrics,
    nearestTrail,
    weatherAtStart,
    safetyWarnings,
    waterAdvice,
  };
}
