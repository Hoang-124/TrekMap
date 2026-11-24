import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { useFocusTrap, isTopmostFocusTrap } from '../../hooks/useFocusTrap.js';
import {
  IconX,
  IconMessageSquare,
  IconBackpack,
  IconCheckCircle,
  IconTrash,
  IconUsers,
  IconUserPlus,
  IconStar,
  IconCalendar,
  IconMapPin,
  IconArrowRight,
  IconCopy,
  IconCheck,
  IconScale,
  IconAlertTriangle,
  IconPlus,
  IconShieldCheck,
  IconChevronRight,
  IconDownload,
} from '../common/SvgIcons.js';

interface SharedGearItem {
  id: string;
  itemName: string;
  category: string;
  assignedUserName: string;
  packed: boolean;
}

interface ExpenseItem {
  id: string;
  title: string;
  amountVnd: number;
  paidByName: string;
  paidByUserId?: string;
  splitCount: number;
}

interface PendingApplicant {
  userId: {
    _id: string;
    fullName: string;
    avatarUrl?: string;
    reputationScore?: number;
  } | string;
  message?: string;
  requestedAt?: string;
}

interface TripDetailPayload {
  _id: string;
  title: string;
  trailName?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  meetingPoint?: string;
  estimatedCost?: string;
  maxMembers?: number;
  status?: string;
  creatorId?: { _id?: string; fullName?: string } | string;
  currentMembers?: Array<{ _id?: string; fullName?: string; avatarUrl?: string } | string>;
  pendingRequests?: PendingApplicant[];
  sharedGear?: SharedGearItem[];
  expenses?: ExpenseItem[];
}

interface SquadWorkspaceModalProps {
  tripId: string;
  tripTitle: string;
  memberCount: number;
  isCreator?: boolean;
  isMember?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onOpenGroupChat?: (conversationId: string) => void;
  onTripUpdated?: () => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface MemberSettlementBalance {
  id: string;
  name: string;
  paidVnd: number;
  balanceVnd: number;
  isEstimatedSlot?: boolean;
}

interface DebtTransfer {
  from: string;
  to: string;
  amountVnd: number;
}

interface GreedyDebtSettlement {
  totalVnd: number;
  participantCount: number;
  perPersonAverageVnd: number;
  balances: MemberSettlementBalance[];
  transfers: DebtTransfer[];
  isSettled: boolean;
}

const SETTLEMENT_DUST_VND = 1;
const SQUAD_GEAR_STORAGE_KEY = 'lost_squad_gear_v1';
const SQUAD_SAFETY_GATE_STORAGE_KEY = 'lost_squad_safety_gate_v1';

type SquadSafetyGateStepId =
  | 'permit'
  | 'beacon'
  | 'gonogo'
  | 'wfa_gear'
  | 'turnaround'
  | 'hotline';

interface SquadSafetyGateStep {
  id: SquadSafetyGateStepId;
  title: string;
  detail: string;
}

const SQUAD_SAFETY_GATE_STEPS: SquadSafetyGateStep[] = [
  {
    id: 'permit',
    title: 'Giấy phép VQG / Biên phòng & Khai báo',
    detail: 'Hoàn tất giấy phép vào rừng (BQL VQG/Kiểm lâm hoặc Đồn Biên phòng) và danh sách CCCD cả đoàn.',
  },
  {
    id: 'beacon',
    title: 'Live Beacon & Báo người thân ở nhà',
    detail: 'Kích hoạt Live Beacon / Hẹn giờ báo bình an và gửi lịch trình dự kiến cho người thân.',
  },
  {
    id: 'gonogo',
    title: 'Kiểm tra Go/No-Go thời tiết 24h trước giờ G',
    detail: 'Rà soát dự báo mưa lớn, gió đỉnh, sạt lở đường mòn và chỉ số Go/No-Go trong vòng 24 giờ.',
  },
  {
    id: 'wfa_gear',
    title: 'Bộ sơ cứu WFA & Đèn pin dự phòng',
    detail: 'Kiểm tra túi sơ cứu dã ngoại (WFA), còi SOS, chăn giữ nhiệt và đèn pin đội đầu kèm pin dự phòng.',
  },
  {
    id: 'turnaround',
    title: 'Thống nhất Giờ Quay Đầu An Toàn',
    detail: 'Chốt mốc giờ quay đầu bắt buộc để cả đoàn xuống trại hoặc cửa rừng trước hoàng hôn ít nhất 30 phút.',
  },
  {
    id: 'hotline',
    title: 'Lưu Hotline Kiểm Lâm & 112 Offline',
    detail: 'Lưu số trực ban Kiểm lâm/VQG địa phương, số cứu hộ quốc gia 112 và tải sẵn GPX ngoại tuyến.',
  },
];

const SQUAD_SAFETY_GATE_IDS: SquadSafetyGateStepId[] = SQUAD_SAFETY_GATE_STEPS.map((s) => s.id);
const SQUAD_SAFETY_GATE_MAX_TRIPS = 50;

function readSquadSafetyGateStore(): Record<string, Record<SquadSafetyGateStepId, boolean>> {
  try {
    const raw = localStorage.getItem(SQUAD_SAFETY_GATE_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean: Record<string, Record<SquadSafetyGateStepId, boolean>> = {};
    for (const [k, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
      const entry = val as Record<string, unknown>;
      const record = {} as Record<SquadSafetyGateStepId, boolean>;
      for (const stepId of SQUAD_SAFETY_GATE_IDS) {
        record[stepId] = Boolean(entry[stepId]);
      }
      clean[k] = record;
    }
    return clean;
  } catch {
    return {};
  }
}

function writeSquadSafetyGateStore(store: Record<string, Record<SquadSafetyGateStepId, boolean>>): boolean {
  try {
    const entries = Object.entries(store);
    const capped =
      entries.length > SQUAD_SAFETY_GATE_MAX_TRIPS
        ? Object.fromEntries(entries.slice(-SQUAD_SAFETY_GATE_MAX_TRIPS))
        : store;
    localStorage.setItem(SQUAD_SAFETY_GATE_STORAGE_KEY, JSON.stringify(capped));
    return true;
  } catch {
    return false;
  }
}

function persistSafetyGateForTrip(
  tripKey: string,
  nextRecord: Record<SquadSafetyGateStepId, boolean>
): { nextStore: Record<string, Record<SquadSafetyGateStepId, boolean>>; savedOk: boolean } {
  const fresh = readSquadSafetyGateStore();
  // Move active trip to tail for LRU 50-trip cap while merging cross-tab updates
  delete fresh[tripKey];
  fresh[tripKey] = nextRecord;
  const entries = Object.entries(fresh);
  const capped =
    entries.length > SQUAD_SAFETY_GATE_MAX_TRIPS
      ? Object.fromEntries(entries.slice(-SQUAD_SAFETY_GATE_MAX_TRIPS))
      : fresh;
  const savedOk = writeSquadSafetyGateStore(capped);
  return { nextStore: capped, savedOk };
}

function getFairLoadThresholdPct(squadSize: number): number {
  if (squadSize <= 1) return 100;
  return Math.max(45, Math.ceil(100 / squadSize) + 15);
}

let squadGearIdCounter = 0;
function createSquadGearItemId(prefix: string): string {
  squadGearIdCounter += 1;
  return `sg-${prefix}-${Date.now()}-${squadGearIdCounter}`;
}

interface SquadRosterMember {
  id: string;
  name: string;
  isEstimatedSlot?: boolean;
}

interface SquadGearMatrixItem {
  id: string;
  name: string;
  category: string;
  weightG: number;
  carrierId: string;
  carrierName: string;
  packed: boolean;
}

interface SharedGearPreset {
  key: string;
  name: string;
  weightG: number;
  category: string;
}

const VIETNAM_SQUAD_GEAR_PRESETS: SharedGearPreset[] = [
  { key: 'tent-4p', name: 'Lều 4N', weightG: 3200, category: 'Lán trại & Nấu ăn' },
  { key: 'stove-gas', name: 'Bếp & gas', weightG: 950, category: 'Lán trại & Nấu ăn' },
  { key: 'wfa-kit', name: 'Túi WFA', weightG: 650, category: 'Y tế & An toàn' },
  { key: 'uhf-radio', name: 'Bộ đàm UHF', weightG: 480, category: 'Y tế & An toàn' },
  { key: 'tarp', name: 'Bạt tăng', weightG: 720, category: 'Lán trại & Nấu ăn' },
  { key: 'rope', name: 'Dây thừng', weightG: 1100, category: 'Y tế & An toàn' },
];

function readSquadGearStore(): Record<string, SquadGearMatrixItem[]> {
  try {
    const raw = localStorage.getItem(SQUAD_GEAR_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const cleanStore: Record<string, SquadGearMatrixItem[]> = {};
    for (const [k, list] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      cleanStore[k] = list
        .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
        .map((entry, idx) => {
          const weightVal = Math.round(Number(entry.weightG));
          return {
            id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : `gear-${k}-${idx}`,
            name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : 'Trang bị chung',
            category: typeof entry.category === 'string' && entry.category.trim() ? entry.category : 'Dùng chung',
            weightG: Number.isFinite(weightVal) && weightVal > 0 ? Math.min(50000, weightVal) : 500,
            carrierId: typeof entry.carrierId === 'string' ? entry.carrierId : '',
            carrierName: typeof entry.carrierName === 'string' ? entry.carrierName : '',
            packed: Boolean(entry.packed),
          };
        });
    }
    return cleanStore;
  } catch {
    return {};
  }
}

function writeSquadGearStore(store: Record<string, SquadGearMatrixItem[]>): void {
  try {
    localStorage.setItem(SQUAD_GEAR_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota / privacy mode failures
  }
}

function formatWeightKg(grams: number): string {
  return (grams / 1000).toFixed(2);
}

function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = /^[\s\u00A0]*[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function getVietnamDateCompact(): string {
  try {
    const iso = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return iso.replace(/-/g, '');
  } catch {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }
}

function slugifyCsvFilenamePart(raw: string): string {
  const slug = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'doan-trek';
}

function formatDateViOptional(raw?: string): string {
  if (!raw) return 'Chưa cập nhật';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  try {
    return d.toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}

function buildRangerManifestCsv(params: {
  tripTitle: string;
  tripDetail: TripDetailPayload | null;
  roster: SquadRosterMember[];
  memberLoads: Array<{
    id: string;
    name: string;
    totalG: number;
    pct: number;
    itemCount: number;
  }>;
  matrixItems: SquadGearMatrixItem[];
  syncedSharedGear: SharedGearItem[];
  safetyGateChecks: Record<SquadSafetyGateStepId, boolean>;
  safetyGateCompletedCount: number;
}): string {
  const {
    tripTitle,
    tripDetail,
    roster,
    memberLoads,
    matrixItems,
    syncedSharedGear,
    safetyGateChecks,
    safetyGateCompletedCount,
  } = params;

  const creatorUid =
    tripDetail?.creatorId && typeof tripDetail.creatorId === 'object' && tripDetail.creatorId._id
      ? `uid:${String(tripDetail.creatorId._id).trim()}`
      : typeof tripDetail?.creatorId === 'string' && tripDetail.creatorId.trim()
        ? `uid:${tripDetail.creatorId.trim()}`
        : '';
  const loadById = new Map(memberLoads.map((m) => [m.id, m]));
  const rosterIdSet = new Set(roster.map((m) => m.id));
  const confirmedMemberCount = roster.filter((m) => !m.isEstimatedSlot).length;
  const estimatedSlotCount = roster.length - confirmedMemberCount;
  const unassignedMatrixItems = matrixItems.filter(
    (it) => !it.carrierId || !rosterIdSet.has(it.carrierId)
  );
  const totalSteps = SQUAD_SAFETY_GATE_STEPS.length;
  const gateStatusLabel =
    safetyGateCompletedCount === totalSteps
      ? `${safetyGateCompletedCount}/${totalSteps} - Sẵn sàng xuất phát`
      : `${safetyGateCompletedCount}/${totalSteps} - Đang rà soát`;

  const row = (cells: unknown[]) => cells.map(escapeCsvCell).join(',');
  const lines: string[] = [
    row(['BẢNG KHAI BÁO KIỂM LÂM & VƯỜN QUỐC GIA (LOST VIETNAM)']),
    row(['Hạng mục', 'Thông tin đoàn']),
    row(['Tên chuyến đi', tripDetail?.title || tripTitle]),
    row(['Cung đường / Tuyến', tripDetail?.trailName || 'Chưa gắn tuyến']),
    row(['Ngày khởi hành', formatDateViOptional(tripDetail?.startDate)]),
    row(['Ngày kết thúc', formatDateViOptional(tripDetail?.endDate)]),
    row(['Điểm hẹn tập trung', tripDetail?.meetingPoint || 'Chưa cập nhật']),
    row(['Thành viên đã xác nhận', confirmedMemberCount]),
    row(['Vị trí dự kiến (chưa rõ họ tên)', estimatedSlotCount]),
    row(['Tổng quy mô đoàn', roster.length]),
    row(['Cổng Kiểm Tra An Toàn Trước Giờ G', gateStatusLabel]),
    row(['Ngày xuất bảng khai báo', formatDateViOptional(new Date().toISOString())]),
    '',
    row(['DANH SÁCH THÀNH VIÊN THAM GIA']),
    row([
      'STT',
      'Họ và tên',
      'Vai trò trong đoàn',
      'Tải đồ chung (kg)',
      'Số món đồ chung',
      'Trang bị chung phụ trách',
      'Số CCCD / Hộ chiếu (Điền tại trạm)',
      'SĐT liên hệ khẩn cấp (Điền tại trạm)',
    ]),
  ];

  roster.forEach((member, idx) => {
    const load = loadById.get(member.id);
    const assignedNames = matrixItems
      .filter((it) => it.carrierId === member.id)
      .map((it) => `${it.name} (${it.weightG}g)`)
      .join('; ');
    const roleLabel =
      member.isEstimatedSlot
        ? 'Vị trí dự kiến'
        : creatorUid && member.id === creatorUid
          ? 'Trưởng đoàn'
          : idx === 0 && !creatorUid
            ? 'Trưởng đoàn'
            : 'Thành viên';

    lines.push(
      row([
        idx + 1,
        member.name,
        roleLabel,
        load ? formatWeightKg(load.totalG) : '0.00',
        load ? load.itemCount : 0,
        assignedNames || 'Không',
        '',
        '',
      ])
    );
  });

  if (unassignedMatrixItems.length > 0) {
    lines.push(
      '',
      row(['TRANG BỊ CHUNG CHƯA PHÂN CÔNG (MA TRẬN CỤC BỘ)']),
      row(['STT', 'Tên vật dụng', 'Danh mục', 'Trọng lượng (g)', 'Trạng thái'])
    );
    unassignedMatrixItems.forEach((item, idx) => {
      lines.push(
        row([
          idx + 1,
          item.name,
          item.category,
          item.weightG,
          item.packed ? 'Đã chuẩn bị' : 'Chưa chuẩn bị',
        ])
      );
    });
  }

  if (syncedSharedGear.length > 0) {
    lines.push(
      '',
      row(['ĐỒ CHUNG ĐÃ ĐỒNG BỘ TRÊN ĐOÀN']),
      row(['STT', 'Tên vật dụng', 'Danh mục', 'Phụ trách', 'Trạng thái'])
    );
    syncedSharedGear.forEach((item, idx) => {
      lines.push(
        row([
          idx + 1,
          item.itemName,
          item.category,
          item.assignedUserName || 'Chưa nhận',
          item.packed ? 'Đã chuẩn bị' : 'Chưa chuẩn bị',
        ])
      );
    });
  }

  lines.push(
    '',
    row(['CỔNG KIỂM TRA AN TOÀN TRƯỚC GIỜ G (6 BƯỚC)']),
    row(['Bước', 'Hạng mục an toàn', 'Trạng thái'])
  );
  SQUAD_SAFETY_GATE_STEPS.forEach((step, idx) => {
    lines.push(
      row([
        idx + 1,
        step.title,
        safetyGateChecks[step.id] ? 'Hoàn tất' : 'Chưa kiểm tra',
      ])
    );
  });

  return lines.join('\r\n');
}

function buildSquadRoster(tripDetail: TripDetailPayload | null, memberCount: number): SquadRosterMember[] {
  const members: SquadRosterMember[] = [];
  const seenUserIds = new Set<string>();
  const nameCounts = new Map<string, number>();

  const addMember = (rawId?: string | null, rawName?: string | null) => {
    const cleanName = (rawName || '').trim();
    const cleanId = (rawId || '').trim();
    if (!cleanName) return;
    if (cleanId && seenUserIds.has(cleanId)) return;

    const baseKey = cleanName.toLowerCase();
    const prevCount = nameCounts.get(baseKey) || 0;
    if (!cleanId && prevCount > 0) return;

    const nextCount = prevCount + 1;
    nameCounts.set(baseKey, nextCount);
    const id = cleanId ? `uid:${cleanId}` : `name:${baseKey}:${nextCount}`;
    const displayName = nextCount === 1 ? cleanName : `${cleanName} (#${nextCount})`;

    if (cleanId) seenUserIds.add(cleanId);
    members.push({ id, name: displayName });
  };

  if (tripDetail?.creatorId && typeof tripDetail.creatorId === 'object') {
    addMember(tripDetail.creatorId._id, tripDetail.creatorId.fullName);
  }
  if (Array.isArray(tripDetail?.currentMembers)) {
    for (const member of tripDetail.currentMembers) {
      if (member && typeof member === 'object') {
        addMember(member._id, member.fullName);
      }
    }
  }

  const targetCount = Math.max(1, Math.round(Number(memberCount) || 1), members.length);
  let slotIdx = members.length + 1;
  while (members.length < targetCount) {
    const label = `Thành viên #${slotIdx}`;
    const baseKey = label.toLowerCase();
    slotIdx += 1;
    if (!nameCounts.has(baseKey)) {
      nameCounts.set(baseKey, 1);
      members.push({ id: `slot:${slotIdx - 1}`, name: label, isEstimatedSlot: true });
    }
  }

  return members;
}

function buildZaloGearAssignmentReport(
  tripTitle: string,
  items: SquadGearMatrixItem[],
  memberLoads: Array<{
    id: string;
    name: string;
    totalG: number;
    pct: number;
    itemCount: number;
    isOverloaded: boolean;
  }>,
  unassignedItems: SquadGearMatrixItem[],
  fairLoadThresholdPct: number,
  syncedSharedGear: SharedGearItem[]
): string {
  const totalG = items.reduce((sum, item) => sum + item.weightG, 0);
  const matrixPackedCount = items.filter((item) => item.packed).length;
  const syncedPackedCount = syncedSharedGear.filter((item) => item.packed).length;
  const totalItemCount = items.length + syncedSharedGear.length;
  const totalPackedCount = matrixPackedCount + syncedPackedCount;

  const lines: string[] = [
    '[PHÂN CÔNG TRANG BỊ CHUNG ĐOÀN - LOST]',
    `Chuyến đi: ${tripTitle}`,
    items.length > 0
      ? `Tổng tải đồ chung (ma trận cân tải): ${formatWeightKg(totalG)} kg (${totalG.toLocaleString('vi-VN')} g) | Tiến độ: ${totalPackedCount}/${totalItemCount} món`
      : `Tiến độ chuẩn bị đồ chung: ${totalPackedCount}/${totalItemCount} món`,
  ];

  const assignedMembers = memberLoads.filter((m) => m.itemCount > 0);
  if (assignedMembers.length > 0) {
    lines.push('', '--- PHÂN CÔNG CÂN TẢI THEO THÀNH VIÊN ---');
    assignedMembers.forEach((member) => {
      const loadTag = member.isOverloaded ? ` [CẢNH BÁO >${fairLoadThresholdPct}%]` : '';
      lines.push(
        `• ${member.name}: ${formatWeightKg(member.totalG)} kg (${member.pct.toFixed(0)}%)${loadTag}`
      );
      items
        .filter((it) => it.carrierId === member.id)
        .forEach((it) => {
          lines.push(
            `  - [${it.packed ? 'Đã có' : 'Chưa có'}] ${it.name} (${it.weightG.toLocaleString('vi-VN')} g • ${it.category})`
          );
        });
    });
  }

  if (unassignedItems.length > 0) {
    const unassignedG = unassignedItems.reduce((sum, it) => sum + it.weightG, 0);
    lines.push('', `--- CHƯA PHÂN CÔNG (${formatWeightKg(unassignedG)} kg) ---`);
    unassignedItems.forEach((it) => {
      lines.push(`  - ${it.name} (${it.weightG.toLocaleString('vi-VN')} g • ${it.category})`);
    });
  }

  const overloaded = memberLoads.filter((m) => m.isOverloaded);
  if (overloaded.length > 0) {
    lines.push(
      '',
      `Lưu ý cân bằng tải: ${overloaded.map((m) => `${m.name} (${m.pct.toFixed(0)}%)`).join(', ')} đang gánh >${fairLoadThresholdPct}% tổng đồ chung.`
    );
  }

  if (syncedSharedGear.length > 0) {
    lines.push('', `--- ĐỒ CHUNG ĐÃ ĐỒNG BỘ TRÊN ĐOÀN (${syncedSharedGear.length} món) ---`);
    syncedSharedGear.forEach((item) => {
      lines.push(
        `  - [${item.packed ? 'Đã có' : 'Chưa có'}] ${item.itemName} (${item.category} • Phụ trách: ${item.assignedUserName})`
      );
    });
  }

  return lines.join('\n');
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

function copyTextViaExecCommand(text: string): boolean {
  const helperTextarea = document.createElement('textarea');
  helperTextarea.value = text;
  helperTextarea.setAttribute('readonly', 'true');
  helperTextarea.style.position = 'fixed';
  helperTextarea.style.opacity = '0';
  document.body.appendChild(helperTextarea);
  helperTextarea.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(helperTextarea);
  }
}

/**
 * Pure Greedy Minimum-Transfer Debt Settlement Matrix:
 * - Includes ALL squad participants (joined members, creator, payers, plus unnamed seat slots if roster is partial).
 * - Disambiguates colliding member display names by Mongo `_id` so two members sharing a name never merge.
 * - Uses consistent `SETTLEMENT_DUST_VND = 1` inclusive thresholds so settled status and per-member balances never contradict.
 */
function computeGreedyDebtSettlement(
  expenses: ExpenseItem[],
  tripDetail: TripDetailPayload | null,
  memberCount: number
): GreedyDebtSettlement {
  const displayNameByKey = new Map<string, string>();
  const paidByKey = new Map<string, number>();
  const estimatedKeys = new Set<string>();
  const keyByUserId = new Map<string, string>();
  const keysByBaseName = new Map<string, string[]>();

  const registerRosterMember = (rawId?: string | null, rawName?: string | null) => {
    const cleanName = (rawName || '').trim();
    const cleanId = (rawId || '').trim();
    if (!cleanName) return;
    if (cleanId && keyByUserId.has(cleanId)) return;

    const baseKey = cleanName.toLowerCase();
    const existingKeys = keysByBaseName.get(baseKey) || [];

    // If no userId is provided and a member with the same name already exists, treat as the same entry
    if (!cleanId && existingKeys.length > 0) return;

    const participantKey = cleanId ? `uid:${cleanId}` : `name:${baseKey}:${existingKeys.length + 1}`;
    const displayName = existingKeys.length === 0 ? cleanName : `${cleanName} (#${existingKeys.length + 1})`;

    displayNameByKey.set(participantKey, displayName);
    paidByKey.set(participantKey, 0);
    if (cleanId) {
      keyByUserId.set(cleanId, participantKey);
    }
    keysByBaseName.set(baseKey, [...existingKeys, participantKey]);
  };

  if (tripDetail?.creatorId && typeof tripDetail.creatorId === 'object') {
    registerRosterMember(tripDetail.creatorId._id, tripDetail.creatorId.fullName);
  }
  if (Array.isArray(tripDetail?.currentMembers)) {
    for (const member of tripDetail.currentMembers) {
      if (member && typeof member === 'object') {
        registerRosterMember(member._id, member.fullName);
      }
    }
  }

  let totalVnd = 0;
  for (const exp of expenses) {
    const amount = Math.max(0, Math.round(Number(exp.amountVnd) || 0));
    totalVnd += amount;
    const payerName = (exp.paidByName || '').trim() || 'Thành viên';
    const payerUid = (exp.paidByUserId || '').trim();
    const baseKey = payerName.toLowerCase();

    let targetKey: string | undefined;
    if (payerUid && keyByUserId.has(payerUid)) {
      targetKey = keyByUserId.get(payerUid);
    } else {
      const candidates = keysByBaseName.get(baseKey);
      if (candidates && candidates.length > 0) {
        targetKey = candidates[0];
      } else {
        targetKey = payerUid ? `uid:${payerUid}` : `payer:${baseKey}`;
        displayNameByKey.set(targetKey, payerName);
        paidByKey.set(targetKey, 0);
        if (payerUid) keyByUserId.set(payerUid, targetKey);
        keysByBaseName.set(baseKey, [targetKey]);
      }
    }

    if (targetKey) {
      paidByKey.set(targetKey, (paidByKey.get(targetKey) || 0) + amount);
    }
  }

  const targetCount = Math.max(1, Math.round(Number(memberCount) || 1), displayNameByKey.size);
  let slotIndex = displayNameByKey.size + 1;
  while (displayNameByKey.size < targetCount) {
    const placeholder = `Thành viên #${slotIndex}`;
    const baseKey = placeholder.toLowerCase();
    const key = `slot:${slotIndex}`;
    slotIndex += 1;
    if (!keysByBaseName.has(baseKey)) {
      displayNameByKey.set(key, placeholder);
      paidByKey.set(key, 0);
      keysByBaseName.set(baseKey, [key]);
      estimatedKeys.add(key);
    }
  }

  const participantCount = Math.max(1, displayNameByKey.size);
  const exactShare = totalVnd / participantCount;
  const perPersonAverageVnd = Math.round(exactShare);

  const rawBalances: Array<MemberSettlementBalance & { rawNet: number }> = Array.from(
    displayNameByKey.entries()
  ).map(([key, name]) => {
    const paidVnd = paidByKey.get(key) || 0;
    const rawNet = paidVnd - exactShare;
    const roundedNet = Math.abs(rawNet) < SETTLEMENT_DUST_VND ? 0 : Math.round(rawNet);
    return {
      id: key,
      name,
      paidVnd,
      balanceVnd: roundedNet,
      isEstimatedSlot: estimatedKeys.has(key),
      rawNet,
    };
  });

  rawBalances.sort((a, b) => {
    if (b.balanceVnd !== a.balanceVnd) return b.balanceVnd - a.balanceVnd;
    if (b.paidVnd !== a.paidVnd) return b.paidVnd - a.paidVnd;
    return a.name.localeCompare(b.name, 'vi');
  });

  const balances: MemberSettlementBalance[] = rawBalances.map(({ id, name, paidVnd, balanceVnd, isEstimatedSlot }) => ({
    id,
    name,
    paidVnd,
    balanceVnd,
    isEstimatedSlot,
  }));

  if (totalVnd <= 0 || participantCount <= 1) {
    return {
      totalVnd,
      participantCount,
      perPersonAverageVnd,
      balances,
      transfers: [],
      isSettled: true,
    };
  }

  const debtors = rawBalances
    .filter((m) => m.rawNet <= -SETTLEMENT_DUST_VND)
    .map((m) => ({ name: m.name, remaining: -m.rawNet }));
  const creditors = rawBalances
    .filter((m) => m.rawNet >= SETTLEMENT_DUST_VND)
    .map((m) => ({ name: m.name, remaining: m.rawNet }));

  const transfers: DebtTransfer[] = [];

  // Pass 1: Exact-pair matching (reduces transfer count on partitioned subgroups)
  for (const debtor of debtors) {
    if (debtor.remaining < SETTLEMENT_DUST_VND) continue;
    const exactCreditor = creditors.find(
      (c) => c.remaining >= SETTLEMENT_DUST_VND && Math.abs(c.remaining - debtor.remaining) < SETTLEMENT_DUST_VND
    );
    if (exactCreditor) {
      const amount = Math.round((debtor.remaining + exactCreditor.remaining) / 2);
      if (amount >= SETTLEMENT_DUST_VND) {
        transfers.push({ from: debtor.name, to: exactCreditor.name, amountVnd: amount });
      }
      debtor.remaining = 0;
      exactCreditor.remaining = 0;
    }
  }

  // Pass 2: Greedy largest-debtor to largest-creditor matching
  const maxSteps = (participantCount + 2) * 4;
  for (let step = 0; step < maxSteps; step += 1) {
    const activeDebtors = debtors
      .filter((d) => d.remaining >= SETTLEMENT_DUST_VND)
      .sort((a, b) => b.remaining - a.remaining);
    const activeCreditors = creditors
      .filter((c) => c.remaining >= SETTLEMENT_DUST_VND)
      .sort((a, b) => b.remaining - a.remaining);

    if (activeDebtors.length === 0 || activeCreditors.length === 0) break;

    const topDebtor = activeDebtors[0];
    const topCreditor = activeCreditors[0];
    const settleAmount = Math.min(topDebtor.remaining, topCreditor.remaining);
    const roundedAmount = Math.round(settleAmount);

    if (roundedAmount >= SETTLEMENT_DUST_VND) {
      transfers.push({
        from: topDebtor.name,
        to: topCreditor.name,
        amountVnd: roundedAmount,
      });
    }

    topDebtor.remaining -= settleAmount;
    topCreditor.remaining -= settleAmount;
  }

  return {
    totalVnd,
    participantCount,
    perPersonAverageVnd,
    balances,
    transfers,
    isSettled: transfers.length === 0,
  };
}

function buildZaloSettlementReport(
  tripTitle: string,
  expenses: ExpenseItem[],
  settlement: GreedyDebtSettlement
): string {
  const lines: string[] = [
    '[QUYẾT TOÁN CHI PHÍ ĐOÀN - LOST]',
    `Chuyến đi: ${tripTitle}`,
    `Tổng chi phí: ${settlement.totalVnd.toLocaleString('vi-VN')} đ (${settlement.participantCount} thành viên)`,
    `Bình quân / người: ${settlement.perPersonAverageVnd.toLocaleString('vi-VN')} đ`,
  ];

  if (expenses.length > 0) {
    lines.push('', '--- CHI TIẾT KHOẢN CHI ---');
    expenses.forEach((exp, idx) => {
      lines.push(
        `${idx + 1}. ${exp.title}: ${Math.round(Number(exp.amountVnd) || 0).toLocaleString('vi-VN')} đ (Ứng bởi: ${exp.paidByName || 'Thành viên'})`
      );
    });
  }

  if (settlement.balances.length > 0) {
    lines.push('', '--- ĐỐI SOÁT THÀNH VIÊN ---');
    settlement.balances.forEach((m) => {
      const statusText =
        m.balanceVnd >= SETTLEMENT_DUST_VND
          ? `Nhận lại +${m.balanceVnd.toLocaleString('vi-VN')} đ`
          : m.balanceVnd <= -SETTLEMENT_DUST_VND
            ? `Cần bù ${Math.abs(m.balanceVnd).toLocaleString('vi-VN')} đ`
            : 'Đã cân bằng';
      lines.push(`- ${m.name}: Đã ứng ${m.paidVnd.toLocaleString('vi-VN')} đ | ${statusText}`);
    });
  }

  lines.push(
    '',
    settlement.isSettled
      ? '--- AI TRẢ AI ---'
      : `--- AI TRẢ AI (TỐI ƯU ${settlement.transfers.length} GIAO DỊCH) ---`
  );
  if (settlement.isSettled) {
    lines.push('Tất cả thành viên đã cân bằng chi phí — không cần chuyển khoản thêm.');
  } else {
    settlement.transfers.forEach((t, idx) => {
      lines.push(`${idx + 1}. ${t.from} → ${t.to}: ${t.amountVnd.toLocaleString('vi-VN')} đ`);
    });
  }

  return lines.join('\n');
}

export const SquadWorkspaceModal: React.FC<SquadWorkspaceModalProps> = ({
  tripId,
  tripTitle,
  memberCount,
  isCreator: isCreatorProp = false,
  isMember: isMemberProp = true,
  isOpen,
  onClose,
  onOpenGroupChat,
  onTripUpdated,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'gear' | 'expenses' | 'requests'>('gear');
  const [tripDetail, setTripDetail] = useState<TripDetailPayload | null>(null);
  const [serverViewerRole, setServerViewerRole] = useState<{ tripId: string; role: 'creator' | 'member' | 'guest' } | null>(null);
  const [loadedRequestKey, setLoadedRequestKey] = useState<string>('');
  const [reloadTick, setReloadTick] = useState<number>(0);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const [copiedSettlement, setCopiedSettlement] = useState(false);
  const [copiedGear, setCopiedGear] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  const copiedGearTimerRef = useRef<number | null>(null);
  const csvRevokeEntriesRef = useRef<Array<{ timerId: number; url: string }>>([]);
  const onShowToastRef = useRef(onShowToast);

  // Local shared-gear weight assignment matrix persisted per trip in localStorage['lost_squad_gear_v1']
  const [gearMatrixStore, setGearMatrixStore] = useState<Record<string, SquadGearMatrixItem[]>>(() =>
    readSquadGearStore()
  );
  const [safetyGateStore, setSafetyGateStore] = useState<
    Record<string, Record<SquadSafetyGateStepId, boolean>>
  >(() => readSquadSafetyGateStore());
  const [isSafetyGateOpen, setIsSafetyGateOpen] = useState(false);
  const [newGearWeightG, setNewGearWeightG] = useState('500');
  const [newGearCarrierId, setNewGearCarrierId] = useState('');

  useEffect(() => {
    onShowToastRef.current = onShowToast;
  }, [onShowToast]);

  // Submit & mutation loading guards
  const [togglingGearId, setTogglingGearId] = useState<string | null>(null);
  const [deletingGearId, setDeletingGearId] = useState<string | null>(null);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [processingApplicantId, setProcessingApplicantId] = useState<string | null>(null);

  // Non-member join fallback state (when clicked from calendar)
  const [joinNote, setJoinNote] = useState('');
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);
  const [joinRequestedTripId, setJoinRequestedTripId] = useState<string | null>(null);

  // Add Gear state
  const [newGearName, setNewGearName] = useState('');
  const [newGearCategory, setNewGearCategory] = useState('Lán trại & Nấu ăn');
  const [trackedDraftTripId, setTrackedDraftTripId] = useState(tripId);
  const openSyncKey = isOpen ? tripId : '';
  const [trackedOpenSyncKey, setTrackedOpenSyncKey] = useState(openSyncKey);

  // Reset local gear draft inputs & collapse safety gate when switching to another trip
  if (trackedDraftTripId !== tripId) {
    setTrackedDraftTripId(tripId);
    setNewGearName('');
    setNewGearWeightG('500');
    setNewGearCarrierId('');
    setNewGearCategory('Lán trại & Nấu ăn');
    setIsSafetyGateOpen(false);
  }

  // Re-sync local Safety Gate state from storage whenever modal opens or switches trips
  if (trackedOpenSyncKey !== openSyncKey) {
    setTrackedOpenSyncKey(openSyncKey);
    if (openSyncKey) {
      setSafetyGateStore(readSquadSafetyGateStore());
    }
  }

  // Add Expense state
  const [newExpTitle, setNewExpTitle] = useState('');
  const [newExpAmount, setNewExpAmount] = useState('');

  const currentRequestKey = isOpen ? `${tripId}:${reloadTick}` : '';
  const isLoading = isOpen && loadedRequestKey !== currentRequestKey;
  const activeTripDetail = tripDetail && tripDetail._id === tripId ? tripDetail : null;
  const activeViewerRole = serverViewerRole && serverViewerRole.tripId === tripId ? serverViewerRole.role : null;
  const joinRequested = joinRequestedTripId === tripId;

  const sharedGear = useMemo(
    () => (Array.isArray(activeTripDetail?.sharedGear) ? activeTripDetail.sharedGear : []),
    [activeTripDetail]
  );
  const expenses = useMemo(
    () => (Array.isArray(activeTripDetail?.expenses) ? activeTripDetail.expenses : []),
    [activeTripDetail]
  );
  const pendingRequests = useMemo(
    () => (Array.isArray(activeTripDetail?.pendingRequests) ? activeTripDetail.pendingRequests : []),
    [activeTripDetail]
  );

  const isBusyMutation =
    isOpeningChat ||
    isAddingExpense ||
    isSubmittingJoin ||
    Boolean(processingApplicantId) ||
    Boolean(deletingGearId) ||
    Boolean(deletingExpenseId) ||
    Boolean(togglingGearId);

  // LIFO Focus Trap for Squad Workspace dialog
  useFocusTrap(isOpen, dialogRef);

  const liveMemberCount = useMemo(() => {
    if (Array.isArray(activeTripDetail?.currentMembers) && activeTripDetail.currentMembers.length > 0) {
      return Math.max(1, activeTripDetail.currentMembers.length);
    }
    return Math.max(1, memberCount || 1);
  }, [activeTripDetail, memberCount]);

  const reloadWorkspace = useCallback(() => {
    setReloadTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!isOpen || !tripId) return;
    const controller = new AbortController();
    const requestKey = `${tripId}:${reloadTick}`;

    fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
      headers: getApiHeaders(),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success || !data.data) {
          throw new Error(data?.message || 'Không thể tải dữ liệu không gian đoàn.');
        }
        return data;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const doc: TripDetailPayload = data.data;
        setTripDetail(doc);
        if (data.viewerRole === 'creator' || data.viewerRole === 'member' || data.viewerRole === 'guest') {
          setServerViewerRole({ tripId, role: data.viewerRole });
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          onShowToastRef.current?.(
            extractErrorMessage(err, 'Không thể tải dữ liệu không gian đoàn.'),
            'error'
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadedRequestKey(requestKey);
        }
      });

    return () => controller.abort();
  }, [isOpen, tripId, reloadTick]);

  // Cleanup clipboard feedback timers & delayed CSV blob URL revocations on unmount
  useEffect(() => {
    const revokeEntries = csvRevokeEntriesRef.current;
    return () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
      if (copiedGearTimerRef.current !== null) {
        window.clearTimeout(copiedGearTimerRef.current);
      }
      revokeEntries.forEach((entry) => {
        window.clearTimeout(entry.timerId);
        URL.revokeObjectURL(entry.url);
      });
      revokeEntries.length = 0;
    };
  }, []);

  // LIFO Escape key close with IME & busy-mutation guards
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (!isTopmostFocusTrap(dialogRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!isBusyMutation) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isBusyMutation, onClose]);

  const settlement = useMemo(
    () => computeGreedyDebtSettlement(expenses, activeTripDetail, liveMemberCount),
    [expenses, activeTripDetail, liveMemberCount]
  );

  const squadRoster = useMemo(
    () => buildSquadRoster(activeTripDetail, liveMemberCount),
    [activeTripDetail, liveMemberCount]
  );

  const squadGearItems = useMemo(
    () => gearMatrixStore[tripId] || [],
    [gearMatrixStore, tripId]
  );

  const gearLoadSummary = useMemo(() => {
    const rosterById = new Map(squadRoster.map((m) => [m.id, m]));
    const normalizedItems = squadGearItems.map((it) => {
      if (it.carrierId && rosterById.has(it.carrierId)) {
        return { ...it, carrierName: rosterById.get(it.carrierId)!.name };
      }
      if (it.carrierId) {
        // Fallback match by stored carrierName if roster id changed
        const byName = squadRoster.find(
          (m) => it.carrierName && m.name.toLowerCase() === it.carrierName.toLowerCase()
        );
        if (byName) return { ...it, carrierId: byName.id, carrierName: byName.name };
        // Member left the trip -> normalize stale carrierId to '' so <select> stays synced
        return { ...it, carrierId: '', carrierName: '' };
      }
      return it;
    });

    const totalG = normalizedItems.reduce((sum, it) => sum + it.weightG, 0);
    const packedCount = normalizedItems.filter((it) => it.packed).length;
    const unassignedItems = normalizedItems.filter((it) => !it.carrierId || !rosterById.has(it.carrierId));
    const unassignedG = unassignedItems.reduce((sum, it) => sum + it.weightG, 0);
    const assignedTotalG = Math.max(0, totalG - unassignedG);
    const fairLoadThresholdPct = getFairLoadThresholdPct(squadRoster.length);

    const memberLoads = squadRoster.map((member) => {
      const carried = normalizedItems.filter((it) => it.carrierId === member.id);
      const memberG = carried.reduce((sum, it) => sum + it.weightG, 0);
      const pct = totalG > 0 ? (memberG / totalG) * 100 : 0;
      const isOverloaded =
        squadRoster.length >= 2 &&
        normalizedItems.length >= 2 &&
        totalG > 0 &&
        pct > fairLoadThresholdPct;
      return {
        id: member.id,
        name: member.name,
        totalG: memberG,
        pct,
        itemCount: carried.length,
        isOverloaded,
      };
    });

    const overloadedMembers = memberLoads.filter((m) => m.isOverloaded);
    const fairShareG = squadRoster.length > 0 ? Math.round(totalG / squadRoster.length) : totalG;

    return {
      items: normalizedItems,
      totalG,
      assignedTotalG,
      unassignedG,
      unassignedItems,
      packedCount,
      fairShareG,
      fairLoadThresholdPct,
      memberLoads,
      overloadedMembers,
    };
  }, [squadGearItems, squadRoster]);

  const syncedGearPackedCount = useMemo(
    () => sharedGear.filter((item) => item.packed).length,
    [sharedGear]
  );
  const totalSquadGearCount = gearLoadSummary.items.length + sharedGear.length;
  const totalSquadGearPackedCount = gearLoadSummary.packedCount + syncedGearPackedCount;
  const effectiveNewGearCarrierId = squadRoster.some((m) => m.id === newGearCarrierId)
    ? newGearCarrierId
    : '';

  const updateTripGearMatrix = useCallback(
    (updater: (prevItems: SquadGearMatrixItem[]) => SquadGearMatrixItem[]) => {
      setGearMatrixStore((prev) => {
        const currentItems = prev[tripId] || [];
        const nextItems = updater(currentItems);
        const nextStore = { ...prev, [tripId]: nextItems };
        writeSquadGearStore(nextStore);
        return nextStore;
      });
    },
    [tripId]
  );

  const safetyGateChecks = useMemo(() => {
    const saved = safetyGateStore[tripId];
    const record = {} as Record<SquadSafetyGateStepId, boolean>;
    for (const stepId of SQUAD_SAFETY_GATE_IDS) {
      record[stepId] = Boolean(saved?.[stepId]);
    }
    return record;
  }, [safetyGateStore, tripId]);

  const safetyGateCompletedCount = useMemo(
    () => SQUAD_SAFETY_GATE_IDS.filter((stepId) => safetyGateChecks[stepId]).length,
    [safetyGateChecks]
  );
  const isSafetyGateReady = safetyGateCompletedCount === SQUAD_SAFETY_GATE_STEPS.length;

  const handleToggleSafetyGateStep = useCallback(
    (stepId: SquadSafetyGateStepId) => {
      if (!tripId) return;
      const nextRecord = {} as Record<SquadSafetyGateStepId, boolean>;
      for (const id of SQUAD_SAFETY_GATE_IDS) {
        nextRecord[id] = id === stepId ? !safetyGateChecks[id] : safetyGateChecks[id];
      }
      const { nextStore, savedOk } = persistSafetyGateForTrip(tripId, nextRecord);
      setSafetyGateStore(nextStore);
      if (!savedOk) {
        onShowToastRef.current?.(
          'Bộ nhớ trình duyệt đã đầy — không thể lưu trạng thái Cổng Kiểm Tra An Toàn.',
          'error'
        );
      }
    },
    [tripId, safetyGateChecks]
  );

  const handleResetSafetyGate = useCallback(() => {
    if (!tripId) return;
    const nextRecord = {} as Record<SquadSafetyGateStepId, boolean>;
    for (const id of SQUAD_SAFETY_GATE_IDS) {
      nextRecord[id] = false;
    }
    const { nextStore, savedOk } = persistSafetyGateForTrip(tripId, nextRecord);
    setSafetyGateStore(nextStore);
    if (!savedOk) {
      onShowToastRef.current?.(
        'Bộ nhớ trình duyệt đã đầy — không thể lưu trạng thái đặt lại.',
        'error'
      );
      return;
    }
    onShowToastRef.current?.('Đã đặt lại 6 bước Cổng Kiểm Tra An Toàn cho chuyến đi này.', 'info');
  }, [tripId]);

  // Cross-tab localStorage sync for Safety Gate checklist
  useEffect(() => {
    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === SQUAD_SAFETY_GATE_STORAGE_KEY || e.key === null) {
        setSafetyGateStore(readSquadSafetyGateStore());
      }
    };
    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, []);

  const pickLightestCarrier = useCallback((): { id: string; name: string } => {
    if (gearLoadSummary.memberLoads.length === 0) return { id: '', name: '' };
    const sorted = [...gearLoadSummary.memberLoads].sort((a, b) => a.totalG - b.totalG);
    return { id: sorted[0].id, name: sorted[0].name };
  }, [gearLoadSummary.memberLoads]);

  const handleAddPresetGearItem = (preset: SharedGearPreset) => {
    const carrier = pickLightestCarrier();
    const newItem: SquadGearMatrixItem = {
      id: createSquadGearItemId(preset.key),
      name: preset.name,
      category: preset.category,
      weightG: preset.weightG,
      carrierId: carrier.id,
      carrierName: carrier.name,
      packed: false,
    };
    updateTripGearMatrix((prev) => [...prev, newItem]);
    onShowToastRef.current?.(
      carrier.name
        ? `Đã thêm "${preset.name}" (${preset.weightG.toLocaleString('vi-VN')} g) giao cho ${carrier.name}.`
        : `Đã thêm "${preset.name}" (${preset.weightG.toLocaleString('vi-VN')} g) vào trang bị chung.`,
      'success'
    );
  };

  const handleAddMatrixGearItem = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newGearName.trim();
    const weightNum = Math.round(Number(newGearWeightG));
    if (!cleanName) {
      onShowToastRef.current?.('Vui lòng nhập tên trang bị chung.', 'error');
      return;
    }
    if (!Number.isFinite(weightNum) || weightNum < 10 || weightNum > 50000) {
      onShowToastRef.current?.('Nhập trọng lượng hợp lệ từ 10g đến 50.000g.', 'error');
      return;
    }

    const chosenMember = newGearCarrierId
      ? squadRoster.find((m) => m.id === newGearCarrierId) || null
      : null;

    const newItem: SquadGearMatrixItem = {
      id: createSquadGearItemId('custom'),
      name: cleanName,
      category: newGearCategory,
      weightG: weightNum,
      carrierId: chosenMember ? chosenMember.id : '',
      carrierName: chosenMember ? chosenMember.name : '',
      packed: false,
    };

    updateTripGearMatrix((prev) => [...prev, newItem]);
    setNewGearName('');
    setNewGearWeightG('500');
    onShowToastRef.current?.(`Đã thêm "${cleanName}" (${weightNum.toLocaleString('vi-VN')} g) vào ma trận đồ chung!`, 'success');
  };

  const handleAssignMatrixGearCarrier = (itemId: string, nextCarrierId: string) => {
    const member = squadRoster.find((m) => m.id === nextCarrierId) || null;
    updateTripGearMatrix((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              carrierId: member ? member.id : '',
              carrierName: member ? member.name : '',
            }
          : it
      )
    );
  };

  const handleToggleMatrixGearPacked = (itemId: string) => {
    updateTripGearMatrix((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, packed: !it.packed } : it))
    );
  };

  const handleDeleteMatrixGearItem = (itemId: string) => {
    updateTripGearMatrix((prev) => prev.filter((it) => it.id !== itemId));
  };

  const handleCopyZaloGearAssignment = async () => {
    if (totalSquadGearCount === 0) {
      onShowToastRef.current?.('Chưa có trang bị chung nào để sao chép phân công.', 'info');
      return;
    }
    const reportText = buildZaloGearAssignmentReport(
      tripTitle,
      gearLoadSummary.items,
      gearLoadSummary.memberLoads,
      gearLoadSummary.unassignedItems,
      gearLoadSummary.fairLoadThresholdPct,
      sharedGear
    );
    let copied: boolean;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(reportText);
        copied = true;
      } catch {
        copied = copyTextViaExecCommand(reportText);
      }
    } else {
      copied = copyTextViaExecCommand(reportText);
    }

    if (copied) {
      setCopiedGear(true);
      if (copiedGearTimerRef.current !== null) {
        window.clearTimeout(copiedGearTimerRef.current);
      }
      copiedGearTimerRef.current = window.setTimeout(() => {
        setCopiedGear(false);
      }, 2400);
      onShowToastRef.current?.('Đã sao chép bảng phân công trang bị chung để dán gửi Zalo!', 'success');
    } else {
      onShowToastRef.current?.('Trình duyệt không cho phép sao chép tự động. Vui lòng thử lại.', 'error');
    }
  };

  const effectiveIsCreator = activeViewerRole ? activeViewerRole === 'creator' : isCreatorProp;
  const effectiveIsMember = activeViewerRole ? activeViewerRole === 'creator' || activeViewerRole === 'member' : isMemberProp;
  const showRequestsTab = effectiveIsCreator || pendingRequests.length > 0;

  const handleCopyZaloSettlement = async () => {
    const reportText = buildZaloSettlementReport(tripTitle, expenses, settlement);
    let copied: boolean;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(reportText);
        copied = true;
      } catch {
        copied = copyTextViaExecCommand(reportText);
      }
    } else {
      copied = copyTextViaExecCommand(reportText);
    }

    if (copied) {
      setCopiedSettlement(true);
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = window.setTimeout(() => {
        setCopiedSettlement(false);
      }, 2400);
      onShowToastRef.current?.('Đã sao chép bảng quyết toán chi phí để dán gửi Zalo!', 'success');
    } else {
      onShowToastRef.current?.('Trình duyệt không cho phép sao chép tự động. Vui lòng thử lại.', 'error');
    }
  };

  const handleExportRangerManifestCsv = () => {
    if (isLoading) return;
    if (!activeTripDetail) {
      onShowToastRef.current?.(
        'Chưa tải xong dữ liệu đoàn từ máy chủ để xuất bảng khai báo Kiểm lâm.',
        'error'
      );
      return;
    }
    let createdUrl: string | null = null;
    let anchor: HTMLAnchorElement | null = null;
    let scheduledRevoke = false;
    try {
      const csvContent = buildRangerManifestCsv({
        tripTitle,
        tripDetail: activeTripDetail,
        roster: squadRoster,
        memberLoads: gearLoadSummary.memberLoads,
        matrixItems: gearLoadSummary.items,
        syncedSharedGear: sharedGear,
        safetyGateChecks,
        safetyGateCompletedCount,
      });
      const filename = `khai-bao-kiem-lam-${slugifyCsvFilenamePart(activeTripDetail.trailName || tripTitle)}-${getVietnamDateCompact()}.csv`;
      const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
      createdUrl = URL.createObjectURL(blob);
      anchor = document.createElement('a');
      anchor.href = createdUrl;
      anchor.download = filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      anchor = null;

      const urlToRevoke = createdUrl;
      const entry = {
        url: urlToRevoke,
        timerId: 0,
      };
      entry.timerId = window.setTimeout(() => {
        URL.revokeObjectURL(urlToRevoke);
        const idx = csvRevokeEntriesRef.current.indexOf(entry);
        if (idx !== -1) csvRevokeEntriesRef.current.splice(idx, 1);
      }, 1500);
      csvRevokeEntriesRef.current.push(entry);
      scheduledRevoke = true;

      onShowToastRef.current?.(`Đã xuất bảng khai báo Kiểm lâm (${filename})!`, 'success');
    } catch {
      if (anchor && anchor.parentNode) {
        anchor.parentNode.removeChild(anchor);
      }
      if (createdUrl && !scheduledRevoke) {
        URL.revokeObjectURL(createdUrl);
      }
      onShowToastRef.current?.('Không thể xuất file CSV khai báo Kiểm lâm lúc này.', 'error');
    }
  };

  const handleOpenGroupChat = async () => {
    if (isOpeningChat) return;
    setIsOpeningChat(true);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/group-chat`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể mở phòng chat đoàn.');
      }
      onShowToast?.('Đã mở phòng chat nhóm đoàn!', 'success');
      const convId = data.data?.conversationId;
      if (convId) {
        localStorage.setItem('lost_target_group_conv', convId);
        onOpenGroupChat?.(convId);
      }
      onClose();
      window.history.pushState(null, '', '#messages');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (err: unknown) {
      onShowToast?.(
        extractErrorMessage(err, 'Chỉ thành viên đã được duyệt vào đoàn mới mở được chat nhóm.'),
        'error'
      );
    } finally {
      setIsOpeningChat(false);
    }
  };

  const handleToggleGearPacked = async (item: SharedGearItem) => {
    if (togglingGearId === item.id) return;
    setTogglingGearId(item.id);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/gear/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ packed: !item.packed }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const nextGear = Array.isArray(data.data) ? data.data : [];
        setTripDetail((prev) => (prev && prev._id === tripId ? { ...prev, sharedGear: nextGear } : prev));
      }
    } catch {
      onShowToast?.('Không thể cập nhật trạng thái vật dụng.', 'error');
    } finally {
      setTogglingGearId(null);
    }
  };

  const handleDeleteGear = async (gearId: string) => {
    if (deletingGearId === gearId) return;
    setDeletingGearId(gearId);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/gear/${encodeURIComponent(gearId)}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const nextGear = Array.isArray(data.data) ? data.data : [];
        setTripDetail((prev) => (prev && prev._id === tripId ? { ...prev, sharedGear: nextGear } : prev));
      }
    } catch {
      onShowToast?.('Không thể xóa vật dụng.', 'error');
    } finally {
      setDeletingGearId(null);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAddingExpense) return;
    const amount = Number(newExpAmount);
    if (!newExpTitle.trim() || !Number.isFinite(amount) || amount < 1000) {
      onShowToast?.('Nhập tên khoản chi và số tiền từ 1.000đ trở lên.', 'error');
      return;
    }
    setIsAddingExpense(true);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/expenses`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title: newExpTitle.trim(),
          amountVnd: amount,
          splitCount: Math.max(1, liveMemberCount),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      const nextExpenses = Array.isArray(data.data) ? data.data : [];
      setTripDetail((prev) => (prev && prev._id === tripId ? { ...prev, expenses: nextExpenses } : prev));
      setNewExpTitle('');
      setNewExpAmount('');
      onShowToast?.('Đã ghi nhận khoản chi đoàn!', 'success');
    } catch (err: unknown) {
      onShowToast?.(extractErrorMessage(err, 'Không thể thêm khoản chi.'), 'error');
    } finally {
      setIsAddingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (deletingExpenseId === expenseId) return;
    setDeletingExpenseId(expenseId);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const nextExpenses = Array.isArray(data.data) ? data.data : [];
        setTripDetail((prev) => (prev && prev._id === tripId ? { ...prev, expenses: nextExpenses } : prev));
      } else {
        onShowToast?.(data.message || 'Không thể xóa khoản chi.', 'error');
      }
    } catch {
      onShowToast?.('Không thể xóa khoản chi.', 'error');
    } finally {
      setDeletingExpenseId(null);
    }
  };

  const handleReviewApplicant = async (applicantUserId: string, decision: 'approve' | 'reject') => {
    if (processingApplicantId || !applicantUserId) return;
    setProcessingApplicantId(applicantUserId);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/${decision}`, {
        method: 'PUT',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ applicantUserId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(
          data.message || (decision === 'approve' ? 'Không thể duyệt thành viên.' : 'Không thể từ chối yêu cầu.')
        );
      }
      onShowToast?.(
        data.message || (decision === 'approve' ? 'Đã duyệt thành viên vào đoàn!' : 'Đã từ chối yêu cầu tham gia.'),
        decision === 'approve' ? 'success' : 'info'
      );
      reloadWorkspace();
      onTripUpdated?.();
    } catch (err: unknown) {
      onShowToast?.(extractErrorMessage(err, 'Thao tác duyệt thành viên thất bại.'), 'error');
    } finally {
      setProcessingApplicantId(null);
    }
  };

  const handleRequestJoinFromModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingJoin) return;
    const token = localStorage.getItem('lost_token');
    if (!token) {
      onShowToast?.('Vui lòng đăng nhập để gửi yêu cầu ghép đoàn.', 'info');
      window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
      return;
    }
    setIsSubmittingJoin(true);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/join`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message: joinNote.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setJoinRequestedTripId(tripId);
        setJoinNote('');
        onShowToast?.(data.message || 'Đã gửi yêu cầu tham gia tới trưởng đoàn!', 'success');
        onTripUpdated?.();
      } else {
        onShowToast?.(data.message || 'Không thể gửi yêu cầu tham gia.', 'error');
      }
    } catch {
      onShowToast?.('Lỗi kết nối máy chủ.', 'error');
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  if (!isOpen) return null;

  const maxMembers = Math.max(1, Number(activeTripDetail?.maxMembers) || liveMemberCount);
  const remainingSeats = Math.max(0, maxMembers - liveMemberCount);
  const isFull = activeTripDetail?.status === 'full' || remainingSeats === 0;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={() => {
        if (!isBusyMutation) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 'var(--z-modal, 3000)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={dialogRef}
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-label={`Không gian đoàn ${tripTitle}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 700,
          width: '95vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 22,
          borderRadius: 6,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: 'var(--shadow-3d)',
          outline: 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: '1px solid var(--color-border)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.68rem', letterSpacing: '0.1em', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase' }}>
              Không Gian Đoàn Thám Hiểm ({liveMemberCount} thành viên)
            </div>
            <h3 className="font-editorial" style={{ margin: '3px 0 0 0', fontSize: '1.3rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
              {tripTitle}
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {effectiveIsMember && (
              <>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleExportRangerManifestCsv}
                  disabled={isLoading || !activeTripDetail}
                  title={
                    !activeTripDetail && !isLoading
                      ? 'Chưa tải được dữ liệu đoàn từ máy chủ để xuất bảng khai báo Kiểm lâm'
                      : 'Tải danh sách thành viên, tải đồ chung và trạng thái 6 bước an toàn chuẩn khai báo Kiểm lâm'
                  }
                  style={{
                    padding: '7px 11px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    borderRadius: 4,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <IconDownload size={14} color="var(--color-primary)" />
                  <span>Xuất Bảng Khai Báo Kiểm Lâm (CSV)</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleOpenGroupChat}
                  disabled={isOpeningChat}
                  style={{ padding: '7px 14px', fontSize: '0.78rem', borderRadius: 4 }}
                >
                  <IconMessageSquare size={14} />
                  <span>{isOpeningChat ? 'Đang mở...' : 'Mở Group Chat Đoàn'}</span>
                </button>
              </>
            )}
            <button
              type="button"
              disabled={isBusyMutation}
              onClick={() => {
                if (!isBusyMutation) onClose();
              }}
              aria-label="Đóng"
              title="Đóng (Esc)"
              style={{
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                color: 'var(--color-text-muted)',
                cursor: isBusyMutation ? 'not-allowed' : 'pointer',
                opacity: isBusyMutation ? 0.5 : 1,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconX size={18} />
            </button>
          </div>
        </div>

        {/* Non-member overview & join card when opened from Calendar */}
        {!effectiveIsMember ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ fontSize: '0.84rem', color: 'var(--color-text-main)', lineHeight: 1.55 }}>
                {activeTripDetail?.description || 'Kế hoạch ghép đoàn thám hiểm thực địa trên hệ thống LOST.'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                {activeTripDetail?.startDate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconCalendar size={14} color="var(--color-primary)" />
                    <span>
                      Khởi hành: <strong style={{ color: 'var(--color-text-main)' }}>{new Date(activeTripDetail.startDate).toLocaleDateString('vi-VN')}</strong>
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconUsers size={14} color="var(--color-sky)" />
                  <span>
                    Chỗ trống: <strong style={{ color: isFull ? 'var(--color-error-text, var(--color-error))' : 'var(--color-primary)' }}>{isFull ? 'Hết chỗ' : `${remainingSeats}/${maxMembers} chỗ`}</strong>
                  </span>
                </div>
                {activeTripDetail?.meetingPoint && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, gridColumn: '1 / -1' }}>
                    <IconMapPin size={14} color="var(--color-earth)" />
                    <span>Điểm hẹn: <strong style={{ color: 'var(--color-text-main)' }}>{activeTripDetail.meetingPoint}</strong></span>
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                padding: '10px 14px',
                borderRadius: 4,
                background: 'color-mix(in srgb, var(--color-sky) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-sky) 30%, transparent)',
                fontSize: '0.78rem',
                color: 'var(--color-text-main)',
              }}
            >
              Phòng chat nhóm, danh sách đồ dùng chung và bảng chia chi phí chỉ hiển thị sau khi Trưởng đoàn duyệt bạn vào đoàn.
            </div>

            {joinRequested ? (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 4,
                  background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                  border: '1px solid var(--color-primary)',
                  color: 'var(--color-primary)',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <IconCheckCircle size={16} color="var(--color-primary)" />
                <span>Đã gửi yêu cầu tham gia tới Trưởng đoàn!</span>
              </div>
            ) : (
              <form onSubmit={handleRequestJoinFromModal} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="form-input"
                  value={joinNote}
                  onChange={(e) => setJoinNote(e.target.value)}
                  placeholder="Giới thiệu nhanh thể lực, kinh nghiệm leo núi của bạn..."
                  disabled={isFull || isSubmittingJoin}
                  style={{ flex: 1, minWidth: 220, fontSize: '0.84rem', borderRadius: 4 }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isFull || isSubmittingJoin}
                  style={{ borderRadius: 4, padding: '8px 16px', fontSize: '0.82rem', fontWeight: 800 }}
                >
                  <IconUserPlus size={15} />
                  <span>{isFull ? 'Hết chỗ' : isSubmittingJoin ? 'Đang gửi...' : 'Xin Ghép Đoàn'}</span>
                </button>
              </form>
            )}
          </div>
        ) : (
          <>
            {/* Pre-Departure Leader Safety Gate (6-Step Checklist with Pure-SVG Readiness Progress Bar) */}
            <div
              style={{
                marginBottom: 14,
                borderRadius: 4,
                background: 'var(--color-bg-main)',
                border: isSafetyGateReady
                  ? '1px solid var(--color-primary)'
                  : '1px solid var(--color-border-strong)',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                aria-expanded={isSafetyGateOpen}
                aria-controls="squad-safety-gate-panel"
                onClick={() => setIsSafetyGateOpen((prev) => !prev)}
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: '10px 12px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-family)',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      color: 'var(--color-text-main)',
                    }}
                  >
                    <IconShieldCheck
                      size={15}
                      color={isSafetyGateReady ? 'var(--color-primary)' : 'var(--color-sky)'}
                    />
                    <span>Cổng Kiểm Tra An Toàn Trước Giờ G (6 Bước)</span>
                  </span>

                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        fontVariantNumeric: 'tabular-nums',
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: isSafetyGateReady
                          ? 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-card))'
                          : safetyGateCompletedCount > 0
                            ? 'color-mix(in srgb, var(--color-sky) 8%, var(--color-bg-card))'
                            : 'var(--color-bg-card)',
                        border: isSafetyGateReady
                          ? '1px solid color-mix(in srgb, var(--color-primary) 42%, var(--color-border))'
                          : safetyGateCompletedCount > 0
                            ? '1px solid color-mix(in srgb, var(--color-sky) 40%, var(--color-border))'
                            : '1px solid var(--color-border)',
                        color: isSafetyGateReady
                          ? 'var(--color-primary)'
                          : safetyGateCompletedCount > 0
                            ? 'var(--color-sky)'
                            : 'var(--color-text-muted)',
                      }}
                    >
                      {isSafetyGateReady
                        ? `${safetyGateCompletedCount}/${SQUAD_SAFETY_GATE_STEPS.length} Sẵn Sàng`
                        : `${safetyGateCompletedCount}/${SQUAD_SAFETY_GATE_STEPS.length} Bước`}
                    </span>
                    <IconChevronRight
                      size={15}
                      color="var(--color-text-muted)"
                      style={{
                        transform: isSafetyGateOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.18s ease',
                        flexShrink: 0,
                      }}
                    />
                  </span>
                </div>

                {/* Pure-SVG 6-Segment Readiness Progress Bar */}
                <div
                  role="progressbar"
                  aria-label="Tiến độ Cổng Kiểm Tra An Toàn Trước Giờ G"
                  aria-valuenow={safetyGateCompletedCount}
                  aria-valuemin={0}
                  aria-valuemax={SQUAD_SAFETY_GATE_STEPS.length}
                  aria-valuetext={`${safetyGateCompletedCount} trên ${SQUAD_SAFETY_GATE_STEPS.length} bước an toàn`}
                  style={{ width: '100%' }}
                >
                  <svg
                    viewBox="0 0 360 8"
                    aria-hidden="true"
                    style={{ width: '100%', height: 8, display: 'block' }}
                  >
                    {SQUAD_SAFETY_GATE_STEPS.map((step, idx) => {
                      const checked = safetyGateChecks[step.id];
                      const gap = 4;
                      const segW = (360 - gap * (SQUAD_SAFETY_GATE_STEPS.length - 1)) / SQUAD_SAFETY_GATE_STEPS.length;
                      const x = idx * (segW + gap);
                      const fillColor = checked
                        ? isSafetyGateReady
                          ? 'var(--color-primary)'
                          : 'var(--color-sky)'
                        : 'var(--color-bg-card)';
                      return (
                        <rect
                          key={step.id}
                          x={x}
                          y={0.5}
                          width={segW}
                          height={7}
                          rx={2.5}
                          fill={fillColor}
                          stroke={checked ? fillColor : 'var(--color-border)'}
                          strokeWidth={0.8}
                        />
                      );
                    })}
                  </svg>
                </div>
              </button>

              {isSafetyGateOpen && (
                <div
                  id="squad-safety-gate-panel"
                  style={{
                    borderTop: '1px solid var(--color-border)',
                    padding: '10px 12px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border-strong)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      Lưu cục bộ trên thiết bị
                    </span>
                    {safetyGateCompletedCount > 0 && (
                      <button
                        type="button"
                        onClick={handleResetSafetyGate}
                        className="btn btn-outline"
                        style={{ padding: '3px 8px', fontSize: '0.7rem', borderRadius: 4, fontWeight: 700 }}
                      >
                        Đặt lại 6 bước
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {SQUAD_SAFETY_GATE_STEPS.map((step, idx) => {
                      const checked = safetyGateChecks[step.id];
                      return (
                        <button
                          key={step.id}
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          onClick={() => handleToggleSafetyGateStep(step.id)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 9,
                            padding: '8px 10px',
                            borderRadius: 4,
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-family)',
                            background: checked
                              ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card))'
                              : 'var(--color-bg-card)',
                            border: checked
                              ? '1px solid color-mix(in srgb, var(--color-primary) 45%, transparent)'
                              : '1px solid var(--color-border)',
                          }}
                        >
                          <IconCheckCircle
                            size={16}
                            color={checked ? 'var(--color-primary)' : 'var(--color-text-dim)'}
                            style={{ marginTop: 1, flexShrink: 0 }}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                fontSize: '0.79rem',
                                fontWeight: 800,
                                color: 'var(--color-text-main)',
                                textDecoration: checked ? 'line-through' : 'none',
                              }}
                            >
                              {idx + 1}. {step.title}
                            </div>
                            <div
                              style={{
                                fontSize: '0.71rem',
                                color: 'var(--color-text-muted)',
                                lineHeight: 1.4,
                                marginTop: 2,
                              }}
                            >
                              {step.detail}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {isSafetyGateReady && (
                    <div
                      style={{
                        padding: '8px 10px',
                        borderRadius: 4,
                        background: 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-card))',
                        border: '1px solid color-mix(in srgb, var(--color-primary) 42%, var(--color-border))',
                        color: 'var(--color-text-main)',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <IconCheck size={14} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                      <span>Đoàn đã hoàn tất 6/6 bước an toàn trước giờ G — Sẵn sàng xuất phát!</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sub-Tabs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: showRequestsTab ? 'repeat(auto-fit, minmax(150px, 1fr))' : '1fr 1fr',
                gap: 8,
                marginBottom: 16,
              }}
            >
              <button
                type="button"
                className={`btn ${activeTab === 'gear' ? 'btn-sky' : 'btn-outline'}`}
                onClick={() => setActiveTab('gear')}
                style={{ justifyContent: 'center', fontSize: '0.8rem', padding: '8px 10px', borderRadius: 4 }}
              >
                <IconBackpack size={14} />
                <span>Trang Bị Chung Đoàn ({gearLoadSummary.items.length + sharedGear.length})</span>
              </button>
              <button
                type="button"
                className={`btn ${activeTab === 'expenses' ? 'btn-earth' : 'btn-outline'}`}
                onClick={() => setActiveTab('expenses')}
                style={{ justifyContent: 'center', fontSize: '0.8rem', padding: '8px 10px', borderRadius: 4 }}
              >
                <span>Chia Chi Phí ({expenses.length})</span>
              </button>
              {showRequestsTab && (
                <button
                  type="button"
                  className={`btn ${activeTab === 'requests' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setActiveTab('requests')}
                  style={{ justifyContent: 'center', fontSize: '0.8rem', padding: '8px 10px', borderRadius: 4 }}
                >
                  <IconUserPlus size={14} />
                  <span>Chờ Duyệt ({pendingRequests.length})</span>
                </button>
              )}
            </div>

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: 28, color: 'var(--color-text-dim)', fontSize: '0.84rem' }}>
                Đang tải dữ liệu đoàn...
              </div>
            ) : activeTab === 'requests' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pendingRequests.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: 24,
                      borderRadius: 4,
                      border: '1px dashed var(--color-border)',
                      color: 'var(--color-text-muted)',
                      fontSize: '0.82rem',
                    }}
                  >
                    Hiện không có yêu cầu xin ghép đoàn nào đang chờ duyệt.
                  </div>
                ) : (
                  pendingRequests.map((reqItem, idx) => {
                    const userObj = typeof reqItem.userId === 'object' && reqItem.userId ? reqItem.userId : null;
                    const applicantId = userObj?._id || (typeof reqItem.userId === 'string' ? reqItem.userId : '');
                    const applicantName = userObj?.fullName || 'Thành viên LOST';
                    const isBusy = processingApplicantId === applicantId;
                    const reqDate = reqItem.requestedAt
                      ? new Date(reqItem.requestedAt).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '';

                    return (
                      <div
                        key={applicantId || idx}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 4,
                          background: 'var(--color-bg-main)',
                          border: '1px solid var(--color-border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {userObj?.avatarUrl ? (
                              <img
                                src={userObj.avatarUrl}
                                alt={applicantName}
                                referrerPolicy="no-referrer"
                                style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--color-primary)' }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: '50%',
                                  background: 'color-mix(in srgb, var(--color-sky) 16%, transparent)',
                                  border: '1px solid var(--color-sky)',
                                  color: 'var(--color-sky)',
                                  fontWeight: 800,
                                  fontSize: '0.84rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {applicantName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                                {applicantName}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {userObj?.reputationScore !== undefined && (
                                  <span style={{ color: 'var(--color-primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <IconStar size={11} color="var(--color-primary)" fill="var(--color-primary)" />
                                    {userObj.reputationScore} Uy tín
                                  </span>
                                )}
                                {reqDate && <span>• {reqDate}</span>}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              disabled={Boolean(processingApplicantId) || isFull}
                              onClick={() => handleReviewApplicant(applicantId, 'approve')}
                              className="btn btn-primary"
                              style={{ padding: '6px 12px', fontSize: '0.76rem', borderRadius: 4, fontWeight: 700 }}
                            >
                              {isBusy ? 'Đang xử lý...' : 'Duyệt vào đoàn'}
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(processingApplicantId)}
                              onClick={() => handleReviewApplicant(applicantId, 'reject')}
                              className="btn btn-outline"
                              style={{
                                padding: '6px 12px',
                                fontSize: '0.76rem',
                                borderRadius: 4,
                                fontWeight: 700,
                                color: 'var(--color-error-text, var(--color-error))',
                                borderColor: 'color-mix(in srgb, var(--color-error) 40%, transparent)',
                              }}
                            >
                              Từ chối
                            </button>
                          </div>
                        </div>

                        {reqItem.message && (
                          <div
                            style={{
                              fontSize: '0.8rem',
                              color: 'var(--color-text-muted)',
                              background: 'var(--color-bg-card)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 4,
                              padding: '8px 10px',
                              lineHeight: 1.45,
                            }}
                          >
                            &ldquo;{reqItem.message}&rdquo;
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : activeTab === 'gear' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Shared Gear Telemetry KPIs + Local Sync Scope Badge + 1-Click Zalo Export */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 4,
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border-strong)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        color: 'var(--color-text-dim)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Ma Trận Cân Tải Đồ Chung
                    </span>
                    <span
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border-strong)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      Lưu cục bộ trên thiết bị
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                          Tổng Tải Đồ Chung
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatWeightKg(gearLoadSummary.totalG)} kg{' '}
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                            ({gearLoadSummary.totalG.toLocaleString('vi-VN')} g)
                          </span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                          Bình Quân ({squadRoster.length} người)
                        </div>
                        <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--color-sky)', fontVariantNumeric: 'tabular-nums' }}>
                          ~{formatWeightKg(gearLoadSummary.fairShareG)} kg / người
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                          Tiến Độ Chuẩn Bị
                        </div>
                        <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                          {totalSquadGearPackedCount}/{totalSquadGearCount} món
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={handleCopyZaloGearAssignment}
                      disabled={totalSquadGearCount === 0}
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        borderRadius: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        color: copiedGear ? 'var(--color-primary)' : 'var(--color-text-main)',
                        borderColor: copiedGear ? 'var(--color-primary)' : 'var(--color-border-strong)',
                      }}
                    >
                      {copiedGear ? <IconCheck size={13} color="var(--color-primary)" /> : <IconCopy size={13} />}
                      <span>{copiedGear ? 'Đã sao chép!' : 'Sao Chép Phân Công Gửi Zalo'}</span>
                    </button>
                  </div>
                </div>

                {/* Fair-Load Imbalance Alert (dynamic squad-size threshold, requires >= 2 items) */}
                {gearLoadSummary.overloadedMembers.length > 0 && (
                  <div
                    role="alert"
                    style={{
                      padding: '9px 12px',
                      borderRadius: 4,
                      background: 'var(--banner-danger-bg)',
                      border: '1px solid var(--banner-danger-border)',
                      color: 'var(--color-error-text, var(--banner-danger-text))',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <IconAlertTriangle size={15} color="var(--color-error-text, var(--banner-danger-text))" style={{ flexShrink: 0 }} />
                    <span>
                      Cảnh báo lệch tải (&gt;{gearLoadSummary.fairLoadThresholdPct}%):{' '}
                      <strong>
                        {gearLoadSummary.overloadedMembers
                          .map((m) => `${m.name} (${m.pct.toFixed(0)}%)`)
                          .join(', ')}
                      </strong>{' '}
                      đang mang quá tỷ lệ cân bằng. Hãy phân bổ bớt trang bị cho đồng đội!
                    </span>
                  </div>
                )}

                {/* Vietnam Trekking Shared-Gear Presets (1-Click Auto Balanced Add) */}
                <div>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      color: 'var(--color-text-dim)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 6,
                    }}
                  >
                    Gợi Ý Đồ Chung Thực Địa Việt Nam (Bấm để thêm &amp; tự cân bằng tải)
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {VIETNAM_SQUAD_GEAR_PRESETS.map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => handleAddPresetGearItem(preset)}
                        className="btn btn-outline"
                        style={{
                          padding: '5px 9px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          borderRadius: 4,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <IconPlus size={11} color="var(--color-primary)" />
                        <span>{preset.name}</span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                          {preset.weightG.toLocaleString('vi-VN')}g
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add Custom Shared Gear Item Form */}
                <form
                  onSubmit={handleAddMatrixGearItem}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: 8,
                    padding: 10,
                    borderRadius: 4,
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <input
                    className="form-input"
                    value={newGearName}
                    onChange={(e) => setNewGearName(e.target.value)}
                    placeholder="Tên món (VD: Nồi dã ngoại...)"
                    aria-label="Tên trang bị chung của đoàn"
                    style={{ gridColumn: '1 / -1', minWidth: 0, fontSize: '0.82rem', borderRadius: 4 }}
                    required
                  />
                  <input
                    type="number"
                    min="10"
                    max="50000"
                    step="10"
                    className="form-input"
                    value={newGearWeightG}
                    onChange={(e) => setNewGearWeightG(e.target.value)}
                    placeholder="Gram (g)"
                    aria-label="Trọng lượng trang bị chung tính theo gram"
                    style={{ minWidth: 0, fontSize: '0.82rem', borderRadius: 4, fontVariantNumeric: 'tabular-nums' }}
                    required
                  />
                  <select
                    className="form-input"
                    value={newGearCategory}
                    onChange={(e) => setNewGearCategory(e.target.value)}
                    aria-label="Danh mục trang bị chung"
                    style={{ minWidth: 0, fontSize: '0.78rem', borderRadius: 4 }}
                  >
                    <option value="Lán trại & Nấu ăn">Lán trại &amp; Nấu ăn</option>
                    <option value="Y tế & An toàn">Y tế &amp; An toàn</option>
                    <option value="Nước & Thực phẩm">Nước &amp; Thực phẩm</option>
                    <option value="Dùng chung">Dùng chung</option>
                  </select>
                  <select
                    className="form-input"
                    value={effectiveNewGearCarrierId}
                    onChange={(e) => setNewGearCarrierId(e.target.value)}
                    aria-label="Người mang trang bị chung"
                    style={{ minWidth: 0, fontSize: '0.78rem', borderRadius: 4 }}
                  >
                    <option value="">-- Chưa phân công --</option>
                    {squadRoster.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={!newGearName.trim()}
                    className="btn btn-primary"
                    style={{ fontSize: '0.78rem', fontWeight: 800, padding: '7px 12px', borderRadius: 4 }}
                  >
                    + Thêm Đồ Chung
                  </button>
                </form>

                {/* Shared Gear Matrix Items */}
                {gearLoadSummary.items.length === 0 ? (
                  sharedGear.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, borderRadius: 4, border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                      Chưa có trang bị chung nào. Chọn nhanh các món gợi ý ở trên hoặc thêm vật dụng tùy chỉnh để chia đều tải cho cả đoàn!
                    </div>
                  ) : (
                    <div style={{ padding: '9px 12px', borderRadius: 4, border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.76rem' }}>
                      Đoàn đã có <strong>{sharedGear.length} món</strong> đồng bộ bên dưới. Thêm món kèm trọng lượng (g) vào ma trận cục bộ ở trên để tự động cân bằng tải theo thành viên.
                    </div>
                  )
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 250, overflowY: 'auto' }}>
                    {gearLoadSummary.items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          flexWrap: 'wrap',
                          padding: '9px 12px',
                          borderRadius: 4,
                          background: item.packed ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--color-bg-main)',
                          border: item.packed ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleMatrixGearPacked(item.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 9,
                            cursor: 'pointer',
                            flex: '1 1 180px',
                            minWidth: 0,
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                          }}
                        >
                          <IconCheckCircle size={17} color={item.packed ? 'var(--color-primary)' : 'var(--color-text-dim)'} />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '0.84rem',
                                fontWeight: 700,
                                color: 'var(--color-text-main)',
                                textDecoration: item.packed ? 'line-through' : 'none',
                              }}
                            >
                              {item.name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                              {item.category} •{' '}
                              <strong style={{ color: 'var(--color-earth)' }}>
                                {item.weightG.toLocaleString('vi-VN')} g
                              </strong>
                            </div>
                          </div>
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <select
                            className="form-input"
                            aria-label={`Chọn người mang ${item.name}`}
                            value={item.carrierId}
                            onChange={(e) => handleAssignMatrixGearCarrier(item.id, e.target.value)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.74rem',
                              borderRadius: 4,
                              maxWidth: 155,
                              background: 'var(--color-bg-card)',
                            }}
                          >
                            <option value="">Chưa phân công</option>
                            {squadRoster.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleDeleteMatrixGearItem(item.id)}
                            aria-label={`Xóa ${item.name}`}
                            style={{ background: 'none', border: 'none', color: 'var(--color-error-text, var(--banner-danger-text))', cursor: 'pointer', padding: 4 }}
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Per-Member Shared Weight Load Distribution Bars */}
                {gearLoadSummary.items.length > 0 && (
                  <div
                    style={{
                      background: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border-strong)',
                      borderRadius: 4,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          letterSpacing: '0.05em',
                          color: 'var(--color-text-dim)',
                          textTransform: 'uppercase',
                        }}
                      >
                        Phân Bổ Tải Trọng Đồ Chung Theo Thành Viên
                      </span>
                      {gearLoadSummary.unassignedG > 0 && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-sun)', fontVariantNumeric: 'tabular-nums' }}>
                          Chưa giao: {formatWeightKg(gearLoadSummary.unassignedG)} kg ({gearLoadSummary.unassignedItems.length} món)
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {gearLoadSummary.memberLoads.map((member) => {
                        const barWidth = Math.min(100, Math.max(0, Math.round(member.pct)));
                        return (
                          <div key={member.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.76rem' }}>
                              <span style={{ color: 'var(--color-text-main)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <span>{member.name}</span>
                                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--color-text-dim)' }}>
                                  ({member.itemCount} món)
                                </span>
                                {member.isOverloaded && (
                                  <span
                                    style={{
                                      fontSize: '0.64rem',
                                      fontWeight: 800,
                                      padding: '1px 6px',
                                      borderRadius: 3,
                                      background: 'var(--banner-danger-bg)',
                                      border: '1px solid var(--banner-danger-border)',
                                      color: 'var(--color-error-text, var(--banner-danger-text))',
                                    }}
                                  >
                                    Quá tải (&gt;{gearLoadSummary.fairLoadThresholdPct}%)
                                  </span>
                                )}
                              </span>
                              <span
                                style={{
                                  fontWeight: 800,
                                  fontVariantNumeric: 'tabular-nums',
                                  color: member.isOverloaded
                                    ? 'var(--color-error-text, var(--banner-danger-text))'
                                    : member.totalG > 0
                                      ? 'var(--color-primary)'
                                      : 'var(--color-text-dim)',
                                }}
                              >
                                {formatWeightKg(member.totalG)} kg ({member.pct.toFixed(0)}%)
                              </span>
                            </div>
                            <div
                              style={{
                                width: '100%',
                                height: 6,
                                borderRadius: 3,
                                background: 'var(--color-bg-card)',
                                border: '1px solid var(--color-border)',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${barWidth}%`,
                                  height: '100%',
                                  background: member.isOverloaded ? 'var(--color-error)' : 'var(--color-primary)',
                                  transition: 'width 0.25s ease',
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Existing Server-Synced Shared Gear Records (if any exist on trip document) */}
                {sharedGear.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Đồ Chung Đã Đồng Bộ Trên Đoàn ({sharedGear.length})
                    </div>
                    {sharedGear.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '8px 12px',
                          borderRadius: 4,
                          background: item.packed ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--color-bg-main)',
                          border: item.packed ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                        }}
                      >
                        <button
                          type="button"
                          disabled={togglingGearId === item.id}
                          onClick={() => handleToggleGearPacked(item)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            cursor: togglingGearId === item.id ? 'wait' : 'pointer',
                            flex: 1,
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                          }}
                        >
                          <IconCheckCircle size={17} color={item.packed ? 'var(--color-primary)' : 'var(--color-text-dim)'} />
                          <div>
                            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-main)', textDecoration: item.packed ? 'line-through' : 'none' }}>
                              {item.itemName}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                              {item.category} • Phụ trách: <strong style={{ color: 'var(--color-primary)' }}>{item.assignedUserName}</strong>
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          disabled={deletingGearId === item.id}
                          onClick={() => handleDeleteGear(item.id)}
                          aria-label="Xóa vật dụng"
                          style={{ background: 'none', border: 'none', color: 'var(--color-error-text, var(--banner-danger-text))', cursor: deletingGearId === item.id ? 'wait' : 'pointer', padding: 4 }}
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Summary KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: 12 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Tổng Chi Phí Đoàn</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--color-primary)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                      {settlement.totalVnd.toLocaleString('vi-VN')} đ
                    </div>
                  </div>
                  <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: 12 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      Bình Quân / Người ({settlement.participantCount} người)
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--color-sky)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                      {settlement.perPersonAverageVnd.toLocaleString('vi-VN')} đ
                    </div>
                  </div>
                </div>

                <form onSubmit={handleAddExpense} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    className="form-input"
                    value={newExpTitle}
                    onChange={(e) => setNewExpTitle(e.target.value)}
                    placeholder="VD: Thuê Porter, Vé VQG, Xe khách..."
                    disabled={isAddingExpense}
                    style={{ flex: 2, minWidth: 190, fontSize: '0.84rem', borderRadius: 4 }}
                    required
                  />
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    className="form-input"
                    value={newExpAmount}
                    onChange={(e) => setNewExpAmount(e.target.value)}
                    placeholder="Số tiền (VNĐ)"
                    disabled={isAddingExpense}
                    style={{ flex: 1, minWidth: 130, fontSize: '0.84rem', borderRadius: 4 }}
                    required
                  />
                  <button
                    type="submit"
                    disabled={isAddingExpense || !newExpTitle.trim() || !newExpAmount}
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '8px 14px', borderRadius: 4 }}
                  >
                    {isAddingExpense ? 'Đang lưu...' : '+ Ghi Khoản Chi'}
                  </button>
                </form>

                {expenses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, borderRadius: 4, border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                    Chưa có khoản chi nào. Ghi nhận tiền xe, porter, vé vào rừng để hệ thống chia đều tự động!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                    {expenses.map((exp) => (
                      <div
                        key={exp.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '10px 14px',
                          borderRadius: 4,
                          background: 'var(--color-bg-main)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{exp.title}</div>
                          <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)' }}>
                            Người ứng: <strong>{exp.paidByName}</strong>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <strong style={{ color: 'var(--color-earth)', fontSize: '0.88rem', fontVariantNumeric: 'tabular-nums' }}>
                            {Number(exp.amountVnd).toLocaleString('vi-VN')} đ
                          </strong>
                          <button
                            type="button"
                            disabled={deletingExpenseId === exp.id}
                            onClick={() => handleDeleteExpense(exp.id)}
                            aria-label="Xóa khoản chi"
                            style={{ background: 'none', border: 'none', color: 'var(--color-error-text, var(--color-error))', cursor: deletingExpenseId === exp.id ? 'wait' : 'pointer', padding: 4 }}
                          >
                            <IconTrash size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {expenses.length > 0 && (
                  <div
                    style={{
                      background: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border-strong)',
                      borderRadius: 4,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    {/* Settlement Header + 1-Click Zalo Export */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        flexWrap: 'wrap',
                        paddingBottom: 10,
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <IconScale size={15} color="var(--color-primary)" />
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            letterSpacing: '0.05em',
                            color: 'var(--color-text-main)',
                            textTransform: 'uppercase',
                          }}
                        >
                          Ai Trả Ai — Tối Ưu Giao Dịch
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: 4,
                            background: settlement.isSettled
                              ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)'
                              : 'color-mix(in srgb, var(--color-earth) 14%, transparent)',
                            border: settlement.isSettled
                              ? '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)'
                              : '1px solid color-mix(in srgb, var(--color-earth) 35%, transparent)',
                            color: settlement.isSettled ? 'var(--color-primary)' : 'var(--color-earth)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {settlement.isSettled
                            ? 'Đã cân bằng'
                            : `${settlement.transfers.length} giao dịch tối thiểu`}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={handleCopyZaloSettlement}
                        style={{
                          padding: '5px 10px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          borderRadius: 4,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          color: copiedSettlement ? 'var(--color-primary)' : 'var(--color-text-main)',
                          borderColor: copiedSettlement ? 'var(--color-primary)' : 'var(--color-border-strong)',
                        }}
                      >
                        {copiedSettlement ? (
                          <IconCheck size={13} color="var(--color-primary)" />
                        ) : (
                          <IconCopy size={13} />
                        )}
                        <span>{copiedSettlement ? 'Đã sao chép!' : 'Sao Chép Bảng Quyết Toán Gửi Zalo'}</span>
                      </button>
                    </div>

                    {/* Minimal Transfer Matrix */}
                    {settlement.isSettled ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 12px',
                          borderRadius: 4,
                          background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                          border: '1px solid color-mix(in srgb, var(--color-primary) 32%, transparent)',
                          color: 'var(--color-primary)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                        }}
                      >
                        <IconCheckCircle size={16} color="var(--color-primary)" />
                        <span>Tất cả thành viên đã cân bằng chi phí — không cần chuyển khoản thêm!</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {settlement.transfers.map((transfer, idx) => (
                          <div
                            key={`${transfer.from}-${transfer.to}-${idx}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10,
                              flexWrap: 'wrap',
                              padding: '9px 12px',
                              borderRadius: 4,
                              background: 'var(--color-bg-card)',
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.82rem' }}>
                              <span
                                style={{
                                  fontWeight: 800,
                                  color: 'var(--color-error-text, var(--color-error))',
                                  padding: '2px 7px',
                                  borderRadius: 4,
                                  background: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
                                  border: '1px solid color-mix(in srgb, var(--color-error) 25%, transparent)',
                                }}
                              >
                                {transfer.from}
                              </span>
                              <IconArrowRight size={14} color="var(--color-text-muted)" />
                              <span
                                style={{
                                  fontWeight: 800,
                                  color: 'var(--color-primary)',
                                  padding: '2px 7px',
                                  borderRadius: 4,
                                  background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                                  border: '1px solid color-mix(in srgb, var(--color-primary) 28%, transparent)',
                                }}
                              >
                                {transfer.to}
                              </span>
                            </div>

                            <strong
                              style={{
                                fontSize: '0.88rem',
                                fontWeight: 900,
                                color: 'var(--color-earth)',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {transfer.amountVnd.toLocaleString('vi-VN')} đ
                            </strong>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Per-Member Net Balance Chips */}
                    <div>
                      <div
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          color: 'var(--color-text-dim)',
                          textTransform: 'uppercase',
                          marginBottom: 6,
                        }}
                      >
                        Số Dư Ròng Theo Thành Viên ({settlement.participantCount} người)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: '0.78rem' }}>
                        {settlement.balances.map((member) => {
                          const isCreditor = member.balanceVnd >= SETTLEMENT_DUST_VND;
                          const isDebtor = member.balanceVnd <= -SETTLEMENT_DUST_VND;
                          return (
                            <div
                              key={member.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 8,
                                flexWrap: 'wrap',
                                padding: '5px 8px',
                                borderRadius: 4,
                                background: 'var(--color-bg-card)',
                                border: '1px solid var(--color-border)',
                              }}
                            >
                              <span style={{ color: 'var(--color-text-main)' }}>
                                <strong>{member.name}</strong>{' '}
                                <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                  (đã ứng {member.paidVnd.toLocaleString('vi-VN')} đ)
                                </span>
                              </span>
                              <span
                                style={{
                                  fontWeight: 800,
                                  fontSize: '0.74rem',
                                  padding: '2px 7px',
                                  borderRadius: 4,
                                  fontVariantNumeric: 'tabular-nums',
                                  color: isCreditor
                                    ? 'var(--color-primary)'
                                    : isDebtor
                                      ? 'var(--color-error-text, var(--color-error))'
                                      : 'var(--color-text-muted)',
                                  background: isCreditor
                                    ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
                                    : isDebtor
                                      ? 'color-mix(in srgb, var(--color-error) 12%, transparent)'
                                      : 'var(--color-bg-main)',
                                }}
                              >
                                {isCreditor
                                  ? `Nhận lại +${member.balanceVnd.toLocaleString('vi-VN')} đ`
                                  : isDebtor
                                    ? `Cần bù ${Math.abs(member.balanceVnd).toLocaleString('vi-VN')} đ`
                                    : 'Đã cân bằng'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
