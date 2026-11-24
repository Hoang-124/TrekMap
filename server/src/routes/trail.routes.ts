import { Router, Response, NextFunction } from 'express';
import {
  getTrails,
  getNearbyTrails,
  getNearbyTrailsForTrail,
  getPlatformStatsSummary,
  getTrailById,
  getGuides,
  getTrailGuides,
  createReview,
  deleteReview,
  getTrailReviews,
  getTrailElevation,
  getTrailPermitTemplate,
  getTrailShareMetadata,
  createGuideReview,
} from '../controllers/trail.controller.js';
import {
  getWeatherByTrailId,
  getWeatherByCoordinates,
  getLiveSummitsWeather,
  compareMultiTrailWeather,
  getTrailClimateNormals,
} from '../controllers/weather.controller.js';
import { getMyAnnualGoals, updateMyAnnualGoals } from '../controllers/user.controller.js';
import {
  createItinerary,
  getItineraryByShareToken,
  getMyItineraries,
  deleteItinerary,
} from '../controllers/itinerary.controller.js';
import { handleReverseGeocode } from '../controllers/geocoding.controller.js';
import { authMiddleware, optionalAuthMiddleware, type AuthRequest } from '../middleware/auth.middleware.js';
import { routeCache } from '../middleware/cache.middleware.js';
import { geocodeRateLimiter, createRateLimiter } from '../middleware/rateLimiter.middleware.js';

interface UserGoalsRateBucket {
  timestamps: number[];
  expiresAt: number;
}

const MAX_USER_GOALS_BUCKETS = 10_000;

function createUserGoalsRateLimiter(maxRequests: number, windowMs: number, message: string, prefix: string) {
  const store = new Map<string, UserGoalsRateBucket>();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, rec] of store.entries()) {
      if (rec.expiresAt <= now) store.delete(k);
    }
  }, 60_000);
  timer.unref();

  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const identity = req.user?.userId ? `u:${req.user.userId}` : `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    const key = `${prefix}:${identity}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    let record = store.get(key);
    if (!record) {
      if (store.size >= MAX_USER_GOALS_BUCKETS) {
        for (const [k, rec] of store.entries()) {
          if (rec.expiresAt <= now) store.delete(k);
        }
        if (store.size >= MAX_USER_GOALS_BUCKETS) {
          const oldest = store.keys().next().value;
          if (oldest) store.delete(oldest);
        }
      }
      record = { timestamps: [now], expiresAt: now + windowMs };
      store.set(key, record);
    } else {
      record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
      record.timestamps.push(now);
      record.expiresAt = now + windowMs;
      store.delete(key);
      store.set(key, record);
    }

    const count = record.timestamps.length;
    const oldestHit = record.timestamps[0] || now;
    const resetTime = oldestHit + windowMs;

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));

    if (count > maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((resetTime - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({ success: false, message, retryAfterSec });
    }
    return next();
  };
}

const router = Router();
const weatherCompareLimiter = createRateLimiter(
  45,
  15 * 60 * 1000,
  'Bạn so sánh thời tiết quá nhanh. Vui lòng thử lại sau ít phút.',
  'weather-compare'
);
const weatherClimateLimiter = createRateLimiter(
  45,
  15 * 60 * 1000,
  'Bạn tra cứu dữ liệu khí hậu quá nhanh. Vui lòng thử lại sau ít phút.',
  'weather-climate'
);
const userGoalsReadIpShield = createRateLimiter(
  300,
  15 * 60 * 1000,
  'Quá nhiều yêu cầu tải mục tiêu năm từ mạng này. Vui lòng đợi giây lát.',
  'user-goals-read-ip'
);
const userGoalsWriteIpShield = createRateLimiter(
  180,
  15 * 60 * 1000,
  'Quá nhiều yêu cầu cập nhật mục tiêu năm từ mạng này. Vui lòng thử lại sau.',
  'user-goals-write-ip'
);
const userGoalsReadLimiter = createUserGoalsRateLimiter(
  120,
  15 * 60 * 1000,
  'Bạn tải mục tiêu năm quá nhanh. Vui lòng đợi giây lát.',
  'user-goals-read'
);
const userGoalsWriteLimiter = createUserGoalsRateLimiter(
  30,
  15 * 60 * 1000,
  'Bạn cập nhật mục tiêu năm quá nhanh. Vui lòng thử lại sau ít phút.',
  'user-goals-write'
);

// Public READ routes (with Caching)
router.get('/trails/stats/summary', routeCache(120), getPlatformStatsSummary);
router.get('/trails/nearby', routeCache(120), getNearbyTrails);
router.get('/trails', routeCache(300), getTrails);
router.get('/trails/:id', optionalAuthMiddleware as any, routeCache(300), getTrailById as any);
router.get('/trails/:id/nearby-trails', routeCache(300), getNearbyTrailsForTrail);
router.get('/trails/:id/elevation', routeCache(1800), getTrailElevation);
router.get('/trails/:id/permit-template', routeCache(600), getTrailPermitTemplate);
router.get('/trails/:id/og', routeCache(600), getTrailShareMetadata);
router.get('/trails/:id/reviews', getTrailReviews);
router.delete('/trails/:id/reviews/:reviewId', authMiddleware as any, deleteReview as any);
router.get('/trails/:id/guides', routeCache(600), getTrailGuides);
router.get('/guides', routeCache(600), getGuides);
router.post('/guides/:id/reviews', authMiddleware as any, createGuideReview as any);
// NOTE: Specific `/weather/summits-live`, `/weather/compare`, `/weather/forecast`, and `/weather/climate/:trailId` MUST be registered before `/weather/:trailId`
// `/weather/summits-live`, `/weather/compare`, and `/weather/climate/:trailId` manage their own internal SWR caches (avoid double-caching via routeCache)
router.get('/weather/summits-live', getLiveSummitsWeather);
router.get('/weather/compare', weatherCompareLimiter, compareMultiTrailWeather);
router.get('/weather/forecast', routeCache(120), getWeatherByCoordinates);
router.get('/weather/climate/:trailId', weatherClimateLimiter, getTrailClimateNormals);
router.get('/weather/:trailId', routeCache(120), getWeatherByTrailId);
router.get('/geocode/reverse', geocodeRateLimiter, routeCache(3600), handleReverseGeocode);
router.get('/itineraries/me', authMiddleware as any, getMyItineraries as any);
router.get('/itineraries/share/:shareToken', getItineraryByShareToken);

// Authenticated User Annual Goals (mounted at /api -> /api/users/me/goals, registered before followRoutes /users/:id/*)
// Split read (120/15m) vs write (30/15m) limiters so profile tab loads never starve PATCH quota
router.get('/users/me/goals', userGoalsReadIpShield, authMiddleware as any, userGoalsReadLimiter as any, getMyAnnualGoals as any);
router.patch('/users/me/goals', userGoalsWriteIpShield, authMiddleware as any, userGoalsWriteLimiter as any, updateMyAnnualGoals as any);

// Protected WRITE routes (Require Authentication)
router.post('/itineraries', authMiddleware as any, createItinerary as any);
router.delete('/itineraries/:shareToken', authMiddleware as any, deleteItinerary as any);
router.post('/reviews', authMiddleware as any, createReview as any);

export default router;
