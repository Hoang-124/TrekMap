import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

interface CacheEntry {
  data: unknown;
  etag: string;
  serialized?: string;
  expiry: number;
}

const MAX_CACHE_ENTRIES = 500;
const MAX_SERIALIZED_CACHE_BYTES = 1_500_000;
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

function computeWeakEtag(serialized: string): string {
  const byteLength = Buffer.byteLength(serialized, 'utf8');
  const digest = crypto.createHash('sha1').update(serialized).digest('base64url').slice(0, 16);
  return `W/"${byteLength.toString(16)}-${digest}"`;
}

function matchesIfNoneMatch(headerVal: string | string[] | undefined, etag: string): boolean {
  if (!headerVal || !etag) return false;
  const raw = Array.isArray(headerVal) ? headerVal.join(',') : headerVal;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed === '*') return true;

  const stripWeakPrefix = (tag: string) => tag.trim().replace(/^W\//i, '');
  const target = stripWeakPrefix(etag);
  return trimmed.split(',').some((candidate) => stripWeakPrefix(candidate) === target);
}

function isAuthenticatedRequest(req: Request): boolean {
  const authHeader = req.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.trim().length > 0) {
    return true;
  }
  return Boolean((req as Request & { user?: unknown }).user);
}

/**
 * Bounded LRU In-Memory Route Cache Middleware (public anonymous GET only)
 * Adds RFC-compliant Cache-Control (max-age + stale-while-revalidate) and Weak ETag
 * conditional 304 Not Modified responses so repeat navigations transfer 0 body bytes.
 */
export const routeCache = (ttlSeconds: number = 300) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Always vary by Authorization & Accept-Encoding to prevent CDN/proxy cache poisoning
    res.vary('Authorization');
    res.vary('Accept-Encoding');

    // Only cache anonymous GET requests (never cache or publicly tag authenticated responses)
    if (req.method !== 'GET' || isAuthenticatedRequest(req)) {
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

        const remainingSec = Math.max(1, Math.min(60, Math.floor((cached.expiry - now) / 1000)));
        res.setHeader('X-Cache', 'HIT');
        res.setHeader(
          'Cache-Control',
          `public, max-age=${remainingSec}, stale-while-revalidate=${ttlSeconds}`
        );
        if (cached.etag) {
          res.setHeader('ETag', cached.etag);
          if (matchesIfNoneMatch(req.headers['if-none-match'], cached.etag)) {
            return res.status(304).end();
          }
        }
        if (cached.serialized && res.locals) {
          (res.locals as Record<string, unknown>).__preSerializedJson = cached.serialized;
        }
        return res.json(cached.data);
      }
      memoryCache.delete(key);
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      const status = res.statusCode ?? 200;
      if (status >= 200 && status < 300 && !isAuthenticatedRequest(req)) {
        let serialized: string | undefined;
        let etag = '';
        try {
          const jsonStr = JSON.stringify(body);
          if (typeof jsonStr === 'string') {
            serialized = jsonStr;
            etag = computeWeakEtag(jsonStr);
          }
        } catch {
          // Non-serializable fallback handled by Express
        }

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

        const cacheableSerialized =
          serialized && Buffer.byteLength(serialized, 'utf8') <= MAX_SERIALIZED_CACHE_BYTES
            ? serialized
            : undefined;

        memoryCache.set(key, {
          data: body,
          etag,
          serialized: cacheableSerialized,
          expiry: Date.now() + ttlSeconds * 1000,
        });

        res.setHeader(
          'Cache-Control',
          `public, max-age=${Math.min(60, ttlSeconds)}, stale-while-revalidate=${ttlSeconds}`
        );
        res.setHeader('X-Cache', 'MISS');

        if (etag) {
          res.setHeader('ETag', etag);
          if (matchesIfNoneMatch(req.headers['if-none-match'], etag)) {
            res.status(304).end();
            return res;
          }
        }
        if (serialized && res.locals) {
          (res.locals as Record<string, unknown>).__preSerializedJson = serialized;
        }
        return originalJson(body);
      }

      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    }) as typeof res.json;

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
