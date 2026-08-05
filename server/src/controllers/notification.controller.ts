import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { NotificationModel } from '../models/Notification.js';

/**
 * GET /api/notifications
 * Get paginated list of notifications for current user
 */
export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const { page = 1, limit = 20 } = req.query;

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 50);

    const baseQuery: any = {
      recipient: currentUserId,
      type: { $nin: ['new_message', 'message'] },
    };

    const total = await NotificationModel.countDocuments(baseQuery);
    const notifications = await NotificationModel.find(baseQuery)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const unreadCount = await NotificationModel.countDocuments({
      ...baseQuery,
      isRead: false,
    });

    return res.json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    console.error('[Get Notifications Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể lấy danh sách thông báo.' });
  }
};

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications for badge display
 */
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }

    const count = await NotificationModel.countDocuments({
      recipient: currentUserId,
      type: { $nin: ['new_message', 'message'] },
      isRead: false,
    } as any);

    return res.json({ success: true, count });
  } catch (err: any) {
    console.error('[Get Unread Count Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể đếm số thông báo chưa đọc.' });
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
export const markNotificationAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const { id } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }

    const notification = await NotificationModel.findOneAndUpdate(
      { _id: id as any, recipient: currentUserId as any },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo.' });
    }

    return res.json({ success: true, message: 'Đã đánh dấu thông báo là đã đọc.', data: notification });
  } catch (err: any) {
    console.error('[Mark Notification Read Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật thông báo.' });
  }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for current user
 */
export const markAllNotificationsAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }

    await NotificationModel.updateMany(
      { recipient: currentUserId as any, isRead: false },
      { isRead: true }
    );

    return res.json({ success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc.' });
  } catch (err: any) {
    console.error('[Mark All Read Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật thông báo.' });
  }
};
