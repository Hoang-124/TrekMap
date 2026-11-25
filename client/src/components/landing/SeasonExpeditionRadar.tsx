import React, { useCallback, useState, useMemo } from 'react';
import type { Trail } from '../../types.js';
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator.js';
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

// 100% Original LOST Field-Atlas Topographic SVG Covers (Zero External Stock Photos)
const MONTH_METEOROLOGY: MonthMeteorology[] = [
  {
    month: 1,
    label: 'Tháng 1',
    seasonTheme: 'Tháng giêng sương muối, băng giá và biển mây Tây Bắc',
    badge: 'Săn băng & mây',
    iconName: 'snowflake',
    IconComponent: IconSnowflake,
    overviewText: 'Sáng sớm trên những đỉnh cao miền Bắc, gió cắt mặt, cành trúc đọng băng và biển mây dày phủ kín thung lũng.',
    preparationTip: 'Đừng chủ quan với cái rét đêm trên 2.500m: mang áo lông vũ chắn gió, găng giữ ấm và vài miếng dán nhiệt dự phòng.',
    color: 'var(--color-sky)',
    tempRange: '2°C - 10°C',
    cloudChance: '85% có biển mây',
    terrainState: 'Khô ráo, sáng sớm dễ có băng',
    fallbackImage: '/covers/trail-fansipan.svg',
  },
  {
    month: 2,
    label: 'Tháng 2',
    seasonTheme: 'Hoa mơ, hoa mận trắng sườn núi đầu xuân',
    badge: 'Mùa hoa rừng',
    iconName: 'flower',
    IconComponent: IconFlower,
    overviewText: 'Trời bắt đầu ấm dần, bản làng vùng cao phủ trắng hoa mận hoa mơ, nắng sớm dịu nhẹ rất dễ chịu cho những bước chân đầu năm.',
    preparationTip: 'Pin máy ảnh và điện thoại tụt rất nhanh khi trời lạnh — nhớ cất pin dự phòng trong túi ngủ để giữ ấm qua đêm.',
    color: 'var(--color-primary)',
    tempRange: '8°C - 16°C',
    cloudChance: '80% biển mây',
    terrainState: 'Ấm dần, trời khô thoáng',
    fallbackImage: '/covers/trail-laothan.svg',
  },
  {
    month: 3,
    label: 'Tháng 3',
    seasonTheme: 'Đỗ quyên cổ thụ nở rực trên dãy Hoàng Liên',
    badge: 'Mùa đỗ quyên',
    iconName: 'flower',
    IconComponent: IconFlower,
    overviewText: 'Dưới tán rừng rêu phong của Pu Ta Leng, Fansipan hay Tả Liên, từng vạt đỗ quyên đỏ vàng bung nở giữa mây mù.',
    preparationTip: 'Các cung ngắm đỗ quyên đều dài và dốc gắt — nên chạy bộ hoặc leo cầu thang trước chuyến đi ít nhất 2 tuần.',
    color: 'var(--color-sun)',
    tempRange: '12°C - 20°C',
    cloudChance: '70% săn mây',
    terrainState: 'Đường khô, rừng vào mùa hoa',
    fallbackImage: '/covers/trail-kyquansan.svg',
  },
  {
    month: 4,
    label: 'Tháng 4',
    seasonTheme: 'Rừng già Tây Nguyên và các đỉnh miền Nam vào mùa khô',
    badge: 'Mùa rừng xanh',
    iconName: 'sun',
    IconComponent: IconSunMedium,
    overviewText: 'Đất khô ráo, nắng xuyên tán thông ở Bidoup, Chư Yang Sin, Núi Dinh hay Chứa Chan — đẹp để đi dài ngày mà ít gặp vắt.',
    preparationTip: 'Nắng phía Nam khá gắt, mỗi người nên mang tối thiểu 2,5 lít nước mỗi ngày, mũ rộng vành và gói điện giải.',
    color: 'var(--color-earth)',
    tempRange: '16°C - 25°C',
    cloudChance: '60% nắng đẹp',
    terrainState: 'Đường đất khô, rừng thông thoáng',
    fallbackImage: '/covers/trail-bidoup.svg',
  },
  {
    month: 5,
    label: 'Tháng 5',
    seasonTheme: 'Mùa nước đổ loang nắng trên ruộng bậc thang',
    badge: 'Mùa nước đổ',
    iconName: 'droplet',
    IconComponent: IconDroplet,
    overviewText: 'Nước dẫn về khắp sườn đồi Tây Bắc, thung lũng phản chiếu mây trời như gương, không khí trên cao vẫn mát lành.',
    preparationTip: 'Nắng đầu hè phản chiếu từ mặt nước khá chói — nhớ mang kính râm và áo khoác nhẹ phòng mưa rào bất chợt.',
    color: 'var(--color-sky)',
    tempRange: '18°C - 26°C',
    cloudChance: '65% nắng trong',
    terrainState: 'Bậc thang đầy nước, lối mòn ẩm nhẹ',
    fallbackImage: '/covers/trail-chuyangsin.svg',
  },
  {
    month: 6,
    label: 'Tháng 6',
    seasonTheme: 'Trốn nắng hè dưới tán rừng già và suối thác mát',
    badge: 'Mùa suối thác',
    iconName: 'trees',
    IconComponent: IconTrees,
    overviewText: 'Giữa những ngày thành phố oi bức, bước vào rừng Bạch Mã, K50 hay các con suối đầu nguồn để nghe tiếng thác đổ mát rượi.',
    preparationTip: 'Bọc kín điện thoại và quần áo bằng túi chống nước, chọn giày đế bám tốt và thoát nước nhanh.',
    color: 'var(--color-primary)',
    tempRange: '22°C - 30°C',
    cloudChance: '55% nhiều thác đẹp',
    terrainState: 'Suối nhiều nước, dễ trơn đá rêu',
    fallbackImage: '/covers/trail-bachma.svg',
  },
  {
    month: 7,
    label: 'Tháng 7',
    seasonTheme: 'Băng đồi cát đón bình minh đầu tiên trên đất liền',
    badge: 'Biển xanh mùa hạ',
    iconName: 'sun',
    IconComponent: IconSun,
    overviewText: 'Duyên hải miền Trung trời xanh trong, thích hợp chinh phục Cực Đông Mũi Đôi hay những cung ven biển lộng gió.',
    preparationTip: 'Nắng cát rất mất sức: chuẩn bị mũ tai bèo, khăn che gáy, áo dài tay thoáng khí và gói oresol bù nước.',
    color: 'var(--color-earth)',
    tempRange: '25°C - 33°C',
    cloudChance: '50% nắng gắt',
    terrainState: 'Cát biển, đồi dốc gió mạnh',
    fallbackImage: '/covers/trail-muidoi.svg',
  },
  {
    month: 8,
    label: 'Tháng 8',
    seasonTheme: 'Thảo nguyên cỏ xanh và đại ngàn rừng thác',
    badge: 'Đồi cỏ xanh',
    iconName: 'sparkles',
    IconComponent: IconSparkles,
    overviewText: 'Sau những cơn mưa đầu mùa, đồi cỏ Tà Năng phủ một màu xanh non mơn mởn, gió thổi rì rào qua những vạt thông.',
    preparationTip: 'Luôn mang áo mưa bộ chống thấm tốt và xem kỹ dự báo giông trước khi hạ trại trên sống đồi trống.',
    color: 'var(--color-primary)',
    tempRange: '18°C - 26°C',
    cloudChance: '70% mây thung lũng',
    terrainState: 'Đồi cỏ xanh, đất trơn sau mưa',
    fallbackImage: '/covers/trail-tanangphandung.svg',
  },
  {
    month: 9,
    label: 'Tháng 9',
    seasonTheme: 'Nắng thu nhuộm vàng sườn núi phía Bắc',
    badge: 'Mùa lúa chín',
    iconName: 'sun',
    IconComponent: IconSun,
    overviewText: 'Hương lúa mới quyện trong gió sớm từ Mù Cang Chải, Sa Pa, Y Tý đến Pù Luông — trời se lạnh vừa đủ để đi bộ cả ngày không mệt.',
    preparationTip: 'Mùa đẹp nên khách đi khá đông — bạn nên nhắn trước cho porter và đặt xe sớm khoảng 10 ngày.',
    color: 'var(--color-sun)',
    tempRange: '15°C - 24°C',
    cloudChance: '75% nắng thu vàng',
    terrainState: 'Khô ráo, sườn núi nhuộm vàng',
    fallbackImage: '/covers/trail-nhiucosan.svg',
  },
  {
    month: 10,
    label: 'Tháng 10',
    seasonTheme: 'Đồi tím Chi Pâu, tam giác mạch và biển mây đầu mùa',
    badge: 'Hoa tím Chi Pâu',
    iconName: 'cloud',
    IconComponent: IconCloud,
    overviewText: 'Sườn núi Trạm Tấu tím ngắt một dải Chi Pâu trong gió lộng, còn Hà Giang bước vào mùa tam giác mạch phớt hồng.',
    preparationTip: 'Gió trên đỉnh Tà Chì Nhù rất mạnh về đêm — cần lều 2 lớp cọc nhôm chắc chắn và áo gió kín cổ.',
    color: 'var(--color-sky)',
    tempRange: '12°C - 20°C',
    cloudChance: '85% biển mây',
    terrainState: 'Đồi hoa tím, gió lớn trên sống núi',
    fallbackImage: '/covers/trail-tachinhu.svg',
  },
  {
    month: 11,
    label: 'Tháng 11',
    seasonTheme: 'Biển mây dày nhất năm và rừng phong chuyển lá đỏ',
    badge: 'Mùa biển mây',
    iconName: 'mountain',
    IconComponent: IconMountain,
    overviewText: 'Sáng nào cũng dễ gặp biển mây cuồn cuộn trên các đỉnh Hoàng Liên Sơn và Tây Bắc; dưới tán rừng là thảm lá phong đỏ rụng đầy lối mòn.',
    preparationTip: 'Đêm trên độ cao 2.500m nhiệt độ có thể xuống 4°C — nhớ mang túi ngủ chịu lạnh từ 0°C đến 5°C và tất len giữ ấm chân.',
    color: 'var(--color-primary)',
    tempRange: '6°C - 16°C',
    cloudChance: '90% dễ gặp biển mây',
    terrainState: 'Khô ráo, trời quang',
    fallbackImage: '/covers/trail-taxua.svg',
  },
  {
    month: 12,
    label: 'Tháng 12',
    seasonTheme: 'Sương giá mùa đông và đêm lửa trại trên đỉnh cao',
    badge: 'Săn băng mùa đông',
    iconName: 'flame',
    IconComponent: IconFlame,
    overviewText: 'Cái lạnh buốt khiến ly trà gừng bên bếp lửa ấm hơn bao giờ hết; những đêm trời quang thấy rõ dải sao vắt ngang sống núi.',
    preparationTip: 'Mặc đủ 3 lớp giữ nhiệt chống gió, mang theo gậy trekking và bình giữ nhiệt đựng nước nóng.',
    color: 'var(--color-earth)',
    tempRange: '0°C - 8°C',
    cloudChance: '85% băng giá & mây',
    terrainState: 'Rất lạnh, dễ có sương muối',
    fallbackImage: '/covers/trail-fansipan.svg',
  },
];

function getVietnamCalendarMonth(): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      month: 'numeric',
    }).formatToParts(new Date());
    const monthNum = Number(parts.find((p) => p.type === 'month')?.value);
    if (Number.isFinite(monthNum) && monthNum >= 1 && monthNum <= 12) return monthNum;
  } catch {
    // Fallback to local clock when Intl timezone is unavailable
  }
  return new Date().getMonth() + 1;
}

const SeasonExpeditionRadarBase: React.FC<SeasonExpeditionRadarProps> = ({
  trails,
  onSelectTrail,
  onExploreFilter,
  onFilterSeasonMonth,
}) => {
  const currentCalendarMonth = useMemo(() => getVietnamCalendarMonth(), []);
  const [activeMonth, setActiveMonth] = useState<number>(currentCalendarMonth);
  const { trackRef: monthTrackRef, indicatorStyle: monthIndicatorStyle } =
    useSlidingIndicator<number>(activeMonth);

  const selectedMeteorology = MONTH_METEOROLOGY.find((m) => m.month === activeMonth) || MONTH_METEOROLOGY[0];
  const CurrentIcon = selectedMeteorology.IconComponent;

  const matchedTrails = useMemo(() => {
    if (!Array.isArray(trails) || trails.length === 0) return [];

    const filtered = trails.filter((t) => {
      if (!t.name || t.name.trim().length < 3) return false;
      if (Array.isArray(t.bestMonths) && t.bestMonths.length > 0) {
        return t.bestMonths.includes(activeMonth) && (!t.avoidMonths || !t.avoidMonths.includes(activeMonth));
      }
      return !t.avoidMonths?.includes(activeMonth);
    });

    if (filtered.length > 0) {
      return filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviewCount || 0) - (a.reviewCount || 0));
    }

    return trails.filter((t) => t.name && t.name.trim().length >= 3).slice(0, 3);
  }, [trails, activeMonth]);

  const dynamicHighlights = useMemo(() => {
    if (!matchedTrails || matchedTrails.length === 0) {
      return [
        `Tháng ${activeMonth} thời tiết khá thuận lợi để ra rừng và leo núi.`,
        'Mỗi cung đều có tracklog GPS đi thật và số điện thoại kiểm lâm khu vực.',
        'Có đủ lựa chọn từ cung đi nhẹ trong ngày đến đỉnh cao nhiều ngày.',
      ];
    }

    const items: string[] = [];
    const top = matchedTrails[0];
    if (top && top.name) {
      items.push(`Nổi bật nhất: ${top.name} (${top.province || 'Việt Nam'}) — đỉnh ${top.maxAltitudeM || 0}m, dài ${top.distanceKm || 0}km`);
    }

    if (matchedTrails.length > 1) {
      const second = matchedTrails[1];
      if (second && second.name) {
        items.push(`Gợi ý thêm ở ${second.province || 'Việt Nam'}: ${second.name} — độ khó ${second.difficultyLevel || 3}/5`);
      }
    }

    items.push(`Hiện có ${matchedTrails.length} cung vào đúng mùa đẹp trong tháng ${activeMonth}.`);

    return items;
  }, [matchedTrails, activeMonth]);

  const handleExploreSeasonOnMap = useCallback(() => {
    if (onFilterSeasonMonth) {
      // Parent callback handles setting month filter & scrolling to map cleanly (no double scrollIntoView)
      onFilterSeasonMonth(selectedMeteorology.month);
    } else {
      const mapElem = document.getElementById('gis-map-section') || document.getElementById('map-view-container');
      if (mapElem) {
        mapElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    if (onExploreFilter) {
      onExploreFilter(selectedMeteorology.label);
    }
  }, [onFilterSeasonMonth, onExploreFilter, selectedMeteorology.month, selectedMeteorology.label]);

  return (
    <section
      style={{
        padding: '44px 0 36px 0',
        maxWidth: 1320,
        margin: '0 auto',
      }}
    >
      {/* Editorial Header */}
      <div style={{ marginBottom: 24 }}>
        <div className="section-eyebrow">02 / Lịch mùa theo tháng</div>
        <h2
          className="font-editorial"
          style={{
            fontSize: 'clamp(1.75rem, 3.2vw, 2.55rem)',
            fontWeight: 500,
            color: 'var(--color-text-main)',
            letterSpacing: '-0.025em',
            margin: '0 0 6px 0',
            lineHeight: 1.12,
          }}
        >
          Nên đi đâu vào{' '}
          <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
            {selectedMeteorology.label}?
          </span>
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', maxWidth: 640, margin: 0 }}>
          Mùa hoa rừng, mùa lúa chín, săn mây và thời tiết vùng cao gom lại từ thực tế của {trails.length} cung đường Việt Nam.
        </p>
      </div>

      {/* Minimalist Topographic 12-Month Ruler with Liquid Gold Glider */}
      <div
        ref={monthTrackRef}
        className="lost-glider-track"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, minmax(56px, 1fr))',
          overflowX: 'auto',
          borderTop: '1px solid var(--color-border-strong)',
          borderBottom: '1px solid var(--color-border)',
          marginBottom: 22,
        }}
      >
        <span
          aria-hidden="true"
          className="lost-glider-gold"
          style={monthIndicatorStyle}
        />
        {MONTH_METEOROLOGY.map((item) => {
          const isActive = item.month === activeMonth;
          const isNow = item.month === currentCalendarMonth;

          return (
            <button
              key={item.month}
              type="button"
              aria-pressed={isActive}
              data-glider-active={isActive ? 'true' : undefined}
              onClick={() => setActiveMonth(item.month)}
              className="lost-glider-item"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '13px 4px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                position: 'relative',
                transition: 'color 200ms ease',
              }}
            >
              {isNow && (
                <span
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 8,
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                  }}
                  title="Tháng hiện tại"
                />
              )}
              <span
                className={isActive ? 'font-editorial' : undefined}
                style={{
                  fontSize: isActive ? '1.15rem' : '0.84rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--color-text-main)' : 'var(--color-text-dim)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.1,
                }}
              >
                {String(item.month).padStart(2, '0')}
              </span>
              <span
                style={{
                  fontSize: '0.62rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: isActive ? 'var(--color-sun)' : 'var(--color-text-dim)',
                  marginTop: 4,
                }}
              >
                Th.{item.month}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Season Overview Grid (Smooth Cross-Fade on Month Switch) */}
      <div
        key={activeMonth}
        className="card tab-content-slide"
        style={{
          padding: '22px 24px',
          borderRadius: 6,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
          gap: 28,
          alignItems: 'stretch',
        }}
      >
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                  border: '1px solid var(--color-border)',
                  color: selectedMeteorology.color,
                  padding: '4px 10px',
                  borderRadius: 4,
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
                fontSize: 'clamp(1.25rem, 2.2vw, 1.75rem)',
                fontWeight: 900,
                color: 'var(--color-text-main)',
                marginBottom: 12,
                lineHeight: 1.25,
              }}
            >
              {selectedMeteorology.seasonTheme}
            </h3>

            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 18 }}>
              {selectedMeteorology.overviewText}
            </p>

            {/* Weather & Radar Gauges (Mobile-safe responsive grid) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(88px, 100%), 1fr))',
                gap: 8,
                marginBottom: 20,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <div style={{ textAlign: 'center', background: 'var(--color-bg-main)', padding: '9px 10px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', marginBottom: 2 }}>Nhiệt độ</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-sun)' }}>{selectedMeteorology.tempRange}</div>
              </div>
              <div style={{ textAlign: 'center', background: 'var(--color-bg-main)', padding: '9px 10px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', marginBottom: 2 }}>Săn mây</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-sky)' }}>{selectedMeteorology.cloudChance}</div>
              </div>
              <div style={{ textAlign: 'center', background: 'var(--color-bg-main)', padding: '9px 10px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', marginBottom: 2 }}>Địa hình</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-primary)' }}>{selectedMeteorology.terrainState}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {dynamicHighlights.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.86rem', color: 'var(--color-text-muted)' }}>
                  <span style={{ color: selectedMeteorology.color, fontWeight: 900, marginTop: 1 }}>·</span>
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
              borderRadius: 4,
              padding: '12px 14px',
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
                Lời dặn trước giờ đi
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
            borderRadius: 6,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>
                Gợi ý đi trong tháng {selectedMeteorology.month}
              </h4>
              {matchedTrails.length > 0 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                  {matchedTrails.length} cung
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {matchedTrails.slice(0, 3).map((trail, idx) => (
                <button
                  key={trail.id || (trail as Trail & { _id?: string })._id || `matched-trail-${idx}`}
                  type="button"
                  onClick={() => onSelectTrail?.(trail)}
                  className="interactive-click card-hover-lift scene-card-enter"
                  style={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    textAlign: 'left',
                    width: '100%',
                    ['--stagger-i' as string]: idx,
                  }}
                >
                  <img
                    src={trail.coverImage || selectedMeteorology.fallbackImage}
                    alt={trail.name}
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 4,
                      objectFit: 'cover',
                      flexShrink: 0,
                      border: '1px solid var(--color-border)',
                    }}
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.dataset.fallbackApplied) return;
                      img.dataset.fallbackApplied = '1';
                      img.src = selectedMeteorology.fallbackImage;
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
                          lineHeight: 1.38,
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
                            background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                            border: '1px solid var(--color-border)',
                            padding: '2px 8px',
                            borderRadius: 4,
                            color: 'var(--color-primary)',
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {trail.province}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--color-text-dim)', display: 'flex', gap: 12, flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
                      <span>Độ cao: <strong style={{ color: 'var(--color-sun)' }}>{trail.maxAltitudeM.toLocaleString('vi-VN')}m</strong></span>
                      <span>Cự ly: <strong style={{ color: 'var(--color-sky)' }}>{trail.distanceKm}km</strong></span>
                      <span>Độ khó: <strong style={{ color: 'var(--color-primary)' }}>{trail.difficultyLevel}/5</strong></span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleExploreSeasonOnMap}
            className="interactive-click"
            style={{
              marginTop: 16,
              padding: '11px 14px',
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
              border: '1px solid var(--color-border-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconCompass size={16} color="var(--color-primary)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                Xem cả {matchedTrails.length} cung tháng {selectedMeteorology.month} trên bản đồ
              </span>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 800, flexShrink: 0 }}>Mở bản đồ</span>
          </button>
        </div>
      </div>
    </section>
  );
};

export const SeasonExpeditionRadar = React.memo(SeasonExpeditionRadarBase);
