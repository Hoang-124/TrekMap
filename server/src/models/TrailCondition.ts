import { Schema, model, Document } from 'mongoose';

export interface ITrailCondition extends Document {
  userId: Schema.Types.ObjectId;
  trailId: Schema.Types.ObjectId;
  condition: 'safe' | 'caution' | 'dangerous' | 'closed';
  description: string;
  section?: string;
  photos?: string[];
  weatherNote?: string;
  upvotes: number;
  upvotedUsers: Schema.Types.ObjectId[];
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const trailConditionSchema = new Schema<ITrailCondition>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail', required: true, index: true },
    condition: { type: String, enum: ['safe', 'caution', 'dangerous', 'closed'], required: true },
    description: { type: String, required: true },
    section: { type: String, default: 'Toàn tuyến' },
    photos: [{ type: String }],
    weatherNote: { type: String, default: '' },
    upvotes: { type: Number, default: 0 },
    upvotedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    expiresAt: { type: Date, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

trailConditionSchema.index({ trailId: 1, isActive: 1, createdAt: -1 });

export const TrailConditionModel = model<ITrailCondition>('TrailCondition', trailConditionSchema);
