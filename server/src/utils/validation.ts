/**
 * High Security Validation & Sanitization Utility
 * LOST Security Protocol
 */

/**
 * Strips dangerous HTML/script tags and control characters WITHOUT corrupting legitimate
 * Vietnamese punctuation (slashes "/", apostrophes "'", quotes) with HTML entities.
 */
export const sanitizeInput = (str: string): string => {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<\s*(script|style|iframe|object|embed|svg)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
};

const PRIVATE_IPV4_REGEX =
  /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.)/;

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host === '::1' ||
    host === '0:0:0:0:0:0:0:1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    return true;
  }
  if (PRIVATE_IPV4_REGEX.test(host)) return true;
  if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return true;
  // Reject integer/octal IP bypass formats (e.g., 2130706433 or 0x7f000001)
  if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) return true;
  return false;
}

export const isSafeHttpUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (parsed.username || parsed.password) return false;
    if (isPrivateOrLocalHostname(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
};

export const validateUsername = (username: string): { isValid: boolean; cleanUsername: string; message?: string } => {
  if (!username || typeof username !== 'string') {
    return { isValid: false, cleanUsername: '', message: 'Tên tài khoản (Username) không được để trống.' };
  }

  const cleanUsername = username.trim().replace(/\s+/g, '_');
  if (cleanUsername.length < 3) {
    return { isValid: false, cleanUsername, message: 'Tên tài khoản phải có ít nhất 3 ký tự.' };
  }
  if (cleanUsername.length > 30) {
    return { isValid: false, cleanUsername, message: 'Tên tài khoản không được vượt quá 30 ký tự.' };
  }

  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(cleanUsername)) {
    return {
      isValid: false,
      cleanUsername,
      message: 'Tên tài khoản chỉ được chứa chữ cái không dấu, chữ số, dấu gạch dưới (_) hoặc gạch ngang (-).',
    };
  }

  return { isValid: true, cleanUsername };
};

/**
 * Converts a Vietnamese full name (e.g. "Nguyễn Văn Hoàng") into a valid ASCII username base ("nguyen_van_hoang").
 */
export const deriveUsernameFromFullName = (fullName: string, fallbackEmail?: string): string => {
  const normalized = String(fullName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 22);

  if (normalized.length >= 3) return normalized;

  const emailBase = String(fallbackEmail || '')
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 18);

  return emailBase.length >= 3 ? emailBase : 'trekker_vn';
};

export const generateUsernameSuggestions = async (
  baseName: string,
  checkExistsFn: (candidate: string) => Promise<boolean>
): Promise<string[]> => {
  const cleanBase = baseName.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const prefix = cleanBase.length >= 2 ? cleanBase.slice(0, 18) : 'Trekker';
  const currentYear = new Date().getFullYear();

  const candidates = [
    `${prefix}_Trekker`,
    `${prefix}${currentYear}`,
    `${prefix}_Alpine`,
    `${prefix}_Basecamp`,
    `${prefix}_${Math.floor(100 + Math.random() * 900)}`,
    `${prefix}_VN`,
  ];

  const suggestions: string[] = [];
  for (const cand of candidates) {
    if (suggestions.length >= 4) break;
    const exists = await checkExistsFn(cand);
    if (!exists && !suggestions.includes(cand)) {
      suggestions.push(cand);
    }
  }

  return suggestions;
};

export const validateEmail = (email: string): { isValid: boolean; cleanEmail: string; message?: string } => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, cleanEmail: '', message: 'Địa chỉ Email không được để trống.' };
  }

  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail.length > 254) {
    return { isValid: false, cleanEmail, message: 'Địa chỉ Email quá dài (tối đa 254 ký tự).' };
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(cleanEmail)) {
    return { isValid: false, cleanEmail, message: 'Định dạng Email không hợp lệ (Ví dụ hợp lệ: name@domain.com).' };
  }

  return { isValid: true, cleanEmail };
};

export interface PasswordStrengthResult {
  isValid: boolean;
  score: number; // 0, 1, 2, 3
  label: 'Yếu' | 'Trung Bình' | 'Khá' | 'Tốt';
  message?: string;
}

export const validatePasswordStrength = (password: string): PasswordStrengthResult => {
  if (!password || typeof password !== 'string') {
    return { isValid: false, score: 0, label: 'Yếu', message: 'Mật khẩu không được để trống.' };
  }

  if (password.length > 128) {
    return {
      isValid: false,
      score: 0,
      label: 'Yếu',
      message: 'Mật khẩu không được vượt quá 128 ký tự.',
    };
  }

  if (password.length < 8) {
    return {
      isValid: false,
      score: 0,
      label: 'Yếu',
      message: 'Mật khẩu phải có độ dài tối thiểu 8 ký tự (Yêu cầu Mức Khá trở lên).',
    };
  }

  let score = 0;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  const classCount = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
  if (classCount >= 2) score = 1;
  if (hasLower && hasUpper && hasDigit) score = 2;
  if (hasLower && hasUpper && hasDigit && hasSpecial && password.length >= 10) score = 3;

  const weakPasswords = ['12345678', 'password', 'qwertyui', '123456789', 'lost123'];
  if (weakPasswords.includes(password.toLowerCase())) {
    return {
      isValid: false,
      score: 0,
      label: 'Yếu',
      message: 'Mật khẩu quá thông dụng và dễ bị đoán. Vui lòng chọn mật khẩu khác.',
    };
  }

  if (score < 2) {
    return {
      isValid: false,
      score,
      label: score === 1 ? 'Trung Bình' : 'Yếu',
      message: 'Mật khẩu phải bao gồm cả chữ hoa (A-Z), chữ thường (a-z) và chữ số (0-9) để đạt Mức Khá trở lên.',
    };
  }

  return {
    isValid: true,
    score,
    label: score === 3 ? 'Tốt' : 'Khá',
  };
};

export const validateFullName = (name: string): { isValid: boolean; cleanName: string; message?: string } => {
  if (!name || typeof name !== 'string') {
    return { isValid: false, cleanName: '', message: 'Họ và tên không được để trống.' };
  }

  const cleanName = sanitizeInput(name);
  if (cleanName.length < 2) {
    return { isValid: false, cleanName, message: 'Họ và tên phải có ít nhất 2 ký tự.' };
  }
  if (cleanName.length > 60) {
    return { isValid: false, cleanName, message: 'Họ và tên không được vượt quá 60 ký tự.' };
  }

  return { isValid: true, cleanName };
};

export const validateOtpCode = (code: string): { isValid: boolean; cleanCode: string; message?: string } => {
  if (!code || typeof code !== 'string') {
    return { isValid: false, cleanCode: '', message: 'Mã xác thực OTP không được để trống.' };
  }

  const cleanCode = code.trim();
  const otpRegex = /^\d{6}$/;
  if (!otpRegex.test(cleanCode)) {
    return { isValid: false, cleanCode, message: 'Mã OTP phải bao gồm đúng 6 chữ số (Ví dụ: 123456).' };
  }

  return { isValid: true, cleanCode };
};

export const validatePhoneNumber = (phone: string): { isValid: boolean; cleanPhone: string; message?: string } => {
  if (!phone || typeof phone !== 'string') {
    return { isValid: true, cleanPhone: '' };
  }

  const cleanPhone = phone.trim().replace(/[\s\-.]/g, '');
  if (!cleanPhone) {
    return { isValid: true, cleanPhone: '' };
  }

  const phoneRegex = /^(0|\+84)[35789][0-9]{8}$/;
  if (!phoneRegex.test(cleanPhone)) {
    return {
      isValid: false,
      cleanPhone,
      message: 'Số điện thoại không đúng định dạng Việt Nam (Ví dụ hợp lệ: 0912345678 hoặc +84912345678).',
    };
  }

  return { isValid: true, cleanPhone };
};

export const hasDangerousMongoKeys = (obj: unknown): boolean => {
  if (!obj || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return obj.some(hasDangerousMongoKeys);
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('$') || key.includes('.')) return true;
    if (val && typeof val === 'object' && hasDangerousMongoKeys(val)) return true;
  }
  return false;
};
