import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { UserModel, type IUserAnnualGoals } from '../models/User.js';
import { TrailModel } from '../models/Trail.js';
import { Contribution } from '../models/Contribution.js';
import { IncidentModel } from '../models/Incident.js';
import { ReviewModel } from '../models/Review.js';
import { ThreadModel } from '../models/Thread.js';
import { FollowModel } from '../models/Follow.js';
import { CheckinModel } from '../models/Checkin.js';
import { TripReportModel } from '../models/TripReport.js';
import { TripPlanModel } from '../models/TripPlan.js';
import { GuideModel } from '../models/Guide.js';
import { SafetyTimerModel } from '../models/SafetyTimer.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { emitToUser } from '../config/socket.js';
import { isValidObjectId } from '../utils/resolveTrail.js';
import { recordAuditLog } from '../utils/audit.js';
import { sanitizeInput } from '../utils/validation.js';

// GET /api/admin/users - Get paginated users (Admin only)
export const getUsersAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Yêu cầu quyền Admin.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: 0, total: 0, data: [] });
    }
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 200);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      UserModel.find()
        .select('-passwordHash -activationCode -activationToken -resetOtpCode -resetPasswordToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      UserModel.countDocuments(),
    ]);

    return res.json({ success: true, count: users.length, total, data: users });
  } catch (err) {
    console.error('[Get Users Admin Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách người dùng.' });
  }
};

// PUT /api/admin/users/:id/ban - Ban user & revoke active JWT sessions (preserves role & saves banReason)
export const banUserAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Yêu cầu quyền Admin.' });
    }
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã người dùng không hợp lệ.' });
    }
    if (String(id) === String(req.user.userId)) {
      return res.status(400).json({ success: false, message: 'Không thể tự khóa tài khoản quản trị của chính bạn.' });
    }

    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    const reason = sanitizeInput(String(req.body?.banReason || req.body?.reason || 'Vi phạm quy định cộng đồng LOST')).slice(0, 300);
    user.isBanned = true;
    user.banReason = reason;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    emitToUser(user._id.toString(), 'userBanned', {
      userId: user._id.toString(),
      reason,
    });
    await recordAuditLog(req, 'BAN_USER', 'users', `Khóa tài khoản ${user.email} (${user._id}) — Lý do: ${reason}`);

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
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã người dùng không hợp lệ.' });
    }

    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    user.isBanned = false;
    user.banReason = '';
    await user.save();

    emitToUser(user._id.toString(), 'userUnbanned', {
      userId: user._id.toString(),
    });
    await recordAuditLog(req, 'UNBAN_USER', 'users', `Mở khóa tài khoản ${user.email} (${user._id})`);

    return res.json({ success: true, message: `Đã mở khóa tài khoản ${user.email}!` });
  } catch (err) {
    console.error('[Unban User Admin Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi mở khóa người dùng.' });
  }
};

// GET /api/admin/stats - Concurrent overview analytics counts (Admin + Moderator)
export const getAdminStats = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'moderator') {
      return res.status(403).json({ success: false, message: 'Yêu cầu quyền Admin hoặc Moderator.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        data: {
          totalUsers: 0,
          totalTrails: 0,
          totalContributions: 0,
          pendingContributions: 0,
          totalIncidents: 0,
          totalReviews: 0,
          totalThreads: 0,
          totalCheckins: 0,
          totalTripPlans: 0,
          totalTripReports: 0,
          totalGuides: 0,
          activeSafetyTimers: 0,
        },
      });
    }

    const [
      totalUsers,
      totalTrails,
      totalContributions,
      pendingContributions,
      totalIncidents,
      totalReviews,
      totalThreads,
      totalCheckins,
      totalTripPlans,
      totalTripReports,
      totalGuides,
      activeSafetyTimers,
    ] = await Promise.all([
      UserModel.countDocuments().catch(() => 0),
      TrailModel.countDocuments({ status: 'approved' }).catch(() => 0),
      Contribution.countDocuments().catch(() => 0),
      Contribution.countDocuments({ status: 'pending' }).catch(() => 0),
      IncidentModel.countDocuments({ active: { $ne: false }, resolved: { $ne: true } }).catch(() => 0),
      ReviewModel.countDocuments().catch(() => 0),
      ThreadModel.countDocuments().catch(() => 0),
      CheckinModel.countDocuments().catch(() => 0),
      TripPlanModel.countDocuments().catch(() => 0),
      TripReportModel.countDocuments().catch(() => 0),
      GuideModel.countDocuments({ isActive: { $ne: false } }).catch(() => 0),
      SafetyTimerModel.countDocuments({ status: 'active' }).catch(() => 0),
    ]);

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
        totalCheckins,
        totalTripPlans,
        totalTripReports,
        totalGuides,
        activeSafetyTimers,
      },
    });
  } catch (err) {
    console.error('[Admin Stats Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi lấy thống kê hệ thống.' });
  }
};

// PUT /api/admin/users/:id/role - Change user role (Admin only)
export const updateUserRoleAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Yêu cầu quyền Admin.' });
    }
    const { id } = req.params;
    const { role } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã người dùng không hợp lệ.' });
    }

    const validRoles = ['admin', 'guide', 'moderator', 'user'];
    if (typeof role !== 'string' || !validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ.' });
    }

    if (String(id) === String(req.user.userId) && role !== 'admin') {
      return res.status(400).json({ success: false, message: 'Không thể tự hạ quyền Admin của chính bạn.' });
    }

    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    user.role = role as any;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    if (role === 'guide') {
      if (!user.badges) user.badges = [];
      if (!user.badges.includes('Verified Guide')) {
        user.badges.push('Verified Guide');
      }
    }
    await user.save();

    emitToUser(user._id.toString(), 'userRoleUpdated', {
      userId: user._id.toString(),
      role: user.role,
    });
    await recordAuditLog(req, 'UPDATE_USER_ROLE', 'users', `Đổi vai trò ${user.email} -> ${role}`);

    return res.json({
      success: true,
      message: `Đã cập nhật vai trò của ${user.fullName || user.email} thành ${role}!`,
      data: {
        _id: user._id.toString(),
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        badges: user.badges,
        isBanned: user.isBanned,
      },
    });
  } catch (err) {
    console.error('[Update User Role Admin Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật vai trò người dùng.' });
  }
};

// GET /api/users/profile/:identifier - 100% Real public profile (Zero PII, excludes banned, deduplicated hike stats)
export const getUserPublicProfile = async (req: Request, res: Response) => {
  try {
    const rawIdentifier = req.params.identifier;
    const identifier = (Array.isArray(rawIdentifier) ? rawIdentifier[0] : rawIdentifier) || '';
    if (!identifier.trim()) {
      return res.status(400).json({ success: false, message: 'Thiếu định danh người dùng.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const cleanIdent = identifier.trim().slice(0, 80);
    const isMongoId = isValidObjectId(cleanIdent);
    const escaped = cleanIdent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const projection =
      'username fullName avatarUrl coverUrl role authProvider isEmailVerified reputationScore badges bio preferredStyle gearLocker createdAt';

    // Lookup priority: 1) immutable _id, 2) indexed username, 3) exact fullName fallback (never banned users)
    let user: any = null;
    if (isMongoId) {
      user = await UserModel.findOne({ _id: new Types.ObjectId(cleanIdent), isBanned: { $ne: true } })
        .select(projection)
        .lean();
    }
    if (!user) {
      user = await UserModel.findOne({
        username: { $regex: new RegExp(`^${escaped}$`, 'i') },
        isBanned: { $ne: true },
      })
        .select(projection)
        .lean();
    }
    if (!user) {
      user = await UserModel.findOne({
        fullName: { $regex: new RegExp(`^${escaped}$`, 'i') },
        isBanned: { $ne: true },
      })
        .select(projection)
        .lean();
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ người dùng.' });
    }

    const userId = user._id;
    const userIdStr = userId.toString();

    const [
      threadsCount,
      reviewsCount,
      tripReportsCount,
      contributionsCount,
      followersCount,
      followingCount,
      checkins,
      recentThreads,
    ] = await Promise.all([
      ThreadModel.countDocuments({ userId }).catch(() => 0),
      ReviewModel.countDocuments({ userId }).catch(() => 0),
      TripReportModel.countDocuments({ authorId: userId }).catch(() => 0),
      Contribution.countDocuments({ userId: userIdStr, status: 'approved' }).catch(() => 0),
      FollowModel.countDocuments({ followingId: userId }).catch(() => 0),
      FollowModel.countDocuments({ followerId: userId }).catch(() => 0),
      CheckinModel.find({ userId })
        .populate('trailId', 'name maxAltitudeM distanceKm elevationGainM province region')
        .lean()
        .catch(() => []),
      ThreadModel.find({ userId })
        .select('id title category upvotes viewsCount repliesCount createdAt')
        .sort({ createdAt: -1 })
        .limit(3)
        .lean()
        .catch(() => []),
    ]);

    // Calculate 100% real hiked distance & highest summit strictly from deduplicated CheckinModel trails
    const seenTrailIds = new Set<string>();
    let totalDistanceKm = 0;
    let totalElevationGainM = 0;
    let highestAltitudeM = 0;
    let summitTrailName = '';

    for (const chk of checkins as any[]) {
      const trail = chk.trailId;
      if (trail && trail._id) {
        const tid = String(trail._id);
        if (!seenTrailIds.has(tid)) {
          seenTrailIds.add(tid);
          totalDistanceKm += Number(trail.distanceKm) || 0;
          totalElevationGainM += Number(trail.elevationGainM) || 0;
          if (trail.maxAltitudeM && trail.maxAltitudeM > highestAltitudeM) {
            highestAltitudeM = trail.maxAltitudeM;
            summitTrailName = trail.name;
          }
        }
      }
    }

    return res.json({
      success: true,
      data: {
        _id: userIdStr,
        username: user.username,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl || '',
        coverUrl: user.coverUrl || '',
        role: user.role,
        authProvider: user.authProvider,
        isEmailVerified: user.isEmailVerified,
        reputationScore: user.reputationScore || 0,
        badges: user.badges || [],
        bio: user.bio || '',
        preferredStyle: user.preferredStyle || 'Trekking & Camping',
        gearLocker: user.gearLocker || [],
        createdAt: user.createdAt,
        stats: {
          threadsCount,
          reviewsCount,
          tripReportsCount,
          contributionsCount,
          checkinsCount: seenTrailIds.size,
          totalCheckinEntries: (checkins as any[]).length,
          followersCount,
          followingCount,
          totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
          totalElevationGainM: Math.round(totalElevationGainM),
          highestAltitudeM,
          summitTrailName: summitTrailName || (highestAltitudeM > 0 ? `${highestAltitudeM} m` : 'Chưa ghi nhận'),
        },
        recentThreads,
      },
    });
  } catch (err) {
    console.error('[Get User Public Profile Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải hồ sơ tác giả.' });
  }
};

// =========================================================================
// CLOUD-SYNCED ANNUAL TREKKING GOALS (GET & PATCH /api/users/me/goals)
// =========================================================================

const GOAL_YEAR_MIN = 2024;
const GOAL_YEAR_MAX = 2035;
const GOAL_KM_MIN = 10;
const GOAL_KM_MAX = 5000;
const GOAL_ELEVATION_MIN = 500;
const GOAL_ELEVATION_MAX = 200000;
const GOAL_PEAKS_MIN = 1;
const GOAL_PEAKS_MAX = 36;

const DEFAULT_TARGET_KM = 120;
const DEFAULT_TARGET_ELEVATION_M = 8000;
const DEFAULT_TARGET_PEAKS = 6;

function getCurrentVietnamYear(): number {
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
    }).format(new Date());
    const parsed = Number(formatted);
    if (Number.isInteger(parsed) && parsed >= GOAL_YEAR_MIN && parsed <= GOAL_YEAR_MAX) {
      return parsed;
    }
  } catch {
    // Fall back to UTC year below
  }
  const utcYear = new Date().getUTCFullYear();
  return Math.max(GOAL_YEAR_MIN, Math.min(GOAL_YEAR_MAX, utcYear));
}

function isStrictBoundedInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function normalizeAnnualGoals(raw?: Partial<IUserAnnualGoals> | null): IUserAnnualGoals {
  const defaultYear = getCurrentVietnamYear();
  return {
    year: isStrictBoundedInt(raw?.year, GOAL_YEAR_MIN, GOAL_YEAR_MAX) ? raw.year : defaultYear,
    targetKm: isStrictBoundedInt(raw?.targetKm, GOAL_KM_MIN, GOAL_KM_MAX) ? raw.targetKm : DEFAULT_TARGET_KM,
    targetElevationM: isStrictBoundedInt(raw?.targetElevationM, GOAL_ELEVATION_MIN, GOAL_ELEVATION_MAX)
      ? raw.targetElevationM
      : DEFAULT_TARGET_ELEVATION_M,
    targetPeaks: isStrictBoundedInt(raw?.targetPeaks, GOAL_PEAKS_MIN, GOAL_PEAKS_MAX)
      ? raw.targetPeaks
      : DEFAULT_TARGET_PEAKS,
  };
}

// GET /api/users/me/goals - Load authenticated user's synced annual trekking goals (or Vietnam-year defaults)
export const getMyAnnualGoals = async (req: AuthRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng. Vui lòng thử lại sau.' });
    }

    const user = await UserModel.findOne({ _id: new Types.ObjectId(userId), isBanned: { $ne: true } })
      .select('annualGoals')
      .lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản người dùng.' });
    }

    return res.json({
      success: true,
      data: normalizeAnnualGoals((user as any).annualGoals),
    });
  } catch (err) {
    console.error('[Get Annual Goals Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể tải mục tiêu trekking trong năm.' });
  }
};

// PATCH /api/users/me/goals - Atomically update partial or full annual trekking goals with strict integer validation
export const updateMyAnnualGoals = async (req: AuthRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng. Vui lòng thử lại sau.' });
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ success: false, message: 'Dữ liệu mục tiêu không hợp lệ.' });
    }

    const updates: Partial<IUserAnnualGoals> = {};
    let providedCount = 0;

    if (Object.prototype.hasOwnProperty.call(body, 'year')) {
      if (!isStrictBoundedInt(body.year, GOAL_YEAR_MIN, GOAL_YEAR_MAX)) {
        return res.status(400).json({
          success: false,
          message: `Năm mục tiêu phải là số nguyên trong khoảng ${GOAL_YEAR_MIN}–${GOAL_YEAR_MAX}.`,
        });
      }
      updates.year = body.year;
      providedCount++;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'targetKm')) {
      if (!isStrictBoundedInt(body.targetKm, GOAL_KM_MIN, GOAL_KM_MAX)) {
        return res.status(400).json({
          success: false,
          message: `Mục tiêu quãng đường phải là số nguyên từ ${GOAL_KM_MIN} đến ${GOAL_KM_MAX} km.`,
        });
      }
      updates.targetKm = body.targetKm;
      providedCount++;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'targetElevationM')) {
      if (!isStrictBoundedInt(body.targetElevationM, GOAL_ELEVATION_MIN, GOAL_ELEVATION_MAX)) {
        return res.status(400).json({
          success: false,
          message: `Mục tiêu tổng độ cao leo phải là số nguyên từ ${GOAL_ELEVATION_MIN} đến ${GOAL_ELEVATION_MAX} m.`,
        });
      }
      updates.targetElevationM = body.targetElevationM;
      providedCount++;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'targetPeaks')) {
      if (!isStrictBoundedInt(body.targetPeaks, GOAL_PEAKS_MIN, GOAL_PEAKS_MAX)) {
        return res.status(400).json({
          success: false,
          message: `Mục tiêu số đỉnh chinh phục phải là số nguyên từ ${GOAL_PEAKS_MIN} đến ${GOAL_PEAKS_MAX} đỉnh.`,
        });
      }
      updates.targetPeaks = body.targetPeaks;
      providedCount++;
    }

    if (providedCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ít nhất một trường mục tiêu (year, targetKm, targetElevationM, targetPeaks).',
      });
    }

    const defaultYear = getCurrentVietnamYear();
    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: new Types.ObjectId(userId), isBanned: { $ne: true } },
      [
        {
          $set: {
            annualGoals: {
              year: updates.year !== undefined ? updates.year : { $ifNull: ['$annualGoals.year', defaultYear] },
              targetKm:
                updates.targetKm !== undefined
                  ? updates.targetKm
                  : { $ifNull: ['$annualGoals.targetKm', DEFAULT_TARGET_KM] },
              targetElevationM:
                updates.targetElevationM !== undefined
                  ? updates.targetElevationM
                  : { $ifNull: ['$annualGoals.targetElevationM', DEFAULT_TARGET_ELEVATION_M] },
              targetPeaks:
                updates.targetPeaks !== undefined
                  ? updates.targetPeaks
                  : { $ifNull: ['$annualGoals.targetPeaks', DEFAULT_TARGET_PEAKS] },
            },
          },
        },
      ],
      { new: true, updatePipeline: true, projection: { annualGoals: 1 } }
    ).lean();

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản người dùng.' });
    }

    return res.json({
      success: true,
      data: normalizeAnnualGoals((updatedUser as any).annualGoals),
    });
  } catch (err) {
    console.error('[Update Annual Goals Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật mục tiêu trekking trong năm.' });
  }
};
