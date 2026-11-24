import mongoose, { Schema, Document } from 'mongoose';

export interface IContribution extends Document {
  id: string;
  name: string;
  altNames?: string[];
  region: 'Miền Bắc' | 'Miền Trung' | 'Miền Nam';
  province: string;
  district: string;
  hamlet?: string;
  distanceKm: number;
  elevationGainM: number;
  maxAltitudeM: number;
  difficultyLevel: number;
  difficultyNote?: string;
  durationDays?: number;
  durationHoursNote: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  description: string;
  transportationInfo?: string;
  coverImage?: string;
  galleryImages?: string[];
  permitRequired: boolean;
  permitInfo?: string;
  hasCampsite: boolean;
  hasWaterSource: boolean;
  kidFriendly: boolean;
  rescueContact?: {
    name: string;
    phone: string;
    rangerContact: string;
  };
  waypoints?: Array<{
    id: string;
    name: string;
    type: 'campsite' | 'water' | 'viewpoint' | 'danger' | 'charging' | 'rest';
    description: string;
    elevationM?: number;
    lat: number;
    lng: number;
  }>;
  authorEmail?: string;
  authorName?: string;
  authorAvatar?: string;
  userId?: string;
  gpxTrack?: [number, number][];
  bestMonths?: number[];
  avoidMonths?: number[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
  rating?: number;
  reviewCount?: number;
}

const ContributionSchema = new Schema<IContribution>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    altNames: [{ type: String }],
    region: { type: String, enum: ['Miền Bắc', 'Miền Trung', 'Miền Nam'], required: true },
    province: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    hamlet: { type: String, default: '' },
    distanceKm: { type: Number, required: true, min: 0.1 },
    elevationGainM: { type: Number, required: true, min: 0 },
    maxAltitudeM: { type: Number, required: true, min: 0 },
    difficultyLevel: { type: Number, required: true, min: 1, max: 5 },
    difficultyNote: { type: String, default: '' },
    durationDays: { type: Number, default: 1, min: 1 },
    durationHoursNote: { type: String, required: true },
    startLat: { type: Number, required: true, min: -90, max: 90 },
    startLng: { type: Number, required: true, min: -180, max: 180 },
    endLat: { type: Number, required: true, min: -90, max: 90 },
    endLng: { type: Number, required: true, min: -180, max: 180 },
    description: { type: String, required: true },
    transportationInfo: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    galleryImages: [{ type: String }],
    permitRequired: { type: Boolean, default: false },
    permitInfo: { type: String, default: '' },
    hasCampsite: { type: Boolean, default: false },
    hasWaterSource: { type: Boolean, default: false },
    kidFriendly: { type: Boolean, default: false },
    rescueContact: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      rangerContact: { type: String, default: '' },
    },
    waypoints: [
      {
        id: String,
        name: String,
        type: {
          type: String,
          enum: ['campsite', 'water', 'viewpoint', 'danger', 'charging', 'rest'],
          default: 'viewpoint',
        },
        description: String,
        elevationM: Number,
        lat: { type: Number, min: -90, max: 90 },
        lng: { type: Number, min: -180, max: 180 },
      },
    ],
    authorEmail: { type: String, default: '' },
    authorName: { type: String, default: '' },
    authorAvatar: { type: String, default: '' },
    userId: { type: String, default: '' },
    gpxTrack: { type: [[Number]], default: [] },
    bestMonths: { type: [Number], default: [] },
    avoidMonths: { type: [Number], default: [] },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

ContributionSchema.index({ status: 1, createdAt: -1 });
ContributionSchema.index({ userId: 1 });
ContributionSchema.index({ authorEmail: 1 });

export const Contribution = mongoose.model<IContribution>('Contribution', ContributionSchema);
export const ContributionModel = Contribution;
