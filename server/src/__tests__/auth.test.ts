import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  authenticateToken,
  AuthRequest,
} from '../utils/auth.js';
import type { Response, NextFunction } from 'express';

describe('Authentication & Security Utils', () => {
  describe('Password Hashing (PBKDF2-HMAC-SHA512)', () => {
    it('should hash password and return formatted pbkdf2 hash', () => {
      const password = 'SecurePassword123!@#';
      const hash = hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash.startsWith('pbkdf2:100000:')).toBe(true);

      const parts = hash.split(':');
      expect(parts).toHaveLength(4);
      expect(parts[1]).toBe('100000'); // Iterations
      expect(parts[2].length).toBe(48); // Salt hex (24 bytes = 48 hex chars)
      expect(parts[3].length).toBe(128); // SHA-512 hex (64 bytes = 128 hex chars)
    });

    it('should produce unique salts and distinct hashes for the same password', () => {
      const password = 'SamePassword456';
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(hash1.split(':')[2]).not.toBe(hash2.split(':')[2]);
    });

    it('should correctly verify valid password against hash', () => {
      const password = 'TrekkerVietnam2026';
      const hash = hashPassword(password);

      expect(verifyPassword(password, hash)).toBe(true);
    });

    it('should reject incorrect password against hash', () => {
      const password = 'TrekkerVietnam2026';
      const wrongPassword = 'WrongPassword999';
      const hash = hashPassword(password);

      expect(verifyPassword(wrongPassword, hash)).toBe(false);
    });

    it('should support legacy backward-compatible hash format <salt>:<hash>', () => {
      // Legacy format generated with 1,000 iterations
      const crypto = require('crypto');
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync('legacyPass', salt, 1000, 64, 'sha512').toString('hex');
      const legacyHash = `${salt}:${hash}`;

      expect(verifyPassword('legacyPass', legacyHash)).toBe(true);
      expect(verifyPassword('wrongLegacyPass', legacyHash)).toBe(false);
    });

    it('should safely handle empty or invalid stored hashes without throwing', () => {
      expect(verifyPassword('any', '')).toBe(false);
      expect(verifyPassword('any', 'corrupted-hash')).toBe(false);
    });
  });

  describe('JWT Token Handling', () => {
    it('should generate valid signed token and successfully verify payload', () => {
      const userId = 'usr-test-12345';
      const email = 'trekker@trekmap.vn';
      const role = 'guide';

      const token = generateToken(userId, email, role);
      expect(token).toBeDefined();
      expect(token).toContain('.');

      const decoded = verifyToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(userId);
      expect(decoded?.email).toBe(email);
      expect(decoded?.role).toBe(role);
    });

    it('should reject tampered or modified token signature', () => {
      const token = generateToken('usr-1', 'test@trekmap.vn', 'user');
      const [payload, sig] = token.split('.');

      // Tamper payload by modifying one char
      const tamperedPayload = payload.slice(0, -2) + 'AA';
      const tamperedToken = `${tamperedPayload}.${sig}`;

      expect(verifyToken(tamperedToken)).toBeNull();
    });

    it('should reject malformed tokens without period separator', () => {
      expect(verifyToken('malformed-token-string')).toBeNull();
      expect(verifyToken('')).toBeNull();
    });

    it('should reject expired tokens', () => {
      const crypto = require('crypto');
      const secret = (process.env.JWT_SECRET || 'dev_secret').trim();
      const expiredPayload = Buffer.from(
        JSON.stringify({
          userId: 'usr-expired',
          email: 'expired@trekmap.vn',
          role: 'user',
          exp: Date.now() - 10000, // Expired 10s ago
        })
      ).toString('base64');
      const sig = crypto.createHmac('sha256', secret).update(expiredPayload).digest('hex');
      const expiredToken = `${expiredPayload}.${sig}`;

      expect(verifyToken(expiredToken)).toBeNull();
    });
  });

  describe('authenticateToken Express Middleware', () => {
    it('should call next() and populate req.user on valid bearer token', () => {
      const token = generateToken('usr-77', 'guide@trekmap.vn', 'guide');
      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as AuthRequest;

      let nextCalled = false;
      const res = {} as Response;
      const next: NextFunction = () => {
        nextCalled = true;
      };

      authenticateToken(req, res, next);
      expect(nextCalled).toBe(true);
      expect(req.user?.userId).toBe('usr-77');
      expect(req.user?.role).toBe('guide');
    });

    it('should return 401 status when Authorization header is missing', () => {
      const req = { headers: {} } as AuthRequest;
      let statusCode = 0;
      let responseBody: any = null;

      const res = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              responseBody = body;
            },
          };
        },
      } as unknown as Response;
      const next: NextFunction = () => {};

      authenticateToken(req, res, next);
      expect(statusCode).toBe(401);
      expect(responseBody.success).toBe(false);
    });

    it('should return 401 when token is invalid', () => {
      const req = {
        headers: { authorization: 'Bearer invalid.token.payload' },
      } as AuthRequest;
      let statusCode = 0;

      const res = {
        status: (code: number) => {
          statusCode = code;
          return { json: () => {} };
        },
      } as unknown as Response;
      const next: NextFunction = () => {};

      authenticateToken(req, res, next);
      expect(statusCode).toBe(401);
    });
  });
});
