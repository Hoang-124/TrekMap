import { Request, Response } from 'express';
import { ThreadModel } from '../models/Thread.js';
import { UserModel } from '../models/User.js';
import { verifyToken } from '../utils/auth.js';
import { getUserKey, getUserKeys } from '../middleware/auth.middleware.js';
import { mockThreads } from '../data/seedData.js';
import { containsProfanity, getProfanityMatch } from '../utils/profanityFilter.js';
import { awardReputationPoints, deductReputationPoints, REPUTATION_POINTS, PENALTY_POINTS } from '../utils/reputation.js';
import { NotificationModel } from '../models/Notification.js';
import { emitToUser, broadcastEvent } from '../config/socket.js';

export const getThreads = async (req: Request, res: Response) => {
  try {
    const userKeys = getUserKeys(req);

    const mongoThreads = await ThreadModel.find().populate('userId').sort({ createdAt: -1 });
    if (mongoThreads && mongoThreads.length > 0) {
      return res.json({
        success: true,
        data: mongoThreads.map((t) => {
          const userObj = t.userId as any;
          const liveAvatar = (userObj && userObj.avatarUrl)
            ? userObj.avatarUrl
            : (t.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.authorName)}&background=0ed7b5&color=041217&bold=true`);

          let currentUserReaction: string | null = null;
          if (t.userReactionsMap) {
            const isMap = typeof (t.userReactionsMap as any).get === 'function';
            for (const key of userKeys) {
              const r = isMap ? (t.userReactionsMap as any).get(key) : (t.userReactionsMap as any)[key];
              if (r) {
                currentUserReaction = r;
                break;
              }
            }
          }

          return {
            id: t.id,
            title: t.title,
            authorName: t.authorName,
            authorAvatar: liveAvatar,
            userId: userObj ? (userObj._id ? userObj._id.toString() : t.userId) : t.userId,
            category: t.category,
            content: t.content,
            upvotes: t.upvotes,
            reactions: t.reactions,
            userReaction: currentUserReaction || null,
            repliesCount: t.repliesCount,
            viewsCount: t.viewsCount,
            createdAt: new Date(t.createdAt).toLocaleDateString('vi-VN'),
          };
        }),
      });
    }
    return res.json({ success: true, data: mockThreads });
  } catch (err) {
    return res.json({ success: true, data: mockThreads });
  }
};

export const createThread = async (req: Request, res: Response) => {
  const { title, category, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập tiêu đề và nội dung bài viết.' });
  }

  // Check automated profanity & toxic content filter
  const isToxic = containsProfanity(`${title} ${content}`);
  if (isToxic) {
    const matchedWord = getProfanityMatch(`${title} ${content}`);
    let penaltyInfo = null;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      if (decoded?.userId) {
        penaltyInfo = await deductReputationPoints(
          decoded.userId,
          PENALTY_POINTS.PROFANITY_VIOLATION,
          `Đăng bài chứa từ ngữ thô tục/xúc phạm (${matchedWord})`
        );
      }
    }

    return res.status(400).json({
      success: false,
      message: `Bài viết bị từ chối do chứa từ ngữ vi phạm quy chuẩn phát ngôn cộng đồng ("${matchedWord}"). Bạn bị trừ ${PENALTY_POINTS.PROFANITY_VIOLATION} điểm uy tín.`,
      penaltyInfo,
    });
  }

  let authorName = 'Hoàng';
  let authorAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=0ed7b5&color=041217&bold=true`;
  let userIdObj: any = undefined;

  let reputationReward = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded?.userId) {
      try {
        const user = await UserModel.findById(decoded.userId);
        if (user) {
          userIdObj = user._id;
          reputationReward = await awardReputationPoints(
            user._id.toString(),
            REPUTATION_POINTS.CREATE_FORUM_THREAD,
            'Đăng bài nhật ký băng rừng'
          );

          authorName = user.fullName;
          if (user.avatarUrl) {
            authorAvatar = user.avatarUrl;
          } else {
            authorAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=0ed7b5&color=041217&bold=true`;
          }
        }
      } catch (err) {
        console.error('[Forum User Lookup Error]:', err);
      }
    }
  }

  const threadId = `thread-${Date.now()}`;
  const newThreadObj = {
    id: threadId,
    title,
    authorName,
    authorAvatar,
    userId: userIdObj,
    category: category || 'Kinh Nghiệm',
    content,
    upvotes: 0,
    reactions: { like: 0, love: 0, haha: 0, wow: 0, buon: 0, huhu: 0, sad: 0, angry: 0, dislike: 0 },
    repliesCount: 0,
    viewsCount: 1,
    createdAt: 'Vừa xong',
  };

  try {
    await ThreadModel.create({
      id: threadId,
      title,
      authorName,
      authorAvatar,
      userId: userIdObj,
      category: category || 'Kinh Nghiệm',
      content,
      upvotes: 0,
      reactions: { like: 0, love: 0, haha: 0, wow: 0, buon: 0, huhu: 0, sad: 0, angry: 0, dislike: 0 },
      userReactionsMap: {},
      repliesCount: 0,
      viewsCount: 1,
    });
  } catch (err) {
    console.error('[MongoDB Thread Save Error]:', err);
  }

  res.status(201).json({
    success: true,
    message: 'Đăng bài thảo luận thành công! Bạn nhận +15 điểm uy tín.',
    data: newThreadObj,
    reputationReward,
  });
};

export const reactToThread = async (req: Request, res: Response) => {
  const { threadId } = req.params;
  const { reactionType } = req.body;

  try {
    const threadDoc = await ThreadModel.findOne({ id: threadId });
    if (!threadDoc) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    }

    const userKeys = getUserKeys(req);
    const primaryKey = userKeys[0];

    if (!threadDoc.userReactionsMap) {
      threadDoc.userReactionsMap = {} as any;
    }

    const mapObj = threadDoc.userReactionsMap as any;
    const isMapInstance = typeof mapObj.get === 'function';

    let currentReaction: string | null = null;
    let targetKey = primaryKey;

    for (const key of userKeys) {
      const existing = isMapInstance ? mapObj.get(key) : mapObj[key];
      if (existing) {
        currentReaction = existing;
        targetKey = key;
        break;
      }
    }

    let newReaction: string | null = reactionType;

    if (currentReaction === reactionType) {
      newReaction = null;
      if (isMapInstance) mapObj.delete(targetKey);
      else delete mapObj[targetKey];
    } else if (reactionType) {
      newReaction = reactionType;
      if (isMapInstance) mapObj.set(primaryKey, reactionType);
      else mapObj[primaryKey] = reactionType;
    } else {
      newReaction = null;
      if (isMapInstance) mapObj.delete(targetKey);
      else delete mapObj[targetKey];
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

    if (isMapInstance) {
      for (const [_, r] of mapObj.entries()) {
        if (r && counts[r] !== undefined) counts[r]++;
      }
    } else {
      for (const r of Object.values(mapObj as Record<string, string>)) {
        if (r && counts[r] !== undefined) counts[r]++;
      }
    }

    const totalUpvotes = Object.values(counts).reduce((a, b) => a + b, 0);

    threadDoc.reactions = counts as any;
    threadDoc.upvotes = totalUpvotes;
    threadDoc.markModified('reactions');
    threadDoc.markModified('userReactionsMap');
    await threadDoc.save();

    // Notify thread author about new reaction
    if (newReaction) {
      try {
        let threadAuthorId = threadDoc.userId ? String(threadDoc.userId) : null;
        if (!threadAuthorId && threadDoc.authorName) {
          const authorUser = await UserModel.findOne({
            $or: [{ fullName: threadDoc.authorName }, { username: threadDoc.authorName }],
          });
          if (authorUser) threadAuthorId = String(authorUser._id);
        }

        const authHeader = req.headers['authorization'];
        let reactorName = 'Thành viên TrekMap';
        let reactorId = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const decoded = verifyToken(authHeader.substring(7));
          if (decoded?.userId) {
            reactorId = decoded.userId;
            const reactor = await UserModel.findById(decoded.userId);
            if (reactor) reactorName = reactor.fullName || reactor.username;
          }
        }

        if (threadAuthorId && String(threadAuthorId) !== String(reactorId)) {
          const notif = new NotificationModel({
            recipient: threadAuthorId as any,
            sender: reactorId as any,
            type: 'reaction',
            title: 'Cảm xúc mới về bài viết của bạn',
            message: `${reactorName} đã thả cảm xúc cho bài viết "${threadDoc.title ? (threadDoc.title.length > 35 ? threadDoc.title.substring(0, 35) + '...' : threadDoc.title) : 'của bạn'}"`,
            link: `/forum?threadId=${threadDoc.id}`,
            relatedId: threadDoc.id as any,
            isRead: false,
          });
          await notif.save();
          emitToUser(threadAuthorId, 'newNotification', notif);
        }
      } catch (notifErr) {
        console.warn('⚠️ [Thread Reaction Notification Warning]:', notifErr);
      }
    }

    // Broadcast threadReactionUpdate event to all connected clients
    broadcastEvent('threadReactionUpdate', {
      threadId: threadDoc.id,
      upvotes: totalUpvotes,
      reactions: threadDoc.reactions,
    });

    return res.json({
      success: true,
      upvotes: totalUpvotes,
      userReaction: newReaction,
      data: threadDoc.reactions,
    });
  } catch (err) {
    console.error('[Thread Reaction API Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi lưu cảm xúc bài viết.' });
  }
};
