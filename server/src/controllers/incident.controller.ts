import crypto from 'crypto';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Incident } from '../types.js';
import { IncidentModel } from '../models/Incident.js';
import { UserModel } from '../models/User.js';
import { TrailModel } from '../models/Trail.js';
import { mockIncidents, mockTrails } from '../data/seedData.js';
import { broadcastEvent } from '../config/socket.js';
import { getNaturalHazardsAlerts, getLiveWeatherForecast } from '../services/publicApis.service.js';
import { notifyAdmins } from '../utils/notification.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { sanitizeInput, isSafeHttpUrl } from '../utils/validation.js';
import { containsProfanity, getProfanityMatch } from '../utils/profanityFilter.js';
import { isValidObjectId, resolveTrailByIdOrSlug } from '../utils/resolveTrail.js';
import { calculateHaversineDistanceKm } from '../utils/spatial.js';
import { recordAuditLog } from '../utils/audit.js';
import { deductReputationPoints, PENALTY_POINTS } from '../utils/reputation.js';

let inMemoryIncidents: Incident[] = [...mockIncidents];

// 5-minute TTL cache for external weather telemetry to avoid hammering Open-Meteo on every request
let cachedWeatherTelemetry: Incident[] = [];
let lastWeatherTelemetryAt = 0;
const WEATHER_TELEMETRY_TTL_MS = 5 * 60 * 1000;

const VALID_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const VALID_TYPES = new Set([
  'landslide',
  'flood',
  'flash_flood',
  'weather',
  'bad_weather',
  'wildfire',
  'lost',
  'trail_closed',
  'wildlife',
  'injury',
  'other',
]);

// Verified official coordinates & rescue contacts (Rule 11 compliant)
const MONITORED_REGIONS = [
  {
    id: 'trail-fansipan',
    name: 'Chinh Phục Fansipan (Trạm Tôn)',
    lat: 22.3522,
    lng: 103.7769,
    elev: 1930,
    rescue: '02143.871.494 / 0985.834.581 - VQG Hoàng Liên (112/114)',
  },
  {
    id: 'trail-taxua',
    name: 'Tà Xùa (Sống Lưng Khủng Long)',
    lat: 21.4165,
    lng: 104.3305,
    elev: 2550,
    rescue: '112 / 114 - Tìm kiếm Cứu nạn Trạm Tấu - Bắc Yên',
  },
  {
    id: 'trail-tanangphandung',
    name: 'Cung đường Tà Năng - Phan Dũng',
    lat: 11.4015,
    lng: 108.472,
    elev: 1100,
    rescue: '112 / 114 - Tìm kiếm Cứu nạn Lâm Đồng - Bình Thuận',
  },
  {
    id: 'trail-kyquansan',
    name: 'Kỳ Quan San (Bạch Mộc Lương Tử)',
    lat: 22.5078,
    lng: 103.5875,
    elev: 3046,
    rescue: '112 / 114 - Tìm kiếm Cứu nạn Bát Xát, Lào Cai',
  },
];

/**
 * Strips ALL private email fields from an incident document (including nested coReporters, timelineUpdates, disputes).
 */
function sanitizeIncidentPII(inc: any, liveUser?: any) {
  if (!inc) return inc;
  const obj = typeof inc.toObject === 'function' ? inc.toObject() : { ...inc };
  delete obj.reporterEmail;

  if (Array.isArray(obj.coReporters)) {
    obj.coReporters = obj.coReporters.map((r: any) => {
      const { userEmail: _e, ...rest } = r;
      return rest;
    });
  }
  if (Array.isArray(obj.timelineUpdates)) {
    obj.timelineUpdates = obj.timelineUpdates.map((u: any) => {
      const { userEmail: _e, ...rest } = u;
      return rest;
    });
  }
  if (Array.isArray(obj.disputes)) {
    obj.disputes = obj.disputes.map((d: any) => {
      const { userEmail: _e, ...rest } = d;
      return rest;
    });
  }

  return {
    ...obj,
    id: obj._id ? String(obj._id) : obj.id,
    ...(liveUser
      ? {
          reporterName: liveUser.fullName || obj.reporterName,
          reporterAvatar: liveUser.avatarUrl || obj.reporterAvatar,
          reporterRole: liveUser.role || obj.reporterRole,
        }
      : {}),
  };
}

function findNearestVietnamTrail(lat: number, lng: number): { id: string; name: string } {
  let best = { id: 'trail-fansipan', name: 'Khu vực rừng núi Việt Nam', dist: Infinity };
  for (const t of mockTrails) {
    const d = calculateHaversineDistanceKm(lat, lng, t.startLat, t.startLng);
    if (d < best.dist) {
      best = { id: t.id, name: t.name, dist: d };
    }
  }
  return { id: best.id, name: best.name };
}

async function getCachedWeatherTelemetry(): Promise<Incident[]> {
  const now = Date.now();
  if (cachedWeatherTelemetry.length > 0 && now - lastWeatherTelemetryAt < WEATHER_TELEMETRY_TTL_MS) {
    return cachedWeatherTelemetry;
  }

  const results: Incident[] = [];
  try {
    const weatherResults = await Promise.all(MONITORED_REGIONS.map((r) => getLiveWeatherForecast(r.lat, r.lng)));

    weatherResults.forEach((wData, idx) => {
      const reg = MONITORED_REGIONS[idx];
      if (wData && wData.current_weather) {
        const temp = wData.current_weather.temperature;
        const wind = wData.current_weather.windspeed;
        const wcode = wData.current_weather.weathercode;

        let conditionText = `Cập nhật thời tiết thực tế ${reg.name}: ${temp}°C, Gió ${wind}km/h. Điều kiện tương đối ổn định.`;
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

        if (temp < 5 || wind > 25 || wcode > 50) {
          conditionText = `Cảnh báo gió mạnh ${wind}km/h & nhiệt độ ${temp}°C tại ${reg.name}. Khuyến cáo trang bị ấm chống nước.`;
          severity = 'high';
        }

        results.push({
          id: `weather-live-${reg.id}`,
          trailId: reg.id,
          trailName: reg.name,
          userName: 'Trạm Vệ Tinh Khí Tượng Real-time (Open-Meteo)',
          userAvatar: '',
          type: 'weather',
          description: conditionText,
          severity,
          reportedAt: new Date().toISOString(),
          resolved: false,
          locationNote: `${reg.name} (${reg.lat.toFixed(4)}° N, ${reg.lng.toFixed(4)}° E)`,
          coordinates: { lat: reg.lat, lng: reg.lng },
          elevationM: reg.elev,
          verifiedBy: 'Open-Meteo Live Telemetry',
          verifiedAt: new Date().toISOString(),
          rescueContact: reg.rescue,
          images: [],
          isSynthetic: true,
        } as Incident & { isSynthetic: boolean });
      }
    });

    if (results.length > 0) {
      cachedWeatherTelemetry = results;
      lastWeatherTelemetryAt = now;
    }
  } catch (err) {
    console.warn('[Live Weather Telemetry Warning]:', (err as Error).message);
  }

  return cachedWeatherTelemetry;
}

export const getIncidents = async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 100);
  const trailFilterParam = typeof req.query.trailId === 'string' ? req.query.trailId.trim() : '';
  const includeResolved =
    String(req.query.includeResolved || '').trim().toLowerCase() === 'true' ||
    String(req.query.includeResolved || '').trim() === '1';

  let dbIncidents: any[] = [];
  const dbConnected = mongoose.connection.readyState === 1;

  if (dbConnected) {
    try {
      const dbFilter: any = includeResolved ? {} : { active: { $ne: false }, resolved: { $ne: true } };
      if (trailFilterParam) {
        const candidates: any[] = [trailFilterParam];
        const resolved = await resolveTrailByIdOrSlug(trailFilterParam);
        if (resolved) {
          candidates.push(resolved._id, String(resolved._id));
          if (resolved.id) candidates.push(resolved.id);
        }
        dbFilter.trailId = { $in: candidates };
      }

      dbIncidents = await IncidentModel.find(dbFilter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
        .exec();

      // Normalize any ObjectId trailId back to canonical slug for consistent frontend matching
      const objTrailIds = dbIncidents
        .map((i) => i.trailId)
        .filter((tid) => tid && (tid instanceof mongoose.Types.ObjectId || isValidObjectId(String(tid))));
      const trailSlugMap = new Map<string, string>();
      if (objTrailIds.length > 0) {
        const trails = await TrailModel.find({ _id: { $in: objTrailIds } }).select('_id id').lean();
        trails.forEach((t: any) => {
          if (t.id) trailSlugMap.set(String(t._id), t.id);
        });
      }

      const userIds = dbIncidents.map((i) => i.reportedBy).filter((id) => isValidObjectId(String(id || '')));
      const userMap = new Map<string, any>();
      if (userIds.length > 0) {
        const users = await UserModel.find({ _id: { $in: userIds } })
          .select('fullName username avatarUrl role')
          .lean();
        users.forEach((u: any) => userMap.set(u._id.toString(), u));
      }

      dbIncidents = dbIncidents.map((inc: any) => {
        const liveUser = inc.reportedBy && userMap.get(String(inc.reportedBy));
        const normalizedSlug = trailSlugMap.get(String(inc.trailId)) || String(inc.trailId);
        return sanitizeIncidentPII({ ...inc, trailId: normalizedSlug }, liveUser);
      });
    } catch {
      dbIncidents = [];
    }
  }

  const [liveWeatherIncidents, nasaEvents] = await Promise.all([
    getCachedWeatherTelemetry(),
    getNaturalHazardsAlerts().catch(() => []),
  ]);

  // Only include Vietnam-verified NASA EONET hazards mapped to the nearest real Vietnam trail
  const nasaIncidents: Incident[] = (nasaEvents || []).slice(0, 3).map((evt: any) => {
    const lat = Number(evt.coordinates?.[1]);
    const lng = Number(evt.coordinates?.[0]);
    const nearest = findNearestVietnamTrail(lat, lng);
    return {
      id: `nasa-${evt.id}`,
      trailId: nearest.id,
      trailName: `[Vệ Tinh NASA Việt Nam] ${evt.title}`,
      userName: 'NASA Earth Observatory EONET API',
      type: 'bad_weather',
      description: `Cảnh báo thiên tai khu vực Việt Nam từ vệ tinh NASA: ${evt.title} (${evt.category}). Tọa độ: ${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E (gần tuyến ${nearest.name}).`,
      severity: 'critical',
      resolved: false,
      reportedAt: evt.date ? String(evt.date).substring(0, 10) : new Date().toISOString(),
      locationNote: `Tọa độ Vệ tinh NASA: ${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E`,
      coordinates: { lat, lng },
      verifiedBy: 'NASA Goddard Space Flight Center',
      verifiedAt: new Date().toISOString(),
      rescueContact: '112 / 114 - Tìm kiếm Cứu nạn Khẩn cấp',
      images: [],
      isSynthetic: true,
    } as Incident & { isSynthetic: boolean };
  });

  const activeCustomIncidents = dbConnected
    ? dbIncidents
    : inMemoryIncidents
        .filter((i: any) => (includeResolved ? true : !i.resolved && i.active !== false))
        .map((i) => sanitizeIncidentPII(i));

  let merged = [...activeCustomIncidents, ...liveWeatherIncidents, ...nasaIncidents];
  if (trailFilterParam) {
    merged = merged.filter((i) => String(i.trailId) === trailFilterParam);
  }

  return res.json({
    success: true,
    count: merged.length,
    data: merged,
    source: dbConnected ? 'MongoDB Persistent & Live Open-Meteo / NASA EONET (VN)' : 'In-Memory & Live Telemetry',
  });
};

export const createIncident = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để phát cảnh báo sự cố.' });
    }

    const { trailId, trailName, type, description, severity, locationNote, coordinates, images } = req.body || {};

    if (typeof description !== 'string' || description.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Vui lòng mô tả chi tiết sự cố (ít nhất 5 ký tự).' });
    }

    if (containsProfanity(description)) {
      const matched = getProfanityMatch(description);
      return res.status(400).json({
        success: false,
        message: `Mô tả sự cố chứa từ ngữ không phù hợp ("${matched}").`,
      });
    }

    const safeType =
      typeof type === 'string' && VALID_TYPES.has(type) ? (type === 'flood' ? 'flash_flood' : type) : 'landslide';
    const safeSeverity = (typeof severity === 'string' && VALID_SEVERITIES.has(severity) ? severity : 'high') as
      | 'low'
      | 'medium'
      | 'high'
      | 'critical';

    // Look up real trail in MongoDB first (includes admin-created & community-approved trails), then mockTrails
    let matchedTrail: any = null;
    if (typeof trailId === 'string' && trailId.trim()) {
      matchedTrail = await resolveTrailByIdOrSlug(trailId.trim());
    }
    if (!matchedTrail) {
      matchedTrail = mockTrails.find((t) => t.id === trailId || t.name === trailName) || null;
    }

    const actualTrailId =
      matchedTrail?.id ||
      (typeof trailId === 'string' && trailId.trim() ? trailId.trim() : 'trail-fansipan');
    const actualTrailName = sanitizeInput(String(trailName || matchedTrail?.name || 'Tuyến đường Trekking')).slice(0, 160);

    let actualCoords = matchedTrail
      ? { lat: matchedTrail.startLat, lng: matchedTrail.startLng }
      : { lat: 16.047, lng: 108.206 };
    if (
      coordinates &&
      typeof coordinates === 'object' &&
      Number.isFinite(Number(coordinates.lat)) &&
      Number.isFinite(Number(coordinates.lng))
    ) {
      const lat = Number(coordinates.lat);
      const lng = Number(coordinates.lng);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        actualCoords = { lat, lng };
      }
    }

    let reporterName = 'Trekker Thực Địa';
    let reporterEmail = req.user?.email || '';
    let reporterAvatar = '';
    let reporterRole = req.user?.role || 'user';

    if (mongoose.connection.readyState === 1 && isValidObjectId(userId)) {
      const uDoc = await UserModel.findById(userId).select('fullName username email avatarUrl role isBanned').lean();
      if (uDoc) {
        if (uDoc.isBanned) {
          return res.status(403).json({
            success: false,
            message: 'Tài khoản của bạn đã bị khóa do vi phạm hoặc phát cảnh báo sai sự thật.',
          });
        }
        reporterName = uDoc.fullName || uDoc.username || reporterName;
        reporterEmail = uDoc.email || reporterEmail;
        reporterAvatar = uDoc.avatarUrl || '';
        reporterRole = uDoc.role || reporterRole;
      }
    }

    const safeDesc = sanitizeInput(description).slice(0, 1500);
    const safeLocationNote = sanitizeInput(String(locationNote || `Khu vực: ${actualTrailName}`)).slice(0, 200);
    const safeImages = Array.isArray(images)
      ? images.filter((u: unknown) => isSafeHttpUrl(u)).slice(0, 6)
      : [];
    const nowIso = new Date().toISOString();
    const actualRescue = matchedTrail?.rescueContact?.phone || '112 / 114 - Tìm kiếm Cứu nạn Khẩn cấp';

    const docPayload = {
      trailId: actualTrailId,
      trailName: actualTrailName,
      reportedBy: isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId,
      reporterName,
      reporterEmail,
      reporterAvatar,
      reporterRole,
      type: safeType,
      description: safeDesc,
      severity: safeSeverity,
      locationNote: safeLocationNote,
      coordinates: actualCoords,
      images: safeImages,
      active: true,
      resolved: false,
      reportedAt: nowIso,
      confirmations: 1,
      coReporters: [
        {
          userId,
          userName: reporterName,
          userAvatar: reporterAvatar,
          confirmedAt: nowIso,
          note: safeLocationNote,
        },
      ],
      timelineUpdates: [
        {
          id: `upd-${crypto.randomUUID()}`,
          userId,
          userName: reporterName,
          userAvatar: reporterAvatar,
          content: safeDesc,
          statusNote: 'Khởi tạo cảnh báo',
          createdAt: nowIso,
        },
      ],
    };

    let createdIncident: any;
    if (mongoose.connection.readyState === 1) {
      const saved = await IncidentModel.create(docPayload as any);
      createdIncident = {
        ...sanitizeIncidentPII(saved),
        userName: reporterName,
        userAvatar: reporterAvatar,
        rescueContact: actualRescue,
      };
    } else {
      createdIncident = sanitizeIncidentPII({
        ...docPayload,
        id: `inc-${crypto.randomUUID()}`,
        userName: reporterName,
        userAvatar: reporterAvatar,
        rescueContact: actualRescue,
      });
      inMemoryIncidents.unshift(createdIncident);
    }

    broadcastEvent('emergencyAlert', {
      type: 'EMERGENCY_ALERT',
      incident: createdIncident,
      message: `CẢNH BÁO NGUY HIỂM TẠI ${actualTrailName.toUpperCase()}: ${safeDesc}`,
    });

    notifyAdmins({
      sender: { id: userId, name: reporterName, avatarUrl: reporterAvatar },
      type: 'safety_alert',
      category: 'safety',
      title: `Cảnh báo nguy hiểm tại ${actualTrailName}`,
      message: `${reporterName} vừa phát cảnh báo: "${safeDesc}"`,
      link: `/#trail/${actualTrailId}`,
      relatedId: createdIncident.id,
      includeModerators: true,
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Đã phát cảnh báo nguy hiểm thành công!',
      data: createdIncident,
    });
  } catch (err) {
    console.error('[Create Incident Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi phát cảnh báo sự cố.' });
  }
};

// POST /api/incidents/:id/confirm - Atomic deduplicated verification / dispute (zero email PII leak)
export const confirmIncident = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }

    const id = String(req.params.id || '');
    const { action = 'confirm_true', note, additionalDescription, severity, reason } = req.body || {};
    const isPrivileged = req.user?.role === 'admin' || req.user?.role === 'moderator';

    let reporterName = 'Trekker Thực Địa';
    let reporterAvatar = '';
    if (mongoose.connection.readyState === 1 && isValidObjectId(userId)) {
      const uDoc = await UserModel.findById(userId).select('fullName username avatarUrl').lean();
      if (uDoc) {
        reporterName = uDoc.fullName || uDoc.username || reporterName;
        reporterAvatar = uDoc.avatarUrl || '';
      }
    }

    const nowIso = new Date().toISOString();

    if (action === 'dispute_false') {
      const disputeReason = sanitizeInput(
        String(note || additionalDescription || reason || 'Phản ánh thông tin cảnh báo không đúng thực tế.')
      ).slice(0, 600);

      let updatedIncident: any = null;
      if (mongoose.connection.readyState === 1) {
        if (!isValidObjectId(id)) {
          return res.status(400).json({ success: false, message: 'Mã sự cố không hợp lệ hoặc đây là cảnh báo vệ tinh tự động.' });
        }
        const existing = await IncidentModel.findById(id).select('reportedBy disputes').lean();
        if (!existing) {
          return res.status(404).json({ success: false, message: 'Không tìm thấy sự cố để khiếu nại.' });
        }
        if (String(existing.reportedBy) === String(userId)) {
          return res.status(400).json({ success: false, message: 'Bạn không thể tự khiếu nại cảnh báo do chính mình đăng.' });
        }

        // Atomic duplicate dispute guard
        updatedIncident = await IncidentModel.findOneAndUpdate(
          { _id: id, 'disputes.userId': { $ne: userId } },
          {
            $push: {
              disputes: {
                userId,
                userName: reporterName,
                disputedAt: nowIso,
                reason: disputeReason,
              },
              timelineUpdates: {
                id: `upd-${crypto.randomUUID()}`,
                userId,
                userName: reporterName,
                userAvatar: reporterAvatar,
                content: `Phản ánh cảnh báo SAI SỰ THẬT: "${disputeReason}"`,
                statusNote: 'Khiếu nại báo động giả',
                createdAt: nowIso,
              },
            },
          },
          { new: true }
        ).lean();

        if (!updatedIncident) {
          return res.status(400).json({ success: false, message: 'Bạn đã gửi khiếu nại cho sự cố này trước đó.' });
        }
      } else {
        const foundMem = inMemoryIncidents.find((i) => i.id === id || (i as any)._id === id);
        if (!foundMem) {
          return res.status(404).json({ success: false, message: 'Không tìm thấy sự cố để khiếu nại.' });
        }
        if (!foundMem.disputes) foundMem.disputes = [];
        if (foundMem.disputes.some((d) => String(d.userId) === String(userId))) {
          return res.status(400).json({ success: false, message: 'Bạn đã gửi khiếu nại cho sự cố này trước đó.' });
        }
        foundMem.disputes.push({ userId, userName: reporterName, disputedAt: nowIso, reason: disputeReason });
        updatedIncident = foundMem;
      }

      broadcastEvent('incidentDisputed', { incidentId: id, reporterName, reason: disputeReason });

      notifyAdmins({
        sender: { id: userId, name: reporterName, avatarUrl: reporterAvatar },
        type: 'dispute_alert',
        title: `Khiếu nại tin giả tại ${updatedIncident?.trailName || 'Cung đường'}`,
        message: `Trekker ${reporterName} phản ánh cảnh báo sự cố là tin sai sự thật: "${disputeReason}".`,
        link: '/admin?tab=incidents',
        relatedId: id,
        includeModerators: true,
      }).catch(() => {});

      return res.json({
        success: true,
        message: 'Đã tiếp nhận phản ánh cảnh báo sai sự thật. Ban Quản Trị sẽ rà soát và xử lý!',
        data: sanitizeIncidentPII(updatedIncident),
      });
    }

    // CONFIRM TRUE INCIDENT
    const confirmNote = sanitizeInput(String(additionalDescription || note || 'Đã xác nhận sự cố chính xác.')).slice(0, 600);
    const severityUpdate =
      isPrivileged && typeof severity === 'string' && VALID_SEVERITIES.has(severity) ? { severity } : {};

    let updatedIncident: any = null;
    if (mongoose.connection.readyState === 1) {
      if (!isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Mã sự cố không hợp lệ.' });
      }
      const exists = await IncidentModel.exists({ _id: id });
      if (!exists) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy sự cố để xác nhận.' });
      }

      // Atomic deduplicated confirmation
      updatedIncident = await IncidentModel.findOneAndUpdate(
        { _id: id, 'coReporters.userId': { $ne: userId } },
        {
          $inc: { confirmations: 1 },
          $push: {
            coReporters: {
              userId,
              userName: reporterName,
              userAvatar: reporterAvatar,
              confirmedAt: nowIso,
              note: confirmNote,
            },
            timelineUpdates: {
              id: `upd-${crypto.randomUUID()}`,
              userId,
              userName: reporterName,
              userAvatar: reporterAvatar,
              content: confirmNote,
              statusNote: 'Xác nhận ĐÚNG & Bổ sung thông tin',
              createdAt: nowIso,
            },
          },
          ...(Object.keys(severityUpdate).length ? { $set: severityUpdate } : {}),
        },
        { new: true }
      ).lean();

      if (!updatedIncident) {
        return res.status(400).json({ success: false, message: 'Bạn đã xác nhận sự cố này rồi.' });
      }
    } else {
      const foundMem = inMemoryIncidents.find((i) => i.id === id || (i as any)._id === id);
      if (!foundMem) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy sự cố để xác nhận.' });
      }
      if (!foundMem.coReporters) foundMem.coReporters = [];
      if (foundMem.coReporters.some((r) => String(r.userId) === String(userId))) {
        return res.status(400).json({ success: false, message: 'Bạn đã xác nhận sự cố này rồi.' });
      }
      foundMem.confirmations = (foundMem.confirmations || 1) + 1;
      foundMem.coReporters.push({
        userId,
        userName: reporterName,
        userAvatar: reporterAvatar,
        confirmedAt: nowIso,
        note: confirmNote,
      });
      if (severityUpdate.severity) foundMem.severity = severityUpdate.severity as any;
      updatedIncident = foundMem;
    }

    broadcastEvent('incidentConfirmed', {
      incidentId: id,
      confirmations: updatedIncident?.confirmations || 2,
      latestUpdate: confirmNote,
      reporterName,
    });

    return res.json({
      success: true,
      message: `Đã xác nhận thông tin đúng thành công! Sự cố hiện có ${updatedIncident?.confirmations || 2} Trekker cùng xác thực.`,
      data: sanitizeIncidentPII(updatedIncident),
    });
  } catch (err) {
    console.error('[Confirm Incident Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xác nhận hoặc khiếu nại sự cố.' });
  }
};

// PUT /api/incidents/:id/resolve - Mark incident resolved (Admin/Moderator)
export const resolveIncident = async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'moderator') {
      return res.status(403).json({ success: false, message: 'Yêu cầu quyền Admin hoặc Moderator.' });
    }
    const id = String(req.params.id || '');

    if (mongoose.connection.readyState === 1) {
      if (!isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Mã sự cố không hợp lệ.' });
      }
      const updated = await IncidentModel.findByIdAndUpdate(id, { $set: { active: false, resolved: true } });
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy sự cố.' });
      }
    } else {
      const before = inMemoryIncidents.length;
      inMemoryIncidents = inMemoryIncidents.filter((i) => i.id !== id && (i as any)._id !== id);
      if (inMemoryIncidents.length === before) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy sự cố.' });
      }
    }

    await recordAuditLog(req, 'RESOLVE_INCIDENT', 'incidents', `Đánh dấu đã xử lý sự cố ${id}`);
    broadcastEvent('incidentResolved', { id });
    return res.json({ success: true, message: 'Đã gỡ cảnh báo và đánh dấu xử lý sự cố thành công!' });
  } catch (err) {
    console.error('[Resolve Incident Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xử lý sự cố.' });
  }
};

// DELETE /api/incidents/:id - Delete incident permanently (Admin/Moderator)
export const deleteIncident = async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'moderator') {
      return res.status(403).json({ success: false, message: 'Yêu cầu quyền Admin hoặc Moderator.' });
    }
    const id = String(req.params.id || '');

    if (mongoose.connection.readyState === 1) {
      if (!isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Mã sự cố không hợp lệ.' });
      }
      const deleted = await IncidentModel.findByIdAndDelete(id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy sự cố.' });
      }
    } else {
      const before = inMemoryIncidents.length;
      inMemoryIncidents = inMemoryIncidents.filter((i) => i.id !== id && (i as any)._id !== id);
      if (inMemoryIncidents.length === before) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy sự cố.' });
      }
    }

    await recordAuditLog(req, 'DELETE_INCIDENT', 'incidents', `Xóa vĩnh viễn sự cố ${id}`);
    broadcastEvent('incidentResolved', { id });
    return res.json({ success: true, message: 'Đã xóa sự cố thành công!' });
  } catch (err) {
    console.error('[Delete Incident Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa sự cố.' });
  }
};

// PUT /api/admin/incidents/:id/dispute-resolve - Admin/Moderator resolves false alarm dispute
export const resolveDisputeIncidentAdmin = async (req: AuthRequest, res: Response) => {
  const userRole = req.user?.role;
  if (userRole !== 'admin' && userRole !== 'moderator') {
    return res.status(403).json({ success: false, message: 'Yêu cầu quyền Admin hoặc Moderator.' });
  }
  const id = String(req.params.id || '');
  const { action } = req.body || {};

  try {
    if (action === 'dismiss_incident') {
      let dismissedReporterId: string | null = null;
      if (mongoose.connection.readyState === 1) {
        if (!isValidObjectId(id)) {
          return res.status(400).json({ success: false, message: 'Mã sự cố không hợp lệ.' });
        }
        const deleted = await IncidentModel.findByIdAndDelete(id).lean();
        if (!deleted) {
          return res.status(404).json({ success: false, message: 'Không tìm thấy sự cố để gỡ bỏ.' });
        }
        if (deleted.reportedBy && isValidObjectId(String(deleted.reportedBy))) {
          dismissedReporterId = String(deleted.reportedBy);
        }
      }
      inMemoryIncidents = inMemoryIncidents.filter((i) => i.id !== id && (i as any)._id !== id);

      // Apply real penalty to confirmed false SOS reporter
      if (dismissedReporterId) {
        await deductReputationPoints(
          dismissedReporterId,
          PENALTY_POINTS.FALSE_SOS_REPORT,
          'Phát cảnh báo sự cố sai sự thật (Báo động giả)'
        );
      }

      await recordAuditLog(req, 'DISMISS_FALSE_INCIDENT', 'incidents', `Gỡ cảnh báo báo động giả ${id}`);
      broadcastEvent('incidentResolved', { id });
      return res.json({
        success: true,
        message: 'Đã chấp thuận khiếu nại: Gỡ bỏ cảnh báo sai sự thật khỏi bản đồ!',
      });
    } else {
      if (mongoose.connection.readyState === 1) {
        if (!isValidObjectId(id)) {
          return res.status(400).json({ success: false, message: 'Mã sự cố không hợp lệ.' });
        }
        const updated = await IncidentModel.findByIdAndUpdate(id, { $set: { disputes: [] } });
        if (!updated) {
          return res.status(404).json({ success: false, message: 'Không tìm thấy sự cố.' });
        }
      }
      const found = inMemoryIncidents.find((i) => i.id === id || (i as any)._id === id);
      if (found) found.disputes = [];

      await recordAuditLog(req, 'REJECT_INCIDENT_DISPUTE', 'incidents', `Bác bỏ khiếu nại sự cố ${id}`);
      return res.json({
        success: true,
        message: 'Đã bác bỏ khiếu nại: Cảnh báo sự cố là có thật và tiếp tục được duy trì trên bản đồ.',
      });
    }
  } catch (err) {
    console.error('[Resolve Dispute Admin Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xử lý khiếu nại sự cố.' });
  }
};
