import React, { useState } from 'react';
import { IconUsers, IconX } from '../common/SvgIcons';

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
        setError('Bạn cần đăng nhập để tạo chuyến.');
        setLoading(false);
        return;
      }

      const res = await fetch('http://localhost:5000/api/trips', {
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
        setError(data.message || 'Không thể mở chuyến.');
      }
    } catch (err) {
      setLoading(false);
      setError('Lỗi kết nối máy chủ.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/40">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-base">
            <IconUsers size={20} />
            <span>Mở Chuyến Ghép Đoàn Mới</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <IconX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl">{error}</div>}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Tên chuyến đi / Tiêu đề *</label>
            <input
              type="text"
              required
              placeholder="VD: 征phục Tà Xùa cuối tuần T10"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Cung đường (nếu có)</label>
              <input
                type="text"
                placeholder="VD: Fansipan, Tà Xùa..."
                value={trailName}
                onChange={(e) => setTrailName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Số lượng tối đa *</label>
              <input
                type="number"
                min={2}
                max={20}
                value={maxMembers}
                onChange={(e) => setMaxMembers(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Ngày khởi hành *</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Ngày kết thúc *</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Điểm hẹn khởi hành</label>
            <input
              type="text"
              placeholder="VD: Bến xe Mỹ Đình, Hà Nội"
              value={meetingPoint}
              onChange={(e) => setMeetingPoint(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Dự kiến chi phí</label>
            <input
              type="text"
              placeholder="VD: 1.5 triệu/người bao gồm xe + ăn uống"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Mô tả kế hoạch / Yêu cầu</label>
            <textarea
              rows={3}
              placeholder="Chi tiết lịch trình, đồ trang bị cần chuẩn bị..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg transition-colors"
            >
              {loading ? 'Đang tạo...' : 'Đăng Mở Chuyến'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
