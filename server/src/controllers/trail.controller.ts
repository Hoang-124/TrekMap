import crypto from 'crypto';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { mockTrails, mockGuides } from '../data/seedData.js';
import { Trail } from '../types.js';
import { TrailModel } from '../models/Trail.js';
import { Contribution } from '../models/Contribution.js';
import { ReviewModel } from '../models/Review.js';
import { GuideModel } from '../models/Guide.js';
import { UserModel } from '../models/User.js';
import { IncidentModel } from '../models/Incident.js';
import { TrailConditionModel } from '../models/TrailCondition.js';
import { WeatherForecastModel } from '../models/WeatherForecast.js';
import { ItineraryModel } from '../models/Itinerary.js';
import { TripPlanModel } from '../models/TripPlan.js';
import { TripReportModel } from '../models/TripReport.js';
import { CheckinModel } from '../models/Checkin.js';
import { SavedTrailModel } from '../models/SavedTrail.js';
import { GearChecklistModel } from '../models/GearChecklist.js';
import { SafetyTimerModel } from '../models/SafetyTimer.js';
import { SummitChallengeModel } from '../models/SummitChallenge.js';
import { RangerStationModel } from '../models/RangerStation.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { containsProfanity, getProfanityMatch } from '../utils/profanityFilter.js';
import {
  awardReputationPoints,
  deductReputationPoints,
  REPUTATION_POINTS,
  PENALTY_POINTS,
} from '../utils/reputation.js';
import { calculateDrivingRoute } from '../services/publicApis.service.js';
import { sanitizeInput, isSafeHttpUrl, hasDangerousMongoKeys } from '../utils/validation.js';
import { invalidateCache } from '../middleware/cache.middleware.js';
import { recordAuditLog, recordActivity } from '../utils/audit.js';
import { fetchTrailDemElevation, invalidateElevationCache } from '../services/elevation.service.js';
import { isValidObjectId, resolveTrailByIdOrSlug, resolveTrailObjectId } from '../utils/resolveTrail.js';
import { calculateHaversineDistanceKm as spatialHaversineKm } from '../utils/spatial.js';

const inMemoryTrails: Trail[] = [...mockTrails];
const VALID_REGIONS = new Set(['Miền Bắc', 'Miền Trung', 'Miền Nam']);
const VALID_WAYPOINT_TYPES = new Set(['campsite', 'water', 'viewpoint', 'danger', 'charging', 'rest']);
const DEFAULT_TRAIL_COVER =
  'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329097/trekmap/trails/trail_cover_trail-fansipan.jpg';

const ALLOWED_TRAIL_UPDATE_FIELDS = [
  'name',
  'altNames',
  'region',
  'province',
  'district',
  'difficultyLevel',
  'difficultyNote',
  'distanceKm',
  'elevationGainM',
  'maxAltitudeM',
  'durationDays',
  'durationHoursNote',
  'coverImage',
  'galleryImages',
  'startLat',
  'startLng',
  'endLat',
  'endLng',
  'gpxTrack',
  'waypoints',
  'bestMonths',
  'avoidMonths',
  'description',
  'transportationInfo',
  'permitRequired',
  'permitInfo',
  'rescueContact',
  'hasCampsite',
  'hasWaterSource',
  'kidFriendly',
  'status',
] as const;

export function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return Math.round(spatialHaversineKm(lat1, lon1, lat2, lon2) * 10) / 10;
}

function sanitizeWaypoints(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((w: any) => w && typeof w === 'object' && Number.isFinite(Number(w.lat)) && Number.isFinite(Number(w.lng)))
    .slice(0, 60)
    .map((w: any, i: number) => {
      const lat = Number(w.lat);
      const lng = Number(w.lng);
      return {
        id: typeof w.id === 'string' && w.id.trim() ? sanitizeInput(w.id).slice(0, 40) : `wp-${i + 1}`,
        name: sanitizeInput(String(w.name || `Mốc ${i + 1}`)).slice(0, 120),
        type: VALID_WAYPOINT_TYPES.has(w.type) ? w.type : 'viewpoint',
        description: sanitizeInput(String(w.description || '')).slice(0, 400),
        ...(Number.isFinite(Number(w.elevationM)) ? { elevationM: Math.round(Number(w.elevationM)) } : {}),
        lat: Math.max(-90, Math.min(90, lat)),
        lng: Math.max(-180, Math.min(180, lng)),
      };
    });
}

function sanitizeGpxTrack(raw: unknown): [number, number][] {
  if (!Array.isArray(raw)) return [];
  return raw
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
    .slice(0, 5000)
    .map((pt: any) => [Number(pt[0]), Number(pt[1])]);
}

function sanitizeMonths(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(raw.map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))
  );
}

export const getTrails = async (req: Request, res: Response) => {
  const { region, difficulty, search, duration, season, campsite, kidFriendly, lat, lng, sortBy } = req.query;

  if (lat && lng) {
    return getNearbyTrails(req, res);
  }

  try {
    if (mongoose.connection.readyState === 1) {
      // Strictly expose only approved trails on public catalog
      const query: any = { status: 'approved' };
      if (typeof region === 'string' && region !== 'All' && VALID_REGIONS.has(region)) {
        query.region = region;
      }
      if (typeof difficulty === 'string' && difficulty) {
        const diffNum = parseInt(difficulty, 10);
        if (Number.isInteger(diffNum) && diffNum >= 1 && diffNum <= 5) {
          query.difficultyLevel = diffNum;
        }
      }
      if (typeof duration === 'string' && duration) {
        const durNum = parseInt(duration, 10);
        if (Number.isInteger(durNum) && durNum >= 1 && durNum <= 30) {
          query.durationDays = durNum;
        }
      }
      if (typeof season === 'string' && season) {
        const monthNum = parseInt(season, 10);
        if (Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12) {
          query.bestMonths = monthNum;
        }
      }
      if (campsite === 'true') query.hasCampsite = true;
      if (kidFriendly === 'true') query.kidFriendly = true;

      if (typeof search === 'string' && search.trim().length > 0) {
        const cleanSearch = search.trim().slice(0, 100);
        const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');
        query.$or = [
          { name: regex },
          { altNames: regex },
          { province: regex },
          { district: regex },
          { region: regex },
          { description: regex },
        ];
      }

      const sortOptions: any = {};
      if (sortBy === 'rating_desc' || sortBy === 'rating') sortOptions.rating = -1;
      else if (sortBy === 'distance_asc') sortOptions.distanceKm = 1;
      else if (sortBy === 'distance_desc') sortOptions.distanceKm = -1;
      else if (sortBy === 'difficulty_asc') sortOptions.difficultyLevel = 1;
      else if (sortBy === 'difficulty_desc') sortOptions.difficultyLevel = -1;
      else if (sortBy === 'duration_asc') sortOptions.durationDays = 1;
      else if (sortBy === 'duration_desc') sortOptions.durationDays = -1;
      else if (sortBy === 'altitude_desc') sortOptions.maxAltitudeM = -1;

      const page = parseInt(String(req.query.page || ''), 10);
      const rawLimit = parseInt(String(req.query.limit || ''), 10);
      const limit = !isNaN(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 100;

      let queryBuilder = TrailModel.find(query).sort(sortOptions).limit(limit);
      if (!isNaN(page) && page > 0) {
        queryBuilder = queryBuilder.skip((page - 1) * limit);
      }

      const dbTrails = await queryBuilder.lean().exec();
      return res.json({ success: true, count: dbTrails.length, data: dbTrails });
    }
  } catch {
    // Fallthrough to in-memory store when DB fails
  }

  let filtered = [...inMemoryTrails];

  if (typeof region === 'string' && region !== 'All') {
    filtered = filtered.filter((t) => (t.region || '').toLowerCase() === region.toLowerCase());
  }
  if (typeof difficulty === 'string' && difficulty) {
    const diffNum = parseInt(difficulty, 10);
    if (!isNaN(diffNum)) filtered = filtered.filter((t) => t.difficultyLevel === diffNum);
  }
  if (typeof duration === 'string' && duration) {
    const durNum = parseInt(duration, 10);
    if (!isNaN(durNum)) filtered = filtered.filter((t) => t.durationDays === durNum);
  }
  if (typeof season === 'string' && season) {
    const monthNum = parseInt(season, 10);
    if (!isNaN(monthNum)) filtered = filtered.filter((t) => (t.bestMonths || []).includes(monthNum));
  }
  if (campsite === 'true') filtered = filtered.filter((t) => t.hasCampsite);
  if (kidFriendly === 'true') filtered = filtered.filter((t) => t.kidFriendly);

  if (typeof search === 'string' && search.trim().length > 0) {
    const s = search.trim().slice(0, 100).toLowerCase();
    filtered = filtered.filter(
      (t) =>
        (t.name || '').toLowerCase().includes(s) ||
        (t.province || '').toLowerCase().includes(s) ||
        (t.region || '').toLowerCase().includes(s) ||
        (t.district || '').toLowerCase().includes(s) ||
        (t.description || '').toLowerCase().includes(s)
    );
  }

  if (sortBy === 'rating_desc' || sortBy === 'rating') filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (sortBy === 'distance_asc') filtered.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
  else if (sortBy === 'distance_desc') filtered.sort((a, b) => (b.distanceKm || 0) - (a.distanceKm || 0));
  else if (sortBy === 'difficulty_asc') filtered.sort((a, b) => (a.difficultyLevel || 0) - (b.difficultyLevel || 0));
  else if (sortBy === 'difficulty_desc') filtered.sort((a, b) => (b.difficultyLevel || 0) - (a.difficultyLevel || 0));
  else if (sortBy === 'duration_asc') filtered.sort((a, b) => (a.durationDays || 0) - (b.durationDays || 0));
  else if (sortBy === 'duration_desc') filtered.sort((a, b) => (b.durationDays || 0) - (a.durationDays || 0));
  else if (sortBy === 'altitude_desc') filtered.sort((a, b) => (b.maxAltitudeM || 0) - (a.maxAltitudeM || 0));

  return res.json({ success: true, count: filtered.length, data: filtered });
};

export const getNearbyTrails = async (req: Request, res: Response) => {
  const latitude = parseFloat(String(req.query.lat ?? ''));
  const longitude = parseFloat(String(req.query.lng ?? ''));
  const radiusKm = parseFloat(String(req.query.radiusKm ?? ''));
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '5'), 10) || 5, 1), 20);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp tọa độ GPS hợp lệ (lat: -90..90, lng: -180..180).',
    });
  }

  const startTimeMs = performance.now();

  try {
    if (mongoose.connection.readyState === 1) {
      const dbTrails = await TrailModel.find({
        status: 'approved',
        startLocation: {
          $near: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
            ...(Number.isFinite(radiusKm) && radiusKm > 0 ? { $maxDistance: radiusKm * 1000 } : {}),
          },
        },
      })
        .limit(limit)
        .maxTimeMS(1500)
        .lean()
        .exec();

      const queryExecutionTimeMs = Math.round((performance.now() - startTimeMs) * 100) / 100;

      const dataWithDistance = await Promise.all(
        dbTrails.map(async (trail: any) => {
          const distKm = calculateHaversineDistanceKm(latitude, longitude, trail.startLat, trail.startLng);
          const routeInfo = await calculateDrivingRoute(latitude, longitude, trail.startLat, trail.startLng);
          return {
            ...trail,
            distanceFromUserKm: distKm,
            roadDistanceKm: routeInfo.roadDistanceKm,
            travelDurationMin: routeInfo.travelDurationMin,
            travelDurationFormatted: routeInfo.travelDurationFormatted,
          };
        })
      );

      return res.json({
        success: true,
        count: dataWithDistance.length,
        radiusKm: Number.isFinite(radiusKm) ? radiusKm : null,
        executionTimeMs: queryExecutionTimeMs,
        userCoordinates: { lat: latitude, lng: longitude },
        data: dataWithDistance,
      });
    }
  } catch (err) {
    console.warn('[2dsphere Query Notice]: Falling back to Haversine calculation:', (err as Error).message);
  }

  let nearbyMemoryTrails = inMemoryTrails
    .map((t) => ({
      ...t,
      distanceFromUserKm: calculateHaversineDistanceKm(latitude, longitude, t.startLat, t.startLng),
    }))
    .sort((a, b) => a.distanceFromUserKm - b.distanceFromUserKm);

  if (Number.isFinite(radiusKm) && radiusKm > 0) {
    nearbyMemoryTrails = nearbyMemoryTrails.filter((t) => t.distanceFromUserKm <= radiusKm);
  }

  const topNearest = nearbyMemoryTrails.slice(0, limit);
  const trailsWithDriving = await Promise.all(
    topNearest.map(async (t) => {
      const routeInfo = await calculateDrivingRoute(latitude, longitude, t.startLat, t.startLng);
      return {
        ...t,
        roadDistanceKm: routeInfo.roadDistanceKm,
        travelDurationMin: routeInfo.travelDurationMin,
        travelDurationFormatted: routeInfo.travelDurationFormatted,
      };
    })
  );

  const totalTimeMs = Math.round((performance.now() - startTimeMs) * 100) / 100;

  return res.json({
    success: true,
    count: trailsWithDriving.length,
    radiusKm: Number.isFinite(radiusKm) ? radiusKm : null,
    executionTimeMs: totalTimeMs,
    userCoordinates: { lat: latitude, lng: longitude },
    data: trailsWithDriving,
  });
};

export const getTrailById = async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id || '').trim();
  if (!id) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cung đường.' });
  }

  const isStaff = req.user?.role === 'admin' || req.user?.role === 'moderator';

  try {
    const dbTrail = await resolveTrailByIdOrSlug(id);
    if (dbTrail) {
      if (dbTrail.status !== 'approved' && !isStaff) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường này.' });
      }
      return res.json({ success: true, data: dbTrail });
    }
  } catch {
    // Fallback
  }

  try {
    if (mongoose.connection.readyState === 1) {
      const contrib = await Contribution.findOne(
        isValidObjectId(id) ? { $or: [{ _id: id }, { id }], status: 'approved' } : { id, status: 'approved' }
      )
        .lean()
        .exec();
      if (contrib) {
        return res.json({
          success: true,
          data: {
            id: contrib.id || `contrib-${contrib._id}`,
            name: contrib.name,
            altNames: contrib.altNames || [],
            region: contrib.region || 'Miền Bắc',
            province: contrib.province || '',
            district: contrib.district || '',
            hamlet: contrib.hamlet || '',
            distanceKm: Number(contrib.distanceKm) || 15,
            elevationGainM: Number(contrib.elevationGainM) || 800,
            maxAltitudeM: Number(contrib.maxAltitudeM) || 2000,
            durationDays: Number(contrib.durationDays) || Math.ceil((Number(contrib.distanceKm) || 15) / 10),
            durationHoursNote: contrib.durationHoursNote || '1 ngày',
            difficultyLevel: Number(contrib.difficultyLevel) || 3,
            difficultyNote: contrib.difficultyNote || '',
            bestMonths: Array.isArray(contrib.bestMonths) ? contrib.bestMonths : [],
            avoidMonths: Array.isArray(contrib.avoidMonths) ? contrib.avoidMonths : [],
            startLat: Number(contrib.startLat),
            startLng: Number(contrib.startLng),
            endLat: Number(contrib.endLat ?? contrib.startLat),
            endLng: Number(contrib.endLng ?? contrib.startLng),
            description: contrib.description,
            transportationInfo: contrib.transportationInfo || '',
            coverImage: contrib.coverImage || '',
            galleryImages: contrib.galleryImages?.length
              ? contrib.galleryImages
              : contrib.coverImage
                ? [contrib.coverImage]
                : [],
            permitRequired: Boolean(contrib.permitRequired),
            permitInfo: contrib.permitInfo || '',
            hasCampsite: Boolean(contrib.hasCampsite),
            hasWaterSource: Boolean(contrib.hasWaterSource),
            kidFriendly: Boolean(contrib.kidFriendly),
            gpxTrack: contrib.gpxTrack || [],
            waypoints: contrib.waypoints || [],
            status: contrib.status,
            createdAt: contrib.createdAt,
            updatedAt: contrib.updatedAt,
            rescueContact: contrib.rescueContact || {
              name: `Cứu nạn Khẩn cấp ${contrib.province || 'Địa phương'}`,
              phone: '112 / 114',
              rangerContact: '115',
            },
            rating: Number(contrib.rating) || 0,
            reviewCount: Number(contrib.reviewCount) || 0,
          },
        });
      }
    }
  } catch {
    // Fallback
  }

  const trail = inMemoryTrails.find((t) => t.id === id);
  if (!trail) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường này.' });
  }

  return res.json({ success: true, data: trail });
};

export const getGuides = async (req: Request, res: Response) => {
  const { region, province } = req.query;

  try {
    if (mongoose.connection.readyState === 1) {
      const query: any = { isActive: { $ne: false } };
      if (typeof region === 'string' && region.trim()) {
        const escaped = region.trim().slice(0, 50).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.region = { $regex: new RegExp(escaped, 'i') };
      }
      if (typeof province === 'string' && province.trim()) {
        const escapedProv = province.trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.provinces = { $regex: new RegExp(escapedProv, 'i') };
      }
      const dbGuides = await GuideModel.find(query).sort({ verified: -1, rating: -1 }).lean().exec();
      return res.json({ success: true, count: dbGuides.length, data: dbGuides });
    }
  } catch {
    // Fallback to mockGuides only when DB is unreachable
  }

  let filtered = [...mockGuides];
  if (typeof region === 'string' && region.trim()) {
    filtered = filtered.filter((g) => g.region.toLowerCase().includes(region.trim().toLowerCase()));
  }

  return res.json({ success: true, count: filtered.length, data: filtered });
};

export const getTrailGuides = async (req: Request, res: Response) => {
  const id = String(req.params.id || '').trim();
  let region = '';
  let province = '';
  let trailSlug = id;

  try {
    const trail = await resolveTrailByIdOrSlug(id);
    if (trail) {
      region = trail.region || '';
      province = trail.province || '';
      if (trail.id) trailSlug = trail.id;
    }
  } catch {
    // Fallback
  }

  if (!region) {
    const localTrail = inMemoryTrails.find((t) => t.id === id);
    if (localTrail) {
      region = localTrail.region;
      province = localTrail.province;
      trailSlug = localTrail.id;
    }
  }

  try {
    if (mongoose.connection.readyState === 1) {
      // Match priority: 1) exact trailSlugs, 2) trail province (fixes Lâm Đồng / Bidoup mismatch), 3) region
      const bySlug = await GuideModel.find({ isActive: { $ne: false }, trailSlugs: trailSlug })
        .sort({ verified: -1, rating: -1 })
        .lean()
        .exec();
      if (bySlug.length > 0) {
        return res.json({ success: true, count: bySlug.length, data: bySlug });
      }

      if (province) {
        const escapedProv = province.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const byProvince = await GuideModel.find({
          isActive: { $ne: false },
          provinces: { $regex: new RegExp(escapedProv, 'i') },
        })
          .sort({ verified: -1, rating: -1 })
          .lean()
          .exec();
        if (byProvince.length > 0) {
          return res.json({ success: true, count: byProvince.length, data: byProvince });
        }
      }

      const byRegion = await GuideModel.find({ isActive: { $ne: false }, ...(region ? { region } : {}) })
        .sort({ verified: -1, rating: -1 })
        .lean()
        .exec();
      return res.json({ success: true, count: byRegion.length, data: byRegion });
    }
  } catch {
    // Offline fallback below
  }

  const filtered = region
    ? mockGuides.filter((g) => g.region.toLowerCase() === region.toLowerCase())
    : [...mockGuides];

  return res.json({ success: true, count: filtered.length, data: filtered });
};

export const createReview = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId || !isValidObjectId(userId)) {
    return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để gửi đánh giá.' });
  }

  const { trailId, rating, difficultyRating, content, safetyNote, photos, tripDate } = req.body || {};

  if (!trailId || typeof trailId !== 'string') {
    return res.status(400).json({ success: false, message: 'Thiếu mã cung đường cần đánh giá.' });
  }
  if (typeof content !== 'string' || content.trim().length < 5) {
    return res.status(400).json({ success: false, message: 'Nội dung đánh giá phải có ít nhất 5 ký tự.' });
  }

  const numRating = Number(rating);
  const numDiffRating = Number(difficultyRating || 3);
  if (!Number.isFinite(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ success: false, message: 'Điểm đánh giá phải từ 1 đến 5 sao.' });
  }
  if (!Number.isFinite(numDiffRating) || numDiffRating < 1 || numDiffRating > 5) {
    return res.status(400).json({ success: false, message: 'Đánh giá độ khó phải từ 1 đến 5.' });
  }

  if (containsProfanity(content) || (typeof safetyNote === 'string' && containsProfanity(safetyNote))) {
    const matchedWord = getProfanityMatch(content) || getProfanityMatch(safetyNote || '');
    const penaltyInfo = await deductReputationPoints(
      userId,
      PENALTY_POINTS.TOXIC_COMMENT,
      `Đánh giá chứa từ ngữ vi phạm ("${matchedWord}")`
    );
    return res.status(400).json({
      success: false,
      message: `Đánh giá bị từ chối do chứa từ ngữ vi phạm quy chuẩn ("${matchedWord}"). Bạn bị trừ ${PENALTY_POINTS.TOXIC_COMMENT} điểm uy tín.`,
      penaltyInfo,
    });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng để lưu đánh giá.' });
  }

  try {
    const resolvedTrail = await resolveTrailByIdOrSlug(trailId);
    if (!resolvedTrail) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường để đánh giá.' });
    }

    // Prevent duplicate review spam & rating/reputation manipulation by same user on same trail
    const existingReview = await ReviewModel.exists({
      trailId: resolvedTrail._id,
      userId: new mongoose.Types.ObjectId(userId),
    });
    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: 'Bạn đã gửi đánh giá cho cung đường này rồi.',
      });
    }

    const dbUser = await UserModel.findById(userId).select('fullName avatarUrl').lean();
    const authorName = dbUser?.fullName || 'Trekker';
    const authorAvatar = dbUser?.avatarUrl || '';

    const safePhotos = Array.isArray(photos) ? photos.filter((u: unknown) => isSafeHttpUrl(u)).slice(0, 6) : [];
    const safeContent = sanitizeInput(content).slice(0, 2000);
    const safeSafetyNote = typeof safetyNote === 'string' ? sanitizeInput(safetyNote).slice(0, 500) : '';
    const safeTripDate =
      typeof tripDate === 'string' && tripDate.trim() ? tripDate.trim().slice(0, 20) : new Date().toISOString().split('T')[0];

    const created = await ReviewModel.create({
      trailId: resolvedTrail._id,
      userId: new mongoose.Types.ObjectId(userId),
      userName: authorName,
      userAvatar: authorAvatar,
      rating: numRating,
      difficultyRating: numDiffRating,
      content: safeContent,
      safetyNote: safeSafetyNote,
      photos: safePhotos,
      tripDate: safeTripDate,
    });

    // Recalculate real average rating & reviewCount via aggregation
    const stats = await ReviewModel.aggregate([
      { $match: { trailId: resolvedTrail._id } },
      { $group: { _id: '$trailId', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    if (stats.length > 0) {
      const avgRating = Math.round(stats[0].avgRating * 10) / 10;
      await TrailModel.updateOne({ _id: resolvedTrail._id }, { $set: { rating: avgRating, reviewCount: stats[0].count } });
    }

    const reputationReward = await awardReputationPoints(
      userId,
      REPUTATION_POINTS.CONTRIBUTE_REVIEW,
      'Đánh giá trải nghiệm cung đường'
    );

    await recordActivity({
      userId,
      type: 'new_review',
      title: `Đã đánh giá ${numRating}/5 sao cung đường ${resolvedTrail.name}`,
      targetType: 'trail',
      targetId: resolvedTrail.id || String(resolvedTrail._id),
      thumbnailUrl: resolvedTrail.coverImage,
    });

    invalidateCache('/api/trails');

    return res.status(201).json({
      success: true,
      message: reputationReward
        ? `Gửi đánh giá thành công! Bạn nhận được +${REPUTATION_POINTS.CONTRIBUTE_REVIEW} điểm uy tín.`
        : 'Gửi đánh giá thành công!',
      data: { ...created.toObject(), id: created._id.toString() },
      reputationReward,
    });
  } catch (err) {
    console.error('[Create Review Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể lưu đánh giá lúc này.' });
  }
};

export const getTrailReviews = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const resolvedObjId = await resolveTrailObjectId(id);
    if (!resolvedObjId) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const reviews = await ReviewModel.find({ trailId: resolvedObjId })
      .populate('userId', 'fullName avatarUrl reputationScore')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();

    const formatted = reviews.map((r: any) => {
      const liveUser = r.userId && typeof r.userId === 'object' ? r.userId : null;
      return {
        ...r,
        id: r._id?.toString(),
        userName: liveUser?.fullName || r.userName,
        userAvatar: liveUser?.avatarUrl || r.userAvatar || '',
      };
    });

    return res.json({ success: true, count: formatted.length, data: formatted });
  } catch {
    return res.json({ success: true, count: 0, data: [] });
  }
};

export const createTrailAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền tạo Trail.' });
    }
    const data = req.body || {};
    if (hasDangerousMongoKeys(data)) {
      return res.status(400).json({ success: false, message: 'Dữ liệu chứa khóa không hợp lệ.' });
    }
    if (!data.name || !data.province || !data.region || !VALID_REGIONS.has(data.region)) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin tên cung đường, tỉnh hoặc vùng miền hợp lệ.' });
    }

    const startLat = Number(data.startLat ?? data.startLocation?.lat);
    const startLng = Number(data.startLng ?? data.startLocation?.lng);
    if (!Number.isFinite(startLat) || !Number.isFinite(startLng) || startLat < -90 || startLat > 90 || startLng < -180 || startLng > 180) {
      return res.status(400).json({ success: false, message: 'Tọa độ GPS xuất phát không hợp lệ.' });
    }

    const endLat = data.endLat !== undefined ? Number(data.endLat) : startLat;
    const endLng = data.endLng !== undefined ? Number(data.endLng) : startLng;
    if (!Number.isFinite(endLat) || !Number.isFinite(endLng) || endLat < -90 || endLat > 90 || endLng < -180 || endLng > 180) {
      return res.status(400).json({ success: false, message: 'Tọa độ GPS đích không hợp lệ.' });
    }

    const coverImage =
      typeof data.coverImage === 'string' && isSafeHttpUrl(data.coverImage)
        ? data.coverImage.trim()
        : DEFAULT_TRAIL_COVER;
    const galleryImages = Array.isArray(data.galleryImages)
      ? data.galleryImages.filter((u: unknown) => isSafeHttpUrl(u)).slice(0, 10)
      : [coverImage];

    const newTrail = await TrailModel.create({
      id:
        typeof data.id === 'string' && data.id.trim()
          ? sanitizeInput(data.id).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64)
          : `trail-${crypto.randomBytes(6).toString('hex')}`,
      name: sanitizeInput(String(data.name)).slice(0, 160),
      altNames: Array.isArray(data.altNames)
        ? data.altNames.filter((s: unknown) => typeof s === 'string').slice(0, 10).map((s: string) => sanitizeInput(s))
        : [],
      region: data.region,
      province: sanitizeInput(String(data.province)).slice(0, 80),
      district: sanitizeInput(String(data.district || data.province)).slice(0, 80),
      distanceKm: Math.max(0.1, Number(data.distanceKm) || 15),
      elevationGainM: Math.max(0, Number(data.elevationGainM) || 800),
      maxAltitudeM: Math.max(0, Number(data.maxAltitudeM) || 2000),
      durationDays: Math.max(1, Number(data.durationDays) || 2),
      durationHoursNote: sanitizeInput(String(data.durationHoursNote || `${Number(data.durationDays) || 2} ngày`)).slice(0, 120),
      difficultyLevel: Math.min(Math.max(Number(data.difficultyLevel) || 3, 1), 5),
      difficultyNote: sanitizeInput(String(data.difficultyNote || '')).slice(0, 300),
      description: sanitizeInput(String(data.description || 'Cung đường trekking thực địa Việt Nam.')).slice(0, 4000),
      transportationInfo: sanitizeInput(String(data.transportationInfo || 'Di chuyển tự túc hoặc theo đoàn.')).slice(0, 1500),
      coverImage,
      galleryImages,
      bestMonths: sanitizeMonths(data.bestMonths),
      avoidMonths: sanitizeMonths(data.avoidMonths),
      gpxTrack: sanitizeGpxTrack(data.gpxTrack),
      waypoints: sanitizeWaypoints(data.waypoints),
      permitRequired: Boolean(data.permitRequired),
      permitInfo: sanitizeInput(String(data.permitInfo || '')).slice(0, 500),
      rescueContact:
        data.rescueContact && typeof data.rescueContact === 'object'
          ? {
              name: sanitizeInput(String(data.rescueContact.name || '')).slice(0, 120),
              phone: sanitizeInput(String(data.rescueContact.phone || '')).slice(0, 40),
              rangerContact: sanitizeInput(String(data.rescueContact.rangerContact || '')).slice(0, 120),
            }
          : { name: `Cứu nạn Khẩn cấp ${data.province}`, phone: '112 / 114', rangerContact: '115' },
      hasCampsite: Boolean(data.hasCampsite),
      hasWaterSource: Boolean(data.hasWaterSource),
      kidFriendly: Boolean(data.kidFriendly),
      rating: 0,
      reviewCount: 0,
      startLat,
      startLng,
      endLat,
      endLng,
      startLocation: { type: 'Point', coordinates: [startLng, startLat] },
      status: 'approved',
      ...(isValidObjectId(req.user.userId) ? { createdBy: req.user.userId } : {}),
    });

    invalidateCache('/api/trails');
    await recordAuditLog(req, 'CREATE_TRAIL', 'trails', `Tạo cung đường ${newTrail.name} (${newTrail.id || newTrail._id})`);
    return res.status(201).json({ success: true, message: 'Tạo cung đường mới thành công!', data: newTrail });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: 'Mã định danh (slug) cung đường này đã tồn tại.' });
    }
    console.error('[Create Trail Admin Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo cung đường.' });
  }
};

export const updateTrailAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền cập nhật Trail.' });
    }
    const { id } = req.params;
    const rawBody = req.body || {};

    if (hasDangerousMongoKeys(rawBody)) {
      return res.status(400).json({ success: false, message: 'Dữ liệu cập nhật chứa khóa không hợp lệ.' });
    }

    const existing = await resolveTrailByIdOrSlug(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường để cập nhật.' });
    }

    const sanitizedUpdate: Record<string, any> = {};
    for (const key of ALLOWED_TRAIL_UPDATE_FIELDS) {
      if (rawBody[key] !== undefined) {
        const val = rawBody[key];
        if (key === 'region' && !VALID_REGIONS.has(val)) continue;
        if (key === 'coverImage') {
          if (typeof val === 'string' && isSafeHttpUrl(val)) sanitizedUpdate[key] = val.trim();
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
        if (key === 'bestMonths' || key === 'avoidMonths') {
          sanitizedUpdate[key] = sanitizeMonths(val);
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
        sanitizedUpdate[key] = typeof val === 'string' ? sanitizeInput(val) : val;
      }
    }

    const nextLat = sanitizedUpdate.startLat !== undefined ? Number(sanitizedUpdate.startLat) : existing.startLat;
    const nextLng = sanitizedUpdate.startLng !== undefined ? Number(sanitizedUpdate.startLng) : existing.startLng;
    if (sanitizedUpdate.startLat !== undefined || sanitizedUpdate.startLng !== undefined) {
      if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng) || nextLat < -90 || nextLat > 90 || nextLng < -180 || nextLng > 180) {
        return res.status(400).json({ success: false, message: 'Tọa độ GPS không hợp lệ.' });
      }
      sanitizedUpdate.startLat = nextLat;
      sanitizedUpdate.startLng = nextLng;
      sanitizedUpdate.startLocation = { type: 'Point', coordinates: [nextLng, nextLat] };
    }

    const updated = await TrailModel.findByIdAndUpdate(existing._id, { $set: sanitizedUpdate }, { new: true, runValidators: true });
    invalidateCache('/api/trails');
    invalidateElevationCache(String(existing.id || existing._id));
    await recordAuditLog(req, 'UPDATE_TRAIL', 'trails', `Cập nhật cung đường ${existing.name} (${existing.id || existing._id})`);
    return res.json({ success: true, message: 'Cập nhật thông tin cung đường thành công!', data: updated });
  } catch (err) {
    console.error('[Update Trail Admin Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật cung đường.' });
  }
};

export const deleteTrailAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền xóa Trail.' });
    }
    const { id } = req.params;
    const trail = await resolveTrailByIdOrSlug(id);

    if (trail) {
      const tid = trail._id;
      const slug = trail.id;
      const idCandidates = slug ? [tid, slug, String(tid)] : [tid, String(tid)];

      await TrailModel.findByIdAndDelete(tid);
      await Promise.allSettled([
        ReviewModel.deleteMany({ trailId: tid }),
        IncidentModel.deleteMany({ trailId: { $in: idCandidates } }),
        TrailConditionModel.deleteMany({ trailId: { $in: idCandidates } }),
        WeatherForecastModel.deleteMany({ trailId: tid }),
        ItineraryModel.deleteMany({ trailId: tid }),
        TripReportModel.deleteMany({ trailId: tid }),
        TripPlanModel.deleteMany({ trailId: tid }),
        CheckinModel.deleteMany({ trailId: tid }),
        SavedTrailModel.deleteMany({ trailId: tid }),
        GearChecklistModel.deleteMany({ trailId: tid }),
        SafetyTimerModel.updateMany({ trailId: tid, status: 'active' }, { $set: { status: 'cancelled' } }),
        ...(slug ? [Contribution.deleteMany({ id: slug })] : []),
        UserModel.updateMany({}, { $pull: { checkedInTrails: tid, savedTrails: tid } }),
      ]);
      invalidateElevationCache(String(slug || tid));
    } else {
      const idx = inMemoryTrails.findIndex((t) => t.id === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường để xóa.' });
      }
      inMemoryTrails.splice(idx, 1);
    }

    const memIdx = inMemoryTrails.findIndex((t) => t.id === id || (trail?.id && t.id === trail.id));
    if (memIdx >= 0) inMemoryTrails.splice(memIdx, 1);

    invalidateCache('/api/trails');
    await recordAuditLog(req, 'DELETE_TRAIL', 'trails', `Xóa cung đường ${trail?.name || id}`);
    return res.json({ success: true, message: 'Đã xóa cung đường thành công!' });
  } catch (err) {
    console.error('[Delete Trail Admin Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa cung đường.' });
  }
};

export const deleteReview = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const isPrivileged = req.user?.role === 'admin' || req.user?.role === 'moderator';
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    const reviewId = String(req.params.reviewId || req.params.id || '').trim();
    const scopedTrailParam = req.params.reviewId && req.params.id ? String(req.params.id).trim() : '';
    if (!isValidObjectId(reviewId)) {
      return res.status(400).json({ success: false, message: 'Mã đánh giá không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const review = await ReviewModel.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá.' });
    }
    if (scopedTrailParam) {
      const trail = await resolveTrailByIdOrSlug(scopedTrailParam);
      if (trail && review.trailId && String(review.trailId) !== String(trail._id)) {
        return res.status(404).json({ success: false, message: 'Đánh giá này không thuộc cung đường đã chỉ định.' });
      }
    }
    if (!isPrivileged && String(review.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa đánh giá này.' });
    }

    await ReviewModel.deleteOne({ _id: review._id });
    let updatedRating = 0;
    let updatedReviewCount = 0;
    if (review.trailId) {
      const stats = await ReviewModel.aggregate([
        { $match: { trailId: review.trailId } },
        { $group: { _id: '$trailId', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]);
      updatedRating = stats.length > 0 ? Math.round(stats[0].avgRating * 10) / 10 : 0;
      updatedReviewCount = stats.length > 0 ? stats[0].count : 0;
      await TrailModel.updateOne(
        { _id: review.trailId },
        { $set: { rating: updatedRating, reviewCount: updatedReviewCount } }
      ).catch(() => {});
    }
    invalidateCache('/api/trails');
    await recordAuditLog(req, 'DELETE_REVIEW', 'reviews', `Xóa đánh giá ${reviewId}`);
    return res.json({
      success: true,
      message: 'Đã xóa đánh giá thành công!',
      data: { rating: updatedRating, reviewCount: updatedReviewCount },
    });
  } catch (err) {
    console.error('[Delete Review Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa đánh giá.' });
  }
};

// GET /api/trails/stats/summary - Live aggregated Vietnam platform telemetry summary
export const getPlatformStatsSummary = async (_req: Request, res: Response) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const [
        trailAgg,
        totalUsers,
        totalCheckins,
        verifiedCheckins,
        activeTrips,
        openIncidents,
        totalChallenges,
        totalRangers,
      ] = await Promise.all([
        TrailModel.aggregate([
          { $match: { status: 'approved' } },
          {
            $group: {
              _id: null,
              totalTrails: { $sum: 1 },
              totalKm: { $sum: '$distanceKm' },
              highestPeakM: { $max: '$maxAltitudeM' },
            },
          },
        ]),
        UserModel.countDocuments({ isBanned: { $ne: true } }),
        CheckinModel.countDocuments(),
        CheckinModel.countDocuments({ verifiedBadge: true }),
        TripPlanModel.countDocuments({ status: { $in: ['recruiting', 'full', 'in_progress'] } }),
        IncidentModel.countDocuments({ resolved: { $ne: true } }),
        SummitChallengeModel.countDocuments({ isActive: { $ne: false } }),
        RangerStationModel.countDocuments({ isActive: { $ne: false } }),
      ]);

      const trailSummary = trailAgg[0] || { totalTrails: 0, totalKm: 0, highestPeakM: 0 };
      return res.json({
        success: true,
        source: 'database',
        data: {
          totalTrails: Number(trailSummary.totalTrails) || 0,
          totalKm: Math.round((Number(trailSummary.totalKm) || 0) * 10) / 10,
          highestPeakM: Math.round(Number(trailSummary.highestPeakM) || 0),
          totalUsers,
          totalCheckins,
          verifiedCheckins,
          activeTrips,
          openIncidents,
          totalChallenges,
          totalRangers,
        },
      });
    }
  } catch (err) {
    console.warn('[Platform Stats Summary Fallback]:', (err as Error).message);
  }

  const totalTrails = inMemoryTrails.length;
  const totalKm = Math.round(inMemoryTrails.reduce((sum, t) => sum + (Number(t.distanceKm) || 0), 0) * 10) / 10;
  const highestPeakM = inMemoryTrails.reduce((max, t) => Math.max(max, Number(t.maxAltitudeM) || 0), 0);

  return res.json({
    success: true,
    source: 'fallback',
    data: {
      totalTrails,
      totalKm,
      highestPeakM,
      totalUsers: 0,
      totalCheckins: 0,
      verifiedCheckins: 0,
      activeTrips: 0,
      openIncidents: 0,
      totalChallenges: 0,
      totalRangers: 0,
    },
  });
};

// GET /api/trails/:id/nearby-trails - Top closest approved trails for combo expeditions
export const getNearbyTrailsForTrail = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ success: false, message: 'Thiếu mã cung đường.' });
    }
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '4'), 10) || 4, 1), 12);

    let sourceTrail: any = null;
    let candidateTrails: any[] = [];

    if (mongoose.connection.readyState === 1) {
      try {
        const dbSource = await resolveTrailByIdOrSlug(id);
        if (dbSource) {
          if (dbSource.status && dbSource.status !== 'approved') {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường gốc.' });
          }
          sourceTrail = dbSource;
          candidateTrails = await TrailModel.find({
            status: 'approved',
            _id: { $ne: sourceTrail._id },
          })
            .select(
              'id name province district region startLat startLng endLat endLng distanceKm elevationGainM maxAltitudeM durationDays durationHoursNote difficultyLevel coverImage rating reviewCount bestMonths'
            )
            .lean();
        }
      } catch {
        // Fall back to in-memory seed catalog
      }
    }

    if (!sourceTrail) {
      sourceTrail = inMemoryTrails.find((t) => t.id === id) || null;
      if (sourceTrail) {
        candidateTrails = inMemoryTrails
          .filter((t) => t.id !== sourceTrail.id)
          .map((t) => ({
            id: t.id,
            name: t.name,
            province: t.province,
            district: t.district,
            region: t.region,
            startLat: t.startLat,
            startLng: t.startLng,
            endLat: t.endLat,
            endLng: t.endLng,
            distanceKm: t.distanceKm,
            elevationGainM: t.elevationGainM,
            maxAltitudeM: t.maxAltitudeM,
            durationDays: t.durationDays,
            durationHoursNote: t.durationHoursNote,
            difficultyLevel: t.difficultyLevel,
            coverImage: t.coverImage,
            rating: t.rating,
            reviewCount: t.reviewCount,
            bestMonths: t.bestMonths,
          }));
      }
    }

    if (!sourceTrail) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường gốc.' });
    }

    const srcLat = Number(sourceTrail.startLat);
    const srcLng = Number(sourceTrail.startLng);
    const srcAlt = Number(sourceTrail.maxAltitudeM) || 0;
    const srcSlug = String(sourceTrail.id || sourceTrail._id || '');

    if (!Number.isFinite(srcLat) || !Number.isFinite(srcLng)) {
      return res.json({
        success: true,
        count: 0,
        sourceTrail: {
          id: srcSlug,
          name: sourceTrail.name,
          maxAltitudeM: srcAlt,
        },
        data: [],
      });
    }

    const ranked = candidateTrails
      .filter((t) => Number.isFinite(Number(t.startLat)) && Number.isFinite(Number(t.startLng)))
      .filter((t) => String(t.id || t._id || '') !== srcSlug)
      .map((other) => {
        const normalizedTrail = {
          ...other,
          id: other.id || String(other._id),
        };
        const distKm = calculateHaversineDistanceKm(srcLat, srcLng, Number(other.startLat), Number(other.startLng));
        const altitudeDeltaM = Math.round((Number(other.maxAltitudeM) || 0) - srcAlt);
        return {
          trail: normalizedTrail,
          distanceKm: distKm,
          altitudeDeltaM,
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);

    return res.json({
      success: true,
      count: ranked.length,
      sourceTrail: {
        id: sourceTrail.id || String(sourceTrail._id),
        name: sourceTrail.name,
        maxAltitudeM: srcAlt,
      },
      data: ranked,
    });
  } catch (err) {
    console.error('[Get Nearby Trails For Trail Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tìm các cung đường lân cận.' });
  }
};

// GET /api/trails/:id/elevation - Real DEM elevation profile along trail GPX track
export const getTrailElevation = async (req: Request, res: Response) => {
  const id = String(req.params.id || '').trim();
  if (!id) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cung đường.' });
  }

  try {
    let trail: any = null;
    try {
      trail = await resolveTrailByIdOrSlug(id);
    } catch {
      // ignore offline
    }
    if (!trail) {
      trail = inMemoryTrails.find((t) => t.id === id);
    }
    if (!trail) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường.' });
    }

    const track: [number, number][] =
      Array.isArray(trail.gpxTrack) && trail.gpxTrack.length >= 2
        ? trail.gpxTrack
        : [
            [Number(trail.startLat), Number(trail.startLng)],
            [Number(trail.endLat ?? trail.startLat), Number(trail.endLng ?? trail.startLng)],
          ];

    const profile = await fetchTrailDemElevation({
      cacheKey: String(trail.id || trail._id || id),
      gpxTrack: track,
      distanceKm: Number(trail.distanceKm) || 10,
      maxAltitudeM: Number(trail.maxAltitudeM) || 1500,
      elevationGainM: Number(trail.elevationGainM) || 500,
    });

    return res.json({ success: true, data: profile });
  } catch (err) {
    console.error('[Get Trail Elevation Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải trắc diện cao độ.' });
  }
};

// GET /api/trails/:id/permit-template - Real Vietnam Forest / Border Permit Checklist & Registration Sheet
export const getTrailPermitTemplate = async (req: Request, res: Response) => {
  const id = String(req.params.id || '').trim();
  let trail: any = null;
  try {
    trail = await resolveTrailByIdOrSlug(id);
  } catch {
    // offline fallback
  }
  if (!trail) {
    trail = inMemoryTrails.find((t) => t.id === id);
  }
  if (!trail) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường.' });
  }

  const nameLower = `${trail.name || ''} ${trail.permitInfo || ''} ${trail.province || ''}`.toLowerCase();
  const isBorderZone =
    nameLower.includes('biên phòng') ||
    nameLower.includes('mốc') ||
    nameLower.includes('khang su') ||
    nameLower.includes('pu si lung') ||
    nameLower.includes('chung nhía') ||
    nameLower.includes('lai châu') ||
    nameLower.includes('y tý');
  const isNationalPark =
    nameLower.includes('vườn quốc gia') ||
    nameLower.includes('vqg') ||
    nameLower.includes('hoàng liên') ||
    nameLower.includes('bidoup') ||
    nameLower.includes('bạch mã') ||
    nameLower.includes('cát tiên') ||
    nameLower.includes('cúc phương') ||
    nameLower.includes('chư yang sin');

  const checklist: string[] = [
    'CCCD gắn chip / Hộ chiếu bản gốc (và 02 bản photo công chứng/không công chứng theo yêu cầu trạm).',
    'Danh sách đoàn: Họ tên, ngày sinh, số CCCD, địa chỉ thường trú, SĐT cá nhân & SĐT người thân khẩn cấp.',
    'Lịch trình dự kiến chi tiết (ngày vào rừng, điểm cắm trại qua đêm, giờ dự kiến ra khỏi rừng).',
  ];

  if (isNationalPark) {
    checklist.push('Phiếu đăng ký tuyến du lịch sinh thái / phí bảo vệ rừng và phí bảo hiểm du lịch tại Ban Quản lý VQG.');
    checklist.push('Cam kết phòng chống cháy rừng & Không xả rác (Leave No Trace) ký tại Trạm Kiểm lâm cửa rừng.');
  }
  if (isBorderZone) {
    checklist.push('Giấy giới thiệu / Đơn xin phép vào khu vực biên giới (nộp tại Đồn Biên phòng hoặc Công an tỉnh ít nhất 3–5 ngày trước khởi hành).');
  }
  if (trail.difficultyLevel >= 4) {
    checklist.push('Xác nhận đi cùng Porter / Hướng dẫn viên địa phương am hiểu địa hình và quy trình sơ cứu.');
  }

  return res.json({
    success: true,
    data: {
      trailId: trail.id,
      trailName: trail.name,
      province: trail.province,
      permitRequired: Boolean(trail.permitRequired),
      authority:
        trail.permitInfo ||
        (isNationalPark ? `Ban Quản lý VQG khu vực ${trail.province}` : `UBND xã / Kiểm lâm ${trail.province}`),
      isBorderZone,
      isNationalPark,
      rescueContact: trail.rescueContact || {
        name: `Tổng đài Cứu nạn Quốc gia & Kiểm lâm ${trail.province}`,
        phone: '112 / 114',
        rangerContact: '115',
      },
      checklist,
      registrationTemplateText: [
        'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
        'Độc lập - Tự do - Hạnh phúc',
        '---',
        `ĐƠN ĐĂNG KÝ KHÁM PHÁ TUYẾN TREKKING: ${String(trail.name || '').toUpperCase()}`,
        `Kính gửi: ${trail.permitInfo || `Ban Quản lý / Trạm Kiểm lâm ${trail.province}`}`,
        `1. Địa bàn tuyến: ${trail.district ? `${trail.district}, ` : ''}${trail.province}`,
        `2. Cự ly / Thời lượng dự kiến: ${trail.distanceKm} km (${trail.durationHoursNote || `${trail.durationDays} ngày`})`,
        '3. Trưởng đoàn / Người đại diện: [Điền Họ tên - Số CCCD - SĐT]',
        '4. Số lượng thành viên: [Điền số người] (Đính kèm danh sách trích ngang)',
        '5. Cam kết: Tuân thủ tuyệt đối nội quy bảo vệ rừng, PCCC rừng, mang toàn bộ rác ra khỏi rừng và báo cáo kiểm lâm khi kết thúc hành trình.',
      ].join('\n'),
    },
  });
};

// GET /api/trails/:id/og - Structured OpenGraph / SEO Share Metadata
export const getTrailShareMetadata = async (req: Request, res: Response) => {
  const id = String(req.params.id || '').trim();
  let trail: any = null;
  try {
    trail = await resolveTrailByIdOrSlug(id);
  } catch {
    // offline fallback
  }
  if (!trail) {
    trail = inMemoryTrails.find((t) => t.id === id);
  }
  if (!trail) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường.' });
  }

  return res.json({
    success: true,
    data: {
      title: `${trail.name} (${trail.maxAltitudeM}m • ${trail.distanceKm}km) | LOST Việt Nam`,
      description: `${trail.province} • Độ khó ${trail.difficultyLevel}/5 • Tích lũy +${trail.elevationGainM}m. ${(trail.description || '').slice(0, 150)}`,
      image: trail.coverImage || '',
      canonicalPath: `/trails/${trail.id}`,
    },
  });
};

// POST /api/guides/:id/reviews - Submit verified rating/review for a local Porter/Guide
export const createGuideReview = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const guideId = String(req.params.id || '').trim();
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để đánh giá Porter/Guide.' });
    }
    if (!isValidObjectId(guideId)) {
      return res.status(400).json({ success: false, message: 'Mã Hướng dẫn viên không hợp lệ.' });
    }

    const { rating, comment } = req.body || {};
    const numRating = Number(rating);
    if (!Number.isFinite(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, message: 'Điểm đánh giá phải từ 1 đến 5 sao.' });
    }
    const cleanComment = sanitizeInput(String(comment || '')).trim();
    if (cleanComment.length < 5) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập nhận xét tối thiểu 5 ký tự.' });
    }

    if (containsProfanity(cleanComment)) {
      const matched = getProfanityMatch(cleanComment);
      await deductReputationPoints(userId, PENALTY_POINTS.TOXIC_COMMENT, `Đánh giá Porter/Guide chứa từ ngữ vi phạm ("${matched}")`);
      return res.status(400).json({
        success: false,
        message: `Nhận xét chứa từ ngữ vi phạm quy chuẩn cộng đồng ("${matched}").`,
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const [guide, user] = await Promise.all([
      GuideModel.findById(guideId),
      UserModel.findById(userId).select('fullName username').lean(),
    ]);

    if (!guide) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ Porter/Guide.' });
    }

    const userObjId = new mongoose.Types.ObjectId(userId);
    const alreadyReviewed = (guide.reviews || []).some((r) => String(r.userId) === userId);
    if (alreadyReviewed) {
      return res.status(409).json({
        success: false,
        message: 'Bạn đã gửi đánh giá cho Porter/Guide này rồi.',
      });
    }

    // Verify if user has checked into any trail in this guide's region/province
    const userCheckins = await CheckinModel.find({ userId: userObjId })
      .populate('trailId', 'region province id')
      .lean();
    const verifiedTrip = userCheckins.some((c: any) => {
      const t = c.trailId;
      if (!t) return false;
      if (Array.isArray(guide.trailSlugs) && guide.trailSlugs.includes(t.id)) return true;
      if (Array.isArray(guide.provinces) && guide.provinces.some((p) => p.toLowerCase() === String(t.province || '').toLowerCase())) {
        return true;
      }
      return t.region === guide.region;
    });

    const userName = user?.fullName || user?.username || 'Trekker';
    guide.reviews = guide.reviews || [];
    const prevReviewsLen = guide.reviews.length;
    const baselineExternalCount = Math.max(0, (guide.reviewCount || 0) - prevReviewsLen);
    const baselineWeightedSum = baselineExternalCount * (guide.rating || 0);

    guide.reviews.unshift({
      userId: userObjId,
      userName,
      rating: numRating,
      comment: cleanComment.slice(0, 800),
      verifiedTrip,
      createdAt: new Date(),
    });

    const userReviewsScore = guide.reviews.reduce((s, r) => s + r.rating, 0);
    guide.reviewCount = baselineExternalCount + guide.reviews.length;
    guide.rating = Math.round(((baselineWeightedSum + userReviewsScore) / guide.reviewCount) * 10) / 10;
    await guide.save();

    invalidateCache('/api/guides');
    invalidateCache('/api/directory');
    invalidateCache('/api/trails');

    return res.status(201).json({
      success: true,
      message: 'Đã gửi đánh giá Porter/Guide thành công!',
      data: guide,
    });
  } catch (err) {
    console.error('[Create Guide Review Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi gửi đánh giá Porter/Guide.' });
  }
};
