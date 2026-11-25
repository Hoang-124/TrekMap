import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { TrailPoiModel, type ITrailPoi, type TrailPoiCategory, type TrailPoiStatus } from '../models/TrailPoi.js';
import { TrailModel } from '../models/Trail.js';
import { IncidentModel } from '../models/Incident.js';
import { TripPlanModel } from '../models/TripPlan.js';
import { CheckinModel } from '../models/Checkin.js';
import { UserModel } from '../models/User.js';
import { mockTrails, mockIncidents } from '../data/seedData.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { resolveTrailByIdOrSlug } from '../utils/resolveTrail.js';
import { sanitizeInput } from '../utils/validation.js';
import { containsProfanity, getProfanityMatch } from '../utils/profanityFilter.js';

const VALID_POI_CATEGORIES = new Set<TrailPoiCategory>(['water', 'camp', 'signal', 'danger', 'viewpoint']);
const VALID_POI_STATUSES = new Set<TrailPoiStatus>(['active', 'dry_or_closed']);
const MAX_POIS_PER_TRAIL = 50;
const VN_LAT_MIN = 8;
const VN_LAT_MAX = 24;
const VN_LNG_MIN = 102;
const VN_LNG_MAX = 110;
const TRAIL_ID_REGEX = /^[a-zA-Z0-9_-]{2,80}$/;
const STRICT_OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;
const STRICT_NUM_STRING_REGEX = /^-?\d+(\.\d+)?$/;

export interface TrailPoiItem {
  _id: string;
  trailId: string;
  userId: string;
  authorName: string;
  category: TrailPoiCategory;
  title: string;
  notes: string;
  lat: number;
  lng: number;
  elevationM: number | null;
  status: TrailPoiStatus;
  upvoteCount: number;
  hasUpvoted: boolean;
  lastConfirmedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformPulseTrendingTrail {
  id: string;
  name: string;
  province: string;
  maxAltitudeM: number;
  activityScore: number;
}

export interface PlatformPulseData {
  totalTrails: number;
  activeIncidentsCount: number;
  openTripsCount: number;
  verifiedPoisCount: number;
  totalCommunityDistanceKm: number;
  totalCheckinsCount: number;
  trendingTrails: PlatformPulseTrendingTrail[];
}

interface PlatformPulseCache {
  fetchedAt: string;
  fetchedAtMs: number;
  data: PlatformPulseData;
}

const PULSE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PULSE_STALE_GRACE_MS = 30 * 60 * 1000; // 30 minutes stale grace on transient DB outage
let platformPulseCache: PlatformPulseCache | null = null;
let platformPulseInFlight: Promise<PlatformPulseCache | null> | null = null;
let pulseCacheEpoch = 0;

function invalidatePlatformPulseCache() {
  pulseCacheEpoch += 1;
  platformPulseCache = null;
  platformPulseInFlight = null;
}

function parseStrictFiniteNumber(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || !STRICT_NUM_STRING_REGEX.test(trimmed)) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function resolveApprovedTrail(rawTrailId: string): Promise<{ id: string; name: string } | null> {
  if (!rawTrailId || !TRAIL_ID_REGEX.test(rawTrailId)) return null;
  if (mongoose.connection.readyState === 1) {
    const dbTrail: any = await resolveTrailByIdOrSlug(rawTrailId).catch(() => null);
    if (!dbTrail || (dbTrail.status && dbTrail.status !== 'approved')) return null;
    return { id: String(dbTrail.id || dbTrail._id), name: String(dbTrail.name || rawTrailId) };
  }
  const seed = mockTrails.find((t) => t.id === rawTrailId);
  return seed ? { id: seed.id, name: seed.name } : null;
}

function serializePoi(doc: Partial<ITrailPoi> & { _id: any }, viewerUserId?: string): TrailPoiItem {
  const upvotes = Array.isArray(doc.upvotes) ? doc.upvotes : [];
  const hasUpvoted = Boolean(viewerUserId && upvotes.some((u) => String(u) === viewerUserId));
  return {
    _id: String(doc._id),
    trailId: String(doc.trailId || ''),
    userId: String(doc.userId || ''),
    authorName: String(doc.authorName || 'Trekker LOST'),
    category: doc.category as TrailPoiCategory,
    title: String(doc.title || ''),
    notes: String(doc.notes || ''),
    lat: Number(doc.lat),
    lng: Number(doc.lng),
    elevationM:
      typeof doc.elevationM === 'number' && Number.isFinite(doc.elevationM) ? Math.round(doc.elevationM) : null,
    status: (doc.status === 'dry_or_closed' ? 'dry_or_closed' : 'active') as TrailPoiStatus,
    upvoteCount: Math.max(0, Number(doc.upvoteCount) || 0),
    hasUpvoted,
    lastConfirmedAt: doc.lastConfirmedAt
      ? new Date(doc.lastConfirmedAt).toISOString()
      : doc.createdAt
        ? new Date(doc.createdAt).toISOString()
        : new Date().toISOString(),
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
  };
}

// GET /api/trail-pois/trail/:trailId?category= - Public/auth-aware list of verified field POIs for an approved trail (zero PII)
export const getTrailPoisByTrail = async (req: AuthRequest, res: Response) => {
  try {
    const rawTrailId = String(req.params.trailId || '').trim();
    if (!rawTrailId || !TRAIL_ID_REGEX.test(rawTrailId)) {
      return res.status(400).json({ success: false, message: 'Mã cung đường không hợp lệ.' });
    }
    const trail = await resolveApprovedTrail(rawTrailId);
    if (!trail) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường đã duyệt.' });
    }

    if (Array.isArray(req.query.category)) {
      return res.status(400).json({ success: false, message: 'Chỉ chấp nhận một danh mục điểm thực địa mỗi lần lọc.' });
    }
    if (req.query.category !== undefined && typeof req.query.category !== 'string') {
      return res.status(400).json({ success: false, message: 'Danh mục điểm thực địa không hợp lệ.' });
    }

    const rawCategory = typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : '';
    let categoryFilter: TrailPoiCategory | undefined;
    if (rawCategory && rawCategory !== 'all') {
      if (!VALID_POI_CATEGORIES.has(rawCategory as TrailPoiCategory)) {
        return res.status(400).json({ success: false, message: 'Danh mục điểm thực địa không hợp lệ.' });
      }
      categoryFilter = rawCategory as TrailPoiCategory;
    }

    if (mongoose.connection.readyState !== 1) {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.json({ success: true, count: 0, maxPerTrail: MAX_POIS_PER_TRAIL, data: [] });
    }

    const query: Record<string, any> = { trailId: trail.id };
    if (categoryFilter) query.category = categoryFilter;

    const viewerId = req.user?.userId;
    const hasValidViewer = Boolean(viewerId && Types.ObjectId.isValid(viewerId));

    // Avoid transferring full upvotes[] arrays: omit entirely for guests, $elemMatch single viewer for signed-in users
    const projection: Record<string, any> = hasValidViewer
      ? {
          trailId: 1,
          userId: 1,
          authorName: 1,
          category: 1,
          title: 1,
          notes: 1,
          lat: 1,
          lng: 1,
          elevationM: 1,
          status: 1,
          upvoteCount: 1,
          lastConfirmedAt: 1,
          createdAt: 1,
          updatedAt: 1,
          upvotes: { $elemMatch: { $eq: new Types.ObjectId(viewerId!) } },
        }
      : { upvotes: 0 };

    const docs = await TrailPoiModel.find(query, projection)
      .sort({ upvoteCount: -1, updatedAt: -1 })
      .limit(MAX_POIS_PER_TRAIL)
      .lean();

    const data = docs.map((d: any) => serializePoi(d, hasValidViewer ? viewerId : undefined));

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.json({
      success: true,
      count: data.length,
      maxPerTrail: MAX_POIS_PER_TRAIL,
      data,
    });
  } catch (err) {
    console.error('[Get Trail POIs Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải điểm thực địa của cung đường.' });
  }
};

// POST /api/trail-pois - Report a new crowdsourced field POI (water, camp, signal, danger, viewpoint)
export const createTrailPoi = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để báo điểm thực địa mới.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const body = req.body || {};
    const rawTrailId = typeof body.trailId === 'string' ? body.trailId.trim() : '';
    if (!rawTrailId || !TRAIL_ID_REGEX.test(rawTrailId)) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã cung đường hợp lệ.' });
    }
    const trail = await resolveApprovedTrail(rawTrailId);
    if (!trail) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường đã duyệt để gắn điểm thực địa.' });
    }

    const rawCategory = typeof body.category === 'string' ? body.category.trim().toLowerCase() : '';
    if (!VALID_POI_CATEGORIES.has(rawCategory as TrailPoiCategory)) {
      return res.status(400).json({
        success: false,
        message: 'Danh mục phải là một trong: water, camp, signal, danger, viewpoint.',
      });
    }

    if (typeof body.title !== 'string') {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tiêu đề điểm thực địa (3–120 ký tự).' });
    }
    const cleanTitle = sanitizeInput(body.title).trim().slice(0, 120);
    if (cleanTitle.length < 3) {
      return res.status(400).json({ success: false, message: 'Tiêu đề điểm thực địa phải từ 3 đến 120 ký tự.' });
    }

    let cleanNotes = '';
    if (body.notes !== undefined && body.notes !== null) {
      if (typeof body.notes !== 'string') {
        return res.status(400).json({ success: false, message: 'Ghi chú điểm thực địa không hợp lệ.' });
      }
      cleanNotes = sanitizeInput(body.notes).trim().slice(0, 500);
    }

    if (containsProfanity(`${cleanTitle} ${cleanNotes}`)) {
      const matched = getProfanityMatch(`${cleanTitle} ${cleanNotes}`);
      return res.status(400).json({
        success: false,
        message: `Nội dung điểm thực địa chứa từ ngữ không phù hợp ("${matched}").`,
      });
    }

    const lat = parseStrictFiniteNumber(body.lat);
    const lng = parseStrictFiniteNumber(body.lng);
    if (
      lat === null ||
      lng === null ||
      lat < VN_LAT_MIN ||
      lat > VN_LAT_MAX ||
      lng < VN_LNG_MIN ||
      lng > VN_LNG_MAX
    ) {
      return res.status(400).json({
        success: false,
        message: `Tọa độ phải nằm trong phạm vi lãnh thổ Việt Nam (lat ${VN_LAT_MIN}..${VN_LAT_MAX}, lng ${VN_LNG_MIN}..${VN_LNG_MAX}).`,
      });
    }

    let elevationM: number | null = null;
    if (body.elevationM !== undefined && body.elevationM !== null && body.elevationM !== '') {
      const parsedElev = parseStrictFiniteNumber(body.elevationM);
      if (parsedElev === null || parsedElev < 0 || parsedElev > 3500) {
        return res.status(400).json({ success: false, message: 'Cao độ điểm thực địa phải từ 0 đến 3.500m.' });
      }
      elevationM = Math.round(parsedElev);
    }

    let status: TrailPoiStatus = 'active';
    if (body.status !== undefined) {
      if (typeof body.status !== 'string' || !VALID_POI_STATUSES.has(body.status as TrailPoiStatus)) {
        return res.status(400).json({ success: false, message: 'Trạng thái phải là active hoặc dry_or_closed.' });
      }
      status = body.status as TrailPoiStatus;
    }

    const existingCount = await TrailPoiModel.countDocuments({ trailId: trail.id });
    if (existingCount >= MAX_POIS_PER_TRAIL) {
      return res.status(400).json({
        success: false,
        message: `Cung đường này đã đạt giới hạn tối đa ${MAX_POIS_PER_TRAIL} điểm thực địa.`,
      });
    }

    const uid = new Types.ObjectId(userId);
    const userDoc = await UserModel.findById(uid).select('fullName username').lean();
    const authorName =
      sanitizeInput(String(userDoc?.fullName || userDoc?.username || 'Trekker LOST')).slice(0, 80) || 'Trekker LOST';

    const now = new Date();
    const created = await TrailPoiModel.create({
      trailId: trail.id,
      userId: uid,
      authorName,
      category: rawCategory as TrailPoiCategory,
      title: cleanTitle,
      notes: cleanNotes,
      lat: Math.round(lat * 100_000) / 100_000,
      lng: Math.round(lng * 100_000) / 100_000,
      elevationM,
      status,
      upvotes: [],
      upvoteCount: 0,
      lastConfirmedAt: now,
    });

    // Deterministic parallel-burst cap enforcement (oldest 50 win; verify survival so trimmed ghost docs NEVER return 201)
    const orderedPois = await TrailPoiModel.find({ trailId: trail.id })
      .sort({ createdAt: 1, _id: 1 })
      .select('_id')
      .lean();
    if (orderedPois.length > MAX_POIS_PER_TRAIL) {
      const surplusIds = orderedPois.slice(MAX_POIS_PER_TRAIL).map((p) => p._id);
      await TrailPoiModel.deleteMany({ trailId: trail.id, _id: { $in: surplusIds } });
    }
    const myIdStr = String(created._id);
    const survived = orderedPois.slice(0, MAX_POIS_PER_TRAIL).some((p) => String(p._id) === myIdStr);
    if (!survived) {
      return res.status(400).json({
        success: false,
        message: `Cung đường này đã đạt giới hạn tối đa ${MAX_POIS_PER_TRAIL} điểm thực địa.`,
      });
    }

    invalidatePlatformPulseCache();
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(201).json({
      success: true,
      message: 'Đã chia sẻ điểm thực địa mới cho cộng đồng LOST!',
      data: serializePoi(created.toObject(), userId),
    });
  } catch (err) {
    console.error('[Create Trail POI Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo điểm thực địa.' });
  }
};

// POST /api/trail-pois/:id/confirm - Single atomic aggregation-pipeline toggle (zero double-click 404, guarantees upvoteCount === upvotes.length)
export const toggleConfirmTrailPoi = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để xác nhận điểm thực địa.' });
    }
    const poiId = String(req.params.id || '').trim();
    if (!STRICT_OBJECT_ID_REGEX.test(poiId)) {
      return res.status(400).json({ success: false, message: 'Mã điểm thực địa không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const uid = new Types.ObjectId(userId);
    const poiObjId = new Types.ObjectId(poiId);
    const existingPoi = await TrailPoiModel.findById(poiObjId).select('trailId').lean();
    if (!existingPoi) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy điểm thực địa.' });
    }
    const approvedTrail = await resolveApprovedTrail(String(existingPoi.trailId || ''));
    if (!approvedTrail) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường đã duyệt cho điểm thực địa này.' });
    }

    const now = new Date();
    const toggled: any = await TrailPoiModel.findOneAndUpdate(
      { _id: poiObjId },
      [
        {
          $set: {
            _wasUpvoted: { $in: [uid, { $ifNull: ['$upvotes', []] }] },
            upvotes: {
              $cond: [
                { $in: [uid, { $ifNull: ['$upvotes', []] }] },
                {
                  $filter: {
                    input: { $ifNull: ['$upvotes', []] },
                    as: 'u',
                    cond: { $ne: ['$$u', uid] },
                  },
                },
                { $setUnion: [{ $ifNull: ['$upvotes', []] }, [uid]] },
              ],
            },
          },
        },
        {
          $set: {
            upvoteCount: { $size: '$upvotes' },
            lastConfirmedAt: {
              $cond: ['$_wasUpvoted', '$lastConfirmedAt', now],
            },
          },
        },
        { $unset: '_wasUpvoted' },
      ] as any,
      { new: true, updatePipeline: true }
    )
      .select('upvoteCount lastConfirmedAt upvotes')
      .lean();

    if (!toggled) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy điểm thực địa.' });
    }

    const hasUpvoted = Array.isArray(toggled.upvotes) && toggled.upvotes.some((u: any) => String(u) === userId);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.json({
      success: true,
      hasUpvoted,
      upvoteCount: Math.max(0, Number(toggled.upvoteCount) || 0),
      lastConfirmedAt: toggled.lastConfirmedAt ? new Date(toggled.lastConfirmedAt).toISOString() : now.toISOString(),
    });
  } catch (err) {
    console.error('[Confirm Trail POI Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xác nhận điểm thực địa.' });
  }
};

// PATCH /api/trail-pois/:id/status - Update field POI status (atomic owner filter for non-staff; admin/mod allowed)
export const updateTrailPoiStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    const poiId = String(req.params.id || '').trim();
    if (!STRICT_OBJECT_ID_REGEX.test(poiId)) {
      return res.status(400).json({ success: false, message: 'Mã điểm thực địa không hợp lệ.' });
    }
    const rawStatus = req.body?.status;
    if (typeof rawStatus !== 'string' || !VALID_POI_STATUSES.has(rawStatus as TrailPoiStatus)) {
      return res.status(400).json({ success: false, message: 'Trạng thái phải là active hoặc dry_or_closed.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const poiObjId = new Types.ObjectId(poiId);
    const isStaff = role === 'admin' || role === 'moderator';
    const writeFilter = isStaff ? { _id: poiObjId } : { _id: poiObjId, userId: new Types.ObjectId(userId) };

    const updated = await TrailPoiModel.findOneAndUpdate(
      writeFilter,
      { $set: { status: rawStatus as TrailPoiStatus, lastConfirmedAt: new Date() } },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      if (!isStaff && (await TrailPoiModel.exists({ _id: poiObjId }))) {
        return res.status(403).json({ success: false, message: 'Chỉ người đăng hoặc Quản trị viên mới có quyền cập nhật trạng thái.' });
      }
      return res.status(404).json({ success: false, message: 'Không tìm thấy điểm thực địa.' });
    }

    invalidatePlatformPulseCache();
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.json({
      success: true,
      message:
        rawStatus === 'active'
          ? 'Đã cập nhật điểm thực địa: Còn hoạt động.'
          : 'Đã đánh dấu điểm thực địa: Đã cạn / Đóng.',
      data: serializePoi(updated as any, userId),
    });
  } catch (err) {
    console.error('[Update Trail POI Status Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật trạng thái điểm thực địa.' });
  }
};

// DELETE /api/trail-pois/:id - Delete field POI (atomic owner filter for non-staff; 404 when deletedCount === 0)
export const deleteTrailPoi = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    const poiId = String(req.params.id || '').trim();
    if (!STRICT_OBJECT_ID_REGEX.test(poiId)) {
      return res.status(400).json({ success: false, message: 'Mã điểm thực địa không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const poiObjId = new Types.ObjectId(poiId);
    const isStaff = role === 'admin' || role === 'moderator';
    const deleteFilter = isStaff ? { _id: poiObjId } : { _id: poiObjId, userId: new Types.ObjectId(userId) };

    const delRes = await TrailPoiModel.deleteOne(deleteFilter);
    if (delRes.deletedCount === 0) {
      if (!isStaff && (await TrailPoiModel.exists({ _id: poiObjId }))) {
        return res.status(403).json({ success: false, message: 'Chỉ người đăng hoặc Quản trị viên mới có quyền xóa điểm thực địa này.' });
      }
      return res.status(404).json({ success: false, message: 'Không tìm thấy điểm thực địa.' });
    }

    invalidatePlatformPulseCache();
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.json({ success: true, message: 'Đã xóa điểm thực địa thành công.' });
  } catch (err) {
    console.error('[Delete Trail POI Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa điểm thực địa.' });
  }
};

// =========================================================================
// LIVE PLATFORM PULSE ANALYTICS (5-MIN SWR SINGLEFLIGHT CACHE, ZERO PII)
// =========================================================================

function buildOfflinePlatformPulse(nowMs: number): PlatformPulseCache {
  const activeMockInc = mockIncidents.filter((i) => !i.resolved).length;
  const trendingTrails = [...mockTrails]
    .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0) || b.maxAltitudeM - a.maxAltitudeM)
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      name: t.name,
      province: t.province,
      maxAltitudeM: t.maxAltitudeM,
      activityScore: Math.round((t.reviewCount || 0) * 3 + (t.rating || 4.5) * 4),
    }));

  return {
    fetchedAt: new Date(nowMs).toISOString(),
    fetchedAtMs: nowMs,
    data: {
      totalTrails: mockTrails.length,
      activeIncidentsCount: activeMockInc,
      openTripsCount: 0,
      verifiedPoisCount: 0,
      totalCommunityDistanceKm: 0,
      totalCheckinsCount: 0,
      trendingTrails,
    },
  };
}

async function computeLivePlatformPulse(): Promise<PlatformPulseCache> {
  const nowMs = Date.now();
  const now = new Date(nowMs);
  const fetchedAt = now.toISOString();
  const ninetyDaysAgo = new Date(nowMs - 90 * 24 * 60 * 60 * 1000);

  const approvedTrails = (await TrailModel.find({ status: 'approved' })
    .select('id name province maxAltitudeM rating reviewCount distanceKm')
    .lean()) as any[];

  const approvedOids: Types.ObjectId[] = approvedTrails.map((t) => t._id);
  const approvedStringIds = Array.from(
    new Set(approvedTrails.flatMap((t) => [t.id, String(t._id)].filter((v): v is string => Boolean(v))))
  );
  const approvedIncidentIds: any[] = [...approvedOids, ...approvedStringIds];
  const trailDistByOid = new Map<string, number>(
    approvedTrails.map((t) => [String(t._id), Number(t.distanceKm) || 0])
  );

  // All aggregations scoped strictly to approved trails; single-pass Checkin $group joined against approvedTrails in memory (zero $lookup!)
  const [activeIncidentsCount, openTripsByTrail, activePoisByTrail, checkinsByTrail] = await Promise.all([
    IncidentModel.countDocuments({
      active: { $ne: false },
      resolved: { $ne: true },
      trailId: { $in: approvedIncidentIds },
    }),
    TripPlanModel.aggregate([
      {
        $match: {
          status: { $in: ['recruiting', 'in_progress'] },
          endDate: { $gte: now },
          trailId: { $in: approvedOids },
        },
      },
      { $group: { _id: '$trailId', count: { $sum: 1 } } },
    ]),
    TrailPoiModel.aggregate([
      { $match: { status: 'active', trailId: { $in: approvedStringIds } } },
      { $group: { _id: '$trailId', count: { $sum: 1 } } },
    ]),
    CheckinModel.aggregate([
      { $match: { trailId: { $in: approvedOids } } },
      {
        $group: {
          _id: '$trailId',
          totalCheckins: { $sum: 1 },
          recentCheckins: { $sum: { $cond: [{ $gte: ['$checkinDate', ninetyDaysAgo] }, 1, 0] } },
          recordedKmSum: { $sum: { $ifNull: ['$distanceRecordedKm', 0] } },
          missingKmCount: {
            $sum: { $cond: [{ $eq: [{ $ifNull: ['$distanceRecordedKm', null] }, null] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  let openTripsCount = 0;
  const tripMap = new Map<string, number>();
  for (const row of openTripsByTrail as any[]) {
    const cnt = Number(row.count) || 0;
    openTripsCount += cnt;
    if (row._id) tripMap.set(String(row._id), cnt);
  }

  let verifiedPoisCount = 0;
  const poiMap = new Map<string, number>();
  for (const row of activePoisByTrail as any[]) {
    const cnt = Number(row.count) || 0;
    verifiedPoisCount += cnt;
    if (row._id) poiMap.set(String(row._id), cnt);
  }

  let totalCheckinsCount = 0;
  let totalCommunityDistanceKm = 0;
  const recentCheckinMap = new Map<string, number>();
  for (const row of checkinsByTrail as any[]) {
    const oidStr = String(row._id);
    const cnt = Number(row.totalCheckins) || 0;
    const recent = Number(row.recentCheckins) || 0;
    const recordedKm = Number(row.recordedKmSum) || 0;
    const missingKmCnt = Number(row.missingKmCount) || 0;
    const fallbackTrailKm = trailDistByOid.get(oidStr) || 0;
    totalCheckinsCount += cnt;
    totalCommunityDistanceKm += recordedKm + missingKmCnt * fallbackTrailKm;
    recentCheckinMap.set(oidStr, recent);
  }

  const scoredTrails: PlatformPulseTrendingTrail[] = approvedTrails
    .map((t) => {
      const slug = String(t.id || t._id);
      const oidStr = String(t._id);
      const checkins = recentCheckinMap.get(oidStr) || 0;
      const trips = tripMap.get(oidStr) || 0;
      const pois = (poiMap.get(slug) || 0) + (oidStr !== slug ? poiMap.get(oidStr) || 0 : 0);
      const reviews = Number(t.reviewCount) || 0;
      const rating = Number(t.rating) || 0;
      const activityScore = Math.round(reviews * 3 + checkins * 10 + trips * 12 + pois * 6 + rating * 4);
      return {
        id: slug,
        name: String(t.name || slug),
        province: String(t.province || ''),
        maxAltitudeM: Number(t.maxAltitudeM) || 0,
        activityScore,
      };
    })
    .sort((a, b) => b.activityScore - a.activityScore || b.maxAltitudeM - a.maxAltitudeM)
    .slice(0, 5);

  return {
    fetchedAt,
    fetchedAtMs: nowMs,
    data: {
      totalTrails: approvedTrails.length,
      activeIncidentsCount,
      openTripsCount,
      verifiedPoisCount,
      totalCommunityDistanceKm: Math.round(totalCommunityDistanceKm * 10) / 10,
      totalCheckinsCount,
      trendingTrails: scoredTrails,
    },
  };
}

// GET /api/analytics/platform-pulse - Public live community telemetry (5-min SWR singleflight cache, zero PII)
export const getPlatformPulse = async (_req: Request, res: Response) => {
  try {
    const nowMs = Date.now();

    // Never cache offline zero fallback; serve stale live snapshot if within grace window
    if (mongoose.connection.readyState !== 1) {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      if (platformPulseCache && nowMs - platformPulseCache.fetchedAtMs < PULSE_STALE_GRACE_MS) {
        return res.json({
          success: true,
          cached: true,
          fetchedAt: platformPulseCache.fetchedAt,
          data: platformPulseCache.data,
        });
      }
      const offline = buildOfflinePlatformPulse(nowMs);
      return res.json({
        success: true,
        cached: false,
        fetchedAt: offline.fetchedAt,
        data: offline.data,
      });
    }

    if (platformPulseCache && nowMs - platformPulseCache.fetchedAtMs < PULSE_CACHE_TTL_MS) {
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=240');
      return res.json({
        success: true,
        cached: true,
        fetchedAt: platformPulseCache.fetchedAt,
        data: platformPulseCache.data,
      });
    }

    if (!platformPulseInFlight) {
      const reqEpoch = pulseCacheEpoch;
      const inFlight = computeLivePlatformPulse()
        .then((fresh) => {
          // Only commit if no POI mutation invalidated cache mid-flight
          if (reqEpoch === pulseCacheEpoch) {
            platformPulseCache = fresh;
          }
          return fresh;
        })
        .catch(() => null)
        .finally(() => {
          if (platformPulseInFlight === inFlight) {
            platformPulseInFlight = null;
          }
        });
      platformPulseInFlight = inFlight;
    }

    const fresh = await platformPulseInFlight;
    if (fresh) {
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=240');
      return res.json({
        success: true,
        cached: false,
        fetchedAt: fresh.fetchedAt,
        data: fresh.data,
      });
    }

    if (platformPulseCache && nowMs - platformPulseCache.fetchedAtMs < PULSE_STALE_GRACE_MS) {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.json({
        success: true,
        cached: true,
        fetchedAt: platformPulseCache.fetchedAt,
        data: platformPulseCache.data,
      });
    }

    return res.status(503).json({ success: false, message: 'Không thể tải nhịp đập thực địa lúc này.' });
  } catch (err) {
    console.error('[Platform Pulse Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tải dữ liệu nhịp đập thực địa.' });
  }
};
