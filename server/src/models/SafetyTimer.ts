import { Schema, model, Document, Types } from 'mongoose';

export type SafetyTimerStatus = 'active' | 'checked_in_safe' | 'overdue_alerted' | 'cancelled';
export type SafetyTimerEmailStatus = 'none' | 'pending' | 'sent' | 'failed';

export interface ISafetyTimer extends Document {
  userId: Types.ObjectId;
  trailId?: Types.ObjectId;
  trailSlug?: string;
  trailName: string;
  startedAt: Date;
  expectedReturnAt: Date;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactEmail?: string;
  lastKnownLat?: number;
  lastKnownLng?: number;
  notes?: string;
  status: SafetyTimerStatus;
  checkedInSafeAt?: Date;
  alertedAt?: Date;
  emailAlertStatus?: SafetyTimerEmailStatus;
  emailRetryCount?: number;
  emailNextRetryAt?: Date | null;
  emailAlertSentAt?: Date | null;
  emailClaimedAt?: Date | null;
  emailLastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const safetyTimerSchema = new Schema<ISafetyTimer>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail', index: true },
    trailSlug: { type: String, trim: true, default: '' },
    trailName: { type: String, required: true, trim: true, maxlength: 180 },
    startedAt: { type: Date, default: Date.now },
    expectedReturnAt: { type: Date, required: true, index: true },
    emergencyContactName: { type: String, required: true, trim: true, maxlength: 120 },
    emergencyContactPhone: { type: String, required: true, trim: true, maxlength: 40 },
    emergencyContactEmail: { type: String, trim: true, lowercase: true, maxlength: 160, default: '' },
    lastKnownLat: { type: Number, min: -90, max: 90 },
    lastKnownLng: { type: Number, min: -180, max: 180 },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    status: {
      type: String,
      enum: ['active', 'checked_in_safe', 'overdue_alerted', 'cancelled'],
      default: 'active',
      index: true,
    },
    checkedInSafeAt: { type: Date },
    alertedAt: { type: Date },
    emailAlertStatus: {
      type: String,
      enum: ['none', 'pending', 'sent', 'failed'],
      default: 'pending',
    },
    emailRetryCount: { type: Number, default: 0, min: 0, max: 20 },
    emailNextRetryAt: { type: Date, default: null },
    emailAlertSentAt: { type: Date, default: null },
    emailClaimedAt: { type: Date, default: null },
    emailLastError: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true }
);

safetyTimerSchema.index({ status: 1, expectedReturnAt: 1 });
safetyTimerSchema.index({ status: 1, emailAlertStatus: 1, emailNextRetryAt: 1 });
safetyTimerSchema.index({ userId: 1, createdAt: -1 });
safetyTimerSchema.index({ createdAt: -1 });

export const SafetyTimerModel = model<ISafetyTimer>('SafetyTimer', safetyTimerSchema);
