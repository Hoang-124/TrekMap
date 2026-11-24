import { Schema, model, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  userId?: Types.ObjectId;
  action: string;
  targetCollection: string;
  details: string;
  ipAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    targetCollection: { type: String, required: true },
    details: { type: String, default: '' },
    ipAddress: { type: String, default: '127.0.0.1' },
  },
  { timestamps: true }
);

auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ targetCollection: 1, createdAt: -1 });
// Retain audit logs for 180 days automatically
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 * 180 });

export const AuditLogModel = model<IAuditLog>('AuditLog', auditLogSchema);
