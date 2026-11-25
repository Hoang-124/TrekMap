import { Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { NotificationModel, NotificationCategory } from '../models/Notification.js';
import { UserModel } from '../models/User.js';
import { isValidObjectId } from '../utils/resolveTrail.js';

const VALID_CATEGORIES = new Set<string>(['safety', 'moderation', 'social', 'system']);

const getRecipientQuery = (userId: string) => {
  if (isValidObjectId(userId)) {
    return {
      $or: [{ recipient: userId }, { recipient: new Types.ObjectId(userId) }],
    };
  }
  return { recipient: String(userId) };
};

// GET /api/notifications - Get user notifications with consolidated unread breakdown aggregation
export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để xem thông báo.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        data: [],
        totalCount: 0,
        unreadCount: 0,
        categoryCounts: { all: 0, safety: 0, moderation: 0, social: 0, system: 0 },
      });
    }

    const { category, limit = '50', page = '1' } = req.query;
    const recipientFilter = getRecipientQuery(userId);

    const filter: any = { ...recipientFilter };
    if (typeof category === 'string' && VALID_CATEGORIES.has(category)) {
      filter.category = category as NotificationCategory;
    }

    const pageSize = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);
    const pageNum = Math.min(Math.max(parseInt(String(page), 10) || 1, 1), 1000);
    const skip = (pageNum - 1) * pageSize;

    const [notifications, totalCount, unreadByCategory] = await Promise.all([
      NotificationModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()
        .exec(),
      NotificationModel.countDocuments(filter),
      NotificationModel.aggregate([
        { $match: { ...recipientFilter, isRead: false } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
    ]);

    const categoryMap: Record<string, number> = {
      safety: 0,
      moderation: 0,
      social: 0,
      system: 0,
    };
    let unreadCount = 0;
    for (const row of unreadByCategory) {
      if (row._id && row._id in categoryMap) {
        categoryMap[row._id] = row.count;
      }
      unreadCount += row.count;
    }

    const userSenderIds = (notifications || [])
      .map((n: any) => n.sender?.id)
      .filter((id: any) => id && id !== 'system' && isValidObjectId(id));

    if (userSenderIds.length > 0) {
      try {
        const senders = await UserModel.find({ _id: { $in: userSenderIds } })
          .select('fullName username avatarUrl')
          .lean();
        const senderMap = new Map();
        senders.forEach((s: any) => senderMap.set(s._id.toString(), s));
        notifications.forEach((n: any) => {
          if (n.sender?.id && senderMap.has(n.sender.id)) {
            const live = senderMap.get(n.sender.id);
            if (!n.sender) n.sender = {};
            n.sender.name = live.fullName || n.sender.name;
            if (live.avatarUrl) n.sender.avatarUrl = live.avatarUrl;
          }
        });
      } catch {
        // Ignore enrichment errors
      }
    }

    return res.json({
      success: true,
      data: notifications,
      totalCount,
      unreadCount,
      categoryCounts: {
        all: unreadCount,
        safety: categoryMap.safety,
        moderation: categoryMap.moderation,
        social: categoryMap.social,
        system: categoryMap.system,
      },
    });
  } catch (err) {
    console.error('[Get Notifications Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách thông báo.' });
  }
};

// PUT /api/notifications/:id/read - Mark single notification as read
export const markNotificationRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã thông báo không hợp lệ.' });
    }

    const recipientFilter = getRecipientQuery(userId);
    const updated = await NotificationModel.findOneAndUpdate(
      { _id: id, ...recipientFilter } as any,
      { $set: { isRead: true } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo.' });
    }

    const unreadCount = await NotificationModel.countDocuments({ ...recipientFilter, isRead: false } as any);
    return res.json({ success: true, message: 'Đã đánh dấu đã đọc.', unreadCount, data: updated });
  } catch (err) {
    console.error('[Mark Notification Read Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật thông báo.' });
  }
};

// PUT /api/notifications/read-all - Mark all notifications as read (optionally by category)
export const markAllNotificationsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const { category } = req.body || {};
    const recipientFilter = getRecipientQuery(userId);

    const filter: any = { ...recipientFilter, isRead: false };
    if (typeof category === 'string' && VALID_CATEGORIES.has(category)) {
      filter.category = category;
    }

    await NotificationModel.updateMany(filter, { $set: { isRead: true } });
    const unreadCount = await NotificationModel.countDocuments({ ...recipientFilter, isRead: false } as any);

    return res.json({ success: true, message: 'Đã đánh dấu tất cả là đã đọc.', unreadCount });
  } catch (err) {
    console.error('[Mark All Read Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật thông báo.' });
  }
};

// DELETE /api/notifications/:id - Delete single notification
export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Mã thông báo không hợp lệ.' });
    }

    const recipientFilter = getRecipientQuery(userId);
    const deleted = await NotificationModel.findOneAndDelete({ _id: id, ...recipientFilter } as any);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo.' });
    }

    const unreadCount = await NotificationModel.countDocuments({ ...recipientFilter, isRead: false } as any);
    return res.json({ success: true, message: 'Đã xóa thông báo.', unreadCount });
  } catch (err) {
    console.error('[Delete Notification Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa thông báo.' });
  }
};

// DELETE /api/notifications - Clear all read notifications
export const clearReadNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const recipientFilter = getRecipientQuery(userId);
    await NotificationModel.deleteMany({ ...recipientFilter, isRead: true } as any);

    return res.json({ success: true, message: 'Đã xóa các thông báo đã đọc.' });
  } catch (err) {
    console.error('[Clear Read Notifications Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa thông báo.' });
  }
};
