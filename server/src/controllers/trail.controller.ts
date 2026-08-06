import { Request, Response } from 'express';
import { mockTrails, mockGuides } from '../data/seedData.js';
import { Trail } from '../types.js';
import { TrailModel } from '../models/Trail.js';
import { ReviewModel } from '../models/Review.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
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
  const { region, difficulty, search, duration, campsite, kidFriendly, lat, lng, radiusKm, sortBy } = req.query;

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

    const sortOptions: any = {};
    if (sortBy === 'rating_desc' || sortBy === 'rating') {
      sortOptions.rating = -1;
    } else if (sortBy === 'distance_asc') {
      sortOptions.distanceKm = 1;
    } else if (sortBy === 'distance_desc') {
      sortOptions.distanceKm = -1;
    } else if (sortBy === 'difficulty_asc') {
      sortOptions.difficultyLevel = 1;
    } else if (sortBy === 'difficulty_desc') {
      sortOptions.difficultyLevel = -1;
    } else if (sortBy === 'duration_asc') {
      sortOptions.durationDays = 1;
    } else if (sortBy === 'duration_desc') {
      sortOptions.durationDays = -1;
    }

    const dbTrails = await TrailModel.find(query).sort(sortOptions).exec();
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

  // In-memory Sorting
  if (sortBy === 'rating_desc' || sortBy === 'rating') {
    filtered.sort((a, b) => b.rating - a.rating);
  } else if (sortBy === 'distance_asc') {
    filtered.sort((a, b) => a.distanceKm - b.distanceKm);
  } else if (sortBy === 'distance_desc') {
    filtered.sort((a, b) => b.distanceKm - a.distanceKm);
  } else if (sortBy === 'difficulty_asc') {
    filtered.sort((a, b) => a.difficultyLevel - b.difficultyLevel);
  } else if (sortBy === 'difficulty_desc') {
    filtered.sort((a, b) => b.difficultyLevel - a.difficultyLevel);
  } else if (sortBy === 'duration_asc') {
    filtered.sort((a, b) => a.durationDays - b.durationDays);
  } else if (sortBy === 'duration_desc') {
    filtered.sort((a, b) => b.durationDays - a.durationDays);
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
    // 1. High-Speed MongoDB 2dsphere Spatial Query ($near) with 150ms timeout race
    const mongoPromise = TrailModel.find({
      startLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: radiusMeters,
        },
      },
    }).maxTimeMS(200).lean().exec();

    const timeoutPromise = new Promise<any[]>((_, reject) =>
      setTimeout(() => reject(new Error('Spatial DB query timeout')), 150)
    );

    const dbTrails = await Promise.race([mongoPromise, timeoutPromise]);

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
  const { trailId, rating, difficultyRating, content, safetyNote, photos, tripDate } = req.body;

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
  let userId = null;
  let userName = 'Trekker Ẩn Danh';
  let userAvatar = 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329093/trekmap/avatars/avatar_user_1.jpg';

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded?.userId) {
      userId = decoded.userId;
      reputationReward = await awardReputationPoints(
        decoded.userId,
        REPUTATION_POINTS.CONTRIBUTE_REVIEW,
        'Đánh giá trải nghiệm cung đường'
      );
    }
  }

  let newReviewDoc = null;
  try {
    newReviewDoc = await ReviewModel.create({
      trailId: trailId as any,
      userId: userId as any,
      userName: req.body.userName || userName,
      userAvatar: req.body.userAvatar || userAvatar,
      rating: rating || 5,
      difficultyRating: difficultyRating || 3,
      content: content || 'Bài đánh giá hữu ích!',
      safetyNote: safetyNote || '',
      photos: photos || [],
      tripDate: tripDate || new Date().toISOString().split('T')[0],
    });

    // Recalculate average rating & update reviewCount on Trail document in MongoDB
    const trailReviews = await ReviewModel.find({ trailId: trailId as any });
    if (trailReviews.length > 0) {
      const avgRating = Math.round((trailReviews.reduce((acc, r) => acc + r.rating, 0) / trailReviews.length) * 10) / 10;
      await TrailModel.findByIdAndUpdate(trailId, {
        rating: avgRating,
        reviewCount: trailReviews.length,
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('[MongoDB Review Save Warning]:', err);
  }

  const review = newReviewDoc ? newReviewDoc.toObject() : {
    id: `rev-${Date.now()}`,
    trailId,
    userName: req.body.userName || userName,
    userAvatar: req.body.userAvatar || userAvatar,
    rating: rating || 5,
    difficultyRating: difficultyRating || 3,
    content: content || 'Bài viết rất hữu ích!',
    safetyNote,
    tripDate: tripDate || new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  };

  return res.status(201).json({
    success: true,
    message: 'Gửi đánh giá thành công! Bạn nhận được +20 điểm uy tín.',
    data: review,
    reputationReward,
  });
};

// GET /api/trails/:id/reviews - Fetch reviews for a specific trail
export const getTrailReviews = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const reviews = await ReviewModel.find({ trailId: id as any }).sort({ createdAt: -1 }).lean().exec();
    return res.json({ success: true, count: reviews.length, data: reviews });
  } catch (err) {
    return res.json({ success: true, count: 0, data: [] });
  }
};

// Admin POST /api/admin/trails - Create new Trail directly
export const createTrailAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền tạo Trail.' });
    }
    const data = req.body;
    if (!data.name || !data.province || !data.region) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin tên cung đường, tỉnh hoặc vùng miền.' });
    }

    const startLat = data.startLat || data.startLocation?.lat || 22.3364;
    const startLng = data.startLng || data.startLocation?.lng || 103.8438;

    const newTrail = await TrailModel.create({
      district: data.district || data.province || 'Chưa xác định',
      durationHoursNote: data.durationHoursNote || `${(data.durationDays || 2) * 8}-${(data.durationDays || 2) * 10} giờ`,
      coverImage: data.coverImage || 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329089/trekmap/trails/default.jpg',
      transportationInfo: data.transportationInfo || 'Liên hệ ban tổ chức để biết thêm thông tin.',
      ...data,
      startLat,
      startLng,
      startLocation: {
        type: 'Point',
        coordinates: [startLng, startLat],
      },
      status: 'approved',
    });

    inMemoryTrails.unshift(newTrail.toObject() as any);
    return res.status(201).json({ success: true, message: 'Tạo cung đường mới thành công!', data: newTrail });
  } catch (err) {
    console.error('[Create Trail Admin Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo cung đường.' });
  }
};

// Admin PUT /api/admin/trails/:id - Update existing Trail
export const updateTrailAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền cập nhật Trail.' });
    }
    const { id } = req.params;
    const update = req.body;

    if (update.startLat || update.startLng) {
      update.startLocation = {
        type: 'Point',
        coordinates: [update.startLng || 103.8438, update.startLat || 22.3364],
      };
    }

    const updated = await TrailModel.findByIdAndUpdate(id, update, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường để cập nhật.' });
    }

    return res.json({ success: true, message: 'Cập nhật thông tin cung đường thành công!', data: updated });
  } catch (err) {
    console.error('[Update Trail Admin Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật cung đường.' });
  }
};

// Admin DELETE /api/admin/trails/:id - Delete Trail
export const deleteTrailAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền xóa Trail.' });
    }
    const { id } = req.params;
    await TrailModel.findByIdAndDelete(id);
    await ReviewModel.deleteMany({ trailId: id as any }).catch(() => {});

    const idx = inMemoryTrails.findIndex((t) => t.id === id);
    if (idx >= 0) inMemoryTrails.splice(idx, 1);

    return res.json({ success: true, message: 'Đã xóa cung đường thành công!' });
  } catch (err) {
    console.error('[Delete Trail Admin Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa cung đường.' });
  }
};

// Admin DELETE /api/reviews/:id - Delete review
export const deleteReview = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền xóa đánh giá.' });
    }
    const { id } = req.params;
    const review = await ReviewModel.findByIdAndDelete(id);
    if (review && review.trailId) {
      await TrailModel.findByIdAndUpdate(review.trailId, { $inc: { reviewCount: -1 } }).catch(() => {});
    }
    return res.json({ success: true, message: 'Đã xóa đánh giá thành công!' });
  } catch (err) {
    console.error('[Delete Review Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa đánh giá.' });
  }
};
