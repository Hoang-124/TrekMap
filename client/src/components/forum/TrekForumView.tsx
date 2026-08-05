import React, { useState, useEffect, useCallback } from 'react';
import type { ForumThread } from '../../types.js';

const createSvgIcon = (d: React.ReactNode, defaultSize = 18) => {
  return ({ size = defaultSize, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      {d}
    </svg>
  );
};

const ArrowLeft = createSvgIcon(<><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></>);
const PlusCircle = createSvgIcon(<><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></>);
const Download = createSvgIcon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>);
const FileText = createSvgIcon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>);
const Send = createSvgIcon(<><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>);
import { TrekkerRadioBasecamp } from './TrekkerRadioBasecamp.js';
import { AlpineExpeditionFeed } from './AlpineExpeditionFeed.js';
import { getApiHeaders } from '../../utils/sessionHeaders';
import { useSocket } from '../../hooks/useSocket.js';

interface TrekForumViewProps {
  onBack: () => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const TrekForumView: React.FC<TrekForumViewProps> = ({ onBack, onShowToast }) => {
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [isNewThreadOpen, setIsNewThreadOpen] = useState(false);
  const { socket } = useSocket();

  // New Thread Form
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'Hỏi Đáp' | 'Kinh Nghiệm' | 'Tìm Đồng Đội' | 'Cảnh Báo'>('Hỏi Đáp');
  const [newContent, setNewContent] = useState('');

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/forum', {
        headers: getApiHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setThreads(data.data);
      }
    } catch (err) {
      console.error('Failed to load forum threads', err);
    }
  }, []);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Real-time socket listeners for live thread updates
  useEffect(() => {
    if (!socket) return;

    const handleNewComment = (data: any) => {
      setThreads((prev) =>
        prev.map((t) =>
          String(t.id) === String(data.threadId)
            ? { ...t, repliesCount: data.repliesCount !== undefined ? data.repliesCount : t.repliesCount + 1 }
            : t
        )
      );
    };

    const handleThreadReaction = (data: any) => {
      setThreads((prev) =>
        prev.map((t) =>
          String(t.id) === String(data.threadId)
            ? { ...t, upvotes: data.upvotes !== undefined ? data.upvotes : t.upvotes, reactions: data.reactions || t.reactions }
            : t
        )
      );
    };

    socket.on('newComment', handleNewComment);
    socket.on('threadReactionUpdate', handleThreadReaction);

    return () => {
      socket.off('newComment', handleNewComment);
      socket.off('threadReactionUpdate', handleThreadReaction);
    };
  }, [socket]);

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    try {
      const token = localStorage.getItem('trekmap_token');
      const res = await fetch('http://localhost:5000/api/forum', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: newTitle,
          category: newCategory,
          content: newContent,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setThreads([data.data, ...threads]);
        setIsNewThreadOpen(false);
        setNewTitle('');
        setNewContent('');
        if (onShowToast) {
          onShowToast('Tạo bài đóng góp nhật ký mới thành công!', 'success');
        }
      }
    } catch (err) {
      if (onShowToast) {
        onShowToast('Không thể đăng bài, vui lòng thử lại.', 'error');
      }
    }
  };

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '30px 24px' }}>
      {/* Navigation Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button className="btn btn-outline" onClick={onBack}>
          <ArrowLeft size={16} /> Quay lại trang chủ
        </button>

        <button
          className="btn btn-primary"
          onClick={() => {
            const token = localStorage.getItem('trekmap_token');
            if (!token) {
              if (onShowToast) {
                onShowToast('Vui lòng đăng nhập để tạo bài nhật ký mới trên diễn đàn!', 'info');
              }
              window.location.hash = '#login';
              return;
            }
            setIsNewThreadOpen(true);
          }}
        >
          <PlusCircle size={16} /> Viết nhật ký mới
        </button>
      </div>

      {/* Hero Banner */}
      <div className="card" style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        padding: '36px 32px',
        marginBottom: 36,
      }}>
        <span className="badge badge-success" style={{ marginBottom: 12 }}>
          ALPINE EXPEDITION HUB
        </span>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)', marginBottom: 12 }}>
          Trạm Nhật Ký Băng Rừng & Vô Tuyến Trekker
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-base)', maxWidth: 800, lineHeight: 'var(--line-height-relaxed)' }}>
          Hệ thống kết nối vô tuyến trực tuyến 4G, chia sẻ cẩm nang địa hình và cập nhật tình trạng sương mù, trượt lở thực tế trên các đỉnh núi Việt Nam.
        </p>
      </div>

      {/* 1. BASECAMP RADIO STATION */}
      <TrekkerRadioBasecamp />

      {/* 2. ALPINE EXPEDITION FEED & RADAR */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 28 }}>
        <div>
          <AlpineExpeditionFeed
            threads={threads}
            onOpenNewThreadModal={() => {
              const token = localStorage.getItem('trekmap_token');
              if (!token) {
                if (onShowToast) {
                  onShowToast('Vui lòng đăng nhập để tạo bài nhật ký mới trên diễn đàn!', 'info');
                }
                window.location.hash = '#login';
                return;
              }
              setIsNewThreadOpen(true);
            }}
          />
        </div>

        {/* Sidebar Resources */}
        <div>
          <div className="card" style={{ marginBottom: 24, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={18} color="var(--color-primary)" /> Kho GPX & Tài Nguyên
            </h3>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 16, lineHeight: 'var(--line-height-normal)' }}>
              Tải xuống dữ liệu bản đồ GPX chuẩn và tài liệu hướng dẫn an toàn leo núi miễn phí cho cộng đồng.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { title: 'Tệp GPX Trọn bộ 50 Cung đường', size: '2.4 MB' },
                { title: 'Cẩm nang Y tế & Xử lý sự cố', size: '1.1 MB' },
                { title: 'Bảng tọa độ 100 Trạm kiểm lâm', size: '850 KB' },
              ].map((res, idx) => (
                <div key={idx} style={{
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 'var(--font-size-xs)',
                }}>
                  <div>
                    <div style={{ color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-bold)' }}>{res.title}</div>
                    <div style={{ color: 'var(--color-text-dim)', fontSize: 'var(--font-size-xs)' }}>{res.size}</div>
                  </div>
                  <button className="btn btn-outline" style={{ padding: 6, borderRadius: '50%' }}>
                    <Download size={14} color="var(--color-primary)" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Create New Thread Modal */}
      {isNewThreadOpen && (
        <div className="modal-overlay" onClick={() => setIsNewThreadOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.3rem', color: '#fff', fontWeight: 800, marginBottom: 20 }}>
              Viết bài đóng góp nhật ký băng rừng
            </h3>

            <form onSubmit={handleCreateThread}>
              <div className="form-group">
                <label className="form-label">Tiêu đề nhật ký</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Cẩm nang leo Lảo Thẩn 2N1Đ tự túc mới nhất"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Chuyên mục</label>
                <select
                  className="form-select"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                >
                  <option value="Hỏi Đáp">Hỏi Đáp</option>
                  <option value="Kinh Nghiệm">Kinh Nghiệm</option>
                  <option value="Tìm Đồng Đội">Tìm Đồng Đội</option>
                  <option value="Cảnh Báo">Cảnh Báo</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Nội dung chi tiết</label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  placeholder="Nhập nội dung chia sẻ trải nghiệm thực tế của bạn..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsNewThreadOpen(false)} style={{ flex: 1 }}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                  <Send size={16} /> Đăng nhật ký
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
