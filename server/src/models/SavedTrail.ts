import { Schema, model, Document } from 'mongoose';

export interface ISavedTrail extends Document {
  userId: Schema.Types.ObjectId;
  trailId: Schema.Types.ObjectId;
  savedOffline: boolean;
  createdAt: Date;
}

const savedTrailSchema = new Schema<ISavedTrail>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail', required: true, index: true },
    savedOffline: { type: Boolean, default: false },
  },
  { timestamps: true }
);

savedTrailSchema.index({ userId: 1, trailId: 1 }, { unique: true });

export const SavedTrailModel = model<ISavedTrail>('SavedTrail', savedTrailSchema);
