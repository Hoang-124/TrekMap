import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { WeatherForecastModel } from '../models/WeatherForecast.js';
import { TrailModel } from '../models/Trail.js';
import { mockTrails } from '../data/seedData.js';
import { getLiveWeatherForecast, getSunriseSunsetData } from '../services/publicApis.service.js';

export const getWeatherByTrailId = async (req: Request, res: Response) => {
  try {
    const rawTrailId = req.params.trailId;
    const trailId = String(rawTrailId);
    const isMongoId = mongoose.Types.ObjectId.isValid(trailId);

    let trail: any = null;
    if (isMongoId) {
      trail = await TrailModel.findById(trailId).exec();
    }
    if (!trail) {
      trail = await TrailModel.findOne({ id: trailId }).exec();
    }
    if (!trail) {
      trail = mockTrails.find((t) => t.id === trailId || (t as any)._id === trailId || (t as any).slug === trailId);
    }

    const lat = Number(trail?.startLat) || 22.3364;
    const lng = Number(trail?.startLng) || 103.8438;

    // Fetch Public APIs concurrently: Open-Meteo & Sunrise-Sunset
    const [liveMeteo, astroData] = await Promise.all([
      getLiveWeatherForecast(lat, lng),
      getSunriseSunsetData(lat, lng),
    ]);

    let forecasts: any[] = [];

    // Parse Open-Meteo Live Data with accurate WMO Weather Code mapping
    if (liveMeteo && liveMeteo.daily && liveMeteo.daily.time) {
      const daily = liveMeteo.daily;
      const maxAlt = trail?.maxAltitudeM || 2000;

      forecasts = daily.time.map((timeStr: string, i: number) => {
        const code = daily.weathercode?.[i] ?? 0;
        const wind = Math.round(daily.windspeed_10m_max?.[i] ?? 10);
        const precip = daily.precipitation_sum?.[i] ?? 0;
        const humidity = daily.relative_humidity_2m_max?.[i] ?? 75;

        let condition: 'clear' | 'cloudy' | 'foggy' | 'rainy' | 'storm' = 'clear';

        if (code === 0) {
          condition = 'clear';
        } else if (code >= 1 && code <= 3) {
          condition = 'cloudy';
        } else if (code === 45 || code === 48) {
          condition = 'foggy';
        } else if (code >= 51 && code <= 81) {
          condition = 'rainy';
        } else if (code >= 82) {
          // Severe thunderstorm / heavy storm only if wind or precip is high
          if (wind >= 45 || precip >= 20) {
            condition = 'storm';
          } else {
            condition = 'rainy';
          }
        }

        const seaOfClouds = maxAlt >= 1800 ? Math.min(95, Math.round(humidity * 0.95)) : Math.round(humidity * 0.3);

        return {
          trailId: isMongoId ? new mongoose.Types.ObjectId(trailId) : trailId,
          forecastDate: timeStr,
          tempMinC: Math.round(daily.temperature_2m_min?.[i] ?? 12),
          tempMaxC: Math.round(daily.temperature_2m_max?.[i] ?? 20),
          humidityPercent: humidity,
          windSpeedKmH: wind,
          cloudCoverPercent: Math.round(precip > 0 ? 80 : code > 0 ? 45 : 15),
          seaOfCloudsIndex: seaOfClouds,
          weatherCondition: condition,
          precipMm: precip,
          wmoCode: code,
        };
      });
    } else {
      // Fallback
      try {
        forecasts = await WeatherForecastModel.find(
          isMongoId ? { trailId: new mongoose.Types.ObjectId(trailId) } : ({ trailId } as any)
        )
          .sort({ forecastDate: 1 })
          .exec();
      } catch (e) {
        forecasts = [];
      }

      if (!forecasts || forecasts.length === 0) {
        const today = new Date();
        for (let i = 0; i < 7; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() + i);
          forecasts.push({
            trailId: isMongoId ? new mongoose.Types.ObjectId(trailId) : trailId,
            forecastDate: d.toISOString().split('T')[0],
            tempMinC: 14 + i,
            tempMaxC: 22 + i,
            humidityPercent: 70 + i,
            windSpeedKmH: 12,
            cloudCoverPercent: 35,
            seaOfCloudsIndex: 75,
            weatherCondition: i === 0 ? 'clear' : 'cloudy',
          });
        }
      }
    }

    // Determine bad weather warning status (Only for true storms or severe cold/wind)
    const warningDetail = forecasts.find(
      (f: any) => f.weatherCondition === 'storm' || f.windSpeedKmH >= 55 || f.tempMinC <= 2
    );

    const hasWarning = !!warningDetail;

    return res.json({
      success: true,
      data: forecasts,
      astroData,
      elevationM: liveMeteo?.elevation || trail?.maxAltitudeM || 1400,
      source: liveMeteo ? 'Open-Meteo Live API + Sunrise-Sunset API' : 'Cached DB Fallback',
      hasWarning,
      warningMessage: hasWarning
        ? `⚠️ Cảnh báo thời tiết xấu vào ngày ${warningDetail?.forecastDate}: ${
            warningDetail?.weatherCondition === 'storm'
              ? 'Mưa bão giật mạnh'
              : warningDetail?.windSpeedKmH && warningDetail.windSpeedKmH >= 55
              ? `Gió núi mạnh ${warningDetail.windSpeedKmH} km/h`
              : `Nhiệt độ hạ rất thấp (${warningDetail?.tempMinC}°C)`
          }. Cân nhắc kiểm tra lại lịch trình!`
        : null,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Error fetching weather' });
  }
};
