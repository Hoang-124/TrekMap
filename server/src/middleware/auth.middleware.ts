import { Request, Response, NextFunction } from 'express';
import mongoose, { Types } from 'mongoose';
import { verifyToken, UserRole } from '../utils/auth.js';
import { UserModel } from '../models/User.js';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
  };
}

export const getUserKey = (req: Request): string => {
  const keys = getUserKeys(req);
  return keys[0];
};

export const getUserKeys = (req: Request): string[] => {
  const keys: string[] = [];

  const authReq = req as AuthRequest;
  if (authReq.user?.userId) {
    keys.push(String(authReq.user.userId));
    return keys;
  }

  // Only accept already-verified req.user for authenticated identity; guests get sanitized IP key (no dots)
  const ip = req.ip || req.socket.remoteAddress;
  if (ip) {
    keys.push(`ip_${String(ip).replace(/[^a-zA-Z0-9_-]/g, '_')}`);
  } else {
    keys.push('guest-session');
  }

  return keys;
};

/**
 * Strict JWT Authentication Middleware
 * - Verifies cryptographic signature, kind === 'access', & exp
 * - Fails CLOSED when MongoDB is disconnected or errors (revoked/banned users cannot bypass auth!)
 * - Matches strictly by immutable userId (NEVER falls back to email to prevent deleted-account takeover)
 */
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để thực hiện thao tác này.' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Hệ thống xác thực tạm thời gián đoạn do kết nối cơ sở dữ liệu. Vui lòng thử lại.',
      });
    }

    if (!Types.ObjectId.isValid(decoded.userId)) {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập không hợp lệ.',
      });
    }

    let user: any = null;
    try {
      user = await UserModel.findById(decoded.userId)
        .select('role isBanned email tokenVersion isEmailVerified')
        .lean();
    } catch (dbErr) {
      console.error('[Auth Middleware DB Error]:', dbErr);
      return res.status(503).json({
        success: false,
        message: 'Hệ thống xác thực tạm thời gián đoạn. Vui lòng thử lại.',
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản không tồn tại hoặc phiên đăng nhập không hợp lệ.',
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        isBanned: true,
        message:
          'Tài khoản của bạn đã bị Ban Quản Trị khóa vĩnh viễn do vi phạm quy định cộng đồng hoặc báo động giả.',
      });
    }

    const currentTokenVersion = typeof user.tokenVersion === 'number' ? user.tokenVersion : 0;
    const tokenVersion = typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : 0;
    if (tokenVersion < currentTokenVersion) {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.',
      });
    }

    req.user = {
      userId: user._id.toString(),
      email: user.email || decoded.email,
      role: (user.role || 'user') as UserRole,
    };
    return next();
  } catch (err) {
    console.error('[Auth Middleware Error]:', err);
    return res.status(401).json({ success: false, message: 'Lỗi xác thực người dùng.' });
  }
};

export const requireAuth = authMiddleware;

/**
 * Optional Authentication Middleware
 * Attaches req.user ONLY when token is valid AND verified against live MongoDB user state.
 * Fails safely to anonymous guest if DB is unavailable or token is invalid/revoked/banned.
 */
export const optionalAuthMiddleware = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      if (decoded && decoded.userId && mongoose.connection.readyState === 1 && Types.ObjectId.isValid(decoded.userId)) {
        const user = await UserModel.findById(decoded.userId)
          .select('role isBanned email tokenVersion')
          .lean();
        const currentVersion = typeof user?.tokenVersion === 'number' ? user.tokenVersion : 0;
        const tokenVersion = typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : 0;
        if (user && !user.isBanned && tokenVersion >= currentVersion) {
          req.user = {
            userId: user._id.toString(),
            email: user.email || decoded.email,
            role: (user.role || 'user') as UserRole,
          };
        }
      }
    }
  } catch {
    // Continue safely as anonymous guest
  }
  return next();
};
