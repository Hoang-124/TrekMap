import React, { useEffect, useState } from 'react';
import type { Trail, WeatherForecastDay } from '../../types.js';
import { fetchWeatherForecast } from '../../services/api.js';

interface WeatherTabProps {
  trail: Trail;
}

interface AstroSnapshot {
  sunrise?: string;
  sunset?: string;
  dayLengthHours?: string | number;
  goldenHourMorning?: string;
}

function computeWindChillC(tempC: number, windKmH: number): number {
  if (tempC <= 10 && windKmH >= 4.8) {
    const wc =
      13.12 +
      0.6215 * tempC -
      11.37 * Math.pow(windKmH, 0.16) +
      0.3965 * tempC * Math.pow(windKmH, 0.16);
    return Math.round(wc * 10) / 10;
  }
  return Math.round(tempC * 10) / 10;
}

function formatVnShortDate(isoDate: string): string {
  const parts = String(isoDate || '').split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return isoDate;
}

export const WeatherTab: React.FC<WeatherTabProps> = ({ trail }) => {
  const [forecasts, setForecasts] = useState<WeatherForecastDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [astroData, setAstroData] = useState<AstroSnapshot | null>(null);
  const [gridElevationM, setGridElevationM] = useState<number | null>(null);
  const [apiSource, setApiSource] = useState<string>('');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const loadWeather = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetchWeatherForecast(trail.id, controller.signal);
        if (!isMounted || controller.signal.aborted) return;
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setForecasts(res.data);
          setWarningMessage(res.warningMessage || null);
          setAstroData(res.astroData || null);
          setGridElevationM(
            typeof res.elevationM === 'number' && Number.isFinite(res.elevationM) ? Math.round(res.elevationM) : null
          );
          setApiSource(res.source || '');
        } else {
          setForecasts([]);
          setWarningMessage(null);
          setAstroData(null);
          setGridElevationM(null);
          setApiSource('');
          setErrorMessage(res.error || 'Chưa có dữ liệu dự báo thời tiết thực tế từ trạm Open-Meteo.');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (isMounted) {
          setForecasts([]);
          setErrorMessage('Không thể kết nối máy chủ thời tiết. Vui lòng thử lại sau.');
        }
      } finally {
        if (isMounted && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadWeather();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [trail.id, reloadTick]);

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-dim)' }}>
        Đang cập nhật trạm dự báo thời tiết vùng núi...
      </div>
    );
  }

  if (forecasts.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
          Không thể tải dữ liệu thời tiết vùng núi
        </div>
        <div style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', maxWidth: 460 }}>
          {errorMessage || 'Trạm dự báo Open-Meteo hiện tạm thời không phản hồi. Vui lòng thử lại sau ít phút.'}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setReloadTick((prev) => prev + 1)}
          style={{ padding: '8px 18px', borderRadius: 4, fontSize: '0.84rem', fontWeight: 700 }}
        >
          Thử tải lại dữ liệu thực tế
        </button>
      </div>
    );
  }

  const todayWeather = forecasts[0];
  const cloudIndex = todayWeather.seaOfCloudsIndex ?? 0;
  const WEEKDAYS_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  // Residual alpine lapse rate from Open-Meteo DEM grid elevation up to actual trail summit (-6.5°C / 1,000m)
  const summitAltitudeM = Math.max(0, Number(trail.maxAltitudeM) || 0);
  const effectiveGridElevM =
    gridElevationM !== null && gridElevationM > 0 ? Math.min(gridElevationM, summitAltitudeM) : Math.round(summitAltitudeM * 0.72);
  const residualAltitudeM = Math.max(0, summitAltitudeM - effectiveGridElevM);
  const residualDropC = Math.round(((residualAltitudeM / 1000) * 6.5) * 10) / 10;

  const estSummitMinC = Math.round((todayWeather.tempMinC - residualDropC) * 10) / 10;
  const estSummitMaxC = Math.round((todayWeather.tempMaxC - residualDropC) * 10) / 10;
  const estNightWindChillC = computeWindChillC(estSummitMinC, todayWeather.windSpeedKmH || 10);
  const isHighCloudPeak = summitAltitudeM >= 1200;

  const altitudeClimateAdvice =
    summitAltitudeM >= 2200
      ? 'Đêm và rạng sáng trên đỉnh rất lạnh kèm gió mạnh — bắt buộc mang áo lông vũ giữ nhiệt, áo gió chống thấm và túi ngủ âm độ.'
      : summitAltitudeM >= 1200
      ? 'Chênh lệch nhiệt ngày/đêm rõ rệt — nên mang thêm 1 lớp áo giữ nhiệt nhẹ và áo gió khi hạ trại hoặc nghỉ trên đỉnh.'
      : 'Địa hình rừng núi thấp (<1.200m) — ưu tiên trang phục thoáng khí, chống nắng, chống vắt/côn trùng và bù đủ điện giải.';

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
    if (temp <= 15) return 'var(--color-sky)';
    if (temp <= 22) return 'var(--color-primary)';
    if (temp <= 27) return 'var(--color-sun)';
    return 'var(--color-error)';
  };

  const getWeatherBadgeStyle = (cond: string): React.CSSProperties => {
    switch (cond) {
      case 'clear':
        return {
          background: 'color-mix(in srgb, var(--color-sun) 14%, transparent)',
          color: 'var(--color-sun)',
          border: '1px solid color-mix(in srgb, var(--color-sun) 35%, transparent)',
        };
      case 'cloudy':
        return {
          background: 'color-mix(in srgb, var(--color-text-muted) 14%, transparent)',
          color: 'var(--color-text-muted)',
          border: '1px solid color-mix(in srgb, var(--color-text-muted) 30%, transparent)',
        };
      case 'foggy':
        return {
          background: 'color-mix(in srgb, var(--color-sky) 14%, transparent)',
          color: 'var(--color-sky)',
          border: '1px solid color-mix(in srgb, var(--color-sky) 35%, transparent)',
        };
      case 'rainy':
        return {
          background: 'color-mix(in srgb, var(--color-stream) 14%, transparent)',
          color: 'var(--color-stream)',
          border: '1px solid color-mix(in srgb, var(--color-stream) 35%, transparent)',
        };
      case 'storm':
        return {
          background: 'color-mix(in srgb, var(--color-error) 16%, transparent)',
          color: 'var(--color-error-text, var(--color-error))',
          border: '1px solid color-mix(in srgb, var(--color-error) 42%, transparent)',
        };
      default:
        return {
          background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
          color: 'var(--color-primary)',
          border: '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)',
        };
    }
  };

  const cloudStrokeRadius = 54;
  const cloudCirc = 2 * Math.PI * cloudStrokeRadius;
  const cloudDashOffset = cloudCirc * (1 - Math.max(0, Math.min(100, cloudIndex)) / 100);
  const cloudAccent = cloudIndex >= 60 ? 'var(--color-primary)' : cloudIndex >= 35 ? 'var(--color-sun)' : 'var(--color-error)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Bad Weather Warning Banner */}
      {warningMessage && (
        <div
          style={{
            background: 'var(--banner-danger-bg)',
            border: '1px solid var(--banner-danger-border)',
            borderLeft: '3px solid var(--color-error)',
            padding: '14px 18px',
            borderRadius: 4,
            color: 'var(--banner-danger-text)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div>
            <strong style={{ fontSize: '0.86rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-error-text, var(--color-error))', display: 'block', marginBottom: 3 }}>
              Cảnh báo thời tiết nguy hiểm vùng núi
            </strong>
            <span style={{ fontSize: '0.88rem', lineHeight: 1.55 }}>{warningMessage}</span>
          </div>
        </div>
      )}

      {/* Altitude-Aware Residual Lapse Rate & Wind-Chill Telemetry Banner */}
      <div
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderLeft: '3px solid var(--color-primary)',
          padding: '14px 16px',
          borderRadius: 4,
          fontSize: '0.84rem',
          color: 'var(--color-text-muted)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--color-text-main)' }}>
              Hiệu chỉnh thực địa từ lưới DEM ({effectiveGridElevM.toLocaleString('vi-VN')}m) lên đỉnh ({summitAltitudeM.toLocaleString('vi-VN')}m):
            </strong>{' '}
            Chênh cao dư <strong style={{ color: 'var(--color-sky)' }}>+{residualAltitudeM.toLocaleString('vi-VN')}m</strong> → giảm thêm{' '}
            <strong style={{ color: 'var(--color-primary)' }}>-{residualDropC}°C</strong> (-6,5°C/1.000m). {altitudeClimateAdvice}
          </span>
          <span className="badge badge-stream" style={{ flexShrink: 0 }}>Open-Meteo GPS</span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))',
            gap: 8,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <div style={{ padding: '8px 10px', borderRadius: 4, background: 'var(--color-bg-main)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
              Nhiệt độ trên đỉnh hôm nay
            </div>
            <strong style={{ fontSize: '0.96rem', color: 'var(--color-text-main)' }}>
              {estSummitMinC}°C – {estSummitMaxC}°C
            </strong>
          </div>
          <div style={{ padding: '8px 10px', borderRadius: 4, background: 'var(--color-bg-main)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
              Cảm nhận gió rét đêm (NWS)
            </div>
            <strong style={{ fontSize: '0.96rem', color: 'var(--color-sky)' }}>
              ~{estNightWindChillC}°C
            </strong>
          </div>
          <div style={{ padding: '8px 10px', borderRadius: 4, background: 'var(--color-bg-main)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
              Gió tối đa hôm nay
            </div>
            <strong style={{ fontSize: '0.96rem', color: todayWeather.windSpeedKmH >= 35 ? 'var(--color-error-text, var(--color-error))' : 'var(--color-earth)' }}>
              {todayWeather.windSpeedKmH} km/h
            </strong>
          </div>
        </div>
      </div>

      {/* Main Grid: 7-Day Forecast & Cloud / Dawn Gauge */}
      <div className="detail-split-grid">
        {/* 7-Day Weather Forecast (Mobile-Responsive Grid) */}
        <div className="card">
          <div className="section-eyebrow" style={{ marginBottom: 6 }}>Khí tượng 7 ngày</div>
          <h3 className="font-editorial" style={{ fontSize: '1.45rem', fontWeight: 500, color: 'var(--color-text-main)', marginBottom: 6 }}>
            Dự báo thời tiết vùng {trail.province}
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginBottom: 20 }}>
            Nhiệt độ đã hiệu chỉnh lên đỉnh {summitAltitudeM.toLocaleString('vi-VN')}m (-{residualDropC}°C từ trạm lưới Open-Meteo {effectiveGridElevM.toLocaleString('vi-VN')}m).
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))',
              gap: 8,
            }}
          >
            {forecasts.map((f, index) => {
              const isToday = index === 0;
              const adjMax = Math.round(f.tempMaxC - residualDropC);
              const adjMin = Math.round(f.tempMinC - residualDropC);
              const maxColor = getTempColor(adjMax);
              const minColor = 'var(--color-sky)';
              const dayIdx = new Date(`${f.forecastDate}T12:00:00+07:00`).getDay();
              const weekdayLabel = isToday ? 'Hôm nay' : WEEKDAYS_VI[dayIdx] || 'T2';

              return (
                <div
                  key={f.forecastDate}
                  style={{
                    background: isToday ? 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-main))' : 'var(--color-bg-main)',
                    border: isToday ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                    borderRadius: 4,
                    padding: '14px 8px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative',
                    transition: 'border-color 0.18s ease',
                  }}
                >
                  {isToday && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -9,
                        background: 'var(--color-primary)',
                        color: 'var(--color-on-primary)',
                        fontSize: '0.6rem',
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        padding: '2px 7px',
                        borderRadius: 2,
                        textTransform: 'uppercase',
                      }}
                    >
                      Hiện tại
                    </span>
                  )}

                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 2 }}>
                    {weekdayLabel}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', marginBottom: 10, fontVariantNumeric: 'tabular-nums' }}>
                    {formatVnShortDate(f.forecastDate)}
                  </div>

                  {/* Weather Condition Colored Badge */}
                  <div
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '4px 6px',
                      borderRadius: 3,
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

                  {/* Summit-Adjusted Temperature Range */}
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: maxColor }}>{adjMax}°</span>
                    <span style={{ fontSize: '0.75rem', color: minColor, fontWeight: 600 }}>{adjMin}°</span>
                  </div>

                  {/* Humidity Pill */}
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-sky)', marginTop: 8, background: 'color-mix(in srgb, var(--color-sky) 11%, transparent)', padding: '2px 7px', borderRadius: 3, fontVariantNumeric: 'tabular-nums' }}>
                    {f.humidityPercent}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cloud Hunting / Dawn Visibility Pure-SVG Gauge */}
        <div>
          <div className="card" style={{ height: '100%' }}>
            <div className="section-eyebrow" style={{ marginBottom: 6 }}>
              {isHighCloudPeak ? 'Chỉ báo bình minh núi cao' : 'Điều kiện quang mây sáng sớm'}
            </div>
            <h3 className="font-editorial" style={{ fontSize: '1.4rem', fontWeight: 500, color: 'var(--color-text-main)', marginBottom: 6 }}>
              {isHighCloudPeak ? 'Chỉ số Săn Mây' : 'Độ Ẩm & Quang Mây Bình Minh'}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginBottom: 18 }}>
              {isHighCloudPeak
                ? `Tính toán theo cao độ (${summitAltitudeM.toLocaleString('vi-VN')}m), độ ẩm (${todayWeather.humidityPercent}%) và gió đỉnh (${todayWeather.windSpeedKmH} km/h).`
                : `Địa hình độ cao ${summitAltitudeM.toLocaleString('vi-VN')}m (<1.200m) hiếm biển mây nghịch nhiệt; độ ẩm ${todayWeather.humidityPercent}%, gió ${todayWeather.windSpeedKmH} km/h.`}
            </p>

            <div>
              {/* Pure Inline SVG Circular Ring Meter */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '14px 0' }}>
                <svg
                  width="136"
                  height="136"
                  viewBox="0 0 136 136"
                  role="img"
                  aria-label={`Chỉ số ${cloudIndex}%`}
                >
                  <circle
                    cx="68"
                    cy="68"
                    r={cloudStrokeRadius}
                    fill="none"
                    stroke="var(--color-surface-elevated)"
                    strokeWidth="9"
                  />
                  <circle
                    cx="68"
                    cy="68"
                    r={cloudStrokeRadius}
                    fill="none"
                    stroke={cloudAccent}
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={cloudCirc}
                    strokeDashoffset={cloudDashOffset}
                    transform="rotate(-90 68 68)"
                  />
                  <text
                    x="68"
                    y="66"
                    textAnchor="middle"
                    fill="var(--color-text-main)"
                    fontSize="26"
                    fontWeight="800"
                    style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-family)' }}
                  >
                    {cloudIndex}%
                  </text>
                  <text
                    x="68"
                    y="86"
                    textAnchor="middle"
                    fill="var(--color-text-dim)"
                    fontSize="10"
                    fontWeight="700"
                    letterSpacing="1.2"
                    style={{ textTransform: 'uppercase', fontFamily: 'var(--font-family)' }}
                  >
                    {isHighCloudPeak ? 'XÁC SUẤT' : 'ĐỘ ẨM MÂY'}
                  </text>
                </svg>
              </div>

              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <span
                  className={`badge ${
                    cloudIndex >= 60 ? 'badge-stream' : cloudIndex >= 35 ? 'badge-sun' : 'badge-error'
                  }`}
                  style={{ fontSize: '0.76rem', padding: '5px 12px' }}
                >
                  {isHighCloudPeak
                    ? cloudIndex >= 70
                      ? 'Biển mây cao'
                      : cloudIndex >= 40
                      ? 'Tỷ lệ săn mây trung bình'
                      : 'Mây thưa / Phủ sương'
                    : todayWeather.weatherCondition === 'clear' || todayWeather.weatherCondition === 'cloudy'
                    ? 'Sáng sớm mát mẻ, dễ di chuyển'
                    : 'Độ ẩm cao / Có mưa rừng'}
                </span>
              </div>

              <div style={{ background: 'var(--color-bg-main)', padding: 12, borderRadius: 4, border: '1px solid var(--color-border)', fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.55, marginTop: 12 }}>
                {isHighCloudPeak ? (
                  <>
                    <strong style={{ color: 'var(--color-text-main)' }}>Kinh nghiệm săn mây:</strong> Khung giờ lý tưởng nhất trên đỉnh {trail.name} là từ <strong style={{ color: 'var(--color-text-main)' }}>05:30 – 07:00</strong> khi nhiệt độ đêm thấp và độ ẩm thung lũng cao.
                  </>
                ) : (
                  <>
                    <strong style={{ color: 'var(--color-text-main)' }}>Kinh nghiệm xuất phát:</strong> Với cung {trail.name} ({summitAltitudeM}m), nên khởi hành sớm từ <strong style={{ color: 'var(--color-text-main)' }}>06:00 – 07:30</strong> để tránh nắng gắt buổi trưa và dông nhiệt buổi chiều.
                  </>
                )}
              </div>
            </div>

            {/* Sunrise & Sunset API Data Display */}
            {astroData && astroData.sunrise && astroData.sunset && (
              <div style={{ marginTop: 16, background: 'var(--color-bg-main)', padding: 12, borderRadius: 4, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-sun)', fontWeight: 700, marginBottom: 8 }}>
                  Dữ Liệu Thiên Văn
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.8rem', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>
                  <div>Bình minh: <strong style={{ color: 'var(--color-sun)' }}>{astroData.sunrise}</strong></div>
                  <div>Hoàng hôn: <strong style={{ color: 'var(--color-earth)' }}>{astroData.sunset}</strong></div>
                </div>
                {(astroData.dayLengthHours || astroData.goldenHourMorning) && (
                  <div style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)', marginTop: 6 }}>
                    {astroData.dayLengthHours ? `Thời lượng ngày: ${astroData.dayLengthHours} giờ` : ''}
                    {astroData.dayLengthHours && astroData.goldenHourMorning ? ' · ' : ''}
                    {astroData.goldenHourMorning ? (
                      <>Giờ Vàng: <span style={{ color: 'var(--color-sun)', fontWeight: 700 }}>{astroData.goldenHourMorning}</span></>
                    ) : null}
                  </div>
                )}
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
