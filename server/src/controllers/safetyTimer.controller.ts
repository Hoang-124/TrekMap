import { Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { SafetyTimerModel, type ISafetyTimer } from '../models/SafetyTimer.js';
import { UserModel } from '../models/User.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { resolveTrailByIdOrSlug, isValidObjectId } from '../utils/resolveTrail.js';
import { sanitizeInput } from '../utils/validation.js';
import { sendSafetyOverdueAlertEmail, sendSafetyAllClearEmail } from '../utils/mailer.js';
import { sendNotification, notifyAdmins } from '../utils/notification.js';
import { recordAuditLog } from '../utils/audit.js';
import { emitToUser } from '../config/socket.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_RETRIES = 5;
const EMAIL_RETRY_BACKOFF_MINUTES = [2, 5, 10, 20, 40];
const EMAIL_CLAIM_LEASE_MS = 2 * 60 * 1000;
const MAX_TIMER_NOTES_LEN = 500;

function appendAuditNote(existingNotes: string | undefined, stamp: string): string {
  const cleanStamp = stamp.trim().slice(0, MAX_TIMER_NOTES_LEN);
  const base = (existingNotes || '').trim();
  if (!base) return cleanStamp;
  const combined = `${base}\n${cleanStamp}`;
  if (combined.length <= MAX_TIMER_NOTES_LEN) return combined;
  const keepLen = Math.max(0, MAX_TIMER_NOTES_LEN - cleanStamp.length - 4);
  return keepLen > 0 ? `${base.slice(0, keepLen).trim()}...\n${cleanStamp}` : cleanStamp;
}

function getRetryBackoffMs(retryCount: number): number {
  const idx = Math.max(0, Math.min(EMAIL_RETRY_BACKOFF_MINUTES.length - 1, retryCount - 1));
  return EMAIL_RETRY_BACKOFF_MINUTES[idx] * 60 * 1000;
}

function parseOptionalCoord(val: unknown): number | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'number') return Number.isFinite(val) ? val : NaN;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

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
    const parsedLat = parseOptionalCoord(lastKnownLat);
    const parsedLng = parseOptionalCoord(lastKnownLng);
    if (parsedLat !== undefined || parsedLng !== undefined) {
      if (
        parsedLat === undefined ||
        parsedLng === undefined ||
        !Number.isFinite(parsedLat) ||
        !Number.isFinite(parsedLng) ||
        parsedLat < -90 ||
        parsedLat > 90 ||
        parsedLng < -180 ||
        parsedLng > 180 ||
        (parsedLat === 0 && parsedLng === 0)
      ) {
        return res.status(400).json({ success: false, message: 'Tọa độ GPS không hợp lệ.' });
      }
      resolvedLat = parsedLat;
      resolvedLng = parsedLng;
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
    // Create replacement timer FIRST so if creation fails, the trekker's existing active timer stays armed!
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
      emailAlertStatus: safeContactEmail ? 'pending' : 'none',
      emailRetryCount: 0,
    });

    await SafetyTimerModel.updateMany(
      { userId: uid, status: 'active', _id: { $ne: timer._id } },
      { $set: { status: 'cancelled' } }
    );

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
    const overdueEmailWasSent = existing.emailAlertStatus === 'sent' || existing.emailAlertStatus === undefined;
    const safeAt = new Date();
    const timer = await SafetyTimerModel.findOneAndUpdate(
      { _id: id, userId: uid, status: { $in: ['active', 'overdue_alerted'] } },
      {
        $set: {
          status: 'checked_in_safe',
          checkedInSafeAt: safeAt,
          emailNextRetryAt: null,
          emailClaimedAt: null,
          ...(existing.emailAlertStatus === 'pending' ? { emailAlertStatus: 'none' } : {}),
        },
      },
      { new: true }
    );

    if (!timer) {
      return res.status(409).json({ success: false, message: 'Trạng thái lịch hẹn đã thay đổi.' });
    }

    // If an overdue emergency alert email was actually delivered, notify emergency contact that trekker is now SAFE
    if (wasOverdueAlerted && overdueEmailWasSent && timer.emergencyContactEmail) {
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
      const mins = typeof extendMinutes === 'boolean' ? NaN : Number(extendMinutes);
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

// PATCH /api/safety-timers/admin/:id/mark-safe - Admin/Moderator SAR resolution marking timer safe
export const adminMarkSafetyTimerSafe = async (req: AuthRequest, res: Response) => {
  try {
    const actorId = req.user?.userId;
    const { id } = req.params;
    if (!actorId || !Types.ObjectId.isValid(actorId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã lịch hẹn không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const existing = await SafetyTimerModel.findById(id).lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn báo bình an.' });
    }
    if (existing.status !== 'active' && existing.status !== 'overdue_alerted') {
      return res.status(400).json({
        success: false,
        message: 'Lịch hẹn này đã kết thúc hoặc bị hủy trước đó.',
      });
    }

    const [actorUser, targetUser] = await Promise.all([
      UserModel.findById(actorId).select('fullName username role').lean().catch(() => null),
      UserModel.findById(existing.userId).select('fullName username').lean().catch(() => null),
    ]);
    const actorLabel = actorUser?.fullName || actorUser?.username || req.user?.email || 'Điều phối viên';
    const trekkerName = targetUser?.fullName || targetUser?.username || 'Thành viên LOST';

    const rawReason = sanitizeInput(String(req.body?.reason || req.body?.note || '')).trim().slice(0, 180);
    const safeAt = new Date();
    const auditStamp = `[SAR ${actorLabel} xác nhận an toàn (${safeAt.toISOString()})${rawReason ? `: ${rawReason}` : ''}]`;
    const nextNotes = appendAuditNote(existing.notes, auditStamp);

    const wasOverdueAlerted = existing.status === 'overdue_alerted';
    const overdueEmailWasSent = existing.emailAlertStatus === 'sent' || existing.emailAlertStatus === undefined;

    const timer = await SafetyTimerModel.findOneAndUpdate(
      { _id: id, status: { $in: ['active', 'overdue_alerted'] } },
      {
        $set: {
          status: 'checked_in_safe',
          checkedInSafeAt: safeAt,
          notes: nextNotes,
          emailNextRetryAt: null,
          emailClaimedAt: null,
          ...(existing.emailAlertStatus === 'pending' ? { emailAlertStatus: 'none' } : {}),
        },
      },
      { new: true }
    );

    if (!timer) {
      return res.status(409).json({ success: false, message: 'Trạng thái lịch hẹn đã thay đổi.' });
    }

    await recordAuditLog(
      req,
      'ADMIN_MARK_TIMER_SAFE',
      'SafetyTimer',
      `Xác nhận an toàn lịch hẹn #${timer._id} của ${trekkerName} trên cung ${timer.trailName} (trạng thái cũ: ${existing.status})${rawReason ? ` — Ghi chú: ${rawReason}` : ''}`
    );

    if (wasOverdueAlerted && overdueEmailWasSent && timer.emergencyContactEmail) {
      sendSafetyAllClearEmail({
        toEmail: timer.emergencyContactEmail,
        contactName: timer.emergencyContactName,
        trekkerName,
        trailName: timer.trailName,
        checkedInSafeAt: safeAt,
      }).catch((err) => console.warn('[Admin Safety All-Clear Email Error]:', err));
    }

    emitToUser(timer.userId.toString(), 'safetyTimerUpdated', {
      timerId: timer._id.toString(),
      status: timer.status,
      checkedInSafeAt: safeAt.toISOString(),
      trailName: timer.trailName,
    });

    await sendNotification({
      recipientId: timer.userId.toString(),
      type: 'safety_alert',
      category: 'safety',
      title: `Đã xác nhận an toàn: ${timer.trailName}`,
      message: `Đội điều phối an toàn LOST đã đánh dấu lịch hẹn báo bình an của bạn trên cung ${timer.trailName} ở trạng thái đã an toàn.${rawReason ? ` Ghi chú: ${rawReason}` : ''}`,
      link: '/safety',
      relatedId: timer._id.toString(),
    }).catch((err) => console.warn('[Admin Mark Safe Notification Error]:', (err as Error).message));

    return res.json({
      success: true,
      message: 'Đã đánh dấu lịch hẹn báo bình an ở trạng thái an toàn.',
      data: timer,
    });
  } catch (err) {
    console.error('[Admin Mark Safety Timer Safe Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xác nhận an toàn lịch hẹn.' });
  }
};

// PATCH /api/safety-timers/admin/:id/extend - Admin/Moderator SAR extension (30..720 mins, default 120)
export const adminExtendSafetyTimer = async (req: AuthRequest, res: Response) => {
  try {
    const actorId = req.user?.userId;
    const { id } = req.params;
    if (!actorId || !Types.ObjectId.isValid(actorId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã lịch hẹn không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const existing = await SafetyTimerModel.findById(id).lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn báo bình an.' });
    }
    if (existing.status !== 'active' && existing.status !== 'overdue_alerted') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể gia hạn lịch hẹn đang hoạt động hoặc quá hạn.',
      });
    }

    const rawExtend = req.body?.extendMinutes;
    let extendMinutes = 120;
    if (rawExtend !== undefined && rawExtend !== null && rawExtend !== '') {
      const parsed = typeof rawExtend === 'boolean' ? NaN : Number(rawExtend);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({ success: false, message: 'Số phút gia hạn không hợp lệ.' });
      }
      extendMinutes = Math.min(720, Math.max(30, Math.round(parsed)));
    }

    const nowMs = Date.now();
    const baseMs = Math.max(nowMs, new Date(existing.expectedReturnAt).getTime());
    const nextReturnDate = new Date(baseMs + extendMinutes * 60 * 1000);
    const maxAllowedMs = nowMs + 30 * 24 * 60 * 60 * 1000;
    if (nextReturnDate.getTime() > maxAllowedMs) {
      return res.status(400).json({
        success: false,
        message: 'Thời điểm dự kiến trở về sau gia hạn không được vượt quá 30 ngày tính từ hiện tại.',
      });
    }

    const [actorUser, targetUser] = await Promise.all([
      UserModel.findById(actorId).select('fullName username role').lean().catch(() => null),
      UserModel.findById(existing.userId).select('fullName username').lean().catch(() => null),
    ]);
    const actorLabel = actorUser?.fullName || actorUser?.username || req.user?.email || 'Điều phối viên';
    const trekkerName = targetUser?.fullName || targetUser?.username || 'Thành viên LOST';

    const rawReason = sanitizeInput(String(req.body?.reason || req.body?.note || '')).trim().slice(0, 180);
    const auditStamp = `[SAR ${actorLabel} gia hạn +${extendMinutes} phút tới ${nextReturnDate.toISOString()}${rawReason ? `: ${rawReason}` : ''}]`;
    const nextNotes = appendAuditNote(existing.notes, auditStamp);

    const resetFromOverdue = existing.status === 'overdue_alerted' && nextReturnDate.getTime() > nowMs;
    const setFields: Record<string, unknown> = {
      expectedReturnAt: nextReturnDate,
      notes: nextNotes,
    };
    if (resetFromOverdue) {
      setFields.status = 'active';
      setFields.emailClaimedAt = null;
      setFields.emailNextRetryAt = null;
      if (existing.emergencyContactEmail) {
        setFields.emailAlertStatus = 'pending';
      }
    }

    const updated = await SafetyTimerModel.findOneAndUpdate(
      { _id: id, status: { $in: ['active', 'overdue_alerted'] } },
      { $set: setFields },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: 'Lịch hẹn đã chuyển trạng thái trước khi gia hạn.',
      });
    }

    await recordAuditLog(
      req,
      'ADMIN_EXTEND_SAFETY_TIMER',
      'SafetyTimer',
      `Gia hạn +${extendMinutes} phút cho lịch hẹn #${updated._id} của ${trekkerName} trên cung ${updated.trailName} (hạn mới: ${nextReturnDate.toISOString()}${resetFromOverdue ? ', khôi phục từ quá hạn về đang theo dõi' : ''})${rawReason ? ` — Ghi chú: ${rawReason}` : ''}`
    );

    emitToUser(updated.userId.toString(), 'safetyTimerUpdated', {
      timerId: updated._id.toString(),
      status: updated.status,
      expectedReturnAt: nextReturnDate.toISOString(),
      trailName: updated.trailName,
    });

    await sendNotification({
      recipientId: updated.userId.toString(),
      type: 'safety_alert',
      category: 'safety',
      title: `Đã gia hạn hẹn giờ báo bình an (+${extendMinutes} phút)`,
      message: `Đội điều phối an toàn LOST đã gia hạn lịch hẹn của bạn trên cung ${updated.trailName} thêm ${extendMinutes} phút.${rawReason ? ` Ghi chú: ${rawReason}` : ''}`,
      link: '/safety',
      relatedId: updated._id.toString(),
    }).catch((err) => console.warn('[Admin Extend Timer Notification Error]:', (err as Error).message));

    return res.json({
      success: true,
      message: `Đã gia hạn lịch hẹn báo bình an thêm ${extendMinutes} phút.`,
      data: updated,
    });
  } catch (err) {
    console.error('[Admin Extend Safety Timer Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi gia hạn lịch hẹn.' });
  }
};

async function deliverOverdueEmailWithTracking(timer: ISafetyTimer, trekkerName: string): Promise<boolean> {
  if (!timer.emergencyContactEmail) {
    await SafetyTimerModel.updateOne(
      { _id: timer._id },
      { $set: { emailAlertStatus: 'none', emailNextRetryAt: null, emailClaimedAt: null } }
    );
    return false;
  }

  const mailResult = await sendSafetyOverdueAlertEmail({
    toEmail: timer.emergencyContactEmail,
    contactName: timer.emergencyContactName,
    trekkerName,
    trailName: timer.trailName,
    expectedReturnAt: timer.expectedReturnAt,
    lastKnownLat: timer.lastKnownLat,
    lastKnownLng: timer.lastKnownLng,
    notes: timer.notes,
  });

  if (mailResult.success) {
    await SafetyTimerModel.updateOne(
      { _id: timer._id },
      {
        $set: {
          emailAlertStatus: 'sent',
          emailAlertSentAt: new Date(),
          emailLastError: '',
          emailNextRetryAt: null,
          emailClaimedAt: null,
        },
      }
    );
    return true;
  }

  const nextRetryCount = (timer.emailRetryCount || 0) + 1;
  const exhausted = nextRetryCount >= MAX_EMAIL_RETRIES;
  const errMsg = String((mailResult as { error?: { message?: string } })?.error?.message || 'SMTP delivery failed').slice(0, 300);

  await SafetyTimerModel.updateOne(
    { _id: timer._id },
    {
      $set: {
        emailAlertStatus: exhausted ? 'failed' : 'pending',
        emailRetryCount: nextRetryCount,
        emailLastError: errMsg,
        emailNextRetryAt: exhausted ? null : new Date(Date.now() + getRetryBackoffMs(nextRetryCount)),
        emailClaimedAt: null,
      },
    }
  );

  if (exhausted) {
    await notifyAdmins({
      type: 'safety_alert',
      category: 'safety',
      title: `KHẨN: Gửi email cứu hộ thất bại sau ${MAX_EMAIL_RETRIES} lần (${trekkerName})`,
      message: `Không thể gửi email cảnh báo quá hạn tới ${timer.emergencyContactEmail} cho trekker ${trekkerName} tại ${timer.trailName}. Vui lòng gọi trực tiếp người thân: ${timer.emergencyContactName} (${timer.emergencyContactPhone}).`,
      link: '/admin?tab=safety',
      relatedId: timer._id.toString(),
      includeModerators: true,
    }).catch(() => {});
  }

  return false;
}

/**
 * Durable Life-Safety Background Sweeper:
 * - Phase A: Atomically claims newly overdue `active` timers one-by-one via findOneAndUpdate,
 *   sends real-time + admin notifications, and attempts emergency email delivery with persistent status tracking.
 * - Phase B: Retries overdue timers whose `emailAlertStatus === 'pending'` up to 5 times with exponential backoff
 *   and a 2-minute advisory lease so multi-instance deployments never drop OR duplicate SOS rescue emails.
 */
export async function processOverdueSafetyTimers(): Promise<number> {
  if (mongoose.connection.readyState !== 1) return 0;

  let processedCount = 0;
  const maxPerSweep = 100;

  // Phase A: Newly overdue active timers
  for (let i = 0; i < maxPerSweep; i++) {
    const now = new Date();
    const timer = await SafetyTimerModel.findOneAndUpdate(
      { status: 'active', expectedReturnAt: { $lte: now } },
      {
        $set: {
          status: 'overdue_alerted',
          alertedAt: now,
          emailClaimedAt: now,
        },
      },
      { new: true }
    );
    if (!timer) break;

    processedCount++;

    const user = await UserModel.findById(timer.userId).select('fullName username email').lean().catch(() => null);
    const trekkerName = user?.fullName || user?.username || 'Thành viên LOST';

    // Always deliver email with durable retry tracking (never silently dropped on SMTP failure)
    await deliverOverdueEmailWithTracking(timer, trekkerName).catch((err) =>
      console.error('[SafetyTimer Email Escalation Error]:', (err as Error).message)
    );

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
    }).catch((err) => console.warn('[SafetyTimer User Notification Error]:', (err as Error).message));

    await notifyAdmins({
      type: 'safety_alert',
      category: 'safety',
      title: `Quá hạn Hẹn Giờ An Toàn: ${trekkerName}`,
      message: `Trekker ${trekkerName} quá hạn báo bình an tại ${timer.trailName}. Liên hệ khẩn cấp: ${timer.emergencyContactName} (${timer.emergencyContactPhone}).`,
      link: '/admin?tab=safety',
      relatedId: timer._id.toString(),
      includeModerators: true,
    }).catch((err) => console.warn('[SafetyTimer Admin Notification Error]:', (err as Error).message));
  }

  // Phase B: Retry overdue timers whose emergency email is still pending (up to MAX_EMAIL_RETRIES with backoff)
  const retryBudget = Math.max(10, maxPerSweep - processedCount);
  for (let i = 0; i < retryBudget; i++) {
    const now = new Date();
    const leaseCutoff = new Date(now.getTime() - EMAIL_CLAIM_LEASE_MS);

    const retryTimer = await SafetyTimerModel.findOneAndUpdate(
      {
        status: 'overdue_alerted',
        emailAlertStatus: 'pending',
        emergencyContactEmail: { $exists: true, $ne: '' },
        emailRetryCount: { $lt: MAX_EMAIL_RETRIES },
        $and: [
          {
            $or: [
              { emailNextRetryAt: { $exists: false } },
              { emailNextRetryAt: null },
              { emailNextRetryAt: { $lte: now } },
            ],
          },
          {
            $or: [
              { emailClaimedAt: { $exists: false } },
              { emailClaimedAt: null },
              { emailClaimedAt: { $lte: leaseCutoff } },
            ],
          },
        ],
      },
      { $set: { emailClaimedAt: now } },
      { new: true }
    );
    if (!retryTimer) break;

    processedCount++;
    const user = await UserModel.findById(retryTimer.userId).select('fullName username email').lean().catch(() => null);
    const trekkerName = user?.fullName || user?.username || 'Thành viên LOST';

    await deliverOverdueEmailWithTracking(retryTimer, trekkerName).catch((err) =>
      console.error('[SafetyTimer Email Retry Error]:', (err as Error).message)
    );
  }

  return processedCount;
}
