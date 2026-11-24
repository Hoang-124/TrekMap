import { Schema, model, Document, Types } from 'mongoose';

export interface ITimelineStep {
  day: number;
  time: string;
  title?: string;
  activity?: string;
  description?: string;
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
  memberCount: number;
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
    memberCount: { type: Number, default: 1, min: 1, max: 100 },
    timelineSteps: [
      {
        day: Number,
        time: String,
        title: String,
        activity: String,
        description: String,
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
