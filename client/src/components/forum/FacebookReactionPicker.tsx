import React, { useState, useRef } from 'react';

// Custom TrekMap Reaction Image Component (Direct PNG Assets from User Design with Vibrancy Boost)
export const TrekReactionImg = ({ name, size = 34, alt = '' }: { name: string; size?: number; alt?: string }) => (
  <img
    src={`/reactions/${name}.png`}
    alt={alt || name}
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      display: 'inline-block',
      verticalAlign: 'middle',
      filter: 'brightness(1.15) contrast(1.15) saturate(1.3) drop-shadow(0 3px 8px rgba(0,0,0,0.45))',
      transition: 'all 0.2s ease',
    }}
  />
);

export type ReactionType = 'like' | 'dislike' | 'haha' | 'wow' | 'buon' | 'huhu' | 'angry' | 'love' | 'sad' | null;

export interface ReactionItem {
  id: ReactionType;
  label: string;
  emoji: string;
  color: string;
  icon: React.ReactNode;
}

export const REACTION_LIST: ReactionItem[] = [
  { id: 'like', label: 'Thích', emoji: '👍', color: '#fbbf24', icon: <TrekReactionImg name="like" size={34} alt="Thích" /> },
  { id: 'dislike', label: 'Không thích', emoji: '👎', color: '#cbd5e1', icon: <TrekReactionImg name="dislike" size={34} alt="Không thích" /> },
  { id: 'haha', label: 'Haha', emoji: '😆', color: '#f97316', icon: <TrekReactionImg name="haha" size={34} alt="Haha" /> },
  { id: 'wow', label: 'Wow', emoji: '😮', color: '#38bdf8', icon: <TrekReactionImg name="wow" size={34} alt="Wow" /> },
  { id: 'buon', label: 'Buồn', emoji: '😢', color: '#818cf8', icon: <TrekReactionImg name="buon" size={34} alt="Buồn" /> },
  { id: 'huhu', label: 'Huhu', emoji: '😭', color: '#22d3ee', icon: <TrekReactionImg name="huhu" size={34} alt="Huhu" /> },
  { id: 'angry', label: 'Phẫn nộ', emoji: '😡', color: '#f87171', icon: <TrekReactionImg name="angry" size={34} alt="Phẫn nộ" /> },
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
    }, 350);
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Floating Reaction Bar Modal (Facebook Style Seamless Hit-box) */}
      {showPicker && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            paddingBottom: 12, // Transparent seamless bridge to prevent mouse leaving!
            zIndex: 999,
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(12, 35, 48, 0.98), rgba(6, 20, 28, 0.99))',
              backdropFilter: 'blur(20px)',
              border: '2px solid #00ffd5',
              borderRadius: 40,
              padding: '8px 16px',
              display: 'flex',
              gap: 12,
              boxShadow: '0 16px 50px rgba(0, 255, 213, 0.5), 0 0 25px rgba(0, 255, 213, 0.3)',
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
                        bottom: '115%',
                        background: 'rgba(4, 19, 27, 0.95)',
                        color: item.color,
                        border: `1.5px solid ${item.color}`,
                        borderRadius: 12,
                        padding: '3px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        boxShadow: `0 4px 15px ${item.color}66`,
                        pointerEvents: 'none',
                        animation: 'fadeIn 0.15s ease',
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
                      background: isSelected ? 'rgba(0, 255, 213, 0.35)' : 'rgba(255, 255, 255, 0.14)',
                      border: isSelected ? `2px solid ${item.color}` : '1.5px solid rgba(255, 255, 255, 0.2)',
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '50%',
                      transition: 'all 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isSelected ? `0 0 20px ${item.color}` : '0 4px 14px rgba(0, 0, 0, 0.35)',
                    }}
                    onMouseEnter={(e) => {
                      setHoveredId(item.id as string);
                      e.currentTarget.style.transform = 'scale(1.55) translateY(-10px) rotate(-4deg)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.28)';
                      e.currentTarget.style.filter = `drop-shadow(0 8px 20px ${item.color})`;
                      e.currentTarget.style.borderColor = item.color;
                    }}
                    onMouseLeave={(e) => {
                      setHoveredId(null);
                      e.currentTarget.style.transform = 'scale(1) translateY(0) rotate(0deg)';
                      e.currentTarget.style.background = isSelected ? 'rgba(0, 255, 213, 0.35)' : 'rgba(255, 255, 255, 0.14)';
                      e.currentTarget.style.filter = 'none';
                      e.currentTarget.style.borderColor = isSelected ? item.color : 'rgba(255, 255, 255, 0.2)';
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

      {/* Main Trigger Button (Facebook Exact UI Style) */}
      <button
        type="button"
        onMouseEnter={handleMouseEnter}
        onClick={(e) => {
          e.stopPropagation();
          setShowPicker(!showPicker);
        }}
        style={{
          background: activeItem ? 'rgba(0, 255, 213, 0.14)' : 'rgba(255, 255, 255, 0.05)',
          border: activeItem ? `1.5px solid ${activeItem.color}` : '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 24,
          padding: '5px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transition: 'all 0.2s ease',
          boxShadow: activeItem ? `0 0 16px ${activeItem.color}44` : 'none',
        }}
      >
        {/* Top 3 Overlapping Icons Stack (Facebook Round Coin Style) */}
        {top3Icons.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {top3Icons.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  marginLeft: idx > 0 ? -6 : 0,
                  zIndex: top3Icons.length - idx,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'var(--color-bg-card)',
                  border: '1.5px solid var(--color-border)',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                  overflow: 'hidden',
                }}
              >
                <TrekReactionImg name={item.id as string} size={18} alt={item.label} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <TrekReactionImg name={activeItem ? (activeItem.id as string) : 'like'} size={22} alt={activeItem ? activeItem.label : 'Thích'} />
          </div>
        )}

        {/* Facebook Style Reaction Count Number */}
        <span
          style={{
            fontSize: '0.88rem',
            fontWeight: 800,
            color: activeItem ? activeItem.color : '#cbd5e1',
            marginLeft: 2,
            lineHeight: 1,
          }}
        >
          {computedTotal}
        </span>
      </button>
    </div>
  );
};


