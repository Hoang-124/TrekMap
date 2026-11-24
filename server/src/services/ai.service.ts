import mongoose, { Types } from 'mongoose';
import { TrailModel } from '../models/Trail.js';
import { AiKnowledgeModel } from '../models/AiKnowledge.js';
import { IncidentModel } from '../models/Incident.js';
import { UserModel } from '../models/User.js';
import { mockTrails } from '../data/seedData.js';
import {
  queryKnowledgeDataset,
  normalizeSearchText,
  hasWholePhrase,
  levenshteinDistance,
  VIETNAM_PEAKS_MATRIX,
} from '../data/trekkerKnowledgeDataset.js';
import { computeTrailGoNoGo, getVietnamTodayIso, isValidCalendarDateIso } from './goNoGo.service.js';
import { calculateAlpineBioMetrics } from './aiBioCalculator.service.js';
import { computeTrailPacePlan } from './aiPacePlanner.service.js';
import { computeTrailFuelPlan } from './aiFuelPlanner.service.js';
import { computeExpeditionReadinessAudit } from './aiReadinessAudit.service.js';
import {
  isComparisonIntent,
  detectTrailsForComparison,
  compareVietnamTrails,
} from './aiRecommendAudit.service.js';
import {
  VERIFIED_VIETNAM_EMERGENCY_CONTACTS,
  extractPrimaryDialNumber,
  type ChatRequestPayload,
  type ChatResponsePayload,
  type RichAiAssistantAction,
  type VerifiedEmergencyContact,
  type RankedTrailCardItem,
  type FirstAidTriageCardData,
  type StructuredGearCategory,
  type ItineraryCardData,
  type GoNoGoAssessmentPayload,
  type AiFitnessLevel,
  type FuelDietType,
  type SupportedTriageMimeType,
  type ImageTriageCategory,
  type ImageTriageResponsePayload,
} from './ai.types.js';
import type { Trail } from '../types.js';

export type { ChatRequestPayload, ChatResponsePayload };

/**
 * Strips all emoji characters while preserving Markdown line indentation (Rule 12).
 */
export function removeEmojis(str: string): string {
  if (!str) return '';
  return str
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{200D}\u{FE0F}]/gu,
      ''
    )
    .replace(/([^\s])[ \t]{2,}/g, '$1 ')
    .trim();
}

// 100% Verified Official Vietnam Emergency Hotlines (Rule 11 — zero fabricated .114 numbers)
export const REAL_EMERGENCY_CONTACTS: VerifiedEmergencyContact[] = [
  VERIFIED_VIETNAM_EMERGENCY_CONTACTS.national112,
  VERIFIED_VIETNAM_EMERGENCY_CONTACTS.fireRescue114,
  VERIFIED_VIETNAM_EMERGENCY_CONTACTS.medical115,
  VERIFIED_VIETNAM_EMERGENCY_CONTACTS.hoangLien,
  VERIFIED_VIETNAM_EMERGENCY_CONTACTS.bachMa,
  VERIFIED_VIETNAM_EMERGENCY_CONTACTS.bidoup,
  VERIFIED_VIETNAM_EMERGENCY_CONTACTS.chuYangSin,
  VERIFIED_VIETNAM_EMERGENCY_CONTACTS.konChuRang,
];

const SYSTEM_INSTRUCTION = `Bạn là LOST AI — Trợ lý Trí tuệ Thám hiểm & Sinh tồn Núi cao chuyên biệt cho cộng đồng trekking tại Việt Nam trên nền tảng LOST.

PHONG CÁCH GIAO TIẾP:
- Thân thiện, tôn trọng, ngắn gọn, sắc bén, giàu dữ kiện thực địa; xưng "em" hoặc "mình" và gọi người dùng bằng tên (nếu có trong ngữ cảnh xác thực) hoặc "bạn trekker".
- Định dạng Markdown sạch đẹp: in đậm từ khóa (**Lảo Thẩn**, **S.T.O.P**, **Quy tắc 3 lớp áo**), gạch đầu dòng thoáng, tuyệt đối không viết wall of text.
- TUYỆT ĐỐI KHÔNG DÙNG BẤT KỲ EMOJI NÀO (Hệ thống LOST chỉ sử dụng Vector SVG thuần túy).
- TUYỆT ĐỐI KHÔNG bịa số điện thoại cứu hộ, cao độ đỉnh hay tọa độ. Chỉ dùng đúng số liệu thực tế Việt Nam và hotline xác thực (112, 113, 114, 115, VQG Hoàng Liên 02143.871.494 / 0985.834.581, VQG Bạch Mã 0234.3871.330, VQG Bidoup - Núi Bà 0263.3502.005, VQG Chư Yang Sin 0262.3734.226, Khu BTTN Kon Chư Răng 0985.551.682).
- Khi ngữ cảnh có sẵn dữ liệu thời tiết Open-Meteo, đánh giá Go/No-Go, sự cố thực địa hoặc hồ sơ người dùng, HÃY KHAI THÁC TRỰC TIẾP và trích dẫn chính xác số liệu đó.
- Khi người dùng ở tình huống nguy hiểm (AMS, lạc đường, hạ thân nhiệt, rắn cắn, gãy xương, lũ quét, sốc nhiệt, ong đốt, hoảng loạn), ưu tiên hướng dẫn sơ cứu chuẩn WFA (việc cần làm + CẤM KỴ) và số cứu hộ trước tiên.
- Luôn bảo vệ quy định PCCC rừng (Nghị định 35/2019/NĐ-CP) và 7 nguyên tắc Leave No Trace.`;

// In-memory trail cache (0ms latency)
let cachedTrails: Trail[] = mockTrails;
let lastCacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

// Gemini circuit breaker (prevents cascading timeouts during quota/outage)
let geminiCircuitOpenUntil = 0;

export function invalidateAiTrailCache() {
  lastCacheTimestamp = 0;
}

function sanitizePromptContextText(raw: unknown, maxLen = 80): string {
  return removeEmojis(String(raw ?? ''))
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[\[\]<>`#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export async function getAllAvailableTrails(): Promise<Trail[]> {
  const now = Date.now();
  if (cachedTrails.length > 0 && lastCacheTimestamp > 0 && now - lastCacheTimestamp < CACHE_TTL_MS) {
    return cachedTrails;
  }

  // Never poison the 5-min cache with mockTrails before MongoDB finishes connecting
  if (mongoose.connection.readyState !== 1) {
    return mockTrails;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const dbPromise = TrailModel.find({ status: 'approved' }).lean().maxTimeMS(1500);
    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => resolve(null), 1200);
    });
    const dbTrails = await Promise.race([dbPromise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);

    if (dbTrails && Array.isArray(dbTrails) && dbTrails.length > 0) {
      cachedTrails = dbTrails.map((t: any) => ({
        // CRITICAL FIX: Preserve canonical slug `t.id` (e.g. 'trail-laothan') before MongoDB `_id`
        id: t.id || String(t._id),
        name: t.name || 'Cung đường LOST',
        altNames: Array.isArray(t.altNames) ? t.altNames : [],
        region: t.region || 'Miền Bắc',
        province: t.province || '',
        district: t.district || '',
        startLat: Number(t.startLat) || 22.3364,
        startLng: Number(t.startLng) || 103.8438,
        endLat: Number(t.endLat) || Number(t.startLat) || 22.3032,
        endLng: Number(t.endLng) || Number(t.startLng) || 103.7753,
        distanceKm: Number(t.distanceKm) || 12,
        elevationGainM: Number(t.elevationGainM) || 700,
        maxAltitudeM: Number(t.maxAltitudeM) || 1500,
        durationDays: Number(t.durationDays) || 2,
        durationHoursNote: t.durationHoursNote || '2N1Đ',
        difficultyLevel: Number(t.difficultyLevel) || 3,
        difficultyNote: t.difficultyNote || '',
        bestMonths: Array.isArray(t.bestMonths) ? t.bestMonths : [],
        avoidMonths: Array.isArray(t.avoidMonths) ? t.avoidMonths : [],
        gpxTrack: Array.isArray(t.gpxTrack) ? t.gpxTrack : [],
        waypoints: Array.isArray(t.waypoints) ? t.waypoints : [],
        description: t.description || '',
        transportationInfo: t.transportationInfo || '',
        permitRequired: Boolean(t.permitRequired),
        permitInfo: t.permitInfo || '',
        rescueContact: t.rescueContact || {
          name: 'Tổng đài Tìm kiếm Cứu nạn Quốc gia',
          phone: '112 / 114',
          rangerContact: '115',
        },
        coverImage: t.coverImage || '',
        galleryImages: Array.isArray(t.galleryImages) ? t.galleryImages : [],
        hasCampsite: Boolean(t.hasCampsite),
        hasWaterSource: Boolean(t.hasWaterSource),
        kidFriendly: Boolean(t.kidFriendly),
        rating: Number(t.rating) || 0,
        reviewCount: Number(t.reviewCount) || 0,
        status: t.status || 'approved',
        createdAt: t.createdAt ? String(t.createdAt) : new Date().toISOString(),
        updatedAt: t.updatedAt ? String(t.updatedAt) : new Date().toISOString(),
      }));
      lastCacheTimestamp = now;
      return cachedTrails;
    }
  } catch {
    if (timeoutId) clearTimeout(timeoutId);
    // Instant fallback to verified seed trails without poisoning cache TTL
  }

  return mockTrails;
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return Math.round(R * c);
}

/**
 * Sanitizes conversation history for Gemini API:
 * - Drops leading 'assistant' / welcome messages
 * - Merges consecutive identical roles so contents strictly alternates user / model
 */
function buildSanitizedGeminiContents(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  currentPrompt: string
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  const mapped: Array<{ role: 'user' | 'model'; text: string }> = [];

  for (const h of history.slice(-8)) {
    const clean = removeEmojis(h.content || '').trim();
    if (!clean) continue;
    const role: 'user' | 'model' = h.role === 'user' ? 'user' : 'model';
    // Must start with 'user'
    if (mapped.length === 0 && role === 'model') continue;
    const prev = mapped[mapped.length - 1];
    if (prev && prev.role === role) {
      prev.text = `${prev.text}\n\n${clean}`.slice(0, 2000);
    } else {
      mapped.push({ role, text: clean.slice(0, 1500) });
    }
  }

  const promptClean = removeEmojis(currentPrompt).trim();
  const last = mapped[mapped.length - 1];
  if (last && last.role === 'user') {
    last.text = `${last.text}\n\n${promptClean}`.slice(0, 2000);
  } else {
    mapped.push({ role: 'user', text: promptClean });
  }

  return mapped.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
}

/**
 * Call Live Google Gemini API via x-goog-api-key header (never URL query param)
 * with 7s timeout, fast-fail on 400/401/403, and 60s circuit breaker on quota errors.
 */
async function generateWithGemini(
  prompt: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  contextData: string = ''
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  if (Date.now() < geminiCircuitOpenUntil) return null;

  const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
  const systemInstructionText = `${SYSTEM_INSTRUCTION}\n\n[NGỮ CẢNH XÁC THỰC TỪ HỆ THỐNG LOST]:\n${contextData}`;
  const contents = buildSanitizedGeminiContents(history, prompt);

  for (const modelName of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: AbortSignal.timeout(7000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstructionText }] },
          contents,
          generationConfig: {
            temperature: 0.35,
            topP: 0.9,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (response.ok) {
        const data: any = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && typeof text === 'string') {
          return removeEmojis(text.trim());
        }
      } else {
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          console.warn(`[LOST AI] Gemini fast-fail HTTP ${response.status} on ${modelName}`);
          return null;
        }
        if (response.status === 429 || response.status === 503) {
          geminiCircuitOpenUntil = Date.now() + 60_000;
          console.warn(`[LOST AI] Gemini rate-limited/unavailable (${response.status}), opening 60s circuit breaker`);
          return null;
        }
      }
    } catch (err) {
      console.warn(`[LOST AI] Gemini timeout/error on ${modelName}:`, (err as Error)?.message || err);
    }
  }

  return null;
}

/**
 * Matches a trail from the normalized query (with aliases & Levenshtein typo tolerance).
 */
const GENERIC_LOCATION_ALIASES = new Set([
  'sa pa',
  'sapa',
  'nha trang',
  'khanh hoa',
  'lai chau',
  'lao cai',
  'yen bai',
  'son la',
  'moc chau',
  'ha giang',
  'quang ninh',
  'ninh binh',
  'thanh hoa',
  'hue',
  'da nang',
  'lam dong',
  'da lat',
  'dong nai',
  'tay ninh',
  'binh phuoc',
  'ba ria',
  'vung tau',
  'dak lak',
  'ninh thuan',
  'gia lai',
  'binh thuan',
  'ha noi',
]);

function findMentionedTrail(normalizedQ: string, trails: Trail[]): Trail | undefined {
  if (!normalizedQ) return undefined;
  const tokens = normalizedQ.split(' ').filter((t) => t.length >= 4);

  let best: { trail: Trail; score: number } | null = null;
  const consider = (trail: Trail | undefined, score: number) => {
    if (!trail) return;
    if (!best || score > best.score) {
      best = { trail, score };
    }
  };

  // 1. Score ALL Peak Matrix matches so specific peak names (e.g. "Hòn Bà") strictly outrank broad city/province aliases ("Nha Trang"/"Khánh Hòa")
  for (const peak of VIETNAM_PEAKS_MATRIX) {
    if (!peak.canonicalTrailId) continue;
    const found = trails.find((t) => t.id === peak.canonicalTrailId);
    if (!found) continue;

    const peakNameNorm = normalizeSearchText(peak.name);
    if (peakNameNorm.length >= 3 && hasWholePhrase(normalizedQ, peakNameNorm)) {
      consider(found, 220 + peakNameNorm.length);
    }

    for (const alias of peak.aliases) {
      const normAlias = normalizeSearchText(alias);
      if (normAlias.length < 2) continue;
      const isGenericLoc = GENERIC_LOCATION_ALIASES.has(normAlias);
      if (hasWholePhrase(normalizedQ, normAlias)) {
        const aliasScore = isGenericLoc
          ? 40 + normAlias.length
          : (normAlias.includes(' ') ? 170 : 140) + normAlias.length;
        consider(found, aliasScore);
      } else if (!isGenericLoc && !normAlias.includes(' ') && normAlias.length >= 5) {
        const maxD = normAlias.length >= 7 ? 2 : 1;
        if (tokens.some((tok) => levenshteinDistance(tok, normAlias, maxD) <= maxD)) {
          consider(found, 80 + normAlias.length);
        }
      }
    }
  }

  // 2. Score canonical trail name / altNames matches as well
  for (const t of trails) {
    const nameNorm = normalizeSearchText(t.name);
    if (nameNorm.length >= 3 && hasWholePhrase(normalizedQ, nameNorm)) {
      consider(t, 230 + nameNorm.length);
    }
    if (Array.isArray(t.altNames)) {
      for (const alt of t.altNames) {
        const normAlt = normalizeSearchText(alt);
        if (normAlt.length < 3) continue;
        if (hasWholePhrase(normalizedQ, normAlt)) {
          const isGenericLoc = GENERIC_LOCATION_ALIASES.has(normAlt);
          consider(t, isGenericLoc ? 40 + normAlt.length : 160 + normAlt.length);
        }
      }
    }
  }

  return best ? (best as { trail: Trail; score: number }).trail : undefined;
}

/**
 * Builds relevant verified Vietnam emergency contacts for a query / trail context.
 */
function selectEmergencyContacts(normalizedQ: string, activeTrail?: Trail): VerifiedEmergencyContact[] {
  const list: VerifiedEmergencyContact[] = [
    VERIFIED_VIETNAM_EMERGENCY_CONTACTS.national112,
    VERIFIED_VIETNAM_EMERGENCY_CONTACTS.fireRescue114,
    VERIFIED_VIETNAM_EMERGENCY_CONTACTS.medical115,
  ];
  const combined = `${normalizedQ} ${activeTrail ? normalizeSearchText(`${activeTrail.name} ${activeTrail.province}`) : ''}`;

  if (hasWholePhrase(combined, 'fansipan') || hasWholePhrase(combined, 'sa pa') || hasWholePhrase(combined, 'hoang lien') || hasWholePhrase(combined, 'ngu chi son')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.hoangLien);
  } else if (hasWholePhrase(combined, 'pu si lung') || hasWholePhrase(combined, 'pu ta leng') || hasWholePhrase(combined, 'ta lien') || hasWholePhrase(combined, 'co trau') || hasWholePhrase(combined, 'lai chau')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.laiChauForestry);
  } else if (hasWholePhrase(combined, 'pha luong') || hasWholePhrase(combined, 'moc chau') || hasWholePhrase(combined, 'van ho')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.sonLaForestry);
  } else if (hasWholePhrase(combined, 'binh lieu') || hasWholePhrase(combined, 'moc 1305') || hasWholePhrase(combined, 'cao xiem') || hasWholePhrase(combined, 'quang ninh')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.quangNinhForestry);
  } else if (hasWholePhrase(combined, 'cuc phuong') || hasWholePhrase(combined, 'may bac') || hasWholePhrase(combined, 'nho quan') || hasWholePhrase(combined, 'ninh binh')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.cucPhuongPark);
  } else if (hasWholePhrase(combined, 'tay con linh') || hasWholePhrase(combined, 'ha giang')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.haGiangForestry);
  } else if (hasWholePhrase(combined, 'lao than') || hasWholePhrase(combined, 'ta xua') || hasWholePhrase(combined, 'ky quan san') || hasWholePhrase(combined, 'ta chi nhu') || hasWholePhrase(combined, 'lung cung') || hasWholePhrase(combined, 'nhiu co san') || hasWholePhrase(combined, 'lao cai') || hasWholePhrase(combined, 'yen bai')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.laoCaiYenBaiForestry);
  } else if (hasWholePhrase(combined, 'son la')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.sonLaForestry);
  } else if (hasWholePhrase(combined, 'pu luong') || hasWholePhrase(combined, 'thanh hoa')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.puLuong);
  } else if (hasWholePhrase(combined, 'bach ma') || hasWholePhrase(combined, 'hue') || hasWholePhrase(combined, 'da nang')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.bachMa);
  } else if (hasWholePhrase(combined, 'hon ba') || hasWholePhrase(combined, 'yersin') || hasWholePhrase(combined, 'cam lam') || hasWholePhrase(combined, 'khanh vinh')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.honBaReserve);
  } else if (hasWholePhrase(combined, 'mui doi') || hasWholePhrase(combined, 'dam mon') || hasWholePhrase(combined, 'khanh hoa')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.khanhHoaForestry);
  } else if (hasWholePhrase(combined, 'nui chua') || hasWholePhrase(combined, 'ninh thuan')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.nuiChua);
  } else if (hasWholePhrase(combined, 'bidoup') || hasWholePhrase(combined, 'lac duong')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.bidoup);
  } else if (hasWholePhrase(combined, 'ta nang') || hasWholePhrase(combined, 'lam dong')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.lamDongForestry);
  } else if (hasWholePhrase(combined, 'chu yang sin') || hasWholePhrase(combined, 'dak lak')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.chuYangSin);
  } else if (hasWholePhrase(combined, 'k50') || hasWholePhrase(combined, 'kon chu rang') || hasWholePhrase(combined, 'gia lai')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.konChuRang);
  } else if (hasWholePhrase(combined, 'ba ra') || hasWholePhrase(combined, 'phuoc long') || hasWholePhrase(combined, 'thac mo') || hasWholePhrase(combined, 'binh phuoc')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.binhPhuocForestry);
  } else if (hasWholePhrase(combined, 'cat tien') || hasWholePhrase(combined, 'bau sau')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.catTien);
  } else if (hasWholePhrase(combined, 'chua chan') || hasWholePhrase(combined, 'dong nai')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.dongNaiForestry);
  } else if (hasWholePhrase(combined, 'ba den') || hasWholePhrase(combined, 'tay ninh')) {
    list.unshift(VERIFIED_VIETNAM_EMERGENCY_CONTACTS.baDen);
  } else if (activeTrail?.rescueContact?.phone) {
    const dial = extractPrimaryDialNumber(activeTrail.rescueContact.phone);
    if (!['112', '114', '115', '113'].includes(dial)) {
      list.unshift({
        name: activeTrail.rescueContact.name || `Cứu hộ ${activeTrail.province}`,
        phone: activeTrail.rescueContact.phone,
        dialNumber: dial,
        rangerContact: activeTrail.rescueContact.rangerContact,
        region: activeTrail.province,
      });
    }
  }

  // Deduplicate by dialNumber
  const seen = new Set<string>();
  return list.filter((c) => {
    if (seen.has(c.dialNumber)) return false;
    seen.add(c.dialNumber);
    return true;
  });
}

/**
 * Priority-0 Wilderness First Aid & Emergency Triage Detector (Runs BEFORE greetings & FAQ!).
 */
function detectEmergencyTriage(normalizedQ: string, activeTrail?: Trail): {
  triage: FirstAidTriageCardData;
  reply: string;
  suggestions: string[];
} | null {
  const contacts = selectEmergencyContacts(normalizedQ, activeTrail);
  const trailLabel = activeTrail ? ` tại ${activeTrail.name}` : '';

  const matchAny = (phrases: string[]) => phrases.some((p) => hasWholePhrase(normalizedQ, p));

  if (matchAny(['soc do cao', 'ams', 'say do cao', 'phu phoi', 'phu nao', 'hape', 'hace'])) {
    const triage: FirstAidTriageCardData = {
      severity: 'critical',
      conditionCode: 'WFA-AMS',
      conditionTitle: 'Sốc Độ Cao Cấp Tính (AMS / HAPE / HACE)',
      summary: 'Thiếu oxy não và mô ở độ cao > 2.200m. Hạ độ cao là biện pháp điều trị triệt để duy nhất.',
      immediateSteps: [
        'HẠ CAO ĐỘ NGAY LẬP TỨC xuống thấp hơn tối thiểu 300m – 500m.',
        'Đưa nạn nhân vào nơi kín gió, giữ ấm cổ & ngực, tư thế nửa nằm nửa ngồi.',
        'Cho uống từng ngụm nước ấm pha Oresol hoặc trà gừng đường.',
        'Hướng dẫn hít thở chậm sâu bằng mũi, thở ra dứt khoát bằng miệng.',
      ],
      forbiddenActions: [
        'TUYỆT ĐỐI KHÔNG gắng sức leo tiếp để "cố chạm đỉnh".',
        'KHÔNG cho uống rượu bia, thuốc ngủ hoặc để nạn nhân ngủ một mình trong lều.',
      ],
      whenToEvacuate: [
        'Nôn mửa liên tục, mất thăng bằng (đi loạng choạng như say rượu).',
        'Ho khạc đờm hồng có bọt, thở rít khò khè ngay cả khi nghỉ (dấu hiệu HAPE).',
        'Lú lẫn, nói sảng hoặc hôn mê (dấu hiệu phù não HACE).',
      ],
      emergencyContacts: contacts,
      sosSmsNote: `Can ho tro khan cap SOC DO CAO (AMS)${trailLabel}. Dang tien hanh ha do cao.`,
    };
    return {
      triage,
      reply: `**CẤP CỨU SỐC ĐỘ CAO (AMS)${trailLabel ? ` — ${activeTrail!.name}` : ''}:**\n\n1. **Hạ độ cao ngay lập tức 300m – 500m** — đây là quy tắc sống còn.\n2. Nghỉ kín gió, giữ ấm, bù nước ấm pha **Oresol**.\n3. Nếu xuất hiện lú lẫn, mất thăng bằng hoặc thở khò khè, gọi ngay **112 / 115** bằng thẻ cứu hộ bên dưới.`,
      suggestions: ['Hotline cứu hộ khẩn cấp', 'Cách xử lý hạ thân nhiệt', 'Quy tắc thở nhịp điệu khi leo cao'],
    };
  }

  if (matchAny(['lac duong', 'bi lac', 'lac rung', 'mat dau', 'mat phuong huong', 's t o p'])) {
    const triage: FirstAidTriageCardData = {
      severity: 'critical',
      conditionCode: 'WFA-LOST',
      conditionTitle: 'Lạc Đường / Mất Dấu Tracklog (Giao thức S.T.O.P)',
      summary: 'Dừng di chuyển ngay để không đi sâu vào khu vực hiểm trở; giữ nguyên vị trí thoáng và phát tín hiệu.',
      immediateSteps: [
        'S — Stop: Dừng bước ngay lập tức, hít thở sâu bình tĩnh.',
        'T — Think: Đối chiếu điểm mốc rõ gần nhất và kiểm tra bản đồ Offline / GPX.',
        'O — Observe: Tìm vị trí cao thoáng bắt sóng (sống núi/mỏm đá), tránh gốc cây mục.',
        'P — Plan: Thổi còi 3 hồi ngắn cách nhau 1 phút; gửi SMS 2G kèm tọa độ GPS cho 112 & người thân.',
      ],
      forbiddenActions: [
        'TUYỆT ĐỐI KHÔNG đi bừa xuống khe suối cạn vì rất dễ kẹt thác cụt / vực đá dựng đứng.',
        'KHÔNG di chuyển trong rừng đêm khi hết đèn hoặc sương mù trắng xóa.',
      ],
      whenToEvacuate: [
        'Trời sắp tối, mưa lớn/giông sét hoặc có thành viên chấn thương/lạnh run.',
        'Gọi ngay 112 hoặc gửi tin nhắn SOS 2G bên dưới để đội CNCH khoanh vùng tọa độ.',
      ],
      emergencyContacts: contacts,
      sosSmsNote: `TOI BI LAC DUONG${trailLabel}. Dang dung yen theo quy tac STOP, can ho tro dinh vi & cuu nan.`,
    };
    return {
      triage,
      reply: `**GIAO THỨC SINH TỒN S.T.O.P KHI LẠC ĐƯỜNG${trailLabel ? ` (${activeTrail!.name})` : ''}:**\n\n- **Dừng lại ngay** — tuyệt đối không đi theo khe suối cạn.\n- Mở nút **Soạn SOS 2G kèm GPS** ngay trong thẻ bên dưới để gửi tọa độ ngay cả khi không có 4G.`,
      suggestions: ['Cách định hướng khi mất điện thoại đêm', 'Xử lý hạ thân nhiệt khi chờ cứu hộ', 'Kỹ thuật nhóm lửa khi củi ẩm'],
    };
  }

  if (matchAny(['ha than nhiet', 'hypothermia', 'nhiem lanh', 'run ray', 'cong lanh'])) {
    const triage: FirstAidTriageCardData = {
      severity: 'critical',
      conditionCode: 'WFA-HYPO',
      conditionTitle: 'Hạ Thân Nhiệt (Hypothermia)',
      summary: 'Nhiệt độ lõi cơ thể tụt dưới 35°C do ướt mưa, gió núi và mất sức.',
      immediateSteps: [
        'Đưa nạn nhân vào lều/lán kín gió, trải thảm cách nhiệt ngăn hơi lạnh mặt đất.',
        'Thay toàn bộ quần áo ướt bằng đồ khô ráo, đội mũ len che đầu cổ.',
        'Ủ ấm trung tâm (nách, ngực, bẹn) bằng chai nước ấm 40–45°C bọc khăn hoặc túi sưởi.',
        'Cho nhấp từng ngụm trà gừng đường nóng (chỉ khi nạn nhân còn tỉnh táo hoàn toàn).',
      ],
      forbiddenActions: [
        'CẤM xoa bóp mạnh tay chân (dễ đẩy máu lạnh ngoại vi về tim gây ngừng tim đột ngột).',
        'CẤM cho uống rượu hoặc đặt nguồn nhiệt quá nóng trực tiếp lên da.',
      ],
      whenToEvacuate: [
        'Nạn nhân ngừng run rẩy dù vẫn rất lạnh, nói lắp, lờ đờ hoặc bất tỉnh.',
      ],
      emergencyContacts: contacts,
      sosSmsNote: `Can cap cuu HA THAN NHIET${trailLabel}. Dang u am trong diem va can ho tro y te.`,
    };
    return {
      triage,
      reply: `**CẤP CỨU HẠ THÂN NHIỆT (HYPOTHERMIA):**\n\nƯu tiên số 1 là **cách ly gió lạnh + thay đồ khô + ủ ấm vùng ngực/nách/bẹn**. Xem ngay quy trình và nút gọi cấp cứu bên dưới.`,
      suggestions: ['Quy tắc 3 lớp áo chống lạnh', 'Nhóm lửa khi củi ướt', 'Hotline cứu hộ gần nhất'],
    };
  }

  if (matchAny(['ran can', 'ran doc', 'so cuu ran', 'noc doc'])) {
    const triage: FirstAidTriageCardData = {
      severity: 'critical',
      conditionCode: 'WFA-SNAKE',
      conditionTitle: 'Sơ Cứu Rắn Độc Cắn (Chuẩn WFA)',
      summary: 'Bất động chi bị cắn thấp hơn tim và chuyển viện có huyết thanh kháng nọc nhanh nhất có thể.',
      immediateSteps: [
        'Đặt nạn nhân nằm yên, trấn an tinh thần để giảm nhịp tim.',
        'Cố định chi bị cắn bằng nẹp và giữ THẤP HƠN MỨC TIM.',
        'Rửa nhẹ bằng nước sạch, tháo bỏ nhẫn/đồng hồ trước khi sưng nề.',
        'Băng ép thun đàn hồi từ đầu chi lên trên (vẫn sờ thấy mạch đập), chụp ảnh con rắn nếu an toàn.',
      ],
      forbiddenActions: [
        'CẤM rạch da vết cắn và CẤM hút nọc bằng miệng.',
        'CẤM đắp lá rừng gây nhiễm trùng uốn ván.',
        'CẤM garo thắt chặt làm hoại tử chi.',
      ],
      whenToEvacuate: [
        'Mọi trường hợp nghi rắn độc cắn đều phải cáng vận chuyển khẩn cấp tới bệnh viện tuyến huyện/tỉnh.',
      ],
      emergencyContacts: contacts,
      sosSmsNote: `CAP CUU RAN DOC CAN${trailLabel}. Da bat dong chi thap hon tim, can ho tro van chuyen y te gap.`,
    };
    return {
      triage,
      reply: `**SƠ CỨU RẮN ĐỘC CẮN KHẨN CẤP:**\n\nBất động chi bị cắn **thấp hơn tim**, băng ép đàn hồi nhẹ và cáng xuống bệnh viện ngay — **tuyệt đối không rạch da, hút nọc hay garo chặt**.`,
      suggestions: ['Hotline cấp cứu 115 / 112', 'Kỹ thuật nẹp cố định chi', 'Túi sơ cứu y tế cần có gì'],
    };
  }

  const fractureKeywords = [
    'gay xuong',
    'gay chan',
    'gay tay',
    'gay co chan',
    'gay co tay',
    'gay xuong don',
    'chan thuong cot song',
    'nep xuong',
  ];
  const sprainKeywords = ['bong gan', 'lat so mi', 'lat co chan', 'treo chan', 'trat khop', 'sai khop'];
  if (matchAny([...fractureKeywords, ...sprainKeywords])) {
    const isFracture = matchAny(fractureKeywords);
    const triage: FirstAidTriageCardData = {
      severity: isFracture ? 'critical' : 'urgent',
      conditionCode: isFracture ? 'WFA-FRACTURE' : 'WFA-SPRAIN',
      conditionTitle: isFracture ? 'Cố Định Chấn Thương Gãy Xương' : 'Xử Lý Bong Gân / Lật Sơ Mi (R.I.C.E)',
      summary: isFracture
        ? 'Bất động trên 1 khớp và dưới 1 khớp bằng gậy trekking, chống sốc và gọi đội cứu hộ cáng chuyển.'
        : 'Áp dụng ngay R.I.C.E để giảm sưng nề và bảo vệ dây chằng cổ chân.',
      immediateSteps: isFracture
        ? [
            'Dùng 2 gậy trekking hoặc 2 cành cây thẳng đặt 2 bên chi, chêm đệm vải mềm tại các đầu xương nhô.',
            'Buộc 4–5 mối vải chắc cố định cả khớp trên và khớp dưới ổ gãy (không buộc đè lên vị trí gãy).',
            'Kiểm tra đầu ngón tay/chân vẫn ấm hồng, giữ ấm toàn thân chống sốc.',
          ]
        : [
            'R (Rest): Ngừng dồn lực lên chân đau ngay lập tức.',
            'I (Ice): Chườm/ngâm nước suối mát 15–20 phút giảm sưng.',
            'C (Compression): Quấn băng thun hình số 8 quanh cổ chân và bàn chân.',
            'E (Elevation): Kê chân cao hơn tim khi nghỉ; chia balo cho đồng đội và chống 2 gậy trekking.',
          ],
      forbiddenActions: isFracture
        ? ['KHÔNG tự ý kéo nắn xương gãy hở hoặc bắt nạn nhân cố đi tiếp.', 'KHÔNG buộc dây quá chặt làm mất mạch đầu chi.']
        : ['KHÔNG xoa dầu nóng trực tiếp trong 24–48 giờ đầu (làm sưng tụ máu nặng hơn).'],
      whenToEvacuate: ['Biến dạng chi, đau dữ dội không thể đặt chân xuống đất, tê bì hoặc chảy máu hở.'],
      emergencyContacts: contacts,
      sosSmsNote: `Can ho tro chan thuong ${isFracture ? 'GAY XUONG' : 'BONG GAN NANG'}${trailLabel}. Can cang chuyen cuu ho.`,
    };
    return {
      triage,
      reply: `**HƯỚNG DẪN SƠ CỨU ${isFracture ? 'GÃY XƯƠNG' : 'BONG GÂN / LẬT SƠ MI'} NGOÀI THỰC ĐỊA:**\n\nThực hiện đúng các bước cố định bên dưới và liên hệ cứu hộ ngay nếu nạn nhân không thể tự di chuyển.`,
      suggestions: ['Hotline cứu hộ 114 / 115', 'Bảo vệ khớp gối khi xuống dốc', 'Tiêu chuẩn chọn giày trekking'],
    };
  }

  if (matchAny(['soc nhiet', 'say nang', 'say nong', 'heat stroke', 'lu quet', 'lu ong', 'set danh', 'tranh set', 'ong dot', 'ong vo ve', 'ong bap cay', 'nam doc', 'ngo doc nam', 'hoang loan', 'panic attack', 'hen suyen', 'tut duong huyet', 'cuu ho', 'khan cap', 'sos', 'tai nan'])) {
    const isHeat = matchAny(['soc nhiet', 'say nang', 'say nong', 'heat stroke']);
    const isLightning = matchAny(['set danh', 'tranh set']);
    const isFlood = matchAny(['lu quet', 'lu ong']);
    const isWasp = matchAny(['ong dot', 'ong vo ve', 'ong bap cay']);
    const isMushroom = matchAny(['nam doc', 'ngo doc nam']);
    const isPanic = matchAny(['hoang loan', 'panic attack']);
    const isAsthma = matchAny(['hen suyen']);
    const isHypoglycemia = matchAny(['tut duong huyet']);

    const triage: FirstAidTriageCardData = {
      severity: isPanic ? 'urgent' : 'critical',
      conditionCode: isHeat
        ? 'WFA-HEAT'
        : isLightning
        ? 'WFA-LIGHTNING'
        : isFlood
        ? 'WFA-FLOOD'
        : isWasp
        ? 'WFA-WASP'
        : isMushroom
        ? 'WFA-POISON'
        : isPanic
        ? 'WFA-PANIC'
        : isAsthma
        ? 'WFA-ASTHMA'
        : isHypoglycemia
        ? 'WFA-HYPOGLYCEMIA'
        : 'WFA-SOS',
      conditionTitle: isHeat
        ? 'Cấp Cứu Sốc Nhiệt (Heat Stroke)'
        : isLightning
        ? 'Phòng Tránh Sét Đánh Trên Đỉnh Núi'
        : isFlood
        ? 'Thoát Hiểm Lũ Quét / Lũ Ống'
        : isWasp
        ? 'Thoát Hiểm Bầy Ong Vò Vẽ Tấn Công'
        : isMushroom
        ? 'Cấp Cứu Ngộ Độc Nấm Rừng (WFA)'
        : isPanic
        ? 'Ổn Định Cơn Hoảng Loạn / Sợ Độ Cao (Panic Attack)'
        : isAsthma
        ? 'Xử Trí Cơn Hen Suyễn Ngoài Thực Địa'
        : isHypoglycemia
        ? 'Cấp Cứu Tụt Đường Huyết Cấp (Hypoglycemia)'
        : 'Giao Thức Ứng Phó Khẩn Cấp & Hotline Cứu Hộ Việt Nam',
      summary: 'Giữ bình tĩnh, ưu tiên tính mạng trước đồ đạc và kích hoạt liên hệ cứu nạn thực tế 112 / 114 / 115.',
      immediateSteps: isHeat
        ? [
            'Đưa ngay vào bóng râm, nới lỏng quần áo ngoài.',
            'Làm mát tích cực: dội/lau nước mát khắp thân và quạt liên tục.',
            'Chườm lạnh 3 điểm động mạch lớn: Cổ, Nách và Bẹn.',
          ]
        : isLightning
        ? [
            'Rút ngay khỏi đỉnh trọc, sống núi và cây đứng đơn độc.',
            'Đặt gậy kim loại và balo khung nhôm cách xa tối thiểu 15–20m.',
            'Ngồi tư thế Lightning Squat: ngồi xổm, chụm sát 2 gót chân, gục đầu vào gối, bịt tai.',
          ]
        : isFlood
        ? [
            'Thấy nước suối chuyển đục ngầu cuốn lá khô hoặc có tiếng ầm thượng nguồn -> CHẠY NGAY LÊN ĐỒI CAO.',
            'Tháo chốt đai ngực & đai hông balo nếu đang lội suối.',
            'Hạ trại cách mép suối >= 50m và cao hơn mặt nước >= 3m.',
          ]
        : isWasp
        ? [
            'Trùm áo khoác/khăn kín đầu, mặt và cổ ngay lập tức.',
            'Chạy xuôi chiều gió 100–200m xuyên qua bụi rậm để gạt bầy ong.',
            'Sau khi thoát nạn, dùng cạnh thẻ gạt ngang ngòi ong và chườm lạnh.',
          ]
        : isMushroom
        ? [
            'Ngưng ăn ngay và giữ lại mẫu nấm / ảnh chụp nấm còn thừa để bác sĩ định danh độc tố.',
            'Nếu nạn nhân còn tỉnh táo và mới ăn trong vòng < 1 giờ: cho uống than hoạt tính (nếu có) và bù nước Oresol từng ngụm nhỏ.',
            'Sơ tán khẩn cấp xuống cơ sở y tế gần nhất — độc tố nấm tán trắng gây suy gan thận muộn sau 6–24 giờ dù cơn nôn đã giảm.',
          ]
        : isPanic
        ? [
            'Dừng di chuyển tại vị trí bằng phẳng an toàn, tránh nhìn xuống vực sâu.',
            'Hướng dẫn thở hộp 4-4-4-4 (hít 4 giây, giữ 4 giây, thở chậm 4 giây, nghỉ 4 giây) trong 3 phút.',
            'Áp dụng neo cảm giác 5-4-3-2-1 và cho uống nước ấm, nói chuyện trấn an giọng trầm chậm.',
          ]
        : isAsthma
        ? [
            'Cho nạn nhân ngồi thẳng hơi nghiêng người ra trước (tư thế Tripod), nới lỏng đai ngực balo.',
            'Dùng ngay bình xịt cắt cơn Salbutamol (2 nhát cách nhau 1 phút), giữ ấm đường thở bằng khăn che mũi miệng nếu trời lạnh.',
            'Nếu không đỡ sau 10 phút hoặc tím môi, khò khè nặng -> gọi 115 / 112 và hạ độ cao ngay lập tức.',
          ]
        : isHypoglycemia
        ? [
            'Cho dừng leo ngay và nạp 15–20g đường hấp thu nhanh (gel năng lượng, 3–4 viên kẹo ngọt, nước đường ấm hoặc mật ong) nếu còn tỉnh táo.',
            'Chờ 15 phút kiểm tra lại tình trạng run tay, vã mồ hôi, hoa mắt; sau đó bổ sung tinh bột phức (lương khô/bánh mì) để tránh tụt đường tái phát.',
            'Nếu nạn nhân lơ mơ hoặc ngất -> đặt tư thế nằm nghiêng an toàn và gọi cấp cứu 115 / 112 ngay.',
          ]
        : [
            'Dừng lại đánh giá hiện trường an toàn (không để thêm người gặp nạn).',
            'Bật định vị GPS trên điện thoại để lấy tọa độ chính xác gửi đội cứu hộ.',
            'Gọi ngay 112 / 114 / 115 hoặc bấm nút Soạn SMS 2G bên dưới khi mất sóng 4G.',
          ],
      forbiddenActions: isHeat
        ? ['CẤM đổ nước vào miệng nếu nạn nhân lơ mơ hoặc hôn mê (nguy cơ sặc chết ngạt).']
        : isLightning
        ? ['CẤM nằm áp bụng xuống mặt đất hoặc trú dưới gốc cây cao đơn độc.']
        : isWasp
        ? ['CẤM đứng vung tay đập ong (làm vỡ pheromone gọi cả đàn) và CẤM nhảy xuống suối chảy xiết.']
        : isMushroom
        ? ['CẤM ép nôn nếu nạn nhân lơ mơ/co giật; CẤM chủ quan ở lại rừng chỉ vì hết nôn tạm thời.']
        : isHypoglycemia
        ? ['CẤM nhét đồ ăn hoặc đổ nước đường vào miệng người đã bất tỉnh/lơ mơ (gây sặc đường thở).']
        : isAsthma
        ? ['CẤM để nạn nhân nằm ngửa hoặc tiếp tục leo dốc khi còn khó thở.']
        : ['KHÔNG tự ý tách đoàn đi tìm đường một mình trong sương mù hoặc ban đêm.'],
      whenToEvacuate: ['Có dấu hiệu khó thở, ngất, sốc phản vệ, nôn liên tục, co giật, chảy máu không cầm hoặc không hồi phục sau 15 phút.'],
      emergencyContacts: contacts,
      sosSmsNote: `CAN HO TRO CUU NAN KHAN CAP${trailLabel}. Vui long lien he va dieu phoi cuu ho theo toa do GPS.`,
    };
    return {
      triage,
      reply: `**${triage.conditionTitle.toUpperCase()}:**\n\nThực hiện ngay các bước xử lý ưu tiên và liên hệ đường dây nóng xác thực trong thẻ cứu hộ khẩn cấp bên dưới.`,
      suggestions: ['Xử lý sốc độ cao (AMS)', 'Quy tắc S.T.O.P khi lạc đường', 'Sơ cứu rắn độc cắn chuẩn WFA'],
    };
  }

  return null;
}

/**
 * Generates an altitude/duration/weather-tailored structured Gear Checklist ready for 1-click Apply.
 */
function buildStructuredGearChecklist(trail?: Trail, goNoGo?: GoNoGoAssessmentPayload | null): StructuredGearCategory[] {
  const isHighAlt = (trail?.maxAltitudeM ?? 2000) >= 2400;
  const isMultiDay = (trail?.durationDays ?? 2) >= 2;
  const isHard = (trail?.difficultyLevel ?? 3) >= 4;
  const isRainy = (goNoGo?.weatherSummary?.precipMm ?? 0) >= 8;

  const clothingItems: StructuredGearCategory['items'] = [
    { name: 'Áo thun thể thao thoát mồ hôi (Base Layer) x2', weightGrams: 300, isEssential: true, targetCategory: 'Trang phục' },
    {
      name: isHighAlt ? 'Áo khoác lông vũ siêu nhẹ giữ ấm (-5°C)' : 'Áo nỉ giữ nhiệt (Mid Layer)',
      weightGrams: 420,
      isEssential: true,
      targetCategory: 'Trang phục',
      reason: isHighAlt ? `Đỉnh cao ${trail?.maxAltitudeM}m ban đêm lạnh sâu` : 'Giữ ấm sáng sớm & tối',
    },
    { name: 'Áo gió chống thấm nước (Outer Shell)', weightGrams: 380, isEssential: true, targetCategory: 'Trang phục' },
    { name: 'Quần trekking nhanh khô + Tất len Merino (2–3 đôi)', weightGrams: 450, isEssential: true, targetCategory: 'Trang phục' },
    { name: 'Áo mưa bộ 2 lớp + Áo trùm balo chống thấm', weightGrams: 450, isEssential: true, targetCategory: 'Trang phục', reason: isRainy ? 'Dự báo có mưa thực địa' : 'Phòng mưa rừng đột ngột' },
  ];

  const moveItems: StructuredGearCategory['items'] = [
    { name: 'Giày trekking cổ lửng đế gai bám đá (rộng hơn 0.5–1 size)', weightGrams: 850, isEssential: true, targetCategory: 'Trang phục' },
    { name: 'Gậy trekking hợp kim nhôm (1 cặp)', weightGrams: 500, isEssential: isHard, targetCategory: 'Trang phục', reason: 'Giảm 25% áp lực khớp gối khi đổ dốc' },
    { name: 'Đèn pin đội đầu (Headlamp) + Pin dự phòng', weightGrams: 200, isEssential: true, targetCategory: 'Điện tử' },
    { name: 'Sạc dự phòng 20.000mAh + Dây cáp trong túi zip chống ẩm', weightGrams: 420, isEssential: true, targetCategory: 'Điện tử' },
    { name: 'Còi sinh tồn SOS + Bật lửa chống gió', weightGrams: 80, isEssential: true, targetCategory: 'Y tế & An toàn' },
  ];

  if (isMultiDay) {
    moveItems.push(
      { name: isHighAlt ? 'Túi ngủ chịu nhiệt 0°C – 5°C' : 'Túi ngủ dã ngoại 10°C', weightGrams: 1100, isEssential: true, targetCategory: 'Đồ ngủ & Lán', reason: 'Hành trình ngủ lán / hạ trại qua đêm' },
      { name: 'Đệm cách nhiệt trải lán / nền lều', weightGrams: 350, isEssential: true, targetCategory: 'Đồ ngủ & Lán' }
    );
  }

  const medicalFoodItems: StructuredGearCategory['items'] = [
    { name: 'Bình / Túi nước 2–3L + Viên lọc Aquatabs hoặc màng lọc Sawyer', weightGrams: 320, isEssential: true, targetCategory: 'Ăn uống & Nước' },
    { name: 'Oresol bù điện giải (2–3 gói) + Lương khô / Gel năng lượng / Hạt', weightGrams: 550, isEssential: true, targetCategory: 'Ăn uống & Nước' },
    { name: 'Túi sơ cứu cá nhân (Gạc tiệt trùng, băng thun, Povidine, Paracetamol, Berberin)', weightGrams: 350, isEssential: true, targetCategory: 'Y tế & An toàn' },
    { name: 'Thuốc bôi chống vắt DEP / Xịt côn trùng DEET + Miếng dán giữ nhiệt', weightGrams: 150, isEssential: true, targetCategory: 'Y tế & An toàn' },
    { name: 'Túi rác tự phân hủy (Zero-Waste Leave No Trace)', weightGrams: 50, isEssential: true, targetCategory: 'Khác' },
  ];

  const categories: StructuredGearCategory[] = [
    { category: 'Trang phục & Giữ nhiệt (Quy tắc 3 lớp)', items: clothingItems },
    { category: 'Di chuyển, Ánh sáng & Nghỉ đêm', items: moveItems },
    { category: 'Nước uống, Dinh dưỡng & Y tế Dã ngoại', items: medicalFoodItems },
  ];

  if (goNoGo && goNoGo.dynamicGearAdditions.length > 0) {
    categories.push({
      category: `Bổ sung theo Thời tiết Thực tế (${goNoGo.departureDate})`,
      items: goNoGo.dynamicGearAdditions.map((name) => ({
        name,
        weightGrams: 250,
        isEssential: true,
        targetCategory: 'Y tế & An toàn',
        reason: `Go/No-Go ${goNoGo.verdict}`,
      })),
    });
  }

  return categories;
}

/**
 * Builds a structured Itinerary Card for a specific trail ready for 1-click Apply.
 */
function buildTrailItineraryCard(trail: Trail): ItineraryCardData {
  const isOneDay = trail.durationDays <= 1;
  const steps = isOneDay
    ? [
        { day: 1, time: '05:30', title: 'Tập trung & Khởi động tại cửa rừng', description: `Kiểm tra balo, đăng ký khai báo (${trail.permitRequired ? trail.permitInfo || 'Trạm Kiểm lâm' : 'điểm xuất phát'}) tại ${trail.district || trail.province}.`, locationNote: `${trail.district ? trail.district + ', ' : ''}${trail.province}` },
        { day: 1, time: '06:30', title: `Bắt đầu trekking ${trail.name}`, description: `Giữ nhịp thở 2:2, uống từng ngụm nước nhỏ mỗi 15–20 phút. Cự ly tổng ${trail.distanceKm} km, độ dốc +${trail.elevationGainM}m.`, locationNote: 'Chặng leo chính' },
        { day: 1, time: '10:30', title: `Chạm đích / Đỉnh ${trail.maxAltitudeM}m`, description: 'Nghỉ ngơi, nạp năng lượng nhanh, bù điện giải Oresol và check-in tọa độ đỉnh trên LOST.', locationNote: `Đỉnh ${trail.name}` },
        { day: 1, time: '12:30', title: 'Thu gom rác (LNT) & Hạ sơn', description: 'Kéo dài gậy trekking 5–10cm bảo vệ khớp gối, giữ cự ly nhóm an toàn.', locationNote: 'Đường xuống núi' },
        { day: 1, time: '16:00', title: 'Về chân núi & Kết thúc hành trình', description: 'Báo bình an cho người thân, giãn cơ hồi phục.', locationNote: 'Chân núi' },
      ]
    : [
        { day: 1, time: '07:30', title: 'Khai báo & Gặp Porter tại điểm xuất phát', description: `Kiểm tra CCCD gốc, chia đồ chung cho Porter (${trail.permitRequired ? trail.permitInfo || 'Thủ tục BQL VQG / Kiểm lâm' : 'Khai báo địa phương'}).`, locationNote: `${trail.district ? trail.district + ', ' : ''}${trail.province}` },
        { day: 1, time: '08:30', title: 'Bắt đầu chặng 1 lên điểm nghỉ đêm', description: `Duy trì nhịp bước ổn định (Rest Step), ăn trưa nhẹ giữa chặng khoảng 11:30.`, locationNote: 'Tuyến lên lán / bãi trại' },
        { day: 1, time: '16:30', title: trail.hasCampsite ? 'Hạ trại / Nhận lán nghỉ đêm' : 'Nghỉ đêm tại lán bản địa', description: 'Thay đồ khô ngay để tránh nhiễm lạnh, ăn tối nóng và ngủ sớm trước 21:00.', locationNote: trail.hasCampsite ? 'Bãi hạ trại / Lán nghỉ' : 'Lán nghỉ' },
        { day: 2, time: '04:30', title: 'Thức dậy, ăn sáng nóng & Đẩy đỉnh săn mây', description: 'Mang đèn pin đội đầu, áo gió chắn lạnh và 1L nước ấm.', locationNote: 'Chặng đẩy đỉnh' },
        { day: 2, time: '06:00', title: `Chạm đỉnh ${trail.name} (${trail.maxAltitudeM}m)`, description: 'Đón bình minh, săn biển mây và check-in hộ chiếu đỉnh trên LOST.', locationNote: `Đỉnh ${trail.name}` },
        { day: 2, time: '08:30', title: 'Rút về lán, dọn sạch rác (LNT) & Hạ sơn', description: 'Thu gọn đồ đạc, kiểm đủ quân số và bắt đầu đổ dốc về chân núi.', locationNote: 'Đường hạ sơn' },
        { day: 2, time: '15:00', title: 'Về điểm xuất phát an toàn', description: 'Tắt hẹn giờ báo bình an, kiểm tra sức khỏe đoàn và nghỉ ngơi.', locationNote: 'Chân núi' },
      ];

  return {
    trailId: trail.id,
    trailName: trail.name,
    durationLabel: trail.durationHoursNote || `${trail.durationDays} ngày`,
    steps,
  };
}

/**
 * Scores and ranks Vietnam trails against user intent, region, GPS proximity, and current month.
 */
function scoreAndRankTrails(
  normalizedQ: string,
  trails: Trail[],
  userCoords?: { lat: number; lng: number },
  preferredRegion?: string
): RankedTrailCardItem[] {
  const currentMonth = Number(getVietnamTodayIso().slice(5, 7)) || new Date().getMonth() + 1;

  const wantCloud = ['san may', 'bien may', 'may nhieu', 'chill', 'mat me'].some((p) => hasWholePhrase(normalizedQ, p));
  const wantStream = ['suoi', 'thac', 'loi nuoc', 'tam suoi', 'bang suoi'].some((p) => hasWholePhrase(normalizedQ, p));
  const wantBeginner = ['nguoi moi', 'moi bat dau', 'newbie', 'nhe nhang', 'de di', 'lan dau', 'tre em', 'gia dinh'].some((p) => hasWholePhrase(normalizedQ, p));
  const wantHardcore = ['kho', 'thu thach', 'hardcore', '3000m', 'tren 3000', '3 ngay', 'chuyen nghiep'].some((p) => hasWholePhrase(normalizedQ, p));
  const wantFlower = ['hoa', 'chi pau', 'do quyen'].some((p) => hasWholePhrase(normalizedQ, p));
  const wantOneDay = ['1 ngay', 'trong ngay', 'cuoi tuan'].some((p) => hasWholePhrase(normalizedQ, p));
  const wantNearMe = ['gan toi', 'gan day', 'quanh day'].some((p) => hasWholePhrase(normalizedQ, p));

  const explicitNorth = ['mien bac', 'ha noi', 'tay bac', 'lao cai', 'sa pa', 'lai chau', 'son la', 'yen bai'].some((p) => hasWholePhrase(normalizedQ, p));
  const explicitCentral = ['mien trung', 'da nang', 'hue', 'quang nam', 'bach ma', 'gieng troi'].some((p) => hasWholePhrase(normalizedQ, p));
  const explicitTayNguyen = ['tay nguyen', 'lam dong', 'da lat', 'dak lak', 'gia lai'].some((p) => hasWholePhrase(normalizedQ, p));
  const explicitSouth = ['mien nam', 'sai gon', 'tp hcm', 'hcm', 'dong nai', 'tay ninh', 'vung tau', 'binh thuan'].some((p) => hasWholePhrase(normalizedQ, p));

  const scored: RankedTrailCardItem[] = trails.map((t) => {
    let score = 52;
    const reasons: string[] = [];
    const nameNorm = normalizeSearchText(`${t.name} ${t.province} ${t.district} ${t.description}`);
    const distFromUser = userCoords
      ? calculateDistanceKm(userCoords.lat, userCoords.lng, t.startLat, t.startLng)
      : undefined;

    // Seasonality check
    let seasonStatus: RankedTrailCardItem['seasonStatus'] = 'ok';
    if (t.bestMonths?.includes(currentMonth)) {
      seasonStatus = 'ideal';
      score += 12;
      reasons.push(`Đang vào mùa đẹp (Tháng ${currentMonth})`);
    } else if (t.avoidMonths?.includes(currentMonth)) {
      seasonStatus = 'avoid';
      score -= 14;
    }

    // Region & GPS intent scoring
    if (explicitNorth && t.region === 'Miền Bắc') {
      score += 22;
      reasons.push('Thuộc khu vực Miền Bắc');
    } else if (explicitCentral && (t.region === 'Miền Trung' || t.province.includes('Đà Nẵng') || t.province.includes('Huế'))) {
      score += 26;
      reasons.push('Thuộc khu vực Miền Trung');
    } else if (explicitTayNguyen && ['Lâm Đồng', 'Đắk Lắk', 'Gia Lai'].some((p) => t.province.includes(p))) {
      score += 24;
      reasons.push('Thuộc Tây Nguyên');
    } else if (explicitSouth && t.region === 'Miền Nam') {
      score += 24;
      reasons.push('Gần TP.HCM & Miền Nam');
    } else if (wantNearMe && distFromUser !== undefined) {
      if (distFromUser <= 80) {
        score += 32;
        reasons.push(`Cách bạn chỉ ~${distFromUser} km`);
      } else if (distFromUser <= 200) {
        score += 18;
        reasons.push(`Cách bạn ~${distFromUser} km`);
      } else {
        score -= 10;
      }
    } else if (preferredRegion && preferredRegion !== 'auto' && !explicitNorth && !explicitCentral && !explicitTayNguyen && !explicitSouth) {
      if (preferredRegion === 'north' && t.region === 'Miền Bắc') score += 8;
      if (preferredRegion === 'central' && (t.region === 'Miền Trung' || t.province.includes('Đà Nẵng') || t.province.includes('Huế'))) score += 10;
      if (preferredRegion === 'taynguyen' && ['Lâm Đồng', 'Đắk Lắk', 'Gia Lai'].some((p) => t.province.includes(p))) score += 10;
      if (preferredRegion === 'south' && t.region === 'Miền Nam') score += 8;
    }

    // Objective scoring
    if (wantCloud) {
      if (['trail-laothan', 'trail-taxua', 'trail-kyquansan', 'trail-fansipan', 'trail-tachinhu'].includes(t.id)) {
        score += 24;
        reasons.push('Tọa độ săn biển mây hàng đầu');
      } else if (t.maxAltitudeM >= 2200) {
        score += 12;
      }
    }
    if (wantStream) {
      if (['trail-giengtroi', 'trail-bachma', 'trail-thack50', 'trail-nuidinh', 'trail-nhiucosan'].includes(t.id)) {
        score += 26;
        reasons.push('Có suối thác tự nhiên đặc trưng');
      } else if (t.hasWaterSource) {
        score += 8;
      }
    }
    if (wantBeginner) {
      if (t.difficultyLevel <= 2) {
        score += 22;
        reasons.push('Độ khó nhẹ, lý tưởng cho người mới');
      } else if (t.difficultyLevel === 3) {
        score += 12;
        reasons.push('Độ khó vừa phải (3/5)');
      } else {
        score -= 18;
      }
    }
    if (wantHardcore) {
      if (t.difficultyLevel >= 4 || t.maxAltitudeM >= 2950) {
        score += 24;
        reasons.push(`Thử thách đỉnh cao ${t.maxAltitudeM}m`);
      } else {
        score -= 14;
      }
    }
    if (wantFlower) {
      if (['trail-tachinhu', 'trail-putaleng', 'trail-fansipan', 'trail-bachma'].includes(t.id)) {
        score += 24;
        reasons.push('Nổi tiếng mùa hoa rừng (Chi Pâu / Đỗ Quyên)');
      }
    }
    if (wantOneDay && t.durationDays <= 1) {
      score += 16;
      reasons.push('Đi về gọn trong ngày');
    }

    // Direct name/province boost
    if (nameNorm && normalizedQ.split(' ').some((w) => w.length >= 4 && hasWholePhrase(nameNorm, w))) {
      score += 6;
    }

    if (reasons.length === 0) {
      reasons.push(`${t.maxAltitudeM}m • ${t.distanceKm} km • Cấp ${t.difficultyLevel}/5`);
    }

    return {
      id: t.id,
      name: t.name,
      province: t.province,
      district: t.district,
      region: t.region,
      distanceKm: t.distanceKm,
      elevationGainM: t.elevationGainM,
      maxAltitudeM: t.maxAltitudeM,
      difficultyLevel: t.difficultyLevel,
      difficultyNote: t.difficultyNote,
      durationDays: t.durationDays,
      durationHoursNote: t.durationHoursNote,
      coverImage: t.coverImage,
      bestMonths: t.bestMonths,
      matchScore: Math.max(35, Math.min(99, Math.round(score))),
      matchReasons: reasons.slice(0, 3),
      seasonStatus,
      distanceFromUserKm: distFromUser,
    };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore || (a.distanceFromUserKm ?? 9999) - (b.distanceFromUserKm ?? 9999));
  return scored.slice(0, 3);
}

/**
 * Parses numeric bio-calc parameters if user mentions them in Vietnamese text (e.g. "65kg", "balo 9kg", "18km", "1200m").
 */
function extractBioParamsFromQuery(normalizedQ: string, trail?: Trail) {
  const packMatch = normalizedQ.match(/(?:balo|ba lo|tui|vac)\s*(?:toi\s*|minh\s*)?(?:nang\s*)?(\d{1,2}(?:[.,]\d)?)\s*kg/);
  // Strip pack clause before parsing bodyWeightKg so "balo toi nang 10kg" never poisons bodyWeightKg
  const withoutPack = packMatch ? normalizedQ.replace(packMatch[0], ' ') : normalizedQ;
  const weightMatch = withoutPack.match(/(?:can nang|nang|toi|minh)\s*(\d{2,3})\s*kg/);
  const parsedBodyKg = weightMatch ? Number(weightMatch[1]) : NaN;
  const distMatch = normalizedQ.match(/(\d{1,3}(?:[.,]\d)?)\s*km/);
  const gainMatch = normalizedQ.match(/(?:doc|chenh cao|gain)\s*\+?(\d{3,4})\s*m/);

  let fitnessLevel: AiFitnessLevel = 'intermediate';
  if (hasWholePhrase(normalizedQ, 'nguoi moi') || hasWholePhrase(normalizedQ, 'moi tap') || hasWholePhrase(normalizedQ, 'beginner')) {
    fitnessLevel = 'beginner';
  } else if (hasWholePhrase(normalizedQ, 'chuyen nghiep') || hasWholePhrase(normalizedQ, 'the luc tot') || hasWholePhrase(normalizedQ, 'advanced')) {
    fitnessLevel = 'advanced';
  }

  return {
    trailId: trail?.id,
    trailName: trail?.name,
    distanceKm: distMatch ? Number(distMatch[1].replace(',', '.')) : trail?.distanceKm ?? 14,
    elevationGainM: gainMatch ? Number(gainMatch[1]) : trail?.elevationGainM ?? 900,
    maxAltitudeM: trail?.maxAltitudeM ?? 2000,
    durationDays: trail?.durationDays ?? 2,
    bodyWeightKg: Number.isFinite(parsedBodyKg) && parsedBodyKg >= 30 && parsedBodyKg <= 160 ? parsedBodyKg : 62,
    packWeightKg: packMatch ? Number(packMatch[1].replace(',', '.')) : trail && trail.durationDays >= 2 ? 9 : 5,
    fitnessLevel,
  };
}

/**
 * Search Master Knowledge from MongoDB + In-memory upgraded Vietnamese engine (merges & deduplicates both).
 * Increments viewCount asynchronously on DB hits.
 */
async function searchKnowledgeGroundings(userQuery: string, limit = 3): Promise<Array<{ id?: string; question: string; answer: string; trailId?: string; trailName?: string }>> {
  const localHits = queryKnowledgeDataset(userQuery, limit);
  const merged: Array<{ id?: string; question: string; answer: string; trailId?: string; trailName?: string }> = localHits.map((r) => ({
    id: r.id,
    question: r.question,
    answer: r.answer,
    trailId: r.trailId,
    trailName: r.trailName,
  }));
  const seenKeys = new Set(merged.map((m) => m.id || normalizeSearchText(m.question)));

  if (mongoose.connection.readyState === 1) {
    try {
      const cleanQ = normalizeSearchText(userQuery);
      if (cleanQ.length >= 3) {
        const dbHits = await AiKnowledgeModel.find(
          { $text: { $search: `${removeEmojis(userQuery)} ${cleanQ}` }, isActive: true },
          { score: { $meta: 'textScore' } }
        )
          .sort({ score: { $meta: 'textScore' } })
          .limit(limit)
          .lean()
          .maxTimeMS(600);

        if (dbHits && dbHits.length > 0) {
          const hitIds = dbHits.map((d: any) => d._id).filter(Boolean);
          if (hitIds.length > 0) {
            AiKnowledgeModel.updateMany({ _id: { $in: hitIds } }, { $inc: { viewCount: 1 } }).catch(() => {});
          }
          for (const r of dbHits as any[]) {
            const key = r.key || normalizeSearchText(String(r.question || ''));
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);
            merged.push({
              id: r.key || String(r._id),
              question: r.question,
              answer: r.answer,
              trailId: r.trailId,
              trailName: r.trailName,
            });
          }
        }
      }
    } catch {
      // Fallback smoothly
    }
  }

  return merged.slice(0, limit);
}

interface ResolvedLiveContext {
  userName?: string;
  userProfileSummary?: string;
  userProfileApplied: boolean;
  activeTrail?: Trail;
  mentionedTrail?: Trail;
  targetTrail?: Trail;
  goNoGo?: GoNoGoAssessmentPayload | null;
  nationwideCriticalIncidents: Array<{ trailName: string; type: string; severity: string; description: string }>;
  pageView?: string;
  userCoordinates?: { lat: number; lng: number };
  preferredRegion?: string;
}

/**
 * Authoritatively resolves user profile, active/mentioned trail, live weather/Go-No-Go, and active incidents on server.
 * Zero trust in untrusted raw client prompt strings (prevents prompt injection).
 */
async function resolveAuthoritativeContext(
  payload: ChatRequestPayload,
  normalizedQ: string,
  trails: Trail[]
): Promise<ResolvedLiveContext> {
  const ctxInput = payload.context || {};
  const userCoordinates = ctxInput.userCoordinates || payload.userCoordinates;
  const preferredRegion = ctxInput.preferredRegion;
  const pageView = typeof ctxInput.pageView === 'string' ? ctxInput.pageView.slice(0, 32) : undefined;

  // 1. Resolve Active Trail (from trailId) and Mentioned Trail (from user's message)
  const rawTrailId = ctxInput.trailId || payload.currentTrailContext?.trailId;
  const activeTrail = rawTrailId
    ? trails.find((t) => t.id === rawTrailId || String((t as any)._id || '') === rawTrailId)
    : undefined;
  const mentionedTrail = findMentionedTrail(normalizedQ, trails);
  const targetTrail = mentionedTrail || activeTrail;

  // 2. Parallel DB lookups (User Profile + Go/No-Go + Active Critical Incidents) bounded by 1.8s
  let userName: string | undefined;
  let userProfileSummary: string | undefined;
  let userProfileApplied = false;
  let goNoGo: GoNoGoAssessmentPayload | null = null;
  let nationwideCriticalIncidents: ResolvedLiveContext['nationwideCriticalIncidents'] = [];

  const tasks: Promise<void>[] = [];

  if (payload.authenticatedUserId && mongoose.connection.readyState === 1 && Types.ObjectId.isValid(payload.authenticatedUserId)) {
    tasks.push(
      UserModel.findById(payload.authenticatedUserId)
        .select('fullName role reputationScore badges preferredStyle gearLocker checkedInTrails')
        .populate('checkedInTrails', 'name maxAltitudeM')
        .lean()
        .maxTimeMS(900)
        .then((u: any) => {
          if (!u) return;
          userName = sanitizePromptContextText(String(u.fullName || '').replace(/\s*\(.*?\)/, ''), 48);
          const peaks = Array.isArray(u.checkedInTrails)
            ? u.checkedInTrails
                .map((p: any) => sanitizePromptContextText(p?.name, 50))
                .filter(Boolean)
                .slice(0, 6)
            : [];
          const gear = Array.isArray(u.gearLocker)
            ? u.gearLocker.map((g: unknown) => sanitizePromptContextText(g, 40)).filter(Boolean).slice(0, 10)
            : [];
          const safeStyle = sanitizePromptContextText(u.preferredStyle, 48);
          const safeRole = sanitizePromptContextText(u.role || 'user', 20);
          userProfileSummary = [
            `Tên: ${userName}`,
            `Vai trò: ${safeRole} | Uy tín: ${Number(u.reputationScore) || 50}`,
            safeStyle ? `Phong cách: ${safeStyle}` : '',
            peaks.length > 0 ? `Đỉnh đã check-in: ${peaks.join(', ')}` : 'Chưa check-in đỉnh nào (ưu tiên tư vấn rõ ràng an toàn)',
            gear.length > 0 ? `Đồ sẵn có trong tủ: ${gear.join(', ')}` : '',
          ]
            .filter(Boolean)
            .join('\n');
          userProfileApplied = true;
        })
        .catch(() => {})
    );
  } else if (payload.userName && typeof payload.userName === 'string') {
    // Strictly sanitize guest name to prevent prompt injection
    const safeGuestName = payload.userName
      .replace(/\s*\(.*?\)/, '')
      .replace(/[^\p{L}\p{N}\s.-]/gu, '')
      .trim()
      .slice(0, 40);
    if (safeGuestName) userName = safeGuestName;
  }

  if (targetTrail) {
    tasks.push(
      (async () => {
        let timerId: ReturnType<typeof setTimeout> | undefined;
        try {
          const res = await Promise.race([
            computeTrailGoNoGo(targetTrail.id),
            new Promise<null>((resolve) => {
              timerId = setTimeout(() => resolve(null), 1800);
            }),
          ]);
          goNoGo = res;
        } catch {
          // ignore
        } finally {
          if (timerId) clearTimeout(timerId);
        }
      })()
    );
  }

  if (mongoose.connection.readyState === 1) {
    tasks.push(
      IncidentModel.find({ active: { $ne: false }, resolved: { $ne: true }, severity: { $in: ['critical', 'high'] } })
        .select('trailName type severity description')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .maxTimeMS(800)
        .then((incs: any[]) => {
          nationwideCriticalIncidents = incs.map((i) => ({
            trailName: sanitizePromptContextText(i.trailName, 90),
            type: sanitizePromptContextText(i.type, 40),
            severity: sanitizePromptContextText(i.severity || 'high', 20),
            description: sanitizePromptContextText(i.description, 140),
          }));
        })
        .catch(() => {})
    );
  }

  await Promise.all(tasks);

  return {
    userName,
    userProfileSummary,
    userProfileApplied,
    activeTrail,
    mentionedTrail,
    targetTrail,
    goNoGo,
    nationwideCriticalIncidents,
    pageView,
    userCoordinates,
    preferredRegion,
  };
}

/**
 * Deterministic Alpine Knowledge & Action-Card Engine (0ms, Offline-Ready, Priority-Ordered).
 */
function runDeterministicPipeline(
  rawQuery: string,
  normalizedQ: string,
  trails: Trail[],
  liveCtx: ResolvedLiveContext,
  matchedFaqs: Array<{ id?: string; question: string; answer: string; trailId?: string; trailName?: string }>
): { reply: string; actions: RichAiAssistantAction[]; priorityMatched: string } {
  const actions: RichAiAssistantAction[] = [];
  const displayName = liveCtx.userName || '';
  const targetTrail = liveCtx.targetTrail;

  // =========================================================================
  // PRIORITY 0: EMERGENCY SOS & WILDERNESS FIRST AID TRIAGE (NEVER HIJACKED!)
  // =========================================================================
  const triageHit = detectEmergencyTriage(normalizedQ, targetTrail);
  if (triageHit) {
    actions.push({
      type: 'first_aid_triage',
      triageData: triageHit.triage,
    });
    actions.push({
      type: 'quick_reply',
      suggestions: triageHit.suggestions,
    });
    return { reply: removeEmojis(triageHit.reply), actions, priorityMatched: 'P0_EMERGENCY' };
  }

  // =========================================================================
  // PRIORITY 1A: LIVE GO/NO-GO & WEATHER SAFETY CHECK
  // =========================================================================
  const wantsGoNoGo = [
    'go no go', 'go/no-go', 'di duoc khong', 'leo duoc khong', 'an toan khong', 'co nen di',
    'danh gia an toan', 'thoi tiet hom nay', 'du bao thoi tiet', 'canh bao sat lo', 'tinh trang duong',
  ].some((p) => hasWholePhrase(normalizedQ, p));

  if (wantsGoNoGo && targetTrail && liveCtx.goNoGo) {
    const g = liveCtx.goNoGo;
    actions.push({ type: 'go_no_go_card', trailId: targetTrail.id, trailName: targetTrail.name, goNoGoData: g });
    actions.push({
      type: 'quick_reply',
      suggestions: [
        `Checklist đồ bổ sung cho ${targetTrail.name}`,
        `Lịch trình chi tiết ${targetTrail.name}`,
        `Tính thời gian & lượng nước leo ${targetTrail.name}`,
      ],
    });
    const weatherText = g.weatherSummary
      ? `Nhiệt độ đỉnh ước tính **${g.weatherSummary.summitTempMinC ?? g.weatherSummary.tempMinC}°C – ${g.weatherSummary.summitTempMaxC ?? g.weatherSummary.tempMaxC}°C**, mưa **${g.weatherSummary.precipMm} mm**, gió **${g.weatherSummary.windSpeedKmH} km/h**.`
      : 'Chưa lấy được dự báo trực tuyến — đánh giá dựa trên mùa vụ và sự cố thực địa.';

    const reply = `**ĐÁNH GIÁ AN TOÀN XUẤT PHÁT (GO / NO-GO) — ${targetTrail.name.toUpperCase()}**\n\n- **Kết luận**: **${g.verdictLabel}** (**${g.score}/100 điểm** — ngày ${g.departureDate}).\n- **Thời tiết đỉnh**: ${weatherText}\n- **Sự cố đang mở**: **${g.activeIncidentsCount}** cảnh báo.\n\n${g.advice}`;
    return { reply: removeEmojis(reply), actions, priorityMatched: 'P1_GONOGO' };
  }

  // =========================================================================
  // PRIORITY 1B: ALPINE BIO-CALCULATOR (Naismith/Tobler + Water + Calories + Pack)
  // =========================================================================
  const wantsBioCalc = [
    'naismith', 'tobler', 'mat bao lau', 'di bao lau', 'leo bao lau', 'bao nhieu tieng',
    'bao nhieu lit nuoc', 'can bao nhieu nuoc', 'tinh luong nuoc', 'tinh calo', 'tieu hao calo',
    'tinh thoi gian', 'tinh tai trong', 'balo bao nhieu kg', 'balo nang', 'bio calc',
  ].some((p) => hasWholePhrase(normalizedQ, p));

  if (wantsBioCalc) {
    const bioInputs = extractBioParamsFromQuery(normalizedQ, targetTrail);
    const bioResult = calculateAlpineBioMetrics(bioInputs);
    actions.push({ type: 'bio_calculator', trailId: targetTrail?.id, trailName: targetTrail?.name, bioCalcData: bioResult });
    actions.push({
      type: 'quick_reply',
      suggestions: [
        targetTrail ? `Checklist đồ dùng cho ${targetTrail.name}` : 'Checklist đồ leo núi 2N1Đ',
        'Kỹ thuật lọc nước suối trong rừng',
        'Kế hoạch tập thể lực 4 tuần',
      ],
    });
    const titleLabel = bioResult.inputs.trailName ? `CHO ${bioResult.inputs.trailName.toUpperCase()}` : `(${bioResult.inputs.distanceKm} KM / +${bioResult.inputs.elevationGainM}M)`;
    const reply = `**PHÂN TÍCH SINH HỌC & THỜI GIAN DI CHUYỂN ${titleLabel}:**\n\n- **Thời gian di chuyển dự kiến**: **${bioResult.recommendedMovingHours} giờ** (Naismith **${bioResult.naismithHours}h** | Tobler **${bioResult.toblerHours}h**; tổng gồm nghỉ ~**${bioResult.estimatedTotalTripHours} giờ**).\n- **Nước & Điện giải**: **${bioResult.waterLitersTotal} lít** (~${bioResult.waterLitersPerDay}L/ngày) + **${bioResult.oresolPackets} gói Oresol**.\n- **Năng lượng tiêu hao**: **${bioResult.caloriesActiveKcal.toLocaleString()} kcal** vận động.\n- **Tỷ lệ balo**: **${bioResult.packRatioPercent}%** thể trọng — ${bioResult.packAdvice}\n\n*Bạn có thể kéo thanh trượt cân nặng, trọng lượng balo và trình độ thể lực trực tiếp ngay trong thẻ tính toán bên dưới!*`;
    return { reply: removeEmojis(reply), actions, priorityMatched: 'P1_BIOCALC' };
  }

  // =========================================================================
  // PRIORITY 1C: STRUCTURED TRAIL ITINERARY (1-Click Apply)
  // =========================================================================
  const wantsItinerary = ['lich trinh', 'timeline', 'ke hoach di', 'ke hoach leo', 'lich trinh chi tiet'].some((p) =>
    hasWholePhrase(normalizedQ, p)
  );
  if (wantsItinerary && targetTrail) {
    const itineraryData = buildTrailItineraryCard(targetTrail);
    actions.push({
      type: 'itinerary_card',
      trailId: targetTrail.id,
      trailName: targetTrail.name,
      itineraryData,
    });
    actions.push({
      type: 'quick_reply',
      suggestions: [
        `Đánh giá Go/No-Go cho ${targetTrail.name}`,
        `Checklist trang bị cho ${targetTrail.name}`,
        `Tính thời gian & nước uống ${targetTrail.name}`,
      ],
    });
    const reply = `**LỊCH TRÌNH ĐỀ XUẤT — ${targetTrail.name.toUpperCase()} (${itineraryData.durationLabel}):**\n\n- **Cao độ đỉnh**: **${targetTrail.maxAltitudeM.toLocaleString()}m** | Cự ly **${targetTrail.distanceKm} km** (+${targetTrail.elevationGainM}m).\n- **Mùa lý tưởng**: Tháng **${targetTrail.bestMonths?.join(', ') || '10 – 4'}**.\n- **Thủ tục**: ${targetTrail.permitRequired ? targetTrail.permitInfo || 'Cần khai báo Trạm Kiểm lâm / BQL VQG' : 'Khai báo địa phương & mang CCCD gốc'}.\n\n*Bấm nút "Áp dụng vào Lịch trình cung đường" ngay bên dưới để đồng bộ toàn bộ các chặng vào kế hoạch của bạn!*`;
    return { reply: removeEmojis(reply), actions, priorityMatched: 'P1_ITINERARY' };
  }

  // =========================================================================
  // PRIORITY 1D: STRUCTURED GEAR CHECKLIST (Whole-word — ZERO "bản đồ" bug!)
  // =========================================================================
  const wantsGear = [
    'checklist', 'trang bi', 'chuan bi do', 'mang theo gi', 'mang gi', 'xep balo', 'sap xep balo',
    'do leo nui', 'do trekking', 'quy tac 3 lop', 'balo 2n1d', 'hanh trang',
  ].some((p) => hasWholePhrase(normalizedQ, p));

  if (wantsGear) {
    const checklistItems = buildStructuredGearChecklist(targetTrail, liveCtx.goNoGo);
    actions.push({
      type: 'gear_checklist',
      trailId: targetTrail?.id,
      trailName: targetTrail?.name,
      checklistItems,
    });
    actions.push({
      type: 'quick_reply',
      suggestions: [
        'Tính tải trọng balo & lượng nước theo cân nặng',
        'Tiêu chuẩn chọn giày trekking chống trượt',
        'Cách xếp balo 3 tầng chống đau vai',
      ],
    });
    const heading = targetTrail
      ? `**CHECKLIST TRANG BỊ TỐI ƯU CHO ${targetTrail.name.toUpperCase()} (${targetTrail.maxAltitudeM}m):**`
      : `**CHECKLIST TRANG BỊ LEO NÚI CHUẨN THỰC ĐỊA VIỆT NAM:**`;
    const reply = `${heading}\n\n- **Quy tắc tải trọng**: Tổng balo không vượt quá **18% – 20% thể trọng**.\n- **Xếp balo 3 tầng**: Đáy (túi ngủ/đồ nhẹ) -> Giữa sát lưng (nước/thức ăn nặng) -> Đỉnh (áo mưa/đèn pin/y tế).\n\n*Tích chọn các món đã chuẩn bị hoặc bấm "Áp dụng vào Checklist cung đường" bên dưới!*`;
    return { reply: removeEmojis(reply), actions, priorityMatched: 'P1_GEAR' };
  }

  // =========================================================================
  // PRIORITY 2: RANKED TRAIL DISCOVERY & RECOMMENDATIONS
  // =========================================================================
  const wantsDiscovery = [
    'goi y cung', 'tim cung', 'cung nao dep', 'nen leo nui nao', 'nen di dau', 'di dau',
    'cung san may', 'cho nguoi moi', 'di suoi gan toi', 'suoi gan toi', 'suoi gan day',
    'thac gan toi', 'gan toi', 'mien nam', 'mien trung', 'mien bac', 'tay nguyen',
    'di chill', 'cung kho', 'thu thach', 'cuoi tuan',
  ].some((p) => hasWholePhrase(normalizedQ, p));

  if (wantsDiscovery) {
    const ranked = scoreAndRankTrails(normalizedQ, trails, liveCtx.userCoordinates, liveCtx.preferredRegion);
    actions.push({ type: 'ranked_trails', rankedTrails: ranked });

    const isStreamQuery = hasWholePhrase(normalizedQ, 'suoi') || hasWholePhrase(normalizedQ, 'thac');
    actions.push({
      type: 'quick_reply',
      suggestions: isStreamQuery
        ? [
            'Quy tắc an toàn thoát hiểm lũ quét',
            'Checklist đồ lội suối & chống vắt',
            ranked[0] ? `Đánh giá Go/No-Go ${ranked[0].name}` : 'Kỹ thuật lọc nước suối',
          ]
        : [
            ranked[0] ? `Lịch trình chi tiết ${ranked[0].name}` : 'Lịch trình Lảo Thẩn 2N1Đ',
            ranked[0] ? `Đánh giá Go/No-Go ${ranked[0].name}` : 'Công thức xem thời tiết săn mây',
            'Kế hoạch tập thể lực 4 tuần',
          ],
    });

    const safetyFooter = isStreamQuery
      ? '\n\n**3 Quy tắc sống còn khi đi suối**: Dựng lều cách mép suối **>= 50m** và cao hơn mặt nước **>= 3m**; cởi chốt đai ngực/đai hông balo khi lội; chạy ngay lên đồi cao nếu nước chuyển đục ngầu cuốn lá khô!'
      : '\n\n*Nhấn vào từng thẻ cung đường bên dưới để xem bản đồ 3D DEM, tải Gói Offline và đánh giá Go/No-Go trực tiếp!*';

    const reply = `**TOP ${ranked.length} CUNG ĐƯỜNG ĐƯỢC XẾP HẠNG PHÙ HỢP NHẤT CHO BẠN:**\n\n${ranked
      .map(
        (r, i) =>
          `**${i + 1}. ${r.name}** — Phù hợp **${r.matchScore}%**\n- ${r.province} (${r.region}) | Đỉnh **${r.maxAltitudeM.toLocaleString()}m** | **${r.distanceKm} km** (+${r.elevationGainM}m)\n- Lý do: ${r.matchReasons.join(' · ')}`
      )
      .join('\n\n')}${safetyFooter}`;
    return { reply: removeEmojis(reply), actions, priorityMatched: 'P2_DISCOVERY' };
  }

  // =========================================================================
  // PRIORITY 3: MASTER KNOWLEDGE BASE MATCHING (Upgraded High-Precision Scorer)
  // =========================================================================
  if (matchedFaqs.length > 0) {
    const primary = matchedFaqs[0];
    let reply = primary.answer;
    if (matchedFaqs.length > 1 && matchedFaqs[1].question !== primary.question) {
      reply += `\n\n---\n**THÔNG TIN LIÊN QUAN:**\n\n${matchedFaqs[1].answer}`;
    }

    const linkedTrail =
      (primary.trailId ? trails.find((t) => t.id === primary.trailId) : undefined) || targetTrail;

    if (linkedTrail) {
      actions.push({
        type: 'trail_card',
        trailId: linkedTrail.id,
        trailName: linkedTrail.name,
        trailData: {
          id: linkedTrail.id,
          name: linkedTrail.name,
          province: linkedTrail.province,
          region: linkedTrail.region,
          distanceKm: linkedTrail.distanceKm,
          elevationGainM: linkedTrail.elevationGainM,
          maxAltitudeM: linkedTrail.maxAltitudeM,
          difficultyLevel: linkedTrail.difficultyLevel,
          difficultyNote: linkedTrail.difficultyNote,
          durationHoursNote: linkedTrail.durationHoursNote,
          coverImage: linkedTrail.coverImage,
        },
      });
    }

    actions.push({
      type: 'quick_reply',
      suggestions: linkedTrail
        ? [
            `Đánh giá Go/No-Go ${linkedTrail.name}`,
            `Lịch trình chi tiết ${linkedTrail.name}`,
            `Tính thời gian & nước leo ${linkedTrail.name}`,
          ]
        : [
            'Gợi ý cung săn mây cho người mới',
            'Checklist đồ leo núi 2N1Đ',
            'Công thức xem thời tiết săn mây',
          ],
    });

    return { reply: removeEmojis(reply), actions, priorityMatched: 'P3_KNOWLEDGE' };
  }

  // =========================================================================
  // PRIORITY 3.5: GENERAL COST / FITNESS / NUTRITION (Whole-word safe)
  // =========================================================================
  if (['the luc', 'tap luyen', 'chay bo', 'chuot rut', 'giao an'].some((p) => hasWholePhrase(normalizedQ, p))) {
    actions.push({
      type: 'quick_reply',
      suggestions: ['Checklist trang bị 2N1Đ', 'Tính thời gian & calo theo thể lực', 'Bảo vệ khớp gối khi xuống dốc'],
    });
    return {
      reply: `**LỘ TRÌNH RÈN THỂ LỰC 4 TUẦN TRƯỚC KHI LEO NÚI:**\n\n- **Tuần 1–2**: Chạy bộ 3–5km (3 buổi/tuần) + leo bộ 15–20 tầng cầu thang/ngày (đi thang máy xuống bảo vệ gối).\n- **Tuần 3**: Đeo balo **4–6kg** leo 25 tầng + Squats (3x15), Lunges (3x12/chân), Plank (3x60s).\n- **Tuần 4 (Tapering)**: Giảm tải 4 ngày trước khi đi, ngủ đủ 8 tiếng, bổ sung Magie/chuối chống chuột rút.`,
      actions,
      priorityMatched: 'P3_FITNESS',
    };
  }

  if (['chi phi', 'ngan sach', 'bao nhieu tien', 'gia thue', 'porter'].some((p) => hasWholePhrase(normalizedQ, p))) {
    actions.push({
      type: 'quick_reply',
      suggestions: ['Cách thuê Porter & đầu mối VQG chính thống', 'Checklist đồ leo núi 2N1Đ', 'Gợi ý cung cho người mới'],
    });
    return {
      reply: `**DỰ TOÁN CHI PHÍ THỰC TẾ 1 CHUYẾN TREKKING 2N1Đ TẠI VIỆT NAM:**\n\n1. **Di chuyển khứ hồi** (xe khách giường nằm): **500.000 – 700.000 VNĐ**.\n2. **Thuê Porter / Guide bản địa**: **500.000 – 800.000 VNĐ/ngày** (nhóm 3–4 người chia chung chỉ ~300k–400k/người).\n3. **Vé & Giấy phép VQG**: **150.000 – 250.000 VNĐ** (các cung tự do miễn phí hoặc gửi xe bản ~50k).\n4. **Lán ngủ / Hạ trại**: **100.000 – 150.000 VNĐ/đêm**.\n5. **Ăn uống & Hậu cần**: **400.000 – 600.000 VNĐ/người**.\n\n**Tổng dự kiến**: **1.800.000 – 2.800.000 VNĐ/người**.`,
      actions,
      priorityMatched: 'P3_BUDGET',
    };
  }

  // =========================================================================
  // PRIORITY 4: PURE GREETING & GRATITUDE (Only when no domain intent matched!)
  // =========================================================================
  const isGreeting =
    ['chao', 'hi', 'hello', 'xin chao', 'alo', 'hey', 'ban la ai', 'ban ten gi', 'ban giup duoc gi'].some((p) =>
      hasWholePhrase(normalizedQ, p)
    ) && normalizedQ.split(' ').length <= 8;

  if (isGreeting) {
    const greetingName = displayName ? `**${displayName}**` : 'bạn';
    const contextHint = targetTrail
      ? `\n\nEm thấy bạn đang quan tâm tới cung **${targetTrail.name} (${targetTrail.maxAltitudeM}m)** — bạn có thể hỏi ngay thời tiết Go/No-Go, lịch trình hoặc tải file GPX để em phân tích nhé!`
      : '';
    actions.push({
      type: 'quick_reply',
      suggestions: targetTrail
        ? [
            `Đánh giá Go/No-Go ${targetTrail.name}`,
            `Lịch trình chi tiết ${targetTrail.name}`,
            `Checklist trang bị cho ${targetTrail.name}`,
            `Tính thời gian & nước leo ${targetTrail.name}`,
          ]
        : [
            'Gợi ý cung săn mây cho người mới',
            'Đi suối thác gần tôi cuối tuần',
            'Tính thời gian & nước uống leo núi',
            'Cấp cứu khẩn cấp: Sốc độ cao & Lạc đường',
          ],
    });
    return {
      reply: `**Chào ${greetingName}!** Em là **LOST AI** — Trợ lý Thám hiểm & Sinh tồn Núi cao Việt Nam.\n\nEm có thể hỗ trợ bạn ngay lập tức:\n1. **Đánh giá Go / No-Go trực tuyến** theo thời tiết đỉnh, gió rét & sự cố sạt lở.\n2. **Xếp hạng cung đường** theo vùng miền, mùa đẹp, thể lực và vị trí GPS.\n3. **Tính toán Naismith / Tobler** thời gian leo, lượng nước, Oresol, calo & tải trọng balo.\n4. **Phân tích file GPX** trực tiếp (độ dốc, cao độ, cảnh báo địa hình).\n5. **Sơ cứu dã ngoại WFA & Hotline xác thực** 112 / 114 / 115 / VQG.${contextHint}`,
      actions,
      priorityMatched: 'P4_GREETING',
    };
  }

  const isGratitude =
    ['cam on', 'thank', 'thanks', 'tuyet voi', 'tam biet', 'bye'].some((p) => hasWholePhrase(normalizedQ, p)) &&
    normalizedQ.split(' ').length <= 7;

  if (isGratitude) {
    return {
      reply: `Không có gì ạ! Chúc ${displayName ? `**${displayName}**` : 'bạn'} luôn chân cứng đá mềm và có những hành trình an toàn trên núi rừng Việt Nam. Cần hỗ trợ cứ gọi **LOST AI** bất cứ lúc nào nhé!`,
      actions: [],
      priorityMatched: 'P4_GRATITUDE',
    };
  }

  // Fallback: Contextual trail overview or top ranked trails
  if (targetTrail) {
    actions.push({
      type: 'trail_card',
      trailId: targetTrail.id,
      trailName: targetTrail.name,
      trailData: {
        id: targetTrail.id,
        name: targetTrail.name,
        province: targetTrail.province,
        region: targetTrail.region,
        distanceKm: targetTrail.distanceKm,
        elevationGainM: targetTrail.elevationGainM,
        maxAltitudeM: targetTrail.maxAltitudeM,
        difficultyLevel: targetTrail.difficultyLevel,
        difficultyNote: targetTrail.difficultyNote,
        durationHoursNote: targetTrail.durationHoursNote,
        coverImage: targetTrail.coverImage,
      },
    });
    actions.push({
      type: 'quick_reply',
      suggestions: [
        `Đánh giá Go/No-Go ${targetTrail.name}`,
        `Lịch trình chi tiết ${targetTrail.name}`,
        `Checklist đồ cho ${targetTrail.name}`,
        `Tính thời gian & nước leo ${targetTrail.name}`,
      ],
    });
    return {
      reply: `**THÔNG TIN THỰC ĐỊA — ${targetTrail.name.toUpperCase()}:**\n\n- **Vị trí**: ${targetTrail.district ? targetTrail.district + ', ' : ''}${targetTrail.province} (${targetTrail.region})\n- **Thông số**: Đỉnh **${targetTrail.maxAltitudeM.toLocaleString()}m** | Cự ly **${targetTrail.distanceKm} km** (+${targetTrail.elevationGainM}m) | **${targetTrail.durationHoursNote}**\n- **Độ khó**: Cấp **${targetTrail.difficultyLevel}/5** (${targetTrail.difficultyNote || 'Tiêu chuẩn'})\n- **Mùa đẹp**: Tháng **${targetTrail.bestMonths?.join(', ') || '10 – 4'}**\n- **Cứu hộ**: **${targetTrail.rescueContact?.phone || '112 / 114'}**\n\n*Bạn muốn em kiểm tra thời tiết Go/No-Go, lập lịch trình hay tính lượng nước cho cung này?*`,
      actions,
      priorityMatched: 'P5_TRAIL_FALLBACK',
    };
  }

  const topRanked = scoreAndRankTrails(normalizedQ, trails, liveCtx.userCoordinates, liveCtx.preferredRegion);
  actions.push({ type: 'ranked_trails', rankedTrails: topRanked });
  actions.push({
    type: 'quick_reply',
    suggestions: [
      'Gợi ý cung săn mây cho người mới',
      'Tính thời gian & lượng nước leo núi',
      'Checklist đồ leo núi 2N1Đ',
      'Sơ cứu sốc độ cao & Lạc đường',
    ],
  });
  return {
    reply: `Em chưa nhận diện được từ khóa leo núi chuyên biệt trong câu hỏi vừa rồi, nhưng đây là **Top 3 cung đường thực địa nổi bật** trên LOST và các công cụ hỗ trợ nhanh bên dưới. Bạn có thể hỏi cụ thể hơn về tên đỉnh núi, thời tiết Go/No-Go, lịch trình, thể lực, sơ cứu hoặc đính kèm file **.gpx** nhé!`,
    actions,
    priorityMatched: 'P5_GENERAL_FALLBACK',
  };
}

/**
 * Main Orchestrator for LOST Alpine Intelligence Chat
 */
export async function getAiResponse(payload: ChatRequestPayload): Promise<ChatResponsePayload> {
  const { message, conversationHistory = [], engineMode = 'auto' } = payload;
  const normalizedQ = normalizeSearchText(message);
  const availableTrails = await getAllAvailableTrails();

  const [liveCtx, matchedFaqs] = await Promise.all([
    resolveAuthoritativeContext(payload, normalizedQ, availableTrails),
    searchKnowledgeGroundings(message, 3),
  ]);

  // Always compute deterministic domain cards & fallback (0ms) so even Gemini responses carry rich interactive cards + guaranteed WFA triage!
  let deterministic = runDeterministicPipeline(message, normalizedQ, availableTrails, liveCtx, matchedFaqs);

  // Wave 12A: Turnaround Time & NOAA Sunset Cutoff Pace Planner (never hijacks P0_EMERGENCY; preserves P1_GONOGO!)
  if (deterministic.priorityMatched !== 'P0_EMERGENCY') {
    const wantsPacePlan = [
      'gio quay dau',
      'ke hoach toc do',
      'may gio len dinh',
      'kip xuong truoc toi',
      'xuong truoc toi',
      'truoc hoang hon',
      'mat troi lan',
      'turnaround',
      'sunset cutoff',
      'pace voi balo',
      'tinh pace',
      'ke hoach pace',
      'lich toc do',
    ].some((p) => hasWholePhrase(normalizedQ, p));

    if (wantsPacePlan) {
      const hasExplicitTrail = Boolean(liveCtx.targetTrail);
      const wantsSouthRegion =
        hasWholePhrase(normalizedQ, 'mien nam') ||
        hasWholePhrase(normalizedQ, 'dong nam bo') ||
        hasWholePhrase(normalizedQ, 'sai gon') ||
        hasWholePhrase(normalizedQ, 'tp hcm');
      const wantsCentralRegion =
        hasWholePhrase(normalizedQ, 'mien trung') ||
        hasWholePhrase(normalizedQ, 'tay nguyen') ||
        hasWholePhrase(normalizedQ, 'da lat');

      const fallbackTrail = wantsSouthRegion
        ? availableTrails.find((t) => t.region === 'Miền Nam') || availableTrails[0]
        : wantsCentralRegion
        ? availableTrails.find((t) => t.region === 'Miền Trung') || availableTrails[0]
        : availableTrails.find((t) => t.id === 'trail-fansipan') || availableTrails[0];

      const paceTrail = liveCtx.targetTrail || fallbackTrail;
      if (paceTrail) {
        const bioParams = extractBioParamsFromQuery(normalizedQ, paceTrail);
        // Preserve ':' and '.' / ',' so "06:30" and decimal "10.5kg" / "8,5 kg" parse accurately
        const rawFolded = removeEmojis(message)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[đĐ]/g, 'd')
          .toLowerCase();

        // Require explicit start-time cue before bare "Xh" so duration phrases like "leo mất 8h" are NEVER misparsed as 08:00;
        // allow standalone clock format "HH:MM" / "XhMM" (with minutes) when not preceded by duration words.
        const cuedTimeMatch = rawFolded.match(
          /(?:xuat phat|khoi hanh|bat dau|di tu|tu luc|vao luc|luc|tu)\s+(\d{1,2})\s*(?:h|:)\s*(\d{2})?(?=$|[\s,.)?])/
        );
        const clockTimeMatch = !cuedTimeMatch
          ? rawFolded.match(/(?<!(?:mat|het|tam|khoang|tong|trong)\s)(\d{1,2})\s*(?::|h)\s*(\d{2})(?=$|[\s,.)?])/)
          : null;
        const timeMatch = cuedTimeMatch || clockTimeMatch;
        let parsedStart: string | undefined;
        if (timeMatch) {
          const hh = Number(timeMatch[1]);
          const mm = timeMatch[2] ? Number(timeMatch[2]) : 0;
          if (hh >= 3 && hh <= 22 && mm >= 0 && mm <= 59) {
            parsedStart = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
          }
        }
        const packMatch = rawFolded.match(
          /(?:tong\s+trong\s+luong\s+(?:deo\s+vai|mang\s+vac)|trong\s+luong\s+deo\s+vai|deo\s+vai|balo|ba\s+lo|tui|vac|tai)\s*(?:toi\s*|minh\s*|nay\s*|nang\s*)?(?::\s*)?(\d{1,3}(?:[.,]\d{1,2})?)\s*kg/
        );
        const parsedPackKg = packMatch ? Number(packMatch[1].replace(',', '.')) : undefined;
        const bodyMatch = rawFolded.match(
          /(?:can\s+nang(?:\s+co\s+the)?|co\s+the|toi\s+nang|minh\s+nang)\s*(?:la\s*)?(\d{2,3}(?:[.,]\d)?)\s*kg/
        );
        const parsedBodyKg = bodyMatch ? Number(bodyMatch[1].replace(',', '.')) : undefined;
        const paceDateMatch = rawFolded.match(/\b(20[23]\d-\d{2}-\d{2})\b/);
        const paceDepartureDate =
          paceDateMatch && isValidCalendarDateIso(paceDateMatch[1]) ? paceDateMatch[1] : undefined;

        const pacePlan = await computeTrailPacePlan(
          {
            trailId: paceTrail.id,
            departureDate: paceDepartureDate,
            startTime: parsedStart,
            packWeightKg: Number.isFinite(parsedPackKg) ? parsedPackKg : bioParams.packWeightKg,
            bodyWeightKg:
              Number.isFinite(parsedBodyKg) && parsedBodyKg! >= 35 && parsedBodyKg! <= 160
                ? parsedBodyKg
                : bioParams.bodyWeightKg,
            fitnessLevel: bioParams.fitnessLevel,
          },
          availableTrails
        );

        if (pacePlan) {
          const fallbackDisclosure = !hasExplicitTrail
            ? `*(Lưu ý: Bạn chưa chọn cung đường cụ thể — LOST AI đang minh họa theo **${pacePlan.trailName}** (${pacePlan.province}). Hãy nêu rõ tên đỉnh/cung dự định leo để tính giờ mặt trời NOAA & giờ quay đầu chính xác theo tọa độ thực địa.)*\n\n`
            : '';
          const paceReply = removeEmojis(
            `${fallbackDisclosure}**KẾ HOẠCH TỐC ĐỘ & GIỜ QUAY ĐẦU AN TOÀN — ${pacePlan.trailName.toUpperCase()} (${pacePlan.departureDate}):**\n\n` +
              `- **Giờ quay đầu an toàn (Turnaround Cutoff)**: **${pacePlan.pacing.safeTurnaroundTime}** (để kịp hạ sơn trước hoàng hôn **${pacePlan.solar.sunset}** tối thiểu 30 phút).\n` +
              `- **Ánh sáng mặt trời NOAA tại đỉnh**: Hừng đông **${pacePlan.solar.civilDawn}** · Bình minh **${pacePlan.solar.sunrise}** · Hoàng hôn **${pacePlan.solar.sunset}** · Tắt sáng **${pacePlan.solar.civilDusk}**.\n` +
              `- **Dự kiến ETA với balo ${pacePlan.inputs.packWeightKg} kg**: Xuất phát **${pacePlan.inputs.startTime}** → Chạm đỉnh **${pacePlan.pacing.summitEta}** → Về đích **${pacePlan.pacing.finishEta}** (Ngày ${pacePlan.pacing.finishDay}, tổng di chuyển **${pacePlan.pacing.totalMovingHours}h**).\n` +
              `- **Đánh giá rủi ro bóng tối**: ${pacePlan.pacing.riskSummary}`
          );

          const paceAction: RichAiAssistantAction = {
            type: 'pace_schedule_card',
            trailId: pacePlan.trailId,
            trailName: pacePlan.trailName,
            pacePlanData: pacePlan,
          };

          const hasGoNoGoCard =
            deterministic.priorityMatched === 'P1_GONOGO' ||
            deterministic.actions.some((a) => a.type === 'go_no_go_card');

          if (hasGoNoGoCard) {
            // Preserve live Go/No-Go storm/landslide safety card & reply, appending pace_schedule_card alongside it!
            const nonQuick = deterministic.actions.filter((a) => a.type !== 'quick_reply');
            const existingQuick = deterministic.actions.filter((a) => a.type === 'quick_reply');
            deterministic = {
              reply: `${deterministic.reply}\n\n---\n\n${paceReply}`,
              actions: [...nonQuick, paceAction, ...existingQuick],
              priorityMatched: deterministic.priorityMatched,
            };
          } else {
            const suggestions = !hasExplicitTrail
              ? wantsSouthRegion
                ? [
                    'Tính giờ quay đầu leo Núi Bà Đen xuất phát 06:00',
                    'Tính giờ quay đầu leo Tà Năng - Phan Dũng',
                    'Tính giờ quay đầu leo Núi Chứa Chan',
                  ]
                : wantsCentralRegion
                ? [
                    'Tính giờ quay đầu leo Bidoup xuất phát 06:00',
                    'Tính giờ quay đầu leo Langbiang',
                    'Tính giờ quay đầu leo Bạch Mã',
                  ]
                : [
                    'Tính giờ quay đầu leo Tà Xùa xuất phát 06:00',
                    'Tính giờ quay đầu leo Núi Bà Đen xuất phát 06:00',
                    'Tính giờ quay đầu leo Ba Vì xuất phát 06:30',
                  ]
              : [
                  `Đánh giá Go/No-Go hôm nay cho ${pacePlan.trailName}`,
                  `Checklist đèn pin & trang bị cho ${pacePlan.trailName}`,
                  `Tính lượng nước & Oresol leo ${pacePlan.trailName}`,
                ];
            deterministic = {
              reply: paceReply,
              actions: [
                paceAction,
                {
                  type: 'quick_reply',
                  suggestions,
                },
              ],
              priorityMatched: 'P1_PACE_PLAN',
            };
          }
        }
      }
    }
  }

  // Wave 14A: AI Nutrition, Hydration & Electrolyte Planner (never hijacks P0_EMERGENCY; preserves P1_GONOGO & P1_PACE_PLAN!)
  if (deterministic.priorityMatched !== 'P0_EMERGENCY') {
    const wantsFuelPlan = [
      'mang bao nhieu nuoc',
      'bao nhieu nuoc',
      'luong nuoc',
      'khau phan an',
      'thuc an',
      'do an leo nui',
      'do an trekking',
      'mang do an',
      'dinh duong',
      'dien giai',
      'oresol',
      'tinh calo',
      'luong calo',
      'thuc don',
      'ke hoach an uong',
      'an chay leo nui',
      'fuel plan',
      'hydration',
    ].some((p) => hasWholePhrase(normalizedQ, p));

    // Preserve pure Naismith/Tobler bio-calc queries when user did not explicitly ask for food/rations/electrolytes/hydration planner
    const isPureNaismithTimeQuery =
      deterministic.priorityMatched === 'P1_BIOCALC' &&
      (hasWholePhrase(normalizedQ, 'naismith') || hasWholePhrase(normalizedQ, 'tobler')) &&
      !['khau phan an', 'thuc an', 'do an', 'dinh duong', 'dien giai', 'oresol', 'thuc don', 'tinh calo', 'an chay'].some((p) =>
        hasWholePhrase(normalizedQ, p)
      );

    if (wantsFuelPlan && !isPureNaismithTimeQuery) {
      const hasExplicitTrail = Boolean(liveCtx.targetTrail);
      const wantsSouthRegion =
        hasWholePhrase(normalizedQ, 'mien nam') ||
        hasWholePhrase(normalizedQ, 'dong nam bo') ||
        hasWholePhrase(normalizedQ, 'sai gon') ||
        hasWholePhrase(normalizedQ, 'tp hcm');
      const wantsCentralRegion =
        hasWholePhrase(normalizedQ, 'mien trung') ||
        hasWholePhrase(normalizedQ, 'tay nguyen') ||
        hasWholePhrase(normalizedQ, 'da lat');

      const fallbackTrail = wantsSouthRegion
        ? availableTrails.find((t) => t.region === 'Miền Nam') || availableTrails[0]
        : wantsCentralRegion
        ? availableTrails.find((t) => t.region === 'Miền Trung') || availableTrails[0]
        : availableTrails.find((t) => t.id === 'trail-fansipan') || availableTrails[0];

      const fuelTrail = liveCtx.targetTrail || fallbackTrail;
      if (fuelTrail) {
        const bioParams = extractBioParamsFromQuery(normalizedQ, fuelTrail);
        const rawFolded = removeEmojis(message)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[đĐ]/g, 'd')
          .toLowerCase();

        const dietType: FuelDietType =
          hasWholePhrase(normalizedQ, 'an chay') ||
          hasWholePhrase(normalizedQ, 'thuan chay') ||
          hasWholePhrase(normalizedQ, 'vegetarian') ||
          hasWholePhrase(normalizedQ, 'vegan')
            ? 'vegetarian'
            : hasWholePhrase(normalizedQ, 'sieu nhe') ||
              hasWholePhrase(normalizedQ, 'ultralight') ||
              hasWholePhrase(normalizedQ, 'toi gian')
            ? 'ultralight'
            : 'standard';

        const packMatch = rawFolded.match(
          /(?:tong\s+trong\s+luong\s+(?:deo\s+vai|mang\s+vac)|trong\s+luong\s+deo\s+vai|deo\s+vai|balo|ba\s+lo|tui|vac|tai)\s*(?:toi\s*|minh\s*|nay\s*|nang\s*)?(?::\s*)?(\d{1,2}(?:[.,]\d{1,2})?)\s*kg/
        );
        const parsedPackKg = packMatch ? Number(packMatch[1].replace(',', '.')) : undefined;
        const bodyMatch = rawFolded.match(
          /(?:can\s+nang(?:\s+co\s+the)?|co\s+the|toi\s+nang|minh\s+nang)\s*(?:la\s*)?(\d{2,3}(?:[.,]\d)?)\s*kg/
        );
        const parsedBodyKg = bodyMatch ? Number(bodyMatch[1].replace(',', '.')) : undefined;
        // Require group cues & exclude tent/gear phrases like "lều 2 người"; clamp >20 to 20 with explicit disclosure
        const groupMatch = rawFolded.match(
          /(?<!(?:leu|tui ngu|bat|vo|can)\s)(?:cho|nhom|doan|team|di|gom|co)\s+(\d{1,3})\s*(?:nguoi|thanh vien|trekker)/
        );
        const rawGroupSize = groupMatch ? Number(groupMatch[1]) : undefined;
        const groupCappedFrom =
          Number.isFinite(rawGroupSize) && rawGroupSize! > 20 ? Math.round(rawGroupSize!) : undefined;
        const parsedGroupSize =
          Number.isFinite(rawGroupSize) && rawGroupSize! >= 1 ? Math.min(20, Math.round(rawGroupSize!)) : 1;

        // Parse temperature ranges ("25-30°C", "28–35 do c") BEFORE unary minus so range hyphens NEVER parse as freezing negative!
        const tempRangeMatch = rawFolded.match(/(\d{1,2})\s*[-–~]\s*(\d{1,2})\s*(?:do c|°c)/);
        const tempSingleMatch = !tempRangeMatch
          ? rawFolded.match(/(?:^|[^\d-])(-?\d{1,2})\s*(?:do c|°c)/)
          : null;
        const parsedTempC = tempRangeMatch
          ? Math.round((Number(tempRangeMatch[1]) + Number(tempRangeMatch[2])) / 2)
          : tempSingleMatch
          ? Number(tempSingleMatch[1])
          : undefined;

        const fuelPlan = await computeTrailFuelPlan(
          {
            trailId: fuelTrail.id,
            bodyWeightKg:
              Number.isFinite(parsedBodyKg) && parsedBodyKg! >= 35 && parsedBodyKg! <= 160
                ? parsedBodyKg
                : bioParams.bodyWeightKg,
            packWeightKg: Number.isFinite(parsedPackKg) ? parsedPackKg : undefined,
            fitnessLevel: bioParams.fitnessLevel,
            dietType,
            ambientTempC:
              Number.isFinite(parsedTempC) && parsedTempC! >= -5 && parsedTempC! <= 45
                ? parsedTempC
                : undefined,
            groupSize: parsedGroupSize,
          },
          availableTrails
        );

        if (fuelPlan) {
          const fallbackDisclosure = !hasExplicitTrail
            ? `*(Lưu ý: Bạn chưa chỉ định cung đường cụ thể — LOST AI đang minh họa theo **${fuelPlan.trailName}** (${fuelPlan.province}). Hãy nêu tên cung đường để tính lượng nước, điểm tiếp suối & khẩu phần chính xác theo độ cao và khí hậu thực địa.)*\n\n`
            : '';
          const groupCapDisclosure = groupCappedFrom
            ? `*(Lưu ý quy mô đoàn: Hệ thống giới hạn tính toán tối đa **20 thành viên/đoàn** thay vì ${groupCappedFrom} người — đoàn lớn nên tách tổ nhỏ <= 15 người để giữ cự ly an toàn rừng.)*\n\n`
            : '';
          const waterSourcePhrase = fuelPlan.hasWaterSource
            ? fuelPlan.hydration.waterResupplySpots.length > 0
              ? `(có ${fuelPlan.hydration.waterResupplySpots.length} điểm tham chiếu tiếp nước dọc tuyến — bắt buộc lọc/đun sôi)`
              : `(tuyến có nguồn nước tự nhiên theo mùa — bắt buộc mang bộ lọc/đun sôi và kiểm tra với kiểm lâm)`
            : `(tuyến khô không có suối dọc đường${fuelPlan.durationDays >= 2 ? ' — cần sắp xếp porter/tiếp nước cho Ngày 2+' : ''})`;

          const fuelReply = removeEmojis(
            `${fallbackDisclosure}${groupCapDisclosure}**KẾ HOẠCH DINH DƯỠNG, NƯỚC UỐNG & ĐIỆN GIẢI — ${fuelPlan.trailName.toUpperCase()} (${fuelPlan.inputs.dietLabel}):**\n\n` +
              `- **Nước uống & Mang mỗi ${fuelPlan.hasWaterSource ? 'chặng' : 'ngày'}**: Tổng **${fuelPlan.hydration.waterLitersTotal}L** (**${fuelPlan.hydration.waterLitersPerDay}L/ngày**, đổ mồ hôi ~${fuelPlan.hydration.sweatRateLPerHour}L/h ở ${fuelPlan.inputs.ambientTempC}°C / ẩm ${fuelPlan.inputs.humidityPct}%). Khuyến nghị mang **${fuelPlan.hydration.carryWaterPerLegLiters}L/${fuelPlan.hasWaterSource ? 'chặng' : 'ngày'}** ${waterSourcePhrase}.\n` +
              `- **Điện giải WHO Oresol**: **${fuelPlan.hydration.oresolPacketsTotal} gói** (~${fuelPlan.hydration.oresolPacketsPerDay} gói/ngày, bù ~${fuelPlan.hydration.sodiumMgPerDay.toLocaleString('vi-VN')} mg Na/ngày).\n` +
              `- **Năng lượng (Pandolf/ACSM)**: **${fuelPlan.energy.totalTripKcal.toLocaleString('vi-VN')} kcal** cả chuyến (**${fuelPlan.energy.dailyKcal.toLocaleString('vi-VN')} kcal/ngày**; ${fuelPlan.energy.carbsGrams}g Carb · ${fuelPlan.energy.proteinGrams}g Đạm · ${fuelPlan.energy.fatGrams}g Béo).\n` +
              `- **Tải đồ ăn + nước & Chi phí**: Đồ ăn + Oresol **${fuelPlan.totals.foodWeightKgPerPerson} kg** + nước mang **${fuelPlan.totals.carryWaterWeightKgPerPerson} kg** = **${fuelPlan.totals.totalConsumableCarryKg} kg/người** (dự toán mua đồ ~**${fuelPlan.totals.estimatedFoodCostVndPerPerson.toLocaleString('vi-VN')} VNĐ/người**${fuelPlan.inputs.groupSize > 1 ? ` · Đoàn ${fuelPlan.inputs.groupSize} người: ~**${fuelPlan.totals.estimatedFoodCostVndGroup.toLocaleString('vi-VN')} VNĐ**` : ''}).`
          );

          const fuelAction: RichAiAssistantAction = {
            type: 'fuel_plan_card',
            trailId: fuelPlan.trailId,
            trailName: fuelPlan.trailName,
            fuelPlanData: fuelPlan,
          };

          const shouldPreserveExistingCard =
            deterministic.priorityMatched === 'P1_GONOGO' ||
            deterministic.priorityMatched === 'P1_PACE_PLAN' ||
            deterministic.actions.some(
              (a) => a.type === 'go_no_go_card' || a.type === 'pace_schedule_card'
            );

          if (shouldPreserveExistingCard) {
            const nonQuick = deterministic.actions.filter((a) => a.type !== 'quick_reply');
            const existingQuick = deterministic.actions.filter((a) => a.type === 'quick_reply');
            deterministic = {
              reply: `${deterministic.reply}\n\n---\n\n${fuelReply}`,
              actions: [...nonQuick, fuelAction, ...existingQuick],
              priorityMatched: deterministic.priorityMatched,
            };
          } else {
            const suggestions = !hasExplicitTrail
              ? wantsSouthRegion
                ? [
                    'Tính nước uống & khẩu phần ăn leo Núi Bà Đen',
                    'Tính nước uống, Oresol leo Tà Năng - Phan Dũng',
                    'Khẩu phần ăn chay leo Núi Bà Rá',
                  ]
                : wantsCentralRegion
                ? [
                    'Tính nước uống, Oresol leo Bidoup - Núi Bà',
                    'Tính nước uống & khẩu phần ăn leo Hòn Bà Khánh Hòa',
                    'Khẩu phần ăn chay leo VQG Bạch Mã',
                  ]
                : [
                    'Tính nước uống, Oresol & khẩu phần ăn leo Tả Liên Sơn',
                    'Khẩu phần ăn chay leo Tà Xùa 2N1Đ',
                    'Khẩu phần siêu nhẹ ultralight leo Lảo Thẩn',
                  ]
              : [
                  `Tính giờ quay đầu & kế hoạch tốc độ leo ${fuelPlan.trailName}`,
                  `Đánh giá Go/No-Go hôm nay cho ${fuelPlan.trailName}`,
                  fuelPlan.inputs.dietType === 'vegetarian'
                    ? `Khẩu phần siêu nhẹ ultralight leo ${fuelPlan.trailName}`
                    : `Khẩu phần ăn chay leo ${fuelPlan.trailName}`,
                ];
            deterministic = {
              reply: fuelReply,
              actions: [
                fuelAction,
                {
                  type: 'quick_reply',
                  suggestions,
                },
              ],
              priorityMatched: 'P1_FUEL_PLAN',
            };
          }
        }
      }
    }
  }

  // Wave 16A: AI Expedition Readiness Audit 0-100 (never hijacks P0_EMERGENCY; preserves P1_GONOGO / Pace / Fuel!)
  if (deterministic.priorityMatched !== 'P0_EMERGENCY') {
    const wantsReadinessAudit = [
      'danh gia san sang',
      'kiem tra san sang',
      'kiem tra truoc khi di',
      'du suc di',
      'du suc leo',
      'co du suc',
      'san sang xuat phat',
      'readiness',
      'pre flight',
      'audit chuyen di',
      'kiem tra dieu kien leo',
    ].some((p) => hasWholePhrase(normalizedQ, p));

    if (wantsReadinessAudit) {
      const hasExplicitTrail = Boolean(liveCtx.targetTrail);
      const wantsSouthRegion =
        hasWholePhrase(normalizedQ, 'mien nam') ||
        hasWholePhrase(normalizedQ, 'dong nam bo') ||
        hasWholePhrase(normalizedQ, 'sai gon');
      const wantsCentralRegion =
        hasWholePhrase(normalizedQ, 'mien trung') ||
        hasWholePhrase(normalizedQ, 'tay nguyen') ||
        hasWholePhrase(normalizedQ, 'da lat');

      const fallbackTrail = wantsSouthRegion
        ? availableTrails.find((t) => t.region === 'Miền Nam') || availableTrails[0]
        : wantsCentralRegion
        ? availableTrails.find((t) => t.region === 'Miền Trung') || availableTrails[0]
        : availableTrails.find((t) => t.id === 'trail-fansipan') || availableTrails[0];

      const auditTrail = liveCtx.targetTrail || fallbackTrail;
      if (auditTrail) {
        const bioParams = extractBioParamsFromQuery(normalizedQ, auditTrail);
        const rawFolded = removeEmojis(message)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[đĐ]/g, 'd')
          .toLowerCase();

        const cuedTimeMatch = rawFolded.match(
          /(?:xuat phat|khoi hanh|bat dau|di tu|tu luc|vao luc|luc|tu)\s+(\d{1,2})\s*(?:h|:)\s*(\d{2})?(?=$|[\s,.)?])/
        );
        const clockTimeMatch = !cuedTimeMatch
          ? rawFolded.match(/(?<!(?:mat|het|tam|khoang|tong|trong)\s)(\d{1,2})\s*(?::|h)\s*(\d{2})(?=$|[\s,.)?])/)
          : null;
        const timeMatch = cuedTimeMatch || clockTimeMatch;
        let parsedStart: string | undefined;
        if (timeMatch) {
          const hh = Number(timeMatch[1]);
          const mm = timeMatch[2] ? Number(timeMatch[2]) : 0;
          if (hh >= 3 && hh <= 22 && mm >= 0 && mm <= 59) {
            parsedStart = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
          }
        }
        const packMatch = rawFolded.match(
          /(?:tong\s+trong\s+luong\s+(?:deo\s+vai|mang\s+vac)|trong\s+luong\s+deo\s+vai|deo\s+vai|balo|ba\s+lo|tui|vac|tai)\s*(?:toi\s*|minh\s*|nay\s*|nang\s*)?(?::\s*)?(\d{1,3}(?:[.,]\d{1,2})?)\s*kg/
        );
        const parsedPackKg = packMatch ? Number(packMatch[1].replace(',', '.')) : undefined;
        const bodyMatch = rawFolded.match(
          /(?:can\s+nang(?:\s+co\s+the)?|co\s+the|toi\s+nang|minh\s+nang)\s*(?:la\s*)?(\d{2,3}(?:[.,]\d)?)\s*kg/
        );
        const parsedBodyKg = bodyMatch ? Number(bodyMatch[1].replace(',', '.')) : undefined;
        const groupMatch = rawFolded.match(
          /(?<!(?:leu|tui ngu|bat|vo|can)\s)(?:cho|nhom|doan|team|di|gom|co)\s+(\d{1,3})\s*(?:nguoi|thanh vien|trekker)/
        );
        const rawGroupSize = groupMatch ? Number(groupMatch[1]) : undefined;
        const parsedGroupSize =
          hasWholePhrase(normalizedQ, 'mot minh') || hasWholePhrase(normalizedQ, 'solo')
            ? 1
            : Number.isFinite(rawGroupSize) && rawGroupSize! >= 1
            ? Math.min(20, Math.round(rawGroupSize!))
            : 2;
        const todayVn = getVietnamTodayIso();
        const dateMatch = rawFolded.match(/\b(20[23]\d-\d{2}-\d{2})\b/);
        const resolvedDepartureDate =
          dateMatch && isValidCalendarDateIso(dateMatch[1]) && dateMatch[1] >= todayVn
            ? dateMatch[1]
            : undefined;
        const hasPermitNegation = [
          'chua co giay phep',
          'chua xin giay phep',
          'chua lam giay phep',
          'chua dang ky kiem lam',
          'khong co giay phep',
          'khong biet',
          'da co giay phep chua',
          'da xin giay phep chua',
          'co can giay phep',
          'chua ro',
        ].some((neg) => hasWholePhrase(normalizedQ, neg));
        const hasPermitConfirmed =
          !hasPermitNegation &&
          (hasWholePhrase(normalizedQ, 'da co giay phep') ||
            hasWholePhrase(normalizedQ, 'da xin giay phep') ||
            hasWholePhrase(normalizedQ, 'da dang ky kiem lam'));

        // Reuse Go/No-Go assessment if already computed earlier in the same chat turn for this trail & date
        const targetDateForReuse = resolvedDepartureDate || todayVn;
        const precomputedGoNoGo = deterministic.actions.find(
          (a) =>
            a.type === 'go_no_go_card' &&
            a.goNoGoData &&
            a.goNoGoData.trailId === auditTrail.id &&
            a.goNoGoData.departureDate === targetDateForReuse
        )?.goNoGoData;

        const audit = await computeExpeditionReadinessAudit(
          {
            trailId: auditTrail.id,
            departureDate: resolvedDepartureDate,
            startTime: parsedStart,
            bodyWeightKg:
              Number.isFinite(parsedBodyKg) && parsedBodyKg! >= 35 && parsedBodyKg! <= 160
                ? parsedBodyKg
                : bioParams.bodyWeightKg,
            packWeightKg: Number.isFinite(parsedPackKg) ? parsedPackKg : bioParams.packWeightKg,
            fitnessLevel: bioParams.fitnessLevel,
            groupSize: parsedGroupSize,
            hasPermitConfirmed,
            precomputedGoNoGo,
          },
          availableTrails
        );

        if (audit) {
          const fallbackDisclosure = !hasExplicitTrail
            ? `*(Lưu ý: Bạn chưa nêu tên cung đường cụ thể — LOST AI đang đánh giá mẫu trên **${audit.trailName}** (${audit.province}). Hãy nêu tên cung đường bạn dự định đi để chấm điểm 0–100 chính xác theo thực địa.)*\n\n`
            : '';
          const pillarSummaryLines = audit.pillars
            .map((p) => `- **${p.label} (${p.score}/100)**: ${p.summary}`)
            .join('\n');
          const topFixSummary = audit.topFixes[0]
            ? `\n- **Ưu tiên xử lý #1**: ${audit.topFixes[0].title} — ${audit.topFixes[0].action}`
            : '';

          const auditReply = removeEmojis(
            `${fallbackDisclosure}**KIỂM TRA MỨC ĐỘ SẴN SÀNG TRƯỚC GIỜ G — ${audit.trailName.toUpperCase()} (${audit.departureDate}):**\n\n` +
              `- **Điểm Sẵn Sàng Tổng Hợp**: **${audit.readinessScore}/100** — **${audit.verdictLabel}**\n` +
              `${pillarSummaryLines}${topFixSummary}`
          );

          const auditAction: RichAiAssistantAction = {
            type: 'readiness_audit_card',
            trailId: audit.trailId,
            trailName: audit.trailName,
            readinessAuditData: audit,
          };

          const shouldPreserveExistingCard =
            deterministic.priorityMatched === 'P1_GONOGO' ||
            deterministic.priorityMatched === 'P1_PACE_PLAN' ||
            deterministic.priorityMatched === 'P1_FUEL_PLAN' ||
            deterministic.actions.some(
              (a) =>
                a.type === 'go_no_go_card' ||
                a.type === 'pace_schedule_card' ||
                a.type === 'fuel_plan_card'
            );

          if (shouldPreserveExistingCard) {
            const nonQuick = deterministic.actions.filter((a) => a.type !== 'quick_reply');
            const existingQuick = deterministic.actions.filter((a) => a.type === 'quick_reply');
            deterministic = {
              reply: `${deterministic.reply}\n\n---\n\n${auditReply}`,
              actions: [...nonQuick, auditAction, ...existingQuick],
              priorityMatched: deterministic.priorityMatched,
            };
          } else {
            deterministic = {
              reply: auditReply,
              actions: [
                auditAction,
                {
                  type: 'quick_reply',
                  suggestions: [
                    `Tính giờ quay đầu & kế hoạch tốc độ leo ${audit.trailName}`,
                    `Tính nước uống, Oresol & khẩu phần ăn leo ${audit.trailName}`,
                    `Checklist balo & trang bị sinh tồn cho ${audit.trailName}`,
                  ],
                },
              ],
              priorityMatched: 'P1_READINESS_AUDIT',
            };
          }
        }
      }
    }
  }

  // Wave 4C: Head-to-Head Multi-Trail Comparison (never hijacks P0 Emergency; requires explicit comparison cue when P1_* already matched!)
  if (deterministic.priorityMatched !== 'P0_EMERGENCY') {
    const detectedForCompare = detectTrailsForComparison(message, availableTrails, liveCtx.activeTrail?.id);
    const hasExplicitCompare = isComparisonIntent(normalizedQ);
    const hasImplicitPairCompare =
      !deterministic.priorityMatched.startsWith('P1_') &&
      (hasWholePhrase(normalizedQ, 'va') || hasWholePhrase(normalizedQ, 'voi') || hasWholePhrase(normalizedQ, 'hay'));

    if (detectedForCompare.length >= 2 && (hasExplicitCompare || hasImplicitPairCompare)) {
      const compareData = await compareVietnamTrails(
        {
          trailIds: detectedForCompare.map((t) => t.id),
          query: message,
          activeTrailId: liveCtx.activeTrail?.id,
        },
        availableTrails
      );
      if (compareData) {
        const compareNames = compareData.trails.map((t) => `${t.name} (${t.maxAltitudeM.toLocaleString()}m)`).join(' vs ');
        const compareReply = removeEmojis(
          `**SO SÁNH ĐỐI ĐẦU THỰC ĐỊA — ${compareNames.toUpperCase()}:**\n\n` +
            `${compareData.summaryVerdict}\n\n` +
            `- **Khuyến nghị Người mới**: **${compareData.beginnerPick.name}** — ${compareData.beginnerPick.reason}\n` +
            `- **Thử thách Trekker kinh nghiệm**: **${compareData.veteranPick.name}** — ${compareData.veteranPick.reason}\n` +
            `- **Đánh giá mùa vụ**: ${compareData.bestSeasonNote}\n\n` +
            `*Xem bảng đối chiếu chi tiết cao độ, Naismith ETA, giấy phép, nguồn nước, sự cố & dự toán VNĐ ngay trong thẻ so sánh bên dưới!*`
        );
        deterministic = {
          reply: compareReply,
          actions: [
            {
              type: 'trail_compare_card',
              compareData,
            },
            {
              type: 'quick_reply',
              suggestions: [
                `Đánh giá Go/No-Go ${compareData.trails[0].name}`,
                `Đánh giá Go/No-Go ${compareData.trails[1].name}`,
                `Checklist trang bị cho ${compareData.beginnerPick.name}`,
              ],
            },
          ],
          priorityMatched: 'P1_COMPARE',
        };
      }
    }
  }

  const contextUsed: ChatResponsePayload['contextUsed'] = {
    trailId: liveCtx.targetTrail?.id,
    trailName: liveCtx.targetTrail?.name,
    pageView: liveCtx.pageView,
    weatherLive: Boolean(liveCtx.goNoGo?.weatherSummary),
    activeIncidentsCount: liveCtx.goNoGo?.activeIncidentsCount ?? liveCtx.nationwideCriticalIncidents.length,
    userProfileApplied: liveCtx.userProfileApplied,
  };

  // Honor engineMode === 'knowledge' AND skip slow multi-model Gemini cascade on P0_EMERGENCY (0ms life-safety triage!)
  const shouldTryGemini = engineMode !== 'knowledge' && deterministic.priorityMatched !== 'P0_EMERGENCY';
  if (shouldTryGemini) {
    // Assemble verified server-side telemetry context for Gemini
    let contextSnippet = `NGÀY HIỆN TẠI (VIỆT NAM): ${getVietnamTodayIso()}\n`;
    if (liveCtx.pageView) contextSnippet += `TRANG NGƯỜI DÙNG ĐANG MỞ: ${liveCtx.pageView}\n`;
    if (liveCtx.userProfileSummary) {
      contextSnippet += `\nHỒ SƠ TREKKER ĐÃ XÁC THỰC:\n${liveCtx.userProfileSummary}\n`;
    } else if (liveCtx.userName) {
      contextSnippet += `TÊN NGƯỜI DÙNG: ${liveCtx.userName}\n`;
    }

    if (liveCtx.targetTrail) {
      const t = liveCtx.targetTrail;
      const safeName = sanitizePromptContextText(t.name, 100);
      const safeDistrict = sanitizePromptContextText(t.district, 60);
      const safeProvince = sanitizePromptContextText(t.province, 60);
      const safePermit = sanitizePromptContextText(t.permitInfo || 'Cần khai báo VQG/Kiểm lâm', 120);
      const safeRescue = sanitizePromptContextText(t.rescueContact?.phone || '112 / 114', 60);
      contextSnippet += `\nCUNG ĐƯỜNG TRỌNG TÂM:\n- ${safeName} (${safeDistrict ? safeDistrict + ', ' : ''}${safeProvince}, ${t.region})\n- Cao độ: ${t.maxAltitudeM}m | Dài: ${t.distanceKm}km | Dốc: +${t.elevationGainM}m | Độ khó: ${t.difficultyLevel}/5 | Thời lượng: ${sanitizePromptContextText(t.durationHoursNote, 40)}\n- Mùa đẹp: Tháng ${t.bestMonths?.join(', ')} | Tránh: Tháng ${t.avoidMonths?.join(', ')}\n- Giấy phép: ${t.permitRequired ? safePermit : 'Tự do (mang CCCD)'} | Cứu hộ: ${safeRescue}\n`;
      if (liveCtx.goNoGo) {
        const g = liveCtx.goNoGo;
        contextSnippet += `- ĐÁNH GIÁ GO/NO-GO HÔM NAY: ${sanitizePromptContextText(g.verdictLabel, 60)} (${g.score}/100). `;
        if (g.weatherSummary) {
          contextSnippet += `Thời tiết: ${sanitizePromptContextText(g.weatherSummary.conditionLabel, 60)}, đỉnh ước tính ${g.weatherSummary.summitTempMinC}°C..${g.weatherSummary.summitTempMaxC}°C (gió rét ${g.weatherSummary.windChillC}°C), mưa ${g.weatherSummary.precipMm}mm, gió ${g.weatherSummary.windSpeedKmH}km/h.\n`;
        }
        if (g.risks.length > 0) {
          contextSnippet += `- Rủi ro đang hoạt động: ${g.risks.map((r) => sanitizePromptContextText(r, 120)).join(' | ')}\n`;
        }
      }
    }

    if (liveCtx.nationwideCriticalIncidents.length > 0) {
      contextSnippet += `\nCẢNH BÁO SỰ CỐ ĐANG MỞ TRÊN HỆ THỐNG LOST:\n`;
      for (const inc of liveCtx.nationwideCriticalIncidents) {
        contextSnippet += `- [${inc.severity.toUpperCase()}] ${sanitizePromptContextText(inc.trailName, 90)} (${sanitizePromptContextText(inc.type, 40)}): ${sanitizePromptContextText(inc.description, 140)}\n`;
      }
    }

    if (liveCtx.userCoordinates) {
      contextSnippet += `\nTỌA ĐỘ GPS NGƯỜI DÙNG: Lat ${liveCtx.userCoordinates.lat.toFixed(4)}, Lng ${liveCtx.userCoordinates.lng.toFixed(4)}\n`;
    }

    contextSnippet += `\nDANH MỤC CUNG ĐƯỜNG XÁC THỰC TRÊN LOST:\n`;
    for (const t of availableTrails) {
      contextSnippet += `- [${sanitizePromptContextText(t.id, 64)}] ${sanitizePromptContextText(t.name, 90)} | ${sanitizePromptContextText(t.province, 50)} (${t.region}) | ${t.maxAltitudeM}m | ${t.distanceKm}km | +${t.elevationGainM}m | Cấp ${t.difficultyLevel}/5 | Mùa đẹp: ${t.bestMonths?.join(',')} | Cứu hộ: ${sanitizePromptContextText(t.rescueContact?.phone || '112/114', 50)}. ${sanitizePromptContextText(t.description || '', 120)}\n`;
    }

    if (matchedFaqs.length > 0) {
      contextSnippet += `\nTRI THỨC CHUẨN LIÊN QUAN:\n`;
      for (const faq of matchedFaqs) {
        contextSnippet += `[Hỏi]: ${faq.question}\n[Chuẩn]: ${faq.answer.slice(0, 500)}\n\n`;
      }
    }

    const geminiText = await generateWithGemini(message, conversationHistory, contextSnippet);
    if (geminiText) {
      const enrichedActions = ensureContextualFollowUpChips(
        deterministic.actions,
        deterministic.priorityMatched,
        normalizedQ,
        liveCtx
      );
      return {
        reply: removeEmojis(geminiText),
        actions: enrichedActions, // Hybrid: Gemini rich prose + guaranteed structured interactive cards + follow-up chips!
        modelUsed: 'gemini-live',
        contextUsed,
      };
    }
  }

  const finalActions = ensureContextualFollowUpChips(
    deterministic.actions,
    deterministic.priorityMatched,
    normalizedQ,
    liveCtx
  );

  return {
    reply: deterministic.reply,
    actions: finalActions,
    modelUsed: 'lost-knowledge-engine',
    contextUsed,
  };
}

/**
 * Guarantees every AI reply carries 2-3 context-aware next-step follow-up chips
 * tailored to the matched intent and active/mentioned trail without echoing the user prompt.
 */
function ensureContextualFollowUpChips(
  actions: RichAiAssistantAction[],
  priorityMatched: string,
  normalizedQ: string,
  liveCtx: ResolvedLiveContext
): RichAiAssistantAction[] {
  const trail = liveCtx.targetTrail;
  const fallbackCandidates: string[] = [];

  if (priorityMatched === 'P0_EMERGENCY') {
    fallbackCandidates.push(
      trail ? `Hotline kiểm lâm & cứu hộ tại ${trail.name}` : 'Hotline cứu hộ VQG & tổng đài 112/115',
      'Quy tắc S.T.O.P khi lạc đường trong rừng',
      'Cách giữ ấm xử lý hạ thân nhiệt khẩn cấp'
    );
  } else if (priorityMatched === 'P1_GONOGO' && trail) {
    fallbackCandidates.push(
      `Lịch trình chi tiết leo ${trail.name}`,
      `Checklist balo & áo ấm cho ${trail.name}`,
      `Tính thời gian Naismith & lượng nước leo ${trail.name}`
    );
  } else if (priorityMatched === 'P1_ITINERARY' && trail) {
    fallbackCandidates.push(
      `Đánh giá Go/No-Go hôm nay cho ${trail.name}`,
      `Checklist trang bị sinh tồn cho ${trail.name}`,
      `Tính thời gian Naismith & nước uống leo ${trail.name}`
    );
  } else if (priorityMatched === 'P1_GEAR') {
    fallbackCandidates.push(
      trail ? `Đánh giá Go/No-Go hôm nay cho ${trail.name}` : 'Gợi ý cung săn mây đẹp cho người mới',
      trail ? `Tính tải trọng balo & lượng nước leo ${trail.name}` : 'Tính thời gian Naismith & lượng nước leo núi 15km',
      'Quy tắc 3 lớp áo chống rét trên đỉnh núi'
    );
  } else if (priorityMatched === 'P1_PACE_PLAN' && trail) {
    fallbackCandidates.push(
      `Đánh giá Go/No-Go hôm nay cho ${trail.name}`,
      `Checklist đèn pin & trang bị cho ${trail.name}`,
      `Tính lượng nước & Oresol leo ${trail.name}`
    );
  } else if (priorityMatched === 'P1_BIOCALC') {
    fallbackCandidates.push(
      trail ? `Checklist balo gọn nhẹ cho ${trail.name}` : 'Checklist đồ leo núi 2N1Đ dưới 9kg',
      'Cách pha Oresol & phòng chuột rút khi leo dốc',
      trail ? `Đánh giá Go/No-Go hôm nay cho ${trail.name}` : 'Kế hoạch tập thể lực 4 tuần leo núi'
    );
  } else if (priorityMatched === 'P4_GRATITUDE') {
    fallbackCandidates.push(
      trail ? `Đánh giá Go/No-Go hôm nay cho ${trail.name}` : 'Gợi ý cung săn mây cuối tuần này',
      'So sánh 2 cung đường trekking nổi bật',
      'Checklist an toàn trước giờ xuất phát'
    );
  } else if (trail) {
    fallbackCandidates.push(
      `Đánh giá Go/No-Go hôm nay cho ${trail.name}`,
      `Lịch trình chi tiết leo ${trail.name}`,
      `Checklist trang bị cho ${trail.name}`
    );
  } else {
    fallbackCandidates.push(
      'Gợi ý cung săn mây đẹp cho người mới',
      'Tính thời gian Naismith & nước uống leo núi 15km',
      'Checklist đồ dùng sinh tồn & Balo 2N1Đ'
    );
  }

  // Always filter existing quick_reply chips against echo of normalizedQ BEFORE returning!
  const existingQr = actions.find((a) => a.type === 'quick_reply' && Array.isArray(a.suggestions));
  const seedPool = existingQr?.suggestions?.length
    ? [...existingQr.suggestions, ...fallbackCandidates]
    : fallbackCandidates;

  const seenNorm = new Set<string>();
  const filtered: string[] = [];
  for (const raw of seedPool) {
    const clean = removeEmojis(raw);
    const cNorm = normalizeSearchText(clean);
    if (!cNorm || cNorm === normalizedQ || seenNorm.has(cNorm)) continue;
    seenNorm.add(cNorm);
    filtered.push(clean);
    if (filtered.length >= 3) break;
  }

  if (filtered.length < 2) {
    return actions;
  }

  return [
    ...actions.filter((a) => a.type !== 'quick_reply'),
    { type: 'quick_reply', suggestions: filtered },
  ];
}

// =========================================================================
// WAVE 10A: MULTIMODAL PHOTO TRIAGE (MAGIC-BYTE VALIDATED + GEMINI VISION + SAFE FALLBACK)
// =========================================================================

const MAX_TRIAGE_IMAGE_BYTES = Math.floor(2.5 * 1024 * 1024); // 2.5 MB decoded hard cap
const MAX_RAW_B64_CHARS = Math.ceil((MAX_TRIAGE_IMAGE_BYTES * 4) / 3) + 512;

export function validateAndDecodeTriageImage(
  rawBase64: unknown,
  declaredMime?: unknown
):
  | { ok: true; cleanBase64: string; detectedMimeType: SupportedTriageMimeType; imageBytes: number }
  | { ok: false; error: string } {
  if (typeof rawBase64 !== 'string' || !rawBase64.trim()) {
    return { ok: false, error: 'Thiếu dữ liệu ảnh (imageBase64).' };
  }

  // Hard pre-length guard BEFORE any regex/replace/copy on potentially multi-MB input
  if (rawBase64.length > MAX_RAW_B64_CHARS) {
    return { ok: false, error: 'Dung lượng ảnh vượt quá giới hạn tối đa 2.5 MB sau giải mã.' };
  }

  const declared = typeof declaredMime === 'string' ? declaredMime.trim().toLowerCase() : '';
  if (declared && !['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(declared)) {
    return {
      ok: false,
      error: 'Chỉ hỗ trợ ảnh định dạng JPEG, PNG hoặc WebP (từ chối SVG/HTML/tệp không hợp lệ).',
    };
  }

  let payload = rawBase64.trim();
  const dataUriMatch = payload.match(/^data:([^;]+);base64,(.+)$/is);
  if (dataUriMatch) {
    const uriMime = dataUriMatch[1].trim().toLowerCase();
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(uriMime)) {
      return {
        ok: false,
        error: 'Chỉ chấp nhận data URI định dạng image/jpeg, image/png hoặc image/webp.',
      };
    }
    payload = dataUriMatch[2].trim();
  }

  const stripped = payload.replace(/\s+/g, '');
  if (!stripped || !/^[A-Za-z0-9+/=]+$/.test(stripped)) {
    return { ok: false, error: 'Chuỗi Base64 của ảnh không hợp lệ.' };
  }

  // Fast pre-check before allocating full Buffer (base64 expands bytes by ~4/3)
  if (stripped.length > Math.ceil((MAX_TRIAGE_IMAGE_BYTES * 4) / 3) + 64) {
    return { ok: false, error: 'Dung lượng ảnh vượt quá giới hạn tối đa 2.5 MB sau giải mã.' };
  }

  const buffer = Buffer.from(stripped, 'base64');
  if (buffer.length < 32) {
    return { ok: false, error: 'Tệp ảnh quá nhỏ hoặc bị hỏng dữ liệu.' };
  }
  if (buffer.length > MAX_TRIAGE_IMAGE_BYTES) {
    return { ok: false, error: 'Dung lượng ảnh vượt quá giới hạn tối đa 2.5 MB sau giải mã.' };
  }

  // Reject any disguised XML/SVG/HTML header text
  const headAscii = buffer.subarray(0, 64).toString('utf8').toLowerCase();
  if (headAscii.includes('<svg') || headAscii.includes('<html') || headAscii.includes('<!doctype') || headAscii.includes('<script')) {
    return { ok: false, error: 'Từ chối tệp SVG/HTML vì lý do bảo mật.' };
  }

  // Strict binary magic-byte inspection
  let detectedMimeType: SupportedTriageMimeType | null = null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    detectedMimeType = 'image/jpeg';
  } else if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    detectedMimeType = 'image/png';
  } else if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    detectedMimeType = 'image/webp';
  }

  if (!detectedMimeType) {
    return {
      ok: false,
      error: 'Chữ ký tệp (magic bytes) không khớp JPEG, PNG hoặc WebP hợp lệ.',
    };
  }

  return {
    ok: true,
    cleanBase64: stripped,
    detectedMimeType,
    imageBytes: buffer.length,
  };
}

function classifyImageTriageCategory(normalizedQ: string): ImageTriageCategory {
  const anyOf = (phrases: string[]) => phrases.some((p) => hasWholePhrase(normalizedQ, p));
  if (anyOf(['ran', 'ran doc', 'ran can', 'snake', 'noc doc', 'bo cap', 'ret', 'ong vo ve', 'ong dot', 'con trung', 'vat'])) {
    return 'wildlife_snake';
  }
  if (anyOf(['nam', 'nam rung', 'nam doc', 'mushroom', 'la rung', 'qua rung', 'cay doc', 'an duoc khong'])) {
    return 'flora_mushroom';
  }
  if (anyOf(['vet thuong', 'chay mau', 'bong gan', 'lat so mi', 'gay xuong', 'sung', 'phong rop', 'di ung', 'phat ban', 'man do', 'bi can', 'bi dot', 'rash', 'wound', 'injury', 'bite'])) {
    return 'injury_medical';
  }
  if (anyOf(['may', 'bien may', 'suong mu', 'bau troi', 'thoi tiet', 'giong', 'set', 'mua'])) {
    return 'weather_cloud';
  }
  if (anyOf(['giay', 'balo', 'ba lo', 'leu', 'tui ngu', 'gay trekking', 'trang bi', 'duong mon', 'nga ba', 'bien bao', 'moc'])) {
    return 'gear_trail';
  }
  return 'general';
}

function buildPhotoMedicalTriageCard(
  category: ImageTriageCategory,
  normalizedQ: string,
  activeTrail?: Trail
): FirstAidTriageCardData | null {
  if (category !== 'wildlife_snake' && category !== 'flora_mushroom' && category !== 'injury_medical') {
    return null;
  }

  // First try the dedicated WFA detector for exact condition match (snakebite, fracture, sprain, wasp, mushroom)
  const exact = detectEmergencyTriage(normalizedQ, activeTrail);
  if (exact) return exact.triage;

  const contacts = selectEmergencyContacts(normalizedQ, activeTrail);
  const trailLabel = activeTrail ? ` tại ${activeTrail.name}` : '';

  if (category === 'wildlife_snake') {
    return {
      severity: 'critical',
      conditionCode: 'WFA-SNAKE',
      conditionTitle: 'Cảnh Báo Rắn / Động Vật Độc Thực Địa (WFA)',
      summary: 'Luôn coi rắn rừng không rõ loài là có nguy cơ độc; giữ khoảng cách an toàn >= 2m và áp dụng chuẩn sơ cứu ngay nếu bị cắn.',
      immediateSteps: [
        'Giữ khoảng cách tối thiểu 2m, KHÔNG xua đuổi, chọc gậy hay cố bắt rắn.',
        'Nếu đã bị cắn: đặt nạn nhân nằm yên, tháo nhẫn/đồng hồ, bất động chi bị cắn THẤP HƠN MỨC TIM.',
        'Băng ép thun đàn hồi nhẹ từ đầu chi lên trên (vẫn sờ thấy mạch đập) và cáng xuống bệnh viện ngay.',
      ],
      forbiddenActions: [
        'TUYỆT ĐỐI KHÔNG rạch vết cắn, KHÔNG hút nọc bằng miệng, KHÔNG garo thắt chặt gây hoại tử.',
        'KHÔNG đắp lá rừng hay áp dụng mẹo dân gian.',
      ],
      whenToEvacuate: ['Mọi vết cắn nghi ngờ rắn độc hoặc sưng đau lan nhanh, tê bì, chóng mặt cần chuyển viện khẩn cấp.'],
      emergencyContacts: contacts,
      sosSmsNote: `CAN HO TRO KHAN CAP RAN / DONG VAT DOC${trailLabel}. Can chuyen vien cap cuu.`,
    };
  }

  if (category === 'flora_mushroom') {
    return {
      severity: 'critical',
      conditionCode: 'WFA-POISON',
      conditionTitle: 'An Toàn Nấm & Thực Vật Rừng — Phòng Ngộ Độc (WFA)',
      summary: 'TUYỆT ĐỐI KHÔNG ăn nấm hoặc quả rừng lạ dựa trên nhận diện ảnh. Độc tố nấm (như Amanita) có thể gây suy gan cấp muộn sau 6–24 giờ.',
      immediateSteps: [
        'Tuyệt đối không hái ăn thử, không chạm tay trần rồi dụi mắt/miệng.',
        'Nếu có người đã ăn phải: giữ lại mẫu nấm/chất nôn để bác sĩ định danh độc tố.',
        'Bù nước sạch từng ngụm nhỏ nếu còn tỉnh táo và đưa đến cơ sở y tế gần nhất ngay lập tức.',
      ],
      forbiddenActions: [
        'KHÔNG tự ý ép nôn khi nạn nhân đã lơ mơ hoặc co giật.',
        'KHÔNG tin các mẹo truyền miệng như "nấm có sâu ăn là không độc" hoặc "thử bằng đũa bạc".',
      ],
      whenToEvacuate: ['Bất kỳ ai đã nuốt nấm/quả rừng lạ, kể cả khi chưa xuất hiện đau bụng hay buồn nôn.'],
      emergencyContacts: contacts,
      sosSmsNote: `CAP CUU NGO DOC NAM / THUC VAT RUNG${trailLabel}. Can ho tro y te khan cap 115.`,
    };
  }

  // injury_medical generic wound / rash / bite triage
  return {
    severity: 'urgent',
    conditionCode: 'WFA-WOUND',
    conditionTitle: 'Sơ Cứu Vết Thương / Côn Trùng Cắn / Dị Ứng Thực Địa',
    summary: 'Ưu tiên cầm máu, làm sạch vết thương tránh nhiễm trùng rừng ẩm và theo dõi dấu hiệu sốc phản vệ.',
    immediateSteps: [
      'Cầm máu trực tiếp bằng gạc sạch ép liên tục 5–10 phút nếu chảy máu.',
      'Rửa sạch vết thương bằng nước muối sinh lý hoặc nước sạch đun sôi để nguội; sát khuẩn nhẹ quanh mép.',
      'Nếu nổi mẩn đỏ/phát ban sau chạm lá hoặc côn trùng đốt: rửa sạch bằng nước mát, tránh gãi và theo dõi nhịp thở.',
    ],
    forbiddenActions: [
      'KHÔNG đắp lá cây, thuốc lá hay bùn đất lên vết thương hở.',
      'KHÔNG rút vật sắc nhọn đang cắm sâu trong vết thương (cố định xung quanh và chuyển viện).',
    ],
    whenToEvacuate: [
      'Chảy máu không cầm sau 10 phút ép chặt, vết thương sâu/nhiễm bẩn, hoặc sưng môi/mí mắt, khó thở (sốc phản vệ).',
    ],
    emergencyContacts: contacts,
    sosSmsNote: `CAN HO TRO Y TE VET THUONG / DI UNG${trailLabel}. Can ho tro cap cuu.`,
  };
}

async function generateMultimodalWithGemini(params: {
  cleanBase64: string;
  mimeType: SupportedTriageMimeType;
  prompt: string;
  systemText: string;
}): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  if (Date.now() < geminiCircuitOpenUntil) return null;

  const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
  for (const modelName of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: AbortSignal.timeout(9500),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: params.systemText }] },
          contents: [
            {
              role: 'user',
              parts: [
                { inline_data: { mime_type: params.mimeType, data: params.cleanBase64 } },
                { text: params.prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.25,
            topP: 0.85,
            maxOutputTokens: 1600,
          },
        }),
      });

      if (response.ok) {
        const data: any = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text === 'string' && text.trim()) {
          return removeEmojis(text);
        }
      } else if (response.status === 429 || response.status === 503) {
        geminiCircuitOpenUntil = Date.now() + 60_000;
        break;
      } else if (response.status === 400 || response.status === 401 || response.status === 403) {
        break;
      }
    } catch {
      // Fall through cleanly to offline triage checklist
    }
  }
  return null;
}

export async function analyzeAlpineImage(params: {
  cleanBase64: string;
  detectedMimeType: SupportedTriageMimeType;
  imageBytes: number;
  question?: string;
  trailId?: string;
}): Promise<ImageTriageResponsePayload> {
  const cleanQuestion = removeEmojis(params.question || '')
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800);
  const effectiveQuestion = cleanQuestion || 'Phân tích ảnh thực địa này và tư vấn an toàn trekking.';
  const normalizedQ = normalizeSearchText(effectiveQuestion);
  const category = classifyImageTriageCategory(normalizedQ);

  const availableTrails = await getAllAvailableTrails();
  const activeTrail = params.trailId ? availableTrails.find((t) => t.id === params.trailId) : undefined;

  const safetyDisclaimer =
    category === 'flora_mushroom'
      ? 'Cảnh báo an toàn: Không bao giờ khẳng định nấm/lá rừng ăn được chỉ từ hình ảnh. Tuyệt đối không ăn thử thực vật rừng lạ.'
      : category === 'wildlife_snake'
      ? 'Cảnh báo an toàn: Nhận diện ảnh chỉ mang tính tham khảo; luôn giữ khoảng cách >= 2m và coi mọi vết cắn không rõ loài là tình huống y tế khẩn cấp.'
      : category === 'injury_medical'
      ? 'Cảnh báo y tế: Tư vấn sơ cứu WFA không thay thế bác sĩ. Chuyển viện hoặc gọi 115/112 ngay khi có dấu hiệu nặng.'
      : 'Lưu ý: Phân tích hình ảnh thực địa mang tính tham khảo hỗ trợ quyết định an toàn leo núi.';

  const actions: RichAiAssistantAction[] = [];
  const triageCard = buildPhotoMedicalTriageCard(category, normalizedQ, activeTrail);
  if (triageCard) {
    actions.push({ type: 'first_aid_triage', triageData: triageCard });
  }

  const followUps: string[] =
    category === 'wildlife_snake'
      ? ['Quy trình sơ cứu rắn độc cắn chuẩn WFA', 'Hotline cấp cứu 115 & Kiểm lâm gần nhất', 'Cách phòng tránh rắn & vắt khi đi rừng']
      : category === 'flora_mushroom'
      ? ['Cách xử trí khẩn cấp khi ngộ độc thực vật rừng', 'Hotline cấp cứu y tế 115 / 112', 'Nguồn thức ăn dự phòng an toàn khi đi rừng']
      : category === 'injury_medical'
      ? ['Kỹ thuật băng ép R.I.C.E & nẹp cố định chi', 'Túi sơ cứu WFA chuẩn cho chuyến leo núi', 'Hotline cứu hộ 112 / 114 / 115']
      : category === 'weather_cloud'
      ? [
          activeTrail ? `Đánh giá Go/No-Go hôm nay cho ${activeTrail.name}` : 'Công thức nhận biết mây giông sét & biển mây',
          'Quy tắc phòng tránh sét đánh trên đỉnh núi',
          'Checklist chống mưa lạnh & hạ thân nhiệt',
        ]
      : [
          activeTrail ? `Đánh giá Go/No-Go hôm nay cho ${activeTrail.name}` : 'Gợi ý cung trekking phù hợp cuối tuần',
          activeTrail ? `Checklist trang bị chuẩn cho ${activeTrail.name}` : 'Tiêu chuẩn chọn giày & balo leo núi',
          'Quy tắc S.T.O.P khi gặp ngã ba mất dấu',
        ];

  const visionSystemPrompt = `${SYSTEM_INSTRUCTION}

QUY TẮC BẮT BUỘC KHI PHÂN TÍCH HÌNH ẢNH THỰC ĐỊA:
1. TUYỆT ĐỐI KHÔNG khẳng định bất kỳ loại nấm rừng, lá rừng hay quả rừng nào là "ăn được / an toàn" chỉ dựa trên ảnh. Luôn khuyến cáo không ăn thử.
2. TUYỆT ĐỐI KHÔNG khẳng định chắc chắn một con rắn rừng là "vô hại" hoặc khuyên người dùng lại gần/bắt rắn. Luôn yêu cầu giữ khoảng cách >= 2m; nếu có vết cắn thì chuyển ngay sang sơ cứu WFA & gọi 115/112.
3. Với vết thương, dị ứng, phát ban hay chấn thương: chỉ hướng dẫn sơ cứu dã ngoại WFA ban đầu, nêu rõ dấu hiệu cờ đỏ cần chuyển viện/gọi 115 và nhấn mạnh không thay thế chẩn đoán bác sĩ.
4. Nếu ảnh là mây/thời tiết, đường mòn hay trang bị (giày, balo, lều): phân tích chi tiết, sắc bén theo điều kiện địa hình & khí hậu Việt Nam.
5. Trả lời bằng tiếng Việt ngắn gọn, gạch đầu dòng rõ ràng, TUYỆT ĐỐI KHÔNG dùng emoji.${
    activeTrail
      ? `\n\n[CUNG ĐƯỜNG ĐANG MỞ]: ${sanitizePromptContextText(activeTrail.name, 100)} (${sanitizePromptContextText(activeTrail.province, 60)}, đỉnh ${activeTrail.maxAltitudeM}m, độ khó ${activeTrail.difficultyLevel}/5, cứu hộ ${sanitizePromptContextText(activeTrail.rescueContact?.phone || '112 / 114', 60)}).`
      : ''
  }`;

  const geminiVisionText = await generateMultimodalWithGemini({
    cleanBase64: params.cleanBase64,
    mimeType: params.detectedMimeType,
    prompt: effectiveQuestion,
    systemText: visionSystemPrompt,
  });

  actions.push({ type: 'quick_reply', suggestions: followUps });

  if (geminiVisionText) {
    return {
      reply: `${geminiVisionText}\n\n> **Lưu ý an toàn:** ${safetyDisclaimer}`,
      actions,
      modelUsed: 'gemini-live',
      triageCategory: category,
      safetyDisclaimer,
      contextUsed: {
        trailId: activeTrail?.id,
        trailName: activeTrail?.name,
        imageBytes: params.imageBytes,
        detectedMimeType: params.detectedMimeType,
        geminiVisionUsed: true,
      },
    };
  }

  // Honest, high-value Vietnamese visual triage checklist when Gemini Vision key is unavailable
  const kbSize = Math.max(1, Math.round(params.imageBytes / 1024));
  let offlineReply = '';

  if (category === 'wildlife_snake') {
    offlineReply = `**PHÂN LOẠI AN TOÀN RẮN / ĐỘNG VẬT RỪNG (CHẾ ĐỘ NGOẠI TUYẾN — ĐÃ NHẬN ẢNH ${kbSize} KB):**\n\nHiện máy chủ chưa kích hoạt mô hình thị giác Gemini Live, vì vậy **LOST AI không suy đoán loài rắn từ ảnh** để đảm bảo an toàn tuyệt đối cho bạn.\n\n- **Giữ khoảng cách >= 2m ngay lập tức**: Rút lui chậm rãi, không chọc gậy, không cố bắt hay lại gần chụp cận cảnh.\n- **Quan sát an toàn từ xa (nếu cần báo bác sĩ khi có sự cố)**: Ghi nhớ màu sắc tổng thể, hoa văn thân (khoang ngang/sọc dọc/xanh lục đuôi đỏ) và hình dạng đầu (tam giác hay thuôn).\n- **Nếu có người bị cắn**: Thực hiện đúng thẻ sơ cứu WFA bên dưới (bất động chi thấp hơn tim, không rạch hút nọc, gọi ngay **115 / 112**).`;
  } else if (category === 'flora_mushroom') {
    offlineReply = `**CẢNH BÁO AN TOÀN NẤM & THỰC VẬT RỪNG (CHẾ ĐỘ NGOẠI TUYẾN — ĐÃ NHẬN ẢNH ${kbSize} KB):**\n\n**TUYỆT ĐỐI KHÔNG ăn thử hay nếm nấm/quả rừng lạ** (kể cả khi máy chủ có mô hình thị giác AI, nhận diện ảnh không bao giờ đủ căn cứ khẳng định nấm rừng an toàn).\n\n- **Đặc điểm cảnh báo nấm độc thường gặp tại rừng Việt Nam**: Có bao gốc (volva) ở chân cuống, vòng cuống rõ, phiến nấm màu trắng tinh, hoặc nấm màu sặc sỡ / tiết nhựa khi bẻ.\n- **Xử trí nếu ai đó đã ăn phải**: Giữ nguyên ảnh & mẫu nấm cho bác sĩ chống độc, đưa tới bệnh viện gần nhất ngay và xem thẻ **WFA Ngộ Độc** kèm hotline **115 / 112** bên dưới.`;
  } else if (category === 'injury_medical') {
    offlineReply = `**CHECKLIST ĐÁNH GIÁ SƠ CỨU THỰC ĐỊA WFA (CHẾ ĐỘ NGOẠI TUYẾN — ĐÃ NHẬN ẢNH ${kbSize} KB):**\n\nMáy chủ hiện chưa bật thị giác AI trực tuyến, nhưng bạn hãy kiểm tra nhanh 4 điểm sau đối chiếu với ảnh thực tế và làm theo thẻ sơ cứu bên dưới:\n\n1. **Mức độ chảy máu / sưng nề**: Có chảy máu thành tia không cầm sau 10 phút ép chặt không? Có biến dạng trục xương hoặc không thể đặt chân xuống đất không?\n2. **Tuần hoàn đầu chi (CSM)**: Đầu ngón tay/chân phía dưới vết thương có còn ấm hồng, cử động được và còn cảm giác không?\n3. **Dấu hiệu dị ứng / phản vệ**: Nổi mề đay lan rộng, sưng môi/mắt, khàn giọng hoặc khó thở -> **Cấp cứu 115 / 112 ngay lập tức**.\n4. **Vệ sinh vô trùng**: Rửa bằng nước muối sinh lý/nước sạch, tuyệt đối không đắp lá rừng hay bùn đất.`;
  } else if (category === 'weather_cloud') {
    offlineReply = `**HƯỚNG DẪN ĐỌC MÂY & THỜI TIẾT NÚI CAO (CHẾ ĐỘ NGOẠI TUYẾN — ĐÃ NHẬN ẢNH ${kbSize} KB):**\n\nMáy chủ hiện đang chạy chế độ tri thức ngoại tuyến (chưa bật Gemini Vision). Bạn đối chiếu nhanh ảnh bầu trời vừa chụp theo 3 mẫu chuẩn khí tượng núi Việt Nam:\n\n- **Mây vũ tích dạng tháp đen/đỉnh đe (Cumulonimbus)**: Nguy cơ mưa giông và sét đánh cực cao trong 15–30 phút tới -> **Rút ngay khỏi đỉnh trọc & sống núi**.\n- **Biển mây tầng thấp phủ kín thung lũng, trời trên đỉnh quang xanh**: Tín hiệu săn mây lý tưởng (thường đạt đỉnh từ 05:30–07:30 khi độ ẩm > 85% và gió < 15 km/h).\n- **Sương mù trắng đục tầm nhìn < 20m kèm gió giật**: Bám sát tracklog GPX Offline, bật đèn pin chế độ nhấp nháy và không tách lẻ khỏi đoàn.`;
  } else {
    offlineReply = `**TRỢ LÝ PHÂN TÍCH ẢNH THỰC ĐỊA (CHẾ ĐỘ NGOẠI TUYẾN — ĐÃ NHẬN ẢNH ${kbSize} KB):**\n\nHệ thống đã tiếp nhận ảnh nén hợp lệ (${params.detectedMimeType}, ${kbSize} KB), tuy nhiên máy chủ hiện chưa cấu hình khóa thị giác **Gemini Live** để đọc trực tiếp chi tiết điểm ảnh.\n\nBạn có thể mô tả ngắn thêm 1 dòng (ví dụ: *"rắn xanh đuôi đỏ"*, *"nấm trắng mọc trên gỗ mục"*, *"mây đen trên đỉnh ${activeTrail?.name || 'Fansipan'}"*, hoặc *"kiểm tra giày & balo"*) để **LOST AI** tra cứu ngay phác đồ sơ cứu WFA, Go/No-Go hoặc kiểm toán balo chuẩn xác nhất!\n\n> **Lưu ý an toàn:** ${safetyDisclaimer}`;
  }

  return {
    reply: offlineReply,
    actions,
    modelUsed: 'lost-knowledge-engine',
    triageCategory: category,
    safetyDisclaimer,
    contextUsed: {
      trailId: activeTrail?.id,
      trailName: activeTrail?.name,
      imageBytes: params.imageBytes,
      detectedMimeType: params.detectedMimeType,
      geminiVisionUsed: false,
    },
  };
}

/**
 * Contextual Quick Prompts based on current trail & page view
 */
export function getContextualQuickPrompts(currentTrail?: { name?: string; province?: string; pageView?: string }): string[] {
  if (currentTrail?.name) {
    return [
      `Đánh giá sẵn sàng trước khi đi ${currentTrail.name}`,
      `Đánh giá Go/No-Go hôm nay cho ${currentTrail.name}`,
      `Tính giờ quay đầu & kế hoạch tốc độ leo ${currentTrail.name}`,
      `Tính nước uống, Oresol & khẩu phần ăn leo ${currentTrail.name}`,
      `Hotline cứu hộ & Thủ tục giấy phép tại ${currentTrail.province || currentTrail.name}`,
    ];
  }

  if (currentTrail?.pageView === 'contribute') {
    return [
      'Cách chuẩn bị file GPX chuẩn trước khi đóng góp cung đường',
      'Phân loại độ khó 1 đến 5 theo địa hình Việt Nam',
      'Tiêu chuẩn kiểm duyệt thông tin trạm kiểm lâm & cứu hộ',
      'Quy tắc 7 nguyên tắc Leave No Trace',
    ];
  }

  if (currentTrail?.pageView === 'forum') {
    return [
      'Quy chuẩn thuê Porter & chia chi phí ghép đoàn',
      'Gợi ý cung săn mây đẹp cho người mới',
      'Kế hoạch tập thể lực 4 tuần trước khi leo núi',
      'Cấp cứu khẩn cấp: Sốc độ cao (AMS) & Lạc đường',
    ];
  }

  return [
    'Gợi ý cung săn mây đẹp cho người mới bắt đầu',
    'Tính lượng nước, Oresol & khẩu phần ăn leo Fansipan',
    'Tính giờ quay đầu & kế hoạch tốc độ leo Tà Xùa',
    'Checklist đồ dùng sinh tồn & Balo leo núi 2N1Đ',
    'Cấp cứu khẩn cấp: Sốc độ cao (AMS) & Lạc đường',
  ];
}
