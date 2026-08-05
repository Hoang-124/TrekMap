import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth.js';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
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

import { UserModel } from '../models/User.js';

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      if (decoded && decoded.userId) {
        req.user = decoded;
        return next();
      }
    }

    // Fallback for demo accounts or sessions with X-Client-Session-Id
    const clientSid = req.headers['x-client-session-id'] || (req.headers['X-Client-Session-Id'] as string);
    if (clientSid && typeof clientSid === 'string' && clientSid.trim()) {
      // Find or create single canonical 'Thiên Thiên' user document for guest/demo session
      let user = await UserModel.findOne({
        $or: [
          { username: 'thienthien' },
          { email: 'thienthien@trekmap.vn' },
          { fullName: 'Thiên Thiên' },
        ],
      });

      if (!user) {
        user = new UserModel({
          username: 'thienthien',
          email: 'thienthien@trekmap.vn',
          passwordHash: 'dummy-password-hash',
          fullName: 'Thiên Thiên',
          role: 'user',
          avatarUrl: 'https://ui-avatars.com/api/?name=Thien+Thien&background=10b981&color=fff',
        });
        await user.save();
      }

      req.user = {
        userId: String(user._id),
        email: user.email,
      };
      return next();
    }

    return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để thực hiện.' });
  } catch (err) {
    console.error('[Auth Middleware Error]:', err);
    return res.status(401).json({ success: false, message: 'Lỗi xác thực người dùng.' });
  }
};
