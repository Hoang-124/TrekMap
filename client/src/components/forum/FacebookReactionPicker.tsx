import React, { useState, useRef, useEffect } from 'react';
import { TrekReactionSvg, type ReactionType } from './TrekReactionSvg.js';

export { TrekReactionSvg };
export type { ReactionType };

// Backwards compatibility alias -> purely renders clean vector SVG
export const TrekReactionImg = ({ name, size = 18, alt: _alt = '' }: { name: string; size?: number; alt?: string }) => (
  <TrekReactionSvg name={name as ReactionType} size={size} />
);

export interface ReactionItem {
  id: ReactionType;
  label: string;
  color: string;
  icon: React.ReactNode;
}

const REACTION_LIST: ReactionItem[] = [
  { id: 'like', label: 'Hữu ích', color: 'var(--color-primary)', icon: <TrekReactionSvg name="like" size={17} color="var(--color-primary)" /> },
  { id: 'love', label: 'Yêu thích', color: 'var(--color-error)', icon: <TrekReactionSvg name="love" size={17} color="var(--color-error)" /> },
  { id: 'haha', label: 'Thú vị', color: 'var(--color-sun)', icon: <TrekReactionSvg name="haha" size={17} color="var(--color-sun)" /> },
  { id: 'wow', label: 'Ấn tượng', color: 'var(--color-sky)', icon: <TrekReactionSvg name="wow" size={17} color="var(--color-sky)" /> },
  { id: 'buon', label: 'Tiếc nuối', color: 'var(--color-stream)', icon: <TrekReactionSvg name="buon" size={17} color="var(--color-stream)" /> },
  { id: 'huhu', label: 'Đồng cảm', color: 'var(--color-sky)', icon: <TrekReactionSvg name="huhu" size={17} color="var(--color-sky)" /> },
  { id: 'angry', label: 'Đáng lo', color: 'var(--color-earth)', icon: <TrekReactionSvg name="angry" size={17} color="var(--color-earth)" /> },
  { id: 'dislike', label: 'Chưa đồng ý', color: 'var(--color-text-muted)', icon: <TrekReactionSvg name="dislike" size={17} color="var(--color-text-muted)" /> },
];

// Normalize legacy 'sad' reaction alias to 'buon' cleanly
function normalizeReactionId(id: ReactionType | string | undefined): ReactionType {
  if (!id) return null;
  if (id === 'sad') return 'buon';
  return id as ReactionType;
}

function getSummaryCountForKey(summary: Record<string, number>, key: string): number {
  const base = Number(summary[key]) || 0;
  if (key === 'buon') {
    return base + (Number(summary.sad) || 0);
  }
  return base;
}

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
  const [alignLeft, setAlignLeft] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedCurrent = normalizeReactionId(currentReaction);
  const activeItem = REACTION_LIST.find((r) => r.id === normalizedCurrent);

  const top3Icons = React.useMemo(() => {
    if (!reactionsSummary) {
      if (activeItem) return [activeItem];
      return [];
    }
    const sorted = REACTION_LIST.filter((item) => {
      const key = item.id as string;
      return getSummaryCountForKey(reactionsSummary, key) > 0;
    }).sort((a, b) => {
      const countA = getSummaryCountForKey(reactionsSummary, a.id as string);
      const countB = getSummaryCountForKey(reactionsSummary, b.id as string);
      return countB - countA;
    });

    if (sorted.length > 0) return sorted.slice(0, 3);
    if (activeItem) return [activeItem];
    return [];
  }, [reactionsSummary, activeItem]);

  const computedTotal = React.useMemo(() => {
    if (reactionsSummary && typeof reactionsSummary === 'object') {
      const sum = Object.values(reactionsSummary).reduce((acc, count) => acc + (typeof count === 'number' ? count : 0), 0);
      if (sum > 0) return sum;
    }
    return totalLikes || 0;
  }, [reactionsSummary, totalLikes]);

  const openPickerWithBoundsCheck = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setAlignLeft(rect.left < 270);
    }
    setShowPicker(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowPicker(false);
      setHoveredId(null);
    }, 260);
  };

  // Close picker when clicking/tapping outside on touch devices
  useEffect(() => {
    if (!showPicker) return;
    const handleOutside = (e: PointerEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
        setHoveredId(null);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [showPicker]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      ref={triggerRef}
      style={{ position: 'relative', display: 'inline-block' }}
      onPointerEnter={(e) => {
        // Ignore synthesized touch hover events so touch taps don't double-toggle!
        if (e.pointerType === 'mouse') {
          openPickerWithBoundsCheck();
        }
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') {
          handleMouseLeave();
        }
      }}
    >
      {/* Floating Reaction Dock (Silky GPU Enter + Exit + Stagger Wave) */}
      <div
        aria-hidden={!showPicker}
        className={`reaction-dock-shell${showPicker ? ' open' : ''}`}
        style={{
          position: 'absolute',
          bottom: 'calc(100% + 2px)',
          ...(alignLeft ? { left: 0 } : { right: 0 }),
          transformOrigin: alignLeft ? 'bottom left' : 'bottom right',
          paddingBottom: 6,
          zIndex: 'var(--z-dropdown, 1100)',
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse' && showPicker) openPickerWithBoundsCheck();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') handleMouseLeave();
        }}
      >
        <div
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: 6,
            padding: '4px 6px',
            display: 'flex',
            gap: 3,
            boxShadow: 'var(--shadow-3d)',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            position: 'relative',
          }}
        >
          {REACTION_LIST.map((item, idx) => {
            const isHovered = hoveredId === item.id;
            const isSelected = normalizedCurrent === item.id;
            return (
              <div
                key={item.id}
                className="reaction-dock-item"
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  ['--rx-delay' as string]: `${idx * 18}ms`,
                }}
              >
                <div
                  className={`reaction-tooltip-pill${isHovered && showPicker ? ' visible' : ''}`}
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 7px)',
                    background: 'var(--color-bg-main)',
                    color: 'var(--color-text-main)',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: 4,
                    padding: '2px 7px',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    boxShadow: 'var(--shadow-card)',
                    zIndex: 10,
                  }}
                >
                  {item.label}
                </div>

                <button
                  type="button"
                  tabIndex={showPicker ? 0 : -1}
                  className="reaction-item-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectReaction(normalizedCurrent === item.id ? null : item.id);
                    setShowPicker(false);
                    setHoveredId(null);
                  }}
                  aria-label={item.label}
                  style={{
                    width: 30,
                    height: 30,
                    background: isSelected
                      ? `color-mix(in srgb, ${item.color} 15%, transparent)`
                      : isHovered
                        ? 'var(--color-surface-elevated)'
                        : 'transparent',
                    border: isSelected ? `1px solid ${item.color}` : '1px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                    borderRadius: 4,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPointerEnter={(e) => {
                    if (e.pointerType === 'mouse') setHoveredId(item.id as string);
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === 'mouse') setHoveredId(null);
                  }}
                >
                  {item.icon}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Trigger Button — Unified 4px Swiss Field Chip */}
      <button
        type="button"
        className="interactive-click"
        onClick={(e) => {
          e.stopPropagation();
          if (!showPicker) openPickerWithBoundsCheck();
          else setShowPicker(false);
        }}
        style={{
          background: activeItem ? `color-mix(in srgb, ${activeItem.color} 12%, transparent)` : 'var(--color-bg-main)',
          border: activeItem ? `1px solid color-mix(in srgb, ${activeItem.color} 45%, transparent)` : '1px solid var(--color-border)',
          borderRadius: 4,
          padding: '4px 9px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        {top3Icons.length > 0 ? (
          <div
            key={normalizedCurrent || 'summary'}
            className={normalizedCurrent ? 'reaction-badge-pop' : undefined}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
          >
            {top3Icons.map((item) => (
              <TrekReactionSvg key={item.id} name={item.id as string} size={14} color={item.color} />
            ))}
          </div>
        ) : (
          <TrekReactionSvg
            name={activeItem ? (activeItem.id as string) : 'like'}
            size={14}
            color={activeItem ? activeItem.color : 'var(--color-text-dim)'}
          />
        )}

        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            color: activeItem ? activeItem.color : 'var(--color-text-muted)',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {computedTotal}
        </span>
      </button>
    </div>
  );
};
