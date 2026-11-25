import { Schema, model, Document, Types } from 'mongoose';

export type WeatherAlertVerdict = 'GO' | 'CAUTION' | 'NO_GO';

export interface IWeatherAlertSub extends Document {
  userId: Types.ObjectId;
  trailId: string;
  trailName: string;
  province: string;
  maxAltitudeM: number;
  targetDate?: string | null;
  minSeaOfCloudsPct: number;
  maxRainMm: number;
  maxWindKmh: number;
  alertOnNoGo: boolean;
  isActive: boolean;
  lastEvaluatedAt?: Date | null;
  lastNotifiedAt?: Date | null;
  lastSafetyNotifiedAt?: Date | null;
  lastCloudNotifiedAt?: Date | null;
  lastVerdict?: WeatherAlertVerdict | null;
  lastSeaOfCloudsPct?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const weatherAlertSubSchema = new Schema<IWeatherAlertSub>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    trailId: { type: String, required: true, trim: true, maxlength: 80 },
    trailName: { type: String, required: true, trim: true, maxlength: 160 },
    province: { type: String, trim: true, maxlength: 100, default: '' },
    maxAltitudeM: { type: Number, min: 0, max: 9000, default: 0 },
    targetDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },
    minSeaOfCloudsPct: { type: Number, min: 30, max: 95, default: 70 },
    maxRainMm: { type: Number, min: 0, max: 100, default: 10 },
    maxWindKmh: { type: Number, min: 10, max: 100, default: 40 },
    alertOnNoGo: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    lastEvaluatedAt: { type: Date, default: null },
    lastNotifiedAt: { type: Date, default: null },
    lastSafetyNotifiedAt: { type: Date, default: null },
    lastCloudNotifiedAt: { type: Date, default: null },
    lastVerdict: { type: String, enum: ['GO', 'CAUTION', 'NO_GO'], default: null },
    lastSeaOfCloudsPct: { type: Number, min: 0, max: 100, default: null },
  },
  { timestamps: true }
);

weatherAlertSubSchema.index({ userId: 1, trailId: 1 }, { unique: true });
weatherAlertSubSchema.index({ userId: 1, isActive: 1, updatedAt: -1 });
weatherAlertSubSchema.index({ isActive: 1, lastEvaluatedAt: 1, updatedAt: 1 });

export const WeatherAlertSubModel = model<IWeatherAlertSub>('WeatherAlertSub', weatherAlertSubSchema);
