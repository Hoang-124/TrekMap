import { Request, Response, NextFunction } from 'express';

interface CacheEntry {
  data: any;
  expiry: number;
}

const memoryCache = new Map<string, CacheEntry>();

/**
 * In-Memory Route Cache Middleware
 * @param ttlSeconds Time-to-live in seconds
 */
export const routeCache = (ttlSeconds: number = 300) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl || req.url}`;
    const cached = memoryCache.get(key);
    const now = Date.now();

    if (cached && cached.expiry > now) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached.data);
    }

    // Capture res.json to store in cache
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        memoryCache.set(key, {
          data: body,
          expiry: now + ttlSeconds * 1000,
        });
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
};

/**
 * Invalidate Cache by Prefix or Pattern
 */
export const invalidateCache = (prefix: string = '') => {
  if (!prefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.includes(prefix)) {
      memoryCache.delete(key);
    }
  }
};
