import React, { useState, useEffect, useRef } from 'react';
import type { Conversation, Message } from '../../types.js';
import { useSocket } from '../../hooks/useSocket.js';

const Send = ({ size = 18, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const ArrowLeft = ({ size = 18, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  currentUserId: string;
  onSendMessage: (content: string) => Promise<boolean> | void;
  onBack?: () => void;
  isLoading?: boolean;
  isSending?: boolean;
  hasMore?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
}

function formatDividerTimestamp(dateInput: string, showFullDate: boolean): string {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const timePart = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (!showFullDate) return timePart;

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return `Hôm nay • ${timePart}`;
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return `Hôm qua • ${timePart}`;
  }
  const datePart = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${datePart} • ${timePart}`;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  messages,
  currentUserId,
  onSendMessage,
  onBack,
  isLoading = false,
  isSending = false,
  hasMore = false,
  loadingOlder = false,
  onLoadOlder,
}) => {
  const [inputContent, setInputContent] = useState('');
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  const messageListRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const prevLastMsgIdRef = useRef<string | null>(null);
  const prevConvIdRef = useRef<string | null>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const wasLoadingOlderRef = useRef<boolean>(false);

  const { socket, isUserOnline } = useSocket();
  const convId = conversation?._id || null;

  // Responsive viewport listener so Back button is hidden on desktop (>= 768px)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobileViewport(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Join direct conversation room & listen to typing status
  useEffect(() => {
    if (!socket || !convId) return;

    socket.emit('joinConversation', convId);

    const handleUserTyping = (data: { conversationId: string; userId: string; userName?: string }) => {
      if (data.conversationId === convId && String(data.userId) !== String(currentUserId)) {
        setIsOtherTyping(true);
      }
    };

    const handleUserStoppedTyping = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId === convId && String(data.userId) !== String(currentUserId)) {
        setIsOtherTyping(false);
      }
    };

    socket.on('userTyping', handleUserTyping);
    socket.on('userStoppedTyping', handleUserStoppedTyping);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      socket.emit('stopTyping', {
        conversationId: convId,
        userId: currentUserId,
      });
      socket.emit('leaveConversation', convId);
      socket.off('userTyping', handleUserTyping);
      socket.off('userStoppedTyping', handleUserStoppedTyping);
      setIsOtherTyping(false);
    };
  }, [socket, convId, currentUserId]);

  const handleScroll = () => {
    const el = messageListRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 120;
  };

  // Preserve scroll position after prepending older messages, and ONLY auto-scroll on conv change or new bottom message when near bottom (NEVER yank user away on isOtherTyping!)
  useEffect(() => {
    const el = messageListRef.current;
    if (wasLoadingOlderRef.current && !loadingOlder && el) {
      const addedHeight = el.scrollHeight - prevScrollHeightRef.current;
      if (addedHeight > 0) {
        el.scrollTop += addedHeight;
      }
      wasLoadingOlderRef.current = false;
    }
  }, [loadingOlder, messages]);

  useEffect(() => {
    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    const lastId = lastMsg?._id ? String(lastMsg._id) : null;
    const switchedConv = prevConvIdRef.current !== convId;
    const appendedNewBottomMsg = lastId !== null && lastId !== prevLastMsgIdRef.current;

    if (switchedConv) {
      prevConvIdRef.current = convId;
      prevLastMsgIdRef.current = lastId;
      isNearBottomRef.current = true;
      if (messageListRef.current) {
        messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
      }
      return;
    }

    if (appendedNewBottomMsg) {
      prevLastMsgIdRef.current = lastId;
      const senderId = lastMsg ? (typeof lastMsg.sender === 'object' ? lastMsg.sender?._id : lastMsg.sender) : null;
      const sentByMe = String(senderId) === String(currentUserId);
      if (sentByMe || isNearBottomRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, convId, currentUserId]);

  const handleTriggerLoadOlder = () => {
    if (!onLoadOlder || loadingOlder) return;
    if (messageListRef.current) {
      prevScrollHeightRef.current = messageListRef.current.scrollHeight;
    }
    wasLoadingOlderRef.current = true;
    onLoadOlder();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputContent(val);

    if (socket && convId) {
      socket.emit('typing', {
        conversationId: convId,
        userId: currentUserId,
      });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stopTyping', {
          conversationId: convId,
          userId: currentUserId,
        });
      }, 2000);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputContent.trim();
    if (!trimmed || isSending) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (socket && convId) {
      socket.emit('stopTyping', {
        conversationId: convId,
        userId: currentUserId,
      });
    }

    setInputContent('');
    const ok = await onSendMessage(trimmed);
    if (ok === false) {
      setInputContent(trimmed);
    }
  };

  if (!conversation) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--color-text-muted)',
          padding: 32,
          textAlign: 'center',
        }}
      >
        <h3 className="font-editorial" style={{ fontSize: '1.5rem', fontWeight: 500, margin: '0 0 6px 0', color: 'var(--color-text-main)' }}>
          Tin Nhắn Trực Tiếp
        </h3>
        <p style={{ fontSize: '0.85rem', margin: 0 }}>
          Chọn một cuộc trò chuyện từ danh sách hoặc nhắn tin trực tiếp từ hồ sơ người dùng khác.
        </p>
      </div>
    );
  }

  const isGroup = Boolean(conversation.isGroup);
  const other = conversation.otherParticipant;
  const otherName = isGroup
    ? conversation.groupName || 'Nhóm Đoàn LOST'
    : other?.fullName || other?.username || 'Thành viên LOST';
  const otherAvatar = other?.avatarUrl || '';
  const isOnline = !isGroup && isUserOnline(other?._id, other?.email);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        overflow: 'hidden',
        background: 'var(--color-bg-main)',
        flex: 1,
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          background: 'var(--color-bg-card)',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        {onBack && isMobileViewport && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={onBack}
            aria-label="Quay lại danh sách hội thoại"
            style={{ padding: 6, display: 'flex', alignItems: 'center', borderRadius: 4 }}
          >
            <ArrowLeft size={18} />
          </button>
        )}

        {isGroup ? (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'color-mix(in srgb, var(--color-sky) 16%, transparent)',
              border: '2px solid var(--color-sky)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-sky)',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
        ) : otherAvatar ? (
          <img
            src={otherAvatar}
            alt={otherName}
            referrerPolicy="no-referrer"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              objectFit: 'cover',
              border: isOnline ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
              border: isOnline ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
              color: 'var(--color-primary)',
              fontWeight: 800,
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {otherName.charAt(0).toUpperCase()}
          </div>
        )}

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {otherName}
          </div>
          {isGroup ? (
            <div style={{ fontSize: '0.72rem', color: 'var(--color-sky)', fontWeight: 700 }}>
              Phòng Chat Nhóm Đoàn • {conversation.participants?.length || 1} thành viên
            </div>
          ) : isOnline ? (
            <div style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 700 }}>
              Trực tuyến
            </div>
          ) : (
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Ngoại tuyến
            </div>
          )}
        </div>
      </div>

      {/* Message List Stream */}
      <div
        ref={messageListRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Pagination button for older messages */}
        {hasMore && onLoadOlder && (
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <button
              type="button"
              className="btn btn-outline"
              disabled={loadingOlder}
              onClick={handleTriggerLoadOlder}
              style={{ padding: '5px 14px', fontSize: '0.76rem', fontWeight: 700, borderRadius: 4 }}
            >
              {loadingOlder ? 'Đang tải tin nhắn cũ...' : 'Tải thêm tin nhắn cũ'}
            </button>
          </div>
        )}

        {isLoading && messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            Đang tải tin nhắn...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            Hãy gửi tin nhắn đầu tiên để bắt đầu trò chuyện với {otherName}!
          </div>
        ) : (
          (() => {
            let lastReadMsgIndex = -1;
            messages.forEach((m, idx) => {
              const senderId = typeof m.sender === 'object' ? m.sender?._id : m.sender;
              const isMe = String(senderId) === String(currentUserId);
              const isReadByOther = m.readBy && m.readBy.some((id) => String(id) !== String(currentUserId));
              if (isMe && isReadByOther) {
                lastReadMsgIndex = idx;
              }
            });

            return messages.map((msg, idx) => {
              const senderObj = typeof msg.sender === 'object' ? msg.sender : null;
              const senderId = typeof msg.sender === 'string' ? msg.sender : msg.sender?._id;
              const isMe = String(senderId) === String(currentUserId);
              const senderDisplayName = senderObj?.fullName || senderObj?.username || otherName;
              const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
              const msgAvatar = senderObj?.avatarUrl || otherAvatar;
              const isLastReadMessage = idx === lastReadMsgIndex;

              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;

              const prevSenderId = prevMsg ? (typeof prevMsg.sender === 'object' ? prevMsg.sender?._id : prevMsg.sender) : null;
              const nextSenderId = nextMsg ? (typeof nextMsg.sender === 'object' ? nextMsg.sender?._id : nextMsg.sender) : null;

              const currDate = msg.createdAt ? new Date(msg.createdAt) : null;
              const prevDate = prevMsg?.createdAt ? new Date(prevMsg.createdAt) : null;
              const currTime = currDate && !Number.isNaN(currDate.getTime()) ? currDate.getTime() : 0;
              const prevTime = prevDate && !Number.isNaN(prevDate.getTime()) ? prevDate.getTime() : 0;
              const nextTime = nextMsg?.createdAt ? new Date(nextMsg.createdAt).getTime() : 0;

              const isDifferentDay = Boolean(
                idx === 0 || (currDate && prevDate && currDate.toDateString() !== prevDate.toDateString())
              );
              const showTimeDivider = isDifferentDay || currTime - prevTime > 15 * 60 * 1000;

              const isSameSenderAsNext =
                nextMsg &&
                String(nextSenderId) === String(senderId) &&
                nextTime - currTime <= 5 * 60 * 1000 &&
                (!currDate || new Date(nextMsg.createdAt).toDateString() === currDate.toDateString());

              const showAvatar = !isMe && !isSameSenderAsNext;
              const showBottomTimestamp = !isSameSenderAsNext || isLastReadMessage;

              return (
                <React.Fragment key={msg._id || idx}>
                  {showTimeDivider && msg.createdAt && (
                    <div
                      style={{
                        textAlign: 'center',
                        margin: '12px 0 6px 0',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      <span
                        style={{
                          background: 'var(--color-bg-card)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 4,
                          padding: '2px 10px',
                        }}
                      >
                        {formatDividerTimestamp(msg.createdAt, isDifferentDay)}
                      </span>
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-end',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      width: '100%',
                      marginTop: !showTimeDivider && idx > 0 && String(prevSenderId) === String(senderId) ? -4 : 0,
                    }}
                  >
                    {!isMe && (
                      <div style={{ width: 30, height: 30, flexShrink: 0, marginBottom: showBottomTimestamp ? 18 : 0 }}>
                        {showAvatar && (
                          msgAvatar ? (
                            <img
                              src={msgAvatar}
                              alt={senderDisplayName}
                              referrerPolicy="no-referrer"
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '1px solid var(--color-border)',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: '50%',
                                background: 'color-mix(in srgb, var(--color-sky) 16%, transparent)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-sky)',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {senderDisplayName.charAt(0).toUpperCase()}
                            </div>
                          )
                        )}
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                      }}
                    >
                      {isGroup && !isMe && (idx === 0 || String(prevSenderId) !== String(senderId)) && (
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-sky)', marginBottom: 2, paddingLeft: 4 }}>
                          {senderDisplayName}
                        </div>
                      )}
                      <div
                        style={{
                          padding: '9px 14px',
                          borderRadius: 6,
                          background: isMe ? 'var(--color-primary)' : 'var(--color-bg-card)',
                          color: isMe ? 'var(--color-on-primary)' : 'var(--color-text-main)',
                          border: isMe ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                          fontSize: '0.88rem',
                          lineHeight: 1.45,
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          whiteSpace: 'pre-wrap',
                          boxShadow: 'var(--shadow-card)',
                        }}
                      >
                        {msg.content}
                      </div>

                      {showBottomTimestamp && (
                        <div
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--color-text-muted)',
                            marginTop: 3,
                            paddingLeft: 4,
                            paddingRight: 4,
                          }}
                        >
                          {timeStr} {isMe && isLastReadMessage ? ' • Đã xem' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            });
          })()
        )}

        {isOtherTyping && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              background: 'var(--color-bg-card)',
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              fontSize: '0.76rem',
              color: 'var(--color-text-dim)',
              marginTop: 6,
              width: 'fit-content',
            }}
          >
            <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-primary)' }} />
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-primary)' }} />
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-primary)' }} />
            </span>
            <span>{otherName} đang soạn tin nhắn...</span>
          </div>
        )}

        <div ref={messagesEndRef} style={{ height: 1 }} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={handleSend}
        style={{
          display: 'flex',
          gap: 10,
          padding: 14,
          background: 'var(--color-bg-card)',
          borderTop: '1px solid var(--color-border)',
          flexShrink: 0,
          position: 'sticky',
          bottom: 0,
          zIndex: 10,
        }}
      >
        <input
          type="text"
          className="form-input"
          placeholder={isSending ? 'Đang gửi tin nhắn...' : 'Nhập tin nhắn...'}
          value={inputContent}
          disabled={isSending}
          onChange={handleInputChange}
          style={{ flex: 1, padding: '10px 14px', fontSize: '0.88rem', borderRadius: 4 }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSending || !inputContent.trim()}
          aria-label="Gửi tin nhắn"
          style={{
            borderRadius: 4,
            width: 42,
            height: 42,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};
