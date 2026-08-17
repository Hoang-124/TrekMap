import { getApiHeaders } from '../utils/sessionHeaders.js';
import type { NotificationItem, NotificationCategory } from '../types.js';

const API_BASE = 'http://localhost:5000/api';

export async function fetchNotifications(
  page = 1,
  limit = 30,
  category?: NotificationCategory | 'all'
): Promise<{
  notifications: NotificationItem[];
  unreadCount: number;
  totalCount: number;
  categoryCounts: { [key: string]: number };
}> {
  try {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (category && category !== 'all') {
      query.append('category', category);
    }

    const res = await fetch(`${API_BASE}/notifications?${query.toString()}`, {
      headers: getApiHeaders(),
    });
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return {
        notifications: json.data,
        unreadCount: json.unreadCount || 0,
        totalCount: json.totalCount || json.data.length,
        categoryCounts: json.categoryCounts || {},
      };
    }
  } catch (err) {
    console.error('Fetch notifications error:', err);
  }
  return { notifications: [], unreadCount: 0, totalCount: 0, categoryCounts: {} };
}

export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
      method: 'PUT',
      headers: getApiHeaders(),
    });
    const json = await res.json();
    return !!json.success;
  } catch (err) {
    console.error('Mark notification read error:', err);
  }
  return false;
}

export async function markAllNotificationsAsRead(category?: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PUT',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ category }),
    });
    const json = await res.json();
    return !!json.success;
  } catch (err) {
    console.error('Mark all read error:', err);
  }
  return false;
}

export async function deleteNotification(notificationId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: getApiHeaders(),
    });
    const json = await res.json();
    return !!json.success;
  } catch (err) {
    console.error('Delete notification error:', err);
  }
  return false;
}

export async function clearReadNotifications(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/notifications`, {
      method: 'DELETE',
      headers: getApiHeaders(),
    });
    const json = await res.json();
    return !!json.success;
  } catch (err) {
    console.error('Clear read notifications error:', err);
  }
  return false;
}
