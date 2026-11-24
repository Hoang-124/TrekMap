import { Response } from 'express';
import mongoose from 'mongoose';
import { ReviewModel } from '../models/Review.js';
import { TrailPoiModel, type TrailPoiStatus } from '../models/TrailPoi.js';
import { LiveBeaconModel } from '../models/LiveBeacon.js';
import { TrailModel } from '../models/Trail.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { isValidObjectId } from '../utils/resolveTrail.js';

const STALE_SIGNAL_MINUTES = 45;
const VALID_POI_STATUSES = new Set<TrailPoiStatus>(['active', 'dry_or_closed']);

function isStaffRole(req: AuthRequest): boolean {
  return req.user?.role === 'admin' || req.user?.role === 'moderator';
}

// GET /api/admin/reviews - Recent 100 reviews populated with user & trail context (Admin + Moderator)
export const getAdminReviews = async (req: AuthRequest, res: Response) => {
  try {
    if (!isStaffRole(req)) {
      return res.status(403).json({ success: false, message: 'Yêu cầu quyền Admin hoặc Moderator.' });
    }
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: 0, total: 0, data: [] });
    }

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 200);

    const [reviews, total] = await Promise.all([
      ReviewModel.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userId', 'fullName email avatarUrl username role')
        .populate('trailId', 'id name province region')
        .lean()
        .exec(),
      ReviewModel.countDocuments(),
    ]);

    return res.json({
      success: true,
      count: reviews.length,
      total,
      data: reviews,
    });
  } catch (err) {
    console.error('[Get Admin Reviews Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách đánh giá cung đường.' });
  }
};

// GET /api/admin/pois - Recent 100 crowdsourced Trail POIs with author & trail context (Admin + Moderator)
export const getAdminPois = async (req: AuthRequest, res: Response) => {
  try {
    if (!isStaffRole(req)) {
      return res.status(403).json({ success: false, message: 'Yêu cầu quyền Admin hoặc Moderator.' });
    }
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: 0, total: 0, data: [] });
    }

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 200);
    const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const filter: Record<string, unknown> = {};
    if (rawStatus && VALID_POI_STATUSES.has(rawStatus as TrailPoiStatus)) {
      filter.status = rawStatus;
    }

    const [pois, total] = await Promise.all([
      TrailPoiModel.find(filter)
        .select('-upvotes')
        .populate('userId', 'fullName email avatarUrl username role')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
        .exec(),
      TrailPoiModel.countDocuments(filter),
    ]);

    const uniqueTrailIds = Array.from(
      new Set(
        pois
          .map((p: any) => String(p.trailId || '').trim())
          .filter((v): v is string => Boolean(v))
      )
    );

    const trailMap = new Map<string, { id: string; name: string; province: string; region?: string }>();
    if (uniqueTrailIds.length > 0) {
      const validOids = uniqueTrailIds.filter((tid) => isValidObjectId(tid));
      const orClauses: Record<string, unknown>[] = [{ id: { $in: uniqueTrailIds } }];
      if (validOids.length > 0) {
        orClauses.push({ _id: { $in: validOids } });
      }
      const trails = await TrailModel.find({ $or: orClauses })
        .select('id name province region')
        .lean()
        .exec();

      for (const t of trails as any[]) {
        const summary = {
          id: String(t.id || t._id),
          name: String(t.name || ''),
          province: String(t.province || ''),
          region: t.region ? String(t.region) : undefined,
        };
        if (t.id) trailMap.set(String(t.id), summary);
        if (t._id) trailMap.set(String(t._id), summary);
      }
    }

    const enriched = pois.map((poi: any) => {
      const trailCtx = trailMap.get(String(poi.trailId || '')) || null;
      return {
        ...poi,
        trail: trailCtx,
        trailName: trailCtx?.name || String(poi.trailId || ''),
        trailProvince: trailCtx?.province || '',
      };
    });

    return res.json({
      success: true,
      count: enriched.length,
      total,
      data: enriched,
    });
  } catch (err) {
    console.error('[Get Admin POIs Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách điểm thực địa (POI).' });
  }
};

// GET /api/admin/live-beacons - Active & SOS LiveBeacons sorted sos first then lastPingAt desc (Admin + Moderator)
export const getAdminLiveBeacons = async (req: AuthRequest, res: Response) => {
  try {
    if (!isStaffRole(req)) {
      return res.status(403).json({ success: false, message: 'Yêu cầu quyền Admin hoặc Moderator.' });
    }
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: 0, sosCount: 0, activeCount: 0, data: [] });
    }

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 200);
    const now = new Date();

    const beacons = await LiveBeaconModel.find({
      status: { $in: ['active', 'sos'] },
      $or: [{ expiresAt: { $gt: now } }, { expiresAt: { $exists: false } }],
    })
      .populate('userId', 'fullName username email phone avatarUrl emergencyContact')
      .select('-__v')
      .sort({ status: -1, updatedAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    const nowMs = now.getTime();
    const enriched = beacons.map((b: any) => {
      const { breadcrumbs, ...rest } = b;
      const lastPingRaw = b.lastPosition?.recordedAt || b.updatedAt || b.createdAt;
      const lastPingMs = lastPingRaw ? new Date(lastPingRaw).getTime() : nowMs;
      const minutesSinceLastPing = Math.max(0, Math.floor((nowMs - lastPingMs) / 60_000));
      return {
        ...rest,
        lastPingAt: new Date(lastPingMs).toISOString(),
        minutesSinceLastPing,
        isSignalStale: minutesSinceLastPing > STALE_SIGNAL_MINUTES,
        breadcrumbsCount: Array.isArray(breadcrumbs) ? breadcrumbs.length : 0,
        sharePath: `/beacon/${b.token}`,
      };
    });

    // Strict priority: 'sos' first, then most recent lastPingAt descending
    enriched.sort((a: any, b: any) => {
      const pa = a.status === 'sos' ? 0 : 1;
      const pb = b.status === 'sos' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return new Date(b.lastPingAt).getTime() - new Date(a.lastPingAt).getTime();
    });

    const sosCount = enriched.filter((b: any) => b.status === 'sos').length;
    const activeCount = enriched.filter((b: any) => b.status === 'active').length;

    return res.json({
      success: true,
      count: enriched.length,
      sosCount,
      activeCount,
      data: enriched,
    });
  } catch (err) {
    console.error('[Get Admin Live Beacons Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách Live Beacon đang hoạt động.' });
  }
};
