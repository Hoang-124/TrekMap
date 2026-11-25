import React, { useMemo, useRef, useState } from 'react';
import type { Trail } from '../../types.js';
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator.js';
import { SummitWeatherRadar } from './SummitWeatherRadar.js';
import { SummitClimateChart } from '../weather/SummitClimateChart.js';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBot,
  IconCalendar,
  IconCloud,
  IconCompass,
  IconFlower,
  IconHiking,
  IconMountain,
  IconScale,
  IconSearch,
  IconSun,
} from '../common/SvgIcons.js';

export interface SeasonAlmanacViewProps {
  trails: Trail[];
  onSelectTrail?: (trail: Trail) => void;
  onNavigateHub?: (hub: 'training' | 'directory' | 'planner' | 'toolkit', trailId?: string) => void;
  onBack?: () => void;
}

type PhenomenonFilter = 'all' | 'cloud_hunting' | 'flowers_foliage' | 'dry_south_highlands' | 'avoid_storm';
type RegionFilter = 'Tất Cả' | 'Miền Bắc' | 'Miền Trung' | 'Miền Nam';

interface MonthlyBriefing {
  headline: string;
  north: { status: 'ideal' | 'caution' | 'avoid'; note: string };
  central: { status: 'ideal' | 'caution' | 'avoid'; note: string };
  south: { status: 'ideal' | 'caution' | 'avoid'; note: string };
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const REGION_OPTIONS: RegionFilter[] = ['Tất Cả', 'Miền Bắc', 'Miền Trung', 'Miền Nam'];

const CLOUD_HUNTING_SLUGS = new Set([
  'trail-fansipan',
  'trail-pusilung',
  'trail-putaleng',
  'trail-kyquansan',
  'trail-tachinhu',
  'trail-nhiucosan',
  'trail-lungcung',
  'trail-taxua',
  'trail-laothan',
  'trail-nguchison',
  'trail-tayconlinh',
  'trail-puluong',
  'trail-bidoup',
  'trail-tanangphandung',
  'trail-talienson',
  'trail-khangsuvan',
  'trail-namkanghotao',
  'trail-phaluong',
  'trail-binhlieu',
]);

const FLOWERS_FOLIAGE_SLUGS = new Set([
  'trail-putaleng',
  'trail-fansipan',
  'trail-pusilung',
  'trail-kyquansan',
  'trail-tachinhu',
  'trail-lungcung',
  'trail-tayconlinh',
  'trail-bachma',
  'trail-chuyangsin',
  'trail-talienson',
  'trail-khangsuvan',
  'trail-namkanghotao',
  'trail-phaluong',
  'trail-binhlieu',
]);

// Central Highlands (Tây Nguyên) & dry South-Central coast trails paired with Miền Nam (excludes North/Central monsoon trails like Pù Luông, Bạch Mã, Giếng Trời)
const HIGHLANDS_AND_SOUTH_CENTRAL_DRY_SLUGS = new Set([
  'trail-chuyangsin',
  'trail-thack50',
  'trail-nuichua',
  'trail-muidoi',
  'trail-honba',
]);
const HIGHLANDS_PROVINCE_TOKENS = ['dak lak', 'dak nong', 'gia lai', 'kon tum', 'lam dong', 'ninh thuan', 'khanh hoa'];

const MONTHLY_CLIMATE_BRIEFINGS: Record<number, MonthlyBriefing> = {
  1: {
    headline: 'Chính đông Tây Bắc rét sâu (dễ có băng giá trên 2.600m) — Tây Nguyên & Nam Bộ bước vào mùa khô đẹp',
    north: {
      status: 'ideal',
      note: 'Biển mây dày đẹp sau mỗi đợt gió mùa; đêm trên 2.400m có thể xuống 0–4°C và có băng giá trên Fansipan, Pu Ta Leng, Kỳ Quan San. Nhớ mang túi ngủ -5°C và áo lông vũ.',
    },
    central: {
      status: 'ideal',
      note: 'Tây Nguyên (Chư Yang Sin, Thác K50) và duyên hải Khánh Hòa – Ninh Thuận vào mùa khô ráo. Riêng Bạch Mã vẫn còn sương mù và mưa phùn lạnh nhẹ.',
    },
    south: {
      status: 'ideal',
      note: 'Thời điểm đẹp nhất miền Nam: Tà Năng – Phan Dũng vào mùa cỏ cháy vàng óng, Bidoup – Cát Tiên khô ráo ít vắt, Bà Đen và Chứa Chan trời trong.',
    },
  },
  2: {
    headline: 'Giao mùa sang xuân — Tây Bắc chớm mùa hoa rừng, cả nước khô ráo dễ bước',
    north: {
      status: 'ideal',
      note: 'Nắng ấm dần, biển mây Tà Xùa, Lảo Thẩn, Lùng Cúng khá đều. Đào rừng và đỗ quyên sớm bắt đầu hé nụ dọc Hoàng Liên Sơn.',
    },
    central: {
      status: 'ideal',
      note: 'VQG Bạch Mã, Giếng Trời Đà Nẵng, Thác K50, Mũi Đôi và VQG Núi Chúa tạnh ráo, tầm nhìn thoáng, nước suối trong xanh.',
    },
    south: {
      status: 'ideal',
      note: 'Sáng khô mát dễ đi, nhưng trưa nắng đã bắt đầu gắt trên Bà Đen, Chứa Chan và đồi cỏ Tà Năng — nên xuất phát sớm từ 05:30.',
    },
  },
  3: {
    headline: 'Rộ mùa hoa đỗ quyên cổ thụ Hoàng Liên Sơn — cả ba miền đều vào mùa đi núi đẹp',
    north: {
      status: 'ideal',
      note: 'Hoa đỗ quyên nở rực nhất năm trên Pu Ta Leng, Fansipan, Pu Si Lung, Tây Côn Lĩnh và Kỳ Quan San. Trời mát dễ chịu, vẫn dễ gặp biển mây.',
    },
    central: {
      status: 'ideal',
      note: 'Đỗ quyên đỏ ở VQG Bạch Mã nở dọc Thác Đỗ Quyên 300m. Chư Yang Sin, Thác K50, Mũi Đôi và Núi Chúa đều khô ráo, đi rất sướng.',
    },
    south: {
      status: 'ideal',
      note: 'Cao điểm mùa khô: VQG Cát Tiên (Bàu Sấu) dễ quan sát cá sấu Xiêm và chim nước; các cung nắng nhớ mang ít nhất 3L nước kèm điện giải.',
    },
  },
  4: {
    headline: 'Cuối mùa đẹp Tây Bắc — thời điểm rực rỡ cho suối thác Miền Trung & Cực Đông',
    north: {
      status: 'ideal',
      note: 'Trời ấm dần, hoa đỗ quyên nở muộn ở độ cao trên 2.800m (Pu Ta Leng, Fansipan). Cuối tháng hay có dông chiều bất chợt nên để ý giờ xuống núi.',
    },
    central: {
      status: 'ideal',
      note: 'Đẹp nhất năm cho Cực Đông Mũi Đôi, VQG Núi Chúa, Giếng Trời Đà Nẵng, Bạch Mã và Thác K50: biển êm, suối trong.',
    },
    south: {
      status: 'ideal',
      note: 'Đông Nam Bộ nắng gắt (Bà Đen, Chứa Chan, Núi Dinh) nên đi sớm tránh sốc nhiệt. Riêng Bidoup vẫn mát lạnh quanh năm.',
    },
  },
  5: {
    headline: 'Chớm mùa mưa sớm — lúa chín Pù Luông & cỏ xanh đầu mưa Tà Năng',
    north: {
      status: 'caution',
      note: 'Vùng núi Tây Bắc và Đông Bắc bắt đầu có mưa dông chiều, đường đất sét trơn và có vắt rừng. Pu Ta Leng vẫn còn hoa đỗ quyên nở muộn.',
    },
    central: {
      status: 'ideal',
      note: 'Pù Luông vào vụ lúa chín đầu tiên rất đẹp. Giếng Trời, Bạch Mã, Thác K50, Mũi Đôi và Núi Chúa vẫn khô ráo.',
    },
    south: {
      status: 'ideal',
      note: 'Mưa đầu mùa làm đồi cỏ Tà Năng – Phan Dũng chuyển xanh mướt, đường vẫn đi ổn trước mùa nước lớn tháng 7.',
    },
  },
  6: {
    headline: 'Tây Bắc vào mùa mưa lũ (dễ sạt lở) — chuyển hướng sang suối thác Miền Trung & Cực Đông',
    north: {
      status: 'avoid',
      note: 'Mưa lớn kéo dài trên Hoàng Liên Sơn và Đông Bắc dễ gây lũ quét khe suối, sạt lở đường và sét đánh trên đỉnh trống. Nên gác lại các đỉnh trên 2.400m.',
    },
    central: {
      status: 'ideal',
      note: 'Mùa đẹp nhất của Miền Trung: Giếng Trời Đà Nẵng, Bạch Mã, Cực Đông Mũi Đôi, VQG Núi Chúa nắng ráo, biển xanh.',
    },
    south: {
      status: 'caution',
      note: 'Chiều hay mưa rào; VQG Cát Tiên bắt đầu nhiều vắt, đồi cỏ Tà Năng xanh đẹp nhưng cần xem kỹ mưa thượng nguồn trước khi đi.',
    },
  },
  7: {
    headline: 'Cao điểm mưa bão miền Bắc & mưa Tây Nguyên — ưu tiên các cung ven biển Miền Trung',
    north: {
      status: 'avoid',
      note: 'Nguy cơ lũ ống, lũ quét và sạt lở đường vào bản rất cao ở Lào Cai, Lai Châu, Yên Bái, Hà Giang. Tuyệt đối không lên núi khi có áp thấp hay bão.',
    },
    central: {
      status: 'caution',
      note: 'Duyên hải Miền Trung (Bạch Mã, Giếng Trời, Mũi Đôi, Núi Chúa) vẫn đi ổn, nhưng Chư Yang Sin và Pù Luông đã mưa nhiều, đường trơn.',
    },
    south: {
      status: 'avoid',
      note: 'Cẩn thận nước lũ suối Phan Dũng (Tà Năng – Phan Dũng) và mưa lớn vùng lõi Cát Tiên. Nếu đi núi trong ngày (Bà Đen, Núi Dinh) nên đi sớm và xuống trước dông chiều.',
    },
  },
  8: {
    headline: 'Mưa lớn miền Bắc & Tây Nguyên — theo dõi sát bão Biển Đông trước khi chốt lịch',
    north: {
      status: 'avoid',
      note: 'Tháng mưa nhiều nhất Tây Bắc, vách đá Ngũ Chỉ Sơn, Tà Xùa, Kỳ Quan San rất trơn và mù đặc.',
    },
    central: {
      status: 'caution',
      note: 'Đầu tháng vẫn nắng ráo ở Bạch Mã, Mũi Đôi, Núi Chúa; cuối tháng Tây Nguyên (Chư Yang Sin, K50) bắt đầu mưa rào nhiều hơn.',
    },
    south: {
      status: 'avoid',
      note: 'Đường ẩm trơn, hay có sấm sét buổi chiều và nước suối dâng cao ở Phan Dũng, Chứa Chan, Cát Tiên. Không hạ trại sát mép suối.',
    },
  },
  9: {
    headline: 'Thu về Tây Bắc (lúa chín Pù Luông & Lảo Thẩn mở mùa) — Trung Bộ vào mùa mưa',
    north: {
      status: 'caution',
      note: 'Từ giữa đến cuối tháng 9 trời bắt đầu khô dần: Lảo Thẩn, Tà Chì Nhù mở mùa săn mây sớm, nhưng vẫn nên ngó dự báo bão cuối mùa.',
    },
    central: {
      status: 'caution',
      note: 'Pù Luông bước vào mùa lúa chín vàng đẹp nhất năm. Ngược lại, Đà Nẵng (Giếng Trời) và Gia Lai (Thác K50) bắt đầu mưa lớn cần thận trọng.',
    },
    south: {
      status: 'avoid',
      note: 'Cao điểm mưa Nam Bộ & Tây Nguyên: cảnh giác lũ quét Phan Dũng, Bidoup nhiều vắt và sương mù, Núi Dinh và Bà Đen dễ trượt.',
    },
  },
  10: {
    headline: 'Mở mùa vàng săn mây Tây Bắc & hoa Chi Pâu Tà Chì Nhù — né mưa bão Trung Bộ',
    north: {
      status: 'ideal',
      note: 'Mùa đi núi đẹp nhất năm bắt đầu: hoa tím Chi Pâu phủ sườn Tà Chì Nhù, biển mây ngập Lảo Thẩn, Tà Xùa, Fansipan, Kỳ Quan San, Ngũ Chỉ Sơn.',
    },
    central: {
      status: 'avoid',
      note: 'Cao điểm mưa bão miền Trung (Bạch Mã, Giếng Trời, Thác K50, Mũi Đôi sóng lớn, Núi Chúa mưa rừng). Không nhảy ghềnh Mũi Đôi khi biển động.',
    },
    south: {
      status: 'caution',
      note: 'Cuối tháng 10 mưa đã ngớt dần nhưng suối Phan Dũng nước còn cao và đường đất đỏ Tây Nguyên vẫn lầy.',
    },
  },
  11: {
    headline: 'Mùa vàng săn mây, lá phong đỏ Lùng Cúng & miền Nam bước vào mùa khô',
    north: {
      status: 'ideal',
      note: 'Đi đâu ở Tây Bắc và Đông Bắc cũng đẹp: Lùng Cúng có lá phong đỏ cùng đồi cỏ cháy, Tà Chì Nhù cuối mùa Chi Pâu, Pu Si Lung và Pu Ta Leng khô ráo.',
    },
    central: {
      status: 'avoid',
      note: 'Trung Trung Bộ và Nam Trung Bộ (Bạch Mã, Giếng Trời, Mũi Đôi, Núi Chúa) vẫn hay có mưa lũ muộn; riêng Pù Luông khô ráo rất đẹp.',
    },
    south: {
      status: 'ideal',
      note: 'Nam Bộ và Lâm Đồng chính thức vào mùa khô mát: Bidoup, Tà Năng – Phan Dũng, Bà Đen, Chứa Chan, Núi Dinh đều đẹp.',
    },
  },
  12: {
    headline: 'Hai đầu đất nước cùng khô ráo — Tây Bắc săn mây rét sâu & Tây Nguyên trong trẻo',
    north: {
      status: 'ideal',
      note: 'Khả năng gặp biển mây cao nhất năm trên cả 19 cung Miền Bắc (Fansipan, Pu Si Lung, Pu Ta Leng, Kỳ Quan San, Tà Liên Sơn, Tà Xùa, Lảo Thẩn, Ngũ Chỉ Sơn, Tây Côn Lĩnh). Đêm rét đậm.',
    },
    central: {
      status: 'caution',
      note: 'Chư Yang Sin (Đắk Lắk) và Pù Luông khô ráo dễ đi; Bạch Mã, Giếng Trời và Mũi Đôi vẫn còn mưa lạnh và gió Đông Bắc.',
    },
    south: {
      status: 'ideal',
      note: 'Đẹp trên mọi cung: VQG Cát Tiên (Bàu Sấu) khô ráo ít vắt, Bidoup mát lạnh, Tà Năng cỏ ngả vàng, Bà Đen và Chứa Chan trời quang.',
    },
  },
};

function getCurrentVietnamMonth(): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      month: 'numeric',
    }).formatToParts(new Date());
    const monthPart = parts.find((p) => p.type === 'month')?.value;
    const parsed = Number(monthPart);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 12) return parsed;
  } catch {
    // fallback below
  }
  return new Date().getMonth() + 1;
}

function normalizeVn(input: string): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

function getMonthStatus(trail: Trail, month: number): 'ideal' | 'caution' | 'avoid' {
  if (trail.avoidMonths.includes(month)) return 'avoid';
  if (trail.bestMonths.includes(month)) return 'ideal';
  return 'caution';
}

function getStatusVisual(status: 'ideal' | 'caution' | 'avoid'): { label: string; color: string; accent: string } {
  if (status === 'ideal') return { label: 'Vào mùa đẹp', color: 'var(--color-primary)', accent: 'var(--color-primary)' };
  if (status === 'avoid') return { label: 'Nên tránh', color: 'var(--color-error-text, var(--color-error))', accent: 'var(--color-error)' };
  return { label: 'Xem kỹ thời tiết', color: 'var(--color-earth)', accent: 'var(--color-earth)' };
}

export const SeasonAlmanacView: React.FC<SeasonAlmanacViewProps> = ({
  trails,
  onSelectTrail,
  onNavigateHub,
  onBack,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<number>(() => getCurrentVietnamMonth());
  const { trackRef: almanacMonthTrackRef, indicatorStyle: almanacMonthIndicatorStyle } =
    useSlidingIndicator<number>(selectedMonth);
  const [phenomenon, setPhenomenon] = useState<PhenomenonFilter>('all');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('Tất Cả');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isClimateOpen, setIsClimateOpen] = useState<boolean>(false);
  const [climateTrailId, setClimateTrailId] = useState<string>('');
  const [focusedSafetyMonth, setFocusedSafetyMonth] = useState<number | null>(null);
  const climatePanelRef = useRef<HTMLDivElement | null>(null);
  const safetyMonthRefs = useRef<Array<SVGGElement | null>>([]);

  const briefing = MONTHLY_CLIMATE_BRIEFINGS[selectedMonth] || MONTHLY_CLIMATE_BRIEFINGS[1];

  // Aggregate counts per month across all catalog trails for the pure-SVG seasonal chart
  const monthlySummary = useMemo(() => {
    return MONTHS.map((m) => {
      let ideal = 0;
      let caution = 0;
      let avoid = 0;
      trails.forEach((t) => {
        const st = getMonthStatus(t, m);
        if (st === 'ideal') ideal += 1;
        else if (st === 'avoid') avoid += 1;
        else caution += 1;
      });
      return { month: m, ideal, caution, avoid };
    });
  }, [trails]);

  const filteredTrails = useMemo(() => {
    const q = normalizeVn(searchQuery);
    const list = trails.filter((t) => {
      if (regionFilter !== 'Tất Cả' && t.region !== regionFilter) return false;

      if (phenomenon === 'cloud_hunting' && !CLOUD_HUNTING_SLUGS.has(t.id)) return false;
      if (phenomenon === 'flowers_foliage' && !FLOWERS_FOLIAGE_SLUGS.has(t.id)) return false;
      if (phenomenon === 'dry_south_highlands') {
        const normProv = normalizeVn(t.province);
        const isSouthOrHighlands =
          t.region === 'Miền Nam' ||
          HIGHLANDS_AND_SOUTH_CENTRAL_DRY_SLUGS.has(t.id) ||
          HIGHLANDS_PROVINCE_TOKENS.some((tok) => normProv.includes(tok));
        if (!isSouthOrHighlands || t.avoidMonths.includes(selectedMonth)) return false;
      }
      if (phenomenon === 'avoid_storm' && !t.avoidMonths.includes(selectedMonth)) return false;

      if (!q) return true;
      const hay = normalizeVn([t.name, t.province, t.district, ...(t.altNames || [])].join(' '));
      return hay.includes(q);
    });

    // Sort ideal trails for selectedMonth first, then by altitude desc
    const rank = { ideal: 0, caution: 1, avoid: 2 };
    return [...list].sort((a, b) => {
      const ra = rank[getMonthStatus(a, selectedMonth)];
      const rb = rank[getMonthStatus(b, selectedMonth)];
      if (ra !== rb) return ra - rb;
      return b.maxAltitudeM - a.maxAltitudeM;
    });
  }, [trails, regionFilter, phenomenon, selectedMonth, searchQuery]);

  const selectedStats = monthlySummary[selectedMonth - 1] || { month: selectedMonth, ideal: 0, caution: 0, avoid: 0 };

  const selectedClimateTrail = useMemo<Trail | null>(() => {
    if (climateTrailId) {
      const exact = trails.find((t) => t.id === climateTrailId);
      if (exact) return exact;
    }
    return filteredTrails[0] || trails[0] || null;
  }, [climateTrailId, trails, filteredTrails]);

  const handleInspectTrailClimate = (trail: Trail) => {
    setClimateTrailId(trail.id);
    setIsClimateOpen(true);
    window.requestAnimationFrame(() => {
      climatePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const handleAskAiGoNoGo = (trail: Trail) => {
    const prompt = `Tháng ${selectedMonth} này đi cung ${trail.name} (${trail.province}) có ổn không? Giúp mình xem thời tiết, khả năng săn mây và những điểm cần lưu ý.`;
    window.dispatchEvent(
      new CustomEvent('lost:open-ai-assistant', {
        detail: {
          prompt,
          trailId: trail.id,
          trailName: trail.name,
        },
      })
    );
  };

  return (
    <section
      style={{
        maxWidth: 1240,
        margin: '0 auto',
        padding: '24px 16px 64px',
        fontFamily: 'var(--font-family)',
        color: 'var(--color-text-main)',
      }}
    >
      {/* Editorial Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="btn btn-outline"
              style={{ padding: '6px 12px', fontSize: '0.78rem', borderRadius: 4, marginBottom: 12 }}
            >
              <IconArrowLeft size={14} />
              <span>Quay lại</span>
            </button>
          )}
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--color-primary)',
              marginBottom: 4,
            }}
          >
            Lịch mùa đi rừng • Thời tiết &amp; săn mây 12 tháng
          </div>
          <h1
            className="font-editorial"
            style={{ margin: 0, fontSize: 'clamp(1.45rem, 2.6vw, 2rem)', fontWeight: 600, lineHeight: 1.2 }}
          >
            Đi mùa nào đẹp trên {trails.length} cung núi Việt Nam
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: 'var(--color-text-muted)', maxWidth: 760, lineHeight: 1.55 }}>
            Chọn tháng bạn định đi để biết đỉnh nào đang vào mùa mây, hoa đỗ quyên, lá phong hay khô ráo dễ bước — và né sớm những tháng mưa lũ, sạt lở ở cả ba miền.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '10px 14px',
            borderRadius: 6,
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <div style={{ textAlign: 'center', paddingRight: 10, borderRight: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-primary)' }}>{selectedStats.ideal}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Vào mùa T{selectedMonth}</div>
          </div>
          <div style={{ textAlign: 'center', paddingRight: 10, borderRight: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-earth)' }}>{selectedStats.caution}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Cân nhắc</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-error-text, var(--color-error))' }}>{selectedStats.avoid}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Nên tránh</div>
          </div>
        </div>
      </div>

      {/* Live Vietnam Summit Weather & Sea-of-Clouds Radar */}
      <div style={{ marginBottom: 20 }}>
        <SummitWeatherRadar trails={trails} onSelectTrail={onSelectTrail} />
      </div>

      {/* 12-Month Selector Grid with Liquid Glider */}
      <div
        ref={almanacMonthTrackRef}
        role="tablist"
        aria-label="Chọn tháng trekking trong năm"
        className="lost-glider-track"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(84px, 100%), 1fr))',
          gap: 6,
          marginBottom: 18,
        }}
      >
        <span
          aria-hidden="true"
          className="lost-glider-pill with-accent"
          style={almanacMonthIndicatorStyle}
        />
        {monthlySummary.map((ms) => {
          const active = ms.month === selectedMonth;
          return (
            <button
              key={ms.month}
              type="button"
              role="tab"
              aria-selected={active}
              data-glider-active={active ? 'true' : undefined}
              className="lost-glider-item"
              onClick={() => setSelectedMonth(ms.month)}
              style={{
                padding: '9px 6px',
                borderRadius: 4,
                cursor: 'pointer',
                border: active ? '1px solid transparent' : '1px solid var(--color-border)',
                background: active ? 'transparent' : 'var(--color-bg-card)',
                color: active ? 'var(--color-primary)' : 'var(--color-text-main)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                fontFamily: 'var(--font-family)',
                fontVariantNumeric: 'tabular-nums',
                transition: 'color 200ms ease, border-color 200ms ease',
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: active ? 800 : 600 }}>Tháng {ms.month}</span>
              <span style={{ fontSize: '0.67rem', color: active ? 'var(--color-primary)' : 'var(--color-text-dim)' }}>
                {ms.ideal} cung đẹp
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Month Regional Climate Briefing + Pure SVG Annual Suitability Chart */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            gridColumn: 'span 1',
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border-strong)',
            borderTop: '3px solid var(--color-sky)',
            borderRadius: 6,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-sky)' }}>
              <IconCalendar size={13} color="var(--color-sky)" />
              <span>Thời tiết đường rừng tháng {selectedMonth}</span>
            </div>
            <h2 style={{ margin: '4px 0 0', fontSize: '0.96rem', fontWeight: 700, color: 'var(--color-text-main)', lineHeight: 1.4 }}>
              {briefing.headline}
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { title: 'Miền Bắc (Hoàng Liên Sơn & Đông Bắc)', data: briefing.north },
              { title: 'Miền Trung & Tây Nguyên (Trường Sơn & duyên hải)', data: briefing.central },
              { title: 'Miền Nam (Đông Nam Bộ & nam Tây Nguyên)', data: briefing.south },
            ].map((reg) => {
              const vis = getStatusVisual(reg.data.status);
              return (
                <div
                  key={reg.title}
                  style={{
                    padding: '9px 11px',
                    borderRadius: 4,
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    borderLeft: `3px solid ${vis.accent}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '0.78rem', color: 'var(--color-text-main)' }}>{reg.title}</strong>
                    <span
                      style={{
                        fontSize: '0.67rem',
                        fontWeight: 700,
                        color: vis.color,
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: `color-mix(in srgb, ${vis.accent} 10%, var(--color-bg-card))`,
                      }}
                    >
                      {vis.label}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    {reg.data.note}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pure Inline SVG 12-Month National Suitability Distribution Chart */}
        <div
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-primary)' }}>
              Mức độ thuận lợi qua 12 tháng
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.77rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
              Nhìn nhanh tháng nào nhiều cung đẹp, tháng nào hay mưa bão — bấm thẳng vào cột tháng để đổi lịch.
            </p>
          </div>

          <svg
            viewBox="0 0 540 175"
            width="100%"
            role="group"
            aria-label="Biểu đồ phân bổ độ an toàn trekking 12 tháng tại Việt Nam"
            style={{ display: 'block', height: 'auto' }}
          >
            {[25, 65, 105, 145].map((y) => (
              <line key={y} x1="10" y1={y} x2="530" y2={y} stroke="var(--color-border)" strokeDasharray="3 3" />
            ))}
            {monthlySummary.map((ms, idx) => {
              const total = Math.max(1, trails.length);
              const slotW = 520 / 12;
              const barW = 24;
              const cx = 10 + idx * slotW + slotW / 2;
              const x = cx - barW / 2;
              const maxH = 120;
              const hIdeal = (ms.ideal / total) * maxH;
              const hCaution = (ms.caution / total) * maxH;
              const hAvoid = (ms.avoid / total) * maxH;
              const active = ms.month === selectedMonth;
              const isFocused = ms.month === focusedSafetyMonth;

              return (
                <g
                  key={ms.month}
                  ref={(el) => {
                    safetyMonthRefs.current[idx] = el;
                  }}
                  role="button"
                  tabIndex={active ? 0 : -1}
                  aria-pressed={active}
                  aria-label={`Chọn Tháng ${ms.month}: ${ms.ideal} cung lý tưởng, ${ms.caution} cân nhắc, ${ms.avoid} nên tránh`}
                  onClick={() => setSelectedMonth(ms.month)}
                  onFocus={() => setFocusedSafetyMonth(ms.month)}
                  onBlur={() => setFocusedSafetyMonth(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedMonth(ms.month);
                    } else if (e.key === 'ArrowRight') {
                      e.preventDefault();
                      const nextIdx = (idx + 1) % monthlySummary.length;
                      setSelectedMonth(monthlySummary[nextIdx].month);
                      safetyMonthRefs.current[nextIdx]?.focus();
                    } else if (e.key === 'ArrowLeft') {
                      e.preventDefault();
                      const prevIdx = (idx - 1 + monthlySummary.length) % monthlySummary.length;
                      setSelectedMonth(monthlySummary[prevIdx].month);
                      safetyMonthRefs.current[prevIdx]?.focus();
                    }
                  }}
                  style={{ cursor: 'pointer', outline: 'none' }}
                >
                  {(active || isFocused) && (
                    <rect
                      x={x - 4}
                      y={18}
                      width={barW + 8}
                      height={152}
                      rx={4}
                      fill="color-mix(in srgb, var(--color-primary) 10%, transparent)"
                      stroke={isFocused ? 'var(--color-text-main)' : 'var(--color-primary)'}
                      strokeWidth={isFocused ? '1.8' : '1'}
                      strokeDasharray={isFocused ? '3 2' : undefined}
                    />
                  )}
                  <rect x={x} y={145 - hIdeal} width={barW} height={hIdeal} fill="var(--color-primary)" />
                  <rect x={x} y={145 - hIdeal - hCaution} width={barW} height={hCaution} fill="var(--color-earth)" />
                  <rect x={x} y={145 - hIdeal - hCaution - hAvoid} width={barW} height={hAvoid} fill="var(--color-error)" />
                  <text
                    x={cx}
                    y={162}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight={active ? '800' : '600'}
                    fill={active ? 'var(--color-primary)' : 'var(--color-text-muted)'}
                  >
                    T{ms.month}
                  </text>
                </g>
              );
            })}
          </svg>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-primary)', display: 'inline-block' }} />
              Vào mùa đẹp
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-earth)', display: 'inline-block' }} />
              Giao mùa, cần theo dõi
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-error)', display: 'inline-block' }} />
              Mưa lũ / bão, nên tránh
            </span>
          </div>
        </div>
      </div>

      {/* Collapsible Selected-Peak 12-Month NASA POWER (MERRA-2) Summit Climate Inspector */}
      {selectedClimateTrail && (
        <div
          ref={climatePanelRef}
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: 6,
            padding: '14px 16px',
            marginBottom: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                  color: 'var(--color-sky)',
                  marginBottom: 2,
                }}
              >
                <IconCloud size={12} color="var(--color-sky)" />
                <span>NASA POWER (MERRA-2) · Dữ liệu khí hậu 3 năm quy đổi theo độ cao đỉnh</span>
              </div>
              <h2 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                Khí hậu 12 tháng trên đỉnh — {selectedClimateTrail.name}
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0, maxWidth: '100%', flex: '1 1 280px', justifyContent: 'flex-end' }}>
              <select
                className="form-select"
                aria-label="Chọn đỉnh núi xem biểu đồ khí hậu 12 tháng"
                value={selectedClimateTrail.id}
                onChange={(e) => {
                  setClimateTrailId(e.target.value);
                  setIsClimateOpen(true);
                }}
                style={{
                  padding: '6px 10px',
                  fontSize: '0.78rem',
                  borderRadius: 4,
                  flex: '1 1 210px',
                  minWidth: 0,
                  width: '100%',
                  maxWidth: '100%',
                }}
              >
                {trails.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.maxAltitudeM.toLocaleString('vi-VN')}m · {t.province})
                  </option>
                ))}
              </select>

              <button
                type="button"
                className={isClimateOpen ? 'btn btn-outline' : 'btn btn-primary'}
                aria-expanded={isClimateOpen}
                onClick={() => {
                  if (!isClimateOpen && selectedClimateTrail) {
                    setClimateTrailId(selectedClimateTrail.id);
                  }
                  setIsClimateOpen((v) => !v);
                }}
                style={{ padding: '6px 12px', fontSize: '0.76rem', fontWeight: 700, borderRadius: 4, flexShrink: 0 }}
              >
                <IconCloud size={13} color={isClimateOpen ? 'var(--color-sky)' : 'var(--color-on-primary)'} />
                <span>{isClimateOpen ? 'Thu gọn biểu đồ' : 'Xem biểu đồ khí hậu'}</span>
              </button>
            </div>
          </div>

          {isClimateOpen && (
            <SummitClimateChart
              trail={selectedClimateTrail}
              selectedMonth={selectedMonth}
              onSelectMonth={setSelectedMonth}
              compact
            />
          )}
        </div>
      )}

      {/* Phenomenon & Region Filter Bar */}
      <div
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          padding: 14,
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'all' as const, label: 'Tất cả cung', icon: <IconMountain size={13} /> },
            { id: 'cloud_hunting' as const, label: 'Săn biển mây', icon: <IconCloud size={13} /> },
            { id: 'flowers_foliage' as const, label: 'Hoa đỗ quyên, Chi Pâu, lá phong', icon: <IconFlower size={13} /> },
            { id: 'dry_south_highlands' as const, label: 'Mùa khô miền Nam & Tây Nguyên', icon: <IconSun size={13} /> },
            { id: 'avoid_storm' as const, label: `Cung nên tránh T${selectedMonth}`, icon: <IconAlertTriangle size={13} /> },
          ].map((pill) => {
            const active = phenomenon === pill.id;
            const accent = pill.id === 'avoid_storm' ? 'var(--color-error)' : 'var(--color-primary)';
            return (
              <button
                key={pill.id}
                type="button"
                aria-pressed={active}
                onClick={() => setPhenomenon(pill.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 11px',
                  borderRadius: 4,
                  fontSize: '0.76rem',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  border: active ? `1px solid ${accent}` : '1px solid var(--color-border)',
                  background: active
                    ? `color-mix(in srgb, ${accent} 10%, var(--color-bg-card))`
                    : 'var(--color-bg-main)',
                  color: active ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                  fontFamily: 'var(--font-family)',
                }}
              >
                {pill.icon}
                <span>{pill.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {REGION_OPTIONS.map((reg) => {
              const active = regionFilter === reg;
              return (
                <button
                  key={reg}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRegionFilter(reg)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 4,
                    fontSize: '0.74rem',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    border: active ? '1px solid var(--color-sky)' : '1px solid var(--color-border)',
                    background: active
                      ? 'color-mix(in srgb, var(--color-sky) 10%, var(--color-bg-card))'
                      : 'var(--color-bg-main)',
                    color: active ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {reg === 'Tất Cả' ? 'Tất cả' : reg}
                </button>
              );
            })}
          </div>

          <div style={{ position: 'relative', minWidth: 200, flex: '1 1 260px', maxWidth: 320, display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: 10, color: 'var(--color-text-dim)', display: 'inline-flex', pointerEvents: 'none' }}>
              <IconSearch size={14} />
            </span>
            <input
              type="text"
              className="form-input"
              aria-label="Lọc cung đường theo tên đỉnh hoặc tỉnh thành"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên đỉnh, tỉnh thành..."
              style={{ width: '100%', padding: '6px 10px 6px 32px', fontSize: '0.78rem', borderRadius: 4 }}
            />
          </div>
        </div>
      </div>

      {/* 12-Month Matrix Heatmap Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredTrails.length === 0 ? (
          <div
            style={{
              padding: 28,
              textAlign: 'center',
              borderRadius: 6,
              border: '1px dashed var(--color-border)',
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-muted)',
              fontSize: '0.84rem',
            }}
          >
            Tháng {selectedMonth} không có cung nào khớp bộ lọc này. Bạn thử đổi tháng khác hoặc bỏ bớt bộ lọc nhé.
          </div>
        ) : (
          filteredTrails.map((trail) => {
            const status = getMonthStatus(trail, selectedMonth);
            const vis = getStatusVisual(status);

            return (
              <article
                key={trail.id}
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderLeft: `3px solid ${vis.accent}`,
                  borderRadius: 6,
                  padding: '13px 15px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 220, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: '0.67rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 3,
                          color: vis.color,
                          background: `color-mix(in srgb, ${vis.accent} 10%, var(--color-bg-card))`,
                          border: `1px solid color-mix(in srgb, ${vis.accent} 34%, var(--color-border))`,
                        }}
                      >
                        Tháng {selectedMonth}: {vis.label}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                        {trail.province} • {trail.region} • {trail.maxAltitudeM.toLocaleString('vi-VN')}m • Cấp {trail.difficultyLevel}/5
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectTrail?.(trail)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        textAlign: 'left',
                        fontSize: '0.94rem',
                        fontWeight: 700,
                        color: 'var(--color-text-main)',
                        cursor: onSelectTrail ? 'pointer' : 'default',
                        fontFamily: 'var(--font-family)',
                      }}
                    >
                      {trail.name}
                    </button>
                  </div>

                  {/* Quick Hub Deep-Links */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => handleInspectTrailClimate(trail)}
                      style={{
                        padding: '5px 9px',
                        fontSize: '0.73rem',
                        borderRadius: 4,
                        borderColor:
                          isClimateOpen && selectedClimateTrail?.id === trail.id
                            ? 'var(--color-sky)'
                            : undefined,
                      }}
                    >
                      <IconCloud size={13} color="var(--color-sky)" />
                      <span>Khí hậu</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => handleAskAiGoNoGo(trail)}
                      style={{ padding: '5px 9px', fontSize: '0.73rem', borderRadius: 4 }}
                    >
                      <IconBot size={13} color="var(--color-primary)" />
                      <span>Hỏi đi hay hoãn</span>
                    </button>

                    {onNavigateHub && (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => {
                            if (typeof window !== 'undefined') {
                              window.history.pushState(
                                { view: 'toolkit', trailId: trail.id, queryParams: { tab: 'solar' } },
                                '',
                                `/toolkit?trailId=${encodeURIComponent(trail.id)}&tab=solar`
                              );
                              window.dispatchEvent(new PopStateEvent('popstate'));
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            } else {
                              onNavigateHub('toolkit', trail.id);
                            }
                          }}
                          style={{ padding: '5px 9px', fontSize: '0.73rem', borderRadius: 4 }}
                        >
                          <IconSun size={13} color="var(--color-sun)" />
                          <span>Săn mây</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => onNavigateHub('planner', trail.id)}
                          style={{ padding: '5px 9px', fontSize: '0.73rem', borderRadius: 4 }}
                        >
                          <IconCompass size={13} color="var(--color-stream)" />
                          <span>GPX</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => onNavigateHub('directory', trail.id)}
                          style={{ padding: '5px 9px', fontSize: '0.73rem', borderRadius: 4 }}
                        >
                          <IconScale size={13} color="var(--color-sky)" />
                          <span>Chi phí</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => onNavigateHub('training', trail.id)}
                          style={{ padding: '5px 9px', fontSize: '0.73rem', borderRadius: 4 }}
                        >
                          <IconHiking size={13} color="var(--color-earth)" />
                          <span>Rèn sức</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 12-Month Heatmap Bar (mobile-safe horizontal scroll wrapper to prevent 375px clipping) */}
                <div style={{ overflowX: 'auto', paddingBottom: 2 }}>
                  <div
                    aria-label={`Ma trận 12 tháng cho ${trail.name}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                      minWidth: 420,
                      gap: 4,
                    }}
                  >
                    {MONTHS.map((m) => {
                      const cellStatus = getMonthStatus(trail, m);
                      const isSelected = m === selectedMonth;
                      const bg =
                        cellStatus === 'ideal'
                          ? 'var(--color-primary)'
                          : cellStatus === 'avoid'
                            ? 'var(--color-error)'
                            : 'var(--color-surface-elevated)';
                      const textColor =
                        cellStatus === 'ideal'
                          ? 'var(--color-on-primary)'
                          : cellStatus === 'avoid'
                            ? 'var(--color-on-danger)'
                            : 'var(--color-text-muted)';

                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSelectedMonth(m)}
                          title={`Tháng ${m}: ${getStatusVisual(cellStatus).label}`}
                          style={{
                            padding: '5px 2px',
                            borderRadius: 3,
                            border: isSelected
                              ? '2px solid var(--color-text-main)'
                              : '1px solid var(--color-border)',
                            background: bg,
                            color: textColor,
                            fontSize: '0.67rem',
                            fontWeight: isSelected ? 800 : 600,
                            textAlign: 'center',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-family)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          T{m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
};
