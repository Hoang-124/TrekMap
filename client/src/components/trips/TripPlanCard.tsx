import React, { useState } from 'react';
import { IconCalendar, IconUsers, IconMapPin, IconUserPlus, IconCheckCircle } from '../common/SvgIcons';

export interface TripPlanItem {
  _id: string;
  creatorId: {
    _id: string;
    fullName: string;
    avatarUrl: string;
    reputationScore?: number;
    badges?: string[];
  };
  trailName?: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  maxMembers: number;
  currentMembers: any[];
  meetingPoint: string;
  estimatedCost: string;
  difficultyLevel: number;
  status: 'recruiting' | 'full' | 'in_progress' | 'completed' | 'cancelled';
  tags: string[];
}

interface TripPlanCardProps {
  trip: TripPlanItem;
  onJoinSuccess?: () => void;
}

export const TripPlanCard: React.FC<TripPlanCardProps> = ({ trip, onJoinSuccess }) => {
  const [isJoining, setIsJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const formattedStartDate = new Date(trip.startDate).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const isFull = trip.status === 'full' || trip.currentMembers.length >= trip.maxMembers;

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const token = localStorage.getItem('trekmap_token');
      if (!token) {
        setErrorMsg('Bạn cần đăng nhập để xin ghép đoàn.');
        return;
      }

      const res = await fetch(`http://localhost:5000/api/trips/${trip._id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: joinMsg }),
      });

      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        if (onJoinSuccess) onJoinSuccess();
      } else {
        setErrorMsg(data.message || 'Lỗi khi gửi yêu cầu.');
      }
    } catch (err) {
      setErrorMsg('Không thể kết nối máy chủ.');
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-emerald-500/40 transition-all duration-300 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-950 border border-emerald-500/40 overflow-hidden flex items-center justify-center text-emerald-400 font-bold text-sm">
              {trip.creatorId?.avatarUrl ? (
                <img src={trip.creatorId.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                trip.creatorId?.fullName?.charAt(0) || 'T'
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-white">{trip.creatorId?.fullName || 'Trekker'}</div>
              <div className="text-[10px] text-emerald-400 font-mono">⭐ {trip.creatorId?.reputationScore || 50} uy tín</div>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border ${
              isFull
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}
          >
            {isFull ? 'ĐÃ ĐỦ NGUỜI' : 'ĐANG TUYỂN'}
          </span>
        </div>

        <h4 className="text-base font-bold text-white mb-2 leading-snug hover:text-emerald-400 transition-colors">
          {trip.title}
        </h4>

        {trip.trailName && (
          <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-800 text-[11px] text-slate-300 mb-3">
            <IconMapPin size={12} className="text-emerald-400" />
            <span>{trip.trailName}</span>
          </div>
        )}

        <p className="text-xs text-slate-400 mb-4 line-clamp-2 leading-relaxed">{trip.description}</p>

        <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mb-4">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <IconCalendar size={14} className="text-emerald-400 shrink-0" />
            <span>Khởi hành: <strong>{formattedStartDate}</strong></span>
          </div>
          <div className="flex items-center space-x-1.5 text-slate-300">
            <IconUsers size={14} className="text-emerald-400 shrink-0" />
            <span>
              Thành viên: <strong>{trip.currentMembers.length}/{trip.maxMembers}</strong>
            </span>
          </div>
          <div className="col-span-2 flex items-center space-x-1.5 text-slate-400 text-[10px] mt-1 border-t border-slate-800/60 pt-1">
            <IconMapPin size={12} className="text-slate-500 shrink-0" />
            <span className="truncate">Điểm hẹn: {trip.meetingPoint}</span>
          </div>
        </div>
      </div>

      <div>
        {submitted ? (
          <div className="flex items-center justify-center space-x-1.5 text-emerald-400 text-xs font-semibold py-2 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
            <IconCheckCircle size={16} />
            <span>Đã gửi yêu cầu ghép đoàn!</span>
          </div>
        ) : isJoining ? (
          <form onSubmit={handleJoin} className="space-y-2">
            <input
              type="text"
              placeholder="Lời nhắn tới trưởng đoàn (kinh nghiệm, đồ dùng...)"
              value={joinMsg}
              onChange={(e) => setJoinMsg(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              required
            />
            {errorMsg && <div className="text-[10px] text-rose-400">{errorMsg}</div>}
            <div className="flex space-x-2">
              <button
                type="submit"
                className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors"
              >
                Gửi yêu cầu
              </button>
              <button
                type="button"
                onClick={() => setIsJoining(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg hover:bg-slate-700"
              >
                Hủy
              </button>
            </div>
          </form>
        ) : (
          <button
            disabled={isFull}
            onClick={() => setIsJoining(true)}
            className={`w-full py-2 px-4 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all ${
              isFull
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-950'
            }`}
          >
            <IconUserPlus size={16} />
            <span>{isFull ? 'Đoàn đã đủ người' : 'Xin ghép đoàn ngay'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
