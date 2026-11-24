import zlib from 'node:zlib';
import { Request, Response, NextFunction } from 'express';

const MIN_COMPRESS_BYTES = 1024;
type SupportedEncoding = 'br' | 'gzip';

function negotiateEncoding(acceptEncodingHeader: string): SupportedEncoding | null {
  if (!acceptEncodingHeader) return null;
  const lower = acceptEncodingHeader.toLowerCase();

  let brQ = 0;
  let gzipQ = 0;

  for (const part of lower.split(',')) {
    const [encRaw, ...params] = part.trim().split(';');
    const enc = encRaw.trim();
    if (enc !== 'br' && enc !== 'gzip') continue;

    let q = 1;
    for (const p of params) {
      const trimmed = p.trim();
      if (trimmed.startsWith('q=')) {
        const parsed = Number.parseFloat(trimmed.slice(2));
        if (Number.isFinite(parsed)) {
          q = Math.max(0, Math.min(1, parsed));
        }
      }
    }

    if (enc === 'br') brQ = Math.max(brQ, q);
    else if (enc === 'gzip') gzipQ = Math.max(gzipQ, q);
  }

  if (brQ > 0 && brQ >= gzipQ) return 'br';
  if (gzipQ > 0) return 'gzip';
  return null;
}

function isCompressibleContentType(rawType: string): boolean {
  const mime = rawType.split(';')[0].trim().toLowerCase();
  if (!mime || mime === 'text/event-stream') return false;
  if (mime.startsWith('text/')) return true;
  if (
    mime === 'application/json' ||
    mime === 'image/svg+xml' ||
    mime === 'application/javascript' ||
    mime === 'application/xml' ||
    mime === 'application/gpx+xml' ||
    mime === 'application/geo+json'
  ) {
    return true;
  }
  return mime.endsWith('+json') || mime.endsWith('+xml');
}

function compressAsync(
  input: Buffer,
  encoding: SupportedEncoding,
  callback: (err: Error | null, result: Buffer) => void
): void {
  if (encoding === 'br') {
    zlib.brotliCompress(
      input,
      {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
          [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
          [zlib.constants.BROTLI_PARAM_SIZE_HINT]: input.length,
        },
      },
      callback
    );
    return;
  }
  zlib.gzip(input, { level: zlib.constants.Z_BEST_SPEED }, callback);
}

/**
 * Non-blocking async HTTP Brotli / Gzip compression middleware for JSON, SVG, XML, and text payloads.
 * Prefers Brotli (`br`, quality 4 text mode) when accepted by the client and falls back to Gzip,
 * executing compression on Node's libuv worker pool so large GeoJSON/GPX payloads never block the event loop.
 */
export const gzipCompression = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'HEAD') {
    return next();
  }

  const encoding = negotiateEncoding(String(req.headers['accept-encoding'] || ''));
  if (!encoding) {
    return next();
  }

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = ((body: unknown) => {
    if (
      res.headersSent ||
      res.statusCode === 204 ||
      res.statusCode === 304 ||
      res.getHeader('Content-Encoding')
    ) {
      return originalJson(body);
    }

    const locals = res.locals as Record<string, unknown> | undefined;
    const preSerialized =
      locals && typeof locals.__preSerializedJson === 'string'
        ? locals.__preSerializedJson
        : undefined;
    if (locals && '__preSerializedJson' in locals) {
      delete locals.__preSerializedJson;
    }

    let payload: string;
    try {
      const serialized = preSerialized ?? JSON.stringify(body);
      if (typeof serialized !== 'string') {
        return originalJson(body);
      }
      payload = serialized;
    } catch {
      return originalJson(body);
    }

    const rawBuf = Buffer.from(payload, 'utf8');
    if (rawBuf.length < MIN_COMPRESS_BYTES) {
      return originalJson(body);
    }

    compressAsync(rawBuf, encoding, (err, compressed) => {
      if (res.headersSent) return;
      if (err || !compressed || compressed.length >= rawBuf.length) {
        originalJson(body);
        return;
      }
      res.setHeader('Content-Encoding', encoding);
      res.vary('Accept-Encoding');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Length', String(compressed.length));
      originalSend(compressed);
    });

    return res;
  }) as typeof res.json;

  res.send = ((body?: unknown) => {
    if (
      res.headersSent ||
      res.statusCode === 204 ||
      res.statusCode === 304 ||
      res.getHeader('Content-Encoding')
    ) {
      return originalSend(body);
    }

    const rawContentType = String(res.getHeader('Content-Type') || '');
    let rawBuf: Buffer | null = null;
    let effectiveContentType = rawContentType;

    if (typeof body === 'string') {
      effectiveContentType = rawContentType || 'text/html; charset=utf-8';
      if (isCompressibleContentType(effectiveContentType)) {
        rawBuf = Buffer.from(body, 'utf8');
      }
    } else if (Buffer.isBuffer(body)) {
      if (rawContentType && isCompressibleContentType(rawContentType)) {
        rawBuf = body;
      }
    }

    if (!rawBuf || rawBuf.length < MIN_COMPRESS_BYTES) {
      return originalSend(body);
    }

    const inputBuf = rawBuf;
    compressAsync(inputBuf, encoding, (err, compressed) => {
      if (res.headersSent) return;
      if (err || !compressed || compressed.length >= inputBuf.length) {
        originalSend(body);
        return;
      }
      res.setHeader('Content-Encoding', encoding);
      res.vary('Accept-Encoding');
      if (!rawContentType && effectiveContentType) {
        res.setHeader('Content-Type', effectiveContentType);
      }
      res.setHeader('Content-Length', String(compressed.length));
      originalSend(compressed);
    });

    return res;
  }) as typeof res.send;

  return next();
};

export const httpCompression = gzipCompression;
