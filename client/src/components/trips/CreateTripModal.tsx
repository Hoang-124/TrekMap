import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { IconUsers, IconX } from '../common/SvgIcons.js';

interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateTripModal: React.FC<CreateTripModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [trailName, setTrailName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxMembers, setMaxMembers] = useState(6);
  const [meetingPoint, setMeetingPoint] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('Chia đều chi phí thực tế');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('trekmap_token');
      if (!token) {
        setError('Bạn cần đăng nhập để tạo chuyến đi ghép đoàn.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          trailName,
          description,
          startDate,
          endDate,
          maxMembers,
          meetingPoint,
          estimatedCost,
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (data.success) {
        onSuccess();
        onClose();
      } else {
        setError(data.message || 'Không thể mở chuyến ghép đoàn.');
      }
    } catch (err) {
      setLoading(false);
      setError('Lỗi kết nối máy chủ khi tạo chuyến.');
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
        background: 'rgba(3, 8, 14, 0.86)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 99999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 580,
          width: '94%',
          padding: 0,
          borderRadius: 24,
          background: 'var(--color-bg-card)',
          border: '1.5px solid var(--color-primary)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 25px rgba(16, 185, 129, 0.2)',
          overflow: 'hidden',
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
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid var(--color-border-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconUsers size={20} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                KẾ HOẠCH ĐỒNG HÀNH
              </div>
              <h3 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 900, color: 'var(--color-text-main)' }}>
                Mở Chuyến Ghép Đoàn Mới
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
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '78vh', overflowY: 'auto' }}>
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

          <div>
            <label style={labelStyle}>Tên chuyến đi / Tiêu đề hành trình *</label>
            <input
              type="text"
              required
              placeholder="VD: Chinh phục Tà Xùa cuối tuần săn mây T10"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle}>Cung đường mục tiêu</label>
              <input
                type="text"
                placeholder="VD: Fansipan, Tà Xùa, Lảo Thẩn..."
                value={trailName}
                onChange={(e) => setTrailName(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Số thành viên tối đa *</label>
              <input
                type="number"
                min={2}
                max={25}
                required
                value={maxMembers}
                onChange={(e) => setMaxMembers(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle}>Ngày khởi hành *</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Ngày kết thúc *</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Điểm hẹn tập trung</label>
            <input
              type="text"
              placeholder="VD: Cổng trường ĐH Giao Thông Vận Tải, Hà Nội"
              value={meetingPoint}
              onChange={(e) => setMeetingPoint(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Dự kiến chi phí đóng góp</label>
            <input
              type="text"
              placeholder="VD: Khoảng 1.800.000 VNĐ / người (Xe khứ hồi + Porter + Ăn)"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Mô tả kế hoạch & Yêu cầu thể lực</label>
            <textarea
              rows={3}
              placeholder="Chi tiết kinh nghiệm cần có, đồ đạc mang theo, phương thức liên lạc Zalo..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
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
              style={{ borderRadius: 12, padding: '9px 22px', fontSize: '0.84rem', fontWeight: 800 }}
            >
              {loading ? 'Đang tạo chuyến...' : 'Đăng Mở Chuyến'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
