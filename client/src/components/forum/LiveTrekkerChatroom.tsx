import React, { useState, useEffect, useRef } from 'react';
import {
  IconMessageSquare,
  IconSend,
  IconSparkles,
  IconQuote,
} from '../common/SvgIcons.js';
import { useSocket } from '../../hooks/useSocket.js';

export interface CommunityChatMessage {
  id: string;
  senderId?: string;
  senderName: string;
  senderAvatar: string;
  senderBadge?: string;
  nameColor?: string;
  quote?: { author: string; text: string };
  text: string;
  createdAt?: string;
  time?: string;
}

interface LiveTrekkerChatroomProps {
  currentUser?: any;
  onRequireLogin?: (actionName: string) => void;
}

export const LiveTrekkerChatroom: React.FC<LiveTrekkerChatroomProps> = ({ currentUser, onRequireLogin }) => {
  const [messages, setMessages] = useState<CommunityChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [quoteMessage, setQuoteMessage] = useState<{ author: string; text: string } | null>(null);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { socket } = useSocket();

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  // Fetch persistent chat history from MongoDB on mount
  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        const res = await fetch('/api/forum/chat-messages');
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setMessages(data.data);
          setTimeout(scrollToBottom, 100);
        }
      } catch (err) {
        console.error('Failed to load community chat history', err);
      }
    };
    fetchChatHistory();
  }, []);

  // Socket.io Real-time Event Wiring
  useEffect(() => {
    if (!socket) return;

    // Join public community room
    socket.emit('joinCommunityChat');

    const handleOnlineCount = (count: number) => {
      setOnlineCount(count || 1);
    };

    const handleNewMessage = (msg: CommunityChatMessage) => {
      setMessages((prev) => {
        // Prevent duplicate messages by id
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(scrollToBottom, 50);
    };

    socket.on('communityOnlineCount', handleOnlineCount);
    socket.on('newCommunityMessage', handleNewMessage);

    return () => {
      socket.off('communityOnlineCount', handleOnlineCount);
      socket.off('newCommunityMessage', handleNewMessage);
    };
  }, [socket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const token = localStorage.getItem('trekmap_token');
    if (!currentUser && !token) {
      if (onRequireLogin) onRequireLogin('gửi tin nhắn trò chuyện cộng đồng');
      return;
    }

    const senderName = currentUser?.fullName || 'Trekker';
    const senderAvatar =
      currentUser?.avatarUrl ||
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80';

    const msgData: CommunityChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      senderId: currentUser?._id || currentUser?.id,
      senderName,
      senderAvatar,
      senderBadge: currentUser?.role === 'admin' ? 'BQT TrekMap' : 'Trekker',
      nameColor: currentUser?.role === 'admin' ? 'var(--color-sky)' : 'var(--color-primary)',
      quote: quoteMessage || undefined,
      text: inputText.trim(),
      createdAt: new Date().toISOString(),
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    if (socket) {
      socket.emit('sendCommunityChatMessage', msgData);
    } else {
      setMessages((prev) => [...prev, msgData]);
    }

    setInputText('');
    setQuoteMessage(null);
  };

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return 'Vừa xong';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Vừa xong';
    }
  };

  return (
    <div
      className="card"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        flexDirection: 'column',
        height: 540,
      }}
    >
      {/* Chatroom Header */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-main)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(5, 150, 105, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--color-primary)',
            }}
          >
            <IconMessageSquare size={16} color="var(--color-primary)" />
          </div>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1.2 }}>
              Phòng Chat Thực Địa 24/7
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
              Trao đổi lộ trình & tình hình thời tiết
            </div>
          </div>
        </div>

        {/* Live Online Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 14,
            background: 'rgba(5, 150, 105, 0.12)',
            border: '1px solid rgba(5, 150, 105, 0.3)',
            fontSize: '0.7rem',
            fontWeight: 800,
            color: 'var(--color-primary)',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--color-primary)',
              boxShadow: '0 0 8px var(--color-primary)',
              animation: 'pulse 1.8s infinite',
            }}
          />
          <span>{onlineCount} Trực tuyến</span>
        </div>
      </div>

      {/* Message List Area */}
      <div
        ref={messagesContainerRef}
        style={{
          flex: 1,
          padding: '14px 16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: 'rgba(5, 11, 24, 0.4)',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-text-dim)', padding: 20 }}>
            <IconSparkles size={28} color="var(--color-primary)" style={{ margin: '0 auto 8px', display: 'block', opacity: 0.6 }} />
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)' }}>Chưa có tin nhắn nào</div>
            <div style={{ fontSize: '0.74rem', marginTop: 4 }}>Hãy là người đầu tiên gửi lời chào tới các anh em Trekker!</div>
          </div>
        ) : (
          messages.map((msg) => {
            let activeUserId = currentUser?._id || currentUser?.id;
            if (!activeUserId) {
              try {
                const stored = JSON.parse(localStorage.getItem('trekmap_user') || 'null');
                activeUserId = stored?._id || stored?.id;
              } catch {}
            }

            const isMe = Boolean(
              (activeUserId && msg.senderId && String(msg.senderId) === String(activeUserId)) ||
              (currentUser?.fullName && msg.senderName === currentUser.fullName)
            );
            const hasValidQuote = Boolean(msg.quote && msg.quote.author && msg.quote.text && msg.quote.text.trim());

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: isMe ? 'row-reverse' : 'row',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '4px 6px',
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  transition: 'background 0.15s ease',
                  position: 'relative',
                }}
                className="chat-message-row"
              >
                {/* Avatar with fallback */}
                {msg.senderAvatar && msg.senderAvatar.startsWith('http') ? (
                  <img
                    src={msg.senderAvatar}
                    alt={msg.senderName}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      border: isMe ? '1.5px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                      objectFit: 'cover',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: isMe ? 'linear-gradient(135deg, var(--color-primary), #059669)' : 'linear-gradient(135deg, #0284c7, #0369a1)',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                      textTransform: 'uppercase',
                    }}
                  >
                    {(msg.senderName || 'T').charAt(0)}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '100%' }}>
                  {/* Sender Name & Badge & Time & Reply Button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isMe ? 'var(--color-primary)' : (msg.nameColor || 'var(--color-text-main)') }}>
                      {isMe ? 'Bạn' : msg.senderName}
                    </span>
                    {msg.senderBadge && (
                      <span
                        style={{
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 6,
                          background: isMe ? 'rgba(5, 150, 105, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                          color: isMe ? 'var(--color-primary)' : 'var(--color-text-dim)',
                        }}
                      >
                        {msg.senderBadge}
                      </span>
                    )}
                    <span style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)' }}>
                      {msg.time || formatMessageTime(msg.createdAt)}
                    </span>

                    {/* Quick Reply Button */}
                    <button
                      type="button"
                      title="Trả lời tin nhắn này"
                      onClick={() => {
                        setQuoteMessage({ author: msg.senderName, text: msg.text });
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 6,
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                        padding: '2px 5px',
                        fontSize: '0.64rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontWeight: 700,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--color-primary)';
                        e.currentTarget.style.borderColor = 'var(--color-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--color-text-muted)';
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                      }}
                    >
                      <IconQuote size={10} />
                      <span>Trả lời</span>
                    </button>
                  </div>

                  {/* Message Bubble with Embedded Quote */}
                  <div
                    style={{
                      background: isMe ? 'rgba(5, 150, 105, 0.22)' : 'var(--color-bg-main)',
                      border: isMe ? '1px solid rgba(5, 150, 105, 0.5)' : '1px solid var(--color-border)',
                      borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                      padding: '8px 14px',
                      fontSize: '0.84rem',
                      color: 'var(--color-text-main)',
                      lineHeight: 1.5,
                      display: 'inline-block',
                      maxWidth: '100%',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    }}
                  >
                    {/* Quoted Message Header (Only if valid) */}
                    {hasValidQuote && msg.quote && (
                      <div
                        style={{
                          background: isMe ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                          borderLeft: '3px solid var(--color-primary)',
                          padding: '4px 8px',
                          borderRadius: '0 6px 6px 0',
                          fontSize: '0.72rem',
                          color: 'var(--color-text-muted)',
                          marginBottom: 6,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <strong style={{ color: 'var(--color-primary)' }}>@{msg.quote.author}:</strong> {msg.quote.text}
                      </div>
                    )}

                    <div style={{ wordBreak: 'break-word', textAlign: isMe ? 'right' : 'left' }}>{msg.text}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Active Quote Preview Bar */}
      {quoteMessage && (
        <div
          style={{
            background: 'var(--color-bg-main)',
            borderTop: '1px solid var(--color-border)',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <IconQuote size={12} color="var(--color-primary)" />
            <span style={{ color: 'var(--color-text-muted)' }}>
              Đang trả lời <strong style={{ color: 'var(--color-primary)' }}>@{quoteMessage.author}</strong>: {quoteMessage.text}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setQuoteMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-dim)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontWeight: 800,
              padding: '0 4px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Input Box Footer */}
      <form
        onSubmit={handleSendMessage}
        style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-bg-main)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          className="form-input"
          placeholder={quoteMessage ? `Nhập câu trả lời cho @${quoteMessage.author}...` : 'Nhập tin nhắn thực địa...'}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          style={{
            flex: 1,
            padding: '9px 14px',
            fontSize: '0.84rem',
            borderRadius: 12,
            background: 'var(--color-bg-card)',
            border: quoteMessage ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
            boxShadow: quoteMessage ? '0 0 10px rgba(5, 150, 105, 0.25)' : 'none',
            transition: 'all 0.2s ease',
          }}
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="btn btn-primary interactive-click ripple-fx"
          style={{
            padding: '8px 14px',
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: inputText.trim() ? 1 : 0.5,
            cursor: inputText.trim() ? 'pointer' : 'default',
          }}
        >
          <IconSend size={15} color="#041108" />
        </button>
      </form>
    </div>
  );
};
