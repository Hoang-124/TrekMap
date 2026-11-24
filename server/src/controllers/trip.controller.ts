import crypto from 'crypto';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { TripPlanModel } from '../models/TripPlan.js';
import { TrailModel } from '../models/Trail.js';
import { ConversationModel } from '../models/Conversation.js';
import { MessageModel } from '../models/Message.js';
import { UserModel } from '../models/User.js';
import { sanitizeInput, isSafeHttpUrl } from '../utils/validation.js';
import { containsProfanity, getProfanityMatch } from '../utils/profanityFilter.js';
import { isValidObjectId, resolveTrailByIdOrSlug } from '../utils/resolveTrail.js';
import { sendNotification } from '../utils/notification.js';
import { recordActivity } from '../utils/audit.js';
import { evictUserFromRoom, evictAllFromRoom } from '../config/socket.js';

const VALID_TRIP_STATUSES = new Set(['recruiting', 'full', 'in_progress', 'completed', 'cancelled']);
const VALID_REGIONS = new Set(['Miền Bắc', 'Miền Trung', 'Miền Nam']);
const VALID_SAFETY_GATE_KEYS = new Set(['permit', 'beacon', 'gonogo', 'wfa_gear', 'turnaround', 'hotline']);
const MAX_SHARED_GEAR_ITEMS = 100;
const MAX_EXPENSE_ITEMS = 200;
const MAX_SETTLED_TRANSFERS = 200;

function serializeSafetyGate(raw: any): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of VALID_SAFETY_GATE_KEYS) {
    if (raw instanceof Map) {
      out[key] = Boolean(raw.get(key));
    } else if (raw && typeof raw === 'object') {
      out[key] = Boolean(raw[key]);
    } else {
      out[key] = false;
    }
  }
  return out;
}
const DEFAULT_TRIP_COVER = '/covers/trail-taxua.svg';

// POST /api/trips - Create new trip recruitment plan
export const createTripPlan = async (req: AuthRequest, res: Response) => {
  try {
    const creatorId = req.user?.userId;
    if (!creatorId || !isValidObjectId(creatorId)) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để mở chuyến ghép đoàn.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const {
      trailId,
      trailName,
      title,
      description,
      startDate,
      endDate,
      maxMembers,
      requirements,
      estimatedCost,
      meetingPoint,
      difficultyLevel,
      coverImage,
      tags,
    } = req.body || {};

    if (typeof title !== 'string' || !title.trim() || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền tiêu đề và thời gian chuyến đi.' });
    }

    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);
    const nowMs = Date.now();
    const MAX_TRIP_HORIZON_MS = 2 * 365 * 24 * 60 * 60 * 1000;
    const MAX_TRIP_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
    if (
      isNaN(parsedStart.getTime()) ||
      isNaN(parsedEnd.getTime()) ||
      parsedEnd < parsedStart ||
      parsedStart.getTime() < nowMs - 24 * 60 * 60 * 1000 ||
      parsedStart.getTime() > nowMs + MAX_TRIP_HORIZON_MS ||
      parsedEnd.getTime() - parsedStart.getTime() > MAX_TRIP_DURATION_MS
    ) {
      return res.status(400).json({
        success: false,
        message: 'Khoảng thời gian chuyến đi không hợp lệ (khởi hành trong vòng 2 năm tới và thời lượng tối đa 30 ngày).',
      });
    }

    const cleanTitle = sanitizeInput(title).slice(0, 180);
    const cleanDesc = sanitizeInput(typeof description === 'string' && description.trim() ? description : title).slice(0, 3000);
    const cleanRequirements = sanitizeInput(String(requirements || 'Lịch sự, trách nhiệm, tự túc đồ dùng cá nhân.')).slice(0, 500);
    const cleanMeetingPoint = sanitizeInput(String(meetingPoint || 'Sẽ chốt trong nhóm chat đoàn')).slice(0, 200);
    const cleanEstimatedCost = sanitizeInput(String(estimatedCost || 'Chia đều chi phí thực tế')).slice(0, 200);

    if (containsProfanity(`${cleanTitle} ${cleanDesc} ${cleanRequirements} ${cleanMeetingPoint}`)) {
      const matched = getProfanityMatch(`${cleanTitle} ${cleanDesc} ${cleanRequirements} ${cleanMeetingPoint}`);
      return res.status(400).json({
        success: false,
        message: `Nội dung chuyến ghép đoàn chứa từ ngữ vi phạm quy chuẩn cộng đồng ("${matched}").`,
      });
    }

    const resolvedTrail = trailId ? await resolveTrailByIdOrSlug(String(trailId)) : null;
    const safeMaxMembers = Math.min(Math.max(Math.round(Number(maxMembers) || 6), 2), 50);
    const safeDifficulty = Math.min(Math.max(Math.round(Number(difficultyLevel) || resolvedTrail?.difficultyLevel || 3), 1), 5);

    const trip = await TripPlanModel.create({
      creatorId: new mongoose.Types.ObjectId(creatorId),
      trailId: resolvedTrail?._id || undefined,
      trailName:
        typeof trailName === 'string' && trailName.trim()
          ? sanitizeInput(trailName).slice(0, 160)
          : resolvedTrail?.name || '',
      title: cleanTitle,
      description: cleanDesc,
      startDate: parsedStart,
      endDate: parsedEnd,
      maxMembers: safeMaxMembers,
      currentMembers: [new mongoose.Types.ObjectId(creatorId)],
      requirements: cleanRequirements,
      estimatedCost: cleanEstimatedCost,
      meetingPoint: cleanMeetingPoint,
      difficultyLevel: safeDifficulty,
      coverImage:
        typeof coverImage === 'string' && isSafeHttpUrl(coverImage)
          ? coverImage.trim()
          : resolvedTrail?.coverImage || DEFAULT_TRIP_COVER,
      tags: Array.isArray(tags)
        ? tags.filter((t: unknown) => typeof t === 'string').slice(0, 10).map((t: string) => sanitizeInput(t).slice(0, 30))
        : ['Trekking', 'Ghép Đoàn'],
      status: 'recruiting',
    });

    const creator = await UserModel.findById(creatorId).select('fullName').lean();
    if (creator) {
      await recordActivity({
        userId: creatorId,
        type: 'new_trip_plan',
        title: `${creator.fullName} vừa mở chuyến ghép đoàn mới: "${trip.title}"`,
        targetType: 'trip_plan',
        targetId: trip._id.toString(),
        thumbnailUrl: trip.coverImage,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Mở chuyến ghép đoàn thành công! Bạn là trưởng đoàn.',
      data: trip,
    });
  } catch (err) {
    console.error('[Create Trip Plan Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo chuyến ghép đoàn.' });
  }
};

// GET /api/trips - Filtered & paginated list of trip plans (supports region, trailId, difficulty, month, fromDate, toDate, search, mine)
export const getTripPlans = async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 10 } });
    }

    const rawStatus = typeof req.query.status === 'string' ? req.query.status : 'recruiting';
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '10'), 10) || 10, 1), 50);

    const query: any = {};
    if (rawStatus !== 'all' && VALID_TRIP_STATUSES.has(rawStatus)) {
      query.status = rawStatus;
    }

    if (typeof req.query.difficulty === 'string' && req.query.difficulty) {
      const diff = parseInt(req.query.difficulty, 10);
      if (Number.isInteger(diff) && diff >= 1 && diff <= 5) query.difficultyLevel = diff;
    }

    let explicitTrailObjId: mongoose.Types.ObjectId | null = null;
    if (typeof req.query.trailId === 'string' && req.query.trailId.trim()) {
      const resolved = await resolveTrailByIdOrSlug(req.query.trailId.trim());
      if (resolved) {
        explicitTrailObjId = resolved._id;
        query.trailId = resolved._id;
      } else {
        return res.json({ success: true, data: [], pagination: { total: 0, page, limit } });
      }
    }

    if (typeof req.query.region === 'string' && VALID_REGIONS.has(req.query.region)) {
      const regionVal = req.query.region as 'Miền Bắc' | 'Miền Trung' | 'Miền Nam';
      const regionalTrails = await TrailModel.find({ region: regionVal }).select('_id').lean();
      if (explicitTrailObjId) {
        const matchesRegion = regionalTrails.some((t) => String(t._id) === String(explicitTrailObjId));
        if (!matchesRegion) {
          return res.json({ success: true, data: [], pagination: { total: 0, page, limit } });
        }
      } else {
        query.trailId = { $in: regionalTrails.map((t) => t._id) };
      }
    }

    // Filter by valid YYYY-MM (01..12) month or explicit fromDate/toDate
    if (typeof req.query.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month)) {
      const [yStr, mStr] = req.query.month.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      const startOfMonth = new Date(Date.UTC(y, m - 1, 1));
      const endOfMonth = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      query.startDate = { $gte: startOfMonth, $lte: endOfMonth };
    } else if (req.query.fromDate || req.query.toDate) {
      const dateRange: any = {};
      if (typeof req.query.fromDate === 'string') {
        const d = new Date(req.query.fromDate);
        if (!isNaN(d.getTime())) dateRange.$gte = d;
      }
      if (typeof req.query.toDate === 'string') {
        const d = new Date(req.query.toDate);
        if (!isNaN(d.getTime())) dateRange.$lte = d;
      }
      if (Object.keys(dateRange).length > 0) query.startDate = dateRange;
    }

    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const escaped = req.query.search.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      query.$or = [{ title: rx }, { trailName: rx }, { meetingPoint: rx }, { description: rx }];
    }

    if (req.query.mine === 'true' && req.user?.userId && isValidObjectId(req.user.userId)) {
      const uid = new mongoose.Types.ObjectId(req.user.userId);
      query.$and = [...(query.$and || []), { $or: [{ creatorId: uid }, { currentMembers: uid }] }];
    }

    const viewerId = req.user?.userId ? String(req.user.userId) : '';
    const skip = (page - 1) * limit;
    const [rawTrips, total] = await Promise.all([
      TripPlanModel.find(query)
        .select('-sharedGear -expenses -groupConversationId -safetyGate -settledTransfers')
        .populate('creatorId', 'fullName avatarUrl reputationScore badges')
        .populate('currentMembers', 'fullName avatarUrl')
        .populate('trailId', 'id name province region maxAltitudeM')
        .sort({ startDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TripPlanModel.countDocuments(query),
    ]);

    // Compute hasPendingRequest strictly for viewer without leaking other applicants
    const trips = rawTrips.map((t: any) => {
      const hasPendingRequest = Boolean(
        viewerId &&
          Array.isArray(t.pendingRequests) &&
          t.pendingRequests.some((r: any) => String(r?.userId?._id || r?.userId || '') === viewerId)
      );
      const { pendingRequests: _strippedPending, ...publicTrip } = t;
      return {
        ...publicTrip,
        hasPendingRequest,
      };
    });

    const totalPages = Math.ceil(total / limit);
    const hasMore = skip + trips.length < total;

    return res.json({
      success: true,
      data: trips,
      pagination: { total, page, limit, totalPages, hasMore },
    });
  } catch (err) {
    console.error('[Get Trip Plans Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách chuyến ghép đoàn.' });
  }
};

// GET /api/trips/calendar?year=2026&month=11&region= - Lightweight monthly Community Expedition Calendar feed
export const getTripCalendar = async (req: Request, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, year: new Date().getFullYear(), month: new Date().getMonth() + 1, days: {}, trips: [] });
    }

    const now = new Date();
    const year = Math.min(2035, Math.max(2024, parseInt(String(req.query.year || now.getFullYear()), 10) || now.getFullYear()));
    const month = Math.min(12, Math.max(1, parseInt(String(req.query.month || now.getMonth() + 1), 10) || now.getMonth() + 1));

    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const query: any = {
      status: { $in: ['recruiting', 'full', 'in_progress'] },
      startDate: { $lte: endOfMonth },
      endDate: { $gte: startOfMonth },
    };

    if (typeof req.query.region === 'string' && VALID_REGIONS.has(req.query.region)) {
      const regionVal = req.query.region as 'Miền Bắc' | 'Miền Trung' | 'Miền Nam';
      const regionalTrails = await TrailModel.find({ region: regionVal }).select('_id').lean();
      query.trailId = { $in: regionalTrails.map((t) => t._id) };
    }

    const trips = await TripPlanModel.find(query)
      .select('title trailId trailName startDate endDate maxMembers currentMembers difficultyLevel status meetingPoint estimatedCost coverImage creatorId')
      .populate('creatorId', 'fullName avatarUrl')
      .populate('trailId', 'id name region province maxAltitudeM')
      .sort({ startDate: 1 })
      .limit(100)
      .lean();

    const days: Record<string, any[]> = {};
    const formatted = trips.map((t: any) => {
      const memberCount = Array.isArray(t.currentMembers) ? t.currentMembers.length : 1;
      const item = {
        _id: t._id.toString(),
        title: t.title,
        trailId: t.trailId?.id || (t.trailId?._id ? String(t.trailId._id) : undefined),
        trailName: t.trailName || t.trailId?.name || '',
        region: t.trailId?.region || '',
        province: t.trailId?.province || '',
        maxAltitudeM: t.trailId?.maxAltitudeM || 0,
        startDate: t.startDate,
        endDate: t.endDate,
        difficultyLevel: t.difficultyLevel,
        status: t.status,
        memberCount,
        maxMembers: t.maxMembers,
        seatsLeft: Math.max(0, (t.maxMembers || 6) - memberCount),
        meetingPoint: t.meetingPoint,
        estimatedCost: t.estimatedCost,
        coverImage: t.coverImage,
        creator: t.creatorId,
      };
      const dateKey = new Date(t.startDate).toISOString().split('T')[0];
      if (!days[dateKey]) days[dateKey] = [];
      days[dateKey].push(item);
      return item;
    });

    return res.json({
      success: true,
      year,
      month,
      count: formatted.length,
      days,
      trips: formatted,
    });
  } catch (err) {
    console.error('[Get Trip Calendar Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải lịch khởi hành cộng đồng.' });
  }
};

// GET /api/trips/:id - Single trip plan detail (strictly protects squad workspace & pendingRequests)
export const getTripPlanById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã chuyến đi không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const trip = await TripPlanModel.findByIdAndUpdate(id, { $inc: { viewsCount: 1 } }, { new: true })
      .populate('creatorId', 'fullName avatarUrl reputationScore badges bio')
      .populate('currentMembers', 'fullName avatarUrl reputationScore badges')
      .populate('pendingRequests.userId', 'fullName avatarUrl reputationScore')
      .populate('trailId', 'id name province region maxAltitudeM distanceKm')
      .lean();

    if (!trip) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi.' });
    }

    const viewerId = req.user?.userId ? String(req.user.userId) : '';
    const creatorIdStr = String((trip.creatorId as any)?._id || trip.creatorId);
    const isCreator = Boolean(viewerId && viewerId === creatorIdStr);
    const isMember =
      isCreator ||
      (Boolean(viewerId) &&
        Array.isArray(trip.currentMembers) &&
        trip.currentMembers.some((m: any) => String(m?._id || m) === viewerId));
    const hasPendingRequest = Boolean(
      viewerId &&
        Array.isArray(trip.pendingRequests) &&
        trip.pendingRequests.some((r: any) => String(r?.userId?._id || r?.userId || '') === viewerId)
    );

    // Only creator sees pending applicants; only approved members see private squad gear, safetyGate, expenses, settlements & group chat ID
    if (!isCreator) {
      (trip as any).pendingRequests = [];
    }
    if (!isMember) {
      (trip as any).sharedGear = [];
      (trip as any).expenses = [];
      (trip as any).safetyGate = {};
      (trip as any).settledTransfers = [];
      delete (trip as any).groupConversationId;
    } else {
      (trip as any).safetyGate = serializeSafetyGate((trip as any).safetyGate);
      (trip as any).settledTransfers = Array.isArray((trip as any).settledTransfers)
        ? (trip as any).settledTransfers
        : [];
    }
    (trip as any).hasPendingRequest = hasPendingRequest;

    return res.json({
      success: true,
      viewerRole: isCreator ? 'creator' : isMember ? 'member' : 'guest',
      data: trip,
    });
  } catch (err) {
    console.error('[Get Trip Plan Detail Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải chi tiết chuyến đi.' });
  }
};

// PUT /api/trips/:id - Creator or Admin edits trip plan metadata
export const updateTripPlan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const isAdmin = req.user?.role === 'admin';
    const { id } = req.params;

    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã chuyến đi không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const trip = await TripPlanModel.findById(id);
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi.' });
    }
    if (!isAdmin && String(trip.creatorId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Chỉ trưởng đoàn mới có quyền chỉnh sửa chuyến đi.' });
    }

    const {
      title,
      startDate,
      endDate,
      maxMembers,
      difficultyLevel,
      difficulty,
      estimatedCost,
      estimatedBudget,
      description,
      meetingPoint,
      requirements,
      tags,
      trailId,
      trailName,
    } = req.body || {};

    const nextTitle = title !== undefined ? sanitizeInput(String(title)).slice(0, 180) : trip.title;
    const nextDesc = description !== undefined ? sanitizeInput(String(description)).slice(0, 3000) : trip.description;
    const nextReq = requirements !== undefined ? sanitizeInput(String(requirements)).slice(0, 500) : trip.requirements;
    const nextMeeting = meetingPoint !== undefined ? sanitizeInput(String(meetingPoint)).slice(0, 200) : trip.meetingPoint;
    const rawBudget = estimatedCost !== undefined ? estimatedCost : estimatedBudget;
    const nextBudget = rawBudget !== undefined ? sanitizeInput(String(rawBudget)).slice(0, 200) : trip.estimatedCost;

    if (!nextTitle.trim()) {
      return res.status(400).json({ success: false, message: 'Tiêu đề chuyến đi không được để trống.' });
    }
    if (containsProfanity(`${nextTitle} ${nextDesc} ${nextReq} ${nextMeeting}`)) {
      const matched = getProfanityMatch(`${nextTitle} ${nextDesc} ${nextReq} ${nextMeeting}`);
      return res.status(400).json({
        success: false,
        message: `Nội dung chứa từ ngữ vi phạm quy chuẩn cộng đồng ("${matched}").`,
      });
    }

    let nextStart = trip.startDate;
    let nextEnd = trip.endDate;
    if (startDate !== undefined) {
      const d = new Date(startDate);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: 'Ngày khởi hành không hợp lệ.' });
      }
      nextStart = d;
    }
    if (endDate !== undefined) {
      const d = new Date(endDate);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: 'Ngày kết thúc không hợp lệ.' });
      }
      nextEnd = d;
    }
    const MAX_TRIP_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
    if (nextEnd < nextStart || nextEnd.getTime() - nextStart.getTime() > MAX_TRIP_DURATION_MS) {
      return res.status(400).json({
        success: false,
        message: 'Ngày kết thúc phải lớn hơn hoặc bằng ngày khởi hành (tối đa 30 ngày).',
      });
    }

    let nextMax = trip.maxMembers;
    if (maxMembers !== undefined && Number.isFinite(Number(maxMembers))) {
      const parsedMax = Math.min(50, Math.max(2, Math.round(Number(maxMembers))));
      if (parsedMax < trip.currentMembers.length) {
        return res.status(400).json({
          success: false,
          message: `Số lượng tối đa không thể nhỏ hơn số thành viên hiện tại (${trip.currentMembers.length}).`,
        });
      }
      nextMax = parsedMax;
    }

    const rawDiff = difficultyLevel !== undefined ? difficultyLevel : difficulty;
    if (rawDiff !== undefined && Number.isFinite(Number(rawDiff))) {
      trip.difficultyLevel = Math.min(5, Math.max(1, Math.round(Number(rawDiff))));
    }

    if (trailId !== undefined) {
      const resolvedTrail = trailId ? await resolveTrailByIdOrSlug(String(trailId)) : null;
      trip.trailId = resolvedTrail?._id || undefined;
      if (trailName === undefined) {
        trip.trailName = resolvedTrail?.name || '';
      }
    }
    if (trailName !== undefined) {
      trip.trailName = sanitizeInput(String(trailName)).slice(0, 160);
    }

    if (Array.isArray(tags)) {
      trip.tags = tags
        .filter((t: unknown) => typeof t === 'string' && t.trim())
        .slice(0, 10)
        .map((t: string) => sanitizeInput(t).slice(0, 30));
    }

    const titleChanged = nextTitle !== trip.title;
    trip.title = nextTitle;
    trip.description = nextDesc || nextTitle;
    trip.requirements = nextReq;
    trip.meetingPoint = nextMeeting;
    trip.estimatedCost = nextBudget;
    trip.startDate = nextStart;
    trip.endDate = nextEnd;
    trip.maxMembers = nextMax;

    if (trip.status === 'recruiting' && trip.currentMembers.length >= trip.maxMembers) {
      trip.status = 'full';
    } else if (trip.status === 'full' && trip.currentMembers.length < trip.maxMembers) {
      trip.status = 'recruiting';
    }

    await trip.save();

    if (titleChanged && trip.groupConversationId) {
      await ConversationModel.updateOne(
        { _id: trip.groupConversationId },
        { $set: { groupName: `Đoàn: ${trip.title}`.slice(0, 140) } }
      ).catch(() => {});
    }

    const populated = await TripPlanModel.findById(trip._id)
      .populate('creatorId', 'fullName avatarUrl reputationScore badges bio')
      .populate('currentMembers', 'fullName avatarUrl reputationScore badges')
      .populate('pendingRequests.userId', 'fullName avatarUrl reputationScore')
      .populate('trailId', 'id name province region maxAltitudeM distanceKm')
      .lean();

    if (populated) {
      (populated as any).safetyGate = serializeSafetyGate((populated as any).safetyGate);
      (populated as any).settledTransfers = Array.isArray((populated as any).settledTransfers)
        ? (populated as any).settledTransfers
        : [];
    }

    return res.json({
      success: true,
      message: 'Đã cập nhật thông tin chuyến ghép đoàn!',
      data: populated || trip,
    });
  } catch (err) {
    console.error('[Update Trip Plan Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật chuyến đi.' });
  }
};

// DELETE /api/trips/:id/members/:memberId - Creator removes an approved member from the squad & group chat
export const kickTripMember = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const isAdmin = req.user?.role === 'admin';
    const { id, memberId } = req.params;

    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id) || !isValidObjectId(memberId)) {
      return res.status(400).json({ success: false, message: 'Mã chuyến đi hoặc thành viên không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const trip = await TripPlanModel.findById(id);
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi.' });
    }
    if (!isAdmin && String(trip.creatorId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Chỉ trưởng đoàn mới có quyền quản lý thành viên.' });
    }
    if (String(trip.creatorId) === String(memberId)) {
      return res.status(400).json({ success: false, message: 'Không thể xóa trưởng đoàn khỏi chuyến đi.' });
    }

    const memberObjId = new mongoose.Types.ObjectId(memberId);
    const isMember = trip.currentMembers.some((m) => String(m) === String(memberId));
    if (!isMember) {
      return res.status(404).json({ success: false, message: 'Người này không nằm trong danh sách thành viên đoàn.' });
    }

    await TripPlanModel.updateOne({ _id: trip._id }, { $pull: { currentMembers: memberObjId } });
    await TripPlanModel.updateOne(
      {
        _id: trip._id,
        status: 'full',
        $expr: { $lt: [{ $size: '$currentMembers' }, '$maxMembers'] },
      },
      { $set: { status: 'recruiting' } }
    );

    if (trip.groupConversationId) {
      await ConversationModel.updateOne(
        { _id: trip.groupConversationId },
        { $pull: { participants: memberObjId } }
      ).catch(() => {});
      evictUserFromRoom(String(memberId), `conv:${trip.groupConversationId.toString()}`);
    }

    sendNotification({
      recipientId: String(memberId),
      type: 'system',
      category: 'social',
      title: 'Cập nhật danh sách đoàn',
      message: `Trưởng đoàn đã điều chỉnh danh sách và đưa bạn ra khỏi chuyến "${trip.title}".`,
      link: '/forum?tab=trips',
      relatedId: trip._id.toString(),
    }).catch(() => {});

    const refreshed = await TripPlanModel.findById(trip._id)
      .select('currentMembers status')
      .populate('currentMembers', 'fullName avatarUrl reputationScore badges')
      .lean();

    return res.json({
      success: true,
      message: 'Đã xóa thành viên khỏi đoàn và phòng chat nhóm.',
      data: refreshed,
    });
  } catch (err) {
    console.error('[Kick Trip Member Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa thành viên khỏi đoàn.' });
  }
};

// POST /api/trips/:id/join - Atomic deduplicated join request + creator notification
export const requestJoinTrip = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để xin tham gia đoàn.' });
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã chuyến đi không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const message = sanitizeInput(
      typeof req.body?.message === 'string' && req.body.message.trim()
        ? req.body.message
        : 'Chào trưởng đoàn, mình muốn tham gia đi cùng đoàn!'
    ).slice(0, 500);

    const userObjId = new mongoose.Types.ObjectId(userId);

    const updatedTrip = await TripPlanModel.findOneAndUpdate(
      {
        _id: id,
        status: 'recruiting',
        currentMembers: { $ne: userObjId },
        'pendingRequests.userId': { $ne: userObjId },
      },
      {
        $push: {
          pendingRequests: {
            userId: userObjId,
            message,
            requestedAt: new Date(),
          },
        },
      },
      { new: true }
    )
      .select('creatorId title')
      .lean();

    if (!updatedTrip) {
      const trip = await TripPlanModel.findById(id).select('status currentMembers pendingRequests').lean();
      if (!trip) return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi.' });
      if (trip.status !== 'recruiting') {
        return res.status(400).json({ success: false, message: 'Chuyến đi này hiện đã đóng hoặc chốt danh sách.' });
      }
      if (trip.currentMembers.some((m) => String(m) === userId)) {
        return res.status(400).json({ success: false, message: 'Bạn đã là thành viên của đoàn này rồi.' });
      }
      return res.status(400).json({ success: false, message: 'Bạn đã gửi yêu cầu rồi, vui lòng chờ trưởng đoàn duyệt.' });
    }

    const applicant = await UserModel.findById(userObjId).select('fullName avatarUrl').lean();
    sendNotification({
      recipientId: String(updatedTrip.creatorId),
      sender: { id: userId, name: applicant?.fullName || 'Trekker', avatarUrl: applicant?.avatarUrl || '' },
      type: 'system',
      category: 'social',
      title: 'Yêu cầu xin ghép đoàn mới',
      message: `${applicant?.fullName || 'Một Trekker'} muốn tham gia chuyến "${updatedTrip.title}": "${message.slice(0, 80)}"`,
      link: '/forum?tab=trips',
      relatedId: id,
    }).catch(() => {});

    return res.json({ success: true, message: 'Đã gửi yêu cầu ghép đoàn tới trưởng đoàn thành công!' });
  } catch (err) {
    console.error('[Request Join Trip Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi gửi yêu cầu tham gia.' });
  }
};

// PUT /api/trips/:id/approve - Atomic capacity-checked approval + notification + Activity log
export const approveJoinTrip = async (req: AuthRequest, res: Response) => {
  try {
    const creatorId = req.user?.userId;
    const { id } = req.params;
    const applicantUserId = String(req.body?.applicantUserId || req.body?.userId || '').trim();

    if (!creatorId || !isValidObjectId(creatorId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id) || !isValidObjectId(applicantUserId)) {
      return res.status(400).json({ success: false, message: 'Thông tin chuyến đi hoặc ứng viên không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const applicantObjId = new mongoose.Types.ObjectId(applicantUserId);
    const creatorObjId = new mongoose.Types.ObjectId(creatorId);

    const updatedTrip = await TripPlanModel.findOneAndUpdate(
      {
        _id: id,
        creatorId: creatorObjId,
        status: 'recruiting',
        'pendingRequests.userId': applicantObjId,
        $expr: { $lt: [{ $size: '$currentMembers' }, '$maxMembers'] },
      },
      {
        $pull: { pendingRequests: { userId: applicantObjId } },
        $addToSet: { currentMembers: applicantObjId },
      },
      { new: true }
    );

    if (!updatedTrip) {
      const trip = await TripPlanModel.findById(id).select('creatorId status currentMembers maxMembers pendingRequests').lean();
      if (!trip) return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi.' });
      if (String(trip.creatorId) !== String(creatorId)) {
        return res.status(403).json({ success: false, message: 'Chỉ trưởng đoàn mới có quyền duyệt thành viên.' });
      }
      if (trip.status !== 'recruiting' || trip.currentMembers.length >= trip.maxMembers) {
        return res.status(400).json({ success: false, message: 'Đoàn đã đủ số lượng thành viên tối đa.' });
      }
      return res.status(400).json({ success: false, message: 'Ứng viên này chưa gửi yêu cầu tham gia đoàn.' });
    }

    // Conditionally flip status -> 'full' atomically only if member count still meets/exceeds maxMembers
    await TripPlanModel.updateOne(
      {
        _id: updatedTrip._id,
        status: 'recruiting',
        $expr: { $gte: [{ $size: '$currentMembers' }, '$maxMembers'] },
      },
      { $set: { status: 'full' } }
    );

    if (updatedTrip.groupConversationId) {
      await ConversationModel.updateOne(
        { _id: updatedTrip.groupConversationId },
        { $addToSet: { participants: applicantObjId } }
      ).catch(() => {});
    }

    const [creator, applicant] = await Promise.all([
      UserModel.findById(creatorObjId).select('fullName avatarUrl').lean(),
      UserModel.findById(applicantObjId).select('fullName').lean(),
    ]);

    sendNotification({
      recipientId: applicantUserId,
      sender: { id: creatorId, name: creator?.fullName || 'Trưởng đoàn', avatarUrl: creator?.avatarUrl || '' },
      type: 'system',
      category: 'social',
      title: 'Bạn đã được duyệt vào đoàn!',
      message: `Trưởng đoàn đã chấp thuận yêu cầu tham gia chuyến "${updatedTrip.title}". Bạn đã có thể mở Không Gian Đoàn & Chat nhóm!`,
      link: '/forum?tab=trips',
      relatedId: updatedTrip._id.toString(),
    }).catch(() => {});

    await recordActivity({
      userId: applicantObjId,
      type: 'joined_trip',
      title: `${applicant?.fullName || 'Trekker'} đã gia nhập chuyến ghép đoàn "${updatedTrip.title}"`,
      targetType: 'trip_plan',
      targetId: updatedTrip._id.toString(),
      thumbnailUrl: updatedTrip.coverImage,
    });

    return res.json({ success: true, message: 'Đã duyệt thành viên vào đoàn thành công!' });
  } catch (err) {
    console.error('[Approve Join Trip Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi duyệt thành viên.' });
  }
};

// PUT /api/trips/:id/reject - Creator rejects a pending applicant
export const rejectJoinTrip = async (req: AuthRequest, res: Response) => {
  try {
    const creatorId = req.user?.userId;
    const { id } = req.params;
    const applicantUserId = String(req.body?.applicantUserId || req.body?.userId || '').trim();
    const reason = req.body?.reason ?? '';

    if (!creatorId || !isValidObjectId(creatorId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id) || !isValidObjectId(applicantUserId)) {
      return res.status(400).json({ success: false, message: 'Thông tin chuyến đi hoặc ứng viên không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const applicantObjId = new mongoose.Types.ObjectId(applicantUserId);
    const updatedTrip = await TripPlanModel.findOneAndUpdate(
      { _id: id, creatorId: new mongoose.Types.ObjectId(creatorId), 'pendingRequests.userId': applicantObjId },
      { $pull: { pendingRequests: { userId: applicantObjId } } },
      { new: true }
    )
      .select('title')
      .lean();

    if (!updatedTrip) {
      const trip = await TripPlanModel.findById(id).select('creatorId').lean();
      if (!trip) return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi.' });
      if (String(trip.creatorId) !== String(creatorId)) {
        return res.status(403).json({ success: false, message: 'Chỉ trưởng đoàn mới có quyền từ chối yêu cầu.' });
      }
      return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu ghép đoàn của ứng viên này.' });
    }

    const safeReason = sanitizeInput(String(reason || '')).slice(0, 200);
    sendNotification({
      recipientId: applicantUserId,
      type: 'system',
      category: 'social',
      title: 'Phản hồi yêu cầu ghép đoàn',
      message: `Yêu cầu tham gia chuyến "${updatedTrip.title}" chưa được chấp thuận${safeReason ? `: ${safeReason}` : '.'}`,
      link: '/forum?tab=trips',
      relatedId: id,
    }).catch(() => {});

    return res.json({ success: true, message: 'Đã từ chối yêu cầu ghép đoàn.' });
  } catch (err) {
    console.error('[Reject Join Trip Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xử lý từ chối yêu cầu.' });
  }
};

// POST /api/trips/:id/leave - Non-creator member leaves squad (auto-reopens 'full' -> 'recruiting')
export const leaveTrip = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã chuyến đi không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const trip = await TripPlanModel.findById(id);
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi.' });
    }
    if (String(trip.creatorId) === String(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Trưởng đoàn không thể tự rời đoàn. Vui lòng hủy chuyến đi nếu không tiếp tục.',
      });
    }

    const userObjId = new mongoose.Types.ObjectId(userId);
    const wasMember = trip.currentMembers.some((m) => String(m) === userId);
    if (!wasMember) {
      // Also allow withdrawing pending request
      const withdrew = await TripPlanModel.updateOne(
        { _id: id, 'pendingRequests.userId': userObjId },
        { $pull: { pendingRequests: { userId: userObjId } } }
      );
      if (withdrew.modifiedCount > 0) {
        return res.json({ success: true, message: 'Đã rút yêu cầu xin ghép đoàn.' });
      }
      return res.status(400).json({ success: false, message: 'Bạn không phải thành viên của đoàn này.' });
    }

    const updated = await TripPlanModel.findByIdAndUpdate(
      id,
      { $pull: { currentMembers: userObjId } },
      { new: true }
    );

    if (updated) {
      await TripPlanModel.updateOne(
        {
          _id: id,
          status: 'full',
          $expr: { $lt: [{ $size: '$currentMembers' }, '$maxMembers'] },
        },
        { $set: { status: 'recruiting' } }
      );
    }

    if (trip.groupConversationId) {
      await ConversationModel.updateOne(
        { _id: trip.groupConversationId },
        { $pull: { participants: userObjId } }
      ).catch(() => {});
      evictUserFromRoom(String(userId), `conv:${trip.groupConversationId.toString()}`);
    }

    return res.json({ success: true, message: 'Bạn đã rời khỏi chuyến ghép đoàn.' });
  } catch (err) {
    console.error('[Leave Trip Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi rời chuyến đi.' });
  }
};

// PATCH /api/trips/:id/status - Creator or Admin updates trip lifecycle status
export const updateTripStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const isAdmin = req.user?.role === 'admin';
    const { id } = req.params;
    const { status } = req.body || {};

    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã chuyến đi không hợp lệ.' });
    }
    if (typeof status !== 'string' || !VALID_TRIP_STATUSES.has(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái chuyến đi không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const trip = await TripPlanModel.findById(id);
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi.' });
    }
    if (!isAdmin && String(trip.creatorId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Chỉ trưởng đoàn mới có quyền cập nhật trạng thái chuyến đi.' });
    }

    trip.status = status as any;
    await trip.save();

    return res.json({ success: true, message: 'Đã cập nhật trạng thái chuyến đi!', data: trip });
  } catch (err) {
    console.error('[Update Trip Status Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật trạng thái chuyến đi.' });
  }
};

// DELETE /api/trips/:id - Creator or Admin deletes trip plan
export const deleteTripPlan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const isAdmin = req.user?.role === 'admin';
    const { id } = req.params;

    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã chuyến đi không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const trip = await TripPlanModel.findById(id)
      .select('creatorId title groupConversationId currentMembers')
      .lean();
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi.' });
    }
    if (!isAdmin && String(trip.creatorId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Chỉ trưởng đoàn hoặc Admin mới có quyền xóa chuyến đi.' });
    }

    await TripPlanModel.deleteOne({ _id: id });
    if (trip.groupConversationId) {
      evictAllFromRoom(`conv:${trip.groupConversationId.toString()}`);
      await Promise.all([
        MessageModel.deleteMany({ conversation: trip.groupConversationId }).catch(() => {}),
        ConversationModel.deleteOne({ _id: trip.groupConversationId }).catch(() => {}),
      ]);
    }

    const otherMembers = (trip.currentMembers || [])
      .map((m) => String(m))
      .filter((uid) => uid !== String(userId));
    await Promise.all(
      otherMembers.map((recipientId) =>
        sendNotification({
          recipientId,
          type: 'system',
          category: 'social',
          title: 'Chuyến ghép đoàn đã bị hủy',
          message: `Chuyến đi "${trip.title}" đã được trưởng đoàn đóng / xóa khỏi lịch khởi hành.`,
          link: '/forum?tab=trips',
        }).catch(() => {})
      )
    );

    return res.json({ success: true, message: 'Đã xóa chuyến ghép đoàn thành công!' });
  } catch (err) {
    console.error('[Delete Trip Plan Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa chuyến đi.' });
  }
};

// Helper: verify user is a current member or creator of a TripPlan
async function loadAuthorizedTrip(tripId: string, userId: string) {
  if (!isValidObjectId(tripId)) return { errorStatus: 400, errorMessage: 'Mã chuyến đi không hợp lệ.' };
  if (mongoose.connection.readyState !== 1) {
    return { errorStatus: 503, errorMessage: 'Cơ sở dữ liệu chưa sẵn sàng.' };
  }
  const trip = await TripPlanModel.findById(tripId);
  if (!trip) return { errorStatus: 404, errorMessage: 'Không tìm thấy chuyến đi.' };
  const isMember =
    String(trip.creatorId) === String(userId) ||
    trip.currentMembers.some((m) => String(m) === String(userId));
  if (!isMember) {
    return { errorStatus: 403, errorMessage: 'Chỉ thành viên đã được duyệt vào đoàn mới có quyền truy cập không gian đoàn.' };
  }
  return { trip };
}

// POST /api/trips/:id/group-chat - Create or open multi-member Group Chat for the Expedition Squad
export const openTripGroupChat = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    const { trip, errorStatus, errorMessage } = await loadAuthorizedTrip(String(req.params.id || ''), userId);
    if (!trip) {
      return res.status(errorStatus!).json({ success: false, message: errorMessage });
    }

    const participantKey = `trip_${trip._id.toString()}`;
    const memberIds = Array.from(
      new Set([trip.creatorId.toString(), ...trip.currentMembers.map((m) => m.toString())])
    ).map((id) => new mongoose.Types.ObjectId(id));

    const conversation = await ConversationModel.findOneAndUpdate(
      { participantKey },
      {
        $setOnInsert: {
          participantKey,
          isGroup: true,
          groupName: `Đoàn: ${trip.title}`.slice(0, 140),
          tripPlanId: trip._id,
        },
        $addToSet: { participants: { $each: memberIds } },
      },
      { upsert: true, new: true }
    );

    if (!trip.groupConversationId || String(trip.groupConversationId) !== String(conversation._id)) {
      await TripPlanModel.updateOne({ _id: trip._id }, { $set: { groupConversationId: conversation._id } });
    }

    return res.json({
      success: true,
      message: 'Đã mở phòng chat nhóm cho đoàn!',
      data: {
        conversationId: conversation._id.toString(),
        groupName: conversation.groupName,
      },
    });
  } catch (err) {
    console.error('[Open Trip Group Chat Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể khởi tạo phòng chat nhóm.' });
  }
};

// PATCH /api/trips/:id/safety-gate - Member or creator toggles a 6-step safety gate step in MongoDB
export const toggleSafetyGateStep = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    const { trip, errorStatus, errorMessage } = await loadAuthorizedTrip(String(req.params.id || ''), userId);
    if (!trip) {
      return res.status(errorStatus!).json({ success: false, message: errorMessage });
    }

    const { stepKey, checked, reset } = req.body || {};

    if (reset === true) {
      const resetSet: Record<string, boolean> = {};
      for (const k of VALID_SAFETY_GATE_KEYS) {
        resetSet[`safetyGate.${k}`] = false;
      }
      const updated = await TripPlanModel.findByIdAndUpdate(
        trip._id,
        { $set: resetSet },
        { new: true }
      )
        .select('safetyGate')
        .lean();
      return res.json({
        success: true,
        message: 'Đã đặt lại 6 bước Cổng Kiểm Tra An Toàn.',
        data: serializeSafetyGate(updated?.safetyGate),
      });
    }

    const cleanKey = typeof stepKey === 'string' ? stepKey.trim() : '';
    if (!VALID_SAFETY_GATE_KEYS.has(cleanKey)) {
      return res.status(400).json({ success: false, message: 'Hạng mục kiểm tra an toàn không hợp lệ.' });
    }

    const currentMap = serializeSafetyGate(trip.safetyGate);
    const nextValue = typeof checked === 'boolean' ? checked : !currentMap[cleanKey];

    const updated = await TripPlanModel.findByIdAndUpdate(
      trip._id,
      { $set: { [`safetyGate.${cleanKey}`]: nextValue } },
      { new: true }
    )
      .select('safetyGate')
      .lean();

    return res.json({
      success: true,
      data: serializeSafetyGate(updated?.safetyGate),
    });
  } catch (err) {
    console.error('[Toggle Safety Gate Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật Cổng Kiểm Tra An Toàn.' });
  }
};

// POST /api/trips/:id/gear - Atomically add a shared group gear item with weightG & assignment (capped at 100)
export const addSharedGear = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    const {
      itemName,
      category = 'Dùng chung',
      weightG = 500,
      assignedUserId,
      assignedUserName,
      claimByMe = false,
    } = req.body || {};

    const cleanName = sanitizeInput(String(itemName || '')).trim();
    const cleanCategory = sanitizeInput(String(category)).slice(0, 60) || 'Dùng chung';
    const rawWeight = Math.round(Number(weightG));
    const safeWeightG = Number.isFinite(rawWeight) && rawWeight >= 0 ? Math.min(100_000, rawWeight) : 500;

    if (!cleanName) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên vật dụng dùng chung.' });
    }
    if (containsProfanity(`${cleanName} ${cleanCategory}`)) {
      const matched = getProfanityMatch(`${cleanName} ${cleanCategory}`);
      return res.status(400).json({ success: false, message: `Tên vật dụng chứa từ ngữ không phù hợp ("${matched}").` });
    }

    const { trip, errorStatus, errorMessage } = await loadAuthorizedTrip(String(req.params.id || ''), userId);
    if (!trip) {
      return res.status(errorStatus!).json({ success: false, message: errorMessage });
    }

    let resolvedAssigneeId: mongoose.Types.ObjectId | undefined;
    let resolvedAssigneeName = 'Chưa nhận';

    if (typeof assignedUserId === 'string' && assignedUserId.trim()) {
      const rawAssigneeId = assignedUserId.trim();
      const memberSet = new Set([String(trip.creatorId), ...trip.currentMembers.map((m) => String(m))]);
      if (isValidObjectId(rawAssigneeId) && memberSet.has(rawAssigneeId)) {
        resolvedAssigneeId = new mongoose.Types.ObjectId(rawAssigneeId);
        const assigneeDoc = await UserModel.findById(rawAssigneeId).select('fullName username').lean();
        resolvedAssigneeName =
          assigneeDoc?.fullName ||
          assigneeDoc?.username ||
          sanitizeInput(String(assignedUserName || '')).slice(0, 80) ||
          'Thành viên';
      }
    } else if (typeof assignedUserName === 'string' && assignedUserName.trim()) {
      resolvedAssigneeName = sanitizeInput(assignedUserName).slice(0, 80);
    } else if (claimByMe === true) {
      const user = await UserModel.findById(userId).select('fullName username').lean();
      resolvedAssigneeId = new mongoose.Types.ObjectId(userId);
      resolvedAssigneeName = user?.fullName || user?.username || 'Thành viên';
    }

    const newItem = {
      id: `gear-${crypto.randomBytes(6).toString('hex')}`,
      itemName: cleanName.slice(0, 140),
      category: cleanCategory,
      weightG: safeWeightG,
      assignedUserId: resolvedAssigneeId,
      assignedUserName: resolvedAssigneeName,
      packed: false,
    };

    const updated = await TripPlanModel.findOneAndUpdate(
      {
        _id: trip._id,
        $expr: { $lt: [{ $size: { $ifNull: ['$sharedGear', []] } }, MAX_SHARED_GEAR_ITEMS] },
      },
      { $push: { sharedGear: newItem } },
      { new: true }
    )
      .select('sharedGear')
      .lean();

    if (!updated) {
      return res.status(400).json({ success: false, message: `Danh sách đồ dùng chung đạt tối đa ${MAX_SHARED_GEAR_ITEMS} món.` });
    }

    return res.status(201).json({ success: true, data: updated.sharedGear || [] });
  } catch (err) {
    console.error('[Add Shared Gear Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi thêm đồ dùng chung.' });
  }
};

// PATCH /api/trips/:id/gear/:gearId - Update weightG, category, assignment, claim, or packed status
export const updateSharedGear = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    const { trip, errorStatus, errorMessage } = await loadAuthorizedTrip(String(req.params.id || ''), userId);
    if (!trip) {
      return res.status(errorStatus!).json({ success: false, message: errorMessage });
    }

    const gearId = String(req.params.gearId || '');
    const target = (trip.sharedGear || []).find((g) => g.id === gearId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vật dụng này.' });
    }

    const { packed, claim, weightG, category, itemName, assignedUserId, assignedUserName } = req.body || {};
    const setFields: Record<string, any> = {};
    const unsetFields: Record<string, any> = {};

    if (typeof packed === 'boolean') {
      setFields['sharedGear.$.packed'] = packed;
    }

    if (weightG !== undefined) {
      const parsedW = Math.round(Number(weightG));
      if (!Number.isFinite(parsedW) || parsedW < 0 || parsedW > 100_000) {
        return res.status(400).json({ success: false, message: 'Trọng lượng không hợp lệ (0 - 100.000g).' });
      }
      setFields['sharedGear.$.weightG'] = parsedW;
    }

    if (typeof category === 'string' && category.trim()) {
      const cleanCat = sanitizeInput(category).slice(0, 60);
      if (cleanCat) setFields['sharedGear.$.category'] = cleanCat;
    }

    if (typeof itemName === 'string' && itemName.trim()) {
      const cleanItem = sanitizeInput(itemName).slice(0, 140);
      if (containsProfanity(cleanItem)) {
        const matched = getProfanityMatch(cleanItem);
        return res.status(400).json({ success: false, message: `Tên vật dụng chứa từ ngữ không phù hợp ("${matched}").` });
      }
      if (cleanItem) setFields['sharedGear.$.itemName'] = cleanItem;
    }

    if (assignedUserId !== undefined) {
      if (assignedUserId === null || assignedUserId === '') {
        unsetFields['sharedGear.$.assignedUserId'] = '';
        setFields['sharedGear.$.assignedUserName'] = 'Chưa nhận';
      } else if (typeof assignedUserId === 'string' && isValidObjectId(assignedUserId.trim())) {
        const cleanAssigneeId = assignedUserId.trim();
        const memberSet = new Set([String(trip.creatorId), ...trip.currentMembers.map((m) => String(m))]);
        if (!memberSet.has(cleanAssigneeId)) {
          return res.status(400).json({ success: false, message: 'Người được phân công không thuộc danh sách thành viên đoàn.' });
        }
        const assigneeDoc = await UserModel.findById(cleanAssigneeId).select('fullName username').lean();
        setFields['sharedGear.$.assignedUserId'] = new mongoose.Types.ObjectId(cleanAssigneeId);
        setFields['sharedGear.$.assignedUserName'] =
          assigneeDoc?.fullName ||
          assigneeDoc?.username ||
          sanitizeInput(String(assignedUserName || '')).slice(0, 80) ||
          'Thành viên';
      } else if (typeof assignedUserName === 'string' && assignedUserName.trim()) {
        unsetFields['sharedGear.$.assignedUserId'] = '';
        setFields['sharedGear.$.assignedUserName'] = sanitizeInput(assignedUserName).slice(0, 80);
      }
    } else if (typeof assignedUserName === 'string') {
      const cleanAssigneeName = sanitizeInput(assignedUserName).slice(0, 80);
      setFields['sharedGear.$.assignedUserName'] = cleanAssigneeName || 'Chưa nhận';
      if (!cleanAssigneeName || cleanAssigneeName === 'Chưa nhận') {
        unsetFields['sharedGear.$.assignedUserId'] = '';
      }
    }

    if (claim === true) {
      const user = await UserModel.findById(userId).select('fullName username').lean();
      setFields['sharedGear.$.assignedUserId'] = new mongoose.Types.ObjectId(userId);
      setFields['sharedGear.$.assignedUserName'] = user?.fullName || user?.username || 'Thành viên';
    } else if (claim === false) {
      unsetFields['sharedGear.$.assignedUserId'] = '';
      setFields['sharedGear.$.assignedUserName'] = 'Chưa nhận';
      setFields['sharedGear.$.packed'] = false;
    }

    const updateDoc: Record<string, any> = {};
    if (Object.keys(setFields).length > 0) updateDoc.$set = setFields;
    if (Object.keys(unsetFields).length > 0) updateDoc.$unset = unsetFields;

    if (Object.keys(updateDoc).length === 0) {
      return res.status(400).json({ success: false, message: 'Không có trường cập nhật hợp lệ.' });
    }

    const updated = await TripPlanModel.findOneAndUpdate(
      { _id: trip._id, 'sharedGear.id': gearId },
      updateDoc,
      { new: true }
    )
      .select('sharedGear')
      .lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vật dụng này.' });
    }

    return res.json({ success: true, data: updated.sharedGear });
  } catch (err) {
    console.error('[Update Shared Gear Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật đồ dùng chung.' });
  }
};

// DELETE /api/trips/:id/gear/:gearId - Remove shared gear item (creator or assignee)
export const deleteSharedGear = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    const { trip, errorStatus, errorMessage } = await loadAuthorizedTrip(String(req.params.id || ''), userId);
    if (!trip) {
      return res.status(errorStatus!).json({ success: false, message: errorMessage });
    }

    const gearId = String(req.params.gearId || '');
    const target = (trip.sharedGear || []).find((g) => g.id === gearId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vật dụng này.' });
    }

    const isCreator = String(trip.creatorId) === userId;
    const isAssignee = !target.assignedUserId || String(target.assignedUserId) === userId;
    if (!isCreator && !isAssignee) {
      return res.status(403).json({ success: false, message: 'Chỉ người phụ trách hoặc trưởng đoàn mới có quyền xóa vật dụng này.' });
    }

    const updated = await TripPlanModel.findByIdAndUpdate(
      trip._id,
      { $pull: { sharedGear: { id: gearId } } },
      { new: true }
    )
      .select('sharedGear')
      .lean();

    return res.json({ success: true, data: updated?.sharedGear || [] });
  } catch (err) {
    console.error('[Delete Shared Gear Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa vật dụng chung.' });
  }
};

// POST /api/trips/:id/expenses - Atomically record a shared expedition expense (VND, capped at 200; creator can pick payer)
export const addTripExpense = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    const { title, amountVnd, splitCount, paidByUserId, paidByName } = req.body || {};
    const cleanTitle = sanitizeInput(String(title || '')).trim();
    const amount = Math.round(Number(amountVnd));
    if (!cleanTitle || !Number.isFinite(amount) || amount < 1000 || amount > 500_000_000) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên khoản chi và số tiền hợp lệ (từ 1.000đ).' });
    }
    if (containsProfanity(cleanTitle)) {
      const matched = getProfanityMatch(cleanTitle);
      return res.status(400).json({ success: false, message: `Tên khoản chi chứa từ ngữ không phù hợp ("${matched}").` });
    }

    const { trip, errorStatus, errorMessage } = await loadAuthorizedTrip(String(req.params.id || ''), userId);
    if (!trip) {
      return res.status(errorStatus!).json({ success: false, message: errorMessage });
    }

    const isCreator = String(trip.creatorId) === String(userId);
    const memberSet = new Set([String(trip.creatorId), ...trip.currentMembers.map((m) => String(m))]);

    let targetPayerId = String(userId);
    if (isCreator && typeof paidByUserId === 'string' && isValidObjectId(paidByUserId.trim()) && memberSet.has(paidByUserId.trim())) {
      targetPayerId = paidByUserId.trim();
    }

    const payerDoc = await UserModel.findById(targetPayerId).select('fullName username').lean();
    const resolvedPayerName =
      payerDoc?.fullName ||
      payerDoc?.username ||
      (isCreator && typeof paidByName === 'string' && paidByName.trim() ? sanitizeInput(paidByName).slice(0, 80) : '') ||
      'Thành viên';

    const rawSplit = Number(splitCount);
    const memberCount =
      Number.isFinite(rawSplit) && rawSplit >= 1 ? Math.round(rawSplit) : trip.currentMembers.length || 1;

    const newExpense = {
      id: `exp-${crypto.randomBytes(6).toString('hex')}`,
      title: cleanTitle.slice(0, 140),
      amountVnd: amount,
      paidByUserId: new mongoose.Types.ObjectId(targetPayerId),
      paidByName: resolvedPayerName,
      splitCount: Math.min(50, Math.max(1, memberCount)),
      createdAt: new Date(),
    };

    const updated = await TripPlanModel.findOneAndUpdate(
      {
        _id: trip._id,
        $expr: { $lt: [{ $size: { $ifNull: ['$expenses', []] } }, MAX_EXPENSE_ITEMS] },
      },
      { $push: { expenses: newExpense } },
      { new: true }
    )
      .select('expenses')
      .lean();

    if (!updated) {
      return res.status(400).json({ success: false, message: `Số khoản chi đạt tối đa ${MAX_EXPENSE_ITEMS} mục.` });
    }

    return res.status(201).json({ success: true, data: updated.expenses || [] });
  } catch (err) {
    console.error('[Add Trip Expense Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi thêm khoản chi chuyến đi.' });
  }
};

// PATCH /api/trips/:id/expenses/:expenseId - Edit an expense entry (strictly payer or creator!)
export const updateTripExpense = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    const { trip, errorStatus, errorMessage } = await loadAuthorizedTrip(String(req.params.id || ''), userId);
    if (!trip) {
      return res.status(errorStatus!).json({ success: false, message: errorMessage });
    }

    const expenseId = String(req.params.expenseId || '');
    const target = (trip.expenses || []).find((e) => e.id === expenseId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khoản chi này.' });
    }

    const isCreator = String(trip.creatorId) === String(userId);
    const isPayer = target.paidByUserId ? String(target.paidByUserId) === String(userId) : false;
    if (!isCreator && !isPayer) {
      return res.status(403).json({ success: false, message: 'Chỉ người chi hoặc trưởng đoàn mới có quyền sửa khoản chi này.' });
    }

    const { title, amountVnd, splitCount, paidByUserId } = req.body || {};
    const setFields: Record<string, any> = {};

    if (title !== undefined) {
      const cleanTitle = sanitizeInput(String(title)).trim();
      if (!cleanTitle) {
        return res.status(400).json({ success: false, message: 'Tên khoản chi không được để trống.' });
      }
      if (containsProfanity(cleanTitle)) {
        const matched = getProfanityMatch(cleanTitle);
        return res.status(400).json({ success: false, message: `Tên khoản chi chứa từ ngữ không phù hợp ("${matched}").` });
      }
      setFields['expenses.$.title'] = cleanTitle.slice(0, 140);
    }

    if (amountVnd !== undefined) {
      const amount = Math.round(Number(amountVnd));
      if (!Number.isFinite(amount) || amount < 1000 || amount > 500_000_000) {
        return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ (từ 1.000đ đến 500.000.000đ).' });
      }
      setFields['expenses.$.amountVnd'] = amount;
    }

    if (splitCount !== undefined) {
      const parsedSplit = Math.round(Number(splitCount));
      if (Number.isFinite(parsedSplit) && parsedSplit >= 1 && parsedSplit <= 50) {
        setFields['expenses.$.splitCount'] = parsedSplit;
      }
    }

    if (isCreator && typeof paidByUserId === 'string' && isValidObjectId(paidByUserId.trim())) {
      const cleanPayerId = paidByUserId.trim();
      const memberSet = new Set([String(trip.creatorId), ...trip.currentMembers.map((m) => String(m))]);
      if (memberSet.has(cleanPayerId)) {
        const payerDoc = await UserModel.findById(cleanPayerId).select('fullName username').lean();
        setFields['expenses.$.paidByUserId'] = new mongoose.Types.ObjectId(cleanPayerId);
        setFields['expenses.$.paidByName'] = payerDoc?.fullName || payerDoc?.username || 'Thành viên';
      }
    }

    if (Object.keys(setFields).length === 0) {
      return res.status(400).json({ success: false, message: 'Không có trường cập nhật hợp lệ.' });
    }

    const updated = await TripPlanModel.findOneAndUpdate(
      { _id: trip._id, 'expenses.id': expenseId },
      { $set: setFields },
      { new: true }
    )
      .select('expenses')
      .lean();

    return res.json({ success: true, message: 'Đã cập nhật khoản chi!', data: updated?.expenses || [] });
  } catch (err) {
    console.error('[Update Trip Expense Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật khoản chi.' });
  }
};

// DELETE /api/trips/:id/expenses/:expenseId - Remove an expense entry (strictly payer or creator!)
export const deleteTripExpense = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    const { trip, errorStatus, errorMessage } = await loadAuthorizedTrip(String(req.params.id || ''), userId);
    if (!trip) {
      return res.status(errorStatus!).json({ success: false, message: errorMessage });
    }

    const expenseId = String(req.params.expenseId || '');
    const target = (trip.expenses || []).find((e) => e.id === expenseId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khoản chi này.' });
    }

    const isCreator = String(trip.creatorId) === userId;
    const isPayer = target.paidByUserId ? String(target.paidByUserId) === userId : false;
    if (!isCreator && !isPayer) {
      return res.status(403).json({ success: false, message: 'Chỉ người chi hoặc trưởng đoàn mới có quyền xóa khoản chi này.' });
    }

    const updated = await TripPlanModel.findByIdAndUpdate(
      trip._id,
      { $pull: { expenses: { id: expenseId } } },
      { new: true }
    )
      .select('expenses')
      .lean();

    return res.json({ success: true, data: updated?.expenses || [] });
  } catch (err) {
    console.error('[Delete Trip Expense Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa khoản chi.' });
  }
};

// POST /api/trips/:id/settlements - Toggle settled status for a debt transfer key in MongoDB
export const toggleTripSettlement = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    const { trip, errorStatus, errorMessage } = await loadAuthorizedTrip(String(req.params.id || ''), userId);
    if (!trip) {
      return res.status(errorStatus!).json({ success: false, message: errorMessage });
    }

    const rawKey = typeof req.body?.transferKey === 'string' ? req.body.transferKey.trim() : '';
    const transferKey = sanitizeInput(rawKey).slice(0, 200);
    if (!transferKey) {
      return res.status(400).json({ success: false, message: 'Thiếu mã giao dịch cần đánh dấu.' });
    }

    const currentList = Array.isArray(trip.settledTransfers) ? trip.settledTransfers : [];
    const alreadySettled = currentList.includes(transferKey);

    if (!alreadySettled && currentList.length >= MAX_SETTLED_TRANSFERS) {
      return res.status(400).json({ success: false, message: 'Đã đạt giới hạn lưu trạng thái quyết toán.' });
    }

    const updated = await TripPlanModel.findByIdAndUpdate(
      trip._id,
      alreadySettled
        ? { $pull: { settledTransfers: transferKey } }
        : { $addToSet: { settledTransfers: transferKey } },
      { new: true }
    )
      .select('settledTransfers')
      .lean();

    return res.json({
      success: true,
      settled: !alreadySettled,
      data: updated?.settledTransfers || [],
    });
  } catch (err) {
    console.error('[Toggle Trip Settlement Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật trạng thái quyết toán.' });
  }
};
