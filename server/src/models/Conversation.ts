import { Schema, model, Document } from 'mongoose';

export interface IConversation extends Document {
  participants: Schema.Types.ObjectId[];
  participantKey: string; // Composite key like id1_id2 (sorted) to enforce uniqueness
  lastMessage?: {
    content: string;
    sender: Schema.Types.ObjectId;
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
      index: true,
    },
    lastMessage: {
      content: { type: String },
      sender: { type: Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now },
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

export const ConversationModel = model<IConversation>('Conversation', conversationSchema);
