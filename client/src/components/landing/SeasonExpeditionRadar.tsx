import React, { useState, useMemo } from 'react';
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
  onFilterSeasonMonth?: (month: number) => void;
}

interface MonthMeteorology {
  month: number;
  label: string;
  seasonTheme: string;
  badge: string;
  iconName: string;
  IconComponent: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  overviewText: string;
  preparationTip: string;
  color: string;
  tempRange: string;
  cloudChance: string;
  terrainState: string;
  fallbackImage: string;
}

// 12-Month Climate Profiles (Meteorological and Geological Characteristics of Vietnam)
const MONTH_METEOROLOGY: MonthMeteorology[] = [
  {
    month: 1,
    label: 'Tháng 1',
    seasonTheme: 'Mùa Sương Muối, Băng Giá & Săn Mây Tây Bắc',
    badge: 'Mùa Săn Băng',
    iconName: 'snowflake',
    IconComponent: IconSnowflake,
    overviewText: 'Khám phá các đỉnh núi cao miền Bắc mùa mây dày đặc, ngắm băng tuyết và hoa mai anh đào nở sớm.',
    preparationTip: 'Cần áo lông vũ chống nước, găng tay giữ nhiệt chuyên dụng và miếng dán giữ nhiệt.',
    color: 'var(--color-sky)',
    tempRange: '2°C - 10°C',
    cloudChance: '85% Săn mây',
    terrainState: 'Khô ráo, có băng giá',
    fallbackImage: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80',
  },
  {
    month: 2,
    label: 'Tháng 2',
    seasonTheme: 'Mùa Hoa Rừng Tây Bắc & Du Xuân Đầu Năm',
    badge: 'Mùa Hoa Rừng',
    iconName: 'flower',
    IconComponent: IconFlower,
    overviewText: 'Khám phá thung lũng hoa mơ, hoa mận trắng muốt và khí hậu mùa xuân dịu mát miền rẻo cao.',
    preparationTip: 'Đem theo máy ảnh sạc đầy pin dự phòng vì mùa này săn ảnh hoa và mây cực đẹp.',
    color: 'var(--color-primary)',
    tempRange: '8°C - 16°C',
    cloudChance: '80% Biển mây',
    terrainState: 'Ấm dần, tiết trời dịu mát',
    fallbackImage: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80',
  },
  {
    month: 3,
    label: 'Tháng 3',
    seasonTheme: 'Vương Quốc Hoa Đỗ Quyên & Rừng Cổ Thụ',
    badge: 'Đại Ngàn Đỗ Quyên',
    iconName: 'flower',
    IconComponent: IconFlower,
    overviewText: 'Chinh phục các đỉnh cao Hoàng Liên Sơn ngắm thảm hoa đỗ quyên cổ thụ bung nở rực rỡ.',
    preparationTip: 'Lộ trình dài và dốc cao, nên rèn luyện thể lực leo cầu thang trước 2 tuần.',
    color: 'var(--color-sun)',
    tempRange: '12°C - 20°C',
    cloudChance: '70% Săn mây',
    terrainState: 'Đường khô, thảm hoa rực rỡ',
    fallbackImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
  },
  {
    month: 4,
    label: 'Tháng 4',
    seasonTheme: 'Rừng Nguyên Sinh & Thảm Thực Vật Miền Nam - Tây Nguyên',
    badge: 'Mùa Rừng Xanh',
    iconName: 'sun',
    IconComponent: IconSunMedium,
    overviewText: 'Trekking các cánh rừng già Bidoup, Chư Yang Sin, Núi Dinh và Núi Chứa Chan.',
    preparationTip: 'Nên mang 2.5L nước/ngày và kem chống nắng khi đi các cung phía Nam.',
    color: 'var(--color-earth)',
    tempRange: '16°C - 25°C',
    cloudChance: '60% Nắng đẹp',
    terrainState: 'Đường khô ráo, rừng thông reo',
    fallbackImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
  },
  {
    month: 5,
    label: 'Tháng 5',
    seasonTheme: 'Mùa Nước Đổ Ruộng Bậc Thang & Thung Lũng Xanh',
    badge: 'Nước Đổ Trùng Điệp',
    iconName: 'droplet',
    IconComponent: IconDroplet,
    overviewText: 'Chiêm ngưỡng những mặt gương trời ruộng bậc thang kỳ vĩ và khí hậu đầu hè mát lành.',
    preparationTip: 'Mang kính râm chống chói phản chiếu từ mặt nước ruộng bậc thang.',
    color: 'var(--color-sky)',
    tempRange: '18°C - 26°C',
    cloudChance: '65% Nắng trong',
    terrainState: 'Ruộng bậc thang ngập nước',
    fallbackImage: 'https://images.unsplash.com/photo-1570784428807-6f81e3557e4e?auto=format&fit=crop&w=800&q=80',
  },
  {
    month: 6,
    label: 'Tháng 6',
    seasonTheme: 'Mùa Suối Thác, Hang Động & Tránh Nóng Rừng Già',
    badge: 'Mùa Thác Bạc',
    iconName: 'trees',
    IconComponent: IconTrees,
    overviewText: 'Trốn nóng mùa hè dưới tán rừng đại ngàn, tắm suối mát và thám hiểm hang động.',
    preparationTip: 'Bắt buộc mang túi chống nước điện thoại, giày trekking có lỗ thoát nước nhanh.',
    color: 'var(--color-primary)',
    tempRange: '22°C - 30°C',
    cloudChance: '55% Thác nước đẹp',
    terrainState: 'Suối mát, thảm thực vật tốt',
    fallbackImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
  },
  {
    month: 7,
    label: 'Tháng 7',
    seasonTheme: 'Trekking Ven Biển, Cực Đông & Hải Đăng Tổ Quốc',
    badge: 'Biển Xanh Mùa Hạ',
    iconName: 'sun',
    IconComponent: IconSun,
    overviewText: 'Đón ánh bình minh đầu tiên trên đất liền và trekking các cung ven biển duyên hải miền Trung.',
    preparationTip: 'Nắng gắt ven biển đòi hỏi mũ tai bèo rộng vành, khăn trùm và bổ sung viên điện giải oresol.',
    color: 'var(--color-earth)',
    tempRange: '25°C - 33°C',
    cloudChance: '50% Nắng gắt',
    terrainState: 'Cát biển, đồi dốc lộng gió',
    fallbackImage: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80',
  },
  {
    month: 8,
    label: 'Tháng 8',
    seasonTheme: 'Thảo Nguyên Cỏ Xanh & Đại Ngàn Rừng Thác',
    badge: 'Thảo Nguyên Xanh',
    iconName: 'sparkles',
    IconComponent: IconSparkles,
    overviewText: 'Băng qua những đồi cỏ xanh ngút ngàn, rừng thông reo và các con thác hùng vĩ miền Trung - Tây Nguyên.',
    preparationTip: 'Mang theo áo mưa bộ GORE-TEX dự phòng và kiểm tra dự báo thời tiết trước khi hạ trại trên đồi trống.',
    color: 'var(--color-primary)',
    tempRange: '18°C - 26°C',
    cloudChance: '70% Mây thung lũng',
    terrainState: 'Đồi cỏ xanh, trơn nhẹ',
    fallbackImage: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80',
  },
  {
    month: 9,
    label: 'Tháng 9',
    seasonTheme: 'Mùa Lúa Chín Vàng Rực Khắp Miền Núi Phía Bắc',
    badge: 'Mùa Lúa Chín Vàng',
    iconName: 'sun',
    IconComponent: IconSun,
    overviewText: 'Hành trình ngắm mùa vàng óng ả Mù Cang Chải, Sa Pa, Y Tý và Pu Luông.',
    preparationTip: 'Mùa cao điểm du lịch Tây Bắc, bạn nên liên hệ porter và xe trước ít nhất 10 ngày.',
    color: 'var(--color-sun)',
    tempRange: '15°C - 24°C',
    cloudChance: '75% Nắng thu vàng',
    terrainState: 'Khô ráo, lúa chín vàng',
    fallbackImage: 'https://images.unsplash.com/photo-1570784428807-6f81e3557e4e?auto=format&fit=crop&w=800&q=80',
  },
  {
    month: 10,
    label: 'Tháng 10',
    seasonTheme: 'Mùa Hoa Chi Pâu, Tam Giác Mạch & Biển Mây',
    badge: 'Mùa Hoa Tím Chi Pâu',
    iconName: 'cloud',
    IconComponent: IconCloud,
    overviewText: 'Đắm mình trong đồi hoa tím Chi Pâu, hoa tam giác mạch Hà Giang và săn biển mây cuồn cuộn.',
    preparationTip: 'Đỉnh Tà Chì Nhù nhiều gió mạnh, cần lều cắm trại 2 lớp có cọc neo nhôm chắc chắn.',
    color: 'var(--color-sky)',
    tempRange: '12°C - 20°C',
    cloudChance: '85% Biển mây',
    terrainState: 'Đồi hoa tím, gió mạnh',
    fallbackImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
  },
  {
    month: 11,
    label: 'Tháng 11',
    seasonTheme: 'Đỉnh Cao Săn Mây & Mùa Thu Lá Đỏ',
    badge: 'Đỉnh Cao Săn Mây',
    iconName: 'mountain',
    IconComponent: IconMountain,
    overviewText: 'Tỉ lệ gặp biển mây cao nhất năm trên toàn bộ 10 đỉnh núi Tây Bắc.',
    preparationTip: 'Đêm trên độ cao 2.500m nhiệt độ có thể xuống 4°C, cần túi ngủ có nhiệt độ chịu lạnh từ 0°C đến 5°C.',
    color: 'var(--color-primary)',
    tempRange: '6°C - 16°C',
    cloudChance: '90% Đỉnh cao săn mây',
    terrainState: 'Khô ráo tuyệt đối',
    fallbackImage: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80',
  },
  {
    month: 12,
    label: 'Tháng 12',
    seasonTheme: 'Mùa Săn Băng Tuyết & Lửa Trại Basecamp',
    badge: 'Băng Tuyết Mùa Đông',
    iconName: 'flame',
    IconComponent: IconFlame,
    overviewText: 'Trải nghiệm cái lạnh mùa đông, săn tuyết trên các đỉnh cao và cắm trại đêm ngắm sao.',
    preparationTip: 'Trang bị áo khoác 3 lớp chống gió tuyết, gậy trekking có gắn đệm chống lún và bình giữ nhiệt nước nóng.',
    color: 'var(--color-earth)',
    tempRange: '0°C - 8°C',
    cloudChance: '85% Băng tuyết & mây',
    terrainState: 'Rất lạnh, sương giá',
    fallbackImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
  },
];

export const SeasonExpeditionRadar: React.FC<SeasonExpeditionRadarProps> = ({
  trails,
  onSelectTrail,
  onExploreFilter,
  onFilterSeasonMonth,
}) => {
  // Default to current calendar month (1-12)
  const currentCalendarMonth = new Date().getMonth() + 1;
  const [activeMonth, setActiveMonth] = useState<number>(currentCalendarMonth);

  const selectedMeteorology = MONTH_METEOROLOGY.find((m) => m.month === activeMonth) || MONTH_METEOROLOGY[0];
  const CurrentIcon = selectedMeteorology.IconComponent;

  // 100% Dynamic Database Filter: query live trails matching the selected month
  const matchedTrails = useMemo(() => {
    if (!Array.isArray(trails) || trails.length === 0) return [];

    // Filter valid trails that specify this activeMonth in their bestMonths, or don't explicitly avoid it
    const filtered = trails.filter((t) => {
      if (!t.name || t.name.trim().length < 3) return false;
      if (Array.isArray(t.bestMonths) && t.bestMonths.length > 0) {
        return t.bestMonths.includes(activeMonth) && (!t.avoidMonths || !t.avoidMonths.includes(activeMonth));
      }
      return !t.avoidMonths?.includes(activeMonth);
    });

    // If matches exist, sort by rating / reviewCount
    if (filtered.length > 0) {
      return filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviewCount || 0) - (a.reviewCount || 0));
    }

    // Fallback: return top rated trails
    return trails.filter(t => t.name && t.name.trim().length >= 3).slice(0, 3);
  }, [trails, activeMonth]);

  // Dynamic Highlights derived from real trails in the database for the active month
  const dynamicHighlights = useMemo(() => {
    if (!matchedTrails || matchedTrails.length === 0) {
      return [
        `Khí hậu lý tưởng cho các hoạt động thám hiểm ngoài trời trong tháng ${activeMonth}.`,
        'Cung đường được kiểm duyệt với dữ liệu GPS và hướng dẫn viên địa phương.',
        'Thời tiết thuận lợi, phù hợp cho cả người mới và trekker chuyên nghiệp.',
      ];
    }

    const items: string[] = [];
    // 1. Top trail highlight
    const top = matchedTrails[0];
    if (top && top.name) {
      items.push(`Cung đường tiêu biểu: ${top.name} (${top.province || 'Việt Nam'}) – Cao độ ${top.maxAltitudeM || 0}m, cự ly ${top.distanceKm || 0}km`);
    }

    // 2. Second trail if available
    if (matchedTrails.length > 1) {
      const second = matchedTrails[1];
      if (second && second.name) {
        items.push(`Tuyến thám hiểm ${second.province || 'Việt Nam'}: ${second.name} – Độ khó ${second.difficultyLevel || 3}/5`);
      }
    }

    // 3. Overall season coverage summary
    items.push(`Hệ sinh thái có ${matchedTrails.length} cung đường lý tưởng sẵn sàng khám phá trong tháng ${activeMonth}`);

    return items;
  }, [matchedTrails, activeMonth]);

  return (
    <section
      style={{
        padding: '24px 0 28px 0',
        maxWidth: 1280,
        margin: '0 auto',
      }}
    >
      {/* Section Header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
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
          Nên Đi Đâu Vào <span style={{ color: selectedMeteorology.color }}>{selectedMeteorology.label}</span>?
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', maxWidth: 650, margin: '0 auto' }}>
          Khám phá trọn vẹn đặc trưng mùa hoa, mùa lúa chín, mùa săn mây và băng tuyết theo dữ liệu khí tượng thực địa.
        </p>
      </div>

      {/* 12-Month Interactive Selector */}
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
        {MONTH_METEOROLOGY.map((item) => {
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
                background: isActive ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                cursor: 'pointer',
                position: 'relative',
                boxShadow: isActive ? '0 0 14px rgba(16, 185, 129, 0.25)' : 'none',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {isNow && (
                <span
                  style={{
                    position: 'absolute',
                    top: -6,
                    background: 'var(--color-primary)',
                    color: '#041108',
                    fontSize: '0.55rem',
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                  }}
                >
                  Hiện Tại
                </span>
              )}
              <MonthIcon
                size={20}
                color={isActive ? item.color : 'var(--color-text-dim)'}
                className={isActive ? 'icon-spin-subtle' : ''}
              />
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: isActive ? 800 : 600,
                  color: isActive ? 'var(--color-text-main)' : 'var(--color-text-dim)',
                  marginTop: 4,
                }}
              >
                T{item.month}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Season Overview Grid */}
      <div
        className="card card-glow"
        style={{
          padding: '28px 32px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 32,
          alignItems: 'stretch',
        }}
      >
        {/* Left Column: Season Theme & Radar Gauges */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid var(--color-border)',
                  color: selectedMeteorology.color,
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontSize: '0.78rem',
                  fontWeight: 800,
                }}
              >
                <CurrentIcon size={14} color={selectedMeteorology.color} />
                {selectedMeteorology.badge}
              </span>

              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)' }}>
                Thời tiết vùng cao
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
              {selectedMeteorology.seasonTheme}
            </h3>

            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: 18 }}>
              {selectedMeteorology.overviewText}
            </p>

            {/* Weather & Radar Gauges */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                marginBottom: 20,
                background: 'var(--color-bg-main)',
                padding: '10px 12px',
                borderRadius: 14,
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', marginBottom: 2 }}>Nhiệt độ</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-sun)' }}>{selectedMeteorology.tempRange}</div>
              </div>
              <div style={{ textAlign: 'center', borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', marginBottom: 2 }}>Săn mây</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-sky)' }}>{selectedMeteorology.cloudChance}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', marginBottom: 2 }}>Địa hình</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-primary)' }}>{selectedMeteorology.terrainState}</div>
              </div>
            </div>

            {/* Dynamic Highlights from Real Trails */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {dynamicHighlights.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.86rem', color: 'var(--color-text-muted)' }}>
                  <span style={{ color: selectedMeteorology.color, fontWeight: 900, marginTop: 1 }}>•</span>
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Preparation Tip Box */}
          <div
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 16,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              <IconLightbulb size={18} color="var(--color-sun)" />
            </div>
            <div>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--color-sun)', textTransform: 'uppercase', marginBottom: 2 }}>
                Kinh Nghiệm Chuẩn Bị
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                {selectedMeteorology.preparationTip}
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
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>
                Tuyến Đường Đề Xuất Tháng {selectedMeteorology.month}
              </h4>
              {matchedTrails.length > 0 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                  {matchedTrails.length} cung đường
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {matchedTrails.slice(0, 3).map((trail, idx) => (
                <div
                  key={trail.id || (trail as any)._id || `matched-trail-${idx}`}
                  onClick={() => onSelectTrail?.(trail)}
                  className="interactive-click card-hover-lift"
                  style={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 16,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  {/* Trail Thumbnail */}
                  <img
                    src={trail.coverImage || selectedMeteorology.fallbackImage}
                    alt={trail.name}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 12,
                      objectFit: 'cover',
                      flexShrink: 0,
                      border: '1px solid var(--color-border)',
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = selectedMeteorology.fallbackImage;
                    }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                      <h5
                        style={{
                          fontSize: '0.92rem',
                          fontWeight: 800,
                          color: 'var(--color-text-main)',
                          margin: 0,
                          lineHeight: 1.4,
                          wordBreak: 'break-word',
                        }}
                      >
                        {trail.name}
                      </h5>
                      {trail.province && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            background: 'rgba(16, 185, 129, 0.12)',
                            border: '1px solid var(--color-border)',
                            padding: '2px 8px',
                            borderRadius: 6,
                            color: 'var(--color-primary)',
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {trail.province}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--color-text-dim)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      <span>Độ cao: <strong style={{ color: 'var(--color-sun)' }}>{trail.maxAltitudeM}m</strong></span>
                      <span>Cự ly: <strong style={{ color: 'var(--color-sky)' }}>{trail.distanceKm}km</strong></span>
                      <span>Độ khó: <strong style={{ color: 'var(--color-primary)' }}>{trail.difficultyLevel}/5</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Explore Link Box */}
          <div
            onClick={() => {
              if (onFilterSeasonMonth) {
                onFilterSeasonMonth(selectedMeteorology.month);
              }
              const mapElem = document.getElementById('gis-map-section') || document.getElementById('map-view-container');
              if (mapElem) {
                mapElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
              if (onExploreFilter) {
                onExploreFilter(selectedMeteorology.label);
              }
            }}
            className="interactive-click"
            style={{
              marginTop: 16,
              padding: '12px 16px',
              borderRadius: 14,
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconCompass size={16} color="var(--color-primary)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                Xem toàn bộ {matchedTrails.length} cung đường tháng {selectedMeteorology.month} trên Bản Đồ 3D
              </span>
            </div>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-primary)', fontWeight: 800 }}>↑ Lên Bản Đồ</span>
          </div>
        </div>
      </div>
    </section>
  );
};
