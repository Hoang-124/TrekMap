import React, { useState, useEffect } from 'react';
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
  trailId?: any;
  rawTrailId?: string;
  trailName?: string;
  title: string;
  startDate: string;
  endDate?: string;
  memberCount: number;
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
  const [itinerary, setItinerary] = useState<SharedItineraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !shareToken) {
      setItinerary(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchItineraryByToken(shareToken)
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          setItinerary(data);
        } else {
          // Fallback check local storage
          try {
            const cached = JSON.parse(localStorage.getItem('trekmap_local_itineraries') || '{}');
            if (cached[shareToken]) {
              setItinerary(cached[shareToken]);
              return;
            }
          } catch (e) {}
          setError('Không tìm thấy lịch trình thám hiểm này hoặc liên kết đã hết hạn.');
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setError('Lỗi khi tải thông tin lịch trình.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [shareToken, isOpen]);

  if (!isOpen) return null;

  const rawSteps: ItineraryStep[] = itinerary?.timelineSteps || itinerary?.steps || [];
  // Sort steps chronologically by day and time
  const steps = [...rawSteps].sort((a, b) => a.day - b.day || (a.time || '').localeCompare(b.time || ''));

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCanvasImage = () => {
    if (!itinerary) return;
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 950;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background Gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 950);
    grad.addColorStop(0, '#0b1726');
    grad.addColorStop(1, '#050c14');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 950);

    // Header Title
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('TREKMAP - LỊCH TRÌNH THÁM HIỂM', 50, 60);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(itinerary.title || 'Kế Hoạch Leo Núi', 50, 105);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Cung đường: ${itinerary.trailName || 'Núi Việt Nam'} | Khởi hành: ${itinerary.startDate ? new Date(itinerary.startDate).toLocaleDateString('vi-VN') : 'Sắp xếp'}`, 50, 140);
    ctx.fillText(`Thành viên: ${itinerary.memberCount || 1} người | Mã lịch trình: ${itinerary.shareToken}`, 50, 168);

    // Separator line
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 195);
    ctx.lineTo(750, 195);
    ctx.stroke();

    // Timeline Steps
    let y = 240;
    steps.slice(0, 6).forEach((s) => {
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`Ngày ${s.day} • ${s.time || '--:--'}`, 50, y);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`${s.activity} - ${s.location}`, 220, y);

      if (s.altitudeM || s.notes) {
        ctx.fillStyle = '#38bdf8';
        ctx.font = '14px sans-serif';
        const detail = [s.altitudeM ? `Cao độ: ${s.altitudeM}m` : '', s.notes ? `Ghi chú: ${s.notes}` : ''].filter(Boolean).join(' | ');
        ctx.fillText(detail, 220, y + 26);
      }

      y += 85;
    });

    // Footer Watermark
    ctx.fillStyle = '#64748b';
    ctx.font = '13px sans-serif';
    ctx.fillText('Tạo bởi Hệ Thống Bản Đồ Trekking TrekMap Việt Nam • Hotline Cứu Hộ: 114 / 115', 50, 910);

    const link = document.createElement('a');
    link.download = `LichTrinh_${itinerary.shareToken}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const associatedTrailId = typeof itinerary?.trailId === 'object' && itinerary?.trailId !== null
    ? (itinerary.trailId as any).id || (itinerary.trailId as any)._id
    : itinerary?.rawTrailId || itinerary?.trailId;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 99999 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 720,
          width: '92%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: 24,
          background: 'var(--color-bg-card)',
          border: '1.5px solid var(--color-primary)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(16, 185, 129, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid var(--color-border-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconCompass size={22} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                LỊCH TRÌNH THÁM HIỂM CHIA SẺ
              </div>
              <h3 style={{ margin: '2px 0 0 0', fontSize: '1.25rem', fontWeight: 900, color: 'var(--color-text-main)' }}>
                {itinerary ? itinerary.title : (error ? 'Lịch trình không khả dụng' : 'Đang tải lịch trình...')}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Đóng"
            aria-label="Đóng"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 6,
              borderRadius: 8,
            }}
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {loading && (
            <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ width: 32, height: 32, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px auto' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Đang truy xuất dữ liệu lịch trình từ vệ tinh TrekMap...</span>
            </div>
          )}

          {error && !loading && (
            <div
              style={{
                padding: '24px',
                borderRadius: 16,
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                textAlign: 'center',
              }}
            >
              <IconShieldAlert size={36} color="var(--color-error)" style={{ margin: '0 auto 12px auto' }} />
              <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-error)', fontWeight: 800 }}>{error}</h4>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                Vui lòng kiểm tra lại liên kết hoặc yêu cầu người tạo lịch trình gửi lại mã chia sẻ mới.
              </p>
            </div>
          )}

          {itinerary && !loading && (
            <>
              {/* Meta Summary Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    <IconMountain size={14} color="var(--color-primary)" />
                    CUNG ĐƯỜNG
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 4 }}>
                    {itinerary.trailName || 'Núi Việt Nam'}
                  </div>
                </div>

                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    <IconCalendar size={14} color="var(--color-sky)" />
                    NGÀY KHỞI HÀNH
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 4 }}>
                    {itinerary.startDate ? new Date(itinerary.startDate).toLocaleDateString('vi-VN') : 'Chưa định ngày'}
                  </div>
                </div>

                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    <IconUsers size={14} color="var(--color-sun)" />
                    THÀNH VIÊN ĐOÀN
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 4 }}>
                    {itinerary.memberCount} thành viên
                  </div>
                </div>
              </div>

              {/* Timeline Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconClock size={16} color="var(--color-primary)" />
                    Tiến Trình Chặng Đường ({steps.length} mốc)
                  </h4>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                    Mã Token: #{itinerary.shareToken}
                  </span>
                </div>

                {steps.length === 0 ? (
                  <div style={{ padding: '24px', background: 'var(--color-bg-main)', border: '1px dashed var(--color-border)', borderRadius: 14, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.86rem' }}>
                    Chưa có chặng timeline cụ thể nào được thêm vào lịch trình này.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {steps.map((step, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--color-bg-main)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 16,
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          position: 'relative',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span
                              style={{
                                background: 'var(--color-primary)',
                                color: '#041108',
                                fontSize: '0.74rem',
                                fontWeight: 900,
                                padding: '3px 10px',
                                borderRadius: 12,
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
                                fontSize: '0.75rem',
                                color: 'var(--color-sky)',
                                background: 'rgba(56, 189, 248, 0.1)',
                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                padding: '2px 8px',
                                borderRadius: 8,
                                fontWeight: 700,
                              }}
                            >
                              Cao độ: {step.altitudeM}m
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
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
                              borderRadius: 8,
                              borderLeft: '3px solid var(--color-primary)',
                              marginTop: 4,
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
                  background: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-error)', fontWeight: 700 }}>
                  <IconShieldAlert size={16} color="var(--color-error)" />
                  <span>Cứu hộ khẩn cấp: 114 (PCCC/Cứu nạn) - 115 (Cấp cứu)</span>
                </div>
                <span style={{ color: 'var(--color-text-muted)' }}>Luôn đi theo nhóm và mang đủ pin dự phòng</span>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-bg-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleCopyLink}
              disabled={loading || !!error}
              style={{
                borderRadius: 12,
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
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
                borderRadius: 12,
                fontSize: '0.82rem',
                fontWeight: 700,
                padding: '8px 14px',
              }}
            >
              Tải Ảnh Thẻ Lịch Trình (PNG)
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {associatedTrailId && onViewTrail && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onClose();
                  onViewTrail(String(associatedTrailId));
                }}
                style={{
                  borderRadius: 12,
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                }}
              >
                <IconHiking size={14} color="#041108" />
                Xem Chi Tiết Cung Núi
              </button>
            )}

            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              style={{
                borderRadius: 12,
                fontSize: '0.82rem',
                fontWeight: 700,
                padding: '8px 16px',
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
