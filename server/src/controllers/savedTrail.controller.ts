import { Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { SavedTrailModel } from '../models/SavedTrail.js';
import { GearChecklistModel } from '../models/GearChecklist.js';
import { UserModel } from '../models/User.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { isValidObjectId, resolveTrailByIdOrSlug } from '../utils/resolveTrail.js';
import { sanitizeInput } from '../utils/validation.js';
import { containsProfanity, getProfanityMatch } from '../utils/profanityFilter.js';

const DEFAULT_COLLECTION_NAME = 'Muốn đi';

function parseStrictFiniteNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '' || typeof val === 'boolean') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function parseSafeBoolean(val: unknown, fallback: boolean): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0' || lower === '') return false;
  }
  if (typeof val === 'number') {
    if (val === 1) return true;
    if (val === 0) return false;
  }
  return fallback;
}

// GET /api/saved-trails & GET /api/saved-trails/me - Get current user's wishlist / collections / saved offline trails
export const getMySavedTrails = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: 0, data: [] });
    }
    const saved = await SavedTrailModel.find({ userId: new Types.ObjectId(userId) })
      .populate('trailId')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    const activeSaved = saved
      .filter((item: any) => Boolean(item.trailId))
      .map((item: any) => ({
        ...item,
        collectionName: item.collectionName || DEFAULT_COLLECTION_NAME,
        personalNote: item.personalNote || '',
        plannedMonth: typeof item.plannedMonth === 'number' ? item.plannedMonth : null,
      }));
    return res.json({ success: true, count: activeSaved.length, data: activeSaved });
  } catch (err) {
    console.error('[Get Saved Trails Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách cung đường đã lưu.' });
  }
};

// PATCH /api/saved-trails/:trailId - Update wishlist collection folder, personal note & planned month (strict owner)
export const updateSavedTrailMeta = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    const trailIdParam = String(req.params.trailId || '').trim();
    if (!trailIdParam) {
      return res.status(400).json({ success: false, message: 'Thiếu mã cung đường.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const trail = await resolveTrailByIdOrSlug(trailIdParam);
    if (!trail || (trail.status && trail.status !== 'approved')) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường.' });
    }

    const { collectionName, personalNote, plannedMonth, savedOffline } = req.body || {};
    const update: Record<string, any> = {};

    if (collectionName !== undefined) {
      if (typeof collectionName !== 'string') {
        return res.status(400).json({ success: false, message: 'Tên bộ sưu tập không hợp lệ.' });
      }
      const cleanCol = sanitizeInput(collectionName).slice(0, 40) || DEFAULT_COLLECTION_NAME;
      if (containsProfanity(cleanCol)) {
        const matched = getProfanityMatch(cleanCol);
        return res.status(400).json({ success: false, message: `Tên bộ sưu tập chứa từ ngữ không phù hợp ("${matched}").` });
      }
      update.collectionName = cleanCol;
    }

    if (personalNote !== undefined) {
      if (typeof personalNote !== 'string') {
        return res.status(400).json({ success: false, message: 'Ghi chú cá nhân không hợp lệ.' });
      }
      const cleanNote = sanitizeInput(personalNote).slice(0, 500);
      if (cleanNote && containsProfanity(cleanNote)) {
        const matched = getProfanityMatch(cleanNote);
        return res.status(400).json({ success: false, message: `Ghi chú chứa từ ngữ không phù hợp ("${matched}").` });
      }
      update.personalNote = cleanNote;
    }

    if (plannedMonth !== undefined) {
      if (plannedMonth === null || plannedMonth === '') {
        update.plannedMonth = null;
      } else {
        const m = Number(plannedMonth);
        if (!Number.isInteger(m) || m < 1 || m > 12) {
          return res.status(400).json({ success: false, message: 'Tháng dự kiến phải là số nguyên từ 1 đến 12.' });
        }
        update.plannedMonth = m;
      }
    }

    if (typeof savedOffline === 'boolean') {
      update.savedOffline = savedOffline;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: 'Không có thông tin hợp lệ để cập nhật.' });
    }

    const uid = new Types.ObjectId(userId);
    const setOnInsertFields: Record<string, any> = {};
    if (update.savedOffline === undefined) setOnInsertFields.savedOffline = false;
    if (update.collectionName === undefined) setOnInsertFields.collectionName = DEFAULT_COLLECTION_NAME;

    const updateDoc: Record<string, any> = { $set: update };
    if (Object.keys(setOnInsertFields).length > 0) {
      updateDoc.$setOnInsert = setOnInsertFields;
    }

    let updated: any = null;
    try {
      updated = await SavedTrailModel.findOneAndUpdate({ userId: uid, trailId: trail._id }, updateDoc, {
        upsert: true,
        new: true,
      })
        .populate('trailId')
        .lean();
    } catch (upsertErr: any) {
      if (upsertErr?.code === 11000) {
        updated = await SavedTrailModel.findOneAndUpdate(
          { userId: uid, trailId: trail._id },
          { $set: update },
          { new: true }
        )
          .populate('trailId')
          .lean();
      } else {
        throw upsertErr;
      }
    }

    await UserModel.updateOne({ _id: uid }, { $addToSet: { savedTrails: trail._id } }).catch(() => {});

    return res.json({
      success: true,
      message: 'Đã cập nhật bộ sưu tập và ghi chú cung đường!',
      data: {
        ...updated,
        collectionName: updated?.collectionName || DEFAULT_COLLECTION_NAME,
        personalNote: updated?.personalNote || '',
        plannedMonth: typeof updated?.plannedMonth === 'number' ? updated.plannedMonth : null,
      },
    });
  } catch (err) {
    console.error('[Update Saved Trail Meta Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật thông tin cung đường đã lưu.' });
  }
};

// POST /api/saved-trails/:trailId - Save or toggle savedOffline status
export const toggleSavedTrail = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    const trailIdParam = String(req.params.trailId || '').trim();
    if (!trailIdParam) {
      return res.status(400).json({ success: false, message: 'Thiếu mã cung đường.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const trail = await resolveTrailByIdOrSlug(trailIdParam);
    if (!trail || (trail.status && trail.status !== 'approved')) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường.' });
    }

    const uid = new Types.ObjectId(userId);
    const { savedOffline, forceSave } = req.body || {};
    const parsedForceSave = parseSafeBoolean(forceSave, false);
    const hasSavedOffline = savedOffline !== undefined;
    const parsedSavedOffline = parseSafeBoolean(savedOffline, false);

    if (!parsedForceSave && !hasSavedOffline) {
      const deleted = await SavedTrailModel.findOneAndDelete({ userId: uid, trailId: trail._id });
      if (deleted) {
        await UserModel.updateOne({ _id: uid }, { $pull: { savedTrails: trail._id } }).catch(() => {});
        return res.json({ success: true, saved: false, message: `Đã bỏ lưu cung đường ${trail.name}.` });
      }
    }

    const toggleUpdate: Record<string, any> = hasSavedOffline
      ? {
          $set: { savedOffline: parsedSavedOffline },
          $setOnInsert: { collectionName: DEFAULT_COLLECTION_NAME },
        }
      : {
          $setOnInsert: { savedOffline: false, collectionName: DEFAULT_COLLECTION_NAME },
        };

    let doc: any = null;
    try {
      doc = await SavedTrailModel.findOneAndUpdate({ userId: uid, trailId: trail._id }, toggleUpdate, {
        upsert: true,
        new: true,
      });
    } catch (upsertErr: any) {
      if (upsertErr?.code === 11000) {
        doc = hasSavedOffline
          ? await SavedTrailModel.findOneAndUpdate(
              { userId: uid, trailId: trail._id },
              { $set: { savedOffline: parsedSavedOffline } },
              { new: true }
            )
          : await SavedTrailModel.findOne({ userId: uid, trailId: trail._id });
      } else {
        throw upsertErr;
      }
    }
    await UserModel.updateOne({ _id: uid }, { $addToSet: { savedTrails: trail._id } }).catch(() => {});

    return res.json({
      success: true,
      saved: true,
      data: doc,
      message: `Đã lưu cung đường ${trail.name} vào danh sách yêu thích!`,
    });
  } catch (err) {
    console.error('[Toggle Saved Trail Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi lưu cung đường.' });
  }
};

// DELETE /api/saved-trails/:trailId - Explicitly remove saved trail
export const removeSavedTrail = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }
    const trail = await resolveTrailByIdOrSlug(String(req.params.trailId || ''));
    if (!trail) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường.' });
    }
    const uid = new Types.ObjectId(userId);
    await SavedTrailModel.deleteOne({ userId: uid, trailId: trail._id });
    await UserModel.updateOne({ _id: uid }, { $pull: { savedTrails: trail._id } }).catch(() => {});
    return res.json({ success: true, saved: false, message: 'Đã gỡ khỏi danh sách đã lưu.' });
  } catch (err) {
    console.error('[Remove Saved Trail Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi gỡ cung đường đã lưu.' });
  }
};

// GET /api/gear-checklists/:trailId - Get user's cloud-synced gear checklist for a trail
export const getGearChecklist = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, data: null });
    }
    const trail = await resolveTrailByIdOrSlug(String(req.params.trailId || ''));
    if (!trail) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường.' });
    }
    const doc = await GearChecklistModel.findOne({
      userId: new Types.ObjectId(userId),
      trailId: trail._id,
    }).lean();
    return res.json({ success: true, data: doc || null });
  } catch (err) {
    console.error('[Get Gear Checklist Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải checklist trang bị.' });
  }
};

// PUT /api/gear-checklists/:trailId - Upsert user's cloud-synced gear checklist
export const upsertGearChecklist = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    const { items, bodyWeightKg = 65, title, createdForDays } = req.body || {};
    if (!Array.isArray(items) || items.length > 100) {
      return res.status(400).json({ success: false, message: 'Danh sách trang bị không hợp lệ (tối đa 100 món).' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const trail = await resolveTrailByIdOrSlug(String(req.params.trailId || ''));
    if (!trail) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường.' });
    }

    const safeItems = items
      .filter((it: any) => it && typeof it.name === 'string' && it.name.trim())
      .map((it: any, idx: number) => {
        const parsedQty = parseStrictFiniteNumber(it.recommendedQty);
        const parsedWeight = parseStrictFiniteNumber(it.weightGrams);
        return {
          id: String(it.id || idx + 1).slice(0, 40),
          name: sanitizeInput(String(it.name)).slice(0, 140),
          category: sanitizeInput(String(it.category || 'Khác')).slice(0, 60),
          recommendedQty: Math.max(1, Math.min(20, Math.round(parsedQty ?? 1))),
          weightGrams: Math.max(0, Math.min(25000, Math.round(parsedWeight ?? 0))),
          isEssential: parseSafeBoolean(it.isEssential, false),
          checked: parseSafeBoolean(it.checked, false),
          reason: typeof it.reason === 'string' ? sanitizeInput(it.reason).slice(0, 140) : '',
        };
      });

    const parsedBodyKg = parseStrictFiniteNumber(bodyWeightKg);
    const safeBodyWeight = Math.max(30, Math.min(200, Math.round(parsedBodyKg ?? 65)));
    const parsedDays = parseStrictFiniteNumber(createdForDays) ?? parseStrictFiniteNumber(trail.durationDays) ?? 1;
    const safeDays = Math.max(1, Math.min(60, Math.round(parsedDays)));

    const doc = await GearChecklistModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), trailId: trail._id },
      {
        $set: {
          trailSlug: trail.id,
          title: sanitizeInput(String(title || `Checklist ${trail.name}`)).slice(0, 140),
          bodyWeightKg: safeBodyWeight,
          items: safeItems,
          createdForDays: safeDays,
        },
      },
      { upsert: true, new: true }
    );

    return res.json({ success: true, message: 'Đã đồng bộ danh sách trang bị lên tài khoản!', data: doc });
  } catch (err) {
    console.error('[Upsert Gear Checklist Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi lưu checklist trang bị.' });
  }
};
