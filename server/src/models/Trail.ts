import { Schema, model, Document, Types } from 'mongoose';

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
  id?: string;
  name: string;
  altNames: string[];
  region: 'Miền Bắc' | 'Miền Trung' | 'Miền Nam';
  province: string;
  district: string;
  difficultyLevel: number;
  difficultyNote?: string;
  distanceKm: number;
  elevationGainM: number;
  maxAltitudeM: number;
  durationDays: number;
  durationHoursNote: string;
  coverImage: string;
  galleryImages: string[];
  startLocation: {
    type: 'Point';
    coordinates: [number, number]; // GeoJSON [lng, lat]
  };
  startLat: number;
  startLng: number;
  endLat?: number;
  endLng?: number;
  gpxTrack: [number, number][]; // Leaflet [lat, lng] polyline points
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
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const trailSchema = new Schema<ITrail>(
  {
    id: { type: String, unique: true, sparse: true },
    name: { type: String, required: true, trim: true },
    altNames: [{ type: String }],
    region: { type: String, enum: ['Miền Bắc', 'Miền Trung', 'Miền Nam'], required: true },
    province: { type: String, required: true, index: true },
    district: { type: String, required: true },
    difficultyLevel: { type: Number, required: true, min: 1, max: 5, index: true },
    difficultyNote: { type: String, default: '' },
    distanceKm: { type: Number, required: true, min: 0.1 },
    elevationGainM: { type: Number, required: true, min: 0 },
    maxAltitudeM: { type: Number, required: true, min: 0 },
    durationDays: { type: Number, required: true, min: 1 },
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
        type: [Number], // GeoJSON [lng, lat]
        required: true,
        validate: {
          validator: (coords: number[]) =>
            Array.isArray(coords) &&
            coords.length === 2 &&
            Number.isFinite(coords[0]) &&
            Number.isFinite(coords[1]) &&
            coords[0] >= -180 &&
            coords[0] <= 180 &&
            coords[1] >= -90 &&
            coords[1] <= 90,
          message: 'Tọa độ GeoJSON phải là [lng, lat] hợp lệ.',
        },
      },
    },
    startLat: { type: Number, required: true, min: -90, max: 90 },
    startLng: { type: Number, required: true, min: -180, max: 180 },
    endLat: { type: Number, min: -90, max: 90 },
    endLng: { type: Number, min: -180, max: 180 },
    // Leaflet-ordered [lat, lng] polyline vertices
    gpxTrack: { type: [[Number]], default: [] },
    waypoints: [
      {
        id: String,
        name: String,
        type: { type: String, enum: ['campsite', 'water', 'viewpoint', 'danger', 'charging', 'rest'] },
        description: String,
        elevationM: Number,
        lat: { type: Number, min: -90, max: 90 },
        lng: { type: Number, min: -180, max: 180 },
      },
    ],
    bestMonths: [{ type: Number, min: 1, max: 12 }],
    avoidMonths: [{ type: Number, min: 1, max: 12 }],
    description: { type: String, required: true },
    transportationInfo: { type: String, required: true },
    permitRequired: { type: Boolean, default: false },
    permitInfo: { type: String },
    rescueContact: {
      name: String,
      phone: String,
      rangerContact: String,
    },
    rating: { type: Number, default: 0, min: 0, max: 5, index: true },
    reviewCount: { type: Number, default: 0, min: 0 },
    hasCampsite: { type: Boolean, default: true },
    hasWaterSource: { type: Boolean, default: true },
    kidFriendly: { type: Boolean, default: false },
    status: { type: String, enum: ['approved', 'pending', 'rejected'], default: 'pending' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: true }
);

// Keep GeoJSON startLocation synced with startLat/startLng
trailSchema.pre('validate', function () {
  if (typeof this.startLat === 'number' && typeof this.startLng === 'number') {
    this.startLocation = {
      type: 'Point',
      coordinates: [this.startLng, this.startLat],
    };
  }
});

// Mandatory GIS Spatial 2dsphere Index
trailSchema.index({ startLocation: '2dsphere' });
// B-tree index on name for exact lookups & upserts
trailSchema.index({ name: 1 });
// Vietnamese-safe full-text search across key trail fields
trailSchema.index(
  { name: 'text', altNames: 'text', province: 'text', district: 'text', description: 'text' },
  { default_language: 'none' }
);
// Compound Indexes for catalog filtering & sorting
trailSchema.index({ status: 1, region: 1, difficultyLevel: 1, rating: -1 });
trailSchema.index({ region: 1, difficultyLevel: 1, rating: -1 });

export const TrailModel = model<ITrail>('Trail', trailSchema);
