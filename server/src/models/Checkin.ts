import { Schema, model, Document } from 'mongoose';

export interface ICheckin extends Document {
  userId: Schema.Types.ObjectId;
  trailId: Schema.Types.ObjectId;
  checkinDate: Date;
  completionTimeHours: number;
  photos: string[];
  gpxTrackRecorded?: [number, number][];
  verifiedBadge: boolean;
  createdAt: Date;
}

const checkinSchema = new Schema<ICheckin>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail', required: true, index: true },
    checkinDate: { type: Date, default: Date.now },
    completionTimeHours: { type: Number, required: true },
    photos: [{ type: String }],
    gpxTrackRecorded: { type: [[Number]], default: [] },
    verifiedBadge: { type: Boolean, default: true },
  },
  { timestamps: true }
);

checkinSchema.index({ userId: 1, trailId: 1 });

export const CheckinModel = model<ICheckin>('Checkin', checkinSchema);
