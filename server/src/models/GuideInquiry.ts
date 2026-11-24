import { Schema, model, Document, Types } from 'mongoose';

export type GuideInquiryStatus = 'pending' | 'contacted' | 'confirmed' | 'cancelled';

export interface IGuideInquiry extends Document {
  userId: Types.ObjectId;
  guideId: Types.ObjectId;
  trailId?: Types.ObjectId;
  trailSlug?: string;
  trailName: string;
  plannedStartDate: Date;
  durationDays: number;
  groupSize: number;
  needPortersCount: number;
  contactPhone: string;
  notes: string;
  estimatedTotalVnd: number;
  status: GuideInquiryStatus;
  createdAt: Date;
  updatedAt: Date;
}

const guideInquirySchema = new Schema<IGuideInquiry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    guideId: { type: Schema.Types.ObjectId, ref: 'Guide', required: true, index: true },
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail' },
    trailSlug: { type: String, trim: true, default: '' },
    trailName: { type: String, required: true, trim: true, maxlength: 180 },
    plannedStartDate: { type: Date, required: true },
    durationDays: { type: Number, required: true, min: 1, max: 30 },
    groupSize: { type: Number, required: true, min: 1, max: 50 },
    needPortersCount: { type: Number, default: 0, min: 0, max: 30 },
    contactPhone: { type: String, required: true, trim: true, maxlength: 30 },
    notes: { type: String, trim: true, maxlength: 800, default: '' },
    estimatedTotalVnd: { type: Number, required: true, min: 0, max: 500_000_000 },
    status: {
      type: String,
      enum: ['pending', 'contacted', 'confirmed', 'cancelled'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

guideInquirySchema.index({ userId: 1, createdAt: -1 });
guideInquirySchema.index({ guideId: 1, status: 1, createdAt: -1 });

export const GuideInquiryModel = model<IGuideInquiry>('GuideInquiry', guideInquirySchema);
