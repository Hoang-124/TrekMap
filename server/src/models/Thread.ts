import { Schema, model, Document } from 'mongoose';

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
  userId?: Schema.Types.ObjectId;
  category: string;
  content: string;
  upvotes: number;
  reactions: IThreadReactions;
  userReactionsMap?: Record<string, string>;
  repliesCount: number;
  viewsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const threadSchema = new Schema<IThread>(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    authorName: { type: String, required: true },
    authorAvatar: { type: String, required: true },
    authorBadge: { type: String, default: 'Verified Trekker' },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    category: { type: String, default: 'Kinh Nghiệm', index: true },
    content: { type: String, required: true },
    upvotes: { type: Number, default: 0 },
    reactions: {
      like: { type: Number, default: 0 },
      love: { type: Number, default: 0 },
      haha: { type: Number, default: 0 },
      wow: { type: Number, default: 0 },
      buon: { type: Number, default: 0 },
      huhu: { type: Number, default: 0 },
      sad: { type: Number, default: 0 },
      angry: { type: Number, default: 0 },
      dislike: { type: Number, default: 0 },
    },
    userReactionsMap: { type: Map, of: String, default: {} },
    repliesCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const ThreadModel = model<IThread>('Thread', threadSchema);
