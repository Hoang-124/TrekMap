import React, { useEffect, useRef, useState } from 'react';
import type * as GeoJSON from 'geojson';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  buildGeoJsonCircleRing,
  getCachedLostBasemapStyleSync,
  getMapPerformanceConfig,
  isOfflineReliefFallbackStyle,
  resolveLostBasemapStyle,
  resolveMapWebGLPalette,
  type MapWebGLPalette,
} from '../../utils/mapTiles.js';

export type LostMapBasemap = 'topo' | 'standard' | 'satellite';

export interface LostMapMarkerItem {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  sublabel?: string;
  color?: 'primary' | 'danger' | 'warn' | 'info' | 'muted';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  active?: boolean;
  badge?: string;
  onClick?: () => void;
}

export interface LostMapPolylineItem {
  id: string;
  coords: [number, number][];
  color?: 'primary' | 'danger' | 'warn' | 'info';
  width?: number;
  dashed?: boolean;
  opacity?: number;
  interactive?: boolean;
  onClick?: () => void;
  onHover?: (lat: number, lng: number) => void;
  onHoverOut?: () => void;
}

export interface LostMapCircleItem {
  id: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  color?: 'primary' | 'danger' | 'warn' | 'info';
  dashed?: boolean;
  fillOpacity?: number;
}

export interface LostMapClusterPoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  difficulty?: number;
  altitudeM?: number;
  distanceKm?: number;
  hasIncident?: boolean;
  selected?: boolean;
}

export interface LostVectorMapProps {
  center: [number, number];
  zoom: number;
  basemap: LostMapBasemap;
  className?: string;
  style?: React.CSSProperties;
  minZoom?: number;
  maxZoom?: number;
  maxBounds?: [[number, number], [number, number]];
  scrollZoom?: boolean;
  clusterPoints?: LostMapClusterPoint[];
  onClusterPointClick?: (id: string) => void;
  onClusterPointHover?: (id: string | null, screenPoint?: { x: number; y: number }) => void;
  markers?: LostMapMarkerItem[];
  polylines?: LostMapPolylineItem[];
  circles?: LostMapCircleItem[];
  fitBounds?: [[number, number], [number, number]] | null;
  fitBoundsKey?: string | number;
  flyTo?: { lat: number; lng: number; zoom?: number; duration?: number; key: string | number } | null;
  onMapClick?: (lat: number, lng: number) => void;
  onMapReady?: (map: maplibregl.Map) => void;
  enable3DTerrain?: boolean;
  pitch?: number;
  bearing?: number;
  children?: React.ReactNode;
}

const SRC_CIRCLES = 'lost-gpu-circles';
const SRC_POLYLINES = 'lost-gpu-polylines';
const SRC_CLUSTERS = 'lost-gpu-clusters';
const SRC_MARKERS = 'lost-gpu-markers';

const LAYER_CIRCLES_FILL = 'lost-circles-fill';
const LAYER_CIRCLES_LINE_SOLID = 'lost-circles-line-solid';
const LAYER_CIRCLES_LINE_DASHED = 'lost-circles-line-dashed';

const LAYER_POLY_CASING = 'lost-polylines-casing';
const LAYER_POLY_SOLID = 'lost-polylines-solid';
const LAYER_POLY_DASHED = 'lost-polylines-dashed';
const LAYER_POLY_HIT = 'lost-polylines-hit';

const LAYER_CLUSTER_HALO = 'lost-cluster-halo';
const LAYER_CLUSTER_CIRCLE = 'lost-cluster-circle';
const LAYER_CLUSTER_COUNT = 'lost-cluster-count';
const LAYER_UNCLUSTERED_INCIDENT = 'lost-unclustered-incident';
const LAYER_UNCLUSTERED_SELECTED = 'lost-unclustered-selected';
const LAYER_UNCLUSTERED_POINT = 'lost-unclustered-point';
const LAYER_UNCLUSTERED_LABEL = 'lost-unclustered-label';

const LAYER_MARKERS_PULSE = 'lost-markers-pulse';
const LAYER_MARKERS_ACTIVE = 'lost-markers-active';
const LAYER_MARKERS_DOT = 'lost-markers-dot';
const LAYER_MARKERS_BADGE = 'lost-markers-badge';
const LAYER_MARKERS_LABEL = 'lost-markers-label';

type SemanticColorKey = 'primary' | 'danger' | 'warn' | 'info' | 'muted';

function resolveSemanticColor(
  key: SemanticColorKey | undefined,
  palette: MapWebGLPalette
): string {
  switch (key) {
    case 'danger':
      return palette.danger;
    case 'warn':
      return palette.warn;
    case 'info':
      return palette.info;
    case 'muted':
      return palette.muted;
    case 'primary':
    default:
      return palette.primary;
  }
}

function resolveDifficultyHex(difficulty: number | undefined, palette: MapWebGLPalette): string {
  const diff = Number(difficulty) || 3;
  if (diff >= 4) return palette.hard;
  if (diff === 3) return palette.medium;
  return palette.easy;
}

function markerRadiusPx(size?: 'sm' | 'md' | 'lg', active?: boolean): number {
  const base = size === 'sm' ? 6 : size === 'lg' ? 11.5 : 8.5;
  return active ? base + 2 : base;
}

function buildCirclesFeatureCollection(
  circles: LostMapCircleItem[],
  palette: MapWebGLPalette
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  for (const c of circles) {
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng) || !Number.isFinite(c.radiusMeters) || c.radiusMeters <= 0) {
      continue;
    }
    const color = resolveSemanticColor(c.color, palette);
    features.push({
      type: 'Feature',
      properties: {
        id: c.id,
        color,
        dashed: Boolean(c.dashed),
        fillOpacity: typeof c.fillOpacity === 'number' ? c.fillOpacity : c.color === 'danger' ? 0.1 : 0.08,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [buildGeoJsonCircleRing(c.lat, c.lng, c.radiusMeters, 48)],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function buildPolylinesFeatureCollection(
  polylines: LostMapPolylineItem[],
  palette: MapWebGLPalette
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (const line of polylines) {
    if (!Array.isArray(line.coords) || line.coords.length < 2) continue;
    const coords: [number, number][] = [];
    for (const pt of line.coords) {
      if (!Array.isArray(pt) || pt.length < 2) continue;
      const lat = Number(pt[0]);
      const lng = Number(pt[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        coords.push([lng, lat]);
      }
    }
    if (coords.length < 2) continue;
    const color = resolveSemanticColor(line.color, palette);
    const width = typeof line.width === 'number' && line.width > 0 ? line.width : 3.5;
    const opacity = typeof line.opacity === 'number' ? Math.max(0, Math.min(1, line.opacity)) : 0.92;
    features.push({
      type: 'Feature',
      properties: {
        id: line.id,
        color,
        width,
        casingWidth: width + 2.6,
        opacity,
        casingOpacity: Math.min(0.62, opacity * 0.56),
        dashed: Boolean(line.dashed),
        interactive: Boolean(line.interactive || line.onClick || line.onHover),
      },
      geometry: {
        type: 'LineString',
        coordinates: coords,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function buildClustersFeatureCollection(
  points: LostMapClusterPoint[],
  palette: MapWebGLPalette
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    features.push({
      type: 'Feature',
      properties: {
        id: p.id,
        title: p.title || '',
        subtitle: p.subtitle || '',
        difficulty: Number(p.difficulty) || 3,
        altitudeM: Number(p.altitudeM) || 0,
        distanceKm: Number(p.distanceKm) || 0,
        hasIncident: Boolean(p.hasIncident),
        selected: Boolean(p.selected),
        color: resolveDifficultyHex(p.difficulty, palette),
      },
      geometry: {
        type: 'Point',
        coordinates: [p.lng, p.lat],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function buildMarkersFeatureCollection(
  markers: LostMapMarkerItem[],
  palette: MapWebGLPalette
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const m of markers) {
    if (!Number.isFinite(m.lat) || !Number.isFinite(m.lng)) continue;
    const color = resolveSemanticColor(m.color, palette);
    const radius = markerRadiusPx(m.size, m.active);
    features.push({
      type: 'Feature',
      properties: {
        id: m.id,
        label: m.label || '',
        sublabel: m.sublabel || '',
        badge: m.badge || '',
        color,
        radius,
        pulse: Boolean(m.pulse),
        active: Boolean(m.active),
        hasClick: Boolean(m.onClick),
        labelOffsetY: m.size === 'lg' ? 1.55 : 1.35,
      },
      geometry: {
        type: 'Point',
        coordinates: [m.lng, m.lat],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function attachGpuOverlayLayers(
  map: maplibregl.Map,
  palette: MapWebGLPalette,
  circlesData: GeoJSON.FeatureCollection<GeoJSON.Polygon>,
  polylinesData: GeoJSON.FeatureCollection<GeoJSON.LineString>,
  clustersData: GeoJSON.FeatureCollection<GeoJSON.Point>,
  markersData: GeoJSON.FeatureCollection<GeoJSON.Point>
): void {
  // 1. Circles source + layers
  if (!map.getSource(SRC_CIRCLES)) {
    map.addSource(SRC_CIRCLES, { type: 'geojson', data: circlesData });
  } else {
    (map.getSource(SRC_CIRCLES) as maplibregl.GeoJSONSource).setData(circlesData);
  }

  if (!map.getLayer(LAYER_CIRCLES_FILL)) {
    map.addLayer({
      id: LAYER_CIRCLES_FILL,
      type: 'fill',
      source: SRC_CIRCLES,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['get', 'fillOpacity'],
      },
    });
  }
  if (!map.getLayer(LAYER_CIRCLES_LINE_SOLID)) {
    map.addLayer({
      id: LAYER_CIRCLES_LINE_SOLID,
      type: 'line',
      source: SRC_CIRCLES,
      filter: ['==', ['get', 'dashed'], false],
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.6,
        'line-opacity': 0.72,
      },
    });
  }
  if (!map.getLayer(LAYER_CIRCLES_LINE_DASHED)) {
    map.addLayer({
      id: LAYER_CIRCLES_LINE_DASHED,
      type: 'line',
      source: SRC_CIRCLES,
      filter: ['==', ['get', 'dashed'], true],
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.6,
        'line-opacity': 0.75,
        'line-dasharray': [4, 4],
      },
    });
  }

  // 2. Polylines source + layers
  if (!map.getSource(SRC_POLYLINES)) {
    map.addSource(SRC_POLYLINES, { type: 'geojson', data: polylinesData });
  } else {
    (map.getSource(SRC_POLYLINES) as maplibregl.GeoJSONSource).setData(polylinesData);
  }

  if (!map.getLayer(LAYER_POLY_CASING)) {
    map.addLayer({
      id: LAYER_POLY_CASING,
      type: 'line',
      source: SRC_POLYLINES,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': palette.casingDark,
        'line-width': ['get', 'casingWidth'],
        'line-opacity': ['get', 'casingOpacity'],
      },
    });
  }
  if (!map.getLayer(LAYER_POLY_SOLID)) {
    map.addLayer({
      id: LAYER_POLY_SOLID,
      type: 'line',
      source: SRC_POLYLINES,
      filter: ['==', ['get', 'dashed'], false],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'width'],
        'line-opacity': ['get', 'opacity'],
      },
    });
  }
  if (!map.getLayer(LAYER_POLY_DASHED)) {
    map.addLayer({
      id: LAYER_POLY_DASHED,
      type: 'line',
      source: SRC_POLYLINES,
      filter: ['==', ['get', 'dashed'], true],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'width'],
        'line-opacity': ['get', 'opacity'],
        'line-dasharray': [2.4, 2.2],
      },
    });
  }
  if (!map.getLayer(LAYER_POLY_HIT)) {
    map.addLayer({
      id: LAYER_POLY_HIT,
      type: 'line',
      source: SRC_POLYLINES,
      filter: ['==', ['get', 'interactive'], true],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': palette.primary,
        'line-width': 18,
        'line-opacity': 0.01,
      },
    });
  }

  // 3. Clustered trail points source + WebGL cluster layers
  if (!map.getSource(SRC_CLUSTERS)) {
    map.addSource(SRC_CLUSTERS, {
      type: 'geojson',
      data: clustersData,
      cluster: true,
      clusterMaxZoom: 11,
      clusterRadius: 46,
      clusterProperties: {
        incidentCount: ['+', ['case', ['get', 'hasIncident'], 1, 0]],
      },
    });
  } else {
    (map.getSource(SRC_CLUSTERS) as maplibregl.GeoJSONSource).setData(clustersData);
  }

  if (!map.getLayer(LAYER_CLUSTER_HALO)) {
    map.addLayer({
      id: LAYER_CLUSTER_HALO,
      type: 'circle',
      source: SRC_CLUSTERS,
      filter: ['has', 'point_count'],
      paint: {
        'circle-radius': ['step', ['get', 'point_count'], 22, 10, 26, 25, 30],
        'circle-color': [
          'case',
          ['>', ['coalesce', ['get', 'incidentCount'], 0], 0],
          palette.danger,
          palette.primary,
        ],
        'circle-opacity': 0.22,
      },
    });
  }
  if (!map.getLayer(LAYER_CLUSTER_CIRCLE)) {
    map.addLayer({
      id: LAYER_CLUSTER_CIRCLE,
      type: 'circle',
      source: SRC_CLUSTERS,
      filter: ['has', 'point_count'],
      paint: {
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 25, 24],
        'circle-color': palette.surface,
        'circle-stroke-color': [
          'case',
          ['>', ['coalesce', ['get', 'incidentCount'], 0], 0],
          palette.danger,
          palette.primary,
        ],
        'circle-stroke-width': 2.5,
      },
    });
  }
  if (!map.getLayer(LAYER_CLUSTER_COUNT)) {
    map.addLayer({
      id: LAYER_CLUSTER_COUNT,
      type: 'symbol',
      source: SRC_CLUSTERS,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 12.5,
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': palette.ink,
      },
    });
  }
  if (!map.getLayer(LAYER_UNCLUSTERED_INCIDENT)) {
    map.addLayer({
      id: LAYER_UNCLUSTERED_INCIDENT,
      type: 'circle',
      source: SRC_CLUSTERS,
      filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'hasIncident'], true]],
      paint: {
        'circle-radius': 17,
        'circle-color': palette.danger,
        'circle-opacity': 0.22,
        'circle-stroke-color': palette.danger,
        'circle-stroke-width': 1.8,
        'circle-stroke-opacity': 0.88,
      },
    });
  }
  if (!map.getLayer(LAYER_UNCLUSTERED_SELECTED)) {
    map.addLayer({
      id: LAYER_UNCLUSTERED_SELECTED,
      type: 'circle',
      source: SRC_CLUSTERS,
      filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'selected'], true]],
      paint: {
        'circle-radius': 16,
        'circle-color': palette.primary,
        'circle-opacity': 0.26,
        'circle-stroke-color': palette.strokeLight,
        'circle-stroke-width': 1.5,
      },
    });
  }
  if (!map.getLayer(LAYER_UNCLUSTERED_POINT)) {
    map.addLayer({
      id: LAYER_UNCLUSTERED_POINT,
      type: 'circle',
      source: SRC_CLUSTERS,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': ['case', ['==', ['get', 'selected'], true], 10.5, 8],
        'circle-color': ['get', 'color'],
        'circle-stroke-color': palette.strokeLight,
        'circle-stroke-width': ['case', ['==', ['get', 'selected'], true], 3, 2.2],
      },
    });
  }
  if (!map.getLayer(LAYER_UNCLUSTERED_LABEL)) {
    map.addLayer({
      id: LAYER_UNCLUSTERED_LABEL,
      type: 'symbol',
      source: SRC_CLUSTERS,
      filter: ['!', ['has', 'point_count']],
      minzoom: 9,
      layout: {
        'text-field': ['get', 'title'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 11.5,
        'text-offset': [0, 1.45],
        'text-anchor': 'top',
        'text-max-width': 12,
        'text-optional': true,
      },
      paint: {
        'text-color': palette.surface,
        'text-halo-color': palette.strokeLight,
        'text-halo-width': 1.6,
      },
    });
  }

  // 4. Interactive markers source + GPU layers (always above trails & polylines)
  if (!map.getSource(SRC_MARKERS)) {
    map.addSource(SRC_MARKERS, { type: 'geojson', data: markersData });
  } else {
    (map.getSource(SRC_MARKERS) as maplibregl.GeoJSONSource).setData(markersData);
  }

  if (!map.getLayer(LAYER_MARKERS_PULSE)) {
    map.addLayer({
      id: LAYER_MARKERS_PULSE,
      type: 'circle',
      source: SRC_MARKERS,
      filter: ['==', ['get', 'pulse'], true],
      paint: {
        'circle-radius': 18,
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.26,
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': 1.5,
        'circle-stroke-opacity': 0.6,
      },
    });
  }
  if (!map.getLayer(LAYER_MARKERS_ACTIVE)) {
    map.addLayer({
      id: LAYER_MARKERS_ACTIVE,
      type: 'circle',
      source: SRC_MARKERS,
      filter: ['==', ['get', 'active'], true],
      paint: {
        'circle-radius': ['+', ['get', 'radius'], 5],
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.25,
      },
    });
  }
  if (!map.getLayer(LAYER_MARKERS_DOT)) {
    map.addLayer({
      id: LAYER_MARKERS_DOT,
      type: 'circle',
      source: SRC_MARKERS,
      paint: {
        'circle-radius': ['get', 'radius'],
        'circle-color': ['get', 'color'],
        'circle-stroke-color': palette.strokeLight,
        'circle-stroke-width': 2.2,
      },
    });
  }
  if (!map.getLayer(LAYER_MARKERS_BADGE)) {
    map.addLayer({
      id: LAYER_MARKERS_BADGE,
      type: 'symbol',
      source: SRC_MARKERS,
      filter: ['!=', ['get', 'badge'], ''],
      layout: {
        'text-field': ['get', 'badge'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 10,
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': palette.strokeLight,
      },
    });
  }
  if (!map.getLayer(LAYER_MARKERS_LABEL)) {
    map.addLayer({
      id: LAYER_MARKERS_LABEL,
      type: 'symbol',
      source: SRC_MARKERS,
      filter: ['!=', ['get', 'label'], ''],
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 11,
        'text-offset': [0, 1.35],
        'text-anchor': 'top',
        'text-max-width': 13,
        'text-optional': true,
      },
      paint: {
        'text-color': palette.surface,
        'text-halo-color': palette.strokeLight,
        'text-halo-width': 1.6,
      },
    });
  }

  // Keep ALL static palette paint properties synchronized across Dark <-> Light theme toggles
  if (map.getLayer(LAYER_POLY_CASING)) {
    map.setPaintProperty(LAYER_POLY_CASING, 'line-color', palette.casingDark);
  }
  if (map.getLayer(LAYER_POLY_HIT)) {
    map.setPaintProperty(LAYER_POLY_HIT, 'line-color', palette.primary);
  }
  if (map.getLayer(LAYER_CLUSTER_HALO)) {
    map.setPaintProperty(LAYER_CLUSTER_HALO, 'circle-color', [
      'case',
      ['>', ['coalesce', ['get', 'incidentCount'], 0], 0],
      palette.danger,
      palette.primary,
    ]);
  }
  if (map.getLayer(LAYER_CLUSTER_CIRCLE)) {
    map.setPaintProperty(LAYER_CLUSTER_CIRCLE, 'circle-color', palette.surface);
    map.setPaintProperty(LAYER_CLUSTER_CIRCLE, 'circle-stroke-color', [
      'case',
      ['>', ['coalesce', ['get', 'incidentCount'], 0], 0],
      palette.danger,
      palette.primary,
    ]);
  }
  if (map.getLayer(LAYER_CLUSTER_COUNT)) {
    map.setPaintProperty(LAYER_CLUSTER_COUNT, 'text-color', palette.ink);
  }
  if (map.getLayer(LAYER_UNCLUSTERED_INCIDENT)) {
    map.setPaintProperty(LAYER_UNCLUSTERED_INCIDENT, 'circle-color', palette.danger);
    map.setPaintProperty(LAYER_UNCLUSTERED_INCIDENT, 'circle-stroke-color', palette.danger);
  }
  if (map.getLayer(LAYER_UNCLUSTERED_SELECTED)) {
    map.setPaintProperty(LAYER_UNCLUSTERED_SELECTED, 'circle-color', palette.primary);
    map.setPaintProperty(LAYER_UNCLUSTERED_SELECTED, 'circle-stroke-color', palette.strokeLight);
  }
  if (map.getLayer(LAYER_UNCLUSTERED_POINT)) {
    map.setPaintProperty(LAYER_UNCLUSTERED_POINT, 'circle-stroke-color', palette.strokeLight);
  }
  if (map.getLayer(LAYER_UNCLUSTERED_LABEL)) {
    map.setPaintProperty(LAYER_UNCLUSTERED_LABEL, 'text-color', palette.surface);
    map.setPaintProperty(LAYER_UNCLUSTERED_LABEL, 'text-halo-color', palette.strokeLight);
  }
  if (map.getLayer(LAYER_MARKERS_DOT)) {
    map.setPaintProperty(LAYER_MARKERS_DOT, 'circle-stroke-color', palette.strokeLight);
  }
  if (map.getLayer(LAYER_MARKERS_BADGE)) {
    map.setPaintProperty(LAYER_MARKERS_BADGE, 'text-color', palette.strokeLight);
  }
  if (map.getLayer(LAYER_MARKERS_LABEL)) {
    map.setPaintProperty(LAYER_MARKERS_LABEL, 'text-color', palette.surface);
    map.setPaintProperty(LAYER_MARKERS_LABEL, 'text-halo-color', palette.strokeLight);
  }
}

interface HoveredMarkerTip {
  id: string;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  preferBelow: boolean;
}

export const LostVectorMap: React.FC<LostVectorMapProps> = ({
  center,
  zoom,
  basemap,
  className,
  style,
  minZoom = 4.5,
  maxZoom = 18,
  maxBounds,
  scrollZoom = true,
  clusterPoints = [],
  onClusterPointClick,
  onClusterPointHover,
  markers = [],
  polylines = [],
  circles = [],
  fitBounds = null,
  fitBoundsKey,
  flyTo = null,
  onMapClick,
  onMapReady,
  enable3DTerrain = false,
  pitch = 0,
  bearing = 0,
  children,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const styleReadyRef = useRef<boolean>(false);
  const styleRequestIdRef = useRef<number>(0);
  const activeBasemapRef = useRef<LostMapBasemap>(basemap);
  const active3DRef = useRef<boolean>(enable3DTerrain);
  const applied3DRef = useRef<boolean>(enable3DTerrain);
  const activeStyleIsOfflineRef = useRef<boolean>(false);
  const paletteRef = useRef<MapWebGLPalette>(resolveMapWebGLPalette());

  // Latest data/callback refs so MapLibre event listeners never go stale & never recreate the map
  const clusterPointsRef = useRef(clusterPoints);
  const markersRef = useRef(markers);
  const polylinesRef = useRef(polylines);
  const circlesRef = useRef(circles);
  const onClusterPointClickRef = useRef(onClusterPointClick);
  const onClusterPointHoverRef = useRef(onClusterPointHover);
  const onMapClickRef = useRef(onMapClick);
  const onMapReadyRef = useRef(onMapReady);

  const lastFlyKeyRef = useRef<string | number | null>(null);
  const lastFitKeyRef = useRef<string | null>(null);
  const hoveredPolylineIdRef = useRef<string | null>(null);
  const hoveredClusterIdRef = useRef<string | null>(null);
  const hoveredClusterPosRef = useRef<{ x: number; y: number } | null>(null);
  const hoveredMarkerTipRef = useRef<HoveredMarkerTip | null>(null);
  const containerSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const initialMountOptionsRef = useRef({
    center,
    zoom,
    basemap,
    minZoom,
    maxZoom,
    maxBounds,
    scrollZoom,
    enable3DTerrain,
    pitch,
    bearing,
  });

  const [hoveredMarkerTip, setHoveredMarkerTip] = useState<HoveredMarkerTip | null>(null);

  useEffect(() => {
    clusterPointsRef.current = clusterPoints;
    markersRef.current = markers;
    polylinesRef.current = polylines;
    circlesRef.current = circles;
    onClusterPointClickRef.current = onClusterPointClick;
    onClusterPointHoverRef.current = onClusterPointHover;
    onMapClickRef.current = onMapClick;
    onMapReadyRef.current = onMapReady;
  });

  // Single MapLibre GL JS WebGL instance lifecycle (NEVER recreated on prop/filter/basemap changes)
  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;

    const init = initialMountOptionsRef.current;
    const perf = getMapPerformanceConfig();
    paletteRef.current = resolveMapWebGLPalette();

    const initLat = Number.isFinite(init.center[0]) ? init.center[0] : 16.047;
    const initLng = Number.isFinite(init.center[1]) ? init.center[1] : 108.2062;
    const { style: initStyle, needsAsyncUpgrade } = getCachedLostBasemapStyleSync(init.basemap, {
      enable3DTerrain: init.enable3DTerrain,
      isLiteMode: perf.isLiteMode,
    });

    const maplibreBounds: [[number, number], [number, number]] | undefined = init.maxBounds
      ? [
          [init.maxBounds[0][1], init.maxBounds[0][0]],
          [init.maxBounds[1][1], init.maxBounds[1][0]],
        ]
      : undefined;

    let disposed = false;
    const styleAbort = new AbortController();

    const map = new maplibregl.Map({
      container,
      style: initStyle,
      center: [initLng, initLat],
      zoom: init.zoom,
      minZoom: init.minZoom,
      maxZoom: init.maxZoom,
      maxBounds: maplibreBounds,
      pitch: init.pitch,
      bearing: init.bearing,
      maxPitch: 85,
      pixelRatio: perf.pixelRatio,
      maxTileCacheSize: perf.maxTileCacheSize,
      fadeDuration: perf.fadeDuration,
      cooperativeGestures: false,
      attributionControl: false,
      scrollZoom: init.scrollZoom,
      cancelPendingTileRequestsWhileZooming: true,
      canvasContextAttributes: {
        antialias: perf.antialias,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      },
    });

    const isNarrowViewport = typeof window !== 'undefined' && window.innerWidth < 640;
    activeStyleIsOfflineRef.current = isOfflineReliefFallbackStyle(initStyle);
    containerSizeRef.current = {
      width: container.clientWidth || 800,
      height: container.clientHeight || 500,
    };

    const setThrottledMarkerTip = (raw: { id: string; label: string; sublabel?: string; rawX: number; rawY: number } | null) => {
      if (!raw) {
        if (hoveredMarkerTipRef.current !== null) {
          hoveredMarkerTipRef.current = null;
          setHoveredMarkerTip(null);
        }
        return;
      }
      const { width } = containerSizeRef.current;
      const halfTipW = 126;
      const clampedX = width > halfTipW * 2 + 16 ? Math.max(halfTipW, Math.min(width - halfTipW, raw.rawX)) : Math.max(12, raw.rawX);
      const preferBelow = raw.rawY < 72;
      const clampedY = preferBelow ? raw.rawY + 16 : Math.max(12, raw.rawY - 14);
      const prev = hoveredMarkerTipRef.current;
      if (
        prev &&
        prev.id === raw.id &&
        prev.label === raw.label &&
        prev.sublabel === raw.sublabel &&
        prev.preferBelow === preferBelow &&
        Math.abs(prev.x - clampedX) < 6 &&
        Math.abs(prev.y - clampedY) < 6
      ) {
        return;
      }
      const next: HoveredMarkerTip = {
        id: raw.id,
        label: raw.label,
        sublabel: raw.sublabel,
        x: clampedX,
        y: clampedY,
        preferBelow,
      };
      hoveredMarkerTipRef.current = next;
      setHoveredMarkerTip(next);
    };

    map.addControl(new maplibregl.AttributionControl({ compact: isNarrowViewport }), 'bottom-right');
    mapRef.current = map;

    const syncAllOverlaysToMap = () => {
      if (disposed) return;
      const palette = resolveMapWebGLPalette();
      paletteRef.current = palette;
      attachGpuOverlayLayers(
        map,
        palette,
        buildCirclesFeatureCollection(circlesRef.current, palette),
        buildPolylinesFeatureCollection(polylinesRef.current, palette),
        buildClustersFeatureCollection(clusterPointsRef.current, palette),
        buildMarkersFeatureCollection(markersRef.current, palette)
      );
      styleReadyRef.current = true;
    };

    const recoverStyleReady = (allowStyleObjectFallback = false) => {
      if (disposed || styleReadyRef.current) return;
      if (map.isStyleLoaded() || (allowStyleObjectFallback && Boolean(map.getStyle()))) {
        try {
          if (map.getStyle()) {
            syncAllOverlaysToMap();
          }
        } catch {
          // Wait for subsequent styledata/idle tick if style JSON is still parsing
        }
      }
    };

    const canvasEl = map.getCanvas();
    const handleContextLost = (ev: Event) => {
      ev.preventDefault();
      styleReadyRef.current = false;
    };
    const handleContextRestored = () => {
      if (disposed) return;
      map.resize();
      recoverStyleReady(true);
    };
    canvasEl.addEventListener('webglcontextlost', handleContextLost, false);
    canvasEl.addEventListener('webglcontextrestored', handleContextRestored, false);

    map.on('style.load', syncAllOverlaysToMap);
    map.on('idle', () => recoverStyleReady(true));
    map.on('styledata', () => {
      if (!disposed && !styleReadyRef.current && map.isStyleLoaded()) {
        syncAllOverlaysToMap();
      }
    });
    map.on('error', () => {
      if (!disposed && !styleReadyRef.current && map.isStyleLoaded()) {
        syncAllOverlaysToMap();
      }
    });

    map.on('load', () => {
      if (disposed) return;
      syncAllOverlaysToMap();
      onMapReadyRef.current?.(map);

      // Upgrade initial fast relief shell to full cached OpenFreeMap vector style if not yet cached
      // Guard with styleRequestIdRef === 0 so rapid user basemap switches never collide with initial mount
      if (needsAsyncUpgrade && styleRequestIdRef.current === 0 && activeBasemapRef.current !== 'satellite') {
        const reqId = ++styleRequestIdRef.current;
        const target3D = active3DRef.current;
        void resolveLostBasemapStyle(activeBasemapRef.current, {
          enable3DTerrain: target3D,
          isLiteMode: perf.isLiteMode,
          signal: styleAbort.signal,
        })
          .then((resolved) => {
            if (disposed || styleAbort.signal.aborted || styleRequestIdRef.current !== reqId) return;
            // Skip redundant setStyle when offline fallback resolves to the already-mounted relief shell
            if (activeStyleIsOfflineRef.current && isOfflineReliefFallbackStyle(resolved) && applied3DRef.current === target3D) {
              return;
            }
            activeStyleIsOfflineRef.current = isOfflineReliefFallbackStyle(resolved);
            applied3DRef.current = target3D;
            styleReadyRef.current = false;
            map.setStyle(resolved, { diff: false });
          })
          .catch(() => {
            // Keep initial fast relief shell mounted cleanly if async upgrade rejects
          });
      }
    });

    // Unified deterministic click priority: Marker > Cluster > Trail Point > Interactive Polyline > Canvas
    map.on('click', (e) => {
      if (disposed) return;
      if (!styleReadyRef.current) {
        recoverStyleReady();
        if (!styleReadyRef.current) return;
      }

      const interactiveLayers = [
        LAYER_MARKERS_DOT,
        LAYER_CLUSTER_CIRCLE,
        LAYER_UNCLUSTERED_POINT,
        LAYER_POLY_HIT,
      ].filter((layerId) => Boolean(map.getLayer(layerId)));

      if (interactiveLayers.length > 0) {
        const clickBbox: [maplibregl.PointLike, maplibregl.PointLike] = [
          [e.point.x - 10, e.point.y - 10],
          [e.point.x + 10, e.point.y + 10],
        ];
        const hits = map.queryRenderedFeatures(clickBbox, { layers: interactiveLayers });

        // 1. Interactive marker click
        const markerHit = hits.find((f) => f.layer.id === LAYER_MARKERS_DOT);
        if (markerHit) {
          const hitId = String(markerHit.properties?.id || '');
          const matched = markersRef.current.find((m) => m.id === hitId);
          if (matched?.onClick) {
            matched.onClick();
            return;
          }
        }

        // 2. Cluster expansion click
        const clusterHit = hits.find((f) => f.layer.id === LAYER_CLUSTER_CIRCLE);
        if (clusterHit && clusterHit.geometry.type === 'Point') {
          const clusterId = Number(clusterHit.properties?.cluster_id);
          const source = map.getSource(SRC_CLUSTERS) as maplibregl.GeoJSONSource | undefined;
          const coords = clusterHit.geometry.coordinates as [number, number];
          if (source && Number.isFinite(clusterId)) {
            void source
              .getClusterExpansionZoom(clusterId)
              .then((targetZoom) => {
                if (!disposed) {
                  map.easeTo({
                    center: coords,
                    zoom: Math.min(15, targetZoom + 0.6),
                    duration: perf.isLiteMode ? 0 : 360,
                  });
                }
              })
              .catch(() => {
                if (!disposed) {
                  map.easeTo({
                    center: coords,
                    zoom: Math.min(15, map.getZoom() + 2),
                    duration: perf.isLiteMode ? 0 : 320,
                  });
                }
              });
          }
          return;
        }

        // 3. Unclustered trail point click
        const pointHit = hits.find((f) => f.layer.id === LAYER_UNCLUSTERED_POINT);
        if (pointHit) {
          const hitId = String(pointHit.properties?.id || '');
          if (hitId && onClusterPointClickRef.current) {
            onClusterPointClickRef.current(hitId);
            return;
          }
        }

        // 4. Interactive polyline click
        const polyHit = hits.find((f) => f.layer.id === LAYER_POLY_HIT);
        if (polyHit) {
          const hitId = String(polyHit.properties?.id || '');
          const matchedPoly = polylinesRef.current.find((p) => p.id === hitId);
          if (matchedPoly?.onClick) {
            matchedPoly.onClick();
            return;
          }
        }
      }

      onMapClickRef.current?.(e.lngLat.lat, e.lngLat.lng);
    });

    // Unified smooth hover tracking (pointer cursor + trail preview + marker tip + GPX hover sync)
    map.on('mousemove', (e) => {
      if (disposed || !styleReadyRef.current) return;

      const hoverLayers = [
        LAYER_MARKERS_DOT,
        LAYER_CLUSTER_CIRCLE,
        LAYER_UNCLUSTERED_POINT,
        LAYER_POLY_HIT,
      ].filter((layerId) => Boolean(map.getLayer(layerId)));

      if (hoverLayers.length === 0) return;

      const hoverBbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - 6, e.point.y - 6],
        [e.point.x + 6, e.point.y + 6],
      ];
      const hits = map.queryRenderedFeatures(hoverBbox, { layers: hoverLayers });
      const canvas = map.getCanvas();

      // Marker hover tooltip
      const markerHit = hits.find((f) => f.layer.id === LAYER_MARKERS_DOT);
      if (markerHit) {
        const hitId = String(markerHit.properties?.id || '');
        const matched = markersRef.current.find((m) => m.id === hitId);
        canvas.style.cursor = matched?.onClick ? 'pointer' : 'default';
        if (matched && (matched.label || matched.sublabel)) {
          setThrottledMarkerTip({
            id: matched.id,
            label: matched.label || matched.sublabel || '',
            sublabel: matched.label ? matched.sublabel : undefined,
            rawX: e.point.x,
            rawY: e.point.y,
          });
        } else {
          setThrottledMarkerTip(null);
        }
        if (hoveredClusterIdRef.current !== null) {
          hoveredClusterIdRef.current = null;
          hoveredClusterPosRef.current = null;
          onClusterPointHoverRef.current?.(null);
        }
        return;
      }
      setThrottledMarkerTip(null);

      // Cluster circle hover
      const clusterHit = hits.find((f) => f.layer.id === LAYER_CLUSTER_CIRCLE);
      if (clusterHit) {
        canvas.style.cursor = 'pointer';
        if (hoveredClusterIdRef.current !== null) {
          hoveredClusterIdRef.current = null;
          hoveredClusterPosRef.current = null;
          onClusterPointHoverRef.current?.(null);
        }
        return;
      }

      // Unclustered trail point hover
      const pointHit = hits.find((f) => f.layer.id === LAYER_UNCLUSTERED_POINT);
      if (pointHit) {
        const hitId = String(pointHit.properties?.id || '');
        canvas.style.cursor = 'pointer';
        if (hitId) {
          const prevPos = hoveredClusterPosRef.current;
          const movedEnough =
            hoveredClusterIdRef.current !== hitId ||
            !prevPos ||
            Math.abs(prevPos.x - e.point.x) >= 6 ||
            Math.abs(prevPos.y - e.point.y) >= 6;
          if (movedEnough) {
            hoveredClusterIdRef.current = hitId;
            hoveredClusterPosRef.current = { x: e.point.x, y: e.point.y };
            onClusterPointHoverRef.current?.(hitId, { x: e.point.x, y: e.point.y });
          }
        }
        return;
      }

      if (hoveredClusterIdRef.current !== null) {
        hoveredClusterIdRef.current = null;
        hoveredClusterPosRef.current = null;
        onClusterPointHoverRef.current?.(null);
      }

      // Interactive polyline hover (for 2-way GPX <-> Elevation chart sync)
      const polyHit = hits.find((f) => f.layer.id === LAYER_POLY_HIT);
      if (polyHit) {
        const hitId = String(polyHit.properties?.id || '');
        const matchedPoly = polylinesRef.current.find((p) => p.id === hitId);
        canvas.style.cursor = matchedPoly?.onClick || matchedPoly?.onHover ? 'pointer' : '';
        if (hoveredPolylineIdRef.current && hoveredPolylineIdRef.current !== hitId) {
          const prevPoly = polylinesRef.current.find((p) => p.id === hoveredPolylineIdRef.current);
          prevPoly?.onHoverOut?.();
        }
        hoveredPolylineIdRef.current = hitId;
        matchedPoly?.onHover?.(e.lngLat.lat, e.lngLat.lng);
        return;
      }

      if (hoveredPolylineIdRef.current) {
        const prevPoly = polylinesRef.current.find((p) => p.id === hoveredPolylineIdRef.current);
        prevPoly?.onHoverOut?.();
        hoveredPolylineIdRef.current = null;
      }

      canvas.style.cursor = onMapClickRef.current ? 'crosshair' : '';
    });

    map.on('mouseout', () => {
      if (disposed) return;
      setThrottledMarkerTip(null);
      if (hoveredClusterIdRef.current !== null) {
        hoveredClusterIdRef.current = null;
        hoveredClusterPosRef.current = null;
        onClusterPointHoverRef.current?.(null);
      }
      if (hoveredPolylineIdRef.current) {
        const prevPoly = polylinesRef.current.find((p) => p.id === hoveredPolylineIdRef.current);
        prevPoly?.onHoverOut?.();
        hoveredPolylineIdRef.current = null;
      }
    });

    // Dismiss hover preview during drag/zoom so tooltips never lag behind map pan
    const handleMoveStart = () => {
      setThrottledMarkerTip(null);
      if (hoveredClusterIdRef.current !== null) {
        hoveredClusterIdRef.current = null;
        hoveredClusterPosRef.current = null;
        onClusterPointHoverRef.current?.(null);
      }
    };
    map.on('movestart', handleMoveStart);

    // ResizeObserver throttled via rAF so split-pane/tab resizes stay crisp without flicker
    let resizeRaf: number | null = null;
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (resizeRaf !== null) return;
            resizeRaf = window.requestAnimationFrame(() => {
              resizeRaf = null;
              if (!disposed) {
                containerSizeRef.current = {
                  width: container.clientWidth || 800,
                  height: container.clientHeight || 500,
                };
                map.resize();
              }
            });
          })
        : null;
    resizeObserver?.observe(container);

    // Sync WebGL overlay colors cleanly whenever user toggles Dark <-> Light theme
    const themeObserver =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => {
            if (!disposed && styleReadyRef.current) {
              syncAllOverlaysToMap();
            }
          })
        : null;
    themeObserver?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      disposed = true;
      styleAbort.abort();
      styleReadyRef.current = false;
      canvasEl.removeEventListener('webglcontextlost', handleContextLost, false);
      canvasEl.removeEventListener('webglcontextrestored', handleContextRestored, false);
      if (resizeRaf !== null) window.cancelAnimationFrame(resizeRaf);
      resizeObserver?.disconnect();
      themeObserver?.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Switch basemap or 3D terrain via cached style JSON (0 network refetch, 0 WebGL teardown)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (activeBasemapRef.current === basemap && active3DRef.current === enable3DTerrain) {
      return;
    }

    activeBasemapRef.current = basemap;
    active3DRef.current = enable3DTerrain;
    const reqId = ++styleRequestIdRef.current;
    const controller = new AbortController();
    const perf = getMapPerformanceConfig();

    void resolveLostBasemapStyle(basemap, {
      enable3DTerrain,
      isLiteMode: perf.isLiteMode,
      signal: controller.signal,
    })
      .then((nextStyle) => {
        if (controller.signal.aborted || mapRef.current !== map || styleRequestIdRef.current !== reqId) return;
        const nextIsOffline = isOfflineReliefFallbackStyle(nextStyle);
        if (activeStyleIsOfflineRef.current && nextIsOffline && applied3DRef.current === enable3DTerrain) {
          return;
        }
        activeStyleIsOfflineRef.current = nextIsOffline;
        applied3DRef.current = enable3DTerrain;
        styleReadyRef.current = false;
        map.setStyle(nextStyle, { diff: false });
      })
      .catch(() => {
        // Ignore aborted or failed basemap fetch while preserving the currently mounted style
      });

    return () => {
      controller.abort();
    };
  }, [basemap, enable3DTerrain]);

  // Incremental GPU GeoJSON updates (NEVER recreate the map instance!)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    const src = map.getSource(SRC_CIRCLES) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(buildCirclesFeatureCollection(circles, paletteRef.current));
  }, [circles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    const src = map.getSource(SRC_POLYLINES) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(buildPolylinesFeatureCollection(polylines, paletteRef.current));
  }, [polylines]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    const src = map.getSource(SRC_CLUSTERS) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(buildClustersFeatureCollection(clusterPoints, paletteRef.current));
  }, [clusterPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    const src = map.getSource(SRC_MARKERS) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(buildMarkersFeatureCollection(markers, paletteRef.current));
  }, [markers]);

  // Lightweight GPU pulse animation ONLY when a pulsing marker exists, tab is visible, and not in lite mode
  const hasPulsingMarker = markers.some((m) => m.pulse);
  useEffect(() => {
    if (!hasPulsingMarker) return;
    const perf = getMapPerformanceConfig();
    if (perf.isLiteMode) return;

    let rafId: number | null = null;
    let lastTick = 0;

    const tick = (now: number) => {
      if (typeof document !== 'undefined' && document.hidden) {
        rafId = null;
        return;
      }
      const map = mapRef.current;
      if (map && styleReadyRef.current && map.getLayer(LAYER_MARKERS_PULSE) && now - lastTick >= 33) {
        lastTick = now;
        const phase = (now % 1800) / 1800;
        const radius = 12 + phase * 14;
        const opacity = Math.max(0.04, (1 - phase) * 0.42);
        map.setPaintProperty(LAYER_MARKERS_PULSE, 'circle-radius', radius);
        map.setPaintProperty(LAYER_MARKERS_PULSE, 'circle-opacity', opacity);
        map.setPaintProperty(LAYER_MARKERS_PULSE, 'circle-stroke-opacity', Math.max(0.08, (1 - phase) * 0.72));
      }
      rafId = window.requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (rafId === null && (typeof document === 'undefined' || !document.hidden)) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        if (rafId !== null) {
          window.cancelAnimationFrame(rafId);
          rafId = null;
        }
      } else {
        startLoop();
      }
    };

    startLoop();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [hasPulsingMarker]);

  // Toggle scroll wheel zoom cleanly without recreating the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (scrollZoom) {
      map.scrollZoom.enable();
    } else {
      map.scrollZoom.disable();
    }
  }, [scrollZoom]);

  // Smooth camera pitch & bearing updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const perf = getMapPerformanceConfig();
    const pitchDiff = Math.abs(map.getPitch() - pitch);
    const bearingDelta = Math.abs((((bearing - map.getBearing()) % 360) + 540) % 360 - 180);
    if (pitchDiff > 0.5 || bearingDelta > 0.5) {
      map.easeTo({ pitch, bearing, duration: perf.isLiteMode ? 0 : 280 });
    }
  }, [pitch, bearing]);

  // Imperative flyTo keyed on flyTo.key
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    if (lastFlyKeyRef.current === flyTo.key) return;
    if (!Number.isFinite(flyTo.lat) || !Number.isFinite(flyTo.lng)) return;

    lastFlyKeyRef.current = flyTo.key;
    const perf = getMapPerformanceConfig();
    const duration =
      perf.isLiteMode ? 0 : typeof flyTo.duration === 'number' ? flyTo.duration : 780;

    map.easeTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: typeof flyTo.zoom === 'number' ? flyTo.zoom : map.getZoom(),
      duration,
      essential: true,
    });
  }, [flyTo]);

  // Imperative fitBounds keyed on fitBoundsKey or bounds coordinates
  useEffect(() => {
    if (!fitBounds) {
      lastFitKeyRef.current = null;
      return;
    }
    const map = mapRef.current;
    if (!map) return;
    const [[minLat, minLng], [maxLat, maxLng]] = fitBounds;
    if (
      !Number.isFinite(minLat) ||
      !Number.isFinite(minLng) ||
      !Number.isFinite(maxLat) ||
      !Number.isFinite(maxLng)
    ) {
      return;
    }

    const serialKey =
      fitBoundsKey !== undefined
        ? String(fitBoundsKey)
        : `${minLat.toFixed(4)},${minLng.toFixed(4)},${maxLat.toFixed(4)},${maxLng.toFixed(4)}`;
    if (lastFitKeyRef.current === serialKey) return;
    lastFitKeyRef.current = serialKey;

    const perf = getMapPerformanceConfig();
    try {
      map.fitBounds(
        [
          [Math.min(minLng, maxLng), Math.min(minLat, maxLat)],
          [Math.max(minLng, maxLng), Math.max(minLat, maxLat)],
        ],
        {
          padding: 56,
          maxZoom: 14.5,
          duration: perf.isLiteMode ? 0 : 480,
        }
      );
    } catch {
      // Ignore degenerate single-point bounds
    }
  }, [fitBounds, fitBoundsKey]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--color-bg-main)',
        fontFamily: 'var(--font-family)',
        ...style,
      }}
    >
      <div
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Lightweight GPU-synced floating tooltip for hovered markers */}
      {hoveredMarkerTip && hoveredMarkerTip.label && (
        <div
          style={{
            position: 'absolute',
            left: hoveredMarkerTip.x,
            top: hoveredMarkerTip.y,
            transform: hoveredMarkerTip.preferBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            pointerEvents: 'none',
            zIndex: 'calc(var(--z-map-hud, 400) + 3)' as unknown as number,
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: 5,
            padding: '5px 9px',
            boxShadow: 'var(--shadow-card)',
            color: 'var(--color-text-main)',
            fontFamily: 'var(--font-family)',
            maxWidth: 240,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontSize: '0.74rem', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {hoveredMarkerTip.label}
          </div>
          {hoveredMarkerTip.sublabel && (
            <div style={{ fontSize: '0.67rem', color: 'var(--color-text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {hoveredMarkerTip.sublabel}
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  );
};

export default LostVectorMap;
