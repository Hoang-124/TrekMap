import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap, isTopmostFocusTrap } from '../../hooks/useFocusTrap.js';
import {
  IconCompass,
  IconCalendar,
  IconUsers,
  IconClock,
  IconMapPin,
  IconMountain,
  IconShieldAlert,
  IconCheck,
  IconX,
  IconShare,
  IconHiking,
} from '../common/SvgIcons.js';
import { fetchItineraryByToken } from '../../services/api.js';

interface ItineraryStep {
  day: number;
  time: string;
  activity?: string;
  location?: string;
  altitudeM?: number;
  notes?: string;
  title?: string;
  locationNote?: string;
  description?: string;
}

interface SharedItineraryData {
  _id?: string;
  trailId?: string | { id?: string; _id?: string; name?: string } | null;
  rawTrailId?: string;
  trailName?: string;
  title: string;
  startDate: string;
  endDate?: string;
  memberCount: number;
  notes?: string;
  timelineSteps?: ItineraryStep[];
  steps?: ItineraryStep[];
  shareToken: string;
  createdAt?: string;
}

interface SharedItineraryModalProps {
  shareToken: string | null;
  isOpen: boolean;
  onClose: () => void;
  onViewTrail?: (trailId: string) => void;
}

export const SharedItineraryModal: React.FC<SharedItineraryModalProps> = ({
  shareToken,
  isOpen,
  onClose,
  onViewTrail,
}) => {
  const [loadedState, setLoadedState] = useState<{
    token: string;
    data: SharedItineraryData | null;
    error: string | null;
  }>({ token: '', data: null, error: null });
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(isOpen, dialogRef);

  // Escape key close (LIFO focus-trap + IME safe)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing) return;
      if (!isTopmostFocusTrap(dialogRef.current)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !shareToken) return;

    let isMounted = true;

    fetchItineraryByToken(shareToken)
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          setLoadedState({ token: shareToken, data: data as SharedItineraryData, error: null });
        } else {
          try {
            const cached = JSON.parse(localStorage.getItem('lost_local_itineraries') || '{}') as Record<
              string,
              SharedItineraryData
            >;
            if (cached[shareToken]) {
              setLoadedState({ token: shareToken, data: cached[shareToken], error: null });
              return;
            }
          } catch {
            // ignore corrupted storage
          }
          setLoadedState({
            token: shareToken,
            data: null,
            error: 'Không tìm thấy lịch trình thám hiểm này hoặc liên kết đã hết hạn.',
          });
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setLoadedState({
          token: shareToken,
          data: null,
          error: 'Lỗi khi tải thông tin lịch trình.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, [shareToken, isOpen]);

  const loading = Boolean(isOpen && shareToken && loadedState.token !== shareToken);
  const itinerary = isOpen && shareToken && loadedState.token === shareToken ? loadedState.data : null;
  const error = isOpen && shareToken && loadedState.token === shareToken ? loadedState.error : null;

  if (!isOpen) return null;

  const rawSteps: ItineraryStep[] = itinerary?.timelineSteps || itinerary?.steps || [];
  const steps = [...rawSteps].sort((a, b) => a.day - b.day || (a.time || '').localeCompare(b.time || ''));

  const resolvedTrailName =
    (typeof itinerary?.trailName === 'string' && itinerary.trailName.trim()) ||
    (typeof itinerary?.trailId === 'object' &&
      itinerary?.trailId !== null &&
      typeof itinerary.trailId.name === 'string' &&
      itinerary.trailId.name.trim()) ||
    'Núi Việt Nam';

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: 'Không thể sao chép tự động. Vui lòng copy URL trên thanh địa chỉ.', type: 'info' },
          })
        );
      });
  };

  const handleExportCanvasImage = () => {
    if (!itinerary) return;
    const rowHeight = 84;
    const computedHeight = Math.max(820, 250 + steps.length * rowHeight + 80);

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = computedHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 0, computedHeight);
    grad.addColorStop(0, '#0c0f0d');
    grad.addColorStop(1, '#141916');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, computedHeight);

    const canvasFont = "'Plus Jakarta Sans', 'Inter', 'Be Vietnam Pro', sans-serif";

    ctx.fillStyle = '#52b788';
    ctx.font = `bold 24px ${canvasFont}`;
    ctx.fillText('LOST — LỊCH TRÌNH THÁM HIỂM', 50, 58);

    ctx.fillStyle = '#f4f3ee';
    ctx.font = `bold 21px ${canvasFont}`;
    ctx.fillText((itinerary.title || 'Kế Hoạch Leo Núi').slice(0, 56), 50, 102);

    ctx.fillStyle = '#a8b0aa';
    ctx.font = `15px ${canvasFont}`;
    ctx.fillText(
      `Cung đường: ${resolvedTrailName} | Khởi hành: ${
        itinerary.startDate ? new Date(itinerary.startDate).toLocaleDateString('vi-VN') : 'Chưa ấn định'
      }`,
      50,
      138
    );
    ctx.fillText(`Thành viên: ${itinerary.memberCount || 1} người | Mã lịch trình: ${itinerary.shareToken}`, 50, 166);

    ctx.strokeStyle = '#52b788';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 190);
    ctx.lineTo(750, 190);
    ctx.stroke();

    let y = 236;
    steps.forEach((s) => {
      const activityLabel = s.activity || s.title || 'Chặng hành trình';
      const locationLabel = s.location || s.locationNote || '';
      const stepNote = s.notes || s.description || '';

      ctx.fillStyle = '#52b788';
      ctx.font = `bold 17px ${canvasFont}`;
      ctx.fillText(`Ngày ${s.day} · ${s.time || '--:--'}`, 50, y);

      ctx.fillStyle = '#f4f3ee';
      ctx.font = `bold 17px ${canvasFont}`;
      ctx.fillText((locationLabel ? `${activityLabel} - ${locationLabel}` : activityLabel).slice(0, 48), 220, y);

      if (s.altitudeM || stepNote) {
        ctx.fillStyle = '#6fa8c7';
        ctx.font = `14px ${canvasFont}`;
        const detail = [s.altitudeM ? `Cao độ: ${s.altitudeM}m` : '', stepNote ? `Ghi chú: ${stepNote}` : '']
          .filter(Boolean)
          .join(' | ');
        ctx.fillText(detail.slice(0, 66), 220, y + 25);
      }

      y += rowHeight;
    });

    ctx.fillStyle = '#757e78';
    ctx.font = `13px ${canvasFont}`;
    ctx.fillText('Tạo bởi Hệ Thống Bản Đồ Trekking LOST Việt Nam · Cứu Hộ Quốc Gia: 112 / 114 / 115', 50, computedHeight - 30);

    const link = document.createElement('a');
    link.download = `LichTrinh_${itinerary.shareToken}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const associatedTrailId =
    typeof itinerary?.trailId === 'object' && itinerary?.trailId !== null
      ? itinerary.trailId.id || itinerary.trailId._id
      : itinerary?.rawTrailId || itinerary?.trailId;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay-bg)',
        zIndex: 'var(--z-modal, 3000)' as unknown as number,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 14px',
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Lịch trình thám hiểm chia sẻ"
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 720,
          width: '96%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: 6,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: 'var(--shadow-3d)',
          overflow: 'hidden',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 4,
                background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
                border: '1px solid var(--color-border-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconCompass size={20} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                LỊCH TRÌNH THÁM HIỂM CHIA SẺ
              </div>
              <h3 style={{ margin: '2px 0 0 0', fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                {itinerary ? itinerary.title : error ? 'Lịch trình không khả dụng' : 'Đang tải lịch trình...'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Đóng (Esc)"
            aria-label="Đóng"
            style={{
              background: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {loading && (
            <div style={{ padding: '56px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ width: 32, height: 32, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px auto' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Đang truy xuất dữ liệu lịch trình LOST...</span>
            </div>
          )}

          {error && !loading && (
            <div
              style={{
                padding: '22px',
                borderRadius: 6,
                background: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
                textAlign: 'center',
              }}
            >
              <IconShieldAlert size={34} color="var(--color-error-text, var(--color-error))" style={{ margin: '0 auto 10px auto' }} />
              <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-error-text, var(--color-error))', fontWeight: 800 }}>{error}</h4>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                Vui lòng kiểm tra lại liên kết hoặc yêu cầu người tạo lịch trình gửi lại mã chia sẻ mới.
              </p>
            </div>
          )}

          {itinerary && !loading && (
            <>
              {/* Meta Summary Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: 10 }}>
                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    <IconMountain size={14} color="var(--color-primary)" />
                    CUNG ĐƯỜNG
                  </div>
                  <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 4 }}>
                    {resolvedTrailName}
                  </div>
                </div>

                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    <IconCalendar size={14} color="var(--color-sky)" />
                    NGÀY KHỞI HÀNH
                  </div>
                  <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 4 }}>
                    {itinerary.startDate ? new Date(itinerary.startDate).toLocaleDateString('vi-VN') : 'Chưa định ngày'}
                  </div>
                </div>

                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    <IconUsers size={14} color="var(--color-sun)" />
                    THÀNH VIÊN ĐOÀN
                  </div>
                  <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 4 }}>
                    {itinerary.memberCount} thành viên
                  </div>
                </div>
              </div>

              {/* Timeline Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconClock size={16} color="var(--color-primary)" />
                    Tiến Trình Chặng Đường ({steps.length} mốc)
                  </h4>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                    Mã Token: #{itinerary.shareToken}
                  </span>
                </div>

                {steps.length === 0 ? (
                  <div style={{ padding: '22px', background: 'var(--color-bg-main)', border: '1px dashed var(--color-border)', borderRadius: 4, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.86rem' }}>
                    Chưa có chặng timeline cụ thể nào được thêm vào lịch trình này.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {steps.map((step, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--color-bg-main)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 4,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span
                              style={{
                                background: 'var(--color-primary)',
                                color: 'var(--color-on-primary)',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                padding: '3px 9px',
                                borderRadius: 3,
                              }}
                            >
                              NGÀY {step.day}
                            </span>
                            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-dim)' }}>
                              {step.time || '--:--'}
                            </span>
                          </div>

                          {step.altitudeM && (
                            <span
                              style={{
                                fontSize: '0.74rem',
                                color: 'var(--color-sky)',
                                background: 'color-mix(in srgb, var(--color-sky) 12%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--color-sky) 28%, transparent)',
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontWeight: 700,
                              }}
                            >
                              Cao độ: {step.altitudeM}m
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                          {step.activity || step.title || 'Chặng thám hiểm'}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                          <IconMapPin size={13} color="var(--color-primary)" />
                          <span>Địa điểm: <strong>{step.location || step.locationNote || 'Cung đường'}</strong></span>
                        </div>

                        {(step.notes || step.description) && (
                          <div
                            style={{
                              fontSize: '0.8rem',
                              color: 'var(--color-text-muted)',
                              background: 'var(--color-bg-card)',
                              padding: '8px 12px',
                              borderRadius: 4,
                              borderLeft: '3px solid var(--color-primary)',
                              marginTop: 2,
                            }}
                          >
                            {step.notes || step.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Safety Advice Box */}
              <div
                style={{
                  background: 'color-mix(in srgb, var(--color-error) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-error) 25%, transparent)',
                  borderRadius: 4,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-error-text, var(--color-error))', fontWeight: 700 }}>
                  <IconShieldAlert size={16} color="var(--color-error-text, var(--color-error))" />
                  <span>Cứu hộ khẩn cấp: 112 / 114 (Cứu nạn) · 115 (Cấp cứu)</span>
                </div>
                <span style={{ color: 'var(--color-text-muted)' }}>Luôn đi theo nhóm và mang đủ pin dự phòng</span>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-bg-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleCopyLink}
              disabled={loading || !!error}
              style={{
                borderRadius: 4,
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
              }}
            >
              {copied ? <IconCheck size={14} color="var(--color-primary)" /> : <IconShare size={14} />}
              {copied ? 'Đã sao chép link!' : 'Sao chép link'}
            </button>

            <button
              type="button"
              className="btn btn-outline"
              onClick={handleExportCanvasImage}
              disabled={loading || !!error}
              style={{
                borderRadius: 4,
                fontSize: '0.82rem',
                fontWeight: 700,
                padding: '8px 12px',
              }}
            >
              Tải Ảnh Thẻ Lịch Trình (PNG)
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {associatedTrailId && onViewTrail && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onClose();
                  onViewTrail(String(associatedTrailId));
                }}
                style={{
                  borderRadius: 4,
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                }}
              >
                <IconHiking size={14} color="var(--color-on-primary)" />
                Xem Chi Tiết Cung Núi
              </button>
            )}

            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              style={{
                borderRadius: 4,
                fontSize: '0.82rem',
                fontWeight: 700,
                padding: '8px 14px',
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
