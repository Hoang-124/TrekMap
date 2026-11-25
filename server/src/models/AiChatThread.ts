import { Schema, model, Document, Types } from 'mongoose';

export interface IAiChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  modelUsed?: 'gemini-live' | 'lost-knowledge-engine';
  actions?: any[];
  createdAt: Date;
}

export interface IAiChatThread extends Document {
  userId?: Types.ObjectId;
  sessionId?: string;
  isGuest: boolean;
  title: string;
  pinned: boolean;
  trailContextId?: string;
  trailContextName?: string;
  messages: IAiChatMessageItem[];
  messageCount: number;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const aiChatMessageSchema = new Schema<IAiChatMessageItem>(
  {
    id: { type: String, required: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    modelUsed: { type: String, enum: ['gemini-live', 'lost-knowledge-engine'] },
    actions: { type: [Schema.Types.Mixed], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const aiChatThreadSchema = new Schema<IAiChatThread>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
    sessionId: { type: String, trim: true, index: true, sparse: true },
    isGuest: { type: Boolean, default: false, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120, default: 'Hội thoại LOST AI mới' },
    pinned: { type: Boolean, default: false },
    trailContextId: { type: String, trim: true },
    trailContextName: { type: String, trim: true },
    messages: { type: [aiChatMessageSchema], default: [] },
    messageCount: { type: Number, default: 0, min: 0 },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

aiChatThreadSchema.index({ userId: 1, pinned: -1, lastMessageAt: -1 });
aiChatThreadSchema.index({ sessionId: 1, pinned: -1, lastMessageAt: -1 });
aiChatThreadSchema.index(
  { lastMessageAt: 1 },
  {
    name: 'guest_thread_ttl_30d',
    expireAfterSeconds: 30 * 24 * 60 * 60,
    partialFilterExpression: {
      isGuest: true,
    },
  }
);

export const AiChatThreadModel = model<IAiChatThread>('AiChatThread', aiChatThreadSchema);
