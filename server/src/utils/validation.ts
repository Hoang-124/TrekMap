/**
 * High Security Validation & Sanitization Utility (Mức Khá ➔ Tốt)
 * TrekMap Security Protocol
 */

/**
 * Sanitize string inputs to prevent XSS Injection and HTML tampering
 */
export const sanitizeInput = (str: string): string => {
  if (!str) return '';
  return str
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Validate Unique Username (3-30 chars, alphanumeric + underscores/hyphens)
 */
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
    return { isValid: false, cleanUsername, message: 'Tên tài khoản chỉ được chứa chữ cái, chữ số, dấu gạch dưới (_) hoặc gạch ngang (-).' };
  }

  return { isValid: true, cleanUsername };
};

/**
 * Generate 4 Unique Outdoor & Trekking Themed Username Suggestions
 */
export const generateUsernameSuggestions = async (
  baseName: string,
  checkExistsFn: (candidate: string) => Promise<boolean>
): Promise<string[]> => {
  const cleanBase = baseName.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const prefix = cleanBase.length >= 2 ? cleanBase : 'Trekker';
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

/**
 * Validate Email against RFC 5322 standard format
 */
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

/**
 * Password Strength Evaluator (4 Levels: 0=Yếu, 1=Trung Bình, 2=Khá, 3=Tốt)
 * Standard Required: Score >= 2 (Mức Khá trở lên)
 */
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
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (hasLower && (hasUpper || hasDigit)) score = 1; // Trung Bình
  if (hasLower && hasUpper && hasDigit) score = 2; // Khá
  if (hasLower && hasUpper && hasDigit && hasSpecial && password.length >= 10) score = 3; // Tốt

  // Blacklisted weak passwords
  const weakPasswords = ['12345678', 'password', 'qwertyui', '123456789', 'trekmap123'];
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

/**
 * Validate Full Name (Min 2 chars, Max 60 chars, XSS Sanitized)
 */
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

/**
 * Validate OTP Code (Exactly 6 numeric digits)
 */
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

/**
 * Validate Vietnamese Phone Number Format (10-11 digits starting with 03, 05, 07, 08, 09 or +84)
 */
export const validatePhoneNumber = (phone: string): { isValid: boolean; cleanPhone: string; message?: string } => {
  if (!phone || typeof phone !== 'string') {
    return { isValid: true, cleanPhone: '' }; // Optional
  }

  const cleanPhone = phone.trim().replace(/[\s\-\.]/g, '');
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
