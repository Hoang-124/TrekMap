import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { WeatherForecastModel } from '../models/WeatherForecast.js';
import { TrailModel } from '../models/Trail.js';
import { mockTrails } from '../data/seedData.js';
import {
  getLiveWeatherForecast,
  getSunriseSunsetData,
  MET_NORWAY_ATTRIBUTION,
  type NormalizedLiveWeatherPayload,
} from '../services/publicApis.service.js';
import { resolveTrailByIdOrSlug } from '../utils/resolveTrail.js';

const NASA_POWER_ATTRIBUTION = 'Climate archive: NASA POWER (Public Domain)';

type WeatherCondition = 'clear' | 'cloudy' | 'foggy' | 'rainy' | 'storm';

function mapWmoToCondition(code: number, wind = 10, precip = 0): WeatherCondition {
  if (code === 0) return 'clear';
  if (code >= 1 && code <= 3) return 'cloudy';
  if (code === 45 || code === 48) return 'foggy';
  if (code >= 51 && code <= 81) return 'rainy';
  if (code >= 82) return wind >= 45 || precip >= 20 ? 'storm' : 'rainy';
  return 'cloudy';
}

function computeSeaOfCloudsIndex(maxAlt: number, humidity: number, wind: number, condition: WeatherCondition): number {
  if (maxAlt < 1200) return Math.min(35, Math.round(humidity * 0.25));
  if (condition === 'storm') return 5;
  if (condition === 'rainy') return Math.min(25, Math.round(humidity * 0.2));
  if (wind >= 38) return Math.min(30, Math.round(humidity * 0.3));

  // Ideal sea-of-clouds window: high peak >=1800m, high valley humidity (75-95%), calm wind (<20km/h), clear/cloudy/foggy
  const altFactor = maxAlt >= 2400 ? 1.0 : maxAlt >= 1800 ? 0.92 : 0.65;
  const windPenalty = wind > 20 ? Math.min(30, (wind - 20) * 1.5) : 0;
  const raw = Math.round(humidity * altFactor - windPenalty);
  return Math.max(5, Math.min(95, raw));
}

function mapDailyForecasts(liveMeteo: any, trailIdValue: any, maxAlt: number) {
  const daily = liveMeteo.daily;
  return daily.time.map((timeStr: string, i: number) => {
    const code = daily.weathercode?.[i] ?? 0;
    const wind = Math.round(daily.windspeed_10m_max?.[i] ?? 10);
    const precip = daily.precipitation_sum?.[i] ?? 0;
    const humidity = daily.relative_humidity_2m_max?.[i] ?? 75;
    const condition = mapWmoToCondition(code, wind, precip);
    const seaOfClouds = computeSeaOfCloudsIndex(maxAlt, humidity, wind, condition);

    return {
      trailId: trailIdValue,
      forecastDate: timeStr,
      tempMinC: Math.round(daily.temperature_2m_min?.[i] ?? 12),
      tempMaxC: Math.round(daily.temperature_2m_max?.[i] ?? 20),
      humidityPercent: humidity,
      windSpeedKmH: wind,
      cloudCoverPercent: Math.round(precip > 0 ? 80 : code > 0 ? 45 : 15),
      seaOfCloudsIndex: seaOfClouds,
      weatherCondition: condition,
      precipMm: precip,
      wmoCode: code,
    };
  });
}

function buildCurrentSnapshot(liveMeteo: any, today: any) {
  const temp = liveMeteo?.current_weather?.temperature ?? today?.tempMaxC ?? 20;
  const windspeed = liveMeteo?.current_weather?.windspeed ?? today?.windSpeedKmH ?? 10;
  const weathercode = liveMeteo?.current_weather?.weathercode ?? today?.wmoCode ?? 0;
  const condition = mapWmoToCondition(Number(weathercode), Number(windspeed), Number(today?.precipMm || 0));

  return {
    // Include BOTH tempC+condition (consumed by MapView.tsx) and temp+weathercode (backward compat)
    tempC: Math.round(Number(temp) * 10) / 10,
    condition,
    temp: Math.round(Number(temp) * 10) / 10,
    windspeed: Math.round(Number(windspeed) * 10) / 10,
    weathercode: Number(weathercode),
    humidity: today?.humidityPercent ?? 75,
  };
}

function buildWarning(forecasts: any[]) {
  const warningDetail = forecasts.find(
    (f: any) => f.weatherCondition === 'storm' || f.windSpeedKmH >= 55 || f.tempMinC <= 2
  );
  const hasWarning = !!warningDetail;
  const warningMessage = hasWarning
    ? `Cảnh báo thời tiết xấu vào ngày ${warningDetail?.forecastDate}: ${
        warningDetail?.weatherCondition === 'storm'
          ? 'Mưa bão giật mạnh'
          : warningDetail?.windSpeedKmH && warningDetail.windSpeedKmH >= 55
            ? `Gió núi mạnh ${warningDetail.windSpeedKmH} km/h`
            : `Nhiệt độ hạ rất thấp (${warningDetail?.tempMinC}°C)`
      }. Cân nhắc kiểm tra lại lịch trình!`
    : null;
  return { hasWarning, warningMessage };
}

/**
 * GET /api/weather/forecast?lat=...&lng=...
 * Returns live weather forecast + `current` snapshot (with tempC & condition) for MapView popups & Survival Toolkit.
 */
export const getWeatherByCoordinates = async (req: Request, res: Response) => {
  try {
    const rawLat = req.query.lat;
    const rawLng = req.query.lng;
    if (
      rawLat === undefined ||
      rawLng === undefined ||
      typeof rawLat !== 'string' ||
      typeof rawLng !== 'string' ||
      !rawLat.trim() ||
      !rawLng.trim()
    ) {
      return res.status(400).json({ success: false, message: 'Tọa độ lat/lng không hợp lệ.' });
    }
    const lat = Number(rawLat.trim());
    const lng = Number(rawLng.trim());

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, message: 'Tọa độ lat/lng không hợp lệ.' });
    }

    const [liveMeteo, astroData] = await Promise.all([
      getLiveWeatherForecast(lat, lng),
      getSunriseSunsetData(lat, lng),
    ]);

    if (!liveMeteo?.daily?.time) {
      return res.status(503).json({
        success: false,
        message: 'Dịch vụ dự báo thời tiết tạm thời gián đoạn. Vui lòng thử lại sau.',
      });
    }

    const forecasts = mapDailyForecasts(liveMeteo, `${lat.toFixed(3)},${lng.toFixed(3)}`, liveMeteo.elevation || 1200);
    const today = forecasts[0];
    const current = buildCurrentSnapshot(liveMeteo, today);
    const { hasWarning, warningMessage } = buildWarning(forecasts);

    return res.json({
      success: true,
      data: {
        current,
        daily: forecasts,
      },
      current,
      forecasts,
      astroData,
      elevationM: liveMeteo.elevation || 0,
      source: 'MET Norway Locationforecast 2.0 (CC BY 4.0) + NOAA Solar (Local)',
      attribution: MET_NORWAY_ATTRIBUTION,
      hasWarning,
      warningMessage,
    });
  } catch (err) {
    console.error('[Weather Coordinates Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể tải dữ liệu thời tiết.' });
  }
};

export const getWeatherByTrailId = async (req: Request, res: Response) => {
  try {
    const trailId = String(req.params.trailId || '').trim();
    if (!trailId) {
      return res.status(400).json({ success: false, message: 'Thiếu mã cung đường.' });
    }

    let trail: any = await resolveTrailByIdOrSlug(trailId);
    if (!trail) {
      trail = mockTrails.find((t) => t.id === trailId);
    }

    if (!trail) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường để tra cứu thời tiết.' });
    }

    // Prefer summit/destination coordinates when available for accurate mountain weather
    const lat = Number.isFinite(Number(trail.endLat)) ? Number(trail.endLat) : Number(trail.startLat);
    const lng = Number.isFinite(Number(trail.endLng)) ? Number(trail.endLng) : Number(trail.startLng);
    const dbTrailObjId = trail._id && mongoose.Types.ObjectId.isValid(String(trail._id)) ? trail._id : null;

    const [liveMeteo, astroData] = await Promise.all([
      getLiveWeatherForecast(lat, lng),
      getSunriseSunsetData(lat, lng),
    ]);

    let forecasts: any[] = [];

    if (liveMeteo && liveMeteo.daily && liveMeteo.daily.time) {
      forecasts = mapDailyForecasts(liveMeteo, dbTrailObjId || trailId, trail.maxAltitudeM || 1500);

      if (mongoose.connection.readyState === 1 && dbTrailObjId) {
        const bulkOps = forecasts.map((f: any) => ({
          updateOne: {
            filter: { trailId: dbTrailObjId, forecastDate: f.forecastDate },
            update: {
              $set: {
                tempMinC: f.tempMinC,
                tempMaxC: f.tempMaxC,
                humidityPercent: f.humidityPercent,
                windSpeedKmH: f.windSpeedKmH,
                cloudCoverPercent: f.cloudCoverPercent,
                seaOfCloudsIndex: f.seaOfCloudsIndex,
                weatherCondition: f.weatherCondition,
              },
            },
            upsert: true,
          },
        }));
        WeatherForecastModel.bulkWrite(bulkOps, { ordered: false }).catch(() => {});
      }
    } else if (mongoose.connection.readyState === 1 && dbTrailObjId) {
      const todayStr = new Date().toISOString().split('T')[0];
      forecasts = await WeatherForecastModel.find({
        trailId: dbTrailObjId,
        forecastDate: { $gte: todayStr },
      })
        .sort({ forecastDate: 1 })
        .limit(7)
        .lean()
        .exec();
    }

    if (forecasts.length === 0) {
      return res.status(503).json({
        success: false,
        message: 'Chưa thể tải dự báo thời tiết trực tuyến lúc này. Vui lòng thử lại sau.',
      });
    }

    const { hasWarning, warningMessage } = buildWarning(forecasts);
    const today = forecasts[0];
    const current = buildCurrentSnapshot(liveMeteo, today);

    return res.json({
      success: true,
      data: forecasts,
      current,
      astroData,
      elevationM: liveMeteo?.elevation || trail.maxAltitudeM || 1400,
      source: liveMeteo ? 'MET Norway Locationforecast 2.0 (CC BY 4.0) + NOAA Solar (Local)' : 'Cached DB Fallback',
      attribution: MET_NORWAY_ATTRIBUTION,
      hasWarning,
      warningMessage,
    });
  } catch (err) {
    console.error('[Weather Controller Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể tải dữ liệu dự báo thời tiết.' });
  }
};

// =========================================================================
// LIVE VIETNAM TOP 12 ALPINE SUMMITS WEATHER & SEA-OF-CLOUDS RADAR (15-min SWR)
// =========================================================================

export interface SummitLiveTelemetry {
  trailId: string;
  name: string;
  province: string;
  region: string;
  maxAltitudeM: number;
  gridElevationM: number;
  lapseDropC: number;
  coordinates: { lat: number; lng: number };
  gridTempC: number;
  summitTempC: number;
  summitTempMinC: number;
  summitTempMaxC: number;
  windChillC: number;
  windSpeedKmH: number;
  humidityPercent: number;
  cloudCoverPercent: number;
  precipMmToday: number;
  wmoCode: number;
  condition: WeatherCondition;
  conditionLabel: string;
  seaOfCloudsPercent: number;
  tomorrowSeaOfCloudsPercent: number;
  weatherTier: 'ideal' | 'caution' | 'danger';
  advisory: string;
}

interface SummitsCachePayload {
  fetchedAt: string;
  expiresAt: string;
  fetchedAtMs: number;
  source: string;
  peaks: SummitLiveTelemetry[];
}

const SUMMITS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min (MET Norway compliance)
const SUMMITS_STALE_GRACE_MS = 90 * 60 * 1000;
const VALID_SUMMIT_REGIONS = new Set(['Miền Bắc', 'Miền Trung', 'Miền Nam']);

let summitsCache: SummitsCachePayload | null = null;
let summitsInFlight: Promise<SummitsCachePayload | null> | null = null;

function mapWmoToVietnameseLabel(code: number): string {
  if (code === 0) return 'Trời quang, nắng ráo';
  if (code <= 3) return 'Có mây rải rác';
  if (code === 45 || code === 48) return 'Sương mù dày';
  if (code >= 95) return 'Mưa giông sấm sét';
  if (code >= 80) return 'Mưa rào / mưa lớn';
  if (code >= 51) return 'Có mưa nhẹ / mưa phùn';
  return 'Có mây';
}

function computeWindChillC(tempC: number, windKmH: number): number {
  if (tempC > 10 || windKmH < 4.8) return Math.round(tempC * 10) / 10;
  const vPow = Math.pow(windKmH, 0.16);
  const wc = 13.12 + 0.6215 * tempC - 11.37 * vPow + 0.3965 * tempC * vPow;
  return Math.round(wc * 10) / 10;
}

function buildSummitAdvisory(tier: 'ideal' | 'caution' | 'danger', windChillC: number, windKmH: number, precipMm: number, cloudPct: number): string {
  if (tier === 'danger') {
    if (precipMm >= 25) return 'Cảnh báo mưa lớn, nguy cơ lũ quét & sạt lở';
    if (windKmH >= 45) return `Gió giật mạnh ${windKmH} km/h trên sống núi`;
    if (windChillC <= 0) return `Băng giá / gió rét ${windChillC}°C — nguy cơ hạ thân nhiệt`;
    return 'Thời tiết cực đoan — khuyến cáo hoãn leo đỉnh';
  }
  if (tier === 'caution') {
    if (windChillC <= 6) return `Đỉnh lạnh sâu (${windChillC}°C) — mang áo lông vũ & gió`;
    if (precipMm >= 5) return `Có mưa ${precipMm} mm — đường trơn, mang áo mưa bộ`;
    return 'Gió khá mạnh / nhiều mây — kiểm tra Go/No-Go trước khi đi';
  }
  if (cloudPct >= 75) return `Điều kiện săn biển mây lý tưởng (${cloudPct}%)`;
  return 'Thời tiết thuận lợi cho hành trình chinh phục đỉnh';
}

async function loadTop12AlpinePeaks() {
  if (mongoose.connection.readyState === 1) {
    try {
      const dbTrails = await TrailModel.find({ status: 'approved' })
        .select('id name province region maxAltitudeM startLat startLng endLat endLng')
        .sort({ maxAltitudeM: -1 })
        .limit(12)
        .lean()
        .maxTimeMS(1500);
      if (dbTrails.length >= 8) {
        return dbTrails.map((t: any) => ({
          trailId: String(t.id || t._id),
          name: String(t.name),
          province: String(t.province || ''),
          region: String(t.region || 'Miền Bắc'),
          maxAltitudeM: Number(t.maxAltitudeM) || 1500,
          lat: Number.isFinite(Number(t.endLat)) ? Number(t.endLat) : Number(t.startLat),
          lng: Number.isFinite(Number(t.endLng)) ? Number(t.endLng) : Number(t.startLng),
        }));
      }
    } catch {
      // Fallback to verified seed catalog
    }
  }
  return [...mockTrails]
    .sort((a, b) => (Number(b.maxAltitudeM) || 0) - (Number(a.maxAltitudeM) || 0))
    .slice(0, 12)
    .map((t) => ({
      trailId: t.id,
      name: t.name,
      province: t.province,
      region: t.region,
      maxAltitudeM: Number(t.maxAltitudeM) || 1500,
      lat: Number.isFinite(Number(t.endLat)) ? Number(t.endLat) : Number(t.startLat),
      lng: Number.isFinite(Number(t.endLng)) ? Number(t.endLng) : Number(t.startLng),
    }));
}

async function fetchLiveSummitsBatch(): Promise<SummitsCachePayload | null> {
  const peaksMeta = await loadTop12AlpinePeaks();
  if (peaksMeta.length === 0) return null;

  // Bounded-concurrency MET Norway Locationforecast 2.0 fetches (reuses 45-min cache per coordinate)
  const CONCURRENCY = 4;
  const batchEntries: Array<NormalizedLiveWeatherPayload | null> = new Array(peaksMeta.length).fill(null);
  for (let i = 0; i < peaksMeta.length; i += CONCURRENCY) {
    const slice = peaksMeta.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(slice.map((p) => getLiveWeatherForecast(p.lat, p.lng)));
    settled.forEach((entry, offset) => {
      batchEntries[i + offset] = entry;
    });
  }

  // Strictly reject partial/truncated MET Norway batches so fake fallback weather is never fabricated or cached
  const allValid =
    batchEntries.length === peaksMeta.length &&
    batchEntries.every(
      (entry) =>
        entry &&
        entry.daily &&
        Array.isArray(entry.daily.time) &&
        entry.daily.time.length > 0 &&
        Array.isArray(entry.daily.temperature_2m_max) &&
        entry.daily.temperature_2m_max.length > 0
    );
  if (!allValid) return null;

  const peaks: SummitLiveTelemetry[] = peaksMeta.map((meta, idx) => {
    const entry = batchEntries[idx]!;
    const cur = entry.current || {};
    const daily = entry.daily || {};

    const gridElevationM = Number.isFinite(Number(entry.elevation)) ? Math.round(Number(entry.elevation)) : Math.round(meta.maxAltitudeM * 0.65);
    const deltaM = Math.max(0, meta.maxAltitudeM - gridElevationM);
    const lapseDropC = Math.round((deltaM / 1000) * 6.5 * 10) / 10;

    const gridTempC = Number.isFinite(Number(cur.temperature_2m))
      ? Math.round(Number(cur.temperature_2m) * 10) / 10
      : Math.round(Number(daily.temperature_2m_max?.[0] ?? 18) * 10) / 10;
    const dailyMinGridC = Number.isFinite(Number(daily.temperature_2m_min?.[0])) ? Number(daily.temperature_2m_min[0]) : gridTempC - 4;
    const dailyMaxGridC = Number.isFinite(Number(daily.temperature_2m_max?.[0])) ? Number(daily.temperature_2m_max[0]) : gridTempC + 3;

    const summitTempC = Math.round((gridTempC - lapseDropC) * 10) / 10;
    const summitTempMinC = Math.round((dailyMinGridC - lapseDropC) * 10) / 10;
    const summitTempMaxC = Math.round((dailyMaxGridC - lapseDropC) * 10) / 10;

    const windSpeedKmH = Math.round(Number(cur.wind_speed_10m ?? daily.wind_speed_10m_max?.[0] ?? 12));
    const humidityPercent = Math.round(Number(cur.relative_humidity_2m ?? daily.relative_humidity_2m_max?.[0] ?? 78));
    const cloudCoverPercent = Math.round(Number(cur.cloud_cover ?? 45));
    const precipMmToday = Math.round(Number(daily.precipitation_sum?.[0] ?? 0) * 10) / 10;
    const wmoCode = Number(cur.weather_code ?? daily.weather_code?.[0] ?? 1);
    const condition = mapWmoToCondition(wmoCode, windSpeedKmH, precipMmToday);
    const windChillC = computeWindChillC(summitTempC, windSpeedKmH);

    const seaOfCloudsPercent = computeSeaOfCloudsIndex(meta.maxAltitudeM, humidityPercent, windSpeedKmH, condition);
    const tomWmo = Number(daily.weather_code?.[1] ?? wmoCode);
    const tomWind = Math.round(Number(daily.wind_speed_10m_max?.[1] ?? windSpeedKmH));
    const tomPrecip = Number(daily.precipitation_sum?.[1] ?? 0);
    const tomHum = Math.round(Number(daily.relative_humidity_2m_max?.[1] ?? humidityPercent));
    const tomCond = mapWmoToCondition(tomWmo, tomWind, tomPrecip);
    const tomorrowSeaOfCloudsPercent = computeSeaOfCloudsIndex(meta.maxAltitudeM, tomHum, tomWind, tomCond);

    const weatherTier: 'ideal' | 'caution' | 'danger' =
      condition === 'storm' || wmoCode >= 95 || precipMmToday >= 25 || windSpeedKmH >= 45 || windChillC <= 0
        ? 'danger'
        : condition === 'rainy' || precipMmToday >= 5 || windSpeedKmH >= 30 || windChillC <= 6
          ? 'caution'
          : 'ideal';

    return {
      trailId: meta.trailId,
      name: meta.name,
      province: meta.province,
      region: meta.region,
      maxAltitudeM: meta.maxAltitudeM,
      gridElevationM,
      lapseDropC,
      coordinates: { lat: meta.lat, lng: meta.lng },
      gridTempC,
      summitTempC,
      summitTempMinC,
      summitTempMaxC,
      windChillC,
      windSpeedKmH,
      humidityPercent,
      cloudCoverPercent,
      precipMmToday,
      wmoCode,
      condition,
      conditionLabel: mapWmoToVietnameseLabel(wmoCode),
      seaOfCloudsPercent,
      tomorrowSeaOfCloudsPercent,
      weatherTier,
      advisory: buildSummitAdvisory(weatherTier, windChillC, windSpeedKmH, precipMmToday, seaOfCloudsPercent),
    };
  });

  const nowMs = Date.now();
  return {
    fetchedAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + SUMMITS_CACHE_TTL_MS).toISOString(),
    fetchedAtMs: nowMs,
    source: 'MET Norway Locationforecast 2.0 (CC BY 4.0)',
    peaks,
  };
}

function summarizeSummits(peaks: SummitLiveTelemetry[]) {
  const bestCloud = peaks.reduce<SummitLiveTelemetry | null>(
    (best, p) => (!best || p.seaOfCloudsPercent > best.seaOfCloudsPercent ? p : best),
    null
  );
  const coldest = peaks.reduce<SummitLiveTelemetry | null>(
    (cold, p) => (!cold || p.summitTempC < cold.summitTempC ? p : cold),
    null
  );
  const warningCount = peaks.filter((p) => p.weatherTier === 'danger' || p.weatherTier === 'caution').length;
  return {
    totalPeaks: peaks.length,
    bestCloudPeak: bestCloud
      ? { trailId: bestCloud.trailId, name: bestCloud.name, seaOfCloudsPercent: bestCloud.seaOfCloudsPercent }
      : null,
    coldestPeak: coldest
      ? { trailId: coldest.trailId, name: coldest.name, summitTempC: coldest.summitTempC, windChillC: coldest.windChillC }
      : null,
    warningCount,
  };
}

/**
 * GET /api/weather/summits-live?region=
 * 30-min cached live MET Norway Locationforecast 2.0 summit temperature, lapse-rate, wind-chill & Sea-of-Clouds % for Vietnam's Top 12 Alpine Peaks.
 */
export const getLiveSummitsWeather = async (req: Request, res: Response) => {
  try {
    const regionFilter =
      typeof req.query.region === 'string' && VALID_SUMMIT_REGIONS.has(req.query.region) ? req.query.region : '';
    const nowMs = Date.now();

    let payload: SummitsCachePayload | null = null;
    let servedFromCache = false;
    let sourceLabel = 'MET Norway Locationforecast 2.0 (CC BY 4.0)';

    if (summitsCache && nowMs - summitsCache.fetchedAtMs < SUMMITS_CACHE_TTL_MS) {
      payload = summitsCache;
      servedFromCache = true;
    } else {
      if (!summitsInFlight) {
        summitsInFlight = fetchLiveSummitsBatch()
          .then((fresh) => {
            if (fresh) summitsCache = fresh;
            return fresh;
          })
          .catch(() => null)
          .finally(() => {
            summitsInFlight = null;
          });
      }
      const fresh = await summitsInFlight;
      if (fresh) {
        payload = fresh;
        servedFromCache = false;
      } else if (summitsCache && nowMs - summitsCache.fetchedAtMs < SUMMITS_STALE_GRACE_MS) {
        payload = summitsCache;
        servedFromCache = true;
        sourceLabel = 'Stale Cache Fallback';
      }
    }

    if (!payload) {
      return res.status(503).json({
        success: false,
        message: 'Dịch vụ Radar Thời tiết Đỉnh Núi tạm thời gián đoạn. Vui lòng thử lại sau.',
      });
    }

    const filteredPeaks = regionFilter ? payload.peaks.filter((p) => p.region === regionFilter) : payload.peaks;

    return res.json({
      success: true,
      cached: servedFromCache,
      fetchedAt: payload.fetchedAt,
      expiresAt: payload.expiresAt,
      source: sourceLabel,
      attribution: MET_NORWAY_ATTRIBUTION,
      summary: summarizeSummits(filteredPeaks),
      data: filteredPeaks,
    });
  } catch (err) {
    console.error('[Live Summits Weather Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải Radar thời tiết đỉnh núi.' });
  }
};

// =========================================================================
// MULTI-TRAIL 3-DAY SUMMIT WEATHER COMPARE (MET NORWAY LOCATIONFORECAST 2.0)
// =========================================================================

export interface MultiTrailCompareDay {
  date: string;
  gridTempMinC: number;
  gridTempMaxC: number;
  summitTempMinC: number;
  summitTempMaxC: number;
  windChillC: number;
  precipMm: number;
  windSpeedKmH: number;
  humidityPercent: number;
  wmoCode: number;
  condition: WeatherCondition;
  conditionLabel: string;
  seaOfCloudsPercent: number;
  weatherTier: 'ideal' | 'caution' | 'danger';
}

export interface MultiTrailCompareItem {
  trailId: string;
  name: string;
  province: string;
  region: string;
  maxAltitudeM: number;
  gridElevationM: number;
  lapseDropC: number;
  weatherScore: number;
  bestSeaOfCloudsPercent: number;
  worstTier: 'ideal' | 'caution' | 'danger';
  days: MultiTrailCompareDay[];
}

interface CompareCacheEntry {
  fetchedAt: string;
  fetchedAtMs: number;
  itemsById: Map<string, MultiTrailCompareItem>;
}

const COMPARE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min canonical sorted-ID cache (MET Norway compliance)
const COMPARE_CACHE_MAX_ENTRIES = 200;
const compareWeatherCache = new Map<string, CompareCacheEntry>();

function setCompareWeatherCache(key: string, entry: CompareCacheEntry) {
  const nowMs = Date.now();
  if (compareWeatherCache.size >= COMPARE_CACHE_MAX_ENTRIES) {
    for (const [k, v] of compareWeatherCache.entries()) {
      if (nowMs - v.fetchedAtMs >= COMPARE_CACHE_TTL_MS) compareWeatherCache.delete(k);
    }
    if (compareWeatherCache.size >= COMPARE_CACHE_MAX_ENTRIES) {
      const oldestKey = compareWeatherCache.keys().next().value;
      if (oldestKey) compareWeatherCache.delete(oldestKey);
    }
  }
  compareWeatherCache.delete(key);
  compareWeatherCache.set(key, entry);
}

/**
 * GET /api/weather/compare?ids=trail-fansipan,trail-taxua,...
 * Accepts 1-4 approved trail slugs/IDs, fetches 3-day MET Norway Locationforecast 2.0 forecasts across summit coordinates,
 * uses a canonical sorted-ID internal cache (so ?ids=a,b and ?ids=b,a share 1 entry),
 * applies residual alpine lapse rate (-6.5°C/1000m), NWS windchill & storm-safe Sea-of-Clouds %.
 */
export const compareMultiTrailWeather = async (req: Request, res: Response) => {
  try {
    const rawIds = req.query.ids;
    const rawList = Array.isArray(rawIds)
      ? rawIds.flatMap((v) => String(v).split(','))
      : typeof rawIds === 'string'
        ? rawIds.split(',')
        : [];
    const requestedIds = Array.from(
      new Set(rawList.map((s) => s.trim()).filter((s) => s.length > 0 && s.length <= 80))
    ).slice(0, 4);

    if (requestedIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng truyền danh sách 1–4 mã cung đường qua tham số ?ids=a,b,c.',
      });
    }

    const resolvedRaw = await Promise.all(
      requestedIds.map(async (id) => {
        const dbTrail: any = await resolveTrailByIdOrSlug(id).catch(() => null);
        if (dbTrail) {
          return !dbTrail.status || dbTrail.status === 'approved' ? dbTrail : null;
        }
        return mockTrails.find((t) => t.id === id) || null;
      })
    );

    const seenTrailKeys = new Set<string>();
    const trails: any[] = [];
    for (const raw of resolvedRaw) {
      if (!raw) continue;
      const t = raw as any;
      const key = String(t.id || t._id);
      if (seenTrailKeys.has(key)) continue;
      const lat = Number.isFinite(Number(t.endLat)) ? Number(t.endLat) : Number(t.startLat);
      const lng = Number.isFinite(Number(t.endLng)) ? Number(t.endLng) : Number(t.startLng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      seenTrailKeys.add(key);
      trails.push(t);
    }
    if (trails.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường hợp lệ để so sánh thời tiết.' });
    }

    const requestedCanonicalOrder = trails.map((t) => String(t.id || t._id));
    const canonicalCacheKey = [...requestedCanonicalOrder].sort().join(',');
    const nowMs = Date.now();
    const cached = compareWeatherCache.get(canonicalCacheKey);

    if (cached && nowMs - cached.fetchedAtMs < COMPARE_CACHE_TTL_MS) {
      const ordered = requestedCanonicalOrder
        .map((id) => cached.itemsById.get(id))
        .filter((item): item is MultiTrailCompareItem => Boolean(item));
      if (ordered.length === trails.length) {
        const bestWeather = ordered.reduce<MultiTrailCompareItem | null>(
          (best, cur) => (!best || cur.weatherScore > best.weatherScore ? cur : best),
          null
        );
        const bestCloud = ordered.reduce<MultiTrailCompareItem | null>(
          (best, cur) => (!best || cur.bestSeaOfCloudsPercent > best.bestSeaOfCloudsPercent ? cur : best),
          null
        );
        res.setHeader('X-Cache', 'HIT');
        return res.json({
          success: true,
          cached: true,
          count: ordered.length,
          fetchedAt: cached.fetchedAt,
          source: 'MET Norway Locationforecast 2.0 (3-Day Summit)',
          attribution: MET_NORWAY_ATTRIBUTION,
          bestWeatherTrailId: bestWeather?.trailId || null,
          bestCloudTrailId: bestCloud?.trailId || null,
          data: ordered,
        });
      }
    }

    const coords = trails.map((t) => ({
      lat: Number.isFinite(Number(t.endLat)) ? Number(t.endLat) : Number(t.startLat),
      lng: Number.isFinite(Number(t.endLng)) ? Number(t.endLng) : Number(t.startLng),
    }));

    let batchEntries: Array<NormalizedLiveWeatherPayload | null> = [];
    try {
      batchEntries = await Promise.all(coords.map((c) => getLiveWeatherForecast(c.lat, c.lng)));
      const allValid =
        batchEntries.length === trails.length &&
        batchEntries.every(
          (entry) =>
            entry &&
            entry.daily &&
            Array.isArray(entry.daily.time) &&
            entry.daily.time.length > 0 &&
            Array.isArray(entry.daily.temperature_2m_max) &&
            entry.daily.temperature_2m_max.length > 0
        );
      if (!allValid) {
        return res.status(503).json({
          success: false,
          message: 'Dữ liệu dự báo thời tiết MET Norway chưa đầy đủ cho tất cả cung đường. Vui lòng thử lại sau.',
        });
      }
    } catch {
      return res.status(503).json({
        success: false,
        message: 'Không thể kết nối dịch vụ dự báo thời tiết MET Norway lúc này. Vui lòng thử lại sau.',
      });
    }

    const results: MultiTrailCompareItem[] = trails.map((t, idx) => {
      const entry = batchEntries[idx]!;
      const daily = entry.daily;
      const maxAlt = Number(t.maxAltitudeM) || 1500;
      const gridElevationM = Number.isFinite(Number(entry.elevation))
        ? Math.round(Number(entry.elevation))
        : Math.round(maxAlt * 0.65);
      const deltaM = Math.max(0, maxAlt - gridElevationM);
      const lapseDropC = Math.round((deltaM / 1000) * 6.5 * 10) / 10;

      const times: string[] = Array.isArray(daily.time) ? daily.time.slice(0, 3) : [];
      const days: MultiTrailCompareDay[] = times.map((dateStr, dIdx) => {
        const wmoCode = Number(daily.weather_code?.[dIdx] ?? 1);
        const gridTempMinC = Math.round(Number(daily.temperature_2m_min?.[dIdx] ?? 14) * 10) / 10;
        const gridTempMaxC = Math.round(Number(daily.temperature_2m_max?.[dIdx] ?? 22) * 10) / 10;
        const summitTempMinC = Math.round((gridTempMinC - lapseDropC) * 10) / 10;
        const summitTempMaxC = Math.round((gridTempMaxC - lapseDropC) * 10) / 10;
        const precipMm = Math.round(Number(daily.precipitation_sum?.[dIdx] ?? 0) * 10) / 10;
        const windSpeedKmH = Math.round(Number(daily.wind_speed_10m_max?.[dIdx] ?? 12));
        const humidityPercent = Math.round(Number(daily.relative_humidity_2m_max?.[dIdx] ?? 75));
        const condition = mapWmoToCondition(wmoCode, windSpeedKmH, precipMm);
        const windChillC = computeWindChillC(summitTempMinC, windSpeedKmH);
        const seaOfCloudsPercent = computeSeaOfCloudsIndex(maxAlt, humidityPercent, windSpeedKmH, condition);

        const weatherTier: 'ideal' | 'caution' | 'danger' =
          condition === 'storm' || wmoCode >= 95 || precipMm >= 25 || windSpeedKmH >= 45 || windChillC <= 0
            ? 'danger'
            : condition === 'rainy' || precipMm >= 5 || windSpeedKmH >= 30 || windChillC <= 6
              ? 'caution'
              : 'ideal';

        return {
          date: String(dateStr),
          gridTempMinC,
          gridTempMaxC,
          summitTempMinC,
          summitTempMaxC,
          windChillC,
          precipMm,
          windSpeedKmH,
          humidityPercent,
          wmoCode,
          condition,
          conditionLabel: mapWmoToVietnameseLabel(wmoCode),
          seaOfCloudsPercent,
          weatherTier,
        };
      });

      // Deterministic 3-day aggregate weather suitability score (0..100)
      let scoreSum = 0;
      let bestCloud = 0;
      let worstTier: 'ideal' | 'caution' | 'danger' = 'ideal';

      for (const d of days) {
        let dayScore = 96;
        if (d.condition === 'storm' || d.wmoCode >= 95) dayScore -= 55;
        else if (d.precipMm >= 25) dayScore -= 42;
        else if (d.precipMm >= 10) dayScore -= 24;
        else if (d.precipMm >= 3) dayScore -= 12;

        if (d.windSpeedKmH >= 45) dayScore -= 25;
        else if (d.windSpeedKmH >= 30) dayScore -= 12;

        if (d.windChillC <= 0) dayScore -= 18;
        else if (d.windChillC <= 6) dayScore -= 8;

        scoreSum += Math.max(10, Math.min(100, dayScore));
        if (d.seaOfCloudsPercent > bestCloud) bestCloud = d.seaOfCloudsPercent;
        if (d.weatherTier === 'danger') worstTier = 'danger';
        else if (d.weatherTier === 'caution' && worstTier === 'ideal') worstTier = 'caution';
      }

      const weatherScore = days.length > 0 ? Math.round(scoreSum / days.length) : 50;

      return {
        trailId: String(t.id || t._id),
        name: String(t.name),
        province: String(t.province || ''),
        region: String(t.region || 'Miền Bắc'),
        maxAltitudeM: maxAlt,
        gridElevationM,
        lapseDropC,
        weatherScore,
        bestSeaOfCloudsPercent: bestCloud,
        worstTier,
        days,
      };
    });

    const bestWeather = results.reduce<MultiTrailCompareItem | null>(
      (best, cur) => (!best || cur.weatherScore > best.weatherScore ? cur : best),
      null
    );
    const bestCloud = results.reduce<MultiTrailCompareItem | null>(
      (best, cur) => (!best || cur.bestSeaOfCloudsPercent > best.bestSeaOfCloudsPercent ? cur : best),
      null
    );

    const fetchedAt = new Date().toISOString();
    const itemsById = new Map<string, MultiTrailCompareItem>(results.map((r) => [r.trailId, r]));
    setCompareWeatherCache(canonicalCacheKey, { fetchedAt, fetchedAtMs: Date.now(), itemsById });

    res.setHeader('X-Cache', 'MISS');
    return res.json({
      success: true,
      cached: false,
      count: results.length,
      fetchedAt,
      source: 'MET Norway Locationforecast 2.0 (3-Day Summit)',
      attribution: MET_NORWAY_ATTRIBUTION,
      bestWeatherTrailId: bestWeather?.trailId || null,
      bestCloudTrailId: bestCloud?.trailId || null,
      data: results,
    });
  } catch (err) {
    console.error('[Compare Multi-Trail Weather Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi so sánh dự báo thời tiết các cung đường.' });
  }
};

// =========================================================================
// NASA POWER (MERRA-2) 3-YEAR SUMMIT CLIMATE NORMALS (24H SWR SINGLEFLIGHT)
// =========================================================================

export interface TrailClimateMonth {
  month: number;
  avgTempMinC: number;
  avgTempMaxC: number;
  avgRainMm: number;
  rainyDays: number;
  bestScore: number;
}

interface TrailClimateCacheEntry {
  trailId: string;
  trailName: string;
  maxAltitudeM: number;
  gridElevationM: number;
  lapseDropC: number;
  period: { startYear: number; endYear: number };
  fetchedAt: string;
  fetchedAtMs: number;
  months: TrailClimateMonth[];
}

const CLIMATE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours fresh
const CLIMATE_SWR_REFRESH_AGE_MS = 20 * 60 * 60 * 1000; // Proactive background refresh after 20 hours
const CLIMATE_STALE_GRACE_MS = 7 * 24 * 60 * 60 * 1000; // 7-day real NASA POWER (MERRA-2) stale fallback if archive has transient outage
const CLIMATE_FAILURE_BACKOFF_MS = 45 * 1000; // 45s cold-cache outage backoff to prevent 12s socket pileups
const CLIMATE_CACHE_MAX_ENTRIES = 200;
const CLIMATE_RAINY_DAY_THRESHOLD_MM = 1.0;
const CLIMATE_MIN_MONTH_SAMPLES = 20;
const MONTH_AVG_DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
const MONTH_MAX_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const trailClimateCache = new Map<string, TrailClimateCacheEntry>();
const trailClimateInFlight = new Map<string, Promise<TrailClimateCacheEntry | null>>();
const trailClimateFailureBackoff = new Map<string, number>();

function setClimateFailureBackoff(key: string, untilMs: number) {
  const nowMs = Date.now();
  if (trailClimateFailureBackoff.size >= CLIMATE_CACHE_MAX_ENTRIES) {
    for (const [k, exp] of trailClimateFailureBackoff.entries()) {
      if (exp <= nowMs) trailClimateFailureBackoff.delete(k);
    }
    if (trailClimateFailureBackoff.size >= CLIMATE_CACHE_MAX_ENTRIES) {
      const oldest = trailClimateFailureBackoff.keys().next().value;
      if (oldest) trailClimateFailureBackoff.delete(oldest);
    }
  }
  trailClimateFailureBackoff.delete(key);
  trailClimateFailureBackoff.set(key, untilMs);
}

function setTrailClimateCache(key: string, entry: TrailClimateCacheEntry) {
  const nowMs = Date.now();
  if (trailClimateCache.size >= CLIMATE_CACHE_MAX_ENTRIES) {
    for (const [k, v] of trailClimateCache.entries()) {
      if (nowMs - v.fetchedAtMs >= CLIMATE_STALE_GRACE_MS) {
        trailClimateCache.delete(k);
      }
    }
    if (trailClimateCache.size >= CLIMATE_CACHE_MAX_ENTRIES) {
      const oldestKey = trailClimateCache.keys().next().value;
      if (oldestKey) trailClimateCache.delete(oldestKey);
    }
  }
  trailClimateCache.delete(key);
  trailClimateCache.set(key, entry);
}

function getNasaPowerThreeYearWindow(): { startYear: number; endYear: number; startDate: string; endDate: string } {
  const now = new Date();
  let vnYear = now.getUTCFullYear();
  let vnMonth = now.getUTCMonth() + 1;
  let vnDay = now.getUTCDate();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(now);
    const y = Number(parts.find((p) => p.type === 'year')?.value);
    const m = Number(parts.find((p) => p.type === 'month')?.value);
    const d = Number(parts.find((p) => p.type === 'day')?.value);
    if (Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d)) {
      vnYear = y;
      vnMonth = m;
      vnDay = d;
    }
  } catch {
    // Fallback to UTC parts above
  }

  // Respect NASA POWER ~7-day reanalysis lag in early January
  const endYear = vnMonth === 1 && vnDay <= 15 ? vnYear - 2 : vnYear - 1;
  const startYear = endYear - 2;
  return {
    startYear,
    endYear,
    startDate: `${startYear}0101`,
    endDate: `${endYear}1231`,
  };
}

function computeMonthlyTrekkingScore(avgTempMinC: number, avgTempMaxC: number, avgRainMm: number, rainyDays: number): number {
  let score = 100;

  // Monthly precipitation penalty (mud, leeches, flash-flood & landslide exposure)
  if (avgRainMm > 40) {
    if (avgRainMm <= 120) {
      score -= ((avgRainMm - 40) / 80) * 14;
    } else if (avgRainMm <= 260) {
      score -= 14 + ((avgRainMm - 120) / 140) * 20;
    } else {
      score -= 34 + Math.min(18, ((avgRainMm - 260) / 180) * 18);
    }
  }

  // Rainy-day frequency penalty
  if (rainyDays > 5) {
    score -= Math.min(22, (rainyDays - 5) * 1.1);
  }

  // Summit thermal exposure penalty (hypothermia cold vs tropical heatstroke)
  if (avgTempMinC < 2) {
    score -= Math.min(14, 8 + (2 - avgTempMinC) * 1.5);
  } else if (avgTempMinC < 6) {
    score -= ((6 - avgTempMinC) / 4) * 8;
  }

  if (avgTempMaxC > 27) {
    score -= Math.min(20, (avgTempMaxC - 27) * 2.2);
  }

  return Math.max(5, Math.min(100, Math.round(score)));
}

async function fetchNasaPowerTrailClimate(params: {
  trailId: string;
  trailName: string;
  maxAltitudeM: number;
  lat: number;
  lng: number;
}): Promise<TrailClimateCacheEntry | null> {
  const window = getNasaPowerThreeYearWindow();
  const url =
    `https://power.larc.nasa.gov/api/temporal/daily/point` +
    `?parameters=T2M_MIN,T2M_MAX,PRECTOTCORR` +
    `&community=RE` +
    `&longitude=${params.lng.toFixed(4)}&latitude=${params.lat.toFixed(4)}` +
    `&start=${window.startDate}&end=${window.endDate}` +
    `&format=JSON`;

  const apiRes = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!apiRes.ok) return null;

  const rawJson: any = await apiRes.json();
  const paramBag = rawJson?.properties?.parameter;
  const minMap = paramBag?.T2M_MIN;
  const maxMap = paramBag?.T2M_MAX;
  const precipMap = paramBag?.PRECTOTCORR;

  if (!minMap || typeof minMap !== 'object' || !maxMap || typeof maxMap !== 'object' || !precipMap || typeof precipMap !== 'object') {
    return null;
  }

  const dateKeys = Object.keys(minMap);
  if (dateKeys.length < 900) {
    return null;
  }

  const rawCoordElev = Number(rawJson?.geometry?.coordinates?.[2]);
  const hasGridElev = Number.isFinite(rawCoordElev) && rawCoordElev > -500;
  const effectiveMaxAlt =
    params.maxAltitudeM > 0 ? params.maxAltitudeM : hasGridElev ? Math.round(rawCoordElev) : 0;
  const gridElevationM = hasGridElev ? Math.round(rawCoordElev) : effectiveMaxAlt;
  const deltaM = hasGridElev ? Math.max(0, effectiveMaxAlt - gridElevationM) : 0;
  const lapseDropC = hasGridElev ? Math.round((deltaM / 1000) * 6.5 * 10) / 10 : 0;

  interface MonthBucket {
    minSum: number;
    minCount: number;
    maxSum: number;
    maxCount: number;
    rainSum: number;
    rainCount: number;
    rainyDays: number;
  }

  const buckets: MonthBucket[] = Array.from({ length: 12 }, () => ({
    minSum: 0,
    minCount: 0,
    maxSum: 0,
    maxCount: 0,
    rainSum: 0,
    rainCount: 0,
    rainyDays: 0,
  }));

  for (const dateKey of dateKeys) {
    // NASA POWER daily keys follow YYYYMMDD (8 digits)
    if (dateKey.length < 6) continue;
    const monthNum = Number(dateKey.slice(4, 6));
    if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) continue;
    const b = buckets[monthNum - 1];

    // NASA POWER uses -999 as missing-data fill sentinel
    const tMin = Number(minMap[dateKey]);
    if (Number.isFinite(tMin) && tMin > -900) {
      b.minSum += tMin;
      b.minCount++;
    }

    const tMax = Number(maxMap[dateKey]);
    if (Number.isFinite(tMax) && tMax > -900) {
      b.maxSum += tMax;
      b.maxCount++;
    }

    const pSum = Number(precipMap[dateKey]);
    if (Number.isFinite(pSum) && pSum >= 0) {
      b.rainSum += pSum;
      b.rainCount++;
      if (pSum >= CLIMATE_RAINY_DAY_THRESHOLD_MM) {
        b.rainyDays++;
      }
    }
  }

  // Require >= 20 valid daily samples per month for temp & precipitation (prevents partial-year under-reporting bias)
  const months: TrailClimateMonth[] = [];
  for (let m = 0; m < 12; m++) {
    const b = buckets[m];
    if (
      b.minCount < CLIMATE_MIN_MONTH_SAMPLES ||
      b.maxCount < CLIMATE_MIN_MONTH_SAMPLES ||
      b.rainCount < CLIMATE_MIN_MONTH_SAMPLES
    ) {
      return null;
    }

    const rawAvgMin = b.minSum / b.minCount - lapseDropC;
    const rawAvgMax = b.maxSum / b.maxCount - lapseDropC;
    const avgTempMinC = Math.round(Math.min(rawAvgMin, rawAvgMax) * 10) / 10;
    const avgTempMaxC = Math.round(Math.max(rawAvgMin, rawAvgMax) * 10) / 10;
    const avgRainMm = Math.max(0, Math.round((b.rainSum / b.rainCount) * MONTH_AVG_DAYS[m]));
    const rainyDays = Math.max(
      0,
      Math.min(MONTH_MAX_DAYS[m], Math.round((b.rainyDays / b.rainCount) * MONTH_AVG_DAYS[m]))
    );
    const bestScore = computeMonthlyTrekkingScore(avgTempMinC, avgTempMaxC, avgRainMm, rainyDays);

    months.push({
      month: m + 1,
      avgTempMinC,
      avgTempMaxC,
      avgRainMm,
      rainyDays,
      bestScore,
    });
  }

  const nowMs = Date.now();
  return {
    trailId: params.trailId,
    trailName: params.trailName,
    maxAltitudeM: effectiveMaxAlt,
    gridElevationM,
    lapseDropC,
    period: { startYear: window.startYear, endYear: window.endYear },
    fetchedAt: new Date(nowMs).toISOString(),
    fetchedAtMs: nowMs,
    months,
  };
}

function getOrStartClimateFetch(
  cacheKey: string,
  params: { trailId: string; trailName: string; maxAltitudeM: number; lat: number; lng: number }
): Promise<TrailClimateCacheEntry | null> {
  const existing = trailClimateInFlight.get(cacheKey);
  if (existing) return existing;

  const backoffUntil = trailClimateFailureBackoff.get(cacheKey);
  if (backoffUntil) {
    if (Date.now() < backoffUntil) {
      return Promise.resolve(null);
    }
    trailClimateFailureBackoff.delete(cacheKey);
  }

  const promise = fetchNasaPowerTrailClimate(params)
    .then((fresh) => {
      if (fresh) {
        trailClimateFailureBackoff.delete(cacheKey);
        setTrailClimateCache(cacheKey, fresh);
      } else {
        setClimateFailureBackoff(cacheKey, Date.now() + CLIMATE_FAILURE_BACKOFF_MS);
      }
      return fresh;
    })
    .catch(() => {
      setClimateFailureBackoff(cacheKey, Date.now() + CLIMATE_FAILURE_BACKOFF_MS);
      return null;
    })
    .finally(() => {
      trailClimateInFlight.delete(cacheKey);
    });

  trailClimateInFlight.set(cacheKey, promise);
  return promise;
}

/**
 * GET /api/weather/climate/:trailId
 * Fetches 3 full calendar years of NASA POWER (MERRA-2, Public Domain) daily temp & rainfall,
 * applies alpine summit lapse-rate correction (-6.5°C/1000m), and returns 12 monthly climate normals
 * with 24h SWR singleflight caching. Returns 503 if archive is unreachable (never fabricates weather).
 */
export const getTrailClimateNormals = async (req: Request, res: Response) => {
  try {
    const rawTrailId = req.params.trailId;
    const trailIdParam = String(Array.isArray(rawTrailId) ? rawTrailId[0] : rawTrailId || '').trim();
    if (!trailIdParam || trailIdParam.length > 80) {
      return res.status(400).json({ success: false, message: 'Mã cung đường không hợp lệ.' });
    }

    let trail: any = null;
    if (mongoose.connection.readyState === 1) {
      let dbTrail: any = null;
      try {
        dbTrail = await resolveTrailByIdOrSlug(trailIdParam);
      } catch (dbErr) {
        console.error('[Trail Climate DB Lookup Error]:', dbErr);
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        return res.status(503).json({
          success: false,
          message: 'Cơ sở dữ liệu tạm thời gián đoạn. Vui lòng thử lại sau.',
        });
      }
      // Strictly approved trails only — never resurrect deleted seed trails or leak pending/rejected submissions
      if (!dbTrail || (dbTrail.status && dbTrail.status !== 'approved')) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường hợp lệ để tra cứu khí hậu.' });
      }
      trail = dbTrail;
    } else {
      trail = mockTrails.find((t) => t.id === trailIdParam) || null;
      if (!trail) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường để tra cứu dữ liệu khí hậu.' });
      }
    }

    const toFiniteNum = (v: unknown): number | null => {
      if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const lat = toFiniteNum(trail.endLat) ?? toFiniteNum(trail.startLat);
    const lng = toFiniteNum(trail.endLng) ?? toFiniteNum(trail.startLng);
    if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(404).json({ success: false, message: 'Cung đường chưa có tọa độ đỉnh hợp lệ.' });
    }

    const canonicalTrailId = String(trail.id || trail._id);
    const trailName = String(trail.name || canonicalTrailId);
    const parsedAlt = toFiniteNum(trail.maxAltitudeM);
    const maxAltitudeM = parsedAlt !== null && parsedAlt > 0 ? Math.round(parsedAlt) : 0;
    const cacheKey = `${canonicalTrailId}:${lat.toFixed(4)},${lng.toFixed(4)}:${maxAltitudeM}`;
    const fetchParams = { trailId: canonicalTrailId, trailName, maxAltitudeM, lat, lng };

    const nowMs = Date.now();
    const cachedEntry = trailClimateCache.get(cacheKey);
    let payload: TrailClimateCacheEntry | null = null;
    let servedFromCache = false;
    let isStaleFallback = false;

    if (cachedEntry && nowMs - cachedEntry.fetchedAtMs < CLIMATE_CACHE_TTL_MS) {
      payload = cachedEntry;
      servedFromCache = true;
      // Proactive background SWR refresh after 20 hours so hot peaks stay warm without blocking requests
      if (nowMs - cachedEntry.fetchedAtMs >= CLIMATE_SWR_REFRESH_AGE_MS) {
        void getOrStartClimateFetch(cacheKey, fetchParams);
      }
    } else {
      const fresh = await getOrStartClimateFetch(cacheKey, fetchParams);
      if (fresh) {
        payload = fresh;
        servedFromCache = false;
      } else if (cachedEntry && nowMs - cachedEntry.fetchedAtMs < CLIMATE_STALE_GRACE_MS) {
        payload = cachedEntry;
        servedFromCache = true;
        isStaleFallback = true;
      }
    }

    if (!payload) {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(503).json({
        success: false,
        message: 'Dịch vụ dữ liệu khí hậu lịch sử NASA POWER tạm thời gián đoạn. Vui lòng thử lại sau.',
      });
    }

    if (isStaleFallback) {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      res.setHeader('X-Cache', 'STALE');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=82800');
      res.setHeader('X-Cache', servedFromCache ? 'HIT' : 'MISS');
    }

    return res.json({
      success: true,
      cached: servedFromCache,
      source: 'nasa-power-merra2-3yr',
      attribution: NASA_POWER_ATTRIBUTION,
      trailId: payload.trailId,
      trailName: payload.trailName,
      maxAltitudeM: payload.maxAltitudeM,
      gridElevationM: payload.gridElevationM,
      lapseDropC: payload.lapseDropC,
      period: payload.period,
      fetchedAt: payload.fetchedAt,
      months: payload.months,
    });
  } catch (err) {
    console.error('[Trail Climate Normals Error]:', err);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(500).json({ success: false, message: 'Lỗi khi tải dữ liệu khí hậu lịch sử cung đường.' });
  }
};
