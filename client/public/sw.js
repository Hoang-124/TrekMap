/**
 * LOST Service Worker - Offline Free-Commercial Map Tile & App Shell Caching (v5)
 * Caches ONLY 100% free commercial open-data tile hosts:
 *   - tiles.openfreemap.org (OpenFreeMap vector styles/tiles/glyphs)
 *   - s3.amazonaws.com/elevation-tiles-prod/terrarium/* (AWS Open Data Terrarium DEM)
 *   - gibs.earthdata.nasa.gov (NASA GIBS Public Domain satellite imagery)
 * Never caches /api/* or /socket.io*.
 */

const CACHE_STATIC = 'lost-static-v5';
const CACHE_TILES = 'lost-tiles-v1';
const CACHE_OFFLINE_PACKS = 'lost-offline-packs-v1';
const MAX_STATIC_ITEMS = 240;
const MAX_TILES_IN_CACHE = 450;
const NAV_FETCH_TIMEOUT_MS = 8000;
const TILE_FETCH_TIMEOUT_MS = 12000;
let tilePutCounter = 0;
let staticPutCounter = 0;

const STATIC_PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192.png',
];

const STATIC_PRECACHE_SET = new Set(STATIC_PRECACHE);

const MAP_TILE_HOSTS = [
  'tiles.openfreemap.org',
  's3.amazonaws.com',
  'gibs.earthdata.nasa.gov',
];

async function fetchWithTimeout(request, timeoutMs) {
  if (typeof AbortController === 'undefined') {
    return fetch(request);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function precacheHtmlAssets(htmlText, cache) {
  try {
    const assetMatches = htmlText.match(/(?:href|src)=["'](\/assets\/[^"']+\.(?:js|css))["']/g) || [];
    const urls = Array.from(
      new Set(
        assetMatches
          .map((m) => {
            const inner = m.match(/["'](\/assets\/[^"']+)["']/);
            return inner ? inner[1] : null;
          })
          .filter(Boolean)
      )
    );
    await Promise.all(
      urls.map(async (assetUrl) => {
        const existing = await cache.match(assetUrl);
        if (existing) return;
        const res = await fetchWithTimeout(assetUrl, TILE_FETCH_TIMEOUT_MS).catch(() => null);
        if (res && res.ok && res.status === 200) {
          await cache.put(assetUrl, res);
        }
      })
    );
  } catch {
    // Non-fatal: runtime SWR still caches chunks as visited
  }
}

async function trimCache(cacheName, maxItems, protectedPaths = null) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length <= maxItems) return;

    const excess = keys.length - maxItems;
    const evictable = protectedPaths
      ? keys.filter((key) => {
          try {
            return !protectedPaths.has(new URL(key.url).pathname);
          } catch {
            return true;
          }
        })
      : keys;

    const itemsToDelete = evictable.slice(0, excess);
    await Promise.all(itemsToDelete.map((key) => cache.delete(key)));
  } catch (err) {
    console.warn('[SW] Error trimming cache:', err);
  }
}

function classifyFreeMapTileUrl(parsedUrl) {
  const host = (parsedUrl.hostname || '').toLowerCase();
  const path = parsedUrl.pathname || '';
  if (!MAP_TILE_HOSTS.includes(host)) return null;

  if (host === 's3.amazonaws.com') {
    return path.startsWith('/elevation-tiles-prod/terrarium/') ? 'raster-dem' : null;
  }
  if (host === 'gibs.earthdata.nasa.gov') {
    return 'raster-satellite';
  }
  if (host === 'tiles.openfreemap.org') {
    return 'vector-openfreemap';
  }
  return null;
}

function createOfflineImageFallbackResponse() {
  return new Response(
    new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]),
    {
      headers: {
        'Content-Type': 'image/png',
        'X-Lost-Offline-Fallback': '1',
      },
    }
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_STATIC)
      .then((cache) =>
        cache.addAll(STATIC_PRECACHE).catch((err) => {
          console.warn('[SW] Pre-cache error:', err);
        })
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_STATIC && key !== CACHE_TILES && key !== CACHE_OFFLINE_PACKS) {
              return caches.delete(key);
            }
            return undefined;
          })
        )
      )
      .then(() =>
        Promise.all([
          trimCache(CACHE_STATIC, MAX_STATIC_ITEMS, STATIC_PRECACHE_SET),
          trimCache(CACHE_TILES, MAX_TILES_IN_CACHE),
        ])
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  if (request.method !== 'GET' || !url.startsWith('http')) {
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return;
  }

  if (
    parsedUrl.origin === self.location.origin &&
    (parsedUrl.pathname === '/api' ||
      parsedUrl.pathname.startsWith('/api/') ||
      parsedUrl.pathname.startsWith('/socket.io'))
  ) {
    return;
  }

  const tileKind = classifyFreeMapTileUrl(parsedUrl);
  if (tileKind) {
    if (request.cache === 'no-store') {
      return;
    }

    event.respondWith(
      (async () => {
        if (tileKind === 'raster-dem' || tileKind === 'vector-openfreemap') {
          const offlinePackCache = await caches.open(CACHE_OFFLINE_PACKS);
          const packedTile = await offlinePackCache.match(request);
          if (packedTile) {
            return packedTile;
          }
        }

        const tileCache = await caches.open(CACHE_TILES);
        const cachedResponse = await tileCache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetchWithTimeout(request, TILE_FETCH_TIMEOUT_MS);
          const contentType = (networkResponse.headers.get('content-type') || '').toLowerCase();
          const isCacheable =
            networkResponse &&
            networkResponse.ok &&
            networkResponse.status === 200 &&
            (tileKind === 'vector-openfreemap'
              ? !contentType.includes('text/html')
              : contentType.startsWith('image/'));

          if (isCacheable) {
            await tileCache.put(request, networkResponse.clone());
            tilePutCounter += 1;
            if (tilePutCounter === 1 || tilePutCounter % 15 === 0) {
              event.waitUntil(trimCache(CACHE_TILES, MAX_TILES_IN_CACHE));
            }
          }
          return networkResponse;
        } catch {
          if (tileKind === 'vector-openfreemap' || tileKind === 'raster-dem') {
            return new Response('Offline map tile unavailable', { status: 503 });
          }
          return createOfflineImageFallbackResponse();
        }
      })()
    );
    return;
  }

  if (
    parsedUrl.origin === self.location.origin &&
    (parsedUrl.pathname.startsWith('/assets/') ||
      parsedUrl.pathname.startsWith('/icons/') ||
      parsedUrl.pathname === '/manifest.json' ||
      parsedUrl.pathname.endsWith('.css') ||
      parsedUrl.pathname.endsWith('.js') ||
      parsedUrl.pathname.endsWith('.svg') ||
      parsedUrl.pathname.endsWith('.woff2'))
  ) {
    event.respondWith(
      caches.open(CACHE_STATIC).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        const fetchPromise = fetchWithTimeout(request, TILE_FETCH_TIMEOUT_MS)
          .then(async (networkResponse) => {
            const isScriptOrStyle =
              parsedUrl.pathname.endsWith('.js') || parsedUrl.pathname.endsWith('.css');
            const responseContentType = (
              (networkResponse && networkResponse.headers.get('content-type')) ||
              ''
            ).toLowerCase();
            const isHtmlPoison = isScriptOrStyle && responseContentType.includes('text/html');
            if (networkResponse && networkResponse.status === 200 && !isHtmlPoison) {
              await cache.put(request, networkResponse.clone());
              staticPutCounter += 1;
              if (staticPutCounter === 1 || staticPutCounter % 15 === 0) {
                await trimCache(CACHE_STATIC, MAX_STATIC_ITEMS, STATIC_PRECACHE_SET);
              }
            }
            return networkResponse;
          })
          .catch(() => cachedResponse || new Response('Offline asset unavailable', { status: 503 }));

        if (cachedResponse) {
          event.waitUntil(fetchPromise);
          return cachedResponse;
        }
        return fetchPromise;
      })
    );
    return;
  }

  if (parsedUrl.origin === self.location.origin && request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetchWithTimeout(request, NAV_FETCH_TIMEOUT_MS);
          const contentType = (networkResponse.headers.get('content-type') || '').toLowerCase();
          if (networkResponse.ok && contentType.includes('text/html')) {
            const cache = await caches.open(CACHE_STATIC);
            const htmlClone = networkResponse.clone();
            event.waitUntil(
              Promise.all([
                cache.put('/index.html', networkResponse.clone()),
                htmlClone.text().then((html) => precacheHtmlAssets(html, cache)),
              ])
            );
          }
          return networkResponse;
        } catch {
          const cache = await caches.open(CACHE_STATIC);
          const cachedIndex = (await cache.match('/index.html')) || (await cache.match('/'));
          return cachedIndex || new Response('Network offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
