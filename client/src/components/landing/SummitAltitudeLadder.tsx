import React, { useState, useMemo } from 'react';
import type { Trail } from '../../types.js';
import {
  IconMountain,
  IconCheckCircle,
  IconRadar,
  IconMapPin,
  IconCompass,
  IconTrees,
  IconFlame,
} from '../common/SvgIcons.js';

interface SummitAltitudeLadderProps {
  trails: Trail[];
  onSelectTrail?: (trail: Trail) => void;
  onExploreSummit?: (summitName: string) => void;
}

interface SummitItem {
  rank: number;
  name: string;
  matchKey: string;
  altitudeM: number;
  province: string;
  mountainRange: string;
  difficulty: string;
  duration: string;
  bestSeason: string;
  highlights: string;
  permitInfo: string;
  imageUrl: string;
  coordinates: { lat: number; lng: number };
  milestones: string[];
}

const TOP_10_SUMMITS: SummitItem[] = [
  {
    rank: 1,
    name: 'Fansipan',
    matchKey: 'fansipan',
    altitudeM: 3143,
    province: 'Lào Cai – Lai Châu',
    mountainRange: 'Dãy Hoàng Liên Sơn',
    difficulty: 'Trung bình – Khó',
    duration: '2N1Đ',
    bestSeason: 'T9 – T4',
    highlights: 'Nóc nhà Đông Dương 3.143m, đỉnh núi cao nhất toàn cõi Việt Nam và bán đảo Đông Dương với rừng trúc đỗ quyên bạt ngàn.',
    permitInfo: 'VQG Hoàng Liên',
    imageUrl: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329097/trekmap/trails/trail_cover_trail-fansipan.jpg',
    coordinates: { lat: 22.3032, lng: 103.7753 },
    milestones: ['Trạm Tôn (1.900m)', 'Lán 2 (2.800m)', 'Đỉnh Fansipan (3.143m)'],
  },
  {
    rank: 2,
    name: 'Pu Ta Leng',
    matchKey: 'leng',
    altitudeM: 3049,
    province: 'Lai Châu',
    mountainRange: 'Dãy Hoàng Liên Sơn',
    difficulty: 'Rất Khó',
    duration: '3N2Đ',
    bestSeason: 'T11 – T3',
    highlights: 'Đỉnh núi cao thứ 2 Việt Nam 3.049m, thủ phủ hoa đỗ quyên cổ thụ đại ngàn và rừng trúc rêu phong ma mị với vách đá cheo leo.',
    permitInfo: 'Huyện Tam Đường',
    imageUrl: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80',
    coordinates: { lat: 22.4247, lng: 103.6019 },
    milestones: ['Bản Pho (1.100m)', 'Lán Đỗ Quyên (2.400m)', 'Đỉnh Pu Ta Leng (3.049m)'],
  },
  {
    rank: 3,
    name: 'Kỳ Quan San (Bạch Mộc)',
    matchKey: 'quan san',
    altitudeM: 3046,
    province: 'Lào Cai – Lai Châu',
    mountainRange: 'Dãy Kỳ Quan San',
    difficulty: 'Khó',
    duration: '3N2Đ',
    bestSeason: 'T10 – T4',
    highlights: 'Đỉnh núi cao thứ 3 Việt Nam 3.046m, nổi danh khắp giới xê dịch với sống lưng Đồi Muối 2.100m ngắm hoàng hôn và biển mây cuộn sóng.',
    permitInfo: 'Kiểm Lâm Bát Xát',
    imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    coordinates: { lat: 22.4981, lng: 103.5684 },
    milestones: ['Sàng Ma Sáo (1.050m)', 'Đồi Muối (2.100m)', 'Đỉnh Kỳ Quan San (3.046m)'],
  },
  {
    rank: 4,
    name: 'Khang Su Văn',
    matchKey: 'khang su',
    altitudeM: 3012,
    province: 'Lai Châu',
    mountainRange: 'Dãy Hoàng Liên Sơn',
    difficulty: 'Khó',
    duration: '2N1Đ / 3N2Đ',
    bestSeason: 'T10 – T3',
    highlights: 'Đỉnh núi cao thứ 4 Việt Nam 3.012m, nơi ngự trị cột mốc biên giới số 79 thiêng liêng cao nhất toàn bờ cõi Tổ quốc.',
    permitInfo: 'Đồn BP Vàng Ma Chải',
    imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    coordinates: { lat: 22.7533, lng: 103.3512 },
    milestones: ['Dền Thàng (1.200m)', 'Lán Thảo Quả (2.200m)', 'Mốc 79 (3.012m)'],
  },
  {
    rank: 5,
    name: 'Tả Liên Sơn (Cổ Trâu)',
    matchKey: 'tả liên',
    altitudeM: 2996,
    province: 'Lai Châu',
    mountainRange: 'Khối Núi Tả Liên',
    difficulty: 'Trung bình',
    duration: '2N1Đ',
    bestSeason: 'T9 – T4',
    highlights: 'Đỉnh núi cao thứ 5 Việt Nam 2.996m, khu rừng cổ tích nguyên sinh rêu phong ma mị và thảm lá phong đỏ đẹp ngỡ ngàng.',
    permitInfo: 'UBND Xã Tả Lèng',
    imageUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80',
    coordinates: { lat: 22.5841, lng: 103.5462 },
    milestones: ['Bản Tả Lèng (1.100m)', 'Lán Rêu Phong (2.300m)', 'Đỉnh Tả Liên (2.996m)'],
  },
  {
    rank: 6,
    name: 'Tà Chì Nhù (Song Sung)',
    matchKey: 'chì nhù',
    altitudeM: 2979,
    province: 'Yên Bái',
    mountainRange: 'Khối Núi Trạm Tấu',
    difficulty: 'Trung bình – Khó',
    duration: '2N1Đ',
    bestSeason: 'T9 – T11',
    highlights: 'Đỉnh núi cao thứ 6 Việt Nam 2.979m, vương quốc hoa tím Chi Pâu đại ngàn và thảo nguyên săn mây đón gió lộng Trạm Tấu.',
    permitInfo: 'UBND Huyện Trạm Tấu',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    coordinates: { lat: 21.5714, lng: 104.3125 },
    milestones: ['Mỏ Chì Xà Hồ (1.200m)', 'Lán Ngựa (2.400m)', 'Đồi Hoa Chi Pâu (2.979m)'],
  },
  {
    rank: 7,
    name: 'Pờ Ma Lung',
    matchKey: 'ma lung',
    altitudeM: 2967,
    province: 'Lai Châu',
    mountainRange: 'Dãy Hoàng Liên Sơn',
    difficulty: 'Rất Khó',
    duration: '3N2Đ',
    bestSeason: 'T10 – T4',
    highlights: 'Đỉnh núi cao thứ 7 Việt Nam 2.967m, cung đường vượt thác Rồng hùng vĩ, vách đá dựng đứng cheo leo thử thách bản lĩnh.',
    permitInfo: 'Đồn BP Bản Lang',
    imageUrl: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=1200&q=80',
    coordinates: { lat: 22.6125, lng: 103.4912 },
    milestones: ['Bản Lang (900m)', 'Thác Rồng (1.800m)', 'Đỉnh Pờ Ma Lung (2.967m)'],
  },
  {
    rank: 8,
    name: 'Nhìu Cồ San',
    matchKey: 'nhìu cồ',
    altitudeM: 2965,
    province: 'Lào Cai',
    mountainRange: 'Dãy Nhìu Cồ San',
    difficulty: 'Khó',
    duration: '2N1Đ',
    bestSeason: 'T10 – T3',
    highlights: 'Đỉnh núi cao thứ 8 Việt Nam 2.965m, con đường đá cổ Pavi lịch sử thời Pháp và ngọn thác Ong Chúa lộng lẫy giữa đại ngàn.',
    permitInfo: 'Kiểm Lâm Sàng Ma Sáo',
    imageUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
    coordinates: { lat: 22.5982, lng: 103.5821 },
    milestones: ['Bản Nhìu Cồ (1.400m)', 'Thác Ong Chúa (2.100m)', 'Đỉnh Nhìu Cồ (2.965m)'],
  },
  {
    rank: 9,
    name: 'Chung Nhía Vũ',
    matchKey: 'chung nhía',
    altitudeM: 2918,
    province: 'Lai Châu',
    mountainRange: 'Dãy Hoàng Liên Sơn',
    difficulty: 'Trung bình – Khó',
    duration: '2N1Đ',
    bestSeason: 'T10 – T4',
    highlights: 'Đỉnh núi cao thứ 9 Việt Nam 2.918m, mốc biên giới số 83 canh giữ phên giậu biên cương, suối nguồn hoang sơ thanh tịnh.',
    permitInfo: 'Đồn BP Nậm Xe',
    imageUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80',
    coordinates: { lat: 22.6841, lng: 103.4125 },
    milestones: ['Bản Nậm Xe (1.000m)', 'Suối Trúc (2.100m)', 'Mốc 83 (2.918m)'],
  },
  {
    rank: 10,
    name: 'Lảo Thẩn',
    matchKey: 'lảo thẩn',
    altitudeM: 2860,
    province: 'Lào Cai',
    mountainRange: 'Cao Nguyên Y Tý',
    difficulty: 'Dễ – Trung bình',
    duration: '2N1Đ',
    bestSeason: 'T9 – T5',
    highlights: 'Nóc nhà Y Tý 2.860m, triền đồi cỏ mây êm đềm bồng bềnh, cung đường trekking săn mây số 1 dành cho người mới bắt đầu.',
    permitInfo: 'UBND Xã Y Tý',
    imageUrl: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329103/trekmap/trails/trail_cover_trail-laothan.jpg',
    coordinates: { lat: 22.551, lng: 103.608 },
    milestones: ['Trang Trại Y Tý (1.800m)', 'Lán A Chơ 2.400m', 'Đỉnh Lảo Thẩn (2.860m)'],
  },
];

export const SummitAltitudeLadder: React.FC<SummitAltitudeLadderProps> = ({
  trails,
  onSelectTrail,
}) => {
  const [selectedRank, setSelectedRank] = useState<number>(1);

  // Link summits with real database trails by exact keyword matching
  const summitsWithDb = useMemo(() => {
    const list = Array.isArray(trails) ? trails : [];
    return TOP_10_SUMMITS.map((summit) => {
      const matchKey = summit.matchKey.toLowerCase();
      const matched = list.find((t) => {
        if (!t || !t.name || t.name.trim().length < 4) return false;
        const tName = t.name.toLowerCase();
        const altNames = Array.isArray(t.altNames) ? t.altNames.map((a) => (a || '').toLowerCase()) : [];
        return tName.includes(matchKey) || altNames.some((a) => a.includes(matchKey));
      });
      return {
        ...summit,
        dbTrail: matched || null,
        actualAltitude: summit.altitudeM, // Authoritative exact elevation
      };
    });
  }, [trails]);

  const selectedSummit = summitsWithDb.find((s) => s.rank === selectedRank) || summitsWithDb[0];

  return (
    <section
      style={{
        padding: '24px 0 32px 0',
        maxWidth: 1320,
        margin: '0 auto',
      }}
    >
      {/* Section Header - Compact */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 12px',
            borderRadius: 16,
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            fontSize: '0.72rem',
            fontWeight: 800,
            color: 'var(--color-sun)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 6,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <IconMountain size={14} color="var(--color-sun)" />
          THANG BẬC CAO ĐỘ VIỆT NAM
        </div>

        <h2
          style={{
            fontSize: 'clamp(1.3rem, 2.4vw, 1.75rem)',
            fontWeight: 900,
            color: 'var(--color-text-main)',
            margin: '0 0 4px 0',
            letterSpacing: '-0.02em',
          }}
        >
          Top 10 Đỉnh Núi Cao Nhất Việt Nam
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.84rem', maxWidth: 580, margin: '0 auto' }}>
          Hồ sơ cao độ thực địa chuẩn xác 100%, phân cấp độ khó và dữ liệu GPS.
        </p>
      </div>

      {/* Main Container Layout - Space-Efficient Screen-Fit Grid */}
      <div
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 18,
          padding: '16px 18px',
          boxShadow: 'var(--shadow-card)',
          display: 'grid',
          gridTemplateColumns: 'minmax(300px, 38%) minmax(360px, 62%)',
          gap: 16,
          backdropFilter: 'blur(16px)',
          alignItems: 'stretch',
        }}
      >
        {/* Left Side: 10-Summit Ranking List (Compact rows) */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              XẾP HẠNG ĐỈNH NÚI
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {summitsWithDb.map((s) => {
              const isSelected = s.rank === selectedRank;
              const altitudeProgress = Math.max(5, Math.min(100, ((s.actualAltitude - 2800) / (3143 - 2800)) * 100));

              return (
                <div
                  key={s.rank}
                  onClick={() => setSelectedRank(s.rank)}
                  className="interactive-click"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4.5px 10px',
                    borderRadius: 9,
                    border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                    background: isSelected ? 'rgba(5, 150, 105, 0.14)' : 'var(--color-bg-main)',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.12s ease',
                    boxShadow: isSelected ? '0 0 12px rgba(5, 150, 105, 0.2)' : 'none',
                  }}
                >
                  {/* Subtle Altitude Background Progress Bar */}
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 1 }}>
                    <span
                      style={{
                        width: 19,
                        height: 19,
                        borderRadius: 5,
                        background: isSelected ? 'var(--color-primary)' : 'var(--color-bg-card)',
                        color: isSelected ? '#041108' : 'var(--color-text-dim)',
                        fontSize: '0.68rem',
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--color-border)',
                        flexShrink: 0,
                      }}
                    >
                      {s.rank}
                    </span>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <strong style={{ fontSize: '0.8rem', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-main)', lineHeight: 1.2 }}>
                          {s.name}
                        </strong>
                        {s.dbTrail && (
                          <span title="Dữ liệu GPX đã xác thực trong hệ thống TrekMap">
                            <IconCheckCircle size={12} color="var(--color-primary)" />
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)', lineHeight: 1.1 }}>
                        {s.province}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', position: 'relative', zIndex: 1, flexShrink: 0 }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 900, color: 'var(--color-sun)', fontFamily: 'monospace', lineHeight: 1.2 }}>
                      {s.actualAltitude}m
                    </div>
                    <span
                      style={{
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 3,
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

        {/* Right Side: Compact Mountain Showcase Card */}
        <div
          style={{
            background: 'var(--color-bg-main)',
            border: '1px solid var(--color-border)',
            borderRadius: 16,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div>
            {/* 1. Sleek Panoramic Banner */}
            <div
              style={{
                position: 'relative',
                height: 110,
                backgroundImage: `url(${selectedSummit.imageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '10px 14px',
              }}
            >
              {/* Scrim Overlay */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, rgba(7, 13, 30, 0.35) 0%, rgba(7, 13, 30, 0.94) 100%)',
                  pointerEvents: 'none',
                }}
              />

              {/* Top Tags */}
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    background: 'rgba(234, 179, 8, 0.95)',
                    color: '#041108',
                    fontWeight: 900,
                    fontSize: '0.68rem',
                    padding: '2px 8px',
                    borderRadius: 12,
                  }}
                >
                  TOP #{selectedSummit.rank} ĐỈNH NÚI
                </span>

                <div
                  style={{
                    background: 'rgba(7, 13, 30, 0.75)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 10,
                    padding: '2px 8px',
                    fontSize: '0.68rem',
                    color: 'var(--color-sky)',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <IconCompass size={12} color="var(--color-sky)" />
                  {selectedSummit.coordinates.lat}° N, {selectedSummit.coordinates.lng}° E
                </div>
              </div>

              {/* Bottom Title in Banner */}
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    {selectedSummit.mountainRange} • {selectedSummit.province}
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                    {selectedSummit.name}
                  </h3>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.28rem', fontWeight: 900, color: 'var(--color-sun)', fontFamily: 'monospace', textShadow: '0 2px 8px rgba(0,0,0,0.8)', lineHeight: 1.1 }}>
                    {selectedSummit.actualAltitude}m
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                    Độ cao thực địa
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Body Details (Space-Optimized) */}
            <div style={{ padding: '12px 14px 0 14px' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', lineHeight: 1.45, margin: '0 0 10px 0' }}>
                {selectedSummit.highlights}
              </p>

              {/* 4-Metric Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                <div style={{ background: 'var(--color-bg-card)', padding: '5px 6px', borderRadius: 8, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.62rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>Độ Khó</div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 1 }}>
                    {selectedSummit.difficulty}
                  </div>
                </div>

                <div style={{ background: 'var(--color-bg-card)', padding: '5px 6px', borderRadius: 8, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.62rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>Thời Lượng</div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-sky)', marginTop: 1 }}>
                    {selectedSummit.duration}
                  </div>
                </div>

                <div style={{ background: 'var(--color-bg-card)', padding: '5px 6px', borderRadius: 8, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.62rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>Mùa Đẹp</div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-earth)', marginTop: 1 }}>
                    {selectedSummit.bestSeason}
                  </div>
                </div>

                <div style={{ background: 'var(--color-bg-card)', padding: '5px 6px', borderRadius: 8, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.62rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>Thủ Tục</div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-sun)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selectedSummit.permitInfo}>
                    {selectedSummit.permitInfo.split(',')[0]}
                  </div>
                </div>
              </div>

              {/* 3. Trekking Milestones Timeline */}
              <div
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 9,
                  padding: '7px 10px',
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: '0.64rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.03em' }}>
                  LỘ TRÌNH CỘT MỐC TIÊU BIỂU
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  {selectedSummit.milestones.map((m, idx) => (
                    <React.Fragment key={idx}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: idx === 2 ? 'var(--color-sun)' : 'var(--color-text-main)', fontWeight: 700 }}>
                        {idx === 0 && <IconTrees size={11} color="var(--color-primary)" />}
                        {idx === 1 && <IconFlame size={11} color="var(--color-earth)" />}
                        {idx === 2 && <IconMountain size={11} color="var(--color-sun)" />}
                        <span>{m}</span>
                      </div>
                      {idx < selectedSummit.milestones.length - 1 && (
                        <span style={{ color: 'var(--color-border-glow)', fontSize: '0.68rem', fontWeight: 900 }}>➔</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* 4. Database Tracklog Status */}
              {selectedSummit.dbTrail && selectedSummit.dbTrail.name && selectedSummit.dbTrail.name.trim().length >= 4 ? (
                <div
                  style={{
                    background: 'rgba(5, 150, 105, 0.08)',
                    border: '1px solid var(--color-border-glow)',
                    borderRadius: 9,
                    padding: '7px 10px',
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-primary)', marginBottom: 1 }}>
                    <IconCheckCircle size={12} color="var(--color-primary)" />
                    Tuyến GPX Sẵn Sàng: {selectedSummit.dbTrail.name}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                    Chiều dài: {selectedSummit.dbTrail.distanceKm} km • Độ dốc: +{selectedSummit.dbTrail.elevationGainM || 1400}m
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 9,
                    padding: '7px 10px',
                    marginBottom: 12,
                    fontSize: '0.7rem',
                    color: 'var(--color-text-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <IconRadar size={13} color="var(--color-sky)" />
                  Ban Quản Trị đang đồng bộ tracklog GPS chi tiết cho đỉnh núi này.
                </div>
              )}
            </div>
          </div>

          {/* 5. Compact Bottom Action Button */}
          <div style={{ padding: '0 14px 14px 14px' }}>
            <button
              type="button"
              onClick={() => {
                if (selectedSummit.dbTrail && onSelectTrail) {
                  onSelectTrail(selectedSummit.dbTrail);
                }
              }}
              disabled={!selectedSummit.dbTrail}
              className="btn btn-primary interactive-click ripple-fx"
              style={{
                width: '100%',
                borderRadius: 10,
                padding: '9px 12px',
                fontSize: '0.82rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                opacity: selectedSummit.dbTrail ? 1 : 0.6,
                cursor: selectedSummit.dbTrail ? 'pointer' : 'default',
              }}
            >
              <IconMapPin size={15} color="#041108" />
              {selectedSummit.dbTrail ? `Xem Bản Đồ 3D & Lịch Trình ${selectedSummit.name} ➔` : `Chưa Có Tuyến GPX Riêng Cho ${selectedSummit.name}`}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
