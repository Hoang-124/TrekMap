import { Schema, model, Document } from 'mongoose';

export interface IGearChecklist extends Document {
  trailId: Schema.Types.ObjectId;
  title: string;
  items: Array<{ name: string; category: string; recommendedQty: number; isEssential: boolean }>;
  createdForDays: number;
}

const gearChecklistSchema = new Schema<IGearChecklist>(
  {
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail', required: true },
    title: { type: String, required: true },
    items: [
      {
        name: { type: String, required: true },
        category: { type: String, required: true },
        recommendedQty: { type: Number, default: 1 },
        isEssential: { type: Boolean, default: true },
      },
    ],
    createdForDays: { type: Number, default: 2 },
  },
  { timestamps: true }
);

export const GearChecklistModel = model<IGearChecklist>('GearChecklist', gearChecklistSchema);
