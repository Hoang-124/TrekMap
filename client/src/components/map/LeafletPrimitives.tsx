/**
 * Internal React 19 Leaflet Wrapper (100% OSI Permissive: Leaflet BSD-2-Clause + leaflet.markercluster MIT + maplibre-gl BSD-3-Clause)
 * Direct React primitives over Leaflet & MapLibre with zero non-OSI dependencies.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type * as MapLibreGL from 'maplibre-gl';
import {
  AWS_TERRARIUM_TILE_URL,
  CUSTOM_SATELLITE_TILE_URL,
  FREE_BASEMAPS,
  NASA_GIBS_BLUE_MARBLE_URL,
  NASA_GIBS_VIIRS_URL,
  OPENFREEMAP_LIBERTY_STYLE_URL,
  buildTerrariumTileUrl,
  decodeTerrariumRgbMeters,
  type BasemapKey,
} from '../../utils/mapTiles.js';

// ============================================================================
// Contexts
// ============================================================================

interface MapContextValue {
  map: L.Map;
  layerContainer: L.Map | L.LayerGroup;
}

const MapContext = createContext<MapContextValue | null>(null);
const LayerContext = createContext<L.Layer | null>(null);

function useMapContext(): MapContextValue {
  const ctx = useContext(MapContext);
  if (!ctx) {
    throw new Error('LeafletPrimitives components and hooks must be rendered inside <MapContainer>.');
  }
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMap(): L.Map {
  return useMapContext().map;
}

export type LeafletEventHandlerMap = Partial<Record<string, (event: unknown) => void>>;

export interface MapEventHandlers {
  click?: (event: L.LeafletMouseEvent) => void;
  dblclick?: (event: L.LeafletMouseEvent) => void;
  mousedown?: (event: L.LeafletMouseEvent) => void;
  mouseup?: (event: L.LeafletMouseEvent) => void;
  mousemove?: (event: L.LeafletMouseEvent) => void;
  mouseout?: (event: L.LeafletMouseEvent) => void;
  move?: (event: L.LeafletEvent) => void;
  moveend?: (event: L.LeafletEvent) => void;
  zoom?: (event: L.LeafletEvent) => void;
  zoomend?: (event: L.LeafletEvent) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMapEvents(handlers: MapEventHandlers): L.Map {
  const map = useMap();
  const handlersRef = useRef<MapEventHandlers>(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const eventKeys = Object.keys(handlers).sort().join('|');

  useEffect(() => {
    const keys = eventKeys ? eventKeys.split('|') : [];
    const bindings: Array<[string, L.LeafletEventHandlerFn]> = keys.map((key) => {
      const listener: L.LeafletEventHandlerFn = (evt) => {
        const fn = handlersRef.current[key as keyof MapEventHandlers] as
          | ((e: L.LeafletEvent) => void)
          | undefined;
        fn?.(evt);
      };
      map.on(key, listener);
      return [key, listener];
    });

    return () => {
      for (const [key, listener] of bindings) {
        map.off(key, listener);
      }
    };
  }, [map, eventKeys]);

  return map;
}

// ============================================================================
// MapContainer
// ============================================================================

export interface MapContainerProps {
  center: L.LatLngExpression;
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  maxBounds?: L.LatLngBoundsExpression;
  maxBoundsViscosity?: number;
  zoomControl?: boolean;
  scrollWheelZoom?: boolean;
  preferCanvas?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const MapContainer: React.FC<MapContainerProps> = ({
  center,
  zoom,
  minZoom,
  maxZoom,
  maxBounds,
  maxBoundsViscosity,
  zoomControl = true,
  scrollWheelZoom = true,
  preferCanvas = false,
  className,
  style,
  children,
}) => {
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const initialOptsRef = useRef({
    center,
    zoom,
    minZoom,
    maxZoom,
    maxBounds,
    maxBoundsViscosity,
    zoomControl,
    scrollWheelZoom,
    preferCanvas,
  });

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      if (mapRef.current) return;
      const opts = initialOptsRef.current;
      const map = L.map(node, {
        center: opts.center,
        zoom: opts.zoom,
        minZoom: opts.minZoom,
        maxZoom: opts.maxZoom,
        maxBounds: opts.maxBounds,
        maxBoundsViscosity: opts.maxBoundsViscosity,
        zoomControl: opts.zoomControl,
        scrollWheelZoom: opts.scrollWheelZoom,
        preferCanvas: opts.preferCanvas,
      });
      if (map.attributionControl) {
        map.attributionControl.setPrefix(
          '<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>'
        );
      }
      mapRef.current = map;
      setMapInstance(map);
    } else {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapInstance(null);
    }
  }, []);

  const contextValue = useMemo<MapContextValue | null>(
    () => (mapInstance ? { map: mapInstance, layerContainer: mapInstance } : null),
    [mapInstance]
  );

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        ...style,
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 'inherit',
        }}
      />
      {contextValue && (
        <MapContext.Provider value={contextValue}>{children}</MapContext.Provider>
      )}
    </div>
  );
};

// ============================================================================
// TileLayer (Standard Raster Tile Layer)
// ============================================================================

export interface TileLayerProps {
  url: string;
  attribution?: string;
  maxZoom?: number;
  maxNativeZoom?: number;
  minZoom?: number;
  opacity?: number;
  zIndex?: number;
  tileSize?: number;
  crossOrigin?: boolean | L.CrossOrigin;
}

export const TileLayer: React.FC<TileLayerProps> = ({
  url,
  attribution = '',
  maxZoom = 18,
  maxNativeZoom,
  minZoom = 0,
  opacity = 1,
  zIndex = 1,
  tileSize = 256,
  crossOrigin = 'anonymous',
}) => {
  const { map } = useMapContext();

  useEffect(() => {
    const layer = L.tileLayer(url, {
      attribution,
      maxZoom,
      ...(maxNativeZoom !== undefined ? { maxNativeZoom } : {}),
      minZoom,
      opacity,
      zIndex,
      tileSize,
      crossOrigin,
    });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, url, attribution, maxZoom, maxNativeZoom, minZoom, opacity, zIndex, tileSize, crossOrigin]);

  return null;
};

// ============================================================================
// TerrariumHillshadeLayer (100% Free Commercial AWS Open Data Topographic Relief + Contours)
// ============================================================================

const HYPSOMETRIC_STOPS: Array<[number, [number, number, number]]> = [
  [0, [154, 194, 218]], // Sea / water
  [1, [196, 221, 185]], // Lowland delta
  [180, [178, 207, 158]], // Foothill forest
  [650, [202, 214, 156]], // Montane ridge
  [1250, [224, 205, 156]], // Highland ochre
  [2000, [215, 184, 150]], // Subalpine terracotta
  [2750, [234, 228, 220]], // High alpine summit
  [3300, [244, 241, 236]], // Peak crest
];

function sampleHypsometricRgb(elevationM: number): [number, number, number] {
  if (elevationM <= 0.5) return HYPSOMETRIC_STOPS[0][1];
  for (let i = 1; i < HYPSOMETRIC_STOPS.length; i++) {
    const [h1, c1] = HYPSOMETRIC_STOPS[i - 1];
    const [h2, c2] = HYPSOMETRIC_STOPS[i];
    if (elevationM <= h2) {
      const t = Math.max(0, Math.min(1, (elevationM - h1) / Math.max(1, h2 - h1)));
      return [
        c1[0] + (c2[0] - c1[0]) * t,
        c1[1] + (c2[1] - c1[1]) * t,
        c1[2] + (c2[2] - c1[2]) * t,
      ];
    }
  }
  return HYPSOMETRIC_STOPS[HYPSOMETRIC_STOPS.length - 1][1];
}

function loadCorsImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      // SW offline fallback returns a 1x1 PNG; reject it so we can crop a cached parent zoom tile
      if (img.naturalWidth < 256 || img.naturalHeight < 256) {
        resolve(null);
      } else {
        resolve(img);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function renderOfflineTopoPlaceholder(ctx: CanvasRenderingContext2D, coords: L.Coords): void {
  ctx.fillStyle = '#d7e0d4';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.16)';
  ctx.lineWidth = 1;
  for (let p = 0; p < 256; p += 64) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(256, p);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(51, 65, 85, 0.45)';
  ctx.font = '600 10px sans-serif';
  ctx.fillText(`DEM z${coords.z}`, 10, 20);
}

function renderTerrariumCanvas(
  ctx: CanvasRenderingContext2D,
  srcPixels: Uint8ClampedArray,
  coords: L.Coords
): void {
  const size = 256;
  const elev = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    elev[i] = decodeTerrariumRgbMeters(srcPixels[o], srcPixels[o + 1], srcPixels[o + 2]);
  }

  const n = Math.pow(2, coords.z);
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (coords.y + 0.5)) / n)));
  const metersPerPx = Math.max(1, (156543.03392 * Math.cos(latRad)) / n);

  // Adaptive elevation contour intervals by zoom
  const minorInterval =
    coords.z >= 13 ? 50 : coords.z >= 11 ? 100 : coords.z >= 9 ? 250 : 0;
  const indexInterval = minorInterval * 5;

  // NW directional sun (azimuth 315°, elevation 45°)
  const lx = -0.5;
  const ly = -0.5;
  const lz = 0.7071;
  const zExag = coords.z >= 11 ? 1.55 : 2.1;

  const out = ctx.createImageData(size, size);
  const dst = out.data;

  for (let y = 0; y < size; y++) {
    const y0 = y > 0 ? y - 1 : 0;
    const y2 = y < size - 1 ? y + 1 : size - 1;
    const yNext = y < size - 1 ? y + 1 : y;
    const rowOffset = y * size;
    const rowUp = y0 * size;
    const rowDown = y2 * size;

    for (let x = 0; x < size; x++) {
      const x0 = x > 0 ? x - 1 : 0;
      const x2 = x < size - 1 ? x + 1 : size - 1;
      const xNext = x < size - 1 ? x + 1 : x;

      const idx = rowOffset + x;
      const h = elev[idx];

      // Horn 3x3 gradient
      const dzdx =
        (elev[rowUp + x2] +
          2 * elev[rowOffset + x2] +
          elev[rowDown + x2] -
          (elev[rowUp + x0] + 2 * elev[rowOffset + x0] + elev[rowDown + x0])) /
        (8 * metersPerPx);
      const dzdy =
        (elev[rowDown + x0] +
          2 * elev[rowDown + x] +
          elev[rowDown + x2] -
          (elev[rowUp + x0] + 2 * elev[rowUp + x] + elev[rowUp + x2])) /
        (8 * metersPerPx);

      const nx = -dzdx * zExag;
      const ny = -dzdy * zExag;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const dot = (nx * lx + ny * ly + lz) * invLen;
      const shade = h <= 0.5 ? 1 : 0.44 + Math.max(0, Math.min(1, (dot + 0.15) / 1.15)) * 0.72;

      const [baseR, baseG, baseB] = sampleHypsometricRgb(h);
      let r = baseR * shade;
      let g = baseG * shade;
      let b = baseB * shade;

      // Crisp iso-contour lines on land
      if (minorInterval > 0 && h > 5) {
        const hR = elev[rowOffset + xNext];
        const hD = elev[yNext * size + x];
        const bCur = Math.floor(h / minorInterval);
        if (bCur !== Math.floor(hR / minorInterval) || bCur !== Math.floor(hD / minorInterval)) {
          const idxCur = Math.floor(h / indexInterval);
          const isIndex =
            idxCur !== Math.floor(hR / indexInterval) || idxCur !== Math.floor(hD / indexInterval);
          const contourDarken = isIndex ? 0.56 : 0.8;
          r *= contourDarken;
          g *= contourDarken;
          b *= contourDarken;
        }
      }

      const o = idx * 4;
      dst[o] = r > 255 ? 255 : r < 0 ? 0 : r;
      dst[o + 1] = g > 255 ? 255 : g < 0 ? 0 : g;
      dst[o + 2] = b > 255 ? 255 : b < 0 ? 0 : b;
      dst[o + 3] = 255;
    }
  }

  ctx.putImageData(out, 0, 0);
}

class TerrariumGridLayer extends L.GridLayer {
  private tileUrlTemplate: string;

  constructor(urlTemplate: string, options?: L.GridLayerOptions) {
    super(options);
    this.tileUrlTemplate = urlTemplate;
  }

  override createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      queueMicrotask(() => done(undefined, canvas));
      return canvas;
    }

    const resolveUrl = (z: number, x: number, y: number) =>
      this.tileUrlTemplate
        .replace('{z}', String(z))
        .replace('{x}', String(x))
        .replace('{y}', String(y));

    void (async () => {
      let img = await loadCorsImage(resolveUrl(coords.z, coords.x, coords.y));
      let cropSrc: { sx: number; sy: number; sw: number; sh: number } | null = null;

      // Offline parent-zoom fallback: smoothly crop cached z=12..10 Offline Pack Terrarium DEM tiles
      if (!img && coords.z > 10) {
        for (let pz = Math.min(12, coords.z - 1); pz >= 10; pz--) {
          const scale = 1 << (coords.z - pz);
          const px = Math.floor(coords.x / scale);
          const py = Math.floor(coords.y / scale);
          const parentImg = await loadCorsImage(buildTerrariumTileUrl(pz, px, py));
          if (parentImg) {
            const subSize = 256 / scale;
            cropSrc = {
              sx: (coords.x - px * scale) * subSize,
              sy: (coords.y - py * scale) * subSize,
              sw: subSize,
              sh: subSize,
            };
            img = parentImg;
            break;
          }
        }
      }

      if (!img) {
        renderOfflineTopoPlaceholder(ctx, coords);
        done(undefined, canvas);
        return;
      }

      try {
        ctx.imageSmoothingEnabled = true;
        if (cropSrc) {
          ctx.drawImage(img, cropSrc.sx, cropSrc.sy, cropSrc.sw, cropSrc.sh, 0, 0, 256, 256);
        } else {
          ctx.drawImage(img, 0, 0, 256, 256);
        }
        const imgData = ctx.getImageData(0, 0, 256, 256);
        renderTerrariumCanvas(ctx, imgData.data, coords);
      } catch {
        renderOfflineTopoPlaceholder(ctx, coords);
      }
      done(undefined, canvas);
    })();

    return canvas;
  }
}

export interface TerrariumHillshadeLayerProps {
  url?: string;
  attribution?: string;
  maxNativeZoom?: number;
  maxZoom?: number;
  opacity?: number;
  zIndex?: number;
}

export const TerrariumHillshadeLayer: React.FC<TerrariumHillshadeLayerProps> = ({
  url = AWS_TERRARIUM_TILE_URL,
  attribution = FREE_BASEMAPS.topo.attribution,
  maxNativeZoom = 14,
  maxZoom = 18,
  opacity = 1,
  zIndex = 1,
}) => {
  const { map } = useMapContext();

  useEffect(() => {
    const layer = new TerrariumGridLayer(url, {
      attribution,
      maxNativeZoom,
      maxZoom,
      opacity,
      zIndex,
      tileSize: 256,
    });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, url, attribution, maxNativeZoom, maxZoom, opacity, zIndex]);

  return null;
};

// ============================================================================
// MapLibreBasemapLayer (Mounts maplibre-gl OpenFreeMap vector style cleanly inside Leaflet)
// ============================================================================

class MapLibreLeafletLayer extends L.Layer {
  private styleUrl: string;
  private glContainer: HTMLDivElement | null = null;
  private glMap: MapLibreGL.Map | null = null;
  private fallbackLayer: TerrariumGridLayer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;

  constructor(styleUrl: string, options?: L.LayerOptions) {
    super(options);
    this.styleUrl = styleUrl;
  }

  override onAdd(map: L.Map): this {
    this.disposed = false;
    const host = map.getContainer();
    const container = document.createElement('div');
    container.className = 'lost-maplibre-basemap-layer';
    container.style.position = 'absolute';
    container.style.inset = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    // Strictly below .leaflet-pane (z-index: 400) so overlays, polylines, markers, tooltips, popups stay on top
    container.style.zIndex = '100';
    container.style.pointerEvents = 'none';
    host.appendChild(container);
    this.glContainer = container;

    const syncCamera = () => {
      if (!this.glMap || this.disposed) return;
      const center = map.getCenter();
      const zoom = Math.max(0, map.getZoom() - 1);
      this.glMap.jumpTo({
        center: [center.lng, center.lat],
        zoom,
      });
    };

    const handleZoomAnim = (evt: L.LeafletEvent) => {
      if (!this.glMap || this.disposed) return;
      const zoomEvt = evt as L.ZoomAnimEvent;
      if (zoomEvt.center && typeof zoomEvt.zoom === 'number') {
        this.glMap.easeTo({
          center: [zoomEvt.center.lng, zoomEvt.center.lat],
          zoom: Math.max(0, zoomEvt.zoom - 1),
          duration: 240,
          easing: (t) => 1 - Math.pow(1 - t, 3),
        });
      }
    };

    const handleResize = () => {
      if (!this.glMap || this.disposed) return;
      this.glMap.resize();
      syncCamera();
    };

    const mountFallback = () => {
      if (this.disposed || this.fallbackLayer) return;
      this.fallbackLayer = new TerrariumGridLayer(AWS_TERRARIUM_TILE_URL, {
        attribution: FREE_BASEMAPS.topo.attribution,
        maxNativeZoom: 14,
        maxZoom: 18,
        zIndex: 1,
      });
      this.fallbackLayer.addTo(map);
    };

    map.on('move', syncCamera);
    map.on('moveend', syncCamera);
    map.on('zoom', syncCamera);
    map.on('zoomend', syncCamera);
    map.on('viewreset', syncCamera);
    map.on('zoomanim', handleZoomAnim);
    map.on('resize', handleResize);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => handleResize());
      this.resizeObserver.observe(host);
    }

    // Store listeners for clean removal
    const cleanupListeners = () => {
      map.off('move', syncCamera);
      map.off('moveend', syncCamera);
      map.off('zoom', syncCamera);
      map.off('zoomend', syncCamera);
      map.off('viewreset', syncCamera);
      map.off('zoomanim', handleZoomAnim);
      map.off('resize', handleResize);
    };
    (this as unknown as { _cleanupListeners?: () => void })._cleanupListeners = cleanupListeners;

    void Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')])
      .then(([mlModule]) => {
        if (this.disposed || !this.glContainer) return;
        const center = map.getCenter();
        const zoom = Math.max(0, map.getZoom() - 1);
        try {
          const glMap = new mlModule.Map({
            container: this.glContainer,
            style: this.styleUrl,
            center: [center.lng, center.lat],
            zoom,
            interactive: false,
            attributionControl: false,
            fadeDuration: 120,
          });

          let styleLoaded = false;
          glMap.on('load', () => {
            styleLoaded = true;
            if (!this.disposed) {
              glMap.resize();
              syncCamera();
            }
          });

          glMap.on('error', () => {
            if (!styleLoaded && !this.disposed) {
              mountFallback();
            }
          });

          this.glMap = glMap;
        } catch {
          // Graceful fallback when WebGL is disabled/unavailable
          mountFallback();
        }
      })
      .catch(() => {
        mountFallback();
      });

    return this;
  }

  override onRemove(map: L.Map): this {
    this.disposed = true;
    const cleanup = (this as unknown as { _cleanupListeners?: () => void })._cleanupListeners;
    cleanup?.();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.fallbackLayer) {
      map.removeLayer(this.fallbackLayer);
      this.fallbackLayer = null;
    }
    if (this.glMap) {
      this.glMap.remove();
      this.glMap = null;
    }
    if (this.glContainer && this.glContainer.parentNode) {
      this.glContainer.parentNode.removeChild(this.glContainer);
    }
    this.glContainer = null;
    return this;
  }
}

export interface MapLibreBasemapLayerProps {
  styleUrl?: string;
  attribution?: string;
}

export const MapLibreBasemapLayer: React.FC<MapLibreBasemapLayerProps> = ({
  styleUrl = OPENFREEMAP_LIBERTY_STYLE_URL,
  attribution = FREE_BASEMAPS.standard.attribution,
}) => {
  const { map } = useMapContext();

  useEffect(() => {
    const layer = new MapLibreLeafletLayer(styleUrl, { attribution });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, styleUrl, attribution]);

  return null;
};

// ============================================================================
// FreeBasemapLayer (Unified 100% Free Commercial Basemap Switcher)
// ============================================================================

export interface FreeBasemapLayerProps {
  basemap: BasemapKey;
}

export const FreeBasemapLayer: React.FC<FreeBasemapLayerProps> = ({ basemap }) => {
  if (basemap === 'standard') {
    return (
      <MapLibreBasemapLayer
        styleUrl={FREE_BASEMAPS.standard.url}
        attribution={FREE_BASEMAPS.standard.attribution}
      />
    );
  }
  if (basemap === 'topo') {
    return (
      <TerrariumHillshadeLayer
        url={FREE_BASEMAPS.topo.url}
        attribution={FREE_BASEMAPS.topo.attribution}
        maxNativeZoom={FREE_BASEMAPS.topo.maxNativeZoom}
        maxZoom={FREE_BASEMAPS.topo.maxZoom}
      />
    );
  }
  if (CUSTOM_SATELLITE_TILE_URL) {
    return (
      <TileLayer
        url={FREE_BASEMAPS.satellite.url}
        attribution={FREE_BASEMAPS.satellite.attribution}
        maxNativeZoom={FREE_BASEMAPS.satellite.maxNativeZoom}
        maxZoom={FREE_BASEMAPS.satellite.maxZoom}
      />
    );
  }
  return (
    <>
      <TileLayer
        url={NASA_GIBS_BLUE_MARBLE_URL}
        attribution=""
        maxNativeZoom={8}
        maxZoom={18}
        zIndex={1}
      />
      <TileLayer
        url={NASA_GIBS_VIIRS_URL}
        attribution={FREE_BASEMAPS.satellite.attribution}
        maxNativeZoom={9}
        maxZoom={18}
        zIndex={2}
      />
    </>
  );
};

// ============================================================================
// MarkerClusterGroup (Direct leaflet.markercluster MIT wrapper with batched addLayers)
// ============================================================================

export interface MarkerClusterLike {
  getChildCount: () => number;
}

export interface MarkerClusterGroupProps {
  chunkedLoading?: boolean;
  disableClusteringAtZoom?: number;
  maxClusterRadius?: number;
  showCoverageOnHover?: boolean;
  spiderfyOnMaxZoom?: boolean;
  zoomToBoundsOnClick?: boolean;
  iconCreateFunction?: (cluster: MarkerClusterLike) => L.DivIcon | L.Icon;
  children?: React.ReactNode;
}

interface LeafletMarkerClusterInstance extends L.FeatureGroup {
  addLayers?: (layers: L.Layer[]) => this;
  removeLayers?: (layers: L.Layer[]) => this;
}

type LeafletClusterConstructor = new (options?: Record<string, unknown>) => LeafletMarkerClusterInstance;

type LeafletWithCluster = typeof L & {
  MarkerClusterGroup?: LeafletClusterConstructor;
  markerClusterGroup?: (options?: Record<string, unknown>) => LeafletMarkerClusterInstance;
};

export const MarkerClusterGroup: React.FC<MarkerClusterGroupProps> = ({
  chunkedLoading = true,
  disableClusteringAtZoom,
  maxClusterRadius = 46,
  showCoverageOnHover = false,
  spiderfyOnMaxZoom = true,
  zoomToBoundsOnClick = true,
  iconCreateFunction,
  children,
}) => {
  const { map } = useMapContext();

  const [clusterGroup] = useState<LeafletMarkerClusterInstance>(() => {
    const opts: Record<string, unknown> = {
      chunkedLoading,
      maxClusterRadius,
      showCoverageOnHover,
      spiderfyOnMaxZoom,
      zoomToBoundsOnClick,
      ...(disableClusteringAtZoom !== undefined ? { disableClusteringAtZoom } : {}),
      ...(iconCreateFunction ? { iconCreateFunction } : {}),
    };
    const lc = L as LeafletWithCluster;
    const group: LeafletMarkerClusterInstance = lc.MarkerClusterGroup
      ? new lc.MarkerClusterGroup(opts)
      : lc.markerClusterGroup
        ? lc.markerClusterGroup(opts)
        : (L.featureGroup() as LeafletMarkerClusterInstance);

    // Batch rapid addLayer/removeLayer calls into single addLayers/removeLayers passes
    if (typeof group.addLayers === 'function' && typeof group.removeLayers === 'function') {
      const protoAdd = Object.getPrototypeOf(group).addLayer as (layer: L.Layer) => LeafletMarkerClusterInstance;
      const protoRemove = Object.getPrototypeOf(group).removeLayer as (
        layer: L.Layer
      ) => LeafletMarkerClusterInstance;
      let addQueue: L.Layer[] = [];
      let removeQueue: L.Layer[] = [];
      let scheduled = false;

      const flush = () => {
        scheduled = false;
        const net = new Map<L.Layer, number>();
        for (const l of addQueue) net.set(l, (net.get(l) ?? 0) + 1);
        for (const l of removeQueue) net.set(l, (net.get(l) ?? 0) - 1);
        addQueue = [];
        removeQueue = [];
        const toAdd: L.Layer[] = [];
        const toRemove: L.Layer[] = [];
        for (const [layer, count] of net) {
          if (count > 0) toAdd.push(layer);
          else if (count < 0) toRemove.push(layer);
        }
        if (toRemove.length > 0) group.removeLayers?.(toRemove);
        if (toAdd.length > 0) group.addLayers?.(toAdd);
      };

      const schedule = () => {
        if (scheduled) return;
        scheduled = true;
        queueMicrotask(flush);
      };

      group.addLayer = function batchedAddLayer(layer: L.Layer) {
        if (!(this as unknown as { _map?: L.Map | null })._map) return protoAdd.call(this, layer);
        addQueue.push(layer);
        schedule();
        return this;
      };

      group.removeLayer = function batchedRemoveLayer(layer: L.Layer) {
        if (!(this as unknown as { _map?: L.Map | null })._map) return protoRemove.call(this, layer);
        removeQueue.push(layer);
        schedule();
        return this;
      };
    }

    return group;
  });

  useEffect(() => {
    map.addLayer(clusterGroup);
    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [map, clusterGroup]);

  const childContext = useMemo<MapContextValue>(
    () => ({ map, layerContainer: clusterGroup }),
    [map, clusterGroup]
  );

  return <MapContext.Provider value={childContext}>{children}</MapContext.Provider>;
};

// ============================================================================
// Helper: Stable Leaflet Event Binding Hook for Layers
// ============================================================================

function useLayerEventHandlers<TLayer extends L.Evented>(
  layer: TLayer,
  eventHandlers?: Record<string, ((event: never) => void) | undefined>
): void {
  const handlersRef = useRef(eventHandlers);
  useEffect(() => {
    handlersRef.current = eventHandlers;
  }, [eventHandlers]);

  const keysSig = eventHandlers ? Object.keys(eventHandlers).sort().join('|') : '';

  useEffect(() => {
    if (!keysSig) return;
    const keys = keysSig.split('|');
    const bindings: Array<[string, L.LeafletEventHandlerFn]> = keys.map((key) => {
      const fn: L.LeafletEventHandlerFn = (evt) => {
        const handler = handlersRef.current?.[key] as ((e: L.LeafletEvent) => void) | undefined;
        handler?.(evt);
      };
      layer.on(key, fn);
      return [key, fn];
    });
    return () => {
      for (const [key, fn] of bindings) {
        layer.off(key, fn);
      }
    };
  }, [layer, keysSig]);
}

// ============================================================================
// Marker
// ============================================================================

export interface MarkerEventHandlers {
  click?: (event: L.LeafletMouseEvent) => void;
  dragend?: (event: L.DragEndEvent) => void;
  mouseover?: (event: L.LeafletMouseEvent) => void;
  mouseout?: (event: L.LeafletMouseEvent) => void;
}

export interface MarkerProps {
  position: L.LatLngExpression;
  icon?: L.Icon | L.DivIcon;
  draggable?: boolean;
  opacity?: number;
  zIndexOffset?: number;
  eventHandlers?: MarkerEventHandlers;
  children?: React.ReactNode;
}

export const Marker: React.FC<MarkerProps> = ({
  position,
  icon,
  draggable = false,
  opacity = 1,
  zIndexOffset = 0,
  eventHandlers,
  children,
}) => {
  const { layerContainer } = useMapContext();

  const [marker] = useState<L.Marker>(() =>
    L.marker(position, {
      ...(icon ? { icon } : {}),
      draggable,
      opacity,
      zIndexOffset,
    })
  );

  useEffect(() => {
    layerContainer.addLayer(marker);
    return () => {
      layerContainer.removeLayer(marker);
    };
  }, [layerContainer, marker]);

  useEffect(() => {
    const target = L.latLng(position);
    const current = marker.getLatLng();
    if (current.lat !== target.lat || current.lng !== target.lng) {
      marker.setLatLng(target);
    }
  }, [marker, position]);

  useEffect(() => {
    if (icon) {
      marker.setIcon(icon);
    }
  }, [marker, icon]);

  useEffect(() => {
    if (marker.dragging) {
      if (draggable) marker.dragging.enable();
      else marker.dragging.disable();
    }
  }, [marker, draggable]);

  useEffect(() => {
    marker.setOpacity(opacity);
  }, [marker, opacity]);

  useEffect(() => {
    marker.setZIndexOffset(zIndexOffset);
  }, [marker, zIndexOffset]);

  useLayerEventHandlers(
    marker,
    eventHandlers as Record<string, ((event: never) => void) | undefined> | undefined
  );

  return <LayerContext.Provider value={marker}>{children}</LayerContext.Provider>;
};

// ============================================================================
// Polyline
// ============================================================================

export interface PolylineEventHandlers {
  click?: (event: L.LeafletMouseEvent) => void;
  mousemove?: (event: L.LeafletMouseEvent) => void;
  mouseout?: (event: L.LeafletMouseEvent) => void;
  mouseover?: (event: L.LeafletMouseEvent) => void;
}

export interface PolylineProps {
  positions: L.LatLngExpression[] | L.LatLngExpression[][];
  pathOptions?: L.PathOptions;
  color?: string;
  weight?: number;
  opacity?: number;
  dashArray?: string;
  eventHandlers?: PolylineEventHandlers;
  children?: React.ReactNode;
}

export const Polyline: React.FC<PolylineProps> = ({
  positions,
  pathOptions,
  color,
  weight,
  opacity,
  dashArray,
  eventHandlers,
  children,
}) => {
  const { layerContainer } = useMapContext();

  const mergedStyle = useMemo<L.PathOptions>(
    () => ({
      ...(color !== undefined ? { color } : {}),
      ...(weight !== undefined ? { weight } : {}),
      ...(opacity !== undefined ? { opacity } : {}),
      ...(dashArray !== undefined ? { dashArray } : {}),
      ...pathOptions,
    }),
    [color, weight, opacity, dashArray, pathOptions]
  );

  const [polyline] = useState<L.Polyline>(() => L.polyline(positions, mergedStyle));

  useEffect(() => {
    layerContainer.addLayer(polyline);
    return () => {
      layerContainer.removeLayer(polyline);
    };
  }, [layerContainer, polyline]);

  useEffect(() => {
    polyline.setLatLngs(positions);
  }, [polyline, positions]);

  useEffect(() => {
    polyline.setStyle(mergedStyle);
  }, [polyline, mergedStyle]);

  useLayerEventHandlers(
    polyline,
    eventHandlers as Record<string, ((event: never) => void) | undefined> | undefined
  );

  return <LayerContext.Provider value={polyline}>{children}</LayerContext.Provider>;
};

// ============================================================================
// Circle
// ============================================================================

export interface CircleProps {
  center: L.LatLngExpression;
  radius: number;
  pathOptions?: L.PathOptions;
  eventHandlers?: PolylineEventHandlers;
  children?: React.ReactNode;
}

export const Circle: React.FC<CircleProps> = ({
  center,
  radius,
  pathOptions,
  eventHandlers,
  children,
}) => {
  const { layerContainer } = useMapContext();

  const [circle] = useState<L.Circle>(() => L.circle(center, { radius, ...pathOptions }));

  useEffect(() => {
    layerContainer.addLayer(circle);
    return () => {
      layerContainer.removeLayer(circle);
    };
  }, [layerContainer, circle]);

  useEffect(() => {
    circle.setLatLng(center);
  }, [circle, center]);

  useEffect(() => {
    circle.setRadius(radius);
  }, [circle, radius]);

  useEffect(() => {
    if (pathOptions) circle.setStyle(pathOptions);
  }, [circle, pathOptions]);

  useLayerEventHandlers(
    circle,
    eventHandlers as Record<string, ((event: never) => void) | undefined> | undefined
  );

  return <LayerContext.Provider value={circle}>{children}</LayerContext.Provider>;
};

// ============================================================================
// CircleMarker
// ============================================================================

export interface CircleMarkerProps {
  center: L.LatLngExpression;
  radius?: number;
  pathOptions?: L.PathOptions;
  eventHandlers?: PolylineEventHandlers;
  children?: React.ReactNode;
}

export const CircleMarker: React.FC<CircleMarkerProps> = ({
  center,
  radius = 10,
  pathOptions,
  eventHandlers,
  children,
}) => {
  const { layerContainer } = useMapContext();

  const [circleMarker] = useState<L.CircleMarker>(() =>
    L.circleMarker(center, { radius, ...pathOptions })
  );

  useEffect(() => {
    layerContainer.addLayer(circleMarker);
    return () => {
      layerContainer.removeLayer(circleMarker);
    };
  }, [layerContainer, circleMarker]);

  useEffect(() => {
    circleMarker.setLatLng(center);
  }, [circleMarker, center]);

  useEffect(() => {
    circleMarker.setRadius(radius);
  }, [circleMarker, radius]);

  useEffect(() => {
    if (pathOptions) circleMarker.setStyle(pathOptions);
  }, [circleMarker, pathOptions]);

  useLayerEventHandlers(
    circleMarker,
    eventHandlers as Record<string, ((event: never) => void) | undefined> | undefined
  );

  return <LayerContext.Provider value={circleMarker}>{children}</LayerContext.Provider>;
};

// ============================================================================
// Popup (Lazy-mounted Portal on popupopen to prevent eager side-effects/fetches)
// ============================================================================

export interface PopupProps {
  className?: string;
  maxWidth?: number;
  minWidth?: number;
  offset?: L.PointExpression;
  children?: React.ReactNode;
}

export const Popup: React.FC<PopupProps> = ({
  className,
  maxWidth = 340,
  minWidth = 50,
  offset,
  children,
}) => {
  const parentLayer = useContext(LayerContext);
  const [contentNode] = useState<HTMLDivElement | null>(() =>
    typeof document !== 'undefined' ? document.createElement('div') : null
  );
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<L.Popup | null>(null);

  useEffect(() => {
    if (!parentLayer || !contentNode) return;
    const popup = L.popup({
      className,
      maxWidth,
      minWidth,
      ...(offset ? { offset } : {}),
    }).setContent(contentNode);
    popupRef.current = popup;
    parentLayer.bindPopup(popup);

    const handleOpen = () => setIsOpen(true);
    const handleClose = () => setIsOpen(false);
    parentLayer.on('popupopen', handleOpen);
    parentLayer.on('popupclose', handleClose);

    return () => {
      parentLayer.off('popupopen', handleOpen);
      parentLayer.off('popupclose', handleClose);
      parentLayer.unbindPopup();
      popupRef.current = null;
      setIsOpen(false);
    };
  }, [parentLayer, contentNode, className, maxWidth, minWidth, offset]);

  useEffect(() => {
    if (!isOpen || !popupRef.current) return;
    const id = window.requestAnimationFrame(() => {
      popupRef.current?.update();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isOpen, children]);

  if (!isOpen || !contentNode) return null;
  return createPortal(children, contentNode);
};

// ============================================================================
// Tooltip (Lazy-mounted Portal on tooltipopen or permanent)
// ============================================================================

export interface TooltipProps {
  direction?: L.Direction;
  offset?: L.PointExpression;
  opacity?: number;
  permanent?: boolean;
  sticky?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({
  direction = 'auto',
  offset,
  opacity = 0.95,
  permanent = false,
  sticky = false,
  className,
  children,
}) => {
  const parentLayer = useContext(LayerContext);
  const [contentNode] = useState<HTMLDivElement | null>(() =>
    typeof document !== 'undefined' ? document.createElement('div') : null
  );
  const [isOpen, setIsOpen] = useState(permanent);
  const tooltipRef = useRef<L.Tooltip | null>(null);

  useEffect(() => {
    if (!parentLayer || !contentNode) return;
    const tooltip = L.tooltip({
      direction,
      ...(offset ? { offset } : {}),
      opacity,
      permanent,
      sticky,
      className,
    }).setContent(contentNode);
    tooltipRef.current = tooltip;
    parentLayer.bindTooltip(tooltip);

    const handleOpen = () => setIsOpen(true);
    const handleClose = () => {
      if (!permanent) setIsOpen(false);
    };
    parentLayer.on('tooltipopen', handleOpen);
    parentLayer.on('tooltipclose', handleClose);

    return () => {
      parentLayer.off('tooltipopen', handleOpen);
      parentLayer.off('tooltipclose', handleClose);
      parentLayer.unbindTooltip();
      tooltipRef.current = null;
      setIsOpen(permanent);
    };
  }, [parentLayer, contentNode, direction, offset, opacity, permanent, sticky, className]);

  useEffect(() => {
    if (!isOpen || !tooltipRef.current) return;
    const id = window.requestAnimationFrame(() => {
      tooltipRef.current?.update();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isOpen, children]);

  if (!isOpen || !contentNode) return null;
  return createPortal(children, contentNode);
};
