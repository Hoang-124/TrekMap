import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Trail, User } from '../../types.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { useFocusTrap, isTopmostFocusTrap } from '../../hooks/useFocusTrap.js';
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator.js';
import {
  VIETNAM_RANGER_STATIONS,
  VERIFIED_GUIDES_EXTENDED,
  type RangerStationSeed,
  type VerifiedGuideExtendedSeed,
} from '../../data/vietnamDirectory.js';
import {
  IconArrowLeft,
  IconCalendar,
  IconCheck,
  IconCheckCircle,
  IconClock,
  IconCompass,
  IconCopy,
  IconFileText,
  IconMapPin,
  IconMountain,
  IconPhone,
  IconScale,
  IconSearch,
  IconSend,
  IconShieldAlert,
  IconShieldCheck,
  IconStar,
  IconTrees,
  IconUsers,
  IconX,
} from '../common/SvgIcons.js';

export interface DirectoryCostViewProps {
  trails: Trail[];
  currentUser?: User | null;
  initialTrailId?: string;
  onSelectTrail?: (trail: Trail) => void;
  onStartTripWithBudget?: (trailId: string, budgetNote: string) => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onBack?: () => void;
}

type ActiveTab = 'rangers' | 'guides' | 'cost';
type RegionFilter = 'Tất Cả' | 'Miền Bắc' | 'Miền Trung' | 'Miền Nam';
type AuthorityFilter = 'all' | 'national_park' | 'ranger_station' | 'rescue_center';
type GuideSort = 'rating' | 'experience' | 'price_asc' | 'price_desc';
type TransportMode = 'xe_khach' | 'limousine' | 'tu_lai';

interface GuideDirectoryItem extends VerifiedGuideExtendedSeed {
  _id?: string;
  id?: string;
}

interface GuideInquiryRecord {
  _id: string;
  guideName?: string;
  guideId?: string | { _id?: string; name?: string; phone?: string };
  trailName: string;
  plannedStartDate: string;
  durationDays: number;
  groupSize: number;
  needPortersCount: number;
  contactPhone: string;
  notes?: string;
  estimatedTotalVnd: number;
  status: 'pending' | 'contacted' | 'confirmed' | 'cancelled';
  createdAt?: string;
}

interface CostLineItem {
  id: string;
  label: string;
  category: 'permit' | 'guide' | 'transport' | 'food_camp' | 'gear';
  detail: string;
  totalVnd: number;
  perPersonVnd: number;
  color: string;
}

interface CostEstimateSummary {
  items: CostLineItem[];
  totalGroupVnd: number;
  perPersonVnd: number;
  source: 'api' | 'local';
}

const REGION_OPTIONS: RegionFilter[] = ['Tất Cả', 'Miền Bắc', 'Miền Trung', 'Miền Nam'];
const LOCAL_INQUIRIES_KEY_PREFIX = 'lost_guide_inquiries_v1';

function getScopedInquiriesKey(userId?: string | null): string {
  const clean = String(userId || '').trim();
  return `${LOCAL_INQUIRIES_KEY_PREFIX}_${clean || 'guest'}`;
}

function readDirectoryUrlParams(): { tab: ActiveTab | null; q: string; trailId: string } {
  if (typeof window === 'undefined') return { tab: null, q: '', trailId: '' };
  try {
    const params = new URLSearchParams(window.location.search);
    const rawTab = (params.get('tab') || '').trim().toLowerCase();
    const tab: ActiveTab | null =
      rawTab === 'rangers' || rawTab === 'guides' || rawTab === 'cost' ? rawTab : null;
    const q = (params.get('q') || '').trim();
    const trailId = (params.get('trailId') || '').trim();
    return { tab, q, trailId };
  } catch {
    return { tab: null, q: '', trailId: '' };
  }
}

function mapApiBreakdownCategory(key?: string): { category: CostLineItem['category']; color: string; fallbackDetail: string } {
  switch (key) {
    case 'permit':
      return {
        category: 'permit',
        color: 'var(--color-primary)',
        fallbackDetail: 'Phí vào rừng, thủ tục đăng ký kiểm lâm & bảo vệ VQG/KBT',
      };
    case 'guide':
    case 'porter':
      return {
        category: 'guide',
        color: 'var(--color-sky)',
        fallbackDetail: 'Đơn giá tham chiếu từ danh bạ HDV/Porter thực tế theo vùng miền',
      };
    case 'transport':
      return {
        category: 'transport',
        color: 'var(--color-earth)',
        fallbackDetail: 'Xe khách giường nằm khứ hồi & trung chuyển tới cửa rừng',
      };
    case 'food':
    case 'camp':
      return {
        category: 'food_camp',
        color: 'var(--color-sun)',
        fallbackDetail: 'Suất ăn trên núi, nước uống điện giải & chi phí lán nghỉ/cắm trại',
      };
    default:
      return {
        category: 'gear',
        color: 'var(--color-stream)',
        fallbackDetail: 'Hạng mục hậu cần & dự phòng thực địa',
      };
  }
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

function extractPrimaryDialPhone(raw: string): string {
  const firstSegment = String(raw || '').split(/[/,;]/)[0] || '';
  return firstSegment.replace(/[^0-9+]/g, '');
}

function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')} VNĐ`;
}

async function copyTextSafe(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback
    }
  }
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function getAuthorityMeta(type: RangerStationSeed['authorityType']): {
  label: string;
  accent: string;
  textColor: string;
} {
  switch (type) {
    case 'national_park':
      return { label: 'VQG / KBT', accent: 'var(--color-primary)', textColor: 'var(--color-primary)' };
    case 'ranger_station':
      return { label: 'Kiểm Lâm', accent: 'var(--color-earth)', textColor: 'var(--color-earth)' };
    case 'border_guard':
      return { label: 'Biên Phòng', accent: 'var(--color-sky)', textColor: 'var(--color-sky)' };
    case 'rescue_center':
    default:
      return {
        label: 'Cứu Nạn 24/7',
        accent: 'var(--color-error)',
        textColor: 'var(--color-error-text, var(--color-error))',
      };
  }
}

function getInquiryStatusMeta(status: GuideInquiryRecord['status']): { label: string; color: string } {
  switch (status) {
    case 'confirmed':
      return { label: 'Đã xác nhận', color: 'var(--color-primary)' };
    case 'contacted':
      return { label: 'Đã liên hệ', color: 'var(--color-sky)' };
    case 'cancelled':
      return { label: 'Đã hủy', color: 'var(--color-text-dim)' };
    case 'pending':
    default:
      return { label: 'Đang chờ phản hồi', color: 'var(--color-earth)' };
  }
}

function getDefaultFutureDate(daysAhead: number): string {
  const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function estimateLocalTripCost(params: {
  trail: Trail | undefined;
  groupSize: number;
  days: number;
  transportMode: TransportMode;
  needGuide: boolean;
  portersCount: number;
  includeGearRental: boolean;
  includeHomestay: boolean;
}): CostEstimateSummary {
  const { trail, groupSize, days, transportMode, needGuide, portersCount, includeGearRental, includeHomestay } = params;
  const safeGroup = Math.max(1, Math.min(15, groupSize));
  const safeDays = Math.max(1, Math.min(7, days));
  const nights = Math.max(0, safeDays - 1);
  const id = trail?.id || '';
  const region = trail?.region || 'Miền Bắc';

  // 1. Real Vietnam National Park / Permit / Entrance Fees per person (covers all 36 DEM trails)
  let permitPerPerson: number;
  let permitNote = 'Miễn phí vào rừng (dự phòng gửi xe bản 50.000 VNĐ/người)';
  if (id === 'trail-fansipan') {
    permitPerPerson = 220000;
    permitNote = 'Vé VQG Hoàng Liên 70.000 VNĐ + Phí leo núi 150.000 VNĐ/khách VN';
  } else if (id === 'trail-cattien-bausau') {
    permitPerPerson = 310000;
    permitNote = 'Vé cổng VQG Cát Tiên 60.000 VNĐ + Vé khu Ramsar Bàu Sấu 250.000 VNĐ';
  } else if (id === 'trail-bachma') {
    permitPerPerson = 65000;
    permitNote = 'Vé tham quan VQG Bạch Mã 65.000 VNĐ/người lớn';
  } else if (id === 'trail-bavi') {
    permitPerPerson = 60000;
    permitNote = 'Vé tham quan VQG Ba Vì 60.000 VNĐ/người lớn';
  } else if (id === 'trail-cucphuong') {
    permitPerPerson = 60000;
    permitNote = 'Vé tham quan VQG Cúc Phương 60.000 VNĐ/người lớn';
  } else if (id === 'trail-yentu') {
    permitPerPerson = 40000;
    permitNote = 'Vé danh thắng Yên Tử 40.000 VNĐ/người lớn (chưa gồm cáp treo)';
  } else if (id === 'trail-langbiang') {
    permitPerPerson = 50000;
    permitNote = 'Vé cổng KDL Langbiang 50.000 VNĐ/người lớn (chưa gồm xe Jeep)';
  } else if (
    ['trail-bidoup', 'trail-chuyangsin', 'trail-thack50', 'trail-nuichua', 'trail-bugiamap', 'trail-honba'].includes(id)
  ) {
    permitPerPerson = 150000;
    permitNote = 'Vé dịch vụ môi trường rừng & phí bảo vệ VQG/KBT (~150.000 VNĐ/người)';
  } else if (
    [
      'trail-pusilung',
      'trail-putaleng',
      'trail-kyquansan',
      'trail-laothan',
      'trail-nhiucosan',
      'trail-nguchison',
      'trail-tayconlinh',
      'trail-puluong',
      'trail-muidoi',
      'trail-tanangphandung',
      'trail-khangsuvan',
      'trail-namkanghotao',
      'trail-talienson',
      'trail-phaluong',
      'trail-binhlieu',
    ].includes(id)
  ) {
    permitPerPerson = 80000;
    permitNote = 'Phí vệ sinh môi trường, thủ tục khai báo địa bàn & gửi xe bản địa';
  } else if (['trail-badenh', 'trail-bara'].includes(id)) {
    permitPerPerson = 50000;
    permitNote = 'Chi phí gửi xe & thủ tục khai báo chân núi';
  } else {
    permitPerPerson = 50000;
  }
  const permitTotal = permitPerPerson * safeGroup;

  // 2. Guide & Porter rates (real verified rates: 500k–650k VND / day)
  const guideDailyRate = region === 'Miền Bắc' ? 600000 : region === 'Miền Trung' ? 550000 : 600000;
  const porterDailyRate = region === 'Miền Bắc' ? 550000 : 500000;
  const guideTotal = needGuide ? guideDailyRate * safeDays : 0;
  const porterTotal = portersCount * porterDailyRate * safeDays;
  const guideAndPorterTotal = guideTotal + porterTotal;
  const guideDetailParts: string[] = [];
  if (needGuide) guideDetailParts.push(`1 HDV (${formatVnd(guideDailyRate)}/ngày x ${safeDays}N)`);
  if (portersCount > 0) guideDetailParts.push(`${portersCount} Porter (${formatVnd(porterDailyRate)}/ngày x ${safeDays}N)`);

  // 3. Transport round-trip per person (real Vietnam hub distances)
  let transportPerPerson: number;
  if (region === 'Miền Bắc') {
    transportPerPerson = transportMode === 'limousine' ? 900000 : transportMode === 'tu_lai' ? 380000 : 650000;
  } else if (region === 'Miền Trung') {
    transportPerPerson = transportMode === 'limousine' ? 750000 : transportMode === 'tu_lai' ? 300000 : 500000;
  } else {
    transportPerPerson = transportMode === 'limousine' ? 620000 : transportMode === 'tu_lai' ? 220000 : 420000;
  }
  if (
    [
      'trail-nuidinh',
      'trail-chuachan',
      'trail-badenh',
      'trail-giengtroi',
      'trail-bachma',
      'trail-bavi',
      'trail-yentu',
      'trail-cucphuong',
      'trail-bara',
    ].includes(id)
  ) {
    transportPerPerson = transportMode === 'limousine' ? 360000 : transportMode === 'tu_lai' ? 160000 : 240000;
  }
  const transportLabel =
    transportMode === 'limousine'
      ? 'Xe Limousine khứ hồi + trung chuyển chân núi'
      : transportMode === 'tu_lai'
        ? 'Xăng xe máy / ô tô tự lái khứ hồi + gửi xe'
        : 'Xe khách giường nằm khứ hồi + xe ôm vào bản';
  const transportTotal = transportPerPerson * safeGroup;

  // 4. Food, water, mountain hut / camp fee & optional homestay
  const foodPerPerson = safeDays * 220000;
  const hutPerPerson = nights * 130000;
  const homestayPerPerson = includeHomestay ? 220000 : 0;
  const foodCampTotal = (foodPerPerson + hutPerPerson + homestayPerPerson) * safeGroup;
  const foodCampParts = [`Thực phẩm & điện giải (${safeDays}N)`];
  if (nights > 0) foodCampParts.push(`Lán gỗ / bãi hạ trại (${nights} đêm)`);
  if (includeHomestay) foodCampParts.push('Homestay tắm nóng & nghỉ chân bản');

  // 5. Optional gear rental + 5% safety reserve
  const gearRentalTotal = includeGearRental ? safeGroup * (180000 + nights * 70000) : 0;

  const items: CostLineItem[] = [
    {
      id: 'permit',
      label: 'Vé VQG & Thủ Tục Kiểm Lâm',
      category: 'permit',
      detail: permitNote,
      totalVnd: permitTotal,
      perPersonVnd: permitTotal / safeGroup,
      color: 'var(--color-primary)',
    },
    {
      id: 'guide',
      label: 'HDV Chính Thức & Porter Hậu Cần',
      category: 'guide',
      detail: guideDetailParts.length ? guideDetailParts.join(' + ') : 'Tự dẫn đoàn (không thuê HDV/Porter)',
      totalVnd: guideAndPorterTotal,
      perPersonVnd: guideAndPorterTotal / safeGroup,
      color: 'var(--color-sky)',
    },
    {
      id: 'transport',
      label: 'Di Chuyển Khứ Hồi & Trung Chuyển',
      category: 'transport',
      detail: transportLabel,
      totalVnd: transportTotal,
      perPersonVnd: transportPerPerson,
      color: 'var(--color-earth)',
    },
    {
      id: 'food_camp',
      label: 'Thực Phẩm, Nước Uống & Lán Nghỉ',
      category: 'food_camp',
      detail: foodCampParts.join(' • '),
      totalVnd: foodCampTotal,
      perPersonVnd: foodCampTotal / safeGroup,
      color: 'var(--color-sun)',
    },
  ];

  if (includeGearRental) {
    items.push({
      id: 'gear',
      label: 'Thuê Đồ Dã Ngoại (Lều, Túi Ngủ, Gậy)',
      category: 'gear',
      detail: 'Gói thuê đồ cơ bản giữ ấm & gậy trekking theo số ngày',
      totalVnd: gearRentalTotal,
      perPersonVnd: gearRentalTotal / safeGroup,
      color: 'var(--color-stream)',
    });
  }

  const totalGroupVnd = items.reduce((sum, item) => sum + item.totalVnd, 0);
  return {
    items,
    totalGroupVnd,
    perPersonVnd: Math.round(totalGroupVnd / safeGroup),
    source: 'local',
  };
}

export const DirectoryCostView: React.FC<DirectoryCostViewProps> = ({
  trails,
  currentUser,
  initialTrailId,
  onSelectTrail,
  onStartTripWithBudget,
  onShowToast,
  onBack,
}) => {
  const currentUserId = currentUser?.id || '';
  const inquiriesStorageKey = getScopedInquiriesKey(currentUserId);
  const initialUrlParams = useMemo(() => readDirectoryUrlParams(), []);

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (initialUrlParams.tab) return initialUrlParams.tab;
    return initialTrailId || initialUrlParams.trailId ? 'cost' : 'rangers';
  });
  const { trackRef: dirTabTrackRef, indicatorStyle: dirTabIndicatorStyle } =
    useSlidingIndicator<ActiveTab>(activeTab);

  // Rangers state
  const [rangers, setRangers] = useState<RangerStationSeed[]>(VIETNAM_RANGER_STATIONS);
  const [rangerRegion, setRangerRegion] = useState<RegionFilter>('Tất Cả');
  const [rangerAuthority, setRangerAuthority] = useState<AuthorityFilter>('all');
  const [permitOnly, setPermitOnly] = useState(false);
  const [rangerSearch, setRangerSearch] = useState(() =>
    !initialUrlParams.tab || initialUrlParams.tab === 'rangers' ? initialUrlParams.q : ''
  );
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  // Guides state
  const [guides, setGuides] = useState<GuideDirectoryItem[]>(VERIFIED_GUIDES_EXTENDED);
  const [guideRegion, setGuideRegion] = useState<RegionFilter>('Tất Cả');
  const [guideProvince, setGuideProvince] = useState('');
  const [guideSpecialty, setGuideSpecialty] = useState('');
  const [guideMaxPrice, setGuideMaxPrice] = useState<number>(800000);
  const [guideSort, setGuideSort] = useState<GuideSort>('rating');
  const [guideSearch, setGuideSearch] = useState(() =>
    initialUrlParams.tab === 'guides' ? initialUrlParams.q : ''
  );

  // Inquiry modal & drawer state
  const [inquiryGuide, setInquiryGuide] = useState<GuideDirectoryItem | null>(null);
  const [inquiryTrailId, setInquiryTrailId] = useState<string>(
    initialTrailId || initialUrlParams.trailId || trails[0]?.id || ''
  );
  const [inquiryDate, setInquiryDate] = useState<string>(() => getDefaultFutureDate(14));
  const [inquiryDays, setInquiryDays] = useState<number>(2);
  const [inquiryGroupSize, setInquiryGroupSize] = useState<number>(4);
  const [inquiryPorters, setInquiryPorters] = useState<number>(1);
  const [inquiryPhone, setInquiryPhone] = useState<string>(currentUser?.phone || '');
  const [inquiryNotes, setInquiryNotes] = useState<string>('');
  const [isSubmittingInquiry, setIsSubmittingInquiry] = useState(false);
  const [isInquiriesOpen, setIsInquiriesOpen] = useState(false);
  const [myInquiries, setMyInquiries] = useState<GuideInquiryRecord[]>([]);
  const [loadingInquiries, setLoadingInquiries] = useState(false);
  const [prevInquiriesScope, setPrevInquiriesScope] = useState<string>(inquiriesStorageKey);

  if (prevInquiriesScope !== inquiriesStorageKey) {
    setPrevInquiriesScope(inquiriesStorageKey);
    setMyInquiries([]);
  }

  // Cost estimator state
  const [costTrailId, setCostTrailId] = useState<string>(
    initialTrailId || initialUrlParams.trailId || trails[0]?.id || 'trail-fansipan'
  );
  const [groupSize, setGroupSize] = useState<number>(4);
  const [days, setDays] = useState<number>(() => {
    const found = trails.find((t) => t.id === (initialTrailId || initialUrlParams.trailId || trails[0]?.id));
    return found?.durationDays || 2;
  });
  const [transportMode, setTransportMode] = useState<TransportMode>('xe_khach');
  const [needGuide, setNeedGuide] = useState<boolean>(true);
  const [portersCount, setPortersCount] = useState<number>(1);
  const [includeGearRental, setIncludeGearRental] = useState<boolean>(false);
  const [includeHomestay, setIncludeHomestay] = useState<boolean>(true);
  const [apiEstimate, setApiEstimate] = useState<CostEstimateSummary | null>(null);

  const inquiriesAbortRef = useRef<AbortController | null>(null);
  const copiedTimerRef = useRef<number | null>(null);
  const lastSyncedTrailIdRef = useRef<string | undefined>(initialTrailId || initialUrlParams.trailId || undefined);
  const inquiryModalRef = useRef<HTMLDivElement | null>(null);
  const inquiriesDrawerRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(Boolean(inquiryGuide), inquiryModalRef);
  useFocusTrap(isInquiriesOpen, inquiriesDrawerRef);

  // Cleanup timers & pending inquiry requests on unmount
  useEffect(() => {
    return () => {
      inquiriesAbortRef.current?.abort();
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const trailById = useMemo(() => {
    const map = new Map<string, Trail>();
    trails.forEach((t) => map.set(t.id, t));
    return map;
  }, [trails]);

  const selectedCostTrail = useMemo(
    () => trailById.get(costTrailId) || trails[0],
    [trailById, costTrailId, trails]
  );

  // Sync initialTrailId prop changes & URL query params (?tab=rangers|guides|cost & ?q=...)
  useEffect(() => {
    const syncParams = () => {
      const p = readDirectoryUrlParams();
      if (p.tab) {
        setActiveTab(p.tab);
      }
      if (p.q) {
        if (p.tab === 'guides') setGuideSearch(p.q);
        else setRangerSearch(p.q);
      }
      const nextTrailId = initialTrailId || p.trailId;
      if (nextTrailId && nextTrailId !== lastSyncedTrailIdRef.current) {
        lastSyncedTrailIdRef.current = nextTrailId;
        setCostTrailId(nextTrailId);
        setInquiryTrailId(nextTrailId);
        const matched = trailById.get(nextTrailId);
        if (matched) {
          setDays(Math.max(1, matched.durationDays || 1));
          setNeedGuide(Boolean(matched.permitRequired || matched.difficultyLevel >= 3));
          setPortersCount(matched.durationDays >= 2 ? 1 : 0);
        }
        if (!p.tab) {
          setActiveTab('cost');
        }
      }
    };

    let cancelled = false;
    const rafId = window.requestAnimationFrame(() => {
      if (!cancelled) syncParams();
    });
    window.addEventListener('popstate', syncParams);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('popstate', syncParams);
    };
  }, [initialTrailId, trailById]);

  // Sync trail days when user changes trail in Cost Estimator
  const handleSelectCostTrail = (newTrailId: string) => {
    setCostTrailId(newTrailId);
    const t = trailById.get(newTrailId);
    if (t) {
      setDays(Math.max(1, t.durationDays || 1));
      setNeedGuide(Boolean(t.permitRequired || t.difficultyLevel >= 3));
      setPortersCount(t.durationDays >= 2 ? Math.max(1, Math.floor(groupSize / 4)) : 0);
    }
  };

  // Load Rangers & Guides from backend (graceful fallback to vietnamDirectory.ts)
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch('/api/directory/rangers', {
          headers: getApiHeaders(),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (res.ok) {
          const json = await res.json();
          if (!controller.signal.aborted && json?.success && Array.isArray(json.data) && json.data.length > 0) {
            setRangers(json.data);
          }
        }
      } catch {
        // Offline / aborted — fallback already initialized with VIETNAM_RANGER_STATIONS
      }
    })();

    (async () => {
      try {
        const res = await fetch('/api/directory/guides', {
          headers: getApiHeaders(),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (res.ok) {
          const json = await res.json();
          if (!controller.signal.aborted && json?.success && Array.isArray(json.data) && json.data.length > 0) {
            setGuides(json.data);
          }
        }
      } catch {
        // Offline / aborted — fallback already initialized with VERIFIED_GUIDES_EXTENDED
      }
    })();

    return () => controller.abort();
  }, []);

  // Load user's sent inquiries with AbortController (user-scoped localStorage fallback)
  const loadMyInquiries = useCallback(async () => {
    inquiriesAbortRef.current?.abort();
    const controller = new AbortController();
    inquiriesAbortRef.current = controller;

    setLoadingInquiries(true);
    try {
      let localList: GuideInquiryRecord[] = [];
      try {
        const raw = localStorage.getItem(inquiriesStorageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) localList = parsed;
      } catch {
        localList = [];
      }

      if (!currentUserId) {
        if (!controller.signal.aborted) setMyInquiries(localList);
        return;
      }

      const res = await fetch('/api/directory/inquiries/me', {
        headers: getApiHeaders(),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (res.ok) {
        const json = await res.json();
        if (!controller.signal.aborted && json?.success && Array.isArray(json.data)) {
          setMyInquiries(json.data);
          return;
        }
      }
      if (!controller.signal.aborted) setMyInquiries(localList);
    } catch {
      if (controller.signal.aborted) return;
      try {
        const raw = localStorage.getItem(inquiriesStorageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        setMyInquiries(Array.isArray(parsed) ? parsed : []);
      } catch {
        setMyInquiries([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingInquiries(false);
      }
    }
  }, [currentUserId, inquiriesStorageKey]);

  const openInquiriesDrawer = useCallback(() => {
    setIsInquiriesOpen(true);
    void loadMyInquiries();
  }, [loadMyInquiries]);

  // Escape key closes topmost inquiry modal / drawer (LIFO focus-trap + IME safe)
  useEffect(() => {
    if (!inquiryGuide && !isInquiriesOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing) return;
      if (inquiryGuide && isTopmostFocusTrap(inquiryModalRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!isSubmittingInquiry) setInquiryGuide(null);
      } else if (isInquiriesOpen && isTopmostFocusTrap(inquiriesDrawerRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setIsInquiriesOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inquiryGuide, isInquiriesOpen, isSubmittingInquiry]);

  // Local deterministic estimate + live backend cost estimate overlay
  const localEstimate = useMemo(
    () =>
      estimateLocalTripCost({
        trail: selectedCostTrail,
        groupSize,
        days,
        transportMode,
        needGuide,
        portersCount,
        includeGearRental,
        includeHomestay,
      }),
    [selectedCostTrail, groupSize, days, transportMode, needGuide, portersCount, includeGearRental, includeHomestay]
  );

  useEffect(() => {
    if (!selectedCostTrail || activeTab !== 'cost') return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (controller.signal.aborted) return;
      if (transportMode !== 'xe_khach') {
        setApiEstimate(null);
        return;
      }
      try {
        const qs = new URLSearchParams({
          trailId: selectedCostTrail.id,
          groupSize: String(groupSize),
          days: String(days),
          needGuide: String(needGuide),
          portersCount: String(portersCount),
          includeTransport: 'true',
          includeCampRent: String(includeGearRental),
        });
        const res = await fetch(`/api/directory/cost-estimate?${qs.toString()}`, {
          headers: getApiHeaders(),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!res.ok) {
          setApiEstimate(null);
          return;
        }
        const json = await res.json();
        if (controller.signal.aborted) return;
        const data = json?.data;
        const apiTotalVnd =
          typeof data?.grandTotalVnd === 'number'
            ? data.grandTotalVnd
            : typeof data?.totalGroupVnd === 'number'
              ? data.totalGroupVnd
              : null;
        if (json?.success && data && apiTotalVnd !== null && Array.isArray(data.breakdown)) {
          const safeGroup = Math.max(1, groupSize);
          const mappedItems: CostLineItem[] = data.breakdown
            .filter((b: { totalVnd?: number }) => Number(b.totalVnd || 0) > 0)
            .map((b: { key?: string; label?: string; note?: string; totalVnd?: number; perPersonVnd?: number }, idx: number) => {
              const styleMeta = mapApiBreakdownCategory(b.key);
              const totalVal = Number(b.totalVnd || 0);
              return {
                id: b.key || `item-${idx}`,
                label: b.label || 'Chi phí',
                category: styleMeta.category,
                detail: b.note || styleMeta.fallbackDetail,
                totalVnd: totalVal,
                perPersonVnd:
                  typeof b.perPersonVnd === 'number' ? Math.round(b.perPersonVnd) : Math.round(totalVal / safeGroup),
                color: styleMeta.color,
              };
            });

          let finalGroupVnd = Number(apiTotalVnd);
          if (includeHomestay) {
            const homestayTotal = 220000 * safeGroup;
            finalGroupVnd += homestayTotal;
            mappedItems.push({
              id: 'homestay',
              label: 'Homestay Tắm Nóng & Nghỉ Chân Bản',
              category: 'food_camp',
              detail: 'Nghỉ chân homestay bản địa trước/sau khi xuống núi (220.000 VNĐ/người)',
              totalVnd: homestayTotal,
              perPersonVnd: 220000,
              color: 'var(--color-stream)',
            });
          }

          setApiEstimate({
            items: mappedItems,
            totalGroupVnd: finalGroupVnd,
            perPersonVnd: Math.round(finalGroupVnd / safeGroup),
            source: 'api',
          });
          return;
        }
        setApiEstimate(null);
      } catch {
        if (controller.signal.aborted) return;
        setApiEstimate(null);
      }
    }, 240);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [selectedCostTrail, groupSize, days, needGuide, portersCount, transportMode, includeGearRental, includeHomestay, activeTab]);

  const activeEstimate = apiEstimate || localEstimate;

  // Filtered Rangers
  const nationalHotlines = useMemo(
    () => rangers.filter((r) => r.region === 'Toàn Quốc'),
    [rangers]
  );

  const filteredRangers = useMemo(() => {
    const q = normalizeVn(rangerSearch);
    return rangers.filter((r) => {
      if (r.region === 'Toàn Quốc') return false;
      if (rangerRegion !== 'Tất Cả' && r.region !== rangerRegion) return false;
      if (rangerAuthority !== 'all' && r.authorityType !== rangerAuthority) return false;
      if (permitOnly && !r.permitRequired) return false;
      if (!q) return true;
      const trailNames = r.coveredTrailSlugs
        .map((slug) => trailById.get(slug)?.name || slug)
        .join(' ');
      const hay = normalizeVn(
        [r.name, r.province, r.district, r.address, r.hotlinePhone, r.emergencyPhone, r.permitFeeNote, trailNames].join(' ')
      );
      return hay.includes(q);
    });
  }, [rangers, rangerRegion, rangerAuthority, permitOnly, rangerSearch, trailById]);

  // Guide filter options & filtered list
  const guideProvinces = useMemo(() => {
    const set = new Set<string>();
    guides.forEach((g) => (g.provinces || []).forEach((p) => set.add(p)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [guides]);

  const guideSpecialties = useMemo(() => {
    const set = new Set<string>();
    guides.forEach((g) => (g.specialties || []).forEach((s) => set.add(s)));
    return Array.from(set).slice(0, 14);
  }, [guides]);

  const filteredGuides = useMemo(() => {
    const q = normalizeVn(guideSearch);
    const list = guides.filter((g) => {
      if (guideRegion !== 'Tất Cả' && g.region !== guideRegion) return false;
      if (guideProvince && !(g.provinces || []).includes(guideProvince)) return false;
      if (guideSpecialty && !(g.specialties || []).includes(guideSpecialty)) return false;
      const baseRate = Number(g.basePricePerDayVnd || 550000);
      if (baseRate > guideMaxPrice) return false;
      if (!q) return true;
      const hay = normalizeVn(
        [g.name, g.region, (g.provinces || []).join(' '), (g.specialties || []).join(' '), g.bio || '', g.phone].join(' ')
      );
      return hay.includes(q);
    });

    return [...list].sort((a, b) => {
      if (guideSort === 'price_asc') return (a.basePricePerDayVnd || 0) - (b.basePricePerDayVnd || 0);
      if (guideSort === 'price_desc') return (b.basePricePerDayVnd || 0) - (a.basePricePerDayVnd || 0);
      if (guideSort === 'experience') return (b.experienceYears || 0) - (a.experienceYears || 0);
      return (b.rating || 0) - (a.rating || 0) || (b.experienceYears || 0) - (a.experienceYears || 0);
    });
  }, [guides, guideRegion, guideProvince, guideSpecialty, guideMaxPrice, guideSearch, guideSort]);

  const handleCopyPhone = async (phone: string) => {
    const dial = extractPrimaryDialPhone(phone);
    if (!dial) return;
    const copied = await copyTextSafe(dial);
    if (copied) {
      setCopiedPhone(dial);
      onShowToast?.(`Đã sao chép số ${dial}`, 'success');
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = window.setTimeout(() => {
        copiedTimerRef.current = null;
        setCopiedPhone((curr) => (curr === dial ? null : curr));
      }, 1800);
    } else {
      onShowToast?.('Không thể sao chép tự động.', 'info');
    }
  };

  const openInquiryModal = (guide: GuideDirectoryItem) => {
    const firstCovered = guide.trailSlugs?.[0];
    setInquiryGuide(guide);
    setInquiryTrailId(firstCovered && trailById.has(firstCovered) ? firstCovered : selectedCostTrail?.id || trails[0]?.id || '');
    setInquiryDays(trailById.get(firstCovered || '')?.durationDays || 2);
    setInquiryPhone(currentUser?.phone || inquiryPhone);
  };

  const inquiryEstimateVnd = useMemo(() => {
    if (!inquiryGuide) return 0;
    const base = Number(inquiryGuide.basePricePerDayVnd || 600000);
    const porter = 500000;
    return (base + inquiryPorters * porter) * Math.max(1, inquiryDays);
  }, [inquiryGuide, inquiryPorters, inquiryDays]);

  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryGuide) return;
    if (!currentUser) {
      window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
      onShowToast?.('Vui lòng đăng nhập để gửi yêu cầu tư vấn & theo dõi trạng thái.', 'info');
      return;
    }

    const cleanPhone = inquiryPhone.trim();
    if (cleanPhone.length < 8) {
      onShowToast?.('Vui lòng nhập số điện thoại liên hệ hợp lệ.', 'error');
      return;
    }

    const trailObj = trailById.get(inquiryTrailId);
    const guideTargetId = inquiryGuide._id || inquiryGuide.id || inquiryGuide.slug;
    const payload = {
      trailId: inquiryTrailId || undefined,
      trailName: trailObj?.name || inquiryGuide.name,
      plannedStartDate: inquiryDate,
      durationDays: inquiryDays,
      groupSize: inquiryGroupSize,
      needPortersCount: inquiryPorters,
      contactPhone: cleanPhone,
      notes: inquiryNotes.trim(),
    };

    setIsSubmittingInquiry(true);
    try {
      const res = await fetch(`/api/directory/guides/${encodeURIComponent(guideTargetId)}/inquiries`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        onShowToast?.('Đã gửi yêu cầu tư vấn tới trung tâm HDV thành công!', 'success');
        setInquiryGuide(null);
        setInquiryNotes('');
        openInquiriesDrawer();
        return;
      }

      // Offline / non-ObjectId seed guide graceful fallback so user never loses request
      const localRecord: GuideInquiryRecord = {
        _id: `local-${Date.now()}`,
        guideName: inquiryGuide.name,
        trailName: payload.trailName,
        plannedStartDate: payload.plannedStartDate,
        durationDays: payload.durationDays,
        groupSize: payload.groupSize,
        needPortersCount: payload.needPortersCount,
        contactPhone: payload.contactPhone,
        notes: payload.notes,
        estimatedTotalVnd: inquiryEstimateVnd,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      try {
        const existingRaw = localStorage.getItem(inquiriesStorageKey);
        const parsed = existingRaw ? JSON.parse(existingRaw) : [];
        const existing: GuideInquiryRecord[] = Array.isArray(parsed) ? parsed : [];
        localStorage.setItem(inquiriesStorageKey, JSON.stringify([localRecord, ...existing]));
      } catch {
        // ignore storage quota errors
      }
      onShowToast?.(
        json?.message
          ? `${json.message} — Đã lưu bản nháp cục bộ để bạn gọi trực tiếp ${inquiryGuide.phone}.`
          : `Đã lưu yêu cầu cục bộ — bạn có thể gọi trực tiếp ${inquiryGuide.phone}.`,
        'info'
      );
      setInquiryGuide(null);
      openInquiriesDrawer();
    } catch {
      onShowToast?.(`Không thể kết nối máy chủ. Vui lòng gọi trực tiếp ${inquiryGuide.phone}.`, 'error');
    } finally {
      setIsSubmittingInquiry(false);
    }
  };

  const handleCancelInquiry = async (inquiryId: string) => {
    if (inquiryId.startsWith('local-')) {
      const updated = myInquiries.map((inq) =>
        inq._id === inquiryId ? { ...inq, status: 'cancelled' as const } : inq
      );
      setMyInquiries(updated);
      try {
        localStorage.setItem(inquiriesStorageKey, JSON.stringify(updated));
      } catch {
        // ignore
      }
      onShowToast?.('Đã hủy yêu cầu đặt lịch.', 'info');
      return;
    }

    try {
      const res = await fetch(`/api/directory/inquiries/${encodeURIComponent(inquiryId)}/status`, {
        method: 'PATCH',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (res.ok) {
        onShowToast?.('Đã hủy yêu cầu đặt lịch.', 'info');
        loadMyInquiries();
      }
    } catch {
      onShowToast?.('Không thể hủy yêu cầu lúc này.', 'error');
    }
  };

  const buildBudgetShareText = (): string => {
    const tName = selectedCostTrail?.name || 'Cung Trekking Việt Nam';
    const lines = [
      `DU TRU CHI PHI TREKKING — ${tName.toUpperCase()}`,
      `Quy mo: ${groupSize} nguoi | Thoi luong: ${days} ngay ${Math.max(0, days - 1)} dem`,
      `---`,
      ...activeEstimate.items.map(
        (it) => `- ${it.label}: ${formatVnd(it.totalVnd)} (${formatVnd(it.perPersonVnd)}/nguoi)`
      ),
      `---`,
      `TONG CA DOAN: ${formatVnd(activeEstimate.totalGroupVnd)}`,
      `BINH QUAN MOI NGUOI: ${formatVnd(activeEstimate.perPersonVnd)}`,
      `Nguon: LOST — Vietnam Field Atlas`,
    ];
    return lines.join('\n');
  };

  const handleCopyBudget = async () => {
    const copied = await copyTextSafe(buildBudgetShareText());
    if (copied) {
      onShowToast?.('Đã sao chép bảng dự trù chi phí gửi nhóm Zalo!', 'success');
    } else {
      onShowToast?.('Không thể tự động sao chép bảng dự trù.', 'info');
    }
  };

  const handleStartTripWithBudget = () => {
    if (!selectedCostTrail) return;
    const summary = buildBudgetShareText();
    if (onStartTripWithBudget) {
      onStartTripWithBudget(selectedCostTrail.id, summary);
    } else {
      window.dispatchEvent(
        new CustomEvent('lost:start-trip-with-budget', {
          detail: { trailId: selectedCostTrail.id, budgetNote: summary },
        })
      );
      onShowToast?.('Đã sao lưu dự trù ngân sách cho chuyến đi ghép đoàn!', 'success');
    }
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
      {/* Top Breadcrumb & Editorial Header */}
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
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                borderRadius: 4,
                marginBottom: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
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
            LOST Field Atlas • Danh Bạ Thực Địa &amp; Hậu Cần Việt Nam
          </div>
          <h1
            className="font-editorial"
            style={{
              margin: 0,
              fontSize: 'clamp(1.45rem, 2.6vw, 2rem)',
              fontWeight: 600,
              color: 'var(--color-text-main)',
              lineHeight: 1.2,
            }}
          >
            Kiểm Lâm, HDV Chính Thức &amp; Dự Trù Chi Phí
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: 'var(--color-text-muted)', maxWidth: 740, lineHeight: 1.55 }}>
            Tra cứu 100% thực tế {rangers.length} đầu mối Vườn Quốc Gia &amp; Chi cục Kiểm lâm, {guides.length} trung tâm hướng dẫn viên chính thức và dự toán ngân sách VNĐ cho toàn bộ {trails.length} cung đường Việt Nam.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={openInquiriesDrawer}
            style={{ borderRadius: 4, padding: '8px 13px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <IconFileText size={14} color="var(--color-sky)" />
            <span>Yêu Cầu Đã Gửi</span>
          </button>
        </div>
      </div>

      {/* 3-Tab Field-Atlas Switcher with Liquid Glider */}
      <div
        ref={dirTabTrackRef}
        role="tablist"
        aria-label="Danh mục Danh bạ và Dự toán"
        className="lost-glider-track"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))',
          gap: 8,
          marginBottom: 22,
        }}
      >
        <span
          aria-hidden="true"
          className="lost-glider-pill with-accent"
          style={dirTabIndicatorStyle}
        />
        {[
          {
            id: 'rangers' as const,
            title: `Trạm Kiểm Lâm & VQG (${rangers.length})`,
            sub: 'Cứu hộ 24/7, giấy phép & phí vào rừng',
            icon: <IconShieldAlert size={16} />,
          },
          {
            id: 'guides' as const,
            title: `HDV / Porter Chính Thức (${guides.length})`,
            sub: 'Trung tâm VQG/KBT & đặt lịch tư vấn',
            icon: <IconUsers size={16} />,
          },
          {
            id: 'cost' as const,
            title: 'Máy Tính Chi Phí (VNĐ)',
            sub: 'Dự toán chi tiết từng hạng mục cho nhóm',
            icon: <IconScale size={16} />,
          },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-glider-active={active ? 'true' : undefined}
              className="lost-glider-item"
              onClick={() => setActiveTab(tab.id)}
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 6,
                cursor: 'pointer',
                border: active ? '1px solid transparent' : '1px solid var(--color-border)',
                background: active ? 'transparent' : 'var(--color-bg-card)',
                color: 'var(--color-text-main)',
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                fontFamily: 'var(--font-family)',
                transition: 'color 200ms ease, border-color 200ms ease',
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  background: active
                    ? 'color-mix(in srgb, var(--color-primary) 16%, var(--color-bg-main))'
                    : 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {tab.icon}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: active ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                  {tab.title}
                </div>
                <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {tab.sub}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: VERIFIED RANGER STATIONS & NATIONAL PARKS                     */}
      {/* ==================================================================== */}
      {activeTab === 'rangers' && (
        <div className="tab-content-slide" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Pinned 24/7 National Emergency Hotlines */}
          <div
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-strong)',
              borderLeft: '3px solid var(--color-error)',
              borderRadius: 6,
              padding: 14,
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-error-text, var(--color-error))', marginBottom: 10 }}>
              Đầu Số Khẩn Cấp Quốc Gia 24/7 (Miễn Phí Toàn Quốc)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 10 }}>
              {nationalHotlines.map((item) => {
                const dial = extractPrimaryDialPhone(item.hotlinePhone);
                const isDangerDial = dial === '112' || dial === '113';
                const color = isDangerDial
                  ? 'var(--color-error)'
                  : dial === '114'
                    ? 'var(--color-earth)'
                    : 'var(--color-primary)';
                const dialTextColor = isDangerDial
                  ? 'var(--color-error-text, var(--color-error))'
                  : color;
                return (
                  <a
                    key={item.slug}
                    href={`tel:${dial}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 4,
                      background: `color-mix(in srgb, ${color} 10%, var(--color-bg-main))`,
                      border: `1px solid color-mix(in srgb, ${color} 35%, var(--color-border))`,
                      textDecoration: 'none',
                      color: 'var(--color-text-main)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: dialTextColor, fontVariantNumeric: 'tabular-nums' }}>
                        {dial}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {item.name.replace(/\s*\(\d+\)$/, '')}
                      </div>
                    </div>
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 4,
                        background: color,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <IconPhone size={14} color="var(--color-on-media)" />
                    </span>
                  </a>
                );
              })}
            </div>
          </div>

          {/* Search & Filters */}
          <div
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: 11, color: 'var(--color-text-dim)', display: 'inline-flex', pointerEvents: 'none' }}>
                  <IconSearch size={15} />
                </span>
                <input
                  id="directory-ranger-search"
                  type="text"
                  className="form-input"
                  aria-label="Tìm kiếm trạm kiểm lâm, vườn quốc gia, tỉnh thành hoặc cung đường"
                  value={rangerSearch}
                  onChange={(e) => setRangerSearch(e.target.value)}
                  placeholder="Tìm VQG, kiểm lâm, tỉnh hoặc tên cung đường..."
                  style={{ width: '100%', paddingLeft: 34, borderRadius: 4, fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {REGION_OPTIONS.map((reg) => {
                  const active = rangerRegion === reg;
                  return (
                    <button
                      key={reg}
                      type="button"
                      onClick={() => setRangerRegion(reg)}
                      style={{
                        padding: '6px 11px',
                        borderRadius: 4,
                        fontSize: '0.76rem',
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                        border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                        background: active
                          ? 'color-mix(in srgb, var(--color-primary) 16%, var(--color-bg-main))'
                          : 'var(--color-bg-main)',
                        color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        fontFamily: 'var(--font-family)',
                      }}
                    >
                      {reg}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'all' as const, label: 'Tất cả đơn vị' },
                  { id: 'national_park' as const, label: 'VQG / Khu BTTN' },
                  { id: 'ranger_station' as const, label: 'Chi Cục Kiểm Lâm' },
                  { id: 'rescue_center' as const, label: 'Đội CNCH 24/7' },
                ].map((opt) => {
                  const active = rangerAuthority === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setRangerAuthority(opt.id)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 4,
                        fontSize: '0.74rem',
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                        border: active ? '1px solid var(--color-sky)' : '1px solid var(--color-border)',
                        background: active
                          ? 'color-mix(in srgb, var(--color-sky) 14%, var(--color-bg-main))'
                          : 'var(--color-bg-main)',
                        color: active ? 'var(--color-sky)' : 'var(--color-text-muted)',
                        fontFamily: 'var(--font-family)',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}

                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.76rem',
                    color: 'var(--color-text-muted)',
                    padding: '4px 10px',
                    borderRadius: 4,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-main)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={permitOnly}
                    onChange={(e) => setPermitOnly(e.target.checked)}
                  />
                  <span>Bắt buộc giấy phép</span>
                </label>
              </div>

              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                Hiển thị {filteredRangers.length} cơ sở xác thực
              </span>
            </div>
          </div>

          {/* Ranger Station Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: 14 }}>
            {filteredRangers.map((station) => {
              const meta = getAuthorityMeta(station.authorityType);
              const primaryDial = extractPrimaryDialPhone(station.hotlinePhone);
              const secondaryDial = extractPrimaryDialPhone(station.emergencyPhone);
              const showSecondary = Boolean(secondaryDial) && secondaryDial !== primaryDial && secondaryDial.length > 3;

              return (
                <article
                  key={station.slug}
                  style={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderTop: `3px solid ${meta.accent}`,
                    borderRadius: 6,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          padding: '3px 7px',
                          borderRadius: 4,
                          color: meta.textColor,
                          background: `color-mix(in srgb, ${meta.accent} 13%, var(--color-bg-main))`,
                          border: `1px solid color-mix(in srgb, ${meta.accent} 32%, transparent)`,
                        }}
                      >
                        {station.authorityType === 'national_park' ? <IconTrees size={12} color={meta.textColor} /> : <IconShieldCheck size={12} color={meta.textColor} />}
                        {meta.label}
                      </span>

                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 4,
                          color: station.permitRequired ? 'var(--color-earth)' : 'var(--color-primary)',
                          background: station.permitRequired
                            ? 'color-mix(in srgb, var(--color-earth) 12%, var(--color-bg-main))'
                            : 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-main))',
                        }}
                      >
                        {station.permitRequired
                          ? station.permitLeadDays > 0
                            ? `Xin phép trước ${station.permitLeadDays}N`
                            : 'Đăng ký tại cổng'
                          : 'Không cần giấy phép'}
                      </span>
                    </div>

                    <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: 'var(--color-text-main)', lineHeight: 1.35 }}>
                      {station.name}
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.77rem', color: 'var(--color-text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <span style={{ marginTop: 2, flexShrink: 0 }}><IconMapPin size={13} color="var(--color-text-dim)" /></span>
                        <span>{station.address}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <IconClock size={13} color="var(--color-text-dim)" />
                        <span>Giờ trực: {station.officeHours}</span>
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-text-muted)',
                        background: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 4,
                        padding: '8px 10px',
                        lineHeight: 1.5,
                      }}
                    >
                      <strong style={{ color: 'var(--color-text-main)' }}>Thủ tục &amp; Lệ phí: </strong>
                      {station.permitFeeNote}
                    </div>

                    {/* Linked Trail Chips */}
                    {station.coveredTrailSlugs.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {station.coveredTrailSlugs.map((slug) => {
                          const linked = trailById.get(slug);
                          const label = linked ? linked.name : slug;
                          return (
                            <button
                              key={slug}
                              type="button"
                              title={label}
                              onClick={() => linked && onSelectTrail?.(linked)}
                              disabled={!linked || !onSelectTrail}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 8px',
                                borderRadius: 4,
                                fontSize: '0.71rem',
                                fontWeight: 600,
                                border: '1px solid var(--color-border-strong)',
                                background: 'var(--color-bg-main)',
                                color: 'var(--color-primary)',
                                cursor: linked && onSelectTrail ? 'pointer' : 'default',
                                fontFamily: 'var(--font-family)',
                              }}
                            >
                              <IconMountain size={11} color="var(--color-primary)" />
                              <span style={{ maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Call & Copy Row */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
                    <a
                      href={`tel:${primaryDial}`}
                      className="btn btn-primary"
                      style={{
                        flex: 1,
                        justifyContent: 'center',
                        padding: '7px 10px',
                        fontSize: '0.78rem',
                        borderRadius: 4,
                        background: meta.accent,
                        borderColor: meta.accent,
                        color: station.authorityType === 'rescue_center' ? 'var(--color-on-danger)' : 'var(--color-on-primary)',
                        fontVariantNumeric: 'tabular-nums',
                        textDecoration: 'none',
                      }}
                    >
                      <IconPhone
                        size={13}
                        color={station.authorityType === 'rescue_center' ? 'var(--color-on-danger)' : 'var(--color-on-primary)'}
                      />
                      <span>Gọi {station.hotlinePhone}</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => handleCopyPhone(station.hotlinePhone)}
                      title="Sao chép số điện thoại"
                      aria-label={`Sao chép ${station.hotlinePhone}`}
                      style={{
                        padding: '7px 9px',
                        borderRadius: 4,
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg-main)',
                        color: copiedPhone === primaryDial ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      {copiedPhone === primaryDial ? <IconCheck size={14} /> : <IconCopy size={14} />}
                    </button>

                    {showSecondary && (
                      <a
                        href={`tel:${secondaryDial}`}
                        className="btn btn-outline"
                        style={{
                          padding: '7px 10px',
                          fontSize: '0.75rem',
                          borderRadius: 4,
                          fontVariantNumeric: 'tabular-nums',
                          textDecoration: 'none',
                        }}
                      >
                        <IconPhone size={12} color="var(--color-sky)" />
                        <span>{station.emergencyPhone}</span>
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: VERIFIED OFFICIAL GUIDES & PORTER CENTERS                     */}
      {/* ==================================================================== */}
      {activeTab === 'guides' && (
        <div className="tab-content-slide" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Guide Filter Controls */}
          <div
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: 14,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))',
              gap: 10,
              alignItems: 'end',
            }}
          >
            <div>
              <label htmlFor="guide-filter-search" className="form-label" style={{ fontSize: '0.72rem' }}>Tìm trung tâm / tuyến</label>
              <input
                id="guide-filter-search"
                type="text"
                className="form-input"
                aria-label="Tìm trung tâm hướng dẫn viên hoặc cung đường"
                value={guideSearch}
                onChange={(e) => setGuideSearch(e.target.value)}
                placeholder="VD: Hoàng Liên, Bidoup, K50..."
                style={{ fontSize: '0.8rem', borderRadius: 4 }}
              />
            </div>

            <div>
              <label htmlFor="guide-filter-region" className="form-label" style={{ fontSize: '0.72rem' }}>Khu vực</label>
              <select
                id="guide-filter-region"
                className="form-input"
                aria-label="Lọc HDV theo khu vực"
                value={guideRegion}
                onChange={(e) => setGuideRegion(e.target.value as RegionFilter)}
                style={{ fontSize: '0.8rem', borderRadius: 4 }}
              >
                {REGION_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="guide-filter-province" className="form-label" style={{ fontSize: '0.72rem' }}>Tỉnh / Thành</label>
              <select
                id="guide-filter-province"
                className="form-input"
                aria-label="Lọc HDV theo tỉnh thành"
                value={guideProvince}
                onChange={(e) => setGuideProvince(e.target.value)}
                style={{ fontSize: '0.8rem', borderRadius: 4 }}
              >
                <option value="">Tất cả tỉnh</option>
                {guideProvinces.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="guide-filter-specialty" className="form-label" style={{ fontSize: '0.72rem' }}>Chuyên môn</label>
              <select
                id="guide-filter-specialty"
                className="form-input"
                aria-label="Lọc HDV theo chuyên môn"
                value={guideSpecialty}
                onChange={(e) => setGuideSpecialty(e.target.value)}
                style={{ fontSize: '0.8rem', borderRadius: 4 }}
              >
                <option value="">Tất cả chuyên môn</option>
                {guideSpecialties.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="guide-filter-max-price" className="form-label" style={{ fontSize: '0.72rem' }}>
                Đơn giá tối đa: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatVnd(guideMaxPrice)}</strong>
              </label>
              <input
                id="guide-filter-max-price"
                type="range"
                aria-label="Đơn giá hướng dẫn viên tối đa mỗi ngày"
                min={450000}
                max={800000}
                step={50000}
                value={guideMaxPrice}
                onChange={(e) => setGuideMaxPrice(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-primary)' }}
              />
            </div>

            <div>
              <label htmlFor="guide-filter-sort" className="form-label" style={{ fontSize: '0.72rem' }}>Sắp xếp</label>
              <select
                id="guide-filter-sort"
                className="form-input"
                aria-label="Sắp xếp danh sách HDV"
                value={guideSort}
                onChange={(e) => setGuideSort(e.target.value as GuideSort)}
                style={{ fontSize: '0.8rem', borderRadius: 4 }}
              >
                <option value="rating">Đánh giá &amp; Uy tín</option>
                <option value="experience">Kinh nghiệm lâu năm</option>
                <option value="price_asc">Chi phí thấp đến cao</option>
                <option value="price_desc">Chi phí cao đến thấp</option>
              </select>
            </div>
          </div>

          {/* Guide Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: 14 }}>
            {filteredGuides.map((guide) => {
              const dial = extractPrimaryDialPhone(guide.phone);
              return (
                <article
                  key={guide._id || guide.slug || guide.name}
                  style={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <img
                        src={guide.avatarUrl || 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329095/trekmap/avatars/avatar_guide_1.jpg'}
                        alt={guide.name}
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: 6,
                          objectFit: 'cover',
                          border: '1px solid var(--color-border-strong)',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: '0.67rem',
                              fontWeight: 700,
                              color: 'var(--color-primary)',
                              background: 'color-mix(in srgb, var(--color-primary) 13%, var(--color-bg-main))',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}
                          >
                            <IconShieldCheck size={11} color="var(--color-primary)" />
                            Đơn Vị Chính Thức
                          </span>
                          <span style={{ fontSize: '0.71rem', color: 'var(--color-text-dim)' }}>
                            {guide.region} • {guide.experienceYears || 10}+ năm
                          </span>
                        </div>
                        <h3 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 700, color: 'var(--color-text-main)', lineHeight: 1.35 }}>
                          {guide.name}
                        </h3>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <IconStar size={13} color="var(--color-sun)" fill={guide.rating > 0 ? 'var(--color-sun)' : 'none'} />
                        <strong style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                          {guide.rating > 0 ? `${guide.rating.toFixed(1)} (${guide.reviewCount})` : 'Đơn vị Nhà nước'}
                        </strong>
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <IconUsers size={13} color="var(--color-sky)" />
                        Tối đa {guide.maxGroupSize || 12} khách/đoàn
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <IconCompass size={13} color="var(--color-earth)" />
                        {(guide.languages || ['Tiếng Việt']).join(', ')}
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.79rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                      {guide.bio || guide.priceNote}
                    </p>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(guide.specialties || []).map((sp) => (
                        <span
                          key={sp}
                          style={{
                            fontSize: '0.7rem',
                            padding: '3px 7px',
                            borderRadius: 4,
                            background: 'var(--color-bg-main)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          {sp}
                        </span>
                      ))}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 4,
                        padding: '8px 10px',
                      }}
                    >
                      <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>Đơn giá tham khảo</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatVnd(guide.basePricePerDayVnd || 600000)} / ngày
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => openInquiryModal(guide)}
                      style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem', padding: '8px 10px', borderRadius: 4 }}
                    >
                      <IconSend size={13} color="var(--color-on-primary)" />
                      <span>Gửi Yêu Cầu / Đặt Lịch</span>
                    </button>
                    <a
                      href={`tel:${dial}`}
                      className="btn btn-outline"
                      style={{ padding: '8px 11px', fontSize: '0.78rem', borderRadius: 4, fontVariantNumeric: 'tabular-nums', textDecoration: 'none' }}
                    >
                      <IconPhone size={13} color="var(--color-sky)" />
                      <span>{guide.phone}</span>
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: REAL VIETNAM TRIP COST ESTIMATOR (VND)                        */}
      {/* ==================================================================== */}
      {activeTab === 'cost' && (
        <div className="tab-content-slide" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 18, alignItems: 'start' }}>
          {/* Left Panel: Trip Parameters */}
          <div
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-main)', borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
              Thông Số Chuyến Đi
            </div>

            <div>
              <label htmlFor="cost-trail-select" className="form-label" style={{ fontSize: '0.76rem' }}>Chọn cung đường thực địa ({trails.length} cung)</label>
              <select
                id="cost-trail-select"
                className="form-input"
                aria-label="Chọn cung đường thực địa để tính chi phí"
                value={costTrailId}
                onChange={(e) => handleSelectCostTrail(e.target.value)}
                style={{ fontSize: '0.84rem', borderRadius: 4 }}
              >
                {trails.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.province} • {t.maxAltitudeM}m)
                  </option>
                ))}
              </select>
              {selectedCostTrail && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6, fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                  <span>{selectedCostTrail.distanceKm} km</span>
                  <span>•</span>
                  <span>Cao độ {selectedCostTrail.maxAltitudeM.toLocaleString('vi-VN')}m</span>
                  <span>•</span>
                  <span>Cấp {selectedCostTrail.difficultyLevel}/5</span>
                  {onSelectTrail && (
                    <button
                      type="button"
                      onClick={() => onSelectTrail(selectedCostTrail)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: 'var(--color-primary)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: '0.74rem',
                        fontFamily: 'var(--font-family)',
                      }}
                    >
                      Xem chi tiết cung
                    </button>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12 }}>
              <div>
                <label htmlFor="cost-group-size" className="form-label" style={{ fontSize: '0.76rem' }}>
                  Số thành viên: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{groupSize} người</strong>
                </label>
                <input
                  id="cost-group-size"
                  type="range"
                  aria-label="Số lượng thành viên trong đoàn"
                  min={1}
                  max={15}
                  value={groupSize}
                  onChange={(e) => setGroupSize(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                />
              </div>

              <div>
                <label htmlFor="cost-days" className="form-label" style={{ fontSize: '0.76rem' }}>
                  Thời lượng: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{days} ngày {Math.max(0, days - 1)} đêm</strong>
                </label>
                <input
                  id="cost-days"
                  type="range"
                  aria-label="Thời lượng hành trình tính theo ngày"
                  min={1}
                  max={5}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                />
              </div>
            </div>

            <div>
              <div className="form-label" style={{ fontSize: '0.76rem' }}>Phương tiện di chuyển</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {[
                  { id: 'xe_khach' as const, label: 'Xe Khách' },
                  { id: 'limousine' as const, label: 'Limousine' },
                  { id: 'tu_lai' as const, label: 'Tự Lái' },
                ].map((m) => {
                  const active = transportMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setTransportMode(m.id)}
                      style={{
                        padding: '8px 6px',
                        borderRadius: 4,
                        fontSize: '0.76rem',
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                        border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                        background: active
                          ? 'color-mix(in srgb, var(--color-primary) 15%, var(--color-bg-main))'
                          : 'var(--color-bg-main)',
                        color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        fontFamily: 'var(--font-family)',
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 10 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 10px',
                  borderRadius: 4,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-main)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                <input type="checkbox" checked={needGuide} onChange={(e) => setNeedGuide(e.target.checked)} />
                <span>Thuê HDV chính thức</span>
              </label>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: 4,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-main)',
                  fontSize: '0.78rem',
                }}
              >
                <span>Số Porter:</span>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    aria-label="Giảm số Porter"
                    onClick={() => setPortersCount((c) => Math.max(0, c - 1))}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      border: '1px solid var(--color-border-strong)',
                      background: 'var(--color-bg-card)',
                      color: 'var(--color-text-main)',
                      cursor: 'pointer',
                    }}
                  >
                    -
                  </button>
                  <strong style={{ minWidth: 16, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{portersCount}</strong>
                  <button
                    type="button"
                    aria-label="Tăng số Porter"
                    onClick={() => setPortersCount((c) => Math.min(5, c + 1))}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      border: '1px solid var(--color-border-strong)',
                      background: 'var(--color-bg-card)',
                      color: 'var(--color-text-main)',
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 10 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 10px',
                  borderRadius: 4,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-main)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={includeGearRental}
                  onChange={(e) => setIncludeGearRental(e.target.checked)}
                />
                <span>Thuê lều / túi ngủ / gậy</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 10px',
                  borderRadius: 4,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-main)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={includeHomestay}
                  onChange={(e) => setIncludeHomestay(e.target.checked)}
                />
                <span>Homestay nghỉ chân</span>
              </label>
            </div>
          </div>

          {/* Right Panel: Itemized Output + Pure Inline SVG Cost Breakdown Bar */}
          <div
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-strong)',
              borderTop: '3px solid var(--color-primary)',
              borderRadius: 6,
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Per-Person & Group Totals */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 10 }}>
              <div
                style={{
                  background: 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-main))',
                  border: '1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border))',
                  borderRadius: 4,
                  padding: '12px 14px',
                }}
              >
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                  Chi phí bình quân / người
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                  {formatVnd(activeEstimate.perPersonVnd)}
                </div>
              </div>

              <div
                style={{
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  padding: '12px 14px',
                }}
              >
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                  Tổng dự toán cả đoàn ({groupSize} người)
                </div>
                <div style={{ fontSize: '1.22rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                  {formatVnd(activeEstimate.totalGroupVnd)}
                </div>
              </div>
            </div>

            {/* Pure Inline SVG Horizontal Stacked Bar */}
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Tỷ trọng phân bổ ngân sách
              </div>
              <svg
                viewBox="0 0 600 22"
                preserveAspectRatio="none"
                width="100%"
                height="22"
                role="img"
                aria-label="Biểu đồ tỷ trọng chi phí chuyến đi"
                style={{ display: 'block', borderRadius: 4, overflow: 'hidden', background: 'var(--color-bg-main)' }}
              >
                {(() => {
                  let xOffset = 0;
                  const total = Math.max(1, activeEstimate.totalGroupVnd);
                  return activeEstimate.items.map((item) => {
                    const width = (item.totalVnd / total) * 600;
                    const rect = (
                      <rect
                        key={item.id}
                        x={xOffset}
                        y={0}
                        width={Math.max(0, width)}
                        height={22}
                        fill={item.color}
                      />
                    );
                    xOffset += width;
                    return rect;
                  });
                })()}
              </svg>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                {activeEstimate.items.map((item) => {
                  const pct = Math.round((item.totalVnd / Math.max(1, activeEstimate.totalGroupVnd)) * 100);
                  return (
                    <span
                      key={item.id}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}
                    >
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: item.color, display: 'inline-block' }} />
                      <span>{item.label}:</span>
                      <strong style={{ color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</strong>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Itemized Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeEstimate.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '9px 11px',
                    borderRadius: 4,
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    borderLeft: `3px solid ${item.color}`,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {item.detail}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                      {formatVnd(item.totalVnd)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>
                      {formatVnd(item.perPersonVnd)} / người
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCopyBudget}
                style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '9px 12px', borderRadius: 4 }}
              >
                <IconCopy size={14} />
                <span>Sao Chép Gửi Nhóm Zalo</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStartTripWithBudget}
                style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '9px 12px', borderRadius: 4 }}
              >
                <IconUsers size={14} color="var(--color-on-primary)" />
                <span>Lập Đoàn Với Chi Phí Này</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* INQUIRY / BOOKING MODAL                                              */}
      {/* ==================================================================== */}
      {inquiryGuide &&
        createPortal(
          <div
            onClick={() => !isSubmittingInquiry && setInquiryGuide(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'color-mix(in srgb, var(--color-bg-main) 84%, transparent)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              zIndex: 'var(--z-modal, 3000)' as unknown as number,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              fontFamily: 'var(--font-family)',
            }}
          >
            <div
              ref={inquiryModalRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="directory-inquiry-modal-title"
              aria-label={`Yêu cầu tư vấn và đặt lịch ${inquiryGuide.name}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 540,
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-strong)',
                borderTop: '3px solid var(--color-primary)',
                borderRadius: 6,
                padding: 20,
                boxShadow: 'var(--shadow-3d)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-primary)' }}>
                    Yêu Cầu Tư Vấn &amp; Đặt Lịch HDV
                  </div>
                  <h3 id="directory-inquiry-modal-title" style={{ margin: '2px 0 0', fontSize: '1.05rem', color: 'var(--color-text-main)' }}>
                    {inquiryGuide.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => !isSubmittingInquiry && setInquiryGuide(null)}
                  disabled={isSubmittingInquiry}
                  aria-label="Đóng hộp thoại đặt lịch"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: isSubmittingInquiry ? 'not-allowed' : 'pointer',
                    opacity: isSubmittingInquiry ? 0.5 : 1,
                    padding: 4,
                  }}
                >
                  <IconX size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitInquiry} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label htmlFor="inquiry-trail-select" className="form-label" style={{ fontSize: '0.76rem' }}>Cung đường dự kiến</label>
                  <select
                    id="inquiry-trail-select"
                    className="form-input"
                    aria-label="Chọn cung đường dự kiến"
                    value={inquiryTrailId}
                    onChange={(e) => setInquiryTrailId(e.target.value)}
                    style={{ fontSize: '0.82rem', borderRadius: 4 }}
                  >
                    {trails.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.province})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 10 }}>
                  <div>
                    <label htmlFor="inquiry-start-date" className="form-label" style={{ fontSize: '0.76rem' }}>Ngày khởi hành dự kiến</label>
                    <input
                      id="inquiry-start-date"
                      type="date"
                      className="form-input"
                      aria-label="Ngày khởi hành dự kiến"
                      value={inquiryDate}
                      onChange={(e) => setInquiryDate(e.target.value)}
                      required
                      style={{ fontSize: '0.82rem', borderRadius: 4 }}
                    />
                  </div>
                  <div>
                    <label htmlFor="inquiry-days" className="form-label" style={{ fontSize: '0.76rem' }}>Số ngày hành trình</label>
                    <input
                      id="inquiry-days"
                      type="number"
                      aria-label="Số ngày hành trình"
                      min={1}
                      max={7}
                      className="form-input"
                      value={inquiryDays}
                      onChange={(e) => setInquiryDays(Math.max(1, Math.min(7, Number(e.target.value) || 1)))}
                      required
                      style={{ fontSize: '0.82rem', borderRadius: 4 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 10 }}>
                  <div>
                    <label htmlFor="inquiry-group-size" className="form-label" style={{ fontSize: '0.76rem' }}>Số lượng thành viên</label>
                    <input
                      id="inquiry-group-size"
                      type="number"
                      aria-label="Số lượng thành viên trong đoàn"
                      min={1}
                      max={20}
                      className="form-input"
                      value={inquiryGroupSize}
                      onChange={(e) => setInquiryGroupSize(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                      required
                      style={{ fontSize: '0.82rem', borderRadius: 4 }}
                    />
                  </div>
                  <div>
                    <label htmlFor="inquiry-porters" className="form-label" style={{ fontSize: '0.76rem' }}>Số Porter cần hỗ trợ thêm</label>
                    <input
                      id="inquiry-porters"
                      type="number"
                      aria-label="Số Porter cần hỗ trợ thêm"
                      min={0}
                      max={10}
                      className="form-input"
                      value={inquiryPorters}
                      onChange={(e) => setInquiryPorters(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
                      style={{ fontSize: '0.82rem', borderRadius: 4 }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="inquiry-phone" className="form-label" style={{ fontSize: '0.76rem' }}>Số điện thoại liên hệ của trưởng đoàn</label>
                  <input
                    id="inquiry-phone"
                    type="tel"
                    className="form-input"
                    aria-label="Số điện thoại liên hệ của trưởng đoàn"
                    value={inquiryPhone}
                    onChange={(e) => setInquiryPhone(e.target.value)}
                    placeholder="VD: 0912345678"
                    required
                    style={{ fontSize: '0.82rem', borderRadius: 4 }}
                  />
                </div>

                <div>
                  <label htmlFor="inquiry-notes" className="form-label" style={{ fontSize: '0.76rem' }}>Ghi chú (yêu cầu ăn uống, thủ tục giấy phép, xe trung chuyển...)</label>
                  <textarea
                    id="inquiry-notes"
                    className="form-input"
                    aria-label="Ghi chú thêm cho trung tâm hướng dẫn viên"
                    rows={3}
                    value={inquiryNotes}
                    onChange={(e) => setInquiryNotes(e.target.value)}
                    placeholder="VD: Đoàn 4 người xuất phát sáng thứ 7, cần hỗ trợ đăng ký giấy phép VQG..."
                    style={{ fontSize: '0.82rem', borderRadius: 4, resize: 'vertical' }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: 4,
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Ước tính chi phí HDV + Porter</span>
                  <strong style={{ fontSize: '0.96rem', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatVnd(inquiryEstimateVnd)}
                  </strong>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => !isSubmittingInquiry && setInquiryGuide(null)}
                    disabled={isSubmittingInquiry}
                    style={{ borderRadius: 4, fontSize: '0.82rem' }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmittingInquiry}
                    style={{ borderRadius: 4, fontSize: '0.82rem' }}
                  >
                    <IconCheckCircle size={14} color="var(--color-on-primary)" />
                    <span>{isSubmittingInquiry ? 'Đang gửi...' : 'Gửi Yêu Cầu Tư Vấn'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ==================================================================== */}
      {/* SENT INQUIRIES DRAWER / MODAL                                        */}
      {/* ==================================================================== */}
      {isInquiriesOpen &&
        createPortal(
          <div
            onClick={() => setIsInquiriesOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'color-mix(in srgb, var(--color-bg-main) 82%, transparent)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              zIndex: 'var(--z-modal, 3000)' as unknown as number,
              display: 'flex',
              justifyContent: 'flex-end',
              fontFamily: 'var(--font-family)',
            }}
          >
            <div
              ref={inquiriesDrawerRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="directory-inquiries-drawer-title"
              aria-label="Lịch sử yêu cầu liên hệ HDV và Porter"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 'min(460px, 94vw)',
                height: '100dvh',
                background: 'var(--color-bg-card)',
                borderLeft: '1px solid var(--color-border-strong)',
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-sky)' }}>
                    Lịch Sử Liên Hệ HDV &amp; Porter
                  </div>
                  <h3 id="directory-inquiries-drawer-title" style={{ margin: '2px 0 0', fontSize: '1.08rem', color: 'var(--color-text-main)' }}>
                    Yêu Cầu Đã Gửi ({myInquiries.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsInquiriesOpen(false)}
                  aria-label="Đóng danh sách yêu cầu đã gửi"
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4 }}
                >
                  <IconX size={18} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {loadingInquiries ? (
                  <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', padding: 16, textAlign: 'center' }}>
                    Đang tải danh sách yêu cầu...
                  </div>
                ) : myInquiries.length === 0 ? (
                  <div
                    style={{
                      padding: 24,
                      borderRadius: 6,
                      border: '1px dashed var(--color-border)',
                      background: 'var(--color-bg-main)',
                      textAlign: 'center',
                      fontSize: '0.82rem',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    Bạn chưa gửi yêu cầu đặt lịch HDV/Porter nào. Chọn một đơn vị ở tab HDV Chính Thức để gửi yêu cầu.
                  </div>
                ) : (
                  myInquiries.map((inq) => {
                    const st = getInquiryStatusMeta(inq.status);
                    const gName =
                      typeof inq.guideId === 'object' && inq.guideId?.name
                        ? inq.guideId.name
                        : inq.guideName || 'Trung tâm HDV chính thức';
                    return (
                      <div
                        key={inq._id}
                        style={{
                          padding: 12,
                          borderRadius: 4,
                          background: 'var(--color-bg-main)',
                          border: '1px solid var(--color-border)',
                          borderLeft: `3px solid ${st.color}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: st.color }}>{st.label}</span>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                            {formatVnd(inq.estimatedTotalVnd || 0)}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                          {inq.trailName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Đơn vị: {gName}
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: '0.73rem', color: 'var(--color-text-dim)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <IconCalendar size={12} /> {inq.plannedStartDate} ({inq.durationDays}N)
                          </span>
                          <span>{inq.groupSize} người • {inq.needPortersCount} porter</span>
                        </div>
                        {inq.status === 'pending' && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => handleCancelInquiry(inq._id)}
                              style={{ padding: '4px 9px', fontSize: '0.72rem', borderRadius: 4 }}
                            >
                              Hủy yêu cầu
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
};
