import { Schema, model, Document, Types } from 'mongoose';

export interface IChallengeClaim extends Document {
  userId: Types.ObjectId;
  challengeSlug: string;
  badgeName: string;
  pointsAwarded: number;
  claimedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const challengeClaimSchema = new Schema<IChallengeClaim>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    challengeSlug: { type: String, required: true, trim: true, lowercase: true, index: true },
    badgeName: { type: String, required: true, trim: true },
    pointsAwarded: { type: Number, required: true, min: 0 },
    claimedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Guarantees idempotent one-time claim per user per challenge
challengeClaimSchema.index({ userId: 1, challengeSlug: 1 }, { unique: true });

export const ChallengeClaimModel = model<IChallengeClaim>('ChallengeClaim', challengeClaimSchema);
