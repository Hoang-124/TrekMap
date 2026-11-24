import React, { useMemo, useRef, useState, useCallback, useId } from 'react';
import type {
  CockpitBeaconPoint,
  CockpitIncidentPoint,
  CockpitInspectorSelection,
  CockpitTrailPoint,
  VietnamSectorId,
} from './adminCockpitTypes.js';

export interface VietnamTacticalRadarProps {
  trails: CockpitTrailPoint[];
  incidents: CockpitIncidentPoint[];
  beacons: CockpitBeaconPoint[];
  selectedId?: string | null;
  onSelect: (selection: CockpitInspectorSelection) => void;
  onPointerCoordChange?: (coords: { lat: number; lng: number } | null) => void;
}

interface ViewBoxSpec {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface HoverPayload {
  kind: 'trail' | 'incident' | 'beacon';
  id: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
  badge: string;
  tone: 'primary' | 'sky' | 'stream' | 'earth' | 'error' | 'sun' | 'muted';
  title: string;
  subtitle: string;
  metrics: Array<{ label: string; value: string }>;
}

// Equirectangular Vietnam projection calibrated to 16 deg N mid-latitude cosine ratio.
const CANVAS_W = 680;
const CANVAS_H = 580;
const MAP_TOP = 26;
const LAT_MAX = 23.65;
const LAT_MIN = 8.25;
const PY_PER_DEG = 528 / (LAT_MAX - LAT_MIN); // 34.2857 px per degree latitude
const PX_PER_DEG = PY_PER_DEG * Math.cos((16 * Math.PI) / 180); // 32.9575 px per degree longitude
const LNG_ORIGIN = 101.6;
const ORIGIN_X = 110;

const projectCoord = (lat: number, lng: number): { x: number; y: number } => ({
  x: ORIGIN_X + (lng - LNG_ORIGIN) * PX_PER_DEG,
  y: MAP_TOP + (LAT_MAX - lat) * PY_PER_DEG,
});

const unprojectCoord = (x: number, y: number): { lat: number; lng: number } => ({
  lat: LAT_MAX - (y - MAP_TOP) / PY_PER_DEG,
  lng: LNG_ORIGIN + (x - ORIGIN_X) / PX_PER_DEG,
});

const isValidVietnamCoord = (lat?: number, lng?: number): boolean =>
  typeof lat === 'number' &&
  typeof lng === 'number' &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= 6.0 &&
  lat <= 24.5 &&
  lng >= 101.0 &&
  lng <= 118.0;

const toSvgPath = (coords: ReadonlyArray<readonly [number, number]>, close = true): string => {
  if (coords.length === 0) return '';
  const parts = coords.map(([lat, lng], idx) => {
    const { x, y } = projectCoord(lat, lng);
    return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return close ? `${parts.join(' ')} Z` : parts.join(' ');
};

// Accurate real-world geographic coordinates of Vietnam mainland boundary (clockwise from A Pa Chai NW).
const VIETNAM_MAINLAND_COORDS: ReadonlyArray<readonly [number, number]> = [
  [22.40, 102.14],
  [22.72, 102.45],
  [22.80, 102.85],
  [22.80, 103.36],
  [22.78, 103.65],
  [22.52, 103.98],
  [22.82, 104.35],
  [23.18, 104.88],
  [23.39, 105.32],
  [23.15, 105.68],
  [22.98, 106.05],
  [22.96, 106.58],
  [22.65, 106.76],
  [22.24, 106.58],
  [21.95, 106.74],
  [21.74, 107.22],
  [21.70, 107.55],
  [21.58, 107.76],
  [21.53, 108.05],
  [21.22, 107.55],
  [20.94, 107.06],
  [20.72, 106.82],
  [20.30, 106.56],
  [19.95, 106.04],
  [19.30, 105.82],
  [18.80, 105.72],
  [18.28, 106.15],
  [17.95, 106.46],
  [17.48, 106.64],
  [16.92, 107.18],
  [16.58, 107.62],
  [16.22, 108.12],
  [16.08, 108.30],
  [15.62, 108.56],
  [15.20, 108.92],
  [14.52, 109.10],
  [13.78, 109.28],
  [13.20, 109.32],
  [12.88, 109.46],
  [12.58, 109.44],
  [12.24, 109.22],
  [11.88, 109.24],
  [11.62, 109.22],
  [11.24, 108.76],
  [10.94, 108.30],
  [10.68, 107.82],
  [10.34, 107.09],
  [10.35, 106.82],
  [9.94, 106.66],
  [9.58, 106.34],
  [9.24, 105.92],
  [8.78, 105.22],
  [8.58, 104.78],
  [8.72, 104.72],
  [9.20, 104.80],
  [9.72, 104.92],
  [10.02, 105.08],
  [10.38, 104.48],
  [10.65, 104.94],
  [10.92, 105.28],
  [10.95, 105.88],
  [11.15, 106.15],
  [11.58, 105.88],
  [11.82, 106.45],
  [12.28, 106.95],
  [12.88, 107.58],
  [13.78, 107.48],
  [14.68, 107.56],
  [15.48, 107.42],
  [16.12, 107.18],
  [16.65, 106.56],
  [17.15, 106.20],
  [17.78, 105.75],
  [18.38, 105.16],
  [19.05, 104.45],
  [19.55, 103.92],
  [20.02, 104.62],
  [20.68, 104.22],
  [20.92, 103.52],
  [21.24, 102.92],
  [21.85, 102.62],
];

// Real-world island silhouettes: Phu Quoc, Con Dao, Cat Ba.
const PHU_QUOC_COORDS: ReadonlyArray<readonly [number, number]> = [
  [10.42, 103.85],
  [10.40, 104.04],
  [10.22, 104.05],
  [10.02, 104.02],
  [10.00, 103.97],
  [10.21, 103.93],
  [10.34, 103.84],
];

const CON_DAO_COORDS: ReadonlyArray<readonly [number, number]> = [
  [8.75, 106.64],
  [8.70, 106.67],
  [8.64, 106.60],
  [8.67, 106.55],
  [8.73, 106.59],
];

const CAT_BA_COORDS: ReadonlyArray<readonly [number, number]> = [
  [20.85, 106.94],
  [20.83, 107.10],
  [20.72, 107.06],
  [20.74, 106.93],
];

// Authentic Vietnam topographic elevation contour rings (Hoang Lien Son, Tay Con Linh, Ngoc Linh, Langbiang).
const TOPO_CONTOUR_RINGS: ReadonlyArray<{
  id: string;
  tier: 'high' | 'mid';
  coords: ReadonlyArray<readonly [number, number]>;
}> = [
  {
    id: 'hls-outer',
    tier: 'mid',
    coords: [
      [22.66, 102.72],
      [22.74, 103.52],
      [22.44, 104.05],
      [21.82, 104.48],
      [21.26, 104.54],
      [21.18, 103.86],
      [21.74, 103.22],
      [22.25, 102.72],
    ],
  },
  {
    id: 'hls-inner',
    tier: 'high',
    coords: [
      [22.58, 103.26],
      [22.62, 103.78],
      [22.22, 103.98],
      [21.52, 104.38],
      [21.48, 104.02],
      [22.10, 103.50],
    ],
  },
  {
    id: 'ha-giang-karst',
    tier: 'mid',
    coords: [
      [23.22, 104.92],
      [23.28, 105.48],
      [22.90, 105.62],
      [22.62, 105.05],
      [22.74, 104.66],
    ],
  },
  {
    id: 'truong-son-north',
    tier: 'mid',
    coords: [
      [16.38, 107.38],
      [16.22, 108.02],
      [15.65, 108.16],
      [14.72, 108.62],
      [14.32, 108.28],
      [14.88, 107.72],
      [15.80, 107.42],
    ],
  },
  {
    id: 'ngoc-linh-core',
    tier: 'high',
    coords: [
      [15.22, 107.86],
      [15.10, 108.34],
      [14.54, 108.56],
      [14.48, 108.05],
      [14.88, 107.78],
    ],
  },
  {
    id: 'langbiang-outer',
    tier: 'mid',
    coords: [
      [12.74, 108.15],
      [12.66, 108.92],
      [11.96, 109.10],
      [11.48, 108.64],
      [11.58, 107.88],
      [12.24, 107.72],
    ],
  },
  {
    id: 'langbiang-inner',
    tier: 'high',
    coords: [
      [12.52, 108.28],
      [12.42, 108.76],
      [11.88, 108.84],
      [11.74, 108.34],
      [12.16, 108.12],
    ],
  },
];

// Reference national anchor cities (non-interactive cartographic landmarks).
const REFERENCE_CITIES: ReadonlyArray<{ label: string; lat: number; lng: number; dx: number; dy: number }> = [
  { label: 'HÀ NỘI', lat: 21.0285, lng: 105.8542, dx: 7, dy: 3 },
  { label: 'ĐÀ NẴNG', lat: 16.0544, lng: 108.2022, dx: 7, dy: 3 },
  { label: 'TP. HCM', lat: 10.7769, lng: 106.7009, dx: 7, dy: 3 },
];

// Sovereign archipelago insets (Hoang Sa — Da Nang; Truong Sa — Khanh Hoa).
const HOANG_SA_BOX = { x: 480, y: 234, w: 174, h: 112 };
const HOANG_SA_ISLANDS: ReadonlyArray<{ name: string; lat: number; lng: number; major?: boolean }> = [
  { name: 'Phú Lâm', lat: 16.835, lng: 112.338, major: true },
  { name: 'Hoàng Sa', lat: 16.533, lng: 111.617, major: true },
  { name: 'Linh Côn', lat: 16.667, lng: 112.733 },
  { name: 'Quang Ảnh', lat: 16.450, lng: 111.717 },
  { name: 'Tri Tôn', lat: 15.783, lng: 111.200 },
  { name: 'Đảo Bắc', lat: 16.960, lng: 112.310 },
];

const TRUONG_SA_BOX = { x: 480, y: 374, w: 174, h: 162 };
const TRUONG_SA_ISLANDS: ReadonlyArray<{ name: string; lat: number; lng: number; major?: boolean }> = [
  { name: 'Song Tử Tây', lat: 11.430, lng: 114.331, major: true },
  { name: 'Thị Tứ', lat: 11.052, lng: 114.285 },
  { name: 'Sơn Ca', lat: 10.375, lng: 114.478 },
  { name: 'Nam Yết', lat: 10.178, lng: 114.365 },
  { name: 'Sinh Tồn', lat: 9.886, lng: 114.328 },
  { name: 'Phan Vinh', lat: 8.975, lng: 113.698 },
  { name: 'Trường Sa Lớn', lat: 8.644, lng: 111.919, major: true },
  { name: 'An Bang', lat: 7.887, lng: 112.905 },
];

const projectInset = (
  lat: number,
  lng: number,
  box: { x: number; y: number; w: number; h: number },
  bounds: { latMin: number; latMax: number; lngMin: number; lngMax: number }
): { x: number; y: number } => {
  const padX = 14;
  const padTop = 26;
  const padBottom = 16;
  const innerW = box.w - padX * 2;
  const innerH = box.h - padTop - padBottom;
  const nx = (lng - bounds.lngMin) / (bounds.lngMax - bounds.lngMin);
  const ny = (bounds.latMax - lat) / (bounds.latMax - bounds.latMin);
  return {
    x: box.x + padX + nx * innerW,
    y: box.y + padTop + ny * innerH,
  };
};

const SECTOR_CONFIG: Record<
  VietnamSectorId,
  { label: string; shortLabel: string; viewBox: ViewBoxSpec; scaleKm: number }
> = {
  all: {
    label: 'Toàn quốc',
    shortLabel: 'VN',
    viewBox: { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H },
    scaleKm: 200,
  },
  north: {
    label: 'Miền Bắc',
    shortLabel: 'BẮC',
    viewBox: { x: 94, y: 16, w: 274, h: 184 },
    scaleKm: 100,
  },
  central: {
    label: 'Miền Trung',
    shortLabel: 'TRUNG',
    viewBox: { x: 168, y: 166, w: 332, h: 288 },
    scaleKm: 100,
  },
  south: {
    label: 'Miền Nam',
    shortLabel: 'NAM',
    viewBox: { x: 152, y: 372, w: 266, h: 204 },
    scaleKm: 100,
  },
};

const SECTOR_ORDER: readonly VietnamSectorId[] = ['all', 'north', 'central', 'south'];

const GRATICULE_LNGS = [102, 103, 104, 105, 106, 107, 108, 109] as const;
const GRATICULE_LATS_ALL = [10, 12, 14, 16, 18, 20, 22] as const;
const GRATICULE_LATS_FINE = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] as const;

const MAINLAND_PATH = toSvgPath(VIETNAM_MAINLAND_COORDS, true);
const PHU_QUOC_PATH = toSvgPath(PHU_QUOC_COORDS, true);
const CON_DAO_PATH = toSvgPath(CON_DAO_COORDS, true);
const CAT_BA_PATH = toSvgPath(CAT_BA_COORDS, true);
const CONTOUR_PATHS = TOPO_CONTOUR_RINGS.map((ring) => ({
  ...ring,
  d: toSvgPath(ring.coords, true),
}));

const formatGps = (lat: number, lng: number): string =>
  `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;

const formatNumberVi = (value: number): string =>
  Math.round(value).toLocaleString('vi-VN');

const getAltitudeTier = (
  alt: number
): { tier: 'alpine' | 'mid' | 'low'; badge: string; tone: 'primary' | 'sky' | 'stream' } => {
  if (alt >= 2500) {
    return { tier: 'alpine', badge: 'ĐỈNH CAO ≥2.500M', tone: 'primary' };
  }
  if (alt >= 1500) {
    return { tier: 'mid', badge: 'TRUNG BÌNH 1.500–2.499M', tone: 'sky' };
  }
  return { tier: 'low', badge: 'RỪNG & ĐỒI <1.500M', tone: 'stream' };
};

const getSeverityLabel = (severity: string): { label: string; isSevere: boolean } => {
  const s = severity.toLowerCase();
  if (s === 'critical' || s === 'high' || s === 'urgent' || s === 'nguy hiểm' || s === 'cao') {
    return { label: 'SỰ CỐ CAO', isSevere: true };
  }
  if (s === 'medium' || s === 'moderate' || s === 'trung bình') {
    return { label: 'SỰ CỐ TRUNG BÌNH', isSevere: false };
  }
  return { label: 'CẢNH BÁO THỰC ĐỊA', isSevere: false };
};

const getToneCssVar = (tone: HoverPayload['tone']): string => {
  switch (tone) {
    case 'primary':
      return 'var(--color-primary)';
    case 'sky':
      return 'var(--color-sky)';
    case 'stream':
      return 'var(--color-stream)';
    case 'earth':
      return 'var(--color-earth)';
    case 'error':
      return 'var(--color-error)';
    case 'sun':
      return 'var(--color-sun)';
    default:
      return 'var(--color-text-muted)';
  }
};

export const VietnamTacticalRadar: React.FC<VietnamTacticalRadarProps> = ({
  trails,
  incidents,
  beacons,
  selectedId = null,
  onSelect,
  onPointerCoordChange,
}) => {
  const uid = useId().replace(/:/g, '');
  const mainlandClipId = `vn-mainland-clip-${uid}`;
  const radarGlowId = `vn-radar-glow-${uid}`;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const lastEmitTsRef = useRef<number>(0);

  const [sector, setSector] = useState<VietnamSectorId>('all');
  const [showTrails, setShowTrails] = useState<boolean>(true);
  const [showIncidents, setShowIncidents] = useState<boolean>(true);
  const [showBeacons, setShowBeacons] = useState<boolean>(true);
  const [showGraticule, setShowGraticule] = useState<boolean>(true);
  const [hovered, setHovered] = useState<HoverPayload | null>(null);
  const [pointerCoords, setPointerCoords] = useState<{ lat: number; lng: number } | null>(null);

  const activeConfig = SECTOR_CONFIG[sector];
  const vb = activeConfig.viewBox;

  // Keep strokes hairline-crisp and markers legible across all sector zoom levels.
  const zoomRatio = vb.w / CANVAS_W;
  const strokeScale = zoomRatio;
  const markerScale = Math.pow(zoomRatio, 0.74);

  const plottedTrails = useMemo(() => {
    return trails
      .filter((t) => isValidVietnamCoord(t.startLat, t.startLng))
      .map((t) => {
        const pt = projectCoord(t.startLat, t.startLng);
        const tierInfo = getAltitudeTier(t.maxAltitudeM);
        return { trail: t, x: pt.x, y: pt.y, ...tierInfo };
      })
      .sort((a, b) => a.trail.maxAltitudeM - b.trail.maxAltitudeM);
  }, [trails]);

  const plottedIncidents = useMemo(() => {
    return incidents
      .filter((inc) => !inc.resolved && isValidVietnamCoord(inc.lat, inc.lng))
      .map((inc) => {
        const lat = inc.lat as number;
        const lng = inc.lng as number;
        const pt = projectCoord(lat, lng);
        const sev = getSeverityLabel(inc.severity);
        return { incident: inc, lat, lng, x: pt.x, y: pt.y, ...sev };
      });
  }, [incidents]);

  const plottedBeacons = useMemo(() => {
    return beacons
      .filter((b) => isValidVietnamCoord(b.lat, b.lng))
      .map((b) => {
        const lat = b.lat as number;
        const lng = b.lng as number;
        const pt = projectCoord(lat, lng);
        return { beacon: b, lat, lng, x: pt.x, y: pt.y };
      })
      .sort((a, b) => {
        const rank = (s: CockpitBeaconPoint['status']) => (s === 'sos' ? 2 : s === 'active' ? 1 : 0);
        return rank(a.beacon.status) - rank(b.beacon.status);
      });
  }, [beacons]);

  const selectedAnchor = useMemo(() => {
    if (!selectedId) return null;
    const trailHit = plottedTrails.find((item) => item.trail.id === selectedId);
    if (trailHit) {
      return {
        x: trailHit.x,
        y: trailHit.y,
        lat: trailHit.trail.startLat,
        lng: trailHit.trail.startLng,
        label: trailHit.trail.name,
        colorVar: 'var(--color-primary)',
      };
    }
    const beaconHit = plottedBeacons.find((item) => item.beacon.id === selectedId);
    if (beaconHit) {
      return {
        x: beaconHit.x,
        y: beaconHit.y,
        lat: beaconHit.lat,
        lng: beaconHit.lng,
        label: beaconHit.beacon.displayName,
        colorVar: beaconHit.beacon.status === 'sos' ? 'var(--color-error)' : 'var(--color-sun)',
      };
    }
    const incHit = plottedIncidents.find((item) => item.incident.id === selectedId);
    if (incHit) {
      return {
        x: incHit.x,
        y: incHit.y,
        lat: incHit.lat,
        lng: incHit.lng,
        label: incHit.incident.trailName,
        colorVar: 'var(--color-error)',
      };
    }
    return null;
  }, [selectedId, plottedTrails, plottedBeacons, plottedIncidents]);

  const handleSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const now = performance.now();
      if (now - lastEmitTsRef.current < 36) return;
      lastEmitTsRef.current = now;

      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(ctm.inverse());
      const geo = unprojectCoord(svgPt.x, svgPt.y);

      if (geo.lat >= 7.5 && geo.lat <= 24.4 && geo.lng >= 100.5 && geo.lng <= 116.8) {
        const rounded = {
          lat: Math.round(geo.lat * 10000) / 10000,
          lng: Math.round(geo.lng * 10000) / 10000,
        };
        setPointerCoords(rounded);
        onPointerCoordChange?.(rounded);
      } else {
        setPointerCoords(null);
        onPointerCoordChange?.(null);
      }
    },
    [onPointerCoordChange]
  );

  const handleSvgPointerLeave = useCallback(() => {
    setHovered(null);
    setPointerCoords(null);
    onPointerCoordChange?.(null);
  }, [onPointerCoordChange]);

  const activeSosCount = useMemo(
    () => plottedBeacons.filter((b) => b.beacon.status === 'sos').length,
    [plottedBeacons]
  );

  const activeBeaconCount = useMemo(
    () => plottedBeacons.filter((b) => b.beacon.status === 'active' || b.beacon.status === 'sos').length,
    [plottedBeacons]
  );

  const graticuleLats = sector === 'all' ? GRATICULE_LATS_ALL : GRATICULE_LATS_FINE;
  const scaleBarSvgPx = (activeConfig.scaleKm / 111.1) * PY_PER_DEG;

  const hoverAnchorStyle = useMemo<React.CSSProperties | null>(() => {
    if (!hovered) return null;
    const pctX = ((hovered.x - vb.x) / vb.w) * 100;
    const pctY = ((hovered.y - vb.y) / vb.h) * 100;
    const clampedX = Math.max(4, Math.min(96, pctX));
    const clampedY = Math.max(6, Math.min(94, pctY));
    const alignRight = clampedX > 60;
    const placeBelow = clampedY < 30;
    return {
      position: 'absolute',
      left: `${clampedX.toFixed(2)}%`,
      top: `${clampedY.toFixed(2)}%`,
      transform: `translate(${alignRight ? 'calc(-100% - 14px)' : '14px'}, ${placeBelow ? '12px' : 'calc(-100% - 12px)'})`,
      pointerEvents: 'none',
      zIndex: 12,
      width: '232px',
      padding: '10px 12px',
      borderRadius: '6px',
      background: 'var(--color-bg-card)',
      border: '1px solid var(--color-border-strong)',
      boxShadow: 'var(--shadow-card)',
      color: 'var(--color-text-main)',
      fontFamily: 'var(--font-family)',
    };
  }, [hovered, vb.x, vb.y, vb.w, vb.h]);

  const readoutCoords = pointerCoords
    ? pointerCoords
    : selectedAnchor
      ? { lat: selectedAnchor.lat, lng: selectedAnchor.lng }
      : null;

  const insetHoangSaPoints = useMemo(
    () =>
      HOANG_SA_ISLANDS.map((isl) => ({
        ...isl,
        ...projectInset(isl.lat, isl.lng, HOANG_SA_BOX, {
          latMin: 15.5,
          latMax: 17.25,
          lngMin: 110.9,
          lngMax: 113.1,
        }),
      })),
    []
  );

  const insetTruongSaPoints = useMemo(
    () =>
      TRUONG_SA_ISLANDS.map((isl) => ({
        ...isl,
        ...projectInset(isl.lat, isl.lng, TRUONG_SA_BOX, {
          latMin: 7.4,
          latMax: 11.9,
          lngMin: 111.4,
          lngMax: 115.2,
        }),
      })),
    []
  );

  const reticleSize = 11 * markerScale;
  const reticleCorner = 4.2 * markerScale;

  return (
    <section className="admin-radar-stage" aria-label="Bản đồ Radar Địa hình Tác chiến Việt Nam">
      <div className="admin-radar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="2" y1="12" x2="5" y2="12" />
              <line x1="19" y1="12" x2="22" y2="12" />
            </svg>
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--color-text-main)',
              }}
            >
              Radar Địa Hình Việt Nam
            </span>
          </div>

          <div className="admin-sector-pills" role="group" aria-label="Chọn khu vực bản đồ">
            {SECTOR_ORDER.map((secId) => (
              <button
                key={secId}
                type="button"
                className={`admin-sector-btn${sector === secId ? ' active' : ''}`}
                aria-pressed={sector === secId}
                onClick={() => {
                  setSector(secId);
                  setHovered(null);
                }}
              >
                {SECTOR_CONFIG[secId].label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`admin-layer-toggle${showTrails ? ' active' : ''}`}
            aria-pressed={showTrails}
            onClick={() => setShowTrails((v) => !v)}
          >
            <svg width={10} height={10} viewBox="0 0 12 12" aria-hidden="true">
              <polygon
                points="6,1 11,6 6,11 1,6"
                fill={showTrails ? 'var(--color-primary)' : 'none'}
                stroke="var(--color-primary)"
                strokeWidth="1.4"
              />
            </svg>
            <span>Tuyến ({plottedTrails.length})</span>
          </button>

          <button
            type="button"
            className={`admin-layer-toggle${showIncidents ? ' active' : ''}`}
            aria-pressed={showIncidents}
            onClick={() => setShowIncidents((v) => !v)}
          >
            <svg width={10} height={10} viewBox="0 0 12 12" aria-hidden="true">
              <polygon
                points="6,1.2 11,10.2 1,10.2"
                fill={showIncidents ? 'var(--color-error)' : 'none'}
                stroke="var(--color-error)"
                strokeWidth="1.3"
              />
            </svg>
            <span>Sự cố ({plottedIncidents.length})</span>
          </button>

          <button
            type="button"
            className={`admin-layer-toggle${showBeacons ? ' active' : ''}`}
            aria-pressed={showBeacons}
            onClick={() => setShowBeacons((v) => !v)}
          >
            <svg width={10} height={10} viewBox="0 0 12 12" aria-hidden="true">
              <circle
                cx="6"
                cy="6"
                r="4"
                fill={showBeacons ? (activeSosCount > 0 ? 'var(--color-error)' : 'var(--color-sun)') : 'none'}
                stroke={activeSosCount > 0 ? 'var(--color-error)' : 'var(--color-sun)'}
                strokeWidth="1.4"
              />
            </svg>
            <span>Đèn hiệu ({activeBeaconCount})</span>
          </button>

          <button
            type="button"
            className={`admin-layer-toggle${showGraticule ? ' active' : ''}`}
            aria-pressed={showGraticule}
            onClick={() => setShowGraticule((v) => !v)}
          >
            <svg width={10} height={10} viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <line x1="4" y1="1" x2="4" y2="11" stroke="currentColor" strokeWidth="1.2" />
              <line x1="8" y1="1" x2="8" y2="11" stroke="currentColor" strokeWidth="1.2" />
              <line x1="1" y1="4" x2="11" y2="4" stroke="currentColor" strokeWidth="1.2" />
              <line x1="1" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span>Lưới VN-2000</span>
          </button>
        </div>
      </div>

      <div className="admin-radar-canvas-wrap">
        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Bản đồ tương tác các cung đường trekking, sự cố thực địa và đèn hiệu GPS Việt Nam"
          onPointerMove={handleSvgPointerMove}
          onPointerLeave={handleSvgPointerLeave}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            minHeight: '380px',
            maxHeight: '468px',
            cursor: 'crosshair',
            userSelect: 'none',
          }}
        >
          <defs>
            <clipPath id={mainlandClipId}>
              <path d={MAINLAND_PATH} />
            </clipPath>
            <radialGradient id={radarGlowId} cx="42%" cy="46%" r="58%">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.09" />
              <stop offset="68%" stopColor="var(--color-stream)" stopOpacity="0.03" />
              <stop offset="100%" stopColor="var(--color-bg-main)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Subtle Cartographic Field Tint */}
          <rect
            x={vb.x}
            y={vb.y}
            width={vb.w}
            height={vb.h}
            fill={`url(#${radarGlowId})`}
            pointerEvents="none"
          />

          {/* Layer 0: VN-2000 Coordinate Graticule */}
          {showGraticule && (
            <g pointerEvents="none" aria-hidden="true">
              {GRATICULE_LNGS.map((lng) => {
                const { x } = projectCoord(LAT_MAX, lng);
                if (x < vb.x - 10 || x > vb.x + vb.w + 10) return null;
                return (
                  <g key={`mer-${lng}`}>
                    <line
                      x1={x}
                      y1={vb.y + 12 * strokeScale}
                      x2={x}
                      y2={vb.y + vb.h - 14 * strokeScale}
                      stroke="var(--color-border)"
                      strokeWidth={0.85 * strokeScale}
                      strokeDasharray={`${2.5 * strokeScale} ${3.5 * strokeScale}`}
                    />
                    <text
                      x={x}
                      y={vb.y + 10 * strokeScale}
                      textAnchor="middle"
                      fill="var(--color-text-dim)"
                      fontSize={7.8 * strokeScale}
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    >
                      {lng}°E
                    </text>
                  </g>
                );
              })}

              {graticuleLats.map((lat) => {
                const { y } = projectCoord(lat, LNG_ORIGIN);
                if (y < vb.y + 12 * strokeScale || y > vb.y + vb.h - 12 * strokeScale) return null;
                return (
                  <g key={`par-${lat}`}>
                    <line
                      x1={vb.x + 28 * strokeScale}
                      y1={y}
                      x2={vb.x + vb.w - 10 * strokeScale}
                      y2={y}
                      stroke="var(--color-border)"
                      strokeWidth={0.85 * strokeScale}
                      strokeDasharray={`${2.5 * strokeScale} ${3.5 * strokeScale}`}
                    />
                    <text
                      x={vb.x + 4 * strokeScale}
                      y={y + 2.6 * strokeScale}
                      textAnchor="start"
                      fill="var(--color-text-dim)"
                      fontSize={7.8 * strokeScale}
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    >
                      {lat}°N
                    </text>
                  </g>
                );
              })}

              {/* Precision Intersection Crosses */}
              {GRATICULE_LNGS.map((lng) =>
                GRATICULE_LATS_ALL.map((lat) => {
                  const pt = projectCoord(lat, lng);
                  if (
                    pt.x < vb.x + 24 * strokeScale ||
                    pt.x > vb.x + vb.w - 12 * strokeScale ||
                    pt.y < vb.y + 16 * strokeScale ||
                    pt.y > vb.y + vb.h - 16 * strokeScale
                  ) {
                    return null;
                  }
                  const arm = 2.4 * strokeScale;
                  return (
                    <path
                      key={`ix-${lng}-${lat}`}
                      d={`M${pt.x - arm},${pt.y} L${pt.x + arm},${pt.y} M${pt.x},${pt.y - arm} L${pt.x},${pt.y + arm}`}
                      stroke="var(--color-border-strong)"
                      strokeWidth={0.75 * strokeScale}
                    />
                  );
                })
              )}
            </g>
          )}

          {/* Layer 1: Vietnam Mainland Landmass + Topographic Elevation Contours + Islands */}
          <g pointerEvents="none">
            <path
              d={MAINLAND_PATH}
              fill="color-mix(in srgb, var(--color-surface-elevated) 84%, var(--color-primary) 16%)"
              stroke="color-mix(in srgb, var(--color-primary) 54%, var(--color-border-strong))"
              strokeWidth={1.35 * strokeScale}
              strokeLinejoin="round"
            />

            {/* Topographic Relief Contours clipped cleanly inside Vietnam Mainland */}
            <g clipPath={`url(#${mainlandClipId})`}>
              {CONTOUR_PATHS.map((ring) => (
                <path
                  key={ring.id}
                  d={ring.d}
                  fill={
                    ring.tier === 'high'
                      ? 'color-mix(in srgb, var(--color-primary) 13%, transparent)'
                      : 'color-mix(in srgb, var(--color-primary) 6%, transparent)'
                  }
                  stroke={
                    ring.tier === 'high'
                      ? 'color-mix(in srgb, var(--color-primary) 42%, transparent)'
                      : 'color-mix(in srgb, var(--color-text-dim) 28%, transparent)'
                  }
                  strokeWidth={(ring.tier === 'high' ? 0.9 : 0.7) * strokeScale}
                  strokeLinejoin="round"
                />
              ))}
            </g>

            {/* Phu Quoc, Con Dao, Cat Ba real island silhouettes */}
            <path
              d={PHU_QUOC_PATH}
              fill="color-mix(in srgb, var(--color-surface-elevated) 84%, var(--color-primary) 16%)"
              stroke="color-mix(in srgb, var(--color-primary) 58%, var(--color-border-strong))"
              strokeWidth={1.15 * strokeScale}
              strokeLinejoin="round"
            />
            <path
              d={CON_DAO_PATH}
              fill="color-mix(in srgb, var(--color-surface-elevated) 84%, var(--color-primary) 16%)"
              stroke="color-mix(in srgb, var(--color-primary) 58%, var(--color-border-strong))"
              strokeWidth={1.15 * strokeScale}
              strokeLinejoin="round"
            />
            <path
              d={CAT_BA_PATH}
              fill="color-mix(in srgb, var(--color-surface-elevated) 84%, var(--color-primary) 16%)"
              stroke="color-mix(in srgb, var(--color-primary) 55%, var(--color-border-strong))"
              strokeWidth={1.0 * strokeScale}
              strokeLinejoin="round"
            />

            {/* Subtle island micro-labels */}
            {(sector === 'all' || sector === 'south') && (
              <>
                <text
                  x={projectCoord(10.18, 103.80).x - 4 * strokeScale}
                  y={projectCoord(10.18, 103.80).y + 2 * strokeScale}
                  textAnchor="end"
                  fill="var(--color-text-dim)"
                  fontSize={7.2 * strokeScale}
                  fontWeight={600}
                  letterSpacing="0.04em"
                >
                  PHÚ QUỐC
                </text>
                <text
                  x={projectCoord(8.68, 106.72).x + 4 * strokeScale}
                  y={projectCoord(8.68, 106.72).y + 2.5 * strokeScale}
                  textAnchor="start"
                  fill="var(--color-text-dim)"
                  fontSize={7.2 * strokeScale}
                  fontWeight={600}
                  letterSpacing="0.04em"
                >
                  CÔN ĐẢO
                </text>
              </>
            )}

            {/* East Sea (Bien Dong) cartographic label on national overview */}
            {sector === 'all' && (
              <text
                x={448}
                y={184}
                textAnchor="middle"
                fill="var(--color-text-dim)"
                fillOpacity={0.55}
                fontSize={9.5}
                fontWeight={600}
                letterSpacing="0.28em"
              >
                BIỂN ĐÔNG
              </text>
            )}

            {/* National Reference Anchor Cities */}
            {REFERENCE_CITIES.map((city) => {
              const pt = projectCoord(city.lat, city.lng);
              if (pt.x < vb.x || pt.x > vb.x + vb.w || pt.y < vb.y || pt.y > vb.y + vb.h) {
                return null;
              }
              const s = 2.2 * strokeScale;
              return (
                <g key={city.label}>
                  <rect
                    x={pt.x - s / 2}
                    y={pt.y - s / 2}
                    width={s}
                    height={s}
                    fill="var(--color-text-muted)"
                    opacity={0.7}
                  />
                  <text
                    x={pt.x + city.dx * strokeScale}
                    y={pt.y + city.dy * strokeScale}
                    fill="var(--color-text-dim)"
                    fontSize={7.4 * strokeScale}
                    fontWeight={600}
                    letterSpacing="0.06em"
                    opacity={0.82}
                  >
                    {city.label}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Layer 1B: Sovereign Archipelago Inset Cartouches (Hoang Sa & Truong Sa) */}
          {sector === 'all' && (
            <g pointerEvents="none" aria-label="Bản đồ phụ Quần đảo Hoàng Sa và Quần đảo Trường Sa">
              {/* Hoang Sa Inset */}
              <g>
                <rect
                  x={HOANG_SA_BOX.x}
                  y={HOANG_SA_BOX.y}
                  width={HOANG_SA_BOX.w}
                  height={HOANG_SA_BOX.h}
                  rx={4}
                  fill="color-mix(in srgb, var(--color-bg-card) 82%, var(--color-bg-main))"
                  stroke="var(--color-border-strong)"
                  strokeWidth={0.95}
                />
                <line
                  x1={HOANG_SA_BOX.x}
                  y1={HOANG_SA_BOX.y + 19}
                  x2={HOANG_SA_BOX.x + HOANG_SA_BOX.w}
                  y2={HOANG_SA_BOX.y + 19}
                  stroke="var(--color-border)"
                  strokeWidth={0.8}
                />
                <text
                  x={HOANG_SA_BOX.x + 8}
                  y={HOANG_SA_BOX.y + 12.5}
                  fill="var(--color-text-muted)"
                  fontSize={7.6}
                  fontWeight={700}
                  letterSpacing="0.06em"
                >
                  QĐ. HOÀNG SA (ĐÀ NẴNG)
                </text>
                <text
                  x={HOANG_SA_BOX.x + HOANG_SA_BOX.w - 7}
                  y={HOANG_SA_BOX.y + HOANG_SA_BOX.h - 6}
                  textAnchor="end"
                  fill="var(--color-text-dim)"
                  fontSize={6.6}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  16°30&apos;N · 112°00&apos;E
                </text>
                {/* Internal subtle crosshair */}
                <line
                  x1={HOANG_SA_BOX.x + HOANG_SA_BOX.w / 2}
                  y1={HOANG_SA_BOX.y + 20}
                  x2={HOANG_SA_BOX.x + HOANG_SA_BOX.w / 2}
                  y2={HOANG_SA_BOX.y + HOANG_SA_BOX.h - 14}
                  stroke="var(--color-border)"
                  strokeWidth={0.6}
                  strokeDasharray="2 3"
                />
                <line
                  x1={HOANG_SA_BOX.x + 6}
                  y1={HOANG_SA_BOX.y + 66}
                  x2={HOANG_SA_BOX.x + HOANG_SA_BOX.w - 6}
                  y2={HOANG_SA_BOX.y + 66}
                  stroke="var(--color-border)"
                  strokeWidth={0.6}
                  strokeDasharray="2 3"
                />
                {insetHoangSaPoints.map((isl) => (
                  <g key={isl.name}>
                    <circle
                      cx={isl.x}
                      cy={isl.y}
                      r={isl.major ? 2.4 : 1.6}
                      fill="color-mix(in srgb, var(--color-primary) 72%, var(--color-text-main))"
                      stroke="var(--color-bg-card)"
                      strokeWidth={0.7}
                    />
                    {isl.major && (
                      <text
                        x={isl.x + 4.5}
                        y={isl.y + 2.4}
                        fill="var(--color-text-dim)"
                        fontSize={6.8}
                        fontWeight={600}
                      >
                        {isl.name}
                      </text>
                    )}
                  </g>
                ))}
              </g>

              {/* Truong Sa Inset */}
              <g>
                <rect
                  x={TRUONG_SA_BOX.x}
                  y={TRUONG_SA_BOX.y}
                  width={TRUONG_SA_BOX.w}
                  height={TRUONG_SA_BOX.h}
                  rx={4}
                  fill="color-mix(in srgb, var(--color-bg-card) 82%, var(--color-bg-main))"
                  stroke="var(--color-border-strong)"
                  strokeWidth={0.95}
                />
                <line
                  x1={TRUONG_SA_BOX.x}
                  y1={TRUONG_SA_BOX.y + 19}
                  x2={TRUONG_SA_BOX.x + TRUONG_SA_BOX.w}
                  y2={TRUONG_SA_BOX.y + 19}
                  stroke="var(--color-border)"
                  strokeWidth={0.8}
                />
                <text
                  x={TRUONG_SA_BOX.x + 8}
                  y={TRUONG_SA_BOX.y + 12.5}
                  fill="var(--color-text-muted)"
                  fontSize={7.6}
                  fontWeight={700}
                  letterSpacing="0.06em"
                >
                  QĐ. TRƯỜNG SA (KHÁNH HÒA)
                </text>
                <text
                  x={TRUONG_SA_BOX.x + TRUONG_SA_BOX.w - 7}
                  y={TRUONG_SA_BOX.y + TRUONG_SA_BOX.h - 6}
                  textAnchor="end"
                  fill="var(--color-text-dim)"
                  fontSize={6.6}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  10°00&apos;N · 114°20&apos;E
                </text>
                <line
                  x1={TRUONG_SA_BOX.x + TRUONG_SA_BOX.w / 2}
                  y1={TRUONG_SA_BOX.y + 20}
                  x2={TRUONG_SA_BOX.x + TRUONG_SA_BOX.w / 2}
                  y2={TRUONG_SA_BOX.y + TRUONG_SA_BOX.h - 14}
                  stroke="var(--color-border)"
                  strokeWidth={0.6}
                  strokeDasharray="2 3"
                />
                <line
                  x1={TRUONG_SA_BOX.x + 6}
                  y1={TRUONG_SA_BOX.y + 90}
                  x2={TRUONG_SA_BOX.x + TRUONG_SA_BOX.w - 6}
                  y2={TRUONG_SA_BOX.y + 90}
                  stroke="var(--color-border)"
                  strokeWidth={0.6}
                  strokeDasharray="2 3"
                />
                {insetTruongSaPoints.map((isl) => (
                  <g key={isl.name}>
                    <circle
                      cx={isl.x}
                      cy={isl.y}
                      r={isl.major ? 2.4 : 1.6}
                      fill="color-mix(in srgb, var(--color-primary) 72%, var(--color-text-main))"
                      stroke="var(--color-bg-card)"
                      strokeWidth={0.7}
                    />
                    {isl.major && (
                      <text
                        x={isl.x + 4.5}
                        y={isl.y + 2.4}
                        fill="var(--color-text-dim)"
                        fontSize={6.8}
                        fontWeight={600}
                      >
                        {isl.name}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            </g>
          )}

          {/* Layer 2: Altitude-Tiered Trail Nodes */}
          {showTrails && (
            <g aria-label="Các cung đường trekking">
              {plottedTrails.map(({ trail, x, y, tier, badge, tone }) => {
                const isSelected = selectedId === trail.id;
                const isHovered = hovered?.kind === 'trail' && hovered.id === trail.id;
                const activeBoost = isSelected || isHovered ? 1.24 : 1;

                const openHover = () => {
                  setHovered({
                    kind: 'trail',
                    id: trail.id,
                    x,
                    y,
                    lat: trail.startLat,
                    lng: trail.startLng,
                    badge,
                    tone,
                    title: trail.name,
                    subtitle: trail.district ? `${trail.district}, ${trail.province}` : trail.province,
                    metrics: [
                      { label: 'Đỉnh cao', value: `${formatNumberVi(trail.maxAltitudeM)} m` },
                      { label: 'Cự ly', value: `${trail.distanceKm.toFixed(1)} km` },
                      { label: 'Tăng cao', value: `+${formatNumberVi(trail.elevationGainM)} m` },
                    ],
                  });
                };

                const triggerSelect = () => onSelect({ kind: 'trail', data: trail });

                return (
                  <g
                    key={trail.id}
                    transform={`translate(${x.toFixed(2)}, ${y.toFixed(2)})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Tuyến ${trail.name}, ${trail.province}, độ cao ${trail.maxAltitudeM}m`}
                    style={{ cursor: 'pointer', outline: 'none' }}
                    onMouseEnter={openHover}
                    onFocus={openHover}
                    onMouseLeave={() => setHovered((prev) => (prev?.id === trail.id ? null : prev))}
                    onBlur={() => setHovered((prev) => (prev?.id === trail.id ? null : prev))}
                    onClick={triggerSelect}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        triggerSelect();
                      }
                    }}
                  >
                    {/* Generous transparent hit target */}
                    <circle r={9.5 * markerScale} fill="transparent" />

                    {tier === 'alpine' && (
                      <>
                        <polygon
                          points={`0,${(-5.4 * markerScale * activeBoost).toFixed(2)} ${(5.4 * markerScale * activeBoost).toFixed(2)},0 0,${(5.4 * markerScale * activeBoost).toFixed(2)} ${(-5.4 * markerScale * activeBoost).toFixed(2)},0`}
                          fill="var(--color-primary)"
                          stroke="var(--color-bg-card)"
                          strokeWidth={1.3 * strokeScale}
                        />
                        <circle r={1.35 * markerScale} fill="var(--color-on-primary)" />
                      </>
                    )}

                    {tier === 'mid' && (
                      <circle
                        r={4.1 * markerScale * activeBoost}
                        fill="var(--color-sky)"
                        stroke="var(--color-bg-card)"
                        strokeWidth={1.25 * strokeScale}
                      />
                    )}

                    {tier === 'low' && (
                      <circle
                        r={3.4 * markerScale * activeBoost}
                        fill="var(--color-bg-card)"
                        stroke="var(--color-stream)"
                        strokeWidth={1.7 * strokeScale}
                      />
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* Layer 3: Active Field Incidents (Animated Pulse Ring + Warning Triangle) */}
          {showIncidents && (
            <g aria-label="Các sự cố đang hoạt động">
              {plottedIncidents.map(({ incident, lat, lng, x, y, label, isSevere }) => {
                const colorVar = isSevere ? 'var(--color-error)' : 'var(--color-earth)';
                const triR = 5.6 * markerScale;

                const openHover = () => {
                  setHovered({
                    kind: 'incident',
                    id: incident.id,
                    x,
                    y,
                    lat,
                    lng,
                    badge: label,
                    tone: isSevere ? 'error' : 'earth',
                    title: incident.trailName,
                    subtitle: incident.locationNote || (incident.isSynthetic ? 'Cảnh báo vệ tinh / hệ thống' : 'Báo cáo thực địa'),
                    metrics: [
                      { label: 'Mức độ', value: incident.severity.toUpperCase() },
                      { label: 'Tranh chấp', value: `${incident.disputesCount}` },
                    ],
                  });
                };

                const triggerSelect = () => onSelect({ kind: 'incident', data: incident });

                return (
                  <g
                    key={incident.id}
                    transform={`translate(${x.toFixed(2)}, ${y.toFixed(2)})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Sự cố tại ${incident.trailName}: ${incident.severity}`}
                    style={{ cursor: 'pointer', outline: 'none' }}
                    onMouseEnter={openHover}
                    onFocus={openHover}
                    onMouseLeave={() => setHovered((prev) => (prev?.id === incident.id ? null : prev))}
                    onBlur={() => setHovered((prev) => (prev?.id === incident.id ? null : prev))}
                    onClick={triggerSelect}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        triggerSelect();
                      }
                    }}
                  >
                    <circle r={11 * markerScale} fill="transparent" />
                    <circle
                      className="admin-radar-pulse"
                      r={7.5 * markerScale}
                      fill="none"
                      stroke={colorVar}
                      strokeWidth={1.35 * strokeScale}
                      style={{
                        transformBox: 'fill-box',
                        transformOrigin: 'center',
                        animation: 'adminRadarPulse 2.3s cubic-bezier(0.16, 1, 0.3, 1) infinite',
                      }}
                    />
                    <polygon
                      points={`0,${(-triR).toFixed(2)} ${(triR * 0.96).toFixed(2)},${(triR * 0.78).toFixed(2)} ${(-triR * 0.96).toFixed(2)},${(triR * 0.78).toFixed(2)}`}
                      fill={colorVar}
                      stroke="var(--color-bg-card)"
                      strokeWidth={1.2 * strokeScale}
                      strokeLinejoin="round"
                    />
                    <circle cy={1.1 * markerScale} r={1.05 * markerScale} fill="var(--color-on-primary)" />
                  </g>
                );
              })}
            </g>
          )}

          {/* Layer 4: Live Family GPS Beacons & SOS Distress Signals */}
          {showBeacons && (
            <g aria-label="Đèn hiệu GPS trực tuyến">
              {plottedBeacons.map(({ beacon, lat, lng, x, y }) => {
                const isSos = beacon.status === 'sos';
                const isActive = beacon.status === 'active';
                const colorVar = isSos
                  ? 'var(--color-error)'
                  : isActive
                    ? 'var(--color-sun)'
                    : 'var(--color-text-dim)';

                const openHover = () => {
                  setHovered({
                    kind: 'beacon',
                    id: beacon.id,
                    x,
                    y,
                    lat,
                    lng,
                    badge: isSos ? 'SOS KHẨN CẤP' : isActive ? 'ĐÈN HIỆU LIVE' : 'ĐÃ KẾT THÚC',
                    tone: isSos ? 'error' : isActive ? 'sun' : 'muted',
                    title: beacon.displayName,
                    subtitle: beacon.trailName,
                    metrics: [
                      {
                        label: 'Pin',
                        value: typeof beacon.batteryPercent === 'number' ? `${beacon.batteryPercent}%` : '—',
                      },
                      {
                        label: 'Độ cao',
                        value: typeof beacon.altitudeM === 'number' ? `${formatNumberVi(beacon.altitudeM)} m` : '—',
                      },
                      {
                        label: 'Tín hiệu',
                        value:
                          typeof beacon.minutesSinceLastPing === 'number'
                            ? `${beacon.minutesSinceLastPing} phút`
                            : beacon.isSignalStale
                              ? 'Chậm'
                              : 'Trực tiếp',
                      },
                    ],
                  });
                };

                const triggerSelect = () => onSelect({ kind: 'beacon', data: beacon });

                return (
                  <g
                    key={beacon.id}
                    transform={`translate(${x.toFixed(2)}, ${y.toFixed(2)})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Đèn hiệu ${beacon.displayName} tại ${beacon.trailName}, trạng thái ${beacon.status}`}
                    style={{ cursor: 'pointer', outline: 'none' }}
                    onMouseEnter={openHover}
                    onFocus={openHover}
                    onMouseLeave={() => setHovered((prev) => (prev?.id === beacon.id ? null : prev))}
                    onBlur={() => setHovered((prev) => (prev?.id === beacon.id ? null : prev))}
                    onClick={triggerSelect}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        triggerSelect();
                      }
                    }}
                  >
                    <circle r={12 * markerScale} fill="transparent" />

                    {(isSos || isActive) && (
                      <circle
                        className="admin-radar-pulse"
                        r={(isSos ? 10.5 : 8) * markerScale}
                        fill="none"
                        stroke={colorVar}
                        strokeWidth={(isSos ? 1.8 : 1.2) * strokeScale}
                        style={{
                          transformBox: 'fill-box',
                          transformOrigin: 'center',
                          animation: isSos
                            ? 'adminRadarPulse 1.35s cubic-bezier(0.16, 1, 0.3, 1) infinite'
                            : 'adminRadarPulse 2.8s cubic-bezier(0.16, 1, 0.3, 1) infinite',
                        }}
                      />
                    )}

                    {isSos && (
                      <circle
                        r={7 * markerScale}
                        fill="color-mix(in srgb, var(--color-error) 22%, transparent)"
                        stroke="var(--color-error)"
                        strokeWidth={1.1 * strokeScale}
                      />
                    )}

                    <circle
                      r={(isSos ? 4.4 : isActive ? 3.8 : 2.8) * markerScale}
                      fill={colorVar}
                      stroke="var(--color-bg-card)"
                      strokeWidth={1.3 * strokeScale}
                    />
                    {(isSos || isActive) && (
                      <circle r={1.25 * markerScale} fill="var(--color-on-primary)" />
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* Layer 5: Precision Crosshair Target Reticle around selectedId */}
          {selectedAnchor && (
            <g
              transform={`translate(${selectedAnchor.x.toFixed(2)}, ${selectedAnchor.y.toFixed(2)})`}
              pointerEvents="none"
              aria-hidden="true"
            >
              <circle
                r={reticleSize * 1.12}
                fill="none"
                stroke={selectedAnchor.colorVar}
                strokeWidth={1.0 * strokeScale}
                strokeDasharray={`${2.4 * strokeScale} ${2.2 * strokeScale}`}
                opacity={0.78}
              />
              {/* 4 Corner Precision L-Brackets */}
              <path
                d={`
                  M${-reticleSize},${-reticleSize + reticleCorner} L${-reticleSize},${-reticleSize} L${-reticleSize + reticleCorner},${-reticleSize}
                  M${reticleSize - reticleCorner},${-reticleSize} L${reticleSize},${-reticleSize} L${reticleSize},${-reticleSize + reticleCorner}
                  M${reticleSize},${reticleSize - reticleCorner} L${reticleSize},${reticleSize} L${reticleSize - reticleCorner},${reticleSize}
                  M${-reticleSize + reticleCorner},${reticleSize} L${-reticleSize},${reticleSize} L${-reticleSize},${reticleSize - reticleCorner}
                `}
                fill="none"
                stroke={selectedAnchor.colorVar}
                strokeWidth={1.55 * strokeScale}
                strokeLinecap="square"
              />
              {/* Subtle Vernier Axis Ticks */}
              <path
                d={`
                  M${-reticleSize * 1.55},0 L${-reticleSize * 1.15},0
                  M${reticleSize * 1.15},0 L${reticleSize * 1.55},0
                  M0,${-reticleSize * 1.55} L0,${-reticleSize * 1.15}
                  M0,${reticleSize * 1.15} L0,${reticleSize * 1.55}
                `}
                stroke={selectedAnchor.colorVar}
                strokeWidth={1.1 * strokeScale}
              />
            </g>
          )}

          {/* Layer 6: Instrument Corner Registration Ticks, North Compass & Scale Bar */}
          <g pointerEvents="none" aria-hidden="true">
            {(() => {
              const pad = 7 * strokeScale;
              const arm = 12 * strokeScale;
              const left = vb.x + pad;
              const right = vb.x + vb.w - pad;
              const top = vb.y + pad;
              const bottom = vb.y + vb.h - pad;
              return (
                <path
                  d={`
                    M${left},${top + arm} L${left},${top} L${left + arm},${top}
                    M${right - arm},${top} L${right},${top} L${right},${top + arm}
                    M${right},${bottom - arm} L${right},${bottom} L${right - arm},${bottom}
                    M${left + arm},${bottom} L${left},${bottom} L${left},${bottom - arm}
                  `}
                  fill="none"
                  stroke="var(--color-border-strong)"
                  strokeWidth={1.25 * strokeScale}
                />
              );
            })()}

            {/* Minimal Swiss North Compass Rose (top-right inside current viewBox) */}
            <g
              transform={`translate(${(vb.x + vb.w - 30 * strokeScale).toFixed(1)}, ${(vb.y + 34 * strokeScale).toFixed(1)})`}
            >
              <circle
                r={12 * strokeScale}
                fill="color-mix(in srgb, var(--color-bg-card) 82%, transparent)"
                stroke="var(--color-border-strong)"
                strokeWidth={0.85 * strokeScale}
              />
              <polygon
                points={`0,${(-8.5 * strokeScale).toFixed(2)} ${(2.8 * strokeScale).toFixed(2)},${(2 * strokeScale).toFixed(2)} 0,${(0.4 * strokeScale).toFixed(2)} ${(-2.8 * strokeScale).toFixed(2)},${(2 * strokeScale).toFixed(2)}`}
                fill="var(--color-primary)"
              />
              <polygon
                points={`0,${(8.5 * strokeScale).toFixed(2)} ${(2.2 * strokeScale).toFixed(2)},${(2 * strokeScale).toFixed(2)} 0,${(0.4 * strokeScale).toFixed(2)} ${(-2.2 * strokeScale).toFixed(2)},${(2 * strokeScale).toFixed(2)}`}
                fill="var(--color-text-dim)"
                opacity={0.55}
              />
              <text
                y={-14.5 * strokeScale}
                textAnchor="middle"
                fill="var(--color-text-muted)"
                fontSize={7.2 * strokeScale}
                fontWeight={700}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                N
              </text>
            </g>

            {/* Accurate Linear Distance Scale Bar (bottom-left inside current viewBox) */}
            <g
              transform={`translate(${(vb.x + 20 * strokeScale).toFixed(1)}, ${(vb.y + vb.h - 20 * strokeScale).toFixed(1)})`}
            >
              <line
                x1={0}
                y1={0}
                x2={scaleBarSvgPx}
                y2={0}
                stroke="var(--color-text-muted)"
                strokeWidth={1.3 * strokeScale}
              />
              <line
                x1={0}
                y1={-3.5 * strokeScale}
                x2={0}
                y2={2.5 * strokeScale}
                stroke="var(--color-text-muted)"
                strokeWidth={1.1 * strokeScale}
              />
              <line
                x1={scaleBarSvgPx / 2}
                y1={-2.5 * strokeScale}
                x2={scaleBarSvgPx / 2}
                y2={1.5 * strokeScale}
                stroke="var(--color-text-dim)"
                strokeWidth={0.95 * strokeScale}
              />
              <line
                x1={scaleBarSvgPx}
                y1={-3.5 * strokeScale}
                x2={scaleBarSvgPx}
                y2={2.5 * strokeScale}
                stroke="var(--color-text-muted)"
                strokeWidth={1.1 * strokeScale}
              />
              <text
                x={0}
                y={-6 * strokeScale}
                fill="var(--color-text-dim)"
                fontSize={7.2 * strokeScale}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                0
              </text>
              <text
                x={scaleBarSvgPx}
                y={-6 * strokeScale}
                textAnchor="end"
                fill="var(--color-text-muted)"
                fontSize={7.2 * strokeScale}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                {activeConfig.scaleKm} km
              </text>
              <text
                x={0}
                y={9.5 * strokeScale}
                fill="var(--color-text-dim)"
                fontSize={6.8 * strokeScale}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                VN-2000 · {activeConfig.shortLabel}
              </text>
            </g>
          </g>
        </svg>

        {/* Floating Precision HUD Tooltip */}
        {hovered && hoverAnchorStyle && (
          <div style={hoverAnchorStyle} role="tooltip" aria-live="polite">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                marginBottom: '4px',
              }}
            >
              <span
                style={{
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  color: getToneCssVar(hovered.tone),
                  textTransform: 'uppercase',
                }}
              >
                {hovered.badge}
              </span>
              <span
                style={{
                  fontSize: '0.64rem',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  color: 'var(--color-text-dim)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {hovered.lat.toFixed(2)}°N
              </span>
            </div>
            <div
              style={{
                fontSize: '0.84rem',
                fontWeight: 700,
                lineHeight: 1.25,
                color: 'var(--color-text-main)',
                marginBottom: '2px',
              }}
            >
              {hovered.title}
            </div>
            <div
              style={{
                fontSize: '0.73rem',
                color: 'var(--color-text-muted)',
                marginBottom: '8px',
              }}
            >
              {hovered.subtitle}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${hovered.metrics.length}, minmax(0, 1fr))`,
                gap: '6px',
                paddingTop: '7px',
                borderTop: '1px solid var(--color-border)',
              }}
            >
              {hovered.metrics.map((m) => (
                <div key={m.label}>
                  <div
                    style={{
                      fontSize: '0.62rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--color-text-dim)',
                    }}
                  >
                    {m.label}
                  </div>
                  <div
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: 'var(--color-text-main)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tactile Cartographic Legend & Live GPS Coordinate Footer */}
      <div className="admin-radar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
            <svg width={9} height={9} viewBox="0 0 12 12" aria-hidden="true">
              <polygon points="6,1 11,6 6,11 1,6" fill="var(--color-primary)" />
            </svg>
            <span>≥2.500m</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
            <svg width={9} height={9} viewBox="0 0 12 12" aria-hidden="true">
              <circle cx="6" cy="6" r="4" fill="var(--color-sky)" />
            </svg>
            <span>1.500–2.499m</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
            <svg width={9} height={9} viewBox="0 0 12 12" aria-hidden="true">
              <circle cx="6" cy="6" r="3.6" fill="var(--color-bg-card)" stroke="var(--color-stream)" strokeWidth="2" />
            </svg>
            <span>&lt;1.500m</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
            <svg width={9} height={9} viewBox="0 0 12 12" aria-hidden="true">
              <polygon points="6,1.5 11,10 1,10" fill="var(--color-error)" />
            </svg>
            <span>Sự cố / SOS</span>
          </span>
        </div>

        <span className="admin-coord-readout" aria-label="Tọa độ GPS hiện tại">
          {readoutCoords
            ? `${pointerCoords ? 'CON TRỎ' : 'ĐANG KHÓA'} · ${formatGps(readoutCoords.lat, readoutCoords.lng)}`
            : 'VN-2000 · 8.3°N–23.6°N · 102.0°E–110.2°E'}
        </span>
      </div>
    </section>
  );
};
