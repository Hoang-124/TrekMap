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
  logout,
} from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/google', googleAuth);
router.get('/check-username', checkUsername);
router.post('/register', register);
router.post('/verify-code', verifyCode);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.get('/me', getMe);
router.post('/profile', authMiddleware, updateProfile);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password-with-token', resetPasswordWithToken);
router.post('/logout', logout);

export default router;
