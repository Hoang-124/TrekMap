import type { Trail } from '../../types.js';

export type AiEngineMode = 'auto' | 'knowledge' | 'gemini';
export type AiModelUsed = 'gemini-live' | 'lost-knowledge-engine';
export type AiFitnessLevel = 'beginner' | 'intermediate' | 'advanced';
export type AiPreferredRegion = 'auto' | 'north' | 'central' | 'taynguyen' | 'south';

export interface VerifiedEmergencyContact {
  name: string;
  phone: string;
  dialNumber?: string;
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
  matchScore: number;
  matchReasons: string[];
  seasonStatus: 'ideal' | 'ok' | 'avoid';
  distanceFromUserKm?: number;
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
  estimatedTotalTripHours: number;
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
  weatherScore: number;
  hazardScore: number;
  seasonScore: number;
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

export interface GoNoGoAssessmentData {
  trailId: string;
  trailName: string;
  departureDate: string;
  score: number;
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
    source?: string;
  } | null;
  factors?: GoNoGoFactorBreakdown;
  activeIncidentsCount: number;
  recentConditions?: Array<{ status: string; note: string; reportedAt: string }>;
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
  steepSegmentsPercent: number;
  estimatedDifficulty: number;
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

export interface StructuredGearItem {
  name: string;
  weightGrams?: number;
  isEssential?: boolean;
  reason?: string;
  targetCategory?: 'Trang phục' | 'Đồ ngủ & Lán' | 'Ăn uống & Nước' | 'Y tế & An toàn' | 'Điện tử' | 'Khác';
}

export interface StructuredGearCategory {
  category: string;
  items: Array<string | StructuredGearItem>;
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

export interface RichAiAction {
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
  goNoGoData?: GoNoGoAssessmentData;
  gpxData?: GpxAnalysisResult;
  suggestions?: string[];
}

export interface RichAiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  modelUsed?: AiModelUsed;
  actions?: RichAiAction[];
  imagePreviewUrl?: string;
  imageCaption?: string;
  isError?: boolean;
  retryPrompt?: string;
}

export interface AiChatThreadSummary {
  id: string;
  title: string;
  pinned: boolean;
  trailContextId?: string;
  trailContextName?: string;
  messageCount: number;
  lastMessageAt: string;
  isLocalOnly?: boolean;
}

export interface LocalAiThreadRecord extends AiChatThreadSummary {
  messages: RichAiChatMessage[];
}

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
  targetMonth: number;
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
  matchScore: number;
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
  readinessScore: number;
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
  goNoGo: GoNoGoAssessmentData | null;
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
  mimeType: SupportedTriageMimeType;
  question?: string;
  trailId?: string;
  threadId?: string;
}

export interface ImageTriageResponsePayload {
  threadId?: string;
  reply: string;
  actions: RichAiAction[];
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
  departureDate?: string;
  startTime?: string;
  packWeightKg?: number;
  bodyWeightKg?: number;
  fitnessLevel?: AiFitnessLevel;
  restMinutesPerHour?: number;
  summitStayMinutes?: number;
}

export interface PacePlanCheckpoint {
  day: number;
  etaTime: string;
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
  civilDawn: string;
  sunrise: string;
  solarNoon: string;
  sunset: string;
  civilDusk: string;
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
    daylightMarginMinutes: number;
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
  departureDate?: string;
  startTime?: string;
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
  score: number;
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
  readinessScore: number;
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
