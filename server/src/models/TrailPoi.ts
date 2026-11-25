import { Schema, model, Document, Types } from 'mongoose';

export type TrailPoiCategory = 'water' | 'camp' | 'signal' | 'danger' | 'viewpoint';
export type TrailPoiStatus = 'active' | 'dry_or_closed';

export interface ITrailPoi extends Document {
  trailId: string;
  userId: Types.ObjectId;
  authorName: string;
  category: TrailPoiCategory;
  title: string;
  notes: string;
  lat: number;
  lng: number;
  elevationM?: number | null;
  status: TrailPoiStatus;
  upvotes: Types.ObjectId[];
  upvoteCount: number;
  lastConfirmedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const trailPoiSchema = new Schema<ITrailPoi>(
  {
    trailId: { type: String, required: true, trim: true, maxlength: 80 },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    authorName: { type: String, required: true, trim: true, maxlength: 80 },
    category: {
      type: String,
      enum: ['water', 'camp', 'signal', 'danger', 'viewpoint'],
      required: true,
    },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    lat: { type: Number, required: true, min: 8, max: 24 },
    lng: { type: Number, required: true, min: 102, max: 110 },
    elevationM: { type: Number, min: 0, max: 3500, default: null },
    status: {
      type: String,
      enum: ['active', 'dry_or_closed'],
      default: 'active',
    },
    upvotes: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    upvoteCount: { type: Number, default: 0, min: 0 },
    lastConfirmedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

trailPoiSchema.index({ trailId: 1, upvoteCount: -1, updatedAt: -1 });
trailPoiSchema.index({ trailId: 1, category: 1, upvoteCount: -1 });
trailPoiSchema.index({ trailId: 1, createdAt: 1, _id: 1 });
trailPoiSchema.index({ status: 1, upvoteCount: -1 });
trailPoiSchema.index({ status: 1, createdAt: -1 });
trailPoiSchema.index({ createdAt: -1 });

export const TrailPoiModel = model<ITrailPoi>('TrailPoi', trailPoiSchema);
