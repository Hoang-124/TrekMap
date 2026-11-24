import { Router } from 'express';
import {
  googleAuth,
  checkUsername,
  register,
  verifyCode,
  resendOtp,
  login,
  getMe,
  updateProfile,
  forgotPassword,
  resetPasswordWithToken,
  activateAccount,
  logout,
  refreshSession,
} from '../controllers/auth.controller.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware.js';
import { authRateLimiter, createRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

const usernameCheckLimiter = createRateLimiter(
  30,
  60 * 1000,
  'Kiểm tra tên tài khoản quá nhanh. Vui lòng đợi 1 phút.',
  'check-username'
);

const refreshRateLimiter = createRateLimiter(
  30,
  15 * 60 * 1000,
  'Yêu cầu làm mới phiên quá nhanh. Vui lòng thử lại sau.',
  'auth-refresh'
);

// Rate-limited authentication & recovery endpoints
router.post('/google', authRateLimiter, googleAuth);
router.post('/register', authRateLimiter, register);
router.post('/verify-code', authRateLimiter, verifyCode);
router.post('/activate-account', authRateLimiter, activateAccount);
router.post('/resend-otp', authRateLimiter, resendOtp);
router.post('/login', authRateLimiter, login);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.post('/reset-password-with-token', authRateLimiter, resetPasswordWithToken);

// Session, username lookup & profile endpoints
router.get('/check-username', usernameCheckLimiter, checkUsername);
router.get('/me', authMiddleware as any, getMe as any);
router.post('/profile', authMiddleware as any, updateProfile as any);
router.post('/refresh', refreshRateLimiter, refreshSession);
router.post('/logout', optionalAuthMiddleware as any, logout as any);

export default router;
