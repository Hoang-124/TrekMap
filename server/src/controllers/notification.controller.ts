import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { NotificationModel } from '../models/Notification';

// GET /api/notifications - Get user notifications
export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập.' });
    }

    const notifications = await NotificationModel.find({ userId }).sort({ createdAt: -1 }).limit(20);

    const unreadCount = await NotificationModel.countDocuments({ userId, isRead: false });

    return res.json({ success: true, data: notifications, unreadCount });
  } catch (err) {
    console.error('[Get Notifications Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải thông báo.' });
  }
};

// PUT /api/notifications/read-all - Mark all notifications as read
export const markAllNotificationsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập.' });
    }

    await NotificationModel.updateMany({ userId, isRead: false }, { isRead: true });

    return res.json({ success: true, message: 'Đã đánh dấu tất cả là đã đọc.' });
  } catch (err) {
    console.error('[Mark All Read Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật thông báo.' });
  }
};
