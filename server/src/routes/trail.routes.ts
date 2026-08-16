import { Router } from 'express';
import { getTrails, getNearbyTrails, getTrailById, getGuides, createContribution, createReview, getTrailReviews } from '../controllers/trail.controller.js';
import { getWeatherByTrailId } from '../controllers/weather.controller.js';
import { createItinerary, getItineraryByShareToken } from '../controllers/itinerary.controller.js';
import { handleReverseGeocode } from '../controllers/geocoding.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { routeCache } from '../middleware/cache.middleware.js';

const router = Router();

// Public READ routes (with Caching)
router.get('/trails/nearby', routeCache(120), getNearbyTrails);
router.get('/trails', routeCache(300), getTrails);
router.get('/trails/:id', routeCache(300), getTrailById);
router.get('/trails/:id/reviews', getTrailReviews);
router.get('/guides', routeCache(600), getGuides);
router.get('/weather/:trailId', routeCache(300), getWeatherByTrailId);
router.get('/geocode/reverse', routeCache(3600), handleReverseGeocode);
router.get('/itineraries/share/:shareToken', getItineraryByShareToken);

// Protected WRITE routes (Require Authentication)
router.post('/itineraries', authMiddleware as any, createItinerary as any);
router.post('/contributions', authMiddleware as any, createContribution as any);
router.post('/reviews', authMiddleware as any, createReview as any);

export default router;
