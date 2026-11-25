import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchMyWeatherAlerts,
  upsertWeatherAlert,
  deleteWeatherAlert,
  evaluateMyWeatherAlerts,
  type WeatherAlertLiveEvaluation,
  type WeatherAlertSubItem,
} from '../../services/api.js';
import { useFocusTrap, isTopmostFocusTrap } from '../../hooks/useFocusTrap.js';
import { safeLocalStorageGet } from '../../utils/storageScope.js';
import {
  IconBell,
  IconCloud,
  IconWind,
  IconDroplet,
  IconShieldAlert,
  IconCheckCircle,
  IconAlertTriangle,
  IconCalendar,
  IconTrash,
  IconX,
  IconRotateCw,
  IconMountain,
  IconLock,
} from '../common/SvgIcons.js';

export interface WeatherAlertTrailRef {
  id: string;
  name: string;
  province?: string;
  maxAltitudeM?: number;
}

export interface WeatherAlertChangePayload {
  action: 'upsert' | 'delete' | 'evaluate';
  trailId: string;
  sub?: WeatherAlertSubItem | null;
  evaluatedActiveSubs?: WeatherAlertSubItem[];
  totalCount?: number;
}

export interface WeatherAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  trail: WeatherAlertTrailRef;
  isAuthenticated?: boolean;
  existingAlert?: WeatherAlertSubItem | null;
  eventSource?: string;
  onAlertChanged?: (change: WeatherAlertChangePayload) => void;
  onRequireLogin?: (actionName: string) => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function getTodayIsoVn(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // fallback below
  }
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

function getVerdictMeta(status?: WeatherAlertLiveEvaluation['status'] | string | null) {
  const upper = String(status || '').toUpperCase();
  if (upper === 'NO_GO') {
    return {
      label: 'NO-GO · NGUY HIỂM',
      color: 'var(--color-error-text, var(--color-error))',
      accent: 'var(--color-error)',
      bg: 'color-mix(in srgb, var(--color-error) 12%, transparent)',
      border: 'color-mix(in srgb, var(--color-error) 38%, transparent)',
    };
  }
  if (upper === 'CAUTION') {
    return {
      label: 'THẬN TRỌNG',
      color: 'var(--color-sun)',
      accent: 'var(--color-sun)',
      bg: 'color-mix(in srgb, var(--color-sun) 12%, transparent)',
      border: 'color-mix(in srgb, var(--color-sun) 36%, transparent)',
    };
  }
  return {
    label: 'GO · THUẬN LỢI',
    color: 'var(--color-primary)',
    accent: 'var(--color-primary)',
    bg: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
    border: 'color-mix(in srgb, var(--color-primary) 36%, transparent)',
  };
}

function emitGlobalToast(
  onShowToast: WeatherAlertModalProps['onShowToast'],
  message: string,
  type: 'success' | 'error' | 'info'
) {
  if (onShowToast) {
    onShowToast(message, type);
  } else {
    window.dispatchEvent(
      new CustomEvent('lost:show-toast', {
        detail: { message, type },
      })
    );
  }
}

export const WeatherAlertModal: React.FC<WeatherAlertModalProps> = ({
  isOpen,
  onClose,
  trail,
  isAuthenticated,
  existingAlert = null,
  eventSource = 'weather-alert-modal',
  onAlertChanged,
  onRequireLogin,
  onShowToast,
}) => {
  const [hasToken, setHasToken] = useState<boolean>(() => Boolean(safeLocalStorageGet('lost_token')));
  const isAuthed = Boolean(isAuthenticated) || hasToken;

  const openSessionKey = `${isOpen ? '1' : '0'}:${trail.id}:${isAuthed ? 'auth' : 'guest'}`;
  const [trackedSessionKey, setTrackedSessionKey] = useState<string>(openSessionKey);

  // Form fields (bounded strictly to Wave 12B API schema)
  const [minSeaOfCloudsPct, setMinSeaOfCloudsPct] = useState<number>(
    existingAlert?.minSeaOfCloudsPct ?? 70
  );
  const [maxRainMm, setMaxRainMm] = useState<number>(existingAlert?.maxRainMm ?? 10);
  const [maxWindKmh, setMaxWindKmh] = useState<number>(existingAlert?.maxWindKmh ?? 40);
  const [alertOnNoGo, setAlertOnNoGo] = useState<boolean>(existingAlert?.alertOnNoGo ?? true);
  const [isActive, setIsActive] = useState<boolean>(existingAlert?.isActive ?? true);
  const [targetDate, setTargetDate] = useState<string>(existingAlert?.targetDate || '');

  const [loadState, setLoadState] = useState<{
    key: string;
    count: number;
    maxLimit: number;
    sub: WeatherAlertSubItem | null;
    unauthorized: boolean;
    error: string | null;
  }>({
    key: '',
    count: 0,
    maxLimit: 10,
    sub: existingAlert,
    unauthorized: false,
    error: null,
  });

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [inlineNotice, setInlineNotice] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const actionAbortRef = useRef<AbortController | null>(null);
  const activeSessionKeyRef = useRef<string>(openSessionKey);
  const existingAlertSeedRef = useRef<WeatherAlertSubItem | null>(existingAlert);

  useFocusTrap(isOpen, dialogRef);

  useEffect(() => {
    existingAlertSeedRef.current = existingAlert;
  }, [existingAlert]);

  useEffect(() => {
    activeSessionKeyRef.current = openSessionKey;
    return () => {
      // Abort any in-flight save/delete/evaluate mutation when modal closes or switches trail/auth
      actionAbortRef.current?.abort();
      actionAbortRef.current = null;
    };
  }, [openSessionKey]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      actionAbortRef.current?.abort();
      actionAbortRef.current = null;
    };
  }, []);

  // Lock background page scroll cleanly while open
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Keep auth status synced across same-tab login/logout (lost:auth-changed) & cross-tab storage/focus
  useEffect(() => {
    const syncAuth = () => {
      setHasToken(Boolean(safeLocalStorageGet('lost_token')));
    };
    window.addEventListener('lost:auth-changed', syncAuth);
    window.addEventListener('storage', syncAuth);
    window.addEventListener('focus', syncAuth);
    return () => {
      window.removeEventListener('lost:auth-changed', syncAuth);
      window.removeEventListener('storage', syncAuth);
      window.removeEventListener('focus', syncAuth);
    };
  }, []);

  // Reset form & inline notices during render whenever modal opens or trail/auth changes
  if (trackedSessionKey !== openSessionKey) {
    setTrackedSessionKey(openSessionKey);
    setMinSeaOfCloudsPct(existingAlert?.minSeaOfCloudsPct ?? 70);
    setMaxRainMm(existingAlert?.maxRainMm ?? 10);
    setMaxWindKmh(existingAlert?.maxWindKmh ?? 40);
    setAlertOnNoGo(existingAlert?.alertOnNoGo ?? true);
    setIsActive(existingAlert?.isActive ?? true);
    setTargetDate(existingAlert?.targetDate || '');
    setInlineNotice(null);
    setIsSaving(false);
    setIsDeleting(false);
    setIsEvaluating(false);
  }

  // Escape key close (LIFO topmost + IME safe)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (!isTopmostFocusTrap(dialogRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Hydrate existing watchlist entry & live Go/No-Go evaluation via GET /api/weather-alerts/me
  // Intentionally omits `existingAlert` object reference from deps to avoid 2x fan-out cascades & clobbering slider edits
  useEffect(() => {
    if (!isOpen || !isAuthed) return;
    const controller = new AbortController();
    const currentKey = openSessionKey;

    fetchMyWeatherAlerts(controller.signal)
      .then((res) => {
        if (
          controller.signal.aborted ||
          !isMountedRef.current ||
          activeSessionKeyRef.current !== currentKey
        ) {
          return;
        }
        if (res.unauthorized) {
          setLoadState({
            key: currentKey,
            count: 0,
            maxLimit: 10,
            sub: null,
            unauthorized: true,
            error: null,
          });
          return;
        }
        const matched = res.data.find((item) => item.trailId === trail.id) || null;
        setLoadState({
          key: currentKey,
          count: res.count,
          maxLimit: res.maxLimit,
          sub: matched,
          unauthorized: false,
          error: res.success ? null : 'Không thể đồng bộ danh sách cảnh báo lúc này.',
        });
        if (matched) {
          setMinSeaOfCloudsPct(matched.minSeaOfCloudsPct);
          setMaxRainMm(matched.maxRainMm);
          setMaxWindKmh(matched.maxWindKmh);
          setAlertOnNoGo(matched.alertOnNoGo);
          setIsActive(matched.isActive);
          setTargetDate(matched.targetDate || '');
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!isMountedRef.current || activeSessionKeyRef.current !== currentKey) return;
        setLoadState({
          key: currentKey,
          count: 0,
          maxLimit: 10,
          sub: existingAlertSeedRef.current,
          unauthorized: false,
          error: 'Không thể kết nối máy chủ cảnh báo thời tiết.',
        });
      });

    return () => controller.abort();
  }, [isOpen, isAuthed, openSessionKey, trail.id]);

  const activeSub =
    loadState.key === openSessionKey ? loadState.sub : existingAlert;
  const isHydrating = isOpen && isAuthed && loadState.key !== openSessionKey;
  const isUnauthEffective = !isAuthed || (loadState.key === openSessionKey && loadState.unauthorized);
  const currentCount = loadState.key === openSessionKey ? loadState.count : 0;
  const maxLimit = loadState.key === openSessionKey ? loadState.maxLimit : 10;
  const atLimitForNew = !activeSub && loadState.key === openSessionKey && currentCount >= maxLimit;

  const normalizedSavedDate = activeSub?.targetDate || '';
  const normalizedDraftDate = targetDate.trim();
  const isTargetDateDirty = Boolean(activeSub) && normalizedDraftDate !== normalizedSavedDate;
  const isFormDirty = Boolean(activeSub) && (
    activeSub?.minSeaOfCloudsPct !== minSeaOfCloudsPct ||
    activeSub?.maxRainMm !== maxRainMm ||
    activeSub?.maxWindKmh !== maxWindKmh ||
    activeSub?.alertOnNoGo !== alertOnNoGo ||
    activeSub?.isActive !== isActive ||
    isTargetDateDirty
  );

  // Live threshold match preview against hydrated telemetry (matches backend Wave 12B/13B-6 rules)
  const liveEval = activeSub?.liveEvaluation || null;
  const previewMatches = useMemo(() => {
    if (!isActive) {
      return {
        wouldTrigger: false,
        isPaused: true,
        isStaleDate: false,
        weatherUnavailable: false,
        reasons: ['Cảnh báo đang tạm dừng — hệ thống sẽ bỏ qua tuyến này khi quét cho đến khi bạn bật lại.'],
      };
    }
    if (!liveEval) return null;

    const weatherAvailable =
      liveEval.weatherAvailable !== false &&
      (liveEval.seaOfCloudsPercent !== null ||
        liveEval.rainMm !== null ||
        liveEval.windKmh !== null ||
        liveEval.tempMinC !== null);

    if (!isFormDirty) {
      return {
        wouldTrigger: liveEval.alertTriggered,
        isPaused: false,
        isStaleDate: false,
        weatherUnavailable: !weatherAvailable,
        reasons: liveEval.matchedConditions,
      };
    }

    const matches: string[] = [];
    if (alertOnNoGo && liveEval.status === 'NO_GO') {
      matches.push(`Cảnh báo NO-GO (${liveEval.score}/100)`);
    }
    if (weatherAvailable) {
      if (liveEval.rainMm !== null && liveEval.rainMm > maxRainMm) {
        matches.push(`Mưa vượt ngưỡng (${liveEval.rainMm}mm > ${maxRainMm}mm)`);
      }
      if (liveEval.windKmh !== null && liveEval.windKmh > maxWindKmh) {
        matches.push(`Gió vượt ngưỡng (${liveEval.windKmh} > ${maxWindKmh} km/h)`);
      }
      if (
        liveEval.status !== 'NO_GO' &&
        liveEval.seaOfCloudsPercent !== null &&
        liveEval.seaOfCloudsPercent >= minSeaOfCloudsPct &&
        (liveEval.rainMm === null || liveEval.rainMm <= maxRainMm) &&
        (liveEval.windKmh === null || liveEval.windKmh <= maxWindKmh)
      ) {
        matches.push(`Cơ hội săn biển mây đẹp (${liveEval.seaOfCloudsPercent}% ≥ ${minSeaOfCloudsPct}%)`);
      }
    }
    return {
      wouldTrigger: matches.length > 0,
      isPaused: false,
      isStaleDate: isTargetDateDirty,
      weatherUnavailable: !weatherAvailable,
      reasons: matches,
    };
  }, [
    liveEval,
    isActive,
    isFormDirty,
    isTargetDateDirty,
    minSeaOfCloudsPct,
    maxRainMm,
    maxWindKmh,
    alertOnNoGo,
  ]);

  const todayIso = useMemo(() => getTodayIsoVn(), []);
  const hasPastSavedDate = Boolean(normalizedDraftDate && normalizedDraftDate < todayIso);
  // Allow submitting slider/isActive edits on alerts whose saved targetDate has passed
  const dateMinAttr = hasPastSavedDate ? normalizedDraftDate : todayIso;

  const canEvaluateNow =
    Boolean(activeSub) && activeSub?.isActive === true && !isFormDirty && !isEvaluating && !isSaving && !isDeleting;

  const evaluateDisabledHint = !activeSub
    ? 'Hãy bấm "Lưu Cảnh Báo Thời Tiết" trước khi chạy quét thông báo.'
    : isFormDirty
    ? 'Bạn có thay đổi chưa lưu — bấm "Cập Nhật Cảnh Báo" trước khi quét.'
    : !isActive
    ? 'Cảnh báo đang tạm dừng — hãy bật lại trạng thái theo dõi và lưu trước khi quét.'
    : undefined;

  if (!isOpen) return null;

  const handleRequestLogin = () => {
    onClose();
    if (onRequireLogin) {
      onRequireLogin('đăng ký cảnh báo thời tiết & săn biển mây');
    } else {
      window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || isDeleting || isEvaluating || isUnauthEffective) return;
    actionAbortRef.current?.abort();
    const controller = new AbortController();
    actionAbortRef.current = controller;
    const capturedKey = openSessionKey;
    setIsSaving(true);
    setInlineNotice(null);

    try {
      const saved = await upsertWeatherAlert(
        {
          trailId: trail.id,
          targetDate: normalizedDraftDate ? normalizedDraftDate : null,
          minSeaOfCloudsPct,
          maxRainMm,
          maxWindKmh,
          alertOnNoGo,
          isActive,
        },
        controller.signal
      );
      if (
        !isMountedRef.current ||
        controller.signal.aborted ||
        activeSessionKeyRef.current !== capturedKey
      ) {
        return;
      }

      const wasNew = !activeSub;
      const nextCount = wasNew ? Math.min(maxLimit, currentCount + 1) : currentCount;
      setLoadState((prev) => ({
        ...prev,
        key: capturedKey,
        sub: saved,
        count: wasNew ? Math.min(prev.maxLimit, prev.count + 1) : prev.count,
        error: null,
      }));
      setInlineNotice({
        type: 'success',
        text: wasNew
          ? `Đã bật theo dõi thời tiết & biển mây cho ${trail.name}.`
          : `Đã cập nhật ngưỡng cảnh báo cho ${trail.name}.`,
      });
      emitGlobalToast(
        onShowToast,
        wasNew
          ? `Đã đăng ký cảnh báo thời tiết cho ${trail.name}!`
          : `Đã cập nhật cảnh báo thời tiết ${trail.name}.`,
        'success'
      );
      onAlertChanged?.({
        action: 'upsert',
        trailId: trail.id,
        sub: saved,
        totalCount: nextCount,
      });
      window.dispatchEvent(
        new CustomEvent('lost:weather-alerts-updated', {
          detail: { source: eventSource, action: 'upsert', trailId: trail.id },
        })
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!isMountedRef.current || activeSessionKeyRef.current !== capturedKey) return;
      const msg =
        err instanceof Error ? err.message : 'Không thể lưu cảnh báo thời tiết lúc này.';
      setInlineNotice({ type: 'error', text: msg });
      emitGlobalToast(onShowToast, msg, 'error');
    } finally {
      if (isMountedRef.current && activeSessionKeyRef.current === capturedKey) {
        setIsSaving(false);
      }
    }
  };

  const handleUnsubscribe = async () => {
    if (!activeSub || isDeleting || isSaving || isEvaluating) return;
    actionAbortRef.current?.abort();
    const controller = new AbortController();
    actionAbortRef.current = controller;
    const capturedKey = openSessionKey;
    setIsDeleting(true);
    setInlineNotice(null);

    try {
      await deleteWeatherAlert(trail.id, controller.signal);
      if (
        !isMountedRef.current ||
        controller.signal.aborted ||
        activeSessionKeyRef.current !== capturedKey
      ) {
        return;
      }

      const nextCount = Math.max(0, currentCount - 1);
      setLoadState((prev) => ({
        ...prev,
        key: capturedKey,
        sub: null,
        count: Math.max(0, prev.count - 1),
        error: null,
      }));
      setInlineNotice({
        type: 'info',
        text: `Đã hủy theo dõi cảnh báo thời tiết cho ${trail.name}.`,
      });
      emitGlobalToast(onShowToast, `Đã hủy cảnh báo thời tiết ${trail.name}.`, 'info');
      onAlertChanged?.({
        action: 'delete',
        trailId: trail.id,
        sub: null,
        totalCount: nextCount,
      });
      window.dispatchEvent(
        new CustomEvent('lost:weather-alerts-updated', {
          detail: { source: eventSource, action: 'delete', trailId: trail.id },
        })
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!isMountedRef.current || activeSessionKeyRef.current !== capturedKey) return;
      const msg =
        err instanceof Error ? err.message : 'Không thể hủy theo dõi cảnh báo lúc này.';
      setInlineNotice({ type: 'error', text: msg });
      emitGlobalToast(onShowToast, msg, 'error');
    } finally {
      if (isMountedRef.current && activeSessionKeyRef.current === capturedKey) {
        setIsDeleting(false);
      }
    }
  };

  const handleEvaluateNow = async () => {
    if (!canEvaluateNow || isUnauthEffective) return;
    actionAbortRef.current?.abort();
    const controller = new AbortController();
    actionAbortRef.current = controller;
    const capturedKey = openSessionKey;
    setIsEvaluating(true);
    setInlineNotice(null);

    try {
      const res = await evaluateMyWeatherAlerts(controller.signal);
      if (
        !isMountedRef.current ||
        controller.signal.aborted ||
        activeSessionKeyRef.current !== capturedKey
      ) {
        return;
      }

      const updatedSub = res.data.find((item) => item.trailId === trail.id) || activeSub;
      setLoadState((prev) => ({
        ...prev,
        key: capturedKey,
        // Preserve full total count (active + paused) instead of overwriting with active-only res.data.length
        count: typeof res.totalCount === 'number' ? res.totalCount : prev.count,
        sub: updatedSub,
        error: null,
      }));
      const msg =
        res.notificationsCreated > 0
          ? `Đã quét ${res.evaluatedCount} tuyến đang bật và gửi ${res.notificationsCreated} thông báo cảnh báo mới vào chuông thông báo!`
          : res.evaluatedCount > 0
          ? `Đã quét ${res.evaluatedCount} tuyến đang bật — hiện chưa có cảnh báo mới (hoặc đang trong thời gian chờ chống spam 6 giờ).`
          : 'Bạn chưa có tuyến đang kích hoạt để quét. Hãy lưu cấu hình trước khi kiểm tra.';
      setInlineNotice({
        type: res.notificationsCreated > 0 ? 'success' : 'info',
        text: msg,
      });
      emitGlobalToast(onShowToast, msg, res.notificationsCreated > 0 ? 'success' : 'info');
      onAlertChanged?.({
        action: 'evaluate',
        trailId: trail.id,
        sub: updatedSub,
        evaluatedActiveSubs: res.data,
        totalCount: res.totalCount,
      });
      window.dispatchEvent(
        new CustomEvent('lost:weather-alerts-updated', {
          detail: { source: eventSource, action: 'evaluate', trailId: trail.id },
        })
      );
      if (res.notificationsCreated > 0) {
        window.dispatchEvent(new CustomEvent('lost:notifications-synced'));
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!isMountedRef.current || activeSessionKeyRef.current !== capturedKey) return;
      const msg =
        err instanceof Error ? err.message : 'Không thể chạy kiểm tra cảnh báo lúc này.';
      setInlineNotice({ type: 'error', text: msg });
      emitGlobalToast(onShowToast, msg, 'error');
    } finally {
      if (isMountedRef.current && activeSessionKeyRef.current === capturedKey) {
        setIsEvaluating(false);
      }
    }
  };

  const verdictMeta = liveEval ? getVerdictMeta(liveEval.status) : null;
  const formatMetric = (val: number | null | undefined, suffix: string): string =>
    typeof val === 'number' && Number.isFinite(val) ? `${val}${suffix}` : '—';

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal, 3000)' as unknown as number,
        background: 'var(--overlay-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(10px, 3vw, 20px)',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Cảnh báo thời tiết & săn biển mây cho ${trail.name}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          borderRadius: 6,
          boxShadow: 'var(--shadow-3d)',
          overflow: 'hidden',
          fontFamily: 'var(--font-family)',
          outline: 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 18px',
            background: 'var(--color-bg-main)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 4,
                background: 'color-mix(in srgb, var(--color-sky) 14%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-sky) 38%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-sky)',
                flexShrink: 0,
              }}
            >
              <IconBell size={18} color="var(--color-sky)" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '1rem',
                    fontWeight: 800,
                    color: 'var(--color-text-main)',
                    lineHeight: 1.25,
                  }}
                >
                  Cảnh Báo Thời Tiết &amp; Săn Mây
                </h2>
                {!isUnauthEffective && loadState.key === openSessionKey && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: 'var(--color-surface-elevated)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-muted)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {currentCount}/{maxLimit} đỉnh
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--color-text-muted)',
                  marginTop: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <strong style={{ color: 'var(--color-text-main)' }}>{trail.name}</strong>
                {trail.province && <span>· {trail.province}</span>}
                {typeof trail.maxAltitudeM === 'number' && trail.maxAltitudeM > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--color-sun)', fontWeight: 700 }}>
                    <IconMountain size={12} color="var(--color-sun)" />
                    {trail.maxAltitudeM.toLocaleString('vi-VN')}m
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại cảnh báo thời tiết"
            style={{
              width: 32,
              height: 32,
              borderRadius: 4,
              background: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <IconX size={15} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '16px 18px 18px', overflowY: 'auto', flex: 1 }}>
          {isUnauthEffective ? (
            /* Honest Guest Prompt */
            <div
              style={{
                padding: '20px 18px',
                borderRadius: 6,
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 6,
                  background: 'color-mix(in srgb, var(--color-sky) 14%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-sky) 36%, transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-sky)',
                }}
              >
                <IconLock size={20} color="var(--color-sky)" />
              </div>
              <div style={{ maxWidth: 420 }}>
                <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 6 }}>
                  Đăng nhập để nhận cảnh báo săn biển mây &amp; an toàn NO-GO
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                  Tài khoản LOST cho phép theo dõi tối đa <strong>10 đỉnh núi</strong> theo ngưỡng xác suất biển mây,
                  lượng mưa, tốc độ gió và nhận thông báo tự động ngay khi đỉnh {trail.name} đạt điều kiện săn mây hoặc chuyển trạng thái nguy hiểm.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleRequestLogin}
                  style={{ borderRadius: 4, padding: '8px 16px', fontSize: '0.82rem', fontWeight: 800 }}
                >
                  <IconBell size={14} color="var(--color-on-primary)" />
                  <span>Đăng Nhập Để Thiết Lập</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={onClose}
                  style={{ borderRadius: 4, padding: '8px 14px', fontSize: '0.82rem' }}
                >
                  Để sau (Esc)
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Live Evaluation Preview Banner */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 6,
                  background: 'var(--color-bg-main)',
                  border: verdictMeta
                    ? `1px solid ${verdictMeta.border}`
                    : '1px solid var(--color-border)',
                  borderLeft: verdictMeta
                    ? `3px solid ${verdictMeta.accent}`
                    : '3px solid var(--color-sky)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-dim)' }}>
                    Đánh Giá Khí Tượng Thực Tế (MET Norway · AWS Open Data Terrarium DEM)
                  </span>
                  {verdictMeta && liveEval && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: verdictMeta.bg,
                        border: `1px solid ${verdictMeta.border}`,
                        color: verdictMeta.color,
                      }}
                    >
                      {verdictMeta.label} · {liveEval.score}/100
                    </span>
                  )}
                </div>

                {isHydrating ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 8 }}>
                    Đang tải cấu hình hiện có và đánh giá khí tượng thực địa...
                  </div>
                ) : liveEval ? (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(105px, 100%), 1fr))',
                        gap: 6,
                      }}
                    >
                      <div style={{ padding: '6px 8px', borderRadius: 4, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)', fontWeight: 700 }}>Biển mây</div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-sky)' }}>
                          {formatMetric(liveEval.seaOfCloudsPercent, '%')}
                        </div>
                      </div>
                      <div style={{ padding: '6px 8px', borderRadius: 4, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)', fontWeight: 700 }}>Lượng mưa</div>
                        <div
                          style={{
                            fontSize: '0.86rem',
                            fontWeight: 800,
                            color:
                              liveEval.rainMm !== null && liveEval.rainMm > maxRainMm
                                ? 'var(--color-error-text, var(--color-error))'
                                : 'var(--color-text-main)',
                          }}
                        >
                          {formatMetric(liveEval.rainMm, 'mm')}
                        </div>
                      </div>
                      <div style={{ padding: '6px 8px', borderRadius: 4, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)', fontWeight: 700 }}>Gió đỉnh</div>
                        <div
                          style={{
                            fontSize: '0.86rem',
                            fontWeight: 800,
                            color:
                              liveEval.windKmh !== null && liveEval.windKmh > maxWindKmh
                                ? 'var(--color-error-text, var(--color-error))'
                                : 'var(--color-text-main)',
                          }}
                        >
                          {formatMetric(liveEval.windKmh, ' km/h')}
                        </div>
                      </div>
                      <div style={{ padding: '6px 8px', borderRadius: 4, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)', fontWeight: 700 }}>Nhiệt thấp</div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                          {formatMetric(liveEval.tempMinC, '°C')}
                        </div>
                      </div>
                    </div>

                    {previewMatches && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: previewMatches.isPaused
                            ? 'var(--color-sun)'
                            : previewMatches.wouldTrigger
                            ? 'var(--color-primary)'
                            : 'var(--color-text-muted)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          {previewMatches.isPaused ? (
                            <IconAlertTriangle size={14} color="var(--color-sun)" style={{ marginTop: 1, flexShrink: 0 }} />
                          ) : previewMatches.wouldTrigger ? (
                            <IconCheckCircle size={14} color="var(--color-primary)" style={{ marginTop: 1, flexShrink: 0 }} />
                          ) : (
                            <IconCloud size={14} color="var(--color-sky)" style={{ marginTop: 1, flexShrink: 0 }} />
                          )}
                          <span>
                            {previewMatches.isPaused
                              ? previewMatches.reasons[0]
                              : previewMatches.wouldTrigger
                              ? `Đang chạm ngưỡng kích hoạt: ${previewMatches.reasons.join(' · ')}`
                              : previewMatches.weatherUnavailable
                              ? 'Dữ liệu khí tượng MET Norway (CC BY 4.0) tạm gián đoạn — hệ thống đang giữ trạng thái cảnh báo dừng chuyến.'
                              : 'Chưa chạm ngưỡng thông báo — hệ thống sẽ báo ngay khi điều kiện khớp.'}
                          </span>
                        </div>
                        {previewMatches.isStaleDate && (
                          <div style={{ fontSize: '0.71rem', color: 'var(--color-sun)' }}>
                            Ngày dự kiến đã đổi so với bản đã lưu — bấm &ldquo;Cập Nhật Cảnh Báo&rdquo; để đồng bộ dữ liệu khí tượng ngày mới.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                    {!isActive
                      ? 'Cảnh báo đang ở trạng thái tạm dừng — bật lại và lưu để nhận đánh giá khí tượng thực địa.'
                      : activeSub
                      ? 'Chưa có kết quả đánh giá gần đây — bấm "Kiểm Tra & Gửi Thông Báo Ngay" bên dưới để quét dữ liệu Go/No-Go và biển mây trực tiếp.'
                      : 'Lưu cấu hình bên dưới để bắt đầu nhận đánh giá Go/No-Go và xác suất biển mây tự động cho cung này.'}
                  </div>
                )}
              </div>

              {/* Limit warning if user already has 10 alerts and this trail is new */}
              {atLimitForNew && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 4,
                    background: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
                    color: 'var(--color-error-text, var(--color-error))',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <IconAlertTriangle size={15} color="var(--color-error)" style={{ flexShrink: 0 }} />
                  <span>
                    Bạn đã đạt giới hạn tối đa {maxLimit} tuyến theo dõi. Hãy hủy bớt 1 tuyến cũ trong Radar Đỉnh Cao để thêm {trail.name}.
                  </span>
                </div>
              )}

              {/* Sliders */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 6,
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {/* Sea of Clouds Slider (30-95%) */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                      <IconCloud size={14} color="var(--color-sky)" />
                      <span>Ngưỡng xác suất săn biển mây tối thiểu</span>
                    </span>
                    <strong style={{ fontSize: '0.84rem', color: 'var(--color-sky)' }}>
                      ≥ {minSeaOfCloudsPct}%
                    </strong>
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={95}
                    step={5}
                    value={minSeaOfCloudsPct}
                    onChange={(e) => setMinSeaOfCloudsPct(Number(e.target.value))}
                    aria-label="Ngưỡng xác suất săn biển mây tối thiểu"
                    style={{ width: '100%', accentColor: 'var(--color-sky)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>
                    <span>30% (Dễ báo)</span>
                    <span>70% (Khuyến nghị)</span>
                    <span>95% (Cực phẩm)</span>
                  </div>
                </label>

                {/* Max Rain Slider (0-100 mm, step 1) */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                      <IconDroplet size={14} color="var(--color-primary)" />
                      <span>Lượng mưa tối đa chấp nhận được</span>
                    </span>
                    <strong style={{ fontSize: '0.84rem', color: 'var(--color-primary)' }}>
                      ≤ {maxRainMm} mm/ngày
                    </strong>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={maxRainMm}
                    onChange={(e) => setMaxRainMm(Number(e.target.value))}
                    aria-label="Lượng mưa tối đa chấp nhận được"
                    style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>
                    <span>0mm (Khô ráo tuyệt đối)</span>
                    <span>10mm (Mưa nhỏ)</span>
                    <span>100mm</span>
                  </div>
                </label>

                {/* Max Wind Slider (10-100 km/h) */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                      <IconWind size={14} color="var(--color-earth)" />
                      <span>Tốc độ gió đỉnh tối đa chấp nhận được</span>
                    </span>
                    <strong style={{ fontSize: '0.84rem', color: 'var(--color-earth)' }}>
                      ≤ {maxWindKmh} km/h
                    </strong>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={maxWindKmh}
                    onChange={(e) => setMaxWindKmh(Number(e.target.value))}
                    aria-label="Tốc độ gió đỉnh tối đa chấp nhận được"
                    style={{ width: '100%', accentColor: 'var(--color-earth)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>
                    <span>10 km/h (Êm gió)</span>
                    <span>40 km/h (An toàn cắm trại)</span>
                    <span>100 km/h</span>
                  </div>
                </label>
              </div>

              {/* Switches & Optional Target Departure Date */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 6,
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {/* Alert on NO-GO switch */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                      <IconShieldAlert size={14} color="var(--color-error)" />
                      <span>Báo động khẩn khi đỉnh chuyển NO-GO</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
                      Cảnh báo dông sét, gió giật nguy hiểm, băng giá hoặc sạt lở thời tiết.
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={alertOnNoGo}
                    aria-label="Bật cảnh báo khẩn khi điều kiện chuyển NO-GO"
                    onClick={() => setAlertOnNoGo((v) => !v)}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 4,
                      border: alertOnNoGo
                        ? '1px solid var(--color-error)'
                        : '1px solid var(--color-border-strong)',
                      background: alertOnNoGo
                        ? 'var(--color-error)'
                        : 'var(--color-surface-elevated)',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: alertOnNoGo ? 'flex-end' : 'flex-start',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 3,
                        background: alertOnNoGo ? 'var(--color-on-danger)' : 'var(--color-text-muted)',
                        display: 'block',
                      }}
                    />
                  </button>
                </div>

                {/* Active toggle (when editing existing sub) */}
                {activeSub && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      paddingTop: 10,
                      borderTop: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                        Trạng thái theo dõi ({isActive ? 'Đang bật' : 'Tạm dừng'})
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
                        Tạm tắt nếu bạn muốn giữ ngưỡng nhưng chưa cần nhận thông báo.
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isActive}
                      aria-label="Kích hoạt hoặc tạm dừng cảnh báo thời tiết"
                      onClick={() => setIsActive((v) => !v)}
                      style={{
                        width: 44,
                        height: 24,
                        borderRadius: 4,
                        border: isActive
                          ? '1px solid var(--color-primary)'
                          : '1px solid var(--color-border-strong)',
                        background: isActive
                          ? 'var(--color-primary)'
                          : 'var(--color-surface-elevated)',
                        padding: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isActive ? 'flex-end' : 'flex-start',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 3,
                          background: isActive ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                          display: 'block',
                        }}
                      />
                    </button>
                  </div>
                )}

                {/* Optional Target Date */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    paddingTop: 10,
                    borderTop: '1px solid var(--color-border)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <label
                      htmlFor={`weather-alert-date-${trail.id}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-main)' }}
                    >
                      <IconCalendar size={14} color="var(--color-sun)" />
                      <span>Ngày dự kiến xuất phát (tùy chọn)</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        id={`weather-alert-date-${trail.id}`}
                        type="date"
                        min={dateMinAttr}
                        max="2035-12-31"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                        style={{
                          padding: '5px 8px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-card)',
                          color: 'var(--color-text-main)',
                          fontSize: '0.78rem',
                          fontFamily: 'var(--font-family)',
                        }}
                      />
                      {targetDate && (
                        <button
                          type="button"
                          onClick={() => setTargetDate('')}
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '0.72rem', borderRadius: 4 }}
                        >
                          Xóa ngày
                        </button>
                      )}
                    </div>
                  </div>
                  {hasPastSavedDate && (
                    <div style={{ fontSize: '0.71rem', color: 'var(--color-sun)' }}>
                      Ngày đã lưu ({normalizedDraftDate}) đã qua — bạn vẫn có thể lưu các thay đổi khác, đổi sang ngày mới hoặc bấm &ldquo;Xóa ngày&rdquo;.
                    </div>
                  )}
                </div>
              </div>

              {/* Inline feedback / error banner */}
              {(inlineNotice || loadState.error) && (
                <div
                  role="status"
                  style={{
                    padding: '9px 12px',
                    borderRadius: 4,
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    lineHeight: 1.45,
                    background:
                      inlineNotice?.type === 'error' || (!inlineNotice && loadState.error)
                        ? 'color-mix(in srgb, var(--color-error) 10%, transparent)'
                        : inlineNotice?.type === 'success'
                        ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
                        : 'color-mix(in srgb, var(--color-sky) 12%, transparent)',
                    border:
                      inlineNotice?.type === 'error' || (!inlineNotice && loadState.error)
                        ? '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)'
                        : inlineNotice?.type === 'success'
                        ? '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)'
                        : '1px solid color-mix(in srgb, var(--color-sky) 35%, transparent)',
                    color:
                      inlineNotice?.type === 'error' || (!inlineNotice && loadState.error)
                        ? 'var(--color-error-text, var(--color-error))'
                        : inlineNotice?.type === 'success'
                        ? 'var(--color-primary)'
                        : 'var(--color-text-main)',
                  }}
                >
                  {inlineNotice?.text || loadState.error}
                </div>
              )}

              {/* Action Footer */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  paddingTop: 4,
                }}
              >
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSaving || isDeleting || isEvaluating || atLimitForNew}
                    style={{
                      flex: '1 1 180px',
                      justifyContent: 'center',
                      padding: '9px 14px',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      borderRadius: 4,
                      opacity: isSaving || atLimitForNew ? 0.65 : 1,
                    }}
                  >
                    <IconBell size={14} color="var(--color-on-primary)" />
                    <span>
                      {isSaving
                        ? 'Đang lưu...'
                        : activeSub
                        ? 'Cập Nhật Cảnh Báo'
                        : 'Lưu Cảnh Báo Thời Tiết'}
                    </span>
                  </button>

                  {activeSub && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={handleUnsubscribe}
                      disabled={isDeleting || isSaving || isEvaluating}
                      style={{
                        padding: '9px 13px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        borderRadius: 4,
                        borderColor: 'color-mix(in srgb, var(--color-error) 45%, transparent)',
                        color: 'var(--color-error-text, var(--color-error))',
                      }}
                    >
                      <IconTrash size={14} color="var(--color-error)" />
                      <span>{isDeleting ? 'Đang hủy...' : 'Hủy Theo Dõi'}</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleEvaluateNow}
                  disabled={!canEvaluateNow}
                  title={evaluateDisabledHint}
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '8px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: 4,
                    borderColor: 'color-mix(in srgb, var(--color-sky) 45%, transparent)',
                    color: 'var(--color-sky)',
                    opacity: canEvaluateNow ? 1 : 0.55,
                    cursor: canEvaluateNow ? 'pointer' : 'not-allowed',
                  }}
                >
                  <IconRotateCw size={13} color="var(--color-sky)" />
                  <span>
                    {isEvaluating
                      ? 'Đang quét khí tượng & gửi thông báo...'
                      : 'Kiểm Tra & Gửi Thông Báo Ngay'}
                  </span>
                </button>
                {evaluateDisabledHint && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textAlign: 'center' }}>
                    {evaluateDisabledHint}
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default WeatherAlertModal;
