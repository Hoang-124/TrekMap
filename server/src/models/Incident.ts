import { Schema, model, Document } from 'mongoose';

export interface IIncident extends Document {
  trailId: any;
  trailName: string;
  severity: 'high' | 'medium' | 'low' | 'critical';
  type: string;
  description: string;
  reportedBy?: any;
  reporterName?: string;
  reporterEmail?: string;
  reporterAvatar?: string;
  reporterRole?: string;
  locationNote?: string;
  coordinates?: { lat: number; lng: number };
  reportedAt: string;
  active: boolean;
  resolved?: boolean;
  confirmations?: number;
  coReporters?: Array<{
    userId?: any;
    userName: string;
    userEmail?: string;
    userAvatar?: string;
    confirmedAt: string;
    note?: string;
  }>;
  timelineUpdates?: Array<{
    id: string;
    userId?: any;
    userName: string;
    userEmail?: string;
    userAvatar?: string;
    content: string;
    statusNote?: string;
    createdAt: string;
  }>;
  disputes?: Array<{
    userId?: any;
    userName: string;
    userEmail?: string;
    disputedAt: string;
    reason: string;
  }>;
  createdAt: Date;
}

const incidentSchema = new Schema<IIncident>(
  {
    trailId: { type: Schema.Types.Mixed, required: true, index: true },
    trailName: { type: String, required: true },
    severity: { type: String, enum: ['high', 'medium', 'low', 'critical'], default: 'high' },
    type: { type: String, required: true },
    description: { type: String, required: true },
    reportedBy: { type: Schema.Types.Mixed, ref: 'User' },
    reporterName: { type: String, default: 'Trekker Khẩn Cấp' },
    reporterEmail: { type: String, default: '' },
    reporterAvatar: { type: String, default: '' },
    reporterRole: { type: String, default: 'user' },
    locationNote: { type: String, default: '' },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    reportedAt: { type: String, required: true },
    active: { type: Boolean, default: true, index: true },
    resolved: { type: Boolean, default: false },
    confirmations: { type: Number, default: 1 },
    coReporters: [
      {
        userId: { type: Schema.Types.Mixed },
        userName: { type: String, default: 'Trekker Đồng Báo Cáo' },
        userEmail: { type: String, default: '' },
        userAvatar: { type: String, default: '' },
        confirmedAt: { type: String, default: () => new Date().toLocaleString('vi-VN') },
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
        createdAt: { type: String, default: () => new Date().toLocaleString('vi-VN') },
      },
    ],
    disputes: [
      {
        userId: { type: Schema.Types.Mixed },
        userName: { type: String, default: 'Trekker Khảo Sát' },
        userEmail: { type: String, default: '' },
        disputedAt: { type: String, default: () => new Date().toLocaleString('vi-VN') },
        reason: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true }
);

incidentSchema.index({ active: 1, createdAt: -1 });

export const IncidentModel = model<IIncident>('Incident', incidentSchema);
