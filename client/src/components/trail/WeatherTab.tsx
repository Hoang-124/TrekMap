import React, { useEffect, useState } from 'react';
import type { Trail, WeatherForecastDay } from '../../types.js';
import { fetchWeatherForecast } from '../../services/api.js';

interface WeatherTabProps {
  trail: Trail;
}

export const WeatherTab: React.FC<WeatherTabProps> = ({ trail }) => {
  const [forecasts, setForecasts] = useState<WeatherForecastDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [astroData, setAstroData] = useState<any>(null);
  const [apiSource, setApiSource] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchWeatherForecast(trail.id).then((res) => {
      if (isMounted) {
        if (res.data) setForecasts(res.data);
        if (res.warningMessage) setWarningMessage(res.warningMessage);
        if (res.astroData) setAstroData(res.astroData);
        if (res.source) setApiSource(res.source);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [trail.id]);

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-dim)' }}>
        Đang cập nhật trạm dự báo thời tiết vùng núi...
      </div>
    );
  }

  const todayWeather = forecasts[0] || {
    forecastDate: new Date().toISOString().split('T')[0],
    tempMinC: 14,
    tempMaxC: 22,
    humidityPercent: 70,
    windSpeedKmH: 18,
    cloudCoverPercent: 35,
    seaOfCloudsIndex: 82,
    weatherCondition: 'clear',
  };

  const cloudIndex = todayWeather.seaOfCloudsIndex || (trail.maxAltitudeM >= 1800 ? 75 : 30);

  const getWeatherLabel = (cond: string) => {
    switch (cond) {
      case 'clear': return 'Nắng đẹp';
      case 'cloudy': return 'Nhiều mây';
      case 'foggy': return 'Sương mù';
      case 'rainy': return 'Mưa rào / Phùn';
      case 'storm': return 'Mưa dông giật';
      default: return 'Nắng nhẹ';
    }
  };

  const getTempColor = (temp: number) => {
    if (temp <= 15) return '#38bdf8'; // Cyan / Lạnh
    if (temp <= 22) return '#10b981'; // Emerald / Mát mẻ
    if (temp <= 27) return '#f59e0b'; // Amber / Ấm áp
    return '#ef4444'; // Red / Nắng nóng
  };

  const getWeatherBadgeStyle = (cond: string) => {
    switch (cond) {
      case 'clear':
        return { background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' };
      case 'cloudy':
        return { background: 'rgba(148, 163, 184, 0.12)', color: '#cbd5e1', border: '1px solid rgba(148, 163, 184, 0.3)' };
      case 'foggy':
        return { background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' };
      case 'rainy':
        return { background: 'rgba(6, 182, 212, 0.12)', color: '#22d3ee', border: '1px solid rgba(6, 182, 212, 0.3)' };
      case 'storm':
        return { background: 'rgba(239, 68, 68, 0.18)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)' };
      default:
        return { background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* P2-8: Bad Weather Warning Banner */}
      {warningMessage && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '2px solid var(--color-error)',
            padding: '16px 20px',
            borderRadius: 16,
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            animation: 'pulse 2s infinite',
          }}
        >
          <div>
            <strong style={{ fontSize: '1rem', color: 'var(--color-text-main)', display: 'block', marginBottom: 2 }}>
              CẢNH BÁO THỜI TIẾT NGUY HIỂM VÙNG NÚI
            </strong>
            <span style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>{warningMessage}</span>
          </div>
        </div>
      )}

      {/* Altitude Climate Context Note */}
      <div style={{ background: 'rgba(14, 215, 181, 0.08)', border: '1px solid rgba(14, 215, 181, 0.3)', padding: '10px 16px', borderRadius: 12, fontSize: '0.85rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span><strong>Đặc thù khí hậu núi cao ({trail.maxAltitudeM}m):</strong> Nhiệt độ tại đỉnh luôn thấp hơn khu vực TP/Đồng bằng <strong>8°C - 10°C</strong>. Hãy mang thêm áo ấm!</span>
        <span className="badge badge-stream" style={{ flexShrink: 0 }}>Trạm Open-Meteo GPS</span>
      </div>

      {/* Main Grid: 7-Day Forecast & Cloud Hunting Gauge */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* P2-6: 7-Day Weather Forecast */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 6 }}>
            Dự báo thời tiết 7 ngày vùng {trail.province}
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginBottom: 20 }}>
            Dữ liệu trích xuất từ trạm khí tượng thủy văn & mô phỏng độ cao {trail.maxAltitudeM}m.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
            {forecasts.map((f, index) => {
              const isToday = index === 0;
              const maxColor = getTempColor(f.tempMaxC);
              const minColor = '#38bdf8'; // Deep cool cyan for night minimums

              return (
                <div
                  key={f.forecastDate}
                  style={{
                    background: isToday ? 'rgba(14, 215, 181, 0.12)' : 'var(--color-bg-main)',
                    border: isToday ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                    borderRadius: 14,
                    padding: '14px 8px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isToday && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -9,
                        background: 'var(--color-primary)',
                        color: '#071319',
                        fontSize: '0.62rem',
                        fontWeight: 900,
                        padding: '2px 8px',
                        borderRadius: 10,
                        textTransform: 'uppercase',
                      }}
                    >
                      Hiện tại
                    </span>
                  )}

                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 2 }}>
                    {isToday ? 'Hôm nay' : `T${new Date(f.forecastDate).getDay() + 1 || 7}`}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', marginBottom: 10 }}>
                    {f.forecastDate.substring(5)}
                  </div>

                  {/* Weather Condition Colored Badge */}
                  <div
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '4px 6px',
                      borderRadius: 8,
                      marginBottom: 12,
                      width: '100%',
                      minHeight: 34,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      lineHeight: 1.25,
                      boxSizing: 'border-box',
                      ...getWeatherBadgeStyle(f.weatherCondition),
                    }}
                  >
                    {getWeatherLabel(f.weatherCondition)}
                  </div>

                  {/* Temperature Range with Distinct Colors */}
                  <div style={{ fontSize: '1.05rem', fontWeight: 900, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
                    <span style={{ color: maxColor, textShadow: `0 0 10px ${maxColor}33` }}>{f.tempMaxC}°</span>
                    <span style={{ fontSize: '0.75rem', color: minColor, fontWeight: 700, opacity: 0.9 }}>{f.tempMinC}°</span>
                  </div>

                  {/* Humidity Pill */}
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-sky)', marginTop: 8, background: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: 6 }}>
                    {f.humidityPercent}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* P2-7: Cloud Hunting Index (Chỉ số săn mây) */}
        <div>
          <div className="card" style={{ height: '100%', background: 'linear-gradient(135deg, rgba(14, 215, 181, 0.08) 0%, rgba(14, 165, 233, 0.05) 100%)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 6 }}>
              Chỉ số Săn Mây (Sea of Clouds)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginBottom: 18 }}>
              Tính toán dựa trên độ cao ({trail.maxAltitudeM}m), độ ẩm ({todayWeather.humidityPercent}%) và tốc độ gió.
            </p>

            <div>
              {/* Circular Meter Display */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '16px 0' }}>
                <div
                  style={{
                    width: 135,
                    height: 135,
                    borderRadius: '50%',
                    background: `conic-gradient(${
                      cloudIndex >= 60 ? 'var(--color-primary)' : cloudIndex >= 35 ? 'var(--color-sun)' : 'var(--color-error)'
                    } ${cloudIndex * 3.6}deg, var(--color-bg-main) 0deg)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 10,
                    boxShadow: '0 0 20px rgba(14, 215, 181, 0.25)',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: '#071319',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--color-text-main)' }}>{cloudIndex}%</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>Xác suất</span>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <span
                  className={`badge ${
                    cloudIndex >= 60 ? 'badge-stream' : cloudIndex >= 35 ? 'badge-sun' : 'badge-danger'
                  }`}
                  style={{ fontSize: '0.9rem', padding: '6px 14px' }}
                >
                  {cloudIndex >= 70 ? 'Biển mây cao' : cloudIndex >= 40 ? 'Tỷ lệ săn mây trung bình' : 'Mây thưa / Phủ sương'}
                </span>
              </div>

              <div style={{ background: 'var(--color-bg-main)', padding: 12, borderRadius: 10, fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.5, marginTop: 12 }}>
                <strong>Kinh nghiệm săn mây:</strong> Khung giờ lý tưởng nhất trên đỉnh {trail.name} là từ <strong>5:30 sáng - 7:00 sáng</strong> khi nhiệt độ đêm thấp và độ ẩm cao.
              </div>
            </div>

            {/* Sunrise & Sunset API Data Display */}
            {astroData && (
              <div style={{ marginTop: 16, background: 'var(--color-bg-main)', padding: 12, borderRadius: 12, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-sun)', fontWeight: 800, marginBottom: 8 }}>
                  Dữ Liệu Thiên Văn (Sunrise-Sunset API)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.8rem', color: 'var(--color-text-main)' }}>
                  <div>Mặt trời mọc: <strong style={{ color: '#fbbf24' }}>{astroData.sunrise || '05:30 SA'}</strong></div>
                  <div>Mặt trời lặn: <strong style={{ color: '#fb923c' }}>{astroData.sunset || '18:15 CH'}</strong></div>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)', marginTop: 6 }}>
                  Tổng thời gian ban ngày: {astroData.dayLengthHours || 12.8} giờ • Giờ Vàng (Golden Hour): <span style={{ color: '#fbbf24', fontWeight: 700 }}>{astroData.goldenHourMorning || '05:10 SA - 06:15 SA'}</span>
                </div>
              </div>
            )}

            {apiSource && (
              <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', textAlign: 'center', marginTop: 12 }}>
                Nguồn Public API: {apiSource}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
