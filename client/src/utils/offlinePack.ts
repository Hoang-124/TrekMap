import type { Trail } from '../types.js';
import { buildOfflineTileUrls } from './geoMath.js';
import { fetchWithTimeout } from './sessionHeaders.js';

const DB_NAME = 'lost_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'trail_packs';
const TILE_CACHE_NAME = 'lost-offline-packs-v1';
const DYNAMIC_TILE_CACHE_NAME = 'lost-tiles-v1';

export interface OfflineElevationSnapshot {
  source: string;
  fetchedAt: string;
  points: Array<{
    lat: number;
    lng: number;
    elevationM: number;
    distanceKm: number;
    slopePercent: number;
  }>;
}

export interface OfflineWeatherSnapshot {
  fetchedAt: string;
  hasWarning?: boolean;
  warningMessage?: string | null;
  days: Array<{
    forecastDate: string;
    tempMinC: number;
    tempMaxC: number;
    humidityPercent?: number;
    windSpeedKmH?: number;
    seaOfCloudsIndex?: number;
    weatherCondition?: string;
  }>;
}

export interface OfflineTrailPackRecord {
  trailId: string;
  trailName: string;
  province: string;
  savedAt: string;
  tileCount: number;
  totalRequestedTiles?: number;
  failedCount?: number;
  estimatedSizeMb: number;
  tileUrls: string[];
  trailData: Trail;
  elevationSnapshot?: OfflineElevationSnapshot;
  weatherSnapshot?: OfflineWeatherSnapshot;
}

export interface OfflineStorageStats {
  quotaSupported: boolean;
  usageMb: number;
  quotaMb: number;
  usagePercent: number;
  savedPacksCount: number;
  estimatedPacksMb: number;
  offlinePackTileCount: number;
  dynamicTileCount: number;
  estimatedDynamicMb: number;
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Trình duyệt không hỗ trợ IndexedDB.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'trailId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Không thể mở kho dữ liệu Offline.'));
  });
}

export async function getOfflineTrailPack(trailId: string): Promise<OfflineTrailPackRecord | null> {
  let db: IDBDatabase | null = null;
  try {
    db = await openOfflineDb();
    return await new Promise((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(trailId);
      req.onsuccess = () => resolve((req.result as OfflineTrailPackRecord) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

export async function listOfflineTrailPacks(): Promise<OfflineTrailPackRecord[]> {
  let db: IDBDatabase | null = null;
  try {
    db = await openOfflineDb();
    return await new Promise((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  } finally {
    db?.close();
  }
}

export async function getOfflineStorageStats(): Promise<OfflineStorageStats> {
  const packs = await listOfflineTrailPacks();
  const estimatedPacksMb =
    Math.round(packs.reduce((sum, p) => sum + (Number(p.estimatedSizeMb) || 0), 0) * 10) / 10;

  let offlinePackTileCount = 0;
  let dynamicTileCount = 0;

  if (typeof caches !== 'undefined') {
    try {
      const [packCache, dynCache] = await Promise.all([
        caches.open(TILE_CACHE_NAME),
        caches.open(DYNAMIC_TILE_CACHE_NAME),
      ]);
      const [packKeys, dynKeys] = await Promise.all([packCache.keys(), dynCache.keys()]);
      offlinePackTileCount = packKeys.length;
      dynamicTileCount = dynKeys.length;
    } catch {
      // ignore CacheStorage read errors
    }
  }

  const estimatedDynamicMb = Math.round(((dynamicTileCount * 28) / 1024) * 10) / 10;

  let quotaSupported = false;
  let usageMb = Math.round((estimatedPacksMb + estimatedDynamicMb) * 10) / 10;
  let quotaMb = 250;

  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
    try {
      const est = await navigator.storage.estimate();
      if (typeof est.usage === 'number' && typeof est.quota === 'number' && est.quota > 0) {
        quotaSupported = true;
        usageMb = Math.round((est.usage / (1024 * 1024)) * 10) / 10;
        quotaMb = Math.max(1, Math.round(est.quota / (1024 * 1024)));
      }
    } catch {
      // Fallback to estimated tile math
    }
  }

  const usagePercent = Math.min(100, Math.round((usageMb / Math.max(1, quotaMb)) * 1000) / 10);

  return {
    quotaSupported,
    usageMb,
    quotaMb,
    usagePercent,
    savedPacksCount: packs.length,
    estimatedPacksMb,
    offlinePackTileCount,
    dynamicTileCount,
    estimatedDynamicMb,
  };
}

export async function clearDynamicTileCache(): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  try {
    const cache = await caches.open(DYNAMIC_TILE_CACHE_NAME);
    const keys = await cache.keys();
    const removedCount = keys.length;
    await caches.delete(DYNAMIC_TILE_CACHE_NAME);
    return removedCount;
  } catch {
    return 0;
  }
}

export interface DownloadOfflinePackOptions {
  forceRefresh?: boolean;
  signal?: AbortSignal;
}

export async function downloadOfflineTrailPack(
  trail: Trail,
  onProgress?: (percent: number, fetchedTiles: number, totalTiles: number) => void,
  options?: DownloadOfflinePackOptions
): Promise<OfflineTrailPackRecord> {
  const track: [number, number][] =
    Array.isArray(trail.gpxTrack) && trail.gpxTrack.length >= 2
      ? trail.gpxTrack
      : [
          [trail.startLat, trail.startLng],
          [trail.endLat ?? trail.startLat, trail.endLng ?? trail.startLng],
        ];

  // Download legal AWS Open Data Terrarium DEM tiles (z=10..12 bbox + z=13 GPX corridor) alongside GPX/metadata/emergency JSON
  const tileUrls = buildOfflineTileUrls(track, [10, 11, 12, 13], 100);
  const totalRequestedTiles = tileUrls.length;
  let processedCount = 0;
  let succeededCount = 0;
  let failedCount = 0;
  const cachedTileUrls: string[] = [];
  const forceRefresh = Boolean(options?.forceRefresh);
  const signal = options?.signal;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Bạn đang ngoại tuyến — vui lòng kết nối mạng trước khi tải gói bản đồ Offline.');
  }

  // Opportunistically snapshot DEM elevation & 7-day weather in background for offline field access
  const snapshotPromise = Promise.allSettled([
    fetchWithTimeout(`/api/trails/${encodeURIComponent(trail.id)}/elevation`, { signal }, 10_000)
      .then((r) => (r.ok ? r.json() : null))
      .then((json): OfflineElevationSnapshot | undefined => {
        if (json?.success && Array.isArray(json.data?.points) && json.data.points.length >= 2) {
          return {
            source: String(json.data.source || 'dem'),
            fetchedAt: new Date().toISOString(),
            points: json.data.points.slice(0, 120),
          };
        }
        return undefined;
      }),
    fetchWithTimeout(`/api/weather/${encodeURIComponent(trail.id)}`, { signal }, 10_000)
      .then((r) => (r.ok ? r.json() : null))
      .then((json): OfflineWeatherSnapshot | undefined => {
        if (json?.success && Array.isArray(json.data) && json.data.length > 0) {
          return {
            fetchedAt: new Date().toISOString(),
            hasWarning: Boolean(json.hasWarning),
            warningMessage: json.warningMessage ?? null,
            days: json.data.slice(0, 7),
          };
        }
        return undefined;
      }),
  ]);

  onProgress?.(0, 0, totalRequestedTiles);

  if (typeof caches !== 'undefined' && totalRequestedTiles > 0) {
    const cache = await caches.open(TILE_CACHE_NAME);
    const BATCH_SIZE = 4;
    for (let i = 0; i < totalRequestedTiles; i += BATCH_SIZE) {
      if (signal?.aborted) {
        const abortErr = new Error('Đã hủy tải gói bản đồ ngoại tuyến.');
        abortErr.name = 'AbortError';
        throw abortErr;
      }
      const batch = tileUrls.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (url) => {
          try {
            const existing = !forceRefresh ? await cache.match(url) : undefined;
            const isExistingValid =
              Boolean(existing) &&
              existing?.type !== 'opaque' &&
              existing?.headers.get('x-lost-offline-fallback') !== '1';
            // Upgrade legacy opaque or fallback tiles cleanly to true CORS DEM image tiles
            if (isExistingValid) {
              succeededCount++;
              cachedTileUrls.push(url);
            } else {
              const res = await fetchWithTimeout(
                url,
                {
                  mode: 'cors',
                  cache: forceRefresh ? 'no-store' : 'default',
                  signal,
                },
                12_000
              );
              const contentType = (res.headers.get('content-type') || '').toLowerCase();
              const isSwFallback = res.headers.get('x-lost-offline-fallback') === '1';
              if (res.ok && !isSwFallback && contentType.startsWith('image/')) {
                await cache.put(url, res);
                succeededCount++;
                cachedTileUrls.push(url);
              } else {
                failedCount++;
              }
            }
          } catch {
            failedCount++;
          } finally {
            processedCount++;
            onProgress?.(
              Math.min(100, Math.round((processedCount / totalRequestedTiles) * 100)),
              succeededCount,
              totalRequestedTiles
            );
          }
        })
      );
    }

    if (signal?.aborted) {
      const abortErr = new Error('Đã hủy tải gói bản đồ ngoại tuyến.');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    if (succeededCount === 0) {
      throw new Error(
        'Không thể tải các ô bản đồ ngoại tuyến (0/' +
          totalRequestedTiles +
          ' thành công). Vui lòng kiểm tra kết nối mạng và thử lại.'
      );
    }
  } else {
    onProgress?.(100, 0, totalRequestedTiles);
  }

  const [elevSnapRes, weatherSnapRes] = await snapshotPromise;
  const elevationSnapshot = elevSnapRes.status === 'fulfilled' ? elevSnapRes.value : undefined;
  const weatherSnapshot = weatherSnapRes.status === 'fulfilled' ? weatherSnapRes.value : undefined;

  // Average AWS Terrarium DEM PNG tile ≈ 48 KB + JSON trail metadata/snapshots ≈ 0.18 MB
  const estimatedSizeMb = Math.max(0.2, Math.round(((succeededCount * 48) / 1024 + 0.18) * 10) / 10);

  const record: OfflineTrailPackRecord = {
    trailId: trail.id,
    trailName: trail.name,
    province: trail.province,
    savedAt: new Date().toISOString(),
    tileCount: succeededCount,
    totalRequestedTiles,
    failedCount,
    estimatedSizeMb,
    tileUrls: cachedTileUrls,
    trailData: trail,
    ...(elevationSnapshot ? { elevationSnapshot } : {}),
    ...(weatherSnapshot ? { weatherSnapshot } : {}),
  };

  const db = await openOfflineDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }

  return record;
}

export async function deleteOfflineTrailPack(trailId: string): Promise<void> {
  const allPacks = await listOfflineTrailPacks();
  const existing = allPacks.find((p) => p.trailId === trailId) || null;

  // Reference-count tiles shared with other saved Offline Trail Packs (e.g. neighboring Hoang Lien Son peaks)
  // so deleting one trail NEVER evicts shared tiles required by another downloaded trail!
  if (existing && typeof caches !== 'undefined' && existing.tileUrls?.length) {
    const protectedUrls = new Set<string>();
    for (const pack of allPacks) {
      if (pack.trailId === trailId) continue;
      if (Array.isArray(pack.tileUrls)) {
        for (const u of pack.tileUrls) {
          protectedUrls.add(u);
        }
      }
    }

    const deletableUrls = existing.tileUrls.filter((url) => !protectedUrls.has(url));
    if (deletableUrls.length > 0) {
      try {
        const cache = await caches.open(TILE_CACHE_NAME);
        await Promise.allSettled(deletableUrls.map((url) => cache.delete(url)));
      } catch {
        // ignore cache cleanup error
      }
    }
  }

  const db = await openOfflineDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(trailId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
