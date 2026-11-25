/**
 * Pure geometry, GPS track recording, Off-Trail Alarm, SOS SMS formatting, and Expense Splitting utilities.
 * Zero side effects — 100% unit-testable.
 */

export interface RecordedTrackPoint {
  lat: number;
  lng: number;
  altitudeM?: number | null;
  accuracyM?: number | null;
  timestamp: number;
}

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return EARTH_RADIUS_M * c;
}

/**
 * Shortest distance in meters from point P(lat, lng) to line segment AB using local flat-Earth projection
 * (sub-meter accuracy at trekking scales < 50km).
 */
export function pointToSegmentMeters(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const cosLat = Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  const mPerDegLat = 111_132;
  const mPerDegLng = 111_320 * cosLat;

  const px = (pLng - aLng) * mPerDegLng;
  const py = (pLat - aLat) * mPerDegLat;
  const bx = (bLng - aLng) * mPerDegLng;
  const by = (bLat - aLat) * mPerDegLat;

  const lenSq = bx * bx + by * by;
  if (lenSq < 1e-6) return Math.hypot(px, py);

  const t = Math.max(0, Math.min(1, (px * bx + py * by) / lenSq));
  const projX = t * bx;
  const projY = t * by;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Computes minimum distance in meters from current GPS coordinates to a trail's GPX polyline.
 * Used for real-time Off-Trail Alarm (> 100m warning).
 */
export function distanceToTrackMeters(lat: number, lng: number, track: [number, number][]): number {
  if (!Array.isArray(track) || track.length === 0) return Infinity;
  if (track.length === 1) return Math.round(haversineMeters(lat, lng, track[0][0], track[0][1]));

  let minMeters = Infinity;
  for (let i = 0; i < track.length - 1; i++) {
    const d = pointToSegmentMeters(lat, lng, track[i][0], track[i][1], track[i + 1][0], track[i + 1][1]);
    if (d < minMeters) minMeters = d;
  }
  return Math.round(minMeters);
}

/**
 * Calculates total cumulative distance (km) along recorded GPS points.
 */
export function calculateRecordedDistanceKm(points: RecordedTrackPoint[]): number {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let totalMeters = 0;
  for (let i = 1; i < points.length; i++) {
    const seg = haversineMeters(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    // Filter out extreme GPS jump glitches (> 500m in a single reading)
    if (seg <= 500) totalMeters += seg;
  }
  return Math.round((totalMeters / 1000) * 100) / 100;
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates standard GPX 1.1 XML from recorded GPS track points (includes <ele> and <time>).
 */
export function buildRecordedGpxXml(trailName: string, points: RecordedTrackPoint[]): string {
  const safeName = escapeXml(trailName || 'LOST Recorded Track');
  const trkpts = points
    .map((pt) => {
      const eleTag =
        typeof pt.altitudeM === 'number' && Number.isFinite(pt.altitudeM)
          ? `<ele>${Math.round(pt.altitudeM)}</ele>`
          : '';
      const timeTag = `<time>${new Date(pt.timestamp).toISOString()}</time>`;
      return `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lng.toFixed(6)}">${eleTag}${timeTag}</trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LOST Live GPS Recorder" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${safeName}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${safeName}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

function stripVietnameseToGsm7(input: string): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function isIosSmsSeparator(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
}

/**
 * Generates an Offline 2G-compatible SOS SMS URI (`sms:<phone>?body=...` on Android, `&body=` on iOS)
 * using 7-bit GSM-7 ASCII so rescue beacons avoid UCS-2 multi-part fragmentation on weak 2G mountain signal.
 */
export function buildOfflineSosSmsUri(params: {
  phone?: string;
  trailName?: string;
  lat?: number | null;
  lng?: number | null;
  altitudeM?: number | null;
  note?: string;
}): { uri: string; body: string } {
  const targetPhone = (params.phone || '').replace(/[^\d+]/g, '');
  const hasCoords =
    typeof params.lat === 'number' &&
    typeof params.lng === 'number' &&
    Number.isFinite(params.lat) &&
    Number.isFinite(params.lng);

  const safeTrail = params.trailName ? stripVietnameseToGsm7(params.trailName) : '';
  const safeNote = params.note ? stripVietnameseToGsm7(params.note) : '';

  const lines = [
    '[SOS KHAN CAP - LOST]',
    safeTrail ? `Tuyen: ${safeTrail}` : 'Can ho tro cuu nan khan cap!',
    hasCoords
      ? `Toa do GPS: ${params.lat!.toFixed(6)}, ${params.lng!.toFixed(6)}`
      : 'Toa do GPS: Chua khoa duoc GPS',
    hasCoords ? `Maps: https://maps.google.com/?q=${params.lat!.toFixed(6)},${params.lng!.toFixed(6)}` : '',
    typeof params.altitudeM === 'number' && Number.isFinite(params.altitudeM)
      ? `Do cao: ${Math.round(params.altitudeM)}m`
      : '',
    safeNote ? `Tinh trang: ${safeNote}` : 'Can ho tro khan cap, vui long lien he ngay!',
  ].filter(Boolean);

  const body = lines.join('\n');
  const separator = isIosSmsSeparator() ? '&' : '?';
  return {
    uri: `sms:${targetPhone}${separator}body=${encodeURIComponent(body)}`,
    body,
  };
}

/**
 * Computes Slippy Map tile coordinates (x, y) at zoom z for a lat/lng point.
 */
export function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const latRad = (clampedLat * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

/**
 * Generates bounded AWS Open Data Terrarium DEM tile URLs covering a trail's GPX route across zoom
 * levels (default z10..z12) for 1-click Offline Trail Pack terrain caching (100% legal AWS Open Data).
 * Coarse overview zooms (<=12) cover the padded bounding box; higher zooms (>=13) prioritize the
 * exact GPX polyline corridor first (then adjacent neighbors) within the tile budget.
 */
export function buildOfflineTileUrls(
  track: [number, number][],
  zooms: number[] = [10, 11, 12],
  maxTiles = 90
): string[] {
  if (!Array.isArray(track) || track.length === 0) return [];
  const validTrack = track.filter(
    (pt) => Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1])
  );
  if (validTrack.length === 0) return [];

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of validTrack) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  const urls: string[] = [];
  const seen = new Set<string>();
  const pushTile = (z: number, x: number, y: number): boolean => {
    const maxCoord = Math.pow(2, z) - 1;
    if (x < 0 || y < 0 || x > maxCoord || y > maxCoord) return false;
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
    if (seen.has(url)) return false;
    seen.add(url);
    urls.push(url);
    return urls.length >= maxTiles;
  };

  // Add slight padding (~0.01 deg ≈ 1km) around the trail bounding box for overview zooms (<= 12)
  const pad = 0.01;
  const padMinLat = minLat - pad;
  const padMaxLat = maxLat + pad;
  const padMinLng = minLng - pad;
  const padMaxLng = maxLng + pad;

  for (const z of zooms) {
    if (z <= 12) {
      const topLeft = latLngToTile(padMaxLat, padMinLng, z);
      const bottomRight = latLngToTile(padMinLat, padMaxLng, z);
      for (let x = topLeft.x; x <= bottomRight.x; x++) {
        for (let y = topLeft.y; y <= bottomRight.y; y++) {
          if (pushTile(z, x, y)) return urls;
        }
      }
    } else {
      // High-detail corridor sampling along GPX polyline segments first
      const corridorTiles: Array<{ x: number; y: number }> = [];
      const corridorSeen = new Set<string>();
      const addCorridorPoint = (lat: number, lng: number): boolean => {
        const t = latLngToTile(lat, lng, z);
        const key = `${t.x},${t.y}`;
        if (!corridorSeen.has(key)) {
          corridorSeen.add(key);
          corridorTiles.push(t);
          if (pushTile(z, t.x, t.y)) return true;
        }
        return false;
      };

      for (let i = 0; i < validTrack.length; i++) {
        const [lat1, lng1] = validTrack[i];
        if (addCorridorPoint(lat1, lng1)) return urls;
        if (i + 1 < validTrack.length) {
          const [lat2, lng2] = validTrack[i + 1];
          const degSpan = Math.hypot(lat2 - lat1, lng2 - lng1);
          const steps = Math.max(1, Math.min(40, Math.ceil(degSpan / 0.004)));
          for (let s = 1; s < steps; s++) {
            const ratio = s / steps;
            if (addCorridorPoint(lat1 + (lat2 - lat1) * ratio, lng1 + (lng2 - lng1) * ratio)) {
              return urls;
            }
          }
        }
      }

      // Expand 1-tile corridor buffer (cardinals first, then diagonals) with remaining budget
      const offsets: Array<[number, number]> = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ];
      for (const [dx, dy] of offsets) {
        for (const base of corridorTiles) {
          if (pushTile(z, base.x + dx, base.y + dy)) return urls;
        }
      }
    }
  }
  return urls;
}

export interface ExpenseEntry {
  id: string;
  title: string;
  amountVnd: number;
  paidByName: string;
  splitCount: number;
}

export interface ExpenseSettlementSummary {
  totalVnd: number;
  perPersonAverageVnd: number;
  payerTotals: Array<{ name: string; paidVnd: number; balanceVnd: number }>;
}

/**
 * Calculates total expedition cost, average share per person, and each payer's net balance (VND).
 */
export function computeExpenseSettlement(
  expenses: ExpenseEntry[],
  memberCount: number
): ExpenseSettlementSummary {
  const safeMembers = Math.max(1, memberCount || 1);
  let totalVnd = 0;
  let perPersonShareSum = 0;

  const byPayer = new Map<string, number>();
  for (const exp of expenses) {
    const amount = Number(exp.amountVnd) || 0;
    const rawSplit = Number(exp.splitCount);
    const divisor = Number.isFinite(rawSplit) && rawSplit >= 1 ? Math.min(safeMembers, Math.round(rawSplit)) : safeMembers;
    totalVnd += amount;
    perPersonShareSum += amount / divisor;
    const name = exp.paidByName || 'Thành viên';
    byPayer.set(name, (byPayer.get(name) || 0) + amount);
  }

  const perPersonAverageVnd = Math.round(perPersonShareSum);

  const payerTotals = Array.from(byPayer.entries()).map(([name, paidVnd]) => ({
    name,
    paidVnd,
    balanceVnd: paidVnd - perPersonAverageVnd,
  }));

  return { totalVnd, perPersonAverageVnd, payerTotals };
}
