import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { UserProfile, Conversation } from '../../types.js';
import { ConversationList } from './ConversationList.js';
import { ChatWindow } from './ChatWindow.js';
import {
  fetchConversations,
  fetchConversationById,
  sendMessage as sendMessageApi,
  editMessage as editMessageApi,
  deleteMessage as deleteMessageApi,
  markConversationAsRead,
  getOrCreateConversation,
  notifyMessagesUnreadChanged,
} from '../../services/messageService.js';
import type { RichMessage } from '../../services/messageService.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { useSocket } from '../../hooks/useSocket.js';

interface MessagesPageProps {
  currentUser: UserProfile | null;
  initialConversationId?: string | null;
  targetUserId?: string | null;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const PAGE_LIMIT = 40;

export const MessagesPage: React.FC<MessagesPageProps> = ({
  currentUser,
  initialConversationId,
  targetUserId,
  onShowToast,
}) => {
  const currentUserId = currentUser?.id || (currentUser as (UserProfile & { _id?: string }) | null)?._id || '';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeTargetConv, setActiveTargetConv] = useState<Conversation | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId || null);
  const [messages, setMessages] = useState<RichMessage[]>([]);
  const [messagesConvId, setMessagesConvId] = useState<string | null>(null);
  const [loadedConvId, setLoadedConvId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingOlder, setLoadingOlder] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>(initialConversationId ? 'chat' : 'list');
  const [convRefreshTick, setConvRefreshTick] = useState<number>(0);
  const [chatSearchQuery, setChatSearchQuery] = useState<string>('');
  const [debouncedChatSearch, setDebouncedChatSearch] = useState<string>('');

  const didInitTargetRef = useRef<string | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);
  const conversationsRef = useRef<Conversation[]>([]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Debounce in-chat search query
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedChatSearch(chatSearchQuery.trim());
    }, 280);
    return () => window.clearTimeout(timer);
  }, [chatSearchQuery]);

  const { socket } = useSocket();

  const visibleMessages = useMemo(
    () => (selectedId && messagesConvId === selectedId ? messages : []),
    [selectedId, messagesConvId, messages]
  );
  const visibleHasMore = Boolean(selectedId && messagesConvId === selectedId && hasMore);
  const loadingMessages = Boolean(selectedId) && loadedConvId !== `${selectedId}:${debouncedChatSearch}`;

  const triggerReloadConversations = useCallback(() => {
    setConvRefreshTick((prev) => prev + 1);
  }, []);

  // Load conversations on mount / refresh and handle target chat & deep-link group chat handoff
  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;

    const run = async () => {
      const storedGroupConv = localStorage.getItem('lost_target_group_conv');
      if (storedGroupConv) {
        localStorage.removeItem('lost_target_group_conv');
      }

      const storedTarget = localStorage.getItem('lost_target_chat_user');
      if (storedTarget) {
        localStorage.removeItem('lost_target_chat_user');
      }
      const target =
        storedTarget || (targetUserId && didInitTargetRef.current !== targetUserId ? targetUserId : null);

      let created: Conversation | null = null;
      if (target) {
        didInitTargetRef.current = target;
        created = await getOrCreateConversation(target);
      }

      const list = await fetchConversations();
      if (cancelled) return;

      const urlConvId =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('convId')?.trim() || null
          : null;
      const deepLinkConvId = storedGroupConv || urlConvId || initialConversationId || null;
      let mergedList = list;
      let deepLinkedConv: Conversation | null = null;

      if (deepLinkConvId && !list.some((c) => String(c._id) === String(deepLinkConvId))) {
        deepLinkedConv = await fetchConversationById(deepLinkConvId);
        if (cancelled) return;
        if (deepLinkedConv) {
          mergedList = [deepLinkedConv, ...list];
        }
      }

      conversationsRef.current = mergedList;
      setConversations(mergedList);

      if (storedGroupConv) {
        if (deepLinkedConv) setActiveTargetConv(deepLinkedConv);
        setSelectedId(storedGroupConv);
        setMobileView('chat');
      } else if (created) {
        setActiveTargetConv(created);
        setSelectedId(created._id);
        setMobileView('chat');
      } else if (deepLinkedConv && initialConversationId) {
        setActiveTargetConv(deepLinkedConv);
        setSelectedId(deepLinkedConv._id);
        setMobileView('chat');
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, targetUserId, initialConversationId, convRefreshTick]);

  // Optimistic conversation preview update (checks conversationsRef synchronously — safe under React 18 batching!)
  const updateConversationPreview = useCallback(
    (msg: RichMessage, incrementUnread: boolean): boolean => {
      const targetConvId = String(msg.conversation);
      const exists = conversationsRef.current.some((c) => String(c._id) === targetConvId);
      if (!exists) return false;

      const previewContent =
        msg.isDeleted
          ? 'Tin nhắn đã bị thu hồi'
          : msg.content ||
            (Array.isArray(msg.images) && msg.images.length > 0
              ? msg.images.length > 1
                ? `[Đã gửi ${msg.images.length} hình ảnh]`
                : '[Đã gửi hình ảnh]'
              : '');

      setConversations((prev) => {
        const idx = prev.findIndex((c) => String(c._id) === targetConvId);
        if (idx === -1) return prev;
        const target = prev[idx];
        const updated: Conversation = {
          ...target,
          lastMessage: {
            content: previewContent,
            sender: msg.sender,
            createdAt: msg.createdAt,
          },
          updatedAt: msg.createdAt || new Date().toISOString(),
          unreadCount: incrementUnread ? (target.unreadCount || 0) + 1 : 0,
        };
        const rest = prev.filter((_, i) => i !== idx);
        const nextList = [updated, ...rest];
        conversationsRef.current = nextList;
        return nextList;
      });
      if (incrementUnread) {
        notifyMessagesUnreadChanged();
      }
      return true;
    },
    []
  );

  // Load messages for selected conversation (and search query) with AbortController race guard
  useEffect(() => {
    if (!selectedId) return;

    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    const loadKey = `${selectedId}:${debouncedChatSearch}`;

    const loadInitial = async () => {
      try {
        const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });
        if (debouncedChatSearch) {
          params.set('search', debouncedChatSearch);
        }
        const res = await fetch(
          `/api/conversations/${encodeURIComponent(selectedId)}/messages?${params.toString()}`,
          {
            headers: getApiHeaders(),
            signal: controller.signal,
          }
        );
        const json = await res.json();
        if (controller.signal.aborted) return;

        if (json?.success && Array.isArray(json.data)) {
          setMessages(json.data);
          setMessagesConvId(selectedId);
          setHasMore(Boolean(json.hasMore));
        } else {
          setMessages([]);
          setMessagesConvId(selectedId);
          setHasMore(false);
        }
        setLoadedConvId(loadKey);

        if (!debouncedChatSearch) {
          await markConversationAsRead(selectedId);
          if (controller.signal.aborted) return;

          setConversations((prev) => {
            const next = prev.map((c) => (c._id === selectedId ? { ...c, unreadCount: 0 } : c));
            conversationsRef.current = next;
            return next;
          });
          notifyMessagesUnreadChanged();
        }
      } catch (err: unknown) {
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        if (isAbort || controller.signal.aborted) return;
        console.error('Fetch messages error:', err);
        setLoadedConvId(loadKey);
      }
    };

    void loadInitial();

    return () => {
      controller.abort();
    };
  }, [selectedId, debouncedChatSearch]);

  // Pagination: Load older messages ("Tải thêm tin nhắn cũ")
  const handleLoadOlderMessages = useCallback(async () => {
    const convId = selectedIdRef.current;
    if (!convId || !visibleHasMore || loadingOlder || visibleMessages.length === 0) return;

    const oldestId = visibleMessages[0]?._id;
    if (!oldestId) return;

    setLoadingOlder(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_LIMIT),
        before: String(oldestId),
      });
      if (debouncedChatSearch) {
        params.set('search', debouncedChatSearch);
      }
      const res = await fetch(
        `/api/conversations/${encodeURIComponent(convId)}/messages?${params.toString()}`,
        { headers: getApiHeaders() }
      );
      const json = await res.json();
      if (selectedIdRef.current !== convId) return;

      if (json?.success && Array.isArray(json.data)) {
        const older: RichMessage[] = json.data;
        setHasMore(Boolean(json.hasMore));
        if (older.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => String(m._id)));
            const uniqueOlder = older.filter((m) => !existingIds.has(String(m._id)));
            return [...uniqueOlder, ...prev];
          });
        }
      }
    } catch (err) {
      console.error('Load older messages error:', err);
      onShowToast?.('Không thể tải thêm tin nhắn cũ.', 'error');
    } finally {
      setLoadingOlder(false);
    }
  }, [visibleHasMore, loadingOlder, visibleMessages, debouncedChatSearch, onShowToast]);

  // Listen to Socket real-time events: newMessage, messageRead, messageUpdated, messageDeleted
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMsg: RichMessage) => {
      const isCurrentConv = Boolean(selectedId && String(newMsg.conversation) === String(selectedId));
      const senderId = typeof newMsg.sender === 'object' ? newMsg.sender?._id : newMsg.sender;
      const isFromMe = String(senderId) === String(currentUserId);

      if (isCurrentConv && !debouncedChatSearch) {
        setMessages((prev) => {
          if (prev.some((m) => String(m._id) === String(newMsg._id))) {
            return prev;
          }
          return [...prev, newMsg];
        });
        setMessagesConvId(selectedId);
        if (!isFromMe) {
          void markConversationAsRead(selectedId!);
        }
      }

      // Optimistically update existing conversation preview; only refetch if brand-new conversation
      const existsInList = updateConversationPreview(newMsg, !isCurrentConv && !isFromMe);
      if (!existsInList) {
        triggerReloadConversations();
        if (!isFromMe) {
          notifyMessagesUnreadChanged();
        }
      }
    };

    const handleMessageRead = (payload: { conversationId: string; userId: string }) => {
      if (String(payload.userId) === String(currentUserId)) {
        setConversations((prev) => {
          const next = prev.map((c) =>
            String(c._id) === String(payload.conversationId) ? { ...c, unreadCount: 0 } : c
          );
          conversationsRef.current = next;
          return next;
        });
        notifyMessagesUnreadChanged();
      }
      if (selectedId && String(payload.conversationId) === String(selectedId)) {
        setMessages((prev) =>
          prev.map((m) => {
            const readBy = Array.isArray(m.readBy) ? m.readBy : [];
            if (!readBy.includes(payload.userId)) {
              return { ...m, readBy: [...readBy, payload.userId] };
            }
            return m;
          })
        );
      }
    };

    const handleMessageUpdated = (payload: { _id: string; conversation: string; content: string; editedAt: string }) => {
      if (selectedId && String(payload.conversation) === String(selectedId)) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(payload._id)
              ? { ...m, content: payload.content, editedAt: payload.editedAt }
              : m
          )
        );
      }
      triggerReloadConversations();
    };

    const handleMessageDeleted = (payload: { _id: string; conversation: string; content: string; isDeleted: boolean }) => {
      if (selectedId && String(payload.conversation) === String(selectedId)) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(payload._id)
              ? { ...m, content: payload.content || 'Tin nhắn đã bị thu hồi', images: [], isDeleted: true }
              : m
          )
        );
      }
      triggerReloadConversations();
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('messageRead', handleMessageRead);
    socket.on('messageUpdated', handleMessageUpdated);
    socket.on('messageDeleted', handleMessageDeleted);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messageRead', handleMessageRead);
      socket.off('messageUpdated', handleMessageUpdated);
      socket.off('messageDeleted', handleMessageDeleted);
    };
  }, [socket, selectedId, currentUserId, debouncedChatSearch, updateConversationPreview, triggerReloadConversations]);

  const handleSelectConversation = (id: string) => {
    setChatSearchQuery('');
    setDebouncedChatSearch('');
    setSelectedId(id);
    setMobileView('chat');
  };

  const handleSendMessage = async (content: string, images?: string[]): Promise<boolean> => {
    if (!selectedId || isSending) return false;
    setIsSending(true);
    try {
      const res = await sendMessageApi(selectedId, content, images);
      if (res.success && res.data) {
        const sentMsg = res.data;
        if (!debouncedChatSearch) {
          setMessages((prev) => {
            if (prev.some((m) => String(m._id) === String(sentMsg._id))) {
              return prev;
            }
            return [...prev, sentMsg];
          });
          setMessagesConvId(selectedId);
        }

        const existed = updateConversationPreview(sentMsg, false);
        if (!existed) {
          triggerReloadConversations();
        }
        return true;
      } else {
        onShowToast?.(res.error || 'Không thể gửi tin nhắn. Vui lòng thử lại.', 'error');
        return false;
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string): Promise<boolean> => {
    const res = await editMessageApi(messageId, newContent);
    if (res.success && res.data) {
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(messageId)
            ? { ...m, content: res.data!.content, editedAt: res.data!.editedAt }
            : m
        )
      );
      onShowToast?.('Đã chỉnh sửa tin nhắn.', 'success');
      return true;
    }
    onShowToast?.(res.error || 'Không thể chỉnh sửa tin nhắn.', 'error');
    return false;
  };

  const handleDeleteMessage = async (messageId: string): Promise<boolean> => {
    const res = await deleteMessageApi(messageId);
    if (res.success) {
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(messageId)
            ? { ...m, content: 'Tin nhắn đã bị thu hồi', images: [], isDeleted: true }
            : m
        )
      );
      onShowToast?.('Đã thu hồi tin nhắn.', 'info');
      return true;
    }
    onShowToast?.(res.error || 'Không thể thu hồi tin nhắn.', 'error');
    return false;
  };

  const selectedConversation =
    conversations.find((c) => c._id === selectedId) ||
    (activeTargetConv && activeTargetConv._id === selectedId ? activeTargetConv : null);

  if (!currentUser) {
    return (
      <div className="card" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center', padding: 40, borderRadius: 4 }}>
        <h3>Yêu cầu đăng nhập</h3>
        <p style={{ color: 'var(--color-text-muted)' }}>Vui lòng đăng nhập để sử dụng tính năng nhắn tin trực tiếp.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '8px auto', padding: '0 16px', boxSizing: 'border-box' }}>
      <div
        className="card messages-shell"
        data-mobile-view={mobileView}
        style={{
          height: 'calc(100vh - 225px)',
          minHeight: 420,
          maxHeight: 660,
          padding: 0,
          overflow: 'hidden',
          borderRadius: 4,
        }}
      >
        {/* Left Column: Conversation List */}
        <div className="messages-list-col">
          <ConversationList
            conversations={conversations}
            selectedConversationId={selectedId}
            onSelectConversation={handleSelectConversation}
            currentUserId={currentUserId}
          />
        </div>

        {/* Right Column: Chat Window */}
        <div className="messages-chat-col">
          <ChatWindow
            conversation={selectedConversation}
            messages={visibleMessages}
            currentUserId={currentUserId}
            onSendMessage={handleSendMessage}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            searchQuery={chatSearchQuery}
            onSearchChange={setChatSearchQuery}
            onBack={() => setMobileView('list')}
            isLoading={loadingMessages}
            isSending={isSending}
            hasMore={visibleHasMore}
            loadingOlder={loadingOlder}
            onLoadOlder={handleLoadOlderMessages}
            onShowToast={onShowToast}
          />
        </div>
      </div>
    </div>
  );
};
