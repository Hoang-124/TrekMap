import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  IconMountain,
  IconX,
  IconStar,
} from '../common/SvgIcons.js';
import { mockTrails } from '../../data/seedData.js';
import type { Trail } from '../../types.js';

interface CreateTripReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateTripReportModal: React.FC<CreateTripReportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [trails, setTrails] = useState<Trail[]>(mockTrails);
  const [selectedTrailId, setSelectedTrailId] = useState<string>(mockTrails[0]?.id || 'trail-1');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [tripDate, setTripDate] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState('2 ngày 1 đêm');
  const [groupSize, setGroupSize] = useState(4);
  const [totalCost, setTotalCost] = useState('1.500.000 VNĐ / người');
  const [difficultyActual, setDifficultyActual] = useState(3);
  const [weatherCondition, setWeatherCondition] = useState('Nắng ráo, sương mù sáng sớm, gió nhẹ');
  const [highlightsInput, setHighlightsInput] = useState('Săn biển mây Y Tý, ngắm hoàng hôn đỉnh 2860m, ăn lẩu gà đen');
  const [warningsInput, setWarningsInput] = useState('Đoạn sống lưng gió rất mạnh, cần mang áo chắn gió chuyên dụng');
  const [photoUrl, setPhotoUrl] = useState('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/trails')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.data) && data.data.length > 0) {
          setTrails(data.data);
          setSelectedTrailId(data.data[0].id || data.data[0]._id);
        }
      })
      .catch(() => {});
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('trekmap_token');
      if (!token) {
        setError('Vui lòng đăng nhập tài khoản để viết nhật ký chuyến đi.');
        setLoading(false);
        return;
      }

      const chosenTrail = trails.find((t) => t.id === selectedTrailId || (t as any)._id === selectedTrailId);
      const trailName = chosenTrail ? chosenTrail.name : 'Cung Núi Việt Nam';
      // If trailId is custom or string ID, ensure fallback ObjectId format for MongoDB
      const finalTrailId = (chosenTrail as any)?._id || (selectedTrailId.startsWith('trail-') ? '650000000000000000000002' : selectedTrailId);

      const highlights = highlightsInput.split(',').map((s) => s.trim()).filter(Boolean);
      const warnings = warningsInput.split(',').map((s) => s.trim()).filter(Boolean);

      const res = await fetch('/api/trip-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          trailId: finalTrailId,
          trailName,
          title,
          summary: summary || title,
          content,
          photos: photoUrl ? [photoUrl] : [],
          tripDate,
          duration,
          groupSize,
          totalCost,
          difficultyActual,
          weatherCondition,
          highlights,
          warnings,
          recommendations: ['Mang tối thiểu 2 lít nước', 'Thuê Porter bản địa'],
          rating: 5,
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (data.success) {
        window.dispatchEvent(
          new CustomEvent('trekmap:show-toast', {
            detail: { message: 'Đăng nhật ký chuyến đi thành công! +10 điểm uy tín Trekker.', type: 'success' },
          })
        );
        onSuccess();
        onClose();
      } else {
        setError(data.message || 'Không thể tạo bài nhật ký.');
      }
    } catch (err) {
      setLoading(false);
      setError('Lỗi kết nối máy chủ khi gửi nhật ký.');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 14px',
    background: 'var(--color-bg-main)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    fontSize: '0.84rem',
    color: 'var(--color-text-main)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.76rem',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };

  return createPortal(
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(3, 8, 14, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 99999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 680,
          width: '94%',
          padding: 0,
          borderRadius: 24,
          background: 'var(--color-bg-card)',
          border: '1.5px solid var(--color-primary)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 25px rgba(16, 185, 129, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg-main)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid var(--color-border-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconMountain size={20} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                NHẬT KÝ THỰC ĐỊA & KINH NGHIỆM
              </div>
              <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 900, color: 'var(--color-text-main)' }}>
                Viết Nhật Ký Chuyến Đi Thực Tế
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--color-error)',
                fontSize: '0.8rem',
                borderRadius: 12,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          {/* Chọn cung đường */}
          <div>
            <label style={labelStyle}>Cung đường thực tế đã đi *</label>
            <select
              value={selectedTrailId}
              onChange={(e) => setSelectedTrailId(e.target.value)}
              style={inputStyle}
            >
              {trails.map((t) => (
                <option key={t.id || (t as any)._id} value={t.id || (t as any)._id}>
                  {t.name} ({t.maxAltitudeM ? `${t.maxAltitudeM}m` : 'Núi cao'}) - {t.province || t.region}
                </option>
              ))}
            </select>
          </div>

          {/* Tiêu đề & Tóm tắt */}
          <div>
            <label style={labelStyle}>Tiêu đề bài nhật ký *</label>
            <input
              type="text"
              required
              placeholder="VD: Trải nghiệm săn biển mây Lảo Thẩn 2 ngày 1 đêm tuyệt đẹp"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Tóm tắt ngắn gọn</label>
            <input
              type="text"
              placeholder="VD: Hành trình thuận lợi, thời tiết lý tưởng, gặp porter A Hờ rất nhiệt tình..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Grid thông số chuyến đi */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>Ngày khởi hành thực tế</label>
              <input
                type="date"
                required
                value={tripDate}
                onChange={(e) => setTripDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Thời gian đi thực tế</label>
              <input
                type="text"
                placeholder="VD: 2 ngày 1 đêm"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Số thành viên trong nhóm</label>
              <input
                type="number"
                min={1}
                max={50}
                value={groupSize}
                onChange={(e) => setGroupSize(Number(e.target.value))}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Tổng chi phí thực tế</label>
              <input
                type="text"
                placeholder="VD: 1.600.000 VNĐ / người"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Đánh giá độ dốc & Độ khó thực tế */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>Độ khó thực tế gặp phải (1-5 sao)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setDifficultyActual(star)}
                    style={{
                      background: star <= difficultyActual ? 'rgba(245, 158, 11, 0.2)' : 'var(--color-bg-main)',
                      border: `1.5px solid ${star <= difficultyActual ? 'var(--color-sun)' : 'var(--color-border)'}`,
                      borderRadius: 10,
                      padding: '8px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      color: star <= difficultyActual ? 'var(--color-sun)' : 'var(--color-text-dim)',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                    }}
                  >
                    <IconStar size={14} color={star <= difficultyActual ? 'var(--color-sun)' : 'var(--color-text-dim)'} />
                    {star} {star === 1 ? '(Dễ)' : star === 3 ? '(Vừa)' : star === 5 ? '(Cực khó)' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Tình hình thời tiết thực địa</label>
              <input
                type="text"
                placeholder="VD: Nắng ráo, sương mù sáng sớm, gió mạnh trên đỉnh"
                value={weatherCondition}
                onChange={(e) => setWeatherCondition(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Điểm nổi bật & Lưu ý an toàn */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>Điểm nổi bật (phân cách bằng dấu phẩy)</label>
              <input
                type="text"
                placeholder="Săn mây, ngắm bình minh, hoa đỗ quyên nở rộ"
                value={highlightsInput}
                onChange={(e) => setHighlightsInput(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Cảnh báo an toàn hiện trường</label>
              <input
                type="text"
                placeholder="Đoạn dốc trơn khi mưa, đá lăn ở km số 6"
                value={warningsInput}
                onChange={(e) => setWarningsInput(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* URL Ảnh kỷ niệm */}
          <div>
            <label style={labelStyle}>Link ảnh kỷ niệm hiện trường</label>
            <input
              type="url"
              placeholder="https://images.unsplash.com/..."
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Nội dung chi tiết */}
          <div>
            <label style={labelStyle}>Nội dung chi tiết kinh nghiệm & Review cung đường *</label>
            <textarea
              required
              rows={5}
              placeholder="Kể lại chi tiết hành trình: Thời gian bắt đầu leo, điểm dừng chân ăn trưa, cảm nhận về độ dốc, lán nghỉ qua đêm, porter hỗ trợ ra sao..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline"
              style={{ borderRadius: 12, padding: '9px 18px', fontSize: '0.84rem', fontWeight: 700 }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ borderRadius: 12, padding: '9px 24px', fontSize: '0.84rem', fontWeight: 800 }}
            >
              {loading ? 'Đang gửi bài...' : 'Đăng Nhật Ký Chuyến Đi'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
