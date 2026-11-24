export type IceBloodType =
  | 'O+'
  | 'O-'
  | 'A+'
  | 'A-'
  | 'B+'
  | 'B-'
  | 'AB+'
  | 'AB-'
  | 'Chưa rõ';

export const ICE_BLOOD_TYPES: ReadonlyArray<IceBloodType> = [
  'O+',
  'O-',
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'Chưa rõ',
];

export type IceLockscreenTheme = 'dark' | 'light';

export interface IceEmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface IceCardProfile {
  fullName: string;
  birthYear: string;
  bloodType: IceBloodType;
  allergies: string;
  medicalConditions: string;
  contact1: IceEmergencyContact;
  contact2: IceEmergencyContact;
  plannedPeak: string;
  rangerStationName: string;
  rangerHotline: string;
  returnDeadline: string;
}

export interface IceLockscreenRenderInput {
  profile: IceCardProfile;
  theme: IceLockscreenTheme;
  generatedDateLabel?: string;
}

export interface IceLockscreenRenderResult {
  blob: Blob;
  width: number;
  height: number;
  fileName: string;
  truncatedFields: string[];
}

export type AmsRiskLevel = 'none' | 'mild' | 'moderate' | 'high';

export interface AltitudePhysicsMetrics {
  altitudeM: number;
  seaLevelTempC: number;
  tempLapseDropC: number;
  summitTempC: number;
  pressureHpa: number;
  pressurePctSeaLevel: number;
  oxygenPctSeaLevel: number;
  boilingPointC: number;
  recommendedBoilMinutes: number;
  cookingTimeFactor: number;
  amsRiskLevel: AmsRiskLevel;
  amsLabel: string;
  amsGuidance: string;
  cookingGuidance: string;
}

export interface AltitudeBenchmark {
  id: string;
  label: string;
  altitudeM: number;
}

export const ICE_CARD_STORAGE_KEY = 'lost_ice_card_profile_v1';

export const DEFAULT_ICE_CARD_PROFILE: IceCardProfile = {
  fullName: '',
  birthYear: '',
  bloodType: 'Chưa rõ',
  allergies: '',
  medicalConditions: '',
  contact1: {
    name: '',
    relation: '',
    phone: '',
  },
  contact2: {
    name: '',
    relation: '',
    phone: '',
  },
  plannedPeak: '',
  rangerStationName: '',
  rangerHotline: '',
  returnDeadline: '',
};

export const ISA_VIETNAM_BENCHMARKS: ReadonlyArray<AltitudeBenchmark> = [
  { id: 'sea-level', label: 'Mực nước biển', altitudeM: 0 },
  { id: 'bach-ma', label: 'Đỉnh Bạch Mã', altitudeM: 1450 },
  { id: 'langbiang', label: 'Đỉnh Langbiang', altitudeM: 2167 },
  { id: 'camp-2800', label: 'Lán 2.800m Hoàng Liên', altitudeM: 2800 },
  { id: 'fansipan', label: 'Đỉnh Fansipan', altitudeM: 3143 },
];

interface IceCanvasPalette {
  bgMain: string;
  bgCard: string;
  surfaceElevated: string;
  primary: string;
  onPrimary: string;
  sky: string;
  earth: string;
  sun: string;
  error: string;
  errorText: string;
  onDanger: string;
  dangerBg: string;
  dangerBorder: string;
  textMain: string;
  textMuted: string;
  textDim: string;
  border: string;
  borderStrong: string;
}

const ICE_FALLBACK_PALETTES: Record<IceLockscreenTheme, IceCanvasPalette> = {
  dark: {
    bgMain: 'hsl(140 11% 5%)',
    bgCard: 'hsl(144 11% 9%)',
    surfaceElevated: 'hsl(146 11% 12%)',
    primary: 'hsl(152 41% 52%)',
    onPrimary: 'hsl(148 48% 5%)',
    sky: 'hsl(201 44% 61%)',
    earth: 'hsl(21 66% 55%)',
    sun: 'hsl(39 62% 56%)',
    error: 'hsl(5 56% 51%)',
    errorText: 'hsl(5 81% 75%)',
    onDanger: 'hsl(45 50% 99%)',
    dangerBg: 'hsl(3 33% 11%)',
    dangerBorder: 'hsla(5 62% 57% / 0.34)',
    textMain: 'hsl(50 23% 95%)',
    textMuted: 'hsl(135 5% 67%)',
    textDim: 'hsl(138 5% 58%)',
    border: 'hsla(132 16% 93% / 0.12)',
    borderStrong: 'hsla(132 16% 93% / 0.24)',
  },
  light: {
    bgMain: 'hsl(43 22% 95%)',
    bgCard: 'hsl(45 50% 99%)',
    surfaceElevated: 'hsl(42 25% 90%)',
    primary: 'hsl(152 56% 28%)',
    onPrimary: 'hsl(45 50% 99%)',
    sky: 'hsl(202 53% 36%)',
    earth: 'hsl(18 73% 38%)',
    sun: 'hsl(39 82% 29%)',
    error: 'hsl(5 57% 46%)',
    errorText: 'hsl(4 70% 38%)',
    onDanger: 'hsl(45 50% 99%)',
    dangerBg: 'hsl(7 58% 95%)',
    dangerBorder: 'hsla(5 57% 46% / 0.28)',
    textMain: 'hsl(144 10% 10%)',
    textMuted: 'hsl(144 6% 31%)',
    textDim: 'hsl(144 5% 38%)',
    border: 'hsla(144 10% 10% / 0.12)',
    borderStrong: 'hsla(144 10% 10% / 0.24)',
  },
};

function sanitizeStorageScopeSegment(raw: unknown): string {
  const clean = typeof raw === 'string' ? raw.trim().replace(/[^a-zA-Z0-9_-]/g, '') : '';
  return clean.slice(0, 64) || 'guest';
}

function decodeJwtUserIdFromToken(token: string | null): string | null {
  if (!token || typeof atob !== 'function') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(padded)) as Record<string, unknown>;
    const candidate = decoded.id ?? decoded.userId ?? decoded._id ?? decoded.sub;
    if (typeof candidate === 'string' && candidate.trim()) {
      return sanitizeStorageScopeSegment(candidate);
    }
    return null;
  } catch {
    return null;
  }
}

export function resolveActiveIceStorageUid(explicitUid?: string | null): string {
  if (explicitUid && explicitUid.trim()) {
    return sanitizeStorageScopeSegment(explicitUid);
  }
  if (typeof window === 'undefined') return 'guest';
  try {
    const token = window.localStorage.getItem('lost_token');
    return decodeJwtUserIdFromToken(token) || 'guest';
  } catch {
    return 'guest';
  }
}

export function getIceCardStorageKey(explicitUid?: string | null): string {
  return `${ICE_CARD_STORAGE_KEY}_${resolveActiveIceStorageUid(explicitUid)}`;
}

function clampText(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function sanitizeContact(raw: unknown): IceEmergencyContact {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    name: clampText(obj.name, 60),
    relation: clampText(obj.relation, 32),
    phone: clampText(obj.phone, 28),
  };
}

export function sanitizeIceCardProfile(raw: unknown): IceCardProfile {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rawBlood = typeof obj.bloodType === 'string' ? obj.bloodType.trim() : '';
  const bloodType: IceBloodType = (ICE_BLOOD_TYPES as ReadonlyArray<string>).includes(rawBlood)
    ? (rawBlood as IceBloodType)
    : 'Chưa rõ';

  return {
    fullName: clampText(obj.fullName, 80),
    birthYear: clampText(obj.birthYear, 12),
    bloodType,
    allergies: clampText(obj.allergies, 180),
    medicalConditions: clampText(obj.medicalConditions, 200),
    contact1: sanitizeContact(obj.contact1),
    contact2: sanitizeContact(obj.contact2),
    plannedPeak: clampText(obj.plannedPeak, 90),
    rangerStationName: clampText(obj.rangerStationName, 100),
    rangerHotline: clampText(obj.rangerHotline, 36),
    returnDeadline: clampText(obj.returnDeadline, 44),
  };
}

export function loadIceCardProfile(explicitUid?: string | null): IceCardProfile {
  if (typeof window === 'undefined') return { ...DEFAULT_ICE_CARD_PROFILE };
  try {
    const scopedKey = getIceCardStorageKey(explicitUid);
    const raw = window.localStorage.getItem(scopedKey);
    if (!raw) return { ...DEFAULT_ICE_CARD_PROFILE };
    const parsed: unknown = JSON.parse(raw);
    return sanitizeIceCardProfile(parsed);
  } catch {
    return { ...DEFAULT_ICE_CARD_PROFILE };
  }
}

export function saveIceCardProfile(
  profile: IceCardProfile,
  explicitUid?: string | null
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const sanitized = sanitizeIceCardProfile(profile);
    const scopedKey = getIceCardStorageKey(explicitUid);
    window.localStorage.setItem(scopedKey, JSON.stringify(sanitized));
    // Remove legacy unscoped key if present so medical data never leaks across accounts
    window.localStorage.removeItem(ICE_CARD_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function clearIceCardProfile(explicitUid?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getIceCardStorageKey(explicitUid));
    window.localStorage.removeItem(ICE_CARD_STORAGE_KEY);
  } catch {
    // Ignore storage clear failures on private browsing
  }
}

/**
 * Pure International Standard Atmosphere (ISA, ISO 2533) & NIST Antoine water
 * vapor pressure equations for alpine trekking safety.
 *
 * - Lapse rate: -6.5 C / 1,000 m in troposphere (0 - 11,000 m).
 * - Barometric pressure: P = 1013.25 * (1 - 0.0065 * h / 288.15)^5.255876 hPa.
 * - Boiling point of pure water (NIST Antoine 1-100 C):
 *   T_boil = 1730.63 / (8.07131 - log10(P_mmHg)) - 233.426.
 *   At sea level (0 m): ~100.0 C, 1013.3 hPa.
 *   At Fansipan (3,143 m): ~89.6 C, ~688.4 hPa (~67.9% O2 vs sea level).
 */
export function computeAltitudePhysics(
  altitudeM: number,
  seaLevelTempC = 26
): AltitudePhysicsMetrics {
  const safeAlt = Number.isFinite(altitudeM)
    ? Math.max(0, Math.min(8849, Math.round(altitudeM)))
    : 0;
  const safeBaseTemp = Number.isFinite(seaLevelTempC)
    ? Math.max(-10, Math.min(45, seaLevelTempC))
    : 26;

  const lapseRaw = -0.0065 * safeAlt;
  const tempLapseDropC = Math.abs(lapseRaw) < 0.05 ? 0 : Number(lapseRaw.toFixed(1));
  const summitTempC = Number((safeBaseTemp + lapseRaw).toFixed(1));

  const P0_HPA = 1013.25;
  const T0_K = 288.15;
  const ISA_EXPONENT = 5.255876;
  const pressureRatio = Math.pow(Math.max(0.1, 1 - (0.0065 * safeAlt) / T0_K), ISA_EXPONENT);
  const pressureHpaRaw = P0_HPA * pressureRatio;
  const pressureHpa = Number(pressureHpaRaw.toFixed(1));
  const pressurePctSeaLevel = Number((pressureRatio * 100).toFixed(1));
  const oxygenPctSeaLevel = pressurePctSeaLevel;

  // NIST Antoine equation for pure water boiling temperature (1 - 100 C)
  const pressureMmHg = pressureHpaRaw * 0.7500616827;
  const ANTOINE_A = 8.07131;
  const ANTOINE_B = 1730.63;
  const ANTOINE_C = 233.426;
  const boilingRaw = ANTOINE_B / (ANTOINE_A - Math.log10(Math.max(10, pressureMmHg))) - ANTOINE_C;
  const boilingPointC = Number(boilingRaw.toFixed(1));

  // CDC/WHO safe drinking water boiling duration: 1 min below 2,000m, 3 min at >= 2,000m
  const recommendedBoilMinutes = safeAlt >= 2000 ? 3 : 1;
  const cookingTimeFactor = Number((1 + Math.max(0, 100 - boilingRaw) * 0.055).toFixed(2));

  let amsRiskLevel: AmsRiskLevel = 'none';
  let amsLabel = 'Thấp (< 1.500m)';
  let amsGuidance =
    'Áp suất khí quyển và phân áp oxy ở mức dễ chịu. Tập trung bù nước điện giải và kiểm soát nhịp tim.';

  if (safeAlt >= 3000) {
    amsRiskLevel = 'high';
    amsLabel = 'Cảnh báo AMS Cao (>= 3.000m)';
    amsGuidance =
      'Oxy hiệu dụng giảm dưới 70% mực nước biển. Duy trì bước nghỉ Rest Step, thở nhịp 2:2, uống nước ấm điện giải và hạ độ cao 300-500m ngay nếu đau đầu kèm buồn nôn.';
  } else if (safeAlt >= 2500) {
    amsRiskLevel = 'moderate';
    amsLabel = 'Ngưỡng Sốc Độ Cao (2.500-2.999m)';
    amsGuidance =
      'Bắt đầu vào ngưỡng nguy cơ AMS (sốc độ cao cấp tính). Tránh leo dồn tốc độ, giữ ấm cổ-đầu ban đêm và tuyệt đối không uống rượu bia tại lán.';
  } else if (safeAlt >= 1500) {
    amsRiskLevel = 'mild';
    amsLabel = 'Trung bình (1.500-2.499m)';
    amsGuidance =
      'Nhiệt độ giảm rõ rệt về chiều tối và rạng sáng; phân áp oxy giảm nhẹ khi mang balo nặng leo dốc kéo dài.';
  }

  const freezingAdvisory =
    summitTempC <= 4
      ? ` Cảnh báo rét sâu / nguy cơ băng giá (${summitTempC.toFixed(1)}°C): bắt buộc mang áo lông vũ giữ nhiệt, găng tay chống gió, túi ngủ chịu âm và tránh để ướt mồ hôi gây hạ thân nhiệt.`
      : '';

  const cookingGuidance =
    safeAlt >= 2000
      ? `Nước sôi ở ${boilingPointC.toFixed(1)}°C (thấp hơn 100°C): cần đun sôi sục tối thiểu 3 phút để diệt khuẩn an toàn (chuẩn WHO/CDC). Nấu gạo/mì chín chậm hơn khoảng ${Math.round((cookingTimeFactor - 1) * 100)}%, nên dùng nắp đậy kín và chắn gió bếp gas.${freezingAdvisory}`
      : `Nước sôi ở ${boilingPointC.toFixed(1)}°C: đun sôi sục tối thiểu 1 phút để tiệt trùng nước suối. Nếu qua đêm trên cao, chuẩn bị áo giữ nhiệt tương ứng nền nhiệt ước tính ${summitTempC.toFixed(1)}°C.${freezingAdvisory}`;

  return {
    altitudeM: safeAlt,
    seaLevelTempC: Number(safeBaseTemp.toFixed(1)),
    tempLapseDropC,
    summitTempC,
    pressureHpa,
    pressurePctSeaLevel,
    oxygenPctSeaLevel,
    boilingPointC,
    recommendedBoilMinutes,
    cookingTimeFactor,
    amsRiskLevel,
    amsLabel,
    amsGuidance,
    cookingGuidance,
  };
}

function resolveIceCanvasPalette(theme: IceLockscreenTheme): IceCanvasPalette {
  const fallback = ICE_FALLBACK_PALETTES[theme];
  if (typeof document === 'undefined' || !document.documentElement) {
    return fallback;
  }

  const probe = document.createElement('div');
  probe.setAttribute('data-theme', theme);
  probe.style.position = 'fixed';
  probe.style.left = '-9999px';
  probe.style.top = '-9999px';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  const mountParent = document.body || document.documentElement;
  mountParent.appendChild(probe);

  try {
    const cs = window.getComputedStyle(probe);
    const read = (token: string, fb: string) => cs.getPropertyValue(token).trim() || fb;
    return {
      bgMain: read('--color-bg-main', fallback.bgMain),
      bgCard: read('--color-bg-card', fallback.bgCard),
      surfaceElevated: read('--color-surface-elevated', fallback.surfaceElevated),
      primary: read('--color-primary', fallback.primary),
      onPrimary: read('--color-on-primary', fallback.onPrimary),
      sky: read('--color-sky', fallback.sky),
      earth: read('--color-earth', fallback.earth),
      sun: read('--color-sun', fallback.sun),
      error: read('--color-error', fallback.error),
      errorText: read('--color-error-text', fallback.errorText),
      onDanger: read('--color-on-danger', fallback.onDanger),
      dangerBg: read('--banner-danger-bg', fallback.dangerBg),
      dangerBorder: read('--banner-danger-border', fallback.dangerBorder),
      textMain: read('--color-text-main', fallback.textMain),
      textMuted: read('--color-text-muted', fallback.textMuted),
      textDim: read('--color-text-dim', fallback.textDim),
      border: read('--color-border', fallback.border),
      borderStrong: read('--color-border-strong', fallback.borderStrong),
    };
  } finally {
    probe.remove();
  }
}

function getVietnamTodayDateParts(): { year: string; month: string; day: string } {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (year && month && day) {
      return { year, month, day };
    }
  } catch {
    // Fallback to local clock below
  }
  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, '0'),
    day: String(now.getDate()).padStart(2, '0'),
  };
}

function formatSortableDateStamp(dateLabel?: string): string {
  const raw = (dateLabel || '').trim();
  const isoMatch = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}${m.padStart(2, '0')}${d.padStart(2, '0')}`;
  }
  const vnMatch = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (vnMatch) {
    const [, d, m, y] = vnMatch;
    return `${y}${m.padStart(2, '0')}${d.padStart(2, '0')}`;
  }
  const vn = getVietnamTodayDateParts();
  return `${vn.year}${vn.month}${vn.day}`;
}

export function buildIceCardFileName(hikerName: string, dateLabel?: string): string {
  const slug =
    (hikerName || 'hiker')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 36) || 'hiker';

  const datePart = formatSortableDateStamp(dateLabel);
  return `lost-ice-lockscreen-${slug}-1080x1920-${datePart}.png`;
}

function ellipsizeCanvasLine(
  ctx: Pick<CanvasRenderingContext2D, 'measureText'>,
  text: string,
  maxWidth: number
): { text: string; truncated: boolean } {
  const trimmed = text.trim();
  if (!trimmed || ctx.measureText(trimmed).width <= maxWidth) {
    return { text: trimmed, truncated: false };
  }
  const suffix = '...';
  let body = trimmed;
  while (body.length > 1 && ctx.measureText(`${body.trimEnd()}${suffix}`).width > maxWidth) {
    body = body.slice(0, -1);
  }
  return { text: `${body.trimEnd()}${suffix}`, truncated: true };
}

function splitOverlongToken(
  ctx: Pick<CanvasRenderingContext2D, 'measureText'>,
  token: string,
  maxWidth: number
): string[] {
  if (ctx.measureText(token).width <= maxWidth) return [token];

  // First try splitting after natural delimiters (/ , ; - +) without dropping them
  const delimiterPieces = token.split(/(?<=[/,;+-])/g).filter(Boolean);
  const segments: string[] = [];

  const pushCharWrapped = (piece: string) => {
    let chunk = '';
    for (const ch of piece) {
      const next = chunk + ch;
      if (chunk && ctx.measureText(next).width > maxWidth) {
        segments.push(chunk);
        chunk = ch;
      } else {
        chunk = next;
      }
    }
    if (chunk) segments.push(chunk);
  };

  if (delimiterPieces.length > 1) {
    let acc = '';
    for (const piece of delimiterPieces) {
      if (ctx.measureText(piece).width > maxWidth) {
        if (acc) {
          segments.push(acc);
          acc = '';
        }
        pushCharWrapped(piece);
        continue;
      }
      const combined = acc + piece;
      if (acc && ctx.measureText(combined).width > maxWidth) {
        segments.push(acc);
        acc = piece;
      } else {
        acc = combined;
      }
    }
    if (acc) segments.push(acc);
  } else {
    pushCharWrapped(token);
  }

  return segments.length > 0 ? segments : [token];
}

function wrapIceCanvasTextDetailed(
  ctx: Pick<CanvasRenderingContext2D, 'measureText'>,
  text: string,
  maxWidth: number,
  maxLines: number
): { lines: string[]; truncated: boolean } {
  const safeMaxLines = Math.max(1, Math.floor(maxLines));
  const normalized = (text || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return { lines: [], truncated: false };

  if (safeMaxLines === 1) {
    const fitted = ellipsizeCanvasLine(ctx, normalized, maxWidth);
    return { lines: [fitted.text], truncated: fitted.truncated };
  }

  const rawWords = normalized.split(' ');
  const tokens: Array<{ text: string; joinWithSpace: boolean }> = [];
  rawWords.forEach((word, wordIdx) => {
    const pieces = splitOverlongToken(ctx, word, maxWidth);
    pieces.forEach((piece, pieceIdx) => {
      tokens.push({
        text: piece,
        joinWithSpace: wordIdx > 0 && pieceIdx === 0,
      });
    });
  });

  const lines: string[] = [];
  let current = tokens[0]?.text || '';

  for (let i = 1; i < tokens.length; i += 1) {
    const tok = tokens[i];
    const candidate = tok.joinWithSpace ? `${current} ${tok.text}` : `${current}${tok.text}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = tok.text;
      if (lines.length >= safeMaxLines - 1) {
        let rest = current;
        for (let j = i + 1; j < tokens.length; j += 1) {
          rest += tokens[j].joinWithSpace ? ` ${tokens[j].text}` : tokens[j].text;
        }
        const finalLine = ellipsizeCanvasLine(ctx, rest, maxWidth);
        lines.push(finalLine.text);
        return { lines, truncated: finalLine.truncated };
      }
    }
  }

  if (current) {
    const lastLine = ellipsizeCanvasLine(ctx, current, maxWidth);
    lines.push(lastLine.text);
    return { lines: lines.slice(0, safeMaxLines), truncated: lastLine.truncated };
  }
  return { lines: lines.slice(0, safeMaxLines), truncated: false };
}

export function wrapIceCanvasText(
  ctx: Pick<CanvasRenderingContext2D, 'measureText'>,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  return wrapIceCanvasTextDetailed(ctx, text, maxWidth, maxLines).lines;
}

function fitSingleLineFontPx(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  weight: number,
  startPx: number,
  minPx: number,
  fontFamily: string
): { fontPx: number; text: string; truncated: boolean } {
  for (let px = startPx; px >= minPx; px -= 2) {
    ctx.font = `${weight} ${px}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth) {
      return { fontPx: px, text, truncated: false };
    }
  }
  ctx.font = `${weight} ${minPx}px ${fontFamily}`;
  const fitted = ellipsizeCanvasLine(ctx, text, maxWidth);
  return { fontPx: minPx, text: fitted.text, truncated: fitted.truncated };
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawTopographicBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: IceCanvasPalette
) {
  ctx.save();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    const rx = 280 + i * 115;
    const ry = 135 + i * 62;
    ctx.ellipse(w * 0.88, 120, rx, ry, -0.18, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const rx = 240 + i * 125;
    const ry = 120 + i * 58;
    ctx.ellipse(w * 0.1, h - 180, rx, ry, 0.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMedicalCrossIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
) {
  const armW = size * 0.34;
  const half = size / 2;
  ctx.save();
  ctx.fillStyle = color;
  drawRoundedRectPath(ctx, cx - armW / 2, cy - half, armW, size, 3);
  ctx.fill();
  drawRoundedRectPath(ctx, cx - half, cy - armW / 2, size, armW, 3);
  ctx.fill();
  ctx.restore();
}

function drawMountainGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.82);
  ctx.lineTo(x + size * 0.36, y + size * 0.16);
  ctx.lineTo(x + size * 0.56, y + size * 0.54);
  ctx.lineTo(x + size * 0.72, y + size * 0.32);
  ctx.lineTo(x + size, y + size * 0.82);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

async function ensureIceCanvasFontReady(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  const fontSet = document.fonts;
  const preloadPromise = Promise.all([
    fontSet.load('600 24px "Plus Jakarta Sans"').catch(() => []),
    fontSet.load('700 32px "Plus Jakarta Sans"').catch(() => []),
    fontSet.load('800 54px "Plus Jakarta Sans"').catch(() => []),
    fontSet.ready.catch(() => undefined),
  ]);
  await Promise.race([
    preloadPromise,
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, 350);
    }),
  ]);
}

/**
 * Generates an offline 1080x1920 PNG Phone Lockscreen ICE Emergency Medical Card
 * using live CSS design tokens via theme probe. Leaves top ~326px uncluttered for
 * iOS & Android lockscreen clocks. Zero network requests, zero CORS, 100% offline.
 */
export async function renderIceLockscreenPng(
  input: IceLockscreenRenderInput
): Promise<IceLockscreenRenderResult> {
  if (typeof document === 'undefined') {
    throw new Error('Trình tạo thẻ khóa màn hình ICE chỉ hỗ trợ trên trình duyệt.');
  }

  await ensureIceCanvasFontReady();

  const width = 1080;
  const height = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Trình duyệt không hỗ trợ HTML5 Canvas 2D.');
  }

  const profile = sanitizeIceCardProfile(input.profile);
  const palette = resolveIceCanvasPalette(input.theme);
  const fontFamily = '"Plus Jakarta Sans", "Be Vietnam Pro", "Inter", system-ui, sans-serif';
  const truncatedFields: string[] = [];

  const padX = 56;
  const contentW = width - padX * 2; // 968px
  const vnDate = getVietnamTodayDateParts();
  const todayLabel = input.generatedDateLabel || `${vnDate.day}/${vnDate.month}/${vnDate.year}`;

  // 1. Matte Field-Atlas Canvas Background
  ctx.fillStyle = palette.bgMain;
  ctx.fillRect(0, 0, width, height);
  drawTopographicBackdrop(ctx, width, height, palette);

  // Outer fine frame inset
  ctx.save();
  ctx.strokeStyle = palette.borderStrong;
  ctx.lineWidth = 2;
  drawRoundedRectPath(ctx, 26, 26, width - 52, height - 52, 14);
  ctx.stroke();
  ctx.restore();

  // 2. Top Safe Clock Clearance Stamp (leaves y: 108..326 open for OS lockscreen clock)
  ctx.save();
  drawMountainGlyph(ctx, padX, 56, 26, palette.primary);
  ctx.fillStyle = palette.textMuted;
  ctx.font = `800 18px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('LOST • VIETNAM ALPINE SAFETY', padX + 38, 70);

  ctx.fillStyle = palette.textDim;
  ctx.font = `700 16px ${fontFamily}`;
  ctx.textAlign = 'right';
  ctx.fillText('VÙNG ĐỒNG HỒ KHÓA MÀN HÌNH', width - padX, 70);

  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(padX, 322);
  ctx.lineTo(width - padX, 322);
  ctx.stroke();
  ctx.restore();

  // 3. High-Contrast Emergency ICE Header Banner (y: 342 -> 452, h: 110)
  const bannerY = 342;
  const bannerH = 110;
  ctx.save();
  drawRoundedRectPath(ctx, padX, bannerY, contentW, bannerH, 10);
  ctx.fillStyle = palette.error;
  ctx.fill();

  drawRoundedRectPath(ctx, padX + 22, bannerY + 21, 68, 68, 8);
  ctx.fillStyle = palette.onDanger;
  ctx.fill();
  drawMedicalCrossIcon(ctx, padX + 56, bannerY + 55, 40, palette.error);

  ctx.fillStyle = palette.onDanger;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `800 33px ${fontFamily}`;
  ctx.fillText('THÔNG TIN Y TẾ KHẨN CẤP • ICE', padX + 112, bannerY + 42, contentW - 134);

  ctx.font = `600 19px ${fontFamily}`;
  ctx.fillText(
    'IN CASE OF EMERGENCY • DÀNH CHO LỰC LƯỢNG CỨU HỘ & Y TẾ',
    padX + 112,
    bannerY + 79,
    contentW - 134
  );
  ctx.restore();

  // 4. Hiker Identity + Blood Type Row (y: 472 -> 666, h: 194)
  const idY = 472;
  const idH = 194;
  const bloodBoxW = 248;
  const gap = 20;
  const nameBoxW = contentW - bloodBoxW - gap;

  ctx.save();
  drawRoundedRectPath(ctx, padX, idY, nameBoxW, idH, 10);
  ctx.fillStyle = palette.bgCard;
  ctx.fill();
  ctx.strokeStyle = palette.borderStrong;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = palette.primary;
  drawRoundedRectPath(ctx, padX, idY, 8, idH, 4);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = palette.textDim;
  ctx.font = `700 18px ${fontFamily}`;
  ctx.fillText('HỌ VÀ TÊN NGƯỜI LEO NÚI', padX + 28, idY + 20);

  const displayName = (profile.fullName || 'CHƯA ĐIỀN HỌ TÊN').toUpperCase();
  ctx.fillStyle = profile.fullName ? palette.textMain : palette.textMuted;
  ctx.font = `800 40px ${fontFamily}`;
  let nameWrap = wrapIceCanvasTextDetailed(ctx, displayName, nameBoxW - 52, 2);
  let nameLineH = 46;
  if (nameWrap.truncated) {
    ctx.font = `800 32px ${fontFamily}`;
    nameWrap = wrapIceCanvasTextDetailed(ctx, displayName, nameBoxW - 52, 2);
    nameLineH = 38;
  }
  if (nameWrap.truncated && profile.fullName) truncatedFields.push('Họ và tên');
  nameWrap.lines.forEach((line, idx) => {
    ctx.fillText(line, padX + 28, idY + 50 + idx * nameLineH);
  });

  const metaParts: string[] = [];
  if (profile.birthYear) metaParts.push(`Năm sinh: ${profile.birthYear}`);
  if (profile.returnDeadline) metaParts.push(`Hạ sơn dự kiến: ${profile.returnDeadline}`);
  const metaText = metaParts.length > 0 ? metaParts.join('  •  ') : 'Hồ sơ lưu cục bộ 100% ngoại tuyến';
  ctx.fillStyle = palette.textMuted;
  const metaFit = fitSingleLineFontPx(ctx, metaText, nameBoxW - 52, 600, 19, 15, fontFamily);
  ctx.fillText(metaFit.text, padX + 28, idY + idH - 36);
  ctx.restore();

  // Blood Type Badge Card
  const bloodX = padX + nameBoxW + gap;
  ctx.save();
  drawRoundedRectPath(ctx, bloodX, idY, bloodBoxW, idH, 10);
  ctx.fillStyle = palette.dangerBg;
  ctx.fill();
  ctx.strokeStyle = palette.error;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = palette.errorText;
  ctx.font = `800 18px ${fontFamily}`;
  ctx.fillText('NHÓM MÁU', bloodX + bloodBoxW / 2, idY + 22);

  const isUnknownBlood = profile.bloodType === 'Chưa rõ';
  ctx.fillStyle = palette.textMain;
  ctx.textBaseline = 'middle';
  ctx.font = isUnknownBlood ? `800 34px ${fontFamily}` : `800 72px ${fontFamily}`;
  ctx.fillText(profile.bloodType, bloodX + bloodBoxW / 2, idY + 108);

  ctx.fillStyle = palette.textMuted;
  ctx.font = `600 16px ${fontFamily}`;
  ctx.fillText('BLOOD TYPE', bloodX + bloodBoxW / 2, idY + idH - 26);
  ctx.restore();

  // 5. Medical Alerts Card: Allergies & Conditions (y: 686 -> 1016, h: 330)
  const medY = 686;
  const medH = 330;
  ctx.save();
  drawRoundedRectPath(ctx, padX, medY, contentW, medH, 10);
  ctx.fillStyle = palette.bgCard;
  ctx.fill();
  ctx.strokeStyle = palette.dangerBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = palette.error;
  drawRoundedRectPath(ctx, padX, medY, 8, medH, 4);
  ctx.fill();

  // Sub-section A: Allergies (auto step-down 26px/2-line -> 22px/3-line so full 180 chars fit cleanly)
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = palette.errorText;
  ctx.font = `800 19px ${fontFamily}`;
  ctx.fillText('DỊ ỨNG THUỐC / THỨC ĂN / NỌC CÔN TRÙNG', padX + 30, medY + 20);

  const allergyText = profile.allergies || 'Không ghi nhận dị ứng đặc biệt';
  ctx.fillStyle = profile.allergies ? palette.textMain : palette.textMuted;
  ctx.font = `700 26px ${fontFamily}`;
  let allergyWrap = wrapIceCanvasTextDetailed(ctx, allergyText, contentW - 58, 2);
  let allergyLineH = 34;
  if (allergyWrap.truncated) {
    ctx.font = `700 22px ${fontFamily}`;
    allergyWrap = wrapIceCanvasTextDetailed(ctx, allergyText, contentW - 58, 3);
    allergyLineH = 29;
  }
  if (allergyWrap.truncated && profile.allergies) truncatedFields.push('Dị ứng');
  allergyWrap.lines.forEach((line, idx) => {
    ctx.fillText(line, padX + 30, medY + 50 + idx * allergyLineH);
  });

  // Divider inside Medical Card
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX + 30, medY + 150);
  ctx.lineTo(width - padX - 28, medY + 150);
  ctx.stroke();

  // Sub-section B: Medical Conditions / Medications (auto step-down 24px -> 21px across 3 lines)
  ctx.fillStyle = palette.sun;
  ctx.font = `800 19px ${fontFamily}`;
  ctx.fillText('BỆNH NỀN / THUỐC ĐANG DÙNG / LƯU Ý CẤP CỨU', padX + 30, medY + 166);

  const condText = profile.medicalConditions || 'Không có bệnh nền hoặc thuốc điều trị đặc biệt';
  ctx.fillStyle = profile.medicalConditions ? palette.textMain : palette.textMuted;
  ctx.font = `600 24px ${fontFamily}`;
  let condWrap = wrapIceCanvasTextDetailed(ctx, condText, contentW - 58, 3);
  let condLineH = 32;
  if (condWrap.truncated) {
    ctx.font = `600 21px ${fontFamily}`;
    condWrap = wrapIceCanvasTextDetailed(ctx, condText, contentW - 58, 4);
    condLineH = 27;
  }
  if (condWrap.truncated && profile.medicalConditions) truncatedFields.push('Bệnh nền & thuốc');
  condWrap.lines.forEach((line, idx) => {
    ctx.fillText(line, padX + 30, medY + 196 + idx * condLineH);
  });
  ctx.restore();

  // 6. Emergency Contacts Card (#1 & #2) (y: 1036 -> 1366, h: 330)
  const contactsY = 1036;
  const contactsH = 330;
  ctx.save();
  drawRoundedRectPath(ctx, padX, contactsY, contentW, contactsH, 10);
  ctx.fillStyle = palette.bgCard;
  ctx.fill();
  ctx.strokeStyle = palette.borderStrong;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = palette.primary;
  ctx.font = `800 20px ${fontFamily}`;
  ctx.fillText('NGƯỜI LIÊN HỆ KHẨN CẤP (ƯU TIÊN GỌI NGAY)', padX + 28, contactsY + 20);

  const drawContactRow = (
    contact: IceEmergencyContact,
    indexLabel: string,
    rowY: number,
    rowH: number,
    accentColor: string,
    startPhonePx: number,
    minPhonePx: number
  ) => {
    const innerX = padX + 24;
    const innerW = contentW - 48;
    drawRoundedRectPath(ctx, innerX, rowY, innerW, rowH, 8);
    ctx.fillStyle = palette.surfaceElevated;
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = accentColor;
    drawRoundedRectPath(ctx, innerX, rowY, 7, rowH, 3);
    ctx.fill();

    const hasContact = Boolean(contact.name || contact.phone);
    const titleStr = hasContact
      ? [contact.name || 'Người liên hệ', contact.relation].filter(Boolean).join(' • ')
      : `Chưa thiết lập người liên hệ ${indexLabel}`;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = hasContact ? palette.textMuted : palette.textDim;
    ctx.font = `700 21px ${fontFamily}`;
    const labelWrap = wrapIceCanvasTextDetailed(ctx, `${indexLabel}  •  ${titleStr}`, innerW - 44, 1);
    ctx.fillText(labelWrap.lines[0] || '', innerX + 24, rowY + 16);

    ctx.fillStyle = contact.phone ? palette.textMain : palette.textDim;
    const phoneDisplay = contact.phone || '--- --- ----';
    const phoneFit = fitSingleLineFontPx(
      ctx,
      phoneDisplay,
      innerW - 44,
      800,
      startPhonePx,
      minPhonePx,
      fontFamily
    );
    if (phoneFit.truncated && contact.phone) truncatedFields.push(`SĐT ${indexLabel}`);
    ctx.fillText(phoneFit.text, innerX + 24, rowY + 50);
  };

  drawContactRow(profile.contact1, 'LIÊN HỆ #1', contactsY + 58, 118, palette.primary, 44, 26);
  drawContactRow(profile.contact2, 'LIÊN HỆ #2', contactsY + 190, 114, palette.sky, 36, 24);
  ctx.restore();

  // 7. Planned Peak & Verified VQG / Ranger Station Card (y: 1386 -> 1646, h: 260)
  const peakY = 1386;
  const peakH = 260;
  ctx.save();
  drawRoundedRectPath(ctx, padX, peakY, contentW, peakH, 10);
  ctx.fillStyle = palette.bgCard;
  ctx.fill();
  ctx.strokeStyle = palette.borderStrong;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = palette.earth;
  drawRoundedRectPath(ctx, padX, peakY, 8, peakH, 4);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = palette.earth;
  ctx.font = `800 19px ${fontFamily}`;
  ctx.fillText('LỘ TRÌNH DỰ KIẾN & TRẠM KIỂM LÂM / BQL VQG', padX + 30, peakY + 20);

  const peakDisplay = profile.plannedPeak || 'Chưa chọn cung đường / đỉnh núi cụ thể';
  ctx.fillStyle = profile.plannedPeak ? palette.textMain : palette.textMuted;
  ctx.font = `800 30px ${fontFamily}`;
  let peakWrap = wrapIceCanvasTextDetailed(ctx, peakDisplay, contentW - 58, 1);
  let peakLineH = 34;
  if (peakWrap.truncated) {
    ctx.font = `800 25px ${fontFamily}`;
    peakWrap = wrapIceCanvasTextDetailed(ctx, peakDisplay, contentW - 58, 2);
    peakLineH = 30;
  }
  if (peakWrap.truncated && profile.plannedPeak) truncatedFields.push('Cung đường dự kiến');
  peakWrap.lines.forEach((line, idx) => {
    ctx.fillText(line, padX + 30, peakY + 48 + idx * peakLineH);
  });

  // Station + Verified Hotline sub-strip
  const stBoxY = peakY + 128;
  const stBoxH = 108;
  drawRoundedRectPath(ctx, padX + 28, stBoxY, contentW - 56, stBoxH, 8);
  ctx.fillStyle = palette.surfaceElevated;
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const stationDisplay =
    profile.rangerStationName || 'Tổng đài Tìm kiếm Cứu nạn Quốc gia Việt Nam';
  ctx.fillStyle = palette.textMuted;
  const stationFit = fitSingleLineFontPx(ctx, stationDisplay, contentW - 96, 700, 20, 16, fontFamily);
  if (stationFit.truncated && profile.rangerStationName) truncatedFields.push('Trạm Kiểm lâm');
  ctx.fillText(stationFit.text, padX + 48, stBoxY + 18);

  const rangerPhone = profile.rangerHotline || '112';
  ctx.fillStyle = palette.primary;
  const hotlineFit = fitSingleLineFontPx(
    ctx,
    `HOTLINE: ${rangerPhone}`,
    contentW - 96,
    800,
    33,
    21,
    fontFamily
  );
  if (hotlineFit.truncated && profile.rangerHotline) truncatedFields.push('Hotline Kiểm lâm');
  ctx.fillText(hotlineFit.text, padX + 48, stBoxY + 52);
  ctx.restore();

  // 8. Vietnam National 24/7 Emergency Strip (y: 1666 -> 1818, h: 152)
  const natY = 1666;
  const natH = 152;
  const natGap = 18;
  const natW = (contentW - natGap * 2) / 3;
  const nationalEntries = [
    { num: '112', label: 'TÌM KIẾM CỨU NẠN', sub: 'CỨU HỘ RỪNG NÚI', accent: palette.error },
    { num: '114', label: 'CỨU HỎA & CNCH', sub: 'CỨU NẠN KHẨN CẤP', accent: palette.earth },
    { num: '115', label: 'CẤP CỨU Y TẾ', sub: 'CHẤN THƯƠNG / SỐC', accent: palette.sky },
  ];

  nationalEntries.forEach((item, idx) => {
    const bx = padX + idx * (natW + natGap);
    ctx.save();
    drawRoundedRectPath(ctx, bx, natY, natW, natH, 10);
    ctx.fillStyle = palette.bgCard;
    ctx.fill();
    ctx.strokeStyle = item.accent;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = item.accent;
    drawRoundedRectPath(ctx, bx, natY, natW, 8, 4);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = palette.textMain;
    ctx.font = `800 56px ${fontFamily}`;
    ctx.fillText(item.num, bx + natW / 2, natY + 20);

    ctx.fillStyle = idx === 0 ? palette.errorText : item.accent;
    ctx.font = `800 17px ${fontFamily}`;
    ctx.fillText(item.label, bx + natW / 2, natY + 90, natW - 24);

    ctx.fillStyle = palette.textDim;
    ctx.font = `600 14px ${fontFamily}`;
    ctx.fillText(item.sub, bx + natW / 2, natY + 116, natW - 24);
    ctx.restore();
  });

  // 9. Bottom Atlas Stamp (y: 1854, leaving ~66px above OS lockscreen swipe bar)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = palette.textDim;
  ctx.font = `700 17px ${fontFamily}`;
  ctx.fillText(
    `LOST • VIETNAM ALPINE ATLAS  •  100% NGOẠI TUYẾN  •  CẬP NHẬT ${todayLabel}`,
    width / 2,
    1856
  );
  ctx.restore();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Không thể xuất ảnh PNG thẻ khóa màn hình ICE từ Canvas.'));
      },
      'image/png'
    );
  });

  return {
    blob,
    width,
    height,
    fileName: buildIceCardFileName(profile.fullName || profile.plannedPeak || 'hiker', todayLabel),
    truncatedFields,
  };
}
