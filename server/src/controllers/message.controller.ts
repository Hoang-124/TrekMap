import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { ConversationModel } from '../models/Conversation.js';
import { MessageModel } from '../models/Message.js';
import { UserModel } from '../models/User.js';
import { emitToUser, emitToConversation, isUserOnline } from '../config/socket.js';
import { isValidObjectId } from '../utils/resolveTrail.js';
import { sanitizeInput } from '../utils/validation.js';
import { containsProfanity } from '../utils/profanityFilter.js';
import { sendNotification } from '../utils/notification.js';

/**
 * GET /api/conversations
 * Get paginated list of conversations for current user (single aggregation for unread counts)
 */
export const getConversations = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (mongoose.connection.readyState !== 1 || !isValidObjectId(currentUserId)) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 50);
    const currentObjId = new mongoose.Types.ObjectId(currentUserId);

    const conversations = await ConversationModel.find({
      participants: currentObjId,
      $or: [{ 'lastMessage.content': { $exists: true, $ne: '' } }, { isGroup: true }],
    })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate('participants', 'username fullName avatarUrl role')
      .populate('lastMessage.sender', 'username fullName avatarUrl')
      .lean();

    const convIds = conversations.map((c) => c._id);

    const unreadAgg = convIds.length
      ? await MessageModel.aggregate([
          {
            $match: {
              conversation: { $in: convIds },
              sender: { $ne: currentObjId },
              readBy: { $ne: currentObjId },
            },
          },
          { $group: { _id: '$conversation', count: { $sum: 1 } } },
        ])
      : [];

    const unreadMap = new Map<string, number>();
    for (const item of unreadAgg) {
      unreadMap.set(String(item._id), item.count);
    }

    const result = conversations.map((conv: any) => {
      const otherParticipant = conv.isGroup
        ? {
            _id: String(conv._id),
            username: conv.groupName || 'Nhóm Ghép Đoàn',
            fullName: conv.groupName || 'Nhóm Ghép Đoàn',
            avatarUrl: '',
            role: 'group',
          }
        : conv.participants.find((p: any) => String(p._id || p) !== String(currentUserId));

      return {
        _id: conv._id,
        isGroup: Boolean(conv.isGroup),
        groupName: conv.groupName || '',
        tripPlanId: conv.tripPlanId ? String(conv.tripPlanId) : undefined,
        participants: conv.participants,
        otherParticipant,
        lastMessage: conv.lastMessage,
        unreadCount: unreadMap.get(String(conv._id)) || 0,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      };
    });

    return res.json({ success: true, count: result.length, data: result });
  } catch (err) {
    console.error('[Get Conversations Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể lấy danh sách cuộc trò chuyện.' });
  }
};

/**
 * POST /api/conversations
 * Atomically create or get existing conversation by userId or exact username (NEVER email, preventing email enumeration)
 */
export const getOrCreateConversation = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const { targetUserId } = req.body || {};

    if (!currentUserId || !isValidObjectId(currentUserId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    if (!targetUserId || typeof targetUserId !== 'string' || !targetUserId.trim()) {
      return res.status(400).json({ success: false, message: 'Yêu cầu chỉ định người nhận tin nhắn.' });
    }

    const cleanTarget = targetUserId.trim().slice(0, 100);
    let targetUser: any = null;

    if (/^[a-fA-F0-9]{24}$/.test(cleanTarget)) {
      targetUser = await UserModel.findOne({ _id: cleanTarget, isBanned: { $ne: true } })
        .select('_id username fullName avatarUrl role')
        .lean();
    } else if (!cleanTarget.includes('@')) {
      // Strictly disallow email lookup to prevent account/email enumeration; match username or exact fullName only
      const escaped = cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const exactRegex = new RegExp(`^${escaped}$`, 'i');
      targetUser = await UserModel.findOne({
        isBanned: { $ne: true },
        $or: [{ username: exactRegex }, { fullName: exactRegex }],
      })
        .select('_id username fullName avatarUrl role')
        .lean();
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng. Vui lòng kiểm tra lại mã hoặc tên tài khoản (username).',
      });
    }

    const actualTargetId = String(targetUser._id);
    const isSelf = actualTargetId === String(currentUserId);
    const sortedIds = isSelf ? [String(currentUserId)] : [String(currentUserId), actualTargetId].sort();
    const participantKey = isSelf ? `${currentUserId}_self` : sortedIds.join('_');

    // Atomic upsert eliminates E11000 duplicate race when both users open a DM simultaneously
    const conversation = await ConversationModel.findOneAndUpdate(
      { participantKey },
      {
        $setOnInsert: {
          participants: sortedIds.map((id) => new mongoose.Types.ObjectId(id)),
          participantKey,
          isGroup: false,
        },
      },
      { upsert: true, new: true }
    )
      .populate('participants', 'username fullName avatarUrl role')
      .populate('lastMessage.sender', 'username fullName avatarUrl')
      .lean();

    if (!conversation) {
      return res.status(500).json({ success: false, message: 'Lỗi khi khởi tạo cuộc trò chuyện.' });
    }

    const otherParticipant =
      (conversation.participants as any[]).find((p: any) => String(p._id || p) !== String(currentUserId)) ||
      (conversation.participants as any[])[0];

    const currentObjId = new mongoose.Types.ObjectId(currentUserId);
    const unreadCount = await MessageModel.countDocuments({
      conversation: conversation._id,
      sender: { $ne: currentObjId },
      readBy: { $ne: currentObjId },
    });

    return res.json({
      success: true,
      data: {
        _id: conversation._id,
        isGroup: Boolean(conversation.isGroup),
        groupName: conversation.groupName || '',
        tripPlanId: conversation.tripPlanId ? String(conversation.tripPlanId) : undefined,
        participants: conversation.participants,
        otherParticipant,
        lastMessage: conversation.lastMessage,
        unreadCount,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (err) {
    console.error('[Get or Create Conversation Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể tạo cuộc trò chuyện.' });
  }
};

/**
 * GET /api/conversations/:id/messages
 * Cursor-paginated messages sorted consistently by _id descending to match _id < before cursor
 */
export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const { id: conversationId } = req.params;
    const { before, limit = 20 } = req.query;

    if (!currentUserId || !isValidObjectId(currentUserId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ success: false, message: 'Mã cuộc trò chuyện không hợp lệ.' });
    }

    const conversation = await ConversationModel.findOne({
      _id: conversationId,
      participants: new mongoose.Types.ObjectId(currentUserId),
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện.' });
    }

    const query: any = { conversation: conversation._id };
    if (before) {
      if (!isValidObjectId(before)) {
        return res.status(400).json({ success: false, message: 'Tham số phân trang không hợp lệ.' });
      }
      query._id = { $lt: new mongoose.Types.ObjectId(before) };
    }

    const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

    // Sort by _id: -1 to match the _id cursor strictly (eliminates same-millisecond skip/duplicate glitches)
    const messages = await MessageModel.find(query)
      .sort({ _id: -1 })
      .limit(parsedLimit)
      .populate('sender', 'username fullName avatarUrl')
      .lean();

    const reversedMessages = messages.reverse();

    return res.json({
      success: true,
      count: reversedMessages.length,
      data: reversedMessages,
      hasMore: messages.length === parsedLimit,
    });
  } catch (err) {
    console.error('[Get Messages Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể lấy danh sách tin nhắn.' });
  }
};

/**
 * POST /api/messages
 * Send a new message (Strict Participant Authorization + room broadcast + offline notification)
 */
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const { conversationId, content } = req.body || {};

    if (!currentUserId || !isValidObjectId(currentUserId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ success: false, message: 'Mã cuộc trò chuyện không hợp lệ.' });
    }
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống.' });
    }

    const trimmedContent = sanitizeInput(content).slice(0, 4000);
    if (!trimmedContent) {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không hợp lệ.' });
    }
    if (containsProfanity(trimmedContent)) {
      return res.status(400).json({ success: false, message: 'Tin nhắn chứa từ ngữ vi phạm quy chuẩn cộng đồng.' });
    }

    const senderObjId = new mongoose.Types.ObjectId(currentUserId);

    const conversation = await ConversationModel.findOne({
      _id: conversationId,
      participants: senderObjId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện hoặc bạn không phải thành viên.',
      });
    }

    const message = await MessageModel.create({
      conversation: conversation._id,
      sender: senderObjId,
      content: trimmedContent,
      readBy: [senderObjId],
    });

    await message.populate('sender', 'username fullName avatarUrl');

    await ConversationModel.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessage: {
            content: trimmedContent,
            sender: senderObjId,
            createdAt: message.createdAt,
          },
        },
      }
    );

    const formattedPayload = {
      _id: message._id,
      conversation: conversation._id.toString(),
      sender: message.sender,
      content: message.content,
      readBy: message.readBy,
      createdAt: message.createdAt,
    };

    const senderInfo: any = message.sender;
    const senderName = senderInfo?.fullName || senderInfo?.username || 'Trekker';
    const preview = trimmedContent.length > 60 ? `${trimmedContent.slice(0, 60)}...` : trimmedContent;

    // Emit to conversation room AND each participant's user room (keeps multi-tab & sidebar badges synced)
    emitToConversation(conversation._id.toString(), 'newMessage', formattedPayload);
    for (const participant of conversation.participants) {
      const pid = String(participant);
      emitToUser(pid, 'newMessage', formattedPayload);

      // Persist direct_message notification for offline recipients
      if (pid !== String(currentUserId) && !isUserOnline(pid)) {
        sendNotification({
          recipientId: pid,
          sender: { id: currentUserId, name: senderName, avatarUrl: senderInfo?.avatarUrl || '' },
          type: 'direct_message',
          category: 'social',
          title: conversation.isGroup ? `Tin nhắn mới trong ${conversation.groupName || 'Nhóm đoàn'}` : `Tin nhắn mới từ ${senderName}`,
          message: preview,
          link: '/#messages',
          relatedId: conversation._id.toString(),
        }).catch(() => {});
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Gửi tin nhắn thành công.',
      data: formattedPayload,
    });
  } catch (err) {
    console.error('[Send Message Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể gửi tin nhắn.' });
  }
};

/**
 * PATCH /api/conversations/:id/read
 * Mark all messages from other participants in a conversation as read
 */
export const markConversationAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const { id: conversationId } = req.params;

    if (!currentUserId || !isValidObjectId(currentUserId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ success: false, message: 'Mã cuộc trò chuyện không hợp lệ.' });
    }

    const currentObjId = new mongoose.Types.ObjectId(currentUserId);
    const conversation = await ConversationModel.findOne({
      _id: conversationId,
      participants: currentObjId,
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện.' });
    }

    await MessageModel.updateMany(
      {
        conversation: conversation._id,
        sender: { $ne: currentObjId },
        readBy: { $ne: currentObjId },
      },
      {
        $addToSet: { readBy: currentObjId },
      }
    );

    for (const participant of conversation.participants) {
      const pid = String(participant);
      if (pid !== String(currentUserId)) {
        emitToUser(pid, 'messageRead', {
          conversationId: conversation._id.toString(),
          userId: currentUserId,
        });
      }
    }

    return res.json({
      success: true,
      message: 'Đã đánh dấu cuộc trò chuyện là đã đọc.',
    });
  } catch (err) {
    console.error('[Mark Read Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật trạng thái tin nhắn.' });
  }
};
