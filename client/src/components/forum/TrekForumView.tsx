import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  IconRotateCw,
} from '../common/SvgIcons.js';
import { uploadImageToCloudinary } from '../../services/api.js';
import { mockTrails } from '../../data/seedData.js';
import { AlpineExpeditionFeed } from './AlpineExpeditionFeed.js';
import { AuthorProfileModal } from './AuthorProfileModal.js';
import type { AuthorProfileData } from './AuthorProfileModal.js';
import { LiveTrekkerChatroom } from './LiveTrekkerChatroom.js';
import { SummitAltitudeLadder } from '../landing/SummitAltitudeLadder.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { useSocket } from '../../hooks/useSocket.js';
import { useFocusTrap, isTopmostFocusTrap } from '../../hooks/useFocusTrap.js';
import { safeLocalStorageGet } from '../../utils/storageScope.js';

type ForumSortOption = 'newest' | 'popular' | 'most_commented';
type ForumThreadWithTrail = ForumThread & { trailId?: string; trailName?: string };

interface TopTrekker {
  _id: string;
  fullName: string;
  avatarUrl?: string;
  reputationScore: number;
  badges?: string[];
  role?: string;
}

interface AttachedImageDraft {
  id: string;
  src: string;
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

const FORUM_PAGE_LIMIT = 12;
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const GPX_VAULT_TRAIL_SPECS: Array<{ id: string; shortName: string }> = [
  { id: 'trail-laothan', shortName: 'Lảo Thẩn Y Tý' },
  { id: 'trail-fansipan', shortName: 'Fansipan Trạm Tôn' },
  { id: 'trail-kyquansan', shortName: 'Kỳ Quan San' },
  { id: 'trail-putaleng', shortName: 'Pu Ta Leng' },
  { id: 'trail-taxua', shortName: 'Tà Xùa · Sống Lưng Khủng Long' },
];

export const TrekForumView: React.FC<TrekForumViewProps> = ({
  onBack,
  isEmbedded = false,
  onShowToast,
  currentUser,
  onRequireLogin,
  trails,
  onSelectTrail,
}) => {
  const [threads, setThreads] = useState<ForumThreadWithTrail[]>([]);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [threadsRefreshTick, setThreadsRefreshTick] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<ForumSortOption>('newest');
  const [forumCategory, setForumCategory] = useState<string>('All');
  const [externalCategorySync, setExternalCategorySync] = useState<{ category: string; seq: number } | null>(null);
  const [page, setPage] = useState<number>(1);
  const [hasMoreThreads, setHasMoreThreads] = useState<boolean>(false);
  const [loadingMoreThreads, setLoadingMoreThreads] = useState<boolean>(false);
  const [loadedQueryKey, setLoadedQueryKey] = useState<string | null>(null);
  const [topTrekkers, setTopTrekkers] = useState<TopTrekker[]>([]);
  const [failedTopTrekkerAvatars, setFailedTopTrekkerAvatars] = useState<Record<string, boolean>>({});
  const [sidebarAuthor, setSidebarAuthor] = useState<AuthorProfileData | null>(null);
  const [isNewThreadOpen, setIsNewThreadOpen] = useState(false);
  const { socket } = useSocket();

  // New Thread Form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'Hỏi Đáp' | 'Kinh Nghiệm' | 'Tìm Đồng Đội' | 'Cảnh Báo'>('Kinh Nghiệm');
  const [newTrailId, setNewTrailId] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newImages, setNewImages] = useState<AttachedImageDraft[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [newThreadError, setNewThreadError] = useState<string | null>(null);
  const [isSubmittingThread, setIsSubmittingThread] = useState(false);

  const newThreadDialogRef = useRef<HTMLDivElement | null>(null);
  const loadMoreAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef<boolean>(true);
  const imageSeqRef = useRef<number>(0);

  const availableTrails = useMemo(() => (trails && trails.length > 0 ? trails : mockTrails), [trails]);
  const forumQueryKey = `${debouncedSearch}|${sortBy}|${forumCategory}|${threadsRefreshTick}`;
  const forumQueryKeyRef = useRef<string>(forumQueryKey);
  const loadingThreads = loadedQueryKey !== forumQueryKey;

  // Derive GPX vault entries from canonical trail metadata (Rule 11 single source of truth)
  const gpxVaultItems = useMemo(() => {
    const byId = new Map<string, Trail>();
    for (const t of availableTrails) {
      if (t.id) byId.set(t.id, t);
    }
    return GPX_VAULT_TRAIL_SPECS.map((spec) => {
      const canonical = byId.get(spec.id) || mockTrails.find((t) => t.id === spec.id);
      const altStr = canonical?.maxAltitudeM ? ` (${canonical.maxAltitudeM.toLocaleString('vi-VN')}m)` : '';
      const distStr =
        canonical && typeof canonical.distanceKm === 'number' && Number.isFinite(canonical.distanceKm)
          ? `${canonical.distanceKm.toFixed(1)} km`
          : '';
      return {
        id: spec.id,
        name: `${spec.shortName}${altStr}`,
        dist: distStr,
      };
    });
  }, [availableTrails]);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      if (onShowToast) {
        onShowToast(message, type);
      } else {
        window.dispatchEvent(new CustomEvent('lost:show-toast', { detail: { message, type } }));
      }
    },
    [onShowToast]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (loadMoreAbortRef.current) {
        loadMoreAbortRef.current.abort();
        loadMoreAbortRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    forumQueryKeyRef.current = forumQueryKey;
    if (loadMoreAbortRef.current) {
      loadMoreAbortRef.current.abort();
      loadMoreAbortRef.current = null;
    }
  }, [forumQueryKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

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
      showToast('Tối đa 8 ảnh cho mỗi bài chia sẻ nhé.', 'info');
    }

    const availableSlots = Math.max(0, 8 - newImages.length);
    const filesToProcess = Array.from(files).slice(0, availableSlots);

    filesToProcess.forEach((file) => {
      if (!ALLOWED_IMAGE_MIME.has(file.type)) {
        showToast('Chỉ hỗ trợ ảnh định dạng JPG, PNG, WebP hoặc GIF thôi nhé.', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('Ảnh hơi nặng — chọn ảnh dưới 5MB giúp mình nhé.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => {
        if (mountedRef.current) {
          showToast('Không thể đọc tệp ảnh này, bạn thử chọn lại nhé.', 'error');
        }
      };
      reader.onload = (event) => {
        if (!mountedRef.current) return;
        const result = event.target?.result as string;
        if (!result) return;
        const img = new Image();
        img.onerror = () => {
          if (mountedRef.current) {
            showToast('Ảnh bị lỗi hoặc không hợp lệ.', 'error');
          }
        };
        img.onload = () => {
          if (!mountedRef.current) return;
          if (!img.width || !img.height) {
            showToast('Ảnh không hợp lệ.', 'error');
            return;
          }
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1280;
          const scale = Math.min(1, MAX_WIDTH / img.width);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          const nextId = `img-${Date.now()}-${++imageSeqRef.current}`;
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const compressed = canvas.toDataURL('image/jpeg', 0.82);
            setNewImages((prev) => (prev.length < 8 ? [...prev, { id: nextId, src: compressed }] : prev));
          } else {
            setNewImages((prev) => (prev.length < 8 ? [...prev, { id: nextId, src: result }] : prev));
          }
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleAddImageUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      showToast('Link ảnh cần bắt đầu bằng https:// hoặc http:// nhé.', 'error');
      return;
    }
    if (newImages.length >= 8) {
      showToast('Đã đủ 8 ảnh đính kèm rồi.', 'info');
      return;
    }
    const nextId = `url-${Date.now()}-${++imageSeqRef.current}`;
    setNewImages((prev) => [...prev, { id: nextId, src: trimmed }]);
    setImageUrlInput('');
  };

  const handleRemoveImage = (idToRemove: string) => {
    setNewImages((prev) => prev.filter((item) => item.id !== idToRemove));
  };

  const sortPinnedFirst = useCallback(
    (list: ForumThreadWithTrail[]) => {
      return [...list].sort((a, b) => {
        const pinDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
        if (pinDiff !== 0) return pinDiff;
        if (sortBy === 'popular') {
          const upDiff = (b.upvotes || 0) - (a.upvotes || 0);
          if (upDiff !== 0) return upDiff;
        } else if (sortBy === 'most_commented') {
          const repDiff = (b.repliesCount || 0) - (a.repliesCount || 0);
          if (repDiff !== 0) return repDiff;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    },
    [sortBy]
  );

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('limit', String(FORUM_PAGE_LIMIT));
    params.set('sort', sortBy);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (forumCategory && forumCategory !== 'All') params.set('category', forumCategory);

    fetch(`/api/forum?${params.toString()}`, {
      headers: getApiHeaders(),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data?.success && Array.isArray(data.data)) {
          setThreads(data.data);
          setThreadsError(null);
          setPage(1);
          const pag = data.pagination;
          setHasMoreThreads(
            Boolean(
              pag &&
                ((typeof pag.hasMore === 'boolean' && pag.hasMore) ||
                  (typeof pag.totalPages === 'number' && pag.totalPages > 1) ||
                  (typeof pag.total === 'number' && data.data.length < pag.total))
            )
          );
        } else {
          setThreadsError(data?.message || 'Chưa tải được bài viết diễn đàn lúc này.');
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error('Failed to load forum threads', err);
          setThreadsError('Chưa tải được bài viết diễn đàn lúc này. Bạn kiểm tra mạng rồi thử lại nhé.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadedQueryKey(forumQueryKey);
          setLoadingMoreThreads(false);
        }
      });

    return () => controller.abort();
  }, [forumQueryKey, debouncedSearch, sortBy, forumCategory]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/forum/top-trekkers', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!controller.signal.aborted && data?.success && Array.isArray(data.data)) {
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

  const handleLoadMoreThreads = useCallback(async () => {
    if (loadingMoreThreads || !hasMoreThreads) return;
    const reqKey = forumQueryKeyRef.current;
    const nextPage = page + 1;

    if (loadMoreAbortRef.current) {
      loadMoreAbortRef.current.abort();
    }
    const controller = new AbortController();
    loadMoreAbortRef.current = controller;

    setLoadingMoreThreads(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(nextPage));
      params.set('limit', String(FORUM_PAGE_LIMIT));
      params.set('sort', sortBy);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (forumCategory && forumCategory !== 'All') params.set('category', forumCategory);

      const res = await fetch(`/api/forum?${params.toString()}`, {
        headers: getApiHeaders(),
        signal: controller.signal,
      });
      const data = await res.json();
      if (controller.signal.aborted || forumQueryKeyRef.current !== reqKey) return;

      if (res.ok && data?.success && Array.isArray(data.data)) {
        const incoming: ForumThreadWithTrail[] = data.data;
        setThreads((prev) => {
          const seen = new Set(prev.map((t) => String(t.id)));
          return [...prev, ...incoming.filter((t) => !seen.has(String(t.id)))];
        });
        setPage(nextPage);
        const pag = data.pagination;
        setHasMoreThreads(
          Boolean(
            incoming.length > 0 &&
              pag &&
              ((typeof pag.hasMore === 'boolean' && pag.hasMore) ||
                (typeof pag.totalPages === 'number' && nextPage < pag.totalPages))
          )
        );
      } else {
        showToast(data?.message || 'Chưa tải thêm được bài mới, bạn thử lại nhé.', 'error');
      }
    } catch (err: unknown) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (!isAbort && !controller.signal.aborted) {
        showToast('Chưa tải thêm được bài mới, bạn thử lại sau ít phút nhé.', 'error');
      }
    } finally {
      if (loadMoreAbortRef.current === controller) {
        loadMoreAbortRef.current = null;
      }
      if (!controller.signal.aborted && forumQueryKeyRef.current === reqKey) {
        setLoadingMoreThreads(false);
      }
    }
  }, [loadingMoreThreads, hasMoreThreads, page, sortBy, debouncedSearch, forumCategory, showToast]);

  const handleThreadUpdated = useCallback(
    (updated: ForumThread) => {
      setThreads((prev) =>
        sortPinnedFirst(
          prev.map((t) =>
            String(t.id) === String(updated.id)
              ? { ...t, ...updated, userReaction: updated.userReaction !== undefined ? updated.userReaction : t.userReaction }
              : t
          )
        )
      );
    },
    [sortPinnedFirst]
  );

  const handleThreadDeleted = useCallback((threadId: string) => {
    setThreads((prev) => prev.filter((t) => String(t.id) !== String(threadId)));
  }, []);

  // Real-time socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewComment = (data: { threadId?: string; repliesCount?: number }) => {
      if (!data?.threadId) return;
      setThreads((prev) =>
        prev.map((t) =>
          String(t.id) === String(data.threadId)
            ? { ...t, repliesCount: data.repliesCount !== undefined ? data.repliesCount : t.repliesCount + 1 }
            : t
        )
      );
    };

    const handleCommentDeleted = (data: { threadId?: string; repliesCount?: number }) => {
      if (!data?.threadId) return;
      setThreads((prev) =>
        prev.map((t) =>
          String(t.id) === String(data.threadId)
            ? {
                ...t,
                repliesCount:
                  data.repliesCount !== undefined ? data.repliesCount : Math.max(0, (t.repliesCount || 0) - 1),
              }
            : t
        )
      );
    };

    const handleThreadReaction = (data: {
      threadId?: string;
      upvotes?: number;
      reactions?: ForumThread['reactions'];
    }) => {
      if (!data?.threadId) return;
      setThreads((prev) =>
        prev.map((t) =>
          String(t.id) === String(data.threadId)
            ? { ...t, upvotes: data.upvotes !== undefined ? data.upvotes : t.upvotes, reactions: data.reactions || t.reactions }
            : t
        )
      );
    };

    const handleSocketThreadUpdated = (data: { threadId?: string; thread?: ForumThreadWithTrail }) => {
      if (!data?.thread) return;
      const incoming = data.thread;
      setThreads((prev) =>
        sortPinnedFirst(
          prev.map((t) =>
            String(t.id) === String(data.threadId || incoming.id)
              ? { ...t, ...incoming, userReaction: t.userReaction }
              : t
          )
        )
      );
    };

    const handleSocketThreadDeleted = (data: { threadId?: string }) => {
      if (!data?.threadId) return;
      setThreads((prev) => prev.filter((t) => String(t.id) !== String(data.threadId)));
    };

    const handleSocketThreadPinned = (data: { threadId?: string; isPinned?: boolean }) => {
      if (!data?.threadId) return;
      setThreads((prev) =>
        sortPinnedFirst(
          prev.map((t) =>
            String(t.id) === String(data.threadId)
              ? { ...t, isPinned: Boolean(data.isPinned) }
              : t
          )
        )
      );
    };

    const handleSocketThreadLocked = (data: { threadId?: string; isLocked?: boolean }) => {
      if (!data?.threadId) return;
      setThreads((prev) =>
        prev.map((t) =>
          String(t.id) === String(data.threadId)
            ? { ...t, isLocked: Boolean(data.isLocked) }
            : t
        )
      );
    };

    socket.on('newComment', handleNewComment);
    socket.on('commentDeleted', handleCommentDeleted);
    socket.on('threadReactionUpdate', handleThreadReaction);
    socket.on('threadUpdated', handleSocketThreadUpdated);
    socket.on('threadDeleted', handleSocketThreadDeleted);
    socket.on('threadPinned', handleSocketThreadPinned);
    socket.on('threadLocked', handleSocketThreadLocked);

    return () => {
      socket.off('newComment', handleNewComment);
      socket.off('commentDeleted', handleCommentDeleted);
      socket.off('threadReactionUpdate', handleThreadReaction);
      socket.off('threadUpdated', handleSocketThreadUpdated);
      socket.off('threadDeleted', handleSocketThreadDeleted);
      socket.off('threadPinned', handleSocketThreadPinned);
      socket.off('threadLocked', handleSocketThreadLocked);
    };
  }, [socket, sortPinnedFirst]);

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingThread) return;
    const token = safeLocalStorageGet('lost_token');
    if (!currentUser && !token) {
      if (onRequireLogin) onRequireLogin('chia sẻ chuyện rừng mới');
      else window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
      return;
    }

    const cleanTitle = newTitle.trim();
    const cleanContent = newContent.trim();
    if (!cleanTitle || !cleanContent) {
      const errMsg = 'Vui lòng nhập đầy đủ tiêu đề và nội dung bài viết (không chỉ khoảng trắng).';
      setNewThreadError(errMsg);
      showToast(errMsg, 'error');
      return;
    }

    setNewThreadError(null);
    setIsSubmittingThread(true);
    try {
      const uploadedImages: string[] = [];
      for (let i = 0; i < newImages.length; i++) {
        const img = newImages[i].src;
        if (img.startsWith('data:image/')) {
          try {
            const cloudUrl = await uploadImageToCloudinary(img, `forum_${Date.now()}_${i}.jpg`, 'forum');
            uploadedImages.push(cloudUrl);
          } catch {
            const uploadErr = `Chưa tải được ảnh #${i + 1} lên máy chủ ảnh. Đã dừng đăng bài để không làm mất ảnh.`;
            setNewThreadError(uploadErr);
            showToast(uploadErr, 'error');
            return;
          }
        } else {
          uploadedImages.push(img);
        }
      }

      const chosenTrail = newTrailId
        ? availableTrails.find((t) => t.id === newTrailId || (t as Trail & { _id?: string })._id === newTrailId)
        : null;

      const res = await fetch('/api/forum', {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title: cleanTitle,
          category: newCategory,
          trailId: chosenTrail ? chosenTrail.id : '',
          trailName: chosenTrail ? chosenTrail.name : '',
          content: cleanContent,
          images: uploadedImages,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.data) {
        const createdThread = data.data as ForumThreadWithTrail;
        const createdCategory = createdThread.category || newCategory;
        const categoryMismatch = forumCategory !== 'All' && forumCategory !== createdCategory;

        if (debouncedSearch) {
          setSearchQuery('');
          setDebouncedSearch('');
        }
        if (categoryMismatch) {
          setForumCategory(createdCategory);
          setExternalCategorySync((prev) => ({ category: createdCategory, seq: (prev?.seq || 0) + 1 }));
        } else {
          setExternalCategorySync((prev) => ({
            category: forumCategory === 'All' ? 'All' : createdCategory,
            seq: (prev?.seq || 0) + 1,
          }));
        }

        setThreads((prev) => sortPinnedFirst([createdThread, ...prev.filter((t) => String(t.id) !== String(createdThread.id))]));
        setThreadsError(null);
        setIsNewThreadOpen(false);
        setNewTitle('');
        setNewTrailId('');
        setNewContent('');
        setNewImages([]);
        setImageUrlInput('');
        setNewThreadError(null);
        showToast('Bài đã lên sóng! Cảm ơn bạn đã góp chuyện rừng (+15 điểm uy tín).', 'success');
      } else {
        const msg = data.message || 'Chưa đăng được bài, bạn thử lại nhé';
        setNewThreadError(msg);
        showToast(msg, 'error');
      }
    } catch {
      const msg = 'Mất kết nối rồi, bạn kiểm tra lại mạng nhé';
      setNewThreadError(msg);
      showToast(msg, 'error');
    } finally {
      if (mountedRef.current) {
        setIsSubmittingThread(false);
      }
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
              <IconArrowLeft size={16} /> Về trang chủ
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary interactive-click"
              onClick={() => {
                const token = safeLocalStorageGet('lost_token');
                if (!currentUser && !token) {
                  if (onRequireLogin) {
                    onRequireLogin('chia sẻ chuyện rừng cùng anh em');
                  } else {
                    showToast('Đăng nhập để chia sẻ chuyện rừng cùng anh em nhé.', 'info');
                    window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
                  }
                  return;
                }
                setNewThreadError(null);
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
              <IconPlus size={16} color="var(--color-on-primary)" /> Chia sẻ chuyện rừng
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
            onOpenAuthorProfile={(auth) =>
              setSidebarAuthor({
                userId: auth.userId,
                name: auth.name,
                avatar: auth.avatar,
              })
            }
          />

          {/* Forum Load Error Banner with Retry */}
          {threadsError && !loadingThreads && (
            <div
              role="alert"
              style={{
                padding: '12px 16px',
                borderRadius: 4,
                background: 'var(--banner-danger-bg)',
                border: '1px solid var(--banner-danger-border)',
                color: 'var(--banner-danger-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                fontSize: '0.82rem',
                fontWeight: 600,
              }}
            >
              <span>{threadsError}</span>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setThreadsRefreshTick((t) => t + 1)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 4,
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <IconRotateCw size={12} />
                <span>Thử lại</span>
              </button>
            </div>
          )}

          {/* 2. Full Alpine Expedition Feed & Discussions */}
          <AlpineExpeditionFeed
            threads={threads}
            isLoadingThreads={loadingThreads}
            currentUser={currentUser}
            trails={availableTrails}
            onRequireLogin={onRequireLogin}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onForumCategoryChange={setForumCategory}
            externalCategorySync={externalCategorySync}
            hasMoreThreads={hasMoreThreads}
            loadingMoreThreads={loadingMoreThreads}
            onLoadMoreThreads={handleLoadMoreThreads}
            onThreadUpdated={handleThreadUpdated}
            onThreadDeleted={handleThreadDeleted}
            onOpenNewThreadModal={() => {
              const token = safeLocalStorageGet('lost_token');
              if (!currentUser && !token) {
                if (onRequireLogin) {
                  onRequireLogin('chia sẻ chuyện rừng cùng anh em');
                } else {
                  showToast('Đăng nhập để chia sẻ chuyện rừng cùng anh em nhé.', 'info');
                  window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
                }
                return;
              }
              setNewThreadError(null);
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

          {/* 2. Kho Tracklog GPX */}
          <div
            className="card"
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              padding: '18px 20px',
            }}
          >
            <div className="section-eyebrow" style={{ marginBottom: 4 }}>Tệp GPS offline</div>
            <h3 className="font-editorial" style={{ fontSize: '1.18rem', fontWeight: 500, color: 'var(--color-text-main)', margin: '0 0 6px 0' }}>
              Kho tracklog GPX thực tế
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: '0 0 12px 0' }}>
              Tải tệp GPX ghi từ những chuyến đi thật để nạp sẵn vào điện thoại hoặc Garmin trước khi vào rừng:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {gpxVaultItems.map((item) => (
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
                    <div style={{ fontWeight: 700, color: 'var(--color-text-main)', textOverflow: 'ellipsis', overflow: 'hidden' }} title={item.name}>
                      {item.name}
                    </div>
                    {item.dist && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
                        {item.dist}
                      </div>
                    )}
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
              Anh em gắn bó lâu năm
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {topTrekkers.length === 0 ? (
                <div style={{ fontSize: '0.76rem', color: 'var(--color-text-dim)', textAlign: 'center', padding: '12px 0' }}>
                  Chưa có ai kể chuyện ở đây — bạn kể trước nhé?
                </div>
              ) : (
                topTrekkers.map((user, idx) => (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() =>
                      setSidebarAuthor({
                        userId: user._id,
                        name: user.fullName,
                        avatar: user.avatarUrl || '',
                        reputationScore: user.reputationScore,
                        badges: user.badges,
                        role: user.role,
                      })
                    }
                    title={`Xem hồ sơ ${user.fullName}`}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 4px',
                      background: 'none',
                      border: 'none',
                      borderBottom: idx < topTrekkers.length - 1 ? '1px solid var(--color-border)' : 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'var(--font-family)',
                    }}
                  >
                    {user.avatarUrl && !failedTopTrekkerAvatars[user._id] ? (
                      <img
                        loading="lazy"
                        decoding="async"
                        src={user.avatarUrl}
                        alt={user.fullName}
                        referrerPolicy="no-referrer"
                        onError={() => setFailedTopTrekkerAvatars((prev) => ({ ...prev, [user._id]: true }))}
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
                        <span>{user.reputationScore} điểm uy tín</span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <AuthorProfileModal
        author={sidebarAuthor}
        currentUser={currentUser}
        onClose={() => setSidebarAuthor(null)}
        onRequireLogin={onRequireLogin}
      />

      {/* Create New Thread Modal */}
      {isNewThreadOpen &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => {
              if (!isSubmittingThread) setIsNewThreadOpen(false);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--overlay-bg)',
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
              aria-label="Chia sẻ chuyện rừng mới"
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
                  Chia sẻ chuyện rừng
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

              {newThreadError && (
                <div
                  role="alert"
                  style={{
                    marginBottom: 14,
                    padding: '9px 12px',
                    borderRadius: 4,
                    background: 'var(--banner-danger-bg)',
                    border: '1px solid var(--banner-danger-border)',
                    color: 'var(--banner-danger-text)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  {newThreadError}
                </div>
              )}

              <form onSubmit={handleCreateThread}>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label
                    htmlFor="new-thread-title"
                    className="form-label"
                    style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--color-text-main)' }}
                  >
                    Tiêu đề bài viết hoặc câu hỏi
                  </label>
                  <input
                    id="new-thread-title"
                    type="text"
                    className="form-input"
                    maxLength={200}
                    placeholder="VD: Cuối tuần rồi mình vừa đi Lảo Thẩn 2N1Đ — đường lán gỗ giờ thế nào?"
                    value={newTitle}
                    onChange={(e) => {
                      setNewTitle(e.target.value);
                      if (newThreadError) setNewThreadError(null);
                    }}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 4, fontSize: '0.84rem' }}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 14 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label
                      htmlFor="new-thread-category"
                      className="form-label"
                      style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--color-text-main)' }}
                    >
                      Chuyên mục
                    </label>
                    <select
                      id="new-thread-category"
                      className="form-select"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as ForumThread['category'])}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 4, fontSize: '0.84rem', background: 'var(--color-bg-main)', color: 'var(--color-text-main)', border: '1px solid var(--color-border)' }}
                    >
                      <option value="Kinh Nghiệm">Chuyện từ rừng về &amp; kinh nghiệm</option>
                      <option value="Hỏi Đáp">Hỏi đường &amp; đồ đạc</option>
                      <option value="Tìm Đồng Đội">Tìm bạn cùng nhịp chân</option>
                      <option value="Cảnh Báo">Cảnh báo đường &amp; thời tiết</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label
                      htmlFor="new-thread-trail"
                      className="form-label"
                      style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--color-text-main)' }}
                    >
                      Gắn cung đường (không bắt buộc)
                    </label>
                    <select
                      id="new-thread-trail"
                      className="form-select"
                      value={newTrailId}
                      onChange={(e) => setNewTrailId(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 4, fontSize: '0.84rem', background: 'var(--color-bg-main)', color: 'var(--color-text-main)', border: '1px solid var(--color-border)' }}
                    >
                      <option value="">-- Không gắn cung đường cụ thể --</option>
                      {availableTrails.map((t) => {
                        const tid = t.id || (t as Trail & { _id?: string })._id || '';
                        return (
                          <option key={tid} value={tid}>
                            {t.name} ({t.province})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label
                    htmlFor="new-thread-content"
                    className="form-label"
                    style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--color-text-main)' }}
                  >
                    Nội dung chia sẻ
                  </label>
                  <textarea
                    id="new-thread-content"
                    className="form-textarea"
                    rows={6}
                    maxLength={8000}
                    placeholder="Kể lại tình trạng đường mòn, con suối, chỗ hạ trại hay câu hỏi bạn đang băn khoăn..."
                    value={newContent}
                    onChange={(e) => {
                      setNewContent(e.target.value);
                      if (newThreadError) setNewThreadError(null);
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 4, fontSize: '0.84rem' }}
                    required
                  />
                </div>

                {/* Hình ảnh từ chuyến đi (Tối đa 8 ảnh) */}
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label
                      htmlFor="new-thread-image-url"
                      className="form-label"
                      style={{ fontSize: '0.8rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-main)' }}
                    >
                      <IconCamera size={16} color="var(--color-primary)" />
                      Ảnh chụp từ chuyến đi
                    </label>
                    <span style={{ fontSize: '0.74rem', color: newImages.length >= 8 ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: 600 }}>
                      {newImages.length}/8 ảnh
                    </span>
                  </div>

                  {/* Danh sách ảnh đã chọn */}
                  {newImages.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(95px, 1fr))', gap: 10, marginBottom: 12 }}>
                      {newImages.map((imgItem, idx) => (
                        <div
                          key={imgItem.id}
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
                            loading="lazy"
                            decoding="async"
                            src={imgItem.src}
                            alt={`Ảnh đính kèm ${idx + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(imgItem.id)}
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
                          <span>Chọn ảnh từ máy</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            multiple
                            onChange={handleImageFilesChange}
                            style={{ display: 'none' }}
                          />
                        </label>

                        <div style={{ display: 'flex', flex: 1, minWidth: 200, gap: 6 }}>
                          <input
                            id="new-thread-image-url"
                            type="url"
                            className="form-input"
                            placeholder="Hoặc dán link ảnh (https://...)"
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
                        Tối đa 8 ảnh (JPG, PNG, WebP, GIF hoặc link ảnh) — vài tấm chụp đường đi, lán trại là anh em dễ hình dung nhất.
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
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingThread}
                    className="btn btn-primary interactive-click"
                    style={{ padding: '8px 20px', borderRadius: 4, fontSize: '0.82rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: isSubmittingThread ? 0.65 : 1 }}
                  >
                    <IconSend size={15} color="var(--color-on-primary)" />
                    {isSubmittingThread ? 'Đang đăng...' : 'Đăng lên diễn đàn'}
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
