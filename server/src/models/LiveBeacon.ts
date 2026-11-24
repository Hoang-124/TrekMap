import { Schema, model, Document, Types } from 'mongoose';

export type LiveBeaconStatus = 'active' | 'paused' | 'safe' | 'sos';

export interface ILiveBeaconPosition {
  lat: number;
  lng: number;
  altitudeM?: number | null;
  accuracyM?: number | null;
  recordedAt: Date;
}

export interface ILiveBeaconBreadcrumb {
  lat: number;
  lng: number;
  altitudeM?: number | null;
  recordedAt: Date;
}

export interface ILiveBeacon extends Document {
  token: string;
  userId: Types.ObjectId;
  displayName: string;
  trailId?: string;
  trailName: string;
  status: LiveBeaconStatus;
  batteryPercent?: number | null;
  distanceKm: number;
  elevationGainM: number;
  lastPosition?: ILiveBeaconPosition;
  breadcrumbs: ILiveBeaconBreadcrumb[];
  emergencyNote?: string;
  sosNotifiedAt?: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const beaconPositionSchema = new Schema<ILiveBeaconPosition>(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    altitudeM: { type: Number, min: -200, max: 9000, default: null },
    accuracyM: { type: Number, min: 0, max: 50000, default: null },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const beaconBreadcrumbSchema = new Schema<ILiveBeaconBreadcrumb>(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    altitudeM: { type: Number, min: -200, max: 9000, default: null },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const liveBeaconSchema = new Schema<ILiveBeacon>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-f0-9]{24}$/,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    trailId: { type: String, trim: true, maxlength: 80, default: '' },
    trailName: { type: String, required: true, trim: true, maxlength: 160 },
    status: {
      type: String,
      enum: ['active', 'paused', 'safe', 'sos'],
      default: 'active',
      index: true,
    },
    batteryPercent: { type: Number, min: 0, max: 100, default: null },
    distanceKm: { type: Number, default: 0, min: 0, max: 500 },
    elevationGainM: { type: Number, default: 0, min: 0, max: 30000 },
    lastPosition: { type: beaconPositionSchema, default: undefined },
    breadcrumbs: { type: [beaconBreadcrumbSchema], default: [] },
    emergencyNote: { type: String, trim: true, maxlength: 400, default: '' },
    sosNotifiedAt: { type: Date, default: null },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

liveBeaconSchema.index({ userId: 1, status: 1, updatedAt: -1 });
liveBeaconSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const LiveBeaconModel = model<ILiveBeacon>('LiveBeacon', liveBeaconSchema);
