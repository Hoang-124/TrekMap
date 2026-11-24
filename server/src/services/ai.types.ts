import type { Trail } from '../types.js';

export type AiEngineMode = 'auto' | 'knowledge' | 'gemini';
export type AiModelUsed = 'gemini-live' | 'lost-knowledge-engine';
export type AiFitnessLevel = 'beginner' | 'intermediate' | 'advanced';
export type AiPreferredRegion = 'auto' | 'north' | 'central' | 'taynguyen' | 'south';

export interface VerifiedEmergencyContact {
  name: string;
  phone: string; // Display string
  dialNumber: string; // Single strictly dialable tel: number
  rangerContact?: string;
  region?: string;
  address?: string;
}

export interface RankedTrailCardItem {
  id: string;
  name: string;
  province: string;
  district?: string;
  region: string;
  distanceKm: number;
  elevationGainM: number;
  maxAltitudeM: number;
  difficultyLevel: number;
  difficultyNote?: string;
  durationDays: number;
  durationHoursNote: string;
  coverImage?: string;
  bestMonths?: number[];
  matchScore: number; // 0..100
  matchReasons: string[];
  seasonStatus: 'ideal' | 'ok' | 'avoid';
  distanceFromUserKm?: number;
}

export interface BioCalcInput {
  trailId?: string;
  trailName?: string;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM?: number;
  maxAltitudeM: number;
  bodyWeightKg: number;
  packWeightKg: number;
  fitnessLevel: AiFitnessLevel;
  ambientTempC?: number;
  durationDays?: number;
}

export interface BioCalcResult {
  inputs: {
    trailName?: string;
    distanceKm: number;
    elevationGainM: number;
    elevationLossM: number;
    maxAltitudeM: number;
    bodyWeightKg: number;
    packWeightKg: number;
    fitnessLevel: AiFitnessLevel;
    ambientTempC: number;
    durationDays: number;
  };
  naismithHours: number;
  toblerHours: number;
  recommendedMovingHours: number;
  estimatedTotalTripHours: number; // Including rest & photo breaks (~20%)
  waterLitersTotal: number;
  waterLitersPerDay: number;
  oresolPackets: number;
  caloriesActiveKcal: number;
  caloriesDailyTotalKcal: number;
  packRatioPercent: number;
  packStatus: 'optimal' | 'caution' | 'overweight';
  packAdvice: string;
  amsRiskLevel: 'none' | 'low' | 'moderate' | 'high';
  amsAdvice: string;
  snackPlan: string[];
}

export interface FirstAidTriageCardData {
  severity: 'critical' | 'urgent' | 'moderate';
  conditionCode: string;
  conditionTitle: string;
  summary: string;
  immediateSteps: string[];
  forbiddenActions: string[];
  whenToEvacuate: string[];
  emergencyContacts: VerifiedEmergencyContact[];
  sosSmsNote: string;
}

export interface GoNoGoFactorBreakdown {
  weatherScore: number; // 0..100
  hazardScore: number; // 0..100
  seasonScore: number; // 0..100
  altitudeRiskLevel: 'low' | 'moderate' | 'high';
  summitTempMinC: number | null;
  summitTempMaxC: number | null;
  windChillC: number | null;
  seaOfCloudsIndex: number | null;
  gridElevationM: number | null;
  multiDayCheckedDays: number;
  weatherOutOfRange: boolean;
  forecastWindowNote?: string;
}

export interface GoNoGoAssessmentPayload {
  trailId: string;
  trailName: string;
  departureDate: string;
  score: number; // 0..100
  verdict: 'GO' | 'CAUTION' | 'NO_GO';
  verdictLabel: string;
  weatherSummary: {
    tempMinC: number;
    tempMaxC: number;
    summitTempMinC?: number;
    summitTempMaxC?: number;
    windChillC?: number;
    windSpeedKmH: number;
    precipMm: number;
    humidityPercent: number;
    conditionLabel: string;
    seaOfCloudsIndex?: number;
    source: string;
  } | null;
  factors: GoNoGoFactorBreakdown;
  activeIncidentsCount: number;
  recentConditions: Array<{ status: string; note: string; reportedAt: string }>;
  risks: string[];
  dynamicGearAdditions: string[];
  advice: string;
}

export interface GpxElevationSample {
  distanceKm: number;
  elevationM: number;
  slopePercent: number;
}

export interface GpxAnalysisResult {
  fileName: string;
  pointCount: number;
  elevationSource: 'gpx-elevation' | 'open-meteo-dem' | 'interpolated-fallback';
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  minAltitudeM: number;
  maxAltitudeM: number;
  avgGradePercent: number;
  maxSlopePercent: number;
  steepSegmentsPercent: number; // % of track with |grade| >= 15%
  estimatedDifficulty: number; // 1..5
  difficultyLabel: string;
  startCoord: { lat: number; lng: number };
  endCoord: { lat: number; lng: number };
  elevationProfile: GpxElevationSample[];
  bioMetrics: BioCalcResult;
  nearestTrail?: {
    id: string;
    name: string;
    province: string;
    distanceFromStartKm: number;
  } | null;
  weatherAtStart?: {
    tempMinC: number;
    tempMaxC: number;
    precipMm: number;
    windSpeedKmH: number;
    conditionLabel: string;
  } | null;
  safetyWarnings: string[];
  waterAdvice: string;
}

export interface StructuredGearCategory {
  category: string;
  items: Array<
    | string
    | {
        name: string;
        weightGrams?: number;
        isEssential?: boolean;
        reason?: string;
        targetCategory?: 'Trang phục' | 'Đồ ngủ & Lán' | 'Ăn uống & Nước' | 'Y tế & An toàn' | 'Điện tử' | 'Khác';
      }
  >;
}

export interface StructuredItineraryStep {
  day: number;
  time: string;
  title: string;
  description: string;
  locationNote?: string;
}

export interface ItineraryCardData {
  trailId?: string;
  trailName: string;
  durationLabel: string;
  steps: StructuredItineraryStep[];
}

export interface RichAiAssistantAction {
  type:
    | 'trail_card'
    | 'ranked_trails'
    | 'trail_compare_card'
    | 'emergency_sos'
    | 'first_aid_triage'
    | 'gear_checklist'
    | 'itinerary_card'
    | 'bio_calculator'
    | 'pace_schedule_card'
    | 'fuel_plan_card'
    | 'readiness_audit_card'
    | 'go_no_go_card'
    | 'gpx_analysis_card'
    | 'quick_reply';
  trailId?: string;
  trailName?: string;
  trailData?: Partial<Trail>;
  rankedTrails?: RankedTrailCardItem[];
  compareData?: TrailCompareData;
  emergencyContacts?: VerifiedEmergencyContact[];
  triageData?: FirstAidTriageCardData;
  checklistItems?: StructuredGearCategory[];
  itineraryData?: ItineraryCardData;
  bioCalcData?: BioCalcResult;
  pacePlanData?: PacePlanResult;
  fuelPlanData?: FuelPlanResult;
  readinessAuditData?: ReadinessAuditResult;
  goNoGoData?: GoNoGoAssessmentPayload;
  gpxData?: GpxAnalysisResult;
  suggestions?: string[];
}

export interface AiChatContextInput {
  pageView?: string;
  trailId?: string;
  trailName?: string;
  province?: string;
  maxAltitudeM?: number;
  difficultyLevel?: number;
  userCoordinates?: { lat: number; lng: number };
  preferredRegion?: AiPreferredRegion;
}

export interface ChatRequestPayload {
  message: string;
  threadId?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  engineMode?: AiEngineMode;
  context?: AiChatContextInput;
  // Backwards-compatible legacy fields (sanitized or ignored in favor of authoritative DB lookup)
  userName?: string;
  currentTrailContext?: {
    trailId?: string;
    trailName?: string;
    province?: string;
    maxAltitudeM?: number;
    difficultyLevel?: number;
  };
  userCoordinates?: {
    lat: number;
    lng: number;
  };
  // Authenticated user ID resolved strictly by optionalAuthMiddleware
  authenticatedUserId?: string;
}

export interface ChatResponsePayload {
  threadId?: string;
  reply: string;
  actions: RichAiAssistantAction[];
  modelUsed: AiModelUsed;
  contextUsed: {
    trailId?: string;
    trailName?: string;
    pageView?: string;
    weatherLive: boolean;
    activeIncidentsCount: number;
    userProfileApplied: boolean;
  };
}

/**
 * 100% Verified Official Vietnam Emergency & National Park Hotlines (Rule 11)
 * Zero fabricated or unverified landlines. Every `dialNumber` is strictly single-target tel: safe.
 */
export const VERIFIED_VIETNAM_EMERGENCY_CONTACTS: Record<string, VerifiedEmergencyContact> = {
  national112: {
    name: 'Tổng đài Tìm kiếm Cứu nạn Quốc gia (24/7)',
    phone: '112',
    dialNumber: '112',
    rangerContact: '114 (PCCC & CNCH) / 115 (Cấp cứu) / 113 (Công an)',
    region: 'Toàn quốc',
    address: 'Miễn phí gọi khẩn cấp trên mọi mạng di động tại Việt Nam',
  },
  fireRescue114: {
    name: 'Cảnh sát PCCC & Cứu nạn Cứu hộ (CNCH)',
    phone: '114',
    dialNumber: '114',
    rangerContact: '112 / 115',
    region: 'Toàn quốc',
    address: 'Ứng cứu sạt lở, lũ quét, cháy rừng & cứu nạn địa hình 24/7',
  },
  medical115: {
    name: 'Trung tâm Cấp cứu Y tế Khẩn cấp',
    phone: '115',
    dialNumber: '115',
    rangerContact: '112 / 114',
    region: 'Toàn quốc',
    address: 'Hỗ trợ cấp cứu chấn thương, sốc nhiệt, rắn cắn & vận chuyển y tế',
  },
  police113: {
    name: 'Cảnh sát Phản ứng nhanh',
    phone: '113',
    dialNumber: '113',
    rangerContact: '112 / 114',
    region: 'Toàn quốc',
    address: 'Hỗ trợ an ninh & phối hợp tìm kiếm cứu nạn địa phương 24/7',
  },
  hoangLien: {
    name: 'Ban Quản lý VQG Hoàng Liên (Fansipan, Sa Pa)',
    phone: '02143.871.494',
    dialNumber: '02143871494',
    rangerContact: '0985.834.581 (Trung tâm DL & BTSV Hoàng Liên) / 112',
    region: 'Lào Cai - Lai Châu',
    address: 'Thị xã Sa Pa, Tỉnh Lào Cai (Tuyến Trạm Tôn / Sín Chải)',
  },
  bachMa: {
    name: 'Ban Quản lý VQG Bạch Mã (Phú Lộc, TP. Huế)',
    phone: '0234.3871.330',
    dialNumber: '02343871330',
    rangerContact: '0836.356.669 / 114',
    region: 'TP. Huế - Đà Nẵng',
    address: 'Huyện Phú Lộc, Thành phố Huế',
  },
  bidoup: {
    name: 'Ban Quản lý VQG Bidoup - Núi Bà (Lạc Dương)',
    phone: '0263.3502.005',
    dialNumber: '02633502005',
    rangerContact: '0947.047.449 / 114',
    region: 'Lâm Đồng - Tây Nguyên',
    address: 'Xã Đạ Nhim, Huyện Lạc Dương, Tỉnh Lâm Đồng',
  },
  chuYangSin: {
    name: 'Ban Quản lý VQG Chư Yang Sin (Krông Bông)',
    phone: '0262.3734.226',
    dialNumber: '02623734226',
    rangerContact: '112 / 114',
    region: 'Đắk Lắk - Tây Nguyên',
    address: 'Huyện Krông Bông, Tỉnh Đắk Lắk',
  },
  konChuRang: {
    name: 'Ban Quản lý Khu BTTN Kon Chư Răng (Thác K50)',
    phone: '0985.551.682',
    dialNumber: '0985551682',
    rangerContact: '112 / 114',
    region: 'Gia Lai - Tây Nguyên',
    address: 'Xã Sơn Lang, Huyện Kbang, Tỉnh Gia Lai',
  },
  baDen: {
    name: 'Đội Cứu hộ KDL Quốc gia Núi Bà Đen (24/24)',
    phone: '0276.387.5678',
    dialNumber: '02763875678',
    rangerContact: '0276.3823.378 / 114',
    region: 'Tây Ninh - Đông Nam Bộ',
    address: 'Khu du lịch Quốc gia Núi Bà Đen, TP. Tây Ninh',
  },
  catTien: {
    name: 'Ban Quản lý VQG Cát Tiên (Khu Ramsar Bàu Sấu)',
    phone: '02513.669.228',
    dialNumber: '02513669228',
    rangerContact: '0856.669.228 / 114',
    region: 'Đồng Nai - Đông Nam Bộ',
    address: 'Huyện Tân Phú, Tỉnh Đồng Nai',
  },
  nuiChua: {
    name: 'Trung tâm Du lịch & GDMT VQG Núi Chúa',
    phone: '0798.889.468',
    dialNumber: '0798889468',
    rangerContact: '112 / 114',
    region: 'Ninh Thuận - Nam Trung Bộ',
    address: 'Xã Vĩnh Hải, Huyện Ninh Hải, Tỉnh Ninh Thuận',
  },
  puLuong: {
    name: 'Ban Quản lý Khu BTTN Pù Luông',
    phone: '02373.880.671',
    dialNumber: '02373880671',
    rangerContact: '112 / 114',
    region: 'Thanh Hóa - Bắc Trung Bộ',
    address: 'Huyện Bá Thước, Tỉnh Thanh Hóa',
  },
  laiChauForestry: {
    name: 'Chi cục Kiểm lâm Tỉnh Lai Châu (Pu Si Lung / Pu Ta Leng)',
    phone: '02133.876.605',
    dialNumber: '02133876605',
    rangerContact: '112 / 114',
    region: 'Lai Châu - Tây Bắc',
    address: 'Phường Đông Phong, TP. Lai Châu',
  },
  haGiangForestry: {
    name: 'Chi cục Kiểm lâm Hà Giang (Tây Côn Lĩnh)',
    phone: '0219.3861.628',
    dialNumber: '02193861628',
    rangerContact: '112 / 114',
    region: 'Hà Giang - Đông Bắc',
    address: 'TP. Hà Giang — Hạt Kiểm lâm Vị Xuyên',
  },
  lamDongForestry: {
    name: 'Chi cục Kiểm lâm Tỉnh Lâm Đồng (Tà Năng - Đức Trọng)',
    phone: '02633.822.441',
    dialNumber: '02633822441',
    rangerContact: '112 / 114',
    region: 'Lâm Đồng - Tây Nguyên',
    address: 'Số 04 Yên Thế, TP. Đà Lạt, Tỉnh Lâm Đồng',
  },
  khanhHoaForestry: {
    name: 'Chi cục Kiểm lâm Khánh Hòa (Vạn Ninh / Đầm Môn)',
    phone: '0258.3837.149',
    dialNumber: '02583837149',
    rangerContact: '112 / 114',
    region: 'Khánh Hòa - Nam Trung Bộ',
    address: 'Số 138 Đường 2/4, TP. Nha Trang, Tỉnh Khánh Hòa',
  },
  dongNaiForestry: {
    name: 'Chi cục Kiểm lâm Tỉnh Đồng Nai (Xuân Lộc / Chứa Chan)',
    phone: '0251.3992.053',
    dialNumber: '02513992053',
    rangerContact: '112 / 114',
    region: 'Đồng Nai - Đông Nam Bộ',
    address: 'Tỉnh Đồng Nai',
  },
  laoCaiYenBaiForestry: {
    name: 'Chi cục Kiểm lâm Lào Cai — Yên Bái (Cụm Tây Bắc)',
    phone: '02163.852.341',
    dialNumber: '02163852341',
    rangerContact: '112 / 114',
    region: 'Lào Cai - Yên Bái',
    address: 'Bát Xát / Trạm Tấu / Mù Cang Chải',
  },
  sonLaForestry: {
    name: 'Chi cục Kiểm lâm Tỉnh Sơn La (Pha Luông / Mộc Châu / Bắc Yên)',
    phone: '02123.852.046',
    dialNumber: '02123852046',
    rangerContact: '112 / 114',
    region: 'Sơn La - Tây Bắc',
    address: 'TP. Sơn La — Hỗ trợ Mộc Châu, Vân Hồ & Bắc Yên',
  },
  quangNinhForestry: {
    name: 'Chi cục Kiểm lâm Tỉnh Quảng Ninh (Bình Liêu / Mốc 1305)',
    phone: '02033.835.523',
    dialNumber: '02033835523',
    rangerContact: '112 / 114',
    region: 'Quảng Ninh - Đông Bắc',
    address: 'Hạt Kiểm lâm Huyện Bình Liêu, Tỉnh Quảng Ninh',
  },
  cucPhuongPark: {
    name: 'Ban Quản lý VQG Cúc Phương (Nho Quan, Ninh Bình)',
    phone: '1800.5555.88',
    dialNumber: '1800555588',
    rangerContact: '02293.848.006 / 112',
    region: 'Ninh Bình - Đồng bằng & Trung du Bắc Bộ',
    address: 'Xã Cúc Phương, Huyện Nho Quan, Tỉnh Ninh Bình',
  },
  honBaReserve: {
    name: 'Ban Quản lý Khu BTTN Hòn Bà (Cam Lâm / Khánh Vĩnh)',
    phone: '0258.3213.222',
    dialNumber: '02583213222',
    rangerContact: '112 / 114',
    region: 'Khánh Hòa - Nam Trung Bộ',
    address: 'Huyện Cam Lâm — Khánh Vĩnh, Tỉnh Khánh Hòa',
  },
  binhPhuocForestry: {
    name: 'Chi cục Kiểm lâm Tỉnh Bình Phước (Núi Bà Rá / Phước Long)',
    phone: '0271.3879.461',
    dialNumber: '02713879461',
    rangerContact: '112 / 114',
    region: 'Bình Phước - Đông Nam Bộ',
    address: 'Thị xã Phước Long, Tỉnh Bình Phước',
  },
};

export function extractPrimaryDialNumber(rawPhone?: string): string {
  const raw = String(rawPhone || '').trim();
  if (!raw) return '112';
  const firstSegment = raw.split(/[/|,;()]/)[0] || raw;
  const digits = firstSegment.replace(/[^\d+]/g, '');
  return digits.length >= 3 ? digits : '112';
}

// =========================================================================
// WAVE 3E: SMART TRAIL MATCHMAKER & PACK SURVIVAL AUDITOR CONTRACTS
// =========================================================================

export type TrailPreferenceTag =
  | 'san_may'
  | 'high_peak_2800'
  | 'waterfall_forest'
  | 'kid_friendly'
  | 'no_permit_needed';

export interface TrailRecommendInput {
  fitness: AiFitnessLevel;
  region: 'all' | 'Miền Bắc' | 'Miền Trung' | 'Miền Nam';
  durationDays: 'any' | 1 | 2 | 3;
  targetMonth: number; // 1..12
  preferences: TrailPreferenceTag[];
  userCoordinates?: { lat: number; lng: number };
}

export interface TrailMatchResultItem {
  id: string;
  name: string;
  province: string;
  district: string;
  region: string;
  maxAltitudeM: number;
  distanceKm: number;
  elevationGainM: number;
  durationDays: number;
  durationHoursNote: string;
  difficultyLevel: number;
  difficultyNote: string;
  permitRequired: boolean;
  kidFriendly: boolean;
  hasWaterSource: boolean;
  hasCampsite: boolean;
  coverImage: string;
  bestMonths: number[];
  avoidMonths: number[];
  matchScore: number; // 0..100
  seasonStatus: 'ideal' | 'ok' | 'avoid';
  pros: string[];
  warnings: string[];
  activeIncidentsCount: number;
  distanceFromUserKm?: number;
  estimatedBudgetRangeVnd: {
    min: number;
    max: number;
    note: string;
  };
}

export interface TrailRecommendResponse {
  matches: TrailMatchResultItem[];
  totalEvaluated: number;
  targetMonth: number;
  summaryNote: string;
}

export interface PackAuditItemInput {
  name: string;
  weightGrams?: number;
  checked?: boolean;
}

export interface PackAuditInput {
  trailId: string;
  bodyWeightKg: number;
  packWeightKg?: number;
  packedItems: PackAuditItemInput[];
}

export interface PackAuditMissingItem {
  name: string;
  category: 'Trang phục' | 'Đồ ngủ & Lán' | 'Ăn uống & Nước' | 'Y tế & An toàn' | 'Điện tử' | 'Khác';
  weightGrams: number;
  reason: string;
  severity: 'critical' | 'recommended';
}

export interface PackAuditResult {
  trailId: string;
  trailName: string;
  province: string;
  maxAltitudeM: number;
  difficultyLevel: number;
  durationDays: number;
  hasWaterSource: boolean;
  hasCampsite: boolean;
  permitRequired: boolean;
  summitTempMinC: number | null;
  weatherNote: string;
  readinessScore: number; // 0..100
  readinessGrade: 'SẴN SÀNG' | 'CẦN BỔ SUNG' | 'THIẾU ĐỒ AN TOÀN';
  packRatioPercent: number;
  packStatus: 'optimal' | 'caution' | 'overweight';
  totalPackedGrams: number;
  packedCount: number;
  criticalMissing: PackAuditMissingItem[];
  recommendedAdditions: PackAuditMissingItem[];
  weightSavingTips: string[];
  checklistHighlights: string[];
}

// =========================================================================
// WAVE 4C: HEAD-TO-HEAD MULTI-TRAIL COMPARISON CONTRACTS
// =========================================================================

export interface TrailCompareInput {
  trailIds?: string[];
  query?: string;
  activeTrailId?: string;
}

export interface TrailCompareItem {
  trailId: string;
  name: string;
  province: string;
  region: string;
  difficultyLevel: number;
  difficultyLabel: string;
  maxAltitudeM: number;
  distanceKm: number;
  elevationGainM: number;
  durationDays: number;
  durationLabel: string;
  naismithHours: number;
  waterLitersTotal: number;
  permitRequired: boolean;
  permitSummary: string;
  hasWaterSource: boolean;
  bestMonths: number[];
  seasonStatus: 'ideal' | 'ok' | 'avoid';
  activeIncidentsCount: number;
  activeIncidentNote?: string;
  estimatedBudgetVnd: {
    min: number;
    max: number;
    note: string;
  };
  highlightTag: string;
  fitnessRecommended: string;
}

export interface TrailCompareData {
  trails: TrailCompareItem[];
  targetMonth: number;
  summaryVerdict: string;
  beginnerPick: {
    trailId: string;
    name: string;
    reason: string;
  };
  veteranPick: {
    trailId: string;
    name: string;
    reason: string;
  };
  bestSeasonNote: string;
}

// =========================================================================
// WAVE 9C: FULL PRINTABLE PRE-TRIP EXPEDITION DOSSIER CONTRACTS
// =========================================================================

export interface ExpeditionBriefInput {
  trailId: string;
  departureDate?: string;
  groupSize?: number;
  fitnessLevel?: AiFitnessLevel;
  bodyWeightKg?: number;
  packWeightKg?: number;
}

export interface ExpeditionBriefRangerInfo {
  name: string;
  authorityType: 'national_park' | 'ranger_station' | 'border_guard' | 'rescue_center';
  province: string;
  address: string;
  hotlinePhone: string;
  emergencyPhone: string;
  dialNumber: string;
  permitRequired: boolean;
  permitLeadDays: number;
  permitFeeNote: string;
  officeHours: string;
  officialWebsite?: string;
}

export interface ExpeditionBriefBudgetLine {
  key: 'permit' | 'guide' | 'porter' | 'food' | 'shelter' | 'transport';
  label: string;
  detail: string;
  perPersonVnd: number;
  groupTotalVnd: number;
}

export interface ExpeditionBriefGearItem {
  name: string;
  category: 'Trang phục' | 'Đồ ngủ & Lán' | 'Ăn uống & Nước' | 'Y tế & An toàn' | 'Điện tử' | 'Khác';
  weightGrams: number;
  isEssential: boolean;
  reason: string;
}

export interface ExpeditionBriefResult {
  generatedAt: string;
  departureDate: string;
  groupSize: number;
  fitnessLevel: AiFitnessLevel;
  trail: {
    id: string;
    name: string;
    province: string;
    district: string;
    region: string;
    maxAltitudeM: number;
    distanceKm: number;
    elevationGainM: number;
    durationDays: number;
    durationHoursNote: string;
    difficultyLevel: number;
    difficultyNote: string;
    permitRequired: boolean;
    permitInfo?: string;
    hasWaterSource: boolean;
    hasCampsite: boolean;
    bestMonths: number[];
    avoidMonths: number[];
    transportationInfo: string;
    startLat: number;
    startLng: number;
  };
  goNoGo: GoNoGoAssessmentPayload | null;
  bioMetrics: BioCalcResult;
  rangerStation: ExpeditionBriefRangerInfo;
  itinerarySteps: StructuredItineraryStep[];
  survivalChecklist: ExpeditionBriefGearItem[];
  totalChecklistGrams: number;
  budget: {
    currency: 'VND';
    groupSize: number;
    days: number;
    lines: ExpeditionBriefBudgetLine[];
    perPersonVnd: number;
    groupTotalVnd: number;
    contingencyPerPersonVnd: number;
    grandTotalPerPersonVnd: number;
    grandTotalGroupVnd: number;
    note: string;
  };
  safetyNotes: string[];
}

// =========================================================================
// WAVE 10A: MULTIMODAL PHOTO TRIAGE CONTRACTS
// =========================================================================

export type SupportedTriageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export type ImageTriageCategory =
  | 'wildlife_snake'
  | 'flora_mushroom'
  | 'injury_medical'
  | 'weather_cloud'
  | 'gear_trail'
  | 'general';

export interface ImageTriageRequestPayload {
  imageBase64: string;
  mimeType?: string;
  question?: string;
  trailId?: string;
  threadId?: string;
}

export interface ImageTriageResponsePayload {
  threadId?: string;
  reply: string;
  actions: RichAiAssistantAction[];
  modelUsed: AiModelUsed;
  triageCategory: ImageTriageCategory;
  safetyDisclaimer: string;
  contextUsed: {
    trailId?: string;
    trailName?: string;
    imageBytes: number;
    detectedMimeType: SupportedTriageMimeType;
    geminiVisionUsed: boolean;
  };
}

// =========================================================================
// WAVE 12A: AI TURNAROUND TIME & NOAA SUNSET CUTOFF PACE PLANNER CONTRACTS
// =========================================================================

export interface PacePlanInput {
  trailId: string;
  departureDate?: string; // YYYY-MM-DD
  startTime?: string; // HH:MM (Vietnam UTC+7)
  packWeightKg?: number;
  bodyWeightKg?: number;
  fitnessLevel?: AiFitnessLevel;
  restMinutesPerHour?: number; // 0..30
  summitStayMinutes?: number; // 0..180
}

export interface PacePlanCheckpoint {
  day: number;
  etaTime: string; // HH:MM
  etaMinutesFromMidnight: number;
  label: string;
  kind: 'start' | 'waypoint' | 'camp' | 'summit' | 'turnaround' | 'finish';
  cumulativeKm: number;
  elevationM: number;
  note: string;
}

export interface NoaaSolarWindow {
  date: string;
  timezone: 'Asia/Ho_Chi_Minh';
  summitLat: number;
  summitLng: number;
  civilDawn: string; // HH:MM
  sunrise: string; // HH:MM
  solarNoon: string; // HH:MM
  sunset: string; // HH:MM
  civilDusk: string; // HH:MM
  civilDawnMin: number;
  sunriseMin: number;
  sunsetMin: number;
  civilDuskMin: number;
  daylightHours: number;
}

export interface PacePlanResult {
  trailId: string;
  trailName: string;
  province: string;
  region: string;
  maxAltitudeM: number;
  distanceKm: number;
  elevationGainM: number;
  durationDays: number;
  difficultyLevel: number;
  departureDate: string;
  inputs: {
    startTime: string;
    startMinutes: number;
    packWeightKg: number;
    bodyWeightKg: number;
    fitnessLevel: AiFitnessLevel;
    restMinutesPerHour: number;
    summitStayMinutes: number;
  };
  solar: NoaaSolarWindow;
  pacing: {
    ascentMovingHours: number;
    descentMovingHours: number;
    totalMovingHours: number;
    totalRestHours: number;
    totalElapsedHours: number;
    packPenaltyPercent: number;
    summitEta: string;
    summitEtaMin: number;
    finishEta: string;
    finishEtaMin: number;
    finishDay: number;
    safeTurnaroundTime: string;
    safeTurnaroundMin: number;
    recommendedStartTime: string;
    daylightMarginMinutes: number; // positive = finishes before sunset, negative = finishes after sunset
    headlampRequired: boolean;
    afterDarkRisk: 'safe' | 'tight' | 'dark_descent';
    riskSummary: string;
  };
  checkpoints: PacePlanCheckpoint[];
  tacticalNotes: string[];
}

// =========================================================================
// WAVE 14A: AI NUTRITION, HYDRATION & ELECTROLYTE PLANNER CONTRACTS
// =========================================================================

export type FuelDietType = 'standard' | 'vegetarian' | 'ultralight';

export interface FuelPlanInput {
  trailId: string;
  bodyWeightKg?: number;
  packWeightKg?: number;
  fitnessLevel?: AiFitnessLevel;
  dietType?: FuelDietType;
  ambientTempC?: number;
  humidityPct?: number;
  groupSize?: number;
}

export interface FuelWaterSpot {
  name: string;
  elevationM?: number;
  kind: 'stream' | 'camp' | 'station';
  treatmentNote: string;
}

export interface FuelRationItem {
  mealSlot: 'Sáng' | 'Dọc đường' | 'Trưa' | 'Tối lán' | 'Dự phòng';
  name: string;
  quantityLabel: string;
  weightGramsPerPerson: number;
  totalGramsGroup: number;
  kcalPerPerson: number;
  estimatedVndPerPerson: number;
  note: string;
}

export interface FuelPlanResult {
  trailId: string;
  trailName: string;
  province: string;
  region: string;
  maxAltitudeM: number;
  distanceKm: number;
  elevationGainM: number;
  durationDays: number;
  difficultyLevel: number;
  hasWaterSource: boolean;
  inputs: {
    bodyWeightKg: number;
    packWeightKg: number;
    fitnessLevel: AiFitnessLevel;
    dietType: FuelDietType;
    dietLabel: string;
    ambientTempC: number;
    humidityPct: number;
    groupSize: number;
  };
  energy: {
    movingHours: number;
    activeKcal: number;
    totalTripKcal: number;
    dailyKcal: number;
    carbsGrams: number;
    proteinGrams: number;
    fatGrams: number;
    carbsPct: number;
    proteinPct: number;
    fatPct: number;
  };
  hydration: {
    sweatRateLPerHour: number;
    waterLitersPerDay: number;
    waterLitersTotal: number;
    carryWaterPerLegLiters: number;
    sodiumMgPerDay: number;
    oresolPacketsPerDay: number;
    oresolPacketsTotal: number;
    hydrationAlert?: string;
    waterResupplySpots: FuelWaterSpot[];
  };
  rations: FuelRationItem[];
  totals: {
    foodWeightKgPerPerson: number;
    carryWaterWeightKgPerPerson: number;
    totalConsumableCarryKg: number;
    estimatedFoodCostVndPerPerson: number;
    estimatedFoodCostVndGroup: number;
    currency: 'VND';
  };
  tacticalNotes: string[];
}

// =========================================================================
// WAVE 16A: AI EXPEDITION READINESS AUDIT CONTRACTS (0-100 PRE-FLIGHT)
// =========================================================================

export type ReadinessVerdict = 'READY' | 'ADJUST_BEFORE_GO' | 'HOLD_OFF';

export interface ReadinessAuditInput {
  trailId: string;
  departureDate?: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  bodyWeightKg?: number;
  packWeightKg?: number;
  fitnessLevel?: AiFitnessLevel;
  dietType?: FuelDietType;
  groupSize?: number;
  hasPermitConfirmed?: boolean;
}

export interface ReadinessPillarScore {
  key: 'weatherSafety' | 'daylightPace' | 'loadFitness' | 'hydrationPermit';
  label: string;
  score: number; // 0..100
  weightPct: number;
  status: 'good' | 'warn' | 'critical';
  summary: string;
}

export interface ReadinessActionFix {
  priority: 'critical' | 'high' | 'medium';
  pillar: ReadinessPillarScore['key'];
  title: string;
  action: string;
}

export interface ReadinessAuditResult {
  trailId: string;
  trailName: string;
  province: string;
  region: string;
  maxAltitudeM: number;
  distanceKm: number;
  elevationGainM: number;
  durationDays: number;
  difficultyLevel: number;
  departureDate: string;
  daysUntilDeparture: number;
  readinessScore: number; // 0..100
  verdict: ReadinessVerdict;
  verdictLabel: string;
  inputs: {
    startTime: string;
    bodyWeightKg: number;
    packWeightKg: number;
    packRatioPercent: number;
    fitnessLevel: AiFitnessLevel;
    dietType: FuelDietType;
    groupSize: number;
    hasPermitConfirmed: boolean;
  };
  pillars: ReadinessPillarScore[];
  topFixes: ReadinessActionFix[];
  snapshot: {
    weatherAvailable: boolean;
    goNoGoVerdict: 'GO' | 'CAUTION' | 'NO_GO' | null;
    goNoGoScore: number | null;
    noaaSunset: string;
    safeTurnaroundTime: string;
    daylightMarginMinutes: number;
    waterLitersPerDay: number;
    carryWaterPerLegLiters: number;
    oresolPacketsTotal: number;
    dailyKcal: number;
    permitRequired: boolean;
    isBorderPermit: boolean;
    recommendedPermitLeadDays: number;
    emergencyPhone: string;
  };
}
