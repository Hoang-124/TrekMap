import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { UserProfile, Conversation } from '../../types.js';
import { ConversationList } from './ConversationList.js';
import { ChatWindow } from './ChatWindow.js';
import {
  fetchConversationsPage,
  fetchConversationById,
  fetchMessages,
  sendMessage as sendMessageApi,
  editMessage as editMessageApi,
  deleteMessage as deleteMessageApi,
  markConversationAsRead,
  getOrCreateConversation,
  notifyMessagesUnreadChanged,
} from '../../services/messageService.js';
import type { RichMessage } from '../../services/messageService.js';
import { useSocket } from '../../hooks/useSocket.js';
import { safeLocalStorageGet, safeLocalStorageRemove } from '../../utils/storageScope.js';

interface MessagesPageProps {
  currentUser: UserProfile | null;
  initialConversationId?: string | null;
  targetUserId?: string | null;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const PAGE_LIMIT = 40;
const INITIAL_CONV_LIMIT = 30;
const MAX_CONV_LIMIT = 50;
const MAX_SEEN_MESSAGE_IDS = 500;

function readUrlConvId(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('convId')?.trim() || null;
}

export const MessagesPage: React.FC<MessagesPageProps> = ({
  currentUser,
  initialConversationId,
  targetUserId,
  onShowToast,
}) => {
  const currentUserId = currentUser?.id || (currentUser as (UserProfile & { _id?: string }) | null)?._id || '';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hasMoreConversations, setHasMoreConversations] = useState<boolean>(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState<boolean>(false);
  const [convLimit, setConvLimit] = useState<number>(INITIAL_CONV_LIMIT);
  const [convLoadError, setConvLoadError] = useState<string | null>(null);
  const [activeTargetConv, setActiveTargetConv] = useState<Conversation | null>(null);
  const [urlConvId, setUrlConvId] = useState<string | null>(() => readUrlConvId());
  const [selectedId, setSelectedId] = useState<string | null>(() => initialConversationId || readUrlConvId() || null);
  const [messages, setMessages] = useState<RichMessage[]>([]);
  const [messagesConvId, setMessagesConvId] = useState<string | null>(null);
  const [loadedConvId, setLoadedConvId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingOlder, setLoadingOlder] = useState<boolean>(false);
  const [sendingConvId, setSendingConvId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>(() =>
    initialConversationId || readUrlConvId() ? 'chat' : 'list'
  );
  const [convRefreshTick, setConvRefreshTick] = useState<number>(0);
  const [chatSearchQuery, setChatSearchQuery] = useState<string>('');
  const [debouncedChatSearch, setDebouncedChatSearch] = useState<string>('');

  const didInitTargetRef = useRef<string | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const loadOlderAbortRef = useRef<AbortController | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);
  const messagesConvIdRef = useRef<string | null>(messagesConvId);
  const debouncedSearchRef = useRef<string>(debouncedChatSearch);
  const conversationsRef = useRef<Conversation[]>([]);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const lastAppliedDeepLinkRef = useRef<string | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    messagesConvIdRef.current = messagesConvId;
  }, [messagesConvId]);

  useEffect(() => {
    debouncedSearchRef.current = debouncedChatSearch;
  }, [debouncedChatSearch]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Reset deduplication cache on account change
  useEffect(() => {
    seenMessageIdsRef.current.clear();
    lastAppliedDeepLinkRef.current = null;
  }, [currentUserId]);

  // Bounded FIFO Set for deduplicating socket newMessage deliveries across conv & user rooms
  const markMessageIdSeen = useCallback((id: string): boolean => {
    if (!id) return true;
    const set = seenMessageIdsRef.current;
    if (set.has(id)) return false;
    set.add(id);
    if (set.size > MAX_SEEN_MESSAGE_IDS) {
      const oldest = set.values().next().value;
      if (oldest !== undefined) {
        set.delete(oldest);
      }
    }
    return true;
  }, []);

  // Debounce in-chat search query
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedChatSearch(chatSearchQuery.trim());
    }, 280);
    return () => window.clearTimeout(timer);
  }, [chatSearchQuery]);

  // Listen to browser navigation (popstate) and direct in-app DM deep-link switches while mounted
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyConvDeepLink = (nextConvId: string | null) => {
      setUrlConvId(nextConvId);
      if (!nextConvId) return;
      if (String(selectedIdRef.current) !== String(nextConvId)) {
        setChatSearchQuery('');
        setDebouncedChatSearch('');
        setSelectedId(nextConvId);
      }
      setMobileView('chat');
      lastAppliedDeepLinkRef.current = nextConvId;
      if (!conversationsRef.current.some((c) => String(c._id) === String(nextConvId))) {
        setConvRefreshTick((prev) => prev + 1);
      }
    };

    const handlePopState = () => {
      applyConvDeepLink(readUrlConvId());
    };

    const handleDirectConvSelect = (e: Event) => {
      const detail = (e as CustomEvent<{ convId?: string }>).detail;
      const nextId = detail?.convId?.trim() || readUrlConvId();
      applyConvDeepLink(nextId);
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('lost:messages-select-conv', handleDirectConvSelect);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('lost:messages-select-conv', handleDirectConvSelect);
    };
  }, []);

  const { socket } = useSocket();

  const visibleMessages = useMemo(
    () => (selectedId && messagesConvId === selectedId ? messages : []),
    [selectedId, messagesConvId, messages]
  );
  const visibleHasMore = Boolean(selectedId && messagesConvId === selectedId && hasMore);
  const loadingMessages = Boolean(selectedId) && loadedConvId !== `${selectedId}:${debouncedChatSearch}`;
  const isSendingActive = Boolean(selectedId && sendingConvId === selectedId);

  const triggerReloadConversations = useCallback(() => {
    setConvRefreshTick((prev) => prev + 1);
  }, []);

  // Load conversations on mount / refresh and handle target chat & deep-link handoff
  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      const storedGroupConv = safeLocalStorageGet('lost_target_group_conv');
      if (storedGroupConv) {
        safeLocalStorageRemove('lost_target_group_conv');
      }

      const storedTarget = safeLocalStorageGet('lost_target_chat_user');
      if (storedTarget) {
        safeLocalStorageRemove('lost_target_chat_user');
      }
      const target =
        storedTarget || (targetUserId && didInitTargetRef.current !== targetUserId ? targetUserId : null);

      let created: Conversation | null = null;
      if (target) {
        didInitTargetRef.current = target;
        created = await getOrCreateConversation(target);
        if (cancelled) return;
      }

      const pageRes = await fetchConversationsPage({ limit: convLimit, signal: controller.signal });
      if (cancelled) return;

      if (!pageRes.ok && pageRes.error) {
        setConvLoadError(pageRes.error);
      } else if (pageRes.ok) {
        setConvLoadError(null);
      }

      const list = pageRes.ok ? pageRes.conversations : conversationsRef.current;
      if (pageRes.ok) {
        setHasMoreConversations(pageRes.hasMore);
      }

      const activeUrlConvId = urlConvId || readUrlConvId();
      const deepLinkConvId = storedGroupConv || activeUrlConvId || initialConversationId || null;
      let mergedList = list;
      let deepLinkedConv: Conversation | null = null;
      const matchedInList = deepLinkConvId
        ? list.find((c) => String(c._id) === String(deepLinkConvId)) || null
        : null;

      if (deepLinkConvId && !matchedInList) {
        deepLinkedConv = await fetchConversationById(deepLinkConvId);
        if (cancelled) return;
        if (deepLinkedConv) {
          mergedList = [deepLinkedConv, ...list];
        }
      }

      if (created && !mergedList.some((c) => String(c._id) === String(created._id))) {
        mergedList = [created, ...mergedList];
      }

      conversationsRef.current = mergedList;
      setConversations(mergedList);

      const resolvedDeepLinkConv = matchedInList || deepLinkedConv;

      if (storedGroupConv) {
        if (resolvedDeepLinkConv) setActiveTargetConv(resolvedDeepLinkConv);
        lastAppliedDeepLinkRef.current = storedGroupConv;
        setSelectedId(storedGroupConv);
        setMobileView('chat');
      } else if (created) {
        setActiveTargetConv(created);
        lastAppliedDeepLinkRef.current = String(created._id);
        setSelectedId(String(created._id));
        setMobileView('chat');
      } else if (
        deepLinkConvId &&
        resolvedDeepLinkConv &&
        (lastAppliedDeepLinkRef.current !== deepLinkConvId || !selectedIdRef.current)
      ) {
        setActiveTargetConv(resolvedDeepLinkConv);
        lastAppliedDeepLinkRef.current = deepLinkConvId;
        setSelectedId(String(resolvedDeepLinkConv._id));
        setMobileView('chat');
      }
    };

    void run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentUserId, targetUserId, initialConversationId, urlConvId, convLimit, convRefreshTick]);

  // Pagination: Load more conversations beyond initial 30 cap
  const handleLoadMoreConversations = useCallback(async () => {
    if (loadingMoreConversations || !hasMoreConversations) return;
    setLoadingMoreConversations(true);
    try {
      const prevIds = new Set(conversationsRef.current.map((c) => String(c._id)));
      const nextLimit = convLimit < MAX_CONV_LIMIT ? MAX_CONV_LIMIT : convLimit;
      const skip = convLimit >= MAX_CONV_LIMIT ? conversationsRef.current.length : 0;

      const res = await fetchConversationsPage({ limit: nextLimit, skip });
      if (!res.ok) {
        if (res.error) onShowToast?.(res.error, 'error');
        return;
      }

      if (nextLimit !== convLimit) {
        setConvLimit(nextLimit);
      }

      const added = res.conversations.filter((c) => !prevIds.has(String(c._id)));
      if (added.length > 0) {
        setConversations((prev) => {
          const seen = new Set(prev.map((c) => String(c._id)));
          const merged = [...prev, ...res.conversations.filter((c) => !seen.has(String(c._id)))];
          conversationsRef.current = merged;
          return merged;
        });
      }

      // Stop pagination if no new conversations were returned or server indicates no more
      setHasMoreConversations(added.length > 0 && res.hasMore);
    } finally {
      setLoadingMoreConversations(false);
    }
  }, [loadingMoreConversations, hasMoreConversations, convLimit, onShowToast]);

  // Optimistic conversation preview update (checks conversationsRef synchronously — safe under React 18 batching!)
  const updateConversationPreview = useCallback(
    (msg: RichMessage, unreadMode: 'increment' | 'zero' | 'preserve'): boolean => {
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
        const nextUnread =
          unreadMode === 'increment'
            ? (target.unreadCount || 0) + 1
            : unreadMode === 'zero'
              ? 0
              : target.unreadCount || 0;
        const updated: Conversation = {
          ...target,
          lastMessage: {
            content: previewContent,
            sender: msg.sender,
            createdAt: msg.createdAt,
          },
          updatedAt: msg.createdAt || new Date().toISOString(),
          unreadCount: nextUnread,
        };
        const rest = prev.filter((_, i) => i !== idx);
        const nextList = [updated, ...rest];
        conversationsRef.current = nextList;
        return nextList;
      });
      if (unreadMode === 'increment') {
        notifyMessagesUnreadChanged();
      }
      return true;
    },
    []
  );

  // Backfill active conversation messages missed while socket was disconnected
  const backfillActiveConversation = useCallback(async () => {
    const activeId = selectedIdRef.current;
    const activeSearch = debouncedSearchRef.current;
    if (!activeId) return;

    try {
      const res = await fetchMessages(activeId, undefined, PAGE_LIMIT, activeSearch || undefined);
      if (!res.ok) return;
      if (selectedIdRef.current !== activeId || debouncedSearchRef.current !== activeSearch) return;

      for (const m of res.messages) {
        if (m._id) markMessageIdSeen(String(m._id));
      }

      setMessages((prev) => {
        if (messagesConvIdRef.current !== activeId || activeSearch) {
          return res.messages;
        }
        const byId = new Map<string, RichMessage>();
        for (const m of prev) byId.set(String(m._id), m);
        for (const m of res.messages) byId.set(String(m._id), m);
        return Array.from(byId.values()).sort((a, b) =>
          String(a._id).localeCompare(String(b._id))
        );
      });
      setMessagesConvId(activeId);

      if (!activeSearch) {
        const hasUnreadFromOthers = res.messages.some((m) => {
          const senderId = typeof m.sender === 'object' ? m.sender?._id : m.sender;
          const isFromMe = String(senderId) === String(currentUserId);
          const alreadyRead =
            Array.isArray(m.readBy) && m.readBy.some((id) => String(id) === String(currentUserId));
          return !isFromMe && !alreadyRead;
        });
        if (hasUnreadFromOthers) {
          const marked = await markConversationAsRead(activeId);
          if (marked && selectedIdRef.current === activeId) {
            setConversations((prev) => {
              const next = prev.map((c) =>
                String(c._id) === String(activeId) ? { ...c, unreadCount: 0 } : c
              );
              conversationsRef.current = next;
              return next;
            });
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Backfill active conversation error:', err);
    }
  }, [currentUserId, markMessageIdSeen]);

  // Load messages for selected conversation (and search query) with AbortController race guard
  useEffect(() => {
    if (!selectedId) return;

    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    if (loadOlderAbortRef.current) {
      loadOlderAbortRef.current.abort();
      loadOlderAbortRef.current = null;
    }

    const controller = new AbortController();
    fetchAbortRef.current = controller;
    const targetConvId = selectedId;
    const targetSearch = debouncedChatSearch;
    const loadKey = `${targetConvId}:${targetSearch}`;

    const loadInitial = async () => {
      try {
        const res = await fetchMessages(
          targetConvId,
          undefined,
          PAGE_LIMIT,
          targetSearch || undefined,
          controller.signal
        );
        if (controller.signal.aborted || selectedIdRef.current !== targetConvId) return;

        if (res.ok) {
          for (const m of res.messages) {
            if (m._id) markMessageIdSeen(String(m._id));
          }
          setMessages(res.messages);
          setMessagesConvId(targetConvId);
          setHasMore(res.hasMore);
        } else {
          setMessages([]);
          setMessagesConvId(targetConvId);
          setHasMore(false);
          if (res.error) {
            onShowToast?.(res.error, 'error');
          }
        }
        setLoadedConvId(loadKey);

        if (!targetSearch && res.ok) {
          const marked = await markConversationAsRead(targetConvId);
          if (controller.signal.aborted || selectedIdRef.current !== targetConvId) return;

          if (marked) {
            setConversations((prev) => {
              const next = prev.map((c) =>
                String(c._id) === String(targetConvId) ? { ...c, unreadCount: 0 } : c
              );
              conversationsRef.current = next;
              return next;
            });
          }
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
  }, [selectedId, debouncedChatSearch, markMessageIdSeen, onShowToast]);

  // Pagination: Load older messages ("Tải thêm tin nhắn cũ") with race & active-search guards
  const handleLoadOlderMessages = useCallback(async () => {
    const convId = selectedIdRef.current;
    const targetSearch = debouncedSearchRef.current;
    if (!convId || !visibleHasMore || loadingOlder || visibleMessages.length === 0) return;

    const oldestId = visibleMessages[0]?._id;
    if (!oldestId) return;

    if (loadOlderAbortRef.current) {
      loadOlderAbortRef.current.abort();
    }
    const controller = new AbortController();
    loadOlderAbortRef.current = controller;

    setLoadingOlder(true);
    try {
      const res = await fetchMessages(
        convId,
        String(oldestId),
        PAGE_LIMIT,
        targetSearch || undefined,
        controller.signal
      );
      if (
        controller.signal.aborted ||
        selectedIdRef.current !== convId ||
        debouncedSearchRef.current !== targetSearch
      ) {
        return;
      }

      if (res.ok) {
        const older = res.messages;
        for (const m of older) {
          if (m._id) markMessageIdSeen(String(m._id));
        }
        setHasMore(res.hasMore);
        if (older.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => String(m._id)));
            const uniqueOlder = older.filter((m) => !existingIds.has(String(m._id)));
            return [...uniqueOlder, ...prev];
          });
        }
      } else if (res.error) {
        onShowToast?.(res.error, 'error');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Load older messages error:', err);
      onShowToast?.('Không thể tải thêm tin nhắn cũ.', 'error');
    } finally {
      if (loadOlderAbortRef.current === controller) {
        loadOlderAbortRef.current = null;
        setLoadingOlder(false);
      }
    }
  }, [visibleHasMore, loadingOlder, visibleMessages, markMessageIdSeen, onShowToast]);

  // Listen to Socket real-time events: connect (reconnect backfill), newMessage, messageRead, messageUpdated, messageDeleted
  useEffect(() => {
    if (!socket) return;

    const handleReconnect = () => {
      triggerReloadConversations();
      void backfillActiveConversation();
    };

    const handleNewMessage = (newMsg: RichMessage) => {
      const msgId = newMsg?._id ? String(newMsg._id) : '';
      // Deduplicate conv room + user room double delivery BEFORE any state/unread/read mutations
      if (msgId && !markMessageIdSeen(msgId)) {
        return;
      }

      const activeId = selectedIdRef.current;
      const activeSearch = debouncedSearchRef.current;
      const isCurrentConv = Boolean(activeId && String(newMsg.conversation) === String(activeId));
      const senderId = typeof newMsg.sender === 'object' ? newMsg.sender?._id : newMsg.sender;
      const isFromMe = String(senderId) === String(currentUserId);
      const isViewingUnfilteredConv = isCurrentConv && !activeSearch;

      if (isViewingUnfilteredConv && activeId) {
        setMessages((prev) => {
          if (prev.some((m) => String(m._id) === String(newMsg._id))) {
            return prev;
          }
          return [...prev, newMsg];
        });
        setMessagesConvId(activeId);

        if (!isFromMe) {
          const targetReadConvId = activeId;
          void markConversationAsRead(targetReadConvId).then((marked) => {
            if (marked) {
              setConversations((prev) => {
                const next = prev.map((c) =>
                  String(c._id) === String(targetReadConvId) ? { ...c, unreadCount: 0 } : c
                );
                conversationsRef.current = next;
                return next;
              });
            } else {
              setConversations((prev) => {
                const next = prev.map((c) =>
                  String(c._id) === String(targetReadConvId)
                    ? { ...c, unreadCount: (c.unreadCount || 0) + 1 }
                    : c
                );
                conversationsRef.current = next;
                return next;
              });
              notifyMessagesUnreadChanged();
            }
          });
        }
      }

      // Only increment unread when the message wasn't sent by me and isn't actively viewed unfiltered
      const unreadMode = !isFromMe && !isViewingUnfilteredConv ? 'increment' : 'preserve';
      const existsInList = updateConversationPreview(newMsg, unreadMode);
      if (!existsInList) {
        triggerReloadConversations();
        if (!isFromMe) {
          notifyMessagesUnreadChanged();
        }
      }
    };

    const handleMessageRead = (payload: { conversationId: string; userId: string }) => {
      if (String(payload.userId) === String(currentUserId)) {
        const hadUnread = conversationsRef.current.some(
          (c) => String(c._id) === String(payload.conversationId) && (c.unreadCount || 0) > 0
        );
        setConversations((prev) => {
          const next = prev.map((c) =>
            String(c._id) === String(payload.conversationId) ? { ...c, unreadCount: 0 } : c
          );
          conversationsRef.current = next;
          return next;
        });
        if (hadUnread) {
          notifyMessagesUnreadChanged();
        }
      }
      if (selectedIdRef.current && String(payload.conversationId) === String(selectedIdRef.current)) {
        setMessages((prev) =>
          prev.map((m) => {
            const readBy = Array.isArray(m.readBy) ? m.readBy : [];
            if (!readBy.some((id) => String(id) === String(payload.userId))) {
              return { ...m, readBy: [...readBy, payload.userId] };
            }
            return m;
          })
        );
      }
    };

    const handleMessageUpdated = (payload: { _id: string; conversation: string; content: string; editedAt: string }) => {
      if (selectedIdRef.current && String(payload.conversation) === String(selectedIdRef.current)) {
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
      if (selectedIdRef.current && String(payload.conversation) === String(selectedIdRef.current)) {
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

    socket.on('connect', handleReconnect);
    socket.on('newMessage', handleNewMessage);
    socket.on('messageRead', handleMessageRead);
    socket.on('messageUpdated', handleMessageUpdated);
    socket.on('messageDeleted', handleMessageDeleted);

    return () => {
      socket.off('connect', handleReconnect);
      socket.off('newMessage', handleNewMessage);
      socket.off('messageRead', handleMessageRead);
      socket.off('messageUpdated', handleMessageUpdated);
      socket.off('messageDeleted', handleMessageDeleted);
    };
  }, [
    socket,
    currentUserId,
    markMessageIdSeen,
    updateConversationPreview,
    triggerReloadConversations,
    backfillActiveConversation,
  ]);

  const handleSelectConversation = (id: string) => {
    setChatSearchQuery('');
    setDebouncedChatSearch('');
    setSelectedId(id);
    setMobileView('chat');
    lastAppliedDeepLinkRef.current = id;
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/messages')) {
      window.history.replaceState(
        window.history.state,
        '',
        `/messages?convId=${encodeURIComponent(id)}`
      );
      setUrlConvId(id);
    }
  };

  const handleSendMessage = async (
    content: string,
    images?: string[],
    explicitConvId?: string
  ): Promise<boolean> => {
    const targetConvId = explicitConvId || selectedIdRef.current;
    if (!targetConvId || sendingConvId === targetConvId) return false;
    setSendingConvId(targetConvId);
    try {
      const res = await sendMessageApi(targetConvId, content, images);
      if (res.success && res.data) {
        const sentMsg = res.data;
        if (sentMsg._id) {
          markMessageIdSeen(String(sentMsg._id));
        }

        if (selectedIdRef.current === targetConvId && !debouncedSearchRef.current) {
          setMessages((prev) => {
            if (prev.some((m) => String(m._id) === String(sentMsg._id))) {
              return prev;
            }
            return [...prev, sentMsg];
          });
          setMessagesConvId(targetConvId);
        }

        const existed = updateConversationPreview(sentMsg, 'preserve');
        if (!existed) {
          triggerReloadConversations();
        }
        return true;
      } else {
        onShowToast?.(res.error || 'Không thể gửi tin nhắn. Vui lòng thử lại.', 'error');
        return false;
      }
    } finally {
      setSendingConvId((prev) => (prev === targetConvId ? null : prev));
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string): Promise<boolean> => {
    const targetConvId = selectedIdRef.current;
    const res = await editMessageApi(messageId, newContent);
    if (res.success && res.data) {
      if (selectedIdRef.current === targetConvId) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(messageId)
              ? { ...m, content: res.data!.content, editedAt: res.data!.editedAt }
              : m
          )
        );
      }
      onShowToast?.('Đã chỉnh sửa tin nhắn.', 'success');
      return true;
    }
    onShowToast?.(res.error || 'Không thể chỉnh sửa tin nhắn.', 'error');
    return false;
  };

  const handleDeleteMessage = async (messageId: string): Promise<boolean> => {
    const targetConvId = selectedIdRef.current;
    const res = await deleteMessageApi(messageId);
    if (res.success) {
      if (selectedIdRef.current === targetConvId) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(messageId)
              ? { ...m, content: 'Tin nhắn đã bị thu hồi', images: [], isDeleted: true }
              : m
          )
        );
      }
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
            hasMore={hasMoreConversations}
            loadingMore={loadingMoreConversations}
            onLoadMore={() => void handleLoadMoreConversations()}
            loadError={convLoadError}
            onRetryLoad={triggerReloadConversations}
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
            isSending={isSendingActive}
            hasMore={visibleHasMore}
            loadingOlder={loadingOlder}
            onLoadOlder={() => void handleLoadOlderMessages()}
            onShowToast={onShowToast}
          />
        </div>
      </div>
    </div>
  );
};
