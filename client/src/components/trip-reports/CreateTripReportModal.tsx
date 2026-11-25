import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  IconMountain,
  IconX,
  IconStar,
  IconCamera,
} from '../common/SvgIcons.js';
import { mockTrails } from '../../data/seedData.js';
import { uploadImageToCloudinary } from '../../services/api.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { useFocusTrap, isTopmostFocusTrap } from '../../hooks/useFocusTrap.js';
import type { Trail } from '../../types.js';
import { safeLocalStorageGet } from '../../utils/storageScope.js';

interface CreateTripReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const ALLOWED_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

const getTodayIso = (): string => {
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
    // Fallback to UTC+7 offset
  }
  const vn = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, '0')}-${String(vn.getUTCDate()).padStart(2, '0')}`;
};

function clampGroupSize(raw: string | number, fallback = 2): number {
  const str = String(raw).trim();
  if (!str) return fallback;
  const parsed = Math.round(Number(str));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(50, parsed));
}

function dispatchReportToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  window.dispatchEvent(new CustomEvent('lost:show-toast', { detail: { message, type } }));
}

export const CreateTripReportModal: React.FC<CreateTripReportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [trails, setTrails] = useState<Trail[]>(mockTrails);
  const [hasLoadedTrails, setHasLoadedTrails] = useState(false);
  const [selectedTrailId, setSelectedTrailId] = useState<string>(mockTrails[0]?.id || 'trail-fansipan');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [tripDate, setTripDate] = useState(getTodayIso);
  const [duration, setDuration] = useState('2 ngày 1 đêm');
  const [groupSizeInput, setGroupSizeInput] = useState('2');
  const [totalCost, setTotalCost] = useState('');
  const [rating, setRating] = useState(5);
  const [difficultyActual, setDifficultyActual] = useState(3);
  const [weatherCondition, setWeatherCondition] = useState('');
  const [highlightsInput, setHighlightsInput] = useState('');
  const [warningsInput, setWarningsInput] = useState('');
  const [recommendationsInput, setRecommendationsInput] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [failedPhotoUrls, setFailedPhotoUrls] = useState<string[]>([]);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(true);
  const isBusy = loading || uploadingPhoto;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // LIFO Focus Trap
  useFocusTrap(isOpen, dialogRef);

  const resetForm = useCallback(() => {
    setTitle('');
    setSummary('');
    setContent('');
    setTripDate(getTodayIso());
    setDuration('2 ngày 1 đêm');
    setGroupSizeInput('2');
    setTotalCost('');
    setRating(5);
    setDifficultyActual(3);
    setWeatherCondition('');
    setHighlightsInput('');
    setWarningsInput('');
    setRecommendationsInput('');
    setPhotos([]);
    setFailedPhotoUrls([]);
    setPhotoUrlInput('');
    setError('');
  }, []);

  const handleClose = useCallback(() => {
    if (isBusy) return;
    resetForm();
    onClose();
  }, [isBusy, onClose, resetForm]);

  // Only fetch /api/trails when modal is opened
  useEffect(() => {
    if (!isOpen || hasLoadedTrails) return;
    let active = true;
    fetch('/api/trails')
      .then((res) => res.json())
      .then((data) => {
        if (active && data && Array.isArray(data.data) && data.data.length > 0) {
          setTrails(data.data);
          setSelectedTrailId((prev) => prev || data.data[0].id || data.data[0]._id);
          setHasLoadedTrails(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isOpen, hasLoadedTrails]);

  // LIFO Escape key close with IME & busy guards
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (!isTopmostFocusTrap(dialogRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!isBusy) {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isBusy, handleClose]);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const remainingSlots = Math.max(0, 10 - photos.length);
    if (remainingSlots === 0) {
      const msg = 'Bạn có thể đính kèm tối đa 10 ảnh cho mỗi nhật ký chuyến đi.';
      setError(msg);
      dispatchReportToast(msg, 'info');
      e.target.value = '';
      return;
    }

    const files = Array.from(fileList).slice(0, remainingSlots);
    const truncatedCount = Math.max(0, fileList.length - remainingSlots);
    setUploadingPhoto(true);
    setError('');

    let uploadedCount = 0;
    let invalidTypeCount = 0;
    let oversizeCount = 0;
    let failedCount = 0;

    try {
      for (const file of files) {
        if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type.toLowerCase())) {
          invalidTypeCount += 1;
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          oversizeCount += 1;
          continue;
        }
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(String(ev.target?.result || ''));
            reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'));
            reader.readAsDataURL(file);
          });
          if (base64) {
            const url = await uploadImageToCloudinary(base64, file.name, 'reviews');
            if (!isMountedRef.current) return;
            uploadedCount += 1;
            setPhotos((prev) => (prev.length >= 10 || prev.includes(url) ? prev : [...prev, url]));
          }
        } catch {
          failedCount += 1;
        }
      }

      if (!isMountedRef.current) return;
      const notices: string[] = [];
      if (invalidTypeCount > 0) {
        notices.push(
          `${invalidTypeCount} tệp không đúng định dạng (chỉ hỗ trợ JPG, PNG, WebP, GIF — không hỗ trợ SVG/HEIC/BMP).`
        );
      }
      if (oversizeCount > 0) {
        notices.push(`${oversizeCount} ảnh vượt quá giới hạn 5MB nên đã bỏ qua.`);
      }
      if (failedCount > 0) {
        notices.push(
          uploadedCount > 0
            ? `Đã lưu ${uploadedCount} ảnh thành công, nhưng ${failedCount} ảnh tải lên bị lỗi.`
            : `Không thể tải ${failedCount} ảnh lên máy chủ. Bạn có thể thử lại hoặc dán đường link ảnh trực tiếp.`
        );
      }
      if (truncatedCount > 0) {
        notices.push(`Chỉ giữ tối đa 10 ảnh (đã bỏ qua ${truncatedCount} ảnh vượt giới hạn).`);
      }
      if (notices.length > 0) {
        const summaryMsg = notices.join(' ');
        setError(summaryMsg);
        dispatchReportToast(summaryMsg, failedCount > 0 || invalidTypeCount > 0 || oversizeCount > 0 ? 'error' : 'info');
      }
    } finally {
      if (isMountedRef.current) setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleAddPhotoUrl = () => {
    const trimmed = photoUrlInput.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setError('Vui lòng nhập đường link ảnh hợp lệ (https://...).');
      return;
    }
    if (photos.length >= 10) {
      setError('Bạn có thể đính kèm tối đa 10 ảnh cho mỗi bài nhật ký.');
      return;
    }
    setPhotos((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed].slice(0, 10)));
    setPhotoUrlInput('');
    setError('');
  };

  const handleRemovePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || uploadingPhoto) return;
    setError('');

    const token = safeLocalStorageGet('lost_token');
    if (!token) {
      setError('Vui lòng đăng nhập tài khoản để viết nhật ký chuyến đi.');
      window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
      return;
    }

    if (!title.trim() || !content.trim()) {
      setError('Vui lòng nhập đầy đủ tiêu đề và nội dung chuyến đi.');
      return;
    }

    const resolvedGroupSize = clampGroupSize(groupSizeInput, 2);
    setGroupSizeInput(String(resolvedGroupSize));

    setLoading(true);
    try {
      const chosenTrail = trails.find(
        (t) => t.id === selectedTrailId || (t as Trail & { _id?: string })._id === selectedTrailId
      );
      const finalTrailId =
        (chosenTrail as (Trail & { _id?: string }) | undefined)?._id || chosenTrail?.id || selectedTrailId;

      const highlights = highlightsInput.split(',').map((s) => s.trim()).filter(Boolean);
      const warnings = warningsInput.split(',').map((s) => s.trim()).filter(Boolean);
      const recommendations = recommendationsInput.split(',').map((s) => s.trim()).filter(Boolean);
      const pendingUrl = photoUrlInput.trim();
      const finalPhotos = [...photos];
      if (
        pendingUrl &&
        (pendingUrl.startsWith('http://') || pendingUrl.startsWith('https://')) &&
        finalPhotos.length < 10 &&
        !finalPhotos.includes(pendingUrl)
      ) {
        finalPhotos.push(pendingUrl);
      }

      const res = await fetch('/api/trip-reports', {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          trailId: finalTrailId,
          title: title.trim(),
          summary: summary.trim() || title.trim(),
          content: content.trim(),
          photos: finalPhotos.slice(0, 10),
          tripDate,
          duration: duration.trim() || '2 ngày 1 đêm',
          groupSize: resolvedGroupSize,
          totalCost: totalCost.trim(),
          difficultyActual,
          weatherCondition: weatherCondition.trim(),
          highlights,
          warnings,
          recommendations,
          rating,
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok && data.success) {
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: {
              message: data.message || 'Đăng nhật ký chuyến đi thành công! Bạn nhận +30 điểm uy tín.',
              type: 'success',
            },
          })
        );
        resetForm();
        onSuccess();
        onClose();
      } else {
        setError(data.message || 'Không thể tạo bài nhật ký.');
      }
    } catch {
      setLoading(false);
      setError('Lỗi kết nối máy chủ khi gửi nhật ký.');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    background: 'var(--color-bg-main)',
    border: '1px solid var(--color-border)',
    borderRadius: 4,
    fontSize: '0.84rem',
    color: 'var(--color-text-main)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.74rem',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };

  return createPortal(
    <div
      className="modal-overlay"
      onClick={() => {
        if (!isBusy) handleClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay-bg)',
        zIndex: 'var(--z-modal, 3000)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={dialogRef}
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-label="Viết nhật ký chuyến đi"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 680,
          width: '94%',
          padding: 0,
          borderRadius: 6,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: 'var(--shadow-3d)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          outline: 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 22px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg-main)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 4,
                background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
                border: '1px solid var(--color-border-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconMountain size={18} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                CHIA SẺ NHẬT KÝ HÀNH TRÌNH (+30 ĐIỂM UY TÍN)
              </div>
              <h3 style={{ margin: 0, fontSize: '1.14rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                Viết nhật ký chuyến đi
              </h3>
            </div>
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={handleClose}
            title="Đóng (Esc)"
            aria-label="Đóng"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              opacity: isBusy ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              padding: 6,
              borderRadius: 4,
            }}
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                background: 'var(--banner-danger-bg)',
                border: '1px solid var(--banner-danger-border)',
                color: 'var(--banner-danger-text)',
                fontSize: '0.8rem',
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          {/* Chọn cung đường */}
          <div>
            <label style={labelStyle}>Cung đường đã đi *</label>
            <select
              value={selectedTrailId}
              onChange={(e) => setSelectedTrailId(e.target.value)}
              style={inputStyle}
            >
              {trails.map((t) => {
                const tid = t.id || (t as Trail & { _id?: string })._id || '';
                return (
                  <option key={tid} value={tid}>
                    {t.name} ({t.maxAltitudeM ? `${t.maxAltitudeM}m` : 'Núi cao'}) - {t.province || t.region}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Tiêu đề & Tóm tắt */}
          <div>
            <label style={labelStyle}>Tiêu đề bài nhật ký *</label>
            <input
              type="text"
              required
              placeholder="VD: Trải nghiệm leo Fansipan cung Trạm Tôn 2N1Đ tháng 11"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Tóm tắt ngắn gọn</label>
            <input
              type="text"
              placeholder="VD: Lịch trình thuận lợi, đường khô ráo, săn mây sáng sớm trên đỉnh..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Grid thông số chuyến đi */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>Ngày khởi hành</label>
              <input
                type="date"
                required
                value={tripDate}
                onChange={(e) => setTripDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Thời gian chuyến đi</label>
              <input
                type="text"
                placeholder="VD: 2 ngày 1 đêm"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Số thành viên trong nhóm (1–50)</label>
              <input
                type="number"
                min={1}
                max={50}
                value={groupSizeInput}
                onChange={(e) => setGroupSizeInput(e.target.value)}
                onBlur={() => setGroupSizeInput(String(clampGroupSize(groupSizeInput, 2)))}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Tổng chi phí ước tính</label>
              <input
                type="text"
                placeholder="VD: 1.600.000 VNĐ / người"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Đánh giá chung (1-5 sao) & Độ khó cảm nhận (wrap sạch trên mobile) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>Đánh giá trải nghiệm (1-5 sao) *</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    aria-label={`${star} sao`}
                    style={{
                      background: star <= rating ? 'color-mix(in srgb, var(--color-sun) 16%, transparent)' : 'var(--color-bg-main)',
                      border: `1px solid ${star <= rating ? 'var(--color-sun)' : 'var(--color-border)'}`,
                      borderRadius: 4,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      color: star <= rating ? 'var(--color-sun)' : 'var(--color-text-dim)',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                    }}
                  >
                    <IconStar size={14} color={star <= rating ? 'var(--color-sun)' : 'var(--color-text-dim)'} fill={star <= rating ? 'var(--color-sun)' : 'none'} />
                    <span>{star}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Độ khó cảm nhận (1-5)</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setDifficultyActual(lvl)}
                    style={{
                      background: lvl <= difficultyActual ? 'color-mix(in srgb, var(--color-earth) 16%, transparent)' : 'var(--color-bg-main)',
                      border: `1px solid ${lvl <= difficultyActual ? 'var(--color-earth)' : 'var(--color-border)'}`,
                      borderRadius: 4,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      color: lvl <= difficultyActual ? 'var(--color-earth)' : 'var(--color-text-dim)',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                    }}
                  >
                    {lvl} {lvl === 1 ? '(Dễ)' : lvl === 3 ? '(Vừa)' : lvl === 5 ? '(Rất khó)' : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Thời tiết & đường mòn */}
          <div>
            <label style={labelStyle}>Thời tiết &amp; tình trạng đường mòn</label>
            <input
              type="text"
              placeholder="VD: Trời khô ráo, sáng có sương mù nhẹ, đỉnh gió mạnh 25km/h"
              value={weatherCondition}
              onChange={(e) => setWeatherCondition(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Điểm nổi bật & Lưu ý an toàn */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>Điểm nổi bật (phân cách bằng dấu phẩy)</label>
              <input
                type="text"
                placeholder="VD: Biển mây sáng sớm, hoa đỗ quyên, lán nghỉ sạch sẽ"
                value={highlightsInput}
                onChange={(e) => setHighlightsInput(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Lưu ý an toàn trên đường</label>
              <input
                type="text"
                placeholder="VD: Đoạn dốc trơn khi mưa, cần gậy và đèn pin tốt"
                value={warningsInput}
                onChange={(e) => setWarningsInput(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Khuyến nghị chuẩn bị (tùy chọn, phân cách dấu phẩy)</label>
            <input
              type="text"
              placeholder="VD: Mang 2L nước, áo chắn gió, giày bám đá"
              value={recommendationsInput}
              onChange={(e) => setRecommendationsInput(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Thư viện ảnh chuyến đi (Tối đa 10 ảnh) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>
                Ảnh chụp chuyến đi ({photos.length}/10 ảnh)
              </label>
              {photos.length < 10 && (
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 10px',
                    borderRadius: 4,
                    background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                    border: '1px solid var(--color-primary)',
                    color: 'var(--color-primary)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: uploadingPhoto ? 'wait' : 'pointer',
                  }}
                >
                  <IconCamera size={13} color="var(--color-primary)" />
                  <span>{uploadingPhoto ? 'Đang tải ảnh...' : 'Tải ảnh từ máy (nhiều ảnh)'}</span>
                  <input
                    type="file"
                    accept={ALLOWED_IMAGE_ACCEPT}
                    multiple
                    disabled={uploadingPhoto}
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>

            {photos.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                {photos.map((src, idx) => {
                  const isBroken = failedPhotoUrls.includes(src);
                  return (
                    <div
                      key={`${src}-${idx}`}
                      style={{
                        position: 'relative',
                        height: 68,
                        borderRadius: 4,
                        overflow: 'hidden',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg-main)',
                      }}
                    >
                      {isBroken ? (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 2,
                            color: 'var(--color-text-dim)',
                            fontSize: '0.62rem',
                            padding: 4,
                            textAlign: 'center',
                          }}
                        >
                          <IconCamera size={14} color="var(--color-text-dim)" />
                          <span>Lỗi ảnh</span>
                        </div>
                      ) : (
                        <img
                          loading="lazy"
                          decoding="async"
                          src={src}
                          alt={`Ảnh chuyến đi ${idx + 1}`}
                          onError={() =>
                            setFailedPhotoUrls((prev) => (prev.includes(src) ? prev : [...prev, src]))
                          }
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        aria-label={`Xóa ảnh ${idx + 1}`}
                        title="Xóa ảnh"
                        style={{
                          position: 'absolute',
                          top: 3,
                          right: 3,
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          background: 'var(--overlay-bg)',
                          border: '1px solid var(--color-border-strong)',
                          color: 'var(--color-on-media)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        <IconX size={11} color="var(--color-on-media)" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {photos.length < 10 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="url"
                  placeholder="Hoặc dán đường link ảnh (https://...) rồi bấm + Thêm"
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPhotoUrl();
                    }
                  }}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={handleAddPhotoUrl}
                  className="btn btn-outline"
                  style={{ padding: '7px 12px', borderRadius: 4, fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  + Thêm
                </button>
              </div>
            )}
          </div>

          {/* Nội dung chi tiết */}
          <div>
            <label style={labelStyle}>Chia sẻ chi tiết hành trình *</label>
            <textarea
              required
              rows={5}
              placeholder="Kể lại chi tiết hành trình: thời gian xuất phát, địa hình từng chặng, lán nghỉ, nguồn nước, kinh nghiệm hữu ích cho người đi sau..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
            <button
              type="button"
              disabled={isBusy}
              onClick={handleClose}
              className="btn btn-outline"
              style={{ borderRadius: 4, padding: '8px 18px', fontSize: '0.84rem', fontWeight: 700 }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || uploadingPhoto}
              className="btn btn-primary"
              style={{ borderRadius: 4, padding: '8px 22px', fontSize: '0.84rem', fontWeight: 800 }}
            >
              {loading ? 'Đang gửi bài...' : 'Đăng nhật ký'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
