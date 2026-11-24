import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { ForumThread, Trail, UserProfile } from '../../types.js';
import {
  IconMountain,
  IconMessageSquare,
  IconPlus,
  IconAlertTriangle,
  IconShieldCheck,
  IconShieldAlert,
  IconCompass,
  IconUsers,
  IconBookOpen,
  IconLightbulb,
  IconHelpCircle,
  IconSparkles,
  IconEye,
  IconUserPlus,
  IconCalendar,
  IconClock,
  IconStar,
  IconArrowRight,
  IconRotateCw,
  IconSearch,
  IconX,
  IconLock,
} from '../common/SvgIcons.js';
import { mockTrails } from '../../data/seedData.js';
import { FacebookReactionPicker } from './FacebookReactionPicker.js';
import type { ReactionType } from './FacebookReactionPicker.js';
import { AuthorProfileModal } from './AuthorProfileModal.js';
import type { AuthorProfileData } from './AuthorProfileModal.js';
import { ThreadDetailModal } from './ThreadDetailModal.js';
import { getApiHeaders, notifyForumUpdated } from '../../utils/sessionHeaders.js';
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator.js';
import { TripPlanCard } from '../trips/TripPlanCard.js';
import type { TripPlanItem } from '../trips/TripPlanCard.js';
import { CreateTripModal } from '../trips/CreateTripModal.js';
import type { TripBudgetDraft } from '../trips/CreateTripModal.js';
import { ExpeditionCalendarGrid } from '../trips/ExpeditionCalendarGrid.js';
import { CreateTripReportModal } from '../trip-reports/CreateTripReportModal.js';
import { TripReportCard } from '../trip-reports/TripReportCard.js';
import type { TripReportItem } from '../trip-reports/TripReportCard.js';

type ForumSortOption = 'newest' | 'popular' | 'most_commented';
type ForumThreadWithTrail = ForumThread & { trailId?: string; trailName?: string };

const FORUM_THREAD_CATEGORIES = new Set(['All', 'Kinh Nghiệm', 'Hỏi Đáp', 'Tìm Đồng Đội', 'Cảnh Báo']);

interface AlpineExpeditionFeedProps {
  threads: ForumThread[];
  isLoadingThreads?: boolean;
  currentUser?: UserProfile | null;
  onOpenNewThreadModal: () => void;
  trails?: Trail[];
  onRequireLogin?: (actionName: string) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  sortBy?: ForumSortOption;
  onSortChange?: (s: ForumSortOption) => void;
  onForumCategoryChange?: (category: string) => void;
  hasMoreThreads?: boolean;
  loadingMoreThreads?: boolean;
  onLoadMoreThreads?: () => void;
  onThreadUpdated?: (updated: ForumThread) => void;
  onThreadDeleted?: (threadId: string) => void;
}

interface CommunityActivityAuthor {
  id?: string;
  name: string;
  username?: string;
  avatar: string;
  role?: string;
  reputationScore?: number;
}

interface CommunityActivityTrail {
  id: string;
  name: string;
  province?: string;
  maxAltitudeM?: number;
  coverImage?: string;
}

interface CommunityActivityItem {
  id: string;
  type: string;
  title: string;
  targetType?: string;
  targetId?: string;
  thumbnailUrl?: string;
  createdAt: string;
  author: CommunityActivityAuthor;
  trail: CommunityActivityTrail | null;
}

interface RawCommunityActivity {
  _id?: string;
  id?: string;
  type?: string;
  title?: string;
  targetType?: string;
  targetId?: string;
  thumbnailUrl?: string;
  createdAt?: string;
  author?: {
    _id?: string;
    id?: string;
    fullName?: string;
    name?: string;
    username?: string;
    avatarUrl?: string;
    avatar?: string;
    role?: string;
    reputationScore?: number;
  };
  userId?:
  | string
  | {
    _id?: string;
    id?: string;
    fullName?: string;
    username?: string;
    avatarUrl?: string;
    role?: string;
    reputationScore?: number;
  };
  trail?: {
    id?: string;
    _id?: string;
    name?: string;
    province?: string;
    maxAltitudeM?: number;
    coverImage?: string;
  } | null;
}

const ACTIVITY_TYPE_META: Record<
  string,
  {
    label: string;
    accent: string;
    Icon: React.FC<{ size?: number; color?: string }>;
  }
> = {
  checkin_peak: { label: 'Đóng Dấu Đỉnh', accent: 'var(--color-primary)', Icon: IconMountain },
  completed_trip: { label: 'Chinh Phục Tuyến', accent: 'var(--color-primary)', Icon: IconMountain },
  earned_badge: { label: 'Mở Khóa Huy Hiệu', accent: 'var(--color-sun)', Icon: IconSparkles },
  new_trip_report: { label: 'Nhật Ký Thực Địa', accent: 'var(--color-sky)', Icon: IconBookOpen },
  joined_trip: { label: 'Tham Gia Ghép Đoàn', accent: 'var(--color-earth)', Icon: IconUsers },
  new_trip_plan: { label: 'Mở Chuyến Ghép Đoàn', accent: 'var(--color-earth)', Icon: IconUsers },
  new_contribution: { label: 'Đóng Góp Cung Mới', accent: 'var(--color-primary)', Icon: IconCompass },
  new_review: { label: 'Đánh Giá Tuyến', accent: 'var(--color-sun)', Icon: IconStar },
  followed_user: { label: 'Kết Nối Cộng Đồng', accent: 'var(--color-sky)', Icon: IconUserPlus },
};

function normalizeCommunityActivity(raw: RawCommunityActivity, idx: number): CommunityActivityItem {
  const userObj =
    raw.author || (raw.userId && typeof raw.userId === 'object' ? raw.userId : null);
  const authorId =
    userObj?._id ||
    userObj?.id ||
    (typeof raw.userId === 'string' ? raw.userId : undefined);
  const authorName =
    userObj?.fullName ||
    (raw.author?.name) ||
    userObj?.username ||
    'Trekker Cộng Đồng';

  const trailObj = raw.trail && typeof raw.trail === 'object' ? raw.trail : null;
  const resolvedTrailId = trailObj?.id || trailObj?._id || (raw.targetType === 'trail' ? raw.targetId : undefined);
  const trail: CommunityActivityTrail | null = resolvedTrailId
    ? {
      id: String(resolvedTrailId),
      name: trailObj?.name || 'Xem cung đường thực địa',
      province: trailObj?.province,
      maxAltitudeM: trailObj?.maxAltitudeM,
      coverImage: trailObj?.coverImage || raw.thumbnailUrl,
    }
    : null;

  return {
    id: String(raw._id || raw.id || `act-${idx}`),
    type: String(raw.type || 'checkin_peak'),
    title: String(raw.title || 'Hoạt động mới từ cộng đồng LOST'),
    targetType: raw.targetType,
    targetId: raw.targetId,
    thumbnailUrl: raw.thumbnailUrl || trailObj?.coverImage,
    createdAt: raw.createdAt || new Date().toISOString(),
    author: {
      id: authorId ? String(authorId) : undefined,
      name: String(authorName),
      username: userObj?.username,
      avatar: userObj?.avatarUrl || raw.author?.avatar || '',
      role: userObj?.role,
      reputationScore: userObj?.reputationScore,
    },
    trail,
  };
}

function formatActivityTimestampVn(dateStr?: string): string {
  if (!dateStr) return 'Vừa xong';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AlpineExpeditionFeed: React.FC<AlpineExpeditionFeedProps> = ({
  threads,
  isLoadingThreads = false,
  currentUser,
  onOpenNewThreadModal,
  trails,
  onRequireLogin,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  onForumCategoryChange,
  hasMoreThreads = false,
  loadingMoreThreads = false,
  onLoadMoreThreads,
  onThreadUpdated,
  onThreadDeleted,
}) => {
  const resolveInitialTabFromUrl = (): string => {
    if (typeof window === 'undefined') return 'All';
    const tab = (new URLSearchParams(window.location.search).get('tab') || '').trim().toLowerCase();
    if (tab === 'trips' || tab === 'squads') return 'Ghép Đoàn';
    if (tab === 'reports' || tab === 'diary') return 'Nhật Ký';
    if (tab === 'activities' || tab === 'feed') return 'Hoạt Động';
    return 'All';
  };
  const [selectedCategory, setSelectedCategory] = useState<string>(resolveInitialTabFromUrl);
  useEffect(() => {
    const syncTabFromUrl = () => {
      const next = resolveInitialTabFromUrl();
      if (next !== 'All') setSelectedCategory(next);
    };
    window.addEventListener('popstate', syncTabFromUrl);
    return () => window.removeEventListener('popstate', syncTabFromUrl);
  }, []);
  const { trackRef: categoryTrackRef, indicatorStyle: categoryIndicatorStyle } =
    useSlidingIndicator<string>(selectedCategory);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [localSortBy, setLocalSortBy] = useState<ForumSortOption>('newest');

  const effectiveSearchQuery = searchQuery !== undefined ? searchQuery : localSearchQuery;
  const effectiveSortBy = sortBy !== undefined ? sortBy : localSortBy;
  const isServerDrivenForum = Boolean(onSearchChange || onSortChange || onForumCategoryChange);
  const availableTrails = trails && trails.length > 0 ? trails : mockTrails;

  // Trips state (status filter + pagination)
  const [tripsViewMode, setTripsViewMode] = useState<'list' | 'calendar'>('list');
  const [tripsStatusFilter, setTripsStatusFilter] = useState<'all' | 'recruiting' | 'full' | 'mine'>('all');
  const [trips, setTrips] = useState<TripPlanItem[]>([]);
  const [tripsPage, setTripsPage] = useState<number>(1);
  const [tripsHasMore, setTripsHasMore] = useState<boolean>(false);
  const [loadingMoreTrips, setLoadingMoreTrips] = useState<boolean>(false);
  const [tripsRefreshTick, setTripsRefreshTick] = useState<number>(0);
  const [tripsLoadedKey, setTripsLoadedKey] = useState<string | null>(null);

  // Trip Reports state (trail filter + pagination)
  const [reportsTrailFilter, setReportsTrailFilter] = useState<string>('');
  const [tripReports, setTripReports] = useState<TripReportItem[]>([]);
  const [reportsPage, setReportsPage] = useState<number>(1);
  const [reportsHasMore, setReportsHasMore] = useState<boolean>(false);
  const [loadingMoreReports, setLoadingMoreReports] = useState<boolean>(false);
  const [reportsRefreshTick, setReportsRefreshTick] = useState<number>(0);
  const [reportsLoadedKey, setReportsLoadedKey] = useState<string | null>(null);

  const [isCreateTripOpen, setIsCreateTripOpen] = useState(false);
  const [tripBudgetDraft, setTripBudgetDraft] = useState<TripBudgetDraft | null>(null);
  const [isCreateReportOpen, setIsCreateReportOpen] = useState(false);

  // Community Activity Feed state (Wave 9E)
  const [activityScope, setActivityScope] = useState<'all' | 'following'>('all');
  const [activities, setActivities] = useState<CommunityActivityItem[]>([]);
  const [activitiesLoadedKey, setActivitiesLoadedKey] = useState<string | null>(null);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  const [activitiesPage, setActivitiesPage] = useState<number>(1);
  const [activitiesHasMore, setActivitiesHasMore] = useState<boolean>(false);
  const [loadingMoreActivities, setLoadingMoreActivities] = useState<boolean>(false);
  const [activityRefreshTick, setActivityRefreshTick] = useState<number>(0);
  const [nowMs] = useState<number>(() => Date.now());

  // Modals & deep-link state
  const [activeAuthor, setActiveAuthor] = useState<AuthorProfileData | null>(null);
  const [selectedThread, setActiveThread] = useState<ForumThreadWithTrail | null>(null);
  const [pendingUrlThreadId, setPendingUrlThreadId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('threadId') : null
  );
  const [deepLinkedThread, setDeepLinkedThread] = useState<{ id: string; thread: ForumThreadWithTrail } | null>(null);

  // Per thread reaction override state map
  const [threadReactions, setThreadReactions] = useState<{ [threadId: string]: ReactionType }>({});
  const [threadCommentCounts, setThreadCommentCounts] = useState<{ [threadId: string]: number }>({});
  const [threadUpvotesMap, setThreadUpvotesMap] = useState<{ [threadId: string]: number }>({});
  const [threadReactionsSummaryMap, setThreadReactionsSummaryMap] = useState<{ [threadId: string]: Record<string, number> }>({});

  const currentUserId = String(currentUser?.id || (currentUser as (UserProfile & { _id?: string }) | null)?._id || '');

  const tripsFetchKey =
    selectedCategory === 'Ghép Đoàn'
      ? `${tripsStatusFilter}:${currentUserId || 'guest'}:${tripsRefreshTick}`
      : null;
  const reportsFetchKey =
    selectedCategory === 'Nhật Ký'
      ? `${reportsTrailFilter}:${reportsRefreshTick}`
      : null;

  const loadingTrips = Boolean(tripsFetchKey) && tripsLoadedKey !== tripsFetchKey;
  const loadingReports = Boolean(reportsFetchKey) && reportsLoadedKey !== reportsFetchKey;

  const loadTrips = useCallback(() => {
    setTripsRefreshTick((prev) => prev + 1);
  }, []);

  const loadTripReports = useCallback(() => {
    setReportsRefreshTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!tripsFetchKey) return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set('limit', '12');
    params.set('page', '1');
    if (tripsStatusFilter === 'mine') {
      params.set('status', 'all');
      params.set('mine', 'true');
    } else {
      params.set('status', tripsStatusFilter);
    }

    fetch(`/api/trips?${params.toString()}`, { headers: getApiHeaders(), signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted && data.success) {
          const list: TripPlanItem[] = Array.isArray(data.data) ? data.data : [];
          setTrips(list);
          setTripsPage(1);
          const pag = data.pagination;
          setTripsHasMore(
            Boolean(
              pag &&
              ((typeof pag.hasMore === 'boolean' && pag.hasMore) ||
                (typeof pag.totalPages === 'number' && pag.totalPages > 1) ||
                (typeof pag.total === 'number' && list.length < pag.total))
            )
          );
        }
      })
      .catch(() => {
        // keep existing state on error
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setTripsLoadedKey(tripsFetchKey);
        }
      });
    return () => controller.abort();
  }, [tripsFetchKey, tripsStatusFilter]);

  const handleLoadMoreTrips = async () => {
    if (loadingMoreTrips || !tripsHasMore) return;
    const nextPage = tripsPage + 1;
    setLoadingMoreTrips(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '12');
      params.set('page', String(nextPage));
      if (tripsStatusFilter === 'mine') {
        params.set('status', 'all');
        params.set('mine', 'true');
      } else {
        params.set('status', tripsStatusFilter);
      }
      const res = await fetch(`/api/trips?${params.toString()}`, { headers: getApiHeaders() });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data)) {
        const incoming: TripPlanItem[] = data.data;
        setTrips((prev) => {
          const seen = new Set(prev.map((t) => t._id));
          return [...prev, ...incoming.filter((t) => !seen.has(t._id))];
        });
        setTripsPage(nextPage);
        const pag = data.pagination;
        setTripsHasMore(
          Boolean(
            incoming.length > 0 &&
            pag &&
            ((typeof pag.hasMore === 'boolean' && pag.hasMore) ||
              (typeof pag.totalPages === 'number' && nextPage < pag.totalPages))
          )
        );
      }
    } catch {
      // keep existing items
    } finally {
      setLoadingMoreTrips(false);
    }
  };

  useEffect(() => {
    if (!reportsFetchKey) return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set('limit', '9');
    params.set('page', '1');
    if (reportsTrailFilter) params.set('trailId', reportsTrailFilter);

    fetch(`/api/trip-reports?${params.toString()}`, { headers: getApiHeaders(), signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted && data.success) {
          const list: TripReportItem[] = Array.isArray(data.data) ? data.data : [];
          setTripReports(list);
          setReportsPage(1);
          const pag = data.pagination;
          setReportsHasMore(
            Boolean(
              pag &&
              ((typeof pag.hasMore === 'boolean' && pag.hasMore) ||
                (typeof pag.totalPages === 'number' && pag.totalPages > 1) ||
                (typeof pag.total === 'number' && list.length < pag.total))
            )
          );
        }
      })
      .catch(() => {
        // keep existing state on error
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setReportsLoadedKey(reportsFetchKey);
        }
      });
    return () => controller.abort();
  }, [reportsFetchKey, reportsTrailFilter]);

  const handleLoadMoreReports = async () => {
    if (loadingMoreReports || !reportsHasMore) return;
    const nextPage = reportsPage + 1;
    setLoadingMoreReports(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '9');
      params.set('page', String(nextPage));
      if (reportsTrailFilter) params.set('trailId', reportsTrailFilter);
      const res = await fetch(`/api/trip-reports?${params.toString()}`, { headers: getApiHeaders() });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data)) {
        const incoming: TripReportItem[] = data.data;
        setTripReports((prev) => {
          const seen = new Set(prev.map((r) => r._id));
          return [...prev, ...incoming.filter((r) => !seen.has(r._id))];
        });
        setReportsPage(nextPage);
        const pag = data.pagination;
        setReportsHasMore(
          Boolean(
            incoming.length > 0 &&
            pag &&
            ((typeof pag.hasMore === 'boolean' && pag.hasMore) ||
              (typeof pag.totalPages === 'number' && nextPage < pag.totalPages))
          )
        );
      }
    } catch {
      // keep existing items
    } finally {
      setLoadingMoreReports(false);
    }
  };

  const activityFetchKey =
    selectedCategory === 'Hoạt Động'
      ? `${activityScope}:${currentUserId || 'guest'}:${activityRefreshTick}`
      : null;
  const isFollowingGuestGate =
    selectedCategory === 'Hoạt Động' &&
    activityScope === 'following' &&
    !currentUser &&
    (typeof window === 'undefined' || !localStorage.getItem('lost_token'));
  const loadingActivities =
    Boolean(activityFetchKey) && !isFollowingGuestGate && activitiesLoadedKey !== activityFetchKey;

  // Fetch Community Social Activity Feed with AbortController (GET /api/activities/community?scope=...)
  useEffect(() => {
    if (!activityFetchKey || isFollowingGuestGate) return;
    const controller = new AbortController();

    fetch(`/api/activities/community?scope=${encodeURIComponent(activityScope)}&limit=25&page=1`, {
      headers: getApiHeaders(),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((json) => {
        if (controller.signal.aborted) return;
        const rawList: RawCommunityActivity[] = Array.isArray(json?.data) ? json.data : [];
        setActivities(rawList.map(normalizeCommunityActivity));
        setActivitiesPage(1);
        const pag = json?.pagination;
        const hasMore = Boolean(
          pag &&
          ((typeof pag.hasMore === 'boolean' && pag.hasMore) ||
            (typeof pag.page === 'number' && typeof pag.totalPages === 'number' && pag.page < pag.totalPages) ||
            (typeof pag.total === 'number' && rawList.length < pag.total))
        );
        setActivitiesHasMore(hasMore);
        setActivitiesError(null);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setActivities([]);
        setActivitiesHasMore(false);
        setActivitiesError('Không thể tải dòng hoạt động cộng đồng lúc này.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setActivitiesLoadedKey(activityFetchKey);
        }
      });

    return () => controller.abort();
  }, [activityFetchKey, activityScope, isFollowingGuestGate]);

  const handleLoadMoreActivities = async () => {
    if (loadingMoreActivities || !activitiesHasMore) return;
    const nextPage = activitiesPage + 1;
    setLoadingMoreActivities(true);
    try {
      const res = await fetch(
        `/api/activities/community?scope=${encodeURIComponent(activityScope)}&limit=25&page=${nextPage}`,
        { headers: getApiHeaders() }
      );
      if (res.ok) {
        const json = await res.json();
        const rawList: RawCommunityActivity[] = Array.isArray(json?.data) ? json.data : [];
        const mapped = rawList.map((item, idx) => normalizeCommunityActivity(item, nextPage * 100 + idx));
        setActivities((prev) => {
          const seen = new Set(prev.map((a) => a.id));
          return [...prev, ...mapped.filter((m) => !seen.has(m.id))];
        });
        setActivitiesPage(nextPage);
        const pag = json?.pagination;
        setActivitiesHasMore(
          Boolean(
            rawList.length > 0 &&
            pag &&
            ((typeof pag.hasMore === 'boolean' && pag.hasMore) ||
              (typeof pag.totalPages === 'number' && nextPage < pag.totalPages))
          )
        );
      }
    } catch {
      // keep existing items on transient error
    } finally {
      setLoadingMoreActivities(false);
    }
  };

  const navigateToTrailPage = (trailSlug: string) => {
    if (!trailSlug) return;
    const targetUrl = `/trails/${encodeURIComponent(trailSlug)}`;
    window.history.pushState({ view: 'detail', trailId: trailSlug }, '', targetUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Consume Cost Estimator -> Trip Budget handoff from sessionStorage or live CustomEvent
  useEffect(() => {
    const consumeDraftPayload = (draft: TripBudgetDraft | null) => {
      if (!draft || (!draft.trailId && !draft.budgetNote)) return;
      try {
        sessionStorage.removeItem('lost_trip_budget_draft');
      } catch {
        // ignore storage errors
      }
      setSelectedCategory('Ghép Đoàn');
      setTripBudgetDraft({
        trailId: draft.trailId,
        budgetNote: draft.budgetNote,
      });
      setIsCreateTripOpen(true);
    };

    try {
      const raw = sessionStorage.getItem('lost_trip_budget_draft');
      if (raw) {
        const parsed = JSON.parse(raw) as { trailId?: string; budgetNote?: string; ts?: number };
        sessionStorage.removeItem('lost_trip_budget_draft');
        const isFresh = !parsed.ts || Date.now() - Number(parsed.ts) < 10 * 60 * 1000;
        if (isFresh && (parsed.trailId || parsed.budgetNote)) {
          window.requestAnimationFrame(() => consumeDraftPayload(parsed));
        }
      }
    } catch {
      // ignore malformed draft
    }

    const handleBudgetEvent = (ev: Event) => {
      const detail = (ev as CustomEvent<TripBudgetDraft>)?.detail;
      if (detail && (detail.trailId || detail.budgetNote)) {
        consumeDraftPayload(detail);
      }
    };

    const handleReportUpdated = (ev: Event) => {
      const updated = (ev as CustomEvent<TripReportItem>)?.detail;
      if (updated?._id) {
        setTripReports((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
      }
    };

    const handleReportDeleted = (ev: Event) => {
      const detail = (ev as CustomEvent<{ reportId?: string }>)?.detail;
      if (detail?.reportId) {
        setTripReports((prev) => prev.filter((r) => r._id !== detail.reportId));
      }
    };

    const handleFollowChanged = () => {
      setActivityRefreshTick((t) => t + 1);
    };

    const handlePopState = () => {
      const urlThreadId = new URLSearchParams(window.location.search).get('threadId');
      setPendingUrlThreadId(urlThreadId);
    };

    window.addEventListener('lost:start-trip-with-budget', handleBudgetEvent);
    window.addEventListener('lost:trip-report-updated', handleReportUpdated);
    window.addEventListener('lost:trip-report-deleted', handleReportDeleted);
    window.addEventListener('lost:follow-changed', handleFollowChanged);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('lost:start-trip-with-budget', handleBudgetEvent);
      window.removeEventListener('lost:trip-report-updated', handleReportUpdated);
      window.removeEventListener('lost:trip-report-deleted', handleReportDeleted);
      window.removeEventListener('lost:follow-changed', handleFollowChanged);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Deep-link fallback: if /forum?threadId=... is not in current loaded page, fetch GET /api/forum/threads/:id
  const matchedPendingInFeed = useMemo(
    () =>
      pendingUrlThreadId
        ? (threads.find((t) => String(t.id) === String(pendingUrlThreadId)) as ForumThreadWithTrail | undefined) || null
        : null,
    [pendingUrlThreadId, threads]
  );

  useEffect(() => {
    if (!pendingUrlThreadId || matchedPendingInFeed) return;
    if (deepLinkedThread && deepLinkedThread.id === pendingUrlThreadId) return;
    const controller = new AbortController();
    fetch(`/api/forum/threads/${encodeURIComponent(pendingUrlThreadId)}`, {
      headers: getApiHeaders(),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!controller.signal.aborted && json?.success && json.data) {
          setDeepLinkedThread({ id: pendingUrlThreadId, thread: json.data });
        }
      })
      .catch(() => {
        // ignore missing or aborted deep-link
      });
    return () => controller.abort();
  }, [pendingUrlThreadId, matchedPendingInFeed, deepLinkedThread]);

  const activeThread: ForumThreadWithTrail | null = useMemo(() => {
    if (selectedThread) {
      const liveVersion = threads.find((t) => String(t.id) === String(selectedThread.id)) as ForumThreadWithTrail | undefined;
      return liveVersion ? { ...selectedThread, ...liveVersion } : selectedThread;
    }
    if (matchedPendingInFeed) return matchedPendingInFeed;
    if (pendingUrlThreadId && deepLinkedThread && deepLinkedThread.id === pendingUrlThreadId) {
      return deepLinkedThread.thread;
    }
    return null;
  }, [selectedThread, threads, matchedPendingInFeed, pendingUrlThreadId, deepLinkedThread]);

  // Clear ?threadId= query param on close so socket updates don't re-open modal
  const handleCloseThreadModal = useCallback(() => {
    setActiveThread(null);
    setPendingUrlThreadId(null);
    setDeepLinkedThread(null);
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('threadId')) {
        url.searchParams.delete('threadId');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {
      // ignore URL mutation errors
    }
  }, []);

  // Global event sync across tabs / pages
  useEffect(() => {
    const handleGlobalUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.threadId) {
        if (detail.userReaction !== undefined) {
          setThreadReactions((prev) => ({ ...prev, [detail.threadId]: detail.userReaction }));
        }
        if (detail.reactionsSummary) {
          setThreadReactionsSummaryMap((prev) => ({ ...prev, [detail.threadId]: detail.reactionsSummary }));
        }
        if (detail.upvotes !== undefined) {
          setThreadUpvotesMap((prev) => ({ ...prev, [detail.threadId]: detail.upvotes }));
        }
      }
    };
    window.addEventListener('lost:forum-updated', handleGlobalUpdate);
    return () => window.removeEventListener('lost:forum-updated', handleGlobalUpdate);
  }, []);

  const filtered = useMemo(() => {
    const baseList = (threads as ForumThreadWithTrail[]).filter((t) => {
      if (selectedCategory !== 'All' && FORUM_THREAD_CATEGORIES.has(selectedCategory) && t.category !== selectedCategory) {
        return false;
      }
      if (!isServerDrivenForum && effectiveSearchQuery.trim()) {
        const q = effectiveSearchQuery.trim().toLowerCase();
        const hay = `${t.title} ${t.content} ${t.authorName} ${t.trailName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (isServerDrivenForum) return baseList;
    return [...baseList].sort((a, b) => {
      const pinDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
      if (pinDiff !== 0) return pinDiff;
      if (effectiveSortBy === 'popular') return (b.upvotes || 0) - (a.upvotes || 0);
      if (effectiveSortBy === 'most_commented') return (b.repliesCount || 0) - (a.repliesCount || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [threads, selectedCategory, isServerDrivenForum, effectiveSearchQuery, effectiveSortBy]);

  const promptAuth = useCallback(
    (msg: string, actionLabel?: string) => {
      if (onRequireLogin && actionLabel) {
        onRequireLogin(actionLabel);
        return;
      }
      window.dispatchEvent(new CustomEvent('lost:show-toast', { detail: { message: msg, type: 'info' } }));
      window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
    },
    [onRequireLogin]
  );

  const handleToggleReaction = async (threadId: string, reaction: ReactionType) => {
    const token = localStorage.getItem('lost_token');
    if (!token) {
      promptAuth('Vui lòng đăng nhập để thả cảm xúc cho bài viết!', 'thả cảm xúc bài viết');
      return;
    }

    const targetThread = threads.find((t) => t.id === threadId) as (ForumThread & { userReaction?: ReactionType }) | undefined;
    const prevReaction =
      threadReactions[threadId] !== undefined
        ? threadReactions[threadId]
        : (targetThread?.userReaction || null);
    const prevSummarySnapshot: Record<string, number> = {
      ...(threadReactionsSummaryMap[threadId] ||
        (targetThread?.reactions as unknown as Record<string, number> | undefined) || {
        like: 0,
        dislike: 0,
        haha: 0,
        wow: 0,
        buon: 0,
        huhu: 0,
        angry: 0,
      }),
    };
    const prevUpvotesSnapshot =
      threadUpvotesMap[threadId] !== undefined ? threadUpvotesMap[threadId] : (targetThread?.upvotes || 0);

    const next = prevReaction === reaction ? null : reaction;

    // Optimistic update
    setThreadReactions((prevMap) => ({ ...prevMap, [threadId]: next }));
    const optimisticSummary: Record<string, number> = { ...prevSummarySnapshot };
    if (prevReaction && optimisticSummary[prevReaction] !== undefined) {
      optimisticSummary[prevReaction] = Math.max(0, optimisticSummary[prevReaction] - 1);
    }
    if (next) {
      optimisticSummary[next] = (optimisticSummary[next] || 0) + 1;
    }
    setThreadReactionsSummaryMap((prevMap) => ({ ...prevMap, [threadId]: optimisticSummary }));

    const rollback = () => {
      setThreadReactions((prevMap) => ({ ...prevMap, [threadId]: prevReaction }));
      setThreadReactionsSummaryMap((prevMap) => ({ ...prevMap, [threadId]: prevSummarySnapshot }));
      setThreadUpvotesMap((prevMap) => ({ ...prevMap, [threadId]: prevUpvotesSnapshot }));
    };

    try {
      const res = await fetch(`/api/forum/threads/${encodeURIComponent(threadId)}/reaction`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reactionType: reaction }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.upvotes !== undefined) {
        setThreadUpvotesMap((prevMap) => ({ ...prevMap, [threadId]: json.upvotes }));
        if (json.userReaction !== undefined) {
          setThreadReactions((prevMap) => ({ ...prevMap, [threadId]: json.userReaction }));
        }
        if (json.data) {
          setThreadReactionsSummaryMap((prevMap) => ({ ...prevMap, [threadId]: json.data }));
        }
        notifyForumUpdated({ threadId, userReaction: json.userReaction, reactionsSummary: json.data, upvotes: json.upvotes });
      } else {
        rollback();
        if (res.status === 401) {
          promptAuth('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!', 'thả cảm xúc bài viết');
        } else {
          window.dispatchEvent(
            new CustomEvent('lost:show-toast', {
              detail: { message: json.message || 'Không thể lưu cảm xúc lúc này.', type: 'error' },
            })
          );
        }
      }
    } catch (err) {
      rollback();
      console.error('[Feed Reaction Error]:', err);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Gần đây';
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return dateStr;
      const diffHours = Math.floor((nowMs - d.getTime()) / (1000 * 60 * 60));
      if (diffHours < 1) return 'Vừa xong';
      if (diffHours < 24) return `${diffHours} giờ trước`;
      if (diffHours < 48) return 'Hôm qua';
      return d.toLocaleDateString('vi-VN');
    } catch {
      return 'Gần đây';
    }
  };

  const CATEGORY_ITEMS = [
    { name: 'All', label: 'Tất cả diễn đàn', Icon: IconCompass },
    { name: 'Ghép Đoàn', label: 'Ghép đoàn & Lịch đi', Icon: IconUsers },
    { name: 'Nhật Ký', label: 'Nhật ký chuyến đi', Icon: IconBookOpen },
    { name: 'Hoạt Động', label: 'Hoạt động', Icon: IconSparkles },
    { name: 'Tìm Đồng Đội', label: 'Tìm đồng đội', Icon: IconUserPlus },
    { name: 'Kinh Nghiệm', label: 'Cẩm nang & Kinh nghiệm', Icon: IconLightbulb },
    { name: 'Hỏi Đáp', label: 'Hỏi đáp kỹ thuật', Icon: IconHelpCircle },
    { name: 'Cảnh Báo', label: 'Radar an toàn', Icon: IconShieldAlert },
  ];

  const handleSelectCategory = (catName: string) => {
    setSelectedCategory(catName);
    if (FORUM_THREAD_CATEGORIES.has(catName)) {
      onForumCategoryChange?.(catName);
    }
  };

  const handleOpenThreadById = useCallback(
    (threadId: string) => {
      if (!threadId) return;
      const found = threads.find((t) => String(t.id) === String(threadId));
      if (found) {
        setActiveThread(found);
      } else {
        setPendingUrlThreadId(threadId);
      }
    },
    [threads]
  );

  return (
    <div style={{ marginBottom: 48 }}>
      {/* Author Profile Modal */}
      <AuthorProfileModal
        author={activeAuthor}
        currentUser={currentUser}
        onClose={() => setActiveAuthor(null)}
        onOpenThread={handleOpenThreadById}
        onRequireLogin={onRequireLogin}
      />

      {/* Thread Detail & Comments Modal */}
      <ThreadDetailModal
        thread={activeThread}
        currentUser={currentUser}
        onClose={handleCloseThreadModal}
        onOpenAuthorProfile={(auth) => setActiveAuthor({
          name: auth.name,
          avatar: auth.avatar,
          userId: auth.userId || activeThread?.userId,
        })}
        onUpdateThreadUpvotes={(tId, upvotes) => setThreadUpvotesMap((prev) => ({ ...prev, [tId]: upvotes }))}
        onUpdateCommentCount={(threadId, count) => setThreadCommentCounts((prev) => ({ ...prev, [threadId]: count }))}
        onUpdateThreadReaction={(tId, r, summary, u) => {
          setThreadReactions((prev) => ({ ...prev, [tId]: r }));
          setThreadReactionsSummaryMap((prev) => ({ ...prev, [tId]: summary }));
          setThreadUpvotesMap((prev) => ({ ...prev, [tId]: u }));
        }}
        onThreadUpdated={(updated) => {
          setActiveThread((prev) => (prev && String(prev.id) === String(updated.id) ? { ...prev, ...updated } : prev));
          setDeepLinkedThread((prev) => (prev && String(prev.thread.id) === String(updated.id) ? { ...prev, thread: { ...prev.thread, ...updated } } : prev));
          onThreadUpdated?.(updated);
        }}
        onThreadDeleted={(deletedId) => {
          handleCloseThreadModal();
          onThreadDeleted?.(deletedId);
        }}
        onShowToast={(msg, type) => {
          window.dispatchEvent(new CustomEvent('lost:show-toast', { detail: { message: msg, type: type || 'info' } }));
        }}
      />

      {/* Modern Feed Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div className="section-eyebrow" style={{ marginBottom: 6 }}>
            Diễn đàn &amp; vô tuyến thực địa
          </div>

          <h2
            className="font-editorial"
            style={{
              fontSize: 'clamp(1.65rem, 2.8vw, 2.25rem)',
              fontWeight: 500,
              color: 'var(--color-text-main)',
              margin: 0,
              lineHeight: 1.08,
            }}
          >
            Nhật Ký Băng Rừng &amp; Radar Đường Trek
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', margin: '8px 0 0 0' }}>
            Cẩm nang trải nghiệm thực tế, tình trạng tuyến đường và tìm đồng đội ghép đoàn từ cộng đồng Trekker.
          </p>
        </div>

        <div>
          {selectedCategory === 'Ghép Đoàn' ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const token = localStorage.getItem('lost_token');
                if (!token) {
                  promptAuth('Vui lòng đăng nhập để mở chuyến ghép đoàn!');
                  return;
                }
                setIsCreateTripOpen(true);
              }}
            >
              <IconUserPlus size={15} color="var(--color-on-primary)" />
              Mở Chuyến Ghép Đoàn
            </button>
          ) : selectedCategory === 'Nhật Ký' ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const token = localStorage.getItem('lost_token');
                if (!token) {
                  promptAuth('Vui lòng đăng nhập để viết bài nhật ký chuyến đi!');
                  return;
                }
                setIsCreateReportOpen(true);
              }}
            >
              <IconMountain size={15} color="var(--color-on-primary)" />
              Viết Nhật Ký Chuyến Đi
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const token = localStorage.getItem('lost_token');
                if (!token) {
                  promptAuth('Vui lòng đăng nhập để tạo bài thảo luận mới trên diễn đàn!');
                  return;
                }
                onOpenNewThreadModal();
              }}
            >
              <IconPlus size={15} color="var(--color-on-primary)" />
              Viết Bài Đóng Góp
            </button>
          )}
        </div>
      </div>

      <CreateTripModal
        isOpen={isCreateTripOpen}
        initialDraft={tripBudgetDraft}
        onClose={() => {
          setIsCreateTripOpen(false);
          setTripBudgetDraft(null);
        }}
        onSuccess={() => {
          setTripBudgetDraft(null);
          void loadTrips();
        }}
      />

      <CreateTripReportModal
        isOpen={isCreateReportOpen}
        onClose={() => setIsCreateReportOpen(false)}
        onSuccess={loadTripReports}
      />

      {/* Swiss Hairline Editorial Category Tabs with Liquid Glider */}
      <div ref={categoryTrackRef} className="editorial-tabs-bar has-glider">
        <span aria-hidden="true" className="lost-glider-tab" style={categoryIndicatorStyle} />
        {CATEGORY_ITEMS.map((item) => {
          const isActive = selectedCategory === item.name;
          const isWarning = item.name === 'Cảnh Báo';
          const ItemIcon = item.Icon;

          return (
            <button
              key={item.name}
              type="button"
              data-glider-active={isActive ? 'true' : undefined}
              onClick={() => handleSelectCategory(item.name)}
              className={`editorial-tab-btn${isActive ? ' active' : ''}`}
              style={{
                borderBottomColor: 'transparent',
                color: isActive
                  ? isWarning
                    ? 'var(--color-error)'
                    : 'var(--color-text-main)'
                  : isWarning
                    ? 'var(--color-error)'
                    : 'var(--color-text-muted)',
              }}
            >
              <ItemIcon
                size={14}
                color={
                  isActive
                    ? isWarning
                      ? 'var(--color-error)'
                      : 'var(--color-primary)'
                    : isWarning
                      ? 'var(--color-error)'
                      : 'var(--color-text-dim)'
                }
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Forum Search & Sort Toolbar (shown on Forum thread categories) */}
      {FORUM_THREAD_CATEGORIES.has(selectedCategory) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 16,
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 460 }}>
            <IconSearch
              size={15}
              color="var(--color-text-dim)"
              style={{
                position: 'absolute',
                left: 11,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              className="form-input"
              aria-label="Tìm kiếm bài viết diễn đàn"
              placeholder="Tìm bài viết, cung đường, tác giả..."
              value={effectiveSearchQuery}
              onChange={(e) => {
                const val = e.target.value;
                if (onSearchChange) onSearchChange(val);
                else setLocalSearchQuery(val);
              }}
              style={{
                width: '100%',
                padding: '8px 34px 8px 34px',
                borderRadius: 4,
                fontSize: '0.82rem',
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-main)',
                boxSizing: 'border-box',
              }}
            />
            {effectiveSearchQuery && (
              <button
                type="button"
                aria-label="Xóa từ khóa tìm kiếm"
                onClick={() => {
                  if (onSearchChange) onSearchChange('');
                  else setLocalSearchQuery('');
                }}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-dim)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 4,
                }}
              >
                <IconX size={14} />
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label="Sắp xếp bài viết"
            style={{
              display: 'inline-flex',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              padding: 3,
              gap: 3,
              flexWrap: 'wrap',
            }}
          >
            {(
              [
                { key: 'newest', label: 'Mới nhất' },
                { key: 'popular', label: 'Nổi bật' },
                { key: 'most_commented', label: 'Nhiều bình luận' },
              ] as Array<{ key: ForumSortOption; label: string }>
            ).map((opt) => {
              const active = effectiveSortBy === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    if (onSortChange) onSortChange(opt.key);
                    else setLocalSortBy(opt.key);
                  }}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 4,
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: active ? 'var(--color-primary)' : 'transparent',
                    color: active ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Conditional rendering for Ghép Đoàn & Nhật Ký vs Standard Threads */}
      <div key={selectedCategory} className="tab-content-slide">
        {selectedCategory === 'Ghép Đoàn' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Status Filter Pills + View Mode Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div
                role="tablist"
                aria-label="Lọc trạng thái chuyến ghép đoàn"
                style={{
                  display: 'inline-flex',
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  padding: 3,
                  gap: 3,
                  flexWrap: 'wrap',
                }}
              >
                {(
                  [
                    { key: 'all', label: 'Tất cả' },
                    { key: 'recruiting', label: 'Đang tuyển' },
                    { key: 'full', label: 'Đã đủ' },
                    { key: 'mine', label: 'Của tôi' },
                  ] as Array<{ key: 'all' | 'recruiting' | 'full' | 'mine'; label: string }>
                ).map((item) => {
                  const active = tripsStatusFilter === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        if (item.key === 'mine' && !localStorage.getItem('lost_token')) {
                          promptAuth('Vui lòng đăng nhập để xem các chuyến ghép đoàn của bạn!', 'xem chuyến ghép đoàn của bạn');
                          return;
                        }
                        setTripsStatusFilter(item.key);
                      }}
                      style={{
                        padding: '5px 11px',
                        borderRadius: 4,
                        border: 'none',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: active ? 'var(--color-primary)' : 'transparent',
                        color: active ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                        fontFamily: 'var(--font-family)',
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  padding: 3,
                  gap: 4,
                }}
              >
                <button
                  type="button"
                  onClick={() => setTripsViewMode('list')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 4,
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: tripsViewMode === 'list' ? 'var(--color-primary)' : 'transparent',
                    color: tripsViewMode === 'list' ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  <IconUsers size={14} />
                  <span>Danh Sách Đoàn</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTripsViewMode('calendar')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 4,
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: tripsViewMode === 'calendar' ? 'var(--color-primary)' : 'transparent',
                    color: tripsViewMode === 'calendar' ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  <IconCalendar size={14} />
                  <span>Lịch Khởi Hành</span>
                </button>
              </div>
            </div>

            {tripsViewMode === 'calendar' ? (
              <ExpeditionCalendarGrid
                trips={trips}
                currentUser={currentUser}
                onTripUpdated={loadTrips}
              />
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 20 }}>
                  {loadingTrips ? (
                    <div style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      Đang tải danh sách chuyến ghép đoàn...
                    </div>
                  ) : trips.length === 0 ? (
                    <div
                      style={{
                        gridColumn: '1 / -1',
                        padding: '40px 20px',
                        textAlign: 'center',
                        color: 'var(--color-text-dim)',
                        background: 'var(--color-bg-card)',
                        borderRadius: 4,
                        border: '1px dashed var(--color-border-strong)',
                      }}
                    >
                      <IconUsers size={32} color="var(--color-primary)" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.6 }} />
                      <div style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 4 }}>
                        {tripsStatusFilter === 'mine'
                          ? 'Bạn chưa tham gia hoặc tạo chuyến ghép đoàn nào'
                          : 'Chưa có chuyến ghép đoàn nào phù hợp bộ lọc'}
                      </div>
                      <p style={{ fontSize: '0.82rem', margin: 0 }}>
                        Hãy bấm &ldquo;Mở Chuyến Ghép Đoàn&rdquo; để tìm đồng đội leo núi cùng bạn!
                      </p>
                    </div>
                  ) : (
                    trips.map((t) => <TripPlanCard key={t._id} trip={t} currentUser={currentUser} onJoinSuccess={loadTrips} />)
                  )}
                </div>

                {!loadingTrips && tripsHasMore && (
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={loadingMoreTrips}
                      onClick={handleLoadMoreTrips}
                      style={{ borderRadius: 4, fontSize: '0.8rem', padding: '8px 20px', fontWeight: 700 }}
                    >
                      {loadingMoreTrips ? 'Đang tải thêm đoàn...' : 'Tải thêm chuyến ghép đoàn'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : selectedCategory === 'Nhật Ký' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Trail Filter Toolbar for Trip Reports */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <label htmlFor="reports-trail-filter" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                  Lọc theo cung đường:
                </label>
                <select
                  id="reports-trail-filter"
                  value={reportsTrailFilter}
                  onChange={(e) => setReportsTrailFilter(e.target.value)}
                  className="form-select"
                  style={{
                    padding: '6px 12px',
                    borderRadius: 4,
                    fontSize: '0.78rem',
                    background: 'var(--color-bg-card)',
                    color: 'var(--color-text-main)',
                    border: '1px solid var(--color-border)',
                    minWidth: 220,
                  }}
                >
                  <option value="">Tất cả cung đường Việt Nam</option>
                  {availableTrails.map((t) => {
                    const tid = t.id || (t as Trail & { _id?: string })._id || '';
                    return (
                      <option key={tid} value={tid}>
                        {t.name} ({t.province})
                      </option>
                    );
                  })}
                </select>
                {reportsTrailFilter && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setReportsTrailFilter('')}
                    style={{ padding: '5px 9px', borderRadius: 4, fontSize: '0.74rem' }}
                  >
                    Xóa lọc
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 20 }}>
              {loadingReports ? (
                <div style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  Đang tải nhật ký chuyến đi...
                </div>
              ) : tripReports.length === 0 ? (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: 'var(--color-text-dim)',
                    background: 'var(--color-bg-card)',
                    borderRadius: 4,
                    border: '1px dashed var(--color-border-strong)',
                  }}
                >
                  <IconBookOpen size={32} color="var(--color-sky)" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.6 }} />
                  <div style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 4 }}>
                    {reportsTrailFilter
                      ? 'Chưa có nhật ký nào cho cung đường này'
                      : 'Chưa có bài viết nhật ký chuyến đi nào'}
                  </div>
                  <p style={{ fontSize: '0.82rem', margin: 0 }}>
                    Hãy bấm &ldquo;Viết Nhật Ký Chuyến Đi&rdquo; ở góc trên để chia sẻ cảm nhận và hình ảnh thực tế của bạn!
                  </p>
                </div>
              ) : (
                tripReports.map((r) => <TripReportCard key={r._id} report={r} currentUser={currentUser} />)
              )}
            </div>

            {!loadingReports && reportsHasMore && (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={loadingMoreReports}
                  onClick={handleLoadMoreReports}
                  style={{ borderRadius: 4, fontSize: '0.8rem', padding: '8px 20px', fontWeight: 700 }}
                >
                  {loadingMoreReports ? 'Đang tải thêm nhật ký...' : 'Tải thêm nhật ký chuyến đi'}
                </button>
              </div>
            )}
          </div>
        ) : selectedCategory === 'Hoạt Động' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Scope Switcher Bar: Toàn Cộng Đồng vs Đang Theo Dõi */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div
                role="tablist"
                aria-label="Phạm vi dòng hoạt động"
                style={{
                  display: 'inline-flex',
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  padding: 3,
                  gap: 4,
                }}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activityScope === 'all'}
                  onClick={() => setActivityScope('all')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 4,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: activityScope === 'all' ? 'var(--color-primary)' : 'transparent',
                    color: activityScope === 'all' ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  <IconCompass size={14} />
                  <span>Toàn Cộng Đồng</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activityScope === 'following'}
                  onClick={() => setActivityScope('following')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 4,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: activityScope === 'following' ? 'var(--color-primary)' : 'transparent',
                    color: activityScope === 'following' ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  <IconUsers size={14} />
                  <span>Đang Theo Dõi</span>
                </button>
              </div>

              <button
                type="button"
                className="btn btn-outline"
                disabled={loadingActivities}
                onClick={() => setActivityRefreshTick((t) => t + 1)}
                style={{
                  padding: '6px 11px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  borderRadius: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <IconRotateCw size={13} />
                <span>Làm mới</span>
              </button>
            </div>

            {isFollowingGuestGate ? (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: 'var(--color-bg-card)',
                  border: '1px dashed var(--color-border-strong)',
                  borderRadius: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <IconUsers size={30} color="var(--color-sky)" />
                <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                  Đăng nhập để xem hoạt động từ đồng đội bạn theo dõi
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)', maxWidth: 440 }}>
                  Theo dõi các trekker và dẫn đường uy tín để cập nhật ngay khi họ đóng dấu đỉnh mới, mở chuyến ghép đoàn hoặc chia sẻ nhật ký thực địa.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => window.dispatchEvent(new CustomEvent('lost:open-auth-modal'))}
                    style={{ borderRadius: 4, fontSize: '0.8rem' }}
                  >
                    Đăng nhập ngay
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setActivityScope('all')}
                    style={{ borderRadius: 4, fontSize: '0.8rem' }}
                  >
                    Xem Toàn Cộng Đồng
                  </button>
                </div>
              </div>
            ) : loadingActivities ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2, 3, 4].map((idx) => (
                  <div
                    key={idx}
                    className="card"
                    style={{
                      padding: '16px 18px',
                      borderRadius: 4,
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                    }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-surface-elevated)', flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ width: '38%', height: 14, borderRadius: 4, background: 'var(--color-surface-elevated)' }} />
                      <div style={{ width: '78%', height: 16, borderRadius: 4, background: 'var(--color-bg-main)' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : activitiesError ? (
              <div
                style={{
                  padding: '32px 20px',
                  textAlign: 'center',
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  color: 'var(--color-text-muted)',
                  fontSize: '0.84rem',
                }}
              >
                {activitiesError}
              </div>
            ) : activities.length === 0 ? (
              <div
                style={{
                  padding: '38px 20px',
                  textAlign: 'center',
                  background: 'var(--color-bg-card)',
                  border: '1px dashed var(--color-border-strong)',
                  borderRadius: 4,
                  color: 'var(--color-text-dim)',
                }}
              >
                <IconSparkles size={30} color="var(--color-primary)" style={{ margin: '0 auto 10px', display: 'block', opacity: 0.65 }} />
                <div style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 4 }}>
                  {activityScope === 'following'
                    ? 'Chưa có hoạt động mới từ người bạn đang theo dõi'
                    : 'Chưa ghi nhận hoạt động cộng đồng gần đây'}
                </div>
                <p style={{ margin: '0 0 12px 0', fontSize: '0.82rem' }}>
                  {activityScope === 'following'
                    ? 'Hãy bấm vào hồ sơ các trekker trong diễn đàn và nhấn Theo Dõi để kết nối.'
                    : 'Khi cộng đồng đóng dấu đỉnh, đạt huy hiệu hoặc đăng nhật ký, dòng sự kiện sẽ hiển thị trực tiếp tại đây.'}
                </p>
                {activityScope === 'following' && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setActivityScope('all')}
                    style={{ borderRadius: 4, fontSize: '0.78rem' }}
                  >
                    Chuyển sang Toàn Cộng Đồng
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activities.map((item) => {
                  const meta = ACTIVITY_TYPE_META[item.type] || {
                    label: 'Hoạt Động Thực Địa',
                    accent: 'var(--color-primary)',
                    Icon: IconSparkles,
                  };
                  const BadgeIcon = meta.Icon;

                  return (
                    <article
                      key={item.id}
                      className="card"
                      style={{
                        padding: '15px 18px',
                        borderRadius: 4,
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        borderLeft: `3px solid ${meta.accent}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        {/* Clickable Author Identity */}
                        <button
                          type="button"
                          onClick={() =>
                            setActiveAuthor({
                              userId: item.author.id,
                              name: item.author.name,
                              avatar: item.author.avatar,
                              role: item.author.role,
                              reputationScore: item.author.reputationScore,
                            })
                          }
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 10,
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            textAlign: 'left',
                            minWidth: 0,
                          }}
                          title="Xem hồ sơ thành viên"
                        >
                          {item.author.avatar ? (
                            <img
                              src={item.author.avatar}
                              alt={item.author.name}
                              referrerPolicy="no-referrer"
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: `1.5px solid ${meta.accent}`,
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                background: `color-mix(in srgb, ${meta.accent} 16%, var(--color-bg-main))`,
                                border: `1.5px solid ${meta.accent}`,
                                color: meta.accent,
                                fontSize: '0.84rem',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {item.author.name.charAt(0).toUpperCase()}
                            </span>
                          )}

                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: '0.86rem', color: 'var(--color-text-main)', fontWeight: 800 }}>
                                {item.author.name}
                              </strong>
                              {item.author.reputationScore !== undefined && (
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    color: 'var(--color-primary)',
                                    background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                                    borderRadius: 4,
                                    padding: '1px 6px',
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                >
                                  {item.author.reputationScore.toLocaleString('vi-VN')} PTS
                                </span>
                              )}
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                              <IconClock size={11} color="var(--color-text-dim)" />
                              <span>{formatActivityTimestampVn(item.createdAt)}</span>
                            </span>
                          </span>
                        </button>

                        {/* Pure SVG Activity Type Badge */}
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 9px',
                            borderRadius: 4,
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            color: meta.accent,
                            background: `color-mix(in srgb, ${meta.accent} 12%, transparent)`,
                            border: `1px solid color-mix(in srgb, ${meta.accent} 32%, transparent)`,
                            flexShrink: 0,
                          }}
                        >
                          <BadgeIcon size={12} color={meta.accent} />
                          <span>{meta.label}</span>
                        </span>
                      </div>

                      <div style={{ fontSize: '0.88rem', color: 'var(--color-text-main)', lineHeight: 1.5, fontWeight: 600 }}>
                        {item.title}
                      </div>

                      {/* Optional Clickable Trail Card */}
                      {item.trail && (
                        <button
                          type="button"
                          onClick={() => navigateToTrailPage(item.trail!.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            padding: '10px 12px',
                            borderRadius: 4,
                            background: 'var(--color-bg-main)',
                            border: '1px solid var(--color-border)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            {item.trail.coverImage ? (
                              <img
                                src={item.trail.coverImage}
                                alt={item.trail.name}
                                style={{
                                  width: 48,
                                  height: 36,
                                  borderRadius: 4,
                                  objectFit: 'cover',
                                  flexShrink: 0,
                                  border: '1px solid var(--color-border)',
                                }}
                              />
                            ) : (
                              <span
                                style={{
                                  width: 40,
                                  height: 36,
                                  borderRadius: 4,
                                  background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <IconMountain size={16} color="var(--color-primary)" />
                              </span>
                            )}
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.trail.name}
                              </span>
                              <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                {[
                                  item.trail.province,
                                  item.trail.maxAltitudeM ? `${item.trail.maxAltitudeM.toLocaleString('vi-VN')}m` : null,
                                ]
                                  .filter(Boolean)
                                  .join(' • ') || 'Mở chi tiết cung đường thực địa'}
                              </span>
                            </span>
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>
                            <span>Xem cung</span>
                            <IconArrowRight size={13} color="var(--color-primary)" />
                          </span>
                        </button>
                      )}
                    </article>
                  );
                })}

                {activitiesHasMore && (
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={loadingMoreActivities}
                      onClick={handleLoadMoreActivities}
                      style={{ borderRadius: 4, fontSize: '0.8rem', padding: '8px 18px' }}
                    >
                      {loadingMoreActivities ? 'Đang tải thêm...' : 'Tải thêm hoạt động cũ hơn'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : isLoadingThreads && threads.length === 0 ? (
          /* Crisp Skeleton Cards while loading (prevents empty-state flash) */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 20 }}>
            {[1, 2, 3, 4].map((skeletonIdx) => (
              <div
                key={skeletonIdx}
                className="card"
                style={{
                  padding: '20px 22px',
                  borderRadius: 4,
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ width: 92, height: 20, borderRadius: 4, background: 'var(--color-surface-elevated)' }} />
                  <div style={{ width: 108, height: 20, borderRadius: 4, background: 'var(--color-surface-elevated)' }} />
                </div>
                <div style={{ width: '85%', height: 22, borderRadius: 4, background: 'var(--color-surface-elevated)' }} />
                <div style={{ width: '100%', height: 42, borderRadius: 4, background: 'var(--color-bg-main)' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-surface-elevated)' }} />
                    <div style={{ width: 96, height: 14, borderRadius: 4, background: 'var(--color-surface-elevated)' }} />
                  </div>
                  <div style={{ width: 84, height: 22, borderRadius: 4, background: 'var(--color-surface-elevated)' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              background: 'var(--color-bg-card)',
              borderRadius: 4,
              border: '1px dashed var(--color-border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <IconCompass size={38} color="var(--color-primary)" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.7 }} />
            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '0 0 6px 0' }}>
              Chưa có bài viết nào trong chuyên mục này
            </h4>
            <p style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', margin: '0 0 18px 0', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
              Hãy là người đầu tiên chia sẻ cẩm nang thám hiểm hoặc gửi thông tin thực địa cho cộng đồng!
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onOpenNewThreadModal}
              style={{
                padding: '9px 18px',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <IconPlus size={15} color="currentColor" />
              Viết Bài Đóng Góp Đầu Tiên
            </button>
          </div>
        ) : (
          /* Expedition Log Grid + Load More Pagination */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 20 }}>
              {filtered.map((thread) => {
                const isWarning = thread.category === 'Cảnh Báo';
                const isQA = thread.category === 'Hỏi Đáp';
                const isTeamSearch = thread.category === 'Tìm Đồng Đội';
                const threadWithTrail = thread as ForumThreadWithTrail;

                return (
                  <div
                    key={thread.id}
                    className="card"
                    style={{
                      padding: '20px 22px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                      borderLeft: isWarning ? '3px solid var(--color-error)' : '1px solid var(--color-border)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'visible',
                    }}
                    onClick={() => setActiveThread(threadWithTrail)}
                  >
                    <div>
                      {/* Header Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 6, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span
                            className={`badge ${isWarning ? 'badge-error' : isQA || isTeamSearch ? 'badge-info' : 'badge-success'}`}
                          >
                            {thread.category}
                          </span>

                          {thread.isPinned && (
                            <span className="badge badge-sun">
                              <IconSparkles size={11} color="var(--color-sun)" />
                              Đã Ghim
                            </span>
                          )}

                          {thread.isLocked && (
                            <span className="badge badge-cloud">
                              <IconLock size={11} color="var(--color-text-muted)" />
                              Đã Khóa
                            </span>
                          )}
                        </div>

                        {/* Radar Live Chip */}
                        <span
                          className={`badge ${isWarning ? 'badge-error' : 'badge-cloud'}`}
                        >
                          {isWarning ? <IconAlertTriangle size={11} color="var(--color-error)" /> : <IconShieldCheck size={11} color="var(--color-primary)" />}
                          {isWarning ? 'Cảnh báo tuyến' : 'Tuyến an toàn'}
                        </span>
                      </div>

                      {threadWithTrail.trailName && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-sky)', marginBottom: 6 }}>
                          <IconMountain size={12} color="var(--color-sky)" />
                          <span>{threadWithTrail.trailName}</span>
                        </div>
                      )}

                      {/* Title */}
                      <h3
                        style={{
                          fontSize: '1.02rem',
                          fontWeight: 800,
                          color: 'var(--color-text-main)',
                          marginBottom: 8,
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {thread.title}
                      </h3>

                      {/* Attached Real Images Gallery Preview */}
                      {thread.images && thread.images.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          {thread.images.length === 1 && (
                            <div style={{ height: 160, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--color-border)', position: 'relative' }}>
                              <img src={thread.images[0]} alt={thread.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          )}
                          {thread.images.length === 2 && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, height: 120 }}>
                              <img src={thread.images[0]} alt={thread.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4, border: '1px solid var(--color-border)' }} />
                              <img src={thread.images[1]} alt={thread.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4, border: '1px solid var(--color-border)' }} />
                            </div>
                          )}
                          {thread.images.length >= 3 && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 6, height: 135 }}>
                              <img src={thread.images[0]} alt={thread.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4, border: '1px solid var(--color-border)' }} />
                              <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 6, height: '100%' }}>
                                <img src={thread.images[1]} alt={thread.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4, border: '1px solid var(--color-border)' }} />
                                <div style={{ position: 'relative', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                                  <img src={thread.images[2]} alt={thread.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  {thread.images.length > 3 && (
                                    <div
                                      style={{
                                        position: 'absolute',
                                        inset: 0,
                                        background: 'var(--overlay-bg)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--color-on-media)',
                                        fontSize: '0.85rem',
                                        fontWeight: 800,
                                      }}
                                    >
                                      +{thread.images.length - 3}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Snippet Content */}
                      <p
                        style={{
                          fontSize: '0.83rem',
                          color: 'var(--color-text-muted)',
                          lineHeight: 1.55,
                          marginBottom: 16,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {thread.content}
                      </p>
                    </div>

                    {/* Card Footer Info */}
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', gap: 10 }}>
                        {/* Author Info */}
                        {(() => {
                          const isCurrentUserAuthor = Boolean(
                            currentUser &&
                            thread.userId &&
                            currentUserId &&
                            String(thread.userId) === currentUserId
                          );
                          const cleanAuthorName = thread.authorName.replace(/\(.*\)/, '').trim();
                          const effectiveAvatar = (isCurrentUserAuthor && (currentUser?.avatarUrl || currentUser?.avatar))
                            ? (currentUser.avatarUrl || currentUser.avatar)
                            : (thread.authorAvatar || '');

                          return (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveAuthor({
                                  userId: thread.userId,
                                  name: cleanAuthorName,
                                  avatar: effectiveAvatar || '',
                                  role: (isCurrentUserAuthor && currentUser) ? currentUser.role : undefined,
                                  badges: (isCurrentUserAuthor && currentUser) ? currentUser.badges : undefined,
                                  reputationScore: (isCurrentUserAuthor && currentUser) ? currentUser.reputationScore : undefined,
                                });
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 0 }}
                              title="Bấm để xem hồ sơ tác giả"
                            >
                              {effectiveAvatar ? (
                                <img
                                  src={effectiveAvatar}
                                  alt={cleanAuthorName}
                                  referrerPolicy="no-referrer"
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    border: '1.5px solid var(--color-primary)',
                                    objectFit: 'cover',
                                    flexShrink: 0,
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 28,
                                    height: 28,
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
                                  {(cleanAuthorName || 'T').charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    color: 'var(--color-primary)',
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {cleanAuthorName}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>
                                  {formatDate(thread.createdAt)}
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Metrics & Facebook Reaction Bar */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                          <FacebookReactionPicker
                            currentReaction={
                              threadReactions[thread.id] !== undefined
                                ? threadReactions[thread.id]
                                : ((thread as ForumThread & { userReaction?: ReactionType }).userReaction || null)
                            }
                            totalLikes={threadUpvotesMap[thread.id] !== undefined ? threadUpvotesMap[thread.id] : thread.upvotes}
                            reactionsSummary={
                              threadReactionsSummaryMap[thread.id] ||
                              (thread.reactions as unknown as Record<string, number> | undefined)
                            }
                            onSelectReaction={(r) => handleToggleReaction(thread.id, r)}
                          />

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveThread(thread);
                            }}
                            title="Bấm để xem và viết bình luận"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              color: 'var(--color-text-muted)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              background: 'var(--color-bg-main)',
                              padding: '4px 9px',
                              borderRadius: 4,
                              border: '1px solid var(--color-border)',
                              cursor: 'pointer',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            <IconMessageSquare size={13} color="var(--color-sky)" />
                            <span>{threadCommentCounts[thread.id] !== undefined ? threadCommentCounts[thread.id] : (thread.repliesCount || 0)}</span>
                          </button>

                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              color: 'var(--color-text-dim)',
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              background: 'var(--color-bg-main)',
                              padding: '4px 8px',
                              borderRadius: 4,
                              border: '1px solid var(--color-border)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            <IconEye size={13} color="var(--color-text-dim)" />
                            <span>{thread.viewsCount || 1}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMoreThreads && onLoadMoreThreads && (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={loadingMoreThreads}
                  onClick={onLoadMoreThreads}
                  style={{ borderRadius: 4, fontSize: '0.82rem', padding: '9px 22px', fontWeight: 700 }}
                >
                  {loadingMoreThreads ? 'Đang tải thêm bài viết...' : 'Tải thêm bài viết diễn đàn'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
