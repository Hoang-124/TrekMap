/**
 * Public APIs Integration Service
 * Interfaces with verified keyless Public APIs (Open-Meteo, Sunrise-Sunset, OSM Nominatim, NASA EONET, OSRM)
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs?: number;
}

const weatherCache = new Map<string, CacheEntry<any>>();
const weatherInFlight = new Map<string, Promise<any>>();
const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// 1. Open-Meteo Live Weather API with 10-minute In-Memory TTL Cache & Singleflight Deduplication
export async function getLiveWeatherForecast(lat: number, lng: number) {
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = weatherCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < WEATHER_CACHE_TTL_MS) {
    return cached.data;
  }

  const pending = weatherInFlight.get(cacheKey);
  if (pending) {
    return pending;
  }

  const reqPromise = (async () => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,relative_humidity_2m_max&current_weather=true&timezone=Asia%2FBangkok`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('Open-Meteo HTTP Error');
      const data = await res.json();
      if (!data || data.error === true) throw new Error('Open-Meteo Error Payload');
      weatherCache.set(cacheKey, { data, timestamp: Date.now() });
      if (weatherCache.size > 200) {
        const oldestKey = weatherCache.keys().next().value;
        if (oldestKey) weatherCache.delete(oldestKey);
      }
      return data;
    } catch (err) {
      if (cached) return cached.data;
      console.warn('Open-Meteo API unreachable or timed out:', err);
      return null;
    } finally {
      weatherInFlight.delete(cacheKey);
    }
  })();

  weatherInFlight.set(cacheKey, reqPromise);
  return reqPromise;
}

const astroCache = new Map<string, CacheEntry<any>>();
const ASTRO_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// 2. Sunrise-Sunset Astronomical API with 1-hour In-Memory TTL Cache (consistent 24h VN format)
export async function getSunriseSunsetData(lat: number, lng: number) {
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = astroCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < ASTRO_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error('Sunrise-Sunset HTTP Error');
    const json = await res.json();
    if (json.status === 'OK' && json.results) {
      const sunriseUTC = new Date(json.results.sunrise);
      const sunsetUTC = new Date(json.results.sunset);
      const civilBeginUTC = json.results.civil_twilight_begin ? new Date(json.results.civil_twilight_begin) : null;
      const civilEndUTC = json.results.civil_twilight_end ? new Date(json.results.civil_twilight_end) : null;

      const formatVN = (d: Date) =>
        d.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Asia/Ho_Chi_Minh',
        });

      const data = {
        sunrise: formatVN(sunriseUTC),
        sunset: formatVN(sunsetUTC),
        dayLengthHours: Math.round((json.results.day_length / 3600) * 10) / 10,
        goldenHourMorning: `${formatVN(new Date(sunriseUTC.getTime() - 20 * 60000))} - ${formatVN(new Date(sunriseUTC.getTime() + 45 * 60000))}`,
        goldenHourEvening: `${formatVN(new Date(sunsetUTC.getTime() - 45 * 60000))} - ${formatVN(new Date(sunsetUTC.getTime() + 15 * 60000))}`,
        civilTwilightBegin: civilBeginUTC ? formatVN(civilBeginUTC) : formatVN(new Date(sunriseUTC.getTime() - 24 * 60000)),
        civilTwilightEnd: civilEndUTC ? formatVN(civilEndUTC) : formatVN(new Date(sunsetUTC.getTime() + 24 * 60000)),
      };
      astroCache.set(cacheKey, { data, timestamp: now });
      if (astroCache.size > 200) {
        const oldestKey = astroCache.keys().next().value;
        if (oldestKey) astroCache.delete(oldestKey);
      }
      return data;
    }
  } catch (err) {
    if (cached) return cached.data;
    console.warn('Sunrise-Sunset API unreachable:', err);
  }
  return {
    sunrise: '05:45',
    sunset: '18:05',
    dayLengthHours: 12.3,
    goldenHourMorning: '05:25 - 06:30',
    goldenHourEvening: '17:20 - 18:20',
    civilTwilightBegin: '05:20',
    civilTwilightEnd: '18:30',
  };
}

const geocodeCache = new Map<string, CacheEntry<any>>();
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// 3. OpenStreetMap Nominatim Reverse Geocoding API with 24-hour cache
export async function reverseGeocodeLocation(lat: number, lng: number) {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = geocodeCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < GEOCODE_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LOST-Vietnam/2.6 (contact@lost.vn)' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error('Nominatim HTTP Error');
    const json = await res.json();
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
      };
      geocodeCache.set(cacheKey, { data, timestamp: now });
      if (geocodeCache.size > 500) {
        const oldestKey = geocodeCache.keys().next().value;
        if (oldestKey) geocodeCache.delete(oldestKey);
      }
      return data;
    }
  } catch (err) {
    if (cached) return cached.data;
    console.warn('Nominatim Geocoding API unreachable:', err);
  }
  return null;
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
      const json = await res.json();
      if (json && Array.isArray(json.events)) {
        // Double-verify coordinates fall strictly inside Vietnam bounding box
        cachedNasaEvents = json.events
          .map((e: any) => {
            const latestGeom = Array.isArray(e.geometry) && e.geometry.length > 0 ? e.geometry[e.geometry.length - 1] : null;
            const coords = Array.isArray(latestGeom?.coordinates) ? latestGeom.coordinates : null;
            return {
              id: e.id,
              title: e.title,
              category: e.categories?.[0]?.title || 'Thiên tai',
              date: latestGeom?.date || new Date().toISOString(),
              coordinates: coords,
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

// 5. Real-World Road Driving Routing via OSRM API with TTL cache (short 2m TTL on fallback so OSRM recovers!)
interface DrivingRouteResult {
  roadDistanceKm: number;
  travelDurationMin: number;
  travelDurationFormatted: string;
}

const routingCache = new Map<string, CacheEntry<DrivingRouteResult>>();
const ROUTING_LIVE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours for live OSRM results
const ROUTING_FALLBACK_TTL_MS = 2 * 60 * 1000; // 2 minutes for fallback estimates

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

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const json = await res.json();
      if (json && json.routes && json.routes.length > 0) {
        const route = json.routes[0];
        const roadDistanceKm = Math.round((route.distance / 1000) * 10) / 10;
        const totalMinutes = Math.round(route.duration / 60);
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        const travelDurationFormatted = hours > 0 ? `${hours}h ${mins > 0 ? `${mins}p` : ''}`.trim() : `${mins} phút`;

        const result = { roadDistanceKm, travelDurationMin: totalMinutes, travelDurationFormatted };
        routingCache.set(cacheKey, { data: result, timestamp: now, ttlMs: ROUTING_LIVE_TTL_MS });
        if (routingCache.size > 500) {
          const oldest = routingCache.keys().next().value;
          if (oldest) routingCache.delete(oldest);
        }
        return result;
      }
    }
  } catch {
    // Network or OSRM timeout fallback
  }

  // Realistic fallback based on Vietnamese mountain highway winding factor (1.8x), cached briefly (2 min)
  const dLat = ((destLat - startLat) * Math.PI) / 180;
  const dLon = ((destLng - startLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((startLat * Math.PI) / 180) * Math.cos((destLat * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  const haversineKm = 6371 * c;

  const roadDistanceKm = Math.round(haversineKm * 1.8 * 10) / 10;
  const totalMinutes = Math.round((roadDistanceKm / 48) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const travelDurationFormatted = hours > 0 ? `${hours}h ${mins > 0 ? `${mins}p` : ''}`.trim() : `${mins} phút`;

  const fallbackResult = { roadDistanceKm, travelDurationMin: totalMinutes, travelDurationFormatted };
  routingCache.set(cacheKey, { data: fallbackResult, timestamp: now, ttlMs: ROUTING_FALLBACK_TTL_MS });
  if (routingCache.size > 500) {
    const oldest = routingCache.keys().next().value;
    if (oldest) routingCache.delete(oldest);
  }
  return fallbackResult;
}
