import { Schema, model, Document } from 'mongoose';

export interface ITrailWaypoint {
  id: string;
  name: string;
  type: 'campsite' | 'water' | 'viewpoint' | 'danger' | 'charging' | 'rest';
  description: string;
  elevationM?: number;
  lat: number;
  lng: number;
}

export interface ITrail extends Document {
  name: string;
  altNames: string[];
  region: 'Miền Bắc' | 'Miền Trung' | 'Miền Nam';
  province: string;
  district: string;
  difficultyLevel: number;
  distanceKm: number;
  elevationGainM: number;
  maxAltitudeM: number;
  durationDays: number;
  durationHoursNote: string;
  coverImage: string;
  galleryImages: string[];
  startLocation: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  startLat: number;
  startLng: number;
  gpxTrack: [number, number][];
  waypoints: ITrailWaypoint[];
  bestMonths: number[];
  avoidMonths: number[];
  description: string;
  transportationInfo: string;
  permitRequired: boolean;
  permitInfo?: string;
  rescueContact: {
    name: string;
    phone: string;
    rangerContact: string;
  };
  rating: number;
  reviewCount: number;
  hasCampsite: boolean;
  hasWaterSource: boolean;
  kidFriendly: boolean;
  status: 'approved' | 'pending' | 'rejected';
  createdBy?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const trailSchema = new Schema<ITrail>(
  {
    name: { type: String, required: true, index: 'text' },
    altNames: [{ type: String }],
    region: { type: String, enum: ['Miền Bắc', 'Miền Trung', 'Miền Nam'], required: true, index: true },
    province: { type: String, required: true, index: true },
    district: { type: String, required: true },
    difficultyLevel: { type: Number, required: true, min: 1, max: 5, index: true },
    distanceKm: { type: Number, required: true },
    elevationGainM: { type: Number, required: true },
    maxAltitudeM: { type: Number, required: true },
    durationDays: { type: Number, required: true },
    durationHoursNote: { type: String, required: true },
    coverImage: { type: String, required: true },
    galleryImages: [{ type: String }],
    startLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },
    startLat: { type: Number, required: true },
    startLng: { type: Number, required: true },
    gpxTrack: { type: [[Number]], default: [] },
    waypoints: [
      {
        id: String,
        name: String,
        type: { type: String, enum: ['campsite', 'water', 'viewpoint', 'danger', 'charging', 'rest'] },
        description: String,
        elevationM: Number,
        lat: Number,
        lng: Number,
      },
    ],
    bestMonths: [{ type: Number }],
    avoidMonths: [{ type: Number }],
    description: { type: String, required: true },
    transportationInfo: { type: String, required: true },
    permitRequired: { type: Boolean, default: false },
    permitInfo: { type: String },
    rescueContact: {
      name: String,
      phone: String,
      rangerContact: String,
    },
    rating: { type: Number, default: 5.0, index: true },
    reviewCount: { type: Number, default: 0 },
    hasCampsite: { type: Boolean, default: true },
    hasWaterSource: { type: Boolean, default: true },
    kidFriendly: { type: Boolean, default: false },
    status: { type: String, enum: ['approved', 'pending', 'rejected'], default: 'approved', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Mandatory GIS Spatial 2dsphere Index
trailSchema.index({ startLocation: '2dsphere' });
// Compound Index for efficient filtering
trailSchema.index({ region: 1, difficultyLevel: 1, rating: -1 });

export const TrailModel = model<ITrail>('Trail', trailSchema);
