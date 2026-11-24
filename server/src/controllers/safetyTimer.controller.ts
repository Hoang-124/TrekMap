import { Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { SafetyTimerModel } from '../models/SafetyTimer.js';
import { UserModel } from '../models/User.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { resolveTrailByIdOrSlug, isValidObjectId } from '../utils/resolveTrail.js';
import { sanitizeInput } from '../utils/validation.js';
import { sendSafetyOverdueAlertEmail, sendSafetyAllClearEmail } from '../utils/mailer.js';
import { sendNotification, notifyAdmins } from '../utils/notification.js';
import { emitToUser } from '../config/socket.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/safety-timers/me - Get user's active & recent safety timers
export const getMySafetyTimers = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, data: [] });
    }
    const timers = await SafetyTimerModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();
    return res.json({ success: true, count: timers.length, data: timers });
  } catch (err) {
    console.error('[Get Safety Timers Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải lịch báo bình an.' });
  }
};

// POST /api/safety-timers - Create a new Dead-Man's Switch safety check-in timer
export const createSafetyTimer = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để đặt lịch báo bình an.' });
    }

    const {
      trailId,
      trailName,
      expectedReturnAt,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactEmail = '',
      lastKnownLat,
      lastKnownLng,
      notes = '',
    } = req.body || {};

    if (!expectedReturnAt) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn thời điểm dự kiến ra khỏi rừng.' });
    }

    const returnDate = new Date(expectedReturnAt);
    if (Number.isNaN(returnDate.getTime()) || returnDate.getTime() <= Date.now() + 60_000) {
      return res.status(400).json({
        success: false,
        message: 'Thời điểm dự kiến ra khỏi rừng phải lớn hơn thời điểm hiện tại ít nhất 1 phút.',
      });
    }
    if (returnDate.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        message: 'Thời hạn hẹn báo bình an tối đa là 30 ngày.',
      });
    }

    const safeContactName = sanitizeInput(String(emergencyContactName || '')).trim();
    const safeContactPhone = sanitizeInput(String(emergencyContactPhone || '')).trim();
    const safeContactEmail = String(emergencyContactEmail || '').trim().toLowerCase();

    if (!safeContactName || !safeContactPhone) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ Tên và Số điện thoại người thân nhận cảnh báo.',
      });
    }
    if (safeContactEmail && !EMAIL_REGEX.test(safeContactEmail)) {
      return res.status(400).json({ success: false, message: 'Email người thân không đúng định dạng.' });
    }

    let resolvedLat: number | undefined;
    let resolvedLng: number | undefined;
    if (lastKnownLat !== undefined && lastKnownLng !== undefined) {
      const nLat = Number(lastKnownLat);
      const nLng = Number(lastKnownLng);
      if (!Number.isFinite(nLat) || !Number.isFinite(nLng) || nLat < -90 || nLat > 90 || nLng < -180 || nLng > 180) {
        return res.status(400).json({ success: false, message: 'Tọa độ GPS không hợp lệ.' });
      }
      resolvedLat = nLat;
      resolvedLng = nLng;
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    let resolvedTrailId: Types.ObjectId | undefined;
    let resolvedTrailSlug = '';
    let resolvedTrailName = sanitizeInput(String(trailName || '')).trim();
    if (trailId && typeof trailId === 'string') {
      const trail = await resolveTrailByIdOrSlug(trailId);
      if (trail) {
        resolvedTrailId = trail._id;
        resolvedTrailSlug = trail.id || '';
        if (!resolvedTrailName) resolvedTrailName = trail.name;
        if (resolvedLat === undefined && resolvedLng === undefined) {
          resolvedLat = trail.startLat;
          resolvedLng = trail.startLng;
        }
      }
    }
    if (!resolvedTrailName) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn hoặc nhập tên cung đường.' });
    }

    const uid = new Types.ObjectId(userId);
    await SafetyTimerModel.updateMany({ userId: uid, status: 'active' }, { $set: { status: 'cancelled' } });

    const timer = await SafetyTimerModel.create({
      userId: uid,
      trailId: resolvedTrailId,
      trailSlug: resolvedTrailSlug,
      trailName: resolvedTrailName.slice(0, 180),
      expectedReturnAt: returnDate,
      emergencyContactName: safeContactName.slice(0, 120),
      emergencyContactPhone: safeContactPhone.slice(0, 40),
      emergencyContactEmail: safeContactEmail.slice(0, 160),
      lastKnownLat: resolvedLat,
      lastKnownLng: resolvedLng,
      notes: sanitizeInput(String(notes || '')).slice(0, 500),
      status: 'active',
    });

    return res.status(201).json({
      success: true,
      message: 'Đã kích hoạt Hẹn Giờ Báo Bình An! Nhớ bấm "Tôi Đã An Toàn" sau khi ra khỏi rừng.',
      data: timer,
    });
  } catch (err) {
    console.error('[Create Safety Timer Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi kích hoạt lịch báo bình an.' });
  }
};

// PUT /api/safety-timers/:id/safe - Mark trekker safe & disarm Dead-Man's Switch (sends All-Clear email if previously alerted!)
export const markSafetyTimerSafe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã lịch hẹn không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const uid = new Types.ObjectId(userId);
    const existing = await SafetyTimerModel.findOne({ _id: id, userId: uid }).lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn an toàn của bạn.' });
    }
    if (existing.status !== 'active' && existing.status !== 'overdue_alerted') {
      return res.status(400).json({
        success: false,
        message: 'Lịch hẹn này đã kết thúc hoặc bị hủy trước đó.',
      });
    }

    const wasOverdueAlerted = existing.status === 'overdue_alerted';
    const safeAt = new Date();
    const timer = await SafetyTimerModel.findOneAndUpdate(
      { _id: id, userId: uid, status: { $in: ['active', 'overdue_alerted'] } },
      { $set: { status: 'checked_in_safe', checkedInSafeAt: safeAt } },
      { new: true }
    );

    if (!timer) {
      return res.status(409).json({ success: false, message: 'Trạng thái lịch hẹn đã thay đổi.' });
    }

    // If an overdue emergency alert email was already dispatched, notify emergency contact that trekker is now SAFE
    if (wasOverdueAlerted && timer.emergencyContactEmail) {
      const user = await UserModel.findById(uid).select('fullName username').lean().catch(() => null);
      sendSafetyAllClearEmail({
        toEmail: timer.emergencyContactEmail,
        contactName: timer.emergencyContactName,
        trekkerName: user?.fullName || user?.username || 'Thành viên LOST',
        trailName: timer.trailName,
        checkedInSafeAt: safeAt,
      }).catch((err) => console.warn('[Safety All-Clear Email Error]:', err));
    }

    return res.json({
      success: true,
      message: wasOverdueAlerted
        ? 'Chúc mừng bạn đã ra khỏi rừng an toàn! Hệ thống đã gửi thông báo bình an tới người thân.'
        : 'Chúc mừng bạn đã ra khỏi rừng an toàn! Đã tắt bộ đếm cảnh báo khẩn cấp.',
      data: timer,
    });
  } catch (err) {
    console.error('[Mark Safety Safe Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xác nhận an toàn.' });
  }
};

// PUT /api/safety-timers/:id/cancel - Cancel strictly active timer
export const cancelSafetyTimer = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã lịch hẹn không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const uid = new Types.ObjectId(userId);
    const existing = await SafetyTimerModel.findOne({ _id: id, userId: uid }).select('status').lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn an toàn.' });
    }
    if (existing.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể hủy lịch hẹn đang ở trạng thái hoạt động.',
      });
    }

    const timer = await SafetyTimerModel.findOneAndUpdate(
      { _id: id, userId: uid, status: 'active' },
      { $set: { status: 'cancelled' } },
      { new: true }
    );

    return res.json({ success: true, message: 'Đã hủy lịch hẹn báo bình an.', data: timer });
  } catch (err) {
    console.error('[Cancel Safety Timer Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi hủy lịch hẹn.' });
  }
};

// PATCH /api/safety-timers/:id/extend - Extend an active timer's expectedReturnAt (owner-only)
export const extendSafetyTimer = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã lịch hẹn không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const uid = new Types.ObjectId(userId);
    const existing = await SafetyTimerModel.findOne({ _id: id, userId: uid }).lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn an toàn.' });
    }
    if (existing.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể gia hạn lịch hẹn đang ở trạng thái hoạt động.',
      });
    }

    const { extendMinutes, expectedReturnAt } = req.body || {};
    const nowMs = Date.now();
    const maxAllowedMs = nowMs + 30 * 24 * 60 * 60 * 1000;
    const baseMs = Math.max(nowMs, new Date(existing.expectedReturnAt).getTime());

    let nextReturnDate: Date;
    if (extendMinutes !== undefined && extendMinutes !== null && extendMinutes !== '') {
      const mins = Number(extendMinutes);
      if (!Number.isFinite(mins) || mins < 30 || mins > 1440) {
        return res.status(400).json({
          success: false,
          message: 'Thời lượng gia hạn phải từ 30 đến 1440 phút (30 phút đến 24 giờ).',
        });
      }
      nextReturnDate = new Date(baseMs + Math.round(mins) * 60 * 1000);
    } else if (typeof expectedReturnAt === 'string' && expectedReturnAt.trim()) {
      const parsed = new Date(expectedReturnAt.trim());
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ success: false, message: 'Thời điểm dự kiến trở về không hợp lệ.' });
      }
      if (parsed.getTime() <= baseMs + 60 * 1000) {
        return res.status(400).json({
          success: false,
          message: 'Thời điểm gia hạn phải muộn hơn lịch hẹn hiện tại ít nhất 1 phút.',
        });
      }
      nextReturnDate = parsed;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp số phút gia hạn (extendMinutes) hoặc thời điểm mới (expectedReturnAt).',
      });
    }

    if (nextReturnDate.getTime() > maxAllowedMs) {
      return res.status(400).json({
        success: false,
        message: 'Thời điểm dự kiến trở về sau gia hạn không được vượt quá 30 ngày tính từ hiện tại.',
      });
    }

    const updated = await SafetyTimerModel.findOneAndUpdate(
      { _id: id, userId: uid, status: 'active' },
      { $set: { expectedReturnAt: nextReturnDate } },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: 'Lịch hẹn đã chuyển trạng thái trước khi gia hạn.',
      });
    }

    return res.json({
      success: true,
      message: 'Đã gia hạn lịch hẹn báo bình an thành công!',
      data: updated,
    });
  } catch (err) {
    console.error('[Extend Safety Timer Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi gia hạn lịch hẹn.' });
  }
};

// GET /api/safety-timers/admin - Active & overdue safety timers monitor for Admin/Moderator Dashboard
export const getAdminSafetyTimers = async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: 0, overdueCount: 0, activeCount: 0, data: [] });
    }

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 200);
    const statusFilter =
      typeof req.query.status === 'string' && ['active', 'overdue_alerted', 'checked_in_safe', 'cancelled'].includes(req.query.status)
        ? req.query.status
        : null;

    const query: Record<string, any> = statusFilter
      ? { status: statusFilter }
      : { status: { $in: ['overdue_alerted', 'active'] } };

    const timers = await SafetyTimerModel.find(query)
      .populate('userId', 'fullName username email avatarUrl phone role')
      .sort({ status: -1, expectedReturnAt: 1 })
      .limit(limit)
      .lean();

    // Sort overdue_alerted strictly ahead of active, then earliest expectedReturnAt first
    const statusPriority: Record<string, number> = {
      overdue_alerted: 0,
      active: 1,
      checked_in_safe: 2,
      cancelled: 3,
    };
    timers.sort((a: any, b: any) => {
      const pa = statusPriority[a.status] ?? 9;
      const pb = statusPriority[b.status] ?? 9;
      if (pa !== pb) return pa - pb;
      return new Date(a.expectedReturnAt).getTime() - new Date(b.expectedReturnAt).getTime();
    });

    const overdueCount = timers.filter((t: any) => t.status === 'overdue_alerted').length;
    const activeCount = timers.filter((t: any) => t.status === 'active').length;

    return res.json({
      success: true,
      count: timers.length,
      overdueCount,
      activeCount,
      data: timers,
    });
  } catch (err) {
    console.error('[Get Admin Safety Timers Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách hẹn giờ an toàn quản trị.' });
  }
};

/**
 * Background sweeper: atomically claims overdue active safety timers one-by-one via findOneAndUpdate
 * so concurrent instances/ticks NEVER send duplicate emergency emails. Processes up to 100 per sweep.
 */
export async function processOverdueSafetyTimers(): Promise<number> {
  if (mongoose.connection.readyState !== 1) return 0;

  let alertedCount = 0;
  const maxPerSweep = 100;

  for (let i = 0; i < maxPerSweep; i++) {
    const now = new Date();
    const timer = await SafetyTimerModel.findOneAndUpdate(
      { status: 'active', expectedReturnAt: { $lte: now } },
      { $set: { status: 'overdue_alerted', alertedAt: now } },
      { new: true }
    );
    if (!timer) break;

    alertedCount++;

    const user = await UserModel.findById(timer.userId).select('fullName username email').lean().catch(() => null);
    const trekkerName = user?.fullName || user?.username || 'Thành viên LOST';

    if (timer.emergencyContactEmail) {
      await sendSafetyOverdueAlertEmail({
        toEmail: timer.emergencyContactEmail,
        contactName: timer.emergencyContactName,
        trekkerName,
        trailName: timer.trailName,
        expectedReturnAt: timer.expectedReturnAt,
        lastKnownLat: timer.lastKnownLat,
        lastKnownLng: timer.lastKnownLng,
        notes: timer.notes,
      });
    }

    emitToUser(timer.userId.toString(), 'safetyTimerOverdue', {
      timerId: timer._id.toString(),
      trailName: timer.trailName,
      alertedAt: timer.alertedAt,
    });

    // Persist in-app safety notification for the user and notify safety moderators/admins
    await sendNotification({
      recipientId: timer.userId.toString(),
      type: 'safety_alert',
      category: 'safety',
      title: `Quá hạn báo bình an: ${timer.trailName}`,
      message: `Hẹn giờ báo bình an của bạn trên cung ${timer.trailName} đã quá hạn. Nếu đã an toàn, hãy mở mục An Toàn và bấm "Tôi Đã An Toàn" ngay!`,
      link: '/safety',
      relatedId: timer._id.toString(),
    });

    await notifyAdmins({
      type: 'safety_alert',
      category: 'safety',
      title: `Quá hạn Hẹn Giờ An Toàn: ${trekkerName}`,
      message: `Trekker ${trekkerName} quá hạn báo bình an tại ${timer.trailName}. Liên hệ khẩn cấp: ${timer.emergencyContactName} (${timer.emergencyContactPhone}).`,
      link: '/admin?tab=safety',
      relatedId: timer._id.toString(),
      includeModerators: true,
    });
  }

  return alertedCount;
}
