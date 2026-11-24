import crypto from 'crypto';
import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { ThreadModel } from '../models/Thread.js';
import { CommentModel } from '../models/Comment.js';
import { UserModel } from '../models/User.js';
import { CommunityMessageModel } from '../models/CommunityMessage.js';
import { mockTrails } from '../data/seedData.js';
import { AuthRequest, getUserKeys } from '../middleware/auth.middleware.js';
import { containsProfanity, getProfanityMatch } from '../utils/profanityFilter.js';
import {
  awardReputationPoints,
  deductReputationPoints,
  REPUTATION_POINTS,
  PENALTY_POINTS,
} from '../utils/reputation.js';
import { sendNotification } from '../utils/notification.js';
import { broadcastEvent } from '../config/socket.js';
import { sanitizeInput, isSafeHttpUrl } from '../utils/validation.js';
import { isValidObjectId, resolveTrailByIdOrSlug } from '../utils/resolveTrail.js';
import { recordAuditLog } from '../utils/audit.js';

const VALID_REACTIONS = new Set(['like', 'love', 'haha', 'wow', 'buon', 'huhu', 'sad', 'angry', 'dislike']);
const VALID_CATEGORIES = new Set(['Hỏi Đáp', 'Kinh Nghiệm', 'Tìm Đồng Đội', 'Cảnh Báo']);
const VALID_CHAT_CHANNELS = new Set(['general', 'north', 'central', 'south', 'sos']);
const DEFAULT_AVATAR =
  'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329093/trekmap/avatars/avatar_user_1.jpg';

function escapeXml(unsafe: string): string {
  return String(unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

function formatThreadResponse(t: any, userKeys: string[]) {
  const userObj = t.userId && typeof t.userId === 'object' ? (t.userId as any) : null;
  const liveName = userObj?.fullName || t.authorName;
  const liveAvatar = userObj?.avatarUrl || t.authorAvatar || DEFAULT_AVATAR;

  let currentUserReaction: string | null = null;
  if (t.userReactionsMap) {
    const isMap = typeof (t.userReactionsMap as any).get === 'function';
    for (const key of userKeys) {
      if (!key) continue;
      const r = isMap ? (t.userReactionsMap as any).get(key) : (t.userReactionsMap as any)[key];
      if (r) {
        currentUserReaction = r;
        break;
      }
    }
  }

  const authorUserId = userObj
    ? userObj._id
      ? userObj._id.toString()
      : String(userObj)
    : t.userId
      ? String(t.userId)
      : '';

  return {
    id: t.id,
    title: t.title,
    authorName: liveName,
    authorAvatar: liveAvatar,
    userId: authorUserId,
    category: t.category,
    trailId: t.trailId || '',
    trailName: t.trailName || '',
    content: t.content,
    images: t.images || [],
    upvotes: t.upvotes,
    reactions: t.reactions,
    userReaction: currentUserReaction || null,
    repliesCount: t.repliesCount,
    viewsCount: t.viewsCount,
    isPinned: Boolean(t.isPinned),
    isLocked: Boolean(t.isLocked),
    createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
  };
}

export const getThreads = async (req: Request, res: Response) => {
  try {
    const userKeys = getUserKeys(req);
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 100);
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (typeof req.query.category === 'string' && VALID_CATEGORIES.has(req.query.category)) {
      filter.category = req.query.category;
    }
    if (typeof req.query.trailId === 'string' && req.query.trailId.trim()) {
      filter.trailId = sanitizeInput(req.query.trailId).slice(0, 100);
    }
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const escaped = req.query.search.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      filter.$or = [{ title: rx }, { content: rx }, { authorName: rx }, { trailName: rx }];
    }

    const sortParam = typeof req.query.sort === 'string' ? req.query.sort : 'newest';
    let sortSpec: Record<string, 1 | -1> = { isPinned: -1, createdAt: -1 };
    if (sortParam === 'popular') {
      sortSpec = { isPinned: -1, upvotes: -1, viewsCount: -1, createdAt: -1 };
    } else if (sortParam === 'most_commented') {
      sortSpec = { isPinned: -1, repliesCount: -1, createdAt: -1 };
    }

    let mongoThreads: any[] = [];
    let total = 0;
    if (mongoose.connection.readyState === 1) {
      [mongoThreads, total] = await Promise.all([
        ThreadModel.find(filter)
          .populate('userId', 'fullName username avatarUrl')
          .sort(sortSpec)
          .skip(skip)
          .limit(limit)
          .lean(),
        ThreadModel.countDocuments(filter),
      ]);
    }

    const totalPages = Math.ceil(total / limit);
    const hasMore = skip + mongoThreads.length < total;

    return res.json({
      success: true,
      data: mongoThreads.map((t) => formatThreadResponse(t, userKeys)),
      pagination: { total, page, limit, totalPages, hasMore },
    });
  } catch (err) {
    console.error('[Forum DB Query Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách bài viết diễn đàn.' });
  }
};

export const getThreadById = async (req: Request, res: Response) => {
  try {
    const threadId = String(req.params.threadId || '').trim();
    if (!threadId) {
      return res.status(400).json({ success: false, message: 'Thiếu mã bài viết.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const query = isValidObjectId(threadId) ? { $or: [{ id: threadId }, { _id: new Types.ObjectId(threadId) }] } : { id: threadId };
    const thread = await ThreadModel.findOneAndUpdate(query, { $inc: { viewsCount: 1 } }, { new: true })
      .populate('userId', 'fullName username avatarUrl')
      .lean();

    if (!thread) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    }

    return res.json({
      success: true,
      data: formatThreadResponse(thread, getUserKeys(req)),
    });
  } catch (err) {
    console.error('[Get Thread By ID Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải chi tiết bài viết.' });
  }
};

export const createThread = async (req: AuthRequest, res: Response) => {
  const { title, category, content, images, trailId, trailName } = req.body || {};
  const currentUserId = req.user?.userId;

  if (!currentUserId) {
    return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để đăng bài thảo luận.' });
  }

  if (typeof title !== 'string' || !title.trim() || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập tiêu đề và nội dung bài viết.' });
  }

  const cleanTitle = sanitizeInput(title).slice(0, 200);
  const cleanContent = sanitizeInput(content).slice(0, 8000);
  if (!cleanTitle || !cleanContent) {
    return res.status(400).json({ success: false, message: 'Tiêu đề hoặc nội dung bài viết không hợp lệ.' });
  }

  if (containsProfanity(`${cleanTitle} ${cleanContent}`)) {
    const matchedWord = getProfanityMatch(`${cleanTitle} ${cleanContent}`);
    const penaltyInfo = await deductReputationPoints(
      currentUserId,
      PENALTY_POINTS.PROFANITY_VIOLATION,
      `Đăng bài chứa từ ngữ vi phạm (${matchedWord})`
    );

    return res.status(400).json({
      success: false,
      message: `Bài viết bị từ chối do chứa từ ngữ vi phạm quy chuẩn phát ngôn cộng đồng ("${matchedWord}"). Bạn bị trừ ${PENALTY_POINTS.PROFANITY_VIOLATION} điểm uy tín.`,
      penaltyInfo,
    });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu đang không khả dụng.' });
  }

  try {
    const user = isValidObjectId(currentUserId)
      ? await UserModel.findById(currentUserId).select('fullName avatarUrl').lean()
      : null;

    const authorName = user?.fullName || 'Trekker Cộng Đồng';
    const authorAvatar = user?.avatarUrl || DEFAULT_AVATAR;

    const safeCategory = typeof category === 'string' && VALID_CATEGORIES.has(category) ? category : 'Kinh Nghiệm';
    // Security: Reject raw Base64 blobs in MongoDB documents; allow only validated public HTTP/HTTPS CDN URLs
    const safeImages = Array.isArray(images)
      ? images.filter((img): img is string => typeof img === 'string' && isSafeHttpUrl(img)).slice(0, 8)
      : [];

    let safeTrailId = typeof trailId === 'string' ? sanitizeInput(trailId).slice(0, 100) : '';
    let safeTrailName = typeof trailName === 'string' ? sanitizeInput(trailName).slice(0, 160) : '';
    if (safeTrailId && !safeTrailName) {
      const resolved = await resolveTrailByIdOrSlug(safeTrailId).catch(() => null);
      if (resolved) {
        safeTrailId = resolved.id || String(resolved._id);
        safeTrailName = resolved.name || '';
      } else {
        const seedMatch = mockTrails.find((mt) => mt.id === safeTrailId);
        if (seedMatch) safeTrailName = seedMatch.name;
      }
    }

    const threadId = `thread-${crypto.randomUUID().slice(0, 12)}`;
    const createdDoc = await ThreadModel.create({
      id: threadId,
      title: cleanTitle,
      authorName,
      authorAvatar,
      userId: user?._id || undefined,
      category: safeCategory,
      trailId: safeTrailId,
      trailName: safeTrailName,
      content: cleanContent,
      images: safeImages,
      upvotes: 0,
      reactions: { like: 0, love: 0, haha: 0, wow: 0, buon: 0, huhu: 0, sad: 0, angry: 0, dislike: 0 },
      userReactionsMap: new Map(),
      repliesCount: 0,
      viewsCount: 1,
    });

    const reputationReward = await awardReputationPoints(
      currentUserId,
      REPUTATION_POINTS.CREATE_FORUM_THREAD,
      'Đăng bài nhật ký băng rừng'
    );

    return res.status(201).json({
      success: true,
      message: 'Đăng bài thảo luận thành công! Bạn nhận +15 điểm uy tín.',
      data: {
        id: createdDoc.id,
        title: createdDoc.title,
        authorName: createdDoc.authorName,
        authorAvatar: createdDoc.authorAvatar,
        userId: createdDoc.userId ? createdDoc.userId.toString() : currentUserId,
        category: createdDoc.category,
        trailId: createdDoc.trailId || '',
        trailName: createdDoc.trailName || '',
        content: createdDoc.content,
        images: createdDoc.images || [],
        upvotes: 0,
        reactions: createdDoc.reactions,
        repliesCount: 0,
        viewsCount: 1,
        createdAt: createdDoc.createdAt.toISOString(),
      },
      reputationReward,
    });
  } catch (err) {
    console.error('[MongoDB Thread Save Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi lưu bài viết vào cơ sở dữ liệu.' });
  }
};

export const updateThread = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const isStaff = req.user?.role === 'admin' || req.user?.role === 'moderator';
    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const threadId = String(req.params.threadId || '').trim();
    if (!threadId) {
      return res.status(400).json({ success: false, message: 'Thiếu mã bài viết.' });
    }

    const query = isValidObjectId(threadId) ? { $or: [{ id: threadId }, { _id: new Types.ObjectId(threadId) }] } : { id: threadId };
    const thread = await ThreadModel.findOne(query);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    }
    if (!isStaff && String(thread.userId) !== String(currentUserId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa bài viết này.' });
    }

    const { title, content, category, images, trailId, trailName } = req.body || {};
    const nextTitle = title !== undefined ? sanitizeInput(String(title)).slice(0, 200) : thread.title;
    const nextContent = content !== undefined ? sanitizeInput(String(content)).slice(0, 8000) : thread.content;

    if (!nextTitle.trim() || !nextContent.trim()) {
      return res.status(400).json({ success: false, message: 'Tiêu đề và nội dung bài viết không được để trống.' });
    }

    if (containsProfanity(`${nextTitle} ${nextContent}`)) {
      const matchedWord = getProfanityMatch(`${nextTitle} ${nextContent}`);
      const penaltyInfo = await deductReputationPoints(
        currentUserId,
        PENALTY_POINTS.PROFANITY_VIOLATION,
        `Chỉnh sửa bài viết chứa từ ngữ vi phạm (${matchedWord})`
      );
      return res.status(400).json({
        success: false,
        message: `Bài viết chứa từ ngữ vi phạm quy chuẩn phát ngôn cộng đồng ("${matchedWord}").`,
        penaltyInfo,
      });
    }

    thread.title = nextTitle;
    thread.content = nextContent;
    if (typeof category === 'string' && VALID_CATEGORIES.has(category)) {
      thread.category = category as any;
    }
    if (images !== undefined) {
      thread.images = Array.isArray(images)
        ? images.filter((img): img is string => typeof img === 'string' && isSafeHttpUrl(img)).slice(0, 8)
        : [];
    }
    if (trailId !== undefined) {
      const nextTrailId = typeof trailId === 'string' ? sanitizeInput(trailId).slice(0, 100) : '';
      thread.trailId = nextTrailId;
      if (trailName !== undefined) {
        thread.trailName = typeof trailName === 'string' ? sanitizeInput(trailName).slice(0, 160) : '';
      } else if (!nextTrailId) {
        thread.trailName = '';
      } else {
        const resolved = await resolveTrailByIdOrSlug(nextTrailId).catch(() => null);
        thread.trailName = resolved?.name || mockTrails.find((mt) => mt.id === nextTrailId)?.name || '';
      }
    } else if (trailName !== undefined) {
      thread.trailName = typeof trailName === 'string' ? sanitizeInput(trailName).slice(0, 160) : '';
    }

    await thread.save();
    await recordAuditLog(req, 'UPDATE_THREAD', 'threads', `Cập nhật bài viết ${thread.id}`);

    const populated = await ThreadModel.findById(thread._id)
      .populate('userId', 'fullName username avatarUrl')
      .lean();
    const formatted = formatThreadResponse(populated || thread.toObject(), getUserKeys(req));
    broadcastEvent('threadUpdated', { threadId: thread.id, thread: formatted });

    return res.json({
      success: true,
      message: 'Đã cập nhật bài viết thành công!',
      data: formatted,
    });
  } catch (err) {
    console.error('[Update Thread Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật bài viết.' });
  }
};

export const deleteOwnThread = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const isStaff = req.user?.role === 'admin' || req.user?.role === 'moderator';
    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const threadId = String(req.params.threadId || '');
    const query = isValidObjectId(threadId) ? { $or: [{ id: threadId }, { _id: new Types.ObjectId(threadId) }] } : { id: threadId };
    const thread = await ThreadModel.findOne(query);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    }

    if (!isStaff && String(thread.userId) !== String(currentUserId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa bài viết này.' });
    }

    await ThreadModel.deleteOne({ _id: thread._id });
    await CommentModel.deleteMany({ threadId: thread.id }).catch(() => {});
    await recordAuditLog(req, 'DELETE_THREAD', 'threads', `Xóa bài viết "${thread.title}" (${thread.id})`);
    broadcastEvent('threadDeleted', { threadId: thread.id });

    return res.json({ success: true, message: 'Đã xóa bài viết thành công!' });
  } catch (err) {
    console.error('[Delete Own Thread Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa bài viết.' });
  }
};

export const reactToThread = async (req: AuthRequest, res: Response) => {
  const { threadId } = req.params;
  const { reactionType } = req.body || {};
  const currentUserId = req.user?.userId;

  if (!currentUserId) {
    return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để thả cảm xúc.' });
  }

  if (
    reactionType !== null &&
    reactionType !== undefined &&
    (typeof reactionType !== 'string' || !VALID_REACTIONS.has(reactionType))
  ) {
    return res.status(400).json({ success: false, message: 'Loại cảm xúc không hợp lệ.' });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
  }

  try {
    const primaryKey = String(currentUserId);
    const existingDoc = await ThreadModel.findOne({ id: String(threadId) })
      .select('_id id title userId userReactionsMap')
      .lean();
    if (!existingDoc) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    }

    const existingMap: Record<string, string> =
      existingDoc.userReactionsMap instanceof Map
        ? Object.fromEntries(existingDoc.userReactionsMap.entries())
        : ((existingDoc.userReactionsMap as any) || {});
    const currentReaction = existingMap[primaryKey] || null;
    let newReaction: string | null = reactionType || null;
    if (!newReaction || currentReaction === newReaction) {
      newReaction = null;
    }

    // Atomic per-user key update prevents concurrent users from overwriting each other's reactions
    const mapField = `userReactionsMap.${primaryKey}`;
    const updatedDoc = await ThreadModel.findOneAndUpdate(
      { _id: existingDoc._id },
      newReaction ? { $set: { [mapField]: newReaction } } : { $unset: { [mapField]: '' } },
      { new: true }
    )
      .select('id userId title userReactionsMap')
      .lean();

    if (!updatedDoc) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    }

    const counts: Record<string, number> = {
      like: 0,
      love: 0,
      haha: 0,
      wow: 0,
      buon: 0,
      huhu: 0,
      sad: 0,
      angry: 0,
      dislike: 0,
    };

    const entries =
      updatedDoc.userReactionsMap instanceof Map
        ? Array.from(updatedDoc.userReactionsMap.entries())
        : Object.entries((updatedDoc.userReactionsMap as any) || {});
    for (const [, r] of entries) {
      if (typeof r === 'string' && counts[r] !== undefined) counts[r]++;
    }
    const totalUpvotes = Object.values(counts).reduce((a, b) => a + b, 0);

    await ThreadModel.updateOne({ _id: existingDoc._id }, { $set: { reactions: counts, upvotes: totalUpvotes } });

    // Notify author only when adding a fresh reaction (not switching/toggling rapidly)
    if (newReaction && !currentReaction && existingDoc.userId && String(existingDoc.userId) !== primaryKey) {
      const reactor = isValidObjectId(primaryKey)
        ? await UserModel.findById(primaryKey).select('fullName avatarUrl').lean()
        : null;
      const reactorName = reactor?.fullName || 'Thành viên LOST';
      const titleSnippet = existingDoc.title
        ? existingDoc.title.length > 35
          ? existingDoc.title.substring(0, 35) + '...'
          : existingDoc.title
        : 'của bạn';

      sendNotification({
        recipientId: String(existingDoc.userId),
        sender: { id: primaryKey, name: reactorName, avatarUrl: reactor?.avatarUrl || '' },
        type: 'community_comment',
        category: 'social',
        title: 'Cảm xúc mới về bài viết của bạn',
        message: `${reactorName} đã thả cảm xúc cho bài viết "${titleSnippet}"`,
        link: `/forum?threadId=${existingDoc.id}`,
        relatedId: existingDoc.id,
      }).catch(() => {});
    }

    broadcastEvent('threadReactionUpdate', {
      threadId: existingDoc.id,
      upvotes: totalUpvotes,
      reactions: counts,
    });

    return res.json({
      success: true,
      upvotes: totalUpvotes,
      userReaction: newReaction,
      data: counts,
    });
  } catch (err) {
    console.error('[Thread Reaction API Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi lưu cảm xúc bài viết.' });
  }
};

export const getTopTrekkers = async (_req: Request, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, data: [] });
    }
    const topUsers = await UserModel.find({ reputationScore: { $gt: 0 }, isBanned: { $ne: true } })
      .select('fullName username avatarUrl reputationScore badges role')
      .sort({ reputationScore: -1 })
      .limit(6)
      .lean();

    return res.json({ success: true, data: topUsers });
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi tải danh sách trekker' });
  }
};

export const downloadTrailGpx = async (req: Request, res: Response) => {
  try {
    const trailParam = String(req.params.trailId || '').trim();
    let trail: any = await resolveTrailByIdOrSlug(trailParam);
    if (!trail) {
      trail = mockTrails.find((t) => t.id === trailParam) || null;
    }

    if (!trail || !Array.isArray(trail.gpxTrack) || trail.gpxTrack.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dữ liệu GPS của cung đường này' });
    }

    const safeName = escapeXml(trail.name || 'LOST Trail');
    const safeDesc = escapeXml(trail.description || 'Cung đường trekking thực địa Việt Nam');
    const validPoints = trail.gpxTrack.filter(
      (pt: unknown): pt is [number, number] =>
        Array.isArray(pt) &&
        pt.length >= 2 &&
        Number.isFinite(Number(pt[0])) &&
        Number.isFinite(Number(pt[1]))
    );
    const gpxPoints = validPoints
      .map((pt: [number, number]) => `      <trkpt lat="${Number(pt[0])}" lon="${Number(pt[1])}"></trkpt>`)
      .join('\n');

    const wptXml = Array.isArray(trail.waypoints)
      ? trail.waypoints
          .filter((w: any) => w && Number.isFinite(Number(w.lat)) && Number.isFinite(Number(w.lng)))
          .map((w: any) => {
            const eleTag = Number.isFinite(Number(w.elevationM)) ? `<ele>${Math.round(Number(w.elevationM))}</ele>` : '';
            return `  <wpt lat="${Number(w.lat)}" lon="${Number(w.lng)}">${eleTag}<name>${escapeXml(w.name || 'Waypoint')}</name><desc>${escapeXml(w.description || '')}</desc><type>${escapeXml(w.type || 'viewpoint')}</type></wpt>`;
          })
          .join('\n')
      : '';

    const gpxXml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LOST Vietnam - https://lost.vn" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${safeName}</name>
    <desc>${safeDesc}</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
${wptXml ? `${wptXml}\n` : ''}  <trk>
    <name>${safeName}</name>
    <trkseg>
${gpxPoints}
    </trkseg>
  </trk>
</gpx>`;

    res.setHeader('Content-Type', 'application/gpx+xml; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(trail.id || trail._id?.toString() || 'trail')}.gpx"`
    );
    return res.send(gpxXml);
  } catch (err) {
    console.error('[GPX Export Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi xuất file GPX' });
  }
};

export const getCommunityChatMessages = async (req: Request, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, data: [], hasMore: false });
    }

    const rawChannel = typeof req.query.channel === 'string' ? req.query.channel.trim() : 'general';
    const channel = VALID_CHAT_CHANNELS.has(rawChannel) ? rawChannel : 'general';
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '40'), 10) || 40, 1), 100);

    const filter: Record<string, any> =
      channel === 'general'
        ? { $or: [{ channel: 'general' }, { channel: { $exists: false } }, { channel: '' }] }
        : { channel };

    if (typeof req.query.before === 'string' && req.query.before.trim()) {
      const beforeRaw = req.query.before.trim();
      if (isValidObjectId(beforeRaw)) {
        filter._id = { $lt: new Types.ObjectId(beforeRaw) };
      } else {
        const beforeDate = new Date(beforeRaw);
        if (!Number.isNaN(beforeDate.getTime())) {
          filter.createdAt = { $lt: beforeDate };
        }
      }
    }

    const rawMessages = await CommunityMessageModel.find(filter)
      .populate('senderId', 'fullName username avatarUrl')
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rawMessages.length > limit;
    const pageDocs = hasMore ? rawMessages.slice(0, limit) : rawMessages;

    const formatted = pageDocs.reverse().map((m: any) => {
      const liveSender = m.senderId && typeof m.senderId === 'object' ? m.senderId : null;
      return {
        id: m._id.toString(),
        channel: m.channel || 'general',
        senderId: liveSender?._id?.toString() || (m.senderId ? m.senderId.toString() : undefined),
        senderName: liveSender?.fullName || m.senderName,
        senderAvatar: liveSender?.avatarUrl || m.senderAvatar,
        senderBadge: m.senderBadge,
        nameColor: m.nameColor,
        text: m.text,
        gpsLat: typeof m.gpsLat === 'number' ? m.gpsLat : undefined,
        gpsLng: typeof m.gpsLng === 'number' ? m.gpsLng : undefined,
        altitudeM: typeof m.altitudeM === 'number' ? m.altitudeM : undefined,
        quote: m.quote && m.quote.author && m.quote.text ? { author: m.quote.author, text: m.quote.text } : undefined,
        createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
      };
    });

    return res.json({ success: true, data: formatted, hasMore, channel });
  } catch (err) {
    console.error('[Get Community Chat Messages Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi tải lịch sử tin nhắn cộng đồng' });
  }
};

export const deleteCommunityChatMessage = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const isStaff = req.user?.role === 'admin' || req.user?.role === 'moderator';
    const { id } = req.params;

    if (!currentUserId || !isValidObjectId(currentUserId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã tin nhắn không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const msg = await CommunityMessageModel.findById(id).select('_id senderId channel').lean();
    if (!msg) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tin nhắn.' });
    }

    const isOwner = Boolean(msg.senderId && String(msg.senderId) === String(currentUserId));
    if (!isStaff && !isOwner) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa tin nhắn này.' });
    }

    await CommunityMessageModel.deleteOne({ _id: msg._id });
    await recordAuditLog(req, 'DELETE_COMMUNITY_MESSAGE', 'community_messages', `Xóa tin nhắn thực địa ${msg._id}`);

    broadcastEvent('communityMessageDeleted', {
      id: msg._id.toString(),
      channel: msg.channel || 'general',
    });

    return res.json({ success: true, id: msg._id.toString(), message: 'Đã xóa tin nhắn.' });
  } catch (err) {
    console.error('[Delete Community Chat Message Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa tin nhắn.' });
  }
};

export const pinThreadAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'moderator') {
      return res.status(403).json({ success: false, message: 'Yêu cầu quyền Admin hoặc Moderator.' });
    }
    const id = String(req.params.id || '');
    const query = isValidObjectId(id) ? { $or: [{ id }, { _id: new Types.ObjectId(id) }] } : { id };

    const thread = await ThreadModel.findOne(query);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    }

    thread.isPinned = !thread.isPinned;
    await thread.save();

    await recordAuditLog(req, thread.isPinned ? 'PIN_THREAD' : 'UNPIN_THREAD', 'threads', `${thread.isPinned ? 'Ghim' : 'Gỡ ghim'} bài viết ${thread.id}`);
    broadcastEvent('threadPinned', { threadId: thread.id, isPinned: thread.isPinned });

    return res.json({
      success: true,
      message: thread.isPinned ? 'Đã ghim bài viết lên đầu diễn đàn!' : 'Đã gỡ ghim bài viết.',
      data: {
        id: thread.id,
        _id: thread._id,
        isPinned: thread.isPinned,
        isLocked: Boolean(thread.isLocked),
      },
    });
  } catch (err) {
    console.error('[Pin Thread Admin Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi ghim bài viết.' });
  }
};

export const lockThreadAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'moderator') {
      return res.status(403).json({ success: false, message: 'Yêu cầu quyền Admin hoặc Moderator.' });
    }
    const id = String(req.params.id || '');
    const query = isValidObjectId(id) ? { $or: [{ id }, { _id: new Types.ObjectId(id) }] } : { id };

    const thread = await ThreadModel.findOne(query);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    }

    thread.isLocked = !thread.isLocked;
    await thread.save();

    await recordAuditLog(req, thread.isLocked ? 'LOCK_THREAD' : 'UNLOCK_THREAD', 'threads', `${thread.isLocked ? 'Khóa' : 'Mở khóa'} bài viết ${thread.id}`);
    broadcastEvent('threadLocked', { threadId: thread.id, isLocked: thread.isLocked });

    return res.json({
      success: true,
      message: thread.isLocked ? 'Đã khóa bình luận bài viết!' : 'Đã mở khóa bình luận bài viết.',
      data: {
        id: thread.id,
        _id: thread._id,
        isPinned: Boolean(thread.isPinned),
        isLocked: thread.isLocked,
      },
    });
  } catch (err) {
    console.error('[Lock Thread Admin Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi khóa bình luận bài viết.' });
  }
};

export const deleteThreadAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'moderator') {
      return res.status(403).json({ success: false, message: 'Yêu cầu quyền Admin hoặc Moderator.' });
    }
    const id = String(req.params.id || '');
    const query = isValidObjectId(id) ? { $or: [{ id }, { _id: new Types.ObjectId(id) }] } : { id };

    const thread = await ThreadModel.findOneAndDelete(query);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết để xóa.' });
    }

    await CommentModel.deleteMany({ threadId: thread.id }).catch(() => {});
    await recordAuditLog(req, 'DELETE_THREAD', 'threads', `Xóa bài viết "${thread.title}" (${thread.id})`);
    broadcastEvent('threadDeleted', { threadId: thread.id });

    return res.json({
      success: true,
      message: `Đã xóa bài viết "${thread.title}" thành công!`,
    });
  } catch (err) {
    console.error('[Delete Thread Admin Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa bài viết.' });
  }
};
