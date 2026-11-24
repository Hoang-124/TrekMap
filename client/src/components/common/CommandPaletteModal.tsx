import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Trail } from '../../types.js';
import {
  VIETNAM_RANGER_STATIONS,
  VIETNAM_SUMMIT_CHALLENGES,
  type RangerStationSeed,
} from '../../data/vietnamDirectory.js';
import { searchMatchVietnamese } from '../../utils/textUtils.js';
import { isTopmostFocusTrap, useFocusTrap } from '../../hooks/useFocusTrap.js';
import { scopedStorageKey } from '../../utils/storageScope.js';
import {
  IconSearch,
  IconX,
  IconMountain,
  IconCalendar,
  IconCompass,
  IconSatellite,
  IconHiking,
  IconShieldAlert,
  IconBackpack,
  IconRadar,
  IconRadio,
  IconPhoneCall,
  IconPhone,
  IconSparkles,
  IconClock,
  IconArrowRight,
  IconMapPin,
  IconHelpCircle,
} from './SvgIcons.js';

export interface CommandPaletteModalProps {
  isOpen: boolean;
  trails: Trail[];
  onClose: () => void;
  onSelectTrail: (trail: Trail) => void;
  onNavigateView: (view: string, trailId?: string) => void;
  onOpenAiWithPrompt: (prompt: string) => void;
  onOpenEmergency: () => void;
  onOpenLiveTracker?: () => void;
  onOpenShortcuts?: () => void;
}

type CategoryFilter = 'all' | 'trails' | 'hubs' | 'rangers';

interface PaletteHubEntry {
  id: string;
  view: string;
  title: string;
  subtitle: string;
  keywords: string;
  badge: string;
  accent: string;
  kind: 'hub' | 'live_tracker' | 'emergency' | 'shortcuts';
  icon: React.ReactNode;
}

interface PaletteRow {
  key: string;
  group: 'ai' | 'hubs' | 'trails' | 'rangers';
  title: string;
  subtitle: string;
  meta?: string;
  accent: string;
  badge?: string;
  icon: React.ReactNode;
  dialPhone?: string;
  onExecute: () => void;
}

const RECENT_STORAGE_BASE_KEY = 'lost_cmdk_recent_v1';
const MAX_RECENT = 5;

function getRecentStorageKey(): string {
  return scopedStorageKey(RECENT_STORAGE_BASE_KEY);
}

function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(getRecentStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function saveRecentSearch(term: string): string[] {
  const clean = term.trim();
  if (clean.length < 2) return loadRecentSearches();
  const prev = loadRecentSearches().filter((item) => item.toLowerCase() !== clean.toLowerCase());
  const next = [clean, ...prev].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(getRecentStorageKey(), JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

function extractPrimaryDialPhone(phone?: string): string {
  if (!phone) return '112';
  const primary = String(phone).split('/')[0] || '';
  const digits = primary.replace(/[^0-9+]/g, '');
  return digits || '112';
}

function getDifficultyToken(level: number): string {
  if (level >= 4) return 'var(--color-error-text, var(--color-error))';
  if (level === 3) return 'var(--color-sun)';
  return 'var(--color-primary)';
}

const GROUP_LABELS: Record<PaletteRow['group'], string> = {
  ai: 'Trợ Lý Trí Tuệ Địa Hình',
  trails: 'Cung Đường Thực Địa DEM',
  hubs: 'Hệ Sinh Thái Công Cụ & Live GPS',
  rangers: 'Trạm Kiểm Lâm, VQG & Cứu Hộ 24/7',
};

function buildHubEntries(
  trailsCount: number,
  challengesCount: number,
  rangersCount: number
): PaletteHubEntry[] {
  return [
    {
      id: 'hub-passport',
      view: 'passport',
      title: `Hộ Chiếu Đỉnh & ${challengesCount} Thử Thách`,
      subtitle: 'Sưu tầm tem đỉnh 3.000m, bảng xếp hạng & chứng nhận GPS',
      keywords: 'ho chieu dinh passport thu thach 3000m huy hieu bang xep hang',
      badge: 'Hub',
      accent: 'var(--color-sun)',
      kind: 'hub',
      icon: <IconMountain size={16} />,
    },
    {
      id: 'hub-almanac',
      view: 'almanac',
      title: 'Lịch Mùa 12 Tháng & Săn Mây',
      subtitle: `Bản đồ nhiệt khí hậu ${trailsCount} tuyến, mùa đỗ quyên & tránh bão lũ`,
      keywords: 'lich mua almanac san may mua kho bao lu do quyen 12 thang',
      badge: 'Hub',
      accent: 'var(--color-sky)',
      kind: 'hub',
      icon: <IconCalendar size={16} />,
    },
    {
      id: 'hub-planner',
      view: 'planner',
      title: 'Thiết Kế GPX & Phân Tích Độ Dốc',
      subtitle: 'Vẽ tuyến trên bản đồ, lấy cao độ DEM thật, tính Naismith/Tobler',
      keywords: 'thiet ke gpx route planner ban do cao do dem do doc naismith tobler',
      badge: 'Hub',
      accent: 'var(--color-primary)',
      kind: 'hub',
      icon: <IconCompass size={16} />,
    },
    {
      id: 'hub-toolkit',
      view: 'toolkit',
      title: 'Công Cụ Sinh Tồn Offline & La Bàn',
      subtitle: 'La bàn GPS, giờ mặt trời NOAA, nước/calo, còi SOS & Học viện sơ cứu',
      keywords: 'cong cu sinh ton toolkit la ban gps mat troi noaa sos coi so cuu offline',
      badge: 'Offline',
      accent: 'var(--color-earth)',
      kind: 'hub',
      icon: <IconSatellite size={16} />,
    },
    {
      id: 'hub-training',
      view: 'training',
      title: 'Giáo Án Thể Lực Leo Núi',
      subtitle: 'Lộ trình 4–8 tuần tăng tiến & điểm sẵn sàng cho từng đỉnh',
      keywords: 'giao an the luc training luyen tap suc ben cao do leo nui',
      badge: 'Hub',
      accent: 'var(--color-primary)',
      kind: 'hub',
      icon: <IconHiking size={16} />,
    },
    {
      id: 'hub-directory',
      view: 'directory',
      title: 'Kiểm Lâm, Porter & Máy Tính Chi Phí',
      subtitle: `${rangersCount} trạm VQG, trung tâm HDV chính thức & bảng dự trù VNĐ`,
      keywords: 'kiem lam vqg porter hdv guide chi phi du toan vnd giay phep directory',
      badge: 'Hub',
      accent: 'var(--color-stream)',
      kind: 'hub',
      icon: <IconShieldAlert size={16} />,
    },
    {
      id: 'hub-gear',
      view: 'gear',
      title: 'Tủ Đồ & Tối Ưu Trọng Lượng Balo',
      subtitle: 'Phân tích Base Weight, tỉ lệ cân nặng cơ thể & đồng bộ đám mây',
      keywords: 'tu do toi uu balo gear pack base weight trong luong lighterpack checklist',
      badge: 'Hub',
      accent: 'var(--color-sun)',
      kind: 'hub',
      icon: <IconBackpack size={16} />,
    },
    {
      id: 'hub-radar',
      view: 'radar',
      title: 'Radar An Toàn Thực Địa Toàn Quốc',
      subtitle: 'Cảnh báo sạt lở, lũ suối & báo cáo mặt đường 7 ngày qua',
      keywords: 'radar an toan canh bao su co sat lo lu suoi tinh trang duong safety',
      badge: 'Live',
      accent: 'var(--color-error)',
      kind: 'hub',
      icon: <IconRadar size={16} />,
    },
    {
      id: 'action-live-tracker',
      view: 'live-tracker',
      title: 'Chế Độ Leo Núi Trực Tiếp (Live GPS)',
      subtitle: 'Đo tốc độ, khoảng cách mốc kế tiếp & cảnh báo lệch cung >100m',
      keywords: 'leo nui truc tiep live gps tracker off-trail dinh vi ghi tracklog',
      badge: 'GPS',
      accent: 'var(--color-primary)',
      kind: 'live_tracker',
      icon: <IconRadio size={16} />,
    },
    {
      id: 'action-emergency',
      view: 'emergency',
      title: 'Danh Bạ Cứu Hộ 24/7 & Hotline 112 / 114',
      subtitle: 'Gọi nhanh tổng đài quốc gia, VQG & trạm kiểm lâm toàn quốc',
      keywords: 'cuu ho khan cap sos 112 114 115 113 danh ba hotline emergency',
      badge: '24/7',
      accent: 'var(--color-error)',
      kind: 'emergency',
      icon: <IconPhoneCall size={16} />,
    },
    {
      id: 'action-shortcuts',
      view: 'shortcuts',
      title: 'Bảng phím tắt (?)',
      subtitle: 'Xem nhanh toàn bộ phím tắt Ctrl+K, /, ?, Alt+A, Alt+T & Esc',
      keywords: 'bang phim tat keyboard shortcuts hotkeys tro giup help ? alt+a alt+t ctrl+k',
      badge: '?',
      accent: 'var(--color-sky)',
      kind: 'shortcuts',
      icon: <IconHelpCircle size={16} />,
    },
  ];
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  trails,
  onClose,
  onSelectTrail,
  onNavigateView,
  onOpenAiWithPrompt,
  onOpenEmergency,
  onOpenLiveTracker,
  onOpenShortcuts,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [activeIdx, setActiveIdx] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  useFocusTrap(isOpen, dialogRef, { initialFocusRef: inputRef });

  // Reset query & refresh recent searches whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    const rafId = window.requestAnimationFrame(() => {
      setQuery('');
      setCategory('all');
      setActiveIdx(0);
      setRecentSearches(loadRecentSearches());
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [isOpen]);

  const recordSearchIfNeeded = useCallback((term: string) => {
    if (term.trim().length >= 2) {
      setRecentSearches(saveRecentSearch(term));
    }
  }, []);

  const clearRecentSearches = () => {
    try {
      localStorage.removeItem(getRecentStorageKey());
    } catch {
      // ignore
    }
    setRecentSearches([]);
  };

  const trimmedQuery = query.trim();

  const hubEntries = useMemo(
    () =>
      buildHubEntries(
        trails.length,
        VIETNAM_SUMMIT_CHALLENGES.length,
        VIETNAM_RANGER_STATIONS.length
      ),
    [trails.length]
  );

  const rows = useMemo<PaletteRow[]>(() => {
    const list: PaletteRow[] = [];

    // 1. Dynamic LOST AI row whenever query >= 3 characters
    if (trimmedQuery.length >= 3) {
      list.push({
        key: 'ai-dynamic-prompt',
        group: 'ai',
        title: `Hỏi LOST AI: "${trimmedQuery}"`,
        subtitle: 'Phân tích Go/No-Go, so sánh đỉnh, sơ cứu thực địa hoặc lập lịch trình bằng AI',
        badge: 'LOST AI',
        accent: 'var(--color-primary)',
        icon: <IconSparkles size={16} color="var(--color-primary)" />,
        onExecute: () => {
          recordSearchIfNeeded(trimmedQuery);
          onClose();
          onOpenAiWithPrompt(trimmedQuery);
        },
      });
    }

    // 2. Trails (all real DEM trails — zero silent truncation on Trails tab)
    if (category === 'all' || category === 'trails') {
      const matchedTrails = (Array.isArray(trails) ? trails : []).filter((t) => {
        if (!trimmedQuery) return true;
        const haystack = [
          t.name,
          ...(t.altNames || []),
          t.province,
          t.district,
          t.region,
          `${t.maxAltitudeM}m`,
        ].join(' ');
        return searchMatchVietnamese(haystack, trimmedQuery);
      });

      const limit = trimmedQuery ? 15 : category === 'trails' ? matchedTrails.length : 6;
      matchedTrails.slice(0, limit).forEach((t) => {
        list.push({
          key: `trail-${t.id}`,
          group: 'trails',
          title: t.name,
          subtitle: `${t.province} · ${t.region} · ${t.distanceKm} km`,
          meta: `${t.maxAltitudeM.toLocaleString('vi-VN')}m`,
          badge: `Cấp ${t.difficultyLevel}/5`,
          accent: getDifficultyToken(t.difficultyLevel),
          icon: <IconMapPin size={15} color={getDifficultyToken(t.difficultyLevel)} />,
          onExecute: () => {
            recordSearchIfNeeded(trimmedQuery || t.name);
            onClose();
            onSelectTrail(t);
          },
        });
      });
    }

    // 3. All 8 Flagship Hubs + Live GPS Tracker + Emergency 24/7
    if (category === 'all' || category === 'hubs') {
      const matchedHubs = hubEntries.filter((hub) => {
        if (!trimmedQuery) return true;
        return searchMatchVietnamese(`${hub.title} ${hub.subtitle} ${hub.keywords}`, trimmedQuery);
      });

      matchedHubs.forEach((hub) => {
        list.push({
          key: hub.id,
          group: 'hubs',
          title: hub.title,
          subtitle: hub.subtitle,
          badge: hub.badge,
          accent: hub.accent,
          icon: <span style={{ color: hub.accent, display: 'inline-flex' }}>{hub.icon}</span>,
          onExecute: () => {
            recordSearchIfNeeded(trimmedQuery);
            onClose();
            if (hub.kind === 'emergency') {
              onOpenEmergency();
            } else if (hub.kind === 'shortcuts') {
              onOpenShortcuts?.();
            } else if (hub.kind === 'live_tracker') {
              if (onOpenLiveTracker) onOpenLiveTracker();
              else onNavigateView('toolkit');
            } else {
              onNavigateView(hub.view);
            }
          },
        });
      });
    }

    // 4. All Verified Ranger / National Park Stations (dynamic from VIETNAM_RANGER_STATIONS)
    if (category === 'all' || category === 'rangers') {
      const matchedRangers = VIETNAM_RANGER_STATIONS.filter((st: RangerStationSeed) => {
        if (!trimmedQuery) return true;
        const haystack = [
          st.name,
          st.province,
          st.district,
          st.region,
          st.hotlinePhone,
          st.emergencyPhone,
          ...(st.coveredTrailSlugs || []),
        ].join(' ');
        return searchMatchVietnamese(haystack, trimmedQuery);
      });

      const rangerLimit = trimmedQuery ? 12 : category === 'rangers' ? matchedRangers.length : 5;
      matchedRangers.slice(0, rangerLimit).forEach((st) => {
        const primaryPhone = extractPrimaryDialPhone(st.emergencyPhone || st.hotlinePhone);
        list.push({
          key: `ranger-${st.slug}`,
          group: 'rangers',
          title: st.name,
          subtitle: `${st.province} · ${st.officeHours}${st.permitRequired ? ' · Cần giấy phép' : ''}`,
          meta: st.hotlinePhone,
          badge: st.authorityType === 'rescue_center' ? '24/7' : 'VQG / KL',
          accent:
            st.authorityType === 'rescue_center'
              ? 'var(--color-error-text, var(--color-error))'
              : 'var(--color-stream)',
          icon: (
            <IconPhone
              size={15}
              color={
                st.authorityType === 'rescue_center'
                  ? 'var(--color-error-text, var(--color-error))'
                  : 'var(--color-stream)'
              }
            />
          ),
          dialPhone: primaryPhone,
          onExecute: () => {
            recordSearchIfNeeded(trimmedQuery || st.name);
            onClose();
            onNavigateView(`/directory?tab=rangers&q=${encodeURIComponent(st.name)}`);
          },
        });
      });
    }

    return list;
  }, [
    trimmedQuery,
    category,
    trails,
    hubEntries,
    recordSearchIfNeeded,
    onClose,
    onOpenAiWithPrompt,
    onSelectTrail,
    onOpenEmergency,
    onOpenLiveTracker,
    onOpenShortcuts,
    onNavigateView,
  ]);

  const clampedActiveIdx = rows.length > 0 ? Math.min(activeIdx, rows.length - 1) : 0;
  const activeRow = rows[clampedActiveIdx];
  const groupedRows = useMemo(() => {
    const groups: Array<{
      group: PaletteRow['group'];
      label: string;
      items: Array<{ row: PaletteRow; index: number }>;
    }> = [];
    rows.forEach((row, index) => {
      const last = groups[groups.length - 1];
      if (last && last.group === row.group) {
        last.items.push({ row, index });
      } else {
        groups.push({
          group: row.group,
          label: GROUP_LABELS[row.group],
          items: [{ row, index }],
        });
      }
    });
    return groups;
  }, [rows]);

  const rowsRef = useRef(rows);
  const activeIdxRef = useRef(clampedActiveIdx);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    rowsRef.current = rows;
    activeIdxRef.current = clampedActiveIdx;
    onCloseRef.current = onClose;
  }, [rows, clampedActiveIdx, onClose]);

  // Keep keyboard-selected item visible inside scrollable result body
  useEffect(() => {
    if (!isOpen) return;
    const node = itemRefs.current[clampedActiveIdx];
    if (node) {
      node.scrollIntoView({ block: 'nearest' });
    }
  }, [clampedActiveIdx, isOpen]);

  // Global keyboard handler while open (bound once per open session, ref-stabilized, LIFO guarded)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTopmostFocusTrap(dialogRef.current)) return;

      if (e.key === 'Escape') {
        if (e.isComposing) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }
      const currentRows = rowsRef.current;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentRows.length > 0) {
          setActiveIdx((prev) => (prev + 1) % currentRows.length);
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentRows.length > 0) {
          setActiveIdx((prev) => (prev - 1 + currentRows.length) % currentRows.length);
        }
        return;
      }
      if (e.key === 'Enter' && currentRows.length > 0) {
        if (e.isComposing) return;
        const activeEl = document.activeElement;
        if (
          activeEl &&
          activeEl !== inputRef.current &&
          (activeEl.tagName === 'BUTTON' || activeEl.tagName === 'A') &&
          activeEl.getAttribute('data-palette-row') !== 'true'
        ) {
          return;
        }
        e.preventDefault();
        const target = currentRows[activeIdxRef.current];
        if (target) target.onExecute();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="drawer-backdrop-in"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal, 3000)' as unknown as number,
        background: 'var(--overlay-bg)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'clamp(16px, 8vh, 88px) 16px 24px',
        fontFamily: 'var(--font-family)',
      }}
    >
      <div
        ref={dialogRef}
        className="modal-fade-in"
        role="dialog"
        aria-modal="true"
        aria-label="Tìm kiếm nhanh toàn hệ thống LOST"
        data-lost-modal="command-palette"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: 'min(78vh, 660px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          borderRadius: 6,
          boxShadow: 'var(--shadow-3d)',
          overflow: 'hidden',
          outline: 'none',
        }}
      >
        {/* Top Command Search Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg-main)',
          }}
        >
          <IconSearch size={18} color="var(--color-primary)" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={rows.length > 0}
            aria-controls={rows.length > 0 ? 'lost-cmdk-listbox' : undefined}
            aria-activedescendant={rows[clampedActiveIdx] ? `lost-cmdk-opt-${clampedActiveIdx}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            placeholder={`Tìm ${trails.length} cung đường, 8 Hub công cụ, ${VIETNAM_RANGER_STATIONS.length} Trạm Kiểm Lâm hoặc hỏi LOST AI...`}
            aria-label="Nhập từ khóa tìm kiếm nhanh"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--color-text-main)',
              fontSize: '0.94rem',
              fontWeight: 500,
              fontFamily: 'var(--font-family)',
              minWidth: 0,
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setActiveIdx(0);
                inputRef.current?.focus();
              }}
              aria-label="Xóa từ khóa"
              style={{
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '4px 6px',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <IconX size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng lệnh (Esc)"
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 4,
              color: 'var(--color-text-muted)',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              padding: '4px 8px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ESC
          </button>
        </div>

        {/* Scope Filter Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            padding: '10px 16px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {(
              [
                { id: 'all', label: 'Tất cả' },
                { id: 'trails', label: `Cung đường (${trails.length})` },
                { id: 'hubs', label: '8 Hub & GPS' },
                { id: 'rangers', label: `Kiểm lâm & VQG (${VIETNAM_RANGER_STATIONS.length})` },
              ] as const
            ).map((tab) => {
              const active = category === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setCategory(tab.id);
                    setActiveIdx(0);
                  }}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 4,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                    background: active
                      ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)'
                      : 'var(--color-bg-main)',
                    color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <span
            style={{
              fontSize: '0.72rem',
              color: 'var(--color-text-dim)',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
            }}
          >
            {rows.length} kết quả
          </span>
        </div>

        {/* Recent Searches Strip (when query empty) */}
        {!trimmedQuery && recentSearches.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
              padding: '9px 16px',
              borderBottom: '1px solid var(--color-border)',
              background: 'color-mix(in srgb, var(--color-surface-elevated) 55%, transparent)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-dim)',
                }}
              >
                <IconClock size={12} /> Gần đây:
              </span>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setQuery(term);
                    setActiveIdx(0);
                    inputRef.current?.focus();
                  }}
                  style={{
                    padding: '3px 9px',
                    borderRadius: 4,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-card)',
                    color: 'var(--color-text-main)',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {term}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={clearRecentSearches}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-dim)',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              Xóa lịch sử
            </button>
          </div>
        )}

        {/* Scrollable Result List */}
        {rows.length === 0 ? (
          <div
            role="status"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '36px 20px',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              fontSize: '0.86rem',
            }}
          >
            Không tìm thấy kết quả khớp với &ldquo;{trimmedQuery}&rdquo;. Thử gõ tên đỉnh (Fansipan, Pu Si Lung, Tà Xùa) hoặc ít nhất 3 ký tự để hỏi LOST AI.
          </div>
        ) : (
          <div
            id="lost-cmdk-listbox"
            role="listbox"
            aria-label="Kết quả tìm kiếm nhanh LOST"
            style={{ flex: 1, overflowY: 'auto', padding: '8px 10px 12px' }}
          >
            {groupedRows.map((section, sectionIdx) => (
              <div
                key={section.group}
                role="group"
                aria-labelledby={`lost-cmdk-group-${section.group}`}
              >
                <div
                  id={`lost-cmdk-group-${section.group}`}
                  role="presentation"
                  style={{
                    padding: sectionIdx === 0 ? '4px 8px 6px' : '12px 8px 6px',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-dim)',
                  }}
                >
                  {section.label}
                </div>
                {section.items.map(({ row, index: idx }) => {
                  const isSelected = idx === clampedActiveIdx;
                  return (
                    <button
                      key={row.key}
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                      id={`lost-cmdk-opt-${idx}`}
                      role="option"
                      aria-selected={isSelected}
                      data-palette-row="true"
                      type="button"
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={row.onExecute}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '9px 10px',
                        borderRadius: 4,
                        background: isSelected
                          ? 'color-mix(in srgb, var(--color-primary) 13%, var(--color-surface-elevated))'
                          : 'transparent',
                        border: isSelected
                          ? '1px solid color-mix(in srgb, var(--color-primary) 42%, transparent)'
                          : '1px solid transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'var(--font-family)',
                        transition: 'background 0.12s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 4,
                            background: `color-mix(in srgb, ${row.accent} 13%, var(--color-bg-main))`,
                            border: `1px solid color-mix(in srgb, ${row.accent} 30%, transparent)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {row.icon}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '0.86rem',
                              fontWeight: 700,
                              color: 'var(--color-text-main)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {row.title}
                          </div>
                          <div
                            style={{
                              fontSize: '0.74rem',
                              color: 'var(--color-text-muted)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              marginTop: 2,
                            }}
                          >
                            {row.subtitle}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexShrink: 0,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {row.meta && (
                          <span
                            style={{
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              color: 'var(--color-text-main)',
                            }}
                          >
                            {row.meta}
                          </span>
                        )}
                        {row.badge && (
                          <span
                            style={{
                              padding: '2px 7px',
                              borderRadius: 4,
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              color:
                                row.accent === 'var(--color-error)'
                                  ? 'var(--color-error-text)'
                                  : row.accent,
                              background: `color-mix(in srgb, ${row.accent} 12%, transparent)`,
                              border: `1px solid color-mix(in srgb, ${row.accent} 30%, transparent)`,
                            }}
                          >
                            {row.badge}
                          </span>
                        )}
                        <IconArrowRight
                          size={14}
                          color={isSelected ? 'var(--color-primary)' : 'var(--color-text-dim)'}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Keyboard Shortcut Legend Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            padding: '10px 16px',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-bg-main)',
            fontSize: '0.72rem',
            color: 'var(--color-text-dim)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span>
              <strong style={{ color: 'var(--color-text-muted)' }}>↑↓</strong> Di chuyển
            </span>
            <span>
              <strong style={{ color: 'var(--color-text-muted)' }}>Enter</strong> Mở mục chọn
            </span>
            <span>
              <strong style={{ color: 'var(--color-text-muted)' }}>Esc</strong> Đóng
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {activeRow?.dialPhone && (
              <a
                href={`tel:${activeRow.dialPhone}`}
                title={`Gọi trực tiếp ${activeRow.dialPhone}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 9px',
                  borderRadius: 4,
                  background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)',
                  color: 'var(--color-primary)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <IconPhoneCall size={12} color="var(--color-primary)" />
                <span>Gọi {activeRow.dialPhone}</span>
              </a>
            )}
            <span style={{ fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
              LOST FIELD ATLAS · CTRL+K
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
