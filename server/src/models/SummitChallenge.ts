import { Schema, model, Document } from 'mongoose';

export type ChallengeTier = 'bronze' | 'silver' | 'gold' | 'alpine_legend';
export type ChallengeRegion = 'Toàn Quốc' | 'Miền Bắc' | 'Miền Trung' | 'Miền Nam';
export type ChallengeRuleType = 'trail_slugs' | 'altitude_threshold' | 'cumulative_km' | 'cumulative_gain';

export interface ISummitChallenge extends Document {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  badgeName: string;
  tier: ChallengeTier;
  region: ChallengeRegion;
  ruleType: ChallengeRuleType;
  requiredTrailSlugs: string[];
  minAltitudeM?: number;
  targetCount: number;
  targetKm?: number;
  targetGainM?: number;
  rewardPoints: number;
  coverImage: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const summitChallengeSchema = new Schema<ISummitChallenge>(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    subtitle: { type: String, trim: true, maxlength: 200, default: '' },
    description: { type: String, required: true, trim: true, maxlength: 1500 },
    badgeName: { type: String, required: true, trim: true, maxlength: 100 },
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'alpine_legend'],
      default: 'silver',
    },
    region: {
      type: String,
      enum: ['Toàn Quốc', 'Miền Bắc', 'Miền Trung', 'Miền Nam'],
      default: 'Toàn Quốc',
      index: true,
    },
    ruleType: {
      type: String,
      enum: ['trail_slugs', 'altitude_threshold', 'cumulative_km', 'cumulative_gain'],
      default: 'trail_slugs',
    },
    requiredTrailSlugs: { type: [String], default: [] },
    minAltitudeM: { type: Number, min: 0, max: 4000 },
    targetCount: { type: Number, required: true, min: 1, max: 100, default: 3 },
    targetKm: { type: Number, min: 1, max: 5000 },
    targetGainM: { type: Number, min: 100, max: 100000 },
    rewardPoints: { type: Number, required: true, min: 10, max: 1000, default: 80 },
    coverImage: { type: String, default: '' },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 10 },
  },
  { timestamps: true }
);

summitChallengeSchema.index({ isActive: 1, sortOrder: 1 });

export const SummitChallengeModel = model<ISummitChallenge>('SummitChallenge', summitChallengeSchema);
