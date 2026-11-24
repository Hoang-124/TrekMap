import { Schema, model, Document, Types } from 'mongoose';

export interface ISavedTrail extends Document {
  userId: Types.ObjectId;
  trailId: Types.ObjectId;
  savedOffline: boolean;
  collectionName?: string;
  personalNote?: string;
  plannedMonth?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const savedTrailSchema = new Schema<ISavedTrail>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail', required: true, index: true },
    savedOffline: { type: Boolean, default: false },
    collectionName: { type: String, trim: true, maxlength: 40, default: 'Muốn đi' },
    personalNote: { type: String, trim: true, maxlength: 500, default: '' },
    plannedMonth: { type: Number, min: 1, max: 12, default: null },
  },
  { timestamps: true }
);

savedTrailSchema.index({ userId: 1, trailId: 1 }, { unique: true });

export const SavedTrailModel = model<ISavedTrail>('SavedTrail', savedTrailSchema);
