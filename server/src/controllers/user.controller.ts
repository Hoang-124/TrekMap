import { Response } from 'express';
import { UserModel } from '../models/User.js';
import { TrailModel } from '../models/Trail.js';
import { Contribution } from '../models/Contribution.js';
import { IncidentModel } from '../models/Incident.js';
import { ReviewModel } from '../models/Review.js';
import { ThreadModel } from '../models/Thread.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

// GET /api/admin/users - Get all users (Admin only)
export const getUsersAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Yêu cầu quyền Admin.' });
    }
    const users = await UserModel.find().select('-passwordHash').sort({ createdAt: -1 }).lean().exec();
    return res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    console.error('[Get Users Admin Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách người dùng.' });
  }
};

// PUT /api/admin/users/:id/ban - Ban user
export const banUserAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Yêu cầu quyền Admin.' });
    }
    const { id } = req.params;
    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    user.role = 'user'; // ensure not admin
    (user as any).isBanned = true;
    await user.save();
    return res.json({ success: true, message: `Đã khóa tài khoản ${user.email} thành công!` });
  } catch (err) {
    console.error('[Ban User Admin Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi khóa người dùng.' });
  }
};

// PUT /api/admin/users/:id/unban - Unban user
export const unbanUserAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Yêu cầu quyền Admin.' });
    }
    const { id } = req.params;
    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    (user as any).isBanned = false;
    await user.save();
    return res.json({ success: true, message: `Đã mở khóa tài khoản ${user.email}!` });
  } catch (err) {
    console.error('[Unban User Admin Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi mở khóa người dùng.' });
  }
};

// GET /api/admin/stats - Overview analytics numbers
export const getAdminStats = async (req: AuthRequest, res: Response) => {
  try {
    const totalUsers = await UserModel.countDocuments().catch(() => 0);
    const totalTrails = await TrailModel.countDocuments().catch(() => 0);
    const totalContributions = await Contribution.countDocuments().catch(() => 0);
    const pendingContributions = await Contribution.countDocuments({ status: 'pending' }).catch(() => 0);
    const totalIncidents = await IncidentModel.countDocuments().catch(() => 0);
    const totalReviews = await ReviewModel.countDocuments().catch(() => 0);
    const totalThreads = await ThreadModel.countDocuments().catch(() => 0);

    return res.json({
      success: true,
      data: {
        totalUsers,
        totalTrails,
        totalContributions,
        pendingContributions,
        totalIncidents,
        totalReviews,
        totalThreads,
      },
    });
  } catch (err) {
    console.error('[Admin Stats Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi lấy thống kê hệ thống.' });
  }
};
