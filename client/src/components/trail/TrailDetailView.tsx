import React, { useState } from 'react';
import type { Trail, Review } from '../../types.js';
import { MapView } from '../map/MapView.js';
import { submitReview } from '../../services/api.js';
import { OptimizedImage } from '../common/OptimizedImage.js';
import {
  ArrowLeft,
  Download,
  ShieldAlert,
  Phone,
  Star,
  Send,
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'map' | 'checklist' | 'guides' | 'reviews'>('overview');
  
  // Review form state
  const [newRating, setNewRating] = useState(5);
  const [newDiffRating, setNewDiffRating] = useState(3);
  const [newContent, setNewContent] = useState('');
  const [newSafetyNote, setNewSafetyNote] = useState('');
  const [reviewsList, setReviewsList] = useState<Review[]>(trail.reviews || []);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    try {
      const addedReview = await submitReview(trail.id, {
        rating: newRating,
        difficultyRating: newDiffRating,
        content: newContent,
        safetyNote: newSafetyNote,
      });

      setReviewsList([addedReview, ...reviewsList]);
      setNewContent('');
      setNewSafetyNote('');
      alert('Cảm ơn bạn đã gửi đánh giá cho cộng đồng!');
    } catch (err) {
      alert('Không thể gửi đánh giá, vui lòng thử lại sau.');
    }
  };

  const handleDownloadGPX = () => {
    const gpxData = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrekMap Vietnam">
  <trk>
    <name>${trail.name}</name>
    <trkseg>
      ${trail.gpxTrack.map(([lat, lng]) => `<trkpt lat="${lat}" lon="${lng}"></trkpt>`).join('\n')}
    </trkseg>
  </trk>
</gpx>`;
    const blob = new Blob([gpxData], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trail.id}-trekmap.gpx`;
    a.click();
  };

  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const autoGearList = [
    { item: 'Giày leo núi cổ cao chống trượt', req: true },
    { item: 'Balo có trợ lực (30L - 45L)', req: true },
    { item: 'Áo mưa bộ & bọc chống nước balo', req: true },
    { item: 'Đèn pin đội đầu + Pin dự phòng', req: true },
    { item: 'Túi ngủ chịu nhiệt (-5°C đến 10°C)', req: trail.durationDays >= 2 },
    { item: 'Gậy trekking chuyên dụng (1-2 chiếc)', req: trail.difficultyLevel >= 3 },
    { item: 'Túi sơ cứu y tế (Băng gạc, salonpas, thuốc đi ngoài)', req: true },
    { item: 'Bình lọc nước / Viên khử khuẩn nước suối', req: trail.hasWaterSource },
    { item: 'Thức ăn năng lượng (Lương khô, chocolate, điện giải)', req: true },
  ];

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button className="btn btn-outline" onClick={onBack}>
          <ArrowLeft size={16} /> Quay lại danh sách
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={handleDownloadGPX}>
            <Download size={16} /> Tải file GPX Offline
          </button>
          <button className="btn btn-danger" onClick={onOpenIncidentModal}>
            <ShieldAlert size={16} /> Báo sự cố khẩn
          </button>
        </div>
      </div>

      <div style={{
        position: 'relative',
        height: 380,
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 24,
        border: '1px solid rgba(14, 215, 181, 0.2)',
      }}>
        <OptimizedImage
          src={trail.coverImage}
          alt={trail.name}
          targetWidth={1200}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, #071319 15%, transparent 70%)',
        }} />

        <div style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          right: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 16,
        }}>
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-stream">{trail.region}</span>
              <span className="badge badge-cloud">{trail.province}</span>
              {trail.permitRequired && (
                <span className="badge badge-sun">Yêu cầu Giấy phép Vườn Quốc Gia</span>
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
            backdropFilter: 'blur(8px)',
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
                <Star size={20} fill="var(--color-sun)" /> {trail.rating} <span style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>({trail.reviewCount} bài)</span>
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

      <div className="card" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 16,
        marginBottom: 28,
        textAlign: 'center',
      }}>
        <div>
          <div style={{ color: 'var(--color-text-dim)', fontSize: '0.8rem' }}>Tổng chiều dài</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)' }}>{trail.distanceKm} km</div>
        </div>
        <div>
          <div style={{ color: 'var(--color-text-dim)', fontSize: '0.8rem' }}>Độ cao tích lũy</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-sky)' }}>+{trail.elevationGainM} m</div>
        </div>
        <div>
          <div style={{ color: 'var(--color-text-dim)', fontSize: '0.8rem' }}>Cao độ đỉnh lớn nhất</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-stream)' }}>{trail.maxAltitudeM} m</div>
        </div>
        <div>
          <div style={{ color: 'var(--color-text-dim)', fontSize: '0.8rem' }}>Thời gian trung bình</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-sun)' }}>{trail.durationHoursNote}</div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: 8,
        borderBottom: '1px solid var(--color-border)',
        marginBottom: 24,
        overflowX: 'auto',
      }}>
        {[
          { id: 'overview', label: 'Tổng quan & Kinh nghiệm' },
          { id: 'map', label: 'Bản đồ & Waypoints' },
          { id: 'checklist', label: 'Checklist đồ dùng' },
          { id: 'guides', label: 'Porter & Hướng dẫn viên' },
          { id: 'reviews', label: `Nhận xét (${reviewsList.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '12px 20px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid var(--color-primary)' : '3px solid transparent',
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: '0.95rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 28 }}>
          <div>
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 12 }}>
                Giới thiệu cung đường
              </h3>
              <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.7, fontSize: '0.95rem' }}>
                {trail.description}
              </p>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 12 }}>
                Hướng dẫn di chuyển đến điểm xuất phát
              </h3>
              <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.7, fontSize: '0.95rem' }}>
                {trail.transportationInfo}
              </p>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 8 }}>
                Lịch thời tiết theo tháng
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)', marginBottom: 16 }}>
                Xanh lá = Mùa đẹp nhất • Đỏ = Mùa mưa lũ hoặc sương mù trơn trượt
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 6, textAlign: 'center' }}>
                {months.map((m) => {
                  const isBest = trail.bestMonths.includes(m);
                  const isAvoid = trail.avoidMonths.includes(m);
                  let bg = '#142f3b';
                  let color = '#94a3b8';
                  if (isBest) { bg = '#059669'; color = '#fff'; }
                  if (isAvoid) { bg = '#dc2626'; color = '#fff'; }

                  return (
                    <div
                      key={m}
                      style={{
                        background: bg,
                        color,
                        padding: '10px 4px',
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: '0.85rem',
                      }}
                    >
                      T{m}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <div className="card" style={{ border: '1px solid rgba(239, 68, 68, 0.4)', marginBottom: 20 }}>
              <h4 style={{ color: 'var(--color-error)', fontSize: '1.05rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldAlert size={18} /> Liên hệ Cứu hộ địa phương
              </h4>
              <div style={{ fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ color: 'var(--color-text-dim)', fontSize: '0.75rem' }}>Đội cứu hộ khu vực:</div>
                  <strong style={{ color: 'var(--color-text-main)' }}>{trail.rescueContact.name}</strong>
                  <div>
                    <a href={`tel:${trail.rescueContact.phone}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 700 }}>
                      SĐT: {trail.rescueContact.phone}
                    </a>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                  <div style={{ color: 'var(--color-text-dim)', fontSize: '0.75rem' }}>Trạm kiểm lâm:</div>
                  <div style={{ color: 'var(--color-text-muted)' }}>{trail.rescueContact.rangerContact}</div>
                </div>
              </div>
            </div>

            <div className="card">
              <h4 style={{ color: 'var(--color-text-main)', fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>
                Lưu ý giấy phép & Thủ tục
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                {trail.permitRequired
                  ? trail.permitInfo || 'Cần đăng ký thông tin cá nhân với Vườn Quốc Gia trước khi trekking.'
                  : 'Cung đường tự do, không yêu cầu giấy phép kiểm lâm đặc biệt.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'map' && (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--color-text-main)', fontWeight: 700 }}>
              Bản đồ GPS Tuyến đường & Điểm dừng chân (Waypoints)
            </h3>
          </div>

          <MapView trails={[trail]} selectedTrail={trail} height="550px" />

          <div style={{ marginTop: 24 }}>
            <h4 style={{ fontSize: '1.1rem', color: 'var(--color-text-main)', marginBottom: 12 }}>Danh sách điểm mốc trên đường</h4>
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

      {activeTab === 'checklist' && (
        <div className="card" style={{ maxWidth: 800 }}>
          <h3 style={{ fontSize: '1.3rem', color: '#f0f9ff', fontWeight: 700, marginBottom: 8 }}>
            Checklist Đồ dùng chuẩn bị
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginBottom: 20 }}>
            Tự động gợi ý theo độ khó ({trail.difficultyLevel}/5), số ngày ({trail.durationDays} ngày) và đặc thù cung đường {trail.name}.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {autoGearList.map((g, idx) => (
              <label
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'var(--color-bg-main)',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer',
                }}
              >
                <input type="checkbox" defaultChecked={g.req} style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }} />
                <span style={{ fontSize: 'var(--font-size-sm)', color: g.req ? 'var(--color-text-main)' : 'var(--color-text-muted)', fontWeight: g.req ? 600 : 400 }}>
                  {g.item}
                </span>
                {g.req && <span className="badge badge-success" style={{ marginLeft: 'auto' }}>Bắt buộc</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'guides' && (
        <div>
          <h3 style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text-main)', fontWeight: 700, marginBottom: 16 }}>
            Hướng dẫn viên & Porter địa phương uy tín
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {trail.guides?.map((guide) => (
              <div key={guide.id} className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h4 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 700 }}>{guide.name}</h4>
                  {guide.verified && <span className="badge badge-success">Đã xác minh</span>}
                </div>

                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 12 }}>
                  Khu vực: {guide.region}
                </div>

                <div style={{ background: 'var(--color-bg-main)', padding: 10, borderRadius: 8, fontSize: 'var(--font-size-xs)', color: 'var(--color-earth)', marginBottom: 16 }}>
                  Giá tham khảo: {guide.priceNote}
                </div>

                <a
                  href={`tel:${guide.phone}`}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Phone size={16} /> Gọi liên hệ: {guide.phone}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

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
                    <div style={{ background: 'rgba(251, 191, 36, 0.1)', borderLeft: '3px solid var(--color-sun)', padding: '8px 12px', fontSize: '0.82rem', color: 'var(--color-sun)', borderRadius: 4 }}>
                      Ghi chú an toàn: {rev.safetyNote}
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
                <Send size={16} /> Gửi đánh giá cho cộng đồng
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
