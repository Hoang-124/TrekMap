import React, { useState, useRef, useEffect } from 'react';
import {
  IconFileText,
  IconShieldCheck,
  IconShieldAlert,
  IconAlertTriangle,
  IconCalendar,
  IconClock,
  IconPhone,
  IconMapPin,
  IconCheck,
  IconBackpack,
  IconMountain,
  IconDroplet,
  IconUsers,
  IconCompass,
} from '../common/SvgIcons.js';
import { mockTrails } from '../../data/seedData.js';
import {
  generateExpeditionBriefApi,
  computeReadinessAuditApi,
  applyItineraryToTrail,
  applyGearItemsToTrailChecklist,
} from '../../services/aiAssistant.service.js';
import type { Trail } from '../../types.js';
import type { AiFitnessLevel, ExpeditionBriefResult, ReadinessAuditResult } from './ai.types.js';

interface AiExpeditionBriefTabProps {
  trails?: Trail[];
  currentTrail?: Trail | null;
  onToast: (msg: string) => void;
  onAskAiPrompt?: (prompt: string) => void;
  onSelectTrail?: (trailId: string) => void;
  onCloseModal?: () => void;
}

function getVietnamTodayIso(): string {
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

function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')} đ`;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildDossierMarkdown(
  brief: ExpeditionBriefResult,
  readinessAudit?: ReadinessAuditResult | null
): string {
  const lines: string[] = [
    `# LOST — HỒ SƠ CHUYẾN ĐI THÁM HIỂM: ${brief.trail.name.toUpperCase()}`,
    '',
    `- **Ngày khởi hành**: ${brief.departureDate}`,
    `- **Quy mô đoàn**: ${brief.groupSize} thành viên · Thể lực: ${brief.fitnessLevel === 'beginner' ? 'Người mới' : brief.fitnessLevel === 'advanced' ? 'Kinh nghiệm' : 'Trung bình'}`,
    `- **Địa bàn**: ${brief.trail.district}, ${brief.trail.province} (${brief.trail.region})`,
    `- **Thông số tuyến**: Đỉnh ${brief.trail.maxAltitudeM.toLocaleString('vi-VN')}m · ${brief.trail.distanceKm} km · +${brief.trail.elevationGainM.toLocaleString('vi-VN')}m · Cấp ${brief.trail.difficultyLevel}/5 (${brief.trail.difficultyNote})`,
    `- **Thời lượng**: ${brief.trail.durationHoursNote || `${brief.trail.durationDays} ngày`}`,
    '',
  ];

  if (readinessAudit && readinessAudit.trailId === brief.trail.id) {
    lines.push('## 0. Đánh giá Mức độ Sẵn sàng Pre-Flight (0–100)');
    lines.push(
      `- **Điểm tổng hợp**: **${readinessAudit.readinessScore}/100** — **${readinessAudit.verdictLabel}** (Ngày ${readinessAudit.departureDate} · Balo ${readinessAudit.inputs.packWeightKg}kg / ${readinessAudit.inputs.bodyWeightKg}kg = ${readinessAudit.inputs.packRatioPercent}%)`
    );
    for (const pl of readinessAudit.pillars) {
      lines.push(`- **${pl.label} (${pl.score}/100, trọng số ${pl.weightPct}%)**: ${pl.summary}`);
    }
    if (readinessAudit.topFixes.length > 0) {
      lines.push('- **Ưu tiên xử lý trước khi xuất phát**:');
      for (const fx of readinessAudit.topFixes) {
        const pri = fx.priority === 'critical' ? '[KHẨN]' : fx.priority === 'high' ? '[CAO]' : '[LƯU Ý]';
        lines.push(`  - ${pri} **${fx.title}**: ${fx.action}`);
      }
    }
    lines.push('');
  }

  if (brief.goNoGo) {
    lines.push('## 1. Đánh giá Go / No-Go & Thời tiết Đỉnh');
    lines.push(`- **Phán quyết**: **${brief.goNoGo.verdictLabel}** (${brief.goNoGo.score}/100 điểm)`);
    if (brief.goNoGo.weatherSummary) {
      const w = brief.goNoGo.weatherSummary;
      lines.push(
        `- **Thời tiết đỉnh**: ${w.summitTempMinC ?? w.tempMinC}°C – ${w.summitTempMaxC ?? w.tempMaxC}°C · Mưa ${w.precipMm} mm · Gió ${w.windSpeedKmH} km/h (${w.conditionLabel})`
      );
    }
    lines.push(`- **Nhận định**: ${brief.goNoGo.advice}`);
    lines.push('');
  }

  lines.push('## 2. Chỉ số Sinh học Leo núi (Naismith & Tobler)');
  lines.push(`- **Thời gian di chuyển ước tính**: ${brief.bioMetrics.recommendedMovingHours}h (Naismith ${brief.bioMetrics.naismithHours}h / Tobler ${brief.bioMetrics.toblerHours}h) · Tổng gồm nghỉ: ~${brief.bioMetrics.estimatedTotalTripHours}h`);
  lines.push(`- **Nước & Điện giải**: ${brief.bioMetrics.waterLitersTotal}L tổng (${brief.bioMetrics.waterLitersPerDay}L/ngày) + ${brief.bioMetrics.oresolPackets} gói Oresol`);
  lines.push(`- **Năng lượng & Tải balo**: ${brief.bioMetrics.caloriesActiveKcal.toLocaleString('vi-VN')} kcal vận động · Tỷ lệ balo ${brief.bioMetrics.packRatioPercent}% (${brief.bioMetrics.packAdvice})`);
  lines.push(`- **Độ cao & AMS**: ${brief.bioMetrics.amsAdvice}`);
  lines.push('');

  lines.push('## 3. Trạm Kiểm lâm / VQG & Thủ tục Giấy phép (Xác thực)');
  lines.push(`- **Đơn vị quản lý**: ${brief.rangerStation.name}`);
  lines.push(`- **Địa chỉ**: ${brief.rangerStation.address}`);
  lines.push(`- **Đường dây nóng**: ${brief.rangerStation.hotlinePhone} | Khẩn cấp: ${brief.rangerStation.emergencyPhone} | Quốc gia: 112 / 114 / 115`);
  lines.push(`- **Giờ làm việc**: ${brief.rangerStation.officeHours}`);
  lines.push(`- **Thủ tục giấy phép**: ${brief.rangerStation.permitFeeNote}`);
  lines.push('');

  lines.push('## 4. Lịch trình Chi tiết Theo Ngày & Giờ');
  for (const step of brief.itinerarySteps) {
    lines.push(`- **Ngày ${step.day} · ${step.time} — ${step.title}**${step.locationNote ? ` (${step.locationNote})` : ''}: ${step.description}`);
  }
  lines.push('');

  lines.push(`## 5. Danh sách Trang bị Sinh tồn (${(brief.totalChecklistGrams / 1000).toFixed(1)} kg ước tính)`);
  for (const item of brief.survivalChecklist) {
    lines.push(`- [ ] **${item.name}** (${item.category} · ${item.weightGrams}g)${item.isEssential ? ' [BẮT BUỘC]' : ''} — ${item.reason}`);
  }
  lines.push('');

  lines.push(`## 6. Dự toán Ngân sách Thực tế (${brief.budget.groupSize} người · ${brief.budget.days} ngày)`);
  lines.push('| Hạng mục | Chi tiết | /Người | Cả đoàn |');
  lines.push('| --- | --- | ---: | ---: |');
  for (const l of brief.budget.lines) {
    lines.push(`| ${l.label} | ${l.detail} | ${formatVnd(l.perPersonVnd)} | ${formatVnd(l.groupTotalVnd)} |`);
  }
  lines.push(`| Dự phòng khẩn cấp (15%) | Dự phòng thời tiết, y tế, phát sinh | ${formatVnd(brief.budget.contingencyPerPersonVnd)} | ${formatVnd(brief.budget.contingencyPerPersonVnd * brief.budget.groupSize)} |`);
  lines.push(`| **TỔNG DỰ TOÁN** | **Đã bao gồm 15% dự phòng** | **${formatVnd(brief.budget.grandTotalPerPersonVnd)}** | **${formatVnd(brief.budget.grandTotalGroupVnd)}** |`);
  lines.push('');
  lines.push(`*${brief.budget.note}*`);
  lines.push('');

  lines.push('## 7. Lưu ý An toàn Thực địa');
  for (const note of brief.safetyNotes) {
    lines.push(`- ${note}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('*Hồ sơ xuất từ LOST AI — Hệ thống Bản đồ & An toàn Leo núi Việt Nam. Luôn lưu sẵn tổng đài 112 / 114 / 115.*');
  return lines.join('\n');
}

function buildPrintableDossierHtml(
  brief: ExpeditionBriefResult,
  readinessAudit?: ReadinessAuditResult | null
): string {
  const verdictText = brief.goNoGo
    ? `${brief.goNoGo.verdictLabel} (${brief.goNoGo.score}/100)`
    : 'Chế độ ngoại tuyến (kiểm tra thời tiết khi có mạng)';

  const readinessSection =
    readinessAudit && readinessAudit.trailId === brief.trail.id
      ? `<div class="box" style="margin-bottom:8px"><p><strong>Kiểm toán Sẵn sàng Pre-Flight:</strong> ${readinessAudit.readinessScore}/100 — ${escapeHtml(readinessAudit.verdictLabel)} (Quay đầu ${escapeHtml(readinessAudit.snapshot.safeTurnaroundTime)} · Hoàng hôn ${escapeHtml(readinessAudit.snapshot.noaaSunset)} · Nước ${readinessAudit.snapshot.carryWaterPerLegLiters}L · ${readinessAudit.snapshot.oresolPacketsTotal} Oresol)</p>${
          readinessAudit.topFixes.length > 0
            ? `<ul>${readinessAudit.topFixes
                .map((fx) => `<li><strong>${escapeHtml(fx.title)}:</strong> ${escapeHtml(fx.action)}</li>`)
                .join('')}</ul>`
            : ''
        }</div>`
      : '';

  const weatherRow = brief.goNoGo?.weatherSummary
    ? `<p><strong>Thời tiết đỉnh dự báo:</strong> ${brief.goNoGo.weatherSummary.summitTempMinC ?? brief.goNoGo.weatherSummary.tempMinC}°C – ${brief.goNoGo.weatherSummary.summitTempMaxC ?? brief.goNoGo.weatherSummary.tempMaxC}°C · Mưa ${brief.goNoGo.weatherSummary.precipMm} mm · Gió ${brief.goNoGo.weatherSummary.windSpeedKmH} km/h (${escapeHtml(brief.goNoGo.weatherSummary.conditionLabel)})</p>`
    : '';

  const itineraryRows = brief.itinerarySteps
    .map(
      (s) =>
        `<tr><td><strong>Ngày ${s.day} · ${escapeHtml(s.time)}</strong></td><td><strong>${escapeHtml(s.title)}</strong>${s.locationNote ? ` <em>(${escapeHtml(s.locationNote)})</em>` : ''}<br/>${escapeHtml(s.description)}</td></tr>`
    )
    .join('');

  const gearRows = brief.survivalChecklist
    .map(
      (g) =>
        `<tr><td>[ ]</td><td><strong>${escapeHtml(g.name)}</strong>${g.isEssential ? ' <strong>[BẮT BUỘC]</strong>' : ''}<br/><small>${escapeHtml(g.reason)}</small></td><td>${escapeHtml(g.category)}</td><td class="num">${g.weightGrams}g</td></tr>`
    )
    .join('');

  const budgetRows = brief.budget.lines
    .map(
      (b) =>
        `<tr><td><strong>${escapeHtml(b.label)}</strong><br/><small>${escapeHtml(b.detail)}</small></td><td class="num">${escapeHtml(formatVnd(b.perPersonVnd))}</td><td class="num">${escapeHtml(formatVnd(b.groupTotalVnd))}</td></tr>`
    )
    .join('');

  const safetyLis = brief.safetyNotes.map((n) => `<li>${escapeHtml(n)}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>LOST — Hồ Sơ Chuyến Đi ${escapeHtml(brief.trail.name)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif; color: black; background: white; font-size: 11px; line-height: 1.5; margin: 0; }
    header { border-bottom: 2px solid black; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; }
    h1 { font-size: 16px; margin: 0 0 4px 0; letter-spacing: -0.01em; }
    h2 { font-size: 12px; text-transform: uppercase; border-bottom: 1px solid silver; padding-bottom: 3px; margin: 14px 0 6px 0; }
    p { margin: 3px 0; }
    .meta { color: dimgray; font-size: 10px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 8px 0; }
    .kpi { border: 1px solid silver; padding: 6px 8px; border-radius: 3px; }
    .kpi-label { font-size: 9px; color: dimgray; text-transform: uppercase; }
    .kpi-val { font-size: 12px; font-weight: 800; font-variant-numeric: tabular-nums; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10.5px; }
    th, td { border: 1px solid silver; padding: 5px 7px; text-align: left; vertical-align: top; }
    th { background: whitesmoke; font-weight: 700; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .box { border: 1px solid gray; padding: 8px 10px; border-radius: 3px; margin-top: 6px; }
    ul { margin: 4px 0; padding-left: 16px; }
    li { margin-bottom: 3px; }
    footer { margin-top: 14px; border-top: 1px solid silver; padding-top: 6px; font-size: 9.5px; color: dimgray; text-align: center; }
  </style>
</head>
<body>
  <header>
    <div>
      <div class="meta">LOST — HỒ SƠ CHUYẾN ĐI THÁM HIỂM &amp; AN TOÀN NÚI CAO VIỆT NAM</div>
      <h1>${escapeHtml(brief.trail.name)} (${brief.trail.maxAltitudeM.toLocaleString('vi-VN')}m)</h1>
      <div class="meta">${escapeHtml(brief.trail.district)}, ${escapeHtml(brief.trail.province)} · ${brief.trail.distanceKm} km · +${brief.trail.elevationGainM.toLocaleString('vi-VN')}m · Cấp ${brief.trail.difficultyLevel}/5</div>
    </div>
    <div style="text-align:right">
      <div><strong>Khởi hành:</strong> ${escapeHtml(brief.departureDate)}</div>
      <div><strong>Đoàn:</strong> ${brief.groupSize} người · ${brief.trail.durationDays} ngày</div>
      <div><strong>Go/No-Go:</strong> ${escapeHtml(verdictText)}</div>
    </div>
  </header>

  ${weatherRow}
  ${readinessSection}

  <div class="grid">
    <div class="kpi"><div class="kpi-label">Giờ di chuyển</div><div class="kpi-val">${brief.bioMetrics.recommendedMovingHours}h (tổng ~${brief.bioMetrics.estimatedTotalTripHours}h)</div></div>
    <div class="kpi"><div class="kpi-label">Nước &amp; Oresol</div><div class="kpi-val">${brief.bioMetrics.waterLitersTotal}L · ${brief.bioMetrics.oresolPackets} gói</div></div>
    <div class="kpi"><div class="kpi-label">Năng lượng</div><div class="kpi-val">${brief.bioMetrics.caloriesActiveKcal.toLocaleString('vi-VN')} kcal</div></div>
    <div class="kpi"><div class="kpi-label">Tỷ lệ balo</div><div class="kpi-val">${brief.bioMetrics.packRatioPercent}% thể trọng</div></div>
  </div>

  <h2>1. Trạm Kiểm Lâm / VQG &amp; Liên Hệ Khẩn Cấp</h2>
  <div class="box">
    <p><strong>${escapeHtml(brief.rangerStation.name)}</strong></p>
    <p>Địa chỉ: ${escapeHtml(brief.rangerStation.address)} · Giờ trực: ${escapeHtml(brief.rangerStation.officeHours)}</p>
    <p><strong>Hotline:</strong> ${escapeHtml(brief.rangerStation.hotlinePhone)} · <strong>Khẩn cấp:</strong> ${escapeHtml(brief.rangerStation.emergencyPhone)} · <strong>Quốc gia:</strong> 112 / 114 / 115</p>
    <p><strong>Giấy phép:</strong> ${escapeHtml(brief.rangerStation.permitFeeNote)}</p>
  </div>

  <h2>2. Lịch Trình Theo Ngày &amp; Giờ</h2>
  <table>
    <thead><tr><th style="width:110px">Thời điểm</th><th>Hoạt động &amp; Mốc thực địa</th></tr></thead>
    <tbody>${itineraryRows}</tbody>
  </table>

  <h2>3. Danh Sách Trang Bị Sinh Tồn (~${(brief.totalChecklistGrams / 1000).toFixed(1)} kg)</h2>
  <table>
    <thead><tr><th style="width:28px">OK</th><th>Trang bị &amp; Lý do thực địa</th><th style="width:95px">Nhóm</th><th class="num" style="width:60px">Nặng</th></tr></thead>
    <tbody>${gearRows}</tbody>
  </table>

  <h2>4. Dự Toán Ngân Sách Thực Tế (${brief.budget.groupSize} người · ${brief.budget.days} ngày)</h2>
  <table>
    <thead><tr><th>Hạng mục</th><th class="num">/Người</th><th class="num">Cả đoàn</th></tr></thead>
    <tbody>
      ${budgetRows}
      <tr><td><strong>Dự phòng khẩn cấp (15%)</strong></td><td class="num">${escapeHtml(formatVnd(brief.budget.contingencyPerPersonVnd))}</td><td class="num">${escapeHtml(formatVnd(brief.budget.contingencyPerPersonVnd * brief.budget.groupSize))}</td></tr>
      <tr><td><strong>TỔNG CỘNG DỰ TOÁN</strong></td><td class="num"><strong>${escapeHtml(formatVnd(brief.budget.grandTotalPerPersonVnd))}</strong></td><td class="num"><strong>${escapeHtml(formatVnd(brief.budget.grandTotalGroupVnd))}</strong></td></tr>
    </tbody>
  </table>
  <p class="meta">${escapeHtml(brief.budget.note)}</p>

  <h2>5. Lưu Ý An Toàn Thực Địa</h2>
  <ul>${safetyLis}</ul>

  <footer>LOST AI — Bản đồ Thám hiểm &amp; An toàn Leo núi Việt Nam · Xuất ngày ${escapeHtml(brief.departureDate)}</footer>
</body>
</html>`;
}

export const AiExpeditionBriefTab: React.FC<AiExpeditionBriefTabProps> = ({
  trails,
  currentTrail,
  onToast,
  onAskAiPrompt,
  onSelectTrail,
  onCloseModal,
}) => {
  const trailCatalog = trails && trails.length > 0 ? trails : mockTrails;
  const initialTrailId = currentTrail?.id || trailCatalog[0]?.id || 'trail-fansipan';

  const [prevPropTrailId, setPrevPropTrailId] = useState<string | undefined>(currentTrail?.id);
  const [selectedTrailId, setSelectedTrailId] = useState<string>(initialTrailId);
  const [departureDate, setDepartureDate] = useState<string>(() => getVietnamTodayIso());
  const [groupSize, setGroupSize] = useState<number>(4);
  const [fitnessLevel, setFitnessLevel] = useState<AiFitnessLevel>('intermediate');
  const [bodyWeightKg, setBodyWeightKg] = useState<number>(62);
  const [bodyWeightInput, setBodyWeightInput] = useState<string>('62');
  const [packWeightKg, setPackWeightKg] = useState<number>(() =>
    (currentTrail?.durationDays ?? 2) >= 2 ? 9 : 4.5
  );
  const [packWeightInput, setPackWeightInput] = useState<string>(() =>
    String((currentTrail?.durationDays ?? 2) >= 2 ? 9 : 4.5)
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [brief, setBrief] = useState<ExpeditionBriefResult | null>(null);
  const [readinessLoading, setReadinessLoading] = useState<boolean>(false);
  const [readinessAudit, setReadinessAudit] = useState<ReadinessAuditResult | null>(null);
  const [appliedItinerary, setAppliedItinerary] = useState<boolean>(false);
  const [appliedGear, setAppliedGear] = useState<boolean>(false);

  // Sync selectedTrailId when parent currentTrail changes while modal remains mounted (zero useEffect setState)
  if (currentTrail?.id && currentTrail.id !== prevPropTrailId) {
    const nextPack = currentTrail.durationDays >= 2 ? 9 : 4.5;
    setPrevPropTrailId(currentTrail.id);
    setSelectedTrailId(currentTrail.id);
    setPackWeightKg(nextPack);
    setPackWeightInput(String(nextPack));
    setLoading(false);
    setReadinessLoading(false);
    setBrief(null);
    setReadinessAudit(null);
    setAppliedItinerary(false);
    setAppliedGear(false);
  }

  const cleanupTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const pendingBlobUrlsRef = useRef<Set<string>>(new Set());
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);
  const briefAbortRef = useRef<AbortController | null>(null);
  const briefReqIdRef = useRef<number>(0);
  const readinessAbortRef = useRef<AbortController | null>(null);
  const readinessReqIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // Abort in-flight brief/readiness requests & bump request IDs whenever selectedTrailId changes (prop sync OR dropdown)
  useEffect(() => {
    return () => {
      briefAbortRef.current?.abort();
      briefReqIdRef.current += 1;
      readinessAbortRef.current?.abort();
      readinessReqIdRef.current += 1;
    };
  }, [selectedTrailId]);

  useEffect(() => {
    isMountedRef.current = true;
    const timers = cleanupTimersRef.current;
    const blobUrls = pendingBlobUrlsRef.current;
    return () => {
      isMountedRef.current = false;
      briefAbortRef.current?.abort();
      readinessAbortRef.current?.abort();
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      for (const u of blobUrls) {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // ignore
        }
      }
      blobUrls.clear();
      if (printFrameRef.current && printFrameRef.current.parentNode) {
        printFrameRef.current.parentNode.removeChild(printFrameRef.current);
        printFrameRef.current = null;
      }
    };
  }, []);

  const commitBodyWeight = (raw: string): number => {
    const parsed = Number(raw.replace(',', '.'));
    const clamped = Number.isFinite(parsed) && raw.trim() !== '' ? Math.max(35, Math.min(150, Math.round(parsed))) : bodyWeightKg;
    setBodyWeightKg(clamped);
    setBodyWeightInput(String(clamped));
    return clamped;
  };

  const commitPackWeight = (raw: string): number => {
    const parsed = Number(raw.replace(',', '.'));
    const clamped =
      Number.isFinite(parsed) && raw.trim() !== ''
        ? Math.max(0, Math.min(35, Math.round(parsed * 10) / 10))
        : packWeightKg;
    setPackWeightKg(clamped);
    setPackWeightInput(String(clamped));
    return clamped;
  };

  const handleTrailChange = (nextId: string) => {
    briefAbortRef.current?.abort();
    briefReqIdRef.current += 1;
    readinessAbortRef.current?.abort();
    readinessReqIdRef.current += 1;
    setSelectedTrailId(nextId);
    const chosen = trailCatalog.find((t) => t.id === nextId);
    if (chosen) {
      const nextPack = chosen.durationDays >= 2 ? 9 : 4.5;
      setPackWeightKg(nextPack);
      setPackWeightInput(String(nextPack));
    }
    setLoading(false);
    setReadinessLoading(false);
    setReadinessAudit(null);
    setAppliedItinerary(false);
    setAppliedGear(false);
  };

  const handleRunReadinessAudit = async () => {
    const resolvedBodyKg = commitBodyWeight(bodyWeightInput);
    const resolvedPackKg = commitPackWeight(packWeightInput);
    readinessAbortRef.current?.abort();
    const ctrl = new AbortController();
    readinessAbortRef.current = ctrl;
    const reqId = ++readinessReqIdRef.current;

    setReadinessLoading(true);
    try {
      const res = await computeReadinessAuditApi(
        {
          trailId: selectedTrailId,
          departureDate,
          bodyWeightKg: resolvedBodyKg,
          packWeightKg: resolvedPackKg,
          fitnessLevel,
          groupSize,
        },
        ctrl.signal
      );
      if (isMountedRef.current && reqId === readinessReqIdRef.current) {
        if (res) {
          setReadinessAudit(res);
          onToast(`Sẵn sàng ${res.trailName}: ${res.readinessScore}/100 (${res.verdictLabel})`);
        } else {
          onToast('Không thể kết nối máy chủ kiểm tra sẵn sàng lúc này.');
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (isMountedRef.current && reqId === readinessReqIdRef.current) {
        onToast(err instanceof Error && err.message ? err.message : 'Lỗi kiểm tra mức độ sẵn sàng.');
      }
    } finally {
      if (isMountedRef.current && reqId === readinessReqIdRef.current) {
        setReadinessLoading(false);
      }
    }
  };

  const handleGenerateBrief = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const resolvedBodyKg = commitBodyWeight(bodyWeightInput);
    const resolvedPackKg = commitPackWeight(packWeightInput);
    briefAbortRef.current?.abort();
    const ctrl = new AbortController();
    briefAbortRef.current = ctrl;
    const reqId = ++briefReqIdRef.current;

    setLoading(true);
    setAppliedItinerary(false);
    setAppliedGear(false);
    try {
      const result = await generateExpeditionBriefApi(
        {
          trailId: selectedTrailId,
          departureDate,
          groupSize,
          fitnessLevel,
          bodyWeightKg: resolvedBodyKg,
          packWeightKg: resolvedPackKg,
        },
        trailCatalog,
        ctrl.signal
      );
      if (isMountedRef.current && reqId === briefReqIdRef.current) {
        setBrief(result);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
    } finally {
      if (isMountedRef.current && reqId === briefReqIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleApplyItinerary = () => {
    if (!brief) return;
    applyItineraryToTrail(
      brief.trail.id,
      `Lịch trình ${brief.trail.name} (${brief.departureDate})`,
      brief.itinerarySteps
    );
    setAppliedItinerary(true);
    onToast(`Đã áp dụng ${brief.itinerarySteps.length} mốc lịch trình cho ${brief.trail.name}!`);
  };

  const handleApplyChecklist = async () => {
    if (!brief) return;
    const res = await applyGearItemsToTrailChecklist(
      brief.trail.id,
      brief.trail.name,
      brief.survivalChecklist.map((item) => ({
        name: item.name,
        category: item.category,
        weightGrams: item.weightGrams,
        isEssential: item.isEssential,
        reason: item.reason,
      })),
      {
        bodyWeightKg,
        durationDays: brief.trail.durationDays,
      }
    );
    setAppliedGear(true);
    onToast(
      res.addedCount > 0
        ? `Đã thêm ${res.addedCount} món sinh tồn vào Checklist ${brief.trail.name}${res.cloudSynced ? ' (đồng bộ đám mây)' : ''}!`
        : `Toàn bộ trang bị đã có sẵn trong Checklist ${brief.trail.name}.`
    );
  };

  const handleDownloadMarkdown = () => {
    if (!brief) return;
    try {
      const md = buildDossierMarkdown(brief, readinessAudit);
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      pendingBlobUrlsRef.current.add(url);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LOST-Ho-So-${brief.trail.id}-${brief.departureDate}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      const t = setTimeout(() => {
        URL.revokeObjectURL(url);
        pendingBlobUrlsRef.current.delete(url);
      }, 1500);
      cleanupTimersRef.current.push(t);
      onToast(`Đã tải Hồ sơ Markdown (.md) cho ${brief.trail.name}!`);
    } catch {
      onToast('Không thể tải file Markdown trên trình duyệt này.');
    }
  };

  const handlePrintDossier = () => {
    if (!brief || typeof document === 'undefined') return;
    try {
      if (printFrameRef.current && printFrameRef.current.parentNode) {
        printFrameRef.current.parentNode.removeChild(printFrameRef.current);
      }
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.position = 'fixed';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);
      printFrameRef.current = iframe;

      const cleanupIframe = () => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        if (printFrameRef.current === iframe) printFrameRef.current = null;
      };

      const html = buildPrintableDossierHtml(brief, readinessAudit);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        iframe.contentWindow?.addEventListener('afterprint', cleanupIframe, { once: true });
        const triggerTimer = setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch {
            cleanupIframe();
            window.print();
          }
        }, 180);
        // Generous 10-minute fallback safety net in case browser doesn't emit afterprint
        const fallbackCleanupTimer = setTimeout(cleanupIframe, 10 * 60_000);
        cleanupTimersRef.current.push(triggerTimer, fallbackCleanupTimer);
      } else {
        cleanupIframe();
        window.print();
      }
    } catch {
      window.print();
    }
  };

  const goNoGoAccent =
    !brief?.goNoGo
      ? 'var(--color-sky)'
      : brief.goNoGo.verdict === 'GO'
      ? 'var(--color-primary)'
      : brief.goNoGo.verdict === 'CAUTION'
      ? 'var(--color-earth)'
      : 'var(--color-error)';

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: 'var(--color-bg-card)',
      }}
    >
      {/* Expedition Dossier Builder Form */}
      <form
        onSubmit={(e) => void handleGenerateBrief(e)}
        style={{
          background: 'var(--color-bg-main)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-primary)', fontWeight: 800, fontSize: '0.82rem' }}>
            <IconFileText size={15} color="var(--color-primary)" />
            <span>LẬP HỒ SƠ CHUYẾN ĐI TOÀN DIỆN (PRE-TRIP DOSSIER)</span>
          </div>
          <span style={{ fontSize: '0.69rem', color: 'var(--color-text-dim)' }}>
            Go/No-Go · Naismith · Kiểm lâm · Lịch trình · Ngân sách VNĐ
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: 8 }}>
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              gridColumn: '1 / -1',
            }}
          >
            <span>Cung đường thám hiểm ({trailCatalog.length} tuyến thực địa)</span>
            <select
              value={selectedTrailId}
              onChange={(e) => handleTrailChange(e.target.value)}
              style={{
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-main)',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-family)',
              }}
            >
              {trailCatalog.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.maxAltitudeM.toLocaleString('vi-VN')}m · {t.province})
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
            <span>Ngày khởi hành</span>
            <input
              type="date"
              min={getVietnamTodayIso()}
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              style={{
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-main)',
                fontSize: '0.76rem',
                fontFamily: 'var(--font-family)',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
            <span>Số thành viên (1–12)</span>
            <input
              type="number"
              min={1}
              max={12}
              value={groupSize}
              onChange={(e) => setGroupSize(Math.max(1, Math.min(12, Math.round(Number(e.target.value) || 1))))}
              style={{
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-main)',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-family)',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
            <span>Thể lực nhóm</span>
            <select
              value={fitnessLevel}
              onChange={(e) => setFitnessLevel(e.target.value as AiFitnessLevel)}
              style={{
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-main)',
                fontSize: '0.76rem',
                fontFamily: 'var(--font-family)',
              }}
            >
              <option value="beginner">Người mới (Chậm)</option>
              <option value="intermediate">Trung bình (Chuẩn)</option>
              <option value="advanced">Kinh nghiệm (Nhanh)</option>
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
            <span>Cân nặng / Balo (kg)</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="number"
                aria-label="Cân nặng cơ thể (kg)"
                min={35}
                max={150}
                value={bodyWeightInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setBodyWeightInput(raw);
                  const n = Number(raw);
                  if (raw.trim() !== '' && Number.isFinite(n) && n >= 35 && n <= 150) {
                    setBodyWeightKg(Math.round(n));
                  }
                }}
                onBlur={() => commitBodyWeight(bodyWeightInput)}
                style={{
                  width: '50%',
                  padding: '6px 6px',
                  borderRadius: 4,
                  border: '1px solid var(--color-border-strong)',
                  background: 'var(--color-bg-card)',
                  color: 'var(--color-text-main)',
                  fontSize: '0.76rem',
                  fontFamily: 'var(--font-family)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
              <input
                type="number"
                aria-label="Trọng lượng balo (kg)"
                min={0}
                max={35}
                step={0.5}
                value={packWeightInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setPackWeightInput(raw);
                  const n = Number(raw);
                  if (raw.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 35) {
                    setPackWeightKg(Math.round(n * 10) / 10);
                  }
                }}
                onBlur={() => commitPackWeight(packWeightInput)}
                style={{
                  width: '50%',
                  padding: '6px 6px',
                  borderRadius: 4,
                  border: '1px solid var(--color-border-strong)',
                  background: 'var(--color-bg-card)',
                  color: 'var(--color-text-main)',
                  fontSize: '0.76rem',
                  fontFamily: 'var(--font-family)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
            </div>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '9px 14px',
            borderRadius: 4,
            border: 'none',
            background: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            fontSize: '0.8rem',
            fontWeight: 800,
            cursor: loading ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
          }}
        >
          <IconFileText size={14} color="var(--color-on-primary)" />
          <span>{loading ? 'Đang tổng hợp thời tiết, kiểm lâm & dự toán...' : 'Lập Hồ Sơ Chuyến Đi Ngay'}</span>
        </button>

        {/* Wave 16A Quick Calculators Strip (Readiness 0-100 + NOAA Pace + Nutrition/Oresol) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button
            type="button"
            disabled={readinessLoading}
            onClick={() => void handleRunReadinessAudit()}
            style={{
              flex: '1 1 155px',
              padding: '7px 10px',
              borderRadius: 4,
              border: '1px solid var(--color-primary)',
              background: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card))',
              color: 'var(--color-text-main)',
              fontSize: '0.73rem',
              fontWeight: 800,
              cursor: readinessLoading ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <IconShieldCheck size={13} color="var(--color-primary)" />
            <span>{readinessLoading ? 'Đang chấm điểm...' : 'Kiểm Tra Sẵn Sàng (0–100)'}</span>
          </button>

          {onAskAiPrompt && (() => {
            const chosen = trailCatalog.find((t) => t.id === selectedTrailId);
            const tLabel = chosen?.name || 'Fansipan';
            const fitnessPromptLabel =
              fitnessLevel === 'beginner'
                ? 'thể lực người mới'
                : fitnessLevel === 'advanced'
                ? 'thể lực kinh nghiệm'
                : 'thể lực trung bình';
            return (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const resolvedBodyKg = commitBodyWeight(bodyWeightInput);
                    const resolvedPackKg = commitPackWeight(packWeightInput);
                    onAskAiPrompt(
                      `Tính giờ quay đầu & kế hoạch tốc độ leo ${tLabel} ngày ${departureDate} xuất phát 06:00 với ${fitnessPromptLabel}, balo ${resolvedPackKg} kg và cân nặng cơ thể ${resolvedBodyKg} kg`
                    );
                  }}
                  style={{
                    flex: '1 1 130px',
                    padding: '7px 10px',
                    borderRadius: 4,
                    border: '1px solid var(--color-border-strong)',
                    background: 'var(--color-bg-card)',
                    color: 'var(--color-text-main)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                  }}
                >
                  <IconClock size={13} color="var(--color-earth)" />
                  <span>Giờ Quay Đầu NOAA</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const resolvedBodyKg = commitBodyWeight(bodyWeightInput);
                    const resolvedPackKg = commitPackWeight(packWeightInput);
                    onAskAiPrompt(
                      `Tính nước uống, Oresol và khẩu phần ăn leo ${tLabel} ngày ${departureDate} cho ${groupSize} người với ${fitnessPromptLabel}, balo ${resolvedPackKg} kg, cân nặng cơ thể ${resolvedBodyKg} kg`
                    );
                  }}
                  style={{
                    flex: '1 1 130px',
                    padding: '7px 10px',
                    borderRadius: 4,
                    border: '1px solid var(--color-border-strong)',
                    background: 'var(--color-bg-card)',
                    color: 'var(--color-text-main)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                  }}
                >
                  <IconDroplet size={13} color="var(--color-sky)" />
                  <span>Nước &amp; Oresol</span>
                </button>
              </>
            );
          })()}
        </div>
      </form>

      {/* Inline Wave 16A Pre-Flight Readiness Audit Panel */}
      {readinessAudit && (() => {
        const ra = readinessAudit;
        const borderCol =
          ra.verdict === 'READY'
            ? 'var(--color-primary)'
            : ra.verdict === 'ADJUST_BEFORE_GO'
            ? 'var(--color-earth)'
            : 'var(--color-error)';
        const textCol =
          ra.verdict === 'READY'
            ? 'var(--color-primary)'
            : ra.verdict === 'ADJUST_BEFORE_GO'
            ? 'var(--color-earth)'
            : 'var(--color-error-text, var(--color-error))';
        const r = 30;
        const circ = 2 * Math.PI * r;
        const score = Math.max(0, Math.min(100, ra.readinessScore));
        const dashOff = circ * (1 - score / 100);

        return (
          <div
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border-strong)',
              borderLeft: `3px solid ${borderCol}`,
              borderRadius: 6,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <svg
                viewBox="0 0 76 76"
                width="68"
                height="68"
                role="img"
                aria-label={`Điểm sẵn sàng ${score} trên 100: ${ra.verdictLabel}`}
                style={{ flexShrink: 0, display: 'block' }}
              >
                <circle cx="38" cy="38" r={r} fill="var(--color-bg-card)" stroke="var(--color-border)" strokeWidth="7" />
                <circle
                  cx="38"
                  cy="38"
                  r={r}
                  fill="none"
                  stroke={borderCol}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={`${circ}`}
                  strokeDashoffset={dashOff}
                  transform="rotate(-90 38 38)"
                />
                <text x="38" y="35" textAnchor="middle" dominantBaseline="central" fill={textCol} fontSize="17" fontWeight="900">
                  {score}
                </text>
                <text x="38" y="53" textAnchor="middle" fill="var(--color-text-dim)" fontSize="9.5" fontWeight="700">
                  / 100
                </text>
              </svg>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                    ĐÁNH GIÁ SẴN SÀNG TRƯỚC GIỜ G
                  </span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: `color-mix(in srgb, ${borderCol} 8%, var(--color-bg-card))`,
                      border: `1px solid color-mix(in srgb, ${borderCol} 40%, transparent)`,
                      color: textCol,
                    }}
                  >
                    {ra.verdictLabel}
                  </span>
                </div>
                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 2 }}>
                  {ra.trailName}
                </div>
                <div style={{ fontSize: '0.69rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                  {ra.departureDate} · Balo {ra.inputs.packWeightKg}kg ({ra.inputs.packRatioPercent}%) · Quay đầu {ra.snapshot.safeTurnaroundTime} · Nước {ra.snapshot.carryWaterPerLegLiters}L
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
              {ra.pillars.map((pl) => {
                const pBar =
                  pl.status === 'good'
                    ? 'var(--color-primary)'
                    : pl.status === 'warn'
                    ? 'var(--color-earth)'
                    : 'var(--color-error)';
                const pText =
                  pl.status === 'good'
                    ? 'var(--color-primary)'
                    : pl.status === 'warn'
                    ? 'var(--color-earth)'
                    : 'var(--color-error-text, var(--color-error))';
                const clampedPct = Math.max(0, Math.min(100, pl.score));
                return (
                  <div
                    key={pl.key}
                    style={{
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 4,
                      padding: '6px 8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.71rem', fontWeight: 800, marginBottom: 4 }}>
                      <span style={{ color: 'var(--color-text-main)' }}>{pl.label}</span>
                      <span style={{ color: pText }}>{clampedPct}/100</span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={pl.label}
                      aria-valuenow={clampedPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      style={{ height: 5, borderRadius: 3, background: 'var(--color-surface-elevated)', overflow: 'hidden', marginBottom: 4 }}
                    >
                      <div style={{ width: `${clampedPct}%`, height: '100%', background: pBar }} />
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', lineHeight: 1.35 }}>
                      {pl.summary}
                    </div>
                  </div>
                );
              })}
            </div>

            {ra.topFixes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: '0.67rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                  Hành Động Ưu Tiên ({ra.topFixes.length})
                </div>
                {ra.topFixes.map((fx, i) => (
                  <div
                    key={`${fx.pillar}-${i}`}
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--color-text-muted)',
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 4,
                      padding: '5px 8px',
                      lineHeight: 1.4,
                    }}
                  >
                    <strong style={{ color: 'var(--color-text-main)' }}>{fx.title}:</strong> {fx.action}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Empty Hint State */}
      {!brief && !loading && (
        <div
          style={{
            background: 'var(--color-bg-main)',
            border: '1px dashed var(--color-border-strong)',
            borderRadius: 6,
            padding: 18,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <IconCompass size={22} color="var(--color-primary)" />
          <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
            Hồ Sơ Tiền Chuyến Đi Chuẩn Thám Hiểm LOST
          </div>
          <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--color-text-muted)', maxWidth: 420, lineHeight: 1.55 }}>
            Chọn cung đường và ngày khởi hành để nhận trọn bộ: chấm điểm Go/No-Go trực tuyến, chỉ số Naismith/Tobler,
            trạm kiểm lâm &amp; giấy phép xác thực, lịch trình theo giờ, checklist sinh tồn và dự toán VNĐ theo đoàn — có thể in PDF hoặc lưu Offline (.md).
          </p>
        </div>
      )}

      {/* Generated Printable Expedition Dossier */}
      {brief && (
        <div className="lost-printable-dossier" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {/* 1-Click Action Strip */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: 8,
            }}
          >
            <button
              type="button"
              onClick={handleApplyItinerary}
              style={{
                flex: '1 1 135px',
                padding: '7px 10px',
                borderRadius: 4,
                border: `1px solid ${appliedItinerary ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
                background: appliedItinerary
                  ? 'color-mix(in srgb, var(--color-primary) 16%, var(--color-bg-card))'
                  : 'var(--color-bg-card)',
                color: appliedItinerary ? 'var(--color-primary)' : 'var(--color-text-main)',
                fontSize: '0.73rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              {appliedItinerary ? <IconCheck size={13} color="var(--color-primary)" /> : <IconCalendar size={13} />}
              <span>{appliedItinerary ? 'Đã Lưu Lịch Trình' : 'Áp Dụng Lịch Trình'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleApplyChecklist()}
              style={{
                flex: '1 1 135px',
                padding: '7px 10px',
                borderRadius: 4,
                border: `1px solid ${appliedGear ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
                background: appliedGear
                  ? 'color-mix(in srgb, var(--color-primary) 16%, var(--color-bg-card))'
                  : 'var(--color-bg-card)',
                color: appliedGear ? 'var(--color-primary)' : 'var(--color-text-main)',
                fontSize: '0.73rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              {appliedGear ? <IconCheck size={13} color="var(--color-primary)" /> : <IconBackpack size={13} />}
              <span>{appliedGear ? 'Đã Lưu Checklist' : 'Áp Dụng Checklist'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadMarkdown}
              style={{
                flex: '1 1 115px',
                padding: '7px 10px',
                borderRadius: 4,
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-main)',
                fontSize: '0.73rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Tải Hồ Sơ (.md)</span>
            </button>

            <button
              type="button"
              onClick={handlePrintDossier}
              style={{
                flex: '1 1 110px',
                padding: '7px 10px',
                borderRadius: 4,
                border: 'none',
                background: 'var(--color-sky)',
                color: 'var(--color-on-primary)',
                fontSize: '0.73rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>In / Lưu PDF</span>
            </button>
          </div>

          {/* Section 1: Header + Live Go/No-Go Verdict */}
          <div
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderLeft: `3px solid ${goNoGoAccent}`,
              borderRadius: 6,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconMountain size={15} color="var(--color-primary)" />
                  <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                    {brief.trail.name}
                  </h4>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                  {brief.trail.district}, {brief.trail.province} · Đỉnh {brief.trail.maxAltitudeM.toLocaleString('vi-VN')}m · {brief.trail.distanceKm} km · +{brief.trail.elevationGainM.toLocaleString('vi-VN')}m · Cấp {brief.trail.difficultyLevel}/5
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    padding: '4px 9px',
                    borderRadius: 4,
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    background: `color-mix(in srgb, ${goNoGoAccent} 16%, var(--color-bg-card))`,
                    border: `1px solid color-mix(in srgb, ${goNoGoAccent} 45%, transparent)`,
                    color: goNoGoAccent,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {brief.goNoGo?.verdict === 'GO' ? (
                    <IconShieldCheck size={13} color={goNoGoAccent} />
                  ) : brief.goNoGo?.verdict === 'NO_GO' ? (
                    <IconShieldAlert size={13} color={goNoGoAccent} />
                  ) : (
                    <IconAlertTriangle size={13} color={goNoGoAccent} />
                  )}
                  <span>
                    {brief.goNoGo ? `${brief.goNoGo.verdictLabel} · ${brief.goNoGo.score}/100` : 'Ngoại tuyến'}
                  </span>
                </span>
                {onSelectTrail && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTrail(brief.trail.id);
                      onCloseModal?.();
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      border: '1px solid var(--color-border-strong)',
                      background: 'var(--color-bg-card)',
                      color: 'var(--color-text-main)',
                      fontSize: '0.71rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Xem tuyến
                  </button>
                )}
              </div>
            </div>

            {brief.goNoGo?.weatherSummary && (
              <div
                style={{
                  fontSize: '0.73rem',
                  color: 'var(--color-text-muted)',
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  padding: '6px 9px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <strong style={{ color: 'var(--color-text-main)' }}>Thời tiết đỉnh ({brief.departureDate}):</strong>{' '}
                {brief.goNoGo.weatherSummary.summitTempMinC ?? brief.goNoGo.weatherSummary.tempMinC}°C –{' '}
                {brief.goNoGo.weatherSummary.summitTempMaxC ?? brief.goNoGo.weatherSummary.tempMaxC}°C · Mưa{' '}
                {brief.goNoGo.weatherSummary.precipMm} mm · Gió {brief.goNoGo.weatherSummary.windSpeedKmH} km/h ·{' '}
                {brief.goNoGo.weatherSummary.conditionLabel}
                {brief.goNoGo.activeIncidentsCount > 0 && (
                  <span style={{ color: 'var(--color-error-text, var(--color-error))', fontWeight: 700 }}>
                    {' '}· {brief.goNoGo.activeIncidentsCount} cảnh báo sự cố mở
                  </span>
                )}
              </div>
            )}

            {/* Bio-Metrics 4-KPI Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: 6 }}>
              {[
                {
                  label: 'Naismith / Tobler',
                  value: `${brief.bioMetrics.recommendedMovingHours}h`,
                  sub: `Tổng ~${brief.bioMetrics.estimatedTotalTripHours}h`,
                  accent: 'var(--color-primary)',
                },
                {
                  label: 'Nước & Điện giải',
                  value: `${brief.bioMetrics.waterLitersTotal}L`,
                  sub: `${brief.bioMetrics.waterLitersPerDay}L/ngày · ${brief.bioMetrics.oresolPackets} Oresol`,
                  accent: 'var(--color-sky)',
                },
                {
                  label: 'Năng lượng',
                  value: `${brief.bioMetrics.caloriesActiveKcal.toLocaleString('vi-VN')}`,
                  sub: 'kcal vận động',
                  accent: 'var(--color-earth)',
                },
                {
                  label: 'Tỷ lệ tải balo',
                  value: `${brief.bioMetrics.packRatioPercent}%`,
                  sub: brief.bioMetrics.packStatus === 'optimal' ? 'Tối ưu' : brief.bioMetrics.packStatus === 'caution' ? 'Khá nặng' : 'Quá tải',
                  accent:
                    brief.bioMetrics.packStatus === 'optimal'
                      ? 'var(--color-primary)'
                      : brief.bioMetrics.packStatus === 'caution'
                      ? 'var(--color-earth)'
                      : 'var(--color-error)',
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  style={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    padding: '7px 8px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                    {kpi.label}
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: kpi.accent, marginTop: 2 }}>
                    {kpi.value}
                  </div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)' }}>{kpi.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Verified VQG / Ranger Station & Permits */}
          <div
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: 11,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                <IconMapPin size={14} color="var(--color-primary)" />
                <span>TRẠM KIỂM LÂM / VQG &amp; THỦ TỤC GIẤY PHÉP</span>
              </div>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 4,
                  background: brief.rangerStation.permitRequired
                    ? 'color-mix(in srgb, var(--color-earth) 16%, var(--color-bg-card))'
                    : 'color-mix(in srgb, var(--color-primary) 14%, var(--color-bg-card))',
                  color: brief.rangerStation.permitRequired ? 'var(--color-earth)' : 'var(--color-primary)',
                }}
              >
                {brief.rangerStation.permitRequired
                  ? `Cần đăng ký trước ${Math.max(1, brief.rangerStation.permitLeadDays)} ngày`
                  : 'Cung mở (mang CCCD gốc)'}
              </span>
            </div>

            <div style={{ fontSize: '0.79rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
              {brief.rangerStation.name}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              <div>Địa chỉ: {brief.rangerStation.address}</div>
              <div>Giờ trực: {brief.rangerStation.officeHours}</div>
              <div style={{ marginTop: 2, color: 'var(--color-text-main)' }}>{brief.rangerStation.permitFeeNote}</div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
              <a
                href={`tel:${brief.rangerStation.dialNumber}`}
                style={{
                  padding: '5px 10px',
                  borderRadius: 4,
                  background: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  fontSize: '0.73rem',
                  fontWeight: 800,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <IconPhone size={12} color="var(--color-on-primary)" />
                <span>Gọi Trạm: {brief.rangerStation.hotlinePhone}</span>
              </a>
              <a
                href="tel:112"
                style={{
                  padding: '5px 10px',
                  borderRadius: 4,
                  border: '1px solid color-mix(in srgb, var(--color-error) 50%, transparent)',
                  background: 'color-mix(in srgb, var(--color-error) 12%, var(--color-bg-card))',
                  color: 'var(--color-error-text, var(--color-error))',
                  fontSize: '0.73rem',
                  fontWeight: 800,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <IconPhone size={12} color="var(--color-error)" />
                <span>Cứu nạn Quốc gia 112</span>
              </a>
            </div>
          </div>

          {/* Section 3: Day-by-Day Hour-by-Hour Timeline */}
          <div
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: 11,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
              <IconClock size={14} color="var(--color-sky)" />
              <span>LỊCH TRÌNH CHI TIẾT THEO NGÀY &amp; GIỜ ({brief.trail.durationHoursNote || `${brief.trail.durationDays} ngày`})</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {brief.itinerarySteps.map((step, idx) => (
                <div
                  key={`${step.day}-${step.time}-${idx}`}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '7px 9px',
                    borderRadius: 4,
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div
                    style={{
                      minWidth: 68,
                      flexShrink: 0,
                      fontSize: '0.71rem',
                      fontWeight: 800,
                      color: 'var(--color-sky)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <div>Ngày {step.day}</div>
                    <div style={{ color: 'var(--color-text-main)' }}>{step.time}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.77rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                      {step.title}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.45, marginTop: 2 }}>
                      {step.description}
                    </div>
                    {step.locationNote && (
                      <div style={{ fontSize: '0.67rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
                        Mốc: {step.locationNote}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Survival Gear Checklist */}
          <div
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: 11,
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                <IconBackpack size={14} color="var(--color-earth)" />
                <span>TRANG BỊ SINH TỒN ĐỀ XUẤT ({brief.survivalChecklist.length} MÓN)</span>
              </div>
              <span style={{ fontSize: '0.71rem', fontWeight: 700, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                Tổng ước tính: {(brief.totalChecklistGrams / 1000).toFixed(1)} kg
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 6 }}>
              {brief.survivalChecklist.map((item, idx) => (
                <div
                  key={`${item.name}-${idx}`}
                  style={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    padding: '7px 9px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                      {item.name}
                    </span>
                    <span style={{ fontSize: '0.67rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {item.weightGrams}g
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.63rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: item.isEssential
                          ? 'color-mix(in srgb, var(--color-error) 14%, transparent)'
                          : 'color-mix(in srgb, var(--color-sky) 14%, transparent)',
                        color: item.isEssential ? 'var(--color-error-text, var(--color-error))' : 'var(--color-sky)',
                      }}
                    >
                      {item.isEssential ? 'Bắt buộc' : 'Khuyên mang'}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--color-text-dim)' }}>{item.category}</span>
                  </div>
                  <div style={{ fontSize: '0.69rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                    {item.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Itemized Vietnam VND Budget Breakdown */}
          <div
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: 11,
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                <IconUsers size={14} color="var(--color-primary)" />
                <span>DỰ TOÁN NGÂN SÁCH THỰC TẾ (VNĐ · {brief.budget.groupSize} NGƯỜI)</span>
              </div>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {formatVnd(brief.budget.grandTotalPerPersonVnd)} / người
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.72rem',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-strong)', color: 'var(--color-text-dim)' }}>
                    <th style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 700 }}>Hạng mục</th>
                    <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, whiteSpace: 'nowrap' }}>/Người</th>
                    <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, whiteSpace: 'nowrap' }}>Đoàn ({brief.budget.groupSize})</th>
                  </tr>
                </thead>
                <tbody>
                  {brief.budget.lines.map((line) => (
                    <tr key={line.key} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '6px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>{line.label}</div>
                        <div style={{ fontSize: '0.67rem', color: 'var(--color-text-dim)' }}>{line.detail}</div>
                      </td>
                      <td style={{ padding: '6px', textAlign: 'right', color: 'var(--color-text-main)', whiteSpace: 'nowrap' }}>
                        {formatVnd(line.perPersonVnd)}
                      </td>
                      <td style={{ padding: '6px', textAlign: 'right', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {formatVnd(line.groupTotalVnd)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '6px', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                      Quỹ dự phòng khẩn cấp (15%)
                    </td>
                    <td style={{ padding: '6px', textAlign: 'right', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {formatVnd(brief.budget.contingencyPerPersonVnd)}
                    </td>
                    <td style={{ padding: '6px', textAlign: 'right', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {formatVnd(brief.budget.contingencyPerPersonVnd * brief.budget.groupSize)}
                    </td>
                  </tr>
                  <tr style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card))' }}>
                    <td style={{ padding: '7px 6px', fontWeight: 800, color: 'var(--color-text-main)' }}>
                      TỔNG DỰ TOÁN THỰC ĐỊA
                    </td>
                    <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 800, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                      {formatVnd(brief.budget.grandTotalPerPersonVnd)}
                    </td>
                    <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 800, color: 'var(--color-text-main)', whiteSpace: 'nowrap' }}>
                      {formatVnd(brief.budget.grandTotalGroupVnd)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', lineHeight: 1.4 }}>
              {brief.budget.note}
            </div>
          </div>

          {/* Section 6: Safety Notes & Ask AI Follow-Up */}
          <div
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: 11,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
              <IconDroplet size={14} color="var(--color-error)" />
              <span>LƯU Ý AN TOÀN TRỌNG YẾU</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              {brief.safetyNotes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
            {onAskAiPrompt && (
              <button
                type="button"
                onClick={() =>
                  onAskAiPrompt(
                    `Hãy tư vấn tối ưu thêm cho Hồ sơ chuyến đi ${brief.trail.name} ngày ${brief.departureDate} nhóm ${brief.groupSize} người (cách săn mây đẹp, điểm nghỉ ăn trưa và rủi ro cần lưu ý).`
                  )
                }
                style={{
                  marginTop: 4,
                  alignSelf: 'flex-start',
                  padding: '6px 11px',
                  borderRadius: 4,
                  border: '1px solid var(--color-primary)',
                  background: 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-card))',
                  color: 'var(--color-primary)',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Hỏi LOST AI tinh chỉnh hồ sơ này
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
