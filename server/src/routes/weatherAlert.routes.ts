import { Router, Response, NextFunction } from 'express';
import {
  getMyWeatherAlerts,
  upsertWeatherAlert,
  deleteWeatherAlert,
  evaluateMyWeatherAlerts,
} from '../controllers/weatherAlert.controller.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.middleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

interface UserRateBucket {
  timestamps: number[];
  expiresAt: number;
}

const MAX_USER_BUCKETS = 10_000;

/**
 * Per-authenticated-user sliding-window rate limiter (runs AFTER authMiddleware).
 * Prevents Vietnamese mobile CGNAT/shared-Wi-Fi users from locking each other out
 * and stops an authenticated user from rotating IPs to bypass Open-Meteo quotas.
 */
function createUserRateLimiter(
  maxRequests: number,
  windowMs: number,
  message: string,
  prefix: string
) {
  const store = new Map<string, UserRateBucket>();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, rec] of store.entries()) {
      if (rec.expiresAt <= now) store.delete(k);
    }
  }, 60_000);
  timer.unref();

  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const identity = userId ? `u:${userId}` : `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
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

// Generous pre-auth IP shield against unauthenticated floods (never blocks CGNAT users)
const weatherAlertIpShield = createRateLimiter(
  180,
  15 * 60 * 1000,
  'Hệ thống cảnh báo thời tiết đang nhận quá nhiều yêu cầu từ mạng này. Vui lòng thử lại sau.',
  'weather-alert-ip-shield'
);

const weatherAlertReadLimiter = createUserRateLimiter(
  60,
  15 * 60 * 1000,
  'Bạn tải danh sách cảnh báo thời tiết quá nhanh. Vui lòng đợi giây lát.',
  'weather-alert-read'
);

const weatherAlertWriteLimiter = createUserRateLimiter(
  30,
  15 * 60 * 1000,
  'Bạn cập nhật cảnh báo thời tiết quá nhanh. Vui lòng đợi ít phút.',
  'weather-alert-write'
);

const weatherAlertEvalLimiter = createUserRateLimiter(
  15,
  15 * 60 * 1000,
  'Bạn kiểm tra cảnh báo thời tiết quá thường xuyên. Vui lòng đợi ít phút.',
  'weather-alert-eval'
);

// Mounted at /api/weather-alerts (all routes enforce authMiddleware + per-user rate limiting)
router.get('/me', weatherAlertIpShield, authMiddleware as any, weatherAlertReadLimiter as any, getMyWeatherAlerts as any);
router.post('/evaluate', weatherAlertIpShield, authMiddleware as any, weatherAlertEvalLimiter as any, evaluateMyWeatherAlerts as any);
router.post('/', weatherAlertIpShield, authMiddleware as any, weatherAlertWriteLimiter as any, upsertWeatherAlert as any);
router.delete('/:trailId', weatherAlertIpShield, authMiddleware as any, weatherAlertWriteLimiter as any, deleteWeatherAlert as any);

export default router;
