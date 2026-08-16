import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean expired records periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetTime <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

/**
 * Sliding-Window In-Memory Rate Limiter Middleware
 * @param maxRequests Maximum requests allowed within window
 * @param windowMs Window duration in milliseconds
 * @param message Custom message on limit exceeded
 */
export const createRateLimiter = (
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000,
  message: string = 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.'
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-client';
    const key = `${req.baseUrl || req.path}:${ip}`;
    const now = Date.now();

    let record = rateLimitStore.get(key);

    if (!record || record.resetTime <= now) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, record);
    } else {
      record.count += 1;
    }

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > maxRequests) {
      return res.status(429).json({
        success: false,
        message,
        retryAfterSec: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    next();
  };
};

export const globalRateLimiter = createRateLimiter(500, 15 * 60 * 1000, 'Hệ thống đang bận. Vui lòng thử lại sau vài phút.');
export const authRateLimiter = createRateLimiter(15, 15 * 60 * 1000, 'Quá nhiều lần thử đăng nhập/đăng ký. Vui lòng đợi 15 phút.');
export const uploadRateLimiter = createRateLimiter(25, 60 * 1000, 'Tải ảnh quá nhanh. Vui lòng đợi 1 phút.');
