import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { TripReportModel } from '../models/TripReport.js';
import { UserModel } from '../models/User.js';
import { awardReputationPoints, deductReputationPoints, PENALTY_POINTS } from '../utils/reputation.js';
import { sanitizeInput, isSafeHttpUrl } from '../utils/validation.js';
import { containsProfanity, getProfanityMatch } from '../utils/profanityFilter.js';
import { isValidObjectId, resolveTrailObjectId } from '../utils/resolveTrail.js';
import { recordActivity, recordAuditLog } from '../utils/audit.js';

const VALID_REACTIONS = ['like', 'love', 'wow'] as const;
type TripReportReaction = (typeof VALID_REACTIONS)[number];

function formatReportForViewer(report: any, viewerId?: string) {
  const { userReactionsMap, ...publicReport } = report;
  let userReaction: TripReportReaction | null = null;
  if (viewerId && userReactionsMap) {
    const r =
      typeof userReactionsMap.get === 'function'
        ? userReactionsMap.get(viewerId)
        : userReactionsMap[viewerId];
    if (r && VALID_REACTIONS.includes(r)) {
      userReaction = r as TripReportReaction;
    }
  }
  return {
    ...publicReport,
    userReaction,
  };
}

// POST /api/trip-reports - Submit a new trip report
export const createTripReport = async (req: AuthRequest, res: Response) => {
  try {
    const authorId = req.user?.userId;
    if (!authorId || !isValidObjectId(authorId)) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để viết nhật ký.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const {
      trailId,
      tripPlanId,
      title,
      summary,
      content,
      photos,
      gpxTrackActual,
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
    } = req.body || {};

    if (!trailId || typeof title !== 'string' || !title.trim() || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin tiêu đề, cung đường hoặc nội dung.' });
    }

    const cleanTitle = sanitizeInput(title).slice(0, 180);
    const cleanContent = sanitizeInput(content).slice(0, 10000);
    if (!cleanTitle || !cleanContent) {
      return res.status(400).json({ success: false, message: 'Tiêu đề hoặc nội dung nhật ký không hợp lệ.' });
    }

    if (containsProfanity(`${cleanTitle} ${cleanContent}`)) {
      const matched = getProfanityMatch(`${cleanTitle} ${cleanContent}`);
      await deductReputationPoints(authorId, PENALTY_POINTS.PROFANITY_VIOLATION, `Nhật ký chứa từ ngữ vi phạm ("${matched}")`);
      return res.status(400).json({
        success: false,
        message: `Nhật ký chuyến đi bị từ chối do chứa từ ngữ vi phạm ("${matched}").`,
      });
    }

    const resolvedTrailId = await resolveTrailObjectId(trailId);
    if (!resolvedTrailId) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường tương ứng trong hệ thống.' });
    }

    let parsedTripDate = new Date();
    if (tripDate !== undefined && tripDate !== null && tripDate !== '') {
      const d = new Date(tripDate);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: 'Ngày đi (tripDate) không đúng định dạng.' });
      }
      parsedTripDate = d;
    }

    const safePhotos = Array.isArray(photos) ? photos.filter((u: unknown) => isSafeHttpUrl(u)).slice(0, 10) : [];
    const safeGpx: number[][] = Array.isArray(gpxTrackActual)
      ? gpxTrackActual
          .filter(
            (pt: any) =>
              Array.isArray(pt) &&
              pt.length >= 2 &&
              Number.isFinite(Number(pt[0])) &&
              Number.isFinite(Number(pt[1])) &&
              Number(pt[0]) >= -90 &&
              Number(pt[0]) <= 90 &&
              Number(pt[1]) >= -180 &&
              Number(pt[1]) <= 180
          )
          .slice(0, 3000)
          .map((pt: any) => (pt.length >= 3 && Number.isFinite(Number(pt[2])) ? [Number(pt[0]), Number(pt[1]), Number(pt[2])] : [Number(pt[0]), Number(pt[1])]))
      : [];

    const report = await TripReportModel.create({
      authorId: new mongoose.Types.ObjectId(authorId),
      trailId: resolvedTrailId,
      tripPlanId: tripPlanId && isValidObjectId(tripPlanId) ? new mongoose.Types.ObjectId(tripPlanId) : undefined,
      title: cleanTitle,
      summary: sanitizeInput(typeof summary === 'string' && summary.trim() ? summary : cleanTitle).slice(0, 400),
      content: cleanContent,
      photos: safePhotos,
      gpxTrackActual: safeGpx,
      tripDate: parsedTripDate,
      duration: sanitizeInput(String(duration || '2 ngày 1 đêm')).slice(0, 60),
      groupSize: Math.min(Math.max(Number(groupSize) || 2, 1), 100),
      totalCost: sanitizeInput(String(totalCost || '')).slice(0, 100),
      difficultyActual: Math.min(Math.max(Number(difficultyActual) || 3, 1), 5),
      weatherCondition: sanitizeInput(String(weatherCondition || 'Thời tiết đẹp')).slice(0, 120),
      highlights: Array.isArray(highlights) ? highlights.slice(0, 10).map((s: unknown) => sanitizeInput(String(s))) : [],
      warnings: Array.isArray(warnings) ? warnings.slice(0, 10).map((s: unknown) => sanitizeInput(String(s))) : [],
      recommendations: Array.isArray(recommendations)
        ? recommendations.slice(0, 10).map((s: unknown) => sanitizeInput(String(s)))
        : [],
      rating: Math.min(Math.max(Number(rating) || 5, 1), 5),
    });

    const author = await UserModel.findById(authorId).select('fullName').lean();
    if (author) {
      await awardReputationPoints(authorId, 30, 'Viết nhật ký chuyến đi');
      await UserModel.findByIdAndUpdate(authorId, { $inc: { tripReportsCount: 1 } }).catch(() => {});
      await recordActivity({
        userId: authorId,
        type: 'new_trip_report',
        title: `${author.fullName} vừa viết nhật ký chuyến đi: "${report.title}"`,
        targetType: 'trip_report',
        targetId: String((report as any)._id),
        thumbnailUrl: safePhotos[0] || '',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Đăng bài nhật ký chuyến đi thành công! Bạn nhận +30 điểm uy tín.',
      data: formatReportForViewer(report.toObject(), authorId),
    });
  } catch (err) {
    console.error('[Create Trip Report Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng nhật ký.' });
  }
};

// GET /api/trip-reports - List trip reports (strips voter map, includes viewer's userReaction)
export const getTripReports = async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 10 } });
    }
    const rawTrailId = req.query.trailId;
    const rawAuthorId = req.query.authorId;
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '10'), 10) || 10, 1), 50);

    const query: any = {};
    if (typeof rawTrailId === 'string' && rawTrailId.trim()) {
      const resolved = await resolveTrailObjectId(rawTrailId);
      if (resolved) query.trailId = resolved;
      else return res.json({ success: true, data: [], pagination: { total: 0, page, limit } });
    }
    if (typeof rawAuthorId === 'string' && isValidObjectId(rawAuthorId)) {
      query.authorId = new mongoose.Types.ObjectId(rawAuthorId);
    }

    const skip = (page - 1) * limit;
    const [reports, total] = await Promise.all([
      TripReportModel.find(query)
        .populate('authorId', 'fullName avatarUrl reputationScore badges')
        .populate('trailId', 'id name province region coverImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TripReportModel.countDocuments(query),
    ]);

    const viewerId = req.user?.userId;
    return res.json({
      success: true,
      data: reports.map((r) => formatReportForViewer(r, viewerId)),
      pagination: { total, page, limit },
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
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã nhật ký không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const report = await TripReportModel.findByIdAndUpdate(id, { $inc: { viewsCount: 1 } }, { new: true })
      .populate('authorId', 'fullName avatarUrl reputationScore badges bio')
      .populate('trailId', 'id name province region coverImage difficultyLevel')
      .lean();

    if (!report) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhật ký chuyến đi.' });
    }

    return res.json({ success: true, data: formatReportForViewer(report, req.user?.userId) });
  } catch (err) {
    console.error('[Get Trip Report Detail Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải chi tiết nhật ký.' });
  }
};

// POST /api/trip-reports/:id/react - Atomic per-user map update (fixes reaction-wipe bug & concurrent race)
export const reactTripReport = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để thả cảm xúc.' });
    }

    const { id } = req.params;
    const rawType = req.body?.type || 'like';
    if (!VALID_REACTIONS.includes(rawType)) {
      return res.status(400).json({ success: false, message: 'Loại cảm xúc không hợp lệ.' });
    }
    const type = rawType as TripReportReaction;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã nhật ký không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const existing = await TripReportModel.findById(id).select('_id userReactionsMap').lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhật ký.' });
    }

    const userKey = String(userId);
    const prevMap: Record<string, string> =
      existing.userReactionsMap instanceof Map
        ? Object.fromEntries(existing.userReactionsMap.entries())
        : ((existing.userReactionsMap as any) || {});
    const currentReaction = prevMap[userKey] || null;
    const nextUserReaction: TripReportReaction | null = currentReaction === type ? null : type;

    const mapField = `userReactionsMap.${userKey}`;
    const updated = await TripReportModel.findByIdAndUpdate(
      id,
      nextUserReaction ? { $set: { [mapField]: nextUserReaction } } : { $unset: { [mapField]: '' } },
      { new: true }
    )
      .select('userReactionsMap')
      .lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhật ký.' });
    }

    const counts: Record<TripReportReaction, number> = { like: 0, love: 0, wow: 0 };
    const entries =
      updated.userReactionsMap instanceof Map
        ? Array.from(updated.userReactionsMap.entries())
        : Object.entries((updated.userReactionsMap as any) || {});
    for (const [, r] of entries) {
      if (typeof r === 'string' && r in counts) {
        counts[r as TripReportReaction]++;
      }
    }

    await TripReportModel.updateOne({ _id: existing._id }, { $set: { reactions: counts } });

    return res.json({
      success: true,
      reactions: counts,
      userReaction: nextUserReaction,
    });
  } catch (err) {
    console.error('[React Trip Report Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi thực hiện cảm xúc.' });
  }
};

// PATCH /api/trip-reports/:id - Owner, Admin, or Moderator updates trip report
export const updateTripReport = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const isStaff = req.user?.role === 'admin' || req.user?.role === 'moderator';
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã nhật ký không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const report = await TripReportModel.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhật ký.' });
    }
    if (!isStaff && String(report.authorId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa nhật ký này.' });
    }

    const {
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
    } = req.body || {};

    const nextTitle = title !== undefined ? sanitizeInput(String(title)).slice(0, 180) : report.title;
    const nextContent = content !== undefined ? sanitizeInput(String(content)).slice(0, 10000) : report.content;
    const nextSummary = summary !== undefined ? sanitizeInput(String(summary)).slice(0, 400) : report.summary;

    if (!nextTitle.trim() || !nextContent.trim()) {
      return res.status(400).json({ success: false, message: 'Tiêu đề và nội dung nhật ký không được để trống.' });
    }

    if (containsProfanity(`${nextTitle} ${nextSummary} ${nextContent}`)) {
      const matched = getProfanityMatch(`${nextTitle} ${nextSummary} ${nextContent}`);
      await deductReputationPoints(
        userId,
        PENALTY_POINTS.PROFANITY_VIOLATION,
        `Chỉnh sửa nhật ký chứa từ ngữ vi phạm ("${matched}")`
      );
      return res.status(400).json({
        success: false,
        message: `Nhật ký chuyến đi chứa từ ngữ vi phạm ("${matched}").`,
      });
    }

    report.title = nextTitle;
    report.content = nextContent;
    report.summary = nextSummary || nextTitle;

    if (tripDate !== undefined && tripDate !== null && tripDate !== '') {
      const parsedDate = new Date(tripDate);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Ngày đi (tripDate) không đúng định dạng.' });
      }
      report.tripDate = parsedDate;
    }
    if (photos !== undefined) {
      report.photos = Array.isArray(photos) ? photos.filter((u: unknown) => isSafeHttpUrl(u)).slice(0, 10) : [];
    }
    if (duration !== undefined) {
      report.duration = sanitizeInput(String(duration || '2 ngày 1 đêm')).slice(0, 60);
    }
    if (groupSize !== undefined && Number.isFinite(Number(groupSize))) {
      report.groupSize = Math.min(Math.max(Math.round(Number(groupSize)), 1), 100);
    }
    if (totalCost !== undefined) {
      report.totalCost = sanitizeInput(String(totalCost || '')).slice(0, 100);
    }
    if (difficultyActual !== undefined && Number.isFinite(Number(difficultyActual))) {
      report.difficultyActual = Math.min(Math.max(Math.round(Number(difficultyActual)), 1), 5);
    }
    if (weatherCondition !== undefined) {
      report.weatherCondition = sanitizeInput(String(weatherCondition || '')).slice(0, 120);
    }
    if (highlights !== undefined) {
      report.highlights = Array.isArray(highlights) ? highlights.slice(0, 10).map((s: unknown) => sanitizeInput(String(s))) : [];
    }
    if (warnings !== undefined) {
      report.warnings = Array.isArray(warnings) ? warnings.slice(0, 10).map((s: unknown) => sanitizeInput(String(s))) : [];
    }
    if (recommendations !== undefined) {
      report.recommendations = Array.isArray(recommendations)
        ? recommendations.slice(0, 10).map((s: unknown) => sanitizeInput(String(s)))
        : [];
    }
    if (rating !== undefined && Number.isFinite(Number(rating))) {
      report.rating = Math.min(Math.max(Math.round(Number(rating)), 1), 5);
    }

    await report.save();
    await recordAuditLog(req, 'UPDATE_TRIP_REPORT', 'trip_reports', `Cập nhật nhật ký chuyến đi ${report._id}`);

    const populated = await TripReportModel.findById(report._id)
      .populate('authorId', 'fullName avatarUrl reputationScore badges bio')
      .populate('trailId', 'id name province region coverImage difficultyLevel')
      .lean();

    return res.json({
      success: true,
      message: 'Đã cập nhật nhật ký chuyến đi thành công!',
      data: formatReportForViewer(populated || report.toObject(), userId),
    });
  } catch (err) {
    console.error('[Update Trip Report Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật nhật ký.' });
  }
};

// DELETE /api/trip-reports/:id - Owner, Admin, or Moderator deletes trip report
export const deleteTripReport = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const isStaff = req.user?.role === 'admin' || req.user?.role === 'moderator';
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã nhật ký không hợp lệ.' });
    }

    const report = await TripReportModel.findById(id).select('authorId title').lean();
    if (!report) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhật ký.' });
    }
    if (!isStaff && String(report.authorId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa nhật ký này.' });
    }

    await TripReportModel.deleteOne({ _id: id });
    await UserModel.updateOne(
      { _id: report.authorId, tripReportsCount: { $gt: 0 } },
      { $inc: { tripReportsCount: -1 } }
    ).catch(() => {});
    await recordAuditLog(req, 'DELETE_TRIP_REPORT', 'trip_reports', `Xóa nhật ký "${report.title}" (${id})`);

    return res.json({ success: true, message: 'Đã xóa nhật ký chuyến đi thành công!' });
  } catch (err) {
    console.error('[Delete Trip Report Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa nhật ký.' });
  }
};
