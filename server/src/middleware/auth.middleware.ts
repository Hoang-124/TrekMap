import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { verifyToken } from '../utils/auth.js';
import { UserModel } from '../models/User.js';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: 'user' | 'guide' | 'admin';
  };
}

export const getUserKey = (req: Request): string => {
  const keys = getUserKeys(req);
  return keys[0];
};

export const getUserKeys = (req: Request): string[] => {
  const keys: string[] = [];

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded && decoded.userId) {
      keys.push(String(decoded.userId));
    }
  }

  const clientSid = req.headers['x-client-session-id'] || (req.headers['X-Client-Session-Id'] as string);
  if (clientSid && typeof clientSid === 'string' && clientSid.trim()) {
    keys.push(`sid-${clientSid.trim()}`);
  }

  const ip = req.ip || req.socket.remoteAddress;
  if (ip) {
    keys.push(ip);
  }

  if (keys.length === 0) {
    keys.push('guest-session');
  }

  return keys;
};

/**
 * Strict JWT Authentication Middleware
 * Rejects unauthenticated requests with 401 Unauthorized.
 */
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      if (decoded && decoded.userId) {
        let role = decoded.role || 'user';
        let isBanned = false;
        
        // Check DB for latest role and ban status
        try {
          let user: any = null;
          if (Types.ObjectId.isValid(decoded.userId)) {
            user = await UserModel.findById(decoded.userId).select('role isBanned email');
          }
          if (!user && decoded.email) {
            user = await UserModel.findOne({ email: decoded.email.toLowerCase() }).select('role isBanned email');
          }
          if (user) {
            role = user.role;
            isBanned = !!user.isBanned;
          }
        } catch (dbErr) {
          // Ignore DB lookup error and fallback to decoded token
        }

        if (isBanned) {
          return res.status(403).json({
            success: false,
            isBanned: true,
            message: 'Tài khoản của bạn đã bị Ban Quản Trị khóa vĩnh viễn do vi phạm quy định cộng đồng hoặc báo động giả.',
          });
        }

        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          role,
        };
        return next();
      }
    }

    return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để thực hiện thao tác này.' });
  } catch (err) {
    console.error('[Auth Middleware Error]:', err);
    return res.status(401).json({ success: false, message: 'Lỗi xác thực người dùng.' });
  }
};

export const requireAuth = authMiddleware;

/**
 * Optional Authentication Middleware
 * Attaches req.user if token is present, but allows guests (req.user = undefined).
 */
export const optionalAuthMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      if (decoded && decoded.userId) {
        let role = decoded.role || 'user';
        let isBanned = false;

        try {
          let user: any = null;
          if (Types.ObjectId.isValid(decoded.userId)) {
            user = await UserModel.findById(decoded.userId).select('role isBanned email');
          }
          if (!user && decoded.email) {
            user = await UserModel.findOne({ email: decoded.email.toLowerCase() }).select('role isBanned email');
          }
          if (user) {
            role = user.role;
            isBanned = !!user.isBanned;
          }
        } catch (dbErr) {
          // Ignore DB lookup error
        }

        if (!isBanned) {
          req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role,
          };
        }
      }
    }
  } catch (err) {
    // Ignore errors for optional auth
  }
  return next();
};
