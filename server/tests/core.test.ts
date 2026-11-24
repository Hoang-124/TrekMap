import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

import {
  generateToken,
  verifyToken,
  hashPasswordAsync,
  verifyPasswordAsync,
} from '../src/utils/auth.js';
import { calculateAlpineBioMetrics, computeToblerSpeedKmH } from '../src/services/aiBioCalculator.service.js';
import { mockTrails } from '../src/data/seedData.js';
import { VIETNAM_RANGER_STATIONS, VIETNAM_SUMMIT_CHALLENGES } from '../src/data/vietnamDirectory.js';
import { httpServer } from '../src/app.js';

describe('LOST Server Core & Security Regression Suite', () => {
  it('generates and verifies 2-part HMAC access tokens and rejects tampering', () => {
    const token = generateToken('65f0a1b2c3d4e5f6a7b8c9d0', 'trekker@lost.vn', 'user', 2);
    const parts = token.split('.');
    assert.equal(parts.length, 2, 'LOST access token must be a 2-part base64url.hex token');

    const decoded = verifyToken(token);
    assert.ok(decoded, 'Valid token must verify');
    assert.equal(decoded.userId, '65f0a1b2c3d4e5f6a7b8c9d0');
    assert.equal(decoded.email, 'trekker@lost.vn');
    assert.equal(decoded.role, 'user');
    assert.equal(decoded.tokenVersion, 2);

    const tampered = `${parts[0]}.${parts[1].slice(0, -2)}00`;
    assert.equal(verifyToken(tampered), null, 'Tampered signature must be rejected');
  });

  it('hashes and verifies passwords asynchronously via PBKDF2', async () => {
    const hash = await hashPasswordAsync('TrekkingVN#2026');
    assert.ok(hash.startsWith('pbkdf2:100000:'));
    assert.equal(await verifyPasswordAsync('TrekkingVN#2026', hash), true);
    assert.equal(await verifyPasswordAsync('WrongPass#2026', hash), false);
  });

  it('enforces Rule 11 Vietnam geographic bounds and Client/Server SHA-256 parity', () => {
    assert.ok(mockTrails.length >= 36, `Expected >= 36 real Vietnam trails, got ${mockTrails.length}`);
    assert.ok(VIETNAM_RANGER_STATIONS.length >= 28);
    assert.ok(VIETNAM_SUMMIT_CHALLENGES.length >= 10);

    for (const trail of mockTrails) {
      assert.ok(trail.startLat >= 8 && trail.startLat <= 24, `${trail.id} startLat out of Vietnam bounds`);
      assert.ok(trail.startLng >= 102 && trail.startLng <= 110, `${trail.id} startLng out of Vietnam bounds`);
      assert.ok(trail.maxAltitudeM > 0 && trail.maxAltitudeM <= 3143, `${trail.id} maxAltitudeM out of range`);
      assert.ok(trail.distanceKm > 0, `${trail.id} distanceKm must be positive`);
    }

    const clientSeedPath = path.resolve(process.cwd(), '../client/src/data/seedData.ts');
    const serverSeedPath = path.resolve(process.cwd(), 'src/data/seedData.ts');
    if (fs.existsSync(clientSeedPath) && fs.existsSync(serverSeedPath)) {
      const hClient = crypto.createHash('sha256').update(fs.readFileSync(clientSeedPath)).digest('hex');
      const hServer = crypto.createHash('sha256').update(fs.readFileSync(serverSeedPath)).digest('hex');
      assert.equal(hClient, hServer, 'client/src/data/seedData.ts and server/src/data/seedData.ts must match SHA-256');
    }
  });

  it('computes deterministic alpine bio-metrics & Tobler speeds accurately', () => {
    const flatSpeed = computeToblerSpeedKmH(0, 'intermediate');
    const steepSpeed = computeToblerSpeedKmH(0.3, 'intermediate');
    assert.ok(flatSpeed > steepSpeed, 'Steep uphill must be slower than flat ground');

    const bio = calculateAlpineBioMetrics({
      distanceKm: 22,
      elevationGainM: 1400,
      maxAltitudeM: 3143,
      bodyWeightKg: 65,
      packWeightKg: 10,
      fitnessLevel: 'intermediate',
      durationDays: 2,
    });
    assert.ok(bio.naismithHours > 4);
    assert.ok(bio.waterLitersTotal >= 3);
    assert.ok(bio.oresolPackets >= 1);
  });

  describe('Express API HTTP Guards & Regression Checks', () => {
    let baseUrl = '';

    after(async () => {
      if (httpServer.listening) {
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      }
    });

    it('boots Express app and enforces 404, fail-closed 401 auth guards, and P0-10 duration >=3 filter', async () => {
      await new Promise<void>((resolve) => {
        httpServer.listen(0, '127.0.0.1', () => resolve());
      });
      const { port } = httpServer.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}`;

      const healthRes = await fetch(`${baseUrl}/api/health`);
      assert.ok([200, 503].includes(healthRes.status));
      const healthJson = (await healthRes.json()) as { app?: string };
      assert.equal(healthJson.app, 'LOST API Server');

      const notFoundRes = await fetch(`${baseUrl}/api/does-not-exist-xyz`);
      assert.equal(notFoundRes.status, 404);

      // Fail-closed 401 auth checks on sensitive & newly added routes
      const protectedEndpoints = [
        { method: 'GET', url: '/api/auth/me' },
        { method: 'POST', url: '/api/auth/change-password' },
        { method: 'DELETE', url: '/api/auth/me' },
        { method: 'GET', url: '/api/directory/inquiries' },
        { method: 'GET', url: '/api/safety-timers/admin' },
        { method: 'GET', url: '/api/admin/reviews' },
        { method: 'GET', url: '/api/admin/pois' },
        { method: 'GET', url: '/api/admin/live-beacons' },
      ];
      for (const ep of protectedEndpoints) {
        const res = await fetch(`${baseUrl}${ep.url}`, { method: ep.method });
        assert.equal(res.status, 401, `${ep.method} ${ep.url} must reject unauthenticated callers with 401`);
      }

      // P0-2 regression: synthetic weather-live-* incidents must carry isSynthetic: true
      const incRes = await fetch(`${baseUrl}/api/incidents`);
      assert.equal(incRes.status, 200);
      const incJson = (await incRes.json()) as {
        data?: Array<{ id?: string; isSynthetic?: boolean }>;
      };
      if (Array.isArray(incJson.data)) {
        for (const inc of incJson.data) {
          if (typeof inc.id === 'string' && (inc.id.startsWith('weather-live-') || inc.id.startsWith('nasa-'))) {
            assert.equal(inc.isSynthetic, true, `Synthetic incident ${inc.id} must be tagged isSynthetic: true`);
          }
        }
      }

      // P0-10 regression: duration=3 must include 3-day AND 4+ day trails (not exact === 3)
      const durRes = await fetch(`${baseUrl}/api/trails?duration=3`);
      assert.equal(durRes.status, 200);
      const durJson = (await durRes.json()) as { data?: Array<{ durationDays?: number }> };
      assert.ok(Array.isArray(durJson.data) && durJson.data.length > 0, 'Expected >=1 trails for duration=3+');
      for (const t of durJson.data) {
        assert.ok((t.durationDays || 0) >= 3, `Expected durationDays >= 3, got ${t.durationDays}`);
      }
    });
  });
});
