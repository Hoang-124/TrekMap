import { Schema, model, Document, Types } from 'mongoose';

export interface IConversation extends Document {
  participants: Types.ObjectId[];
  participantKey: string; // Composite key like id1_id2 (sorted) or trip_<tripId> for group chats
  isGroup: boolean;
  groupName?: string;
  tripPlanId?: Types.ObjectId;
  lastMessage?: {
    content: string;
    sender: Types.ObjectId;
    createdAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    participantKey: {
      type: String,
      required: true,
      unique: true,
    },
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupName: {
      type: String,
      trim: true,
      maxlength: 140,
      default: '',
    },
    tripPlanId: {
      type: Schema.Types.ObjectId,
      ref: 'TripPlan',
      index: true,
    },
    lastMessage: {
      type: {
        content: { type: String },
        sender: { type: Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date },
      },
      _id: false,
      default: undefined,
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, updatedAt: -1 });

export const ConversationModel = model<IConversation>('Conversation', conversationSchema);
