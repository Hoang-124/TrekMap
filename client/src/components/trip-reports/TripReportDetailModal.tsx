import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  IconX,
  IconStar,
  IconCalendar,
  IconUsers,
  IconClock,
  IconMountain,
  IconCloud,
  IconAlertTriangle,
  IconCheckCircle,
  IconHeart,
  IconSparkles,
  IconEye,
  IconImage,
  IconChevronLeft,
  IconChevronRight,
  IconFlame,
  IconEdit,
  IconTrash,
  IconBookOpen,
  IconArrowRight,
} from '../common/SvgIcons.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { useFocusTrap, isTopmostFocusTrap } from '../../hooks/useFocusTrap.js';
import type { UserProfile } from '../../types.js';
import type { TripReportItem } from './TripReportCard.js';

interface TripReportDetailModalProps {
  report: TripReportItem | null;
  currentUser?: UserProfile | null;
  onClose: () => void;
  onOpenTrail?: (trailId: string) => void;
  onReactionUpdated?: (
    reportId: string,
    reactions: { like: number; love: number; wow: number },
    userReaction: 'like' | 'love' | 'wow' | null
  ) => void;
  onReportUpdated?: (updated: TripReportItem) => void;
  onReportDeleted?: (reportId: string) => void;
}

const REPORT_REACTIONS: Array<{
  type: 'like' | 'love' | 'wow';
  label: string;
  accent: string;
}> = [
  { type: 'like', label: 'Hữu ích', accent: 'var(--color-primary)' },
  { type: 'love', label: 'Yêu thích', accent: 'var(--color-error-text, var(--color-error))' },
  { type: 'wow', label: 'Ấn tượng', accent: 'var(--color-sky)' },
];

function estimateReadingMinutes(detail: TripReportItem | null): number {
  if (!detail) return 1;
  const parts: string[] = [];
  if (typeof detail.title === 'string') parts.push(detail.title);
  if (typeof detail.summary === 'string') parts.push(detail.summary);
  if (typeof detail.content === 'string') parts.push(detail.content);
  if (Array.isArray(detail.highlights)) parts.push(...detail.highlights.filter((s) => typeof s === 'string'));
  if (Array.isArray(detail.warnings)) parts.push(...detail.warnings.filter((s) => typeof s === 'string'));
  if (Array.isArray(detail.recommendations)) {
    parts.push(...detail.recommendations.filter((s) => typeof s === 'string'));
  }
  const wordCount = parts.join(' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
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

function resolveInitialUserReaction(
  report: TripReportItem | null,
  currentUserId: string
): 'like' | 'love' | 'wow' | null {
  if (!report) return null;
  if (report.userReaction === 'like' || report.userReaction === 'love' || report.userReaction === 'wow') {
    return report.userReaction;
  }
  if (currentUserId && report.userReactionsMap && typeof report.userReactionsMap === 'object') {
    const val = (report.userReactionsMap as Record<string, string>)[currentUserId];
    if (val === 'like' || val === 'love' || val === 'wow') return val;
  }
  return null;
}

export const TripReportDetailModal: React.FC<TripReportDetailModalProps> = ({
  report,
  currentUser,
  onClose,
  onOpenTrail,
  onReactionUpdated,
  onReportUpdated,
  onReportDeleted,
}) => {
  const currentUserId = String(currentUser?.id || (currentUser as (UserProfile & { _id?: string }) | null)?._id || '');
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'moderator';
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lightboxRef = useRef<HTMLDivElement | null>(null);
  const lightboxCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const [fetchedDetail, setFetchedDetail] = useState<TripReportItem | null>(null);
  const detail = fetchedDetail && report && fetchedDetail._id === report._id ? fetchedDetail : report;
  const [loadedReportId, setLoadedReportId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<{ like: number; love: number; wow: number }>({
    like: report?.reactions?.like || 0,
    love: report?.reactions?.love || 0,
    wow: report?.reactions?.wow || 0,
  });
  const [userReaction, setUserReaction] = useState<'like' | 'love' | 'wow' | null>(() =>
    resolveInitialUserReaction(report, currentUserId)
  );
  const [isReacting, setIsReacting] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Owner / Admin inline edit & delete state (zero native confirm dialogs)
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editGroupSize, setEditGroupSize] = useState('2');
  const [editTotalCost, setEditTotalCost] = useState('');
  const [editWeather, setEditWeather] = useState('');
  const [editRating, setEditRating] = useState(5);
  const [editDifficulty, setEditDifficulty] = useState(3);
  const [editHighlightsText, setEditHighlightsText] = useState('');
  const [editWarningsText, setEditWarningsText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const reportId = report?._id ?? '';
  const [trackedReportId, setTrackedReportId] = useState(reportId);
  if (trackedReportId !== reportId) {
    setTrackedReportId(reportId);
    setLightboxIndex(null);
    setIsEditing(false);
    setConfirmDelete(false);
    setReactions({
      like: report?.reactions?.like || 0,
      love: report?.reactions?.love || 0,
      wow: report?.reactions?.wow || 0,
    });
    setUserReaction(resolveInitialUserReaction(report, currentUserId));
  }

  const loadingDetail = Boolean(reportId) && loadedReportId !== reportId;
  const isModalOpen = Boolean(report && detail);
  const activePhotos = Array.isArray(detail?.photos) ? detail.photos.filter(Boolean) : [];
  if (lightboxIndex !== null && (lightboxIndex < 0 || lightboxIndex >= activePhotos.length)) {
    setLightboxIndex(null);
  }
  const isLightboxOpen = isModalOpen && lightboxIndex !== null && Boolean(activePhotos[lightboxIndex]);

  // LIFO Focus Traps: main dialog + nested photo lightbox
  useFocusTrap(isModalOpen, dialogRef);
  useFocusTrap(isLightboxOpen, lightboxRef, { initialFocusRef: lightboxCloseBtnRef });

  // Fetch full trip report detail from GET /api/trip-reports/:id with graceful fallback to card data
  useEffect(() => {
    if (!reportId) {
      return;
    }

    const controller = new AbortController();

    fetch(`/api/trip-reports/${encodeURIComponent(reportId)}`, {
      headers: getApiHeaders(),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (json?.success && json.data) {
          const fetched: TripReportItem = json.data;
          setFetchedDetail(fetched);
          setReactions({
            like: fetched.reactions?.like || 0,
            love: fetched.reactions?.love || 0,
            wow: fetched.reactions?.wow || 0,
          });
          setUserReaction(resolveInitialUserReaction(fetched, currentUserId));
        }
      })
      .catch(() => {
        // Fallback to card report data silently
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedReportId(reportId);
      });

    return () => controller.abort();
  }, [reportId, currentUserId]);

  const readingMinutes = useMemo(() => estimateReadingMinutes(detail), [detail]);

  const rawTrailRef: unknown = detail?.trailId;
  const trailRefObj =
    rawTrailRef && typeof rawTrailRef === 'object'
      ? (rawTrailRef as { _id?: string; id?: string; name?: string; province?: string })
      : null;
  const trailJumpId =
    (typeof trailRefObj?.id === 'string' && trailRefObj.id.trim()) ||
    (typeof trailRefObj?._id === 'string' && trailRefObj._id.trim()) ||
    (typeof rawTrailRef === 'string' && rawTrailRef.trim()) ||
    '';

  const handleJumpToTrail = useCallback(() => {
    if (!trailJumpId || isDeleting || isSavingEdit) return;
    setLightboxIndex(null);
    onClose();
    if (onOpenTrail) {
      onOpenTrail(trailJumpId);
      return;
    }
    const targetUrl = `/trails/${encodeURIComponent(trailJumpId)}`;
    window.history.pushState({ view: 'detail', trailId: trailJumpId }, '', targetUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [trailJumpId, isDeleting, isSavingEdit, onClose, onOpenTrail]);

  // LIFO Keyboard Escape + Lightbox ArrowLeft/ArrowRight navigation with IME & input guards
  useEffect(() => {
    if (!isModalOpen) return;
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
        if (confirmDelete && !isDeleting) {
          setConfirmDelete(false);
        } else if (isEditing && !isSavingEdit) {
          setIsEditing(false);
        } else if (!isDeleting && !isSavingEdit) {
          onClose();
        }
        return;
      }

      if (
        isLightboxOpen &&
        activePhotos.length > 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !isEditableKeyboardTarget(e.target) &&
        isTopmostFocusTrap(lightboxRef.current)
      ) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : activePhotos.length - 1));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setLightboxIndex((prev) => (prev !== null && prev < activePhotos.length - 1 ? prev + 1 : 0));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isModalOpen,
    isLightboxOpen,
    confirmDelete,
    isEditing,
    isDeleting,
    isSavingEdit,
    activePhotos.length,
    onClose,
  ]);

  const dispatchToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    window.dispatchEvent(new CustomEvent('lost:show-toast', { detail: { message, type } }));
  };

  const openEditForm = () => {
    if (!detail) return;
    setEditTitle(detail.title || '');
    setEditSummary(detail.summary && detail.summary !== detail.title ? detail.summary : '');
    setEditContent(detail.content || '');
    setEditDuration(detail.duration || '');
    setEditGroupSize(String(detail.groupSize || 2));
    setEditTotalCost(detail.totalCost || '');
    setEditWeather(detail.weatherCondition || '');
    setEditRating(Math.min(5, Math.max(1, Number(detail.rating) || 5)));
    setEditDifficulty(Math.min(5, Math.max(1, Number(detail.difficultyActual) || 3)));
    setEditHighlightsText(Array.isArray(detail.highlights) ? detail.highlights.join('\n') : '');
    setEditWarningsText(Array.isArray(detail.warnings) ? detail.warnings.join('\n') : '');
    setConfirmDelete(false);
    setIsEditing(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || isSavingEdit) return;
    const cleanTitle = editTitle.trim();
    const cleanContent = editContent.trim();
    if (!cleanTitle || !cleanContent) {
      dispatchToast('Tiêu đề và nội dung nhật ký không được để trống.', 'error');
      return;
    }

    const parsedHighlights = editHighlightsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);
    const parsedWarnings = editWarningsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/trip-reports/${encodeURIComponent(detail._id)}`, {
        method: 'PATCH',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title: cleanTitle,
          summary: editSummary.trim() || cleanTitle,
          content: cleanContent,
          duration: editDuration.trim() || detail.duration,
          groupSize: Math.min(100, Math.max(1, Math.round(Number(editGroupSize) || 2))),
          totalCost: editTotalCost.trim(),
          weatherCondition: editWeather.trim(),
          rating: editRating,
          difficultyActual: editDifficulty,
          highlights: parsedHighlights,
          warnings: parsedWarnings,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.data) {
        const updated: TripReportItem = json.data;
        if (isMountedRef.current) {
          setFetchedDetail(updated);
          setIsEditing(false);
        }
        onReportUpdated?.(updated);
        window.dispatchEvent(new CustomEvent('lost:trip-report-updated', { detail: updated }));
        dispatchToast(json.message || 'Đã cập nhật nhật ký chuyến đi!', 'success');
      } else {
        dispatchToast(json.message || 'Không thể cập nhật nhật ký lúc này.', 'error');
      }
    } catch {
      dispatchToast('Lỗi kết nối máy chủ khi cập nhật nhật ký.', 'error');
    } finally {
      if (isMountedRef.current) {
        setIsSavingEdit(false);
      }
    }
  };

  const handleDeleteReport = async () => {
    if (!detail || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/trip-reports/${encodeURIComponent(detail._id)}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        onReportDeleted?.(detail._id);
        window.dispatchEvent(new CustomEvent('lost:trip-report-deleted', { detail: { reportId: detail._id } }));
        dispatchToast(json.message || 'Đã xóa nhật ký chuyến đi!', 'success');
        if (isMountedRef.current) {
          onClose();
        }
      } else {
        dispatchToast(json.message || 'Không thể xóa nhật ký này.', 'error');
      }
    } catch {
      dispatchToast('Lỗi kết nối máy chủ khi xóa nhật ký.', 'error');
    } finally {
      if (isMountedRef.current) {
        setIsDeleting(false);
        setConfirmDelete(false);
      }
    }
  };

  const handleReact = useCallback(
    async (type: 'like' | 'love' | 'wow') => {
      if (!detail || isReacting) return;
      const token = localStorage.getItem('lost_token');
      if (!token) {
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: 'Vui lòng đăng nhập để thả cảm xúc cho nhật ký.', type: 'info' },
          })
        );
        window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
        return;
      }

      setIsReacting(true);
      try {
        const res = await fetch(`/api/trip-reports/${encodeURIComponent(detail._id)}/react`, {
          method: 'POST',
          headers: getApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ type }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success && data.reactions) {
          const nextReactions = {
            like: Number(data.reactions.like) || 0,
            love: Number(data.reactions.love) || 0,
            wow: Number(data.reactions.wow) || 0,
          };
          const nextUserReaction: 'like' | 'love' | 'wow' | null =
            data.userReaction === 'like' || data.userReaction === 'love' || data.userReaction === 'wow'
              ? data.userReaction
              : null;
          if (isMountedRef.current) {
            setReactions(nextReactions);
            setUserReaction(nextUserReaction);
          }
          onReactionUpdated?.(detail._id, nextReactions, nextUserReaction);
        } else {
          const isAuthError = res.status === 401;
          window.dispatchEvent(
            new CustomEvent('lost:show-toast', {
              detail: {
                message:
                  data?.message ||
                  (isAuthError
                    ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
                    : 'Không thể cập nhật cảm xúc lúc này.'),
                type: isAuthError ? 'info' : 'error',
              },
            })
          );
          if (isAuthError) {
            window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
          }
        }
      } catch {
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: 'Không thể cập nhật cảm xúc lúc này.', type: 'error' },
          })
        );
      } finally {
        if (isMountedRef.current) {
          setIsReacting(false);
        }
      }
    },
    [detail, isReacting, onReactionUpdated]
  );

  if (!report || !detail) return null;

  const authorName = detail.authorId?.fullName || 'Thành viên cộng đồng';
  const isAuthorSelf = Boolean(
    currentUserId && detail.authorId?._id && String(detail.authorId._id) === currentUserId
  );
  const canManageReport = Boolean(currentUser && (isStaff || isAuthorSelf));
  const authorAvatar =
    isAuthorSelf && (currentUser?.avatarUrl || currentUser?.avatar)
      ? currentUser.avatarUrl || currentUser.avatar
      : detail.authorId?.avatarUrl || '';

  const formattedTripDate = detail.tripDate
    ? (() => {
        const d = new Date(detail.tripDate);
        return Number.isNaN(d.getTime())
          ? detail.tripDate
          : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      })()
    : 'Chưa rõ ngày';

  const ratingVal = Math.min(5, Math.max(1, Number(detail.rating) || 5));
  const difficultyVal = Math.min(5, Math.max(1, Number(detail.difficultyActual) || 3));
  const highlights = Array.isArray(detail.highlights) ? detail.highlights.filter(Boolean) : [];
  const warnings = Array.isArray(detail.warnings) ? detail.warnings.filter(Boolean) : [];
  const recommendations = Array.isArray(detail.recommendations) ? detail.recommendations.filter(Boolean) : [];

  return (
    <>
      {createPortal(
        <div
          className="modal-overlay"
          onClick={() => {
            if (!isLightboxOpen && !isDeleting && !isSavingEdit) onClose();
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
            padding: 'clamp(8px, 2.5vw, 20px)',
            boxSizing: 'border-box',
          }}
        >
          <div
            ref={dialogRef}
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-label={detail.title}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 780,
              width: '100%',
              maxHeight: '92vh',
              padding: 0,
              outline: 'none',
              borderRadius: 6,
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-strong)',
              boxShadow: 'var(--shadow-3d)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'var(--font-family)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: 'clamp(12px, 3vw, 18px) clamp(14px, 3.2vw, 22px)',
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-bg-main)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {authorAvatar ? (
                  <img
                    src={authorAvatar}
                    alt={authorName}
                    referrerPolicy="no-referrer"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      border: '1.5px solid var(--color-primary)',
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
                      border: '1px solid var(--color-primary)',
                      color: 'var(--color-primary)',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {authorName.charAt(0).toUpperCase()}
                  </div>
                )}

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                      {authorName}
                    </span>
                    {detail.authorId?.reputationScore !== undefined && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: 'var(--color-primary)',
                          background: 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-card))',
                          border: '1px solid color-mix(in srgb, var(--color-primary) 34%, var(--color-border))',
                          borderRadius: 4,
                          padding: '1px 6px',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {detail.authorId.reputationScore} Uy tín
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 2, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <IconCalendar size={12} color="var(--color-text-dim)" />
                      Khởi hành: {formattedTripDate}
                    </span>
                    {detail.trailId?.name && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-sky)', fontWeight: 700 }}>
                        <IconMountain size={12} color="var(--color-sky)" />
                        {detail.trailId.name}
                        {detail.trailId.province ? ` (${detail.trailId.province})` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {canManageReport && !isEditing && (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={openEditForm}
                      style={{
                        padding: '5px 10px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        borderRadius: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <IconEdit size={13} />
                      <span>Chỉnh sửa</span>
                    </button>

                    {confirmDelete ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={isDeleting}
                          onClick={handleDeleteReport}
                          style={{ padding: '5px 10px', fontSize: '0.74rem', fontWeight: 800, borderRadius: 4 }}
                        >
                          {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          disabled={isDeleting}
                          onClick={() => setConfirmDelete(false)}
                          style={{ padding: '5px 8px', fontSize: '0.74rem', borderRadius: 4 }}
                        >
                          Hủy
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setConfirmDelete(true)}
                        style={{
                          padding: '5px 10px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          borderRadius: 4,
                          color: 'var(--color-error-text, var(--color-error))',
                          borderColor: 'color-mix(in srgb, var(--color-error) 35%, transparent)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <IconTrash size={13} color="var(--color-error-text, var(--color-error))" />
                        <span>Xóa nhật ký</span>
                      </button>
                    )}
                  </>
                )}

                <button
                  type="button"
                  disabled={isDeleting || isSavingEdit}
                  onClick={() => {
                    if (!isDeleting && !isSavingEdit) onClose();
                  }}
                  aria-label="Đóng nhật ký (Esc)"
                  title="Đóng (Esc)"
                  style={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    color: 'var(--color-text-muted)',
                    cursor: isDeleting || isSavingEdit ? 'not-allowed' : 'pointer',
                    opacity: isDeleting || isSavingEdit ? 0.5 : 1,
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <IconX size={18} />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div style={{ padding: 'clamp(14px, 3vw, 20px) clamp(14px, 3.2vw, 22px)', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {isEditing ? (
                <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                      Chỉnh sửa nhật ký chuyến đi
                    </h3>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setIsEditing(false)}
                      disabled={isSavingEdit}
                      style={{ padding: '4px 10px', fontSize: '0.76rem', borderRadius: 4 }}
                    >
                      Hủy chỉnh sửa
                    </button>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                      Tiêu đề nhật ký *
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      maxLength={180}
                      required
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.88rem', borderRadius: 4 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                      Tóm tắt ngắn
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={editSummary}
                      onChange={(e) => setEditSummary(e.target.value)}
                      maxLength={400}
                      placeholder="Điểm nhấn ngắn gọn của chuyến đi..."
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.84rem', borderRadius: 4 }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                        Thời gian di chuyển
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        placeholder="VD: 2 ngày 1 đêm"
                        style={{ width: '100%', padding: '7px 10px', fontSize: '0.82rem', borderRadius: 4 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                        Quy mô đoàn (người)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        className="form-input"
                        value={editGroupSize}
                        onChange={(e) => setEditGroupSize(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', fontSize: '0.82rem', borderRadius: 4 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                        Chi phí thực tế
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={editTotalCost}
                        onChange={(e) => setEditTotalCost(e.target.value)}
                        placeholder="VD: 1.850.000đ/người"
                        style={{ width: '100%', padding: '7px 10px', fontSize: '0.82rem', borderRadius: 4 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                        Thời tiết &amp; Đường mòn
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={editWeather}
                        onChange={(e) => setEditWeather(e.target.value)}
                        placeholder="VD: Trời khô ráo, săn mây đẹp"
                        style={{ width: '100%', padding: '7px 10px', fontSize: '0.82rem', borderRadius: 4 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                        Đánh giá ({editRating}/5 sao)
                      </div>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setEditRating(s)}
                            style={{
                              padding: '4px 7px',
                              borderRadius: 4,
                              cursor: 'pointer',
                              background: s <= editRating ? 'color-mix(in srgb, var(--color-sun) 18%, transparent)' : 'var(--color-bg-main)',
                              border: s <= editRating ? '1px solid var(--color-sun)' : '1px solid var(--color-border)',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                            aria-label={`Chọn ${s} sao`}
                          >
                            <IconStar
                              size={14}
                              color={s <= editRating ? 'var(--color-sun)' : 'var(--color-text-dim)'}
                              fill={s <= editRating ? 'var(--color-sun)' : 'none'}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                        Độ khó thực tế ({editDifficulty}/5)
                      </div>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        {[1, 2, 3, 4, 5].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setEditDifficulty(d)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 4,
                              fontSize: '0.76rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              background: d === editDifficulty ? 'var(--color-earth)' : 'var(--color-bg-main)',
                              color: d === editDifficulty ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                              border: d === editDifficulty ? '1px solid var(--color-earth)' : '1px solid var(--color-border)',
                            }}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                      Nội dung nhật ký chi tiết *
                    </label>
                    <textarea
                      className="form-input"
                      rows={6}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      maxLength={10000}
                      required
                      style={{ width: '100%', padding: '10px 12px', fontSize: '0.86rem', borderRadius: 4, resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 4 }}>
                        Điểm nổi bật (mỗi dòng 1 ý)
                      </label>
                      <textarea
                        className="form-input"
                        rows={3}
                        value={editHighlightsText}
                        onChange={(e) => setEditHighlightsText(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', fontSize: '0.8rem', borderRadius: 4, resize: 'vertical' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-error-text, var(--color-error))', marginBottom: 4 }}>
                        Cảnh báo hiện trường (mỗi dòng 1 ý)
                      </label>
                      <textarea
                        className="form-input"
                        rows={3}
                        value={editWarningsText}
                        onChange={(e) => setEditWarningsText(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', fontSize: '0.8rem', borderRadius: 4, resize: 'vertical' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setIsEditing(false)}
                      disabled={isSavingEdit}
                      style={{ padding: '7px 14px', fontSize: '0.82rem', borderRadius: 4 }}
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isSavingEdit || !editTitle.trim() || !editContent.trim()}
                      style={{ padding: '7px 16px', fontSize: '0.82rem', fontWeight: 800, borderRadius: 4 }}
                    >
                      {isSavingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Title & Summary */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <IconStar
                            key={s}
                            size={14}
                            color={s <= ratingVal ? 'var(--color-sun)' : 'var(--color-border-strong)'}
                            fill={s <= ratingVal ? 'var(--color-sun)' : 'none'}
                          />
                        ))}
                        <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--color-text-main)', marginLeft: 4, fontVariantNumeric: 'tabular-nums' }}>
                          {ratingVal}/5 sao
                        </span>
                        <span
                          style={{
                            marginLeft: 6,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: 'color-mix(in srgb, var(--color-sky) 8%, var(--color-bg-card))',
                            border: '1px solid color-mix(in srgb, var(--color-sky) 36%, var(--color-border))',
                            color: 'var(--color-sky)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          <IconBookOpen size={12} color="var(--color-sky)" />
                          <span>~{readingMinutes} phút đọc</span>
                        </span>
                      </div>

                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, fontVariantNumeric: 'tabular-nums' }}>
                        <IconEye size={13} color="var(--color-text-muted)" />
                        <span>{detail.viewsCount || 1} lượt xem</span>
                        {loadingDetail && <span>• Đang đồng bộ...</span>}
                      </span>
                    </div>

                    <h2 className="font-editorial" style={{ margin: '0 0 8px 0', fontSize: 'clamp(1.2rem, 3vw, 1.45rem)', fontWeight: 600, color: 'var(--color-text-main)', lineHeight: 1.28 }}>
                      {detail.title}
                    </h2>
                    {detail.summary && detail.summary !== detail.title && (
                      <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-text-muted)', lineHeight: 1.55, fontWeight: 500 }}>
                        {detail.summary}
                      </p>
                    )}
                  </div>

              {/* Field Conditions Telemetry Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))',
                  gap: 10,
                }}
              >
                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <IconClock size={12} color="var(--color-primary)" /> Thời gian
                  </div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 4 }}>
                    {detail.duration || 'Chưa cập nhật'}
                  </div>
                </div>

                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <IconMountain size={12} color="var(--color-earth)" /> Độ khó thực tế
                  </div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-earth)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                    {difficultyVal}/5 {difficultyVal >= 4 ? '(Thử thách)' : difficultyVal <= 2 ? '(Nhẹ nhàng)' : '(Trung bình)'}
                  </div>
                </div>

                {detail.groupSize !== undefined && (
                  <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <IconUsers size={12} color="var(--color-sky)" /> Quy mô đoàn
                    </div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                      {detail.groupSize} thành viên
                    </div>
                  </div>
                )}

                {detail.totalCost && (
                  <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <IconFlame size={12} color="var(--color-sun)" /> Chi phí thực tế
                    </div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                      {detail.totalCost}
                    </div>
                  </div>
                )}
              </div>

              {/* Weather & Trail Condition Banner */}
              {detail.weatherCondition && (
                <div
                  style={{
                    background: 'color-mix(in srgb, var(--color-sky) 8%, var(--color-bg-card))',
                    border: '1px solid color-mix(in srgb, var(--color-sky) 34%, var(--color-border))',
                    borderRadius: 4,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: '0.82rem',
                    color: 'var(--color-text-main)',
                  }}
                >
                  <IconCloud size={16} color="var(--color-sky)" style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: 'var(--color-sky)' }}>Thời tiết &amp; Đường mòn thực địa: </strong>
                    <span>{detail.weatherCondition}</span>
                  </div>
                </div>
              )}

              {/* Full Notes */}
              <div
                style={{
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  padding: 'clamp(12px, 3vw, 18px)',
                  fontSize: '0.88rem',
                  color: 'var(--color-text-main)',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                }}
              >
                {detail.content}
              </div>

              {/* Highlights & Warnings */}
              {(highlights.length > 0 || warnings.length > 0 || recommendations.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 12 }}>
                  {highlights.length > 0 && (
                    <div
                      style={{
                        background: 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-card))',
                        border: '1px solid color-mix(in srgb, var(--color-primary) 32%, var(--color-border))',
                        borderRadius: 4,
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <IconCheckCircle size={14} color="var(--color-primary)" /> Điểm nổi bật
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', color: 'var(--color-text-main)' }}>
                        {highlights.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {warnings.length > 0 && (
                    <div
                      style={{
                        background: 'color-mix(in srgb, var(--color-error) 8%, var(--color-bg-card))',
                        border: '1px solid color-mix(in srgb, var(--color-error) 34%, var(--color-border))',
                        borderRadius: 4,
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-error-text, var(--color-error))', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <IconAlertTriangle size={14} color="var(--color-error-text, var(--color-error))" /> Cảnh báo hiện trường
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', color: 'var(--color-text-main)' }}>
                        {warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {recommendations.length > 0 && (
                    <div
                      style={{
                        background: 'color-mix(in srgb, var(--color-sun) 8%, var(--color-bg-card))',
                        border: '1px solid color-mix(in srgb, var(--color-sun) 34%, var(--color-border))',
                        borderRadius: 4,
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-text-main)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <IconSparkles size={14} color="var(--color-sun)" /> Lưu ý chuẩn bị
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', color: 'var(--color-text-main)' }}>
                        {recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Photo Gallery Grid */}
              {activePhotos.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconImage size={14} color="var(--color-primary)" />
                    <span>Thư viện ảnh thực địa ({activePhotos.length})</span>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: activePhotos.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(min(170px, 100%), 1fr))',
                      gap: 10,
                    }}
                  >
                    {activePhotos.map((photo, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setLightboxIndex(idx)}
                        style={{
                          position: 'relative',
                          height: activePhotos.length === 1 ? 260 : 150,
                          borderRadius: 4,
                          overflow: 'hidden',
                          border: '1px solid var(--color-border)',
                          padding: 0,
                          cursor: 'zoom-in',
                          background: 'var(--color-bg-main)',
                        }}
                        title="Bấm để phóng to ảnh"
                      >
                        <img
                          src={photo}
                          alt={`${detail.title} - ảnh ${idx + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 6,
                            right: 6,
                            background: 'var(--overlay-bg)',
                            color: 'var(--color-on-media)',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 4,
                            border: '1px solid var(--color-border-strong)',
                          }}
                        >
                          Ảnh #{idx + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
                </>
              )}
            </div>

            {/* Footer Reaction Bar + 1-Click Trail Jump CTA */}
            <div
              style={{
                padding: 'clamp(10px, 2.5vw, 14px) clamp(14px, 3.2vw, 22px)',
                borderTop: '1px solid var(--color-border)',
                background: 'var(--color-bg-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {REPORT_REACTIONS.map((item) => {
                  const isActive = userReaction === item.type;
                  const count = reactions[item.type] || 0;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      disabled={isReacting}
                      onClick={() => handleReact(item.type)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 11px',
                        borderRadius: 4,
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: isReacting ? 'wait' : 'pointer',
                        background: isActive
                          ? `color-mix(in srgb, ${item.accent} 8%, var(--color-bg-card))`
                          : 'var(--color-bg-card)',
                        border: isActive
                          ? `1px solid ${item.accent}`
                          : '1px solid var(--color-border)',
                        color: isActive ? item.accent : 'var(--color-text-muted)',
                      }}
                    >
                      {item.type === 'love' ? (
                        <IconHeart size={13} color={isActive ? item.accent : 'var(--color-text-muted)'} fill={isActive ? item.accent : 'none'} />
                      ) : item.type === 'wow' ? (
                        <IconSparkles size={13} color={isActive ? item.accent : 'var(--color-text-muted)'} />
                      ) : (
                        <IconCheckCircle size={13} color={isActive ? item.accent : 'var(--color-text-muted)'} />
                      )}
                      <span>{item.label}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>({count})</span>
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {trailJumpId && (
                  <button
                    type="button"
                    disabled={isDeleting || isSavingEdit}
                    onClick={handleJumpToTrail}
                    className="btn btn-primary"
                    style={{
                      borderRadius: 4,
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <IconMountain size={13} color="var(--color-on-primary)" />
                    <span>Mở Cung Đường Này</span>
                    <IconArrowRight size={13} color="var(--color-on-primary)" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={isDeleting || isSavingEdit}
                  onClick={() => {
                    if (!isDeleting && !isSavingEdit) onClose();
                  }}
                  className="btn btn-outline"
                  style={{ borderRadius: 4, padding: '6px 14px', fontSize: '0.8rem', fontWeight: 700 }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Photo Gallery Lightbox */}
      {isLightboxOpen && lightboxIndex !== null && createPortal(
        <div
          ref={lightboxRef}
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh phóng to"
          tabIndex={-1}
          onClick={() => setLightboxIndex(null)}
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
            padding: 'clamp(12px, 3vw, 24px)',
            userSelect: 'none',
            fontFamily: 'var(--font-family)',
            outline: 'none',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 'clamp(12px, 2.5vw, 20px)',
              left: 'clamp(12px, 3vw, 24px)',
              right: 'clamp(12px, 3vw, 24px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 4,
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-strong)',
                color: 'var(--color-text-main)',
                fontSize: '0.78rem',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <IconImage size={14} color="var(--color-primary)" />
              <span>Ảnh {lightboxIndex + 1} / {activePhotos.length}</span>
              {activePhotos.length > 1 && (
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  · Phím ← / →
                </span>
              )}
            </div>

            <button
              ref={lightboxCloseBtnRef}
              type="button"
              onClick={() => setLightboxIndex(null)}
              aria-label="Đóng xem ảnh"
              style={{
                width: 38,
                height: 38,
                borderRadius: 4,
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-strong)',
                color: 'var(--color-text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <IconX size={18} />
            </button>
          </div>

          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              maxHeight: '78vh',
            }}
          >
            {activePhotos.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : activePhotos.length - 1));
                }}
                aria-label="Ảnh trước"
                style={{
                  position: 'absolute',
                  left: 12,
                  zIndex: 2,
                  width: 44,
                  height: 44,
                  borderRadius: 4,
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border-strong)',
                  color: 'var(--color-text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <IconChevronLeft size={22} />
              </button>
            )}

            <img
              src={activePhotos[lightboxIndex]}
              alt={`${detail.title} - ảnh ${lightboxIndex + 1}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '86vw',
                maxHeight: '74vh',
                borderRadius: 4,
                border: '1px solid var(--color-border-strong)',
                boxShadow: 'var(--shadow-3d)',
                objectFit: 'contain',
              }}
            />

            {activePhotos.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev !== null && prev < activePhotos.length - 1 ? prev + 1 : 0));
                }}
                aria-label="Ảnh tiếp theo"
                style={{
                  position: 'absolute',
                  right: 12,
                  zIndex: 2,
                  width: 44,
                  height: 44,
                  borderRadius: 4,
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border-strong)',
                  color: 'var(--color-text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <IconChevronRight size={22} />
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
