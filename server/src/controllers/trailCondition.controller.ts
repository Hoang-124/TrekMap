import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { TrailConditionModel } from '../models/TrailCondition';
import { UserModel } from '../models/User';

// POST /api/trail-conditions - Submit a condition update for a trail
export const createTrailCondition = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để báo cáo tình trạng đường.' });
    }

    const { trailId, condition, description, section, weatherNote, photos } = req.body;
    if (!trailId || !condition || !description) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ thông tin bắt buộc.' });
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Expiration in 7 days

    const newCondition = await TrailConditionModel.create({
      userId: userId as any,
      trailId: trailId as any,
      condition,
      description,
      section: section || 'Toàn tuyến',
      weatherNote: weatherNote || '',
      photos: photos || [],
      expiresAt,
      isActive: true,
    });

    // Reward reputation points (+10) for trail safety contribution
    await UserModel.findByIdAndUpdate(userId, { $inc: { reputationScore: 10 } }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Cảm ơn bạn đã cập nhật tình trạng thực địa! Bạn nhận được +10 điểm uy tín.',
      data: newCondition,
    });
  } catch (err) {
    console.error('[Create Trail Condition Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo báo cáo tình trạng.' });
  }
};

// GET /api/trail-conditions/trail/:trailId - Get active condition updates for a trail
export const getTrailConditions = async (req: AuthRequest, res: Response) => {
  try {
    const { trailId } = req.params;
    const conditions = await TrailConditionModel.find({
      trailId: trailId as any,
      isActive: true,
      expiresAt: { $gt: new Date() },
    })
      .populate('userId', 'fullName avatarUrl reputationScore')
      .sort({ createdAt: -1 })
      .limit(10);

    return res.json({ success: true, data: conditions });
  } catch (err) {
    console.error('[Get Trail Conditions Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải tình trạng đường.' });
  }
};

// POST /api/trail-conditions/:id/upvote - Confirm/upvote a condition report
export const upvoteTrailCondition = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để xác nhận.' });
    }

    const { id } = req.params;
    const condition = await TrailConditionModel.findById(id);
    if (!condition) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo.' });
    }

    const hasUpvoted = condition.upvotedUsers.some((u) => u.toString() === userId.toString());
    if (hasUpvoted) {
      return res.status(400).json({ success: false, message: 'Bạn đã xác nhận báo cáo này rồi.' });
    }

    condition.upvotedUsers.push(userId as any);
    condition.upvotes += 1;
    await condition.save();

    return res.json({ success: true, message: 'Đã xác nhận thành công!', upvotes: condition.upvotes });
  } catch (err) {
    console.error('[Upvote Condition Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xác nhận báo cáo.' });
  }
};
