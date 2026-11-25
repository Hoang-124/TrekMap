import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  {
    id: 'love',
    label: 'Yêu thích',
    color: 'var(--color-error-text, var(--color-error))',
    icon: <TrekReactionSvg name="love" size={17} color="var(--color-error-text, var(--color-error))" />,
  },
  { id: 'haha', label: 'Thú vị', color: 'var(--color-sun)', icon: <TrekReactionSvg name="haha" size={17} color="var(--color-sun)" /> },
  { id: 'wow', label: 'Ấn tượng', color: 'var(--color-sky)', icon: <TrekReactionSvg name="wow" size={17} color="var(--color-sky)" /> },
  { id: 'buon', label: 'Tiếc nuối', color: 'var(--color-stream)', icon: <TrekReactionSvg name="buon" size={17} color="var(--color-stream)" /> },
  { id: 'huhu', label: 'Đồng cảm', color: 'var(--color-sky)', icon: <TrekReactionSvg name="huhu" size={17} color="var(--color-sky)" /> },
  { id: 'angry', label: 'Đáng lo', color: 'var(--color-earth)', icon: <TrekReactionSvg name="angry" size={17} color="var(--color-earth)" /> },
  { id: 'dislike', label: 'Chưa đồng ý', color: 'var(--color-text-muted)', icon: <TrekReactionSvg name="dislike" size={17} color="var(--color-text-muted)" /> },
];

const ESTIMATED_DOCK_WIDTH = 278;
const ESTIMATED_DOCK_HEIGHT = 44;
const VIEWPORT_MARGIN = 8;

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

interface DockCoords {
  top: number;
  left: number;
  flipped: boolean;
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
  const [dockCoords, setDockCoords] = useState<DockCoords>({ top: 0, left: VIEWPORT_MARGIN, flipped: false });
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPointerTypeRef = useRef<string>('');
  const openedByHoverRef = useRef<boolean>(false);

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
    if (reactionsSummary && typeof reactionsSummary === 'object' && Object.keys(reactionsSummary).length > 0) {
      return Object.values(reactionsSummary).reduce(
        (acc, count) => acc + (typeof count === 'number' && Number.isFinite(count) ? Math.max(0, count) : 0),
        0
      );
    }
    return totalLikes || 0;
  }, [reactionsSummary, totalLikes]);

  const clearHideTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const computeViewportClampedPosition = useCallback((): DockCoords | null => {
    if (!triggerRef.current || typeof window === 'undefined') return null;
    const rect = triggerRef.current.getBoundingClientRect();
    const dockWidth = Math.min(dockRef.current?.offsetWidth || ESTIMATED_DOCK_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    const dockHeight = dockRef.current?.offsetHeight || ESTIMATED_DOCK_HEIGHT;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const idealLeft = rect.left + dockWidth <= vw - VIEWPORT_MARGIN ? rect.left : rect.right - dockWidth;
    const clampedLeft = Math.max(VIEWPORT_MARGIN, Math.min(idealLeft, vw - dockWidth - VIEWPORT_MARGIN));

    const canPlaceAbove = rect.top >= dockHeight + 12;
    const flipped = !canPlaceAbove && rect.bottom + dockHeight + 12 <= vh;
    const rawTop = flipped ? rect.bottom : rect.top - dockHeight - 4;
    const clampedTop = Math.max(VIEWPORT_MARGIN, Math.min(rawTop, vh - dockHeight - VIEWPORT_MARGIN));

    return { top: clampedTop, left: clampedLeft, flipped };
  }, []);

  const openPickerWithBoundsCheck = useCallback(
    (viaHover: boolean) => {
      clearHideTimer();
      openedByHoverRef.current = viaHover;
      const nextPos = computeViewportClampedPosition();
      if (nextPos) setDockCoords(nextPos);
      setShowPicker(true);
    },
    [clearHideTimer, computeViewportClampedPosition]
  );

  const closePicker = useCallback(() => {
    clearHideTimer();
    openedByHoverRef.current = false;
    setShowPicker(false);
    setHoveredId(null);
  }, [clearHideTimer]);

  const handleMouseLeave = useCallback(() => {
    clearHideTimer();
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      openedByHoverRef.current = false;
      setShowPicker(false);
      setHoveredId(null);
    }, 260);
  }, [clearHideTimer]);

  // Close picker on outside click, Escape key (stopping propagation to parent modals), or viewport scroll/resize
  useEffect(() => {
    if (!showPicker) return;

    const handleOutside = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (
        target &&
        !triggerRef.current?.contains(target) &&
        !dockRef.current?.contains(target)
      ) {
        closePicker();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        closePicker();
        triggerButtonRef.current?.focus();
      }
    };

    const handleReposition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        closePicker();
        return;
      }
      const nextPos = computeViewportClampedPosition();
      if (nextPos) setDockCoords(nextPos);
    };

    document.addEventListener('pointerdown', handleOutside);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [showPicker, closePicker, computeViewportClampedPosition]);

  useEffect(() => {
    return () => {
      clearHideTimer();
    };
  }, [clearHideTimer]);

  const triggerAriaLabel = activeItem
    ? `Cảm xúc đã chọn: ${activeItem.label}, tổng ${computedTotal}. Nhấn để thay đổi hoặc bỏ cảm xúc`
    : `Thả cảm xúc, tổng ${computedTotal}`;

  return (
    <div
      ref={triggerRef}
      style={{ position: 'relative', display: 'inline-block' }}
      onPointerEnter={(e) => {
        // Ignore synthesized touch hover events so touch taps don't double-toggle
        if (e.pointerType === 'mouse') {
          openPickerWithBoundsCheck(true);
        }
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') {
          handleMouseLeave();
        }
      }}
    >
      {/* Floating Reaction Dock (Portaled & Viewport-Clamped so narrow screens & modals never clip) */}
      {showPicker &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dockRef}
            role="menu"
            aria-label="Chọn cảm xúc"
            className="reaction-dock-shell open"
            style={{
              position: 'fixed',
              top: dockCoords.top,
              left: dockCoords.left,
              transformOrigin: dockCoords.flipped ? 'top center' : 'bottom center',
              paddingBottom: dockCoords.flipped ? 0 : 6,
              paddingTop: dockCoords.flipped ? 6 : 0,
              zIndex: 'calc(var(--z-modal-nested, 3100) + 50)',
              maxWidth: 'calc(100vw - 16px)',
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerEnter={(e) => {
              if (e.pointerType === 'mouse') clearHideTimer();
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
                overflowX: 'auto',
                maxWidth: 'calc(100vw - 16px)',
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
                      flexShrink: 0,
                      ['--rx-delay' as string]: `${idx * 18}ms`,
                    }}
                  >
                    <div
                      className={`reaction-tooltip-pill${isHovered ? ' visible' : ''}`}
                      style={{
                        position: 'absolute',
                        bottom: dockCoords.flipped ? undefined : 'calc(100% + 7px)',
                        top: dockCoords.flipped ? 'calc(100% + 7px)' : undefined,
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
                      role="menuitem"
                      className="reaction-item-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectReaction(normalizedCurrent === item.id ? null : item.id);
                        closePicker();
                      }}
                      aria-label={item.label}
                      aria-pressed={isSelected}
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
          </div>,
          document.body
        )}

      {/* Main Trigger Button — Unified 4px Swiss Field Chip */}
      <button
        ref={triggerButtonRef}
        type="button"
        className="interactive-click"
        aria-label={triggerAriaLabel}
        aria-expanded={showPicker}
        aria-haspopup="menu"
        onPointerDown={(e) => {
          lastPointerTypeRef.current = e.pointerType;
        }}
        onClick={(e) => {
          e.stopPropagation();
          const isKeyboardActivation = e.detail === 0;
          const isMouseClick = !isKeyboardActivation && lastPointerTypeRef.current === 'mouse';
          if (isMouseClick && (openedByHoverRef.current || !showPicker)) {
            // Desktop hover opens dock; clicking main trigger quick-toggles reaction
            onSelectReaction(normalizedCurrent ? null : 'like');
            closePicker();
            return;
          }
          if (!showPicker) {
            openPickerWithBoundsCheck(false);
          } else {
            closePicker();
          }
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
