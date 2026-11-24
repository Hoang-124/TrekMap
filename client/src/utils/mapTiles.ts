/**
 * 100% Free-for-Commercial Basemap & DEM Sources ($0, keyless, legal in production)
 * - Vector Standard / Outdoor: OpenFreeMap (OpenMapTiles + OpenStreetMap ODbL)
 * - Topographic Terrain / DEM: AWS Open Data Terrarium (Mapzen/Tilezen · SRTM/NASA, USGS, NOAA)
 * - Satellite Imagery: NASA GIBS (US Govt Public Domain) + optional VITE_SATELLITE_TILE_URL (Copernicus CDSE Sentinel-2)
 */

import type { StyleSpecification } from 'maplibre-gl';

export type BasemapKey = 'standard' | 'topo' | 'satellite';

// OpenFreeMap keyless free commercial vector styles (no API key, no view limit)
export const OPENFREEMAP_LIBERTY_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const OPENFREEMAP_POSITRON_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
export const OPENFREEMAP_BRIGHT_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright';

// AWS Open Data Terrarium DEM tiles (100% free commercial, elevation = R*256 + G + B/256 - 32768)
export const AWS_TERRARIUM_TILE_URL =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

// NASA GIBS Public Domain Satellite Imagery (US Govt Public Domain, 100% free commercial)
export const NASA_GIBS_BLUE_MARBLE_URL =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg';

export const NASA_GIBS_VIIRS_URL =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/2024-07-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg';

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
  standard: {
    key: 'standard',
    label: 'Bản Đồ Chuẩn (OpenFreeMap)',
    shortLabel: 'Bản Đồ Chuẩn',
    kind: 'vector-openfreemap',
    url: OPENFREEMAP_LIBERTY_STYLE_URL,
    attribution: ATTRIBUTION_OPENFREEMAP_HTML,
    maxNativeZoom: 15,
    maxZoom: 18,
  },
  topo: {
    key: 'topo',
    label: 'Địa Hình Topo (AWS DEM)',
    shortLabel: 'Địa Hình Topo',
    kind: 'terrarium-hillshade',
    url: AWS_TERRARIUM_TILE_URL,
    attribution: ATTRIBUTION_AWS_TERRARIUM_HTML,
    maxNativeZoom: 14,
    maxZoom: 18,
  },
  satellite: {
    key: 'satellite',
    label: CUSTOM_SATELLITE_TILE_URL ? 'Vệ Tinh (Copernicus / Custom)' : 'Vệ Tinh (NASA GIBS)',
    shortLabel: 'Vệ Tinh',
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

export const FREE_BASEMAP_ORDER: BasemapKey[] = ['standard', 'topo', 'satellite'];

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
    const res = await fetch(url, { mode: 'cors', signal });
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

export type Terrain3DBasemapMode = 'outdoor' | 'satellite';

/**
 * Builds a 100% free commercial MapLibre 3D style with NASA GIBS Public Domain satellite imagery
 * (or optional VITE_SATELLITE_TILE_URL) + AWS Open Data Terrarium 3D DEM + hillshade relief.
 */
export function buildSatellite3DStyle(exaggeration = 1.6): StyleSpecification {
  const customSat = CUSTOM_SATELLITE_TILE_URL;
  const satAttribution = customSat
    ? CUSTOM_SATELLITE_ATTRIBUTION ||
      `Contains modified Copernicus Sentinel data · ${ATTRIBUTION_NASA_GIBS_HTML}`
    : ATTRIBUTION_NASA_GIBS_HTML;

  return {
    version: 8,
    sources: {
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
      awsTerrainDem: {
        type: 'raster-dem',
        tiles: [AWS_TERRARIUM_TILE_URL],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 15,
        attribution: ATTRIBUTION_AWS_TERRARIUM_TEXT,
      },
      awsHillshadeDem: {
        type: 'raster-dem',
        tiles: [AWS_TERRARIUM_TILE_URL],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 15,
        attribution: ATTRIBUTION_AWS_TERRARIUM_TEXT,
      },
    },
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
          'hillshade-exaggeration': 0.42,
          'hillshade-shadow-color': '#0f172a',
          'hillshade-highlight-color': '#f8fafc',
          'hillshade-accent-color': '#334155',
        },
      },
    ],
    terrain: {
      source: 'awsTerrainDem',
      exaggeration,
    },
    sky: {
      'sky-color': '#1e3a5f',
      'horizon-color': '#93c5fd',
      'fog-color': '#cbd5e1',
      'fog-ground-blend': 0.5,
      'horizon-fog-blend': 0.6,
      'sky-horizon-blend': 0.8,
      'atmosphere-blend': 0.7,
    },
  };
}

/**
 * Fetches OpenFreeMap Liberty vector style and injects AWS Open Data Terrarium 3D DEM + hillshade + sky.
 * Falls back cleanly to buildSatellite3DStyle if OpenFreeMap is unreachable.
 */
export async function resolveTerrain3DStyle(
  mode: Terrain3DBasemapMode,
  exaggeration = 1.6,
  signal?: AbortSignal
): Promise<StyleSpecification> {
  if (mode === 'satellite') {
    return buildSatellite3DStyle(exaggeration);
  }

  try {
    const res = await fetch(OPENFREEMAP_LIBERTY_STYLE_URL, { mode: 'cors', signal });
    if (!res.ok) return buildSatellite3DStyle(exaggeration);
    const baseStyle = (await res.json()) as StyleSpecification;
    if (!baseStyle || typeof baseStyle !== 'object' || !baseStyle.sources || !Array.isArray(baseStyle.layers)) {
      return buildSatellite3DStyle(exaggeration);
    }

    const sources: StyleSpecification['sources'] = {
      ...baseStyle.sources,
      awsTerrainDem: {
        type: 'raster-dem',
        tiles: [AWS_TERRARIUM_TILE_URL],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 15,
        attribution: ATTRIBUTION_AWS_TERRARIUM_TEXT,
      },
      awsHillshadeDem: {
        type: 'raster-dem',
        tiles: [AWS_TERRARIUM_TILE_URL],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 15,
        attribution: ATTRIBUTION_AWS_TERRARIUM_TEXT,
      },
    };

    // Ensure OpenFreeMap vector source carries full clickable ODbL attribution
    for (const srcKey of Object.keys(sources)) {
      const src = sources[srcKey];
      if (src && src.type === 'vector') {
        sources[srcKey] = {
          ...src,
          attribution: ATTRIBUTION_OPENFREEMAP_HTML,
        };
      }
    }

    // Insert shaded terrain relief right above background/landcover so roads, water, and labels remain crisp
    const layers = [...baseStyle.layers];
    const insertIdx = layers.findIndex(
      (l) => l.type === 'line' || l.type === 'symbol' || l.id.includes('water') || l.id.includes('road')
    );
    const hillshadeLayer = {
      id: 'aws-terrain-hillshade',
      type: 'hillshade' as const,
      source: 'awsHillshadeDem',
      paint: {
        'hillshade-exaggeration': 0.36,
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

    return {
      ...baseStyle,
      sources,
      layers,
      terrain: {
        source: 'awsTerrainDem',
        exaggeration,
      },
      sky: {
        'sky-color': '#1e3a5f',
        'horizon-color': '#93c5fd',
        'fog-color': '#cbd5e1',
        'fog-ground-blend': 0.5,
        'horizon-fog-blend': 0.6,
        'sky-horizon-blend': 0.8,
        'atmosphere-blend': 0.7,
      },
    };
  } catch {
    return buildSatellite3DStyle(exaggeration);
  }
}
