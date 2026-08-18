import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { TripReportModel } from '../models/TripReport';
import { UserModel } from '../models/User';
import { ActivityModel } from '../models/Activity';
import { awardReputationPoints } from '../utils/reputation.js';

// POST /api/trip-reports - Submit a new trip report
export const createTripReport = async (req: AuthRequest, res: Response) => {
  try {
    const authorId = req.user?.userId;
    if (!authorId) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để viết nhật ký.' });
    }

    const {
      trailId,
      tripPlanId,
      title,
      summary,
      content,
      photos,
      tripDate,
      duration,
      groupSize,
      totalCost,
      difficultyActual,
      weatherCondition,
      highlights,
      warnings,
      recommendations,
      rating,
    } = req.body;

    if (!trailId || !title || !content) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin tiêu đề, cung đường hoặc nội dung.' });
    }

    const report = await TripReportModel.create({
      authorId: authorId as any,
      trailId: trailId as any,
      tripPlanId: tripPlanId ? (tripPlanId as any) : undefined,
      title,
      summary: summary || title,
      content,
      photos: photos || [],
      tripDate: tripDate ? new Date(tripDate) : new Date(),
      duration: duration || '2 ngày 1 đêm',
      groupSize: groupSize || 2,
      totalCost: totalCost || '',
      difficultyActual: difficultyActual || 3,
      weatherCondition: weatherCondition || 'Thời tiết đẹp',
      highlights: highlights || [],
      warnings: warnings || [],
      recommendations: recommendations || [],
      rating: rating || 5,
    });

    // Reward reputation via centralized engine (badge progression included)
    const author = await UserModel.findById(authorId);
    let reputationReward = null;
    if (author) {
      reputationReward = await awardReputationPoints(
        authorId,
        30,
        'Viết nhật ký chuyến đi'
      );
      await UserModel.findByIdAndUpdate(authorId, { $inc: { tripReportsCount: 1 } }).catch(() => {});
    }

    // Create community activity feed item
    if (author) {
      await ActivityModel.create({
        userId: authorId as any,
        type: 'new_trip_report',
        title: `${author.fullName} vừa viết nhật ký chuyến đi: "${title}"`,
        targetType: 'trip_report',
        targetId: (report as any)._id.toString(),
        thumbnailUrl: photos?.[0] || '',
      }).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      message: 'Đăng bài nhật ký chuyến đi thành công! Bạn nhận +30 điểm uy tín.',
      data: report,
    });
  } catch (err) {
    console.error('[Create Trip Report Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng nhật ký.' });
  }
};

// GET /api/trip-reports - List trip reports
export const getTripReports = async (req: AuthRequest, res: Response) => {
  try {
    const { trailId, page = 1, limit = 10 } = req.query;
    const query: any = {};
    if (trailId) query.trailId = trailId;

    const skip = (Number(page) - 1) * Number(limit);
    const reports = await TripReportModel.find(query)
      .populate('authorId', 'fullName avatarUrl reputationScore badges')
      .populate('trailId', 'name province region coverImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await TripReportModel.countDocuments(query);

    return res.json({
      success: true,
      data: reports,
      pagination: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    console.error('[Get Trip Reports Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách nhật ký.' });
  }
};

// GET /api/trip-reports/:id - Get single trip report detail
export const getTripReportById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const report = await TripReportModel.findByIdAndUpdate(id, { $inc: { viewsCount: 1 } }, { new: true })
      .populate('authorId', 'fullName avatarUrl reputationScore badges bio')
      .populate('trailId', 'name province region coverImage difficultyLevel');

    if (!report) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhật ký chuyến đi.' });
    }

    return res.json({ success: true, data: report });
  } catch (err) {
    console.error('[Get Trip Report Detail Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải chi tiết nhật ký.' });
  }
};

// POST /api/trip-reports/:id/react - React to trip report
export const reactTripReport = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để thả cảm xúc.' });
    }

    const { id } = req.params;
    const { type = 'like' } = req.body; // 'like' | 'love' | 'wow'

    const report = await TripReportModel.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhật ký.' });
    }

    const userMap: any = report.userReactionsMap || {};
    const userKey = userId.toString();
    const currentReaction = userMap[userKey];

    if (currentReaction === type) {
      // Toggle off
      delete userMap[userKey];
      if (report.reactions[type as keyof typeof report.reactions] > 0) {
        report.reactions[type as keyof typeof report.reactions] -= 1;
      }
    } else {
      // Remove old reaction if existed
      if (currentReaction && report.reactions[currentReaction as keyof typeof report.reactions] > 0) {
        report.reactions[currentReaction as keyof typeof report.reactions] -= 1;
      }
      userMap[userKey] = type;
      report.reactions[type as keyof typeof report.reactions] = (report.reactions[type as keyof typeof report.reactions] || 0) + 1;
    }

    report.userReactionsMap = userMap;
    await report.save();

    return res.json({ success: true, reactions: report.reactions });
  } catch (err) {
    console.error('[React Trip Report Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi thực hiện cảm xúc.' });
  }
};
