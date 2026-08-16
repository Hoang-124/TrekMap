import React, { useState, useEffect } from 'react';
import type { UserProfile } from '../../types.js';

const UserIcon: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }> = ({ size = 18, color = 'currentColor', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const LockIcon: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }> = ({ size = 18, color = 'currentColor', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const MailIcon: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }> = ({ size = 18, color = 'currentColor', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const ShieldCheckIcon: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }> = ({ size = 18, color = 'currentColor', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const XIcon: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }> = ({ size = 18, color = 'currentColor', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CompassIcon: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }> = ({ size = 28, color = '#ffffff', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill={color} fillOpacity="0.25" />
  </svg>
);

const ArrowLeftIcon: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }> = ({ size = 18, color = 'currentColor', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const AlertTriangleIcon: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }> = ({ size = 18, color = 'currentColor', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const EyeIcon: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }> = ({ size = 18, color = 'currentColor', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }> = ({ size = 18, color = 'currentColor', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const SparklesIcon: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }> = ({ size = 18, color = 'currentColor', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
  </svg>
);

const RotateCwIcon: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }> = ({ size = 18, color = 'currentColor', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const User = UserIcon, Lock = LockIcon, Mail = MailIcon, ShieldCheck = ShieldCheckIcon, X = XIcon, Compass = CompassIcon, ArrowLeft = ArrowLeftIcon, AlertTriangle = AlertTriangleIcon, Eye = EyeIcon, EyeOff = EyeOffIcon, Sparkles = SparklesIcon, RotateCw = RotateCwIcon;

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  initialResetToken?: string | null;
  initialMode?: ModalMode;
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '6267095396-7kuh15jck2cbc52og2udrmhoinke8969.apps.googleusercontent.com';

type ModalMode = 'register' | 'login' | 'forgot-password' | 'reset-password-token' | 'verify-code';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  onShowToast,
  initialResetToken,
  initialMode,
}) => {
  const [mode, setMode] = useState<ModalMode>(initialMode || 'register');

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode, isOpen]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // Username suggestion state
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);

  // Password visibility toggle states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // OTP Resend Cooldown state
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Email Reset Link flow states
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isGoogleWarning, setIsGoogleWarning] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const clearAllFormFields = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setOtpCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setErrorMessage('');
    setUsernameSuggestions([]);
    setIsGoogleWarning(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowNewPassword(false);
  };

  const handleClose = () => {
    clearAllFormFields();
    onClose();
  };

  const handleSwitchMode = (newMode: ModalMode) => {
    clearAllFormFields();
    setMode(newMode);
    if (newMode === 'login') window.location.hash = '#login';
    if (newMode === 'register') window.location.hash = '#register';
  };

  useEffect(() => {
    if (initialResetToken) {
      setResetToken(initialResetToken);
      setMode('reset-password-token');
    }
  }, [initialResetToken]);

  useEffect(() => {
    if (!isOpen) {
      clearAllFormFields();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: 'Chưa nhập', color: '#64748b', percent: 0 };
    if (pwd.length < 8) return { score: 0, label: 'Yếu (Yêu cầu từ 8 ký tự trở lên)', color: '#ef4444', percent: 25 };

    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasDigit = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);

    if (hasLower && hasUpper && hasDigit && hasSpecial && pwd.length >= 10) {
      return { score: 3, label: 'Tốt (Đạt chuẩn bảo mật cao)', color: '#00ffd5', percent: 100 };
    }
    if (hasLower && hasUpper && hasDigit) {
      return { score: 2, label: 'Khá (Đạt yêu cầu)', color: '#10b981', percent: 75 };
    }
    if (hasLower && (hasUpper || hasDigit)) {
      return { score: 1, label: 'Trung Bình (Cần thêm chữ hoa & số)', color: '#fbbf24', percent: 50 };
    }

    return { score: 0, label: 'Yếu', color: '#ef4444', percent: 25 };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (mode === 'register') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setErrorMessage('Địa chỉ Email không đúng định dạng (Ví dụ: name@domain.com).');
        return;
      }
      if (!fullName.trim() || fullName.trim().length < 2) {
        setErrorMessage('Họ và tên phải có ít nhất 2 ký tự.');
        return;
      }
      const strength = getPasswordStrength(password);
      if (strength.score < 2) {
        setErrorMessage('Mật khẩu phải đạt Mức Khá trở lên (Tối thiểu 8 ký tự, bao gồm chữ hoa A-Z, chữ thường a-z và chữ số 0-9).');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Mật khẩu nhập lại không trùng khớp.');
        return;
      }
    }

    // Smart Google Email Domain Interception
    const cleanEmail = email.trim().toLowerCase();
    if (mode === 'register' && (cleanEmail.endsWith('@gmail.com') || cleanEmail.endsWith('@googlemail.com'))) {
      setIsGoogleWarning(true);
      setErrorMessage(`Địa chỉ email '${cleanEmail}' thuộc hệ sinh thái Google. Vui lòng chọn phương thức 'Đăng nhập bằng Google' ở bên dưới để đăng nhập nhanh & an toàn hơn!`);
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = mode === 'register' ? 'http://localhost:5000/api/auth/register' : 'http://localhost:5000/api/auth/login';
      const body = mode === 'register' ? { email, password, fullName } : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      setIsLoading(false);

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Thao tác thất bại, vui lòng thử lại.');
        if (data.isDuplicateUsername && data.suggestions) {
          setUsernameSuggestions(data.suggestions);
        }
        return;
      }

      if (mode === 'register' && data.requiresActivation) {
        if (onShowToast) {
          onShowToast(data.message || `Mã 6 số đã gửi tới email ${email}. Vui lòng nhập mã để kích hoạt ngay!`, 'info');
        }
        setMode('verify-code');
        setIsGoogleWarning(false);
        setErrorMessage('');
        return;
      }

      if (data.token) {
        localStorage.setItem('trekmap_token', data.token);
      }

      if (onShowToast) {
        onShowToast(data.message || 'Đăng nhập thành công!', 'success');
      }

      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Không thể kết nối đến máy chủ.');
    }
  };

  const handleRequestResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsGoogleWarning(false);

    if (!email.trim()) {
      setErrorMessage('Vui lòng nhập địa chỉ email.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      setIsLoading(false);

      if (!res.ok || !data.success) {
        if (data.isGoogleAccount) {
          setIsGoogleWarning(true);
          setErrorMessage(data.message || 'Tài khoản này đã đăng nhập bằng Google.');
        } else {
          setErrorMessage(data.message || 'Không thể gửi email khôi phục mật khẩu.');
        }
        return;
      }

      if (onShowToast) {
        onShowToast(`Thư khôi phục đã gửi đến ${email}. Vui lòng mở hòm thư email cá nhân của bạn!`, 'info');
      }
      setMode('login');
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Không thể kết nối đến máy chủ.');
    }
  };

  const handleResetPasswordWithToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!newPassword.trim()) {
      setErrorMessage('Vui lòng nhập mật khẩu mới.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/auth/reset-password-with-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword }),
      });

      const data = await res.json();
      setIsLoading(false);

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Không thể đặt lại mật khẩu.');
        return;
      }

      if (onShowToast) {
        onShowToast('Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay.', 'success');
      }
      // Remove query param from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setMode('login');
      setPassword(newPassword);
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Không thể kết nối đến máy chủ.');
    }
  };

  const handleVerifyOtpCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!otpCode.trim() || otpCode.length < 6) {
      setErrorMessage('Vui lòng nhập đầy đủ mã xác thực 6 số.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode }),
      });

      const data = await res.json();
      setIsLoading(false);

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Mã xác thực không hợp lệ.');
        return;
      }

      if (data.token) {
        localStorage.setItem('trekmap_token', data.token);
      }

      if (onShowToast) {
        onShowToast(data.message || 'Kích hoạt tài khoản thành công!', 'success');
      }

      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Không thể kết nối đến máy chủ.');
    }
  };

  const handleResendOtpCode = async () => {
    if (resendCooldown > 0 || !email) return;
    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('http://localhost:5000/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      setIsLoading(false);

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Không thể gửi lại mã OTP. Vui lòng thử lại.');
        return;
      }

      setOtpCode('');
      setResendCooldown(60);
      if (onShowToast) {
        onShowToast(`Mã OTP 6 số mới đã được gửi tới email ${email}!`, 'success');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Lỗi máy chủ khi gửi lại mã OTP.');
    }
  };

  const handleGoogleLogin = () => {
    setErrorMessage('');
    setIsGoogleWarning(false);

    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'email profile openid',
        callback: async (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            setIsLoading(true);
            try {
              const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
              });
              const googleProfile = await userInfoRes.json();

              if (!googleProfile.email) {
                setIsLoading(false);
                setErrorMessage('Không thể xác thực thông tin tài khoản Google.');
                return;
              }

              const res = await fetch('http://localhost:5000/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: googleProfile.email,
                  name: googleProfile.name || googleProfile.given_name || 'Google User',
                  picture: googleProfile.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
                }),
              });

              const data = await res.json();
              setIsLoading(false);

              if (data.success) {
                localStorage.setItem('trekmap_token', data.token);
                if (onShowToast) {
                  onShowToast(`Đăng nhập Google thành công! Welcome ${data.user.fullName || data.user.email}`, 'success');
                }
                onAuthSuccess(data.user);
                onClose();
              } else {
                setErrorMessage(data.message || 'Đăng nhập Google thất bại.');
              }
            } catch (err) {
              setIsLoading(false);
              setErrorMessage('Không thể kết nối lấy dữ liệu từ Google.');
            }
          }
        },
      });

      client.requestAccessToken();
    } else {
      setErrorMessage('Đang tải thư viện Google OAuth... Vui lòng thử lại sau 2 giây.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100, backdropFilter: 'blur(12px)', padding: 20 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 450,
          width: '100%',
          padding: '24px 26px',
          borderRadius: 22,
          position: 'relative',
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-glow)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(14, 215, 181, 0.15)',
          boxSizing: 'border-box',
          margin: '0 auto',
          transition: 'all 0.52s cubic-bezier(0.22, 1, 0.36, 1)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          maxHeight: '94vh',
          overflowY: 'auto',
        }}
      >
        {/* Close Button Inside Modal Box */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'var(--color-bg-main)',
            border: 'none',
            color: 'var(--color-text-muted)',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
            e.currentTarget.style.color = '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--color-bg-main)';
            e.currentTarget.style.color = 'var(--color-text-muted)';
          }}
        >
          <X size={16} />
        </button>

        <div key={mode} className={mode === 'register' ? 'auth-slide-left' : 'auth-slide-right'} style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
          {/* Brand Symmetrical Header */}
          <div style={{ textAlign: 'center', marginBottom: 14, width: '100%' }}>
            <div style={{
              background: 'linear-gradient(135deg, #16a34a 0%, #059669 100%)',
              width: 44,
              height: 44,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 8px auto',
              boxShadow: 'var(--shadow-sprout)',
            }}>
              <Compass size={24} color="#ffffff" />
            </div>

            <h2 style={{ fontSize: '1.2rem', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)', margin: 0, letterSpacing: '-0.3px', textAlign: 'center' }}>
              {mode === 'register'
                ? 'Tạo Tài Khoản TrekMap'
                : mode === 'login'
                ? 'Đăng Nhập Hệ Thống'
                : mode === 'forgot-password'
                ? 'Khôi Phục Mật Khẩu Qua Email'
                : mode === 'verify-code'
                ? 'Nhập Mã Xác Thực Kích Hoạt'
                : 'Đặt Lại Mật Khẩu Mới'}
            </h2>
            <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: 2, textAlign: 'center' }}>
              {mode === 'register'
                ? 'Gia nhập cộng đồng người leo núi & bản đồ 3D'
                : mode === 'login'
                ? 'Chào mừng bạn quay trở lại với TrekMap'
                : mode === 'forgot-password'
                ? 'Dành cho tài khoản Email cá nhân (Outlook, Yahoo,...)'
                : mode === 'verify-code'
                ? `Điền mã 6 số đã được gửi tới email ${email}`
                : 'Nhập mật khẩu mới cho tài khoản của bạn'}
            </p>
          </div>

          {/* Mode Switch Tabs (Only show for register & login modes) */}
          {(mode === 'register' || mode === 'login') && (
            <div style={{
              background: 'var(--color-bg-main)',
              padding: 3,
              borderRadius: 14,
              display: 'flex',
              position: 'relative',
              width: '100%',
              marginBottom: 14,
              border: '1px solid var(--color-border)',
              boxSizing: 'border-box',
            }}>
              {/* Sliding Highlight Pill Background */}
              <div
                style={{
                  position: 'absolute',
                  top: 3,
                  left: 3,
                  width: 'calc(50% - 3px)',
                  height: 'calc(100% - 6px)',
                  borderRadius: 11,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                  transform: mode === 'register' ? 'translateX(0%)' : 'translateX(100%)',
                  transition: 'transform 0.52s cubic-bezier(0.22, 1, 0.36, 1)',
                  zIndex: 1,
                }}
              />

              <button
                type="button"
                onClick={() => handleSwitchMode('register')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 11,
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 'var(--font-weight-extrabold)',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: mode === 'register' ? '#ffffff' : 'var(--color-text-muted)',
                  transition: 'color 0.25s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  position: 'relative',
                  zIndex: 2,
                }}
              >
                <User size={16} color={mode === 'register' ? '#ffffff' : 'var(--color-text-muted)'} />
                <span>Đăng ký</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchMode('login')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 11,
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 'var(--font-weight-extrabold)',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: mode === 'login' ? '#ffffff' : 'var(--color-text-muted)',
                  transition: 'color 0.25s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  position: 'relative',
                  zIndex: 2,
                }}
              >
                <Lock size={16} color={mode === 'login' ? '#ffffff' : 'var(--color-text-muted)'} />
                <span>Đăng nhập</span>
              </button>
            </div>
          )}

        {/* Error Alert */}
        {errorMessage && (
          <div style={{
            background: isGoogleWarning ? 'rgba(251, 191, 36, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${isGoogleWarning ? '#fbbf24' : '#ef4444'}`,
            color: isGoogleWarning ? '#fbbf24' : '#f87171',
            borderRadius: 14,
            padding: '12px 16px',
            fontSize: '0.86rem',
            marginBottom: 18,
            textAlign: 'center',
            width: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, textAlign: 'left' }}>
              {isGoogleWarning && <AlertTriangle size={18} color="#fbbf24" style={{ flexShrink: 0 }} />}
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* 1. Register & Login Form */}
        {(mode === 'register' || mode === 'login') && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
            {mode === 'register' && (
              <div style={{ width: '100%' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 4, display: 'block', color: '#cbd5e1', textAlign: 'left' }}>Tên tài khoản (Username duy nhất)</label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <User size={16} color="#0ed7b5" style={{ position: 'absolute', left: 12, top: 12 }} />
                  <input
                    type="text"
                    placeholder="hoang_trekker"
                    style={{
                      width: '100%',
                      paddingLeft: 38,
                      paddingRight: 14,
                      height: 40,
                      borderRadius: 12,
                      fontSize: '0.86rem',
                      background: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-main)',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setUsernameSuggestions([]);
                    }}
                    required
                  />
                </div>

                {/* Username Suggestions Pill Badges */}
                {usernameSuggestions.length > 0 && (
                  <div style={{ marginTop: 6, textAlign: 'left' }}>
                    <div style={{ fontSize: '0.75rem', color: '#00ffd5', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={13} color="#00ffd5" /> Gợi ý tên hợp lệ (chạm vào để chọn):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {usernameSuggestions.map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => {
                            setFullName(sug);
                            setUsernameSuggestions([]);
                            setErrorMessage('');
                          }}
                          style={{
                            background: 'rgba(0, 255, 213, 0.12)',
                            border: '1px solid rgba(0, 255, 213, 0.4)',
                            color: '#00ffd5',
                            borderRadius: 18,
                            padding: '3px 10px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 255, 213, 0.25)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0, 255, 213, 0.12)')}
                        >
                          + {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ width: '100%' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 4, display: 'block', color: '#cbd5e1', textAlign: 'left' }}>Địa chỉ Email</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <Mail size={16} color="#0ed7b5" style={{ position: 'absolute', left: 12, top: 12 }} />
                <input
                  type="email"
                  placeholder="name@gmail.com"
                  style={{
                    width: '100%',
                    paddingLeft: 38,
                    paddingRight: 14,
                    height: 40,
                    borderRadius: 12,
                    fontSize: '0.86rem',
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-main)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Mật khẩu</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('forgot-password')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                  >
                    Quên mật khẩu?
                  </button>
                )}
              </div>
              <div style={{ position: 'relative', width: '100%' }}>
                <Lock size={16} color="var(--color-primary)" style={{ position: 'absolute', left: 12, top: 12 }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    paddingLeft: 38,
                    paddingRight: 38,
                    height: 40,
                    borderRadius: 12,
                    fontSize: '0.86rem',
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-main)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: 11,
                    background: 'none',
                    border: 'none',
                    color: showPassword ? '#00ffd5' : '#64748b',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password Strength Meter UI Bar */}
              {mode === 'register' && password && (
                <div style={{ marginTop: 6, textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', marginBottom: 3 }}>
                    <span style={{ color: '#94a3b8', fontWeight: 600 }}>Độ mạnh mật khẩu:</span>
                    <span style={{ fontWeight: 800, color: getPasswordStrength(password).color }}>
                      {getPasswordStrength(password).label}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 4, background: 'var(--color-bg-main)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{
                      width: `${getPasswordStrength(password).percent}%`,
                      height: '100%',
                      background: getPasswordStrength(password).color,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      borderRadius: 10,
                    }} />
                  </div>
                </div>
              )}
            </div>

            {mode === 'register' && (
              <div style={{ width: '100%' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 4, display: 'block', color: '#cbd5e1', textAlign: 'left' }}>Nhập lại mật khẩu</label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <ShieldCheck size={16} color="#0ed7b5" style={{ position: 'absolute', left: 12, top: 12 }} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      paddingLeft: 38,
                      paddingRight: 38,
                      height: 40,
                      borderRadius: 12,
                      fontSize: '0.86rem',
                      background: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-main)',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: 11,
                      background: 'none',
                      border: 'none',
                      color: showConfirmPassword ? '#00ffd5' : '#64748b',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{ width: '100%', height: 42, borderRadius: 12, fontSize: '0.9rem', fontWeight: 800, marginTop: 4, boxSizing: 'border-box' }}
            >
              {isLoading ? 'Đang xử lý...' : mode === 'register' ? 'Đăng Ký Tài Khoản' : 'Đăng Nhập'}
            </button>
          </form>
        )}

        {/* 2. Forgot Password Request Form */}
        {mode === 'forgot-password' && (
          <form onSubmit={handleRequestResetEmail} style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
            <div style={{ width: '100%' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 700, marginBottom: 6, display: 'block', color: '#cbd5e1', textAlign: 'left' }}>Địa chỉ Email của bạn (Outlook, Yahoo,...)</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <Mail size={18} color="#0ed7b5" style={{ position: 'absolute', left: 14, top: 14 }} />
                <input
                  type="email"
                  placeholder="hoang@outlook.com"
                  style={{
                    width: '100%',
                    paddingLeft: 44,
                    paddingRight: 16,
                    height: 46,
                    borderRadius: 14,
                    fontSize: '0.9rem',
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-main)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{ width: '100%', height: 48, borderRadius: 14, fontSize: '0.94rem', fontWeight: 800, marginTop: 4 }}
            >
              {isLoading ? 'Đang phát Email khôi phục...' : 'Gửi Thư Khôi Phục Mật Khẩu'}
            </button>

            <button
              type="button"
              onClick={() => handleSwitchMode('login')}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                marginTop: 6,
              }}
            >
              <ArrowLeft size={16} />
              <span>Quay lại Đăng nhập</span>
            </button>
          </form>
        )}

        {/* 3. Reset Password Token Screen */}
        {mode === 'reset-password-token' && (
          <form onSubmit={handleResetPasswordWithToken} style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
            <div style={{ width: '100%' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 700, marginBottom: 6, display: 'block', color: '#cbd5e1', textAlign: 'left' }}>Mật khẩu mới của bạn</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <Lock size={18} color="#0ed7b5" style={{ position: 'absolute', left: 14, top: 14 }} />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    paddingLeft: 44,
                    paddingRight: 44,
                    height: 46,
                    borderRadius: 14,
                    fontSize: '0.9rem',
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-main)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: 13,
                    background: 'none',
                    border: 'none',
                    color: showNewPassword ? '#00ffd5' : '#64748b',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={showNewPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ width: '100%' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 700, marginBottom: 6, display: 'block', color: '#cbd5e1', textAlign: 'left' }}>Nhập lại mật khẩu mới</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <ShieldCheck size={18} color="#0ed7b5" style={{ position: 'absolute', left: 14, top: 14 }} />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    paddingLeft: 44,
                    paddingRight: 44,
                    height: 46,
                    borderRadius: 14,
                    fontSize: '0.9rem',
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-main)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: 13,
                    background: 'none',
                    border: 'none',
                    color: showNewPassword ? '#00ffd5' : '#64748b',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={showNewPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{ width: '100%', height: 48, borderRadius: 14, fontSize: '0.94rem', fontWeight: 800, marginTop: 4 }}
            >
              {isLoading ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu Mới'}
            </button>
          </form>
        )}

        {/* 4. Direct 6-Digit OTP Code Verification Screen (ZERO SECOND TAB EVER!) */}
        {mode === 'verify-code' && (
          <form onSubmit={handleVerifyOtpCode} style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
            <div style={{ width: '100%', textAlign: 'center' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 700, marginBottom: 8, display: 'block', color: '#cbd5e1' }}>
                Mã xác nhận 6 chữ số
              </label>
              <div style={{ position: 'relative', width: '100%' }}>
                <ShieldCheck size={20} color="#0ed7b5" style={{ position: 'absolute', left: 14, top: 14 }} />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="8 4 9 2 0 1"
                  style={{
                    width: '100%',
                    paddingLeft: 44,
                    paddingRight: 16,
                    height: 52,
                    borderRadius: 14,
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    letterSpacing: '8px',
                    textAlign: 'center',
                    background: 'var(--color-bg-main)',
                    border: '2px solid var(--color-primary)',
                    color: 'var(--color-primary)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                  value={otpCode}
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtpCode(cleanVal);
                  }}
                  required
                  autoFocus
                />
              </div>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 8 }}>
                Vui lòng kiểm tra Hòm thư Inbox / Spam của email <strong>{email}</strong>
              </p>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{ width: '100%', height: 48, borderRadius: 14, fontSize: '0.94rem', fontWeight: 800, marginTop: 4 }}
            >
              {isLoading ? 'Đang kích hoạt...' : 'Xác Nhận & Đăng Nhập Ngay'}
            </button>

            {/* Resend OTP Button with Cooldown Timer */}
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <button
                type="button"
                onClick={handleResendOtpCode}
                disabled={resendCooldown > 0 || isLoading}
                style={{
                  background: 'rgba(0, 255, 213, 0.08)',
                  border: '1px solid rgba(0, 255, 213, 0.3)',
                  borderRadius: 12,
                  padding: '10px 16px',
                  color: resendCooldown > 0 ? '#64748b' : '#00ffd5',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  transition: 'all 0.2s ease',
                }}
              >
                <RotateCw size={15} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
                <span>{resendCooldown > 0 ? `Gửi lại mã OTP mới sau (${resendCooldown}s)` : 'Gửi lại mã OTP mới qua Email'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleSwitchMode('login')}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                marginTop: 6,
              }}
            >
              <ArrowLeft size={16} />
              <span>Quay lại Đăng nhập</span>
            </button>
          </form>
        )}

        {/* Divider (Only for register & login modes) */}
        {(mode === 'register' || mode === 'login') && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              margin: '10px 0 8px 0',
              fontSize: '0.74rem',
              color: '#64748b',
              width: '100%',
            }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(14, 215, 181, 0.15)' }} />
              <span>Hoặc tiếp tục với</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(14, 215, 181, 0.15)' }} />
            </div>

            {/* Google OAuth Login Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              style={{
                width: '100%',
                background: '#ffffff',
                color: '#1f2937',
                border: isGoogleWarning ? '2px solid #00ffd5' : 'none',
                borderRadius: 12,
                height: 40,
                fontSize: '0.86rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: isGoogleWarning
                  ? '0 0 25px rgba(0, 255, 213, 0.75), 0 4px 14px rgba(0, 0, 0, 0.3)'
                  : '0 4px 14px rgba(0, 0, 0, 0.3)',
                animation: isGoogleWarning ? 'haloPulse 2s infinite' : 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.015)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Đăng nhập nhanh bằng Google</span>
            </button>
          </>
        )}
        </div>
      </div>
    </div>
  );
};
