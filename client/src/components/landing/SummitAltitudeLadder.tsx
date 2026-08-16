import React, { useState, useMemo } from 'react';
import type { Trail } from '../../types.js';
import {
  IconMountain,
  IconCheckCircle,
  IconRadar,
  IconMapPin,
} from '../common/SvgIcons.js';

interface SummitAltitudeLadderProps {
  trails: Trail[];
  onSelectTrail?: (trail: Trail) => void;
  onExploreSummit?: (summitName: string) => void;
}

interface SummitItem {
  rank: number;
  name: string;
  altitudeM: number;
  province: string;
  difficulty: string;
  duration: string;
  bestSeason: string;
  highlights: string;
  trailMatchId?: string;
  hasGpx: boolean;
}

const TOP_10_SUMMITS: SummitItem[] = [
  { rank: 1, name: 'Fansipan', altitudeM: 3143, province: 'Lào Cai - Lai Châu', difficulty: 'Trung bình - Khó', duration: '2N1Đ', bestSeason: 'T9 - T4', highlights: 'Nóc nhà Đông Dương, cảnh quan rừng đỗ quyên', hasGpx: true },
  { rank: 2, name: 'Pu Ta Leng', altitudeM: 3049, province: 'Lai Châu', difficulty: 'Rất Khó', duration: '3N2Đ', bestSeason: 'T11 - T3', highlights: 'Thủ phủ đỗ quyên cổ thụ, rừng trúc ma mị, dốc gắt', hasGpx: true },
  { rank: 3, name: 'Ky Quan San (Bạch Mộc Lương Tử)', altitudeM: 3046, province: 'Lào Cai - Lai Châu', difficulty: 'Khó', duration: '3N2Đ', bestSeason: 'T10 - T4', highlights: 'Đồi Muối săn mây huyền thoại, sống lưng sống ảo', hasGpx: true },
  { rank: 4, name: 'Khang Su Văn', altitudeM: 3012, province: 'Lai Châu', difficulty: 'Khó', duration: '2N1Đ / 3N2Đ', bestSeason: 'T10 - T3', highlights: 'Cột mốc biên giới 79 cao nhất Việt Nam, rừng thảo quả', hasGpx: true },
  { rank: 5, name: 'Tả Liên Sơn (Cổ Trâu)', altitudeM: 2996, province: 'Lai Châu', difficulty: 'Trung bình', duration: '2N1Đ', bestSeason: 'T9 - T4', highlights: 'Khu rừng cổ tích rêu phong ma mị, rừng lá phong đỏ', hasGpx: true },
  { rank: 6, name: 'Tà Chì Nhù (Phu Song Sung)', altitudeM: 2979, province: 'Yên Bái', difficulty: 'Trung bình - Khó', duration: '2N1Đ', bestSeason: 'T9 - T11', highlights: 'Đồi hoa tím Chi Pâu đại ngàn, mỏ khoáng nóng Trạm Tấu', hasGpx: true },
  { rank: 7, name: 'Pờ Ma Lung', altitudeM: 2967, province: 'Lai Châu', difficulty: 'Rất Khó', duration: '3N2Đ', bestSeason: 'T10 - T4', highlights: 'Thác nước Rồng kỳ vĩ, vách đá dựng đứng cheo leo', hasGpx: true },
  { rank: 8, name: 'Nhìu Cồ San', altitudeM: 2965, province: 'Lào Cai', difficulty: 'Khó', duration: '2N1Đ', bestSeason: 'T10 - T3', highlights: 'Đường đá cổ Pavi thời Pháp, thác Ong Chúa tuyệt đẹp', hasGpx: true },
  { rank: 9, name: 'Chung Nhía Vũ', altitudeM: 2918, province: 'Lai Châu', difficulty: 'Trung bình - Khó', duration: '2N1Đ', bestSeason: 'T10 - T4', highlights: 'Mốc biên giới 83, suối nguồn hoang sơ thanh tịnh', hasGpx: true },
  { rank: 10, name: 'Lảo Thẩn', altitudeM: 2860, province: 'Lào Cai', difficulty: 'Dễ - Trung bình', duration: '2N1Đ', bestSeason: 'T9 - T5', highlights: 'Nóc nhà Y Tý, thiên đường săn mây số 1 Tây Bắc', hasGpx: true },
];

export const SummitAltitudeLadder: React.FC<SummitAltitudeLadderProps> = ({
  trails,
  onSelectTrail,
}) => {
  const [selectedRank, setSelectedRank] = useState<number>(1);

  // Link summits with real database trails by name matching
  const summitsWithDb = useMemo(() => {
    return TOP_10_SUMMITS.map((summit) => {
      const matched = trails.find((t) =>
        t.name.toLowerCase().includes(summit.name.toLowerCase()) ||
        summit.name.toLowerCase().includes(t.name.toLowerCase())
      );
      return {
        ...summit,
        dbTrail: matched || null,
        actualAltitude: matched?.maxAltitudeM || summit.altitudeM,
      };
    });
  }, [trails]);

  const selectedSummit = summitsWithDb.find((s) => s.rank === selectedRank) || summitsWithDb[0];

  return (
    <section
      style={{
        padding: '50px 24px',
        maxWidth: 1280,
        margin: '0 auto',
      }}
    >
      {/* Section Header */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 14px',
            borderRadius: 20,
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 800,
            color: 'var(--color-sun)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 12,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <IconMountain size={16} color="var(--color-sun)" />
          Thang Bậc Cao Độ Việt Nam
        </div>

        <h2
          style={{
            fontSize: 'clamp(1.6rem, 3.2vw, 2.4rem)',
            fontWeight: 900,
            color: 'var(--color-text-main)',
            marginBottom: 10,
          }}
        >
          Top 10 Đỉnh Núi Cao Nhất Việt Nam
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', maxWidth: 650, margin: '0 auto' }}>
          Hồ sơ độ cao chuẩn xác, phân cấp độ khó, thời lượng cung đường và tình trạng dữ liệu tracklog GPS.
        </p>
      </div>

      {/* Main Container Layout */}
      <div
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 24,
          padding: '28px',
          boxShadow: 'var(--shadow-card)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 28,
        }}
      >
        {/* Left Side: 10-Summit Ranking List */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
              Xếp Hạng Đỉnh Núi
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700 }}>
              Chọn đỉnh để xem chi tiết tuyến đường ➔
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {summitsWithDb.map((s) => {
              const isSelected = s.rank === selectedRank;
              const altitudeProgress = ((s.actualAltitude - 2800) / (3143 - 2800)) * 100;

              return (
                <div
                  key={s.rank}
                  onClick={() => setSelectedRank(s.rank)}
                  className="interactive-click ripple-fx"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 14,
                    border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                    background: isSelected ? 'rgba(5, 150, 105, 0.12)' : 'var(--color-bg-main)',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: isSelected ? '0 0 16px rgba(5, 150, 105, 0.2)' : 'none',
                  }}
                >
                  {/* Subtle Altitude Background Indicator */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${altitudeProgress}%`,
                      background: isSelected ? 'rgba(5, 150, 105, 0.08)' : 'transparent',
                      pointerEvents: 'none',
                    }}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: isSelected ? 'var(--color-primary)' : 'var(--color-bg-card)',
                        color: isSelected ? '#ffffff' : 'var(--color-text-dim)',
                        fontSize: '0.75rem',
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      {s.rank}
                    </span>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: '0.88rem', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                          {s.name}
                        </strong>
                        {s.dbTrail && (
                          <span title="Dữ liệu GPX đã xác thực trong hệ thống TrekMap">
                            <IconCheckCircle size={13} color="var(--color-primary)" />
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)' }}>
                        {s.province}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 900, color: 'var(--color-sun)', fontFamily: 'monospace' }}>
                      {s.actualAltitude}m
                    </div>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: s.difficulty.includes('Rất Khó')
                          ? 'rgba(239, 68, 68, 0.15)'
                          : s.difficulty.includes('Khó')
                          ? 'rgba(249, 115, 22, 0.15)'
                          : 'rgba(5, 150, 105, 0.15)',
                        color: s.difficulty.includes('Rất Khó')
                          ? 'var(--color-error)'
                          : s.difficulty.includes('Khó')
                          ? 'var(--color-earth)'
                          : 'var(--color-primary)',
                      }}
                    >
                      {s.difficulty}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Selected Summit Detailed Deep Dive Card */}
        <div
          style={{
            background: 'var(--color-bg-main)',
            border: '1px solid var(--color-border)',
            borderRadius: 20,
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      background: 'rgba(234, 179, 8, 0.15)',
                      color: 'var(--color-sun)',
                      fontWeight: 900,
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: 6,
                    }}
                  >
                    Top #{selectedSummit.rank}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>
                    {selectedSummit.province}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--color-text-main)' }}>
                  {selectedSummit.name}
                </h3>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--color-sun)', fontFamily: 'monospace' }}>
                  {selectedSummit.actualAltitude}m
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)' }}>
                  Độ cao đỉnh
                </span>
              </div>
            </div>

            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: 20 }}>
              {selectedSummit.highlights}
            </p>

            {/* Quick Metrics Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                marginBottom: 20,
              }}
            >
              <div style={{ background: 'var(--color-bg-card)', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>Độ Khó</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 2 }}>
                  {selectedSummit.difficulty}
                </div>
              </div>

              <div style={{ background: 'var(--color-bg-card)', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>Thời Gian</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-sky)', marginTop: 2 }}>
                  {selectedSummit.duration}
                </div>
              </div>

              <div style={{ background: 'var(--color-bg-card)', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>Mùa Đẹp Nhất</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-earth)', marginTop: 2 }}>
                  {selectedSummit.bestSeason}
                </div>
              </div>
            </div>

            {/* Database Linked Route Details */}
            {selectedSummit.dbTrail ? (
              <div
                style={{
                  background: 'rgba(5, 150, 105, 0.08)',
                  border: '1px solid var(--color-border-glow)',
                  borderRadius: 14,
                  padding: '12px 16px',
                  marginBottom: 20,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-primary)', marginBottom: 4 }}>
                  <IconCheckCircle size={14} color="var(--color-primary)" />
                  Tuyến GPX Thực Tế Có Sẵn: {selectedSummit.dbTrail.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Chiều dài: {selectedSummit.dbTrail.distanceKm} km • Điểm xuất phát: {(selectedSummit.dbTrail as any).startLocation || selectedSummit.dbTrail.province || 'Trạm Tôn / Bản làng'}
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 14,
                  padding: '12px 16px',
                  marginBottom: 20,
                  fontSize: '0.75rem',
                  color: 'var(--color-text-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <IconRadar size={16} color="var(--color-sky)" />
                Cộng đồng đang tiếp tục cập nhật thêm các biến thể tracklog cho đỉnh núi này.
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (selectedSummit.dbTrail && onSelectTrail) {
                onSelectTrail(selectedSummit.dbTrail);
              }
            }}
            className="btn btn-primary"
            style={{
              width: '100%',
              borderRadius: 14,
              padding: '12px',
              fontSize: '0.85rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <IconMapPin size={16} color="#ffffff" />
            Xem Bản Đồ 3D & Lịch Trình {selectedSummit.name} ➔
          </button>
        </div>
      </div>
    </section>
  );
};
