import { Schema, model, Document } from 'mongoose';

export interface IAuditLog extends Document {
  userId: Schema.Types.ObjectId;
  action: string;
  targetCollection: string;
  details: string;
  ipAddress: string;
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

export const AuditLogModel = model<IAuditLog>('AuditLog', auditLogSchema);
