import { Schema, model, Document } from 'mongoose';

export interface IActivity extends Document {
  userId: Schema.Types.ObjectId;
  type: 'new_trip_report' | 'new_contribution' | 'joined_trip' | 'completed_trip' | 'new_review' | 'earned_badge' | 'new_trip_plan' | 'followed_user';
  title: string;
  targetType: 'trip_report' | 'trail' | 'trip_plan' | 'badge' | 'user';
  targetId?: string;
  thumbnailUrl?: string;
  createdAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['new_trip_report', 'new_contribution', 'joined_trip', 'completed_trip', 'new_review', 'earned_badge', 'new_trip_plan', 'followed_user'],
      required: true,
    },
    title: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String },
    thumbnailUrl: { type: String },
  },
  { timestamps: true }
);

activitySchema.index({ userId: 1, createdAt: -1 });

export const ActivityModel = model<IActivity>('Activity', activitySchema);
