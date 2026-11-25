/**
 * 100% Free-for-Commercial Basemap & DEM Sources ($0, keyless, legal in production)
 * - Vector Basemaps: OpenFreeMap (OpenMapTiles + OpenStreetMap ODbL)
 * - Topographic Terrain / Native GPU Hillshade & 3D DEM: AWS Open Data Terrarium (Mapzen/Tilezen · SRTM/NASA, USGS, NOAA)
 * - Satellite Imagery: NASA GIBS (US Govt Public Domain) + optional VITE_SATELLITE_TILE_URL (Copernicus CDSE Sentinel-2)
 */

import type { StyleSpecification } from 'maplibre-gl';
import { fetchWithTimeout } from './sessionHeaders.js';

export type BasemapKey = 'standard' | 'topo' | 'satellite';

// OpenFreeMap keyless free commercial vector styles (no API key, no rate limit)
export const OPENFREEMAP_LIBERTY_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const OPENFREEMAP_POSITRON_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
export const OPENFREEMAP_BRIGHT_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright';
export const OPENFREEMAP_GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

// AWS Open Data Terrarium DEM tiles (100% free commercial, elevation = R*256 + G + B/256 - 32768)
export const AWS_TERRARIUM_TILE_URL =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

// NASA GIBS Public Domain Satellite Imagery (US Govt Public Domain, 100% free commercial)
export const NASA_GIBS_BLUE_MARBLE_URL =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg';

export const NASA_GIBS_VIIRS_URL =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/2025-02-15/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg';

// Clickable legal HTML attributions (never clipped)
export const ATTRIBUTION_OPENFREEMAP_HTML =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · <a href="https://openmaptiles.org" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> · &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors (ODbL)';

export const ATTRIBUTION_AWS_TERRARIUM_HTML =
  'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener noreferrer">Mapzen/Tilezen (AWS Open Data)</a> · SRTM/NASA, USGS, NOAA';

export const ATTRIBUTION_AWS_TERRARIUM_TEXT =
  'Terrain: Mapzen/Tilezen (AWS Open Data) · SRTM/NASA, USGS, NOAA';

export const ATTRIBUTION_NASA_GIBS_HTML =
  'Imagery: <a href="https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs" target="_blank" rel="noopener noreferrer">NASA GIBS (Public Domain)</a>';

function getViteEnvValue(key: string): string {
  if (typeof import.meta === 'undefined') return '';
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const raw = env?.[key];
  return typeof raw === 'string' ? raw.trim() : '';
}

export const CUSTOM_SATELLITE_TILE_URL = getViteEnvValue('VITE_SATELLITE_TILE_URL');
export const CUSTOM_SATELLITE_ATTRIBUTION = getViteEnvValue('VITE_SATELLITE_ATTRIBUTION');

export interface FreeBasemapDefinition {
  key: BasemapKey;
  label: string;
  shortLabel: string;
  kind: 'vector-openfreemap' | 'terrarium-hillshade' | 'raster-satellite';
  url: string;
  fallbackUrl?: string;
  attribution: string;
  maxNativeZoom: number;
  maxZoom: number;
}

export const FREE_BASEMAPS: Record<BasemapKey, FreeBasemapDefinition> = {
  topo: {
    key: 'topo',
    label: 'Địa hình nổi (OpenFreeMap + AWS DEM)',
    shortLabel: 'Địa hình',
    kind: 'terrarium-hillshade',
    url: AWS_TERRARIUM_TILE_URL,
    attribution: `${ATTRIBUTION_OPENFREEMAP_HTML} · ${ATTRIBUTION_AWS_TERRARIUM_HTML}`,
    maxNativeZoom: 14,
    maxZoom: 18,
  },
  standard: {
    key: 'standard',
    label: 'Bản đồ nền sáng (OpenFreeMap)',
    shortLabel: 'Bản đồ',
    kind: 'vector-openfreemap',
    url: OPENFREEMAP_POSITRON_STYLE_URL,
    fallbackUrl: OPENFREEMAP_LIBERTY_STYLE_URL,
    attribution: ATTRIBUTION_OPENFREEMAP_HTML,
    maxNativeZoom: 15,
    maxZoom: 18,
  },
  satellite: {
    key: 'satellite',
    label: CUSTOM_SATELLITE_TILE_URL ? 'Ảnh vệ tinh (Copernicus / Tùy chỉnh)' : 'Ảnh vệ tinh (NASA GIBS)',
    shortLabel: 'Vệ tinh',
    kind: 'raster-satellite',
    url: CUSTOM_SATELLITE_TILE_URL || NASA_GIBS_VIIRS_URL,
    fallbackUrl: NASA_GIBS_BLUE_MARBLE_URL,
    attribution: CUSTOM_SATELLITE_TILE_URL
      ? CUSTOM_SATELLITE_ATTRIBUTION ||
        `Contains modified Copernicus Sentinel data · ${ATTRIBUTION_NASA_GIBS_HTML}`
      : ATTRIBUTION_NASA_GIBS_HTML,
    maxNativeZoom: CUSTOM_SATELLITE_TILE_URL ? 16 : 9,
    maxZoom: 18,
  },
};

export const FREE_BASEMAP_ORDER: BasemapKey[] = ['topo', 'standard', 'satellite'];

/**
 * Low-end device performance profile for MapLibre WebGL canvas.
 * Respects `document.documentElement.dataset.perf === 'lite'`.
 */
export function isLitePerfMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.perf === 'lite';
}

export interface MapPerformanceConfig {
  isLiteMode: boolean;
  pixelRatio: number;
  maxTileCacheSize: number;
  fadeDuration: number;
  antialias: boolean;
  cooperativeGestures: false;
  preserveDrawingBuffer: false;
}

export function getMapPerformanceConfig(forceLite?: boolean): MapPerformanceConfig {
  const isLiteMode = typeof forceLite === 'boolean' ? forceLite : isLitePerfMode();
  const dpr = typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1;
  return {
    isLiteMode,
    pixelRatio: Math.min(Math.max(1, dpr), isLiteMode ? 1.25 : 1.75),
    maxTileCacheSize: isLiteMode ? 24 : 48,
    fadeDuration: isLiteMode ? 0 : 120,
    antialias: !isLiteMode,
    cooperativeGestures: false,
    preserveDrawingBuffer: false,
  };
}

/**
 * WebGL paint color palette (WebGL fragment shaders require concrete hex/rgb strings).
 * Reads active CSS custom properties from :root so WebGL overlays harmonize with Dark & Light themes.
 */
export interface MapWebGLPalette {
  primary: string;
  danger: string;
  warn: string;
  info: string;
  muted: string;
  surface: string;
  ink: string;
  strokeLight: string;
  casingDark: string;
  labelHalo: string;
  easy: string;
  medium: string;
  hard: string;
  highlightCore: string;
  waypointCampsite: string;
  waypointWater: string;
  waypointDanger: string;
  waypointViewpoint: string;
  waypointSummit: string;
  waypointRest: string;
}

const DEFAULT_WEBGL_PALETTE: MapWebGLPalette = {
  primary: '#2d8a61',
  danger: '#c8473c',
  warn: '#d4a348',
  info: '#3888b3',
  muted: '#64748b',
  surface: '#141916',
  ink: '#f4f3ee',
  strokeLight: '#ffffff',
  casingDark: '#0c1110',
  labelHalo: '#0c0f0d',
  easy: '#10b981',
  medium: '#d97706',
  hard: '#dc2626',
  highlightCore: '#ffffff',
  waypointCampsite: '#10b981',
  waypointWater: '#0284c7',
  waypointDanger: '#dc2626',
  waypointViewpoint: '#d97706',
  waypointSummit: '#eab308',
  waypointRest: '#0d9488',
};

function readCssColor(style: CSSStyleDeclaration | null, token: string, fallback: string): string {
  if (!style) return fallback;
  const val = style.getPropertyValue(token).trim();
  return val || fallback;
}

export function resolveMapWebGLPalette(): MapWebGLPalette {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return DEFAULT_WEBGL_PALETTE;
  }
  const computed = window.getComputedStyle(document.documentElement);
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    primary: readCssColor(computed, '--color-primary', DEFAULT_WEBGL_PALETTE.primary),
    danger: readCssColor(computed, '--color-error', DEFAULT_WEBGL_PALETTE.danger),
    warn: readCssColor(computed, '--color-sun', DEFAULT_WEBGL_PALETTE.warn),
    info: readCssColor(computed, '--color-sky', DEFAULT_WEBGL_PALETTE.info),
    muted: readCssColor(computed, '--color-text-dim', DEFAULT_WEBGL_PALETTE.muted),
    surface: isLight ? '#171c19' : '#111814',
    ink: '#f8fafc',
    strokeLight: '#ffffff',
    casingDark: isLight ? '#0f172a' : '#020617',
    labelHalo: isLight ? '#ffffff' : '#0b100e',
    easy: isLight ? '#16794f' : '#22c55e',
    medium: isLight ? '#b45309' : '#f59e0b',
    hard: isLight ? '#b91c1c' : '#ef4444',
    highlightCore: '#ffffff',
    waypointCampsite: '#10b981',
    waypointWater: '#0284c7',
    waypointDanger: '#dc2626',
    waypointViewpoint: '#d97706',
    waypointSummit: '#eab308',
    waypointRest: '#0d9488',
  };
}

/**
 * Generates a geodesic closed polygon ring ([lng, lat][]) for GPU GeoJSON circle rendering.
 */
export function buildGeoJsonCircleRing(
  lat: number,
  lng: number,
  radiusMeters: number,
  steps = 48
): [number, number][] {
  const safeRadius = Math.max(1, Number(radiusMeters) || 1);
  const earthRadiusM = 6_371_000;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const angularDist = safeRadius / earthRadiusM;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinAng = Math.sin(angularDist);
  const cosAng = Math.cos(angularDist);

  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI;
    const pLat = Math.asin(sinLat * cosAng + cosLat * sinAng * Math.cos(bearing));
    const pLng =
      lngRad +
      Math.atan2(Math.sin(bearing) * sinAng * cosLat, cosAng - sinLat * Math.sin(pLat));
    ring.push([(pLng * 180) / Math.PI, (pLat * 180) / Math.PI]);
  }
  return ring;
}

/**
 * Decodes Terrarium RGB pixel into elevation in meters above sea level.
 * Formula: (R * 256 + G + B / 256) - 32768
 */
export function decodeTerrariumRgbMeters(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

export function buildTerrariumTileUrl(z: number, x: number, y: number): string {
  return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
}

/**
 * Computes Web Mercator fractional tile + pixel (0..255) coordinates at zoom z.
 */
function latLngToTilePixel(
  lat: number,
  lng: number,
  zoom: number
): { x: number; y: number; px: number; py: number } {
  const n = Math.pow(2, zoom);
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const latRad = (clampedLat * Math.PI) / 180;
  const xFloat = ((lng + 180) / 360) * n;
  const yFloat = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const x = Math.max(0, Math.min(n - 1, Math.floor(xFloat)));
  const y = Math.max(0, Math.min(n - 1, Math.floor(yFloat)));
  const px = Math.max(0, Math.min(255, Math.floor((xFloat - x) * 256)));
  const py = Math.max(0, Math.min(255, Math.floor((yFloat - y) * 256)));
  return { x, y, px, py };
}

const terrariumPixelCache = new Map<string, Uint8ClampedArray>();
const MAX_TERRARIUM_PIXEL_CACHE = 24;

async function loadTerrariumTilePixels(
  z: number,
  x: number,
  y: number,
  signal?: AbortSignal
): Promise<Uint8ClampedArray | null> {
  const key = `${z}/${x}/${y}`;
  const cached = terrariumPixelCache.get(key);
  if (cached) return cached;

  if (typeof document === 'undefined' || typeof fetch === 'undefined') return null;

  const url = buildTerrariumTileUrl(z, x, y);
  try {
    const res = await fetchWithTimeout(url, { mode: 'cors', signal }, 10_000);
    if (!res.ok) return null;
    if (res.headers.get('x-lost-offline-fallback') === '1') return null;
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) return null;

    const blob = await res.blob();
    let pixels: Uint8ClampedArray | null = null;

    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob);
      try {
        if (bitmap.width < 256 || bitmap.height < 256) return null;
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(bitmap, 0, 0, 256, 256);
        pixels = ctx.getImageData(0, 0, 256, 256).data;
      } finally {
        bitmap.close();
      }
    } else {
      const objUrl = URL.createObjectURL(blob);
      try {
        pixels = await new Promise<Uint8ClampedArray | null>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            if (img.naturalWidth < 256 || img.naturalHeight < 256) {
              resolve(null);
              return;
            }
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
              resolve(null);
              return;
            }
            ctx.drawImage(img, 0, 0, 256, 256);
            resolve(ctx.getImageData(0, 0, 256, 256).data);
          };
          img.onerror = () => resolve(null);
          img.src = objUrl;
        });
      } finally {
        URL.revokeObjectURL(objUrl);
      }
    }

    if (pixels) {
      if (terrariumPixelCache.size >= MAX_TERRARIUM_PIXEL_CACHE) {
        const oldestKey = terrariumPixelCache.keys().next().value;
        if (oldestKey) terrariumPixelCache.delete(oldestKey);
      }
      terrariumPixelCache.set(key, pixels);
    }
    return pixels;
  } catch {
    return null;
  }
}

/**
 * Browser-side 100% free commercial DEM elevation sampling directly from AWS Open Data Terrarium PNG tiles.
 * Used on-demand by RoutePlannerView for point elevation profiles (NEVER in map tile rendering).
 * Works online AND offline whenever the trail's Offline Pack cached z=12 Terrarium tiles.
 */
export async function sampleTerrariumElevations(
  coords: [number, number][],
  options?: { zoom?: number; signal?: AbortSignal }
): Promise<number[] | null> {
  if (!Array.isArray(coords) || coords.length === 0) return null;
  const zoom = options?.zoom ?? 12;
  const signal = options?.signal;

  const mapped = coords.map(([lat, lng]) => latLngToTilePixel(lat, lng, zoom));
  const uniqueTiles = new Map<string, { x: number; y: number }>();
  for (const m of mapped) {
    const k = `${m.x}/${m.y}`;
    if (!uniqueTiles.has(k)) uniqueTiles.set(k, { x: m.x, y: m.y });
  }

  // Cap tile fan-out for safety on huge cross-country tracks
  const tileEntries = Array.from(uniqueTiles.entries()).slice(0, 12);
  const loadedMap = new Map<string, Uint8ClampedArray>();

  await Promise.all(
    tileEntries.map(async ([key, { x, y }]) => {
      const pixels = await loadTerrariumTilePixels(zoom, x, y, signal);
      if (pixels) loadedMap.set(key, pixels);
    })
  );

  if (loadedMap.size === 0) return null;

  const elevations: number[] = [];
  let validSamples = 0;

  for (const m of mapped) {
    const pixels = loadedMap.get(`${m.x}/${m.y}`);
    if (!pixels) {
      elevations.push(NaN);
      continue;
    }
    const idx = (m.py * 256 + m.px) * 4;
    const ele = decodeTerrariumRgbMeters(pixels[idx], pixels[idx + 1], pixels[idx + 2]);
    if (Number.isFinite(ele) && ele > -500 && ele < 9000) {
      elevations.push(Math.max(0, Math.round(ele)));
      validSamples += 1;
    } else {
      elevations.push(NaN);
    }
  }

  if (validSamples === 0) return null;

  // Fill any uncached edge points by nearest valid neighbor
  let lastValid = elevations.find((v) => Number.isFinite(v)) ?? 0;
  for (let i = 0; i < elevations.length; i++) {
    if (Number.isFinite(elevations[i])) {
      lastValid = elevations[i];
    } else {
      elevations[i] = lastValid;
    }
  }

  return elevations;
}

// ============================================================================
// MODULE-CACHED PURE GPU MAPLIBRE STYLE BUILDERS (0 REFETCH ON BASEMAP SWITCH)
// ============================================================================

type OpenFreeMapVariant = 'liberty' | 'positron';

const openFreeMapStyleCache = new Map<OpenFreeMapVariant, StyleSpecification>();
const openFreeMapInFlight = new Map<OpenFreeMapVariant, Promise<StyleSpecification | null>>();

function cloneStyleSpec(style: StyleSpecification): StyleSpecification {
  if (typeof structuredClone === 'function') {
    return structuredClone(style);
  }
  return JSON.parse(JSON.stringify(style)) as StyleSpecification;
}

/**
 * Fetches OpenFreeMap Liberty or Positron style JSON ONCE and caches it in module memory
 * so switching between topo / standard / satellite or reopening 3D modal requires 0 network refetches.
 */
export async function fetchCachedOpenFreeMapStyle(
  variant: OpenFreeMapVariant,
  signal?: AbortSignal
): Promise<StyleSpecification | null> {
  const cached = openFreeMapStyleCache.get(variant);
  if (cached) return cloneStyleSpec(cached);

  if (typeof fetch === 'undefined') return null;

  let pending = openFreeMapInFlight.get(variant);
  if (!pending) {
    const url = variant === 'positron' ? OPENFREEMAP_POSITRON_STYLE_URL : OPENFREEMAP_LIBERTY_STYLE_URL;
    pending = fetchWithTimeout(url, { mode: 'cors' }, 8_000)
      .then(async (res) => {
        if (!res.ok) return null;
        const json = (await res.json()) as StyleSpecification;
        if (!json || typeof json !== 'object' || !json.sources || !Array.isArray(json.layers)) {
          return null;
        }
        openFreeMapStyleCache.set(variant, json);
        return json;
      })
      .catch(() => null)
      .finally(() => {
        openFreeMapInFlight.delete(variant);
      });
    openFreeMapInFlight.set(variant, pending);
  }

  const resolved = await pending;
  if (signal?.aborted || !resolved) return null;
  return cloneStyleSpec(resolved);
}

/**
 * Pure GPU Offline-Safe Terrarium Relief Style (fallback when OpenFreeMap is offline or unreachable).
 * Uses MapLibre's native GPU `type: 'hillshade'` shader on AWS Open Data Terrarium DEM (0 CPU loops).
 */
export function buildOfflineTerrariumReliefStyle(options?: {
  enable3DTerrain?: boolean;
  exaggeration?: number;
  isLiteMode?: boolean;
}): StyleSpecification {
  const enable3D = Boolean(options?.enable3DTerrain);
  const exaggeration = options?.exaggeration ?? 1.6;
  const isLiteMode = Boolean(options?.isLiteMode);

  const sources: StyleSpecification['sources'] = {
    awsHillshadeDem: {
      type: 'raster-dem',
      tiles: [AWS_TERRARIUM_TILE_URL],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 14,
      attribution: ATTRIBUTION_AWS_TERRARIUM_TEXT,
    },
  };

  if (enable3D) {
    sources.awsTerrainDem = {
      type: 'raster-dem',
      tiles: [AWS_TERRARIUM_TILE_URL],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 14,
      attribution: ATTRIBUTION_AWS_TERRARIUM_TEXT,
    };
  }

  const style: StyleSpecification = {
    version: 8,
    glyphs: OPENFREEMAP_GLYPHS_URL,
    sources,
    layers: [
      {
        id: 'lost-relief-paper-bg',
        type: 'background',
        paint: {
          'background-color': '#e7ebe5',
        },
      },
      {
        id: 'aws-terrain-hillshade',
        type: 'hillshade',
        source: 'awsHillshadeDem',
        paint: {
          'hillshade-method': isLiteMode ? 'standard' : 'multidirectional',
          'hillshade-exaggeration': 0.62,
          'hillshade-shadow-color': '#1e293b',
          'hillshade-highlight-color': '#f8fafc',
          'hillshade-accent-color': '#475569',
        },
      },
    ],
  };

  if (enable3D) {
    style.terrain = { source: 'awsTerrainDem', exaggeration };
    style.sky = {
      'sky-color': '#1e3a5f',
      'horizon-color': '#93c5fd',
      'fog-color': '#cbd5e1',
      'fog-ground-blend': 0.5,
      'horizon-fog-blend': 0.6,
      'sky-horizon-blend': 0.8,
      'atmosphere-blend': 0.7,
    };
  }

  return style;
}

/**
 * Pure GPU Satellite Style: NASA GIBS Public Domain (BlueMarble z0-8 + VIIRS z0-9 or optional VITE_SATELLITE_TILE_URL)
 * + native GPU AWS Terrarium hillshade for crisp mountain ridge depth at high zooms.
 */
export function buildSatelliteMapStyle(options?: {
  enable3DTerrain?: boolean;
  exaggeration?: number;
  isLiteMode?: boolean;
}): StyleSpecification {
  const enable3D = Boolean(options?.enable3DTerrain);
  const exaggeration = options?.exaggeration ?? 1.6;
  const isLiteMode = Boolean(options?.isLiteMode);
  const customSat = CUSTOM_SATELLITE_TILE_URL;
  const satAttribution = customSat
    ? CUSTOM_SATELLITE_ATTRIBUTION ||
      `Contains modified Copernicus Sentinel data · ${ATTRIBUTION_NASA_GIBS_HTML}`
    : ATTRIBUTION_NASA_GIBS_HTML;

  const sources: StyleSpecification['sources'] = {
    nasaBlueMarble: {
      type: 'raster',
      tiles: [NASA_GIBS_BLUE_MARBLE_URL],
      tileSize: 256,
      attribution: ATTRIBUTION_NASA_GIBS_HTML,
      maxzoom: 8,
    },
    nasaSatellite: {
      type: 'raster',
      tiles: [customSat || NASA_GIBS_VIIRS_URL],
      tileSize: 256,
      attribution: satAttribution,
      maxzoom: customSat ? 16 : 9,
    },
    awsHillshadeDem: {
      type: 'raster-dem',
      tiles: [AWS_TERRARIUM_TILE_URL],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 14,
      attribution: ATTRIBUTION_AWS_TERRARIUM_TEXT,
    },
  };

  if (enable3D) {
    sources.awsTerrainDem = {
      type: 'raster-dem',
      tiles: [AWS_TERRARIUM_TILE_URL],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 14,
      attribution: ATTRIBUTION_AWS_TERRARIUM_TEXT,
    };
  }

  const style: StyleSpecification = {
    version: 8,
    glyphs: OPENFREEMAP_GLYPHS_URL,
    sources,
    layers: [
      {
        id: 'nasa-bluemarble-base',
        type: 'raster',
        source: 'nasaBlueMarble',
      },
      {
        id: 'nasa-satellite-layer',
        type: 'raster',
        source: 'nasaSatellite',
        paint: {
          'raster-opacity': 0.94,
        },
      },
      {
        id: 'aws-terrain-hillshade',
        type: 'hillshade',
        source: 'awsHillshadeDem',
        paint: {
          'hillshade-method': isLiteMode ? 'standard' : 'multidirectional',
          'hillshade-exaggeration': enable3D ? 0.42 : 0.34,
          'hillshade-shadow-color': '#0f172a',
          'hillshade-highlight-color': '#f8fafc',
          'hillshade-accent-color': '#334155',
        },
      },
    ],
  };

  if (enable3D) {
    style.terrain = { source: 'awsTerrainDem', exaggeration };
    style.sky = {
      'sky-color': '#1e3a5f',
      'horizon-color': '#93c5fd',
      'fog-color': '#cbd5e1',
      'fog-ground-blend': 0.5,
      'horizon-fog-blend': 0.6,
      'sky-horizon-blend': 0.8,
      'atmosphere-blend': 0.7,
    };
  }

  return style;
}

function attachOpenFreeMapAttribution(sources: StyleSpecification['sources']): StyleSpecification['sources'] {
  const next: StyleSpecification['sources'] = { ...sources };
  for (const srcKey of Object.keys(next)) {
    const src = next[srcKey];
    if (src && src.type === 'vector') {
      next[srcKey] = {
        ...src,
        attribution: ATTRIBUTION_OPENFREEMAP_HTML,
      };
    }
  }
  return next;
}

function composeVectorStyleWithRelief(
  baseStyle: StyleSpecification,
  options: {
    includeHillshade: boolean;
    enable3DTerrain: boolean;
    exaggeration: number;
    isLiteMode: boolean;
  }
): StyleSpecification {
  const sources = attachOpenFreeMapAttribution(baseStyle.sources);
  const layers = [...baseStyle.layers];

  if (options.includeHillshade) {
    sources.awsHillshadeDem = {
      type: 'raster-dem',
      tiles: [AWS_TERRARIUM_TILE_URL],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 14,
      attribution: ATTRIBUTION_AWS_TERRARIUM_TEXT,
    };

    const insertIdx = layers.findIndex(
      (l) => l.type === 'line' || l.type === 'symbol' || l.id.includes('water') || l.id.includes('road')
    );

    const hillshadeLayer = {
      id: 'aws-terrain-hillshade',
      type: 'hillshade' as const,
      source: 'awsHillshadeDem',
      paint: {
        'hillshade-method': (options.isLiteMode ? 'standard' : 'multidirectional') as 'standard' | 'multidirectional',
        'hillshade-exaggeration': options.enable3DTerrain ? 0.38 : 0.5,
        'hillshade-shadow-color': '#1e293b',
        'hillshade-highlight-color': '#ffffff',
        'hillshade-accent-color': '#475569',
      },
    };

    if (insertIdx > 0) {
      layers.splice(insertIdx, 0, hillshadeLayer);
    } else {
      layers.push(hillshadeLayer);
    }
  }

  const composed: StyleSpecification = {
    ...baseStyle,
    glyphs: baseStyle.glyphs || OPENFREEMAP_GLYPHS_URL,
    sources,
    layers,
  };

  if (options.enable3DTerrain) {
    sources.awsTerrainDem = {
      type: 'raster-dem',
      tiles: [AWS_TERRARIUM_TILE_URL],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 14,
      attribution: ATTRIBUTION_AWS_TERRARIUM_TEXT,
    };
    composed.terrain = {
      source: 'awsTerrainDem',
      exaggeration: options.exaggeration,
    };
    composed.sky = {
      'sky-color': '#1e3a5f',
      'horizon-color': '#93c5fd',
      'fog-color': '#cbd5e1',
      'fog-ground-blend': 0.5,
      'horizon-fog-blend': 0.6,
      'sky-horizon-blend': 0.8,
      'atmosphere-blend': 0.7,
    };
  }

  return composed;
}

/**
 * Synchronously returns a ready-to-mount GPU style if OpenFreeMap is already cached in memory
 * (or immediately for 'satellite'), avoiding any shell-to-vector flash on subsequent mounts.
 */
export function getCachedLostBasemapStyleSync(
  basemap: BasemapKey,
  options?: {
    enable3DTerrain?: boolean;
    exaggeration?: number;
    isLiteMode?: boolean;
  }
): { style: StyleSpecification; needsAsyncUpgrade: boolean } {
  const enable3DTerrain = Boolean(options?.enable3DTerrain);
  const exaggeration = options?.exaggeration ?? 1.6;
  const isLiteMode = options?.isLiteMode ?? isLitePerfMode();

  if (basemap === 'satellite') {
    return {
      style: buildSatelliteMapStyle({ enable3DTerrain, exaggeration, isLiteMode }),
      needsAsyncUpgrade: false,
    };
  }

  if (basemap === 'standard') {
    const cachedPositron = openFreeMapStyleCache.get('positron');
    if (cachedPositron) {
      return {
        style: composeVectorStyleWithRelief(cloneStyleSpec(cachedPositron), {
          includeHillshade: false,
          enable3DTerrain,
          exaggeration,
          isLiteMode,
        }),
        needsAsyncUpgrade: false,
      };
    }
    return {
      style: buildOfflineTerrariumReliefStyle({ enable3DTerrain, exaggeration, isLiteMode }),
      needsAsyncUpgrade: true,
    };
  }

  const cachedLiberty = openFreeMapStyleCache.get('liberty');
  if (cachedLiberty) {
    return {
      style: composeVectorStyleWithRelief(cloneStyleSpec(cachedLiberty), {
        includeHillshade: true,
        enable3DTerrain,
        exaggeration,
        isLiteMode,
      }),
      needsAsyncUpgrade: false,
    };
  }
  return {
    style: buildOfflineTerrariumReliefStyle({ enable3DTerrain, exaggeration, isLiteMode }),
    needsAsyncUpgrade: true,
  };
}

/**
 * Resolves a cached, 100% free commercial MapLibre GPU StyleSpecification for any basemap:
 * - 'topo': OpenFreeMap Liberty + native GPU AWS Terrarium hillshade (offline fallback: pure AWS Terrarium GPU hillshade)
 * - 'standard': OpenFreeMap Positron vector (fallback: Liberty -> offline Terrarium hillshade)
 * - 'satellite': NASA GIBS Public Domain BlueMarble + VIIRS (+ optional VITE_SATELLITE_TILE_URL) + subtle AWS hillshade
 */
export async function resolveLostBasemapStyle(
  basemap: BasemapKey,
  options?: {
    enable3DTerrain?: boolean;
    exaggeration?: number;
    isLiteMode?: boolean;
    signal?: AbortSignal;
  }
): Promise<StyleSpecification> {
  const enable3DTerrain = Boolean(options?.enable3DTerrain);
  const exaggeration = options?.exaggeration ?? 1.6;
  const isLiteMode = options?.isLiteMode ?? isLitePerfMode();

  if (basemap === 'satellite') {
    return buildSatelliteMapStyle({ enable3DTerrain, exaggeration, isLiteMode });
  }

  if (basemap === 'standard') {
    const positron = await fetchCachedOpenFreeMapStyle('positron', options?.signal);
    if (positron) {
      return composeVectorStyleWithRelief(positron, {
        includeHillshade: false,
        enable3DTerrain,
        exaggeration,
        isLiteMode,
      });
    }
    const libertyFallback = await fetchCachedOpenFreeMapStyle('liberty', options?.signal);
    if (libertyFallback) {
      return composeVectorStyleWithRelief(libertyFallback, {
        includeHillshade: false,
        enable3DTerrain,
        exaggeration,
        isLiteMode,
      });
    }
    return buildOfflineTerrariumReliefStyle({ enable3DTerrain, exaggeration, isLiteMode });
  }

  // 'topo' — OpenFreeMap Liberty + Native GPU AWS Terrarium Hillshade
  const liberty = await fetchCachedOpenFreeMapStyle('liberty', options?.signal);
  if (liberty) {
    return composeVectorStyleWithRelief(liberty, {
      includeHillshade: true,
      enable3DTerrain,
      exaggeration,
      isLiteMode,
    });
  }
  return buildOfflineTerrariumReliefStyle({ enable3DTerrain, exaggeration, isLiteMode });
}

export type Terrain3DBasemapMode = 'outdoor' | 'satellite';

/**
 * Builds a 100% free commercial MapLibre 3D style with NASA GIBS Public Domain satellite imagery
 * (or optional VITE_SATELLITE_TILE_URL) + AWS Open Data Terrarium 3D DEM + hillshade relief.
 */
export function buildSatellite3DStyle(exaggeration = 1.6): StyleSpecification {
  return buildSatelliteMapStyle({
    enable3DTerrain: true,
    exaggeration,
    isLiteMode: isLitePerfMode(),
  });
}

export function isOfflineReliefFallbackStyle(style: StyleSpecification | null | undefined): boolean {
  return Boolean(
    style &&
      Array.isArray(style.layers) &&
      style.layers.some((layer) => layer.id === 'lost-relief-paper-bg')
  );
}

/**
 * Uses cached OpenFreeMap Liberty vector style + AWS Open Data Terrarium 3D DEM + native GPU hillshade + sky.
 * Falls back cleanly to offline-capable AWS Terrarium 3D relief style if OpenFreeMap is unreachable.
 */
export async function resolveTerrain3DStyle(
  mode: Terrain3DBasemapMode,
  exaggeration = 1.6,
  signal?: AbortSignal
): Promise<StyleSpecification> {
  if (mode === 'satellite') {
    return buildSatellite3DStyle(exaggeration);
  }

  const liberty = await fetchCachedOpenFreeMapStyle('liberty', signal);
  if (!liberty) {
    return buildOfflineTerrariumReliefStyle({
      enable3DTerrain: true,
      exaggeration,
      isLiteMode: isLitePerfMode(),
    });
  }

  return composeVectorStyleWithRelief(liberty, {
    includeHillshade: true,
    enable3DTerrain: true,
    exaggeration,
    isLiteMode: isLitePerfMode(),
  });
}
