import crypto from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(crypto.pbkdf2);

const devEphemeralSecret = crypto.randomBytes(64).toString('hex');
let hasWarnedMissingSecret = false;

export const getJwtSecret = (): string => {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0) {
    return process.env.JWT_SECRET.trim();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable must be set in production!');
  }
  if (!hasWarnedMissingSecret) {
    console.warn(
      '[SECURITY WARNING]: JWT_SECRET is not configured. Using cryptographically secure ephemeral secret for this runtime session.'
    );
    hasWarnedMissingSecret = true;
  }
  return devEphemeralSecret;
};

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';
const MAX_PASSWORD_BYTES = 256;

// Synchronous variants preserved for CLI/seeder compatibility
export const hashPassword = (password: string): string => {
  const safePassword = String(password).slice(0, MAX_PASSWORD_BYTES);
  const salt = crypto.randomBytes(24).toString('hex');
  const hash = crypto
    .pbkdf2Sync(safePassword, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString('hex');
  return `pbkdf2:${PBKDF2_ITERATIONS}:${salt}:${hash}`;
};

export const verifyPassword = (password: string, storedHash: string): boolean => {
  if (!storedHash || typeof password !== 'string' || password.length > MAX_PASSWORD_BYTES) return false;

  try {
    if (storedHash.startsWith('pbkdf2:')) {
      const parts = storedHash.split(':');
      if (parts.length !== 4) return false;
      const [, iterStr, salt, expectedHash] = parts;
      const iterations = parseInt(iterStr, 10) || PBKDF2_ITERATIONS;
      if (iterations < 1000 || iterations > 1_000_000) return false;
      const hash = crypto.pbkdf2Sync(password, salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
      const a = Buffer.from(hash, 'hex');
      const b = Buffer.from(expectedHash, 'hex');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    }

    if (storedHash.includes(':')) {
      const [salt, expectedHash] = storedHash.split(':');
      const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
      const a = Buffer.from(hash, 'hex');
      const b = Buffer.from(expectedHash, 'hex');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    }
  } catch {
    return false;
  }

  return false;
};

// Non-blocking async PBKDF2 variants for Express HTTP handlers (prevents event-loop stalls)
export const hashPasswordAsync = async (password: string): Promise<string> => {
  const safePassword = String(password).slice(0, MAX_PASSWORD_BYTES);
  const salt = crypto.randomBytes(24).toString('hex');
  const derived = await pbkdf2Async(safePassword, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${salt}:${derived.toString('hex')}`;
};

export const verifyPasswordAsync = async (password: string, storedHash: string): Promise<boolean> => {
  if (!storedHash || typeof password !== 'string' || password.length > MAX_PASSWORD_BYTES) return false;

  try {
    if (storedHash.startsWith('pbkdf2:')) {
      const parts = storedHash.split(':');
      if (parts.length !== 4) return false;
      const [, iterStr, salt, expectedHash] = parts;
      const iterations = parseInt(iterStr, 10) || PBKDF2_ITERATIONS;
      if (iterations < 1000 || iterations > 1_000_000) return false;
      const derived = await pbkdf2Async(password, salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST);
      const a = Buffer.from(derived.toString('hex'), 'hex');
      const b = Buffer.from(expectedHash, 'hex');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    }

    if (storedHash.includes(':')) {
      const [salt, expectedHash] = storedHash.split(':');
      const derived = await pbkdf2Async(password, salt, 1000, 64, 'sha512');
      const a = Buffer.from(derived.toString('hex'), 'hex');
      const b = Buffer.from(expectedHash, 'hex');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    }
  } catch {
    return false;
  }

  return false;
};

/**
 * Returns true if a stored password hash uses legacy iteration count (< 100,000 PBKDF2 rounds)
 * so login can transparently rehash with modern parameters.
 */
export const needsPasswordRehash = (storedHash: string): boolean => {
  if (!storedHash || typeof storedHash !== 'string') return false;
  if (!storedHash.startsWith('pbkdf2:')) return true;
  const parts = storedHash.split(':');
  if (parts.length !== 4) return true;
  const iterations = parseInt(parts[1], 10);
  return !Number.isFinite(iterations) || iterations < PBKDF2_ITERATIONS;
};

export type UserRole = 'user' | 'guide' | 'admin' | 'moderator';

export interface DecodedTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  tokenVersion?: number;
}

export const generateToken = (
  userId: string,
  email: string,
  role: UserRole = 'user',
  tokenVersion: number = 0
): string => {
  const secret = getJwtSecret();
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      email,
      role,
      tokenVersion,
      kind: 'access',
      iat: Date.now(),
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${signature}`;
};

export const verifyToken = (token: string): DecodedTokenPayload | null => {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, signature] = parts;
  if (!payloadStr || !signature) return null;

  try {
    const secret = getJwtSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');

    if (signature.length !== expectedSig.length || !/^[0-9a-f]+$/i.test(signature)) return null;
    const isSigValid = crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'));
    if (!isSigValid) return null;

    // Decode base64url (also accepts standard base64 for previously issued access tokens)
    const normalizedB64 = payloadStr.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(normalizedB64, 'base64').toString('utf8'));

    // Security: Strictly reject refresh tokens submitted as Bearer access tokens
    if (payload.kind && payload.kind !== 'access') {
      return null;
    }
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || Date.now() > payload.exp) {
      return null;
    }
    if (!payload.userId || typeof payload.userId !== 'string') return null;

    return {
      userId: payload.userId,
      email: typeof payload.email === 'string' ? payload.email : '',
      role: (['user', 'guide', 'admin', 'moderator'].includes(payload.role) ? payload.role : 'user') as UserRole,
      tokenVersion: typeof payload.tokenVersion === 'number' ? payload.tokenVersion : 0,
    };
  } catch {
    return null;
  }
};

export const generateRefreshToken = (
  userId: string,
  email: string,
  role: UserRole = 'user',
  tokenVersion: number = 0
): string => {
  const secret = getJwtSecret();
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      email,
      role,
      tokenVersion,
      kind: 'refresh',
      iat: Date.now(),
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    })
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${signature}`;
};

export const verifyRefreshToken = (token: string): DecodedTokenPayload | null => {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, signature] = parts;
  if (!payloadStr || !signature) return null;

  try {
    const secret = getJwtSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
    if (signature.length !== expectedSig.length || !/^[0-9a-f]+$/i.test(signature)) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))) return null;

    const normalizedB64 = payloadStr.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(normalizedB64, 'base64').toString('utf8'));
    if (payload.kind !== 'refresh') return null;
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || Date.now() > payload.exp) return null;
    if (!payload.userId || typeof payload.userId !== 'string') return null;

    return {
      userId: payload.userId,
      email: typeof payload.email === 'string' ? payload.email : '',
      role: (['user', 'guide', 'admin', 'moderator'].includes(payload.role) ? payload.role : 'user') as UserRole,
      tokenVersion: typeof payload.tokenVersion === 'number' ? payload.tokenVersion : 0,
    };
  } catch {
    return null;
  }
};

export const parseCookieValue = (cookieHeader: string | undefined, name: string): string | null => {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) {
      const rawVal = part.slice(idx + 1).trim();
      try {
        return decodeURIComponent(rawVal);
      } catch {
        return null;
      }
    }
  }
  return null;
};
