/**
 * Public APIs Integration Service (100% Free Commercial Production Compliant)
 * - Weather: MET Norway Locationforecast 2.0 (CC BY 4.0 — commercial permitted)
 * - Solar/Astronomy: Pure local NOAA Solar Equations (zero external API)
 * - Reverse Geocoding: OSM Nominatim with strict global 1.1s rate queue & 24h cache (ODbL)
 * - Natural Hazards: NASA EONET v3 (US Govt Public Domain — commercial permitted)
 * - Driving Route: Optional OpenRouteService (free commercial tier) / self-hosted OSRM / local terrain estimator
 */

import { calculateSolarTimes, formatHoursToHHMM } from '../utils/solarMath.js';

export const MET_NORWAY_USER_AGENT = 'LOST-Vietnam-Alpine/2.6 (https://lost.vn; contact@lost.vn)';
export const MET_NORWAY_ATTRIBUTION = 'Weather data from MET Norway (CC BY 4.0)';
export const NOMINATIM_ATTRIBUTION = '© OpenStreetMap contributors (ODbL)';
export const NASA_EONET_ATTRIBUTION = 'NASA EONET (Public Domain)';
export const ORS_ATTRIBUTION = '© openrouteservice by HeiGIT | © OpenStreetMap contributors';
export const TERRAIN_ROUTING_ATTRIBUTION = 'Ước tính tuyến đường địa hình nội bộ LOST';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs?: number;
}

export interface NormalizedLiveWeatherPayload {
  provider: 'met-norway-locationforecast-2.0';
  attribution: string;
  elevation: number;
  current_weather: {
    temperature: number;
    windspeed: number;
    weathercode: number;
    time: string;
  };
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    cloud_cover: number;
  };
  daily: {
    time: string[];
    weathercode: number[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    windspeed_10m_max: number[];
    wind_speed_10m_max: number[];
    relative_humidity_2m_max: number[];
  };
}

const weatherCache = new Map<string, CacheEntry<NormalizedLiveWeatherPayload>>();
const weatherInFlight = new Map<string, Promise<NormalizedLiveWeatherPayload | null>>();
const WEATHER_MIN_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes (MET Norway compliance)
const WEATHER_DEFAULT_CACHE_TTL_MS = 45 * 60 * 1000; // 45 minutes
const WEATHER_MAX_CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours cap

/**
 * Maps MET Norway `symbol_code` strings (e.g. `heavyrainshowersandthunder_day`) to standard WMO weather codes
 * so all existing LOST weather consumers preserve 100% identical threshold & icon semantics.
 */
export function mapMetSymbolToWmoCode(symbolCode?: string | null): number {
  const s = String(symbolCode || '').toLowerCase();
  if (!s) return 2;
  if (s.includes('thunder')) return 95;
  if (s.includes('heavyrainshowers') || s.includes('heavysleetshowers') || s.includes('heavysnowshowers')) return 82;
  if (s.includes('heavyrain') || s.includes('heavysleet') || s.includes('heavysnow')) return 65;
  if (s.includes('showers')) return 80;
  if (s.includes('lightrain') || s.includes('lightsleet') || s.includes('lightsnow')) return 51;
  if (s.includes('rain') || s.includes('sleet') || s.includes('snow')) return 61;
  if (s.includes('fog')) return 45;
  if (s.includes('cloudy') && !s.includes('partly')) return 3;
  if (s.includes('partlycloudy')) return 2;
  if (s.includes('fair')) return 1;
  if (s.includes('clearsky')) return 0;
  return 2;
}

function wmoSeverityRank(code: number): number {
  if (code >= 95) return 7;
  if (code >= 82) return 6;
  if (code >= 65) return 5;
  if (code >= 61) return 4;
  if (code >= 51) return 3;
  if (code === 45 || code === 48) return 2;
  if (code >= 1) return 1;
  return 0;
}

function toVietnamDateIso(utcMs: number): string {
  const vnDate = new Date(utcMs + 7 * 60 * 60 * 1000);
  return vnDate.toISOString().slice(0, 10);
}

export function normalizeMetNorwayForecast(rawJson: any): NormalizedLiveWeatherPayload | null {
  const timeseries: any[] = rawJson?.properties?.timeseries;
  if (!Array.isArray(timeseries) || timeseries.length === 0) return null;

  const coordElev = Number(rawJson?.geometry?.coordinates?.[2]);
  const elevation = Number.isFinite(coordElev) ? Math.round(coordElev) : 0;

  interface DayAcc {
    tempMin: number;
    tempMax: number;
    windMaxKmH: number;
    humidityMax: number;
    precipMm: number;
    worstWmo: number;
    last6hPrecipMs: number;
  }

  const dayMap = new Map<string, DayAcc>();

  for (const entry of timeseries) {
    const tsMs = Date.parse(String(entry?.time || ''));
    if (!Number.isFinite(tsMs)) continue;

    const dateKey = toVietnamDateIso(tsMs);
    const instant = entry?.data?.instant?.details || {};
    const next1 = entry?.data?.next_1_hours;
    const next6 = entry?.data?.next_6_hours;
    const next12 = entry?.data?.next_12_hours;

    const temp = Number(instant.air_temperature);
    const t6Min = Number(next6?.details?.air_temperature_min);
    const t6Max = Number(next6?.details?.air_temperature_max);
    const windMs = Number(instant.wind_speed);
    const windKmH = Number.isFinite(windMs) ? windMs * 3.6 : NaN;
    const humidity = Number(instant.relative_humidity);

    const symbol =
      next1?.summary?.symbol_code ||
      next6?.summary?.symbol_code ||
      next12?.summary?.symbol_code ||
      '';
    const wmo = mapMetSymbolToWmoCode(symbol);

    let acc = dayMap.get(dateKey);
    if (!acc) {
      acc = {
        tempMin: Infinity,
        tempMax: -Infinity,
        windMaxKmH: 0,
        humidityMax: 0,
        precipMm: 0,
        worstWmo: 0,
        last6hPrecipMs: -Infinity,
      };
      dayMap.set(dateKey, acc);
    }

    if (Number.isFinite(temp)) {
      if (temp < acc.tempMin) acc.tempMin = temp;
      if (temp > acc.tempMax) acc.tempMax = temp;
    }
    if (Number.isFinite(t6Min) && t6Min < acc.tempMin) acc.tempMin = t6Min;
    if (Number.isFinite(t6Max) && t6Max > acc.tempMax) acc.tempMax = t6Max;
    if (Number.isFinite(windKmH) && windKmH > acc.windMaxKmH) acc.windMaxKmH = windKmH;
    if (Number.isFinite(humidity) && humidity > acc.humidityMax) acc.humidityMax = humidity;

    if (wmoSeverityRank(wmo) > wmoSeverityRank(acc.worstWmo) || (wmoSeverityRank(wmo) === wmoSeverityRank(acc.worstWmo) && wmo > acc.worstWmo)) {
      acc.worstWmo = wmo;
    }

    // Avoid double-counting overlapping next_1_hours & next_6_hours precipitation blocks
    const p1 = Number(next1?.details?.precipitation_amount);
    const p6 = Number(next6?.details?.precipitation_amount);
    if (Number.isFinite(p1) && p1 >= 0) {
      acc.precipMm += p1;
    } else if (Number.isFinite(p6) && p6 >= 0 && tsMs - acc.last6hPrecipMs >= 5 * 60 * 60 * 1000) {
      acc.precipMm += p6;
      acc.last6hPrecipMs = tsMs;
    }
  }

  const sortedDates = Array.from(dayMap.keys()).sort();
  if (sortedDates.length === 0) return null;

  const times: string[] = [];
  const weathercodes: number[] = [];
  const tempMaxs: number[] = [];
  const tempMins: number[] = [];
  const precips: number[] = [];
  const windMaxs: number[] = [];
  const humMaxs: number[] = [];

  for (const d of sortedDates) {
    const acc = dayMap.get(d)!;
    if (!Number.isFinite(acc.tempMin) || !Number.isFinite(acc.tempMax)) continue;
    times.push(d);
    weathercodes.push(acc.worstWmo);
    tempMins.push(Math.round(acc.tempMin * 10) / 10);
    tempMaxs.push(Math.round(acc.tempMax * 10) / 10);
    precips.push(Math.round(acc.precipMm * 10) / 10);
    windMaxs.push(Math.round(acc.windMaxKmH * 10) / 10);
    humMaxs.push(Math.round(acc.humidityMax || 75));
  }

  if (times.length === 0) return null;

  const first = timeseries[0];
  const firstInstant = first?.data?.instant?.details || {};
  const firstSymbol =
    first?.data?.next_1_hours?.summary?.symbol_code ||
    first?.data?.next_6_hours?.summary?.symbol_code ||
    first?.data?.next_12_hours?.summary?.symbol_code ||
    '';
  const curTemp = Number.isFinite(Number(firstInstant.air_temperature))
    ? Math.round(Number(firstInstant.air_temperature) * 10) / 10
    : tempMaxs[0];
  const curWindKmH = Number.isFinite(Number(firstInstant.wind_speed))
    ? Math.round(Number(firstInstant.wind_speed) * 3.6 * 10) / 10
    : windMaxs[0];
  const curHumidity = Number.isFinite(Number(firstInstant.relative_humidity))
    ? Math.round(Number(firstInstant.relative_humidity))
    : humMaxs[0];
  const curCloud = Number.isFinite(Number(firstInstant.cloud_area_fraction))
    ? Math.round(Number(firstInstant.cloud_area_fraction))
    : 45;
  const curWmo = mapMetSymbolToWmoCode(firstSymbol);

  return {
    provider: 'met-norway-locationforecast-2.0',
    attribution: MET_NORWAY_ATTRIBUTION,
    elevation,
    current_weather: {
      temperature: curTemp,
      windspeed: curWindKmH,
      weathercode: curWmo,
      time: String(first?.time || new Date().toISOString()),
    },
    current: {
      temperature_2m: curTemp,
      relative_humidity_2m: curHumidity,
      weather_code: curWmo,
      wind_speed_10m: curWindKmH,
      cloud_cover: curCloud,
    },
    daily: {
      time: times,
      weathercode: weathercodes,
      weather_code: weathercodes,
      temperature_2m_max: tempMaxs,
      temperature_2m_min: tempMins,
      precipitation_sum: precips,
      windspeed_10m_max: windMaxs,
      wind_speed_10m_max: windMaxs,
      relative_humidity_2m_max: humMaxs,
    },
  };
}

// 1. MET Norway Locationforecast 2.0 (CC BY 4.0) with 30-60min TTL Cache & Singleflight Deduplication
export async function getLiveWeatherForecast(lat: number, lng: number): Promise<NormalizedLiveWeatherPayload | null> {
  const safeLat = Math.round(lat * 10000) / 10000;
  const safeLng = Math.round(lng * 10000) / 10000;
  const cacheKey = `${safeLat.toFixed(2)},${safeLng.toFixed(2)}`;
  const cached = weatherCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < (cached.ttlMs ?? WEATHER_DEFAULT_CACHE_TTL_MS)) {
    return cached.data;
  }

  const pending = weatherInFlight.get(cacheKey);
  if (pending) {
    return pending;
  }

  const reqPromise = (async (): Promise<NormalizedLiveWeatherPayload | null> => {
    try {
      const url = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${safeLat.toFixed(4)}&lon=${safeLng.toFixed(4)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': MET_NORWAY_USER_AGENT,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(6500),
      });
      if (!res.ok) throw new Error(`MET Norway HTTP ${res.status}`);
      const rawJson = await res.json();
      const normalized = normalizeMetNorwayForecast(rawJson);
      if (!normalized) throw new Error('MET Norway invalid payload');

      // Honor MET Norway Expires header while enforcing at least 30m cache TTL
      let ttlMs = WEATHER_DEFAULT_CACHE_TTL_MS;
      const expiresHeader = res.headers.get('expires');
      if (expiresHeader) {
        const expMs = Date.parse(expiresHeader);
        if (Number.isFinite(expMs)) {
          const headerDelta = expMs - Date.now();
          ttlMs = Math.max(WEATHER_MIN_CACHE_TTL_MS, Math.min(WEATHER_MAX_CACHE_TTL_MS, headerDelta));
        }
      }

      weatherCache.set(cacheKey, { data: normalized, timestamp: Date.now(), ttlMs });
      if (weatherCache.size > 200) {
        const oldestKey = weatherCache.keys().next().value;
        if (oldestKey) weatherCache.delete(oldestKey);
      }
      return normalized;
    } catch (err) {
      if (cached) return cached.data;
      console.warn('MET Norway Locationforecast API unreachable or timed out:', err);
      return null;
    } finally {
      weatherInFlight.delete(cacheKey);
    }
  })();

  weatherInFlight.set(cacheKey, reqPromise);
  return reqPromise;
}

// 2. Pure Local NOAA Solar Calculation (Zero External API, 100% Offline, Vietnam UTC+7)
export async function getSunriseSunsetData(lat: number, lng: number) {
  const solar = calculateSolarTimes(lat, lng, new Date(), 7);
  const dayLengthHours = Math.round((solar.dayLengthMinutes / 60) * 10) / 10;
  return {
    sunrise: solar.sunrise,
    sunset: solar.sunset,
    dayLengthHours,
    goldenHourMorning: `${formatHoursToHHMM(solar.sunriseHours - 20 / 60)} - ${solar.goldenHourMorningEnd}`,
    goldenHourEvening: `${solar.goldenHourEveningStart} - ${formatHoursToHHMM(solar.sunsetHours + 15 / 60)}`,
    civilTwilightBegin: solar.civilDawn,
    civilTwilightEnd: solar.civilDusk,
    attribution: 'NOAA Solar Algorithm (Local)',
  };
}

const geocodeCache = new Map<string, CacheEntry<any>>();
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const NOMINATIM_MIN_INTERVAL_MS = 1100; // Strict >1.0s per OSMF Nominatim Usage Policy
let lastNominatimRequestAt = 0;
let nominatimQueueTail: Promise<void> = Promise.resolve();

function scheduleNominatimSlot<T>(task: () => Promise<T>): Promise<T> {
  const run = nominatimQueueTail.then(async () => {
    const elapsed = Date.now() - lastNominatimRequestAt;
    if (elapsed < NOMINATIM_MIN_INTERVAL_MS) {
      await new Promise((resolve) => setTimeout(resolve, NOMINATIM_MIN_INTERVAL_MS - elapsed));
    }
    lastNominatimRequestAt = Date.now();
    return task();
  });
  nominatimQueueTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

// 3. OpenStreetMap Nominatim Reverse Geocoding API with strict 1.1s global queue & 24-hour cache
export async function reverseGeocodeLocation(lat: number, lng: number) {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = geocodeCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < GEOCODE_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    return await scheduleNominatimSlot(async () => {
      // Double-check cache after waiting in queue in case an identical coord finished first
      const reCached = geocodeCache.get(cacheKey);
      if (reCached && Date.now() - reCached.timestamp < GEOCODE_CACHE_TTL_MS) {
        return reCached.data;
      }

      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': MET_NORWAY_USER_AGENT },
        signal: AbortSignal.timeout(4500),
      });
      if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
      const json: any = await res.json();
      if (json && json.address) {
        const addr = json.address;
        const wardOrQuarter =
          addr.quarter ||
          addr.suburb ||
          addr.ward ||
          addr.neighbourhood ||
          addr.village ||
          addr.hamlet ||
          addr.town ||
          addr.residential ||
          '';
        const district = addr.city_district || addr.district || addr.county || addr.town || '';
        const state = addr.city || addr.state || addr.province || '';

        const parts: string[] = [];
        if (wardOrQuarter) parts.push(wardOrQuarter);
        if (district && district !== wardOrQuarter) parts.push(district);
        if (state && state !== district && state !== wardOrQuarter) parts.push(state);

        const data = {
          displayName: json.display_name,
          formattedAddress: parts.length > 0 ? parts.join(', ') : json.display_name,
          province: state,
          district,
          village: wardOrQuarter,
          attribution: NOMINATIM_ATTRIBUTION,
        };
        geocodeCache.set(cacheKey, { data, timestamp: Date.now() });
        if (geocodeCache.size > 500) {
          const oldestKey = geocodeCache.keys().next().value;
          if (oldestKey) geocodeCache.delete(oldestKey);
        }
        return data;
      }
      return null;
    });
  } catch (err) {
    if (cached) return cached.data;
    console.warn('Nominatim Geocoding API unreachable:', err);
    return null;
  }
}

// 4. NASA EONET Natural Hazards scoped strictly to Vietnam geographic bounding box (Rule 11)
// Vietnam mainland & coastal bounds: Lat [8.0, 23.5], Lng [102.0, 110.5]
const VIETNAM_MIN_LAT = 8.0;
const VIETNAM_MAX_LAT = 23.5;
const VIETNAM_MIN_LNG = 102.0;
const VIETNAM_MAX_LNG = 110.5;

let cachedNasaEvents: any[] = [];
let lastNasaFetchTime = 0;

export async function getNaturalHazardsAlerts() {
  const now = Date.now();
  if (lastNasaFetchTime > 0 && now - lastNasaFetchTime < 600_000) {
    return cachedNasaEvents;
  }

  try {
    // EONET v3 bbox format: minLon,maxLat,maxLon,minLat
    const url = `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&bbox=${VIETNAM_MIN_LNG},${VIETNAM_MAX_LAT},${VIETNAM_MAX_LNG},${VIETNAM_MIN_LAT}&limit=10`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (res && res.ok) {
      const json: any = await res.json();
      if (json && Array.isArray(json.events)) {
        cachedNasaEvents = json.events
          .map((e: any) => {
            const latestGeom =
              Array.isArray(e.geometry) && e.geometry.length > 0 ? e.geometry[e.geometry.length - 1] : null;
            const coords = Array.isArray(latestGeom?.coordinates) ? latestGeom.coordinates : null;
            return {
              id: e.id,
              title: e.title,
              category: e.categories?.[0]?.title || 'Thiên tai',
              date: latestGeom?.date || new Date().toISOString(),
              coordinates: coords,
              attribution: NASA_EONET_ATTRIBUTION,
            };
          })
          .filter((evt: any) => {
            if (!Array.isArray(evt.coordinates) || evt.coordinates.length < 2) return false;
            const lng = Number(evt.coordinates[0]);
            const lat = Number(evt.coordinates[1]);
            return (
              Number.isFinite(lat) &&
              Number.isFinite(lng) &&
              lat >= VIETNAM_MIN_LAT &&
              lat <= VIETNAM_MAX_LAT &&
              lng >= VIETNAM_MIN_LNG &&
              lng <= VIETNAM_MAX_LNG
            );
          });
        lastNasaFetchTime = now;
        return cachedNasaEvents;
      }
    }
  } catch {
    // Return cached Vietnam events on timeout
  }
  return cachedNasaEvents;
}

// 5. Commercial-Compliant Driving Routing (OpenRouteService / Self-Hosted OSRM / Internal Terrain Estimator)
export interface DrivingRouteResult {
  roadDistanceKm: number;
  travelDurationMin: number;
  travelDurationFormatted: string;
  attribution: string;
}

const routingCache = new Map<string, CacheEntry<DrivingRouteResult>>();
const ROUTING_LIVE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const ROUTING_FALLBACK_TTL_MS = 2 * 60 * 1000; // 2 minutes for transient upstream fallback

function formatTravelDuration(totalMinutes: number): string {
  const safeMin = Math.max(1, Math.round(totalMinutes));
  const hours = Math.floor(safeMin / 60);
  const mins = safeMin % 60;
  return hours > 0 ? `${hours}h ${mins > 0 ? `${mins}p` : ''}`.trim() : `${mins} phút`;
}

function storeRoutingCache(key: string, data: DrivingRouteResult, ttlMs: number) {
  routingCache.set(key, { data, timestamp: Date.now(), ttlMs });
  if (routingCache.size > 500) {
    const oldest = routingCache.keys().next().value;
    if (oldest) routingCache.delete(oldest);
  }
}

export async function calculateDrivingRoute(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number
): Promise<DrivingRouteResult> {
  const cacheKey = `${startLat.toFixed(3)},${startLng.toFixed(3)}->${destLat.toFixed(3)},${destLng.toFixed(3)}`;
  const now = Date.now();
  const cached = routingCache.get(cacheKey);
  if (cached && now - cached.timestamp < (cached.ttlMs ?? ROUTING_LIVE_TTL_MS)) {
    return cached.data;
  }

  const orsApiKey = (process.env.ORS_API_KEY || '').trim();
  const selfHostedOsrmUrl = (process.env.SELF_HOSTED_OSRM_URL || '').trim().replace(/\/+$/, '');

  // Priority 1: OpenRouteService (free commercial tier when ORS_API_KEY is configured)
  if (orsApiKey) {
    try {
      const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
        method: 'POST',
        headers: {
          Authorization: orsApiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          coordinates: [
            [startLng, startLat],
            [destLng, destLat],
          ],
          instructions: false,
          geometry: false,
        }),
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        const json: any = await res.json();
        const summary = json?.routes?.[0]?.summary;
        if (summary && Number.isFinite(Number(summary.distance)) && Number.isFinite(Number(summary.duration))) {
          const roadDistanceKm = Math.round((Number(summary.distance) / 1000) * 10) / 10;
          const totalMinutes = Math.max(1, Math.round(Number(summary.duration) / 60));
          const result: DrivingRouteResult = {
            roadDistanceKm,
            travelDurationMin: totalMinutes,
            travelDurationFormatted: formatTravelDuration(totalMinutes),
            attribution: ORS_ATTRIBUTION,
          };
          storeRoutingCache(cacheKey, result, ROUTING_LIVE_TTL_MS);
          return result;
        }
      }
    } catch {
      // Fall through to deterministic estimator
    }
  } else if (selfHostedOsrmUrl && /^https?:\/\//i.test(selfHostedOsrmUrl)) {
    // Priority 2: User-operated self-hosted OSRM instance
    try {
      const url = `${selfHostedOsrmUrl}/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=false`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const json: any = await res.json();
        const route = json?.routes?.[0];
        if (route && Number.isFinite(Number(route.distance)) && Number.isFinite(Number(route.duration))) {
          const roadDistanceKm = Math.round((Number(route.distance) / 1000) * 10) / 10;
          const totalMinutes = Math.max(1, Math.round(Number(route.duration) / 60));
          const result: DrivingRouteResult = {
            roadDistanceKm,
            travelDurationMin: totalMinutes,
            travelDurationFormatted: formatTravelDuration(totalMinutes),
            attribution: NOMINATIM_ATTRIBUTION,
          };
          storeRoutingCache(cacheKey, result, ROUTING_LIVE_TTL_MS);
          return result;
        }
      }
    } catch {
      // Fall through to deterministic estimator
    }
  }

  // Priority 3: Deterministic Vietnam mountain-road estimator (Haversine * 1.38 road winding factor)
  const dLat = ((destLat - startLat) * Math.PI) / 180;
  const dLon = ((destLng - startLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((startLat * Math.PI) / 180) *
      Math.cos((destLat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  const haversineKm = 6371 * c;

  const roadDistanceKm = Math.round(haversineKm * 1.38 * 10) / 10;
  const totalMinutes = Math.max(1, Math.round((roadDistanceKm / 48) * 60));
  const fallbackResult: DrivingRouteResult = {
    roadDistanceKm,
    travelDurationMin: totalMinutes,
    travelDurationFormatted: formatTravelDuration(totalMinutes),
    attribution: TERRAIN_ROUTING_ATTRIBUTION,
  };
  storeRoutingCache(
    cacheKey,
    fallbackResult,
    orsApiKey || selfHostedOsrmUrl ? ROUTING_FALLBACK_TTL_MS : ROUTING_LIVE_TTL_MS
  );
  return fallbackResult;
}
