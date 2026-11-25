import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { TrailConditionModel } from '../models/TrailCondition.js';
import { UserModel } from '../models/User.js';
import { awardReputationPoints } from '../utils/reputation.js';
import { sanitizeInput, isSafeHttpUrl } from '../utils/validation.js';
import { containsProfanity, getProfanityMatch } from '../utils/profanityFilter.js';
import { isValidObjectId, resolveTrailByIdOrSlug } from '../utils/resolveTrail.js';
import { recordAuditLog } from '../utils/audit.js';
import { invalidateCache } from '../middleware/cache.middleware.js';

const VALID_CONDITIONS = new Set(['safe', 'caution', 'dangerous', 'closed']);
const REP_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours per trail before earning another +10 rep

function formatConditionForViewer(doc: any, viewerId?: string) {
  const { upvotedUsers, ...rest } = doc;
  const hasUpvoted = Boolean(
    viewerId &&
      Array.isArray(upvotedUsers) &&
      upvotedUsers.some((uid: any) => String(uid) === String(viewerId))
  );
  return {
    ...rest,
    hasUpvoted,
  };
}

// POST /api/trail-conditions - Submit a condition update for a real trail
export const createTrailCondition = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để báo cáo tình trạng đường.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const { trailId, condition, description, section, weatherNote, photos } = req.body || {};
    if (
      !trailId ||
      typeof condition !== 'string' ||
      !VALID_CONDITIONS.has(condition) ||
      typeof description !== 'string' ||
      !description.trim()
    ) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ tình trạng đường hợp lệ và mô tả.' });
    }

    const cleanDesc = sanitizeInput(description).slice(0, 1500);
    if (!cleanDesc.trim()) {
      return res.status(400).json({ success: false, message: 'Mô tả tình trạng đường không hợp lệ.' });
    }
    if (containsProfanity(cleanDesc)) {
      const matched = getProfanityMatch(cleanDesc);
      return res.status(400).json({
        success: false,
        message: `Báo cáo chứa từ ngữ vi phạm quy chuẩn cộng đồng ("${matched}").`,
      });
    }

    const resolvedTrail = await resolveTrailByIdOrSlug(String(trailId));
    if (!resolvedTrail) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường này trong hệ thống.' });
    }

    const userObjId = new mongoose.Types.ObjectId(userId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const cleanSection = sanitizeInput(String(section || 'Toàn tuyến')).slice(0, 120);
    const cleanWeather = sanitizeInput(String(weatherNote || '')).slice(0, 300);
    const safePhotos = Array.isArray(photos) ? photos.filter((u: unknown) => isSafeHttpUrl(u)).slice(0, 6) : [];

    // Check if user already posted recently on this trail (prevent infinite +10 rep farming)
    const recentByUser = await TrailConditionModel.exists({
      userId: userObjId,
      trailId: resolvedTrail._id,
      createdAt: { $gte: new Date(Date.now() - REP_COOLDOWN_MS) },
    });

    const userDoc = await UserModel.findById(userObjId).select('fullName avatarUrl reputationScore').lean();

    const created = await TrailConditionModel.create({
      userId: userObjId,
      trailId: resolvedTrail._id,
      condition: condition as 'safe' | 'caution' | 'dangerous' | 'closed',
      description: cleanDesc,
      section: cleanSection,
      weatherNote: cleanWeather,
      photos: safePhotos,
      expiresAt,
      isActive: true,
    });

    let pointsAwarded = 0;
    if (!recentByUser) {
      const rep = await awardReputationPoints(userId, 10, 'Cập nhật tình trạng thực địa cung đường').catch(() => null);
      if (rep) pointsAwarded = 10;
    }

    const savedCondition = formatConditionForViewer(
      {
        ...created.toObject(),
        userId: {
          _id: userObjId,
          fullName: userDoc?.fullName || 'Trekker Thực Địa',
          avatarUrl: userDoc?.avatarUrl || '',
          reputationScore: (userDoc?.reputationScore ?? 50) + pointsAwarded,
        },
      },
      userId
    );

    return res.status(201).json({
      success: true,
      message: pointsAwarded
        ? 'Cảm ơn bạn đã cập nhật tình trạng thực địa! Bạn nhận được +10 điểm uy tín.'
        : 'Cảm ơn bạn đã cập nhật tình trạng thực địa!',
      data: savedCondition,
    });
  } catch (err) {
    console.error('[Create Trail Condition Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo báo cáo tình trạng.' });
  }
};

// GET /api/trail-conditions/trail/:trailId - Get active condition updates (strips upvotedUsers, adds hasUpvoted)
export const getTrailConditions = async (req: AuthRequest, res: Response) => {
  try {
    const rawTrailId = String(req.params.trailId || '').trim();
    if (!rawTrailId || rawTrailId.length > 100) {
      return res.status(400).json({ success: false, message: 'Mã cung đường không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, data: [] });
    }

    const candidateIds: any[] = [rawTrailId];
    if (isValidObjectId(rawTrailId)) {
      candidateIds.push(new mongoose.Types.ObjectId(rawTrailId));
    }

    const matchedTrail = await resolveTrailByIdOrSlug(rawTrailId);
    if (matchedTrail) {
      candidateIds.push(matchedTrail._id, String(matchedTrail._id));
      if (matchedTrail.id) candidateIds.push(matchedTrail.id);
    }

    const conditions = await TrailConditionModel.find({
      trailId: { $in: candidateIds },
      isActive: true,
      expiresAt: { $gt: new Date() },
    })
      .populate('userId', 'fullName avatarUrl reputationScore')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const viewerId = req.user?.userId;
    return res.json({
      success: true,
      data: conditions.map((c) => formatConditionForViewer(c, viewerId)),
    });
  } catch (err) {
    console.error('[Get Trail Conditions Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải tình trạng đường.' });
  }
};

// POST /api/trail-conditions/:id/upvote - Atomic upvote deduplicated per userId
export const upvoteTrailCondition = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để xác nhận.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã báo cáo không hợp lệ.' });
    }

    const userObjId = new mongoose.Types.ObjectId(userId);
    const updated = await TrailConditionModel.findOneAndUpdate(
      { _id: id, upvotedUsers: { $ne: userObjId } },
      { $addToSet: { upvotedUsers: userObjId }, $inc: { upvotes: 1 } },
      { new: true }
    );
    if (updated) {
      return res.json({ success: true, message: 'Đã xác nhận thành công!', upvotes: updated.upvotes, hasUpvoted: true });
    }

    const exists = await TrailConditionModel.exists({ _id: id });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Bạn đã xác nhận báo cáo này rồi.' });
    }
    return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo.' });
  } catch (err) {
    console.error('[Upvote Condition Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xác nhận báo cáo.' });
  }
};

// PATCH /api/trail-conditions/:id - Owner/Staff edit of status/condition, description, section, weatherNote, photos
export const updateTrailCondition = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const isStaff = req.user?.role === 'admin' || req.user?.role === 'moderator';
    const conditionId = String(req.params.id || '').trim();

    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để chỉnh sửa báo cáo.' });
    }
    if (!isValidObjectId(conditionId)) {
      return res.status(400).json({ success: false, message: 'Mã báo cáo không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const existing = await TrailConditionModel.findById(conditionId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo.' });
    }
    if (!isStaff && String(existing.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa báo cáo này.' });
    }

    const { status, condition, description, section, weatherNote, photos } = req.body || {};
    const nextStatus = condition ?? status;

    if (nextStatus !== undefined) {
      if (typeof nextStatus !== 'string' || !VALID_CONDITIONS.has(nextStatus)) {
        return res.status(400).json({ success: false, message: 'Trạng thái tình trạng đường không hợp lệ.' });
      }
      existing.condition = nextStatus as 'safe' | 'caution' | 'dangerous' | 'closed';
    }

    if (description !== undefined) {
      if (typeof description !== 'string' || !description.trim()) {
        return res.status(400).json({ success: false, message: 'Mô tả tình trạng đường không được để trống.' });
      }
      const cleanDesc = sanitizeInput(description).slice(0, 1500);
      if (!cleanDesc.trim()) {
        return res.status(400).json({ success: false, message: 'Mô tả tình trạng đường không hợp lệ.' });
      }
      if (containsProfanity(cleanDesc)) {
        const matched = getProfanityMatch(cleanDesc);
        return res.status(400).json({
          success: false,
          message: `Báo cáo chứa từ ngữ vi phạm quy chuẩn cộng đồng ("${matched}").`,
        });
      }
      existing.description = cleanDesc;
    }

    if (section !== undefined) {
      existing.section = sanitizeInput(String(section || 'Toàn tuyến')).slice(0, 120) || 'Toàn tuyến';
    }

    if (weatherNote !== undefined) {
      existing.weatherNote = sanitizeInput(String(weatherNote || '')).slice(0, 300);
    }

    if (photos !== undefined) {
      if (!Array.isArray(photos)) {
        return res.status(400).json({ success: false, message: 'Danh sách ảnh đính kèm không hợp lệ.' });
      }
      existing.photos = photos.filter((u: unknown) => isSafeHttpUrl(u)).slice(0, 4);
    }

    await existing.save();

    const populated = await TrailConditionModel.findById(existing._id)
      .populate('userId', 'fullName avatarUrl reputationScore')
      .lean();

    invalidateCache('/api/trails');
    await recordAuditLog(req, 'UPDATE_TRAIL_CONDITION', 'trail_conditions', `Cập nhật báo cáo tình trạng đường ${conditionId}`);

    return res.json({
      success: true,
      message: 'Đã cập nhật báo cáo tình trạng đường thành công!',
      data: formatConditionForViewer(populated || existing.toObject(), userId),
    });
  } catch (err) {
    console.error('[Update Trail Condition Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật báo cáo tình trạng.' });
  }
};

// DELETE /api/trail-conditions/:conditionId & DELETE /api/trails/:id/conditions/:conditionId
export const deleteTrailCondition = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const isStaff = req.user?.role === 'admin' || req.user?.role === 'moderator';
    const conditionId = String(req.params.conditionId || req.params.id || '').trim();
    const scopedTrailParam = req.params.conditionId && req.params.id ? String(req.params.id).trim() : '';

    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(conditionId)) {
      return res.status(400).json({ success: false, message: 'Mã báo cáo không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const cond = await TrailConditionModel.findById(conditionId).select('userId trailId').lean();
    if (!cond) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo.' });
    }

    if (scopedTrailParam) {
      const trail = await resolveTrailByIdOrSlug(scopedTrailParam);
      if (trail && String(cond.trailId) !== String(trail._id) && String(cond.trailId) !== String(trail.id)) {
        return res.status(404).json({ success: false, message: 'Báo cáo không thuộc cung đường này.' });
      }
    }

    if (!isStaff && String(cond.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa báo cáo này.' });
    }

    await TrailConditionModel.deleteOne({ _id: conditionId });
    invalidateCache('/api/trails');
    await recordAuditLog(req, 'DELETE_TRAIL_CONDITION', 'trail_conditions', `Xóa báo cáo tình trạng đường ${conditionId}`);
    return res.json({ success: true, message: 'Đã xóa báo cáo tình trạng đường.' });
  } catch (err) {
    console.error('[Delete Trail Condition Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa báo cáo.' });
  }
};
