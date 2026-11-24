import { Schema, model, Document, Types } from 'mongoose';

export interface ITimelineStep {
  day: number;
  time: string;
  title?: string;
  activity?: string;
  description?: string;
  notes?: string;
  location?: string;
  locationNote?: string;
  altitudeM?: number;
}

export interface IItinerary extends Document {
  creatorId: Types.ObjectId;
  trailId: Types.ObjectId;
  title: string;
  startDate: Date;
  endDate: Date;
  totalDays?: number;
  memberCount: number;
  notes?: string;
  timelineSteps: ITimelineStep[];
  shareToken: string;
  status: 'draft' | 'active' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const itinerarySchema = new Schema<IItinerary>(
  {
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail', required: true, index: true },
    title: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalDays: { type: Number, min: 1, max: 30 },
    memberCount: { type: Number, default: 1, min: 1, max: 100 },
    notes: { type: String, default: '' },
    timelineSteps: [
      {
        day: Number,
        time: String,
        title: String,
        activity: String,
        description: String,
        notes: String,
        location: String,
        locationNote: String,
        altitudeM: Number,
      },
    ],
    shareToken: { type: String, required: true, unique: true },
    status: { type: String, enum: ['draft', 'active', 'completed'], default: 'active' },
  },
  { timestamps: true }
);

export const ItineraryModel = model<IItinerary>('Itinerary', itinerarySchema);
