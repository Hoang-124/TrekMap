import { Schema, model, Document, Types } from 'mongoose';

export interface ITrailCondition extends Document {
  userId: Types.ObjectId;
  trailId: Types.ObjectId | string;
  condition: 'safe' | 'caution' | 'dangerous' | 'closed';
  description: string;
  section?: string;
  photos?: string[];
  weatherNote?: string;
  upvotes: number;
  upvotedUsers: Types.ObjectId[];
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const trailConditionSchema = new Schema<ITrailCondition>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trailId: { type: Schema.Types.Mixed, required: true },
    condition: { type: String, enum: ['safe', 'caution', 'dangerous', 'closed'], required: true },
    description: { type: String, required: true },
    section: { type: String, default: 'Toàn tuyến' },
    photos: [{ type: String }],
    weatherNote: { type: String, default: '' },
    upvotes: { type: Number, default: 0, min: 0 },
    upvotedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

trailConditionSchema.index({ trailId: 1, isActive: 1, createdAt: -1 });
// Automatic TTL deletion once condition report expires
trailConditionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TrailConditionModel = model<ITrailCondition>('TrailCondition', trailConditionSchema);
