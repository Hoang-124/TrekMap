import { fetchWithTimeout, getApiHeaders } from '../utils/sessionHeaders.js';
import type { NotificationItem, NotificationCategory } from '../types.js';

const API_BASE = '/api';

export const NOTIFICATIONS_SYNC_EVENT = 'lost:notifications-synced';
export type NotificationSyncSource = 'bell' | 'page';

export interface FetchNotificationsResult {
  ok: boolean;
  error?: string;
  notifications: NotificationItem[];
  unreadCount: number;
  totalCount: number;
  categoryCounts: { [key: string]: number };
}

export function dispatchNotificationsSynced(source: NotificationSyncSource): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<{ source: NotificationSyncSource }>(NOTIFICATIONS_SYNC_EVENT, {
        detail: { source },
      })
    );
  }
}

export function dispatchNotificationToast(
  message: string,
  type: 'success' | 'error' | 'info' = 'error'
): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('lost:show-toast', {
        detail: { message, type },
      })
    );
  }
}

/**
 * Shared notification deep-link navigator.
 * - Splits query string cleanly before encoding trail IDs (prevents `%3F` double-encoding).
 * - Delegates all internal paths to `onNavigate` (preserving mobile drawer closing & auth guards).
 * - Notifies mounted MessagesPage when switching `?convId=` in place.
 */
export function navigateNotificationLink(
  link: string,
  onNavigate?: (target: string) => void
): void {
  const trimmed = link.trim();
  if (!trimmed) return;

  // Reject unsafe schemes
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return;

  let normalizedTarget = trimmed;
  if (trimmed.startsWith('/#trail/') || trimmed.startsWith('#trail/')) {
    const rest = trimmed.replace(/^\/?#trail\//, '');
    const qIdx = rest.indexOf('?');
    const rawTrailId = (qIdx >= 0 ? rest.slice(0, qIdx) : rest).trim();
    const rawQuery = qIdx >= 0 ? rest.slice(qIdx) : '';
    if (!rawTrailId) return;
    let safeTrailId: string;
    try {
      safeTrailId = decodeURIComponent(rawTrailId);
    } catch {
      safeTrailId = rawTrailId;
    }
    normalizedTarget = `/trails/${encodeURIComponent(safeTrailId)}${rawQuery}`;
  } else if (trimmed.startsWith('//')) {
    return;
  }

  let dmConvId: string | null = null;
  if (normalizedTarget.startsWith('/messages')) {
    const qIdx = normalizedTarget.indexOf('?');
    if (qIdx >= 0) {
      dmConvId = new URLSearchParams(normalizedTarget.slice(qIdx + 1)).get('convId')?.trim() || null;
    }
  }

  if (onNavigate) {
    const navArg =
      normalizedTarget.startsWith('/') || normalizedTarget.startsWith('#')
        ? normalizedTarget
        : normalizedTarget.replace(/^#/, '');
    onNavigate(navArg);
    if (dmConvId && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent<{ convId: string }>('lost:messages-select-conv', {
          detail: { convId: dmConvId },
        })
      );
    }
    return;
  }

  if (typeof window === 'undefined') return;

  if (normalizedTarget.startsWith('/')) {
    window.history.pushState({}, '', normalizedTarget);
    window.dispatchEvent(new PopStateEvent('popstate'));
    if (dmConvId) {
      window.dispatchEvent(
        new CustomEvent<{ convId: string }>('lost:messages-select-conv', {
          detail: { convId: dmConvId },
        })
      );
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  window.location.hash = normalizedTarget.startsWith('#')
    ? normalizedTarget
    : `#${normalizedTarget}`;
}

export async function fetchNotifications(
  page = 1,
  limit = 30,
  category?: NotificationCategory | 'all',
  signal?: AbortSignal
): Promise<FetchNotificationsResult> {
  try {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (category && category !== 'all') {
      query.append('category', category);
    }

    const res = await fetchWithTimeout(`${API_BASE}/notifications?${query.toString()}`, {
      headers: getApiHeaders(),
      signal,
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && Array.isArray(json.data)) {
      return {
        ok: true,
        notifications: json.data as NotificationItem[],
        unreadCount: typeof json.unreadCount === 'number' ? json.unreadCount : 0,
        totalCount: typeof json.totalCount === 'number' ? json.totalCount : json.data.length,
        categoryCounts: json.categoryCounts || {},
      };
    }
    return {
      ok: false,
      error: json?.message || 'Không thể tải danh sách thông báo.',
      notifications: [],
      unreadCount: 0,
      totalCount: 0,
      categoryCounts: {},
    };
  } catch (err) {
    if (signal?.aborted) {
      throw err;
    }
    console.error('Fetch notifications error:', err);
    return {
      ok: false,
      error: 'Mất kết nối máy chủ. Không thể tải thông báo.',
      notifications: [],
      unreadCount: 0,
      totalCount: 0,
      categoryCounts: {},
    };
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/notifications/${encodeURIComponent(notificationId)}/read`,
      {
        method: 'PUT',
        headers: getApiHeaders(),
      }
    );
    const json = await res.json().catch(() => ({}));
    return res.ok && Boolean(json?.success);
  } catch (err) {
    console.error('Mark notification read error:', err);
  }
  return false;
}

export async function markAllNotificationsAsRead(category?: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/notifications/read-all`, {
      method: 'PUT',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ category }),
    });
    const json = await res.json().catch(() => ({}));
    return res.ok && Boolean(json?.success);
  } catch (err) {
    console.error('Mark all read error:', err);
  }
  return false;
}

export async function deleteNotification(notificationId: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/notifications/${encodeURIComponent(notificationId)}`,
      {
        method: 'DELETE',
        headers: getApiHeaders(),
      }
    );
    const json = await res.json().catch(() => ({}));
    return res.ok && Boolean(json?.success);
  } catch (err) {
    console.error('Delete notification error:', err);
  }
  return false;
}

export async function clearReadNotifications(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/notifications`, {
      method: 'DELETE',
      headers: getApiHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    return res.ok && Boolean(json?.success);
  } catch (err) {
    console.error('Clear read notifications error:', err);
  }
  return false;
}
