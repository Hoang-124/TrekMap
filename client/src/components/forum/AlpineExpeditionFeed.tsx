import React, { useState, useEffect } from 'react';
import type { ForumThread } from '../../types.js';
import {
  IconMountain,
  IconMessageSquare,
  IconPlus,
  IconAlertTriangle,
  IconShieldCheck,
  IconShieldAlert,
  IconCompass,
  IconUsers,
  IconBookOpen,
  IconLightbulb,
  IconHelpCircle,
  IconSparkles,
  IconEye,
  IconRadar,
  IconUserPlus,
} from '../common/SvgIcons.js';
import { FacebookReactionPicker } from './FacebookReactionPicker.js';
import type { ReactionType } from './FacebookReactionPicker.js';
import { AuthorProfileModal } from './AuthorProfileModal.js';
import type { AuthorProfileData } from './AuthorProfileModal.js';
import { ThreadDetailModal } from './ThreadDetailModal.js';
import { getApiHeaders, notifyForumUpdated } from '../../utils/sessionHeaders.js';
import { TripPlanCard } from '../trips/TripPlanCard.js';
import type { TripPlanItem } from '../trips/TripPlanCard.js';
import { CreateTripModal } from '../trips/CreateTripModal.js';
import { CreateTripReportModal } from '../trip-reports/CreateTripReportModal.js';
import { TripReportCard } from '../trip-reports/TripReportCard.js';
import type { TripReportItem } from '../trip-reports/TripReportCard.js';
import type { UserProfile } from '../../types.js';

interface AlpineExpeditionFeedProps {
  threads: ForumThread[];
  currentUser?: UserProfile | null;
  onOpenNewThreadModal: () => void;
}

export const AlpineExpeditionFeed: React.FC<AlpineExpeditionFeedProps> = ({
  threads,
  currentUser,
  onOpenNewThreadModal,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [trips, setTrips] = useState<TripPlanItem[]>([]);
  const [tripReports, setTripReports] = useState<TripReportItem[]>([]);
  const [isCreateTripOpen, setIsCreateTripOpen] = useState(false);
  const [isCreateReportOpen, setIsCreateReportOpen] = useState(false);

  // Modals state
  const [activeAuthor, setActiveAuthor] = useState<AuthorProfileData | null>(null);
  const [activeThread, setActiveThread] = useState<ForumThread | null>(null);

  // Per thread reaction state map
  const [threadReactions, setThreadReactions] = useState<{ [threadId: string]: ReactionType }>({});
  const [threadCommentCounts, setThreadCommentCounts] = useState<{ [threadId: string]: number }>({});
  const [threadUpvotesMap, setThreadUpvotesMap] = useState<{ [threadId: string]: number }>({});
  const [threadReactionsSummaryMap, setThreadReactionsSummaryMap] = useState<{ [threadId: string]: Record<string, number> }>({});

  const loadTrips = async () => {
    try {
      const res = await fetch('/api/trips');
      const data = await res.json();
      if (data.success) setTrips(data.data || []);
    } catch (err) {}
  };

  const loadTripReports = async () => {
    try {
      const res = await fetch('/api/trip-reports');
      const data = await res.json();
      if (data.success) setTripReports(data.data || []);
    } catch (err) {}
  };

  useEffect(() => {
    if (selectedCategory === 'Ghép Đoàn') loadTrips();
    if (selectedCategory === 'Nhật Ký') loadTripReports();
  }, [selectedCategory]);

  useEffect(() => {
    const initialMap: Record<string, ReactionType> = {};
    const initialSummaryMap: Record<string, Record<string, number>> = {};
    threads.forEach((t) => {
      initialMap[t.id] = (t as any).userReaction || null;
      if (t.reactions) {
        initialSummaryMap[t.id] = t.reactions;
      }
    });
    setThreadReactions(initialMap);
    setThreadReactionsSummaryMap(initialSummaryMap);

    // Auto-open target thread from URL query param (e.g. ?threadId=...)
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('threadId');
    if (targetId && threads.length > 0) {
      const target = threads.find((t) => String(t.id) === String(targetId));
      if (target) {
        setActiveThread(target);
      }
    }
  }, [threads]);

  // Global event sync across tabs / pages
  useEffect(() => {
    const handleGlobalUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.threadId) {
        if (detail.userReaction !== undefined) {
          setThreadReactions((prev) => ({ ...prev, [detail.threadId]: detail.userReaction }));
        }
        if (detail.reactionsSummary) {
          setThreadReactionsSummaryMap((prev) => ({ ...prev, [detail.threadId]: detail.reactionsSummary }));
        }
        if (detail.upvotes !== undefined) {
          setThreadUpvotesMap((prev) => ({ ...prev, [detail.threadId]: detail.upvotes }));
        }
      }
    };
    window.addEventListener('trekmap:forum-updated', handleGlobalUpdate);
    return () => window.removeEventListener('trekmap:forum-updated', handleGlobalUpdate);
  }, []);

  const filtered = selectedCategory === 'All'
    ? threads
    : threads.filter((t) => t.category === selectedCategory);

  const handleToggleReaction = async (threadId: string, reaction: ReactionType) => {
    const prev = threadReactions[threadId] !== undefined
      ? threadReactions[threadId]
      : ((threads.find((t) => t.id === threadId) as any)?.userReaction || null);

    const next = prev === reaction ? null : reaction;

    // Instant optimistic update for user reaction
    setThreadReactions((prevMap) => ({ ...prevMap, [threadId]: next }));

    // Instant optimistic update for reaction summary map
    const targetThread = threads.find((t) => t.id === threadId);
    const prevSummary: Record<string, number> = {
      ...(threadReactionsSummaryMap[threadId] || targetThread?.reactions || { like: 0, dislike: 0, haha: 0, wow: 0, buon: 0, huhu: 0, angry: 0 }),
    };

    if (prev && prevSummary[prev] !== undefined) {
      prevSummary[prev] = Math.max(0, prevSummary[prev] - 1);
    }
    if (next && prevSummary[next] !== undefined) {
      prevSummary[next] = (prevSummary[next] || 0) + 1;
    }

    setThreadReactionsSummaryMap((prevMap) => ({ ...prevMap, [threadId]: prevSummary }));

    try {
      const res = await fetch(`/api/forum/threads/${threadId}/reaction`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reactionType: reaction, previousReaction: prev }),
      });
      const json = await res.json();
      if (json.success && json.upvotes !== undefined) {
        setThreadUpvotesMap((prevMap) => ({ ...prevMap, [threadId]: json.upvotes }));
        if (json.userReaction !== undefined) {
          setThreadReactions((prevMap) => ({ ...prevMap, [threadId]: json.userReaction }));
        }
        if (json.data) {
          setThreadReactionsSummaryMap((prevMap) => ({ ...prevMap, [threadId]: json.data }));
        }
        notifyForumUpdated({ threadId, userReaction: json.userReaction, reactionsSummary: json.data, upvotes: json.upvotes });
      }
    } catch (err) {
      console.error('[Feed Reaction Error]:', err);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Gần đây';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const diffHours = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60));
      if (diffHours < 1) return 'Vừa xong';
      if (diffHours < 24) return `${diffHours} giờ trước`;
      if (diffHours < 48) return 'Hôm qua';
      return d.toLocaleDateString('vi-VN');
    } catch {
      return 'Gần đây';
    }
  };

  const CATEGORY_ITEMS = [
    { name: 'All', label: 'Tất cả diễn đàn', Icon: IconCompass },
    { name: 'Ghép Đoàn', label: 'Ghép đoàn & Tìm bạn', Icon: IconUsers },
    { name: 'Nhật Ký', label: 'Nhật ký chuyến đi', Icon: IconBookOpen },
    { name: 'Kinh Nghiệm', label: 'Cẩm nang & Kinh nghiệm', Icon: IconLightbulb },
    { name: 'Hỏi Đáp', label: 'Hỏi đáp kỹ thuật', Icon: IconHelpCircle },
    { name: 'Cảnh Báo', label: 'Radar an toàn', Icon: IconShieldAlert },
  ];

  return (
    <div style={{ marginBottom: 48 }}>
      {/* Author Profile Modal */}
      <AuthorProfileModal
        author={activeAuthor}
        currentUser={currentUser}
        onClose={() => setActiveAuthor(null)}
      />

      {/* Thread Detail & Comments Modal */}
      <ThreadDetailModal
        thread={activeThread}
        currentUser={currentUser}
        onClose={() => setActiveThread(null)}
        onOpenAuthorProfile={(auth) => setActiveAuthor({
          name: auth.name,
          avatar: auth.avatar,
          userId: auth.userId || activeThread?.userId,
        })}
        onUpdateThreadUpvotes={(tId, upvotes) => setThreadUpvotesMap((prev) => ({ ...prev, [tId]: upvotes }))}
        onUpdateCommentCount={(threadId, count) => setThreadCommentCounts((prev) => ({ ...prev, [threadId]: count }))}
        onUpdateThreadReaction={(tId, r, summary, u) => {
          setThreadReactions((prev) => ({ ...prev, [tId]: r }));
          setThreadReactionsSummaryMap((prev) => ({ ...prev, [tId]: summary }));
          setThreadUpvotesMap((prev) => ({ ...prev, [tId]: u }));
        }}
        onShowToast={(msg, type) => {
          window.dispatchEvent(new CustomEvent('trekmap:show-toast', { detail: { message: msg, type: type || 'info' } }));
        }}
      />

      {/* Modern Feed Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 12px',
              borderRadius: 16,
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              fontSize: '0.72rem',
              fontWeight: 800,
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 6,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <IconRadar size={13} color="var(--color-primary)" />
            DIỄN ĐÀN & VÔ TUYẾN THỰC ĐỊA
          </div>

          <h2
            style={{
              fontSize: 'clamp(1.4rem, 2.5vw, 1.85rem)',
              fontWeight: 900,
              color: 'var(--color-text-main)',
              margin: 0,
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <IconMountain size={24} color="var(--color-primary)" />
            Nhật Ký Băng Rừng & Radar Đường Trek
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
            Cẩm nang trải nghiệm thực tế, radar tình trạng tuyến đường và tìm đồng đội ghép đoàn từ cộng đồng Trekker.
          </p>
        </div>

        <div>
          {selectedCategory === 'Ghép Đoàn' ? (
            <button
              className="btn btn-primary interactive-click ripple-fx"
              onClick={() => {
                const token = localStorage.getItem('trekmap_token');
                if (!token) {
                  window.dispatchEvent(new CustomEvent('trekmap:show-toast', { detail: { message: 'Vui lòng đăng nhập để mở chuyến ghép đoàn!', type: 'info' } }));
                  window.location.hash = '#login';
                  return;
                }
                setIsCreateTripOpen(true);
              }}
              style={{
                borderRadius: 14,
                padding: '9px 18px',
                fontSize: '0.84rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)',
              }}
            >
              <IconUserPlus size={16} color="#041108" />
              Mở Chuyến Ghép Đoàn
            </button>
          ) : selectedCategory === 'Nhật Ký' ? (
            <button
              className="btn btn-primary interactive-click ripple-fx"
              onClick={() => {
                const token = localStorage.getItem('trekmap_token');
                if (!token) {
                  window.dispatchEvent(new CustomEvent('trekmap:show-toast', { detail: { message: 'Vui lòng đăng nhập để viết bài nhật ký chuyến đi!', type: 'info' } }));
                  window.location.hash = '#login';
                  return;
                }
                setIsCreateReportOpen(true);
              }}
              style={{
                borderRadius: 14,
                padding: '9px 18px',
                fontSize: '0.84rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)',
              }}
            >
              <IconMountain size={16} color="#041108" />
              Viết Nhật Ký Chuyến Đi
            </button>
          ) : (
            <button
              className="btn btn-primary interactive-click ripple-fx"
              onClick={() => {
                const token = localStorage.getItem('trekmap_token');
                if (!token) {
                  window.dispatchEvent(new CustomEvent('trekmap:show-toast', { detail: { message: 'Vui lòng đăng nhập để tạo bài thảo luận mới trên diễn đàn!', type: 'info' } }));
                  window.location.hash = '#login';
                  return;
                }
                onOpenNewThreadModal();
              }}
              style={{
                borderRadius: 14,
                padding: '9px 18px',
                fontSize: '0.84rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)',
              }}
            >
              <IconPlus size={16} color="#041108" />
              Viết Bài Đóng Góp
            </button>
          )}
        </div>
      </div>

      <CreateTripModal
        isOpen={isCreateTripOpen}
        onClose={() => setIsCreateTripOpen(false)}
        onSuccess={loadTrips}
      />

      <CreateTripReportModal
        isOpen={isCreateReportOpen}
        onClose={() => setIsCreateReportOpen(false)}
        onSuccess={loadTripReports}
      />

      {/* Category Filter Pills (Refined Glassmorphism Bar) */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 22,
          padding: '6px',
          background: 'var(--color-bg-card)',
          borderRadius: 16,
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {CATEGORY_ITEMS.map((item) => {
          const isActive = selectedCategory === item.name;
          const isWarning = item.name === 'Cảnh Báo';
          const ItemIcon = item.Icon;

          return (
            <button
              key={item.name}
              type="button"
              onClick={() => setSelectedCategory(item.name)}
              className="interactive-click"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 16px',
                borderRadius: 12,
                fontSize: '0.82rem',
                fontWeight: isActive ? 800 : 600,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                border: isActive
                  ? isWarning
                    ? '1.5px solid var(--color-error)'
                    : '1.5px solid var(--color-primary)'
                  : '1px solid transparent',
                background: isActive
                  ? isWarning
                    ? 'rgba(239, 68, 68, 0.16)'
                    : 'rgba(5, 150, 105, 0.16)'
                  : 'transparent',
                color: isActive
                  ? isWarning
                    ? 'var(--color-error)'
                    : 'var(--color-primary)'
                  : isWarning
                  ? 'var(--color-error)'
                  : 'var(--color-text-muted)',
                boxShadow: isActive
                  ? isWarning
                    ? '0 0 14px rgba(239, 68, 68, 0.25)'
                    : '0 0 14px rgba(5, 150, 105, 0.25)'
                  : 'none',
              }}
            >
              <ItemIcon
                size={15}
                color={
                  isActive
                    ? isWarning
                      ? 'var(--color-error)'
                      : 'var(--color-primary)'
                    : isWarning
                    ? 'var(--color-error)'
                    : 'var(--color-text-dim)'
                }
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Conditional rendering for Ghép Đoàn & Nhật Ký vs Standard Threads (Smooth Slide Transition) */}
      <div key={selectedCategory} className="tab-content-slide">
        {selectedCategory === 'Ghép Đoàn' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
          {trips.length === 0 ? (
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--color-text-dim)',
                background: 'var(--color-bg-card)',
                borderRadius: 18,
                border: '1px dashed var(--color-border)',
              }}
            >
              <IconUsers size={32} color="var(--color-primary)" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.6 }} />
              <div style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 4 }}>
                Chưa có chuyến ghép đoàn nào đang mở
              </div>
              <p style={{ fontSize: '0.82rem', margin: 0 }}>
                Hãy là người đầu tiên mở chuyến đi và tìm đồng đội leo núi cùng bạn!
              </p>
            </div>
          ) : (
            trips.map((t) => <TripPlanCard key={t._id} trip={t} onJoinSuccess={loadTrips} />)
          )}
        </div>
      ) : selectedCategory === 'Nhật Ký' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
          {tripReports.length === 0 ? (
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--color-text-dim)',
                background: 'var(--color-bg-card)',
                borderRadius: 18,
                border: '1px dashed var(--color-border)',
              }}
            >
              <IconBookOpen size={32} color="var(--color-sky)" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.6 }} />
              <div style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 4 }}>
                Chưa có bài viết nhật ký chuyến đi nào
              </div>
              <p style={{ fontSize: '0.82rem', margin: 0 }}>
                Hãy bấm "Viết Bài Đóng Góp" để chia sẻ cảm nhận và hình ảnh chuyến đi của bạn!
              </p>
            </div>
          ) : (
            tripReports.map((r) => <TripReportCard key={r._id} report={r} />)
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: 'var(--color-bg-card)',
            borderRadius: 20,
            border: '1px dashed var(--color-border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <IconCompass size={38} color="var(--color-primary)" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.7 }} />
          <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '0 0 6px 0' }}>
            Chưa có bài viết nào trong chuyên mục này
          </h4>
          <p style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', margin: '0 0 18px 0', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
            Hãy là người đầu tiên chia sẻ cẩm nang thám hiểm hoặc gửi thông tin thực địa cho cộng đồng!
          </p>
          <button
            type="button"
            className="btn btn-primary interactive-click ripple-fx"
            onClick={onOpenNewThreadModal}
            style={{
              padding: '9px 18px',
              fontSize: '0.82rem',
              fontWeight: 800,
              borderRadius: 12,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <IconPlus size={15} color="#041108" />
            Viết Bài Đóng Góp Đầu Tiên
          </button>
        </div>
      ) : (
        /* Expedition Log Grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(370px, 1fr))', gap: 20 }}>
          {filtered.map((thread) => {
            const isWarning = thread.category === 'Cảnh Báo';
            const isQA = thread.category === 'Hỏi Đáp';

            return (
              <div
                key={thread.id}
                className="card interactive-click card-hover-lift"
                style={{
                  padding: '20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: 'var(--color-bg-card)',
                  border: isWarning ? '1.5px solid var(--color-error)' : '1px solid var(--color-border)',
                  borderRadius: 18,
                  boxShadow: 'var(--shadow-card)',
                  cursor: 'pointer',
                  transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative',
                  overflow: 'visible',
                }}
                onClick={() => setActiveThread(thread)}
              >
                <div>
                  {/* Header Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: 8,
                          background: isWarning
                            ? 'rgba(239, 68, 68, 0.14)'
                            : isQA
                            ? 'rgba(56, 189, 248, 0.14)'
                            : 'rgba(5, 150, 105, 0.14)',
                          color: isWarning
                            ? 'var(--color-error)'
                            : isQA
                            ? 'var(--color-sky)'
                            : 'var(--color-primary)',
                          border: `1px solid ${
                            isWarning
                              ? 'rgba(239, 68, 68, 0.3)'
                              : isQA
                              ? 'rgba(56, 189, 248, 0.3)'
                              : 'rgba(5, 150, 105, 0.3)'
                          }`,
                        }}
                      >
                        {thread.category}
                      </span>

                      {thread.isPinned && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 8,
                            background: 'rgba(245, 158, 11, 0.14)',
                            color: 'var(--color-sun)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <IconSparkles size={11} color="var(--color-sun)" />
                          Đã Ghim
                        </span>
                      )}
                    </div>

                    {/* Radar Live Chip */}
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        background: isWarning ? 'rgba(239, 68, 68, 0.12)' : 'rgba(5, 150, 105, 0.12)',
                        color: isWarning ? 'var(--color-error)' : 'var(--color-primary)',
                        border: `1px solid ${isWarning ? 'rgba(239, 68, 68, 0.25)' : 'rgba(5, 150, 105, 0.25)'}`,
                      }}
                    >
                      {isWarning ? <IconAlertTriangle size={12} color="var(--color-error)" /> : <IconShieldCheck size={12} color="var(--color-primary)" />}
                      {isWarning ? 'Radar: Cảnh báo thời tiết' : 'Radar: Tuyến an toàn'}
                    </span>
                  </div>

                  {/* Title */}
                  <h3
                    style={{
                      fontSize: '1.02rem',
                      fontWeight: 800,
                      color: 'var(--color-text-main)',
                      marginBottom: 8,
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {thread.title}
                  </h3>

                  {/* Attached Real Images Gallery Preview */}
                  {thread.images && thread.images.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      {thread.images.length === 1 && (
                        <div style={{ height: 160, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)', position: 'relative' }}>
                          <img src={thread.images[0]} alt={thread.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                      {thread.images.length === 2 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, height: 120 }}>
                          <img src={thread.images[0]} alt={thread.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10, border: '1px solid var(--color-border)' }} />
                          <img src={thread.images[1]} alt={thread.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10, border: '1px solid var(--color-border)' }} />
                        </div>
                      )}
                      {thread.images.length >= 3 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 6, height: 135 }}>
                          <img src={thread.images[0]} alt={thread.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10, border: '1px solid var(--color-border)' }} />
                          <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 6, height: '100%' }}>
                            <img src={thread.images[1]} alt={thread.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--color-border)' }} />
                            <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                              <img src={thread.images[2]} alt={thread.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              {thread.images.length > 3 && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(3, 8, 14, 0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.85rem', fontWeight: 800 }}>
                                  +{thread.images.length - 2}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Snippet Content */}
                  <p
                    style={{
                      fontSize: '0.83rem',
                      color: 'var(--color-text-muted)',
                      lineHeight: 1.55,
                      marginBottom: 16,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {thread.content}
                  </p>
                </div>

                {/* Card Footer Info */}
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', gap: 10 }}>
                    {/* Author Info */}
                    {(() => {
                      const isCurrentUserAuthor = Boolean(
                        currentUser && (
                          (thread.userId && currentUser.id && String(thread.userId) === String(currentUser.id)) ||
                          (currentUser.fullName && thread.authorName.toLowerCase().includes(currentUser.fullName.toLowerCase())) ||
                          (currentUser.username && thread.authorName.toLowerCase().includes(currentUser.username.toLowerCase()))
                        )
                      );
                      const effectiveAvatar = (isCurrentUserAuthor && (currentUser?.avatarUrl || currentUser?.avatar))
                        ? (currentUser.avatarUrl || currentUser.avatar)
                        : (thread.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80');

                      return (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveAuthor({
                              userId: thread.userId,
                              name: thread.authorName.replace(/\(.*\)/, '').trim(),
                              avatar: effectiveAvatar || '',
                              role: (isCurrentUserAuthor && currentUser) ? currentUser.role : undefined,
                              badges: (isCurrentUserAuthor && currentUser) ? currentUser.badges : undefined,
                              reputationScore: (isCurrentUserAuthor && currentUser) ? currentUser.reputationScore : undefined,
                            });
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 0 }}
                          title="Bấm để xem hồ sơ tác giả"
                        >
                          <img
                            src={effectiveAvatar}
                            alt={thread.authorName}
                            referrerPolicy="no-referrer"
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              border: '1.5px solid var(--color-primary)',
                              objectFit: 'cover',
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                color: 'var(--color-primary)',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {thread.authorName.replace(/\(.*\)/, '').trim()}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>
                              {formatDate(thread.createdAt)}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Metrics & Facebook Reaction Bar */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                      <FacebookReactionPicker
                        currentReaction={threadReactions[thread.id] !== undefined ? threadReactions[thread.id] : ((thread as any).userReaction || null)}
                        totalLikes={threadUpvotesMap[thread.id] !== undefined ? threadUpvotesMap[thread.id] : thread.upvotes}
                        reactionsSummary={threadReactionsSummaryMap[thread.id] || (thread.reactions as any)}
                        onSelectReaction={(r) => handleToggleReaction(thread.id, r)}
                      />

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveThread(thread);
                        }}
                        className="interactive-click"
                        title="Bấm để xem và viết bình luận"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          color: 'var(--color-sky)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          background: 'var(--color-bg-main)',
                          padding: '4px 9px',
                          borderRadius: 14,
                          border: '1px solid var(--color-border)',
                          cursor: 'pointer',
                          transition: 'all 0.18s ease',
                        }}
                      >
                        <IconMessageSquare size={13} color="var(--color-sky)" />
                        <span>{threadCommentCounts[thread.id] !== undefined ? threadCommentCounts[thread.id] : (thread.repliesCount || 0)}</span>
                      </button>

                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          color: 'var(--color-text-dim)',
                          fontSize: '0.76rem',
                          background: 'var(--color-bg-main)',
                          padding: '4px 8px',
                          borderRadius: 14,
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <IconEye size={13} color="var(--color-text-dim)" />
                        <span>{thread.viewsCount || 1}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
};
