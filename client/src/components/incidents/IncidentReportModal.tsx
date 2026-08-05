import React, { useState } from 'react';
import { submitIncident } from '../../services/api.js';
import { ShieldAlert, X, Send, PhoneCall } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  trailName?: string;
  trailId?: string;
}

export const IncidentReportModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  trailName = 'Tuyến đường Trekking',
  trailId = 'trail-fansipan',
}) => {
  const [type, setType] = useState<'landslide' | 'flood' | 'wildlife' | 'weather' | 'lost' | 'other'>('weather');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [description, setDescription] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setLoading(true);
    try {
      await submitIncident({
        trailId,
        type,
        severity,
        description,
        locationNote,
      });
      setLoading(false);
      alert('Cảnh báo sự cố đã được phát đi! Ban quản trị và các đoàn trek khu vực sẽ nhận được thông tin ngay lập tức.');
      onClose();
    } catch (err) {
      setLoading(false);
      alert('Không thể gửi báo cáo sự cố, vui lòng thử lại.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ border: '2px solid rgba(239, 68, 68, 0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'var(--color-error)', padding: 8, borderRadius: '50%', color: '#fff' }}>
              <ShieldAlert size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', margin: 0 }}>Báo cáo Sự cố Khẩn cấp</h3>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Khu vực: {trailName}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 10, padding: 12, marginBottom: 20 }}>
          <div style={{ fontSize: '0.85rem', color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <PhoneCall size={16} /> TRƯỜNG HỢP NGUY HIỂM TÍNH MẠNG: GỌI CỨU HỘ 114 HOẶC 115 NGAY LẬP TỨC
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Loại sự cố gặp phải *</label>
            <select className="form-select" value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="weather">Thời tiết xấu / Sương mù dày đặc / Bão</option>
              <option value="landslide">Sạt lở đất đá / Đứt đường mòn</option>
              <option value="flood">Lũ quét / Nước suối dâng cao nguy hiểm</option>
              <option value="lost">Người trong đoàn bị lạc đường / Mất liên lạc</option>
              <option value="wildlife">Gặp thú dữ / Ong rừng tấn công</option>
              <option value="other">Sự cố y tế / Chấn thương</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Mức độ nghiêm trọng *</label>
            <select className="form-select" value={severity} onChange={(e) => setSeverity(e.target.value as any)}>
              <option value="critical">🔴 Nguy cấp (Cần cứu hộ gấp)</option>
              <option value="high">🟠 Cao (Nguy cơ rủi ro lớn)</option>
              <option value="medium">🟡 Trung bình (Cần chú ý đề phòng)</option>
              <option value="low">🟢 Thấp (Thông tin nhắc nhở)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Tọa độ / Vị trí mốc sự cố *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ví dụ: Đoạn qua suối Lớn cách lán 2800m khoảng 1km..."
              value={locationNote}
              onChange={(e) => setLocationNote(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mô tả tình trạng chi tiết *</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Cung cấp tình trạng sức khỏe, số lượng người, thiết bị còn lại..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
              Hủy
            </button>
            <button type="submit" className="btn btn-danger" disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
              <Send size={16} /> {loading ? 'Đang phát cảnh báo...' : 'Phát cảnh báo sự cố ngay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
