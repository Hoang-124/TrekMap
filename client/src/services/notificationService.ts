import { getApiHeaders } from '../utils/sessionHeaders.js';
import type { NotificationItem } from '../types.js';

const API_BASE = 'http://localhost:5000/api';

export async function fetchNotifications(
  page = 1,
  limit = 20
): Promise<{ notifications: NotificationItem[]; unreadCount: number; pages: number }> {
  try {
    const res = await fetch(`${API_BASE}/notifications?page=${page}&limit=${limit}`, {
      headers: getApiHeaders(),
    });
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return {
        notifications: json.data,
        unreadCount: json.unreadCount || 0,
        pages: json.pagination?.pages || 1,
      };
    }
  } catch (err) {
    console.error('Fetch notifications error:', err);
  }
  return { notifications: [], unreadCount: 0, pages: 1 };
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/notifications/unread-count`, {
      headers: getApiHeaders(),
    });
    const json = await res.json();
    if (json.success && typeof json.count === 'number') {
      return json.count;
    }
  } catch (err) {
    console.error('Fetch unread count error:', err);
  }
  return 0;
}

export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: getApiHeaders(),
    });
    const json = await res.json();
    return !!json.success;
  } catch (err) {
    console.error('Mark notification read error:', err);
  }
  return false;
}

export async function markAllNotificationsAsRead(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PATCH',
      headers: getApiHeaders(),
    });
    const json = await res.json();
    return !!json.success;
  } catch (err) {
    console.error('Mark all read error:', err);
  }
  return false;
}
