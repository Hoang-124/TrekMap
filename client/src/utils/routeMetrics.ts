/**
 * Self-Contained GPX 1.1 XML Parser / Exporter & Terrain Route Metrics Engine
 * Computes Haversine distance, 3-point smoothed elevation gain/loss, slope buckets (<10%, 10-20%, >20%),
 * Naismith + Langmuir ETA, Tobler terrain-adjusted ETA, difficulty (1-5), and water/kcal estimates.
 */

import { calculateHaversineKm } from './solarMath.js';

export type RouteWaypointType =
  | 'start'
  | 'camp'
  | 'water'
  | 'peak'
  | 'viewpoint'
  | 'danger'
  | 'end';

export type RouteFitnessLevel = 'beginner' | 'intermediate' | 'advanced';

export interface RouteVertex {
  lat: number;
  lng: number;
  elevationM?: number | null;
}

export interface PlannerWaypoint {
  id: string;
  name: string;
  type: RouteWaypointType;
  lat: number;
  lng: number;
  elevationM?: number;
  note?: string;
}

export interface ParsedGpxRoute {
  title: string;
  description: string;
  vertices: RouteVertex[];
  waypoints: PlannerWaypoint[];
  hasElevation: boolean;
}

export interface ElevationProfilePoint {
  distanceKm: number;
  elevationM: number;
  slopePercent: number;
  lat: number;
  lng: number;
}

export interface SlopeBuckets {
  gentleKm: number;
  moderateKm: number;
  steepKm: number;
  gentlePercent: number;
  moderatePercent: number;
  steepPercent: number;
}

export interface RouteMetricsSummary {
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  maxAltitudeM: number;
  minAltitudeM: number;
  avgSlopePercent: number;
  maxSlopePercent: number;
  slopeBuckets: SlopeBuckets;
  naismithLangmuirHours: number;
  toblerHours: number;
  recommendedHours: number;
  estimatedDifficulty: 1 | 2 | 3 | 4 | 5;
  difficultyLabel: string;
  waterLiters: number;
  oresolPackets: number;
  caloriesKcal: number;
  profile: ElevationProfilePoint[];
  hasRealElevation: boolean;
}

const MAX_PARSED_TRACK_POINTS = 1800;

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getElementsLocal(root: Document | Element, tagName: string): Element[] {
  const direct = Array.from(root.getElementsByTagName(tagName));
  if (direct.length > 0) return direct;
  try {
    return Array.from(root.getElementsByTagNameNS('*', tagName));
  } catch {
    return [];
  }
}

function getChildText(parent: Element, tagName: string): string {
  const node = getElementsLocal(parent, tagName)[0];
  return node?.textContent?.trim() || '';
}

function normalizeFoldedText(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

function matchExplicitWaypointType(rawTag: string): RouteWaypointType | null {
  const t = normalizeFoldedText(rawTag);
  if (!t) return null;

  // 1. Exact canonical type / standard Garmin GPX 1.1 <sym> matches first (never overridden by name heuristics)
  if (t === 'start' || t === 'trailhead' || t === 'trail head' || t === 'flag, green') return 'start';
  if (t === 'end' || t === 'finish' || t === 'flag, red') return 'end';
  if (t === 'peak' || t === 'summit') return 'peak';
  if (t === 'water' || t === 'water source') return 'water';
  if (t === 'camp' || t === 'campsite' || t === 'campground') return 'camp';
  if (t === 'danger' || t === 'caution' || t === 'danger area') return 'danger';
  if (t === 'viewpoint' || t === 'scenic area') return 'viewpoint';

  // 2. Explicit tag keyword fallback (checked before waypoint name)
  if (t.includes('start') || t.includes('trailhead') || t.includes('trail head')) return 'start';
  if (t.includes('end') || t.includes('finish')) return 'end';
  if (t.includes('peak') || t.includes('summit')) return 'peak';
  if (t.includes('danger') || t.includes('caution') || t.includes('hazard')) return 'danger';
  if (t.includes('camp')) return 'camp';
  if (t.includes('water')) return 'water';
  if (t.includes('view') || t.includes('scenic')) return 'viewpoint';
  return null;
}

function inferWaypointType(rawType: string, name: string, rawSym = ''): RouteWaypointType {
  // Prioritize explicit <type> and <sym> metadata before falling back to name text heuristics
  const explicitFromType = matchExplicitWaypointType(rawType);
  if (explicitFromType) return explicitFromType;
  const explicitFromSym = matchExplicitWaypointType(rawSym);
  if (explicitFromSym) return explicitFromSym;

  const foldedName = normalizeFoldedText(name);
  if (foldedName.includes('start') || foldedName.includes('xuat phat') || foldedName.includes('cua rung')) {
    return 'start';
  }
  if (foldedName.includes('end') || foldedName.includes('ket thuc') || foldedName.includes('dich')) {
    return 'end';
  }
  if (foldedName.includes('danger') || foldedName.includes('nguy hiem') || foldedName.includes('vach') || foldedName.includes('sat lo')) {
    return 'danger';
  }
  if (foldedName.includes('peak') || foldedName.includes('dinh') || foldedName.includes('chop') || foldedName.includes('summit')) {
    return 'peak';
  }
  if (foldedName.includes('camp') || foldedName.includes('lan') || foldedName.includes('trai')) {
    return 'camp';
  }
  if (foldedName.includes('water') || foldedName.includes('suoi') || foldedName.includes('nuoc') || foldedName.includes('thac')) {
    return 'water';
  }
  return 'viewpoint';
}

function downsamplePreserveEndpoints<T>(items: T[], maxCount: number): T[] {
  if (items.length <= maxCount) return items;
  const result: T[] = [];
  for (let i = 0; i < maxCount; i++) {
    const idx = Math.round((i * (items.length - 1)) / (maxCount - 1));
    result.push(items[idx]);
  }
  return result;
}

/**
 * Self-contained GPX 1.1 XML parser using browser DOMParser.
 * Resilient to malformed XML and namespace prefixes; extracts trkpt, rtept, and wpt.
 */
export function parseGpxXml(xmlText: string): ParsedGpxRoute {
  const trimmed = String(xmlText || '').trim();
  if (!trimmed || !trimmed.includes('<gpx')) {
    throw new Error('Nội dung không phải tệp GPX 1.1 hợp lệ (thiếu thẻ <gpx>).');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(trimmed, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Cấu trúc XML của file GPX bị lỗi, không thể giải mã.');
  }

  const metadataEl = getElementsLocal(doc, 'metadata')[0];
  const trkEl = getElementsLocal(doc, 'trk')[0];
  const title =
    (trkEl ? getChildText(trkEl, 'name') : '') ||
    (metadataEl ? getChildText(metadataEl, 'name') : '') ||
    'Cung Đường GPX Nhập Tay';
  const description =
    (trkEl ? getChildText(trkEl, 'desc') : '') ||
    (metadataEl ? getChildText(metadataEl, 'desc') : '') ||
    '';

  // Extract track points (trkpt -> rtept -> wpt fallback)
  let rawTrackNodes = getElementsLocal(doc, 'trkpt');
  if (rawTrackNodes.length < 2) {
    rawTrackNodes = getElementsLocal(doc, 'rtept');
  }

  const rawVertices: RouteVertex[] = [];
  for (const el of rawTrackNodes) {
    const lat = Number(el.getAttribute('lat'));
    const lng = Number(el.getAttribute('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      continue;
    }
    const eleText = getChildText(el, 'ele');
    const eleNum = eleText !== '' ? Number(eleText) : null;
    const elevationM =
      eleNum !== null && Number.isFinite(eleNum) && eleNum > -500 && eleNum < 9000
        ? Math.round(eleNum * 10) / 10
        : null;
    rawVertices.push({ lat: Math.round(lat * 1_000_000) / 1_000_000, lng: Math.round(lng * 1_000_000) / 1_000_000, elevationM });
  }

  // Extract named waypoints (<wpt>)
  const wptNodes = getElementsLocal(doc, 'wpt');
  const waypoints: PlannerWaypoint[] = [];
  wptNodes.forEach((el, idx) => {
    const lat = Number(el.getAttribute('lat'));
    const lng = Number(el.getAttribute('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return;
    }
    const name = getChildText(el, 'name') || `Mốc #${idx + 1}`;
    const desc = getChildText(el, 'desc') || getChildText(el, 'cmt') || '';
    const rawType = getChildText(el, 'type');
    const rawSym = getChildText(el, 'sym');
    const eleText = getChildText(el, 'ele');
    const eleNum = eleText !== '' ? Number(eleText) : undefined;
    waypoints.push({
      id: `gpx-wpt-${idx + 1}-${Math.round(lat * 10000)}`,
      name,
      type: inferWaypointType(rawType, name, rawSym),
      lat: Math.round(lat * 1_000_000) / 1_000_000,
      lng: Math.round(lng * 1_000_000) / 1_000_000,
      elevationM: eleNum !== undefined && Number.isFinite(eleNum) ? Math.round(eleNum) : undefined,
      note: desc || undefined,
    });
  });

  // Fallback: if no trkpt/rtept existed, build vertices from waypoints
  const finalRawVertices =
    rawVertices.length >= 2
      ? rawVertices
      : waypoints.map((w) => ({
          lat: w.lat,
          lng: w.lng,
          elevationM: w.elevationM ?? null,
        }));

  if (finalRawVertices.length < 2) {
    throw new Error('File GPX cần tối thiểu 2 điểm tọa độ (<trkpt>, <rtept> hoặc <wpt>).');
  }

  const vertices = downsamplePreserveEndpoints(finalRawVertices, MAX_PARSED_TRACK_POINTS);
  const validEleCount = vertices.filter((v) => typeof v.elevationM === 'number').length;
  const hasElevation = validEleCount >= Math.max(2, Math.floor(vertices.length * 0.5));

  return {
    title,
    description,
    vertices,
    waypoints: waypoints.slice(0, 100),
    hasElevation,
  };
}

/**
 * Generates standard GPX 1.1 XML containing both <wpt> waypoints and <trkpt><ele> track points.
 */
export function exportGpxXml(params: {
  title: string;
  description?: string;
  vertices: RouteVertex[];
  waypoints?: PlannerWaypoint[];
}): string {
  const safeTitle = escapeXml(params.title || 'LOST Custom Route');
  const safeDesc = params.description ? `\n    <desc>${escapeXml(params.description)}</desc>` : '';
  const isoNow = new Date().toISOString();

  const wptXml = (params.waypoints || [])
    .map((wp) => {
      const eleLine =
        typeof wp.elevationM === 'number' && Number.isFinite(wp.elevationM)
          ? `\n    <ele>${Math.round(wp.elevationM)}</ele>`
          : '';
      const descLine = wp.note ? `\n    <desc>${escapeXml(wp.note)}</desc>` : '';
      return `  <wpt lat="${wp.lat.toFixed(6)}" lon="${wp.lng.toFixed(6)}">${eleLine}
    <name>${escapeXml(wp.name)}</name>${descLine}
    <type>${escapeXml(wp.type)}</type>
  </wpt>`;
    })
    .join('\n');

  const trkptsXml = params.vertices
    .map((pt) => {
      const eleTag =
        typeof pt.elevationM === 'number' && Number.isFinite(pt.elevationM)
          ? `<ele>${Math.round(pt.elevationM * 10) / 10}</ele>`
          : '';
      return `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lng.toFixed(6)}">${eleTag}</trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LOST Vietnam Trekking Atlas" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${safeTitle}</name>${safeDesc}
    <time>${isoNow}</time>
  </metadata>${wptXml ? `\n${wptXml}` : ''}
  <trk>
    <name>${safeTitle}</name>
    <trkseg>
${trkptsXml}
    </trkseg>
  </trk>
</gpx>`;
}

/**
 * 3-point weighted elevation smoothing [0.25, 0.5, 0.25] preserving endpoints.
 */
export function smoothElevationSeries(raw: number[]): number[] {
  if (raw.length < 3) return [...raw];
  return raw.map((val, idx) => {
    if (idx === 0 || idx === raw.length - 1) return Math.round(val * 10) / 10;
    const avg = raw[idx - 1] * 0.25 + val * 0.5 + raw[idx + 1] * 0.25;
    return Math.round(avg * 10) / 10;
  });
}

/**
 * Densifies sparse user-clicked route segments before calling DEM elevation lookup
 * so ridges and valleys between clicks are sampled accurately (bounded to maxSamples).
 */
export function interpolateVerticesForDem(
  vertices: RouteVertex[],
  maxSamples = 64
): Array<[number, number]> {
  if (vertices.length === 0) return [];
  if (vertices.length === 1) return [[vertices[0].lat, vertices[0].lng]];

  const segLens: number[] = [];
  let totalKm = 0;
  for (let i = 1; i < vertices.length; i++) {
    const d = calculateHaversineKm(vertices[i - 1].lat, vertices[i - 1].lng, vertices[i].lat, vertices[i].lng);
    segLens.push(d);
    totalKm += d;
  }

  if (vertices.length >= maxSamples || totalKm < 0.05) {
    return downsamplePreserveEndpoints(
      vertices.map((v) => [v.lat, v.lng] as [number, number]),
      maxSamples
    );
  }

  const out: Array<[number, number]> = [[vertices[0].lat, vertices[0].lng]];
  const budget = Math.max(vertices.length, maxSamples) - 1;

  for (let i = 1; i < vertices.length; i++) {
    const segKm = segLens[i - 1];
    const steps = Math.max(1, Math.round((segKm / totalKm) * budget));
    const a = vertices[i - 1];
    const b = vertices[i];
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push([
        Math.round((a.lat + (b.lat - a.lat) * t) * 1_000_000) / 1_000_000,
        Math.round((a.lng + (b.lng - a.lng) * t) * 1_000_000) / 1_000_000,
      ]);
    }
  }

  return downsamplePreserveEndpoints(out, maxSamples);
}

/**
 * Tobler's hiking function speed (km/h) adjusted for Vietnam mountain terrain and fitness level.
 */
function computeToblerSpeedKmH(slopeRiseOverRun: number, fitness: RouteFitnessLevel): number {
  const clamped = Math.max(-0.65, Math.min(0.65, slopeRiseOverRun));
  const rawKmH = 6 * Math.exp(-3.5 * Math.abs(clamped + 0.05));
  const fitnessMult = fitness === 'beginner' ? 0.8 : fitness === 'advanced' ? 1.16 : 1.0;
  return Math.max(0.75, rawKmH * 0.78 * fitnessMult);
}

/**
 * Computes full terrain, slope-bucket, Naismith+Langmuir ETA, Tobler ETA, difficulty, and bio metrics.
 */
export function computeRouteMetrics(
  vertices: RouteVertex[],
  options?: {
    packWeightKg?: number;
    bodyWeightKg?: number;
    fitnessLevel?: RouteFitnessLevel;
    ambientTempC?: number;
  }
): RouteMetricsSummary {
  const packWeightKg = Math.max(0, Math.min(35, options?.packWeightKg ?? 8));
  const bodyWeightKg = Math.max(35, Math.min(150, options?.bodyWeightKg ?? 62));
  const fitnessLevel: RouteFitnessLevel = options?.fitnessLevel ?? 'intermediate';

  if (!Array.isArray(vertices) || vertices.length === 0) {
    return {
      distanceKm: 0,
      elevationGainM: 0,
      elevationLossM: 0,
      maxAltitudeM: 0,
      minAltitudeM: 0,
      avgSlopePercent: 0,
      maxSlopePercent: 0,
      slopeBuckets: {
        gentleKm: 0,
        moderateKm: 0,
        steepKm: 0,
        gentlePercent: 0,
        moderatePercent: 0,
        steepPercent: 0,
      },
      naismithLangmuirHours: 0,
      toblerHours: 0,
      recommendedHours: 0,
      estimatedDifficulty: 1,
      difficultyLabel: 'Chưa có tuyến',
      waterLiters: 0,
      oresolPackets: 0,
      caloriesKcal: 0,
      profile: [],
      hasRealElevation: false,
    };
  }

  // Fill missing elevations cleanly via linear interpolation between known anchors
  const knownIndices = vertices
    .map((v, idx) => (typeof v.elevationM === 'number' && Number.isFinite(v.elevationM) ? idx : -1))
    .filter((idx) => idx >= 0);
  const hasRealElevation = knownIndices.length >= Math.min(2, vertices.length);

  const filledElevations: number[] = new Array(vertices.length).fill(0);
  if (knownIndices.length > 0) {
    for (let i = 0; i < vertices.length; i++) {
      const direct = vertices[i].elevationM;
      if (typeof direct === 'number' && Number.isFinite(direct)) {
        filledElevations[i] = direct;
      } else {
        let prevIdx = -1;
        let nextIdx = -1;
        for (const k of knownIndices) {
          if (k < i) prevIdx = k;
          if (k > i && nextIdx === -1) nextIdx = k;
        }
        if (prevIdx !== -1 && nextIdx !== -1) {
          const t = (i - prevIdx) / (nextIdx - prevIdx);
          const e1 = vertices[prevIdx].elevationM as number;
          const e2 = vertices[nextIdx].elevationM as number;
          filledElevations[i] = e1 + (e2 - e1) * t;
        } else if (prevIdx !== -1) {
          filledElevations[i] = vertices[prevIdx].elevationM as number;
        } else if (nextIdx !== -1) {
          filledElevations[i] = vertices[nextIdx].elevationM as number;
        }
      }
    }
  }

  const smoothed = smoothElevationSeries(filledElevations);

  // Cumulative Haversine distance
  const cumKm: number[] = [0];
  for (let i = 1; i < vertices.length; i++) {
    const segKm = calculateHaversineKm(
      vertices[i - 1].lat,
      vertices[i - 1].lng,
      vertices[i].lat,
      vertices[i].lng
    );
    cumKm.push(cumKm[i - 1] + segKm);
  }
  const distanceKm = Math.round(cumKm[cumKm.length - 1] * 100) / 100;

  let elevationGainM = 0;
  let elevationLossM = 0;
  let minAlt = Infinity;
  let maxAlt = -Infinity;
  let maxSlopePercent = 0;
  let gentleKm = 0;
  let moderateKm = 0;
  let steepKm = 0;
  let weightedAbsSlopeSum = 0;
  let validDistKm = 0;

  // Langmuir descent correction & Tobler segment integration
  let langmuirAdjustHours = 0;
  let toblerRawHours = 0;
  let anchorEle = smoothed[0] ?? 0;

  const profile: ElevationProfilePoint[] = [];

  for (let i = 0; i < vertices.length; i++) {
    const ele = Math.round(smoothed[i]);
    if (ele < minAlt) minAlt = ele;
    if (ele > maxAlt) maxAlt = ele;

    let slopePercent = 0;
    if (i > 0) {
      const segKm = cumKm[i] - cumKm[i - 1];
      const deltaEle = smoothed[i] - smoothed[i - 1];

      // 2m hysteresis suppresses micro DEM oscillation
      if (smoothed[i] - anchorEle >= 2) {
        elevationGainM += smoothed[i] - anchorEle;
        anchorEle = smoothed[i];
      } else if (anchorEle - smoothed[i] >= 2) {
        elevationLossM += anchorEle - smoothed[i];
        anchorEle = smoothed[i];
      }

      const segMeters = Math.max(15, segKm * 1000);
      const rawSlope = deltaEle / segMeters;
      slopePercent = Math.max(-65, Math.min(65, Math.round(rawSlope * 1000) / 10));
      const absSlope = Math.abs(slopePercent);

      if (absSlope > maxSlopePercent) maxSlopePercent = absSlope;

      if (segKm > 0) {
        if (absSlope < 10) gentleKm += segKm;
        else if (absSlope <= 20) moderateKm += segKm;
        else steepKm += segKm;

        weightedAbsSlopeSum += absSlope * segKm;
        validDistKm += segKm;

        // Langmuir descent adjustment:
        // Moderate descent (-21.3% .. -8.7%, i.e., -12 deg to -5 deg): -10 min per 300m (-drop/1800 hr)
        // Steep descent (< -21.3%, i.e., < -12 deg): +10 min per 300m (+drop/1800 hr)
        if (deltaEle < 0) {
          const dropM = Math.abs(deltaEle);
          if (rawSlope < -0.2126) {
            langmuirAdjustHours += dropM / 1800;
          } else if (rawSlope < -0.0875) {
            langmuirAdjustHours -= dropM / 1800;
          }
        }

        toblerRawHours += segKm / computeToblerSpeedKmH(rawSlope, fitnessLevel);
      }
    }

    profile.push({
      distanceKm: Math.round(cumKm[i] * 100) / 100,
      elevationM: ele,
      slopePercent,
      lat: vertices[i].lat,
      lng: vertices[i].lng,
    });
  }

  const gainRounded = Math.round(elevationGainM);
  const lossRounded = Math.round(elevationLossM);
  const minRounded = Number.isFinite(minAlt) ? Math.round(minAlt) : 0;
  const maxRounded = Number.isFinite(maxAlt) ? Math.round(maxAlt) : 0;
  const avgSlopePercent = validDistKm > 0 ? Math.round((weightedAbsSlopeSum / validDistKm) * 10) / 10 : 0;

  const packRatioPercent = (packWeightKg / bodyWeightKg) * 100;
  const packFatigue = packRatioPercent > 15 ? 1 + 0.015 * (packRatioPercent - 15) : 1;

  // Naismith + Langmuir base speed calibrated by fitness
  const baseSpeedKmH = fitnessLevel === 'beginner' ? 3.5 : fitnessLevel === 'advanced' ? 5.2 : 4.5;
  const naismithRaw = Math.max(
    distanceKm / 7.5,
    distanceKm / baseSpeedKmH + gainRounded / 600 + langmuirAdjustHours
  );
  const naismithLangmuirHours = Math.round(naismithRaw * packFatigue * 10) / 10;
  const toblerHours = Math.round(toblerRawHours * packFatigue * 10) / 10;
  const recommendedHours = Math.round((naismithLangmuirHours * 0.5 + toblerHours * 0.5) * 10) / 10;

  // Slope buckets percentage sum to 100% when validDistKm > 0
  let gentlePercent = 0;
  let moderatePercent = 0;
  let steepPercent = 0;
  if (validDistKm > 0) {
    gentlePercent = Math.round((gentleKm / validDistKm) * 100);
    moderatePercent = Math.round((moderateKm / validDistKm) * 100);
    steepPercent = Math.max(0, 100 - gentlePercent - moderatePercent);
  }

  // Effort index -> difficulty (1-5)
  const effortIndex =
    distanceKm * 1.15 +
    (gainRounded / 100) * 2.4 +
    (maxRounded >= 2500 ? 6 : maxRounded >= 1800 ? 3 : 0) +
    (steepPercent >= 25 ? 4 : 0);

  const estimatedDifficulty: 1 | 2 | 3 | 4 | 5 =
    effortIndex >= 48 ? 5 : effortIndex >= 34 ? 4 : effortIndex >= 22 ? 3 : effortIndex >= 11 ? 2 : 1;

  const difficultyLabel =
    estimatedDifficulty === 5
      ? 'Cấp 5 — Cực khó (Alpine / Dài ngày)'
      : estimatedDifficulty === 4
      ? 'Cấp 4 — Khó (Yêu cầu thể lực tốt)'
      : estimatedDifficulty === 3
      ? 'Cấp 3 — Trung bình khá'
      : estimatedDifficulty === 2
      ? 'Cấp 2 — Trung bình dễ'
      : 'Cấp 1 — Cơ bản (Phù hợp người mới)';

  // Water & calories aligned with LOST Bio-Calculator
  const ambientTempC =
    options?.ambientTempC !== undefined
      ? options.ambientTempC
      : maxRounded >= 2400
      ? 16
      : maxRounded >= 1400
      ? 22
      : 27;
  const heatRate = ambientTempC > 20 ? ((ambientTempC - 20) / 5) * 0.12 : 0;
  const altMult = maxRounded >= 2500 ? 1.15 : 1;
  const waterLiters =
    recommendedHours > 0
      ? Math.round(Math.max(0.8, recommendedHours * (0.48 + heatRate) * altMult) * 10) / 10
      : 0;
  const oresolPackets = waterLiters > 0 ? Math.max(1, Math.ceil(waterLiters / 1.8)) : 0;

  const climbRate = recommendedHours > 0 ? gainRounded / recommendedHours : 0;
  const met = 5.8 + (climbRate / 300) * 1.1 + (packWeightKg / bodyWeightKg) * 3.5;
  const caloriesKcal = Math.round(met * bodyWeightKg * recommendedHours);

  return {
    distanceKm,
    elevationGainM: gainRounded,
    elevationLossM: lossRounded,
    maxAltitudeM: maxRounded,
    minAltitudeM: minRounded,
    avgSlopePercent,
    maxSlopePercent: Math.round(maxSlopePercent * 10) / 10,
    slopeBuckets: {
      gentleKm: Math.round(gentleKm * 100) / 100,
      moderateKm: Math.round(moderateKm * 100) / 100,
      steepKm: Math.round(steepKm * 100) / 100,
      gentlePercent,
      moderatePercent,
      steepPercent,
    },
    naismithLangmuirHours,
    toblerHours,
    recommendedHours,
    estimatedDifficulty,
    difficultyLabel,
    waterLiters,
    oresolPackets,
    caloriesKcal,
    profile,
    hasRealElevation,
  };
}

/**
 * Formats decimal hours into crisp Vietnamese duration string (e.g. "5g 30p").
 */
export function formatDurationHoursVi(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0g 00p';
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}g ${String(m).padStart(2, '0')}p`;
}

export interface WaypointLegSplit {
  legIndex: number;
  fromName: string;
  toName: string;
  fromType: RouteWaypointType;
  toType: RouteWaypointType;
  fromVertexIdx: number;
  toVertexIdx: number;
  distanceKm: number;
  cumulativeDistanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  avgSlopePercent: number;
  maxAltitudeM: number;
  naismithHours: number;
  toblerHours: number;
  recommendedHours: number;
  cumulativeHours: number;
}

/**
 * Projects named waypoints onto the nearest route vertex and computes exact segment-by-segment
 * distance (km), gain (+m), loss (-m), avg slope (%), Naismith/Tobler ETA, and cumulative ETA
 * between every consecutive waypoint (always anchored at route start and end).
 */
export function computeWaypointLegSplits(
  vertices: RouteVertex[],
  waypoints: PlannerWaypoint[],
  options?: {
    packWeightKg?: number;
    bodyWeightKg?: number;
    fitnessLevel?: RouteFitnessLevel;
    ambientTempC?: number;
  }
): WaypointLegSplit[] {
  if (!Array.isArray(vertices) || vertices.length < 2) return [];

  interface ProjectedAnchor {
    name: string;
    type: RouteWaypointType;
    vertexIdx: number;
    order: number;
  }

  const lastIdx = vertices.length - 1;
  const projected: ProjectedAnchor[] = (waypoints || []).map((wp, order) => {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < vertices.length; i++) {
      const d = calculateHaversineKm(wp.lat, wp.lng, vertices[i].lat, vertices[i].lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return {
      name: wp.name || `Mốc #${order + 1}`,
      type: wp.type,
      vertexIdx: bestIdx,
      order,
    };
  });

  projected.sort((a, b) => (a.vertexIdx !== b.vertexIdx ? a.vertexIdx - b.vertexIdx : a.order - b.order));

  // Deduplicate anchors landing on identical vertex indices while preferring start/end names
  const anchors: ProjectedAnchor[] = [];
  for (const item of projected) {
    const prev = anchors[anchors.length - 1];
    if (prev && prev.vertexIdx === item.vertexIdx) {
      if (item.vertexIdx === lastIdx) {
        anchors[anchors.length - 1] = item;
      }
      continue;
    }
    anchors.push(item);
  }

  if (anchors.length === 0 || anchors[0].vertexIdx > 0) {
    anchors.unshift({
      name: 'Điểm xuất phát (#1)',
      type: 'start',
      vertexIdx: 0,
      order: -1,
    });
  }

  if (anchors[anchors.length - 1].vertexIdx < lastIdx) {
    anchors.push({
      name: `Điểm kết thúc (#${vertices.length})`,
      type: 'end',
      vertexIdx: lastIdx,
      order: projected.length + 1,
    });
  }

  const legs: WaypointLegSplit[] = [];
  let cumulativeDistanceKm = 0;
  let cumulativeHours = 0;

  for (let i = 0; i < anchors.length - 1; i++) {
    const fromAnchor = anchors[i];
    const toAnchor = anchors[i + 1];
    if (toAnchor.vertexIdx <= fromAnchor.vertexIdx) continue;

    const subVertices = vertices.slice(fromAnchor.vertexIdx, toAnchor.vertexIdx + 1);
    if (subVertices.length < 2) continue;

    const seg = computeRouteMetrics(subVertices, options);
    cumulativeDistanceKm = Math.round((cumulativeDistanceKm + seg.distanceKm) * 100) / 100;
    cumulativeHours = Math.round((cumulativeHours + seg.recommendedHours) * 10) / 10;

    legs.push({
      legIndex: legs.length + 1,
      fromName: fromAnchor.name,
      toName: toAnchor.name,
      fromType: fromAnchor.type,
      toType: toAnchor.type,
      fromVertexIdx: fromAnchor.vertexIdx,
      toVertexIdx: toAnchor.vertexIdx,
      distanceKm: seg.distanceKm,
      cumulativeDistanceKm,
      elevationGainM: seg.elevationGainM,
      elevationLossM: seg.elevationLossM,
      avgSlopePercent: seg.avgSlopePercent,
      maxAltitudeM: seg.maxAltitudeM,
      naismithHours: seg.naismithLangmuirHours,
      toblerHours: seg.toblerHours,
      recommendedHours: seg.recommendedHours,
      cumulativeHours,
    });
  }

  return legs;
}

/**
 * Formats waypoint leg splits into a clean Vietnamese plain-text briefing for 1-click clipboard copy.
 */
export function formatLegSplitsPlainText(routeTitle: string, legs: WaypointLegSplit[]): string {
  if (!Array.isArray(legs) || legs.length === 0) return '';
  const header = `BẢNG PHÂN CHẶNG THEO MỐC — ${routeTitle || 'Cung Đường LOST'}`;
  const lines = legs.map(
    (leg) =>
      `Chặng ${leg.legIndex}: ${leg.fromName} -> ${leg.toName} | ${leg.distanceKm.toFixed(2)} km (Lũy kế ${leg.cumulativeDistanceKm.toFixed(2)} km) | +${leg.elevationGainM}m / -${leg.elevationLossM}m | Dốc TB ${leg.avgSlopePercent}% | ETA ${formatDurationHoursVi(leg.recommendedHours)} (N+L ${leg.naismithHours}h / Tobler ${leg.toblerHours}h) | Tổng giờ: ${formatDurationHoursVi(leg.cumulativeHours)}`
  );
  const last = legs[legs.length - 1];
  const totalGain = legs.reduce((s, l) => s + l.elevationGainM, 0);
  const totalLoss = legs.reduce((s, l) => s + l.elevationLossM, 0);
  const footer = `TỔNG TOÀN TUYẾN: ${last.cumulativeDistanceKm.toFixed(2)} km | +${totalGain}m / -${totalLoss}m | Thời gian dự kiến: ${formatDurationHoursVi(last.cumulativeHours)}`;
  return [header, ...lines, footer].join('\n');
}
