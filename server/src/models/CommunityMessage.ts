import mongoose, { Schema, Document } from 'mongoose';

export interface ICommunityMessage extends Document {
  senderId?: mongoose.Types.ObjectId;
  senderName: string;
  senderAvatar: string;
  senderBadge?: string;
  nameColor?: string;
  text: string;
  quote?: {
    author: string;
    text: string;
  };
  createdAt: Date;
}

const CommunityMessageSchema = new Schema<ICommunityMessage>(
  {
    senderId: { type: Schema.Types.ObjectId, ref: 'User' },
    senderName: { type: String, required: true },
    senderAvatar: { type: String, required: true },
    senderBadge: { type: String, default: 'Trekker' },
    nameColor: { type: String, default: 'var(--color-primary)' },
    text: { type: String, required: true },
    quote: {
      type: {
        author: { type: String, required: true },
        text: { type: String, required: true },
      },
      _id: false,
      required: false,
      default: undefined,
    },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

CommunityMessageSchema.index({ createdAt: -1 });

export const CommunityMessageModel = mongoose.model<ICommunityMessage>(
  'CommunityMessage',
  CommunityMessageSchema
);
