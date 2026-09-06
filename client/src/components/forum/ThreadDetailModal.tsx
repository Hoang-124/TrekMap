import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ForumThread, UserProfile } from '../../types.js';

const createSvgIcon = (d: React.ReactNode, defaultSize = 18) => {
  return ({ size = defaultSize, color = 'currentColor', style, className }: { size?: number; color?: string; style?: React.CSSProperties; className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
      {d}
    </svg>
  );
};

const X = createSvgIcon(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>);
const MessageSquare = createSvgIcon(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />);
const Send = createSvgIcon(<><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>);
const Loader2 = createSvgIcon(<><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" /></>);
const CornerDownRight = createSvgIcon(<><polyline points="15 10 20 15 15 20" /><path d="M4 4v7a4 4 0 0 0 4 4h12" /></>);
const Reply = createSvgIcon(<><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></>);
import { FacebookReactionPicker } from './FacebookReactionPicker.js';
import type { ReactionType } from './FacebookReactionPicker.js';
import { getApiHeaders, notifyForumUpdated } from '../../utils/sessionHeaders.js';
import { useSocket } from '../../hooks/useSocket.js';
import { IconChevronLeft, IconChevronRight, IconImage } from '../common/SvgIcons.js';

export interface CommentReactions {
  like: number;
  love?: number;
  haha: number;
  wow: number;
  buon: number;
  huhu: number;
  sad?: number;
  angry: number;
  dislike: number;
}

export interface CommentItem {
  id: string;
  parentId?: string | null;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
  reactions?: CommentReactions;
  replies?: CommentItem[];
}

interface ThreadDetailModalProps {
  thread: ForumThread | null;
  currentUser?: UserProfile | null;
  onClose: () => void;
  onOpenAuthorProfile: (author: { name: string; avatar: string; userId?: string }) => void;
  onUpdateCommentCount?: (threadId: string, count: number) => void;
  onUpdateThreadUpvotes?: (threadId: string, upvotes: number) => void;
  onUpdateThreadReaction?: (threadId: string, newReaction: ReactionType, newReactionsSummary: Record<string, number>, newUpvotes: number) => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const ThreadDetailModal: React.FC<ThreadDetailModalProps> = ({
  thread,
  currentUser,
  onClose,
  onOpenAuthorProfile,
  onUpdateCommentCount,
  onUpdateThreadUpvotes,
  onUpdateThreadReaction,
  onShowToast,
}) => {
  const [reaction, setReaction] = useState<ReactionType>(thread ? (thread as any).userReaction || null : null);
  const [threadUpvotes, setThreadUpvotes] = useState<number>(thread ? thread.upvotes : 0);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [totalCommentCount, setTotalCommentCount] = useState<number>(0);
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Reply inline box state
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyInputText, setReplyInputText] = useState<string>('');
  const [isSubmittingReply, setIsSubmittingReply] = useState<boolean>(false);

  // Per comment reaction state map
  const [commentReactionsState, setCommentReactionsState] = useState<{ [commentId: string]: ReactionType }>({});
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const activeImages = thread?.images || [];

  // Keyboard navigation for lightbox (ArrowLeft, ArrowRight, Escape)
  useEffect(() => {
    if (lightboxIndex === null || activeImages.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxIndex(null);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : activeImages.length - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setLightboxIndex((prev) => (prev !== null && prev < activeImages.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, activeImages.length]);

  const { socket } = useSocket();
  const threadId = thread?.id;

  // Use refs to break infinite re-render loops with parent callbacks
  const onUpdateCommentCountRef = useRef(onUpdateCommentCount);
  useEffect(() => {
    onUpdateCommentCountRef.current = onUpdateCommentCount;
  }, [onUpdateCommentCount]);

  const loadedThreadIdRef = useRef<string | null>(null);

  const fetchRealComments = useCallback(async (silent = false) => {
    if (!threadId) return;
    if (!silent && comments.length === 0) {
      setLoadingComments(true);
    }
    try {
      const res = await fetch(`/api/forum/threads/${threadId}/comments`, {
        headers: getApiHeaders(),
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setComments(json.data);
        const count = json.totalCount !== undefined ? json.totalCount : json.data.length;
        setTotalCommentCount(count);
        if (onUpdateCommentCountRef.current) {
          onUpdateCommentCountRef.current(threadId, count);
        }
      }
    } catch (err) {
      console.error('[Fetch Real Comments Error]:', err);
    } finally {
      setLoadingComments(false);
    }
  }, [threadId, comments.length]);

  // Initial load when opening modal or changing thread
  useEffect(() => {
    if (!thread || !threadId) {
      loadedThreadIdRef.current = null;
      return;
    }

    setThreadUpvotes(thread.upvotes);
    if ((thread as any).userReaction !== undefined) {
      setReaction((thread as any).userReaction);
    }

    if (loadedThreadIdRef.current !== threadId) {
      loadedThreadIdRef.current = threadId;
      fetchRealComments(false);
    }
  }, [threadId]);

  // Real-time socket listener for silent background updates (no spinner flash)
  useEffect(() => {
    if (!socket || !threadId) return;

    const handleNewComment = (data: any) => {
      if (String(data.threadId) === String(threadId)) {
        fetchRealComments(true); // Silent update (no loading spinner)
      }
    };

    const handleCommentReaction = (data: any) => {
      if (String(data.threadId) === String(threadId)) {
        fetchRealComments(true); // Silent update (no loading spinner)
      }
    };

    const handleThreadReaction = (data: any) => {
      if (String(data.threadId) === String(threadId)) {
        if (data.upvotes !== undefined) {
          setThreadUpvotes(data.upvotes);
        }
      }
    };

    socket.on('newComment', handleNewComment);
    socket.on('commentReactionUpdate', handleCommentReaction);
    socket.on('threadReactionUpdate', handleThreadReaction);

    return () => {
      socket.off('newComment', handleNewComment);
      socket.off('commentReactionUpdate', handleCommentReaction);
      socket.off('threadReactionUpdate', handleThreadReaction);
    };
  }, [socket, threadId, fetchRealComments]);

  if (!thread) return null;

  // Toast helper fallback
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onShowToast) {
      onShowToast(message, type);
    } else {
      window.dispatchEvent(new CustomEvent('trekmap:show-toast', { detail: { message, type } }));
    }
  };

  // Add Top-level Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !commentText.trim()) return;

    setIsSubmitting(true);
    const textToSend = commentText.trim();
    setCommentText(''); // Clear input immediately

    try {
      const res = await fetch(`/api/forum/threads/${thread.id}/comments`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ content: textToSend }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        await fetchRealComments();
        showToast('Gửi bình luận thành công! Dữ liệu đã lưu vào database.', 'success');
      } else {
        showToast(json.message || 'Không thể gửi bình luận.', 'error');
        setCommentText(textToSend);
      }
    } catch (err) {
      showToast('Không thể kết nối máy chủ để lưu bình luận.', 'error');
      setCommentText(textToSend);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Nested Reply to a specific Comment
  const handleSendSubReply = async (parentId: string) => {
    if (isSubmittingReply || !replyInputText.trim()) return;

    setIsSubmittingReply(true);
    const textToSend = replyInputText.trim();
    setReplyInputText('');

    try {
      const res = await fetch(`/api/forum/threads/${thread.id}/comments`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ content: textToSend, parentId }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setActiveReplyId(null);
        await fetchRealComments();
        showToast('Gửi phản hồi thành công!', 'success');
      } else {
        showToast(json.message || 'Không thể gửi phản hồi.', 'error');
        setReplyInputText(textToSend);
      }
    } catch (err) {
      showToast('Không thể kết nối máy chủ để lưu phản hồi.', 'error');
      setReplyInputText(textToSend);
    } finally {
      setIsSubmittingReply(false);
    }
  };

const updateCommentReactionsInTree = (list: CommentItem[], targetId: string, newReactions: CommentReactions): CommentItem[] => {
  return list.map((c) => {
    if (c.id === targetId) {
      return { ...c, reactions: newReactions };
    }
    if (c.replies && c.replies.length > 0) {
      return { ...c, replies: updateCommentReactionsInTree(c.replies, targetId, newReactions) };
    }
    return c;
  });
};

const updateCommentReactionsOptimistically = (
  list: CommentItem[],
  targetId: string,
  prevReaction: ReactionType,
  newReaction: ReactionType
): CommentItem[] => {
  return list.map((c) => {
    if (c.id === targetId) {
      const reactions: Record<string, number> = {
        like: 0,
        dislike: 0,
        haha: 0,
        wow: 0,
        buon: 0,
        huhu: 0,
        angry: 0,
        ...(c.reactions || {}),
      };
      if (prevReaction && prevReaction !== newReaction && reactions[prevReaction] !== undefined) {
        reactions[prevReaction] = Math.max(0, reactions[prevReaction] - 1);
      }
      if (newReaction && prevReaction !== newReaction) {
        reactions[newReaction] = (reactions[newReaction] || 0) + 1;
      }
      return { ...c, reactions: reactions as unknown as CommentReactions };
    }
    if (c.replies && c.replies.length > 0) {
      return { ...c, replies: updateCommentReactionsOptimistically(c.replies, targetId, prevReaction, newReaction) };
    }
    return c;
  });
};

  // Handle Comment Reaction (Instant 0ms Optimistic Update - Zero Scroll Jump)
  const handleCommentReaction = async (commentId: string, reactionType: ReactionType) => {
    const prevReaction = commentReactionsState[commentId] || null;

    try {
      const res = await fetch(`/api/forum/comments/${commentId}/reaction`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reactionType, previousReaction: prevReaction }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setComments((prevComments) => updateCommentReactionsInTree(prevComments, commentId, json.data));
        if (json.userReaction !== undefined) {
          setCommentReactionsState((prev) => ({ ...prev, [commentId]: json.userReaction }));
        }
      }
    } catch (err) {
      console.error('[Comment Reaction Error]:', err);
    }
  };
  // Handle Main Discussion Thread Reaction (MongoDB Persistent Sync + Instant 0ms Optimistic Upvotes)
  const handleThreadReaction = async (r: ReactionType) => {
    const prev = reaction;
    const next = prev === r ? null : r;

    // Instant optimistic updates
    setReaction(next);
    if (thread) {
      const summary: Record<string, number> = {
        ...(thread.reactions || { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0, dislike: 0 }),
      };
      if (prev && summary[prev] !== undefined) {
        summary[prev] = Math.max(0, summary[prev] - 1);
      }
      if (next && summary[next] !== undefined) {
        summary[next] = (summary[next] || 0) + 1;
      }
      (thread as any).reactions = summary;
      (thread as any).userReaction = next;
    }

    try {
      const res = await fetch(`/api/forum/threads/${thread.id}/reaction`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reactionType: r, previousReaction: prev }),
      });
      const json = await res.json();
      if (json.success && json.upvotes !== undefined) {
        setThreadUpvotes(json.upvotes);
        if (json.userReaction !== undefined) {
          setReaction(json.userReaction);
        }
        if (thread) {
          (thread as any).reactions = json.data;
          (thread as any).userReaction = json.userReaction;
          (thread as any).upvotes = json.upvotes;
        }
        if (onUpdateThreadUpvotes && thread) {
          onUpdateThreadUpvotes(thread.id, json.upvotes);
        }
        if (onUpdateThreadReaction && thread) {
          onUpdateThreadReaction(thread.id, json.userReaction, json.data, json.upvotes);
        }
        notifyForumUpdated({ threadId: thread.id, userReaction: json.userReaction, reactionsSummary: json.data, upvotes: json.upvotes });
      }
    } catch (err) {
      console.error('[Thread Reaction Error]:', err);
    }
  };

  // Helper to render individual Comment Card & Nested Sub-Replies
  const renderCommentCard = (comment: CommentItem, isNested = false) => {
    const isReplyingThis = activeReplyId === comment.id;
    const currentCommentReaction = commentReactionsState[comment.id] || (comment as any).userReaction || null;

    const cleanCommentAuthor = comment.authorName.replace(/\(.*\)/, '').trim();
    const cleanThreadAuthor = (thread?.authorName || '').replace(/\(.*\)/, '').trim();
    const isPostAuthor = cleanCommentAuthor.toLowerCase() === cleanThreadAuthor.toLowerCase();

    // Total reactions count
    const totalReactions = comment.reactions
      ? Object.values(comment.reactions).reduce((a, b) => a + b, 0)
      : 0;

    return (
      <div
        key={comment.id}
        style={{
          background: isPostAuthor
            ? 'rgba(22, 163, 74, 0.08)'
            : (isNested ? 'var(--color-bg-card)' : 'var(--color-bg-main)'),
          borderRadius: 16,
          padding: '14px 16px',
          border: isPostAuthor
            ? '1.5px solid var(--color-primary)'
            : '1px solid var(--color-border)',
          boxShadow: 'none',
          marginLeft: isNested ? 24 : 0,
          marginTop: isNested ? 8 : 0,
          position: 'relative',
        }}
      >
        {isNested && (
          <div style={{ position: 'absolute', left: -16, top: 18, color: 'var(--color-primary)' }}>
            <CornerDownRight size={14} />
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            {(() => {
              const isCommentAuthorCurrent = Boolean(
                currentUser && (
                  (currentUser.fullName && cleanCommentAuthor.toLowerCase().includes(currentUser.fullName.toLowerCase())) ||
                  (currentUser.username && cleanCommentAuthor.toLowerCase().includes(currentUser.username.toLowerCase()))
                )
              );
              const commentEffectiveAvatar = (isCommentAuthorCurrent && (currentUser?.avatarUrl || currentUser?.avatar))
                ? (currentUser.avatarUrl || currentUser.avatar)
                : (comment.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80');

              return (
                <div
                  onClick={() => onOpenAuthorProfile({ name: cleanCommentAuthor, avatar: commentEffectiveAvatar || '' })}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}
                  title="Bấm để xem hồ sơ người bình luận"
                >
                  <img
                    src={commentEffectiveAvatar}
                    alt={cleanCommentAuthor}
                    referrerPolicy="no-referrer"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: isPostAuthor ? '2px solid var(--color-primary)' : '1.5px solid var(--color-sky)',
                      objectFit: 'cover',
                    }}
                  />
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                    {cleanCommentAuthor}
                  </span>
                </div>
              );
            })()}
            {isPostAuthor && (
              <span style={{
                background: 'rgba(22, 163, 74, 0.15)',
                border: '1px solid var(--color-primary)',
                color: 'var(--color-primary)',
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '1px 7px',
                borderRadius: 8,
              }}>
                Tác giả
              </span>
            )}
          </div>

          <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>{comment.createdAt}</span>
        </div>

        {/* Content */}
        <div style={{ fontSize: '0.88rem', color: 'var(--color-text-main)', lineHeight: 1.5, marginBottom: 10, paddingLeft: 34 }}>
          {comment.content}
        </div>

        {/* Action Row: Facebook Reaction Picker + Reply Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingLeft: 34, paddingTop: 4 }}>
          <FacebookReactionPicker
            currentReaction={currentCommentReaction}
            totalLikes={totalReactions}
            reactionsSummary={comment.reactions as any}
            onSelectReaction={(r) => handleCommentReaction(comment.id, r)}
          />

          {!isNested && (
            <button
              type="button"
              onClick={() => {
                setActiveReplyId(isReplyingThis ? null : comment.id);
                setReplyInputText('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: isReplyingThis ? '#00ffd5' : '#94a3b8',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Reply size={13} /> {isReplyingThis ? 'Hủy trả lời' : 'Trả lời'}
            </button>
          )}
        </div>

        {/* Inline Reply Input Box */}
        {isReplyingThis && (
          <div style={{ marginTop: 12, paddingLeft: 34, display: 'flex', gap: 8 }}>
            <input
              type="text"
              className="form-input"
              placeholder={`Trả lời ${comment.authorName}...`}
              value={replyInputText}
              onChange={(e) => setReplyInputText(e.target.value)}
              disabled={isSubmittingReply}
              style={{ flex: 1, fontSize: '0.82rem', padding: '6px 12px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendSubReply(comment.id);
              }}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleSendSubReply(comment.id)}
              disabled={isSubmittingReply || !replyInputText.trim()}
              style={{ padding: '4px 14px', fontSize: '0.82rem' }}
            >
              {isSubmittingReply ? <Loader2 size={13} className="spin" /> : 'Gửi'}
            </button>
          </div>
        )}

        {/* Render Nested Sub-replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {comment.replies.map((subReply) => renderCommentCard(subReply, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {createPortal(
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && lightboxIndex === null) {
              onClose();
            }
          }}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(3, 8, 14, 0.86)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 99999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 680,
          width: '100%',
          height: 'min(86vh, 760px)',
          maxHeight: 'min(86vh, 760px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--color-bg-card)',
          border: '1.5px solid var(--color-border)',
          borderRadius: 22,
          padding: '22px 24px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(5, 150, 105, 0.2)',
          position: 'relative',
          zIndex: 100000000,
          margin: 0,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`badge ${thread.category === 'Cảnh Báo' ? 'badge-error' : 'badge-success'}`}>
              {thread.category}
            </span>

            {/* Post Author Clickable Header */}
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
                : (thread.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80');

              return (
                <div
                  onClick={() => onOpenAuthorProfile({
                    name: thread.authorName.replace(/\(.*\)/, '').trim(),
                    avatar: effectiveAvatar || '',
                    userId: thread.userId,
                  })}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                  title="Bấm để xem hồ sơ tác giả bài viết"
                >
                  <img
                    src={effectiveAvatar}
                    alt={thread.authorName}
                    referrerPolicy="no-referrer"
                    style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--color-primary)', objectFit: 'cover' }}
                  />
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)', textDecoration: 'underline' }}>
                    {thread.authorName.replace(/\(.*\)/, '').trim()}
                  </span>
                </div>
              );
            })()}

            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-dim)' }}>• {thread.createdAt}</span>
          </div>

          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 6, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Title */}
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)', margin: 0, lineHeight: 1.4 }}>
            {thread.title}
          </h2>

          {/* Full Content */}
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', lineHeight: 'var(--line-height-normal)', margin: 0, background: 'var(--color-bg-main)', padding: 16, borderRadius: 14, border: '1px solid var(--color-border)' }}>
            {thread.content}
          </p>

          {/* Attached Real Photos Gallery */}
          {thread.images && thread.images.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Hình Ảnh Thực Tế Từ Chuyến Đi ({thread.images.length})
              </span>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: thread.images.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 10,
                }}
              >
                {thread.images.map((imgSrc, idx) => (
                  <div
                    key={idx}
                    onClick={() => setLightboxIndex(idx)}
                    style={{
                      position: 'relative',
                      height: thread.images && thread.images.length === 1 ? 280 : 160,
                      borderRadius: 14,
                      overflow: 'hidden',
                      border: '1px solid var(--color-border)',
                      cursor: 'zoom-in',
                      background: '#040b12',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                      transition: 'transform 0.2s ease, border-color 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                      e.currentTarget.style.transform = 'scale(1.02)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    title="Bấm để xem ảnh phóng to"
                  >
                    <img
                      src={imgSrc}
                      alt={`Ảnh hành trình ${idx + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        background: 'rgba(3, 8, 14, 0.75)',
                        backdropFilter: 'blur(6px)',
                        color: 'var(--color-primary)',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 6,
                        border: '1px solid rgba(74, 222, 128, 0.3)',
                      }}
                    >
                      Ảnh #{idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Row: Thread Reaction Picker */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', padding: '12px 0' }}>
            <FacebookReactionPicker
              currentReaction={reaction}
              totalLikes={threadUpvotes}
              reactionsSummary={thread.reactions as any}
              onSelectReaction={(r) => handleThreadReaction(r)}
            />

            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <MessageSquare size={16} color="var(--color-sky)" /> {totalCommentCount} Bình luận
            </span>
          </div>

          {/* Comments List Section */}
          <div>
            <h4 style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', marginBottom: 12 }}>
              Cộng đồng thảo luận ({totalCommentCount})
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {loadingComments ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-primary)', fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Loader2 size={18} className="spin" /> Đang tải bình luận từ MongoDB...
                </div>
              ) : comments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', background: 'var(--color-bg-main)', borderRadius: 14, border: '1px dashed var(--color-border)' }}>
                  Chưa có bình luận nào. Hãy là người đầu tiên gửi chia sẻ của bạn!
                </div>
              ) : (
                comments.map((c) => renderCommentCard(c, false))
              )}
            </div>
          </div>
        </div>

        {/* Top-level Comment Input Box Form */}
        <form onSubmit={handleAddComment} style={{ display: 'flex', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border)' }}>
          <input
            type="text"
            className="form-input"
            placeholder={isSubmitting ? "Đang lưu bình luận..." : "Viết bình luận của bạn vào đây..."}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            disabled={isSubmitting}
            style={{ flex: 1, fontSize: 'var(--font-size-sm)' }}
          />
          <button type="submit" className="btn btn-primary" disabled={isSubmitting || !commentText.trim()} style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6, opacity: isSubmitting ? 0.6 : 1 }}>
            {isSubmitting ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Gửi
          </button>
        </form>
      </div>
    </div>,
    document.body
  )}

  {/* Interactive Fullscreen Gallery Lightbox with Prev/Next, Thumbnails & Keyboard Navigation */}
  {lightboxIndex !== null && activeImages[lightboxIndex] && createPortal(
    <div
      onClick={(e) => {
        e.stopPropagation();
        setLightboxIndex(null);
      }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000001,
            background: 'rgba(2, 6, 12, 0.94)',
            backdropFilter: 'blur(24px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 24px 28px',
            userSelect: 'none',
          }}
        >
          {/* Top Bar: Counter Badge & Close Button */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 20,
              left: 24,
              right: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 10,
            }}
          >
            {/* Image Counter Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 20,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                color: 'var(--color-text-main)',
                fontSize: '0.84rem',
                fontWeight: 700,
                letterSpacing: '0.02em',
              }}
            >
              <IconImage size={15} color="var(--color-primary)" />
              <span>Ảnh {lightboxIndex + 1} / {activeImages.length}</span>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(null);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                width: 42,
                height: 42,
                color: '#fff',
                fontSize: '1.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              title="Đóng xem ảnh (Esc)"
            >
              ✕
            </button>
          </div>

          {/* Main Image Container with Prev/Next Navigation */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              flex: 1,
              maxHeight: 'calc(85vh - 90px)',
            }}
          >
            {/* Previous Button */}
            {activeImages.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : activeImages.length - 1));
                }}
                style={{
                  position: 'absolute',
                  left: 20,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 20,
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1.5px solid rgba(255, 255, 255, 0.25)',
                  backdropFilter: 'blur(12px)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-primary)';
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                  e.currentTarget.style.color = '#041108';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(15, 23, 42, 0.75)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                  e.currentTarget.style.color = '#fff';
                }}
                title="Ảnh trước (← hoặc phím mũi tên trái)"
              >
                <IconChevronLeft size={24} />
              </button>
            )}

            {/* Currently Active Image */}
            <img
              src={activeImages[lightboxIndex]}
              alt={`Ảnh ${lightboxIndex + 1}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '88vw',
                maxHeight: '70vh',
                borderRadius: 16,
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 40px rgba(74, 222, 128, 0.25)',
                objectFit: 'contain',
                border: '1px solid var(--color-border)',
                transition: 'opacity 0.2s ease',
              }}
            />

            {/* Next Button */}
            {activeImages.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev !== null && prev < activeImages.length - 1 ? prev + 1 : 0));
                }}
                style={{
                  position: 'absolute',
                  right: 20,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 20,
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1.5px solid rgba(255, 255, 255, 0.25)',
                  backdropFilter: 'blur(12px)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-primary)';
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                  e.currentTarget.style.color = '#041108';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(15, 23, 42, 0.75)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                  e.currentTarget.style.color = '#fff';
                }}
                title="Ảnh tiếp theo (→ hoặc phím mũi tên phải)"
              >
                <IconChevronRight size={24} />
              </button>
            )}
          </div>

          {/* Bottom Thumbnail Strip for Instant Jumping */}
          {activeImages.length > 1 && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 16,
                padding: '8px 14px',
                borderRadius: 16,
                background: 'rgba(10, 18, 30, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(16px)',
                maxWidth: '90vw',
                overflowX: 'auto',
              }}
            >
              {activeImages.map((imgSrc, idx) => {
                const isActive = idx === lightboxIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    style={{
                      width: 60,
                      height: 48,
                      borderRadius: 10,
                      overflow: 'hidden',
                      padding: 0,
                      border: isActive ? '2px solid var(--color-primary)' : '1px solid rgba(255, 255, 255, 0.15)',
                      opacity: isActive ? 1 : 0.55,
                      transform: isActive ? 'scale(1.08)' : 'scale(1)',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                      background: '#040b12',
                      flexShrink: 0,
                      boxShadow: isActive ? '0 0 12px rgba(74, 222, 128, 0.5)' : 'none',
                    }}
                    title={`Chuyển sang ảnh ${idx + 1}`}
                  >
                    <img
                      src={imgSrc}
                      alt={`Thumbnail ${idx + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
};
