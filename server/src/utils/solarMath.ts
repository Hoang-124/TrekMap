/**
 * Pure Server-Side NOAA Solar Equations (Jean Meeus) — 100% Local & Offline
 * Calibrated for Vietnam (UTC+7 / Asia/Ho_Chi_Minh). Zero external API calls.
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

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function normalizeDeg360(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

export function formatHoursToHHMM(hours: number): string {
  if (!Number.isFinite(hours)) return '--:--';
  const wrapped = ((hours % 24) + 24) % 24;
  let totalMinutes = Math.round(wrapped * 60);
  if (totalMinutes >= 24 * 60) totalMinutes = 0;
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function toJulianDayFromUtcMs(utcMs: number): number {
  return utcMs / 86_400_000 + 2440587.5;
}

interface SolarEphemeris {
  declinationRad: number;
  eqTimeMinutes: number;
}

function computeSolarEphemeris(julianDay: number): SolarEphemeris {
  const T = (julianDay - 2451545.0) / 36525.0;

  const L0 = normalizeDeg360(280.46646 + T * (36000.76983 + 0.0003032 * T));
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const Mrad = M * DEG_TO_RAD;

  const eccent = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const eqCenter =
    Math.sin(Mrad) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * Mrad) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * Mrad) * 0.000289;

  const sunTrueLon = L0 + eqCenter;
  const omega = (125.04 - 1934.136 * T) * DEG_TO_RAD;
  const sunAppLon = sunTrueLon - 0.00569 - 0.00478 * Math.sin(omega);

  const meanObliq =
    23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const obliqCorr = meanObliq + 0.00256 * Math.cos(omega);
  const obliqCorrRad = obliqCorr * DEG_TO_RAD;

  const declinationRad = Math.asin(
    clamp(Math.sin(obliqCorrRad) * Math.sin(sunAppLon * DEG_TO_RAD), -1, 1)
  );

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
  const hourAngleDeg =
    trueSolarTimeMin / 4 < 0 ? trueSolarTimeMin / 4 + 180 : trueSolarTimeMin / 4 - 180;
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
          (-518.2 +
            rawElevationDeg * (103.4 + rawElevationDeg * (-12.79 + rawElevationDeg * 0.711)))) /
      3600;
  } else {
    refractionDeg = -20.772 / Math.tan(rawElevationDeg * DEG_TO_RAD) / 3600;
  }
  const altitudeDeg = Math.round((rawElevationDeg + refractionDeg) * 10) / 10;

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

function computeHourAngleDeg(latRad: number, declinationRad: number, targetAltDeg: number): number {
  const cosHA =
    (Math.sin(targetAltDeg * DEG_TO_RAD) - Math.sin(latRad) * Math.sin(declinationRad)) /
    (Math.cos(latRad) * Math.cos(declinationRad));
  return Math.acos(clamp(cosHA, -1, 1)) * RAD_TO_DEG;
}

export function calculateSolarTimes(
  lat: number,
  lng: number,
  date: Date = new Date(),
  tzOffsetHours = 7
): SolarCalculationResult {
  const safeLat = clamp(Number.isFinite(lat) ? lat : 22.3033, -89.9, 89.9);
  const safeLng = clamp(Number.isFinite(lng) ? lng : 103.775, -180, 180);
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();

  const shiftedMs = safeDate.getTime() + tzOffsetHours * 3_600_000;
  const shifted = new Date(shiftedMs);
  const year = shifted.getUTCFullYear();
  const monthIndex0 = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const currentLocalHours =
    shifted.getUTCHours() + shifted.getUTCMinutes() / 60 + shifted.getUTCSeconds() / 3600;

  const noonUtcMs = Date.UTC(year, monthIndex0, day, 12, 0, 0) - tzOffsetHours * 3_600_000;
  const noonJd = toJulianDayFromUtcMs(noonUtcMs);
  const { declinationRad, eqTimeMinutes } = computeSolarEphemeris(noonJd);

  const solarNoonMin = 720 - 4 * safeLng - eqTimeMinutes + tzOffsetHours * 60;
  const latRad = safeLat * DEG_TO_RAD;

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
