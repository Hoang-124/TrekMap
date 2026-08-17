/**
 * Public APIs Integration Service
 * Interfaces with open-source, keyless Public APIs from github.com/public-apis/public-apis
 */

// 1. Open-Meteo Live Weather API
export async function getLiveWeatherForecast(lat: number, lng: number) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,relative_humidity_2m_max&current_weather=true&timezone=Asia%2FBangkok`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('Open-Meteo HTTP Error');
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Open-Meteo API unreachable or timed out:', err);
    return null;
  }
}

// 2. Sunrise-Sunset Astronomical API
export async function getSunriseSunsetData(lat: number, lng: number) {
  try {
    const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error('Sunrise-Sunset HTTP Error');
    const json = await res.json();
    if (json.status === 'OK' && json.results) {
      const sunriseUTC = new Date(json.results.sunrise);
      const sunsetUTC = new Date(json.results.sunset);

      const formatVN = (d: Date) =>
        d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

      return {
        sunrise: formatVN(sunriseUTC),
        sunset: formatVN(sunsetUTC),
        dayLengthHours: Math.round((json.results.day_length / 3600) * 10) / 10,
        goldenHourMorning: `${formatVN(new Date(sunriseUTC.getTime() - 20 * 60000))} - ${formatVN(new Date(sunriseUTC.getTime() + 45 * 60000))}`,
      };
    }
  } catch (err) {
    console.warn('Sunrise-Sunset API unreachable:', err);
  }
  return {
    sunrise: '05:30 SA',
    sunset: '18:15 CH',
    dayLengthHours: 12.8,
    goldenHourMorning: '05:10 SA - 06:15 SA (Lý tưởng săn mây)',
  };
}

// 3. OpenStreetMap Nominatim Reverse Geocoding API
export async function reverseGeocodeLocation(lat: number, lng: number) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TrekMap-Vietnam/2.5 (contact@trekmap.vn)' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error('Nominatim HTTP Error');
    const json = await res.json();
    if (json && json.address) {
      const addr = json.address;
      // Extract specific local ward/quarter/village
      const wardOrQuarter = addr.quarter || addr.suburb || addr.ward || addr.neighbourhood || addr.village || addr.hamlet || addr.town || addr.residential || '';
      const district = addr.city_district || addr.district || addr.county || addr.town || '';
      const state = addr.city || addr.state || addr.province || '';
      
      const parts: string[] = [];
      if (wardOrQuarter) parts.push(wardOrQuarter);
      if (district && district !== wardOrQuarter) parts.push(district);
      if (state && state !== district && state !== wardOrQuarter) parts.push(state);

      return {
        displayName: json.display_name,
        formattedAddress: parts.length > 0 ? parts.join(', ') : json.display_name,
        province: state,
        district,
        village: wardOrQuarter,
      };
    }
  } catch (err) {
    console.warn('Nominatim Geocoding API unreachable:', err);
  }
  return null;
}

let cachedNasaEvents: any[] = [];
let lastNasaFetchTime = 0;

export async function getNaturalHazardsAlerts() {
  const now = Date.now();
  if (cachedNasaEvents.length > 0 && now - lastNasaFetchTime < 600000) {
    return cachedNasaEvents;
  }

  try {
    const url = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=8';
    const fetchPromise = fetch(url, { signal: AbortSignal.timeout(300) });
    const timeoutPromise = new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('NASA API timeout')), 200)
    );

    const res = await Promise.race([fetchPromise, timeoutPromise]);
    if (res && res.ok) {
      const json = await res.json();
      if (json && json.events) {
        cachedNasaEvents = json.events.map((e: any) => ({
          id: e.id,
          title: e.title,
          category: e.categories?.[0]?.title || 'Thiên tai',
          date: e.geometry?.[0]?.date || new Date().toISOString(),
          coordinates: e.geometry?.[0]?.coordinates || [105.0, 21.0],
        }));
        lastNasaFetchTime = now;
        return cachedNasaEvents;
      }
    }
  } catch (err) {
    // Return cached or empty array on timeout
  }
  return cachedNasaEvents;
}

// 4. Real-World Road Driving Routing via OSRM API (with intelligent memory cache)
const routingCache = new Map<string, { roadDistanceKm: number; travelDurationMin: number; travelDurationFormatted: string }>();

export async function calculateDrivingRoute(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number
): Promise<{ roadDistanceKm: number; travelDurationMin: number; travelDurationFormatted: string }> {
  const cacheKey = `${startLat.toFixed(3)},${startLng.toFixed(3)}->${destLat.toFixed(3)},${destLng.toFixed(3)}`;
  if (routingCache.has(cacheKey)) {
    return routingCache.get(cacheKey)!;
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
        routingCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (err) {
    // Network or OSRM timeout fallback
  }

  // Realistic fallback based on Vietnamese mountain highway winding factor (1.8x)
  const dLat = ((destLat - startLat) * Math.PI) / 180;
  const dLon = ((destLng - startLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((startLat * Math.PI) / 180) * Math.cos((destLat * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const haversineKm = 6371 * c;

  const roadDistanceKm = Math.round(haversineKm * 1.8 * 10) / 10;
  const totalMinutes = Math.round((roadDistanceKm / 48) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const travelDurationFormatted = hours > 0 ? `${hours}h ${mins > 0 ? `${mins}p` : ''}`.trim() : `${mins} phút`;

  const fallbackResult = { roadDistanceKm, travelDurationMin: totalMinutes, travelDurationFormatted };
  routingCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}
