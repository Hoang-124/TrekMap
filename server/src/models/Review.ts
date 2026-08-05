import { Schema, model, Document } from 'mongoose';

export interface IReview extends Document {
  trailId: Schema.Types.ObjectId;
  userId?: Schema.Types.ObjectId;
  userName: string;
  userAvatar?: string;
  rating: number;
  difficultyRating: number;
  content: string;
  safetyNote?: string;
  photos?: string[];
  tripDate: string;
  createdAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, required: true },
    userAvatar: { type: String },
    rating: { type: Number, required: true, min: 1, max: 5 },
    difficultyRating: { type: Number, required: true, min: 1, max: 5 },
    content: { type: String, required: true },
    safetyNote: { type: String },
    photos: [{ type: String }],
    tripDate: { type: String, required: true },
  },
  { timestamps: true }
);

reviewSchema.index({ trailId: 1, createdAt: -1 });

export const ReviewModel = model<IReview>('Review', reviewSchema);
