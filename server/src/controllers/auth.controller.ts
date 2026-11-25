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
import { FollowModel } from '../models/Follow.js';
import { SavedTrailModel } from '../models/SavedTrail.js';
import { CheckinModel } from '../models/Checkin.js';
import { SafetyTimerModel } from '../models/SafetyTimer.js';
import { ActivityModel } from '../models/Activity.js';
import { LiveBeaconModel } from '../models/LiveBeacon.js';
import { GearPackModel } from '../models/GearPack.js';
import { CustomRouteModel } from '../models/CustomRoute.js';
import { WeatherAlertSubModel } from '../models/WeatherAlertSub.js';
import { ItineraryModel } from '../models/Itinerary.js';
import { TrainingPlanModel } from '../models/TrainingPlan.js';
import { AiChatThreadModel } from '../models/AiChatThread.js';
import { GearChecklistModel } from '../models/GearChecklist.js';
import { GuideInquiryModel } from '../models/GuideInquiry.js';
import { TrailPoiModel } from '../models/TrailPoi.js';
import { TripReportModel } from '../models/TripReport.js';
import { UploadAssetModel } from '../models/UploadAsset.js';
import { ChallengeClaimModel } from '../models/ChallengeClaim.js';
import { TrailConditionModel } from '../models/TrailCondition.js';
import { ConversationModel } from '../models/Conversation.js';
import { MessageModel } from '../models/Message.js';
import { disconnectUserSockets, evictAllFromRoom } from '../config/socket.js';
import { sendNotification } from '../utils/notification.js';
import {
  hashPasswordAsync,
  verifyPasswordAsync,
  needsPasswordRehash,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  parseCookieValue,
} from '../utils/auth.js';
import { sendResetPasswordEmail, sendAccountActivationEmail } from '../utils/mailer.js';
import { getClientBaseUrl } from '../utils/clientUrl.js';
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
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='60' fill='%2312221a'/%3E%3Cpath d='M16 92 L48 44 L68 72 L82 54 L104 92 Z' fill='%231f6f4a'/%3E%3Cpath d='M48 44 L58 58 L44 62 L38 58 Z' fill='%23d4e9dd' opacity='0.85'/%3E%3Ccircle cx='84' cy='34' r='10' fill='%23d4a348' opacity='0.85'/%3E%3C/svg%3E";

const REFRESH_COOKIE_NAME = 'lost_refresh';

function resolveCookieSameSite(): 'Lax' | 'None' | 'Strict' {
  const raw = String(process.env.COOKIE_SAME_SITE || '').trim().toLowerCase();
  if (raw === 'none') return 'None';
  if (raw === 'strict') return 'Strict';
  return 'Lax';
}

function setRefreshTokenCookie(res: Response, refreshToken: string) {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSite = resolveCookieSameSite();
  const requireSecure = isProd || sameSite === 'None';
  const parts = [
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}`,
    'HttpOnly',
    'Path=/api/auth',
    `SameSite=${sameSite}`,
    `Max-Age=${30 * 24 * 60 * 60}`,
  ];
  if (requireSecure) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function clearRefreshTokenCookie(res: Response) {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSite = resolveCookieSameSite();
  const requireSecure = isProd || sameSite === 'None';
  const suffix = requireSecure ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `${REFRESH_COOKIE_NAME}=; HttpOnly; Path=/api/auth; SameSite=${sameSite}; Max-Age=0${suffix}`
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

interface GoogleJwk {
  kid?: string;
  kty: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
}

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GOOGLE_VALID_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const GOOGLE_JWKS_FORCE_REFRESH_COOLDOWN_MS = 60_000;
let cachedGoogleJwks: GoogleJwk[] = [];
let cachedGoogleJwksExpiresAt = 0;
let lastForcedJwksRefreshAt = 0;
let googleJwksInFlight: Promise<GoogleJwk[]> | null = null;

async function fetchGoogleJwks(forceRefresh = false): Promise<GoogleJwk[]> {
  const now = Date.now();
  if (!forceRefresh && cachedGoogleJwks.length > 0 && now < cachedGoogleJwksExpiresAt) {
    return cachedGoogleJwks;
  }
  if (forceRefresh && cachedGoogleJwks.length > 0 && now - lastForcedJwksRefreshAt < GOOGLE_JWKS_FORCE_REFRESH_COOLDOWN_MS) {
    // Cooldown protects against unauthenticated unknown-kid JWKS fetch amplification DoS
    return cachedGoogleJwks;
  }
  if (googleJwksInFlight) {
    return googleJwksInFlight;
  }
  if (forceRefresh) {
    lastForcedJwksRefreshAt = now;
  }

  const req = (async (): Promise<GoogleJwk[]> => {
    try {
      const res = await fetch(GOOGLE_JWKS_URL, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return cachedGoogleJwks;
      const json: any = await res.json();
      if (!Array.isArray(json?.keys)) return cachedGoogleJwks;

      let ttlMs = 60 * 60 * 1000; // Default 1 hour
      const cacheControl = res.headers.get('cache-control') || '';
      const maxAgeMatch = /max-age=(\d+)/i.exec(cacheControl);
      if (maxAgeMatch) {
        const secs = Number(maxAgeMatch[1]);
        if (Number.isFinite(secs) && secs > 0) {
          ttlMs = Math.max(5 * 60 * 1000, Math.min(24 * 60 * 60 * 1000, secs * 1000));
        }
      }

      cachedGoogleJwks = json.keys as GoogleJwk[];
      cachedGoogleJwksExpiresAt = Date.now() + ttlMs;
      return cachedGoogleJwks;
    } catch {
      return cachedGoogleJwks;
    } finally {
      googleJwksInFlight = null;
    }
  })();

  googleJwksInFlight = req;
  return req;
}

async function verifyGoogleIdTokenJwt(
  jwtToken: string,
  expectedClientId: string
): Promise<{ email: string; name: string; picture: string } | null> {
  const parts = jwtToken.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  let header: any;
  let payload: any;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (header?.alg !== 'RS256' || typeof header?.kid !== 'string' || !header.kid) {
    return null;
  }

  let keys = await fetchGoogleJwks(false);
  let matchingJwk = keys.find((k) => k.kid === header.kid && k.kty === 'RSA');
  if (!matchingJwk) {
    // Handle Google signing key rotation with a single forced JWKS refresh
    keys = await fetchGoogleJwks(true);
    matchingJwk = keys.find((k) => k.kid === header.kid && k.kty === 'RSA');
  }
  if (!matchingJwk) return null;

  let isValidSig = false;
  try {
    const publicKey = crypto.createPublicKey({ key: matchingJwk, format: 'jwk' });
    const sigBuf = Buffer.from(sigB64, 'base64url');
    isValidSig = crypto.verify('RSA-SHA256', Buffer.from(`${headerB64}.${payloadB64}`, 'ascii'), publicKey, sigBuf);
  } catch {
    return null;
  }
  if (!isValidSig) return null;

  // Validate standard OIDC claims (iss, exp, iat, aud/azp, email_verified)
  if (!GOOGLE_VALID_ISSUERS.has(String(payload?.iss || ''))) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp) || exp <= nowSec - 60) return null;
  const iat = Number(payload?.iat);
  if (Number.isFinite(iat) && iat > nowSec + 300) return null;

  if (!expectedClientId) return null;
  const aud = payload?.aud;
  const audMatches = Array.isArray(aud) ? aud.includes(expectedClientId) : aud === expectedClientId;
  if (!audMatches) return null;
  if (payload?.azp && payload.azp !== expectedClientId) return null;

  const emailVerified = payload?.email_verified === true || payload?.email_verified === 'true';
  if (!payload?.email || !emailVerified) return null;

  return {
    email: String(payload.email).toLowerCase().trim(),
    name: payload.name || payload.given_name || 'Google Trekker',
    picture: payload.picture || '',
  };
}

/**
 * Verifies Google OAuth Token strictly (anti-confused-deputy):
 * 1. ID Token JWT (3 parts): RS256 cryptographic signature via cached Google JWKS + strict `iss`/`exp`/`iat`/`aud === GOOGLE_CLIENT_ID`/`email_verified`.
 * 2. OAuth2 Access Token (GIS initTokenClient): verifies `aud === GOOGLE_CLIENT_ID` (and `azp`/`exp`) via `oauth2.googleapis.com/tokeninfo` BEFORE reading OIDC `userinfo`, and cross-checks `email`/`sub`.
 * Always fails closed when `GOOGLE_CLIENT_ID` is unset.
 */
async function verifyGoogleToken(
  googleToken: string
): Promise<{ email: string; name: string; picture: string } | null> {
  const expectedClientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  if (!expectedClientId) {
    console.error('[Google OAuth Security Error]: GOOGLE_CLIENT_ID is not configured; refusing unpinned OAuth verification.');
    return null;
  }

  try {
    // 1. Verify Google ID Token locally via cached JWKS RS256 signature
    if (googleToken.split('.').length === 3) {
      return await verifyGoogleIdTokenJwt(googleToken, expectedClientId);
    }

    // 2. Verify OAuth2 Access Token audience via Google's official tokeninfo endpoint (POST form body avoids query-string token logging)
    const tokenInfoRes = await fetch(GOOGLE_TOKENINFO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ access_token: googleToken }).toString(),
      signal: AbortSignal.timeout(6000),
    });
    if (!tokenInfoRes.ok) return null;
    const tokenInfo: any = await tokenInfoRes.json();

    // Strict audience pinning prevents confused-deputy replay of third-party OAuth access tokens
    const tokenAud = String(tokenInfo?.aud || '').trim();
    const tokenAzp = String(tokenInfo?.azp || '').trim();
    if (!tokenAud || tokenAud !== expectedClientId) {
      console.warn('[Google OAuth Security]: Rejected access token with mismatched audience.');
      return null;
    }
    if (tokenAzp && tokenAzp !== expectedClientId) {
      console.warn('[Google OAuth Security]: Rejected access token with mismatched azp.');
      return null;
    }

    const expiresIn = Number(tokenInfo?.expires_in);
    const expEpoch = Number(tokenInfo?.exp);
    const nowSec = Math.floor(Date.now() / 1000);
    const isUnexpired =
      (Number.isFinite(expiresIn) && expiresIn > 0) ||
      (Number.isFinite(expEpoch) && expEpoch > nowSec - 30);
    if (!isUnexpired) return null;

    if (tokenInfo?.email && !(tokenInfo.email_verified === true || tokenInfo.email_verified === 'true')) {
      return null;
    }

    // 3. Fetch verified profile claims from OIDC userinfo and cross-check against tokeninfo
    const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${googleToken}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!userInfoRes.ok) return null;
    const userInfo: any = await userInfoRes.json();
    const emailVerified = userInfo.email_verified === true || userInfo.email_verified === 'true';
    if (!userInfo?.email || !emailVerified) return null;

    const cleanEmail = String(userInfo.email).toLowerCase().trim();
    if (tokenInfo?.email && String(tokenInfo.email).toLowerCase().trim() !== cleanEmail) {
      return null;
    }
    if (tokenInfo?.sub && userInfo?.sub && String(tokenInfo.sub) !== String(userInfo.sub)) {
      return null;
    }

    return {
      email: cleanEmail,
      name: userInfo.name || userInfo.given_name || 'Google Trekker',
      picture: userInfo.picture || '',
    };
  } catch (err) {
    console.error('[Google OAuth Token Verification Error]:', err);
    return null;
  }
}

async function isUsernameTaken(username: string, excludeUserId?: string): Promise<boolean> {
  const trimmed = username.trim();
  const lower = trimmed.toLowerCase();
  const query: any = {
    $or: [{ usernameLower: lower }, { username: trimmed }],
  };
  if (excludeUserId && mongoose.Types.ObjectId.isValid(excludeUserId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludeUserId) };
  }
  const existing = await UserModel.findOne(query).select('_id').lean();
  return Boolean(existing);
}

export const googleAuth = async (req: Request, res: Response) => {
  const { token: googleToken, accessToken, idToken, password, currentPassword, linkPassword } = req.body || {};
  const tokenToVerify = googleToken || accessToken || idToken;
  const providedLinkPassword =
    typeof linkPassword === 'string' && linkPassword
      ? linkPassword
      : typeof currentPassword === 'string' && currentPassword
        ? currentPassword
        : typeof password === 'string' && password
          ? password
          : '';

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
    let user = await UserModel.findOne({ email: cleanEmail }).select('+passwordHash');

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

      const isPrivilegedRole = user.role === 'admin' || user.role === 'moderator';
      const isLocalAccount = user.authProvider !== 'google';

      // Block silent email-based auto-linking onto existing local or privileged (admin/moderator) accounts
      if (isLocalAccount || isPrivilegedRole) {
        if (!providedLinkPassword) {
          return res.status(isPrivilegedRole ? 403 : 409).json({
            success: false,
            requiresPasswordVerification: true,
            authProvider: user.authProvider || 'local',
            message: isPrivilegedRole
              ? 'Tài khoản quản trị/điều phối không cho phép tự động đăng nhập bằng Google khi chưa xác minh mật khẩu. Vui lòng đăng nhập bằng Email và Mật khẩu.'
              : 'Email này đã được đăng ký bằng mật khẩu trên LOST. Vui lòng đăng nhập bằng Email & Mật khẩu hoặc xác minh mật khẩu hiện tại để liên kết Google.',
          });
        }

        const passwordOk = Boolean(
          user.passwordHash && (await verifyPasswordAsync(providedLinkPassword, user.passwordHash))
        );
        if (!passwordOk) {
          return res.status(401).json({
            success: false,
            requiresPasswordVerification: true,
            message: 'Mật khẩu xác nhận không chính xác. Không thể liên kết tài khoản Google.',
          });
        }
      }

      if (user.authProvider === 'google') {
        user.isEmailVerified = true;
      }
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

    sendAccountActivationEmail(cleanEmail, fnRes.cleanName, rawActivationCode, rawActivationToken).catch((err) =>
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
      if (dupField === 'username' || dupField === 'usernameLower') {
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
    const newActivationToken = generateSecureToken();
    user.activationCode = hashTokenValue(newActivationCode);
    user.activationToken = hashTokenValue(newActivationToken);
    user.activationExpires = new Date(Date.now() + OTP_TTL_MS);
    user.otpFailedAttempts = 0;
    user.otpLastSentAt = new Date();
    await user.save();

    sendAccountActivationEmail(
      cleanEmail,
      user.fullName || user.username,
      newActivationCode,
      newActivationToken
    ).catch((err) => console.error('[Background Resend Email Error]:', err));

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

    // Transparently upgrade legacy 1,000-iter PBKDF2 hashes to 100,000 iterations on login
    if (user.passwordHash && needsPasswordRehash(user.passwordHash)) {
      try {
        user.passwordHash = await hashPasswordAsync(password);
        await user.save();
      } catch {
        // Non-fatal rehash failure
      }
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
  width: number,
  uploaderId: string
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
      exif: false,
      timeout: 20_000,
      transformation: [{ width, quality: 'auto', fetch_format: 'auto', flags: 'strip_profile' }],
    });

    if (cloudRes?.public_id && mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(uploaderId)) {
      const category = folder === 'lost/avatars' ? 'avatars' : 'covers';
      await UploadAssetModel.updateOne(
        { publicId: cloudRes.public_id },
        {
          $setOnInsert: {
            publicId: cloudRes.public_id,
            uploaderId: new mongoose.Types.ObjectId(uploaderId),
            category,
            secureUrl: cloudRes.secure_url || '',
            bytes: Number(cloudRes.bytes) || 0,
            format: String(cloudRes.format || ''),
          },
        },
        { upsert: true }
      ).catch((err) => console.warn('[Profile UploadAsset Tracking Notice]:', (err as Error).message));
    }

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
        800,
        userId
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
        1400,
        userId
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

    const clientUrl = getClientBaseUrl();
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
    let targetUserId = req.user?.userId;
    if (!targetUserId) {
      const rawCookie = parseCookieValue(req.headers.cookie, REFRESH_COOKIE_NAME);
      if (rawCookie) {
        const decodedRefresh = verifyRefreshToken(rawCookie);
        if (decodedRefresh?.userId) {
          targetUserId = decodedRefresh.userId;
        }
      }
    }
    if (targetUserId && mongoose.Types.ObjectId.isValid(targetUserId)) {
      if (mongoose.connection.readyState === 1) {
        await UserModel.updateOne({ _id: targetUserId }, { $inc: { tokenVersion: 1 } });
      }
      try {
        disconnectUserSockets(targetUserId);
      } catch {
        // Ignore if Socket.IO server is not initialized
      }
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

/**
 * POST /api/auth/change-password
 * Verifies current password (for accounts with local password), validates new password strength,
 * hashes with PBKDF2, increments tokenVersion to revoke older sessions, and issues fresh tokens.
 */
export const changePassword = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để đổi mật khẩu.' });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
  }

  const { currentPassword, newPassword } = req.body || {};
  const pwdCheck = validatePasswordStrength(newPassword);
  if (!pwdCheck.isValid) {
    return res.status(400).json({ success: false, message: pwdCheck.message });
  }

  try {
    const user = await UserModel.findById(userId).select('+passwordHash');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản người dùng.' });
    }

    if (user.authProvider === 'google') {
      return res.status(400).json({
        success: false,
        isGoogleAccount: true,
        message: 'Tài khoản đăng nhập bằng Google được quản lý bảo mật trực tiếp bởi Google và không dùng mật khẩu cục bộ.',
      });
    }

    if (user.passwordHash) {
      if (typeof currentPassword !== 'string' || !currentPassword) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu hiện tại.' });
      }
      const isCurrentValid = await verifyPasswordAsync(currentPassword, user.passwordHash);
      if (!isCurrentValid) {
        return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác.' });
      }
      if (currentPassword === newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại.',
        });
      }
    }

    user.passwordHash = await hashPasswordAsync(newPassword);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    const uid = String(user._id);
    const resolvedRole = (user.role || 'user') as any;
    const token = generateToken(uid, user.email, resolvedRole, user.tokenVersion);
    setRefreshTokenCookie(res, generateRefreshToken(uid, user.email, resolvedRole, user.tokenVersion));

    return res.json({
      success: true,
      message: 'Đổi mật khẩu thành công! Các phiên đăng nhập trên thiết bị khác đã được thu hồi.',
      token,
      user: buildFullUserPayload(user),
    });
  } catch (err) {
    console.error('[Change Password Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đổi mật khẩu.' });
  }
};

/**
 * DELETE /api/auth/me
 * Permanently deletes the authenticated user account after strict confirmation ("XÓA TÀI KHOẢN")
 * and current password verification (for local password accounts), clears personal data & cookies.
 */
export const deleteMyAccount = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để xóa tài khoản.' });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
  }

  const { confirmText, currentPassword } = req.body || {};
  const normalizedConfirm = typeof confirmText === 'string' ? confirmText.trim().normalize('NFC') : '';
  if (normalizedConfirm !== 'XÓA TÀI KHOẢN') {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng nhập chính xác cụm từ "XÓA TÀI KHOẢN" để xác nhận xóa vĩnh viễn.',
    });
  }

  try {
    const user = await UserModel.findById(userId).select('+passwordHash');
    if (!user) {
      clearRefreshTokenCookie(res);
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản người dùng.' });
    }

    if (user.authProvider !== 'google' && user.passwordHash) {
      if (typeof currentPassword !== 'string' || !currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập mật khẩu hiện tại để xác nhận xóa tài khoản.',
        });
      }
      const isPasswordValid = await verifyPasswordAsync(currentPassword, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu xác nhận không chính xác.',
        });
      }
    }

    const uid = user._id;
    const uidStr = uid.toString();

    // Update follower/following counters for peers before deleting follow edges
    try {
      const [userFollows, userFollowers] = await Promise.all([
        FollowModel.find({ followerId: uid }).select('followingId').lean(),
        FollowModel.find({ followingId: uid }).select('followerId').lean(),
      ]);
      const followedUserIds = userFollows.map((f) => f.followingId);
      const followerUserIds = userFollowers.map((f) => f.followerId);
      await FollowModel.deleteMany({ $or: [{ followerId: uid }, { followingId: uid }] });
      await Promise.allSettled([
        ...followedUserIds.map((targetId) =>
          UserModel.updateOne({ _id: targetId, followersCount: { $gt: 0 } }, { $inc: { followersCount: -1 } })
        ),
        ...followerUserIds.map((peerId) =>
          UserModel.updateOne({ _id: peerId, followingCount: { $gt: 0 } }, { $inc: { followingCount: -1 } })
        ),
      ]);
    } catch {
      // Best-effort peer counter adjustment
    }

    // Handle TripPlan cascade cleanly:
    // - Delete creator-owned / empty 0-member TripPlans (plus their squad group chats) so no orphan 0-member squads remain
    // - For retained multi-member TripPlans: transfer leadership to an existing remaining member if creator departed,
    //   reopen 'full' -> 'recruiting' when capacity opens, reset sharedGear (assignedUserName: 'Chưa nhận', packed: false),
    //   and scrub expenses.paidByName PII ('Tài khoản đã xóa')
    try {
      const affectedTrips = await TripPlanModel.find({
        $or: [
          { creatorId: uid },
          { currentMembers: uid },
          { 'pendingRequests.userId': uid },
          { 'sharedGear.assignedUserId': uid },
          { 'expenses.paidByUserId': uid },
        ],
      })
        .select('_id creatorId currentMembers maxMembers status title groupConversationId')
        .lean();

      for (const trip of affectedTrips) {
        const isCreator = String(trip.creatorId) === uidStr;
        const wasMember = (trip.currentMembers || []).some((m) => String(m) === uidStr);
        const remainingMemberIds = (trip.currentMembers || []).filter((m) => String(m) !== uidStr);

        let nextCreatorId: mongoose.Types.ObjectId | null = null;
        if (isCreator && remainingMemberIds.length > 0) {
          const existingUsers = await UserModel.find({ _id: { $in: remainingMemberIds } })
            .select('_id')
            .lean();
          const liveUserIds = new Set(existingUsers.map((u) => String(u._id)));
          const chosen = remainingMemberIds.find((m) => liveUserIds.has(String(m)));
          if (chosen) {
            nextCreatorId = new mongoose.Types.ObjectId(String(chosen));
          }
        }

        // Delete 0-member trips (or creator-owned trips with no live remaining members) + their group chats
        const shouldDeleteTrip = (isCreator && !nextCreatorId) || (wasMember && remainingMemberIds.length === 0);
        if (shouldDeleteTrip) {
          await TripPlanModel.deleteOne({ _id: trip._id });
          if (trip.groupConversationId) {
            evictAllFromRoom(`conv:${trip.groupConversationId.toString()}`);
            await Promise.allSettled([
              MessageModel.deleteMany({ conversation: trip.groupConversationId }),
              ConversationModel.deleteOne({ _id: trip.groupConversationId }),
            ]);
          }
          continue;
        }

        const setFields: Record<string, unknown> = {};
        if (isCreator && nextCreatorId) {
          setFields.creatorId = nextCreatorId;
        }
        if (wasMember) {
          setFields.settledTransfers = [];
          if (trip.status === 'full' && remainingMemberIds.length < (trip.maxMembers || 6)) {
            setFields.status = 'recruiting';
          }
        }

        await TripPlanModel.updateOne(
          { _id: trip._id },
          {
            $pull: { currentMembers: uid, pendingRequests: { userId: uid } },
            ...(Object.keys(setFields).length > 0 ? { $set: setFields } : {}),
          }
        );

        await Promise.allSettled([
          TripPlanModel.updateOne(
            { _id: trip._id, 'sharedGear.assignedUserId': uid },
            {
              $unset: { 'sharedGear.$[elem].assignedUserId': '' },
              $set: {
                'sharedGear.$[elem].assignedUserName': 'Chưa nhận',
                'sharedGear.$[elem].packed': false,
              },
            },
            { arrayFilters: [{ 'elem.assignedUserId': uid }] }
          ),
          TripPlanModel.updateOne(
            { _id: trip._id, 'expenses.paidByUserId': uid },
            {
              $unset: { 'expenses.$[elem].paidByUserId': '' },
              $set: { 'expenses.$[elem].paidByName': 'Tài khoản đã xóa' },
            },
            { arrayFilters: [{ 'elem.paidByUserId': uid }] }
          ),
          ...(trip.groupConversationId
            ? [
                ConversationModel.updateOne(
                  { _id: trip.groupConversationId },
                  { $pull: { participants: uid } }
                ),
              ]
            : []),
        ]);

        if (isCreator && nextCreatorId) {
          sendNotification({
            recipientId: nextCreatorId.toString(),
            type: 'system',
            category: 'social',
            title: 'Chuyển quyền trưởng đoàn',
            message: `Trưởng đoàn trước đã rời khỏi hệ thống. Quyền trưởng đoàn cho chuyến "${trip.title}" đã được chuyển cho bạn.`,
            link: '/forum?tab=trips',
            relatedId: trip._id.toString(),
          }).catch(() => {});
        }
      }
    } catch (tripCleanupErr) {
      console.warn('[Delete Account TripPlan Cascade Warning]:', (tripCleanupErr as Error).message);
    }

    // Handle Conversation & Message PII cascade (Decree 13/2023/NĐ-CP):
    // scrub departed user's sent DM/group messages, pull from participants/readBy, and delete 0-participant conversations
    try {
      const userConversations = await ConversationModel.find({ participants: uid }).select('_id participants').lean();
      if (userConversations.length > 0) {
        const emptyConvIds = userConversations
          .filter((c) => (c.participants || []).filter((p) => String(p) !== uidStr).length === 0)
          .map((c) => c._id);
        const sharedConvIds = userConversations
          .filter((c) => (c.participants || []).filter((p) => String(p) !== uidStr).length > 0)
          .map((c) => c._id);

        if (emptyConvIds.length > 0) {
          for (const cid of emptyConvIds) {
            evictAllFromRoom(`conv:${cid.toString()}`);
          }
          await Promise.allSettled([
            MessageModel.deleteMany({ conversation: { $in: emptyConvIds } }),
            ConversationModel.deleteMany({ _id: { $in: emptyConvIds } }),
          ]);
        }
        if (sharedConvIds.length > 0) {
          await ConversationModel.updateMany(
            { _id: { $in: sharedConvIds } },
            { $pull: { participants: uid } }
          );
        }
      }
    } catch (convCleanupErr) {
      console.warn('[Delete Account Conversation Cleanup Warning]:', (convCleanupErr as Error).message);
    }

    // Delete ALL private user records (including active GPS LiveBeacons, weather alerts, PII inquiries, assets)
    // and anonymize/scrub PII on all retained public/shared community records per Decree 13/2023/NĐ-CP
    await Promise.allSettled([
      SavedTrailModel.deleteMany({ userId: uid }),
      CheckinModel.deleteMany({ userId: uid }),
      SafetyTimerModel.deleteMany({ userId: uid }),
      ActivityModel.deleteMany({ userId: uid }),
      NotificationModel.deleteMany({ recipient: { $in: [uid, uidStr] } }),
      NotificationModel.updateMany(
        { 'sender.id': uidStr },
        { $set: { 'sender.name': 'Tài khoản đã xóa', 'sender.avatarUrl': '' } }
      ),
      LiveBeaconModel.deleteMany({ userId: uid }),
      GearPackModel.deleteMany({ userId: uid }),
      CustomRouteModel.deleteMany({ creatorId: uid }),
      CustomRouteModel.updateMany({ likedBy: uid }, { $pull: { likedBy: uid } }),
      WeatherAlertSubModel.deleteMany({ userId: uid }),
      ItineraryModel.deleteMany({ creatorId: uid }),
      TrainingPlanModel.deleteMany({ userId: uid }),
      AiChatThreadModel.deleteMany({ userId: uid }),
      GearChecklistModel.deleteMany({ userId: uid }),
      GuideInquiryModel.deleteMany({ userId: uid }),
      TrailPoiModel.deleteMany({ userId: uid }),
      TrailPoiModel.updateMany({ upvotes: uid }, { $pull: { upvotes: uid } }),
      TripReportModel.deleteMany({ authorId: uid }),
      UploadAssetModel.deleteMany({ uploaderId: uid }),
      ChallengeClaimModel.deleteMany({ userId: uid }),
      TrailConditionModel.deleteMany({ userId: uid }),
      TrailConditionModel.updateMany({ upvotedUsers: uid }, { $pull: { upvotedUsers: uid } }),
      // Scrub retained DM/group messages & lastMessage previews authored by departed user
      MessageModel.updateMany(
        { sender: uid },
        { $set: { content: 'Tin nhắn từ tài khoản đã xóa', images: [], isDeleted: true } }
      ),
      MessageModel.updateMany({ readBy: uid }, { $pull: { readBy: uid } }),
      ConversationModel.updateMany(
        { 'lastMessage.sender': uid },
        { $set: { 'lastMessage.content': 'Tin nhắn từ tài khoản đã xóa' } }
      ),
      // Scrub PII emails & anonymize public contributions (including embedded Incident & Guide subdocs)
      IncidentModel.updateMany(
        { reportedBy: { $in: [uid, uidStr] } },
        { $set: { reporterName: 'Tài khoản đã xóa', reporterEmail: '', reporterAvatar: '' } }
      ),
      IncidentModel.updateMany(
        { 'coReporters.userId': { $in: [uid, uidStr] } },
        {
          $set: {
            'coReporters.$[elem].userName': 'Tài khoản đã xóa',
            'coReporters.$[elem].userEmail': '',
            'coReporters.$[elem].userAvatar': '',
          },
        },
        { arrayFilters: [{ 'elem.userId': { $in: [uid, uidStr] } }] }
      ),
      IncidentModel.updateMany(
        { 'timelineUpdates.userId': { $in: [uid, uidStr] } },
        {
          $set: {
            'timelineUpdates.$[elem].userName': 'Tài khoản đã xóa',
            'timelineUpdates.$[elem].userEmail': '',
            'timelineUpdates.$[elem].userAvatar': '',
          },
        },
        { arrayFilters: [{ 'elem.userId': { $in: [uid, uidStr] } }] }
      ),
      IncidentModel.updateMany(
        { 'disputes.userId': { $in: [uid, uidStr] } },
        {
          $set: {
            'disputes.$[elem].userName': 'Tài khoản đã xóa',
            'disputes.$[elem].userEmail': '',
          },
        },
        { arrayFilters: [{ 'elem.userId': { $in: [uid, uidStr] } }] }
      ),
      GuideModel.updateMany(
        { 'reviews.userId': uid },
        { $set: { 'reviews.$[elem].userName': 'Tài khoản đã xóa' } },
        { arrayFilters: [{ 'elem.userId': uid }] }
      ),
      ContributionModel.updateMany(
        { userId: uidStr },
        { $set: { authorName: 'Tài khoản đã xóa', authorEmail: '', authorAvatar: '' } }
      ),
      ThreadModel.updateMany({ userId: uid }, { $set: { authorName: 'Tài khoản đã xóa', authorAvatar: '' } }),
      CommentModel.updateMany({ userId: uid }, { $set: { authorName: 'Tài khoản đã xóa', authorAvatar: '' } }),
      ReviewModel.updateMany({ userId: uid }, { $set: { userName: 'Tài khoản đã xóa', userAvatar: '' } }),
      ReviewModel.updateMany({ helpfulBy: uid }, { $pull: { helpfulBy: uid } }),
      TripReportModel.updateMany(
        { 'comments.authorId': uid },
        { $set: { 'comments.$[elem].authorName': 'Tài khoản đã xóa', 'comments.$[elem].authorAvatar': '' } },
        { arrayFilters: [{ 'elem.authorId': uid }] }
      ),
      CommunityMessageModel.updateMany(
        { senderId: uid },
        { $set: { senderName: 'Tài khoản đã xóa', senderAvatar: '' } }
      ),
    ]);

    await UserModel.deleteOne({ _id: uid });
    disconnectUserSockets(uidStr);
    clearRefreshTokenCookie(res);

    return res.json({
      success: true,
      message: 'Tài khoản của bạn đã được xóa vĩnh viễn khỏi hệ thống LOST.',
    });
  } catch (err) {
    console.error('[Delete Account Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa tài khoản.' });
  }
};
