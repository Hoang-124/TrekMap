import React, { useState } from 'react';
import type { Trail, Review } from '../../types.js';
import { MapView } from '../map/MapView.js';
import { submitReview } from '../../services/api.js';
import { OptimizedImage } from '../common/OptimizedImage.js';
import { ElevationProfileSVG } from './ElevationProfileSVG.js';
import { WeatherTab } from './WeatherTab.js';
import { GearChecklistTab } from './GearChecklistTab.js';
import { ItineraryTab } from './ItineraryTab.js';
import { TrailConditionSection } from './TrailConditionSection.js';
import { IconPhone, IconAlertTriangle } from '../common/SvgIcons.js';

interface TrailDetailViewProps {
  trail: Trail;
  onBack: () => void;
  onOpenIncidentModal: () => void;
}

export const TrailDetailView: React.FC<TrailDetailViewProps> = ({
  trail,
  onBack,
  onOpenIncidentModal,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'map' | 'weather' | 'checklist' | 'itinerary' | 'guides' | 'reviews' | 'conditions'>('overview');
  const [reviewsList, setReviewsList] = useState<Review[]>(trail.reviews || []);
  const [guidesList, setGuidesList] = useState<any[]>(trail.guides || []);
  const [newRating, setNewRating] = useState(5);
  const [newDiffRating, setNewDiffRating] = useState(trail.difficultyLevel || 3);
  const [newContent, setNewContent] = useState('');
  const [newSafetyNote, setNewSafetyNote] = useState('');

  React.useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await fetch(`/api/trails/${trail.id}/reviews`);
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setReviewsList(data.data);
        }
      } catch (err) {}
    };
    const fetchGuides = async () => {
      try {
        const res = await fetch(`/api/guides?region=${encodeURIComponent(trail.region)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setGuidesList(data.data);
        }
      } catch (err) {}
    };
    fetchReviews();
    fetchGuides();
  }, [trail.id, trail.region]);

  const steepnessPercent = Math.round((trail.elevationGainM / (trail.distanceKm * 1000)) * 100);

  // GPX 1.1 Download Generator
  const handleDownloadGpx = () => {
    const trackPointsXml = (trail.gpxTrack || [])
      .map(
        (pt: any) =>
          `      <trkpt lat="${pt[0]}" lon="${pt[1]}"><ele>${pt[2] || 0}</ele></trkpt>`
      )
      .join('\n');

    const gpxXml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrekMap Vietnam - https://trekmap.vn">
  <metadata>
    <name>${trail.name}</name>
    <desc>${trail.description}</desc>
    <author><name>TrekMap Community</name></author>
  </metadata>
  <trk>
    <name>${trail.name} Trail Track</name>
    <trkseg>
${trackPointsXml}
    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpxXml], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${trail.id}_TrekMap.gpx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    const payload = {
      trailId: trail.id,
      rating: newRating,
      difficultyRating: newDiffRating,
      content: newContent,
      safetyNote: newSafetyNote || undefined,
    };

    const res: any = await submitReview(trail.id, payload as any);
    if (res && res._id) {
      setReviewsList([res, ...reviewsList]);
    } else {
      const mockRev: Review = {
        id: `rev-${Date.now()}`,
        trailId: trail.id,
        userId: 'user-temp',
        userName: 'Trekker Ẩn Danh',
        userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
        rating: newRating,
        difficultyRating: newDiffRating,
        content: newContent,
        safetyNote: newSafetyNote || undefined,
        tripDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      };
      setReviewsList([mockRev, ...reviewsList]);
    }

    setNewContent('');
    setNewSafetyNote('');
  };

  // Best season calendar calculation
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const currentMonth = new Date().getMonth() + 1;

  // Transportation steps
  const transportSteps = trail.transportationInfo
    ? trail.transportationInfo.split(/\.\s+/)
    : [
        `Di chuyển từ trung tâm TP. ${trail.province} bằng xe khách/xe máy đến điểm hẹn.`,
        'Bắt đầu chặng đi bộ từ cổng Vườn Quốc Gia / Cửa rừng.',
        'Làm thủ tục đăng ký với Trạm Kiểm Lâm địa phương.',
      ];

  const isOver3000m = trail.maxAltitudeM >= 3000;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px 60px 20px' }}>
      {/* Navigation & Action Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 0',
        marginBottom: 16,
      }}>
        <button className="btn btn-outline" onClick={onBack} style={{ gap: 8, display: 'inline-flex', alignItems: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Quay lại danh sách</span>
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={handleDownloadGpx} style={{ gap: 8, display: 'inline-flex', alignItems: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Tải GPX Offline</span>
          </button>
          <button className="btn btn-danger" onClick={onOpenIncidentModal} style={{ gap: 8, display: 'inline-flex', alignItems: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Cứu hộ SOS</span>
          </button>
        </div>
      </div>

      {/* Hero Header Section */}
      <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', height: 380, marginBottom: 24 }}>
        <OptimizedImage
          src={trail.coverImage}
          alt={trail.name}
          targetWidth={1280}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(5, 12, 20, 0.95) 0%, rgba(5, 12, 20, 0.3) 60%, transparent 100%)',
        }} />

        <div style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          right: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}>
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <span className="badge badge-success">{trail.region}</span>
              <span className="badge badge-stream">{trail.province}</span>
              {trail.permitRequired && (
                <span className="badge badge-danger">Yêu cầu Giấy phép Kiểm Lâm</span>
              )}
            </div>

            <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1.2 }}>
              {trail.name}
            </h1>
            {trail.altNames && trail.altNames.length > 0 && (
              <div style={{ color: 'var(--color-text-dim)', fontSize: '0.95rem', marginTop: 4 }}>
                Tên gọi khác: {trail.altNames.join(', ')}
              </div>
            )}
          </div>

          <div style={{
            background: 'var(--color-bg-glass)',
            backdropFilter: 'blur(12px)',
            padding: '12px 20px',
            borderRadius: 16,
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>Đánh giá cộng đồng</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-sun)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {trail.rating} <span style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>({trail.reviewCount} bài)</span>
              </div>
            </div>
            <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: 16 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>Mức độ khó</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: trail.difficultyLevel >= 4 ? 'var(--color-error)' : 'var(--color-primary)' }}>
                Cấp {trail.difficultyLevel}/5
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* P2-1: Enhanced Stats Bar */}
      <div className="card" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 16,
        marginBottom: 28,
        textAlign: 'center',
      }}>
        <div>
          <div style={{ color: 'var(--color-text-dim)', fontSize: '0.78rem' }}>Chiều dài</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)' }}>{trail.distanceKm} km</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Vừa sức 2 ngày</div>
        </div>
        <div>
          <div style={{ color: 'var(--color-text-dim)', fontSize: '0.78rem' }}>Độ cao tích lũy</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-sky)' }}>+{trail.elevationGainM} m</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Độ dốc ~{steepnessPercent}%</div>
        </div>
        <div>
          <div style={{ color: 'var(--color-text-dim)', fontSize: '0.78rem' }}>Cao độ đỉnh</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-stream)' }}>{trail.maxAltitudeM} m</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-sun)' }}>{isOver3000m ? 'Gấp 3x Bà Nà' : 'Top Đỉnh Mây'}</div>
        </div>
        <div>
          <div style={{ color: 'var(--color-text-dim)', fontSize: '0.78rem' }}>Thời gian trung bình</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-sun)' }}>{trail.durationHoursNote}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{trail.durationDays} ngày {trail.durationDays - 1} đêm</div>
        </div>
        <div>
          <div style={{ color: 'var(--color-text-dim)', fontSize: '0.78rem' }}>Đặc tính tiện ích</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 4 }}>
            {trail.hasCampsite && <span className="badge badge-stream" title="Có bãi cắm trại">Camp</span>}
            {trail.hasWaterSource && <span className="badge badge-cloud" title="Có nguồn nước">Nước</span>}
            {trail.kidFriendly && <span className="badge badge-success" title="Phù hợp trẻ em">Kid</span>}
          </div>
        </div>
      </div>

      {/* 7 Tab Navigation Header */}
      <div style={{
        display: 'flex',
        gap: 8,
        borderBottom: '1px solid var(--color-border)',
        marginBottom: 24,
        overflowX: 'auto',
      }}>
        {[
          { id: 'overview', label: 'Tổng quan', icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          ) },
          { id: 'map', label: 'Bản đồ GPX 3D', icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
          ) },
          { id: 'weather', label: 'Thời tiết 7 ngày & Săn mây' },
          { id: 'checklist', label: 'Danh mục đồ đạc', icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          ) },
          { id: 'itinerary', label: 'Lịch trình & Chia sẻ Zalo' },
          { id: 'guides', label: 'Hướng dẫn viên & Porter', icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ) },
          { id: 'reviews', label: `Nhận xét (${reviewsList.length})`, icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          ) },
          { id: 'conditions', label: 'Tình trạng thực địa (7 ngày)', icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ) },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '12px 18px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.92rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 28 }}>
          <div>
            {/* SVG Elevation Profile Graph */}
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 12 }}>
                Đồ Thị Trắc Diện Cao Độ (Elevation Profile)
              </h3>
              <ElevationProfileSVG
                gpxTrack={trail.gpxTrack}
                elevationGainM={trail.elevationGainM}
                maxAltitudeM={trail.maxAltitudeM}
              />
            </div>

            {/* Description */}
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 12 }}>
                Giới thiệu cung đường
              </h3>
              <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.7, fontSize: '0.95rem' }}>
                {trail.description}
              </p>
            </div>

            {/* P2-4: Transportation Guide Stepper */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                  Hướng Dẫn Di Chuyển Đến Điểm Xuất Phát
                </h3>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${trail.startLat},${trail.startLng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  Mở Google Maps chỉ đường
                </a>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {transportSteps.map((stepText: string, idx: number) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ background: 'var(--color-primary)', color: '#071319', fontSize: '0.78rem', fontWeight: 800, width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {idx + 1}
                    </span>
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', lineHeight: 1.5, paddingTop: 2 }}>
                      {stepText.trim()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* P2-3: Best Season Calendar */}
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 6 }}>
                Lịch Mùa Trekking Trong Năm
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-dim)', marginBottom: 16 }}>
                Xanh lá = Mùa đẹp nhất • Viền Vàng nhấp nháy = Tháng hiện tại (T{currentMonth}) • Đỏ = Tránh đi do mưa lũ
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 6, textAlign: 'center' }}>
                {months.map((m) => {
                  const isBest = trail.bestMonths.includes(m);
                  const isAvoid = trail.avoidMonths.includes(m);
                  const isCurrent = m === currentMonth;

                  let bg = '#142f3b';
                  let color = '#94a3b8';
                  let tooltip = `Tháng ${m}: Thời tiết bình thường`;

                  if (isBest) {
                    bg = '#059669';
                    color = '#fff';
                    tooltip = `Tháng ${m}: Mùa vàng lý tưởng, nắng đẹp, ít mưa`;
                  }
                  if (isAvoid) {
                    bg = '#dc2626';
                    color = '#fff';
                    tooltip = `Tháng ${m}: Mưa lớn, nguy cơ sạt lở & trơn trượt`;
                  }

                  return (
                    <div
                      key={m}
                      title={tooltip}
                      style={{
                        background: bg,
                        color,
                        padding: '10px 2px',
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        border: isCurrent ? '2px solid var(--color-sun)' : '1px solid transparent',
                        boxShadow: isCurrent ? '0 0 10px rgba(250, 204, 21, 0.6)' : 'none',
                        cursor: 'help',
                      }}
                    >
                      <div>T{m}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div>
            {/* P2-5: Permit & Ranger Note Alert */}
            <div
              className="card"
              style={{
                border: `1px solid ${trail.permitRequired ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                marginBottom: 20,
              }}
            >
              <h4
                style={{
                  color: trail.permitRequired ? 'var(--color-error)' : 'var(--color-primary)',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                {trail.permitRequired ? 'Yêu cầu Giấy phép VQG' : 'Tự do trekking'}
              </h4>

              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
                {trail.permitRequired
                  ? trail.permitInfo || 'Cần đăng ký danh sách thông tin đoàn và nộp phí bảo tồn với Trạm Kiểm Lâm trước khi trekking.'
                  : 'Cung đường mở tự do, không yêu cầu giấy phép xin trước.'}
              </p>

              {trail.permitRequired && (
                <div style={{ background: 'var(--color-bg-main)', padding: 10, borderRadius: 8, fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>- Đăng ký CCCD/CMND các thành viên</div>
                  <div>- Nộp phí vé tham quan Vườn Quốc Gia</div>
                  <div>- Bắt buộc có Porter/HDV địa phương dẫn đường</div>
                </div>
              )}
            </div>

            {/* Local Rescue & Ranger Contact */}
            <div className="card" style={{ border: '1px solid rgba(239, 68, 68, 0.4)' }}>
              <h4 style={{ color: 'var(--color-error)', fontSize: '1.05rem', fontWeight: 700, marginBottom: 12 }}>
                Hotline Cứu hộ địa phương
              </h4>
              <div style={{ fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ color: 'var(--color-text-dim)', fontSize: '0.75rem' }}>Đội cứu hộ khu vực:</div>
                  <strong style={{ color: 'var(--color-text-main)' }}>{trail.rescueContact?.name || 'Cứu hộ 114'}</strong>
                  <div>
                    <a href={`tel:${trail.rescueContact?.phone || '114'}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 700 }}>
                      SĐT: {trail.rescueContact?.phone || '114'}
                    </a>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                  <div style={{ color: 'var(--color-text-dim)', fontSize: '0.75rem' }}>Trạm kiểm lâm:</div>
                  <div style={{ color: 'var(--color-text-muted)' }}>{trail.rescueContact?.rangerContact || 'Trạm Kiểm Lâm Cửa Rừng'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MAP & LIVE GPS */}
      {activeTab === 'map' && (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--color-text-main)', fontWeight: 700 }}>
              Bản đồ GPS Tuyến đường & Live GPS Tracking
            </h3>
          </div>

          <MapView trails={[trail]} selectedTrail={trail} height="550px" />

          <div style={{ marginTop: 24 }}>
            <h4 style={{ fontSize: '1.1rem', color: 'var(--color-text-main)', marginBottom: 12 }}>Danh sách điểm mốc (Waypoints)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {trail.waypoints?.map((wp) => (
                <div key={wp.id} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <strong style={{ color: 'var(--color-primary)', fontSize: '0.95rem' }}>{wp.name}</strong>
                    <span className="badge badge-cloud">{wp.type}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{wp.description}</p>
                  {wp.elevationM && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', marginTop: 6 }}>
                      Cao độ: {wp.elevationM}m
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: WEATHER & CLOUD HUNTING */}
      {activeTab === 'weather' && <WeatherTab trail={trail} />}

      {/* TAB 4: GEAR CHECKLIST & BALO CALCULATOR */}
      {activeTab === 'checklist' && <GearChecklistTab trail={trail} />}

      {/* TAB 5: EXPEDITION TIMELINE & SHARE */}
      {activeTab === 'itinerary' && <ItineraryTab trail={trail} />}

      {/* TAB 6: GUIDES & PORTERS */}
      {activeTab === 'guides' && (
        <div>
          <h3 style={{ fontSize: '1.2rem', color: 'var(--color-text-main)', fontWeight: 700, marginBottom: 16 }}>
            Hướng dẫn viên & Porter địa phương uy tín
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {(guidesList.length > 0 ? guidesList : trail.guides || []).map((guide) => (
              <div key={guide.id || guide._id} className="card" style={{ border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h4 style={{ fontSize: '1rem', color: 'var(--color-text-main)', fontWeight: 700 }}>{guide.name}</h4>
                  {guide.verified ? (
                    <span className="badge badge-success" style={{ background: '#10b981', color: '#fff', fontSize: '0.75rem', padding: '3px 10px', borderRadius: 12 }}>
                      Đã Xác Minh
                    </span>
                  ) : (
                    <span className="badge badge-cloud" style={{ fontSize: '0.75rem' }}>Porter Địa Phương</span>
                  )}
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>
                  Khu vực phụ trách: {guide.region} • Đánh giá: {guide.rating || 5.0}/5
                </div>

                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 10, borderRadius: 8, fontSize: '0.8rem', color: 'var(--color-primary)', marginBottom: 16, fontWeight: 600 }}>
                  Chi phí / Giá dịch vụ: {guide.priceNote || '500,000đ - 700,000đ / ngày'}
                </div>

                <a
                  href={`tel:${guide.phone || '0988888888'}`}
                  className="btn btn-outline"
                  style={{ width: '100%', justifyContent: 'center', borderRadius: 8, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <IconPhone size={14} color="var(--color-primary)" />
                  Liên hệ trực tiếp
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: TRAIL CONDITIONS (REAL-TIME) */}
      {activeTab === 'conditions' && (
        <div style={{ marginTop: 24 }}>
          <TrailConditionSection trailId={trail.id} />
        </div>
      )}

      {/* TAB 7: COMMUNITY REVIEWS */}
      {activeTab === 'reviews' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 28 }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--color-text-main)', fontWeight: 700, marginBottom: 16 }}>
              Cộng đồng Đánh giá ({reviewsList.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {reviewsList.map((rev) => (
                <div key={rev.id} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img
                        src={rev.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
                        alt={rev.userName}
                        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div>
                        <strong style={{ color: 'var(--color-text-main)', fontSize: '0.95rem' }}>{rev.userName}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>Ngày đi: {rev.tripDate}</div>
                      </div>
                    </div>

                    <div style={{ color: 'var(--color-sun)', fontWeight: 700, fontSize: '0.9rem' }}>
                      Đánh giá: {rev.rating}/5
                    </div>
                  </div>

                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 10 }}>
                    {rev.content}
                  </p>

                  {rev.safetyNote && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.12)', borderLeft: '4px solid #ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px 14px', fontSize: '0.85rem', color: '#fca5a5', borderRadius: 8, marginTop: 8 }}>
                      <strong style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <IconAlertTriangle size={15} color="#ef4444" />
                        CẢNH BÁO AN TOÀN TỪ TREKKER:
                      </strong>
                      {rev.safetyNote}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ height: 'fit-content' }}>
            <h4 style={{ fontSize: '1.1rem', color: 'var(--color-text-main)', fontWeight: 700, marginBottom: 14 }}>
              Gửi đánh giá chuyến đi
            </h4>

            <form onSubmit={handleReviewSubmit}>
              <div className="form-group">
                <label className="form-label">Đánh giá chung (1 - 5 sao)</label>
                <select className="form-select" value={newRating} onChange={(e) => setNewRating(Number(e.target.value))}>
                  <option value={5}>5 sao - Tuyệt vời</option>
                  <option value={4}>4 sao - Rất tốt</option>
                  <option value={3}>3 sao - Trung bình</option>
                  <option value={2}>2 sao - Khó</option>
                  <option value={1}>1 sao - Nguy hiểm</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Đánh giá độ khó thực tế (1 - 5)</label>
                <select className="form-select" value={newDiffRating} onChange={(e) => setNewDiffRating(Number(e.target.value))}>
                  <option value={1}>1/5 - Rất dễ</option>
                  <option value={2}>2/5 - Dễ</option>
                  <option value={3}>3/5 - Trung bình</option>
                  <option value={4}>4/5 - Khó</option>
                  <option value={5}>5/5 - Cực khó</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Cảm nhận chi tiết chuyến đi</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Chia sẻ về tình trạng đường xá, cảnh đẹp, lán nghỉ..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Cảnh báo an toàn (nếu có)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Đoạn qua suối trơn, trạm 2800m hết nước..."
                  value={newSafetyNote}
                  onChange={(e) => setNewSafetyNote(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Gửi đánh giá cho cộng đồng
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
