import React, { useState, useEffect, useCallback } from 'react';
import type { ForumThread } from '../../types.js';
import {
  IconArrowLeft,
  IconPlus,
  IconDownload,
  IconFileText,
  IconSend,
  IconSearch,
  IconUsers,
  IconSparkles,
  IconShieldCheck,
  IconRadio,
} from '../common/SvgIcons.js';
import { AlpineExpeditionFeed } from './AlpineExpeditionFeed.js';
import { LiveTrekkerChatroom } from './LiveTrekkerChatroom.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { useSocket } from '../../hooks/useSocket.js';

interface TopTrekker {
  _id: string;
  fullName: string;
  avatarUrl: string;
  reputationScore: number;
  badges?: string[];
  role?: string;
}

interface TrekForumViewProps {
  onBack: () => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  currentUser?: any;
  onRequireLogin?: (actionName: string) => void;
}

const POPULAR_PEAKS = [
  { id: 'all', name: 'Tất Cả Cung Đường' },
  { id: 'trail-laothan', name: 'Lảo Thẩn (2.860m)' },
  { id: 'trail-fansipan', name: 'Fansipan (3.143m)' },
  { id: 'trail-kyquansan', name: 'Kỳ Quan San (3.046m)' },
  { id: 'trail-putaleng', name: 'Pu Ta Leng (3.049m)' },
  { id: 'trail-taxua', name: 'Tà Xùa (2.865m)' },
];

export const TrekForumView: React.FC<TrekForumViewProps> = ({
  onBack,
  onShowToast,
  currentUser,
  onRequireLogin,
}) => {
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [topTrekkers, setTopTrekkers] = useState<TopTrekker[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeak, setSelectedPeak] = useState('all');
  const [isNewThreadOpen, setIsNewThreadOpen] = useState(false);
  const { socket } = useSocket();

  // New Thread Form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'Hỏi Đáp' | 'Kinh Nghiệm' | 'Tìm Đồng Đội' | 'Cảnh Báo'>('Kinh Nghiệm');
  const [newContent, setNewContent] = useState('');

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/forum', {
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

  const fetchTopTrekkers = useCallback(async () => {
    try {
      const res = await fetch('/api/forum/top-trekkers');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setTopTrekkers(data.data);
      }
    } catch (err) {
      console.error('Failed to load top trekkers', err);
    }
  }, []);

  useEffect(() => {
    fetchThreads();
    fetchTopTrekkers();
  }, [fetchThreads, fetchTopTrekkers]);

  // Real-time socket listeners
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
    const token = localStorage.getItem('trekmap_token');
    if (!currentUser && !token) {
      if (onRequireLogin) onRequireLogin('đăng bài thảo luận mới');
      return;
    }
    if (!newTitle.trim() || !newContent.trim()) return;

    try {
      const res = await fetch('/api/forum', {
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
          onShowToast('Tạo bài đóng góp nhật ký mới thành công! Bạn nhận +15 điểm uy tín.', 'success');
        }
      } else {
        if (onShowToast) onShowToast(data.message || 'Lỗi khi đăng bài', 'error');
      }
    } catch (err) {
      if (onShowToast) onShowToast('Không thể kết nối máy chủ', 'error');
    }
  };

  // Filtered threads based on search query and peak filter
  const filteredThreads = threads.filter((t) => {
    const matchesSearch =
      !searchQuery.trim() ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPeak =
      selectedPeak === 'all' ||
      t.title.toLowerCase().includes(selectedPeak.replace('trail-', '').toLowerCase()) ||
      t.content.toLowerCase().includes(selectedPeak.replace('trail-', '').toLowerCase());

    return matchesSearch && matchesPeak;
  });

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px 60px' }}>
      {/* Top Header & Actions Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <button
          className="btn btn-outline interactive-click"
          onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 12 }}
        >
          <IconArrowLeft size={16} /> Quay lại trang chủ
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-primary interactive-click ripple-fx"
            onClick={() => {
              const token = localStorage.getItem('trekmap_token');
              if (!currentUser && !token) {
                if (onRequireLogin) {
                  onRequireLogin('tạo bài nhật ký mới trên diễn đàn');
                } else if (onShowToast) {
                  onShowToast('Vui lòng đăng nhập để tạo bài nhật ký mới trên diễn đàn!', 'info');
                }
                return;
              }
              setIsNewThreadOpen(true);
            }}
            style={{
              padding: '9px 18px',
              borderRadius: 12,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 800,
            }}
          >
            <IconPlus size={16} color="#041108" /> Viết Bài Đóng Góp
          </button>
        </div>
      </div>

      {/* Hero Community Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(7, 13, 30, 0.95) 0%, rgba(12, 28, 48, 0.95) 100%)',
          border: '1px solid var(--color-border)',
          borderRadius: 24,
          padding: '28px 32px',
          marginBottom: 28,
          boxShadow: 'var(--shadow-card)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(5, 150, 105, 0.14)', border: '1px solid rgba(5, 150, 105, 0.3)', padding: '3px 10px', borderRadius: 16, fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-primary)', marginBottom: 10 }}>
          <IconSparkles size={13} color="var(--color-primary)" />
          ALPINE COMMUNITY HUB 24/7
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--color-text-main)', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
          Trung Tâm Cộng Đồng & Vô Tuyến Thực Địa
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', maxWidth: 840, lineHeight: 1.6, margin: '0 0 18px 0' }}>
          Không gian kết nối trực tuyến của cộng đồng Trekker Việt Nam: Thảo luận kinh nghiệm cung đường, đàm thoại thực địa và tải xuống tracklog GPX chuẩn GPS.
        </p>

        {/* Search Bar & Peak Pills inside Banner */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Keyword Search Input */}
          <div style={{ position: 'relative', maxWidth: 640 }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-dim)' }}>
              <IconSearch size={16} />
            </span>
            <input
              type="text"
              className="form-input"
              placeholder="Tìm kiếm bài viết, kinh nghiệm leo núi, trạm kiểm lâm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 40px',
                borderRadius: 14,
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                fontSize: '0.86rem',
              }}
            />
          </div>

          {/* Mountain Peak Selection Pills */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {POPULAR_PEAKS.map((peak) => {
              const isSelected = selectedPeak === peak.id;
              return (
                <button
                  key={peak.id}
                  type="button"
                  onClick={() => setSelectedPeak(peak.id)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 12,
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--color-primary)' : 'var(--color-bg-card)',
                    color: isSelected ? '#041108' : 'var(--color-text-muted)',
                    border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {peak.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 1: CENTERED REAL-TIME EXPEDITION HUB (3 COLUMNS WITH CHATROOM AT CENTER STAGE) */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr) 300px', gap: 20, alignItems: 'stretch' }}>
          {/* Left Sub-Widget: GPX Tracklog Downloads & Safety Handbook */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              className="card"
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 20,
                padding: '18px 20px',
                boxShadow: 'var(--shadow-card)',
                flex: 1,
              }}
            >
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconFileText size={16} color="var(--color-primary)" />
                Kho Tracklog GPX Thật 100%
              </h3>
              <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', lineHeight: 1.45, margin: '0 0 12px 0' }}>
                Tải file GPX chuẩn tọa độ GPS thực địa nạp vào điện thoại/Garmin để điều hướng an toàn offline:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { id: 'trail-laothan', name: 'Lảo Thẩn Y Tý (2.860m)', dist: '16.0 km' },
                  { id: 'trail-fansipan', name: 'Fansipan Trạm Tôn (3.143m)', dist: '22.4 km' },
                  { id: 'trail-kyquansan', name: 'Kỳ Quan San (3.046m)', dist: '30.0 km' },
                  { id: 'trail-putaleng', name: 'Pu Ta Leng (3.049m)', dist: '34.0 km' },
                  { id: 'trail-taxua', name: 'Tà Xùa Mỏm Cá Heo', dist: '18.5 km' },
                ].map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 10,
                      padding: '7px 10px',
                      fontSize: '0.74rem',
                    }}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>
                      <div style={{ fontWeight: 800, color: 'var(--color-text-main)', textOverflow: 'ellipsis', overflow: 'hidden' }}>{item.name}</div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--color-sky)', marginTop: 1 }}>{item.dist}</div>
                    </div>
                    <a
                      href={`/api/forum/gpx/${item.id}`}
                      download={`${item.id}.gpx`}
                      className="btn btn-outline interactive-click"
                      style={{ padding: '4px 8px', borderRadius: 8, fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                    >
                      <IconDownload size={12} color="var(--color-primary)" />
                      <span>Tải</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Safety Rule Banner */}
            <div
              style={{
                background: 'rgba(5, 150, 105, 0.08)',
                border: '1px solid rgba(5, 150, 105, 0.25)',
                borderRadius: 16,
                padding: '12px 14px',
                fontSize: '0.74rem',
                color: 'var(--color-text-muted)',
                lineHeight: 1.45,
              }}
            >
              <div style={{ fontWeight: 800, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <IconShieldCheck size={14} color="var(--color-primary)" />
                Nguyên Tắc An Toàn
              </div>
              Luôn mang tối thiểu 1.5L nước, sạc dự phòng, đèn pin đội đầu và gậy trekking khi vào rừng.
            </div>
          </div>

          {/* Center Stage: MAIN LIVE CHATROOM (PROMINENT & SPACIOUS) */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <LiveTrekkerChatroom
              currentUser={currentUser}
              onRequireLogin={onRequireLogin}
            />
          </div>

          {/* Right Sub-Widget: Top Trekkers & Basecamp Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              className="card"
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 20,
                padding: '18px 20px',
                boxShadow: 'var(--shadow-card)',
                flex: 1,
              }}
            >
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconUsers size={16} color="var(--color-sky)" />
                Top Thành Viên Uy Tín
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topTrekkers.length === 0 ? (
                  <div style={{ fontSize: '0.76rem', color: 'var(--color-text-dim)', textAlign: 'center', padding: '12px 0' }}>
                    Chưa có dữ liệu thành viên
                  </div>
                ) : (
                  topTrekkers.map((user, idx) => (
                    <div
                      key={user._id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 0',
                        borderBottom: idx < topTrekkers.length - 1 ? '1px solid var(--color-border)' : 'none',
                      }}
                    >
                      <img
                        src={user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}
                        alt={user.fullName}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          border: '1.5px solid var(--color-primary)',
                          objectFit: 'cover',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {user.fullName}
                        </div>
                        <div style={{ fontSize: '0.66rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                          ★ {user.reputationScore} Điểm uy tín
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Basecamp Telemetry Info */}
            <div
              style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: 16,
                padding: '12px 14px',
                fontSize: '0.74rem',
                color: 'var(--color-text-muted)',
                lineHeight: 1.45,
              }}
            >
              <div style={{ fontWeight: 800, color: 'var(--color-sky)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <IconRadio size={14} color="var(--color-sky)" />
                Trạm Vô Tuyến 4G
              </div>
              Hệ thống kết nối trực tiếp với 100 trạm kiểm lâm và cứu hộ Hoàng Liên Sơn - Tây Bắc.
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: FULL-WIDTH EXPEDITION FEED & COMMUNITY FORUM */}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 32 }}>
        <AlpineExpeditionFeed
          threads={filteredThreads}
          onOpenNewThreadModal={() => {
            const token = localStorage.getItem('trekmap_token');
            if (!currentUser && !token) {
              if (onRequireLogin) {
                onRequireLogin('tạo bài nhật ký mới trên diễn đàn');
              } else if (onShowToast) {
                onShowToast('Vui lòng đăng nhập để tạo bài nhật ký mới trên diễn đàn!', 'info');
              }
              return;
            }
            setIsNewThreadOpen(true);
          }}
        />
      </div>

      {/* Create New Thread Modal */}
      {isNewThreadOpen && (
        <div className="modal-overlay" onClick={() => setIsNewThreadOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 22,
              padding: '28px 30px',
              maxWidth: 560,
              width: '100%',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <h3 style={{ fontSize: '1.25rem', color: 'var(--color-text-main)', fontWeight: 800, margin: '0 0 18px 0' }}>
              Viết Bài Đóng Góp Nhật Ký Băng Rừng
            </h3>

            <form onSubmit={handleCreateThread}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--color-text-main)' }}>
                  Tiêu đề nhật ký / câu hỏi
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Cẩm nang leo Lảo Thẩn 2N1Đ săn mây tự túc mới nhất"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: '0.84rem' }}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--color-text-main)' }}>
                  Chuyên mục
                </label>
                <select
                  className="form-select"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: '0.84rem', background: 'var(--color-bg-main)', color: 'var(--color-text-main)', border: '1px solid var(--color-border)' }}
                >
                  <option value="Kinh Nghiệm">Cẩm nang & Kinh nghiệm</option>
                  <option value="Hỏi Đáp">Hỏi đáp kỹ thuật</option>
                  <option value="Tìm Đồng Đội">Ghép đoàn & Tìm bạn</option>
                  <option value="Cảnh Báo">Radar cảnh báo an toàn</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--color-text-main)' }}>
                  Nội dung chi tiết
                </label>
                <textarea
                  className="form-textarea"
                  rows={6}
                  placeholder="Nhập nội dung chia sẻ trải nghiệm thực tế, lộ trình hoặc câu hỏi của bạn..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: '0.84rem' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-outline interactive-click"
                  onClick={() => setIsNewThreadOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: 10, fontSize: '0.82rem' }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn btn-primary interactive-click ripple-fx"
                  style={{ padding: '8px 20px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <IconSend size={15} color="#041108" />
                  Đăng Bài Ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
