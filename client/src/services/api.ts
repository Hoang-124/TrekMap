import type { Trail, Incident, User, Review, NotificationCategory } from '../types.js';
import { mockTrails, mockIncidents } from '../data/seedData.js';
import {
  DEFAULT_API_TIMEOUT_MS,
  fetchWithTimeout,
  getApiHeaders,
  getClientSessionId,
  UPLOAD_API_TIMEOUT_MS,
} from '../utils/sessionHeaders.js';
import { safeLocalStorageGet } from '../utils/storageScope.js';
import { getOfflineTrailPack } from '../utils/offlinePack.js';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearReadNotifications,
} from './notificationService.js';

const API_BASE = '/api';

function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_API_TIMEOUT_MS
): Promise<Response> {
  return fetchWithTimeout(input, init, timeoutMs);
}

// ============================================================================
// IN-FLIGHT REQUEST DEDUPLICATION & BOUNDED SHORT-TTL READ CACHE
// Collapses duplicate concurrent GET requests across components into 1 network
// call and serves instant back-navigation hits with automatic write invalidation.
// ============================================================================

interface ReadCacheEntry {
  value: unknown;
  expiresAt: number;
}

interface CacheableReadResult<T> {
  value: T;
  cacheable: boolean;
}

const MAX_READ_CACHE_ENTRIES = 120;
const readCache = new Map<string, ReadCacheEntry>();
const inflightReads = new Map<string, Promise<unknown>>();
let readCacheEpoch = 0;

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The operation was aborted.', 'AbortError');
  }
  const err = new Error('The operation was aborted.');
  err.name = 'AbortError';
  return err;
}

function withAbortSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(createAbortError());

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(createAbortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (val) => {
        signal.removeEventListener('abort', onAbort);
        resolve(val);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      }
    );
  });
}

function cloneCachedValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return [...value] as unknown as T;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return { ...record, data: [...record.data] } as T;
    }
  }
  return value;
}

function getAuthCacheScope(): string {
  try {
    if (typeof localStorage === 'undefined') return 'anon';
    const token = localStorage.getItem('lost_token');
    if (!token) return 'anon';
    return `auth:${token.length}:${token.slice(-12)}`;
  } catch {
    return 'anon';
  }
}

/** Public read headers omit Authorization so logged-in users still hit server routeCache & 304 ETag */
function getPublicReadHeaders(): Record<string, string> {
  return { 'X-Client-Session-Id': getClientSessionId() };
}

export function invalidateApiReadCache(prefix?: string): void {
  readCacheEpoch += 1;
  if (!prefix) {
    readCache.clear();
    inflightReads.clear();
    return;
  }
  for (const key of readCache.keys()) {
    if (key.startsWith(prefix)) {
      readCache.delete(key);
    }
  }
  for (const key of inflightReads.keys()) {
    if (key.startsWith(prefix)) {
      inflightReads.delete(key);
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('lost:auth-changed', () => {
    invalidateApiReadCache();
  });
}

function cachedRead<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<CacheableReadResult<T>>,
  signal?: AbortSignal
): Promise<T> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  const now = Date.now();
  const cached = readCache.get(key);
  if (cached) {
    if (cached.expiresAt > now) {
      readCache.delete(key);
      readCache.set(key, cached);
      return Promise.resolve(cloneCachedValue(cached.value as T));
    }
    readCache.delete(key);
  }

  const existing = inflightReads.get(key) as Promise<T> | undefined;
  if (existing) {
    return withAbortSignal(
      existing.then((val) => cloneCachedValue(val)),
      signal
    );
  }

  const startEpoch = readCacheEpoch;
  const task: Promise<T> = fetcher()
    .then(({ value, cacheable }) => {
      if (cacheable && readCacheEpoch === startEpoch) {
        if (readCache.size >= MAX_READ_CACHE_ENTRIES) {
          const ts = Date.now();
          for (const [k, entry] of readCache.entries()) {
            if (entry.expiresAt <= ts) readCache.delete(k);
          }
          if (readCache.size >= MAX_READ_CACHE_ENTRIES) {
            const oldestKey = readCache.keys().next().value;
            if (oldestKey !== undefined) readCache.delete(oldestKey);
          }
        }
        readCache.set(key, {
          value,
          expiresAt: Date.now() + ttlMs,
        });
      }
      return value;
    })
    .finally(() => {
      if (inflightReads.get(key) === task) {
        inflightReads.delete(key);
      }
    });

  inflightReads.set(key, task);
  return withAbortSignal(
    task.then((val) => cloneCachedValue(val)),
    signal
  );
}

export async function uploadImageToCloudinary(
  imageBase64: string,
  filename?: string,
  category:
    | 'avatars'
    | 'trails'
    | 'forum'
    | 'reviews'
    | 'covers'
    | 'incidents'
    | 'trip-reports'
    | 'checkins'
    | 'guides'
    | 'custom-routes' = 'trails'
): Promise<string> {
  const res = await fetchWithTimeout(
    `${API_BASE}/upload`,
    {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ imageBase64, filename, category }),
    },
    UPLOAD_API_TIMEOUT_MS
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success || !json.url) {
    throw new Error(json.message || 'Không thể tải ảnh lên máy chủ. Vui lòng thử lại.');
  }
  return json.url;
}

export async function fetchTrails(params?: {
  region?: string;
  difficulty?: number;
  search?: string;
  duration?: number;
  season?: number;
  campsite?: boolean;
  kidFriendly?: boolean;
  sortBy?: string;
}): Promise<Trail[]> {
  const queryEntries: Array<[string, string]> = [];
  if (params?.region && params.region !== 'All') queryEntries.push(['region', params.region]);
  if (params?.difficulty) queryEntries.push(['difficulty', String(params.difficulty)]);
  if (params?.search) queryEntries.push(['search', params.search]);
  if (params?.duration) queryEntries.push(['duration', String(params.duration)]);
  if (params?.season) queryEntries.push(['season', String(params.season)]);
  if (params?.campsite) queryEntries.push(['campsite', 'true']);
  if (params?.kidFriendly) queryEntries.push(['kidFriendly', 'true']);
  if (params?.sortBy) queryEntries.push(['sortBy', params.sortBy]);
  queryEntries.sort(([a], [b]) => a.localeCompare(b));

  const query = new URLSearchParams(queryEntries);
  const queryString = query.toString();
  const cacheKey = `trails:${queryString}`;

  return cachedRead<Trail[]>(cacheKey, 30_000, async () => {
    let list: Trail[];
    let usedOfflineFallback = false;

    try {
      const url = queryString ? `${API_BASE}/trails?${queryString}` : `${API_BASE}/trails`;
      const res = await apiFetch(url);
      if (res.ok) {
        const json = await res.json();
        list = Array.isArray(json.data) ? json.data : [];
      } else {
        usedOfflineFallback = true;
        list = [...mockTrails];
      }
    } catch {
      usedOfflineFallback = true;
      list = [...mockTrails];
    }

    // Only merge local cached contributions when server is unreachable (approved DB contributions are already in /api/trails)
    if (usedOfflineFallback) {
      try {
        interface LocalContributionCacheItem {
          id?: string;
          _id?: string;
          status?: string;
          name?: string;
          altNames?: string[];
          region?: Trail['region'];
          province?: string;
          district?: string;
          hamlet?: string;
          distanceKm?: number;
          elevationGainM?: number;
          maxAltitudeM?: number;
          durationDays?: number;
          durationHoursNote?: string;
          difficultyLevel?: number;
          difficultyNote?: string;
          bestMonths?: number[];
          avoidMonths?: number[];
          startLat?: number;
          startLng?: number;
          endLat?: number;
          endLng?: number;
          description?: string;
          transportationInfo?: string;
          coverImage?: string;
          permitRequired?: boolean;
          permitInfo?: string;
          hasCampsite?: boolean;
          hasWaterSource?: boolean;
          kidFriendly?: boolean;
          gpxTrack?: [number, number][];
          waypoints?: Trail['waypoints'];
          createdAt?: string;
          updatedAt?: string;
          rescueContact?: Trail['rescueContact'];
          rating?: number;
          reviewCount?: number;
        }
        const localContribs: unknown = JSON.parse(localStorage.getItem('lost_contributions') || '[]');
        const approvedContribs: LocalContributionCacheItem[] = Array.isArray(localContribs)
          ? (localContribs as LocalContributionCacheItem[]).filter((c) => c?.status === 'approved')
          : [];

        const approvedTrails: Trail[] = approvedContribs.map((c) => ({
          id: c.id || `contrib-${c._id || Date.now()}`,
          name: c.name || 'Cung đường đóng góp',
          altNames: c.altNames || [],
          region: c.region || 'Miền Bắc',
          province: c.province || '',
          district: c.district || '',
          hamlet: c.hamlet || '',
          distanceKm: Number(c.distanceKm) || 0,
          elevationGainM: Number(c.elevationGainM) || 0,
          maxAltitudeM: Number(c.maxAltitudeM) || 0,
          durationDays: Number(c.durationDays) || Math.max(1, Math.ceil((Number(c.distanceKm) || 10) / 10)),
          durationHoursNote: c.durationHoursNote || '1 ngày',
          difficultyLevel: Number(c.difficultyLevel) || 3,
          difficultyNote: c.difficultyNote || ((Number(c.difficultyLevel) || 3) >= 4 ? 'Thử thách cao' : 'Trung bình'),
          bestMonths: Array.isArray(c.bestMonths) && c.bestMonths.length > 0 ? c.bestMonths : [10, 11, 12, 1, 2, 3, 4],
          avoidMonths: Array.isArray(c.avoidMonths) ? c.avoidMonths : [],
          startLat: Number(c.startLat) || 22.3364,
          startLng: Number(c.startLng) || 103.8438,
          endLat: Number(c.endLat) || Number(c.startLat) || 22.3364,
          endLng: Number(c.endLng) || Number(c.startLng) || 103.8438,
          description: c.description || '',
          transportationInfo: c.transportationInfo || '',
          coverImage: c.coverImage || '',
          galleryImages: c.coverImage ? [c.coverImage] : [],
          permitRequired: !!c.permitRequired,
          permitInfo: c.permitInfo || '',
          hasCampsite: !!c.hasCampsite,
          hasWaterSource: !!c.hasWaterSource,
          kidFriendly: !!c.kidFriendly,
          gpxTrack: Array.isArray(c.gpxTrack) && c.gpxTrack.length > 0
            ? c.gpxTrack
            : [[Number(c.startLat) || 22.3364, Number(c.startLng) || 103.8438]],
          waypoints: Array.isArray(c.waypoints) ? c.waypoints : [],
          status: 'approved',
          createdAt: c.createdAt || new Date().toISOString(),
          updatedAt: c.updatedAt || new Date().toISOString(),
          rescueContact: c.rescueContact || {
            name: 'Tổng đài Tìm kiếm Cứu nạn & PCCC Quốc gia',
            phone: '112 / 114',
            rangerContact: 'Hạt Kiểm Lâm địa phương',
          },
          rating: Number(c.rating) || 0,
          reviewCount: Number(c.reviewCount) || 0,
        }));

        const existingIds = new Set(list.map((t) => t.id));
        const newApproved = approvedTrails.filter((t) => !existingIds.has(t.id));
        list = [...newApproved, ...list];
      } catch {
        // ignore corrupted local storage
      }
    }

    // Single-pass client-side filter/sort guarantee (also covers offline fallback mode)
    const regionLower = params?.region && params.region !== 'All' ? params.region.toLowerCase() : null;
    const diffNum = params?.difficulty ? Number(params.difficulty) : null;
    const durNum = params?.duration ? Number(params.duration) : null;
    const seasonNum = params?.season ? Number(params.season) : null;
    const searchLower =
      params?.search && typeof params.search === 'string' && params.search.trim().length > 0
        ? params.search.trim().toLowerCase()
        : null;

    if (
      regionLower ||
      diffNum !== null ||
      durNum !== null ||
      seasonNum !== null ||
      params?.campsite ||
      params?.kidFriendly ||
      searchLower
    ) {
      list = list.filter((t) => {
        if (regionLower && (t?.region || '').toLowerCase() !== regionLower) return false;
        if (diffNum !== null && t?.difficultyLevel !== diffNum) return false;
        if (durNum !== null && (durNum >= 3 ? (t?.durationDays || 0) < 3 : t?.durationDays !== durNum)) return false;
        if (seasonNum !== null && (!Array.isArray(t?.bestMonths) || !t.bestMonths.includes(seasonNum))) return false;
        if (params?.campsite && !t?.hasCampsite) return false;
        if (params?.kidFriendly && !t?.kidFriendly) return false;
        if (searchLower) {
          const matched =
            (t?.name || '').toLowerCase().includes(searchLower) ||
            (t?.province || '').toLowerCase().includes(searchLower) ||
            (t?.district || '').toLowerCase().includes(searchLower) ||
            (t?.region || '').toLowerCase().includes(searchLower) ||
            (t?.description || '').toLowerCase().includes(searchLower);
          if (!matched) return false;
        }
        return true;
      });
    }

    if (params?.sortBy) {
      const s = params.sortBy;
      if (s === 'rating_desc' || s === 'rating') {
        list.sort((a, b) => (b?.rating || 0) - (a?.rating || 0));
      } else if (s === 'distance_asc') {
        list.sort((a, b) => (a?.distanceKm || 0) - (b?.distanceKm || 0));
      } else if (s === 'distance_desc') {
        list.sort((a, b) => (b?.distanceKm || 0) - (a?.distanceKm || 0));
      } else if (s === 'difficulty_asc') {
        list.sort((a, b) => (a?.difficultyLevel || 0) - (b?.difficultyLevel || 0));
      } else if (s === 'difficulty_desc') {
        list.sort((a, b) => (b?.difficultyLevel || 0) - (a?.difficultyLevel || 0));
      }
    }

    return { value: list, cacheable: !usedOfflineFallback };
  });
}

export async function fetchNearbyTrails(lat: number, lng: number, limit = 5): Promise<Trail[]> {
  try {
    const res = await apiFetch(`${API_BASE}/trails/nearby?lat=${lat}&lng=${lng}&limit=${limit}`);
    if (!res.ok) throw new Error('Spatial Query API error');
    const json = await res.json();
    if (json.data && Array.isArray(json.data) && json.data.length > 0) {
      return json.data;
    }
  } catch {
    // Offline fallback uses verified WGS84 Haversine distance against real Vietnam coordinates
  }

  const R = 6371;
  return mockTrails
    .map((t) => {
      const dLat = ((t.startLat - lat) * Math.PI) / 180;
      const dLon = ((t.startLng - lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat * Math.PI) / 180) * Math.cos((t.startLat * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distKm = Math.round(R * c * 10) / 10;
      const roadKm = Math.round(distKm * 1.8 * 10) / 10;
      const totalMinutes = Math.round((roadKm / 48) * 60);
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      const travelDurationFormatted = hours > 0 ? `${hours}h ${mins > 0 ? `${mins}p` : ''}`.trim() : `${mins} phút`;

      return {
        ...t,
        distanceFromUserKm: distKm,
        roadDistanceKm: roadKm,
        travelDurationMin: totalMinutes,
        travelDurationFormatted,
      };
    })
    .sort((a, b) => (a.distanceFromUserKm || 0) - (b.distanceFromUserKm || 0))
    .slice(0, limit);
}

export async function fetchTrailById(id: string): Promise<Trail | null> {
  const cleanId = String(id || '').trim();
  if (!cleanId) return null;

  return cachedRead<Trail | null>(`trail:${cleanId}`, 30_000, async () => {
    try {
      const res = await apiFetch(`${API_BASE}/trails/${encodeURIComponent(cleanId)}`);
      if (res.status === 404) return { value: null, cacheable: false };
      if (!res.ok) throw new Error('Trail fetch failed');
      const json = await res.json();
      const trail = json.data || null;
      return { value: trail, cacheable: Boolean(trail) };
    } catch {
      try {
        const offlinePack = await getOfflineTrailPack(cleanId);
        if (offlinePack?.trailData) {
          return { value: offlinePack.trailData, cacheable: false };
        }
      } catch {
        // IndexedDB unavailable
      }
      return { value: mockTrails.find((t) => t.id === cleanId) || null, cacheable: false };
    }
  });
}

export async function submitTrailContribution(trailData: Partial<Trail>): Promise<Trail> {
  const res = await apiFetch(`${API_BASE}/contributions`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(trailData),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể gửi hồ sơ đóng góp cung đường.');
  }
  invalidateApiReadCache('trails:');
  invalidateApiReadCache('trail:');
  invalidateApiReadCache('stats:');
  invalidateApiReadCache('analytics:');
  return json.data;
}

export async function updateTrailContribution(id: string, trailData: Partial<Trail>): Promise<Trail> {
  const res = await apiFetch(`${API_BASE}/contributions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(trailData),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể cập nhật hồ sơ đóng góp cung đường.');
  }
  invalidateApiReadCache('trails:');
  invalidateApiReadCache('trail:');
  invalidateApiReadCache('stats:');
  invalidateApiReadCache('analytics:');
  return json.data;
}

export async function submitReview(trailId: string, reviewData: Partial<Review>): Promise<Review> {
  const res = await apiFetch(`${API_BASE}/reviews`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...reviewData, trailId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Không thể gửi đánh giá cung đường. Vui lòng đăng nhập và thử lại.');
  }
  invalidateApiReadCache('trails:');
  invalidateApiReadCache('trail:');
  invalidateApiReadCache('stats:');
  invalidateApiReadCache('analytics:');
  return json.data;
}

export async function fetchIncidents(): Promise<Incident[]> {
  return cachedRead<Incident[]>('incidents:all', 20_000, async () => {
    try {
      const res = await apiFetch(`${API_BASE}/incidents`);
      if (!res.ok) throw new Error('Failed to fetch incidents');
      const json = await res.json();
      return { value: Array.isArray(json.data) ? json.data : [], cacheable: true };
    } catch {
      return { value: mockIncidents as Incident[], cacheable: false };
    }
  });
}

export async function submitIncident(incidentData: Partial<Incident>): Promise<Incident> {
  const res = await apiFetch(`${API_BASE}/incidents`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(incidentData),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Không thể gửi cảnh báo sự cố. Vui lòng kiểm tra đăng nhập và thử lại.');
  }
  invalidateApiReadCache('incidents:');
  invalidateApiReadCache('stats:');
  invalidateApiReadCache('analytics:');
  return json.data;
}

export async function confirmIncidentApi(
  incidentId: string,
  payload: {
    action?: 'confirm_true' | 'dispute_false';
    note?: string;
    additionalDescription?: string;
    severity?: string;
    reason?: string;
    reporterName?: string;
    reporterEmail?: string;
    reporterAvatar?: string;
  }
): Promise<{ success: boolean; message?: string; data?: Incident }> {
  const {
    reporterName: _ignoredReporterName,
    reporterEmail: _ignoredReporterEmail,
    reporterAvatar: _ignoredReporterAvatar,
    ...cleanPayload
  } = payload;
  const res = await apiFetch(`${API_BASE}/incidents/${encodeURIComponent(incidentId)}/confirm`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(cleanPayload),
  });
  const json = await res.json().catch(() => ({ success: false, message: 'Phản hồi máy chủ không hợp lệ.' }));
  if (!res.ok && json.success !== false) {
    return { ...json, success: false };
  }
  if (res.ok && json.success !== false) {
    invalidateApiReadCache('incidents:');
    invalidateApiReadCache('stats:');
    invalidateApiReadCache('analytics:');
  }
  return json;
}

export async function fetchUserProfile(userId: string): Promise<User | null> {
  try {
    const res = await apiFetch(`${API_BASE}/users/profile/${encodeURIComponent(userId)}`, {
      headers: getApiHeaders(),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

export async function fetchWeatherForecast(trailId: string, signal?: AbortSignal) {
  const cleanId = String(trailId || '').trim();
  return cachedRead(
    `weather:forecast:${cleanId}`,
    60_000,
    async () => {
      try {
        const res = await apiFetch(`${API_BASE}/weather/${encodeURIComponent(cleanId)}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          return {
            value: {
              success: false,
              data: [],
              hasWarning: false,
              warningMessage: null,
              error: json.message || 'Không thể tải dữ liệu thời tiết thực tế lúc này.',
            },
            cacheable: false,
          };
        }
        return { value: json, cacheable: true };
      } catch {
        return {
          value: {
            success: false,
            data: [],
            hasWarning: false,
            warningMessage: null,
            error: 'Không thể kết nối máy chủ thời tiết. Vui lòng thử lại sau.',
          },
          cacheable: false,
        };
      }
    },
    signal
  );
}

export async function createExpeditionItinerary(itineraryData: Record<string, unknown>) {
  const res = await apiFetch(`${API_BASE}/itineraries`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(itineraryData),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success || !json.data?.shareToken) {
    throw new Error(json.message || 'Không thể lưu lịch trình. Vui lòng đăng nhập và thử lại.');
  }
  try {
    const cached = JSON.parse(localStorage.getItem('lost_local_itineraries') || '{}');
    cached[json.data.shareToken] = { ...itineraryData, ...json.data };
    localStorage.setItem('lost_local_itineraries', JSON.stringify(cached));
  } catch {
    // ignore storage quota errors
  }
  return {
    ...json,
    shareUrl: `${window.location.origin}/#itinerary/${json.data.shareToken}`,
  };
}

export async function fetchItineraryByToken(shareToken: string) {
  try {
    const res = await apiFetch(`${API_BASE}/itineraries/share/${encodeURIComponent(shareToken)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.data) return json.data;
    }
  } catch {
    // Offline fallback only for locally cached itinerary shares
  }

  try {
    const cached = JSON.parse(localStorage.getItem('lost_local_itineraries') || '{}');
    if (cached[shareToken]) {
      return cached[shareToken];
    }
  } catch {
    // ignore corrupted cache
  }

  return null;
}

export async function reverseGeocode(lat: number, lng: number) {
  try {
    const res = await apiFetch(`${API_BASE}/geocode/reverse?lat=${lat}&lng=${lng}`);
    if (!res.ok) throw new Error('Geocoding API error');
    const json = await res.json();
    return json.data;
  } catch {
    return {
      formattedAddress: `Tọa độ (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      province: 'Việt Nam',
      district: 'Khu vực núi',
    };
  }
}

// Notification API helpers delegated to single source of truth (notificationService.ts)
export async function fetchNotificationsApi(params?: { category?: string; page?: number; limit?: number }) {
  const token = safeLocalStorageGet('lost_token');
  if (!token) return { success: false, data: [], unreadCount: 0, totalCount: 0, categoryCounts: {} };
  const result = await fetchNotifications(
    params?.page || 1,
    params?.limit || 30,
    (params?.category as NotificationCategory | 'all' | undefined) || 'all'
  );
  return {
    success: true,
    data: result.notifications,
    unreadCount: result.unreadCount,
    totalCount: result.totalCount,
    categoryCounts: result.categoryCounts,
  };
}

export async function markNotificationReadApi(id: string) {
  const success = await markNotificationAsRead(id);
  return { success };
}

export async function markAllNotificationsReadApi(category?: string) {
  const success = await markAllNotificationsAsRead(category);
  return { success };
}

export async function deleteNotificationApi(id: string) {
  const success = await deleteNotification(id);
  return { success };
}

export async function clearReadNotificationsApi() {
  const success = await clearReadNotifications();
  return { success };
}

/* ============================================================================
 * WAVE 2B EXPANSION API HELPERS (Challenges, Training, Directory, Logbook,
 * Custom Routes, Trips Calendar & Follow Wiring)
 * ============================================================================ */

export interface SummitChallengeItem {
  _id?: string;
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  badgeName: string;
  tier: 'bronze' | 'silver' | 'gold' | 'alpine_legend';
  region: string;
  ruleType: 'trail_slugs' | 'altitude_threshold' | 'cumulative_km' | 'cumulative_gain';
  requiredTrailSlugs: string[];
  minAltitudeM?: number;
  targetCount: number;
  targetKm?: number;
  targetGainM?: number;
  rewardPoints: number;
  coverImage?: string;
  completedTrailSlugs?: string[];
  progressCount?: number;
  progressPercent?: number;
  isCompleted?: boolean;
  isClaimed?: boolean;
  verifiedCount?: number;
}

export interface PeakPassportData {
  stampedPeaks: Array<{
    trailId: string;
    trailSlug?: string;
    trailName: string;
    province?: string;
    region?: string;
    maxAltitudeM: number;
    distanceKm: number;
    elevationGainM?: number;
    checkinDate: string;
    verifiedByGps: boolean;
  }>;
  altitudeTiers?: Record<string, number>;
  regionProgress?: Array<{ region: string; conquered: number; total: number; percent: number }>;
  claimedChallenges?: Array<{ challengeSlug: string; badgeName: string; pointsAwarded: number; claimedAt: string }>;
  readyToClaimSlugs?: string[];
  explorerRank?: string;
  summary?: {
    uniquePeaks: number;
    verifiedPeaks: number;
    totalKm: number;
    totalElevationGainM: number;
    highestAltitudeM: number;
  };
}

export interface ChallengeLeaderboardEntry {
  userId: string;
  fullName: string;
  username?: string;
  avatarUrl?: string;
  trailsConquered: number;
  verifiedPeaks: number;
  totalUniqueKm: number;
  totalElevationGainM: number;
  highestAltitudeM: number;
  badgesCount: number;
  reputationScore?: number;
}

export interface TrainingSessionItem {
  id: string;
  week: number;
  dayOfWeek: number;
  title: string;
  category: 'cardio' | 'leg_strength' | 'stair_elevation' | 'pack_walk' | 'recovery';
  durationMin: number;
  targetElevationM?: number;
  packWeightKg?: number;
  notes?: string;
  completed: boolean;
  completedAt?: string;
}

export interface TrainingPlanItem {
  _id: string;
  id?: string;
  targetTrailId?: string;
  targetTrailSlug?: string;
  targetTrailName: string;
  targetDate: string;
  durationWeeks: 4 | 6 | 8;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  status: 'active' | 'completed' | 'abandoned';
  sessions: TrainingSessionItem[];
  readinessScore: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DirectoryGuideItem {
  _id?: string;
  id?: string;
  slug?: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  region: string;
  provinces?: string[];
  roleType?: 'guide' | 'porter' | 'operator';
  trailSlugs?: string[];
  specialties?: string[];
  languages?: string[];
  experienceYears?: number;
  basePricePerDayVnd?: number;
  maxGroupSize?: number;
  certifications?: string[];
  bio?: string;
  priceNote: string;
  rating: number;
  reviewCount?: number;
  verified: boolean;
}

export interface RangerStationItem {
  _id?: string;
  slug: string;
  name: string;
  authorityType: 'national_park' | 'ranger_station' | 'border_guard' | 'rescue_center';
  region: string;
  province: string;
  district?: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  hotlinePhone: string;
  emergencyPhone?: string;
  permitRequired: boolean;
  permitLeadDays?: number;
  permitFeeNote?: string;
  officeHours?: string;
  coveredTrailSlugs?: string[];
  officialWebsite?: string;
  verifiedSource?: string;
}

export interface ApiPagination {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasMore?: boolean;
}

export interface GuideInquiryItem {
  _id: string;
  guideId: string | { _id?: string; id?: string; name?: string; phone?: string; region?: string };
  trailId?: string | { _id?: string; id?: string; name?: string; province?: string; region?: string } | null;
  trailName: string;
  plannedStartDate: string;
  durationDays: number;
  groupSize: number;
  needPortersCount: number;
  contactPhone: string;
  notes?: string;
  estimatedTotalVnd: number;
  status: 'pending' | 'contacted' | 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface TripCostEstimate {
  trailId?: string;
  trailName?: string;
  groupSize: number;
  days: number;
  currency: string;
  breakdown: {
    permitAndParkFeeVnd: number;
    guideFeeVnd: number;
    porterFeeVnd: number;
    foodAndCampVnd: number;
    transportVnd: number;
  };
  totalGroupVnd: number;
  perPersonVnd: number;
  notes?: string[];
}

export interface LogbookEntryItem {
  _id: string;
  trailId:
    | string
    | { _id?: string; id?: string; name?: string; province?: string; region?: string; maxAltitudeM?: number };
  trailSlug?: string;
  trailName?: string;
  checkinDate: string;
  verifiedByGps?: boolean;
  distanceRecordedKm?: number;
  elevationGainRecordedM?: number;
  weatherObserved?: string;
  packWeightKg?: number;
  notes?: string;
  companionsCount?: number;
  isPublic?: boolean;
  photos?: string[];
}

export interface LogbookAnalyticsData {
  summary: {
    uniqueTrails: number;
    totalTrips: number;
    verifiedGpsPercent: number;
    totalKm: number;
    totalElevationGainM: number;
    totalHours?: number;
    highestPeakM: number;
    avgPaceKmPerTrip?: number;
  };
  monthlySeries: Array<{ month: string; trips: number; distanceKm: number; elevationGainM: number }>;
  regionBreakdown: Array<{ region: string; conquered: number; total: number; percent: number }>;
  difficultyDistribution: Array<{ level: number; count: number }>;
  personalRecords?: Record<string, unknown>;
}

export interface CustomRouteMetrics {
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  maxAltitudeM: number;
  minAltitudeM: number;
  maxSlopePercent: number;
  naismithHours: number;
  toblerHours?: number;
  difficultyEstimate: number;
}

export interface CustomRouteItem {
  _id?: string;
  id?: string;
  shareSlug: string;
  title: string;
  description?: string;
  region?: string;
  province?: string;
  baseTrailId?: string;
  waypoints: Array<{
    id: string;
    name: string;
    type: string;
    lat: number;
    lng: number;
    elevationM?: number;
    note?: string;
  }>;
  trackPoints: [number, number][];
  metrics: CustomRouteMetrics;
  visibility: 'private' | 'unlisted' | 'public';
  likesCount?: number;
  viewsCount?: number;
  isLiked?: boolean;
  creatorId?: string | { _id?: string; id?: string; fullName?: string; username?: string; avatarUrl?: string };
  createdAt?: string;
}

interface ApiJsonEnvelope<T = unknown> {
  success?: boolean;
  message?: string;
  data?: T;
  pagination?: ApiPagination;
  source?: 'database' | 'fallback';
  cached?: boolean;
  fetchedAt?: string;
  bestWeatherTrailId?: string | null;
  bestCloudTrailId?: string | null;
  summary?: Record<string, unknown>;
  activeReadiness?: number;
  maxPacks?: number;
  liked?: boolean;
  likesCount?: number;
  isFollowing?: boolean;
  following?: boolean;
  followersCount?: number;
  followingCount?: number;
  year?: number;
  month?: number;
  days?: Record<string, Record<string, unknown>[]>;
  trips?: Record<string, unknown>[];
  count?: number;
  totalCount?: number;
  maxLimit?: number;
  maxPerTrail?: number;
  evaluatedCount?: number;
  notificationsCreated?: number;
  hasUpvoted?: boolean;
  upvoteCount?: number;
  lastConfirmedAt?: string | null;
  trailId?: string;
  trailName?: string;
  maxAltitudeM?: number;
  months?: unknown[];
}

async function parseJsonSafe<T = unknown>(res: Response): Promise<ApiJsonEnvelope<T>> {
  try {
    const parsed: unknown = await res.json();
    return parsed && typeof parsed === 'object' ? (parsed as ApiJsonEnvelope<T>) : {};
  } catch {
    return {};
  }
}

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return '';
  const query = new URLSearchParams();
  Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'All') {
        query.append(k, String(v));
      }
    });
  const str = query.toString();
  return str ? `?${str}` : '';
}

// --- Challenges & Peak Passport ---

export async function fetchSummitChallenges(params?: { region?: string }): Promise<SummitChallengeItem[]> {
  const qs = buildQuery(params);
  return cachedRead<SummitChallengeItem[]>(
    `challenges:${getAuthCacheScope()}:${qs}`,
    30_000,
    async () => {
      try {
        const res = await apiFetch(`${API_BASE}/challenges${qs}`, {
          headers: getApiHeaders(),
        });
        const json = await parseJsonSafe<SummitChallengeItem[]>(res);
        if (!res.ok || !json.success) return { value: [], cacheable: false };
        return { value: Array.isArray(json.data) ? json.data : [], cacheable: true };
      } catch {
        return { value: [], cacheable: false };
      }
    }
  );
}

export async function fetchPeakPassport(): Promise<PeakPassportData | null> {
  try {
    const res = await apiFetch(`${API_BASE}/challenges/passport/me`, {
      headers: getApiHeaders(),
    });
    const json = await parseJsonSafe<PeakPassportData>(res);
    if (!res.ok || !json.success) return null;
    return json.data || null;
  } catch {
    return null;
  }
}

export async function fetchChallengeLeaderboard(params?: {
  region?: string;
  limit?: number;
}): Promise<ChallengeLeaderboardEntry[]> {
  const qs = buildQuery(params);
  return cachedRead<ChallengeLeaderboardEntry[]>(
    `challenges:leaderboard:${qs}`,
    30_000,
    async () => {
      try {
        const res = await apiFetch(`${API_BASE}/challenges/leaderboard${qs}`, {
          headers: getPublicReadHeaders(),
        });
        const json = await parseJsonSafe<ChallengeLeaderboardEntry[]>(res);
        if (!res.ok || !json.success) return { value: [], cacheable: false };
        return { value: Array.isArray(json.data) ? json.data : [], cacheable: true };
      } catch {
        return { value: [], cacheable: false };
      }
    }
  );
}

export async function claimSummitChallenge(slug: string): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  message?: string;
}> {
  const res = await apiFetch(`${API_BASE}/challenges/${encodeURIComponent(slug)}/claim`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
  });
  const json = await parseJsonSafe<Record<string, unknown>>(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể nhận huy hiệu thử thách lúc này.');
  }
  invalidateApiReadCache('challenges:');
  invalidateApiReadCache('stats:');
  return {
    success: true,
    data: json.data,
    message: json.message,
  };
}

// --- Training Plans ---

export async function fetchMyTrainingPlans(): Promise<{
  plans: TrainingPlanItem[];
  activeReadiness?: number;
}> {
  try {
    const res = await apiFetch(`${API_BASE}/training-plans/me`, {
      headers: getApiHeaders(),
    });
    const json = await parseJsonSafe<
      TrainingPlanItem[] | { plans?: TrainingPlanItem[]; activeReadiness?: number }
    >(res);
    if (!res.ok || !json.success) return { plans: [] };
    if (Array.isArray(json.data)) {
      return { plans: json.data, activeReadiness: json.activeReadiness };
    }
    return {
      plans: Array.isArray(json.data?.plans) ? json.data.plans : [],
      activeReadiness: json.data?.activeReadiness,
    };
  } catch {
    return { plans: [] };
  }
}

export async function createTrainingPlan(payload: {
  targetTrailId?: string;
  trailId?: string;
  targetTrailSlug?: string;
  targetDate: string;
  durationWeeks: 4 | 6 | 8;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
}): Promise<TrainingPlanItem> {
  const res = await apiFetch(`${API_BASE}/training-plans`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonSafe<TrainingPlanItem>(res);
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Không thể khởi tạo giáo án thể lực.');
  }
  return json.data;
}

export async function toggleTrainingSession(
  planId: string,
  sessionId: string,
  completed?: boolean
): Promise<TrainingPlanItem> {
  const res = await apiFetch(
    `${API_BASE}/training-plans/${encodeURIComponent(planId)}/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: 'PATCH',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(completed !== undefined ? { completed } : {}),
    }
  );
  const json = await parseJsonSafe<TrainingPlanItem>(res);
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Không thể cập nhật tiến độ buổi tập.');
  }
  return json.data;
}

export async function updateTrainingPlanStatus(
  planId: string,
  status: 'active' | 'completed' | 'abandoned'
): Promise<TrainingPlanItem> {
  const res = await apiFetch(`${API_BASE}/training-plans/${encodeURIComponent(planId)}/status`, {
    method: 'PATCH',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status }),
  });
  const json = await parseJsonSafe<TrainingPlanItem>(res);
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Không thể cập nhật trạng thái giáo án.');
  }
  return json.data;
}

export async function deleteTrainingPlan(planId: string): Promise<{ success: boolean; message?: string }> {
  const res = await apiFetch(`${API_BASE}/training-plans/${encodeURIComponent(planId)}`, {
    method: 'DELETE',
    headers: getApiHeaders(),
  });
  const json = await parseJsonSafe(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể xóa giáo án thể lực.');
  }
  return { success: true, message: json.message };
}

// --- Directory & Cost Estimator ---

export async function fetchDirectoryGuides(params?: {
  region?: string;
  province?: string;
  trailSlug?: string;
  roleType?: string;
  specialty?: string;
  language?: string;
  minRating?: number;
  maxPriceVnd?: number;
  verified?: boolean;
  search?: string;
  sortBy?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: DirectoryGuideItem[]; pagination?: ApiPagination }> {
  const qs = buildQuery(params);
  return cachedRead<{ data: DirectoryGuideItem[]; pagination?: ApiPagination }>(
    `directory:guides:${qs}`,
    45_000,
    async () => {
      try {
        const res = await apiFetch(`${API_BASE}/directory/guides${qs}`, {
          headers: getPublicReadHeaders(),
        });
        const json = await parseJsonSafe<DirectoryGuideItem[]>(res);
        if (!res.ok || !json.success) return { value: { data: [] }, cacheable: false };
        return {
          value: {
            data: Array.isArray(json.data) ? json.data : [],
            pagination: json.pagination,
          },
          cacheable: true,
        };
      } catch {
        return { value: { data: [] }, cacheable: false };
      }
    }
  );
}

export async function createGuideInquiry(
  guideId: string,
  payload: {
    trailId?: string;
    trailName?: string;
    plannedStartDate: string;
    durationDays: number;
    groupSize: number;
    needPortersCount?: number;
    contactPhone: string;
    notes?: string;
  }
): Promise<GuideInquiryItem> {
  const res = await apiFetch(`${API_BASE}/directory/guides/${encodeURIComponent(guideId)}/inquiries`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonSafe<GuideInquiryItem>(res);
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Không thể gửi yêu cầu đặt Porter/HDV.');
  }
  invalidateApiReadCache('directory:guides:');
  return json.data;
}

export async function fetchMyGuideInquiries(): Promise<GuideInquiryItem[]> {
  try {
    const res = await apiFetch(`${API_BASE}/directory/inquiries/me`, {
      headers: getApiHeaders(),
    });
    const json = await parseJsonSafe<GuideInquiryItem[]>(res);
    if (!res.ok || !json.success) return [];
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

export async function fetchRangerStations(params?: {
  region?: string;
  province?: string;
  trailSlug?: string;
  authorityType?: string;
  permitRequired?: boolean;
  search?: string;
}): Promise<RangerStationItem[]> {
  const qs = buildQuery(params);
  return cachedRead<RangerStationItem[]>(
    `directory:rangers:${qs}`,
    60_000,
    async () => {
      try {
        const res = await apiFetch(`${API_BASE}/directory/rangers${qs}`, {
          headers: getPublicReadHeaders(),
        });
        const json = await parseJsonSafe<RangerStationItem[]>(res);
        if (!res.ok || !json.success) return { value: [], cacheable: false };
        return { value: Array.isArray(json.data) ? json.data : [], cacheable: true };
      } catch {
        return { value: [], cacheable: false };
      }
    }
  );
}

export async function fetchTripCostEstimate(params: {
  trailId?: string;
  groupSize?: number;
  days?: number;
  needGuide?: boolean;
  portersCount?: number;
  includeTransport?: boolean;
}): Promise<TripCostEstimate | null> {
  try {
    const res = await apiFetch(`${API_BASE}/directory/cost-estimate${buildQuery(params)}`, {
      headers: getApiHeaders(),
    });
    const json = await parseJsonSafe<TripCostEstimate>(res);
    if (!res.ok || !json.success) return null;
    return json.data || null;
  } catch {
    return null;
  }
}

// --- Personal Logbook & Analytics ---

export async function fetchMyLogbook(params?: {
  year?: number;
  region?: string;
  verifiedOnly?: boolean;
  trailId?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: LogbookEntryItem[]; pagination?: ApiPagination }> {
  try {
    const res = await apiFetch(`${API_BASE}/logbook/me${buildQuery(params)}`, {
      headers: getApiHeaders(),
    });
    const json = await parseJsonSafe<LogbookEntryItem[]>(res);
    if (!res.ok || !json.success) return { data: [] };
    return {
      data: Array.isArray(json.data) ? json.data : [],
      pagination: json.pagination,
    };
  } catch {
    return { data: [] };
  }
}

export async function fetchLogbookAnalytics(): Promise<LogbookAnalyticsData | null> {
  try {
    const res = await apiFetch(`${API_BASE}/logbook/analytics/me`, {
      headers: getApiHeaders(),
    });
    const json = await parseJsonSafe<LogbookAnalyticsData>(res);
    if (!res.ok || !json.success) return null;
    return json.data || null;
  } catch {
    return null;
  }
}

export async function updateLogbookEntry(
  checkinId: string,
  payload: {
    distanceRecordedKm?: number;
    elevationGainRecordedM?: number;
    weatherObserved?: string;
    packWeightKg?: number;
    notes?: string;
    companionsCount?: number;
    isPublic?: boolean;
  }
): Promise<LogbookEntryItem> {
  const res = await apiFetch(`${API_BASE}/logbook/${encodeURIComponent(checkinId)}`, {
    method: 'PATCH',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonSafe<LogbookEntryItem>(res);
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Không thể cập nhật nhật ký chuyến đi.');
  }
  invalidateApiReadCache('stats:');
  invalidateApiReadCache('analytics:');
  invalidateApiReadCache('challenges:');
  return json.data;
}

export async function deleteLogbookEntry(checkinId: string): Promise<{ success: boolean; message?: string }> {
  const res = await apiFetch(`${API_BASE}/logbook/${encodeURIComponent(checkinId)}`, {
    method: 'DELETE',
    headers: getApiHeaders(),
  });
  const json = await parseJsonSafe(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể xóa mục nhật ký chuyến đi.');
  }
  invalidateApiReadCache('stats:');
  invalidateApiReadCache('analytics:');
  invalidateApiReadCache('challenges:');
  return { success: true, message: json.message };
}

// --- Custom Routes & GPX Builder ---

export async function analyzeCustomRoute(payload: {
  trackPoints?: [number, number][];
  points?: [number, number][];
  baseTrailId?: string;
}): Promise<{
  metrics: CustomRouteMetrics;
  elevationProfile?: Array<{ distanceKm?: number; elevationM?: number; lat?: number; lng?: number }>;
  source?: string;
}> {
  const trackPoints = payload.trackPoints || payload.points || [];
  const res = await apiFetch(`${API_BASE}/custom-routes/analyze`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...payload, trackPoints }),
  });
  const json = await parseJsonSafe<{
    metrics: CustomRouteMetrics;
    elevationProfile?: Array<{ distanceKm?: number; elevationM?: number; lat?: number; lng?: number }>;
    source?: string;
  }>(res);
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Không thể phân tích địa hình tuyến đường tùy chỉnh.');
  }
  return json.data;
}

export async function createCustomRoute(payload: {
  title: string;
  description?: string;
  region?: string;
  province?: string;
  baseTrailId?: string;
  waypoints?: CustomRouteItem['waypoints'];
  trackPoints: [number, number][];
  visibility?: 'private' | 'unlisted' | 'public';
}): Promise<CustomRouteItem> {
  const res = await apiFetch(`${API_BASE}/custom-routes`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonSafe<CustomRouteItem>(res);
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Không thể lưu tuyến đường GPX tùy chỉnh.');
  }
  return json.data;
}

export async function fetchMyCustomRoutes(): Promise<CustomRouteItem[]> {
  try {
    const res = await apiFetch(`${API_BASE}/custom-routes/me`, {
      headers: getApiHeaders(),
    });
    const json = await parseJsonSafe<CustomRouteItem[]>(res);
    if (!res.ok || !json.success) return [];
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

export async function fetchPublicCustomRoutes(params?: {
  region?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: CustomRouteItem[]; pagination?: ApiPagination }> {
  try {
    const res = await apiFetch(`${API_BASE}/custom-routes/public${buildQuery(params)}`, {
      headers: getApiHeaders(),
    });
    const json = await parseJsonSafe<CustomRouteItem[]>(res);
    if (!res.ok || !json.success) return { data: [] };
    return {
      data: Array.isArray(json.data) ? json.data : [],
      pagination: json.pagination,
    };
  } catch {
    return { data: [] };
  }
}

export async function fetchCustomRouteBySlug(shareSlug: string): Promise<CustomRouteItem | null> {
  try {
    const res = await apiFetch(`${API_BASE}/custom-routes/share/${encodeURIComponent(shareSlug)}`, {
      headers: getApiHeaders(),
    });
    const json = await parseJsonSafe<CustomRouteItem>(res);
    if (!res.ok || !json.success) return null;
    return json.data || null;
  } catch {
    return null;
  }
}

export async function deleteCustomRoute(id: string): Promise<{ success: boolean; message?: string }> {
  const res = await apiFetch(`${API_BASE}/custom-routes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getApiHeaders(),
  });
  const json = await parseJsonSafe(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể xóa tuyến GPX tùy chỉnh.');
  }
  return { success: true, message: json.message };
}

export async function toggleCustomRouteLike(id: string): Promise<{
  success: boolean;
  liked: boolean;
  likesCount: number;
}> {
  const res = await apiFetch(`${API_BASE}/custom-routes/${encodeURIComponent(id)}/like`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
  });
  const json = await parseJsonSafe<{ liked?: boolean; likesCount?: number }>(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể cập nhật lượt thích tuyến đường.');
  }
  return {
    success: true,
    liked: Boolean(json.liked ?? json.data?.liked),
    likesCount: Number(json.likesCount ?? json.data?.likesCount ?? 0),
  };
}

// --- Trips Calendar, Squad Moderation & Follow Wiring ---

export async function fetchTripsCalendar(params?: {
  year?: number;
  month?: number;
  region?: string;
}): Promise<{
  year?: number;
  month?: number;
  days?: Record<string, Record<string, unknown>[]>;
  trips?: Record<string, unknown>[];
}> {
  try {
    const res = await apiFetch(`${API_BASE}/trips/calendar${buildQuery(params)}`, {
      headers: getApiHeaders(),
    });
    const json = await parseJsonSafe<{
      year?: number;
      month?: number;
      days?: Record<string, Record<string, unknown>[]>;
      trips?: Record<string, unknown>[];
    }>(res);
    if (!res.ok || !json.success) return { days: {}, trips: [] };
    const payload = json.data && typeof json.data === 'object' ? json.data : json;
    return {
      year: payload.year,
      month: payload.month,
      days: payload.days || {},
      trips: Array.isArray(payload.trips) ? payload.trips : [],
    };
  } catch {
    return { days: {}, trips: [] };
  }
}

export async function approveTripMember(
  tripId: string,
  applicantUserId: string
): Promise<Record<string, unknown>> {
  const res = await apiFetch(`${API_BASE}/trips/${encodeURIComponent(tripId)}/approve`, {
    method: 'PUT',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ applicantUserId, userId: applicantUserId }),
  });
  const json = await parseJsonSafe<Record<string, unknown>>(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể duyệt thành viên vào đoàn.');
  }
  invalidateApiReadCache('stats:');
  invalidateApiReadCache('analytics:');
  return (json.data ?? json) as Record<string, unknown>;
}

export async function rejectTripMember(
  tripId: string,
  applicantUserId: string
): Promise<Record<string, unknown>> {
  const res = await apiFetch(`${API_BASE}/trips/${encodeURIComponent(tripId)}/reject`, {
    method: 'PUT',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ applicantUserId, userId: applicantUserId }),
  });
  const json = await parseJsonSafe<Record<string, unknown>>(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể từ chối yêu cầu tham gia đoàn.');
  }
  invalidateApiReadCache('stats:');
  invalidateApiReadCache('analytics:');
  return (json.data ?? json) as Record<string, unknown>;
}

export async function leaveTrip(tripId: string): Promise<Record<string, unknown>> {
  const res = await apiFetch(`${API_BASE}/trips/${encodeURIComponent(tripId)}/leave`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
  });
  const json = await parseJsonSafe<Record<string, unknown>>(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể rời khỏi đoàn trekking.');
  }
  invalidateApiReadCache('stats:');
  invalidateApiReadCache('analytics:');
  return (json.data ?? json) as Record<string, unknown>;
}

export async function updateTripStatus(
  tripId: string,
  status: string
): Promise<Record<string, unknown>> {
  const res = await apiFetch(`${API_BASE}/trips/${encodeURIComponent(tripId)}/status`, {
    method: 'PATCH',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status }),
  });
  const json = await parseJsonSafe<Record<string, unknown>>(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể cập nhật trạng thái chuyến đi.');
  }
  invalidateApiReadCache('stats:');
  invalidateApiReadCache('analytics:');
  return (json.data ?? json) as Record<string, unknown>;
}

export async function deleteTrip(tripId: string): Promise<{ success: boolean; message?: string }> {
  const res = await apiFetch(`${API_BASE}/trips/${encodeURIComponent(tripId)}`, {
    method: 'DELETE',
    headers: getApiHeaders(),
  });
  const json = await parseJsonSafe(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể xóa kế hoạch đoàn trekking.');
  }
  invalidateApiReadCache('stats:');
  invalidateApiReadCache('analytics:');
  return { success: true, message: json.message };
}

export async function toggleFollowUser(userId: string): Promise<{
  success: boolean;
  isFollowing: boolean;
  followersCount?: number;
  message?: string;
}> {
  const res = await apiFetch(`${API_BASE}/users/${encodeURIComponent(userId)}/follow`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
  });
  const json = await parseJsonSafe<{ isFollowing?: boolean; followersCount?: number }>(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể cập nhật trạng thái theo dõi.');
  }
  return {
    success: true,
    isFollowing: Boolean(json.isFollowing ?? json.following ?? json.data?.isFollowing),
    followersCount: json.followersCount ?? json.data?.followersCount,
    message: json.message,
  };
}

export async function fetchFollowStatus(userId: string): Promise<{
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
}> {
  try {
    const res = await apiFetch(`${API_BASE}/users/${encodeURIComponent(userId)}/follow-status`, {
      headers: getApiHeaders(),
    });
    const json = await parseJsonSafe<{
      isFollowing?: boolean;
      following?: boolean;
      followersCount?: number;
      followingCount?: number;
    }>(res);
    if (!res.ok || !json.success) {
      return { isFollowing: false, followersCount: 0, followingCount: 0 };
    }
    const payload = json.data || json;
    return {
      isFollowing: Boolean(payload.isFollowing ?? payload.following),
      followersCount: Number(payload.followersCount ?? 0),
      followingCount: Number(payload.followingCount ?? 0),
    };
  } catch {
    return { isFollowing: false, followersCount: 0, followingCount: 0 };
  }
}

// ============================================================================
// WAVE 3G API HELPERS: Platform Stats, Cloud Gear Packs & Owner Content CRUD
// ============================================================================

export interface PlatformStatsSummary {
  totalTrails: number;
  totalKm: number;
  highestPeakM: number;
  totalUsers: number;
  totalCheckins: number;
  verifiedCheckins: number;
  activeTrips: number;
  openIncidents: number;
  totalChallenges: number;
  totalRangers: number;
  source?: 'database' | 'fallback';
}

export interface GearPackItemSpec {
  id: string;
  name: string;
  category: string;
  weightGrams: number;
  quantity: number;
  worn: boolean;
  consumable: boolean;
}

export interface GearPackSummary {
  itemCount: number;
  totalQuantity: number;
  baseWeightGrams: number;
  wornWeightGrams: number;
  consumableWeightGrams: number;
  packWeightGrams: number;
  totalCarryWeightGrams: number;
  baseWeightKg: number;
  packWeightKg: number;
  bodyWeightRatioPercent: number;
  weightClass: 'ultralight' | 'lightweight' | 'traditional' | 'heavy';
  categoryBreakdown: Record<string, number>;
}

export interface GearPackRecord {
  _id: string;
  userId?: string | { _id?: string; fullName?: string; avatarUrl?: string; badges?: string[] };
  shareSlug: string;
  name: string;
  trailSlug?: string;
  bodyWeightKg: number;
  items: GearPackItemSpec[];
  isPublic: boolean;
  isOwner?: boolean;
  summary?: GearPackSummary;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchPlatformStatsSummary(): Promise<PlatformStatsSummary | null> {
  return cachedRead<PlatformStatsSummary | null>('stats:summary', 30_000, async () => {
    try {
      const res = await apiFetch(`${API_BASE}/trails/stats/summary`, {
        headers: getPublicReadHeaders(),
      });
      const json = await parseJsonSafe<Record<string, unknown>>(res);
      if (!res.ok || !json.success || !json.data) return { value: null, cacheable: false };
      return {
        value: {
          totalTrails: Number(json.data.totalTrails) || 0,
          totalKm: Number(json.data.totalKm) || 0,
          highestPeakM: Number(json.data.highestPeakM) || 0,
          totalUsers: Number(json.data.totalUsers) || 0,
          totalCheckins: Number(json.data.totalCheckins) || 0,
          verifiedCheckins: Number(json.data.verifiedCheckins) || 0,
          activeTrips: Number(json.data.activeTrips) || 0,
          openIncidents: Number(json.data.openIncidents) || 0,
          totalChallenges: Number(json.data.totalChallenges) || 0,
          totalRangers: Number(json.data.totalRangers) || 0,
          source: json.source,
        },
        cacheable: true,
      };
    } catch {
      return { value: null, cacheable: false };
    }
  });
}

export async function fetchMyGearPacks(): Promise<{
  data: GearPackRecord[];
  maxPacks: number;
}> {
  try {
    const res = await apiFetch(`${API_BASE}/gear-packs/me`, {
      headers: getApiHeaders(),
    });
    const json = await parseJsonSafe<GearPackRecord[]>(res);
    if (!res.ok || !json.success) return { data: [], maxPacks: 15 };
    return {
      data: Array.isArray(json.data) ? json.data : [],
      maxPacks: Number(json.maxPacks) || 15,
    };
  } catch {
    return { data: [], maxPacks: 15 };
  }
}

export async function createGearPack(payload: {
  name: string;
  trailSlug?: string;
  bodyWeightKg?: number;
  items: GearPackItemSpec[];
  isPublic?: boolean;
}): Promise<GearPackRecord> {
  const res = await apiFetch(`${API_BASE}/gear-packs`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonSafe<GearPackRecord>(res);
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Không thể lưu cấu hình balo lên đám mây.');
  }
  return json.data;
}

export async function updateGearPack(
  id: string,
  payload: Partial<{
    name: string;
    trailSlug: string;
    bodyWeightKg: number;
    items: GearPackItemSpec[];
    isPublic: boolean;
  }>
): Promise<GearPackRecord> {
  const res = await apiFetch(`${API_BASE}/gear-packs/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonSafe<GearPackRecord>(res);
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Không thể cập nhật cấu hình balo.');
  }
  return json.data;
}

export async function deleteGearPack(id: string): Promise<{ success: boolean; message?: string }> {
  const res = await apiFetch(`${API_BASE}/gear-packs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getApiHeaders(),
  });
  const json = await parseJsonSafe(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể xóa cấu hình balo.');
  }
  return { success: true, message: json.message };
}

export async function fetchSharedGearPack(shareSlug: string): Promise<GearPackRecord | null> {
  try {
    const res = await apiFetch(`${API_BASE}/gear-packs/share/${encodeURIComponent(shareSlug)}`, {
      headers: getApiHeaders(),
    });
    const json = await parseJsonSafe<GearPackRecord>(res);
    if (!res.ok || !json.success) return null;
    return json.data || null;
  } catch {
    return null;
  }
}

export async function fetchThreadDetail(threadId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await apiFetch(`${API_BASE}/forum/threads/${encodeURIComponent(threadId)}`, {
      headers: getApiHeaders(),
    });
    const json = await parseJsonSafe<Record<string, unknown>>(res);
    if (!res.ok || !json.success) return null;
    return json.data || null;
  } catch {
    return null;
  }
}

export async function updateForumThread(
  threadId: string,
  payload: {
    title?: string;
    content?: string;
    category?: string;
    tags?: string[];
    images?: string[];
  }
): Promise<Record<string, unknown>> {
  const res = await apiFetch(`${API_BASE}/forum/threads/${encodeURIComponent(threadId)}`, {
    method: 'PATCH',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonSafe<Record<string, unknown>>(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể cập nhật bài viết diễn đàn.');
  }
  return (json.data ?? json) as Record<string, unknown>;
}

export async function deleteForumThread(threadId: string): Promise<{ success: boolean; message?: string }> {
  const res = await apiFetch(`${API_BASE}/forum/threads/${encodeURIComponent(threadId)}`, {
    method: 'DELETE',
    headers: getApiHeaders(),
  });
  const json = await parseJsonSafe(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể xóa bài viết diễn đàn.');
  }
  return { success: true, message: json.message };
}

export async function updateForumComment(
  commentId: string,
  payload: { content: string }
): Promise<Record<string, unknown>> {
  const res = await apiFetch(`${API_BASE}/comments/${encodeURIComponent(commentId)}`, {
    method: 'PATCH',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonSafe<Record<string, unknown>>(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể cập nhật bình luận.');
  }
  return (json.data ?? json) as Record<string, unknown>;
}

export async function deleteForumComment(commentId: string): Promise<{ success: boolean; message?: string }> {
  const res = await apiFetch(`${API_BASE}/comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
    headers: getApiHeaders(),
  });
  const json = await parseJsonSafe(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể xóa bình luận.');
  }
  return { success: true, message: json.message };
}

export async function deleteTrailReview(
  trailId: string,
  reviewId: string
): Promise<{ success: boolean; message?: string; data?: { rating: number; reviewCount: number } }> {
  const res = await apiFetch(
    `${API_BASE}/trails/${encodeURIComponent(trailId)}/reviews/${encodeURIComponent(reviewId)}`,
    {
      method: 'DELETE',
      headers: getApiHeaders(),
    }
  );
  const json = await parseJsonSafe<{ rating: number; reviewCount: number }>(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể xóa đánh giá cung đường.');
  }
  invalidateApiReadCache('trails:');
  invalidateApiReadCache('trail:');
  invalidateApiReadCache('stats:');
  invalidateApiReadCache('analytics:');
  return { success: true, message: json.message, data: json.data };
}

export async function updateTripReport(
  reportId: string,
  payload: Partial<{
    title: string;
    summary: string;
    content: string;
    tripDate: string;
    durationHours: number;
    groupSize: number;
    totalCostVnd: number;
    rating: number;
    difficultyActual: number;
    weatherCondition: string;
    highlights: string[];
    warnings: string[];
    recommendations: string[];
    photos: string[];
  }>
): Promise<Record<string, unknown>> {
  const res = await apiFetch(`${API_BASE}/trip-reports/${encodeURIComponent(reportId)}`, {
    method: 'PATCH',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonSafe<Record<string, unknown>>(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể cập nhật nhật ký chuyến đi.');
  }
  return (json.data ?? json) as Record<string, unknown>;
}

export async function deleteTripReport(reportId: string): Promise<{ success: boolean; message?: string }> {
  const res = await apiFetch(`${API_BASE}/trip-reports/${encodeURIComponent(reportId)}`, {
    method: 'DELETE',
    headers: getApiHeaders(),
  });
  const json = await parseJsonSafe(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể xóa nhật ký chuyến đi.');
  }
  return { success: true, message: json.message };
}

export async function deleteTrailCondition(conditionId: string): Promise<{ success: boolean; message?: string }> {
  const res = await apiFetch(`${API_BASE}/trail-conditions/${encodeURIComponent(conditionId)}`, {
    method: 'DELETE',
    headers: getApiHeaders(),
  });
  const json = await parseJsonSafe(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể xóa báo cáo tình trạng đường.');
  }
  return { success: true, message: json.message };
}

export async function deleteSharedItinerary(shareToken: string): Promise<{ success: boolean; message?: string }> {
  const res = await apiFetch(`${API_BASE}/itineraries/${encodeURIComponent(shareToken)}`, {
    method: 'DELETE',
    headers: getApiHeaders(),
  });
  const json = await parseJsonSafe(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể xóa lịch trình chia sẻ.');
  }
  return { success: true, message: json.message };
}

// ============================================================================
// WAVE 8: Live Top 12 Vietnam Alpine Peaks Weather & Sea-of-Clouds Radar
// ============================================================================

export interface SummitLiveTelemetry {
  trailId: string;
  name: string;
  province: string;
  region: string;
  maxAltitudeM: number;
  gridElevationM: number;
  lapseDropC: number;
  gridTempC?: number;
  summitTempC: number;
  summitTempMinC: number;
  summitTempMaxC: number;
  windChillC: number;
  windSpeedKmH: number;
  humidityPercent: number;
  cloudCoverPercent?: number;
  precipMm?: number;
  weatherCondition: 'clear' | 'cloudy' | 'foggy' | 'rainy' | 'storm' | string;
  seaOfCloudsPercent: number;
  tomorrowSeaOfCloudsPercent?: number;
  weatherTier: 'ideal' | 'caution' | 'danger';
  advisory: string;
}

export interface LiveSummitsWeatherResponse {
  success: boolean;
  cached?: boolean;
  stale?: boolean;
  fetchedAt?: string;
  expiresAt?: string;
  source?: string;
  summary?: {
    totalPeaks: number;
    bestCloudPeak?: { trailId: string; name: string; seaOfCloudsPercent: number } | null;
    coldestPeak?: { trailId: string; name: string; summitTempC: number; windChillC?: number } | null;
    warningCount: number;
  };
  data: SummitLiveTelemetry[];
}

export async function fetchLiveSummitsWeather(
  region?: string,
  signal?: AbortSignal
): Promise<LiveSummitsWeatherResponse | null> {
  const normalizedRegion = region && region !== 'All' ? region : '';
  return cachedRead<LiveSummitsWeatherResponse | null>(
    `weather:summits:${normalizedRegion || 'all'}`,
    45_000,
    async () => {
      try {
        const query = normalizedRegion ? `?region=${encodeURIComponent(normalizedRegion)}` : '';
        const res = await apiFetch(`${API_BASE}/weather/summits-live${query}`, {
          headers: getPublicReadHeaders(),
        });
        const json = await parseJsonSafe<SummitLiveTelemetry[]>(res);
        if (!res.ok || !json.success || !Array.isArray(json.data)) {
          return { value: null, cacheable: false };
        }
        return {
          value: json as unknown as LiveSummitsWeatherResponse,
          cacheable: true,
        };
      } catch {
        return { value: null, cacheable: false };
      }
    },
    signal
  );
}

// ============================================================================
// WAVE 9B: Nearby Trails, Social Community Activity Feed, Follow Graph & Saved Collections
// ============================================================================

export interface NearbyTrailMatch {
  trail: Trail;
  distanceKm: number;
  altitudeDeltaM: number;
}

export async function fetchNearbyTrailsForTrail(
  trailId: string,
  signal?: AbortSignal
): Promise<NearbyTrailMatch[]> {
  const cleanId = String(trailId || '').trim();
  if (!cleanId) return [];

  return cachedRead<NearbyTrailMatch[]>(
    `trail:nearby:${cleanId}`,
    60_000,
    async () => {
      try {
        const res = await apiFetch(
          `${API_BASE}/trails/${encodeURIComponent(cleanId)}/nearby-trails`,
          {
            headers: getPublicReadHeaders(),
          }
        );
        const json = await parseJsonSafe(res);
        if (!res.ok || !json.success || !Array.isArray(json.data)) {
          return { value: [], cacheable: false };
        }
        const matches = json.data
          .filter((item: unknown): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
          .map((item: Record<string, unknown>) => {
            const rawTrail = (item.trail && typeof item.trail === 'object' ? item.trail : item) as Trail;
            const distVal = Number(item.distanceKm ?? item.distanceFromTrailKm ?? 0);
            const altDelta = Number(item.altitudeDeltaM ?? 0);
            return {
              trail: {
                ...rawTrail,
                id: String(rawTrail.id || (rawTrail as unknown as { _id?: string })._id || ''),
              },
              distanceKm: Number.isFinite(distVal) ? Math.round(distVal * 10) / 10 : 0,
              altitudeDeltaM: Number.isFinite(altDelta) ? Math.round(altDelta) : 0,
            };
          })
          .filter((m: NearbyTrailMatch) => Boolean(m.trail && m.trail.id && m.trail.name));
        return { value: matches, cacheable: true };
      } catch {
        return { value: [], cacheable: false };
      }
    },
    signal
  );
}

export interface CommunityActivityUser {
  _id: string;
  id?: string;
  fullName: string;
  username?: string;
  avatarUrl?: string;
  reputationScore?: number;
  role?: string;
}

export interface CommunityActivityItem {
  _id?: string;
  id?: string;
  type:
    | 'checkin_peak'
    | 'earned_badge'
    | 'new_trip_report'
    | 'joined_trip'
    | 'new_contribution'
    | 'new_review'
    | string;
  title?: string;
  message?: string;
  description?: string;
  createdAt: string;
  author?: CommunityActivityUser | null;
  user?: CommunityActivityUser | null;
  userId?: CommunityActivityUser | string | null;
  trail?: {
    id?: string;
    _id?: string;
    name?: string;
    province?: string;
    region?: string;
    maxAltitudeM?: number;
    coverImage?: string;
  } | null;
  trailId?: string;
  trailName?: string;
  metadata?: Record<string, unknown>;
}

export interface CommunityActivitiesResponse {
  data: CommunityActivityItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export async function fetchCommunityActivities(options?: {
  scope?: 'all' | 'following';
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}): Promise<CommunityActivitiesResponse> {
  const scope = options?.scope === 'following' ? 'following' : 'all';
  const page = Math.max(1, Math.floor(options?.page ?? 1));
  const limit = Math.min(50, Math.max(1, Math.floor(options?.limit ?? 25)));
  const qs = new URLSearchParams({
    scope,
    page: String(page),
    limit: String(limit),
  });
  try {
    const res = await apiFetch(`${API_BASE}/activities/community?${qs.toString()}`, {
      headers: getApiHeaders(),
      signal: options?.signal,
    });
    const json = await parseJsonSafe(res);
    if (!res.ok || !json.success) {
      return { data: [], pagination: { page, limit, total: 0, hasMore: false } };
    }
    const items: CommunityActivityItem[] = Array.isArray(json.data) ? json.data : [];
    const rawPag = (json.pagination || {}) as Record<string, unknown>;
    const total = Number(rawPag.total ?? items.length) || 0;
    const hasMore =
      typeof rawPag.hasMore === 'boolean'
        ? rawPag.hasMore
        : page * limit < total;
    return {
      data: items,
      pagination: {
        page: Number(rawPag.page ?? page) || page,
        limit: Number(rawPag.limit ?? limit) || limit,
        total,
        hasMore,
      },
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    return { data: [], pagination: { page, limit, total: 0, hasMore: false } };
  }
}

export interface ExplorerFollowSummary {
  _id: string;
  id?: string;
  fullName: string;
  username?: string;
  avatarUrl?: string;
  reputationScore?: number;
  role?: string;
  badges?: string[];
  isFollowingByMe?: boolean;
}

export interface FollowListResponse {
  data: ExplorerFollowSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

async function fetchFollowGraphList(
  userId: string,
  direction: 'followers' | 'following',
  options?: { page?: number; limit?: number; signal?: AbortSignal }
): Promise<FollowListResponse> {
  const page = Math.max(1, Math.floor(options?.page ?? 1));
  const limit = Math.min(50, Math.max(1, Math.floor(options?.limit ?? 30)));
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  try {
    const res = await apiFetch(
      `${API_BASE}/users/${encodeURIComponent(userId)}/${direction}?${qs.toString()}`,
      {
        headers: getApiHeaders(),
        signal: options?.signal,
      }
    );
    const json = await parseJsonSafe(res);
    if (!res.ok || !json.success) {
      return { data: [], pagination: { page, limit, total: 0, hasMore: false } };
    }
    const items: ExplorerFollowSummary[] = Array.isArray(json.data) ? json.data : [];
    const rawPag = (json.pagination || {}) as Record<string, unknown>;
    const total = Number(rawPag.total ?? items.length) || 0;
    const hasMore =
      typeof rawPag.hasMore === 'boolean'
        ? rawPag.hasMore
        : page * limit < total;
    return {
      data: items,
      pagination: {
        page: Number(rawPag.page ?? page) || page,
        limit: Number(rawPag.limit ?? limit) || limit,
        total,
        hasMore,
      },
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    return { data: [], pagination: { page, limit, total: 0, hasMore: false } };
  }
}

export function fetchUserFollowers(
  userId: string,
  options?: { page?: number; limit?: number; signal?: AbortSignal }
): Promise<FollowListResponse> {
  return fetchFollowGraphList(userId, 'followers', options);
}

export function fetchUserFollowing(
  userId: string,
  options?: { page?: number; limit?: number; signal?: AbortSignal }
): Promise<FollowListResponse> {
  return fetchFollowGraphList(userId, 'following', options);
}

export interface SavedTrailMetaPayload {
  collectionName?: string;
  personalNote?: string;
  plannedMonth?: number | null;
}

export interface SavedTrailMetaRecord {
  trailId: string;
  collectionName: string;
  personalNote: string;
  plannedMonth: number | null;
  updatedAt?: string;
}

export async function updateSavedTrailMeta(
  trailId: string,
  payload: SavedTrailMetaPayload
): Promise<SavedTrailMetaRecord> {
  const res = await apiFetch(
    `${API_BASE}/saved-trails/${encodeURIComponent(trailId)}`,
    {
      method: 'PATCH',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    }
  );
  const json = await parseJsonSafe(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể cập nhật ghi chú & bộ sưu tập cung đường đã lưu.');
  }
  const d = (json.data || {}) as Record<string, unknown>;
  return {
    trailId: String(d.trailId || trailId),
    collectionName: String(d.collectionName ?? payload.collectionName ?? 'Muốn đi năm nay'),
    personalNote: String(d.personalNote ?? payload.personalNote ?? ''),
    plannedMonth:
      d.plannedMonth === null || d.plannedMonth === undefined
        ? payload.plannedMonth ?? null
        : Number(d.plannedMonth),
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : undefined,
  };
}

// ============================================================================
// WAVE 10B: Multi-Trail 3-Day Summit Weather Compare & Live Family GPS Beacon
// ============================================================================

export interface WeatherCompareDay {
  date: string;
  tempMinC: number;
  tempMaxC: number;
  summitTempMinC: number;
  summitTempMaxC: number;
  windChillC: number;
  precipMm: number;
  windSpeedKmH: number;
  humidityPercent: number;
  seaOfCloudsPercent: number;
  weatherCondition: string;
  conditionLabel?: string;
  weatherTier: 'ideal' | 'caution' | 'danger';
}

export interface TrailWeatherCompareEntry {
  trailId: string;
  name: string;
  province?: string;
  region?: string;
  maxAltitudeM: number;
  gridElevationM?: number;
  lapseDropC?: number;
  weatherScore?: number;
  summaryScore?: number;
  bestSeaOfCloudsPercent?: number;
  avgSeaOfCloudsPercent?: number;
  totalPrecip3dMm?: number;
  maxWind3dKmH?: number;
  weatherTier?: 'ideal' | 'caution' | 'danger';
  days: WeatherCompareDay[];
}

export interface MultiTrailWeatherCompareResponse {
  success: boolean;
  cached?: boolean;
  fetchedAt?: string;
  bestWeatherTrailId?: string | null;
  bestCloudTrailId?: string | null;
  data: TrailWeatherCompareEntry[];
}

function normalizeWeatherTier(raw: unknown, precipMm: number, windKmH: number): 'ideal' | 'caution' | 'danger' {
  if (raw === 'ideal' || raw === 'caution' || raw === 'danger') return raw;
  if (precipMm >= 18 || windKmH >= 48) return 'danger';
  if (precipMm >= 4 || windKmH >= 28) return 'caution';
  return 'ideal';
}

export async function fetchMultiTrailWeatherCompare(
  trailIds: string[],
  signal?: AbortSignal
): Promise<MultiTrailWeatherCompareResponse | null> {
  const cleanIds = Array.from(
    new Set(trailIds.map((id) => String(id || '').trim()).filter(Boolean))
  ).slice(0, 4);
  if (cleanIds.length === 0) return null;

  try {
    const qs = new URLSearchParams({ ids: cleanIds.join(',') });
    const res = await apiFetch(`${API_BASE}/weather/compare?${qs.toString()}`, {
      headers: getApiHeaders(),
      signal,
    });
    const json = await parseJsonSafe(res);
    if (!res.ok || !json.success || !Array.isArray(json.data)) {
      return null;
    }

    const entries: TrailWeatherCompareEntry[] = json.data
      .filter((row: unknown): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
      .map((row: Record<string, unknown>) => {
        const rawDays = Array.isArray(row.days)
          ? row.days
          : Array.isArray(row.daily)
          ? row.daily
          : Array.isArray(row.forecast)
          ? row.forecast
          : [];

        const days: WeatherCompareDay[] = rawDays
          .slice(0, 3)
          .filter((d: unknown): d is Record<string, unknown> => Boolean(d && typeof d === 'object'))
          .map((d: Record<string, unknown>) => {
            const tempMinC = Number(d.tempMinC ?? d.gridTempMinC ?? d.summitTempMinC ?? 12);
            const tempMaxC = Number(d.tempMaxC ?? d.gridTempMaxC ?? d.summitTempMaxC ?? 20);
            const summitTempMinC = Number(d.summitTempMinC ?? d.tempMinC ?? tempMinC);
            const summitTempMaxC = Number(d.summitTempMaxC ?? d.tempMaxC ?? tempMaxC);
            const windSpeedKmH = Number(d.windSpeedKmH ?? d.windMaxKmH ?? d.windspeed ?? 10);
            const precipMm = Number(d.precipMm ?? d.precipitationMm ?? d.rainMm ?? 0);
            const windChillC = Number(d.windChillC ?? summitTempMinC);
            const humidityPercent = Number(d.humidityPercent ?? d.humidity ?? 75);
            const seaOfCloudsPercent = Number(d.seaOfCloudsPercent ?? d.seaOfCloudsIndex ?? 0);
            const weatherCondition = String(d.weatherCondition ?? d.condition ?? 'cloudy');
            return {
              date: String(d.date ?? ''),
              tempMinC: Number.isFinite(tempMinC) ? Math.round(tempMinC * 10) / 10 : 12,
              tempMaxC: Number.isFinite(tempMaxC) ? Math.round(tempMaxC * 10) / 10 : 20,
              summitTempMinC: Number.isFinite(summitTempMinC) ? Math.round(summitTempMinC * 10) / 10 : 10,
              summitTempMaxC: Number.isFinite(summitTempMaxC) ? Math.round(summitTempMaxC * 10) / 10 : 18,
              windChillC: Number.isFinite(windChillC) ? Math.round(windChillC * 10) / 10 : 8,
              precipMm: Number.isFinite(precipMm) ? Math.round(precipMm * 10) / 10 : 0,
              windSpeedKmH: Number.isFinite(windSpeedKmH) ? Math.round(windSpeedKmH) : 10,
              humidityPercent: Number.isFinite(humidityPercent) ? Math.round(humidityPercent) : 75,
              seaOfCloudsPercent: Number.isFinite(seaOfCloudsPercent)
                ? Math.max(0, Math.min(100, Math.round(seaOfCloudsPercent)))
                : 0,
              weatherCondition,
              conditionLabel: typeof d.conditionLabel === 'string' ? d.conditionLabel : undefined,
              weatherTier: normalizeWeatherTier(d.weatherTier, precipMm, windSpeedKmH),
            };
          });

        const totalPrecip3dMm =
          typeof row.totalPrecip3dMm === 'number'
            ? row.totalPrecip3dMm
            : Math.round(days.reduce((s, d) => s + d.precipMm, 0) * 10) / 10;
        const maxWind3dKmH =
          typeof row.maxWind3dKmH === 'number'
            ? row.maxWind3dKmH
            : days.length > 0
            ? Math.max(...days.map((d) => d.windSpeedKmH))
            : 0;
        const avgSeaOfCloudsPercent =
          typeof row.avgSeaOfCloudsPercent === 'number'
            ? Math.round(row.avgSeaOfCloudsPercent)
            : days.length > 0
            ? Math.round(days.reduce((s, d) => s + d.seaOfCloudsPercent, 0) / days.length)
            : 0;
        const bestSeaOfCloudsPercent =
          typeof row.bestSeaOfCloudsPercent === 'number'
            ? Math.round(row.bestSeaOfCloudsPercent)
            : days.length > 0
            ? Math.max(...days.map((d) => d.seaOfCloudsPercent))
            : 0;
        const scoreVal =
          typeof row.weatherScore === 'number'
            ? row.weatherScore
            : typeof row.summaryScore === 'number'
            ? row.summaryScore
            : undefined;

        return {
          trailId: String(row.trailId ?? row.id ?? ''),
          name: String(row.name ?? ''),
          province: typeof row.province === 'string' ? row.province : undefined,
          region: typeof row.region === 'string' ? row.region : undefined,
          maxAltitudeM: Number(row.maxAltitudeM ?? 0) || 0,
          gridElevationM: typeof row.gridElevationM === 'number' ? row.gridElevationM : undefined,
          lapseDropC: typeof row.lapseDropC === 'number' ? row.lapseDropC : undefined,
          weatherScore: scoreVal,
          summaryScore: scoreVal,
          bestSeaOfCloudsPercent,
          avgSeaOfCloudsPercent,
          totalPrecip3dMm,
          maxWind3dKmH,
          weatherTier: normalizeWeatherTier(row.worstTier ?? row.weatherTier, totalPrecip3dMm / 3, maxWind3dKmH),
          days,
        };
      })
      .filter((e: TrailWeatherCompareEntry) => Boolean(e.trailId && e.days.length > 0));

    return {
      success: true,
      cached: Boolean(json.cached),
      fetchedAt: typeof json.fetchedAt === 'string' ? json.fetchedAt : undefined,
      bestWeatherTrailId:
        typeof json.bestWeatherTrailId === 'string'
          ? json.bestWeatherTrailId
          : typeof json.summary?.bestWeatherTrailId === 'string'
          ? json.summary.bestWeatherTrailId
          : null,
      bestCloudTrailId:
        typeof json.bestCloudTrailId === 'string'
          ? json.bestCloudTrailId
          : typeof json.summary?.bestCloudTrailId === 'string'
          ? json.summary.bestCloudTrailId
          : null,
      data: entries,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    return null;
  }
}

export type LiveBeaconStatus = 'active' | 'paused' | 'safe' | 'sos';

export interface LiveBeaconPosition {
  lat: number;
  lng: number;
  altitudeM?: number | null;
  accuracyM?: number | null;
  recordedAt: string;
}

export interface LiveBeaconBreadcrumb {
  lat: number;
  lng: number;
  altitudeM?: number | null;
  recordedAt: string;
}

export interface LiveBeaconSessionResponse {
  token: string;
  sharePath: string;
  expiresAt: string;
  status: LiveBeaconStatus;
}

export interface LiveBeaconPublicView {
  token: string;
  displayName: string;
  trailId?: string | null;
  trailName: string;
  status: LiveBeaconStatus;
  batteryPercent?: number | null;
  distanceKm: number;
  elevationGainM: number;
  lastPosition?: LiveBeaconPosition | null;
  breadcrumbs: LiveBeaconBreadcrumb[];
  emergencyNote?: string;
  expiresAt: string;
  startedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  minutesSinceLastPing: number | null;
  isSignalStale: boolean;
  trailSummary?: Record<string, unknown> | null;
}

export async function createLiveBeacon(payload: {
  trailId?: string;
  trailName: string;
  displayName?: string;
  lat?: number;
  lng?: number;
  altitudeM?: number | null;
  accuracyM?: number | null;
  batteryPercent?: number | null;
  emergencyNote?: string;
}): Promise<LiveBeaconSessionResponse> {
  const res = await apiFetch(`${API_BASE}/live-beacons`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonSafe<Record<string, unknown>>(res);
  if (!res.ok || !json.success || !json.data?.token) {
    throw new Error(json.message || 'Không thể khởi tạo liên kết chia sẻ vị trí Live Beacon.');
  }
  const d = json.data;
  const token = String(d.token);
  return {
    token,
    sharePath: typeof d.sharePath === 'string' ? d.sharePath : `/beacon/${token}`,
    expiresAt: String(d.expiresAt ?? ''),
    status: (d.status as LiveBeaconStatus) || 'active',
  };
}

export async function pingLiveBeacon(
  token: string,
  payload: {
    lat: number;
    lng: number;
    altitudeM?: number | null;
    accuracyM?: number | null;
    batteryPercent?: number | null;
    distanceKm?: number;
    elevationGainM?: number;
    status?: LiveBeaconStatus;
    emergencyNote?: string;
  }
): Promise<{ success: boolean; status?: LiveBeaconStatus; updatedAt?: string }> {
  const res = await apiFetch(`${API_BASE}/live-beacons/${encodeURIComponent(token)}/ping`, {
    method: 'PATCH',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonSafe<Record<string, unknown>>(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể cập nhật tọa độ Live Beacon.');
  }
  return {
    success: true,
    status: (json.data?.status as LiveBeaconStatus) || payload.status,
    updatedAt: typeof json.data?.updatedAt === 'string' ? json.data.updatedAt : undefined,
  };
}

export async function stopLiveBeacon(
  token: string,
  payload?: { distanceKm?: number; elevationGainM?: number; batteryPercent?: number | null; emergencyNote?: string }
): Promise<{ success: boolean; status: LiveBeaconStatus }> {
  const res = await apiFetch(`${API_BASE}/live-beacons/${encodeURIComponent(token)}/stop`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload || {}),
  });
  const json = await parseJsonSafe<Record<string, unknown>>(res);
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể đóng phiên Live Beacon.');
  }
  return {
    success: true,
    status: (json.data?.status as LiveBeaconStatus) || 'safe',
  };
}

export async function fetchLiveBeaconByToken(
  token: string,
  signal?: AbortSignal
): Promise<LiveBeaconPublicView | null> {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) return null;
  try {
    const res = await apiFetch(`${API_BASE}/live-beacons/${encodeURIComponent(cleanToken)}`, {
      headers: getApiHeaders(),
      signal,
    });
    if (res.status === 404 || res.status === 410) return null;
    const json = await parseJsonSafe(res);
    if (!res.ok || !json.success || !json.data) return null;
    const d = json.data as Record<string, unknown>;
    return {
      token: String(d.token ?? cleanToken),
      displayName: String(d.displayName ?? 'Trekker LOST'),
      trailId: typeof d.trailId === 'string' ? d.trailId : null,
      trailName: String(d.trailName ?? 'Hành trình thực địa'),
      status: (d.status as LiveBeaconStatus) || 'active',
      batteryPercent: typeof d.batteryPercent === 'number' ? d.batteryPercent : null,
      distanceKm: Number(d.distanceKm ?? 0) || 0,
      elevationGainM: Number(d.elevationGainM ?? 0) || 0,
      lastPosition: (d.lastPosition as LiveBeaconPosition) || null,
      breadcrumbs: Array.isArray(d.breadcrumbs) ? (d.breadcrumbs as LiveBeaconBreadcrumb[]) : [],
      emergencyNote: typeof d.emergencyNote === 'string' ? d.emergencyNote : undefined,
      expiresAt: String(d.expiresAt ?? ''),
      startedAt: typeof d.startedAt === 'string' ? d.startedAt : undefined,
      createdAt: typeof d.createdAt === 'string' ? d.createdAt : undefined,
      updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : undefined,
      minutesSinceLastPing:
        typeof d.minutesSinceLastPing === 'number' ? d.minutesSinceLastPing : null,
      isSignalStale: Boolean(d.isSignalStale),
      trailSummary:
        d.trailSummary && typeof d.trailSummary === 'object'
          ? (d.trailSummary as Record<string, unknown>)
          : null,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    return null;
  }
}

// ============================================================================
// WAVE 12B / 12D: Sea-of-Clouds & Safety Weather Alert Watchlist API
// ============================================================================

export type WeatherAlertVerdict = 'GO' | 'CAUTION' | 'NO_GO';

export interface WeatherAlertLiveEvaluation {
  status: WeatherAlertVerdict;
  score: number;
  weatherAvailable?: boolean;
  seaOfCloudsPercent: number | null;
  rainMm: number | null;
  windKmh: number | null;
  tempMinC: number | null;
  matchedConditions: string[];
  alertTriggered: boolean;
}

export interface WeatherAlertSubItem {
  _id?: string;
  id?: string;
  trailId: string;
  trailName?: string;
  province?: string;
  maxAltitudeM?: number;
  targetDate?: string | null;
  minSeaOfCloudsPct: number;
  maxRainMm: number;
  maxWindKmh: number;
  alertOnNoGo: boolean;
  isActive: boolean;
  lastEvaluatedAt?: string | null;
  lastNotifiedAt?: string | null;
  lastVerdict?: string | null;
  lastSeaOfCloudsPct?: number | null;
  createdAt?: string;
  updatedAt?: string;
  liveEvaluation?: WeatherAlertLiveEvaluation | null;
}

export interface UpsertWeatherAlertPayload {
  trailId: string;
  targetDate?: string | null;
  minSeaOfCloudsPct?: number;
  maxRainMm?: number;
  maxWindKmh?: number;
  alertOnNoGo?: boolean;
  isActive?: boolean;
}

export interface WeatherAlertListResponse {
  success: boolean;
  count: number;
  maxLimit: number;
  data: WeatherAlertSubItem[];
  unauthorized?: boolean;
}

export interface WeatherAlertEvaluateResponse {
  success: boolean;
  evaluatedCount: number;
  notificationsCreated: number;
  totalCount?: number;
  data: WeatherAlertSubItem[];
}

function normalizeWeatherAlertVerdict(raw: unknown): WeatherAlertVerdict {
  const s = String(raw || '').toUpperCase();
  if (s === 'NO_GO' || s === 'NO-GO' || s === 'DANGER') return 'NO_GO';
  if (s === 'CAUTION' || s === 'WARN' || s === 'WARNING') return 'CAUTION';
  return 'GO';
}

function parseNullableFiniteNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function normalizeWeatherAlertLiveEvaluation(raw: unknown): WeatherAlertLiveEvaluation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const score = Number(r.score ?? 0);
  const rawCloud = parseNullableFiniteNumber(r.seaOfCloudsPercent ?? r.seaOfCloudsPct);
  const rawRain = parseNullableFiniteNumber(r.rainMm ?? r.precipMm);
  const rawWind = parseNullableFiniteNumber(r.windKmh ?? r.windKmH ?? r.windSpeedKmH);
  const rawTemp = parseNullableFiniteNumber(r.tempMinC ?? r.summitTempMinC);
  const weatherAvailable =
    typeof r.weatherAvailable === 'boolean'
      ? r.weatherAvailable
      : rawCloud !== null || rawRain !== null || rawWind !== null || rawTemp !== null;
  const matchedConditions = Array.isArray(r.matchedConditions)
    ? r.matchedConditions.map((c) => String(c || '').trim()).filter(Boolean)
    : [];

  return {
    status: normalizeWeatherAlertVerdict(r.status),
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0,
    weatherAvailable,
    seaOfCloudsPercent:
      weatherAvailable && rawCloud !== null
        ? Math.max(0, Math.min(100, Math.round(rawCloud)))
        : null,
    rainMm:
      weatherAvailable && rawRain !== null
        ? Math.max(0, Math.round(rawRain * 10) / 10)
        : null,
    windKmh:
      weatherAvailable && rawWind !== null
        ? Math.max(0, Math.round(rawWind))
        : null,
    tempMinC:
      weatherAvailable && rawTemp !== null
        ? Math.round(rawTemp * 10) / 10
        : null,
    matchedConditions,
    alertTriggered: Boolean(r.alertTriggered),
  };
}

function normalizeWeatherAlertSubItem(raw: unknown): WeatherAlertSubItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const trailId = String(r.trailId ?? '').trim();
  if (!trailId) return null;

  const nestedTrail =
    r.trail && typeof r.trail === 'object' ? (r.trail as Record<string, unknown>) : null;
  const minCloudRaw = Number(r.minSeaOfCloudsPct ?? 70);
  const maxRainRaw = Number(r.maxRainMm ?? 10);
  const maxWindRaw = Number(r.maxWindKmh ?? 40);
  const maxAltRaw = Number(r.maxAltitudeM ?? nestedTrail?.maxAltitudeM ?? NaN);
  const lastCloudRaw = r.lastSeaOfCloudsPct;

  return {
    _id: typeof r._id === 'string' ? r._id : undefined,
    id: typeof r.id === 'string' ? r.id : typeof r._id === 'string' ? r._id : undefined,
    trailId,
    trailName:
      typeof r.trailName === 'string'
        ? r.trailName
        : typeof nestedTrail?.name === 'string'
        ? nestedTrail.name
        : undefined,
    province:
      typeof r.province === 'string'
        ? r.province
        : typeof nestedTrail?.province === 'string'
        ? nestedTrail.province
        : undefined,
    maxAltitudeM: Number.isFinite(maxAltRaw) ? maxAltRaw : undefined,
    targetDate:
      typeof r.targetDate === 'string' && r.targetDate.trim() ? r.targetDate.trim() : null,
    minSeaOfCloudsPct: Number.isFinite(minCloudRaw)
      ? Math.max(30, Math.min(95, Math.round(minCloudRaw)))
      : 70,
    maxRainMm: Number.isFinite(maxRainRaw)
      ? Math.max(0, Math.min(100, Math.round(maxRainRaw * 10) / 10))
      : 10,
    maxWindKmh: Number.isFinite(maxWindRaw)
      ? Math.max(10, Math.min(100, Math.round(maxWindRaw)))
      : 40,
    alertOnNoGo: typeof r.alertOnNoGo === 'boolean' ? r.alertOnNoGo : true,
    isActive: typeof r.isActive === 'boolean' ? r.isActive : true,
    lastEvaluatedAt: typeof r.lastEvaluatedAt === 'string' ? r.lastEvaluatedAt : null,
    lastNotifiedAt: typeof r.lastNotifiedAt === 'string' ? r.lastNotifiedAt : null,
    lastVerdict: typeof r.lastVerdict === 'string' ? r.lastVerdict : null,
    lastSeaOfCloudsPct:
      typeof lastCloudRaw === 'number' && Number.isFinite(lastCloudRaw)
        ? Math.max(0, Math.min(100, Math.round(lastCloudRaw)))
        : null,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : undefined,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : undefined,
    liveEvaluation: normalizeWeatherAlertLiveEvaluation(r.liveEvaluation),
  };
}

export async function fetchMyWeatherAlerts(
  signal?: AbortSignal
): Promise<WeatherAlertListResponse> {
  if (typeof window !== 'undefined' && !safeLocalStorageGet('lost_token')) {
    return { success: false, count: 0, maxLimit: 10, data: [], unauthorized: true };
  }
  try {
    const res = await apiFetch(`${API_BASE}/weather-alerts/me`, {
      headers: getApiHeaders(),
      signal,
    });
    if (res.status === 401 || res.status === 403) {
      return { success: false, count: 0, maxLimit: 10, data: [], unauthorized: true };
    }
    const json = await parseJsonSafe<unknown[]>(res);
    if (!res.ok || !json.success) {
      return { success: false, count: 0, maxLimit: 10, data: [] };
    }
    const items = (Array.isArray(json.data) ? json.data : [])
      .map((item) => normalizeWeatherAlertSubItem(item))
      .filter((item): item is WeatherAlertSubItem => item !== null);
    return {
      success: true,
      count: typeof json.count === 'number' ? json.count : items.length,
      maxLimit: typeof json.maxLimit === 'number' ? json.maxLimit : 10,
      data: items,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    return { success: false, count: 0, maxLimit: 10, data: [] };
  }
}

export async function upsertWeatherAlert(
  payload: UpsertWeatherAlertPayload,
  signal?: AbortSignal
): Promise<WeatherAlertSubItem> {
  const res = await apiFetch(`${API_BASE}/weather-alerts`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
    signal,
  });
  const json = await parseJsonSafe<unknown>(res);
  if (res.status === 401 || res.status === 403) {
    throw new Error(json.message || 'Vui lòng đăng nhập để đăng ký cảnh báo thời tiết đỉnh núi.');
  }
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể lưu cấu hình cảnh báo thời tiết. Vui lòng thử lại.');
  }
  const normalized = normalizeWeatherAlertSubItem(json.data);
  if (!normalized) {
    throw new Error('Phản hồi dữ liệu cảnh báo thời tiết không hợp lệ.');
  }
  return normalized;
}

export async function deleteWeatherAlert(
  trailId: string,
  signal?: AbortSignal
): Promise<{ success: boolean }> {
  const res = await apiFetch(`${API_BASE}/weather-alerts/${encodeURIComponent(trailId)}`, {
    method: 'DELETE',
    headers: getApiHeaders(),
    signal,
  });
  const json = await parseJsonSafe<unknown>(res);
  if (res.status === 401 || res.status === 403) {
    throw new Error(json.message || 'Vui lòng đăng nhập để hủy cảnh báo thời tiết.');
  }
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể hủy cảnh báo thời tiết cho cung đường này.');
  }
  return { success: true };
}

export async function evaluateMyWeatherAlerts(
  signal?: AbortSignal
): Promise<WeatherAlertEvaluateResponse> {
  const res = await apiFetch(`${API_BASE}/weather-alerts/evaluate`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
    signal,
  });
  const json = await parseJsonSafe<unknown[]>(res);
  if (res.status === 401 || res.status === 403) {
    throw new Error(json.message || 'Vui lòng đăng nhập để kiểm tra cảnh báo thời tiết.');
  }
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Không thể đánh giá cảnh báo thời tiết lúc này. Vui lòng thử lại.');
  }
  const items = (Array.isArray(json.data) ? json.data : [])
    .map((item) => normalizeWeatherAlertSubItem(item))
    .filter((item): item is WeatherAlertSubItem => item !== null);
  return {
    success: true,
    evaluatedCount: typeof json.evaluatedCount === 'number' ? json.evaluatedCount : items.length,
    notificationsCreated:
      typeof json.notificationsCreated === 'number' ? json.notificationsCreated : 0,
    totalCount: typeof json.totalCount === 'number' ? json.totalCount : undefined,
    data: items,
  };
}

// ============================================================================
// WAVE 14B / 14D: Crowdsourced Field POIs (/api/trail-pois) & Platform Pulse
// ============================================================================

export type TrailPoiCategory = 'water' | 'camp' | 'signal' | 'danger' | 'viewpoint';
export type TrailPoiStatus = 'active' | 'dry_or_closed';

export interface TrailPoiItem {
  _id: string;
  trailId: string;
  userId: string;
  authorName: string;
  category: TrailPoiCategory;
  title: string;
  notes: string;
  lat: number;
  lng: number;
  elevationM: number | null;
  status: TrailPoiStatus;
  upvoteCount: number;
  hasUpvoted: boolean;
  lastConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTrailPoiPayload {
  trailId: string;
  category: TrailPoiCategory;
  title: string;
  notes?: string;
  lat: number;
  lng: number;
  elevationM?: number | null;
  status?: TrailPoiStatus;
}

export interface PlatformPulseTrendingTrail {
  id: string;
  name: string;
  province: string;
  maxAltitudeM: number;
  activityScore: number;
}

export interface PlatformPulseData {
  fetchedAt?: string;
  totalTrails: number;
  activeIncidentsCount: number;
  openTripsCount: number;
  verifiedPoisCount: number;
  totalCommunityDistanceKm: number;
  totalCheckinsCount: number;
  trendingTrails: PlatformPulseTrendingTrail[];
}

const VALID_POI_CATEGORIES: ReadonlySet<string> = new Set([
  'water',
  'camp',
  'signal',
  'danger',
  'viewpoint',
]);

function normalizeTrailPoiItem(raw: unknown): TrailPoiItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r._id ?? r.id ?? '').trim();
  const trailId = String(r.trailId ?? '').trim();
  const lat = Number(r.lat);
  const lng = Number(r.lng);
  if (!id || !trailId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const rawCategory = String(r.category ?? 'water');
  const category: TrailPoiCategory = VALID_POI_CATEGORIES.has(rawCategory)
    ? (rawCategory as TrailPoiCategory)
    : 'water';
  const status: TrailPoiStatus =
    r.status === 'dry_or_closed' ? 'dry_or_closed' : 'active';
  const rawEle = parseNullableFiniteNumber(r.elevationM);
  const rawUpvotes = Number(r.upvoteCount ?? 0);

  return {
    _id: id,
    trailId,
    userId: String(r.userId ?? ''),
    authorName: String(r.authorName ?? 'Trekker LOST').trim() || 'Trekker LOST',
    category,
    title: String(r.title ?? '').trim(),
    notes: String(r.notes ?? '').trim(),
    lat,
    lng,
    elevationM: rawEle !== null ? Math.round(rawEle) : null,
    status,
    upvoteCount: Number.isFinite(rawUpvotes) ? Math.max(0, Math.round(rawUpvotes)) : 0,
    hasUpvoted: Boolean(r.hasUpvoted),
    lastConfirmedAt: typeof r.lastConfirmedAt === 'string' ? r.lastConfirmedAt : null,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : new Date().toISOString(),
  };
}

interface ApiStatusError extends Error {
  status?: number;
}

function createApiStatusError(message: string, status: number): ApiStatusError {
  const err = new Error(message) as ApiStatusError;
  err.status = status;
  return err;
}

export async function fetchTrailPois(
  trailId: string,
  category?: TrailPoiCategory | 'all',
  signal?: AbortSignal
): Promise<{
  success: boolean;
  data: TrailPoiItem[];
  maxPerTrail: number;
  offline?: boolean;
  error?: string;
}> {
  const cleanId = String(trailId || '').trim();
  if (!cleanId) return { success: false, data: [], maxPerTrail: 50 };

  const catKey = category && category !== 'all' ? category : 'all';
  const qs = catKey !== 'all' ? `?category=${encodeURIComponent(catKey)}` : '';

  return cachedRead<{
    success: boolean;
    data: TrailPoiItem[];
    maxPerTrail: number;
    offline?: boolean;
    error?: string;
  }>(
    `trail-pois:${getAuthCacheScope()}:${cleanId}:${catKey}`,
    20_000,
    async () => {
      try {
        const res = await apiFetch(
          `${API_BASE}/trail-pois/trail/${encodeURIComponent(cleanId)}${qs}`,
          {
            headers: getApiHeaders(),
          }
        );
        const json = await parseJsonSafe<unknown[]>(res);
        const maxPerTrail =
          typeof json.maxPerTrail === 'number' &&
          Number.isFinite(json.maxPerTrail) &&
          json.maxPerTrail > 0
            ? Math.round(json.maxPerTrail)
            : 50;
        if (!res.ok || !json.success) {
          return {
            value: {
              success: false,
              data: [],
              maxPerTrail,
              error:
                typeof json.message === 'string' && json.message.trim()
                  ? json.message.trim()
                  : undefined,
            },
            cacheable: false,
          };
        }
        const items = (Array.isArray(json.data) ? json.data : [])
          .map((row) => normalizeTrailPoiItem(row))
          .filter((row): row is TrailPoiItem => row !== null);
        return { value: { success: true, data: items, maxPerTrail }, cacheable: true };
      } catch {
        return { value: { success: false, data: [], maxPerTrail: 50, offline: true }, cacheable: false };
      }
    },
    signal
  );
}

export async function createTrailPoi(
  payload: CreateTrailPoiPayload,
  signal?: AbortSignal
): Promise<TrailPoiItem> {
  const res = await apiFetch(`${API_BASE}/trail-pois`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
    signal,
  });
  const json = await parseJsonSafe<unknown>(res);
  if (res.status === 401 || res.status === 403) {
    throw createApiStatusError(
      json.message || 'Vui lòng đăng nhập để báo điểm thực địa mới.',
      res.status
    );
  }
  if (!res.ok || !json.success) {
    throw createApiStatusError(
      json.message || 'Không thể lưu điểm thực địa. Vui lòng kiểm tra tọa độ và thử lại.',
      res.status
    );
  }
  const normalized = normalizeTrailPoiItem(json.data);
  if (!normalized) {
    throw new Error('Phản hồi dữ liệu điểm thực địa không hợp lệ.');
  }
  invalidateApiReadCache('trail-pois:');
  invalidateApiReadCache('analytics:');
  return normalized;
}

export async function toggleConfirmTrailPoi(
  poiId: string,
  signal?: AbortSignal
): Promise<{
  success: boolean;
  hasUpvoted: boolean;
  upvoteCount: number;
  lastConfirmedAt: string | null;
}> {
  const res = await apiFetch(`${API_BASE}/trail-pois/${encodeURIComponent(poiId)}/confirm`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
    signal,
  });
  const json = await parseJsonSafe<Record<string, unknown>>(res);
  if (res.status === 401 || res.status === 403) {
    throw createApiStatusError(
      json.message || 'Vui lòng đăng nhập để xác nhận điểm thực địa.',
      res.status
    );
  }
  if (!res.ok || !json.success) {
    throw createApiStatusError(
      json.message || 'Không thể cập nhật xác nhận lúc này.',
      res.status
    );
  }
  const nested = json.data && typeof json.data === 'object' ? json.data : null;
  const hasUpvoted =
    typeof json.hasUpvoted === 'boolean'
      ? json.hasUpvoted
      : Boolean(nested?.hasUpvoted);
  const rawCount = Number(json.upvoteCount ?? nested?.upvoteCount ?? 0);
  const lastConfirmedAt =
    typeof json.lastConfirmedAt === 'string'
      ? json.lastConfirmedAt
      : typeof nested?.lastConfirmedAt === 'string'
      ? nested.lastConfirmedAt
      : null;

  invalidateApiReadCache('trail-pois:');
  invalidateApiReadCache('analytics:');

  return {
    success: true,
    hasUpvoted,
    upvoteCount: Number.isFinite(rawCount) ? Math.max(0, Math.round(rawCount)) : 0,
    lastConfirmedAt,
  };
}

export async function updateTrailPoiStatus(
  poiId: string,
  status: TrailPoiStatus,
  signal?: AbortSignal
): Promise<TrailPoiItem> {
  const res = await apiFetch(`${API_BASE}/trail-pois/${encodeURIComponent(poiId)}/status`, {
    method: 'PATCH',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status }),
    signal,
  });
  const json = await parseJsonSafe<unknown>(res);
  if (res.status === 401 || res.status === 403) {
    throw createApiStatusError(
      json.message || 'Bạn không có quyền cập nhật trạng thái điểm này.',
      res.status
    );
  }
  if (!res.ok || !json.success) {
    throw createApiStatusError(
      json.message || 'Không thể đổi trạng thái điểm thực địa lúc này.',
      res.status
    );
  }
  const normalized = normalizeTrailPoiItem(json.data);
  if (!normalized) {
    throw new Error('Phản hồi trạng thái điểm thực địa không hợp lệ.');
  }
  invalidateApiReadCache('trail-pois:');
  invalidateApiReadCache('analytics:');
  return normalized;
}

export async function deleteTrailPoi(
  poiId: string,
  signal?: AbortSignal
): Promise<{ success: boolean }> {
  const res = await apiFetch(`${API_BASE}/trail-pois/${encodeURIComponent(poiId)}`, {
    method: 'DELETE',
    headers: getApiHeaders(),
    signal,
  });
  const json = await parseJsonSafe<unknown>(res);
  if (res.status === 401 || res.status === 403) {
    throw createApiStatusError(
      json.message || 'Bạn không có quyền xóa điểm thực địa này.',
      res.status
    );
  }
  if (!res.ok || !json.success) {
    throw createApiStatusError(
      json.message || 'Không thể xóa điểm thực địa lúc này.',
      res.status
    );
  }
  invalidateApiReadCache('trail-pois:');
  invalidateApiReadCache('analytics:');
  return { success: true };
}

export async function fetchPlatformPulse(
  signal?: AbortSignal
): Promise<PlatformPulseData | null> {
  return cachedRead<PlatformPulseData | null>(
    'analytics:pulse',
    25_000,
    async () => {
      try {
        const res = await apiFetch(`${API_BASE}/analytics/platform-pulse`, {
          headers: getPublicReadHeaders(),
        });
        const json = await parseJsonSafe<Record<string, unknown>>(res);
        if (!res.ok || !json.success || !json.data || typeof json.data !== 'object') {
          return { value: null, cacheable: false };
        }
        const d = json.data;
        const rawTrending = Array.isArray(d.trendingTrails) ? d.trendingTrails : [];
        const trendingTrails: PlatformPulseTrendingTrail[] = rawTrending
          .filter((t): t is Record<string, unknown> => Boolean(t && typeof t === 'object'))
          .map((t) => ({
            id: String(t.id ?? t._id ?? '').trim(),
            name: String(t.name ?? '').trim(),
            province: String(t.province ?? '').trim(),
            maxAltitudeM: Math.max(0, Math.round(Number(t.maxAltitudeM ?? 0) || 0)),
            activityScore: Math.max(0, Math.round(Number(t.activityScore ?? 0) || 0)),
          }))
          .filter((t) => Boolean(t.id && t.name));

        return {
          value: {
            fetchedAt: typeof json.fetchedAt === 'string' ? json.fetchedAt : undefined,
            totalTrails: Math.max(0, Math.round(Number(d.totalTrails ?? 0) || 0)),
            activeIncidentsCount: Math.max(0, Math.round(Number(d.activeIncidentsCount ?? 0) || 0)),
            openTripsCount: Math.max(0, Math.round(Number(d.openTripsCount ?? 0) || 0)),
            verifiedPoisCount: Math.max(0, Math.round(Number(d.verifiedPoisCount ?? 0) || 0)),
            totalCommunityDistanceKm:
              Math.max(0, Math.round((Number(d.totalCommunityDistanceKm ?? 0) || 0) * 10) / 10),
            totalCheckinsCount: Math.max(0, Math.round(Number(d.totalCheckinsCount ?? 0) || 0)),
            trendingTrails,
          },
          cacheable: true,
        };
      } catch {
        return { value: null, cacheable: false };
      }
    },
    signal
  );
}

// --- Wave 16B: NASA POWER (MERRA-2) 3-Year Summit Climate Normals & Cloud Annual Goals ---

export interface TrailClimateMonth {
  month: number;
  avgTempMinC: number;
  avgTempMaxC: number;
  avgRainMm: number;
  rainyDays: number;
  bestScore: number;
}

export interface TrailClimateResponse {
  success: boolean;
  cached: boolean;
  source: string;
  trailId: string;
  trailName: string;
  maxAltitudeM: number;
  gridElevationM?: number | null;
  lapseDropC?: number | null;
  period?: string;
  fetchedAt: string;
  months: TrailClimateMonth[];
  offline?: boolean;
  error?: string;
  status?: number;
}

function parseFiniteNum(val: unknown): number | null {
  if (val === null || val === undefined || typeof val === 'boolean') return null;
  if (typeof val === 'string' && val.trim() === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function normalizeClimateMonth(raw: unknown): TrailClimateMonth | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const rawMonth = parseFiniteNum(r.month);
  const rawMin = parseFiniteNum(r.avgTempMinC);
  const rawMax = parseFiniteNum(r.avgTempMaxC);
  const avgRainMm = parseFiniteNum(r.avgRainMm);
  const rainyDays = parseFiniteNum(r.rainyDays);
  const bestScore = parseFiniteNum(r.bestScore);

  if (
    rawMonth === null ||
    rawMin === null ||
    rawMax === null ||
    avgRainMm === null ||
    rainyDays === null ||
    bestScore === null
  ) {
    return null;
  }

  const month = Math.round(rawMonth);
  if (month < 1 || month > 12) return null;

  const avgTempMinC = Math.round(Math.min(rawMin, rawMax) * 10) / 10;
  const avgTempMaxC = Math.round(Math.max(rawMin, rawMax) * 10) / 10;

  return {
    month,
    avgTempMinC,
    avgTempMaxC,
    avgRainMm: Math.max(0, Math.round(avgRainMm)),
    rainyDays: Math.max(0, Math.min(31, Math.round(rainyDays * 10) / 10)),
    bestScore: Math.max(0, Math.min(100, Math.round(bestScore))),
  };
}

export async function fetchTrailClimateNormals(
  trailId: string,
  signal?: AbortSignal
): Promise<TrailClimateResponse> {
  const cleanId = String(trailId || '').trim();
  const emptyBase: TrailClimateResponse = {
    success: false,
    cached: false,
    source: '',
    trailId: cleanId,
    trailName: '',
    maxAltitudeM: 0,
    fetchedAt: '',
    months: [],
  };
  if (!cleanId) {
    return { ...emptyBase, error: 'Thiếu mã cung đường để tải dữ liệu khí hậu NASA POWER (MERRA-2).' };
  }

  return cachedRead<TrailClimateResponse>(
    `weather:climate:${cleanId}`,
    120_000,
    async () => {
      try {
        const res = await apiFetch(
          `${API_BASE}/weather/climate/${encodeURIComponent(cleanId)}`,
          {
            headers: getPublicReadHeaders(),
          }
        );
        const json = await parseJsonSafe<unknown>(res);
        const rawJson = json as Record<string, unknown>;
        const rawSource = typeof rawJson.source === 'string' ? rawJson.source : '';
        const rawMonths = Array.isArray(json.months)
          ? json.months
          : Array.isArray(json.data)
          ? json.data
          : [];

        const dedupMap = new Map<number, TrailClimateMonth>();
        for (const row of rawMonths) {
          const normalized = normalizeClimateMonth(row);
          if (normalized) {
            dedupMap.set(normalized.month, normalized);
          }
        }
        const months = Array.from(dedupMap.values()).sort((a, b) => a.month - b.month);

        if (!res.ok || !json.success || months.length === 0) {
          const fallbackError =
            res.status === 503
              ? 'Trạm lưu trữ khí hậu lịch sử NASA POWER (MERRA-2) tạm thời quá tải (503). Vui lòng thử lại sau ít phút.'
              : res.status === 429
              ? 'Bạn đã tra cứu khí hậu quá nhanh. Vui lòng đợi ít phút rồi thử lại.'
              : 'Không thể tải dữ liệu khí hậu 12 tháng cho cung đường này lúc này.';
          return {
            value: {
              ...emptyBase,
              source: rawSource,
              status: res.status,
              error:
                typeof json.message === 'string' && json.message.trim()
                  ? json.message.trim()
                  : fallbackError,
            },
            cacheable: false,
          };
        }

        const parsedAlt = parseFiniteNum(json.maxAltitudeM);
        const parsedGridEle = parseFiniteNum(rawJson.gridElevationM);
        const parsedLapse = parseFiniteNum(rawJson.lapseDropC);
        const period =
          typeof rawJson.period === 'string' && rawJson.period.trim()
            ? rawJson.period.trim()
            : undefined;

        return {
          value: {
            success: true,
            cached: Boolean(json.cached),
            source: rawSource || 'nasa-power-merra2-3yr',
            trailId: typeof json.trailId === 'string' && json.trailId.trim() ? json.trailId.trim() : cleanId,
            trailName: typeof json.trailName === 'string' ? json.trailName.trim() : '',
            maxAltitudeM: parsedAlt !== null ? Math.max(0, Math.round(parsedAlt)) : 0,
            gridElevationM: parsedGridEle !== null ? Math.max(0, Math.round(parsedGridEle)) : null,
            lapseDropC: parsedLapse !== null ? Math.round(parsedLapse * 10) / 10 : null,
            period,
            fetchedAt: typeof json.fetchedAt === 'string' ? json.fetchedAt : new Date().toISOString(),
            months,
            status: res.status,
          },
          cacheable: true,
        };
      } catch {
        return {
          value: {
            ...emptyBase,
            offline: true,
            error: 'Không thể kết nối máy chủ khí hậu NASA POWER (MERRA-2) lúc này (ngoại tuyến).',
          },
          cacheable: false,
        };
      }
    },
    signal
  );
}

export interface AnnualGoalsData {
  year: number;
  targetKm: number;
  targetElevationM: number;
  targetPeaks: number;
}

export type UpdateAnnualGoalsPayload = Partial<AnnualGoalsData>;

function normalizeAnnualGoals(raw: unknown): AnnualGoalsData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const rawYear = parseFiniteNum(r.year);
  const rawKm = parseFiniteNum(r.targetKm);
  const rawEle = parseFiniteNum(r.targetElevationM);
  const rawPeaks = parseFiniteNum(r.targetPeaks);

  if (rawYear === null || rawKm === null || rawEle === null || rawPeaks === null) {
    return null;
  }

  return {
    year: Math.max(2024, Math.min(2035, Math.round(rawYear))),
    targetKm: Math.max(10, Math.min(5000, Math.round(rawKm))),
    targetElevationM: Math.max(500, Math.min(200000, Math.round(rawEle))),
    targetPeaks: Math.max(1, Math.min(36, Math.round(rawPeaks))),
  };
}

export async function fetchMyAnnualGoals(
  signal?: AbortSignal
): Promise<{
  success: boolean;
  data: AnnualGoalsData | null;
  unauthorized?: boolean;
  offline?: boolean;
  error?: string;
}> {
  try {
    const res = await apiFetch(`${API_BASE}/users/me/goals`, {
      headers: getApiHeaders(),
      signal,
    });
    const json = await parseJsonSafe<unknown>(res);
    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        data: null,
        unauthorized: res.status === 401,
        error: json.message || 'Vui lòng đăng nhập để đồng bộ mục tiêu năm.',
      };
    }
    const normalized = normalizeAnnualGoals(json.data);
    if (!res.ok || !json.success || !normalized) {
      return {
        success: false,
        data: null,
        error: json.message || 'Không thể tải mục tiêu năm lúc này.',
      };
    }
    return { success: true, data: normalized };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    return {
      success: false,
      data: null,
      offline: true,
      error: 'Không thể kết nối máy chủ mục tiêu năm (ngoại tuyến).',
    };
  }
}

export async function updateMyAnnualGoals(
  payload: UpdateAnnualGoalsPayload,
  signal?: AbortSignal
): Promise<AnnualGoalsData> {
  const res = await apiFetch(`${API_BASE}/users/me/goals`, {
    method: 'PATCH',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
    signal,
  });
  const json = await parseJsonSafe<unknown>(res);
  if (res.status === 401 || res.status === 403) {
    throw createApiStatusError(
      json.message || 'Vui lòng đăng nhập lại để cập nhật mục tiêu năm.',
      res.status
    );
  }
  if (!res.ok || !json.success) {
    throw createApiStatusError(
      json.message || 'Không thể lưu mục tiêu năm. Vui lòng kiểm tra thông số và thử lại.',
      res.status
    );
  }
  const normalized = normalizeAnnualGoals(json.data);
  if (!normalized) {
    throw new Error('Phản hồi dữ liệu mục tiêu năm không hợp lệ.');
  }
  return normalized;
}
