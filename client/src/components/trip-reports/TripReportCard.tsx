import React, { useState } from 'react';
import {
  IconHeart,
  IconBookOpen,
  IconMessageSquare,
  IconEye,
} from '../common/SvgIcons.js';

export interface TripReportItem {
  _id: string;
  authorId: {
    _id: string;
    fullName: string;
    avatarUrl: string;
    reputationScore?: number;
    badges?: string[];
  };
  trailId?: {
    _id: string;
    name: string;
    province?: string;
  };
  title: string;
  summary: string;
  content: string;
  photos: string[];
  tripDate: string;
  duration: string;
  rating: number;
  reactions: {
    like: number;
    love: number;
    wow: number;
  };
  commentsCount: number;
  viewsCount: number;
}

interface TripReportCardProps {
  report: TripReportItem;
}

export const TripReportCard: React.FC<TripReportCardProps> = ({ report }) => {
  const [likes, setLikes] = useState(report.reactions?.like || 0);
  const [liked, setLiked] = useState(false);

  const handleReact = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('trekmap_token');
      if (!token) return;

      const res = await fetch(`/api/trip-reports/${report._id}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'like' }),
      });
      const data = await res.json();
      if (data.success && data.reactions) {
        setLikes(data.reactions.like);
        setLiked(!liked);
      }
    } catch (err) {}
  };

  const formattedDate = new Date(report.tripDate).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const coverPhoto =
    report.photos && report.photos.length > 0
      ? report.photos[0]
      : 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80';

  return (
    <div
      className="card interactive-click card-hover-lift"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div>
        {/* Cover Photo Banner (Fixed Aspect Ratio) */}
        <div
          style={{
            position: 'relative',
            height: 180,
            width: '100%',
            overflow: 'hidden',
            background: 'var(--color-bg-main)',
          }}
        >
          <img
            src={coverPhoto}
            alt={report.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform 0.5s ease',
            }}
          />

          {/* Gradient Scrim */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(7, 13, 30, 0.2) 0%, rgba(7, 13, 30, 0.88) 100%)',
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
              background: 'rgba(7, 13, 30, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--color-border)',
              borderRadius: 16,
              padding: '3px 10px',
              fontSize: '0.72rem',
              fontWeight: 800,
              color: 'var(--color-primary)',
            }}
          >
            <IconBookOpen size={12} color="var(--color-primary)" />
            <span>Nhật Ký Hành Trình</span>
          </div>

          {report.duration && (
            <div
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'rgba(7, 13, 30, 0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                padding: '2px 8px',
                fontSize: '0.68rem',
                fontWeight: 700,
                color: 'var(--color-sky)',
              }}
            >
              {report.duration}
            </div>
          )}
        </div>

        {/* Content Body */}
        <div style={{ padding: '16px 18px 12px' }}>
          {/* Author Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <img
              src={report.authorId?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
              alt={report.authorId?.fullName || 'Trekker'}
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                border: '1.5px solid var(--color-primary)',
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1.1 }}>
                {report.authorId?.fullName || 'Thiên Thiên'}
              </div>
              <div style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)', lineHeight: 1, marginTop: 2 }}>
                {formattedDate}
              </div>
            </div>
          </div>

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
          onClick={handleReact}
          style={{
            background: liked ? 'rgba(239, 68, 68, 0.15)' : 'var(--color-bg-main)',
            border: liked ? '1px solid var(--color-error)' : '1px solid var(--color-border)',
            borderRadius: 16,
            padding: '4px 10px',
            fontSize: '0.76rem',
            fontWeight: 800,
            color: liked ? 'var(--color-error)' : 'var(--color-text-muted)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <IconHeart size={13} color={liked ? 'var(--color-error)' : 'var(--color-text-muted)'} fill={liked ? 'var(--color-error)' : 'none'} />
          <span>{likes + (liked ? 1 : 0)} Thích</span>
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
  );
};
