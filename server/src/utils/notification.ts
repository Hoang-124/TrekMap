import { Types } from 'mongoose';
import { NotificationModel, NotificationType, NotificationCategory } from '../models/Notification.js';
import { UserModel } from '../models/User.js';
import { emitToUser, broadcastEvent } from '../config/socket.js';

export interface SendNotificationParams {
  recipientId: string | Types.ObjectId;
  sender?: {
    id?: string;
    name?: string;
    avatarUrl?: string;
  };
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  link?: string;
  relatedId?: any;
}

export const sendNotification = async (params: SendNotificationParams) => {
  try {
    const recipientStr = String(params.recipientId);

    const doc: any = await NotificationModel.create({
      recipient: recipientStr,
      sender: params.sender || {
        id: 'system',
        name: 'Ban Quản Trị TrekMap',
        avatarUrl: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329093/trekmap/avatars/avatar_user_1.jpg',
      },
      type: params.type,
      category: params.category || 'system',
      title: params.title,
      message: params.message,
      link: params.link || '/',
      relatedId: params.relatedId,
      isRead: false,
    } as any);

    const payload = doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;

    // 1. Emit to target user's private socket room
    emitToUser(recipientStr, 'newNotification', payload);

    // 2. If safety emergency, broadcast to all connected trekkers
    if (params.category === 'safety') {
      broadcastEvent('newSafetyAlert', payload);
    }

    return doc;
  } catch (err) {
    console.error('❌ [Send Notification Error]:', err);
    return null;
  }
};

export const notifyAdmins = async (params: Omit<SendNotificationParams, 'recipientId' | 'category'>) => {
  try {
    const admins = await UserModel.find({ role: 'admin' }).select('_id email').lean().exec();
    for (const admin of admins) {
      await sendNotification({
        ...params,
        recipientId: admin._id.toString(),
        category: 'moderation',
      });
    }
  } catch (err) {
    console.error('❌ [Notify Admins Error]:', err);
  }
};
