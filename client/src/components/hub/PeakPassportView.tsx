import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Trail, UserProfile } from '../../types.js';
import { VIETNAM_SUMMIT_CHALLENGES, type SummitChallengeSeed } from '../../data/vietnamDirectory.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { useFocusTrap, isTopmostFocusTrap } from '../../hooks/useFocusTrap.js';
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator.js';
import { DEFAULT_VIETNAM_TRAIL_COVER } from '../../utils/cloudinary.js';
import { searchMatchVietnamese } from '../../utils/textUtils.js';
import { generateQrMatrix, buildQrSvgPath } from '../../utils/qrMatrix.js';
import { parseGpxFileClient } from '../../utils/gpxParser.js';
import {
  IconMountain,
  IconShieldCheck,
  IconCheckCircle,
  IconMapPin,
  IconCompass,
  IconDownload,
  IconImage,
  IconX,
  IconArrowLeft,
  IconSearch,
  IconLock,
  IconSparkles,
  IconCheck,
} from '../common/SvgIcons.js';
import { ExpeditionShareCardModal } from '../common/ExpeditionShareCardModal.js';
import type { ExpeditionSharePoint } from '../../utils/expeditionShareCard.js';
import { safeLocalStorageGet } from '../../utils/storageScope.js';

export interface PeakPassportViewProps {
  trails: Trail[];
  currentUser?: UserProfile | null;
  onSelectTrail?: (trail: Trail) => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onBack?: () => void;
}

interface ChallengeWithProgress extends SummitChallengeSeed {
  completedTrailSlugs: string[];
  progressCount: number;
  progressPercent: number;
  isCompleted: boolean;
  isClaimed: boolean;
  verifiedCount: number;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  fullName: string;
  username?: string;
  avatarUrl?: string;
  trailsConquered: number;
  verifiedPeaks: number;
  totalUniqueKm: number;
  totalElevationGainM: number;
  highestAltitudeM: number;
  badgesCount: number;
}

interface StampedPeakInfo {
  trailSlug: string;
  verifiedBadge: boolean;
  checkinDate?: string;
  completionTimeHours?: number;
}

interface VerifiedPassportPublicData {
  verified: boolean;
  expeditionCode: string;
  passportHolder: {
    fullName: string;
    username?: string;
    avatarUrl?: string;
    memberSince?: string | null;
    reputationScore: number;
    badgesCount: number;
    rankTitle: string;
  };
  summary: {
    totalStampedPeaks: number;
    totalAvailableTrails: number;
    verifiedGpsPeaks: number;
    totalUniqueKm: number;
    totalUniqueGainM: number;
    highestAltitudeM: number;
    highestPeakName: string;
    claimedChallengesCount: number;
  };
  topPeaks: Array<{
    trailSlug: string;
    trailName: string;
    province: string;
    maxAltitudeM: number;
    verified: boolean;
    lastCheckinDate?: string;
  }>;
}

function getChallengeMetricUnit(ruleType?: string): string {
  if (ruleType === 'cumulative_km') return 'km';
  if (ruleType === 'cumulative_gain') return 'm';
  return 'đỉnh';
}

function readVerifyCodeFromLocation(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (new URLSearchParams(window.location.search).get('verify') || '').trim();
  } catch {
    return '';
  }
}

type TrailWithMongoId = Trail & { _id?: string };
type UserWithMongoId = UserProfile & { _id?: string };

interface RawCheckinRecord {
  trailId?: { id?: string; _id?: string } | string;
  trailSlug?: string;
  verifiedBadge?: boolean;
  checkinDate?: string;
  createdAt?: string;
  completionTimeHours?: number;
}

interface RawStampedPeak {
  slug?: string;
  trailSlug?: string;
  id?: string;
  trailObjId?: string;
  trailId?: { id?: string } | string;
  verifiedBadge?: boolean;
  verified?: boolean;
  checkinDate?: string;
  lastCheckinDate?: string;
  firstCheckinDate?: string;
  stampedAt?: string;
  completionTimeHours?: number;
  bestTimeHours?: number;
}

interface RawServerChallengeProgress {
  completedTrailSlugs?: string[];
  progressValue?: number;
  progressCount?: number;
  targetCount?: number;
  progressPercent?: number;
  isCompleted?: boolean;
  isClaimed?: boolean;
  verifiedCount?: number;
}

interface RawServerChallenge extends Partial<SummitChallengeSeed> {
  slug: string;
  title: string;
  progress?: RawServerChallengeProgress;
  completedTrailSlugs?: string[];
  progressCount?: number;
  progressPercent?: number;
  isCompleted?: boolean;
  isClaimed?: boolean;
  verifiedCount?: number;
}

interface RawLeaderboardRow {
  rank?: number;
  userId?: string;
  _id?: string;
  fullName?: string;
  username?: string;
  avatarUrl?: string;
  trailsConquered?: number;
  summitsCount?: number;
  verifiedPeaks?: number;
  verifiedCount?: number;
  verifiedCheckins?: number;
  totalUniqueKm?: number;
  totalDistanceKm?: number;
  totalElevationGainM?: number;
  highestAltitudeM?: number;
  badgesCount?: number;
}

const ELEVATION_MILESTONES = [
  { targetM: 5000, title: 'Bước đầu lên cao nguyên', badge: '5K Climber' },
  { targetM: 15000, title: 'Qua những dốc Hoàng Liên', badge: '15K Alpinist' },
  { targetM: 30000, title: 'Chân quen đường rừng già', badge: '30K Mountaineer' },
  { targetM: 50000, title: 'Dấu chân dọc Trường Sơn', badge: '50K Legend' },
];

const TIER_META: Record<
  SummitChallengeSeed['tier'],
  { label: string; color: string }
> = {
  bronze: { label: 'Hạng đồng', color: 'var(--color-earth)' },
  silver: { label: 'Hạng bạc', color: 'var(--color-sky)' },
  gold: { label: 'Hạng vàng', color: 'var(--color-sun)' },
  alpine_legend: { label: 'Chặng dài núi cao', color: 'var(--color-primary)' },
};

const readCssVar = (name: string, fallback: string): string => {
  if (typeof window === 'undefined') return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
};

export const PeakPassportView: React.FC<PeakPassportViewProps> = ({
  trails,
  currentUser,
  onSelectTrail,
  onShowToast,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'challenges' | 'passport' | 'leaderboard'>('challenges');
  const { trackRef: passportTabTrackRef, indicatorStyle: passportTabIndicatorStyle } =
    useSlidingIndicator<'challenges' | 'passport' | 'leaderboard'>(activeTab);
  const [regionFilter, setRegionFilter] = useState<'Tất cả' | 'Miền Bắc' | 'Miền Trung' | 'Miền Nam'>('Tất cả');
  const [leaderboardRegion, setLeaderboardRegion] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [serverChallenges, setServerChallenges] = useState<ChallengeWithProgress[] | null>(null);
  const [stampedMap, setStampedMap] = useState<Record<string, StampedPeakInfo>>({});
  const [claimedSlugs, setClaimedSlugs] = useState<Set<string>>(new Set());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [claimingSlug, setClaimingSlug] = useState<string | null>(null);

  // Quick check-in modal state
  const [checkinModalTrail, setCheckinModalTrail] = useState<Trail | null>(null);
  const [checkinHours, setCheckinHours] = useState('8');
  const [checkinGps, setCheckinGps] = useState<{ lat: number; lng: number } | null>(null);
  const [checkinGpxTrack, setCheckinGpxTrack] = useState<[number, number][]>([]);
  const [checkinGpxMeta, setCheckinGpxMeta] = useState<{ fileName: string; distanceKm: number; pointsCount: number } | null>(null);
  const [parsingCheckinGpx, setParsingCheckinGpx] = useState(false);
  const [capturingGps, setCapturingGps] = useState(false);
  const [submittingCheckin, setSubmittingCheckin] = useState(false);
  const checkinGpxInputRef = useRef<HTMLInputElement | null>(null);

  // Passport export modal preview & per-peak offline PNG share card modal
  const [checkinOpenedAtMs, setCheckinOpenedAtMs] = useState<number>(0);
  const [showCardPreview, setShowCardPreview] = useState(false);
  const [shareCardTarget, setShareCardTarget] = useState<{
    trail: Trail;
    stamp: StampedPeakInfo;
  } | null>(null);
  const [isLightTheme, setIsLightTheme] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light'
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const syncTheme = () =>
      setIsLightTheme(document.documentElement.getAttribute('data-theme') === 'light');
    syncTheme();
    const obs = new MutationObserver(syncTheme);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const userId = String(currentUser?.id || (currentUser as UserWithMongoId | null | undefined)?._id || '');
  const localCheckinsKey = `lost_checkins_${userId || 'guest'}`;
  const localClaimsKey = `lost_claimed_challenges_${userId || 'guest'}`;
  const [refreshTick, setRefreshTick] = useState(0);
  const isMountedRef = useRef(true);
  const checkinModalRef = useRef<HTMLDivElement | null>(null);
  const cardPreviewModalRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(Boolean(checkinModalTrail), checkinModalRef);
  useFocusTrap(showCardPreview, cardPreviewModalRef);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const userCheckedInSlugs = useMemo(
    () => (Array.isArray(currentUser?.checkedInTrails) ? currentUser.checkedInTrails.map(String) : []),
    [currentUser]
  );

  // Escape closes topmost modal (LIFO focus-trap + IME safe; ExpeditionShareCardModal handles its own Escape)
  useEffect(() => {
    if (!checkinModalTrail && !showCardPreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing) return;
      if (shareCardTarget) return;
      if (checkinModalTrail && isTopmostFocusTrap(checkinModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!submittingCheckin) setCheckinModalTrail(null);
      } else if (showCardPreview && isTopmostFocusTrap(cardPreviewModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setShowCardPreview(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shareCardTarget, checkinModalTrail, submittingCheckin, showCardPreview]);

  const shareCardInitialData = useMemo(() => {
    if (!shareCardTarget) return null;
    const { trail, stamp } = shareCardTarget;
    type RawGpxEntry = [number, number] | [number, number, number] | { lat?: number; lng?: number; elevationM?: number };
    const rawEntries: RawGpxEntry[] =
      Array.isArray(trail.gpxTrack) && trail.gpxTrack.length >= 2
        ? (trail.gpxTrack as RawGpxEntry[])
        : [
          [trail.startLat, trail.startLng],
          [trail.endLat, trail.endLng],
        ];

    const parsedCoords = rawEntries
      .map((entry) => {
        const lat = Number(Array.isArray(entry) ? entry[0] : entry?.lat);
        const lng = Number(Array.isArray(entry) ? entry[1] : entry?.lng);
        const eleRaw = Array.isArray(entry) ? entry[2] : entry?.elevationM;
        const ele = typeof eleRaw === 'number' && Number.isFinite(eleRaw) ? eleRaw : null;
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, ele } : null;
      })
      .filter((pt): pt is { lat: number; lng: number; ele: number | null } => pt !== null);

    const validEleCount = parsedCoords.filter((pt) => pt.ele !== null).length;
    const baseAlt = Math.max(80, (trail.maxAltitudeM || 0) - (trail.elevationGainM || 0));
    const totalSegs = Math.max(1, parsedCoords.length - 1);
    const firstPt = parsedCoords[0];
    const lastPt = parsedCoords[parsedCoords.length - 1];
    const isLoopLike =
      parsedCoords.length >= 4 &&
      firstPt &&
      lastPt &&
      Math.hypot(lastPt.lat - firstPt.lat, lastPt.lng - firstPt.lng) < 0.012;

    const trackPoints: ExpeditionSharePoint[] = parsedCoords.map((pt, idx) => {
      if (validEleCount >= 2 && pt.ele !== null) {
        return { lat: pt.lat, lng: pt.lng, altitudeM: Math.round(pt.ele) };
      }
      const ratio = idx / totalSegs;
      const climbShape = isLoopLike ? 1 - Math.abs(ratio * 2 - 1) : Math.pow(ratio, 0.85);
      return {
        lat: pt.lat,
        lng: pt.lng,
        altitudeM: Math.round(baseAlt + ((trail.maxAltitudeM || baseAlt) - baseAlt) * climbShape),
      };
    });

    const parsedDate = stamp.checkinDate ? new Date(stamp.checkinDate) : null;
    const dateLabel =
      parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const durationLabel =
      typeof stamp.completionTimeHours === 'number' && stamp.completionTimeHours > 0
        ? `${stamp.completionTimeHours} giờ`
        : trail.durationHoursNote || `${trail.durationDays} ngày`;

    const coordinates =
      Number.isFinite(trail.endLat) && Number.isFinite(trail.endLng)
        ? { lat: trail.endLat, lng: trail.endLng }
        : Number.isFinite(trail.startLat) && Number.isFinite(trail.startLng)
          ? { lat: trail.startLat, lng: trail.startLng }
          : null;

    return {
      peakName: trail.name,
      province: trail.province,
      region: trail.region,
      altitudeM: trail.maxAltitudeM,
      distanceKm: trail.distanceKm,
      elevationGainM: trail.elevationGainM,
      durationLabel,
      dateLabel,
      hikerName: currentUser?.fullName || currentUser?.username || 'Người đi rừng LOST',
      verifiedGps: stamp.verifiedBadge,
      coordinates,
      trackPoints,
      defaultCaption: stamp.verifiedBadge
        ? 'Đã đóng dấu xác thực GPS trên sổ dấu đỉnh LOST'
        : 'Đã ghi dấu chuyến đi trên sổ dấu đỉnh LOST',
    };
  }, [shareCardTarget, currentUser]);

  const reloadPassportData = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const run = async () => {
      const token = typeof window !== 'undefined' ? safeLocalStorageGet('lost_token') : null;

      // Seed local stamped peaks first for instant offline rendering
      const nextStamped: Record<string, StampedPeakInfo> = {};
      userCheckedInSlugs.forEach((slug) => {
        if (slug) nextStamped[slug] = { trailSlug: slug, verifiedBadge: false };
      });
      try {
        const rawLocal: unknown = JSON.parse(localStorage.getItem(localCheckinsKey) || '[]');
        if (Array.isArray(rawLocal)) {
          rawLocal.forEach((entry) => {
            if (typeof entry === 'string' && entry) {
              if (!nextStamped[entry]) {
                nextStamped[entry] = { trailSlug: entry, verifiedBadge: false };
              }
            } else if (entry && typeof entry === 'object' && 'trailSlug' in entry) {
              const rec = entry as StampedPeakInfo;
              if (rec.trailSlug && !nextStamped[rec.trailSlug]) {
                nextStamped[rec.trailSlug] = {
                  trailSlug: String(rec.trailSlug),
                  verifiedBadge: Boolean(rec.verifiedBadge),
                  checkinDate: rec.checkinDate,
                  completionTimeHours: rec.completionTimeHours,
                };
              }
            }
          });
        } else if (rawLocal && typeof rawLocal === 'object') {
          Object.entries(rawLocal as Record<string, StampedPeakInfo>).forEach(([slug, rec]) => {
            if (slug && rec && !nextStamped[slug]) {
              nextStamped[slug] = {
                trailSlug: slug,
                verifiedBadge: Boolean(rec.verifiedBadge),
                checkinDate: rec.checkinDate,
                completionTimeHours: rec.completionTimeHours,
              };
            }
          });
        }
      } catch {
        // ignore invalid cache
      }

      const nextClaimed = new Set<string>();
      try {
        const localClaims: unknown = JSON.parse(localStorage.getItem(localClaimsKey) || '[]');
        if (Array.isArray(localClaims)) {
          localClaims.forEach((s) => {
            if (s) nextClaimed.add(String(s));
          });
        }
      } catch {
        // ignore
      }

      try {
        const [challengesRes, passportRes, checkinsRes] = await Promise.all([
          fetch('/api/challenges', { headers: getApiHeaders(), signal })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          token
            ? fetch('/api/challenges/passport/me', { headers: getApiHeaders(), signal })
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
            : Promise.resolve(null),
          token
            ? fetch('/api/checkins/me', { headers: getApiHeaders(), signal })
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
            : Promise.resolve(null),
        ]);

        if (signal.aborted) return;

        if (checkinsRes?.success && Array.isArray(checkinsRes.data)) {
          (checkinsRes.data as RawCheckinRecord[]).forEach((c) => {
            const tObj = typeof c.trailId === 'object' && c.trailId ? c.trailId : null;
            const slug = String(tObj?.id || c.trailSlug || tObj?._id || (typeof c.trailId === 'string' ? c.trailId : '') || '');
            if (!slug) return;
            const prev = nextStamped[slug];
            nextStamped[slug] = {
              trailSlug: slug,
              verifiedBadge: Boolean(prev?.verifiedBadge || c.verifiedBadge),
              checkinDate: c.checkinDate || c.createdAt || prev?.checkinDate,
              completionTimeHours: c.completionTimeHours ?? prev?.completionTimeHours,
            };
          });
        }

        if (passportRes?.success && passportRes.data) {
          const pData = passportRes.data as {
            stampedPeaks?: RawStampedPeak[];
            peaks?: RawStampedPeak[];
            conqueredTrails?: RawStampedPeak[];
            claimedChallenges?: Array<string | { challengeSlug?: string; slug?: string }>;
            claims?: Array<string | { challengeSlug?: string; slug?: string }>;
          };
          const stampedList = pData.stampedPeaks || pData.peaks || pData.conqueredTrails || [];
          if (Array.isArray(stampedList)) {
            stampedList.forEach((p) => {
              const tObj = typeof p.trailId === 'object' && p.trailId ? p.trailId : null;
              const slug = String(
                p.slug || p.trailSlug || p.id || tObj?.id || (typeof p.trailId === 'string' ? p.trailId : '') || p.trailObjId || ''
              );
              if (!slug) return;
              nextStamped[slug] = {
                trailSlug: slug,
                verifiedBadge: Boolean(p.verifiedBadge || p.verified || nextStamped[slug]?.verifiedBadge),
                checkinDate: p.lastCheckinDate || p.firstCheckinDate || p.checkinDate || p.stampedAt || nextStamped[slug]?.checkinDate,
                completionTimeHours: p.bestTimeHours ?? p.completionTimeHours ?? nextStamped[slug]?.completionTimeHours,
              };
            });
          }
          const serverClaims = pData.claimedChallenges || pData.claims || [];
          if (Array.isArray(serverClaims)) {
            serverClaims.forEach((c) => {
              const s = typeof c === 'string' ? c : c.challengeSlug || c.slug;
              if (s) nextClaimed.add(String(s));
            });
          }
        }

        if (challengesRes?.success && Array.isArray(challengesRes.data) && challengesRes.data.length > 0) {
          const mapped: ChallengeWithProgress[] = (challengesRes.data as RawServerChallenge[]).map((c) => {
            const prog = c.progress || c;
            if (prog.isClaimed && c.slug) nextClaimed.add(String(c.slug));
            return {
              slug: c.slug,
              title: c.title,
              subtitle: c.subtitle || '',
              description: c.description || '',
              badgeName: c.badgeName || c.title,
              tier: c.tier || 'silver',
              region: c.region || 'Toàn Quốc',
              ruleType: c.ruleType || 'trail_slugs',
              requiredTrailSlugs: Array.isArray(c.requiredTrailSlugs) ? c.requiredTrailSlugs : [],
              minAltitudeM: c.minAltitudeM,
              targetCount: Number(prog.targetCount ?? c.targetCount) || 1,
              targetKm: c.targetKm,
              targetGainM: c.targetGainM,
              rewardPoints: Number(c.rewardPoints) || 100,
              coverImage: c.coverImage || DEFAULT_VIETNAM_TRAIL_COVER,
              isActive: c.isActive !== false,
              sortOrder: Number(c.sortOrder) || 0,
              completedTrailSlugs: Array.isArray(prog.completedTrailSlugs) ? prog.completedTrailSlugs : [],
              progressCount: Number(prog.progressCount ?? (prog as RawServerChallengeProgress).progressValue) || 0,
              progressPercent: Number(prog.progressPercent) || 0,
              isCompleted: Boolean(prog.isCompleted),
              isClaimed: Boolean(prog.isClaimed),
              verifiedCount: Number(prog.verifiedCount) || 0,
            };
          });
          setServerChallenges(mapped);
        } else {
          setServerChallenges(null);
        }
      } catch {
        if (!signal.aborted) setServerChallenges(null);
      } finally {
        if (!signal.aborted) {
          setStampedMap(nextStamped);
          setClaimedSlugs(nextClaimed);
          setLoading(false);
        }
      }
    };
    void run();
    return () => {
      controller.abort();
    };
  }, [userCheckedInSlugs, localCheckinsKey, localClaimsKey, refreshTick]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const run = async () => {
      try {
        const qs = new URLSearchParams({ limit: '20' });
        if (leaderboardRegion) qs.set('region', leaderboardRegion);
        let res = await fetch(`/api/challenges/leaderboard?${qs.toString()}`, {
          headers: getApiHeaders(),
          signal,
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);

        if (!signal.aborted && (!res?.success || !Array.isArray(res.data))) {
          res = await fetch(`/api/checkins/leaderboard?${qs.toString()}`, {
            headers: getApiHeaders(),
            signal,
          })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null);
        }

        if (!signal.aborted && res?.success && Array.isArray(res.data)) {
          setLeaderboard(
            (res.data as RawLeaderboardRow[]).map((row, idx) => ({
              rank: Number(row.rank) || idx + 1,
              userId: String(row.userId || row._id || idx),
              fullName: row.fullName || row.username || 'Trekker LOST',
              username: row.username,
              avatarUrl: row.avatarUrl,
              trailsConquered: Number(row.trailsConquered ?? row.summitsCount ?? 0),
              verifiedPeaks: Number(row.verifiedPeaks ?? row.verifiedCount ?? row.verifiedCheckins ?? 0),
              totalUniqueKm: Number(row.totalUniqueKm ?? row.totalDistanceKm ?? 0),
              totalElevationGainM: Number(row.totalElevationGainM ?? 0),
              highestAltitudeM: Number(row.highestAltitudeM ?? 0),
              badgesCount: Number(row.badgesCount ?? 0),
            }))
          );
        }
      } catch {
        // ignore abort / offline
      }
    };
    void run();
    return () => {
      controller.abort();
    };
  }, [leaderboardRegion, refreshTick]);

  const trailBySlug = useMemo(() => {
    const map = new Map<string, Trail>();
    trails.forEach((t) => {
      map.set(String(t.id), t);
      const mongoId = (t as TrailWithMongoId)._id;
      if (mongoId) map.set(String(mongoId), t);
    });
    return map;
  }, [trails]);

  // Real conquered trails resolved from stampedMap
  const conqueredTrails = useMemo(() => {
    return trails.filter((t) => {
      const mid = (t as TrailWithMongoId)._id ? String((t as TrailWithMongoId)._id) : '';
      return Boolean(stampedMap[String(t.id)] || (mid && stampedMap[mid]));
    });
  }, [trails, stampedMap]);

  const totalUniqueKm = useMemo(
    () => Math.round(conqueredTrails.reduce((s, t) => s + (Number(t.distanceKm) || 0), 0) * 10) / 10,
    [conqueredTrails]
  );

  const totalElevationGainM = useMemo(
    () => conqueredTrails.reduce((s, t) => s + (Number(t.elevationGainM) || 0), 0),
    [conqueredTrails]
  );

  const highestPeak = useMemo(() => {
    return conqueredTrails.reduce<Trail | null>(
      (best, t) => (!best || (t.maxAltitudeM || 0) > (best.maxAltitudeM || 0) ? t : best),
      null
    );
  }, [conqueredTrails]);

  const verifiedStampsCount = useMemo(
    () =>
      conqueredTrails.filter((t) => {
        const mid = (t as TrailWithMongoId)._id ? String((t as TrailWithMongoId)._id) : '';
        return Boolean(stampedMap[String(t.id)]?.verifiedBadge || (mid && stampedMap[mid]?.verifiedBadge));
      }).length,
    [conqueredTrails, stampedMap]
  );

  // Merge server challenges or compute deterministically from VIETNAM_SUMMIT_CHALLENGES + stampedMap
  const challenges: ChallengeWithProgress[] = useMemo(() => {
    const baseList = serverChallenges || VIETNAM_SUMMIT_CHALLENGES;
    const conqueredSlugsSet = new Set(conqueredTrails.map((t) => String(t.id)));

    return baseList.map((ch) => {
      const serverMatch = serverChallenges?.find((s) => s.slug === ch.slug);
      const regionScopedTrails =
        ch.region && ch.region !== 'Toàn Quốc'
          ? conqueredTrails.filter((t) => t.region === ch.region)
          : conqueredTrails;
      const matchedSlugs = ch.requiredTrailSlugs.filter((s) => conqueredSlugsSet.has(s));
      const verifiedInChallenge = matchedSlugs.filter((s) => Boolean(stampedMap[s]?.verifiedBadge)).length;

      let progressCount = matchedSlugs.length;
      let target = Math.max(1, ch.targetCount || ch.requiredTrailSlugs.length || 1);
      let completedSlugs = matchedSlugs;

      if (ch.ruleType === 'cumulative_km') {
        target = Math.max(1, ch.targetKm || ch.targetCount || 100);
        progressCount = Math.round(
          regionScopedTrails.reduce((sum, t) => sum + (Number(t.distanceKm) || 0), 0)
        );
        completedSlugs = regionScopedTrails.map((t) => String(t.id));
      } else if (ch.ruleType === 'cumulative_gain') {
        target = Math.max(100, ch.targetGainM || ch.targetCount || 5000);
        progressCount = Math.round(
          regionScopedTrails.reduce((sum, t) => sum + (Number(t.elevationGainM) || 0), 0)
        );
        completedSlugs = regionScopedTrails.map((t) => String(t.id));
      } else if (ch.ruleType === 'altitude_threshold' && ch.minAltitudeM) {
        const highTrails = regionScopedTrails.filter((t) => (t.maxAltitudeM || 0) >= ch.minAltitudeM!);
        progressCount = highTrails.length;
        completedSlugs = highTrails.map((t) => String(t.id));
      }

      const effectiveCount = serverMatch
        ? Math.max(serverMatch.progressCount, progressCount)
        : progressCount;
      const effectiveTarget = serverMatch?.targetCount && serverMatch.targetCount > 1 ? serverMatch.targetCount : target;
      const progressPercent = Math.min(100, Math.round((effectiveCount / effectiveTarget) * 100));
      const isCompleted = Boolean(serverMatch?.isCompleted || effectiveCount >= effectiveTarget);
      const isClaimed = Boolean(serverMatch?.isClaimed || claimedSlugs.has(ch.slug));

      return {
        ...ch,
        targetCount: effectiveTarget,
        completedTrailSlugs:
          serverMatch && serverMatch.completedTrailSlugs.length >= completedSlugs.length
            ? serverMatch.completedTrailSlugs
            : completedSlugs,
        progressCount: effectiveCount,
        progressPercent,
        isCompleted,
        isClaimed,
        verifiedCount: Math.max(serverMatch?.verifiedCount || 0, verifiedInChallenge),
      };
    });
  }, [serverChallenges, conqueredTrails, stampedMap, claimedSlugs]);

  const handleClaimChallenge = async (ch: ChallengeWithProgress) => {
    if (claimingSlug || !ch.isCompleted || ch.isClaimed) return;
    const token = safeLocalStorageGet('lost_token');
    if (!currentUser || !token) {
      window.dispatchEvent(new CustomEvent('lost:open-auth-modal', { detail: { mode: 'login' } }));
      onShowToast?.('Đăng nhập để nhận huy hiệu và cộng điểm uy tín vào hồ sơ nhé.', 'info');
      return;
    }

    setClaimingSlug(ch.slug);
    try {
      const res = await fetch(`/api/challenges/${encodeURIComponent(ch.slug)}/claim`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const nextSet = new Set(claimedSlugs);
        nextSet.add(ch.slug);
        setClaimedSlugs(nextSet);
        try {
          localStorage.setItem(localClaimsKey, JSON.stringify(Array.from(nextSet)));
        } catch {
          // ignore
        }
        onShowToast?.(
          data.message || `Đã nhận huy hiệu "${ch.badgeName}" (+${ch.rewardPoints} điểm uy tín).`,
          'success'
        );
        reloadPassportData();
        return;
      }
      onShowToast?.(data.message || 'Chưa nhận được huy hiệu lúc này.', 'error');
    } catch {
      onShowToast?.('Không kết nối được máy chủ để lưu huy hiệu.', 'error');
    } finally {
      setClaimingSlug(null);
    }
  };

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      onShowToast?.('Thiết bị không hỗ trợ định vị GPS.', 'error');
      return;
    }
    setCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!isMountedRef.current) return;
        setCheckinGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setCapturingGps(false);
        onShowToast?.('Đã bắt được tọa độ GPS để đóng dấu xác thực.', 'success');
      },
      () => {
        if (!isMountedRef.current) return;
        setCapturingGps(false);
        onShowToast?.('Không bắt được sóng GPS. Bạn vẫn có thể tự đóng dấu thủ công nhé.', 'info');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSelectCheckinGpx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setParsingCheckinGpx(true);
    try {
      const parsed = await parseGpxFileClient(file);
      if (!isMountedRef.current) return;
      const trackLatLng: [number, number][] = parsed.points.map(([lat, lng]) => [lat, lng]);
      setCheckinGpxTrack(trackLatLng);
      setCheckinGpxMeta({
        fileName: parsed.fileName,
        distanceKm: parsed.offlineAnalysis.distanceKm,
        pointsCount: trackLatLng.length,
      });
      onShowToast?.(
        `Đã nạp tracklog "${parsed.fileName}" (${trackLatLng.length} điểm, ${parsed.offlineAnalysis.distanceKm} km) để xác thực đỉnh.`,
        'success'
      );
    } catch (err) {
      if (!isMountedRef.current) return;
      onShowToast?.(
        err instanceof Error ? err.message : 'Không thể đọc tệp GPX này. Kiểm tra lại định dạng GPX 1.1 nhé.',
        'error'
      );
    } finally {
      if (isMountedRef.current) setParsingCheckinGpx(false);
    }
  };

  const handleConfirmStampCheckin = async () => {
    if (!checkinModalTrail || submittingCheckin) return;
    const token = safeLocalStorageGet('lost_token');
    const hours = Math.max(0.5, Math.min(240, Number(checkinHours) || 8));

    setSubmittingCheckin(true);
    try {
      if (token) {
        const res = await fetch('/api/checkins', {
          method: 'POST',
          headers: getApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            trailId: checkinModalTrail.id,
            completionTimeHours: hours,
            ...(checkinGps ? { lat: checkinGps.lat, lng: checkinGps.lng } : {}),
            ...(checkinGpxTrack.length >= 2 ? { gpxTrackRecorded: checkinGpxTrack } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          onShowToast?.(
            data.message || `Đã đóng dấu đỉnh "${checkinModalTrail.name}" vào sổ của bạn.`,
            'success'
          );
          setCheckinModalTrail(null);
          setCheckinGps(null);
          setCheckinGpxTrack([]);
          setCheckinGpxMeta(null);
          reloadPassportData();
          return;
        }
        if (res.status === 409) {
          onShowToast?.(
            'Cung này vừa được đóng dấu trong 12 giờ qua (quy định chống trùng lặp). Hãy quay lại sau 12 giờ và đính kèm tệp .GPX hoặc tọa độ GPS thực địa để nâng cấp dấu xác thực.',
            'info'
          );
          return;
        }
        onShowToast?.(data.message || 'Chưa lưu được dấu đỉnh lên máy chủ.', 'error');
        return;
      }

      // Offline / guest local stamp — preserve date & duration metadata
      const next: Record<string, StampedPeakInfo> = {
        ...stampedMap,
        [checkinModalTrail.id]: {
          trailSlug: checkinModalTrail.id,
          verifiedBadge: false,
          checkinDate: new Date().toISOString(),
          completionTimeHours: hours,
        },
      };
      setStampedMap(next);
      try {
        localStorage.setItem(localCheckinsKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      onShowToast?.(`Đã lưu dấu đỉnh "${checkinModalTrail.name}" trên máy này.`, 'info');
      setCheckinModalTrail(null);
      setCheckinGps(null);
      setCheckinGpxTrack([]);
      setCheckinGpxMeta(null);
    } catch {
      onShowToast?.('Mất kết nối máy chủ khi lưu dấu đỉnh.', 'error');
    } finally {
      setSubmittingCheckin(false);
    }
  };

  // Filtered trails for Stamp Passport Grid
  const filteredPassportTrails = useMemo(() => {
    return trails
      .filter((t) => {
        if (regionFilter !== 'Tất cả' && t.region !== regionFilter) return false;
        if (
          searchQuery.trim() &&
          !searchMatchVietnamese(t.name, searchQuery) &&
          !searchMatchVietnamese(t.province, searchQuery)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (b.maxAltitudeM || 0) - (a.maxAltitudeM || 0));
  }, [trails, regionFilter, searchQuery]);

  const [verifyCode, setVerifyCode] = useState<string>(() => readVerifyCodeFromLocation());
  const [verifyResult, setVerifyResult] = useState<{
    code: string;
    status: 'verified' | 'error';
    data?: VerifiedPassportPublicData;
    errorMessage?: string;
  } | null>(null);
  const isVerifyingPassport = Boolean(verifyCode) && verifyResult?.code !== verifyCode;

  useEffect(() => {
    const onPopState = () => {
      setVerifyCode(readVerifyCodeFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!verifyCode) return;
    const controller = new AbortController();
    fetch(`/api/challenges/passport/verify/${encodeURIComponent(verifyCode)}`, {
      headers: getApiHeaders(),
      signal: controller.signal,
    })
      .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
      .then(({ ok, json }) => {
        if (controller.signal.aborted) return;
        if (ok && json?.success && json?.data) {
          setVerifyResult({
            code: verifyCode,
            status: 'verified',
            data: json.data as VerifiedPassportPublicData,
          });
        } else {
          setVerifyResult({
            code: verifyCode,
            status: 'error',
            errorMessage: json?.message || 'Không tìm thấy sổ dấu đỉnh hợp lệ cho mã này.',
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setVerifyResult({
            code: verifyCode,
            status: 'error',
            errorMessage: 'Không kết nối được máy chủ để kiểm tra mã lúc này.',
          });
        }
      });
    return () => controller.abort();
  }, [verifyCode]);

  const handleDismissVerifyBanner = () => {
    setVerifyCode('');
    setVerifyResult(null);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('verify');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      } catch {
        // ignore history error
      }
    }
  };

  const hasVerifiedAccountCode = Boolean(userId);
  const expeditionCode = hasVerifiedAccountCode ? `LS-${userId.slice(-6).toUpperCase()}` : 'KHACH-TAM';
  const qrPayload = hasVerifiedAccountCode
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://lost.vn'}/passport?verify=${encodeURIComponent(expeditionCode)}`
    : `${typeof window !== 'undefined' ? window.location.origin : 'https://lost.vn'}/passport`;
  const qrData = useMemo(() => generateQrMatrix(qrPayload), [qrPayload]);
  const qrSvg = useMemo(() => buildQrSvgPath(qrData.matrix, 2), [qrData.matrix]);

  const handleDownloadPassportPng = () => {
    try {
      const bgMain = readCssVar('--color-bg-main', 'Canvas');
      const bgCard = readCssVar('--color-bg-card', 'Canvas');
      const primary = readCssVar('--color-primary', 'currentColor');
      const sun = readCssVar('--color-sun', 'currentColor');
      const textMain = readCssVar('--color-text-main', 'CanvasText');
      const textMuted = readCssVar('--color-text-muted', 'GrayText');
      const borderStrong = readCssVar('--color-border-strong', 'GrayText');
      const onMedia = readCssVar('--color-on-media', readCssVar('--color-on-primary', 'var(--color-on-primary)'));
      const qrDarkFill = isLightTheme ? textMain : bgMain;

      const rawHolder = (currentUser?.fullName || currentUser?.username || 'Trekker LOST')
        .replace(/[<>&"]/g, '');
      const holderName = rawHolder.length > 26 ? `${rawHolder.slice(0, 25).trim()}…` : rawHolder;

      let topPeakLabel = 'Chưa đóng dấu đỉnh';
      if (highestPeak) {
        const cleanPeakName = highestPeak.name.replace(/[<>&"]/g, '');
        const altSuffix = ` (${highestPeak.maxAltitudeM.toLocaleString('vi-VN')}m)`;
        const maxNameChars = Math.max(12, 46 - altSuffix.length);
        const truncatedName =
          cleanPeakName.length > maxNameChars ? `${cleanPeakName.slice(0, maxNameChars - 1).trim()}…` : cleanPeakName;
        topPeakLabel = `${truncatedName}${altSuffix}`;
      }
      const qrCaption = hasVerifiedAccountCode ? 'QUÉT KIỂM TRA SỔ DẤU' : 'SỔ DẤU ĐỈNH LOST VN';

      const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
        <defs>
          <clipPath id="peak-box-clip"><rect x="64" y="316" width="608" height="86"/></clipPath>
          <clipPath id="holder-clip"><rect x="52" y="84" width="636" height="60"/></clipPath>
        </defs>
        <rect width="960" height="540" fill="${bgMain}"/>
        <rect x="24" y="24" width="912" height="492" rx="6" fill="${bgCard}" stroke="${borderStrong}" stroke-width="2"/>
        <rect x="24" y="24" width="912" height="6" fill="${primary}"/>
        <text x="56" y="76" fill="${primary}" font-family="Plus Jakarta Sans, sans-serif" font-size="14" font-weight="700" letter-spacing="4">LOST VIETNAM · SỔ DẤU ĐỈNH</text>
        <text x="56" y="128" fill="${textMain}" font-family="Plus Jakarta Sans, sans-serif" font-size="36" font-weight="800" clip-path="url(#holder-clip)">${holderName}</text>
        <text x="56" y="160" fill="${textMuted}" font-family="Plus Jakarta Sans, sans-serif" font-size="16" font-weight="600">MÃ SỔ: ${expeditionCode}  ·  XÁC THỰC GPS: ${verifiedStampsCount} ĐỈNH</text>
        <line x1="56" y1="190" x2="680" y2="190" stroke="${borderStrong}" stroke-width="1"/>
        <text x="56" y="232" fill="${textMuted}" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="700" letter-spacing="2">ĐỈNH ĐÃ QUA</text>
        <text x="56" y="274" fill="${primary}" font-family="Plus Jakarta Sans, sans-serif" font-size="40" font-weight="800">${conqueredTrails.length} / ${trails.length}</text>
        <text x="275" y="232" fill="${textMuted}" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="700" letter-spacing="2">TỔNG CỰ LY</text>
        <text x="275" y="274" fill="${textMain}" font-family="Plus Jakarta Sans, sans-serif" font-size="40" font-weight="800">${totalUniqueKm} km</text>
        <text x="485" y="232" fill="${textMuted}" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="700" letter-spacing="2">TỔNG ĐỘ DỐC</text>
        <text x="485" y="274" fill="${sun}" font-family="Plus Jakarta Sans, sans-serif" font-size="40" font-weight="800">+${totalElevationGainM.toLocaleString('vi-VN')}m</text>
        <rect x="56" y="316" width="624" height="86" rx="4" fill="${bgMain}" stroke="${borderStrong}"/>
        <text x="76" y="348" fill="${textMuted}" font-family="Plus Jakarta Sans, sans-serif" font-size="12" font-weight="700" letter-spacing="2">ĐỈNH CAO NHẤT ĐÃ ĐẾN</text>
        <text x="76" y="382" fill="${textMain}" font-family="Plus Jakarta Sans, sans-serif" font-size="19" font-weight="700" clip-path="url(#peak-box-clip)">${topPeakLabel}</text>
        <text x="56" y="476" fill="${textMuted}" font-family="Plus Jakarta Sans, sans-serif" font-size="13">Xuất ngày ${new Date().toLocaleDateString('vi-VN')} · Cộng đồng đi núi LOST Việt Nam</text>
        <rect x="720" y="196" width="184" height="184" rx="4" fill="${onMedia}"/>
        <g transform="translate(730, 206) scale(${(164 / qrSvg.viewBoxSize).toFixed(4)})">
          <path d="${qrSvg.pathD}" fill="${qrDarkFill}"/>
        </g>
        <text x="812" y="408" text-anchor="middle" fill="${textMuted}" font-family="Plus Jakarta Sans, sans-serif" font-size="12" font-weight="700">${qrCaption}</text>
      </svg>`;

      const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 960;
        canvas.height = 540;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const pngUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = `LOST_Summit_Passport_${expeditionCode}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
        onShowToast?.('Đã tải ảnh thẻ dấu đỉnh (PNG).', 'success');
      };
      img.onerror = () => {
        // Fallback: download clean SVG directly
        const a = document.createElement('a');
        a.href = url;
        a.download = `LOST_Summit_Passport_${expeditionCode}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        onShowToast?.('Đã tải ảnh thẻ dấu đỉnh (SVG).', 'success');
      };
      img.src = url;
    } catch {
      onShowToast?.('Chưa xuất được ảnh thẻ lúc này.', 'error');
    }
  };

  return (
    <div className="hub-container">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 14,
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div>
          <div className="section-eyebrow">Nhật ký đỉnh núi Việt Nam</div>
          <h1
            className="font-editorial"
            style={{
              fontSize: 'clamp(1.7rem, 3.2vw, 2.35rem)',
              color: 'var(--color-text-main)',
              margin: 0,
              lineHeight: 1.08,
            }}
          >
            Dấu chân qua từng đỉnh
          </h1>
          <p style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', margin: '6px 0 0 0' }}>
            Ghi lại dấu chân trên {trails.length} cung núi Việt Nam, gom dần những mốc độ cao và xem ai đang đi nhiều nhất mùa này.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCardPreview(true)}
            style={{ fontSize: '0.8rem', padding: '8px 14px' }}
          >
            <IconDownload size={15} /> Xuất thẻ dấu đỉnh PNG
          </button>
          {onBack && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={onBack}
              style={{ fontSize: '0.8rem', padding: '8px 14px' }}
            >
              <IconArrowLeft size={15} /> Quay lại
            </button>
          )}
        </div>
      </div>

      {/* Public Passport Verification Banner (?verify=LS-XXXXXX) */}
      {verifyCode && (
        <div
          className="card"
          style={{
            padding: '16px 18px',
            marginBottom: 18,
            borderLeft: `4px solid ${verifyResult?.status === 'error' ? 'var(--color-error)' : 'var(--color-primary)'}`,
            background:
              verifyResult?.status === 'error'
                ? 'var(--banner-danger-bg)'
                : 'color-mix(in srgb, var(--color-primary) 9%, var(--color-bg-card))',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <IconShieldCheck
                size={18}
                color={verifyResult?.status === 'error' ? 'var(--color-error-text, var(--color-error))' : 'var(--color-primary)'}
              />
              <strong style={{ fontSize: '0.92rem', color: 'var(--color-text-main)' }}>
                {isVerifyingPassport
                  ? `Đang kiểm tra mã sổ dấu ${verifyCode}...`
                  : verifyResult?.status === 'verified' && verifyResult.data
                    ? `Sổ dấu đỉnh đã xác thực · ${verifyResult.data.expeditionCode}`
                    : `Không kiểm tra được mã ${verifyCode}`}
              </strong>
              {verifyResult?.status === 'verified' && verifyResult.data && (
                <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>
                  {verifyResult.data.passportHolder.rankTitle}
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleDismissVerifyBanner}
              aria-label="Đóng bảng xác minh hộ chiếu"
              style={{ padding: '4px 7px' }}
            >
              <IconX size={14} />
            </button>
          </div>

          {verifyResult?.status === 'error' && (
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--banner-danger-text)' }}>
              {verifyResult.errorMessage}
            </p>
          )}

          {verifyResult?.status === 'verified' && verifyResult.data && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                    {verifyResult.data.passportHolder.fullName}
                    {verifyResult.data.passportHolder.username ? (
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)', marginLeft: 6 }}>
                        @{verifyResult.data.passportHolder.username}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                    {verifyResult.data.summary.totalStampedPeaks}/{verifyResult.data.summary.totalAvailableTrails} đỉnh ({verifyResult.data.summary.verifiedGpsPeaks} GPS xác thực) ·{' '}
                    {verifyResult.data.summary.totalUniqueKm.toLocaleString('vi-VN')} km · +{verifyResult.data.summary.totalUniqueGainM.toLocaleString('vi-VN')}m ·{' '}
                    Đỉnh cao nhất: <strong style={{ color: 'var(--color-primary)' }}>{verifyResult.data.summary.highestPeakName} ({verifyResult.data.summary.highestAltitudeM.toLocaleString('vi-VN')}m)</strong>
                  </div>
                </div>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-sky)', fontVariantNumeric: 'tabular-nums' }}>
                  {verifyResult.data.summary.claimedChallengesCount} thử thách · {verifyResult.data.passportHolder.reputationScore.toLocaleString('vi-VN')} điểm uy tín
                </div>
              </div>

              {verifyResult.data.topPeaks.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {verifyResult.data.topPeaks.map((pk) => (
                    <span
                      key={pk.trailSlug}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: 'var(--color-bg-main)',
                        border: pk.verified ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                        color: pk.verified ? 'var(--color-primary)' : 'var(--color-text-main)',
                      }}
                    >
                      {pk.verified ? <IconShieldCheck size={11} color="var(--color-primary)" /> : <IconMountain size={11} />}
                      <span>{pk.trailName} ({pk.maxAltitudeM.toLocaleString('vi-VN')}m)</span>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Hairline Telemetry Strip */}
      <div className="editorial-stat-strip" style={{ marginBottom: 20 }}>
        <div className="editorial-stat-cell">
          <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-dim)', fontWeight: 700 }}>
            Đỉnh đã qua
          </div>
          <div className="font-editorial" style={{ fontSize: '1.7rem', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {conqueredTrails.length}/{trails.length}
          </div>
          <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)' }}>
            {verifiedStampsCount} đỉnh có GPS xác thực
          </div>
        </div>

        <div className="editorial-stat-cell">
          <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-dim)', fontWeight: 700 }}>
            Độ dốc đã leo
          </div>
          <div className="font-editorial" style={{ fontSize: '1.7rem', color: 'var(--color-sun)', fontVariantNumeric: 'tabular-nums' }}>
            +{totalElevationGainM.toLocaleString('vi-VN')}m
          </div>
          <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)' }}>
            Tổng quãng đường {totalUniqueKm.toLocaleString('vi-VN')} km
          </div>
        </div>

        <div className="editorial-stat-cell">
          <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-dim)', fontWeight: 700 }}>
            Đỉnh cao nhất
          </div>
          <div className="font-editorial" style={{ fontSize: '1.7rem', color: 'var(--color-sky)', fontVariantNumeric: 'tabular-nums' }}>
            {highestPeak ? `${highestPeak.maxAltitudeM.toLocaleString('vi-VN')}m` : '0m'}
          </div>
          <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {highestPeak ? highestPeak.name : 'Chưa ghi dấu đỉnh nào'}
          </div>
        </div>

        <div className="editorial-stat-cell">
          <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-dim)', fontWeight: 700 }}>
            Thử thách đã đạt
          </div>
          <div className="font-editorial" style={{ fontSize: '1.7rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
            {challenges.filter((c) => c.isCompleted).length}/{challenges.length}
          </div>
          <div style={{ fontSize: '0.73rem', color: 'var(--color-primary)' }}>
            {challenges.filter((c) => c.isClaimed).length} huy hiệu đã nhận
          </div>
        </div>
      </div>

      {/* Elevation Gain Milestones Ladder */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <IconMountain size={16} color="var(--color-primary)" />
            Các mốc độ cao đã leo
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            Hiện tại: <strong style={{ color: 'var(--color-primary)' }}>+{totalElevationGainM.toLocaleString('vi-VN')}m</strong> / 50.000m
          </span>
        </div>
        <div className="hub-grid-4">
          {ELEVATION_MILESTONES.map((ms) => {
            const pct = Math.min(100, Math.round((totalElevationGainM / ms.targetM) * 100));
            const reached = totalElevationGainM >= ms.targetM;
            return (
              <div
                key={ms.targetM}
                style={{
                  background: reached
                    ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-main))'
                    : 'var(--color-bg-main)',
                  border: `1px solid ${reached ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: 4,
                  padding: '10px 12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: reached ? 'var(--color-primary)' : 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                    {ms.targetM.toLocaleString('vi-VN')}m
                  </span>
                  {reached ? (
                    <IconCheckCircle size={14} color="var(--color-primary)" />
                  ) : (
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                  )}
                </div>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 6 }}>
                  {ms.title}
                </div>
                <div style={{ width: '100%', height: 4, background: 'var(--color-bg-card)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: reached ? 'var(--color-primary)' : 'var(--color-sky)' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sub-Tabs with Liquid Glider */}
      <div ref={passportTabTrackRef} className="editorial-tabs-bar has-glider">
        <span aria-hidden="true" className="lost-glider-tab" style={passportTabIndicatorStyle} />
        {(
          [
            { id: 'challenges', label: 'Thử thách gom đỉnh', count: challenges.length },
            { id: 'passport', label: `Đóng dấu ${trails.length} đỉnh`, count: trails.length },
            { id: 'leaderboard', label: 'Anh em đi nhiều', count: leaderboard.length },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-glider-active={activeTab === tab.id ? 'true' : undefined}
            onClick={() => setActiveTab(tab.id)}
            className={`editorial-tab-btn${activeTab === tab.id ? ' active' : ''}`}
          >
            <span>{tab.label}</span>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 3,
                background: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
                color: activeTab === tab.id ? 'var(--color-on-primary)' : 'var(--color-text-dim)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* TAB 1: SUMMIT CHALLENGES */}
      {activeTab === 'challenges' && (
        <div className="hub-grid-2 tab-content-slide">
          {loading && challenges.length === 0 ? (
            <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Đang tải danh sách thử thách...
            </div>
          ) : (
            challenges.map((ch) => {
              const tierStyle = TIER_META[ch.tier] || TIER_META.silver;
              return (
                <article
                  key={ch.slug}
                  className="card"
                  style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                >
                  <div style={{ height: 150, position: 'relative', overflow: 'hidden', background: 'var(--color-surface-elevated)' }}>
                    <img
                      decoding="async"
                      src={ch.coverImage || DEFAULT_VIETNAM_TRAIL_COVER}
                      alt={ch.title}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        if (img.dataset.fallbackApplied === '1') return;
                        img.dataset.fallbackApplied = '1';
                        img.src = DEFAULT_VIETNAM_TRAIL_COVER;
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'linear-gradient(to top, var(--overlay-bg) 0%, color-mix(in srgb, var(--overlay-bg) 32%, transparent) 60%, transparent 100%)',
                      }}
                    />
                    <div style={{ position: 'absolute', top: 10, left: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          background: 'var(--overlay-bg)',
                          color: tierStyle.color,
                          border: `1px solid ${tierStyle.color}`,
                          padding: '2px 8px',
                          borderRadius: 3,
                          fontSize: '0.68rem',
                          fontWeight: 800,
                        }}
                      >
                        {tierStyle.label}
                      </span>
                      <span
                        style={{
                          background: 'var(--overlay-bg)',
                          color: 'var(--color-on-media)',
                          border: '1px solid color-mix(in srgb, var(--color-on-media) 22%, transparent)',
                          padding: '2px 8px',
                          borderRadius: 3,
                          fontSize: '0.68rem',
                          fontWeight: 700,
                        }}
                      >
                        {ch.region}
                      </span>
                    </div>
                    <div style={{ position: 'absolute', top: 10, right: 12 }}>
                      <span
                        style={{
                          background: 'var(--color-primary)',
                          color: 'var(--color-on-primary)',
                          padding: '2px 8px',
                          borderRadius: 3,
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        +{ch.rewardPoints} PTS
                      </span>
                    </div>
                    <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12 }}>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-on-media)' }}>
                        {ch.title}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--color-on-media)', opacity: 0.86 }}>
                        {ch.subtitle}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                      {ch.description}
                    </p>

                    {/* Progress bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: 5 }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>
                          Tiến độ: {ch.progressCount.toLocaleString('vi-VN')}/{ch.targetCount.toLocaleString('vi-VN')} {getChallengeMetricUnit(ch.ruleType)}
                        </span>
                        <span style={{ fontWeight: 800, color: ch.isCompleted ? 'var(--color-primary)' : 'var(--color-sky)', fontVariantNumeric: 'tabular-nums' }}>
                          {ch.progressPercent}%
                        </span>
                      </div>
                      <div style={{ width: '100%', height: 6, background: 'var(--color-bg-main)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                        <div
                          style={{
                            width: `${ch.progressPercent}%`,
                            height: '100%',
                            background: ch.isCompleted ? 'var(--color-primary)' : 'var(--color-sky)',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>

                    {/* Required peak chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {ch.requiredTrailSlugs.map((slug) => {
                        const trailObj = trailBySlug.get(slug);
                        const done = ch.completedTrailSlugs.includes(slug);
                        return (
                          <button
                            key={slug}
                            type="button"
                            onClick={() => {
                              if (trailObj && onSelectTrail) onSelectTrail(trailObj);
                            }}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 4,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: trailObj && onSelectTrail ? 'pointer' : 'default',
                              background: done
                                ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)'
                                : 'var(--color-bg-main)',
                              border: `1px solid ${done ? 'var(--color-primary)' : 'var(--color-border)'}`,
                              color: done ? 'var(--color-primary)' : 'var(--color-text-muted)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {done ? <IconCheck size={11} color="var(--color-primary)" /> : <IconMountain size={11} />}
                            <span>{trailObj ? trailObj.name.split(' - ')[0].split(' (')[0] : slug}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Footer action */}
                    <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <IconSparkles size={13} color={tierStyle.color} /> Huy hiệu: <strong style={{ color: 'var(--color-text-main)' }}>{ch.badgeName}</strong>
                      </span>

                      {ch.isClaimed ? (
                        <span className="badge badge-success">
                          <IconCheckCircle size={12} /> Đã nhận huy hiệu
                        </span>
                      ) : ch.isCompleted ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={claimingSlug === ch.slug}
                          onClick={() => void handleClaimChallenge(ch)}
                          style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                        >
                          {claimingSlug === ch.slug ? 'Đang lưu...' : 'Nhận huy hiệu'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <IconLock size={12} /> Cần thêm {Math.max(0, ch.targetCount - ch.progressCount).toLocaleString('vi-VN')} {getChallengeMetricUnit(ch.ruleType)}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: STAMP PASSPORT GRID ACROSS ALL VIETNAM PEAKS */}
      {activeTab === 'passport' && (
        <div className="tab-content-slide">
          <div className="card" style={{ padding: 14, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['Tất cả', 'Miền Bắc', 'Miền Trung', 'Miền Nam'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`btn ${regionFilter === r ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setRegionFilter(r)}
                    style={{ fontSize: '0.78rem', padding: '5px 12px' }}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div style={{ position: 'relative', minWidth: 220, flex: '1 1 220px', maxWidth: 320 }}>
                <IconSearch
                  size={15}
                  color="var(--color-text-dim)"
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  className="form-input"
                  aria-label="Tìm đỉnh núi hoặc tỉnh thành trong hộ chiếu"
                  placeholder="Tìm đỉnh núi, tỉnh thành..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', paddingLeft: 32, paddingTop: 6, paddingBottom: 6, fontSize: '0.8rem' }}
                />
              </div>
            </div>
          </div>

          <div className="hub-grid-3">
            {filteredPassportTrails.map((trail) => {
              const stamp = stampedMap[String(trail.id)] || stampedMap[String((trail as TrailWithMongoId)._id || '')];
              const isStamped = Boolean(stamp);
              return (
                <div
                  key={trail.id}
                  className="card"
                  style={{
                    padding: 16,
                    borderColor: isStamped ? 'var(--color-primary)' : 'var(--color-border)',
                    background: isStamped
                      ? 'color-mix(in srgb, var(--color-primary) 5%, var(--color-bg-card))'
                      : 'var(--color-bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {trail.province} · {trail.region}
                      </div>
                      <h3 style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '3px 0 0 0', lineHeight: 1.3 }}>
                        {trail.name}
                      </h3>
                    </div>

                    {/* Pure SVG Topo Stamp Seal */}
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 56 56"
                      style={{ flexShrink: 0, opacity: isStamped ? 1 : 0.35 }}
                      aria-label={isStamped ? 'Đã đóng dấu' : 'Chưa chinh phục'}
                    >
                      <circle
                        cx="28"
                        cy="28"
                        r="25"
                        fill={isStamped ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'none'}
                        stroke={isStamped ? 'var(--color-primary)' : 'var(--color-text-dim)'}
                        strokeWidth="2"
                        strokeDasharray={isStamped ? 'none' : '4 3'}
                      />
                      <circle
                        cx="28"
                        cy="28"
                        r="20"
                        fill="none"
                        stroke={isStamped ? 'var(--color-primary)' : 'var(--color-border-strong)'}
                        strokeWidth="1"
                      />
                      <path
                        d="M15 35 L24 20 L30 29 L34 23 L42 35 Z"
                        fill="none"
                        stroke={isStamped ? 'var(--color-primary)' : 'var(--color-text-dim)'}
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                      <text
                        x="28"
                        y="44"
                        textAnchor="middle"
                        fill={isStamped ? 'var(--color-primary)' : 'var(--color-text-dim)'}
                        fontSize="7.5"
                        fontWeight="800"
                      >
                        {trail.maxAltitudeM}M
                      </text>
                    </svg>
                  </div>

                  <div style={{ display: 'flex', gap: 10, fontSize: '0.75rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', flexWrap: 'wrap' }}>
                    <span>Đỉnh: <strong style={{ color: 'var(--color-text-main)' }}>{trail.maxAltitudeM.toLocaleString('vi-VN')}m</strong></span>
                    <span>· Cự ly: <strong>{trail.distanceKm} km</strong></span>
                    <span>· Dốc: <strong>+{trail.elevationGainM}m</strong></span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--color-border)', gap: 8, flexWrap: 'wrap' }}>
                    {isStamped ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className="badge badge-success">
                          <IconShieldCheck size={12} /> {stamp.verifiedBadge ? 'Có GPS xác thực' : 'Đã đóng dấu'}
                        </span>
                        {!stamp.verifiedBadge && (
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => {
                              setCheckinModalTrail(trail);
                              setCheckinOpenedAtMs(Date.now());
                              setCheckinHours(String(stamp.completionTimeHours || Math.max(4, (trail.durationDays || 1) * 7)));
                              setCheckinGps(null);
                              setCheckinGpxTrack([]);
                              setCheckinGpxMeta(null);
                            }}
                            style={{ padding: '4px 9px', fontSize: '0.72rem', color: 'var(--color-sky)' }}
                            title="Gắn tọa độ GPS hoặc tệp .GPX để xác thực dấu đỉnh này"
                          >
                            <IconMapPin size={11} color="var(--color-sky)" /> Xác thực GPS / GPX
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          setCheckinModalTrail(trail);
                          setCheckinOpenedAtMs(Date.now());
                          setCheckinHours(String(Math.max(4, (trail.durationDays || 1) * 7)));
                          setCheckinGps(null);
                          setCheckinGpxTrack([]);
                          setCheckinGpxMeta(null);
                        }}
                        style={{ padding: '5px 10px', fontSize: '0.74rem' }}
                      >
                        <IconMapPin size={12} /> Đóng dấu đỉnh
                      </button>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {isStamped && stamp && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setShareCardTarget({ trail, stamp })}
                          style={{ padding: '5px 9px', fontSize: '0.74rem' }}
                          title={`Xuất thẻ ảnh PNG chuyến đi ${trail.name}`}
                        >
                          <IconImage size={12} /> Thẻ PNG
                        </button>
                      )}
                      {onSelectTrail && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => onSelectTrail(trail)}
                          style={{ padding: '5px 10px', fontSize: '0.74rem' }}
                        >
                          Xem cung
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: SUMMIT LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <div className="card tab-content-slide" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                Những bước chân đi nhiều nhất
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                Tính từ các đỉnh đã đóng dấu và xác thực GPS trên LOST.
              </p>
            </div>
            <select
              className="form-select"
              value={leaderboardRegion}
              onChange={(e) => setLeaderboardRegion(e.target.value)}
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              aria-label="Lọc bảng xếp hạng theo vùng miền"
            >
              <option value="">Toàn quốc</option>
              <option value="Miền Bắc">Miền Bắc</option>
              <option value="Miền Trung">Miền Trung</option>
              <option value="Miền Nam">Miền Nam</option>
            </select>
          </div>

          {leaderboard.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: 4, fontSize: '0.84rem' }}>
              Chưa có ai ghi dấu ở khu vực này — bạn mở hàng trước nhé?
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {leaderboard.map((row) => (
                <div
                  key={row.userId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 4,
                    background:
                      row.rank <= 3
                        ? 'color-mix(in srgb, var(--color-primary) 7%, var(--color-bg-main))'
                        : 'var(--color-bg-main)',
                    border: `1px solid ${row.rank === 1 ? 'var(--color-sun)' : 'var(--color-border)'}`,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        fontVariantNumeric: 'tabular-nums',
                        background:
                          row.rank === 1
                            ? 'var(--color-sun)'
                            : row.rank === 2
                              ? 'var(--color-sky)'
                              : row.rank === 3
                                ? 'var(--color-earth)'
                                : 'var(--color-bg-card)',
                        color: row.rank <= 3 ? 'var(--color-on-primary)' : 'var(--color-text-main)',
                        border: '1px solid var(--color-border)',
                        flexShrink: 0,
                      }}
                    >
                      #{row.rank}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--color-text-main)' }}>
                        {row.fullName}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {row.totalUniqueKm} km · Đỉnh cao nhất {row.highestAltitudeM.toLocaleString('vi-VN')}m
                        {row.totalElevationGainM > 0 ? ` · +${row.totalElevationGainM.toLocaleString('vi-VN')}m` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    <span className="badge badge-success">{row.trailsConquered} đỉnh</span>
                    <span className="badge badge-info">{row.verifiedPeaks} GPS</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STAMP CHECK-IN MODAL */}
      {checkinModalTrail &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => !submittingCheckin && setCheckinModalTrail(null)}
            style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}
          >
            <div
              ref={checkinModalRef}
              tabIndex={-1}
              className="modal-content"
              role="dialog"
              aria-modal="true"
              aria-label="Đóng dấu hộ chiếu đỉnh núi"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 460 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <IconCompass size={18} color="var(--color-primary)" /> Đóng dấu chuyến đi
                </h3>
                <button
                  type="button"
                  onClick={() => !submittingCheckin && setCheckinModalTrail(null)}
                  disabled={submittingCheckin}
                  aria-label="Đóng"
                  style={{
                    color: 'var(--color-text-muted)',
                    cursor: submittingCheckin ? 'not-allowed' : 'pointer',
                    opacity: submittingCheckin ? 0.5 : 1,
                  }}
                >
                  <IconX size={18} />
                </button>
              </div>

              <div style={{ padding: 12, background: 'var(--color-bg-main)', borderRadius: 4, border: '1px solid var(--color-border)', marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--color-text-main)' }}>
                  {checkinModalTrail.name}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
                  {checkinModalTrail.province} · {checkinModalTrail.maxAltitudeM}m · {checkinModalTrail.distanceKm} km
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="passport-checkin-hours">Bạn đi hết bao nhiêu giờ?</label>
                <input
                  id="passport-checkin-hours"
                  type="number"
                  min={0.5}
                  max={240}
                  step={0.5}
                  className="form-input"
                  value={checkinHours}
                  onChange={(e) => setCheckinHours(e.target.value)}
                />
              </div>

              {(() => {
                const existingStamp =
                  stampedMap[String(checkinModalTrail.id)] ||
                  stampedMap[String((checkinModalTrail as TrailWithMongoId)._id || '')];
                if (!existingStamp || existingStamp.verifiedBadge || !existingStamp.checkinDate || !checkinOpenedAtMs) return null;
                const elapsedMs = checkinOpenedAtMs - new Date(existingStamp.checkinDate).getTime();
                const cooldownMs = 12 * 60 * 60 * 1000;
                if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs >= cooldownMs) return null;
                const hoursLeft = Math.max(1, Math.ceil((cooldownMs - elapsedMs) / (60 * 60 * 1000)));
                return (
                  <div
                    role="note"
                    style={{
                      padding: '9px 11px',
                      borderRadius: 4,
                      marginBottom: 14,
                      fontSize: '0.75rem',
                      lineHeight: 1.5,
                      color: 'var(--color-text-main)',
                      background: 'color-mix(in srgb, var(--color-sun) 12%, var(--color-bg-main))',
                      border: '1px solid color-mix(in srgb, var(--color-sun) 38%, var(--color-border))',
                    }}
                  >
                    Bạn vừa đóng dấu cung này trong 12 giờ qua. Máy chủ áp dụng thời gian chờ chống trùng lặp còn khoảng{' '}
                    <strong>{hoursLeft} giờ</strong> — sau đó bạn có thể tải tệp <code>.GPX</code> hoặc gắn tọa độ GPS để nâng cấp dấu xác thực.
                  </div>
                );
              })()}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <button
                  type="button"
                  className={`btn ${checkinGps ? 'btn-primary' : 'btn-outline'}`}
                  onClick={handleCaptureGps}
                  disabled={capturingGps}
                  style={{ width: '100%', fontSize: '0.8rem' }}
                >
                  <IconShieldCheck size={15} />
                  {capturingGps
                    ? 'Đang bắt sóng vệ tinh GPS...'
                    : checkinGps
                      ? `Đã lấy GPS (${checkinGps.lat.toFixed(4)}, ${checkinGps.lng.toFixed(4)})`
                      : 'Gắn tọa độ GPS thực địa'}
                </button>

                <input
                  ref={checkinGpxInputRef}
                  type="file"
                  accept=".gpx,application/gpx+xml,text/xml"
                  onChange={(ev) => void handleSelectCheckinGpx(ev)}
                  style={{ display: 'none' }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className={`btn ${checkinGpxMeta ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => checkinGpxInputRef.current?.click()}
                    disabled={parsingCheckinGpx}
                    style={{ flex: 1, fontSize: '0.8rem' }}
                  >
                    <IconCompass size={15} />
                    {parsingCheckinGpx
                      ? 'Đang đọc tệp GPX...'
                      : checkinGpxMeta
                        ? `GPX: ${checkinGpxMeta.fileName} (${checkinGpxMeta.distanceKm} km)`
                        : 'Đính kèm tệp .GPX xác thực đỉnh'}
                  </button>
                  {checkinGpxMeta && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      aria-label="Gỡ tệp GPX đã chọn"
                      onClick={() => {
                        setCheckinGpxTrack([]);
                        setCheckinGpxMeta(null);
                      }}
                      style={{ padding: '0 10px' }}
                    >
                      <IconX size={14} />
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '0.71rem', color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
                  Hỗ trợ xác thực ngoại tuyến bằng tracklog <code>.gpx</code> ghi từ đồng hồ thể thao hoặc ứng dụng GPS (đi qua bán kính 1,5 km quanh tuyến).
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setCheckinModalTrail(null)}
                  disabled={submittingCheckin}
                  style={{ flex: 1 }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleConfirmStampCheckin()}
                  disabled={submittingCheckin}
                  style={{ flex: 1.4 }}
                >
                  {submittingCheckin ? 'Đang lưu...' : 'Lưu dấu đỉnh'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* PASSPORT CARD EXPORT PREVIEW MODAL */}
      {showCardPreview &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => setShowCardPreview(false)}
            style={{ zIndex: 'var(--z-modal, 3000)' as unknown as number }}
          >
            <div
              ref={cardPreviewModalRef}
              tabIndex={-1}
              className="modal-content"
              role="dialog"
              aria-modal="true"
              aria-label="Thẻ Hộ Chiếu Đỉnh Núi LOST"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 580 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                  Thẻ dấu đỉnh của bạn
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCardPreview(false)}
                  aria-label="Đóng"
                  style={{ color: 'var(--color-text-muted)', cursor: 'pointer' }}
                >
                  <IconX size={18} />
                </button>
              </div>

              <div
                style={{
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border-strong)',
                  borderTop: '3px solid var(--color-primary)',
                  borderRadius: 6,
                  padding: 18,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                      LOST VIETNAM · SỔ DẤU ĐỈNH
                    </div>
                    <div className="font-editorial" style={{ fontSize: '1.45rem', color: 'var(--color-text-main)', marginTop: 4 }}>
                      {currentUser?.fullName || currentUser?.username || 'Trekker LOST'}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                      Mã #{expeditionCode} · {conqueredTrails.length}/{trails.length} đỉnh · +{totalElevationGainM.toLocaleString('vi-VN')}m
                    </div>
                    <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--color-text-main)' }}>
                      Đỉnh cao nhất:{' '}
                      <strong style={{ color: 'var(--color-primary)' }}>
                        {highestPeak ? `${highestPeak.name} (${highestPeak.maxAltitudeM}m)` : 'Chưa đóng dấu'}
                      </strong>
                    </div>
                    {!hasVerifiedAccountCode && (
                      <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--color-text-dim)' }}>
                        Đăng nhập tài khoản LOST để cấp mã QR xác thực chính chủ.
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      width: 104,
                      height: 104,
                      padding: 6,
                      borderRadius: 4,
                      background: 'var(--color-on-media)',
                      border: '1px solid var(--color-border-strong)',
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      width="100%"
                      height="100%"
                      viewBox={`0 0 ${qrSvg.viewBoxSize} ${qrSvg.viewBoxSize}`}
                      shapeRendering="crispEdges"
                      aria-label="Mã QR Hộ Chiếu Đỉnh Núi"
                    >
                      <rect width={qrSvg.viewBoxSize} height={qrSvg.viewBoxSize} fill="var(--color-on-media)" />
                      <path
                        d={qrSvg.pathD}
                        fill={isLightTheme ? 'var(--color-text-main)' : 'var(--color-bg-main)'}
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowCardPreview(false)}
                  style={{ flex: 1 }}
                >
                  Đóng
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleDownloadPassportPng}
                  style={{ flex: 1.4 }}
                >
                  <IconDownload size={15} /> Tải ảnh thẻ PNG
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {shareCardInitialData && (
        <ExpeditionShareCardModal
          isOpen={Boolean(shareCardTarget)}
          initialData={shareCardInitialData}
          onClose={() => setShareCardTarget(null)}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
