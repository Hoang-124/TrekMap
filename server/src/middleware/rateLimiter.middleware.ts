import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
  expiresAt: number;
}

const MAX_KEYS_PER_LIMITER = 10_000;
const activeCleanupTimers = new Set<NodeJS.Timeout>();

/**
 * Clears all rate-limiter background cleanup intervals on graceful server shutdown.
 */
export const stopRateLimiterTimers = (): void => {
  for (const timer of activeCleanupTimers) {
    clearInterval(timer);
  }
  activeCleanupTimers.clear();
};

function createKeyedSlidingWindowLimiter(
  maxRequests: number,
  windowMs: number,
  message: string,
  prefix: string,
  resolveIdentity: (req: Request) => string
) {
  const store = new Map<string, RateLimitRecord>();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    const windowStart = now - windowMs;
    for (const [key, record] of store.entries()) {
      if (record.expiresAt <= now) {
        store.delete(key);
        continue;
      }
      const recent = record.timestamps.filter((ts) => ts > windowStart);
      if (recent.length === 0) {
        store.delete(key);
      } else if (recent.length !== record.timestamps.length) {
        record.timestamps = recent;
        record.expiresAt = recent[recent.length - 1] + windowMs;
      }
    }
  }, 60_000);
  cleanupTimer.unref();
  activeCleanupTimers.add(cleanupTimer);

  return (req: Request, res: Response, next: NextFunction) => {
    const identity = resolveIdentity(req);
    const key = `${prefix}:${identity}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    let record = store.get(key);

    if (record) {
      // Prune timestamps outside the active sliding window BEFORE checking quota
      record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

      if (record.timestamps.length >= maxRequests) {
        // Reject WITHOUT pushing `now` or extending `expiresAt` (prevents unbounded RAM DoS & permanent lockout)
        const oldestHit = record.timestamps[0] || now;
        const resetTime = oldestHit + windowMs;
        const retryAfterSec = Math.max(1, Math.ceil((resetTime - now) / 1000));

        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));
        res.setHeader('Retry-After', String(retryAfterSec));

        return res.status(429).json({
          success: false,
          message,
          retryAfterSec,
        });
      }

      record.timestamps.push(now);
      record.expiresAt = now + windowMs;
      // Refresh LRU ordering
      store.delete(key);
      store.set(key, record);
    } else {
      if (store.size >= MAX_KEYS_PER_LIMITER) {
        // Purge expired records first so active abusive buckets are not evicted
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
    }

    const count = record.timestamps.length;
    const oldestHit = record.timestamps[0] || now;
    const resetTime = oldestHit + windowMs;

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));

    return next();
  };
}

/**
 * True Bounded Sliding-Window In-Memory Rate Limiter Middleware (IP-keyed).
 * Checks quota before recording hits so 429 floods cannot grow RAM or lock out users permanently.
 */
export const createRateLimiter = (
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000,
  message: string = 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.',
  prefix: string = 'rl'
) =>
  createKeyedSlidingWindowLimiter(
    maxRequests,
    windowMs,
    message,
    prefix,
    (req) => req.ip || req.socket.remoteAddress || 'unknown-client'
  );

/**
 * Bounded Sliding-Window Rate Limiter keyed on authenticated userId (falls back to IP for guests).
 */
export const createUserRateLimiter = (
  maxRequests: number = 60,
  windowMs: number = 15 * 60 * 1000,
  message: string = 'Bạn thực hiện thao tác quá nhanh. Vui lòng thử lại sau.',
  prefix: string = 'url'
) =>
  createKeyedSlidingWindowLimiter(maxRequests, windowMs, message, prefix, (req) => {
    const uid = (req as Request & { user?: { userId?: string } }).user?.userId;
    if (uid) return `u:${uid}`;
    return `ip:${req.ip || req.socket.remoteAddress || 'unknown-client'}`;
  });

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
