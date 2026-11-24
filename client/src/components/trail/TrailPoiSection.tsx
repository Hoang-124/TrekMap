import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Trail, UserProfile } from '../../types.js';
import {
  fetchTrailPois,
  createTrailPoi,
  toggleConfirmTrailPoi,
  updateTrailPoiStatus,
  deleteTrailPoi,
  type TrailPoiCategory,
  type TrailPoiItem,
  type TrailPoiStatus,
} from '../../services/api.js';
import {
  IconDroplet,
  IconTent,
  IconRadio,
  IconAlertTriangle,
  IconEye,
  IconMapPin,
  IconCopy,
  IconCheck,
  IconCheckCircle,
  IconPlus,
  IconTrash,
  IconCompass,
  IconRotateCw,
  IconLock,
  IconMountain,
} from '../common/SvgIcons.js';

export interface TrailPoiSectionProps {
  trail: Trail;
  currentUser?: (UserProfile & { _id?: string; role?: string }) | null;
  onRequireLogin?: (actionName: string) => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type FilterCategory = 'all' | TrailPoiCategory;

interface CategoryMeta {
  id: TrailPoiCategory;
  label: string;
  shortLabel: string;
  color: string;
  accent: string;
  placeholder: string;
  Icon: React.FC<{ size?: number; color?: string }>;
}

const POI_CATEGORIES: CategoryMeta[] = [
  {
    id: 'water',
    label: 'Nguồn nước',
    shortLabel: 'Suối / Nước',
    color: 'var(--color-sky)',
    accent: 'var(--color-sky)',
    placeholder: 'VD: Suối nước trong tại độ cao 2.200m, chảy đều quanh năm, nên lọc trước khi uống...',
    Icon: IconDroplet,
  },
  {
    id: 'camp',
    label: 'Lán trại',
    shortLabel: 'Lán / Bãi trại',
    color: 'var(--color-primary)',
    accent: 'var(--color-primary)',
    placeholder: 'VD: Bãi đất phẳng dựng được 5 lều đôi, kín gió Đông Bắc, cách nguồn nước 150m...',
    Icon: IconTent,
  },
  {
    id: 'signal',
    label: 'Sóng 4G',
    shortLabel: 'Điểm sóng 4G',
    color: 'var(--color-stream)',
    accent: 'var(--color-stream)',
    placeholder: 'VD: Sóng Viettel 4G 2 vạch ổn định ở mỏm đá hướng Tây, gọi thoại và gửi tin nhắn tốt...',
    Icon: IconRadio,
  },
  {
    id: 'danger',
    label: 'Nguy hiểm',
    shortLabel: 'Điểm nguy hiểm',
    color: 'var(--color-error-text, var(--color-error))',
    accent: 'var(--color-error)',
    placeholder: 'VD: Vách đá trơn khi có sương mù, lối mòn sạt nhẹ cần bám dây rừng phía tay trái...',
    Icon: IconAlertTriangle,
  },
  {
    id: 'viewpoint',
    label: 'Ngắm cảnh',
    shortLabel: 'Săn mây / View',
    color: 'var(--color-sun)',
    accent: 'var(--color-sun)',
    placeholder: 'VD: Góc nhìn 270° đón bình minh biển mây hướng Đông Nam, lặng gió từ 05:30–06:30...',
    Icon: IconEye,
  },
];

const CATEGORY_META_MAP: Record<TrailPoiCategory, CategoryMeta> = {
  water: POI_CATEGORIES[0],
  camp: POI_CATEGORIES[1],
  signal: POI_CATEGORIES[2],
  danger: POI_CATEGORIES[3],
  viewpoint: POI_CATEGORIES[4],
};

function copyTextWithFallback(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => copyTextViaExecCommand(text));
  }
  return Promise.resolve(copyTextViaExecCommand(text));
}

function copyTextViaExecCommand(text: string): boolean {
  if (typeof document === 'undefined' || !document.body) return false;
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', 'true');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function formatPoiDate(raw?: string | null): string {
  if (!raw) return 'Chưa rõ';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'Gần đây';
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function emitToast(
  onShowToast: TrailPoiSectionProps['onShowToast'],
  message: string,
  type: 'success' | 'error' | 'info'
) {
  if (onShowToast) {
    onShowToast(message, type);
  } else {
    window.dispatchEvent(new CustomEvent('lost:show-toast', { detail: { message, type } }));
  }
}

export const TrailPoiSection: React.FC<TrailPoiSectionProps> = React.memo(({
  trail,
  currentUser,
  onRequireLogin,
  onShowToast,
}) => {
  const [trackedTrailId, setTrackedTrailId] = useState<string>(trail.id);
  const [hasAuthToken, setHasAuthToken] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    return Boolean(localStorage.getItem('lost_token'));
  });
  const isAuthed = Boolean(currentUser) || hasAuthToken;
  const currentUserId = String(currentUser?.id || currentUser?._id || '');
  const isModOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'moderator';

  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const fetchKey = `${trail.id}:${isAuthed ? currentUserId || 'token' : 'guest'}:${refreshTick}`;
  const [listState, setListState] = useState<{
    key: string;
    items: TrailPoiItem[];
    maxPerTrail: number;
    offline: boolean;
    error: string | null;
  }>({
    key: '',
    items: [],
    maxPerTrail: 50,
    offline: false,
    error: null,
  });

  // Per-POI interaction guards
  const [copiedPoiId, setCopiedPoiId] = useState<string | null>(null);
  const [busyConfirmIds, setBusyConfirmIds] = useState<Record<string, boolean>>({});
  const [busyStatusIds, setBusyStatusIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyDeleteIds, setBusyDeleteIds] = useState<Record<string, boolean>>({});

  // Collapsible "Báo Điểm Thực Địa Mới" form state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formCategory, setFormCategory] = useState<TrailPoiCategory>('water');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formLat, setFormLat] = useState<string>(
    Number.isFinite(trail.startLat) ? String(Number(trail.startLat).toFixed(5)) : ''
  );
  const [formLng, setFormLng] = useState<string>(
    Number.isFinite(trail.startLng) ? String(Number(trail.startLng).toFixed(5)) : ''
  );
  const [formElevationM, setFormElevationM] = useState<string>('');
  const [formStatus, setFormStatus] = useState<TrailPoiStatus>('active');
  const [isCapturingGps, setIsCapturingGps] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const activeTrailIdRef = useRef<string>(trail.id);
  const gpsReqIdRef = useRef<number>(0);
  const copyTimerRef = useRef<number | null>(null);
  const createAbortRef = useRef<AbortController | null>(null);
  const actionControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Reset form & interaction state cleanly during render whenever trail.id changes
  if (trackedTrailId !== trail.id) {
    setTrackedTrailId(trail.id);
    setActiveCategory('all');
    setIsFormOpen(false);
    setFormCategory('water');
    setFormTitle('');
    setFormNotes('');
    setFormLat(Number.isFinite(trail.startLat) ? String(Number(trail.startLat).toFixed(5)) : '');
    setFormLng(Number.isFinite(trail.startLng) ? String(Number(trail.startLng).toFixed(5)) : '');
    setFormElevationM('');
    setFormStatus('active');
    setIsCapturingGps(false);
    setIsSubmitting(false);
    setFormError(null);
    setConfirmDeleteId(null);
    setBusyConfirmIds({});
    setBusyStatusIds({});
    setBusyDeleteIds({});
  }

  useEffect(() => {
    activeTrailIdRef.current = trail.id;
    const controllers = actionControllersRef.current;
    return () => {
      gpsReqIdRef.current += 1;
      createAbortRef.current?.abort();
      createAbortRef.current = null;
      controllers.forEach((ctrl) => ctrl.abort());
      controllers.clear();
    };
  }, [trail.id]);

  useEffect(() => {
    isMountedRef.current = true;
    const controllers = actionControllersRef.current;
    const syncAuth = () => {
      if (typeof localStorage === 'undefined') return;
      setHasAuthToken(Boolean(localStorage.getItem('lost_token')));
    };
    window.addEventListener('lost:auth-changed', syncAuth);
    window.addEventListener('storage', syncAuth);
    window.addEventListener('focus', syncAuth);
    return () => {
      isMountedRef.current = false;
      gpsReqIdRef.current += 1;
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      createAbortRef.current?.abort();
      controllers.forEach((ctrl) => ctrl.abort());
      controllers.clear();
      window.removeEventListener('lost:auth-changed', syncAuth);
      window.removeEventListener('storage', syncAuth);
      window.removeEventListener('focus', syncAuth);
    };
  }, []);

  // Fetch crowdsourced POIs for this trail (AbortController protected, zero sync setState)
  useEffect(() => {
    const controller = new AbortController();
    const capturedKey = fetchKey;
    const capturedTrailId = trail.id;

    fetchTrailPois(capturedTrailId, 'all', controller.signal)
      .then((res) => {
        if (
          controller.signal.aborted ||
          !isMountedRef.current ||
          activeTrailIdRef.current !== capturedTrailId
        ) {
          return;
        }
        setListState({
          key: capturedKey,
          items: res.data,
          maxPerTrail: res.maxPerTrail,
          offline: Boolean(res.offline),
          error:
            res.success || res.offline
              ? null
              : res.error || 'Không thể tải danh sách điểm thực địa lúc này.',
        });
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!isMountedRef.current || activeTrailIdRef.current !== capturedTrailId) return;
        setListState({
          key: capturedKey,
          items: [],
          maxPerTrail: 50,
          offline: true,
          error: null,
        });
      });

    return () => controller.abort();
  }, [fetchKey, trail.id]);

  const isLoading = listState.key !== fetchKey;
  const isCurrentTrailList = listState.key === fetchKey || listState.key.startsWith(`${trail.id}:`);
  const maxPerTrail = isCurrentTrailList ? listState.maxPerTrail : 50;
  const allPois = useMemo(() => {
    const raw = isCurrentTrailList ? listState.items : [];
    return isAuthed
      ? raw
      : raw.map((item) => (item.hasUpvoted ? { ...item, hasUpvoted: false } : item));
  }, [isCurrentTrailList, listState.items, isAuthed]);
  const atMaxPoiLimit = allPois.length >= maxPerTrail;

  const categoryCounts = useMemo(() => {
    const counts: Record<FilterCategory, number> = {
      all: allPois.length,
      water: 0,
      camp: 0,
      signal: 0,
      danger: 0,
      viewpoint: 0,
    };
    for (const poi of allPois) {
      counts[poi.category] = (counts[poi.category] || 0) + 1;
    }
    return counts;
  }, [allPois]);

  const filteredPois = useMemo(() => {
    if (activeCategory === 'all') return allPois;
    return allPois.filter((p) => p.category === activeCategory);
  }, [allPois, activeCategory]);

  // Real waypoint quick-pick options for the contribution form
  const quickPickWaypoints = useMemo(() => {
    const picks: Array<{ id: string; label: string; lat: number; lng: number; elevationM?: number }> = [];
    if (Number.isFinite(trail.startLat) && Number.isFinite(trail.startLng)) {
      picks.push({
        id: 'start',
        label: 'Điểm xuất phát',
        lat: Number(trail.startLat),
        lng: Number(trail.startLng),
      });
    }
    if (Array.isArray(trail.waypoints)) {
      trail.waypoints.slice(0, 6).forEach((wp, idx) => {
        if (Number.isFinite(wp.lat) && Number.isFinite(wp.lng)) {
          picks.push({
            id: `wp-${idx}`,
            label: wp.name,
            lat: Number(wp.lat),
            lng: Number(wp.lng),
            elevationM: typeof wp.elevationM === 'number' ? Math.round(wp.elevationM) : undefined,
          });
        }
      });
    }
    if (Number.isFinite(trail.endLat) && Number.isFinite(trail.endLng)) {
      picks.push({
        id: 'summit',
        label: `Đỉnh / Đích (${trail.maxAltitudeM.toLocaleString('vi-VN')}m)`,
        lat: Number(trail.endLat),
        lng: Number(trail.endLng),
        elevationM: trail.maxAltitudeM,
      });
    }
    return picks;
  }, [trail]);

  const promptLogin = (actionName: string) => {
    if (onRequireLogin) {
      onRequireLogin(actionName);
    } else {
      window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
    }
  };

  const handleUnauthorizedError = (err: unknown, actionName: string): boolean => {
    const status =
      typeof err === 'object' && err !== null && 'status' in err
        ? Number((err as { status?: unknown }).status)
        : NaN;
    if (status !== 401) return false;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('lost_token');
    }
    setHasAuthToken(false);
    window.dispatchEvent(new CustomEvent('lost:auth-changed'));
    emitToast(
      onShowToast,
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.',
      'error'
    );
    promptLogin(actionName);
    return true;
  };

  const handleCopyCoords = async (poi: TrailPoiItem) => {
    const text = `${poi.lat.toFixed(5)}, ${poi.lng.toFixed(5)}`;
    const ok = await copyTextWithFallback(text);
    if (!isMountedRef.current) return;
    if (ok) {
      setCopiedPoiId(poi._id);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        if (isMountedRef.current) setCopiedPoiId(null);
      }, 2000);
      emitToast(onShowToast, `Đã sao chép tọa độ WGS84: ${text}`, 'success');
    } else {
      emitToast(onShowToast, `Không thể tự sao chép — tọa độ: ${text}`, 'info');
    }
  };

  const handleToggleConfirm = async (poi: TrailPoiItem) => {
    if (!isAuthed) {
      promptLogin('xác nhận điểm thực địa');
      return;
    }
    if (busyConfirmIds[poi._id] || busyDeleteIds[poi._id]) return;

    const actionKey = `confirm:${poi._id}`;
    actionControllersRef.current.get(actionKey)?.abort();
    const controller = new AbortController();
    actionControllersRef.current.set(actionKey, controller);
    const capturedTrailId = trail.id;

    setBusyConfirmIds((prev) => ({ ...prev, [poi._id]: true }));
    try {
      const res = await toggleConfirmTrailPoi(poi._id, controller.signal);
      if (
        controller.signal.aborted ||
        !isMountedRef.current ||
        activeTrailIdRef.current !== capturedTrailId
      ) {
        return;
      }
      setListState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item._id === poi._id
            ? {
                ...item,
                hasUpvoted: res.hasUpvoted,
                upvoteCount: res.upvoteCount,
                lastConfirmedAt: res.lastConfirmedAt ?? item.lastConfirmedAt,
              }
            : item
        ),
      }));
      emitToast(
        onShowToast,
        res.hasUpvoted
          ? `Đã xác nhận thực địa "${poi.title}".`
          : `Đã bỏ xác nhận "${poi.title}".`,
        res.hasUpvoted ? 'success' : 'info'
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!isMountedRef.current || activeTrailIdRef.current !== capturedTrailId) return;
      if (handleUnauthorizedError(err, 'xác nhận điểm thực địa')) return;
      emitToast(
        onShowToast,
        err instanceof Error ? err.message : 'Không thể xác nhận điểm thực địa lúc này.',
        'error'
      );
    } finally {
      if (actionControllersRef.current.get(actionKey) === controller) {
        actionControllersRef.current.delete(actionKey);
      }
      if (isMountedRef.current && activeTrailIdRef.current === capturedTrailId) {
        setBusyConfirmIds((prev) => {
          const next = { ...prev };
          delete next[poi._id];
          return next;
        });
      }
    }
  };

  const handleToggleStatus = async (poi: TrailPoiItem) => {
    if (!isAuthed || busyStatusIds[poi._id] || busyDeleteIds[poi._id]) return;
    const nextStatus: TrailPoiStatus = poi.status === 'active' ? 'dry_or_closed' : 'active';
    const actionKey = `status:${poi._id}`;
    actionControllersRef.current.get(actionKey)?.abort();
    const controller = new AbortController();
    actionControllersRef.current.set(actionKey, controller);
    const capturedTrailId = trail.id;

    setBusyStatusIds((prev) => ({ ...prev, [poi._id]: true }));
    try {
      const updated = await updateTrailPoiStatus(poi._id, nextStatus, controller.signal);
      if (
        controller.signal.aborted ||
        !isMountedRef.current ||
        activeTrailIdRef.current !== capturedTrailId
      ) {
        return;
      }
      setListState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item._id === poi._id
            ? {
                ...item,
                status: updated.status,
                updatedAt: updated.updatedAt,
                lastConfirmedAt: updated.lastConfirmedAt ?? item.lastConfirmedAt,
              }
            : item
        ),
      }));
      window.dispatchEvent(
        new CustomEvent('lost:trail-pois-changed', { detail: { trailId: capturedTrailId } })
      );
      emitToast(
        onShowToast,
        nextStatus === 'active'
          ? `Đã chuyển "${poi.title}" sang trạng thái Còn hoạt động.`
          : `Đã đánh dấu "${poi.title}" là Đã cạn / Đóng.`,
        'success'
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!isMountedRef.current || activeTrailIdRef.current !== capturedTrailId) return;
      if (handleUnauthorizedError(err, 'cập nhật trạng thái điểm thực địa')) return;
      emitToast(
        onShowToast,
        err instanceof Error ? err.message : 'Không thể đổi trạng thái điểm thực địa.',
        'error'
      );
    } finally {
      if (actionControllersRef.current.get(actionKey) === controller) {
        actionControllersRef.current.delete(actionKey);
      }
      if (isMountedRef.current && activeTrailIdRef.current === capturedTrailId) {
        setBusyStatusIds((prev) => {
          const next = { ...prev };
          delete next[poi._id];
          return next;
        });
      }
    }
  };

  const handleConfirmDelete = async (poi: TrailPoiItem) => {
    if (!isAuthed || busyDeleteIds[poi._id]) return;
    // Abort any concurrent confirm/status mutations on this POI before deleting
    actionControllersRef.current.get(`confirm:${poi._id}`)?.abort();
    actionControllersRef.current.delete(`confirm:${poi._id}`);
    actionControllersRef.current.get(`status:${poi._id}`)?.abort();
    actionControllersRef.current.delete(`status:${poi._id}`);

    const actionKey = `delete:${poi._id}`;
    actionControllersRef.current.get(actionKey)?.abort();
    const controller = new AbortController();
    actionControllersRef.current.set(actionKey, controller);
    const capturedTrailId = trail.id;

    setBusyDeleteIds((prev) => ({ ...prev, [poi._id]: true }));
    try {
      await deleteTrailPoi(poi._id, controller.signal);
      if (
        controller.signal.aborted ||
        !isMountedRef.current ||
        activeTrailIdRef.current !== capturedTrailId
      ) {
        return;
      }
      setListState((prev) => ({
        ...prev,
        items: prev.items.filter((item) => item._id !== poi._id),
      }));
      setConfirmDeleteId(null);
      window.dispatchEvent(
        new CustomEvent('lost:trail-pois-changed', { detail: { trailId: capturedTrailId } })
      );
      emitToast(onShowToast, `Đã xóa điểm thực địa "${poi.title}".`, 'info');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!isMountedRef.current || activeTrailIdRef.current !== capturedTrailId) return;
      if (handleUnauthorizedError(err, 'xóa điểm thực địa')) return;
      emitToast(
        onShowToast,
        err instanceof Error ? err.message : 'Không thể xóa điểm thực địa này.',
        'error'
      );
    } finally {
      if (actionControllersRef.current.get(actionKey) === controller) {
        actionControllersRef.current.delete(actionKey);
      }
      if (isMountedRef.current && activeTrailIdRef.current === capturedTrailId) {
        setBusyDeleteIds((prev) => {
          const next = { ...prev };
          delete next[poi._id];
          return next;
        });
      }
    }
  };

  const handleCaptureBrowserGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setFormError('Thiết bị hoặc trình duyệt không hỗ trợ định vị GPS.');
      return;
    }
    const reqId = ++gpsReqIdRef.current;
    const capturedTrailId = trail.id;
    setIsCapturingGps(true);
    setFormError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (
          !isMountedRef.current ||
          activeTrailIdRef.current !== capturedTrailId ||
          gpsReqIdRef.current !== reqId
        ) {
          return;
        }
        setIsCapturingGps(false);
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        if (lat < 8 || lat > 24 || lng < 102 || lng > 110) {
          setFormError(
            `Tọa độ GPS thiết bị (${lat}, ${lng}) nằm ngoài lãnh thổ Việt Nam (8°–24°N, 102°–110°E). Hãy chọn nhanh một điểm mốc bên dưới.`
          );
          return;
        }
        setFormLat(String(lat));
        setFormLng(String(lng));
        if (typeof pos.coords.altitude === 'number' && Number.isFinite(pos.coords.altitude)) {
          const roundedAlt = Math.round(pos.coords.altitude);
          setFormElevationM(roundedAlt >= 0 && roundedAlt <= 3500 ? String(roundedAlt) : '');
        } else {
          setFormElevationM('');
        }
        emitToast(onShowToast, `Đã điền tọa độ GPS thực tế (${lat}, ${lng}).`, 'success');
      },
      (err) => {
        if (
          !isMountedRef.current ||
          activeTrailIdRef.current !== capturedTrailId ||
          gpsReqIdRef.current !== reqId
        ) {
          return;
        }
        setIsCapturingGps(false);
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Trình duyệt từ chối quyền GPS. Hãy chọn nhanh điểm mốc trên tuyến hoặc nhập tọa độ thủ công.'
            : err.code === err.TIMEOUT
            ? 'Hết thời gian chờ khóa tín hiệu vệ tinh GPS (10 giây). Hãy thử lại ở nơi thoáng trời hoặc chọn nhanh điểm mốc bên dưới.'
            : 'Không bắt được tín hiệu vệ tinh GPS lúc này. Bạn có thể chọn nhanh điểm mốc bên dưới.';
        setFormError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!isAuthed) {
      promptLogin('báo điểm thực địa mới');
      return;
    }
    if (atMaxPoiLimit) {
      setFormError(`Tuyến này đã đạt giới hạn tối đa ${maxPerTrail} điểm thực địa cộng đồng.`);
      return;
    }

    const cleanTitle = formTitle.trim();
    const cleanNotes = formNotes.trim();
    const lat = Number(formLat);
    const lng = Number(formLng);
    const eleRaw = formElevationM.trim();
    const elevationM = eleRaw === '' ? null : Number(eleRaw);

    if (cleanTitle.length < 3 || cleanTitle.length > 120) {
      setFormError('Tên điểm thực địa cần từ 3 đến 120 ký tự.');
      return;
    }
    if (cleanNotes.length > 500) {
      setFormError('Mô tả thực địa tối đa 500 ký tự.');
      return;
    }
    if (!Number.isFinite(lat) || lat < 8 || lat > 24) {
      setFormError('Vĩ độ (Lat) phải nằm trong phạm vi địa lý Việt Nam (8.0 đến 24.0).');
      return;
    }
    if (!Number.isFinite(lng) || lng < 102 || lng > 110) {
      setFormError('Kinh độ (Lng) phải nằm trong phạm vi địa lý Việt Nam (102.0 đến 110.0).');
      return;
    }
    if (elevationM !== null && (!Number.isFinite(elevationM) || elevationM < 0 || elevationM > 3500)) {
      setFormError('Cao độ (m) nếu nhập phải nằm trong khoảng 0 đến 3.500m.');
      return;
    }

    gpsReqIdRef.current += 1;
    setIsCapturingGps(false);
    createAbortRef.current?.abort();
    const controller = new AbortController();
    createAbortRef.current = controller;
    const capturedTrailId = trail.id;
    setIsSubmitting(true);
    setFormError(null);

    try {
      const created = await createTrailPoi(
        {
          trailId: trail.id,
          category: formCategory,
          title: cleanTitle,
          notes: cleanNotes,
          lat,
          lng,
          elevationM: elevationM !== null ? Math.round(elevationM) : null,
          status: formStatus,
        },
        controller.signal
      );
      if (
        controller.signal.aborted ||
        !isMountedRef.current ||
        activeTrailIdRef.current !== capturedTrailId
      ) {
        return;
      }
      setListState((prev) => ({
        ...prev,
        key: fetchKey,
        offline: false,
        error: null,
        items: [created, ...prev.items.filter((item) => item._id !== created._id)],
      }));
      setFormTitle('');
      setFormNotes('');
      setFormElevationM('');
      setFormStatus('active');
      setIsFormOpen(false);
      if (activeCategory !== 'all' && activeCategory !== created.category) {
        setActiveCategory('all');
      }
      window.dispatchEvent(
        new CustomEvent('lost:trail-pois-changed', { detail: { trailId: capturedTrailId } })
      );
      emitToast(onShowToast, `Đã đóng góp điểm thực địa "${created.title}" cho cộng đồng!`, 'success');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!isMountedRef.current || activeTrailIdRef.current !== capturedTrailId) return;
      if (handleUnauthorizedError(err, 'báo điểm thực địa mới')) {
        setFormError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để đăng điểm thực địa.');
        return;
      }
      const msg = err instanceof Error ? err.message : 'Không thể lưu điểm thực địa lúc này.';
      setFormError(msg);
      emitToast(onShowToast, msg, 'error');
    } finally {
      if (isMountedRef.current && activeTrailIdRef.current === capturedTrailId) {
        setIsSubmitting(false);
      }
    }
  };

  const selectedFormMeta = CATEGORY_META_MAP[formCategory];

  return (
    <section
      aria-label={`Bản đồ điểm thực địa và nguồn nước trên cung ${trail.name}`}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-family)' }}
    >
      {/* Header Bar */}
      <div
        className="card"
        style={{
          padding: '16px 18px',
          borderRadius: 6,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: 'color-mix(in srgb, var(--color-sky) 8%, var(--color-bg-card))',
                  border: '1px solid color-mix(in srgb, var(--color-sky) 40%, var(--color-border))',
                  color: 'var(--color-text-main)',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                <IconDroplet size={12} color="var(--color-sky)" />
                <span>Dữ Liệu Cộng Đồng Thực Địa · WGS84</span>
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: atMaxPoiLimit ? 'var(--color-sun)' : 'var(--color-text-dim)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {allPois.length}/{maxPerTrail} điểm đã ghi nhận
              </span>
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: '1.12rem',
                fontWeight: 800,
                color: 'var(--color-text-main)',
                lineHeight: 1.3,
              }}
            >
              Thực Địa, Nguồn Nước, Lán Trại &amp; Sóng 4G — {trail.name}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              Các điểm suối lọc nước, bãi hạ trại, góc bắt sóng 4G và vị trí nguy hiểm do chính người leo núi LOST xác thực tọa độ GPS.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setRefreshTick((n) => n + 1)}
              disabled={isLoading}
              aria-label="Làm mới danh sách điểm thực địa"
              style={{ padding: '7px 11px', fontSize: '0.76rem', borderRadius: 4, opacity: isLoading ? 0.65 : 1 }}
            >
              <IconRotateCw size={13} />
              <span>Làm mới</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              aria-expanded={isFormOpen}
              onClick={() => {
                if (isFormOpen) {
                  gpsReqIdRef.current += 1;
                  setIsCapturingGps(false);
                  setFormError(null);
                }
                setIsFormOpen((v) => !v);
              }}
              style={{ padding: '7px 13px', fontSize: '0.78rem', fontWeight: 800, borderRadius: 4 }}
            >
              <IconPlus size={14} color="var(--color-on-primary)" />
              <span>{isFormOpen ? 'Đóng Biểu Mẫu' : 'Báo Điểm Thực Địa Mới'}</span>
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div
          role="group"
          aria-label="Lọc điểm thực địa theo danh mục"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            paddingTop: 12,
            borderTop: '1px solid var(--color-border)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <button
            type="button"
            aria-pressed={activeCategory === 'all'}
            onClick={() => setActiveCategory('all')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              borderRadius: 4,
              fontSize: '0.75rem',
              fontWeight: activeCategory === 'all' ? 800 : 700,
              cursor: 'pointer',
              border:
                activeCategory === 'all'
                  ? '1px solid var(--color-primary)'
                  : '1px solid var(--color-border)',
              background:
                activeCategory === 'all'
                  ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card))'
                  : 'var(--color-bg-main)',
              color: activeCategory === 'all' ? 'var(--color-text-main)' : 'var(--color-text-muted)',
            }}
          >
            <IconMapPin size={12} color={activeCategory === 'all' ? 'var(--color-primary)' : 'currentColor'} />
            <span>Tất cả ({categoryCounts.all})</span>
          </button>

          {POI_CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id;
            const CatIcon = cat.Icon;
            return (
              <button
                key={cat.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 4,
                  fontSize: '0.75rem',
                  fontWeight: active ? 800 : 700,
                  cursor: 'pointer',
                  border: active
                    ? `1px solid ${cat.accent}`
                    : '1px solid var(--color-border)',
                  background: active
                    ? `color-mix(in srgb, ${cat.accent} 10%, var(--color-bg-card))`
                    : 'var(--color-bg-main)',
                  color: active ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                }}
              >
                <CatIcon size={12} color={active ? cat.color : 'currentColor'} />
                <span>
                  {cat.label} ({categoryCounts[cat.id]})
                </span>
              </button>
            );
          })}
        </div>

        {/* Collapsible "Báo Điểm Thực Địa Mới" Panel */}
        {isFormOpen && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 6,
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border-strong)',
            }}
          >
            {!isAuthed ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 4,
                      background: 'color-mix(in srgb, var(--color-sky) 10%, var(--color-bg-card))',
                      border: '1px solid color-mix(in srgb, var(--color-sky) 36%, var(--color-border))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <IconLock size={16} color="var(--color-sky)" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                      Đăng nhập để đóng góp điểm thực địa trên {trail.name}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      Tài khoản LOST giúp xác thực nguồn báo cáo nguồn nước, lán trại, sóng 4G và cập nhật trạng thái còn nước/đã cạn.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => promptLogin('báo điểm thực địa mới')}
                  style={{ padding: '7px 14px', fontSize: '0.78rem', borderRadius: 4, fontWeight: 800 }}
                >
                  Đăng Nhập Ngay
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                    Ghi Nhận Điểm Thực Địa Mới (WGS84 Việt Nam)
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: atMaxPoiLimit ? 'var(--color-sun)' : 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                    Hạn mức cung: {allPois.length}/{maxPerTrail} điểm
                  </span>
                </div>

                {atMaxPoiLimit && (
                  <div
                    role="status"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 11px',
                      borderRadius: 4,
                      background: 'color-mix(in srgb, var(--color-sun) 10%, var(--color-bg-card))',
                      border: '1px solid color-mix(in srgb, var(--color-sun) 42%, var(--color-border))',
                      color: 'var(--color-text-main)',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                    }}
                  >
                    <IconAlertTriangle size={14} color="var(--color-sun)" />
                    <span>
                      Cung này đã đạt giới hạn tối đa {maxPerTrail}/{maxPerTrail} điểm thực địa cộng đồng. Bạn vẫn có thể xác nhận hoặc cập nhật trạng thái các điểm hiện có.
                    </span>
                  </div>
                )}

                {/* Category Selector */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {POI_CATEGORIES.map((cat) => {
                    const selected = formCategory === cat.id;
                    const CatIcon = cat.Icon;
                    return (
                      <button
                        key={`form-cat-${cat.id}`}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setFormCategory(cat.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 10px',
                          borderRadius: 4,
                          fontSize: '0.75rem',
                          fontWeight: selected ? 800 : 700,
                          cursor: 'pointer',
                          border: selected ? `1px solid ${cat.accent}` : '1px solid var(--color-border)',
                          background: selected
                            ? `color-mix(in srgb, ${cat.accent} 10%, var(--color-bg-card))`
                            : 'var(--color-bg-card)',
                          color: selected ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                        }}
                      >
                        <CatIcon size={13} color={selected ? cat.color : 'currentColor'} />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Title & Status Row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
                    gap: 10,
                  }}
                >
                  <div>
                    <label
                      htmlFor={`poi-title-${trail.id}`}
                      style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}
                    >
                      Tên điểm thực địa *
                    </label>
                    <input
                      id={`poi-title-${trail.id}`}
                      type="text"
                      className="form-input"
                      maxLength={120}
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="VD: Suối lọc nước Trạm 2.200m"
                      style={{ width: '100%', padding: '7px 10px', fontSize: '0.82rem', borderRadius: 4 }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`poi-status-${trail.id}`}
                      style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}
                    >
                      Tình trạng hiện tại
                    </label>
                    <select
                      id={`poi-status-${trail.id}`}
                      className="form-select"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as TrailPoiStatus)}
                      style={{ width: '100%', padding: '7px 10px', fontSize: '0.82rem', borderRadius: 4 }}
                    >
                      <option value="active">Còn hoạt động / Có nước</option>
                      <option value="dry_or_closed">Đã cạn nước / Tạm đóng</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label
                    htmlFor={`poi-notes-${trail.id}`}
                    style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}
                  >
                    Mô tả thực địa chi tiết ({formNotes.length}/500)
                  </label>
                  <textarea
                    id={`poi-notes-${trail.id}`}
                    className="form-textarea"
                    rows={2}
                    maxLength={500}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder={selectedFormMeta.placeholder}
                    style={{ width: '100%', padding: '7px 10px', fontSize: '0.82rem', borderRadius: 4 }}
                  />
                </div>

                {/* Coordinate Autofill Strip (Browser GPS + Trail Waypoints) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                      Tọa độ GPS (WGS84 Việt Nam) *
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={handleCaptureBrowserGps}
                      disabled={isCapturingGps}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.73rem',
                        borderRadius: 4,
                        background: 'var(--color-bg-card)',
                        borderColor: 'color-mix(in srgb, var(--color-sky) 45%, var(--color-border))',
                        color: 'var(--color-sky)',
                      }}
                    >
                      <IconCompass size={13} color="var(--color-sky)" />
                      <span>{isCapturingGps ? 'Đang khóa GPS...' : 'Lấy GPS Hiện Tại'}</span>
                    </button>
                  </div>

                  {quickPickWaypoints.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>Chọn nhanh mốc:</span>
                      {quickPickWaypoints.map((wp) => (
                        <button
                          key={wp.id}
                          type="button"
                          onClick={() => {
                            gpsReqIdRef.current += 1;
                            setIsCapturingGps(false);
                            setFormLat(String(Number(wp.lat).toFixed(5)));
                            setFormLng(String(Number(wp.lng).toFixed(5)));
                            setFormElevationM(
                              typeof wp.elevationM === 'number' ? String(wp.elevationM) : ''
                            );
                            setFormError(null);
                          }}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            background: 'var(--color-bg-card)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          {wp.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(min(145px, 100%), 1fr))',
                      gap: 8,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <div>
                      <label
                        htmlFor={`poi-lat-${trail.id}`}
                        style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-text-dim)', marginBottom: 3 }}
                      >
                        Vĩ độ (Lat: 8–24)
                      </label>
                      <input
                        id={`poi-lat-${trail.id}`}
                        type="number"
                        step="any"
                        min={8}
                        max={24}
                        required
                        className="form-input"
                        value={formLat}
                        onChange={(e) => {
                          gpsReqIdRef.current += 1;
                          setIsCapturingGps(false);
                          setFormLat(e.target.value);
                        }}
                        style={{ width: '100%', padding: '6px 9px', fontSize: '0.8rem', borderRadius: 4 }}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`poi-lng-${trail.id}`}
                        style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-text-dim)', marginBottom: 3 }}
                      >
                        Kinh độ (Lng: 102–110)
                      </label>
                      <input
                        id={`poi-lng-${trail.id}`}
                        type="number"
                        step="any"
                        min={102}
                        max={110}
                        required
                        className="form-input"
                        value={formLng}
                        onChange={(e) => {
                          gpsReqIdRef.current += 1;
                          setIsCapturingGps(false);
                          setFormLng(e.target.value);
                        }}
                        style={{ width: '100%', padding: '6px 9px', fontSize: '0.8rem', borderRadius: 4 }}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`poi-ele-${trail.id}`}
                        style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-text-dim)', marginBottom: 3 }}
                      >
                        Cao độ (m, tùy chọn)
                      </label>
                      <input
                        id={`poi-ele-${trail.id}`}
                        type="number"
                        step="1"
                        min={0}
                        max={3500}
                        className="form-input"
                        value={formElevationM}
                        onChange={(e) => setFormElevationM(e.target.value)}
                        placeholder={`VD: ${Math.min(3143, Math.round(trail.maxAltitudeM * 0.7))}`}
                        style={{ width: '100%', padding: '6px 9px', fontSize: '0.8rem', borderRadius: 4 }}
                      />
                    </div>
                  </div>
                </div>

                {formError && (
                  <div
                    role="alert"
                    style={{
                      padding: '8px 11px',
                      borderRadius: 4,
                      background: 'color-mix(in srgb, var(--color-error) 8%, var(--color-bg-card))',
                      border: '1px solid color-mix(in srgb, var(--color-error) 35%, var(--color-border))',
                      color: 'var(--color-error-text, var(--color-error))',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                    }}
                  >
                    {formError}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      gpsReqIdRef.current += 1;
                      setIsCapturingGps(false);
                      setIsFormOpen(false);
                      setFormError(null);
                    }}
                    style={{ padding: '7px 13px', fontSize: '0.78rem', borderRadius: 4 }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting || atMaxPoiLimit}
                    style={{
                      padding: '7px 15px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      borderRadius: 4,
                      opacity: isSubmitting || atMaxPoiLimit ? 0.65 : 1,
                    }}
                  >
                    <IconPlus size={14} color="var(--color-on-primary)" />
                    <span>
                      {isSubmitting
                        ? 'Đang lưu...'
                        : atMaxPoiLimit
                        ? `Đã đủ ${maxPerTrail} điểm`
                        : 'Đăng Điểm Thực Địa'}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Body List / Loading / Offline / Error / Empty States */}
      {isLoading && allPois.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '28px 16px',
            textAlign: 'center',
            fontSize: '0.84rem',
            color: 'var(--color-text-muted)',
            borderRadius: 6,
          }}
        >
          Đang tải dữ liệu nguồn nước, lán trại và sóng 4G trên tuyến {trail.name}...
        </div>
      ) : isCurrentTrailList && listState.offline && allPois.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '20px 18px',
            borderRadius: 6,
            border: '1px dashed var(--color-border-strong)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
            Chưa thể kết nối máy chủ điểm thực địa lúc này (ngoại tuyến).
          </span>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setRefreshTick((n) => n + 1)}
            style={{ padding: '6px 12px', fontSize: '0.76rem', borderRadius: 4 }}
          >
            Thử tải lại
          </button>
        </div>
      ) : isCurrentTrailList && listState.error && allPois.length === 0 ? (
        <div
          role="alert"
          className="card"
          style={{
            padding: '20px 18px',
            borderRadius: 6,
            background: 'color-mix(in srgb, var(--color-error) 8%, var(--color-bg-card))',
            border: '1px solid color-mix(in srgb, var(--color-error) 35%, var(--color-border))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--color-error-text, var(--color-error))',
            }}
          >
            <IconAlertTriangle size={15} color="var(--color-error-text, var(--color-error))" />
            <span>{listState.error}</span>
          </span>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setRefreshTick((n) => n + 1)}
            style={{ padding: '6px 12px', fontSize: '0.76rem', borderRadius: 4 }}
          >
            Thử tải lại
          </button>
        </div>
      ) : filteredPois.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '26px 18px',
            textAlign: 'center',
            borderRadius: 6,
            border: '1px dashed var(--color-border-strong)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
            {activeCategory === 'all'
              ? `Chưa có điểm thực địa cộng đồng nào được báo trên ${trail.name}`
              : `Chưa có điểm thuộc mục "${CATEGORY_META_MAP[activeCategory].label}"`}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', maxWidth: 460 }}>
            Nếu bạn vừa hoàn thành cung này, hãy chia sẻ vị trí suối lọc nước, lán trại, điểm sóng 4G hoặc đoạn sạt trượt để các đoàn đi sau chuẩn bị an toàn hơn.
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (activeCategory !== 'all') setFormCategory(activeCategory);
              setIsFormOpen(true);
            }}
            style={{ padding: '7px 14px', fontSize: '0.78rem', borderRadius: 4, fontWeight: 800 }}
          >
            <IconPlus size={14} color="var(--color-on-primary)" />
            <span>Báo Điểm Đầu Tiên</span>
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))',
            gap: 12,
          }}
        >
          {filteredPois.map((poi) => {
            const meta = CATEGORY_META_MAP[poi.category];
            const CatIcon = meta.Icon;
            const isClosed = poi.status === 'dry_or_closed';
            const canManage =
              isAuthed && (isModOrAdmin || (Boolean(currentUserId) && String(poi.userId) === currentUserId));
            const isCopied = copiedPoiId === poi._id;
            const isConfirmBusy = Boolean(busyConfirmIds[poi._id]);
            const isStatusBusy = Boolean(busyStatusIds[poi._id]);
            const isDeleteBusy = Boolean(busyDeleteIds[poi._id]);

            return (
              <article
                key={poi._id}
                className="card"
                style={{
                  padding: '14px 15px',
                  borderRadius: 6,
                  background: 'var(--color-bg-card)',
                  border: isClosed
                    ? '1px solid color-mix(in srgb, var(--color-error) 35%, var(--color-border))'
                    : '1px solid var(--color-border)',
                  borderTop: `3px solid ${isClosed ? 'var(--color-error)' : meta.accent}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {/* Category + Status Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '2px 7px',
                      borderRadius: 4,
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      background: `color-mix(in srgb, ${meta.accent} 8%, var(--color-bg-card))`,
                      border: `1px solid color-mix(in srgb, ${meta.accent} 40%, var(--color-border))`,
                      color: 'var(--color-text-main)',
                    }}
                  >
                    <CatIcon size={12} color={meta.color} />
                    <span>{meta.shortLabel}</span>
                  </span>

                  <span
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: isClosed
                        ? 'color-mix(in srgb, var(--color-error) 10%, var(--color-bg-card))'
                        : 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card))',
                      border: isClosed
                        ? '1px solid color-mix(in srgb, var(--color-error) 35%, var(--color-border))'
                        : '1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border))',
                      color: isClosed
                        ? 'var(--color-error-text, var(--color-error))'
                        : 'var(--color-primary)',
                    }}
                  >
                    {isClosed ? 'Đã cạn / Đóng' : 'Còn hoạt động'}
                  </span>
                </div>

                {/* Title & Notes */}
                <div>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: '0.92rem',
                      fontWeight: 800,
                      color: 'var(--color-text-main)',
                      lineHeight: 1.35,
                    }}
                  >
                    {poi.title}
                  </h4>
                  {poi.notes && (
                    <p
                      style={{
                        margin: '5px 0 0 0',
                        fontSize: '0.79rem',
                        color: 'var(--color-text-muted)',
                        lineHeight: 1.5,
                      }}
                    >
                      {poi.notes}
                    </p>
                  )}
                </div>

                {/* WGS84 Coordinates & Elevation Strip */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 6,
                    padding: '7px 9px',
                    borderRadius: 4,
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.73rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                      minWidth: 0,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: 'var(--color-text-main)' }}>
                      <IconMapPin size={12} color="var(--color-sky)" />
                      <span>
                        {poi.lat.toFixed(5)}, {poi.lng.toFixed(5)}
                      </span>
                    </span>
                    {poi.elevationM !== null && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700, color: 'var(--color-sun)' }}>
                        <IconMountain size={12} color="var(--color-sun)" />
                        <span>{poi.elevationM.toLocaleString('vi-VN')}m</span>
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleCopyCoords(poi)}
                    aria-label={`Sao chép tọa độ điểm ${poi.title}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 7px',
                      borderRadius: 4,
                      background: 'var(--color-surface-elevated)',
                      border: '1px solid var(--color-border)',
                      color: isCopied ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      fontSize: '0.69rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {isCopied ? <IconCheck size={11} color="var(--color-primary)" /> : <IconCopy size={11} />}
                    <span>{isCopied ? 'Đã chép' : 'WGS84'}</span>
                  </button>
                </div>

                {/* Author & Last Confirmed Metadata */}
                <div
                  style={{
                    fontSize: '0.71rem',
                    color: 'var(--color-text-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 6,
                  }}
                >
                  <span>Báo bởi: <strong style={{ color: 'var(--color-text-muted)' }}>{poi.authorName}</strong></span>
                  <span>
                    Xác thực gần nhất: {formatPoiDate(poi.lastConfirmedAt || poi.updatedAt || poi.createdAt)}
                  </span>
                </div>

                {/* Action Footer: 1-Click Confirm Toggle + Owner/Admin Status & Inline Delete */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginTop: 'auto',
                    paddingTop: 8,
                    borderTop: '1px solid var(--color-border)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => void handleToggleConfirm(poi)}
                    disabled={isConfirmBusy || isDeleteBusy}
                    aria-pressed={poi.hasUpvoted}
                    className="btn btn-outline"
                    style={{
                      padding: '5px 10px',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      borderRadius: 4,
                      borderColor: poi.hasUpvoted ? 'var(--color-primary)' : 'var(--color-border-strong)',
                      background: poi.hasUpvoted
                        ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card))'
                        : 'var(--color-bg-main)',
                      color: poi.hasUpvoted ? 'var(--color-primary)' : 'var(--color-text-main)',
                      opacity: isConfirmBusy || isDeleteBusy ? 0.6 : 1,
                    }}
                  >
                    <IconCheckCircle size={13} color={poi.hasUpvoted ? 'var(--color-primary)' : 'currentColor'} />
                    <span>
                      {poi.hasUpvoted ? `Đã xác nhận (+${poi.upvoteCount})` : `Xác nhận (+${poi.upvoteCount})`}
                    </span>
                  </button>

                  {canManage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => void handleToggleStatus(poi)}
                        disabled={isStatusBusy || isDeleteBusy}
                        className="btn btn-outline"
                        style={{
                          padding: '5px 8px',
                          fontSize: '0.71rem',
                          fontWeight: 700,
                          borderRadius: 4,
                          opacity: isStatusBusy || isDeleteBusy ? 0.6 : 1,
                        }}
                      >
                        {isClosed ? 'Mở lại' : 'Báo đã cạn/đóng'}
                      </button>

                      {confirmDeleteId === poi._id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleConfirmDelete(poi)}
                            disabled={isDeleteBusy}
                            style={{
                              padding: '5px 8px',
                              borderRadius: 4,
                              fontSize: '0.71rem',
                              fontWeight: 800,
                              background: 'var(--color-error)',
                              border: '1px solid var(--color-error)',
                              color: 'var(--color-on-danger)',
                              cursor: 'pointer',
                              opacity: isDeleteBusy ? 0.65 : 1,
                            }}
                          >
                            {isDeleteBusy ? 'Đang xóa...' : 'Xác nhận xóa'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={isDeleteBusy}
                            className="btn btn-outline"
                            style={{
                              padding: '5px 7px',
                              fontSize: '0.71rem',
                              borderRadius: 4,
                              opacity: isDeleteBusy ? 0.6 : 1,
                            }}
                          >
                            Hủy
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(poi._id)}
                          aria-label={`Xóa điểm thực địa ${poi.title}`}
                          title="Xóa điểm thực địa này"
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 4,
                            background: 'var(--color-bg-main)',
                            border: '1px solid color-mix(in srgb, var(--color-error) 35%, var(--color-border))',
                            color: 'var(--color-error-text, var(--color-error))',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <IconTrash size={12} color="var(--color-error)" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
});

export default TrailPoiSection;
