import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * Password Hashing Utility using Node.js Built-in Crypto (PBKDF2)
 */
export const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

export const verifyPassword = (password: string, storedHash: string): boolean => {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
};

/**
 * JWT Token Generation with HMAC SHA-256 Signature
 */
export const generateToken = (userId: string, email: string): string => {
  const secret = process.env.JWT_SECRET || 'trekmap-jwt-secret-key-2026';
  const payload = Buffer.from(
    JSON.stringify({ userId, email, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })
  ).toString('base64');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${signature}`;
};

/**
 * JWT Token Verification & Expiration Checking
 */
export const verifyToken = (token: string): { userId: string; email: string } | null => {
  if (!token || !token.includes('.')) return null;
  const [payloadStr, signature] = token.split('.');
  const secret = process.env.JWT_SECRET || 'trekmap-jwt-secret-key-2026';
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  if (signature !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null; // Token Expired
    return { userId: payload.userId, email: payload.email };
  } catch (err) {
    return null;
  }
};

/**
 * Express Middleware for Protected Auth Routes
 */
export interface AuthRequest extends Request {
  user?: { userId: string; email: string };
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
