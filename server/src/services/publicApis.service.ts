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
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TrekMap-Vietnam/2.5 (contact@trekmap.vn)' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error('Nominatim HTTP Error');
    const json = await res.json();
    if (json && json.address) {
      const addr = json.address;
      const village = addr.village || addr.suburb || addr.hamlet || addr.town || '';
      const district = addr.county || addr.district || addr.city_district || '';
      const state = addr.state || addr.city || '';
      return {
        displayName: json.display_name,
        formattedAddress: [village, district, state].filter(Boolean).join(', '),
        province: state,
        district,
        village,
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
