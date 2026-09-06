import { Request, Response } from 'express';
import { CommentModel } from '../models/Comment.js';
import { ThreadModel } from '../models/Thread.js';
import { UserModel } from '../models/User.js';
import { verifyToken } from '../utils/auth.js';
import { getUserKey, getUserKeys } from '../middleware/auth.middleware.js';
import { containsProfanity, getProfanityMatch } from '../utils/profanityFilter.js';
import { awardReputationPoints, deductReputationPoints, REPUTATION_POINTS, PENALTY_POINTS } from '../utils/reputation.js';
import { NotificationModel } from '../models/Notification.js';
import { emitToUser, broadcastEvent } from '../config/socket.js';

export const getComments = async (req: Request, res: Response) => {
  const { threadId } = req.params;
  try {
    const userKeys = getUserKeys(req);

    const allComments = await CommentModel.find({ threadId }).populate('userId').sort({ createdAt: 1 });
    
    const commentMap = new Map<string, any>();
    const rootComments: any[] = [];

    allComments.forEach((c) => {
      let currentUserReaction: string | null = null;
      if (c.userReactionsMap) {
        const isMap = typeof (c.userReactionsMap as any).get === 'function';
        for (const key of userKeys) {
          const r = isMap ? (c.userReactionsMap as any).get(key) : (c.userReactionsMap as any)[key];
          if (r) {
            currentUserReaction = r;
            break;
          }
        }
      }

      const userObj = c.userId as any;
      const liveAvatar = (userObj && userObj.avatarUrl)
        ? userObj.avatarUrl
        : (c.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.authorName)}&background=0ed7b5&color=041217&bold=true`);
      const liveName = (userObj && userObj.fullName) ? userObj.fullName : c.authorName;

      const formatted = {
        id: c._id.toString(),
        parentId: c.parentId || null,
        authorName: liveName,
        authorAvatar: liveAvatar,
        content: c.content,
        reactions: c.reactions || { like: 0, love: 0, haha: 0, wow: 0, buon: 0, huhu: 0, sad: 0, angry: 0, dislike: 0 },
        userReaction: currentUserReaction || null,
        replies: [],
        createdAt: new Date(c.createdAt).toLocaleDateString('vi-VN') + ' ' + new Date(c.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      commentMap.set(c._id.toString(), formatted);
    });

    allComments.forEach((c) => {
      const current = commentMap.get(c._id.toString());
      if (c.parentId && commentMap.has(c.parentId)) {
        commentMap.get(c.parentId).replies.push(current);
      } else {
        rootComments.push(current);
      }
    });

    return res.json({
      success: true,
      totalCount: allComments.length,
      data: rootComments,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi khi tải bình luận.' });
  }
};

export const createComment = async (req: Request, res: Response) => {
  const { threadId } = req.params;
  const { content, parentId } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập nội dung bình luận.' });
  }

  const cleanText = content.trim();

  // Automated profanity & toxic content filter check
  const isToxic = containsProfanity(cleanText);
  if (isToxic) {
    const matchedWord = getProfanityMatch(cleanText);
    let penaltyInfo = null;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      if (decoded?.userId) {
        penaltyInfo = await deductReputationPoints(
          decoded.userId,
          PENALTY_POINTS.TOXIC_COMMENT,
          `Bình luận chứa từ ngữ thô tục ("${matchedWord}")`
        );
      }
    }

    return res.status(400).json({
      success: false,
      message: `Bình luận bị từ chối do chứa từ ngữ vi phạm ("${matchedWord}"). Bạn bị trừ ${PENALTY_POINTS.TOXIC_COMMENT} điểm uy tín.`,
      penaltyInfo,
    });
  }

  const duplicateCheck = await CommentModel.findOne({
    threadId,
    parentId: parentId || null,
    content: cleanText,
    createdAt: { $gte: new Date(Date.now() - 4000) },
  });
  if (duplicateCheck) {
    const totalCount = await CommentModel.countDocuments({ threadId });
    return res.status(200).json({
      success: true,
      message: 'Bình luận đã được ghi nhận.',
      repliesCount: totalCount,
      data: {
        id: duplicateCheck._id.toString(),
        parentId: duplicateCheck.parentId || null,
        authorName: duplicateCheck.authorName,
        authorAvatar: duplicateCheck.authorAvatar,
        content: cleanText,
        reactions: duplicateCheck.reactions || { like: 0, love: 0, haha: 0, wow: 0, buon: 0, huhu: 0, sad: 0, angry: 0, dislike: 0 },
        replies: [],
        createdAt: 'Vừa xong',
      },
    });
  }

  let authorName = 'Trekker Cộng Đồng';
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
            REPUTATION_POINTS.CREATE_COMMENT,
            'Bình luận bài thảo luận'
          );
          authorName = user.fullName;
          if (user.avatarUrl) {
            authorAvatar = user.avatarUrl;
          } else {
            authorAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=0ed7b5&color=041217&bold=true`;
          }
        }
      } catch (err) {
        console.error('[Comment User Lookup Error]:', err);
      }
    }
  }

  // If not logged in, allow authorName/authorAvatar from request body if passed
  if (!userIdObj && req.body.authorName && typeof req.body.authorName === 'string' && req.body.authorName.trim()) {
    authorName = req.body.authorName.trim();
    if (req.body.authorAvatar && typeof req.body.authorAvatar === 'string') {
      authorAvatar = req.body.authorAvatar;
    } else {
      authorAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=0ed7b5&color=041217&bold=true`;
    }
  }

  const targetThreadId = Array.isArray(threadId) ? threadId[0] : String(threadId);

  try {
    const newCommentDoc: any = await CommentModel.create({
      threadId: targetThreadId,
      parentId: parentId || null,
      authorName,
      authorAvatar,
      userId: userIdObj,
      content: cleanText,
      reactions: { like: 0, love: 0, haha: 0, wow: 0, buon: 0, huhu: 0, sad: 0, angry: 0, dislike: 0 },
      userReactionsMap: {},
    });

    const totalCount = await CommentModel.countDocuments({ threadId: targetThreadId });
    await ThreadModel.findOneAndUpdate({ id: targetThreadId }, { repliesCount: totalCount });

    // Notify parent comment author (if this is a sub-reply) and/or thread author
    try {
      const thread = await ThreadModel.findOne({ id: targetThreadId });
      let postAuthorId = thread?.userId ? String(thread.userId) : null;
      if (!postAuthorId && thread?.authorName) {
        const authorUser = await UserModel.findOne({
          $or: [{ fullName: thread.authorName }, { username: thread.authorName }],
        });
        if (authorUser) postAuthorId = String(authorUser._id);
      }

      let parentAuthorId: string | null = null;
      if (parentId) {
        const parentComment = await CommentModel.findById(parentId);
        if (parentComment) {
          parentAuthorId = parentComment.userId ? String(parentComment.userId) : null;
          if (!parentAuthorId && parentComment.authorName) {
            const parentAuthorUser = await UserModel.findOne({
              $or: [{ fullName: parentComment.authorName }, { username: parentComment.authorName }],
            });
            if (parentAuthorUser) parentAuthorId = String(parentAuthorUser._id);
          }

          // Send notification to the parent comment author
          if (parentAuthorId && String(parentAuthorId) !== String(userIdObj)) {
            const notif = new NotificationModel({
              recipient: parentAuthorId as any,
              sender: userIdObj as any,
              type: 'comment',
              title: 'Phản hồi mới về bình luận của bạn',
              message: `${authorName} đã trả lời bình luận của bạn: "${cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText}"`,
              link: `/forum?threadId=${targetThreadId}`,
              relatedId: targetThreadId as any,
              isRead: false,
            });
            await notif.save();
            emitToUser(parentAuthorId, 'newNotification', notif);
          }
        }
      }

      // Send notification to thread author (if different from sender and parent author)
      if (
        postAuthorId &&
        String(postAuthorId) !== String(userIdObj) &&
        String(postAuthorId) !== String(parentAuthorId)
      ) {
        const notif = new NotificationModel({
          recipient: postAuthorId as any,
          sender: userIdObj as any,
          type: 'comment',
          title: 'Bình luận mới về bài viết của bạn',
          message: `${authorName} đã bình luận: "${cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText}"`,
          link: `/forum?threadId=${targetThreadId}`,
          relatedId: targetThreadId as any,
          isRead: false,
        });
        await notif.save();
        emitToUser(postAuthorId, 'newNotification', notif);
      }
    } catch (notifErr) {
      console.warn('⚠️ [Comment Notification Warning]:', notifErr);
    }

    // Broadcast real-time newComment event to all connected clients
    broadcastEvent('newComment', {
      threadId: targetThreadId,
      repliesCount: totalCount,
      comment: {
        id: newCommentDoc._id ? newCommentDoc._id.toString() : String(Date.now()),
        parentId: newCommentDoc.parentId || null,
        authorName,
        authorAvatar,
        content: cleanText,
        reactions: newCommentDoc.reactions,
        replies: [],
        createdAt: 'Vừa xong',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Gửi bình luận thành công! Bạn nhận +10 điểm uy tín.',
      repliesCount: totalCount,
      data: {
        id: newCommentDoc._id ? newCommentDoc._id.toString() : String(Date.now()),
        parentId: newCommentDoc.parentId || null,
        authorName,
        authorAvatar,
        content: cleanText,
        reactions: newCommentDoc.reactions,
        replies: [],
        createdAt: 'Vừa xong',
      },
      reputationReward,
    });
  } catch (err) {
    console.error('[Comment Save Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi lưu bình luận vào MongoDB.' });
  }
};

export const reactToComment = async (req: Request, res: Response) => {
  const { commentId } = req.params;
  const { reactionType } = req.body;

  try {
    const comment = await CommentModel.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bình luận.' });
    }

    const userKeys = getUserKeys(req);
    const primaryKey = userKeys[0];

    if (!comment.userReactionsMap) {
      comment.userReactionsMap = {} as any;
    }

    const mapObj = comment.userReactionsMap as any;
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
      if (isMapInstance) {
        mapObj.delete(targetKey);
        mapObj.delete(primaryKey);
      } else {
        delete mapObj[targetKey];
        delete mapObj[primaryKey];
      }
    } else if (reactionType) {
      newReaction = reactionType;
      if (targetKey !== primaryKey) {
        if (isMapInstance) mapObj.delete(targetKey);
        else delete mapObj[targetKey];
      }
      if (isMapInstance) mapObj.set(primaryKey, reactionType);
      else mapObj[primaryKey] = reactionType;
    } else {
      newReaction = null;
      if (isMapInstance) {
        mapObj.delete(targetKey);
        mapObj.delete(primaryKey);
      } else {
        delete mapObj[targetKey];
        delete mapObj[primaryKey];
      }
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

    comment.reactions = counts as any;
    comment.markModified('reactions');
    comment.markModified('userReactionsMap');
    await comment.save();

    // Notify comment author about new reaction
    if (newReaction) {
      try {
        let commentAuthorId = comment.userId ? String(comment.userId) : null;
        if (!commentAuthorId && comment.authorName) {
          const authorUser = await UserModel.findOne({
            $or: [{ fullName: comment.authorName }, { username: comment.authorName }],
          });
          if (authorUser) commentAuthorId = String(authorUser._id);
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

        if (commentAuthorId && String(commentAuthorId) !== String(reactorId)) {
          const notif = new NotificationModel({
            recipient: commentAuthorId as any,
            sender: reactorId as any,
            type: 'reaction',
            title: 'Cảm xúc mới về bình luận của bạn',
            message: `${reactorName} đã thả cảm xúc cho bình luận của bạn: "${comment.content ? (comment.content.length > 40 ? comment.content.substring(0, 40) + '...' : comment.content) : ''}"`,
            link: `/forum?threadId=${comment.threadId}`,
            relatedId: comment.threadId as any,
            isRead: false,
          });
          await notif.save();
          emitToUser(commentAuthorId, 'newNotification', notif);
        }
      } catch (notifErr) {
        console.warn('⚠️ [Comment Reaction Notification Warning]:', notifErr);
      }
    }

    // Broadcast commentReactionUpdate event to all connected clients
    broadcastEvent('commentReactionUpdate', {
      commentId: comment._id.toString(),
      threadId: comment.threadId,
      reactions: comment.reactions,
    });

    return res.json({
      success: true,
      userReaction: newReaction,
      data: comment.reactions,
    });
  } catch (err) {
    console.error('[Comment Reaction API Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi lưu cảm xúc bình luận.' });
  }
};
