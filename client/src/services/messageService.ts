import { fetchWithTimeout, getApiHeaders, UPLOAD_API_TIMEOUT_MS } from '../utils/sessionHeaders.js';
import type { Conversation, Message } from '../types.js';

const API_BASE = '/api';

export interface RichMessage extends Message {
  images?: string[];
  editedAt?: string | null;
  isDeleted?: boolean;
}

export interface FetchConversationsPageResult {
  ok: boolean;
  conversations: Conversation[];
  hasMore: boolean;
  error?: string;
}

export interface FetchMessagesResult {
  ok: boolean;
  messages: RichMessage[];
  hasMore: boolean;
  error?: string;
}

export function notifyMessagesUnreadChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lost:messages-unread-changed'));
  }
}

export async function fetchConversationsPage(options?: {
  limit?: number;
  skip?: number;
  signal?: AbortSignal;
}): Promise<FetchConversationsPageResult> {
  const limit = Math.min(Math.max(options?.limit ?? 30, 1), 50);
  const skip = Math.max(options?.skip ?? 0, 0);
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (skip > 0) {
      params.set('skip', String(skip));
    }
    const res = await fetchWithTimeout(`${API_BASE}/conversations?${params.toString()}`, {
      headers: getApiHeaders(),
      signal: options?.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && Array.isArray(json.data)) {
      const list = json.data as Conversation[];
      const hasMore =
        typeof json.hasMore === 'boolean' ? json.hasMore : list.length >= limit;
      return { ok: true, conversations: list, hasMore };
    }
    return {
      ok: false,
      conversations: [],
      hasMore: false,
      error: json?.message || 'Không thể tải danh sách hội thoại.',
    };
  } catch (err) {
    if (options?.signal?.aborted) {
      return { ok: false, conversations: [], hasMore: false };
    }
    console.error('Fetch conversations error:', err);
    return {
      ok: false,
      conversations: [],
      hasMore: false,
      error: 'Không thể kết nối máy chủ để tải hội thoại.',
    };
  }
}

export async function fetchConversations(options?: {
  limit?: number;
  skip?: number;
}): Promise<Conversation[]> {
  const result = await fetchConversationsPage(options);
  return result.conversations;
}

export async function fetchConversationById(conversationId: string): Promise<Conversation | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}`, {
      headers: getApiHeaders(),
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({}));
    if (json?.success && json.data) {
      return json.data as Conversation;
    }
  } catch (err) {
    console.error('Fetch conversation by id error:', err);
  }
  return null;
}

export async function getOrCreateConversation(targetUserId: string): Promise<Conversation | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ targetUserId }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json.data) {
      return json.data as Conversation;
    }
  } catch (err) {
    console.error('Get or create conversation error:', err);
  }
  return null;
}

export async function fetchMessages(
  conversationId: string,
  before?: string,
  limit = 40,
  search?: string,
  signal?: AbortSignal
): Promise<FetchMessagesResult> {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set('before', before);
    if (search && search.trim()) params.set('search', search.trim());
    const res = await fetchWithTimeout(
      `${API_BASE}/conversations/${encodeURIComponent(conversationId)}/messages?${params.toString()}`,
      {
        headers: getApiHeaders(),
        signal,
      }
    );
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && Array.isArray(json.data)) {
      return {
        ok: true,
        messages: json.data as RichMessage[],
        hasMore: Boolean(json.hasMore),
      };
    }
    return {
      ok: false,
      messages: [],
      hasMore: false,
      error: json?.message || 'Không thể tải tin nhắn.',
    };
  } catch (err) {
    if (signal?.aborted) {
      throw err;
    }
    console.error('Fetch messages error:', err);
    return {
      ok: false,
      messages: [],
      hasMore: false,
      error: 'Không thể kết nối máy chủ để tải tin nhắn.',
    };
  }
}

export async function uploadMessageImage(
  imageBase64: string,
  filename?: string
): Promise<string> {
  const res = await fetchWithTimeout(
    `${API_BASE}/upload`,
    {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ imageBase64, filename, category: 'messages' }),
    },
    UPLOAD_API_TIMEOUT_MS
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success || !json.url) {
    throw new Error(json?.message || 'Không thể tải ảnh lên máy chủ. Vui lòng thử lại.');
  }
  return String(json.url);
}

export async function sendMessage(
  conversationId: string,
  content: string,
  images?: string[]
): Promise<{ success: boolean; data?: RichMessage; error?: string }> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/messages`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        conversationId,
        content,
        images: Array.isArray(images) && images.length > 0 ? images : undefined,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json.data) {
      return { success: true, data: json.data as RichMessage };
    }
    return { success: false, error: json?.message || 'Không thể gửi tin nhắn' };
  } catch (err: unknown) {
    console.error('Send message error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Lỗi mạng khi gửi tin nhắn',
    };
  }
}

export async function editMessage(
  messageId: string,
  content: string
): Promise<{
  success: boolean;
  data?: { _id: string; conversation: string; content: string; editedAt: string };
  error?: string;
}> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/messages/${encodeURIComponent(messageId)}`, {
      method: 'PATCH',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ content }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json.data) {
      return { success: true, data: json.data };
    }
    return { success: false, error: json?.message || 'Không thể chỉnh sửa tin nhắn' };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Lỗi mạng khi chỉnh sửa tin nhắn',
    };
  }
}

export async function deleteMessage(
  messageId: string
): Promise<{
  success: boolean;
  data?: { _id: string; conversation: string; content: string; isDeleted: boolean };
  error?: string;
}> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/messages/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
      headers: getApiHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json.data) {
      return { success: true, data: json.data };
    }
    return { success: false, error: json?.message || 'Không thể thu hồi tin nhắn' };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Lỗi mạng khi thu hồi tin nhắn',
    };
  }
}

export async function markConversationAsRead(conversationId: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/read`, {
      method: 'PATCH',
      headers: getApiHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success) {
      notifyMessagesUnreadChanged();
      return true;
    }
  } catch (err) {
    console.error('Mark read error:', err);
  }
  return false;
}
