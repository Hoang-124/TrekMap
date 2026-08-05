import { Schema, model, Document } from 'mongoose';

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
  parentId?: string; // If present, points to parent comment _id for nested replies
  authorName: string;
  authorAvatar: string;
  authorBadge?: string;
  userId?: Schema.Types.ObjectId;
  content: string;
  reactions: ICommentReactions;
  userReactionsMap?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    threadId: { type: String, required: true, index: true },
    parentId: { type: String, default: null, index: true },
    authorName: { type: String, required: true },
    authorAvatar: { type: String, required: true },
    authorBadge: { type: String, default: 'Verified Trekker' },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    content: { type: String, required: true },
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
  },
  { timestamps: true }
);

export const CommentModel = model<IComment>('Comment', commentSchema);
