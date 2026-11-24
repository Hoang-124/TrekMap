import { Router } from 'express';
import {
  chatWithAi,
  chatWithAiStream,
  getQuickPrompts,
  assessTrailGoNoGo,
  listAiThreads,
  createAiThread,
  getAiThreadDetail,
  updateAiThread,
  deleteAiThread,
  analyzeGpxHandler,
  bioCalcHandler,
  recommendTrailsHandler,
  auditPackHandler,
  compareTrailsHandler,
  expeditionBriefHandler,
  analyzeImageHandler,
  pacePlanHandler,
  fuelPlanHandler,
  readinessAuditHandler,
} from '../controllers/ai.controller.js';
import { optionalAuthMiddleware } from '../middleware/auth.middleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.middleware.js';
import { routeCache } from '../middleware/cache.middleware.js';

const router = Router();

// Dedicated isolated rate limiters so Go/No-Go, thread reads, or bio-calc never starve AI Chat
const aiChatRateLimiter = createRateLimiter(
  35,
  15 * 60 * 1000,
  'Bạn đã gửi quá nhiều câu hỏi tới LOST AI. Vui lòng thử lại sau ít phút.',
  'ai-chat'
);

const aiVisionRateLimiter = createRateLimiter(
  15,
  15 * 60 * 1000,
  'Bạn đã gửi quá nhiều ảnh phân tích tới LOST AI. Vui lòng thử lại sau ít phút.',
  'ai-vision'
);

const aiToolRateLimiter = createRateLimiter(
  60,
  15 * 60 * 1000,
  'Bạn đang chạy quá nhiều phân tích Go/No-Go hoặc GPX. Vui lòng thử lại sau ít phút.',
  'ai-tools'
);

const aiThreadRateLimiter = createRateLimiter(
  120,
  15 * 60 * 1000,
  'Quá nhiều yêu cầu đồng bộ hội thoại AI. Vui lòng đợi giây lát.',
  'ai-threads'
);

// Chat & Alpine Tools (all auth-aware via optionalAuthMiddleware)
router.post('/chat', optionalAuthMiddleware as any, aiChatRateLimiter, chatWithAi as any);
router.post('/chat/stream', optionalAuthMiddleware as any, aiChatRateLimiter, chatWithAiStream as any);
router.post('/analyze-image', optionalAuthMiddleware as any, aiVisionRateLimiter, analyzeImageHandler as any);
router.post('/go-no-go', optionalAuthMiddleware as any, aiToolRateLimiter, assessTrailGoNoGo as any);
router.post('/analyze-gpx', optionalAuthMiddleware as any, aiToolRateLimiter, analyzeGpxHandler as any);
router.post('/bio-calc', optionalAuthMiddleware as any, aiToolRateLimiter, bioCalcHandler as any);
router.post('/recommend', optionalAuthMiddleware as any, aiToolRateLimiter, recommendTrailsHandler as any);
router.post('/audit-pack', optionalAuthMiddleware as any, aiToolRateLimiter, auditPackHandler as any);
router.post('/compare', optionalAuthMiddleware as any, aiToolRateLimiter, compareTrailsHandler as any);
router.post('/expedition-brief', optionalAuthMiddleware as any, aiToolRateLimiter, expeditionBriefHandler as any);
router.post('/pace-plan', optionalAuthMiddleware as any, aiToolRateLimiter, pacePlanHandler as any);
router.post('/fuel-plan', optionalAuthMiddleware as any, aiToolRateLimiter, fuelPlanHandler as any);
router.post('/readiness-audit', optionalAuthMiddleware as any, aiToolRateLimiter, readinessAuditHandler as any);
router.get('/quick-prompts', aiToolRateLimiter, routeCache(120), optionalAuthMiddleware as any, getQuickPrompts as any);

// Persistent Multi-Turn Chat Thread CRUD
router.get('/threads', optionalAuthMiddleware as any, aiThreadRateLimiter, listAiThreads as any);
router.post('/threads', optionalAuthMiddleware as any, aiThreadRateLimiter, createAiThread as any);
router.get('/threads/:threadId', optionalAuthMiddleware as any, aiThreadRateLimiter, getAiThreadDetail as any);
router.patch('/threads/:threadId', optionalAuthMiddleware as any, aiThreadRateLimiter, updateAiThread as any);
router.delete('/threads/:threadId', optionalAuthMiddleware as any, aiThreadRateLimiter, deleteAiThread as any);

export default router;
