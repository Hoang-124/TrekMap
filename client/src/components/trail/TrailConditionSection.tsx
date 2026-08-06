import React, { useState, useEffect } from 'react';
import { IconAlertTriangle, IconShieldCheck, IconPlus, IconCheckCircle } from '../common/SvgIcons';

export interface ConditionItem {
  _id: string;
  userId: {
    fullName: string;
    avatarUrl: string;
    reputationScore?: number;
  };
  condition: 'safe' | 'caution' | 'dangerous' | 'closed';
  description: string;
  section: string;
  upvotes: number;
  createdAt: string;
}

interface TrailConditionSectionProps {
  trailId: string;
}

export const TrailConditionSection: React.FC<TrailConditionSectionProps> = ({ trailId }) => {
  const [conditions, setConditions] = useState<ConditionItem[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [condition, setCondition] = useState<'safe' | 'caution' | 'dangerous' | 'closed'>('safe');
  const [section, setSection] = useState('Toàn tuyến');
  const [description, setDescription] = useState('');
  const [msg, setMsg] = useState('');

  const fetchConditions = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/trail-conditions/trail/${trailId}`);
      const data = await res.json();
      if (data.success) {
        setConditions(data.data || []);
      }
    } catch (err) {
      // Fail silently
    }
  };

  useEffect(() => {
    fetchConditions();
  }, [trailId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');

    try {
      const token = localStorage.getItem('trekmap_token');
      if (!token) {
        setMsg('Bạn cần đăng nhập để báo cáo.');
        return;
      }

      const res = await fetch('http://localhost:5000/api/trail-conditions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          trailId,
          condition,
          section,
          description,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMsg('Cập nhật tình trạng thành công!');
        setIsFormOpen(false);
        setDescription('');
        fetchConditions();
      } else {
        setMsg(data.message || 'Lỗi khi gửi.');
      }
    } catch (err) {
      setMsg('Lỗi kết nối.');
    }
  };

  const handleUpvote = async (id: string) => {
    try {
      const token = localStorage.getItem('trekmap_token');
      if (!token) return;

      const res = await fetch(`http://localhost:5000/api/trail-conditions/${id}/upvote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setConditions((prev) =>
          prev.map((c) => (c._id === id ? { ...c, upvotes: data.upvotes } : c))
        );
      }
    } catch (err) {
      // Fail silently
    }
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'safe':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'caution':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'dangerous':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'closed':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getConditionLabel = (type: string) => {
    switch (type) {
      case 'safe':
        return '🟢 AN TOÀN';
      case 'caution':
        return '🟡 THẬN TRỌNG';
      case 'dangerous':
        return '🔴 NGUY HIỂM';
      case 'closed':
        return '🟣 TẠM ĐÓNG';
      default:
        return type;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2 text-white font-bold text-base">
          <IconAlertTriangle size={20} className="text-amber-400" />
          <span>Tình Trạng Đường Thực Địa 7 Ngày Qua</span>
        </div>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors"
        >
          <IconPlus size={16} />
          <span>Cập nhật mới</span>
        </button>
      </div>

      {msg && <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl">{msg}</div>}

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="mb-6 bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 animate-fadeIn">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">Mức độ an toàn</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="safe">🟢 An toàn / Thời tiết tốt</option>
                <option value="caution">🟡 Thận trọng / Cây đổ, trơn</option>
                <option value="dangerous">🔴 Nguy hiểm / Sạt lở</option>
                <option value="closed">🟣 Tạm đóng / Cấm đi</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">Đoạn đường</label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="VD: Đoạn km 3-5, Gần đỉnh..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-300 font-semibold mb-1">Chi tiết quan sát thực tế</label>
            <textarea
              rows={2}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Đỉnh sương mù dày, đường vừa mưa trơn trượt..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg hover:bg-slate-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg hover:bg-emerald-400"
            >
              Đăng báo cáo
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {conditions.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs bg-slate-950/40 rounded-xl border border-slate-800/60">
            Chưa có báo cáo tình trạng đường mới trong 7 ngày qua. Hãy là người đầu tiên cập nhật!
          </div>
        ) : (
          conditions.map((c) => (
            <div key={c._id} className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2 mb-1.5">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${getBadgeStyle(c.condition)}`}>
                    {getConditionLabel(c.condition)}
                  </span>
                  <span className="text-xs font-semibold text-white">• {c.section}</span>
                </div>
                <p className="text-xs text-slate-300 leading-snug mb-2">{c.description}</p>
                <div className="text-[10px] text-slate-500 flex items-center space-x-2">
                  <span>Báo cáo bởi {c.userId?.fullName || 'Trekker'}</span>
                  <span>•</span>
                  <span>{new Date(c.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>

              <button
                onClick={() => handleUpvote(c._id)}
                className="flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-emerald-950 hover:text-emerald-400 text-slate-300 text-xs rounded-lg transition-colors border border-slate-700/60 shrink-0"
                title="Tôi cũng ghi nhận tình trạng này"
              >
                <IconShieldCheck size={14} />
                <span>{c.upvotes}</span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
