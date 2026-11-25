import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Response as ExpressResponse } from 'express';
import mongoose from 'mongoose';

import { app, parseTrustProxySetting, SERVER_VERSION } from '../src/app.js';
import { stopRateLimiterTimers } from '../src/middleware/rateLimiter.middleware.js';
import { stopCacheCleanupTimer } from '../src/middleware/cache.middleware.js';
import { stopSocketTimers, getIO } from '../src/config/socket.js';
import { generateToken, generateRefreshToken, getJwtSecret, hashPasswordAsync } from '../src/utils/auth.js';
import { sanitizeInput } from '../src/utils/validation.js';
import { getAllowedOrigins } from '../src/config/cors.js';
import { deleteMyAccount, logout } from '../src/controllers/auth.controller.js';
import type { AuthRequest } from '../src/middleware/auth.middleware.js';
import { AiChatThreadModel } from '../src/models/AiChatThread.js';
import { UserModel } from '../src/models/User.js';
import { TripPlanModel } from '../src/models/TripPlan.js';
import { ConversationModel } from '../src/models/Conversation.js';
import { MessageModel } from '../src/models/Message.js';
import { FollowModel } from '../src/models/Follow.js';
import { SavedTrailModel } from '../src/models/SavedTrail.js';
import { CheckinModel } from '../src/models/Checkin.js';
import { SafetyTimerModel } from '../src/models/SafetyTimer.js';
import { ActivityModel } from '../src/models/Activity.js';
import { NotificationModel } from '../src/models/Notification.js';
import { LiveBeaconModel } from '../src/models/LiveBeacon.js';
import { GearPackModel } from '../src/models/GearPack.js';
import { CustomRouteModel } from '../src/models/CustomRoute.js';
import { WeatherAlertSubModel } from '../src/models/WeatherAlertSub.js';
import { ItineraryModel } from '../src/models/Itinerary.js';
import { TrainingPlanModel } from '../src/models/TrainingPlan.js';
import { GearChecklistModel } from '../src/models/GearChecklist.js';
import { GuideInquiryModel } from '../src/models/GuideInquiry.js';
import { GuideModel } from '../src/models/Guide.js';
import { TrailPoiModel } from '../src/models/TrailPoi.js';
import { TripReportModel } from '../src/models/TripReport.js';
import { UploadAssetModel } from '../src/models/UploadAsset.js';
import { ChallengeClaimModel } from '../src/models/ChallengeClaim.js';
import { TrailConditionModel } from '../src/models/TrailCondition.js';
import { IncidentModel } from '../src/models/Incident.js';
import { ContributionModel } from '../src/models/Contribution.js';
import { ThreadModel } from '../src/models/Thread.js';
import { CommentModel } from '../src/models/Comment.js';
import { ReviewModel } from '../src/models/Review.js';
import { CommunityMessageModel } from '../src/models/CommunityMessage.js';

function signCustomToken(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getJwtSecret()).update(encoded).digest('hex');
  return `${encoded}.${signature}`;
}

function assertSecurityHeaders(headers: Headers, contextLabel: string): void {
  assert.equal(
    headers.get('x-content-type-options'),
    'nosniff',
    `${contextLabel}: expected X-Content-Type-Options: nosniff`
  );
  assert.equal(
    headers.get('x-frame-options'),
    'DENY',
    `${contextLabel}: expected X-Frame-Options: DENY`
  );
  const csp = headers.get('content-security-policy');
  assert.ok(csp && csp.includes("default-src 'none'"), `${contextLabel}: expected restrictive Content-Security-Policy`);
  assert.equal(
    headers.get('x-powered-by'),
    null,
    `${contextLabel}: X-Powered-By header must be disabled`
  );
}

describe('Express HTTP Integration & Security Boundary Suite', () => {
  let server: http.Server;
  let baseUrl = '';

  before(async () => {
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    stopRateLimiterTimers();
    stopCacheCleanupTimer();
    stopSocketTimers();

    const io = getIO();
    if (io) {
      await new Promise<void>((resolve) => {
        try {
          io.close(() => resolve());
        } catch {
          resolve();
        }
      });
    }

    if (server?.listening) {
      if (typeof (server as http.Server & { closeIdleConnections?: () => void }).closeIdleConnections === 'function') {
        (server as http.Server & { closeIdleConnections: () => void }).closeIdleConnections();
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/health returns health payload with hardened security headers and zero framework fingerprint', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const dbConnected = mongoose.connection.readyState === 1;
    assert.equal(
      res.status,
      dbConnected ? 200 : 503,
      `GET /api/health must return ${dbConnected ? '200 when DB connected' : '503 fail-closed when DB disconnected'}`
    );
    assertSecurityHeaders(res.headers, 'GET /api/health');
    assert.equal(res.headers.get('cache-control'), 'no-store');

    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.app, 'LOST API Server');
    assert.equal(body.status, dbConnected ? 'Online' : 'Degraded');
    assert.ok(
      typeof body.version === 'string' && body.version.startsWith(SERVER_VERSION),
      `GET /api/health version "${String(body.version)}" must align with server/package.json (${SERVER_VERSION})`
    );
    assert.equal(body.database, dbConnected ? 'Connected' : 'Disconnected');
    assert.equal(typeof body.timestamp, 'string');

    // Also verify a live 200 OK JSON route carries identical security headers (even when MongoDB is offline in CI)
    const okRes = await fetch(`${baseUrl}/api/ai/quick-prompts`);
    assert.equal(okRes.status, 200);
    assertSecurityHeaders(okRes.headers, 'GET /api/ai/quick-prompts');
    const okBody = (await okRes.json()) as { success?: boolean; data?: unknown[] };
    assert.equal(okBody.success, true);
    assert.ok(Array.isArray(okBody.data) && okBody.data.length > 0);
  });

  it('GET /api/health/ready returns structured readiness JSON with zero leaked secrets or stack traces', async () => {
    const res = await fetch(`${baseUrl}/api/health/ready`);
    const dbConnected = mongoose.connection.readyState === 1;
    assert.ok([200, 503].includes(res.status), `Unexpected readiness status ${res.status}`);
    if (!dbConnected) {
      assert.equal(res.status, 503);
    }
    assertSecurityHeaders(res.headers, 'GET /api/health/ready');
    assert.equal(res.headers.get('cache-control'), 'no-store');

    const rawText = await res.text();
    assert.doesNotMatch(rawText, /mongodb(?:\+srv)?:\/\//i, 'Readiness must never leak MongoDB URI');
    assert.doesNotMatch(
      rawText,
      /JWT_SECRET|SMTP_PASS|CLOUDINARY_API_SECRET|GEMINI_API_KEY|GOOGLE_CLIENT_SECRET/i,
      'Readiness must never leak env secrets'
    );
    assert.doesNotMatch(rawText, /"stack"\s*:/i, 'Readiness must never leak stack traces');
    assert.doesNotMatch(rawText, /\bat\s+\S+\s+\([^)]+:\d+:\d+\)/, 'Readiness must never leak JS stack frames');

    const body = JSON.parse(rawText) as {
      app?: string;
      ready?: boolean;
      status?: string;
      checks?: {
        database?: { state?: string; ok?: boolean; latencyMs?: number | null };
        smtp?: { configured?: boolean; mode?: string };
        socket?: { initialized?: boolean };
      };
      uptimeSeconds?: number;
      timestamp?: string;
    };

    assert.equal(body.app, 'LOST API Server');
    assert.equal(typeof body.ready, 'boolean');
    assert.ok(body.status === 'Ready' || body.status === 'NotReady');
    assert.ok(body.checks && typeof body.checks === 'object');
    assert.equal(typeof body.checks.database?.state, 'string');
    assert.equal(typeof body.checks.database?.ok, 'boolean');
    assert.equal(typeof body.checks.smtp?.configured, 'boolean');
    assert.equal(typeof body.checks.smtp?.mode, 'string');
    assert.equal(typeof body.checks.socket?.initialized, 'boolean');
    assert.equal(typeof body.uptimeSeconds, 'number');
    assert.equal(typeof body.timestamp, 'string');
  });

  it('returns structured JSON 404 for unknown API routes', async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent-route-xyz`);
    assert.equal(res.status, 404);
    assertSecurityHeaders(res.headers, 'GET /api/nonexistent-route-xyz');
    assert.match(res.headers.get('content-type') || '', /application\/json/i);

    const body = (await res.json()) as { success?: boolean; message?: string };
    assert.equal(body.success, false);
    assert.equal(typeof body.message, 'string');
    assert.ok((body.message || '').length > 0);
  });

  it('fails closed with 401 on unauthenticated access to user, admin, SAR, and upload deletion routes', async () => {
    const protectedEndpoints: Array<{ method: string; path: string }> = [
      { method: 'GET', path: '/api/auth/me' },
      { method: 'GET', path: '/api/admin/stats' },
      { method: 'GET', path: '/api/admin/users' },
      { method: 'GET', path: '/api/admin/audit-logs' },
      { method: 'PATCH', path: '/api/safety-timers/admin/507f1f77bcf86cd799439011/mark-safe' },
      { method: 'PATCH', path: '/api/safety-timers/admin/507f1f77bcf86cd799439011/extend' },
      { method: 'PATCH', path: '/api/live-beacons/admin/507f1f77bcf86cd799439011/resolve' },
      { method: 'DELETE', path: '/api/upload?publicId=lost/test/abc' },
    ];

    for (const ep of protectedEndpoints) {
      const res = await fetch(`${baseUrl}${ep.path}`, {
        method: ep.method,
        headers: ep.method === 'PATCH' ? { 'Content-Type': 'application/json' } : undefined,
        body: ep.method === 'PATCH' ? JSON.stringify({}) : undefined,
      });
      assert.equal(
        res.status,
        401,
        `Unauthenticated ${ep.method} ${ep.path} must fail closed with 401 (got ${res.status})`
      );
      const body = (await res.json()) as { success?: boolean; message?: string };
      assert.equal(body.success, false);
      assert.equal(typeof body.message, 'string');
    }
  });

  it('rejects malformed JWTs, non-Bearer schemes, and refresh tokens used as Bearer access tokens with 401', async () => {
    const refreshToken = generateRefreshToken('507f1f77bcf86cd799439011', 'trekker@lost.vn', 'user', 0);
    const invalidAuthHeaders = [
      'Bearer invalid.token.here',
      'Bearer ',
      'Basic dXNlcjpwYXNz',
      `Bearer ${refreshToken}`,
    ];

    const targetPaths: Array<{ method: string; path: string }> = [
      { method: 'GET', path: '/api/auth/me' },
      { method: 'GET', path: '/api/admin/stats' },
      { method: 'PATCH', path: '/api/safety-timers/admin/507f1f77bcf86cd799439011/mark-safe' },
      { method: 'PATCH', path: '/api/live-beacons/admin/507f1f77bcf86cd799439011/resolve' },
      { method: 'DELETE', path: '/api/upload?publicId=lost/test/abc' },
    ];

    for (const authHeader of invalidAuthHeaders) {
      for (const target of targetPaths) {
        const res = await fetch(`${baseUrl}${target.path}`, {
          method: target.method,
          headers: {
            Authorization: authHeader,
            ...(target.method === 'PATCH' ? { 'Content-Type': 'application/json' } : {}),
          },
          body: target.method === 'PATCH' ? JSON.stringify({}) : undefined,
        });
        assert.equal(
          res.status,
          401,
          `${target.method} ${target.path} with "${authHeader.slice(0, 28)}..." must return 401 (got ${res.status})`
        );
      }
    }
  });

  it('returns 400 (never 500) when fuzzing invalid ObjectIds on public routes', async () => {
    const fuzzedRoutes = [
      '/api/users/not-an-oid/followers',
      '/api/users/not-an-oid/following',
      '/api/users/12345/followers',
      '/api/trails/not-an-oid/reviews',
      '/api/trails/bad$$$id/reviews',
    ];

    for (const route of fuzzedRoutes) {
      const res = await fetch(`${baseUrl}${route}`);
      assert.equal(res.status, 400, `GET ${route} must return 400 for invalid ObjectId (got ${res.status})`);
      const body = (await res.json()) as { success?: boolean; message?: string };
      assert.equal(body.success, false);
      assert.equal(typeof body.message, 'string');
    }
  });

  it('rejects oversized (> 512 KB) JSON payloads on POST /api/forum with 413 and malformed JSON with 400', async () => {
    const oversizedPayload = JSON.stringify({
      title: 'Oversized payload DoS probe',
      content: 'A'.repeat(600 * 1024),
    });
    assert.ok(Buffer.byteLength(oversizedPayload, 'utf8') > 512 * 1024);

    const largeRes = await fetch(`${baseUrl}/api/forum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: oversizedPayload,
    });
    assert.equal(largeRes.status, 413, `POST /api/forum > 512 KB must return 413 (got ${largeRes.status})`);
    const largeBody = (await largeRes.json()) as { success?: boolean; message?: string };
    assert.equal(largeBody.success, false);
    assert.equal(typeof largeBody.message, 'string');

    // Malformed JSON must cleanly return 400 (not 500)
    const malformedRes = await fetch(`${baseUrl}/api/forum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"title": "broken-json',
    });
    assert.equal(malformedRes.status, 400, `Malformed JSON on POST /api/forum must return 400 (got ${malformedRes.status})`);
    const malformedBody = (await malformedRes.json()) as { success?: boolean; message?: string };
    assert.equal(malformedBody.success, false);
    assert.equal(typeof malformedBody.message, 'string');
  });

  it('defines MongoDB-compliant partial TTL index on AiChatThread (isGuest: true, zero $exists: false)', () => {
    const indexes = AiChatThreadModel.schema.indexes();
    const ttlIndex = indexes.find(([, opts]) => opts?.name === 'guest_thread_ttl_30d');
    assert.ok(ttlIndex, 'AiChatThread schema must declare guest_thread_ttl_30d index');

    const [keys, opts] = ttlIndex;
    assert.deepEqual(keys, { lastMessageAt: 1 });
    assert.equal(opts.expireAfterSeconds, 30 * 24 * 60 * 60);
    assert.deepEqual(opts.partialFilterExpression, { isGuest: true });

    // Ensure no conflicting duplicate { lastMessageAt: 1 } index exists on the schema
    const lastMsgIndexes = indexes.filter(
      ([k]) => Object.keys(k).length === 1 && (k as Record<string, unknown>).lastMessageAt === 1
    );
    assert.equal(
      lastMsgIndexes.length,
      1,
      'AiChatThread must not declare a conflicting duplicate plain { lastMessageAt: 1 } index alongside TTL index'
    );
  });

  it('enforces strict CORS origin allowlist and rejects untrusted origins on GET & OPTIONS preflight', async () => {
    const allowedOrigins = getAllowedOrigins();
    assert.ok(allowedOrigins.length > 0, 'CORS allowlist must contain at least one configured origin');
    const trustedOrigin = allowedOrigins[0];

    const allowedGet = await fetch(`${baseUrl}/api/ai/quick-prompts`, {
      headers: { Origin: trustedOrigin },
    });
    assert.equal(allowedGet.status, 200);
    assert.equal(allowedGet.headers.get('access-control-allow-origin'), trustedOrigin);
    assert.equal(allowedGet.headers.get('access-control-allow-credentials'), 'true');

    const allowedPreflight = await fetch(`${baseUrl}/api/forum`, {
      method: 'OPTIONS',
      headers: {
        Origin: trustedOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization, Content-Type',
      },
    });
    assert.ok([200, 204].includes(allowedPreflight.status), `Expected 200/204 preflight, got ${allowedPreflight.status}`);
    assert.equal(allowedPreflight.headers.get('access-control-allow-origin'), trustedOrigin);

    const rejectedOrigins = [
      'https://evil-phishing.example',
      'http://localhost:9999',
      'https://lost.vn.attacker.example',
      'null',
    ];
    for (const badOrigin of rejectedOrigins) {
      const res = await fetch(`${baseUrl}/api/ai/quick-prompts`, {
        headers: { Origin: badOrigin },
      });
      assert.equal(
        res.headers.get('access-control-allow-origin'),
        null,
        `Untrusted origin "${badOrigin}" must NEVER receive Access-Control-Allow-Origin`
      );

      const preflight = await fetch(`${baseUrl}/api/forum`, {
        method: 'OPTIONS',
        headers: {
          Origin: badOrigin,
          'Access-Control-Request-Method': 'POST',
        },
      });
      assert.equal(
        preflight.headers.get('access-control-allow-origin'),
        null,
        `Preflight from untrusted origin "${badOrigin}" must NEVER receive Access-Control-Allow-Origin`
      );
    }
  });

  it('rejects expired JWTs, tampered JWT signatures, and malformed/expired refresh cookies with 401', async () => {
    const validAccess = generateToken('507f1f77bcf86cd799439011', 'trekker@lost.vn', 'user', 0);
    const [payloadPart, sigPart] = validAccess.split('.');
    const flippedLastChar = sigPart.endsWith('0') ? '1' : '0';
    const tamperedSigToken = `${payloadPart}.${sigPart.slice(0, -1)}${flippedLastChar}`;

    const forgedPayload = Buffer.from(
      JSON.stringify({
        userId: '507f1f77bcf86cd799439011',
        email: 'admin@lost.vn',
        role: 'admin',
        tokenVersion: 0,
        kind: 'access',
        iat: Date.now(),
        exp: Date.now() + 60_000,
      })
    ).toString('base64url');
    const tamperedPayloadToken = `${forgedPayload}.${sigPart}`;

    const expiredAccessToken = signCustomToken({
      userId: '507f1f77bcf86cd799439011',
      email: 'trekker@lost.vn',
      role: 'user',
      tokenVersion: 0,
      kind: 'access',
      iat: Date.now() - 120_000,
      exp: Date.now() - 60_000,
    });

    const badBearerTokens = [
      { label: 'expired access JWT', token: expiredAccessToken },
      { label: 'tampered signature JWT', token: tamperedSigToken },
      { label: 'tampered payload JWT', token: tamperedPayloadToken },
    ];

    for (const { label, token } of badBearerTokens) {
      for (const path of ['/api/auth/me', '/api/admin/stats', '/api/gear-packs/me']) {
        const res = await fetch(`${baseUrl}${path}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(res.status, 401, `${label} on GET ${path} must return 401 (got ${res.status})`);
        const body = (await res.json()) as { success?: boolean; message?: string };
        assert.equal(body.success, false);
        assert.equal(typeof body.message, 'string');
      }
    }

    const validRefresh = generateRefreshToken('507f1f77bcf86cd799439011', 'trekker@lost.vn', 'user', 0);
    const [rPayload, rSig] = validRefresh.split('.');
    const tamperedRefresh = `${rPayload}.${rSig.slice(0, -1)}${rSig.endsWith('a') ? 'b' : 'a'}`;
    const expiredRefresh = signCustomToken({
      userId: '507f1f77bcf86cd799439011',
      email: 'trekker@lost.vn',
      role: 'user',
      tokenVersion: 0,
      kind: 'refresh',
      iat: Date.now() - 120_000,
      exp: Date.now() - 10_000,
    });

    const invalidCookies = [
      { label: 'missing cookie', cookie: '' },
      { label: 'malformed cookie value', cookie: 'lost_refresh=not.a.valid.token' },
      { label: 'broken percent-encoding cookie', cookie: 'lost_refresh=%E0%A4%A' },
      { label: 'access token in refresh cookie', cookie: `lost_refresh=${encodeURIComponent(validAccess)}` },
      { label: 'tampered refresh cookie', cookie: `lost_refresh=${encodeURIComponent(tamperedRefresh)}` },
      { label: 'expired refresh cookie', cookie: `lost_refresh=${encodeURIComponent(expiredRefresh)}` },
    ];

    for (const { label, cookie } of invalidCookies) {
      const res = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: cookie ? { Cookie: cookie } : undefined,
      });
      assert.equal(res.status, 401, `POST /api/auth/refresh with ${label} must return 401 (got ${res.status})`);
      const body = (await res.json()) as { success?: boolean; message?: string };
      assert.equal(body.success, false);
      assert.equal(typeof body.message, 'string');
    }
  });

  it('returns clean 400/404 (never 500) for invalid ObjectIds & empty coordinate coercion across forum, trips, trip-reports, live-beacons, and weather', async () => {
    const fuzzedCases: Array<{ path: string; allowedStatuses: number[] }> = [
      { path: '/api/forum/not-an-oid', allowedStatuses: [400, 404] },
      { path: '/api/forum/threads/not-an-oid', allowedStatuses: [400] },
      { path: '/api/forum/threads/not-an-oid/comments', allowedStatuses: [400] },
      { path: '/api/trips/not-an-oid', allowedStatuses: [400] },
      { path: '/api/trip-reports/not-an-oid', allowedStatuses: [400] },
      { path: '/api/live-beacons/not-an-oid', allowedStatuses: [400, 404] },
      { path: '/api/weather/forecast?lat=&lng=', allowedStatuses: [400] },
      { path: '/api/weather/forecast?lat=not-a-num&lng=103.8', allowedStatuses: [400] },
    ];

    for (const { path, allowedStatuses } of fuzzedCases) {
      const res = await fetch(`${baseUrl}${path}`);
      assert.notEqual(res.status, 500, `GET ${path} must NEVER return 500`);
      assert.ok(
        allowedStatuses.includes(res.status),
        `GET ${path} expected status in [${allowedStatuses.join(', ')}], got ${res.status}`
      );
      const body = (await res.json()) as { success?: boolean; message?: string };
      assert.equal(body.success, false);
      assert.equal(typeof body.message, 'string');
      assert.ok((body.message || '').length > 0);
    }
  });

  it('clamps unbounded pagination queries and strips XSS payloads cleanly across live HTTP endpoints', async () => {
    // 1. Pagination upper & lower clamping across public listing endpoints
    const forumHighRes = await fetch(`${baseUrl}/api/forum?page=999999&limit=99999`);
    assert.equal(forumHighRes.status, 200);
    const forumHigh = (await forumHighRes.json()) as { pagination?: { page?: number; limit?: number } };
    assert.equal(forumHigh.pagination?.page, 1000, 'Forum page must clamp at 1000');
    assert.equal(forumHigh.pagination?.limit, 100, 'Forum limit must clamp at 100');

    const forumLowRes = await fetch(`${baseUrl}/api/forum?page=-5&limit=-20`);
    assert.equal(forumLowRes.status, 200);
    const forumLow = (await forumLowRes.json()) as { pagination?: { page?: number; limit?: number } };
    assert.equal(forumLow.pagination?.page, 1, 'Forum negative page must clamp to 1');
    assert.equal(forumLow.pagination?.limit, 1, 'Forum negative limit must clamp to 1');

    const tripsHighRes = await fetch(`${baseUrl}/api/trips?page=999999&limit=5000`);
    assert.equal(tripsHighRes.status, 200);
    const tripsHigh = (await tripsHighRes.json()) as { pagination?: { page?: number; limit?: number } };
    assert.equal(tripsHigh.pagination?.page, 1000, 'Trips page must clamp at 1000');
    assert.equal(tripsHigh.pagination?.limit, 50, 'Trips limit must clamp at 50');

    const reportsHighRes = await fetch(`${baseUrl}/api/trip-reports?page=50000&limit=999`);
    assert.equal(reportsHighRes.status, 200);
    const reportsHigh = (await reportsHighRes.json()) as { pagination?: { page?: number; limit?: number } };
    assert.equal(reportsHigh.pagination?.page, 1000, 'Trip reports page must clamp at 1000');
    assert.equal(reportsHigh.pagination?.limit, 50, 'Trip reports limit must clamp at 50');

    const activitiesHighRes = await fetch(`${baseUrl}/api/activities/community?page=999999&limit=9999`);
    assert.equal(activitiesHighRes.status, 200);
    const activitiesHigh = (await activitiesHighRes.json()) as { pagination?: { page?: number; limit?: number } };
    assert.equal(activitiesHigh.pagination?.page, 200, 'Community activities page must clamp at 200');
    assert.equal(activitiesHigh.pagination?.limit, 50, 'Community activities limit must clamp at 50');

    const trailsLimitedRes = await fetch(`${baseUrl}/api/trails?limit=5`);
    assert.equal(trailsLimitedRes.status, 200);
    const trailsLimited = (await trailsLimitedRes.json()) as { count?: number; data?: unknown[] };
    assert.ok(
      typeof trailsLimited.count === 'number' && trailsLimited.count <= 5 && (trailsLimited.data?.length ?? 0) <= 5,
      'GET /api/trails?limit=5 must cap returned array length at 5'
    );

    // 2. XSS payload stripping via live HTTP endpoints + sanitizeInput helper
    const xssTrailName = '<script>alert(1)</script>Fansipan';
    const xssProvince = '<img src=x onerror=alert(1)>Lào Cai';
    const promptsRes = await fetch(
      `${baseUrl}/api/ai/quick-prompts?trailName=${encodeURIComponent(xssTrailName)}&province=${encodeURIComponent(xssProvince)}`
    );
    assert.equal(promptsRes.status, 200);
    const promptsRaw = await promptsRes.text();
    assert.doesNotMatch(promptsRaw, /<script|<img|onerror=|javascript:/i, 'Quick prompts must strip injected XSS tags');
    assert.match(promptsRaw, /Fansipan/, 'Legitimate trail name text must remain intact after XSS sanitization');

    const bioRes = await fetch(`${baseUrl}/api/ai/bio-calc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trailName: '<svg onload="alert(1)">x</svg>javascript:alert(1) Tà Xùa',
        distanceKm: 14,
        elevationGainM: 1200,
        maxAltitudeM: 2865,
      }),
    });
    assert.equal(bioRes.status, 200);
    const bioRaw = await bioRes.text();
    assert.doesNotMatch(bioRaw, /<svg|onload=|javascript:/i, 'Bio-calc response must strip injected XSS payloads');
    assert.match(bioRaw, /Tà Xùa/, 'Vietnamese diacritics must survive XSS sanitization intact');

    // Direct sanitizeInput boundary matrix
    assert.equal(sanitizeInput('<script>evil()</script>Đỉnh Bạch Mộc 3.046m/ngày'), 'Đỉnh Bạch Mộc 3.046m/ngày');
    assert.equal(sanitizeInput('<iframe src="javascript:alert(1)">bad</iframe>An toàn'), 'An toàn');
    assert.equal(sanitizeInput('<img src=x onerror=alert(1)>Suối nước'), 'Suối nước');
    assert.equal(sanitizeInput('javascript:alert(1)vbscript:msgbox(1)Lào Cai'), 'alert(1)msgbox(1)Lào Cai');
    assert.equal(sanitizeInput('Hello\u0000\u0007World'), 'HelloWorld');
  });

  it('prevents parameterized /:id and /:slug routes from shadowing static endpoints across all routers', async () => {
    // /api/trips/calendar must NOT be shadowed by /api/trips/:id (which rejects "calendar" with 400 invalid ObjectId)
    const calRes = await fetch(`${baseUrl}/api/trips/calendar`);
    assert.equal(calRes.status, 200, `GET /api/trips/calendar must return 200 (got ${calRes.status})`);
    const calBody = (await calRes.json()) as { success?: boolean; days?: unknown; trips?: unknown };
    assert.equal(calBody.success, true);
    assert.ok(calBody.days && typeof calBody.days === 'object');
    assert.ok(Array.isArray(calBody.trips));

    // /api/trails/stats/summary and /api/trails/nearby must NOT be shadowed by /api/trails/:id
    const statsRes = await fetch(`${baseUrl}/api/trails/stats/summary`);
    assert.equal(statsRes.status, 200, `GET /api/trails/stats/summary must return 200 (got ${statsRes.status})`);
    const nearbyRes = await fetch(`${baseUrl}/api/trails/nearby?lat=22.3033&lng=103.775`);
    assert.equal(nearbyRes.status, 200, `GET /api/trails/nearby must return 200 (got ${nearbyRes.status})`);

    // /api/challenges/leaderboard must NOT be shadowed by /api/challenges/:slug
    const lbRes = await fetch(`${baseUrl}/api/challenges/leaderboard`);
    assert.equal(lbRes.status, 200, `GET /api/challenges/leaderboard must return 200 (got ${lbRes.status})`);

    // /api/weather/compare must NOT be shadowed by /api/weather/:trailId
    const cmpRes = await fetch(`${baseUrl}/api/weather/compare?ids=`);
    assert.equal(cmpRes.status, 400, `GET /api/weather/compare?ids= must hit compare handler (400), got ${cmpRes.status}`);

    // /api/notifications/read-all must route to auth-protected static handler (401, never 400 ObjectId error)
    const readAllRes = await fetch(`${baseUrl}/api/notifications/read-all`, { method: 'PUT' });
    assert.equal(readAllRes.status, 401);
  });

  it('DELETE /api/auth/me deletes 0-member TripPlans, transfers multi-member leadership, resets sharedGear & scrubs all Decree 13 PII', async () => {
    const userAId = new mongoose.Types.ObjectId();
    const userBId = new mongoose.Types.ObjectId();
    const soloTripId = new mongoose.Types.ObjectId();
    const soloGroupConvId = new mongoose.Types.ObjectId();
    const multiTripId = new mongoose.Types.ObjectId();
    const multiGroupConvId = new mongoose.Types.ObjectId();
    const selfConvId = new mongoose.Types.ObjectId();
    const dmConvId = new mongoose.Types.ObjectId();
    const passwordHash = await hashPasswordAsync('AlpineDelete#2026');

    const deletedTripIds: string[] = [];
    const tripUpdateCalls: Array<{ filter: any; update: any; options?: any }> = [];
    const deletedConvIds: string[] = [];
    const deletedMsgConvFilters: any[] = [];
    const pulledConvUpdates: Array<{ filter: any; update: any }> = [];
    const guideUpdateCalls: Array<{ filter: any; update: any }> = [];
    const incidentUpdateCalls: Array<{ filter: any; update: any }> = [];
    const notifUpdateCalls: Array<{ filter: any; update: any }> = [];
    const messageUpdateCalls: Array<{ filter: any; update: any }> = [];
    let deletedUserCalled = false;

    const origReadyDesc = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

    const makeChain = <T>(result: T) => ({
      select: () => ({
        lean: async () => result,
        then: (resolve: (v: T) => void) => resolve(result),
      }),
      lean: async () => result,
    });

    try {
      mock.method(UserModel, 'findById', () => ({
        select: async () => ({
          _id: userAId,
          email: 'departing@lost.vn',
          authProvider: 'local',
          passwordHash,
        }),
      }));
      mock.method(UserModel, 'find', () => makeChain([{ _id: userBId }]));
      mock.method(UserModel, 'deleteOne', async (filter: any) => {
        if (String(filter?._id) === userAId.toString()) deletedUserCalled = true;
        return { deletedCount: 1 } as any;
      });
      mock.method(UserModel, 'updateOne', async () => ({ modifiedCount: 1 }) as any);

      mock.method(FollowModel, 'find', () => makeChain([]));
      mock.method(FollowModel, 'deleteMany', async () => ({ deletedCount: 0 }) as any);

      mock.method(TripPlanModel, 'find', () =>
        makeChain([
          {
            _id: soloTripId,
            creatorId: userAId,
            currentMembers: [userAId],
            maxMembers: 6,
            status: 'recruiting',
            title: 'Chuyến Solo Fansipan',
            groupConversationId: soloGroupConvId,
          },
          {
            _id: multiTripId,
            creatorId: userAId,
            currentMembers: [userAId, userBId],
            maxMembers: 2,
            status: 'full',
            title: 'Đoàn Ghép Tà Xùa 2N1Đ',
            groupConversationId: multiGroupConvId,
          },
        ])
      );
      mock.method(TripPlanModel, 'deleteOne', async (filter: any) => {
        deletedTripIds.push(String(filter?._id));
        return { deletedCount: 1 } as any;
      });
      mock.method(TripPlanModel, 'updateOne', async (filter: any, update: any, options?: any) => {
        tripUpdateCalls.push({ filter, update, options });
        return { modifiedCount: 1 } as any;
      });

      mock.method(ConversationModel, 'find', () =>
        makeChain([
          { _id: selfConvId, participants: [userAId] },
          { _id: dmConvId, participants: [userAId, userBId] },
        ])
      );
      mock.method(ConversationModel, 'deleteOne', async (filter: any) => {
        deletedConvIds.push(String(filter?._id));
        return { deletedCount: 1 } as any;
      });
      mock.method(ConversationModel, 'deleteMany', async (filter: any) => {
        const ids = filter?._id?.$in || [];
        for (const id of ids) deletedConvIds.push(String(id));
        return { deletedCount: ids.length } as any;
      });
      mock.method(ConversationModel, 'updateOne', async (filter: any, update: any) => {
        pulledConvUpdates.push({ filter, update });
        return { modifiedCount: 1 } as any;
      });
      mock.method(ConversationModel, 'updateMany', async (filter: any, update: any) => {
        pulledConvUpdates.push({ filter, update });
        return { modifiedCount: 1 } as any;
      });

      mock.method(MessageModel, 'deleteMany', async (filter: any) => {
        deletedMsgConvFilters.push(filter);
        return { deletedCount: 1 } as any;
      });
      mock.method(MessageModel, 'updateMany', async (filter: any, update: any) => {
        messageUpdateCalls.push({ filter, update });
        return { modifiedCount: 1 } as any;
      });

      // Stub remaining collections touched by deleteMyAccount cleanly (0 real DB writes)
      for (const M of [
        SavedTrailModel,
        CheckinModel,
        SafetyTimerModel,
        ActivityModel,
        LiveBeaconModel,
        GearPackModel,
        CustomRouteModel,
        WeatherAlertSubModel,
        ItineraryModel,
        TrainingPlanModel,
        AiChatThreadModel,
        GearChecklistModel,
        GuideInquiryModel,
        TrailPoiModel,
        TripReportModel,
        UploadAssetModel,
        ChallengeClaimModel,
        TrailConditionModel,
      ]) {
        mock.method(M as any, 'deleteMany', async () => ({ deletedCount: 0 }));
      }
      for (const M of [
        CustomRouteModel,
        TrailPoiModel,
        TrailConditionModel,
        ContributionModel,
        ThreadModel,
        CommentModel,
        ReviewModel,
        TripReportModel,
        CommunityMessageModel,
      ]) {
        mock.method(M as any, 'updateMany', async () => ({ modifiedCount: 0 }));
      }
      mock.method(NotificationModel, 'deleteMany', async () => ({ deletedCount: 0 }) as any);
      mock.method(NotificationModel, 'create', async (doc: any) => ({ toObject: () => doc }) as any);
      mock.method(NotificationModel, 'updateMany', async (filter: any, update: any) => {
        notifUpdateCalls.push({ filter, update });
        return { modifiedCount: 1 } as any;
      });
      mock.method(GuideModel, 'updateMany', async (filter: any, update: any) => {
        guideUpdateCalls.push({ filter, update });
        return { modifiedCount: 1 } as any;
      });
      mock.method(IncidentModel, 'updateMany', async (filter: any, update: any) => {
        incidentUpdateCalls.push({ filter, update });
        return { modifiedCount: 1 } as any;
      });

      let statusCode = 200;
      let responseBody: any = null;
      const appendedHeaders: Record<string, string[]> = {};
      const req = {
        user: { userId: userAId.toString(), email: 'departing@lost.vn', role: 'user' },
        body: { confirmText: 'XÓA TÀI KHOẢN', currentPassword: 'AlpineDelete#2026' },
      } as unknown as AuthRequest;
      const res = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        append(name: string, val: string) {
          const key = name.toLowerCase();
          appendedHeaders[key] = [...(appendedHeaders[key] || []), val];
          return this;
        },
        json(payload: unknown) {
          responseBody = payload;
          return this;
        },
      } as unknown as ExpressResponse;

      await deleteMyAccount(req, res);

      assert.equal(statusCode, 200);
      assert.equal(responseBody?.success, true);
      assert.equal(deletedUserCalled, true, 'UserModel.deleteOne must be invoked');
      assert.ok(
        (appendedHeaders['set-cookie'] || []).some((c) => c.includes('lost_refresh=;') && c.includes('Max-Age=0')),
        'Must clear lost_refresh HttpOnly cookie on account deletion'
      );

      // 1. Creator-owned 0-member TripPlan + its group conversation MUST be deleted
      assert.deepEqual(deletedTripIds, [soloTripId.toString()], '0-member TripPlan must be deleted (and multi-member preserved)');
      assert.ok(deletedConvIds.includes(soloGroupConvId.toString()), '0-member TripPlan groupConversationId must be deleted');
      assert.ok(
        deletedMsgConvFilters.some((f) => String(f?.conversation) === soloGroupConvId.toString()),
        'Messages of deleted 0-member TripPlan group chat must be deleted'
      );

      // 2. Multi-member TripPlan MUST transfer creatorId -> userB, reopen status 'full' -> 'recruiting', reset sharedGear & scrub expenses
      const membershipUpdate = tripUpdateCalls.find(
        (c) => String(c.filter?._id) === multiTripId.toString() && c.update?.$pull?.currentMembers
      );
      assert.ok(membershipUpdate, 'Multi-member TripPlan must pull departed user from currentMembers & pendingRequests');
      assert.equal(
        String(membershipUpdate.update.$set?.creatorId),
        userBId.toString(),
        'Multi-member TripPlan must transfer creatorId to remaining live member'
      );
      assert.equal(membershipUpdate.update.$set?.status, 'recruiting', 'Full squad must reopen to recruiting after member leaves');
      assert.deepEqual(membershipUpdate.update.$set?.settledTransfers, []);

      const gearResetUpdate = tripUpdateCalls.find(
        (c) => String(c.filter?._id) === multiTripId.toString() && c.filter?.['sharedGear.assignedUserId']
      );
      assert.ok(gearResetUpdate, 'Multi-member TripPlan must reset sharedGear assigned to departed user');
      assert.equal(gearResetUpdate.update.$set?.['sharedGear.$[elem].assignedUserName'], 'Chưa nhận');
      assert.equal(gearResetUpdate.update.$set?.['sharedGear.$[elem].packed'], false);
      assert.ok('sharedGear.$[elem].assignedUserId' in (gearResetUpdate.update.$unset || {}));

      const expenseScrubUpdate = tripUpdateCalls.find(
        (c) => String(c.filter?._id) === multiTripId.toString() && c.filter?.['expenses.paidByUserId']
      );
      assert.ok(expenseScrubUpdate, 'Multi-member TripPlan must scrub expenses paidByName PII');
      assert.equal(expenseScrubUpdate.update.$set?.['expenses.$[elem].paidByName'], 'Tài khoản đã xóa');
      assert.ok('expenses.$[elem].paidByUserId' in (expenseScrubUpdate.update.$unset || {}));

      // 3. Conversations & Messages cascade (0-participant self-chat deleted, shared DM/group scrubbed & user pulled)
      assert.ok(deletedConvIds.includes(selfConvId.toString()), '0-participant conversation must be deleted');
      assert.ok(
        pulledConvUpdates.some((c) => c.update?.$pull?.participants && String(c.filter?._id) === multiGroupConvId.toString()),
        'Departed user must be pulled from retained squad group conversation'
      );
      assert.ok(
        messageUpdateCalls.some(
          (c) => c.update?.$set?.isDeleted === true && Array.isArray(c.update?.$set?.images) && c.update.$set.images.length === 0
        ),
        'Departed user sent messages must be scrubbed'
      );

      // 4. Decree 13 embedded PII scrubs (Guide reviews, Incident coReporters/timelineUpdates/disputes, Notification sender)
      assert.ok(
        guideUpdateCalls.some((c) => c.update?.$set?.['reviews.$[elem].userName'] === 'Tài khoản đã xóa'),
        'GuideModel embedded reviews must scrub userName'
      );
      assert.ok(
        incidentUpdateCalls.some((c) => c.update?.$set?.['coReporters.$[elem].userEmail'] === ''),
        'IncidentModel coReporters must scrub userEmail/userName/userAvatar'
      );
      assert.ok(
        incidentUpdateCalls.some((c) => c.update?.$set?.['timelineUpdates.$[elem].userEmail'] === ''),
        'IncidentModel timelineUpdates must scrub userEmail/userName/userAvatar'
      );
      assert.ok(
        incidentUpdateCalls.some((c) => c.update?.$set?.['disputes.$[elem].userEmail'] === ''),
        'IncidentModel disputes must scrub userEmail/userName'
      );
      assert.ok(
        notifUpdateCalls.some((c) => c.update?.$set?.['sender.name'] === 'Tài khoản đã xóa'),
        'NotificationModel sender PII must be scrubbed'
      );
    } finally {
      mock.restoreAll();
      if (origReadyDesc) {
        Object.defineProperty(mongoose.connection, 'readyState', origReadyDesc);
      } else {
        delete (mongoose.connection as any).readyState;
      }
    }
  });

  it('parseTrustProxySetting fails closed on false/0/off/no/empty/invalid inputs and allows strict hop counts & Express proxy keywords', () => {
    const warnings: string[] = [];
    const warnMock = mock.method(console, 'warn', (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    });

    try {
      // Disabled / falsy inputs MUST return false (never truthy hop count 1!)
      for (const raw of [undefined, '', '   ', 'false', 'FALSE', ' False ', '0', ' 0 ', '00', 'off', 'OFF', 'no', 'NO']) {
        assert.equal(parseTrustProxySetting(raw), false, `parseTrustProxySetting(${JSON.stringify(raw)}) must return false`);
      }
      assert.equal(warnings.length, 0, 'Valid disabled TRUST_PROXY values must not emit warnings');

      // Explicit boolean true maps to 1 hop (never blind Express `true`)
      assert.equal(parseTrustProxySetting('true'), 1);
      assert.equal(parseTrustProxySetting('TRUE'), 1);

      // Strict non-negative integer hop counts
      assert.equal(parseTrustProxySetting('1'), 1);
      assert.equal(parseTrustProxySetting('2'), 2);
      assert.equal(parseTrustProxySetting(' 3 '), 3);
      assert.equal(parseTrustProxySetting('50'), 10);

      // Express trusted proxy subnet keywords (normalized lowercase)
      assert.equal(parseTrustProxySetting('loopback'), 'loopback');
      assert.equal(parseTrustProxySetting('LOOPBACK'), 'loopback');
      assert.equal(parseTrustProxySetting('linklocal'), 'linklocal');
      assert.equal(parseTrustProxySetting('uniquelocal'), 'uniquelocal');

      // Garbage / negative / float inputs MUST fail closed to false + log warning
      for (const bad of ['invalid-garbage', '-1', '1.5', '1e2', 'false,1']) {
        const beforeCount = warnings.length;
        assert.equal(parseTrustProxySetting(bad), false, `Invalid TRUST_PROXY=${JSON.stringify(bad)} must fail closed to false`);
        assert.ok(warnings.length > beforeCount, `Invalid TRUST_PROXY=${JSON.stringify(bad)} must emit console.warn`);
      }
    } finally {
      warnMock.mock.restore();
    }
  });

  it('POST /api/auth/logout increments tokenVersion, immediately disconnects active user sockets, and clears refresh cookie', async () => {
    const userId = new mongoose.Types.ObjectId();
    const userIdStr = userId.toString();
    const updateCalls: Array<{ filter: unknown; update: unknown }> = [];
    const disconnectedRooms: string[] = [];

    const origReadyDesc = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

    try {
      mock.method(UserModel, 'updateOne', async (filter: unknown, update: unknown) => {
        updateCalls.push({ filter, update });
        return { modifiedCount: 1 } as any;
      });

      const io = getIO();
      assert.ok(io, 'Socket.IO server must be initialized');
      const origIn = io.in.bind(io);
      mock.method(io, 'in', (room: string | string[]) => {
        const op = origIn(room);
        const origDisconnect = op.disconnectSockets.bind(op);
        op.disconnectSockets = ((close?: boolean) => {
          disconnectedRooms.push(Array.isArray(room) ? room.join(',') : room);
          return origDisconnect(close);
        }) as typeof op.disconnectSockets;
        return op;
      });

      let responseBody: any = null;
      const appendedHeaders: Record<string, string[]> = {};
      const req = {
        user: { userId: userIdStr, email: 'logout-test@lost.vn', role: 'user' },
        headers: {},
      } as unknown as AuthRequest;
      const res = {
        append(name: string, val: string) {
          const key = name.toLowerCase();
          appendedHeaders[key] = [...(appendedHeaders[key] || []), val];
          return this;
        },
        json(payload: unknown) {
          responseBody = payload;
          return this;
        },
      } as unknown as ExpressResponse;

      await logout(req, res);

      assert.equal(responseBody?.success, true);
      assert.equal(updateCalls.length, 1, 'logout must increment tokenVersion once');
      assert.deepEqual(updateCalls[0], {
        filter: { _id: userIdStr },
        update: { $inc: { tokenVersion: 1 } },
      });
      assert.ok(
        disconnectedRooms.includes(`user:${userIdStr}`),
        `logout must immediately evict user room "user:${userIdStr}" sockets (got ${JSON.stringify(disconnectedRooms)})`
      );
      assert.ok(
        (appendedHeaders['set-cookie'] || []).some((c) => c.includes('lost_refresh=;') && c.includes('Max-Age=0')),
        'logout must clear lost_refresh HttpOnly cookie'
      );
    } finally {
      mock.restoreAll();
      if (origReadyDesc) {
        Object.defineProperty(mongoose.connection, 'readyState', origReadyDesc);
      } else {
        delete (mongoose.connection as any).readyState;
      }
    }
  });
});
