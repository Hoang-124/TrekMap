import { Schema, model, Document, Types } from 'mongoose';

export type NotificationCategory = 'safety' | 'moderation' | 'social' | 'system';

export type NotificationType =
  | 'safety_alert'
  | 'dispute_alert'
  | 'contribution_pending'
  | 'contribution_approved'
  | 'contribution_rejected'
  | 'community_comment'
  | 'community_reply'
  | 'direct_message'
  | 'badge_earned'
  | 'account_security'
  | 'system';

const NOTIFICATION_TYPES: NotificationType[] = [
  'safety_alert',
  'dispute_alert',
  'contribution_pending',
  'contribution_approved',
  'contribution_rejected',
  'community_comment',
  'community_reply',
  'direct_message',
  'badge_earned',
  'account_security',
  'system',
];

export interface INotification extends Document {
  recipient: Types.ObjectId | string;
  sender?: {
    id?: string;
    name?: string;
    avatarUrl?: string;
  };
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  link: string;
  relatedId?: Schema.Types.Mixed;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.Mixed,
      required: true,
    },
    sender: {
      id: { type: String, default: '' },
      name: { type: String, default: 'Ban Quản Trị LOST' },
      avatarUrl: { type: String, default: '' },
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    category: {
      type: String,
      enum: ['safety', 'moderation', 'social', 'system'],
      default: 'system',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    link: {
      type: String,
      default: '/',
    },
    relatedId: {
      type: Schema.Types.Mixed,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, category: 1, isRead: 1 });
notificationSchema.index({ 'sender.id': 1 });
// Automatically purge read notifications older than 90 days
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 86400 * 90, partialFilterExpression: { isRead: true } }
);

export const NotificationModel = model<INotification>('Notification', notificationSchema);
