import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { useFocusTrap, isTopmostFocusTrap } from '../../hooks/useFocusTrap.js';
import type { UserProfile } from '../../types.js';
import { AuthorProfileModal } from '../forum/AuthorProfileModal.js';
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
  IconEdit,
} from '../common/SvgIcons.js';
import { safeLocalStorageGet } from '../../utils/storageScope.js';

interface SharedGearItem {
  id: string;
  itemName: string;
  category: string;
  weightG?: number;
  assignedUserId?: string;
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

interface SafetyGateStepMeta {
  checked?: boolean;
  checkedBy?: string | { _id?: string; fullName?: string; username?: string };
  checkedByName?: string;
  checkedAt?: string;
}

type SafetyGateValue = boolean | SafetyGateStepMeta;

interface TripDetailPayload {
  _id: string;
  title: string;
  trailName?: string;
  description?: string;
  requirements?: string;
  startDate?: string;
  endDate?: string;
  meetingPoint?: string;
  estimatedCost?: string;
  difficultyLevel?: number;
  maxMembers?: number;
  status?: 'recruiting' | 'full' | 'in_progress' | 'completed' | 'cancelled' | string;
  tags?: string[];
  creatorId?: { _id?: string; fullName?: string; avatarUrl?: string } | string;
  currentMembers?: Array<{ _id?: string; fullName?: string; avatarUrl?: string; reputationScore?: number } | string>;
  pendingRequests?: PendingApplicant[];
  sharedGear?: SharedGearItem[];
  safetyGate?: Record<string, SafetyGateValue>;
  safetyGateAudit?: Record<string, SafetyGateStepMeta>;
  safetyGateMeta?: Record<string, SafetyGateStepMeta>;
  expenses?: ExpenseItem[];
  settledTransfers?: string[];
  hasPendingRequest?: boolean;
}

interface SquadWorkspaceModalProps {
  tripId: string;
  tripTitle: string;
  memberCount: number;
  currentUserId?: string;
  currentUser?: UserProfile | null;
  isCreator?: boolean;
  isMember?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onOpenGroupChat?: (conversationId: string) => void;
  onTripUpdated?: () => void;
  onOpenAuthorProfile?: (author: { name: string; avatar: string; userId?: string }) => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface MemberSettlementBalance {
  id: string;
  name: string;
  paidVnd: number;
  balanceVnd: number;
  isEstimatedSlot?: boolean;
  isDeparted?: boolean;
}

interface DebtTransfer {
  fromId: string;
  from: string;
  toId: string;
  to: string;
  amountVnd: number;
  key: string;
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
const MAX_TRIP_MEMBERS_CAP = 30;
const MIN_EXPENSE_VND = 1000;
const MAX_EXPENSE_VND = 500_000_000;

interface TripDetailFetchResult {
  doc: TripDetailPayload;
  viewerRole: 'creator' | 'member' | 'guest' | null;
}

const TRIP_DETAIL_DEDUPE_TTL_MS = 2000;
const recentTripDetailFetches = new Map<string, { ts: number; promise: Promise<TripDetailFetchResult> }>();

function fetchTripDetailRequest(tripId: string, skipView: boolean): Promise<TripDetailFetchResult> {
  const url = skipView
    ? `/api/trips/${encodeURIComponent(tripId)}?skipView=1`
    : `/api/trips/${encodeURIComponent(tripId)}`;
  return fetch(url, {
    headers: getApiHeaders(),
  }).then(async (res) => {
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success || !data.data) {
      throw new Error(data?.message || 'Chưa tải được sổ đoàn, bạn thử mở lại nhé.');
    }
    const viewerRole =
      data.viewerRole === 'creator' || data.viewerRole === 'member' || data.viewerRole === 'guest'
        ? (data.viewerRole as 'creator' | 'member' | 'guest')
        : null;
    return { doc: data.data as TripDetailPayload, viewerRole };
  });
}

function fetchTripDetailDeduped(tripId: string, skipView: boolean): Promise<TripDetailFetchResult> {
  if (skipView) {
    return fetchTripDetailRequest(tripId, true);
  }
  const now = Date.now();
  const cached = recentTripDetailFetches.get(tripId);
  if (cached && now - cached.ts < TRIP_DETAIL_DEDUPE_TTL_MS) {
    return cached.promise;
  }
  for (const [k, entry] of recentTripDetailFetches.entries()) {
    if (now - entry.ts >= TRIP_DETAIL_DEDUPE_TTL_MS) {
      recentTripDetailFetches.delete(k);
    }
  }
  const promise = fetchTripDetailRequest(tripId, false).catch((err) => {
    recentTripDetailFetches.delete(tripId);
    throw err;
  });
  recentTripDetailFetches.set(tripId, { ts: now, promise });
  return promise;
}

function extractUserIdFromToken(): string {
  try {
    const token = localStorage.getItem('lost_token');
    if (!token) return '';
    const parts = token.trim().split('.');
    if (parts.length < 2) return '';
    const rawSegment = parts.length === 2 ? parts[0] : parts[1];
    if (!rawSegment) return '';
    const base64 = rawSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = JSON.parse(window.atob(padded)) as {
      userId?: string;
      id?: string;
      _id?: string;
      sub?: string;
    };
    return String(decoded.userId || decoded.id || decoded._id || decoded.sub || '');
  } catch {
    return '';
  }
}

function extractRawMemberId(rosterId: string): string {
  if (!rosterId) return '';
  return rosterId.startsWith('uid:') ? rosterId.slice(4) : '';
}

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
    title: 'Giấy phép VQG / Biên phòng & khai báo đoàn',
    detail: 'Hoàn tất giấy phép vào rừng (BQL VQG, Kiểm lâm hoặc Đồn Biên phòng) và gom đủ thông tin CCCD cả đoàn.',
  },
  {
    id: 'beacon',
    title: 'Bật hẹn giờ báo bình an & dặn người thân ở nhà',
    detail: 'Bật Live Beacon hoặc hẹn giờ báo bình an, gửi trước lịch trình và giờ dự kiến xuống núi cho người nhà.',
  },
  {
    id: 'gonogo',
    title: 'Xem lại thời tiết 24 giờ trước lúc xuất phát',
    detail: 'Kiểm tra mưa lớn, gió đỉnh, nguy cơ sạt lở đường mòn và chốt phương án đi hay hoãn trong vòng 24 giờ.',
  },
  {
    id: 'wfa_gear',
    title: 'Túi sơ cứu dã ngoại (WFA) & đèn pin dự phòng',
    detail: 'Kiểm tra đủ đồ sơ cứu WFA, còi báo hiệu, chăn giữ nhiệt và đèn pin đội đầu kèm pin dự phòng.',
  },
  {
    id: 'turnaround',
    title: 'Chốt mốc giờ quay đầu an toàn',
    detail: 'Thống nhất giờ quay đầu bắt buộc để cả đoàn về tới lán hoặc cửa rừng trước lúc trời tối ít nhất 30 phút.',
  },
  {
    id: 'hotline',
    title: 'Lưu sẵn số Kiểm lâm, cứu hộ 112 & bản đồ offline',
    detail: 'Lưu số trực ban Kiểm lâm/VQG địa phương, số cứu hộ khẩn cấp 112 và tải sẵn tệp GPX vào máy.',
  },
];

const SQUAD_SAFETY_GATE_IDS: SquadSafetyGateStepId[] = SQUAD_SAFETY_GATE_STEPS.map((s) => s.id);

function getFairLoadThresholdPct(squadSize: number): number {
  if (squadSize <= 1) return 100;
  return Math.max(45, Math.ceil(100 / squadSize) + 15);
}

interface SquadRosterMember {
  id: string;
  rawId?: string;
  name: string;
  avatarUrl?: string;
  reputationScore?: number;
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
  { key: 'tent-4p', name: 'Lều 4 người', weightG: 3200, category: 'Lán trại & Nấu ăn' },
  { key: 'stove-gas', name: 'Bếp & gas', weightG: 950, category: 'Lán trại & Nấu ăn' },
  { key: 'wfa-kit', name: 'Túi sơ cứu WFA', weightG: 650, category: 'Y tế & An toàn' },
  { key: 'uhf-radio', name: 'Bộ đàm UHF', weightG: 480, category: 'Y tế & An toàn' },
  { key: 'tarp', name: 'Bạt tăng', weightG: 720, category: 'Lán trại & Nấu ăn' },
  { key: 'rope', name: 'Dây thừng', weightG: 1100, category: 'Y tế & An toàn' },
];

const TRIP_STATUS_LABELS: Record<string, string> = {
  recruiting: 'Đang mở ghép đoàn',
  full: 'Đã đủ người',
  in_progress: 'Đang trên cung',
  completed: 'Đã hoàn thành',
  cancelled: 'Đã hủy chuyến',
};

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
    const vn = new Date(Date.now() + 7 * 60 * 60 * 1000);
    return `${vn.getUTCFullYear()}${String(vn.getUTCMonth() + 1).padStart(2, '0')}${String(vn.getUTCDate()).padStart(2, '0')}`;
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

function formatDateTimeViOptional(raw?: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

function toVietnamDateInputValue(raw?: string): string {
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : '';
  }
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (y && m && day) return `${y}-${m}-${day}`;
  } catch {
    // Fallback to UTC+7 offset
  }
  const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, '0')}-${String(vn.getUTCDate()).padStart(2, '0')}`;
}

function clampTripMaxMembers(raw: string | number, minMembers: number): number {
  const floorVal = Math.max(2, Math.min(MAX_TRIP_MEMBERS_CAP, minMembers));
  const str = String(raw).trim();
  if (!str) return floorVal;
  const parsed = Math.round(Number(str));
  if (!Number.isFinite(parsed)) return floorVal;
  return Math.max(floorVal, Math.min(MAX_TRIP_MEMBERS_CAP, parsed));
}

function buildGearAssigneePayload(member: SquadRosterMember | null): Record<string, unknown> {
  if (!member) {
    return { assignedUserId: null, assignedUserName: 'Chưa nhận' };
  }
  const rawId = extractRawMemberId(member.id);
  if (rawId) {
    return { assignedUserId: rawId, assignedUserName: member.name };
  }
  // Estimated roster slot (slot:N): omit assignedUserId so server preserves assignedUserName
  return { assignedUserName: member.name };
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
  safetyGateChecks: Record<SquadSafetyGateStepId, boolean>;
  safetyGateCompletedCount: number;
}): string {
  const {
    tripTitle,
    tripDetail,
    roster,
    memberLoads,
    matrixItems,
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
    row(['Kiểm tra an toàn trước khi vào rừng', gateStatusLabel]),
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
      row(['TRANG BỊ CHUNG CHƯA PHÂN CÔNG']),
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

  lines.push(
    '',
    row(['KIỂM TRA AN TOÀN TRƯỚC KHI VÀO RỪNG (6 BƯỚC)']),
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

  const addMember = (
    rawId?: string | null,
    rawName?: string | null,
    avatarUrl?: string,
    reputationScore?: number
  ) => {
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
    members.push({ id, rawId: cleanId || undefined, name: displayName, avatarUrl, reputationScore });
  };

  if (tripDetail?.creatorId && typeof tripDetail.creatorId === 'object') {
    addMember(tripDetail.creatorId._id, tripDetail.creatorId.fullName, tripDetail.creatorId.avatarUrl);
  }
  if (Array.isArray(tripDetail?.currentMembers)) {
    for (const member of tripDetail.currentMembers) {
      if (member && typeof member === 'object') {
        addMember(member._id, member.fullName, member.avatarUrl, member.reputationScore);
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
  fairLoadThresholdPct: number
): string {
  const totalG = items.reduce((sum, item) => sum + item.weightG, 0);
  const packedCount = items.filter((item) => item.packed).length;

  const lines: string[] = [
    '[PHÂN CÔNG ĐỒ CHUNG CẢ ĐOÀN - LOST]',
    `Chuyến đi: ${tripTitle}`,
    `Tổng tải đồ chung: ${formatWeightKg(totalG)} kg (${totalG.toLocaleString('vi-VN')} g) | Đã chuẩn bị: ${packedCount}/${items.length} món`,
  ];

  const assignedMembers = memberLoads.filter((m) => m.itemCount > 0);
  if (assignedMembers.length > 0) {
    lines.push('', '--- AI MANG GÌ ---');
    assignedMembers.forEach((member) => {
      const loadTag = member.isOverloaded ? ` [NẶNG TẢI >${fairLoadThresholdPct}%]` : '';
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
    lines.push('', `--- CHƯA CÓ NGƯỜI NHẬN (${formatWeightKg(unassignedG)} kg) ---`);
    unassignedItems.forEach((it) => {
      lines.push(`  - ${it.name} (${it.weightG.toLocaleString('vi-VN')} g • ${it.category})`);
    });
  }

  const overloaded = memberLoads.filter((m) => m.isOverloaded);
  if (overloaded.length > 0) {
    lines.push(
      '',
      `Lưu ý chia đều đồ: ${overloaded.map((m) => `${m.name} (${m.pct.toFixed(0)}%)`).join(', ')} đang mang hơn ${fairLoadThresholdPct}% tổng đồ chung.`
    );
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
 * Pure Greedy Minimum-Transfer Debt Settlement Matrix (Exact Integer VND):
 * - Separates active cost-sharing squad members from departed payers (`uid:<id>`) so a departed payer sharing
 *   a display name with an active member NEVER credits the active member and NEVER inflates active headcount.
 * - Uses largest-remainder integer VND allocation so every balance is an exact integer summing to 0,
 *   guaranteeing greedy transfers sum identically to each member's `balanceVnd` with 0 VND rounding drift.
 * - Honors `exp.splitCount` when full roster membership is unavailable.
 */
function computeGreedyDebtSettlement(
  expenses: ExpenseItem[],
  tripDetail: TripDetailPayload | null,
  memberCount: number
): GreedyDebtSettlement {
  const displayNameByKey = new Map<string, string>();
  const paidByKey = new Map<string, number>();
  const estimatedKeys = new Set<string>();
  const activeKeySet = new Set<string>();
  const departedKeySet = new Set<string>();
  const keyByUserId = new Map<string, string>();
  const keysByBaseName = new Map<string, string[]>();

  const registerRosterMember = (rawId?: string | null, rawName?: string | null) => {
    const cleanName = (rawName || '').trim();
    const cleanId = (rawId || '').trim();
    if (!cleanName) return;
    if (cleanId && keyByUserId.has(cleanId)) return;

    const baseKey = cleanName.toLowerCase();
    const existingKeys = keysByBaseName.get(baseKey) || [];

    if (!cleanId && existingKeys.length > 0) return;

    const participantKey = cleanId ? `uid:${cleanId}` : `name:${baseKey}:${existingKeys.length + 1}`;
    const displayName = existingKeys.length === 0 ? cleanName : `${cleanName} (#${existingKeys.length + 1})`;

    displayNameByKey.set(participantKey, displayName);
    paidByKey.set(participantKey, 0);
    activeKeySet.add(participantKey);
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
  let maxSavedSplitCount = 0;
  for (const exp of expenses) {
    const amount = Math.max(0, Math.round(Number(exp.amountVnd) || 0));
    totalVnd += amount;
    const rawSplit = Math.round(Number(exp.splitCount));
    if (Number.isFinite(rawSplit) && rawSplit >= 1 && rawSplit <= MAX_TRIP_MEMBERS_CAP) {
      maxSavedSplitCount = Math.max(maxSavedSplitCount, rawSplit);
    }
    const payerName = (exp.paidByName || '').trim() || 'Thành viên';
    const payerUid = (exp.paidByUserId || '').trim();
    const baseKey = payerName.toLowerCase();

    let targetKey: string | undefined;
    if (payerUid) {
      if (keyByUserId.has(payerUid)) {
        targetKey = keyByUserId.get(payerUid);
      } else {
        // Departed payer with distinct userId: NEVER merge by display name into an active member
        targetKey = `uid:${payerUid}`;
        const departedLabel = `${payerName} (đã rời đoàn)`;
        displayNameByKey.set(targetKey, departedLabel);
        paidByKey.set(targetKey, 0);
        keyByUserId.set(payerUid, targetKey);
        departedKeySet.add(targetKey);
      }
    } else {
      const candidates = keysByBaseName.get(baseKey);
      if (candidates && candidates.length > 0) {
        targetKey = candidates[0];
      } else {
        targetKey = `payer:${baseKey}`;
        displayNameByKey.set(targetKey, payerName);
        paidByKey.set(targetKey, 0);
        activeKeySet.add(targetKey);
        keysByBaseName.set(baseKey, [targetKey]);
      }
    }

    if (targetKey) {
      paidByKey.set(targetKey, (paidByKey.get(targetKey) || 0) + amount);
    }
  }

  const hasPopulatedActiveRoster =
    Array.isArray(tripDetail?.currentMembers) && tripDetail.currentMembers.length > 0;
  const fallbackSplitTarget =
    !hasPopulatedActiveRoster && maxSavedSplitCount > 1 ? maxSavedSplitCount : 1;
  const activeTargetCount = Math.max(
    1,
    Math.round(Number(memberCount) || 1),
    activeKeySet.size,
    fallbackSplitTarget
  );

  let slotIndex = activeKeySet.size + 1;
  while (activeKeySet.size < activeTargetCount) {
    const placeholder = `Thành viên #${slotIndex}`;
    const baseKey = placeholder.toLowerCase();
    const key = `slot:${slotIndex}`;
    slotIndex += 1;
    if (!keysByBaseName.has(baseKey)) {
      displayNameByKey.set(key, placeholder);
      paidByKey.set(key, 0);
      activeKeySet.add(key);
      keysByBaseName.set(baseKey, [key]);
      estimatedKeys.add(key);
    }
  }

  const shareParticipants =
    activeKeySet.size > 0 ? Array.from(activeKeySet) : Array.from(displayNameByKey.keys());
  const participantCount = Math.max(1, shareParticipants.length);
  const perPersonAverageVnd = Math.round(totalVnd / participantCount);

  // Largest-remainder exact integer VND allocation across active cost-sharing participants
  const baseShareVnd = Math.floor(totalVnd / participantCount);
  const remainderVnd = totalVnd - baseShareVnd * participantCount;
  const sortedShareKeys = [...shareParticipants].sort((a, b) => {
    const paidDiff = (paidByKey.get(a) || 0) - (paidByKey.get(b) || 0);
    if (paidDiff !== 0) return paidDiff;
    return a.localeCompare(b);
  });
  const owedByKey = new Map<string, number>();
  sortedShareKeys.forEach((key, idx) => {
    owedByKey.set(key, baseShareVnd + (idx < remainderVnd ? 1 : 0));
  });

  const balances: MemberSettlementBalance[] = Array.from(displayNameByKey.entries()).map(
    ([key, name]) => {
      const paidVnd = paidByKey.get(key) || 0;
      const isDeparted = departedKeySet.has(key);
      const owedVnd = isDeparted ? 0 : owedByKey.get(key) || 0;
      return {
        id: key,
        name,
        paidVnd,
        balanceVnd: paidVnd - owedVnd,
        isEstimatedSlot: estimatedKeys.has(key),
        isDeparted,
      };
    }
  );

  balances.sort((a, b) => {
    if (b.balanceVnd !== a.balanceVnd) return b.balanceVnd - a.balanceVnd;
    if (b.paidVnd !== a.paidVnd) return b.paidVnd - a.paidVnd;
    return a.name.localeCompare(b.name, 'vi');
  });

  if (totalVnd <= 0 || balances.length <= 1) {
    return {
      totalVnd,
      participantCount,
      perPersonAverageVnd,
      balances,
      transfers: [],
      isSettled: true,
    };
  }

  const debtors = balances
    .filter((m) => m.balanceVnd <= -SETTLEMENT_DUST_VND)
    .map((m) => ({ id: m.id, name: m.name, remaining: -m.balanceVnd }));
  const creditors = balances
    .filter((m) => m.balanceVnd >= SETTLEMENT_DUST_VND)
    .map((m) => ({ id: m.id, name: m.name, remaining: m.balanceVnd }));

  const transfers: DebtTransfer[] = [];

  // Pass 1: Exact integer pair matching (reduces transfer count on partitioned subgroups)
  for (const debtor of debtors) {
    if (debtor.remaining < SETTLEMENT_DUST_VND) continue;
    const exactCreditor = creditors.find(
      (c) => c.remaining >= SETTLEMENT_DUST_VND && c.remaining === debtor.remaining
    );
    if (exactCreditor) {
      const amount = debtor.remaining;
      transfers.push({
        fromId: debtor.id,
        from: debtor.name,
        toId: exactCreditor.id,
        to: exactCreditor.name,
        amountVnd: amount,
        key: `${debtor.id}->${exactCreditor.id}:${amount}`,
      });
      debtor.remaining = 0;
      exactCreditor.remaining = 0;
    }
  }

  // Pass 2: Greedy exact-integer largest-debtor to largest-creditor matching
  const maxSteps = (balances.length + 2) * 4;
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

    if (settleAmount >= SETTLEMENT_DUST_VND) {
      transfers.push({
        fromId: topDebtor.id,
        from: topDebtor.name,
        toId: topCreditor.id,
        to: topCreditor.name,
        amountVnd: settleAmount,
        key: `${topDebtor.id}->${topCreditor.id}:${settleAmount}`,
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
  settlement: GreedyDebtSettlement,
  settledTransfers: string[]
): string {
  const settledSet = new Set(settledTransfers);
  const lines: string[] = [
    '[CHIA TIỀN CHUYẾN ĐI - LOST]',
    `Chuyến đi: ${tripTitle}`,
    `Tổng chi phí: ${settlement.totalVnd.toLocaleString('vi-VN')} đ (${settlement.participantCount} thành viên)`,
    `Chia đều mỗi người: ${settlement.perPersonAverageVnd.toLocaleString('vi-VN')} đ`,
  ];

  if (expenses.length > 0) {
    lines.push('', '--- CÁC KHOẢN ĐÃ CHI ---');
    expenses.forEach((exp, idx) => {
      lines.push(
        `${idx + 1}. ${exp.title}: ${Math.round(Number(exp.amountVnd) || 0).toLocaleString('vi-VN')} đ (Đã ứng: ${exp.paidByName || 'Thành viên'})`
      );
    });
  }

  if (settlement.balances.length > 0) {
    lines.push('', '--- TỔNG KẾT TỪNG NGƯỜI ---');
    settlement.balances.forEach((m) => {
      const statusText =
        m.balanceVnd >= SETTLEMENT_DUST_VND
          ? `Nhận lại +${m.balanceVnd.toLocaleString('vi-VN')} đ`
          : m.balanceVnd <= -SETTLEMENT_DUST_VND
            ? `Chuyển thêm ${Math.abs(m.balanceVnd).toLocaleString('vi-VN')} đ`
            : 'Vừa đủ';
      lines.push(`- ${m.name}: Đã ứng ${m.paidVnd.toLocaleString('vi-VN')} đ | ${statusText}`);
    });
  }

  lines.push(
    '',
    settlement.isSettled
      ? '--- AI CHUYỂN AI ---'
      : `--- AI CHUYỂN AI (GỌN ${settlement.transfers.length} LƯỢT CHUYỂN) ---`
  );
  if (settlement.isSettled) {
    lines.push('Cả đoàn đã chia đều xong xuôi — không ai cần chuyển thêm.');
  } else {
    settlement.transfers.forEach((t, idx) => {
      const tag = settledSet.has(t.key) ? ' [ĐÃ CHUYỂN]' : '';
      lines.push(`${idx + 1}. ${t.from} → ${t.to}: ${t.amountVnd.toLocaleString('vi-VN')} đ${tag}`);
    });
  }

  return lines.join('\n');
}

export const SquadWorkspaceModal: React.FC<SquadWorkspaceModalProps> = ({
  tripId,
  tripTitle,
  memberCount,
  currentUserId,
  currentUser,
  isCreator: isCreatorProp = false,
  isMember: isMemberProp = true,
  isOpen,
  onClose,
  onOpenGroupChat,
  onTripUpdated,
  onOpenAuthorProfile,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'gear' | 'expenses' | 'requests'>('gear');
  const [tripDetail, setTripDetail] = useState<TripDetailPayload | null>(null);
  const [serverViewerRole, setServerViewerRole] = useState<{ tripId: string; role: 'creator' | 'member' | 'guest' } | null>(null);
  const [loadedRequestKey, setLoadedRequestKey] = useState<string>('');
  const [loadErrorState, setLoadErrorState] = useState<{ key: string; message: string } | null>(null);
  const [reloadTick, setReloadTick] = useState<number>(0);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const [copiedSettlement, setCopiedSettlement] = useState(false);
  const [copiedGear, setCopiedGear] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  const copiedGearTimerRef = useRef<number | null>(null);
  const csvRevokeEntriesRef = useRef<Array<{ timerId: number; url: string }>>([]);
  const onShowToastRef = useRef(onShowToast);

  const [isSafetyGateOpen, setIsSafetyGateOpen] = useState(false);
  const [savingSafetyStep, setSavingSafetyStep] = useState<string | null>(null);
  const [pendingInProgressConfirm, setPendingInProgressConfirm] = useState(false);
  const [newGearWeightG, setNewGearWeightG] = useState('500');
  const [newGearCarrierId, setNewGearCarrierId] = useState('');
  const [isAddingGear, setIsAddingGear] = useState(false);

  // Inline Gear Edit state
  const [editingGearId, setEditingGearId] = useState<string | null>(null);
  const [editGearName, setEditGearName] = useState('');
  const [editGearWeightG, setEditGearWeightG] = useState('500');
  const [editGearCategory, setEditGearCategory] = useState('Lán trại & Nấu ăn');
  const [editGearCarrierId, setEditGearCarrierId] = useState('');
  const [editGearPacked, setEditGearPacked] = useState(false);
  const [isSavingGearEdit, setIsSavingGearEdit] = useState(false);

  // Creator management state (Edit Trip, Update Status, Delete Trip, Kick Member)
  const [isEditingTrip, setIsEditingTrip] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editMaxMembers, setEditMaxMembers] = useState('6');
  const [editDifficulty, setEditDifficulty] = useState('3');
  const [editEstimatedCost, setEditEstimatedCost] = useState('');
  const [editMeetingPoint, setEditMeetingPoint] = useState('');
  const [editRequirements, setEditRequirements] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [confirmDeleteTrip, setConfirmDeleteTrip] = useState(false);
  const [isDeletingTrip, setIsDeletingTrip] = useState(false);
  const [confirmKickMemberId, setConfirmKickMemberId] = useState<string | null>(null);
  const [kickingMemberId, setKickingMemberId] = useState<string | null>(null);
  const [inspectedAuthor, setInspectedAuthor] = useState<{
    name: string;
    avatar: string;
    userId?: string;
  } | null>(null);
  const [failedAvatarKeys, setFailedAvatarKeys] = useState<string[]>([]);

  useEffect(() => {
    onShowToastRef.current = onShowToast;
  }, [onShowToast]);

  // Submit & mutation loading guards
  const [togglingGearId, setTogglingGearId] = useState<string | null>(null);
  const [deletingGearId, setDeletingGearId] = useState<string | null>(null);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editExpTitle, setEditExpTitle] = useState('');
  const [editExpAmount, setEditExpAmount] = useState('');
  const [editExpPayerId, setEditExpPayerId] = useState('');
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [togglingSettlementKey, setTogglingSettlementKey] = useState<string | null>(null);
  const [processingApplicantId, setProcessingApplicantId] = useState<string | null>(null);

  // Non-member join / withdraw fallback state (when clicked from calendar)
  const [joinNote, setJoinNote] = useState('');
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);
  const [isWithdrawingJoin, setIsWithdrawingJoin] = useState(false);
  const [joinRequestOverride, setJoinRequestOverride] = useState<{
    tripId: string;
    pending: boolean;
  } | null>(null);

  // Add Gear state
  const [newGearName, setNewGearName] = useState('');
  const [newGearCategory, setNewGearCategory] = useState('Lán trại & Nấu ăn');
  const [trackedDraftTripId, setTrackedDraftTripId] = useState(tripId);

  // Reset local draft inputs & collapse panels when switching to another trip
  if (trackedDraftTripId !== tripId) {
    setTrackedDraftTripId(tripId);
    setNewGearName('');
    setNewGearWeightG('500');
    setNewGearCarrierId('');
    setNewGearCategory('Lán trại & Nấu ăn');
    setIsSafetyGateOpen(false);
    setPendingInProgressConfirm(false);
    setIsEditingTrip(false);
    setConfirmDeleteTrip(false);
    setConfirmKickMemberId(null);
    setEditingGearId(null);
    setEditingExpenseId(null);
    setJoinRequestOverride(null);
    setFailedAvatarKeys([]);
  }

  // Add Expense state
  const [newExpTitle, setNewExpTitle] = useState('');
  const [newExpAmount, setNewExpAmount] = useState('');
  const [newExpPayerId, setNewExpPayerId] = useState('');

  const effectiveUserId = useMemo(
    () => (currentUserId && currentUserId.trim() ? currentUserId.trim() : extractUserIdFromToken()),
    [currentUserId]
  );

  const currentRequestKey = isOpen ? `${tripId}:${reloadTick}` : '';
  const isLoading = isOpen && loadedRequestKey !== currentRequestKey;
  const loadError = loadErrorState?.key === currentRequestKey ? loadErrorState.message : null;
  const activeTripDetail = tripDetail && tripDetail._id === tripId ? tripDetail : null;
  const activeViewerRole = serverViewerRole && serverViewerRole.tripId === tripId ? serverViewerRole.role : null;
  const joinRequested =
    joinRequestOverride && joinRequestOverride.tripId === tripId
      ? joinRequestOverride.pending
      : Boolean(activeTripDetail?.hasPendingRequest);
  const displayTripTitle = activeTripDetail?.title || tripTitle;

  const sharedGear = useMemo(
    () => (Array.isArray(activeTripDetail?.sharedGear) ? activeTripDetail.sharedGear : []),
    [activeTripDetail]
  );
  const expenses = useMemo(
    () => (Array.isArray(activeTripDetail?.expenses) ? activeTripDetail.expenses : []),
    [activeTripDetail]
  );
  const rawSettledTransfers = useMemo(
    () => (Array.isArray(activeTripDetail?.settledTransfers) ? activeTripDetail.settledTransfers : []),
    [activeTripDetail]
  );
  const pendingRequests = useMemo(
    () => (Array.isArray(activeTripDetail?.pendingRequests) ? activeTripDetail.pendingRequests : []),
    [activeTripDetail]
  );

  const isAnyGearMutating =
    isAddingGear || isSavingGearEdit || Boolean(togglingGearId) || Boolean(deletingGearId);

  const isBusyMutation =
    isOpeningChat ||
    isAnyGearMutating ||
    isAddingExpense ||
    isSavingExpense ||
    isSavingTrip ||
    isUpdatingStatus ||
    isDeletingTrip ||
    isSubmittingJoin ||
    isWithdrawingJoin ||
    Boolean(savingSafetyStep) ||
    Boolean(togglingSettlementKey) ||
    Boolean(kickingMemberId) ||
    Boolean(processingApplicantId) ||
    Boolean(deletingExpenseId);

  const openMemberProfile = useCallback(
    (author: { name: string; avatar: string; userId?: string }) => {
      if (onOpenAuthorProfile) {
        onOpenAuthorProfile(author);
      } else {
        setInspectedAuthor(author);
      }
    },
    [onOpenAuthorProfile]
  );

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
    let cancelled = false;
    const requestKey = `${tripId}:${reloadTick}`;
    const skipView = reloadTick > 0;

    fetchTripDetailDeduped(tripId, skipView)
      .then(({ doc, viewerRole }) => {
        if (cancelled) return;
        setTripDetail(doc);
        setLoadErrorState(null);
        if (viewerRole) {
          setServerViewerRole({ tripId, role: viewerRole });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = extractErrorMessage(err, 'Chưa tải được sổ đoàn, bạn thử mở lại nhé.');
          setLoadErrorState({ key: requestKey, message: msg });
          onShowToastRef.current?.(msg, 'error');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadedRequestKey(requestKey);
        }
      });

    return () => {
      cancelled = true;
    };
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

  // Filter settledTransfers strictly against active computed transfers so stale keys never produce false badges
  const settledTransfers = useMemo(() => {
    const activeKeys = new Set(settlement.transfers.map((t) => t.key));
    return rawSettledTransfers.filter((key) => activeKeys.has(key));
  }, [rawSettledTransfers, settlement.transfers]);

  const squadRoster = useMemo(
    () => buildSquadRoster(activeTripDetail, liveMemberCount),
    [activeTripDetail, liveMemberCount]
  );

  const confirmedRosterMembers = useMemo(
    () => squadRoster.filter((m) => !m.isEstimatedSlot && Boolean(m.rawId)),
    [squadRoster]
  );

  const squadGearItems: SquadGearMatrixItem[] = useMemo(() => {
    return sharedGear.map((item) => {
      const assignedUid = item.assignedUserId ? `uid:${String(item.assignedUserId)}` : '';
      const rawAssigneeName = (item.assignedUserName || '').trim();
      const cleanAssigneeName = rawAssigneeName && rawAssigneeName !== 'Chưa nhận' ? rawAssigneeName : '';
      let resolvedCarrierId = assignedUid;
      if (!resolvedCarrierId && cleanAssigneeName) {
        const matched = squadRoster.find((m) => m.name.toLowerCase() === cleanAssigneeName.toLowerCase());
        if (matched) resolvedCarrierId = matched.id;
      }
      const parsedWeight = Math.round(Number(item.weightG));
      return {
        id: item.id,
        name: item.itemName,
        category: item.category || 'Dùng chung',
        weightG: Number.isFinite(parsedWeight) && parsedWeight >= 0 ? parsedWeight : 500,
        carrierId: resolvedCarrierId,
        carrierName: cleanAssigneeName,
        packed: Boolean(item.packed),
      };
    });
  }, [sharedGear, squadRoster]);

  const gearLoadSummary = useMemo(() => {
    const rosterById = new Map(squadRoster.map((m) => [m.id, m]));
    const normalizedItems = squadGearItems.map((it) => {
      if (it.carrierId && rosterById.has(it.carrierId)) {
        return { ...it, carrierName: rosterById.get(it.carrierId)!.name };
      }
      if (it.carrierId) {
        const byName = squadRoster.find(
          (m) => it.carrierName && m.name.toLowerCase() === it.carrierName.toLowerCase()
        );
        if (byName) return { ...it, carrierId: byName.id, carrierName: byName.name };
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

  const totalSquadGearCount = gearLoadSummary.items.length;
  const totalSquadGearPackedCount = gearLoadSummary.packedCount;
  const effectiveNewGearCarrierId = squadRoster.some((m) => m.id === newGearCarrierId)
    ? newGearCarrierId
    : '';

  const effectiveIsCreator = activeViewerRole ? activeViewerRole === 'creator' : isCreatorProp;
  const effectiveIsMember = activeViewerRole ? activeViewerRole === 'creator' || activeViewerRole === 'member' : isMemberProp;

  const safetyGateDetails = useMemo(() => {
    const saved = activeTripDetail?.safetyGate || {};
    const auditMap = activeTripDetail?.safetyGateAudit || activeTripDetail?.safetyGateMeta || {};
    const record = {} as Record<
      SquadSafetyGateStepId,
      { checked: boolean; checkedByName: string; checkedAt: string }
    >;
    for (const stepId of SQUAD_SAFETY_GATE_IDS) {
      const rawVal = saved[stepId];
      const metaVal = auditMap[stepId];
      const objMeta =
        rawVal && typeof rawVal === 'object' ? (rawVal as SafetyGateStepMeta) : metaVal || null;
      const checked =
        typeof rawVal === 'boolean' ? rawVal : Boolean(rawVal && typeof rawVal === 'object' ? rawVal.checked : false);
      const checkedByObj =
        objMeta?.checkedBy && typeof objMeta.checkedBy === 'object' ? objMeta.checkedBy : null;
      const checkedByName =
        (objMeta?.checkedByName || checkedByObj?.fullName || checkedByObj?.username || '').trim();
      const checkedAt = objMeta?.checkedAt ? formatDateTimeViOptional(objMeta.checkedAt) : '';
      record[stepId] = { checked, checkedByName, checkedAt };
    }
    return record;
  }, [activeTripDetail]);

  const safetyGateChecks = useMemo(() => {
    const record = {} as Record<SquadSafetyGateStepId, boolean>;
    for (const stepId of SQUAD_SAFETY_GATE_IDS) {
      record[stepId] = safetyGateDetails[stepId].checked;
    }
    return record;
  }, [safetyGateDetails]);

  const safetyGateCompletedCount = useMemo(
    () => SQUAD_SAFETY_GATE_IDS.filter((stepId) => safetyGateChecks[stepId]).length,
    [safetyGateChecks]
  );
  const isSafetyGateReady = safetyGateCompletedCount === SQUAD_SAFETY_GATE_STEPS.length;

  const handleToggleSafetyGateStep = useCallback(
    async (stepId: SquadSafetyGateStepId) => {
      if (!effectiveIsCreator || !tripId || savingSafetyStep) return;
      const nextChecked = !safetyGateChecks[stepId];
      setSavingSafetyStep(stepId);
      try {
        const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/safety-gate`, {
          method: 'PATCH',
          headers: getApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ stepKey: stepId, checked: nextChecked }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success && data.data) {
          setTripDetail((prev) =>
            prev && prev._id === tripId
              ? {
                  ...prev,
                  safetyGate: data.data,
                  ...(data.audit ? { safetyGateAudit: data.audit } : {}),
                  ...(data.meta ? { safetyGateMeta: data.meta } : {}),
                }
              : prev
          );
        } else {
          onShowToastRef.current?.(data.message || 'Chưa lưu được mục kiểm tra an toàn, bạn thử lại nhé.', 'error');
        }
      } catch {
        onShowToastRef.current?.('Mất kết nối nên chưa lưu được mục an toàn.', 'error');
      } finally {
        setSavingSafetyStep(null);
      }
    },
    [effectiveIsCreator, tripId, safetyGateChecks, savingSafetyStep]
  );

  const handleResetSafetyGate = useCallback(async () => {
    if (!effectiveIsCreator || !tripId || savingSafetyStep) return;
    setSavingSafetyStep('reset');
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/safety-gate`, {
        method: 'PATCH',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reset: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.data) {
        setTripDetail((prev) =>
          prev && prev._id === tripId
            ? {
                ...prev,
                safetyGate: data.data,
                safetyGateAudit: data.audit || {},
                safetyGateMeta: data.meta || {},
              }
            : prev
        );
        onShowToastRef.current?.('Đã bỏ chọn cả 6 bước an toàn để rà soát lại từ đầu.', 'info');
      } else {
        onShowToastRef.current?.(data.message || 'Chưa đặt lại được danh sách an toàn.', 'error');
      }
    } catch {
      onShowToastRef.current?.('Mất kết nối nên chưa đặt lại được danh sách an toàn.', 'error');
    } finally {
      setSavingSafetyStep(null);
    }
  }, [effectiveIsCreator, tripId, savingSafetyStep]);

  const pickLightestCarrier = useCallback((): { id: string; name: string } => {
    if (gearLoadSummary.memberLoads.length === 0) return { id: '', name: '' };
    const sorted = [...gearLoadSummary.memberLoads].sort((a, b) => a.totalG - b.totalG);
    return { id: sorted[0].id, name: sorted[0].name };
  }, [gearLoadSummary.memberLoads]);

  const handleAddPresetGearItem = async (preset: SharedGearPreset) => {
    if (isAnyGearMutating) return;
    const carrier = pickLightestCarrier();
    const rawCarrierUid = extractRawMemberId(carrier.id);
    setIsAddingGear(true);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/gear`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          itemName: preset.name,
          category: preset.category,
          weightG: preset.weightG,
          ...(rawCarrierUid ? { assignedUserId: rawCarrierUid } : {}),
          ...(carrier.name ? { assignedUserName: carrier.name } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const nextGear = Array.isArray(data.data) ? data.data : [];
        setTripDetail((prev) => (prev && prev._id === tripId ? { ...prev, sharedGear: nextGear } : prev));
        onShowToastRef.current?.(
          carrier.name
            ? `Đã thêm "${preset.name}" (${preset.weightG.toLocaleString('vi-VN')} g) — nhờ ${carrier.name} mang giúp.`
            : `Đã thêm "${preset.name}" (${preset.weightG.toLocaleString('vi-VN')} g) vào danh sách đồ chung.`,
          'success'
        );
      } else {
        onShowToastRef.current?.(data.message || 'Chưa thêm được món đồ chung này.', 'error');
      }
    } catch {
      onShowToastRef.current?.('Mất kết nối nên chưa thêm được đồ chung.', 'error');
    } finally {
      setIsAddingGear(false);
    }
  };

  const handleAddMatrixGearItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnyGearMutating) return;
    const cleanName = newGearName.trim();
    const weightNum = Math.round(Number(newGearWeightG));
    if (!cleanName) {
      onShowToastRef.current?.('Bạn nhập tên món đồ chung trước nhé.', 'error');
      return;
    }
    if (!Number.isFinite(weightNum) || weightNum < 10 || weightNum > 50000) {
      onShowToastRef.current?.('Trọng lượng cần nằm trong khoảng 10g đến 50.000g nhé.', 'error');
      return;
    }

    const chosenMember = effectiveNewGearCarrierId
      ? squadRoster.find((m) => m.id === effectiveNewGearCarrierId) || null
      : null;
    const rawChosenUid = chosenMember ? extractRawMemberId(chosenMember.id) : '';

    setIsAddingGear(true);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/gear`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          itemName: cleanName,
          category: newGearCategory,
          weightG: weightNum,
          ...(rawChosenUid ? { assignedUserId: rawChosenUid } : {}),
          ...(chosenMember ? { assignedUserName: chosenMember.name } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const nextGear = Array.isArray(data.data) ? data.data : [];
        setTripDetail((prev) => (prev && prev._id === tripId ? { ...prev, sharedGear: nextGear } : prev));
        setNewGearName('');
        setNewGearWeightG('500');
        onShowToastRef.current?.(
          `Đã lưu "${cleanName}" (${weightNum.toLocaleString('vi-VN')} g) cho cả đoàn.`,
          'success'
        );
      } else {
        onShowToastRef.current?.(data.message || 'Chưa thêm được món đồ này.', 'error');
      }
    } catch {
      onShowToastRef.current?.('Mất kết nối nên chưa lưu được món đồ này.', 'error');
    } finally {
      setIsAddingGear(false);
    }
  };

  const handleAssignMatrixGearCarrier = async (itemId: string, nextCarrierId: string) => {
    if (isAnyGearMutating) return;
    const member = squadRoster.find((m) => m.id === nextCarrierId) || null;
    setTogglingGearId(itemId);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/gear/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(buildGearAssigneePayload(member)),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const nextGear = Array.isArray(data.data) ? data.data : [];
        setTripDetail((prev) => (prev && prev._id === tripId ? { ...prev, sharedGear: nextGear } : prev));
      } else {
        onShowToastRef.current?.(data.message || 'Chưa đổi được người mang món này.', 'error');
      }
    } catch {
      onShowToastRef.current?.('Mất kết nối nên chưa đổi được người mang.', 'error');
    } finally {
      setTogglingGearId(null);
    }
  };

  const handleToggleMatrixGearPacked = async (item: SquadGearMatrixItem) => {
    if (isAnyGearMutating) return;
    setTogglingGearId(item.id);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/gear/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ packed: !item.packed }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const nextGear = Array.isArray(data.data) ? data.data : [];
        setTripDetail((prev) => (prev && prev._id === tripId ? { ...prev, sharedGear: nextGear } : prev));
      } else {
        onShowToastRef.current?.(data.message || 'Chưa đánh dấu được món đồ này, bạn thử lại nhé.', 'error');
      }
    } catch {
      onShowToastRef.current?.('Chưa đánh dấu được món đồ này, bạn thử lại nhé.', 'error');
    } finally {
      setTogglingGearId(null);
    }
  };

  const handleStartEditGear = (item: SquadGearMatrixItem) => {
    if (isAnyGearMutating) return;
    setEditingGearId(item.id);
    setEditGearName(item.name);
    setEditGearWeightG(String(item.weightG));
    setEditGearCategory(item.category || 'Dùng chung');
    setEditGearCarrierId(item.carrierId || '');
    setEditGearPacked(Boolean(item.packed));
  };

  const handleSaveEditGear = async (e: React.FormEvent, gearId: string) => {
    e.preventDefault();
    if (isAnyGearMutating) return;
    const cleanName = editGearName.trim();
    const parsedWeight = Math.round(Number(editGearWeightG));
    if (!cleanName) {
      onShowToastRef.current?.('Tên món đồ chung không được để trống.', 'error');
      return;
    }
    if (!Number.isFinite(parsedWeight) || parsedWeight < 0 || parsedWeight > 100_000) {
      onShowToastRef.current?.('Trọng lượng cần nằm trong khoảng 0g đến 100.000g.', 'error');
      return;
    }
    const chosenMember = editGearCarrierId
      ? squadRoster.find((m) => m.id === editGearCarrierId) || null
      : null;

    setIsSavingGearEdit(true);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/gear/${encodeURIComponent(gearId)}`, {
        method: 'PATCH',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          itemName: cleanName.slice(0, 140),
          weightG: parsedWeight,
          category: editGearCategory,
          packed: editGearPacked,
          ...buildGearAssigneePayload(chosenMember),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const nextGear = Array.isArray(data.data) ? data.data : [];
        setTripDetail((prev) => (prev && prev._id === tripId ? { ...prev, sharedGear: nextGear } : prev));
        setEditingGearId(null);
        onShowToastRef.current?.('Đã cập nhật món đồ chung.', 'success');
      } else {
        onShowToastRef.current?.(data.message || 'Chưa lưu được thay đổi cho món đồ này.', 'error');
      }
    } catch {
      onShowToastRef.current?.('Mất kết nối nên chưa lưu được món đồ này.', 'error');
    } finally {
      setIsSavingGearEdit(false);
    }
  };

  const handleDeleteMatrixGearItem = async (gearId: string) => {
    if (!effectiveIsCreator || isAnyGearMutating) return;
    setDeletingGearId(gearId);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/gear/${encodeURIComponent(gearId)}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const nextGear = Array.isArray(data.data) ? data.data : [];
        setTripDetail((prev) => (prev && prev._id === tripId ? { ...prev, sharedGear: nextGear } : prev));
        if (editingGearId === gearId) setEditingGearId(null);
      } else {
        onShowToastRef.current?.(data.message || 'Chưa xóa được món đồ này.', 'error');
      }
    } catch {
      onShowToastRef.current?.('Chưa xóa được món đồ này.', 'error');
    } finally {
      setDeletingGearId(null);
    }
  };

  const handleCopyZaloGearAssignment = async () => {
    if (totalSquadGearCount === 0) {
      onShowToastRef.current?.('Chưa có món đồ chung nào để sao chép.', 'info');
      return;
    }
    const reportText = buildZaloGearAssignmentReport(
      displayTripTitle,
      gearLoadSummary.items,
      gearLoadSummary.memberLoads,
      gearLoadSummary.unassignedItems,
      gearLoadSummary.fairLoadThresholdPct
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
      onShowToastRef.current?.('Đã sao chép bảng chia đồ — dán vào nhóm chat là xong!', 'success');
    } else {
      onShowToastRef.current?.('Trình duyệt chưa cho sao chép tự động, bạn thử lại nhé.', 'error');
    }
  };

  const creatorUserId = useMemo(() => {
    if (!activeTripDetail?.creatorId) return '';
    return typeof activeTripDetail.creatorId === 'object'
      ? String(activeTripDetail.creatorId._id || '')
      : String(activeTripDetail.creatorId);
  }, [activeTripDetail]);

  const handleOpenEditTrip = () => {
    if (!activeTripDetail) return;
    setEditTitle(activeTripDetail.title || tripTitle);
    setEditStartDate(toVietnamDateInputValue(activeTripDetail.startDate));
    setEditEndDate(toVietnamDateInputValue(activeTripDetail.endDate));
    setEditMaxMembers(
      String(clampTripMaxMembers(activeTripDetail.maxMembers || Math.max(2, liveMemberCount), liveMemberCount))
    );
    setEditDifficulty(String(activeTripDetail.difficultyLevel || 3));
    setEditEstimatedCost(activeTripDetail.estimatedCost || '');
    setEditMeetingPoint(activeTripDetail.meetingPoint || '');
    setEditRequirements(activeTripDetail.requirements || '');
    setEditDescription(activeTripDetail.description || '');
    setConfirmDeleteTrip(false);
    setIsEditingTrip(true);
  };

  const handleSaveTripEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingTrip || !editTitle.trim()) return;
    if (editStartDate && editEndDate) {
      if (editEndDate < editStartDate) {
        onShowToast?.('Ngày kết thúc phải lớn hơn hoặc bằng ngày khởi hành.', 'error');
        return;
      }
      const durationDays = Math.round(
        (new Date(`${editEndDate}T00:00:00Z`).getTime() -
          new Date(`${editStartDate}T00:00:00Z`).getTime()) /
          (24 * 60 * 60 * 1000)
      );
      if (durationDays > 30) {
        onShowToast?.('Thời lượng chuyến đi tối đa 30 ngày.', 'error');
        return;
      }
    }

    const clampedMaxMembers = clampTripMaxMembers(editMaxMembers, liveMemberCount);
    setEditMaxMembers(String(clampedMaxMembers));

    setIsSavingTrip(true);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
        method: 'PUT',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title: editTitle.trim(),
          startDate: editStartDate || undefined,
          endDate: editEndDate || undefined,
          maxMembers: clampedMaxMembers,
          difficultyLevel: Number(editDifficulty) || 3,
          estimatedCost: editEstimatedCost.trim(),
          meetingPoint: editMeetingPoint.trim(),
          requirements: editRequirements.trim(),
          description: editDescription.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.data) {
        setTripDetail(data.data);
        setIsEditingTrip(false);
        onShowToast?.(data.message || 'Đã lưu lịch trình mới của đoàn!', 'success');
        onTripUpdated?.();
      } else {
        onShowToast?.(data.message || 'Chưa lưu được thay đổi của chuyến đi.', 'error');
      }
    } catch {
      onShowToast?.('Mất kết nối nên chưa lưu được thay đổi.', 'error');
    } finally {
      setIsSavingTrip(false);
    }
  };

  const executeUpdateTripStatus = async (nextStatus: string) => {
    if (isUpdatingStatus || !nextStatus) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/status`, {
        method: 'PATCH',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setPendingInProgressConfirm(false);
        setTripDetail((prev) => (prev && prev._id === tripId ? { ...prev, status: nextStatus } : prev));
        onShowToast?.(data.message || 'Đã đổi trạng thái chuyến đi!', 'success');
        onTripUpdated?.();
      } else {
        onShowToast?.(data.message || 'Chưa đổi được trạng thái chuyến đi.', 'error');
      }
    } catch {
      onShowToast?.('Mất kết nối nên chưa đổi được trạng thái.', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleRequestUpdateTripStatus = (nextStatus: string) => {
    if (isUpdatingStatus || !nextStatus) return;
    if (
      nextStatus === 'in_progress' &&
      activeTripDetail?.status !== 'in_progress' &&
      !isSafetyGateReady
    ) {
      setPendingInProgressConfirm(true);
      return;
    }
    setPendingInProgressConfirm(false);
    void executeUpdateTripStatus(nextStatus);
  };

  const handleDeleteTrip = async () => {
    if (isDeletingTrip) return;
    setIsDeletingTrip(true);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        onShowToast?.(data.message || 'Đã xóa chuyến đi này.', 'success');
        onTripUpdated?.();
        onClose();
      } else {
        onShowToast?.(data.message || 'Chưa xóa được chuyến đi này.', 'error');
      }
    } catch {
      onShowToast?.('Mất kết nối nên chưa xóa được chuyến đi.', 'error');
    } finally {
      setIsDeletingTrip(false);
      setConfirmDeleteTrip(false);
    }
  };

  const handleKickMember = async (memberRawId: string) => {
    if (kickingMemberId || !memberRawId) return;
    setKickingMemberId(memberRawId);
    try {
      const res = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/members/${encodeURIComponent(memberRawId)}`,
        {
          method: 'DELETE',
          headers: getApiHeaders(),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setConfirmKickMemberId(null);
        onShowToast?.(data.message || 'Đã xóa thành viên khỏi đoàn.', 'info');
        if (data.data && Array.isArray(data.data.currentMembers)) {
          // Apply returned member list & status directly without re-fetching GET /api/trips/:id (avoids viewsCount inflation)
          setTripDetail((prev) => {
            if (!prev || prev._id !== tripId) return prev;
            const nextMembers = data.data.currentMembers;
            const nextStatus = data.data.status || prev.status;
            const nextGear = Array.isArray(prev.sharedGear)
              ? prev.sharedGear.map((g) =>
                  g.assignedUserId && String(g.assignedUserId) === memberRawId
                    ? { ...g, assignedUserId: undefined, assignedUserName: 'Chưa nhận' }
                    : g
                )
              : prev.sharedGear;
            const nextDoc: TripDetailPayload = {
              ...prev,
              currentMembers: nextMembers,
              status: nextStatus,
              sharedGear: nextGear,
            };
            const recomputed = computeGreedyDebtSettlement(
              Array.isArray(nextDoc.expenses) ? nextDoc.expenses : [],
              nextDoc,
              Math.max(1, nextMembers.length)
            );
            const activeTransferKeys = new Set(recomputed.transfers.map((t) => t.key));
            return {
              ...nextDoc,
              settledTransfers: Array.isArray(prev.settledTransfers)
                ? prev.settledTransfers.filter((k) => activeTransferKeys.has(k))
                : [],
            };
          });
        } else {
          reloadWorkspace();
        }
        onTripUpdated?.();
      } else {
        onShowToast?.(data.message || 'Chưa xóa được thành viên này.', 'error');
      }
    } catch {
      onShowToast?.('Mất kết nối nên chưa cập nhật được danh sách đoàn.', 'error');
    } finally {
      setKickingMemberId(null);
    }
  };

  const handleCopyZaloSettlement = async () => {
    const reportText = buildZaloSettlementReport(displayTripTitle, expenses, settlement, settledTransfers);
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
      onShowToastRef.current?.('Đã sao chép bảng chia tiền — dán vào nhóm chat là xong!', 'success');
    } else {
      onShowToastRef.current?.('Trình duyệt chưa cho sao chép tự động, bạn thử lại nhé.', 'error');
    }
  };

  const handleExportRangerManifestCsv = () => {
    if (isLoading) return;
    if (!activeTripDetail) {
      onShowToastRef.current?.(
        'Chưa tải xong danh sách đoàn để xuất bản khai báo Kiểm lâm.',
        'error'
      );
      return;
    }
    let createdUrl: string | null = null;
    let anchor: HTMLAnchorElement | null = null;
    let scheduledRevoke = false;
    try {
      const csvContent = buildRangerManifestCsv({
        tripTitle: displayTripTitle,
        tripDetail: activeTripDetail,
        roster: squadRoster,
        memberLoads: gearLoadSummary.memberLoads,
        matrixItems: gearLoadSummary.items,
        safetyGateChecks,
        safetyGateCompletedCount,
      });
      const filename = `khai-bao-kiem-lam-${slugifyCsvFilenamePart(activeTripDetail.trailName || displayTripTitle)}-${getVietnamDateCompact()}.csv`;
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

      onShowToastRef.current?.(`Đã tải xuống bản khai báo Kiểm lâm (${filename}).`, 'success');
    } catch {
      if (anchor && anchor.parentNode) {
        anchor.parentNode.removeChild(anchor);
      }
      if (createdUrl && !scheduledRevoke) {
        URL.revokeObjectURL(createdUrl);
      }
      onShowToastRef.current?.('Chưa xuất được tệp khai báo Kiểm lâm, bạn thử lại nhé.', 'error');
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
        throw new Error(data.message || 'Chưa mở được nhóm chat đoàn.');
      }
      onShowToast?.('Đang vào nhóm chat đoàn!', 'success');
      const convId = data.data?.conversationId;
      if (convId) {
        localStorage.setItem('lost_target_group_conv', convId);
        onOpenGroupChat?.(convId);
      }
      onClose();
      const targetUrl = convId ? `/messages?convId=${encodeURIComponent(convId)}` : '/messages';
      window.history.pushState({ view: 'messages' }, '', targetUrl);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (err: unknown) {
      onShowToast?.(
        extractErrorMessage(err, 'Chỉ thành viên đã được duyệt vào đoàn mới mở được chat nhóm.'),
        'error'
      );
    } finally {
      setIsOpeningChat(false);
    }
  };

  const applyUpdatedExpenses = useCallback(
    (nextExpenses: ExpenseItem[], serverSettled?: unknown) => {
      setTripDetail((prev) => {
        if (!prev || prev._id !== tripId) return prev;
        const nextDoc: TripDetailPayload = { ...prev, expenses: nextExpenses };
        if (Array.isArray(serverSettled)) {
          return { ...nextDoc, settledTransfers: serverSettled as string[] };
        }
        const recomputed = computeGreedyDebtSettlement(nextExpenses, nextDoc, liveMemberCount);
        const activeKeys = new Set(recomputed.transfers.map((t) => t.key));
        const prunedSettled = Array.isArray(prev.settledTransfers)
          ? prev.settledTransfers.filter((k) => activeKeys.has(k))
          : [];
        return { ...nextDoc, settledTransfers: prunedSettled };
      });
    },
    [tripId, liveMemberCount]
  );

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAddingExpense) return;
    const amount = Math.round(Number(newExpAmount));
    if (
      !newExpTitle.trim() ||
      !Number.isFinite(amount) ||
      amount < MIN_EXPENSE_VND ||
      amount > MAX_EXPENSE_VND
    ) {
      onShowToast?.('Nhập tên khoản chi và số tiền nguyên từ 1.000đ đến 500.000.000đ.', 'error');
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
          paidByUserId: effectiveIsCreator && newExpPayerId ? newExpPayerId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      const nextExpenses = Array.isArray(data.data) ? data.data : [];
      applyUpdatedExpenses(nextExpenses, data.settledTransfers);
      setNewExpTitle('');
      setNewExpAmount('');
      onShowToast?.('Đã ghi khoản chi mới cho đoàn.', 'success');
    } catch (err: unknown) {
      onShowToast?.(extractErrorMessage(err, 'Chưa ghi được khoản chi này.'), 'error');
    } finally {
      setIsAddingExpense(false);
    }
  };

  const handleStartEditExpense = (exp: ExpenseItem) => {
    setEditingExpenseId(exp.id);
    setEditExpTitle(exp.title);
    setEditExpAmount(String(Math.round(Number(exp.amountVnd) || 0)));
    setEditExpPayerId(exp.paidByUserId ? String(exp.paidByUserId) : '');
  };

  const handleSaveEditExpense = async (e: React.FormEvent, expenseId: string) => {
    e.preventDefault();
    if (isSavingExpense) return;
    const amount = Math.round(Number(editExpAmount));
    if (
      !editExpTitle.trim() ||
      !Number.isFinite(amount) ||
      amount < MIN_EXPENSE_VND ||
      amount > MAX_EXPENSE_VND
    ) {
      onShowToast?.('Bạn nhập lại tên khoản chi và số tiền nguyên từ 1.000đ đến 500.000.000đ nhé.', 'error');
      return;
    }
    setIsSavingExpense(true);
    try {
      const res = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`,
        {
          method: 'PATCH',
          headers: getApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            title: editExpTitle.trim(),
            amountVnd: amount,
            splitCount: Math.max(1, liveMemberCount),
            paidByUserId: effectiveIsCreator && editExpPayerId ? editExpPayerId : undefined,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const nextExpenses = Array.isArray(data.data) ? data.data : [];
        applyUpdatedExpenses(nextExpenses, data.settledTransfers);
        setEditingExpenseId(null);
        onShowToast?.(data.message || 'Đã sửa khoản chi.', 'success');
      } else {
        onShowToast?.(data.message || 'Chưa lưu được thay đổi khoản chi.', 'error');
      }
    } catch {
      onShowToast?.('Mất kết nối nên chưa sửa được khoản chi.', 'error');
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleToggleSettlement = async (transferKey: string) => {
    if (togglingSettlementKey || !transferKey) return;
    setTogglingSettlementKey(transferKey);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/settlements`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ transferKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const nextSettled = Array.isArray(data.data) ? data.data : [];
        setTripDetail((prev) => (prev && prev._id === tripId ? { ...prev, settledTransfers: nextSettled } : prev));
        onShowToast?.(
          data.settled ? 'Đã đánh dấu chuyển xong!' : 'Đã bỏ đánh dấu chuyển tiền.',
          data.settled ? 'success' : 'info'
        );
      } else {
        onShowToast?.(data.message || 'Chưa lưu được trạng thái chuyển tiền.', 'error');
      }
    } catch {
      onShowToast?.('Mất kết nối nên chưa lưu được trạng thái chuyển tiền.', 'error');
    } finally {
      setTogglingSettlementKey(null);
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
        applyUpdatedExpenses(nextExpenses, data.settledTransfers);
      } else {
        onShowToast?.(data.message || 'Chưa xóa được khoản chi này.', 'error');
      }
    } catch {
      onShowToast?.('Chưa xóa được khoản chi này.', 'error');
    } finally {
      setDeletingExpenseId(null);
    }
  };

  const maxMembers = Math.max(1, Number(activeTripDetail?.maxMembers) || liveMemberCount);
  const remainingSeats = Math.max(0, maxMembers - liveMemberCount);
  const tripStatus = activeTripDetail?.status || 'recruiting';
  const isRecruiting = tripStatus === 'recruiting';
  const isFull = tripStatus === 'full' || remainingSeats === 0;
  const isClosedForJoin = !isRecruiting || isFull;
  const closedJoinLabel =
    tripStatus === 'in_progress'
      ? 'Đoàn đang trên cung'
      : tripStatus === 'completed'
        ? 'Chuyến đi đã kết thúc'
        : tripStatus === 'cancelled'
          ? 'Chuyến đi đã hủy'
          : 'Đã đủ người';

  const handleReviewApplicant = async (applicantUserId: string, decision: 'approve' | 'reject') => {
    if (processingApplicantId || !applicantUserId) return;
    if (decision === 'approve' && (!isRecruiting || isFull)) {
      onShowToast?.(
        !isRecruiting
          ? 'Chỉ có thể duyệt thành viên khi chuyến đi đang mở ghép đoàn.'
          : 'Đoàn đã đủ số lượng thành viên tối đa.',
        'info'
      );
      return;
    }
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
          data.message || (decision === 'approve' ? 'Chưa duyệt được bạn này vào đoàn.' : 'Chưa từ chối được yêu cầu.')
        );
      }
      onShowToast?.(
        data.message || (decision === 'approve' ? 'Đã nhận thêm bạn vào đoàn!' : 'Đã từ chối lời xin ghép đoàn.'),
        decision === 'approve' ? 'success' : 'info'
      );
      // Update local state directly from the existing pending applicant record to avoid inflating viewsCount via GET
      setTripDetail((prev) => {
        if (!prev || prev._id !== tripId) return prev;
        const prevPending = Array.isArray(prev.pendingRequests) ? prev.pendingRequests : [];
        const matchedReq = prevPending.find((r) => {
          const id = typeof r.userId === 'object' && r.userId ? String(r.userId._id) : String(r.userId);
          return id === applicantUserId;
        });
        const nextPending = prevPending.filter((r) => {
          const id = typeof r.userId === 'object' && r.userId ? String(r.userId._id) : String(r.userId);
          return id !== applicantUserId;
        });
        if (decision === 'reject') {
          return { ...prev, pendingRequests: nextPending };
        }
        const prevMembers = Array.isArray(prev.currentMembers) ? prev.currentMembers : [];
        const alreadyMember = prevMembers.some(
          (m) => String(typeof m === 'object' && m ? m._id : m) === applicantUserId
        );
        const applicantMemberObj =
          matchedReq && typeof matchedReq.userId === 'object' && matchedReq.userId
            ? matchedReq.userId
            : { _id: applicantUserId, fullName: 'Thành viên mới' };
        const nextMembers = alreadyMember ? prevMembers : [...prevMembers, applicantMemberObj];
        const nextMax = Math.max(1, Number(prev.maxMembers) || nextMembers.length);
        const nextStatus =
          prev.status === 'recruiting' && nextMembers.length >= nextMax ? 'full' : prev.status;
        const nextDoc: TripDetailPayload = {
          ...prev,
          pendingRequests: nextPending,
          currentMembers: nextMembers,
          status: nextStatus,
        };
        const recomputed = computeGreedyDebtSettlement(
          Array.isArray(nextDoc.expenses) ? nextDoc.expenses : [],
          nextDoc,
          Math.max(1, nextMembers.length)
        );
        const activeKeys = new Set(recomputed.transfers.map((t) => t.key));
        return {
          ...nextDoc,
          settledTransfers: Array.isArray(prev.settledTransfers)
            ? prev.settledTransfers.filter((k) => activeKeys.has(k))
            : [],
        };
      });
      onTripUpdated?.();
    } catch (err: unknown) {
      onShowToast?.(extractErrorMessage(err, 'Chưa xử lý được yêu cầu này, bạn thử lại nhé.'), 'error');
    } finally {
      setProcessingApplicantId(null);
    }
  };

  const handleRequestJoinFromModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingJoin || isClosedForJoin) return;
    const token = safeLocalStorageGet('lost_token');
    if (!token) {
      onShowToast?.('Đăng nhập để xin đi cùng đoàn nhé.', 'info');
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
        setJoinRequestOverride({ tripId, pending: true });
        setTripDetail((prev) => (prev && prev._id === tripId ? { ...prev, hasPendingRequest: true } : prev));
        setJoinNote('');
        onShowToast?.(data.message || 'Đã gửi lời xin đi cùng — chờ trưởng đoàn phản hồi nhé!', 'success');
        onTripUpdated?.();
      } else {
        onShowToast?.(data.message || 'Chưa gửi được lời xin ghép đoàn.', 'error');
      }
    } catch {
      onShowToast?.('Mất kết nối rồi, bạn kiểm tra lại mạng nhé.', 'error');
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  const handleWithdrawRequestFromModal = async () => {
    if (isWithdrawingJoin) return;
    setIsWithdrawingJoin(true);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/leave`, {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setJoinRequestOverride({ tripId, pending: false });
        setTripDetail((prev) => (prev && prev._id === tripId ? { ...prev, hasPendingRequest: false } : prev));
        onShowToast?.(data.message || 'Đã rút lời xin đi cùng đoàn.', 'info');
        onTripUpdated?.();
      } else {
        onShowToast?.(data.message || 'Chưa rút được yêu cầu, bạn thử lại sau nhé.', 'error');
      }
    } catch {
      onShowToast?.('Mất kết nối nên chưa rút được yêu cầu.', 'error');
    } finally {
      setIsWithdrawingJoin(false);
    }
  };

  if (!isOpen) return null;

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
        aria-label={`Sổ đoàn ${tripTitle}`}
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
              Nhóm đồng hành ({liveMemberCount} thành viên)
            </div>
            <h3 className="font-editorial" style={{ margin: '3px 0 0 0', fontSize: '1.3rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
              {displayTripTitle}
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {(!isLoading || Boolean(activeTripDetail)) && effectiveIsMember && (
              <>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleExportRangerManifestCsv}
                  disabled={isLoading || !activeTripDetail}
                  title={
                    !activeTripDetail && !isLoading
                      ? 'Chưa tải xong danh sách đoàn để xuất bản khai báo Kiểm lâm'
                      : 'Tải danh sách đoàn, đồ chung và 6 bước an toàn theo mẫu khai báo Kiểm lâm'
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
                  <span>Xuất bản khai báo Kiểm lâm (CSV)</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleOpenGroupChat}
                  disabled={isOpeningChat}
                  style={{ padding: '7px 14px', fontSize: '0.78rem', borderRadius: 4 }}
                >
                  <IconMessageSquare size={14} />
                  <span>{isOpeningChat ? 'Đang mở...' : 'Vào nhóm chat đoàn'}</span>
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

        {/* Creator Management Controls (Status, Edit Trip, Delete Trip) */}
        {effectiveIsCreator && activeTripDetail && (
          <div
            style={{
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: 4,
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Tùy chỉnh của trưởng đoàn:
                </span>
                <select
                  aria-label="Trạng thái chuyến đi"
                  className="form-input"
                  value={activeTripDetail.status || 'recruiting'}
                  disabled={isUpdatingStatus || isDeletingTrip}
                  onChange={(e) => handleRequestUpdateTripStatus(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: 4,
                    background: 'var(--color-bg-card)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  {Object.entries(TRIP_STATUS_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={isSavingTrip || isDeletingTrip}
                  onClick={() => (isEditingTrip ? setIsEditingTrip(false) : handleOpenEditTrip())}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    borderRadius: 4,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <IconEdit size={13} />
                  <span>{isEditingTrip ? 'Đóng chỉnh sửa' : 'Sửa lịch trình'}</span>
                </button>

                {confirmDeleteTrip ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={isDeletingTrip}
                      onClick={handleDeleteTrip}
                      style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 800, borderRadius: 4 }}
                    >
                      {isDeletingTrip ? 'Đang xóa...' : 'Chắc chắn xóa'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={isDeletingTrip}
                      onClick={() => setConfirmDeleteTrip(false)}
                      style={{ padding: '4px 8px', fontSize: '0.74rem', borderRadius: 4 }}
                    >
                      Hủy
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={isDeletingTrip}
                    onClick={() => setConfirmDeleteTrip(true)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      borderRadius: 4,
                      color: 'var(--color-error-text, var(--color-error))',
                      borderColor: 'color-mix(in srgb, var(--color-error) 35%, transparent)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <IconTrash size={13} color="var(--color-error-text, var(--color-error))" />
                    <span>Xóa chuyến</span>
                  </button>
                )}
              </div>
            </div>

            {pendingInProgressConfirm && (
              <div
                role="alert"
                style={{
                  borderTop: '1px solid var(--banner-danger-border)',
                  padding: '10px 12px',
                  borderRadius: 4,
                  background: 'var(--banner-danger-bg)',
                  border: '1px solid var(--banner-danger-border)',
                  color: 'var(--banner-danger-text)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.78rem', lineHeight: 1.45 }}>
                  <IconAlertTriangle
                    size={16}
                    color="var(--color-error-text, var(--banner-danger-text))"
                    style={{ flexShrink: 0, marginTop: 1 }}
                  />
                  <span>
                    Đoàn mới xác nhận{' '}
                    <strong>
                      {safetyGateCompletedCount}/{SQUAD_SAFETY_GATE_STEPS.length} bước kiểm tra an toàn
                    </strong>{' '}
                    trước khi vào rừng. Bạn nên rà soát đủ 6/6 bước trước khi chuyển sang &ldquo;Đang trên cung&rdquo;.
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={isUpdatingStatus}
                    onClick={() => {
                      setPendingInProgressConfirm(false);
                      setIsSafetyGateOpen(true);
                    }}
                    style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 700, borderRadius: 4 }}
                  >
                    Mở 6 bước an toàn
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={isUpdatingStatus}
                    onClick={() => void executeUpdateTripStatus('in_progress')}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      borderRadius: 4,
                      background: 'var(--color-error)',
                      color: 'var(--color-on-danger)',
                      border: '1px solid var(--color-error)',
                    }}
                  >
                    {isUpdatingStatus ? 'Đang cập nhật...' : 'Vẫn xác nhận lên đường'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={isUpdatingStatus}
                    onClick={() => setPendingInProgressConfirm(false)}
                    style={{ padding: '4px 8px', fontSize: '0.74rem', borderRadius: 4 }}
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}

            {isEditingTrip && (
              <form
                onSubmit={handleSaveTripEdit}
                style={{
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <input
                  type="text"
                  className="form-input"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Tên chuyến đi *"
                  style={{ width: '100%', padding: '7px 10px', fontSize: '0.82rem', borderRadius: 4 }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', marginBottom: 3 }}>Ngày khởi hành</label>
                    <input
                      type="date"
                      className="form-input"
                      value={editStartDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditStartDate(val);
                        if (editEndDate && val && editEndDate < val) {
                          setEditEndDate(val);
                        }
                      }}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', marginBottom: 3 }}>Ngày kết thúc</label>
                    <input
                      type="date"
                      className="form-input"
                      min={editStartDate || undefined}
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', marginBottom: 3 }}>Số chỗ tối đa (tối đa 30)</label>
                    <input
                      type="number"
                      className="form-input"
                      min={Math.max(2, liveMemberCount)}
                      max={MAX_TRIP_MEMBERS_CAP}
                      value={editMaxMembers}
                      onChange={(e) => setEditMaxMembers(e.target.value)}
                      onBlur={() =>
                        setEditMaxMembers(String(clampTripMaxMembers(editMaxMembers, liveMemberCount)))
                      }
                      style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', marginBottom: 3 }}>Độ khó (1-5)</label>
                    <select
                      className="form-input"
                      value={editDifficulty}
                      onChange={(e) => setEditDifficulty(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4 }}
                    >
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <option key={lvl} value={String(lvl)}>
                          Cấp {lvl}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                  <input
                    type="text"
                    className="form-input"
                    value={editMeetingPoint}
                    onChange={(e) => setEditMeetingPoint(e.target.value)}
                    placeholder="Điểm tập trung xuất phát"
                    style={{ width: '100%', padding: '7px 10px', fontSize: '0.78rem', borderRadius: 4 }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    value={editEstimatedCost}
                    onChange={(e) => setEditEstimatedCost(e.target.value)}
                    placeholder="Chi phí dự kiến (VD: 1,8 triệu/người)"
                    style={{ width: '100%', padding: '7px 10px', fontSize: '0.78rem', borderRadius: 4 }}
                  />
                </div>

                <input
                  type="text"
                  className="form-input"
                  value={editRequirements}
                  onChange={(e) => setEditRequirements(e.target.value)}
                  placeholder="Yêu cầu thể lực & đồ cần mang"
                  style={{ width: '100%', padding: '7px 10px', fontSize: '0.78rem', borderRadius: 4 }}
                />

                <textarea
                  rows={2}
                  className="form-input"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Lịch trình sơ bộ, nhịp đi, điểm nghỉ..."
                  style={{ width: '100%', padding: '7px 10px', fontSize: '0.78rem', borderRadius: 4, resize: 'vertical' }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={isSavingTrip}
                    onClick={() => setIsEditingTrip(false)}
                    style={{ padding: '5px 12px', fontSize: '0.76rem', borderRadius: 4 }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSavingTrip || !editTitle.trim()}
                    style={{ padding: '5px 14px', fontSize: '0.76rem', fontWeight: 800, borderRadius: 4 }}
                  >
                    {isSavingTrip ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Initial Loading & Error-Retry Gate (prevents flashing guest UI before role resolves) */}
        {isLoading && !activeTripDetail ? (
          <div style={{ textAlign: 'center', padding: '36px 18px', color: 'var(--color-text-muted)', fontSize: '0.86rem' }}>
            Đang mở sổ đoàn...
          </div>
        ) : loadError && !activeTripDetail ? (
          <div
            role="alert"
            style={{
              padding: '22px 18px',
              borderRadius: 4,
              background: 'var(--banner-danger-bg)',
              border: '1px solid var(--banner-danger-border)',
              color: 'var(--banner-danger-text)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              textAlign: 'center',
            }}
          >
            <IconAlertTriangle size={24} color="var(--color-error-text, var(--banner-danger-text))" />
            <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>{loadError}</div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={reloadWorkspace}
              style={{ padding: '7px 16px', fontSize: '0.8rem', fontWeight: 800, borderRadius: 4 }}
            >
              Thử lại
            </button>
          </div>
        ) : !effectiveIsMember ? (
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
                {activeTripDetail?.description || 'Chuyến đi ghép đoàn cùng anh em trên LOST.'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                {activeTripDetail?.startDate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconCalendar size={14} color="var(--color-primary)" />
                    <span>
                      Khởi hành: <strong style={{ color: 'var(--color-text-main)' }}>{formatDateViOptional(activeTripDetail.startDate)}</strong>
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconUsers size={14} color="var(--color-sky)" />
                  <span>
                    Trạng thái:{' '}
                    <strong style={{ color: isClosedForJoin ? 'var(--color-error-text, var(--color-error))' : 'var(--color-primary)' }}>
                      {isClosedForJoin ? closedJoinLabel : `Còn ${remainingSeats}/${maxMembers} chỗ`}
                    </strong>
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
              Nhóm chat đoàn, bảng chia đồ chung và chia tiền sẽ mở ra ngay khi trưởng đoàn duyệt bạn vào nhóm.
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
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconCheckCircle size={16} color="var(--color-primary)" />
                  <span>Đã gửi lời xin đi cùng — chờ trưởng đoàn duyệt nhé!</span>
                </span>
                <button
                  type="button"
                  disabled={isWithdrawingJoin}
                  onClick={handleWithdrawRequestFromModal}
                  className="btn btn-outline"
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: 4,
                    color: 'var(--color-error-text, var(--color-error))',
                    borderColor: 'color-mix(in srgb, var(--color-error) 40%, transparent)',
                  }}
                >
                  {isWithdrawingJoin ? 'Đang rút...' : 'Rút yêu cầu'}
                </button>
              </div>
            ) : isClosedForJoin ? (
              <div
                style={{
                  padding: '11px 14px',
                  borderRadius: 4,
                  background: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border-strong)',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  textAlign: 'center',
                }}
              >
                {closedJoinLabel} — chuyến đi hiện không nhận thêm thành viên.
              </div>
            ) : (
              <form onSubmit={handleRequestJoinFromModal} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="form-input"
                  value={joinNote}
                  onChange={(e) => setJoinNote(e.target.value)}
                  placeholder="Nhắn vài dòng về kinh nghiệm đi rừng, thể lực của bạn..."
                  disabled={isSubmittingJoin}
                  style={{ flex: 1, minWidth: 220, fontSize: '0.84rem', borderRadius: 4 }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingJoin}
                  style={{ borderRadius: 4, padding: '8px 16px', fontSize: '0.82rem', fontWeight: 800 }}
                >
                  <IconUserPlus size={15} />
                  <span>{isSubmittingJoin ? 'Đang gửi...' : 'Xin đi cùng đoàn'}</span>
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
                    <span>6 bước kiểm tra an toàn trước khi lên đường</span>
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
                        ? `${safetyGateCompletedCount}/${SQUAD_SAFETY_GATE_STEPS.length} sẵn sàng`
                        : `${safetyGateCompletedCount}/${SQUAD_SAFETY_GATE_STEPS.length} bước`}
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
                  aria-label="Tiến độ 6 bước kiểm tra an toàn trước khi lên đường"
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
                        background: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card))',
                        border: '1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border))',
                        color: 'var(--color-primary)',
                      }}
                    >
                      {effectiveIsCreator
                        ? 'Trưởng đoàn xác nhận — cả đoàn cùng theo dõi'
                        : 'Chỉ trưởng đoàn có quyền xác nhận & đặt lại'}
                    </span>
                    {effectiveIsCreator && safetyGateCompletedCount > 0 && (
                      <button
                        type="button"
                        disabled={Boolean(savingSafetyStep)}
                        onClick={handleResetSafetyGate}
                        className="btn btn-outline"
                        style={{ padding: '3px 8px', fontSize: '0.7rem', borderRadius: 4, fontWeight: 700 }}
                      >
                        {savingSafetyStep === 'reset' ? 'Đang bỏ chọn...' : 'Rà soát lại từ đầu'}
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {SQUAD_SAFETY_GATE_STEPS.map((step, idx) => {
                      const stepInfo = safetyGateDetails[step.id];
                      const checked = stepInfo.checked;
                      const isSavingThis = savingSafetyStep === step.id;
                      const canToggleStep = effectiveIsCreator && !savingSafetyStep;
                      return (
                        <button
                          key={step.id}
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          disabled={!canToggleStep}
                          onClick={() => handleToggleSafetyGateStep(step.id)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 9,
                            padding: '8px 10px',
                            borderRadius: 4,
                            textAlign: 'left',
                            cursor: !effectiveIsCreator ? 'default' : isSavingThis ? 'wait' : 'pointer',
                            opacity: isSavingThis ? 0.7 : 1,
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
                            {checked && (stepInfo.checkedByName || stepInfo.checkedAt) && (
                              <div
                                style={{
                                  fontSize: '0.67rem',
                                  color: 'var(--color-primary)',
                                  fontWeight: 700,
                                  marginTop: 3,
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                Đã xác nhận
                                {stepInfo.checkedByName ? ` bởi ${stepInfo.checkedByName}` : ''}
                                {stepInfo.checkedAt ? ` • ${stepInfo.checkedAt}` : ''}
                              </div>
                            )}
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
                      <span>Đoàn đã kiểm đủ 6/6 bước an toàn — yên tâm lên đường thôi!</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sub-Tabs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
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
                <span>Đồ chung ({totalSquadGearCount})</span>
              </button>
              <button
                type="button"
                className={`btn ${activeTab === 'expenses' ? 'btn-earth' : 'btn-outline'}`}
                onClick={() => setActiveTab('expenses')}
                style={{ justifyContent: 'center', fontSize: '0.8rem', padding: '8px 10px', borderRadius: 4 }}
              >
                <span>Chia tiền ({expenses.length})</span>
              </button>
              <button
                type="button"
                className={`btn ${activeTab === 'requests' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveTab('requests')}
                style={{ justifyContent: 'center', fontSize: '0.8rem', padding: '8px 10px', borderRadius: 4 }}
              >
                <IconUsers size={14} />
                <span>
                  Thành viên ({liveMemberCount}
                  {effectiveIsCreator && pendingRequests.length > 0 ? ` • +${pendingRequests.length}` : ''})
                </span>
              </button>
            </div>

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: 28, color: 'var(--color-text-dim)', fontSize: '0.84rem' }}>
                Đang mở sổ đoàn...
              </div>
            ) : activeTab === 'requests' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Pending Join Requests (Creator only) */}
                {effectiveIsCreator && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Người đang xin ghép đoàn ({pendingRequests.length})
                    </div>
                    {pendingRequests.length === 0 ? (
                      <div
                        style={{
                          textAlign: 'center',
                          padding: 18,
                          borderRadius: 4,
                          border: '1px dashed var(--color-border)',
                          color: 'var(--color-text-muted)',
                          fontSize: '0.8rem',
                        }}
                      >
                        Chưa có ai gửi lời xin đi cùng đoàn.
                      </div>
                    ) : (
                      pendingRequests.map((reqItem, idx) => {
                        const userObj = typeof reqItem.userId === 'object' && reqItem.userId ? reqItem.userId : null;
                        const applicantId = userObj?._id || (typeof reqItem.userId === 'string' ? reqItem.userId : '');
                        const applicantName = userObj?.fullName || 'Bạn đồng hành';
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
                                {userObj?.avatarUrl && !failedAvatarKeys.includes(`req:${applicantId}`) ? (
                                  <img
                                    src={userObj.avatarUrl}
                                    alt={applicantName}
                                    referrerPolicy="no-referrer"
                                    onError={() =>
                                      setFailedAvatarKeys((prev) =>
                                        prev.includes(`req:${applicantId}`) ? prev : [...prev, `req:${applicantId}`]
                                      )
                                    }
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
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openMemberProfile({
                                        name: applicantName,
                                        avatar: userObj?.avatarUrl || '',
                                        userId: applicantId || undefined,
                                      })
                                    }
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      padding: 0,
                                      cursor: 'pointer',
                                      fontSize: '0.86rem',
                                      fontWeight: 800,
                                      color: 'var(--color-text-main)',
                                      textAlign: 'left',
                                    }}
                                  >
                                    {applicantName}
                                  </button>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {userObj?.reputationScore !== undefined && (
                                      <span style={{ color: 'var(--color-primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                        <IconStar size={11} color="var(--color-primary)" fill="var(--color-primary)" />
                                        {userObj.reputationScore} điểm uy tín
                                      </span>
                                    )}
                                    {reqDate && <span>• {reqDate}</span>}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  disabled={Boolean(processingApplicantId) || !isRecruiting || isFull}
                                  title={
                                    !isRecruiting
                                      ? 'Chỉ có thể duyệt thành viên khi chuyến đi đang mở ghép đoàn'
                                      : isFull
                                        ? 'Đoàn đã đủ số lượng thành viên tối đa'
                                        : undefined
                                  }
                                  onClick={() => handleReviewApplicant(applicantId, 'approve')}
                                  className="btn btn-primary"
                                  style={{ padding: '6px 12px', fontSize: '0.76rem', borderRadius: 4, fontWeight: 700 }}
                                >
                                  {isBusy ? 'Đang duyệt...' : 'Nhận vào đoàn'}
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
                )}

                {/* Approved Squad Roster with Creator Kick Member */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Thành viên trong đoàn ({confirmedRosterMembers.length}/{maxMembers})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {confirmedRosterMembers.map((member) => {
                      const isLeader = Boolean(creatorUserId && member.rawId && member.rawId === creatorUserId);
                      const canKick = Boolean(effectiveIsCreator && !isLeader && member.rawId);
                      const isConfirmingKick = confirmKickMemberId === member.rawId;
                      const isKickingThis = kickingMemberId === member.rawId;

                      return (
                        <div
                          key={member.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            flexWrap: 'wrap',
                            padding: '10px 12px',
                            borderRadius: 4,
                            background: 'var(--color-bg-main)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {member.avatarUrl && !failedAvatarKeys.includes(`mem:${member.id}`) ? (
                              <img
                                src={member.avatarUrl}
                                alt={member.name}
                                referrerPolicy="no-referrer"
                                onError={() =>
                                  setFailedAvatarKeys((prev) =>
                                    prev.includes(`mem:${member.id}`) ? prev : [...prev, `mem:${member.id}`]
                                  )
                                }
                                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--color-primary)' }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: '50%',
                                  background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
                                  border: '1px solid var(--color-primary)',
                                  color: 'var(--color-primary)',
                                  fontWeight: 800,
                                  fontSize: '0.8rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openMemberProfile({
                                      name: member.name,
                                      avatar: member.avatarUrl || '',
                                      userId: member.rawId,
                                    })
                                  }
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                    fontSize: '0.84rem',
                                    fontWeight: 800,
                                    color: 'var(--color-text-main)',
                                    textAlign: 'left',
                                  }}
                                >
                                  {member.name}
                                </button>
                                {isLeader && (
                                  <span className="badge badge-success" style={{ fontSize: '0.64rem', padding: '1px 6px' }}>
                                    Trưởng đoàn
                                  </span>
                                )}
                              </div>
                              {member.reputationScore !== undefined && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <IconStar size={10} color="var(--color-primary)" fill="var(--color-primary)" />
                                  <span>{member.reputationScore} điểm uy tín</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {canKick && member.rawId && (
                            isConfirmingKick ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <button
                                  type="button"
                                  disabled={isKickingThis}
                                  onClick={() => handleKickMember(member.rawId!)}
                                  className="btn btn-danger"
                                  style={{ padding: '4px 10px', fontSize: '0.72rem', fontWeight: 800, borderRadius: 4 }}
                                >
                                  {isKickingThis ? 'Đang xóa...' : 'Chắc chắn xóa'}
                                </button>
                                <button
                                  type="button"
                                  disabled={isKickingThis}
                                  onClick={() => setConfirmKickMemberId(null)}
                                  className="btn btn-outline"
                                  style={{ padding: '4px 8px', fontSize: '0.72rem', borderRadius: 4 }}
                                >
                                  Hủy
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={Boolean(kickingMemberId)}
                                onClick={() => setConfirmKickMemberId(member.rawId!)}
                                className="btn btn-outline"
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  borderRadius: 4,
                                  color: 'var(--color-error-text, var(--color-error))',
                                  borderColor: 'color-mix(in srgb, var(--color-error) 35%, transparent)',
                                }}
                              >
                                Xóa khỏi đoàn
                              </button>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : activeTab === 'gear' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Shared Gear Telemetry KPIs + Cloud Sync Badge + 1-Click Share Export */}
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
                      Chia đều đồ chung của đoàn
                    </span>
                    <span
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card))',
                        border: '1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border))',
                        color: 'var(--color-primary)',
                      }}
                    >
                      Cả đoàn cùng cập nhật
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
                          Tổng trọng lượng
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
                          Chia đều ({squadRoster.length} người)
                        </div>
                        <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--color-sky)', fontVariantNumeric: 'tabular-nums' }}>
                          ~{formatWeightKg(gearLoadSummary.fairShareG)} kg / người
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                          Đã chuẩn bị
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
                      <span>{copiedGear ? 'Đã chép xong!' : 'Chép gửi nhóm chat'}</span>
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
                      Hơi nặng vai cho một người (&gt;{gearLoadSummary.fairLoadThresholdPct}%):{' '}
                      <strong>
                        {gearLoadSummary.overloadedMembers
                          .map((m) => `${m.name} (${m.pct.toFixed(0)}%)`)
                          .join(', ')}
                      </strong>{' '}
                      đang gánh nhiều đồ chung quá — chia bớt sang ba lô anh em khác nhé!
                    </span>
                  </div>
                )}

                {/* Vietnam Trekking Shared-Gear Presets (1-Click Auto Balanced Cloud Add) */}
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
                    Đồ chung hay mang đi rừng (bấm để thêm &amp; tự chia cho người nhẹ vai nhất)
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {VIETNAM_SQUAD_GEAR_PRESETS.map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        disabled={isAnyGearMutating}
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
                    placeholder="Tên món đồ (VD: Nồi nấu nước, đèn lều...)"
                    aria-label="Tên trang bị chung của đoàn"
                    disabled={isAnyGearMutating}
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
                    placeholder="Nặng (gram)"
                    aria-label="Trọng lượng trang bị chung tính theo gram"
                    disabled={isAnyGearMutating}
                    style={{ minWidth: 0, fontSize: '0.82rem', borderRadius: 4, fontVariantNumeric: 'tabular-nums' }}
                    required
                  />
                  <select
                    className="form-input"
                    value={newGearCategory}
                    onChange={(e) => setNewGearCategory(e.target.value)}
                    aria-label="Danh mục trang bị chung"
                    disabled={isAnyGearMutating}
                    style={{ minWidth: 0, fontSize: '0.78rem', borderRadius: 4 }}
                  >
                    <option value="Lán trại & Nấu ăn">Lán trại &amp; nấu ăn</option>
                    <option value="Y tế & An toàn">Y tế &amp; an toàn</option>
                    <option value="Nước & Thực phẩm">Nước &amp; thực phẩm</option>
                    <option value="Dùng chung">Dùng chung</option>
                  </select>
                  <select
                    className="form-input"
                    value={effectiveNewGearCarrierId}
                    onChange={(e) => setNewGearCarrierId(e.target.value)}
                    aria-label="Người mang trang bị chung"
                    disabled={isAnyGearMutating}
                    style={{ minWidth: 0, fontSize: '0.78rem', borderRadius: 4 }}
                  >
                    <option value="">-- Chưa ai nhận --</option>
                    {squadRoster.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={isAnyGearMutating || !newGearName.trim()}
                    className="btn btn-primary"
                    style={{ fontSize: '0.78rem', fontWeight: 800, padding: '7px 12px', borderRadius: 4 }}
                  >
                    {isAddingGear ? 'Đang lưu...' : '+ Thêm món đồ'}
                  </button>
                </form>

                {/* Unified Cloud-Synced Shared Gear Matrix Items */}
                {gearLoadSummary.items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, borderRadius: 4, border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                    Chưa có món đồ chung nào — bấm chọn nhanh các món gợi ý phía trên hoặc tự nhập để chia đều vào ba lô cả đoàn nhé.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 300, overflowY: 'auto' }}>
                    {gearLoadSummary.items.map((item) => {
                      const isMutatingThisItem =
                        togglingGearId === item.id ||
                        deletingGearId === item.id ||
                        (isSavingGearEdit && editingGearId === item.id);
                      const isEditingThisGear = editingGearId === item.id;
                      return (
                        <div
                          key={item.id}
                          style={{
                            padding: '9px 12px',
                            borderRadius: 4,
                            background: item.packed
                              ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                              : 'var(--color-bg-main)',
                            border: item.packed
                              ? '1px solid var(--color-primary)'
                              : '1px solid var(--color-border)',
                            opacity: isMutatingThisItem ? 0.7 : 1,
                          }}
                        >
                          {isEditingThisGear ? (
                            <form
                              onSubmit={(e) => handleSaveEditGear(e, item.id)}
                              style={{ display: 'flex', flexDirection: 'column', gap: 7 }}
                            >
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 6 }}>
                                <input
                                  className="form-input"
                                  value={editGearName}
                                  onChange={(e) => setEditGearName(e.target.value)}
                                  placeholder="Tên món đồ *"
                                  aria-label="Sửa tên món đồ chung"
                                  maxLength={140}
                                  disabled={isAnyGearMutating}
                                  required
                                  style={{ gridColumn: '1 / -1', padding: '6px 9px', fontSize: '0.8rem', borderRadius: 4 }}
                                />
                                <input
                                  type="number"
                                  min="0"
                                  max="100000"
                                  step="10"
                                  className="form-input"
                                  value={editGearWeightG}
                                  onChange={(e) => setEditGearWeightG(e.target.value)}
                                  placeholder="Trọng lượng (g)"
                                  aria-label="Sửa trọng lượng món đồ (gram)"
                                  disabled={isAnyGearMutating}
                                  required
                                  style={{ padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4, fontVariantNumeric: 'tabular-nums' }}
                                />
                                <select
                                  className="form-input"
                                  value={editGearCategory}
                                  onChange={(e) => setEditGearCategory(e.target.value)}
                                  aria-label="Sửa danh mục món đồ"
                                  disabled={isAnyGearMutating}
                                  style={{ padding: '6px 8px', fontSize: '0.76rem', borderRadius: 4 }}
                                >
                                  <option value="Lán trại & Nấu ăn">Lán trại &amp; nấu ăn</option>
                                  <option value="Y tế & An toàn">Y tế &amp; an toàn</option>
                                  <option value="Nước & Thực phẩm">Nước &amp; thực phẩm</option>
                                  <option value="Dùng chung">Dùng chung</option>
                                </select>
                                <select
                                  className="form-input"
                                  value={editGearCarrierId}
                                  onChange={(e) => setEditGearCarrierId(e.target.value)}
                                  aria-label="Sửa người mang món đồ"
                                  disabled={isAnyGearMutating}
                                  style={{ padding: '6px 8px', fontSize: '0.76rem', borderRadius: 4 }}
                                >
                                  <option value="">Chưa ai nhận</option>
                                  {squadRoster.map((member) => (
                                    <option key={member.id} value={member.id}>
                                      {member.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                                <label
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    fontSize: '0.76rem',
                                    fontWeight: 700,
                                    color: 'var(--color-text-main)',
                                    cursor: isAnyGearMutating ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={editGearPacked}
                                    onChange={(e) => setEditGearPacked(e.target.checked)}
                                    disabled={isAnyGearMutating}
                                  />
                                  <span>Đã chuẩn bị sẵn sàng</span>
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <button
                                    type="button"
                                    disabled={isAnyGearMutating}
                                    onClick={() => setEditingGearId(null)}
                                    className="btn btn-outline"
                                    style={{ padding: '4px 9px', fontSize: '0.74rem', borderRadius: 4 }}
                                  >
                                    Hủy
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={isAnyGearMutating || !editGearName.trim()}
                                    className="btn btn-primary"
                                    style={{ padding: '4px 11px', fontSize: '0.74rem', fontWeight: 800, borderRadius: 4 }}
                                  >
                                    {isSavingGearEdit ? 'Đang lưu...' : 'Lưu'}
                                  </button>
                                </div>
                              </div>
                            </form>
                          ) : (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                                flexWrap: 'wrap',
                              }}
                            >
                              <button
                                type="button"
                                disabled={isAnyGearMutating}
                                onClick={() => handleToggleMatrixGearPacked(item)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 9,
                                  cursor: isAnyGearMutating ? 'wait' : 'pointer',
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
                                  disabled={isAnyGearMutating}
                                  onChange={(e) => handleAssignMatrixGearCarrier(item.id, e.target.value)}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '0.74rem',
                                    borderRadius: 4,
                                    maxWidth: 155,
                                    background: 'var(--color-bg-card)',
                                  }}
                                >
                                  <option value="">Chưa ai nhận</option>
                                  {squadRoster.map((member) => (
                                    <option key={member.id} value={member.id}>
                                      {member.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  disabled={isAnyGearMutating}
                                  onClick={() => handleStartEditGear(item)}
                                  aria-label={`Chỉnh sửa ${item.name}`}
                                  title="Chỉnh sửa món đồ"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--color-text-muted)',
                                    cursor: isAnyGearMutating ? 'wait' : 'pointer',
                                    padding: 4,
                                  }}
                                >
                                  <IconEdit size={14} />
                                </button>
                                {effectiveIsCreator && (
                                  <button
                                    type="button"
                                    disabled={isAnyGearMutating}
                                    onClick={() => handleDeleteMatrixGearItem(item.id)}
                                    aria-label={`Xóa ${item.name}`}
                                    title="Xóa món đồ"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--color-error-text, var(--banner-danger-text))',
                                      cursor: isAnyGearMutating ? 'wait' : 'pointer',
                                      padding: 4,
                                    }}
                                  >
                                    <IconTrash size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                        Tải đồ chung trên vai từng người
                      </span>
                      {gearLoadSummary.unassignedG > 0 && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-sun)', fontVariantNumeric: 'tabular-nums' }}>
                          Chưa có người nhận: {formatWeightKg(gearLoadSummary.unassignedG)} kg ({gearLoadSummary.unassignedItems.length} món)
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
                                    Hơi nặng vai (&gt;{gearLoadSummary.fairLoadThresholdPct}%)
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
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Summary KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: 12 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Tổng chi cả chuyến</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--color-primary)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                      {settlement.totalVnd.toLocaleString('vi-VN')} đ
                    </div>
                  </div>
                  <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 4, padding: 12 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      Chia đều mỗi người ({settlement.participantCount} người)
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
                    placeholder="VD: Thuê porter, vé vào rừng, xe khách..."
                    disabled={isAddingExpense}
                    style={{ flex: 2, minWidth: 180, fontSize: '0.84rem', borderRadius: 4 }}
                    required
                  />
                  <input
                    type="number"
                    min={MIN_EXPENSE_VND}
                    max={MAX_EXPENSE_VND}
                    step="1"
                    className="form-input"
                    value={newExpAmount}
                    onChange={(e) => setNewExpAmount(e.target.value)}
                    placeholder="Số tiền (VNĐ)"
                    disabled={isAddingExpense}
                    style={{ flex: 1, minWidth: 120, fontSize: '0.84rem', borderRadius: 4 }}
                    required
                  />
                  {effectiveIsCreator && confirmedRosterMembers.length > 1 && (
                    <select
                      className="form-input"
                      aria-label="Chọn người ứng tiền"
                      value={newExpPayerId}
                      onChange={(e) => setNewExpPayerId(e.target.value)}
                      disabled={isAddingExpense}
                      style={{ flex: 1, minWidth: 135, fontSize: '0.78rem', borderRadius: 4 }}
                    >
                      <option value="">Tôi đã ứng trước</option>
                      {confirmedRosterMembers.map((member) => (
                        <option key={member.id} value={member.rawId || ''}>
                          {member.name} đã ứng
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="submit"
                    disabled={isAddingExpense || !newExpTitle.trim() || !newExpAmount}
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '8px 14px', borderRadius: 4 }}
                  >
                    {isAddingExpense ? 'Đang lưu...' : '+ Thêm khoản chi'}
                  </button>
                </form>

                {expenses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, borderRadius: 4, border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                    Chưa ghi khoản chi nào — cứ nhập tiền xe, porter, đồ ăn vào đây rồi cuối chuyến chia gọn gàng nhé.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                    {expenses.map((exp) => {
                      const canManageExpense = Boolean(
                        effectiveIsCreator ||
                        (effectiveUserId && exp.paidByUserId && String(exp.paidByUserId) === effectiveUserId)
                      );
                      const isEditingThis = editingExpenseId === exp.id;

                      return (
                        <div
                          key={exp.id}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 4,
                            background: 'var(--color-bg-main)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          {isEditingThis ? (
                            <form
                              onSubmit={(e) => handleSaveEditExpense(e, exp.id)}
                              style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}
                            >
                              <input
                                className="form-input"
                                value={editExpTitle}
                                onChange={(e) => setEditExpTitle(e.target.value)}
                                disabled={isSavingExpense}
                                required
                                style={{ flex: 2, minWidth: 140, padding: '6px 9px', fontSize: '0.8rem', borderRadius: 4 }}
                              />
                              <input
                                type="number"
                                min={MIN_EXPENSE_VND}
                                max={MAX_EXPENSE_VND}
                                step="1"
                                className="form-input"
                                value={editExpAmount}
                                onChange={(e) => setEditExpAmount(e.target.value)}
                                disabled={isSavingExpense}
                                required
                                style={{ flex: 1, minWidth: 105, padding: '6px 9px', fontSize: '0.8rem', borderRadius: 4 }}
                              />
                              {effectiveIsCreator && confirmedRosterMembers.length > 1 && (
                                <select
                                  className="form-input"
                                  value={editExpPayerId}
                                  onChange={(e) => setEditExpPayerId(e.target.value)}
                                  disabled={isSavingExpense}
                                  style={{ minWidth: 120, padding: '6px 8px', fontSize: '0.76rem', borderRadius: 4 }}
                                >
                                  {confirmedRosterMembers.map((member) => (
                                    <option key={member.id} value={member.rawId || ''}>
                                      {member.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                              <button
                                type="submit"
                                disabled={isSavingExpense}
                                className="btn btn-primary"
                                style={{ padding: '5px 10px', fontSize: '0.74rem', borderRadius: 4, fontWeight: 700 }}
                              >
                                {isSavingExpense ? 'Lưu...' : 'Lưu'}
                              </button>
                              <button
                                type="button"
                                disabled={isSavingExpense}
                                onClick={() => setEditingExpenseId(null)}
                                className="btn btn-outline"
                                style={{ padding: '5px 8px', fontSize: '0.74rem', borderRadius: 4 }}
                              >
                                Hủy
                              </button>
                            </form>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                              <div>
                                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{exp.title}</div>
                                <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)' }}>
                                  Đã ứng: <strong>{exp.paidByName}</strong>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <strong style={{ color: 'var(--color-earth)', fontSize: '0.88rem', fontVariantNumeric: 'tabular-nums' }}>
                                  {Number(exp.amountVnd).toLocaleString('vi-VN')} đ
                                </strong>
                                {canManageExpense && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditExpense(exp)}
                                      aria-label="Sửa khoản chi"
                                      title="Chỉnh sửa khoản chi"
                                      style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4 }}
                                    >
                                      <IconEdit size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={deletingExpenseId === exp.id}
                                      onClick={() => handleDeleteExpense(exp.id)}
                                      aria-label="Xóa khoản chi"
                                      title="Xóa khoản chi"
                                      style={{ background: 'none', border: 'none', color: 'var(--color-error-text, var(--color-error))', cursor: deletingExpenseId === exp.id ? 'wait' : 'pointer', padding: 4 }}
                                    >
                                      <IconTrash size={15} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                    {/* Settlement Header + 1-Click Share Export */}
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
                          Ai chuyển ai cho gọn
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
                            ? 'Đã chia đều'
                            : `Gọn ${settlement.transfers.length} lượt chuyển`}
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
                        <span>{copiedSettlement ? 'Đã chép xong!' : 'Chép gửi nhóm chat'}</span>
                      </button>
                    </div>

                    {/* Minimal Transfer Matrix with Cloud-Synced Settled Toggle */}
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
                        <span>Cả đoàn đã chia đều xong xuôi — không ai cần chuyển thêm nữa!</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {settlement.transfers.map((transfer, idx) => {
                          const isTransferSettled = settledTransfers.includes(transfer.key);
                          const isTogglingThis = togglingSettlementKey === transfer.key;

                          return (
                            <div
                              key={`${transfer.key}-${idx}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                flexWrap: 'wrap',
                                padding: '9px 12px',
                                borderRadius: 4,
                                background: isTransferSettled
                                  ? 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-card))'
                                  : 'var(--color-bg-card)',
                                border: isTransferSettled
                                  ? '1px solid color-mix(in srgb, var(--color-primary) 42%, var(--color-border))'
                                  : '1px solid var(--color-border)',
                                opacity: isTogglingThis ? 0.7 : 1,
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

                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <strong
                                  style={{
                                    fontSize: '0.88rem',
                                    fontWeight: 900,
                                    color: isTransferSettled ? 'var(--color-text-muted)' : 'var(--color-earth)',
                                    textDecoration: isTransferSettled ? 'line-through' : 'none',
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                >
                                  {transfer.amountVnd.toLocaleString('vi-VN')} đ
                                </strong>
                                <button
                                  type="button"
                                  disabled={Boolean(togglingSettlementKey)}
                                  onClick={() => handleToggleSettlement(transfer.key)}
                                  className="btn btn-outline"
                                  style={{
                                    padding: '3px 9px',
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    borderRadius: 4,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    background: isTransferSettled
                                      ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)'
                                      : 'transparent',
                                    borderColor: isTransferSettled ? 'var(--color-primary)' : 'var(--color-border-strong)',
                                    color: isTransferSettled ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                  }}
                                >
                                  {isTransferSettled && <IconCheck size={12} color="var(--color-primary)" />}
                                  <span>{isTransferSettled ? 'Đã chuyển' : 'Đánh dấu đã chuyển'}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
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
                        Tổng kết từng người ({settlement.participantCount} thành viên chia tiền)
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
                                  (đã ứng {member.paidVnd.toLocaleString('vi-VN')} đ
                                  {member.isDeparted ? ' • hoàn lại 100%' : ''})
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
                                    ? `Chuyển thêm ${Math.abs(member.balanceVnd).toLocaleString('vi-VN')} đ`
                                    : 'Vừa đủ'}
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

      {inspectedAuthor && (
        <AuthorProfileModal
          author={inspectedAuthor}
          currentUser={currentUser}
          onClose={() => setInspectedAuthor(null)}
          onStartChat={() => {
            setInspectedAuthor(null);
            onClose();
            window.history.pushState({ view: 'messages' }, '', '/messages');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
        />
      )}
    </div>,
    document.body
  );
};
