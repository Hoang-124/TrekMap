import React, { useState, useEffect, useRef } from 'react';
import {
  IconMessageSquare,
  IconSend,
  IconSparkles,
  IconQuote,
  IconClock,
  IconX,
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
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState<number>(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const sentMessageIds = useRef<Set<string>>(new Set());
  const { socket } = useSocket();

  // Preload notification sound
  useEffect(() => {
    try {
      notificationAudioRef.current = new Audio('/audio/notification.mp3');
      notificationAudioRef.current.volume = 0.75;
      notificationAudioRef.current.load();
    } catch (e) {
      console.warn('Could not initialize audio object', e);
    }
  }, []);

  // 10-Second Rate Limit Cooldown Interval
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const playIncomingNotificationSound = () => {
    try {
      if (notificationAudioRef.current) {
        notificationAudioRef.current.currentTime = 0;
        notificationAudioRef.current.play().catch(() => {});
      } else {
        const audio = new Audio('/audio/notification.mp3');
        audio.volume = 0.75;
        audio.play().catch(() => {});
      }
    } catch {}
  };

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

    const handleNewMessage = (msg: CommunityChatMessage) => {
      let activeUserId = currentUser?._id || currentUser?.id;
      if (!activeUserId) {
        try {
          const stored = JSON.parse(localStorage.getItem('trekmap_user') || 'null');
          activeUserId = stored?._id || stored?.id;
        } catch {}
      }
      const isFromMe = Boolean(
        sentMessageIds.current.has(msg.id) ||
        (activeUserId && msg.senderId && String(msg.senderId) === String(activeUserId)) ||
        (currentUser?.fullName && msg.senderName === currentUser.fullName)
      );

      // Only play notification sound if message is from another trekker
      if (!isFromMe) {
        playIncomingNotificationSound();
      }

      setMessages((prev) => {
        // Prevent duplicate messages by id
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(scrollToBottom, 50);
    };

    const handleOnlineCount = (count: number) => {
      setOnlineCount(Math.max(1, count || 1));
    };

    socket.on('communityOnlineCount', handleOnlineCount);
    socket.on('newCommunityMessage', handleNewMessage);

    return () => {
      socket.emit('leaveCommunityChat');
      socket.off('communityOnlineCount', handleOnlineCount);
      socket.off('newCommunityMessage', handleNewMessage);
    };
  }, [socket, currentUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || cooldown > 0) return;

    const token = localStorage.getItem('trekmap_token');
    if (!currentUser && !token) {
      if (onRequireLogin) onRequireLogin('gửi tin nhắn trò chuyện cộng đồng');
      return;
    }

    setIsSending(true);
    setTimeout(() => setIsSending(false), 300);

    // Start 10-second cooldown timer
    setCooldown(10);

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

    // Track own message ID so socket broadcast doesn't re-trigger notification sound
    sentMessageIds.current.add(msgData.id);

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
          background: 'var(--color-bg-card)',
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
          background: 'var(--color-bg-main)',
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
                className="chat-message-row chat-message-pop"
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
                      background: isMe ? 'var(--color-primary)' : 'var(--color-sky)',
                      color: isMe ? '#041108' : '#ffffff',
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
                          background: isMe ? 'rgba(5, 150, 105, 0.15)' : 'var(--color-bg-card)',
                          border: '1px solid var(--color-border)',
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
                        background: 'var(--color-bg-card)',
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
                    className={isMe ? 'chat-bubble-glow' : ''}
                    style={{
                      background: isMe ? 'rgba(5, 150, 105, 0.12)' : 'var(--color-bg-card)',
                      border: isMe ? '1px solid rgba(5, 150, 105, 0.35)' : '1px solid var(--color-border)',
                      borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                      padding: '8px 14px',
                      fontSize: '0.84rem',
                      color: 'var(--color-text-main)',
                      lineHeight: 1.5,
                      display: 'inline-block',
                      maxWidth: '100%',
                      boxShadow: 'var(--shadow-card)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {/* Quoted Message Header (Only if valid) */}
                    {hasValidQuote && msg.quote && (
                      <div
                        style={{
                          background: 'rgba(0, 0, 0, 0.05)',
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
            background: 'var(--color-bg-card)',
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
            <IconX size={12} />
          </button>
        </div>
      )}

      {/* Input Box Footer */}
      <form
        onSubmit={handleSendMessage}
        style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-bg-card)',
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
            background: 'var(--color-bg-main)',
            border: quoteMessage ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
            boxShadow: quoteMessage ? '0 0 10px rgba(5, 150, 105, 0.25)' : 'none',
            transition: 'all 0.2s ease',
          }}
        />

        {/* 10-Second Cooldown Countdown Timer Indicator */}
        {cooldown > 0 && (
          <div
            title={`Vui lòng chờ ${cooldown}s để gửi tin nhắn tiếp theo`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              borderRadius: 10,
              background: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              color: 'var(--color-sun)',
              fontSize: '0.74rem',
              fontWeight: 800,
              animation: 'pulse 1.5s infinite',
              flexShrink: 0,
            }}
          >
            <IconClock size={12} color="var(--color-sun)" />
            <span>{cooldown}s</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!inputText.trim() || cooldown > 0}
          title={cooldown > 0 ? `Vui lòng chờ ${cooldown}s để gửi tiếp` : 'Gửi tin nhắn'}
          className="btn btn-primary interactive-click ripple-fx"
          style={{
            padding: '8px 14px',
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: inputText.trim() && cooldown === 0 ? 1 : 0.45,
            cursor: inputText.trim() && cooldown === 0 ? 'pointer' : 'not-allowed',
            transform: isSending ? 'scale(0.92)' : 'scale(1)',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: isSending ? 'translate(3px, -3px) rotate(-15deg)' : 'none',
              transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <IconSend size={15} color="#041108" />
          </div>
        </button>
      </form>
    </div>
  );
};
