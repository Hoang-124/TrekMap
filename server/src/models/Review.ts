import { Schema, model, Document, Types } from 'mongoose';

export interface IReview extends Document {
  trailId: Types.ObjectId;
  userId?: Types.ObjectId;
  userName: string;
  userAvatar?: string;
  rating: number;
  difficultyRating: number;
  content: string;
  safetyNote?: string;
  photos?: string[];
  tripDate: string;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    userName: { type: String, required: true },
    userAvatar: { type: String, default: '' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    difficultyRating: { type: Number, required: true, min: 1, max: 5 },
    content: { type: String, required: true },
    safetyNote: { type: String, default: '' },
    photos: [{ type: String }],
    tripDate: { type: String, required: true },
  },
  { timestamps: true }
);

reviewSchema.index({ trailId: 1, createdAt: -1 });

export const ReviewModel = model<IReview>('Review', reviewSchema);
