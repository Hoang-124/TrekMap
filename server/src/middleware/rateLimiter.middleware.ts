import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
  expiresAt: number;
}

const MAX_KEYS_PER_LIMITER = 10_000;

/**
 * True Bounded Sliding-Window In-Memory Rate Limiter Middleware.
 * Uses isolated per-limiter storage, fixed bucket prefix (never req.path),
 * and expired-first eviction so rotating IPs cannot evict active abusive buckets.
 */
export const createRateLimiter = (
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000,
  message: string = 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.',
  prefix: string = 'rl'
) => {
  const store = new Map<string, RateLimitRecord>();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (record.expiresAt <= now) {
        store.delete(key);
      }
    }
  }, 60_000);
  cleanupTimer.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-client';
    const key = `${prefix}:${ip}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    let record = store.get(key);

    if (!record) {
      if (store.size >= MAX_KEYS_PER_LIMITER) {
        // Purge expired records first so active abusive IPs are not evicted
        for (const [k, rec] of store.entries()) {
          if (rec.expiresAt <= now) store.delete(k);
        }
        if (store.size >= MAX_KEYS_PER_LIMITER) {
          const oldestKey = store.keys().next().value;
          if (oldestKey) store.delete(oldestKey);
        }
      }
      record = {
        timestamps: [now],
        expiresAt: now + windowMs,
      };
      store.set(key, record);
    } else {
      // Drop timestamps outside sliding window and refresh LRU position
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
      return res.status(429).json({
        success: false,
        message,
        retryAfterSec,
      });
    }

    return next();
  };
};

export const globalRateLimiter = createRateLimiter(
  500,
  15 * 60 * 1000,
  'Hệ thống đang bận. Vui lòng thử lại sau vài phút.',
  'global'
);

export const authRateLimiter = createRateLimiter(
  20,
  15 * 60 * 1000,
  'Quá nhiều lần thử đăng nhập/đăng ký. Vui lòng đợi 15 phút.',
  'auth'
);

export const uploadRateLimiter = createRateLimiter(
  25,
  60 * 1000,
  'Tải ảnh quá nhanh. Vui lòng đợi 1 phút.',
  'upload'
);

export const aiRateLimiter = createRateLimiter(
  25,
  15 * 60 * 1000,
  'Bạn đã gửi quá nhiều câu hỏi tới trợ lý AI. Vui lòng thử lại sau ít phút.',
  'ai'
);

export const geocodeRateLimiter = createRateLimiter(
  20,
  60 * 1000,
  'Tra cứu tọa độ quá nhanh. Vui lòng đợi 1 phút.',
  'geocode'
);

export const inquiryRateLimiter = createRateLimiter(
  10,
  15 * 60 * 1000,
  'Bạn gửi yêu cầu đặt Porter/Guide quá nhanh. Vui lòng thử lại sau ít phút.',
  'inquiry'
);
