import React, { useState } from 'react';
import type { Trail } from '../../types.js';
import {
  IconSnowflake,
  IconFlower,
  IconSunMedium,
  IconDroplet,
  IconTrees,
  IconSun,
  IconSparkles,
  IconCloud,
  IconMountain,
  IconFlame,
  IconCompass,
  IconLightbulb,
} from '../common/SvgIcons.js';

interface SeasonExpeditionRadarProps {
  trails: Trail[];
  onSelectTrail?: (trail: Trail) => void;
  onExploreFilter?: (filterText: string) => void;
}

interface MonthData {
  month: number;
  label: string;
  seasonTheme: string;
  badge: string;
  iconName: string;
  IconComponent: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  bestFor: string;
  highlights: string[];
  recommendedTrails: string[];
  preparationTip: string;
  color: string;
}

const SEASON_CONFIG: MonthData[] = [
  {
    month: 1,
    label: 'Tháng 1',
    seasonTheme: 'Băng Giá & Sương Muối Tây Bắc',
    badge: 'Mùa Săn Băng',
    iconName: 'snowflake',
    IconComponent: IconSnowflake,
    bestFor: 'Săn băng tuyết, biển mây dày đặc và hoa mai anh đào',
    highlights: ['Băng giá đỉnh Fansipan, Lảo Thẩn', 'Hoa anh đào nở rộ Sa Pa & Mộc Châu', 'Thời tiết khô ráo, nhiệt độ 2-10°C'],
    recommendedTrails: ['Lảo Thẩn', 'Fansipan (Trạm Tôn)', 'Tà Xùa (Sống Lưng Khủng Long)'],
    preparationTip: 'Cần áo lông vũ chống nước, găng tay giữ nhiệt chuyên dụng và miếng dán nhiệt.',
    color: 'var(--color-sky)',
  },
  {
    month: 2,
    label: 'Tháng 2',
    seasonTheme: 'Mùa Hoa Mận & Hoa Đào Rực Rỡ',
    badge: 'Mùa Hoa Rừng',
    iconName: 'flower',
    IconComponent: IconFlower,
    bestFor: 'Khám phá thung lũng hoa và khí hậu mùa xuân dịu mát',
    highlights: ['Rừng hoa mơ, hoa mận trắng xóa Mộc Châu - Tà Xùa', 'Lễ hội bản làng người Mông', 'Tầm nhìn thoáng đãng'],
    recommendedTrails: ['Tà Xùa (Sống Lưng Khủng Long)', 'Pu Ta Leng (Đường Tả Lèng)', 'Lảo Thẩn'],
    preparationTip: 'Đem theo máy ảnh sạc đầy pin vì mùa này săn ảnh hoa và mây cực đẹp.',
    color: 'var(--color-primary)',
  },
  {
    month: 3,
    label: 'Tháng 3',
    seasonTheme: 'Vương Quốc Hoa Đỗ Quyên Đại Ngàn',
    badge: 'Đại Ngàn Đỗ Quyên',
    iconName: 'flower',
    IconComponent: IconFlower,
    bestFor: 'Trekking ngắm thảm hoa đỗ quyên cổ thụ nở rực rỡ trên các đỉnh cao',
    highlights: ['Rừng đỗ quyên đỏ, vàng, tím nở rộ đỉnh Pu Ta Leng, Bạch Mộc', 'Khí hậu mùa xuân ấm dần', 'Độ ẩm vừa phải'],
    recommendedTrails: ['Pu Ta Leng (Đường Tả Lèng)', 'Bạch Mộc Lương Tử (Kỳ Quan San)', 'Nhìu Cồ San'],
    preparationTip: 'Lộ trình dài và dốc cao, nên rèn luyện thể lực leo cầu thang trước 2 tuần.',
    color: 'var(--color-sun)',
  },
  {
    month: 4,
    label: 'Tháng 4',
    seasonTheme: 'Rừng Phong Thay Lá & Tiết Trời Dịu Nhẹ',
    badge: 'Mùa Dịu Mát',
    iconName: 'sun',
    IconComponent: IconSunMedium,
    bestFor: 'Trekking các tuyến rừng nguyên sinh Tây Nguyên và Nam Bộ',
    highlights: ['Vườn quốc gia Bidoup - Núi Bà xanh mướt', 'Núi Chứa Chan & Chư Yang Sin', 'Ít mưa, đường khô ráo'],
    recommendedTrails: ['Bidoup - Núi Bà', 'Núi Chứa Chan', 'Chư Yang Sin'],
    preparationTip: 'Nên mang 2.5L nước/ngày và kem chống nắng khi đi các cung phía Nam.',
    color: 'var(--color-earth)',
  },
  {
    month: 5,
    label: 'Tháng 5',
    seasonTheme: 'Mùa Nước Đổ Ruộng Bậc Thang',
    badge: 'Nước Đổ Trùng Điệp',
    iconName: 'droplet',
    IconComponent: IconDroplet,
    bestFor: 'Trekking ngắm kiệt tác gương trời ruộng bậc thang Tây Bắc',
    highlights: ['Ruộng bậc thang Mù Cang Chải & Y Tý lấp lánh như gương', 'Thời tiết đầu hè trong vắt', 'Bình minh tuyệt mỹ'],
    recommendedTrails: ['Lảo Thẩn', 'Tà Chì Nhù (Mỏ Chì)', 'Ngũ Chỉ Sơn'],
    preparationTip: 'Đường đất có thể trơn trượt sau cơn mưa rào, bắt buộc dùng giày trekking có gai bám sâu Vibram.',
    color: 'var(--color-stream)',
  },
  {
    month: 6,
    label: 'Tháng 6',
    seasonTheme: 'Băng Rừng Cổ Thụ & Suối Thác Mát Lạnh',
    badge: 'Thám Hiểm Rừng Mát',
    iconName: 'trees',
    IconComponent: IconTrees,
    bestFor: 'Trekking suối thác và rừng rậm nhiệt đới tránh nóng',
    highlights: ['Vườn quốc gia Cát Tiên & Bù Gia Mập', 'Tắm suối ngắm chim muông', 'Cây cổ thụ nghìn năm tuổi'],
    recommendedTrails: ['Vườn Quốc Gia Cát Tiên (Tuyến Bàu Sấu)', 'Vườn Quốc Gia Bù Gia Mập', 'Hòn Bà Nha Trang'],
    preparationTip: 'Chuẩn bị tất chống vắt cao cổ, xịt chống côn trùng DEET và túi chống nước điện thoại.',
    color: 'var(--color-primary)',
  },
  {
    month: 7,
    label: 'Tháng 7',
    seasonTheme: 'Biển Đảo & Vực Thác Hùng Vĩ',
    badge: 'Thác Nước & Biển Xanh',
    iconName: 'sun',
    IconComponent: IconSun,
    bestFor: 'Trekking ven biển duyên hải miền Trung hoặc chinh phục thác nước',
    highlights: ['Mũi Đôi - Cực Đông Tổ Quốc đón ánh bình minh đầu tiên', 'Bán đảo Sơn Trà', 'Cung đường cát trắng biển xanh'],
    recommendedTrails: ['Mũi Đôi - Cực Đông', 'Tà Năng - Phan Dũng (Mùa Cỏ Xanh)'],
    preparationTip: 'Nắng gắt ven biển đòi hỏi mũ tai bèo rộng vành, khăn trùm ninja và bổ sung viên bù điện giải oresol.',
    color: 'var(--color-earth)',
  },
  {
    month: 8,
    label: 'Tháng 8',
    seasonTheme: 'Thảo Nguyên Cỏ Xanh Mướt Tà Năng',
    badge: 'Thảo Nguyên Xanh',
    iconName: 'sparkles',
    IconComponent: IconSparkles,
    bestFor: 'Băng qua những đồi cỏ xanh ngút ngàn và rừng thông reo',
    highlights: ['Tà Năng - Phan Dũng mùa cỏ xanh trải dài tít tắp', 'Thời tiết trong lành mát mẻ', 'Hoàng hôn đồi lộng gió'],
    recommendedTrails: ['Tà Năng - Phan Dũng (Cung Đồi Cỏ)', 'Đỉnh Bidoup 2.287m'],
    preparationTip: 'Mang theo áo mưa bộ GORE-TEX dự phòng và kiểm tra dự báo thời tiết trước khi hạ trại trên đồi trống.',
    color: 'var(--color-primary)',
  },
  {
    month: 9,
    label: 'Tháng 9',
    seasonTheme: 'Mùa Vàng Mù Cang Chải & Chiềng Đi',
    badge: 'Mùa Lúa Chín Vàng',
    iconName: 'sun',
    IconComponent: IconSun,
    bestFor: 'Hành trình săn mùa lúa chín vàng rực khắp triền núi Tây Bắc',
    highlights: ['Thung lũng lúa chín vàng óng Mù Cang Chải, Y Tý', 'Không khí thu se lạnh dễ chịu', 'Trời trong xanh ít mưa'],
    recommendedTrails: ['Lảo Thẩn', 'Tà Xùa (Sống Lưng Khủng Long)', 'Núi Bà Đen (Đường Cột Điện)'],
    preparationTip: 'Mùa cao điểm du lịch Tây Bắc, bạn nên liên hệ porter và nhà xe trước ít nhất 10 ngày.',
    color: 'var(--color-sun)',
  },
  {
    month: 10,
    label: 'Tháng 10',
    seasonTheme: 'Mùa Hoa Chi Pâu & Biển Mây Đại Ngàn',
    badge: 'Mùa Hoa Tím Chi Pâu',
    iconName: 'cloud',
    IconComponent: IconCloud,
    bestFor: 'Đắm chìm trong biển hoa tím Chi Pâu và săn biển mây cuồn cuộn',
    highlights: ['Đồi hoa tím Chi Pâu nở tím ngắt sườn núi Tà Chì Nhù', 'Biển mây Tà Xùa bồng bềnh 90%', 'Nhiệt độ lý tưởng 15-22°C'],
    recommendedTrails: ['Tà Chì Nhù (Mỏ Chì)', 'Tà Xùa (Sống Lưng Khủng Long)', 'Lảo Thẩn'],
    preparationTip: 'Đỉnh Tà Chì Nhù nhiều gió mạnh, cần lều cắm trại 2 lớp có cọc neo nhôm chắc chắn.',
    color: 'var(--color-sky)',
  },
  {
    month: 11,
    label: 'Tháng 11',
    seasonTheme: 'Đỉnh Cao Săn Mây & Mùa Thu Phong Đỏ',
    badge: 'Đỉnh Cao Săn Mây',
    iconName: 'mountain',
    IconComponent: IconMountain,
    bestFor: 'Tỉ lệ gặp biển mây cao nhất năm trên toàn bộ 10 đỉnh núi Tây Bắc',
    highlights: ['Biển mây hoàng hôn và bình minh tại Bạch Mộc, Ky Quan San', 'Lá phong chuyển đỏ Fansipan', 'Trời khô ráo tuyệt đối'],
    recommendedTrails: ['Bạch Mộc Lương Tử (Kỳ Quan San)', 'Lảo Thẩn', 'Nhìu Cồ San', 'Fansipan (Trạm Tôn)'],
    preparationTip: 'Đêm trên độ cao 2.500m nhiệt độ có thể xuống 4°C, cần túi ngủ có nhiệt độ thoải mái từ 0°C đến 5°C.',
    color: 'var(--color-primary)',
  },
  {
    month: 12,
    label: 'Tháng 12',
    seasonTheme: 'Mùa Săn Tuyết & Lửa Trại Basecamp',
    badge: 'Băng Tuyết Mùa Đông',
    iconName: 'flame',
    IconComponent: IconFlame,
    bestFor: 'Trải nghiệm cái lạnh cắt da, săn băng tuyết và quây quần bên lửa trại',
    highlights: ['Cơ hội ngắm tuyết rơi Fansipan, Pu Ta Leng', 'Không khí lạnh đặc trưng miền cực Bắc', 'Bầu trời đêm đầy sao'],
    recommendedTrails: ['Fansipan (Trạm Tôn)', 'Lảo Thẩn', 'Pu Ta Leng (Đường Tả Lèng)'],
    preparationTip: 'Trang bị áo khoác 3 lớp chống gió tuyết, gậy trekking có gắn đệm chống lún và bình giữ nhiệt nước nóng.',
    color: 'var(--color-earth)',
  },
];

export const SeasonExpeditionRadar: React.FC<SeasonExpeditionRadarProps> = ({
  trails,
  onSelectTrail,
  onExploreFilter,
}) => {
  // Default to current calendar month (1-12)
  const currentCalendarMonth = new Date().getMonth() + 1;
  const [activeMonth, setActiveMonth] = useState<number>(currentCalendarMonth);

  const selectedData = SEASON_CONFIG.find((m) => m.month === activeMonth) || SEASON_CONFIG[0];
  const CurrentIcon = selectedData.IconComponent;

  // Find trails in database matching recommendations
  const matchedTrails = trails.filter((t) =>
    selectedData.recommendedTrails.some((recName) =>
      t.name.toLowerCase().includes(recName.toLowerCase()) ||
      recName.toLowerCase().includes(t.name.toLowerCase())
    )
  );

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
            color: 'var(--color-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 12,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <IconCompass size={16} color="var(--color-primary)" />
          Lịch Thám Hiểm 12 Tháng
        </div>

        <h2
          style={{
            fontSize: 'clamp(1.6rem, 3.2vw, 2.4rem)',
            fontWeight: 900,
            color: 'var(--color-text-main)',
            marginBottom: 10,
          }}
        >
          Nên Đi Đâu Vào <span style={{ color: selectedData.color }}>{selectedData.label}</span>?
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', maxWidth: 650, margin: '0 auto' }}>
          Khám phá trọn vẹn đặc trưng mùa hoa, mùa lúa chín, mùa săn mây và băng tuyết theo dữ liệu khí tượng thực địa.
        </p>
      </div>

      {/* 12-Month Interactive Radial Selector */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
          gap: 8,
          background: 'var(--color-bg-card)',
          padding: '12px 14px',
          borderRadius: 24,
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-card)',
          marginBottom: 28,
        }}
      >
        {SEASON_CONFIG.map((item) => {
          const isActive = item.month === activeMonth;
          const isNow = item.month === currentCalendarMonth;
          const MonthIcon = item.IconComponent;

          return (
            <button
              key={item.month}
              type="button"
              onClick={() => setActiveMonth(item.month)}
              className={`interactive-click ${isActive ? 'month-active-pop' : ''}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 4px',
                borderRadius: 14,
                border: isActive ? `1.5px solid ${item.color}` : '1px solid transparent',
                background: isActive ? 'rgba(5, 150, 105, 0.12)' : 'transparent',
                cursor: 'pointer',
                position: 'relative',
                boxShadow: isActive ? '0 0 14px rgba(5, 150, 105, 0.25)' : 'none',
              }}
            >
              {isNow && (
                <span
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: 4,
                    background: 'var(--color-primary)',
                    color: '#ffffff',
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: 6,
                    lineHeight: 1.2,
                  }}
                >
                  Hiện Tại
                </span>
              )}

              <div style={{ marginBottom: 4 }}>
                <MonthIcon size={16} color={isActive ? item.color : 'var(--color-text-dim)'} />
              </div>

              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: isActive ? 800 : 600,
                  color: isActive ? item.color : 'var(--color-text-muted)',
                }}
              >
                T{item.month}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Month Highlight Bento Display Card */}
      <div
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 24,
          padding: '32px 28px',
          boxShadow: 'var(--shadow-card)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 28,
          alignItems: 'center',
        }}
      >
        {/* Left Column: Season Narrative & Highlights */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span
              style={{
                background: 'rgba(5, 150, 105, 0.12)',
                border: `1px solid ${selectedData.color}`,
                color: selectedData.color,
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '4px 12px',
                borderRadius: 20,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <CurrentIcon size={14} color={selectedData.color} />
              {selectedData.badge}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>
              Tiết trời vùng cao
            </span>
          </div>

          <h3
            style={{
              fontSize: 'clamp(1.3rem, 2.2vw, 1.8rem)',
              fontWeight: 900,
              color: 'var(--color-text-main)',
              marginBottom: 12,
              lineHeight: 1.25,
            }}
          >
            {selectedData.seasonTheme}
          </h3>

          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: 20 }}>
            {selectedData.bestFor}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {selectedData.highlights.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.86rem', color: 'var(--color-text-muted)' }}>
                <span style={{ color: selectedData.color, fontWeight: 900, marginTop: 1 }}>•</span>
                <span>{h}</span>
              </div>
            ))}
          </div>

          {/* Preparation Tip Box */}
          <div
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 16,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              <IconLightbulb size={18} color="var(--color-sun)" />
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-sun)', textTransform: 'uppercase', marginBottom: 2 }}>
                Kinh Nghiệm Chuẩn Bị
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                {selectedData.preparationTip}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Top Matched Trails In Database */}
        <div
          style={{
            background: 'var(--color-bg-main)',
            border: '1px solid var(--color-border)',
            borderRadius: 20,
            padding: 24,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
              Tuyến Đường Đề Xuất
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700 }}>
              Dữ liệu GPX chuẩn
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {matchedTrails.length > 0 ? (
              matchedTrails.slice(0, 3).map((trail) => (
                <div
                  key={trail.id}
                  onClick={() => onSelectTrail?.(trail)}
                  className="interactive-click card-hover-lift"
                  style={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 14,
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 4 }}>
                      {trail.name}
                    </h5>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', display: 'flex', gap: 12 }}>
                      <span>Độ cao: <strong style={{ color: 'var(--color-sun)' }}>{trail.maxAltitudeM}m</strong></span>
                      <span>Cự ly: <strong style={{ color: 'var(--color-sky)' }}>{trail.distanceKm}km</strong></span>
                      <span>Độ khó: <strong style={{ color: 'var(--color-primary)' }}>{trail.difficultyLevel}</strong></span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary interactive-click"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.72rem',
                      borderRadius: 16,
                      whiteSpace: 'nowrap',
                      marginLeft: 12,
                    }}
                  >
                    Xem GPX
                  </button>
                </div>
              ))
            ) : (
              selectedData.recommendedTrails.map((trailName, idx) => (
                <div
                  key={idx}
                  onClick={() => onExploreFilter?.(trailName)}
                  className="interactive-click card-hover-lift"
                  style={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 14,
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 2 }}>
                      {trailName}
                    </h5>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
                      Tuyến trekking tiêu biểu tháng {selectedData.month}
                    </div>
                  </div>

                  <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                    Tìm kiếm →
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
