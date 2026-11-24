import { Schema, model, Document, Types } from 'mongoose';

export interface IWeatherForecast extends Document {
  trailId: Types.ObjectId;
  forecastDate: string;
  tempMinC: number;
  tempMaxC: number;
  humidityPercent: number;
  windSpeedKmH: number;
  cloudCoverPercent: number;
  seaOfCloudsIndex: number;
  weatherCondition: 'clear' | 'cloudy' | 'foggy' | 'rainy' | 'storm';
  createdAt: Date;
  updatedAt: Date;
}

const weatherForecastSchema = new Schema<IWeatherForecast>(
  {
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail', required: true },
    forecastDate: { type: String, required: true },
    tempMinC: { type: Number, required: true },
    tempMaxC: { type: Number, required: true },
    humidityPercent: { type: Number, required: true, min: 0, max: 100 },
    windSpeedKmH: { type: Number, required: true, min: 0 },
    cloudCoverPercent: { type: Number, required: true, min: 0, max: 100 },
    seaOfCloudsIndex: { type: Number, required: true, min: 0, max: 100 },
    weatherCondition: { type: String, enum: ['clear', 'cloudy', 'foggy', 'rainy', 'storm'], default: 'clear' },
  },
  { timestamps: true }
);

weatherForecastSchema.index({ trailId: 1, forecastDate: 1 }, { unique: true });
// Automatic TTL cleanup of stale cached forecasts after 7 days
weatherForecastSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 * 7 });

export const WeatherForecastModel = model<IWeatherForecast>('WeatherForecast', weatherForecastSchema);
