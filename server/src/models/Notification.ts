import { Schema, model, Document } from 'mongoose';

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

export interface INotification extends Document {
  recipient: Schema.Types.ObjectId | string;
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
      index: true,
    },
    sender: {
      id: { type: String, default: '' },
      name: { type: String, default: 'Ban Quản Trị TrekMap' },
      avatarUrl: { type: String, default: '' },
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['safety', 'moderation', 'social', 'system'],
      default: 'system',
      index: true,
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
      index: true,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, category: 1, isRead: 1 });

export const NotificationModel = model<INotification>('Notification', notificationSchema);
