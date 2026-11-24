import mongoose, { Schema, Document } from 'mongoose';

export interface ICommunityMessage extends Document {
  senderId?: mongoose.Types.ObjectId;
  senderName: string;
  senderAvatar: string;
  senderBadge?: string;
  nameColor?: string;
  channel?: string;
  gpsLat?: number;
  gpsLng?: number;
  altitudeM?: number;
  text: string;
  quote?: {
    author: string;
    text: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const CommunityMessageSchema = new Schema<ICommunityMessage>(
  {
    senderId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    senderName: { type: String, required: true },
    senderAvatar: { type: String, required: true },
    senderBadge: { type: String, default: 'Trekker' },
    nameColor: { type: String, default: '' },
    channel: { type: String, default: 'general', index: true },
    gpsLat: { type: Number },
    gpsLng: { type: Number },
    altitudeM: { type: Number },
    text: { type: String, required: true, maxlength: 1000 },
    quote: {
      type: {
        author: { type: String, required: true, maxlength: 120 },
        text: { type: String, required: true, maxlength: 500 },
      },
      _id: false,
      required: false,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

CommunityMessageSchema.index({ createdAt: -1 });
CommunityMessageSchema.index({ channel: 1, createdAt: -1 });

export const CommunityMessageModel = mongoose.model<ICommunityMessage>(
  'CommunityMessage',
  CommunityMessageSchema
);
