import { Request, Response } from 'express';
import { mockTrails, mockGuides } from '../data/seedData.js';
import { Trail } from '../types.js';
import { TrailModel } from '../models/Trail.js';
import { verifyToken } from '../utils/auth.js';
import { containsProfanity, getProfanityMatch } from '../utils/profanityFilter.js';
import { awardReputationPoints, deductReputationPoints, REPUTATION_POINTS, PENALTY_POINTS } from '../utils/reputation.js';

let inMemoryTrails: Trail[] = [...mockTrails];

// Helper: Trigonometric Haversine Distance Formula (in Kilometers)
export function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export const getTrails = async (req: Request, res: Response) => {
  const { region, difficulty, search, duration, campsite, kidFriendly, lat, lng, radiusKm } = req.query;

  // Handle spatial search if GPS lat & lng are provided
  if (lat && lng) {
    return getNearbyTrails(req, res);
  }

  try {
    const query: any = {};
    if (region && region !== 'All') {
      query.region = region;
    }
    if (difficulty) {
      query.difficultyLevel = parseInt(difficulty as string, 10);
    }
    if (duration) {
      query.durationDays = parseInt(duration as string, 10);
    }
    if (campsite === 'true') {
      query.hasCampsite = true;
    }
    if (kidFriendly === 'true') {
      query.kidFriendly = true;
    }
    if (search) {
      const regex = new RegExp(search as string, 'i');
      query.$or = [{ name: regex }, { province: regex }, { description: regex }];
    }

    const dbTrails = await TrailModel.find(query).exec();
    if (dbTrails && dbTrails.length > 0) {
      return res.json({ success: true, count: dbTrails.length, data: dbTrails });
    }
  } catch (err) {
    // Fallthrough to in-memory store if DB query fails
  }

  // In-Memory Fallback
  let filtered = [...inMemoryTrails];

  if (region && region !== 'All') {
    filtered = filtered.filter((t) => t.region.toLowerCase() === (region as string).toLowerCase());
  }

  if (difficulty) {
    const diffNum = parseInt(difficulty as string, 10);
    filtered = filtered.filter((t) => t.difficultyLevel === diffNum);
  }

  if (duration) {
    const durNum = parseInt(duration as string, 10);
    filtered = filtered.filter((t) => t.durationDays === durNum);
  }

  if (campsite === 'true') {
    filtered = filtered.filter((t) => t.hasCampsite);
  }

  if (kidFriendly === 'true') {
    filtered = filtered.filter((t) => t.kidFriendly);
  }

  if (search) {
    const s = (search as string).toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.name.toLowerCase().includes(s) ||
        t.province.toLowerCase().includes(s) ||
        t.description.toLowerCase().includes(s)
    );
  }

  return res.json({ success: true, count: filtered.length, data: filtered });
};

// 2dsphere Spatial Query: GET /api/trails/nearby?lat={lat}&lng={lng}&radiusKm={radiusKm}
export const getNearbyTrails = async (req: Request, res: Response) => {
  const latitude = parseFloat(req.query.lat as string);
  const longitude = parseFloat(req.query.lng as string);
  const radiusKm = parseFloat(req.query.radiusKm as string) || 50;

  if (isNaN(latitude) || isNaN(longitude)) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp tọa độ GPS hợp lệ (lat, lng).',
    });
  }

  const radiusMeters = radiusKm * 1000;
  const startTimeMs = performance.now();

  try {
    // 1. High-Speed MongoDB 2dsphere Spatial Query ($near)
    const dbTrails = await TrailModel.find({
      startLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: radiusMeters,
        },
      },
    }).lean().exec();

    const queryExecutionTimeMs = Math.round((performance.now() - startTimeMs) * 100) / 100;

    if (dbTrails && dbTrails.length > 0) {
      const dataWithDistance = dbTrails.map((trail: any) => {
        const distKm = calculateHaversineDistanceKm(latitude, longitude, trail.startLat, trail.startLng);
        return {
          ...trail,
          distanceFromUserKm: distKm,
          estimatedRoadDistanceKm: Math.round(distKm * 1.9),
        };
      });

      return res.json({
        success: true,
        count: dataWithDistance.length,
        radiusKm,
        executionTimeMs: queryExecutionTimeMs,
        userCoordinates: { lat: latitude, lng: longitude },
        data: dataWithDistance,
      });
    }
  } catch (err) {
    console.warn('⚠️ [2dsphere Query Notice]: Falling back to in-memory Haversine calculation.', (err as Error).message);
  }

  // 2. High-Speed In-Memory Haversine Spatial Filtering Fallback
  const nearbyMemoryTrails = inMemoryTrails
    .map((t) => {
      const distKm = calculateHaversineDistanceKm(latitude, longitude, t.startLat, t.startLng);
      return {
        ...t,
        distanceFromUserKm: distKm,
        estimatedRoadDistanceKm: Math.round(distKm * 1.9),
      };
    })
    .filter((t) => t.distanceFromUserKm <= radiusKm)
    .sort((a, b) => a.distanceFromUserKm - b.distanceFromUserKm);

  const totalTimeMs = Math.round((performance.now() - startTimeMs) * 100) / 100;

  return res.json({
    success: true,
    count: nearbyMemoryTrails.length,
    radiusKm,
    executionTimeMs: totalTimeMs,
    userCoordinates: { lat: latitude, lng: longitude },
    data: nearbyMemoryTrails,
  });
};

export const getTrailById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const dbTrail = await TrailModel.findById(id).exec();
    if (dbTrail) {
      return res.json({ success: true, data: dbTrail });
    }
  } catch (err) {}

  const trail = inMemoryTrails.find((t) => t.id === id);

  if (!trail) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường này.' });
  }

  return res.json({ success: true, data: trail });
};

export const getGuides = (req: Request, res: Response) => {
  const { region } = req.query;
  let filtered = [...mockGuides];

  if (region) {
    filtered = filtered.filter((g) => g.region.toLowerCase().includes((region as string).toLowerCase()));
  }

  return res.json({ success: true, count: filtered.length, data: filtered });
};

export const createContribution = async (req: Request, res: Response) => {
  const newTrailData = req.body;

  if (!newTrailData.name || !newTrailData.region || !newTrailData.province) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin cung đường cơ bản.' });
  }

  let reputationReward = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded?.userId) {
      reputationReward = await awardReputationPoints(
        decoded.userId,
        REPUTATION_POINTS.CONTRIBUTE_TRAIL,
        'Đóng góp cung đường mới'
      );
    }
  }

  const newTrail: Trail = {
    id: `trail-${Date.now()}`,
    name: newTrailData.name,
    district: newTrailData.district || 'Sa Pả',
    region: newTrailData.region || 'Miền Bắc',
    province: newTrailData.province,
    startLat: newTrailData.startLat || 22.3364,
    startLng: newTrailData.startLng || 103.8438,
    endLat: newTrailData.endLat || 22.3032,
    endLng: newTrailData.endLng || 103.7753,
    distanceKm: newTrailData.distanceKm || 12,
    elevationGainM: newTrailData.elevationGainM || 1000,
    maxAltitudeM: newTrailData.maxAltitudeM || 2000,
    durationDays: newTrailData.durationDays || 2,
    durationHoursNote: newTrailData.durationHoursNote || '2 Ngày 1 Đêm',
    difficultyLevel: newTrailData.difficultyLevel || 3,
    difficultyNote: newTrailData.difficultyNote || 'Trung bình',
    bestMonths: newTrailData.bestMonths || [10, 11, 12, 1, 2, 3, 4],
    avoidMonths: newTrailData.avoidMonths || [6, 7, 8],
    gpxTrack: newTrailData.gpxTrack || [
      [22.3364, 103.8438],
      [22.3200, 103.8100],
      [22.3032, 103.7753],
    ],
    rating: 5.0,
    reviewCount: 1,
    description: newTrailData.description || 'Bài đóng góp cung đường mới từ cộng đồng.',
    transportationInfo: newTrailData.transportationInfo || 'Di chuyển bằng xe khách giường nằm.',
    permitRequired: newTrailData.permitRequired || false,
    permitInfo: newTrailData.permitInfo || 'Tự do đi lại.',
    status: 'approved',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    coverImage: newTrailData.coverImage || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
    hasCampsite: newTrailData.hasCampsite || true,
    hasWaterSource: newTrailData.hasWaterSource || true,
    kidFriendly: newTrailData.kidFriendly || false,
    rescueContact: {
      name: newTrailData.rescueName || 'Cứu hộ Địa phương',
      phone: newTrailData.rescuePhone || '114 / 115',
      rangerContact: newTrailData.rangerContact || 'Hạt kiểm lâm',
    },
    waypoints: newTrailData.waypoints || [],
  };

  inMemoryTrails.unshift(newTrail);

  try {
    const { createdBy, ...trailDataToSave } = newTrail;
    await TrailModel.create({
      ...trailDataToSave,
      startLocation: {
        type: 'Point',
        coordinates: [newTrail.startLng, newTrail.startLat],
      },
    });
  } catch (err) {}

  return res.status(201).json({
    success: true,
    message: 'Đóng góp cung đường mới thành công! Bạn đã nhận +50 điểm uy tín!',
    data: newTrail,
    reputationReward,
  });
};

export const createReview = async (req: Request, res: Response) => {
  const { trailId, rating, difficultyRating, content } = req.body;

  const trail = inMemoryTrails.find((t) => t.id === trailId);
  if (!trail) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường.' });
  }

  // Check automated profanity & toxic content filter
  if (content && containsProfanity(content)) {
    const matchedWord = getProfanityMatch(content);
    let penaltyInfo = null;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      if (decoded?.userId) {
        penaltyInfo = await deductReputationPoints(
          decoded.userId,
          PENALTY_POINTS.TOXIC_COMMENT,
          `Đánh giá chứa từ ngữ thô tục ("${matchedWord}")`
        );
      }
    }

    return res.status(400).json({
      success: false,
      message: `Đánh giá bị từ chối do chứa từ ngữ vi phạm quy chuẩn ("${matchedWord}"). Bạn bị trừ ${PENALTY_POINTS.TOXIC_COMMENT} điểm uy tín.`,
      penaltyInfo,
    });
  }

  let reputationReward = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded?.userId) {
      reputationReward = await awardReputationPoints(
        decoded.userId,
        REPUTATION_POINTS.CONTRIBUTE_REVIEW,
        'Đánh giá trải nghiệm cung đường'
      );
    }
  }

  const review = {
    id: `rev-${Date.now()}`,
    trailId,
    userId: 'user-1',
    userName: 'MinhTrekker (Verified)',
    userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
    rating: rating || 5,
    difficultyRating: difficultyRating || 3,
    content: content || 'Bài viết rất hữu ích!',
    tripDate: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  };

  return res.status(201).json({
    success: true,
    message: 'Gửi đánh giá thành công! Bạn nhận được +20 điểm uy tín.',
    data: review,
    reputationReward,
  });
};
