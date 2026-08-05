import React, { useState } from 'react';
import type { ForumThread } from '../../types.js';
import { MessageSquare, Flame, UserCheck, PlusCircle } from 'lucide-react';

interface CompactDiscussionTableProps {
  threads: ForumThread[];
  onOpenNewThreadModal: () => void;
}

export const CompactDiscussionTable: React.FC<CompactDiscussionTableProps> = ({
  threads,
  onOpenNewThreadModal,
}) => {
  const [activeTab, setActiveTab] = useState<'discussion' | 'confession' | 'most_viewed'>('discussion');

  const getFilteredThreads = () => {
    if (activeTab === 'confession') {
      return threads.filter((t) => t.category === 'Cảnh Báo' || t.category === 'Hỏi Đáp');
    }
    if (activeTab === 'most_viewed') {
      return [...threads].sort((a, b) => b.viewsCount - a.viewsCount);
    }
    return threads;
  };

  const filtered = getFilteredThreads();

  return (
    <div style={{
      background: 'var(--color-bg-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: 'var(--shadow-card)',
    }}>
      {/* Top Header Tabs */}
      <div style={{
        background: 'var(--color-bg-main)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setActiveTab('discussion')}
            style={{
              background: activeTab === 'discussion' ? 'rgba(22, 163, 74, 0.12)' : 'transparent',
              color: activeTab === 'discussion' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              border: 'none',
              borderBottom: activeTab === 'discussion' ? '2px solid var(--color-primary)' : '2px solid transparent',
              padding: '14px 20px',
              fontWeight: 700,
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
            }}
          >
            <MessageSquare size={16} /> Thảo luận
          </button>

          <button
            onClick={() => setActiveTab('confession')}
            style={{
              background: activeTab === 'confession' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
              color: activeTab === 'confession' ? 'var(--color-error)' : 'var(--color-text-muted)',
              border: 'none',
              borderBottom: activeTab === 'confession' ? '2px solid var(--color-error)' : '2px solid transparent',
              padding: '14px 20px',
              fontWeight: 700,
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
            }}
          >
            <Flame size={16} color="var(--color-error)" /> Tâm sự & Cảnh báo
          </button>

          <button
            onClick={() => setActiveTab('most_viewed')}
            style={{
              background: activeTab === 'most_viewed' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              color: activeTab === 'most_viewed' ? 'var(--color-sky)' : 'var(--color-text-muted)',
              border: 'none',
              borderBottom: activeTab === 'most_viewed' ? '2px solid var(--color-sky)' : '2px solid transparent',
              padding: '14px 20px',
              fontWeight: 700,
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
            }}
          >
            <UserCheck size={16} color="var(--color-sky)" /> Xem nhiều nhất
          </button>
        </div>

        <button
          className="btn btn-primary"
          onClick={onOpenNewThreadModal}
          style={{ padding: '6px 14px', fontSize: 'var(--font-size-xs)', borderRadius: 20 }}
        >
          <PlusCircle size={14} /> Tạo chủ đề mới
        </button>
      </div>

      {/* Data Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
          <thead>
            <tr style={{
              background: 'var(--color-bg-main)',
              color: 'var(--color-text-muted)',
              borderBottom: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              <th style={{ padding: '12px 14px', width: 45, textAlign: 'center' }}>#</th>
              <th style={{ padding: '12px 16px' }}>Chủ đề</th>
              <th style={{ padding: '12px 14px', width: 130 }}>Chuyên mục</th>
              <th style={{ padding: '12px 14px', width: 80, textAlign: 'center' }}>Reply</th>
              <th style={{ padding: '12px 14px', width: 80, textAlign: 'center' }}>View</th>
              <th style={{ padding: '12px 14px', width: 140 }}>Thời gian</th>
              <th style={{ padding: '12px 16px', width: 150 }}>Tác giả</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((thread, index) => (
              <tr
                key={thread.id}
                style={{
                  borderBottom: '1px solid var(--color-border)',
                  transition: 'background 0.15s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-main)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Index # */}
                <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                  {index + 1}
                </td>

                {/* Title + Tag Badge */}
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`badge ${thread.category === 'Hỏi Đáp' ? 'badge-success' : thread.category === 'Cảnh Báo' ? 'badge-error' : 'badge-info'}`} style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px' }}>
                      {thread.category}
                    </span>
                    <span style={{ color: 'var(--color-text-main)', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                      {thread.title}
                    </span>
                  </div>
                </td>

                {/* Forum Category */}
                <td style={{ padding: '12px 14px', color: '#94a3b8', fontSize: '0.82rem' }}>
                  💬 {thread.category}
                </td>

                {/* Replies Count */}
                <td style={{ padding: '12px 14px', textAlign: 'center', color: '#38bdf8', fontWeight: 700 }}>
                  {thread.repliesCount}
                </td>

                {/* Views Count */}
                <td style={{ padding: '12px 14px', textAlign: 'center', color: '#94a3b8' }}>
                  {thread.viewsCount}
                </td>

                {/* Date */}
                <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '0.8rem' }}>
                  {thread.createdAt}
                </td>

                {/* Author Avatar + Name */}
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img
                      src={thread.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
                      alt={thread.authorName}
                      style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <span style={{ color: '#0ed7b5', fontWeight: 600, fontSize: '0.84rem' }}>
                      {thread.authorName}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
