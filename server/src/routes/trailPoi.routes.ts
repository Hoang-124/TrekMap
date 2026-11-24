import { Router, Response, NextFunction } from 'express';
import {
  getTrailPoisByTrail,
  createTrailPoi,
  toggleConfirmTrailPoi,
  updateTrailPoiStatus,
  deleteTrailPoi,
  getPlatformPulse,
} from '../controllers/trailPoi.controller.js';
import { authMiddleware, optionalAuthMiddleware, type AuthRequest } from '../middleware/auth.middleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.middleware.js';

interface UserRateBucket {
  timestamps: number[];
  expiresAt: number;
}

const MAX_USER_BUCKETS = 10_000;

function createUserRateLimiter(maxRequests: number, windowMs: number, message: string, prefix: string) {
  const store = new Map<string, UserRateBucket>();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, rec] of store.entries()) {
      if (rec.expiresAt <= now) store.delete(k);
    }
  }, 60_000);
  timer.unref();

  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const identity = req.user?.userId ? `u:${req.user.userId}` : `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    const key = `${prefix}:${identity}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    let record = store.get(key);
    if (!record) {
      if (store.size >= MAX_USER_BUCKETS) {
        for (const [k, rec] of store.entries()) {
          if (rec.expiresAt <= now) store.delete(k);
        }
        if (store.size >= MAX_USER_BUCKETS) {
          const oldest = store.keys().next().value;
          if (oldest) store.delete(oldest);
        }
      }
      record = { timestamps: [now], expiresAt: now + windowMs };
      store.set(key, record);
    } else {
      record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
      record.timestamps.push(now);
      record.expiresAt = now + windowMs;
      store.delete(key);
      store.set(key, record);
    }

    const count = record.timestamps.length;
    const oldestHit = record.timestamps[0] || now;
    const resetTime = oldestHit + windowMs;

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));

    if (count > maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((resetTime - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({ success: false, message, retryAfterSec });
    }
    return next();
  };
}

// Separate read vs write IP limiters so heavy public browsing on shared CGNAT never locks out authenticated writes
const poiReadIpLimiter = createRateLimiter(
  240,
  15 * 60 * 1000,
  'Quá nhiều yêu cầu tải điểm thực địa từ mạng này. Vui lòng đợi giây lát.',
  'trail-poi-read-ip'
);
const poiWriteIpShield = createRateLimiter(
  180,
  15 * 60 * 1000,
  'Quá nhiều yêu cầu gửi điểm thực địa từ mạng này. Vui lòng thử lại sau.',
  'trail-poi-write-ip'
);
const poiCreateLimiter = createUserRateLimiter(
  20,
  15 * 60 * 1000,
  'Bạn báo điểm thực địa mới quá nhanh. Vui lòng đợi ít phút.',
  'trail-poi-create'
);
const poiConfirmLimiter = createUserRateLimiter(
  60,
  15 * 60 * 1000,
  'Bạn xác nhận điểm thực địa quá nhanh. Vui lòng đợi giây lát.',
  'trail-poi-confirm'
);
const poiManageLimiter = createUserRateLimiter(
  30,
  15 * 60 * 1000,
  'Bạn thao tác quản lý điểm thực địa quá nhanh. Vui lòng đợi ít phút.',
  'trail-poi-manage'
);
const pulseLimiter = createRateLimiter(
  120,
  15 * 60 * 1000,
  'Bạn tải dữ liệu nhịp đập thực địa quá nhanh. Vui lòng đợi giây lát.',
  'platform-pulse'
);

const router = Router();

// Mounted at /api/trail-pois
router.get('/trail/:trailId', poiReadIpLimiter, optionalAuthMiddleware as any, getTrailPoisByTrail as any);
router.post('/', poiWriteIpShield, authMiddleware as any, poiCreateLimiter as any, createTrailPoi as any);
router.post('/:id/confirm', poiWriteIpShield, authMiddleware as any, poiConfirmLimiter as any, toggleConfirmTrailPoi as any);
router.patch('/:id/status', poiWriteIpShield, authMiddleware as any, poiManageLimiter as any, updateTrailPoiStatus as any);
router.delete('/:id', poiWriteIpShield, authMiddleware as any, poiManageLimiter as any, deleteTrailPoi as any);

// Mounted at /api/analytics
export const analyticsRoutes = Router();
analyticsRoutes.get('/platform-pulse', pulseLimiter, getPlatformPulse);

export default router;
