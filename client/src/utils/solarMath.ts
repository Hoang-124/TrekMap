/**
 * Pure Client-Side NOAA Solar Equations & WGS84 Geodesic Utilities (100% Offline)
 * Grounded in NOAA Solar Calculation algorithms (Jean Meeus) calibrated for Vietnam (UTC+7).
 */

export interface SolarArcSample {
  hour: number;
  altitudeDeg: number;
  azimuthDeg: number;
}

export interface SolarCalculationResult {
  civilDawn: string;
  sunrise: string;
  goldenHourMorningEnd: string;
  solarNoon: string;
  goldenHourEveningStart: string;
  sunset: string;
  civilDusk: string;
  dayLengthMinutes: number;
  sunriseAzimuthDeg: number;
  sunsetAzimuthDeg: number;
  currentSunAltitudeDeg: number;
  currentSunAzimuthDeg: number;
  // Fractional local hours (0..24) for pure-SVG solar arc plotting
  civilDawnHours: number;
  sunriseHours: number;
  goldenHourMorningEndHours: number;
  solarNoonHours: number;
  goldenHourEveningStartHours: number;
  sunsetHours: number;
  civilDuskHours: number;
  currentLocalHours: number;
  solarNoonAltitudeDeg: number;
  arcSamples: SolarArcSample[];
}

export type CardinalHemisphere = 'N' | 'S' | 'E' | 'W';

export interface DmsCoordinate {
  degrees: number;
  minutes: number;
  seconds: number;
  direction: CardinalHemisphere;
  formatted: string;
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EARTH_RADIUS_KM = 6371.0088;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function normalizeDeg360(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

/**
 * Formats fractional hours (0..24) as "HH:mm".
 */
export function formatHoursToHHMM(hours: number): string {
  if (!Number.isFinite(hours)) return '--:--';
  const wrapped = ((hours % 24) + 24) % 24;
  let totalMinutes = Math.round(wrapped * 60);
  if (totalMinutes >= 24 * 60) totalMinutes = 0;
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Converts a UTC Date to Julian Day.
 */
function toJulianDayFromUtcMs(utcMs: number): number {
  return utcMs / 86_400_000 + 2440587.5;
}

interface SolarEphemeris {
  declinationRad: number;
  eqTimeMinutes: number;
}

/**
 * Computes NOAA solar declination and equation of time for a given Julian Day.
 */
function computeSolarEphemeris(julianDay: number): SolarEphemeris {
  const T = (julianDay - 2451545.0) / 36525.0;

  // Geometric Mean Longitude of the Sun (deg)
  const L0 = normalizeDeg360(280.46646 + T * (36000.76983 + 0.0003032 * T));

  // Geometric Mean Anomaly of the Sun (deg)
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const Mrad = M * DEG_TO_RAD;

  // Eccentricity of Earth's Orbit
  const eccent = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);

  // Sun Equation of Center (deg)
  const eqCenter =
    Math.sin(Mrad) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * Mrad) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * Mrad) * 0.000289;

  // Sun True & Apparent Longitude (deg)
  const sunTrueLon = L0 + eqCenter;
  const omega = (125.04 - 1934.136 * T) * DEG_TO_RAD;
  const sunAppLon = sunTrueLon - 0.00569 - 0.00478 * Math.sin(omega);

  // Mean & Corrected Obliquity of the Ecliptic (deg)
  const meanObliq =
    23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const obliqCorr = meanObliq + 0.00256 * Math.cos(omega);
  const obliqCorrRad = obliqCorr * DEG_TO_RAD;

  // Solar Declination (rad)
  const declinationRad = Math.asin(
    clamp(Math.sin(obliqCorrRad) * Math.sin(sunAppLon * DEG_TO_RAD), -1, 1)
  );

  // Equation of Time (minutes)
  const y = Math.tan(obliqCorrRad / 2) * Math.tan(obliqCorrRad / 2);
  const L0rad = L0 * DEG_TO_RAD;
  const eqTimeRad =
    y * Math.sin(2 * L0rad) -
    2 * eccent * Math.sin(Mrad) +
    4 * eccent * y * Math.sin(Mrad) * Math.cos(2 * L0rad) -
    0.5 * y * y * Math.sin(4 * L0rad) -
    1.25 * eccent * eccent * Math.sin(2 * Mrad);
  const eqTimeMinutes = 4 * eqTimeRad * RAD_TO_DEG;

  return { declinationRad, eqTimeMinutes };
}

/**
 * Computes instantaneous sun elevation (with atmospheric refraction) and compass azimuth
 * for a given local calendar date, local fractional hour, and timezone offset.
 */
export function getSunPositionAtLocalHour(
  lat: number,
  lng: number,
  year: number,
  monthIndex0: number,
  day: number,
  localHour: number,
  tzOffsetHours = 7
): { altitudeDeg: number; azimuthDeg: number } {
  const safeLat = clamp(lat, -89.9, 89.9);
  const safeLng = clamp(lng, -180, 180);

  const utcMs =
    Date.UTC(year, monthIndex0, day, 0, 0, 0) + (localHour - tzOffsetHours) * 3_600_000;
  const jd = toJulianDayFromUtcMs(utcMs);
  const { declinationRad, eqTimeMinutes } = computeSolarEphemeris(jd);

  const timeOffsetMin = eqTimeMinutes + 4 * safeLng - 60 * tzOffsetHours;
  const trueSolarTimeMin = (((localHour * 60 + timeOffsetMin) % 1440) + 1440) % 1440;
  const hourAngleDeg = trueSolarTimeMin / 4 < 0 ? trueSolarTimeMin / 4 + 180 : trueSolarTimeMin / 4 - 180;
  const haRad = hourAngleDeg * DEG_TO_RAD;
  const latRad = safeLat * DEG_TO_RAD;

  const cosZenith = clamp(
    Math.sin(latRad) * Math.sin(declinationRad) +
      Math.cos(latRad) * Math.cos(declinationRad) * Math.cos(haRad),
    -1,
    1
  );
  const zenithRad = Math.acos(cosZenith);
  const zenithDeg = zenithRad * RAD_TO_DEG;
  const rawElevationDeg = 90 - zenithDeg;

  // Approximate NOAA atmospheric refraction correction (deg)
  let refractionDeg: number;
  if (rawElevationDeg > 85) {
    refractionDeg = 0;
  } else if (rawElevationDeg > 5) {
    const te = Math.tan(rawElevationDeg * DEG_TO_RAD);
    refractionDeg = (58.1 / te - 0.07 / (te * te * te) + 0.000086 / Math.pow(te, 5)) / 3600;
  } else if (rawElevationDeg > -0.575) {
    refractionDeg =
      (1735 +
        rawElevationDeg *
          (-518.2 + rawElevationDeg * (103.4 + rawElevationDeg * (-12.79 + rawElevationDeg * 0.711)))) /
      3600;
  } else {
    refractionDeg = -20.772 / Math.tan(rawElevationDeg * DEG_TO_RAD) / 3600;
  }
  const altitudeDeg = Math.round((rawElevationDeg + refractionDeg) * 10) / 10;

  // Solar Azimuth (deg clockwise from True North)
  const sinZenith = Math.sin(zenithRad);
  let azimuthDeg = 180;
  if (Math.abs(sinZenith) > 1e-6 && Math.abs(Math.cos(latRad)) > 1e-6) {
    const cosAz = clamp(
      (Math.sin(latRad) * cosZenith - Math.sin(declinationRad)) / (Math.cos(latRad) * sinZenith),
      -1,
      1
    );
    const baseAz = Math.acos(cosAz) * RAD_TO_DEG;
    azimuthDeg = hourAngleDeg > 0 ? normalizeDeg360(baseAz + 180) : normalizeDeg360(540 - baseAz);
  }

  return {
    altitudeDeg,
    azimuthDeg: Math.round(azimuthDeg * 10) / 10,
  };
}

/**
 * Computes hour angle (degrees) for a target solar altitude angle (degrees above horizon).
 */
function computeHourAngleDeg(latRad: number, declinationRad: number, targetAltDeg: number): number {
  const cosHA =
    (Math.sin(targetAltDeg * DEG_TO_RAD) - Math.sin(latRad) * Math.sin(declinationRad)) /
    (Math.cos(latRad) * Math.cos(declinationRad));
  return Math.acos(clamp(cosHA, -1, 1)) * RAD_TO_DEG;
}

/**
 * Pure client-side NOAA solar calculator for a coordinate, Date, and timezone offset (default UTC+7 Vietnam).
 */
export function calculateSolarTimes(
  lat: number,
  lng: number,
  date: Date = new Date(),
  tzOffsetHours = 7
): SolarCalculationResult {
  const safeLat = clamp(Number.isFinite(lat) ? lat : 22.3033, -89.9, 89.9);
  const safeLng = clamp(Number.isFinite(lng) ? lng : 103.775, -180, 180);
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();

  // Extract calendar Y/M/D and fractional hour in target timezone (tzOffsetHours)
  const shiftedMs = safeDate.getTime() + tzOffsetHours * 3_600_000;
  const shifted = new Date(shiftedMs);
  const year = shifted.getUTCFullYear();
  const monthIndex0 = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const currentLocalHours =
    shifted.getUTCHours() + shifted.getUTCMinutes() / 60 + shifted.getUTCSeconds() / 3600;

  // Evaluate ephemeris at local solar noon (~12:00 local time)
  const noonUtcMs = Date.UTC(year, monthIndex0, day, 12, 0, 0) - tzOffsetHours * 3_600_000;
  const noonJd = toJulianDayFromUtcMs(noonUtcMs);
  const { declinationRad, eqTimeMinutes } = computeSolarEphemeris(noonJd);

  const solarNoonMin = 720 - 4 * safeLng - eqTimeMinutes + tzOffsetHours * 60;
  const latRad = safeLat * DEG_TO_RAD;

  // Standard solar depression/altitude angles:
  // Sunrise / Sunset (refraction + solar semi-diameter): -0.833 deg
  // Civil Twilight (Dawn / Dusk): -6.0 deg
  // Golden Hour threshold (sun 6 deg above horizon): +6.0 deg
  const haSunrise = computeHourAngleDeg(latRad, declinationRad, -0.833);
  const haCivil = computeHourAngleDeg(latRad, declinationRad, -6.0);
  const haGolden = computeHourAngleDeg(latRad, declinationRad, 6.0);

  const civilDawnHours = (solarNoonMin - 4 * haCivil) / 60;
  const sunriseHours = (solarNoonMin - 4 * haSunrise) / 60;
  const goldenHourMorningEndHours = (solarNoonMin - 4 * haGolden) / 60;
  const solarNoonHours = solarNoonMin / 60;
  const goldenHourEveningStartHours = (solarNoonMin + 4 * haGolden) / 60;
  const sunsetHours = (solarNoonMin + 4 * haSunrise) / 60;
  const civilDuskHours = (solarNoonMin + 4 * haCivil) / 60;

  const dayLengthMinutes = Math.max(0, Math.round((sunsetHours - sunriseHours) * 60));

  const sunrisePos = getSunPositionAtLocalHour(safeLat, safeLng, year, monthIndex0, day, sunriseHours, tzOffsetHours);
  const sunsetPos = getSunPositionAtLocalHour(safeLat, safeLng, year, monthIndex0, day, sunsetHours, tzOffsetHours);
  const noonPos = getSunPositionAtLocalHour(safeLat, safeLng, year, monthIndex0, day, solarNoonHours, tzOffsetHours);
  const currentPos = getSunPositionAtLocalHour(
    safeLat,
    safeLng,
    year,
    monthIndex0,
    day,
    currentLocalHours,
    tzOffsetHours
  );

  // Sample 49 points across 00:00..24:00 (every 30 min) for smooth SVG arc plotting
  const arcSamples: SolarArcSample[] = [];
  for (let i = 0; i <= 48; i++) {
    const h = i * 0.5;
    const pos = getSunPositionAtLocalHour(safeLat, safeLng, year, monthIndex0, day, h, tzOffsetHours);
    arcSamples.push({
      hour: h,
      altitudeDeg: pos.altitudeDeg,
      azimuthDeg: pos.azimuthDeg,
    });
  }

  return {
    civilDawn: formatHoursToHHMM(civilDawnHours),
    sunrise: formatHoursToHHMM(sunriseHours),
    goldenHourMorningEnd: formatHoursToHHMM(goldenHourMorningEndHours),
    solarNoon: formatHoursToHHMM(solarNoonHours),
    goldenHourEveningStart: formatHoursToHHMM(goldenHourEveningStartHours),
    sunset: formatHoursToHHMM(sunsetHours),
    civilDusk: formatHoursToHHMM(civilDuskHours),
    dayLengthMinutes,
    sunriseAzimuthDeg: sunrisePos.azimuthDeg,
    sunsetAzimuthDeg: sunsetPos.azimuthDeg,
    currentSunAltitudeDeg: currentPos.altitudeDeg,
    currentSunAzimuthDeg: currentPos.azimuthDeg,
    civilDawnHours,
    sunriseHours,
    goldenHourMorningEndHours,
    solarNoonHours,
    goldenHourEveningStartHours,
    sunsetHours,
    civilDuskHours,
    currentLocalHours,
    solarNoonAltitudeDeg: noonPos.altitudeDeg,
    arcSamples,
  };
}

/**
 * Converts decimal WGS84 degrees to Degrees / Minutes / Seconds (DMS).
 */
export function decimalToDms(deg: number, isLat: boolean): DmsCoordinate {
  const safe = Number.isFinite(deg) ? clamp(deg, isLat ? -90 : -180, isLat ? 90 : 180) : 0;
  const direction: CardinalHemisphere = isLat ? (safe >= 0 ? 'N' : 'S') : safe >= 0 ? 'E' : 'W';
  const absVal = Math.abs(safe);
  let degrees = Math.floor(absVal);
  const minutesFloat = (absVal - degrees) * 60;
  let minutes = Math.floor(minutesFloat);
  let seconds = Math.round((minutesFloat - minutes) * 600) / 10;

  if (seconds >= 60) {
    seconds = 0;
    minutes += 1;
  }
  if (minutes >= 60) {
    minutes = 0;
    degrees += 1;
  }

  const formatted = `${degrees}°${String(minutes).padStart(2, '0')}'${seconds.toFixed(1).padStart(4, '0')}"${direction}`;
  return { degrees, minutes, seconds, direction, formatted };
}

/**
 * Converts Degrees / Minutes / Seconds + hemisphere back to decimal WGS84 degrees.
 */
export function dmsToDecimal(
  degrees: number,
  minutes: number,
  seconds: number,
  direction: CardinalHemisphere
): number {
  const d = Math.abs(Number.isFinite(degrees) ? degrees : 0);
  const m = clamp(Math.abs(Number.isFinite(minutes) ? minutes : 0), 0, 59.9999);
  const s = clamp(Math.abs(Number.isFinite(seconds) ? seconds : 0), 0, 59.9999);
  const sign = direction === 'S' || direction === 'W' ? -1 : 1;
  const isLat = direction === 'N' || direction === 'S';
  const decimal = sign * (d + m / 60 + s / 3600);
  return Math.round(clamp(decimal, isLat ? -90 : -180, isLat ? 90 : 180) * 1_000_000) / 1_000_000;
}

/**
 * Calculates initial forward azimuth bearing in degrees (0..360, clockwise from True North)
 * from Point 1 to Point 2 on a sphere.
 */
export function calculateBearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const dLambda = (lng2 - lng1) * DEG_TO_RAD;

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  const theta = Math.atan2(y, x);
  return Math.round(normalizeDeg360(theta * RAD_TO_DEG) * 10) / 10;
}

/**
 * Calculates great-circle Haversine distance in kilometers between two WGS84 points.
 */
export function calculateHaversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * DEG_TO_RAD) *
      Math.cos(lat2 * DEG_TO_RAD) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return Math.round(EARTH_RADIUS_KM * c * 1000) / 1000;
}

/**
 * Maps compass bearing (0..360) to crisp Vietnamese + international cardinal sector label.
 */
export function getCardinalDirectionLabel(deg: number): string {
  const normalized = normalizeDeg360(deg);
  const sectors = [
    'Bắc (N)',
    'Đông Bắc (NE)',
    'Đông (E)',
    'Đông Nam (SE)',
    'Nam (S)',
    'Tây Nam (SW)',
    'Tây (W)',
    'Tây Bắc (NW)',
  ];
  const index = Math.round(normalized / 45) % 8;
  return sectors[index];
}
