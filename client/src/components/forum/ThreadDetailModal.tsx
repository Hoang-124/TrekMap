import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { ForumThread, UserProfile } from '../../types.js';
import { FacebookReactionPicker } from './FacebookReactionPicker.js';
import type { ReactionType } from './FacebookReactionPicker.js';
import { getApiHeaders, notifyForumUpdated } from '../../utils/sessionHeaders.js';
import { useSocket } from '../../hooks/useSocket.js';
import { useFocusTrap, isTopmostFocusTrap } from '../../hooks/useFocusTrap.js';
import {
  IconCheckCircle,
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconEye,
  IconImage,
  IconPinOff,
  IconTrash,
} from '../common/SvgIcons.js';

const BEST_COMMENT_STORAGE_KEY = 'lost_best_comment_v1';

function readBestCommentMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(BEST_COMMENT_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) {
        clean[key] = value.trim();
      }
    }
    return clean;
  } catch {
    return {};
  }
}

function writeBestCommentMap(map: Record<string, string>): void {
  try {
    localStorage.setItem(BEST_COMMENT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota / privacy mode failures
  }
}

const THREAD_CATEGORIES: Array<ForumThread['category']> = [
  'Kinh Nghiệm',
  'Hỏi Đáp',
  'Tìm Đồng Đội',
  'Cảnh Báo',
];

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
  userId?: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
  reactions?: CommentReactions;
  userReaction?: ReactionType;
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
  onThreadUpdated?: (updated: ForumThread) => void;
  onThreadDeleted?: (threadId: string) => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return 'Gần đây';
  // If already a human-readable relative label (e.g. 'Vừa xong'), preserve it
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return 'Vừa xong';
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins} phút trước`;
  const diffHours = Math.floor(diffMs / 3_600_000);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function commentSubtreeContainsId(list: CommentItem[], rootId: string, targetId: string): boolean {
  const containsInNode = (node: CommentItem): boolean => {
    if (node.id === targetId) return true;
    if (!node.replies || node.replies.length === 0) return false;
    return node.replies.some((sub) => containsInNode(sub));
  };

  for (const item of list) {
    if (item.id === rootId) {
      return containsInNode(item);
    }
    if (item.replies && item.replies.length > 0 && commentSubtreeContainsId(item.replies, rootId, targetId)) {
      return true;
    }
  }
  return false;
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable ||
    Boolean(target.closest('[contenteditable="true"]'))
  );
}

export const ThreadDetailModal: React.FC<ThreadDetailModalProps> = (props) => {
  if (!props.thread) return null;
  return <ThreadDetailModalInner key={props.thread.id} {...props} thread={props.thread} />;
};

const ThreadDetailModalInner: React.FC<Omit<ThreadDetailModalProps, 'thread'> & { thread: ForumThread }> = ({
  thread,
  currentUser,
  onClose,
  onOpenAuthorProfile,
  onUpdateCommentCount,
  onUpdateThreadUpvotes,
  onUpdateThreadReaction,
  onThreadUpdated,
  onThreadDeleted,
  onShowToast,
}) => {
  const currentUserId = String(currentUser?.id || (currentUser as (UserProfile & { _id?: string }) | null)?._id || '');
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'moderator';

  const [liveThread, setLiveThread] = useState<ForumThread>(thread);
  const activeThread = liveThread.id === thread.id ? liveThread : thread;

  const [reaction, setReaction] = useState<ReactionType>((thread.userReaction as ReactionType) || null);
  const [threadUpvotes, setThreadUpvotes] = useState<number>(thread.upvotes);
  const [threadReactionsSummary, setThreadReactionsSummary] = useState<Record<string, number>>(
    thread.reactions ? { ...thread.reactions } : {}
  );
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [totalCommentCount, setTotalCommentCount] = useState<number>(0);
  const [loadingComments, setLoadingComments] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Reply inline box state
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyInputText, setReplyInputText] = useState<string>('');
  const [isSubmittingReply, setIsSubmittingReply] = useState<boolean>(false);

  // Owner / Admin inline thread edit & delete state (zero native dialogs)
  const [isEditingThread, setIsEditingThread] = useState(false);
  const [editThreadTitle, setEditThreadTitle] = useState('');
  const [editThreadContent, setEditThreadContent] = useState('');
  const [editThreadCategory, setEditThreadCategory] = useState<ForumThread['category']>('Kinh Nghiệm');
  const [isSavingThread, setIsSavingThread] = useState(false);
  const [confirmDeleteThread, setConfirmDeleteThread] = useState(false);
  const [isDeletingThread, setIsDeletingThread] = useState(false);

  // Owner / Admin inline comment edit & delete state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentDraft, setEditCommentDraft] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  // Per comment reaction state map & local best-answer highlight map
  const [commentReactionsState, setCommentReactionsState] = useState<{ [commentId: string]: ReactionType }>({});
  const [bestCommentMap, setBestCommentMap] = useState<Record<string, string>>(() => readBestCommentMap());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lightboxRef = useRef<HTMLDivElement | null>(null);
  const lightboxCloseBtnRef = useRef<HTMLButtonElement | null>(null);

  const activeImages = activeThread.images || [];
  if (lightboxIndex !== null && (lightboxIndex < 0 || lightboxIndex >= activeImages.length)) {
    setLightboxIndex(null);
  }
  const isLightboxOpen = lightboxIndex !== null && Boolean(activeImages[lightboxIndex]);
  const isBusyCloseLock =
    isDeletingThread ||
    isSavingThread ||
    isSubmitting ||
    isSubmittingReply ||
    isSavingComment ||
    Boolean(deletingCommentId);

  // LIFO Focus Traps: main dialog + nested fullscreen gallery lightbox
  useFocusTrap(true, dialogRef);
  useFocusTrap(isLightboxOpen, lightboxRef, { initialFocusRef: lightboxCloseBtnRef });

  const bestCommentId = bestCommentMap[activeThread.id] || null;

  const orderedComments = useMemo(() => {
    if (!bestCommentId || comments.length === 0) return comments;

    const hoistNestedReplies = (item: CommentItem): CommentItem => {
      if (!item.replies || item.replies.length <= 1) return item;
      const subIdx = item.replies.findIndex((sub) => sub.id === bestCommentId);
      if (subIdx <= 0) return item;
      const nextReplies = [...item.replies];
      const [pinnedSub] = nextReplies.splice(subIdx, 1);
      nextReplies.unshift(pinnedSub);
      return { ...item, replies: nextReplies };
    };

    const withHoistedSubs = comments.map(hoistNestedReplies);
    const matchIndex = withHoistedSubs.findIndex(
      (c) => c.id === bestCommentId || Boolean(c.replies?.some((sub) => sub.id === bestCommentId))
    );
    if (matchIndex <= 0) return withHoistedSubs;
    const reordered = [...withHoistedSubs];
    const [pinned] = reordered.splice(matchIndex, 1);
    reordered.unshift(pinned);
    return reordered;
  }, [comments, bestCommentId]);

  // LIFO keyboard navigation: Escape unwinds lightbox -> inline edits/confirms/reply -> modal; arrows navigate lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;

      if (e.key === 'Escape') {
        if (isLightboxOpen) {
          if (!isTopmostFocusTrap(lightboxRef.current)) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          setLightboxIndex(null);
          return;
        }
        if (!isTopmostFocusTrap(dialogRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (confirmDeleteCommentId && !deletingCommentId) {
          setConfirmDeleteCommentId(null);
        } else if (editingCommentId && !isSavingComment) {
          setEditingCommentId(null);
          setEditCommentDraft('');
        } else if (activeReplyId && !isSubmittingReply) {
          setActiveReplyId(null);
          setReplyInputText('');
        } else if (confirmDeleteThread && !isDeletingThread) {
          setConfirmDeleteThread(false);
        } else if (isEditingThread && !isSavingThread) {
          setIsEditingThread(false);
        } else if (!isBusyCloseLock) {
          onClose();
        }
        return;
      }

      if (
        isLightboxOpen &&
        activeImages.length > 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !isEditableKeyboardTarget(e.target) &&
        isTopmostFocusTrap(lightboxRef.current)
      ) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : activeImages.length - 1));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setLightboxIndex((prev) => (prev !== null && prev < activeImages.length - 1 ? prev + 1 : 0));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isLightboxOpen,
    confirmDeleteCommentId,
    deletingCommentId,
    editingCommentId,
    isSavingComment,
    activeReplyId,
    isSubmittingReply,
    confirmDeleteThread,
    isDeletingThread,
    isEditingThread,
    isSavingThread,
    isBusyCloseLock,
    activeImages.length,
    onClose,
  ]);

  const { socket } = useSocket();
  const threadId = thread.id;

  const onUpdateCommentCountRef = useRef(onUpdateCommentCount);
  useEffect(() => {
    onUpdateCommentCountRef.current = onUpdateCommentCount;
  }, [onUpdateCommentCount]);

  const commentsAbortRef = useRef<AbortController | null>(null);
  const commentsRequestIdRef = useRef<number>(0);

  const fetchRealComments = useCallback(async (silent = false) => {
    if (!threadId) return;
    if (commentsAbortRef.current) {
      commentsAbortRef.current.abort();
    }
    const controller = new AbortController();
    commentsAbortRef.current = controller;
    const reqId = ++commentsRequestIdRef.current;

    if (!silent) {
      setLoadingComments(true);
    }
    try {
      const res = await fetch(`/api/forum/threads/${encodeURIComponent(threadId)}/comments`, {
        headers: getApiHeaders(),
        signal: controller.signal,
      });
      const json = await res.json();
      if (controller.signal.aborted || reqId !== commentsRequestIdRef.current) return;
      if (json.success && Array.isArray(json.data)) {
        setComments(json.data);
        const count = json.totalCount !== undefined ? json.totalCount : json.data.length;
        setTotalCommentCount(count);
        if (onUpdateCommentCountRef.current) {
          onUpdateCommentCountRef.current(threadId, count);
        }
      }
    } catch (err: unknown) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (isAbort || controller.signal.aborted || reqId !== commentsRequestIdRef.current) return;
      console.error('[Fetch Real Comments Error]:', err);
    } finally {
      if (!controller.signal.aborted && reqId === commentsRequestIdRef.current) {
        setLoadingComments(false);
      }
    }
  }, [threadId]);

  // Fetch live thread detail (GET /api/forum/threads/:id -> increments viewsCount & refreshes metadata) + comments
  useEffect(() => {
    const controller = new AbortController();
    const initialCommentsReqId = ++commentsRequestIdRef.current;

    fetch(`/api/forum/threads/${encodeURIComponent(threadId)}`, {
      headers: getApiHeaders(),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (controller.signal.aborted) return;
        if (json?.success && json.data) {
          const refreshed = json.data as ForumThread;
          setLiveThread(refreshed);
          setThreadUpvotes(refreshed.upvotes ?? thread.upvotes);
          setThreadReactionsSummary(refreshed.reactions ? { ...refreshed.reactions } : {});
          setReaction((refreshed.userReaction as ReactionType) || null);
        }
      })
      .catch(() => {
        // Keep initial thread props on transient network failure
      });

    fetch(`/api/forum/threads/${encodeURIComponent(threadId)}/comments`, {
      headers: getApiHeaders(),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted || initialCommentsReqId !== commentsRequestIdRef.current) return;
        if (json.success && Array.isArray(json.data)) {
          setComments(json.data);
          const count = json.totalCount !== undefined ? json.totalCount : json.data.length;
          setTotalCommentCount(count);
          if (onUpdateCommentCountRef.current) {
            onUpdateCommentCountRef.current(threadId, count);
          }
        }
      })
      .catch((err: unknown) => {
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        if (!isAbort && !controller.signal.aborted) {
          console.error('[Fetch Real Comments Error]:', err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && initialCommentsReqId === commentsRequestIdRef.current) {
          setLoadingComments(false);
        }
      });

    return () => {
      controller.abort();
      if (commentsAbortRef.current) {
        commentsAbortRef.current.abort();
      }
      commentsRequestIdRef.current += 1;
    };
  }, [threadId, thread.upvotes]);

  // Real-time socket listener for silent background updates
  useEffect(() => {
    if (!socket || !threadId) return;

    const handleNewComment = (data: { threadId?: string }) => {
      if (String(data.threadId) === String(threadId)) {
        fetchRealComments(true);
      }
    };

    const handleCommentReaction = (data: { threadId?: string }) => {
      if (String(data.threadId) === String(threadId)) {
        fetchRealComments(true);
      }
    };

    const handleCommentUpdated = (data: { threadId?: string }) => {
      if (String(data.threadId) === String(threadId)) {
        fetchRealComments(true);
      }
    };

    const handleCommentDeleted = (data: { threadId?: string }) => {
      if (String(data.threadId) === String(threadId)) {
        fetchRealComments(true);
      }
    };

    const handleThreadReaction = (data: { threadId?: string; upvotes?: number }) => {
      if (String(data.threadId) === String(threadId) && data.upvotes !== undefined) {
        setThreadUpvotes(data.upvotes);
      }
    };

    const handleThreadUpdated = (data: { threadId?: string; thread?: ForumThread }) => {
      if (String(data.threadId) === String(threadId) && data.thread) {
        setLiveThread(data.thread);
      }
    };

    const handleThreadDeleted = (data: { threadId?: string }) => {
      if (String(data.threadId) === String(threadId)) {
        onClose();
      }
    };

    socket.on('newComment', handleNewComment);
    socket.on('commentReactionUpdate', handleCommentReaction);
    socket.on('commentUpdated', handleCommentUpdated);
    socket.on('commentDeleted', handleCommentDeleted);
    socket.on('threadReactionUpdate', handleThreadReaction);
    socket.on('threadUpdated', handleThreadUpdated);
    socket.on('threadDeleted', handleThreadDeleted);

    return () => {
      socket.off('newComment', handleNewComment);
      socket.off('commentReactionUpdate', handleCommentReaction);
      socket.off('commentUpdated', handleCommentUpdated);
      socket.off('commentDeleted', handleCommentDeleted);
      socket.off('threadReactionUpdate', handleThreadReaction);
      socket.off('threadUpdated', handleThreadUpdated);
      socket.off('threadDeleted', handleThreadDeleted);
    };
  }, [socket, threadId, fetchRealComments, onClose]);

  if (!activeThread) return null;

  const canManageThread = Boolean(
    currentUser &&
      (isStaff || (currentUserId && activeThread.userId && String(activeThread.userId) === currentUserId))
  );

  const normalizedThreadAuthor = (activeThread.authorName || '').replace(/\(.*\)/, '').trim().toLowerCase();
  const isThreadAuthorByName = Boolean(
    currentUser &&
      !activeThread.userId &&
      normalizedThreadAuthor &&
      ((currentUser.fullName && currentUser.fullName.trim().toLowerCase() === normalizedThreadAuthor) ||
        (currentUser.username && currentUser.username.trim().toLowerCase() === normalizedThreadAuthor))
  );
  const canPinBestAnswer = canManageThread || isThreadAuthorByName;

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onShowToast) {
      onShowToast(message, type);
    } else {
      window.dispatchEvent(new CustomEvent('lost:show-toast', { detail: { message, type } }));
    }
  };

  const handleToggleBestComment = (commentId: string) => {
    if (!canPinBestAnswer) return;
    const isAlreadyBest = bestCommentId === commentId;
    setBestCommentMap((prev) => {
      const next = { ...prev };
      if (isAlreadyBest) {
        delete next[activeThread.id];
      } else {
        next[activeThread.id] = commentId;
      }
      writeBestCommentMap(next);
      return next;
    });
    showToast(
      isAlreadyBest ? 'Đã bỏ ghim câu trả lời hữu ích nhất.' : 'Đã ghim Câu Trả Lời Hữu Ích Nhất lên đầu!',
      isAlreadyBest ? 'info' : 'success'
    );
  };

  const ensureAuthenticated = (actionLabel: string): boolean => {
    const token = localStorage.getItem('lost_token');
    if (!currentUser && !token) {
      showToast(`Vui lòng đăng nhập để ${actionLabel}.`, 'info');
      window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
      return false;
    }
    return true;
  };

  // Owner / Admin: Edit & Delete Thread handlers
  const openEditThread = () => {
    setEditThreadTitle(activeThread.title || '');
    setEditThreadContent(activeThread.content || '');
    setEditThreadCategory(activeThread.category || 'Kinh Nghiệm');
    setConfirmDeleteThread(false);
    setIsEditingThread(true);
  };

  const handleSaveThreadEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingThread) return;
    const cleanTitle = editThreadTitle.trim();
    const cleanContent = editThreadContent.trim();
    if (!cleanTitle || !cleanContent) {
      showToast('Tiêu đề và nội dung bài viết không được để trống.', 'error');
      return;
    }
    setIsSavingThread(true);
    try {
      const res = await fetch(`/api/forum/threads/${encodeURIComponent(activeThread.id)}`, {
        method: 'PATCH',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title: cleanTitle,
          content: cleanContent,
          category: editThreadCategory,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.data) {
        const updated = json.data as ForumThread;
        setLiveThread(updated);
        setIsEditingThread(false);
        onThreadUpdated?.(updated);
        notifyForumUpdated({ threadId: updated.id, updatedThread: updated });
        showToast(json.message || 'Đã cập nhật bài viết thành công!', 'success');
      } else {
        showToast(json.message || 'Không thể cập nhật bài viết lúc này.', 'error');
      }
    } catch {
      showToast('Lỗi kết nối máy chủ khi cập nhật bài viết.', 'error');
    } finally {
      setIsSavingThread(false);
    }
  };

  const handleDeleteThread = async () => {
    if (isDeletingThread) return;
    setIsDeletingThread(true);
    try {
      const res = await fetch(`/api/forum/threads/${encodeURIComponent(activeThread.id)}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        onThreadDeleted?.(activeThread.id);
        notifyForumUpdated({ deletedThreadId: activeThread.id });
        showToast(json.message || 'Đã xóa bài viết thành công!', 'success');
        onClose();
      } else {
        showToast(json.message || 'Không thể xóa bài viết này.', 'error');
      }
    } catch {
      showToast('Lỗi kết nối máy chủ khi xóa bài viết.', 'error');
    } finally {
      setIsDeletingThread(false);
      setConfirmDeleteThread(false);
    }
  };

  // Owner / Admin: Edit & Delete Comment handlers
  const updateCommentContentInTree = (list: CommentItem[], targetId: string, nextContent: string): CommentItem[] => {
    return list.map((c) => {
      if (c.id === targetId) {
        return { ...c, content: nextContent };
      }
      if (c.replies && c.replies.length > 0) {
        return { ...c, replies: updateCommentContentInTree(c.replies, targetId, nextContent) };
      }
      return c;
    });
  };

  const handleSaveCommentEdit = async (commentId: string) => {
    if (isSavingComment) return;
    const cleanText = editCommentDraft.trim();
    if (!cleanText) {
      showToast('Nội dung bình luận không được để trống.', 'error');
      return;
    }
    setIsSavingComment(true);
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, {
        method: 'PATCH',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ content: cleanText }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setComments((prev) => updateCommentContentInTree(prev, commentId, json.data?.content || cleanText));
        setEditingCommentId(null);
        setEditCommentDraft('');
        showToast(json.message || 'Đã cập nhật bình luận!', 'success');
      } else {
        showToast(json.message || 'Không thể cập nhật bình luận.', 'error');
      }
    } catch {
      showToast('Lỗi kết nối máy chủ khi cập nhật bình luận.', 'error');
    } finally {
      setIsSavingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (deletingCommentId) return;
    setDeletingCommentId(commentId);
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setConfirmDeleteCommentId(null);
        if (bestCommentId && (bestCommentId === commentId || commentSubtreeContainsId(comments, commentId, bestCommentId))) {
          setBestCommentMap((prev) => {
            const next = { ...prev };
            delete next[activeThread.id];
            writeBestCommentMap(next);
            return next;
          });
        }
        await fetchRealComments(true);
        showToast(json.message || 'Đã xóa bình luận!', 'success');
      } else {
        showToast(json.message || 'Không thể xóa bình luận.', 'error');
      }
    } catch {
      showToast('Lỗi kết nối máy chủ khi xóa bình luận.', 'error');
    } finally {
      setDeletingCommentId(null);
    }
  };

  // Add Top-level Comment
  const submitTopLevelComment = async () => {
    if (isSubmitting || !commentText.trim()) return;
    if (!ensureAuthenticated('gửi bình luận')) return;

    setIsSubmitting(true);
    const textToSend = commentText.trim();
    setCommentText('');

    try {
      const res = await fetch(`/api/forum/threads/${encodeURIComponent(activeThread.id)}/comments`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ content: textToSend }),
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        await fetchRealComments();
        showToast('Gửi bình luận thành công!', 'success');
      } else {
        showToast(json.message || 'Không thể gửi bình luận.', 'error');
        setCommentText(textToSend);
      }
    } catch {
      showToast('Không thể kết nối máy chủ để lưu bình luận.', 'error');
      setCommentText(textToSend);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitTopLevelComment();
  };

  // Add Nested Reply to a specific Comment
  const handleSendSubReply = async (parentId: string) => {
    if (isSubmittingReply || !replyInputText.trim()) return;
    if (!ensureAuthenticated('gửi phản hồi')) return;

    setIsSubmittingReply(true);
    const textToSend = replyInputText.trim();
    setReplyInputText('');

    try {
      const res = await fetch(`/api/forum/threads/${encodeURIComponent(activeThread.id)}/comments`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ content: textToSend, parentId }),
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setActiveReplyId(null);
        await fetchRealComments();
        showToast('Gửi phản hồi thành công!', 'success');
      } else {
        showToast(json.message || 'Không thể gửi phản hồi.', 'error');
        setReplyInputText(textToSend);
      }
    } catch {
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

  // Handle Comment Reaction (server derives previous state from DB)
  const handleCommentReaction = async (commentId: string, reactionType: ReactionType) => {
    try {
      const res = await fetch(`/api/forum/comments/${encodeURIComponent(commentId)}/reaction`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reactionType }),
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

  // Handle Main Discussion Thread Reaction (server derives previous state from DB)
  const handleThreadReaction = async (r: ReactionType) => {
    const prev = reaction;
    const next = prev === r ? null : r;

    setReaction(next);
    const summary: Record<string, number> = {
      like: 0,
      love: 0,
      haha: 0,
      wow: 0,
      buon: 0,
      huhu: 0,
      sad: 0,
      angry: 0,
      dislike: 0,
      ...threadReactionsSummary,
    };
    if (prev && summary[prev] !== undefined) {
      summary[prev] = Math.max(0, summary[prev] - 1);
    }
    if (next && summary[next] !== undefined) {
      summary[next] = (summary[next] || 0) + 1;
    }
    setThreadReactionsSummary(summary);

    try {
      const res = await fetch(`/api/forum/threads/${encodeURIComponent(activeThread.id)}/reaction`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reactionType: r }),
      });
      const json = await res.json();
      if (json.success && json.upvotes !== undefined) {
        setThreadUpvotes(json.upvotes);
        if (json.userReaction !== undefined) {
          setReaction(json.userReaction);
        }
        if (json.data) {
          setThreadReactionsSummary(json.data);
        }
        if (onUpdateThreadUpvotes && activeThread) {
          onUpdateThreadUpvotes(activeThread.id, json.upvotes);
        }
        if (onUpdateThreadReaction && activeThread) {
          onUpdateThreadReaction(activeThread.id, json.userReaction, json.data, json.upvotes);
        }
        notifyForumUpdated({ threadId: activeThread.id, userReaction: json.userReaction, reactionsSummary: json.data, upvotes: json.upvotes });
      }
    } catch (err) {
      console.error('[Thread Reaction Error]:', err);
    }
  };

  const renderCommentCard = (comment: CommentItem, isNested = false) => {
    const isReplyingThis = activeReplyId === comment.id;
    const isEditingThis = editingCommentId === comment.id;
    const isConfirmingDeleteThis = confirmDeleteCommentId === comment.id;
    const isDeletingThis = deletingCommentId === comment.id;
    const isBestAnswer = Boolean(bestCommentId && comment.id === bestCommentId);
    const currentCommentReaction = commentReactionsState[comment.id] || comment.userReaction || null;

    const cleanCommentAuthor = comment.authorName.replace(/\(.*\)/, '').trim();
    const cleanThreadAuthor = (activeThread.authorName || '').replace(/\(.*\)/, '').trim();
    const isPostAuthor = cleanCommentAuthor.toLowerCase() === cleanThreadAuthor.toLowerCase();
    const canManageComment = Boolean(
      currentUser &&
        (isStaff || (currentUserId && comment.userId && String(comment.userId) === currentUserId))
    );

    const totalReactions = comment.reactions
      ? Object.values(comment.reactions).reduce((a, b) => a + (Number(b) || 0), 0)
      : 0;

    return (
      <div
        key={comment.id}
        style={{
          background: isBestAnswer
            ? 'color-mix(in srgb, var(--color-primary) 11%, var(--color-bg-card))'
            : isPostAuthor
              ? 'color-mix(in srgb, var(--color-primary) 7%, transparent)'
              : (isNested ? 'var(--color-bg-card)' : 'var(--color-bg-main)'),
          borderRadius: 4,
          padding: '12px 14px',
          border: isBestAnswer || isPostAuthor
            ? '1.5px solid var(--color-primary)'
            : '1px solid var(--color-border)',
          marginLeft: isNested ? 14 : 0,
          marginTop: isNested ? 8 : 0,
          position: 'relative',
        }}
      >
        {isNested && (
          <div style={{ position: 'absolute', left: -13, top: 18, color: 'var(--color-primary)' }}>
            <CornerDownRight size={13} />
          </div>
        )}

        {isBestAnswer && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 10,
              padding: '5px 9px',
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-primary) 38%, transparent)',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.7rem',
                fontWeight: 800,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--color-primary)',
              }}
            >
              <IconCheckCircle size={13} color="var(--color-primary)" />
              Câu Trả Lời Hữu Ích Nhất
            </span>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              Ghim lên đầu thảo luận
            </span>
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            {(() => {
              const isCommentAuthorCurrent = Boolean(
                currentUser && (
                  (currentUser.fullName && cleanCommentAuthor.toLowerCase() === currentUser.fullName.toLowerCase()) ||
                  (currentUser.username && cleanCommentAuthor.toLowerCase() === currentUser.username.toLowerCase())
                )
              );
              const commentEffectiveAvatar = (isCommentAuthorCurrent && (currentUser?.avatarUrl || currentUser?.avatar))
                ? (currentUser.avatarUrl || currentUser.avatar)
                : (comment.authorAvatar || '');

              return (
                <div
                  onClick={() =>
                    onOpenAuthorProfile({
                      name: cleanCommentAuthor,
                      avatar: commentEffectiveAvatar || '',
                      userId: comment.userId,
                    })
                  }
                  style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}
                  title="Bấm để xem hồ sơ người bình luận"
                >
                  {commentEffectiveAvatar ? (
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
                  ) : (
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'color-mix(in srgb, var(--color-sky) 16%, transparent)',
                        border: isPostAuthor ? '1.5px solid var(--color-primary)' : '1.5px solid var(--color-sky)',
                        color: isPostAuthor ? 'var(--color-primary)' : 'var(--color-sky)',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {(cleanCommentAuthor || 'T').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                    {cleanCommentAuthor}
                  </span>
                </div>
              );
            })()}
            {isPostAuthor && (
              <span
                style={{
                  background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                  border: '1px solid var(--color-primary)',
                  color: 'var(--color-primary)',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '1px 7px',
                  borderRadius: 4,
                }}
              >
                Tác giả
              </span>
            )}
          </div>

          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            {formatDisplayDate(comment.createdAt)}
          </span>
        </div>

        {/* Content or Inline Edit Box */}
        {isEditingThis ? (
          <div style={{ paddingLeft: isNested ? 0 : 12, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              className="form-input"
              rows={2}
              value={editCommentDraft}
              onChange={(e) => setEditCommentDraft(e.target.value)}
              disabled={isSavingComment}
              maxLength={2000}
              style={{ width: '100%', fontSize: '0.84rem', padding: '7px 10px', borderRadius: 4, resize: 'vertical' }}
              onKeyDown={(e) => {
                if (!e.nativeEvent.isComposing && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  void handleSaveCommentEdit(comment.id);
                }
              }}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={isSavingComment}
                onClick={() => {
                  setEditingCommentId(null);
                  setEditCommentDraft('');
                }}
                style={{ padding: '4px 10px', fontSize: '0.74rem', borderRadius: 4 }}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isSavingComment || !editCommentDraft.trim()}
                onClick={() => handleSaveCommentEdit(comment.id)}
                style={{ padding: '4px 12px', fontSize: '0.74rem', fontWeight: 700, borderRadius: 4 }}
              >
                {isSavingComment ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.86rem', color: 'var(--color-text-main)', lineHeight: 1.5, marginBottom: 10, paddingLeft: isNested ? 8 : 12, whiteSpace: 'pre-wrap' }}>
            {comment.content}
          </div>
        )}

        {/* Action Row: Reaction Picker + Reply + Owner/Admin Edit/Delete */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: isNested ? 8 : 12, paddingTop: 4, flexWrap: 'wrap' }}>
          <FacebookReactionPicker
            currentReaction={currentCommentReaction}
            totalLikes={totalReactions}
            reactionsSummary={comment.reactions as unknown as Record<string, number>}
            onSelectReaction={(r) => handleCommentReaction(comment.id, r)}
          />

          {!isNested && !activeThread.isLocked && (
            <button
              type="button"
              onClick={() => {
                if (!isReplyingThis && !ensureAuthenticated('trả lời bình luận')) return;
                setActiveReplyId(isReplyingThis ? null : comment.id);
                setReplyInputText('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: isReplyingThis ? 'var(--color-primary)' : 'var(--color-text-muted)',
                fontSize: '0.8rem',
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

          {canPinBestAnswer && !isEditingThis && (
            <button
              type="button"
              onClick={() => handleToggleBestComment(comment.id)}
              style={{
                background: isBestAnswer ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'none',
                border: isBestAnswer
                  ? '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)'
                  : 'none',
                borderRadius: 4,
                padding: isBestAnswer ? '2px 7px' : 0,
                color: isBestAnswer ? 'var(--color-text-muted)' : 'var(--color-primary)',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              title={isBestAnswer ? 'Bỏ ghim câu trả lời hữu ích nhất' : 'Chọn làm Câu Trả Lời Hữu Ích Nhất'}
            >
              {isBestAnswer ? (
                <>
                  <IconPinOff size={12} /> Bỏ ghim hữu ích
                </>
              ) : (
                <>
                  <IconCheckCircle size={12} color="var(--color-primary)" /> Hữu ích nhất
                </>
              )}
            </button>
          )}

          {canManageComment && !isEditingThis && (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditingCommentId(comment.id);
                  setEditCommentDraft(comment.content);
                  setConfirmDeleteCommentId(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <IconEdit size={12} /> Sửa
              </button>

              {isConfirmingDeleteThis ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={isDeletingThis}
                    onClick={() => handleDeleteComment(comment.id)}
                    style={{ padding: '2px 8px', fontSize: '0.72rem', fontWeight: 800, borderRadius: 4 }}
                  >
                    {isDeletingThis ? 'Đang xóa...' : 'Xác nhận xóa'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={isDeletingThis}
                    onClick={() => setConfirmDeleteCommentId(null)}
                    style={{ padding: '2px 7px', fontSize: '0.72rem', borderRadius: 4 }}
                  >
                    Hủy
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteCommentId(comment.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-error-text, var(--color-error))',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <IconTrash size={12} color="var(--color-error-text, var(--color-error))" /> Xóa
                </button>
              )}
            </>
          )}
        </div>

        {/* Inline Reply Input Box */}
        {isReplyingThis && (
          <div style={{ marginTop: 12, paddingLeft: isNested ? 0 : 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                rows={2}
                className="form-input"
                aria-label={`Trả lời ${cleanCommentAuthor}`}
                placeholder={`Trả lời ${cleanCommentAuthor}... (Ctrl+Enter để gửi)`}
                value={replyInputText}
                onChange={(e) => setReplyInputText(e.target.value)}
                disabled={isSubmittingReply}
                maxLength={2000}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: '0.82rem',
                  padding: '7px 10px',
                  borderRadius: 4,
                  resize: 'vertical',
                  minHeight: 48,
                  lineHeight: 1.45,
                }}
                onKeyDown={(e) => {
                  if (!e.nativeEvent.isComposing && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    void handleSendSubReply(comment.id);
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleSendSubReply(comment.id)}
                disabled={isSubmittingReply || !replyInputText.trim()}
                style={{ padding: '8px 14px', fontSize: '0.8rem', borderRadius: 4, alignSelf: 'stretch' }}
              >
                {isSubmittingReply ? <Loader2 size={13} className="spin" /> : 'Gửi'}
              </button>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>
              Mẹo: nhấn <strong>Ctrl+Enter</strong> (hoặc <strong>Cmd+Enter</strong>) để gửi nhanh • <strong>Esc</strong> để hủy
            </div>
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
            if (e.target === e.currentTarget && !isLightboxOpen && !isBusyCloseLock) {
              onClose();
            }
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
          }}
        >
          <div
            ref={dialogRef}
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-label={activeThread.title}
            tabIndex={-1}
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
              border: '1px solid var(--color-border-strong)',
              borderRadius: 6,
              padding: '22px 24px',
              boxShadow: 'var(--shadow-3d)',
              position: 'relative',
              margin: 0,
              outline: 'none',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className={`badge ${activeThread.category === 'Cảnh Báo' ? 'badge-error' : 'badge-success'}`}>
                  {activeThread.category}
                </span>

                {/* Post Author Clickable Header */}
                {(() => {
                  const cleanName = activeThread.authorName.replace(/\(.*\)/, '').trim();
                  const isCurrentUserAuthor = Boolean(
                    currentUser && (
                      (activeThread.userId && currentUser.id && String(activeThread.userId) === String(currentUser.id)) ||
                      (currentUser.fullName && cleanName.toLowerCase() === currentUser.fullName.toLowerCase()) ||
                      (currentUser.username && cleanName.toLowerCase() === currentUser.username.toLowerCase())
                    )
                  );
                  const effectiveAvatar = (isCurrentUserAuthor && (currentUser?.avatarUrl || currentUser?.avatar))
                    ? (currentUser.avatarUrl || currentUser.avatar)
                    : (activeThread.authorAvatar || '');

                  return (
                    <div
                      onClick={() => onOpenAuthorProfile({
                        name: cleanName,
                        avatar: effectiveAvatar || '',
                        userId: activeThread.userId,
                      })}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                      title="Bấm để xem hồ sơ tác giả bài viết"
                    >
                      {effectiveAvatar ? (
                        <img
                          src={effectiveAvatar}
                          alt={cleanName}
                          referrerPolicy="no-referrer"
                          style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--color-primary)', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
                            border: '1px solid var(--color-primary)',
                            color: 'var(--color-primary)',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {(cleanName || 'T').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)', textDecoration: 'underline' }}>
                        {cleanName}
                      </span>
                    </div>
                  );
                })()}

                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-dim)' }}>
                  • {formatDisplayDate(activeThread.createdAt)}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {canManageThread && !isEditingThread && (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={openEditThread}
                      style={{
                        padding: '4px 9px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        borderRadius: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <IconEdit size={12} /> Chỉnh sửa
                    </button>

                    {confirmDeleteThread ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={isDeletingThread}
                          onClick={handleDeleteThread}
                          style={{ padding: '4px 9px', fontSize: '0.74rem', fontWeight: 800, borderRadius: 4 }}
                        >
                          {isDeletingThread ? 'Đang xóa...' : 'Xác nhận xóa'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          disabled={isDeletingThread}
                          onClick={() => setConfirmDeleteThread(false)}
                          style={{ padding: '4px 8px', fontSize: '0.74rem', borderRadius: 4 }}
                        >
                          Hủy
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setConfirmDeleteThread(true)}
                        style={{
                          padding: '4px 9px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          borderRadius: 4,
                          color: 'var(--color-error-text, var(--color-error))',
                          borderColor: 'color-mix(in srgb, var(--color-error) 35%, transparent)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <IconTrash size={12} color="var(--color-error-text, var(--color-error))" /> Xóa bài
                      </button>
                    )}
                  </>
                )}

                <button
                  type="button"
                  disabled={isBusyCloseLock}
                  onClick={() => {
                    if (!isBusyCloseLock) onClose();
                  }}
                  aria-label="Đóng (Esc)"
                  title="Đóng (Esc)"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: isBusyCloseLock ? 'not-allowed' : 'pointer',
                    opacity: isBusyCloseLock ? 0.5 : 1,
                    padding: 4,
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: 6, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {isEditingThread ? (
                <form
                  onSubmit={handleSaveThreadEdit}
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: 4,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                      Chỉnh sửa bài thảo luận
                    </span>
                    <select
                      className="form-select"
                      value={editThreadCategory}
                      onChange={(e) => setEditThreadCategory(e.target.value as ForumThread['category'])}
                      style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: 4 }}
                    >
                      {THREAD_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="text"
                    className="form-input"
                    value={editThreadTitle}
                    onChange={(e) => setEditThreadTitle(e.target.value)}
                    placeholder="Tiêu đề bài viết..."
                    maxLength={200}
                    required
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.9rem', fontWeight: 700, borderRadius: 4 }}
                  />

                  <textarea
                    className="form-input"
                    rows={5}
                    value={editThreadContent}
                    onChange={(e) => setEditThreadContent(e.target.value)}
                    placeholder="Nội dung chi tiết..."
                    maxLength={8000}
                    required
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: 4, resize: 'vertical', lineHeight: 1.55 }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={isSavingThread}
                      onClick={() => setIsEditingThread(false)}
                      style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: 4 }}
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isSavingThread || !editThreadTitle.trim() || !editThreadContent.trim()}
                      style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: 800, borderRadius: 4 }}
                    >
                      {isSavingThread ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Title */}
                  <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)', margin: 0, lineHeight: 1.4 }}>
                    {activeThread.title}
                  </h2>

                  {/* Full Content */}
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', lineHeight: 'var(--line-height-normal)', margin: 0, background: 'var(--color-bg-main)', padding: 16, borderRadius: 4, border: '1px solid var(--color-border)', whiteSpace: 'pre-wrap' }}>
                    {activeThread.content}
                  </p>
                </>
              )}

              {/* Attached Real Photos Gallery */}
              {activeImages.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Hình Ảnh Thực Tế Từ Chuyến Đi ({activeImages.length})
                  </span>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: activeImages.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: 10,
                    }}
                  >
                    {activeImages.map((imgSrc, idx) => (
                      <div
                        key={idx}
                        onClick={() => setLightboxIndex(idx)}
                        style={{
                          position: 'relative',
                          height: activeImages.length === 1 ? 280 : 160,
                          borderRadius: 4,
                          overflow: 'hidden',
                          border: '1px solid var(--color-border)',
                          cursor: 'zoom-in',
                          background: 'var(--color-bg-main)',
                          boxShadow: 'var(--shadow-card)',
                          transition: 'transform 0.2s ease, border-color 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-primary)';
                          e.currentTarget.style.transform = 'scale(1.01)';
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
                            background: 'var(--overlay-bg)',
                            backdropFilter: 'blur(6px)',
                            color: 'var(--color-on-media)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 4,
                            border: '1px solid var(--color-border-strong)',
                          }}
                        >
                          Ảnh #{idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Row: Thread Reaction Picker + Live Views & Comments */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', padding: '12px 0' }}>
                <FacebookReactionPicker
                  currentReaction={reaction}
                  totalLikes={threadUpvotes}
                  reactionsSummary={threadReactionsSummary}
                  onSelectReaction={(r) => handleThreadReaction(r)}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-dim)', display: 'inline-flex', alignItems: 'center', gap: 5, fontVariantNumeric: 'tabular-nums' }}>
                    <IconEye size={14} color="var(--color-text-dim)" /> {activeThread.viewsCount || 1} lượt xem
                  </span>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
                    <MessageSquare size={16} color="var(--color-sky)" /> {totalCommentCount} Bình luận
                  </span>
                </div>
              </div>

              {/* Comments List Section */}
              <div>
                <h4 style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', marginBottom: 12 }}>
                  Cộng đồng thảo luận ({totalCommentCount})
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {loadingComments ? (
                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-primary)', fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <Loader2 size={18} className="spin" /> Đang tải bình luận...
                    </div>
                  ) : comments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', background: 'var(--color-bg-main)', borderRadius: 4, border: '1px dashed var(--color-border)' }}>
                      Chưa có bình luận nào. Hãy là người đầu tiên gửi chia sẻ của bạn!
                    </div>
                  ) : (
                    orderedComments.map((c) => renderCommentCard(c, false))
                  )}
                </div>
              </div>
            </div>

            {/* Top-level Comment Input Box Form (Disabled when thread is locked) */}
            {activeThread.isLocked ? (
              <div style={{ marginTop: 14, padding: '12px 14px', borderTop: '1px solid var(--color-border)', borderRadius: 4, background: 'var(--banner-danger-bg)', color: 'var(--banner-danger-text)', fontSize: '0.82rem', fontWeight: 700, textAlign: 'center' }}>
                Chủ đề này đã được Ban Quản Trị khóa bình luận.
              </div>
            ) : (
              <form
                onSubmit={handleAddComment}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <textarea
                    rows={2}
                    className="form-input"
                    aria-label="Viết bình luận"
                    placeholder={isSubmitting ? 'Đang lưu bình luận...' : 'Viết bình luận của bạn vào đây... (Ctrl+Enter để gửi)'}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    disabled={isSubmitting}
                    maxLength={2000}
                    style={{
                      flex: 1,
                      fontSize: 'var(--font-size-sm)',
                      borderRadius: 4,
                      resize: 'vertical',
                      minHeight: 50,
                      lineHeight: 1.45,
                      padding: '8px 12px',
                    }}
                    onKeyDown={(e) => {
                      if (!e.nativeEvent.isComposing && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        void submitTopLevelComment();
                      }
                    }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting || !commentText.trim()}
                    style={{
                      padding: '0 16px',
                      minHeight: 50,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      opacity: isSubmitting ? 0.6 : 1,
                      borderRadius: 4,
                    }}
                  >
                    {isSubmitting ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Gửi
                  </button>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>
                  Nhấn <strong>Ctrl+Enter</strong> (hoặc <strong>Cmd+Enter</strong>) để gửi nhanh • <strong>Enter</strong> để xuống dòng
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Interactive Fullscreen Gallery Lightbox */}
      {isLightboxOpen && lightboxIndex !== null && createPortal(
        <div
          ref={lightboxRef}
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh phóng to"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            setLightboxIndex(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 'var(--z-lightbox, 4000)',
            background: 'var(--overlay-bg)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 24px 28px',
            userSelect: 'none',
            outline: 'none',
          }}
        >
          {/* Top Bar */}
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
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 4,
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-strong)',
                color: 'var(--color-text-main)',
                fontSize: '0.84rem',
                fontWeight: 700,
              }}
            >
              <IconImage size={15} color="var(--color-primary)" />
              <span>Ảnh {lightboxIndex + 1} / {activeImages.length}</span>
            </div>

            <button
              ref={lightboxCloseBtnRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(null);
              }}
              aria-label="Đóng xem ảnh"
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 4,
                width: 40,
                height: 40,
                color: 'var(--color-text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Đóng xem ảnh (Esc)"
            >
              <X size={20} color="currentColor" />
            </button>
          </div>

          {/* Main Image Container */}
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
            {activeImages.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : activeImages.length - 1));
                }}
                aria-label="Ảnh trước"
                style={{
                  position: 'absolute',
                  left: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 20,
                  width: 46,
                  height: 46,
                  borderRadius: 4,
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border-strong)',
                  color: 'var(--color-text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-card)',
                }}
                title="Ảnh trước"
              >
                <IconChevronLeft size={24} />
              </button>
            )}

            <img
              src={activeImages[lightboxIndex]}
              alt={`Ảnh ${lightboxIndex + 1}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '88vw',
                maxHeight: '70vh',
                borderRadius: 4,
                boxShadow: 'var(--shadow-3d)',
                objectFit: 'contain',
                border: '1px solid var(--color-border-strong)',
              }}
            />

            {activeImages.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev !== null && prev < activeImages.length - 1 ? prev + 1 : 0));
                }}
                aria-label="Ảnh tiếp theo"
                style={{
                  position: 'absolute',
                  right: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 20,
                  width: 46,
                  height: 46,
                  borderRadius: 4,
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border-strong)',
                  color: 'var(--color-text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-card)',
                }}
                title="Ảnh tiếp theo"
              >
                <IconChevronRight size={24} />
              </button>
            )}
          </div>

          {/* Bottom Thumbnail Strip */}
          {activeImages.length > 1 && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 14,
                padding: '8px 12px',
                borderRadius: 4,
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-strong)',
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
                      height: 46,
                      borderRadius: 4,
                      overflow: 'hidden',
                      padding: 0,
                      border: isActive ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      opacity: isActive ? 1 : 0.6,
                      cursor: 'pointer',
                      background: 'var(--color-bg-main)',
                      flexShrink: 0,
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
