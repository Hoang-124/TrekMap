import { Router } from 'express';
import { getTrails, getNearbyTrails, getTrailById, getGuides, createContribution, createReview } from '../controllers/trail.controller.js';
import { getWeatherByTrailId } from '../controllers/weather.controller.js';
import { createItinerary, getItineraryByShareToken } from '../controllers/itinerary.controller.js';
import { handleReverseGeocode } from '../controllers/geocoding.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// Public READ routes
router.get('/trails/nearby', getNearbyTrails);
router.get('/trails', getTrails);
router.get('/trails/:id', getTrailById);
router.get('/guides', getGuides);
router.get('/weather/:trailId', getWeatherByTrailId);
router.get('/geocode/reverse', handleReverseGeocode);
router.get('/itineraries/share/:shareToken', getItineraryByShareToken);

// Protected WRITE routes (Require Authentication)
router.post('/itineraries', authMiddleware as any, createItinerary as any);
router.post('/contributions', authMiddleware as any, createContribution as any);
router.post('/reviews', authMiddleware as any, createReview as any);

export default router;
