import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import type { Request, Response, NextFunction } from 'express';

import {
  AWS_TERRARIUM_ATTRIBUTION,
  decodeTerrariumPng,
  buildElevationMetrics,
  sampleTrackPoints,
} from '../src/services/elevation.service.js';
import { calculateSolarTimes, formatHoursToHHMM } from '../src/utils/solarMath.js';
import {
  getSunriseSunsetData,
  mapMetSymbolToWmoCode,
  normalizeMetNorwayForecast,
  MET_NORWAY_ATTRIBUTION,
} from '../src/services/publicApis.service.js';
import {
  hashPassword,
  verifyPassword,
  hashPasswordAsync,
  verifyPasswordAsync,
  needsPasswordRehash,
  generateToken,
  verifyToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../src/utils/auth.js';
import {
  isPrivateOrLocalHostname,
  isSafeHttpUrl,
  isSafePublicUrlWithDns,
  hasDangerousMongoKeys,
  sanitizeInput,
} from '../src/utils/validation.js';
import { getClientBaseUrl } from '../src/utils/clientUrl.js';
import {
  createRateLimiter,
  createUserRateLimiter,
  stopRateLimiterTimers,
} from '../src/middleware/rateLimiter.middleware.js';
import { mockTrails } from '../src/data/seedData.js';
import {
  VIETNAM_RANGER_STATIONS,
  VIETNAM_SUMMIT_CHALLENGES,
  VERIFIED_GUIDES_EXTENDED,
} from '../src/data/vietnamDirectory.js';
import { masterKnowledgeDataset } from '../src/data/trekkerKnowledgeDataset.js';

const SERVER_ROOT = fs.existsSync(path.resolve(process.cwd(), 'src/data/seedData.ts'))
  ? process.cwd()
  : path.resolve(process.cwd(), 'server');
const REPO_ROOT = path.resolve(SERVER_ROOT, '..');

// ============================================================================
// Pure-Node RFC-2083 Synthetic PNG Encoder Helpers (Zero External Dependencies)
// ============================================================================

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
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

function encodeTerrariumRgb(elevationM: number): [number, number, number] {
  const shifted = elevationM + 32768;
  const r = Math.floor(shifted / 256);
  const g = Math.floor(shifted - r * 256);
  const b = Math.round((shifted - r * 256 - g) * 256);
  if (b >= 256) {
    const nextG = g + 1;
    if (nextG >= 256) return [r + 1, 0, 0];
    return [r, nextG, 0];
  }
  return [r, g, b];
}

function decodeTerrariumRgb(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

function buildSyntheticPng(options: {
  width: number;
  height: number;
  colorType: 2 | 3 | 6;
  rawPixels: Uint8Array;
  rowFilterTypes: number[];
  palette?: Uint8Array;
}): Buffer {
  const { width, height, colorType, rawPixels, rowFilterTypes, palette } = options;
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : 1;
  const rowBytes = width * channels;
  assert.equal(rawPixels.length, height * rowBytes, 'rawPixels byte length mismatch');
  assert.equal(rowFilterTypes.length, height, 'rowFilterTypes length mismatch');

  const scanlines = Buffer.alloc(height * (1 + rowBytes));
  for (let y = 0; y < height; y++) {
    const filterType = rowFilterTypes[y];
    const outRowStart = y * (1 + rowBytes);
    scanlines[outRowStart] = filterType;

    for (let x = 0; x < rowBytes; x++) {
      const raw = rawPixels[y * rowBytes + x];
      const a = x >= channels ? rawPixels[y * rowBytes + x - channels] : 0;
      const b = y > 0 ? rawPixels[(y - 1) * rowBytes + x] : 0;
      const c = x >= channels && y > 0 ? rawPixels[(y - 1) * rowBytes + x - channels] : 0;

      let filtered: number;
      if (filterType === 0) {
        filtered = raw;
      } else if (filterType === 1) {
        filtered = (raw - a) & 0xff;
      } else if (filterType === 2) {
        filtered = (raw - b) & 0xff;
      } else if (filterType === 3) {
        filtered = (raw - ((a + b) >>> 1)) & 0xff;
      } else if (filterType === 4) {
        filtered = (raw - paethPredictor(a, b, c)) & 0xff;
      } else {
        filtered = raw;
      }
      scanlines[outRowStart + 1 + x] = filtered;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bitDepth = 8
  ihdr[9] = colorType;
  ihdr[10] = 0; // compression = deflate
  ihdr[11] = 0; // filter method = standard
  ihdr[12] = 0; // interlace = none

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunks: Buffer[] = [signature, makePngChunk('IHDR', ihdr)];
  if (palette) {
    chunks.push(makePngChunk('PLTE', Buffer.from(palette)));
  }
  const compressed = zlib.deflateSync(scanlines);
  chunks.push(makePngChunk('IDAT', compressed));
  chunks.push(makePngChunk('IEND', Buffer.alloc(0)));

  return Buffer.concat(chunks);
}

// ============================================================================
// Mock Express Req/Res Helper for Rate Limiter Unit Tests
// ============================================================================

interface MockResState {
  statusCode: number;
  headers: Record<string, string | number>;
  jsonBody: unknown;
}

function createMockExpressPair(ip: string, userId?: string): {
  req: Request;
  res: Response;
  state: MockResState;
} {
  const state: MockResState = {
    statusCode: 200,
    headers: {},
    jsonBody: null,
  };

  const req = {
    ip,
    socket: { remoteAddress: ip },
    ...(userId ? { user: { userId } } : {}),
  } as unknown as Request;

  const res = {
    setHeader(name: string, value: string | number) {
      state.headers[name] = value;
      return this;
    },
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(body: unknown) {
      state.jsonBody = body;
      return this;
    },
  } as unknown as Response;

  return { req, res, state };
}

// ============================================================================
// 1. AWS Open Data Terrarium PNG Decoder & Elevation Metrics
// ============================================================================

describe('1. AWS Open Data Terrarium PNG Decoder (RFC-2083)', () => {
  // 4x4 grid of real Vietnam & edge-case elevations exercising all RGB channels & wrap-around bytes
  const sampleElevations4x4 = [
    // Row 0: Fansipan, Sea level, Valley below sea level, Mũi Đôi peak
    3143.0, 0.0, -12.5, 145.25,
    // Row 1: Pu Si Lung, Bạch Mã, Bà Đen, Tả Liên Sơn
    3083.125, 1450.0, 986.5, 2996.75,
    // Row 2: Chư Yang Sin, Bidoup, Cát Tiên, Nam Kang Ho Tao
    2442.0, 2287.375, 168.0, 2881.625,
    // Row 3: Tà Xùa, Lảo Thẩn, Giếng Trời, Thác K50
    2865.0, 2860.875, 480.25, 1020.0,
  ];

  const rawRgb4x4 = new Uint8Array(4 * 4 * 3);
  sampleElevations4x4.forEach((ele, idx) => {
    const [r, g, b] = encodeTerrariumRgb(ele);
    rawRgb4x4[idx * 3] = r;
    rawRgb4x4[idx * 3 + 1] = g;
    rawRgb4x4[idx * 3 + 2] = b;
  });

  const filterNames: Array<[number, string]> = [
    [0, 'None'],
    [1, 'Sub'],
    [2, 'Up'],
    [3, 'Average'],
    [4, 'Paeth'],
  ];

  for (const [filterType, filterName] of filterNames) {
    it(`decodes 4x4 RGB Terrarium PNG with RFC-2083 filter ${filterType} (${filterName}) within ±0.02m`, () => {
      const pngBuf = buildSyntheticPng({
        width: 4,
        height: 4,
        colorType: 2,
        rawPixels: rawRgb4x4,
        rowFilterTypes: [filterType, filterType, filterType, filterType],
      });

      const decoded = decodeTerrariumPng(pngBuf);
      assert.ok(decoded, `Filter ${filterType} (${filterName}) PNG must decode cleanly`);
      assert.equal(decoded.width, 4);
      assert.equal(decoded.height, 4);
      const { rgb } = decoded;
      assert.equal(rgb.length, 4 * 4 * 3);

      for (let i = 0; i < sampleElevations4x4.length; i++) {
        const r: number = rgb[i * 3];
        const g: number = rgb[i * 3 + 1];
        const b: number = rgb[i * 3 + 2];
        const expectedEle = sampleElevations4x4[i];
        const actualEle = decodeTerrariumRgb(r, g, b);
        assert.ok(
          Math.abs(actualEle - expectedEle) <= 0.02,
          `Filter ${filterName} pixel #${i}: expected ${expectedEle}m, got ${actualEle}m (RGB=${r},${g},${b})`
        );
      }
    });
  }

  it('decodes mixed-filter 4x4 RGB, RGBA (colorType 6), and Indexed Palette (colorType 3) PNGs accurately', () => {
    // Mixed filters across rows: None, Sub, Average, Paeth
    const mixedPng = buildSyntheticPng({
      width: 4,
      height: 4,
      colorType: 2,
      rawPixels: rawRgb4x4,
      rowFilterTypes: [0, 1, 3, 4],
    });
    const decodedMixed = decodeTerrariumPng(mixedPng);
    assert.ok(decodedMixed);
    assert.deepEqual(Array.from(decodedMixed.rgb), Array.from(rawRgb4x4));

    // RGBA (colorType 6) with Paeth filter
    const rawRgba = new Uint8Array(4 * 4 * 4);
    for (let i = 0; i < 16; i++) {
      rawRgba[i * 4] = rawRgb4x4[i * 3];
      rawRgba[i * 4 + 1] = rawRgb4x4[i * 3 + 1];
      rawRgba[i * 4 + 2] = rawRgb4x4[i * 3 + 2];
      rawRgba[i * 4 + 3] = 255;
    }
    const rgbaPng = buildSyntheticPng({
      width: 4,
      height: 4,
      colorType: 6,
      rawPixels: rawRgba,
      rowFilterTypes: [0, 2, 3, 4],
    });
    const decodedRgba = decodeTerrariumPng(rgbaPng);
    assert.ok(decodedRgba);
    assert.deepEqual(Array.from(decodedRgba.rgb), Array.from(rawRgb4x4));

    // Indexed-color PNG (colorType 3) with PLTE chunk
    const [fanR, fanG, fanB] = encodeTerrariumRgb(3143.0);
    const [seaR, seaG, seaB] = encodeTerrariumRgb(0.0);
    const palette = new Uint8Array([fanR, fanG, fanB, seaR, seaG, seaB]);
    const indexedPng = buildSyntheticPng({
      width: 2,
      height: 2,
      colorType: 3,
      rawPixels: new Uint8Array([0, 1, 1, 0]),
      rowFilterTypes: [0, 2],
      palette,
    });
    const decodedIndexed = decodeTerrariumPng(indexedPng);
    assert.ok(decodedIndexed);
    assert.ok(Math.abs(decodeTerrariumRgb(decodedIndexed.rgb[0], decodedIndexed.rgb[1], decodedIndexed.rgb[2]) - 3143) <= 0.02);
    assert.ok(Math.abs(decodeTerrariumRgb(decodedIndexed.rgb[3], decodedIndexed.rgb[4], decodedIndexed.rgb[5]) - 0) <= 0.02);
  });

  it('rejects malformed, corrupted, or invalid-filter PNG buffers safely and exposes AWS attribution', () => {
    assert.equal(decodeTerrariumPng(Buffer.from('not a png')), null);
    assert.equal(decodeTerrariumPng(Buffer.alloc(10)), null);

    // Invalid filter byte = 5
    const badFilterPng = buildSyntheticPng({
      width: 2,
      height: 2,
      colorType: 2,
      rawPixels: rawRgb4x4.subarray(0, 12),
      rowFilterTypes: [0, 5],
    });
    assert.equal(decodeTerrariumPng(badFilterPng), null);

    // Indexed colorType=3 without PLTE chunk must be rejected
    const missingPltePng = buildSyntheticPng({
      width: 2,
      height: 2,
      colorType: 3,
      rawPixels: new Uint8Array([0, 0, 0, 0]),
      rowFilterTypes: [0, 0],
    });
    assert.equal(decodeTerrariumPng(missingPltePng), null);

    assert.match(AWS_TERRARIUM_ATTRIBUTION, /AWS Open Data/i);
    assert.match(AWS_TERRARIUM_ATTRIBUTION, /Mapzen\/Tilezen/i);

    // Track sampling & elevation metrics sanity check
    const sampled = sampleTrackPoints(
      [
        [22.35, 103.77],
        [22.33, 103.772],
        [22.31, 103.774],
        [22.3033, 103.775],
      ],
      3
    );
    assert.equal(sampled.length, 3);
    assert.deepEqual(sampled[0], [22.35, 103.77]);
    assert.deepEqual(sampled[2], [22.3033, 103.775]);

    const metrics = buildElevationMetrics(sampled, [1900, 2500, 3143], 11.2);
    assert.equal(metrics.minElevationM, 1900);
    assert.equal(metrics.maxElevationM, 3143);
    assert.equal(metrics.elevationGainM, 1243);
  });
});

// ============================================================================
// 2. Local NOAA Solar Math & MET Norway Offline Normalization
// ============================================================================

describe('2. Local NOAA Solar Math & MET Norway Offline Normalization', () => {
  const VIETNAM_SOLAR_PEAKS = [
    { name: 'Fansipan (Lào Cai)', lat: 22.3033, lng: 103.775 },
    { name: 'Bạch Mã (TP. Huế)', lat: 16.198, lng: 107.858 },
    { name: 'Núi Bà Đen (Tây Ninh)', lat: 11.373, lng: 106.174 },
  ];

  // Noon Vietnam time (UTC+7) so date rollover is invariant to host OS timezone
  const winterSolsticeDate = new Date('2026-12-21T05:00:00.000Z');
  const summerSolsticeDate = new Date('2026-06-21T05:00:00.000Z');

  it('computes accurate summer vs winter solstice sunrise, sunset, and day length for Fansipan, Bạch Mã, and Bà Đen', () => {
    const seasonalSwingByPeak: Record<string, number> = {};

    for (const peak of VIETNAM_SOLAR_PEAKS) {
      const winter = calculateSolarTimes(peak.lat, peak.lng, winterSolsticeDate, 7);
      const summer = calculateSolarTimes(peak.lat, peak.lng, summerSolsticeDate, 7);

      assert.ok(
        summer.dayLengthMinutes > winter.dayLengthMinutes,
        `${peak.name}: summer day (${summer.dayLengthMinutes}m) must exceed winter day (${winter.dayLengthMinutes}m)`
      );
      seasonalSwingByPeak[peak.name] = summer.dayLengthMinutes - winter.dayLengthMinutes;

      for (const [label, res] of [
        ['winter', winter],
        ['summer', summer],
      ] as const) {
        assert.ok(
          res.sunriseHours >= 5.0 && res.sunriseHours <= 7.0,
          `${peak.name} (${label}) sunrise ${res.sunrise} (${res.sunriseHours.toFixed(2)}h) must be in 05:00–07:00 ICT`
        );
        assert.ok(
          res.sunsetHours >= 17.0 && res.sunsetHours <= 19.0,
          `${peak.name} (${label}) sunset ${res.sunset} (${res.sunsetHours.toFixed(2)}h) must be in 17:00–19:00 ICT`
        );
        assert.match(res.sunrise, /^0[567]:\d{2}$/, `${peak.name} (${label}) sunrise HH:MM format`);
        assert.match(res.sunset, /^1[789]:\d{2}$/, `${peak.name} (${label}) sunset HH:MM format`);
        assert.ok(
          res.civilDawnHours < res.sunriseHours &&
            res.sunriseHours < res.goldenHourMorningEndHours &&
            res.goldenHourMorningEndHours < res.solarNoonHours &&
            res.solarNoonHours < res.goldenHourEveningStartHours &&
            res.goldenHourEveningStartHours < res.sunsetHours &&
            res.sunsetHours < res.civilDuskHours,
          `${peak.name} (${label}) solar timeline must be strictly monotonic`
        );
        assert.equal(res.arcSamples.length, 49, 'Solar arc must sample 0.0h..24.0h at 30m intervals');
        assert.ok(res.solarNoonAltitudeDeg > 40, `${peak.name} (${label}) solar noon altitude must exceed 40°`);
      }
    }

    // Higher northern latitude (Fansipan 22.3°N) must have larger solstice day-length swing than Bà Đen (11.4°N)
    assert.ok(
      seasonalSwingByPeak['Fansipan (Lào Cai)'] > seasonalSwingByPeak['Bạch Mã (TP. Huế)'] &&
        seasonalSwingByPeak['Bạch Mã (TP. Huế)'] > seasonalSwingByPeak['Núi Bà Đen (Tây Ninh)'],
      'Seasonal day-length swing must increase with latitude across Vietnam'
    );
    assert.equal(formatHoursToHHMM(6.5), '06:30');
    assert.equal(formatHoursToHHMM(NaN), '--:--');
  });

  it('returns local offline sunrise/sunset payload with NOAA attribution for all 3 peaks', async () => {
    for (const peak of VIETNAM_SOLAR_PEAKS) {
      const astro = await getSunriseSunsetData(peak.lat, peak.lng);
      assert.match(astro.sunrise, /^0[567]:\d{2}$/);
      assert.match(astro.sunset, /^1[789]:\d{2}$/);
      assert.ok(astro.dayLengthHours >= 10.5 && astro.dayLengthHours <= 13.8);
      assert.ok(typeof astro.attribution === 'string' && astro.attribution.length > 0, 'attribution must be present');
      assert.match(astro.attribution, /NOAA/i);
    }
  });

  it('normalizes MET Norway Locationforecast 2.0 JSON offline without double-counting overlapping precip windows', () => {
    assert.equal(mapMetSymbolToWmoCode('heavyrainshowersandthunder_day'), 95);
    assert.equal(mapMetSymbolToWmoCode('clearsky_day'), 0);
    assert.equal(mapMetSymbolToWmoCode('fog'), 45);
    assert.equal(mapMetSymbolToWmoCode('partlycloudy_night'), 2);

    const syntheticMetNorway = {
      geometry: { type: 'Point', coordinates: [103.775, 22.3033, 3143] },
      properties: {
        timeseries: [
          {
            time: '2026-11-25T00:00:00Z', // 07:00 ICT
            data: {
              instant: {
                details: {
                  air_temperature: 6.2,
                  wind_speed: 5.0, // 18 km/h
                  relative_humidity: 88,
                  cloud_area_fraction: 60,
                },
              },
              next_1_hours: { summary: { symbol_code: 'partlycloudy_day' }, details: { precipitation_amount: 1.5 } },
              next_6_hours: {
                summary: { symbol_code: 'rain' },
                details: { air_temperature_min: 4.0, air_temperature_max: 11.0, precipitation_amount: 9.0 },
              },
            },
          },
          {
            time: '2026-11-25T01:00:00Z', // 08:00 ICT
            data: {
              instant: {
                details: {
                  air_temperature: 8.5,
                  wind_speed: 7.5, // 27 km/h
                  relative_humidity: 82,
                  cloud_area_fraction: 40,
                },
              },
              next_1_hours: { summary: { symbol_code: 'lightrain' }, details: { precipitation_amount: 0.5 } },
            },
          },
        ],
      },
    };

    const normalized = normalizeMetNorwayForecast(syntheticMetNorway);
    assert.ok(normalized);
    assert.equal(normalized.provider, 'met-norway-locationforecast-2.0');
    assert.equal(normalized.attribution, MET_NORWAY_ATTRIBUTION);
    assert.equal(normalized.elevation, 3143);
    assert.equal(normalized.current.temperature_2m, 6.2);
    assert.equal(normalized.current.wind_speed_10m, 18);
    assert.equal(normalized.daily.precipitation_sum[0], 2.0, 'Must sum 1h amounts (1.5 + 0.5) without double-counting 6h');
    assert.equal(normalized.daily.temperature_2m_min[0], 4.0);
    assert.equal(normalized.daily.temperature_2m_max[0], 11.0);
  });
});

// ============================================================================
// 3. Security Hardening: PBKDF2 Rehash, SSRF Guard, Sliding-Window Rate Limiter
// ============================================================================

describe('3. Security Hardening (PBKDF2, SSRF, Sliding-Window Rate Limiter)', () => {
  after(() => {
    stopRateLimiterTimers();
  });

  it('verifies PBKDF2 password hashing, wrong-password rejection, and legacy needsPasswordRehash detection', async () => {
    const plain = 'Fansipan#Alpine2026!';
    const asyncHash = await hashPasswordAsync(plain);
    const syncHash = hashPassword(plain);

    assert.ok(asyncHash.startsWith('pbkdf2:100000:'));
    assert.ok(syncHash.startsWith('pbkdf2:100000:'));
    assert.notEqual(asyncHash, syncHash, 'Each hash must use a unique cryptographic random salt');

    assert.equal(await verifyPasswordAsync(plain, asyncHash), true);
    assert.equal(verifyPassword(plain, syncHash), true);
    assert.equal(await verifyPasswordAsync('WrongPass#2026!', asyncHash), false);
    assert.equal(verifyPassword('WrongPass#2026!', syncHash), false);
    assert.equal(await verifyPasswordAsync('a'.repeat(300), asyncHash), false, 'Passwords > 256 bytes must fail');
    assert.equal(await verifyPasswordAsync(plain, 'malformed-hash'), false);

    // Modern 100,000-round hash does NOT need rehash
    assert.equal(needsPasswordRehash(asyncHash), false);
    assert.equal(needsPasswordRehash(''), false);

    // Legacy 10,000-iteration pbkdf2 hash still verifies, AND triggers needsPasswordRehash === true
    const legacySalt = crypto.randomBytes(16).toString('hex');
    const legacy10kDigest = crypto.pbkdf2Sync(plain, legacySalt, 10_000, 64, 'sha512').toString('hex');
    const legacy10kHash = `pbkdf2:10000:${legacySalt}:${legacy10kDigest}`;
    assert.equal(await verifyPasswordAsync(plain, legacy10kHash), true);
    assert.equal(await verifyPasswordAsync('WrongPass', legacy10kHash), false);
    assert.equal(needsPasswordRehash(legacy10kHash), true);

    // Legacy 2-part 1,000-iteration `salt:hash` format verifies AND triggers needsPasswordRehash === true
    const legacy1kDigest = crypto.pbkdf2Sync(plain, legacySalt, 1000, 64, 'sha512').toString('hex');
    const legacy2Part = `${legacySalt}:${legacy1kDigest}`;
    assert.equal(await verifyPasswordAsync(plain, legacy2Part), true);
    assert.equal(needsPasswordRehash(legacy2Part), true);

    // Access vs refresh token domain separation
    const access = generateToken('u-1', 'guide@lost.vn', 'guide', 1);
    const refresh = generateRefreshToken('u-1', 'guide@lost.vn', 'guide', 1);
    assert.ok(verifyToken(access));
    assert.ok(verifyRefreshToken(refresh));
    assert.equal(verifyToken(refresh), null, 'Refresh token must never validate as Bearer access token');
    assert.equal(verifyRefreshToken(access), null, 'Access token must never validate as refresh token');
  });

  it('blocks all SSRF internal/loopback/metadata/obfuscated/unsafe-scheme URLs without public false positives', async () => {
    const blockedUrls = [
      'http://127.0.0.1',
      'http://127.0.0.1:5000/api/health',
      'http://localhost:5000',
      'http://localhost./api',
      'http://sub.localhost/test',
      'http://169.254.169.254/latest/meta-data',
      'http://10.0.0.1',
      'http://172.16.0.1',
      'http://192.168.1.1',
      'http://0.0.0.0:3000',
      'http://[::1]',
      'http://[::1]:5000/admin',
      'http://[::ffff:127.0.0.1]/secret',
      'http://[::ffff:169.254.169.254]/latest/meta-data',
      'http://[fe80::1]/link-local',
      'http://[fc00::1]/ula',
      'http://2130706433', // Decimal IPv4 127.0.0.1
      'http://0x7f000001', // Hex IPv4 127.0.0.1
      'http://0177.0.0.1', // Octal IPv4 127.0.0.1
      'http://printer.local/status',
      'http://metadata.internal/computeMetadata',
      'http://user:pass@example.com/private',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'ftp://example.com/archive.zip',
      '',
      'not-a-url',
    ];

    for (const url of blockedUrls) {
      assert.equal(isSafeHttpUrl(url), false, `SSRF validator MUST block: ${url}`);
    }

    // DNS-aware wrapper must also short-circuit literal internal/unsafe URLs offline
    assert.equal(await isSafePublicUrlWithDns('http://127.0.0.1'), false);
    assert.equal(await isSafePublicUrlWithDns('http://169.254.169.254/latest/meta-data'), false);
    assert.equal(await isSafePublicUrlWithDns('javascript:alert(1)'), false);

    assert.equal(isPrivateOrLocalHostname('127.0.0.1'), true);
    assert.equal(isPrivateOrLocalHostname('::1'), true);
    assert.equal(isPrivateOrLocalHostname('169.254.169.254'), true);

    const allowedPublicUrls = [
      'https://lost.vn/trails/fansipan',
      'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/3228/1790.png',
      'https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=22.3033&lon=103.7750',
      'https://fcdn.vn/images/fansipan.jpg', // Must NOT falsely match IPv6 ULA fc00::/7!
      'https://fd.nl/alpine-weather', // Must NOT falsely match IPv6 ULA fd00::/8!
      'https://eonet.gsfc.nasa.gov/api/v3/events',
      'http://example.com/public-photo.jpg',
    ];

    for (const url of allowedPublicUrls) {
      assert.equal(isSafeHttpUrl(url), true, `SSRF validator MUST allow valid public URL: ${url}`);
    }

    // MongoDB operator injection, prototype pollution & depth DoS guard
    assert.equal(hasDangerousMongoKeys({ $ne: null }), true);
    assert.equal(hasDangerousMongoKeys({ nested: { 'a.b': 1 } }), true);
    assert.equal(hasDangerousMongoKeys(JSON.parse('{"__proto__":{"polluted":true}}')), true);
    assert.equal(hasDangerousMongoKeys({ constructor: { prototype: { admin: true } } }), true);
    assert.equal(hasDangerousMongoKeys({ prototype: { evil: 1 } }), true);
    let deepObj: Record<string, unknown> = { ok: true };
    for (let i = 0; i < 25; i++) deepObj = { nested: deepObj };
    assert.equal(hasDangerousMongoKeys(deepObj), true, 'Objects nested deeper than 20 levels must be rejected');
    assert.equal(hasDangerousMongoKeys({ trailId: 'trail-fansipan', rating: 5 }), false);

    // ReDoS-free O(n) sanitizeInput on adversarial repeated unclosed tags
    const t0 = performance.now();
    const unclosedScripts = '<script>'.repeat(50_000);
    assert.equal(sanitizeInput(unclosedScripts), '');
    const mixedUnclosed = `${'<script>'.repeat(20_000)}</style>An toàn`;
    assert.equal(sanitizeInput(mixedUnclosed), 'An toàn');
    const elapsedMs = performance.now() - t0;
    assert.ok(elapsedMs < 500, `sanitizeInput must run in linear O(n) time without ReDoS (took ${elapsedMs.toFixed(1)}ms)`);

    // DNS-aware SSRF guard returns false cleanly within bounded timeout on non-existent TLD
    const dnsStart = performance.now();
    assert.equal(await isSafePublicUrlWithDns('https://nonexistent.invalid/test', 500), false);
    assert.ok(performance.now() - dnsStart < 2500, 'isSafePublicUrlWithDns must respect bounded timeout');
  });

  it('enforces zero unbounded fetch(), zero duplicate route setInterval limiters, and zero copyright traps across server/src', () => {
    const collectTsFiles = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...collectTsFiles(full));
        else if (entry.isFile() && entry.name.endsWith('.ts')) out.push(full);
      }
      return out;
    };

    const allServerTs = collectTsFiles(path.join(SERVER_ROOT, 'src'));
    assert.ok(allServerTs.length >= 80, `Expected >= 80 server TS files, got ${allServerTs.length}`);

    const bannedPatterns: Array<{ label: string; rx: RegExp }> = [
      { label: 'Open-Meteo', rx: /open-?meteo/i },
      { label: 'ERA5', rx: /\bera5\b/i },
      { label: 'Leaflet', rx: /\bleaflet\b/i },
      { label: 'Esri/ArcGIS', rx: /arcgisonline|\besri\b/i },
      { label: 'OSRM Demo', rx: /router\.project-osrm/i },
      { label: 'Unsplash', rx: /images\.unsplash\.com/i },
      { label: 'Legacy Cloudinary dsxbuk4pe', rx: /dsxbuk4pe/i },
      { label: 'Hippocratic-2.1', rx: /hippocratic/i },
    ];

    for (const filePath of allServerTs) {
      const content = fs.readFileSync(filePath, 'utf8');
      const rel = path.relative(SERVER_ROOT, filePath).replace(/\\/g, '/');

      for (const { label, rx } of bannedPatterns) {
        assert.doesNotMatch(content, rx, `Copyright/stack guard failed: found banned "${label}" in ${rel}`);
      }

      // Every route file must use centralized rateLimiter.middleware.ts (zero copy-pasted setInterval buckets)
      if (rel.startsWith('src/routes/')) {
        assert.doesNotMatch(
          content,
          /\bsetInterval\s*\(/,
          `Route file ${rel} must not define ad-hoc setInterval rate limiters; import createUserRateLimiter instead`
        );
      }

      // Every outbound fetch() call must pass an explicit AbortSignal/AbortController timeout
      const fetchRx = /\bfetch\s*\(/g;
      let match: RegExpExecArray | null;
      while ((match = fetchRx.exec(content)) !== null) {
        const windowSnippet = content.slice(match.index, match.index + 600);
        assert.match(
          windowSnippet,
          /AbortSignal\.timeout\s*\(|signal\s*:/,
          `Unbounded fetch() without timeout signal in ${rel} near index ${match.index}`
        );
      }
    }
  });

  it('enforces check-before-push sliding-window rate limiting without permanent lockout under continued 429 traffic', () => {
    const originalDateNow = Date.now;
    let fakeNow = 1_700_000_000_000;
    Date.now = () => fakeNow;

    try {
      const limiter = createRateLimiter(3, 1_000, 'Quá nhiều yêu cầu', 'test-sliding');
      const invoke = (ip: string) => {
        const { req, res, state } = createMockExpressPair(ip);
        let nextCalled = false;
        const next: NextFunction = () => {
          nextCalled = true;
        };
        limiter(req, res, next);
        return { nextCalled, state };
      };

      // Requests 1..3 within 1,000ms window are allowed
      const r1 = invoke('203.0.113.42');
      assert.equal(r1.nextCalled, true);
      assert.equal(r1.state.headers['X-RateLimit-Remaining'], 2);

      fakeNow += 100; // +100ms
      const r2 = invoke('203.0.113.42');
      assert.equal(r2.nextCalled, true);
      assert.equal(r2.state.headers['X-RateLimit-Remaining'], 1);

      fakeNow += 100; // +200ms
      const r3 = invoke('203.0.113.42');
      assert.equal(r3.nextCalled, true);
      assert.equal(r3.state.headers['X-RateLimit-Remaining'], 0);

      // Request N+1 (4th) returns 429 and sets Retry-After
      fakeNow += 100; // +300ms
      const r4 = invoke('203.0.113.42');
      assert.equal(r4.nextCalled, false);
      assert.equal(r4.state.statusCode, 429);
      assert.equal(r4.state.headers['X-RateLimit-Remaining'], 0);
      assert.ok(Number(r4.state.headers['Retry-After']) >= 1);

      // Hammering additional rejected requests at +500ms, +700ms, +900ms must NOT push timestamps or extend lockout
      for (const delta of [200, 200, 200]) {
        fakeNow += delta;
        const blocked = invoke('203.0.113.42');
        assert.equal(blocked.nextCalled, false);
        assert.equal(blocked.state.statusCode, 429);
      }

      // Advance to +1001ms after r1 -> r1 has slid out of the 1,000ms window, so caller MUST recover immediately!
      fakeNow = 1_700_000_000_000 + 1_001;
      const recovered = invoke('203.0.113.42');
      assert.equal(
        recovered.nextCalled,
        true,
        'Caller must recover as soon as earliest accepted hit expires (rejected 429 hits must not extend lockout)'
      );
      assert.equal(recovered.state.statusCode, 200);

      // User-keyed limiter must isolate distinct authenticated users sharing one NAT/office IP
      const userLimiter = createUserRateLimiter(1, 1_000, 'Slow down', 'test-user-rl');
      const callUser = (uid: string) => {
        const { req, res, state } = createMockExpressPair('198.51.100.7', uid);
        let nextCalled = false;
        userLimiter(req, res, () => {
          nextCalled = true;
        });
        return { nextCalled, state };
      };
      assert.equal(callUser('user-a').nextCalled, true);
      assert.equal(callUser('user-a').state.statusCode, 429);
      assert.equal(callUser('user-b').nextCalled, true, 'Separate userId on same IP must have independent quota');
    } finally {
      Date.now = originalDateNow;
    }
  });

  it('resolves getClientBaseUrl safely across explicit CLIENT_URL, production fallback, and development fallback with zero ad-hoc localhost fallbacks', () => {
    // Explicit CLIENT_URL (strips trailing slashes & whitespace)
    assert.equal(
      getClientBaseUrl({ CLIENT_URL: 'https://app.lost.vn', NODE_ENV: 'production' }),
      'https://app.lost.vn'
    );
    assert.equal(
      getClientBaseUrl({ CLIENT_URL: 'https://app.lost.vn/', NODE_ENV: 'production' }),
      'https://app.lost.vn'
    );
    assert.equal(
      getClientBaseUrl({ CLIENT_URL: '  https://staging.lost.vn///  ', NODE_ENV: 'development' }),
      'https://staging.lost.vn'
    );

    // Production fallback MUST default to https://lost.vn and NEVER leak localhost
    const prodFallback = getClientBaseUrl({ NODE_ENV: 'production' });
    assert.equal(prodFallback, 'https://lost.vn');
    assert.doesNotMatch(prodFallback, /localhost|127\.0\.0\.1/i);
    assert.equal(getClientBaseUrl({ NODE_ENV: 'production', CLIENT_URL: '   ' }), 'https://lost.vn');

    // Development / test / unset NODE_ENV fallback
    assert.equal(getClientBaseUrl({ NODE_ENV: 'development' }), 'http://localhost:5173');
    assert.equal(getClientBaseUrl({ NODE_ENV: 'test' }), 'http://localhost:5173');
    assert.equal(getClientBaseUrl({}), 'http://localhost:5173');

    // Ensure zero ad-hoc `process.env.CLIENT_URL || 'http://localhost:5173'` sites remain in server/src
    const collectTs = (dir: string): string[] => {
      const files: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...collectTs(full));
        else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(full);
      }
      return files;
    };
    for (const filePath of collectTs(path.join(SERVER_ROOT, 'src'))) {
      const rel = path.relative(SERVER_ROOT, filePath).replace(/\\/g, '/');
      if (rel === 'src/utils/clientUrl.ts' || rel === 'src/config/cors.ts') continue;
      const src = fs.readFileSync(filePath, 'utf8');
      assert.doesNotMatch(
        src,
        /CLIENT_URL\s*\|\|\s*['"]http:\/\/localhost:5173['"]/,
        `${rel} must use getClientBaseUrl() instead of ad-hoc localhost fallback`
      );
    }

    // Verify sanitized server/.env.example exists with key production vars and zero real secrets
    const envExamplePath = path.join(SERVER_ROOT, '.env.example');
    assert.ok(fs.existsSync(envExamplePath), 'server/.env.example must exist');
    const envExample = fs.readFileSync(envExamplePath, 'utf8');
    for (const key of [
      'NODE_ENV',
      'PORT',
      'MONGODB_URI',
      'JWT_SECRET',
      'CLIENT_URL',
      'CORS_ORIGINS',
      'TRUST_PROXY',
      'COOKIE_SAME_SITE',
      'ADMIN_SEED_PASSWORD',
      'SMTP_HOST',
      'GOOGLE_CLIENT_ID',
      'CLOUDINARY_CLOUD_NAME',
      'GEMINI_API_KEY',
    ]) {
      assert.match(envExample, new RegExp(`^#?\\s*${key}=`, 'm'), `server/.env.example must document ${key}`);
    }
    assert.doesNotMatch(envExample, /AIzaSy|mongodb\+srv:\/\/[^<\s]+:[^<\s]+@|GOCSPX-/i, 'server/.env.example must not contain real secrets');
  });
});

// ============================================================================
// 4. Rule-11 Real Vietnam Safety & Copyright Knowledge Assertions
// ============================================================================

describe('4. Rule-11 Real Vietnam Safety, Geography & Copyright Assertions', () => {
  const seedRaw = fs.readFileSync(path.join(SERVER_ROOT, 'src/data/seedData.ts'), 'utf8');
  const directoryRaw = fs.readFileSync(path.join(SERVER_ROOT, 'src/data/vietnamDirectory.ts'), 'utf8');
  const knowledgeRaw = fs.readFileSync(path.join(SERVER_ROOT, 'src/data/trekkerKnowledgeDataset.ts'), 'utf8');

  it('validates all 36 mockTrails bounds, SVG covers, and zero banned stock/Cloudinary/stale phone strings', () => {
    assert.equal(mockTrails.length, 36, `Expected exactly 36 canonical Vietnam trails, got ${mockTrails.length}`);

    for (const trail of mockTrails) {
      assert.ok(trail.startLat >= 8 && trail.startLat <= 24, `${trail.id} startLat=${trail.startLat} outside Vietnam`);
      assert.ok(trail.startLng >= 102 && trail.startLng <= 110, `${trail.id} startLng=${trail.startLng} outside Vietnam`);
      assert.ok(trail.endLat >= 8 && trail.endLat <= 24, `${trail.id} endLat=${trail.endLat} outside Vietnam`);
      assert.ok(trail.endLng >= 102 && trail.endLng <= 110, `${trail.id} endLng=${trail.endLng} outside Vietnam`);
      assert.ok(trail.distanceKm > 0, `${trail.id} distanceKm must be positive`);
      assert.ok(trail.maxAltitudeM > 0 && trail.maxAltitudeM <= 3143, `${trail.id} maxAltitudeM=${trail.maxAltitudeM} out of range`);
      assert.match(trail.coverImage, /^\/covers\/[a-z0-9-]+\.svg$/i, `${trail.id} coverImage must use local /covers/*.svg`);

      if (Array.isArray(trail.galleryImages)) {
        for (const img of trail.galleryImages) {
          assert.match(img, /^\/covers\/[a-z0-9-]+\.svg$/i, `${trail.id} galleryImage ${img} must use /covers/*.svg`);
        }
      }
      if (Array.isArray(trail.gpxTrack)) {
        for (const [lat, lng] of trail.gpxTrack) {
          assert.ok(lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110, `${trail.id} gpxTrack point outside Vietnam`);
        }
      }
    }

    assert.ok(VIETNAM_RANGER_STATIONS.length >= 28);
    assert.ok(VIETNAM_SUMMIT_CHALLENGES.length >= 10);
    assert.ok(VERIFIED_GUIDES_EXTENDED.length >= 10);

    for (const station of VIETNAM_RANGER_STATIONS) {
      assert.ok(
        station.coordinates.lat >= 8 &&
          station.coordinates.lat <= 24 &&
          station.coordinates.lng >= 102 &&
          station.coordinates.lng <= 110,
        `Ranger station ${station.slug} coordinates outside Vietnam`
      );
    }

    for (const challenge of VIETNAM_SUMMIT_CHALLENGES) {
      assert.match(challenge.coverImage, /^\/covers\/[a-z0-9-]+\.svg$/i);
    }

    // Zero banned copyrighted URLs, dead third-party Cloudinary buckets, or stale unverified hotlines
    const combinedDataFiles = `${seedRaw}\n${directoryRaw}\n${knowledgeRaw}`;
    assert.doesNotMatch(combinedDataFiles, /res\.cloudinary\.com\/dsxbuk4pe/i, 'Must contain ZERO res.cloudinary.com/dsxbuk4pe URLs');
    assert.doesNotMatch(combinedDataFiles, /images\.unsplash\.com/i, 'Must contain ZERO images.unsplash.com URLs');
    assert.doesNotMatch(combinedDataFiles, /0988\.945\.236/, 'Must contain ZERO stale 0988.945.236 hotline occurrences');
  });

  it('enforces life-safety Central Vietnam storm-season accuracy, dry-trail water truth, Top-10 peaks & zero Open-Meteo/ERA5 in trekkerKnowledgeDataset', () => {
    assert.ok(masterKnowledgeDataset.length >= 200, 'Expected full Master Knowledge Dataset');

    // 1. Central Vietnam trails MUST NEVER advise trekking in inverted Oct-Dec storm months
    const centralTrailIds = ['trail-bachma', 'trail-giengtroi', 'trail-thack50', 'trail-muidoi'];
    for (const trailId of centralTrailIds) {
      const canonical = mockTrails.find((t) => t.id === trailId);
      assert.ok(canonical, `Missing canonical trail ${trailId}`);

      const seasonEntry = masterKnowledgeDataset.find(
        (item) => item.trailId === trailId && item.id.endsWith('-season-cloud')
      );
      assert.ok(seasonEntry, `Missing season knowledge entry for ${trailId}`);

      // Must NOT recommend North Vietnam winter window (Tháng 10 – Tháng 4 / Tháng 11 – Tháng 4)
      assert.doesNotMatch(
        seasonEntry.answer,
        /Mùa (?:đẹp nhất|thuận lợi|khô thuận lợi) \(Tháng (?:10|11|12)/i,
        `${trailId} must NEVER advise Central Vietnam storm months (Oct–Dec) as best season`
      );
      // Must explicitly warn about Central Vietnam storm / flood avoidance months
      assert.match(
        seasonEntry.answer,
        /Mùa cần tránh \(Tháng (?:9|10) – Tháng (?:11|12)\)/i,
        `${trailId} must explicitly warn against storm/flood avoidMonths`
      );
    }

    // 2. trail-muidoi (hasWaterSource: false) MUST NEVER affirmatively claim natural stream water ("suối tự nhiên")
    const muiDoiTrail = mockTrails.find((t) => t.id === 'trail-muidoi');
    assert.equal(muiDoiTrail?.hasWaterSource, false);

    const muiDoiWaterEntry = masterKnowledgeDataset.find(
      (item) => item.trailId === 'trail-muidoi' && item.id.endsWith('-water-shelters')
    );
    assert.ok(muiDoiWaterEntry, 'Missing trail-muidoi water/shelters knowledge entry');
    assert.match(
      muiDoiWaterEntry.answer,
      /KHÔNG CÓ nguồn nước suối tự nhiên/i,
      'trail-muidoi MUST explicitly warn that there is NO natural stream water along the route'
    );
    assert.doesNotMatch(
      muiDoiWaterEntry.answer,
      /Có điểm lấy nước suối|(?<!KHÔNG\s+CÓ\s+nguồn\s+nước\s+)suối tự nhiên/i,
      'trail-muidoi MUST NEVER affirmatively claim natural stream water'
    );

    // Also enforce across ALL trails marked hasWaterSource === false in seedData
    for (const dryTrail of mockTrails.filter((t) => t.hasWaterSource === false)) {
      const entry = masterKnowledgeDataset.find(
        (item) => item.trailId === dryTrail.id && item.id.endsWith('-water-shelters')
      );
      assert.ok(entry, `Missing water knowledge entry for dry trail ${dryTrail.id}`);
      assert.match(entry.answer, /KHÔNG CÓ/i, `${dryTrail.id} must warn about lack of water`);
      assert.doesNotMatch(entry.answer, /Có điểm lấy nước suối/i, `${dryTrail.id} must never claim stream water exists`);
    }

    // 3. Top 10 Vietnam peaks knowledge includes Tả Liên Sơn (2.996m) and Nam Kang Ho Tao (2.881m)
    const top10Entry = masterKnowledgeDataset.find((item) => item.id === 'tech-top10-vietnam-peaks-matrix');
    assert.ok(top10Entry, 'Missing tech-top10-vietnam-peaks-matrix entry');
    assert.match(top10Entry.answer, /Tả Liên Sơn/i);
    assert.match(top10Entry.answer, /2\.?996/);
    assert.match(top10Entry.answer, /Nam Kang Ho Tao/i);
    assert.match(top10Entry.answer, /2\.?881/);

    // 4. ZERO mentions of Open-Meteo or ERA5 across entire generated knowledge dataset
    for (const item of masterKnowledgeDataset) {
      const blob = `${item.question}\n${item.answer}\n${item.keywords.join(' ')}\n${item.sourceOrHotline || ''}`;
      assert.doesNotMatch(blob, /open-?meteo/i, `Knowledge item ${item.id} must not mention Open-Meteo`);
      assert.doesNotMatch(blob, /\bera5\b/i, `Knowledge item ${item.id} must not mention ERA5`);
    }
  });
});

// ============================================================================
// 5. Client / Server Data Byte-for-Byte Parity
// ============================================================================

describe('5. Client / Server Data Parity (Byte-for-Byte & SHA-256)', () => {
  const parityFiles = ['seedData.ts', 'vietnamDirectory.ts'] as const;

  for (const filename of parityFiles) {
    it(`verifies client/src/data/${filename} === server/src/data/${filename} byte-for-byte`, () => {
      const clientPath = path.join(REPO_ROOT, 'client', 'src', 'data', filename);
      const serverPath = path.join(REPO_ROOT, 'server', 'src', 'data', filename);

      assert.ok(fs.existsSync(clientPath), `Missing client file: ${clientPath}`);
      assert.ok(fs.existsSync(serverPath), `Missing server file: ${serverPath}`);

      const clientBuf = fs.readFileSync(clientPath);
      const serverBuf = fs.readFileSync(serverPath);

      const clientSha = crypto.createHash('sha256').update(clientBuf).digest('hex');
      const serverSha = crypto.createHash('sha256').update(serverBuf).digest('hex');

      assert.equal(clientSha, serverSha, `SHA-256 mismatch for ${filename}: client=${clientSha} vs server=${serverSha}`);
      assert.equal(Buffer.compare(clientBuf, serverBuf), 0, `Byte-for-byte mismatch for ${filename}`);
    });
  }
});
