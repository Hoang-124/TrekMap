import crypto from 'crypto';
import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { CustomRouteModel, CustomRouteVisibility, ICustomRouteMetrics, ICustomRouteWaypoint } from '../models/CustomRoute.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { fetchTrailDemElevation } from '../services/elevation.service.js';
import { calculateHaversineDistanceKm } from '../utils/spatial.js';
import { isValidObjectId, resolveTrailObjectId } from '../utils/resolveTrail.js';
import { sanitizeInput } from '../utils/validation.js';
import { containsProfanity, getProfanityMatch } from '../utils/profanityFilter.js';
import { invalidateCache } from '../middleware/cache.middleware.js';
import { getClientBaseUrl } from '../utils/clientUrl.js';

const MAX_ROUTES_PER_USER = 50;

function downsampleUniform<T>(items: T[], maxPoints = 60): T[] {
  if (items.length <= maxPoints) return items;
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round((i * (items.length - 1)) / (maxPoints - 1));
    out.push(items[idx]);
  }
  return out;
}

const VALID_REGIONS = new Set(['Miền Bắc', 'Miền Trung', 'Miền Nam']);
const VALID_VISIBILITIES = new Set<CustomRouteVisibility>(['private', 'unlisted', 'public']);
const VALID_WAYPOINT_TYPES = new Set([
  'campsite',
  'water',
  'viewpoint',
  'danger',
  'charging',
  'rest',
  'summit',
  'trailhead',
]);

function escapeXml(unsafe: string): string {
  return String(unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

function parseStrictFiniteNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '' || typeof val === 'boolean') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function sanitizeTrackPoints(raw: unknown): number[][] {
  if (!Array.isArray(raw)) return [];
  const out: number[][] = [];
  for (let i = 0; i < raw.length && out.length < 3000; i++) {
    const pt: any = raw[i];
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const lat = parseStrictFiniteNumber(pt[0]);
    const lng = parseStrictFiniteNumber(pt[1]);
    if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    const ele = pt.length >= 3 ? parseStrictFiniteNumber(pt[2]) : null;
    out.push(ele !== null ? [lat, lng, Math.round(ele)] : [lat, lng]);
  }
  return out;
}

function sanitizeRouteWaypoints(raw: unknown): ICustomRouteWaypoint[] {
  if (!Array.isArray(raw)) return [];
  const out: ICustomRouteWaypoint[] = [];
  for (let i = 0; i < raw.length && out.length < 100; i++) {
    const w: any = raw[i];
    if (!w || typeof w !== 'object') continue;
    const lat = parseStrictFiniteNumber(w.lat);
    const lng = parseStrictFiniteNumber(w.lng);
    if (lat === null || lng === null) continue;
    const ele = parseStrictFiniteNumber(w.elevationM);
    const idx = out.length;
    out.push({
      id: typeof w.id === 'string' && w.id.trim() ? sanitizeInput(w.id).slice(0, 40) : `wp-${idx + 1}`,
      name: sanitizeInput(String(w.name || `Mốc ${idx + 1}`)).slice(0, 120),
      type: (VALID_WAYPOINT_TYPES.has(w.type) ? w.type : 'viewpoint') as ICustomRouteWaypoint['type'],
      lat: Math.max(-90, Math.min(90, lat)),
      lng: Math.max(-180, Math.min(180, lng)),
      ...(ele !== null ? { elevationM: Math.round(ele) } : {}),
      note: sanitizeInput(String(w.note || '')).slice(0, 300),
    });
  }
  return out;
}

async function computeRouteMetrics(trackPoints: number[][]): Promise<{
  metrics: ICustomRouteMetrics;
  elevationProfile: any;
}> {
  let rawDistanceKm = 0;
  for (let i = 1; i < trackPoints.length; i++) {
    rawDistanceKm += calculateHaversineDistanceKm(
      trackPoints[i - 1][0],
      trackPoints[i - 1][1],
      trackPoints[i][0],
      trackPoints[i][1]
    );
  }
  rawDistanceKm = Math.round(rawDistanceKm * 100) / 100;

  const latLngOnly: [number, number][] = trackPoints.map((p) => [p[0], p[1]]);
  const hasExplicitEle = trackPoints.every((p) => p.length >= 3 && Number.isFinite(p[2]));

  let elevationGainM = 0;
  let elevationLossM = 0;
  let maxAltitudeM = 0;
  let minAltitudeM = 0;
  let maxSlopePercent = 0;
  let elevationProfile: any = null;

  if (hasExplicitEle) {
    let minAlt = Infinity;
    let maxAlt = -Infinity;
    let anchor = trackPoints[0][2];
    const sampledPoints: any[] = [];
    let cumKm = 0;

    for (let i = 0; i < trackPoints.length; i++) {
      const ele = trackPoints[i][2];
      if (ele < minAlt) minAlt = ele;
      if (ele > maxAlt) maxAlt = ele;
      let slope = 0;
      if (i > 0) {
        const segKm = calculateHaversineDistanceKm(
          trackPoints[i - 1][0],
          trackPoints[i - 1][1],
          trackPoints[i][0],
          trackPoints[i][1]
        );
        cumKm += segKm;
        const delta = ele - trackPoints[i - 1][2];
        if (ele - anchor >= 3) {
          elevationGainM += ele - anchor;
          anchor = ele;
        } else if (anchor - ele >= 3) {
          elevationLossM += anchor - ele;
          anchor = ele;
        }
        const segM = Math.max(25, segKm * 1000);
        slope = Math.max(-65, Math.min(65, Math.round((delta / segM) * 1000) / 10));
        if (Math.abs(slope) > maxSlopePercent) maxSlopePercent = Math.abs(slope);
      }
      sampledPoints.push({
        lat: trackPoints[i][0],
        lng: trackPoints[i][1],
        elevationM: Math.round(ele),
        distanceKm: Math.round(cumKm * 100) / 100,
        slopePercent: slope,
      });
    }
    minAltitudeM = Number.isFinite(minAlt) ? Math.round(minAlt) : 0;
    maxAltitudeM = Number.isFinite(maxAlt) ? Math.round(maxAlt) : 0;
    elevationProfile = {
      source: 'gpx-elevation',
      points: downsampleUniform(sampledPoints, 60),
      minElevationM: minAltitudeM,
      maxElevationM: maxAltitudeM,
      totalDistanceKm: rawDistanceKm,
      elevationGainM: Math.round(elevationGainM),
      maxSlopePercent,
    };
  } else {
    const hashKey = crypto
      .createHash('sha1')
      .update(`${latLngOnly[0]}:${latLngOnly[latLngOnly.length - 1]}:${latLngOnly.length}`)
      .digest('hex')
      .slice(0, 16);
    elevationProfile = await fetchTrailDemElevation({
      cacheKey: `custom-${hashKey}`,
      gpxTrack: latLngOnly,
      distanceKm: Math.max(0.1, rawDistanceKm),
      maxAltitudeM: 1200,
      elevationGainM: 400,
    });
    elevationGainM = elevationProfile.elevationGainM;
    maxAltitudeM = elevationProfile.maxElevationM;
    minAltitudeM = elevationProfile.minElevationM;
    maxSlopePercent = elevationProfile.maxSlopePercent;

    // Derive elevationLossM from profile points
    let loss = 0;
    for (let i = 1; i < elevationProfile.points.length; i++) {
      const diff = elevationProfile.points[i].elevationM - elevationProfile.points[i - 1].elevationM;
      if (diff < -3) loss += Math.abs(diff);
    }
    elevationLossM = Math.round(loss);
  }

  // Naismith's Rule calibrated for Vietnam forest trails: 4 km/h horizontal + 1h per 500m ascent
  const naismithHours = Math.round((rawDistanceKm / 4.0 + elevationGainM / 500) * 10) / 10;

  // Deterministic difficulty estimate 1..5
  const effortScore = rawDistanceKm * 1.2 + elevationGainM / 120 + (maxAltitudeM >= 2500 ? 6 : 0);
  const difficultyEstimate =
    effortScore >= 40 ? 5 : effortScore >= 26 ? 4 : effortScore >= 16 ? 3 : effortScore >= 8 ? 2 : 1;

  return {
    metrics: {
      distanceKm: rawDistanceKm,
      elevationGainM: Math.round(elevationGainM),
      elevationLossM: Math.round(elevationLossM),
      maxAltitudeM: Math.round(maxAltitudeM),
      minAltitudeM: Math.round(minAltitudeM),
      maxSlopePercent: Math.round(maxSlopePercent * 10) / 10,
      naismithHours,
      difficultyEstimate,
    },
    elevationProfile,
  };
}

// POST /api/custom-routes/analyze - Stateless GPX/Waypoint slope, DEM elevation & Naismith ETA analyzer
export const analyzeCustomRoute = async (req: Request, res: Response) => {
  try {
    const trackPoints = sanitizeTrackPoints(req.body?.trackPoints);
    if (trackPoints.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Cần ít nhất 2 tọa độ GPS hợp lệ để phân tích lộ trình.',
      });
    }

    const { metrics, elevationProfile } = await computeRouteMetrics(trackPoints);
    return res.json({
      success: true,
      data: {
        metrics,
        elevationProfile,
        pointsCount: trackPoints.length,
      },
    });
  } catch (err) {
    console.error('[Analyze Custom Route Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi phân tích lộ trình GPX.' });
  }
};

// POST /api/custom-routes - Save & share a custom route
export const createCustomRoute = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để lưu lộ trình tự vẽ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const uid = new Types.ObjectId(userId);
    const existingCount = await CustomRouteModel.countDocuments({ creatorId: uid });
    if (existingCount >= MAX_ROUTES_PER_USER) {
      return res.status(400).json({
        success: false,
        message: `Bạn đã đạt giới hạn tối đa ${MAX_ROUTES_PER_USER} lộ trình tự vẽ. Hãy xóa bớt lộ trình cũ trước khi tạo mới.`,
      });
    }

    const { title, description = '', region = 'Miền Bắc', province = '', baseTrailId, waypoints = [], trackPoints, visibility = 'unlisted' } =
      req.body || {};

    const cleanTitle = sanitizeInput(String(title || '')).slice(0, 160);
    if (cleanTitle.length < 3) {
      return res.status(400).json({ success: false, message: 'Tiêu đề lộ trình phải có ít nhất 3 ký tự.' });
    }
    const cleanDesc = sanitizeInput(String(description || '')).slice(0, 2000);
    if (containsProfanity(`${cleanTitle} ${cleanDesc}`)) {
      const matched = getProfanityMatch(`${cleanTitle} ${cleanDesc}`);
      return res.status(400).json({ success: false, message: `Nội dung lộ trình chứa từ ngữ không phù hợp ("${matched}").` });
    }

    const cleanTrack = sanitizeTrackPoints(trackPoints);
    if (cleanTrack.length < 2) {
      return res.status(400).json({ success: false, message: 'Lộ trình cần ít nhất 2 điểm tọa độ trên bản đồ.' });
    }

    const cleanWaypoints = sanitizeRouteWaypoints(waypoints);
    const { metrics } = await computeRouteMetrics(cleanTrack);
    const resolvedBaseTrailId = baseTrailId ? await resolveTrailObjectId(String(baseTrailId)) : null;

    const shareSlug = `route-${crypto.randomBytes(6).toString('hex')}`;
    const route = await CustomRouteModel.create({
      creatorId: new Types.ObjectId(userId),
      shareSlug,
      title: cleanTitle,
      description: cleanDesc,
      region: VALID_REGIONS.has(region) ? region : 'Miền Bắc',
      province: sanitizeInput(String(province || '')).slice(0, 80),
      baseTrailId: resolvedBaseTrailId || undefined,
      waypoints: cleanWaypoints,
      trackPoints: cleanTrack,
      metrics,
      visibility: VALID_VISIBILITIES.has(visibility) ? visibility : 'unlisted',
    });

    const clientUrl = getClientBaseUrl();
    if (route.visibility === 'public') {
      invalidateCache('/api/custom-routes/public');
    }

    return res.status(201).json({
      success: true,
      message: 'Đã lưu lộ trình GPX thành công!',
      data: route,
      shareUrl: `${clientUrl}/planner?route=${shareSlug}`,
    });
  } catch (err) {
    console.error('[Create Custom Route Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi lưu lộ trình tùy chỉnh.' });
  }
};

// GET /api/custom-routes/me - Current user's saved custom routes
export const getMyCustomRoutes = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const routes = await CustomRouteModel.find({ creatorId: new Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    return res.json({ success: true, count: routes.length, data: routes });
  } catch (err) {
    console.error('[Get My Custom Routes Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách lộ trình của bạn.' });
  }
};

// GET /api/custom-routes/public - Community-shared public custom routes (viewer-aware isLiked, strips likedBy)
export const getPublicCustomRoutes = async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const { region, search, sortBy = 'likes' } = req.query;
    const page = Math.min(Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1), 1000);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '18'), 10) || 18, 1), 50);
    const skip = (page - 1) * limit;
    const viewerId = req.user?.userId ? String(req.user.userId) : '';

    const filter: any = { visibility: 'public' };
    if (typeof region === 'string' && VALID_REGIONS.has(region)) {
      filter.region = region;
    }
    if (typeof search === 'string' && search.trim()) {
      const esc = search.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(esc, 'i');
      filter.$or = [{ title: rx }, { province: rx }, { description: rx }];
    }

    const sortSpec: any = sortBy === 'newest' ? { createdAt: -1 } : { likesCount: -1, viewsCount: -1, createdAt: -1 };

    const [rawRoutes, total] = await Promise.all([
      CustomRouteModel.find(filter)
        .populate('creatorId', 'username fullName avatarUrl reputationScore')
        .sort(sortSpec)
        .skip(skip)
        .limit(limit)
        .lean(),
      CustomRouteModel.countDocuments(filter),
    ]);

    const routes = rawRoutes.map((route: any) => {
      const isLiked = Boolean(
        viewerId && Array.isArray(route.likedBy) && route.likedBy.some((id: any) => String(id) === viewerId)
      );
      const { likedBy: _hidden, ...publicRoute } = route;
      return {
        ...publicRoute,
        isLiked,
        hasLiked: isLiked,
      };
    });

    if (viewerId) {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
    }

    return res.json({
      success: true,
      count: routes.length,
      pagination: { total, page, limit },
      data: routes,
    });
  } catch (err) {
    console.error('[Get Public Custom Routes Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải kho lộ trình cộng đồng.' });
  }
};

// GET /api/custom-routes/share/:shareSlug - View shared route (enforces private visibility for owner/admin only)
export const getCustomRouteByShareSlug = async (req: AuthRequest, res: Response) => {
  try {
    const shareSlug = String(req.params.shareSlug || '').trim();
    if (!shareSlug || shareSlug.length > 64) {
      return res.status(400).json({ success: false, message: 'Mã chia sẻ lộ trình không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const route: any = await CustomRouteModel.findOne({ shareSlug })
      .populate('creatorId', 'username fullName avatarUrl reputationScore')
      .lean();
    if (!route) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lộ trình này.' });
    }

    const viewerId = req.user?.userId ? String(req.user.userId) : '';
    const ownerId = String(route.creatorId?._id || route.creatorId);
    const isOwnerOrAdmin = Boolean(viewerId && (viewerId === ownerId || req.user?.role === 'admin'));

    if (route.visibility === 'private' && !isOwnerOrAdmin) {
      return res.status(403).json({ success: false, message: 'Lộ trình này đang được đặt ở chế độ riêng tư.' });
    }

    await CustomRouteModel.updateOne({ _id: route._id }, { $inc: { viewsCount: 1 } }).catch(() => {});

    const hasLiked = Boolean(
      viewerId && Array.isArray(route.likedBy) && route.likedBy.some((id: any) => String(id) === viewerId)
    );
    const { likedBy: _hidden, ...publicRoute } = route;

    return res.json({
      success: true,
      data: {
        ...publicRoute,
        viewsCount: (route.viewsCount || 0) + 1,
        hasLiked,
      },
    });
  } catch (err) {
    console.error('[Get Shared Custom Route Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải lộ trình chia sẻ.' });
  }
};

// PUT /api/custom-routes/:id - Update custom route & recompute metrics (strict owner check)
export const updateCustomRoute = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã lộ trình không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const existing = await CustomRouteModel.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lộ trình.' });
    }
    if (String(existing.creatorId) !== String(userId) && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa lộ trình này.' });
    }

    const body = req.body || {};
    const nextTitle =
      typeof body.title === 'string' && body.title.trim().length >= 3
        ? sanitizeInput(body.title).slice(0, 160)
        : existing.title;
    const nextDesc =
      typeof body.description === 'string'
        ? sanitizeInput(body.description).slice(0, 2000)
        : existing.description;

    if (containsProfanity(`${nextTitle} ${nextDesc}`)) {
      const matched = getProfanityMatch(`${nextTitle} ${nextDesc}`);
      return res.status(400).json({
        success: false,
        message: `Nội dung lộ trình chứa từ ngữ không phù hợp ("${matched}").`,
      });
    }

    existing.title = nextTitle;
    existing.description = nextDesc;
    if (typeof body.region === 'string' && VALID_REGIONS.has(body.region)) {
      existing.region = body.region as any;
    }
    if (typeof body.province === 'string') {
      existing.province = sanitizeInput(body.province).slice(0, 80);
    }
    if (typeof body.visibility === 'string' && VALID_VISIBILITIES.has(body.visibility as CustomRouteVisibility)) {
      existing.visibility = body.visibility as CustomRouteVisibility;
    }
    if (Array.isArray(body.waypoints)) {
      existing.waypoints = sanitizeRouteWaypoints(body.waypoints);
    }
    if (Array.isArray(body.trackPoints)) {
      const cleanTrack = sanitizeTrackPoints(body.trackPoints);
      if (cleanTrack.length < 2) {
        return res.status(400).json({ success: false, message: 'Lộ trình cần ít nhất 2 điểm tọa độ.' });
      }
      existing.trackPoints = cleanTrack;
      const { metrics } = await computeRouteMetrics(cleanTrack);
      existing.metrics = metrics;
    }

    await existing.save();
    invalidateCache('/api/custom-routes/public');
    return res.json({ success: true, message: 'Đã cập nhật lộ trình thành công!', data: existing });
  } catch (err) {
    console.error('[Update Custom Route Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật lộ trình.' });
  }
};

// DELETE /api/custom-routes/:id - Delete custom route (owner or admin)
export const deleteCustomRoute = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã lộ trình không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const route = await CustomRouteModel.findById(id).select('creatorId').lean();
    if (!route) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lộ trình.' });
    }
    if (String(route.creatorId) !== String(userId) && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa lộ trình này.' });
    }

    await CustomRouteModel.deleteOne({ _id: id });
    invalidateCache('/api/custom-routes/public');
    return res.json({ success: true, message: 'Đã xóa lộ trình tùy chỉnh.' });
  } catch (err) {
    console.error('[Delete Custom Route Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa lộ trình.' });
  }
};

// POST /api/custom-routes/:id/like - Atomic toggle like on public/unlisted custom route
export const toggleLikeCustomRoute = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để thích lộ trình.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã lộ trình không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const uid = new Types.ObjectId(userId);
    const added = await CustomRouteModel.findOneAndUpdate(
      { _id: id, visibility: { $ne: 'private' }, likedBy: { $ne: uid } },
      { $addToSet: { likedBy: uid }, $inc: { likesCount: 1 } },
      { new: true }
    )
      .select('likesCount')
      .lean();

    if (added) {
      invalidateCache('/api/custom-routes/public');
      return res.json({ success: true, liked: true, likesCount: added.likesCount });
    }

    const removedPositive = await CustomRouteModel.findOneAndUpdate(
      { _id: id, likedBy: uid, likesCount: { $gt: 0 } },
      { $pull: { likedBy: uid }, $inc: { likesCount: -1 } },
      { new: true }
    )
      .select('likesCount')
      .lean();

    if (removedPositive) {
      invalidateCache('/api/custom-routes/public');
      return res.json({ success: true, liked: false, likesCount: Math.max(0, removedPositive.likesCount) });
    }

    const removedZeroFloor = await CustomRouteModel.findOneAndUpdate(
      { _id: id, likedBy: uid },
      { $pull: { likedBy: uid }, $set: { likesCount: 0 } },
      { new: true }
    )
      .select('likesCount')
      .lean();

    if (removedZeroFloor) {
      invalidateCache('/api/custom-routes/public');
      return res.json({ success: true, liked: false, likesCount: 0 });
    }

    return res.status(404).json({ success: false, message: 'Không tìm thấy lộ trình.' });
  } catch (err) {
    console.error('[Toggle Like Custom Route Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật lượt thích lộ trình.' });
  }
};

// GET /api/custom-routes/share/:shareSlug/gpx - Export GPX 1.1 XML with BOTH <wpt> waypoints and <trkpt><ele>
export const exportCustomRouteGpx = async (req: AuthRequest, res: Response) => {
  try {
    const shareSlug = String(req.params.shareSlug || '').trim();
    if (!shareSlug || shareSlug.length > 64) {
      return res.status(400).json({ success: false, message: 'Mã chia sẻ lộ trình không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const route = await CustomRouteModel.findOne({ shareSlug }).lean();
    if (!route) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lộ trình.' });
    }

    const viewerId = req.user?.userId ? String(req.user.userId) : '';
    const isOwnerOrAdmin = Boolean(viewerId && (viewerId === String(route.creatorId) || req.user?.role === 'admin'));
    if (route.visibility === 'private' && !isOwnerOrAdmin) {
      return res.status(403).json({ success: false, message: 'Lộ trình này đang ở chế độ riêng tư.' });
    }

    const safeTitle = escapeXml(route.title);
    const safeDesc = escapeXml(route.description || 'Lộ trình tùy chỉnh từ LOST Vietnam');

    const wptXml = (route.waypoints || [])
      .map((w) => {
        const parsedEle = parseStrictFiniteNumber(w.elevationM);
        const ele = parsedEle !== null ? `<ele>${Math.round(parsedEle)}</ele>` : '';
        return `  <wpt lat="${w.lat}" lon="${w.lng}">${ele}<name>${escapeXml(w.name)}</name><desc>${escapeXml(w.note || '')}</desc><type>${escapeXml(w.type)}</type></wpt>`;
      })
      .join('\n');

    const trkptXml = (route.trackPoints || [])
      .map((pt) => {
        const parsedEle = pt.length >= 3 ? parseStrictFiniteNumber(pt[2]) : null;
        const ele = parsedEle !== null ? `<ele>${Math.round(parsedEle)}</ele>` : '';
        return `      <trkpt lat="${pt[0]}" lon="${pt[1]}">${ele}</trkpt>`;
      })
      .join('\n');

    const gpxXml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LOST Vietnam Route Builder - https://lost.vn" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${safeTitle}</name>
    <desc>${safeDesc}</desc>
    <time>${new Date(route.updatedAt || route.createdAt).toISOString()}</time>
  </metadata>
${wptXml ? `${wptXml}\n` : ''}  <trk>
    <name>${safeTitle}</name>
    <trkseg>
${trkptXml}
    </trkseg>
  </trk>
</gpx>`;

    res.setHeader('Content-Type', 'application/gpx+xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(route.shareSlug)}.gpx"`);
    return res.send(gpxXml);
  } catch (err) {
    console.error('[Export Custom Route GPX Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xuất file GPX lộ trình.' });
  }
};
