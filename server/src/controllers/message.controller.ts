import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { ConversationModel } from '../models/Conversation.js';
import { MessageModel } from '../models/Message.js';
import { UserModel } from '../models/User.js';
import { emitToUser } from '../config/socket.js';
import { NotificationModel } from '../models/Notification.js';

/**
 * GET /api/conversations
 * Get list of conversations for current user
 */
export const getConversations = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }

    if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const conversations = await ConversationModel.find({
      participants: currentUserId as any,
      'lastMessage.content': { $exists: true, $ne: '' },
    })
      .sort({ updatedAt: -1 })
      .populate('participants', 'username fullName avatarUrl email role')
      .populate('lastMessage.sender', 'username fullName avatarUrl');

    // Calculate unread count for each conversation
    const result = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await MessageModel.countDocuments({
          conversation: conv._id as any,
          sender: { $ne: currentUserId as any },
          readBy: { $ne: currentUserId as any },
        });

        // Identify other participant
        const otherParticipant = conv.participants.find(
          (p: any) => String(p._id || p) !== String(currentUserId)
        );

        return {
          _id: conv._id,
          participants: conv.participants,
          otherParticipant,
          lastMessage: conv.lastMessage,
          unreadCount,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        };
      })
    );

    return res.json({ success: true, count: result.length, data: result });
  } catch (err: any) {
    console.error('[Get Conversations Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể lấy danh sách cuộc trò chuyện.' });
  }
};

/**
 * POST /api/conversations
 * Create or get existing conversation with targetUserId
 */
export const getOrCreateConversation = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const { targetUserId } = req.body;

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Yêu cầu chỉ định người nhận tin nhắn.' });
    }

    let targetUser = null;

    try {
      targetUser = await UserModel.findById(targetUserId);
    } catch (err) {
      // Not a valid ObjectId, search by email/username/fullName
    }

    if (!targetUser) {
      const cleanTarget = String(targetUserId).trim();
      const exactRegex = new RegExp(`^${cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      const partialRegex = new RegExp(cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      targetUser = await UserModel.findOne({
        $or: [
          { email: exactRegex },
          { username: exactRegex },
          { fullName: exactRegex },
          { fullName: partialRegex },
          { username: partialRegex },
        ],
      });
    }

    // Auto-create user document if author is not in DB yet so chat always opens
    if (!targetUser) {
      const cleanName = String(targetUserId).trim();
      const cleanUsername = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      targetUser = new UserModel({
        username: `${cleanUsername}_${Date.now()}`,
        email: `${cleanUsername}@trekmap.vn`,
        passwordHash: 'dummy-password-hash',
        fullName: cleanName,
        role: 'user',
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=10b981&color=fff`,
      });
      await targetUser.save();
    }

    const actualTargetId = String(targetUser._id);
    const isSelf = actualTargetId === String(currentUserId);

    // Sort IDs to form deterministic composite key (support self-messaging like Telegram Saved Messages)
    const sortedIds = isSelf ? [String(currentUserId)] : [String(currentUserId), actualTargetId].sort();
    const participantKey = isSelf ? `${currentUserId}_self` : sortedIds.join('_');

    let conversation = await ConversationModel.findOne({ participantKey })
      .populate('participants', 'username fullName avatarUrl email role')
      .populate('lastMessage.sender', 'username fullName avatarUrl');

    if (!conversation) {
      const newConv = new ConversationModel({
        participants: sortedIds as any,
        participantKey,
      });
      await newConv.save();

      conversation = await ConversationModel.findById(newConv._id)
        .populate('participants', 'username fullName avatarUrl email role');
    }

    if (!conversation) {
      return res.status(500).json({ success: false, message: 'Lỗi khi khởi tạo cuộc trò chuyện.' });
    }

    const otherParticipant = (conversation.participants as any[]).find(
      (p: any) => String(p._id || p) !== String(currentUserId)
    ) || (conversation.participants as any[])[0];

    const unreadCount = await MessageModel.countDocuments({
      conversation: conversation._id as any,
      sender: { $ne: currentUserId as any },
      readBy: { $ne: currentUserId as any },
    });

    return res.json({
      success: true,
      data: {
        _id: conversation._id,
        participants: conversation.participants,
        otherParticipant,
        lastMessage: conversation.lastMessage,
        unreadCount,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (err: any) {
    console.error('[Get or Create Conversation Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể tạo cuộc trò chuyện.' });
  }
};

/**
 * GET /api/conversations/:id/messages
 * Get paginated messages for a conversation
 */
export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const { id: conversationId } = req.params;
    const { before, limit = 20 } = req.query;

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }

    const conversation = await ConversationModel.findOne({
      _id: conversationId as any,
      participants: currentUserId as any,
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện.' });
    }

    const query: any = { conversation: conversationId };
    if (before) {
      query._id = { $lt: before };
    }

    const parsedLimit = Math.min(Number(limit) || 20, 50);

    const messages = await MessageModel.find(query)
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .populate('sender', 'username fullName avatarUrl');

    // Return in reverse (chronological order)
    const reversedMessages = messages.reverse();

    return res.json({
      success: true,
      count: reversedMessages.length,
      data: reversedMessages,
      hasMore: messages.length === parsedLimit,
    });
  } catch (err: any) {
    console.error('[Get Messages Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể lấy danh sách tin nhắn.' });
  }
};

/**
 * POST /api/messages
 * Send a new message
 */
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const { conversationId, content } = req.body;

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }

    if (!conversationId || !content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống.' });
    }

    let conversation = null;
    try {
      conversation = await ConversationModel.findById(conversationId);
    } catch (err) {}

    if (!conversation) {
      conversation = await ConversationModel.findOne({ participants: currentUserId as any }).sort({ updatedAt: -1 });
      if (!conversation) {
        conversation = new ConversationModel({
          participants: [currentUserId as any],
          participantKey: `${currentUserId}_default_${Date.now()}`,
        });
        await conversation.save();
      }
    }

    let senderUser = null;
    try {
      senderUser = await UserModel.findById(currentUserId);
    } catch (err) {}

    if (!senderUser && req.user?.email) {
      senderUser = await UserModel.findOne({ email: req.user.email });
    }

    if (!senderUser) {
      senderUser = await UserModel.findOne({ username: currentUserId });
    }

    if (!senderUser) {
      senderUser = new UserModel({
        username: `user_${Date.now()}`,
        email: req.user?.email || `user_${Date.now()}@trekmap.vn`,
        passwordHash: 'dummy-password-hash',
        fullName: req.user?.email ? req.user.email.split('@')[0] : 'Thành viên TrekMap',
        role: 'user',
      });
      await senderUser.save();
    }

    const senderId = senderUser._id;

    // Ensure senderId is registered as participant
    const isParticipant = conversation.participants.some(
      (p) => String(p) === String(senderId) || String(p) === String(currentUserId)
    );
    if (!isParticipant) {
      conversation.participants.push(senderId as any);
      await conversation.save();
    }

    // Create and save message
    const message = new MessageModel({
      conversation: conversationId as any,
      sender: senderId as any,
      content: content.trim(),
      readBy: [senderId as any],
    });
    await message.save();

    // Populate sender info
    await message.populate('sender', 'username fullName avatarUrl');

    // Update conversation lastMessage & updatedAt
    conversation.lastMessage = {
      content: content.trim(),
      sender: senderId as any,
      createdAt: new Date(),
    };
    conversation.updatedAt = new Date();
    await conversation.save();

    // Identify recipient(s)
    const recipientId = conversation.participants
      .find((p) => String(p) !== String(currentUserId))
      ?.toString();

    const formattedPayload = {
      _id: message._id,
      conversation: conversationId,
      sender: message.sender,
      content: message.content,
      readBy: message.readBy,
      createdAt: message.createdAt,
    };

    if (recipientId) {
      // Real-time socket emission to recipient room for messages
      emitToUser(recipientId, 'newMessage', formattedPayload);
    }

    return res.status(201).json({
      success: true,
      message: 'Gửi tin nhắn thành công.',
      data: formattedPayload,
    });
  } catch (err: any) {
    console.error('[Send Message Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể gửi tin nhắn.' });
  }
};

/**
 * PATCH /api/conversations/:id/read
 * Mark all messages in a conversation as read
 */
export const markConversationAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const { id: conversationId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }

    const conversation = await ConversationModel.findOne({
      _id: conversationId as any,
      participants: currentUserId as any,
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện.' });
    }

    // Add currentUserId to readBy array for all messages in this conversation where it's not present
    await MessageModel.updateMany(
      {
        conversation: conversationId as any,
        readBy: { $ne: currentUserId as any },
      },
      {
        $addToSet: { readBy: currentUserId as any },
      }
    );

    // Identify recipient/other participant
    const otherParticipantId = conversation.participants
      .find((p) => String(p) !== String(currentUserId))
      ?.toString();

    if (otherParticipantId) {
      emitToUser(otherParticipantId, 'messageRead', {
        conversationId,
        userId: currentUserId,
      });
    }

    return res.json({
      success: true,
      message: 'Đã đánh dấu cuộc trò chuyện là đã đọc.',
    });
  } catch (err: any) {
    console.error('[Mark Read Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật trạng thái tin nhắn.' });
  }
};
