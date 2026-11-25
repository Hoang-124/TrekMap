import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  IconBot,
  IconTrash,
  IconMaximize,
  IconMinimize,
  IconCopy,
  IconCheck,
  IconMountain,
  IconShieldAlert,
  IconCompass,
  IconSettings,
  IconCpu,
  IconHiking,
  IconMapPin,
  IconX,
  IconSend,
  IconRotateCw,
  IconFileText,
  IconMessageSquare,
  IconBackpack,
} from '../common/SvgIcons.js';

import {
  sendAiMessageStream,
  fetchQuickPrompts,
  removeEmojis,
  fetchAiThreadsApi,
  fetchAiThreadDetailApi,
  updateAiThreadApi,
  deleteAiThreadApi,
  analyzeGpxApi,
  compressImageForAiTriage,
  analyzeAiImageApi,
  loadLocalAiThreads,
  saveLocalAiThreads,
  consumeQueuedAiAssistantPrompt,
  type CompressedAiPhoto,
} from '../../services/aiAssistant.service.js';
import { parseGpxFileClient } from '../../utils/gpxParser.js';
import { isTopmostFocusTrap, useFocusTrap } from '../../hooks/useFocusTrap.js';
import { AiMarkdownRenderer } from './AiMarkdownRenderer.js';
import { AiRichCards } from './AiRichCards.js';
import { AiThreadSidebar } from './AiThreadSidebar.js';
import { AiTrailMatchWizard } from './AiTrailMatchWizard.js';
import { AiPackAuditor } from './AiPackAuditor.js';
import { AiExpeditionBriefTab } from './AiExpeditionBriefTab.js';
import type { Incident, Trail, UserProfile } from '../../types.js';
import {
  isSafeImageUrl,
  type AiChatThreadSummary,
  type AiEngineMode,
  type AiModelUsed,
  type AiPreferredRegion,
  type LocalAiThreadRecord,
  type RichAiChatMessage,
} from './ai.types.js';
import { safeLocalStorageGet, safeLocalStorageSet } from '../../utils/storageScope.js';

interface TrekAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrail?: Trail | null;
  currentUser?: UserProfile | null;
  onSelectTrail?: (trailId: string) => void;
  pageView?: string;
  currentView?: string;
  trails?: Trail[];
  incidents?: Incident[];
}

const MAX_INPUT_CHARS = 1500;

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

function stripMarkdownForSpeech(raw: string): string {
  return removeEmojis(raw)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\|/g, ', ')
    .replace(/^[#>*\-+•]+\s*/gm, '')
    .replace(/\*\*|__|~~|\*/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1800);
}

function getVietnamDateFileStamp(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback to UTC+7 offset
  }
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

function buildThreadBriefingMarkdown(
  msgs: RichAiChatMessage[],
  activeTrail?: Trail | null,
  threadTitle?: string
): string {
  const dateStamp = getVietnamDateFileStamp();
  const timeNow = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const lines: string[] = [
    `# Ghi chú chuyến đi từ LOST AI (${dateStamp})`,
    '',
    `- **Chủ đề**: ${threadTitle || 'Chuẩn bị đường rừng & an toàn leo núi'}`,
    `- **Lưu lúc**: ${timeNow} (giờ Việt Nam)`,
    ...(activeTrail
      ? [
        `- **Cung đường đang xem**: ${activeTrail.name} (${activeTrail.province} — đỉnh ${activeTrail.maxAltitudeM.toLocaleString()}m, ${activeTrail.distanceKm} km, +${activeTrail.elevationGainM}m)`,
      ]
      : []),
    `- **Số lượt trao đổi**: ${msgs.length}`,
    '',
    '---',
    '',
  ];

  for (const msg of msgs) {
    const speaker = msg.role === 'user' ? 'Bạn' : 'LOST AI';
    lines.push(`### ${speaker}${msg.timestamp ? ` (${msg.timestamp})` : ''}`);
    lines.push('');
    lines.push(removeEmojis(msg.content));
    lines.push('');

    if (Array.isArray(msg.actions) && msg.actions.length > 0) {
      for (const act of msg.actions) {
        if (act.type === 'go_no_go_card' && act.goNoGoData) {
          const g = act.goNoGoData;
          lines.push(`> **Đánh giá Go/No-Go (${g.trailName})**: ${g.verdictLabel} — **${g.score}/100 điểm** (${g.departureDate})`);
          if (g.weatherSummary) {
            lines.push(
              `> Thời tiết đỉnh: ${g.weatherSummary.summitTempMinC ?? g.weatherSummary.tempMinC}°C – ${g.weatherSummary.summitTempMaxC ?? g.weatherSummary.tempMaxC}°C | Mưa ${g.weatherSummary.precipMm} mm | Gió ${g.weatherSummary.windSpeedKmH} km/h`
            );
          }
          if (g.risks.length > 0) lines.push(`> Lưu ý rủi ro: ${g.risks.join('; ')}`);
          lines.push('');
        } else if (act.type === 'trail_compare_card' && act.compareData) {
          const cmp = act.compareData;
          lines.push(`**So sánh các cung (tháng ${cmp.targetMonth}):**`);
          lines.push('');
          lines.push(`| Tiêu chí | ${cmp.trails.map((t) => t.name).join(' | ')} |`);
          lines.push(`| --- | ${cmp.trails.map(() => '---').join(' | ')} |`);
          lines.push(`| Độ cao đỉnh | ${cmp.trails.map((t) => `${t.maxAltitudeM.toLocaleString()}m`).join(' | ')} |`);
          lines.push(`| Quãng đường / độ dốc | ${cmp.trails.map((t) => `${t.distanceKm} km (+${t.elevationGainM}m)`).join(' | ')} |`);
          lines.push(`| Độ khó | ${cmp.trails.map((t) => `Cấp ${t.difficultyLevel}/5`).join(' | ')} |`);
          lines.push(`| Thời lượng & Naismith | ${cmp.trails.map((t) => `${t.durationLabel} (~${t.naismithHours}h)`).join(' | ')} |`);
          lines.push(`| Nguồn nước | ${cmp.trails.map((t) => (t.hasWaterSource ? 'Có suối' : 'Khô / tự mang')).join(' | ')} |`);
          lines.push(`| Giấy phép VQG | ${cmp.trails.map((t) => (t.permitRequired ? 'Cần đăng ký' : 'Tự do (mang CCCD)')).join(' | ')} |`);
          lines.push(`| Sự cố đang mở | ${cmp.trails.map((t) => `${t.activeIncidentsCount}`).join(' | ')} |`);
          lines.push('');
          lines.push(`- **Hợp người mới**: ${cmp.beginnerPick.name} — ${cmp.beginnerPick.reason}`);
          lines.push(`- **Hợp người đi quen**: ${cmp.veteranPick.name} — ${cmp.veteranPick.reason}`);
          lines.push('');
        } else if (act.type === 'bio_calculator' && act.bioCalcData) {
          const b = act.bioCalcData;
          lines.push(
            `> **Tính thể lực & nước**: Đi thực tế **${b.recommendedMovingHours}h** (Naismith ${b.naismithHours}h / Tobler ${b.toblerHours}h) | Nước **${b.waterLitersTotal}L** + **${b.oresolPackets} gói Oresol** | Calo **${b.caloriesActiveKcal} kcal** | Balo **${b.packRatioPercent}%**`
          );
          lines.push('');
        } else if (act.type === 'pace_schedule_card' && act.pacePlanData) {
          const pp = act.pacePlanData;
          lines.push(
            `> **Nhịp đi & giờ quay đầu (${pp.trailName} — ${pp.departureDate})**: Quay đầu an toàn **${pp.pacing.safeTurnaroundTime}** | Hoàng hôn NOAA **${pp.solar.sunset}** | Xuất phát **${pp.inputs.startTime}** → Đỉnh **${pp.pacing.summitEta}** → Xuống chân núi **${pp.pacing.finishEta}**`
          );
          for (const cp of pp.checkpoints) {
            lines.push(`> - Ngày ${cp.day} · ${cp.etaTime} — ${cp.label} (${cp.cumulativeKm} km · ${cp.elevationM}m)`);
          }
          lines.push('');
        } else if (act.type === 'fuel_plan_card' && act.fuelPlanData) {
          const fp = act.fuelPlanData;
          lines.push(
            `> **Đồ ăn, nước & điện giải (${fp.trailName} — ${fp.inputs.dietLabel})**: Nước **${fp.hydration.waterLitersTotal}L** (mang **${fp.hydration.carryWaterPerLegLiters}L/${fp.hasWaterSource ? 'chặng' : 'ngày'}**) + **${fp.hydration.oresolPacketsTotal} gói Oresol** | **${fp.energy.totalTripKcal.toLocaleString('vi-VN')} kcal** | Nặng ăn+nước **${fp.totals.totalConsumableCarryKg} kg** (~**${fp.totals.estimatedFoodCostVndPerPerson.toLocaleString('vi-VN')}đ/người**)`
          );
          if (fp.hydration.hydrationAlert) {
            lines.push(`> **Lưu ý nước & điện giải**: ${fp.hydration.hydrationAlert}`);
          }
          if (fp.hydration.waterResupplySpots.length > 0) {
            lines.push(
              `> **Điểm tiếp nước dọc đường**: ${fp.hydration.waterResupplySpots
                .map(
                  (sp) =>
                    `${sp.name}${typeof sp.elevationM === 'number' && Number.isFinite(sp.elevationM) ? ` (${sp.elevationM.toLocaleString('vi-VN')}m)` : ''} — ${sp.treatmentNote}`
                )
                .join(' | ')}`
            );
          }
          for (const r of fp.rations) {
            lines.push(
              `> - [${r.mealSlot}] ${r.name}: ${r.quantityLabel} (${r.weightGramsPerPerson}g/người${fp.inputs.groupSize > 1 ? `, đoàn ${(r.totalGramsGroup / 1000).toFixed(2)}kg` : ''} · ${r.kcalPerPerson} kcal)`
            );
          }
          lines.push('');
        } else if (act.type === 'readiness_audit_card' && act.readinessAuditData) {
          const ra = act.readinessAuditData;
          lines.push(
            `> **Rà soát trước giờ đi (${ra.trailName} — ${ra.departureDate})**: **${ra.readinessScore}/100** (${ra.verdictLabel}) | Balo ${ra.inputs.packWeightKg}kg (${ra.inputs.packRatioPercent}%) | Quay đầu ${ra.snapshot.safeTurnaroundTime} | Nước ${ra.snapshot.carryWaterPerLegLiters}L`
          );
          for (const pl of ra.pillars) {
            lines.push(`> - **${pl.label} (${pl.score}/100)**: ${pl.summary}`);
          }
          for (const fx of ra.topFixes) {
            lines.push(`> - [Ưu tiên ${fx.priority.toUpperCase()}] **${fx.title}**: ${fx.action}`);
          }
          lines.push('');
        } else if (act.type === 'gpx_analysis_card' && act.gpxData) {
          const gx = act.gpxData;
          lines.push(
            `> **Đọc file GPX (${gx.fileName})**: ${gx.distanceKm} km | +${gx.elevationGainM}m / -${gx.elevationLossM}m | Đỉnh ${gx.maxAltitudeM}m | Độ khó cấp ${gx.estimatedDifficulty}/5 | Naismith ${gx.bioMetrics.recommendedMovingHours}h`
          );
          lines.push('');
        } else if (act.type === 'ranked_trails' && Array.isArray(act.rankedTrails) && act.rankedTrails.length > 0) {
          lines.push('**Cung đường gợi ý:**');
          for (const rt of act.rankedTrails) {
            lines.push(`- **${rt.name}** (${rt.province}) — ${rt.maxAltitudeM.toLocaleString()}m | ${rt.distanceKm} km | Hợp ${rt.matchScore}%`);
          }
          lines.push('');
        } else if (act.type === 'first_aid_triage' && act.triageData) {
          const tr = act.triageData;
          lines.push(`> **Sơ cứu dã ngoại WFA — ${tr.conditionTitle} (${tr.severity.toUpperCase()})**`);
          tr.immediateSteps.forEach((step, idx) => lines.push(`> ${idx + 1}. ${step}`));
          lines.push(`> Số liên hệ: ${tr.emergencyContacts.map((c) => `${c.name}: ${c.phone}`).join(' | ')}`);
          lines.push('');
        } else if (act.type === 'gear_checklist' && Array.isArray(act.checklistItems)) {
          lines.push('**Đồ đạc cần chuẩn bị:**');
          for (const cat of act.checklistItems) {
            lines.push(`- *${cat.category}*:`);
            for (const item of cat.items) {
              const label = typeof item === 'string' ? item : item.name;
              lines.push(`  - [ ] ${label}`);
            }
          }
          lines.push('');
        } else if (act.type === 'itinerary_card' && act.itineraryData) {
          lines.push(`**Lịch trình ${act.itineraryData.trailName} (${act.itineraryData.durationLabel}):**`);
          for (const step of act.itineraryData.steps) {
            lines.push(`- **Ngày ${step.day} · ${step.time}** — ${step.title}: ${step.description}`);
          }
          lines.push('');
        }
      }
    }

    lines.push('---');
    lines.push('');
  }

  lines.push('*Lưu từ LOST — bản đồ leo núi & đi rừng Việt Nam. Nhớ lưu sẵn số cứu hộ 112 / 114 / 115 trước khi vào rừng.*');
  return lines.join('\n');
}

function formatNowTime(): string {
  return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function buildWelcomeMessage(currentUser?: UserProfile | null, currentTrail?: Trail | null): RichAiChatMessage {
  const rawName = currentUser?.fullName || '';
  const cleanName = rawName.replace(/\s*\(.*?\)/, '').trim();
  const nameGreeting = cleanName ? ` **${cleanName}**` : '';
  const trailHint = currentTrail
    ? `\n\nMình đang mở sẵn thông tin cung **${currentTrail.name} (${currentTrail.maxAltitudeM}m · ${currentTrail.province})**. Bạn muốn xem hôm nay đi được không (Go/No-Go), canh giờ quay đầu hay gửi file **.gpx** để đọc địa hình cứ nhắn nhé.`
    : '';

  return {
    id: `welcome-${currentUser?.id || 'guest'}-${currentTrail?.id || 'home'}`,
    role: 'assistant',
    content: removeEmojis(`**Chào${nameGreeting}!** Mình là **LOST AI**, bạn đồng hành rành đường rừng núi Việt Nam.

Trước khi xách balo, bạn cứ hỏi nhanh mấy việc này:
- **Xem thời tiết đỉnh & Go/No-Go**: gió rét, mưa, cảnh báo sạt lở để chốt ngày đi cho yên tâm.
- **Chọn cung hợp sức**: lọc theo thể lực, mùa săn mây, suối thác hoặc cung gần chỗ bạn nhất.
- **Canh nước, giờ đi & độ nặng balo**: ước tính theo Naismith / Tobler, số gói Oresol và lượng calo.
- **Đọc file GPX hoặc ảnh thực địa**: thả file **.gpx** xem dốc, hoặc gửi ảnh gặp dọc đường để hỏi nhanh.
- **Sơ cứu dã ngoại WFA & số kiểm lâm**: tra nhanh cách xử lý và số trực 112 / 114 / 115 khi cần.${trailHint}`),
    timestamp: formatNowTime(),
    modelUsed: 'lost-knowledge-engine',
    actions: [
      {
        type: 'quick_reply',
        suggestions: currentTrail
          ? [
            `Hôm nay có nên leo ${currentTrail.name} không (Go/No-Go)?`,
            `Canh giờ quay đầu và tốc độ leo ${currentTrail.name}`,
            `Gợi ý lịch trình đi ${currentTrail.name}`,
            `Đồ đạc và balo cần mang cho ${currentTrail.name}`,
          ]
          : [
            'Gợi ý vài cung săn mây dễ đi cho người mới',
            'Canh giờ quay đầu leo Fansipan để kịp xuống trước tối',
            'Đường 15km cần bao nhiêu nước và đi mấy tiếng (Naismith)?',
            'Chuẩn bị balo và đồ đạc cho chuyến 2N1Đ',
            'Xử lý khẩn cấp khi sốc độ cao hoặc lạc đường',
          ],
      },
    ],
  };
}

function pickMostRecentLocalThread(list: LocalAiThreadRecord[]): LocalAiThreadRecord | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const sorted = [...list].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    const ta = new Date(a.lastMessageAt).getTime();
    const tb = new Date(b.lastMessageAt).getTime();
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
  return sorted.find((t) => Array.isArray(t.messages) && t.messages.length > 0) || null;
}

export const TrekAssistantModal: React.FC<TrekAssistantModalProps> = ({
  isOpen,
  onClose,
  currentTrail,
  currentUser,
  onSelectTrail,
  pageView,
  currentView,
  trails,
  incidents,
}) => {
  const effectivePageView = pageView ?? currentView;
  const activeTrailIncidentCount = currentTrail && Array.isArray(incidents)
    ? incidents.filter((inc) => !inc.resolved && inc.trailId === currentTrail.id).length
    : 0;
  const [activeSuiteTab, setActiveSuiteTab] = useState<'chat' | 'matchmaker' | 'pack_audit' | 'brief'>('chat');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isDragOverGpx, setIsDragOverGpx] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'acquired' | 'unavailable'>('idle');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [preferredRegion, setPreferredRegion] = useState<AiPreferredRegion>(() => {
    const saved = safeLocalStorageGet('lost_preferred_region');
    if (saved === 'north' || saved === 'central' || saved === 'taynguyen' || saved === 'south' || saved === 'auto') {
      return saved;
    }
    if (saved === 'danang') return 'central';
    return 'auto'; // Default GPS-first instead of hardcoded Da Nang
  });

  const [engineMode, setEngineMode] = useState<AiEngineMode>(() => {
    try {
      localStorage.removeItem('lost_gemini_api_key');
    } catch {
      // ignore
    }
    const saved = safeLocalStorageGet('lost_engine_mode');
    if (saved === 'knowledge' || saved === 'gemini' || saved === 'auto') return saved;
    return 'auto';
  });

  const storageUserId =
    currentUser?.id
      ? String(currentUser.id)
      : (currentUser as { _id?: string } | null | undefined)?._id
        ? String((currentUser as { _id?: string })._id)
        : null;
  const [prevStorageUserId, setPrevStorageUserId] = useState<string | null>(storageUserId);

  const [lastModelUsed, setLastModelUsed] = useState<AiModelUsed>('lost-knowledge-engine');
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [threads, setThreads] = useState<AiChatThreadSummary[]>(() =>
    loadLocalAiThreads(storageUserId).map(({ messages: _m, ...summary }) => summary)
  );
  const [activeThreadId, setActiveThreadId] = useState<string | null>(() => {
    const initialThread = pickMostRecentLocalThread(loadLocalAiThreads(storageUserId));
    return initialThread ? initialThread.id : null;
  });
  const [messages, setMessages] = useState<RichAiChatMessage[]>(() => {
    const initialThread = pickMostRecentLocalThread(loadLocalAiThreads(storageUserId));
    if (initialThread && initialThread.messages.length > 0) {
      return initialThread.messages;
    }
    return [buildWelcomeMessage(currentUser, currentTrail)];
  });

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzingGpx, setIsAnalyzingGpx] = useState(false);
  const [pendingImage, setPendingImage] = useState<CompressedAiPhoto | null>(null);
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [quickPrompts, setQuickPrompts] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [checkedGearItems, setCheckedGearItems] = useState<Record<string, boolean>>({});
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [voiceInterimText, setVoiceInterimText] = useState('');
  const [exportedBriefing, setExportedBriefing] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  // Immediately isolate chat state & sidebar when active user changes (logout / login / account switch)
  if (storageUserId !== prevStorageUserId) {
    setPrevStorageUserId(storageUserId);
    const scopedLocal = loadLocalAiThreads(storageUserId);
    const initialThread = pickMostRecentLocalThread(scopedLocal);
    setThreads(scopedLocal.map(({ messages: _m, ...summary }) => summary));
    setActiveThreadId(initialThread ? initialThread.id : null);
    setIsCloudSynced(false);
    setMessages(
      initialThread && initialThread.messages.length > 0
        ? initialThread.messages
        : [buildWelcomeMessage(currentUser, currentTrail)]
    );
    setInputQuery('');
    setPendingImage(null);
    setCheckedGearItems({});
    setShowClearConfirm(false);
    setIsLoading(false);
    setIsAnalyzingGpx(false);
  }

  const isVoiceSupported = typeof window !== 'undefined' && getSpeechRecognitionCtor() !== null;
  const isTtsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

  const dialogRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gpxInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef<boolean>(true);
  const abortRef = useRef<AbortController | null>(null);
  const gpxAbortRef = useRef<AbortController | null>(null);
  const speechRecRef = useRef<BrowserSpeechRecognition | null>(null);
  const voiceBaseDraftRef = useRef<string>('');
  const threadLoadReqIdRef = useRef<number>(0);
  const sendReqIdRef = useRef<number>(0);

  useFocusTrap(isOpen, dialogRef, { initialFocusRef: textareaRef });

  const revokeMessageBlobUrls = useCallback((msgs: RichAiChatMessage[]) => {
    for (const m of msgs) {
      if (m.imagePreviewUrl && m.imagePreviewUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(m.imagePreviewUrl);
        } catch {
          // ignore
        }
        objectUrlsRef.current.delete(m.imagePreviewUrl);
      }
    }
  }, []);

  // Cancel in-flight requests, revoke blob URLs & invalidate stale fetches whenever user scope changes
  useEffect(() => {
    const tracked = objectUrlsRef.current;
    return () => {
      abortRef.current?.abort();
      gpxAbortRef.current?.abort();
      threadLoadReqIdRef.current += 1;
      sendReqIdRef.current += 1;
      for (const url of tracked) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }
      tracked.clear();
    };
  }, [storageUserId]);
  const handleSendMessageRef = useRef<(textToSend?: string, overrideTrailId?: string) => Promise<void>>(async () => { });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2600);
  }, []);

  const detachAndAbortSpeechRec = useCallback(() => {
    const rec = speechRecRef.current;
    if (rec) {
      rec.onstart = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        // ignore
      }
      speechRecRef.current = null;
    }
  }, []);

  const stopVoiceRecognition = useCallback(() => {
    detachAndAbortSpeechRec();
    setIsListeningVoice(false);
    setVoiceInterimText('');
  }, [detachAndAbortSpeechRec]);

  const stopTts = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    setSpeakingMsgId(null);
  }, []);

  const handleToggleSpeakMessage = useCallback(
    (msgId: string, content: string) => {
      if (!isTtsSupported) return;
      if (speakingMsgId === msgId) {
        stopTts();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const plain = stripMarkdownForSpeech(content);
        if (!plain) return;
        const utterance = new SpeechSynthesisUtterance(plain);
        utterance.lang = 'vi-VN';
        utterance.rate = 1.02;
        const voices = window.speechSynthesis.getVoices();
        const viVoice = voices.find((v) => v.lang.toLowerCase().startsWith('vi'));
        if (viVoice) utterance.voice = viVoice;
        utterance.onend = () => {
          setSpeakingMsgId((prev) => (prev === msgId ? null : prev));
        };
        utterance.onerror = () => {
          setSpeakingMsgId((prev) => (prev === msgId ? null : prev));
        };
        setSpeakingMsgId(msgId);
        window.speechSynthesis.speak(utterance);
      } catch {
        setSpeakingMsgId(null);
        triggerToast('Trình duyệt này chưa đọc thành tiếng được.');
      }
    },
    [isTtsSupported, speakingMsgId, stopTts, triggerToast]
  );

  const toggleVoiceRecognition = useCallback(() => {
    if (isListeningVoice) {
      if (speechRecRef.current) {
        try {
          speechRecRef.current.stop();
        } catch {
          stopVoiceRecognition();
        }
      } else {
        stopVoiceRecognition();
      }
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      triggerToast('Trình duyệt này chưa hỗ trợ nói để nhập chữ.');
      return;
    }

    try {
      const recognition = new Ctor();
      recognition.lang = 'vi-VN';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      voiceBaseDraftRef.current = inputQuery.trim();

      recognition.onstart = () => {
        setIsListeningVoice(true);
        setVoiceInterimText('');
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let finalPart = '';
        let interimPart = '';
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0]?.transcript || '';
          if (res.isFinal) {
            finalPart += `${text} `;
          } else {
            interimPart += text;
          }
        }
        const spoken = `${finalPart}${interimPart}`.trim();
        const combined = voiceBaseDraftRef.current
          ? `${voiceBaseDraftRef.current} ${spoken}`.trim()
          : spoken;
        setVoiceInterimText(interimPart.trim());
        setInputQuery(combined.slice(0, MAX_INPUT_CHARS));
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        const errCode = event.error;
        if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
          triggerToast('Bạn mở quyền micro trên trình duyệt để nói trực tiếp nhé.');
        } else if (errCode === 'no-speech') {
          triggerToast('Chưa nghe rõ — bấm micro nói lại giúp mình nhé.');
        } else if (errCode !== 'aborted') {
          triggerToast('Chưa nhận được giọng nói lúc này.');
        }
        speechRecRef.current = null;
        setIsListeningVoice(false);
        setVoiceInterimText('');
      };

      recognition.onend = () => {
        speechRecRef.current = null;
        setIsListeningVoice(false);
        setVoiceInterimText('');
      };

      speechRecRef.current = recognition;
      recognition.start();
    } catch {
      stopVoiceRecognition();
      triggerToast('Không mở được micro trên máy này.');
    }
  }, [inputQuery, isListeningVoice, stopVoiceRecognition, triggerToast]);

  // Cleanup timers, speech recognition, TTS, blob preview URLs & in-flight requests on unmount
  useEffect(() => {
    isMountedRef.current = true;
    const trackedUrls = objectUrlsRef.current;
    return () => {
      isMountedRef.current = false;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
      if (liveOpenTimerRef.current) clearTimeout(liveOpenTimerRef.current);
      abortRef.current?.abort();
      gpxAbortRef.current?.abort();
      detachAndAbortSpeechRec();
      for (const url of trackedUrls) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }
      trackedUrls.clear();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [detachAndAbortSpeechRec]);

  // Cleanly abort in-flight requests, detach voice recognition & stop TTS whenever modal closes
  useEffect(() => {
    if (isOpen) return;
    abortRef.current?.abort();
    gpxAbortRef.current?.abort();
    sendReqIdRef.current += 1;
    detachAndAbortSpeechRec();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    const resetTimer = setTimeout(() => {
      setIsLoading(false);
      setIsAnalyzingGpx(false);
      setIsListeningVoice(false);
      setVoiceInterimText('');
      setSpeakingMsgId(null);
    }, 0);
    return () => clearTimeout(resetTimer);
  }, [isOpen, detachAndAbortSpeechRec]);

  // Always render a fresh welcome message when no user turns exist yet (zero cascading effect setState)
  const displayedMessages =
    messages.length === 0 || (messages.length === 1 && messages[0].id.startsWith('welcome-'))
      ? [buildWelcomeMessage(currentUser, currentTrail)]
      : messages;

  // Load cloud threads on open + merge strictly with current user's scoped local fallback
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const scopeId = storageUserId;
    fetchAiThreadsApi().then((cloudThreads) => {
      if (!active) return;
      if (cloudThreads !== null) {
        setIsCloudSynced(true);
        const localOnly = loadLocalAiThreads(scopeId)
          .filter((lt) => lt.id.startsWith('local-'))
          .map(({ messages: _m, ...s }) => s);
        const merged = [...cloudThreads, ...localOnly];
        setThreads(merged);
      } else {
        setIsCloudSynced(false);
        setThreads(loadLocalAiThreads(scopeId).map(({ messages: _m, ...s }) => s));
      }
    });
    return () => {
      active = false;
    };
  }, [isOpen, storageUserId]);

  // Persist current thread to per-user localStorage offline cache whenever messages change
  const persistLocalThreadSnapshot = useCallback(
    (
      tid: string,
      msgs: RichAiChatMessage[],
      opts?: string | { titleHint?: string; forceTitle?: string; preserveTimestamp?: string }
    ) => {
      const userMessages = msgs.filter((m) => m.role === 'user');
      if (userMessages.length === 0) return;

      const resolvedOpts = typeof opts === 'string' ? { titleHint: opts } : opts || {};
      const allLocal = loadLocalAiThreads(storageUserId);
      const idx = allLocal.findIndex((t) => t.id === tid);
      const firstUser = userMessages[0].content;
      const computedTitle =
        resolvedOpts.titleHint || (firstUser.length > 60 ? `${firstUser.slice(0, 57)}...` : firstUser);

      const resolvedTitle =
        resolvedOpts.forceTitle || (idx >= 0 ? allLocal[idx].title : computedTitle);
      const resolvedTimestamp =
        resolvedOpts.preserveTimestamp || new Date().toISOString();

      const record: LocalAiThreadRecord = {
        id: tid,
        title: resolvedTitle,
        pinned: idx >= 0 ? allLocal[idx].pinned : false,
        trailContextId: currentTrail?.id || (idx >= 0 ? allLocal[idx].trailContextId : undefined),
        trailContextName: currentTrail?.name || (idx >= 0 ? allLocal[idx].trailContextName : undefined),
        messageCount: msgs.filter((m) => !m.id.startsWith('welcome-')).length,
        lastMessageAt: resolvedTimestamp,
        isLocalOnly: tid.startsWith('local-'),
        messages: msgs.slice(-40).map((m) =>
          m.imagePreviewUrl && m.imagePreviewUrl.startsWith('blob:')
            ? { ...m, imagePreviewUrl: undefined }
            : m
        ),
      };

      const nextLocal = idx >= 0 ? allLocal.map((item, i) => (i === idx ? record : item)) : [record, ...allLocal];
      const savedOk = saveLocalAiThreads(nextLocal, storageUserId);
      if (!savedOk) {
        triggerToast('Bộ nhớ trình duyệt đã đầy — không thể lưu thêm lịch sử cục bộ.');
      }

      setThreads((prev) => {
        const exists = prev.some((t) => t.id === tid);
        const { messages: _m, ...summary } = record;
        if (exists) {
          return prev.map((t) =>
            t.id === tid
              ? {
                  ...t,
                  ...summary,
                  title: resolvedOpts.forceTitle || t.title || summary.title,
                  lastMessageAt: resolvedOpts.preserveTimestamp || summary.lastMessageAt,
                }
              : t
          );
        }
        return [summary, ...prev];
      });
    },
    [currentTrail?.id, currentTrail?.name, storageUserId, triggerToast]
  );

  // ESC keyboard shortcut (strict LIFO via topmost focus trap + IME guard)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.isComposing) return;
        if (!isTopmostFocusTrap(dialogRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (showClearConfirm) setShowClearConfirm(false);
        else if (showSettings) setShowSettings(false);
        else if (showSidebar && !isExpanded) setShowSidebar(false);
        else if (isExpanded) setIsExpanded(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showClearConfirm, showSettings, showSidebar, isExpanded, onClose]);

  // P0 Life-Safety: ALWAYS acquire genuine hardware GPS independently of preferredRegion
  // so 2G Emergency SOS SMS NEVER falls back to hardcoded city centers!
  useEffect(() => {
    if (!isOpen) return;
    if (!('geolocation' in navigator)) {
      const t = setTimeout(() => setGpsStatus('unavailable'), 0);
      return () => clearTimeout(t);
    }
    let active = true;
    const initTimer = setTimeout(() => {
      if (active) setGpsStatus((prev) => (prev === 'acquired' ? prev : 'acquiring'));
    }, 0);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!active) return;
        const { latitude, longitude } = pos.coords;
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          setUserCoords({ lat: latitude, lng: longitude });
          setGpsStatus('acquired');
        } else {
          setGpsStatus('unavailable');
        }
      },
      () => {
        if (active) setGpsStatus((prev) => (prev === 'acquired' ? prev : 'unavailable'));
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 300_000 }
    );
    return () => {
      active = false;
      clearTimeout(initTimer);
    };
  }, [isOpen]);

  // Load contextual quick prompts (guarded against stale trail switches & cleared focus timer)
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    fetchQuickPrompts({
      name: currentTrail?.name,
      province: currentTrail?.province,
      pageView: effectivePageView,
    }).then((prompts) => {
      if (active && prompts.length > 0) setQuickPrompts(prompts.map(removeEmojis));
    });
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => {
      if (isTopmostFocusTrap(dialogRef.current)) {
        textareaRef.current?.focus();
      }
    }, 180);
    return () => {
      active = false;
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [isOpen, currentTrail?.id, currentTrail?.name, currentTrail?.province, effectivePageView]);

  // Auto-scroll chat feed
  useEffect(() => {
    if (isOpen && !showSettings) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isAnalyzingGpx, isOpen, showSettings]);

  // Auto-grow textarea height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(120, Math.max(38, el.scrollHeight))}px`;
  }, [inputQuery]);

  const getEffectiveCoords = useCallback(() => {
    if (preferredRegion === 'central') return { lat: 16.0544, lng: 108.2022 };
    if (preferredRegion === 'north') return { lat: 21.0285, lng: 105.8542 };
    if (preferredRegion === 'south') return { lat: 10.8231, lng: 106.6297 };
    if (preferredRegion === 'taynguyen') return { lat: 11.9404, lng: 108.4583 };
    return userCoords;
  }, [preferredRegion, userCoords]);

  const handleRemovePendingImage = useCallback(() => {
    setPendingImage((prev) => {
      if (prev?.previewUrl && prev.previewUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(prev.previewUrl);
        } catch {
          // ignore
        }
        objectUrlsRef.current.delete(prev.previewUrl);
      }
      return null;
    });
  }, []);

  const handleSelectPhotoFile = useCallback(
    async (file: File) => {
      if (!file || isCompressingImage || isLoading) return;
      setActiveSuiteTab('chat');
      setShowSettings(false);
      setIsCompressingImage(true);
      try {
        const compressed = await compressImageForAiTriage(file);
        if (!isMountedRef.current) {
          if (compressed.previewUrl.startsWith('blob:')) {
            try {
              URL.revokeObjectURL(compressed.previewUrl);
            } catch {
              // ignore
            }
          }
          return;
        }
        if (compressed.previewUrl.startsWith('blob:')) {
          objectUrlsRef.current.add(compressed.previewUrl);
        }
        setPendingImage((prev) => {
          if (prev?.previewUrl && prev.previewUrl.startsWith('blob:')) {
            try {
              URL.revokeObjectURL(prev.previewUrl);
            } catch {
              // ignore
            }
            objectUrlsRef.current.delete(prev.previewUrl);
          }
          return compressed;
        });
        const kb = Math.max(1, Math.round(compressed.byteSize / 1024));
        triggerToast(`Đã đính kèm ảnh (${kb} KB) — gõ câu hỏi hoặc bấm gửi luôn nhé.`);
        textareaRef.current?.focus();
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        const msg = err instanceof Error ? err.message : 'Không mở được ảnh này, bạn thử chọn ảnh khác nhé.';
        triggerToast(msg);
      } finally {
        if (isMountedRef.current) setIsCompressingImage(false);
      }
    },
    [isCompressingImage, isLoading, triggerToast]
  );

  const handleSendMessage = useCallback(
    async (textToSend?: string, overrideTrailId?: string) => {
      const text = removeEmojis(textToSend ?? inputQuery).trim();
      const attachedPhoto = textToSend === undefined ? pendingImage : null;
      if ((!text && !attachedPhoto) || isLoading) return;
      if (text.length > MAX_INPUT_CHARS) {
        triggerToast(`Tin nhắn hơi dài (tối đa ${MAX_INPUT_CHARS} ký tự).`);
        return;
      }

      const resolvedOverrideTrailId =
        typeof overrideTrailId === 'string' && overrideTrailId.trim() ? overrideTrailId.trim() : undefined;
      const effectiveTrail =
        resolvedOverrideTrailId && currentTrail?.id !== resolvedOverrideTrailId ? undefined : currentTrail;
      const effectiveTrailId = resolvedOverrideTrailId || currentTrail?.id;

      // Multimodal Photo Triage Branch (Wave 10A)
      if (attachedPhoto) {
        const effectiveQuestion = text || 'Xem giúp mình ảnh thực địa này và lưu ý an toàn khi đi rừng nhé.';
        const userMsg: RichAiChatMessage = {
          id: `user-img-${Date.now()}`,
          role: 'user',
          content: effectiveQuestion,
          imagePreviewUrl: attachedPhoto.previewUrl,
          imageCaption: attachedPhoto.fileName,
          timestamp: formatNowTime(),
        };
        const baseMessages = messages.filter((m) => !m.id.startsWith('welcome-') || messages.length > 1);
        const nextWithUser = [...baseMessages, userMsg];
        setMessages(nextWithUser);
        setInputQuery('');
        setPendingImage(null);
        setIsLoading(true);

        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const reqId = ++sendReqIdRef.current;

        try {
          const res = await analyzeAiImageApi(
            {
              imageBase64: attachedPhoto.base64,
              mimeType: attachedPhoto.mimeType,
              question: effectiveQuestion,
              trailId: effectiveTrailId,
              threadId: activeThreadId && !activeThreadId.startsWith('local-') ? activeThreadId : undefined,
            },
            ctrl.signal
          );
          if (!isMountedRef.current || reqId !== sendReqIdRef.current) return;
          setLastModelUsed(res.modelUsed);
          const assistantMsg: RichAiChatMessage = {
            id: `assistant-img-${Date.now()}`,
            role: 'assistant',
            content: removeEmojis(res.reply),
            timestamp: formatNowTime(),
            modelUsed: res.modelUsed,
            actions: res.actions,
          };
          const finalMsgs = [...nextWithUser, assistantMsg];
          setMessages(finalMsgs);
          const resolvedTid = res.threadId || activeThreadId || `local-${Date.now()}`;
          setActiveThreadId(resolvedTid);
          persistLocalThreadSnapshot(resolvedTid, finalMsgs, `Ảnh: ${effectiveQuestion.slice(0, 48)}`);
        } catch (err: unknown) {
          if (!isMountedRef.current || reqId !== sendReqIdRef.current) return;
          if (err instanceof Error && err.name === 'AbortError') {
            triggerToast('Đã dừng xem ảnh.');
            return;
          }
          const errText = err instanceof Error ? err.message : 'Chưa xem được ảnh lúc này, bạn thử gửi lại nhé.';
          const errorMsg: RichAiChatMessage = {
            id: `err-img-${Date.now()}`,
            role: 'assistant',
            content: errText,
            timestamp: formatNowTime(),
            isError: true,
          };
          setMessages((prev) => [...prev, errorMsg]);
        } finally {
          if (isMountedRef.current && reqId === sendReqIdRef.current) {
            setIsLoading(false);
          }
        }
        return;
      }

      const userMsg: RichAiChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: formatNowTime(),
      };

      const baseMessages = messages.filter((m) => !m.id.startsWith('welcome-') || messages.length > 1);
      const nextWithUser = [...baseMessages, userMsg];
      setMessages(nextWithUser);
      setInputQuery('');
      setIsLoading(true);

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const reqId = ++sendReqIdRef.current;

      try {
        // Strictly omit welcome message & error bubbles from Gemini/server history
        const cleanHistory = nextWithUser
          .filter((m) => !m.id.startsWith('welcome-') && !m.isError && (m.role === 'user' || m.role === 'assistant'))
          .slice(-9, -1) // Prior turns before current userMsg
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: removeEmojis(m.content) }));

        const coords = getEffectiveCoords();
        const streamMsgId = `assistant-${Date.now()}`;
        const streamTimestamp = formatNowTime();
        const res = await sendAiMessageStream(
          {
            message: text,
            threadId: activeThreadId && !activeThreadId.startsWith('local-') ? activeThreadId : undefined,
            conversationHistory: cleanHistory,
            engineMode,
            userName: currentUser?.fullName,
            userCoordinates: coords || undefined,
            context: {
              pageView: effectivePageView || (effectiveTrail || effectiveTrailId ? 'detail' : 'home'),
              trailId: effectiveTrailId,
              trailName: effectiveTrail?.name,
              province: effectiveTrail?.province,
              maxAltitudeM: effectiveTrail?.maxAltitudeM,
              difficultyLevel: effectiveTrail?.difficultyLevel,
              userCoordinates: coords || undefined,
              preferredRegion,
            },
            currentTrailContext: effectiveTrail
              ? {
                trailId: effectiveTrail.id,
                trailName: effectiveTrail.name,
                province: effectiveTrail.province,
                maxAltitudeM: effectiveTrail.maxAltitudeM,
                difficultyLevel: effectiveTrail.difficultyLevel,
              }
              : undefined,
          },
          {
            signal: ctrl.signal,
            onDelta: (_chunk, accumulatedText) => {
              if (!isMountedRef.current || reqId !== sendReqIdRef.current) return;
              const liveMsg: RichAiChatMessage = {
                id: streamMsgId,
                role: 'assistant',
                content: accumulatedText,
                timestamp: streamTimestamp,
                modelUsed: 'lost-knowledge-engine',
              };
              setMessages([...nextWithUser, liveMsg]);
            },
          }
        );

        if (!isMountedRef.current || reqId !== sendReqIdRef.current) return;
        setLastModelUsed(res.modelUsed);

        const isErrorTurn = Boolean(res.rateLimited || res.errorStatus);
        const assistantMsg: RichAiChatMessage = {
          id: streamMsgId,
          role: 'assistant',
          content: removeEmojis(res.reply),
          timestamp: streamTimestamp,
          modelUsed: res.modelUsed,
          actions: res.actions,
          isError: isErrorTurn,
          retryPrompt: isErrorTurn ? text : undefined,
        };

        const finalMsgs = [...nextWithUser, assistantMsg];
        setMessages(finalMsgs);

        const resolvedTid = res.threadId || activeThreadId || `local-${Date.now()}`;
        setActiveThreadId(resolvedTid);
        persistLocalThreadSnapshot(resolvedTid, finalMsgs);
      } catch (err: unknown) {
        if (!isMountedRef.current || reqId !== sendReqIdRef.current) return;
        if (err instanceof Error && err.name === 'AbortError') {
          triggerToast('Đã dừng trả lời.');
          return;
        }
        const errorMsg: RichAiChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Mạng đang chập chờn nên chưa kết nối được với LOST AI. Bạn kiểm tra sóng rồi bấm gửi lại nhé.',
          timestamp: formatNowTime(),
          isError: true,
          retryPrompt: text,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        if (isMountedRef.current && reqId === sendReqIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [
      inputQuery,
      pendingImage,
      isLoading,
      messages,
      activeThreadId,
      engineMode,
      currentUser,
      currentTrail,
      effectivePageView,
      preferredRegion,
      getEffectiveCoords,
      persistLocalThreadSnapshot,
      triggerToast,
    ]
  );

  // Keep latest handleSendMessage in ref so [isOpen] effect NEVER re-binds on keystrokes or drops queued prompts
  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  // Consume any queued prompt from TrailIntelligenceBar or global event (runs strictly on [isOpen])
  useEffect(() => {
    if (!isOpen) return;
    const queued = consumeQueuedAiAssistantPrompt();
    const timer = queued?.prompt
      ? setTimeout(() => {
        setActiveSuiteTab('chat');
        setShowSettings(false);
        void handleSendMessageRef.current(queued.prompt, queued.trailId);
      }, 0)
      : null;
    const handleLiveOpen = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (detail?.prompt) {
        consumeQueuedAiAssistantPrompt();
        setActiveSuiteTab('chat');
        setShowSettings(false);
        const promptText = String(detail.prompt);
        const detailTrailId =
          typeof detail.trailId === 'string' && detail.trailId.trim() ? detail.trailId.trim() : undefined;
        // Defer by a tick so App.tsx's setAiContextTrail(matched) commits fresh currentTrail before sending
        if (liveOpenTimerRef.current) clearTimeout(liveOpenTimerRef.current);
        liveOpenTimerRef.current = setTimeout(() => {
          liveOpenTimerRef.current = null;
          if (isMountedRef.current) {
            void handleSendMessageRef.current(promptText, detailTrailId);
          }
        }, 30);
      }
    };
    window.addEventListener('lost:open-ai-assistant', handleLiveOpen);
    window.addEventListener('lost:open-ai-with-prompt', handleLiveOpen);
    return () => {
      if (timer) clearTimeout(timer);
      if (liveOpenTimerRef.current) {
        clearTimeout(liveOpenTimerRef.current);
        liveOpenTimerRef.current = null;
      }
      window.removeEventListener('lost:open-ai-assistant', handleLiveOpen);
      window.removeEventListener('lost:open-ai-with-prompt', handleLiveOpen);
    };
  }, [isOpen]);

  // 1-Click Analyze GPX track of the currently viewed trail right inside Chat
  const handleAnalyzeCurrentTrailGpx = async () => {
    if (!currentTrail || !Array.isArray(currentTrail.gpxTrack) || currentTrail.gpxTrack.length < 2 || isAnalyzingGpx) {
      triggerToast('Cung này chưa có dữ liệu GPX để xem địa hình.');
      return;
    }
    setActiveSuiteTab('chat');
    setShowSettings(false);
    setIsAnalyzingGpx(true);
    gpxAbortRef.current?.abort();
    const gpxCtrl = new AbortController();
    gpxAbortRef.current = gpxCtrl;
    const reqId = ++sendReqIdRef.current;

    try {
      const points: Array<[number, number, number | null]> = currentTrail.gpxTrack.map(([lat, lng]) => [lat, lng, null]);
      const userMsg: RichAiChatMessage = {
        id: `user-gpx-${Date.now()}`,
        role: 'user',
        content: `Xem giúp mình file GPX của cung **${currentTrail.name}** (${points.length} điểm tọa độ)`,
        timestamp: formatNowTime(),
      };
      const baseMessages = messages.filter((m) => !m.id.startsWith('welcome-') || messages.length > 1);
      const withUser = [...baseMessages, userMsg];
      setMessages(withUser);

      const cloudThreadId =
        activeThreadId && !activeThreadId.startsWith('local-') ? activeThreadId : undefined;
      const serverRes = await analyzeGpxApi(
        {
          fileName: `${currentTrail.id}.gpx`,
          points,
          threadId: cloudThreadId,
        },
        gpxCtrl.signal
      );

      if (!isMountedRef.current || reqId !== sendReqIdRef.current) return;

      if (serverRes) {
        const assistantMsg: RichAiChatMessage = {
          id: `assistant-gpx-${Date.now()}`,
          role: 'assistant',
          content: removeEmojis(serverRes.reply),
          timestamp: formatNowTime(),
          modelUsed: 'lost-knowledge-engine',
          actions: serverRes.actions,
        };
        const finalMsgs = [...withUser, assistantMsg];
        setMessages(finalMsgs);
        const tid = serverRes.threadId || activeThreadId || `local-${Date.now()}`;
        setActiveThreadId(tid);
        persistLocalThreadSnapshot(tid, finalMsgs, `GPX: ${currentTrail.name}`);
        triggerToast(`Đã đọc xong GPX cung ${currentTrail.name}.`);
      } else {
        triggerToast('Chưa kết nối được máy chủ đọc cao độ lúc này.');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (isMountedRef.current && reqId === sendReqIdRef.current) {
        triggerToast('Không đọc được tracklog GPX của cung này.');
      }
    } finally {
      if (isMountedRef.current && reqId === sendReqIdRef.current) {
        setIsAnalyzingGpx(false);
      }
    }
  };

  // Handle GPX file upload or drop
  const handleProcessGpxFile = async (file: File) => {
    if (!file || isAnalyzingGpx) return;
    setActiveSuiteTab('chat');
    setShowSettings(false);
    setIsAnalyzingGpx(true);
    gpxAbortRef.current?.abort();
    const gpxCtrl = new AbortController();
    gpxAbortRef.current = gpxCtrl;
    const reqId = ++sendReqIdRef.current;

    try {
      const parsed = await parseGpxFileClient(file);
      if (!isMountedRef.current || reqId !== sendReqIdRef.current) return;
      const userMsg: RichAiChatMessage = {
        id: `user-gpx-${Date.now()}`,
        role: 'user',
        content: `Đọc giúp mình file GPX **${parsed.fileName}** (${parsed.points.length} điểm GPS)`,
        timestamp: formatNowTime(),
      };
      const baseMessages = messages.filter((m) => !m.id.startsWith('welcome-') || messages.length > 1);
      const withUser = [...baseMessages, userMsg];
      setMessages(withUser);

      // Enrich on server (AWS Terrarium DEM + live weather + nearest LOST trail), fallback to instant client offlineAnalysis
      const cloudThreadId =
        activeThreadId && !activeThreadId.startsWith('local-') ? activeThreadId : undefined;
      const serverRes = await analyzeGpxApi(
        {
          fileName: parsed.fileName,
          points: parsed.points,
          threadId: cloudThreadId,
        },
        gpxCtrl.signal
      );

      if (!isMountedRef.current || reqId !== sendReqIdRef.current) return;

      const analysis = serverRes?.analysis || parsed.offlineAnalysis;
      const replyText =
        serverRes?.reply ||
        `**Đọc nhanh GPX ngoại tuyến — ${analysis.fileName}**\n\n- **Quãng đường**: **${analysis.distanceKm} km** · leo dốc **+${analysis.elevationGainM}m** · cao độ **${analysis.minAltitudeM}m – ${analysis.maxAltitudeM}m**.\n- **Độ khó ước tính**: **cấp ${analysis.estimatedDifficulty}/5** (${analysis.difficultyLabel}).\n- **Thời gian dự kiến (Naismith/Tobler)**: **${analysis.bioMetrics.recommendedMovingHours} giờ** đi thực tế (~${analysis.bioMetrics.estimatedTotalTripHours}h tính cả nghỉ).\n- **Nước mang theo**: ${analysis.waterAdvice}`;

      const assistantMsg: RichAiChatMessage = {
        id: `assistant-gpx-${Date.now()}`,
        role: 'assistant',
        content: removeEmojis(replyText),
        timestamp: formatNowTime(),
        modelUsed: 'lost-knowledge-engine',
        actions: serverRes?.actions || [
          {
            type: 'gpx_analysis_card',
            trailName: analysis.fileName,
            gpxData: analysis,
          },
        ],
      };

      const finalMsgs = [...withUser, assistantMsg];
      setMessages(finalMsgs);
      const tid = serverRes?.threadId || activeThreadId || `local-${Date.now()}`;
      setActiveThreadId(tid);
      persistLocalThreadSnapshot(tid, finalMsgs, `GPX: ${parsed.fileName}`);
      triggerToast(`Đã đọc xong ${parsed.fileName}.`);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (isMountedRef.current && reqId === sendReqIdRef.current) {
        const msg = err instanceof Error ? err.message : 'File GPX này bị lỗi hoặc không đúng định dạng.';
        triggerToast(msg);
      }
    } finally {
      if (isMountedRef.current && reqId === sendReqIdRef.current) {
        setIsAnalyzingGpx(false);
      }
    }
  };

  // Thread Sidebar Actions (monotonic request-ID + abort prevents stale SSE/GPX/cloud overwrites)
  const handleSelectThread = async (threadId: string) => {
    abortRef.current?.abort();
    gpxAbortRef.current?.abort();
    sendReqIdRef.current += 1;
    setIsLoading(false);
    setIsAnalyzingGpx(false);

    const reqId = ++threadLoadReqIdRef.current;
    stopTts();
    const existingSummary = threads.find((t) => t.id === threadId);
    setActiveThreadId(threadId);
    setShowSettings(false);
    // Check per-user local cache first for 0ms render
    const localHit = loadLocalAiThreads(storageUserId).find((t) => t.id === threadId);
    if (localHit && localHit.messages.length > 0) {
      setMessages(localHit.messages);
    }
    if (!threadId.startsWith('local-')) {
      const detail = await fetchAiThreadDetailApi(threadId);
      if (!isMountedRef.current || reqId !== threadLoadReqIdRef.current) return;
      if (detail && Array.isArray(detail.messages) && detail.messages.length > 0) {
        const mapped: RichAiChatMessage[] = detail.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: removeEmojis(m.content),
          timestamp: m.createdAt
            ? new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            : '',
          modelUsed: m.modelUsed,
          actions: m.actions,
        }));
        const lastServerTs =
          detail.messages[detail.messages.length - 1]?.createdAt ||
          existingSummary?.lastMessageAt ||
          localHit?.lastMessageAt;
        setMessages(mapped);
        persistLocalThreadSnapshot(threadId, mapped, {
          forceTitle: detail.title,
          preserveTimestamp: lastServerTs,
        });
      }
    }
  };

  const handleCreateNewThread = () => {
    abortRef.current?.abort();
    gpxAbortRef.current?.abort();
    sendReqIdRef.current += 1;
    threadLoadReqIdRef.current += 1;
    setIsLoading(false);
    setIsAnalyzingGpx(false);
    handleRemovePendingImage();
    revokeMessageBlobUrls(messages);
    setActiveThreadId(null);
    setMessages([buildWelcomeMessage(currentUser, currentTrail)]);
    setCheckedGearItems({});
    setShowSettings(false);
    triggerToast('Đã mở cuộc trò chuyện mới.');
  };

  const handleRenameThread = async (threadId: string, newTitle: string) => {
    const prevThreads = threads;
    const prevLocal = loadLocalAiThreads(storageUserId);
    setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, title: newTitle } : t)));
    saveLocalAiThreads(
      prevLocal.map((t) => (t.id === threadId ? { ...t, title: newTitle } : t)),
      storageUserId
    );
    if (!threadId.startsWith('local-')) {
      const ok = await updateAiThreadApi(threadId, { title: newTitle });
      if (!ok && isMountedRef.current) {
        setThreads(prevThreads);
        saveLocalAiThreads(prevLocal, storageUserId);
        triggerToast('Chưa đổi được tên cuộc trò chuyện trên máy chủ.');
      }
    }
  };

  const handleTogglePinThread = async (threadId: string, nextPinned: boolean) => {
    const prevThreads = threads;
    const prevLocal = loadLocalAiThreads(storageUserId);
    setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, pinned: nextPinned } : t)));
    saveLocalAiThreads(
      prevLocal.map((t) => (t.id === threadId ? { ...t, pinned: nextPinned } : t)),
      storageUserId
    );
    if (!threadId.startsWith('local-')) {
      const ok = await updateAiThreadApi(threadId, { pinned: nextPinned });
      if (!ok && isMountedRef.current) {
        setThreads(prevThreads);
        saveLocalAiThreads(prevLocal, storageUserId);
        triggerToast('Chưa cập nhật được trạng thái ghim trên máy chủ.');
      }
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    const prevThreads = threads;
    const prevLocal = loadLocalAiThreads(storageUserId);
    const deletingActive = activeThreadId === threadId;
    if (deletingActive) {
      abortRef.current?.abort();
      gpxAbortRef.current?.abort();
      sendReqIdRef.current += 1;
      setIsLoading(false);
      setIsAnalyzingGpx(false);
    }

    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    saveLocalAiThreads(
      prevLocal.filter((t) => t.id !== threadId),
      storageUserId
    );

    if (!threadId.startsWith('local-')) {
      const ok = await deleteAiThreadApi(threadId);
      if (!ok && isMountedRef.current) {
        setThreads(prevThreads);
        saveLocalAiThreads(prevLocal, storageUserId);
        triggerToast('Chưa xóa được cuộc trò chuyện trên máy chủ.');
        return;
      }
    }

    if (deletingActive) {
      handleCreateNewThread();
    } else {
      triggerToast('Đã xóa cuộc trò chuyện.');
    }
  };

  const handleConfirmClear = async () => {
    handleRemovePendingImage();
    revokeMessageBlobUrls(messages);
    if (activeThreadId) {
      await handleDeleteThread(activeThreadId);
    } else {
      abortRef.current?.abort();
      gpxAbortRef.current?.abort();
      sendReqIdRef.current += 1;
      setIsLoading(false);
      setIsAnalyzingGpx(false);
      setMessages([buildWelcomeMessage(currentUser, currentTrail)]);
      setCheckedGearItems({});
      triggerToast('Đã làm mới khung trò chuyện.');
    }
    setShowClearConfirm(false);
  };

  const copyViaExecCommand = (cleanText: string): boolean => {
    if (typeof document === 'undefined') return false;
    const textarea = document.createElement('textarea');
    textarea.value = cleanText;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    try {
      textarea.focus();
      textarea.select();
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      if (textarea.parentNode) textarea.parentNode.removeChild(textarea);
    }
  };

  const handleCopyText = async (id: string, text: string): Promise<boolean> => {
    const cleanText = removeEmojis(text);
    let copied: boolean;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(cleanText);
        copied = true;
      } catch {
        copied = copyViaExecCommand(cleanText);
      }
    } else {
      copied = copyViaExecCommand(cleanText);
    }
    if (copied) {
      if (isMountedRef.current) {
        setCopiedId(id);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) setCopiedId(null);
        }, 2000);
      }
      return true;
    }
    if (isMountedRef.current) {
      triggerToast('Trình duyệt chặn tự sao chép — bạn bôi đen chép tay giúp nhé.');
    }
    return false;
  };

  const getPromptSvgIcon = (promptText: string) => {
    const p = promptText.toLowerCase();
    if (p.includes('cứu hộ') || p.includes('khẩn cấp') || p.includes('sốc độ cao') || p.includes('lạc đường')) {
      return <IconShieldAlert size={13} color="var(--color-error-text, var(--color-error))" />;
    }
    if (p.includes('săn mây') || p.includes('fansipan') || p.includes('lảo thẩn') || p.includes('tà xùa') || p.includes('go/no-go') || p.includes('sẵn sàng') || p.includes('trước khi đi')) {
      return <IconMountain size={13} color="var(--color-sky)" />;
    }
    if (
      p.includes('thể lực') ||
      p.includes('balo') ||
      p.includes('suối') ||
      p.includes('thác') ||
      p.includes('nước') ||
      p.includes('oresol') ||
      p.includes('khẩu phần') ||
      p.includes('dinh dưỡng') ||
      p.includes('điện giải') ||
      p.includes('calo')
    ) {
      return <IconHiking size={13} color="var(--color-primary)" />;
    }
    return <IconCompass size={13} color="var(--color-sky)" />;
  };

  if (!isOpen) return null;

  const isSidebarDocked = isExpanded;
  const shouldShowSidebar = isSidebarDocked || showSidebar;

  // Export current AI thread briefing as downloadable .md file for offline reading
  const handleExportBriefingMd = () => {
    try {
      const currentThreadSummary = activeThreadId ? threads.find((t) => t.id === activeThreadId) : undefined;
      const md = buildThreadBriefingMarkdown(displayedMessages, currentTrail, currentThreadSummary?.title);
      const fileName = `LOST-AI-Briefing-${getVietnamDateFileStamp()}.md`;
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportedBriefing(true);
      if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
      exportTimerRef.current = setTimeout(() => setExportedBriefing(false), 2000);
      triggerToast(`Đã lưu file ${fileName} để đọc khi mất sóng.`);
    } catch {
      triggerToast('Chưa xuất được file ghi chú lúc này.');
    }
  };

  // Header Controls
  return createPortal(
    <>
      {isExpanded && (
        <div
          className="drawer-backdrop-in"
          onClick={() => setIsExpanded(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--overlay-bg)',
            zIndex: 'calc(var(--z-modal, 3000) - 1)',
          }}
        />
      )}

      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Bạn đồng hành đường rừng LOST AI"
        className="modal-fade-in"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOverGpx(true);
        }}
        onDragLeave={() => setIsDragOverGpx(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOverGpx(false);
          const dropped = e.dataTransfer.files?.[0];
          if (!dropped) return;
          const lowerName = dropped.name.toLowerCase();
          if (lowerName.endsWith('.gpx')) {
            void handleProcessGpxFile(dropped);
          } else if (
            /^image\/(jpeg|jpg|png|webp)$/i.test(dropped.type) ||
            /\.(jpe?g|png|webp)$/i.test(lowerName)
          ) {
            void handleSelectPhotoFile(dropped);
          } else {
            triggerToast('Chỉ nhận file .gpx hoặc ảnh JPG, PNG, WebP thôi bạn nhé.');
          }
        }}
        style={{
          position: 'fixed',
          bottom: isExpanded ? 'calc((100vh - min(860px, calc(100vh - 32px))) / 2)' : 'clamp(8px, 2.5vh, 20px)',
          right: isExpanded ? 'calc((100vw - min(1140px, calc(100vw - 32px))) / 2)' : 'clamp(8px, 3vw, 20px)',
          zIndex: 'var(--z-modal, 3000)',
          width: isExpanded ? 'min(1140px, calc(100vw - 32px))' : 'min(460px, calc(100vw - 16px))',
          height: isExpanded ? 'min(860px, calc(100vh - 32px))' : 'min(640px, calc(100vh - 24px))',
          background: 'var(--color-bg-card)',
          borderRadius: 6,
          border: '1px solid var(--color-border-strong)',
          boxShadow: 'var(--shadow-3d)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          outline: 'none',
          fontFamily: 'var(--font-family)',
          transition:
            'width 0.28s var(--ease-out-expo), height 0.28s var(--ease-out-expo), bottom 0.28s var(--ease-out-expo), right 0.28s var(--ease-out-expo)',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '12px 14px',
            background: 'var(--color-bg-main)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            {!isSidebarDocked && (
              <button
                type="button"
                onClick={() => setShowSidebar((prev) => !prev)}
                title="Các cuộc trò chuyện cũ"
                aria-label="Mở danh sách trò chuyện cũ"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 4,
                  background: showSidebar
                    ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)'
                    : 'var(--color-surface-elevated)',
                  border: `1px solid ${showSidebar ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  color: showSidebar ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <IconMessageSquare size={15} />
              </button>
            )}

            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 4,
                background: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconBot size={18} color="var(--color-on-primary)" />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--color-text-main)', letterSpacing: '-0.01em' }}>
                  LOST AI
                </span>
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 4,
                    background:
                      lastModelUsed === 'gemini-live'
                        ? 'color-mix(in srgb, var(--color-sky) 15%, transparent)'
                        : 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                    color: lastModelUsed === 'gemini-live' ? 'var(--color-sky)' : 'var(--color-primary)',
                    border:
                      lastModelUsed === 'gemini-live'
                        ? '1px solid color-mix(in srgb, var(--color-sky) 35%, transparent)'
                        : '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)',
                  }}
                >
                  {lastModelUsed === 'gemini-live' ? 'Gemini Live' : 'Dữ liệu thực địa'}
                </span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block' }} />
                <span>Bạn đường rừng · {engineMode === 'knowledge' ? 'Dùng ngoại tuyến' : engineMode === 'gemini' ? 'Ưu tiên Gemini' : 'Tự động'}</span>
              </div>
            </div>
          </div>

          {/* Pure SVG Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleExportBriefingMd}
              title="Lưu ghi chú (.md) đọc khi mất sóng"
              aria-label="Lưu ghi chú Markdown đọc ngoại tuyến"
              style={{
                width: 30,
                height: 30,
                borderRadius: 4,
                background: exportedBriefing
                  ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)'
                  : 'var(--color-surface-elevated)',
                border: `1px solid ${exportedBriefing ? 'var(--color-primary)' : 'var(--color-border)'}`,
                color: exportedBriefing ? 'var(--color-primary)' : 'var(--color-text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {exportedBriefing ? (
                <IconCheck size={14} color="var(--color-primary)" />
              ) : (
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowSettings((prev) => !prev);
                setShowClearConfirm(false);
              }}
              title={showSettings ? 'Quay lại trò chuyện' : 'Chỉnh vùng & cách trả lời'}
              aria-label="Tùy chỉnh LOST AI"
              style={{
                width: 30,
                height: 30,
                borderRadius: 4,
                background: showSettings
                  ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)'
                  : 'var(--color-surface-elevated)',
                border: `1px solid ${showSettings ? 'var(--color-primary)' : 'var(--color-border)'}`,
                color: showSettings ? 'var(--color-primary)' : 'var(--color-text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconSettings size={15} />
            </button>

            <button
              type="button"
              onClick={() => {
                setShowClearConfirm(true);
                setShowSettings(false);
              }}
              title="Xóa cuộc trò chuyện này"
              aria-label="Xóa cuộc trò chuyện này"
              style={{
                width: 30,
                height: 30,
                borderRadius: 4,
                background: showClearConfirm
                  ? 'color-mix(in srgb, var(--color-error) 16%, transparent)'
                  : 'var(--color-surface-elevated)',
                border: `1px solid ${showClearConfirm ? 'var(--color-error)' : 'var(--color-border)'}`,
                color: showClearConfirm ? 'var(--color-error-text, var(--color-error))' : 'var(--color-text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconTrash size={15} />
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              title={isExpanded ? 'Thu gọn (Esc)' : 'Mở rộng khung'}
              aria-label={isExpanded ? 'Thu gọn cửa sổ' : 'Mở rộng cửa sổ'}
              style={{
                width: 30,
                height: 30,
                borderRadius: 4,
                background: isExpanded
                  ? 'color-mix(in srgb, var(--color-sky) 16%, transparent)'
                  : 'var(--color-surface-elevated)',
                border: `1px solid ${isExpanded ? 'var(--color-sky)' : 'var(--color-border)'}`,
                color: isExpanded ? 'var(--color-sky)' : 'var(--color-text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isExpanded ? <IconMinimize size={15} /> : <IconMaximize size={15} />}
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Đóng (Esc)"
              aria-label="Đóng LOST AI"
              style={{
                width: 30,
                height: 30,
                borderRadius: 4,
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconX size={15} />
            </button>
          </div>
        </div>

        {/* 4-Mode Trail Assistant Tabs */}
        {!showSettings && (
          <div
            role="tablist"
            aria-label="Công cụ hỗ trợ chuẩn bị chuyến đi"
            style={{
              display: 'flex',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              background: 'var(--color-bg-main)',
              borderBottom: '1px solid var(--color-border)',
              padding: '0 8px',
              gap: 4,
              flexShrink: 0,
            }}
          >
            {(
              [
                { id: 'chat', label: 'Hỏi đáp', Icon: IconBot },
                { id: 'matchmaker', label: 'Chọn cung hợp sức', Icon: IconCompass },
                { id: 'pack_audit', label: 'Cân chỉnh balo', Icon: IconBackpack },
                { id: 'brief', label: 'Kế hoạch chuyến đi', Icon: IconFileText },
              ] as const
            ).map((tab) => {
              const isActive = activeSuiteTab === tab.id;
              const TabIcon = tab.Icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveSuiteTab(tab.id)}
                  style={{
                    flex: '1 0 auto',
                    padding: '8px 8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    fontSize: '0.72rem',
                    fontWeight: isActive ? 800 : 600,
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <TabIcon size={13} color={isActive ? 'var(--color-primary)' : 'var(--color-text-dim)'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Toast Banner (Strict Dual-Theme) */}
        {toastMessage && (
          <div
            style={{
              position: 'absolute',
              top: 64,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 40,
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-primary)',
              boxShadow: 'var(--shadow-card)',
              color: 'var(--color-primary)',
              padding: '6px 14px',
              borderRadius: 4,
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <IconCheck size={13} color="var(--color-primary)" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Drag-and-Drop GPX Overlay */}
        {isDragOverGpx && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 38,
              background: 'color-mix(in srgb, var(--color-bg-main) 92%, transparent)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              border: '2px dashed var(--color-primary)',
              margin: 8,
              borderRadius: 6,
              pointerEvents: 'none',
            }}
          >
            <IconFileText size={32} color="var(--color-primary)" />
            <div style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--color-text-main)', textAlign: 'center', padding: '0 16px' }}>
              Thả file .GPX hoặc ảnh chụp trên đường (JPG, PNG, WebP) vào đây nhé
            </div>
          </div>
        )}

        {/* Clear Confirmation Dialog (100% Dual-Theme Compliant) */}
        {showClearConfirm && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 35,
              background: 'var(--overlay-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-strong)',
                borderTop: '3px solid var(--color-error)',
                borderRadius: 6,
                padding: 20,
                maxWidth: 340,
                width: '100%',
                boxShadow: 'var(--shadow-3d)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--color-error) 14%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconTrash size={19} color="var(--color-error-text, var(--color-error))" />
              </div>

              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                Xóa cuộc trò chuyện này?
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                Các tin nhắn trong khung này sẽ bị xóa sạch và quay lại từ đầu.
              </p>

              <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 4,
                    border: '1px solid var(--color-border-strong)',
                    background: 'var(--color-surface-elevated)',
                    color: 'var(--color-text-main)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Giữ lại
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmClear()}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 4,
                    border: 'none',
                    background: 'var(--color-error)',
                    color: 'var(--color-on-danger)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Xóa ngay
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Body: Optional Sidebar + Active Pane */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
          {shouldShowSidebar && activeSuiteTab === 'chat' && !showSettings && (
            <AiThreadSidebar
              threads={threads}
              activeThreadId={activeThreadId}
              isCloudSynced={isCloudSynced}
              isCompactOverlay={!isSidebarDocked}
              onSelectThread={(id) => void handleSelectThread(id)}
              onCreateNewThread={handleCreateNewThread}
              onRenameThread={(id, t) => void handleRenameThread(id, t)}
              onTogglePinThread={(id, p) => void handleTogglePinThread(id, p)}
              onDeleteThread={(id) => void handleDeleteThread(id)}
              onClose={() => setShowSidebar(false)}
            />
          )}

          {/* Right Workspace: Settings OR Matchmaker OR Pack Auditor OR Chat */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
            {!showSettings && activeSuiteTab === 'matchmaker' ? (
              <AiTrailMatchWizard
                trails={trails}
                userCoords={getEffectiveCoords()}
                onSelectTrail={onSelectTrail}
                onCloseModal={onClose}
                onAskAiPrompt={(prompt, trailId) => {
                  setActiveSuiteTab('chat');
                  void handleSendMessage(prompt, trailId);
                }}
              />
            ) : !showSettings && activeSuiteTab === 'pack_audit' ? (
              <AiPackAuditor
                trails={trails}
                currentTrail={currentTrail}
                onToast={triggerToast}
              />
            ) : !showSettings && activeSuiteTab === 'brief' ? (
              <AiExpeditionBriefTab
                trails={trails}
                currentTrail={currentTrail}
                onToast={triggerToast}
                onSelectTrail={onSelectTrail}
                onCloseModal={onClose}
                onAskAiPrompt={(prompt, trailId) => {
                  setActiveSuiteTab('chat');
                  void handleSendMessage(prompt, trailId);
                }}
              />
            ) : showSettings ? (
              <div
                style={{
                  flex: 1,
                  padding: isExpanded ? '22px 28px' : 16,
                  overflowY: 'auto',
                  background: 'var(--color-bg-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--color-primary)' }}>
                    <IconSettings size={16} color="var(--color-primary)" />
                    <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                      Tùy chỉnh LOST AI
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    style={{
                      background: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border-strong)',
                      color: 'var(--color-text-main)',
                      borderRadius: 4,
                      padding: '5px 11px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Quay lại trò chuyện
                  </button>
                </div>

                {/* Preferred Region Selector (All 5 Regions, Accessible Buttons) */}
                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconMapPin size={14} color="var(--color-primary)" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                      Khu vực bạn hay đi
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    Mặc định sẽ lấy theo GPS trên máy. Bạn cũng có thể chọn sẵn vùng để mình gợi ý các cung gần chỗ bạn nhất:
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 7 }}>
                    {(
                      [
                        { id: 'auto', label: 'Tự động (GPS)', desc: 'Lấy theo vị trí máy' },
                        { id: 'north', label: 'Hà Nội & miền Bắc', desc: 'Fansipan, Lảo Thẩn, Tà Xùa...' },
                        { id: 'central', label: 'Đà Nẵng & miền Trung', desc: 'Giếng Trời, Bạch Mã, Khe Ram...' },
                        { id: 'taynguyen', label: 'Tây Nguyên', desc: 'Bidoup, Chư Yang Sin, Thác K50...' },
                        { id: 'south', label: 'TP.HCM & Nam Bộ', desc: 'Tà Năng, Bà Đen, Chứa Chan...' },
                      ] as const
                    ).map((r) => {
                      const isSelected = preferredRegion === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            setPreferredRegion(r.id);
                            safeLocalStorageSet('lost_preferred_region', r.id);
                            triggerToast(`Đã chuyển vùng ưu tiên: ${r.label}`);
                          }}
                          style={{
                            padding: '9px 10px',
                            borderRadius: 4,
                            background: isSelected
                              ? 'color-mix(in srgb, var(--color-primary) 13%, var(--color-bg-card))'
                              : 'var(--color-bg-card)',
                            border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                          }}
                        >
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isSelected ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                            {r.label}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>{r.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Engine Mode Selector (Actually Wired End-to-End!) */}
                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconCpu size={14} color="var(--color-sky)" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                      Cách LOST AI trả lời
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                    {(
                      [
                        {
                          id: 'auto',
                          title: 'Tự động linh hoạt',
                          badge: 'Khuyên dùng',
                          desc: 'Kết hợp Gemini khi có sóng tốt và dữ liệu thực địa sẵn có để trả lời nhanh.',
                          accent: 'var(--color-primary)',
                        },
                        {
                          id: 'knowledge',
                          title: 'Dữ liệu thực địa',
                          badge: 'Tiết kiệm 4G',
                          desc: 'Dùng hoàn toàn kho dữ liệu cung đường của LOST, phản hồi tức thì khi sóng yếu.',
                          accent: 'var(--color-earth)',
                        },
                        {
                          id: 'gemini',
                          title: 'Ưu tiên Gemini Live',
                          badge: 'Trả lời sâu',
                          desc: 'Gọi trực tiếp Gemini trên máy chủ kèm thẻ Go/No-Go, sơ cứu WFA và tính nước.',
                          accent: 'var(--color-sky)',
                        },
                      ] as const
                    ).map((m) => {
                      const active = engineMode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setEngineMode(m.id);
                            safeLocalStorageSet('lost_engine_mode', m.id);
                            triggerToast(`Đã đổi sang: ${m.title}`);
                          }}
                          style={{
                            padding: 10,
                            borderRadius: 4,
                            textAlign: 'left',
                            cursor: 'pointer',
                            background: active
                              ? `color-mix(in srgb, ${m.accent} 12%, var(--color-bg-card))`
                              : 'var(--color-bg-card)',
                            border: active ? `1.5px solid ${m.accent}` : '1px solid var(--color-border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: active ? m.accent : 'var(--color-text-main)' }}>
                              {m.title}
                            </span>
                            <span style={{ fontSize: '0.64rem', fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: `color-mix(in srgb, ${m.accent} 16%, transparent)`, color: m.accent }}>
                              {m.badge}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.71rem', color: 'var(--color-text-dim)', lineHeight: 1.4 }}>
                            {m.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Live Trail Context Strip */}
                {currentTrail && (
                  <div
                    style={{
                      padding: '7px 14px',
                      background: 'color-mix(in srgb, var(--color-sky) 10%, var(--color-bg-main))',
                      borderBottom: '1px solid var(--color-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      fontSize: '0.74rem',
                      color: 'var(--color-sky)',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <IconMountain size={13} color="var(--color-sky)" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Đang xem: <strong style={{ color: 'var(--color-text-main)' }}>{currentTrail.name}</strong> ({currentTrail.maxAltitudeM}m)
                      </span>
                      {activeTrailIncidentCount > 0 && (
                        <span
                          style={{
                            fontSize: '0.66rem',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: 'color-mix(in srgb, var(--color-error) 16%, transparent)',
                            color: 'var(--color-error-text, var(--color-error))',
                            flexShrink: 0,
                          }}
                        >
                          {activeTrailIncidentCount} cảnh báo
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      {Array.isArray(currentTrail.gpxTrack) && currentTrail.gpxTrack.length >= 2 && (
                        <button
                          type="button"
                          disabled={isAnalyzingGpx || isLoading}
                          onClick={() => void handleAnalyzeCurrentTrailGpx()}
                          style={{
                            background: 'var(--color-bg-card)',
                            color: 'var(--color-primary)',
                            border: '1px solid color-mix(in srgb, var(--color-primary) 45%, transparent)',
                            borderRadius: 4,
                            padding: '3px 7px',
                            fontSize: '0.69rem',
                            fontWeight: 700,
                            cursor: isAnalyzingGpx || isLoading ? 'not-allowed' : 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Đọc GPX
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleSendMessage(`Hôm nay có nên leo ${currentTrail.name} không (Go/No-Go)?`)}
                        style={{
                          background: 'var(--color-sky)',
                          color: 'var(--color-on-primary)',
                          borderRadius: 4,
                          padding: '3px 8px',
                          fontSize: '0.69rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Xem Go/No-Go
                      </button>
                    </div>
                  </div>
                )}

                {/* Chat Message Feed */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  {displayedMessages.map((msg) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isUser ? 'flex-end' : 'flex-start',
                          gap: 3,
                        }}
                      >
                        {!isUser && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingLeft: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: 4,
                                  background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <IconBot size={11} color="var(--color-primary)" />
                              </div>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-dim)' }}>
                                LOST AI
                              </span>
                              <span style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)' }}>· {msg.timestamp}</span>
                            </div>

                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {isTtsSupported && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleSpeakMessage(msg.id, msg.content)}
                                  title={speakingMsgId === msg.id ? 'Dừng đọc' : 'Nghe đọc câu trả lời'}
                                  aria-label={speakingMsgId === msg.id ? 'Dừng đọc câu trả lời' : 'Nghe đọc câu trả lời'}
                                  aria-pressed={speakingMsgId === msg.id}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    fontSize: '0.67rem',
                                    color: speakingMsgId === msg.id ? 'var(--color-primary)' : 'var(--color-text-dim)',
                                    cursor: 'pointer',
                                    padding: '2px 5px',
                                  }}
                                >
                                  {speakingMsgId === msg.id ? (
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                      <rect x="6" y="6" width="12" height="12" rx="2" />
                                    </svg>
                                  ) : (
                                    <svg
                                      width="11"
                                      height="11"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      aria-hidden="true"
                                    >
                                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                                    </svg>
                                  )}
                                  <span>{speakingMsgId === msg.id ? 'Dừng' : 'Nghe'}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => void handleCopyText(msg.id, msg.content)}
                                title="Sao chép câu trả lời"
                                aria-label="Sao chép câu trả lời"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  fontSize: '0.67rem',
                                  color: copiedId === msg.id ? 'var(--color-primary)' : 'var(--color-text-dim)',
                                  cursor: 'pointer',
                                  padding: '2px 5px',
                                }}
                              >
                                {copiedId === msg.id ? <IconCheck size={11} /> : <IconCopy size={11} />}
                                <span>{copiedId === msg.id ? 'Đã chép' : 'Chép'}</span>
                              </button>
                            </div>
                          </div>
                        )}

                        <div
                          style={{
                            maxWidth: isUser ? '86%' : '98%',
                            width: isUser ? 'auto' : '100%',
                            padding: isUser ? '9px 13px' : '12px 14px',
                            borderRadius: isUser ? '6px 6px 2px 6px' : '6px 6px 6px 2px',
                            background: isUser
                              ? 'var(--color-primary)'
                              : msg.isError
                                ? 'color-mix(in srgb, var(--color-error) 8%, var(--color-bg-main))'
                                : 'var(--color-bg-main)',
                            color: isUser ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                            border: isUser
                              ? 'none'
                              : msg.isError
                                ? '1px solid color-mix(in srgb, var(--color-error) 40%, transparent)'
                                : '1px solid var(--color-border)',
                            boxShadow: 'var(--shadow-card)',
                            wordBreak: 'break-word',
                          }}
                        >
                          {isUser && isSafeImageUrl(msg.imagePreviewUrl) && (
                            <div style={{ marginBottom: 6 }}>
                              <img
                                src={msg.imagePreviewUrl}
                                alt={msg.imageCaption || 'Ảnh thực địa đính kèm'}
                                style={{
                                  maxWidth: '100%',
                                  maxHeight: 168,
                                  borderRadius: 4,
                                  display: 'block',
                                  objectFit: 'cover',
                                  border: '1px solid color-mix(in srgb, var(--color-on-primary) 28%, transparent)',
                                }}
                              />
                            </div>
                          )}
                          <AiMarkdownRenderer content={msg.content} isUser={isUser} />

                          {msg.isError && msg.retryPrompt && (
                            <button
                              type="button"
                              onClick={() => void handleSendMessage(msg.retryPrompt)}
                              style={{
                                marginTop: 8,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '5px 10px',
                                borderRadius: 4,
                                background: 'var(--color-bg-card)',
                                border: '1px solid var(--color-error)',
                                color: 'var(--color-error-text, var(--color-error))',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              <IconRotateCw size={12} />
                              <span>Gửi lại</span>
                            </button>
                          )}

                          {msg.actions && msg.actions.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                              {msg.actions.map((act, actIdx) => (
                                <AiRichCards
                                  key={`${msg.id}-act-${actIdx}`}
                                  messageId={msg.id}
                                  action={act}
                                  actionIndex={actIdx}
                                  currentTrailId={currentTrail?.id}
                                  currentTrailName={currentTrail?.name}
                                  userCoords={userCoords}
                                  gpsStatus={gpsStatus}
                                  checkedGearItems={checkedGearItems}
                                  copiedId={copiedId}
                                  onToggleGearCheck={(key) =>
                                    setCheckedGearItems((prev) => ({ ...prev, [key]: !prev[key] }))
                                  }
                                  onCopyText={handleCopyText}
                                  onSelectTrail={onSelectTrail}
                                  onCloseModal={onClose}
                                  onSendQuickPrompt={(p) => void handleSendMessage(p)}
                                  onToast={triggerToast}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {isUser && (
                          <span style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)', paddingRight: 2 }}>
                            {msg.timestamp}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Typing / GPX Processing Indicator (Strict Dual-Theme) */}
                  {(isLoading || isAnalyzingGpx) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px' }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
                          border: '1px solid var(--color-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconBot size={13} color="var(--color-primary)" />
                      </div>
                      <div
                        style={{
                          padding: '7px 12px',
                          borderRadius: 6,
                          background: 'var(--color-bg-main)',
                          border: '1px solid var(--color-border)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: '0.76rem',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        <span>{isAnalyzingGpx ? 'Đang đọc độ dốc và cao độ file GPX...' : 'Đang tra thông tin đường rừng...'}</span>
                        {isLoading && (
                          <button
                            type="button"
                            onClick={() => abortRef.current?.abort()}
                            style={{
                              padding: '2px 7px',
                              borderRadius: 4,
                              border: '1px solid var(--color-border-strong)',
                              background: 'var(--color-surface-elevated)',
                              color: 'var(--color-text-main)',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Dừng
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Contextual Quick Prompts Strip */}
                {quickPrompts.length > 0 && (
                  <div
                    style={{
                      padding: '6px 12px',
                      background: 'var(--color-bg-main)',
                      borderTop: '1px solid var(--color-border)',
                      display: 'flex',
                      gap: 6,
                      overflowX: 'auto',
                      whiteSpace: 'nowrap',
                      scrollbarWidth: 'none',
                      flexShrink: 0,
                    }}
                  >
                    {quickPrompts.slice(0, 5).map((prompt, pIdx) => {
                      const cleanPrompt = removeEmojis(prompt);
                      return (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => void handleSendMessage(cleanPrompt)}
                          style={{
                            background: 'var(--color-bg-card)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-muted)',
                            borderRadius: 9999,
                            padding: '4px 10px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          {getPromptSvgIcon(cleanPrompt)}
                          <span>{cleanPrompt}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Auto-Growing Composer with GPX Upload, vi-VN Voice Input & Character Counter */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (isListeningVoice) stopVoiceRecognition();
                    void handleSendMessage();
                  }}
                  style={{
                    padding: '9px 12px',
                    background: 'var(--color-bg-card)',
                    borderTop: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    flexShrink: 0,
                  }}
                >
                  {isListeningVoice && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '5px 9px',
                        borderRadius: 4,
                        background: 'color-mix(in srgb, var(--color-error) 10%, var(--color-bg-main))',
                        border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
                        fontSize: '0.72rem',
                        color: 'var(--color-error-text, var(--color-error))',
                        fontWeight: 700,
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: 'var(--color-error)',
                            display: 'inline-block',
                            flexShrink: 0,
                          }}
                        />
                        <span>
                          {voiceInterimText ? `Đang nghe: "${voiceInterimText}"` : 'Mình đang nghe, bạn cứ nói nhé...'}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={stopVoiceRecognition}
                        style={{
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: 'var(--color-error)',
                          color: 'var(--color-on-danger)',
                          border: 'none',
                          fontSize: '0.67rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        Dừng
                      </button>
                    </div>
                  )}

                  {pendingImage && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '6px 8px',
                        borderRadius: 4,
                        background: 'var(--color-bg-main)',
                        border: '1px solid color-mix(in srgb, var(--color-primary) 45%, var(--color-border))',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <img
                          src={pendingImage.previewUrl}
                          alt={pendingImage.fileName}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 4,
                            objectFit: 'cover',
                            border: '1px solid var(--color-border)',
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              color: 'var(--color-text-main)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {pendingImage.fileName}
                          </div>
                          <div style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                            {pendingImage.width}×{pendingImage.height} · {Math.max(1, Math.round(pendingImage.byteSize / 1024))} KB · Sẵn sàng gửi ảnh
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemovePendingImage}
                        title="Gỡ ảnh đính kèm"
                        aria-label="Gỡ ảnh đính kèm"
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          border: '1px solid var(--color-border-strong)',
                          background: 'var(--color-bg-card)',
                          color: 'var(--color-text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconX size={13} />
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7 }}>
                    <input
                      ref={gpxInputRef}
                      type="file"
                      accept=".gpx,application/gpx+xml,application/xml,text/xml"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleProcessGpxFile(file);
                        e.target.value = '';
                      }}
                    />

                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleSelectPhotoFile(file);
                        e.target.value = '';
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isCompressingImage || isAnalyzingGpx || isLoading}
                      title="Gửi ảnh chụp trên đường (rắn, nấm, bầu trời, đồ đạc...) để hỏi nhanh"
                      aria-label="Đính kèm ảnh chụp trên đường"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        background: pendingImage
                          ? 'color-mix(in srgb, var(--color-primary) 16%, var(--color-bg-main))'
                          : 'var(--color-bg-main)',
                        border: `1px solid ${pendingImage ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
                        color: pendingImage ? 'var(--color-primary)' : 'var(--color-earth)',
                        cursor: isCompressingImage || isAnalyzingGpx || isLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                        <circle cx="12" cy="13" r="3" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => gpxInputRef.current?.click()}
                      disabled={isAnalyzingGpx || isLoading}
                      title="Gửi file .GPX để xem độ dốc và thời gian đi"
                      aria-label="Tải lên file GPX"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        background: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border-strong)',
                        color: 'var(--color-sky)',
                        cursor: isAnalyzingGpx || isLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <IconFileText size={16} color="var(--color-sky)" />
                    </button>

                    {isVoiceSupported && (
                      <button
                        type="button"
                        onClick={toggleVoiceRecognition}
                        disabled={isLoading || isAnalyzingGpx}
                        title={isListeningVoice ? 'Dừng thu giọng nói' : 'Nói để nhập câu hỏi'}
                        aria-label={isListeningVoice ? 'Dừng thu giọng nói' : 'Nói để nhập câu hỏi'}
                        aria-pressed={isListeningVoice}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 6,
                          background: isListeningVoice
                            ? 'color-mix(in srgb, var(--color-error) 16%, var(--color-bg-main))'
                            : 'var(--color-bg-main)',
                          border: `1px solid ${isListeningVoice ? 'var(--color-error)' : 'var(--color-border-strong)'}`,
                          color: isListeningVoice ? 'var(--color-error-text, var(--color-error))' : 'var(--color-primary)',
                          cursor: isLoading || isAnalyzingGpx ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isListeningVoice ? (
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <rect x="6" y="6" width="12" height="12" rx="2" />
                          </svg>
                        ) : (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="22" />
                          </svg>
                        )}
                      </button>
                    )}

                    <textarea
                      ref={textareaRef}
                      rows={1}
                      aria-label="Nhập câu hỏi cho LOST AI"
                      value={inputQuery}
                      onChange={(e) => setInputQuery(e.target.value.slice(0, MAX_INPUT_CHARS))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          if (isListeningVoice) stopVoiceRecognition();
                          void handleSendMessage();
                        }
                      }}
                      placeholder={
                        currentTrail
                          ? `Hỏi chuyện đường rừng, thời tiết, đồ đạc cho cung ${currentTrail.name}...`
                          : 'Hỏi nhanh chuyện đường rừng, thời tiết, đồ đạc, sơ cứu...'
                      }
                      disabled={isLoading || isAnalyzingGpx}
                      style={{
                        flex: 1,
                        resize: 'none',
                        minHeight: 38,
                        maxHeight: 120,
                        background: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: 6,
                        padding: '8px 12px',
                        color: 'var(--color-text-main)',
                        fontSize: '0.84rem',
                        lineHeight: 1.45,
                        outline: 'none',
                        fontFamily: 'var(--font-family)',
                      }}
                    />

                    <button
                      type="submit"
                      disabled={(!inputQuery.trim() && !pendingImage) || isLoading || isAnalyzingGpx || isCompressingImage}
                      aria-label="Gửi tin nhắn"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        background:
                          (inputQuery.trim() || pendingImage) && !isLoading ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
                        color:
                          (inputQuery.trim() || pendingImage) && !isLoading ? 'var(--color-on-primary)' : 'var(--color-text-dim)',
                        border: (inputQuery.trim() || pendingImage) && !isLoading ? 'none' : '1px solid var(--color-border)',
                        cursor: (inputQuery.trim() || pendingImage) && !isLoading ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <IconSend size={15} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.67rem', color: 'var(--color-text-dim)', padding: '0 2px' }}>
                    <span>Nhấn Enter để gửi · Shift+Enter xuống dòng · kéo thả ảnh hoặc .GPX</span>
                    <span
                      style={{
                        fontVariantNumeric: 'tabular-nums',
                        color: inputQuery.length > MAX_INPUT_CHARS - 150 ? 'var(--color-error-text, var(--color-error))' : 'var(--color-text-dim)',
                      }}
                    >
                      {inputQuery.length}/{MAX_INPUT_CHARS}
                    </span>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
