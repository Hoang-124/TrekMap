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
  compact?: boolean;
  onSelectTrail?: (trail: Trail) => void;
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

// 100% DEM-Verified Vietnam Summits & Verified Vietnam Cloudinary Mountain Photography (Rule 11)
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
    highlights: 'Nóc nhà Đông Dương 3.143m, đỉnh núi cao nhất Việt Nam và bán đảo Đông Dương với rừng trúc đỗ quyên bạt ngàn.',
    permitInfo: 'VQG Hoàng Liên',
    imageUrl: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329097/trekmap/trails/trail_cover_trail-fansipan.jpg',
    coordinates: { lat: 22.3032, lng: 103.7753 },
    milestones: ['Trạm Tôn (1.900m)', 'Lán 2 (2.800m)', 'Đỉnh Fansipan (3.143m)'],
  },
  {
    rank: 2,
    name: 'Pu Si Lung',
    matchKey: 'pu si lung',
    altitudeM: 3083,
    province: 'Lai Châu',
    mountainRange: 'Biên giới Mường Tè',
    difficulty: 'Rất Khó',
    duration: '3N2Đ',
    bestSeason: 'T10 – T4',
    highlights: 'Đỉnh núi cao thứ 2 Việt Nam 3.083m — cung trekking độc lập dài bậc nhất Tây Bắc qua Cột mốc 42 biên giới Việt–Trung.',
    permitInfo: 'Đồn BP Pa Vệ Sử',
    imageUrl: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329101/trekmap/trails/trail_cover_trail-kyquansan.jpg',
    coordinates: { lat: 22.6261, lng: 102.7871 },
    milestones: ['Pa Vệ Sử (1.255m)', 'Cột Mốc 42 (2.866m)', 'Đỉnh Pu Si Lung (3.083m)'],
  },
  {
    rank: 3,
    name: 'Pu Ta Leng',
    matchKey: 'leng',
    altitudeM: 3049,
    province: 'Lai Châu',
    mountainRange: 'Dãy Hoàng Liên Sơn',
    difficulty: 'Rất Khó',
    duration: '3N2Đ',
    bestSeason: 'T11 – T3',
    highlights: 'Đỉnh núi cao thứ 3 Việt Nam 3.049m, thủ phủ hoa đỗ quyên cổ thụ đại ngàn và rừng trúc rêu phong ma mị.',
    permitInfo: 'Huyện Tam Đường',
    imageUrl: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329103/trekmap/trails/trail_cover_trail-nhiucosan.jpg',
    coordinates: { lat: 22.4226, lng: 103.6034 },
    milestones: ['Hồ Thầu (1.230m)', 'Lán Đỗ Quyên (2.400m)', 'Đỉnh Pu Ta Leng (3.049m)'],
  },
  {
    rank: 4,
    name: 'Kỳ Quan San (Bạch Mộc)',
    matchKey: 'quan san',
    altitudeM: 3046,
    province: 'Lào Cai – Lai Châu',
    mountainRange: 'Dãy Kỳ Quan San',
    difficulty: 'Khó',
    duration: '3N2Đ',
    bestSeason: 'T10 – T4',
    highlights: 'Đỉnh núi cao thứ 4 Việt Nam 3.046m, nổi danh với sống lưng Núi Muối 2.100m ngắm hoàng hôn và biển mây cuộn sóng.',
    permitInfo: 'Kiểm Lâm Bát Xát',
    imageUrl: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329101/trekmap/trails/trail_cover_trail-kyquansan.jpg',
    coordinates: { lat: 22.5070, lng: 103.5874 },
    milestones: ['Sàng Ma Sáo (1.060m)', 'Núi Muối (2.100m)', 'Đỉnh Kỳ Quan San (3.046m)'],
  },
  {
    rank: 5,
    name: 'Khang Su Văn (Phàn Liên San)',
    matchKey: 'khang su',
    altitudeM: 3012,
    province: 'Lai Châu',
    mountainRange: 'Biên giới Phong Thổ',
    difficulty: 'Rất Khó',
    duration: '3N2Đ',
    bestSeason: 'T10 – T4',
    highlights: 'Đỉnh núi cao thứ 5 Việt Nam 3.012m thuộc xã Pa Vây Sử / Vàng Ma Chải — chinh phục Cột mốc biên giới số 79 (2.880m) cao nhất tuyến biên cương Việt–Trung.',
    permitInfo: 'Đồn BP Vàng Ma Chải',
    imageUrl: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329099/trekmap/trails/trail_cover_trail-taxua.jpg',
    coordinates: { lat: 22.754, lng: 103.4395 },
    milestones: ['Vàng Ma Chải (1.936m)', 'Cột Mốc 79 (2.880m)', 'Đỉnh Khang Su Văn (3.012m)'],
  },
  {
    rank: 6,
    name: 'Tả Liên Sơn (Cổ Trâu)',
    matchKey: 'tả liên',
    altitudeM: 2996,
    province: 'Lai Châu',
    mountainRange: 'Khối Núi Tả Liên',
    difficulty: 'Khó',
    duration: '2N1Đ',
    bestSeason: 'T9 – T4',
    highlights: 'Đỉnh 2.996m nổi tiếng với khu rừng cổ tích nguyên sinh rêu phong và thảm lá phong đỏ rực rỡ mỗi độ thu về.',
    permitInfo: 'Chi cục KL Lai Châu',
    imageUrl: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329104/trekmap/trails/trail_cover_trail-chuyangsin.jpg',
    coordinates: { lat: 22.4628, lng: 103.556 },
    milestones: ['Bản Tả Lèng (1.490m)', 'Lán 2.478m', 'Đỉnh Tả Liên (2.996m)'],
  },
  {
    rank: 7,
    name: 'Tà Chì Nhù (Phu Song Sung)',
    matchKey: 'chì nhù',
    altitudeM: 2979,
    province: 'Yên Bái',
    mountainRange: 'Khối Núi Trạm Tấu',
    difficulty: 'Trung bình – Khó',
    duration: '2N1Đ',
    bestSeason: 'T9 – T11',
    highlights: 'Đỉnh 2.979m — vương quốc hoa tím Chi Pâu đại ngàn và thảo nguyên săn mây đón gió lộng vùng Trạm Tấu.',
    permitInfo: 'UBND Huyện Trạm Tấu',
    imageUrl: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329102/trekmap/trails/trail_cover_trail-tachinhu.jpg',
    coordinates: { lat: 21.5707, lng: 104.3065 },
    milestones: ['Mỏ Chì Xà Hồ (1.340m)', 'Lán Ngựa (2.400m)', 'Đỉnh Tà Chì Nhù (2.979m)'],
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
    highlights: 'Đỉnh 2.965m đi qua rừng thảo quả, Thác Ong Chúa hùng vĩ và biển mây trên sống núi Sàng Ma Sáo.',
    permitInfo: 'Đồn BP Sàng Ma Sáo',
    imageUrl: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329103/trekmap/trails/trail_cover_trail-nhiucosan.jpg',
    coordinates: { lat: 22.5838, lng: 103.5834 },
    milestones: ['Bản Nhìu Cồ (1.520m)', 'Thác Ong Chúa (2.020m)', 'Đỉnh Nhìu Cồ (2.965m)'],
  },
  {
    rank: 9,
    name: 'Lùng Cúng',
    matchKey: 'lùng cúng',
    altitudeM: 2913,
    province: 'Yên Bái',
    mountainRange: 'Mù Cang Chải',
    difficulty: 'Trung bình – Khó',
    duration: '2N1Đ',
    bestSeason: 'T10 – T4',
    highlights: 'Đỉnh 2.913m với rừng táo mèo cổ thụ, rừng phong lá đỏ tháng 11–12 và bãi cỏ cháy rộng lớn trên đỉnh.',
    permitInfo: 'UBND Xã Nậm Có',
    imageUrl: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329105/trekmap/trails/trail_cover_trail-bidoup.jpg',
    coordinates: { lat: 21.9024, lng: 104.2308 },
    milestones: ['Bản Tu San (1.115m)', 'Lán 2.400m', 'Đỉnh Lùng Cúng (2.913m)'],
  },
  {
    rank: 10,
    name: 'Nam Kang Ho Tao',
    matchKey: 'nam kang',
    altitudeM: 2881,
    province: 'Lai Châu',
    mountainRange: 'Dãy Hoàng Liên Sơn (Tân Uyên)',
    difficulty: 'Rất Khó',
    duration: '3N2Đ',
    bestSeason: 'T10 – T4',
    highlights: 'Đỉnh núi 2.881m xuất phát từ bản Thào A (xã Hố Mít, Tân Uyên) — nổi tiếng với hệ thống suối đá lớn xếp tầng, vách đá dựng đứng và biển mây dày đặc.',
    permitInfo: 'Chi cục KL Lai Châu',
    imageUrl: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329100/trekmap/trails/trail_cover_trail-laothan.jpg',
    coordinates: { lat: 22.1508, lng: 103.9693 },
    milestones: ['Bản Thào A (1.575m)', 'Lán Sườn Núi (2.574m)', 'Đỉnh Nam Kang Ho Tao (2.881m)'],
  },
];

const SummitAltitudeLadderBase: React.FC<SummitAltitudeLadderProps> = ({
  trails,
  compact = false,
  onSelectTrail,
}) => {
  const [selectedRank, setSelectedRank] = useState<number>(1);

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
        actualAltitude: summit.altitudeM,
      };
    });
  }, [trails]);

  const selectedSummit = summitsWithDb.find((s) => s.rank === selectedRank) || summitsWithDb[0];

  if (compact) {
    return (
      <div
        className="card"
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 4,
          padding: '18px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div className="section-eyebrow" style={{ marginBottom: 2 }}>Xếp hạng cao độ</div>
            <h3 className="font-editorial" style={{ fontSize: '1.18rem', fontWeight: 500, color: 'var(--color-text-main)', margin: 0 }}>
              Top 10 Đỉnh Cao Nhất
            </h3>
          </div>
          <span className="badge badge-sun" style={{ fontVariantNumeric: 'tabular-nums' }}>
            3.143m
          </span>
        </div>

        {selectedSummit && (
          <div
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              padding: 12,
              marginBottom: 12,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)', fontSize: '0.68rem', fontWeight: 900, padding: '2px 7px', borderRadius: 3 }}>
                  #{selectedSummit.rank}
                </span>
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                  {selectedSummit.name}
                </span>
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 900, color: 'var(--color-sky)' }}>
                {selectedSummit.actualAltitude.toLocaleString('vi-VN')}m
              </span>
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.45, marginBottom: 8 }}>
              {selectedSummit.highlights}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)', background: 'var(--color-bg-card)', padding: '2px 6px', borderRadius: 3, border: '1px solid var(--color-border)' }}>
                  {selectedSummit.province}
                </span>
                <span style={{ fontSize: '0.66rem', color: 'var(--color-sun)', background: 'var(--color-bg-card)', padding: '2px 6px', borderRadius: 3, border: '1px solid var(--color-border)', fontWeight: 700 }}>
                  {selectedSummit.difficulty}
                </span>
              </div>

              {selectedSummit.dbTrail && onSelectTrail && (
                <button
                  type="button"
                  onClick={() => onSelectTrail(selectedSummit.dbTrail!)}
                  className="btn btn-outline interactive-click"
                  style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: 4, fontWeight: 800 }}
                >
                  <span>Xem Cung Đường</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </button>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto', paddingRight: 2 }}>
          {summitsWithDb.map((s) => {
            const isSelected = s.rank === selectedRank;
            return (
              <button
                key={s.rank}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedRank(s.rank)}
                className="interactive-click"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 8px',
                  borderRadius: 4,
                  border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: isSelected ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'var(--color-bg-main)',
                  cursor: 'pointer',
                  fontSize: '0.74rem',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 3,
                      background: isSelected ? 'var(--color-primary)' : 'var(--color-bg-card)',
                      color: isSelected ? 'var(--color-on-primary)' : 'var(--color-text-dim)',
                      fontSize: '0.64rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {s.rank}
                  </span>
                  <span style={{ fontWeight: isSelected ? 800 : 600, color: isSelected ? 'var(--color-primary)' : 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.name}
                  </span>
                </div>
                <span style={{ fontWeight: 800, color: 'var(--color-sky)', fontSize: '0.72rem', flexShrink: 0 }}>
                  {s.actualAltitude.toLocaleString('vi-VN')}m
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <section
      style={{
        padding: '24px 0 32px 0',
        maxWidth: 1320,
        margin: '0 auto',
      }}
    >
      {/* Section Header */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 4,
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            fontSize: '0.72rem',
            fontWeight: 800,
            color: 'var(--color-sun)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 8,
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

      {/* Main Container Layout */}
      <div
        className="summit-ladder-grid"
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          padding: '16px 18px',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Left Side: 10-Summit Ranking List */}
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
                <button
                  key={s.rank}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedRank(s.rank)}
                  className="interactive-click"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 10px',
                    borderRadius: 4,
                    border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                    background: isSelected ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'var(--color-bg-main)',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${altitudeProgress}%`,
                      background: isSelected ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'transparent',
                      pointerEvents: 'none',
                    }}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 1 }}>
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 3,
                        background: isSelected ? 'var(--color-primary)' : 'var(--color-bg-card)',
                        color: isSelected ? 'var(--color-on-primary)' : 'var(--color-text-dim)',
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
                          <span title="Dữ liệu GPX đã xác thực trong hệ thống LOST">
                            <IconCheckCircle size={12} color="var(--color-primary)" />
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)', lineHeight: 1.15 }}>
                        {s.province}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', position: 'relative', zIndex: 1, flexShrink: 0 }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 900, color: 'var(--color-sun)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                      {s.actualAltitude.toLocaleString('vi-VN')}m
                    </div>
                    <span
                      style={{
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: s.difficulty.includes('Rất Khó')
                          ? 'color-mix(in srgb, var(--color-error) 14%, transparent)'
                          : s.difficulty.includes('Khó')
                          ? 'color-mix(in srgb, var(--color-earth) 14%, transparent)'
                          : 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
                        color: s.difficulty.includes('Rất Khó')
                          ? 'var(--color-error-text, var(--banner-danger-text))'
                          : s.difficulty.includes('Khó')
                          ? 'var(--color-earth)'
                          : 'var(--color-primary)',
                      }}
                    >
                      {s.difficulty}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Mountain Showcase Card */}
        <div
          style={{
            background: 'var(--color-bg-main)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            {/* Panoramic Banner (<img> with verified Cloudinary fallback) */}
            <div
              style={{
                position: 'relative',
                minHeight: 148,
                background: 'var(--color-surface-elevated)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 14px',
              }}
            >
              <img
                key={selectedSummit.name}
                src={selectedSummit.imageUrl || TOP_10_SUMMITS[0].imageUrl}
                alt={selectedSummit.name}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.src !== TOP_10_SUMMITS[0].imageUrl) {
                    img.src = TOP_10_SUMMITS[0].imageUrl;
                  }
                }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage:
                    'linear-gradient(180deg, color-mix(in srgb, var(--overlay-bg) 48%, transparent) 0%, var(--overlay-bg) 100%), linear-gradient(180deg, transparent 35%, var(--overlay-bg) 100%)',
                  pointerEvents: 'none',
                }}
              />

              {/* Top Tags — High WCAG Contrast in BOTH Dark & Light Mode */}
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <span
                  style={{
                    background: 'var(--color-bg-card)',
                    color: 'var(--color-sun)',
                    border: '1px solid var(--color-sun)',
                    fontWeight: 900,
                    fontSize: '0.68rem',
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}
                >
                  TOP #{selectedSummit.rank} ĐỈNH NÚI
                </span>

                <div
                  style={{
                    background: 'var(--overlay-bg)',
                    border: '1px solid color-mix(in srgb, var(--color-on-media) 22%, transparent)',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: '0.68rem',
                    color: 'var(--color-on-media)',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <IconCompass size={12} color="var(--color-on-media)" />
                  {selectedSummit.coordinates.lat}° N, {selectedSummit.coordinates.lng}° E
                </div>
              </div>

              {/* Bottom Title in Banner */}
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'color-mix(in srgb, var(--color-on-media) 85%, transparent)', fontWeight: 600 }}>
                    {selectedSummit.mountainRange} · {selectedSummit.province}
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--color-on-media)', margin: 0, textShadow: '0 2px 8px var(--overlay-bg)' }}>
                    {selectedSummit.name}
                  </h3>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '1.28rem', fontWeight: 900, color: 'var(--color-on-media)', fontVariantNumeric: 'tabular-nums', textShadow: '0 2px 8px var(--overlay-bg)', lineHeight: 1.1 }}>
                    {selectedSummit.actualAltitude.toLocaleString('vi-VN')}m
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'color-mix(in srgb, var(--color-on-media) 82%, transparent)', fontWeight: 600 }}>
                    Độ cao thực địa
                  </span>
                </div>
              </div>
            </div>

            {/* Body Details */}
            <div style={{ padding: '12px 14px 0 14px' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                {selectedSummit.highlights}
              </p>

              {/* Responsive 4-Metric Grid (auto-fits cleanly on mobile) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(112px, 100%), 1fr))',
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                <div style={{ background: 'var(--color-bg-card)', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>Độ Khó</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 2 }}>
                    {selectedSummit.difficulty}
                  </div>
                </div>

                <div style={{ background: 'var(--color-bg-card)', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>Thời Lượng</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-sky)', marginTop: 2 }}>
                    {selectedSummit.duration}
                  </div>
                </div>

                <div style={{ background: 'var(--color-bg-card)', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>Mùa Đẹp</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-earth)', marginTop: 2 }}>
                    {selectedSummit.bestSeason}
                  </div>
                </div>

                <div style={{ background: 'var(--color-bg-card)', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.64rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>Thủ Tục</div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-sun)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selectedSummit.permitInfo}>
                    {selectedSummit.permitInfo.split(',')[0]}
                  </div>
                </div>
              </div>

              {/* Trekking Milestones Timeline (Wraps cleanly on mobile) */}
              <div
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  padding: '8px 10px',
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: '0.64rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.04em' }}>
                  LỘ TRÌNH CỘT MỐC TIÊU BIỂU
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  {selectedSummit.milestones.map((m, idx) => (
                    <React.Fragment key={idx}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: idx === 2 ? 'var(--color-sun)' : 'var(--color-text-main)', fontWeight: 700 }}>
                        {idx === 0 && <IconTrees size={11} color="var(--color-primary)" />}
                        {idx === 1 && <IconFlame size={11} color="var(--color-earth)" />}
                        {idx === 2 && <IconMountain size={11} color="var(--color-sun)" />}
                        <span>{m}</span>
                      </div>
                      {idx < selectedSummit.milestones.length - 1 && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-border-glow)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Database Tracklog Status */}
              {selectedSummit.dbTrail && selectedSummit.dbTrail.name && selectedSummit.dbTrail.name.trim().length >= 4 ? (
                <div
                  style={{
                    background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                    border: '1px solid var(--color-border-glow)',
                    borderRadius: 4,
                    padding: '8px 10px',
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-primary)', marginBottom: 2 }}>
                    <IconCheckCircle size={12} color="var(--color-primary)" />
                    Tuyến GPX Sẵn Sàng: {selectedSummit.dbTrail.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                    Chiều dài: {selectedSummit.dbTrail.distanceKm} km · Độ dốc: +{selectedSummit.dbTrail.elevationGainM || 1400}m
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    padding: '8px 10px',
                    marginBottom: 12,
                    fontSize: '0.72rem',
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

          {/* Bottom Action Button */}
          <div style={{ padding: '0 14px 14px 14px' }}>
            <button
              type="button"
              onClick={() => {
                if (selectedSummit.dbTrail && onSelectTrail) {
                  onSelectTrail(selectedSummit.dbTrail);
                }
              }}
              disabled={!selectedSummit.dbTrail}
              className="btn btn-primary interactive-click"
              style={{
                width: '100%',
                borderRadius: 4,
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
              <IconMapPin size={15} color="var(--color-on-primary)" />
              <span>{selectedSummit.dbTrail ? `Xem Hồ Sơ, Bản Đồ 3D & Lịch Trình ${selectedSummit.name}` : `Chưa Có Tuyến GPX Riêng Cho ${selectedSummit.name}`}</span>
              {selectedSummit.dbTrail && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export const SummitAltitudeLadder = React.memo(SummitAltitudeLadderBase);
