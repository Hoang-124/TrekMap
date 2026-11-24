import { Schema, model, Document } from 'mongoose';

export type RangerAuthorityType = 'national_park' | 'ranger_station' | 'border_guard' | 'rescue_center';

export interface IRangerStation extends Document {
  slug: string;
  name: string;
  authorityType: RangerAuthorityType;
  region: 'Toàn Quốc' | 'Miền Bắc' | 'Miền Trung' | 'Miền Nam';
  province: string;
  district: string;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  hotlinePhone: string;
  emergencyPhone: string;
  permitRequired: boolean;
  permitLeadDays: number;
  permitFeeNote: string;
  officeHours: string;
  coveredTrailSlugs: string[];
  officialWebsite?: string;
  verifiedSource?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const rangerStationSchema = new Schema<IRangerStation>(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    authorityType: {
      type: String,
      enum: ['national_park', 'ranger_station', 'border_guard', 'rescue_center'],
      default: 'national_park',
      index: true,
    },
    region: { type: String, enum: ['Toàn Quốc', 'Miền Bắc', 'Miền Trung', 'Miền Nam'], required: true, index: true },
    province: { type: String, required: true, trim: true, index: true },
    district: { type: String, trim: true, default: '' },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    coordinates: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 },
    },
    hotlinePhone: { type: String, required: true, trim: true, maxlength: 80 },
    emergencyPhone: { type: String, trim: true, maxlength: 80, default: '112 / 114' },
    permitRequired: { type: Boolean, default: true },
    permitLeadDays: { type: Number, default: 2, min: 0, max: 30 },
    permitFeeNote: { type: String, trim: true, maxlength: 300, default: '' },
    officeHours: { type: String, trim: true, maxlength: 120, default: '07:30 - 17:00 (Thứ 2 - Chủ Nhật)' },
    coveredTrailSlugs: { type: [String], default: [], index: true },
    officialWebsite: { type: String, trim: true, default: '' },
    verifiedSource: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

rangerStationSchema.index({ region: 1, province: 1, authorityType: 1 });

export const RangerStationModel = model<IRangerStation>('RangerStation', rangerStationSchema);
