import React, { useState, useEffect, useCallback } from 'react';
import type { ForumThread } from '../../types.js';
import { TrekkerRadioBasecamp } from './TrekkerRadioBasecamp.js';
import { AlpineExpeditionFeed } from './AlpineExpeditionFeed.js';
import { ArrowLeft, PlusCircle, Download, FileText, Send } from 'lucide-react';
import { getApiHeaders } from '../../utils/sessionHeaders';
import { useSocket } from '../../hooks/useSocket.js';

interface TrekForumViewProps {
  onBack: () => void;
}

export const TrekForumView: React.FC<TrekForumViewProps> = ({ onBack }) => {
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
        alert('Tạo bài đóng góp nhật ký thành công!');
      }
    } catch (err) {
      alert('Không thể đăng bài, vui lòng thử lại.');
    }
  };

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '30px 24px' }}>
      {/* Navigation Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button className="btn btn-outline" onClick={onBack}>
          <ArrowLeft size={16} /> Quay lại trang chủ
        </button>

        <button className="btn btn-primary" onClick={() => setIsNewThreadOpen(true)}>
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
            onOpenNewThreadModal={() => setIsNewThreadOpen(true)}
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
