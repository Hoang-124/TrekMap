import { Schema, model, Document, Types } from 'mongoose';

export interface ITripReportComment {
  _id?: Types.ObjectId;
  authorId: Types.ObjectId;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: Date;
}

export interface ITripReport extends Document {
  authorId: Types.ObjectId;
  trailId: Types.ObjectId;
  tripPlanId?: Types.ObjectId;
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
  userReactionsMap: Map<string, string>;
  comments: ITripReportComment[];
  commentsCount: number;
  viewsCount: number;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const tripReportSchema = new Schema<ITripReport>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail', required: true },
    tripPlanId: { type: Schema.Types.ObjectId, ref: 'TripPlan', index: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String, required: true },
    content: { type: String, required: true },
    photos: [{ type: String }],
    gpxTrackActual: { type: [[Number]], default: [] },
    tripDate: { type: Date, required: true },
    duration: { type: String, default: '2 ngày 1 đêm' },
    groupSize: { type: Number, min: 1, default: 2 },
    totalCost: { type: String, default: '' },
    difficultyActual: { type: Number, min: 1, max: 5, default: 3 },
    weatherCondition: { type: String, default: 'Thời tiết đẹp' },
    highlights: [{ type: String }],
    warnings: [{ type: String }],
    recommendations: [{ type: String }],
    rating: { type: Number, min: 1, max: 5, default: 5 },
    reactions: {
      like: { type: Number, default: 0, min: 0 },
      love: { type: Number, default: 0, min: 0 },
      wow: { type: Number, default: 0, min: 0 },
    },
    userReactionsMap: { type: Map, of: String, default: () => new Map() },
    comments: [
      {
        authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        authorName: { type: String, required: true, trim: true, maxlength: 100 },
        authorAvatar: { type: String, default: '' },
        content: { type: String, required: true, trim: true, maxlength: 2000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    commentsCount: { type: Number, default: 0, min: 0 },
    viewsCount: { type: Number, default: 1, min: 0 },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

tripReportSchema.index({ trailId: 1, createdAt: -1 });
tripReportSchema.index({ createdAt: -1 });

export const TripReportModel = model<ITripReport>('TripReport', tripReportSchema);
