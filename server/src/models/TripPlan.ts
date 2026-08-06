import { Schema, model, Document } from 'mongoose';

export interface ITripPlanRequest {
  userId: Schema.Types.ObjectId;
  message: string;
  requestedAt: Date;
}

export interface ITripPlan extends Document {
  creatorId: Schema.Types.ObjectId;
  trailId?: Schema.Types.ObjectId;
  trailName?: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  maxMembers: number;
  currentMembers: Schema.Types.ObjectId[];
  pendingRequests: ITripPlanRequest[];
  requirements: string;
  estimatedCost: string;
  meetingPoint: string;
  difficultyLevel: number;
  status: 'recruiting' | 'full' | 'in_progress' | 'completed' | 'cancelled';
  coverImage?: string;
  tags: string[];
  viewsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const tripPlanSchema = new Schema<ITripPlan>(
  {
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail' },
    trailName: { type: String, default: '' },
    title: { type: String, required: true },
    description: { type: String, required: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    maxMembers: { type: Number, required: true, min: 2, default: 6 },
    currentMembers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    pendingRequests: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        message: { type: String, required: true },
        requestedAt: { type: Date, default: Date.now },
      },
    ],
    requirements: { type: String, default: 'Thùy duyên, chu đáo' },
    estimatedCost: { type: String, default: 'Chia đều theo chi phí thực tế' },
    meetingPoint: { type: String, default: 'Trao đổi thêm khi chốt đoàn' },
    difficultyLevel: { type: Number, default: 3 },
    status: {
      type: String,
      enum: ['recruiting', 'full', 'in_progress', 'completed', 'cancelled'],
      default: 'recruiting',
      index: true,
    },
    coverImage: { type: String, default: '' },
    tags: [{ type: String }],
    viewsCount: { type: Number, default: 1 },
  },
  { timestamps: true }
);

tripPlanSchema.index({ status: 1, startDate: 1 });

export const TripPlanModel = model<ITripPlan>('TripPlan', tripPlanSchema);
