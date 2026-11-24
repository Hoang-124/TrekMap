import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import {
  getAiResponse,
  getContextualQuickPrompts,
  getAllAvailableTrails,
  removeEmojis,
  validateAndDecodeTriageImage,
  analyzeAlpineImage,
} from '../services/ai.service.js';
import { computeTrailGoNoGo, isValidCalendarDateIso, getVietnamTodayIso } from '../services/goNoGo.service.js';
import { calculateAlpineBioMetrics } from '../services/aiBioCalculator.service.js';
import { analyzeGpxTrack, type RawGpxPoint } from '../services/gpxAnalyzer.service.js';
import { recommendVietnamTrails, auditTrailPackReadiness, compareVietnamTrails } from '../services/aiRecommendAudit.service.js';
import { generateExpeditionBrief } from '../services/aiExpeditionBrief.service.js';
import { computeTrailPacePlan, isValidTimeHHMM } from '../services/aiPacePlanner.service.js';
import { computeTrailFuelPlan } from '../services/aiFuelPlanner.service.js';
import { computeExpeditionReadinessAudit } from '../services/aiReadinessAudit.service.js';
import { AiChatThreadModel } from '../models/AiChatThread.js';
import { resolveTrailByIdOrSlug } from '../utils/resolveTrail.js';
import { mockTrails } from '../data/seedData.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import type {
  AiEngineMode,
  AiFitnessLevel,
  AiPreferredRegion,
  ChatRequestPayload,
  FuelDietType,
  TrailPreferenceTag,
} from '../services/ai.types.js';

const MAX_MESSAGE_LENGTH = 1500;
const MAX_HISTORY_ITEMS = 10;
const MAX_THREAD_MESSAGES = 50;
const MAX_THREADS_PER_OWNER = 30;

const STRICT_OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

function isStrictObjectId(id: unknown): id is string {
  return typeof id === 'string' && STRICT_OBJECT_ID_REGEX.test(id);
}

function sanitizeThreadTitle(raw: string): string {
  return removeEmojis(raw)
    .replace(/[<>"'`\r\n\t]+/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function getOwnerFilter(req: AuthRequest): { userId?: Types.ObjectId; sessionId?: string } | null {
  if (isStrictObjectId(req.user?.userId)) {
    return { userId: new Types.ObjectId(req.user.userId) };
  }
  const sidHeader = req.headers['x-client-session-id'];
  const sid = typeof sidHeader === 'string' ? sidHeader.trim().slice(0, 80) : '';
  // Require >= 16 high-entropy characters for guest session isolation (prevents trivial cross-guest takeover)
  if (sid.length >= 16 && /^[a-zA-Z0-9._-]+$/.test(sid)) {
    return { sessionId: sid };
  }
  return null;
}

function buildThreadTitleFromMessage(msg: string): string {
  const clean = sanitizeThreadTitle(msg);
  if (!clean) return 'Hội thoại LOST AI';
  return clean.length > 64 ? `${clean.slice(0, 61)}...` : clean;
}

function splitIntoStreamChunks(text: string): string[] {
  const lines = text.split(/(\n+)/);
  const chunks: string[] = [];
  for (const part of lines) {
    if (!part) continue;
    if (/^\n+$/.test(part) || part.length <= 36) {
      chunks.push(part);
    } else {
      const words = part.split(/(\s+)/);
      let buf = '';
      for (const w of words) {
        if ((buf + w).length > 36 && buf) {
          chunks.push(buf);
          buf = w;
        } else {
          buf += w;
        }
      }
      if (buf) chunks.push(buf);
    }
  }
  return chunks.length > 0 ? chunks : [text];
}

async function executeValidatedChatTurn(req: AuthRequest): Promise<
  | { errorStatus: number; errorMessage: string }
  | {
      data: Awaited<ReturnType<typeof getAiResponse>> & { threadId?: string };
    }
> {
  const body = (req.body || {}) as Partial<ChatRequestPayload>;
  const { message, threadId, conversationHistory, engineMode, context, currentTrailContext, userCoordinates, userName } = body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return { errorStatus: 400, errorMessage: 'Nội dung tin nhắn không được để trống.' };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return { errorStatus: 400, errorMessage: `Tin nhắn quá dài (tối đa ${MAX_MESSAGE_LENGTH} ký tự).` };
  }

  const safeEngineMode: AiEngineMode =
    engineMode === 'knowledge' || engineMode === 'gemini' || engineMode === 'auto' ? engineMode : 'auto';

  const safeHistory = Array.isArray(conversationHistory)
    ? conversationHistory
        .filter(
          (item): item is { role: 'user' | 'assistant'; content: string } =>
            Boolean(item) &&
            typeof item === 'object' &&
            (item.role === 'user' || item.role === 'assistant') &&
            typeof item.content === 'string' &&
            item.content.trim().length > 0
        )
        .slice(-MAX_HISTORY_ITEMS)
        .map((item) => ({
          role: item.role,
          content: item.content.slice(0, MAX_MESSAGE_LENGTH),
        }))
    : [];

  const rawCoords = context?.userCoordinates || userCoordinates;
  let safeCoords: { lat: number; lng: number } | undefined;
  if (
    rawCoords &&
    typeof rawCoords === 'object' &&
    Number.isFinite(Number(rawCoords.lat)) &&
    Number.isFinite(Number(rawCoords.lng))
  ) {
    const lat = Number(rawCoords.lat);
    const lng = Number(rawCoords.lng);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      safeCoords = { lat, lng };
    }
  }

  const rawPreferredRegion = context?.preferredRegion;
  const safePreferredRegion: AiPreferredRegion | undefined =
    rawPreferredRegion === 'auto' ||
    rawPreferredRegion === 'north' ||
    rawPreferredRegion === 'central' ||
    rawPreferredRegion === 'taynguyen' ||
    rawPreferredRegion === 'south'
      ? rawPreferredRegion
      : undefined;

  const rawTrailId = context?.trailId || currentTrailContext?.trailId;
  const safeTrailId =
    typeof rawTrailId === 'string' && /^[a-zA-Z0-9_-]{2,64}$/.test(rawTrailId.trim())
      ? rawTrailId.trim()
      : undefined;

  const safePageView =
    typeof context?.pageView === 'string' && /^[a-zA-Z0-9_-]{1,32}$/.test(context.pageView.trim())
      ? context.pageView.trim()
      : undefined;

  // Hydrate authoritative MongoDB thread history BEFORE falling back to untrusted client history
  const ownerFilter = getOwnerFilter(req);
  let existingThread: any = null;
  if (mongoose.connection.readyState === 1 && ownerFilter && isStrictObjectId(threadId)) {
    existingThread = await AiChatThreadModel.findOne({ _id: new Types.ObjectId(threadId), ...ownerFilter })
      .select('title messages trailContextId trailContextName')
      .lean()
      .catch(() => null);
  }

  const dbHistory =
    existingThread && Array.isArray(existingThread.messages) && existingThread.messages.length > 0
      ? existingThread.messages.slice(-MAX_HISTORY_ITEMS).map((m: any) => ({ role: m.role, content: m.content }))
      : [];
  // In stateless mode (no authoritative DB thread), ignore untrusted client-forged 'assistant' turns to prevent model-role spoofing
  const effectiveHistory = dbHistory.length > 0 ? dbHistory : safeHistory.filter((h) => h.role === 'user');

  const response = await getAiResponse({
    message: message.trim(),
    threadId: existingThread ? String(existingThread._id) : undefined,
    conversationHistory: effectiveHistory,
    engineMode: safeEngineMode,
    context: {
      pageView: safePageView,
      trailId: safeTrailId,
      userCoordinates: safeCoords,
      preferredRegion: safePreferredRegion,
    },
    userCoordinates: safeCoords,
    userName: typeof userName === 'string' ? userName.slice(0, 60) : undefined,
    authenticatedUserId: isStrictObjectId(req.user?.userId) ? req.user.userId : undefined,
  });

  // Persist turn atomically into MongoDB thread ($push + $slice: -50 prevents concurrent turn loss)
  let persistedThreadId: string | undefined = existingThread ? String(existingThread._id) : undefined;
  if (mongoose.connection.readyState === 1 && ownerFilter) {
    try {
      const now = new Date();
      const randSuffix = Math.random().toString(36).slice(2, 7);
      const userEntry = {
        id: `u-${now.getTime()}-${randSuffix}`,
        role: 'user' as const,
        content: message.trim(),
        createdAt: now,
      };
      const assistantEntry = {
        id: `a-${now.getTime() + 1}-${randSuffix}`,
        role: 'assistant' as const,
        content: response.reply,
        modelUsed: response.modelUsed,
        actions: response.actions,
        createdAt: new Date(now.getTime() + 1),
      };

      if (existingThread) {
        const setFields: Record<string, unknown> = { lastMessageAt: now };
        if (existingThread.title === 'Hội thoại LOST AI mới' || existingThread.title === 'Hội thoại LOST AI') {
          setFields.title = buildThreadTitleFromMessage(message);
        }
        if (response.contextUsed.trailId) {
          setFields.trailContextId = response.contextUsed.trailId;
          setFields.trailContextName = response.contextUsed.trailName;
        }
        const updatedDoc: any = await AiChatThreadModel.findOneAndUpdate(
          { _id: existingThread._id, ...ownerFilter },
          {
            $push: {
              messages: {
                $each: [userEntry, assistantEntry],
                $slice: -MAX_THREAD_MESSAGES,
              },
            },
            $set: setFields,
          },
          { new: true }
        )
          .select('messages')
          .lean();
        if (updatedDoc) {
          const finalLen = Array.isArray(updatedDoc.messages) ? updatedDoc.messages.length : 0;
          await AiChatThreadModel.updateOne({ _id: existingThread._id }, { $set: { messageCount: finalLen } }).catch(() => {});
          persistedThreadId = String(existingThread._id);
        }
      } else {
        const count = await AiChatThreadModel.countDocuments(ownerFilter);
        if (count >= MAX_THREADS_PER_OWNER) {
          const oldest = await AiChatThreadModel.findOne({ ...ownerFilter, pinned: false }).sort({ lastMessageAt: 1 });
          if (oldest) await AiChatThreadModel.deleteOne({ _id: oldest._id });
        }

        const created = await AiChatThreadModel.create({
          ...ownerFilter,
          title: buildThreadTitleFromMessage(message),
          trailContextId: response.contextUsed.trailId,
          trailContextName: response.contextUsed.trailName,
          messages: [userEntry, assistantEntry],
          messageCount: 2,
          lastMessageAt: now,
        });
        persistedThreadId = String(created._id);
      }
    } catch (persistErr) {
      console.warn('[AI Thread Persist Warning]:', (persistErr as Error)?.message);
    }
  }

  return {
    data: {
      ...response,
      threadId: persistedThreadId,
    },
  };
}

/**
 * POST /api/ai/chat
 * Validated, prompt-injection-safe chat with authoritative server context & atomic MongoDB thread persistence.
 */
export const chatWithAi = async (req: AuthRequest, res: Response) => {
  try {
    const result = await executeValidatedChatTurn(req);
    if ('errorStatus' in result) {
      return res.status(result.errorStatus).json({ success: false, message: result.errorMessage });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('[AI Controller] Chat error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể xử lý yêu cầu với Trợ lý ảo LOST AI. Vui lòng thử lại sau.',
    });
  }
};

/**
 * POST /api/ai/chat/stream (Wave 8A SSE Streaming)
 * Streams progressive `delta` chunks over Server-Sent Events followed by a final `done` payload with actions & threadId.
 */
export const chatWithAiStream = async (req: AuthRequest, res: Response) => {
  let clientClosed = false;
  // Listen on `res` (NOT `req`, which fires 'close' immediately after express.json() consumes the POST body!)
  res.on('close', () => {
    if (!res.writableEnded) {
      clientClosed = true;
    }
  });

  const isClosed = () => clientClosed || res.destroyed || res.writableEnded;

  try {
    const result = await executeValidatedChatTurn(req);
    if (isClosed()) return;
    if ('errorStatus' in result) {
      return res.status(result.errorStatus).json({ success: false, message: result.errorMessage });
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof (res as { flushHeaders?: () => void }).flushHeaders === 'function') {
      (res as { flushHeaders: () => void }).flushHeaders();
    }

    const chunks = splitIntoStreamChunks(result.data.reply);
    for (const chunk of chunks) {
      if (isClosed()) break;
      res.write(`event: delta\ndata: ${JSON.stringify({ chunk })}\n\n`);
      await new Promise((resolve) => setTimeout(resolve, 14));
    }

    if (!isClosed()) {
      res.write(`event: done\ndata: ${JSON.stringify(result.data)}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error('[AI Controller] Stream chat error:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Không thể truyền phát phản hồi từ LOST AI. Vui lòng thử lại.',
      });
    }
    if (!isClosed()) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Kết nối truyền phát LOST AI bị gián đoạn.' })}\n\n`);
      res.end();
    }
  }
};

/**
 * GET /api/ai/threads — List user's or guest session's saved AI chat threads
 */
export const listAiThreads = async (req: AuthRequest, res: Response) => {
  try {
    const ownerFilter = getOwnerFilter(req);
    if (!ownerFilter || mongoose.connection.readyState !== 1) {
      return res.json({ success: true, data: [] });
    }

    const threads = await AiChatThreadModel.find(ownerFilter)
      .select('title pinned trailContextId trailContextName messageCount lastMessageAt createdAt updatedAt')
      .sort({ pinned: -1, lastMessageAt: -1 })
      .limit(MAX_THREADS_PER_OWNER)
      .lean();

    return res.json({
      success: true,
      data: threads.map((t: any) => ({
        id: String(t._id),
        title: t.title,
        pinned: Boolean(t.pinned),
        trailContextId: t.trailContextId,
        trailContextName: t.trailContextName,
        messageCount: t.messageCount || 0,
        lastMessageAt: t.lastMessageAt,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    console.error('[AI Controller] List threads error:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải danh sách hội thoại AI.' });
  }
};

/**
 * POST /api/ai/threads — Explicitly create a new empty AI thread
 */
export const createAiThread = async (req: AuthRequest, res: Response) => {
  try {
    const ownerFilter = getOwnerFilter(req);
    if (!ownerFilter) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin phiên làm việc.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu đang ngoại tuyến — hội thoại được lưu cục bộ.' });
    }

    // Enforce bounded threads per owner on explicit creation too
    const count = await AiChatThreadModel.countDocuments(ownerFilter);
    if (count >= MAX_THREADS_PER_OWNER) {
      const oldest = await AiChatThreadModel.findOne({ ...ownerFilter, pinned: false }).sort({ lastMessageAt: 1 });
      if (oldest) {
        await AiChatThreadModel.deleteOne({ _id: oldest._id });
      } else {
        return res.status(400).json({
          success: false,
          message: `Bạn đã đạt tối đa ${MAX_THREADS_PER_OWNER} hội thoại đang ghim. Vui lòng bỏ ghim hoặc xóa bớt.`,
        });
      }
    }

    const { title, trailContextId, trailContextName } = req.body || {};
    const safeTitle =
      typeof title === 'string' && sanitizeThreadTitle(title) ? sanitizeThreadTitle(title) : 'Hội thoại LOST AI mới';
    const safeContextId =
      typeof trailContextId === 'string' && /^[a-zA-Z0-9_-]{2,64}$/.test(trailContextId.trim())
        ? trailContextId.trim()
        : undefined;
    const safeContextName =
      typeof trailContextName === 'string' && sanitizeThreadTitle(trailContextName)
        ? sanitizeThreadTitle(trailContextName).slice(0, 120)
        : undefined;

    const created = await AiChatThreadModel.create({
      ...ownerFilter,
      title: safeTitle,
      trailContextId: safeContextId,
      trailContextName: safeContextName,
      messages: [],
      messageCount: 0,
      lastMessageAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      data: {
        id: String(created._id),
        title: created.title,
        pinned: created.pinned,
        trailContextId: created.trailContextId,
        trailContextName: created.trailContextName,
        messages: [],
        messageCount: 0,
        lastMessageAt: created.lastMessageAt,
      },
    });
  } catch (error) {
    console.error('[AI Controller] Create thread error:', error);
    return res.status(500).json({ success: false, message: 'Không thể tạo hội thoại mới.' });
  }
};

/**
 * GET /api/ai/threads/:threadId — Load messages for an owned thread
 */
export const getAiThreadDetail = async (req: AuthRequest, res: Response) => {
  try {
    const ownerFilter = getOwnerFilter(req);
    const threadId = String(req.params.threadId || '');
    if (!ownerFilter || !isStrictObjectId(threadId)) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const thread: any = await AiChatThreadModel.findOne({
      _id: new Types.ObjectId(threadId),
      ...ownerFilter,
    }).lean();

    if (!thread) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại hoặc bạn không có quyền truy cập.' });
    }

    return res.json({
      success: true,
      data: {
        id: String(thread._id),
        title: thread.title,
        pinned: Boolean(thread.pinned),
        trailContextId: thread.trailContextId,
        trailContextName: thread.trailContextName,
        messages: Array.isArray(thread.messages) ? thread.messages : [],
        messageCount: thread.messageCount || 0,
        lastMessageAt: thread.lastMessageAt,
      },
    });
  } catch (error) {
    console.error('[AI Controller] Get thread error:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải nội dung hội thoại.' });
  }
};

/**
 * PATCH /api/ai/threads/:threadId — Rename or pin/unpin an owned thread
 */
export const updateAiThread = async (req: AuthRequest, res: Response) => {
  try {
    const ownerFilter = getOwnerFilter(req);
    const threadId = String(req.params.threadId || '');
    if (!ownerFilter || !isStrictObjectId(threadId)) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const updates: Record<string, any> = {};
    if (typeof req.body?.title === 'string') {
      const cleanTitle = sanitizeThreadTitle(req.body.title);
      if (cleanTitle) updates.title = cleanTitle;
    }
    if (typeof req.body?.pinned === 'boolean') {
      updates.pinned = req.body.pinned;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'Không có thông tin hợp lệ để cập nhật hội thoại.' });
    }

    const updated: any = await AiChatThreadModel.findOneAndUpdate(
      { _id: new Types.ObjectId(threadId), ...ownerFilter },
      { $set: updates },
      { new: true }
    )
      .select('title pinned trailContextId trailContextName messageCount lastMessageAt')
      .lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại.' });
    }

    return res.json({
      success: true,
      data: {
        id: String(updated._id),
        title: updated.title,
        pinned: Boolean(updated.pinned),
        trailContextId: updated.trailContextId,
        trailContextName: updated.trailContextName,
        messageCount: updated.messageCount || 0,
        lastMessageAt: updated.lastMessageAt,
      },
    });
  } catch (error) {
    console.error('[AI Controller] Update thread error:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật hội thoại.' });
  }
};

/**
 * DELETE /api/ai/threads/:threadId — Delete an owned thread
 */
export const deleteAiThread = async (req: AuthRequest, res: Response) => {
  try {
    const ownerFilter = getOwnerFilter(req);
    const threadId = String(req.params.threadId || '');
    if (!ownerFilter || !isStrictObjectId(threadId)) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const deleted = await AiChatThreadModel.findOneAndDelete({
      _id: new Types.ObjectId(threadId),
      ...ownerFilter,
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại để xóa.' });
    }

    return res.json({ success: true, message: 'Đã xóa hội thoại thành công.' });
  } catch (error) {
    console.error('[AI Controller] Delete thread error:', error);
    return res.status(500).json({ success: false, message: 'Không thể xóa hội thoại.' });
  }
};

/**
 * GET /api/ai/quick-prompts
 */
export const getQuickPrompts = async (req: Request, res: Response) => {
  try {
    const { trailName, province, pageView } = req.query;

    const prompts = getContextualQuickPrompts({
      name: typeof trailName === 'string' && trailName.trim() ? trailName.trim().slice(0, 120) : undefined,
      province: typeof province === 'string' && province.trim() ? province.trim().slice(0, 80) : undefined,
      pageView: typeof pageView === 'string' && pageView.trim() ? pageView.trim().slice(0, 32) : undefined,
    });

    return res.status(200).json({
      success: true,
      data: prompts,
    });
  } catch (error) {
    console.error('[AI Controller] Quick prompts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách câu hỏi gợi ý.',
    });
  }
};

/**
 * POST /api/ai/go-no-go
 */
export const assessTrailGoNoGo = async (req: Request, res: Response) => {
  try {
    const { trailId, departureDate } = req.body || {};
    if (!trailId || typeof trailId !== 'string' || !trailId.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn cung đường để đánh giá.' });
    }
    if (departureDate !== undefined) {
      if (typeof departureDate !== 'string' || !isValidCalendarDateIso(departureDate.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Ngày khởi hành không hợp lệ (định dạng YYYY-MM-DD thực tế).',
        });
      }
    }

    const assessment = await computeTrailGoNoGo(trailId.trim(), departureDate?.trim());
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường để đánh giá.' });
    }

    return res.json({ success: true, data: assessment });
  } catch (error) {
    console.error('[AI Go/No-Go Assessment Error]:', error);
    return res.status(500).json({ success: false, message: 'Không thể phân tích đánh giá Go/No-Go lúc này.' });
  }
};

/**
 * POST /api/ai/analyze-gpx
 * Server-side GPX coordinate analysis (Open-Meteo DEM enrichment, Naismith/Tobler ETA, water & safety advisory).
 */
export const analyzeGpxHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { fileName, points, bodyWeightKg, packWeightKg, fitnessLevel } = req.body || {};
    if (!Array.isArray(points) || points.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu GPX cần tối thiểu 2 điểm tọa độ hợp lệ.',
      });
    }
    if (points.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Tracklog vượt quá giới hạn tối đa (5.000 điểm). Vui lòng rút gọn trước khi phân tích.',
      });
    }

    const availableTrails = await getAllAvailableTrails();
    const safeFitness: AiFitnessLevel =
      fitnessLevel === 'beginner' || fitnessLevel === 'advanced' ? fitnessLevel : 'intermediate';

    const analysis = await analyzeGpxTrack({
      fileName: typeof fileName === 'string' ? fileName.slice(0, 120) : 'tracklog.gpx',
      points: points as RawGpxPoint[],
      bodyWeightKg: Number.isFinite(Number(bodyWeightKg)) ? Number(bodyWeightKg) : undefined,
      packWeightKg: Number.isFinite(Number(packWeightKg)) ? Number(packWeightKg) : undefined,
      fitnessLevel: safeFitness,
      availableTrails,
    });

    const reply = `**BÁO CÁO PHÂN TÍCH TRACKLOG GPX — ${analysis.fileName}**\n\n- **Cự ly & Địa hình**: **${analysis.distanceKm} km** | Leo tích lũy **+${analysis.elevationGainM}m** / Hạ **-${analysis.elevationLossM}m** | Cao độ **${analysis.minAltitudeM}m – ${analysis.maxAltitudeM}m**.\n- **Độ dốc**: Trung bình **${analysis.avgGradePercent}%**, cực đại **${analysis.maxSlopePercent}%** (${analysis.steepSegmentsPercent}% tuyến dốc >= 15%).\n- **Đánh giá độ khó**: **Cấp ${analysis.estimatedDifficulty}/5** — ${analysis.difficultyLabel}.\n- **Thời gian di chuyển**: **${analysis.bioMetrics.recommendedMovingHours} giờ** (Naismith ${analysis.bioMetrics.naismithHours}h | Tobler ${analysis.bioMetrics.toblerHours}h; tổng gồm nghỉ ~**${analysis.bioMetrics.estimatedTotalTripHours} giờ**).\n- **Nước & Năng lượng**: ${analysis.waterAdvice}${
      analysis.nearestTrail
        ? `\n- **Cung LOST gần nhất**: **${analysis.nearestTrail.name}** (${analysis.nearestTrail.province}, cách điểm xuất phát ~${analysis.nearestTrail.distanceFromStartKm} km).`
        : ''
    }`;

    return res.json({
      success: true,
      data: {
        analysis,
        reply,
        modelUsed: 'lost-knowledge-engine' as const,
        actions: [
          {
            type: 'gpx_analysis_card',
            trailId: analysis.nearestTrail?.id,
            trailName: analysis.nearestTrail?.name || analysis.fileName,
            gpxData: analysis,
          },
          {
            type: 'quick_reply',
            suggestions: analysis.nearestTrail
              ? [
                  `Đánh giá Go/No-Go ${analysis.nearestTrail.name}`,
                  `Checklist đồ phù hợp cho ${analysis.nearestTrail.name}`,
                  'Kỹ thuật bảo vệ khớp gối khi xuống dốc',
                ]
              : [
                  'Checklist đồ leo núi theo độ khó này',
                  'Kỹ thuật lọc nước suối trong rừng',
                  'Quy tắc S.T.O.P khi bị lạc đường',
                ],
          },
        ],
      },
    });
  } catch (error: any) {
    console.error('[AI GPX Analysis Error]:', error);
    return res.status(400).json({
      success: false,
      message: error?.message || 'Không thể phân tích file GPX lúc này.',
    });
  }
};

/**
 * POST /api/ai/bio-calc
 * Deterministic Naismith + Tobler + Water + Calorie + Pack Ratio + AMS endpoint
 */
export const bioCalcHandler = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    let trail: any = null;
    if (typeof body.trailId === 'string' && body.trailId.trim()) {
      trail = (await resolveTrailByIdOrSlug(body.trailId.trim()).catch(() => null)) ||
        mockTrails.find((t) => t.id === body.trailId.trim());
    }

    const result = calculateAlpineBioMetrics({
      trailId: trail?.id || body.trailId,
      trailName: trail?.name || (typeof body.trailName === 'string' ? body.trailName.slice(0, 120) : undefined),
      distanceKm: body.distanceKm ?? trail?.distanceKm ?? 14,
      elevationGainM: body.elevationGainM ?? trail?.elevationGainM ?? 850,
      elevationLossM: body.elevationLossM ?? trail?.elevationGainM ?? 850,
      maxAltitudeM: body.maxAltitudeM ?? trail?.maxAltitudeM ?? 2000,
      bodyWeightKg: body.bodyWeightKg ?? 62,
      packWeightKg: body.packWeightKg ?? 8,
      fitnessLevel: body.fitnessLevel ?? 'intermediate',
      ambientTempC: body.ambientTempC,
      durationDays: body.durationDays ?? trail?.durationDays,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[AI Bio-Calc Error]:', error);
    return res.status(500).json({ success: false, message: 'Không thể tính toán thông số sinh học leo núi.' });
  }
};

const ALLOWED_PREFERENCES = new Set<TrailPreferenceTag>([
  'san_may',
  'high_peak_2800',
  'waterfall_forest',
  'kid_friendly',
  'no_permit_needed',
]);

/**
 * POST /api/ai/recommend
 * Smart Vietnam Trail Matchmaker scoring all 36 real trails against fitness, region, season, prefs & active incidents.
 */
export const recommendTrailsHandler = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const fitness: AiFitnessLevel =
      body.fitness === 'beginner' || body.fitness === 'advanced' ? body.fitness : 'intermediate';
    const region =
      body.region === 'Miền Bắc' || body.region === 'Miền Trung' || body.region === 'Miền Nam'
        ? body.region
        : 'all';
    const rawDuration = body.durationDays === '3+' ? 3 : Number(body.durationDays);
    const durationDays: 'any' | 1 | 2 | 3 =
      rawDuration === 1 || rawDuration === 2 || rawDuration === 3 ? rawDuration : 'any';
    const vnMonth = Number(getVietnamTodayIso().split('-')[1]) || new Date().getMonth() + 1;
    const targetMonth = Math.max(1, Math.min(12, Math.round(Number(body.targetMonth) || vnMonth)));
    const preferences: TrailPreferenceTag[] = Array.isArray(body.preferences)
      ? body.preferences.filter((p: unknown): p is TrailPreferenceTag =>
          typeof p === 'string' && ALLOWED_PREFERENCES.has(p as TrailPreferenceTag)
        )
      : [];

    let safeCoords: { lat: number; lng: number } | undefined;
    if (
      body.userCoordinates &&
      Number.isFinite(Number(body.userCoordinates.lat)) &&
      Number.isFinite(Number(body.userCoordinates.lng))
    ) {
      const lat = Number(body.userCoordinates.lat);
      const lng = Number(body.userCoordinates.lng);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        safeCoords = { lat, lng };
      }
    }

    const availableTrails = await getAllAvailableTrails();
    const result = await recommendVietnamTrails(
      {
        fitness,
        region,
        durationDays,
        targetMonth,
        preferences,
        userCoordinates: safeCoords,
      },
      availableTrails
    );

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[AI Trail Recommend Error]:', error);
    return res.status(500).json({ success: false, message: 'Không thể xếp hạng cung đường lúc này.' });
  }
};

/**
 * POST /api/ai/audit-pack
 * AI Pack & Survival Readiness Auditor against trail altitude, water availability, permits & live summit min temp.
 */
export const auditPackHandler = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const trailId = typeof body.trailId === 'string' ? body.trailId.trim() : '';
    if (!trailId) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn cung đường để kiểm toán balo.' });
    }

    const packedItems = Array.isArray(body.packedItems)
      ? body.packedItems
          .filter((it: any) => it && typeof it.name === 'string' && it.name.trim())
          .slice(0, 120)
          .map((it: any) => ({
            name: String(it.name).slice(0, 140),
            weightGrams: Number.isFinite(Number(it.weightGrams)) ? Number(it.weightGrams) : 0,
            checked: it.checked !== false,
          }))
      : [];

    const availableTrails = await getAllAvailableTrails();
    const result = await auditTrailPackReadiness(
      {
        trailId,
        bodyWeightKg: Number(body.bodyWeightKg) || 62,
        packWeightKg: Number.isFinite(Number(body.packWeightKg)) ? Number(body.packWeightKg) : undefined,
        packedItems,
      },
      availableTrails
    );

    if (!result) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường để kiểm toán balo.' });
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[AI Pack Audit Error]:', error);
    return res.status(500).json({ success: false, message: 'Không thể kiểm toán balo lúc này.' });
  }
};

/**
 * POST /api/ai/compare
 * Head-to-head tactical comparison of 2–3 real Vietnam trekking trails (accepts trailIds[] or natural Vietnamese query).
 */
export const compareTrailsHandler = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const trailIds = Array.isArray(body.trailIds)
      ? body.trailIds
          .filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
          .slice(0, 3)
      : undefined;
    const query = typeof body.query === 'string' ? body.query.trim().slice(0, 300) : undefined;
    const activeTrailId = typeof body.activeTrailId === 'string' ? body.activeTrailId.trim().slice(0, 80) : undefined;

    if ((!trailIds || trailIds.length < 2) && !query) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ít nhất 2 cung đường (trailIds) hoặc câu hỏi so sánh cụ thể.',
      });
    }

    const availableTrails = await getAllAvailableTrails();
    const result = await compareVietnamTrails({ trailIds, query, activeTrailId }, availableTrails);

    if (!result) {
      return res.status(400).json({
        success: false,
        message: 'Cần nhận diện ít nhất 2 cung đường hợp lệ trong hệ thống LOST để so sánh đối đầu.',
      });
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[AI Trail Compare Error]:', error);
    return res.status(500).json({ success: false, message: 'Không thể so sánh cung đường lúc này.' });
  }
};

/**
 * POST /api/ai/expedition-brief
 * Full Printable Pre-Trip Expedition Dossier: Live Go/No-Go + Naismith/Tobler Bio-Metrics +
 * Verified VQG/Ranger Station + Day-by-Day Hour-by-Hour Itinerary + Survival Checklist + VND Budget.
 */
export const expeditionBriefHandler = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const trailId = typeof body.trailId === 'string' ? body.trailId.trim().slice(0, 100) : '';
    if (!trailId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn cung đường để lập Hồ sơ chuyến đi.',
      });
    }

    let departureDate: string | undefined;
    if (body.departureDate !== undefined && body.departureDate !== null && body.departureDate !== '') {
      if (typeof body.departureDate !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Ngày khởi hành không hợp lệ (định dạng yêu cầu YYYY-MM-DD).',
        });
      }
      const candidate = body.departureDate.trim();
      if (candidate) {
        if (!isValidCalendarDateIso(candidate)) {
          return res.status(400).json({
            success: false,
            message: 'Ngày khởi hành không hợp lệ (định dạng yêu cầu YYYY-MM-DD, năm 2020–2035).',
          });
        }
        departureDate = candidate;
      }
    }

    const groupSize = Math.max(1, Math.min(12, Math.round(Number(body.groupSize) || 4)));
    const fitnessLevel: AiFitnessLevel =
      body.fitnessLevel === 'beginner' || body.fitnessLevel === 'advanced'
        ? body.fitnessLevel
        : 'intermediate';
    const bodyWeightKg = Math.max(35, Math.min(160, Math.round(Number(body.bodyWeightKg) || 62)));
    const hasPackInput =
      body.packWeightKg !== undefined &&
      body.packWeightKg !== null &&
      String(body.packWeightKg).trim() !== '' &&
      Number.isFinite(Number(body.packWeightKg));
    const packWeightKg = hasPackInput ? Math.max(0, Math.min(40, Number(body.packWeightKg))) : undefined;

    const availableTrails = await getAllAvailableTrails();
    const result = await generateExpeditionBrief(
      {
        trailId,
        departureDate,
        groupSize,
        fitnessLevel,
        bodyWeightKg,
        packWeightKg,
      },
      availableTrails
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cung đường để lập Hồ sơ chuyến đi.',
      });
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[AI Expedition Brief Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể tạo Hồ sơ chuyến đi lúc này.',
    });
  }
};

/**
 * POST /api/ai/analyze-image
 * Multimodal Alpine Photo Triage: strictly validates JPEG/PNG/WebP magic bytes (<= 2.5MB decoded),
 * rejects SVG/HTML payloads with 400, invokes hardened Gemini Vision when available, and guarantees
 * safe WFA triage cards + verified hotlines when medical/wildlife/mushroom cues are present.
 */
export const analyzeImageHandler = async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body || {};
    const validated = validateAndDecodeTriageImage(body.imageBase64, body.mimeType);
    if (!validated.ok) {
      return res.status(400).json({
        success: false,
        message: validated.error,
      });
    }

    const question =
      typeof body.question === 'string'
        ? removeEmojis(body.question).trim().slice(0, 800)
        : undefined;
    const rawTrailId = typeof body.trailId === 'string' ? body.trailId.trim() : '';
    const safeTrailId = /^[a-zA-Z0-9_-]{2,64}$/.test(rawTrailId) ? rawTrailId : undefined;
    const threadId = typeof body.threadId === 'string' ? body.threadId.trim() : undefined;

    const result = await analyzeAlpineImage({
      cleanBase64: validated.cleanBase64,
      detectedMimeType: validated.detectedMimeType,
      imageBytes: validated.imageBytes,
      question,
      trailId: safeTrailId,
    });

    // Optionally persist text summary (never raw base64 image!) into MongoDB thread
    let persistedThreadId: string | undefined;
    const ownerFilter = getOwnerFilter(req);
    if (mongoose.connection.readyState === 1 && ownerFilter) {
      try {
        const now = new Date();
        const randSuffix = Math.random().toString(36).slice(2, 7);
        const userCaption = question
          ? `[Ảnh thực địa] ${question}`
          : '[Ảnh thực địa] Phân tích ảnh và tư vấn an toàn trekking';
        const userEntry = {
          id: `u-img-${now.getTime()}-${randSuffix}`,
          role: 'user' as const,
          content: userCaption,
          createdAt: now,
        };
        const assistantEntry = {
          id: `a-img-${now.getTime() + 1}-${randSuffix}`,
          role: 'assistant' as const,
          content: result.reply,
          modelUsed: result.modelUsed,
          actions: result.actions,
          createdAt: new Date(now.getTime() + 1),
        };

        if (isStrictObjectId(threadId)) {
          const existingImgThread: any = await AiChatThreadModel.findOne({
            _id: new Types.ObjectId(threadId),
            ...ownerFilter,
          })
            .select('title')
            .lean();
          if (existingImgThread) {
            const setFields: Record<string, unknown> = { lastMessageAt: now };
            if (
              existingImgThread.title === 'Hội thoại LOST AI mới' ||
              existingImgThread.title === 'Hội thoại LOST AI'
            ) {
              setFields.title = buildThreadTitleFromMessage(userCaption);
            }
            if (result.contextUsed.trailId) {
              setFields.trailContextId = result.contextUsed.trailId;
              setFields.trailContextName = result.contextUsed.trailName;
            }
            const updated: any = await AiChatThreadModel.findOneAndUpdate(
              { _id: new Types.ObjectId(threadId), ...ownerFilter },
              {
                $push: { messages: { $each: [userEntry, assistantEntry], $slice: -MAX_THREAD_MESSAGES } },
                $set: setFields,
              },
              { new: true }
            )
              .select('_id messages')
              .lean();
            if (updated) {
              persistedThreadId = String(updated._id);
              const actualCount = Array.isArray(updated.messages) ? updated.messages.length : 2;
              await AiChatThreadModel.updateOne(
                { _id: updated._id, ...ownerFilter },
                { $set: { messageCount: actualCount } }
              ).catch(() => {});
            }
          }
        }

        if (!persistedThreadId) {
          // Enforce bounded 30-thread quota per owner (evict oldest unpinned)
          const count = await AiChatThreadModel.countDocuments(ownerFilter);
          let canCreate = true;
          if (count >= MAX_THREADS_PER_OWNER) {
            const oldest = await AiChatThreadModel.findOne({ ...ownerFilter, pinned: false }).sort({
              lastMessageAt: 1,
            });
            if (oldest) {
              await AiChatThreadModel.deleteOne({ _id: oldest._id });
            } else {
              canCreate = false;
            }
          }
          if (canCreate) {
            const created = await AiChatThreadModel.create({
              ...ownerFilter,
              title: buildThreadTitleFromMessage(userCaption),
              trailContextId: result.contextUsed.trailId,
              trailContextName: result.contextUsed.trailName,
              lastMessageAt: now,
              messageCount: 2,
              messages: [userEntry, assistantEntry],
            });
            persistedThreadId = String(created._id);
          }
        }
      } catch (persistErr) {
        console.warn('[AI Image Thread Persist Warning]:', persistErr);
      }
    }

    return res.json({
      success: true,
      data: {
        ...result,
        threadId: persistedThreadId,
      },
    });
  } catch (error) {
    console.error('[AI Analyze Image Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể phân tích hình ảnh lúc này. Vui lòng thử lại.',
    });
  }
};

function parseStrictOptionalNumber(
  raw: unknown,
  min: number,
  max: number,
  fieldLabel: string
): { value?: number; error?: string } {
  if (raw === undefined || raw === null) return {};
  if (typeof raw === 'string' && raw.trim() === '') return {};
  if (typeof raw === 'boolean' || (typeof raw !== 'number' && typeof raw !== 'string')) {
    return { error: `${fieldLabel} phải là giá trị số hợp lệ (${min}–${max}).` };
  }
  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return { error: `${fieldLabel} phải là giá trị số hợp lệ (${min}–${max}).` };
  }
  if (num < min || num > max) {
    return { error: `${fieldLabel} nằm ngoài phạm vi cho phép (${min}–${max}).` };
  }
  return { value: num };
}

/**
 * POST /api/ai/pace-plan
 * Deterministic Turnaround Time & NOAA Sunset Cutoff Pace Planner (Wave 12A).
 * Validates approved trail, calendar date (2020-2035), HH:MM start time, pack/body weights & rest cadence.
 */
export const pacePlanHandler = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const trailId = typeof body.trailId === 'string' ? body.trailId.trim().slice(0, 100) : '';
    if (!trailId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn cung đường để tính giờ quay đầu & kế hoạch tốc độ.',
      });
    }

    let departureDate: string | undefined;
    if (body.departureDate !== undefined && body.departureDate !== null && body.departureDate !== '') {
      if (typeof body.departureDate !== 'string' || !isValidCalendarDateIso(body.departureDate.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Ngày khởi hành không hợp lệ (định dạng YYYY-MM-DD, năm 2020–2035).',
        });
      }
      departureDate = body.departureDate.trim();
    }

    let startTime: string | undefined;
    if (body.startTime !== undefined && body.startTime !== null && body.startTime !== '') {
      if (!isValidTimeHHMM(body.startTime)) {
        return res.status(400).json({
          success: false,
          message: 'Giờ xuất phát không hợp lệ (định dạng yêu cầu HH:MM, ví dụ 06:00).',
        });
      }
      startTime = body.startTime.trim();
    }

    if (
      body.fitnessLevel !== undefined &&
      body.fitnessLevel !== null &&
      body.fitnessLevel !== '' &&
      body.fitnessLevel !== 'beginner' &&
      body.fitnessLevel !== 'intermediate' &&
      body.fitnessLevel !== 'advanced'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Mức thể lực không hợp lệ (chỉ chấp nhận beginner, intermediate hoặc advanced).',
      });
    }

    const fitnessLevel: AiFitnessLevel =
      body.fitnessLevel === 'beginner' || body.fitnessLevel === 'advanced'
        ? body.fitnessLevel
        : 'intermediate';

    const parsedPack = parseStrictOptionalNumber(body.packWeightKg, 0, 40, 'Trọng lượng balo (kg)');
    if (parsedPack.error) {
      return res.status(400).json({ success: false, message: parsedPack.error });
    }
    const parsedBody = parseStrictOptionalNumber(body.bodyWeightKg, 35, 160, 'Cân nặng cơ thể (kg)');
    if (parsedBody.error) {
      return res.status(400).json({ success: false, message: parsedBody.error });
    }
    const parsedRest = parseStrictOptionalNumber(body.restMinutesPerHour, 0, 30, 'Thời gian nghỉ mỗi giờ (phút)');
    if (parsedRest.error) {
      return res.status(400).json({ success: false, message: parsedRest.error });
    }
    const parsedStay = parseStrictOptionalNumber(body.summitStayMinutes, 0, 180, 'Thời gian nghỉ đỉnh (phút)');
    if (parsedStay.error) {
      return res.status(400).json({ success: false, message: parsedStay.error });
    }

    const packWeightKg = parsedPack.value;
    const bodyWeightKg = parsedBody.value;
    const restMinutesPerHour = parsedRest.value !== undefined ? Math.round(parsedRest.value) : undefined;
    const summitStayMinutes = parsedStay.value !== undefined ? Math.round(parsedStay.value) : undefined;

    const availableTrails = await getAllAvailableTrails();
    const plan = await computeTrailPacePlan(
      {
        trailId,
        departureDate,
        startTime,
        packWeightKg,
        bodyWeightKg,
        fitnessLevel,
        restMinutesPerHour,
        summitStayMinutes,
      },
      availableTrails
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cung đường đã duyệt để lập kế hoạch tốc độ.',
      });
    }

    return res.json({ success: true, data: plan });
  } catch (error) {
    console.error('[AI Pace Plan Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể lập kế hoạch tốc độ & giờ quay đầu lúc này.',
    });
  }
};

/**
 * POST /api/ai/fuel-plan
 * Deterministic AI Nutrition, Hydration & Electrolyte Planner (Wave 14A).
 * Strict non-boolean finite numeric validation + approved trail enforcement.
 */
export const fuelPlanHandler = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const trailId = typeof body.trailId === 'string' ? body.trailId.trim().slice(0, 100) : '';
    if (!trailId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn cung đường để lập kế hoạch dinh dưỡng, nước uống & điện giải.',
      });
    }

    if (
      body.fitnessLevel !== undefined &&
      body.fitnessLevel !== null &&
      body.fitnessLevel !== '' &&
      body.fitnessLevel !== 'beginner' &&
      body.fitnessLevel !== 'intermediate' &&
      body.fitnessLevel !== 'advanced'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Mức thể lực không hợp lệ (chỉ chấp nhận beginner, intermediate hoặc advanced).',
      });
    }
    const fitnessLevel: AiFitnessLevel =
      body.fitnessLevel === 'beginner' || body.fitnessLevel === 'advanced'
        ? body.fitnessLevel
        : 'intermediate';

    if (
      body.dietType !== undefined &&
      body.dietType !== null &&
      body.dietType !== '' &&
      body.dietType !== 'standard' &&
      body.dietType !== 'vegetarian' &&
      body.dietType !== 'ultralight'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Chế độ dinh dưỡng không hợp lệ (chỉ chấp nhận standard, vegetarian hoặc ultralight).',
      });
    }
    const dietType: FuelDietType =
      body.dietType === 'vegetarian' || body.dietType === 'ultralight'
        ? body.dietType
        : 'standard';

    const parsedBody = parseStrictOptionalNumber(body.bodyWeightKg, 35, 160, 'Cân nặng cơ thể (kg)');
    if (parsedBody.error) {
      return res.status(400).json({ success: false, message: parsedBody.error });
    }
    const parsedPack = parseStrictOptionalNumber(body.packWeightKg, 0, 40, 'Trọng lượng balo (kg)');
    if (parsedPack.error) {
      return res.status(400).json({ success: false, message: parsedPack.error });
    }
    const parsedTemp = parseStrictOptionalNumber(body.ambientTempC, -5, 45, 'Nhiệt độ môi trường (°C)');
    if (parsedTemp.error) {
      return res.status(400).json({ success: false, message: parsedTemp.error });
    }
    const parsedHumidity = parseStrictOptionalNumber(body.humidityPct, 20, 100, 'Độ ẩm không khí (%)');
    if (parsedHumidity.error) {
      return res.status(400).json({ success: false, message: parsedHumidity.error });
    }
    const parsedGroup = parseStrictOptionalNumber(body.groupSize, 1, 20, 'Số lượng thành viên đoàn');
    if (parsedGroup.error) {
      return res.status(400).json({ success: false, message: parsedGroup.error });
    }
    if (parsedGroup.value !== undefined && !Number.isInteger(parsedGroup.value)) {
      return res.status(400).json({
        success: false,
        message: 'Số lượng thành viên đoàn phải là số nguyên từ 1 đến 20.',
      });
    }

    const availableTrails = await getAllAvailableTrails();
    const plan = await computeTrailFuelPlan(
      {
        trailId,
        bodyWeightKg: parsedBody.value,
        packWeightKg: parsedPack.value,
        fitnessLevel,
        dietType,
        ambientTempC: parsedTemp.value,
        humidityPct: parsedHumidity.value,
        groupSize: parsedGroup.value,
      },
      availableTrails
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cung đường đã duyệt để lập kế hoạch dinh dưỡng & nước uống.',
      });
    }

    return res.json({ success: true, data: plan });
  } catch (error) {
    console.error('[AI Fuel Plan Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể lập kế hoạch dinh dưỡng & điện giải lúc này.',
    });
  }
};

/**
 * POST /api/ai/readiness-audit
 * Deterministic 0-100 Pre-Flight Expedition Readiness Audit (Wave 16A).
 * Combines live Go/No-Go + NOAA Turnaround Pace + Pandolf Nutrition/Hydration + Pack Ratio + Permit Lead-Time.
 */
export const readinessAuditHandler = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const trailId = typeof body.trailId === 'string' ? body.trailId.trim().slice(0, 100) : '';
    if (!trailId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn cung đường để kiểm tra mức độ sẵn sàng (0–100).',
      });
    }

    let departureDate: string | undefined;
    if (body.departureDate !== undefined && body.departureDate !== null && body.departureDate !== '') {
      if (typeof body.departureDate !== 'string' || !isValidCalendarDateIso(body.departureDate.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Ngày khởi hành không hợp lệ (định dạng YYYY-MM-DD, năm 2020–2035).',
        });
      }
      const trimmedDate = body.departureDate.trim();
      const todayVn = getVietnamTodayIso();
      if (trimmedDate < todayVn) {
        return res.status(400).json({
          success: false,
          message: `Ngày khởi hành không được nằm trong quá khứ (tối thiểu từ hôm nay ${todayVn} theo giờ Việt Nam).`,
        });
      }
      departureDate = trimmedDate;
    }

    let startTime: string | undefined;
    if (body.startTime !== undefined && body.startTime !== null && body.startTime !== '') {
      if (!isValidTimeHHMM(body.startTime)) {
        return res.status(400).json({
          success: false,
          message: 'Giờ xuất phát không hợp lệ (định dạng yêu cầu HH:MM, ví dụ 06:00).',
        });
      }
      startTime = body.startTime.trim();
    }

    if (
      body.fitnessLevel !== undefined &&
      body.fitnessLevel !== null &&
      body.fitnessLevel !== '' &&
      body.fitnessLevel !== 'beginner' &&
      body.fitnessLevel !== 'intermediate' &&
      body.fitnessLevel !== 'advanced'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Mức thể lực không hợp lệ (chỉ chấp nhận beginner, intermediate hoặc advanced).',
      });
    }
    const fitnessLevel: AiFitnessLevel =
      body.fitnessLevel === 'beginner' || body.fitnessLevel === 'advanced'
        ? body.fitnessLevel
        : 'intermediate';

    if (
      body.dietType !== undefined &&
      body.dietType !== null &&
      body.dietType !== '' &&
      body.dietType !== 'standard' &&
      body.dietType !== 'vegetarian' &&
      body.dietType !== 'ultralight'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Chế độ dinh dưỡng không hợp lệ (chỉ chấp nhận standard, vegetarian hoặc ultralight).',
      });
    }
    const dietType: FuelDietType =
      body.dietType === 'vegetarian' || body.dietType === 'ultralight' ? body.dietType : 'standard';

    const parsedBody = parseStrictOptionalNumber(body.bodyWeightKg, 35, 160, 'Cân nặng cơ thể (kg)');
    if (parsedBody.error) {
      return res.status(400).json({ success: false, message: parsedBody.error });
    }
    const parsedPack = parseStrictOptionalNumber(body.packWeightKg, 0, 40, 'Trọng lượng balo (kg)');
    if (parsedPack.error) {
      return res.status(400).json({ success: false, message: parsedPack.error });
    }
    const parsedGroup = parseStrictOptionalNumber(body.groupSize, 1, 20, 'Số lượng thành viên đoàn');
    if (parsedGroup.error) {
      return res.status(400).json({ success: false, message: parsedGroup.error });
    }
    if (parsedGroup.value !== undefined && !Number.isInteger(parsedGroup.value)) {
      return res.status(400).json({
        success: false,
        message: 'Số lượng thành viên đoàn phải là số nguyên từ 1 đến 20.',
      });
    }

    if (
      body.hasPermitConfirmed !== undefined &&
      body.hasPermitConfirmed !== null &&
      typeof body.hasPermitConfirmed !== 'boolean'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái xác nhận giấy phép phải là giá trị boolean (true/false).',
      });
    }
    const hasPermitConfirmed = typeof body.hasPermitConfirmed === 'boolean' ? body.hasPermitConfirmed : false;

    const availableTrails = await getAllAvailableTrails();
    const audit = await computeExpeditionReadinessAudit(
      {
        trailId,
        departureDate,
        startTime,
        bodyWeightKg: parsedBody.value,
        packWeightKg: parsedPack.value,
        fitnessLevel,
        dietType,
        groupSize: parsedGroup.value,
        hasPermitConfirmed,
      },
      availableTrails
    );

    if (!audit) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cung đường đã duyệt để đánh giá mức độ sẵn sàng.',
      });
    }

    return res.json({ success: true, data: audit });
  } catch (error) {
    console.error('[AI Readiness Audit Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể chạy kiểm tra mức độ sẵn sàng lúc này.',
    });
  }
};
