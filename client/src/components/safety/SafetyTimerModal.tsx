import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Trail, UserProfile } from '../../types.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { buildOfflineSosSmsUri } from '../../utils/geoMath.js';
import { scopedStorageKey } from '../../utils/storageScope.js';
import { isTopmostFocusTrap, useFocusTrap } from '../../hooks/useFocusTrap.js';
import { useSocket } from '../../hooks/useSocket.js';
import {
  IconShieldAlert,
  IconShieldCheck,
  IconX,
  IconPhone,
  IconClock,
  IconCheckCircle,
  IconCompass,
  IconAlertTriangle,
} from '../common/SvgIcons.js';

interface SafetyTimerRecord {
  _id: string;
  trailName: string;
  startedAt: string;
  expectedReturnAt: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactEmail?: string;
  lastKnownLat?: number;
  lastKnownLng?: number;
  notes?: string;
  status: 'active' | 'checked_in_safe' | 'overdue_alerted' | 'cancelled';
  emailAlertStatus?: 'none' | 'pending' | 'sent' | 'failed';
  emailRetryCount?: number;
  emailLastError?: string;
  alertedAt?: string;
}

const SAFETY_TIMERS_CACHE_BASE_KEY = 'lost_safety_timers_cache_v1';
const EMAIL_BASIC_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function loadCachedSafetyTimers(uid: string): SafetyTimerRecord[] {
  if (!uid || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(scopedStorageKey(SAFETY_TIMERS_CACHE_BASE_KEY, uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SafetyTimerRecord[]) : [];
  } catch {
    return [];
  }
}

function saveCachedSafetyTimers(uid: string, list: SafetyTimerRecord[]) {
  if (!uid || typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      scopedStorageKey(SAFETY_TIMERS_CACHE_BASE_KEY, uid),
      JSON.stringify(list.slice(0, 15))
    );
  } catch {
    // ignore storage quota errors
  }
}

function copyTextViaExecCommand(text: string): boolean {
  if (typeof document === 'undefined' || !document.body) return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function copyTextWithFallback(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => copyTextViaExecCommand(text));
  }
  return Promise.resolve(copyTextViaExecCommand(text));
}

function classifyVietnamSmsRecipient(rawPhone: string): 'empty' | 'voice_only' | 'landline' | 'mobile' {
  const digits = String(rawPhone || '').replace(/[^\d+]/g, '');
  if (!digits) return 'empty';
  if (/^(112|113|114|115)$/.test(digits)) return 'voice_only';
  if (/^(02\d{7,10}|\+?842\d{7,10})$/.test(digits)) return 'landline';
  return 'mobile';
}

interface SafetyTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile | null;
  selectedTrail?: Trail | null;
  trails?: Trail[];
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onRequireAuth?: () => void;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(Math.abs(ms) / 1000));
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const SafetyTimerModal: React.FC<SafetyTimerModalProps> = (props) => {
  if (!props.isOpen) return null;
  return (
    <SafetyTimerModalInner
      key={props.selectedTrail?.id || '__manual__'}
      {...props}
    />
  );
};

const SafetyTimerModalInner: React.FC<SafetyTimerModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  selectedTrail,
  trails = [],
  onShowToast,
  onRequireAuth,
}) => {
  const currentUserId = String(currentUser?.id || (currentUser as (UserProfile & { _id?: string }) | null)?._id || '');
  const { socket } = useSocket();
  const [activeTab, setActiveTab] = useState<'timer' | 'sos'>('timer');
  const [timers, setTimers] = useState<SafetyTimerRecord[]>(() => loadCachedSafetyTimers(currentUserId));
  const [usingOfflineCache, setUsingOfflineCache] = useState<boolean>(false);
  const [timersRefreshTick, setTimersRefreshTick] = useState(0);
  const [loadedTimersKey, setLoadedTimersKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [showCreateFormOverride, setShowCreateFormOverride] = useState(false);

  // Timer form fields — initialized once per modal open so user edits/clears to contactPhone are NEVER overwritten
  const [trailName, setTrailName] = useState(selectedTrail?.name || '');
  const [trailId, setTrailId] = useState(selectedTrail?.id || '');
  const [hoursAhead, setHoursAhead] = useState('12');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState(currentUser?.emergencyContact || '');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const selectedDropdownTrail =
    (trailId ? trails.find((t) => t.id === trailId) : null) ||
    (selectedTrail && (!trailId || selectedTrail.id === trailId) ? selectedTrail : null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const isMountedRef = useRef(true);
  const isSubmittingRef = useRef(false);
  const autoRequestedSosGpsRef = useRef(false);
  const lastOverdueSyncMsRef = useRef(0);
  const timersRequestKey = currentUserId ? `${currentUserId}:${timersRefreshTick}` : '';
  const isLoading = Boolean(currentUserId) && loadedTimersKey !== timersRequestKey;

  useFocusTrap(isOpen, dialogRef, { initialFocusRef: closeBtnRef });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Live GPS state for SOS SMS & Timer (never pre-populate voice-only 112 as SMS recipient)
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; alt: number | null } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [sosTargetPhone, setSosTargetPhone] = useState(currentUser?.emergencyContact || '');
  const [sosNote, setSosNote] = useState('Can ho tro khan cap tren duong trekking.');

  // Escape key close (strict LIFO via topmost focus trap + IME guard)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (!isTopmostFocusTrap(dialogRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (isSubmittingRef.current) return;
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const reloadTimers = useCallback(() => {
    setTimersRefreshTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!isOpen || !currentUserId) return;
    const controller = new AbortController();
    const reqKey = `${currentUserId}:${timersRefreshTick}`;

    fetch('/api/safety-timers/me', {
      headers: getApiHeaders(),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!controller.signal.aborted && isMountedRef.current && data.success && Array.isArray(data.data)) {
          setTimers(data.data);
          setUsingOfflineCache(false);
          saveCachedSafetyTimers(currentUserId, data.data);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted && isMountedRef.current) {
          const cached = loadCachedSafetyTimers(currentUserId);
          if (cached.length > 0) {
            setTimers(cached);
            setUsingOfflineCache(true);
          }
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && isMountedRef.current) {
          setLoadedTimersKey(reqKey);
        }
      });

    return () => controller.abort();
  }, [isOpen, currentUserId, timersRefreshTick]);

  // Listen to real-time socket safetyTimerOverdue event so UI transitions immediately to overdue_alerted
  useEffect(() => {
    if (!isOpen || !socket || !currentUserId) return;
    const handleSocketOverdue = () => {
      reloadTimers();
    };
    socket.on('safetyTimerOverdue', handleSocketOverdue);
    return () => {
      socket.off('safetyTimerOverdue', handleSocketOverdue);
    };
  }, [isOpen, socket, currentUserId, reloadTimers]);

  const activeTimer = timers.find((t) => t.status === 'active' || t.status === 'overdue_alerted');

  // Live 1-second ticking countdown + server status re-sync once timer crosses 00:00:00
  useEffect(() => {
    if (!isOpen || !activeTimer) return;
    const deadlineMs = new Date(activeTimer.expectedReturnAt).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (
        activeTimer.status === 'active' &&
        Number.isFinite(deadlineMs) &&
        now >= deadlineMs &&
        now - lastOverdueSyncMsRef.current >= 15_000
      ) {
        lastOverdueSyncMsRef.current = now;
        reloadTimers();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, activeTimer, reloadTimers]);

  const handleCaptureGps = useCallback((silentError = false) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      if (!silentError) onShowToast?.('Thiết bị không hỗ trợ cảm biến GPS.', 'error');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!isMountedRef.current) return;
        setGpsCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          alt: pos.coords.altitude !== null ? Math.round(pos.coords.altitude) : null,
        });
        setIsLocating(false);
        if (!silentError) onShowToast?.('Đã chốt tọa độ GPS thực tế cho tín hiệu an toàn!', 'success');
      },
      () => {
        if (!isMountedRef.current) return;
        setIsLocating(false);
        if (!silentError) {
          onShowToast?.('Không thể lấy tín hiệu GPS. Vui lòng bật định vị thiết bị.', 'error');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [onShowToast]);

  // Auto-request real GPS once when switching to SOS tab so coordinates are fresh without fabricating trailhead coords
  useEffect(() => {
    if (!isOpen || activeTab !== 'sos' || gpsCoords || autoRequestedSosGpsRef.current) return;
    autoRequestedSosGpsRef.current = true;
    const tid = window.setTimeout(() => {
      handleCaptureGps(true);
    }, 0);
    return () => window.clearTimeout(tid);
  }, [isOpen, activeTab, gpsCoords, handleCaptureGps]);

  const handleCreateTimer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    if (!currentUser) {
      if (onRequireAuth) onRequireAuth();
      else window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
      return;
    }

    const finalTrailName = trailName.trim() || selectedDropdownTrail?.name || '';
    if (!finalTrailName) {
      onShowToast?.('Vui lòng chọn hoặc nhập tên cung đường trekking.', 'error');
      return;
    }

    const cleanEmail = contactEmail.trim();
    if (!cleanEmail || !EMAIL_BASIC_REGEX.test(cleanEmail)) {
      onShowToast?.(
        'Vui lòng nhập email hợp lệ của người thân — hệ thống hiện gửi cảnh báo quá hạn tự động qua email.',
        'error'
      );
      return;
    }

    const hrs = Math.max(0.5, Math.min(720, Number(hoursAhead) || 12));
    const expectedReturnAt = new Date(Date.now() + hrs * 60 * 60 * 1000).toISOString();

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/safety-timers', {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          trailId: trailId || undefined,
          trailName: finalTrailName,
          expectedReturnAt,
          emergencyContactName: contactName.trim(),
          emergencyContactPhone: contactPhone.trim(),
          emergencyContactEmail: cleanEmail,
          ...(gpsCoords ? { lastKnownLat: gpsCoords.lat, lastKnownLng: gpsCoords.lng } : {}),
          notes: notes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể kích hoạt lịch hẹn.');
      }
      onShowToast?.(data.message || 'Đã kích hoạt hẹn giờ báo bình an!', 'success');
      if (isMountedRef.current) {
        setNotes('');
        setShowCreateFormOverride(false);
        reloadTimers();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi máy chủ khi đặt lịch báo bình an.';
      onShowToast?.(msg, 'error');
    } finally {
      isSubmittingRef.current = false;
      if (isMountedRef.current) setIsSubmitting(false);
    }
  };

  const handleMarkSafe = async (id: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/safety-timers/${encodeURIComponent(id)}/safe`, {
        method: 'PUT',
        headers: getApiHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể xác nhận an toàn.');
      }
      onShowToast?.(data.message || 'Đã báo bình an thành công!', 'success');
      if (isMountedRef.current) reloadTimers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi xác nhận an toàn.';
      onShowToast?.(msg, 'error');
    } finally {
      isSubmittingRef.current = false;
      if (isMountedRef.current) setIsSubmitting(false);
    }
  };

  const handleCancelTimer = async (id: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/safety-timers/${encodeURIComponent(id)}/cancel`, {
        method: 'PUT',
        headers: getApiHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể hủy lịch hẹn báo bình an.');
      }
      onShowToast?.('Đã hủy lịch hẹn báo bình an.', 'info');
      if (isMountedRef.current) reloadTimers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi hủy lịch hẹn.';
      onShowToast?.(msg, 'error');
    } finally {
      isSubmittingRef.current = false;
      if (isMountedRef.current) setIsSubmitting(false);
    }
  };

  const handleExtendTimer = async (id: string, extendMinutes: number) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/safety-timers/${encodeURIComponent(id)}/extend`, {
        method: 'PATCH',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ extendMinutes }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể gia hạn lịch hẹn.');
      }
      const hoursLabel = extendMinutes >= 60 ? `+${extendMinutes / 60} giờ` : `+${extendMinutes} phút`;
      onShowToast?.(`Đã gia hạn lịch báo bình an thêm ${hoursLabel}!`, 'success');
      if (isMountedRef.current) reloadTimers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi máy chủ khi gia hạn lịch hẹn.';
      onShowToast?.(msg, 'error');
    } finally {
      isSubmittingRef.current = false;
      if (isMountedRef.current) setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const activeDeadlineMs = activeTimer ? new Date(activeTimer.expectedReturnAt).getTime() : 0;
  const remainingMs = activeTimer ? activeDeadlineMs - nowMs : 0;
  const isOverdue = Boolean(activeTimer && (activeTimer.status === 'overdue_alerted' || remainingMs <= 0));
  const historicalTimers = timers.filter((t) => t._id !== activeTimer?._id);
  const shouldShowCreateForm = !activeTimer || (showCreateFormOverride && activeTimer.status !== 'overdue_alerted');

  // Life-safety P0: NEVER mix trailhead startLat/startLng with summit maxAltitudeM in SOS SMS
  const sosPayload = buildOfflineSosSmsUri({
    phone: sosTargetPhone.trim(),
    trailName: trailName || selectedDropdownTrail?.name || '',
    lat: gpsCoords ? gpsCoords.lat : null,
    lng: gpsCoords ? gpsCoords.lng : null,
    altitudeM: gpsCoords ? gpsCoords.alt : null,
    note: sosNote,
  });

  const sosRecipientKind = classifyVietnamSmsRecipient(sosTargetPhone);
  const cleanSosDial = sosTargetPhone.replace(/[^\d+]/g, '');

  const handleCopySos = async () => {
    const ok = await copyTextWithFallback(sosPayload.body);
    if (ok) {
      onShowToast?.('Đã sao chép nội dung tin nhắn SOS!', 'success');
    } else {
      onShowToast?.('Không thể tự động sao chép. Hãy chọn nội dung bên dưới.', 'info');
    }
  };

  return createPortal(
    <div
      className="modal-overlay"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay-bg)',
        zIndex: 'var(--z-modal, 3000)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="An toàn hành trình và SOS ngoại tuyến"
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 640,
          width: '95vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 22,
          borderRadius: 6,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          borderTop: '3px solid var(--color-error)',
          boxShadow: 'var(--shadow-3d)',
          outline: 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 4,
                background: 'color-mix(in srgb, var(--color-error) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-error-text, var(--color-error))',
                flexShrink: 0,
              }}
            >
              <IconShieldAlert size={18} color="var(--color-error-text, var(--color-error))" />
            </div>
            <div>
              <h3 className="font-editorial" style={{ margin: 0, fontSize: '1.3rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
                An toàn hành trình &amp; SOS ngoại tuyến
              </h3>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                Tự động báo email người thân nếu quá giờ về &amp; tin nhắn SOS sóng 2G
              </div>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              if (!isSubmittingRef.current) onClose();
            }}
            aria-label="Đóng"
            title="Đóng (Esc)"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.5 : 1,
              padding: 4,
            }}
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Mode Switcher */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginBottom: 18 }}>
          <button
            type="button"
            className={`btn ${activeTab === 'timer' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('timer')}
            style={{ justifyContent: 'center', fontSize: '0.82rem', padding: '9px 12px', borderRadius: 4 }}
          >
            <IconClock size={15} />
            <span>Hẹn giờ báo bình an</span>
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'sos' ? 'btn-danger' : 'btn-outline'}`}
            onClick={() => setActiveTab('sos')}
            style={{ justifyContent: 'center', fontSize: '0.82rem', padding: '9px 12px', borderRadius: 4 }}
          >
            <IconPhone size={15} />
            <span>SOS SMS ngoại tuyến (2G)</span>
          </button>
        </div>

        {activeTab === 'timer' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Active / Overdue Live Countdown Card */}
            {activeTimer && (
              <div
                style={{
                  background: isOverdue
                    ? 'var(--banner-danger-bg)'
                    : 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                  border: `1.5px solid ${isOverdue ? 'var(--color-error)' : 'var(--color-primary)'}`,
                  borderRadius: 6,
                  padding: 16,
                }}
              >
                {isOverdue && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      marginBottom: 10,
                      borderRadius: 4,
                      background: 'color-mix(in srgb, var(--color-error) 18%, transparent)',
                      border: '1px solid var(--banner-danger-border)',
                      color: 'var(--banner-danger-text)',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                    }}
                  >
                    <IconAlertTriangle size={16} color="var(--color-error-text, var(--color-error))" style={{ flexShrink: 0 }} />
                    <span>
                      ĐÃ QUÁ HẠN BÁO BÌNH AN! Hãy bấm &ldquo;Tôi Đã Ra Khỏi Rừng An Toàn&rdquo; ngay hoặc chuyển sang tab SOS 2G nếu đang gặp sự cố.
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: isOverdue ? 'var(--color-error-text, var(--color-error))' : 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {isOverdue ? (
                      <IconShieldAlert size={15} color="var(--color-error-text, var(--color-error))" />
                    ) : (
                      <IconShieldCheck size={15} color="var(--color-primary)" />
                    )}
                    {isOverdue ? 'CẢNH BÁO QUÁ HẠN HÀNH TRÌNH' : 'ĐANG BẬT CHẾ ĐỘ BẢO VỆ HÀNH TRÌNH'}
                  </span>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    Hạn: {new Date(activeTimer.expectedReturnAt).toLocaleString('vi-VN')}
                  </span>
                </div>

                {/* Live Ticking HH:MM:SS Countdown */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                    padding: '10px 12px',
                    marginBottom: 10,
                    borderRadius: 4,
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                      {isOverdue ? 'Thời gian quá hạn' : 'Thời gian đếm ngược còn lại'}
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 2 }}>
                      {activeTimer.trailName}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '1.45rem',
                      fontWeight: 900,
                      color: isOverdue ? 'var(--color-error-text, var(--color-error))' : 'var(--color-primary)',
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {isOverdue ? `+${formatCountdown(remainingMs)}` : formatCountdown(remainingMs)}
                  </div>
                </div>

                {usingOfflineCache && (
                  <div
                    role="status"
                    style={{
                      padding: '6px 10px',
                      marginBottom: 10,
                      borderRadius: 4,
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-muted)',
                      fontSize: '0.74rem',
                    }}
                  >
                    Đang hiển thị bản lưu ngoại tuyến trên máy. Cần có sóng mạng để gửi xác nhận bình an lên máy chủ.
                  </div>
                )}

                {(!activeTimer.emergencyContactEmail ||
                  activeTimer.emailAlertStatus === 'failed' ||
                  activeTimer.emailAlertStatus === 'none' ||
                  (activeTimer.status === 'overdue_alerted' && activeTimer.emailAlertStatus === 'pending')) && (
                  <div
                    role="alert"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '8px 10px',
                      marginBottom: 10,
                      borderRadius: 4,
                      background: 'var(--banner-danger-bg)',
                      border: '1px solid var(--banner-danger-border)',
                      color: 'var(--banner-danger-text)',
                      fontSize: '0.76rem',
                      lineHeight: 1.45,
                    }}
                  >
                    <IconAlertTriangle size={15} color="var(--color-error-text, var(--color-error))" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>
                      {activeTimer.emailAlertStatus === 'failed'
                        ? `Không gửi được email cảnh báo quá hạn${activeTimer.emailLastError ? ` (${activeTimer.emailLastError})` : ''}. Hãy gọi hoặc nhắn SMS 2G trực tiếp cho người thân.`
                        : activeTimer.status === 'overdue_alerted' && activeTimer.emailAlertStatus === 'pending'
                          ? `Hệ thống đang thử gửi lại email cảnh báo quá hạn${activeTimer.emailRetryCount ? ` (lần thử ${activeTimer.emailRetryCount})` : ''}. Nếu gặp sự cố, hãy chuyển sang tab SOS 2G để nhắn trực tiếp.`
                          : 'Lịch hẹn này chưa có email người thân — hệ thống hiện chỉ gửi cảnh báo quá hạn tự động qua email (SĐT chỉ dùng để cứu hộ gọi tay).'}
                    </span>
                  </div>
                )}

                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: activeTimer.notes ? 6 : 12, lineHeight: 1.5 }}>
                  <div>
                    Người thân liên hệ: <strong style={{ color: 'var(--color-text-main)' }}>{activeTimer.emergencyContactName}</strong> — SĐT gọi cứu hộ: <strong style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>{activeTimer.emergencyContactPhone}</strong>
                  </div>
                  <div>
                    Email nhận cảnh báo tự động:{' '}
                    <strong style={{ color: activeTimer.emergencyContactEmail ? 'var(--color-text-main)' : 'var(--color-error-text, var(--color-error))' }}>
                      {activeTimer.emergencyContactEmail || 'Chưa thiết lập (không gửi được cảnh báo tự động)'}
                    </strong>
                  </div>
                </div>

                {activeTimer.notes && (
                  <div
                    style={{
                      fontSize: '0.76rem',
                      color: 'var(--color-text-main)',
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 4,
                      padding: '6px 10px',
                      marginBottom: 12,
                    }}
                  >
                    <strong>Ghi chú lộ trình:</strong> {activeTimer.notes}
                  </div>
                )}

                {activeTimer.status === 'active' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                      marginBottom: 10,
                      padding: '8px 10px',
                      borderRadius: 4,
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <span style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--color-text-muted)', marginRight: 4 }}>
                      Gia hạn nhanh:
                    </span>
                    {([
                      { mins: 60, label: '+1h' },
                      { mins: 120, label: '+2h' },
                      { mins: 240, label: '+4h' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.mins}
                        type="button"
                        className="btn btn-outline"
                        disabled={isSubmitting}
                        onClick={() => handleExtendTimer(activeTimer._id, opt.mins)}
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          borderRadius: 4,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                    onClick={() => handleMarkSafe(activeTimer._id)}
                    style={{ flex: 1, justifyContent: 'center', fontSize: '0.84rem', borderRadius: 4 }}
                  >
                    <IconCheckCircle size={16} /> Tôi đã ra khỏi rừng an toàn
                  </button>
                  {activeTimer.status !== 'overdue_alerted' && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={isSubmitting}
                      onClick={() => handleCancelTimer(activeTimer._id)}
                      style={{ fontSize: '0.8rem', borderRadius: 4 }}
                    >
                      Hủy lịch
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Collapsed create-form guard when a timer is already active/overdue */}
            {activeTimer && !shouldShowCreateForm && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                  padding: '10px 12px',
                  borderRadius: 4,
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.76rem',
                  color: 'var(--color-text-muted)',
                }}
              >
                <span>
                  {activeTimer.status === 'overdue_alerted'
                    ? 'Lịch hẹn hiện tại đang ở trạng thái quá hạn. Hãy xác nhận an toàn trước khi tạo lịch mới.'
                    : 'Biểu mẫu tạo lịch mới được thu gọn để tránh ghi đè lịch đang chạy.'}
                </span>
                {activeTimer.status !== 'overdue_alerted' && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setShowCreateFormOverride(true)}
                    style={{ padding: '4px 10px', fontSize: '0.74rem', borderRadius: 4 }}
                  >
                    Đặt lịch mới (thay lịch hiện tại)
                  </button>
                )}
              </div>
            )}

            {/* Create New Timer Form */}
            {shouldShowCreateForm && (
            <form onSubmit={handleCreateTimer} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                {trails.length > 0 && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Chọn nhanh cung đường (tùy chọn)</label>
                    <select
                      className="form-input"
                      style={{ borderRadius: 4 }}
                      value={trailId}
                      onChange={(e) => {
                        const found = trails.find((t) => t.id === e.target.value);
                        setTrailId(e.target.value);
                        if (found) setTrailName(found.name);
                      }}
                    >
                      <option value="">-- Tự nhập tên cung đường --</option>
                      {trails.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.province})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Tên cung đường / Hành trình *</label>
                  <input
                    className="form-input"
                    style={{ borderRadius: 4 }}
                    value={trailName}
                    onChange={(e) => {
                      setTrailName(e.target.value);
                      if (trailId) setTrailId('');
                    }}
                    placeholder="VD: Fansipan - Trạm Tôn hoặc cung tự chọn"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Dự kiến ra khỏi rừng sau (giờ)</label>
                  <select className="form-input" style={{ borderRadius: 4 }} value={hoursAhead} onChange={(e) => setHoursAhead(e.target.value)}>
                    <option value="4">4 giờ (Trong ngày)</option>
                    <option value="8">8 giờ (Leo 1 ngày)</option>
                    <option value="12">12 giờ</option>
                    <option value="24">24 giờ (1N1Đ)</option>
                    <option value="36">36 giờ (2N1Đ)</option>
                    <option value="60">60 giờ (3N2Đ)</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Tên người thân nhận cảnh báo *</label>
                  <input
                    className="form-input"
                    style={{ borderRadius: 4 }}
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="VD: Nguyễn Văn A (Người nhà)"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">SĐT người thân (cứu hộ gọi tay) *</label>
                  <input
                    className="form-input"
                    style={{ borderRadius: 4 }}
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="0912345678"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Email người thân (nhận cảnh báo tự động) *</label>
                  <input
                    type="email"
                    className="form-input"
                    style={{ borderRadius: 4 }}
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="nguoithan@domain.com"
                    required
                  />
                </div>
              </div>

              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 4,
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.74rem',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.45,
                }}
              >
                <strong style={{ color: 'var(--color-text-main)' }}>Cách hệ thống báo quá hạn:</strong> Cảnh báo tự động khi hết giờ hiện được gửi qua <strong>email</strong> tới người thân và thông báo tới quản trị viên LOST. Số điện thoại được lưu để cứu hộ gọi trực tiếp khi cần (chưa tự động gửi SMS/Zalo).
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Ghi chú lộ trình / Lán nghỉ / Số người đi cùng (tùy chọn)</label>
                <textarea
                  rows={2}
                  className="form-textarea"
                  style={{ borderRadius: 4, resize: 'vertical' }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="VD: Đi nhóm 4 người cùng Porter A Páo, dự kiến ngủ lán 2.800m, áo khoác màu cam..."
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => handleCaptureGps(false)}
                  disabled={isLocating}
                  style={{ fontSize: '0.78rem', padding: '7px 12px', borderRadius: 4 }}
                >
                  <IconCompass size={14} color="var(--color-sky)" />
                  <span>
                    {isLocating
                      ? 'Đang lấy GPS...'
                      : gpsCoords
                        ? `GPS: ${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)}`
                        : 'Gắn tọa độ GPS hiện tại'}
                  </span>
                </button>

                <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ fontSize: '0.84rem', borderRadius: 4 }}>
                  {isSubmitting ? 'Đang kích hoạt...' : 'Kích hoạt hẹn giờ báo bình an'}
                </button>
              </div>
            </form>
            )}

            {isLoading && (
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textAlign: 'center' }}>
                Đang đồng bộ lịch sử an toàn...
              </div>
            )}

            {/* Collapsible Safety Timer History */}
            {historicalTimers.length > 0 && (
              <div
                style={{
                  borderRadius: 6,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-main)',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowHistory((prev) => !prev)}
                  aria-expanded={showHistory}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    cursor: 'pointer',
                    color: 'var(--color-text-main)',
                    fontFamily: 'var(--font-family)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <IconClock size={14} color="var(--color-text-muted)" />
                    <span>Lịch Sử Hẹn Giờ ({historicalTimers.length})</span>
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>
                    {showHistory ? 'Thu gọn' : 'Xem chi tiết'}
                  </span>
                </button>

                {showHistory && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      padding: '0 12px 12px',
                      borderTop: '1px solid var(--color-border)',
                      maxHeight: 220,
                      overflowY: 'auto',
                    }}
                  >
                    {historicalTimers.map((item) => {
                      const statusMeta =
                        item.status === 'checked_in_safe'
                          ? { label: 'Đã báo bình an', color: 'var(--color-primary)' }
                          : item.status === 'overdue_alerted'
                            ? { label: 'Đã quá hạn', color: 'var(--color-error-text, var(--color-error))' }
                            : item.status === 'cancelled'
                              ? { label: 'Đã hủy', color: 'var(--color-text-dim)' }
                              : { label: 'Đang hoạt động', color: 'var(--color-sky)' };

                      return (
                        <div
                          key={item._id}
                          style={{
                            marginTop: 8,
                            padding: '8px 10px',
                            borderRadius: 4,
                            background: 'var(--color-bg-card)',
                            border: '1px solid var(--color-border)',
                            borderLeft: `3px solid ${statusMeta.color}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.8rem', color: 'var(--color-text-main)' }}>
                              {item.trailName}
                            </strong>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: 4,
                                color: statusMeta.color,
                                background: `color-mix(in srgb, ${statusMeta.color} 14%, transparent)`,
                              }}
                            >
                              {statusMeta.label}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                            <span>Người liên hệ: {item.emergencyContactName} ({item.emergencyContactPhone})</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                              Hạn: {new Date(item.expectedReturnAt).toLocaleString('vi-VN')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Offline 2G SOS SMS Tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                background: 'var(--banner-danger-bg)',
                border: '1px solid var(--banner-danger-border)',
                borderRadius: 4,
                padding: 14,
                fontSize: '0.8rem',
                color: 'var(--banner-danger-text)',
                lineHeight: 1.5,
              }}
            >
              <strong>Hoạt động khi mất 4G/Internet:</strong> Tạo sẵn tin nhắn SMS không dấu (chuẩn GSM-7 sóng 2G) kèm tọa độ GPS thực tế gửi tới <strong>số di động người thân hoặc kiểm lâm</strong>. Đầu số 112/114/115 chỉ hỗ trợ gọi thoại trực tiếp.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Số di động nhận tin SOS</label>
                <input
                  type="tel"
                  className="form-input"
                  style={{ borderRadius: 4 }}
                  value={sosTargetPhone}
                  onChange={(e) => setSosTargetPhone(e.target.value)}
                  placeholder="Nhập SĐT di động (09x, 08x, 03x...)"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Định vị GPS hiện tại</label>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => handleCaptureGps(false)}
                  disabled={isLocating}
                  style={{ width: '100%', justifyContent: 'center', height: 42, fontSize: '0.8rem', borderRadius: 4 }}
                >
                  <IconCompass size={15} color="var(--color-sky)" />
                  <span>
                    {isLocating
                      ? 'Đang đo GPS...'
                      : gpsCoords
                        ? `GPS: ${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)}`
                        : 'Cập nhật tọa độ GPS'}
                  </span>
                </button>
              </div>
            </div>

            {!gpsCoords && (
              <div
                role="status"
                style={{
                  padding: '8px 11px',
                  borderRadius: 4,
                  background: 'color-mix(in srgb, var(--color-sun) 14%, var(--color-bg-card))',
                  border: '1px solid color-mix(in srgb, var(--color-sun) 42%, var(--color-border))',
                  color: 'var(--color-text-main)',
                  fontSize: '0.76rem',
                  lineHeight: 1.45,
                }}
              >
                Chưa khóa được tọa độ GPS thực tế — hệ thống sẽ không tự điền tọa độ mẫu vào tin SOS để tránh báo sai vị trí. Hãy bước ra chỗ thoáng và bấm &ldquo;Cập nhật tọa độ GPS&rdquo;.
              </div>
            )}

            {(sosRecipientKind === 'voice_only' || sosRecipientKind === 'landline') && (
              <div
                role="alert"
                style={{
                  padding: '9px 11px',
                  borderRadius: 4,
                  background: 'var(--banner-danger-bg)',
                  border: '1px solid var(--banner-danger-border)',
                  color: 'var(--banner-danger-text)',
                  fontSize: '0.76rem',
                  lineHeight: 1.45,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  {sosRecipientKind === 'voice_only'
                    ? `Đầu số ${cleanSosDial} tại Việt Nam chỉ hỗ trợ gọi thoại, nhà mạng không nhận SMS. Hãy gọi trực tiếp hoặc nhập số di động người thân.`
                    : `Số máy bàn ${sosTargetPhone} thường không nhận được tin nhắn SMS 2G. Hãy gọi trực tiếp hoặc đổi sang số di động (09x/08x/03x).`}
                </span>
                {cleanSosDial && (
                  <a
                    href={`tel:${cleanSosDial}`}
                    className="btn btn-danger"
                    style={{ padding: '5px 10px', fontSize: '0.74rem', textDecoration: 'none', borderRadius: 4 }}
                  >
                    <IconPhone size={13} color="var(--color-on-danger)" />
                    Gọi thoại {cleanSosDial}
                  </a>
                )}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tình trạng khẩn cấp</label>
              <input
                className="form-input"
                style={{ borderRadius: 4 }}
                value={sosNote}
                onChange={(e) => setSosNote(e.target.value)}
                placeholder="VD: Chan thuong co chan, can ho tro tai lan 2..."
              />
            </div>

            <div
              style={{
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                padding: 12,
                fontSize: '0.78rem',
                color: 'var(--color-text-main)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.55,
              }}
            >
              {sosPayload.body}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a
                href={sosPayload.uri}
                className="btn btn-danger"
                style={{ flex: 1.3, justifyContent: 'center', fontSize: '0.85rem', textDecoration: 'none', borderRadius: 4 }}
              >
                <IconPhone size={16} color="var(--color-on-danger)" /> Mở ứng dụng SMS gửi SOS
              </a>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCopySos}
                style={{ flex: 1, justifyContent: 'center', fontSize: '0.82rem', borderRadius: 4 }}
              >
                Sao chép nội dung SOS
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
