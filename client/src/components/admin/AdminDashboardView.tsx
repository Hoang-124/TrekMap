import React, { useState, useEffect } from 'react';
import { IconPin, IconLock, IconTrash, IconX } from '../common/SvgIcons.js';

const createSvgIcon = (d: React.ReactNode, defaultSize = 18) => {
  return ({ size = defaultSize, color = 'currentColor', style, className }: { size?: number; color?: string; style?: React.CSSProperties; className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
      {d}
    </svg>
  );
};

const ArrowLeft = createSvgIcon(<><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></>);
const CheckCircle2 = createSvgIcon(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>);
const XCircle = createSvgIcon(<><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>);
const Trash2 = createSvgIcon(<><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></>);
const Eye = createSvgIcon(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>);
const ShieldCheck = createSvgIcon(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></>);
const Inbox = createSvgIcon(<><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>);
const Layers = createSvgIcon(<><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>);
const AlertTriangle = createSvgIcon(<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>);
const Users = createSvgIcon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>);
const MessageSquare = createSvgIcon(<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>);
const BarChart3 = createSvgIcon(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>);
const Clock = createSvgIcon(<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>);
const Database = createSvgIcon(<><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></>);
const Compass = createSvgIcon(<><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></>);
const Search = createSvgIcon(<><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>);
const RefreshCw = createSvgIcon(<><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>);
const Radio = createSvgIcon(<><circle cx="12" cy="12" r="2" /><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" /></>);

const EmptyStateIllustration = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" style={{ marginBottom: 16 }}>
    <circle cx="60" cy="60" r="50" fill="rgba(74, 222, 128, 0.05)" stroke="var(--color-border)" strokeWidth="1.5" strokeDasharray="4 4" />
    <circle cx="60" cy="60" r="36" fill="rgba(56, 189, 248, 0.08)" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1.5" />
    <path d="M30 78 L52 48 L64 64 L74 50 L92 78 Z" fill="rgba(74, 222, 128, 0.16)" stroke="var(--color-primary)" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="68" cy="40" r="6" fill="#f59e0b" opacity="0.9" />
    <g transform="translate(48, 62)">
      <circle cx="12" cy="12" r="14" fill="#10b981" />
      <path d="M7 12 L10.5 15.5 L17 9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);

interface AdminDashboardViewProps {
  onBack: () => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  currentUser?: any;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onBack,
  onShowToast,
  currentUser,
}) => {
  const [adminSection, setAdminSection] = useState<'contributions' | 'trails' | 'incidents' | 'users' | 'forum' | 'stats'>('contributions');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'all'>('pending');
  const [selectedContribution, setSelectedContribution] = useState<any | null>(null);
  const [selectedAuthorModal, setSelectedAuthorModal] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [trailSearchQuery, setTrailSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Load contributions from MongoDB with localStorage fallback
  const [contributions, setContributions] = useState<any[]>(() => {
    return JSON.parse(localStorage.getItem('trekmap_contributions') || '[]');
  });

  // Admin section states
  const [trailsList, setTrailsList] = useState<any[]>([]);
  const [incidentsList, setIncidentsList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [threadsList, setThreadsList] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [editingTrailModal, setEditingTrailModal] = useState<any | null>(null);
  const [isCreateTrailOpen, setIsCreateTrailOpen] = useState(false);

  const fetchFromMongo = async () => {
    try {
      const res = await fetch('/api/contributions');
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        setContributions(data.data);
        localStorage.setItem('trekmap_contributions', JSON.stringify(data.data));
        setSelectedContribution((prev: any) => {
          if (!prev) return null;
          const found = data.data.find((x: any) => x.id === prev.id);
          return found || prev;
        });
      }
    } catch (err) {
      console.warn('⚠️ [MongoDB Admin Fetch Notice]: Using local cache.', err);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const token = localStorage.getItem('trekmap_token');
      const res = await fetch('/api/admin/users', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (data.success) setUsersList(data.data);
    } catch (e) {}
  };

  const fetchAdminTrails = async () => {
    try {
      const res = await fetch('/api/trails');
      const data = await res.json();
      if (data.success) setTrailsList(data.data);
    } catch (e) {}
  };

  const fetchAdminIncidents = async () => {
    try {
      const res = await fetch('/api/incidents');
      const data = await res.json();
      if (data.success) setIncidentsList(data.data);
    } catch (e) {}
  };

  const fetchAdminThreads = async () => {
    try {
      const res = await fetch('/api/forum');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const sorted = [...data.data].sort((a: any, b: any) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
        setThreadsList(sorted);
      }
    } catch (e) {}
  };

  const fetchAdminStats = async () => {
    try {
      const token = localStorage.getItem('trekmap_token');
      const res = await fetch('/api/admin/stats', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (data.success) setAdminStats(data.data);
    } catch (e) {}
  };

  const refreshAllData = async () => {
    setIsRefreshing(true);
    await Promise.allSettled([
      fetchFromMongo(),
      fetchAdminUsers(),
      fetchAdminTrails(),
      fetchAdminIncidents(),
      fetchAdminThreads(),
      fetchAdminStats(),
    ]);
    setTimeout(() => {
      setIsRefreshing(false);
      onShowToast?.('Đã đồng bộ dữ liệu toàn hệ thống với máy chủ!', 'success');
    }, 400);
  };

  useEffect(() => {
    fetchFromMongo();
    fetchAdminUsers();
    fetchAdminTrails();
    fetchAdminIncidents();
    fetchAdminThreads();
    fetchAdminStats();
  }, []);

  useEffect(() => {
    if (adminSection === 'users') fetchAdminUsers();
    if (adminSection === 'trails') fetchAdminTrails();
    if (adminSection === 'incidents') fetchAdminIncidents();
    if (adminSection === 'forum') fetchAdminThreads();
    if (adminSection === 'stats') fetchAdminStats();
  }, [adminSection]);

  const handleUpdateRole = async (userId: string, newRole: string, userName: string) => {
    try {
      const token = localStorage.getItem('trekmap_token');
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (data.success) {
        onShowToast?.(`Đã đổi vai trò của ${userName} thành "${newRole}"!`, 'success');
        fetchAdminUsers();
        fetchAdminStats();
      } else {
        onShowToast?.(data.message || 'Lỗi khi cập nhật vai trò', 'error');
      }
    } catch (e) {
      onShowToast?.('Lỗi kết nối máy chủ', 'error');
    }
  };

  const handlePinThread = async (threadId: string, _title?: string) => {
    try {
      const token = localStorage.getItem('trekmap_token');
      const res = await fetch(`/api/admin/threads/${threadId}/pin`, {
        method: 'PUT',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (data.success) {
        onShowToast?.(data.message, 'success');
        setThreadsList((prev) =>
          prev
            .map((t) => {
              if (t.id === threadId || t._id === threadId) {
                const newPinned = data.data?.isPinned !== undefined ? Boolean(data.data.isPinned) : !t.isPinned;
                return { ...t, isPinned: newPinned };
              }
              return t;
            })
            .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0))
        );
        fetchAdminThreads();
      }
    } catch (e) {}
  };

  const handleLockThread = async (threadId: string, _title?: string) => {
    try {
      const token = localStorage.getItem('trekmap_token');
      const res = await fetch(`/api/admin/threads/${threadId}/lock`, {
        method: 'PUT',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (data.success) {
        onShowToast?.(data.message, 'info');
        setThreadsList((prev) =>
          prev.map((t) => {
            if (t.id === threadId || t._id === threadId) {
              const newLocked = data.data?.isLocked !== undefined ? Boolean(data.data.isLocked) : !t.isLocked;
              return { ...t, isLocked: newLocked };
            }
            return t;
          })
        );
        fetchAdminThreads();
      }
    } catch (e) {}
  };

  const handleDeleteThread = async (threadId: string, title: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa bài viết "${title}"?`)) return;
    try {
      const token = localStorage.getItem('trekmap_token');
      const res = await fetch(`/api/admin/threads/${threadId}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (data.success) {
        onShowToast?.(data.message || 'Đã xóa bài viết!', 'info');
        setThreadsList((prev) => prev.filter((t) => t.id !== threadId && t._id !== threadId));
        fetchAdminThreads();
        fetchAdminStats();
      }
    } catch (e) {}
  };

  const handleResolveDispute = async (incidentId: string, action: 'dismiss_incident' | 'reject_dispute') => {
    try {
      const token = localStorage.getItem('trekmap_token');
      const res = await fetch(`/api/admin/incidents/${incidentId}/dispute-resolve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        onShowToast?.(data.message, 'success');
        fetchAdminIncidents();
        fetchAdminStats();
      }
    } catch (e) {}
  };

  const pendingContributions = contributions.filter((c) => c.status === 'pending' || !c.status);
  const approvedContributions = contributions.filter((c) => c.status === 'approved');

  const handleApprove = async (id: string, name: string) => {
    const token = localStorage.getItem('trekmap_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      const res = await fetch(`/api/contributions/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: 'approved', approvedAt: new Date().toLocaleDateString('vi-VN') }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi khi duyệt bài đóng góp');
      }

      const updated = contributions.map((c) => {
        if (c.id === id) {
          return { ...c, status: 'approved', approvedAt: new Date().toLocaleDateString('vi-VN') };
        }
        return c;
      });

      setContributions(updated);
      localStorage.setItem('trekmap_contributions', JSON.stringify(updated));

      if (onShowToast) {
        onShowToast(`Đã duyệt & công khai cung đường "${name}" vào bản đồ 3D thành công!`, 'success');
      }
      if (selectedContribution?.id === id) {
        setSelectedContribution(null);
      }
      fetchFromMongo();
      fetchAdminTrails();
      fetchAdminStats();
    } catch (e: any) {
      console.error(e);
      onShowToast?.(e.message || 'Không thể duyệt bài đóng góp, vui lòng thử lại.', 'error');
    }
  };

  const handleReject = async (id: string, name: string) => {
    const token = localStorage.getItem('trekmap_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      const res = await fetch(`/api/contributions/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: 'rejected', rejectedAt: new Date().toLocaleDateString('vi-VN') }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi khi từ chối bài đóng góp');
      }

      const updated = contributions.map((c) => {
        if (c.id === id) {
          return { ...c, status: 'rejected', rejectedAt: new Date().toLocaleDateString('vi-VN') };
        }
        return c;
      });

      setContributions(updated);
      localStorage.setItem('trekmap_contributions', JSON.stringify(updated));

      if (onShowToast) {
        onShowToast(`Đã từ chối bài đóng góp "${name}".`, 'info');
      }
      if (selectedContribution?.id === id) {
        setSelectedContribution(null);
      }
      fetchFromMongo();
      fetchAdminStats();
    } catch (e: any) {
      console.error(e);
      onShowToast?.(e.message || 'Không thể từ chối bài đóng góp.', 'error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa bài đóng góp "${name}" khỏi hệ thống MongoDB không?`)) {
      const token = localStorage.getItem('trekmap_token');
      const headers: Record<string, string> = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      try {
        const res = await fetch(`/api/contributions/${id}`, {
          method: 'DELETE',
          headers,
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Lỗi khi xóa bài đóng góp');
        }

        const updated = contributions.filter((c) => c.id !== id);
        setContributions(updated);
        localStorage.setItem('trekmap_contributions', JSON.stringify(updated));

        if (onShowToast) {
          onShowToast(`Đã xóa bài đóng góp "${name}" khỏi MongoDB!`, 'info');
        }
        if (selectedContribution?.id === id) {
          setSelectedContribution(null);
        }
        fetchFromMongo();
        fetchAdminStats();
      } catch (e: any) {
        console.error(e);
        onShowToast?.(e.message || 'Không thể xóa bài đóng góp.', 'error');
      }
    }
  };

  const handleDeleteTrail = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa cung đường "${name}" không?`)) return;
    try {
      const token = localStorage.getItem('trekmap_token');
      const res = await fetch(`/api/admin/trails/${id}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (data.success) {
        if (onShowToast) onShowToast(`Đã xóa cung đường "${name}"!`, 'info');
        fetchAdminTrails();
        fetchAdminStats();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolveIncident = async (id: string) => {
    try {
      const token = localStorage.getItem('trekmap_token');
      const res = await fetch(`/api/incidents/${id}/resolve`, {
        method: 'PUT',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (data.success) {
        if (onShowToast) onShowToast('Đã đánh dấu xử lý xong sự cố (Đã gỡ cảnh báo)!', 'success');
        fetchAdminIncidents();
        fetchAdminStats();
      }
    } catch (e) {}
  };

  const handleDeleteIncident = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa báo cáo sự cố này?')) return;
    try {
      const token = localStorage.getItem('trekmap_token');
      const res = await fetch(`/api/incidents/${id}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (data.success) {
        if (onShowToast) onShowToast('Đã xóa sự cố khỏi hệ thống!', 'info');
        fetchAdminIncidents();
        fetchAdminStats();
      }
    } catch (e) {}
  };

  const handleBanUser = async (id: string, email: string) => {
    if (!window.confirm(`Khóa tài khoản ${email}?`)) return;
    try {
      const token = localStorage.getItem('trekmap_token');
      const res = await fetch(`/api/admin/users/${id}/ban`, {
        method: 'PUT',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (data.success) {
        if (onShowToast) onShowToast(`Đã khóa tài khoản ${email}`, 'info');
        setUsersList((prev) => prev.map((u) => ((u._id === id || u.id === id) ? { ...u, isBanned: true } : u)));
        fetchAdminUsers();
        fetchAdminStats();
      }
    } catch (e) {}
  };

  const handleUnbanUser = async (id: string, email: string) => {
    try {
      const token = localStorage.getItem('trekmap_token');
      const res = await fetch(`/api/admin/users/${id}/unban`, {
        method: 'PUT',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (data.success) {
        if (onShowToast) onShowToast(`Đã mở khóa tài khoản ${email}`, 'success');
        setUsersList((prev) => prev.map((u) => ((u._id === id || u.id === id) ? { ...u, isBanned: false } : u)));
        fetchAdminUsers();
        fetchAdminStats();
      }
    } catch (e) {}
  };

  // Nav Items definition with badges
  const pendingDisputesCount = incidentsList.filter((i) => i.disputes && i.disputes.length > 0).length;
  const navItems = [
    {
      id: 'contributions' as const,
      label: 'Duyệt Đóng Góp',
      icon: Inbox,
      badge: pendingContributions.length,
      badgeColor: '#f59e0b',
      badgeTextColor: '#041217',
    },
    {
      id: 'trails' as const,
      label: 'Kho Cung Đường',
      icon: Layers,
      badge: trailsList.length || 14,
      badgeColor: 'var(--color-sky)',
      badgeTextColor: '#041217',
    },
    {
      id: 'incidents' as const,
      label: 'Quản Lý Sự Cố',
      icon: AlertTriangle,
      badge: incidentsList.length || 4,
      badgeColor: '#ef4444',
      badgeTextColor: '#fff',
      urgent: pendingDisputesCount > 0,
      urgentText: `${pendingDisputesCount} Khiếu nại`,
    },
    {
      id: 'users' as const,
      label: 'Người Dùng & Quyền',
      icon: Users,
      badge: usersList.length || 1,
      badgeColor: 'var(--color-primary)',
      badgeTextColor: '#041217',
    },
    {
      id: 'forum' as const,
      label: 'Kiểm Duyệt Diễn Đàn',
      icon: MessageSquare,
      badge: threadsList.length || 12,
      badgeColor: '#a855f7',
      badgeTextColor: '#fff',
    },
    {
      id: 'stats' as const,
      label: 'Thống Kê Tổng Quan',
      icon: BarChart3,
    },
  ];

  const sectionTitles: Record<typeof adminSection, { title: string; subtitle: string }> = {
    contributions: {
      title: 'Duyệt & Quản Lý Đóng Góp Cung Đường',
      subtitle: 'Xem chi tiết các bài đóng góp từ cộng đồng, kiểm tra thông tin địa lý và phê duyệt lên bản đồ 3D',
    },
    trails: {
      title: 'Quản Lý Danh Mục Cung Đường Trekking',
      subtitle: 'Theo dõi, chỉnh sửa trực tiếp thông số và quản lý kho dữ liệu cung đường thực địa Việt Nam',
    },
    incidents: {
      title: 'Trung Tâm Quản Lý Sự Cố & Cứu Hộ',
      subtitle: 'Kiểm duyệt báo cáo sự cố sạt lở, mất dấu từ cộng đồng và giải quyết khiếu nại thông tin giả',
    },
    users: {
      title: 'Quản Trị Thành Viên & Phân Quyền Vai Trò',
      subtitle: 'Quản lý tài khoản, cấp quyền Hướng dẫn viên (Guide), Điều hành viên (Mod) hoặc xử lý vi phạm',
    },
    forum: {
      title: 'Kiểm Duyệt & Điều Hành Diễn Đàn',
      subtitle: 'Ghim bài thông báo quan trọng, khóa bình luận hoặc gỡ bài viết vi phạm chuẩn mực cộng đồng',
    },
    stats: {
      title: 'Báo Cáo Thống Kê & Phân Tích Hệ Thống',
      subtitle: 'Báo cáo tổng hợp số liệu dữ liệu thực tế lưu trữ trên MongoDB Atlas và hoạt động thời gian thực',
    },
  };

  return (
    <div className="admin-layout">
      {/* 1. COMMAND SIDEBAR */}
      <aside className="admin-sidebar">
        {/* Brand & Status Beacon */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', boxShadow: '0 0 10px var(--color-primary)', display: 'inline-block' }} />
              TREKOPS v2.4
            </div>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(56, 189, 248, 0.12)', color: 'var(--color-sky)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              REALTIME
            </span>
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-text-main)', margin: '0 0 2px 0' }}>
            Trung Tâm Chỉ Huy
          </h2>
          <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', margin: 0 }}>
            Ban Quản Trị Hệ Thống TrekMap
          </p>
        </div>

        {/* Administrator Profile Card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, background: 'var(--color-bg-main)', border: '1px solid var(--color-border)' }}>
          <img
            src={currentUser?.avatarUrl || currentUser?.avatar || 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329093/trekmap/avatars/avatar_user_1.jpg'}
            alt="Admin Avatar"
            style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--color-primary)' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.fullName || currentUser?.name || currentUser?.email || 'Hoàng Trekker'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-sky)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={11} color="var(--color-sky)" />
              <span>{currentUser?.role === 'admin' ? 'Quản Trị Viên Cấp Cao' : 'BQT • Verified Guide'}</span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {navItems.map((item) => {
            const isActive = adminSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setAdminSection(item.id)}
                className={`admin-nav-item ${isActive ? 'active' : ''}`}
                style={{ width: '100%', border: 'none', textAlign: 'left' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <item.icon size={16} />
                  <span>{item.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {item.urgent && (
                    <span style={{
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 6,
                      boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
                    }}>
                      {item.urgentText}
                    </span>
                  )}
                  {item.badge !== undefined && (
                    <span style={{
                      background: item.badgeColor || 'var(--color-primary)',
                      color: item.badgeTextColor || '#041217',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: 8,
                      minWidth: 18,
                      textAlign: 'center',
                    }}>
                      {item.badge}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Infrastructure Status Widget & Back Link */}
        <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            HẠ TẦNG HỆ THỐNG
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Database size={13} color="var(--color-primary)" /> MongoDB Atlas
            </span>
            <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>Trực Tuyến</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Radio size={13} color="var(--color-sky)" /> Đài Vô Tuyến
            </span>
            <span style={{ color: 'var(--color-sky)', fontWeight: 700 }}>144.5 MHz</span>
          </div>

          <button
            className="btn btn-outline"
            onClick={onBack}
            style={{ width: '100%', justifyContent: 'center', gap: 8, marginTop: 6, fontSize: '0.82rem', padding: '8px 12px' }}
          >
            <ArrowLeft size={14} /> Về Trang Chủ Bản Đồ
          </button>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE CONTENT */}
      <main className="admin-content">
        {/* Top Operations Header Bar */}
        <header className="admin-top-bar">
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>BQT TREKMAP</span>
              <span>/</span>
              <span>CHỈ HUY</span>
              <span>/</span>
              <span>{navItems.find((n) => n.id === adminSection)?.label}</span>
            </div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--color-text-main)', margin: 0 }}>
              {sectionTitles[adminSection].title}
            </h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
              {sectionTitles[adminSection].subtitle}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="btn btn-outline"
              onClick={refreshAllData}
              disabled={isRefreshing}
              style={{ fontSize: '0.8rem', padding: '7px 12px', gap: 6 }}
              title="Đồng bộ dữ liệu thời gian thực từ MongoDB"
            >
              <RefreshCw size={13} className={isRefreshing ? 'spin-animation' : ''} />
              <span>{isRefreshing ? 'Đang tải...' : 'Làm Mới Dữ Liệu'}</span>
            </button>

            {adminSection === 'trails' && (
              <button
                className="btn btn-primary"
                onClick={() => setIsCreateTrailOpen(true)}
                style={{ fontSize: '0.8rem', padding: '7px 14px', gap: 6 }}
              >
                + Thêm Cung Đường Mới
              </button>
            )}

            {adminSection === 'contributions' && (
              <button
                className="btn btn-outline"
                onClick={() => { window.location.hash = '#contribute'; }}
                style={{ fontSize: '0.8rem', padding: '7px 12px', gap: 6, color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
              >
                + Mở Trình Đóng Góp
              </button>
            )}
          </div>
        </header>

        {/* Admin Sections Sliding Container */}
        <div key={adminSection} className="tab-content-slide">
          {/* =========================================================================
           * SECTION 1: DUYỆT ĐÓNG GÓP (CONTRIBUTIONS)
           * ========================================================================= */}
          {adminSection === 'contributions' && (
            <>
            {/* 4 Sleek KPI Metric Cockpit Cards */}
            <div className="admin-kpi-grid">
              <div className="admin-kpi-card" style={{ borderLeft: '3px solid #f59e0b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>Chờ BQT Duyệt</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f59e0b', marginTop: 4, lineHeight: 1.1 }}>
                      {pendingContributions.length} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>bài</span>
                    </div>
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245, 158, 11, 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                    <Clock size={20} />
                  </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
                  <span>Cần xác thực dữ liệu thực địa</span>
                </div>
              </div>

              <div className="admin-kpi-card" style={{ borderLeft: '3px solid #10b981' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>Đã Duyệt & Công Khai</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981', marginTop: 4, lineHeight: 1.1 }}>
                      {approvedContributions.length} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>bài</span>
                    </div>
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(16, 185, 129, 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                    <CheckCircle2 size={20} />
                  </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                  <span>Đã đồng bộ lên bản đồ 3D</span>
                </div>
              </div>

              <div className="admin-kpi-card" style={{ borderLeft: '3px solid var(--color-sky)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>Tổng Số Đóng Góp</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--color-sky)', marginTop: 4, lineHeight: 1.1 }}>
                      {contributions.length} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>bài</span>
                    </div>
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(56, 189, 248, 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-sky)' }}>
                    <Layers size={20} />
                  </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-sky)' }} />
                  <span>Kho dữ liệu mở từ cộng đồng</span>
                </div>
              </div>

              <div className="admin-kpi-card" style={{ borderLeft: '3px solid #a855f7' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>Độ Tin Cậy Thực Địa</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#a855f7', marginTop: 4, lineHeight: 1.1 }}>
                      100% <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>GPS VN</span>
                    </div>
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(168, 85, 247, 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}>
                    <Compass size={20} />
                  </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7' }} />
                  <span>Tuân thủ quy chuẩn Rule 11</span>
                </div>
              </div>
            </div>

            {/* Modern Toolbar: Segmented Switch + Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div className="admin-segmented-control">
                <button
                  type="button"
                  className={`admin-segmented-btn ${activeTab === 'pending' ? 'active' : ''}`}
                  onClick={() => setActiveTab('pending')}
                >
                  <Clock size={14} />
                  <span>Chờ duyệt</span>
                  <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 8, background: activeTab === 'pending' ? 'rgba(245, 158, 11, 0.2)' : 'transparent', color: '#f59e0b', fontWeight: 800 }}>
                    {pendingContributions.length}
                  </span>
                </button>
                <button
                  type="button"
                  className={`admin-segmented-btn ${activeTab === 'approved' ? 'active' : ''}`}
                  onClick={() => setActiveTab('approved')}
                >
                  <CheckCircle2 size={14} />
                  <span>Đã công khai</span>
                  <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 8, background: activeTab === 'approved' ? 'rgba(16, 185, 129, 0.2)' : 'transparent', color: '#10b981', fontWeight: 800 }}>
                    {approvedContributions.length}
                  </span>
                </button>
                <button
                  type="button"
                  className={`admin-segmented-btn ${activeTab === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  <Layers size={14} />
                  <span>Tất cả đóng góp</span>
                  <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 8, background: activeTab === 'all' ? 'rgba(56, 189, 248, 0.2)' : 'transparent', color: 'var(--color-sky)', fontWeight: 800 }}>
                    {contributions.length}
                  </span>
                </button>
              </div>

              {/* Search Box */}
              <div className="admin-search-wrapper">
                <Search size={16} color="var(--color-text-dim)" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên cung đường, tác giả, tỉnh thành..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--color-text-main)',
                    fontSize: '0.82rem',
                    width: '100%',
                    outline: 'none',
                    padding: 0,
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ background: 'none', border: 'none', color: 'var(--color-text-dim)', cursor: 'pointer', display: 'flex', padding: 2 }}
                    title="Xóa tìm kiếm"
                  >
                    <IconX size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Filtered Contributions Content */}
            <div key={`${activeTab}-${searchQuery}`} className="tab-content-slide">
              {(() => {
                const rawList = activeTab === 'pending'
                ? pendingContributions
                : activeTab === 'approved'
                ? approvedContributions
                : contributions;

              const listToDisplay = rawList.filter((c) => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                  (c.name && c.name.toLowerCase().includes(q)) ||
                  (c.authorName && c.authorName.toLowerCase().includes(q)) ||
                  (c.authorEmail && c.authorEmail.toLowerCase().includes(q)) ||
                  (c.province && c.province.toLowerCase().includes(q))
                );
              });

              if (listToDisplay.length === 0) {
                return (
                  <div className="admin-empty-state">
                    <EmptyStateIllustration />
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-text-main)', margin: '0 0 6px 0' }}>
                      {searchQuery ? 'Không Tìm Thấy Kết Quả Phù Hợp' : activeTab === 'pending' ? 'Hộp Thư Kiểm Duyệt Sạch Sẽ!' : 'Không Có Bài Đóng Góp Nào'}
                    </h3>
                    <p style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', maxWidth: 460, margin: '0 0 20px 0', lineHeight: 1.5 }}>
                      {searchQuery
                        ? `Không có bài đóng góp nào khớp với từ khóa "${searchQuery}". Vui lòng thử lại với tên khác.`
                        : activeTab === 'pending'
                        ? 'Tuyệt vời! Toàn bộ bài đóng góp cung đường gửi về từ cộng đồng đã được kiểm tra và xử lý xong. Dữ liệu bản đồ đang ở trạng thái chuẩn xác nhất.'
                        : 'Chưa có dữ liệu bài đóng góp trong danh mục này.'}
                    </p>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {activeTab === 'pending' && (
                        <button
                          className="btn btn-primary"
                          onClick={() => setActiveTab('approved')}
                          style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                        >
                          Xem Các Cung Đường Đã Công Khai ({approvedContributions.length})
                        </button>
                      )}
                      <button
                        className="btn btn-outline"
                        onClick={() => { window.location.hash = '#contribute'; }}
                        style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                      >
                        Thêm Cung Đường Mới
                      </button>
                      <button
                        className="btn btn-outline"
                        onClick={refreshAllData}
                        style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                      >
                        Làm Mới Danh Sách
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
                  {listToDisplay.map((contrib) => (
                    <article key={contrib.id} className="admin-item-card">
                      {/* Image Banner */}
                      <div style={{ height: 180, position: 'relative', overflow: 'hidden', background: '#0b1319' }}>
                        <img
                          src={contrib.coverImage || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80'}
                          alt={contrib.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {/* Status Floating Pill */}
                        <div style={{ position: 'absolute', top: 12, right: 12 }}>
                          <span style={{
                            background: contrib.status === 'approved' ? 'rgba(16, 185, 129, 0.95)' : contrib.status === 'rejected' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(245, 158, 11, 0.95)',
                            color: '#fff',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '4px 10px',
                            borderRadius: 8,
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          }}>
                            {contrib.status === 'approved' ? '✓ Đã Công Khai' : contrib.status === 'rejected' ? '✕ Đã Từ Chối' : '⏳ Chờ BQT Duyệt'}
                          </span>
                        </div>

                        {/* Region Tag at Bottom-Left */}
                        <div style={{ position: 'absolute', bottom: 10, left: 12 }}>
                          <span style={{
                            background: 'rgba(7, 13, 30, 0.88)',
                            color: 'var(--color-sky)',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 6,
                            backdropFilter: 'blur(6px)',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                          }}>
                            {contrib.region || 'Việt Nam'}
                          </span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '0 0 6px 0', lineHeight: 1.3 }}>
                            {contrib.name || 'Cung đường Trekking mới'}
                          </h4>

                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 14 }}>
                            {contrib.hamlet ? contrib.hamlet + ', ' : ''}{contrib.district}, {contrib.province}
                          </div>

                          {/* Technical Metrics Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                            <div style={{ background: 'var(--color-bg-main)', padding: '8px', borderRadius: 8, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Cự ly</div>
                              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-primary)' }}>{contrib.distanceKm} km</div>
                            </div>
                            <div style={{ background: 'var(--color-bg-main)', padding: '8px', borderRadius: 8, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Độ dốc nâng</div>
                              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-sky)' }}>+{contrib.elevationGainM}m</div>
                            </div>
                            <div style={{ background: 'var(--color-bg-main)', padding: '8px', borderRadius: 8, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Thời lượng</div>
                              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-main)' }}>{contrib.durationHoursNote || '1 ngày'}</div>
                            </div>
                          </div>

                          {/* Author & Timestamp Info */}
                          <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />
                            <span>Người gửi: <strong style={{ color: 'var(--color-text-main)' }}>{contrib.authorName || contrib.authorEmail || 'Trekker Cộng Đồng'}</strong> ({contrib.createdAt || 'Mới cập nhật'})</span>
                          </div>
                        </div>

                        {/* Actions Row */}
                        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-outline"
                            onClick={() => setSelectedContribution(contrib)}
                            style={{ flex: 1, padding: '7px 12px', fontSize: '0.8rem', justifyContent: 'center', gap: 6 }}
                          >
                            <Eye size={14} /> Chi tiết
                          </button>

                          {contrib.status !== 'approved' && (
                            <button
                              className="btn btn-primary"
                              onClick={() => handleApprove(contrib.id, contrib.name)}
                              style={{ flex: 1.2, padding: '7px 12px', fontSize: '0.8rem', justifyContent: 'center', background: '#10b981', borderColor: '#10b981', gap: 6 }}
                            >
                              <CheckCircle2 size={14} /> Phê Duyệt
                            </button>
                          )}

                          {contrib.status === 'pending' && (
                            <button
                              className="btn btn-outline"
                              onClick={() => handleReject(contrib.id, contrib.name)}
                              style={{ padding: '7px 10px', fontSize: '0.8rem', justifyContent: 'center', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                              title="Từ chối bài đóng góp"
                            >
                              <XCircle size={14} />
                            </button>
                          )}

                          <button
                            className="btn btn-outline"
                            onClick={() => handleDelete(contrib.id, contrib.name)}
                            style={{ padding: '7px 10px', fontSize: '0.8rem', justifyContent: 'center', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                            title="Xóa vĩnh viễn khỏi MongoDB"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              );
            })()}
            </div>
          </>
        )}

        {/* =========================================================================
         * SECTION 2: QUẢN LÝ CUNG ĐƯỜNG (TRAILS)
         * ========================================================================= */}
        {adminSection === 'trails' && (
          <div className="card" style={{ padding: 24, borderRadius: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Layers size={20} color="var(--color-primary)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>
                  Kho Cung Đường Trekking Việt Nam ({trailsList.length})
                </h3>
              </div>

              <div className="admin-search-wrapper" style={{ maxWidth: 320 }}>
                <Search size={15} color="var(--color-text-dim)" />
                <input
                  type="text"
                  placeholder="Lọc cung đường..."
                  value={trailSearchQuery}
                  onChange={(e) => setTrailSearchQuery(e.target.value)}
                  style={{ border: 'none', background: 'transparent', color: 'var(--color-text-main)', fontSize: '0.82rem', width: '100%', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {trailsList
                .filter((t) => !trailSearchQuery || t.name.toLowerCase().includes(trailSearchQuery.toLowerCase()) || t.province.toLowerCase().includes(trailSearchQuery.toLowerCase()))
                .map((trail) => (
                  <div
                    key={trail._id || trail.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border)',
                      padding: '14px 18px',
                      borderRadius: 14,
                      flexWrap: 'wrap',
                      gap: 14,
                      transition: 'border-color 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <img
                        src={trail.coverImage || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=200&q=80'}
                        alt={trail.name}
                        style={{ width: 64, height: 52, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--color-border)' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{trail.name}</span>
                          <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: 6, background: 'rgba(56, 189, 248, 0.12)', color: 'var(--color-sky)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                            {trail.region}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
                          {trail.province} • Cự ly: <strong style={{ color: 'var(--color-primary)' }}>{trail.distanceKm} km</strong> • Cao độ: <strong>+{trail.elevationGainM}m</strong> • Đánh giá: <strong>★ {trail.rating || 5.0}</strong> ({trail.reviewCount || 0} lượt)
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-outline"
                        onClick={() => setEditingTrailModal(trail)}
                        style={{ color: 'var(--color-primary)', borderColor: 'var(--color-border)', padding: '6px 14px', fontSize: '0.8rem' }}
                      >
                        Sửa
                      </button>
                      <button
                        className="btn btn-outline"
                        onClick={() => handleDeleteTrail(trail._id || trail.id, trail.name)}
                        style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)', padding: '6px 14px', fontSize: '0.8rem' }}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* =========================================================================
         * SECTION 3: QUẢN LÝ SỰ CỐ & CỨU HỘ (INCIDENTS)
         * ========================================================================= */}
        {adminSection === 'incidents' && (
          <div className="card" style={{ padding: 24, borderRadius: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={20} color="#ef4444" />
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>
                    Sự Cố Khẩn Cấp & Cảnh Báo Thực Địa ({incidentsList.length})
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                    Kiểm duyệt tin báo sạt lở, lũ quét, đi lạc và xử lý các khiếu nại báo động giả
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {incidentsList.map((inc) => (
                <div
                  key={inc._id || inc.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'var(--color-bg-main)',
                    border: `1.5px solid ${inc.severity === 'critical' || inc.severity === 'high' ? 'rgba(239, 68, 68, 0.45)' : 'var(--color-border)'}`,
                    padding: '16px 20px',
                    borderRadius: 14,
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{
                          background: inc.severity === 'critical' ? '#ef4444' : inc.severity === 'high' ? '#f59e0b' : '#38bdf8',
                          color: '#fff',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 6,
                        }}>
                          {inc.severity?.toUpperCase() || 'HIGH'}
                        </span>
                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                          {inc.trailName || inc.type}
                        </span>
                        {inc.resolved ? (
                          <span style={{ color: '#10b981', fontSize: '0.74rem', fontWeight: 700, background: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            ✓ Đã an toàn (Đã gỡ cảnh báo)
                          </span>
                        ) : (
                          <span style={{ color: '#ef4444', fontSize: '0.74rem', fontWeight: 700, background: 'rgba(239, 68, 68, 0.12)', padding: '2px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            ⚠ Đang phát sóng khẩn cấp
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.86rem', color: 'var(--color-text-main)', margin: 0, lineHeight: 1.5 }}>
                        {inc.description}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {!inc.resolved && (
                        <button
                          className="btn btn-primary"
                          onClick={() => handleResolveIncident(inc._id || inc.id)}
                          style={{ background: '#10b981', borderColor: '#10b981', padding: '6px 14px', fontSize: '0.8rem', fontWeight: 700 }}
                        >
                          Xử Lý Xong (Gỡ Cảnh Báo)
                        </button>
                      )}

                      {inc.reportedBy && (
                        <button
                          className="btn btn-outline"
                          onClick={() => handleBanUser(inc.reportedBy, inc.reporterEmail || inc.reporterName || 'Tài khoản')}
                          title="Khóa tài khoản này nếu phát hiện báo động giả / spam"
                          style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)', padding: '6px 12px', fontSize: '0.78rem' }}
                        >
                          Khóa Nick (Báo Giả)
                        </button>
                      )}

                      <button
                        className="btn btn-outline"
                        onClick={() => handleDeleteIncident(inc._id || inc.id)}
                        style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)', padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>

                  {/* Reporter & Verification Strip */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--color-bg-card)', borderRadius: 10, border: '1px solid var(--color-border)', flexWrap: 'wrap', fontSize: '0.76rem' }}>
                    <span style={{ color: 'var(--color-text-main)', fontWeight: 700 }}>
                      Người phát: <strong style={{ color: 'var(--color-primary)' }}>{inc.reporterName || inc.userName || 'Trekker Thực Địa'}</strong>
                    </span>
                    {inc.reporterEmail && <span style={{ color: 'var(--color-text-muted)' }}>• {inc.reporterEmail}</span>}
                    <span style={{ color: 'var(--color-text-dim)' }}>• Thời gian: {inc.reportedAt || 'Gần đây'}</span>
                    {inc.locationNote && <span style={{ color: 'var(--color-sky)', fontWeight: 600 }}>• Vị trí: {inc.locationNote}</span>}
                    {inc.confirmations && inc.confirmations > 1 && (
                      <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>
                        ✓ {inc.confirmations} Trekker cùng xác thực
                      </span>
                    )}
                  </div>

                  {/* Disputes Callout Box */}
                  {inc.disputes && inc.disputes.length > 0 && (
                    <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.12)', border: '1.5px solid rgba(239, 68, 68, 0.4)', borderRadius: 10, fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, color: '#ef4444', marginBottom: 6 }}>
                        <AlertTriangle size={15} />
                        <span>KHIẾU NẠI TỪ CỘNG ĐỒNG: CÓ {inc.disputes.length} TREKKER BÁO CÁO TIN GIẢ / SAI SỰ THẬT</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {inc.disputes.map((d: any, idx: number) => (
                          <div key={idx} style={{ background: 'var(--color-bg-card)', padding: '6px 10px', borderRadius: 6, color: 'var(--color-text-main)' }}>
                            • <strong>{d.userName || 'Trekker'}</strong> ({d.disputedAt}): <em>"{d.reason}"</em>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleResolveDispute(inc._id || inc.id, 'dismiss_incident')}
                          style={{ background: '#10b981', borderColor: '#10b981', padding: '6px 14px', fontSize: '0.78rem', fontWeight: 700 }}
                        >
                          ✓ Chấp nhận khiếu nại (Gỡ cảnh báo ảo)
                        </button>
                        <button
                          className="btn btn-outline"
                          onClick={() => handleResolveDispute(inc._id || inc.id, 'reject_dispute')}
                          style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)', padding: '6px 14px', fontSize: '0.78rem' }}
                        >
                          ✕ Bác bỏ khiếu nại (Nguy hiểm thật)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
         * SECTION 4: QUẢN LÝ NGƯỜI DÙNG & PHÂN QUYỀN (USERS)
         * ========================================================================= */}
        {adminSection === 'users' && (
          <div className="card" style={{ padding: 24, borderRadius: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Users size={20} color="var(--color-primary)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>
                  Danh Sách Thành Viên & Phân Quyền Vai Trò ({usersList.length})
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {usersList.map((u) => (
                <div
                  key={u._id || u.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    padding: '14px 18px',
                    borderRadius: 14,
                    flexWrap: 'wrap',
                    gap: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <img
                      src={u.avatarUrl || 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329093/trekmap/avatars/avatar_user_1.jpg'}
                      alt={u.fullName}
                      style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{u.fullName || u.username}</span>
                        {u.role === 'admin' && <span style={{ background: '#f59e0b', color: '#fff', fontSize: '0.68rem', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>ADMIN</span>}
                        {u.role === 'guide' && <span style={{ background: '#10b981', color: '#fff', fontSize: '0.68rem', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>✓ GUIDE</span>}
                        {u.role === 'moderator' && <span style={{ background: '#38bdf8', color: '#fff', fontSize: '0.68rem', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>MODERATOR</span>}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {u.email} • Uy tín: <strong style={{ color: '#10b981' }}>{u.reputationScore || 50} pts</strong> • Huy hiệu: {u.badges?.join(', ') || 'Trekker Mới'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Phân quyền:</span>
                      <select
                        value={u.role || 'user'}
                        onChange={(e) => handleUpdateRole(u._id || u.id, e.target.value, u.fullName || u.email)}
                        disabled={u.email === currentUser?.email}
                        style={{
                          background: 'var(--color-bg-card)',
                          color: 'var(--color-text-main)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        <option value="user">Trekker (Thành viên)</option>
                        <option value="guide">Verified Guide (Hướng dẫn viên)</option>
                        <option value="moderator">Kiểm duyệt viên (Mod)</option>
                        <option value="admin">Quản trị viên (Admin)</option>
                      </select>
                    </div>

                    {u.isBanned ? (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleUnbanUser(u._id || u.id, u.email)}
                        style={{ background: '#10b981', borderColor: '#10b981', padding: '6px 14px', fontSize: '0.8rem' }}
                      >
                        Mở Khóa
                      </button>
                    ) : u.role !== 'admin' ? (
                      <button
                        className="btn btn-outline"
                        onClick={() => handleBanUser(u._id || u.id, u.email)}
                        style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)', padding: '6px 14px', fontSize: '0.8rem' }}
                      >
                        Khóa Nick
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Quản trị viên</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
         * SECTION 5: KIỂM DUYỆT DIỄN ĐÀN (FORUM)
         * ========================================================================= */}
        {adminSection === 'forum' && (
          <div className="card" style={{ padding: 24, borderRadius: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MessageSquare size={20} color="var(--color-primary)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>
                  Kiểm Duyệt Diễn Đàn Thám Hiểm ({threadsList.length} bài viết)
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {threadsList.map((t) => (
                <div
                  key={t.id || t._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: t.isPinned ? 'rgba(245, 158, 11, 0.06)' : 'var(--color-bg-main)',
                    border: `1.5px solid ${t.isPinned ? 'rgba(245, 158, 11, 0.6)' : 'var(--color-border)'}`,
                    boxShadow: t.isPinned ? '0 0 16px rgba(245, 158, 11, 0.15)' : 'none',
                    padding: '14px 18px',
                    borderRadius: 14,
                    flexWrap: 'wrap',
                    gap: 12,
                    transition: 'all 0.25s ease',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      {t.isPinned && (
                        <span style={{
                          background: '#f59e0b',
                          color: '#041108',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)',
                        }}>
                          <IconPin size={12} color="#041108" /> ĐÃ GHIM LÊN ĐẦU
                        </span>
                      )}
                      {t.isLocked && (
                        <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <IconLock size={11} color="#fff" /> ĐÃ KHÓA
                        </span>
                      )}
                      <span style={{ background: 'var(--color-bg-card)', color: 'var(--color-sky)', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                        {t.category || 'Thảo luận'}
                      </span>
                      <span style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                        {t.title}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span>Tác giả: <strong style={{ color: 'var(--color-text-main)' }}>{t.authorName}</strong></span>
                      <span>• {t.repliesCount || 0} bình luận</span>
                      <span>• {t.upvotes || 0} lượt thích</span>
                      <span>• {t.createdAt ? new Date(t.createdAt).toLocaleDateString('vi-VN') : 'Gần đây'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className={`btn ${t.isPinned ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => handlePinThread(t.id || t._id, t.title)}
                      style={{
                        padding: '6px 14px',
                        fontSize: '0.78rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        ...(t.isPinned ? { background: '#f59e0b', borderColor: '#f59e0b', color: '#041108', fontWeight: 800 } : {}),
                      }}
                    >
                      <IconPin size={12} color={t.isPinned ? '#041108' : 'currentColor'} />
                      <span>{t.isPinned ? 'Bỏ Ghim' : 'Ghim Bài'}</span>
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => handleLockThread(t.id || t._id, t.title)}
                      style={{
                        padding: '6px 14px',
                        fontSize: '0.78rem',
                        color: t.isLocked ? '#10b981' : '#f59e0b',
                        borderColor: t.isLocked ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {t.isLocked ? 'Mở Khóa' : <><IconLock size={12} color="#f59e0b" /> Khóa</>}
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => handleDeleteThread(t.id || t._id, t.title)}
                      style={{ padding: '6px 14px', fontSize: '0.78rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <IconTrash size={12} color="#ef4444" /> Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
         * SECTION 6: THỐNG KÊ TỔNG QUAN (STATS)
         * ========================================================================= */}
        {adminSection === 'stats' && (
          <div className="card" style={{ padding: 24, borderRadius: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <BarChart3 size={20} color="var(--color-primary)" />
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>
                  Thống Kê Dữ Liệu Thực Địa & Hệ Thống
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                  Tổng hợp số liệu thời gian thực được đồng bộ trên MongoDB Atlas
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 18, borderRadius: 14 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>Tổng Thành Viên</div>
                <div style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--color-primary)', marginTop: 4 }}>
                  {adminStats?.totalUsers || usersList.length || 1}
                </div>
              </div>
              <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 18, borderRadius: 14 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>Cung Đường Công Khai</div>
                <div style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--color-sky)', marginTop: 4 }}>
                  {adminStats?.totalTrails || trailsList.length || 14}
                </div>
              </div>
              <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 18, borderRadius: 14 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>Tổng Bài Đóng Góp</div>
                <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#10b981', marginTop: 4 }}>
                  {adminStats?.totalContributions || contributions.length}
                </div>
              </div>
              <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 18, borderRadius: 14 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>Bài Chờ Kiểm Duyệt</div>
                <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>
                  {adminStats?.pendingContributions || pendingContributions.length}
                </div>
              </div>
              <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 18, borderRadius: 14 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>Sự Cố Khẩn Cấp</div>
                <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#ef4444', marginTop: 4 }}>
                  {adminStats?.totalIncidents || incidentsList.length || 4}
                </div>
              </div>
              <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 18, borderRadius: 14 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>Chủ Đề Diễn Đàn</div>
                <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#a855f7', marginTop: 4 }}>
                  {adminStats?.totalThreads || threadsList.length || 12}
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </main>

      {/* =========================================================================
       * COMPREHENSIVE ADMIN DETAIL INSPECTION MODAL
       * ========================================================================= */}
      {selectedContribution && (
        <div className="modal-overlay" onClick={() => setSelectedContribution(null)} style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 1000 }}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 780,
              width: '95%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              borderRadius: 20,
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-3d)',
            }}
          >
            {/* Modal Header Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, borderBottom: '1px solid var(--color-border)', paddingBottom: 14 }}>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Hồ sơ đóng góp cung đường #<code>{selectedContribution.id}</code>
                </span>
                <h3 style={{ fontSize: '1.35rem', color: 'var(--color-text-main)', fontWeight: 800, margin: '4px 0 0 0' }}>
                  {selectedContribution.name || 'Cung đường Trekking mới'}
                </h3>
              </div>
              <span style={{
                background: selectedContribution.status === 'approved' ? 'rgba(16, 185, 129, 0.95)' : selectedContribution.status === 'rejected' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(245, 158, 11, 0.95)',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '5px 12px',
                borderRadius: 8,
              }}>
                {selectedContribution.status === 'approved' ? 'Đã Duyệt & Công Khai' : selectedContribution.status === 'rejected' ? 'Đã Từ Chối' : 'Chờ BQT Duyệt (+20 PTS)'}
              </span>
            </div>

            {/* Cover Image Banner */}
            {selectedContribution.coverImage && (
              <div style={{ height: 240, borderRadius: 14, overflow: 'hidden', marginBottom: 20, border: '1px solid var(--color-border)', background: '#0b1319', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={selectedContribution.coverImage}
                  alt={selectedContribution.name}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80';
                  }}
                />
              </div>
            )}

            {/* SECTION 1: Địa Lý & Hành Chính */}
            <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 16, borderRadius: 14, marginBottom: 16 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 10 }}>
                1. ĐỊA ĐIỂM HÀNH CHÍNH & VÙNG MIỀN
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: '0.82rem', color: 'var(--color-text-main)' }}>
                <div>• <strong>Vùng miền:</strong> {selectedContribution.region || 'Chưa cập nhật'}</div>
                <div>• <strong>Tỉnh / Thành:</strong> {selectedContribution.province || 'Chưa cập nhật'}</div>
                <div>• <strong>Quận / Huyện:</strong> {selectedContribution.district || 'Chưa cập nhật'}</div>
                <div>• <strong>Thôn / Phường / Trạm:</strong> {selectedContribution.hamlet || 'Chưa nhập'}</div>
              </div>
            </div>

            {/* SECTION 2: Thông Số Kỹ Thuật */}
            <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 16, borderRadius: 14, marginBottom: 16 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 10 }}>
                2. THÔNG SỐ KỸ THUẬT CUNG ĐƯỜNG
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                <div style={{ background: 'var(--color-bg-card)', padding: '10px', borderRadius: 10, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Chiều dài</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 2 }}>{selectedContribution.distanceKm} km</div>
                </div>
                <div style={{ background: 'var(--color-bg-card)', padding: '10px', borderRadius: 10, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Độ cao nâng</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>+{selectedContribution.elevationGainM} m</div>
                </div>
                <div style={{ background: 'var(--color-bg-card)', padding: '10px', borderRadius: 10, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Đỉnh cao nhất</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#a855f7', marginTop: 2 }}>{selectedContribution.maxAltitudeM} m</div>
                </div>
                <div style={{ background: 'var(--color-bg-card)', padding: '10px', borderRadius: 10, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Mức độ khó</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f59e0b', marginTop: 2 }}>{selectedContribution.difficultyLevel}/5</div>
                </div>
                <div style={{ background: 'var(--color-bg-card)', padding: '10px', borderRadius: 10, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Thời gian đi</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 2 }}>{selectedContribution.durationHoursNote || '1 ngày'}</div>
                </div>
              </div>
            </div>

            {/* SECTION 3: Tọa Độ GPS */}
            <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 16, borderRadius: 14, marginBottom: 16 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 10 }}>
                3. TỌA ĐỘ GPS ĐÁNH DẤU TRÊN BẢN ĐỒ
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.82rem', color: 'var(--color-text-main)' }}>
                <div style={{ background: 'var(--color-bg-card)', padding: 10, borderRadius: 10, border: '1px solid var(--color-border)' }}>
                  <strong style={{ color: '#10b981' }}>• Tọa độ Xuất Phát (Start):</strong>
                  <div style={{ marginTop: 4 }}><code>Lat: {selectedContribution.startLat}, Lng: {selectedContribution.startLng}</code></div>
                </div>
                <div style={{ background: 'var(--color-bg-card)', padding: 10, borderRadius: 10, border: '1px solid var(--color-border)' }}>
                  <strong style={{ color: '#ef4444' }}>• Tọa độ Kết Thúc (End):</strong>
                  <div style={{ marginTop: 4 }}><code>Lat: {selectedContribution.endLat}, Lng: {selectedContribution.endLng}</code></div>
                </div>
              </div>
            </div>

            {/* SECTION 4: Nội Dung Mô Tả */}
            <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 16, borderRadius: 14, marginBottom: 16 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 10 }}>
                4. MÔ TẢ CHI TIẾT & HƯỚNG DẪN DI CHUYỂN
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 4 }}>
                  Mô tả tổng quan:
                </div>
                <p style={{ color: 'var(--color-text-main)', fontSize: '0.84rem', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line', background: 'var(--color-bg-card)', padding: 12, borderRadius: 10, border: '1px solid var(--color-border)' }}>
                  {selectedContribution.description || 'Chưa nhập nội dung mô tả.'}
                </p>
              </div>

              {selectedContribution.transportationInfo && (
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 4 }}>
                    Hướng dẫn di chuyển & Phương tiện:
                  </div>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-line', background: 'var(--color-bg-card)', padding: 12, borderRadius: 10, border: '1px solid var(--color-border)' }}>
                    {selectedContribution.transportationInfo}
                  </p>
                </div>
              )}
            </div>

            {/* SECTION 5: Tiện Ích & Giấy Phép */}
            <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 16, borderRadius: 14, marginBottom: 16 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 10 }}>
                5. QUY ĐỊNH GIẤY PHÉP & TIỆN ÍCH
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: '0.82rem', color: 'var(--color-text-main)' }}>
                <div>• <strong>Giấy phép:</strong> {selectedContribution.permitRequired ? (selectedContribution.permitInfo || 'Cần xin giấy phép') : 'Không cần giấy phép'}</div>
                <div>• <strong>Bãi cắm trại:</strong> {selectedContribution.hasCampsite ? 'Có bãi cắm trại' : 'Không có'}</div>
                <div>• <strong>Nguồn nước:</strong> {selectedContribution.hasWaterSource ? 'Có nguồn nước' : 'Không có'}</div>
                <div>• <strong>Trẻ em:</strong> {selectedContribution.kidFriendly ? 'Phù hợp cho trẻ em' : 'Không phù hợp'}</div>
              </div>
            </div>

            {/* SECTION 6: Thành Viên Đóng Góp */}
            {(() => {
              const liveContrib = contributions.find((c) => c.id === selectedContribution.id) || selectedContribution;
              const matchedUser =
                usersList.find(
                  (u) =>
                    (liveContrib.userId && (u._id === liveContrib.userId || u.id === liveContrib.userId)) ||
                    (liveContrib.authorEmail && u.email?.toLowerCase() === liveContrib.authorEmail.toLowerCase())
                ) ||
                (currentUser?.email && liveContrib.authorEmail && currentUser.email.toLowerCase() === liveContrib.authorEmail.toLowerCase()
                  ? currentUser
                  : null);

              const displayAuthorName =
                (liveContrib.authorName && liveContrib.authorName !== 'Trekker Đóng Góp' && liveContrib.authorName !== 'Người dùng TrekMap')
                  ? liveContrib.authorName
                  : (matchedUser?.fullName || matchedUser?.name || liveContrib.authorName || 'Trekker Đóng Góp');

              const displayAuthorEmail = liveContrib.authorEmail || matchedUser?.email || 'Chưa cập nhật email';

              const displayAuthorAvatar =
                (liveContrib.authorAvatar && !liveContrib.authorAvatar.includes('ui-avatars.com/api/?name=Trekker'))
                  ? liveContrib.authorAvatar
                  : (matchedUser?.avatarUrl || matchedUser?.avatar || liveContrib.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayAuthorName)}&background=0ed7b5&color=041217&bold=true`);

              const handleOpenAuthorProfile = () => {
                const authorContribs = contributions.filter(
                  (c) =>
                    (c.authorEmail && displayAuthorEmail && c.authorEmail.toLowerCase() === displayAuthorEmail.toLowerCase()) ||
                    (c.authorName && displayAuthorName && c.authorName.toLowerCase() === displayAuthorName.toLowerCase())
                );

                const approvedCount = authorContribs.filter((c) => c.status === 'approved').length;
                const pendingCount = authorContribs.filter((c) => c.status === 'pending').length;

                setSelectedAuthorModal({
                  name: displayAuthorName,
                  email: displayAuthorEmail,
                  avatar: displayAuthorAvatar,
                  date: liveContrib.createdAt || '30/7/2026',
                  contribCount: authorContribs.length || 1,
                  approvedCount,
                  pendingCount,
                  authorContribs,
                  expeditionId: `TRK-${(displayAuthorName || 'USER').slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
                });
              };

              return (
                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 16, borderRadius: 14, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase' }}>
                      6. THÔNG TIN THÀNH VIÊN ĐÓNG GÓP
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-sky)', fontWeight: 700 }}>
                      Bấm vào thẻ để xem hồ sơ năng lực chi tiết
                    </span>
                  </div>

                  <div
                    onClick={handleOpenAuthorProfile}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      background: 'var(--color-bg-card)',
                      padding: 14,
                      borderRadius: 12,
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <img
                      src={displayAuthorAvatar}
                      alt={displayAuthorName}
                      style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid var(--color-primary)', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                          {displayAuthorName}
                        </span>
                        <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 800 }}>
                          ✓ Verified Trekker
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
                        Email: <strong style={{ color: 'var(--color-primary)' }}>{displayAuthorEmail}</strong> • Ngày gửi: <strong>{liveContrib.createdAt || '30/7/2026'}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Action Bar */}
            <div style={{ display: 'flex', gap: 12, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
              <button className="btn btn-outline" onClick={() => setSelectedContribution(null)} style={{ flex: 1, justifyContent: 'center' }}>
                Đóng
              </button>

              {selectedContribution.status === 'pending' && (
                <button
                  className="btn btn-outline"
                  onClick={() => handleReject(selectedContribution.id, selectedContribution.name)}
                  style={{ flex: 1, justifyContent: 'center', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)', gap: 6 }}
                >
                  <XCircle size={16} /> Từ Chối
                </button>
              )}

              {selectedContribution.status !== 'approved' && (
                <button
                  className="btn btn-primary"
                  onClick={() => handleApprove(selectedContribution.id, selectedContribution.name)}
                  style={{ flex: 1.5, justifyContent: 'center', background: '#10b981', borderColor: '#10b981', gap: 6 }}
                >
                  <CheckCircle2 size={16} /> Phê Duyệt & Đưa Lên Bản Đồ
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
       * ULTRA-DETAILED MEMBER PROFILE MODAL
       * ========================================================================= */}
      {selectedAuthorModal && (
        <div className="modal-overlay" onClick={() => setSelectedAuthorModal(null)} style={{ zIndex: 9999, backdropFilter: 'blur(12px)' }}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 580,
              width: '95%',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1.5px solid var(--color-primary)',
              padding: 24,
              borderRadius: 22,
              background: 'var(--color-bg-card)',
              boxShadow: 'var(--shadow-3d)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={20} /> Hồ Sơ Thám Hiểm & Năng Lực Thành Viên
              </div>
              <button
                onClick={() => setSelectedAuthorModal(null)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', padding: 4 }}
              >
                <IconX size={20} />
              </button>
            </div>

            {/* Passport Banner Card */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(56, 189, 248, 0.12) 100%)',
                border: '1px solid var(--color-primary)',
                padding: 18,
                borderRadius: 16,
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <img
                  src={selectedAuthorModal.avatar}
                  alt={selectedAuthorModal.name}
                  style={{ width: 72, height: 72, borderRadius: '50%', border: '3px solid var(--color-primary)', objectFit: 'cover' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--color-text-main)' }}>
                      {selectedAuthorModal.name}
                    </span>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4, background: '#10b981', color: '#fff', fontWeight: 800 }}>
                      ✓ Verified
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 800, marginTop: 4 }}>
                    Mã Thám Hiểm: {selectedAuthorModal.expeditionId}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 3 }}>
                      <span>Hạng: Alpine Scout Level 3</span>
                      <span>85 / 100 EXP</span>
                    </div>
                    <div style={{ background: 'var(--color-bg-card)', height: 6, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                      <div style={{ width: '85%', height: '100%', background: 'linear-gradient(90deg, #10b981, #38bdf8)' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Spec Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Email</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-primary)', wordBreak: 'break-all', marginTop: 2 }}>
                  {selectedAuthorModal.email}
                </div>
              </div>
              <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Số Bài Đóng Góp</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 900, color: 'var(--color-text-main)', marginTop: 2 }}>
                  {selectedAuthorModal.contribCount} bài ({selectedAuthorModal.approvedCount} đã duyệt)
                </div>
              </div>
              <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Điểm Uy Tín BQT</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#10b981', marginTop: 2 }}>
                  98/100 PTS
                </div>
              </div>
              <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Xác Thực Hệ Thống</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
                  OAuth 2.0 Direct
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const target = selectedAuthorModal.email || selectedAuthorModal.name;
                  if (target) {
                    localStorage.setItem('trekmap_target_chat_user', target);
                  }
                  setSelectedAuthorModal(null);
                  window.location.hash = '#messages';
                }}
                style={{ flex: 1, justifyContent: 'center', padding: '10px 16px', fontSize: '0.85rem', fontWeight: 800 }}
              >
                Nhắn Tin Trực Tiếp
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setSelectedAuthorModal(null)}
                style={{ flex: 1, justifyContent: 'center', padding: '10px 16px', fontSize: '0.85rem', fontWeight: 800 }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT TRAIL MODAL */}
      {(isCreateTrailOpen || editingTrailModal) && (
        <div className="modal-overlay" onClick={() => { setIsCreateTrailOpen(false); setEditingTrailModal(null); }} style={{ zIndex: 9999, backdropFilter: 'blur(10px)' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, width: '90%', padding: 24, borderRadius: 20 }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 12 }}>
              {editingTrailModal ? `Chỉnh sửa cung đường "${editingTrailModal.name}"` : 'Thêm Cung Đường Mới (Admin)'}
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
              Để thiết lập thông số kỹ thuật, bản đồ độ cao và tọa độ GPS thực địa đầy đủ cho cung đường mới, bạn có thể khởi chạy Trình Wizard đóng góp 5 bước chuẩn hóa.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setIsCreateTrailOpen(false);
                  setEditingTrailModal(null);
                  window.location.hash = '#contribute';
                }}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Mở Wizard Đóng Góp
              </button>
              <button
                className="btn btn-outline"
                onClick={() => { setIsCreateTrailOpen(false); setEditingTrailModal(null); }}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Hủy / Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
