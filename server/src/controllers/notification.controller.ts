import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { NotificationModel, NotificationCategory } from '../models/Notification.js';

// Helper to build recipient matching query
const getRecipientQuery = (userId: string) => {
  const isMongoId = Types.ObjectId.isValid(userId);
  if (isMongoId) {
    return {
      $or: [
        { recipient: userId },
        { recipient: new Types.ObjectId(userId) },
        { recipient: String(userId) },
      ],
    };
  }
  return {
    $or: [{ recipient: userId }, { recipient: String(userId) }],
  };
};

// GET /api/notifications - Get user notifications with optional category filtering & breakdown counts
export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để xem thông báo.' });
    }

    const { category, limit = '50', page = '1' } = req.query;
    const recipientFilter = getRecipientQuery(userId);

    const filter: any = { ...recipientFilter };
    if (category && category !== 'all') {
      filter.category = category as NotificationCategory;
    }

    const pageSize = Math.min(Math.max(parseInt(limit as string, 10) || 20, 1), 100);
    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const skip = (pageNum - 1) * pageSize;

    const [notifications, totalCount, unreadCount, safetyCount, moderationCount, socialCount, systemCount] =
      await Promise.all([
        NotificationModel.find(filter as any)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .lean()
          .exec(),
        NotificationModel.countDocuments(filter as any),
        NotificationModel.countDocuments({ ...recipientFilter, isRead: false } as any),
        NotificationModel.countDocuments({ ...recipientFilter, category: 'safety', isRead: false } as any),
        NotificationModel.countDocuments({ ...recipientFilter, category: 'moderation', isRead: false } as any),
        NotificationModel.countDocuments({ ...recipientFilter, category: 'social', isRead: false } as any),
        NotificationModel.countDocuments({ ...recipientFilter, category: 'system', isRead: false } as any),
      ]);

    return res.json({
      success: true,
      data: notifications,
      totalCount,
      unreadCount,
      categoryCounts: {
        all: unreadCount,
        safety: safetyCount,
        moderation: moderationCount,
        social: socialCount,
        system: systemCount,
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

    const { id } = req.params;
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

    const { category } = req.body || {};
    const recipientFilter = getRecipientQuery(userId);

    const filter: any = { ...recipientFilter, isRead: false };
    if (category && category !== 'all') {
      filter.category = category;
    }

    await NotificationModel.updateMany(filter as any, { $set: { isRead: true } });

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

    const { id } = req.params;
    const recipientFilter = getRecipientQuery(userId);

    await NotificationModel.findOneAndDelete({ _id: id, ...recipientFilter } as any);

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

    const recipientFilter = getRecipientQuery(userId);
    await NotificationModel.deleteMany({ ...recipientFilter, isRead: true } as any);

    return res.json({ success: true, message: 'Đã xóa các thông báo đã đọc.' });
  } catch (err) {
    console.error('[Clear Read Notifications Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa thông báo.' });
  }
};

