import crypto from 'crypto';
import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { LiveBeaconModel, LiveBeaconStatus } from '../models/LiveBeacon.js';
import { UserModel } from '../models/User.js';
import { mockTrails } from '../data/seedData.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { resolveTrailByIdOrSlug, isValidObjectId } from '../utils/resolveTrail.js';
import { sanitizeInput } from '../utils/validation.js';
import { containsProfanity, getProfanityMatch } from '../utils/profanityFilter.js';
import { notifyAdmins, sendNotification } from '../utils/notification.js';
import { recordAuditLog } from '../utils/audit.js';
import { getIO, emitToUser } from '../config/socket.js';
import { getClientBaseUrl } from '../utils/clientUrl.js';

const BEACON_TOKEN_REGEX = /^[a-f0-9]{24}$/;
const VALID_BEACON_STATUSES = new Set<LiveBeaconStatus>(['active', 'paused', 'safe', 'sos']);
const STALE_SIGNAL_MINUTES = 45;
const MAX_BREADCRUMBS = 300;
const DEFAULT_TTL_HOURS = 48;
const SOS_ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5-minute atomic cooldown per beacon prevents admin alert spam

function parseCoordinates(rawLat: unknown, rawLng: unknown): { lat: number; lng: number } | null {
  if (
    rawLat === undefined ||
    rawLat === null ||
    rawLat === '' ||
    typeof rawLat === 'boolean' ||
    rawLng === undefined ||
    rawLng === null ||
    rawLng === '' ||
    typeof rawLng === 'boolean'
  ) {
    return null;
  }
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
}

function parseOptionalBoundedNumber(raw: unknown, min: number, max: number, decimals = 1): number | null {
  if (raw === undefined || raw === null || raw === '' || typeof raw === 'boolean') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.max(min, Math.min(max, n));
  const factor = Math.pow(10, decimals);
  return Math.round(clamped * factor) / factor;
}

// POST /api/live-beacons - Start a shareable 48h Live Family GPS Beacon session
export const createLiveBeacon = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để kích hoạt Live Beacon chia sẻ vị trí.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const {
      trailId,
      trailName,
      displayName,
      batteryPercent,
      lat,
      lng,
      altitudeM,
      accuracyM,
      emergencyNote,
      expiresInHours,
    } = req.body || {};

    const uid = new Types.ObjectId(userId);
    const [user, resolvedTrail] = await Promise.all([
      UserModel.findById(uid).select('fullName username').lean(),
      typeof trailId === 'string' && trailId.trim()
        ? resolveTrailByIdOrSlug(trailId.trim()).catch(() => null)
        : Promise.resolve(null),
    ]);

    const approvedResolvedTrail =
      resolvedTrail && (!(resolvedTrail as any).status || (resolvedTrail as any).status === 'approved')
        ? resolvedTrail
        : null;
    const fallbackTrail =
      approvedResolvedTrail ||
      (typeof trailId === 'string' && trailId.trim() ? mockTrails.find((t) => t.id === trailId.trim()) || null : null);

    const cleanDisplayName =
      sanitizeInput(String(displayName || user?.fullName || user?.username || 'Trekker LOST')).slice(0, 80) ||
      'Trekker LOST';
    const cleanTrailName =
      sanitizeInput(String(trailName || fallbackTrail?.name || 'Hành trình thực địa LOST')).slice(0, 160) ||
      'Hành trình thực địa LOST';
    const cleanNote = sanitizeInput(String(emergencyNote || '')).slice(0, 400);

    if (containsProfanity(`${cleanDisplayName} ${cleanTrailName} ${cleanNote}`)) {
      const matched = getProfanityMatch(`${cleanDisplayName} ${cleanTrailName} ${cleanNote}`);
      return res.status(400).json({
        success: false,
        message: `Thông tin Live Beacon chứa từ ngữ không phù hợp ("${matched}").`,
      });
    }

    const hasCoordsInput = lat !== undefined || lng !== undefined;
    const coords = parseCoordinates(lat, lng);
    if (hasCoordsInput && !coords) {
      return res.status(400).json({ success: false, message: 'Tọa độ GPS khởi tạo không hợp lệ (lat -90..90, lng -180..180).' });
    }

    const safeBattery = parseOptionalBoundedNumber(batteryPercent, 0, 100, 0);
    const safeAlt = parseOptionalBoundedNumber(altitudeM, -200, 9000, 0);
    const safeAcc = parseOptionalBoundedNumber(accuracyM, 0, 50000, 0);
    const ttlHours = parseOptionalBoundedNumber(expiresInHours, 1, 72, 0) ?? DEFAULT_TTL_HOURS;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const now = new Date();
    const token = crypto.randomBytes(12).toString('hex');
    const created = await LiveBeaconModel.create({
      token,
      userId: uid,
      displayName: cleanDisplayName,
      trailId: fallbackTrail?.id || (typeof trailId === 'string' ? sanitizeInput(trailId).slice(0, 80) : ''),
      trailName: cleanTrailName,
      status: 'active',
      batteryPercent: safeBattery,
      distanceKm: 0,
      elevationGainM: 0,
      ...(coords
        ? {
            lastPosition: {
              lat: coords.lat,
              lng: coords.lng,
              altitudeM: safeAlt,
              accuracyM: safeAcc,
              recordedAt: now,
            },
            breadcrumbs: [
              {
                lat: coords.lat,
                lng: coords.lng,
                altitudeM: safeAlt,
                recordedAt: now,
              },
            ],
          }
        : {}),
      emergencyNote: cleanNote,
      expiresAt,
    });

    // Deactivate all prior active/paused/sos beacons AFTER creating the new session (eliminates concurrent double-click race & orphaned SOS)
    await LiveBeaconModel.updateMany(
      { userId: uid, _id: { $ne: created._id }, status: { $in: ['active', 'paused', 'sos'] } },
      { $set: { status: 'safe' } }
    );

    const sharePath = `/beacon/${token}`;
    const clientUrl = getClientBaseUrl();

    return res.status(201).json({
      success: true,
      message: 'Đã bật Live Beacon chia sẻ vị trí thời gian thực cho người thân!',
      token,
      sharePath,
      shareUrl: `${clientUrl}${sharePath}`,
      expiresAt: created.expiresAt,
      data: {
        token,
        sharePath,
        shareUrl: `${clientUrl}${sharePath}`,
        displayName: created.displayName,
        trailId: created.trailId,
        trailName: created.trailName,
        status: created.status,
        batteryPercent: created.batteryPercent,
        distanceKm: created.distanceKm,
        elevationGainM: created.elevationGainM,
        lastPosition: created.lastPosition || null,
        expiresAt: created.expiresAt,
      },
    });
  } catch (err) {
    console.error('[Create Live Beacon Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi khởi tạo Live Beacon.' });
  }
};

// PATCH /api/live-beacons/:token/ping - Atomic telemetry & GPS breadcrumb push (strict owner)
export const pingLiveBeacon = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const token = String(req.params.token || '').trim().toLowerCase();

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!BEACON_TOKEN_REGEX.test(token)) {
      return res.status(400).json({ success: false, message: 'Mã Live Beacon không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const { lat, lng, altitudeM, accuracyM, batteryPercent, distanceKm, elevationGainM, status, emergencyNote } =
      req.body || {};

    const hasCoordsInput = lat !== undefined || lng !== undefined;
    const coords = parseCoordinates(lat, lng);
    if (hasCoordsInput && !coords) {
      return res.status(400).json({ success: false, message: 'Tọa độ GPS không hợp lệ (lat -90..90, lng -180..180).' });
    }

    if (batteryPercent !== undefined && batteryPercent !== null && batteryPercent !== '') {
      const b = typeof batteryPercent === 'boolean' ? NaN : Number(batteryPercent);
      if (!Number.isFinite(b) || b < 0 || b > 100) {
        return res.status(400).json({ success: false, message: 'Phần trăm pin phải nằm trong khoảng 0 đến 100.' });
      }
    }

    if (status !== undefined && (typeof status !== 'string' || !VALID_BEACON_STATUSES.has(status as LiveBeaconStatus))) {
      return res.status(400).json({ success: false, message: 'Trạng thái Live Beacon không hợp lệ.' });
    }

    const setFields: Record<string, any> = {};
    const now = new Date();

    if (coords) {
      const safeAlt = parseOptionalBoundedNumber(altitudeM, -200, 9000, 0);
      const safeAcc = parseOptionalBoundedNumber(accuracyM, 0, 50000, 0);
      setFields.lastPosition = {
        lat: coords.lat,
        lng: coords.lng,
        altitudeM: safeAlt,
        accuracyM: safeAcc,
        recordedAt: now,
      };
    }

    const safeBattery = parseOptionalBoundedNumber(batteryPercent, 0, 100, 0);
    if (safeBattery !== null) setFields.batteryPercent = safeBattery;

    const safeDist = parseOptionalBoundedNumber(distanceKm, 0, 500, 2);
    if (safeDist !== null) setFields.distanceKm = safeDist;

    const safeGain = parseOptionalBoundedNumber(elevationGainM, 0, 30000, 0);
    if (safeGain !== null) setFields.elevationGainM = safeGain;

    if (typeof status === 'string' && VALID_BEACON_STATUSES.has(status as LiveBeaconStatus)) {
      setFields.status = status as LiveBeaconStatus;
    }

    if (typeof emergencyNote === 'string') {
      const cleanNote = sanitizeInput(emergencyNote).slice(0, 400);
      if (cleanNote && containsProfanity(cleanNote)) {
        const matched = getProfanityMatch(cleanNote);
        return res.status(400).json({ success: false, message: `Ghi chú khẩn cấp chứa từ ngữ không phù hợp ("${matched}").` });
      }
      setFields.emergencyNote = cleanNote;
    }

    if (Object.keys(setFields).length === 0) {
      return res.status(400).json({ success: false, message: 'Không có dữ liệu định vị hoặc trạng thái hợp lệ để cập nhật.' });
    }

    const updateOps: Record<string, any> = { $set: setFields };
    if (coords) {
      updateOps.$push = {
        breadcrumbs: {
          $each: [
            {
              lat: coords.lat,
              lng: coords.lng,
              altitudeM: setFields.lastPosition.altitudeM,
              recordedAt: now,
            },
          ],
          $slice: -MAX_BREADCRUMBS,
        },
      };
    }

    const uid = new Types.ObjectId(userId);
    const updated = await LiveBeaconModel.findOneAndUpdate(
      { token, userId: uid, expiresAt: { $gt: now }, status: { $ne: 'safe' } },
      updateOps,
      { new: true }
    )
      .select('token displayName trailName status batteryPercent distanceKm elevationGainM lastPosition breadcrumbs emergencyNote updatedAt expiresAt')
      .lean();

    if (!updated) {
      // Unified 404 prevents token-existence probing across users and cleanly rejects expired/stopped beacons
      return res.status(404).json({ success: false, message: 'Không tìm thấy phiên Live Beacon đang hoạt động hoặc đã hết hạn.' });
    }

    if (status === 'sos') {
      const sosCutoff = new Date(now.getTime() - SOS_ALERT_COOLDOWN_MS);
      // Atomic single-document claim prevents TOCTOU duplicate alerts and rapid active<->sos notification spam
      const claimedAlert = await LiveBeaconModel.findOneAndUpdate(
        {
          _id: updated._id,
          $or: [{ sosNotifiedAt: null }, { sosNotifiedAt: { $exists: false } }, { sosNotifiedAt: { $lte: sosCutoff } }],
        },
        { $set: { sosNotifiedAt: now } },
        { new: true }
      )
        .select('_id')
        .lean();

      if (claimedAlert) {
        const posText = updated.lastPosition
          ? `(${updated.lastPosition.lat.toFixed(5)}, ${updated.lastPosition.lng.toFixed(5)})`
          : '';
        notifyAdmins({
          type: 'safety_alert',
          category: 'safety',
          includeModerators: true,
          title: `SOS KHẨN CẤP từ Live Beacon: ${updated.displayName}`,
          message: `${updated.displayName} vừa kích hoạt trạng thái SOS trên tuyến ${updated.trailName} ${posText}. ${updated.emergencyNote || ''}`.trim(),
          link: `/beacon/${updated.token}`,
          relatedId: updated.token,
        }).catch(() => {});
      }
    }

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.json({
      success: true,
      data: {
        token: updated.token,
        status: updated.status,
        batteryPercent: updated.batteryPercent ?? null,
        distanceKm: updated.distanceKm,
        elevationGainM: updated.elevationGainM,
        lastPosition: updated.lastPosition || null,
        breadcrumbsCount: Array.isArray(updated.breadcrumbs) ? updated.breadcrumbs.length : 0,
        emergencyNote: updated.emergencyNote || '',
        updatedAt: updated.updatedAt,
        expiresAt: updated.expiresAt,
      },
    });
  } catch (err) {
    console.error('[Ping Live Beacon Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật tọa độ Live Beacon.' });
  }
};

// POST /api/live-beacons/:token/stop - Mark Live Beacon session safe/finished (strict owner)
export const stopLiveBeacon = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const token = String(req.params.token || '').trim().toLowerCase();

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!BEACON_TOKEN_REGEX.test(token)) {
      return res.status(400).json({ success: false, message: 'Mã Live Beacon không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const setFields: Record<string, any> = { status: 'safe' };
    const safeDist = parseOptionalBoundedNumber(req.body?.distanceKm, 0, 500, 2);
    if (safeDist !== null) setFields.distanceKm = safeDist;
    const safeGain = parseOptionalBoundedNumber(req.body?.elevationGainM, 0, 30000, 0);
    if (safeGain !== null) setFields.elevationGainM = safeGain;
    const safeBattery = parseOptionalBoundedNumber(req.body?.batteryPercent, 0, 100, 0);
    if (safeBattery !== null) setFields.batteryPercent = safeBattery;

    const updated = await LiveBeaconModel.findOneAndUpdate(
      { token, userId: new Types.ObjectId(userId), expiresAt: { $gt: new Date() } },
      { $set: setFields },
      { new: true }
    )
      .select('token status distanceKm elevationGainM batteryPercent updatedAt expiresAt')
      .lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phiên Live Beacon hoặc đã hết hạn.' });
    }

    return res.json({
      success: true,
      message: 'Đã dừng phát Live Beacon và xác nhận về đích an toàn!',
      data: updated,
    });
  } catch (err) {
    console.error('[Stop Live Beacon Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi kết thúc phiên Live Beacon.' });
  }
};

// PATCH /api/live-beacons/admin/:id/resolve - Admin/Moderator SAR resolution ending a live/SOS beacon
export const adminResolveLiveBeacon = async (req: AuthRequest, res: Response) => {
  try {
    const actorId = req.user?.userId;
    const { id } = req.params;

    if (!actorId || !Types.ObjectId.isValid(actorId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã phiên Live Beacon không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const existing = await LiveBeaconModel.findById(id).lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phiên Live Beacon.' });
    }
    if (existing.status === 'safe') {
      return res.status(400).json({
        success: false,
        message: 'Phiên Live Beacon này đã kết thúc trước đó.',
      });
    }

    const rawReason = sanitizeInput(String(req.body?.reason || req.body?.note || '')).trim().slice(0, 180);
    const endedAt = new Date();
    const setFields: Record<string, unknown> = {
      status: 'safe',
    };
    if (rawReason) {
      const stamp = `[SAR kết thúc tín hiệu: ${rawReason}]`;
      const base = (existing.emergencyNote || '').trim();
      const combined = base ? `${base} ${stamp}` : stamp;
      setFields.emergencyNote =
        combined.length <= 400
          ? combined
          : `${base.slice(0, Math.max(0, 400 - stamp.length - 4)).trim()}... ${stamp}`.slice(0, 400);
    }

    const updated = await LiveBeaconModel.findOneAndUpdate(
      { _id: id, status: { $ne: 'safe' } },
      { $set: setFields },
      { new: true }
    )
      .select('token userId displayName trailId trailName status batteryPercent distanceKm elevationGainM lastPosition emergencyNote updatedAt expiresAt')
      .lean();

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: 'Trạng thái phiên Live Beacon đã thay đổi.',
      });
    }

    const beaconEventPayload = {
      beaconId: String(updated._id),
      token: updated.token,
      status: updated.status,
      endedAt: endedAt.toISOString(),
      trailName: updated.trailName,
      displayName: updated.displayName,
    };

    const io = getIO();
    if (io) {
      io.to(`beacon:${updated.token}`).emit('liveBeaconUpdated', beaconEventPayload);
      io.to(`beacon:${String(updated._id)}`).emit('liveBeaconUpdated', beaconEventPayload);
    }
    emitToUser(String(updated.userId), 'liveBeaconUpdated', beaconEventPayload);

    await recordAuditLog(
      req,
      'ADMIN_RESOLVE_BEACON',
      'LiveBeacon',
      `Kết thúc phiên Live Beacon #${updated._id} (${updated.displayName} - ${updated.trailName}, trạng thái cũ: ${existing.status})${rawReason ? ` — Ghi chú: ${rawReason}` : ''}`
    );

    await sendNotification({
      recipientId: String(updated.userId),
      type: 'safety_alert',
      category: 'safety',
      title: `Đã kết thúc tín hiệu định vị: ${updated.trailName}`,
      message: `Đội điều phối an toàn LOST đã đóng phiên phát tín hiệu trực tiếp của bạn trên cung ${updated.trailName}.${rawReason ? ` Ghi chú: ${rawReason}` : ''}`,
      link: `/beacon/${updated.token}`,
      relatedId: String(updated._id),
    }).catch((err) => console.warn('[Admin Resolve Beacon Notification Error]:', (err as Error).message));

    return res.json({
      success: true,
      message: 'Đã kết thúc phiên phát tín hiệu trực tiếp thành công.',
      data: {
        ...updated,
        endedAt: endedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('[Admin Resolve Live Beacon Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi kết thúc phiên Live Beacon.' });
  }
};

// GET /api/live-beacons/:token - Public unlisted read by 24-hex token (zero private email/userId PII!)
export const getLiveBeaconByToken = async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || '').trim().toLowerCase();
    if (!BEACON_TOKEN_REGEX.test(token)) {
      return res.status(404).json({ success: false, message: 'Liên kết theo dõi Live Beacon không hợp lệ hoặc đã hết hạn.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Hệ thống theo dõi tạm thời gián đoạn. Vui lòng thử lại sau.' });
    }

    const beacon = await LiveBeaconModel.findOne({ token }).select('-userId -__v').lean();
    if (!beacon || (beacon.expiresAt && new Date(beacon.expiresAt).getTime() <= Date.now())) {
      return res.status(404).json({ success: false, message: 'Liên kết Live Beacon không tồn tại hoặc đã hết hạn sau 48 giờ.' });
    }

    let trailSummary: any = null;
    if (beacon.trailId) {
      const dbTrail: any = await resolveTrailByIdOrSlug(beacon.trailId).catch(() => null);
      const trailDoc: any =
        (dbTrail && (!dbTrail.status || dbTrail.status === 'approved') ? dbTrail : null) ||
        mockTrails.find((t) => t.id === beacon.trailId) ||
        null;
      if (trailDoc) {
        trailSummary = {
          id: trailDoc.id || String(trailDoc._id),
          name: trailDoc.name,
          province: trailDoc.province,
          district: trailDoc.district || '',
          region: trailDoc.region,
          maxAltitudeM: trailDoc.maxAltitudeM,
          distanceKm: trailDoc.distanceKm,
          elevationGainM: trailDoc.elevationGainM,
          difficultyLevel: trailDoc.difficultyLevel,
          startLat: trailDoc.startLat,
          startLng: trailDoc.startLng,
          endLat: trailDoc.endLat,
          endLng: trailDoc.endLng,
          gpxTrack: Array.isArray(trailDoc.gpxTrack) ? trailDoc.gpxTrack : [],
          rescueContact: trailDoc.rescueContact || null,
        };
      }
    }

    const lastPingAt = beacon.lastPosition?.recordedAt || beacon.updatedAt || beacon.createdAt;
    const minutesSinceLastPing = Math.max(0, Math.floor((Date.now() - new Date(lastPingAt).getTime()) / 60_000));
    const isSignalStale = (beacon.status === 'active' || beacon.status === 'sos') && minutesSinceLastPing > STALE_SIGNAL_MINUTES;

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.json({
      success: true,
      data: {
        token: beacon.token,
        displayName: beacon.displayName,
        trailId: beacon.trailId || '',
        trailName: beacon.trailName,
        status: beacon.status,
        batteryPercent: beacon.batteryPercent ?? null,
        distanceKm: beacon.distanceKm,
        elevationGainM: beacon.elevationGainM,
        lastPosition: beacon.lastPosition || null,
        breadcrumbs: Array.isArray(beacon.breadcrumbs) ? beacon.breadcrumbs : [],
        emergencyNote: beacon.emergencyNote || '',
        minutesSinceLastPing,
        isSignalStale,
        startedAt: beacon.createdAt,
        updatedAt: beacon.updatedAt,
        expiresAt: beacon.expiresAt,
        trailSummary,
      },
    });
  } catch (err) {
    console.error('[Get Live Beacon Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải dữ liệu Live Beacon.' });
  }
};
