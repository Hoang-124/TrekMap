import { Schema, model, Document, Types } from 'mongoose';

export interface ITripPlanRequest {
  userId: Types.ObjectId;
  message: string;
  requestedAt: Date;
}

export interface ISharedGearItem {
  id: string;
  itemName: string;
  category: string;
  weightG?: number;
  assignedUserId?: Types.ObjectId;
  assignedUserName: string;
  packed: boolean;
}

export interface ITripExpense {
  id: string;
  title: string;
  amountVnd: number;
  paidByUserId?: Types.ObjectId;
  paidByName: string;
  splitCount: number;
  createdAt: Date;
}

export interface ITripPlan extends Document {
  creatorId: Types.ObjectId;
  trailId?: Types.ObjectId;
  trailName?: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  maxMembers: number;
  currentMembers: Types.ObjectId[];
  pendingRequests: ITripPlanRequest[];
  requirements: string;
  estimatedCost: string;
  meetingPoint: string;
  difficultyLevel: number;
  status: 'recruiting' | 'full' | 'in_progress' | 'completed' | 'cancelled';
  coverImage?: string;
  tags: string[];
  viewsCount: number;
  groupConversationId?: Types.ObjectId;
  sharedGear: ISharedGearItem[];
  safetyGate: Map<string, boolean>;
  expenses: ITripExpense[];
  settledTransfers: string[];
  createdAt: Date;
  updatedAt: Date;
}

const tripPlanSchema = new Schema<ITripPlan>(
  {
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail', index: true },
    trailName: { type: String, default: '' },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    maxMembers: { type: Number, required: true, min: 2, max: 50, default: 6 },
    currentMembers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    pendingRequests: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        message: { type: String, required: true },
        requestedAt: { type: Date, default: Date.now },
      },
    ],
    requirements: { type: String, default: 'Tùy duyên, chu đáo' },
    estimatedCost: { type: String, default: 'Chia đều theo chi phí thực tế' },
    meetingPoint: { type: String, default: 'Trao đổi thêm khi chốt đoàn' },
    difficultyLevel: { type: Number, min: 1, max: 5, default: 3 },
    status: {
      type: String,
      enum: ['recruiting', 'full', 'in_progress', 'completed', 'cancelled'],
      default: 'recruiting',
    },
    coverImage: { type: String, default: '' },
    tags: [{ type: String }],
    viewsCount: { type: Number, default: 1, min: 0 },
    groupConversationId: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    sharedGear: [
      {
        id: { type: String, required: true },
        itemName: { type: String, required: true, trim: true, maxlength: 140 },
        category: { type: String, default: 'Dùng chung', trim: true, maxlength: 60 },
        weightG: { type: Number, default: 500, min: 0, max: 100_000 },
        assignedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        assignedUserName: { type: String, default: 'Chưa nhận', trim: true, maxlength: 80 },
        packed: { type: Boolean, default: false },
      },
    ],
    safetyGate: { type: Map, of: Boolean, default: () => new Map() },
    expenses: [
      {
        id: { type: String, required: true },
        title: { type: String, required: true, trim: true, maxlength: 140 },
        amountVnd: { type: Number, required: true, min: 1000, max: 500_000_000 },
        paidByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        paidByName: { type: String, required: true, trim: true, maxlength: 80 },
        splitCount: { type: Number, default: 2, min: 1, max: 50 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    settledTransfers: { type: [String], default: [] },
  },
  { timestamps: true }
);

tripPlanSchema.index({ status: 1, startDate: 1, createdAt: -1 });
tripPlanSchema.index({ currentMembers: 1 });

export const TripPlanModel = model<ITripPlan>('TripPlan', tripPlanSchema);
