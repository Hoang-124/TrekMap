import React, { useState } from 'react';
import type { Conversation } from '../../types.js';
import { useSocket } from '../../hooks/useSocket.js';
import { searchMatchVietnamese } from '../../utils/textUtils.js';

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
    if (!searchTerm.trim()) return true;
    const name = c.isGroup
      ? c.groupName || 'Nhóm Đoàn LOST'
      : c.otherParticipant?.fullName || c.otherParticipant?.username || '';
    const lastText = c.lastMessage?.content || '';
    return searchMatchVietnamese(name, searchTerm) || searchMatchVietnamese(lastText, searchTerm);
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
        <div className="section-eyebrow" style={{ marginBottom: 4 }}>Tin nhắn</div>
        <h3 className="font-editorial" style={{ fontSize: '1.35rem', fontWeight: 500, margin: '0 0 12px 0', color: 'var(--color-text-main)' }}>
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
            className="form-input"
            placeholder="Tìm theo tên thành viên (hỗ trợ không dấu)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: 36,
              fontSize: '0.82rem',
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 4,
            }}
          />
        </div>
      </div>

      {/* Conversations Scroll View */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            {searchTerm.trim() ? `Không tìm thấy hội thoại khớp "${searchTerm}".` : 'Chưa có cuộc trò chuyện nào.'}
          </div>
        ) : (
          filtered.map((conv) => {
            const isSelected = conv._id === selectedConversationId;
            const isGroup = Boolean(conv.isGroup);
            const other = conv.otherParticipant;
            const name = isGroup
              ? conv.groupName || 'Nhóm Đoàn LOST'
              : other?.fullName || other?.username || 'Thành viên LOST';
            const avatar = other?.avatarUrl || '';

            const lastMsgContent = conv.lastMessage?.content || (isGroup ? `Nhóm đoàn • ${conv.participants?.length || 1} thành viên` : 'Bắt đầu cuộc trò chuyện...');
            const unread = conv.unreadCount || 0;
            const isOnline = !isGroup && isUserOnline(other?._id, other?.email);

            return (
              <div
                key={conv._id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectConversation(conv._id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectConversation(conv._id);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 11,
                  borderRadius: 4,
                  cursor: 'pointer',
                  marginBottom: 4,
                  background: isSelected ? 'var(--color-surface-elevated)' : 'transparent',
                  border: isSelected ? '1px solid var(--color-border-strong)' : '1px solid transparent',
                  borderLeft: isSelected ? '2px solid var(--color-primary)' : '2px solid transparent',
                  transition: 'background-color 0.18s ease',
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {isGroup ? (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: 'color-mix(in srgb, var(--color-sky) 16%, transparent)',
                        border: '2px solid var(--color-sky)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-sky)',
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                  ) : (
                    <>
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={name}
                          referrerPolicy="no-referrer"
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: isOnline ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
                            border: isOnline ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                            color: 'var(--color-primary)',
                            fontWeight: 800,
                            fontSize: '0.96rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: isOnline ? 'var(--color-primary)' : 'var(--color-text-dim)',
                          border: '2px solid var(--color-bg-card)',
                        }}
                        title={isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
                      />
                    </>
                  )}
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
                      color: 'var(--color-on-primary)',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      borderRadius: 4,
                      padding: '2px 7px',
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
