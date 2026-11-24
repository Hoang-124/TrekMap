import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Trail } from '../../types.js';
import { mockTrails } from '../../data/seedData.js';
import { VIETNAM_RANGER_STATIONS } from '../../data/vietnamDirectory.js';
import { fetchPlatformStatsSummary, type PlatformStatsSummary } from '../../services/api.js';
import { IconSearch, IconX, IconCheck, IconArrowRight } from '../common/SvgIcons.js';
import { isLitePerfMode } from '../../utils/perfTier.js';

const INITIAL_CATALOG_BASELINE = {
  totalTrails: mockTrails.length,
  totalKm: Math.round(mockTrails.reduce((acc, t) => acc + (t?.distanceKm || 0), 0)),
  maxAltitude: mockTrails.length > 0 ? Math.max(...mockTrails.map((t) => t?.maxAltitudeM || 0)) : 3143,
};

interface HeroExpeditionSectionProps {
  trails: Trail[];
  selectedRegion: string;
  onSelectRegion: (region: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  campsiteOnly?: boolean;
  onToggleCampsite?: () => void;
  onOpenAdvancedFilter: () => void;
  onScrollToMap: () => void;
  onScrollToAllTrails?: () => void;
  onExploreClick: () => void;
  onSelectTrail?: (trail: Trail) => void;
  onOpenEmergencyContacts?: () => void;
  activeFilterCount?: number;
}

interface HeroPeakShowcase {
  key: string;
  id: string;
  code: string;
  name: string;
  subtitle: string;
  province: string;
  elevationM: number;
  distanceKm: number;
  coords: string;
  image: string;
  // All silhouettePaths use exactly 12 vertices (M + 11 L + Z) for silky-smooth SVG path morphing
  silhouettePath: string;
}

const SHOWCASE_PEAKS: HeroPeakShowcase[] = [
  {
    key: 'fansipan',
    id: 'trail-fansipan',
    code: 'VN-01',
    name: 'Fansipan',
    subtitle: 'Nóc nhà Đông Dương · Trạm Tôn',
    province: 'Lào Cai',
    elevationM: 3143,
    distanceKm: 22.4,
    coords: '22°18′12″N  103°46′30″E',
    image:
      'https://res.cloudinary.com/dsxbuk4pe/image/upload/f_auto,q_auto,w_1800/v1785329097/trekmap/trails/trail_cover_trail-fansipan.jpg',
    silhouettePath: 'M0,120 L110,98 L210,72 L340,86 L460,44 L580,58 L710,16 L840,52 L960,76 L1120,96 L1200,120 Z',
  },
  {
    key: 'taxua',
    id: 'trail-taxua',
    code: 'VN-02',
    name: 'Tà Xùa',
    subtitle: 'Sống lưng Khủng Long · Háng Đồng',
    province: 'Sơn La',
    elevationM: 2865,
    distanceKm: 18.5,
    coords: '21°24′30″N  104°19′30″E',
    image:
      'https://res.cloudinary.com/dsxbuk4pe/image/upload/f_auto,q_auto,w_1800/v1785329099/trekmap/trails/trail_cover_trail-taxua.jpg',
    silhouettePath: 'M0,120 L120,86 L240,42 L370,64 L500,26 L640,54 L760,32 L880,68 L1000,82 L1110,96 L1200,120 Z',
  },
  {
    key: 'kyquansan',
    id: 'trail-kyquansan',
    code: 'VN-03',
    name: 'Kỳ Quan San',
    subtitle: 'Bạch Mộc Lương Tử · Núi Muối',
    province: 'Lai Châu — Lào Cai',
    elevationM: 3046,
    distanceKm: 30.0,
    coords: '22°30′25″N  103°35′15″E',
    image:
      'https://res.cloudinary.com/dsxbuk4pe/image/upload/f_auto,q_auto,w_1800/v1785329101/trekmap/trails/trail_cover_trail-kyquansan.jpg',
    silhouettePath: 'M0,120 L95,100 L220,66 L360,78 L490,36 L640,48 L770,18 L900,56 L1010,74 L1110,92 L1200,120 Z',
  },
  {
    key: 'laothan',
    id: 'trail-laothan',
    code: 'VN-04',
    name: 'Lảo Thẩn',
    subtitle: 'Biển mây Y Tý · Bát Xát',
    province: 'Lào Cai',
    elevationM: 2860,
    distanceKm: 16.0,
    coords: '22°36′37″N  103°41′11″E',
    image:
      'https://res.cloudinary.com/dsxbuk4pe/image/upload/f_auto,q_auto,w_1800/v1785329100/trekmap/trails/trail_cover_trail-laothan.jpg',
    silhouettePath: 'M0,120 L130,96 L260,74 L390,62 L520,44 L630,24 L760,44 L890,66 L1000,84 L1110,100 L1200,120 Z',
  },
  {
    key: 'tanang',
    id: 'trail-tanangphandung',
    code: 'VN-05',
    name: 'Tà Năng — Phan Dũng',
    subtitle: 'Đồi cỏ cháy xuyên 3 tỉnh Nam Trung Bộ',
    province: 'Lâm Đồng — Bình Thuận',
    elevationM: 1100,
    distanceKm: 55.0,
    coords: '11°33′32″N  108°28′41″E',
    image:
      'https://res.cloudinary.com/dsxbuk4pe/image/upload/f_auto,q_auto,w_1800/v1785329106/trekmap/trails/trail_cover_trail-tanangphandung.jpg',
    silhouettePath: 'M0,120 L120,82 L250,62 L380,72 L510,56 L640,48 L770,64 L900,76 L1020,88 L1120,104 L1200,120 Z',
  },
];

const AUTO_STEP_MS = 4000;

export const HeroExpeditionSection: React.FC<HeroExpeditionSectionProps> = React.memo(({
  trails,
  selectedRegion,
  onSelectRegion,
  searchQuery,
  onSearchChange,
  campsiteOnly = false,
  onToggleCampsite,
  onOpenAdvancedFilter,
  onScrollToMap,
  onScrollToAllTrails,
  onExploreClick,
  onSelectTrail,
  onOpenEmergencyContacts,
  activeFilterCount = 0,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [fadingOutIndex, setFadingOutIndex] = useState<number | null>(null);
  const [loadedSlides, setLoadedSlides] = useState<Set<number>>(() => new Set([0, 1]));
  const [isPeakListPaused, setIsPeakListPaused] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isHeroVisible, setIsHeroVisible] = useState(true);
  const [isTabVisible, setIsTabVisible] = useState(
    () => (typeof document === 'undefined' ? true : !document.hidden)
  );
  const [isCloudChipActive, setIsCloudChipActive] = useState(false);
  const [liveSummary, setLiveSummary] = useState<PlatformStatsSummary | null>(null);
  const [gliderRect, setGliderRect] = useState<{ top: number; height: number; ready: boolean }>({
    top: 0,
    height: 54,
    ready: false,
  });
  const gliderRectRef = useRef<{ top: number; height: number; ready: boolean }>({
    top: 0,
    height: 54,
    ready: false,
  });
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const peakBtnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const peakStageRef = useRef<HTMLDivElement | null>(null);
  const savedQueryBeforeCloudRef = useRef<string>('');
  const blurTimeoutRef = useRef<number | null>(null);
  const fadeOutTimerRef = useRef<number | null>(null);
  const catalogBaselineRef = useRef<{ totalTrails: number; totalKm: number; maxAltitude: number }>({
    ...INITIAL_CATALOG_BASELINE,
  });

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
      if (fadeOutTimerRef.current !== null) {
        window.clearTimeout(fadeOutTimerRef.current);
      }
    };
  }, []);

  const scheduleFadeOutClear = useCallback((prevIdx: number) => {
    setFadingOutIndex(prevIdx);
    if (fadeOutTimerRef.current !== null) {
      window.clearTimeout(fadeOutTimerRef.current);
    }
    // Keep previous slide visible only for the 900ms CSS dissolve, then hide so GPU stops painting it
    fadeOutTimerRef.current = window.setTimeout(() => {
      fadeOutTimerRef.current = null;
      setFadingOutIndex(null);
    }, 960);
  }, []);

  // Pause Hero auto-scene transitions when scrolled off-screen or browser tab is hidden (saves CPU/GPU on weak devices)
  useEffect(() => {
    const handleVisibility = () => {
      setIsTabVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const sectionEl = heroSectionRef.current;
    let observer: IntersectionObserver | null = null;
    if (sectionEl && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries[0]?.isIntersecting ?? true;
          setIsHeroVisible((prev) => (prev === visible ? prev : visible));
        },
        { threshold: 0.05 }
      );
      observer.observe(sectionEl);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      observer?.disconnect();
    };
  }, []);

  // Measure active peak row in a single batched rAF with debounced resize & numeric equality guard
  useLayoutEffect(() => {
    let rafId = 0;
    let resizeDebounceId = 0;

    const syncGlider = () => {
      rafId = 0;
      const btn = peakBtnRefs.current[activeIndex];
      if (!btn) return;
      const nextTop = Math.round(btn.offsetTop);
      const nextHeight = Math.round(btn.offsetHeight);
      const prev = gliderRectRef.current;
      if (prev.ready && prev.top === nextTop && prev.height === nextHeight) {
        return;
      }
      const next = { top: nextTop, height: nextHeight, ready: true };
      gliderRectRef.current = next;
      setGliderRect(next);
    };

    const scheduleSync = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(syncGlider);
    };

    const scheduleDebouncedSync = () => {
      if (resizeDebounceId) window.clearTimeout(resizeDebounceId);
      resizeDebounceId = window.setTimeout(() => {
        resizeDebounceId = 0;
        scheduleSync();
      }, 64);
    };

    scheduleSync();

    const stageEl = peakStageRef.current;
    let observer: ResizeObserver | null = null;
    if (stageEl && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(scheduleDebouncedSync);
      observer.observe(stageEl);
    }
    window.addEventListener('resize', scheduleDebouncedSync, { passive: true });
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      if (resizeDebounceId) window.clearTimeout(resizeDebounceId);
      observer?.disconnect();
      window.removeEventListener('resize', scheduleDebouncedSync);
    };
  }, [activeIndex]);

  // Continuous cinematic auto-transition across the 5 showcase peaks (pauses when hovered, offscreen, or hidden tab)
  useEffect(() => {
    if (isPeakListPaused || isSearchFocused || !isHeroVisible || !isTabVisible) return;

    const nextIdx = (activeIndex + 1) % SHOWCASE_PEAKS.length;
    const preloadIdx = (activeIndex + 2) % SHOWCASE_PEAKS.length;

    const timerId = window.setTimeout(() => {
      setLoadedSlides((prev) => {
        if (prev.has(nextIdx) && prev.has(preloadIdx)) return prev;
        const next = new Set(prev);
        next.add(nextIdx);
        next.add(preloadIdx);
        return next;
      });
      scheduleFadeOutClear(activeIndex);
      setActiveIndex(nextIdx);
    }, AUTO_STEP_MS);

    return () => window.clearTimeout(timerId);
  }, [activeIndex, isPeakListPaused, isSearchFocused, isHeroVisible, isTabVisible, scheduleFadeOutClear]);

  // Fetch live platform telemetry once on mount (instant fallback to trails prop prevents layout shift)
  useEffect(() => {
    let cancelled = false;
    fetchPlatformStatsSummary().then((summary) => {
      if (!cancelled && summary && summary.totalTrails > 0) {
        setLiveSummary(summary);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectPeakSlide = useCallback(
    (idx: number) => {
      if (idx === activeIndex) return;
      const preloadNext = (idx + 1) % SHOWCASE_PEAKS.length;
      scheduleFadeOutClear(activeIndex);
      setActiveIndex(idx);
      setLoadedSlides((prev) => {
        if (prev.has(idx) && prev.has(preloadNext)) return prev;
        const next = new Set(prev);
        next.add(idx);
        next.add(preloadNext);
        return next;
      });
    },
    [activeIndex, scheduleFadeOutClear]
  );

  const activePeak = SHOWCASE_PEAKS[activeIndex] || SHOWCASE_PEAKS[0];

  // O(1) precomputed peak -> Trail lookup instead of running 6+ linear scans per keystroke
  const peakTrailMap = useMemo(() => {
    const primaryList = Array.isArray(trails) && trails.length > 0 ? trails : mockTrails;
    const findIn = (pool: Trail[], peak: HeroPeakShowcase) => {
      const byId = pool.find((t) => t.id === peak.id);
      if (byId) return byId;
      const clean = peak.name.split('—')[0].trim().toLowerCase();
      return (
        pool.find(
          (t) =>
            t.name.toLowerCase().includes(clean) ||
            (t.altNames && t.altNames.some((a) => a.toLowerCase().includes(clean)))
        ) || null
      );
    };
    const map = new Map<string, Trail | null>();
    for (const peak of SHOWCASE_PEAKS) {
      map.set(peak.key, findIn(primaryList, peak) || findIn(mockTrails, peak));
    }
    return map;
  }, [trails]);

  const activePeakMatched = peakTrailMap.get(activePeak.key) || null;
  const activePeakElevationM = activePeakMatched?.maxAltitudeM || activePeak.elevationM;

  const handleOpenActivePeak = useCallback(() => {
    const matched = peakTrailMap.get(activePeak.key) || null;
    if (matched && onSelectTrail) {
      onSelectTrail(matched);
    } else {
      onSearchChange(activePeak.name.split('—')[0].trim());
      onScrollToMap();
    }
  }, [peakTrailMap, activePeak, onSelectTrail, onSearchChange, onScrollToMap]);

  const searchAutocompleteMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!isSearchFocused || !q) return [];
    const list = Array.isArray(trails) ? trails : [];
    return list
      .filter(
        (t) =>
          (t?.name || '').toLowerCase().includes(q) ||
          (t?.province || '').toLowerCase().includes(q) ||
          (t?.district || '').toLowerCase().includes(q) ||
          (t?.region || '').toLowerCase().includes(q)
      )
      .slice(0, 4);
  }, [isSearchFocused, searchQuery, trails]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const list = Array.isArray(trails) ? trails : [];
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const directMatch = list.find(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            (t.altNames && t.altNames.some((a) => a.toLowerCase().includes(q)))
        );
        if (directMatch && onSelectTrail) onSelectTrail(directMatch);
        else onScrollToMap();
      } else {
        onScrollToMap();
      }
    }
  };

  // Preserve unfiltered catalog baseline & blend authoritative live platform stats (zero layout shift)
  const stats = useMemo(() => {
    const list = Array.isArray(trails) ? trails : [];
    const curTrails = list.length;
    const curKm = Math.round(list.reduce((acc, t) => acc + (t?.distanceKm || 0), 0));
    const curMaxAlt = list.length > 0 ? Math.max(...list.map((t) => t?.maxAltitudeM || 0)) : 3143;

    if (curTrails >= catalogBaselineRef.current.totalTrails) {
      catalogBaselineRef.current = {
        totalTrails: curTrails,
        totalKm: Math.max(curKm, catalogBaselineRef.current.totalKm),
        maxAltitude: Math.max(curMaxAlt, catalogBaselineRef.current.maxAltitude),
      };
    }

    const baseTrails = Math.max(curTrails, catalogBaselineRef.current.totalTrails);
    const baseKm = Math.max(curKm, catalogBaselineRef.current.totalKm);
    const baseMaxAlt = catalogBaselineRef.current.maxAltitude;

    return {
      visibleTrails: curTrails,
      totalTrails: liveSummary?.totalTrails ? Math.max(liveSummary.totalTrails, baseTrails) : baseTrails,
      totalKm: liveSummary?.totalKm ? Math.round(Math.max(liveSummary.totalKm, baseKm)) : baseKm,
      maxAltitude: liveSummary?.highestPeakM ? Math.max(liveSummary.highestPeakM, baseMaxAlt) : baseMaxAlt,
      totalRangers: Math.max(liveSummary?.totalRangers || 0, VIETNAM_RANGER_STATIONS.length),
      verifiedCheckins: liveSummary?.verifiedCheckins || 0,
      totalCheckins: liveSummary?.totalCheckins || 0,
    };
  }, [trails, liveSummary]);

  const handleToggleCloudQuickChip = () => {
    if (isCloudChipActive) {
      setIsCloudChipActive(false);
      // Restore whatever the user had typed before clicking "Săn mây"
      onSearchChange(savedQueryBeforeCloudRef.current);
      savedQueryBeforeCloudRef.current = '';
    } else {
      savedQueryBeforeCloudRef.current = searchQuery;
      setIsCloudChipActive(true);
      onSearchChange('mây');
    }
  };

  const isCloudVisualActive = isCloudChipActive || searchQuery.toLowerCase().includes('mây');

  const litePerf = isLitePerfMode();

  return (
    <section
      ref={heroSectionRef}
      style={{
        position: 'relative',
        minHeight: 'min(88vh, 790px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        backgroundColor: 'var(--color-bg-main)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Crossfading Full-Bleed Authentic Vietnamese Mountain Photography (Only active + fading slide paint) */}
      {SHOWCASE_PEAKS.map((peak, idx) => {
        const shouldMountImage = loadedSlides.has(idx);
        if (!shouldMountImage) return null;
        const isVisibleSlide = idx === activeIndex || idx === fadingOutIndex;
        const adaptiveHeroSrc = litePerf
          ? peak.image.replace('f_auto,q_auto,w_1800', 'f_auto,q_auto:eco,w_1200')
          : peak.image.replace('w_1800', 'w_1600');
        return (
          <img
            key={peak.key}
            src={adaptiveHeroSrc}
            alt={peak.name}
            loading={idx === 0 ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={idx === 0 ? 'high' : 'auto'}
            className={`hero-bg-slide${idx === activeIndex ? ' active' : ''}`}
            style={{ visibility: isVisibleSlide ? 'visible' : 'hidden' }}
          />
        );
      })}

      {/* Subtle Atmospheric Scene-Transition Sweep */}
      <div key={`veil-${activePeak.key}`} className="hero-scene-veil" aria-hidden="true" />

      {/* Subtle Swiss Topographic Contour SVG Lines */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 800"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.14,
          pointerEvents: 'none',
        }}
      >
        <g fill="none" stroke="var(--color-on-media)" strokeWidth="0.75">
          <path d="M-80,620 C220,510 380,680 680,540 C980,400 1160,580 1520,440" />
          <path d="M-80,560 C240,450 400,620 700,480 C1000,340 1180,520 1520,380" />
          <path d="M-80,500 C260,390 420,560 720,420 C1020,280 1200,460 1520,320" />
          <path d="M-80,440 C280,330 440,500 740,360 C1040,220 1220,400 1520,260" />
          <path d="M-80,380 C300,270 460,440 760,300 C1060,160 1240,340 1520,200" />
        </g>
      </svg>

      {/* Editorial Atmospheric Photographic Scrims (100% Design-Token Driven) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(104deg, var(--overlay-bg) 0%, color-mix(in srgb, var(--overlay-bg) 72%, transparent) 52%, color-mix(in srgb, var(--overlay-bg) 88%, transparent) 100%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--overlay-bg) 42%, transparent) 0%, transparent 35%, var(--overlay-bg) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Smoothly Morphing Mountain Silhouette Along Bottom Horizon (Equal 12-Vertex Paths) */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          height: 92,
          pointerEvents: 'none',
          zIndex: 1,
          opacity: 0.26,
        }}
      >
        <path
          d={activePeak.silhouettePath}
          fill="none"
          stroke="var(--color-sun)"
          strokeWidth="1.25"
          style={litePerf ? undefined : { transition: 'd 0.65s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>

      {/* Top Architectural Map Sheet Margin Header */}
      <div
        style={{
          position: 'relative',
          zIndex: 3,
          maxWidth: 1360,
          width: '100%',
          margin: '0 auto',
          padding: '24px 24px 0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          fontSize: '0.7rem',
          fontWeight: 600,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'color-mix(in srgb, var(--color-on-media) 65%, transparent)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--color-sun)' }}>+</span>
          <span>ATLAS ĐỊA HÌNH VIỆT NAM · EDITION 2026</span>
        </div>
        <div key={activePeak.key} className="hero-peak-drop-in" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <span>{activePeak.coords}</span>
          <span style={{ color: 'var(--color-primary)' }}>
            {activePeakElevationM.toLocaleString('vi-VN')} M ASL
          </span>
        </div>
      </div>

      {/* Center Stage: Monumental Asymmetric Editorial Composition */}
      <div
        style={{
          position: 'relative',
          zIndex: 3,
          maxWidth: 1360,
          width: '100%',
          margin: 'auto',
          padding: '32px 24px 28px 24px',
        }}
      >
        <div className="hero-editorial-grid">
          {/* LEFT COLUMN */}
          <div>
            <div
              key={`code-${activePeak.key}`}
              className="hero-peak-drop-in"
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--color-sun)',
                marginBottom: 16,
              }}
            >
              {activePeak.code} — {activePeak.province}
            </div>

            <h1
              className="font-editorial"
              style={{
                fontSize: 'clamp(2.85rem, 6.2vw, 5.15rem)',
                fontWeight: 500,
                color: 'var(--color-on-media)',
                margin: '0 0 18px 0',
                lineHeight: 0.98,
                letterSpacing: '-0.03em',
                maxWidth: 740,
              }}
            >
              Nơi bản đồ phổ thông{' '}
              <span
                style={{
                  fontWeight: 700,
                  color: 'var(--color-sun)',
                }}
              >
                dừng lại.
              </span>
            </h1>

            <p
              key={`desc-${activePeak.key}`}
              className="hero-peak-drop-in"
              style={{
                fontSize: '0.98rem',
                color: 'color-mix(in srgb, var(--color-on-media) 80%, transparent)',
                lineHeight: 1.68,
                maxWidth: 540,
                margin: '0 0 26px 0',
                fontWeight: 400,
              }}
            >
              <strong style={{ color: 'var(--color-on-media)', fontWeight: 600 }}>{activePeak.name}</strong> ({activePeak.subtitle}) —{' '}
              {stats.totalTrails > 1
                ? `và ${stats.totalTrails - 1} cung đường hoang sơ khác`
                : 'cùng hệ thống cung đường hoang sơ'}{' '}
              trên dải đất Việt Nam, với tracklog GPX thực địa, địa hình 3D DEM và tải gói offline khi mất sóng.
            </p>

            {/* Primary Editorial CTA Pair */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="interactive-click"
                onClick={handleOpenActivePeak}
                style={{
                  padding: '12px 22px',
                  borderRadius: 4,
                  background: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  border: '1px solid var(--color-primary)',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>Khám phá {activePeak.name}</span>
                <IconArrowRight size={15} color="var(--color-on-primary)" />
              </button>

              <button
                type="button"
                className="interactive-click"
                onClick={onScrollToMap}
                style={{
                  padding: '12px 20px',
                  borderRadius: 4,
                  background: 'transparent',
                  color: 'var(--color-on-media)',
                  border: '1px solid color-mix(in srgb, var(--color-on-media) 35%, transparent)',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Mở bản đồ địa hình
              </button>

              <button
                type="button"
                className="interactive-click"
                onClick={() => (onOpenEmergencyContacts ? onOpenEmergencyContacts() : onScrollToMap())}
                style={{
                  padding: '12px 16px',
                  borderRadius: 4,
                  background: 'color-mix(in srgb, var(--color-error) 84%, var(--overlay-bg))',
                  color: 'var(--color-on-danger)',
                  border: '1px solid color-mix(in srgb, var(--color-on-danger) 28%, var(--color-error))',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cứu hộ 112 / 114
              </button>
            </div>

            {/* Live Vietnam Platform Telemetry Strip (Instant baseline -> Live DB metrics, zero layout shift) */}
            <div
              style={{
                marginTop: 28,
                paddingTop: 18,
                borderTop: '1px solid color-mix(in srgb, var(--color-on-media) 16%, transparent)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(112px, 100%), 1fr))',
                gap: '12px 18px',
                maxWidth: 580,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <div>
                <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'color-mix(in srgb, var(--color-on-media) 55%, transparent)' }}>
                  Cung thực địa DEM
                </div>
                <div style={{ fontSize: '1.22rem', fontWeight: 800, color: 'var(--color-on-media)', marginTop: 2 }}>
                  {stats.totalTrails > 0 ? `${stats.totalTrails} tuyến` : 'Đang đồng bộ...'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'color-mix(in srgb, var(--color-on-media) 55%, transparent)' }}>
                  Tổng tuyến GPX
                </div>
                <div style={{ fontSize: '1.22rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 2 }}>
                  {stats.totalKm > 0 ? `${stats.totalKm.toLocaleString('vi-VN')} km` : 'Đang đồng bộ...'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'color-mix(in srgb, var(--color-on-media) 55%, transparent)' }}>
                  Đỉnh cao nhất
                </div>
                <div style={{ fontSize: '1.22rem', fontWeight: 800, color: 'var(--color-sun)', marginTop: 2 }}>
                  {stats.maxAltitude.toLocaleString('vi-VN')} m
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'color-mix(in srgb, var(--color-on-media) 55%, transparent)' }}>
                  {stats.verifiedCheckins > 0 ? 'Check-in GPS thật' : 'Trạm VQG / Kiểm lâm'}
                </div>
                <div style={{ fontSize: '1.22rem', fontWeight: 800, color: 'var(--color-on-media)', marginTop: 2 }}>
                  {stats.verifiedCheckins > 0
                    ? `${stats.verifiedCheckins.toLocaleString('vi-VN')} lượt`
                    : `${stats.totalRangers} cơ sở`}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Continuous Downward-Cascading Vertical Altitude Ruler */}
          <div
            className="hero-peak-ruler"
            data-paused={isPeakListPaused || isSearchFocused || !isHeroVisible || !isTabVisible ? 'true' : undefined}
            onMouseEnter={() => setIsPeakListPaused(true)}
            onMouseLeave={() => setIsPeakListPaused(false)}
            onFocus={() => setIsPeakListPaused(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setIsPeakListPaused(false);
              }
            }}
            style={{
              borderLeft: '1px solid color-mix(in srgb, var(--color-on-media) 20%, transparent)',
              paddingLeft: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              ['--hero-step-ms' as string]: `${AUTO_STEP_MS}ms`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'color-mix(in srgb, var(--color-on-media) 60%, transparent)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <span
                  className={isPeakListPaused || isSearchFocused ? undefined : 'radar-pulse-dot'}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: isPeakListPaused || isSearchFocused ? 'var(--color-sun)' : 'var(--color-primary)',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span>Chọn đỉnh để xem địa hình</span>
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--color-sun)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span>
                  0{activeIndex + 1}/0{SHOWCASE_PEAKS.length}
                </span>
                <span className="hero-cascade-arrow" aria-hidden="true">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </div>
            </div>

            <div ref={peakStageRef} className="hero-peak-list-stage">
              {/* Single Gliding Architectural Frame that slides smoothly down from peak to peak */}
              <div
                aria-hidden="true"
                className="hero-peak-glider"
                style={{
                  transform: `translate3d(0, ${gliderRect.top}px, 0)`,
                  height: gliderRect.height,
                  opacity: gliderRect.ready ? 1 : 0,
                }}
              >
                <span
                  key={`progress-${activePeak.key}-${activeIndex}`}
                  className="hero-peak-progress"
                />
              </div>

              {SHOWCASE_PEAKS.map((peak, idx) => {
                const isSelected = idx === activeIndex;
                const matched = peakTrailMap.get(peak.key) || null;
                const displayElevationM = matched?.maxAltitudeM || peak.elevationM;
                const displayDistanceKm = matched?.distanceKm || peak.distanceKm;
                return (
                  <button
                    key={peak.key}
                    ref={(el) => {
                      peakBtnRefs.current[idx] = el;
                    }}
                    type="button"
                    aria-pressed={isSelected}
                    className="hero-peak-btn"
                    onClick={() => {
                      if (isSelected) {
                        handleOpenActivePeak();
                      } else {
                        handleSelectPeakSlide(idx);
                      }
                    }}
                    title={
                      isSelected
                        ? `Nhấn để mở hồ sơ chi tiết ${peak.name}`
                        : `Nhấn để chuyển cảnh sang ${peak.name}`
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '11px 12px 12px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid color-mix(in srgb, var(--color-on-media) 10%, transparent)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: isSelected
                        ? 'var(--color-on-media)'
                        : 'color-mix(in srgb, var(--color-on-media) 58%, transparent)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          color: isSelected
                            ? 'var(--color-sun)'
                            : 'color-mix(in srgb, var(--color-on-media) 40%, transparent)',
                          fontVariantNumeric: 'tabular-nums',
                          transition: 'color var(--dur-base) ease',
                        }}
                      >
                        0{idx + 1}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div
                          className={isSelected ? 'font-editorial' : undefined}
                          style={{
                            fontSize: '1.12rem',
                            fontWeight: isSelected ? 700 : 500,
                            lineHeight: 1.2,
                            transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                            transformOrigin: 'left center',
                            transition:
                              'transform 0.42s cubic-bezier(0.22, 1, 0.36, 1), color var(--dur-base) ease',
                          }}
                        >
                          {peak.name}
                        </div>
                        {isSelected && (
                          <div
                            key={`sub-${peak.key}`}
                            className="hero-peak-drop-in"
                            style={{
                              fontSize: '0.73rem',
                              color: 'color-mix(in srgb, var(--color-on-media) 76%, transparent)',
                              marginTop: 3,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {peak.province} · {displayDistanceKm} km
                          </div>
                        )}
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: isSelected ? 700 : 600,
                        fontVariantNumeric: 'tabular-nums',
                        color: isSelected
                          ? 'var(--color-primary)'
                          : 'color-mix(in srgb, var(--color-on-media) 46%, transparent)',
                        flexShrink: 0,
                        transition: 'color var(--dur-base) ease',
                      }}
                    >
                      {displayElevationM.toLocaleString('vi-VN')} m
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Floating Architectural Command Dock */}
      <div
        style={{
          position: 'relative',
          zIndex: 4,
          maxWidth: 1360,
          width: '100%',
          margin: '0 auto',
          padding: '0 24px 28px 24px',
        }}
      >
        <div
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: 6,
            padding: 8,
            boxShadow: 'var(--shadow-3d)',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {/* Search Input with Live Dropdown */}
          <div style={{ position: 'relative', flex: '1 1 260px', display: 'flex', alignItems: 'center', paddingLeft: 10 }}>
            <IconSearch
              size={16}
              color={isSearchFocused ? 'var(--color-primary)' : 'var(--color-text-dim)'}
              style={{ flexShrink: 0, marginRight: 10 }}
            />
            <input
              type="text"
              value={searchQuery}
              aria-label="Tìm cung đường trekking Việt Nam"
              onFocus={() => {
                if (blurTimeoutRef.current !== null) {
                  window.clearTimeout(blurTimeoutRef.current);
                  blurTimeoutRef.current = null;
                }
                setIsSearchFocused(true);
              }}
              onBlur={() => {
                blurTimeoutRef.current = window.setTimeout(() => {
                  setIsSearchFocused(false);
                  blurTimeoutRef.current = null;
                }, 220);
              }}
              onChange={(e) => {
                setIsCloudChipActive(false);
                onSearchChange(e.target.value);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={
                stats.totalTrails > 0
                  ? `Tìm trong ${stats.totalTrails} cung đường (${stats.totalKm} km GPX)...`
                  : 'Tìm cung đường trekking, đỉnh núi, tỉnh thành Việt Nam...'
              }
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--color-text-main)',
                fontSize: '0.86rem',
                fontWeight: 500,
                padding: '8px 0',
                minWidth: 0,
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setIsCloudChipActive(false);
                  onSearchChange('');
                }}
                title="Xóa tìm kiếm"
                aria-label="Xóa tìm kiếm"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-dim)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                }}
              >
                <IconX size={14} />
              </button>
            )}

            {/* Autocomplete */}
            {searchAutocompleteMatches.length > 0 && (
              <div
                className="dropdown-up-pop"
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 10px)',
                  left: 0,
                  right: 0,
                  zIndex: 'var(--z-dropdown, 1100)' as unknown as number,
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: 6,
                  padding: 6,
                  boxShadow: 'var(--shadow-3d)',
                }}
              >
                {searchAutocompleteMatches.map((m, idx) => (
                  <div
                    key={m.id || (m as Trail & { _id?: string })._id || `match-${idx}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setIsSearchFocused(false);
                      if (onSelectTrail) onSelectTrail(m);
                      else onSearchChange(m.name);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                        {m.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)' }}>
                        {m.province} · {m.region}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {m.maxAltitudeM.toLocaleString('vi-VN')} m
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ width: 1, height: 24, background: 'var(--color-border)' }} />

          {/* Region Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            {[
              { id: 'All', label: 'Tất cả' },
              { id: 'Miền Bắc', label: 'Bắc' },
              { id: 'Miền Trung', label: 'Trung' },
              { id: 'Miền Nam', label: 'Nam' },
            ].map((r) => {
              const isSel = selectedRegion === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelectRegion(r.id)}
                  style={{
                    padding: '7px 11px',
                    borderRadius: 4,
                    fontSize: '0.78rem',
                    fontWeight: isSel ? 700 : 500,
                    cursor: 'pointer',
                    border: 'none',
                    background: isSel ? 'var(--color-surface-elevated)' : 'transparent',
                    color: isSel ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                  }}
                >
                  {r.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleToggleCloudQuickChip}
              style={{
                padding: '7px 10px',
                borderRadius: 4,
                fontSize: '0.78rem',
                fontWeight: isCloudVisualActive ? 700 : 500,
                cursor: 'pointer',
                border: 'none',
                background: isCloudVisualActive ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)' : 'transparent',
                color: isCloudVisualActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {isCloudVisualActive && <IconCheck size={12} />}
              <span>Săn mây</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onToggleCampsite) onToggleCampsite();
                else onSearchChange(searchQuery === 'cắm trại' ? '' : 'cắm trại');
              }}
              style={{
                padding: '7px 10px',
                borderRadius: 4,
                fontSize: '0.78rem',
                fontWeight: campsiteOnly ? 700 : 500,
                cursor: 'pointer',
                border: 'none',
                background: campsiteOnly ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)' : 'transparent',
                color: campsiteOnly ? 'var(--color-primary)' : 'var(--color-text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {campsiteOnly && <IconCheck size={12} />}
              <span>Hạ trại</span>
            </button>
          </div>

          {/* Filter & All Trails Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={onOpenAdvancedFilter}
              style={{
                padding: '8px 13px',
                borderRadius: 4,
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeFilterCount > 0 ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
                color: activeFilterCount > 0 ? 'var(--color-on-primary)' : 'var(--color-text-main)',
                border: '1px solid var(--color-border)',
              }}
            >
              Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>

            <button
              type="button"
              onClick={() => {
                if (onScrollToAllTrails) onScrollToAllTrails();
                else if (onExploreClick) onExploreClick();
                else onScrollToMap();
              }}
              className="btn btn-primary"
              style={{
                padding: '8px 16px',
                borderRadius: 4,
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
            >
              Xem {stats.visibleTrails} tuyến
            </button>
          </div>
        </div>
      </div>
    </section>
  );
});
