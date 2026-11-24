import crypto from 'crypto';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { UserModel } from '../models/User.js';
import { ThreadModel } from '../models/Thread.js';
import { CommentModel } from '../models/Comment.js';
import { ReviewModel } from '../models/Review.js';
import { IncidentModel } from '../models/Incident.js';
import { CommunityMessageModel } from '../models/CommunityMessage.js';
import { ContributionModel } from '../models/Contribution.js';
import { NotificationModel } from '../models/Notification.js';
import { GuideModel } from '../models/Guide.js';
import { TripPlanModel } from '../models/TripPlan.js';
import {
  hashPasswordAsync,
  verifyPasswordAsync,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  parseCookieValue,
} from '../utils/auth.js';
import { sendResetPasswordEmail, sendAccountActivationEmail } from '../utils/mailer.js';
import { cloudinary, isCloudinaryConfigured } from '../config/cloudinarySDK.js';
import {
  validateEmail,
  validatePasswordStrength,
  validateFullName,
  validateOtpCode,
  sanitizeInput,
  validateUsername,
  deriveUsernameFromFullName,
  generateUsernameSuggestions,
  validatePhoneNumber,
  isSafeHttpUrl,
} from '../utils/validation.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

const OTP_TTL_MS = 15 * 60 * 1000; // 15 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const RESET_EMAIL_COOLDOWN_MS = 60 * 1000; // 60 seconds
const DATA_IMAGE_REGEX = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/;
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PROFILE_BASE64_CHARS = 7_000_000;
const DEFAULT_AVATAR_URL =
  'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329093/trekmap/avatars/avatar_user_1.jpg';

const REFRESH_COOKIE_NAME = 'lost_refresh';

function setRefreshTokenCookie(res: Response, refreshToken: string) {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}`,
    'HttpOnly',
    'Path=/api/auth',
    'SameSite=Lax',
    `Max-Age=${30 * 24 * 60 * 60}`,
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearRefreshTokenCookie(res: Response) {
  const isProd = process.env.NODE_ENV === 'production';
  const suffix = isProd ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${REFRESH_COOKIE_NAME}=; HttpOnly; Path=/api/auth; SameSite=Lax; Max-Age=0${suffix}`
  );
}

function generateSecureOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashTokenValue(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function hasValidProfileImageMagicBytes(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true; // PNG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true; // JPEG
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return true; // WEBP
  }
  return false;
}

function buildFullUserPayload(user: any) {
  const uid = String(user._id || user.id);
  return {
    id: uid,
    username: user.username || (user.email ? user.email.split('@')[0] : 'trekker'),
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl || '',
    coverUrl: user.coverUrl || '',
    role: user.role || 'user',
    authProvider: user.authProvider || 'local',
    isEmailVerified: Boolean(user.isEmailVerified),
    reputationScore: user.reputationScore ?? 50,
    badges: user.badges || ['Trekker Mới'],
    checkedInTrails: user.checkedInTrails || [],
    savedTrails: user.savedTrails || [],
    phone: user.phone || '',
    bio: user.bio || '',
    emergencyContact: user.emergencyContact || '',
    preferredStyle: user.preferredStyle || 'Trekking & Camping',
    gearLocker: user.gearLocker || [],
    followersCount: user.followersCount ?? 0,
    followingCount: user.followingCount ?? 0,
    tripReportsCount: user.tripReportsCount ?? 0,
    createdAt: user.createdAt || new Date(),
  };
}

/**
 * Verifies Google OAuth Token (ID Token or Access Token) against Google's official endpoints.
 * Enforces `email_verified === true`, strict `aud`/`azp === GOOGLE_CLIENT_ID`, and network timeouts.
 */
async function verifyGoogleToken(
  googleToken: string
): Promise<{ email: string; name: string; picture: string } | null> {
  const expectedClientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  if (!expectedClientId) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Google OAuth Security Error]: GOOGLE_CLIENT_ID must be set in production.');
      return null;
    }
    console.warn('[Google OAuth Warning]: GOOGLE_CLIENT_ID is not set; audience pinning disabled in dev mode.');
  }

  try {
    // 1. Try ID Token verification via tokeninfo (includes `aud` & `email_verified`)
    const idInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(googleToken)}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (idInfoRes.ok) {
      const idData: any = await idInfoRes.json();
      const emailVerified = idData.email_verified === true || idData.email_verified === 'true';
      const audMatches = !expectedClientId || idData.aud === expectedClientId || idData.azp === expectedClientId;
      if (idData?.email && emailVerified && audMatches) {
        return {
          email: String(idData.email).toLowerCase().trim(),
          name: idData.name || idData.given_name || 'Google Trekker',
          picture: idData.picture || '',
        };
      }
      return null;
    }

    // 2. Fallback: Verify Access Token via tokeninfo?access_token=... then fetch userinfo
    const accessInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(googleToken)}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!accessInfoRes.ok) return null;
    const accessInfo: any = await accessInfoRes.json();
    const audMatches = !expectedClientId || accessInfo.aud === expectedClientId || accessInfo.azp === expectedClientId;
    if (!audMatches) return null;

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${googleToken}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!userInfoRes.ok) return null;
    const userInfo: any = await userInfoRes.json();
    const emailVerified = userInfo.email_verified === true || userInfo.email_verified === 'true';
    if (!userInfo?.email || !emailVerified) return null;

    return {
      email: String(userInfo.email).toLowerCase().trim(),
      name: userInfo.name || userInfo.given_name || 'Google Trekker',
      picture: userInfo.picture || '',
    };
  } catch (err) {
    console.error('[Google OAuth Token Verification Error]:', err);
    return null;
  }
}

async function isUsernameTaken(username: string, excludeUserId?: string): Promise<boolean> {
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const query: any = { username: { $regex: new RegExp(`^${escaped}$`, 'i') } };
  if (excludeUserId && mongoose.Types.ObjectId.isValid(excludeUserId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludeUserId) };
  }
  const existing = await UserModel.findOne(query).select('_id').lean();
  return Boolean(existing);
}

export const googleAuth = async (req: Request, res: Response) => {
  const { token: googleToken, accessToken, idToken } = req.body || {};
  const tokenToVerify = googleToken || accessToken || idToken;

  if (!tokenToVerify || typeof tokenToVerify !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Thiếu mã xác thực Google OAuth (Token). Vui lòng đăng nhập lại.',
    });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Cơ sở dữ liệu tạm thời gián đoạn. Vui lòng thử lại sau.',
    });
  }

  const googleProfile = await verifyGoogleToken(tokenToVerify);
  if (!googleProfile || !googleProfile.email) {
    return res.status(401).json({
      success: false,
      message: 'Xác thực tài khoản Google không thành công. Token không hợp lệ hoặc chưa xác minh email.',
    });
  }

  const cleanEmail = googleProfile.email;
  const name = googleProfile.name;
  const picture = googleProfile.picture;

  try {
    let user = await UserModel.findOne({ email: cleanEmail });

    if (!user) {
      const baseUser = deriveUsernameFromFullName(name, cleanEmail).slice(0, 18);
      const uniqueUsername = `${baseUser}_${crypto.randomBytes(3).toString('hex')}`;
      const randomHash = await hashPasswordAsync(crypto.randomBytes(32).toString('hex'));

      user = await UserModel.create({
        username: uniqueUsername,
        email: cleanEmail,
        passwordHash: randomHash,
        fullName: sanitizeInput(name || 'Google Trekker').slice(0, 60),
        avatarUrl: picture && isSafeHttpUrl(picture) ? picture : DEFAULT_AVATAR_URL,
        role: 'user',
        authProvider: 'google',
        isEmailVerified: true,
        tokenVersion: 0,
        reputationScore: 100,
        badges: ['Google Verified', 'Verified Trekker'],
      });
    } else {
      if (user.isBanned) {
        return res.status(403).json({
          success: false,
          isBanned: true,
          message: 'Tài khoản này đã bị Ban Quản Trị khóa vĩnh viễn do vi phạm quy định hoặc báo động giả.',
        });
      }

      user.isEmailVerified = true;
      if (!user.username) {
        const baseUser = deriveUsernameFromFullName(name, cleanEmail).slice(0, 18);
        user.username = `${baseUser}_${crypto.randomBytes(3).toString('hex')}`;
      }
      if (!user.avatarUrl && picture && isSafeHttpUrl(picture)) {
        user.avatarUrl = picture;
      }
      await user.save();
    }

    const userId = String(user._id);
    const token = generateToken(userId, user.email, user.role || 'user', user.tokenVersion || 0);
    setRefreshTokenCookie(res, generateRefreshToken(userId, user.email, user.role || 'user', user.tokenVersion || 0));

    return res.json({
      success: true,
      message: `Xin chào ${user.fullName || name}! Đăng nhập Google thành công.`,
      token,
      user: buildFullUserPayload(user),
    });
  } catch (err) {
    console.error('[Google Auth Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xử lý đăng nhập Google. Vui lòng thử lại sau.',
    });
  }
};

export const checkUsername = async (req: Request, res: Response) => {
  const username = req.query.username as string;
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ success: false, message: 'Thiếu tham số username.' });
  }

  const userRes = validateUsername(username);
  if (!userRes.isValid) {
    return res.json({ available: false, message: userRes.message });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ available: false, message: 'Cơ sở dữ liệu tạm thời gián đoạn.' });
  }

  try {
    const taken = await isUsernameTaken(userRes.cleanUsername);
    if (taken) {
      const suggestions = await generateUsernameSuggestions(userRes.cleanUsername, (cand) => isUsernameTaken(cand));
      return res.json({ available: false, isDuplicate: true, suggestions });
    }

    return res.json({ available: true, message: 'Tên tài khoản này có thể sử dụng!' });
  } catch {
    return res.status(500).json({ available: false, message: 'Lỗi máy chủ kiểm tra username.' });
  }
};

export const register = async (req: Request, res: Response) => {
  const { email, password, fullName, username } = req.body || {};

  const emailRes = validateEmail(email);
  if (!emailRes.isValid) {
    return res.status(400).json({ success: false, message: emailRes.message });
  }

  // Validate Vietnamese fullName cleanly (allows Vietnamese diacritics & spaces!)
  const rawFullName = typeof fullName === 'string' && fullName.trim() ? fullName : typeof username === 'string' ? username : '';
  const fnRes = validateFullName(rawFullName);
  if (!fnRes.isValid) {
    return res.status(400).json({ success: false, message: fnRes.message });
  }

  // If explicit username provided, validate strictly; otherwise auto-derive ASCII handle from Vietnamese fullName
  const hasExplicitUsername = typeof username === 'string' && username.trim().length > 0;
  let cleanUsername = '';
  if (hasExplicitUsername) {
    const userValRes = validateUsername(username);
    if (!userValRes.isValid) {
      return res.status(400).json({ success: false, message: userValRes.message });
    }
    cleanUsername = userValRes.cleanUsername;
  } else {
    cleanUsername = deriveUsernameFromFullName(fnRes.cleanName, emailRes.cleanEmail);
  }

  const pwdRes = validatePasswordStrength(password);
  if (!pwdRes.isValid) {
    return res.status(400).json({ success: false, message: pwdRes.message });
  }

  const cleanEmail = emailRes.cleanEmail;

  if (cleanEmail.endsWith('@gmail.com') || cleanEmail.endsWith('@googlemail.com')) {
    return res.status(400).json({
      success: false,
      isGoogleWarning: true,
      message: `Địa chỉ email '${cleanEmail}' thuộc hệ sinh thái Google. Vui lòng chọn phương thức 'Đăng nhập bằng Google' ở bên dưới để đăng nhập nhanh & an toàn hơn!`,
    });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng để tạo tài khoản.' });
  }

  try {
    const emailExisting = await UserModel.findOne({ email: cleanEmail }).select('_id isEmailVerified').lean();
    if (emailExisting) {
      if (emailExisting.isEmailVerified === false) {
        return res.status(409).json({
          success: false,
          requiresActivation: true,
          isUnverifiedExisting: true,
          email: cleanEmail,
          message: `Email (${cleanEmail}) đã được đăng ký nhưng chưa kích hoạt. Vui lòng dùng tính năng "Gửi lại mã OTP" để kích hoạt tài khoản.`,
        });
      }

      return res.status(409).json({
        success: false,
        message: 'Email này đã được đăng ký trên hệ thống. Vui lòng bấm "Đăng nhập"!',
      });
    }

    // Handle username collision cleanly: auto-suffix if auto-derived, or return suggestions if explicitly chosen
    if (await isUsernameTaken(cleanUsername)) {
      if (hasExplicitUsername) {
        const suggestions = await generateUsernameSuggestions(cleanUsername, (cand) => isUsernameTaken(cand));
        return res.status(409).json({
          success: false,
          isDuplicateUsername: true,
          suggestions,
          message: `Tên tài khoản "${cleanUsername}" đã có người sử dụng. Vui lòng chọn một gợi ý bên dưới.`,
        });
      }
      cleanUsername = `${cleanUsername.slice(0, 20)}_${crypto.randomBytes(3).toString('hex')}`;
    }

    const passwordHash = await hashPasswordAsync(password);
    const rawActivationToken = generateSecureToken();
    const rawActivationCode = generateSecureOtp();
    const activationExpires = new Date(Date.now() + OTP_TTL_MS);

    const user = await UserModel.create({
      username: cleanUsername,
      email: cleanEmail,
      passwordHash,
      fullName: fnRes.cleanName,
      avatarUrl: DEFAULT_AVATAR_URL,
      role: 'user',
      authProvider: 'local',
      isEmailVerified: false,
      tokenVersion: 0,
      activationCode: hashTokenValue(rawActivationCode),
      activationToken: hashTokenValue(rawActivationToken),
      activationExpires,
      otpFailedAttempts: 0,
      otpLastSentAt: new Date(),
      reputationScore: 50,
      badges: ['Trekker Mới'],
    });

    sendAccountActivationEmail(cleanEmail, fnRes.cleanName, rawActivationCode).catch((err) =>
      console.error('[Background Email Error]:', err)
    );

    const userId = String(user._id);

    return res.status(201).json({
      success: true,
      requiresActivation: true,
      email: cleanEmail,
      user: {
        id: userId,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      message: `Đăng ký thành công! Vui lòng nhập mã OTP 6 số đã gửi tới email ${cleanEmail} trong vòng 15 phút để kích hoạt.`,
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      const dupField = Object.keys(err.keyPattern || {})[0];
      if (dupField === 'username') {
        const suggestions = await generateUsernameSuggestions(cleanUsername, (cand) => isUsernameTaken(cand)).catch(
          () => []
        );
        return res.status(409).json({
          success: false,
          isDuplicateUsername: true,
          suggestions,
          message: 'Tên tài khoản đã tồn tại trên hệ thống. Vui lòng chọn tên khác.',
        });
      }
      return res.status(409).json({ success: false, message: 'Tên tài khoản hoặc Email đã tồn tại trên hệ thống.' });
    }
    console.error('[Register Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi cơ sở dữ liệu khi tạo tài khoản.' });
  }
};

export const verifyCode = async (req: Request, res: Response) => {
  const { email, code } = req.body || {};

  const emailRes = validateEmail(email);
  if (!emailRes.isValid) {
    return res.status(400).json({ success: false, message: emailRes.message });
  }

  const otpRes = validateOtpCode(code);
  if (!otpRes.isValid) {
    return res.status(400).json({ success: false, message: otpRes.message });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
  }

  const cleanEmail = emailRes.cleanEmail;
  const cleanCode = otpRes.cleanCode;
  const hashedCode = hashTokenValue(cleanCode);

  try {
    const user = await UserModel.findOne({ email: cleanEmail }).select('+activationCode +activationToken');

    if (!user || !user.activationCode || !user.activationExpires) {
      return res.status(400).json({ success: false, message: 'Tài khoản không tồn tại hoặc mã OTP đã hết hạn.' });
    }

    if (user.activationExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP 6 số đã hết hạn. Vui lòng bấm "Gửi lại mã OTP" để nhận mã mới.',
      });
    }

    // Atomically increment attempt counter BEFORE verifying to block parallel OTP brute-force races
    const attemptDoc = await UserModel.findOneAndUpdate(
      { _id: user._id, otpFailedAttempts: { $lt: 5 } },
      { $inc: { otpFailedAttempts: 1 } },
      { new: true }
    ).select('otpFailedAttempts');

    if (!attemptDoc) {
      await UserModel.updateOne(
        { _id: user._id },
        { $unset: { activationCode: '', activationExpires: '' }, $set: { otpFailedAttempts: 0 } }
      );
      return res.status(429).json({
        success: false,
        message: 'Bạn đã nhập sai mã OTP quá 5 lần. Mã đã bị hủy vì lý do bảo mật. Vui lòng yêu cầu cấp lại mã mới.',
      });
    }

    // Support SHA-256 hashed OTP (and legacy 6-digit codes stored before hashing rollout)
    const isMatch =
      user.activationCode.length === 64
        ? timingSafeStringEqual(user.activationCode, hashedCode)
        : timingSafeStringEqual(user.activationCode, cleanCode);

    if (!isMatch) {
      const remaining = Math.max(0, 5 - (attemptDoc.otpFailedAttempts || 5));
      if (remaining === 0) {
        await UserModel.updateOne(
          { _id: user._id },
          { $unset: { activationCode: '', activationExpires: '' }, $set: { otpFailedAttempts: 0 } }
        );
      }
      return res.status(400).json({
        success: false,
        message: `Mã xác nhận OTP không chính xác. Bạn còn ${remaining} lần thử trước khi mã bị hủy.`,
      });
    }

    user.isEmailVerified = true;
    user.reputationScore = Math.max(user.reputationScore || 0, 50);
    if (!user.badges) user.badges = [];
    if (!user.badges.includes('Trekker Mới')) user.badges.push('Trekker Mới');
    if (!user.badges.includes('Verified Trekker')) user.badges.push('Verified Trekker');
    user.activationCode = undefined;
    user.activationToken = undefined;
    user.activationExpires = undefined;
    user.otpFailedAttempts = 0;
    await user.save();

    const userId = String(user._id);
    const token = generateToken(userId, user.email, user.role || 'user', user.tokenVersion || 0);
    setRefreshTokenCookie(res, generateRefreshToken(userId, user.email, user.role || 'user', user.tokenVersion || 0));

    return res.json({
      success: true,
      message: 'Kích hoạt tài khoản thành công! Bạn nhận được mặc định 50 điểm uy tín!',
      token,
      user: buildFullUserPayload(user),
    });
  } catch (err) {
    console.error('[Verify Code Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xác nhận mã OTP.' });
  }
};

export const resendOtp = async (req: Request, res: Response) => {
  const { email } = req.body || {};

  const emailRes = validateEmail(email);
  if (!emailRes.isValid) {
    return res.status(400).json({ success: false, message: emailRes.message });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
  }

  const cleanEmail = emailRes.cleanEmail;

  try {
    const user = await UserModel.findOne({ email: cleanEmail });
    if (!user || user.isEmailVerified) {
      return res.json({
        success: true,
        email: cleanEmail,
        message: 'Nếu tài khoản chưa được kích hoạt, mã OTP 6 số mới đã được gửi tới hộp thư của bạn.',
      });
    }

    if (user.otpLastSentAt && Date.now() - user.otpLastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - user.otpLastSentAt.getTime())) / 1000);
      return res.status(429).json({
        success: false,
        message: `Vui lòng đợi ${waitSec} giây trước khi yêu cầu gửi lại mã OTP.`,
      });
    }

    const newActivationCode = generateSecureOtp();
    user.activationCode = hashTokenValue(newActivationCode);
    user.activationExpires = new Date(Date.now() + OTP_TTL_MS);
    user.otpFailedAttempts = 0;
    user.otpLastSentAt = new Date();
    await user.save();

    sendAccountActivationEmail(cleanEmail, user.fullName || user.username, newActivationCode).catch((err) =>
      console.error('[Background Resend Email Error]:', err)
    );

    return res.json({
      success: true,
      email: cleanEmail,
      message: 'Nếu tài khoản chưa được kích hoạt, mã OTP 6 số mới đã được gửi tới hộp thư của bạn.',
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi gửi lại mã OTP.' });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ Email và Mật khẩu.' });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu tạm thời gián đoạn. Vui lòng thử lại.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const user = await UserModel.findOne({ email: cleanEmail }).select('+passwordHash');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.' });
    }

    // Security: never reveal authProvider before credential verification (prevents Google account enumeration)
    if (user.authProvider === 'google') {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.' });
    }

    const isValid = Boolean(user.passwordHash && (await verifyPasswordAsync(password, user.passwordHash)));
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.' });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        isBanned: true,
        message: 'Tài khoản này đã bị Ban Quản Trị khóa vĩnh viễn do vi phạm quy định hoặc báo động giả.',
      });
    }

    if (user.isEmailVerified === false) {
      return res.status(403).json({
        success: false,
        isNotVerified: true,
        email: cleanEmail,
        message: `Tài khoản (${cleanEmail}) chưa được kích hoạt! Vui lòng kiểm tra Email và nhập mã OTP kích hoạt trước khi đăng nhập.`,
      });
    }

    const userId = String(user._id);
    const resolvedRole = user.role || 'user';
    const token = generateToken(userId, user.email, resolvedRole, user.tokenVersion || 0);
    setRefreshTokenCookie(res, generateRefreshToken(userId, user.email, resolvedRole, user.tokenVersion || 0));

    return res.json({
      success: true,
      message: `Đăng nhập thành công! Chào mừng ${user.fullName} quay trở lại.`,
      token,
      user: buildFullUserPayload(user),
    });
  } catch (err) {
    console.error('[Login Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng nhập.' });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(401).json({ success: false, message: 'Không tìm thấy phiên đăng nhập hợp lệ.' });
  }

  try {
    const user = await UserModel.findById(userId).lean();
    if (!user) {
      return res.status(401).json({ success: false, message: 'Không tìm thấy thông tin tài khoản.' });
    }

    return res.json({
      success: true,
      user: buildFullUserPayload(user),
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy thông tin cá nhân.' });
  }
};

async function resolveProfileImageUpload(
  rawUrl: unknown,
  folder: 'lost/avatars' | 'lost/covers',
  publicIdPrefix: string,
  width: number
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (typeof rawUrl !== 'string') return { ok: false, error: 'Định dạng URL ảnh không hợp lệ.' };
  const trimmed = rawUrl.trim();
  if (!trimmed) return { ok: true, url: '' };

  if (trimmed.startsWith('data:image/')) {
    if (trimmed.length > MAX_PROFILE_BASE64_CHARS) {
      return { ok: false, error: 'Ảnh vượt quá kích thước tối đa 5MB.' };
    }
    const match = DATA_IMAGE_REGEX.exec(trimmed);
    if (!match) {
      return { ok: false, error: 'Định dạng ảnh Base64 không hợp lệ (chỉ chấp nhận PNG, JPEG, WEBP).' };
    }
    const buf = Buffer.from(match[2], 'base64');
    if (buf.length === 0 || buf.length > MAX_PROFILE_IMAGE_BYTES) {
      return { ok: false, error: 'Ảnh vượt quá kích thước tối đa 5MB.' };
    }
    if (!hasValidProfileImageMagicBytes(buf)) {
      return { ok: false, error: 'Nội dung tệp ảnh không hợp lệ.' };
    }
    if (!isCloudinaryConfigured()) {
      return { ok: false, error: 'Dịch vụ lưu trữ ảnh chưa được cấu hình.' };
    }
    const safePrefix = publicIdPrefix.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const cloudRes = await cloudinary.uploader.upload(trimmed, {
      folder,
      public_id: `${safePrefix}_${Date.now()}`,
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width, quality: 'auto', fetch_format: 'auto' }],
    });
    return { ok: true, url: cloudRes.secure_url };
  }

  if (isSafeHttpUrl(trimmed)) {
    return { ok: true, url: trimmed };
  }

  return { ok: false, error: 'Đường dẫn ảnh không hợp lệ (chỉ chấp nhận HTTPS hoặc dữ liệu ảnh Base64).' };
}

export const updateProfile = async (req: AuthRequest, res: Response) => {
  const { username, fullName, phone, bio, emergencyContact, preferredStyle, avatarUrl, coverUrl, gearLocker } =
    req.body || {};
  const userId = req.user?.userId;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
  }

  if (fullName !== undefined) {
    const fnRes = validateFullName(fullName);
    if (!fnRes.isValid) {
      return res.status(400).json({ success: false, message: fnRes.message });
    }
  }

  let validatedPhone: string | undefined;
  if (phone !== undefined) {
    const phoneRes = validatePhoneNumber(phone);
    if (!phoneRes.isValid) {
      return res.status(400).json({ success: false, message: phoneRes.message });
    }
    validatedPhone = phoneRes.cleanPhone;
  }

  let validatedUsername: string | undefined;
  if (username !== undefined) {
    const uRes = validateUsername(username);
    if (!uRes.isValid) {
      return res.status(400).json({ success: false, message: uRes.message });
    }
    validatedUsername = uRes.cleanUsername;
  }

  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản người dùng.' });
    }

    if (validatedUsername && validatedUsername.toLowerCase() !== (user.username || '').toLowerCase()) {
      if (await isUsernameTaken(validatedUsername, userId)) {
        const suggestions = await generateUsernameSuggestions(validatedUsername, (cand) => isUsernameTaken(cand));
        return res.status(409).json({
          success: false,
          isDuplicateUsername: true,
          suggestions,
          message: `Tên tài khoản "${validatedUsername}" đã có người sử dụng.`,
        });
      }
      user.username = validatedUsername;
    }

    if (typeof fullName === 'string' && fullName.trim()) user.fullName = sanitizeInput(fullName).slice(0, 60);
    if (validatedPhone !== undefined) user.phone = validatedPhone;
    if (typeof bio === 'string') user.bio = sanitizeInput(bio).slice(0, 500);
    if (typeof emergencyContact === 'string') user.emergencyContact = sanitizeInput(emergencyContact).slice(0, 100);
    if (typeof preferredStyle === 'string') user.preferredStyle = sanitizeInput(preferredStyle).slice(0, 100);

    if (avatarUrl !== undefined) {
      const avatarResult = await resolveProfileImageUpload(
        avatarUrl,
        'lost/avatars',
        `avatar_${user.username || userId}`,
        800
      );
      if (!avatarResult.ok) {
        return res.status(400).json({ success: false, message: avatarResult.error });
      }
      user.avatarUrl = avatarResult.url || DEFAULT_AVATAR_URL;
    }

    if (coverUrl !== undefined) {
      const coverResult = await resolveProfileImageUpload(
        coverUrl,
        'lost/covers',
        `cover_${user.username || userId}`,
        1400
      );
      if (!coverResult.ok) {
        return res.status(400).json({ success: false, message: coverResult.error });
      }
      user.coverUrl = coverResult.url || '';
    }

    if (Array.isArray(gearLocker)) {
      user.gearLocker = gearLocker
        .filter((item): item is string => typeof item === 'string')
        .slice(0, 50)
        .map((item) => sanitizeInput(item).slice(0, 80))
        .filter(Boolean);
    }

    if (!user.badges) user.badges = [];
    if (!user.badges.includes('Trekker Mới')) user.badges.push('Trekker Mới');
    if ((user.isEmailVerified || user.authProvider === 'google') && !user.badges.includes('Verified Trekker')) {
      user.badges.push('Verified Trekker');
    }

    await user.save();

    // Synchronize identity across collections STRICTLY by immutable userId
    try {
      const hasNewAvatar = Boolean(avatarUrl !== undefined && user.avatarUrl);
      const hasNewName = Boolean(typeof fullName === 'string' && user.fullName);

      if (hasNewAvatar || hasNewName) {
        const userIdStr = user._id.toString();
        await Promise.allSettled([
          ThreadModel.updateMany(
            { userId: user._id },
            {
              $set: {
                ...(hasNewAvatar ? { authorAvatar: user.avatarUrl } : {}),
                ...(hasNewName ? { authorName: user.fullName } : {}),
              },
            }
          ),
          CommentModel.updateMany(
            { userId: user._id },
            {
              $set: {
                ...(hasNewAvatar ? { authorAvatar: user.avatarUrl } : {}),
                ...(hasNewName ? { authorName: user.fullName } : {}),
              },
            }
          ),
          ReviewModel.updateMany(
            { userId: user._id },
            {
              $set: {
                ...(hasNewAvatar ? { userAvatar: user.avatarUrl } : {}),
                ...(hasNewName ? { userName: user.fullName } : {}),
              },
            }
          ),
          IncidentModel.updateMany(
            { reportedBy: { $in: [user._id, userIdStr] } },
            {
              $set: {
                ...(hasNewAvatar ? { reporterAvatar: user.avatarUrl } : {}),
                ...(hasNewName ? { reporterName: user.fullName } : {}),
              },
            }
          ),
          CommunityMessageModel.updateMany(
            { senderId: user._id },
            {
              $set: {
                ...(hasNewAvatar ? { senderAvatar: user.avatarUrl } : {}),
                ...(hasNewName ? { senderName: user.fullName } : {}),
              },
            }
          ),
          ContributionModel.updateMany(
            { userId: userIdStr },
            {
              $set: {
                ...(hasNewAvatar ? { authorAvatar: user.avatarUrl } : {}),
                ...(hasNewName ? { authorName: user.fullName } : {}),
              },
            }
          ),
          NotificationModel.updateMany(
            { 'sender.id': userIdStr },
            {
              $set: {
                ...(hasNewAvatar ? { 'sender.avatarUrl': user.avatarUrl } : {}),
                ...(hasNewName ? { 'sender.name': user.fullName } : {}),
              },
            }
          ),
          ...(hasNewName
            ? [
                GuideModel.updateMany(
                  { 'reviews.userId': user._id },
                  { $set: { 'reviews.$[elem].userName': user.fullName } },
                  { arrayFilters: [{ 'elem.userId': user._id }] }
                ),
                TripPlanModel.updateMany(
                  { 'sharedGear.assignedUserId': user._id },
                  { $set: { 'sharedGear.$[elem].assignedUserName': user.fullName } },
                  { arrayFilters: [{ 'elem.assignedUserId': user._id }] }
                ),
                TripPlanModel.updateMany(
                  { 'expenses.paidByUserId': user._id },
                  { $set: { 'expenses.$[elem].paidByName': user.fullName } },
                  { arrayFilters: [{ 'elem.paidByUserId': user._id }] }
                ),
              ]
            : []),
        ]);
      }
    } catch (syncErr) {
      console.warn('[Profile Cross-Collection Sync Warning]:', syncErr);
    }

    return res.json({
      success: true,
      message: 'Cập nhật hồ sơ cá nhân thành công!',
      user: buildFullUserPayload(user),
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: 'Tên tài khoản đã được sử dụng.' });
    }
    console.error('[Update Profile Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật hồ sơ.' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body || {};
  const emailRes = validateEmail(email);
  if (!emailRes.isValid) {
    return res.status(400).json({ success: false, message: emailRes.message });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
  }

  const cleanEmail = emailRes.cleanEmail;
  const genericResponse = {
    success: true,
    isGoogleAccount: false,
    email: cleanEmail,
    message: 'Nếu địa chỉ email đã được đăng ký, liên kết khôi phục mật khẩu đã được gửi tới hộp thư của bạn.',
  };

  try {
    const user = await UserModel.findOne({ email: cleanEmail });
    if (!user || user.isBanned) {
      return res.json(genericResponse);
    }

    // Do not leak whether a non-Gmail email uses Google OAuth; only advise for public @gmail domains
    if (user.authProvider === 'google') {
      if (cleanEmail.endsWith('@gmail.com') || cleanEmail.endsWith('@googlemail.com')) {
        return res.status(400).json({
          success: false,
          isGoogleAccount: true,
          message: `Tài khoản Google (${cleanEmail}) được quản lý trực tiếp bởi Google. Vui lòng sử dụng nút "Đăng nhập nhanh bằng Google"!`,
        });
      }
      return res.json(genericResponse);
    }

    // Per-account 60s cooldown prevents reset email flooding
    if (user.otpLastSentAt && Date.now() - user.otpLastSentAt.getTime() < RESET_EMAIL_COOLDOWN_MS) {
      return res.json(genericResponse);
    }

    const rawResetToken = generateSecureToken();
    const hashedResetToken = hashTokenValue(rawResetToken);
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000);

    user.resetPasswordToken = hashedResetToken;
    user.resetPasswordExpires = resetExpires;
    user.otpLastSentAt = new Date();
    await user.save();

    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    const resetLink = `${clientUrl}/?resetToken=${rawResetToken}&email=${encodeURIComponent(cleanEmail)}`;

    // Dispatch asynchronously to eliminate SMTP timing side-channels
    sendResetPasswordEmail(cleanEmail, resetLink).catch((err) =>
      console.error('[Background Reset Password Email Error]:', err)
    );

    return res.json(genericResponse);
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo liên kết reset mật khẩu.' });
  }
};

export const resetPasswordWithToken = async (req: Request, res: Response) => {
  const { resetToken, newPassword } = req.body || {};

  if (typeof resetToken !== 'string' || typeof newPassword !== 'string' || !resetToken.trim() || !newPassword) {
    return res.status(400).json({ success: false, message: 'Thiếu mã liên kết reset hoặc mật khẩu mới.' });
  }

  const pwdCheck = validatePasswordStrength(newPassword);
  if (!pwdCheck.isValid) {
    return res.status(400).json({ success: false, message: pwdCheck.message });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
  }

  try {
    const hashedToken = hashTokenValue(resetToken.trim());
    // Strictly match SHA-256 hashed token only (zero plaintext fallback)
    const user = await UserModel.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+resetPasswordToken');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Liên kết reset mật khẩu không hợp lệ hoặc đã hết hạn (quá 15 phút). Vui lòng thử lại.',
      });
    }

    user.passwordHash = await hashPasswordAsync(newPassword);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    clearRefreshTokenCookie(res);

    return res.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay bằng mật khẩu mới.',
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật mật khẩu.' });
  }
};

export const activateAccount = async (req: Request, res: Response) => {
  const rawToken = req.body?.activateToken || req.body?.token;
  if (!rawToken || typeof rawToken !== 'string') {
    return res.status(400).json({ success: false, message: 'Thiếu mã token kích hoạt tài khoản.' });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
  }

  try {
    const hashed = hashTokenValue(rawToken.trim());
    // Strictly match SHA-256 hashed activation token only
    const user = await UserModel.findOne({
      activationToken: hashed,
      activationExpires: { $gt: new Date() },
    }).select('+activationToken');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Liên kết kích hoạt tài khoản không hợp lệ hoặc đã hết hạn. Vui lòng sử dụng mã OTP 6 số.',
      });
    }

    user.isEmailVerified = true;
    user.reputationScore = Math.max(user.reputationScore || 0, 50);
    if (!user.badges) user.badges = [];
    if (!user.badges.includes('Trekker Mới')) user.badges.push('Trekker Mới');
    if (!user.badges.includes('Verified Trekker')) user.badges.push('Verified Trekker');
    user.activationCode = undefined;
    user.activationToken = undefined;
    user.activationExpires = undefined;
    user.otpFailedAttempts = 0;
    await user.save();

    const userId = String(user._id);
    const jwtToken = generateToken(userId, user.email, user.role || 'user', user.tokenVersion || 0);
    setRefreshTokenCookie(res, generateRefreshToken(userId, user.email, user.role || 'user', user.tokenVersion || 0));

    return res.json({
      success: true,
      email: user.email,
      message: 'Kích hoạt tài khoản qua liên kết thành công!',
      token: jwtToken,
      user: buildFullUserPayload(user),
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi kích hoạt tài khoản.' });
  }
};

export const logout = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.userId && mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(req.user.userId)) {
      await UserModel.updateOne({ _id: req.user.userId }, { $inc: { tokenVersion: 1 } });
    }
  } catch {
    // Best-effort revocation
  }
  clearRefreshTokenCookie(res);
  return res.json({ success: true, message: 'Đã đăng xuất tài khoản an toàn.' });
};

/**
 * POST /api/auth/refresh
 * Issues a fresh Access Token & rotates the HttpOnly Refresh Cookie after verifying DB user, ban, email verification, and tokenVersion.
 */
export const refreshSession = async (req: Request, res: Response) => {
  try {
    const rawCookie = parseCookieValue(req.headers.cookie, REFRESH_COOKIE_NAME);
    if (!rawCookie) {
      return res.status(401).json({ success: false, message: 'Thiếu phiên làm mới (Refresh Cookie).' });
    }

    const decoded = verifyRefreshToken(rawCookie);
    if (!decoded || !decoded.userId || !mongoose.Types.ObjectId.isValid(decoded.userId)) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ success: false, message: 'Phiên làm mới không hợp lệ hoặc đã hết hạn.' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu tạm thời gián đoạn.' });
    }

    const user = await UserModel.findById(decoded.userId).lean();
    if (!user) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ success: false, message: 'Tài khoản không còn tồn tại.' });
    }

    if (user.isBanned) {
      clearRefreshTokenCookie(res);
      return res.status(403).json({ success: false, isBanned: true, message: 'Tài khoản đã bị khóa vĩnh viễn.' });
    }

    if (user.isEmailVerified === false && user.authProvider === 'local') {
      clearRefreshTokenCookie(res);
      return res.status(403).json({ success: false, message: 'Tài khoản chưa được kích hoạt email.' });
    }

    const currentVersion = typeof user.tokenVersion === 'number' ? user.tokenVersion : 0;
    const tokenVersion = typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : 0;
    if (tokenVersion < currentVersion) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập đã bị thu hồi.' });
    }

    const uid = String(user._id);
    const role = (user.role || 'user') as any;
    const newAccessToken = generateToken(uid, user.email, role, currentVersion);
    const newRefreshToken = generateRefreshToken(uid, user.email, role, currentVersion);
    setRefreshTokenCookie(res, newRefreshToken);

    return res.json({
      success: true,
      token: newAccessToken,
      user: buildFullUserPayload(user),
    });
  } catch (err) {
    console.error('[Refresh Session Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi làm mới phiên đăng nhập.' });
  }
};
