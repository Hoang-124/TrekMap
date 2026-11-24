import { Request, Response, NextFunction } from 'express';

interface CacheEntry {
  data: any;
  expiry: number;
}

const MAX_CACHE_ENTRIES = 500;
const memoryCache = new Map<string, CacheEntry>();

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiry <= now) {
      memoryCache.delete(key);
    }
  }
}, 60_000);
cleanupInterval.unref();

/**
 * Builds a canonical cache key with sorted query parameters and bounded key length
 * so reordered parameters or cache-busting junk cannot duplicate or flush the LRU.
 */
function buildCanonicalCacheKey(req: Request): string {
  const rawUrl = req.originalUrl || req.url || '/';
  const qIndex = rawUrl.indexOf('?');
  if (qIndex === -1) return `cache:${rawUrl}`;

  const pathPart = rawUrl.slice(0, qIndex);
  const params = new URLSearchParams(rawUrl.slice(qIndex + 1));
  const entries = Array.from(params.entries())
    .filter(([k]) => k && k !== '_' && k !== 't' && k !== 'ts' && k !== 'cb')
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) return `cache:${pathPart}`;
  const canonicalQuery = entries.map(([k, v]) => `${k}=${v}`).join('&').slice(0, 300);
  return `cache:${pathPart}?${canonicalQuery}`;
}

/**
 * Bounded LRU In-Memory Route Cache Middleware (public anonymous GET only)
 */
export const routeCache = (ttlSeconds: number = 300) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Always vary by Authorization & Accept-Encoding to prevent CDN/proxy cache poisoning
    res.vary('Authorization');
    res.vary('Accept-Encoding');

    // Only cache anonymous GET requests (never cache authenticated user responses)
    if (req.method !== 'GET' || req.headers?.authorization) {
      res.setHeader('Cache-Control', 'private, no-store');
      return next();
    }

    const key = buildCanonicalCacheKey(req);
    const cached = memoryCache.get(key);
    const now = Date.now();

    if (cached) {
      if (cached.expiry > now) {
        // Refresh LRU order
        memoryCache.delete(key);
        memoryCache.set(key, cached);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', `public, max-age=${Math.min(60, ttlSeconds)}, stale-while-revalidate=${ttlSeconds}`);
        return res.json(cached.data);
      }
      memoryCache.delete(key);
    }

    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      const status = res.statusCode ?? 200;
      if (status >= 200 && status < 300) {
        if (memoryCache.size >= MAX_CACHE_ENTRIES) {
          // Purge expired entries first before evicting LRU item
          const nowTs = Date.now();
          for (const [k, v] of memoryCache.entries()) {
            if (v.expiry <= nowTs) memoryCache.delete(k);
          }
          if (memoryCache.size >= MAX_CACHE_ENTRIES) {
            const oldestKey = memoryCache.keys().next().value;
            if (oldestKey) memoryCache.delete(oldestKey);
          }
        }
        memoryCache.set(key, {
          data: body,
          expiry: Date.now() + ttlSeconds * 1000,
        });
        res.setHeader('Cache-Control', `public, max-age=${Math.min(60, ttlSeconds)}, stale-while-revalidate=${ttlSeconds}`);
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    return next();
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
