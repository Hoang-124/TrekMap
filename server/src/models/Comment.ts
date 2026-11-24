import { Schema, model, Document, Types } from 'mongoose';

export interface ICommentReactions {
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

export interface IComment extends Document {
  threadId: string;
  parentId?: string | null;
  authorName: string;
  authorAvatar: string;
  authorBadge?: string;
  userId?: Types.ObjectId;
  content: string;
  isBestAnswer?: boolean;
  reactions: ICommentReactions;
  userReactionsMap?: Map<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    threadId: { type: String, required: true },
    parentId: { type: String, default: null, index: true },
    authorName: { type: String, required: true },
    authorAvatar: { type: String, required: true },
    authorBadge: { type: String, default: 'Verified Trekker' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    content: { type: String, required: true },
    isBestAnswer: { type: Boolean, default: false },
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
  },
  { timestamps: true }
);

commentSchema.index({ threadId: 1, createdAt: 1 });

export const CommentModel = model<IComment>('Comment', commentSchema);
