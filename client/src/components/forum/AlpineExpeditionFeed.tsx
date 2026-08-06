import React, { useState, useEffect } from 'react';
import type { ForumThread } from '../../types.js';

const createSvgIcon = (d: React.ReactNode, defaultSize = 18) => {
  return ({ size = defaultSize, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      {d}
    </svg>
  );
};

const Mountain = createSvgIcon(<path d="M8 3l4 8 5-5 5 15H2L8 3z" />);
const MessageSquare = createSvgIcon(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />);
const PlusCircle = createSvgIcon(<><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></>);
const AlertTriangle = createSvgIcon(<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>);
const ShieldCheck = createSvgIcon(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></>);
import { FacebookReactionPicker } from './FacebookReactionPicker.js';
import type { ReactionType } from './FacebookReactionPicker.js';
import { AuthorProfileModal } from './AuthorProfileModal.js';
import type { AuthorProfileData } from './AuthorProfileModal.js';
import { ThreadDetailModal } from './ThreadDetailModal.js';
import { getApiHeaders, notifyForumUpdated } from '../../utils/sessionHeaders.js';
import { TripPlanCard } from '../trips/TripPlanCard.js';
import type { TripPlanItem } from '../trips/TripPlanCard.js';
import { CreateTripModal } from '../trips/CreateTripModal.js';
import { TripReportCard } from '../trip-reports/TripReportCard.js';
import type { TripReportItem } from '../trip-reports/TripReportCard.js';

interface AlpineExpeditionFeedProps {
  threads: ForumThread[];
  onOpenNewThreadModal: () => void;
}

export const AlpineExpeditionFeed: React.FC<AlpineExpeditionFeedProps> = ({
  threads,
  onOpenNewThreadModal,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [trips, setTrips] = useState<TripPlanItem[]>([]);
  const [tripReports, setTripReports] = useState<TripReportItem[]>([]);
  const [isCreateTripOpen, setIsCreateTripOpen] = useState(false);

  // Modals state
  const [activeAuthor, setActiveAuthor] = useState<AuthorProfileData | null>(null);
  const [activeThread, setActiveThread] = useState<ForumThread | null>(null);

  // Per thread reaction state map
  const [threadReactions, setThreadReactions] = useState<{ [threadId: string]: ReactionType }>({});
  // Per thread comment count map
  const [threadCommentCounts, setThreadCommentCounts] = useState<{ [threadId: string]: number }>({});
  // Per thread upvotes count map
  const [threadUpvotesMap, setThreadUpvotesMap] = useState<{ [threadId: string]: number }>({});
  // Per thread reactions summary map
  const [threadReactionsSummaryMap, setThreadReactionsSummaryMap] = useState<{ [threadId: string]: Record<string, number> }>({});

  const loadTrips = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/trips');
      const data = await res.json();
      if (data.success) setTrips(data.data || []);
    } catch (err) {}
  };

  const loadTripReports = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/trip-reports');
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
      const res = await fetch(`http://localhost:5000/api/forum/threads/${threadId}/reaction`, {
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

  return (
    <div style={{ marginBottom: 48 }}>
      {/* Author Profile Modal */}
      <AuthorProfileModal
        author={activeAuthor}
        onClose={() => setActiveAuthor(null)}
      />

      {/* Thread Detail & Comments Modal */}
      <ThreadDetailModal
        thread={activeThread}
        onClose={() => setActiveThread(null)}
        onOpenAuthorProfile={(auth) => setActiveAuthor({ name: auth.name, avatar: auth.avatar })}
        onUpdateThreadUpvotes={(tId, upvotes) => setThreadUpvotesMap((prev) => ({ ...prev, [tId]: upvotes }))}
        onUpdateCommentCount={(threadId, count) => setThreadCommentCounts((prev) => ({ ...prev, [threadId]: count }))}
        onUpdateThreadReaction={(tId, r, summary, u) => {
          setThreadReactions((prev) => ({ ...prev, [tId]: r }));
          setThreadReactionsSummaryMap((prev) => ({ ...prev, [tId]: summary }));
          setThreadUpvotesMap((prev) => ({ ...prev, [tId]: u }));
        }}
      />

      {/* Feed Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-0.3px' }}>
            <Mountain size={26} color="var(--color-primary)" /> Nhật Ký Băng Rừng & Radar Đường Trek
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
            Cẩm nang trải nghiệm thực tế, radar tình trạng tuyến đường và tìm đồng đội ghép đoàn từ cộng đồng Trekker
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {selectedCategory === 'Ghép Đoàn' ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                const token = localStorage.getItem('trekmap_token');
                if (!token) {
                  window.dispatchEvent(new CustomEvent('trekmap:show-toast', { detail: { message: 'Vui lòng đăng nhập để mở chuyến ghép đoàn!', type: 'info' } }));
                  window.location.hash = '#login';
                  return;
                }
                setIsCreateTripOpen(true);
              }}
              style={{ borderRadius: 20 }}
            >
              <PlusCircle size={15} /> Mở chuyến ghép đoàn
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => {
                const token = localStorage.getItem('trekmap_token');
                if (!token) {
                  window.dispatchEvent(new CustomEvent('trekmap:show-toast', { detail: { message: 'Vui lòng đăng nhập để tạo bài nhật ký mới trên diễn đàn!', type: 'info' } }));
                  window.location.hash = '#login';
                  return;
                }
                onOpenNewThreadModal();
              }}
              style={{ borderRadius: 20 }}
            >
              <PlusCircle size={15} /> Viết bài đóng góp
            </button>
          )}
        </div>
      </div>

      <CreateTripModal
        isOpen={isCreateTripOpen}
        onClose={() => setIsCreateTripOpen(false)}
        onSuccess={loadTrips}
      />

      {/* Category Filter Pills (Nature Theme) */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { name: 'All', label: 'Tất cả diễn đàn' },
          { name: 'Ghép Đoàn', label: '🎒 Ghép đoàn & Tìm bạn' },
          { name: 'Nhật Ký', label: '📖 Nhật ký chuyến đi' },
          { name: 'Kinh Nghiệm', label: 'Cẩm nang & Kinh nghiệm' },
          { name: 'Hỏi Đáp', label: 'Hỏi đáp kỹ thuật' },
          { name: 'Cảnh Báo', label: 'Radar an toàn' },
        ].map((item) => (
          <button
            key={item.name}
            onClick={() => setSelectedCategory(item.name)}
            className={`btn ${selectedCategory === item.name ? 'btn-primary' : 'btn-outline'}`}
            style={{
              borderRadius: 24,
              padding: '8px 20px',
              fontSize: 'var(--font-size-sm)',
              borderColor: item.name === 'Cảnh Báo' ? 'var(--color-error)' : undefined,
              color: item.name === 'Cảnh Báo' && selectedCategory !== item.name ? 'var(--color-error)' : undefined,
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Conditional rendering for Ghép Đoàn & Nhật Ký vs Standard Threads */}
      {selectedCategory === 'Ghép Đoàn' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 24 }}>
          {trips.length === 0 ? (
            <div className="col-span-full p-8 text-center text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
              Chưa có chuyến ghép đoàn nào. Hãy mở chuyến đầu tiên!
            </div>
          ) : (
            trips.map((t) => <TripPlanCard key={t._id} trip={t} onJoinSuccess={loadTrips} />)
          )}
        </div>
      ) : selectedCategory === 'Nhật Ký' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 24 }}>
          {tripReports.length === 0 ? (
            <div className="col-span-full p-8 text-center text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
              Chưa có bài viết nhật ký chuyến đi nào.
            </div>
          ) : (
            tripReports.map((r) => <TripReportCard key={r._id} report={r} />)
          )}
        </div>
      ) : (
        /* Expedition Log Grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 24 }}>
        {filtered.map((thread) => (
          <div
            key={thread.id}
            className="card"
            style={{
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              background: 'var(--color-bg-card)',
              border: thread.category === 'Cảnh Báo' ? '1px solid var(--color-error)' : '1px solid var(--color-border)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              transition: 'transform 0.2s ease, border-color 0.2s ease',
              cursor: 'pointer',
            }}
            onClick={() => setActiveThread(thread)}
          >
            <div>
              {/* Header Badges */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className={`badge ${thread.category === 'Hỏi Đáp' ? 'badge-info' : thread.category === 'Cảnh Báo' ? 'badge-error' : 'badge-success'}`}>
                    {thread.category}
                  </span>
                  {thread.isPinned && <span className="badge badge-amber">📌 Ghim</span>}
                </div>

                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: thread.category === 'Cảnh Báo' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: thread.category === 'Cảnh Báo' ? '#ef4444' : '#10b981',
                  border: `1px solid ${thread.category === 'Cảnh Báo' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                }}>
                  {thread.category === 'Cảnh Báo' ? <AlertTriangle size={12} color="#ef4444" /> : <ShieldCheck size={12} color="#10b981" />}
                  {thread.category === 'Cảnh Báo' ? 'Radar: Cảnh báo mưa trượt' : 'Radar: Tuyến đường an toàn'}
                </span>
              </div>

              {/* Title */}
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)', marginBottom: 10, lineHeight: 'var(--line-height-tight)' }}>
                {thread.title}
              </h3>

              {/* Snippet Content */}
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', lineHeight: 'var(--line-height-normal)', marginBottom: 16 }}>
                {thread.content}
              </p>
            </div>

            {/* Card Footer Info */}
            <div style={{ borderTop: '1px solid rgba(14, 215, 181, 0.12)', paddingTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                {/* Author Info - Clickable to open AuthorProfileModal */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveAuthor({ name: thread.authorName.replace(/\(.*\)/, '').trim(), avatar: thread.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80' });
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  title="Bấm để xem hồ sơ tác giả"
                >
                  <img
                    src={thread.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                    alt={thread.authorName}
                    referrerPolicy="no-referrer"
                    style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #00ffd5', objectFit: 'cover' }}
                  />
                  <span style={{ color: '#00ffd5', fontWeight: 700, textDecoration: 'underline' }}>{thread.authorName.replace(/\(.*\)/, '').trim()}</span>
                </div>

                {/* Metrics & Facebook Reaction Bar */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <FacebookReactionPicker
                    currentReaction={threadReactions[thread.id] !== undefined ? threadReactions[thread.id] : ((thread as any).userReaction || null)}
                    totalLikes={threadUpvotesMap[thread.id] !== undefined ? threadUpvotesMap[thread.id] : thread.upvotes}
                    reactionsSummary={threadReactionsSummaryMap[thread.id] || (thread.reactions as any)}
                    onSelectReaction={(r) => handleToggleReaction(thread.id, r)}
                  />

                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8', fontSize: '0.82rem' }}>
                    <MessageSquare size={14} color="#38bdf8" /> {threadCommentCounts[thread.id] !== undefined ? threadCommentCounts[thread.id] : (thread.repliesCount || 1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
};
