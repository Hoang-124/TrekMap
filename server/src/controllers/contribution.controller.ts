import crypto from 'crypto';
import { Response } from 'express';
import mongoose from 'mongoose';
import { Contribution } from '../models/Contribution.js';
import { TrailModel } from '../models/Trail.js';
import { UserModel } from '../models/User.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { awardReputationPoints, REPUTATION_POINTS } from '../utils/reputation.js';
import { sendNotification, notifyAdmins } from '../utils/notification.js';
import { sanitizeInput, isSafeHttpUrl, hasDangerousMongoKeys } from '../utils/validation.js';
import { containsProfanity, getProfanityMatch } from '../utils/profanityFilter.js';
import { invalidateCache } from '../middleware/cache.middleware.js';
import { invalidateElevationCache } from '../services/elevation.service.js';
import { invalidateAiTrailCache } from '../services/ai.service.js';
import { cascadeDeleteTrailChildren } from './trail.controller.js';
import { isValidObjectId } from '../utils/resolveTrail.js';
import { recordActivity, recordAuditLog } from '../utils/audit.js';

function parseStrictNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '' || typeof val === 'boolean') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function parseSafeBoolean(val: unknown, fallback: boolean): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0' || lower === '') return false;
  }
  if (typeof val === 'number') {
    if (val === 1) return true;
    if (val === 0) return false;
  }
  return fallback;
}

const MAX_MEM_CONTRIBUTIONS = 200;
const inMemoryContributions: any[] = [];

const VALID_REGIONS = new Set(['Miền Bắc', 'Miền Trung', 'Miền Nam']);
const VALID_STATUSES = new Set(['pending', 'approved', 'rejected']);
const VALID_WAYPOINT_TYPES = new Set(['campsite', 'water', 'viewpoint', 'danger', 'charging', 'rest']);
const DEFAULT_CONTRIB_COVER = '/covers/trail-fansipan.svg';

const ALLOWED_UPDATE_FIELDS = [
  'name',
  'altNames',
  'region',
  'province',
  'district',
  'hamlet',
  'distanceKm',
  'elevationGainM',
  'maxAltitudeM',
  'difficultyLevel',
  'difficultyNote',
  'durationDays',
  'durationHoursNote',
  'startLat',
  'startLng',
  'endLat',
  'endLng',
  'description',
  'transportationInfo',
  'coverImage',
  'galleryImages',
  'permitRequired',
  'permitInfo',
  'hasCampsite',
  'hasWaterSource',
  'kidFriendly',
  'rescueContact',
  'waypoints',
  'gpxTrack',
  'bestMonths',
  'avoidMonths',
] as const;

function sanitizeWaypoints(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const out: any[] = [];
  for (let idx = 0; idx < raw.length && out.length < 50; idx++) {
    const w: any = raw[idx];
    if (!w || typeof w !== 'object') continue;
    const lat = parseStrictNumber(w.lat);
    const lng = parseStrictNumber(w.lng);
    if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    const elev = parseStrictNumber(w.elevationM);
    out.push({
      id: typeof w.id === 'string' && w.id.trim() ? sanitizeInput(w.id).slice(0, 40) : `wp-${out.length + 1}`,
      name: sanitizeInput(String(w.name || `Mốc ${out.length + 1}`)).slice(0, 120),
      type: VALID_WAYPOINT_TYPES.has(w.type) ? w.type : 'viewpoint',
      description: sanitizeInput(String(w.description || '')).slice(0, 400),
      ...(elev !== null ? { elevationM: Math.round(elev) } : {}),
      lat,
      lng,
    });
  }
  return out;
}

function sanitizeGpxTrack(raw: unknown): [number, number][] {
  if (!Array.isArray(raw)) return [];
  const out: [number, number][] = [];
  for (let i = 0; i < raw.length && out.length < 5000; i++) {
    const pt: any = raw[i];
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const lat = parseStrictNumber(pt[0]);
    const lng = parseStrictNumber(pt[1]);
    if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    out.push([lat, lng]);
  }
  return out;
}

function stripPrivateEmailForViewer(contrib: any, viewerId?: string, viewerRole?: string) {
  const isStaff = viewerRole === 'admin' || viewerRole === 'moderator';
  const isOwner = Boolean(viewerId && contrib.userId && String(contrib.userId) === String(viewerId));
  if (isStaff || isOwner) return contrib;
  const { authorEmail: _hiddenEmail, ...publicContrib } = contrib;
  return publicContrib;
}

async function publishContributionToTrail(updatedDoc: any) {
  const startLat = parseStrictNumber(updatedDoc.startLat);
  const startLng = parseStrictNumber(updatedDoc.startLng);
  if (
    startLat === null ||
    startLng === null ||
    startLat < -90 ||
    startLat > 90 ||
    startLng < -180 ||
    startLng > 180
  ) {
    throw new Error('INVALID_TRAIL_COORDS: Tọa độ xuất phát không hợp lệ để xuất bản cung đường.');
  }
  const parsedEndLat = parseStrictNumber(updatedDoc.endLat);
  const parsedEndLng = parseStrictNumber(updatedDoc.endLng);
  const endLat =
    parsedEndLat !== null && parsedEndLat >= -90 && parsedEndLat <= 90 ? parsedEndLat : startLat;
  const endLng =
    parsedEndLng !== null && parsedEndLng >= -180 && parsedEndLng <= 180 ? parsedEndLng : startLng;

  const validGpx =
    Array.isArray(updatedDoc.gpxTrack) && updatedDoc.gpxTrack.length > 0
      ? updatedDoc.gpxTrack
      : [
          [startLat, startLng],
          [endLat, endLng],
        ];

  const coverImg =
    updatedDoc.coverImage && isSafeHttpUrl(updatedDoc.coverImage) ? updatedDoc.coverImage : DEFAULT_CONTRIB_COVER;

  await TrailModel.findOneAndUpdate(
    { id: updatedDoc.id },
    {
      $set: {
        id: updatedDoc.id,
        name: updatedDoc.name,
        altNames: updatedDoc.altNames || [],
        region: updatedDoc.region || 'Miền Bắc',
        province: updatedDoc.province,
        district: updatedDoc.district,
        difficultyLevel: Number(updatedDoc.difficultyLevel) || 3,
        difficultyNote: updatedDoc.difficultyNote || '',
        distanceKm: Number(updatedDoc.distanceKm) || 10,
        elevationGainM: Number(updatedDoc.elevationGainM) || 500,
        maxAltitudeM: Number(updatedDoc.maxAltitudeM) || 1000,
        durationDays: Number(updatedDoc.durationDays) || 1,
        durationHoursNote: updatedDoc.durationHoursNote || '1 ngày',
        coverImage: coverImg,
        galleryImages:
          Array.isArray(updatedDoc.galleryImages) && updatedDoc.galleryImages.length > 0
            ? updatedDoc.galleryImages
            : [coverImg],
        startLocation: { type: 'Point', coordinates: [startLng, startLat] },
        startLat,
        startLng,
        endLat,
        endLng,
        gpxTrack: validGpx,
        waypoints: updatedDoc.waypoints || [],
        description: updatedDoc.description,
        transportationInfo: updatedDoc.transportationInfo || 'Phương tiện tự túc',
        permitRequired: Boolean(updatedDoc.permitRequired),
        permitInfo: updatedDoc.permitInfo || '',
        rescueContact: updatedDoc.rescueContact?.phone
          ? updatedDoc.rescueContact
          : {
              name: `Cứu nạn Khẩn cấp ${updatedDoc.province || 'Địa phương'}`,
              phone: '112 / 114',
              rangerContact: '115',
            },
        hasCampsite: Boolean(updatedDoc.hasCampsite),
        hasWaterSource: Boolean(updatedDoc.hasWaterSource),
        kidFriendly: Boolean(updatedDoc.kidFriendly),
        bestMonths: Array.isArray(updatedDoc.bestMonths) ? updatedDoc.bestMonths : [],
        avoidMonths: Array.isArray(updatedDoc.avoidMonths) ? updatedDoc.avoidMonths : [],
        status: 'approved',
        ...(isValidObjectId(updatedDoc.userId) ? { createdBy: updatedDoc.userId } : {}),
      },
      $setOnInsert: {
        rating: 0,
        reviewCount: 0,
      },
    },
    { upsert: true, new: true }
  );
  invalidateElevationCache(String(updatedDoc.id));
}

// GET /api/contributions - Admin/Moderator see all; authenticated users see approved + own; guests see approved only
export const getContributions = async (req: AuthRequest, res: Response) => {
  try {
    const viewerId = req.user?.userId;
    const viewerRole = req.user?.role;
    const isStaff = viewerRole === 'admin' || viewerRole === 'moderator';
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 200);

    const dbFilter: any = isStaff
      ? {}
      : viewerId
        ? { $or: [{ status: 'approved' }, { userId: String(viewerId) }] }
        : { status: 'approved' };

    let list: any[] = [];
    if (mongoose.connection.readyState === 1) {
      list = await Contribution.find(dbFilter).sort({ createdAt: -1 }).limit(limit).lean();
    } else {
      list = inMemoryContributions.filter((c) => {
        if (isStaff) return true;
        if (c.status === 'approved') return true;
        return Boolean(viewerId && String(c.userId) === String(viewerId));
      });
    }

    if (mongoose.connection.readyState === 1 && list.length > 0) {
      try {
        const userIds = list.map((c) => c.userId).filter((uid) => isValidObjectId(uid));
        if (userIds.length > 0) {
          const users = await UserModel.find({ _id: { $in: userIds } })
            .select('fullName avatarUrl email')
            .lean();

          const userMap = new Map<string, any>();
          users.forEach((u) => {
            userMap.set(u._id.toString(), u);
          });

          list = list.map((c) => {
            const matchedUser = c.userId && userMap.get(String(c.userId));
            if (matchedUser) {
              return {
                ...c,
                authorName: matchedUser.fullName || c.authorName,
                authorAvatar: matchedUser.avatarUrl || c.authorAvatar,
                authorEmail: matchedUser.email || c.authorEmail,
              };
            }
            return c;
          });
        }
      } catch {
        // Ignore enrichment errors
      }
    }

    const sanitizedList = list.map((c) => stripPrivateEmailForViewer(c, viewerId, viewerRole));
    return res.json({ success: true, count: sanitizedList.length, data: sanitizedList });
  } catch (err) {
    console.error('[Get Contributions Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể tải danh sách đóng góp.' });
  }
};

// POST /api/contributions - Create a new pending contribution
export const createContribution = async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body || {};
    const currentUserId = req.user?.userId;
    const currentUserEmail = req.user?.email;

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để gửi đóng góp.' });
    }

    if (typeof body.name !== 'string' || !body.name.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên cung đường chính.' });
    }
    if (typeof body.province !== 'string' || !body.province.trim() || typeof body.district !== 'string' || !body.district.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn Tỉnh/Thành phố và Quận/Huyện.' });
    }

    if (containsProfanity(`${body.name} ${body.description || ''}`)) {
      const matched = getProfanityMatch(`${body.name} ${body.description || ''}`);
      return res.status(400).json({
        success: false,
        message: `Hồ sơ đóng góp chứa từ ngữ không phù hợp ("${matched}").`,
      });
    }

    const distanceKm = parseStrictNumber(body.distanceKm);
    const maxAltitudeM = parseStrictNumber(body.maxAltitudeM);
    const elevationGainM = parseStrictNumber(body.elevationGainM) ?? 0;
    const difficultyLevel = Math.min(Math.max(Math.round(parseStrictNumber(body.difficultyLevel) ?? 3), 1), 5);
    const startLat = parseStrictNumber(body.startLat);
    const startLng = parseStrictNumber(body.startLng);
    const parsedEndLat = parseStrictNumber(body.endLat);
    const parsedEndLng = parseStrictNumber(body.endLng);
    const endLat = parsedEndLat ?? startLat;
    const endLng = parsedEndLng ?? startLng;

    if (distanceKm === null || distanceKm <= 0 || distanceKm > 500) {
      return res.status(400).json({ success: false, message: 'Độ dài cung đường phải lớn hơn 0 và không quá 500 km.' });
    }
    if (maxAltitudeM === null || maxAltitudeM <= 0 || maxAltitudeM > 3500) {
      return res.status(400).json({ success: false, message: 'Cao độ đỉnh phải từ 1 đến 3.500 m.' });
    }
    if (
      startLat === null ||
      startLng === null ||
      startLat < -90 ||
      startLat > 90 ||
      startLng < -180 ||
      startLng > 180
    ) {
      return res.status(400).json({ success: false, message: 'Tọa độ GPS xuất phát không hợp lệ.' });
    }

    const region = VALID_REGIONS.has(body.region) ? body.region : 'Miền Bắc';
    const contribId = `contrib-${crypto.randomUUID()}`;

    let authorUser: any = null;
    if (mongoose.connection.readyState === 1 && isValidObjectId(currentUserId)) {
      authorUser = await UserModel.findById(currentUserId).select('fullName avatarUrl email').lean();
    }

    const resolvedAuthorName = authorUser?.fullName || 'Trekker Đóng Góp';
    const resolvedAuthorAvatar = authorUser?.avatarUrl || '';
    const resolvedAuthorEmail = authorUser?.email || currentUserEmail || '';

    const coverImage = typeof body.coverImage === 'string' && isSafeHttpUrl(body.coverImage) ? body.coverImage.trim() : '';
    const galleryImages = Array.isArray(body.galleryImages)
      ? body.galleryImages.filter((u: unknown) => isSafeHttpUrl(u)).slice(0, 10)
      : coverImage
        ? [coverImage]
        : [];

    const payload = {
      id: contribId,
      name: sanitizeInput(body.name).slice(0, 160),
      altNames: Array.isArray(body.altNames)
        ? body.altNames.filter((s: unknown) => typeof s === 'string').slice(0, 10).map((s: string) => sanitizeInput(s))
        : [],
      region,
      province: sanitizeInput(body.province).slice(0, 80),
      district: sanitizeInput(body.district).slice(0, 80),
      hamlet: typeof body.hamlet === 'string' ? sanitizeInput(body.hamlet).slice(0, 100) : '',
      distanceKm,
      elevationGainM: Math.max(0, elevationGainM),
      maxAltitudeM,
      difficultyLevel,
      difficultyNote: typeof body.difficultyNote === 'string' ? sanitizeInput(body.difficultyNote).slice(0, 300) : '',
      durationDays: Math.min(30, Math.max(1, Math.round(parseStrictNumber(body.durationDays) ?? Math.ceil(distanceKm / 12)))),
      durationHoursNote:
        typeof body.durationHoursNote === 'string' && body.durationHoursNote.trim()
          ? sanitizeInput(body.durationHoursNote).slice(0, 120)
          : '1 ngày',
      startLat,
      startLng,
      endLat: endLat !== null && endLat >= -90 && endLat <= 90 ? endLat : startLat,
      endLng: endLng !== null && endLng >= -180 && endLng <= 180 ? endLng : startLng,
      description:
        typeof body.description === 'string' && body.description.trim()
          ? sanitizeInput(body.description).slice(0, 4000)
          : 'Cung đường do cộng đồng đóng góp.',
      transportationInfo:
        typeof body.transportationInfo === 'string' ? sanitizeInput(body.transportationInfo).slice(0, 1500) : '',
      coverImage,
      galleryImages,
      permitRequired: parseSafeBoolean(body.permitRequired, false),
      permitInfo: typeof body.permitInfo === 'string' ? sanitizeInput(body.permitInfo).slice(0, 500) : '',
      hasCampsite: parseSafeBoolean(body.hasCampsite, false),
      hasWaterSource: parseSafeBoolean(body.hasWaterSource, false),
      kidFriendly: parseSafeBoolean(body.kidFriendly, false),
      rescueContact:
        body.rescueContact && typeof body.rescueContact === 'object'
          ? {
              name: sanitizeInput(String(body.rescueContact.name || '')).slice(0, 120),
              phone: sanitizeInput(String(body.rescueContact.phone || '')).slice(0, 40),
              rangerContact: sanitizeInput(String(body.rescueContact.rangerContact || '')).slice(0, 120),
            }
          : undefined,
      waypoints: sanitizeWaypoints(body.waypoints),
      gpxTrack: sanitizeGpxTrack(body.gpxTrack),
      bestMonths: Array.isArray(body.bestMonths)
        ? body.bestMonths.map(Number).filter((m: number) => Number.isInteger(m) && m >= 1 && m <= 12)
        : [],
      avoidMonths: Array.isArray(body.avoidMonths)
        ? body.avoidMonths.map(Number).filter((m: number) => Number.isInteger(m) && m >= 1 && m <= 12)
        : [],
      status: 'pending' as const,
      userId: String(currentUserId),
      authorEmail: resolvedAuthorEmail,
      authorName: sanitizeInput(resolvedAuthorName),
      authorAvatar: resolvedAuthorAvatar,
    };

    let savedDoc: any;
    if (mongoose.connection.readyState === 1) {
      savedDoc = await Contribution.create(payload);
    } else {
      savedDoc = { ...payload, createdAt: new Date(), updatedAt: new Date() };
      if (inMemoryContributions.length >= MAX_MEM_CONTRIBUTIONS) inMemoryContributions.pop();
      inMemoryContributions.unshift(savedDoc);
    }

    await recordActivity({
      userId: currentUserId,
      type: 'new_contribution',
      title: `Đã gửi hồ sơ đóng góp cung đường "${payload.name}"`,
      targetType: 'trail',
      targetId: contribId,
      thumbnailUrl: coverImage,
    });

    notifyAdmins({
      sender: {
        id: String(currentUserId),
        name: resolvedAuthorName,
        avatarUrl: resolvedAuthorAvatar,
      },
      type: 'contribution_pending',
      title: 'Bài đóng góp mới chờ duyệt',
      message: `Thành viên ${resolvedAuthorName} vừa gửi bài đóng góp "${payload.name}".`,
      link: '/admin',
      relatedId: contribId,
      includeModerators: true,
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Đã lưu bài đóng góp mới thành công! Chờ Ban Quản Trị duyệt công khai.',
      data: savedDoc,
    });
  } catch (err) {
    console.error('[Create Contribution Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể lưu bài đóng góp vào Database.' });
  }
};

// PUT /api/contributions/:id - Strict whitelist update + atomic approval reward + Trail sync
export const updateContribution = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const rawBody = req.body || {};
    const currentUserId = req.user?.userId;
    const currentUserEmail = req.user?.email;
    const isStaff = req.user?.role === 'admin' || req.user?.role === 'moderator';

    if (hasDangerousMongoKeys(rawBody)) {
      return res.status(400).json({ success: false, message: 'Dữ liệu cập nhật chứa khóa không hợp lệ.' });
    }

    let existing: any = null;
    if (mongoose.connection.readyState === 1) {
      existing = await Contribution.findOne({ id });
    } else {
      existing = inMemoryContributions.find((c) => c.id === id);
    }

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài đóng góp để cập nhật.' });
    }

    if (rawBody.status !== undefined && rawBody.status !== existing.status) {
      if (!isStaff) {
        return res.status(403).json({
          success: false,
          message: 'Chỉ Ban Quản Trị mới có quyền phê duyệt hoặc từ chối bài đóng góp.',
        });
      }
      if (typeof rawBody.status !== 'string' || !VALID_STATUSES.has(rawBody.status)) {
        return res.status(400).json({ success: false, message: 'Trạng thái kiểm duyệt không hợp lệ.' });
      }
    }

    const isOwner =
      (currentUserId && existing.userId && String(existing.userId) === String(currentUserId)) ||
      (currentUserEmail && existing.authorEmail && existing.authorEmail.toLowerCase() === currentUserEmail.toLowerCase());

    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa bài đóng góp này.' });
    }

    // Security: Prevent non-staff owners from silently mutating already-approved public trails
    if (!isStaff && existing.status === 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Bài đóng góp đã được phê duyệt công khai. Vui lòng liên hệ Ban Quản Trị nếu cần chỉnh sửa.',
      });
    }

    const sanitizedUpdate: Record<string, any> = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (rawBody[key] !== undefined) {
        const val = rawBody[key];
        if (key === 'region') {
          if (typeof val !== 'string' || !VALID_REGIONS.has(val)) {
            return res.status(400).json({ success: false, message: 'Vùng miền không hợp lệ (Miền Bắc, Miền Trung, Miền Nam).' });
          }
          sanitizedUpdate[key] = val;
          continue;
        }
        if (key === 'name' || key === 'province' || key === 'district') {
          if (typeof val !== 'string' || !val.trim()) {
            return res.status(400).json({ success: false, message: `Trường ${key} không được để trống.` });
          }
          const maxLen = key === 'name' ? 160 : 80;
          sanitizedUpdate[key] = sanitizeInput(val).slice(0, maxLen);
          continue;
        }
        if (key === 'hamlet') {
          sanitizedUpdate[key] = typeof val === 'string' ? sanitizeInput(val).slice(0, 100) : '';
          continue;
        }
        if (key === 'difficultyNote') {
          sanitizedUpdate[key] = typeof val === 'string' ? sanitizeInput(val).slice(0, 300) : '';
          continue;
        }
        if (key === 'durationHoursNote') {
          sanitizedUpdate[key] = typeof val === 'string' ? sanitizeInput(val).slice(0, 120) : '1 ngày';
          continue;
        }
        if (key === 'description') {
          sanitizedUpdate[key] = typeof val === 'string' ? sanitizeInput(val).slice(0, 4000) : '';
          continue;
        }
        if (key === 'transportationInfo') {
          sanitizedUpdate[key] = typeof val === 'string' ? sanitizeInput(val).slice(0, 1500) : '';
          continue;
        }
        if (key === 'permitInfo') {
          sanitizedUpdate[key] = typeof val === 'string' ? sanitizeInput(val).slice(0, 500) : '';
          continue;
        }
        if (key === 'distanceKm') {
          const n = parseStrictNumber(val);
          if (n === null || n <= 0 || n > 500) {
            return res.status(400).json({ success: false, message: 'Độ dài cung đường phải từ 0.1 đến 500 km.' });
          }
          sanitizedUpdate[key] = n;
          continue;
        }
        if (key === 'maxAltitudeM') {
          const n = parseStrictNumber(val);
          if (n === null || n <= 0 || n > 3500) {
            return res.status(400).json({ success: false, message: 'Cao độ đỉnh phải từ 1 đến 3.500 m.' });
          }
          sanitizedUpdate[key] = Math.round(n);
          continue;
        }
        if (key === 'elevationGainM') {
          const n = parseStrictNumber(val);
          if (n === null || n < 0 || n > 15000) {
            return res.status(400).json({ success: false, message: 'Độ dốc tích lũy không hợp lệ (0 - 15.000 m).' });
          }
          sanitizedUpdate[key] = Math.round(n);
          continue;
        }
        if (key === 'difficultyLevel') {
          const n = parseStrictNumber(val);
          if (n === null || n < 1 || n > 5) {
            return res.status(400).json({ success: false, message: 'Độ khó phải từ 1 đến 5.' });
          }
          sanitizedUpdate[key] = Math.round(n);
          continue;
        }
        if (key === 'durationDays') {
          const n = parseStrictNumber(val);
          if (n === null || n < 1 || n > 30) {
            return res.status(400).json({ success: false, message: 'Thời lượng phải từ 1 đến 30 ngày.' });
          }
          sanitizedUpdate[key] = Math.round(n);
          continue;
        }
        if (key === 'startLat' || key === 'endLat') {
          const n = parseStrictNumber(val);
          if (n === null || n < -90 || n > 90) {
            return res.status(400).json({ success: false, message: 'Vĩ độ GPS không hợp lệ (-90..90).' });
          }
          sanitizedUpdate[key] = n;
          continue;
        }
        if (key === 'startLng' || key === 'endLng') {
          const n = parseStrictNumber(val);
          if (n === null || n < -180 || n > 180) {
            return res.status(400).json({ success: false, message: 'Kinh độ GPS không hợp lệ (-180..180).' });
          }
          sanitizedUpdate[key] = n;
          continue;
        }
        if (key === 'altNames') {
          if (!Array.isArray(val)) {
            return res.status(400).json({ success: false, message: 'altNames phải là danh sách chuỗi.' });
          }
          sanitizedUpdate[key] = val
            .filter((s: unknown) => typeof s === 'string' && s.trim())
            .slice(0, 10)
            .map((s: string) => sanitizeInput(s).slice(0, 100));
          continue;
        }
        if (key === 'bestMonths' || key === 'avoidMonths') {
          if (!Array.isArray(val)) {
            return res.status(400).json({ success: false, message: `${key} phải là danh sách tháng (1-12).` });
          }
          sanitizedUpdate[key] = Array.from(
            new Set(val.map(Number).filter((m: number) => Number.isInteger(m) && m >= 1 && m <= 12))
          );
          continue;
        }
        if (key === 'permitRequired' || key === 'hasCampsite' || key === 'hasWaterSource' || key === 'kidFriendly') {
          if (typeof val !== 'boolean') {
            return res.status(400).json({ success: false, message: `Trường ${key} phải là kiểu boolean.` });
          }
          sanitizedUpdate[key] = val;
          continue;
        }
        if (key === 'coverImage') {
          if (typeof val === 'string' && (val === '' || isSafeHttpUrl(val))) {
            sanitizedUpdate[key] = val.trim();
          }
          continue;
        }
        if (key === 'galleryImages') {
          if (Array.isArray(val)) {
            sanitizedUpdate[key] = val.filter((u: unknown) => isSafeHttpUrl(u)).slice(0, 10);
          }
          continue;
        }
        if (key === 'waypoints') {
          sanitizedUpdate[key] = sanitizeWaypoints(val);
          continue;
        }
        if (key === 'gpxTrack') {
          sanitizedUpdate[key] = sanitizeGpxTrack(val);
          continue;
        }
        if (key === 'rescueContact' && val && typeof val === 'object') {
          sanitizedUpdate[key] = {
            name: sanitizeInput(String(val.name || '')).slice(0, 120),
            phone: sanitizeInput(String(val.phone || '')).slice(0, 40),
            rangerContact: sanitizeInput(String(val.rangerContact || '')).slice(0, 120),
          };
          continue;
        }
      }
    }

    const profanityText = [
      sanitizedUpdate.name,
      sanitizedUpdate.description,
      sanitizedUpdate.difficultyNote,
      sanitizedUpdate.transportationInfo,
      sanitizedUpdate.permitInfo,
    ]
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
      .join(' ');
    if (profanityText && containsProfanity(profanityText)) {
      const matched = getProfanityMatch(profanityText);
      return res.status(400).json({
        success: false,
        message: `Hồ sơ đóng góp chứa từ ngữ không phù hợp ("${matched}").`,
      });
    }

    // If owner edits a rejected contribution, reset status back to pending for re-review
    if (!isStaff && existing.status === 'rejected') {
      sanitizedUpdate.status = 'pending';
    }

    if (isStaff && rawBody.status !== undefined && VALID_STATUSES.has(rawBody.status)) {
      sanitizedUpdate.status = rawBody.status;
    }

    const previousStatus = existing.status;
    const wantsApproval = sanitizedUpdate.status === 'approved' && existing.status !== 'approved';
    const wantsRejection = sanitizedUpdate.status === 'rejected' && existing.status !== 'rejected';

    let updatedDoc: any = existing;
    let firstTimeApproved = false;

    if (mongoose.connection.readyState === 1) {
      if (wantsApproval) {
        // Atomic transition guard prevents double-rewarding +50 reputation under concurrent approval clicks
        const transitioned = await Contribution.findOneAndUpdate(
          { id, status: { $ne: 'approved' } },
          { $set: sanitizedUpdate },
          { new: true, runValidators: true }
        );
        if (transitioned) {
          updatedDoc = transitioned;
          firstTimeApproved = true;
        } else {
          updatedDoc = await Contribution.findOneAndUpdate(
            { id },
            { $set: sanitizedUpdate },
            { new: true, runValidators: true }
          );
        }
      } else {
        updatedDoc = await Contribution.findOneAndUpdate(
          { id },
          { $set: sanitizedUpdate },
          { new: true, runValidators: true }
        );
      }
    } else {
      firstTimeApproved = wantsApproval;
      Object.assign(existing, sanitizedUpdate, { updatedAt: new Date() });
      updatedDoc = existing;
    }

    // Publish or sync TrailModel when approved — fail explicitly & roll back approval if Trail publish throws!
    if (updatedDoc && updatedDoc.status === 'approved' && mongoose.connection.readyState === 1) {
      try {
        await publishContributionToTrail(updatedDoc);
      } catch (trailErr: any) {
        console.error('[MongoDB Trail Publish Error]:', trailErr);
        if (firstTimeApproved) {
          await Contribution.updateOne({ id }, { $set: { status: previousStatus } }).catch(() => {});
        }
        const isInvalidCoords = String(trailErr?.message || '').startsWith('INVALID_TRAIL_COORDS');
        return res.status(isInvalidCoords ? 400 : 500).json({
          success: false,
          message: isInvalidCoords
            ? 'Không thể duyệt cung đường do tọa độ GPS không hợp lệ. Vui lòng chỉnh sửa tọa độ trước khi phê duyệt.'
            : 'Không thể xuất bản cung đường sang danh mục công khai (đã hoàn tác trạng thái phê duyệt).',
        });
      }
      invalidateAiTrailCache();
    }

    invalidateCache('/api/trails');

    if (firstTimeApproved && updatedDoc) {
      await recordAuditLog(req, 'APPROVE_CONTRIBUTION', 'contributions', `Phê duyệt cung đường ${updatedDoc.name} (${updatedDoc.id})`);
      if (mongoose.connection.readyState === 1) {
        try {
          const authorUser = await UserModel.findOne({
            $or: [
              ...(isValidObjectId(updatedDoc.userId) ? [{ _id: updatedDoc.userId }] : []),
              ...(updatedDoc.authorEmail ? [{ email: updatedDoc.authorEmail }] : []),
            ],
          }).select('_id');

          if (authorUser) {
            await awardReputationPoints(
              authorUser._id.toString(),
              REPUTATION_POINTS.CONTRIBUTE_TRAIL,
              'Bài đóng góp cung đường được duyệt'
            );
            await UserModel.updateOne(
              { _id: authorUser._id },
              { $addToSet: { badges: 'Người Đóng Góp' } }
            );
            await sendNotification({
              recipientId: authorUser._id.toString(),
              type: 'contribution_approved',
              category: 'moderation',
              title: 'Bài đóng góp cung đường được duyệt!',
              message: `Chúc mừng! Bài đóng góp "${updatedDoc.name}" của bạn đã được Ban Quản Trị phê duyệt công khai và nhận +50 điểm uy tín.`,
              link: `/#trail/${updatedDoc.id}`,
              relatedId: updatedDoc._id || updatedDoc.id,
            });
          }
        } catch {
          // Best-effort reward & notification
        }
      }
    } else if (wantsRejection && updatedDoc) {
      await recordAuditLog(req, 'REJECT_CONTRIBUTION', 'contributions', `Từ chối cung đường ${updatedDoc.name} (${updatedDoc.id})`);
      if (mongoose.connection.readyState === 1) {
        try {
          const authorUser = await UserModel.findOne({
            $or: [
              ...(isValidObjectId(updatedDoc.userId) ? [{ _id: updatedDoc.userId }] : []),
              ...(updatedDoc.authorEmail ? [{ email: updatedDoc.authorEmail }] : []),
            ],
          }).select('_id');

          if (authorUser) {
            await sendNotification({
              recipientId: authorUser._id.toString(),
              type: 'contribution_rejected',
              category: 'moderation',
              title: 'Bài đóng góp chưa đạt yêu cầu',
              message: `Rất tiếc, bài đóng góp "${updatedDoc.name}" chưa thể công khai. Vui lòng kiểm tra lại thông tin tọa độ & giấy phép.`,
              link: '/contribute',
              relatedId: updatedDoc._id || updatedDoc.id,
            });
          }
        } catch {
          // Best-effort notification
        }
      }
    }

    return res.json({ success: true, message: 'Đã cập nhật bài đóng góp thành công!', data: updatedDoc });
  } catch (err) {
    console.error('[Update Contribution Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật bài đóng góp.' });
  }
};

// DELETE /api/contributions/:id - Delete a contribution
export const deleteContribution = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.userId;
    const currentUserEmail = req.user?.email;
    const isStaff = req.user?.role === 'admin' || req.user?.role === 'moderator';

    let existing: any = null;
    if (mongoose.connection.readyState === 1) {
      existing = await Contribution.findOne({ id });
    } else {
      existing = inMemoryContributions.find((c) => c.id === id);
    }

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài đóng góp để xóa.' });
    }

    const isOwner =
      (currentUserId && existing.userId && String(existing.userId) === String(currentUserId)) ||
      (currentUserEmail && existing.authorEmail && existing.authorEmail.toLowerCase() === currentUserEmail.toLowerCase());

    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa bài đóng góp này.' });
    }

    if (!isStaff && existing.status === 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Không thể tự xóa bài đóng góp đã được phê duyệt công khai.',
      });
    }

    if (mongoose.connection.readyState === 1) {
      await Contribution.findOneAndDelete({ id });
      if (isStaff && existing.status === 'approved') {
        const deletedTrail = await TrailModel.findOneAndDelete({ id: existing.id }).catch(() => null);
        if (deletedTrail?._id) {
          await cascadeDeleteTrailChildren(deletedTrail._id, existing.id);
        }
        invalidateElevationCache(String(existing.id));
        invalidateAiTrailCache();
      }
    }

    const idx = inMemoryContributions.findIndex((c) => c.id === id);
    if (idx >= 0) {
      inMemoryContributions.splice(idx, 1);
    }

    invalidateCache('/api/trails');
    if (isStaff) {
      await recordAuditLog(req, 'DELETE_CONTRIBUTION', 'contributions', `Xóa đóng góp ${existing.name} (${id})`);
    }

    return res.json({ success: true, message: 'Đã xóa bài đóng góp thành công!' });
  } catch (err) {
    console.error('[Delete Contribution Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa bài đóng góp.' });
  }
};
