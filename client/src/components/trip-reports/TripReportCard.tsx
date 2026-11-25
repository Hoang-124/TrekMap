import React, { useState } from 'react';
import {
  IconHeart,
  IconBookOpen,
  IconMessageSquare,
  IconEye,
  IconStar,
  IconMountain,
  IconCheckCircle,
  IconSparkles,
} from '../common/SvgIcons.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import type { UserProfile } from '../../types.js';
import { AuthorProfileModal } from '../forum/AuthorProfileModal.js';
import { TripReportDetailModal } from './TripReportDetailModal.js';
import { safeLocalStorageGet } from '../../utils/storageScope.js';

export interface TripReportCommentItem {
  _id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
}

export interface TripReportItem {
  _id: string;
  authorId: {
    _id: string;
    fullName: string;
    avatarUrl?: string;
    reputationScore?: number;
    badges?: string[];
    bio?: string;
  };
  trailId?: {
    _id?: string;
    id?: string;
    name: string;
    province?: string;
    region?: string;
    coverImage?: string;
  };
  title: string;
  summary: string;
  content: string;
  photos: string[];
  tripDate: string;
  duration: string;
  groupSize?: number;
  totalCost?: string;
  difficultyActual?: number;
  weatherCondition?: string;
  highlights?: string[];
  warnings?: string[];
  recommendations?: string[];
  rating: number;
  reactions: {
    like: number;
    love: number;
    wow: number;
  };
  userReaction?: 'like' | 'love' | 'wow' | null;
  userReactionsMap?: Record<string, string>;
  comments?: TripReportCommentItem[];
  commentsCount: number;
  viewsCount: number;
}

interface TripReportCardProps {
  report: TripReportItem;
  currentUser?: UserProfile | null;
  onReportDeleted?: (reportId: string) => void;
  onReportUpdated?: (updated: TripReportItem) => void;
  onOpenAuthorProfile?: (author: { name: string; avatar: string; userId?: string }) => void;
}

function getInitialUserReaction(report: TripReportItem, currentUserId: string): 'like' | 'love' | 'wow' | null {
  if (report.userReaction === 'like' || report.userReaction === 'love' || report.userReaction === 'wow') {
    return report.userReaction;
  }
  if (currentUserId && report.userReactionsMap && typeof report.userReactionsMap === 'object') {
    const val = report.userReactionsMap[currentUserId];
    if (val === 'like' || val === 'love' || val === 'wow') return val;
  }
  return null;
}

export const TripReportCard: React.FC<TripReportCardProps> = ({
  report,
  currentUser,
  onReportDeleted,
  onReportUpdated,
  onOpenAuthorProfile,
}) => {
  const loggedInUser = currentUser || null;
  const currentUserId = String(loggedInUser?.id || (loggedInUser as (UserProfile & { _id?: string }) | null)?._id || '');

  const [reportOverride, setReportOverride] = useState<TripReportItem | null>(null);
  const [reactionOverride, setReactionOverride] = useState<{
    reportId: string;
    userId: string;
    reactions: { like: number; love: number; wow: number };
    userReaction: 'like' | 'love' | 'wow' | null;
  } | null>(null);
  const [commentsCountOverride, setCommentsCountOverride] = useState<{
    reportId: string;
    count: number;
  } | null>(null);
  const [isReacting, setIsReacting] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [failedCoverKey, setFailedCoverKey] = useState<string | null>(null);
  const [failedAvatarKey, setFailedAvatarKey] = useState<string | null>(null);
  const [inspectedAuthor, setInspectedAuthor] = useState<{
    name: string;
    avatar: string;
    userId?: string;
  } | null>(null);

  const effectiveReport = reportOverride && reportOverride._id === report._id ? reportOverride : report;

  const hasReactionOverride =
    reactionOverride !== null &&
    reactionOverride.reportId === effectiveReport._id &&
    reactionOverride.userId === currentUserId;
  const reactions = hasReactionOverride
    ? reactionOverride.reactions
    : {
      like: effectiveReport.reactions?.like || 0,
      love: effectiveReport.reactions?.love || 0,
      wow: effectiveReport.reactions?.wow || 0,
    };
  const userReaction = hasReactionOverride
    ? reactionOverride.userReaction
    : getInitialUserReaction(effectiveReport, currentUserId);
  const displayedCommentsCount =
    commentsCountOverride && commentsCountOverride.reportId === effectiveReport._id
      ? commentsCountOverride.count
      : effectiveReport.commentsCount || 0;

  const isAuthorSelf = Boolean(
    currentUserId && effectiveReport.authorId?._id && String(effectiveReport.authorId._id) === currentUserId
  );
  const authorName = effectiveReport.authorId?.fullName || 'Bạn đồng hành';
  const effectiveAuthorAvatar =
    isAuthorSelf && (loggedInUser?.avatarUrl || loggedInUser?.avatar)
      ? loggedInUser.avatarUrl || loggedInUser.avatar
      : effectiveReport.authorId?.avatarUrl || '';
  const avatarKey = `${effectiveReport._id}:${effectiveAuthorAvatar}`;
  const showAuthorAvatar = Boolean(effectiveAuthorAvatar) && failedAvatarKey !== avatarKey;

  const hasActiveReaction = userReaction !== null;
  const activeReactionAccent =
    userReaction === 'love'
      ? 'var(--color-error-text, var(--color-error))'
      : userReaction === 'wow'
        ? 'var(--color-sky)'
        : 'var(--color-primary)';
  const activeReactionLabel =
    userReaction === 'love'
      ? 'yêu thích'
      : userReaction === 'wow'
        ? 'ấn tượng'
        : userReaction === 'like'
          ? 'hữu ích'
          : 'lượt thích';
  const totalReactions = (reactions.like || 0) + (reactions.love || 0) + (reactions.wow || 0);

  const handleReact = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReacting) return;

    const token = safeLocalStorageGet('lost_token');
    if (!token) {
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: { message: 'Đăng nhập để bày tỏ cảm xúc với bài viết này nhé.', type: 'info' },
        })
      );
      window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
      return;
    }

    const prevOverride = reactionOverride;
    const targetType: 'like' | 'love' | 'wow' = userReaction || 'like';
    const isRemoving = userReaction === targetType;
    const optimisticUserReaction: 'like' | 'love' | 'wow' | null = isRemoving ? null : targetType;
    const optimisticReactions = {
      ...reactions,
      [targetType]: Math.max(0, (reactions[targetType] || 0) + (isRemoving ? -1 : 1)),
    };

    setReactionOverride({
      reportId: effectiveReport._id,
      userId: currentUserId,
      reactions: optimisticReactions,
      userReaction: optimisticUserReaction,
    });
    setIsReacting(true);

    try {
      const res = await fetch(`/api/trip-reports/${encodeURIComponent(effectiveReport._id)}/react`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ type: targetType }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.reactions) {
        const nextReactions = {
          like: Number(data.reactions.like) || 0,
          love: Number(data.reactions.love) || 0,
          wow: Number(data.reactions.wow) || 0,
        };
        const nextUserReaction =
          data.userReaction !== undefined
            ? data.userReaction === 'like' || data.userReaction === 'love' || data.userReaction === 'wow'
              ? data.userReaction
              : null
            : optimisticUserReaction;
        setReactionOverride({
          reportId: effectiveReport._id,
          userId: currentUserId,
          reactions: nextReactions,
          userReaction: nextUserReaction,
        });
      } else {
        setReactionOverride(prevOverride);
        const isAuthError = res.status === 401;
        const isRateLimit = res.status === 429;
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: {
              message:
                data?.message ||
                (isAuthError
                  ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
                  : isRateLimit
                    ? 'Bạn thao tác hơi nhanh, vui lòng thử lại sau vài giây.'
                    : 'Chưa lưu được tương tác, bạn thử lại nhé.'),
              type: isAuthError || isRateLimit ? 'info' : 'error',
            },
          })
        );
        if (isAuthError) {
          window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
        }
      }
    } catch {
      setReactionOverride(prevOverride);
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: { message: 'Chưa lưu được tương tác, bạn thử lại nhé.', type: 'error' },
        })
      );
    } finally {
      setIsReacting(false);
    }
  };

  const formattedDate = (() => {
    const d = new Date(effectiveReport.tripDate);
    if (Number.isNaN(d.getTime())) return effectiveReport.tripDate || 'Gần đây';
    try {
      return d.toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
  })();

  const rawCoverPhoto =
    effectiveReport.photos && effectiveReport.photos.length > 0
      ? effectiveReport.photos[0]
      : effectiveReport.trailId?.coverImage || '';
  const coverKey = `${effectiveReport._id}:${rawCoverPhoto}`;
  const showImageCover = Boolean(rawCoverPhoto) && failedCoverKey !== coverKey;
  const ratingVal = Math.min(5, Math.max(1, Number(effectiveReport.rating) || 5));

  return (
    <>
      <div
        className="card"
        role="button"
        tabIndex={0}
        onClick={() => setIsDetailOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsDetailOpen(true);
          }
        }}
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 4,
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
      >
        <div>
          {/* Cover Photo Banner or Pure-SVG Topographic Placeholder */}
          <div
            style={{
              position: 'relative',
              height: 190,
              width: '100%',
              overflow: 'hidden',
              background: 'var(--color-surface-elevated)',
            }}
          >
            {showImageCover ? (
              <img
                src={rawCoverPhoto}
                alt={effectiveReport.title}
                onError={() => setFailedCoverKey(coverKey)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transition: 'transform 0.5s ease',
                  display: 'block',
                }}
              />
            ) : (
              <svg
                viewBox="0 0 400 190"
                preserveAspectRatio="xMidYMid slice"
                style={{ width: '100%', height: '100%', display: 'block' }}
                aria-hidden="true"
              >
                <rect width="400" height="190" fill="var(--color-surface-elevated)" />
                <path
                  d="M0 140 L78 82 L145 126 L232 54 L318 118 L400 76 L400 190 L0 190 Z"
                  fill="color-mix(in srgb, var(--color-primary) 16%, transparent)"
                />
                <path
                  d="M0 162 L95 112 L170 148 L268 88 L350 138 L400 118 L400 190 L0 190 Z"
                  fill="color-mix(in srgb, var(--color-primary) 26%, transparent)"
                />
                <circle cx="322" cy="44" r="16" fill="color-mix(in srgb, var(--color-sun) 26%, transparent)" />
              </svg>
            )}

            {/* Gradient Scrim */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, transparent 15%, var(--overlay-bg) 100%)',
                pointerEvents: 'none',
              }}
            />

            {/* Badge at Bottom-Left */}
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'var(--color-bg-hud)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 4,
                padding: '3px 9px',
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-text-main)',
              }}
            >
              <IconBookOpen size={11} color="var(--color-primary)" />
              <span>Nhật ký</span>
            </div>

            {effectiveReport.duration && (
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: 'var(--color-bg-hud)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: 'var(--color-text-main)',
                }}
              >
                {effectiveReport.duration}
              </div>
            )}
          </div>

          {/* Content Body */}
          <div style={{ padding: '16px 18px 12px' }}>
            {/* Author Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {showAuthorAvatar ? (
                  <img
                    src={effectiveAuthorAvatar}
                    alt={authorName}
                    referrerPolicy="no-referrer"
                    onError={() => setFailedAvatarKey(avatarKey)}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      border: '1.5px solid var(--color-primary)',
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
                      border: '1px solid var(--color-primary)',
                      color: 'var(--color-primary)',
                      fontSize: '0.72rem',
                      fontWeight: 800,
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const authorPayload = {
                        name: authorName,
                        avatar: effectiveAuthorAvatar || '',
                        userId: effectiveReport.authorId?._id,
                      };
                      if (onOpenAuthorProfile) {
                        onOpenAuthorProfile(authorPayload);
                      } else {
                        setInspectedAuthor(authorPayload);
                      }
                    }}
                    title={`Xem hồ sơ ${authorName}`}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      color: 'var(--color-text-main)',
                      lineHeight: 1.15,
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                    }}
                  >
                    {authorName}
                  </button>
                  <div style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)', lineHeight: 1, marginTop: 2 }}>
                    {formattedDate}
                  </div>
                </div>
              </div>

              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-sun)', flexShrink: 0 }}>
                <IconStar size={12} color="var(--color-sun)" fill="var(--color-sun)" />
                <span>{ratingVal}.0</span>
              </span>
            </div>

            {effectiveReport.trailId?.name && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-sky)', marginBottom: 6 }}>
                <IconMountain size={12} color="var(--color-sky)" />
                <span>{effectiveReport.trailId.name}</span>
              </div>
            )}

            {/* Title */}
            <h3
              style={{
                fontSize: '0.98rem',
                fontWeight: 800,
                color: 'var(--color-text-main)',
                margin: '0 0 6px 0',
                lineHeight: 1.35,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {effectiveReport.title}
            </h3>

            {/* Summary */}
            <p
              style={{
                fontSize: '0.8rem',
                color: 'var(--color-text-muted)',
                lineHeight: 1.5,
                margin: 0,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {effectiveReport.summary || effectiveReport.content}
            </p>
          </div>
        </div>

        {/* Card Footer Metrics */}
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '10px 18px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
          <button
            type="button"
            disabled={isReacting}
            onClick={handleReact}
            style={{
              background: hasActiveReaction
                ? `color-mix(in srgb, ${activeReactionAccent} 12%, transparent)`
                : 'var(--color-bg-main)',
              border: hasActiveReaction
                ? `1px solid ${activeReactionAccent}`
                : '1px solid var(--color-border)',
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: '0.76rem',
              fontWeight: 800,
              color: hasActiveReaction ? activeReactionAccent : 'var(--color-text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              cursor: isReacting ? 'wait' : 'pointer',
              transition: 'background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease',
            }}
            title={hasActiveReaction ? `Bấm để bỏ đánh dấu (${activeReactionLabel})` : 'Đánh dấu bài viết hữu ích'}
          >
            {userReaction === 'wow' ? (
              <IconSparkles size={13} color={activeReactionAccent} />
            ) : userReaction === 'like' ? (
              <IconCheckCircle size={13} color={activeReactionAccent} />
            ) : (
              <IconHeart
                size={13}
                color={hasActiveReaction ? activeReactionAccent : 'var(--color-text-muted)'}
                fill={userReaction === 'love' ? activeReactionAccent : 'none'}
              />
            )}
            <span>
              {totalReactions} {activeReactionLabel}
            </span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-text-dim)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IconMessageSquare size={13} color="var(--color-sky)" />
              <span>{displayedCommentsCount}</span>
            </span>

            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IconEye size={13} color="var(--color-text-dim)" />
              <span>{effectiveReport.viewsCount || 1}</span>
            </span>
          </div>
        </div>
      </div>

      {isDetailOpen && (
        <TripReportDetailModal
          report={{ ...effectiveReport, reactions, userReaction, commentsCount: displayedCommentsCount }}
          currentUser={currentUser}
          onClose={() => setIsDetailOpen(false)}
          onReactionUpdated={(_id, updatedReactions, updatedUserReaction) => {
            setReactionOverride({
              reportId: effectiveReport._id,
              userId: currentUserId,
              reactions: updatedReactions,
              userReaction: updatedUserReaction,
            });
          }}
          onReportUpdated={(updated) => {
            setReportOverride(updated);
            if (typeof updated.commentsCount === 'number') {
              setCommentsCountOverride({ reportId: effectiveReport._id, count: updated.commentsCount });
            }
            onReportUpdated?.(updated);
          }}
          onReportDeleted={(deletedId) => {
            setIsDetailOpen(false);
            onReportDeleted?.(deletedId);
          }}
        />
      )}

      {inspectedAuthor && (
        <AuthorProfileModal
          author={inspectedAuthor}
          currentUser={currentUser}
          onClose={() => setInspectedAuthor(null)}
          onStartChat={() => {
            setInspectedAuthor(null);
            window.history.pushState({ view: 'messages' }, '', '/messages');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
        />
      )}
    </>
  );
};
