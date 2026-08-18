import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

// Secure random ephemeral secret generated once per process lifecycle when JWT_SECRET is not configured in development
const devEphemeralSecret = crypto.randomBytes(64).toString('hex');
let hasWarnedMissingSecret = false;

/**
 * Returns JWT signing secret with fail-fast validation for production
 */
export const getJwtSecret = (): string => {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0) {
    return process.env.JWT_SECRET.trim();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable must be set in production!');
  }
  if (!hasWarnedMissingSecret) {
    console.warn('⚠️ [SECURITY WARNING]: JWT_SECRET is not configured. Using cryptographically secure ephemeral secret for this runtime session.');
    hasWarnedMissingSecret = true;
  }
  return devEphemeralSecret;
};

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';

/**
 * Password Hashing Utility using OWASP-compliant PBKDF2-HMAC-SHA512 (100,000 iterations)
 */
export const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(24).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  return `pbkdf2:${PBKDF2_ITERATIONS}:${salt}:${hash}`;
};

/**
 * Verifies Password Hash with Timing-Safe Comparison & Backward Compatibility
 */
export const verifyPassword = (password: string, storedHash: string): boolean => {
  if (!storedHash) return false;

  try {
    // 1. Format: Modern OWASP standard `pbkdf2:<iterations>:<salt>:<hash>`
    if (storedHash.startsWith('pbkdf2:')) {
      const parts = storedHash.split(':');
      if (parts.length !== 4) return false;
      const [, iterStr, salt, expectedHash] = parts;
      const iterations = parseInt(iterStr, 10) || PBKDF2_ITERATIONS;
      const hash = crypto.pbkdf2Sync(password, salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
    }

    // 2. Format: Legacy backward compatibility `<salt>:<hash>` (1,000 iterations)
    if (storedHash.includes(':')) {
      const [salt, expectedHash] = storedHash.split(':');
      const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
    }
  } catch (err) {
    return false;
  }

  return false;
};

/**
 * JWT Token Generation with HMAC SHA-256 Signature
 */
export const generateToken = (userId: string, email: string, role: 'user' | 'guide' | 'admin' | 'moderator' = 'user'): string => {
  const secret = getJwtSecret();
  const payload = Buffer.from(
    JSON.stringify({ userId, email, role, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })
  ).toString('base64');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${signature}`;
};

/**
 * JWT Token Verification with Timing-Safe Comparison & Expiration Check
 */
export const verifyToken = (token: string): { userId: string; email: string; role: 'user' | 'guide' | 'admin' | 'moderator' } | null => {
  if (!token || !token.includes('.')) return null;
  const [payloadStr, signature] = token.split('.');
  if (!payloadStr || !signature) return null;

  try {
    const secret = getJwtSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');

    if (signature.length !== expectedSig.length) return null;
    const isSigValid = crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'));
    if (!isSigValid) return null;

    const payload = JSON.parse(Buffer.from(payloadStr, 'base64').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null; // Token Expired

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role || 'user',
    };
  } catch (err) {
    return null;
  }
};

/**
 * Express Middleware for Protected Auth Routes
 */
export interface AuthRequest extends Request {
  user?: { userId: string; email: string; role: 'user' | 'guide' | 'admin' | 'moderator' };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Yêu cầu Token xác thực.' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Token xác thực không hợp lệ hoặc đã hết hạn.' });
  }

  req.user = decoded;
  next();
};
