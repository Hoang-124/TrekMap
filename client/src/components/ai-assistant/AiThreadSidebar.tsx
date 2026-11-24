import React, { useState } from 'react';
import {
  IconPlus,
  IconSearch,
  IconPin,
  IconPinOff,
  IconTrash,
  IconEdit,
  IconCheck,
  IconX,
  IconMessageSquare,
} from '../common/SvgIcons.js';
import type { AiChatThreadSummary } from './ai.types.js';
import { searchMatchVietnamese } from '../../utils/textUtils.js';

interface AiThreadSidebarProps {
  threads: AiChatThreadSummary[];
  activeThreadId: string | null;
  isCloudSynced: boolean;
  isCompactOverlay?: boolean;
  onSelectThread: (threadId: string) => void;
  onCreateNewThread: () => void;
  onRenameThread: (threadId: string, newTitle: string) => void;
  onTogglePinThread: (threadId: string, nextPinned: boolean) => void;
  onDeleteThread: (threadId: string) => void;
  onClose?: () => void;
}

function formatRelativeDate(iso?: string): string {
  if (!iso) return 'Vừa xong';
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin}p trước`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h trước`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

export const AiThreadSidebar: React.FC<AiThreadSidebarProps> = ({
  threads,
  activeThreadId,
  isCloudSynced,
  isCompactOverlay = false,
  onSelectThread,
  onCreateNewThread,
  onRenameThread,
  onTogglePinThread,
  onDeleteThread,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filtered = threads.filter((t) => {
    if (!search.trim()) return true;
    const q = search.trim();
    return searchMatchVietnamese(t.title, q) || searchMatchVietnamese(t.trailContextName || '', q);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });

  const handleSaveRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameThread(id, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  return (
    <aside
      aria-label="Lịch sử hội thoại LOST AI"
      style={{
        width: isCompactOverlay ? '100%' : 248,
        maxWidth: isCompactOverlay ? 300 : 248,
        height: '100%',
        background: 'var(--color-bg-main)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: isCompactOverlay ? 'absolute' : 'relative',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: isCompactOverlay ? 25 : 2,
        boxShadow: isCompactOverlay ? 'var(--shadow-3d)' : 'none',
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          padding: '12px 12px 10px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <button
            type="button"
            onClick={() => {
              onCreateNewThread();
              if (isCompactOverlay) onClose?.();
            }}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '7px 10px',
              borderRadius: 4,
              background: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
            }}
          >
            <IconPlus size={14} color="var(--color-on-primary)" />
            <span>Hội Thoại Mới</span>
          </button>

          {isCompactOverlay && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng thanh lịch sử"
              style={{
                width: 30,
                height: 30,
                borderRadius: 4,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <IconX size={14} />
            </button>
          )}
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <IconSearch
            size={13}
            color="var(--color-text-dim)"
            style={{ position: 'absolute', left: 9, pointerEvents: 'none' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm hội thoại..."
            style={{
              width: '100%',
              padding: '6px 8px 6px 28px',
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-main)',
              fontSize: '0.76rem',
              fontFamily: 'var(--font-family)',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Thread List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sorted.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--color-text-dim)', fontSize: '0.76rem', lineHeight: 1.5 }}>
            Chưa có hội thoại nào được lưu. Bắt đầu đặt câu hỏi để LOST AI tự động lưu lại.
          </div>
        ) : (
          sorted.map((t) => {
            const isActive = t.id === activeThreadId;
            const isEditing = editingId === t.id;

            return (
              <div
                key={t.id}
                style={{
                  borderRadius: 4,
                  padding: '8px 9px',
                  background: isActive
                    ? 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-card))'
                    : 'transparent',
                  border: isActive
                    ? '1px solid color-mix(in srgb, var(--color-primary) 38%, transparent)'
                    : '1px solid transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                }}
              >
                {isEditing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(t.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: '3px 6px',
                        borderRadius: 4,
                        border: '1px solid var(--color-primary)',
                        background: 'var(--color-bg-card)',
                        color: 'var(--color-text-main)',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-family)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveRename(t.id)}
                      aria-label="Lưu tên mới"
                      style={{ color: 'var(--color-primary)', cursor: 'pointer', padding: 3 }}
                    >
                      <IconCheck size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="Hủy đổi tên"
                      style={{ color: 'var(--color-text-dim)', cursor: 'pointer', padding: 3 }}
                    >
                      <IconX size={13} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectThread(t.id);
                        if (isCompactOverlay) onClose?.();
                      }}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {t.pinned ? (
                          <IconPin size={11} color="var(--color-earth)" style={{ flexShrink: 0 }} />
                        ) : (
                          <IconMessageSquare size={11} color={isActive ? 'var(--color-primary)' : 'var(--color-text-dim)'} style={{ flexShrink: 0 }} />
                        )}
                        <span
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: isActive ? 700 : 600,
                            color: isActive ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t.title}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>
                        <span>{formatRelativeDate(t.lastMessageAt)}</span>
                        <span>·</span>
                        <span>{t.messageCount} tin</span>
                      </div>
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                      <button
                        type="button"
                        title={t.pinned ? 'Bỏ ghim' : 'Ghim hội thoại'}
                        aria-label={t.pinned ? 'Bỏ ghim' : 'Ghim hội thoại'}
                        onClick={() => onTogglePinThread(t.id, !t.pinned)}
                        style={{ padding: 3, color: t.pinned ? 'var(--color-earth)' : 'var(--color-text-dim)', cursor: 'pointer' }}
                      >
                        {t.pinned ? <IconPinOff size={12} /> : <IconPin size={12} />}
                      </button>
                      <button
                        type="button"
                        title="Đổi tên"
                        aria-label="Đổi tên hội thoại"
                        onClick={() => {
                          setEditingId(t.id);
                          setEditTitle(t.title);
                        }}
                        style={{ padding: 3, color: 'var(--color-text-dim)', cursor: 'pointer' }}
                      >
                        <IconEdit size={12} />
                      </button>
                      <button
                        type="button"
                        title="Xóa hội thoại"
                        aria-label="Xóa hội thoại"
                        onClick={() => onDeleteThread(t.id)}
                        style={{ padding: 3, color: 'var(--color-error-text, var(--color-error))', cursor: 'pointer' }}
                      >
                        <IconTrash size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Sync Status Footer */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--color-border)',
          fontSize: '0.7rem',
          color: 'var(--color-text-dim)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: isCloudSynced ? 'var(--color-primary)' : 'var(--color-sky)',
            flexShrink: 0,
          }}
        />
        <span>{isCloudSynced ? 'Đồng bộ đám mây + Offline' : 'Lưu cục bộ trên thiết bị'}</span>
      </div>
    </aside>
  );
};
