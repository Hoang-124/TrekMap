import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { CommentModel } from '../models/Comment.js';
import { ThreadModel } from '../models/Thread.js';
import { UserModel } from '../models/User.js';
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
import { sanitizeInput } from '../utils/validation.js';
import { isValidObjectId } from '../utils/resolveTrail.js';
import { recordAuditLog } from '../utils/audit.js';

const VALID_REACTIONS = new Set(['like', 'love', 'haha', 'wow', 'buon', 'huhu', 'sad', 'angry', 'dislike']);
const DEFAULT_AVATAR = '/covers/avatar-default.svg';

export const getComments = async (req: Request, res: Response) => {
  const { threadId } = req.params;
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, totalCount: 0, data: [] });
    }
    const userKeys = getUserKeys(req);

    const allComments = await CommentModel.find({ threadId: String(threadId) })
      .populate('userId', 'fullName username avatarUrl')
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();

    const commentMap = new Map<string, any>();
    const rootComments: any[] = [];

    allComments.forEach((c: any) => {
      let currentUserReaction: string | null = null;
      if (c.userReactionsMap) {
        const isMap = typeof c.userReactionsMap.get === 'function';
        for (const key of userKeys) {
          const r = isMap ? c.userReactionsMap.get(key) : c.userReactionsMap[key];
          if (r) {
            currentUserReaction = r;
            break;
          }
        }
      }

      const userObj = c.userId && typeof c.userId === 'object' ? c.userId : null;
      const liveName = userObj?.fullName || c.authorName;
      const liveAvatar = userObj?.avatarUrl || c.authorAvatar || DEFAULT_AVATAR;

      const formatted = {
        id: c._id.toString(),
        parentId: c.parentId || null,
        userId: userObj?._id?.toString() || (c.userId ? String(c.userId) : undefined),
        authorName: liveName,
        authorAvatar: liveAvatar,
        content: c.content,
        isBestAnswer: Boolean(c.isBestAnswer),
        reactions: c.reactions || {
          like: 0,
          love: 0,
          haha: 0,
          wow: 0,
          buon: 0,
          huhu: 0,
          sad: 0,
          angry: 0,
          dislike: 0,
        },
        userReaction: currentUserReaction || null,
        replies: [],
        // Always emit clean ISO-8601 timestamps for timezone-safe client formatting
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
      };
      commentMap.set(c._id.toString(), formatted);
    });

    allComments.forEach((c: any) => {
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
    console.error('[Get Comments Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải bình luận.' });
  }
};

export const createComment = async (req: AuthRequest, res: Response) => {
  const targetThreadId = String(req.params.threadId || '').trim();
  const { content, parentId } = req.body || {};
  const currentUserId = req.user?.userId;

  if (!currentUserId || !isValidObjectId(currentUserId)) {
    return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để gửi bình luận.' });
  }

  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập nội dung bình luận.' });
  }

  const safeParentId = typeof parentId === 'string' && parentId.trim() ? parentId.trim() : null;
  const cleanText = sanitizeInput(content).slice(0, 2000);
  if (!cleanText.trim()) {
    return res.status(400).json({ success: false, message: 'Nội dung bình luận không hợp lệ.' });
  }

  if (containsProfanity(cleanText)) {
    const matchedWord = getProfanityMatch(cleanText);
    const penaltyInfo = await deductReputationPoints(
      currentUserId,
      PENALTY_POINTS.TOXIC_COMMENT,
      `Bình luận chứa từ ngữ vi phạm ("${matchedWord}")`
    );

    return res.status(400).json({
      success: false,
      message: `Bình luận bị từ chối do chứa từ ngữ vi phạm ("${matchedWord}"). Bạn bị trừ ${PENALTY_POINTS.TOXIC_COMMENT} điểm uy tín.`,
      penaltyInfo,
    });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
  }

  try {
    const thread = await ThreadModel.findOne({ id: targetThreadId });
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết để bình luận.' });
    }
    if (thread.isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Bài viết này đã bị Ban Quản Trị khóa tính năng bình luận.',
      });
    }

    // Validate parentId belongs to this exact thread (prevents cross-thread reply injection)
    let parentAuthorId: string | null = null;
    if (safeParentId) {
      if (!isValidObjectId(safeParentId)) {
        return res.status(400).json({ success: false, message: 'Mã bình luận cha không hợp lệ.' });
      }
      const parentComment = await CommentModel.findOne({ _id: safeParentId, threadId: targetThreadId })
        .select('userId')
        .lean();
      if (!parentComment) {
        return res.status(400).json({ success: false, message: 'Bình luận cha không thuộc bài viết này.' });
      }
      if (parentComment.userId) {
        parentAuthorId = String(parentComment.userId);
      }
    }

    const userObjId = new mongoose.Types.ObjectId(currentUserId);

    const duplicateCheck = await CommentModel.findOne({
      threadId: targetThreadId,
      parentId: safeParentId,
      userId: userObjId,
      content: cleanText,
      createdAt: { $gte: new Date(Date.now() - 4000) },
    });
    if (duplicateCheck) {
      const totalCount = await CommentModel.countDocuments({ threadId: targetThreadId });
      return res.status(200).json({
        success: true,
        message: 'Bình luận đã được ghi nhận.',
        repliesCount: totalCount,
        data: {
          id: duplicateCheck._id.toString(),
          parentId: duplicateCheck.parentId || null,
          userId: currentUserId,
          authorName: duplicateCheck.authorName,
          authorAvatar: duplicateCheck.authorAvatar,
          content: cleanText,
          reactions: duplicateCheck.reactions,
          replies: [],
          createdAt: duplicateCheck.createdAt.toISOString(),
        },
      });
    }

    const user = await UserModel.findById(userObjId).select('fullName avatarUrl').lean();
    const authorName = user?.fullName || 'Trekker Cộng Đồng';
    const authorAvatar = user?.avatarUrl || DEFAULT_AVATAR;

    const newCommentDoc = await CommentModel.create({
      threadId: targetThreadId,
      parentId: safeParentId,
      authorName,
      authorAvatar,
      userId: userObjId,
      content: cleanText,
      reactions: { like: 0, love: 0, haha: 0, wow: 0, buon: 0, huhu: 0, sad: 0, angry: 0, dislike: 0 },
      userReactionsMap: new Map(),
    });

    const reputationReward = await awardReputationPoints(
      currentUserId,
      REPUTATION_POINTS.CREATE_COMMENT,
      'Bình luận bài thảo luận'
    );

    const totalCount = await CommentModel.countDocuments({ threadId: targetThreadId });
    await ThreadModel.updateOne({ _id: thread._id }, { $set: { repliesCount: totalCount } });

    const senderInfo = {
      id: currentUserId,
      name: authorName,
      avatarUrl: authorAvatar,
    };

    const previewText = cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText;

    if (parentAuthorId && parentAuthorId !== String(currentUserId)) {
      sendNotification({
        recipientId: parentAuthorId,
        sender: senderInfo,
        type: 'community_reply',
        category: 'social',
        title: 'Phản hồi mới về bình luận của bạn',
        message: `${authorName} đã trả lời bình luận của bạn: "${previewText}"`,
        link: `/forum?threadId=${targetThreadId}`,
        relatedId: targetThreadId,
      }).catch(() => {});
    }

    const postAuthorId = thread.userId ? String(thread.userId) : null;
    if (postAuthorId && postAuthorId !== String(currentUserId) && postAuthorId !== parentAuthorId) {
      sendNotification({
        recipientId: postAuthorId,
        sender: senderInfo,
        type: 'community_comment',
        category: 'social',
        title: 'Bình luận mới về bài viết của bạn',
        message: `${authorName} đã bình luận: "${previewText}"`,
        link: `/forum?threadId=${targetThreadId}`,
        relatedId: targetThreadId,
      }).catch(() => {});
    }

    const responseComment = {
      id: newCommentDoc._id.toString(),
      parentId: newCommentDoc.parentId || null,
      userId: currentUserId,
      authorName,
      authorAvatar,
      content: cleanText,
      reactions: newCommentDoc.reactions,
      replies: [],
      createdAt: newCommentDoc.createdAt.toISOString(),
    };

    broadcastEvent('newComment', {
      threadId: targetThreadId,
      repliesCount: totalCount,
      comment: responseComment,
    });

    return res.status(201).json({
      success: true,
      message: 'Gửi bình luận thành công! Bạn nhận +10 điểm uy tín.',
      repliesCount: totalCount,
      data: responseComment,
      reputationReward,
    });
  } catch (err) {
    console.error('[Comment Save Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi lưu bình luận.' });
  }
};

export const updateComment = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const isStaff = req.user?.role === 'admin' || req.user?.role === 'moderator';
    const { commentId } = req.params;
    const { content } = req.body || {};

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(commentId)) {
      return res.status(400).json({ success: false, message: 'Mã bình luận không hợp lệ.' });
    }
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập nội dung bình luận.' });
    }
    const cleanText = sanitizeInput(content).slice(0, 2000);
    if (!cleanText.trim()) {
      return res.status(400).json({ success: false, message: 'Nội dung bình luận không hợp lệ.' });
    }

    if (containsProfanity(cleanText)) {
      const matchedWord = getProfanityMatch(cleanText);
      const penaltyInfo = await deductReputationPoints(
        currentUserId,
        PENALTY_POINTS.TOXIC_COMMENT,
        `Chỉnh sửa bình luận chứa từ ngữ vi phạm ("${matchedWord}")`
      );
      return res.status(400).json({
        success: false,
        message: `Bình luận bị từ chối do chứa từ ngữ vi phạm ("${matchedWord}").`,
        penaltyInfo,
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const comment = await CommentModel.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bình luận.' });
    }
    if (!isStaff && String(comment.userId) !== String(currentUserId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa bình luận này.' });
    }

    comment.content = cleanText;
    await comment.save();
    await recordAuditLog(req, 'UPDATE_COMMENT', 'comments', `Cập nhật bình luận ${comment._id}`);

    const responseComment = {
      id: comment._id.toString(),
      parentId: comment.parentId || null,
      userId: comment.userId ? String(comment.userId) : undefined,
      authorName: comment.authorName,
      authorAvatar: comment.authorAvatar || DEFAULT_AVATAR,
      content: comment.content,
      reactions: comment.reactions,
      createdAt: comment.createdAt ? new Date(comment.createdAt).toISOString() : new Date().toISOString(),
    };

    broadcastEvent('commentUpdated', {
      commentId: comment._id.toString(),
      threadId: comment.threadId,
      content: comment.content,
    });

    return res.json({
      success: true,
      message: 'Đã cập nhật bình luận thành công!',
      data: responseComment,
    });
  } catch (err) {
    console.error('[Update Comment Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật bình luận.' });
  }
};

export const deleteComment = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const isStaff = req.user?.role === 'admin' || req.user?.role === 'moderator';
    const { commentId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(commentId)) {
      return res.status(400).json({ success: false, message: 'Mã bình luận không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const comment = await CommentModel.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bình luận.' });
    }
    if (!isStaff && String(comment.userId) !== String(currentUserId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa bình luận này.' });
    }

    const targetThreadId = comment.threadId;
    await CommentModel.deleteMany({ $or: [{ _id: comment._id }, { parentId: comment._id.toString() }] });

    const totalCount = await CommentModel.countDocuments({ threadId: targetThreadId });
    await ThreadModel.updateOne({ id: targetThreadId }, { $set: { repliesCount: totalCount } }).catch(() => {});
    await recordAuditLog(req, 'DELETE_COMMENT', 'comments', `Xóa bình luận ${comment._id} thuộc bài ${targetThreadId}`);

    broadcastEvent('commentDeleted', {
      commentId: comment._id.toString(),
      threadId: targetThreadId,
      repliesCount: totalCount,
    });

    return res.json({ success: true, repliesCount: totalCount, message: 'Đã xóa bình luận thành công!' });
  } catch (err) {
    console.error('[Delete Comment Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa bình luận.' });
  }
};

export const reactToComment = async (req: AuthRequest, res: Response) => {
  const { commentId } = req.params;
  const { reactionType } = req.body || {};
  const currentUserId = req.user?.userId;

  if (!currentUserId) {
    return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để thả cảm xúc.' });
  }

  if (!isValidObjectId(commentId)) {
    return res.status(400).json({ success: false, message: 'Mã bình luận không hợp lệ.' });
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
    const existing = await CommentModel.findById(commentId)
      .select('_id threadId userId content userReactionsMap')
      .lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bình luận.' });
    }

    const existingMap: Record<string, string> =
      existing.userReactionsMap instanceof Map
        ? Object.fromEntries(existing.userReactionsMap.entries())
        : ((existing.userReactionsMap as any) || {});
    const currentReaction = existingMap[primaryKey] || null;
    let newReaction: string | null = reactionType || null;
    if (!newReaction || currentReaction === newReaction) {
      newReaction = null;
    }

    // Atomic per-user key update prevents concurrent lost updates
    const mapField = `userReactionsMap.${primaryKey}`;
    const updated = await CommentModel.findByIdAndUpdate(
      commentId,
      newReaction ? { $set: { [mapField]: newReaction } } : { $unset: { [mapField]: '' } },
      { new: true }
    )
      .select('userReactionsMap')
      .lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bình luận.' });
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
      updated.userReactionsMap instanceof Map
        ? Array.from(updated.userReactionsMap.entries())
        : Object.entries((updated.userReactionsMap as any) || {});
    for (const [, r] of entries) {
      if (typeof r === 'string' && counts[r] !== undefined) counts[r]++;
    }

    await CommentModel.updateOne({ _id: existing._id }, { $set: { reactions: counts } });

    if (newReaction && !currentReaction && existing.userId && String(existing.userId) !== primaryKey) {
      const reactor = isValidObjectId(primaryKey)
        ? await UserModel.findById(primaryKey).select('fullName avatarUrl').lean()
        : null;
      const reactorName = reactor?.fullName || 'Thành viên LOST';
      const snippet = existing.content
        ? existing.content.length > 40
          ? existing.content.substring(0, 40) + '...'
          : existing.content
        : '';

      sendNotification({
        recipientId: String(existing.userId),
        sender: { id: primaryKey, name: reactorName, avatarUrl: reactor?.avatarUrl || '' },
        type: 'community_comment',
        category: 'social',
        title: 'Cảm xúc mới về bình luận của bạn',
        message: `${reactorName} đã thả cảm xúc cho bình luận của bạn: "${snippet}"`,
        link: `/forum?threadId=${existing.threadId}`,
        relatedId: existing.threadId,
      }).catch(() => {});
    }

    broadcastEvent('commentReactionUpdate', {
      commentId: existing._id.toString(),
      threadId: existing.threadId,
      reactions: counts,
    });

    return res.json({
      success: true,
      userReaction: newReaction,
      data: counts,
    });
  } catch (err) {
    console.error('[Comment Reaction API Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi lưu cảm xúc bình luận.' });
  }
};

export const toggleBestAnswer = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const isStaff = req.user?.role === 'admin' || req.user?.role === 'moderator';
    const targetThreadId = String(req.params.threadId || '').trim();
    const { commentId } = req.params;

    if (!currentUserId || !isValidObjectId(currentUserId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!targetThreadId || !isValidObjectId(commentId)) {
      return res.status(400).json({ success: false, message: 'Mã bài viết hoặc bình luận không hợp lệ.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const threadQuery = isValidObjectId(targetThreadId)
      ? { $or: [{ id: targetThreadId }, { _id: new mongoose.Types.ObjectId(targetThreadId) }] }
      : { id: targetThreadId };
    const thread = await ThreadModel.findOne(threadQuery).select('_id id userId title').lean();
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    }

    const isThreadAuthor = Boolean(thread.userId && String(thread.userId) === String(currentUserId));
    if (!isStaff && !isThreadAuthor) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ tác giả bài viết hoặc Ban Quản Trị mới có quyền chọn câu trả lời hữu ích nhất.',
      });
    }

    const comment = await CommentModel.findOne({ _id: commentId, threadId: thread.id })
      .select('_id threadId isBestAnswer')
      .lean();
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bình luận trong bài viết này.' });
    }

    const nextIsBest = !comment.isBestAnswer;

    // Atomically unset any previous best answer(s) in this thread, then apply the new flag
    await CommentModel.updateMany(
      { threadId: thread.id, isBestAnswer: true },
      { $set: { isBestAnswer: false } }
    );
    if (nextIsBest) {
      await CommentModel.updateOne({ _id: comment._id }, { $set: { isBestAnswer: true } });
    }

    const bestCommentId = nextIsBest ? comment._id.toString() : null;
    await recordAuditLog(
      req,
      'TOGGLE_BEST_ANSWER',
      'comments',
      `${nextIsBest ? 'Ghim' : 'Bỏ ghim'} câu trả lời hữu ích nhất ${comment._id} cho bài ${thread.id}`
    );

    broadcastEvent('commentBestAnswerUpdated', {
      threadId: thread.id,
      bestCommentId,
    });

    return res.json({
      success: true,
      isBestAnswer: nextIsBest,
      bestCommentId,
      message: nextIsBest
        ? 'Đã ghim Câu Trả Lời Hữu Ích Nhất lên đầu thảo luận!'
        : 'Đã bỏ ghim câu trả lời hữu ích nhất.',
    });
  } catch (err) {
    console.error('[Toggle Best Answer Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật câu trả lời hữu ích nhất.' });
  }
};
