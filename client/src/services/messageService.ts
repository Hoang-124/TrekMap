import { getApiHeaders } from '../utils/sessionHeaders.js';
import type { Conversation, Message } from '../types.js';

const API_BASE = '/api';

export interface RichMessage extends Message {
  images?: string[];
  editedAt?: string | null;
  isDeleted?: boolean;
}

export function notifyMessagesUnreadChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lost:messages-unread-changed'));
  }
}

export async function fetchConversations(): Promise<Conversation[]> {
  try {
    const res = await fetch(`${API_BASE}/conversations`, {
      headers: getApiHeaders(),
    });
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data;
    }
  } catch (err) {
    console.error('Fetch conversations error:', err);
  }
  return [];
}

export async function fetchConversationById(conversationId: string): Promise<Conversation | null> {
  try {
    const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}`, {
      headers: getApiHeaders(),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && json.data) {
      return json.data as Conversation;
    }
  } catch (err) {
    console.error('Fetch conversation by id error:', err);
  }
  return null;
}

export async function getOrCreateConversation(targetUserId: string): Promise<Conversation | null> {
  try {
    const res = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ targetUserId }),
    });
    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
  } catch (err) {
    console.error('Get or create conversation error:', err);
  }
  return null;
}

export async function fetchMessages(
  conversationId: string,
  before?: string,
  limit = 20,
  search?: string
): Promise<{ messages: RichMessage[]; hasMore: boolean }> {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set('before', before);
    if (search && search.trim()) params.set('search', search.trim());
    const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/messages?${params.toString()}`, {
      headers: getApiHeaders(),
    });
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return { messages: json.data as RichMessage[], hasMore: !!json.hasMore };
    }
  } catch (err) {
    console.error('Fetch messages error:', err);
  }
  return { messages: [], hasMore: false };
}

export async function sendMessage(
  conversationId: string,
  content: string,
  images?: string[]
): Promise<{ success: boolean; data?: RichMessage; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        conversationId,
        content,
        images: Array.isArray(images) && images.length > 0 ? images : undefined,
      }),
    });
    const json = await res.json();
    if (json.success && json.data) {
      return { success: true, data: json.data as RichMessage };
    }
    return { success: false, error: json.message || 'Không thể gửi tin nhắn' };
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
): Promise<{ success: boolean; data?: { _id: string; conversation: string; content: string; editedAt: string }; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(messageId)}`, {
      method: 'PATCH',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ content }),
    });
    const json = await res.json();
    if (res.ok && json.success && json.data) {
      return { success: true, data: json.data };
    }
    return { success: false, error: json.message || 'Không thể chỉnh sửa tin nhắn' };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Lỗi mạng khi chỉnh sửa tin nhắn',
    };
  }
}

export async function deleteMessage(
  messageId: string
): Promise<{ success: boolean; data?: { _id: string; conversation: string; content: string; isDeleted: boolean }; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
      headers: getApiHeaders(),
    });
    const json = await res.json();
    if (res.ok && json.success && json.data) {
      return { success: true, data: json.data };
    }
    return { success: false, error: json.message || 'Không thể thu hồi tin nhắn' };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Lỗi mạng khi thu hồi tin nhắn',
    };
  }
}

export async function markConversationAsRead(conversationId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/read`, {
      method: 'PATCH',
      headers: getApiHeaders(),
    });
    const json = await res.json();
    if (json.success) {
      notifyMessagesUnreadChanged();
      return true;
    }
  } catch (err) {
    console.error('Mark read error:', err);
  }
  return false;
}
