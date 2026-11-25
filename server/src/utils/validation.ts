import net from 'node:net';
import dns from 'node:dns/promises';

/**
 * High Security Validation & Sanitization Utility
 * LOST Security Protocol
 */

const DANGEROUS_BLOCK_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'svg'] as const;
const DANGEROUS_TAG_STRIPPERS = DANGEROUS_BLOCK_TAGS.map((tag) => ({
  closeRx: new RegExp(`<\\s*/\\s*${tag}\\s*>`, 'gi'),
  blockRx: new RegExp(`<\\s*${tag}\\b[^>]*>[\\s\\S]*?<\\s*/\\s*${tag}\\s*>`, 'gi'),
}));

/**
 * Strips control characters first, then dangerous HTML/script tags and unsafe URI schemes
 * WITHOUT corrupting legitimate Vietnamese punctuation (slashes "/", apostrophes "'", quotes).
 * Bounded to O(n) even on adversarial unclosed repeated tags (zero quadratic ReDoS).
 */
export const sanitizeInput = (str: string): string => {
  if (!str || typeof str !== 'string') return '';
  let out = str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

  for (const { closeRx, blockRx } of DANGEROUS_TAG_STRIPPERS) {
    closeRx.lastIndex = 0;
    let lastCloseEnd = -1;
    let match: RegExpExecArray | null;
    while ((match = closeRx.exec(out)) !== null) {
      lastCloseEnd = match.index + match[0].length;
    }
    if (lastCloseEnd !== -1) {
      blockRx.lastIndex = 0;
      out = out.slice(0, lastCloseEnd).replace(blockRx, '') + out.slice(lastCloseEnd);
    }
  }

  return out
    .replace(/<[^>]*>/g, '')
    .replace(/(?:javascript|vbscript)\s*:/gi, '')
    .trim();
};

function isPrivateOrReservedIpv4(ipv4: string): boolean {
  const parts = ipv4.split('.');
  if (parts.length !== 4) return true;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = nums;
  if (a === 0) return true; // 0.0.0.0/8 unspecified
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // IETF protocol / TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // Multicast & reserved/broadcast
  return false;
}

function extractMappedIpv4FromIpv6(host: string): string | null {
  // Dotted IPv4-mapped IPv6, e.g. ::ffff:127.0.0.1 or 0:0:0:0:0:ffff:169.254.169.254
  const dottedMatch = /^(?:::(?:ffff:)?|0(?::0){4}:ffff:)(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(host);
  if (dottedMatch && net.isIP(dottedMatch[1]) === 4) {
    return dottedMatch[1];
  }
  // Hex-pair IPv4-mapped IPv6 (Node URL parser normalizes [::ffff:127.0.0.1] -> ::ffff:7f00:1)
  const hexMatch = /^(?:::ffff:|0(?::0){4}:ffff:)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(host);
  if (hexMatch) {
    const hi = parseInt(hexMatch[1], 16);
    const lo = parseInt(hexMatch[2], 16);
    if (Number.isFinite(hi) && Number.isFinite(lo)) {
      return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    }
  }
  return null;
}

function isPrivateOrReservedIpv6(host: string): boolean {
  const clean = host.split('%')[0].toLowerCase(); // Strip zone index if present
  if (clean === '::' || clean === '::1') return true;
  if (/^0(:0)*$/.test(clean) || /^0(:0)*:1$/.test(clean)) return true;

  const mappedV4 = extractMappedIpv4FromIpv6(clean);
  if (mappedV4) {
    return isPrivateOrReservedIpv4(mappedV4);
  }

  // Block NAT64 well-known prefix (64:ff9b::/96) which can reach internal IPv4
  if (/^64:ff9b:/i.test(clean)) return true;
  // Block ULA fc00::/7 (fc00..fdff), link-local fe80::/10 (fe80..febf), site-local fec0::/10, multicast ff00::/8
  if (/^f[cd][0-9a-f]{2}:/i.test(clean)) return true;
  if (/^fe[89abcdef][0-9a-f]:/i.test(clean)) return true;
  if (/^ff[0-9a-f]{2}:/i.test(clean)) return true;
  if (/^2001:0?db8:/i.test(clean)) return true; // Documentation range
  return false;
}

export function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.+$/, ''); // Strip trailing FQDN dots (blocks "localhost.")

  if (!host) return true;
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost') ||
    host.endsWith('.home.arpa') ||
    host.endsWith('.arpa')
  ) {
    return true;
  }

  // Reject integer / hex / octal IPv4 obfuscations (e.g., 2130706433, 0x7f000001, 0177.0.0.1)
  if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) return true;
  const dotParts = host.split('.');
  if (
    dotParts.length >= 2 &&
    dotParts.length <= 4 &&
    dotParts.every((p) => /^(0x[0-9a-f]+|0[0-7]+|\d+)$/i.test(p))
  ) {
    if (net.isIP(host) === 4) {
      return isPrivateOrReservedIpv4(host);
    }
    // Non-canonical octal/hex/shortened IPv4 literal -> block
    return true;
  }

  const ipVersion = net.isIP(host.split('%')[0]);
  if (ipVersion === 4) {
    return isPrivateOrReservedIpv4(host);
  }
  if (ipVersion === 6 || host.includes(':')) {
    return isPrivateOrReservedIpv6(host);
  }

  // Public DNS domain names (including fc*/fd* domains like fcdn.vn, fd.nl) are allowed
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

/**
 * DNS-aware SSRF guard for server-side outbound HTTP fetches:
 * validates syntax + hostname AND ensures every resolved A/AAAA address is strictly public,
 * with a bounded 3.5s lookup timeout so stalled OS resolvers can never hang Express workers.
 */
export const isSafePublicUrlWithDns = async (value: unknown, timeoutMs = 3500): Promise<boolean> => {
  if (!isSafeHttpUrl(value)) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const parsed = new URL(value.trim());
    const cleanHost = parsed.hostname.replace(/^\[|\]$/g, '').replace(/\.+$/, '');
    if (net.isIP(cleanHost) !== 0) {
      return !isPrivateOrLocalHostname(cleanHost);
    }
    const lookupPromise = dns.lookup(cleanHost, { all: true, verbatim: true }).catch(() => null);
    const timeoutPromise = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), Math.max(250, timeoutMs));
      timer.unref?.();
    });
    const records = await Promise.race([lookupPromise, timeoutPromise]);
    if (!Array.isArray(records) || records.length === 0) return false;
    return records.every((rec) => Boolean(rec?.address) && !isPrivateOrLocalHostname(rec.address));
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
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

const PROTO_POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_MONGO_KEY_SCAN_DEPTH = 20;

export const hasDangerousMongoKeys = (obj: unknown, depth = 0): boolean => {
  if (depth > MAX_MONGO_KEY_SCAN_DEPTH) return true;
  if (!obj || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return obj.some((item) => hasDangerousMongoKeys(item, depth + 1));
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (key.startsWith('$') || key.includes('.') || PROTO_POLLUTION_KEYS.has(key)) return true;
    const val = (obj as Record<string, unknown>)[key];
    if (val && typeof val === 'object' && hasDangerousMongoKeys(val, depth + 1)) return true;
  }
  return false;
};
