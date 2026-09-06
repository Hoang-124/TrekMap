import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { ForumThread, Trail } from '../../types.js';
import {
  IconArrowLeft,
  IconPlus,
  IconDownload,
  IconFileText,
  IconSend,
  IconUsers,
  IconCamera,
  IconImage,
} from '../common/SvgIcons.js';
import { AlpineExpeditionFeed } from './AlpineExpeditionFeed.js';
import { LiveTrekkerChatroom } from './LiveTrekkerChatroom.js';
import { SummitAltitudeLadder } from '../landing/SummitAltitudeLadder.js';
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
  onBack?: () => void;
  isEmbedded?: boolean;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  currentUser?: any;
  onRequireLogin?: (actionName: string) => void;
  trails?: Trail[];
  onSelectTrail?: (trail: Trail) => void;
}

export const TrekForumView: React.FC<TrekForumViewProps> = ({
  onBack,
  isEmbedded = false,
  onShowToast,
  currentUser,
  onRequireLogin,
  trails,
  onSelectTrail,
}) => {
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [topTrekkers, setTopTrekkers] = useState<TopTrekker[]>([]);
  const [isNewThreadOpen, setIsNewThreadOpen] = useState(false);
  const { socket } = useSocket();

  // New Thread Form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'Hỏi Đáp' | 'Kinh Nghiệm' | 'Tìm Đồng Đội' | 'Cảnh Báo'>('Kinh Nghiệm');
  const [newContent, setNewContent] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');

  const handleImageFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (newImages.length + files.length > 8) {
      if (onShowToast) onShowToast('Bạn có thể đính kèm tối đa 8 hình ảnh thực tế.', 'info');
    }

    const availableSlots = 8 - newImages.length;
    const filesToProcess = Array.from(files).slice(0, availableSlots);

    filesToProcess.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        if (onShowToast) onShowToast('Chỉ chấp nhận định dạng ảnh (JPG, PNG, WebP).', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        if (onShowToast) onShowToast('Kích thước ảnh tối đa 5MB.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1280;
            const scale = Math.min(1, MAX_WIDTH / img.width);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              const compressed = canvas.toDataURL('image/jpeg', 0.82);
              setNewImages((prev) => (prev.length < 8 ? [...prev, compressed] : prev));
            } else {
              setNewImages((prev) => (prev.length < 8 ? [...prev, result] : prev));
            }
          };
          img.src = result;
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleAddImageUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:image')) {
      if (onShowToast) onShowToast('Vui lòng nhập đường link ảnh hợp lệ (https://...)', 'error');
      return;
    }
    if (newImages.length >= 8) {
      if (onShowToast) onShowToast('Bạn có thể đính kèm tối đa 8 hình ảnh.', 'info');
      return;
    }
    setNewImages((prev) => [...prev, trimmed]);
    setImageUrlInput('');
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setNewImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

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
          images: newImages,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setThreads([data.data, ...threads]);
        setIsNewThreadOpen(false);
        setNewTitle('');
        setNewContent('');
        setNewImages([]);
        setImageUrlInput('');
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

  return (
    <section
      id="forum-section"
      style={{
        maxWidth: 1320,
        margin: isEmbedded ? '20px auto 0 auto' : '0 auto',
        padding: isEmbedded ? '0' : '24px 20px 40px',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Top Header & Actions Bar */}
      {!isEmbedded && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          {onBack && (
            <button
              className="btn btn-outline interactive-click"
              onClick={onBack}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 12 }}
            >
              <IconArrowLeft size={16} /> Quay lại trang chủ
            </button>
          )}

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
      )}

      {/* MODULAR BENTO 2-COLUMN CO-EXISTENCE MASTER GRID */}
      <div className="bento-master-grid" style={{ marginBottom: 0 }}>
        {/* LEFT COLUMN: LIVE FIELD RADIO & ACTIVE COMMUNITY FEED */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, minWidth: 0 }}>
          {/* 1. Live Trekker Basecamp Radio & Chatroom */}
          <LiveTrekkerChatroom
            currentUser={currentUser}
            onRequireLogin={onRequireLogin}
          />

          {/* 2. Full Alpine Expedition Feed & Discussions */}
          <AlpineExpeditionFeed
            threads={threads}
            currentUser={currentUser}
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

        {/* RIGHT TACTICAL SIDEBAR: ALTITUDE LADDER, GPX VAULT, TOP TREKKERS & SAFETY */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'sticky', top: 80 }}>
          {/* 1. Compact Summit Altitude Ladder Widget */}
          <SummitAltitudeLadder
            trails={trails || []}
            compact={true}
            onSelectTrail={onSelectTrail}
          />

          {/* 2. Kho Tracklog GPX 100% Thực Địa */}
          <div
            className="card"
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 20,
              padding: '18px 20px',
              boxShadow: 'var(--shadow-card)',
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
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
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

          {/* 3. Top Thành Viên Uy Tín */}
          <div
            className="card"
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 20,
              padding: '18px 20px',
              boxShadow: 'var(--shadow-card)',
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
        </div>
      </div>

      {/* Create New Thread Modal */}
      {isNewThreadOpen && createPortal(
        <div
          className="modal-overlay"
          onClick={() => setIsNewThreadOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(3, 8, 14, 0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            zIndex: 99999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
            boxSizing: 'border-box',
            overflowY: 'auto',
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-card)',
              border: '1.5px solid var(--color-border)',
              borderRadius: 22,
              padding: '26px 28px',
              maxWidth: 580,
              width: '100%',
              maxHeight: 'min(86vh, 720px)',
              overflowY: 'auto',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(5, 150, 105, 0.18)',
              position: 'relative',
              zIndex: 100000000,
              margin: 0,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--color-text-main)', fontWeight: 800, margin: 0 }}>
                Viết Bài Đóng Góp Nhật Ký Băng Rừng
              </h3>
              <button
                type="button"
                onClick={() => setIsNewThreadOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '1.1rem', padding: 4 }}
                title="Đóng cửa sổ"
              >
                ✕
              </button>
            </div>

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

              {/* Hình ảnh thực tế từ chuyến đi (Tối đa 8 ảnh) */}
              <div className="form-group" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-main)' }}>
                    <IconCamera size={16} color="var(--color-primary)" />
                    Hình ảnh thực tế từ chuyến đi
                  </label>
                  <span style={{ fontSize: '0.74rem', color: newImages.length >= 8 ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: 600 }}>
                    {newImages.length}/8 ảnh
                  </span>
                </div>

                {/* Danh sách ảnh đã chọn */}
                {newImages.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(95px, 1fr))', gap: 10, marginBottom: 12 }}>
                    {newImages.map((imgSrc, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          height: 75,
                          borderRadius: 12,
                          overflow: 'hidden',
                          border: '1.5px solid var(--color-border)',
                          background: '#040b12',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                        }}
                      >
                        <img
                          src={imgSrc}
                          alt={`Ảnh đính kèm ${idx + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: 'rgba(0, 0, 0, 0.75)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '0.7rem',
                            lineHeight: 1,
                            padding: 0,
                          }}
                          title="Xóa ảnh này"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Công cụ thêm ảnh: Tải từ máy tính & Nhập Link */}
                {newImages.length < 8 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {/* Nút Chọn Ảnh Từ Thiết Bị */}
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 14px',
                          borderRadius: 10,
                          background: 'rgba(74, 222, 128, 0.12)',
                          border: '1px dashed var(--color-primary)',
                          color: 'var(--color-primary)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <IconImage size={15} color="var(--color-primary)" />
                        <span>Tải ảnh từ máy</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageFilesChange}
                          style={{ display: 'none' }}
                        />
                      </label>

                      {/* Hoặc Nhập URL Ảnh */}
                      <div style={{ display: 'flex', flex: 1, gap: 6 }}>
                        <input
                          type="url"
                          className="form-input"
                          placeholder="Hoặc dán URL ảnh (https://...)"
                          value={imageUrlInput}
                          onChange={(e) => setImageUrlInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddImageUrl();
                            }
                          }}
                          style={{ flex: 1, padding: '7px 10px', borderRadius: 10, fontSize: '0.78rem' }}
                        />
                        <button
                          type="button"
                          onClick={handleAddImageUrl}
                          className="btn btn-outline"
                          style={{ padding: '7px 12px', borderRadius: 10, fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}
                        >
                          + Thêm
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)' }}>
                      Tối đa 8 ảnh thực tế (JPG, PNG, WebP hoặc link online) giúp nhật ký chân thật và sống động hơn.
                    </div>
                  </div>
                )}
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
        </div>,
        document.body
      )}
    </section>
  );
};
