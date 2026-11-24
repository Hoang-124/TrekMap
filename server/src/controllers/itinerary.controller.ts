import crypto from 'crypto';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ItineraryModel } from '../models/Itinerary.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { sanitizeInput } from '../utils/validation.js';
import { isValidObjectId, resolveTrailObjectId } from '../utils/resolveTrail.js';
import { recordAuditLog } from '../utils/audit.js';

function sanitizeTimelineSteps(steps: unknown) {
  if (!Array.isArray(steps)) return [];
  return steps
    .filter((s: any) => s && typeof s === 'object')
    .slice(0, 60)
    .map((s: any, idx: number) => ({
      day: Math.max(1, Math.min(30, Math.round(Number(s.day) || 1))),
      time: sanitizeInput(String(s.time || `08:00`)).slice(0, 30),
      title: sanitizeInput(String(s.title || `Chặng ${idx + 1}`)).slice(0, 140),
      activity: sanitizeInput(String(s.activity || '')).slice(0, 200),
      description: sanitizeInput(String(s.description || '')).slice(0, 600),
      location: sanitizeInput(String(s.location || '')).slice(0, 140),
      locationNote: sanitizeInput(String(s.locationNote || '')).slice(0, 200),
      ...(Number.isFinite(Number(s.altitudeM)) ? { altitudeM: Math.round(Number(s.altitudeM)) } : {}),
    }));
}

export const createItinerary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để tạo lịch trình.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const { trailId, title, startDate, endDate, memberCount, timelineSteps } = req.body || {};

    if (!trailId || typeof title !== 'string' || !title.trim() || !startDate) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin chuyến đi.' });
    }

    const parsedStart = new Date(startDate);
    const parsedEnd = endDate ? new Date(endDate) : new Date(startDate);
    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return res.status(400).json({ success: false, message: 'Ngày khởi hành hoặc ngày kết thúc không hợp lệ.' });
    }
    if (parsedEnd < parsedStart) {
      return res.status(400).json({ success: false, message: 'Ngày kết thúc không thể trước ngày khởi hành.' });
    }

    const resolvedTrailObjId = await resolveTrailObjectId(trailId);
    if (!resolvedTrailObjId) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường tương ứng.' });
    }

    const safeMemberCount = Math.min(Math.max(Math.round(Number(memberCount) || 1), 1), 100);
    const shareToken = `lost-${crypto.randomBytes(12).toString('hex')}`;
    const safeSteps = sanitizeTimelineSteps(timelineSteps);

    const created = await ItineraryModel.create({
      creatorId: new mongoose.Types.ObjectId(userId),
      trailId: resolvedTrailObjId,
      title: sanitizeInput(title).slice(0, 180),
      startDate: parsedStart,
      endDate: parsedEnd,
      memberCount: safeMemberCount,
      timelineSteps: safeSteps,
      shareToken,
      status: 'active',
    });

    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

    return res.status(201).json({
      success: true,
      data: created,
      shareUrl: `${clientUrl}/#itinerary/${shareToken}`,
    });
  } catch (err) {
    console.error('[Create Itinerary Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tạo lịch trình.' });
  }
};

export const getItineraryByShareToken = async (req: Request, res: Response) => {
  try {
    const shareToken = String(req.params.shareToken || '').trim();
    if (!shareToken) {
      return res.status(400).json({ success: false, message: 'Thiếu mã chia sẻ lịch trình.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const itinerary = await ItineraryModel.findOne({ shareToken }).populate('trailId').lean().exec();
    if (!itinerary) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình.' });
    }

    return res.json({ success: true, data: itinerary });
  } catch (err) {
    console.error('[Get Itinerary Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi truy vấn lịch trình.' });
  }
};

export const getMyItineraries = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const list = await ItineraryModel.find({ creatorId: new mongoose.Types.ObjectId(userId) })
      .populate('trailId', 'id name province region coverImage maxAltitudeM distanceKm')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    console.error('[Get My Itineraries Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách lịch trình.' });
  }
};

export const deleteItinerary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const isAdmin = req.user?.role === 'admin';
    const rawIdentifier = String(req.params.shareToken || req.params.id || '').trim();
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!rawIdentifier || rawIdentifier.length > 100) {
      return res.status(400).json({ success: false, message: 'Mã lịch trình không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const query = /^[a-fA-F0-9]{24}$/.test(rawIdentifier)
      ? { $or: [{ _id: new mongoose.Types.ObjectId(rawIdentifier) }, { shareToken: rawIdentifier }] }
      : { shareToken: rawIdentifier };

    const doc = await ItineraryModel.findOne(query).select('_id creatorId shareToken').lean();
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình.' });
    }
    if (!isAdmin && String(doc.creatorId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa lịch trình này.' });
    }

    await ItineraryModel.deleteOne({ _id: doc._id });
    await recordAuditLog(req, 'DELETE_ITINERARY', 'itineraries', `Xóa lịch trình ${doc.shareToken || doc._id}`);
    return res.json({ success: true, message: 'Đã xóa lịch trình thành công!' });
  } catch (err) {
    console.error('[Delete Itinerary Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa lịch trình.' });
  }
};
