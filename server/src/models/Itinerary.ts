import { Schema, model, Document } from 'mongoose';

export interface ITimelineStep {
  day: number;
  time: string;
  title: string;
  description: string;
  locationNote?: string;
}

export interface IItinerary extends Document {
  creatorId: Schema.Types.ObjectId;
  trailId: Schema.Types.ObjectId;
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
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail', required: true },
    title: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    memberCount: { type: Number, default: 1 },
    timelineSteps: [
      {
        day: Number,
        time: String,
        title: String,
        description: String,
        locationNote: String,
      },
    ],
    shareToken: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ['draft', 'active', 'completed'], default: 'active' },
  },
  { timestamps: true }
);

export const ItineraryModel = model<IItinerary>('Itinerary', itinerarySchema);
