import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { GuideModel } from '../models/Guide.js';
import { RangerStationModel } from '../models/RangerStation.js';
import { GuideInquiryModel, GuideInquiryStatus } from '../models/GuideInquiry.js';
import { TrailModel } from '../models/Trail.js';
import { UserModel } from '../models/User.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { isValidObjectId, resolveTrailByIdOrSlug } from '../utils/resolveTrail.js';
import { sanitizeInput, validatePhoneNumber } from '../utils/validation.js';
import { containsProfanity, getProfanityMatch } from '../utils/profanityFilter.js';
import { notifyAdmins, sendNotification } from '../utils/notification.js';
import { recordAuditLog } from '../utils/audit.js';

const VALID_ROLE_TYPES = new Set(['guide', 'porter', 'operator']);
const VALID_AUTHORITY_TYPES = new Set(['national_park', 'ranger_station', 'border_guard', 'rescue_center']);
const VALID_REGIONS = new Set(['Miền Bắc', 'Miền Trung', 'Miền Nam']);
const VALID_RANGER_REGIONS = new Set(['Toàn Quốc', 'Miền Bắc', 'Miền Trung', 'Miền Nam']);
const VALID_INQUIRY_STATUSES = new Set<GuideInquiryStatus>(['pending', 'contacted', 'confirmed', 'cancelled']);
const MAX_ACTIVE_INQUIRIES_PER_USER = 10;
const INQUIRY_STATUS_LABELS: Record<GuideInquiryStatus, string> = {
  pending: 'Đang chờ xác nhận',
  contacted: 'Đã liên hệ',
  confirmed: 'Đã xác nhận lịch',
  cancelled: 'Đã hủy',
};

function parseStrictFiniteNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '' || typeof val === 'boolean') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

// GET /api/directory/guides - Rich filterable Porter/Guide & Local Operator directory
export const getDirectoryGuides = async (req: Request, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: 0, total: 0, data: [] });
    }

    const {
      region,
      province,
      trailSlug,
      roleType,
      specialty,
      language,
      minRating,
      maxPriceVnd,
      verified,
      search,
      sortBy = 'rating',
    } = req.query;

    const page = Math.min(Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1), 1000);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '24'), 10) || 24, 1), 60);
    const skip = (page - 1) * limit;

    const filter: any = { isActive: { $ne: false } };

    if (typeof region === 'string' && VALID_REGIONS.has(region)) {
      filter.region = region;
    }
    if (typeof province === 'string' && province.trim()) {
      const esc = province.trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.provinces = { $regex: new RegExp(esc, 'i') };
    }
    if (typeof trailSlug === 'string' && trailSlug.trim()) {
      filter.trailSlugs = trailSlug.trim().slice(0, 80);
    }
    if (typeof roleType === 'string' && VALID_ROLE_TYPES.has(roleType)) {
      filter.roleType = roleType;
    }
    if (typeof specialty === 'string' && specialty.trim()) {
      const esc = specialty.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.specialties = { $regex: new RegExp(esc, 'i') };
    }
    if (typeof language === 'string' && language.trim()) {
      const esc = language.trim().slice(0, 50).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.languages = { $regex: new RegExp(esc, 'i') };
    }
    const parsedMinRating = parseStrictFiniteNumber(minRating);
    if (parsedMinRating !== null) {
      filter.rating = { $gte: Math.max(0, Math.min(5, parsedMinRating)) };
    }
    const parsedMaxPrice = parseStrictFiniteNumber(maxPriceVnd);
    if (parsedMaxPrice !== null && parsedMaxPrice > 0) {
      filter.basePricePerDayVnd = { $lte: parsedMaxPrice };
    }
    if (verified === 'true') {
      filter.verified = true;
    }
    if (typeof search === 'string' && search.trim()) {
      const esc = search.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(esc, 'i');
      filter.$or = [{ name: rx }, { provinces: rx }, { specialties: rx }, { bio: rx }, { priceNote: rx }];
    }

    const sortSpec: any =
      sortBy === 'experience'
        ? { experienceYears: -1, rating: -1 }
        : sortBy === 'price_asc'
          ? { basePricePerDayVnd: 1, rating: -1 }
          : sortBy === 'price_desc'
            ? { basePricePerDayVnd: -1, rating: -1 }
            : { verified: -1, rating: -1, reviewCount: -1 };

    const [guides, total] = await Promise.all([
      GuideModel.find(filter).sort(sortSpec).skip(skip).limit(limit).lean(),
      GuideModel.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      count: guides.length,
      total,
      pagination: { total, page, limit },
      data: guides,
    });
  } catch (err) {
    console.error('[Get Directory Guides Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh bạ Porter / Hướng dẫn viên.' });
  }
};

// GET /api/directory/guides/:id - Detailed guide profile + reviews + covered real trails
export const getDirectoryGuideById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ success: false, message: 'Thiếu mã Porter/Guide.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const guide = isValidObjectId(id)
      ? await GuideModel.findById(id).lean()
      : await GuideModel.findOne({ slug: id }).lean();

    if (!guide) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ Porter/Guide.' });
    }

    const trailQuery: any = { status: 'approved' };
    if (Array.isArray(guide.trailSlugs) && guide.trailSlugs.length > 0) {
      trailQuery.id = { $in: guide.trailSlugs };
    } else if (Array.isArray(guide.provinces) && guide.provinces.length > 0) {
      trailQuery.province = { $in: guide.provinces };
    } else {
      trailQuery.region = guide.region;
    }

    const coveredTrails = await TrailModel.find(trailQuery)
      .select('id name province region maxAltitudeM distanceKm difficultyLevel coverImage')
      .limit(12)
      .lean();

    return res.json({
      success: true,
      data: {
        ...guide,
        coveredTrails,
      },
    });
  } catch (err) {
    console.error('[Get Directory Guide Detail Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải chi tiết Porter/Guide.' });
  }
};

// POST /api/directory/guides/:id/inquiries - Submit booking/hire inquiry with server-side VND estimate
export const createGuideInquiry = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const guideIdParam = String(req.params.id || '').trim();
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để gửi yêu cầu liên hệ Porter/Guide.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const guide = isValidObjectId(guideIdParam)
      ? await GuideModel.findById(guideIdParam).lean()
      : await GuideModel.findOne({ slug: guideIdParam }).lean();

    if (!guide || guide.isActive === false) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy Porter/Guide khả dụng.' });
    }

    const openInquiriesCount = await GuideInquiryModel.countDocuments({
      userId: new Types.ObjectId(userId),
      status: { $in: ['pending', 'contacted'] },
    });
    if (openInquiriesCount >= MAX_ACTIVE_INQUIRIES_PER_USER) {
      return res.status(400).json({
        success: false,
        message: `Bạn đang có ${MAX_ACTIVE_INQUIRIES_PER_USER} yêu cầu đặt Porter/Guide đang mở. Vui lòng hoàn tất hoặc hủy bớt trước khi gửi thêm.`,
      });
    }

    const {
      trailId,
      trailName,
      plannedStartDate,
      durationDays = 2,
      groupSize = 4,
      needPortersCount = 0,
      contactPhone,
      notes = '',
    } = req.body || {};

    const startDate = new Date(plannedStartDate);
    if (!plannedStartDate || Number.isNaN(startDate.getTime()) || startDate.getTime() < Date.now() - 86_400_000) {
      return res.status(400).json({ success: false, message: 'Ngày khởi hành dự kiến không hợp lệ.' });
    }

    const phoneCheck = validatePhoneNumber(String(contactPhone || ''));
    if (!phoneCheck.isValid || !phoneCheck.cleanPhone) {
      return res.status(400).json({
        success: false,
        message: phoneCheck.message || 'Vui lòng cung cấp số điện thoại liên hệ Việt Nam hợp lệ.',
      });
    }

    const safeDays = Math.min(30, Math.max(1, Math.round(Number(durationDays) || 2)));
    const safeGroupSize = Math.min(50, Math.max(1, Math.round(Number(groupSize) || 4)));
    const safePorters = Math.min(30, Math.max(0, Math.round(Number(needPortersCount) || 0)));

    let resolvedTrailId: Types.ObjectId | undefined;
    let resolvedTrailSlug = '';
    let resolvedTrailName = sanitizeInput(String(trailName || '')).slice(0, 180);

    if (typeof trailId === 'string' && trailId.trim()) {
      const trail = await resolveTrailByIdOrSlug(trailId.trim());
      if (trail && (!trail.status || trail.status === 'approved')) {
        resolvedTrailId = trail._id;
        resolvedTrailSlug = trail.id || '';
        if (!resolvedTrailName) resolvedTrailName = trail.name;
      }
    }
    if (!resolvedTrailName) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn hoặc nhập tên cung đường.' });
    }

    const safeNotes = sanitizeInput(String(notes || '')).slice(0, 800);
    if (containsProfanity(`${resolvedTrailName} ${safeNotes}`)) {
      const matched = getProfanityMatch(`${resolvedTrailName} ${safeNotes}`);
      return res.status(400).json({
        success: false,
        message: `Yêu cầu liên hệ chứa từ ngữ không phù hợp ("${matched}").`,
      });
    }

    // Server-side transparent VND calculation
    const guideDailyVnd = Number(guide.basePricePerDayVnd) || 700_000;
    const porterDailyVnd = 500_000;
    const estimatedTotalVnd = guideDailyVnd * safeDays + safePorters * porterDailyVnd * safeDays;

    const inquiry = await GuideInquiryModel.create({
      userId: new Types.ObjectId(userId),
      guideId: guide._id,
      trailId: resolvedTrailId,
      trailSlug: resolvedTrailSlug,
      trailName: resolvedTrailName,
      plannedStartDate: startDate,
      durationDays: safeDays,
      groupSize: safeGroupSize,
      needPortersCount: safePorters,
      contactPhone: phoneCheck.cleanPhone,
      notes: safeNotes,
      estimatedTotalVnd,
      status: 'pending',
    });

    const user = await UserModel.findById(userId).select('fullName avatarUrl').lean();
    notifyAdmins({
      sender: { id: userId, name: user?.fullName || 'Trekker', avatarUrl: user?.avatarUrl || '' },
      type: 'system',
      category: 'system',
      title: `Yêu cầu đặt Porter/Guide: ${guide.name}`,
      message: `${user?.fullName || 'Trekker'} đặt lịch ${guide.name} cho cung ${resolvedTrailName} (${safeDays} ngày, ${safeGroupSize} người, SĐT ${phoneCheck.cleanPhone}).`,
      link: '/admin?tab=inquiries',
      relatedId: inquiry._id.toString(),
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: `Đã gửi yêu cầu liên hệ tới "${guide.name}" thành công! Dự toán: ${estimatedTotalVnd.toLocaleString('vi-VN')}đ.`,
      data: inquiry,
    });
  } catch (err) {
    console.error('[Create Guide Inquiry Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi gửi yêu cầu liên hệ Porter/Guide.' });
  }
};

// GET /api/directory/inquiries/me - Trekker's own booking/inquiry history
export const getMyGuideInquiries = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const list = await GuideInquiryModel.find({ userId: new Types.ObjectId(userId) })
      .populate('guideId', 'name phone avatarUrl region roleType priceNote basePricePerDayVnd verified')
      .populate('trailId', 'id name province maxAltitudeM')
      .sort({ createdAt: -1 })
      .limit(40)
      .lean();

    return res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    console.error('[Get My Inquiries Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải lịch sử đặt Porter/Guide.' });
  }
};

// GET /api/directory/inquiries - Admin/Moderator view of all Guide/Porter inquiries populated with user, guide & trail
export const getAllGuideInquiriesAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: 0, total: 0, data: [] });
    }

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 200);
    const page = Math.min(Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1), 1000);
    const skip = (page - 1) * limit;
    const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim() : '';

    const filter: any = {};
    if (rawStatus && VALID_INQUIRY_STATUSES.has(rawStatus as GuideInquiryStatus)) {
      filter.status = rawStatus;
    }

    const [list, total] = await Promise.all([
      GuideInquiryModel.find(filter)
        .populate('userId', 'fullName username email avatarUrl phone')
        .populate('guideId', 'name phone avatarUrl region roleType priceNote basePricePerDayVnd verified')
        .populate('trailId', 'id name province region maxAltitudeM')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      GuideInquiryModel.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      count: list.length,
      total,
      pagination: { page, limit, total },
      data: list,
    });
  } catch (err) {
    console.error('[Get Admin Inquiries Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách yêu cầu HDV/Porter cho quản trị.' });
  }
};

// PATCH /api/directory/inquiries/:id/status - Owner can cancel; Admin/Guide can update status
export const updateGuideInquiryStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    const { id } = req.params;
    const { status } = req.body || {};

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã yêu cầu không hợp lệ.' });
    }
    if (typeof status !== 'string' || !VALID_INQUIRY_STATUSES.has(status as GuideInquiryStatus)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const inquiry = await GuideInquiryModel.findById(id);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu đặt Porter/Guide.' });
    }

    const isOwner = String(inquiry.userId) === String(userId);
    // Strict AuthZ: only Admin/Moderator may update other users' inquiries (blocks cross-guide IDOR)
    const isStaff = role === 'admin' || role === 'moderator';

    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật yêu cầu này.' });
    }
    if (isOwner && !isStaff && status !== 'cancelled') {
      return res.status(403).json({ success: false, message: 'Người đặt chỉ có thể hủy yêu cầu.' });
    }

    const prevStatus = inquiry.status;
    inquiry.status = status as GuideInquiryStatus;
    await inquiry.save();

    if (prevStatus !== inquiry.status) {
      await recordAuditLog(
        req,
        'UPDATE_GUIDE_INQUIRY_STATUS',
        'guide_inquiries',
        `Cập nhật trạng thái yêu cầu đặt Porter/Guide ${inquiry._id}: ${prevStatus} -> ${inquiry.status}`
      );

      if (isStaff && !isOwner) {
        const guideDoc = await GuideModel.findById(inquiry.guideId).select('name').lean();
        const guideName = guideDoc?.name || 'Porter/Guide';
        const statusLabel = INQUIRY_STATUS_LABELS[inquiry.status] || inquiry.status;
        sendNotification({
          recipientId: String(inquiry.userId),
          type: 'system',
          category: 'system',
          title: 'Cập nhật trạng thái yêu cầu Porter/Guide',
          message: `Yêu cầu đặt ${guideName} cho cung "${inquiry.trailName}" đã chuyển sang trạng thái: ${statusLabel}.`,
          link: '/directory',
          relatedId: inquiry._id.toString(),
        }).catch(() => {});
      }
    }

    return res.json({ success: true, message: 'Đã cập nhật trạng thái yêu cầu.', data: inquiry });
  } catch (err) {
    console.error('[Update Inquiry Status Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật trạng thái yêu cầu.' });
  }
};

// GET /api/directory/rangers - Verified Vietnam National Parks / Ranger Stations / Border Guard directory
export const getRangerStations = async (req: Request, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const { region, province, trailSlug, authorityType, permitRequired, search } = req.query;
    const filter: any = { isActive: { $ne: false } };

    if (typeof region === 'string' && VALID_RANGER_REGIONS.has(region)) {
      filter.region = region;
    }
    if (typeof province === 'string' && province.trim()) {
      const esc = province.trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.province = { $regex: new RegExp(esc, 'i') };
    }
    if (typeof trailSlug === 'string' && trailSlug.trim()) {
      filter.coveredTrailSlugs = trailSlug.trim().slice(0, 80);
    }
    if (typeof authorityType === 'string' && VALID_AUTHORITY_TYPES.has(authorityType)) {
      filter.authorityType = authorityType;
    }
    if (permitRequired === 'true') filter.permitRequired = true;
    if (permitRequired === 'false') filter.permitRequired = false;

    if (typeof search === 'string' && search.trim()) {
      const esc = search.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(esc, 'i');
      filter.$or = [{ name: rx }, { province: rx }, { district: rx }, { address: rx }, { permitFeeNote: rx }];
    }

    const stations = await RangerStationModel.find(filter)
      .sort({ region: 1, province: 1, name: 1 })
      .limit(100)
      .lean();

    return res.json({ success: true, count: stations.length, data: stations });
  } catch (err) {
    console.error('[Get Ranger Stations Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh bạ Vườn Quốc Gia & Trạm Kiểm Lâm.' });
  }
};

// GET /api/directory/cost-estimate - Transparent Vietnam Trekking Trip Cost Estimator
export const estimateTripCost = async (req: Request, res: Response) => {
  try {
    const trailId = String(req.query.trailId || '').trim();
    const groupSize = Math.min(50, Math.max(1, Math.round(Number(req.query.groupSize) || 4)));
    const needGuide = req.query.needGuide !== 'false';
    const rawPorters = req.query.portersCount;
    const parsedPorters = rawPorters !== undefined && rawPorters !== '' ? Number(rawPorters) : 1;
    const portersCount = Number.isFinite(parsedPorters) ? Math.min(30, Math.max(0, Math.round(parsedPorters))) : 1;
    const includeTransport = req.query.includeTransport !== 'false';
    const includeCampRent = req.query.includeCampRent === 'true';

    let trail: any = null;
    if (trailId) {
      trail = await resolveTrailByIdOrSlug(trailId);
    }

    const days = Math.min(
      14,
      Math.max(1, Math.round(Number(req.query.days) || Number(trail?.durationDays) || 2))
    );
    const region = trail?.region || String(req.query.region || 'Miền Bắc');
    const difficulty = Number(trail?.difficultyLevel) || 3;
    const permitRequired = Boolean(trail?.permitRequired ?? difficulty >= 3);

    // Query real regional guide rate from GuideModel when available
    let guideDailyRateVnd = region === 'Miền Bắc' ? 800_000 : region === 'Miền Trung' ? 750_000 : 700_000;
    if (mongoose.connection.readyState === 1 && trail) {
      const matchedGuide = await GuideModel.findOne({
        isActive: { $ne: false },
        $or: [
          ...(trail.id ? [{ trailSlugs: trail.id }] : []),
          { provinces: trail.province },
          { region: trail.region },
        ],
      })
        .select('basePricePerDayVnd')
        .sort({ verified: -1, rating: -1 })
        .lean();
      if (matchedGuide?.basePricePerDayVnd && matchedGuide.basePricePerDayVnd > 0) {
        guideDailyRateVnd = matchedGuide.basePricePerDayVnd;
      }
    }

    const porterDailyRateVnd = region === 'Miền Bắc' ? 550_000 : 500_000;
    const permitPerPersonVnd = permitRequired ? (difficulty >= 4 ? 120_000 : 80_000) : 0;
    const foodAndWaterPerPersonPerDayVnd = 220_000;
    const hutOrCampPerPersonPerNightVnd = days > 1 ? (includeCampRent ? 180_000 : 100_000) : 0;
    const transportPerPersonVnd = includeTransport
      ? region === 'Miền Bắc'
        ? 650_000
        : region === 'Miền Trung'
          ? 550_000
          : 420_000
      : 0;

    const guideTotalVnd = needGuide ? guideDailyRateVnd * days : 0;
    const porterTotalVnd = portersCount * porterDailyRateVnd * days;
    const permitTotalVnd = permitPerPersonVnd * groupSize;
    const foodTotalVnd = foodAndWaterPerPersonPerDayVnd * days * groupSize;
    const campTotalVnd = hutOrCampPerPersonPerNightVnd * Math.max(0, days - 1) * groupSize;
    const transportTotalVnd = transportPerPersonVnd * groupSize;

    const grandTotalVnd =
      guideTotalVnd + porterTotalVnd + permitTotalVnd + foodTotalVnd + campTotalVnd + transportTotalVnd;
    const perPersonVnd = Math.round(grandTotalVnd / groupSize);

    return res.json({
      success: true,
      data: {
        trailName: trail?.name || 'Cung trekking tùy chỉnh',
        region,
        days,
        groupSize,
        breakdown: [
          {
            key: 'permit',
            label: 'Phí VQG / Giấy phép kiểm lâm & bảo hiểm tuyến',
            totalVnd: permitTotalVnd,
            perPersonVnd: permitPerPersonVnd,
          },
          {
            key: 'guide',
            label: needGuide ? `Hướng dẫn viên bản địa (${days} ngày)` : 'Hướng dẫn viên (không chọn)',
            totalVnd: guideTotalVnd,
            perPersonVnd: Math.round(guideTotalVnd / groupSize),
          },
          {
            key: 'porter',
            label: portersCount > 0 ? `Porter gùi đồ (${portersCount} người × ${days} ngày)` : 'Porter (tự mang đồ)',
            totalVnd: porterTotalVnd,
            perPersonVnd: Math.round(porterTotalVnd / groupSize),
          },
          {
            key: 'food',
            label: `Thực phẩm, nước uống & bữa nóng trên núi (${days} ngày)`,
            totalVnd: foodTotalVnd,
            perPersonVnd: foodAndWaterPerPersonPerDayVnd * days,
          },
          {
            key: 'camp',
            label: days > 1 ? `Lán nghỉ / Thuê lều túi ngủ (${days - 1} đêm)` : 'Đi trong ngày (không qua đêm)',
            totalVnd: campTotalVnd,
            perPersonVnd: hutOrCampPerPersonPerNightVnd * Math.max(0, days - 1),
          },
          {
            key: 'transport',
            label: includeTransport ? 'Xe khách / Xe trung chuyển cửa rừng (khứ hồi)' : 'Di chuyển (tự túc)',
            totalVnd: transportTotalVnd,
            perPersonVnd: transportPerPersonVnd,
          },
        ],
        grandTotalVnd,
        totalGroupVnd: grandTotalVnd,
        perPersonVnd,
        recommendedContingencyVnd: Math.round(perPersonVnd * 0.15),
      },
    });
  } catch (err) {
    console.error('[Cost Estimate Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tính dự toán chi phí chuyến đi.' });
  }
};
