import { Router } from 'express';
import {
  getMyWeatherAlerts,
  upsertWeatherAlert,
  deleteWeatherAlert,
  evaluateMyWeatherAlerts,
} from '../controllers/weatherAlert.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { createRateLimiter, createUserRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

// Generous pre-auth IP shield against unauthenticated floods (never blocks CGNAT users)
const weatherAlertIpShield = createRateLimiter(
  180,
  15 * 60 * 1000,
  'Hệ thống cảnh báo thời tiết đang nhận quá nhiều yêu cầu từ mạng này. Vui lòng thử lại sau.',
  'weather-alert-ip-shield'
);

const weatherAlertReadLimiter = createUserRateLimiter(
  60,
  15 * 60 * 1000,
  'Bạn tải danh sách cảnh báo thời tiết quá nhanh. Vui lòng đợi giây lát.',
  'weather-alert-read'
);

const weatherAlertWriteLimiter = createUserRateLimiter(
  30,
  15 * 60 * 1000,
  'Bạn cập nhật cảnh báo thời tiết quá nhanh. Vui lòng đợi ít phút.',
  'weather-alert-write'
);

const weatherAlertEvalLimiter = createUserRateLimiter(
  15,
  15 * 60 * 1000,
  'Bạn kiểm tra cảnh báo thời tiết quá thường xuyên. Vui lòng đợi ít phút.',
  'weather-alert-eval'
);

// Mounted at /api/weather-alerts (all routes enforce authMiddleware + per-user rate limiting)
router.get('/me', weatherAlertIpShield, authMiddleware as any, weatherAlertReadLimiter as any, getMyWeatherAlerts as any);
router.post('/evaluate', weatherAlertIpShield, authMiddleware as any, weatherAlertEvalLimiter as any, evaluateMyWeatherAlerts as any);
router.post('/', weatherAlertIpShield, authMiddleware as any, weatherAlertWriteLimiter as any, upsertWeatherAlert as any);
router.delete('/:trailId', weatherAlertIpShield, authMiddleware as any, weatherAlertWriteLimiter as any, deleteWeatherAlert as any);

export default router;
