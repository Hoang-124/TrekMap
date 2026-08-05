import { Schema, model, Document } from 'mongoose';

export interface IIncident extends Document {
  trailId: Schema.Types.ObjectId;
  trailName: string;
  severity: 'high' | 'medium' | 'low';
  type: 'landslide' | 'flash_flood' | 'lost' | 'bad_weather';
  description: string;
  reportedBy?: Schema.Types.ObjectId;
  reportedAt: string;
  active: boolean;
  createdAt: Date;
}

const incidentSchema = new Schema<IIncident>(
  {
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail', required: true, index: true },
    trailName: { type: String, required: true },
    severity: { type: String, enum: ['high', 'medium', 'low'], default: 'high' },
    type: { type: String, enum: ['landslide', 'flash_flood', 'lost', 'bad_weather'], required: true },
    description: { type: String, required: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reportedAt: { type: String, required: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

incidentSchema.index({ active: 1, createdAt: -1 });

export const IncidentModel = model<IIncident>('Incident', incidentSchema);
