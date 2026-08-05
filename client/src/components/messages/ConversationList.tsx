import React, { useState } from 'react';
import type { Conversation } from '../../types.js';
import { useSocket } from '../../hooks/useSocket.js';

const Search = ({ size = 18, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  currentUserId: string;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { isUserOnline } = useSocket();

  const filtered = conversations.filter((c) => {
    if (!searchTerm) return true;
    const name = c.otherParticipant?.fullName || c.otherParticipant?.username || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--color-bg-card)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {/* List Header & Search */}
      <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--color-border)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--color-text-main)' }}>
          Hội Thoại
        </h3>
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
            }}
          />
          <input
            type="text"
            className="input"
            placeholder="Tìm theo tên thành viên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: 36,
              fontSize: '0.82rem',
              paddingTop: 8,
              paddingBottom: 8,
            }}
          />
        </div>
      </div>

      {/* Conversations Scroll View */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            Chưa có cuộc trò chuyện nào.
          </div>
        ) : (
          filtered.map((conv) => {
            const isSelected = conv._id === selectedConversationId;
            const other = conv.otherParticipant;
            const name = other?.fullName || other?.username || 'Thành viên TrekMap';
            const avatar =
              other?.avatarUrl ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10b981&color=fff`;

            const lastMsgContent = conv.lastMessage?.content || 'Bắt đầu cuộc trò chuyện...';
            const unread = conv.unreadCount || 0;
            const isOnline = isUserOnline(other?._id, other?.email);

            return (
              <div
                key={conv._id}
                onClick={() => onSelectConversation(conv._id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: 12,
                  cursor: 'pointer',
                  marginBottom: 4,
                  background: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                  border: isSelected ? '1px solid var(--color-primary)' : '1px solid transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <img
                    src={avatar}
                    alt={name}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: isOnline ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: isOnline ? '#10b981' : '#9ca3af',
                      border: '2px solid var(--color-bg-card)',
                    }}
                    title={isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: unread > 0 ? 800 : 700,
                        color: 'var(--color-text-main)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {name}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: unread > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      fontWeight: unread > 0 ? 700 : 400,
                      marginTop: 3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {lastMsgContent}
                  </div>
                </div>

                {unread > 0 && (
                  <div
                    style={{
                      background: 'var(--color-primary)',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      borderRadius: 12,
                      padding: '2px 8px',
                      minWidth: 18,
                      textAlign: 'center',
                    }}
                  >
                    {unread}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
