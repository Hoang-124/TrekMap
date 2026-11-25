import zlib from 'zlib';
import { promisify } from 'util';
import { calculateHaversineDistanceKm } from '../utils/spatial.js';

const inflateAsync = promisify(zlib.inflate);

export interface ElevationSamplePoint {
  lat: number;
  lng: number;
  elevationM: number;
  distanceKm: number;
  slopePercent: number;
}

export interface TrailElevationProfile {
  source: 'aws-terrarium-dem' | 'gpx-elevation' | 'interpolated-fallback';
  attribution?: string;
  points: ElevationSamplePoint[];
  minElevationM: number;
  maxElevationM: number;
  totalDistanceKm: number;
  elevationGainM: number;
  maxSlopePercent: number;
}

export const AWS_TERRARIUM_ATTRIBUTION =
  'Terrain: Mapzen/Tilezen (AWS Open Data) · SRTM/NASA, USGS, NOAA';

const MAX_ELEVATION_CACHE = 200;
const elevationCache = new Map<string, { data: TrailElevationProfile; expiresAt: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Pure-Node AWS Open Data Terrarium PNG tile cache (zoom 12 ≈ 35m resolution in Vietnam)
const TERRARIUM_ZOOM = 12;
const MAX_TERRARIUM_TILE_CACHE = 64;
const MAX_TERRARIUM_PNG_BYTES = 2 * 1024 * 1024; // 2 MB compressed tile guard
const MAX_INFLATED_PNG_BYTES = 2048 * 2048 * 4 + 2048; // Zip-bomb inflate cap
const MAX_TILES_PER_REQUEST = 12;
const TILE_FETCH_CONCURRENCY = 4;

export interface DecodedPngImage {
  width: number;
  height: number;
  rgb: Uint8Array; // width * height * 3 (R, G, B)
}

const terrariumTileCache = new Map<string, DecodedPngImage>();
const terrariumTileInFlight = new Map<string, Promise<DecodedPngImage | null>>();

function setTerrariumTileCache(key: string, img: DecodedPngImage) {
  if (terrariumTileCache.size >= MAX_TERRARIUM_TILE_CACHE) {
    const oldestKey = terrariumTileCache.keys().next().value;
    if (oldestKey) terrariumTileCache.delete(oldestKey);
  }
  terrariumTileCache.delete(key);
  terrariumTileCache.set(key, img);
}

function getTerrariumTileCached(key: string): DecodedPngImage | undefined {
  const existing = terrariumTileCache.get(key);
  if (!existing) return undefined;
  // Refresh LRU order
  terrariumTileCache.delete(key);
  terrariumTileCache.set(key, existing);
  return existing;
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

interface ParsedPngMeta {
  width: number;
  height: number;
  colorType: number;
  channels: number;
  palette: Buffer | null;
  idat: Buffer;
}

function parsePngMeta(pngBuffer: Buffer): ParsedPngMeta | null {
  if (!Buffer.isBuffer(pngBuffer) || pngBuffer.length < 33 || pngBuffer.length > MAX_TERRARIUM_PNG_BYTES) {
    return null;
  }

  // Verify 8-byte PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    pngBuffer[0] !== 0x89 ||
    pngBuffer[1] !== 0x50 ||
    pngBuffer[2] !== 0x4e ||
    pngBuffer[3] !== 0x47 ||
    pngBuffer[4] !== 0x0d ||
    pngBuffer[5] !== 0x0a ||
    pngBuffer[6] !== 0x1a ||
    pngBuffer[7] !== 0x0a
  ) {
    return null;
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette: Buffer | null = null;
  const idatChunks: Buffer[] = [];

  let offset = 8;
  while (offset + 12 <= pngBuffer.length) {
    const length = pngBuffer.readUInt32BE(offset);
    const type = pngBuffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > pngBuffer.length) return null;

    if (type === 'IHDR') {
      if (length < 13) return null;
      width = pngBuffer.readUInt32BE(dataStart);
      height = pngBuffer.readUInt32BE(dataStart + 4);
      bitDepth = pngBuffer[dataStart + 8];
      colorType = pngBuffer[dataStart + 9];
      interlace = pngBuffer[dataStart + 12];
    } else if (type === 'PLTE') {
      palette = pngBuffer.subarray(dataStart, dataEnd);
    } else if (type === 'IDAT') {
      idatChunks.push(pngBuffer.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }

    offset = dataEnd + 4; // skip 4-byte CRC
  }

  if (
    width <= 0 ||
    height <= 0 ||
    width > 2048 ||
    height > 2048 ||
    bitDepth !== 8 ||
    interlace !== 0 ||
    idatChunks.length === 0
  ) {
    return null;
  }

  let channels = 0;
  if (colorType === 2) channels = 3; // RGB
  else if (colorType === 6) channels = 4; // RGBA
  else if (colorType === 3) {
    // Indexed-color PNG MUST carry a valid PLTE chunk (multiple of 3 bytes, >= 3 bytes)
    if (!palette || palette.length < 3 || palette.length % 3 !== 0) return null;
    channels = 1;
  } else if (colorType === 0) channels = 1; // Grayscale
  else return null;

  return { width, height, colorType, channels, palette, idat: Buffer.concat(idatChunks) };
}

function reconstructPngRgb(meta: ParsedPngMeta, inflated: Buffer): DecodedPngImage | null {
  const { width, height, colorType, channels, palette } = meta;
  const rowBytes = width * channels;
  const expectedLength = height * (1 + rowBytes);
  if (inflated.length < expectedLength) return null;

  const prevRow = new Uint8Array(rowBytes);
  const currRow = new Uint8Array(rowBytes);
  const rgb = new Uint8Array(width * height * 3);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + rowBytes);
    const filterType = inflated[rowStart];

    for (let x = 0; x < rowBytes; x++) {
      const raw = inflated[rowStart + 1 + x];
      const a = x >= channels ? currRow[x - channels] : 0;
      const b = y > 0 ? prevRow[x] : 0;
      const c = x >= channels && y > 0 ? prevRow[x - channels] : 0;

      let recon: number;
      if (filterType === 0) {
        recon = raw;
      } else if (filterType === 1) {
        recon = (raw + a) & 0xff;
      } else if (filterType === 2) {
        recon = (raw + b) & 0xff;
      } else if (filterType === 3) {
        recon = (raw + ((a + b) >>> 1)) & 0xff;
      } else if (filterType === 4) {
        recon = (raw + paethPredictor(a, b, c)) & 0xff;
      } else {
        return null;
      }
      currRow[x] = recon;
    }

    const rowOutOffset = y * width * 3;
    if (colorType === 2) {
      rgb.set(currRow, rowOutOffset);
    } else if (colorType === 6) {
      for (let px = 0; px < width; px++) {
        rgb[rowOutOffset + px * 3] = currRow[px * 4];
        rgb[rowOutOffset + px * 3 + 1] = currRow[px * 4 + 1];
        rgb[rowOutOffset + px * 3 + 2] = currRow[px * 4 + 2];
      }
    } else if (colorType === 3) {
      if (!palette) return null;
      for (let px = 0; px < width; px++) {
        const idx = currRow[px] * 3;
        if (idx + 2 >= palette.length) return null;
        rgb[rowOutOffset + px * 3] = palette[idx];
        rgb[rowOutOffset + px * 3 + 1] = palette[idx + 1];
        rgb[rowOutOffset + px * 3 + 2] = palette[idx + 2];
      }
    } else {
      for (let px = 0; px < width; px++) {
        const v = currRow[px];
        rgb[rowOutOffset + px * 3] = v;
        rgb[rowOutOffset + px * 3 + 1] = v;
        rgb[rowOutOffset + px * 3 + 2] = v;
      }
    }

    prevRow.set(currRow);
  }

  return { width, height, rgb };
}

/**
 * Pure-Node RFC-2083 PNG decoder using built-in `zlib` with maxOutputLength guard (zero external npm dependencies).
 * Supports non-interlaced 8-bit RGB (colorType 2), RGBA (colorType 6), Indexed Palette (colorType 3),
 * and Grayscale (colorType 0) PNGs with all 5 standard scanline filter types (0..4).
 */
export function decodeTerrariumPng(pngBuffer: Buffer): DecodedPngImage | null {
  const meta = parsePngMeta(pngBuffer);
  if (!meta) return null;

  let inflated: Buffer;
  try {
    inflated = zlib.inflateSync(meta.idat, { maxOutputLength: MAX_INFLATED_PNG_BYTES });
  } catch {
    return null;
  }

  return reconstructPngRgb(meta, inflated);
}

async function decodeTerrariumPngAsync(pngBuffer: Buffer): Promise<DecodedPngImage | null> {
  const meta = parsePngMeta(pngBuffer);
  if (!meta) return null;

  let inflated: Buffer;
  try {
    inflated = (await inflateAsync(meta.idat, { maxOutputLength: MAX_INFLATED_PNG_BYTES })) as Buffer;
  } catch {
    return null;
  }

  return reconstructPngRgb(meta, inflated);
}

function latLngToTerrariumPixel(lat: number, lng: number, zoom = TERRARIUM_ZOOM) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  const n = Math.pow(2, zoom);
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const latRad = (clampedLat * Math.PI) / 180;
  const fx = ((lng + 180) / 360) * n;
  const fy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) return null;
  const tileX = Math.max(0, Math.min(n - 1, Math.floor(fx)));
  const tileY = Math.max(0, Math.min(n - 1, Math.floor(fy)));
  const fracX = Math.max(0, Math.min(0.999999, fx - tileX));
  const fracY = Math.max(0, Math.min(0.999999, fy - tileY));
  return { tileX, tileY, fracX, fracY };
}

async function fetchTerrariumTile(tileX: number, tileY: number, zoom = TERRARIUM_ZOOM): Promise<DecodedPngImage | null> {
  const key = `${zoom}/${tileX}/${tileY}`;
  const cached = getTerrariumTileCached(key);
  if (cached) return cached;

  const pending = terrariumTileInFlight.get(key);
  if (pending) return pending;

  const promise = (async (): Promise<DecodedPngImage | null> => {
    try {
      const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${tileX}/${tileY}.png`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5500) });
      if (!res.ok) {
        res.body?.cancel().catch(() => {});
        return null;
      }
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType && (contentType.includes('text/') || contentType.includes('xml') || contentType.includes('html') || contentType.includes('json'))) {
        res.body?.cancel().catch(() => {});
        return null;
      }
      const contentLen = Number(res.headers.get('content-length') || 0);
      if (Number.isFinite(contentLen) && contentLen > MAX_TERRARIUM_PNG_BYTES) {
        res.body?.cancel().catch(() => {});
        return null;
      }
      const arrayBuf = await res.arrayBuffer();
      if (arrayBuf.byteLength > MAX_TERRARIUM_PNG_BYTES) return null;
      const decoded = await decodeTerrariumPngAsync(Buffer.from(arrayBuf));
      if (!decoded) return null;
      setTerrariumTileCache(key, decoded);
      return decoded;
    } catch {
      return null;
    } finally {
      terrariumTileInFlight.delete(key);
    }
  })();

  terrariumTileInFlight.set(key, promise);
  return promise;
}

/**
 * Samples terrain elevation (meters ASL) from AWS Open Data Terrarium RGB PNG tiles
 * using the Mapzen Terrarium formula: `elevation = (R * 256 + G + B / 256) - 32768`.
 * Bounds unique tile count & S3 fetch concurrency to prevent upstream fan-out abuse.
 */
export async function sampleTerrariumElevations(coords: [number, number][]): Promise<number[] | null> {
  if (!Array.isArray(coords) || coords.length === 0) return [];

  const lookups: Array<{ tileX: number; tileY: number; fracX: number; fracY: number }> = [];
  const uniqueTiles = new Map<string, { tileX: number; tileY: number }>();
  for (const pair of coords) {
    if (!Array.isArray(pair) || pair.length < 2) return null;
    const l = latLngToTerrariumPixel(pair[0], pair[1], TERRARIUM_ZOOM);
    if (!l) return null;
    lookups.push(l);
    const k = `${TERRARIUM_ZOOM}/${l.tileX}/${l.tileY}`;
    if (!uniqueTiles.has(k)) {
      uniqueTiles.set(k, { tileX: l.tileX, tileY: l.tileY });
      if (uniqueTiles.size > MAX_TILES_PER_REQUEST) {
        return null;
      }
    }
  }

  const tileEntries = Array.from(uniqueTiles.entries());
  const tileMap = new Map<string, DecodedPngImage | null>();
  let nextIdx = 0;
  const workers = Math.max(1, Math.min(TILE_FETCH_CONCURRENCY, tileEntries.length));
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (nextIdx < tileEntries.length) {
        const idx = nextIdx++;
        const [k, t] = tileEntries[idx];
        const decoded = await fetchTerrariumTile(t.tileX, t.tileY, TERRARIUM_ZOOM);
        tileMap.set(k, decoded);
      }
    })
  );

  const elevations: number[] = [];
  for (const l of lookups) {
    const key = `${TERRARIUM_ZOOM}/${l.tileX}/${l.tileY}`;
    const img = tileMap.get(key);
    if (!img) return null;
    const px = Math.min(img.width - 1, Math.max(0, Math.floor(l.fracX * img.width)));
    const py = Math.min(img.height - 1, Math.max(0, Math.floor(l.fracY * img.height)));
    const idx = (py * img.width + px) * 3;
    const r = img.rgb[idx];
    const g = img.rgb[idx + 1];
    const b = img.rgb[idx + 2];
    const ele = r * 256 + g + b / 256 - 32768;
    if (!Number.isFinite(ele) || ele < -500 || ele > 9000) return null;
    elevations.push(Math.round(ele * 10) / 10);
  }

  return elevations;
}

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
): Omit<TrailElevationProfile, 'source' | 'attribution'> {
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

  const rawCumKm: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const d = calculateHaversineDistanceKm(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    rawCumKm.push(rawCumKm[i - 1] + d);
  }
  const rawTotal = rawCumKm[rawCumKm.length - 1];

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
 * Fetches authentic terrain DEM elevation (meters ASL) from AWS Open Data Terrarium PNG tiles
 * (100% free commercial, Mapzen/Tilezen/SRTM) with in-memory LRU tile cache and offline fallback.
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

  try {
    const elevations = await sampleTerrariumElevations(sampled);
    if (elevations && elevations.length === sampled.length) {
      const metrics = buildElevationMetrics(sampled, elevations, params.distanceKm);
      const profile: TrailElevationProfile = {
        source: 'aws-terrarium-dem',
        attribution: AWS_TERRARIUM_ATTRIBUTION,
        ...metrics,
      };
      setElevationCache(params.cacheKey, profile, CACHE_TTL_MS);
      return profile;
    }
  } catch {
    // Offline or upstream timeout -> deterministic fallback below
  }

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
