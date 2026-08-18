import { getApiHeaders } from '../utils/sessionHeaders.js';
import type { Conversation, Message } from '../types.js';

const API_BASE = '/api';

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
  limit = 20
): Promise<{ messages: Message[]; hasMore: boolean }> {
  try {
    let url = `${API_BASE}/conversations/${conversationId}/messages?limit=${limit}`;
    if (before) {
      url += `&before=${before}`;
    }
    const res = await fetch(url, {
      headers: getApiHeaders(),
    });
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return { messages: json.data, hasMore: !!json.hasMore };
    }
  } catch (err) {
    console.error('Fetch messages error:', err);
  }
  return { messages: [], hasMore: false };
}

export async function sendMessage(
  conversationId: string,
  content: string
): Promise<{ success: boolean; data?: Message; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ conversationId, content }),
    });
    const json = await res.json();
    if (json.success && json.data) {
      return { success: true, data: json.data };
    }
    return { success: false, error: json.message || 'Không thể gửi tin nhắn' };
  } catch (err: any) {
    console.error('Send message error:', err);
    return { success: false, error: err?.message || 'Lỗi mạng khi gửi tin nhắn' };
  }
}

export async function markConversationAsRead(conversationId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/conversations/${conversationId}/read`, {
      method: 'PATCH',
      headers: getApiHeaders(),
    });
    const json = await res.json();
    return !!json.success;
  } catch (err) {
    console.error('Mark read error:', err);
  }
  return false;
}
