import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ForumThread, Trail, UserProfile } from '../../types.js';
import {
  IconArrowLeft,
  IconPlus,
  IconDownload,
  IconSend,
  IconCamera,
  IconImage,
  IconX,
  IconStar,
} from '../common/SvgIcons.js';
import { uploadImageToCloudinary } from '../../services/api.js';
import { AlpineExpeditionFeed } from './AlpineExpeditionFeed.js';
import { LiveTrekkerChatroom } from './LiveTrekkerChatroom.js';
import { SummitAltitudeLadder } from '../landing/SummitAltitudeLadder.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { useSocket } from '../../hooks/useSocket.js';
import { useFocusTrap, isTopmostFocusTrap } from '../../hooks/useFocusTrap.js';

interface TopTrekker {
  _id: string;
  fullName: string;
  avatarUrl?: string;
  reputationScore: number;
  badges?: string[];
  role?: string;
}

interface TrekForumViewProps {
  onBack?: () => void;
  isEmbedded?: boolean;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  currentUser?: (UserProfile & { _id?: string; avatar?: string }) | null;
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
  const [loadingThreads, setLoadingThreads] = useState<boolean>(true);
  const [topTrekkers, setTopTrekkers] = useState<TopTrekker[]>([]);
  const [isNewThreadOpen, setIsNewThreadOpen] = useState(false);
  const { socket } = useSocket();

  // New Thread Form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'Hỏi Đáp' | 'Kinh Nghiệm' | 'Tìm Đồng Đội' | 'Cảnh Báo'>('Kinh Nghiệm');
  const [newContent, setNewContent] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isSubmittingThread, setIsSubmittingThread] = useState(false);
  const newThreadDialogRef = useRef<HTMLDivElement | null>(null);

  // LIFO Focus Trap for New Thread modal
  useFocusTrap(isNewThreadOpen, newThreadDialogRef);

  // LIFO Escape key close for New Thread modal (blocked during IME or active submit)
  useEffect(() => {
    if (!isNewThreadOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (!isTopmostFocusTrap(newThreadDialogRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!isSubmittingThread) {
          setIsNewThreadOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNewThreadOpen, isSubmittingThread]);

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
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
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

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/forum', {
      headers: getApiHeaders(),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted && data.success && Array.isArray(data.data)) {
          setThreads(data.data);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error('Failed to load forum threads', err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingThreads(false);
        }
      });

    fetch('/api/forum/top-trekkers', { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted && data.success && Array.isArray(data.data)) {
          setTopTrekkers(data.data);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error('Failed to load top trekkers', err);
        }
      });

    return () => controller.abort();
  }, []);

  // Real-time socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewComment = (data: { threadId?: string; repliesCount?: number }) => {
      setThreads((prev) =>
        prev.map((t) =>
          String(t.id) === String(data.threadId)
            ? { ...t, repliesCount: data.repliesCount !== undefined ? data.repliesCount : t.repliesCount + 1 }
            : t
        )
      );
    };

    const handleThreadReaction = (data: {
      threadId?: string;
      upvotes?: number;
      reactions?: ForumThread['reactions'];
    }) => {
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
    if (isSubmittingThread) return;
    const token = localStorage.getItem('lost_token');
    if (!currentUser && !token) {
      if (onRequireLogin) onRequireLogin('đăng bài thảo luận mới');
      else window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
      return;
    }
    if (!newTitle.trim() || !newContent.trim()) return;

    setIsSubmittingThread(true);
    try {
      const uploadedImages: string[] = [];
      for (let i = 0; i < newImages.length; i++) {
        const img = newImages[i];
        if (img.startsWith('data:image/')) {
          try {
            const cloudUrl = await uploadImageToCloudinary(img, `forum_${Date.now()}_${i}.jpg`, 'forum');
            uploadedImages.push(cloudUrl);
          } catch {
            if (onShowToast) {
              onShowToast(`Không thể tải ảnh #${i + 1} lên máy chủ ảnh.`, 'error');
            }
          }
        } else {
          uploadedImages.push(img);
        }
      }

      const res = await fetch('/api/forum', {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title: newTitle.trim(),
          category: newCategory,
          content: newContent.trim(),
          images: uploadedImages,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setThreads((prev) => [data.data, ...prev]);
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
    } catch {
      if (onShowToast) onShowToast('Không thể kết nối máy chủ', 'error');
    } finally {
      setIsSubmittingThread(false);
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
              type="button"
              className="btn btn-outline interactive-click"
              onClick={onBack}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 4 }}
            >
              <IconArrowLeft size={16} /> Quay lại trang chủ
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary interactive-click"
              onClick={() => {
                const token = localStorage.getItem('lost_token');
                if (!currentUser && !token) {
                  if (onRequireLogin) {
                    onRequireLogin('tạo bài nhật ký mới trên diễn đàn');
                  } else {
                    if (onShowToast) onShowToast('Vui lòng đăng nhập để tạo bài nhật ký mới trên diễn đàn!', 'info');
                    window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
                  }
                  return;
                }
                setIsNewThreadOpen(true);
              }}
              style={{
                padding: '9px 18px',
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 800,
              }}
            >
              <IconPlus size={16} color="var(--color-on-primary)" /> Viết Bài Đóng Góp
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
            isLoadingThreads={loadingThreads}
            currentUser={currentUser}
            onOpenNewThreadModal={() => {
              const token = localStorage.getItem('lost_token');
              if (!currentUser && !token) {
                if (onRequireLogin) {
                  onRequireLogin('tạo bài nhật ký mới trên diễn đàn');
                } else {
                  if (onShowToast) onShowToast('Vui lòng đăng nhập để tạo bài nhật ký mới trên diễn đàn!', 'info');
                  window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
                }
                return;
              }
              setIsNewThreadOpen(true);
            }}
          />
        </div>

        {/* RIGHT TACTICAL SIDEBAR: ALTITUDE LADDER, GPX VAULT, TOP TREKKERS */}
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
              borderRadius: 4,
              padding: '18px 20px',
            }}
          >
            <div className="section-eyebrow" style={{ marginBottom: 4 }}>Tài nguyên GPS</div>
            <h3 className="font-editorial" style={{ fontSize: '1.18rem', fontWeight: 500, color: 'var(--color-text-main)', margin: '0 0 6px 0' }}>
              Kho Tracklog GPX Thực Địa
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: '0 0 12px 0' }}>
              Tải tệp GPX chuẩn tọa độ thực địa để nạp vào điện thoại / Garmin điều hướng offline:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                    borderRadius: 4,
                    padding: '7px 10px',
                    fontSize: '0.74rem',
                  }}
                >
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
                    <div style={{ fontWeight: 700, color: 'var(--color-text-main)', textOverflow: 'ellipsis', overflow: 'hidden' }}>{item.name}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{item.dist}</div>
                  </div>
                  <a
                    href={`/api/forum/gpx/${item.id}`}
                    download={`${item.id}.gpx`}
                    className="btn btn-outline"
                    style={{ padding: '4px 8px', borderRadius: 4, fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
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
              borderRadius: 4,
              padding: '18px 20px',
            }}
          >
            <div className="section-eyebrow" style={{ marginBottom: 4 }}>Cộng đồng</div>
            <h3 className="font-editorial" style={{ fontSize: '1.18rem', fontWeight: 500, color: 'var(--color-text-main)', margin: '0 0 10px 0' }}>
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
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.fullName}
                        referrerPolicy="no-referrer"
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          border: '1.5px solid var(--color-primary)',
                          objectFit: 'cover',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
                          border: '1px solid var(--color-primary)',
                          color: 'var(--color-primary)',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {(user.fullName || 'T').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user.fullName}
                      </div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--color-primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <IconStar size={10} color="var(--color-primary)" fill="var(--color-primary)" />
                        <span>{user.reputationScore} Điểm uy tín</span>
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
          onClick={() => {
            if (!isSubmittingThread) setIsNewThreadOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--overlay-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 'var(--z-modal, 3000)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
            boxSizing: 'border-box',
            overflowY: 'auto',
          }}
        >
          <div
            ref={newThreadDialogRef}
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-label="Viết bài đóng góp nhật ký băng rừng"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 6,
              padding: '24px 26px',
              maxWidth: 580,
              width: '100%',
              maxHeight: 'min(86vh, 720px)',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-3d)',
              position: 'relative',
              margin: 0,
              outline: 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="font-editorial" style={{ fontSize: '1.35rem', color: 'var(--color-text-main)', fontWeight: 600, margin: 0 }}>
                Viết Bài Đóng Góp Nhật Ký Băng Rừng
              </h3>
              <button
                type="button"
                disabled={isSubmittingThread}
                onClick={() => {
                  if (!isSubmittingThread) setIsNewThreadOpen(false);
                }}
                aria-label="Đóng cửa sổ"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: isSubmittingThread ? 'not-allowed' : 'pointer',
                  opacity: isSubmittingThread ? 0.5 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: 4,
                }}
                title="Đóng cửa sổ (Esc)"
              >
                <IconX size={18} />
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
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 4, fontSize: '0.84rem' }}
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
                  onChange={(e) => setNewCategory(e.target.value as ForumThread['category'])}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 4, fontSize: '0.84rem', background: 'var(--color-bg-main)', color: 'var(--color-text-main)', border: '1px solid var(--color-border)' }}
                >
                  <option value="Kinh Nghiệm">Cẩm nang &amp; Kinh nghiệm</option>
                  <option value="Hỏi Đáp">Hỏi đáp kỹ thuật</option>
                  <option value="Tìm Đồng Đội">Ghép đoàn &amp; Tìm bạn</option>
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
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 4, fontSize: '0.84rem' }}
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
                          borderRadius: 4,
                          overflow: 'hidden',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-bg-main)',
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
                          aria-label="Xóa ảnh này"
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            width: 22,
                            height: 22,
                            borderRadius: 4,
                            background: 'var(--overlay-bg)',
                            border: '1px solid var(--color-border-strong)',
                            color: 'var(--color-on-media)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                          title="Xóa ảnh này"
                        >
                          <IconX size={12} color="var(--color-on-media)" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Công cụ thêm ảnh: Tải từ máy tính & Nhập Link */}
                {newImages.length < 8 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 14px',
                          borderRadius: 4,
                          background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                          border: '1px dashed var(--color-primary)',
                          color: 'var(--color-primary)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
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

                      <div style={{ display: 'flex', flex: 1, minWidth: 200, gap: 6 }}>
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
                          style={{ flex: 1, padding: '7px 10px', borderRadius: 4, fontSize: '0.78rem' }}
                        />
                        <button
                          type="button"
                          onClick={handleAddImageUrl}
                          className="btn btn-outline"
                          style={{ padding: '7px 12px', borderRadius: 4, fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}
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
                  disabled={isSubmittingThread}
                  className="btn btn-outline interactive-click"
                  onClick={() => {
                    if (!isSubmittingThread) setIsNewThreadOpen(false);
                  }}
                  style={{ padding: '8px 16px', borderRadius: 4, fontSize: '0.82rem' }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingThread}
                  className="btn btn-primary interactive-click"
                  style={{ padding: '8px 20px', borderRadius: 4, fontSize: '0.82rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: isSubmittingThread ? 0.65 : 1 }}
                >
                  <IconSend size={15} color="var(--color-on-primary)" />
                  {isSubmittingThread ? 'Đang đăng bài...' : 'Đăng Bài Ngay'}
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
