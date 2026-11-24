import { Schema, model, Document, Types } from 'mongoose';

export interface IIncident extends Document {
  trailId: Types.ObjectId | string;
  trailName: string;
  severity: 'high' | 'medium' | 'low' | 'critical';
  type: string;
  description: string;
  reportedBy?: Types.ObjectId | string;
  reporterName?: string;
  reporterEmail?: string;
  reporterAvatar?: string;
  reporterRole?: string;
  locationNote?: string;
  coordinates?: { lat: number; lng: number };
  images?: string[];
  elevationM?: number;
  reportedAt: string;
  active: boolean;
  resolved?: boolean;
  confirmations?: number;
  coReporters?: Array<{
    userId?: Types.ObjectId | string;
    userName: string;
    userEmail?: string;
    userAvatar?: string;
    confirmedAt: string;
    note?: string;
  }>;
  timelineUpdates?: Array<{
    id: string;
    userId?: Types.ObjectId | string;
    userName: string;
    userEmail?: string;
    userAvatar?: string;
    content: string;
    statusNote?: string;
    createdAt: string;
  }>;
  disputes?: Array<{
    userId?: Types.ObjectId | string;
    userName: string;
    userEmail?: string;
    disputedAt: string;
    reason: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const incidentSchema = new Schema<IIncident>(
  {
    trailId: { type: Schema.Types.Mixed, required: true, index: true },
    trailName: { type: String, required: true, trim: true },
    severity: { type: String, enum: ['high', 'medium', 'low', 'critical'], default: 'high' },
    type: {
      type: String,
      enum: ['landslide', 'flood', 'flash_flood', 'weather', 'bad_weather', 'wildfire', 'lost', 'trail_closed', 'wildlife', 'injury', 'other'],
      default: 'weather',
    },
    description: { type: String, required: true },
    reportedBy: { type: Schema.Types.Mixed, index: true },
    reporterName: { type: String, default: 'Trekker Khẩn Cấp' },
    reporterEmail: { type: String, default: '', index: true },
    reporterAvatar: { type: String, default: '' },
    reporterRole: { type: String, default: 'user' },
    locationNote: { type: String, default: '' },
    coordinates: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
    images: [{ type: String }],
    elevationM: { type: Number },
    reportedAt: { type: String, required: true },
    active: { type: Boolean, default: true },
    resolved: { type: Boolean, default: false },
    confirmations: { type: Number, default: 1, min: 1 },
    coReporters: [
      {
        userId: { type: Schema.Types.Mixed },
        userName: { type: String, default: 'Trekker Đồng Báo Cáo' },
        userEmail: { type: String, default: '' },
        userAvatar: { type: String, default: '' },
        confirmedAt: { type: String, default: () => new Date().toISOString() },
        note: { type: String, default: '' },
      },
    ],
    timelineUpdates: [
      {
        id: { type: String, default: () => `upd-${Date.now()}` },
        userId: { type: Schema.Types.Mixed },
        userName: { type: String, default: 'Trekker Thực Địa' },
        userEmail: { type: String, default: '' },
        userAvatar: { type: String, default: '' },
        content: { type: String, required: true },
        statusNote: { type: String, default: '' },
        createdAt: { type: String, default: () => new Date().toISOString() },
      },
    ],
    disputes: [
      {
        userId: { type: Schema.Types.Mixed },
        userName: { type: String, default: 'Trekker Khảo Sát' },
        userEmail: { type: String, default: '' },
        disputedAt: { type: String, default: () => new Date().toISOString() },
        reason: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true }
);

incidentSchema.index({ active: 1, createdAt: -1 });

export const IncidentModel = model<IIncident>('Incident', incidentSchema);
