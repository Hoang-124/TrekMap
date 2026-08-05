import { Schema, model, Document } from 'mongoose';

export type NotificationType =
  | 'new_contribution_pending'
  | 'contribution_approved'
  | 'contribution_rejected'
  | 'new_message'
  | 'comment'
  | 'reaction'
  | 'system'
  | 'weather_alert';

export interface INotification extends Document {
  recipient: Schema.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  relatedId?: Schema.Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
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

export const NotificationModel = model<INotification>('Notification', notificationSchema);
