import zlib from 'node:zlib';
import { Request, Response, NextFunction } from 'express';

const MIN_COMPRESS_BYTES = 1024;

/**
 * Non-blocking async HTTP Gzip compression middleware for JSON API payloads.
 * Runs zlib compression on Node's libuv worker pool so large GeoJSON/GPX responses
 * never block the main event loop.
 */
export const gzipCompression = (req: Request, res: Response, next: NextFunction) => {
  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  if (!acceptEncoding.includes('gzip') || req.method === 'HEAD') {
    return next();
  }

  const originalJson = res.json.bind(res);
  res.json = ((body: any) => {
    if (res.headersSent || res.statusCode === 204 || res.statusCode === 304) {
      return originalJson(body);
    }

    let payload: string;
    try {
      const serialized = JSON.stringify(body);
      if (typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf8') < MIN_COMPRESS_BYTES) {
        return originalJson(body);
      }
      payload = serialized;
    } catch {
      return originalJson(body);
    }

    zlib.gzip(payload, { level: zlib.constants.Z_BEST_SPEED }, (err, compressed) => {
      if (res.headersSent) return;
      if (err || !compressed) {
        originalJson(body);
        return;
      }
      res.setHeader('Content-Encoding', 'gzip');
      res.vary('Accept-Encoding');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Length', String(compressed.length));
      res.send(compressed);
    });

    return res;
  }) as typeof res.json;

  return next();
};
