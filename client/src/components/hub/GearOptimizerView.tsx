import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Trail, User } from '../../types.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import { safeLocalStorageGet, scopedStorageKey } from '../../utils/storageScope.js';
import { queueAiAssistantPrompt } from '../../services/aiAssistant.service.js';
import {
  IconArrowLeft,
  IconBackpack,
  IconBot,
  IconCheck,
  IconCheckCircle,
  IconClock,
  IconCloud,
  IconCopy,
  IconEdit,
  IconPlus,
  IconRotateCw,
  IconScale,
  IconShare,
  IconShieldCheck,
  IconSparkles,
  IconTrash,
  IconX,
} from '../common/SvgIcons.js';

function copyTextViaExecCommand(text: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export interface GearOptimizerViewProps {
  trails: Trail[];
  currentUser?: User | null;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onBack?: () => void;
}

type GearCategoryId = 'shelter' | 'clothing' | 'kitchen' | 'safety' | 'food' | 'personal';
type CarryType = 'base' | 'worn' | 'consumable';

interface GearItem {
  id: string;
  name: string;
  category: GearCategoryId;
  weightG: number;
  qty: number;
  carryType: CarryType;
  packed: boolean;
}

interface PackList {
  id: string;
  cloudId?: string;
  shareSlug?: string;
  isPublic?: boolean;
  updatedAt?: string;
  name: string;
  subtitle: string;
  targetTrailId?: string;
  items: GearItem[];
}

interface ServerGearPackItem {
  id?: string;
  name?: string;
  category?: string;
  weightGrams?: number;
  quantity?: number;
  worn?: boolean;
  consumable?: boolean;
  packed?: boolean;
}

interface ServerGearPack {
  _id: string;
  shareSlug?: string;
  name: string;
  trailSlug?: string;
  bodyWeightKg?: number;
  items?: ServerGearPackItem[];
  isPublic?: boolean;
  updatedAt?: string;
}

const VALID_CATEGORY_IDS = new Set<GearCategoryId>([
  'shelter',
  'clothing',
  'kitchen',
  'safety',
  'food',
  'personal',
]);

function normalizeServerCategory(raw?: string): GearCategoryId {
  const val = String(raw || '').trim().toLowerCase();
  if (VALID_CATEGORY_IDS.has(val as GearCategoryId)) return val as GearCategoryId;
  if (val.includes('trú') || val.includes('ngủ') || val.includes('lều')) return 'shelter';
  if (val.includes('phục') || val.includes('áo') || val.includes('ấm')) return 'clothing';
  if (val.includes('bếp') || val.includes('nước')) return 'kitchen';
  if (val.includes('an toàn') || val.includes('định vị') || val.includes('y tế')) return 'safety';
  if (val.includes('thực phẩm') || val.includes('ăn') || val.includes('điện giải')) return 'food';
  return 'personal';
}

function toServerGearItems(items: GearItem[]): ServerGearPackItem[] {
  return items.slice(0, 120).map((it) => ({
    id: it.id,
    name: it.name.trim(),
    category: it.category,
    weightGrams: Math.max(0, Math.min(50000, Math.round(it.weightG))),
    quantity: Math.max(1, Math.min(99, Math.round(it.qty))),
    worn: it.carryType === 'worn',
    consumable: it.carryType === 'consumable',
    packed: it.packed !== false,
  }));
}

function fromServerGearPack(pack: ServerGearPack): PackList {
  const items: GearItem[] = Array.isArray(pack.items)
    ? pack.items.map((it, idx) => ({
        id: it.id || `cloud-${pack._id}-${idx}`,
        name: String(it.name || 'Vật dụng').trim(),
        category: normalizeServerCategory(it.category),
        weightG: Math.max(0, Math.round(Number(it.weightGrams) || 0)),
        qty: Math.max(1, Math.min(99, Math.round(Number(it.quantity) || 1))),
        carryType: it.worn ? 'worn' : it.consumable ? 'consumable' : 'base',
        packed: it.packed !== false,
      }))
    : [];

  return {
    id: `cloud-${pack._id}`,
    cloudId: String(pack._id),
    shareSlug: pack.shareSlug,
    isPublic: pack.isPublic !== false,
    updatedAt: pack.updatedAt,
    name: pack.name || 'Danh sách balo đã lưu',
    subtitle: pack.shareSlug
      ? `Đã lưu trên tài khoản • Mã chia sẻ: ${pack.shareSlug}`
      : 'Đã lưu trên tài khoản LOST',
    targetTrailId: pack.trailSlug || undefined,
    items,
  };
}

interface StoredGearState {
  version: number;
  activeListId: string;
  bodyWeightKg: number;
  lists: PackList[];
}

const STORAGE_KEY = 'lost_gear_optimizer_v1';

const CATEGORIES: Array<{
  id: GearCategoryId;
  label: string;
  color: string;
}> = [
  { id: 'shelter', label: 'Lều & đồ ngủ', color: 'var(--color-primary)' },
  { id: 'clothing', label: 'Quần áo & giữ ấm', color: 'var(--color-sky)' },
  { id: 'kitchen', label: 'Bếp & nước uống', color: 'var(--color-stream)' },
  { id: 'safety', label: 'An toàn & định vị', color: 'var(--color-error-text, var(--color-error))' },
  { id: 'food', label: 'Đồ ăn & điện giải', color: 'var(--color-sun)' },
  { id: 'personal', label: 'Đồ cá nhân', color: 'var(--color-earth)' },
];

const CATEGORY_MAP: Record<GearCategoryId, { label: string; color: string }> = {
  shelter: { label: 'Lều & đồ ngủ', color: 'var(--color-primary)' },
  clothing: { label: 'Quần áo & giữ ấm', color: 'var(--color-sky)' },
  kitchen: { label: 'Bếp & nước uống', color: 'var(--color-stream)' },
  safety: { label: 'An toàn & định vị', color: 'var(--color-error-text, var(--color-error))' },
  food: { label: 'Đồ ăn & điện giải', color: 'var(--color-sun)' },
  personal: { label: 'Đồ cá nhân', color: 'var(--color-earth)' },
};

const CARRY_TYPE_META: Record<CarryType, { label: string; shortLabel: string; color: string }> = {
  base: { label: 'Đồ cố định trong balo', shortLabel: 'Cố định', color: 'var(--color-primary)' },
  consumable: { label: 'Đồ ăn nước uống (giảm dần)', shortLabel: 'Ăn & uống', color: 'var(--color-sun)' },
  worn: { label: 'Mặc trên người', shortLabel: 'Mặc người', color: 'var(--color-sky)' },
};

function createDefaultPresets(): PackList[] {
  return [
    {
      id: 'preset-dayhike',
      name: 'Balo đi trong ngày (<5kg)',
      subtitle: 'Gọn nhẹ cho Núi Dinh, Chứa Chan, Bạch Mã, VQG Cát Tiên sáng đi chiều về',
      items: [
        { id: 'd-1', name: 'Balo Daypack 22L chống thấm nhẹ', category: 'shelter', weightG: 520, qty: 1, carryType: 'base', packed: true },
        { id: 'd-2', name: 'Áo mưa bộ siêu nhẹ gấp gọn', category: 'clothing', weightG: 210, qty: 1, carryType: 'base', packed: true },
        { id: 'd-3', name: 'Giày trail / trekking bám đá', category: 'clothing', weightG: 760, qty: 1, carryType: 'worn', packed: true },
        { id: 'd-4', name: 'Áo thun nhanh khô & quần trekking', category: 'clothing', weightG: 340, qty: 1, carryType: 'worn', packed: true },
        { id: 'd-5', name: 'Mũ chống nắng & khăn đa năng', category: 'clothing', weightG: 95, qty: 1, carryType: 'worn', packed: true },
        { id: 'd-6', name: 'Gậy trekking carbon (1 cặp)', category: 'safety', weightG: 380, qty: 1, carryType: 'base', packed: true },
        { id: 'd-7', name: 'Bình nước mềm + 1.5L nước lọc', category: 'kitchen', weightG: 1620, qty: 1, carryType: 'consumable', packed: true },
        { id: 'd-8', name: 'Bữa trưa gọn + thanh năng lượng + điện giải', category: 'food', weightG: 480, qty: 1, carryType: 'consumable', packed: true },
        { id: 'd-9', name: 'Đèn pin đội đầu dự phòng', category: 'safety', weightG: 110, qty: 1, carryType: 'base', packed: true },
        { id: 'd-10', name: 'Bộ sơ cứu mini, băng gạc & còi SOS', category: 'safety', weightG: 175, qty: 1, carryType: 'base', packed: true },
        { id: 'd-11', name: 'Sạc dự phòng 10.000mAh & cáp', category: 'personal', weightG: 215, qty: 1, carryType: 'base', packed: true },
        { id: 'd-12', name: 'Xịt chống vắt/muỗi & kem chống nắng', category: 'personal', weightG: 120, qty: 1, carryType: 'consumable', packed: true },
      ],
    },
    {
      id: 'preset-cloud-2d1n',
      name: 'Balo 2N1Đ săn mây Tây Bắc (9–11kg)',
      subtitle: 'Vừa vặn cho Lảo Thẩn, Tà Xùa, Tà Chì Nhù, Lùng Cúng ngủ lán tầm 2.400m',
      items: [
        { id: 'c-1', name: 'Balo trekking 45L khung trợ lực + bọc mưa', category: 'shelter', weightG: 1380, qty: 1, carryType: 'base', packed: true },
        { id: 'c-2', name: 'Túi ngủ chịu lạnh 0°C – 5°C', category: 'shelter', weightG: 1150, qty: 1, carryType: 'base', packed: true },
        { id: 'c-3', name: 'Tấm cách nhiệt lót lưng gấp gọn', category: 'shelter', weightG: 360, qty: 1, carryType: 'base', packed: true },
        { id: 'c-4', name: 'Áo khoác gió chống thấm 3 lớp (Shell)', category: 'clothing', weightG: 460, qty: 1, carryType: 'base', packed: true },
        { id: 'c-5', name: 'Áo phao lông vũ giữ ấm tại lán & đỉnh', category: 'clothing', weightG: 380, qty: 1, carryType: 'base', packed: true },
        { id: 'c-6', name: 'Bộ quần áo giữ nhiệt ngủ đêm + tất len Merino', category: 'clothing', weightG: 420, qty: 1, carryType: 'base', packed: true },
        { id: 'c-7', name: 'Giày trekking cổ cao chống nước', category: 'clothing', weightG: 980, qty: 1, carryType: 'worn', packed: true },
        { id: 'c-8', name: 'Trang phục leo núi ban ngày (mặc trên người)', category: 'clothing', weightG: 460, qty: 1, carryType: 'worn', packed: true },
        { id: 'c-9', name: 'Bình giữ nhiệt 750ml + 2L nước mang theo', category: 'kitchen', weightG: 2420, qty: 1, carryType: 'consumable', packed: true },
        { id: 'c-10', name: 'Cốc titan & bộ thìa dĩa gọn nhẹ', category: 'kitchen', weightG: 135, qty: 1, carryType: 'base', packed: true },
        { id: 'c-11', name: 'Thực phẩm 2 ngày, lương khô, gel & 4 gói điện giải', category: 'food', weightG: 1050, qty: 1, carryType: 'consumable', packed: true },
        { id: 'c-12', name: 'Đèn pin đội đầu 350 lumen + pin dự phòng', category: 'safety', weightG: 185, qty: 1, carryType: 'base', packed: true },
        { id: 'c-13', name: 'Gậy trekking carbon (1 cặp)', category: 'safety', weightG: 410, qty: 1, carryType: 'base', packed: true },
        { id: 'c-14', name: 'Bộ sơ cứu, chăn giữ nhiệt cứu hộ, còi & bật lửa', category: 'safety', weightG: 280, qty: 1, carryType: 'base', packed: true },
        { id: 'c-15', name: 'Sạc dự phòng 20.000mAh & túi chống nước CCCD', category: 'personal', weightG: 420, qty: 1, carryType: 'base', packed: true },
        { id: 'c-16', name: 'Găng tay giữ ấm, mũ len & vệ sinh cá nhân', category: 'personal', weightG: 290, qty: 1, carryType: 'base', packed: true },
      ],
    },
    {
      id: 'preset-alpine-3d2n',
      name: 'Balo 3N2Đ đỉnh trên 3.000m mùa lạnh',
      subtitle: 'Đủ ấm và tự chủ cho Fansipan, Pu Si Lung, Pu Ta Leng, Kỳ Quan San',
      items: [
        { id: 'a-1', name: 'Balo thám hiểm 60L + bọc chống mưa', category: 'shelter', weightG: 1680, qty: 1, carryType: 'base', packed: true },
        { id: 'a-2', name: 'Lều 2 người 3–4 mùa (chia đoàn 1/2 trọng lượng)', category: 'shelter', weightG: 1250, qty: 1, carryType: 'base', packed: true },
        { id: 'a-3', name: 'Túi ngủ lông vũ chịu lạnh -5°C', category: 'shelter', weightG: 1380, qty: 1, carryType: 'base', packed: true },
        { id: 'a-4', name: 'Đệm hơi cách nhiệt R-Value >= 3.5', category: 'shelter', weightG: 490, qty: 1, carryType: 'base', packed: true },
        { id: 'a-5', name: 'Áo khoác chống gió bão Gore-Tex 3 lớp', category: 'clothing', weightG: 520, qty: 1, carryType: 'base', packed: true },
        { id: 'a-6', name: 'Áo lông vũ dày 800FP + lớp nỉ giữ nhiệt giữa', category: 'clothing', weightG: 740, qty: 1, carryType: 'base', packed: true },
        { id: 'a-7', name: 'Đồ giữ nhiệt 2 bộ + tất len + găng chống nước', category: 'clothing', weightG: 620, qty: 1, carryType: 'base', packed: true },
        { id: 'a-8', name: 'Giày trekking đế Vibram + xà cạp chống vắt', category: 'clothing', weightG: 1220, qty: 1, carryType: 'worn', packed: true },
        { id: 'a-9', name: 'Bếp gas dã ngoại + bình gas mini + nồi titan', category: 'kitchen', weightG: 680, qty: 1, carryType: 'base', packed: true },
        { id: 'a-10', name: 'Bộ lọc nước suối Sawyer + túi đựng nước 2.5L', category: 'kitchen', weightG: 2680, qty: 1, carryType: 'consumable', packed: true },
        { id: 'a-11', name: 'Thực phẩm sấy khô 3 ngày + gel năng lượng + điện giải', category: 'food', weightG: 1750, qty: 1, carryType: 'consumable', packed: true },
        { id: 'a-12', name: 'Đèn pin đội đầu + la bàn + bản đồ giấy/GPS dự phòng', category: 'safety', weightG: 310, qty: 1, carryType: 'base', packed: true },
        { id: 'a-13', name: 'Bộ sơ cứu mở rộng, băng nẹp, thuốc giảm đau & tiêu hóa', category: 'safety', weightG: 380, qty: 1, carryType: 'base', packed: true },
        { id: 'a-14', name: 'Gậy trekking 2 chiếc + dây paracord 10m', category: 'safety', weightG: 490, qty: 1, carryType: 'base', packed: true },
        { id: 'a-15', name: 'Sạc dự phòng 20.000mAh + túi chống nước giấy phép biên giới', category: 'personal', weightG: 440, qty: 1, carryType: 'base', packed: true },
        { id: 'a-16', name: 'Túi đựng rác LNT, bàn chải & đồ cá nhân gọn nhẹ', category: 'personal', weightG: 240, qty: 1, carryType: 'base', packed: true },
      ],
    },
  ];
}

function loadStoredState(storageKey: string): StoredGearState {
  const defaults = createDefaultPresets();
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.lists) && parsed.lists.length > 0) {
        const activeValid = parsed.lists.some((l: PackList) => l.id === parsed.activeListId);
        return {
          version: 1,
          activeListId: activeValid ? parsed.activeListId : parsed.lists[0].id,
          bodyWeightKg:
            typeof parsed.bodyWeightKg === 'number' && parsed.bodyWeightKg >= 35 && parsed.bodyWeightKg <= 140
              ? parsed.bodyWeightKg
              : 62,
          lists: parsed.lists,
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return {
    version: 1,
    activeListId: defaults[1].id,
    bodyWeightKg: 62,
    lists: defaults,
  };
}

function formatKg(grams: number): string {
  return (grams / 1000).toFixed(2);
}

export const GearOptimizerView: React.FC<GearOptimizerViewProps> = (props) => {
  const userKey = String(props.currentUser?.id || (props.currentUser as (User & { _id?: string }) | null)?._id || 'guest');
  return <GearOptimizerViewInner key={userKey} {...props} />;
};

const GearOptimizerViewInner: React.FC<GearOptimizerViewProps> = ({
  trails,
  currentUser,
  onShowToast,
  onBack,
}) => {
  const currentUserId = String(currentUser?.id || (currentUser as (User & { _id?: string }) | null)?._id || '');
  const storageKey = useMemo(() => scopedStorageKey(STORAGE_KEY, currentUserId || null), [currentUserId]);
  const [state, setState] = useState<StoredGearState>(() => loadStoredState(scopedStorageKey(STORAGE_KEY, currentUserId || null)));
  const [selectedTrailId, setSelectedTrailId] = useState<string>(() => {
    const initial = loadStoredState(scopedStorageKey(STORAGE_KEY, currentUserId || null));
    const initActive = initial.lists.find((l) => l.id === initial.activeListId) || initial.lists[0];
    if (initActive?.targetTrailId && trails.some((t) => t.id === initActive.targetTrailId)) {
      return initActive.targetTrailId;
    }
    return trails[0]?.id || 'trail-fansipan';
  });
  const [bodyWeightInput, setBodyWeightInput] = useState<string>(() => String(state.bodyWeightKg || 62));
  const [hoveredCat, setHoveredCat] = useState<GearCategoryId | null>(null);
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [isDeletingCloud, setIsDeletingCloud] = useState(false);
  const cloudSyncedCount = useMemo(
    () => state.lists.filter((l) => Boolean(l.cloudId)).length,
    [state.lists]
  );

  // Rename, delete & inline item edit state (no native browser dialogs)
  const [isRenamingList, setIsRenamingList] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteList, setConfirmDeleteList] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemWeightG, setEditItemWeightG] = useState('250');
  const [editItemCat, setEditItemCat] = useState<GearCategoryId>('shelter');

  // New custom item form
  const [newItemName, setNewItemName] = useState('');
  const [newItemCat, setNewItemCat] = useState<GearCategoryId>('shelter');
  const [newItemGrams, setNewItemGrams] = useState('250');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemCarry, setNewItemCarry] = useState<CarryType>('base');

  const activeListIdRef = useRef<string>(state.activeListId);
  useEffect(() => {
    activeListIdRef.current = state.activeListId;
  }, [state.activeListId]);

  const trailsRef = useRef<Trail[]>(trails);
  useEffect(() => {
    trailsRef.current = trails;
  }, [trails]);

  // Persist automatically to per-user scoped localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }, [state, storageKey]);

  // Hydrate cloud-synced GearPacks for logged-in user (GET /api/gear-packs/me) + optional ?pack=<shareSlug>
  useEffect(() => {
    const controller = new AbortController();
    const token = safeLocalStorageGet('lost_token');
    const sharedSlug = new URLSearchParams(window.location.search).get('pack')?.trim();

    if (currentUserId || token) {
      fetch('/api/gear-packs/me', {
        headers: getApiHeaders(),
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (controller.signal.aborted) return;
          if (json?.success && Array.isArray(json.data) && json.data.length > 0) {
            const cloudLists = (json.data as ServerGearPack[]).map(fromServerGearPack);
            const currentActiveId = activeListIdRef.current;
            const matchedCloudForActive =
              cloudLists.find((c) => c.id === currentActiveId) || cloudLists[0];
            if (
              matchedCloudForActive?.targetTrailId &&
              trailsRef.current.some((t) => t.id === matchedCloudForActive.targetTrailId)
            ) {
              setSelectedTrailId(matchedCloudForActive.targetTrailId);
            }
            setState((prev) => {
              const cloudById = new Map(cloudLists.map((c) => [c.cloudId, c]));
              const updatedLocal = prev.lists.map((localList) => {
                if (localList.cloudId && cloudById.has(localList.cloudId)) {
                  const matched = cloudById.get(localList.cloudId)!;
                  cloudById.delete(localList.cloudId);
                  return { ...matched, id: localList.id };
                }
                return localList;
              });
              const remainingCloud = Array.from(cloudById.values());
              const merged = [...remainingCloud, ...updatedLocal];
              const nextActiveId = prev.activeListId || merged[0].id;
              return {
                ...prev,
                lists: merged,
                activeListId: nextActiveId,
              };
            });
          }
        })
        .catch(() => {
          // Graceful offline fallback to localStorage presets
        });
    }

    if (sharedSlug) {
      fetch(`/api/gear-packs/share/${encodeURIComponent(sharedSlug)}`, {
        headers: getApiHeaders(),
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (controller.signal.aborted) return;
          if (json?.success && json.data) {
            const sharedPack = fromServerGearPack(json.data as ServerGearPack);
            const sharedListId = `shared-${sharedPack.shareSlug || sharedSlug}`;
            const imported: PackList = {
              ...sharedPack,
              id: sharedListId,
              cloudId: undefined, // read-only import unless user saves their own copy
              subtitle: `Balo được chia sẻ qua liên kết • ${sharedPack.shareSlug || sharedSlug}`,
            };
            setState((prev) => {
              const exists = prev.lists.some((l) => l.id === sharedListId);
              return {
                ...prev,
                activeListId: sharedListId,
                bodyWeightKg:
                  typeof json.data.bodyWeightKg === 'number' && json.data.bodyWeightKg >= 35 && json.data.bodyWeightKg <= 140
                    ? json.data.bodyWeightKg
                    : prev.bodyWeightKg,
                lists: exists
                  ? prev.lists.map((l) => (l.id === sharedListId ? imported : l))
                  : [imported, ...prev.lists],
              };
            });
            if (sharedPack.targetTrailId) {
              setSelectedTrailId(sharedPack.targetTrailId);
            }
          }
        })
        .catch(() => {
          // Ignore invalid or offline share links
        });
    }

    return () => controller.abort();
  }, [currentUserId]);

  const activeList = useMemo(
    () => state.lists.find((l) => l.id === state.activeListId) || state.lists[0],
    [state.lists, state.activeListId]
  );

  const selectedTrail = useMemo(
    () => trails.find((t) => t.id === selectedTrailId) || trails[0] || null,
    [trails, selectedTrailId]
  );

  const notify = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onShowToast) onShowToast(msg, type);
    else window.dispatchEvent(new CustomEvent('lost:show-toast', { detail: { message: msg, type } }));
  };

  // Weight telemetry calculation
  const metrics = useMemo(() => {
    let baseG = 0;
    let consumableG = 0;
    let wornG = 0;
    const byCategoryG: Record<GearCategoryId, number> = {
      shelter: 0,
      clothing: 0,
      kitchen: 0,
      safety: 0,
      food: 0,
      personal: 0,
    };

    const packedItems = activeList.items.filter((i) => i.packed);
    packedItems.forEach((item) => {
      const totalItemG = Math.max(0, Number(item.weightG) || 0) * Math.max(1, Number(item.qty) || 1);
      if (item.carryType === 'worn') {
        wornG += totalItemG;
      } else if (item.carryType === 'consumable') {
        consumableG += totalItemG;
        byCategoryG[item.category] += totalItemG;
      } else {
        baseG += totalItemG;
        byCategoryG[item.category] += totalItemG;
      }
    });

    const totalCarryG = baseG + consumableG;
    const totalSkinOutG = totalCarryG + wornG;
    const bodyWeightKg = Math.max(35, Math.min(140, state.bodyWeightKg || 62));
    const ratioPercent = Number(((totalCarryG / 1000 / bodyWeightKg) * 100).toFixed(1));

    let ratioStatus: 'optimal' | 'caution' | 'overload' = 'optimal';
    let ratioLabel = 'Nhẹ nhàng (<=18%)';
    let ratioColor = 'var(--color-primary)';
    if (ratioPercent > 22) {
      ratioStatus = 'overload';
      ratioLabel = 'Quá tải (>22%)';
      ratioColor = 'var(--color-error-text, var(--color-error))';
    } else if (ratioPercent > 18) {
      ratioStatus = 'caution';
      ratioLabel = 'Hơi nặng vai (18–22%)';
      ratioColor = 'var(--color-sun)';
    }

    const segments = CATEGORIES.map((cat) => {
      const grams = byCategoryG[cat.id];
      const pct = totalCarryG > 0 ? (grams / totalCarryG) * 100 : 0;
      return { ...cat, grams, pct };
    }).filter((s) => s.grams > 0);

    return {
      baseG,
      consumableG,
      wornG,
      totalCarryG,
      totalSkinOutG,
      packedCount: packedItems.length,
      totalItems: activeList.items.length,
      ratioPercent,
      ratioStatus,
      ratioLabel,
      ratioColor,
      segments,
    };
  }, [activeList, state.bodyWeightKg]);

  const updateActiveList = (updater: (list: PackList) => PackList) => {
    setState((prev) => ({
      ...prev,
      lists: prev.lists.map((l) => (l.id === prev.activeListId ? updater(l) : l)),
    }));
  };

  const handleToggleItemPacked = (itemId: string) => {
    updateActiveList((list) => ({
      ...list,
      items: list.items.map((item) => (item.id === itemId ? { ...item, packed: !item.packed } : item)),
    }));
  };

  const handleStepQty = (itemId: string, delta: number) => {
    updateActiveList((list) => ({
      ...list,
      items: list.items.map((item) =>
        item.id === itemId ? { ...item, qty: Math.max(1, Math.min(20, item.qty + delta)) } : item
      ),
    }));
  };

  const handleCycleCarryType = (itemId: string, nextType: CarryType) => {
    updateActiveList((list) => ({
      ...list,
      items: list.items.map((item) => (item.id === itemId ? { ...item, carryType: nextType } : item)),
    }));
  };

  const handleDeleteItem = (itemId: string) => {
    if (editingItemId === itemId) setEditingItemId(null);
    updateActiveList((list) => ({
      ...list,
      items: list.items.filter((item) => item.id !== itemId),
    }));
  };

  const handleStartEditItem = (item: GearItem) => {
    setEditingItemId(item.id);
    setEditItemName(item.name);
    setEditItemWeightG(String(item.weightG));
    setEditItemCat(item.category);
  };

  const handleSaveEditItem = (itemId: string) => {
    const cleanName = editItemName.trim().slice(0, 140);
    const weightNum = Math.round(Number(editItemWeightG));
    if (!cleanName || !Number.isFinite(weightNum) || weightNum < 0) {
      notify('Nhập tên món đồ và cân nặng (>= 0g) trước khi lưu nhé.', 'error');
      return;
    }
    updateActiveList((list) => ({
      ...list,
      items: list.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              name: cleanName,
              weightG: Math.min(50000, weightNum),
              category: editItemCat,
            }
          : item
      ),
    }));
    setEditingItemId(null);
    notify(`Đã cập nhật "${cleanName}" (${weightNum}g).`, 'success');
  };

  const handleTogglePackVisibility = async () => {
    const nextPublic = activeList.isPublic === false;
    updateActiveList((list) => ({ ...list, isPublic: nextPublic }));
    const token = safeLocalStorageGet('lost_token');
    if (activeList.cloudId && (currentUser || token)) {
      try {
        const res = await fetch(`/api/gear-packs/${encodeURIComponent(activeList.cloudId)}`, {
          method: 'PUT',
          headers: getApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ isPublic: nextPublic }),
        });
        if (res.ok) {
          notify(
            nextPublic
              ? 'Đã mở công khai — bạn có thể gửi link balo này cho bạn đồng hành.'
              : 'Đã chuyển về riêng tư — chỉ mình bạn thấy danh sách này.',
            'success'
          );
          return;
        }
      } catch {
        // local toggle already applied
      }
    }
    notify(
      nextPublic ? 'Đang để công khai (sẽ cập nhật khi lưu lên tài khoản).' : 'Đang để riêng tư.',
      'info'
    );
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newItemName.trim();
    const weightNum = Math.round(Number(newItemGrams));
    const qtyNum = Math.max(1, Math.min(20, Math.round(Number(newItemQty)) || 1));
    if (!cleanName || !Number.isFinite(weightNum) || weightNum <= 0) {
      notify('Nhập tên món đồ và cân nặng lớn hơn 0g nhé.', 'error');
      return;
    }

    const newItem: GearItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      category: newItemCat,
      weightG: Math.min(25000, weightNum),
      qty: qtyNum,
      carryType: newItemCarry,
      packed: true,
    };

    updateActiveList((list) => ({
      ...list,
      items: [...list.items, newItem],
    }));
    setNewItemName('');
    setNewItemGrams('250');
    setNewItemQty('1');
    notify(`Đã cho "${cleanName}" (${weightNum}g) vào balo.`, 'success');
  };

  const handleCreateCustomList = () => {
    const newId = `custom-${Date.now()}`;
    const newList: PackList = {
      id: newId,
      name: `Balo riêng #${state.lists.length + 1}`,
      subtitle: 'Danh sách đồ bạn tự sắp cho chuyến đi sắp tới',
      items: [
        { id: `init-${Date.now()}-1`, name: 'Balo trekking chính', category: 'shelter', weightG: 1200, qty: 1, carryType: 'base', packed: true },
        { id: `init-${Date.now()}-2`, name: 'Nước uống 2L', category: 'kitchen', weightG: 2000, qty: 1, carryType: 'consumable', packed: true },
        { id: `init-${Date.now()}-3`, name: 'Bộ sơ cứu & đèn pin', category: 'safety', weightG: 320, qty: 1, carryType: 'base', packed: true },
      ],
    };
    setState((prev) => ({
      ...prev,
      activeListId: newId,
      lists: [...prev.lists, newList],
    }));
    setConfirmDeleteList(false);
    setIsRenamingList(false);
    notify('Đã tạo danh sách balo mới.', 'success');
  };

  const handleDuplicateList = () => {
    const newId = `copy-${Date.now()}`;
    const cloned: PackList = {
      ...activeList,
      id: newId,
      cloudId: undefined,
      shareSlug: undefined,
      updatedAt: undefined,
      name: `${activeList.name} (bản sao)`,
      items: activeList.items.map((it, idx) => ({ ...it, id: `${newId}-${idx}` })),
    };
    setState((prev) => ({
      ...prev,
      activeListId: newId,
      lists: [...prev.lists, cloned],
    }));
    notify('Đã nhân bản thêm một danh sách balo.', 'success');
  };

  const handleSaveRename = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = renameDraft.trim().slice(0, 80);
    if (cleanName.length < 2) {
      notify('Đặt tên balo dài ít nhất 2 ký tự nhé.', 'error');
      return;
    }
    updateActiveList((list) => ({ ...list, name: cleanName }));
    setIsRenamingList(false);

    const token = safeLocalStorageGet('lost_token');
    if (activeList.cloudId && (currentUser || token)) {
      try {
        const res = await fetch(`/api/gear-packs/${encodeURIComponent(activeList.cloudId)}`, {
          method: 'PUT',
          headers: getApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ name: cleanName }),
        });
        if (res.ok) {
          notify('Đã đổi tên balo và lưu lại.', 'success');
          return;
        }
      } catch {
        // local rename already persisted
      }
    }
    notify('Đã đổi tên danh sách balo.', 'success');
  };

  const handleDeleteCurrentList = async () => {
    if (isDeletingCloud) return;
    if (state.lists.length <= 1) {
      notify('Giữ lại ít nhất 1 danh sách balo nhé.', 'info');
      setConfirmDeleteList(false);
      return;
    }

    const deletingId = activeList.id;
    const targetCloudId = activeList.cloudId;
    const token = safeLocalStorageGet('lost_token');
    if (targetCloudId && (currentUser || token)) {
      setIsDeletingCloud(true);
      try {
        const res = await fetch(`/api/gear-packs/${encodeURIComponent(targetCloudId)}`, {
          method: 'DELETE',
          headers: getApiHeaders(),
        });
        if (!res.ok && res.status !== 404) {
          const errJson = await res.json().catch(() => null);
          notify(errJson?.message || 'Không thể xóa danh sách balo trên máy chủ lúc này.', 'error');
          setConfirmDeleteList(false);
          return;
        }
      } catch {
        notify('Mất kết nối máy chủ — chưa xóa được danh sách balo trên tài khoản.', 'error');
        setConfirmDeleteList(false);
        return;
      } finally {
        setIsDeletingCloud(false);
      }
    }

    const fallbackNextList = state.lists.find((l) => l.id !== deletingId);
    setState((prev) => {
      const remaining = prev.lists.filter((l) => l.id !== deletingId);
      if (remaining.length === 0) return prev;
      return {
        ...prev,
        activeListId: remaining[0].id,
        lists: remaining,
      };
    });
    if (fallbackNextList?.targetTrailId && trails.some((t) => t.id === fallbackNextList.targetTrailId)) {
      setSelectedTrailId(fallbackNextList.targetTrailId);
    }
    setConfirmDeleteList(false);
    notify(
      targetCloudId ? 'Đã xóa danh sách balo khỏi tài khoản và máy này.' : 'Đã xóa danh sách balo.',
      'info'
    );
  };

  const handleSavePackToCloud = async () => {
    if (isSavingCloud) return;
    const token = safeLocalStorageGet('lost_token');
    if (!currentUser && !token) {
      notify('Đăng nhập để lưu danh sách balo lên tài khoản, đi đâu cũng mở lại được.', 'info');
      window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
      return;
    }

    const cleanName = activeList.name.trim();
    if (cleanName.length < 2) {
      notify('Đặt tên balo dài ít nhất 2 ký tự nhé.', 'error');
      return;
    }

    const safeBodyWeightKg = Math.max(35, Math.min(140, Math.round(state.bodyWeightKg || 62)));
    const payload = {
      name: cleanName.slice(0, 120),
      trailSlug: selectedTrail?.id || '',
      bodyWeightKg: safeBodyWeightKg,
      items: toServerGearItems(activeList.items),
      isPublic: activeList.isPublic !== false,
    };

    setIsSavingCloud(true);
    try {
      const isUpdate = Boolean(activeList.cloudId);
      const endpoint = isUpdate
        ? `/api/gear-packs/${encodeURIComponent(activeList.cloudId!)}`
        : '/api/gear-packs';
      const res = await fetch(endpoint, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.data) {
        const saved = json.data as ServerGearPack;
        updateActiveList((list) => ({
          ...list,
          cloudId: String(saved._id),
          shareSlug: saved.shareSlug || list.shareSlug,
          isPublic: saved.isPublic !== false,
          updatedAt: saved.updatedAt || new Date().toISOString(),
          targetTrailId: saved.trailSlug || selectedTrail?.id,
          subtitle: saved.shareSlug
            ? `Đã lưu trên tài khoản • Mã chia sẻ: ${saved.shareSlug}`
            : 'Đã lưu trên tài khoản LOST',
        }));
        notify(
          json.message || (isUpdate ? 'Đã cập nhật danh sách balo trên tài khoản.' : 'Đã lưu danh sách balo vào tài khoản.'),
          'success'
        );
      } else {
        notify(json.message || 'Chưa lưu được danh sách balo lúc này.', 'error');
      }
    } catch {
      notify('Mất kết nối máy chủ — đồ đạc bạn sửa vẫn được giữ an toàn trên máy này.', 'error');
    } finally {
      setIsSavingCloud(false);
    }
  };

  const handleCopySharePackLink = async () => {
    if (!activeList.shareSlug) return;
    if (activeList.isPublic === false) {
      notify('Danh sách balo đang để Riêng tư — hãy chuyển sang Công khai trước khi gửi link cho đoàn nhé.', 'info');
      return;
    }
    const shareUrl = `${window.location.origin}/gear?pack=${encodeURIComponent(activeList.shareSlug)}`;
    let copied: boolean;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(shareUrl);
        copied = true;
      } catch {
        copied = copyTextViaExecCommand(shareUrl);
      }
    } else {
      copied = copyTextViaExecCommand(shareUrl);
    }
    if (copied) {
      notify('Đã chép link balo — gửi cho cả đoàn tham khảo nhé.', 'success');
    } else {
      notify(`Link chia sẻ balo: ${shareUrl}`, 'info');
    }
  };

  const handleResetPresets = () => {
    const defaults = createDefaultPresets();
    setState((prev) => ({
      ...prev,
      activeListId: defaults[1].id,
      lists: defaults,
    }));
    setConfirmDeleteList(false);
    notify('Đã khôi phục 3 bộ balo mẫu.', 'info');
  };

  const handleSyncGearLockerToProfile = async () => {
    if (isSyncingProfile) return;
    const token = safeLocalStorageGet('lost_token');
    if (!currentUser && !token) {
      notify('Đăng nhập để đưa danh sách đồ này vào tủ đồ cá nhân của bạn.', 'info');
      window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
      return;
    }
    const packedNames = activeList.items
      .filter((i) => i.packed)
      .map((i) => i.name.trim())
      .filter(Boolean)
      .slice(0, 50);

    setIsSyncingProfile(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: getApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ gearLocker: packedNames }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        notify(`Đã lưu ${packedNames.length} món đồ vào tủ đồ hồ sơ của bạn.`, 'success');
      } else {
        notify(json.message || 'Chưa cập nhật được tủ đồ lúc này.', 'error');
      }
    } catch {
      notify('Mất kết nối máy chủ khi lưu tủ đồ.', 'error');
    } finally {
      setIsSyncingProfile(false);
    }
  };

  const handleAuditWithLostAi = () => {
    const packedNames = activeList.items
      .filter((i) => i.packed)
      .map((i) => `${i.name} (${i.weightG * i.qty}g, ${CARRY_TYPE_META[i.carryType].shortLabel})`)
      .join('; ');
    const trailLabel = selectedTrail ? `${selectedTrail.name} (${selectedTrail.province}, đỉnh ${selectedTrail.maxAltitudeM}m)` : 'chuyến đi núi sắp tới';
    const prompt = `Rà giúp mình balo cho cung ${trailLabel}: mình nặng ${state.bodyWeightKg}kg, đồ cố định ${formatKg(metrics.baseG)}kg, đồ ăn nước uống ${formatKg(metrics.consumableG)}kg, tổng đeo vai ${formatKg(metrics.totalCarryG)}kg (${metrics.ratioPercent}% cân nặng). Danh sách đồ đang mang: ${packedNames || 'chưa tích chọn món nào'}. Xem giúp còn thiếu món an toàn nào và món nào nên bớt cho nhẹ vai.`;

    queueAiAssistantPrompt(prompt, selectedTrail?.id);
  };

  const handleCalculateTurnaroundAndPaceWithAi = () => {
    if (metrics.totalCarryG <= 0) {
      notify(
        'Balo đang trống (0 kg). Bạn tích chọn ít nhất 1 món đeo vai rồi mình tính giờ quay đầu nhé.',
        'info'
      );
      return;
    }

    const totalCarryKg = formatKg(metrics.totalCarryG);
    const baseKg = formatKg(metrics.baseG);
    const consumableKg = formatKg(metrics.consumableG);
    const trailLabel = selectedTrail
      ? `${selectedTrail.name} (${selectedTrail.province}, dài ${selectedTrail.distanceKm} km, leo dốc +${selectedTrail.elevationGainM}m, đỉnh ${selectedTrail.maxAltitudeM}m)`
      : 'chuyến đi núi sắp tới';

    const prompt = `Tính giúp mình giờ quay đầu an toàn và tốc độ đi cho cung ${trailLabel} với bộ "${activeList.name}": tổng đeo vai ${totalCarryKg} kg (đồ cố định ${baseKg} kg + ăn uống ${consumableKg} kg = ${metrics.ratioPercent}% cân nặng ${state.bodyWeightKg} kg). Gợi ý giờ xuất phát, giờ quay đầu kịp xuống trước tối và lượng nước, đồ ăn nên mang.`;

    // Uses canonical queueAiAssistantPrompt (saves sessionStorage + dispatches single lost:open-ai-assistant)
    queueAiAssistantPrompt(prompt, selectedTrail?.id);
  };

  const handleCopyGroupList = async () => {
    const lines: string[] = [
      `[DANH SÁCH BALO - LOST] ${activeList.name}`,
      selectedTrail ? `Cung dự kiến: ${selectedTrail.name} (${selectedTrail.province})` : '',
      `Đồ cố định: ${formatKg(metrics.baseG)} kg | Ăn uống: ${formatKg(metrics.consumableG)} kg | Mặc người: ${formatKg(metrics.wornG)} kg`,
      `Tổng đeo vai: ${formatKg(metrics.totalCarryG)} kg (${metrics.ratioPercent}% so với ${state.bodyWeightKg}kg cơ thể — ${metrics.ratioLabel})`,
      '',
    ].filter((l, idx) => idx === 4 || Boolean(l));

    CATEGORIES.forEach((cat) => {
      const catItems = activeList.items.filter((i) => i.category === cat.id && i.packed);
      if (catItems.length === 0) return;
      const catCarrySum = catItems
        .filter((i) => i.carryType !== 'worn')
        .reduce((acc, i) => acc + i.weightG * i.qty, 0);
      const catWornSum = catItems
        .filter((i) => i.carryType === 'worn')
        .reduce((acc, i) => acc + i.weightG * i.qty, 0);
      const sumNote =
        catWornSum > 0
          ? `${formatKg(catCarrySum)} kg đeo vai + ${formatKg(catWornSum)} kg mặc người`
          : `${formatKg(catCarrySum)} kg đeo vai`;
      lines.push(`• ${cat.label} (${sumNote}):`);
      catItems.forEach((i) => {
        lines.push(`  - ${i.name} x${i.qty} (${i.weightG * i.qty}g • ${CARRY_TYPE_META[i.carryType].shortLabel})`);
      });
    });

    const reportText = lines.join('\n');
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
      notify('Đã chép danh sách balo — dán gửi vào nhóm đoàn là xong.', 'success');
    } else {
      notify('Không thể tự sao chép lúc này.', 'error');
    }
  };

  // Donut SVG geometry (radius 74, circumference ~ 464.96)
  const DONUT_R = 74;
  const DONUT_C = 2 * Math.PI * DONUT_R;
  const donutArcs = useMemo(() => {
    return metrics.segments.reduce<Array<{
      id: GearCategoryId;
      color: string;
      dashArray: string;
      dashOffset: number;
      nextOffset: number;
    }>>((acc, seg) => {
      const startOffset = acc.length > 0 ? acc[acc.length - 1].nextOffset : 0;
      const segLength = (seg.pct / 100) * DONUT_C;
      acc.push({
        id: seg.id,
        color: seg.color,
        dashArray: `${Math.max(0, segLength - 1.5)} ${DONUT_C}`,
        dashOffset: -startOffset,
        nextOffset: startOffset + segLength,
      });
      return acc;
    }, []);
  }, [metrics.segments, DONUT_C]);

  return (
    <section
      style={{
        maxWidth: 1240,
        margin: '0 auto',
        padding: '24px 20px 56px',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* Top Command Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          paddingBottom: 18,
          marginBottom: 20,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="btn btn-outline"
              style={{ marginBottom: 10, padding: '6px 12px', fontSize: '0.78rem', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <IconArrowLeft size={14} /> Quay lại
            </button>
          )}
          <div className="section-eyebrow" style={{ marginBottom: 6 }}>
            <IconBackpack size={13} color="var(--color-primary)" />
            <span>Soạn đồ &amp; cân balo</span>
          </div>
          <h1 className="font-editorial" style={{ margin: 0, fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 600, color: 'var(--color-text-main)', lineHeight: 1.12 }}>
            Cân lại balo trước giờ lên đường
          </h1>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.88rem', color: 'var(--color-text-muted)', maxWidth: 680 }}>
            Tính rõ từng gram đồ cố định, đồ ăn nước uống và đồ mặc trên người — để vai nhẹ, gối bền suốt những con dốc dài.
          </p>
        </div>

        {/* Action Strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAuditWithLostAi}
            style={{ padding: '8px 14px', fontSize: '0.8rem', fontWeight: 800, borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <IconBot size={15} color="var(--color-on-primary)" />
            <span>Nhờ LOST rà lại balo</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={handleCalculateTurnaroundAndPaceWithAi}
            style={{
              padding: '8px 14px',
              fontSize: '0.8rem',
              fontWeight: 800,
              borderRadius: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              borderColor: 'var(--color-primary)',
              color: 'var(--color-primary)',
              background: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card))',
            }}
          >
            <IconClock size={14} color="var(--color-primary)" />
            <span>Tính giờ quay đầu theo tải balo</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={handleCopyGroupList}
            style={{ padding: '8px 12px', fontSize: '0.8rem', fontWeight: 700, borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <IconCopy size={14} />
            <span>Chép gửi nhóm</span>
          </button>

          <button
            type="button"
            className="btn btn-sky"
            disabled={isSavingCloud}
            onClick={handleSavePackToCloud}
            style={{ padding: '8px 12px', fontSize: '0.8rem', fontWeight: 700, borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <IconCloud size={14} color="var(--color-on-primary)" />
            <span>
              {isSavingCloud
                ? 'Đang lưu...'
                : activeList.cloudId
                  ? 'Cập nhật bản lưu'
                  : 'Lưu vào tài khoản'}
            </span>
          </button>

          {activeList.shareSlug && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleCopySharePackLink}
              title={
                activeList.isPublic === false
                  ? 'Đang ở chế độ Riêng tư — bật Công khai trước khi chia sẻ link'
                  : 'Chép link chia sẻ balo công khai'
              }
              style={{
                padding: '8px 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                borderColor: activeList.isPublic === false ? 'var(--color-border-strong)' : 'var(--color-primary)',
                color: activeList.isPublic === false ? 'var(--color-text-muted)' : 'var(--color-primary)',
                opacity: activeList.isPublic === false ? 0.78 : 1,
              }}
            >
              <IconShare size={14} color={activeList.isPublic === false ? 'var(--color-text-muted)' : 'var(--color-primary)'} />
              <span>{activeList.isPublic === false ? 'Đang riêng tư (chưa chia sẻ)' : 'Chép link chia sẻ'}</span>
            </button>
          )}

          {currentUser && (
            <button
              type="button"
              className="btn btn-outline"
              disabled={isSyncingProfile}
              onClick={handleSyncGearLockerToProfile}
              style={{ padding: '8px 12px', fontSize: '0.8rem', fontWeight: 700, borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <IconShieldCheck size={14} color="var(--color-primary)" />
              <span>{isSyncingProfile ? 'Đang lưu...' : 'Đưa vào tủ đồ hồ sơ'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Pack List Switcher & Body/Trail Config Bar */}
      <div
        className="card"
        style={{
          padding: '14px 16px',
          borderRadius: 4,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          marginBottom: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {state.lists.map((list) => {
              const isSelected = list.id === activeList.id;
              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => {
                    setState((prev) => ({ ...prev, activeListId: list.id }));
                    if (list.targetTrailId && trails.some((t) => t.id === list.targetTrailId)) {
                      setSelectedTrailId(list.targetTrailId);
                    }
                    setIsRenamingList(false);
                    setConfirmDeleteList(false);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 4,
                    fontSize: '0.78rem',
                    fontWeight: isSelected ? 800 : 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: isSelected ? 'var(--color-primary)' : 'var(--color-bg-main)',
                    color: isSelected ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                    border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  }}
                >
                  {list.cloudId && (
                    <IconCloud
                      size={12}
                      color={isSelected ? 'var(--color-on-primary)' : 'var(--color-sky)'}
                    />
                  )}
                  <span>{list.name}</span>
                </button>
              );
            })}
            {cloudSyncedCount > 0 && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--color-sky)',
                  background: 'color-mix(in srgb, var(--color-sky) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-sky) 30%, transparent)',
                  borderRadius: 4,
                  padding: '3px 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <IconCloud size={12} color="var(--color-sky)" />
                <span>{cloudSyncedCount} đã lưu</span>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleCreateCustomList}
              style={{ padding: '5px 10px', fontSize: '0.74rem', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <IconPlus size={13} /> Tạo mới
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleDuplicateList}
              style={{ padding: '5px 10px', fontSize: '0.74rem', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <IconCopy size={13} /> Nhân bản
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setRenameDraft(activeList.name);
                setIsRenamingList((v) => !v);
              }}
              style={{ padding: '5px 10px', fontSize: '0.74rem', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <IconEdit size={13} /> Đổi tên
            </button>
            {state.lists.length > 1 && (
              confirmDeleteList ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleDeleteCurrentList}
                    style={{ padding: '5px 9px', fontSize: '0.72rem', borderRadius: 4 }}
                  >
                    Xác nhận xóa
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setConfirmDeleteList(false)}
                    style={{ padding: '5px 8px', fontSize: '0.72rem', borderRadius: 4 }}
                  >
                    Hủy
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setConfirmDeleteList(true)}
                  style={{ padding: '5px 10px', fontSize: '0.74rem', borderRadius: 4, color: 'var(--color-error-text, var(--color-error))', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <IconTrash size={13} color="var(--color-error-text, var(--color-error))" /> Xóa
                </button>
              )
            )}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => void handleTogglePackVisibility()}
              title={
                activeList.isPublic === false
                  ? 'Đang ở chế độ Riêng tư — bấm để chuyển sang Công khai'
                  : 'Đang ở chế độ Công khai — bấm để chuyển sang Riêng tư'
              }
              style={{
                padding: '5px 10px',
                fontSize: '0.74rem',
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: activeList.isPublic === false ? 'var(--color-sun)' : 'var(--color-primary)',
                borderColor:
                  activeList.isPublic === false
                    ? 'color-mix(in srgb, var(--color-sun) 45%, transparent)'
                    : 'color-mix(in srgb, var(--color-primary) 45%, transparent)',
              }}
            >
              <IconShare
                size={12}
                color={activeList.isPublic === false ? 'var(--color-sun)' : 'var(--color-primary)'}
              />
              <span>{activeList.isPublic === false ? 'Riêng tư' : 'Công khai'}</span>
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleResetPresets}
              title="Khôi phục 3 bộ balo mẫu ban đầu"
              style={{ padding: '5px 10px', fontSize: '0.74rem', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <IconRotateCw size={12} /> Về mẫu gốc
            </button>
          </div>
        </div>

        {/* Inline Rename Form */}
        {isRenamingList && (
          <form onSubmit={handleSaveRename} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              id="gear-rename-pack"
              type="text"
              className="form-input"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              placeholder="Nhập tên danh sách balo..."
              aria-label="Tên mới cho danh sách balo"
              style={{ flex: 1, minWidth: 220, padding: '6px 10px', fontSize: '0.82rem', borderRadius: 4 }}
              autoFocus
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.78rem', borderRadius: 4 }}>
              Lưu tên
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setIsRenamingList(false)} style={{ padding: '6px 10px', fontSize: '0.78rem', borderRadius: 4 }}>
              Hủy
            </button>
          </form>
        )}

        {/* Target Trail & Body Weight Controls */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            paddingTop: 10,
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <div>
            <label htmlFor="gear-target-trail" style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>
              Cung đường dự định đi
            </label>
            <select
              id="gear-target-trail"
              className="form-select"
              value={selectedTrailId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedTrailId(nextId);
                updateActiveList((list) => ({ ...list, targetTrailId: nextId }));
              }}
              aria-label="Chọn cung đường dự định đi"
              style={{ width: '100%', padding: '7px 10px', fontSize: '0.82rem', borderRadius: 4 }}
            >
              {trails.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.maxAltitudeM}m • {t.province})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="gear-body-weight" style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>
              Cân nặng của bạn (kg) — để tính tỷ lệ gánh vai
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="gear-body-weight"
                type="number"
                min={35}
                max={140}
                className="form-input"
                aria-label="Cân nặng cơ thể tính theo kg"
                value={bodyWeightInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setBodyWeightInput(raw);
                  const val = Number(raw);
                  if (raw.trim() !== '' && Number.isFinite(val) && val >= 35 && val <= 140) {
                    setState((prev) => ({ ...prev, bodyWeightKg: Math.round(val) }));
                  }
                }}
                onBlur={() => {
                  const parsed = Number(bodyWeightInput);
                  const clamped =
                    bodyWeightInput.trim() !== '' && Number.isFinite(parsed)
                      ? Math.max(35, Math.min(140, Math.round(parsed)))
                      : Math.max(35, Math.min(140, Math.round(state.bodyWeightKg || 62)));
                  setState((prev) => ({ ...prev, bodyWeightKg: clamped }));
                  setBodyWeightInput(String(clamped));
                }}
                style={{ width: 96, padding: '7px 10px', fontSize: '0.84rem', fontWeight: 800, borderRadius: 4, fontVariantNumeric: 'tabular-nums' }}
              />
              <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                Nên giữ dưới{' '}
                <strong style={{ color: 'var(--color-primary)' }}>
                  {(Math.max(35, Math.min(140, state.bodyWeightKg || 62)) * 0.18).toFixed(1)} kg
                </strong>{' '}
                (18% cân nặng)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5-Metric Telemetry KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
          gap: 10,
          marginBottom: 20,
        }}
      >
        <div className="card" style={{ padding: '14px 16px', borderRadius: 4, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
            Đồ cố định (Base weight)
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--color-primary)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {formatKg(metrics.baseG)} <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>kg</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            {metrics.baseG.toLocaleString('vi-VN')} g (chưa tính ăn, uống)
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', borderRadius: 4, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
            Đồ ăn &amp; nước uống
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--color-sun)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {formatKg(metrics.consumableG)} <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>kg</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            Nhẹ dần dọc đường đi
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', borderRadius: 4, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
            Mặc trên người
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--color-sky)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {formatKg(metrics.wornG)} <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>kg</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            Giày, quần áo, mũ đang mang
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', borderRadius: 4, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
            Tổng đeo trên vai
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--color-text-main)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {formatKg(metrics.totalCarryG)} <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>kg</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            {metrics.packedCount}/{metrics.totalItems} món đã bỏ vào balo
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '14px 16px',
            borderRadius: 4,
            background: `color-mix(in srgb, ${metrics.ratioColor} 10%, var(--color-bg-card))`,
            border: `1px solid color-mix(in srgb, ${metrics.ratioColor} 40%, var(--color-border))`,
          }}
        >
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconScale size={12} color={metrics.ratioColor} /> Tỷ lệ tải vai
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: metrics.ratioColor, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {metrics.ratioPercent}%
          </div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: metrics.ratioColor, marginTop: 2 }}>
            {metrics.ratioLabel}
          </div>
        </div>
      </div>

      {/* Main Split: Left SVG Donut Analytics + Add Custom Item | Right Categorized Gear Table */}
      <div className="wizard-grid-2-wide" style={{ alignItems: 'start' }}>
        {/* LEFT SIDEBAR: Pure Inline SVG Donut Chart & Add Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Pure Inline SVG Category Weight Donut Chart */}
          <div className="card" style={{ padding: '18px 20px', borderRadius: 4, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Phân bổ cân nặng trong balo
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Rê chuột vào từng nhóm để xem món nào đang nặng nhất
                </div>
              </div>
              <IconSparkles size={16} color="var(--color-primary)" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
              <svg
                width="196"
                height="196"
                viewBox="0 0 200 200"
                role="img"
                aria-label="Biểu đồ phân bổ trọng lượng balo theo danh mục"
                style={{ flexShrink: 0 }}
              >
                <circle
                  cx="100"
                  cy="100"
                  r={DONUT_R}
                  fill="none"
                  stroke="var(--color-surface-elevated)"
                  strokeWidth="22"
                />
                {donutArcs.map((seg) => {
                  const isHovered = hoveredCat === seg.id;

                  return (
                    <circle
                      key={seg.id}
                      cx="100"
                      cy="100"
                      r={DONUT_R}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={isHovered ? 26 : 22}
                      strokeDasharray={seg.dashArray}
                      strokeDashoffset={seg.dashOffset}
                      transform="rotate(-90 100 100)"
                      style={{
                        cursor: 'pointer',
                        transition: 'stroke-width 0.16s ease, opacity 0.16s ease',
                        opacity: hoveredCat && !isHovered ? 0.45 : 1,
                      }}
                      onMouseEnter={() => setHoveredCat(seg.id)}
                      onMouseLeave={() => setHoveredCat(null)}
                    />
                  );
                })}
                <text
                  x="100"
                  y="93"
                  textAnchor="middle"
                  fill="var(--color-text-main)"
                  style={{ fontSize: '22px', fontWeight: 900, fontFamily: 'var(--font-family)' }}
                >
                  {formatKg(metrics.totalCarryG)} kg
                </text>
                <text
                  x="100"
                  y="114"
                  textAnchor="middle"
                  fill="var(--color-text-dim)"
                  style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-family)' }}
                >
                  {hoveredCat
                    ? CATEGORY_MAP[hoveredCat].label
                    : 'Tổng đeo vai'}
                </text>
              </svg>

              {/* Category Legend Breakdown */}
              <div style={{ flex: 1, minWidth: 190, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {CATEGORIES.map((cat) => {
                  const found = metrics.segments.find((s) => s.id === cat.id);
                  const grams = found?.grams || 0;
                  const pct = found?.pct || 0;
                  const isHovered = hoveredCat === cat.id;

                  return (
                    <div
                      key={cat.id}
                      onMouseEnter={() => setHoveredCat(cat.id)}
                      onMouseLeave={() => setHoveredCat(null)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '5px 8px',
                        borderRadius: 4,
                        background: isHovered ? 'var(--color-surface-elevated)' : 'var(--color-bg-main)',
                        border: isHovered ? `1px solid ${cat.color}` : '1px solid var(--color-border)',
                        fontSize: '0.76rem',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cat.label}
                        </span>
                      </span>
                      <span style={{ fontWeight: 800, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {formatKg(grams)}kg ({pct.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Add Custom Gear Item Form */}
          <form
            onSubmit={handleAddItem}
            className="card"
            style={{
              padding: '18px 20px',
              borderRadius: 4,
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconPlus size={15} color="var(--color-primary)" />
              <span>Thêm món đồ của bạn</span>
            </div>

            <input
              id="gear-new-item-name"
              type="text"
              className="form-input"
              placeholder="Ví dụ: Máy ảnh Sony A6400, bếp cồn khô, áo giữ nhiệt..."
              aria-label="Tên vật dụng tùy chỉnh cần thêm vào balo"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              style={{ padding: '8px 10px', fontSize: '0.82rem', borderRadius: 4 }}
              required
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
              <select
                id="gear-new-item-category"
                className="form-select"
                value={newItemCat}
                onChange={(e) => setNewItemCat(e.target.value as GearCategoryId)}
                aria-label="Danh mục vật dụng"
                style={{ padding: '7px 8px', fontSize: '0.78rem', borderRadius: 4 }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>

              <input
                id="gear-new-item-grams"
                type="number"
                min={1}
                max={25000}
                className="form-input"
                placeholder="Gram (g)"
                aria-label="Trọng lượng vật dụng tính theo gram"
                value={newItemGrams}
                onChange={(e) => setNewItemGrams(e.target.value)}
                style={{ padding: '7px 8px', fontSize: '0.8rem', borderRadius: 4 }}
                required
              />

              <input
                id="gear-new-item-qty"
                type="number"
                min={1}
                max={20}
                className="form-input"
                placeholder="SL"
                aria-label="Số lượng vật dụng"
                value={newItemQty}
                onChange={(e) => setNewItemQty(e.target.value)}
                style={{ padding: '7px 8px', fontSize: '0.8rem', borderRadius: 4 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['base', 'consumable', 'worn'] as CarryType[]).map((ct) => {
                const active = newItemCarry === ct;
                return (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setNewItemCarry(ct)}
                    style={{
                      flex: 1,
                      minWidth: 92,
                      padding: '6px 8px',
                      borderRadius: 4,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: active
                        ? `color-mix(in srgb, ${CARRY_TYPE_META[ct].color} 16%, transparent)`
                        : 'var(--color-bg-main)',
                      border: active
                        ? `1px solid ${CARRY_TYPE_META[ct].color}`
                        : '1px solid var(--color-border)',
                      color: active ? CARRY_TYPE_META[ct].color : 'var(--color-text-muted)',
                    }}
                  >
                    {CARRY_TYPE_META[ct].shortLabel}
                  </button>
                );
              })}
            </div>

            <button type="submit" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.8rem', fontWeight: 800, borderRadius: 4 }}>
              + Cho vào balo
            </button>
          </form>
        </div>

        {/* RIGHT PANEL: Categorized Gear Inventory */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {CATEGORIES.map((cat) => {
            const catItems = activeList.items.filter((i) => i.category === cat.id);
            const catCarryG = catItems
              .filter((i) => i.packed && i.carryType !== 'worn')
              .reduce((acc, i) => acc + i.weightG * i.qty, 0);
            const catWornG = catItems
              .filter((i) => i.packed && i.carryType === 'worn')
              .reduce((acc, i) => acc + i.weightG * i.qty, 0);

            return (
              <div
                key={cat.id}
                className="card"
                style={{
                  padding: '14px 16px',
                  borderRadius: 4,
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderLeft: `3px solid ${cat.color}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                      {cat.label}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', fontWeight: 700 }}>
                      ({catItems.filter((i) => i.packed).length}/{catItems.length} món)
                    </span>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: cat.color }}>
                      {formatKg(catCarryG)} kg đeo vai
                    </span>
                    {catWornG > 0 && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-dim)' }}>
                        (+{formatKg(catWornG)} kg mặc)
                      </span>
                    )}
                  </div>
                </div>

                {catItems.length === 0 ? (
                  <div style={{ fontSize: '0.76rem', color: 'var(--color-text-dim)', padding: '6px 0' }}>
                    Chưa có món nào trong nhóm này.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {catItems.map((item) => {
                      const totalItemG = item.weightG * item.qty;
                      const meta = CARRY_TYPE_META[item.carryType];
                      const isEditingItem = editingItemId === item.id;
                      if (isEditingItem) {
                        return (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                              padding: '10px',
                              borderRadius: 4,
                              background: 'var(--color-bg-main)',
                              border: '1px solid var(--color-primary)',
                            }}
                          >
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(115px, 100%), 1fr))', gap: 6 }}>
                              <input
                                type="text"
                                className="form-input"
                                aria-label="Sửa tên vật dụng"
                                value={editItemName}
                                onChange={(e) => setEditItemName(e.target.value)}
                                maxLength={140}
                                style={{ padding: '5px 8px', fontSize: '0.78rem', borderRadius: 4 }}
                              />
                              <input
                                type="number"
                                className="form-input"
                                aria-label="Sửa trọng lượng (gram)"
                                min={0}
                                max={50000}
                                value={editItemWeightG}
                                onChange={(e) => setEditItemWeightG(e.target.value)}
                                style={{ padding: '5px 8px', fontSize: '0.78rem', borderRadius: 4 }}
                              />
                              <select
                                className="form-select"
                                aria-label="Sửa danh mục vật dụng"
                                value={editItemCat}
                                onChange={(e) => setEditItemCat(e.target.value as GearCategoryId)}
                                style={{ padding: '5px 8px', fontSize: '0.78rem', borderRadius: 4 }}
                              >
                                {CATEGORIES.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => setEditingItemId(null)}
                                style={{ padding: '4px 10px', fontSize: '0.72rem', borderRadius: 4 }}
                              >
                                Hủy
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => handleSaveEditItem(item.id)}
                                style={{ padding: '4px 12px', fontSize: '0.72rem', borderRadius: 4 }}
                              >
                                <IconCheck size={12} color="var(--color-on-primary)" /> Lưu thay đổi
                              </button>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            flexWrap: 'wrap',
                            padding: '8px 10px',
                            borderRadius: 4,
                            background: item.packed
                              ? 'var(--color-bg-main)'
                              : 'color-mix(in srgb, var(--color-bg-main) 50%, transparent)',
                            border: '1px solid var(--color-border)',
                            opacity: item.packed ? 1 : 0.6,
                          }}
                        >
                          {/* Checkbox + Item Name */}
                          <button
                            type="button"
                            onClick={() => handleToggleItemPacked(item.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              flex: '1 1 200px',
                              minWidth: 0,
                              textAlign: 'left',
                              cursor: 'pointer',
                              background: 'none',
                              border: 'none',
                              padding: 0,
                            }}
                          >
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 4,
                                background: item.packed ? 'var(--color-primary)' : 'var(--color-bg-card)',
                                border: item.packed ? '1px solid var(--color-primary)' : '1px solid var(--color-border-strong)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {item.packed && <IconCheck size={12} color="var(--color-on-primary)" />}
                            </span>
                            <span
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                color: 'var(--color-text-main)',
                                textDecoration: item.packed ? 'none' : 'line-through',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {item.name}
                            </span>
                          </button>

                          {/* Controls: CarryType pills + Qty Stepper + Weight + Edit + Delete */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <div style={{ display: 'inline-flex', borderRadius: 4, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                              {(['base', 'consumable', 'worn'] as CarryType[]).map((ct) => {
                                const isSel = item.carryType === ct;
                                const ctMeta = CARRY_TYPE_META[ct];
                                return (
                                  <button
                                    key={ct}
                                    type="button"
                                    title={ctMeta.label}
                                    onClick={() => handleCycleCarryType(item.id, ct)}
                                    style={{
                                      padding: '3px 6px',
                                      fontSize: '0.66rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      background: isSel
                                        ? `color-mix(in srgb, ${ctMeta.color} 18%, transparent)`
                                        : 'transparent',
                                      color: isSel ? ctMeta.color : 'var(--color-text-dim)',
                                    }}
                                  >
                                    {ctMeta.shortLabel}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Qty Stepper */}
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                border: '1px solid var(--color-border)',
                                borderRadius: 4,
                                background: 'var(--color-bg-card)',
                              }}
                            >
                              <button
                                type="button"
                                aria-label="Giảm số lượng"
                                onClick={() => handleStepQty(item.id, -1)}
                                style={{ padding: '2px 7px', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer', color: 'var(--color-text-muted)' }}
                              >
                                -
                              </button>
                              <span style={{ fontSize: '0.74rem', fontWeight: 800, padding: '0 4px', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                                {item.qty}
                              </span>
                              <button
                                type="button"
                                aria-label="Tăng số lượng"
                                onClick={() => handleStepQty(item.id, 1)}
                                style={{ padding: '2px 7px', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer', color: 'var(--color-text-muted)' }}
                              >
                                +
                              </button>
                            </div>

                            <span
                              style={{
                                fontSize: '0.76rem',
                                fontWeight: 800,
                                color: meta.color,
                                minWidth: 64,
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {totalItemG >= 1000 ? `${(totalItemG / 1000).toFixed(2)}kg` : `${totalItemG}g`}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleStartEditItem(item)}
                              aria-label={`Sửa ${item.name}`}
                              title="Chỉnh sửa tên, trọng lượng, danh mục"
                              style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 3, display: 'inline-flex' }}
                            >
                              <IconEdit size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              aria-label={`Xóa ${item.name}`}
                              style={{ background: 'none', border: 'none', color: 'var(--color-error-text, var(--color-error))', cursor: 'pointer', padding: 3, display: 'inline-flex' }}
                            >
                              <IconX size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Bottom Tip Strip */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-card))',
              border: '1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border))',
              fontSize: '0.78rem',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <IconCheckCircle size={16} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <span>
              <strong style={{ color: 'var(--color-text-main)' }}>Mẹo giữ gối khi đi dốc:</strong> Với những cung dốc gắt như Hoàng Liên Sơn (&gt;1.200m leo cao mỗi ngày), giữ tổng balo đeo vai <strong>dưới 18% cân nặng cơ thể</strong> giúp đỡ chùn gối lúc xuống dốc và giữ sức đều tới cuối ngày.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
