import { Schema, model, Document, Types } from 'mongoose';

export interface IGearPackItem {
  id: string;
  name: string;
  category: string;
  weightGrams: number;
  quantity: number;
  worn: boolean;
  consumable: boolean;
  packed: boolean;
}

export interface IGearPack extends Document {
  userId: Types.ObjectId;
  shareSlug: string;
  name: string;
  trailSlug?: string;
  bodyWeightKg: number;
  items: IGearPackItem[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const gearPackItemSchema = new Schema<IGearPackItem>(
  {
    id: { type: String, required: true, trim: true, maxlength: 60 },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    category: { type: String, trim: true, maxlength: 60, default: 'Khác' },
    weightGrams: { type: Number, required: true, min: 0, max: 50000 },
    quantity: { type: Number, default: 1, min: 1, max: 99 },
    worn: { type: Boolean, default: false },
    consumable: { type: Boolean, default: false },
    packed: { type: Boolean, default: true },
  },
  { _id: false }
);

const gearPackSchema = new Schema<IGearPack>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    shareSlug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 64 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    trailSlug: { type: String, trim: true, maxlength: 80, default: '' },
    bodyWeightKg: { type: Number, default: 65, min: 25, max: 200 },
    items: {
      type: [gearPackItemSchema],
      default: [],
      validate: {
        validator: (arr: IGearPackItem[]) => Array.isArray(arr) && arr.length <= 120,
        message: 'Mỗi danh sách balo tối đa 120 vật dụng.',
      },
    },
    isPublic: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

gearPackSchema.index({ userId: 1, updatedAt: -1 });

export const GearPackModel = model<IGearPack>('GearPack', gearPackSchema);
