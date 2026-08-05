import { Schema, model, Document } from 'mongoose';

export interface IGuide extends Document {
  name: string;
  phone: string;
  avatarUrl?: string;
  region: string;
  provinces: string[];
  priceNote: string;
  verified: boolean;
  rating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const guideSchema = new Schema<IGuide>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    avatarUrl: { type: String },
    region: { type: String, required: true },
    provinces: [{ type: String }],
    priceNote: { type: String, required: true },
    verified: { type: Boolean, default: true },
    rating: { type: Number, default: 5.0 },
    reviewCount: { type: Number, default: 10 },
  },
  { timestamps: true }
);

export const GuideModel = model<IGuide>('Guide', guideSchema);
