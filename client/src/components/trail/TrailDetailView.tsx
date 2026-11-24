import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import type { Trail, Review, Incident, UserProfile, Guide } from '../../types.js';
import { useFocusTrap, isTopmostFocusTrap } from '../../hooks/useFocusTrap.js';
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator.js';
import { MapView } from '../map/MapView.js';
import {
  submitReview,
  deleteTrailReview,
  fetchNearbyTrailsForTrail,
  fetchMyWeatherAlerts,
  type NearbyTrailMatch,
  type WeatherAlertSubItem,
} from '../../services/api.js';
import { mockTrails } from '../../data/seedData.js';
import { haversineMeters } from '../../utils/geoMath.js';
import { OptimizedImage } from '../common/OptimizedImage.js';
import { ElevationProfileSVG } from './ElevationProfileSVG.js';
import { WeatherTab } from './WeatherTab.js';
import { GearChecklistTab } from './GearChecklistTab.js';
import { ItineraryTab } from './ItineraryTab.js';
import { TrailConditionSection } from './TrailConditionSection.js';
import { TrailPoiSection } from './TrailPoiSection.js';
import { TrailIntelligenceBar } from './TrailIntelligenceBar.js';
import { SummitClimateChart } from '../weather/SummitClimateChart.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';

const TrailComparisonModal = lazy(() =>
  import('./TrailComparisonModal.js').then((m) => ({ default: m.TrailComparisonModal }))
);
const WeatherAlertModal = lazy(() =>
  import('../weather/WeatherAlertModal.js').then((m) => ({ default: m.WeatherAlertModal }))
);
import {
  IconBell,
  IconPhone,
  IconAlertTriangle,
  IconStar,
  IconShieldAlert,
  IconCheckCircle,
  IconMapPin,
  IconUsers,
  IconClock,
  IconMountain,
  IconDroplet,
  IconCloudFog,
  IconTrees,
  IconCompass,
  IconCalendar,
  IconSun,
  IconSparkles,
  IconHiking,
  IconX,
  IconTrash,
} from '../common/SvgIcons.js';

type DetailIncident = Incident & { _id?: string; active?: boolean };
type DetailUser = UserProfile & { _id?: string };
type DetailGuide = Guide & { _id?: string };
type DetailTabId = 'overview' | 'map' | 'weather' | 'checklist' | 'itinerary' | 'guides' | 'reviews' | 'conditions' | 'pois';

interface TrailDetailViewProps {
  trail: Trail;
  onBack: () => void;
  onOpenIncidentModal: () => void;
  incidents?: DetailIncident[];
  currentUser?: DetailUser | null;
  onRequireLogin?: (actionName: string) => void;
  allTrails?: Trail[];
  onSelectTrail?: (trail: Trail) => void;
}

const VERIFIED_AVATAR_FALLBACK =
  'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329093/trekmap/avatars/avatar_user_1.jpg';

const WAYPOINT_TYPE_LABELS: Record<string, string> = {
  campsite: 'Điểm cắm trại',
  water: 'Nguồn nước',
  viewpoint: 'Điểm ngắm cảnh',
  danger: 'Cảnh báo nguy hiểm',
  charging: 'Trạm sạc / Lán',
  rest: 'Trạm dừng chân',
};

function formatVnDate(raw?: string): string {
  if (!raw) return 'Gần đây';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function extractPrimaryDialNumber(phone?: string, fallback = '112'): string {
  if (!phone) return fallback;
  const firstSegment = String(phone).split('/')[0] || '';
  const cleaned = firstSegment.replace(/[^0-9+]/g, '');
  return cleaned || fallback;
}

export const TrailDetailView: React.FC<TrailDetailViewProps> = ({
  trail,
  onBack,
  onOpenIncidentModal,
  incidents = [],
  currentUser,
  onRequireLogin,
  allTrails,
  onSelectTrail,
}) => {
  const [trackedTrailId, setTrackedTrailId] = useState<string>(trail.id);
  const [activeTab, setActiveTab] = useState<DetailTabId>('overview');
  const { trackRef: detailTabTrackRef, indicatorStyle: detailTabIndicatorStyle } =
    useSlidingIndicator<DetailTabId>(activeTab);
  const [reviewsList, setReviewsList] = useState<Review[]>(trail.reviews || []);
  const [guidesList, setGuidesList] = useState<DetailGuide[]>(trail.guides || []);
  const [newRating, setNewRating] = useState(5);
  const [newDiffRating, setNewDiffRating] = useState(trail.difficultyLevel || 3);
  const [newContent, setNewContent] = useState('');
  const [newSafetyNote, setNewSafetyNote] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [confirmDeleteReviewId, setConfirmDeleteReviewId] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [ratingOverride, setRatingOverride] = useState<{ rating: number; reviewCount: number } | null>(null);
  const [selectedEvidencePhoto, setSelectedEvidencePhoto] = useState<string | null>(null);
  const [hoveredElevationCoord, setHoveredElevationCoord] = useState<[number, number] | null>(null);
  const [reviewingGuideId, setReviewingGuideId] = useState<string | null>(null);
  const [guideRating, setGuideRating] = useState(5);
  const [guideComment, setGuideComment] = useState('');
  const [isSubmittingGuideReview, setIsSubmittingGuideReview] = useState(false);
  const [apiNearbyMatches, setApiNearbyMatches] = useState<{ trailId: string; items: NearbyTrailMatch[] } | null>(null);
  const [inlineCompareTrail, setInlineCompareTrail] = useState<Trail | null>(null);
  const [isWeatherAlertOpen, setIsWeatherAlertOpen] = useState<boolean>(false);
  const [showOverviewClimateChart, setShowOverviewClimateChart] = useState<boolean>(false);
  const [weatherAlertSub, setWeatherAlertSub] = useState<WeatherAlertSubItem | null>(null);
  const [weatherAlertSyncTick, setWeatherAlertSyncTick] = useState<number>(0);
  const [hasAlertAuthToken, setHasAlertAuthToken] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    return Boolean(localStorage.getItem('lost_token'));
  });
  const isAuthedForWeatherAlert = Boolean(currentUser) || hasAlertAuthToken;
  const [trackedAlertAuth, setTrackedAlertAuth] = useState<boolean>(isAuthedForWeatherAlert);

  if (trackedAlertAuth !== isAuthedForWeatherAlert) {
    setTrackedAlertAuth(isAuthedForWeatherAlert);
    if (!isAuthedForWeatherAlert) {
      setWeatherAlertSub(null);
    }
  }

  // Instant deterministic Haversine fallback across catalog / mockTrails
  const fallbackNearbyMatches = useMemo<NearbyTrailMatch[]>(() => {
    const pool = Array.isArray(allTrails) && allTrails.length > 1 ? allTrails : mockTrails;
    const baseLat = Number(trail.startLat);
    const baseLng = Number(trail.startLng);
    if (!Number.isFinite(baseLat) || !Number.isFinite(baseLng)) return [];
    return pool
      .filter((t) => t.id !== trail.id && Number.isFinite(t.startLat) && Number.isFinite(t.startLng))
      .map((t) => ({
        trail: t,
        distanceKm: Math.round((haversineMeters(baseLat, baseLng, t.startLat, t.startLng) / 1000) * 10) / 10,
        altitudeDeltaM: Math.round((Number(t.maxAltitudeM) || 0) - (Number(trail.maxAltitudeM) || 0)),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 4);
  }, [allTrails, trail.id, trail.startLat, trail.startLng, trail.maxAltitudeM]);

  // Fetch authoritative nearby trails from Wave 9B endpoint (AbortController protected)
  useEffect(() => {
    const controller = new AbortController();
    fetchNearbyTrailsForTrail(trail.id, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted && items.length > 0) {
          setApiNearbyMatches({ trailId: trail.id, items: items.slice(0, 4) });
        }
      })
      .catch(() => {
        // Keep deterministic Haversine fallback cleanly when offline or aborted
      });
    return () => controller.abort();
  }, [trail.id]);

  const nearbyTrails = useMemo<NearbyTrailMatch[]>(() => {
    if (apiNearbyMatches && apiNearbyMatches.trailId === trail.id && apiNearbyMatches.items.length > 0) {
      return apiNearbyMatches.items;
    }
    return fallbackNearbyMatches;
  }, [apiNearbyMatches, fallbackNearbyMatches, trail.id]);

  const handleOpenNearbyTrail = (targetTrail: Trail) => {
    setInlineCompareTrail(null);
    if (onSelectTrail) {
      onSelectTrail(targetTrail);
      return;
    }
    const targetPath = `/trails/${encodeURIComponent(targetTrail.id)}`;
    window.history.pushState({}, '', targetPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sync weather alert watchlist status for this trail when authenticated (same-tab & cross-tab)
  useEffect(() => {
    const syncAuth = () => {
      if (typeof localStorage === 'undefined') return;
      setHasAlertAuthToken(Boolean(localStorage.getItem('lost_token')));
    };
    const onAlertsUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent<{ source?: string }>).detail;
      if (detail?.source === 'trail-detail-modal') return;
      setWeatherAlertSyncTick((t) => t + 1);
    };
    window.addEventListener('lost:auth-changed', syncAuth);
    window.addEventListener('storage', syncAuth);
    window.addEventListener('focus', syncAuth);
    window.addEventListener('lost:weather-alerts-updated', onAlertsUpdated);
    return () => {
      window.removeEventListener('lost:auth-changed', syncAuth);
      window.removeEventListener('storage', syncAuth);
      window.removeEventListener('focus', syncAuth);
      window.removeEventListener('lost:weather-alerts-updated', onAlertsUpdated);
    };
  }, []);

  useEffect(() => {
    if (!isAuthedForWeatherAlert) return;
    const controller = new AbortController();
    fetchMyWeatherAlerts(controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        if (res.unauthorized) {
          setWeatherAlertSub(null);
          return;
        }
        const matched = res.data.find((sub) => sub.trailId === trail.id) || null;
        setWeatherAlertSub(matched);
      })
      .catch(() => {
        // Ignore abort / offline silently
      });
    return () => controller.abort();
  }, [trail.id, isAuthedForWeatherAlert, weatherAlertSyncTick]);

  // Reset activeTab, forms, and base lists cleanly during render whenever trail.id changes
  if (trackedTrailId !== trail.id) {
    setTrackedTrailId(trail.id);
    setActiveTab('overview');
    setReviewsList(trail.reviews || []);
    setGuidesList(trail.guides || []);
    setNewRating(5);
    setNewDiffRating(trail.difficultyLevel || 3);
    setNewContent('');
    setNewSafetyNote('');
    setIsSubmittingReview(false);
    setConfirmDeleteReviewId(null);
    setDeletingReviewId(null);
    setRatingOverride(null);
    setSelectedEvidencePhoto(null);
    setHoveredElevationCoord(null);
    setReviewingGuideId(null);
    setGuideRating(5);
    setGuideComment('');
    setIsSubmittingGuideReview(false);
    setInlineCompareTrail(null);
    setIsWeatherAlertOpen(false);
    setShowOverviewClimateChart(false);
    setWeatherAlertSub(null);
  }

  const handleDeleteReview = async (reviewId: string) => {
    if (!reviewId || deletingReviewId) return;
    setDeletingReviewId(reviewId);
    try {
      const res = await deleteTrailReview(trail.id, reviewId);
      setReviewsList((prev) =>
        prev.filter((r) => String(r.id || (r as { _id?: string })._id || '') !== reviewId)
      );
      if (res.data) {
        setRatingOverride({
          rating: Number(res.data.rating) || 0,
          reviewCount: Number(res.data.reviewCount) || 0,
        });
      }
      setConfirmDeleteReviewId(null);
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: { message: res.message || 'Đã xóa đánh giá thành công!', type: 'success' },
        })
      );
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: {
            message: err instanceof Error ? err.message : 'Không thể xóa đánh giá lúc này.',
            type: 'error',
          },
        })
      );
    } finally {
      setDeletingReviewId(null);
    }
  };

  const evidenceLightboxRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(Boolean(selectedEvidencePhoto), evidenceLightboxRef);

  // Escape key closes evidence photo lightbox (LIFO topmost + IME safe)
  useEffect(() => {
    if (!selectedEvidencePhoto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (!isTopmostFocusTrap(evidenceLightboxRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        setSelectedEvidencePhoto(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEvidencePhoto]);

  const navigateToFieldTool = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new CustomEvent('lost:navigate', { detail: { path, trailId: trail.id } }));
  };

  const handleOpenLostAiForTrail = () => {
    window.dispatchEvent(
      new CustomEvent('lost:open-ai-assistant', {
        detail: { trailId: trail.id, trailName: trail.name },
      })
    );
  };

  const handleOpenLiveTrackerForTrail = () => {
    window.dispatchEvent(
      new CustomEvent('lost:open-live-tracker', {
        detail: { trailId: trail.id },
      })
    );
  };

  const handleSubmitGuideReview = async (guideId: string) => {
    if (isSubmittingGuideReview) return;
    if (!currentUser && !localStorage.getItem('lost_token')) {
      onRequireLogin?.('đánh giá Hướng dẫn viên / Porter');
      return;
    }
    setIsSubmittingGuideReview(true);
    try {
      const res = await fetch(`/api/guides/${encodeURIComponent(guideId)}/reviews`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ rating: guideRating, comment: guideComment }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      setGuidesList((prev) => prev.map((g) => (String(g._id || g.id) === String(guideId) ? { ...g, ...data.data } : g)));
      setReviewingGuideId(null);
      setGuideComment('');
      window.dispatchEvent(new CustomEvent('lost:show-toast', { detail: { message: data.message, type: 'success' } }));
    } catch (err: unknown) {
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: {
            message: err instanceof Error ? err.message : 'Không thể gửi đánh giá Porter.',
            type: 'error',
          },
        })
      );
    } finally {
      setIsSubmittingGuideReview(false);
    }
  };

  const getIncidentTypeMeta = (type?: string) => {
    switch (type) {
      case 'landslide':
        return {
          label: 'Sạt lở đất đá & Đứt gãy đường mòn',
          tag: 'Sạt lở địa hình',
          Icon: IconMountain,
          color: 'var(--color-error-text, var(--color-error))',
        };
      case 'flood':
      case 'flash_flood':
        return {
          label: 'Mưa to ngập lũ & Nước suối dâng xiết',
          tag: 'Lũ quét suối dâng',
          Icon: IconDroplet,
          color: 'var(--color-sky)',
        };
      case 'weather':
      case 'bad_weather':
        return {
          label: 'Thời tiết cực đoan, giông lốc & sương mù dày',
          tag: 'Thiên tai thời tiết',
          Icon: IconCloudFog,
          color: 'var(--color-sun)',
        };
      case 'wildlife':
        return {
          label: 'Động vật rừng hoang dã & Rắn/Ong độc',
          tag: 'Sinh vật hoang dã',
          Icon: IconTrees,
          color: 'var(--color-primary)',
        };
      case 'lost':
        return {
          label: 'Mất dấu mòn định hướng & Nguy cơ lạc đường',
          tag: 'Cảnh báo lạc đường',
          Icon: IconCompass,
          color: 'var(--color-earth)',
        };
      default:
        return {
          label: 'Sự cố an toàn địa hình thực địa',
          tag: 'Cảnh báo thực địa',
          Icon: IconAlertTriangle,
          color: 'var(--color-error-text, var(--color-error))',
        };
    }
  };

  const getIncidentSeverityMeta = (sev?: string) => {
    switch (sev) {
      case 'critical':
        return {
          levelCode: 'CẤP 1 · KHẨN CẤP',
          directive: 'Nguy hiểm tính mạng - Tạm dừng & Đình chỉ hành trình',
          bg: 'var(--color-error)',
          border: 'var(--color-error)',
          textColor: 'var(--color-on-danger)',
        };
      case 'high':
        return {
          levelCode: 'CẤP 2 · NGUY CẤP',
          directive: 'Rủi ro cao - Cân nhắc quay lại hoặc dừng chân tại trạm',
          bg: 'var(--color-earth)',
          border: 'var(--color-earth)',
          textColor: 'var(--color-on-primary)',
        };
      case 'medium':
        return {
          levelCode: 'CẤP 3 · TRUNG BÌNH',
          directive: 'Cần quan sát địa hình kỹ & Chuẩn bị phương án dự phòng',
          bg: 'var(--color-sun)',
          border: 'var(--color-sun)',
          textColor: 'var(--color-on-primary)',
        };
      default:
        return {
          levelCode: 'CẤP 4 · LƯU Ý',
          directive: 'Địa hình trơn trượt - Chú ý an toàn khi di chuyển',
          bg: 'var(--color-sky)',
          border: 'var(--color-sky)',
          textColor: 'var(--color-on-primary)',
        };
    }
  };

  // Find active (unresolved) safety incident matching this trail with Vietnamese NFD normalization
  const matchingIncident = React.useMemo(() => {
    if (!incidents || incidents.length === 0) return null;
    const tid = trail.id || (trail as Trail & { _id?: string })._id;
    const normalizeVn = (s: string) =>
      String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]/g, '');
    const normTrail = normalizeVn(trail.name);

    return (
      incidents.find((inc) => {
        if (!inc || inc.resolved || inc.active === false) return false;
        if (inc.trailId && (inc.trailId === tid || inc.trailId === trail.id)) return true;
        if (inc.trailName && normTrail) {
          const normInc = normalizeVn(inc.trailName);
          if (normInc && (normInc.includes(normTrail) || normTrail.includes(normInc))) return true;
        }
        return false;
      }) || null
    );
  }, [trail, incidents]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchReviews = async () => {
      try {
        const res = await fetch(`/api/trails/${encodeURIComponent(trail.id)}/reviews`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!controller.signal.aborted && data.success && Array.isArray(data.data)) {
          setReviewsList(data.data);
        }
      } catch {
        // Offline fallback kept from trail.reviews
      }
    };
    const fetchGuides = async () => {
      try {
        const res = await fetch(`/api/trails/${encodeURIComponent(trail.id)}/guides`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!controller.signal.aborted && data.success && Array.isArray(data.data)) {
          setGuidesList(data.data);
        }
      } catch {
        // Offline fallback kept from trail.guides
      }
    };
    void fetchReviews();
    void fetchGuides();
    return () => {
      controller.abort();
    };
  }, [trail.id]);

  const steepnessPercent =
    trail.distanceKm > 0 ? Math.round((trail.elevationGainM / (trail.distanceKm * 1000)) * 100) : 0;

  const escapeXml = (str: string) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  // GPX 1.1 Download Generator (Safe DOM attach & delayed Blob URL revoke)
  const handleDownloadGpx = () => {
    if (!currentUser && !localStorage.getItem('lost_token')) {
      if (onRequireLogin) onRequireLogin('tải file GPX Offline');
      return;
    }

    if (!trail.gpxTrack || trail.gpxTrack.length === 0) {
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: { message: 'Tuyến đường này chưa có dữ liệu GPS Tracklog chi tiết để xuất file.', type: 'info' },
        })
      );
      return;
    }

    const trackPointsXml = (trail.gpxTrack || [])
      .map((pt: [number, number] | [number, number, number] | { lat?: number; lng?: number; elevationM?: number }) => {
        const lat = Number(Array.isArray(pt) ? pt[0] : pt.lat);
        const lng = Number(Array.isArray(pt) ? pt[1] : pt.lng);
        const ele = Number(Array.isArray(pt) ? pt[2] || 0 : pt.elevationM || 0);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
        return `      <trkpt lat="${lat}" lon="${lng}"><ele>${Number.isFinite(ele) ? ele : 0}</ele></trkpt>`;
      })
      .filter(Boolean)
      .join('\n');

    const safeName = escapeXml(trail.name);
    const safeDesc = escapeXml(trail.description || '');
    const gpxXml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LOST Vietnam - https://lost.vn">
  <metadata>
    <name>${safeName}</name>
    <desc>${safeDesc}</desc>
    <author><name>LOST Community</name></author>
  </metadata>
  <trk>
    <name>${safeName} Trail Track</name>
    <trkseg>
${trackPointsXml}
    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpxXml], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${trail.id}_LOST.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingReview) return;
    if (!currentUser && !localStorage.getItem('lost_token')) {
      if (onRequireLogin) onRequireLogin('gửi đánh giá chuyến đi');
      return;
    }
    if (!newContent.trim()) return;

    const payload = {
      trailId: trail.id,
      rating: newRating,
      difficultyRating: newDiffRating,
      content: newContent.trim(),
      safetyNote: newSafetyNote.trim() || undefined,
    };

    setIsSubmittingReview(true);
    try {
      const savedReview: Review = await submitReview(trail.id, payload);
      setReviewsList((prev) => [savedReview, ...prev]);
      setRatingOverride(null);
      setNewContent('');
      setNewSafetyNote('');
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: { message: 'Đã gửi đánh giá thực địa thành công!', type: 'success' },
        })
      );
    } catch (err: unknown) {
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: {
            message: err instanceof Error ? err.message : 'Không thể gửi đánh giá. Vui lòng thử lại.',
            type: 'error',
          },
        })
      );
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const currentMonth = new Date().getMonth() + 1;

  const transportSteps = trail.transportationInfo
    ? trail.transportationInfo.split(/\.\s+/).filter(Boolean)
    : [
      `Di chuyển từ trung tâm TP. ${trail.province} bằng xe khách/xe máy đến điểm hẹn.`,
      'Bắt đầu chặng đi bộ từ cổng Vườn Quốc Gia / Cửa rừng.',
      'Làm thủ tục đăng ký với Trạm Kiểm Lâm địa phương.',
    ];

  const isOver3000m = trail.maxAltitudeM >= 3000;
  const encodedTrailId = encodeURIComponent(trail.id);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px 60px 20px' }}>
      {/* Navigation & Action Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          padding: '16px 0',
          marginBottom: 16,
        }}
      >
        <button type="button" className="btn btn-outline" onClick={onBack} style={{ gap: 8, display: 'inline-flex', alignItems: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Quay lại danh sách</span>
        </button>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setIsWeatherAlertOpen(true)}
            style={{
              gap: 7,
              display: 'inline-flex',
              alignItems: 'center',
              borderColor: weatherAlertSub?.isActive
                ? 'var(--color-sky)'
                : undefined,
              background: weatherAlertSub?.isActive
                ? 'color-mix(in srgb, var(--color-sky) 12%, transparent)'
                : undefined,
              color: weatherAlertSub?.isActive ? 'var(--color-sky)' : undefined,
            }}
          >
            <IconBell size={15} color={weatherAlertSub?.isActive ? 'var(--color-sky)' : 'currentColor'} />
            <span>{weatherAlertSub?.isActive ? 'Đang Cảnh Báo Thời Tiết' : 'Cảnh Báo Thời Tiết'}</span>
          </button>
          <button type="button" className="btn btn-outline" onClick={handleDownloadGpx} style={{ gap: 8, display: 'inline-flex', alignItems: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Tải GPX Offline</span>
          </button>
          <button type="button" className="btn btn-danger" onClick={onOpenIncidentModal} style={{ gap: 8, display: 'inline-flex', alignItems: 'center' }}>
            <IconAlertTriangle size={15} color="var(--color-on-danger)" />
            <span>Báo cáo nguy hiểm</span>
          </button>
        </div>
      </div>

      {/* Tactical Emergency Safety Incident Banner (Prominently displayed when an incident exists) */}
      {matchingIncident && (() => {
        const typeMeta = getIncidentTypeMeta(matchingIncident.type);
        const sevMeta = getIncidentSeverityMeta(matchingIncident.severity);
        const IncidentIcon = typeMeta.Icon;
        const confirmationsCount = matchingIncident.confirmations || 1;
        const reporterDisplayName = matchingIncident.reporterName || matchingIncident.userName || matchingIncident.reportedBy || 'Trekker thực địa';
        const reporterDisplayRole = matchingIncident.reporterRole || 'Thành viên cộng đồng LOST';
        const locationDisplayName = matchingIncident.locationNote || `${trail.name} (${trail.province})`;
        const elevationDisplay = matchingIncident.elevationM || trail.maxAltitudeM;
        const hotlinePhone = trail.rescueContact?.phone || '112 / 114';
        const dialableHotline = extractPrimaryDialNumber(hotlinePhone, '112');
        const rangerUnit = trail.rescueContact?.rangerContact || `Trạm Kiểm Lâm ${trail.province}`;
        const formattedReportedAt = formatVnDate(matchingIncident.reportedAt);

        return (
          <div
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--banner-danger-border)',
              borderLeft: '3px solid var(--color-error)',
              borderRadius: 4,
              padding: '20px 22px',
              marginBottom: 24,
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* 1. Header Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 4,
                    background: 'color-mix(in srgb, var(--color-error) 14%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-error) 36%, transparent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-error-text, var(--color-error))',
                    flexShrink: 0,
                  }}
                >
                  <IconShieldAlert size={20} color="var(--color-error-text, var(--color-error))" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="font-editorial" style={{ fontSize: '1.22rem', fontWeight: 500, color: 'var(--color-error-text, var(--color-error))' }}>
                      Cảnh Báo An Toàn Thực Địa
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        background: sevMeta.bg,
                        color: sevMeta.textColor,
                        padding: '3px 8px',
                        borderRadius: 3,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {sevMeta.levelCode}
                    </span>
                    <span className="badge badge-success">
                      <IconCheckCircle size={12} color="var(--color-primary)" />
                      <span>{confirmationsCount} Xác thực</span>
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
                    Hồ sơ cảnh báo khẩn cấp dành cho người leo núi &amp; đơn vị cứu hộ · {sevMeta.directive}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <a
                  href={`tel:${dialableHotline}`}
                  className="btn btn-outline"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--color-error) 45%, transparent)',
                    color: 'var(--color-error-text, var(--color-error))',
                    padding: '7px 14px',
                    fontSize: '0.78rem',
                  }}
                >
                  <IconPhone size={14} color="var(--color-error-text, var(--color-error))" />
                  <span>Gọi cứu nạn: {hotlinePhone}</span>
                </a>

                <button
                  type="button"
                  onClick={onOpenIncidentModal}
                  className="btn btn-danger"
                  style={{ padding: '7px 14px', fontSize: '0.78rem' }}
                >
                  <IconAlertTriangle size={14} color="var(--color-on-danger)" />
                  <span>Cập nhật tình hình mới</span>
                </button>
              </div>
            </div>

            {/* 2. 4 Telemetry Hairline Metric Tiles */}
            <div className="editorial-stat-strip">
              <div className="editorial-stat-cell" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 4,
                    background: `color-mix(in srgb, ${typeMeta.color} 14%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${typeMeta.color} 32%, transparent)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: typeMeta.color,
                    flexShrink: 0,
                  }}
                >
                  <IncidentIcon size={17} color={typeMeta.color} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: 'var(--color-text-dim)', fontWeight: 700, letterSpacing: '0.08em' }}>
                    Phân loại hiểm họa
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)', marginTop: 2, lineHeight: 1.35 }}>
                    {typeMeta.label}
                  </div>
                </div>
              </div>

              <div className="editorial-stat-cell" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 4,
                    background: 'color-mix(in srgb, var(--color-sky) 14%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-sky) 32%, transparent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-sky)',
                    flexShrink: 0,
                  }}
                >
                  <IconMapPin size={17} color="var(--color-sky)" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: 'var(--color-text-dim)', fontWeight: 700, letterSpacing: '0.08em' }}>
                    Khu vực &amp; Cao độ
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)', marginTop: 2, lineHeight: 1.35 }}>
                    {locationDisplayName}
                  </div>
                  {elevationDisplay && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                      Cao độ: ~{elevationDisplay}m
                    </div>
                  )}
                </div>
              </div>

              <div className="editorial-stat-cell" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 4,
                    background: 'color-mix(in srgb, var(--color-stream) 14%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-stream) 32%, transparent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-stream)',
                    flexShrink: 0,
                  }}
                >
                  <IconUsers size={17} color="var(--color-stream)" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: 'var(--color-text-dim)', fontWeight: 700, letterSpacing: '0.08em' }}>
                    Nguồn báo cáo
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)', marginTop: 2, lineHeight: 1.35 }}>
                    {reporterDisplayName}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                    {reporterDisplayRole}
                  </div>
                </div>
              </div>

              <div className="editorial-stat-cell" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 4,
                    background: 'color-mix(in srgb, var(--color-sun) 14%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-sun) 32%, transparent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-sun)',
                    flexShrink: 0,
                  }}
                >
                  <IconClock size={17} color="var(--color-sun)" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: 'var(--color-text-dim)', fontWeight: 700, letterSpacing: '0.08em' }}>
                    Thời gian &amp; Hiệu lực
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)', marginTop: 2 }}>
                    {formattedReportedAt}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-error-text, var(--color-error))', fontWeight: 600 }}>
                    Đang có hiệu lực khẩn
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Detailed Incident Description Box */}
            <div
              style={{
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
                borderLeft: '3px solid var(--color-error)',
                borderRadius: 4,
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-error-text, var(--color-error))', fontWeight: 700, letterSpacing: '0.08em' }}>
                Diễn biến chi tiết tại hiện trường
              </div>
              <div style={{ fontSize: '0.92rem', color: 'var(--color-text-main)', lineHeight: 1.65 }}>
                {matchingIncident.description}
              </div>
            </div>

            {/* 4. Field Evidence Photos */}
            {matchingIncident.images && matchingIncident.images.length > 0 && (
              <div>
                <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--color-text-dim)', fontWeight: 800, letterSpacing: '0.04em', marginBottom: 8 }}>
                  Ảnh bằng chứng ghi nhận tại hiện trường ({matchingIncident.images.length} ảnh):
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {matchingIncident.images.map((img: string, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedEvidencePhoto(img)}
                      aria-label={`Phóng to ảnh hiện trường ${idx + 1}`}
                      style={{
                        position: 'relative',
                        width: 90,
                        height: 65,
                        borderRadius: 4,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        padding: 0,
                        border: '1px solid color-mix(in srgb, var(--color-error) 45%, transparent)',
                        boxShadow: 'var(--shadow-card)',
                      }}
                    >
                      <img src={img} alt={`Hiện trường ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Actionable Field Safety Directives */}
            <div
              style={{
                background: 'color-mix(in srgb, var(--color-error) 7%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-error) 28%, transparent)',
                borderRadius: 4,
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-error-text, var(--color-error))', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                <IconAlertTriangle size={14} color="var(--color-error-text, var(--color-error))" />
                <span>Chỉ dẫn an toàn bắt buộc trên tuyến</span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 12,
                  fontSize: '0.8rem',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.55,
                }}
              >
                <div>
                  <strong style={{ color: 'var(--color-text-main)' }}>01 · Vượt suối &amp; sạt lở:</strong> Tuyệt đối không mạo hiểm vượt suối khi nước cao ngang đùi hoặc chảy đục xiết. Tránh xa các vách taluy đất yếu.
                </div>
                <div>
                  <strong style={{ color: 'var(--color-text-main)' }}>02 · Tracklog &amp; Đội hình:</strong> Bám sát đường mòn GPX đã tải Offline, luôn đi theo đoàn tối thiểu 3 người, không tự ý tách nhóm mở lối tắt.
                </div>
                <div>
                  <strong style={{ color: 'var(--color-text-main)' }}>03 · Liên lạc &amp; Cứu hộ:</strong> Tiết kiệm pin thiết bị, giữ ấm cơ thể và chuẩn bị còi cứu sinh SOS khi thời tiết xấu hoặc mất định hướng.
                </div>
              </div>
            </div>

            {/* 6. Emergency Contacts & National Hotline Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                paddingTop: 10,
                borderTop: '1px solid var(--color-border)',
                fontSize: '0.8rem',
                color: 'var(--color-text-dim)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-error-text, var(--color-error))', fontWeight: 700 }}>
                  <IconPhone size={14} color="var(--color-error-text, var(--color-error))" />
                  <span>Cứu Nạn Quốc Gia: <strong>112 / 114 / 115 (24/7)</strong></span>
                </span>
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {rangerUnit}: <strong style={{ color: 'var(--color-text-main)' }}>{hotlinePhone}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.74rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                <span>Mã sự cố: <code style={{ color: 'var(--color-error-text, var(--color-error))', background: 'color-mix(in srgb, var(--color-error) 10%, var(--color-bg-card))', padding: '2px 6px', borderRadius: 3 }}>LS-{matchingIncident.id ? matchingIncident.id.slice(-6).toUpperCase() : 'ALERT'}</code></span>
                <span>Cập nhật: {formattedReportedAt}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Swiss Editorial Monumental Hero Header */}
      <div style={{ position: 'relative', borderRadius: 4, overflow: 'hidden', height: 420, marginBottom: 20, border: '1px solid var(--color-border)' }}>
        <div key={`cover-${trail.id}`} className="scene-cover-cinematic" style={{ width: '100%', height: '100%' }}>
          <OptimizedImage
            src={trail.coverImage}
            alt={trail.name}
            targetWidth={1280}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <div key={`veil-${trail.id}`} className="hero-scene-veil" aria-hidden="true" />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(180deg, color-mix(in srgb, var(--overlay-bg) 35%, transparent) 0%, color-mix(in srgb, var(--overlay-bg) 72%, transparent) 48%, var(--overlay-bg) 100%), linear-gradient(180deg, transparent 30%, var(--overlay-bg) 100%)',
          }}
        />

        <div
          key={`hero-meta-${trail.id}`}
          className="hero-peak-drop-in"
          style={{
            position: 'absolute',
            bottom: 28,
            left: 28,
            right: 28,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: 20,
          }}
        >
          <div style={{ maxWidth: 720 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--color-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {trail.region} · {trail.province}
                {trail.startLat ? ` · ${trail.startLat.toFixed(2)}°N` : ''}
              </span>
              {trail.permitRequired && (
                <span className="badge badge-error">Yêu cầu Giấy phép Kiểm Lâm</span>
              )}
            </div>

            <h1
              className="font-editorial"
              style={{
                fontSize: 'clamp(2.1rem, 4.2vw, 3.2rem)',
                fontWeight: 500,
                color: 'var(--color-on-media)',
                lineHeight: 1.06,
                letterSpacing: '-0.03em',
                margin: 0,
              }}
            >
              {trail.name}
            </h1>
            {trail.altNames && trail.altNames.length > 0 && (
              <div style={{ color: 'color-mix(in srgb, var(--color-on-media) 80%, transparent)', fontSize: '0.9rem', marginTop: 8 }}>
                Tên gọi khác: {trail.altNames.join(', ')}
              </div>
            )}
          </div>

          <div
            style={{
              background: 'var(--overlay-bg)',
              backdropFilter: 'blur(12px)',
              padding: '12px 18px',
              borderRadius: 4,
              border: '1px solid color-mix(in srgb, var(--color-on-media) 16%, transparent)',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
            }}
          >
            <div>
              <div style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'color-mix(in srgb, var(--color-on-media) 68%, transparent)', marginBottom: 3 }}>
                Đánh giá cộng đồng
              </div>
              <div style={{ fontSize: '1.18rem', fontWeight: 700, color: 'var(--color-sun)', display: 'flex', alignItems: 'center', gap: 5, fontVariantNumeric: 'tabular-nums' }}>
                {ratingOverride !== null ? (
                  ratingOverride.reviewCount > 0 && ratingOverride.rating > 0 ? (
                    <>
                      <IconStar size={16} color="var(--color-sun)" fill="var(--color-sun)" />{' '}
                      {ratingOverride.rating.toFixed(1)}{' '}
                      <span style={{ fontSize: '0.8rem', color: 'color-mix(in srgb, var(--color-on-media) 72%, transparent)', fontWeight: 500 }}>
                        ({ratingOverride.reviewCount} bài)
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.84rem', color: 'color-mix(in srgb, var(--color-on-media) 78%, transparent)', fontWeight: 500 }}>
                      Chưa có đánh giá
                    </span>
                  )
                ) : reviewsList.length > 0 ? (
                  <>
                    <IconStar size={16} color="var(--color-sun)" fill="var(--color-sun)" />{' '}
                    {(reviewsList.reduce((acc, r) => acc + (r.rating || 5), 0) / reviewsList.length).toFixed(1)}{' '}
                    <span style={{ fontSize: '0.8rem', color: 'color-mix(in srgb, var(--color-on-media) 72%, transparent)', fontWeight: 500 }}>
                      ({reviewsList.length} bài)
                    </span>
                  </>
                ) : trail.reviewCount && trail.reviewCount > 0 && trail.rating && trail.rating > 0 && trail.reviewCount !== 1 ? (
                  <>
                    <IconStar size={16} color="var(--color-sun)" fill="var(--color-sun)" /> {Number(trail.rating).toFixed(1)}{' '}
                    <span style={{ fontSize: '0.8rem', color: 'color-mix(in srgb, var(--color-on-media) 72%, transparent)', fontWeight: 500 }}>
                      ({trail.reviewCount} bài)
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: '0.84rem', color: 'color-mix(in srgb, var(--color-on-media) 78%, transparent)', fontWeight: 500 }}>
                    Chưa có đánh giá
                  </span>
                )}
              </div>
            </div>
            <div style={{ borderLeft: '1px solid color-mix(in srgb, var(--color-on-media) 18%, transparent)', paddingLeft: 18 }}>
              <div style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'color-mix(in srgb, var(--color-on-media) 68%, transparent)', marginBottom: 3 }}>
                Mức độ khó
              </div>
              <div className="font-editorial" style={{ fontSize: '1.25rem', fontWeight: 500, color: trail.difficultyLevel >= 4 ? 'var(--color-error-text, var(--color-error))' : 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                Cấp {trail.difficultyLevel}/5
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Swiss Hairline Telemetry Strip */}
      <div className="editorial-stat-strip" style={{ marginBottom: 20 }}>
        <div className="editorial-stat-cell">
          <span style={{ color: 'var(--color-text-dim)', fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Chiều dài</span>
          <span className="font-editorial" style={{ fontSize: '1.65rem', fontWeight: 500, color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{trail.distanceKm} km</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {trail.durationDays > 1 ? `Hành trình ${trail.durationDays} ngày` : 'Đi về trong ngày'}
          </span>
        </div>
        <div className="editorial-stat-cell">
          <span style={{ color: 'var(--color-text-dim)', fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Độ cao tích lũy</span>
          <span className="font-editorial" style={{ fontSize: '1.65rem', fontWeight: 500, color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>+{trail.elevationGainM} m</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Độ dốc ~{steepnessPercent}%</span>
        </div>
        <div className="editorial-stat-cell">
          <span style={{ color: 'var(--color-text-dim)', fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Cao độ đỉnh</span>
          <span className="font-editorial" style={{ fontSize: '1.65rem', fontWeight: 500, color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{trail.maxAltitudeM.toLocaleString('vi-VN')} m</span>
          <span style={{ fontSize: '0.75rem', color: isOver3000m ? 'var(--color-sun)' : 'var(--color-text-muted)' }}>{isOver3000m ? 'Đỉnh trên 3.000m' : trail.province}</span>
        </div>
        <div className="editorial-stat-cell">
          <span style={{ color: 'var(--color-text-dim)', fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Thời gian di chuyển</span>
          <span className="font-editorial" style={{ fontSize: '1.65rem', fontWeight: 500, color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{trail.durationHoursNote}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {trail.durationDays > 1 ? `${trail.durationDays} ngày ${trail.durationDays - 1} đêm` : 'Trong ngày (1N0Đ)'}
          </span>
        </div>
        <div className="editorial-stat-cell">
          <span style={{ color: 'var(--color-text-dim)', fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Tiện ích thực địa</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {trail.hasCampsite && <span className="badge badge-stream" title="Có bãi cắm trại">Bãi trại</span>}
            {trail.hasWaterSource && <span className="badge badge-cloud" title="Có nguồn nước">Nguồn nước</span>}
            {trail.kidFriendly && <span className="badge badge-success" title="Phù hợp trẻ em">Trẻ em</span>}
          </div>
        </div>
      </div>

      {/* Trail Intelligence Bar: Wishlist, Offline Pack, Real 3D Terrain, AI Go/No-Go, Permit & Safety Timer */}
      <TrailIntelligenceBar trail={trail} currentUser={currentUser} onRequireLogin={onRequireLogin} />

      {/* Field-Atlas Quick-Launch Bar: Công Cụ Thực Địa Cho Cung Này */}
      <div
        className="card"
        style={{
          marginBottom: 22,
          padding: '12px 16px',
          borderRadius: 6,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
              border: '1px solid var(--color-border-glow)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)',
              flexShrink: 0,
            }}
          >
            <IconCompass size={14} color="var(--color-primary)" />
          </span>
          <span style={{ fontSize: '0.76rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
            Công Cụ Thực Địa Cho Cung Này
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigateToFieldTool(`/training?trailId=${encodedTrailId}`)}
            style={{ padding: '6px 11px', fontSize: '0.78rem', borderRadius: 4 }}
          >
            <IconHiking size={14} color="var(--color-primary)" />
            <span>Giáo án Thể lực</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigateToFieldTool(`/directory?trailId=${encodedTrailId}`)}
            style={{ padding: '6px 11px', fontSize: '0.78rem', borderRadius: 4 }}
          >
            <IconUsers size={14} color="var(--color-sky)" />
            <span>Ước tính Chi phí &amp; Kiểm lâm</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigateToFieldTool(`/planner?trailId=${encodedTrailId}`)}
            style={{ padding: '6px 11px', fontSize: '0.78rem', borderRadius: 4 }}
          >
            <IconMountain size={14} color="var(--color-earth)" />
            <span>Phân tích GPX</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigateToFieldTool(`/toolkit?trailId=${encodedTrailId}&tab=solar`)}
            style={{ padding: '6px 11px', fontSize: '0.78rem', borderRadius: 4 }}
          >
            <IconSun size={14} color="var(--color-sun)" />
            <span>Tính Giờ Săn mây</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={handleOpenLiveTrackerForTrail}
            style={{
              padding: '6px 11px',
              fontSize: '0.78rem',
              borderRadius: 4,
              borderColor: 'color-mix(in srgb, var(--color-primary) 45%, transparent)',
              background: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card))',
              color: 'var(--color-primary)',
              fontWeight: 700,
            }}
          >
            <IconCompass size={14} color="var(--color-primary)" />
            <span>Leo Núi Trực Tiếp (Live GPS)</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenLostAiForTrail}
            style={{ padding: '6px 12px', fontSize: '0.78rem', borderRadius: 4 }}
          >
            <IconSparkles size={14} color="var(--color-on-primary)" />
            <span>Hỏi LOST AI</span>
          </button>
        </div>
      </div>

      {/* Editorial Tab Navigation Header (Liquid Glider + 100% Pure SVG Icons on All 9 Tabs) */}
      <div ref={detailTabTrackRef} className="editorial-tabs-bar has-glider">
        <span aria-hidden="true" className="lost-glider-tab" style={detailTabIndicatorStyle} />
        {[
          {
            id: 'overview',
            label: 'Tổng quan',
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            ),
          },
          {
            id: 'map',
            label: 'Bản đồ GPX 3D',
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
            ),
          },
          {
            id: 'weather',
            label: 'Thời tiết 7 ngày & Săn mây',
            icon: <IconCloudFog size={14} />,
          },
          {
            id: 'checklist',
            label: 'Danh mục đồ đạc',
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            ),
          },
          {
            id: 'itinerary',
            label: 'Lịch trình & Chia sẻ',
            icon: <IconCalendar size={14} />,
          },
          {
            id: 'guides',
            label: 'Hướng dẫn viên & Porter',
            icon: <IconUsers size={14} />,
          },
          {
            id: 'reviews',
            label: `Nhận xét (${reviewsList.length})`,
            icon: <IconStar size={14} />,
          },
          {
            id: 'conditions',
            label: 'Tình trạng thực địa',
            icon: <IconAlertTriangle size={14} />,
          },
          {
            id: 'pois',
            label: 'Thực Địa & Nước',
            icon: <IconDroplet size={14} />,
          },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-glider-active={isActive ? 'true' : undefined}
              onClick={() => setActiveTab(tab.id as DetailTabId)}
              className={`editorial-tab-btn${isActive ? ' active' : ''}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sliding Tab Contents */}
      <div key={activeTab} className="tab-content-slide">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="detail-split-grid">
            <div>
              <div className="card" style={{ marginBottom: 24 }}>
                <div className="section-eyebrow" style={{ marginBottom: 6 }}>Biểu đồ địa hình</div>
                <h3 className="font-editorial" style={{ fontSize: '1.45rem', fontWeight: 500, color: 'var(--color-text-main)', marginBottom: 14 }}>
                  Đồ Thị Trắc Diện Cao Độ
                </h3>
                <ElevationProfileSVG
                  trailId={trail.id}
                  gpxTrack={trail.gpxTrack}
                  elevationGainM={trail.elevationGainM}
                  maxAltitudeM={trail.maxAltitudeM}
                  distanceKm={trail.distanceKm}
                  waypoints={trail.waypoints}
                  onHoverCoordinate={setHoveredElevationCoord}
                />
              </div>

              <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 12 }}>
                  Giới thiệu cung đường
                </h3>
                <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.7, fontSize: '0.95rem' }}>
                  {trail.description}
                </p>
              </div>

              {/* Transportation Guide Stepper */}
              <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>
                    Hướng Dẫn Di Chuyển Đến Điểm Xuất Phát
                  </h3>

                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${trail.startLat},${trail.startLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline"
                    style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: 4 }}
                  >
                    Mở Google Maps chỉ đường
                  </a>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {transportSteps.map((stepText: string, idx: number) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <span style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)', fontSize: '0.78rem', fontWeight: 800, width: 24, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {idx + 1}
                      </span>
                      <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', lineHeight: 1.55, paddingTop: 2 }}>
                        {stepText.trim()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Responsive 12-Month Season Calendar */}
              <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 6 }}>
                  Lịch Mùa Trekking Trong Năm
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--color-text-dim)', marginBottom: 16 }}>
                  Xanh lá = Mùa đẹp nhất · Viền vàng = Tháng hiện tại (T{currentMonth}) · Đỏ = Tránh đi do mưa lũ
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(58px, 1fr))', gap: 6, textAlign: 'center' }}>
                  {months.map((m) => {
                    const isBest = trail.bestMonths.includes(m);
                    const isAvoid = trail.avoidMonths.includes(m);
                    const isCurrent = m === currentMonth;

                    let bg = 'var(--color-bg-main)';
                    let color = 'var(--color-text-muted)';
                    let tooltip = `Tháng ${m}: Thời tiết bình thường`;

                    if (isBest) {
                      bg = 'var(--color-primary)';
                      color = 'var(--color-on-primary)';
                      tooltip = `Tháng ${m}: Mùa vàng lý tưởng, nắng đẹp, ít mưa`;
                    }
                    if (isAvoid) {
                      bg = 'var(--color-error)';
                      color = 'var(--color-on-danger)';
                      tooltip = `Tháng ${m}: Mưa lớn, nguy cơ sạt lở & trơn trượt`;
                    }

                    return (
                      <div
                        key={m}
                        title={tooltip}
                        style={{
                          background: bg,
                          color,
                          padding: '10px 4px',
                          borderRadius: 4,
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          border: isCurrent ? '2px solid var(--color-sun)' : '1px solid var(--color-border)',
                          cursor: 'help',
                        }}
                      >
                        <div>T{m}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Expandable 12-Month ERA5 Summit Climate Chart inside Overview */}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      Xem nhiệt độ đỉnh &amp; lượng mưa thực đo 3 năm (Open-Meteo ERA5) theo từng tháng
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline"
                      aria-expanded={showOverviewClimateChart}
                      onClick={() => setShowOverviewClimateChart((v) => !v)}
                      style={{ padding: '5px 11px', fontSize: '0.76rem', borderRadius: 4 }}
                    >
                      <IconCloudFog size={13} color="var(--color-sky)" />
                      <span>{showOverviewClimateChart ? 'Thu gọn biểu đồ ERA5' : 'Mở biểu đồ khí hậu ERA5'}</span>
                    </button>
                  </div>
                  {showOverviewClimateChart && (
                    <div style={{ marginTop: 12 }}>
                      <SummitClimateChart trail={trail} compact />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            <div>
              {/* Permit & Ranger Note Alert */}
              <div
                className="card"
                style={{
                  border: `1px solid ${trail.permitRequired
                    ? 'color-mix(in srgb, var(--color-error) 40%, transparent)'
                    : 'color-mix(in srgb, var(--color-primary) 40%, transparent)'
                    }`,
                  marginBottom: 20,
                }}
              >
                <h4
                  style={{
                    color: trail.permitRequired ? 'var(--color-error-text, var(--color-error))' : 'var(--color-primary)',
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    marginBottom: 12,
                  }}
                >
                  {trail.permitRequired ? 'Yêu cầu Giấy phép VQG' : 'Tự do trekking'}
                </h4>

                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
                  {trail.permitRequired
                    ? trail.permitInfo || 'Cần đăng ký danh sách thông tin đoàn và nộp phí bảo tồn với Trạm Kiểm Lâm trước khi trekking.'
                    : 'Cung đường mở tự do, không yêu cầu giấy phép xin trước.'}
                </p>

                {trail.permitRequired && (
                  <div style={{ background: 'var(--color-bg-main)', padding: 10, borderRadius: 4, border: '1px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>- Đăng ký CCCD/CMND các thành viên</div>
                    <div>- Nộp phí vé tham quan Vườn Quốc Gia</div>
                    <div>- Bắt buộc có Porter/HDV địa phương dẫn đường</div>
                  </div>
                )}
              </div>

              {/* Local Rescue & Ranger Contact */}
              <div className="card" style={{ border: '1px solid color-mix(in srgb, var(--color-error) 40%, transparent)' }}>
                <h4 style={{ color: 'var(--color-error-text, var(--color-error))', fontSize: '1.05rem', fontWeight: 700, marginBottom: 12 }}>
                  Hotline Cứu hộ địa phương
                </h4>
                <div style={{ fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div style={{ color: 'var(--color-text-dim)', fontSize: '0.75rem' }}>Đội cứu hộ khu vực:</div>
                    <strong style={{ color: 'var(--color-text-main)' }}>
                      {trail.rescueContact?.name || 'Tổng đài Cứu nạn Quốc gia 112 / 114'}
                    </strong>
                    <div>
                      <a
                        href={`tel:${extractPrimaryDialNumber(trail.rescueContact?.phone, '112')}`}
                        style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 700 }}
                      >
                        SĐT: {trail.rescueContact?.phone || '112 / 114'}
                      </a>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                    <div style={{ color: 'var(--color-text-dim)', fontSize: '0.75rem' }}>Trạm kiểm lâm:</div>
                    <div style={{ color: 'var(--color-text-muted)' }}>
                      {trail.rescueContact?.rangerContact || `Trạm Kiểm Lâm ${trail.province}`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MAP & LIVE GPS */}
        {activeTab === 'map' && (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--color-text-main)', fontWeight: 700 }}>
                Bản đồ GPS Tuyến đường &amp; Live GPS Tracking
              </h3>
            </div>

            <MapView
              trails={[trail]}
              selectedTrail={trail}
              incidents={incidents}
              height="550px"
              highlightedPoint={hoveredElevationCoord}
            />

            <div style={{ marginTop: 18 }}>
              <ElevationProfileSVG
                trailId={trail.id}
                gpxTrack={trail.gpxTrack}
                elevationGainM={trail.elevationGainM}
                maxAltitudeM={trail.maxAltitudeM}
                distanceKm={trail.distanceKm}
                waypoints={trail.waypoints}
                height={155}
                onHoverCoordinate={setHoveredElevationCoord}
              />
            </div>

            <div style={{ marginTop: 24 }}>
              <h4 style={{ fontSize: '1.1rem', color: 'var(--color-text-main)', marginBottom: 12 }}>
                Danh sách điểm mốc (Waypoints)
              </h4>
              {!trail.waypoints || trail.waypoints.length === 0 ? (
                <div
                  className="card"
                  style={{
                    textAlign: 'center',
                    padding: '28px 20px',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.88rem',
                    borderStyle: 'dashed',
                  }}
                >
                  Chưa có điểm mốc tọa độ (Waypoint) được ghim cho cung đường này. Bạn có thể xem tuyến tracklog trực tiếp trên bản đồ GPX phía trên.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))', gap: 16 }}>
                  {trail.waypoints.map((wp) => (
                    <div key={wp.id} className="card">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                        <strong style={{ color: 'var(--color-primary)', fontSize: '0.95rem' }}>{wp.name}</strong>
                        <span className="badge badge-cloud">
                          {WAYPOINT_TYPE_LABELS[wp.type] || 'Điểm mốc'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{wp.description}</p>
                      {wp.elevationM && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', marginTop: 6 }}>
                          Cao độ: {wp.elevationM.toLocaleString('vi-VN')}m
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: WEATHER & CLOUD HUNTING + ERA5 12-MONTH SUMMIT CLIMATE */}
        {activeTab === 'weather' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <WeatherTab trail={trail} />
            <SummitClimateChart trail={trail} />
          </div>
        )}

        {/* TAB 4: GEAR CHECKLIST & BALO CALCULATOR */}
        {activeTab === 'checklist' && <GearChecklistTab trail={trail} />}

        {/* TAB 5: EXPEDITION TIMELINE & SHARE */}
        {activeTab === 'itinerary' && <ItineraryTab key={trail.id} trail={trail} />}

        {/* TAB 6: GUIDES & PORTERS */}
        {activeTab === 'guides' && (
          <div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--color-text-main)', fontWeight: 700, marginBottom: 16 }}>
              Hướng dẫn viên &amp; Porter địa phương uy tín
            </h3>

            {(guidesList.length > 0 ? guidesList : trail.guides || []).length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 36, color: 'var(--color-text-muted)' }}>
                Chưa có danh sách Porter / HDV đăng ký cho cung đường này. Bạn có thể liên hệ trực tiếp Trạm Kiểm Lâm / Ban Quản Lý địa phương để được giới thiệu HDV bản địa có giấy phép.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: 20 }}>
                {(guidesList.length > 0 ? guidesList : trail.guides || []).map((guide) => (
                  <div key={guide.id || guide._id} className="card" style={{ border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <h4 style={{ fontSize: '1rem', color: 'var(--color-text-main)', fontWeight: 700, margin: 0 }}>{guide.name}</h4>
                      {guide.verified ? (
                        <span className="badge badge-success" style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)', fontSize: '0.72rem', padding: '3px 8px', borderRadius: 4, flexShrink: 0 }}>
                          Đã Xác Minh
                        </span>
                      ) : (
                        <span className="badge badge-cloud" style={{ fontSize: '0.72rem', flexShrink: 0 }}>Porter Địa Phương</span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>
                      Khu vực phụ trách: {guide.region}{guide.rating ? ` · Đánh giá: ${Number(guide.rating).toFixed(1)}/5` : ''}
                    </div>

                    {guide.priceNote && (
                      <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 10, borderRadius: 4, fontSize: '0.8rem', color: 'var(--color-primary)', marginBottom: 14, fontWeight: 600 }}>
                        Chi phí / Giá dịch vụ: {guide.priceNote}
                      </div>
                    )}

                    {guide.phone ? (
                      <a
                        href={`tel:${extractPrimaryDialNumber(guide.phone, '112')}`}
                        className="btn btn-outline"
                        style={{ width: '100%', justifyContent: 'center', borderRadius: 4, fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <IconPhone size={14} color="var(--color-primary)" />
                        Liên hệ trực tiếp ({guide.phone})
                      </a>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', textAlign: 'center', padding: 8, borderRadius: 4, background: 'var(--color-bg-main)' }}>
                        Liên hệ qua Ban Quản Lý VQG / Hạt Kiểm Lâm địa phương
                      </div>
                    )}

                    {guide._id && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
                        {reviewingGuideId === String(guide._id) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <select
                              className="form-select"
                              aria-label="Đánh giá số sao cho Porter hoặc Hướng dẫn viên"
                              value={guideRating}
                              onChange={(e) => setGuideRating(Number(e.target.value))}
                              style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                            >
                              <option value={5}>5 sao - Rất tận tâm &amp; thông thạo địa hình</option>
                              <option value={4}>4 sao - Tốt</option>
                              <option value={3}>3 sao - Bình thường</option>
                              <option value={2}>2 sao - Cần cải thiện</option>
                              <option value={1}>1 sao - Không khuyến nghị</option>
                            </select>
                            <input
                              className="form-input"
                              aria-label="Nhận xét thực tế về chuyến đi cùng Porter"
                              value={guideComment}
                              onChange={(e) => setGuideComment(e.target.value)}
                              placeholder="Nhận xét thực tế về chuyến đi cùng Porter..."
                              style={{ fontSize: '0.8rem', padding: '7px 10px' }}
                            />
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-primary"
                                disabled={isSubmittingGuideReview}
                                onClick={() => handleSubmitGuideReview(String(guide._id))}
                                style={{ flex: 1, padding: '6px 10px', fontSize: '0.78rem', borderRadius: 4 }}
                              >
                                {isSubmittingGuideReview ? 'Đang gửi...' : 'Gửi Đánh Giá'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => setReviewingGuideId(null)}
                                style={{ padding: '6px 10px', fontSize: '0.78rem', borderRadius: 4 }}
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => setReviewingGuideId(String(guide._id))}
                            style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem', padding: '6px 10px', borderRadius: 4 }}
                          >
                            <IconStar size={13} color="var(--color-sun)" /> Đánh Giá Porter / HDV ({guide.reviewCount || 0})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 7: TRAIL CONDITIONS (REAL-TIME) */}
        {activeTab === 'conditions' && (
          <div style={{ marginTop: 12 }}>
            <TrailConditionSection trailId={trail.id} currentUser={currentUser} />
          </div>
        )}

        {/* TAB 8: COMMUNITY REVIEWS */}
        {activeTab === 'reviews' && (
          <div className="detail-split-grid">
            <div>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--color-text-main)', fontWeight: 700, marginBottom: 16 }}>
                Cộng đồng Đánh giá ({reviewsList.length})
              </h3>

              {reviewsList.length === 0 ? (
                <div
                  className="card"
                  style={{
                    textAlign: 'center',
                    padding: '36px 20px',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.88rem',
                    borderStyle: 'dashed',
                  }}
                >
                  Chưa có đánh giá thực địa nào cho cung đường này. Nếu bạn đã chinh phục {trail.name}, hãy chia sẻ kinh nghiệm ở khung bên phải!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {reviewsList.map((rev) => {
                    const revId = String(rev.id || (rev as { _id?: string })._id || '');
                    const rawOwner = rev.userId as unknown;
                    const revOwnerId =
                      rawOwner && typeof rawOwner === 'object'
                        ? String((rawOwner as { _id?: string; id?: string })._id || (rawOwner as { id?: string }).id || '')
                        : String(rawOwner || '');
                    const viewerId = String(currentUser?.id || currentUser?._id || '');
                    const isSelfReview = Boolean(
                      currentUser &&
                      ((revOwnerId && viewerId && revOwnerId === viewerId) ||
                        (currentUser.fullName && rev.userName.toLowerCase() === currentUser.fullName.toLowerCase()))
                    );
                    const isPrivileged = currentUser?.role === 'admin' || currentUser?.role === 'moderator';
                    const isDbObjectId = /^[0-9a-fA-F]{24}$/.test(revId);
                    const canDelete = Boolean(isDbObjectId && currentUser && (isSelfReview || isPrivileged));
                    const isConfirmingDelete = confirmDeleteReviewId === revId;
                    const isDeletingThis = deletingReviewId === revId;
                    const effectiveRevAvatar =
                      isSelfReview && (currentUser?.avatarUrl || currentUser?.avatar)
                        ? currentUser.avatarUrl || currentUser.avatar
                        : rev.userAvatar || VERIFIED_AVATAR_FALLBACK;

                    return (
                      <div key={revId || rev.id} className="card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <img
                              src={effectiveRevAvatar}
                              alt={rev.userName}
                              style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--color-border)' }}
                            />
                            <div>
                              <strong style={{ color: 'var(--color-text-main)', fontSize: '0.95rem' }}>{rev.userName}</strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
                                Ngày đi: {formatVnDate(rev.tripDate || rev.createdAt)}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ color: 'var(--color-sun)', fontWeight: 700, fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <IconStar size={13} color="var(--color-sun)" fill="var(--color-sun)" />
                              <span>{rev.rating}/5</span>
                            </div>

                            {canDelete && (
                              isConfirmingDelete ? (
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '3px 8px',
                                    borderRadius: 4,
                                    background: 'color-mix(in srgb, var(--color-error) 12%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
                                  }}
                                >
                                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-error-text, var(--color-error))' }}>
                                    Xóa đánh giá?
                                  </span>
                                  <button
                                    type="button"
                                    disabled={isDeletingThis}
                                    onClick={() => handleDeleteReview(revId)}
                                    style={{
                                      padding: '3px 8px',
                                      borderRadius: 4,
                                      border: 'none',
                                      background: 'var(--color-error)',
                                      color: 'var(--color-on-danger)',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      cursor: isDeletingThis ? 'wait' : 'pointer',
                                      opacity: isDeletingThis ? 0.7 : 1,
                                    }}
                                  >
                                    {isDeletingThis ? 'Đang xóa...' : 'Xác nhận'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isDeletingThis}
                                    onClick={() => setConfirmDeleteReviewId(null)}
                                    style={{
                                      padding: '3px 8px',
                                      borderRadius: 4,
                                      border: '1px solid var(--color-border-strong)',
                                      background: 'var(--color-bg-card)',
                                      color: 'var(--color-text-muted)',
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Hủy
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteReviewId(revId)}
                                  title="Xóa đánh giá này"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '4px 8px',
                                    borderRadius: 4,
                                    border: '1px solid color-mix(in srgb, var(--color-error) 28%, transparent)',
                                    background: 'color-mix(in srgb, var(--color-error) 8%, transparent)',
                                    color: 'var(--color-error-text, var(--color-error))',
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <IconTrash size={12} color="var(--color-error)" />
                                  <span>Xóa đánh giá</span>
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 10 }}>
                          {rev.content}
                        </p>

                        {rev.safetyNote && (
                          <div style={{ background: 'var(--banner-danger-bg)', borderLeft: '3px solid var(--color-error)', border: '1px solid var(--banner-danger-border)', padding: '10px 14px', fontSize: '0.85rem', color: 'var(--banner-danger-text)', borderRadius: 4, marginTop: 8 }}>
                            <strong style={{ color: 'var(--color-error-text, var(--color-error))', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <IconAlertTriangle size={15} color="var(--color-error-text, var(--color-error))" />
                              CẢNH BÁO AN TOÀN TỪ TREKKER:
                            </strong>
                            {rev.safetyNote}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card" style={{ height: 'fit-content' }}>
              <h4 style={{ fontSize: '1.1rem', color: 'var(--color-text-main)', fontWeight: 700, marginBottom: 14 }}>
                Gửi đánh giá chuyến đi
              </h4>

              <form onSubmit={handleReviewSubmit}>
                <div className="form-group">
                  <label className="form-label">Đánh giá chung (1 - 5 sao)</label>
                  <select className="form-select" aria-label="Đánh giá chung từ 1 đến 5 sao" value={newRating} onChange={(e) => setNewRating(Number(e.target.value))}>
                    <option value={5}>5 sao - Tuyệt vời</option>
                    <option value={4}>4 sao - Rất tốt</option>
                    <option value={3}>3 sao - Trung bình</option>
                    <option value={2}>2 sao - Khó</option>
                    <option value={1}>1 sao - Nguy hiểm</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Đánh giá độ khó thực tế (1 - 5)</label>
                  <select className="form-select" aria-label="Đánh giá độ khó thực tế từ 1 đến 5" value={newDiffRating} onChange={(e) => setNewDiffRating(Number(e.target.value))}>
                    <option value={1}>1/5 - Rất dễ</option>
                    <option value={2}>2/5 - Dễ</option>
                    <option value={3}>3/5 - Trung bình</option>
                    <option value={4}>4/5 - Khó</option>
                    <option value={5}>5/5 - Cực khó</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Cảm nhận chi tiết chuyến đi</label>
                  <textarea
                    className="form-textarea"
                    aria-label="Cảm nhận chi tiết chuyến đi"
                    rows={4}
                    placeholder="Chia sẻ về tình trạng đường xá, cảnh đẹp, lán nghỉ..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Cảnh báo an toàn (nếu có)</label>
                  <input
                    type="text"
                    className="form-input"
                    aria-label="Cảnh báo an toàn nếu có"
                    placeholder="Ví dụ: Đoạn qua suối trơn, trạm 2800m hết nước..."
                    value={newSafetyNote}
                    onChange={(e) => setNewSafetyNote(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingReview}
                  style={{ width: '100%', justifyContent: 'center', borderRadius: 4, opacity: isSubmittingReview ? 0.7 : 1 }}
                >
                  {isSubmittingReview ? 'Đang gửi đánh giá...' : 'Gửi đánh giá cho cộng đồng'}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'pois' && (
          <TrailPoiSection
            trail={trail}
            currentUser={currentUser}
            onRequireLogin={onRequireLogin}
          />
        )}
      </div>

      {/* Wave 9D: Nearby Trails Combo Recommendations */}
      {nearbyTrails.length > 0 && (
        <section
          aria-label="Các cung đường lân cận kết hợp"
          style={{
            marginTop: 32,
            paddingTop: 24,
            borderTop: '1px solid var(--color-border-strong)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--color-primary)',
                  marginBottom: 4,
                }}
              >
                Lộ Trình Liên Tuyến · Khoảng Cách Thực Địa
              </div>
              <h3
                className="font-editorial"
                style={{
                  margin: 0,
                  fontSize: '1.35rem',
                  fontWeight: 600,
                  color: 'var(--color-text-main)',
                  lineHeight: 1.2,
                }}
              >
                Các Cung Đường Lân Cận Kết Hợp
              </h3>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)' }}>
              Gợi ý 4 tuyến gần {trail.name} nhất để ghép hành trình hoặc đối chiếu phương án dự phòng
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(265px, 100%), 1fr))',
              gap: 16,
            }}
          >
            {nearbyTrails.map((item) => {
              const nt = item.trail;
              const delta = item.altitudeDeltaM;
              const deltaLabel =
                Math.abs(delta) < 25
                  ? 'Độ cao tương đương'
                  : delta > 0
                    ? `Cao hơn +${delta.toLocaleString('vi-VN')}m`
                    : `Thấp hơn ${Math.abs(delta).toLocaleString('vi-VN')}m`;
              const deltaColor =
                Math.abs(delta) < 25
                  ? 'var(--color-text-muted)'
                  : delta > 0
                    ? 'var(--color-sun)'
                    : 'var(--color-primary)';

              return (
                <div
                  key={`nearby-${nt.id}`}
                  className="card"
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 6,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-card)',
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      height: 124,
                      background: 'var(--color-surface-elevated)',
                      overflow: 'hidden',
                    }}
                  >
                    <OptimizedImage
                      src={nt.coverImage}
                      alt={nt.name}
                      targetWidth={420}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        background: 'var(--color-bg-glass)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 4,
                        padding: '2px 7px',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: 'var(--color-sky)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      Cách ~{item.distanceKm.toLocaleString('vi-VN')} km
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: 4,
                        padding: '2px 7px',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: nt.difficultyLevel >= 4 ? 'var(--color-error-text, var(--color-error))' : 'var(--color-primary)',
                      }}
                    >
                      Cấp {nt.difficultyLevel}/5
                    </div>
                  </div>

                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    <div>
                      <h4
                        style={{
                          margin: 0,
                          fontSize: '0.95rem',
                          fontWeight: 800,
                          color: 'var(--color-text-main)',
                          lineHeight: 1.3,
                        }}
                      >
                        {nt.name}
                      </h4>
                      <div style={{ fontSize: '0.73rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
                        {nt.province} · {nt.region}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        fontSize: '0.74rem',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <span
                        style={{
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: 'var(--color-bg-main)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-main)',
                          fontWeight: 700,
                        }}
                      >
                        {nt.maxAltitudeM.toLocaleString('vi-VN')}m · {nt.distanceKm} km
                      </span>
                      <span
                        style={{
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: 'var(--color-bg-main)',
                          border: '1px solid var(--color-border)',
                          color: deltaColor,
                          fontWeight: 700,
                        }}
                      >
                        {deltaLabel}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 6 }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleOpenNearbyTrail(nt)}
                        style={{
                          flex: 1,
                          justifyContent: 'center',
                          padding: '7px 10px',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          borderRadius: 4,
                        }}
                      >
                        Mở Cung
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setInlineCompareTrail(nt)}
                        style={{
                          flex: 1,
                          justifyContent: 'center',
                          padding: '7px 10px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          borderRadius: 4,
                        }}
                      >
                        So Sánh
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Inline Trail Comparison Modal triggered from Nearby Trails "So Sánh" */}
      {isWeatherAlertOpen && (
        <Suspense fallback={null}>
          <WeatherAlertModal
            isOpen={isWeatherAlertOpen}
            onClose={() => setIsWeatherAlertOpen(false)}
            trail={{
              id: trail.id,
              name: trail.name,
              province: trail.province,
              maxAltitudeM: trail.maxAltitudeM,
            }}
            isAuthenticated={isAuthedForWeatherAlert}
            existingAlert={weatherAlertSub}
            eventSource="trail-detail-modal"
            onRequireLogin={onRequireLogin}
            onAlertChanged={(change) => {
              if (change.action === 'delete') {
                setWeatherAlertSub(null);
              } else if (change.sub !== undefined) {
                setWeatherAlertSub(change.sub);
              }
            }}
          />
        </Suspense>
      )}

      {inlineCompareTrail && (
        <Suspense fallback={null}>
          <TrailComparisonModal
            trails={[trail, inlineCompareTrail]}
            isOpen={true}
            onClose={() => setInlineCompareTrail(null)}
            onRemoveTrail={(id) => {
              if (id === inlineCompareTrail.id || id === trail.id) {
                setInlineCompareTrail(null);
              }
            }}
            onSelectTrail={(target) => {
              if (target.id !== trail.id) {
                handleOpenNearbyTrail(target);
              } else {
                setInlineCompareTrail(null);
              }
            }}
          />
        </Suspense>
      )}

      {/* Evidence Photo Lightbox rendered cleanly via createPortal to document.body */}
      {selectedEvidencePhoto &&
        createPortal(
          <div
            onClick={() => setSelectedEvidencePhoto(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--overlay-bg)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 'var(--z-lightbox, 4000)' as unknown as number,
              padding: 20,
            }}
          >
            <div
              ref={evidenceLightboxRef}
              role="dialog"
              aria-modal="true"
              aria-label="Ảnh hiện trường sự cố"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'relative',
                maxWidth: '92vw',
                maxHeight: '88vh',
                background: 'var(--color-bg-card)',
                borderRadius: 6,
                overflow: 'hidden',
                border: '1px solid var(--banner-danger-border)',
                boxShadow: 'var(--shadow-3d)',
                outline: 'none',
              }}
            >
              <button
                type="button"
                aria-label="Đóng ảnh (Esc)"
                onClick={() => setSelectedEvidencePhoto(null)}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  width: 34,
                  height: 34,
                  borderRadius: 4,
                  background: 'var(--overlay-bg)',
                  border: '1px solid color-mix(in srgb, var(--color-on-media) 25%, transparent)',
                  color: 'var(--color-on-media)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 2,
                }}
              >
                <IconX size={16} />
              </button>
              <img
                src={selectedEvidencePhoto}
                alt="Hiện trường sự cố"
                style={{
                  width: '100%',
                  maxHeight: '88vh',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
