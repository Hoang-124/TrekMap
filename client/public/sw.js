/**
 * TrekMap Service Worker - Offline Map & Asset Caching
 * Provides seamless offline tile caching for remote mountain areas with spotty or no cellular connectivity.
 */

const CACHE_STATIC = 'trekmap-static-v1';
const CACHE_TILES = 'trekmap-tiles-v1';
const MAX_TILES_IN_CACHE = 1500;

const STATIC_PRECACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icons.svg',
];

// Helper: Trim cache to avoid exceeding browser storage quota
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

// Check if request is a map tile
function isMapTileUrl(url) {
  return (
    url.includes('tile.openstreetmap.org') ||
    url.includes('cartocdn.com') ||
    url.includes('server.arcgisonline.com') ||
    url.includes('tile.opentopomap.org') ||
    url.includes('google.com/vt') ||
    url.includes('google.com/kh') ||
    /\/\d+\/\d+\/\d+(\.png|\.jpg|\.jpeg)/.test(url)
  );
}

// Install Event: Pre-cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.addAll(STATIC_PRECACHE).catch((err) => {
        console.warn('[SW] Pre-cache error:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up legacy caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_STATIC && key !== CACHE_TILES) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Intelligent offline strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // 1. Ignore non-GET requests and browser extensions
  if (request.method !== 'GET' || !url.startsWith('http')) {
    return;
  }

  // 2. Map Tiles: Cache-First with Network Fallback
  if (isMapTileUrl(url)) {
    event.respondWith(
      caches.open(CACHE_TILES).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
            // Periodically clean cache asynchronously
            trimCache(CACHE_TILES, MAX_TILES_IN_CACHE);
          }
          return networkResponse;
        } catch (fetchErr) {
          // If network is completely offline and not in cache, return transparent 1x1 png to avoid broken tile display
          return new Response(
            new Uint8Array([
              0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
              0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
              0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
              0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
              0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
              0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
            ]),
            { headers: { 'Content-Type': 'image/png' } }
          );
        }
      })
    );
    return;
  }

  // 3. Static Assets & App Shell: Stale-While-Revalidate
  if (
    url.includes('/assets/') ||
    url.endsWith('.css') ||
    url.endsWith('.js') ||
    url.endsWith('.svg') ||
    url.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.open(CACHE_STATIC).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 4. Fallback default network fetch
  event.respondWith(
    fetch(request).catch(async () => {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) return cachedResponse;
      if (request.mode === 'navigate') {
        return caches.match('/index.html');
      }
      return new Response('Network offline', { status: 503, statusText: 'Offline' });
    })
  );
});
