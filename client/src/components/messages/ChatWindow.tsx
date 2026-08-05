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
  onSendMessage: (content: string) => void;
  onBack?: () => void;
  isLoading?: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  messages,
  currentUserId,
  onSendMessage,
  onBack,
  isLoading = false,
}) => {
  const [inputContent, setInputContent] = useState('');
  const messageListRef = useRef<HTMLDivElement>(null);
  const { isUserOnline } = useSocket();

  const scrollToBottom = () => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim()) return;
    onSendMessage(inputContent.trim());
    setInputContent('');
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
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--color-text-main)' }}>
          Tin Nhắn Trực Tiếp
        </h3>
        <p style={{ fontSize: '0.85rem', margin: 0 }}>
          Chọn một cuộc trò chuyện từ danh sách hoặc nhắn tin trực tiếp từ hồ sơ người dùng khác.
        </p>
      </div>
    );
  }

  const other = conversation.otherParticipant;
  const otherName = other?.fullName || other?.username || 'Thành viên TrekMap';
  const otherAvatar =
    other?.avatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(otherName)}&background=10b981&color=fff`;

  const isOnline = isUserOnline(other?._id, other?.email);

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
        {onBack && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={onBack}
            style={{ padding: 6, display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={18} />
          </button>
        )}

        <img
          src={otherAvatar}
          alt={otherName}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            objectFit: 'cover',
            border: isOnline ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
          }}
        />

        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
            {otherName}
          </div>
          {isOnline ? (
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
            // Find index of the LATEST message sent by me that has been read by the other participant
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
              const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
              const msgAvatar = senderObj?.avatarUrl || otherAvatar;
              const isLastReadMessage = idx === lastReadMsgIndex;

              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;

              const prevSenderId = prevMsg ? (typeof prevMsg.sender === 'object' ? prevMsg.sender?._id : prevMsg.sender) : null;
              const nextSenderId = nextMsg ? (typeof nextMsg.sender === 'object' ? nextMsg.sender?._id : nextMsg.sender) : null;

              const currTime = msg.createdAt ? new Date(msg.createdAt).getTime() : 0;
              const prevTime = prevMsg?.createdAt ? new Date(prevMsg.createdAt).getTime() : 0;
              const nextTime = nextMsg?.createdAt ? new Date(nextMsg.createdAt).getTime() : 0;

              // Time gap > 15 minutes or day change shows a centered time divider
              const showTimeDivider = idx === 0 || (currTime - prevTime) > 15 * 60 * 1000;

              // Check if next message is from same sender within 5 mins
              const isSameSenderAsNext = nextMsg && String(nextSenderId) === String(senderId) && (nextTime - currTime) <= 5 * 60 * 1000;

              // Show avatar only on last message of a received cluster
              const showAvatar = !isMe && !isSameSenderAsNext;

              // Show bottom timestamp label if it's the last in cluster OR if it's the last read message
              const showBottomTimestamp = !isSameSenderAsNext || isLastReadMessage;

              return (
                <React.Fragment key={msg._id || idx}>
                  {showTimeDivider && (
                    <div
                      style={{
                        textAlign: 'center',
                        margin: '12px 0 6px 0',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
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
                          <img
                            src={msgAvatar}
                            alt={otherName}
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '1px solid var(--color-border)',
                            }}
                          />
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
                      <div
                        style={{
                          padding: '9px 15px',
                          borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          background: isMe ? 'var(--color-primary)' : 'var(--color-bg-card)',
                          color: isMe ? '#ffffff' : 'var(--color-text-main)',
                          border: isMe ? 'none' : '1px solid var(--color-border)',
                          fontSize: '0.9rem',
                          lineHeight: 1.45,
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          whiteSpace: 'pre-wrap',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
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
          className="input"
          placeholder="Nhập tin nhắn..."
          value={inputContent}
          onChange={(e) => setInputContent(e.target.value)}
          style={{ flex: 1, padding: '10px 14px', fontSize: '0.88rem', borderRadius: 24 }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!inputContent.trim()}
          style={{
            borderRadius: '50%',
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
