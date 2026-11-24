import crypto from 'crypto';
import { Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { GearPackModel, IGearPackItem } from '../models/GearPack.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { sanitizeInput } from '../utils/validation.js';
import { containsProfanity, getProfanityMatch } from '../utils/profanityFilter.js';
import { isValidObjectId } from '../utils/resolveTrail.js';

const MAX_PACKS_PER_USER = 15;
const MAX_ITEMS_PER_PACK = 120;

function generateShareSlug(): string {
  return `pack-${crypto.randomBytes(6).toString('hex')}`;
}

function sanitizePackItems(raw: unknown): { items: IGearPackItem[]; error?: string } {
  if (raw === undefined || raw === null) {
    return { items: [] };
  }
  if (!Array.isArray(raw)) {
    return { items: [], error: 'Danh sách vật dụng (items) phải là mảng hợp lệ.' };
  }
  if (raw.length > MAX_ITEMS_PER_PACK) {
    return { items: [], error: `Mỗi danh sách balo chỉ hỗ trợ tối đa ${MAX_ITEMS_PER_PACK} vật dụng.` };
  }

  const items: IGearPackItem[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i] as any;
    if (!entry || typeof entry !== 'object') continue;

    const cleanName = sanitizeInput(String(entry.name || '')).slice(0, 140);
    if (!cleanName) continue;
    if (containsProfanity(cleanName)) {
      const matched = getProfanityMatch(cleanName);
      return { items: [], error: `Tên vật dụng trong balo chứa từ ngữ không phù hợp ("${matched}").` };
    }

    const cleanId =
      typeof entry.id === 'string' && entry.id.trim()
        ? sanitizeInput(entry.id).slice(0, 60)
        : `item-${i + 1}-${crypto.randomBytes(3).toString('hex')}`;
    const cleanCategory = sanitizeInput(String(entry.category || 'Khác')).slice(0, 60) || 'Khác';

    const rawWeight = Number(entry.weightGrams);
    const weightGrams = Number.isFinite(rawWeight) ? Math.max(0, Math.min(50000, Math.round(rawWeight))) : 0;

    const rawQty = Number(entry.quantity);
    const quantity = Number.isFinite(rawQty) ? Math.max(1, Math.min(99, Math.round(rawQty))) : 1;

    items.push({
      id: cleanId,
      name: cleanName,
      category: cleanCategory,
      weightGrams,
      quantity,
      worn: Boolean(entry.worn),
      consumable: Boolean(entry.consumable),
      packed: entry.packed !== false,
    });
  }

  return { items };
}

function computePackSummary(items: IGearPackItem[], bodyWeightKg: number) {
  let baseWeightGrams = 0;
  let wornWeightGrams = 0;
  let consumableWeightGrams = 0;
  let totalQuantity = 0;
  let packedItemCount = 0;
  const categoryBreakdown: Record<string, number> = {};

  for (const item of items) {
    if (item.packed === false) continue;
    packedItemCount += 1;
    const lineWeight = Math.max(0, Number(item.weightGrams) || 0) * Math.max(1, Number(item.quantity) || 1);
    totalQuantity += Math.max(1, Number(item.quantity) || 1);
    const cat = item.category || 'Khác';
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + lineWeight;

    if (item.worn) {
      wornWeightGrams += lineWeight;
    } else if (item.consumable) {
      consumableWeightGrams += lineWeight;
    } else {
      baseWeightGrams += lineWeight;
    }
  }

  const packWeightGrams = baseWeightGrams + consumableWeightGrams;
  const totalCarryWeightGrams = packWeightGrams + wornWeightGrams;
  const safeBodyKg = Math.max(25, Math.min(200, Number(bodyWeightKg) || 65));
  const baseWeightKg = Math.round((baseWeightGrams / 1000) * 100) / 100;
  const packWeightKg = Math.round((packWeightGrams / 1000) * 100) / 100;
  const bodyWeightRatioPercent = Math.round((packWeightKg / safeBodyKg) * 1000) / 10;

  let weightClass: 'ultralight' | 'lightweight' | 'traditional' | 'heavy' = 'traditional';
  if (baseWeightKg < 4.5) weightClass = 'ultralight';
  else if (baseWeightKg < 7) weightClass = 'lightweight';
  else if (baseWeightKg >= 10) weightClass = 'heavy';

  return {
    itemCount: items.length,
    packedItemCount,
    totalQuantity,
    baseWeightGrams,
    wornWeightGrams,
    consumableWeightGrams,
    packWeightGrams,
    totalCarryWeightGrams,
    baseWeightKg,
    packWeightKg,
    bodyWeightRatioPercent,
    weightClass,
    categoryBreakdown,
  };
}

function formatPackResponse(doc: any) {
  const items = Array.isArray(doc.items) ? doc.items : [];
  const bodyWeightKg = Number(doc.bodyWeightKg) || 65;
  return {
    ...doc,
    summary: computePackSummary(items, bodyWeightKg),
  };
}

// GET /api/gear-packs/me - List current user's saved gear packs
export const getMyGearPacks = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để xem danh sách balo.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: 0, maxPacks: MAX_PACKS_PER_USER, data: [] });
    }

    const packs = await GearPackModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .limit(MAX_PACKS_PER_USER)
      .lean();

    return res.json({
      success: true,
      count: packs.length,
      maxPacks: MAX_PACKS_PER_USER,
      data: packs.map(formatPackResponse),
    });
  } catch (err) {
    console.error('[Get My Gear Packs Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách balo của bạn.' });
  }
};

// POST /api/gear-packs - Create a new cloud-synced gear pack
export const createGearPack = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để lưu cấu hình balo.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const uid = new Types.ObjectId(userId);
    const existingCount = await GearPackModel.countDocuments({ userId: uid });
    if (existingCount >= MAX_PACKS_PER_USER) {
      return res.status(400).json({
        success: false,
        message: `Bạn đã đạt giới hạn tối đa ${MAX_PACKS_PER_USER} cấu hình balo. Vui lòng xóa bớt trước khi tạo mới.`,
      });
    }

    const { name, trailSlug, bodyWeightKg = 65, items: rawItems = [], isPublic = false } = req.body || {};
    const cleanName = sanitizeInput(String(name || '')).slice(0, 120);
    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ success: false, message: 'Tên cấu hình balo phải có ít nhất 2 ký tự.' });
    }

    if (containsProfanity(cleanName)) {
      const matched = getProfanityMatch(cleanName);
      return res.status(400).json({
        success: false,
        message: `Tên cấu hình balo chứa từ ngữ vi phạm quy chuẩn cộng đồng ("${matched}").`,
      });
    }

    const { items, error } = sanitizePackItems(rawItems);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    let safeBodyWeight = 65;
    if (bodyWeightKg !== undefined && bodyWeightKg !== null && bodyWeightKg !== '') {
      const parsedBodyWeight = Number(bodyWeightKg);
      if (!Number.isFinite(parsedBodyWeight) || parsedBodyWeight < 25 || parsedBodyWeight > 200) {
        return res.status(400).json({ success: false, message: 'Cân nặng cơ thể phải nằm trong khoảng 25–200 kg.' });
      }
      safeBodyWeight = Math.round(parsedBodyWeight * 10) / 10;
    }

    const cleanTrailSlug =
      typeof trailSlug === 'string' && trailSlug.trim() ? sanitizeInput(trailSlug).slice(0, 80) : '';

    const shareSlug = generateShareSlug();
    const created = await GearPackModel.create({
      userId: uid,
      shareSlug,
      name: cleanName,
      trailSlug: cleanTrailSlug,
      bodyWeightKg: safeBodyWeight,
      items,
      isPublic: Boolean(isPublic),
    });

    return res.status(201).json({
      success: true,
      message: 'Đã lưu cấu hình balo lên đám mây thành công!',
      data: formatPackResponse(created.toObject()),
    });
  } catch (err) {
    console.error('[Create Gear Pack Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lưu cấu hình balo.' });
  }
};

// PUT /api/gear-packs/:id - Strict owner update of a saved gear pack
export const updateGearPack = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = String(req.params.id || '').trim();
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã cấu hình balo không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const pack = await GearPackModel.findById(id);
    if (!pack) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cấu hình balo.' });
    }
    if (String(pack.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Chỉ chủ sở hữu mới có quyền chỉnh sửa cấu hình balo này.' });
    }

    const { name, trailSlug, bodyWeightKg, items: rawItems, isPublic } = req.body || {};

    if (name !== undefined) {
      const cleanName = sanitizeInput(String(name || '')).slice(0, 120);
      if (!cleanName || cleanName.length < 2) {
        return res.status(400).json({ success: false, message: 'Tên cấu hình balo phải có ít nhất 2 ký tự.' });
      }
      if (containsProfanity(cleanName)) {
        const matched = getProfanityMatch(cleanName);
        return res.status(400).json({
          success: false,
          message: `Tên cấu hình balo chứa từ ngữ vi phạm quy chuẩn cộng đồng ("${matched}").`,
        });
      }
      pack.name = cleanName;
    }

    if (trailSlug !== undefined) {
      pack.trailSlug = typeof trailSlug === 'string' ? sanitizeInput(trailSlug).slice(0, 80) : '';
    }

    if (bodyWeightKg !== undefined) {
      const parsedBodyWeight = Number(bodyWeightKg);
      if (!Number.isFinite(parsedBodyWeight) || parsedBodyWeight < 25 || parsedBodyWeight > 200) {
        return res.status(400).json({ success: false, message: 'Cân nặng cơ thể phải nằm trong khoảng 25–200 kg.' });
      }
      pack.bodyWeightKg = Math.round(parsedBodyWeight * 10) / 10;
    }

    if (rawItems !== undefined) {
      const { items, error } = sanitizePackItems(rawItems);
      if (error) {
        return res.status(400).json({ success: false, message: error });
      }
      pack.items = items;
    }

    if (isPublic !== undefined) {
      pack.isPublic = Boolean(isPublic);
    }

    await pack.save();

    return res.json({
      success: true,
      message: 'Đã cập nhật cấu hình balo thành công!',
      data: formatPackResponse(pack.toObject()),
    });
  } catch (err) {
    console.error('[Update Gear Pack Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật cấu hình balo.' });
  }
};

// DELETE /api/gear-packs/:id - Strict owner delete
export const deleteGearPack = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = String(req.params.id || '').trim();
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã cấu hình balo không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const pack = await GearPackModel.findById(id).select('userId').lean();
    if (!pack) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cấu hình balo.' });
    }
    if (String(pack.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Chỉ chủ sở hữu mới có quyền xóa cấu hình balo này.' });
    }

    await GearPackModel.deleteOne({ _id: id });
    return res.json({ success: true, message: 'Đã xóa cấu hình balo thành công!' });
  } catch (err) {
    console.error('[Delete Gear Pack Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa cấu hình balo.' });
  }
};

// GET /api/gear-packs/share/:shareSlug - View shared public gear pack (or owner's private pack)
export const getSharedGearPack = async (req: AuthRequest, res: Response) => {
  try {
    const shareSlug = String(req.params.shareSlug || '').trim().toLowerCase();
    if (!shareSlug || shareSlug.length > 64) {
      return res.status(400).json({ success: false, message: 'Mã chia sẻ balo không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const pack: any = await GearPackModel.findOne({ shareSlug })
      .populate('userId', 'fullName avatarUrl badges')
      .lean();

    if (!pack) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cấu hình balo được chia sẻ.' });
    }

    const ownerId = pack.userId?._id ? String(pack.userId._id) : String(pack.userId || '');
    const isOwner = Boolean(req.user?.userId && String(req.user.userId) === ownerId);

    if (!pack.isPublic && !isOwner) {
      return res.status(403).json({ success: false, message: 'Cấu hình balo này đang ở chế độ riêng tư.' });
    }

    return res.json({
      success: true,
      data: {
        ...formatPackResponse(pack),
        isOwner,
      },
    });
  } catch (err) {
    console.error('[Get Shared Gear Pack Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải cấu hình balo chia sẻ.' });
  }
};
