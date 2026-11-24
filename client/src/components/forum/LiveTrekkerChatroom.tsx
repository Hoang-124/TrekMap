import React, { useState, useEffect, useRef } from 'react';
import {
  IconMessageSquare,
  IconSend,
  IconSparkles,
  IconQuote,
  IconClock,
  IconX,
  IconAlertTriangle,
} from '../common/SvgIcons.js';
import { useSocket } from '../../hooks/useSocket.js';
import type { UserProfile } from '../../types.js';

export interface CommunityChatMessage {
  id: string;
  senderId?: string;
  senderName: string;
  senderAvatar?: string;
  senderBadge?: string;
  nameColor?: string;
  quote?: { author: string; text: string };
  text: string;
  createdAt?: string;
  time?: string;
}

interface LiveTrekkerChatroomProps {
  currentUser?: (UserProfile & { _id?: string; avatar?: string }) | null;
  onRequireLogin?: (actionName: string) => void;
}

export const LiveTrekkerChatroom: React.FC<LiveTrekkerChatroomProps> = ({ currentUser, onRequireLogin }) => {
  const [messages, setMessages] = useState<CommunityChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [quoteMessage, setQuoteMessage] = useState<{ author: string; text: string } | null>(null);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState<number>(0);
  const [chatErrorMsg, setChatErrorMsg] = useState<string>('');
  const { socket } = useSocket();
  const [socketConnState, setSocketConnState] = useState<{ sock: typeof socket; connected: boolean } | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const sentMessageIds = useRef<Set<string>>(new Set());
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const currentUserId = String(currentUser?._id || currentUser?.id || '');

  // Preload notification sound
  useEffect(() => {
    try {
      notificationAudioRef.current = new Audio('/audio/notification.mp3');
      notificationAudioRef.current.volume = 0.75;
      notificationAudioRef.current.load();
    } catch {
      // ignore audio init restrictions
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

  // Stabilized Socket.io room join effect (depends ONLY on socket & primitive currentUserId)
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setSocketConnState({ sock: socket, connected: true });
      setChatErrorMsg('');
      socket.emit('joinCommunityChat');
    };

    const handleDisconnect = () => {
      setSocketConnState({ sock: socket, connected: false });
    };

    if (socket.connected) {
      socket.emit('joinCommunityChat');
    }

    const handleNewMessage = (msg: CommunityChatMessage) => {
      const activeUser = currentUserRef.current;
      const activeUid = String(activeUser?._id || activeUser?.id || '');
      const isFromMe = Boolean(
        sentMessageIds.current.has(msg.id) ||
          (activeUid && msg.senderId && String(msg.senderId) === activeUid) ||
          (activeUser?.fullName && msg.senderName === activeUser.fullName)
      );

      if (!isFromMe) {
        playIncomingNotificationSound();
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(scrollToBottom, 50);
    };

    const handleOnlineCount = (count: number) => {
      setOnlineCount(Math.max(1, count || 1));
    };

    const handleChatError = (payload: unknown) => {
      const errObj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
      const msg =
        typeof payload === 'string'
          ? payload
          : (typeof errObj?.message === 'string' && errObj.message) ||
            (typeof errObj?.error === 'string' && errObj.error) ||
            'Tin nhắn không được chấp nhận bởi máy chủ.';
      setChatErrorMsg(msg);
      setCooldown(0);
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: { message: msg, type: 'error' },
        })
      );
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('communityOnlineCount', handleOnlineCount);
    socket.on('newCommunityMessage', handleNewMessage);
    socket.on('chatError', handleChatError);

    return () => {
      socket.emit('leaveCommunityChat');
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('communityOnlineCount', handleOnlineCount);
      socket.off('newCommunityMessage', handleNewMessage);
      socket.off('chatError', handleChatError);
    };
  }, [socket, currentUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const isOnlineReady = Boolean(
    socket && (socketConnState?.sock === socket ? socketConnState.connected : socket.connected)
  );

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || cooldown > 0) return;

    const token = localStorage.getItem('lost_token');
    if (!currentUser && !token) {
      if (onRequireLogin) onRequireLogin('gửi tin nhắn trò chuyện cộng đồng');
      else window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
      return;
    }

    if (!socket || !socket.connected) {
      const offlineMsg = 'Phòng chat trực tuyến đang ngoại tuyến. Vui lòng chờ kết nối lại trước khi gửi tin.';
      setChatErrorMsg(offlineMsg);
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: { message: offlineMsg, type: 'error' },
        })
      );
      return;
    }

    setChatErrorMsg('');
    setIsSending(true);
    setTimeout(() => setIsSending(false), 300);
    setCooldown(10);

    const senderName = currentUser?.fullName || 'Trekker';
    const senderAvatar = currentUser?.avatarUrl || currentUser?.avatar || '';

    const msgData: CommunityChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      senderId: currentUserId || undefined,
      senderName,
      senderAvatar,
      senderBadge: currentUser?.role === 'admin' ? 'BQT LOST' : 'Trekker',
      nameColor: currentUser?.role === 'admin' ? 'var(--color-sky)' : 'var(--color-primary)',
      quote: quoteMessage || undefined,
      text: inputText.trim(),
      createdAt: new Date().toISOString(),
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    sentMessageIds.current.add(msgData.id);
    socket.emit('sendCommunityChatMessage', msgData);

    setInputText('');
    setQuoteMessage(null);
  };

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return 'Vừa xong';
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return dateStr;
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
        borderRadius: 4,
        overflow: 'hidden',
        padding: 0,
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
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 4,
              background: 'var(--color-surface-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--color-border-strong)',
            }}
          >
            <IconMessageSquare size={15} color="var(--color-primary)" />
          </div>
          <div>
            <div className="font-editorial" style={{ fontSize: '1.12rem', fontWeight: 500, color: 'var(--color-text-main)', lineHeight: 1.15 }}>
              Phòng Chat Thực Địa 24/7
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
              Trao đổi lộ trình &amp; tình hình thời tiết
            </div>
          </div>
        </div>

        {/* Live Online / Offline Status Badge */}
        <div
          className={`badge ${isOnlineReady ? 'badge-success' : 'badge-error'}`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: isOnlineReady ? 'var(--color-primary)' : 'var(--color-error)',
            }}
          />
          <span>{isOnlineReady ? `${onlineCount} Trực tuyến` : 'Ngoại tuyến'}</span>
        </div>
      </div>

      {/* Honest Offline Notice Banner */}
      {!isOnlineReady && (
        <div
          style={{
            padding: '8px 14px',
            background: 'color-mix(in srgb, var(--color-earth) 12%, transparent)',
            borderBottom: '1px solid color-mix(in srgb, var(--color-earth) 35%, transparent)',
            color: 'var(--color-earth)',
            fontSize: '0.74rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <IconAlertTriangle size={14} color="var(--color-earth)" style={{ flexShrink: 0 }} />
          <span>Phòng chat thời gian thực đang mất kết nối máy chủ. Bạn vẫn xem được lịch sử gần nhất; hệ thống sẽ tự nối lại khi có mạng.</span>
        </div>
      )}

      {/* Server Chat Error Inline Banner */}
      {chatErrorMsg && (
        <div
          style={{
            padding: '8px 14px',
            background: 'var(--banner-danger-bg)',
            borderBottom: '1px solid var(--banner-danger-border)',
            color: 'var(--banner-danger-text)',
            fontSize: '0.74rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span>{chatErrorMsg}</span>
          <button
            type="button"
            onClick={() => setChatErrorMsg('')}
            aria-label="Đóng thông báo lỗi"
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 2 }}
          >
            <IconX size={13} />
          </button>
        </div>
      )}

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
            const isMe = Boolean(
              (currentUserId && msg.senderId && String(msg.senderId) === currentUserId) ||
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
                  position: 'relative',
                }}
                className="chat-message-row chat-message-pop"
              >
                {msg.senderAvatar && msg.senderAvatar.startsWith('http') ? (
                  <img
                    src={msg.senderAvatar}
                    alt={msg.senderName}
                    referrerPolicy="no-referrer"
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
                      color: 'var(--color-on-primary)',
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexDirection: isMe ? 'row-reverse' : 'row', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isMe ? 'var(--color-primary)' : (msg.nameColor || 'var(--color-text-main)') }}>
                      {isMe ? 'Bạn' : msg.senderName}
                    </span>
                    {msg.senderBadge && (
                      <span
                        style={{
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 4,
                          background: isMe ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--color-bg-card)',
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
                        borderRadius: 4,
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                        padding: '2px 5px',
                        fontSize: '0.64rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontWeight: 700,
                      }}
                    >
                      <IconQuote size={10} />
                      <span>Trả lời</span>
                    </button>
                  </div>

                  {/* Message Bubble */}
                  <div
                    style={{
                      background: isMe ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'var(--color-bg-card)',
                      border: isMe ? '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)' : '1px solid var(--color-border)',
                      borderRadius: 6,
                      padding: '8px 13px',
                      fontSize: '0.84rem',
                      color: 'var(--color-text-main)',
                      lineHeight: 1.5,
                      display: 'inline-block',
                      maxWidth: '100%',
                      boxShadow: 'var(--shadow-card)',
                    }}
                  >
                    {hasValidQuote && msg.quote && (
                      <div
                        style={{
                          background: 'var(--color-surface-elevated)',
                          borderLeft: '3px solid var(--color-primary)',
                          padding: '4px 8px',
                          borderRadius: 4,
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
            aria-label="Hủy trích dẫn"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-dim)',
              cursor: 'pointer',
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
          disabled={!isOnlineReady}
          placeholder={
            !isOnlineReady
              ? 'Đang chờ kết nối lại phòng chat...'
              : quoteMessage
                ? `Nhập câu trả lời cho @${quoteMessage.author}...`
                : 'Nhập tin nhắn thực địa...'
          }
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          style={{
            flex: 1,
            padding: '9px 12px',
            fontSize: '0.84rem',
            borderRadius: 4,
            background: 'var(--color-bg-main)',
            border: quoteMessage ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
          }}
        />

        {cooldown > 0 && (
          <div
            title={`Vui lòng chờ ${cooldown}s để gửi tin nhắn tiếp theo`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--color-sun) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-sun) 35%, transparent)',
              color: 'var(--color-sun)',
              fontSize: '0.74rem',
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            <IconClock size={12} color="var(--color-sun)" />
            <span>{cooldown}s</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!isOnlineReady || !inputText.trim() || cooldown > 0}
          title={!isOnlineReady ? 'Đang ngoại tuyến' : cooldown > 0 ? `Vui lòng chờ ${cooldown}s để gửi tiếp` : 'Gửi tin nhắn'}
          className="btn btn-primary interactive-click"
          style={{
            padding: '8px 14px',
            borderRadius: 4,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isOnlineReady && inputText.trim() && cooldown === 0 ? 1 : 0.45,
            cursor: isOnlineReady && inputText.trim() && cooldown === 0 ? 'pointer' : 'not-allowed',
            transform: isSending ? 'scale(0.94)' : 'scale(1)',
          }}
        >
          <IconSend size={15} color="var(--color-on-primary)" />
        </button>
      </form>
    </div>
  );
};
