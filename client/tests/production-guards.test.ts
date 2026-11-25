import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  sendAiMessage,
  removeEmojis,
  computeOfflineReadinessAudit,
} from '../src/services/aiAssistant.service.js';
import type { RichAiAction } from '../src/components/ai-assistant/ai.types.js';
import {
  FREE_BASEMAPS,
  FREE_BASEMAP_ORDER,
  OPENFREEMAP_LIBERTY_STYLE_URL,
  OPENFREEMAP_POSITRON_STYLE_URL,
  OPENFREEMAP_BRIGHT_STYLE_URL,
  OPENFREEMAP_GLYPHS_URL,
  AWS_TERRARIUM_TILE_URL,
  NASA_GIBS_BLUE_MARBLE_URL,
  NASA_GIBS_VIIRS_URL,
  buildOfflineTerrariumReliefStyle,
  buildSatelliteMapStyle,
  decodeTerrariumRgbMeters,
} from '../src/utils/mapTiles.js';
import { buildOfflineTileUrls, buildOfflineSosSmsUri } from '../src/utils/geoMath.js';
import { parseGpxXml, exportGpxXml, computeRouteMetrics } from '../src/utils/routeMetrics.js';
import { parseGpxFileClient, computeClientBioMetrics } from '../src/utils/gpxParser.js';
import {
  DEFAULT_AVATAR_URL,
  getTrekkerAvatarSvg,
  getParkEmblemSvg,
} from '../src/utils/avatarSvg.js';
import {
  DEFAULT_TRAIL_COVER,
  KNOWN_TRAIL_COVER_SLUGS,
  getTrailCoverUrl,
  getTrailGalleryUrls,
} from '../src/utils/trailCovers.js';
import { mockTrails, mockUsers, mockGuides } from '../src/data/seedData.js';
import {
  calculateWindChillC,
  classifyColdRisk,
  calculateHeatIndexC,
  classifyHeatRisk,
  calculateTurnaroundTime,
  formatMinutesToHHMM,
  encodePlusCode,
} from '../src/utils/mountainSafetyMath.js';
import { resolveAppRoute } from '../src/utils/routing.js';
import { fetchWithTimeout } from '../src/utils/sessionHeaders.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT_DIR = path.resolve(__dirname, '..');
const CLIENT_PUBLIC_DIR = path.resolve(CLIENT_ROOT_DIR, 'public');
const CLIENT_SRC_DIR = path.resolve(CLIENT_ROOT_DIR, 'src');

// ============================================================================
// DETERMINISTIC TEST HELPERS (RESTORED IN FINALLY — ZERO GLOBAL LEAKS)
// ============================================================================

async function withOfflineAi<T>(fn: () => Promise<T>): Promise<T> {
  const prevFetch = globalThis.fetch;
  const prevWarn = console.warn;

  globalThis.fetch = (async () => {
    throw new TypeError('Offline mountain signal (simulated in production-guards.test.ts)');
  }) as typeof fetch;
  console.warn = () => {
    // Silence expected offline-engine fallback notice during tests
  };

  try {
    return await fn();
  } finally {
    globalThis.fetch = prevFetch;
    console.warn = prevWarn;
  }
}

function findFirstAidAction(actions: RichAiAction[] | undefined) {
  const hit = (actions || []).find((a) => a.type === 'first_aid_triage');
  return hit && hit.type === 'first_aid_triage' ? hit.triageData : null;
}

interface MiniXmlElement {
  readonly tagName: string;
  readonly localName: string;
  readonly attributes: Map<string, string>;
  readonly children: MiniXmlElement[];
  textParts: string[];
  getAttribute(name: string): string | null;
  getElementsByTagName(tag: string): MiniXmlElement[];
  getElementsByTagNameNS(ns: string, local: string): MiniXmlElement[];
  querySelector(selector: string): MiniXmlElement | null;
  readonly textContent: string;
}

function unescapeXmlEntities(raw: string): string {
  return raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function createMiniXmlElement(tagName: string, attributes: Map<string, string>): MiniXmlElement {
  const colonIdx = tagName.indexOf(':');
  const localName = colonIdx >= 0 ? tagName.slice(colonIdx + 1) : tagName;
  const children: MiniXmlElement[] = [];
  const textParts: string[] = [];

  const collect = (
    node: MiniXmlElement,
    predicate: (candidate: MiniXmlElement) => boolean,
    out: MiniXmlElement[]
  ) => {
    for (const child of node.children) {
      if (predicate(child)) out.push(child);
      collect(child, predicate, out);
    }
  };

  const element: MiniXmlElement = {
    tagName,
    localName,
    attributes,
    children,
    textParts,
    getAttribute(name: string) {
      return attributes.has(name) ? attributes.get(name)! : null;
    },
    getElementsByTagName(tag: string) {
      const out: MiniXmlElement[] = [];
      collect(element, (c) => tag === '*' || c.tagName === tag, out);
      return out;
    },
    getElementsByTagNameNS(_ns: string, local: string) {
      const out: MiniXmlElement[] = [];
      collect(element, (c) => local === '*' || c.localName === local, out);
      return out;
    },
    querySelector(selector: string) {
      const hits = element.getElementsByTagName(selector);
      return hits[0] ?? null;
    },
    get textContent(): string {
      return textParts.join('') + children.map((c) => c.textContent).join('');
    },
  };
  return element;
}

function parseMiniXml(xmlText: string): MiniXmlElement {
  const root = createMiniXmlElement('#document', new Map());
  const cleaned = xmlText
    .replace(/^\uFEFF/, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  const makeParserErrorDoc = (reason: string): MiniXmlElement => {
    const errDoc = createMiniXmlElement('#document', new Map());
    const errEl = createMiniXmlElement('parsererror', new Map());
    errEl.textParts.push(reason);
    errDoc.children.push(errEl);
    return errDoc;
  };

  if (!cleaned.startsWith('<')) {
    return makeParserErrorDoc('XML must start with <');
  }

  const stack: MiniXmlElement[] = [root];
  const tokenRe = /<(\/)?([A-Za-z_][\w:.-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/)?>|([^<]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(cleaned)) !== null) {
    if (match.index !== lastIndex) {
      return makeParserErrorDoc(`Malformed token near offset ${lastIndex}`);
    }
    lastIndex = tokenRe.lastIndex;

    const [, isClosing, tagName, attrChunk, isSelfClosing, textChunk] = match;
    const current = stack[stack.length - 1];

    if (textChunk !== undefined) {
      if (stack.length > 1) {
        current.textParts.push(unescapeXmlEntities(textChunk));
      } else if (textChunk.trim().length > 0) {
        return makeParserErrorDoc('Unexpected root text');
      }
      continue;
    }

    if (isClosing) {
      if (stack.length <= 1 || current.tagName !== tagName) {
        return makeParserErrorDoc(`Mismatched closing tag </${tagName}>`);
      }
      stack.pop();
      continue;
    }

    const attrs = new Map<string, string>();
    const attrRe = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRe.exec(attrChunk || '')) !== null) {
      attrs.set(attrMatch[1], unescapeXmlEntities(attrMatch[2] ?? attrMatch[3] ?? ''));
    }

    const el = createMiniXmlElement(tagName, attrs);
    current.children.push(el);
    if (!isSelfClosing) {
      stack.push(el);
    }
  }

  if (lastIndex !== cleaned.length || stack.length !== 1 || root.children.length === 0) {
    return makeParserErrorDoc('Unclosed XML element');
  }

  return root;
}

class TestXmlDOMParser {
  parseFromString(xmlText: string): MiniXmlElement {
    return parseMiniXml(xmlText);
  }
}

async function withXmlDomParser<T>(fn: () => T | Promise<T>): Promise<T> {
  const g = globalThis as unknown as { DOMParser?: unknown };
  const prev = g.DOMParser;
  g.DOMParser = TestXmlDOMParser;
  try {
    return await fn();
  } finally {
    if (prev === undefined) {
      delete g.DOMParser;
    } else {
      g.DOMParser = prev;
    }
  }
}

function encodeTerrariumElevationRgb(meters: number): [number, number, number] {
  const shifted = meters + 32768;
  const r = Math.floor(shifted / 256);
  const g = Math.floor(shifted - r * 256);
  const b = Math.round((shifted - r * 256 - g) * 256);
  return [r, g, b];
}

// ============================================================================
// 1. OFFLINE WFA MEDICAL TRIAGE SAFETY
// ============================================================================

describe('1. Offline WFA Medical Triage Safety (aiAssistant.service.ts)', () => {
  it('returns heatstroke cooling & evacuation guidance and NEVER advises keeping warm ("Giữ ấm")', async () => {
    await withOfflineAi(async () => {
      const res = await sendAiMessage({ message: 'bị sốc nhiệt say nắng giữa trưa' });
      const triage = findFirstAidAction(res.actions);

      assert.ok(triage, 'Must return a first_aid_triage action offline');
      assert.equal(triage.conditionCode, 'WFA-HEAT');
      assert.equal(triage.severity, 'critical');

      const stepsText = triage.immediateSteps.join(' ').toLowerCase();
      assert.match(stepsText, /làm mát|khăn ướt mát|bóng râm/, 'Must instruct active cooling');
      assert.doesNotMatch(stepsText, /giữ ấm|ủ ấm/, 'Immediate steps MUST NEVER tell a heatstroke victim to keep warm');
      assert.doesNotMatch(res.reply.toLowerCase(), /giữ ấm|ủ ấm/, 'Reply MUST NEVER advise warming a heatstroke victim');

      const forbiddenText = triage.forbiddenActions.join(' ').toLowerCase();
      assert.match(forbiddenText, /không.*ủ ấm|không.*giữ nhiệt/, 'Forbidden actions must warn against warming');

      assert.ok(triage.whenToEvacuate.length >= 1, 'Must provide whenToEvacuate triggers');
      assert.match(triage.whenToEvacuate.join(' '), /115|112/, 'Evacuation guidance must cite 115 / 112');
      assert.equal(triage.emergencyContacts[0]?.dialNumber, '112', 'National 112 must stay #1 emergency contact');
      assert.equal(res.reply, removeEmojis(res.reply), 'Reply must contain zero emojis');
    });
  });

  it('returns hypothermia warming & wind-shelter guidance for shivering cold exposure', async () => {
    await withOfflineAi(async () => {
      const res = await sendAiMessage({ message: 'bị hạ thân nhiệt run lẩy bẩy' });
      const triage = findFirstAidAction(res.actions);

      assert.ok(triage, 'Must return a first_aid_triage action offline');
      assert.equal(triage.conditionCode, 'WFA-HYPO');
      assert.match(triage.immediateSteps.join(' ').toLowerCase(), /ủ ấm|đồ khô|kín gió/);
      assert.match(triage.forbiddenActions.join(' ').toLowerCase(), /không chà xát|không.*rượu/);
      assert.ok(triage.whenToEvacuate.length >= 1, 'Must provide hypothermia evacuation red flags');
    });
  });

  it('returns fracture immobilization & evacuation guidance for leg fracture on mountain trail', async () => {
    await withOfflineAi(async () => {
      const res = await sendAiMessage({ message: 'bị gãy xương chân khi leo núi' });
      const triage = findFirstAidAction(res.actions);

      assert.ok(triage, 'Must return a first_aid_triage action offline');
      assert.equal(triage.conditionCode, 'WFA-TRAUMA');
      assert.match(triage.immediateSteps.join(' ').toLowerCase(), /cố định|nẹp/);
      assert.match(triage.forbiddenActions.join(' ').toLowerCase(), /không.*nắn|không.*đi tiếp/);
      assert.ok(triage.whenToEvacuate.length >= 1, 'Must provide fracture evacuation triggers');
    });
  });

  it('returns snakebite immobilization guidance and STRICTLY forbids cutting or sucking the wound', async () => {
    await withOfflineAi(async () => {
      const res = await sendAiMessage({ message: 'bị rắn cắn trên đường mòn' });
      const triage = findFirstAidAction(res.actions);

      assert.ok(triage, 'Must return a first_aid_triage action offline');
      assert.equal(triage.conditionCode, 'WFA-SNAKE');
      assert.match(triage.immediateSteps.join(' ').toLowerCase(), /cố định|nằm yên|thấp hơn mức tim/);
      assert.match(triage.forbiddenActions.join(' ').toLowerCase(), /rạch/);
      assert.match(triage.forbiddenActions.join(' ').toLowerCase(), /hút nọc/);
      assert.ok(triage.whenToEvacuate.length >= 1, 'Every snakebite must mandate immediate medical evacuation');
    });
  });

  it('returns AMS immediate descent guidance for high-altitude headache & nausea at 3000m', async () => {
    await withOfflineAi(async () => {
      const res = await sendAiMessage({ message: 'đau đầu buồn nôn ở độ cao 3000m' });
      const triage = findFirstAidAction(res.actions);

      assert.ok(triage, 'Must recognize AMS symptom query offline and return first_aid_triage');
      assert.equal(triage.conditionCode, 'WFA-AMS');
      assert.match(triage.immediateSteps.join(' ').toLowerCase(), /hạ độ cao/);
      assert.match(triage.forbiddenActions.join(' ').toLowerCase(), /không.*leo lên cao hơn/);
      assert.ok(triage.whenToEvacuate.length >= 1, 'Must include HACE/HAPE evacuation triggers');

      // Direct Vietnamese AMS synonym ("say độ cao") also triggers WFA-AMS
      const synRes = await sendAiMessage({ message: 'bị say độ cao khi leo Fansipan' });
      assert.equal(findFirstAidAction(synRes.actions)?.conditionCode, 'WFA-AMS');

      // Non-medical altitude question must NOT falsely trigger WFA triage
      const benignRes = await sendAiMessage({ message: 'đỉnh Fansipan 3143m có đẹp không' });
      assert.equal(findFirstAidAction(benignRes.actions), null, 'Benign peak question must not false-trigger SOS triage');
    });
  });
});

// ============================================================================
// 2. FREE-COMMERCIAL MAP, OFFLINE TILES, TERRARIUM DEM & GPX METRICS
// ============================================================================

describe('2. Free-Commercial Map, Offline Tiles, Terrarium DEM & GPX Route Metrics', () => {
  const BANNED_TILE_HOSTS = [
    'open-meteo',
    'arcgisonline',
    'opentopomap',
    'tile.openstreetmap.org',
    'cartocdn',
  ];

  it('FREE_BASEMAPS and map constants contain ZERO banned tile hosts and preserve legal attributions', () => {
    assert.deepEqual(FREE_BASEMAP_ORDER, ['topo', 'standard', 'satellite']);

    const allUrls = [
      OPENFREEMAP_LIBERTY_STYLE_URL,
      OPENFREEMAP_POSITRON_STYLE_URL,
      OPENFREEMAP_BRIGHT_STYLE_URL,
      OPENFREEMAP_GLYPHS_URL,
      AWS_TERRARIUM_TILE_URL,
      NASA_GIBS_BLUE_MARBLE_URL,
      NASA_GIBS_VIIRS_URL,
      ...Object.values(FREE_BASEMAPS).flatMap((b) => [b.url, b.fallbackUrl || '']),
    ];

    for (const url of allUrls) {
      const lower = url.toLowerCase();
      for (const banned of BANNED_TILE_HOSTS) {
        assert.equal(
          lower.includes(banned),
          false,
          `Map URL "${url}" must never reference banned commercial/rate-limited host "${banned}"`
        );
      }
    }

    // Legal attribution assertions (ODbL, AWS Open Data, NASA GIBS)
    assert.match(FREE_BASEMAPS.standard.attribution, /OpenStreetMap.*ODbL/i);
    assert.match(FREE_BASEMAPS.topo.attribution, /OpenStreetMap.*ODbL/i);
    assert.match(FREE_BASEMAPS.topo.attribution, /AWS Open Data/i);
    assert.match(FREE_BASEMAPS.topo.attribution, /Mapzen\/Tilezen/i);
    assert.match(FREE_BASEMAPS.satellite.attribution, /NASA GIBS/i);
    assert.match(FREE_BASEMAPS.satellite.attribution, /Public Domain/i);
  });

  it('buildOfflineTerrariumReliefStyle({ enable3DTerrain: true }) builds valid MapLibre v8 Terrarium style with attribution', () => {
    const style3D = buildOfflineTerrariumReliefStyle({ enable3DTerrain: true, exaggeration: 1.5 });

    assert.equal(style3D.version, 8);
    assert.ok(style3D.sources, 'Style must include sources');
    assert.ok(Array.isArray(style3D.layers) && style3D.layers.length >= 2, 'Style must include background + hillshade layers');

    const hillshadeSrc = style3D.sources.awsHillshadeDem;
    const terrainSrc = style3D.sources.awsTerrainDem;
    assert.ok(hillshadeSrc && hillshadeSrc.type === 'raster-dem', 'awsHillshadeDem must be raster-dem');
    assert.ok(terrainSrc && terrainSrc.type === 'raster-dem', 'awsTerrainDem must be raster-dem when 3D enabled');
    assert.equal(hillshadeSrc.encoding, 'terrarium');
    assert.equal(terrainSrc.encoding, 'terrarium');
    assert.ok(
      hillshadeSrc.tiles?.some((t) => t.includes('s3.amazonaws.com/elevation-tiles-prod/terrarium')),
      'Hillshade DEM tiles must point to AWS Open Data Terrarium'
    );
    assert.ok(
      terrainSrc.tiles?.some((t) => t.includes('s3.amazonaws.com/elevation-tiles-prod/terrarium')),
      '3D terrain DEM tiles must point to AWS Open Data Terrarium'
    );
    assert.match(String(hillshadeSrc.attribution || ''), /AWS Open Data/i);
    assert.match(String(terrainSrc.attribution || ''), /AWS Open Data/i);
    assert.deepEqual(style3D.terrain, { source: 'awsTerrainDem', exaggeration: 1.5 });
    assert.ok(
      style3D.layers.some((l) => l.type === 'hillshade' && l.source === 'awsHillshadeDem'),
      'Style must wire native GPU hillshade layer to awsHillshadeDem'
    );

    const style2D = buildOfflineTerrariumReliefStyle({ enable3DTerrain: false });
    assert.equal(style2D.terrain, undefined, '2D offline relief must omit 3D terrain mesh');

    const sat3D = buildSatelliteMapStyle({ enable3DTerrain: true });
    assert.equal(sat3D.version, 8);
    const serialized = JSON.stringify({ style3D, sat3D }).toLowerCase();
    for (const banned of BANNED_TILE_HOSTS) {
      assert.equal(serialized.includes(banned), false, `Serialized MapLibre style must never contain "${banned}"`);
    }
  });

  it('decodeTerrariumRgbMeters decodes sea level (0m), Fansipan (~3143m), and sub-sea elevations accurately', () => {
    assert.equal(decodeTerrariumRgbMeters(128, 0, 0), 0, '(128,0,0) must decode to exact 0m sea level');

    // Fansipan summit (3,143m exact & 3,143.4m fractional round-trip)
    assert.equal(decodeTerrariumRgbMeters(140, 71, 0), 3143);
    const [rFan, gFan, bFan] = encodeTerrariumElevationRgb(3143.4);
    const decodedFan = decodeTerrariumRgbMeters(rFan, gFan, bFan);
    assert.ok(
      Math.abs(decodedFan - 3143.4) < 0.005,
      `Fansipan 3143.4m round-trip must be within 0.005m, got ${decodedFan}`
    );

    // Below sea level (-10m) & diverse Vietnam summit heights
    assert.equal(decodeTerrariumRgbMeters(127, 246, 0), -10);
    for (const sampleEle of [0, 125.5, 986.2, 1650, 2442.75, 2996.1, 3143]) {
      const [r, g, b] = encodeTerrariumElevationRgb(sampleEle);
      const decoded = decodeTerrariumRgbMeters(r, g, b);
      assert.ok(Math.abs(decoded - sampleEle) < 0.01, `Round-trip failed for ${sampleEle}m (got ${decoded}m)`);
    }
  });

  it('buildOfflineTileUrls and buildOfflineSosSmsUri stay strictly AWS Terrarium & GSM-7 ASCII', () => {
    const fansipanTrack: [number, number][] = [
      [22.3506, 103.7717],
      [22.3285, 103.7745],
      [22.3033, 103.7751],
    ];
    const urls = buildOfflineTileUrls(fansipanTrack, [10, 11, 12], 40);
    assert.ok(urls.length > 0 && urls.length <= 40, `Expected 1..40 offline tiles, got ${urls.length}`);
    for (const url of urls) {
      assert.ok(
        url.startsWith('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/'),
        `Offline tile URL must use AWS Open Data Terrarium: ${url}`
      );
      for (const banned of BANNED_TILE_HOSTS) {
        assert.equal(url.toLowerCase().includes(banned), false);
      }
    }

    const sms = buildOfflineSosSmsUri({
      phone: '02143.871.494',
      trailName: 'Đỉnh Fansipan - Trạm Tôn',
      lat: 22.3033,
      lng: 103.7751,
      altitudeM: 3143,
      note: 'Hạ thân nhiệt nhẹ, cần hỗ trợ',
    });
    assert.ok(sms.uri.startsWith('sms:02143871494?body=') || sms.uri.startsWith('sms:02143871494&body='));
    assert.match(sms.body, /^[\x20-\x7E\n]+$/, 'Offline 2G SOS SMS body must remain strict 7-bit GSM-7 ASCII');
    assert.match(sms.body, /22\.303300, 103\.775100/);
    assert.match(sms.body, /3143m/);
  });

  it('parseGpxXml parses <trkpt>, <rtept>, and <wpt> cleanly and computeRouteMetrics enforces 2m-hysteresis gain', async () => {
    await withXmlDomParser(async () => {
      // 1. Track (<trkpt>) + Waypoints (<wpt>) + export round-trip
      const trkGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LOST Test" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Fansipan Trạm Tôn Test</name></metadata>
  <wpt lat="22.350600" lon="103.771700"><ele>1900</ele><name>Cửa rừng Trạm Tôn</name><type>start</type></wpt>
  <wpt lat="22.318000" lon="103.774000"><ele>2800</ele><name>Lán nghỉ 2800m</name><type>camp</type></wpt>
  <wpt lat="22.303300" lon="103.775100"><ele>3143</ele><name>Đỉnh Fansipan</name><type>peak</type></wpt>
  <trk>
    <name>Fansipan Trạm Tôn Test</name>
    <trkseg>
      <trkpt lat="22.350600" lon="103.771700"><ele>1900</ele></trkpt>
      <trkpt lat="22.338000" lon="103.772800"><ele>2200</ele></trkpt>
      <trkpt lat="22.326000" lon="103.773600"><ele>2500</ele></trkpt>
      <trkpt lat="22.318000" lon="103.774000"><ele>2800</ele></trkpt>
      <trkpt lat="22.303300" lon="103.775100"><ele>3143</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

      const parsedTrk = parseGpxXml(trkGpx);
      assert.equal(parsedTrk.title, 'Fansipan Trạm Tôn Test');
      assert.equal(parsedTrk.vertices.length, 5);
      assert.equal(parsedTrk.hasElevation, true);
      assert.equal(parsedTrk.waypoints.length, 3);
      assert.deepEqual(
        parsedTrk.waypoints.map((w) => w.type),
        ['start', 'camp', 'peak']
      );

      // Export & re-parse round-trip
      const exported = exportGpxXml({
        title: parsedTrk.title,
        vertices: parsedTrk.vertices,
        waypoints: parsedTrk.waypoints,
      });
      const reparsed = parseGpxXml(exported);
      assert.equal(reparsed.vertices.length, parsedTrk.vertices.length);
      assert.equal(reparsed.waypoints.length, parsedTrk.waypoints.length);

      // Realistic metrics on Fansipan climb (~5.3 km straight-line polyline, +1243m climb)
      const metrics = computeRouteMetrics(parsedTrk.vertices);
      assert.ok(metrics.distanceKm >= 4.5 && metrics.distanceKm <= 6.5, `Unexpected distance ${metrics.distanceKm} km`);
      assert.ok(
        metrics.elevationGainM >= 1200 && metrics.elevationGainM <= 1260,
        `Expected ~1243m smoothed gain, got ${metrics.elevationGainM}m`
      );
      assert.equal(metrics.elevationLossM, 0);
      assert.equal(metrics.minAltitudeM, 1900);
      assert.equal(metrics.maxAltitudeM, 3143);
      assert.equal(
        metrics.slopeBuckets.gentlePercent + metrics.slopeBuckets.moderatePercent + metrics.slopeBuckets.steepPercent,
        100
      );
      assert.ok(metrics.naismithLangmuirHours > 2 && metrics.toblerHours > 2 && metrics.recommendedHours > 2);
      assert.ok(metrics.waterLiters >= 1.5 && metrics.caloriesKcal > 1000);

      // 2m-hysteresis DEM micro-oscillation suppression test (±1m jitter -> 0m fake climb)
      const jitterMetrics = computeRouteMetrics([
        { lat: 22.3500, lng: 103.7700, elevationM: 1500 },
        { lat: 22.3510, lng: 103.7700, elevationM: 1501 },
        { lat: 22.3520, lng: 103.7700, elevationM: 1500 },
        { lat: 22.3530, lng: 103.7700, elevationM: 1501 },
        { lat: 22.3540, lng: 103.7700, elevationM: 1500 },
      ]);
      assert.equal(jitterMetrics.elevationGainM, 0, '2m hysteresis must suppress ±1m micro DEM jitter');
      assert.equal(jitterMetrics.elevationLossM, 0);

      // 2. Route points (<rtept>) GPX
      const rteGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <rte>
    <name>Tà Xùa Sống Lưng</name>
    <rtept lat="21.3100" lon="104.4600"><ele>1700</ele></rtept>
    <rtept lat="21.3200" lon="104.4650"><ele>2150</ele></rtept>
    <rtept lat="21.3300" lon="104.4700"><ele>2650</ele></rtept>
  </rte>
</gpx>`;
      const parsedRte = parseGpxXml(rteGpx);
      assert.equal(parsedRte.vertices.length, 3);
      assert.equal(parsedRte.hasElevation, true);

      // 3. Waypoint-only (<wpt>) GPX fallback
      const wptOnlyGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="11.5500" lon="108.5000"><ele>950</ele><name>Cửa rừng Tà Năng</name></wpt>
  <wpt lat="11.5300" lon="108.5200"><ele>1100</ele><name>Đồi Lính</name></wpt>
  <wpt lat="11.5000" lon="108.5500"><ele>620</ele><name>Suối Yavly</name></wpt>
</gpx>`;
      const parsedWpt = parseGpxXml(wptOnlyGpx);
      assert.equal(parsedWpt.vertices.length, 3);
      assert.equal(parsedWpt.waypoints.length, 3);
      assert.equal(parsedWpt.waypoints[2].type, 'water');

      // 4. Malformed / invalid GPX rejection
      assert.throws(() => parseGpxXml('<html>not a gpx</html>'));
      assert.throws(() => parseGpxXml('<gpx><trk><trkseg><trkpt lat="22.3" lon="103.7"></trkseg></gpx>'));

      // 5. Client GPX File parser + Bio-Calculator (gpxParser.ts)
      const syntheticFile = {
        name: 'fansipan-test.gpx',
        size: Buffer.byteLength(trkGpx, 'utf8'),
        text: async () => trkGpx,
      } as unknown as File;
      const clientParsed = await parseGpxFileClient(syntheticFile);
      assert.equal(clientParsed.points.length, 5);
      assert.equal(clientParsed.hasElevation, true);
      assert.equal(clientParsed.offlineAnalysis.maxAltitudeM, 3143);
      assert.ok(clientParsed.offlineAnalysis.elevationGainM >= 1200);

      const bio = computeClientBioMetrics({
        trailName: 'Fansipan',
        distanceKm: 19.5,
        elevationGainM: 1450,
        maxAltitudeM: 3143,
        bodyWeightKg: 65,
        packWeightKg: 10,
        fitnessLevel: 'intermediate',
        durationDays: 2,
      });
      assert.equal(bio.amsRiskLevel, 'high');
      assert.equal(bio.packStatus, 'optimal');
      assert.ok(bio.waterLitersTotal >= 3 && bio.oresolPackets >= 2);
    });
  });
});

// ============================================================================
// 3. PROCEDURAL ORIGINAL SVG COVERS & AVATARS (ZERO EXTERNAL ASSETS / XSS SAFE)
// ============================================================================

describe('3. Procedural Original SVG Covers & Avatars (seedData.ts, trailCovers.ts, avatarSvg.ts)', () => {
  const BANNED_IMAGE_PATTERNS = [
    'cloudinary',
    'unsplash',
    'pexels',
    'pixabay',
    'shutterstock',
    'dicebear',
    'ui-avatars',
    'gravatar',
  ];

  it('all 36 mockTrails point to existing local /covers/*.svg files with valid <svg> and ZERO banned stock/Cloudinary URLs', () => {
    assert.equal(mockTrails.length, 36, `Expected 36 Vietnam trails, got ${mockTrails.length}`);
    assert.equal(KNOWN_TRAIL_COVER_SLUGS.size, 36);

    const checkedFiles = new Set<string>();
    const verifyLocalSvgAsset = (url: string, contextLabel: string) => {
      assert.ok(url.startsWith('/covers/') && url.endsWith('.svg'), `${contextLabel} must use local /covers/*.svg, got "${url}"`);
      const lowerUrl = url.toLowerCase();
      for (const banned of BANNED_IMAGE_PATTERNS) {
        assert.equal(lowerUrl.includes(banned), false, `${contextLabel} URL must not reference "${banned}"`);
      }

      const relPath = url.replace(/^\//, '');
      const absPath = path.join(CLIENT_PUBLIC_DIR, relPath);
      assert.equal(fs.existsSync(absPath), true, `${contextLabel} missing on disk: ${absPath}`);

      if (!checkedFiles.has(absPath)) {
        checkedFiles.add(absPath);
        const content = fs.readFileSync(absPath, 'utf8');
        assert.ok(content.includes('<svg') && content.includes('</svg>'), `${absPath} must contain valid <svg> markup`);
        const lowerContent = content.toLowerCase();
        for (const banned of BANNED_IMAGE_PATTERNS) {
          assert.equal(lowerContent.includes(banned), false, `${absPath} must not embed "${banned}"`);
        }
        const strippedXmlns = lowerContent.replace(/https?:\/\/www\.w3\.org\/(?:2000\/svg|1999\/xlink)/g, '');
        assert.equal(
          /https?:\/\//i.test(strippedXmlns),
          false,
          `${absPath} must contain zero external network URLs`
        );
      }
    };

    for (const trail of mockTrails) {
      assert.equal(KNOWN_TRAIL_COVER_SLUGS.has(trail.id), true, `Missing trail slug in KNOWN_TRAIL_COVER_SLUGS: ${trail.id}`);
      assert.equal(getTrailCoverUrl(trail.id), `/covers/${trail.id}.svg`);
      verifyLocalSvgAsset(trail.coverImage, `${trail.id}.coverImage`);

      const [ridgeUrl, topoUrl] = getTrailGalleryUrls(trail.id);
      verifyLocalSvgAsset(ridgeUrl, `${trail.id}.gallery[ridge]`);
      verifyLocalSvgAsset(topoUrl, `${trail.id}.gallery[topo]`);
      for (const gUrl of trail.gallery || []) {
        verifyLocalSvgAsset(gUrl, `${trail.id}.gallery`);
      }
    }

    // Verify default cover, default avatar, and seeded user/guide local SVG assets too
    verifyLocalSvgAsset(DEFAULT_TRAIL_COVER, 'DEFAULT_TRAIL_COVER');
    verifyLocalSvgAsset(DEFAULT_AVATAR_URL, 'DEFAULT_AVATAR_URL');
    assert.equal(getTrailCoverUrl('unknown-slug'), DEFAULT_TRAIL_COVER);

    for (const u of mockUsers) {
      if (u.avatarUrl) verifyLocalSvgAsset(u.avatarUrl, `mockUser(${u.id}).avatarUrl`);
    }
    for (const g of mockGuides) {
      if (g.avatarUrl) verifyLocalSvgAsset(g.avatarUrl, `mockGuide(${g.id}).avatarUrl`);
    }
  });

  it('getTrekkerAvatarSvg and getParkEmblemSvg emit offline SVG data URIs with zero external URLs and safe XSS escaping', () => {
    const xssPayloads = [
      '<script>alert(1)</script>',
      '"><img src=x onerror=alert(1)>',
      'Nguyễn <svg onload=alert(1)> Hoàng & "Trek"',
      "VQG <script>fetch('https://evil.test')</script> BTTN",
    ];

    const assertSafeSvgDataUri = (dataUri: string, label: string) => {
      assert.ok(
        dataUri.startsWith('data:image/svg+xml;charset=UTF-8,'),
        `${label} must be a UTF-8 SVG data URI`
      );
      const decoded = decodeURIComponent(dataUri.slice('data:image/svg+xml;charset=UTF-8,'.length));
      assert.ok(decoded.startsWith('<svg ') && decoded.endsWith('</svg>'), `${label} must decode to valid <svg>...</svg>`);

      const withoutXmlns = decoded.replace(/https?:\/\/www\.w3\.org\/2000\/svg/gi, '');
      assert.equal(/https?:\/\//i.test(withoutXmlns), false, `${label} must contain zero external network URLs`);
      assert.equal(/<script/i.test(decoded), false, `${label} must never contain <script>`);
      assert.equal(/onerror\s*=|onload\s*=|javascript:/i.test(decoded), false, `${label} must never contain event handlers or javascript: URIs`);
      assert.equal(/<img/i.test(decoded), false, `${label} must never inject raw HTML tags`);
    };

    // Normal Vietnamese trekker & National Park inputs
    assertSafeSvgDataUri(getTrekkerAvatarSvg('Nguyễn Minh Hoàng', 'admin'), 'trekker-admin');
    assertSafeSvgDataUri(getTrekkerAvatarSvg('Trần Bảo Ngọc', 'guide'), 'trekker-guide');
    assertSafeSvgDataUri(getTrekkerAvatarSvg('', undefined), 'trekker-empty');
    assertSafeSvgDataUri(getParkEmblemSvg('VQG Hoàng Liên', 'Miền Bắc'), 'park-vqg');
    assertSafeSvgDataUri(getParkEmblemSvg('Khu BTTN Kon Chư Răng', 'Miền Trung'), 'park-kbt');

    // Deterministic output for identical inputs
    assert.equal(getTrekkerAvatarSvg('Lê Quốc Bảo', 'user'), getTrekkerAvatarSvg('Lê Quốc Bảo', 'user'));
    assert.equal(getParkEmblemSvg('VQG Bidoup - Núi Bà', 'Miền Nam'), getParkEmblemSvg('VQG Bidoup - Núi Bà', 'Miền Nam'));

    // XSS payload resilience
    for (const payload of xssPayloads) {
      assertSafeSvgDataUri(getTrekkerAvatarSvg(payload, 'user'), `trekker-xss(${payload})`);
      assertSafeSvgDataUri(getParkEmblemSvg(payload, 'Miền Bắc'), `park-xss(${payload})`);
    }
  });
});

// ============================================================================
// 4. MOUNTAIN SAFETY MATH (WIND CHILL, HEAT INDEX, TURNAROUND TIME, PLUS CODE)
// ============================================================================

describe('4. Mountain Safety Math (client/src/utils/mountainSafetyMath.ts)', () => {
  it('calculateWindChillC & classifyColdRisk model Fansipan windy dawn (< 0°C) and threshold boundaries', () => {
    const fansipanDawn = calculateWindChillC(2, 35);
    assert.ok(fansipanDawn < 0, `Fansipan windy dawn (2°C, 35 km/h) must feel < 0°C, got ${fansipanDawn}°C`);
    assert.ok(
      Math.abs(fansipanDawn - -4.3) <= 0.15,
      `NWS wind chill for (2°C, 35 km/h) should be ~-4.3°C, got ${fansipanDawn}°C`
    );

    const frostRisk = classifyColdRisk(fansipanDawn);
    assert.equal(frostRisk.level, 'severe_frost');
    assert.ok(frostRisk.guidance.length > 10 && frostRisk.recommendedLayers.length > 10);

    // Outside NWS wind chill applicability range (tempC > 10 or windKmh < 4.8) returns ambient temp
    assert.equal(calculateWindChillC(18, 40), 18);
    assert.equal(calculateWindChillC(2, 3), 2);

    assert.equal(classifyColdRisk(4).level, 'hypothermia_risk');
    assert.equal(classifyColdRisk(11).level, 'chilly');
    assert.equal(classifyColdRisk(20).level, 'normal');
  });

  it('calculateHeatIndexC & classifyHeatRisk model Mũi Đôi summer heatstroke danger (> 45°C)', () => {
    const muiDoiSummer = calculateHeatIndexC(36, 65);
    assert.ok(muiDoiSummer > 45, `Mũi Đôi summer (36°C, 65% RH) heat index must exceed 45°C, got ${muiDoiSummer}°C`);
    assert.ok(
      muiDoiSummer >= 49 && muiDoiSummer <= 53,
      `Rothfusz heat index for (36°C, 65% RH) should be ~51°C, got ${muiDoiSummer}°C`
    );

    const heatRisk = classifyHeatRisk(muiDoiSummer);
    assert.equal(heatRisk.level, 'heatstroke_danger');
    assert.ok(heatRisk.guidance.length > 10 && heatRisk.hydrationNote.length > 5);

    // Below Rothfusz threshold (tempC < 27 or RH < 40) returns ambient temp
    assert.equal(calculateHeatIndexC(22, 85), 22);
    assert.equal(calculateHeatIndexC(34, 25), 34);

    assert.equal(classifyHeatRisk(35).level, 'heat_exhaustion');
    assert.equal(classifyHeatRisk(29).level, 'caution');
    assert.equal(classifyHeatRisk(24).level, 'normal');
  });

  it('calculateTurnaroundTime computes safe, tight, and late daylight turnaround clocks before civil dusk', () => {
    // Safe early start (06:00 start, 18:00 civil dusk, 45m margin, 6km +800m ascent, 6km descent)
    const safePlan = calculateTurnaroundTime({
      startMinutes: 360,
      totalAscentKm: 6,
      ascentGainM: 800,
      descentKm: 6,
      civilDuskMinutes: 1080,
      safetyMarginMinutes: 45,
    });
    assert.equal(safePlan.riskLevel, 'safe');
    assert.equal(safePlan.turnaroundLabel, formatMinutesToHHMM(safePlan.turnaroundMinutes));
    assert.match(safePlan.turnaroundLabel, /^\d{2}:\d{2}$/);
    assert.ok(safePlan.turnaroundMinutes < 1080 - 45, 'Turnaround must precede dusk minus safety margin');
    assert.ok(safePlan.maxAscentHours >= 6, `Expected ample ascent window, got ${safePlan.maxAscentHours}h`);
    assert.equal(safePlan.turnaroundMinutes, 1080 - 45 - safePlan.estimatedDescentMinutes);

    // Tight schedule (start close to turnaround budget)
    const tightStart = safePlan.turnaroundMinutes - Math.round(safePlan.estimatedAscentMinutes * 1.05);
    const tightPlan = calculateTurnaroundTime({
      startMinutes: tightStart,
      totalAscentKm: 6,
      ascentGainM: 800,
      descentKm: 6,
      civilDuskMinutes: 1080,
      safetyMarginMinutes: 45,
    });
    assert.equal(tightPlan.riskLevel, 'tight');

    // Late start on a steep high peak (13:00 start for Fansipan 10km +1243m before 17:30 dusk)
    const latePlan = calculateTurnaroundTime({
      startMinutes: 780,
      totalAscentKm: 10,
      ascentGainM: 1243,
      descentKm: 10,
      civilDuskMinutes: 1050,
      safetyMarginMinutes: 45,
    });
    assert.equal(latePlan.riskLevel, 'late');
    assert.equal(formatMinutesToHHMM(0), '00:00');
    assert.equal(formatMinutesToHHMM(1085), '18:05');
  });

  it('encodePlusCode encodes Fansipan (22.3033, 103.7750) and Vietnam peaks to valid 10-digit OLC with "+" at index 8', () => {
    const olcPattern = /^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2}$/;

    const fansipanCode = encodePlusCode(22.3033, 103.7750);
    assert.equal(fansipanCode.length, 11, '10-digit OLC with "+" separator must be 11 chars');
    assert.equal(fansipanCode.indexOf('+'), 8, '"+" separator must sit at index 8');
    assert.match(fansipanCode, olcPattern);
    assert.equal(fansipanCode, '7PJ58Q3G+82', 'Must match canonical Open Location Code for Fansipan');

    const vietnamLandmarks: Array<[string, number, number]> = [
      ['Bạch Mã', 16.198, 107.858],
      ['Mũi Đôi', 12.648, 109.462],
      ['Bà Đen', 11.373, 106.174],
      ['Tà Xùa', 21.320, 104.467],
    ];
    for (const [name, lat, lng] of vietnamLandmarks) {
      const code = encodePlusCode(lat, lng);
      assert.equal(code.indexOf('+'), 8, `${name} Plus Code must place "+" at index 8`);
      assert.match(code, olcPattern, `${name} Plus Code "${code}" must match strict OLC alphabet`);
    }

    assert.equal(encodePlusCode(Number.NaN, 103.775), '');
  });
});

// ============================================================================
// 5. PWA RESILIENCE, LEGAL PARITY, 2G TIMEOUT & ZERO-STUB / ZERO-CSS-TRAP GUARDS
// ============================================================================

function walkClientFiles(dir: string, exts: RegExp, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkClientFiles(full, exts, out);
    } else if (exts.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('5. PWA Manifest, Service Worker, Legal Parity, 2G Timeout & Dual-Theme CSS Guards', () => {
  it('manifest.json icons exist on disk and all PWA shortcuts resolve to valid AppViews', () => {
    const manifestPath = path.join(CLIENT_PUBLIC_DIR, 'manifest.json');
    assert.equal(fs.existsSync(manifestPath), true, 'client/public/manifest.json must exist');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      icons?: Array<{ src: string }>;
      shortcuts?: Array<{ url: string; icons?: Array<{ src: string }> }>;
    };

    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3, 'manifest must declare icons');
    for (const icon of manifest.icons) {
      assert.ok(icon.src.startsWith('/'), `Manifest icon must be a local path: ${icon.src}`);
      const absIcon = path.join(CLIENT_PUBLIC_DIR, icon.src.replace(/^\//, ''));
      assert.equal(fs.existsSync(absIcon), true, `Manifest icon missing on disk: ${icon.src}`);
    }

    assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 1, 'manifest must declare shortcuts');
    for (const shortcut of manifest.shortcuts) {
      const parsed = new URL(shortcut.url, 'https://lost.vn');
      const resolved = resolveAppRoute(parsed.pathname, '', parsed.search);
      assert.notEqual(
        resolved.view,
        'home',
        `Shortcut "${shortcut.url}" must resolve to its dedicated view, not fallback home`
      );
      for (const sIcon of shortcut.icons || []) {
        const absSIcon = path.join(CLIENT_PUBLIC_DIR, sIcon.src.replace(/^\//, ''));
        assert.equal(fs.existsSync(absSIcon), true, `Shortcut icon missing on disk: ${sIcon.src}`);
      }
    }

    // Explicitly verify SOS shortcut deep-link resolves toolkit + tab=sos
    const sosShortcut = resolveAppRoute('/toolkit', '', '?tab=sos');
    assert.equal(sosShortcut.view, 'toolkit');
    assert.equal(sosShortcut.queryParams?.tab, 'sos');
  });

  it('client/index.html has ZERO external Google Fonts, ZERO eager Google GSI script, and valid local assets', () => {
    const html = fs.readFileSync(path.join(CLIENT_ROOT_DIR, 'index.html'), 'utf8');
    const lower = html.toLowerCase();

    assert.equal(lower.includes('fonts.googleapis.com'), false, 'index.html must not load Google Fonts CDN');
    assert.equal(lower.includes('fonts.gstatic.com'), false, 'index.html must not reference gstatic fonts');
    assert.equal(
      lower.includes('accounts.google.com/gsi/client'),
      false,
      'index.html must not eagerly load Google GSI (AuthModal lazy-loads on demand per Decree 13/2023)'
    );
    assert.equal(lower.includes('unsplash'), false, 'index.html must not reference Unsplash');
    assert.equal(lower.includes('cloudinary'), false, 'index.html must not reference Cloudinary');

    const localHrefRe = /<link[^>]+href=["'](\/(?:favicon\.svg|manifest\.json|icons\/[^"']+))["']/gi;
    let match: RegExpExecArray | null;
    let checked = 0;
    while ((match = localHrefRe.exec(html)) !== null) {
      checked += 1;
      const absAsset = path.join(CLIENT_PUBLIC_DIR, match[1].replace(/^\//, ''));
      assert.equal(fs.existsSync(absAsset), true, `index.html <link> asset missing on disk: ${match[1]}`);
    }
    assert.ok(checked >= 4, `Expected >=4 local icon/manifest links in index.html, checked ${checked}`);
  });

  it('client/public/sw.js enforces bounded cache eviction, protected precache, 2G timeouts, and HTTP 503 offline DEM', () => {
    const sw = fs.readFileSync(path.join(CLIENT_PUBLIC_DIR, 'sw.js'), 'utf8');

    assert.match(sw, /MAX_STATIC_ITEMS\s*=\s*\d+/, 'sw.js must bound static cache size');
    assert.match(sw, /MAX_TILES_IN_CACHE\s*=\s*\d+/, 'sw.js must bound dynamic tile cache size');
    assert.match(sw, /STATIC_PRECACHE_SET/, 'sw.js must protect STATIC_PRECACHE keys from FIFO eviction');
    assert.match(sw, /function\s+trimCache\s*\(/, 'sw.js must implement trimCache eviction');
    assert.match(sw, /new\s+AbortController\s*\(/, 'sw.js must use AbortController timeouts for weak-2G resilience');
    assert.match(
      sw,
      /tileKind\s*===\s*['"]vector-openfreemap['"]\s*\|\|\s*tileKind\s*===\s*['"]raster-dem['"]/,
      'sw.js must return HTTP 503 for offline raster-dem and vector tiles (never 1x1 PNG)'
    );
    assert.match(sw, /status:\s*503/, 'sw.js must emit HTTP 503 for unavailable DEM/vector tiles');
    assert.match(sw, /\/api\//, 'sw.js must exclude /api/ from SW caching');
    assert.match(sw, /\/socket\.io/, 'sw.js must exclude /socket.io from SW caching');
  });

  it('fetchWithTimeout aborts stalled 2G requests with TimeoutError and respects caller AbortSignal with AbortError', async () => {
    const hangingFetch: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true }
        );
      });

    // 1. Timeout triggers TimeoutError (distinct from caller unmount AbortError)
    await assert.rejects(
      () => fetchWithTimeout('/api/trails', undefined, 25, hangingFetch),
      (err: unknown) => err instanceof Error && err.name === 'TimeoutError'
    );

    // 2. Caller AbortSignal triggers AbortError immediately
    const callerCtrl = new AbortController();
    const pending = fetchWithTimeout('/api/trails', { signal: callerCtrl.signal }, 5_000, hangingFetch);
    callerCtrl.abort();
    await assert.rejects(
      () => pending,
      (err: unknown) => err instanceof Error && err.name === 'AbortError'
    );

    // 3. Pre-aborted caller signal rejects synchronously without invoking fetch
    let called = false;
    const spyFetch: typeof fetch = async () => {
      called = true;
      return new Response('ok');
    };
    await assert.rejects(
      () => fetchWithTimeout('/api/trails', { signal: callerCtrl.signal }, 5_000, spyFetch),
      (err: unknown) => err instanceof Error && err.name === 'AbortError'
    );
    assert.equal(called, false, 'Pre-aborted signal must not fire network fetch');
  });

  it('LegalNoticesModal.tsx matches current commercial-free stack with ZERO stale Leaflet/Open-Meteo/ERA5 refs', () => {
    const legalSrc = fs.readFileSync(
      path.join(CLIENT_SRC_DIR, 'components', 'legal', 'LegalNoticesModal.tsx'),
      'utf8'
    );
    const requiredTerms = [
      /MapLibre GL/i,
      /BSD-3-Clause/i,
      /OpenFreeMap/i,
      /OpenStreetMap/i,
      /ODbL/i,
      /AWS Open Data/i,
      /Terrarium/i,
      /NASA GIBS/i,
      /NASA POWER/i,
      /MET Norway/i,
      /CC BY 4\.0/i,
      /NOAA Solar/i,
      /Plus Jakarta Sans/i,
      /Open Font License 1\.1/i,
      /Google Identity Services/i,
      /\bcors\s*\(MIT\)/i,
    ];
    for (const pattern of requiredTerms) {
      assert.match(legalSrc, pattern, `LegalNoticesModal.tsx must include attribution matching ${pattern}`);
    }
    for (const banned of [/leaflet/i, /open-meteo/i, /era5/i, /unsplash/i]) {
      assert.doesNotMatch(legalSrc, banned, `LegalNoticesModal.tsx must NEVER mention stale ${banned}`);
    }
  });

  it('client/src/** has ZERO TODO/FIXME/coming-soon stubs, ZERO forbidden CSS/TSX rules, and ZERO hardcoded colors outside token blocks', () => {
    const srcFiles = walkClientFiles(CLIENT_SRC_DIR, /\.(ts|tsx|css)$/);
    const stubRe = /\b(TODO|FIXME|HACK|XXX)\b|coming soon|sắp ra mắt|đang phát triển|not implemented/i;
    const forbiddenMotionRe =
      /backdrop-filter\s*:\s*blur|backdropFilter|WebkitBackdropFilter|transition\s*:\s*['"]?[^;'"}\n]*\ball\b|transition\s*:\s*['"]?[^;'"}\n]*box-shadow/;
    const staleStackRe = /leaflet|open-meteo|era5|unsplash|fonts\.googleapis|fonts\.gstatic/i;

    for (const file of srcFiles) {
      const rel = path.relative(CLIENT_ROOT_DIR, file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');
      assert.equal(stubRe.test(content), false, `Unfinished stub/TODO found in ${rel}`);
      assert.equal(forbiddenMotionRe.test(content), false, `Forbidden blur/transition rule found in ${rel}`);
      assert.equal(staleStackRe.test(content), false, `Stale Leaflet/Open-Meteo/ERA5/CDN ref found in ${rel}`);
    }

    // Verify client/src/index.css has zero hardcoded hex/rgba outside :root/[data-theme] token blocks
    const cssLines = fs.readFileSync(path.join(CLIENT_SRC_DIR, 'index.css'), 'utf8').split(/\r?\n/);
    let inTokenBlock = false;
    let braceDepth = 0;
    let tokenBlockDepth = -1;
    for (let i = 0; i < cssLines.length; i += 1) {
      const line = cssLines[i];
      const trimmed = line.trim();
      if (/^(:root|\[data-theme|html\[data-theme)/.test(trimmed) && trimmed.includes('{')) {
        inTokenBlock = true;
        tokenBlockDepth = braceDepth + 1;
      }
      braceDepth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (inTokenBlock && braceDepth < tokenBlockDepth) {
        inTokenBlock = false;
        tokenBlockDepth = -1;
      }
      if (!inTokenBlock && !trimmed.startsWith('/*') && !trimmed.startsWith('*') && !trimmed.startsWith('--')) {
        const stripped = line.replace(/url\([^)]+\)/g, '');
        assert.equal(
          /#[0-9a-fA-F]{3,8}\b/.test(stripped),
          false,
          `Hardcoded hex color outside token block at index.css:${i + 1}: ${trimmed}`
        );
        assert.equal(
          /rgba?\s*\(/.test(stripped),
          false,
          `Hardcoded rgb/rgba color outside token block at index.css:${i + 1}: ${trimmed}`
        );
      }
    }
  });
});

// ============================================================================
// 6. WAVE 8 P1/P2 PRODUCTION REGRESSION GUARDS
// ============================================================================

describe('6. Wave 8 Regression Guards (3D Basemap Switcher, Offline Readiness Audit, Print Iframe & Client Env)', () => {
  it('Terrain3DModal separates desiredBasemapRef from appliedBasemapRef and never mutates appliedBasemapRef inside onClick', () => {
    const src = fs.readFileSync(
      path.join(CLIENT_SRC_DIR, 'components', 'map', 'Terrain3DModal.tsx'),
      'utf8'
    );

    assert.match(src, /const\s+desiredBasemapRef\s*=\s*useRef<Terrain3DBasemapMode>/);
    assert.match(src, /const\s+appliedBasemapRef\s*=\s*useRef<Terrain3DBasemapMode\s*\|\s*null>\s*\(\s*null\s*\)/);
    assert.doesNotMatch(src, /\bactiveBasemapRef\b/, 'Legacy single activeBasemapRef must not reappear');
    assert.match(
      src,
      /if\s*\(\s*!isOpen\s*\|\|\s*!map\s*\|\|\s*appliedBasemapRef\.current\s*===\s*basemap3D\s*\)/,
      'Basemap swap useEffect must guard against appliedBasemapRef.current === basemap3D'
    );
    assert.match(
      src,
      /appliedBasemapRef\.current\s*=\s*initialBasemap/,
      'Initial map creation must record appliedBasemapRef.current = initialBasemap'
    );
    assert.match(
      src,
      /appliedBasemapRef\.current\s*=\s*null/,
      'Map teardown/re-mount must reset appliedBasemapRef.current = null'
    );

    // Isolate the basemap switcher button onClick handler and ensure it updates desiredBasemapRef, NOT appliedBasemapRef
    const switcherIdx = src.indexOf("aria-label=\"Chọn lớp nền địa hình 3D\"");
    assert.ok(switcherIdx > 0, 'Must locate 3D basemap switcher group');
    const switcherSlice = src.slice(switcherIdx, switcherIdx + 1800);
    const onClickMatch = switcherSlice.match(/onClick=\{\(\)\s*=>\s*\{([\s\S]*?)\}\}/);
    assert.ok(onClickMatch, 'Must locate basemap switcher button onClick block');
    const onClickBody = onClickMatch[1];

    assert.match(onClickBody, /desiredBasemapRef\.current\s*=\s*opt\.id/, 'onClick must update desiredBasemapRef.current');
    assert.doesNotMatch(
      onClickBody,
      /appliedBasemapRef\.current\s*=/,
      'onClick MUST NEVER mutate appliedBasemapRef.current synchronously (causes P1 #1 no-op setStyle bug)'
    );
  });

  it('DirectoryCostView fallback print iframe cleans up via afterprint + 30s safety timer (no 1000ms premature tear-down)', () => {
    const src = fs.readFileSync(
      path.join(CLIENT_SRC_DIR, 'components', 'hub', 'DirectoryCostView.tsx'),
      'utf8'
    );
    const fallbackIdx = src.indexOf('Popup-blocker safe fallback');
    assert.ok(fallbackIdx > 0, 'Must locate popup-blocker iframe print fallback');
    const fallbackSlice = src.slice(fallbackIdx, fallbackIdx + 2200);

    assert.match(fallbackSlice, /addEventListener\(\s*['"]afterprint['"]/, 'Must clean up print iframe on afterprint');
    assert.match(fallbackSlice, /removeEventListener\(\s*['"]afterprint['"]/, 'Must detach afterprint listener on cleanup');
    assert.match(fallbackSlice, /30_000|30000/, 'Must keep a 30-second fallback safety cleanup timer');
    assert.doesNotMatch(
      fallbackSlice,
      /removeChild\(iframe\)[\s\S]{0,60}1000\b/,
      'Must not tear down fallback print iframe on an aggressive 1000ms timer'
    );
  });

  it('computeOfflineReadinessAudit NEVER grants READY when weatherAvailable is false and computes safeTurnaroundTime dynamically', () => {
    const baseTrail = mockTrails[0];

    const gentleWalkTrail = {
      ...baseTrail,
      id: 'test-gentle-walk-5km',
      name: 'Cung Nhẹ 5km',
      distanceKm: 5,
      elevationGainM: 200,
      maxAltitudeM: 450,
      durationDays: 1,
      difficultyLevel: 1,
      permitRequired: false,
      bestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      avoidMonths: [],
    };

    const extremeClimbTrail = {
      ...baseTrail,
      id: 'test-extreme-climb-20km',
      name: 'Cung Cực Khó 20km / +1800m',
      distanceKm: 20,
      elevationGainM: 1800,
      maxAltitudeM: 3046,
      durationDays: 1,
      difficultyLevel: 5,
      permitRequired: true,
      bestMonths: [10, 11, 12],
      avoidMonths: [6, 7, 8],
    };

    // 1. Best-case offline scenario: ideal month, gentle 5km walk, light pack, advanced fitness, early 06:00 start
    const gentleAudit = computeOfflineReadinessAudit(
      {
        trailId: gentleWalkTrail.id,
        departureDate: '2026-11-15',
        startTime: '06:00',
        bodyWeightKg: 65,
        packWeightKg: 4,
        fitnessLevel: 'advanced',
        groupSize: 2,
        hasPermitConfirmed: true,
      },
      [gentleWalkTrail]
    );

    assert.equal(gentleAudit.snapshot.weatherAvailable, false, 'Offline audit must report weatherAvailable: false');
    assert.notEqual(
      gentleAudit.verdict,
      'READY',
      'Offline readiness audit MUST NEVER return READY when weatherAvailable === false'
    );
    assert.equal(gentleAudit.verdict, 'ADJUST_BEFORE_GO');
    assert.ok(gentleAudit.readinessScore <= 74, `Offline readinessScore must be capped <= 74, got ${gentleAudit.readinessScore}`);
    assert.match(gentleAudit.verdictLabel.toLowerCase(), /thời tiết|trực tuyến/);
    assert.notEqual(gentleAudit.snapshot.safeTurnaroundTime, '13:00', 'Gentle 5km walk must not hardcode 13:00');

    const expectedGentleTurnaround = calculateTurnaroundTime({
      startMinutes: 360,
      totalAscentKm: 2.5,
      ascentGainM: 200,
      descentKm: 2.5,
      civilDuskMinutes: 17 * 60 + 45,
      safetyMarginMinutes: 45,
    }).turnaroundLabel;
    assert.equal(gentleAudit.snapshot.safeTurnaroundTime, expectedGentleTurnaround);

    // 2. Extreme 1-day 20km / +1800m climb: turnaround time must be dramatically earlier than gentle 5km walk
    const extremeAudit = computeOfflineReadinessAudit(
      {
        trailId: extremeClimbTrail.id,
        departureDate: '2026-11-15',
        startTime: '06:00',
        bodyWeightKg: 65,
        packWeightKg: 8,
        fitnessLevel: 'advanced',
        groupSize: 3,
        hasPermitConfirmed: true,
      },
      [extremeClimbTrail]
    );

    assert.equal(extremeAudit.snapshot.weatherAvailable, false);
    assert.notEqual(extremeAudit.verdict, 'READY');
    assert.notEqual(extremeAudit.snapshot.safeTurnaroundTime, '13:00', 'Extreme 20km/+1800m climb must not hardcode 13:00');

    const expectedExtremeTurnaround = calculateTurnaroundTime({
      startMinutes: 360,
      totalAscentKm: 10,
      ascentGainM: 1800,
      descentKm: 10,
      civilDuskMinutes: 17 * 60 + 45,
      safetyMarginMinutes: 45,
    }).turnaroundLabel;
    assert.equal(extremeAudit.snapshot.safeTurnaroundTime, expectedExtremeTurnaround);

    const toMinutes = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };
    assert.ok(
      toMinutes(extremeAudit.snapshot.safeTurnaroundTime) < toMinutes(gentleAudit.snapshot.safeTurnaroundTime) - 120,
      `Extreme 20km/+1800m turnaround (${extremeAudit.snapshot.safeTurnaroundTime}) must be >2h earlier than gentle 5km walk (${gentleAudit.snapshot.safeTurnaroundTime})`
    );

    // 3. Avoid-month + overweight + late start + unconfirmed permit must yield HOLD_OFF (and still never READY)
    const holdOffAudit = computeOfflineReadinessAudit(
      {
        trailId: extremeClimbTrail.id,
        departureDate: '2026-07-15',
        startTime: '11:30',
        bodyWeightKg: 55,
        packWeightKg: 18,
        fitnessLevel: 'beginner',
        groupSize: 1,
        hasPermitConfirmed: false,
      },
      [extremeClimbTrail]
    );
    assert.equal(holdOffAudit.snapshot.weatherAvailable, false);
    assert.equal(holdOffAudit.verdict, 'HOLD_OFF');
  });

  it('client/.env.example exists, documents public VITE vars & same-origin proxy, and contains ZERO leaked secrets', () => {
    const envExamplePath = path.join(CLIENT_ROOT_DIR, '.env.example');
    assert.equal(fs.existsSync(envExamplePath), true, 'client/.env.example must exist');

    const content = fs.readFileSync(envExamplePath, 'utf8');
    assert.match(content, /^VITE_GOOGLE_CLIENT_ID=\s*$/m, 'Must declare blank VITE_GOOGLE_CLIENT_ID=');
    assert.match(content, /^VITE_SATELLITE_TILE_URL=\s*$/m, 'Must declare blank VITE_SATELLITE_TILE_URL=');
    assert.match(content, /^VITE_SATELLITE_ATTRIBUTION=\s*$/m, 'Must declare blank VITE_SATELLITE_ATTRIBUTION=');
    assert.match(content, /\/api\/\*/, 'Must document same-origin reverse proxy for /api/*');
    assert.match(content, /\/socket\.io\/\*/, 'Must document same-origin WebSocket reverse proxy for /socket.io/*');

    // Verify every non-comment KEY=VALUE line has an empty value (no leaked credentials/tokens)
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      assert.ok(eqIdx > 0, `Unexpected non-assignment line in client/.env.example: ${line}`);
      const value = line.slice(eqIdx + 1).trim();
      assert.equal(value, '', `client/.env.example must keep "${line.slice(0, eqIdx)}" blank (zero secrets/tokens)`);
    }

    // Secret-pattern sweep across entire file (including comments)
    const secretPatterns = [
      /AIza[0-9A-Za-z_-]{20,}/,
      /\.apps\.googleusercontent\.com/i,
      /sk-[A-Za-z0-9]{20,}/,
      /ghp_[A-Za-z0-9]{20,}/,
      /cloudinary:\/\/[^ \n]+/i,
      /mongodb\+srv:\/\/[^ \n]+/i,
      /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
    ];
    for (const pattern of secretPatterns) {
      assert.doesNotMatch(content, pattern, `client/.env.example must never match secret pattern ${pattern}`);
    }
  });
});



