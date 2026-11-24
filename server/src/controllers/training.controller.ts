import { Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { TrainingPlanModel, FitnessLevel, TrainingPlanStatus } from '../models/TrainingPlan.js';
import { CheckinModel } from '../models/Checkin.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { resolveTrailByIdOrSlug, isValidObjectId } from '../utils/resolveTrail.js';
import { generateTrainingSessions, calculateReadinessScore } from '../services/trainingPlan.service.js';
import { recordActivity } from '../utils/audit.js';

const VALID_LEVELS = new Set<FitnessLevel>(['beginner', 'intermediate', 'advanced']);
const VALID_WEEKS = new Set<number>([4, 6, 8]);
const VALID_STATUSES = new Set<TrainingPlanStatus>(['active', 'completed', 'abandoned']);
const MAX_ACTIVE_PLANS_PER_USER = 5;

function daysUntil(targetDate: Date): number {
  const diffMs = new Date(targetDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

// GET /api/training-plans/me - List current user's training plans
export const getMyTrainingPlans = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const uid = new Types.ObjectId(userId);
    const [plans, verifiedCheckins] = await Promise.all([
      TrainingPlanModel.find({ userId: uid })
        .populate('targetTrailId', 'id name province region maxAltitudeM distanceKm elevationGainM difficultyLevel coverImage')
        .sort({ status: 1, createdAt: -1 })
        .limit(20)
        .lean(),
      CheckinModel.countDocuments({ userId: uid, verifiedBadge: true }),
    ]);

    const enriched = plans.map((plan: any) => {
      const readiness = calculateReadinessScore(plan.sessions || [], verifiedCheckins);
      return {
        ...plan,
        readinessScore: readiness.readinessScore,
        completedSessions: readiness.completedSessions,
        totalSessions: readiness.totalSessions,
        categoryProgress: readiness.categoryProgress,
        daysRemaining: daysUntil(plan.targetDate),
      };
    });

    return res.json({ success: true, count: enriched.length, data: enriched });
  } catch (err) {
    console.error('[Get Training Plans Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải kế hoạch luyện tập.' });
  }
};

// POST /api/training-plans - Generate & save a tailored 4/6/8-week expedition training plan for a real Vietnam peak
export const createTrainingPlan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để tạo giáo án thể lực.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const {
      targetTrailId,
      trailId,
      targetTrailSlug,
      targetDate,
      durationWeeks = 6,
      fitnessLevel = 'intermediate',
    } = req.body || {};
    const resolvedTrailParam =
      (typeof targetTrailId === 'string' && targetTrailId.trim()) ||
      (typeof trailId === 'string' && trailId.trim()) ||
      (typeof targetTrailSlug === 'string' && targetTrailSlug.trim()) ||
      '';
    if (!resolvedTrailParam) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn cung đường / đỉnh núi mục tiêu.' });
    }

    const weeks = Number(durationWeeks) as 4 | 6 | 8;
    if (!VALID_WEEKS.has(weeks)) {
      return res.status(400).json({ success: false, message: 'Thời lượng giáo án phải là 4, 6 hoặc 8 tuần.' });
    }

    const level = (VALID_LEVELS.has(fitnessLevel) ? fitnessLevel : 'intermediate') as FitnessLevel;

    const MAX_TARGET_HORIZON_MS = 2 * 365 * 24 * 60 * 60 * 1000; // +2 years max
    let parsedTargetDate: Date;
    if (targetDate) {
      parsedTargetDate = new Date(targetDate);
      if (
        Number.isNaN(parsedTargetDate.getTime()) ||
        parsedTargetDate.getTime() < Date.now() + 24 * 60 * 60 * 1000 ||
        parsedTargetDate.getTime() > Date.now() + MAX_TARGET_HORIZON_MS
      ) {
        return res.status(400).json({
          success: false,
          message: 'Ngày khởi hành mục tiêu phải cách hiện tại từ 1 ngày đến tối đa 2 năm.',
        });
      }
    } else {
      parsedTargetDate = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000);
    }

    const uid = new Types.ObjectId(userId);
    const activeCount = await TrainingPlanModel.countDocuments({ userId: uid, status: 'active' });
    if (activeCount >= MAX_ACTIVE_PLANS_PER_USER) {
      return res.status(400).json({
        success: false,
        message: `Bạn đang có ${MAX_ACTIVE_PLANS_PER_USER} giáo án hoạt động. Hãy hoàn thành hoặc đóng bớt trước khi tạo mới.`,
      });
    }

    const trail = await resolveTrailByIdOrSlug(resolvedTrailParam);
    if (!trail) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường mục tiêu.' });
    }

    const sessions = generateTrainingSessions({
      trail: {
        name: trail.name,
        distanceKm: trail.distanceKm,
        elevationGainM: trail.elevationGainM,
        maxAltitudeM: trail.maxAltitudeM,
        difficultyLevel: trail.difficultyLevel,
        durationDays: trail.durationDays,
      },
      durationWeeks: weeks,
      fitnessLevel: level,
    });

    const verifiedCheckins = await CheckinModel.countDocuments({ userId: uid, verifiedBadge: true });
    const readiness = calculateReadinessScore(sessions, verifiedCheckins);

    const plan = await TrainingPlanModel.create({
      userId: uid,
      targetTrailId: trail._id,
      targetTrailSlug: trail.id || String(trail._id),
      targetTrailName: trail.name,
      targetDate: parsedTargetDate,
      durationWeeks: weeks,
      fitnessLevel: level,
      status: 'active',
      sessions,
      readinessScore: readiness.readinessScore,
    });

    return res.status(201).json({
      success: true,
      message: `Đã khởi tạo giáo án luyện tập ${weeks} tuần cho mục tiêu "${trail.name}"!`,
      data: {
        ...plan.toObject(),
        completedSessions: readiness.completedSessions,
        totalSessions: readiness.totalSessions,
        categoryProgress: readiness.categoryProgress,
        daysRemaining: daysUntil(parsedTargetDate),
      },
    });
  } catch (err) {
    console.error('[Create Training Plan Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo giáo án luyện tập.' });
  }
};

// GET /api/training-plans/:id - Get single training plan (strict owner check)
export const getTrainingPlanById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã giáo án không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const uid = new Types.ObjectId(userId);
    const [plan, verifiedCheckins] = await Promise.all([
      TrainingPlanModel.findOne({ _id: id, userId: uid })
        .populate('targetTrailId', 'id name province region maxAltitudeM distanceKm elevationGainM difficultyLevel coverImage')
        .lean(),
      CheckinModel.countDocuments({ userId: uid, verifiedBadge: true }),
    ]);

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giáo án luyện tập.' });
    }

    const readiness = calculateReadinessScore(plan.sessions || [], verifiedCheckins);
    return res.json({
      success: true,
      data: {
        ...plan,
        readinessScore: readiness.readinessScore,
        completedSessions: readiness.completedSessions,
        totalSessions: readiness.totalSessions,
        categoryProgress: readiness.categoryProgress,
        daysRemaining: daysUntil(plan.targetDate),
      },
    });
  } catch (err) {
    console.error('[Get Training Plan Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải chi tiết giáo án.' });
  }
};

// PATCH /api/training-plans/:id/sessions/:sessionId - Atomically check off or uncheck a workout session
export const toggleTrainingSession = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id, sessionId } = req.params;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id) || !sessionId) {
      return res.status(400).json({ success: false, message: 'Tham số giáo án hoặc buổi tập không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const uid = new Types.ObjectId(userId);
    const existing = await TrainingPlanModel.findOne({ _id: id, userId: uid }).lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giáo án luyện tập.' });
    }

    const targetSession = (existing.sessions || []).find((s) => s.id === sessionId);
    if (!targetSession) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy buổi tập này.' });
    }

    const nextCompleted =
      typeof req.body?.completed === 'boolean' ? req.body.completed : !targetSession.completed;

    const updated = await TrainingPlanModel.findOneAndUpdate(
      { _id: id, userId: uid, 'sessions.id': sessionId },
      {
        $set: {
          'sessions.$.completed': nextCompleted,
          'sessions.$.completedAt': nextCompleted ? new Date() : null,
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy buổi tập để cập nhật.' });
    }

    const verifiedCheckins = await CheckinModel.countDocuments({ userId: uid, verifiedBadge: true });
    const readiness = calculateReadinessScore(updated.sessions || [], verifiedCheckins);
    const allDone = readiness.totalSessions > 0 && readiness.completedSessions === readiness.totalSessions;
    const nextStatus: TrainingPlanStatus = allDone
      ? 'completed'
      : updated.status === 'completed'
        ? 'active'
        : updated.status;

    await TrainingPlanModel.updateOne(
      { _id: updated._id },
      { $set: { readinessScore: readiness.readinessScore, status: nextStatus } }
    );

    if (allDone && existing.status !== 'completed') {
      await recordActivity({
        userId: uid,
        type: 'completed_trip',
        title: `Hoàn thành 100% giáo án thể lực ${updated.durationWeeks} tuần chuẩn bị chinh phục ${updated.targetTrailName}`,
        targetType: 'trail',
        targetId: updated.targetTrailSlug,
      });
    }

    return res.json({
      success: true,
      message: allDone
        ? `Xuất sắc! Bạn đã hoàn thành toàn bộ giáo án sẵn sàng chinh phục ${updated.targetTrailName}!`
        : nextCompleted
          ? 'Đã đánh dấu hoàn thành buổi tập!'
          : 'Đã bỏ đánh dấu buổi tập.',
      data: {
        ...updated.toObject(),
        status: nextStatus,
        readinessScore: readiness.readinessScore,
        completedSessions: readiness.completedSessions,
        totalSessions: readiness.totalSessions,
        categoryProgress: readiness.categoryProgress,
        daysRemaining: daysUntil(updated.targetDate),
      },
    });
  } catch (err) {
    console.error('[Toggle Training Session Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật buổi tập.' });
  }
};

// PATCH /api/training-plans/:id/status - Update training plan status
export const updateTrainingPlanStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { status } = req.body || {};

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã giáo án không hợp lệ.' });
    }
    if (typeof status !== 'string' || !VALID_STATUSES.has(status as TrainingPlanStatus)) {
      return res.status(400).json({ success: false, message: 'Trạng thái giáo án không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const uid = new Types.ObjectId(userId);
    const existing = await TrainingPlanModel.findOne({ _id: id, userId: uid }).select('status').lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giáo án.' });
    }

    if (status === 'active' && existing.status !== 'active') {
      const activeCount = await TrainingPlanModel.countDocuments({ userId: uid, status: 'active' });
      if (activeCount >= MAX_ACTIVE_PLANS_PER_USER) {
        return res.status(400).json({
          success: false,
          message: `Bạn đang có ${MAX_ACTIVE_PLANS_PER_USER} giáo án hoạt động. Hãy hoàn thành hoặc đóng bớt trước khi kích hoạt lại.`,
        });
      }
    }

    const updated = await TrainingPlanModel.findOneAndUpdate(
      { _id: id, userId: uid },
      { $set: { status } },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giáo án.' });
    }

    return res.json({ success: true, message: 'Đã cập nhật trạng thái giáo án!', data: updated });
  } catch (err) {
    console.error('[Update Training Status Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật trạng thái giáo án.' });
  }
};

// DELETE /api/training-plans/:id - Delete training plan (strict owner)
export const deleteTrainingPlan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã giáo án không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const deleted = await TrainingPlanModel.findOneAndDelete({
      _id: id,
      userId: new Types.ObjectId(userId),
    });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giáo án để xóa.' });
    }

    return res.json({ success: true, message: 'Đã xóa giáo án luyện tập.' });
  } catch (err) {
    console.error('[Delete Training Plan Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa giáo án.' });
  }
};
