import { Schema, model, Document, Types } from 'mongoose';

export type CustomRouteVisibility = 'private' | 'unlisted' | 'public';

export interface ICustomRouteWaypoint {
  id: string;
  name: string;
  type: 'campsite' | 'water' | 'viewpoint' | 'danger' | 'charging' | 'rest' | 'summit' | 'trailhead';
  lat: number;
  lng: number;
  elevationM?: number;
  note?: string;
}

export interface ICustomRouteMetrics {
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  maxAltitudeM: number;
  minAltitudeM: number;
  maxSlopePercent: number;
  naismithHours: number;
  difficultyEstimate: number;
}

export interface ICustomRoute extends Document {
  creatorId: Types.ObjectId;
  shareSlug: string;
  title: string;
  description: string;
  region: 'Miền Bắc' | 'Miền Trung' | 'Miền Nam';
  province: string;
  baseTrailId?: Types.ObjectId;
  waypoints: ICustomRouteWaypoint[];
  trackPoints: number[][]; // [lat, lng] or [lat, lng, ele]
  metrics: ICustomRouteMetrics;
  visibility: CustomRouteVisibility;
  likesCount: number;
  likedBy: Types.ObjectId[];
  viewsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const customRouteSchema = new Schema<ICustomRoute>(
  {
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    shareSlug: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    region: { type: String, enum: ['Miền Bắc', 'Miền Trung', 'Miền Nam'], default: 'Miền Bắc', index: true },
    province: { type: String, trim: true, maxlength: 80, default: '' },
    baseTrailId: { type: Schema.Types.ObjectId, ref: 'Trail' },
    waypoints: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true, trim: true, maxlength: 120 },
        type: {
          type: String,
          enum: ['campsite', 'water', 'viewpoint', 'danger', 'charging', 'rest', 'summit', 'trailhead'],
          default: 'viewpoint',
        },
        lat: { type: Number, required: true, min: -90, max: 90 },
        lng: { type: Number, required: true, min: -180, max: 180 },
        elevationM: { type: Number },
        note: { type: String, trim: true, maxlength: 300, default: '' },
      },
    ],
    trackPoints: { type: [[Number]], required: true },
    metrics: {
      distanceKm: { type: Number, default: 0, min: 0 },
      elevationGainM: { type: Number, default: 0, min: 0 },
      elevationLossM: { type: Number, default: 0, min: 0 },
      maxAltitudeM: { type: Number, default: 0 },
      minAltitudeM: { type: Number, default: 0 },
      maxSlopePercent: { type: Number, default: 0, min: 0 },
      naismithHours: { type: Number, default: 0, min: 0 },
      difficultyEstimate: { type: Number, default: 2, min: 1, max: 5 },
    },
    visibility: {
      type: String,
      enum: ['private', 'unlisted', 'public'],
      default: 'unlisted',
      index: true,
    },
    likesCount: { type: Number, default: 0, min: 0 },
    likedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    viewsCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

customRouteSchema.index({ creatorId: 1, createdAt: -1 });
customRouteSchema.index({ visibility: 1, likesCount: -1, createdAt: -1 });

export const CustomRouteModel = model<ICustomRoute>('CustomRoute', customRouteSchema);
