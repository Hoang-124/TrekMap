import { Schema, model, Document, Types } from 'mongoose';

export interface ICheckin extends Document {
  userId: Types.ObjectId;
  trailId: Types.ObjectId;
  checkinDate: Date;
  completionTimeHours: number;
  photos: string[];
  gpxTrackRecorded?: [number, number][];
  verifiedBadge: boolean;
  // Additive Personal Trek Logbook metadata
  distanceRecordedKm?: number;
  elevationGainRecordedM?: number;
  weatherObserved?: string;
  packWeightKg?: number;
  notes?: string;
  companionsCount?: number;
  isPublic?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const checkinSchema = new Schema<ICheckin>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail', required: true, index: true },
    checkinDate: { type: Date, default: Date.now },
    completionTimeHours: { type: Number, required: true, min: 0.1 },
    photos: [{ type: String }],
    gpxTrackRecorded: { type: [[Number]], default: [] },
    verifiedBadge: { type: Boolean, default: true },
    distanceRecordedKm: { type: Number, min: 0, max: 500 },
    elevationGainRecordedM: { type: Number, min: 0, max: 30000 },
    weatherObserved: { type: String, trim: true, maxlength: 160, default: '' },
    packWeightKg: { type: Number, min: 0, max: 60 },
    notes: { type: String, trim: true, maxlength: 1500, default: '' },
    companionsCount: { type: Number, min: 1, max: 100, default: 1 },
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

checkinSchema.index({ userId: 1, trailId: 1 });
checkinSchema.index({ userId: 1, checkinDate: -1 });

export const CheckinModel = model<ICheckin>('Checkin', checkinSchema);
