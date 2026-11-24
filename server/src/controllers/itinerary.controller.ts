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
    .map((s: any, idx: number) => {
      const rawTitle = String(s.activity || s.title || '').trim();
      const resolvedTitle = sanitizeInput(rawTitle || `Chặng ${idx + 1}`).slice(0, 180);
      const rawDesc = String(s.notes || s.description || '').trim();
      const resolvedDesc = sanitizeInput(rawDesc).slice(0, 800);
      const rawLocation = String(s.location || s.locationNote || '').trim();
      const resolvedLocation = sanitizeInput(rawLocation).slice(0, 200);
      return {
        day: Math.max(1, Math.min(30, Math.round(Number(s.day) || 1))),
        time: sanitizeInput(String(s.time || '08:00')).slice(0, 30),
        title: resolvedTitle,
        activity: resolvedTitle,
        description: resolvedDesc,
        notes: resolvedDesc,
        location: resolvedLocation,
        locationNote: resolvedLocation,
        ...(Number.isFinite(Number(s.altitudeM)) ? { altitudeM: Math.round(Number(s.altitudeM)) } : {}),
      };
    });
}

function attachTrailName<T extends Record<string, any>>(doc: T): T & { trailName?: string } {
  if (!doc || typeof doc !== 'object') return doc;
  const populatedTrail = doc.trailId && typeof doc.trailId === 'object' ? doc.trailId : null;
  const resolvedName =
    (typeof doc.trailName === 'string' && doc.trailName.trim()) ||
    (typeof populatedTrail?.name === 'string' && populatedTrail.name.trim()) ||
    '';
  return {
    ...doc,
    ...(resolvedName ? { trailName: resolvedName } : {}),
  };
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

    const { trailId, title, startDate, endDate, totalDays, memberCount, notes, timelineSteps } = req.body || {};

    if (!trailId || typeof title !== 'string' || !title.trim() || !startDate) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin chuyến đi.' });
    }

    const parsedStart = new Date(startDate);
    if (isNaN(parsedStart.getTime())) {
      return res.status(400).json({ success: false, message: 'Ngày khởi hành không hợp lệ.' });
    }

    const safeSteps = sanitizeTimelineSteps(timelineSteps);
    const inferredDays = safeSteps.reduce((maxD, st) => Math.max(maxD, st.day || 1), 1);
    const parsedTotalDays =
      Number.isFinite(Number(totalDays)) && Number(totalDays) >= 1
        ? Math.min(30, Math.round(Number(totalDays)))
        : inferredDays;

    const parsedEnd = endDate
      ? new Date(endDate)
      : new Date(parsedStart.getTime() + Math.max(0, parsedTotalDays - 1) * 86_400_000);
    if (isNaN(parsedEnd.getTime())) {
      return res.status(400).json({ success: false, message: 'Ngày kết thúc không hợp lệ.' });
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
    const safeNotes = typeof notes === 'string' ? sanitizeInput(notes).slice(0, 1000) : '';

    const created = await ItineraryModel.create({
      creatorId: new mongoose.Types.ObjectId(userId),
      trailId: resolvedTrailObjId,
      title: sanitizeInput(title).slice(0, 180),
      startDate: parsedStart,
      endDate: parsedEnd,
      totalDays: parsedTotalDays,
      memberCount: safeMemberCount,
      notes: safeNotes,
      timelineSteps: safeSteps,
      shareToken,
      status: 'active',
    });

    const populatedCreated = await ItineraryModel.findById(created._id)
      .populate('trailId', 'id name province region coverImage maxAltitudeM distanceKm')
      .lean();

    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

    return res.status(201).json({
      success: true,
      data: populatedCreated ? attachTrailName(populatedCreated) : created,
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

    return res.json({ success: true, data: attachTrailName(itinerary) });
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
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(50)
      .lean();

    const formatted = list.map((item) => attachTrailName(item));
    return res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    console.error('[Get My Itineraries Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách lịch trình.' });
  }
};

export const updateItinerary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const isAdmin = req.user?.role === 'admin';
    const rawIdentifier = String(req.params.shareToken || req.params.id || '').trim();

    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để chỉnh sửa lịch trình.' });
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

    const existing = await ItineraryModel.findOne(query).lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình.' });
    }
    if (!isAdmin && String(existing.creatorId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa lịch trình này.' });
    }

    const { title, startDate, endDate, totalDays, memberCount, timelineSteps, notes } = req.body || {};
    const updateFields: Record<string, unknown> = {};

    if (typeof title === 'string' && title.trim()) {
      updateFields.title = sanitizeInput(title).slice(0, 180);
    }

    let nextStart = existing.startDate ? new Date(existing.startDate) : new Date();
    if (startDate !== undefined) {
      const parsedStart = new Date(startDate);
      if (isNaN(parsedStart.getTime())) {
        return res.status(400).json({ success: false, message: 'Ngày khởi hành không hợp lệ.' });
      }
      nextStart = parsedStart;
      updateFields.startDate = parsedStart;
    }

    let nextSteps = existing.timelineSteps;
    if (timelineSteps !== undefined) {
      if (!Array.isArray(timelineSteps)) {
        return res.status(400).json({ success: false, message: 'Danh sách chặng hành trình không hợp lệ.' });
      }
      nextSteps = sanitizeTimelineSteps(timelineSteps);
      updateFields.timelineSteps = nextSteps;
    }

    let nextTotalDays = existing.totalDays;
    if (totalDays !== undefined) {
      const numDays = Math.round(Number(totalDays));
      if (!Number.isFinite(numDays) || numDays < 1 || numDays > 30) {
        return res.status(400).json({ success: false, message: 'Số ngày hành trình phải từ 1 đến 30.' });
      }
      nextTotalDays = numDays;
      updateFields.totalDays = numDays;
    } else if (timelineSteps !== undefined && Array.isArray(nextSteps) && nextSteps.length > 0) {
      nextTotalDays = nextSteps.reduce((maxD, st) => Math.max(maxD, Number(st.day) || 1), 1);
      updateFields.totalDays = nextTotalDays;
    }

    if (endDate !== undefined) {
      const parsedEnd = new Date(endDate);
      if (isNaN(parsedEnd.getTime())) {
        return res.status(400).json({ success: false, message: 'Ngày kết thúc không hợp lệ.' });
      }
      if (parsedEnd < nextStart) {
        return res.status(400).json({ success: false, message: 'Ngày kết thúc không thể trước ngày khởi hành.' });
      }
      updateFields.endDate = parsedEnd;
    } else if (startDate !== undefined || totalDays !== undefined || timelineSteps !== undefined) {
      const daysSpan = Math.max(1, Number(nextTotalDays) || 1);
      updateFields.endDate = new Date(nextStart.getTime() + (daysSpan - 1) * 86_400_000);
    }

    if (memberCount !== undefined) {
      const safeMembers = Math.min(Math.max(Math.round(Number(memberCount) || 1), 1), 100);
      updateFields.memberCount = safeMembers;
    }

    if (notes !== undefined) {
      updateFields.notes = typeof notes === 'string' ? sanitizeInput(notes).slice(0, 1000) : '';
    }

    const updated = await ItineraryModel.findByIdAndUpdate(
      existing._id,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .populate('trailId', 'id name province region coverImage maxAltitudeM distanceKm')
      .lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình.' });
    }

    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    return res.json({
      success: true,
      message: 'Đã cập nhật lịch trình thành công!',
      data: attachTrailName(updated),
      shareUrl: `${clientUrl}/#itinerary/${updated.shareToken}`,
    });
  } catch (err) {
    console.error('[Update Itinerary Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật lịch trình.' });
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
