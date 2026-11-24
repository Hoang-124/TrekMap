import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  decodeAccessTokenPayload,
  getActiveStorageUid,
  scopedStorageKey,
  clearSensitiveSessionStorage,
} from '../src/utils/storageScope.js';
import { resolveAppRoute, buildCleanUrl } from '../src/utils/routing.js';
import { haversineMeters, distanceToTrackMeters } from '../src/utils/geoMath.js';
import { formatHoursToHHMM } from '../src/utils/solarMath.js';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

describe('LOST Client Core Utilities & P0 Regression Suite', () => {
  it('decodes BOTH LOST 2-part HMAC tokens (parts[0]) and 3-part JWTs (parts[1]) — P0-1', () => {
    const payloadJson = JSON.stringify({
      userId: '65f0a1b2c3d4e5f6a7b8c9d0',
      email: 'trekker@lost.vn',
      role: 'user',
    });
    const b64url = Buffer.from(payloadJson, 'utf8').toString('base64url');
    const twoPartToken = `${b64url}.a1b2c3d4e5f67890abcdef`;

    const decoded2 = decodeAccessTokenPayload(twoPartToken);
    assert.ok(decoded2, '2-part LOST HMAC token must decode cleanly');
    assert.equal(decoded2.userId, '65f0a1b2c3d4e5f6a7b8c9d0');

    const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString('base64url');
    const threePartToken = `${headerB64}.${b64url}.sig12345`;
    const decoded3 = decodeAccessTokenPayload(threePartToken);
    assert.ok(decoded3, '3-part standard JWT must also decode cleanly');
    assert.equal(decoded3.userId, '65f0a1b2c3d4e5f6a7b8c9d0');

    assert.equal(decodeAccessTokenPayload('invalid-token'), null);
  });

  it('isolates scoped storage keys per account and wipes all sensitive keys on logout', () => {
    const ls = createMemoryStorage();
    const ss = createMemoryStorage();
    const g = globalThis as unknown as {
      window?: unknown;
      localStorage?: Storage;
      sessionStorage?: Storage;
    };
    const prevWin = g.window;
    const prevLs = g.localStorage;
    const prevSs = g.sessionStorage;

    try {
      g.window = {};
      g.localStorage = ls as unknown as Storage;
      g.sessionStorage = ss as unknown as Storage;

      const b64url = Buffer.from(JSON.stringify({ userId: 'uid_alpha_01' }), 'utf8').toString('base64url');
      ls.setItem('lost_token', `${b64url}.deadbeef`);

      assert.equal(getActiveStorageUid(), 'uid_alpha_01');
      assert.equal(scopedStorageKey('lost_gear_optimizer_v1'), 'lost_gear_optimizer_v1_uid_alpha_01');

      ls.setItem('lost_custom_routes_v1', '[]');
      ls.setItem('lost_squad_safety_gate_v1', '{}');
      ls.setItem('lost_squad_gear_v1', '[]');
      ls.setItem('lost_local_itineraries', '{}');
      ls.setItem('lost_gemini_api_key', 'secret');
      ls.setItem('lost_engine_mode', 'gemini');
      ls.setItem('lost_itinerary_trail-fansipan', '{}');
      ls.setItem('lost_checklist_trail-fansipan', '[]');
      ls.setItem('lost_contrib_draft_v1_uid_alpha_01', '{}');
      ss.setItem('lost_trip_budget_draft', '{}');

      clearSensitiveSessionStorage();

      assert.equal(ls.getItem('lost_custom_routes_v1'), null);
      assert.equal(ls.getItem('lost_squad_safety_gate_v1'), null);
      assert.equal(ls.getItem('lost_squad_gear_v1'), null);
      assert.equal(ls.getItem('lost_local_itineraries'), null);
      assert.equal(ls.getItem('lost_gemini_api_key'), null);
      assert.equal(ls.getItem('lost_engine_mode'), null);
      assert.equal(ls.getItem('lost_itinerary_trail-fansipan'), null);
      assert.equal(ls.getItem('lost_checklist_trail-fansipan'), null);
      assert.equal(ls.getItem('lost_contrib_draft_v1_uid_alpha_01'), null);
      assert.equal(ss.getItem('lost_trip_budget_draft'), null);
    } finally {
      g.window = prevWin;
      g.localStorage = prevLs;
      g.sessionStorage = prevSs;
    }
  });

  it('resolves clean URLs including /hub/* aliases, /passport?verify=, /trails/:slug, and /beacon/:token', () => {
    const trailRoute = resolveAppRoute('/trails/trail-fansipan', '');
    assert.equal(trailRoute.view, 'detail');
    assert.equal(trailRoute.trailId, 'trail-fansipan');

    const hubGear = resolveAppRoute('/hub/gear', '', '?pack=ultralight-2n1d');
    assert.equal(hubGear.view, 'gear');
    assert.equal(hubGear.queryParams?.pack, 'ultralight-2n1d');

    const hubPassportVerify = resolveAppRoute('/hub/passport', '', '?verify=LS-88A1BC');
    assert.equal(hubPassportVerify.view, 'passport');
    assert.equal(hubPassportVerify.queryParams?.verify, 'LS-88A1BC');

    const beacon = resolveAppRoute('/beacon/abcdef123456', '');
    assert.equal(beacon.view, 'beacon');
    assert.equal(beacon.beaconToken, 'abcdef123456');

    assert.equal(buildCleanUrl('passport', null, { verify: 'LS-88A1BC' }), '/passport?verify=LS-88A1BC');
  });

  it('computes Haversine, off-trail distance, and solar time formatting accurately', () => {
    const dZero = haversineMeters(22.3033, 103.7751, 22.3033, 103.7751);
    assert.equal(Math.round(dZero), 0);

    const track: [number, number][] = [
      [22.3033, 103.7751],
      [22.3133, 103.7751],
    ];
    const onTrack = distanceToTrackMeters(22.3083, 103.7751, track);
    assert.ok(onTrack <= 5, `Point on track should be <=5m away, got ${onTrack}m`);

    const offTrack = distanceToTrackMeters(22.3083, 103.7801, track);
    assert.ok(offTrack > 400, `Point ~500m east should trigger off-trail alarm, got ${offTrack}m`);

    assert.equal(formatHoursToHHMM(5.5), '05:30');
    assert.equal(formatHoursToHHMM(18.25), '18:15');
  });
});
