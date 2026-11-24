/**
 * LOST Service Worker - Offline 2D Basemap Tile & App Shell Caching
 * Provides resilient offline tile caching and SPA navigation across mountain areas with spotty or no cellular signal.
 * Never caches /api/*, /socket.io*, or AWS Terrarium 3D DEM heightmap tiles.
 */

const CACHE_STATIC = 'lost-static-v2';
const CACHE_TILES = 'lost-tiles-v1';
const CACHE_OFFLINE_PACKS = 'lost-offline-packs-v1';
const MAX_STATIC_ITEMS = 120;
const MAX_TILES_IN_CACHE = 450;
let tilePutCounter = 0;
let staticPutCounter = 0;

const STATIC_PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
];

const ALLOWED_2D_BASEMAP_HOST_PATTERNS = [
  /(^|\.)tile\.openstreetmap\.org$/i,
  /(^|\.)tile\.opentopomap\.org$/i,
  /^server\.arcgisonline\.com$/i,
  /(^|\.)cartocdn\.com$/i,
];

// Helper: Trim cache in FIFO order to stay well within browser storage quota
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const itemsToDelete = keys.slice(0, keys.length - maxItems);
      await Promise.all(itemsToDelete.map((key) => cache.delete(key)));
    }
  } catch (err) {
    console.warn('[SW] Error trimming cache:', err);
  }
}

// Strict 2D basemap allowlist: NEVER intercept AWS Terrarium 3D DEM heightmaps or arbitrary CDN photo URLs
function isMapTileUrl(parsedUrl) {
  const host = parsedUrl.hostname || '';
  const path = parsedUrl.pathname || '';
  if (
    host.includes('amazonaws.com') ||
    path.includes('elevation-tiles-prod') ||
    path.includes('/terrarium/')
  ) {
    return false;
  }
  return ALLOWED_2D_BASEMAP_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

// Extract canonical OSM Slippy tile URL (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`)
// so a/b/c OSM subdomains & offline basemap fallbacks resolve cleanly to downloaded Offline Trail Packs.
function toCanonicalOsmTileUrl(url) {
  // Esri ArcGIS World_Imagery uses /tile/{z}/{y}/{x} (y before x!)
  const esriMatch = url.match(/server\.arcgisonline\.com\/.*\/tile\/(\d+)\/(\d+)\/(\d+)/i);
  if (esriMatch) {
    const [, z, y, x] = esriMatch;
    return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  }
  // Standard Slippy Map /{z}/{x}/{y}[@2x].png (OSM a/b/c subdomains, OpenTopoMap, Carto standard & retina)
  const slippyMatch = url.match(/\/(\d+)\/(\d+)\/(\d+)(?:@\dx)?(?:\.(?:png|jpg|jpeg))?(?:\?.*)?$/i);
  if (slippyMatch) {
    const [, z, x, y] = slippyMatch;
    return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  }
  return null;
}

// Install Event: Pre-cache static app shell & PWA manifest
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

// Activate Event: Purge legacy static shell caches while preserving downloaded Offline Trail Packs
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
      .then(() => self.clients.claim())
  );
});

// Fetch Event: Intelligent offline strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // 1. Ignore non-GET requests and non-HTTP(S) schemes
  if (request.method !== 'GET' || !url.startsWith('http')) {
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return;
  }

  // Never intercept Socket.IO or API endpoints (strictly bypass auth, profile & dynamic API calls)
  if (
    parsedUrl.origin === self.location.origin &&
    (parsedUrl.pathname === '/api' ||
      parsedUrl.pathname.startsWith('/api/') ||
      parsedUrl.pathname.startsWith('/socket.io'))
  ) {
    return;
  }

  // 2. Allowlisted 2D Map Tiles: Cache-First checking Offline Trail Packs & bounded Dynamic Tile Cache
  if (isMapTileUrl(parsedUrl)) {
    // Bypass SW tile caches & 1x1 fallback PNG for explicit reload/no-store requests
    // (used by offlinePack.ts downloads & forceRefresh so fresh CORS tiles hit the network cleanly)
    if (request.cache === 'reload' || request.cache === 'no-store') {
      return;
    }

    event.respondWith(
      (async () => {
        const offlinePackCache = await caches.open(CACHE_OFFLINE_PACKS);

        // Exact match in Offline Trail Packs
        const packedTile = await offlinePackCache.match(request);
        if (packedTile) {
          return packedTile;
        }

        // Normalize a/b/c.tile.openstreetmap.org -> canonical tile.openstreetmap.org in Offline Packs
        const canonicalOsmUrl = toCanonicalOsmTileUrl(url);
        if (canonicalOsmUrl && parsedUrl.hostname.includes('tile.openstreetmap.org') && canonicalOsmUrl !== url) {
          const normalizedPacked = await offlinePackCache.match(canonicalOsmUrl);
          if (normalizedPacked) {
            return normalizedPacked;
          }
        }

        // Check dynamic tile cache
        const tileCache = await caches.open(CACHE_TILES);
        const cachedResponse = await tileCache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          // Only cache verified CORS image responses (never cache opaque responses, which incur ~7MB quota padding)
          const isValidCorsImage =
            networkResponse &&
            networkResponse.ok &&
            networkResponse.status === 200 &&
            (networkResponse.headers.get('content-type') || '').toLowerCase().startsWith('image/');

          if (isValidCorsImage) {
            await tileCache.put(request, networkResponse.clone());
            tilePutCounter += 1;
            if (tilePutCounter % 25 === 0) {
              void trimCache(CACHE_TILES, MAX_TILES_IN_CACHE);
            }
          }
          return networkResponse;
        } catch {
          // Offline basemap fallback: if Esri Satellite / OpenTopoMap / Carto fails offline,
          // serve matching {z}/{x}/{y} tile from downloaded OSM Offline Trail Packs!
          if (canonicalOsmUrl) {
            const fallbackPacked = await offlinePackCache.match(canonicalOsmUrl);
            if (fallbackPacked) {
              return fallbackPacked;
            }
            const fallbackDynamic = await tileCache.match(canonicalOsmUrl);
            if (fallbackDynamic) {
              return fallbackDynamic;
            }
          }

          // Offline transparent 1x1 PNG fallback for 2D Leaflet tiles (tagged so pack downloader never saves it)
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
      })()
    );
    return;
  }

  // 3. Same-origin Static Assets & App Shell: Stale-While-Revalidate with bounded cache size
  if (
    parsedUrl.origin === self.location.origin &&
    (parsedUrl.pathname.startsWith('/assets/') ||
      parsedUrl.pathname === '/manifest.json' ||
      parsedUrl.pathname.endsWith('.css') ||
      parsedUrl.pathname.endsWith('.js') ||
      parsedUrl.pathname.endsWith('.svg') ||
      parsedUrl.pathname.endsWith('.woff2'))
  ) {
    event.respondWith(
      caches.open(CACHE_STATIC).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            const isScriptOrStyle =
              parsedUrl.pathname.endsWith('.js') || parsedUrl.pathname.endsWith('.css');
            const responseContentType = (
              (networkResponse && networkResponse.headers.get('content-type')) ||
              ''
            ).toLowerCase();
            const isHtmlPoison = isScriptOrStyle && responseContentType.includes('text/html');
            if (networkResponse && networkResponse.status === 200 && !isHtmlPoison) {
              void cache.put(request, networkResponse.clone());
              staticPutCounter += 1;
              if (staticPutCounter % 15 === 0) {
                void trimCache(CACHE_STATIC, MAX_STATIC_ITEMS);
              }
            }
            return networkResponse;
          })
          .catch(() => cachedResponse || new Response('Offline asset unavailable', { status: 503 }));

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 4. Same-origin SPA navigation: Network-First & live refresh of cached /index.html for all hub routes
  if (parsedUrl.origin === self.location.origin && request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          const contentType = (networkResponse.headers.get('content-type') || '').toLowerCase();
          if (networkResponse.ok && contentType.includes('text/html')) {
            const cache = await caches.open(CACHE_STATIC);
            void cache.put('/index.html', networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const cache = await caches.open(CACHE_STATIC);
          const cachedIndex =
            (await cache.match('/index.html')) ||
            (await cache.match('/')) ||
            (await caches.match('/index.html')) ||
            (await caches.match('/'));
          return cachedIndex || new Response('Network offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
  }
});
