import React, { useState } from 'react';
import {
  IconHeart,
  IconBookOpen,
  IconMessageSquare,
  IconEye,
  IconStar,
  IconMountain,
} from '../common/SvgIcons.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import type { UserProfile } from '../../types.js';
import { TripReportDetailModal } from './TripReportDetailModal.js';

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
  commentsCount: number;
  viewsCount: number;
}

interface TripReportCardProps {
  report: TripReportItem;
  currentUser?: UserProfile | null;
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

export const TripReportCard: React.FC<TripReportCardProps> = ({ report, currentUser }) => {
  const loggedInUser = currentUser || null;
  const currentUserId = String(loggedInUser?.id || (loggedInUser as (UserProfile & { _id?: string }) | null)?._id || '');

  const [reactionOverride, setReactionOverride] = useState<{
    reportId: string;
    userId: string;
    reactions: { like: number; love: number; wow: number };
    userReaction: 'like' | 'love' | 'wow' | null;
  } | null>(null);
  const [isReacting, setIsReacting] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);

  const hasReactionOverride =
    reactionOverride !== null &&
    reactionOverride.reportId === report._id &&
    reactionOverride.userId === currentUserId;
  const reactions = hasReactionOverride
    ? reactionOverride.reactions
    : {
        like: report.reactions?.like || 0,
        love: report.reactions?.love || 0,
        wow: report.reactions?.wow || 0,
      };
  const userReaction = hasReactionOverride
    ? reactionOverride.userReaction
    : getInitialUserReaction(report, currentUserId);

  const isAuthorSelf = Boolean(
    currentUserId && report.authorId?._id && String(report.authorId._id) === currentUserId
  );
  const authorName = report.authorId?.fullName || 'Thành viên cộng đồng';
  const effectiveAuthorAvatar =
    isAuthorSelf && (loggedInUser?.avatarUrl || loggedInUser?.avatar)
      ? loggedInUser.avatarUrl || loggedInUser.avatar
      : report.authorId?.avatarUrl || '';

  const liked = userReaction === 'like';
  const totalReactions = (reactions.like || 0) + (reactions.love || 0) + (reactions.wow || 0);

  const handleReact = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReacting) return;

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
      const res = await fetch(`/api/trip-reports/${encodeURIComponent(report._id)}/react`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ type: 'like' }),
      });
      const data = await res.json();
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
            : userReaction;
        setReactionOverride({
          reportId: report._id,
          userId: currentUserId,
          reactions: nextReactions,
          userReaction: nextUserReaction,
        });
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: { message: 'Không thể gửi cảm xúc lúc này.', type: 'error' },
        })
      );
    } finally {
      setIsReacting(false);
    }
  };

  const formattedDate = (() => {
    const d = new Date(report.tripDate);
    if (Number.isNaN(d.getTime())) return report.tripDate || 'Gần đây';
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  })();

  const rawCoverPhoto =
    report.photos && report.photos.length > 0
      ? report.photos[0]
      : report.trailId?.coverImage || '';
  const showImageCover = Boolean(rawCoverPhoto) && !coverFailed;
  const ratingVal = Math.min(5, Math.max(1, Number(report.rating) || 5));

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
                alt={report.title}
                onError={() => setCoverFailed(true)}
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
                backdropFilter: 'blur(8px)',
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
              <span>Nhật Ký</span>
            </div>

            {report.duration && (
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: 'var(--color-bg-hud)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: 'var(--color-text-main)',
                }}
              >
                {report.duration}
              </div>
            )}
          </div>

          {/* Content Body */}
          <div style={{ padding: '16px 18px 12px' }}>
            {/* Author Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {effectiveAuthorAvatar ? (
                  <img
                    src={effectiveAuthorAvatar}
                    alt={authorName}
                    referrerPolicy="no-referrer"
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
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {authorName}
                  </div>
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

            {report.trailId?.name && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-sky)', marginBottom: 6 }}>
                <IconMountain size={12} color="var(--color-sky)" />
                <span>{report.trailId.name}</span>
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
              {report.title}
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
              {report.summary || report.content}
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
              background: liked ? 'color-mix(in srgb, var(--color-error) 14%, transparent)' : 'var(--color-bg-main)',
              border: liked ? '1px solid var(--color-error)' : '1px solid var(--color-border)',
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: '0.76rem',
              fontWeight: 800,
              color: liked ? 'var(--color-error-text, var(--color-error))' : 'var(--color-text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              cursor: isReacting ? 'wait' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <IconHeart size={13} color={liked ? 'var(--color-error-text, var(--color-error))' : 'var(--color-text-muted)'} fill={liked ? 'var(--color-error-text, var(--color-error))' : 'none'} />
            <span>{totalReactions} Cảm xúc</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-text-dim)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IconMessageSquare size={13} color="var(--color-sky)" />
              <span>{report.commentsCount || 0}</span>
            </span>

            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IconEye size={13} color="var(--color-text-dim)" />
              <span>{report.viewsCount || 1}</span>
            </span>
          </div>
        </div>
      </div>

      {isDetailOpen && (
        <TripReportDetailModal
          report={{ ...report, reactions, userReaction }}
          currentUser={currentUser}
          onClose={() => setIsDetailOpen(false)}
          onReactionUpdated={(_id, updatedReactions, updatedUserReaction) => {
            setReactionOverride({
              reportId: report._id,
              userId: currentUserId,
              reactions: updatedReactions,
              userReaction: updatedUserReaction,
            });
          }}
        />
      )}
    </>
  );
};
