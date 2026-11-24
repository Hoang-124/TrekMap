import { decimalToDms } from './solarMath.js';

export type ShareCardFormat = 'portrait' | 'landscape';
export type ShareCardTheme = 'dark' | 'light';

export interface ExpeditionSharePoint {
  lat: number;
  lng: number;
  altitudeM?: number | null;
}

export interface ExpeditionShareCardInput {
  peakName: string;
  province?: string;
  region?: string;
  altitudeM: number;
  distanceKm: number;
  elevationGainM: number;
  durationLabel?: string;
  dateLabel?: string;
  hikerName: string;
  caption?: string;
  verifiedGps?: boolean;
  coordinates?: { lat: number; lng: number } | null;
  trackPoints?: ExpeditionSharePoint[];
  format: ShareCardFormat;
  theme: ShareCardTheme;
}

export interface ExpeditionShareCardResult {
  blob: Blob;
  width: number;
  height: number;
  fileName: string;
}

export interface ProjectedCanvasPoint {
  x: number;
  y: number;
  normEle: number;
}

interface CanvasThemePalette {
  bgMain: string;
  bgCard: string;
  surfaceElevated: string;
  primary: string;
  onPrimary: string;
  sky: string;
  earth: string;
  sun: string;
  textMain: string;
  textMuted: string;
  textDim: string;
  border: string;
  borderStrong: string;
}

const FALLBACK_PALETTES: Record<ShareCardTheme, CanvasThemePalette> = {
  dark: {
    bgMain: 'hsl(140 11% 5%)',
    bgCard: 'hsl(144 11% 9%)',
    surfaceElevated: 'hsl(146 11% 12%)',
    primary: 'hsl(152 41% 52%)',
    onPrimary: 'hsl(148 48% 5%)',
    sky: 'hsl(201 44% 61%)',
    earth: 'hsl(21 66% 55%)',
    sun: 'hsl(39 62% 56%)',
    textMain: 'hsl(50 23% 95%)',
    textMuted: 'hsl(135 5% 67%)',
    textDim: 'hsl(138 5% 58%)',
    border: 'hsla(132 16% 93% / 0.12)',
    borderStrong: 'hsla(132 16% 93% / 0.24)',
  },
  light: {
    bgMain: 'hsl(43 22% 95%)',
    bgCard: 'hsl(45 50% 99%)',
    surfaceElevated: 'hsl(42 25% 90%)',
    primary: 'hsl(152 56% 28%)',
    onPrimary: 'hsl(45 50% 99%)',
    sky: 'hsl(202 53% 36%)',
    earth: 'hsl(18 73% 38%)',
    sun: 'hsl(39 82% 29%)',
    textMain: 'hsl(144 10% 10%)',
    textMuted: 'hsl(144 6% 31%)',
    textDim: 'hsl(144 5% 38%)',
    border: 'hsla(144 10% 10% / 0.12)',
    borderStrong: 'hsla(144 10% 10% / 0.24)',
  },
};

function resolveCanvasThemePalette(theme: ShareCardTheme): CanvasThemePalette {
  const fallback = FALLBACK_PALETTES[theme];
  if (typeof document === 'undefined' || !document.documentElement) {
    return fallback;
  }

  // Probe the exact live CSS design tokens from index.css for the requested dark/light theme
  const probe = document.createElement('div');
  probe.setAttribute('data-theme', theme);
  probe.style.position = 'fixed';
  probe.style.left = '-9999px';
  probe.style.top = '-9999px';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  const mountParent = document.body || document.documentElement;
  mountParent.appendChild(probe);

  try {
    const cs = window.getComputedStyle(probe);
    const read = (token: string, fb: string) => cs.getPropertyValue(token).trim() || fb;
    return {
      bgMain: read('--color-bg-main', fallback.bgMain),
      bgCard: read('--color-bg-card', fallback.bgCard),
      surfaceElevated: read('--color-surface-elevated', fallback.surfaceElevated),
      primary: read('--color-primary', fallback.primary),
      onPrimary: read('--color-on-primary', fallback.onPrimary),
      sky: read('--color-sky', fallback.sky),
      earth: read('--color-earth', fallback.earth),
      sun: read('--color-sun', fallback.sun),
      textMain: read('--color-text-main', fallback.textMain),
      textMuted: read('--color-text-muted', fallback.textMuted),
      textDim: read('--color-text-dim', fallback.textDim),
      border: read('--color-border', fallback.border),
      borderStrong: read('--color-border-strong', fallback.borderStrong),
    };
  } finally {
    probe.remove();
  }
}

function formatSortableDateStamp(dateLabel?: string): string {
  const raw = (dateLabel || '').trim();
  const isoMatch = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}${m.padStart(2, '0')}${d.padStart(2, '0')}`;
  }
  const vnMatch = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (vnMatch) {
    const [, d, m, y] = vnMatch;
    return `${y}${m.padStart(2, '0')}${d.padStart(2, '0')}`;
  }
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function buildShareCardFileName(
  peakName: string,
  format: ShareCardFormat,
  dateLabel?: string
): string {
  const slug = (peakName || 'lost-expedition')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'expedition';

  const dims = format === 'portrait' ? '1080x1350' : '1200x630';
  const datePart = formatSortableDateStamp(dateLabel);
  return `lost-${slug}-${dims}-${datePart}.png`;
}

/**
 * Projects lat/lng (+ optional altitudeM) GPX points into a canvas bounding box
 * while preserving true geodesic aspect ratio via cos(midLat) correction.
 */
export function projectTrackToCanvasBox(
  points: ExpeditionSharePoint[],
  box: { x: number; y: number; w: number; h: number; pad: number }
): ProjectedCanvasPoint[] {
  const valid = (points || []).filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );
  if (valid.length === 0) return [];

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minEle = Infinity;
  let maxEle = -Infinity;
  let validEleCount = 0;

  for (const p of valid) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (typeof p.altitudeM === 'number' && Number.isFinite(p.altitudeM)) {
      if (p.altitudeM < minEle) minEle = p.altitudeM;
      if (p.altitudeM > maxEle) maxEle = p.altitudeM;
      validEleCount += 1;
    }
  }

  const midLatRad = (((minLat + maxLat) / 2) * Math.PI) / 180;
  const lngScale = Math.max(0.25, Math.cos(midLatRad));
  const rawW = (maxLng - minLng) * lngScale;
  const rawH = maxLat - minLat;

  const innerW = Math.max(10, box.w - box.pad * 2);
  const innerH = Math.max(10, box.h - box.pad * 2);

  if (valid.length === 1 || (rawW < 1e-7 && rawH < 1e-7)) {
    return valid.map((_, idx) => ({
      x: box.x + box.w / 2,
      y: box.y + box.h / 2,
      normEle: valid.length > 1 ? idx / (valid.length - 1) : 0.5,
    }));
  }

  const safeW = Math.max(rawW, 1e-6);
  const safeH = Math.max(rawH, 1e-6);
  const scale = Math.min(innerW / safeW, innerH / safeH);
  const drawnW = rawW * scale;
  const drawnH = rawH * scale;
  const offsetX = box.x + box.pad + (innerW - drawnW) / 2;
  const offsetY = box.y + box.pad + (innerH - drawnH) / 2;

  const hasEleRange = validEleCount >= 2 && maxEle - minEle >= 5;

  return valid.map((p, idx) => {
    const x = offsetX + (p.lng - minLng) * lngScale * scale;
    const y = offsetY + (maxLat - p.lat) * scale;
    const normEle =
      hasEleRange && typeof p.altitudeM === 'number' && Number.isFinite(p.altitudeM)
        ? Math.max(0, Math.min(1, (p.altitudeM - minEle) / (maxEle - minEle)))
        : valid.length > 1
        ? idx / (valid.length - 1)
        : 0.5;
    return { x, y, normEle };
  });
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function ellipsizeCanvasLine(
  ctx: Pick<CanvasRenderingContext2D, 'measureText'>,
  text: string,
  maxWidth: number
): string {
  const trimmed = text.trim();
  if (!trimmed || ctx.measureText(trimmed).width <= maxWidth) return trimmed;
  const hasWrappingQuotes = trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"');
  const suffix = hasWrappingQuotes ? '..."' : '...';
  let body = hasWrappingQuotes ? trimmed.slice(0, -1) : trimmed;
  while (body.length > 1 && ctx.measureText(`${body.trimEnd()}${suffix}`).width > maxWidth) {
    body = body.slice(0, -1);
  }
  return `${body.trimEnd()}${suffix}`;
}

export function wrapCanvasText(
  ctx: Pick<CanvasRenderingContext2D, 'measureText'>,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const safeMaxLines = Math.max(1, Math.floor(maxLines));
  const normalized = (text || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return [];

  if (safeMaxLines === 1) {
    return [ellipsizeCanvasLine(ctx, normalized, maxWidth)];
  }

  const words = normalized.split(' ');
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(ellipsizeCanvasLine(ctx, current, maxWidth));
      current = words[i];
      if (lines.length >= safeMaxLines - 1) {
        const rest = [current, ...words.slice(i + 1)].join(' ');
        lines.push(ellipsizeCanvasLine(ctx, rest, maxWidth));
        return lines;
      }
    }
  }
  lines.push(ellipsizeCanvasLine(ctx, current, maxWidth));
  return lines;
}

function drawTopographicBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: CanvasThemePalette,
  seed: number
) {
  ctx.save();

  // Subtle cartographic coordinate grid
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.55;
  const gridStep = 90;
  for (let x = gridStep; x < w; x += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = gridStep; y < h; y += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Procedural multi-peak topographic contour rings (deterministic from peak seed)
  const centers = [
    { cx: w * 0.78, cy: h * 0.24, baseR: Math.min(w, h) * 0.12, rings: 11, phase: seed * 0.13 },
    { cx: w * 0.16, cy: h * 0.78, baseR: Math.min(w, h) * 0.1, rings: 9, phase: seed * 0.29 + 1.4 },
  ];

  for (const peak of centers) {
    for (let rIdx = 0; rIdx < peak.rings; rIdx++) {
      const radius = peak.baseR + rIdx * 34;
      ctx.beginPath();
      const steps = 96;
      for (let s = 0; s <= steps; s++) {
        const theta = (s / steps) * Math.PI * 2;
        const wobble =
          1 +
          0.11 * Math.sin(theta * 3 + peak.phase + rIdx * 0.22) +
          0.07 * Math.cos(theta * 5 - peak.phase * 0.7) +
          0.04 * Math.sin(theta * 7 + rIdx * 0.4);
        const px = peak.cx + Math.cos(theta) * radius * wobble * 1.18;
        const py = peak.cy + Math.sin(theta) * radius * wobble * 0.86;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = rIdx % 4 === 0 ? palette.primary : palette.textDim;
      ctx.lineWidth = rIdx % 4 === 0 ? 1.5 : 1;
      ctx.globalAlpha = rIdx % 4 === 0 ? 0.16 : 0.09;
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawMountainEmblem(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.86);
  ctx.lineTo(x + size * 0.34, y + size * 0.18);
  ctx.lineTo(x + size * 0.56, y + size * 0.54);
  ctx.lineTo(x + size * 0.72, y + size * 0.32);
  ctx.lineTo(x + size, y + size * 0.86);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawCompassNorthRose(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  palette: CanvasThemePalette
) {
  ctx.save();
  ctx.strokeStyle = palette.borderStrong;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // North pointer triangle
  ctx.fillStyle = palette.earth;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r + 5);
  ctx.lineTo(cx - 5, cy);
  ctx.lineTo(cx + 5, cy);
  ctx.closePath();
  ctx.fill();

  // South pointer triangle
  ctx.fillStyle = palette.textDim;
  ctx.beginPath();
  ctx.moveTo(cx, cy + r - 5);
  ctx.lineTo(cx - 4.5, cy);
  ctx.lineTo(cx + 4.5, cy);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.textMain;
  ctx.font = '800 11px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('B', cx, cy - r - 4);
  ctx.restore();
}

function pickElevationColor(normEle: number, palette: CanvasThemePalette): string {
  if (normEle >= 0.78) return palette.earth;
  if (normEle >= 0.52) return palette.sun;
  if (normEle >= 0.24) return palette.primary;
  return palette.sky;
}

function drawRouteViewport(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  trackPoints: ExpeditionSharePoint[],
  altitudeM: number,
  palette: CanvasThemePalette
) {
  ctx.save();

  // Framed cartographic container
  drawRoundedRectPath(ctx, box.x, box.y, box.w, box.h, 8);
  ctx.fillStyle = palette.bgCard;
  ctx.fill();
  ctx.strokeStyle = palette.borderStrong;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Clip interior
  ctx.save();
  drawRoundedRectPath(ctx, box.x, box.y, box.w, box.h, 8);
  ctx.clip();

  // Subtle internal coordinate crosshair grid
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.7;
  const cols = 6;
  const rows = 4;
  for (let c = 1; c < cols; c++) {
    const gx = box.x + (box.w / cols) * c;
    ctx.beginPath();
    ctx.moveTo(gx, box.y);
    ctx.lineTo(gx, box.y + box.h);
    ctx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    const gy = box.y + (box.h / rows) * r;
    ctx.beginPath();
    ctx.moveTo(box.x, gy);
    ctx.lineTo(box.x + box.w, gy);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Check if we have >= 2 valid points with meaningful non-zero spatial span to draw a GPX polyline
  const projected = projectTrackToCanvasBox(trackPoints, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h - 46,
    pad: 46,
  });
  const hasDrawableTrack =
    projected.length >= 2 &&
    projected.some(
      (pt) => Math.hypot(pt.x - projected[0].x, pt.y - projected[0].y) >= 4
    );

  if (hasDrawableTrack) {
    // Wide translucent elevation halo underlay
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = palette.primary;
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    projected.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
    ctx.restore();

    // Elevation-colored GPX route segments
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5.5;
    for (let i = 1; i < projected.length; i++) {
      const prev = projected[i - 1];
      const curr = projected[i];
      const midEle = (prev.normEle + curr.normEle) / 2;
      ctx.strokeStyle = pickElevationColor(midEle, palette);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.stroke();
    }

    // Start Marker
    const startPt = projected[0];
    ctx.beginPath();
    ctx.arc(startPt.x, startPt.y, 11, 0, Math.PI * 2);
    ctx.fillStyle = palette.bgCard;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = palette.primary;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(startPt.x, startPt.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = palette.primary;
    ctx.fill();

    // End / Summit Marker
    const endPt = projected[projected.length - 1];
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.beginPath();
    ctx.arc(endPt.x, endPt.y, 18, 0, Math.PI * 2);
    ctx.fillStyle = palette.earth;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(endPt.x, endPt.y, 9.5, 0, Math.PI * 2);
    ctx.fillStyle = palette.earth;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = palette.bgCard;
    ctx.stroke();
  } else {
    // Fallback procedural alpine ridge silhouette when no GPX track was recorded
    const ridgeYBase = box.y + box.h - 58;
    const ridgePeakY = box.y + 68;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(box.x + 36, ridgeYBase);
    ctx.lineTo(box.x + box.w * 0.28, ridgeYBase - (ridgeYBase - ridgePeakY) * 0.55);
    ctx.lineTo(box.x + box.w * 0.44, ridgeYBase - (ridgeYBase - ridgePeakY) * 0.38);
    ctx.lineTo(box.x + box.w * 0.64, ridgePeakY);
    ctx.lineTo(box.x + box.w * 0.82, ridgeYBase - (ridgeYBase - ridgePeakY) * 0.46);
    ctx.lineTo(box.x + box.w - 36, ridgeYBase);
    ctx.strokeStyle = palette.primary;
    ctx.lineWidth = 4.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(box.x + box.w * 0.64, ridgePeakY, 8, 0, Math.PI * 2);
    ctx.fillStyle = palette.earth;
    ctx.fill();
    ctx.restore();
  }

  // Bottom elevation legend bar inside map viewport
  const legendY = box.y + box.h - 32;
  ctx.fillStyle = palette.surfaceElevated;
  ctx.fillRect(box.x, box.y + box.h - 42, box.w, 42);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(box.x, box.y + box.h - 42);
  ctx.lineTo(box.x + box.w, box.y + box.h - 42);
  ctx.stroke();

  const isCompactLegend = box.w < 540;
  ctx.font = `700 ${isCompactLegend ? 11.5 : 13}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.textBaseline = 'middle';

  // Draw elevation color key dots on the right first so we know exact remaining width for the left label
  const swatches = [
    { color: palette.sky, label: 'Thấp' },
    { color: palette.primary, label: 'Rừng' },
    { color: palette.sun, label: 'Sườn' },
    { color: palette.earth, label: 'Đỉnh' },
  ];
  let cursorX = box.x + box.w - (isCompactLegend ? 12 : 18);
  const swatchGap = isCompactLegend ? 20 : 28;
  const dotOffset = isCompactLegend ? 8 : 10;
  const dotRadius = isCompactLegend ? 3.8 : 4.5;
  ctx.textAlign = 'right';
  for (let i = swatches.length - 1; i >= 0; i--) {
    const sw = swatches[i];
    ctx.fillStyle = palette.textDim;
    ctx.fillText(sw.label, cursorX, legendY + 11);
    const txtW = ctx.measureText(sw.label).width;
    ctx.beginPath();
    ctx.arc(cursorX - txtW - dotOffset, legendY + 11, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = sw.color;
    ctx.fill();
    cursorX -= txtW + swatchGap;
  }

  // Left legend text constrained strictly to non-overlapping available width
  const labelLeftX = box.x + (isCompactLegend ? 12 : 18);
  const safeAlt = Math.max(0, Math.round(Number(altitudeM) || 0));
  const rawPtsLabel = hasDrawableTrack
    ? isCompactLegend
      ? `GPX · ${projected.length} ĐIỂM`
      : `GPX TRACK · ${projected.length} ĐIỂM TỌA ĐỘ`
    : isCompactLegend
    ? `ĐỊA HÌNH · ${safeAlt.toLocaleString('vi-VN')}M`
    : `MÔ PHỎNG ĐỈNH · ${safeAlt.toLocaleString('vi-VN')}M`;
  const availLabelW = Math.max(70, cursorX - labelLeftX - 8);
  const ptsCountLabel = ellipsizeCanvasLine(ctx, rawPtsLabel, availLabelW);
  ctx.textAlign = 'left';
  ctx.fillStyle = palette.textMuted;
  ctx.fillText(ptsCountLabel, labelLeftX, legendY + 11, availLabelW);

  // Compass rose in top-right corner of map box
  drawCompassNorthRose(ctx, box.x + box.w - 38, box.y + 44, 18, palette);

  ctx.restore();
  ctx.restore();
}

function drawMetricCell(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  label: string,
  value: string,
  accentColor: string,
  palette: CanvasThemePalette,
  valueFontSize: number
) {
  ctx.save();
  drawRoundedRectPath(ctx, box.x, box.y, box.w, box.h, 6);
  ctx.fillStyle = palette.bgCard;
  ctx.fill();
  ctx.strokeStyle = palette.borderStrong;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Subtle top accent hairline
  ctx.fillStyle = accentColor;
  ctx.fillRect(box.x + 1, box.y + 1, box.w - 2, 3);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = palette.textDim;
  ctx.font = '700 13px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(label, box.x + 16, box.y + 16);

  ctx.fillStyle = accentColor;
  ctx.font = `800 ${valueFontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillText(value, box.x + 16, box.y + 38, box.w - 32);
  ctx.restore();
}

function computeSeedFromText(text: string): number {
  let acc = 17;
  for (let i = 0; i < text.length; i++) {
    acc = (acc * 31 + text.charCodeAt(i)) % 997;
  }
  return acc;
}

/**
 * Generates an offline, high-resolution, CORS-free Field-Atlas PNG Expedition Share Card
 * on an offscreen HTML5 Canvas (1080×1350 Portrait or 1200×630 Landscape).
 */
export async function renderExpeditionShareCardPng(
  input: ExpeditionShareCardInput
): Promise<ExpeditionShareCardResult> {
  if (typeof document === 'undefined') {
    throw new Error('Canvas PNG export requires a browser environment.');
  }

  // Explicitly preload Plus Jakarta Sans weights 700 & 800 (bounded to 350ms so offline never stalls)
  if (document.fonts) {
    const fontTasks: Array<Promise<unknown>> = [];
    if (typeof document.fonts.load === 'function') {
      fontTasks.push(
        document.fonts.load('700 18px "Plus Jakarta Sans"').catch(() => undefined),
        document.fonts.load('800 44px "Plus Jakarta Sans"').catch(() => undefined)
      );
    }
    if (document.fonts.ready) {
      fontTasks.push(document.fonts.ready.catch(() => undefined));
    }
    if (fontTasks.length > 0) {
      await Promise.race([
        Promise.all(fontTasks),
        new Promise((resolve) => window.setTimeout(resolve, 350)),
      ]);
    }
  }

  const width = input.format === 'portrait' ? 1080 : 1200;
  const height = input.format === 'portrait' ? 1350 : 630;
  const palette = resolveCanvasThemePalette(input.theme);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Trình duyệt không hỗ trợ Canvas 2D để xuất ảnh PNG.');
  }

  const cleanPeak = (input.peakName || 'Hành Trình LOST').trim();
  const cleanHiker = (input.hikerName || 'Nhà Thám Hiểm LOST').trim();
  const cleanCaption = (input.caption || '').trim().slice(0, 96);
  const dateStr =
    input.dateLabel?.trim() ||
    new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const altStr = `${Math.max(0, Math.round(Number(input.altitudeM) || 0)).toLocaleString('vi-VN')} m`;
  const distStr = `${Math.max(0, Number(input.distanceKm) || 0).toFixed(1)} km`;
  const gainStr = `+${Math.max(0, Math.round(Number(input.elevationGainM) || 0)).toLocaleString('vi-VN')} m`;
  const durStr = (input.durationLabel || '').trim() || '--';
  const locLine = [input.province, input.region].filter(Boolean).join(' · ') || 'Việt Nam';

  const isFiniteCoord = (
    c?: { lat: number; lng: number } | null
  ): c is { lat: number; lng: number } =>
    Boolean(
      c &&
        typeof c.lat === 'number' &&
        typeof c.lng === 'number' &&
        Number.isFinite(c.lat) &&
        Number.isFinite(c.lng) &&
        Math.abs(c.lat) <= 90 &&
        Math.abs(c.lng) <= 180
    );
  const lastValidTrackCoord = [...(input.trackPoints || [])]
    .reverse()
    .find((pt) => isFiniteCoord(pt));
  const coordObj = isFiniteCoord(input.coordinates)
    ? input.coordinates
    : lastValidTrackCoord
    ? { lat: lastValidTrackCoord.lat, lng: lastValidTrackCoord.lng }
    : null;
  const coordsText = coordObj
    ? `${coordObj.lat.toFixed(4)}, ${coordObj.lng.toFixed(4)}  ·  ${decimalToDms(coordObj.lat, true).formatted} ${decimalToDms(coordObj.lng, false).formatted}`
    : 'WGS84 · VIETNAM ALPINE TOPO';

  // 1. Base Background + Procedural Topo Contours
  ctx.fillStyle = palette.bgMain;
  ctx.fillRect(0, 0, width, height);
  drawTopographicBackdrop(ctx, width, height, palette, computeSeedFromText(cleanPeak));

  // 2. Editorial Atlas Border Frame + Top Primary Ribbon
  const inset = input.format === 'portrait' ? 32 : 24;
  const frameW = width - inset * 2;
  const frameH = height - inset * 2;
  drawRoundedRectPath(ctx, inset, inset, frameW, frameH, 8);
  ctx.strokeStyle = palette.borderStrong;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = palette.primary;
  ctx.fillRect(inset + 2, inset + 2, frameW - 4, 6);

  const padX = inset + (input.format === 'portrait' ? 40 : 32);
  const contentW = width - padX * 2;

  if (input.format === 'portrait') {
    // =========================================================================
    // PORTRAIT 1080 × 1350 (4:5 STORY / FEED CARD)
    // =========================================================================
    const topY = inset + 34;

    // Top Header Eyebrow + Status Pill
    drawMountainEmblem(ctx, padX, topY, 26, palette.primary);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = palette.primary;
    ctx.font = '800 17px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('LOST  ·  VIETNAM ALPINE ATLAS', padX + 38, topY + 14);

    // Verified / Field Log pill
    const badgeLabel = input.verifiedGps ? 'GPS XÁC THỰC' : 'NHẬT KÝ THỰC ĐỊA';
    ctx.font = '800 14px "Plus Jakarta Sans", system-ui, sans-serif';
    const badgeW = ctx.measureText(badgeLabel).width + 28;
    const badgeX = width - padX - badgeW;
    drawRoundedRectPath(ctx, badgeX, topY - 1, badgeW, 30, 5);
    ctx.fillStyle = input.verifiedGps ? palette.primary : palette.surfaceElevated;
    ctx.fill();
    if (!input.verifiedGps) {
      ctx.strokeStyle = palette.borderStrong;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.fillStyle = input.verifiedGps ? palette.onPrimary : palette.sky;
    ctx.textAlign = 'center';
    ctx.fillText(badgeLabel, badgeX + badgeW / 2, topY + 14);

    // Route Map Viewport
    const mapY = topY + 54;
    const mapH = 510;
    drawRouteViewport(
      ctx,
      { x: padX, y: mapY, w: contentW, h: mapH },
      input.trackPoints || [],
      input.altitudeM,
      palette
    );

    // Peak Location Eyebrow & Title
    const titleStartY = mapY + mapH + 34;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = palette.sky;
    ctx.font = '700 17px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`${locLine.toUpperCase()}  ·  ${dateStr}`, padX, titleStartY);

    const titleFontSize = cleanPeak.length > 26 ? 44 : 52;
    ctx.fillStyle = palette.textMain;
    ctx.font = `800 ${titleFontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
    const titleLines = wrapCanvasText(ctx, cleanPeak, contentW, 2);
    let cursorY = titleStartY + 32;
    for (const line of titleLines) {
      ctx.fillText(line, padX, cursorY);
      cursorY += titleFontSize + 10;
    }

    // Coordinates strip
    ctx.fillStyle = palette.textDim;
    ctx.font = '600 16px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(coordsText, padX, cursorY + 4, contentW);
    cursorY += 36;

    // Optional User Caption
    if (cleanCaption) {
      ctx.save();
      ctx.fillStyle = palette.surfaceElevated;
      drawRoundedRectPath(ctx, padX, cursorY + 4, contentW, 54, 6);
      ctx.fill();
      ctx.fillStyle = palette.primary;
      ctx.fillRect(padX, cursorY + 4, 4, 54);
      ctx.fillStyle = palette.textMuted;
      ctx.font = '600 18px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      const capLines = wrapCanvasText(ctx, `"${cleanCaption}"`, contentW - 36, 1);
      ctx.fillText(capLines[0] || '', padX + 18, cursorY + 31);
      ctx.restore();
      cursorY += 72;
    }

    // 2×2 Telemetry Grid (pinned cleanly above footer)
    const gridGap = 16;
    const cellW = (contentW - gridGap) / 2;
    const cellH = 104;
    const gridY = Math.max(cursorY + 14, height - inset - 332);

    drawMetricCell(ctx, { x: padX, y: gridY, w: cellW, h: cellH }, 'CAO ĐỘ ĐỈNH', altStr, palette.sun, palette, 38);
    drawMetricCell(ctx, { x: padX + cellW + gridGap, y: gridY, w: cellW, h: cellH }, 'TỔNG CỰ LY', distStr, palette.primary, palette, 38);
    drawMetricCell(ctx, { x: padX, y: gridY + cellH + gridGap, w: cellW, h: cellH }, 'LEO TÍCH LŨY', gainStr, palette.earth, palette, 38);
    drawMetricCell(ctx, { x: padX + cellW + gridGap, y: gridY + cellH + gridGap, w: cellW, h: cellH }, 'THỜI GIAN', durStr, palette.sky, palette, 38);

    // Footer Expedition Stamp
    const footerY = height - inset - 74;
    ctx.strokeStyle = palette.borderStrong;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(padX, footerY);
    ctx.lineTo(width - padX, footerY);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = palette.textDim;
    ctx.font = '700 13px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('NHÀ THÁM HIỂM', padX, footerY + 14);
    ctx.fillStyle = palette.textMain;
    ctx.font = '800 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(cleanHiker, padX, footerY + 34, contentW * 0.56);

    ctx.textAlign = 'right';
    ctx.fillStyle = palette.primary;
    ctx.font = '800 16px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('LOST • VIETNAM ALPINE ATLAS', width - padX, footerY + 20);
    ctx.fillStyle = palette.textDim;
    ctx.font = '600 13px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('Bản đồ thực địa & An toàn leo núi Việt Nam', width - padX, footerY + 43);
  } else {
    // =========================================================================
    // LANDSCAPE 1200 × 630 (WIDE SOCIAL / FACEBOOK CARD)
    // =========================================================================
    const topY = inset + 26;
    const leftColW = 590;
    const colGap = 28;
    const rightColX = padX + leftColW + colGap;
    const rightColW = width - padX - rightColX;

    // Header strip across left column
    drawMountainEmblem(ctx, padX, topY, 22, palette.primary);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = palette.primary;
    ctx.font = '800 14px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('LOST  ·  VIETNAM ALPINE ATLAS', padX + 32, topY + 11);

    const badgeLabel = input.verifiedGps ? 'GPS XÁC THỰC' : 'NHẬT KÝ THỰC ĐỊA';
    ctx.font = '800 12px "Plus Jakarta Sans", system-ui, sans-serif';
    const badgeW = ctx.measureText(badgeLabel).width + 22;
    const badgeX = padX + leftColW - badgeW;
    drawRoundedRectPath(ctx, badgeX, topY - 1, badgeW, 25, 4);
    ctx.fillStyle = input.verifiedGps ? palette.primary : palette.surfaceElevated;
    ctx.fill();
    ctx.fillStyle = input.verifiedGps ? palette.onPrimary : palette.sky;
    ctx.textAlign = 'center';
    ctx.fillText(badgeLabel, badgeX + badgeW / 2, topY + 11.5);

    // Left: Peak Title, Metadata, Caption & 2×2 Telemetry
    let cursorY = topY + 44;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = palette.sky;
    ctx.font = '700 14px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`${locLine.toUpperCase()}  ·  ${dateStr}`, padX, cursorY);
    cursorY += 24;

    const titleFontSize = cleanPeak.length > 24 ? 34 : 40;
    ctx.fillStyle = palette.textMain;
    ctx.font = `800 ${titleFontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
    const titleLines = wrapCanvasText(ctx, cleanPeak, leftColW, 2);
    for (const line of titleLines) {
      ctx.fillText(line, padX, cursorY);
      cursorY += titleFontSize + 6;
    }

    ctx.fillStyle = palette.textDim;
    ctx.font = '600 13px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(coordsText, padX, cursorY + 2, leftColW);
    cursorY += 26;

    if (cleanCaption) {
      ctx.save();
      ctx.fillStyle = palette.surfaceElevated;
      drawRoundedRectPath(ctx, padX, cursorY + 2, leftColW, 40, 5);
      ctx.fill();
      ctx.fillStyle = palette.primary;
      ctx.fillRect(padX, cursorY + 2, 3.5, 40);
      ctx.fillStyle = palette.textMuted;
      ctx.font = '600 14px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      const capLines = wrapCanvasText(ctx, `"${cleanCaption}"`, leftColW - 28, 1);
      ctx.fillText(capLines[0] || '', padX + 14, cursorY + 22);
      ctx.restore();
      cursorY += 50;
    }

    // 2×2 Telemetry Grid in Left Column
    const gridGap = 12;
    const cellW = (leftColW - gridGap) / 2;
    const cellH = 82;
    const gridY = Math.max(cursorY + 8, height - inset - 246);

    drawMetricCell(ctx, { x: padX, y: gridY, w: cellW, h: cellH }, 'CAO ĐỘ ĐỈNH', altStr, palette.sun, palette, 28);
    drawMetricCell(ctx, { x: padX + cellW + gridGap, y: gridY, w: cellW, h: cellH }, 'TỔNG CỰ LY', distStr, palette.primary, palette, 28);
    drawMetricCell(ctx, { x: padX, y: gridY + cellH + gridGap, w: cellW, h: cellH }, 'LEO TÍCH LŨY', gainStr, palette.earth, palette, 28);
    drawMetricCell(ctx, { x: padX + cellW + gridGap, y: gridY + cellH + gridGap, w: cellW, h: cellH }, 'THỜI GIAN', durStr, palette.sky, palette, 28);

    // Footer Left Stamp
    const footerY = height - inset - 54;
    ctx.strokeStyle = palette.borderStrong;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, footerY);
    ctx.lineTo(padX + leftColW, footerY);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = palette.textMain;
    ctx.font = '800 17px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(cleanHiker, padX, footerY + 26, leftColW * 0.52);

    ctx.textAlign = 'right';
    ctx.fillStyle = palette.primary;
    ctx.font = '800 13px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('LOST • VIETNAM ALPINE ATLAS', padX + leftColW, footerY + 26);

    // Right Column: Full-height GPX Cartographic Viewport
    drawRouteViewport(
      ctx,
      { x: rightColX, y: topY, w: rightColW, h: frameH - 52 },
      input.trackPoints || [],
      input.altitudeM,
      palette
    );
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Không thể đóng gói tệp ảnh PNG từ Canvas.'));
      },
      'image/png'
    );
  });

  return {
    blob,
    width,
    height,
    fileName: buildShareCardFileName(cleanPeak, input.format, dateStr),
  };
}
