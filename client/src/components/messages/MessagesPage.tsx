import React, { useState, useEffect, useCallback } from 'react';
import type { UserProfile, Conversation, Message } from '../../types.js';
import { ConversationList } from './ConversationList.js';
import { ChatWindow } from './ChatWindow.js';
import {
  fetchConversations,
  fetchMessages,
  sendMessage as sendMessageApi,
  markConversationAsRead,
  getOrCreateConversation,
} from '../../services/messageService.js';
import { useSocket } from '../../hooks/useSocket.js';

interface MessagesPageProps {
  currentUser: UserProfile | null;
  initialConversationId?: string | null;
  targetUserId?: string | null;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const MessagesPage: React.FC<MessagesPageProps> = ({
  currentUser,
  initialConversationId,
  targetUserId,
  onShowToast,
}) => {
  const currentUserId = currentUser?.id || (currentUser as any)?._id || '';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeTargetConv, setActiveTargetConv] = useState<Conversation | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  const { socket } = useSocket();

  // Load conversations on mount
  const loadConversations = useCallback(async () => {
    if (!currentUserId) return;

    const storedTarget = localStorage.getItem('trekmap_target_chat_user');
    if (storedTarget) {
      localStorage.removeItem('trekmap_target_chat_user');
    }
    const target = targetUserId || storedTarget;

    let created: Conversation | null = null;
    if (target) {
      created = await getOrCreateConversation(target);
    }

    const list = await fetchConversations();
    setConversations(list);

    if (created) {
      setActiveTargetConv(created);
      setSelectedId(created._id);
      setMobileView('chat');
    }
  }, [currentUserId, targetUserId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages for selected conversation
  const loadMessagesForSelected = useCallback(async (convId: string) => {
    setLoadingMessages(true);
    const { messages: msgs } = await fetchMessages(convId, undefined, 50);
    setMessages(msgs);
    setLoadingMessages(false);

    // Mark as read
    await markConversationAsRead(convId);

    // Update unread count in state
    setConversations((prev) =>
      prev.map((c) => (c._id === convId ? { ...c, unreadCount: 0 } : c))
    );
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadMessagesForSelected(selectedId);
      setMobileView('chat');
    }
  }, [selectedId, loadMessagesForSelected]);

  // Listen to Socket real-time events: newMessage & messageRead
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMsg: Message) => {
      // If current active conversation matches
      if (selectedId && String(newMsg.conversation) === String(selectedId)) {
        setMessages((prev) => {
          if (prev.some((m) => String(m._id) === String(newMsg._id))) {
            return prev;
          }
          return [...prev, newMsg];
        });
        markConversationAsRead(selectedId);
      }

      // Refresh/update conversation list
      loadConversations();
    };

    const handleMessageRead = (payload: { conversationId: string; userId: string }) => {
      if (selectedId && String(payload.conversationId) === String(selectedId)) {
        setMessages((prev) =>
          prev.map((m) => {
            if (!m.readBy.includes(payload.userId)) {
              return { ...m, readBy: [...m.readBy, payload.userId] };
            }
            return m;
          })
        );
      }
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('messageRead', handleMessageRead);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messageRead', handleMessageRead);
    };
  }, [socket, selectedId, loadConversations]);

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    setMobileView('chat');
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedId) return;
    const res = await sendMessageApi(selectedId, content);
    if (res.success && res.data) {
      setMessages((prev) => {
        if (prev.some((m) => String(m._id) === String(res.data!._id))) {
          return prev;
        }
        return [...prev, res.data!];
      });
      // Update last message in list
      loadConversations();
    } else {
      onShowToast?.(res.error || 'Không thể gửi tin nhắn. Vui lòng thử lại.', 'error');
    }
  };

  const selectedConversation =
    conversations.find((c) => c._id === selectedId) ||
    (activeTargetConv && activeTargetConv._id === selectedId ? activeTargetConv : null);

  if (!currentUser) {
    return (
      <div className="card" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center', padding: 40 }}>
        <h3>Yêu cầu đăng nhập</h3>
        <p style={{ color: 'var(--color-text-muted)' }}>Vui lòng đăng nhập để sử dụng tính năng nhắn tin trực tiếp.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '8px auto', padding: '0 16px', boxSizing: 'border-box' }}>
      <div
        className="card"
        style={{
          height: 'calc(100vh - 225px)',
          minHeight: 420,
          maxHeight: 660,
          padding: 0,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
        }}
      >
        {/* Left Column: Conversation List (hidden ONLY on mobile <768px if chat active) */}
        <div
          style={{
            height: '100%',
            display: typeof window !== 'undefined' && window.innerWidth < 768 && mobileView === 'chat' ? 'none' : 'block',
          }}
          className="messages-list-col"
        >
          <ConversationList
            conversations={conversations}
            selectedConversationId={selectedId}
            onSelectConversation={handleSelectConversation}
            currentUserId={currentUserId}
          />
        </div>

        {/* Right Column: Chat Window (hidden ONLY on mobile <768px if list active) */}
        <div
          style={{
            height: '100%',
            display: typeof window !== 'undefined' && window.innerWidth < 768 && mobileView === 'list' ? 'none' : 'flex',
            flexDirection: 'column',
            minWidth: 0,
            overflow: 'hidden',
          }}
          className="messages-chat-col"
        >
          <ChatWindow
            conversation={selectedConversation}
            messages={messages}
            currentUserId={currentUserId}
            onSendMessage={handleSendMessage}
            onBack={() => setMobileView('list')}
            isLoading={loadingMessages}
          />
        </div>
      </div>
    </div>
  );
};
