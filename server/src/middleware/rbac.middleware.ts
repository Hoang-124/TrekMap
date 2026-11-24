import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware.js';
import { UserRole } from '../utils/auth.js';

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập để thực hiện thao tác này.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Quyền truy cập bị từ chối. Thao tác này yêu cầu quyền: ${allowedRoles.join(', ')}.`,
      });
    }

    return next();
  };
};

export const isOwnerOrAdmin = (
  req: AuthRequest,
  resourceUserId: string | { _id?: unknown; toString?: () => string } | null | undefined
): boolean => {
  if (!req.user || !resourceUserId) return false;
  if (req.user.role === 'admin') return true;

  const ownerId =
    typeof resourceUserId === 'object' && '_id' in resourceUserId && resourceUserId._id
      ? String(resourceUserId._id)
      : String(resourceUserId);
  return req.user.userId === ownerId;
};
