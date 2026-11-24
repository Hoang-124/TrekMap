import { calculateHaversineDistanceKm } from '../utils/spatial.js';

export interface ElevationSamplePoint {
  lat: number;
  lng: number;
  elevationM: number;
  distanceKm: number;
  slopePercent: number;
}

export interface TrailElevationProfile {
  source: 'open-meteo-dem' | 'gpx-elevation' | 'interpolated-fallback';
  points: ElevationSamplePoint[];
  minElevationM: number;
  maxElevationM: number;
  totalDistanceKm: number;
  elevationGainM: number;
  maxSlopePercent: number;
}

const MAX_ELEVATION_CACHE = 200;
const elevationCache = new Map<string, { data: TrailElevationProfile; expiresAt: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function setElevationCache(key: string, data: TrailElevationProfile, ttlMs: number) {
  const now = Date.now();
  if (elevationCache.size >= MAX_ELEVATION_CACHE) {
    for (const [k, v] of elevationCache.entries()) {
      if (v.expiresAt <= now) elevationCache.delete(k);
    }
    if (elevationCache.size >= MAX_ELEVATION_CACHE) {
      const oldestKey = elevationCache.keys().next().value;
      if (oldestKey) elevationCache.delete(oldestKey);
    }
  }
  elevationCache.delete(key);
  elevationCache.set(key, { data, expiresAt: now + ttlMs });
}

export function invalidateElevationCache(cacheKey?: string) {
  if (!cacheKey) {
    elevationCache.clear();
    return;
  }
  elevationCache.delete(cacheKey);
}

/**
 * Downsamples a GPX track to at most maxSamples evenly spaced points (preserving endpoints).
 */
export function sampleTrackPoints(track: [number, number][], maxSamples = 36): [number, number][] {
  if (!Array.isArray(track) || track.length === 0) return [];
  if (track.length <= maxSamples) return track;

  const sampled: [number, number][] = [];
  for (let i = 0; i < maxSamples; i++) {
    const idx = Math.round((i * (track.length - 1)) / (maxSamples - 1));
    sampled.push(track[idx]);
  }
  return sampled;
}

/**
 * Computes cumulative distance (km), hysteresis-filtered elevation gain (m), and realistic segment grade (%).
 */
export function buildElevationMetrics(
  coords: [number, number][],
  elevations: number[],
  fallbackTotalDistanceKm: number
): Omit<TrailElevationProfile, 'source'> {
  if (coords.length === 0) {
    return {
      points: [],
      minElevationM: 0,
      maxElevationM: 0,
      totalDistanceKm: fallbackTotalDistanceKm || 0,
      elevationGainM: 0,
      maxSlopePercent: 0,
    };
  }

  // Compute raw Haversine cumulative distance along the track
  const rawCumKm: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const d = calculateHaversineDistanceKm(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    rawCumKm.push(rawCumKm[i - 1] + d);
  }
  const rawTotal = rawCumKm[rawCumKm.length - 1];

  // Clamp scaleFactor when fallbackTotalDistanceKm reflects out-and-back roundtrip (>1.6x one-way GPX)
  // so slope percentages remain faithful to actual ground gradient
  const rawRatio = rawTotal > 0.05 && fallbackTotalDistanceKm > 0 ? fallbackTotalDistanceKm / rawTotal : 1;
  const distScaleFactor = rawTotal > 0.05 && fallbackTotalDistanceKm > 0 ? rawRatio : 1;
  const slopeScaleFactor = rawRatio > 1.65 ? 1.15 : Math.max(0.75, Math.min(1.5, rawRatio));

  const points: ElevationSamplePoint[] = [];
  let minAlt = Infinity;
  let maxAlt = -Infinity;
  let gainM = 0;
  let maxSlope = 0;
  let hysteresisAnchor = Math.round(elevations[0] ?? 0);

  for (let i = 0; i < coords.length; i++) {
    const alt = Math.round(elevations[i] ?? 0);
    const distKm = Math.round(rawCumKm[i] * distScaleFactor * 100) / 100;
    let slopePercent = 0;

    if (i > 0) {
      const prevAlt = Math.round(elevations[i - 1] ?? alt);
      const deltaAlt = alt - prevAlt;
      // 3m hysteresis threshold suppresses DEM quantization jitter
      if (alt - hysteresisAnchor >= 3) {
        gainM += alt - hysteresisAnchor;
        hysteresisAnchor = alt;
      } else if (alt < hysteresisAnchor - 3) {
        hysteresisAnchor = alt;
      }
      const segMeters = Math.max(25, (rawCumKm[i] - rawCumKm[i - 1]) * slopeScaleFactor * 1000);
      slopePercent = Math.round((deltaAlt / segMeters) * 1000) / 10;
      slopePercent = Math.max(-65, Math.min(65, slopePercent));
      if (Math.abs(slopePercent) > maxSlope) {
        maxSlope = Math.abs(slopePercent);
      }
    }

    if (alt < minAlt) minAlt = alt;
    if (alt > maxAlt) maxAlt = alt;

    points.push({
      lat: coords[i][0],
      lng: coords[i][1],
      elevationM: alt,
      distanceKm: distKm,
      slopePercent,
    });
  }

  return {
    points,
    minElevationM: Number.isFinite(minAlt) ? minAlt : 0,
    maxElevationM: Number.isFinite(maxAlt) ? maxAlt : 0,
    totalDistanceKm: Math.round((rawTotal > 0.05 ? rawTotal * distScaleFactor : fallbackTotalDistanceKm) * 10) / 10,
    elevationGainM: Math.round(gainM),
    maxSlopePercent: Math.round(maxSlope * 10) / 10,
  };
}

/**
 * Fetches authentic terrain DEM elevation (meters above sea level) from Open-Meteo Elevation API
 * for the trail's GPX track coordinates. Caches results with bounded LRU and gracefully falls back if offline.
 */
export async function fetchTrailDemElevation(params: {
  cacheKey: string;
  gpxTrack: [number, number][];
  distanceKm: number;
  maxAltitudeM: number;
  elevationGainM: number;
}): Promise<TrailElevationProfile> {
  const cached = elevationCache.get(params.cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    // Refresh LRU position
    elevationCache.delete(params.cacheKey);
    elevationCache.set(params.cacheKey, cached);
    return cached.data;
  }

  const sampled = sampleTrackPoints(params.gpxTrack, 36);
  if (sampled.length < 2) {
    return {
      source: 'interpolated-fallback',
      points: [],
      minElevationM: Math.max(0, params.maxAltitudeM - params.elevationGainM),
      maxElevationM: params.maxAltitudeM,
      totalDistanceKm: params.distanceKm,
      elevationGainM: params.elevationGainM,
      maxSlopePercent: 0,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const lats = sampled.map((p) => p[0].toFixed(5)).join(',');
    const lngs = sampled.map((p) => p[1].toFixed(5)).join(',');
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;

    const res = await fetch(url, { signal: controller.signal });
    if (res.ok) {
      const json: any = await res.json();
      if (Array.isArray(json?.elevation) && json.elevation.length === sampled.length) {
        const elevations = json.elevation.map((e: any) => (Number.isFinite(Number(e)) ? Number(e) : 0));
        const metrics = buildElevationMetrics(sampled, elevations, params.distanceKm);
        const profile: TrailElevationProfile = {
          source: 'open-meteo-dem',
          ...metrics,
        };
        setElevationCache(params.cacheKey, profile, CACHE_TTL_MS);
        return profile;
      }
    }
  } catch {
    // Offline or upstream timeout -> deterministic fallback below
  } finally {
    clearTimeout(timer);
  }

  // Deterministic geometric fallback anchored to the trail's verified maxAltitudeM & elevationGainM
  const baseAlt = Math.max(50, Math.round(params.maxAltitudeM - params.elevationGainM * 0.85));
  const fallbackElevations = sampled.map((_, idx) => {
    const p = idx / (sampled.length - 1);
    const profileCurve = Math.sin(p * Math.PI);
    return Math.round(baseAlt + (params.maxAltitudeM - baseAlt) * profileCurve);
  });
  const metrics = buildElevationMetrics(sampled, fallbackElevations, params.distanceKm);
  const fallbackProfile: TrailElevationProfile = {
    source: 'interpolated-fallback',
    ...metrics,
  };
  setElevationCache(params.cacheKey, fallbackProfile, 5 * 60 * 1000);
  return fallbackProfile;
}
