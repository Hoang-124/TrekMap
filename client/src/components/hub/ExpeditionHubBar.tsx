import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator.js';
import {
  IconArrowLeft,
  IconArrowRight,
  IconBackpack,
  IconCalendar,
  IconCompass,
  IconHiking,
  IconMountain,
  IconRadar,
  IconSatellite,
  IconShieldAlert,
} from '../common/SvgIcons.js';

export type ExpeditionHubId =
  | 'passport'
  | 'almanac'
  | 'planner'
  | 'toolkit'
  | 'directory'
  | 'training'
  | 'gear'
  | 'radar';

export interface ExpeditionHubBarProps {
  activeHub: ExpeditionHubId;
  onSelectHub: (hub: ExpeditionHubId) => void;
  onBackHome?: () => void;
}

interface HubNavItem {
  id: ExpeditionHubId;
  label: string;
  shortLabel: string;
  renderIcon: (color: string) => React.ReactNode;
}

const HUB_ITEMS: HubNavItem[] = [
  {
    id: 'passport',
    label: 'Hộ Chiếu Đỉnh Cao',
    shortLabel: 'Hộ Chiếu',
    renderIcon: (color) => <IconMountain size={15} color={color} />,
  },
  {
    id: 'almanac',
    label: 'Lịch Mùa 12 Tháng',
    shortLabel: 'Lịch Mùa',
    renderIcon: (color) => <IconCalendar size={15} color={color} />,
  },
  {
    id: 'planner',
    label: 'Vẽ Cung GPX',
    shortLabel: 'Vẽ GPX',
    renderIcon: (color) => <IconCompass size={15} color={color} />,
  },
  {
    id: 'toolkit',
    label: 'Công Cụ Sinh Tồn',
    shortLabel: 'Sinh Tồn',
    renderIcon: (color) => <IconSatellite size={15} color={color} />,
  },
  {
    id: 'directory',
    label: 'Kiểm Lâm & Chi Phí',
    shortLabel: 'Kiểm Lâm',
    renderIcon: (color) => <IconShieldAlert size={15} color={color} />,
  },
  {
    id: 'training',
    label: 'Giáo Án Thể Lực',
    shortLabel: 'Thể Lực',
    renderIcon: (color) => <IconHiking size={15} color={color} />,
  },
  {
    id: 'gear',
    label: 'Tủ Đồ & Tối Ưu Balo',
    shortLabel: 'Tủ Đồ',
    renderIcon: (color) => <IconBackpack size={15} color={color} />,
  },
  {
    id: 'radar',
    label: 'Radar An Toàn',
    shortLabel: 'Radar',
    renderIcon: (color) => <IconRadar size={15} color={color} />,
  },
];

export const ExpeditionHubBar: React.FC<ExpeditionHubBarProps> = ({
  activeHub,
  onSelectHub,
  onBackHome,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Partial<Record<ExpeditionHubId, HTMLButtonElement | null>>>({});
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: false });
  const { trackRef: hubTrackRef, indicatorStyle: hubIndicatorStyle } =
    useSlidingIndicator<ExpeditionHubId>(activeHub);

  const updateScrollEdges = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const canScrollLeft = el.scrollLeft > 4;
    const canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setScrollEdges((prev) =>
      prev.left === canScrollLeft && prev.right === canScrollRight
        ? prev
        : { left: canScrollLeft, right: canScrollRight }
    );
  }, []);

  // Center active tab into view on mobile 375px and sync scroll affordance edges
  useEffect(() => {
    const activeEl = tabRefs.current[activeHub];
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
    const rafId = window.requestAnimationFrame(updateScrollEdges);
    return () => window.cancelAnimationFrame(rafId);
  }, [activeHub, updateScrollEdges]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const rafId = window.requestAnimationFrame(updateScrollEdges);
    window.addEventListener('resize', updateScrollEdges, { passive: true });
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateScrollEdges);
      resizeObserver.observe(el);
    }
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateScrollEdges);
      resizeObserver?.disconnect();
    };
  }, [updateScrollEdges]);

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIdx: number) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') {
      nextIdx = (currentIdx + 1) % HUB_ITEMS.length;
    } else if (e.key === 'ArrowLeft') {
      nextIdx = (currentIdx - 1 + HUB_ITEMS.length) % HUB_ITEMS.length;
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = HUB_ITEMS.length - 1;
    }
    if (nextIdx === null) return;
    e.preventDefault();
    const target = HUB_ITEMS[nextIdx];
    onSelectHub(target.id);
    tabRefs.current[target.id]?.focus();
  };

  const scrollByStep = (direction: -1 | 1) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * 200, behavior: 'smooth' });
  };

  return (
    <nav
      aria-label="Điều hướng Trung tâm Thám hiểm LOST"
      style={{
        width: '100%',
        background: 'var(--color-bg-card)',
        borderBottom: '1px solid var(--color-border)',
        fontFamily: 'var(--font-family)',
        position: 'relative',
      }}
    >
      <div style={{ maxWidth: 1240, margin: '0 auto', position: 'relative' }}>
        {scrollEdges.left && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 36,
              background: 'linear-gradient(to right, var(--color-bg-card) 55%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              paddingLeft: 4,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            <button
              type="button"
              aria-label="Cuộn thanh công cụ sang trái"
              onClick={() => scrollByStep(-1)}
              style={{
                pointerEvents: 'auto',
                width: 24,
                height: 24,
                borderRadius: 4,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <IconArrowLeft size={12} />
            </button>
          </div>
        )}

        <div
          ref={scrollContainerRef}
          onScroll={updateScrollEdges}
          style={{
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          {onBackHome && (
            <button
              type="button"
              className="interactive-click"
              onClick={onBackHome}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 11px',
                borderRadius: 4,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-main)',
                color: 'var(--color-text-muted)',
                fontSize: '0.77rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                cursor: 'pointer',
                fontFamily: 'var(--font-family)',
              }}
            >
              <IconArrowLeft size={14} color="var(--color-text-muted)" />
              <span>Trang Chủ</span>
            </button>
          )}

          {onBackHome && (
            <span
              aria-hidden="true"
              style={{
                width: 1,
                height: 20,
                background: 'var(--color-border-strong)',
                flexShrink: 0,
                margin: '0 2px',
              }}
            />
          )}

          <div
            ref={hubTrackRef}
            role="tablist"
            aria-label="Các phân hệ LOST Field Atlas"
            className="lost-glider-track"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'nowrap',
            }}
          >
            <span
              aria-hidden="true"
              className="lost-glider-pill with-accent"
              style={hubIndicatorStyle}
            />
            {HUB_ITEMS.map((item, idx) => {
              const active = activeHub === item.id;
              const iconColor = active ? 'var(--color-primary)' : 'var(--color-text-muted)';

              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    tabRefs.current[item.id] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-glider-active={active ? 'true' : undefined}
                  tabIndex={active ? 0 : -1}
                  className="lost-glider-item"
                  onClick={() => onSelectHub(item.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '8px 12px',
                    borderRadius: 4,
                    border: '1px solid transparent',
                    background: 'transparent',
                    color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: active ? 700 : 600,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-family)',
                    transition: 'color 200ms ease, transform 180ms var(--ease-out-expo)',
                  }}
                >
                  {item.renderIcon(iconColor)}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {scrollEdges.right && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 36,
              background: 'linear-gradient(to left, var(--color-bg-card) 55%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: 4,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            <button
              type="button"
              aria-label="Cuộn thanh công cụ sang phải"
              onClick={() => scrollByStep(1)}
              style={{
                pointerEvents: 'auto',
                width: 24,
                height: 24,
                borderRadius: 4,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <IconArrowRight size={12} />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
