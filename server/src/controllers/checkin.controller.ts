import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { CheckinModel } from '../models/Checkin.js';
import { UserModel } from '../models/User.js';
import { TrailModel } from '../models/Trail.js';
import { FollowModel } from '../models/Follow.js';
import { ActivityModel } from '../models/Activity.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { resolveTrailByIdOrSlug } from '../utils/resolveTrail.js';
import { calculateHaversineDistanceKm } from '../utils/spatial.js';
import { recordActivity } from '../utils/audit.js';
import { awardReputationPoints } from '../utils/reputation.js';
import { isSafeHttpUrl, sanitizeInput } from '../utils/validation.js';
import { invalidateCache } from '../middleware/cache.middleware.js';

const VERIFIED_PROXIMITY_KM = 1.5;
const DUPLICATE_CHECKIN_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours per trail

/**
 * Checks whether a supplied GPS point or recorded GPX track passes within VERIFIED_PROXIMITY_KM
 * of the trail's real start, summit/end, or GPX track points (always preserving start & end vertices).
 */
export function verifyCheckinProximity(
  trail: { startLat: number; startLng: number; endLat?: number; endLng?: number; gpxTrack?: [number, number][] },
  lat?: number,
  lng?: number,
  gpxTrackRecorded?: [number, number][]
): { verified: boolean; minDistanceKm: number | null } {
  const referencePoints: [number, number][] = [[trail.startLat, trail.startLng]];
  if (typeof trail.endLat === 'number' && typeof trail.endLng === 'number') {
    referencePoints.push([trail.endLat, trail.endLng]);
  }
  if (Array.isArray(trail.gpxTrack) && trail.gpxTrack.length > 0) {
    const step = Math.max(1, Math.floor(trail.gpxTrack.length / 10));
    for (let i = 0; i < trail.gpxTrack.length; i += step) {
      const pt = trail.gpxTrack[i];
      if (Array.isArray(pt) && pt.length >= 2) {
        referencePoints.push([Number(pt[0]), Number(pt[1])]);
      }
    }
    const lastRef = trail.gpxTrack[trail.gpxTrack.length - 1];
    if (Array.isArray(lastRef) && lastRef.length >= 2) {
      referencePoints.push([Number(lastRef[0]), Number(lastRef[1])]);
    }
  }

  const candidatePoints: [number, number][] = [];
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    candidatePoints.push([Number(lat), Number(lng)]);
  }
  if (Array.isArray(gpxTrackRecorded) && gpxTrackRecorded.length > 0) {
    const step = Math.max(1, Math.floor(gpxTrackRecorded.length / 15));
    for (let i = 0; i < gpxTrackRecorded.length; i += step) {
      const pt = gpxTrackRecorded[i];
      if (Array.isArray(pt) && pt.length >= 2 && Number.isFinite(Number(pt[0])) && Number.isFinite(Number(pt[1]))) {
        candidatePoints.push([Number(pt[0]), Number(pt[1])]);
      }
    }
    const lastCand = gpxTrackRecorded[gpxTrackRecorded.length - 1];
    if (Array.isArray(lastCand) && lastCand.length >= 2 && Number.isFinite(Number(lastCand[0])) && Number.isFinite(Number(lastCand[1]))) {
      candidatePoints.push([Number(lastCand[0]), Number(lastCand[1])]);
    }
  }

  if (candidatePoints.length === 0) {
    return { verified: false, minDistanceKm: null };
  }

  let minDist = Infinity;
  for (const [clat, clng] of candidatePoints) {
    for (const [rlat, rlng] of referencePoints) {
      const d = calculateHaversineDistanceKm(clat, clng, rlat, rlng);
      if (d < minDist) minDist = d;
    }
  }

  const rounded = Number.isFinite(minDist) ? Math.round(minDist * 100) / 100 : null;
  return {
    verified: rounded !== null && rounded <= VERIFIED_PROXIMITY_KM,
    minDistanceKm: rounded,
  };
}

// POST /api/checkins - Verified GPS/GPX Trail Summit Check-in + Personal Logbook metadata
export const createCheckin = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để check-in cung đường.' });
    }

    const {
      trailId,
      completionTimeHours = 6,
      lat,
      lng,
      gpxTrackRecorded,
      photos = [],
      checkinDate,
      distanceRecordedKm,
      elevationGainRecordedM,
      weatherObserved,
      packWeightKg,
      notes,
      companionsCount,
      isPublic,
    } = req.body || {};

    if (!trailId || typeof trailId !== 'string') {
      return res.status(400).json({ success: false, message: 'Thiếu mã cung đường cần check-in.' });
    }

    const durationHrs = Number(completionTimeHours);
    if (!Number.isFinite(durationHrs) || durationHrs < 0.2 || durationHrs > 240) {
      return res.status(400).json({ success: false, message: 'Thời gian hoàn thành phải nằm trong khoảng 0.2 đến 240 giờ.' });
    }

    if (lat !== undefined || lng !== undefined) {
      const nLat = Number(lat);
      const nLng = Number(lng);
      if (!Number.isFinite(nLat) || !Number.isFinite(nLng) || nLat < -90 || nLat > 90 || nLng < -180 || nLng > 180) {
        return res.status(400).json({ success: false, message: 'Tọa độ GPS check-in không hợp lệ.' });
      }
    }

    let parsedDate = new Date();
    if (checkinDate) {
      const d = new Date(checkinDate);
      if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
        return res.status(400).json({ success: false, message: 'Ngày check-in không hợp lệ.' });
      }
      parsedDate = d;
    }

    const safeGpx: [number, number][] = Array.isArray(gpxTrackRecorded)
      ? gpxTrackRecorded
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
          .slice(0, 2000)
          .map((pt: any) => [Number(pt[0]), Number(pt[1])])
      : [];

    const safePhotos = Array.isArray(photos)
      ? photos.filter((u: any) => typeof u === 'string' && isSafeHttpUrl(u)).slice(0, 6)
      : [];

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng để lưu check-in.' });
    }

    const trail = await resolveTrailByIdOrSlug(trailId);
    if (!trail) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường này.' });
    }

    const uid = new Types.ObjectId(userId);

    // Block rapid duplicate check-in spam on the same trail (12-hour cooldown)
    const recentDuplicate = await CheckinModel.findOne({
      userId: uid,
      trailId: trail._id,
      createdAt: { $gte: new Date(Date.now() - DUPLICATE_CHECKIN_COOLDOWN_MS) },
    }).lean();
    if (recentDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'Bạn vừa check-in cung đường này trong 12 giờ qua.',
      });
    }

    const proximity = verifyCheckinProximity(
      trail,
      lat !== undefined ? Number(lat) : undefined,
      lng !== undefined ? Number(lng) : undefined,
      safeGpx
    );

    const existingForTrail = await CheckinModel.findOne({ userId: uid, trailId: trail._id }).lean();

    const checkin = await CheckinModel.create({
      userId: uid,
      trailId: trail._id,
      checkinDate: parsedDate,
      completionTimeHours: durationHrs,
      photos: safePhotos,
      gpxTrackRecorded: safeGpx,
      verifiedBadge: proximity.verified,
      ...(Number.isFinite(Number(distanceRecordedKm)) && Number(distanceRecordedKm) > 0
        ? { distanceRecordedKm: Math.min(500, Number(distanceRecordedKm)) }
        : {}),
      ...(Number.isFinite(Number(elevationGainRecordedM)) && Number(elevationGainRecordedM) >= 0
        ? { elevationGainRecordedM: Math.min(30000, Number(elevationGainRecordedM)) }
        : {}),
      ...(typeof weatherObserved === 'string' && weatherObserved.trim()
        ? { weatherObserved: sanitizeInput(weatherObserved).slice(0, 160) }
        : {}),
      ...(Number.isFinite(Number(packWeightKg)) && Number(packWeightKg) >= 0
        ? { packWeightKg: Math.min(60, Number(packWeightKg)) }
        : {}),
      ...(typeof notes === 'string' && notes.trim() ? { notes: sanitizeInput(notes).slice(0, 1500) } : {}),
      ...(Number.isFinite(Number(companionsCount)) && Number(companionsCount) >= 1
        ? { companionsCount: Math.min(100, Math.round(Number(companionsCount))) }
        : {}),
      isPublic: typeof isPublic === 'boolean' ? isPublic : false,
    });
    const isPublicCheckin = typeof isPublic === 'boolean' ? isPublic : false;

    invalidateCache('/api/challenges/leaderboard');
    invalidateCache('/api/trails/stats');

    // Update User checkedInTrails, award reputation via reputation engine on first check-in, & unlock earned badges
    const unlockedBadges: string[] = [];
    let pointsAwarded = 0;

    if (!existingForTrail) {
      pointsAwarded = proximity.verified ? 30 : 15;
      const repReward = await awardReputationPoints(
        userId,
        pointsAwarded,
        `Check-in chinh phục ${trail.name}`
      );
      if (repReward?.newBadgesEarned?.length) {
        unlockedBadges.push(...repReward.newBadgesEarned);
      }
    }

    await UserModel.updateOne({ _id: uid }, { $addToSet: { checkedInTrails: trail._id } });

    const [user, allUserCheckins] = await Promise.all([
      UserModel.findById(uid).select('badges').lean(),
      CheckinModel.find({ userId: uid }).populate('trailId', 'distanceKm maxAltitudeM id name').lean(),
    ]);

    if (user) {
      const existingBadges = new Set(user.badges || []);
      const newSpecialBadges: string[] = [];

      const trailNameLower = (trail.name || '').toLowerCase();
      if (
        (trail.id === 'trail-fansipan' || trailNameLower.includes('fansipan')) &&
        !existingBadges.has('Fansipan Peak Conqueror')
      ) {
        newSpecialBadges.push('Fansipan Peak Conqueror');
      }

      const seenTrails = new Set<string>();
      let uniqueKm = 0;
      let highestPeakM = 0;
      for (const c of allUserCheckins as any[]) {
        const tid = String(c.trailId?._id || c.trailId || '');
        if (tid && !seenTrails.has(tid)) {
          seenTrails.add(tid);
          uniqueKm += Number(c.trailId?.distanceKm) || 0;
          const alt = Number(c.trailId?.maxAltitudeM) || 0;
          if (alt > highestPeakM) highestPeakM = alt;
        }
      }

      // Authentic Alpine Master threshold: >= 3 unique trails OR summit >= 2800m
      if ((seenTrails.size >= 3 || highestPeakM >= 2800) && !existingBadges.has('Alpine Master')) {
        newSpecialBadges.push('Alpine Master');
      }

      if (uniqueKm >= 100 && !existingBadges.has('Ultra Trail Pioneer')) {
        newSpecialBadges.push('Ultra Trail Pioneer');
      }

      if (newSpecialBadges.length > 0) {
        await UserModel.updateOne({ _id: uid }, { $addToSet: { badges: { $each: newSpecialBadges } } });
        unlockedBadges.push(...newSpecialBadges);
      }
    }

    if (isPublicCheckin) {
      await recordActivity({
        userId: uid,
        type: 'completed_trip',
        title: `Đã check-in chinh phục ${trail.name}${proximity.verified ? ' (Xác thực GPS)' : ''}`,
        targetType: 'trail',
        targetId: trail.id || String(trail._id),
        thumbnailUrl: trail.coverImage,
      });
    }

    for (const badgeName of unlockedBadges) {
      await recordActivity({
        userId: uid,
        type: 'earned_badge',
        title: `Mở khóa huy hiệu "${badgeName}"`,
        targetType: 'badge',
        targetId: badgeName,
      });
    }

    const pointsNote = pointsAwarded > 0 ? ` (+${pointsAwarded} điểm uy tín)` : '';

    return res.status(201).json({
      success: true,
      message: proximity.verified
        ? `Check-in xác thực GPS thành công tại ${trail.name}!${pointsNote}`
        : `Đã lưu nhật ký check-in tại ${trail.name}!${pointsNote}`,
      unlockedBadges,
      data: {
        checkin,
        verifiedBadge: proximity.verified,
        verifiedByGps: proximity.verified,
        minDistanceKm: proximity.minDistanceKm,
        unlockedBadges,
      },
    });
  } catch (err) {
    console.error('[Create Checkin Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi ghi nhận check-in.' });
  }
};

// GET /api/checkins/me - List current user's check-ins
export const getMyCheckins = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, data: [] });
    }
    const items = await CheckinModel.find({ userId: new Types.ObjectId(userId) })
      .populate('trailId', 'id name province region distanceKm elevationGainM maxAltitudeM difficultyLevel coverImage')
      .sort({ checkinDate: -1 })
      .lean();
    return res.json({ success: true, count: items.length, data: items });
  } catch (err) {
    console.error('[Get My Checkins Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách check-in.' });
  }
};

// GET /api/checkins/leaderboard - Top Summit Conquerors Leaderboard (deduplicated per unique (userId, trailId)!)
export const getSummitLeaderboard = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '15'), 10) || 15, 1), 50);
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, data: [] });
    }

    const rows = await CheckinModel.aggregate([
      // Step 1: Deduplicate by (userId, trailId) so repeated check-ins cannot inflate unique km/peaks
      {
        $group: {
          _id: { userId: '$userId', trailId: '$trailId' },
          anyVerified: { $max: { $cond: ['$verifiedBadge', 1, 0] } },
          visitsCount: { $sum: 1 },
          lastCheckinAt: { $max: '$checkinDate' },
        },
      },
      {
        $lookup: {
          from: 'trails',
          localField: '_id.trailId',
          foreignField: '_id',
          as: 'trail',
        },
      },
      { $unwind: { path: '$trail', preserveNullAndEmptyArrays: true } },
      // Step 2: Aggregate unique trails per user
      {
        $group: {
          _id: '$_id.userId',
          trailsConquered: { $sum: 1 },
          totalCheckins: { $sum: '$visitsCount' },
          verifiedCheckins: { $sum: '$anyVerified' },
          totalDistanceKm: { $sum: { $ifNull: ['$trail.distanceKm', 0] } },
          totalElevationGainM: { $sum: { $ifNull: ['$trail.elevationGainM', 0] } },
          highestAltitudeM: { $max: { $ifNull: ['$trail.maxAltitudeM', 0] } },
          lastCheckinAt: { $max: '$lastCheckinAt' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      { $match: { 'user.isBanned': { $ne: true } } },
      {
        $project: {
          userId: { $toString: '$_id' },
          fullName: '$user.fullName',
          username: '$user.username',
          avatarUrl: '$user.avatarUrl',
          reputationScore: { $ifNull: ['$user.reputationScore', 0] },
          badges: { $ifNull: ['$user.badges', []] },
          trailsConquered: 1,
          totalCheckins: 1,
          verifiedCheckins: 1,
          totalDistanceKm: { $round: ['$totalDistanceKm', 1] },
          totalElevationGainM: { $round: ['$totalElevationGainM', 0] },
          highestAltitudeM: 1,
          lastCheckinAt: 1,
        },
      },
      { $sort: { trailsConquered: -1, highestAltitudeM: -1, totalDistanceKm: -1, reputationScore: -1 } },
      { $limit: limit },
    ]);

    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('[Summit Leaderboard Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải bảng xếp hạng chinh phục đỉnh.' });
  }
};

// GET /api/activities/me - Current user's real activity timeline (honors ?limit=)
export const getMyActivities = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, data: [] });
    }
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '30'), 10) || 30, 1), 100);
    const activities = await ActivityModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return res.json({ success: true, count: activities.length, data: activities });
  } catch (err) {
    console.error('[Get Activities Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải nhật ký hoạt động.' });
  }
};

// GET /api/activities/community?scope=all|following&limit=25&page=1 - Public / Following Community Social Activity Feed
export const getCommunityActivities = async (req: AuthRequest, res: Response) => {
  try {
    const scope = req.query.scope === 'following' ? 'following' : 'all';
    const page = Math.min(Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1), 200);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '25'), 10) || 25, 1), 50);
    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        scope,
        count: 0,
        data: [],
        pagination: { total: 0, page, limit, totalPages: 0, hasMore: false },
      });
    }

    const bannedUsers = await UserModel.find({ isBanned: true }).select('_id').lean();
    const bannedIdSet = new Set(bannedUsers.map((u) => String(u._id)));

    const matchStage: Record<string, any> = { isPublic: { $ne: false } };

    if (scope === 'following') {
      const viewerId = req.user?.userId;
      if (!viewerId || !Types.ObjectId.isValid(viewerId)) {
        return res.json({
          success: true,
          scope,
          count: 0,
          data: [],
          pagination: { total: 0, page, limit, totalPages: 0, hasMore: false },
        });
      }
      const follows = await FollowModel.find({ followerId: new Types.ObjectId(viewerId) })
        .select('followingId')
        .lean();
      const followingIds = follows
        .map((f) => f.followingId)
        .filter((fid) => !bannedIdSet.has(String(fid)));
      if (followingIds.length === 0) {
        return res.json({
          success: true,
          scope,
          count: 0,
          data: [],
          pagination: { total: 0, page, limit, totalPages: 0, hasMore: false },
        });
      }
      matchStage.userId = { $in: followingIds };
    } else if (bannedUsers.length > 0) {
      matchStage.userId = { $nin: bannedUsers.map((u) => u._id) };
    }

    // Indexed $match + $sort + $skip + $limit BEFORE populating authors (eliminates O(N) full-collection $lookup)
    const [total, rawDocs] = await Promise.all([
      ActivityModel.countDocuments(matchStage),
      ActivityModel.find(matchStage)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName username avatarUrl reputationScore role isBanned')
        .lean(),
    ]);

    const rawItems: any[] = (rawDocs as any[])
      .filter((doc) => doc.userId && typeof doc.userId === 'object' && !doc.userId.isBanned)
      .map((doc) => ({
        _id: doc._id,
        type: doc.type,
        title: doc.title,
        targetType: doc.targetType,
        targetId: doc.targetId,
        thumbnailUrl: doc.thumbnailUrl,
        createdAt: doc.createdAt,
        author: {
          _id: doc.userId._id,
          fullName: doc.userId.fullName,
          username: doc.userId.username,
          avatarUrl: doc.userId.avatarUrl || '',
          reputationScore: doc.userId.reputationScore ?? 0,
          role: doc.userId.role || 'user',
        },
      }));

    // Batch-resolve linked trail metadata in ONE single query (zero N+1)
    const trailTargetIds = Array.from(
      new Set(
        rawItems
          .filter((a) => a.targetType === 'trail' && typeof a.targetId === 'string' && a.targetId.trim())
          .map((a) => a.targetId.trim())
      )
    );
    const trailMap = new Map<string, any>();
    if (trailTargetIds.length > 0) {
      const objIds = trailTargetIds
        .filter((s) => /^[a-fA-F0-9]{24}$/.test(s))
        .map((s) => new Types.ObjectId(s));
      const trails = await TrailModel.find({
        status: 'approved',
        $or: [{ id: { $in: trailTargetIds } }, ...(objIds.length > 0 ? [{ _id: { $in: objIds } }] : [])],
      })
        .select('id name province region maxAltitudeM difficultyLevel distanceKm coverImage')
        .lean();
      for (const t of trails) {
        if (t.id) trailMap.set(String(t.id), t);
        trailMap.set(String(t._id), t);
      }
    }

    const formatted = rawItems.map((item) => {
      const linkedTrail = item.targetType === 'trail' && item.targetId ? trailMap.get(String(item.targetId)) || null : null;
      return {
        _id: String(item._id),
        type: item.type,
        title: item.title,
        targetType: item.targetType,
        targetId: item.targetId,
        thumbnailUrl: item.thumbnailUrl || linkedTrail?.coverImage || '',
        createdAt: item.createdAt,
        author: {
          ...item.author,
          _id: String(item.author._id),
        },
        userId: {
          ...item.author,
          _id: String(item.author._id),
        },
        trail: linkedTrail
          ? {
              id: linkedTrail.id || String(linkedTrail._id),
              name: linkedTrail.name,
              province: linkedTrail.province,
              region: linkedTrail.region,
              maxAltitudeM: linkedTrail.maxAltitudeM,
              difficultyLevel: linkedTrail.difficultyLevel,
              distanceKm: linkedTrail.distanceKm,
              coverImage: linkedTrail.coverImage,
            }
          : null,
      };
    });

    const totalPages = Math.ceil(total / limit);
    const hasMore = skip + formatted.length < total;

    return res.json({
      success: true,
      scope,
      count: formatted.length,
      data: formatted,
      pagination: { total, page, limit, totalPages, hasMore },
    });
  } catch (err) {
    console.error('[Get Community Activities Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải bảng tin hoạt động cộng đồng.' });
  }
};

// GET /api/admin/audit-logs - Paginated Admin Audit Logs (Admin only)
export const getAuditLogsAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Yêu cầu quyền Admin.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, data: [] });
    }
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200);
    const logs = await AuditLogModel.find()
      .populate('userId', 'fullName username email role')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    console.error('[Get Audit Logs Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải nhật ký kiểm toán.' });
  }
};
