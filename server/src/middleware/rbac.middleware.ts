import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware.js';

/**
 * Middleware to restrict route access to specific roles.
 * Usage: router.post('/admin/path', authMiddleware, requireRole('admin'), handler);
 */
export const requireRole = (...allowedRoles: Array<'user' | 'guide' | 'admin' | 'moderator'>) => {
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

/**
 * Helper to check if current user is owner of a resource or an admin.
 */
export const isOwnerOrAdmin = (req: AuthRequest, resourceUserId: string | object): boolean => {
  if (!req.user) return false;
  if (req.user.role === 'admin') return true;

  const ownerId = resourceUserId.toString();
  return req.user.userId === ownerId;
};
