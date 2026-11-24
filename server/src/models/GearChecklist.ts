import { Schema, model, Document, Types } from 'mongoose';

export interface IGearChecklistItem {
  id: string;
  name: string;
  category: string;
  recommendedQty: number;
  weightGrams: number;
  isEssential: boolean;
  checked: boolean;
  reason?: string;
}

export interface IGearChecklist extends Document {
  userId?: Types.ObjectId;
  trailId: Types.ObjectId;
  trailSlug?: string;
  title: string;
  bodyWeightKg: number;
  items: IGearChecklistItem[];
  createdForDays: number;
  createdAt: Date;
  updatedAt: Date;
}

const gearChecklistSchema = new Schema<IGearChecklist>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail', required: true, index: true },
    trailSlug: { type: String, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    bodyWeightKg: { type: Number, default: 65, min: 30, max: 200 },
    items: [
      {
        id: { type: String, default: '' },
        name: { type: String, required: true },
        category: { type: String, required: true },
        recommendedQty: { type: Number, default: 1, min: 1 },
        weightGrams: { type: Number, default: 200, min: 0 },
        isEssential: { type: Boolean, default: true },
        checked: { type: Boolean, default: true },
        reason: { type: String, default: '' },
      },
    ],
    createdForDays: { type: Number, default: 2, min: 1 },
  },
  { timestamps: true }
);

// Use partialFilterExpression instead of sparse so anonymous templates (without userId) do not collide on (null, trailId)
gearChecklistSchema.index(
  { userId: 1, trailId: 1 },
  { unique: true, partialFilterExpression: { userId: { $exists: true } } }
);

export const GearChecklistModel = model<IGearChecklist>('GearChecklist', gearChecklistSchema);
