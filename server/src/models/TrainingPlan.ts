import { Schema, model, Document, Types } from 'mongoose';

export type TrainingCategory = 'cardio' | 'leg_strength' | 'stair_elevation' | 'pack_walk' | 'recovery';
export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';
export type TrainingPlanStatus = 'active' | 'completed' | 'abandoned';

export interface ITrainingSession {
  id: string;
  week: number;
  dayOfWeek: number; // 1 (Mon) .. 7 (Sun)
  title: string;
  category: TrainingCategory;
  durationMin: number;
  targetElevationM?: number;
  packWeightKg?: number;
  notes?: string;
  completed: boolean;
  completedAt?: Date;
}

export interface ITrainingPlan extends Document {
  userId: Types.ObjectId;
  targetTrailId?: Types.ObjectId;
  targetTrailSlug: string;
  targetTrailName: string;
  targetDate: Date;
  durationWeeks: 4 | 6 | 8;
  fitnessLevel: FitnessLevel;
  status: TrainingPlanStatus;
  sessions: ITrainingSession[];
  readinessScore: number;
  createdAt: Date;
  updatedAt: Date;
}

const trainingPlanSchema = new Schema<ITrainingPlan>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetTrailId: { type: Schema.Types.ObjectId, ref: 'Trail', index: true },
    targetTrailSlug: { type: String, required: true, trim: true },
    targetTrailName: { type: String, required: true, trim: true, maxlength: 180 },
    targetDate: { type: Date, required: true },
    durationWeeks: { type: Number, enum: [4, 6, 8], required: true, default: 6 },
    fitnessLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      required: true,
      default: 'intermediate',
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'abandoned'],
      default: 'active',
      index: true,
    },
    sessions: [
      {
        id: { type: String, required: true },
        week: { type: Number, required: true, min: 1, max: 8 },
        dayOfWeek: { type: Number, required: true, min: 1, max: 7 },
        title: { type: String, required: true, trim: true, maxlength: 180 },
        category: {
          type: String,
          enum: ['cardio', 'leg_strength', 'stair_elevation', 'pack_walk', 'recovery'],
          required: true,
        },
        durationMin: { type: Number, required: true, min: 10, max: 600 },
        targetElevationM: { type: Number, min: 0, max: 4000 },
        packWeightKg: { type: Number, min: 0, max: 30 },
        notes: { type: String, trim: true, maxlength: 400, default: '' },
        completed: { type: Boolean, default: false },
        completedAt: { type: Date },
      },
    ],
    readinessScore: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

trainingPlanSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const TrainingPlanModel = model<ITrainingPlan>('TrainingPlan', trainingPlanSchema);
