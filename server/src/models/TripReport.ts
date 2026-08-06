import { Schema, model, Document } from 'mongoose';

export interface ITripReport extends Document {
  authorId: Schema.Types.ObjectId;
  trailId: Schema.Types.ObjectId;
  tripPlanId?: Schema.Types.ObjectId;
  title: string;
  summary: string;
  content: string;
  photos: string[];
  gpxTrackActual?: number[][];
  tripDate: Date;
  duration: string;
  groupSize: number;
  totalCost?: string;
  difficultyActual: number;
  weatherCondition: string;
  highlights: string[];
  warnings: string[];
  recommendations: string[];
  rating: number;
  reactions: {
    like: number;
    love: number;
    wow: number;
  };
  userReactionsMap: Record<string, string>;
  commentsCount: number;
  viewsCount: number;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const tripReportSchema = new Schema<ITripReport>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail', required: true, index: true },
    tripPlanId: { type: Schema.Types.ObjectId, ref: 'TripPlan' },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    content: { type: String, required: true },
    photos: [{ type: String }],
    gpxTrackActual: { type: [[Number]], default: [] },
    tripDate: { type: Date, required: true },
    duration: { type: String, default: '2 ngày 1 đêm' },
    groupSize: { type: Number, default: 2 },
    totalCost: { type: String, default: '' },
    difficultyActual: { type: Number, min: 1, max: 5, default: 3 },
    weatherCondition: { type: String, default: 'Thời tiết đẹp' },
    highlights: [{ type: String }],
    warnings: [{ type: String }],
    recommendations: [{ type: String }],
    rating: { type: Number, min: 1, max: 5, default: 5 },
    reactions: {
      like: { type: Number, default: 0 },
      love: { type: Number, default: 0 },
      wow: { type: Number, default: 0 },
    },
    userReactionsMap: { type: Map, of: String, default: {} },
    commentsCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 1 },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

tripReportSchema.index({ trailId: 1, createdAt: -1 });

export const TripReportModel = model<ITripReport>('TripReport', tripReportSchema);
