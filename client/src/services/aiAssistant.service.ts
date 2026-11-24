import { mockTrails } from '../data/seedData.js';
import { VIETNAM_RANGER_STATIONS } from '../data/vietnamDirectory.js';
import { getApiHeaders } from '../utils/sessionHeaders.js';
import { scopedStorageKey } from '../utils/storageScope.js';
import { haversineMeters } from '../utils/geoMath.js';
import { computeClientBioMetrics } from '../utils/gpxParser.js';
import type { Trail } from '../types.js';
import {
  extractPrimaryDialNumber,
  type AiChatThreadSummary,
  type AiEngineMode,
  type AiFitnessLevel,
  type AiModelUsed,
  type AiPreferredRegion,
  type BioCalcResult,
  type ExpeditionBriefBudgetLine,
  type ExpeditionBriefGearItem,
  type ExpeditionBriefInput,
  type ExpeditionBriefRangerInfo,
  type ExpeditionBriefResult,
  type FuelPlanInput,
  type FuelPlanResult,
  type GoNoGoAssessmentData,
  type GpxAnalysisResult,
  type ImageTriageRequestPayload,
  type ImageTriageResponsePayload,
  type LocalAiThreadRecord,
  type PackAuditInput,
  type PackAuditMissingItem,
  type PackAuditResult,
  type PacePlanInput,
  type PacePlanResult,
  type ReadinessAuditInput,
  type ReadinessAuditResult,
  type RichAiAction,
  type StructuredItineraryStep,
  type TrailCompareData,
  type TrailCompareInput,
  type TrailCompareItem,
  type TrailMatchResultItem,
  type TrailRecommendInput,
  type TrailRecommendResponse,
  type VerifiedEmergencyContact,
} from '../components/ai-assistant/ai.types.js';

const API_BASE = '/api/ai';
const LOCAL_THREADS_STORAGE_KEY = 'lost_ai_threads_v2';
const PENDING_PROMPT_STORAGE_KEY = 'lost_ai_pending_prompt';

export interface ChatPayload {
  message: string;
  threadId?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  engineMode?: AiEngineMode;
  userName?: string;
  context?: {
    pageView?: string;
    trailId?: string;
    trailName?: string;
    province?: string;
    maxAltitudeM?: number;
    difficultyLevel?: number;
    userCoordinates?: { lat: number; lng: number };
    preferredRegion?: AiPreferredRegion;
  };
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
}

export interface ChatResponse {
  threadId?: string;
  reply: string;
  actions?: RichAiAction[];
  modelUsed: AiModelUsed;
  contextUsed?: {
    trailId?: string;
    trailName?: string;
    pageView?: string;
    weatherLive: boolean;
    activeIncidentsCount: number;
    userProfileApplied: boolean;
  };
  rateLimited?: boolean;
  errorStatus?: number;
}

/**
 * Strips all emoji characters while preserving Markdown line indentation (Rule 12).
 */
export function removeEmojis(str: string): string {
  if (!str) return '';
  return str
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu,
      ''
    )
    .replace(/\u200D|\uFE0F/g, '')
    .replace(/([^\s])[ \t]{2,}/g, '$1 ')
    .trim();
}

export function removeVietnameseDiacritics(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function normalizeAscii(str: string): string {
  return removeVietnameseDiacritics(str)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasWholeWordPhrase(normalized: string, phrase: string): boolean {
  const p = normalizeAscii(phrase);
  if (!p || !normalized) return false;
  return ` ${normalized} `.includes(` ${p} `);
}

// 100% Verified Official Vietnam National Park & National Emergency Hotlines (Rule 11)
export const FALLBACK_EMERGENCY_CONTACTS: VerifiedEmergencyContact[] = [
  {
    name: 'Tổng đài Tìm kiếm Cứu nạn Quốc gia (24/7)',
    phone: '112',
    dialNumber: '112',
    rangerContact: '114 (PCCC & CNCH) / 115 (Cấp cứu) / 113 (Công an)',
    region: 'Toàn quốc',
    address: 'Miễn phí trên mọi mạng di động toàn quốc',
  },
  {
    name: 'Cảnh sát PCCC & Cứu nạn Cứu hộ',
    phone: '114',
    dialNumber: '114',
    rangerContact: '112 / 115',
    region: 'Toàn quốc',
    address: 'Ứng cứu sạt lở, lũ quét & cứu nạn địa hình',
  },
  {
    name: 'Trung tâm Cấp cứu Y tế Khẩn cấp',
    phone: '115',
    dialNumber: '115',
    rangerContact: '112 / 114',
    region: 'Toàn quốc',
    address: 'Hỗ trợ cấp cứu chấn thương & vận chuyển y tế',
  },
  {
    name: 'Ban Quản lý VQG Hoàng Liên (Fansipan, Sa Pa)',
    phone: '02143.871.494',
    dialNumber: '02143871494',
    rangerContact: '0985.834.581 (Trung tâm DL & BTSV Hoàng Liên)',
    region: 'Lào Cai - Lai Châu',
    address: 'Thị xã Sa Pa, Tỉnh Lào Cai',
  },
  {
    name: 'Ban Quản lý VQG Bạch Mã (Phú Lộc, TP. Huế)',
    phone: '0234.3871.330',
    dialNumber: '02343871330',
    rangerContact: '0836.356.669',
    region: 'Phú Lộc, TP. Huế',
    address: 'Huyện Phú Lộc, Thành phố Huế',
  },
  {
    name: 'Ban Quản lý VQG Bidoup - Núi Bà',
    phone: '0263.3502.005',
    dialNumber: '02633502005',
    rangerContact: '0947.047.449',
    region: 'Lạc Dương, Lâm Đồng',
    address: 'Xã Đạ Nhim, Huyện Lạc Dương, Tỉnh Lâm Đồng',
  },
];

/**
 * Pending prompt handoff bridge so TrailIntelligenceBar / other views can launch LOST AI with a prompt.
 */
export function queueAiAssistantPrompt(prompt: string, trailId?: string) {
  try {
    sessionStorage.setItem(PENDING_PROMPT_STORAGE_KEY, JSON.stringify({ prompt, trailId, ts: Date.now() }));
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent('lost:open-ai-assistant', { detail: { prompt, trailId } }));
}

export function consumeQueuedAiAssistantPrompt(): { prompt: string; trailId?: string } | null {
  try {
    const raw = sessionStorage.getItem(PENDING_PROMPT_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_PROMPT_STORAGE_KEY);
    const parsed = JSON.parse(raw);
    if (parsed?.prompt && Date.now() - Number(parsed.ts || 0) < 30_000) {
      return { prompt: String(parsed.prompt), trailId: parsed.trailId };
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Resolves a stable per-account localStorage scope slug so AI chat caches never leak across accounts.
 */
function resolveAiStorageScope(userId?: string | null): string {
  const explicit = typeof userId === 'string' ? userId.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) : '';
  if (explicit) return explicit;
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const token = localStorage.getItem('lost_token');
      if (token) {
        const parts = token.split('.');
        const payloadSegment = parts.length === 2 ? parts[0] : parts[1];
        if (parts.length >= 2 && payloadSegment) {
          const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
          const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
          const payload = JSON.parse(atob(padded)) as Record<string, unknown>;
          const rawId = payload.id ?? payload.userId ?? payload._id ?? payload.sub;
          if (typeof rawId === 'string' || typeof rawId === 'number') {
            const cleaned = String(rawId).trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
            if (cleaned) return cleaned;
          }
        }
      }
    } catch {
      // Fall back safely to guest scope on malformed token or restricted storage
    }
  }
  return 'guest';
}

function getScopedLocalThreadsKey(userId?: string | null): string {
  return `${LOCAL_THREADS_STORAGE_KEY}_${resolveAiStorageScope(userId)}`;
}

/**
 * LocalStorage Thread Cache Helpers (strictly per-user scoped; offline-first fallback for guests & mountain signal drops)
 */
export function loadLocalAiThreads(userId?: string | null): LocalAiThreadRecord[] {
  try {
    const raw = localStorage.getItem(getScopedLocalThreadsKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }
  return [];
}

export function saveLocalAiThreads(threads: LocalAiThreadRecord[], userId?: string | null) {
  try {
    localStorage.setItem(getScopedLocalThreadsKey(userId), JSON.stringify(threads.slice(0, 25)));
  } catch {
    // ignore quota errors
  }
}

/**
 * Priority-ordered, Accent-Insensitive Local Offline Fallback Engine (strictly brand LOST)
 */
function generateLocalFallback(
  query: string,
  currentTrail?: ChatPayload['currentTrailContext'],
  userName?: string
): ChatResponse {
  const qNorm = normalizeAscii(removeEmojis(query));
  const actions: RichAiAction[] = [];
  const displayName = userName ? userName.replace(/\s*\(.*?\)/, '').trim() : '';
  const activeTrail = currentTrail?.trailId
    ? mockTrails.find((t) => t.id === currentTrail.trailId)
    : undefined;

  // P0: EMERGENCY SOS & WFA TRIAGE (Always runs before greetings!)
  const emergencyPhrases = [
    'cuu ho', 'khan cap', 'lac duong', 'bi lac', 'soc do cao', 'ams', 'ha than nhiet',
    'ran can', 'ran doc', 'gay xuong', 'bong gan', 'lat so mi', 'set danh', 'lu quet',
    'soc nhiet', 'say nang', 'ong dot', 'sos',
  ];
  if (emergencyPhrases.some((p) => hasWholeWordPhrase(qNorm, p))) {
    const isAms = hasWholeWordPhrase(qNorm, 'soc do cao') || hasWholeWordPhrase(qNorm, 'ams');
    const isLost = hasWholeWordPhrase(qNorm, 'lac duong') || hasWholeWordPhrase(qNorm, 'bi lac');
    const isSnake = hasWholeWordPhrase(qNorm, 'ran can') || hasWholeWordPhrase(qNorm, 'ran doc');

    actions.push({
      type: 'first_aid_triage',
      triageData: {
        severity: 'critical',
        conditionCode: isAms ? 'WFA-AMS' : isLost ? 'WFA-LOST' : isSnake ? 'WFA-SNAKE' : 'WFA-SOS',
        conditionTitle: isAms
          ? 'Sốc Độ Cao Cấp Tính (AMS)'
          : isLost
          ? 'Lạc Đường / Mất Dấu (Quy Tắc S.T.O.P)'
          : isSnake
          ? 'Sơ Cứu Rắn Độc Cắn (WFA)'
          : 'Giao Thức Cứu Hộ Khẩn Cấp Thực Địa (Chế Độ Offline)',
        summary: 'Chế độ sinh tồn ngoại tuyến LOST AI — ưu tiên giữ bình tĩnh, sơ cứu đúng chuẩn và gọi/gửi SMS 2G tới 112.',
        immediateSteps: isAms
          ? ['HẠ CAO ĐỘ NGAY 300m – 500m.', 'Nghỉ kín gió, giữ ấm cổ ngực, nhấp nước ấm pha Oresol.']
          : isLost
          ? ['S — Dừng lại ngay, không đi tiếp vào rừng.', 'T/O — Tìm điểm cao thoáng bắt sóng, không đi xuống khe suối cạn.', 'P — Thổi còi 3 hồi ngắn / gửi SMS 2G kèm GPS về 112.']
          : isSnake
          ? ['Đặt nạn nhân nằm yên, cố định chi bị cắn THẤP HƠN TIM.', 'Băng ép thun đàn hồi nhẹ từ đầu chi lên trên và cáng đi viện ngay.']
          : ['Giữ ấm, bảo toàn năng lượng và bật định vị GPS.', 'Gọi 112 / 114 / 115 hoặc bấm Soạn SMS 2G ngay bên dưới.'],
        forbiddenActions: isSnake
          ? ['CẤM rạch da, CẤM hút nọc bằng miệng, CẤM đắp lá, CẤM garo chặt.']
          : ['KHÔNG tự tách đoàn di chuyển trong đêm tối hoặc sương mù dày.'],
        whenToEvacuate: ['Bất kỳ dấu hiệu lú lẫn, khó thở, chảy máu nặng hoặc không thể tự di chuyển.'],
        emergencyContacts: FALLBACK_EMERGENCY_CONTACTS,
        sosSmsNote: `CAN HO TRO CUU NAN KHAN CAP${activeTrail ? ` tai ${activeTrail.name}` : ''}.`,
      },
    });
    return {
      reply: `**CẤP CỨU THỰC ĐỊA (CHẾ ĐỘ NGOẠI TUYẾN LOST):**\n\nThực hiện ngay quy trình sơ cứu ưu tiên và sử dụng đường dây nóng xác thực / nút **Soạn SMS 2G kèm GPS** bên dưới.`,
      actions,
      modelUsed: 'lost-knowledge-engine',
    };
  }

  // P1A: HEAD-TO-HEAD TRAIL COMPARISON (OFFLINE)
  if (
    ['so sanh', 'tot hon', 'dep hon', 'kho hon', 'de hon', 'nen di', 'vs', 'hay'].some((p) =>
      hasWholeWordPhrase(qNorm, p)
    )
  ) {
    const offlineCompare = computeOfflineTrailCompare({
      query,
      activeTrailId: activeTrail?.id,
    });
    if (offlineCompare) {
      return {
        reply: `**SO SÁNH ĐỐI ĐẦU (NGOẠI TUYẾN) — ${offlineCompare.trails.map((t) => t.name).join(' VS ').toUpperCase()}:**\n\n${offlineCompare.summaryVerdict}\n\n- **Người mới**: **${offlineCompare.beginnerPick.name}** — ${offlineCompare.beginnerPick.reason}\n- **Trekker kinh nghiệm**: **${offlineCompare.veteranPick.name}** — ${offlineCompare.veteranPick.reason}`,
        actions: [
          { type: 'trail_compare_card', compareData: offlineCompare },
          {
            type: 'quick_reply',
            suggestions: [
              `Đánh giá Go/No-Go ${offlineCompare.trails[0].name}`,
              `Đánh giá Go/No-Go ${offlineCompare.trails[1].name}`,
              `Checklist trang bị cho ${offlineCompare.beginnerPick.name}`,
            ],
          },
        ],
        modelUsed: 'lost-knowledge-engine',
      };
    }
  }

  // P1: BIO-CALCULATOR
  if (['naismith', 'tobler', 'mat bao lau', 'bao nhieu lit nuoc', 'tinh calo', 'balo nang'].some((p) => hasWholeWordPhrase(qNorm, p))) {
    const bio = computeClientBioMetrics({
      trailName: activeTrail?.name,
      distanceKm: activeTrail?.distanceKm ?? 14,
      elevationGainM: activeTrail?.elevationGainM ?? 850,
      maxAltitudeM: activeTrail?.maxAltitudeM ?? 2000,
      bodyWeightKg: 62,
      packWeightKg: 8,
      fitnessLevel: 'intermediate',
      durationDays: activeTrail?.durationDays ?? 2,
    });
    return {
      reply: `**TÍNH TOÁN SINH HỌC LEO NÚI (OFFLINE):**\n\n- **Thời gian di chuyển**: **${bio.recommendedMovingHours} giờ** (Naismith ${bio.naismithHours}h | Tobler ${bio.toblerHours}h).\n- **Nước uống**: **${bio.waterLitersTotal}L** + **${bio.oresolPackets} gói Oresol**.\n- **Năng lượng**: **${bio.caloriesActiveKcal.toLocaleString()} kcal**.\n\n*Điều chỉnh cân nặng & balo trực tiếp ở thẻ tương tác bên dưới!*`,
      actions: [{ type: 'bio_calculator', trailId: activeTrail?.id, trailName: activeTrail?.name, bioCalcData: bio }],
      modelUsed: 'lost-knowledge-engine',
    };
  }

  // P2: GEAR CHECKLIST (Whole-word safe — won't hijack "bản đồ")
  if (['checklist', 'trang bi', 'xep balo', 'chuan bi do', 'mang theo gi', 'do leo nui'].some((p) => hasWholeWordPhrase(qNorm, p))) {
    actions.push({
      type: 'gear_checklist',
      trailId: activeTrail?.id,
      trailName: activeTrail?.name,
      checklistItems: [
        {
          category: 'Trang phục & Giữ nhiệt (Quy tắc 3 lớp)',
          items: [
            { name: 'Áo thun thoát mồ hôi (Base Layer) x2', weightGrams: 300, isEssential: true, targetCategory: 'Trang phục' },
            { name: 'Áo nỉ / lông vũ giữ nhiệt (Mid Layer)', weightGrams: 420, isEssential: true, targetCategory: 'Trang phục' },
            { name: 'Áo gió chống thấm (Outer Shell) + Áo mưa bộ', weightGrams: 450, isEssential: true, targetCategory: 'Trang phục' },
            { name: 'Quần trekking nhanh khô + Tất len Merino x3 đôi', weightGrams: 450, isEssential: true, targetCategory: 'Trang phục' },
          ],
        },
        {
          category: 'Di chuyển & An toàn sinh tồn',
          items: [
            { name: 'Giày trekking cổ lửng đế gai sâu', weightGrams: 850, isEssential: true, targetCategory: 'Trang phục' },
            { name: 'Cặp gậy trekking hợp kim nhôm', weightGrams: 500, isEssential: true, targetCategory: 'Trang phục' },
            { name: 'Đèn pin đội đầu + Pin dự phòng', weightGrams: 200, isEssential: true, targetCategory: 'Điện tử' },
            { name: 'Túi nước 2–3L + Viên lọc Aquatabs / Oresol', weightGrams: 320, isEssential: true, targetCategory: 'Ăn uống & Nước' },
            { name: 'Hộp sơ cứu cá nhân + Thuốc chống vắt DEP + Còi SOS', weightGrams: 350, isEssential: true, targetCategory: 'Y tế & An toàn' },
          ],
        },
      ],
    });
    return {
      reply: `**CHECKLIST TRANG BỊ LEO NÚI CHUẨN LOST:**\n\n- **Giới hạn tải trọng**: Tối đa **18% – 20% thể trọng**.\n- **Xếp balo 3 tầng**: Đáy (túi ngủ) -> Giữa sát lưng (nước/thực phẩm) -> Đỉnh (áo mưa/đèn pin/sơ cứu).`,
      actions,
      modelUsed: 'lost-knowledge-engine',
    };
  }

  // P3: GREETING (Strictly brand LOST)
  if (
    ['chao', 'hi', 'hello', 'xin chao', 'alo', 'ban la ai'].some((p) => hasWholeWordPhrase(qNorm, p)) &&
    qNorm.split(' ').length <= 7
  ) {
    const greetingName = displayName ? `**${displayName}**` : 'bạn';
    return {
      reply: `**Chào ${greetingName}!** Rất vui được đồng hành cùng bạn trên **LOST**.\n\nEm là **LOST AI** — Trợ lý Thám hiểm & Sinh tồn Núi cao Việt Nam (đang hoạt động ở chế độ dự phòng ngoại tuyến).\n\nEm có thể hỗ trợ bạn:\n- **Xếp hạng cung đường** theo thể lực & mùa đẹp.\n- **Tính thời gian Naismith/Tobler, nước uống & calo**.\n- **Sơ cứu khẩn cấp WFA & Hotline xác thực** 112 / 114 / 115 / VQG.\n- **Phân tích file GPX** trực tiếp ngay cả khi mất sóng.`,
      actions: [
        {
          type: 'quick_reply',
          suggestions: [
            'Gợi ý cung săn mây cho người mới',
            'Tính thời gian & lượng nước leo núi',
            'Checklist Balo 2N1Đ',
            'Cấp cứu khẩn cấp: Sốc độ cao & Lạc đường',
          ],
        },
      ],
      modelUsed: 'lost-knowledge-engine',
    };
  }

  // P4: TRAIL MATCHING FALLBACK (capped to top 3)
  const matched = mockTrails.filter((t) => {
    const nameNorm = normalizeAscii(t.name);
    const provNorm = normalizeAscii(t.province);
    return hasWholeWordPhrase(qNorm, nameNorm) || hasWholeWordPhrase(qNorm, provNorm) || qNorm.split(' ').some((w) => w.length >= 4 && nameNorm.includes(w));
  });
  const chosen = (matched.length > 0 ? matched : activeTrail ? [activeTrail] : mockTrails.slice(0, 3)).slice(0, 3);

  actions.push({
    type: 'ranked_trails',
    rankedTrails: chosen.map((t, i) => ({
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
      matchScore: Math.max(70, 92 - i * 6),
      matchReasons: [`${t.maxAltitudeM.toLocaleString()}m • ${t.distanceKm} km`, `Cấp ${t.difficultyLevel}/5 (${t.durationHoursNote})`],
      seasonStatus: 'ok',
    })),
  });

  return {
    reply: `**GỢI Ý CUNG ĐƯỜNG THỰC ĐỊA (DỮ LIỆU OFFLINE LOST):**\n\n${chosen
      .map(
        (t, idx) =>
          `**${idx + 1}. ${t.name}** — **${t.maxAltitudeM.toLocaleString()}m** | ${t.distanceKm} km (${t.durationHoursNote}) | ${t.province}`
      )
      .join('\n')}\n\n*Chọn thẻ bên dưới để mở bản đồ 3D DEM và dữ liệu chi tiết.*`,
    actions,
    modelUsed: 'lost-knowledge-engine',
  };
}

/**
 * Send chat message to LOST AI (sends Auth + Session headers, 15s timeout, honest 429/400 handling).
 */
export async function sendAiMessage(payload: ChatPayload, signal?: AbortSignal): Promise<ChatResponse> {
  const timeoutCtrl = new AbortController();
  const timer = setTimeout(() => timeoutCtrl.abort(), 16_000);
  const onExternalAbort = () => timeoutCtrl.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      signal: timeoutCtrl.signal,
      body: JSON.stringify(payload),
    });

    if (res.status === 429) {
      const json = await res.json().catch(() => ({}));
      return {
        reply:
          json?.message ||
          'Bạn đang gửi câu hỏi quá nhanh. Vui lòng đợi ít phút trước khi tiếp tục trò chuyện với LOST AI.',
        actions: [],
        modelUsed: 'lost-knowledge-engine',
        rateLimited: true,
        errorStatus: 429,
      };
    }

    if (res.status === 400) {
      const json = await res.json().catch(() => ({}));
      return {
        reply: json?.message || 'Nội dung câu hỏi chưa hợp lệ (kiểm tra độ dài tối đa 1.500 ký tự).',
        actions: [],
        modelUsed: 'lost-knowledge-engine',
        errorStatus: 400,
      };
    }

    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return {
          ...json.data,
          reply: removeEmojis(json.data.reply),
        };
      }
    }
  } catch (error: unknown) {
    if (signal?.aborted) {
      throw new DOMException('Request aborted by user', 'AbortError');
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    console.warn('[LOST AI] Network/server unavailable, using offline engine:', errMsg);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  return generateLocalFallback(payload.message, payload.currentTrailContext || payload.context, payload.userName);
}

/**
 * Wave 8A SSE Streaming Chat Consumer (`POST /api/ai/chat/stream`).
 * Emits progressive `onDelta(chunk)` updates and resolves final `ChatResponse` (actions + threadId + modelUsed).
 * Automatically falls back to `sendAiMessage` if SSE is unavailable or interrupted before completion.
 */
export async function sendAiMessageStream(
  payload: ChatPayload,
  opts: {
    onDelta?: (chunk: string, accumulated: string) => void;
    signal?: AbortSignal;
  } = {}
): Promise<ChatResponse> {
  const { onDelta, signal } = opts;
  const timeoutCtrl = new AbortController();
  const timer = setTimeout(() => timeoutCtrl.abort(), 22_000);
  const onExternalAbort = () => timeoutCtrl.abort();
  signal?.addEventListener('abort', onExternalAbort);

  let streamedAny = false;
  let accumulated = '';
  let finalResponse: ChatResponse | null = null;

  try {
    const res = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
      signal: timeoutCtrl.signal,
      body: JSON.stringify(payload),
    });

    if (res.status === 429) {
      const json = await res.json().catch(() => ({}));
      return {
        reply:
          json?.message ||
          'Bạn đang gửi câu hỏi quá nhanh. Vui lòng đợi ít phút trước khi tiếp tục trò chuyện với LOST AI.',
        actions: [],
        modelUsed: 'lost-knowledge-engine',
        rateLimited: true,
        errorStatus: 429,
      };
    }

    if (res.status === 400) {
      const json = await res.json().catch(() => ({}));
      return {
        reply: json?.message || 'Nội dung câu hỏi chưa hợp lệ (kiểm tra độ dài tối đa 1.500 ký tự).',
        actions: [],
        modelUsed: 'lost-knowledge-engine',
        errorStatus: 400,
      };
    }

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('text/event-stream') && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      const processEventBlock = (block: string) => {
        const lines = block.split('\n');
        let eventType = 'message';
        const dataLines: string[] = [];
        for (const rawLine of lines) {
          const line = rawLine.replace(/\r$/, '');
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
          }
        }
        const rawData = dataLines.join('\n');
        if (!rawData) return;

        try {
          const parsed = JSON.parse(rawData) as Record<string, unknown>;
          if (eventType === 'delta' && typeof parsed.chunk === 'string') {
            streamedAny = true;
            accumulated += parsed.chunk;
            onDelta?.(parsed.chunk, removeEmojis(accumulated));
          } else if (eventType === 'done') {
            finalResponse = {
              ...(parsed as unknown as ChatResponse),
              reply: removeEmojis(String(parsed.reply || accumulated)),
            };
          }
        } catch {
          // ignore malformed SSE data frame
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sepIdx = buffer.indexOf('\n\n');
          while (sepIdx !== -1) {
            const block = buffer.slice(0, sepIdx).trim();
            buffer = buffer.slice(sepIdx + 2);
            if (block) processEventBlock(block);
            sepIdx = buffer.indexOf('\n\n');
          }
        }
        if (buffer.trim()) {
          processEventBlock(buffer.trim());
        }
      } finally {
        reader.cancel().catch(() => {});
      }

      if (finalResponse) return finalResponse;
      if (streamedAny && accumulated.trim()) {
        return {
          reply: removeEmojis(accumulated),
          actions: [],
          modelUsed: 'lost-knowledge-engine',
        };
      }
    }
  } catch (error: unknown) {
    if (signal?.aborted) {
      throw new DOMException('Request aborted by user', 'AbortError');
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    console.warn('[LOST AI] SSE stream fallback to standard /chat:', errMsg);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  return sendAiMessage(payload, signal);
}

export async function fetchQuickPrompts(opts?: {
  name?: string;
  province?: string;
  pageView?: string;
}): Promise<string[]> {
  try {
    const query = new URLSearchParams();
    if (opts?.name) query.append('trailName', opts.name);
    if (opts?.province) query.append('province', opts.province);
    if (opts?.pageView) query.append('pageView', opts.pageView);

    const res = await fetch(`${API_BASE}/quick-prompts?${query.toString()}`, {
      headers: getApiHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data.map(removeEmojis);
      }
    }
  } catch {
    // Fallback below
  }

  if (opts?.name) {
    return [
      `Đánh giá sẵn sàng trước khi đi ${opts.name}`,
      `Đánh giá Go/No-Go hôm nay cho ${opts.name}`,
      `Tính giờ quay đầu & kế hoạch tốc độ leo ${opts.name}`,
      `Tính nước uống, Oresol & khẩu phần ăn leo ${opts.name}`,
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

// =========================================================================
// PERSISTENT MULTI-TURN THREAD APIs
// =========================================================================

export async function fetchAiThreadsApi(): Promise<AiChatThreadSummary[] | null> {
  try {
    const res = await fetch(`${API_BASE}/threads`, {
      headers: getApiHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) return json.data;
  } catch {
    // offline
  }
  return null;
}

export async function fetchAiThreadDetailApi(threadId: string): Promise<{
  id: string;
  title: string;
  pinned: boolean;
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; modelUsed?: AiModelUsed; actions?: RichAiAction[]; createdAt?: string }>;
} | null> {
  try {
    const res = await fetch(`${API_BASE}/threads/${encodeURIComponent(threadId)}`, {
      headers: getApiHeaders(),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && json.data) return json.data;
  } catch {
    // offline
  }
  return null;
}

export async function updateAiThreadApi(threadId: string, patch: { title?: string; pinned?: boolean }): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/threads/${encodeURIComponent(threadId)}`, {
      method: 'PATCH',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(patch),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteAiThreadApi(threadId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/threads/${encodeURIComponent(threadId)}`, {
      method: 'DELETE',
      headers: getApiHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// =========================================================================
// ALPINE TOOL APIs (GPX Analyzer, Bio-Calc, Go/No-Go)
// =========================================================================

export async function analyzeGpxApi(params: {
  fileName: string;
  points: Array<[number, number, number | null]>;
  bodyWeightKg?: number;
  packWeightKg?: number;
  fitnessLevel?: AiFitnessLevel;
  threadId?: string;
}): Promise<{ analysis: GpxAnalysisResult; reply: string; actions: RichAiAction[]; threadId?: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/analyze-gpx`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && json.data) return json.data;
  } catch {
    // fallback handled by caller via client-side gpxParser offlineAnalysis
  }
  return null;
}

export async function computeBioCalcApi(params: {
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
}): Promise<BioCalcResult> {
  try {
    const res = await fetch(`${API_BASE}/bio-calc`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) return json.data;
    }
  } catch {
    // Instant client fallback
  }
  return computeClientBioMetrics(params);
}

export async function assessGoNoGoApi(
  trailId: string,
  departureDate?: string,
  signal?: AbortSignal
): Promise<GoNoGoAssessmentData> {
  const res = await fetch(`${API_BASE}/go-no-go`, {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    signal,
    body: JSON.stringify({ trailId, departureDate }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Không thể chạy đánh giá Go/No-Go lúc này.');
  }
  return json.data;
}

/**
 * 1-Click Apply Gear Checklist items into trail's GearChecklistTab localStorage + Cloud PUT sync.
 * When logged in, ALWAYS fetches GET /api/gear-checklists/:trailId FIRST and merges with existing cloud items
 * before issuing PUT so an existing cloud checklist is NEVER wiped!
 */
export async function applyGearItemsToTrailChecklist(
  trailId: string,
  trailName: string,
  newItems: Array<{
    name: string;
    weightGrams?: number;
    category?: string;
    isEssential?: boolean;
    reason?: string;
  }>,
  options?: { bodyWeightKg?: number; durationDays?: number }
): Promise<{ addedCount: number; cloudSynced: boolean }> {
  const legacyKey = `lost_checklist_${trailId}`;
  const storageKey = scopedStorageKey(legacyKey);
  const hasAuthToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('lost_token'));

  const readLocalChecklist = (): Array<Record<string, unknown>> => {
    try {
      const raw = localStorage.getItem(storageKey) ?? localStorage.getItem(legacyKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  };

  let existing: Array<Record<string, unknown>>;
  let canSafePutCloud = false;
  let existingCloudTitle: string | undefined;
  let existingCloudBodyWeight: number | undefined;
  let existingCloudDays: number | undefined;

  if (hasAuthToken) {
    try {
      const getRes = await fetch(`/api/gear-checklists/${encodeURIComponent(trailId)}`, {
        headers: getApiHeaders(),
        signal: AbortSignal.timeout(6000),
      });
      if (getRes.ok) {
        const getJson = await getRes.json().catch(() => ({}));
        const cloudDoc = getJson?.success && getJson?.data ? getJson.data : null;
        if (cloudDoc && Array.isArray(cloudDoc.items)) {
          existing = cloudDoc.items as Array<Record<string, unknown>>;
          if (typeof cloudDoc.title === 'string' && cloudDoc.title.trim()) existingCloudTitle = cloudDoc.title.trim();
          if (typeof cloudDoc.bodyWeightKg === 'number' && Number.isFinite(cloudDoc.bodyWeightKg)) {
            existingCloudBodyWeight = cloudDoc.bodyWeightKg;
          }
          if (typeof cloudDoc.createdForDays === 'number' && Number.isFinite(cloudDoc.createdForDays)) {
            existingCloudDays = cloudDoc.createdForDays;
          }
          canSafePutCloud = true;
        } else {
          // Authenticated GET returned empty/no checklist yet — safe to seed from local + new
          existing = readLocalChecklist();
          canSafePutCloud = true;
        }
      } else if (getRes.status === 404) {
        existing = readLocalChecklist();
        canSafePutCloud = true;
      } else {
        // Server/auth error: never blindly PUT over potentially existing cloud data
        existing = readLocalChecklist();
        canSafePutCloud = false;
      }
    } catch {
      // Offline / timeout: preserve local merge only, skip PUT to avoid wiping cloud checklist
      existing = readLocalChecklist();
      canSafePutCloud = false;
    }
  } else {
    existing = readLocalChecklist();
  }

  const existingNames = new Set(existing.map((it) => normalizeAscii(String(it?.name || ''))));
  let addedCount = 0;

  const validCategories = ['Trang phục', 'Đồ ngủ & Lán', 'Ăn uống & Nước', 'Y tế & An toàn', 'Điện tử', 'Khác'];
  const merged = [...existing];

  for (const item of newItems) {
    const cleanName = removeEmojis(item.name).trim();
    if (!cleanName) continue;
    const norm = normalizeAscii(cleanName);
    if (existingNames.has(norm)) continue;
    existingNames.add(norm);
    addedCount++;
    const cat = item.category && validCategories.includes(item.category) ? item.category : 'Y tế & An toàn';
    merged.push({
      id: `ai-${Date.now()}-${addedCount}`,
      name: cleanName,
      category: cat,
      weightGrams: item.weightGrams ?? 250,
      isEssential: item.isEssential ?? true,
      checked: true,
      reason: item.reason || 'Đề xuất từ LOST AI',
    });
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('lost:gear-checklist-updated', { detail: { trailId, items: merged } }));
  } catch {
    // ignore storage limits
  }

  let cloudSynced = false;
  if (hasAuthToken && canSafePutCloud) {
    let resolvedBodyWeight = existingCloudBodyWeight ?? 65;
    if (options?.bodyWeightKg && Number.isFinite(options.bodyWeightKg) && options.bodyWeightKg >= 30 && options.bodyWeightKg <= 180) {
      resolvedBodyWeight = Math.round(options.bodyWeightKg);
    }
    const matchedTrail = mockTrails.find((t) => t.id === trailId);
    const resolvedDays =
      options?.durationDays && Number.isFinite(options.durationDays) && options.durationDays >= 1
        ? Math.min(10, Math.round(options.durationDays))
        : existingCloudDays || matchedTrail?.durationDays || 2;

    try {
      const res = await fetch(`/api/gear-checklists/${encodeURIComponent(trailId)}`, {
        method: 'PUT',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title: existingCloudTitle || `Checklist ${trailName}`,
          bodyWeightKg: resolvedBodyWeight,
          createdForDays: resolvedDays,
          items: merged,
        }),
      });
      cloudSynced = res.ok;
    } catch {
      cloudSynced = false;
    }
  }

  return { addedCount, cloudSynced };
}

/**
 * 1-Click Apply Structured Itinerary into trail's ItineraryTab scoped localStorage (+ optional startDate & memberCount).
 */
export function applyItineraryToTrail(
  trailId: string,
  title: string,
  steps: Array<{ day: number; time: string; title: string; description: string; locationNote?: string }>,
  options?: { startDate?: string; memberCount?: number } | string
): void {
  const legacyKey = `lost_itinerary_${trailId}`;
  const storageKey = scopedStorageKey(legacyKey);
  const todayVn = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  let prevStartDate = todayVn;
  let prevMemberCount = 4;
  try {
    const raw = localStorage.getItem(storageKey) ?? localStorage.getItem(legacyKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.startDate) prevStartDate = parsed.startDate;
      if (parsed?.memberCount) prevMemberCount = parsed.memberCount;
    }
  } catch {
    // ignore
  }

  const explicitStartDate =
    typeof options === 'string'
      ? options.trim()
      : typeof options?.startDate === 'string'
        ? options.startDate.trim()
        : '';
  const explicitMembers =
    typeof options === 'object' && options?.memberCount && Number.isFinite(options.memberCount)
      ? Math.max(1, Math.min(30, Math.round(options.memberCount)))
      : undefined;

  const payload = {
    title,
    startDate: explicitStartDate || prevStartDate,
    memberCount: explicitMembers ?? prevMemberCount,
    steps,
  };
  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('lost:itinerary-updated', { detail: { trailId, itinerary: payload } }));
  } catch {
    // ignore
  }
}

// =========================================================================
// WAVE 3E: SMART TRAIL MATCHMAKER & PACK SURVIVAL AUDITOR CLIENT API + OFFLINE FALLBACK
// =========================================================================

const CLIENT_CLOUD_SLUGS = new Set([
  'trail-laothan', 'trail-taxua', 'trail-kyquansan', 'trail-fansipan', 'trail-tachinhu',
  'trail-lungcung', 'trail-nguchison', 'trail-tayconlinh', 'trail-putaleng', 'trail-pusilung',
]);

const CLIENT_WATERFALL_SLUGS = new Set([
  'trail-giengtroi', 'trail-bachma', 'trail-thack50', 'trail-nhiucosan', 'trail-nuidinh',
  'trail-cattien-bausau', 'trail-puluong', 'trail-putaleng', 'trail-bidoup', 'trail-chuyangsin',
]);

const CLIENT_DRY_SLUGS = new Set([
  'trail-muidoi', 'trail-nuichua', 'trail-badenh', 'trail-chuachan', 'trail-tanangphandung',
]);

function computeOfflineRecommendTrails(input: TrailRecommendInput, customTrails?: Trail[]): TrailRecommendResponse {
  const source = customTrails && customTrails.length > 0 ? customTrails : mockTrails;
  const poolBase = input.region !== 'all' ? source.filter((t) => t.region === input.region) : source;
  const pool = poolBase.length > 0 ? poolBase : source;
  const prefs = new Set(input.preferences);

  const matches: TrailMatchResultItem[] = pool.map((trail) => {
    let score = 54;
    const pros: string[] = [];
    const warnings: string[] = [];
    const diff = trail.difficultyLevel || 3;

    if (input.fitness === 'beginner') {
      if (diff <= 2) { score += 24; pros.push(`Độ khó cấp ${diff}/5 rất hợp người mới.`); }
      else if (diff === 3) { score += 10; pros.push('Độ khó cấp 3/5, đi tốt nếu tập thể lực 2–3 tuần.'); }
      else if (diff === 4) { score -= 18; warnings.push('Cấp 4/5 khá gắt với người mới, cần có Porter.'); }
      else { score -= 34; warnings.push('Cấp 5/5 vượt ngưỡng người mới.'); }
    } else if (input.fitness === 'intermediate') {
      if (diff === 3 || diff === 4) { score += 20; pros.push(`Cấp ${diff}/5 vừa sức thể lực trung bình - khá.`); }
      else if (diff === 2) { score += 12; }
      else if (diff === 5) { score += 4; warnings.push('Cấp 5/5 đòi hỏi tập thể lực kỹ 4 tuần.'); }
    } else if (diff >= 4) {
      score += 24;
      pros.push(`Thử thách đỉnh cao cấp ${diff}/5 (${trail.maxAltitudeM.toLocaleString()}m).`);
    }

    const days = Math.max(1, trail.durationDays || 1);
    if (input.durationDays !== 'any') {
      if (input.durationDays === 1) score += days <= 1 ? 18 : -16;
      else if (input.durationDays === 2) score += days === 2 ? 18 : days === 1 ? 8 : -14;
      else score += days >= 3 ? 20 : days === 2 ? 8 : -8;
    }

    let seasonStatus: TrailMatchResultItem['seasonStatus'] = 'ok';
    if (trail.bestMonths?.includes(input.targetMonth)) {
      seasonStatus = 'ideal';
      score += 16;
      pros.push(`Tháng ${input.targetMonth} đang vào mùa đẹp.`);
    } else if (trail.avoidMonths?.includes(input.targetMonth)) {
      seasonStatus = 'avoid';
      score -= 22;
      warnings.push(`Tháng ${input.targetMonth} là mùa mưa bão / trơn trượt cần tránh.`);
    }

    if (prefs.has('san_may')) {
      if (CLIENT_CLOUD_SLUGS.has(trail.id) || trail.maxAltitudeM >= 2200) { score += 20; pros.push('Tọa độ săn biển mây nổi bật.'); }
      else score -= 10;
    }
    if (prefs.has('high_peak_2800')) {
      if (trail.maxAltitudeM >= 2800) { score += 22; pros.push(`Đỉnh cao trên 2.800m (${trail.maxAltitudeM.toLocaleString()}m).`); }
      else score -= 16;
    }
    if (prefs.has('waterfall_forest')) {
      if (CLIENT_WATERFALL_SLUGS.has(trail.id)) { score += 20; pros.push('Rừng nguyên sinh & suối thác đặc sắc.'); }
      else if (!trail.hasWaterSource) score -= 8;
    }
    if (prefs.has('kid_friendly')) {
      if (trail.kidFriendly) { score += 22; pros.push('Phù hợp gia đình / trẻ nhỏ.'); }
      else { score -= 22; warnings.push('Địa hình không phù hợp trẻ nhỏ.'); }
    }
    if (prefs.has('no_permit_needed')) {
      if (!trail.permitRequired) { score += 16; pros.push('Thủ tục đơn giản, không cần xin giấy phép.'); }
      else { score -= 14; warnings.push(`Cần thủ tục giấy phép (${trail.permitInfo || 'VQG / Biên phòng'}).`); }
    }

    let distanceFromUserKm: number | undefined;
    if (input.userCoordinates) {
      distanceFromUserKm = Math.round(
        haversineMeters(input.userCoordinates.lat, input.userCoordinates.lng, trail.startLat, trail.startLng) / 1000
      );
      if (distanceFromUserKm <= 100) { score += 14; pros.push(`Cách vị trí bạn chỉ ~${distanceFromUserKm} km.`); }
      else if (distanceFromUserKm <= 250) score += 7;
    }

    const permitFee = trail.permitRequired ? 200_000 : 50_000;
    const minVnd = days <= 1 ? 350_000 + permitFee : Math.round((550_000 + days * 520_000 + permitFee) / 50_000) * 50_000;
    const maxVnd = days <= 1 ? 850_000 + permitFee : Math.round((700_000 + days * 760_000 + permitFee) / 50_000) * 50_000;

    return {
      id: trail.id,
      name: trail.name,
      province: trail.province,
      district: trail.district,
      region: trail.region,
      maxAltitudeM: trail.maxAltitudeM,
      distanceKm: trail.distanceKm,
      elevationGainM: trail.elevationGainM,
      durationDays: days,
      durationHoursNote: trail.durationHoursNote,
      difficultyLevel: diff,
      difficultyNote: trail.difficultyNote || '',
      permitRequired: Boolean(trail.permitRequired),
      kidFriendly: Boolean(trail.kidFriendly),
      hasWaterSource: Boolean(trail.hasWaterSource),
      hasCampsite: Boolean(trail.hasCampsite),
      coverImage: trail.coverImage,
      bestMonths: trail.bestMonths || [],
      avoidMonths: trail.avoidMonths || [],
      matchScore: Math.max(15, Math.min(99, Math.round(score))),
      seasonStatus,
      pros: pros.length > 0 ? pros.slice(0, 3) : [`${trail.maxAltitudeM}m · ${trail.distanceKm} km · ${trail.province}`],
      warnings: warnings.slice(0, 3),
      activeIncidentsCount: 0,
      distanceFromUserKm,
      estimatedBudgetRangeVnd: {
        min: minVnd,
        max: maxVnd,
        note: days <= 1 ? 'Tự túc trong ngày' : `Dự toán ${days}N${days - 1}Đ tự túc chia nhóm 3–4 người`,
      },
    };
  });

  matches.sort((a, b) => b.matchScore - a.matchScore);
  return {
    matches: matches.slice(0, 5),
    totalEvaluated: pool.length,
    targetMonth: input.targetMonth,
    summaryNote: `Đã xếp hạng ${pool.length} cung đường thực địa (chế độ tính toán ngoại tuyến) cho tháng ${input.targetMonth}.`,
  };
}

export async function recommendTrailsApi(
  input: TrailRecommendInput,
  fallbackTrails?: Trail[]
): Promise<TrailRecommendResponse> {
  try {
    const res = await fetch(`${API_BASE}/recommend`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      signal: AbortSignal.timeout(7000),
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) return json.data as TrailRecommendResponse;
    }
  } catch {
    // Offline fallback
  }
  return computeOfflineRecommendTrails(input, fallbackTrails);
}

function computeOfflinePackAudit(input: PackAuditInput, customTrails?: Trail[]): PackAuditResult {
  const source = customTrails && customTrails.length > 0 ? customTrails : mockTrails;
  const trail = source.find((t) => t.id === input.trailId) || source[0];
  const checked = input.packedItems.filter((it) => it.checked !== false && it.name.trim());
  const norms = checked.map((it) => normalizeAscii(it.name));
  const hasAny = (aliases: string[]) => norms.some((n) => aliases.some((a) => n.includes(a)));

  const summitTempMinC = trail.maxAltitudeM >= 2800 ? 4 : trail.maxAltitudeM >= 2000 ? 10 : 18;
  const bodyKg = Math.max(35, input.bodyWeightKg || 62);
  const totalGrams = checked.reduce((s, it) => s + Math.max(0, it.weightGrams || 0), 0);
  const packKg = input.packWeightKg && input.packWeightKg > 0 ? input.packWeightKg : Math.max(1, Math.round((totalGrams / 1000) * 10) / 10);
  const packRatioPercent = Math.round((packKg / bodyKg) * 1000) / 10;
  const packStatus: PackAuditResult['packStatus'] =
    packRatioPercent > 22 ? 'overweight' : packRatioPercent > 18 ? 'caution' : 'optimal';

  let score = 100;
  const criticalMissing: PackAuditMissingItem[] = [];
  const recommendedAdditions: PackAuditMissingItem[] = [];
  const weightSavingTips: string[] = [];
  const checklistHighlights: string[] = [];

  if (!hasAny(['giay', 'boot', 'vibram'])) {
    score -= 16;
    criticalMissing.push({ name: 'Giày trekking cổ lửng đế gai sâu', category: 'Trang phục', weightGrams: 850, reason: 'Chống lật sơ mi và bám đá rêu trơn.', severity: 'critical' });
  }
  if (!hasAny(['den pin', 'headlamp'])) {
    score -= 14;
    criticalMissing.push({ name: 'Đèn pin đội đầu + 2 viên pin dự phòng', category: 'Điện tử', weightGrams: 200, reason: 'Bắt buộc cho đẩy đỉnh bình minh hoặc hạ sơn tối.', severity: 'critical' });
  }
  if (!hasAny(['so cuu', 'y te', 'bang gac', 'thuoc'])) {
    score -= 14;
    criticalMissing.push({ name: 'Túi sơ cứu y tế cá nhân (gạc, băng thun, Povidine, thuốc)', category: 'Y tế & An toàn', weightGrams: 350, reason: 'Xử lý kịp thời chấn thương giữa rừng.', severity: 'critical' });
  }
  if (!hasAny(['ao mua', 'chong tham', 'poncho'])) {
    score -= 12;
    criticalMissing.push({ name: 'Áo mưa bộ 2 lớp chống thấm & Áo trùm balo', category: 'Trang phục', weightGrams: 450, reason: 'Phòng mưa rừng đột ngột gây hạ thân nhiệt.', severity: 'critical' });
  }
  if ((!trail.hasWaterSource || CLIENT_DRY_SLUGS.has(trail.id)) && !hasAny(['nuoc', 'binh', 'tui nuoc'])) {
    score -= 22;
    criticalMissing.push({ name: 'Bình / Túi nước 3–4 lít + 3 gói Oresol (Tuyến khô)', category: 'Ăn uống & Nước', weightGrams: 350, reason: 'Tuyến khô / nắng gắt thiếu nguồn nước tự nhiên.', severity: 'critical' });
  } else if (trail.hasWaterSource && !hasAny(['loc nuoc', 'sawyer', 'aquatabs'])) {
    recommendedAdditions.push({ name: 'Màng lọc nước Sawyer hoặc viên lọc Aquatabs', category: 'Ăn uống & Nước', weightGrams: 120, reason: 'Lọc nước suối dọc đường giúp giảm trọng lượng balo.', severity: 'recommended' });
  }
  if ((trail.maxAltitudeM >= 2200 || summitTempMinC <= 9) && !hasAny(['long vu', 'giu nhiet', 'ao am', 'ao ni', 'ao khoac'])) {
    score -= 16;
    criticalMissing.push({ name: 'Áo khoác lông vũ giữ ấm (-5°C) + Áo giữ nhiệt', category: 'Trang phục', weightGrams: 420, reason: `Đỉnh ${trail.maxAltitudeM}m ban đêm hạ nhiệt mạnh (~${summitTempMinC}°C).`, severity: 'critical' });
  }
  if (trail.durationDays >= 2 && !hasAny(['tui ngu', 'sleeping'])) {
    score -= 14;
    criticalMissing.push({ name: 'Túi ngủ chịu nhiệt 0°C – 5°C', category: 'Đồ ngủ & Lán', weightGrams: 1100, reason: 'Bắt buộc cho hành trình qua đêm trên núi.', severity: 'critical' });
  }
  if (trail.permitRequired && !hasAny(['cccd', 'cmnd', 'giay to', 'giay phep'])) {
    score -= 12;
    criticalMissing.push({ name: 'CCCD bản gốc + Hồ sơ đăng ký VQG / Biên phòng', category: 'Khác', weightGrams: 20, reason: trail.permitInfo || 'Bắt buộc khai báo tại trạm cửa rừng.', severity: 'critical' });
  }
  if (trail.difficultyLevel >= 4 && !hasAny(['gay trekking', 'gay leo nui', 'pole'])) {
    recommendedAdditions.push({ name: 'Cặp gậy trekking hợp kim nhôm', category: 'Trang phục', weightGrams: 500, reason: 'Giảm 25% áp lực khớp gối khi đổ dốc cấp 4–5.', severity: 'recommended' });
  }

  if (packStatus === 'overweight') {
    score -= 14;
    weightSavingTips.push(`Balo chiếm ${packRatioPercent}% thể trọng (> 22%): cắt bớt đồ không thiết yếu hoặc thuê Porter gùi đồ chung.`);
  } else if (packStatus === 'caution') {
    score -= 5;
    weightSavingTips.push(`Tỷ lệ tải ${packRatioPercent}% khá nặng (18–22%): siết đai trợ lực hông sát người.`);
  } else {
    checklistHighlights.push(`Tỷ lệ balo ${packRatioPercent}% đạt ngưỡng tối ưu.`);
  }
  if (weightSavingTips.length === 0) {
    weightSavingTips.push('Ưu tiên túi nước mềm và quần áo kỹ thuật nhanh khô thay cho cotton.');
  }

  const readinessScore = Math.max(0, Math.min(100, Math.round(score)));
  const readinessGrade: PackAuditResult['readinessGrade'] =
    criticalMissing.length === 0 && readinessScore >= 80
      ? 'SẴN SÀNG'
      : criticalMissing.length <= 2 && readinessScore >= 55
      ? 'CẦN BỔ SUNG'
      : 'THIẾU ĐỒ AN TOÀN';

  return {
    trailId: trail.id,
    trailName: trail.name,
    province: trail.province,
    maxAltitudeM: trail.maxAltitudeM,
    difficultyLevel: trail.difficultyLevel,
    durationDays: trail.durationDays,
    hasWaterSource: trail.hasWaterSource,
    hasCampsite: trail.hasCampsite,
    permitRequired: trail.permitRequired,
    summitTempMinC,
    weatherNote: `Chế độ kiểm toán ngoại tuyến theo cao độ đỉnh ${trail.maxAltitudeM.toLocaleString()}m.`,
    readinessScore,
    readinessGrade,
    packRatioPercent,
    packStatus,
    totalPackedGrams: totalGrams > 0 ? totalGrams : Math.round(packKg * 1000),
    packedCount: checked.length,
    criticalMissing,
    recommendedAdditions,
    weightSavingTips,
    checklistHighlights,
  };
}

export async function auditPackApi(input: PackAuditInput, fallbackTrails?: Trail[]): Promise<PackAuditResult> {
  try {
    const res = await fetch(`${API_BASE}/audit-pack`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      signal: AbortSignal.timeout(7000),
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) return json.data as PackAuditResult;
    }
  } catch {
    // Offline fallback
  }
  return computeOfflinePackAudit(input, fallbackTrails);
}

// =========================================================================
// WAVE 4C: HEAD-TO-HEAD TRAIL COMPARISON API + OFFLINE FALLBACK
// =========================================================================

export function computeOfflineTrailCompare(
  input: TrailCompareInput,
  fallbackTrails?: Trail[]
): TrailCompareData | null {
  const pool = fallbackTrails && fallbackTrails.length > 0 ? fallbackTrails : mockTrails;
  const picked: Trail[] = [];
  const seen = new Set<string>();

  if (Array.isArray(input.trailIds) && input.trailIds.length > 0) {
    for (const rawId of input.trailIds) {
      const found = pool.find((t) => t.id === rawId || normalizeAscii(t.name) === normalizeAscii(rawId));
      if (found && !seen.has(found.id)) {
        seen.add(found.id);
        picked.push(found);
      }
      if (picked.length >= 3) break;
    }
  }

  if (picked.length < 2 && typeof input.query === 'string' && input.query.trim()) {
    const qNorm = normalizeAscii(input.query);
    const hits: Array<{ trail: Trail; pos: number }> = [];
    for (const t of pool) {
      const aliases = [t.name, ...(t.altNames || [])].map((s) => normalizeAscii(s)).filter((a) => a.length >= 3);
      for (const alias of aliases) {
        const idx = qNorm.indexOf(alias);
        if (idx >= 0) {
          hits.push({ trail: t, pos: idx });
          break;
        }
      }
    }
    hits.sort((a, b) => a.pos - b.pos);
    for (const h of hits) {
      if (!seen.has(h.trail.id)) {
        seen.add(h.trail.id);
        picked.push(h.trail);
      }
      if (picked.length >= 3) break;
    }
    if (picked.length === 1 && input.activeTrailId && !seen.has(input.activeTrailId)) {
      const act = pool.find((t) => t.id === input.activeTrailId);
      if (act) picked.unshift(act);
    }
  }

  if (picked.length < 2) return null;

  const targetMonth = new Date().getMonth() + 1;
  const items: TrailCompareItem[] = picked.map((t) => {
    const bio = computeClientBioMetrics({
      trailName: t.name,
      distanceKm: t.distanceKm,
      elevationGainM: t.elevationGainM,
      elevationLossM: t.elevationGainM,
      maxAltitudeM: t.maxAltitudeM,
      bodyWeightKg: 62,
      packWeightKg: t.durationDays >= 2 ? 9 : 4.5,
      fitnessLevel: 'intermediate',
      durationDays: t.durationDays,
    });
    const seasonStatus: 'ideal' | 'ok' | 'avoid' = t.avoidMonths.includes(targetMonth)
      ? 'avoid'
      : t.bestMonths.includes(targetMonth)
      ? 'ideal'
      : 'ok';
    const days = Math.max(1, t.durationDays);
    const permitFee = t.permitRequired ? 200_000 : 50_000;
    const minBudget = days <= 1 ? 350_000 + permitFee : Math.round((550_000 + days * 520_000 + permitFee) / 50_000) * 50_000;
    const maxBudget = days <= 1 ? 850_000 + permitFee : Math.round((750_000 + days * 780_000 + permitFee) / 50_000) * 50_000;
    return {
      trailId: t.id,
      name: t.name,
      province: t.province,
      region: t.region,
      difficultyLevel: t.difficultyLevel,
      difficultyLabel: `Cấp ${t.difficultyLevel}/5 (${t.difficultyNote})`,
      maxAltitudeM: t.maxAltitudeM,
      distanceKm: t.distanceKm,
      elevationGainM: t.elevationGainM,
      durationDays: t.durationDays,
      durationLabel: t.durationHoursNote || `${t.durationDays} ngày`,
      naismithHours: bio.naismithHours,
      waterLitersTotal: bio.waterLitersTotal,
      permitRequired: t.permitRequired,
      permitSummary: t.permitRequired ? t.permitInfo || 'Cần giấy phép VQG / Kiểm lâm' : 'Tự do (mang CCCD gốc)',
      hasWaterSource: t.hasWaterSource,
      bestMonths: t.bestMonths,
      seasonStatus,
      activeIncidentsCount: 0,
      estimatedBudgetVnd: {
        min: minBudget,
        max: maxBudget,
        note: days <= 1 ? 'Tự túc trong ngày' : `Tự túc ${days}N${days - 1}Đ chia nhóm 3–4 người`,
      },
      highlightTag: `${t.region} · ${t.maxAltitudeM.toLocaleString()}m`,
      fitnessRecommended: t.difficultyLevel <= 2 ? 'Người mới / Gia đình' : t.difficultyLevel === 3 ? 'Trung bình' : 'Khá - Tốt',
    };
  });

  const beginnerTop = [...items].sort(
    (a, b) => a.difficultyLevel * 30 + a.elevationGainM / 120 - (b.difficultyLevel * 30 + b.elevationGainM / 120)
  )[0];
  const veteranSorted = [...items].sort(
    (a, b) => b.difficultyLevel * 28 + b.maxAltitudeM / 70 + b.elevationGainM / 35 - (a.difficultyLevel * 28 + a.maxAltitudeM / 70 + a.elevationGainM / 35)
  );
  const veteranTop = veteranSorted.find((x) => x.trailId !== beginnerTop.trailId) || veteranSorted[0];

  return {
    trails: items,
    targetMonth,
    summaryVerdict: `So sánh thực địa **${items.map((i) => i.name).join(' vs ')}**: **${beginnerTop.name}** dễ tiếp cận hơn cho người mới, trong khi **${veteranTop.name}** mang lại thử thách độ cao & độ dốc cao hơn.`,
    beginnerPick: {
      trailId: beginnerTop.trailId,
      name: beginnerTop.name,
      reason: `Độ khó cấp ${beginnerTop.difficultyLevel}/5, ~${beginnerTop.naismithHours}h di chuyển.`,
    },
    veteranPick: {
      trailId: veteranTop.trailId,
      name: veteranTop.name,
      reason: `Đỉnh ${veteranTop.maxAltitudeM.toLocaleString()}m, cự ly ${veteranTop.distanceKm} km (+${veteranTop.elevationGainM}m).`,
    },
    bestSeasonNote: `Tháng ${targetMonth} — dữ liệu ngoại tuyến; kết nối mạng để xem cảnh báo sự cố & Go/No-Go trực tuyến.`,
  };
}

export async function compareTrailsApi(
  input: TrailCompareInput,
  fallbackTrails?: Trail[]
): Promise<TrailCompareData | null> {
  try {
    const res = await fetch(`${API_BASE}/compare`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      signal: AbortSignal.timeout(7000),
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) return json.data as TrailCompareData;
    }
  } catch {
    // Offline fallback
  }
  return computeOfflineTrailCompare(input, fallbackTrails);
}

// =========================================================================
// WAVE 9C: FULL PRINTABLE PRE-TRIP EXPEDITION DOSSIER API + OFFLINE FALLBACK
// =========================================================================

function getVietnamTodayIsoClient(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  }
}

function roundTo10kClient(vnd: number): number {
  return Math.max(0, Math.round(vnd / 10_000) * 10_000);
}

export function computeOfflineExpeditionBrief(
  input: ExpeditionBriefInput,
  fallbackTrails?: Trail[]
): ExpeditionBriefResult {
  const pool = fallbackTrails && fallbackTrails.length > 0 ? fallbackTrails : mockTrails;
  const trail = pool.find((t) => t.id === input.trailId) || pool[0] || mockTrails[0];
  const departureDate = input.departureDate && /^\d{4}-\d{2}-\d{2}$/.test(input.departureDate)
    ? input.departureDate
    : getVietnamTodayIsoClient();
  const groupSize = Math.max(1, Math.min(12, Math.round(Number(input.groupSize) || 4)));
  const fitnessLevel: AiFitnessLevel =
    input.fitnessLevel === 'beginner' || input.fitnessLevel === 'advanced'
      ? input.fitnessLevel
      : 'intermediate';
  const bodyWeightKg = Math.max(35, Math.min(160, Math.round(Number(input.bodyWeightKg) || 62)));
  const packWeightKg = Math.max(
    0,
    Math.min(40, Number.isFinite(Number(input.packWeightKg)) ? Number(input.packWeightKg) : trail.durationDays >= 2 ? 9 : 4.5)
  );

  const bioMetrics = computeClientBioMetrics({
    trailName: trail.name,
    distanceKm: trail.distanceKm,
    elevationGainM: trail.elevationGainM,
    elevationLossM: trail.elevationGainM,
    maxAltitudeM: trail.maxAltitudeM,
    bodyWeightKg,
    packWeightKg,
    fitnessLevel,
    durationDays: trail.durationDays,
  });

  const matchedStation =
    VIETNAM_RANGER_STATIONS.find((s) => s.coveredTrailSlugs.includes(trail.id)) ||
    VIETNAM_RANGER_STATIONS.find(
      (s) =>
        s.province !== 'Toàn Quốc' &&
        (normalizeAscii(trail.province).includes(normalizeAscii(s.province)) ||
          normalizeAscii(s.province).includes(normalizeAscii(trail.province)))
    );

  const rangerStation: ExpeditionBriefRangerInfo = matchedStation
    ? {
        name: matchedStation.name,
        authorityType: matchedStation.authorityType,
        province: matchedStation.province,
        address: matchedStation.address,
        hotlinePhone: matchedStation.hotlinePhone,
        emergencyPhone: matchedStation.emergencyPhone,
        dialNumber: extractPrimaryDialNumber(matchedStation.hotlinePhone || matchedStation.emergencyPhone),
        permitRequired: matchedStation.permitRequired || trail.permitRequired,
        permitLeadDays: matchedStation.permitLeadDays,
        permitFeeNote: matchedStation.permitFeeNote || trail.permitInfo || 'Mang theo CCCD bản gốc khai báo tại chốt cửa rừng.',
        officeHours: matchedStation.officeHours,
        officialWebsite: matchedStation.officialWebsite,
      }
    : {
        name: trail.rescueContact?.name || `Ban Quản lý / Kiểm lâm ${trail.province}`,
        authorityType: trail.permitRequired ? 'ranger_station' : 'rescue_center',
        province: trail.province,
        address: `${trail.district}, ${trail.province}`,
        hotlinePhone: trail.rescueContact?.phone || '112',
        emergencyPhone: '112 / 114',
        dialNumber: extractPrimaryDialNumber(trail.rescueContact?.phone || '112'),
        permitRequired: trail.permitRequired,
        permitLeadDays: trail.permitRequired ? 1 : 0,
        permitFeeNote: trail.permitInfo || 'Mang theo CCCD bản gốc và lưu sẵn số cứu hộ 112 / 114.',
        officeHours: '07:00 - 17:30 (112/114 trực 24/7)',
      };

  const days = Math.max(1, Math.min(5, Math.round(trail.durationDays || 1)));
  const startLoc = `${trail.district}, ${trail.province}`;
  const campWp = trail.waypoints?.find((w) => w.type === 'campsite')?.name;
  const viewWp = trail.waypoints?.find((w) => w.type === 'viewpoint')?.name || `Đỉnh ${trail.name}`;

  const itinerarySteps: StructuredItineraryStep[] =
    days <= 1
      ? [
          { day: 1, time: '05:30', title: 'Tập kết & khai báo cửa rừng', description: `Kiểm tra nước uống, đèn pin, đồng bộ GPX Offline LOST tại ${startLoc}.`, locationNote: startLoc },
          { day: 1, time: '06:30', title: 'Khởi hành chặng leo lên', description: `Giữ nhịp bước ổn định, nhấp nước điện giải mỗi 15–20 phút.`, locationNote: `Tuyến ${trail.name}` },
          { day: 1, time: '11:00', title: `Chạm mốc ${viewWp}`, description: `Nghỉ ăn trưa nạp năng lượng nhanh; rời đỉnh chậm nhất 13:00.`, locationNote: viewWp },
          { day: 1, time: '12:30', title: 'Hạ sơn & điểm danh an toàn', description: `Dùng gậy trekking bảo vệ khớp gối, ra khỏi rừng trước 16:30.`, locationNote: startLoc },
        ]
      : [
          { day: 1, time: '06:30', title: 'Khai báo kiểm lâm & phân tải balo', description: `Xuất trình CCCD và thống nhất đội hình với ${rangerStation.name}.`, locationNote: startLoc },
          { day: 1, time: '07:30', title: 'Xuất phát ngày 1', description: `Di chuyển nhịp đều, tránh tách đoàn, bổ sung điện giải Oresol dọc tuyến.`, locationNote: `Cửa rừng ${trail.name}` },
          { day: 1, time: '15:30', title: `Nhận lán / hạ trại đêm 1`, description: `Đến ${campWp || 'lán nghỉ chính'} trước khi trời tối, thay đồ khô giữ ấm và ngủ sớm.`, locationNote: campWp || `Lán nghỉ ${trail.name}` },
          { day: 2, time: '04:30', title: `Leo đỉnh ${viewWp} đón bình minh`, description: `Mang balo phụ gọn nhẹ (nước ấm, áo gió, đèn pin đội đầu).`, locationNote: viewWp },
          { day: 2, time: '08:30', title: 'Thu gom rác Leave No Trace & hạ sơn', description: `Dọn sạch rác mang ra khỏi rừng, bắt đầu đổ dốc ổn định.`, locationNote: campWp || `Tuyến hạ sơn` },
          { day: days, time: '15:30', title: 'Hoàn thành cung đường tại cửa rừng', description: `Điểm danh đầy đủ thành viên và xác nhận an toàn với chốt quản lý.`, locationNote: startLoc },
        ];

  const survivalChecklist: ExpeditionBriefGearItem[] = [
    { name: 'Giày trekking đế gai sâu', category: 'Trang phục', weightGrams: 920, isEssential: true, reason: 'Chống trượt và bảo vệ cổ chân trên địa hình dốc.' },
    { name: days >= 2 ? 'Balo trợ lực 35–45L + áo trùm mưa' : 'Balo trợ lực 20–28L + áo trùm mưa', category: 'Khác', weightGrams: days >= 2 ? 1350 : 850, isEssential: true, reason: 'Phân bổ tải trọng vào đai hông.' },
    { name: `Bình / túi nước mềm đủ ${Math.max(2, Math.ceil(bioMetrics.waterLitersPerDay))}L/ngày`, category: 'Ăn uống & Nước', weightGrams: 280, isEssential: true, reason: `Ước tính sinh học ${bioMetrics.waterLitersPerDay}L/ngày.` },
    { name: 'Đèn pin đội đầu + pin dự phòng', category: 'Điện tử', weightGrams: 180, isEssential: true, reason: 'Thiết yếu khi leo sớm hoặc về muộn.' },
    { name: 'Áo mưa bộ 2 lớp chống thấm', category: 'Trang phục', weightGrams: 440, isEssential: true, reason: 'Chắn gió rét và mưa rừng đột ngột.' },
    { name: `Túi sơ cứu WFA + ${bioMetrics.oresolPackets} gói Oresol + còi sinh tồn`, category: 'Y tế & An toàn', weightGrams: 340, isEssential: true, reason: 'Phòng chuột rút, bong gân và xử lý khẩn cấp.' },
    { name: 'Pin sạc dự phòng 20.000mAh (đã tải GPX Offline LOST)', category: 'Điện tử', weightGrams: 420, isEssential: true, reason: 'Duy trì định vị GPS ngoại tuyến.' },
  ];
  if (trail.maxAltitudeM >= 2200) {
    survivalChecklist.push({ name: 'Áo lông vũ giữ ấm + áo giữ nhiệt thermal', category: 'Trang phục', weightGrams: 520, isEssential: true, reason: `Đỉnh ${trail.maxAltitudeM.toLocaleString()}m về đêm hạ nhiệt mạnh.` });
  }
  if (days >= 2) {
    survivalChecklist.push({ name: 'Túi ngủ chịu nhiệt 0°C – 5°C + đồ khô ngủ đêm', category: 'Đồ ngủ & Lán', weightGrams: 1200, isEssential: true, reason: 'Bắt buộc cho hành trình qua đêm trên núi.' });
  }
  if (trail.permitRequired) {
    survivalChecklist.push({ name: 'CCCD bản gốc + hồ sơ đăng ký VQG / Kiểm lâm', category: 'Khác', weightGrams: 30, isEssential: true, reason: trail.permitInfo || 'Xuất trình tại trạm cửa rừng.' });
  }

  const nights = Math.max(0, days - 1);
  const permitPer = trail.permitRequired ? (trail.maxAltitudeM >= 2900 ? 250_000 : 120_000) : 0;
  const needsGuide = trail.permitRequired || trail.difficultyLevel >= 3 || days >= 2;
  const guidePer = needsGuide ? roundTo10kClient((Math.max(1, Math.ceil(groupSize / 6)) * (trail.maxAltitudeM >= 2800 ? 700_000 : 550_000) * days) / groupSize) : 0;
  const needsPorter = days >= 2 || trail.difficultyLevel >= 4;
  const porterPer = needsPorter ? roundTo10kClient((Math.max(1, Math.ceil(groupSize / 4)) * 550_000 * days) / groupSize) : 0;
  const foodPer = roundTo10kClient(days <= 1 ? 160_000 : 180_000 + (days - 1) * 240_000);
  const shelterPer = nights > 0 ? roundTo10kClient(nights * 220_000) : 0;
  const transportPer = roundTo10kClient(trail.maxAltitudeM >= 2500 ? 250_000 : days >= 2 ? 200_000 : 120_000);

  const lines: ExpeditionBriefBudgetLine[] = [
    { key: 'permit', label: 'Vé VQG & Thủ tục rừng', detail: trail.permitRequired ? 'Vé tham quan & khai báo tuyến' : 'Cung mở / tự do', perPersonVnd: permitPer, groupTotalVnd: permitPer * groupSize },
    { key: 'guide', label: 'HDV bản địa / Kiểm lâm', detail: needsGuide ? `Chia nhóm ${groupSize} người trong ${days} ngày` : 'Tự túc theo GPX Offline', perPersonVnd: guidePer, groupTotalVnd: guidePer * groupSize },
    { key: 'porter', label: 'Porter hậu cần / nấu ăn', detail: needsPorter ? `Chia nhóm ${groupSize} người trong ${days} ngày` : 'Đi trong ngày — tự gùi', perPersonVnd: porterPer, groupTotalVnd: porterPer * groupSize },
    { key: 'food', label: 'Ăn uống, nước & Oresol', detail: `Khẩu phần trekking & điện giải ${days} ngày`, perPersonVnd: foodPer, groupTotalVnd: foodPer * groupSize },
    { key: 'shelter', label: 'Lán gỗ / thuê lều túi ngủ', detail: nights > 0 ? `${nights} đêm lưu trú trên núi` : 'Không qua đêm', perPersonVnd: shelterPer, groupTotalVnd: shelterPer * groupSize },
    { key: 'transport', label: 'Trung chuyển cửa rừng & gửi xe', detail: 'Xe ôm cửa rừng & dịch vụ địa phương', perPersonVnd: transportPer, groupTotalVnd: transportPer * groupSize },
  ];

  const perPersonVnd = lines.reduce((s, l) => s + l.perPersonVnd, 0);
  const groupTotalVnd = lines.reduce((s, l) => s + l.groupTotalVnd, 0);
  const contingencyPerPersonVnd = roundTo10kClient(perPersonVnd * 0.15);

  return {
    generatedAt: new Date().toISOString(),
    departureDate,
    groupSize,
    fitnessLevel,
    trail: {
      id: trail.id,
      name: trail.name,
      province: trail.province,
      district: trail.district,
      region: trail.region,
      maxAltitudeM: trail.maxAltitudeM,
      distanceKm: trail.distanceKm,
      elevationGainM: trail.elevationGainM,
      durationDays: trail.durationDays,
      durationHoursNote: trail.durationHoursNote,
      difficultyLevel: trail.difficultyLevel,
      difficultyNote: trail.difficultyNote,
      permitRequired: trail.permitRequired,
      permitInfo: trail.permitInfo,
      hasWaterSource: trail.hasWaterSource,
      hasCampsite: trail.hasCampsite,
      bestMonths: trail.bestMonths,
      avoidMonths: trail.avoidMonths,
      transportationInfo: trail.transportationInfo,
      startLat: trail.startLat,
      startLng: trail.startLng,
    },
    goNoGo: null,
    bioMetrics,
    rangerStation,
    itinerarySteps,
    survivalChecklist,
    totalChecklistGrams: survivalChecklist.reduce((s, i) => s + i.weightGrams, 0),
    budget: {
      currency: 'VND',
      groupSize,
      days,
      lines,
      perPersonVnd,
      groupTotalVnd,
      contingencyPerPersonVnd,
      grandTotalPerPersonVnd: perPersonVnd + contingencyPerPersonVnd,
      grandTotalGroupVnd: (perPersonVnd + contingencyPerPersonVnd) * groupSize,
      note: `Chế độ dự toán ngoại tuyến cho nhóm ${groupSize} người (chưa gồm vé máy bay / xe khách liên tỉnh).`,
    },
    safetyNotes: [
      'Đang tạo hồ sơ ở chế độ ngoại tuyến — kết nối mạng để bổ sung chấm điểm Go/No-Go thời tiết đỉnh trực tiếp.',
      `Khẩn cấp: Gọi ${rangerStation.hotlinePhone} hoặc Tổng đài cứu nạn quốc gia 112 / 114 / 115.`,
      'Tuân thủ quy tắc S.T.O.P khi lạc đường và Leave No Trace (mang 100% rác thải ra khỏi rừng).',
    ],
  };
}

export async function generateExpeditionBriefApi(
  input: ExpeditionBriefInput,
  fallbackTrails?: Trail[],
  signal?: AbortSignal
): Promise<ExpeditionBriefResult> {
  const internalCtrl = new AbortController();
  const timer = setTimeout(() => internalCtrl.abort(), 10_000);
  const onExternalAbort = () => internalCtrl.abort();
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new DOMException('Request aborted by user', 'AbortError');
    }
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const res = await fetch(`${API_BASE}/expedition-brief`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      signal: internalCtrl.signal,
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) return json.data as ExpeditionBriefResult;
    }
  } catch {
    if (signal?.aborted) {
      throw new DOMException('Request aborted by user', 'AbortError');
    }
    // Offline fallback below
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
  return computeOfflineExpeditionBrief(input, fallbackTrails);
}

// =========================================================================
// WAVE 10A: MULTIMODAL PHOTO COMPRESSION & PHOTO TRIAGE API
// =========================================================================

export interface CompressedAiPhoto {
  base64: string;
  mimeType: 'image/jpeg';
  previewUrl: string;
  fileName: string;
  byteSize: number;
  width: number;
  height: number;
}

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_RAW_PHOTO_BYTES = 15 * 1024 * 1024;
const MAX_COMPRESSED_DIM = 1024;
const MAX_UPLOAD_DECODED_BYTES = Math.floor(2.5 * 1024 * 1024);

/**
 * Downscales JPEG/PNG/WebP photo on an offscreen canvas to max 1024px JPEG (quality 0.82)
 * before uploading to POST /api/ai/analyze-image. Strictly rejects SVG/HTML/non-image files.
 */
export async function compressImageForAiTriage(file: File): Promise<CompressedAiPhoto> {
  const mimeLower = (file.type || '').toLowerCase();
  const extMatch = /\.(jpe?g|png|webp)$/i.test(file.name);
  if ((!mimeLower || !ALLOWED_IMAGE_MIMES.has(mimeLower)) && !extMatch) {
    throw new Error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP (không hỗ trợ SVG hoặc định dạng khác).');
  }
  if (mimeLower.includes('svg') || mimeLower.includes('html') || /\.svg$/i.test(file.name)) {
    throw new Error('Không hỗ trợ tệp SVG/HTML vì lý do bảo mật.');
  }
  if (file.size > MAX_RAW_PHOTO_BYTES) {
    throw new Error('Ảnh gốc vượt quá 15 MB. Vui lòng chọn ảnh nhỏ hơn.');
  }

  const tempSourceUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Không thể giải mã tệp ảnh này.'));
      el.src = tempSourceUrl;
    });

    const srcW = img.naturalWidth || img.width || 1;
    const srcH = img.naturalHeight || img.height || 1;
    const scale = Math.min(1, MAX_COMPRESSED_DIM / Math.max(srcW, srcH));
    const targetW = Math.max(1, Math.round(srcW * scale));
    const targetH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Trình duyệt không hỗ trợ nén ảnh Canvas.');
    }
    // Paint white background before drawing so transparent PNG/WebP alpha channels never turn solid black in JPEG
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Single JPEG encode via toBlob (avoids double main-thread JPEG encoding)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Không thể nén ảnh sang định dạng JPEG.'))),
        'image/jpeg',
        0.82
      );
    });

    if (blob.size > MAX_UPLOAD_DECODED_BYTES) {
      throw new Error('Ảnh sau nén vẫn vượt ngưỡng 2.5 MB. Hãy chọn ảnh có độ phân giải thấp hơn.');
    }

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const resultStr = typeof reader.result === 'string' ? reader.result : '';
        const commaIdx = resultStr.indexOf(',');
        resolve(commaIdx >= 0 ? resultStr.slice(commaIdx + 1) : resultStr);
      };
      reader.onerror = () => reject(new Error('Không thể đọc dữ liệu ảnh sau nén.'));
      reader.readAsDataURL(blob);
    });

    const previewUrl = URL.createObjectURL(blob);

    return {
      base64,
      mimeType: 'image/jpeg',
      previewUrl,
      fileName: file.name,
      byteSize: blob.size,
      width: targetW,
      height: targetH,
    };
  } finally {
    URL.revokeObjectURL(tempSourceUrl);
  }
}

export async function analyzeAiImageApi(
  payload: ImageTriageRequestPayload,
  signal?: AbortSignal
): Promise<ImageTriageResponsePayload> {
  const internalCtrl = new AbortController();
  const timer = setTimeout(() => internalCtrl.abort(), 16_000);
  const onExternalAbort = () => internalCtrl.abort();
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new DOMException('Request aborted by user', 'AbortError');
    }
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const res = await fetch(`${API_BASE}/analyze-image`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      signal: internalCtrl.signal,
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success && json.data) {
      return {
        ...(json.data as ImageTriageResponsePayload),
        reply: removeEmojis(json.data.reply || ''),
      };
    }
    if (res.status === 400 || res.status === 429) {
      throw new Error(json.message || 'Không thể phân tích ảnh lúc này.');
    }
  } catch (err: unknown) {
    if (signal?.aborted) {
      throw new DOMException('Request aborted by user', 'AbortError');
    }
    if (err instanceof Error && (err.message.includes('ảnh') || err.message.includes('quá nhiều') || err.message.includes('SVG'))) {
      throw err;
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  // Honest offline visual triage fallback
  const qNorm = normalizeAscii(payload.question || '');
  const isSnake = hasWholeWordPhrase(qNorm, 'ran') || hasWholeWordPhrase(qNorm, 'snake') || hasWholeWordPhrase(qNorm, 'bi can');
  const isMushroom = hasWholeWordPhrase(qNorm, 'nam') || hasWholeWordPhrase(qNorm, 'mushroom');
  const isInjury = hasWholeWordPhrase(qNorm, 'vet thuong') || hasWholeWordPhrase(qNorm, 'bong gan') || hasWholeWordPhrase(qNorm, 'chay mau');
  const category: ImageTriageResponsePayload['triageCategory'] = isSnake
    ? 'wildlife_snake'
    : isMushroom
    ? 'flora_mushroom'
    : isInjury
    ? 'injury_medical'
    : 'general';

  const fallbackActions: RichAiAction[] = [];
  if (isSnake || isMushroom || isInjury) {
    fallbackActions.push({
      type: 'first_aid_triage',
      triageData: {
        severity: isSnake || isMushroom ? 'critical' : 'urgent',
        conditionCode: isSnake ? 'WFA-SNAKE' : isMushroom ? 'WFA-POISON' : 'WFA-WOUND',
        conditionTitle: isSnake
          ? 'Cảnh Báo Rắn Độc (Ngoại Tuyến)'
          : isMushroom
          ? 'Cảnh Báo Nấm Rừng — Cấm Ăn Thử (Ngoại Tuyến)'
          : 'Sơ Cứu Vết Thương Thực Địa (Ngoại Tuyến)',
        summary: 'Mất kết nối máy chủ phân tích ảnh — ưu tiên giữ an toàn, không chạm/ăn thử và gọi ngay 115 / 112 nếu có triệu chứng.',
        immediateSteps: isSnake
          ? ['Giữ khoảng cách >= 2m, không chọc gậy.', 'Nếu bị cắn: bất động chi thấp hơn tim và chuyển viện ngay.']
          : isMushroom
          ? ['Tuyệt đối không ăn nấm/lá rừng lạ.', 'Nếu đã nuốt phải: giữ mẫu nấm và đưa ngay tới bệnh viện / gọi 115.']
          : ['Ép cầm máu bằng gạc sạch 5–10 phút.', 'Rửa sạch bằng nước muối sinh lý hoặc nước sạch, không đắp lá rừng.'],
        forbiddenActions: ['Không tin nhận diện ảnh để ăn nấm lạ hoặc tiếp cận rắn rừng.'],
        whenToEvacuate: ['Mọi tình huống nghi rắn cắn, ngộ độc hoặc vết thương chảy máu nhiều.'],
        emergencyContacts: FALLBACK_EMERGENCY_CONTACTS,
        sosSmsNote: 'Can ho tro y te khan cap ngoai thuc dia (LOST AI Offline).',
      },
    });
  }
  fallbackActions.push({
    type: 'quick_reply',
    suggestions: ['Hotline cứu hộ khẩn cấp 112 / 115', 'Quy tắc S.T.O.P khi lạc đường', 'Checklist sơ cứu WFA leo núi'],
  });

  return {
    reply: removeEmojis(
      '**CHẾ ĐỘ NGOẠI TUYẾN — PHÂN TÍCH ẢNH THỰC ĐỊA:**\n\nHiện thiết bị chưa kết nối được tới máy chủ thị giác LOST AI. Vui lòng:\n- Giữ khoảng cách an toàn với động vật hoang dã (>= 2m) và **tuyệt đối không ăn thử nấm/quả rừng lạ**.\n- Nếu đây là tình huống y tế hoặc chấn thương, áp dụng ngay hướng dẫn sơ cứu và gọi **115 / 112** bên dưới.'
    ),
    actions: fallbackActions,
    modelUsed: 'lost-knowledge-engine',
    triageCategory: category,
    safetyDisclaimer: 'Chế độ ngoại tuyến — luôn ưu tiên an toàn tính mạng và liên hệ 115 / 112 khi khẩn cấp.',
    contextUsed: {
      trailId: payload.trailId,
      imageBytes: Math.floor((payload.imageBase64.length * 3) / 4),
      detectedMimeType: payload.mimeType,
      geminiVisionUsed: false,
    },
  };
}

// =========================================================================
// WAVE 12A: AI TURNAROUND TIME & NOAA SUNSET CUTOFF PACE PLANNER API
// =========================================================================

export async function computePacePlanApi(
  input: PacePlanInput,
  signal?: AbortSignal
): Promise<PacePlanResult | null> {
  const internalCtrl = new AbortController();
  const timer = setTimeout(() => internalCtrl.abort(), 9000);
  const onExternalAbort = () => internalCtrl.abort();
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new DOMException('Request aborted by user', 'AbortError');
    }
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  try {
    const res = await fetch(`${API_BASE}/pace-plan`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      signal: internalCtrl.signal,
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) return json.data as PacePlanResult;
    }
  } catch {
    if (signal?.aborted) {
      throw new DOMException('Request aborted by user', 'AbortError');
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
  return null;
}


// =========================================================================
// WAVE 14A: AI NUTRITION, HYDRATION & ELECTROLYTE PLANNER API
// =========================================================================

export async function computeFuelPlanApi(
  input: FuelPlanInput,
  signal?: AbortSignal
): Promise<FuelPlanResult | null> {
  const internalCtrl = new AbortController();
  const timer = setTimeout(() => internalCtrl.abort(), 9000);
  const onExternalAbort = () => internalCtrl.abort();
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new DOMException('Request aborted by user', 'AbortError');
    }
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  try {
    const res = await fetch(`${API_BASE}/fuel-plan`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      signal: internalCtrl.signal,
      body: JSON.stringify(input),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success && json.data) {
      return json.data as FuelPlanResult;
    }
    if (res.status >= 400 && res.status < 500) {
      throw new Error(
        typeof json.message === 'string' && json.message.trim()
          ? json.message
          : 'Thông số tính dinh dưỡng & nước uống không hợp lệ.'
      );
    }
  } catch (err) {
    if (signal?.aborted) {
      throw new DOMException('Request aborted by user', 'AbortError');
    }
    if (err instanceof Error && err.name !== 'AbortError' && !(err instanceof TypeError)) {
      throw err;
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
  return null;
}


// =========================================================================
// WAVE 16A: AI EXPEDITION READINESS AUDIT API (0-100 PRE-FLIGHT)
// =========================================================================

export async function computeReadinessAuditApi(
  input: ReadinessAuditInput,
  signal?: AbortSignal
): Promise<ReadinessAuditResult | null> {
  const internalCtrl = new AbortController();
  const timer = setTimeout(() => internalCtrl.abort(), 12_000);
  const onExternalAbort = () => internalCtrl.abort();
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new DOMException('Request aborted by user', 'AbortError');
    }
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  try {
    const res = await fetch(`${API_BASE}/readiness-audit`, {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      signal: internalCtrl.signal,
      body: JSON.stringify(input),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success && json.data) {
      return json.data as ReadinessAuditResult;
    }
    if (res.status >= 400 && res.status < 500) {
      throw new Error(
        typeof json.message === 'string' && json.message.trim()
          ? json.message
          : 'Thông số kiểm tra sẵn sàng chuyến đi không hợp lệ.'
      );
    }
  } catch (err) {
    if (signal?.aborted) {
      throw new DOMException('Request aborted by user', 'AbortError');
    }
    if (err instanceof Error && err.name !== 'AbortError' && !(err instanceof TypeError)) {
      throw err;
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
  return null;
}
