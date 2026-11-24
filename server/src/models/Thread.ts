import { Schema, model, Document, Types } from 'mongoose';

export interface IThreadReactions {
  like: number;
  love?: number;
  haha: number;
  wow: number;
  buon: number;
  huhu: number;
  sad?: number;
  angry: number;
  dislike: number;
}

export interface IThread extends Document {
  id: string;
  title: string;
  authorName: string;
  authorAvatar: string;
  authorBadge?: string;
  userId?: Types.ObjectId;
  category: string;
  trailId?: string;
  trailName?: string;
  content: string;
  images?: string[];
  upvotes: number;
  reactions: IThreadReactions;
  userReactionsMap?: Map<string, string>;
  repliesCount: number;
  viewsCount: number;
  isPinned?: boolean;
  isLocked?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const threadSchema = new Schema<IThread>(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    authorName: { type: String, required: true },
    authorAvatar: { type: String, required: true },
    authorBadge: { type: String, default: 'Verified Trekker' },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    category: { type: String, default: 'Kinh Nghiệm' },
    trailId: { type: String, default: '', index: true },
    trailName: { type: String, default: '' },
    content: { type: String, required: true },
    images: { type: [String], default: [] },
    upvotes: { type: Number, default: 0, min: 0 },
    reactions: {
      like: { type: Number, default: 0, min: 0 },
      love: { type: Number, default: 0, min: 0 },
      haha: { type: Number, default: 0, min: 0 },
      wow: { type: Number, default: 0, min: 0 },
      buon: { type: Number, default: 0, min: 0 },
      huhu: { type: Number, default: 0, min: 0 },
      sad: { type: Number, default: 0, min: 0 },
      angry: { type: Number, default: 0, min: 0 },
      dislike: { type: Number, default: 0, min: 0 },
    },
    userReactionsMap: { type: Map, of: String, default: () => new Map() },
    repliesCount: { type: Number, default: 0, min: 0 },
    viewsCount: { type: Number, default: 1, min: 0 },
    isPinned: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

threadSchema.index({ isPinned: -1, createdAt: -1 });
threadSchema.index({ category: 1, createdAt: -1 });
threadSchema.index({ userId: 1 });

export const ThreadModel = model<IThread>('Thread', threadSchema);
