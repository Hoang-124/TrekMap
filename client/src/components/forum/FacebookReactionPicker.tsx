import React, { useState, useRef } from 'react';
import { TrekReactionSvg, type ReactionType } from './TrekReactionSvg.js';

export { TrekReactionSvg };
export type { ReactionType };

// Backwards compatibility alias for TrekReactionImg -> purely renders pure Vector SVG
export const TrekReactionImg = ({ name, size = 28, alt: _alt = '' }: { name: string; size?: number; alt?: string }) => (
  <TrekReactionSvg name={name as ReactionType} size={size} />
);

export interface ReactionItem {
  id: ReactionType;
  label: string;
  emoji: string;
  color: string;
  icon: React.ReactNode;
}

export const REACTION_LIST: ReactionItem[] = [
  { id: 'like', label: 'Thích', emoji: '👍', color: '#38bdf8', icon: <TrekReactionSvg name="like" size={28} /> },
  { id: 'love', label: 'Yêu thích', emoji: '❤️', color: '#f43f5e', icon: <TrekReactionSvg name="love" size={28} /> },
  { id: 'haha', label: 'Haha', emoji: '😆', color: '#fbbf24', icon: <TrekReactionSvg name="haha" size={28} /> },
  { id: 'wow', label: 'Wow', emoji: '😮', color: '#f59e0b', icon: <TrekReactionSvg name="wow" size={28} /> },
  { id: 'buon', label: 'Buồn', emoji: '😢', color: '#60a5fa', icon: <TrekReactionSvg name="buon" size={28} /> },
  { id: 'huhu', label: 'Huhu', emoji: '😭', color: '#38bdf8', icon: <TrekReactionSvg name="huhu" size={28} /> },
  { id: 'angry', label: 'Phẫn nộ', emoji: '😡', color: '#ef4444', icon: <TrekReactionSvg name="angry" size={28} /> },
  { id: 'dislike', label: 'Không thích', emoji: '👎', color: '#94a3b8', icon: <TrekReactionSvg name="dislike" size={28} /> },
];

interface FacebookReactionPickerProps {
  currentReaction: ReactionType;
  totalLikes: number;
  reactionsSummary?: Record<string, number>;
  onSelectReaction: (reaction: ReactionType) => void;
}

export const FacebookReactionPicker: React.FC<FacebookReactionPickerProps> = ({
  currentReaction,
  totalLikes,
  reactionsSummary,
  onSelectReaction,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const timeoutRef = useRef<any>(null);

  const activeItem = REACTION_LIST.find((r) => r.id === currentReaction);

  // Calculate Top 3 Most-Reacted Icons (Facebook Style Overlapping Stack)
  const top3Icons = React.useMemo(() => {
    if (!reactionsSummary) {
      if (activeItem) return [activeItem];
      return [];
    }
    const sorted = REACTION_LIST.filter((item) => {
      const key = item.id as string;
      return reactionsSummary[key] && reactionsSummary[key] > 0;
    }).sort((a, b) => {
      const countA = reactionsSummary[a.id as string] || 0;
      const countB = reactionsSummary[b.id as string] || 0;
      return countB - countA;
    });

    if (sorted.length > 0) return sorted.slice(0, 3);
    if (activeItem) return [activeItem];
    return [];
  }, [reactionsSummary, activeItem]);

  // Calculate Total Reaction Count dynamically from reactionsSummary or totalLikes prop
  const computedTotal = React.useMemo(() => {
    if (reactionsSummary && typeof reactionsSummary === 'object') {
      const sum = Object.values(reactionsSummary).reduce((acc, count) => acc + (typeof count === 'number' ? count : 0), 0);
      if (sum > 0) return sum;
    }
    return totalLikes || 0;
  }, [reactionsSummary, totalLikes]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowPicker(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowPicker(false);
      setHoveredId(null);
    }, 300);
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Floating Reaction Bar Modal (Anchored to right of button to avoid screen overflow) */}
      {showPicker && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 2px)',
            right: 0,
            paddingBottom: 10,
            zIndex: 99999,
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div
            className="reaction-bar-slide"
            style={{
              background: 'var(--color-bg-card)',
              backdropFilter: 'blur(20px)',
              border: '1.5px solid var(--color-border-glow)',
              borderRadius: 36,
              padding: '6px 12px',
              display: 'flex',
              gap: 8,
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(5, 150, 105, 0.25)',
              alignItems: 'center',
              whiteSpace: 'nowrap',
              position: 'relative',
            }}
          >
            {REACTION_LIST.map((item) => {
              const isHovered = hoveredId === item.id;
              const isSelected = currentReaction === item.id;
              return (
                <div key={item.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {/* Floating Tooltip Text on Hover */}
                  {isHovered && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '120%',
                        background: 'var(--color-bg-main)',
                        color: item.color,
                        border: `1px solid ${item.color}`,
                        borderRadius: 10,
                        padding: '2px 8px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        boxShadow: `0 4px 12px ${item.color}44`,
                        pointerEvents: 'none',
                        zIndex: 1000,
                      }}
                    >
                      {item.label}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectReaction(currentReaction === item.id ? null : item.id);
                      setShowPicker(false);
                    }}
                    title={item.label}
                    style={{
                      background: isSelected ? 'rgba(5, 150, 105, 0.25)' : 'var(--color-bg-main)',
                      border: isSelected ? `2px solid ${item.color}` : '1px solid var(--color-border)',
                      cursor: 'pointer',
                      padding: '6px',
                      borderRadius: '50%',
                      transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isSelected ? `0 0 14px ${item.color}` : 'none',
                    }}
                    onMouseEnter={(e) => {
                      setHoveredId(item.id as string);
                      e.currentTarget.style.transform = 'scale(1.4) translateY(-6px)';
                      e.currentTarget.style.background = 'var(--color-bg-card)';
                      e.currentTarget.style.borderColor = item.color;
                    }}
                    onMouseLeave={(e) => {
                      setHoveredId(null);
                      e.currentTarget.style.transform = 'scale(1) translateY(0)';
                      e.currentTarget.style.background = isSelected ? 'rgba(5, 150, 105, 0.25)' : 'var(--color-bg-main)';
                      e.currentTarget.style.borderColor = isSelected ? item.color : 'var(--color-border)';
                    }}
                  >
                    <span>{item.icon}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Trigger Button */}
      <button
        type="button"
        onMouseEnter={handleMouseEnter}
        onClick={(e) => {
          e.stopPropagation();
          setShowPicker(!showPicker);
        }}
        style={{
          background: activeItem ? 'rgba(5, 150, 105, 0.14)' : 'var(--color-bg-main)',
          border: activeItem ? `1.5px solid ${activeItem.color}` : '1px solid var(--color-border)',
          borderRadius: 20,
          padding: '4px 10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transition: 'all 0.2s ease',
          boxShadow: activeItem ? `0 0 12px ${activeItem.color}33` : 'none',
        }}
      >
        {/* Top 3 Overlapping Icons Stack */}
        {top3Icons.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {top3Icons.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  marginLeft: idx > 0 ? -5 : 0,
                  zIndex: top3Icons.length - idx,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  overflow: 'hidden',
                }}
              >
                <TrekReactionSvg name={item.id as string} size={16} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <TrekReactionSvg name={activeItem ? (activeItem.id as string) : 'like'} size={18} />
          </div>
        )}

        {/* Reaction Count Number */}
        <span
          style={{
            fontSize: '0.82rem',
            fontWeight: 800,
            color: activeItem ? activeItem.color : 'var(--color-text-muted)',
            marginLeft: 1,
            lineHeight: 1,
          }}
        >
          {computedTotal}
        </span>
      </button>
    </div>
  );
};
