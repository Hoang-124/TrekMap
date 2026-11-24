import { Schema, model, Document, Types } from 'mongoose';

export interface IGuideReview {
  userId: Types.ObjectId;
  userName: string;
  rating: number;
  comment: string;
  verifiedTrip: boolean;
  createdAt: Date;
}

export type GuideRoleType = 'guide' | 'porter' | 'operator';

export interface IGuide extends Document {
  slug?: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  roleType: GuideRoleType;
  region: string;
  provinces: string[];
  trailSlugs: string[];
  priceNote: string;
  basePricePerDayVnd: number;
  maxGroupSize: number;
  specialties: string[];
  languages: string[];
  certifications: string[];
  experienceYears: number;
  availableDates: string[];
  bio?: string;
  zaloOrContactUrl?: string;
  verified: boolean;
  isActive: boolean;
  rating: number;
  reviewCount: number;
  reviews: IGuideReview[];
  createdAt: Date;
  updatedAt: Date;
}

const guideSchema = new Schema<IGuide>(
  {
    slug: { type: String, trim: true, unique: true, sparse: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: '' },
    roleType: { type: String, enum: ['guide', 'porter', 'operator'], default: 'guide', index: true },
    region: { type: String, required: true },
    provinces: [{ type: String }],
    trailSlugs: { type: [String], default: [], index: true },
    priceNote: { type: String, required: true },
    basePricePerDayVnd: { type: Number, default: 700_000, min: 0, max: 50_000_000 },
    maxGroupSize: { type: Number, default: 12, min: 1, max: 100 },
    specialties: { type: [String], default: ['Dẫn đoàn thực địa', 'Hỗ trợ hậu cần & lán trại'] },
    languages: { type: [String], default: ['Tiếng Việt'] },
    certifications: { type: [String], default: [] },
    experienceYears: { type: Number, default: 5, min: 0, max: 50 },
    availableDates: { type: [String], default: [] },
    bio: { type: String, trim: true, maxlength: 1000, default: '' },
    zaloOrContactUrl: { type: String, trim: true, default: '' },
    verified: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true, index: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    reviews: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        userName: { type: String, required: true, trim: true },
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String, required: true, trim: true, maxlength: 800 },
        verifiedTrip: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

guideSchema.index({ region: 1, verified: 1, rating: -1 });
guideSchema.index({ provinces: 1 });
guideSchema.index({ isActive: 1, roleType: 1, rating: -1 });

export const GuideModel = model<IGuide>('Guide', guideSchema);
