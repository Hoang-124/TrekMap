import React, { useState, useEffect, useRef } from 'react';
import { IconBell, IconCheckCircle } from '../common/SvgIcons';

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('trekmap_token');
      if (!token) return;

      const res = await fetch('http://localhost:5000/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      // Fail silently
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      const token = localStorage.getItem('trekmap_token');
      if (!token) return;

      await fetch('http://localhost:5000/api/notifications/read-all', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      // Fail silently
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-300 hover:text-emerald-400 transition-colors rounded-full hover:bg-slate-800/60 focus:outline-none"
        title="Thông báo cộng đồng"
      >
        <IconBell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 px-1.5 py-0.5 text-[10px] font-bold text-white bg-rose-500 rounded-full animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-fadeIn">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700/50">
            <div className="flex items-center space-x-2">
              <IconBell size={18} className="text-emerald-400" />
              <span className="font-semibold text-white text-sm">Thông Báo Cộng Đồng</span>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center space-x-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <IconCheckCircle size={14} />
                <span>Đọc hết</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">Chưa có thông báo mới nào.</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  className={`p-3.5 transition-colors ${n.isRead ? 'bg-slate-900/60 text-slate-400' : 'bg-slate-800/40 text-slate-200 font-medium'}`}
                >
                  <div className="text-xs font-semibold text-emerald-400 mb-0.5">{n.title}</div>
                  <div className="text-xs text-slate-300 leading-snug">{n.message}</div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {new Date(n.createdAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
