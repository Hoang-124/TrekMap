import { Router } from 'express';
import {
  createLiveBeacon,
  pingLiveBeacon,
  stopLiveBeacon,
  getLiveBeaconByToken,
  adminResolveLiveBeacon,
} from '../controllers/liveBeacon.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

const beaconCreateLimiter = createRateLimiter(
  15,
  15 * 60 * 1000,
  'Bạn tạo phiên Live Beacon quá nhanh. Vui lòng đợi ít phút.',
  'beacon-create'
);

const beaconPingLimiter = createRateLimiter(
  180,
  15 * 60 * 1000,
  'Tần suất cập nhật tọa độ Live Beacon vượt giới hạn cho phép.',
  'beacon-ping'
);

const beaconStopLimiter = createRateLimiter(
  30,
  15 * 60 * 1000,
  'Bạn gửi yêu cầu kết thúc Live Beacon quá nhanh. Vui lòng đợi ít phút.',
  'beacon-stop'
);

const beaconReadLimiter = createRateLimiter(
  120,
  15 * 60 * 1000,
  'Quá nhiều yêu cầu theo dõi Live Beacon. Vui lòng đợi giây lát.',
  'beacon-read'
);

// Mounted at /api/live-beacons
router.patch(
  '/admin/:id/resolve',
  beaconStopLimiter,
  authMiddleware as any,
  requireRole('admin', 'moderator') as any,
  adminResolveLiveBeacon as any
);
router.post('/', beaconCreateLimiter, authMiddleware as any, createLiveBeacon as any);
router.patch('/:token/ping', beaconPingLimiter, authMiddleware as any, pingLiveBeacon as any);
router.post('/:token/stop', beaconStopLimiter, authMiddleware as any, stopLiveBeacon as any);
router.get('/:token', beaconReadLimiter, getLiveBeaconByToken);

export default router;
