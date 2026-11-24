import { Schema, model, Document, Types } from 'mongoose';

export interface IActivity extends Document {
  userId: Types.ObjectId;
  type:
    | 'new_trip_report'
    | 'new_contribution'
    | 'joined_trip'
    | 'completed_trip'
    | 'new_review'
    | 'earned_badge'
    | 'new_trip_plan'
    | 'followed_user';
  title: string;
  targetType: 'trip_report' | 'trail' | 'trip_plan' | 'badge' | 'user';
  targetId?: string;
  thumbnailUrl?: string;
  isPublic?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'new_trip_report',
        'new_contribution',
        'joined_trip',
        'completed_trip',
        'new_review',
        'earned_badge',
        'new_trip_plan',
        'followed_user',
      ],
      required: true,
    },
    title: { type: String, required: true },
    targetType: {
      type: String,
      enum: ['trip_report', 'trail', 'trip_plan', 'badge', 'user'],
      required: true,
    },
    targetId: { type: String },
    thumbnailUrl: { type: String },
    isPublic: { type: Boolean, default: true },
  },
  { timestamps: true }
);

activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ createdAt: -1 });
activitySchema.index({ isPublic: 1, createdAt: -1 });

export const ActivityModel = model<IActivity>('Activity', activitySchema);
