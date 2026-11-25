import { Router } from 'express';
import {
  getTrailPoisByTrail,
  createTrailPoi,
  toggleConfirmTrailPoi,
  updateTrailPoiStatus,
  deleteTrailPoi,
  getPlatformPulse,
} from '../controllers/trailPoi.controller.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware.js';
import { createRateLimiter, createUserRateLimiter } from '../middleware/rateLimiter.middleware.js';

// Separate read vs write IP limiters so heavy public browsing on shared CGNAT never locks out authenticated writes
const poiReadIpLimiter = createRateLimiter(
  240,
  15 * 60 * 1000,
  'Quá nhiều yêu cầu tải điểm thực địa từ mạng này. Vui lòng đợi giây lát.',
  'trail-poi-read-ip'
);
const poiWriteIpShield = createRateLimiter(
  180,
  15 * 60 * 1000,
  'Quá nhiều yêu cầu gửi điểm thực địa từ mạng này. Vui lòng thử lại sau.',
  'trail-poi-write-ip'
);
const poiCreateLimiter = createUserRateLimiter(
  20,
  15 * 60 * 1000,
  'Bạn báo điểm thực địa mới quá nhanh. Vui lòng đợi ít phút.',
  'trail-poi-create'
);
const poiConfirmLimiter = createUserRateLimiter(
  60,
  15 * 60 * 1000,
  'Bạn xác nhận điểm thực địa quá nhanh. Vui lòng đợi giây lát.',
  'trail-poi-confirm'
);
const poiManageLimiter = createUserRateLimiter(
  30,
  15 * 60 * 1000,
  'Bạn thao tác quản lý điểm thực địa quá nhanh. Vui lòng đợi ít phút.',
  'trail-poi-manage'
);
const pulseLimiter = createRateLimiter(
  120,
  15 * 60 * 1000,
  'Bạn tải dữ liệu nhịp đập thực địa quá nhanh. Vui lòng đợi giây lát.',
  'platform-pulse'
);

const router = Router();

// Mounted at /api/trail-pois
router.get('/trail/:trailId', poiReadIpLimiter, optionalAuthMiddleware as any, getTrailPoisByTrail as any);
router.post('/', poiWriteIpShield, authMiddleware as any, poiCreateLimiter as any, createTrailPoi as any);
router.post('/:id/confirm', poiWriteIpShield, authMiddleware as any, poiConfirmLimiter as any, toggleConfirmTrailPoi as any);
router.patch('/:id/status', poiWriteIpShield, authMiddleware as any, poiManageLimiter as any, updateTrailPoiStatus as any);
router.delete('/:id', poiWriteIpShield, authMiddleware as any, poiManageLimiter as any, deleteTrailPoi as any);

// Mounted at /api/analytics
export const analyticsRoutes = Router();
analyticsRoutes.get('/platform-pulse', pulseLimiter, getPlatformPulse);

export default router;
