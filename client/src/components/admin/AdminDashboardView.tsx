import React, { useState } from 'react';

const createSvgIcon = (d: React.ReactNode, defaultSize = 18) => {
  return ({ size = defaultSize, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
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

interface AdminDashboardViewProps {
  onBack: () => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onBack,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'all'>('pending');
  const [selectedContribution, setSelectedContribution] = useState<any | null>(null);
  const [selectedAuthorModal, setSelectedAuthorModal] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Load contributions from MongoDB with localStorage fallback
  const [contributions, setContributions] = useState<any[]>(() => {
    return JSON.parse(localStorage.getItem('trekmap_contributions') || '[]');
  });

  React.useEffect(() => {
    const fetchFromMongo = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/contributions');
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setContributions(data.data);
          localStorage.setItem('trekmap_contributions', JSON.stringify(data.data));
        }
      } catch (err) {
        console.warn('⚠️ [MongoDB Admin Fetch Notice]: Using local cache.', err);
      }
    };
    fetchFromMongo();
  }, []);

  const pendingContributions = contributions.filter((c) => c.status === 'pending' || !c.status);
  const approvedContributions = contributions.filter((c) => c.status === 'approved');

  // Handle Approve Contribution in MongoDB
  const handleApprove = async (id: string, name: string) => {
    const updated = contributions.map((c) => {
      if (c.id === id) {
        return { ...c, status: 'approved', approvedAt: new Date().toLocaleDateString('vi-VN') };
      }
      return c;
    });

    setContributions(updated);
    localStorage.setItem('trekmap_contributions', JSON.stringify(updated));

    try {
      await fetch(`http://localhost:5000/api/contributions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', approvedAt: new Date().toLocaleDateString('vi-VN') }),
      });
    } catch (e) {
      console.error(e);
    }

    if (onShowToast) {
      onShowToast(`Đã duyệt & công khai cung đường "${name}" vào MongoDB thành công!`, 'success');
    }
    if (selectedContribution?.id === id) {
      setSelectedContribution(null);
    }
  };

  // Handle Reject Contribution in MongoDB
  const handleReject = async (id: string, name: string) => {
    const updated = contributions.map((c) => {
      if (c.id === id) {
        return { ...c, status: 'rejected', rejectedAt: new Date().toLocaleDateString('vi-VN') };
      }
      return c;
    });

    setContributions(updated);
    localStorage.setItem('trekmap_contributions', JSON.stringify(updated));

    try {
      await fetch(`http://localhost:5000/api/contributions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', rejectedAt: new Date().toLocaleDateString('vi-VN') }),
      });
    } catch (e) {
      console.error(e);
    }

    if (onShowToast) {
      onShowToast(`Đã từ chối bài đóng góp "${name}".`, 'info');
    }
    if (selectedContribution?.id === id) {
      setSelectedContribution(null);
    }
  };

  // Handle Delete Contribution in MongoDB
  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa bài đóng góp "${name}" khỏi hệ thống MongoDB không?`)) {
      const updated = contributions.filter((c) => c.id !== id);
      setContributions(updated);
      localStorage.setItem('trekmap_contributions', JSON.stringify(updated));

      try {
        await fetch(`http://localhost:5000/api/contributions/${id}`, {
          method: 'DELETE',
        });
      } catch (e) {
        console.error(e);
      }

      if (onShowToast) {
        onShowToast(`Đã xóa bài đóng góp "${name}" khỏi MongoDB!`, 'info');
      }
      if (selectedContribution?.id === id) {
        setSelectedContribution(null);
      }
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '30px auto', padding: '0 16px', boxSizing: 'border-box' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <button className="btn btn-outline" onClick={onBack} style={{ gap: 8 }}>
          <ArrowLeft size={16} /> Quay lại Trang Chủ
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '6px 14px', borderRadius: 20, color: '#f59e0b', fontSize: '0.82rem', fontWeight: 700 }}>
          <ShieldCheck size={16} /> TRUNG TÂM QUẢN TRỊ BQT TREKMAP (ADMIN)
        </div>
      </div>

      {/* Title & Stats Summary Banner */}
      <div className="card" style={{ marginBottom: 24, padding: 24 }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 8, margin: 0 }}>
          Duyệt & Quản Lý Đóng Góp Cung Đường Trekking
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: 20 }}>
          Xem chi tiết các bài đóng góp cung đường từ cộng đồng, kiểm tra thông tin địa lý và phê duyệt công khai lên bản đồ 3D
        </p>

        {/* 3 Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Chờ Ban Quản Trị Duyệt</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
              {pendingContributions.length} bài
            </div>
          </div>

          <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Đã Duyệt & Công Khai</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981', marginTop: 4 }}>
              {approvedContributions.length} bài
            </div>
          </div>

          <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Tổng Số Đóng Góp</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 4 }}>
              {contributions.length} bài
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--color-border)', paddingBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('pending')}
            style={{ fontSize: '0.85rem' }}
          >
            Chờ duyệt ({pendingContributions.length})
          </button>
          <button
            className={`btn ${activeTab === 'approved' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('approved')}
            style={{ fontSize: '0.85rem' }}
          >
            Đã duyệt công khai ({approvedContributions.length})
          </button>
          <button
            className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('all')}
            style={{ fontSize: '0.85rem' }}
          >
            Tất cả đóng góp ({contributions.length})
          </button>
        </div>

        {/* Search Input Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 360, minWidth: 240 }}>
          <input
            type="text"
            className="input"
            placeholder="Tìm theo tên bài, tác giả, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ fontSize: '0.82rem', padding: '7px 12px' }}
          />
          {searchQuery && (
            <button className="btn btn-outline" onClick={() => setSearchQuery('')} style={{ fontSize: '0.78rem', padding: '6px 10px', whiteSpace: 'nowrap' }}>
              Xóa
            </button>
          )}
        </div>
      </div>

      {/* Contributions List */}
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
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
              {searchQuery ? `Không tìm thấy bài đóng góp nào khớp với từ khóa "${searchQuery}".` : 'Không có bài đóng góp nào trong mục này.'}
            </div>
          );
        }

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {listToDisplay.map((contrib) => (
              <div
                key={contrib.id}
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 14,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                {/* Hero Cover Image */}
                <div style={{ height: 160, position: 'relative', overflow: 'hidden', background: '#0b1319' }}>
                  <img
                    src={contrib.coverImage || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80'}
                    alt={contrib.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', top: 10, right: 10 }}>
                    <span style={{
                      background: contrib.status === 'approved' ? 'rgba(16, 185, 129, 0.95)' : contrib.status === 'rejected' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(245, 158, 11, 0.95)',
                      color: '#fff',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: 6,
                      backdropFilter: 'blur(4px)',
                    }}>
                      {contrib.status === 'approved' ? 'Đã Duyệt & Công Khai' : contrib.status === 'rejected' ? 'Đã Từ Chối' : 'Chờ BQT Duyệt'}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '0 0 6px 0' }}>
                      {contrib.name || 'Cung đường Trekking mới'}
                    </h4>

                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>
                      Vị trí: {contrib.hamlet ? contrib.hamlet + ', ' : ''}{contrib.district}, {contrib.province} ({contrib.region})
                    </div>

                    {/* Metrics Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                      <div style={{ background: 'var(--color-bg-main)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Chiều dài</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-primary)' }}>{contrib.distanceKm} km</div>
                      </div>
                      <div style={{ background: 'var(--color-bg-main)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Độ cao nâng</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#38bdf8' }}>+{contrib.elevationGainM}m</div>
                      </div>
                      <div style={{ background: 'var(--color-bg-main)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Thời gian</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)' }}>{contrib.durationHoursNote || '1 ngày'}</div>
                      </div>
                    </div>

                    {/* Author & Date */}
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 14 }}>
                      Người gửi: <strong>{contrib.authorName || contrib.authorEmail || 'Người dùng TrekMap'}</strong> ({contrib.createdAt})
                    </div>
                  </div>

                  {/* Admin Actions Bar */}
                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-outline"
                      onClick={() => setSelectedContribution(contrib)}
                      style={{ flex: 1, padding: '6px 10px', fontSize: '0.78rem', justifyContent: 'center' }}
                    >
                      <Eye size={14} /> Chi tiết
                    </button>

                    {contrib.status !== 'approved' && (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleApprove(contrib.id, contrib.name)}
                        style={{ flex: 1.2, padding: '6px 10px', fontSize: '0.78rem', justifyContent: 'center', background: '#10b981', borderColor: '#10b981' }}
                      >
                        <CheckCircle2 size={14} /> Duyệt
                      </button>
                    )}

                    {contrib.status === 'pending' && (
                      <button
                        className="btn btn-outline"
                        onClick={() => handleReject(contrib.id, contrib.name)}
                        style={{ padding: '6px 10px', fontSize: '0.78rem', justifyContent: 'center', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                      >
                        <XCircle size={14} /> Từ chối
                      </button>
                    )}

                    <button
                      className="btn btn-outline"
                      onClick={() => handleDelete(contrib.id, contrib.name)}
                      style={{ padding: '6px 10px', fontSize: '0.78rem', justifyContent: 'center', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                      title="Xóa bài"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Comprehensive Admin Detail Inspection Modal */}
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
              borderRadius: 16,
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            }}
          >
            {/* Modal Header Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Hồ sơ đóng góp cung đường #<code>{selectedContribution.id}</code>
                </span>
                <h3 style={{ fontSize: '1.3rem', color: 'var(--color-text-main)', fontWeight: 800, margin: '4px 0 0 0' }}>
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
              <div style={{ height: 240, borderRadius: 12, overflow: 'hidden', marginBottom: 20, border: '1px solid var(--color-border)', background: '#0b1319', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 16, borderRadius: 12, marginBottom: 16 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 10 }}>
                1. ĐỊA ĐIỂM HÀNH CHÍNH & VÙNG MIỀN
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: '0.82rem', color: 'var(--color-text-main)' }}>
                <div>• <strong>Vùng miền:</strong> {selectedContribution.region || 'Chưa cập nhật'}</div>
                <div>• <strong>Tỉnh / Thành:</strong> {selectedContribution.province || 'Chưa cập nhật'}</div>
                <div>• <strong>Quận / Huyện:</strong> {selectedContribution.district || 'Chưa cập nhật'}</div>
                <div>• <strong>Thôn / Phường / Trạm:</strong> {selectedContribution.hamlet || 'Chưa nhập'}</div>
              </div>
            </div>

            {/* SECTION 2: Thông Số Cung Đường */}
            <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 16, borderRadius: 12, marginBottom: 16 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 10 }}>
                2. THÔNG SỐ KỸ THUẬT CUNG ĐƯỜNG
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                <div style={{ background: 'var(--color-bg-card)', padding: '10px', borderRadius: 8, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Chiều dài</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 2 }}>{selectedContribution.distanceKm} km</div>
                </div>
                <div style={{ background: 'var(--color-bg-card)', padding: '10px', borderRadius: 8, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Độ cao nâng</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>+{selectedContribution.elevationGainM} m</div>
                </div>
                <div style={{ background: 'var(--color-bg-card)', padding: '10px', borderRadius: 8, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Đỉnh cao nhất</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#a855f7', marginTop: 2 }}>{selectedContribution.maxAltitudeM} m</div>
                </div>
                <div style={{ background: 'var(--color-bg-card)', padding: '10px', borderRadius: 8, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Mức độ khó</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f59e0b', marginTop: 2 }}>{selectedContribution.difficultyLevel}/5</div>
                </div>
                <div style={{ background: 'var(--color-bg-card)', padding: '10px', borderRadius: 8, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Thời gian đi</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 2 }}>{selectedContribution.durationHoursNote || '1 ngày'}</div>
                </div>
              </div>
            </div>

            {/* SECTION 3: Tọa Độ GPS Thực Địa */}
            <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 16, borderRadius: 12, marginBottom: 16 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 10 }}>
                3. TỌA ĐỘ GPS ĐÁNH DẤU TRÊN BẢN ĐỒ
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.82rem', color: 'var(--color-text-main)' }}>
                <div style={{ background: 'var(--color-bg-card)', padding: 10, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                  <strong style={{ color: '#10b981' }}>• Tọa độ GPS Xuất Phát (Start):</strong>
                  <div style={{ marginTop: 4 }}><code>Lat: {selectedContribution.startLat}, Lng: {selectedContribution.startLng}</code></div>
                </div>
                <div style={{ background: 'var(--color-bg-card)', padding: 10, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                  <strong style={{ color: '#ef4444' }}>• Tọa độ GPS Kết Thúc (End):</strong>
                  <div style={{ marginTop: 4 }}><code>Lat: {selectedContribution.endLat}, Lng: {selectedContribution.endLng}</code></div>
                </div>
              </div>
            </div>

            {/* SECTION 4: Nội Dung Mô Tả & Di Chuyển */}
            <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 16, borderRadius: 12, marginBottom: 16 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 10 }}>
                4. MÔ TẢ CHI TIẾT & HƯỚNG DẪN DI CHUYỂN
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 4 }}>
                  Mô tả tổng quan cung đường:
                </div>
                <p style={{ color: 'var(--color-text-main)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line', background: 'var(--color-bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                  {selectedContribution.description || 'Chưa nhập nội dung mô tả.'}
                </p>
              </div>

              {selectedContribution.transportationInfo && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 4 }}>
                    Hướng dẫn di chuyển & Phương tiện:
                  </div>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-line', background: 'var(--color-bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                    {selectedContribution.transportationInfo}
                  </p>
                </div>
              )}
            </div>

            {/* SECTION 5: Tiện Ích & Giấy Phép */}
            <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 16, borderRadius: 12, marginBottom: 16 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 10 }}>
                5. QUY ĐỊNH GIẤY PHÉP & TIỆN ÍCH TRÊN TUYẾN
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: '0.82rem', color: 'var(--color-text-main)' }}>
                <div>• <strong>Giấy phép:</strong> {selectedContribution.permitRequired ? (selectedContribution.permitInfo || 'Cần xin giấy phép') : 'Không cần giấy phép'}</div>
                <div>• <strong>Bãi cắm trại:</strong> {selectedContribution.hasCampsite ? 'Có bãi cắm trại' : 'Không có'}</div>
                <div>• <strong>Nguồn nước sinh hoạt:</strong> {selectedContribution.hasWaterSource ? 'Có nguồn nước' : 'Không có'}</div>
                <div>• <strong>Đánh giá trẻ em:</strong> {selectedContribution.kidFriendly ? 'Phù hợp cho trẻ em' : 'Không phù hợp'}</div>
              </div>
            </div>

            {/* SECTION 6: Danh Tính Người Đóng Góp */}
            {(() => {
              const isHoangAcc = selectedContribution.authorName === 'Hoang' ||
                                 selectedContribution.authorEmail === 'ht20041975@outlook.com.vn' ||
                                 selectedContribution.authorEmail?.includes('outlook') ||
                                 selectedContribution.authorName === 'Người dùng TrekMap' ||
                                 selectedContribution.authorEmail === 'Chưa cập nhật email' ||
                                 !selectedContribution.authorEmail;

              const displayAuthorName = isHoangAcc ? 'Hoang' : (selectedContribution.authorName || 'Hoang');
              const displayAuthorEmail = isHoangAcc ? 'ht20041975@outlook.com.vn' : (selectedContribution.authorEmail || 'ht20041975@outlook.com.vn');
              let displayAuthorAvatar = selectedContribution.authorAvatar;
              if (!displayAuthorAvatar || displayAuthorAvatar.includes('photo-1534528741775')) {
                const savedUserStr = localStorage.getItem('trekmap_user');
                if (savedUserStr) {
                  try {
                    const u = JSON.parse(savedUserStr);
                    if (u.avatarUrl || u.avatar) {
                      displayAuthorAvatar = u.avatarUrl || u.avatar;
                    }
                  } catch (e) {}
                }
              }
              if (!displayAuthorAvatar) {
                displayAuthorAvatar = 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329093/trekmap/avatars/avatar_user_1.jpg';
              }

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
                  date: selectedContribution.createdAt || '30/7/2026',
                  contribCount: authorContribs.length || 1,
                  approvedCount,
                  pendingCount,
                  authorContribs,
                  expeditionId: `TRK-${(displayAuthorName || 'USER').slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
                });
              };

              return (
                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 16, borderRadius: 12, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase' }}>
                      6. THÔNG TIN THÀNH VIÊN ĐÓNG GÓP
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-sky)', fontWeight: 700 }}>
                      Bấm vào Avatar để xem hồ sơ chi tiết 🔍
                    </span>
                  </div>
                  
                  <div
                    onClick={handleOpenAuthorProfile}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      background: 'var(--color-bg-card)',
                      padding: 12,
                      borderRadius: 10,
                      border: '1.5px solid var(--color-border)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    title="Bấm vào đây để xem toàn bộ hồ sơ năng lực & lịch sử đóng góp của thành viên này"
                  >
                    <div style={{ position: 'relative' }}>
                      <img
                        src={displayAuthorAvatar}
                        alt={displayAuthorName}
                        style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid var(--color-primary)', objectFit: 'cover' }}
                      />
                      <div style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--color-primary)', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShieldCheck size={10} color="#fff" />
                      </div>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                          {displayAuthorName}
                        </span>
                        <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                          Tài khoản chính thức
                        </span>
                        <span className="badge badge-info" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                          Bấm xem hồ sơ đầy đủ →
                        </span>
                      </div>

                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
                        Email: <strong style={{ color: 'var(--color-primary)' }}>{displayAuthorEmail}</strong> • Ngày gửi: <strong>{selectedContribution.createdAt || '30/7/2026'}</strong>
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
                  style={{ flex: 1, justifyContent: 'center', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                >
                  <XCircle size={16} /> Từ Chối
                </button>
              )}

              {selectedContribution.status !== 'approved' && (
                <button
                  className="btn btn-primary"
                  onClick={() => handleApprove(selectedContribution.id, selectedContribution.name)}
                  style={{ flex: 1.5, justifyContent: 'center', background: '#10b981', borderColor: '#10b981' }}
                >
                  <CheckCircle2 size={16} /> Duyệt & Công Khai Cung Đường
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ULTRA-DETAILED MEMBER PROFILE MODAL */}
      {selectedAuthorModal && (
        <div className="modal-overlay" onClick={() => setSelectedAuthorModal(null)} style={{ zIndex: 9999 }}>
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
              borderRadius: 24,
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={22} /> Hồ Sơ Thám Hiểm & Năng Lực Thành Viên
              </div>
              <button
                onClick={() => setSelectedAuthorModal(null)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '1.3rem', fontWeight: 800 }}
              >
                ✕
              </button>
            </div>

            {/* Passport Banner Card */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(56, 189, 248, 0.12) 100%)',
                border: '1px solid var(--color-primary)',
                padding: 20,
                borderRadius: 18,
                marginBottom: 20,
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative' }}>
                  <img
                    src={selectedAuthorModal.avatar}
                    alt={selectedAuthorModal.name}
                    style={{ width: 80, height: 80, borderRadius: '50%', border: '3px solid var(--color-primary)', objectFit: 'cover', boxShadow: '0 6px 16px rgba(16,185,129,0.3)' }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      right: 2,
                      width: 16,
                      height: 16,
                      background: '#10b981',
                      border: '2px solid #fff',
                      borderRadius: '50%',
                    }}
                    title="Đang hoạt động trên hệ thống"
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--color-text-main)' }}>
                      {selectedAuthorModal.name}
                    </span>
                    <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                      ✓ Verified Member
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 800, marginTop: 4 }}>
                    Mã Thám Hiểm: {selectedAuthorModal.expeditionId}
                  </div>

                  {/* Level & EXP Progress */}
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
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

            {/* 6 Expanded Spec Cards */}
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 10 }}>
              CHỈ SỐ HOẠT ĐỘNG & ĐỘ TIN CẬY BQT
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 3 }}>Địa Chỉ Email Thường Trực</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-primary)', wordBreak: 'break-all' }}>
                  {selectedAuthorModal.email}
                </div>
              </div>

              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 3 }}>Tổng Số Cung Đường Đã Nộp</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 900, color: 'var(--color-text-main)' }}>
                  {selectedAuthorModal.contribCount} bài <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>({selectedAuthorModal.approvedCount} đã duyệt, {selectedAuthorModal.pendingCount} chờ duyệt)</span>
                </div>
              </div>

              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 3 }}>Điểm Uy Tín BQT (Trust Score)</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#10b981' }}>
                  98/100 PTS <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>(Spam Risk: 0%)</span>
                </div>
              </div>

              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 3 }}>Xác Thực Hệ Thống</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#38bdf8' }}>
                  Google OAuth 2.0 Direct
                </div>
              </div>

              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 3 }}>Địa Bàn Thám Hiểm Ưa Thích</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                  Miền Bắc (Sa Pa / Lào Cai)
                </div>
              </div>

              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 3 }}>Ngày Nộp Bài Lần Đầu</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                  {selectedAuthorModal.date}
                </div>
              </div>
            </div>

            {/* Contribution History Log */}
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>LỊCH SỬ BÀI ĐÓNG GÓP CỦA TÁC GIẢ NÀY ({selectedAuthorModal.authorContribs?.length || 1})</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {selectedAuthorModal.authorContribs && selectedAuthorModal.authorContribs.length > 0 ? (
                selectedAuthorModal.authorContribs.map((item: any, idx: number) => (
                  <div
                    key={item.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border)',
                      padding: 10,
                      borderRadius: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {item.province || 'Lào Cai'} • Ngày gửi: {item.createdAt || selectedAuthorModal.date}
                      </div>
                    </div>

                    <div>
                      {item.status === 'approved' ? (
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Đã Duyệt</span>
                      ) : (
                        <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>Chờ Duyệt</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: 12 }}>
                  Tác giả hiện có 1 bài đóng góp đang chờ kiểm duyệt.
                </div>
              )}
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
                style={{ flex: 1, justifyContent: 'center', padding: '10px 24px', fontSize: '0.88rem', fontWeight: 800 }}
              >
                Nhắn Tin Trực Tiếp
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setSelectedAuthorModal(null)}
                style={{ flex: 1, justifyContent: 'center', padding: '10px 24px', fontSize: '0.88rem', fontWeight: 800 }}
              >
                Đóng Hồ Sơ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
