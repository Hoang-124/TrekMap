/**
 * Pure Offline Mountain Safety Mathematics for Vietnam Alpine Trekking
 * Zero external dependencies — deterministic, 100% unit-testable, works completely offline.
 *
 * Includes:
 * 1. Environment Canada / US NWS Wind Chill & Cold Hypothermia Risk Classifier
 * 2. NOAA / NWS Rothfusz Heat Index & Heatstroke Risk Classifier
 * 3. Naismith-adapted Daylight Turnaround Time ("Giờ quay đầu") Calculator
 * 4. Pure 10-char Open Location Code (Google Plus Code, Apache 2.0 public spec) encoder
 */

export type ColdRiskLevel = 'normal' | 'chilly' | 'hypothermia_risk' | 'severe_frost';

export interface ColdRiskClassification {
  level: ColdRiskLevel;
  label: string;
  guidance: string;
  recommendedLayers: string;
}

export type HeatRiskLevel = 'normal' | 'caution' | 'heat_exhaustion' | 'heatstroke_danger';

export interface HeatRiskClassification {
  level: HeatRiskLevel;
  label: string;
  guidance: string;
  hydrationNote: string;
}

export interface TurnaroundTimeParams {
  /** Start time in minutes since 00:00 local time (e.g. 360 = 06:00). */
  startMinutes: number;
  /** Ascent horizontal distance in kilometers. */
  totalAscentKm: number;
  /** Cumulative elevation gain on ascent in meters. */
  ascentGainM: number;
  /** Descent horizontal distance in kilometers. */
  descentKm: number;
  /** Civil dusk time in minutes since 00:00 local time (e.g. 1080 = 18:00). */
  civilDuskMinutes: number;
  /** Safety buffer before civil dusk in minutes (default: 45). */
  safetyMarginMinutes?: number;
}

export interface TurnaroundTimeResult {
  turnaroundMinutes: number;
  turnaroundLabel: string;
  maxAscentHours: number;
  estimatedAscentMinutes: number;
  estimatedDescentMinutes: number;
  riskLevel: 'safe' | 'tight' | 'late';
}

function round1(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Formats minutes since 00:00 (0..1439) as "HH:mm".
 */
export function formatMinutesToHHMM(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes)) return '--:--';
  const wrapped = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hh = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Official Environment Canada / US National Weather Service Wind Chill formula (°C).
 * Applies when air temperature <= 10°C and wind speed >= 4.8 km/h; otherwise returns tempC.
 */
export function calculateWindChillC(tempC: number, windKmh: number): number {
  if (!Number.isFinite(tempC)) return 0;
  if (!Number.isFinite(windKmh) || tempC > 10 || windKmh < 4.8) {
    return round1(tempC);
  }
  const vPow = Math.pow(windKmh, 0.16);
  const windChill = 13.12 + 0.6215 * tempC - 11.37 * vPow + 0.3965 * tempC * vPow;
  return round1(windChill);
}

/**
 * Classifies alpine cold & hypothermia risk from feels-like temperature (°C)
 * with practical Vietnamese high-mountain guidance (Hoàng Liên Sơn, Tà Xùa, Kỳ Quan San).
 */
export function classifyColdRisk(feelsLikeC: number): ColdRiskClassification {
  const safeTemp = Number.isFinite(feelsLikeC) ? feelsLikeC : 20;

  if (safeTemp <= 0) {
    return {
      level: 'severe_frost',
      label: 'Nguy cơ băng giá & hạ thân nhiệt cấp',
      guidance:
        'Nhiệt cảm nhận dưới 0°C: sương muối và băng giá dễ đóng trên sống núi. Giữ khô cơ thể tuyệt đối, che kín đầu–cổ–bàn tay và tránh dừng lâu ngoài gió rít.',
      recommendedLayers: 'Áo giữ nhiệt base layer + fleece + lông vũ dày + áo gió chống nước + găng tay ấm',
    };
  }
  if (safeTemp <= 6) {
    return {
      level: 'hypothermia_risk',
      label: 'Nguy cơ hạ thân nhiệt',
      guidance:
        'Rét buốt sâu ở độ cao lớn — mất nhiệt rất nhanh nếu quần áo ẩm mồ hôi hoặc dính mưa phùn. Nghỉ ở hốc kín gió, uống nước ấm có đường và sẵn sàng quay đầu nếu thấy run lạnh kéo dài.',
      recommendedLayers: 'Áo giữ nhiệt + áo lông vũ / nỉ ấm + áo khoác cản gió + mũ len trùm tai',
    };
  }
  if (safeTemp <= 14) {
    return {
      level: 'chilly',
      label: 'Se lạnh núi cao',
      guidance:
        'Khá lạnh khi đứng yên săn mây sáng sớm hoặc chiều muộn. Tránh mặc áo cotton giữ ẩm và khoác thêm lớp cản gió ngay khi dừng chân nghỉ.',
      recommendedLayers: 'Áo nhanh khô + áo khoác gió nhẹ hoặc lớp giữ nhiệt mỏng',
    };
  }
  return {
    level: 'normal',
    label: 'Nền nhiệt dễ chịu',
    guidance:
      'Nhiệt độ ôn hòa, thuận lợi cho nhịp bước trekking. Vẫn nên cất sẵn một áo khoác gió mỏng trong balo đề phòng chuyển lạnh khi lên đỉnh.',
    recommendedLayers: 'Áo thấm hút mồ hôi nhanh khô + áo gió mỏng dự phòng',
  };
}

/**
 * Official NOAA / US NWS Rothfusz multiple-regression Heat Index formula (°C).
 * Applies when air temperature >= 27°C and relative humidity >= 40%; otherwise returns tempC.
 */
export function calculateHeatIndexC(tempC: number, humidityPct: number): number {
  if (!Number.isFinite(tempC)) return 0;
  if (!Number.isFinite(humidityPct)) return round1(tempC);
  const rh = clamp(humidityPct, 0, 100);
  if (tempC < 27 || rh < 40) {
    return round1(tempC);
  }

  const tF = (tempC * 9) / 5 + 32;
  let hiF =
    -42.379 +
    2.04901523 * tF +
    10.14333127 * rh -
    0.22475541 * tF * rh -
    6.83783e-3 * tF * tF -
    5.481717e-2 * rh * rh +
    1.22874e-3 * tF * tF * rh +
    8.5282e-4 * tF * rh * rh -
    1.99e-6 * tF * tF * rh * rh;

  // Official NWS high-humidity adjustment when 80°F <= T <= 87°F and RH > 85%
  if (rh > 85 && tF >= 80 && tF <= 87) {
    hiF += ((rh - 85) / 10) * ((87 - tF) / 5);
  }

  const hiC = ((hiF - 32) * 5) / 9;
  return round1(Math.max(tempC, hiC));
}

/**
 * Classifies tropical trekking heat stress risk from NOAA Heat Index (°C)
 * (especially relevant for coastal dunes & low-elevation summer trails like Mũi Đôi, Chứa Chan, Núi Dinh).
 */
export function classifyHeatRisk(heatIndexC: number): HeatRiskClassification {
  const safeHi = Number.isFinite(heatIndexC) ? heatIndexC : 24;

  if (safeHi >= 41) {
    return {
      level: 'heatstroke_danger',
      label: 'Nguy hiểm sốc nhiệt cấp',
      guidance:
        'Cực kỳ nguy hiểm (đồi cát Mũi Đôi, dốc trọc nắng gắt). Dừng di chuyển khung 11:00–15:00, trú bóng râm, thấm nước mát vùng cổ–nách–bẹn và sơ tán ngay nếu chóng mặt hoặc ngưng đổ mồ hôi.',
      hydrationNote: '800–1.000 ml nước pha điện giải mỗi giờ + nghỉ bắt buộc mỗi 20–30 phút',
    };
  }
  if (safeHi >= 32) {
    return {
      level: 'heat_exhaustion',
      label: 'Nguy cơ kiệt sức vì nóng',
      guidance:
        'Dễ chuột rút, đau đầu và tụt huyết áp khi leo dốc dài dưới trời oi bức. Chia nhỏ quãng nghỉ trong bóng râm, đội mũ rộng vành và bổ sung muối điện giải đều đặn.',
      hydrationNote: '600–800 ml nước điện giải mỗi giờ (nhấp từng ngụm nhỏ liên tục)',
    };
  }
  if (safeHi >= 27) {
    return {
      level: 'caution',
      label: 'Cần lưu ý nắng nóng',
      guidance:
        'Trời nóng ẩm — ưu tiên xuất phát sớm trước 06:00, mặc đồ sáng màu thoáng khí và theo dõi nhịp tim khi leo dốc gắt.',
      hydrationNote: '500–650 ml nước mỗi giờ kèm điện giải nhẹ',
    };
  }
  return {
    level: 'normal',
    label: 'Nhiệt ẩm an toàn',
    guidance:
      'Mức nhiệt ẩm dễ chịu, nguy cơ sốc nhiệt thấp. Duy trì uống nước đều theo nhịp di chuyển để giữ thể lực ổn định.',
    hydrationNote: '350–500 ml nước mỗi giờ vận động',
  };
}

/**
 * Calculates mandatory "Giờ quay đầu" (Turnaround Time) so trekkers descend safely
 * before civil dusk on Vietnamese mountain ridges (Hoàng Liên Sơn, Tà Xùa, Chư Yang Sin).
 *
 * Uses loaded Vietnam trail Naismith pace:
 * - Ascent: 4.0 km/h horizontal + 500 m/h elevation gain
 * - Descent: 3.5 km/h technical mountain descent + steep-knee buffer (gain / 1500 h)
 */
export function calculateTurnaroundTime(params: TurnaroundTimeParams): TurnaroundTimeResult {
  const safeStart = clamp(Number.isFinite(params.startMinutes) ? params.startMinutes : 360, 0, 1439);
  const safeDusk = clamp(Number.isFinite(params.civilDuskMinutes) ? params.civilDuskMinutes : 1080, 0, 1439);
  const safeMargin = Math.max(
    0,
    Number.isFinite(params.safetyMarginMinutes) ? Number(params.safetyMarginMinutes) : 45
  );
  const safeAscentKm = Math.max(0, Number.isFinite(params.totalAscentKm) ? params.totalAscentKm : 0);
  const safeGainM = Math.max(0, Number.isFinite(params.ascentGainM) ? params.ascentGainM : 0);
  const safeDescentKm = Math.max(0, Number.isFinite(params.descentKm) ? params.descentKm : 0);

  const estimatedAscentMinutes = Math.round((safeAscentKm / 4) * 60 + (safeGainM / 500) * 60);
  const estimatedDescentMinutes = Math.round((safeDescentKm / 3.5) * 60 + (safeGainM / 1500) * 60);

  const turnaroundRaw = safeDusk - safeMargin - estimatedDescentMinutes;
  const turnaroundMinutes = clamp(Math.round(turnaroundRaw), 0, 1439);
  const availableAscentMinutes = turnaroundRaw - safeStart;
  const maxAscentHours = Math.max(0, round1(availableAscentMinutes / 60));

  let riskLevel: 'safe' | 'tight' | 'late';
  if (availableAscentMinutes <= 0 || availableAscentMinutes < estimatedAscentMinutes * 0.9) {
    riskLevel = 'late';
  } else if (availableAscentMinutes < estimatedAscentMinutes * 1.2) {
    riskLevel = 'tight';
  } else {
    riskLevel = 'safe';
  }

  return {
    turnaroundMinutes,
    turnaroundLabel: formatMinutesToHHMM(turnaroundMinutes),
    maxAscentHours,
    estimatedAscentMinutes,
    estimatedDescentMinutes,
    riskLevel,
  };
}

// Official Open Location Code (Google Plus Code) Base-20 Alphabet (public domain / Apache 2.0 spec)
const OLC_ALPHABET = '23456789CFGHJMPQRVWX';
const OLC_BASE = 20;
const OLC_PAIR_PRECISION = 8000; // 20^3 -> 0.000125° (~13.9m x 13.9m grid)
const OLC_MAX_LAT_INT = 180 * OLC_PAIR_PRECISION - 1;
const OLC_MAX_LNG_INT = 360 * OLC_PAIR_PRECISION - 1;

/**
 * Pure 10-digit Open Location Code (Google Plus Code) encoder.
 * Produces an 11-character string with '+' at index 8 (e.g. "7PJ58Q3G+82" for Fansipan 22.3033, 103.7750).
 * 100% offline, GSM-7 ASCII safe for 2G mountain rescue SMS.
 */
export function encodePlusCode(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';

  // Clamp latitude to [-90, 90] and normalize longitude to [-180, 180)
  const clampedLat = clamp(lat, -90, 90);
  let normalizedLng = lng % 360;
  if (normalizedLng < -180) normalizedLng += 360;
  if (normalizedLng >= 180) normalizedLng -= 360;

  // Convert to integer grid units (1/8000 degree) to avoid floating-point rounding drift
  let latInt = Math.floor((clampedLat + 90) * OLC_PAIR_PRECISION + 1e-9);
  if (latInt > OLC_MAX_LAT_INT) latInt = OLC_MAX_LAT_INT;
  if (latInt < 0) latInt = 0;

  let lngInt = Math.floor((normalizedLng + 180) * OLC_PAIR_PRECISION + 1e-9);
  if (lngInt > OLC_MAX_LNG_INT) lngInt = OLC_MAX_LNG_INT;
  if (lngInt < 0) lngInt = 0;

  // Extract 5 base-20 digits for latitude and longitude (least significant to most significant)
  const chars: string[] = new Array<string>(10);
  for (let pairIdx = 4; pairIdx >= 0; pairIdx--) {
    const latDigit = latInt % OLC_BASE;
    const lngDigit = lngInt % OLC_BASE;
    latInt = Math.floor(latInt / OLC_BASE);
    lngInt = Math.floor(lngInt / OLC_BASE);
    chars[pairIdx * 2] = OLC_ALPHABET[latDigit];
    chars[pairIdx * 2 + 1] = OLC_ALPHABET[lngDigit];
  }

  return `${chars.slice(0, 8).join('')}+${chars.slice(8, 10).join('')}`;
}
