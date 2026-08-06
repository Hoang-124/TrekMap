import React, { useState } from 'react';
import { IconHeart, IconBookOpen, IconMapPin, IconCalendar, IconMessageSquare } from '../common/SvgIcons';

export interface TripReportItem {
  _id: string;
  authorId: {
    _id: string;
    fullName: string;
    avatarUrl: string;
    reputationScore?: number;
    badges?: string[];
  };
  trailId?: {
    _id: string;
    name: string;
    province?: string;
  };
  title: string;
  summary: string;
  content: string;
  photos: string[];
  tripDate: string;
  duration: string;
  rating: number;
  reactions: {
    like: number;
    love: number;
    wow: number;
  };
  commentsCount: number;
  viewsCount: number;
}

interface TripReportCardProps {
  report: TripReportItem;
}

export const TripReportCard: React.FC<TripReportCardProps> = ({ report }) => {
  const [likes, setLikes] = useState(report.reactions?.like || 0);
  const [liked, setLiked] = useState(false);

  const handleReact = async () => {
    try {
      const token = localStorage.getItem('trekmap_token');
      if (!token) return;

      const res = await fetch(`http://localhost:5000/api/trip-reports/${report._id}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'like' }),
      });
      const data = await res.json();
      if (data.success && data.reactions) {
        setLikes(data.reactions.like);
        setLiked(!liked);
      }
    } catch (err) {
      // Fail silently
    }
  };

  const formattedDate = new Date(report.tripDate).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden hover:border-emerald-500/40 transition-all duration-300 shadow-xl flex flex-col justify-between">
      {report.photos && report.photos.length > 0 && (
        <div className="relative h-48 w-full overflow-hidden bg-slate-950">
          <img src={report.photos[0]} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
          <span className="absolute bottom-3 left-3 px-2.5 py-1 bg-slate-950/80 backdrop-blur-md rounded-full text-[10px] font-semibold text-emerald-400 border border-slate-700/60 flex items-center space-x-1">
            <IconBookOpen size={12} />
            <span>Nhật ký hành trình</span>
          </span>
        </div>
      )}

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center space-x-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-emerald-950 border border-emerald-500/30 overflow-hidden flex items-center justify-center text-emerald-400 font-bold text-xs">
              {report.authorId?.avatarUrl ? (
                <img src={report.authorId.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                report.authorId?.fullName?.charAt(0) || 'T'
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-white">{report.authorId?.fullName || 'Trekker'}</div>
              <div className="text-[10px] text-slate-400 flex items-center space-x-2">
                <span>{formattedDate}</span>
                <span>•</span>
                <span>{report.duration}</span>
              </div>
            </div>
          </div>

          <h4 className="text-base font-bold text-white mb-2 leading-snug line-clamp-2">{report.title}</h4>

          {report.trailId?.name && (
            <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-800 text-[11px] text-slate-300 mb-3">
              <IconMapPin size={12} className="text-emerald-400" />
              <span>{report.trailId.name}</span>
            </div>
          )}

          <p className="text-xs text-slate-400 mb-4 line-clamp-3 leading-relaxed">{report.summary || report.content}</p>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
          <button
            onClick={handleReact}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              liked ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800/60 text-slate-400 hover:text-rose-400'
            }`}
          >
            <IconHeart size={14} className={liked ? 'fill-rose-400' : ''} />
            <span>{likes}</span>
          </button>

          <div className="flex items-center space-x-3 text-slate-400 text-[11px]">
            <div className="flex items-center space-x-1">
              <IconMessageSquare size={14} />
              <span>{report.commentsCount || 0}</span>
            </div>
            <div className="flex items-center space-x-1">
              <IconCalendar size={14} />
              <span>{report.viewsCount || 1} xem</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
