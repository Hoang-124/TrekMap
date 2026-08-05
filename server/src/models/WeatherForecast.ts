import { Schema, model, Document } from 'mongoose';

export interface IWeatherForecast extends Document {
  trailId: Schema.Types.ObjectId;
  forecastDate: string;
  tempMinC: number;
  tempMaxC: number;
  humidityPercent: number;
  windSpeedKmH: number;
  cloudCoverPercent: number;
  seaOfCloudsIndex: number;
  weatherCondition: 'clear' | 'cloudy' | 'foggy' | 'rainy' | 'storm';
  updatedAt: Date;
}

const weatherForecastSchema = new Schema<IWeatherForecast>(
  {
    trailId: { type: Schema.Types.ObjectId, ref: 'Trail', required: true, index: true },
    forecastDate: { type: String, required: true },
    tempMinC: { type: Number, required: true },
    tempMaxC: { type: Number, required: true },
    humidityPercent: { type: Number, required: true },
    windSpeedKmH: { type: Number, required: true },
    cloudCoverPercent: { type: Number, required: true },
    seaOfCloudsIndex: { type: Number, required: true },
    weatherCondition: { type: String, enum: ['clear', 'cloudy', 'foggy', 'rainy', 'storm'], default: 'clear' },
  },
  { timestamps: true }
);

weatherForecastSchema.index({ trailId: 1, forecastDate: 1 }, { unique: true });

export const WeatherForecastModel = model<IWeatherForecast>('WeatherForecast', weatherForecastSchema);
