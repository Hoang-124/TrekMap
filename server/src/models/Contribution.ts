import mongoose, { Schema, Document } from 'mongoose';

export interface IContribution extends Document {
  id: string;
  name: string;
  region: string;
  province: string;
  district: string;
  hamlet?: string;
  distanceKm: number;
  elevationGainM: number;
  maxAltitudeM: number;
  difficultyLevel: number;
  durationHoursNote: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  description: string;
  transportationInfo?: string;
  coverImage?: string;
  permitRequired: boolean;
  permitInfo?: string;
  hasCampsite: boolean;
  hasWaterSource: boolean;
  kidFriendly: boolean;
  authorEmail?: string;
  authorName?: string;
  authorAvatar?: string;
  userId?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

const ContributionSchema = new Schema<IContribution>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    region: { type: String, required: true },
    province: { type: String, required: true },
    district: { type: String, required: true },
    hamlet: { type: String, default: '' },
    distanceKm: { type: Number, required: true },
    elevationGainM: { type: Number, required: true },
    maxAltitudeM: { type: Number, required: true },
    difficultyLevel: { type: Number, required: true },
    durationHoursNote: { type: String, required: true },
    startLat: { type: Number, required: true },
    startLng: { type: Number, required: true },
    endLat: { type: Number, required: true },
    endLng: { type: Number, required: true },
    description: { type: String, required: true },
    transportationInfo: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    permitRequired: { type: Boolean, default: false },
    permitInfo: { type: String, default: '' },
    hasCampsite: { type: Boolean, default: false },
    hasWaterSource: { type: Boolean, default: false },
    kidFriendly: { type: Boolean, default: false },
    authorEmail: { type: String, default: '' },
    authorName: { type: String, default: '' },
    authorAvatar: { type: String, default: '' },
    userId: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    createdAt: { type: String, default: () => new Date().toLocaleDateString('vi-VN') },
  },
  { timestamps: true }
);

ContributionSchema.index({ status: 1, createdAt: -1 });
ContributionSchema.index({ userId: 1 });
ContributionSchema.index({ authorEmail: 1 });

export const Contribution = mongoose.model<IContribution>('Contribution', ContributionSchema);
