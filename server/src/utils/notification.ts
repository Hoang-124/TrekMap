import mongoose, { Types } from 'mongoose';
import { NotificationModel, NotificationType, NotificationCategory } from '../models/Notification.js';
import { UserModel } from '../models/User.js';
import { emitToUser } from '../config/socket.js';

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
    if (mongoose.connection.readyState !== 1) return null;
    const recipientStr = String(params.recipientId);

    const doc: any = await NotificationModel.create({
      recipient: recipientStr,
      sender: params.sender || {
        id: 'system',
        name: 'Ban Quản Trị LOST',
        avatarUrl: '/covers/avatar-default.svg',
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

    // Security: Emit strictly to the intended recipient's private socket room (prevents recipient PII leak & duplicate alerts)
    emitToUser(recipientStr, 'newNotification', payload);

    return doc;
  } catch (err) {
    console.error('[Send Notification Error]:', err);
    return null;
  }
};

export const notifyAdmins = async (
  params: Omit<SendNotificationParams, 'recipientId' | 'category'> & {
    category?: NotificationCategory;
    includeModerators?: boolean;
  }
) => {
  try {
    if (mongoose.connection.readyState !== 1) return;
    const roles: Array<'admin' | 'moderator'> = params.includeModerators ? ['admin', 'moderator'] : ['admin'];
    const admins = await UserModel.find({
      role: { $in: roles },
      isBanned: { $ne: true },
    })
      .select('_id')
      .lean()
      .exec();

    const targetCategory: NotificationCategory =
      params.category || (params.type === 'safety_alert' ? 'safety' : 'moderation');

    await Promise.all(
      admins.map((admin) =>
        sendNotification({
          sender: params.sender,
          type: params.type,
          title: params.title,
          message: params.message,
          link: params.link,
          relatedId: params.relatedId,
          recipientId: admin._id.toString(),
          category: targetCategory,
        })
      )
    );
  } catch (err) {
    console.error('[Notify Admins Error]:', err);
  }
};
