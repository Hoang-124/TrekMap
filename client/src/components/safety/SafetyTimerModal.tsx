import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Trail, UserProfile } from '../../types.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { buildOfflineSosSmsUri } from '../../utils/geoMath.js';
import { isTopmostFocusTrap, useFocusTrap } from '../../hooks/useFocusTrap.js';
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
  const [activeTab, setActiveTab] = useState<'timer' | 'sos'>('timer');
  const [timers, setTimers] = useState<SafetyTimerRecord[]>([]);
  const [timersRefreshTick, setTimersRefreshTick] = useState(0);
  const [loadedTimersKey, setLoadedTimersKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Timer form fields — initialized once per modal open so user edits/clears to contactPhone are NEVER overwritten
  const [trailName, setTrailName] = useState(selectedTrail?.name || '');
  const [trailId, setTrailId] = useState(selectedTrail?.id || '');
  const [hoursAhead, setHoursAhead] = useState('12');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState(currentUser?.emergencyContact || '');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const isMountedRef = useRef(true);
  const isSubmittingRef = useRef(false);
  const currentUserId = String(currentUser?.id || (currentUser as (UserProfile & { _id?: string }) | null)?._id || '');
  const timersRequestKey = currentUserId ? `${currentUserId}:${timersRefreshTick}` : '';
  const isLoading = Boolean(currentUserId) && loadedTimersKey !== timersRequestKey;

  useFocusTrap(isOpen, dialogRef, { initialFocusRef: closeBtnRef });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Live GPS state for SOS SMS & Timer
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; alt: number | null } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [sosTargetPhone, setSosTargetPhone] = useState('112');
  const [sosNote, setSosNote] = useState('Cần hỗ trợ khẩn cấp trên đường trekking.');

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
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted && isMountedRef.current && data.success && Array.isArray(data.data)) {
          setTimers(data.data);
        }
      })
      .catch(() => {
        // offline safe or aborted
      })
      .finally(() => {
        if (!controller.signal.aborted && isMountedRef.current) {
          setLoadedTimersKey(reqKey);
        }
      });

    return () => controller.abort();
  }, [isOpen, currentUserId, timersRefreshTick]);

  const activeTimer = timers.find((t) => t.status === 'active' || t.status === 'overdue_alerted');

  // Live 1-second ticking countdown while an active or overdue timer is displayed
  useEffect(() => {
    if (!isOpen || !activeTimer) return;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, activeTimer]);

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      onShowToast?.('Thiết bị không hỗ trợ cảm biến GPS.', 'error');
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
        onShowToast?.('Đã chốt tọa độ GPS thực tế cho tín hiệu an toàn!', 'success');
      },
      () => {
        if (!isMountedRef.current) return;
        setIsLocating(false);
        onShowToast?.('Không thể lấy tín hiệu GPS. Vui lòng bật định vị thiết bị.', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCreateTimer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    if (!currentUser) {
      if (onRequireAuth) onRequireAuth();
      else window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
      return;
    }

    const finalTrailName = trailName.trim() || selectedTrail?.name || '';
    if (!finalTrailName) {
      onShowToast?.('Vui lòng chọn hoặc nhập tên cung đường trekking.', 'error');
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
          emergencyContactEmail: contactEmail.trim(),
          lastKnownLat: gpsCoords?.lat ?? selectedTrail?.startLat,
          lastKnownLng: gpsCoords?.lng ?? selectedTrail?.startLng,
          notes: notes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể kích hoạt lịch hẹn.');
      }
      onShowToast?.(data.message || 'Đã kích hoạt Hẹn Giờ Báo Bình An!', 'success');
      if (isMountedRef.current) {
        setNotes('');
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

  if (!isOpen) return null;

  const activeDeadlineMs = activeTimer ? new Date(activeTimer.expectedReturnAt).getTime() : 0;
  const remainingMs = activeTimer ? activeDeadlineMs - nowMs : 0;
  const isOverdue = Boolean(activeTimer && (activeTimer.status === 'overdue_alerted' || remainingMs <= 0));

  const sosPayload = buildOfflineSosSmsUri({
    phone: sosTargetPhone,
    trailName: trailName || selectedTrail?.name || 'Rừng núi Việt Nam',
    lat: gpsCoords?.lat ?? selectedTrail?.startLat ?? null,
    lng: gpsCoords?.lng ?? selectedTrail?.startLng ?? null,
    altitudeM: gpsCoords?.alt ?? selectedTrail?.maxAltitudeM ?? null,
    note: sosNote,
  });

  const handleCopySos = async () => {
    try {
      await navigator.clipboard.writeText(sosPayload.body);
      onShowToast?.('Đã sao chép nội dung tin nhắn SOS chứa tọa độ GPS!', 'success');
    } catch {
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
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
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
                An Toàn Hành Trình &amp; SOS Ngoại Tuyến
              </h3>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                Hẹn giờ báo bình an tự động (Dead-Man&apos;s Switch) &amp; Tin nhắn SMS SOS sóng 2G
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
            <span>Hẹn Giờ Báo Bình An</span>
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'sos' ? 'btn-danger' : 'btn-outline'}`}
            onClick={() => setActiveTab('sos')}
            style={{ justifyContent: 'center', fontSize: '0.82rem', padding: '9px 12px', borderRadius: 4 }}
          >
            <IconPhone size={15} />
            <span>SOS SMS Ngoại Tuyến (2G)</span>
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

                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: activeTimer.notes ? 6 : 12 }}>
                  Người nhận cảnh báo quá hạn: <strong style={{ color: 'var(--color-text-main)' }}>{activeTimer.emergencyContactName}</strong> ({activeTimer.emergencyContactPhone}
                  {activeTimer.emergencyContactEmail ? ` • ${activeTimer.emergencyContactEmail}` : ''})
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

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                    onClick={() => handleMarkSafe(activeTimer._id)}
                    style={{ flex: 1, justifyContent: 'center', fontSize: '0.84rem', borderRadius: 4 }}
                  >
                    <IconCheckCircle size={16} /> Tôi Đã Ra Khỏi Rừng An Toàn
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={isSubmitting}
                    onClick={() => handleCancelTimer(activeTimer._id)}
                    style={{ fontSize: '0.8rem', borderRadius: 4 }}
                  >
                    Hủy Lịch
                  </button>
                </div>
              </div>
            )}

            {/* Create New Timer Form */}
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
                  <label className="form-label">SĐT người thân *</label>
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
                  <label className="form-label">Email người thân (nhận cảnh báo tự động)</label>
                  <input
                    type="email"
                    className="form-input"
                    style={{ borderRadius: 4 }}
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="nguoithan@domain.com"
                  />
                </div>
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
                  onClick={handleCaptureGps}
                  disabled={isLocating}
                  style={{ fontSize: '0.78rem', padding: '7px 12px', borderRadius: 4 }}
                >
                  <IconCompass size={14} color="var(--color-sky)" />
                  <span>
                    {isLocating
                      ? 'Đang lấy GPS...'
                      : gpsCoords
                        ? `GPS: ${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)}`
                        : 'Gắn Tọa Độ GPS Hiện Tại'}
                  </span>
                </button>

                <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ fontSize: '0.84rem', borderRadius: 4 }}>
                  {isSubmitting ? 'Đang kích hoạt...' : 'Kích Hoạt Hẹn Giờ Báo Bình An'}
                </button>
              </div>
            </form>

            {isLoading && (
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textAlign: 'center' }}>
                Đang đồng bộ lịch sử an toàn...
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
              <strong>Hoạt động khi mất 4G/Internet:</strong> Tạo sẵn tin nhắn SMS chứa tọa độ GPS thập phân và đường dẫn Google Maps để gửi qua sóng di động 2G tới Tổng đài Cứu nạn <strong>112</strong>, <strong>114</strong> hoặc người thân.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Số nhận tin SOS</label>
                <input
                  className="form-input"
                  style={{ borderRadius: 4 }}
                  value={sosTargetPhone}
                  onChange={(e) => setSosTargetPhone(e.target.value)}
                  placeholder="112 hoặc SĐT người thân"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Định vị GPS hiện tại</label>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleCaptureGps}
                  disabled={isLocating}
                  style={{ width: '100%', justifyContent: 'center', height: 42, fontSize: '0.8rem', borderRadius: 4 }}
                >
                  <IconCompass size={15} color="var(--color-sky)" />
                  <span>{isLocating ? 'Đang đo GPS...' : 'Cập Nhật Tọa Độ GPS'}</span>
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tình trạng khẩn cấp</label>
              <input
                className="form-input"
                style={{ borderRadius: 4 }}
                value={sosNote}
                onChange={(e) => setSosNote(e.target.value)}
                placeholder="VD: Chấn thương cổ chân, cần hỗ trợ tại lán 2..."
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
                <IconPhone size={16} color="var(--color-on-danger)" /> Mở Ứng Dụng SMS Gửi SOS Ngay
              </a>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCopySos}
                style={{ flex: 1, justifyContent: 'center', fontSize: '0.82rem', borderRadius: 4 }}
              >
                Sao Chép Tọa Độ SOS
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
