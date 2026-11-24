import { Schema, model, Document } from 'mongoose';

export interface IAiKnowledge extends Document {
  key?: string;
  category:
    | 'trail_specific'
    | 'fitness_training'
    | 'gear_equipment'
    | 'emergency_sos'
    | 'nutrition_hydration'
    | 'weather_climate'
    | 'permits_regulations'
    | 'navigation_gpx'
    | 'camping_shelters'
    | 'porter_local_guides';
  trailId?: string;
  trailName?: string;
  question: string;
  keywords: string[];
  answer: string;
  searchTextNormalized?: string;
  difficultyLevel?: number;
  sourceOrHotline?: string;
  isActive: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const aiKnowledgeSchema = new Schema<IAiKnowledge>(
  {
    key: { type: String, trim: true, unique: true, sparse: true },
    category: {
      type: String,
      enum: [
        'trail_specific',
        'fitness_training',
        'gear_equipment',
        'emergency_sos',
        'nutrition_hydration',
        'weather_climate',
        'permits_regulations',
        'navigation_gpx',
        'camping_shelters',
        'porter_local_guides',
      ],
      required: true,
      index: true,
    },
    trailId: { type: String, index: true },
    trailName: { type: String, index: true },
    question: { type: String, required: true },
    keywords: [{ type: String }],
    answer: { type: String, required: true },
    searchTextNormalized: { type: String, default: '' },
    difficultyLevel: { type: Number, min: 1, max: 5 },
    sourceOrHotline: { type: String },
    isActive: { type: Boolean, default: true, index: true },
    viewCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Vietnamese-safe text search index (default_language: 'none' preserves diacritics & stops English stemming)
aiKnowledgeSchema.index(
  {
    question: 'text',
    keywords: 'text',
    answer: 'text',
    trailName: 'text',
    searchTextNormalized: 'text',
  },
  { default_language: 'none' }
);

export const AiKnowledgeModel = model<IAiKnowledge>('AiKnowledge', aiKnowledgeSchema);
