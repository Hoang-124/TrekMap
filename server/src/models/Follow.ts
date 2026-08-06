import { Schema, model, Document } from 'mongoose';

export interface IFollow extends Document {
  followerId: Schema.Types.ObjectId;
  followingId: Schema.Types.ObjectId;
  createdAt: Date;
}

const followSchema = new Schema<IFollow>(
  {
    followerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    followingId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

export const FollowModel = model<IFollow>('Follow', followSchema);
