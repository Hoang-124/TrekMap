import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { UserProfile } from '../../types.js';
import {
  IconUser,
  IconLock,
  IconMail,
  IconShieldCheck,
  IconX,
  IconCompass,
  IconArrowLeft,
  IconAlertTriangle,
  IconEye,
  IconEyeOff,
  IconSparkles,
  IconRotateCw,
  IconGoogle,
} from '../common/SvgIcons.js';

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
  const [rememberMe, setRememberMe] = useState(true);

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
    if (!pwd) return { score: 0, label: 'Chưa nhập', color: 'var(--color-text-dim)', percent: 0 };
    if (pwd.length < 8) return { score: 0, label: 'Yếu (Cần từ 8 ký tự)', color: 'var(--color-error)', percent: 25 };

    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasDigit = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd);

    if (hasLower && hasUpper && hasDigit && hasSpecial && pwd.length >= 10) {
      return { score: 3, label: 'Rất mạnh', color: 'var(--color-primary)', percent: 100 };
    }
    if (hasLower && hasUpper && hasDigit) {
      return { score: 2, label: 'Đạt chuẩn', color: 'var(--color-primary)', percent: 75 };
    }
    if (hasLower && (hasUpper || hasDigit)) {
      return { score: 1, label: 'Trung bình', color: 'var(--color-warning)', percent: 50 };
    }

    return { score: 0, label: 'Yếu', color: 'var(--color-error)', percent: 25 };
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
        setErrorMessage('Tên tài khoản phải có ít nhất 2 ký tự.');
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
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
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
      const res = await fetch('/api/auth/forgot-password', {
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
      const res = await fetch('/api/auth/reset-password-with-token', {
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
      const res = await fetch('/api/auth/verify-code', {
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
      const res = await fetch('/api/auth/resend-otp', {
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
              const res = await fetch('/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  token: tokenResponse.access_token,
                }),
              });

              const data = await res.json();
              setIsLoading(false);

              if (data.success) {
                localStorage.setItem('trekmap_token', data.token);
                if (onShowToast) {
                  onShowToast(`Đăng nhập Google thành công! Chào mừng ${data.user.fullName || data.user.email}`, 'success');
                }
                onAuthSuccess(data.user);
                onClose();
              } else {
                setErrorMessage(data.message || 'Đăng nhập Google thất bại.');
              }
            } catch (err) {
              setIsLoading(false);
              setErrorMessage('Không thể kết nối đến máy chủ xác thực.');
            }
          }
        },
      });

      client.requestAccessToken();
    } else {
      setErrorMessage('Đang tải thư viện Google OAuth... Vui lòng thử lại sau 2 giây.');
    }
  };

  return createPortal(
    <div
      className="modal-overlay"
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999999,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(3, 8, 14, 0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      <div
        className="modal-content modal-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 418,
          width: '100%',
          padding: '18px 22px 18px 22px',
          borderRadius: 20,
          position: 'relative',
          background: 'var(--color-bg-glass)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-card), 0 20px 50px rgba(0, 0, 0, 0.55), 0 0 30px rgba(74, 222, 128, 0.12)',
          boxSizing: 'border-box',
          margin: 'auto',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.28s cubic-bezier(0.2, 0.9, 0.3, 1)',
          overflow: 'visible',
        }}
      >
        {/* Compact Close Button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Đóng cửa sổ"
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'var(--color-bg-main)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-dim)',
            borderRadius: 8,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            e.currentTarget.style.color = 'var(--color-error)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--color-bg-main)';
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.color = 'var(--color-text-dim)';
          }}
        >
          <IconX size={15} color="currentColor" />
        </button>

        {/* Stable Compact Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 10, width: '100%' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.22) 0%, rgba(5, 150, 105, 0.22) 100%)',
              border: '1px solid rgba(74, 222, 128, 0.45)',
              width: 38,
              height: 38,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 6px auto',
              boxShadow: '0 0 18px rgba(74, 222, 128, 0.35)',
              color: 'var(--color-primary)',
            }}
          >
            <IconCompass size={22} color="var(--color-primary)" />
          </div>

          <h2
            style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              color: 'var(--color-text-main)',
              margin: 0,
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
            }}
          >
            {mode === 'register'
              ? 'Tạo Tài Khoản TrekMap'
              : mode === 'login'
              ? 'Đăng Nhập Hệ Thống'
              : mode === 'forgot-password'
              ? 'Khôi Phục Mật Khẩu'
              : mode === 'verify-code'
              ? 'Xác Thực Tài Khoản'
              : 'Đặt Lại Mật Khẩu'}
          </h2>
          <p
            style={{
              fontSize: '0.76rem',
              color: 'var(--color-text-muted)',
              marginTop: 2,
              marginBottom: 0,
              lineHeight: 1.3,
            }}
          >
            {mode === 'register'
              ? 'Gia nhập cộng đồng người leo núi & bản đồ 3D'
              : mode === 'login'
              ? 'Chào mừng bạn quay trở lại với TrekMap'
              : mode === 'forgot-password'
              ? 'Nhập email cá nhân để nhận liên kết khôi phục'
              : mode === 'verify-code'
              ? `Điền mã 6 số đã gửi tới email ${email}`
              : 'Nhập mật khẩu mới an toàn cho tài khoản'}
          </p>
        </div>

        {/* Stable Compact Segmented Tab Switcher */}
        {(mode === 'register' || mode === 'login') && (
          <div
            role="tablist"
            style={{
              background: 'var(--color-bg-main)',
              padding: 3,
              borderRadius: 12,
              display: 'flex',
              position: 'relative',
              width: '100%',
              marginBottom: 10,
              border: '1px solid var(--color-border)',
              boxSizing: 'border-box',
            }}
          >
            {/* Smooth Hardware-Accelerated Sliding Indicator Pill */}
            <div
              style={{
                position: 'absolute',
                top: 3,
                left: 3,
                width: 'calc(50% - 3px)',
                height: 'calc(100% - 6px)',
                borderRadius: 9,
                background: 'linear-gradient(135deg, var(--color-primary) 0%, #059669 100%)',
                boxShadow: '0 3px 12px rgba(74, 222, 128, 0.35)',
                transform: mode === 'register' ? 'translateX(0%)' : 'translateX(100%)',
                transition: 'transform 0.26s cubic-bezier(0.2, 0.9, 0.3, 1)',
                zIndex: 1,
              }}
            />

            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => handleSwitchMode('register')}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: 9,
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: 'transparent',
                color: mode === 'register' ? '#ffffff' : 'var(--color-text-muted)',
                transition: 'color 0.18s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                position: 'relative',
                zIndex: 2,
              }}
            >
              <IconUser size={15} color={mode === 'register' ? '#ffffff' : 'var(--color-text-muted)'} />
              <span>Đăng ký</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => handleSwitchMode('login')}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: 9,
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: 'transparent',
                color: mode === 'login' ? '#ffffff' : 'var(--color-text-muted)',
                transition: 'color 0.18s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                position: 'relative',
                zIndex: 2,
              }}
            >
              <IconLock size={15} color={mode === 'login' ? '#ffffff' : 'var(--color-text-muted)'} />
              <span>Đăng nhập</span>
            </button>
          </div>
        )}

        {/* Dynamic Form Content Body (Silky Smooth Micro-Fade) */}
        <div key={mode} className="auth-form-fade" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {/* Error / Warning Alert Banner */}
          {errorMessage && (
            <div
              style={{
                background: isGoogleWarning ? 'rgba(249, 115, 22, 0.14)' : 'rgba(239, 68, 68, 0.14)',
                border: `1px solid ${isGoogleWarning ? 'rgba(249, 115, 22, 0.45)' : 'rgba(239, 68, 68, 0.45)'}`,
                color: isGoogleWarning ? 'var(--color-warning)' : 'var(--color-error)',
                borderRadius: 10,
                padding: '8px 12px',
                fontSize: '0.78rem',
                marginBottom: 8,
                textAlign: 'left',
                width: '100%',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 7,
                lineHeight: 1.35,
              }}
            >
              <IconAlertTriangle size={15} color={isGoogleWarning ? 'var(--color-warning)' : 'var(--color-error)'} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontWeight: 600 }}>{errorMessage}</span>
            </div>
          )}

          {/* 1. Register & Login Form */}
          {(mode === 'register' || mode === 'login') && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              {mode === 'register' && (
                <div style={{ width: '100%' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: 2, display: 'block', color: 'var(--color-text-muted)', textAlign: 'left' }}>
                    Tên tài khoản (Username)
                  </label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <div style={{ position: 'absolute', left: 10, top: 11, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                      <IconUser size={15} color="var(--color-primary)" />
                    </div>
                    <input
                      type="text"
                      placeholder="hoang_trekker"
                      style={{
                        width: '100%',
                        paddingLeft: 34,
                        paddingRight: 12,
                        height: 38,
                        borderRadius: 10,
                        fontSize: '0.84rem',
                        background: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-main)',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-primary)';
                        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(74, 222, 128, 0.16)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                        e.currentTarget.style.boxShadow = 'none';
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
                    <div style={{ marginTop: 4, textAlign: 'left' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 700, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <IconSparkles size={12} color="var(--color-primary)" /> Gợi ý tên:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
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
                              background: 'rgba(74, 222, 128, 0.12)',
                              border: '1px solid rgba(74, 222, 128, 0.35)',
                              color: 'var(--color-primary)',
                              borderRadius: 14,
                              padding: '2px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            + {sug}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Email Field */}
              <div style={{ width: '100%' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: 2, display: 'block', color: 'var(--color-text-muted)', textAlign: 'left' }}>
                  Địa chỉ Email
                </label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <div style={{ position: 'absolute', left: 10, top: 11, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                    <IconMail size={15} color="var(--color-primary)" />
                  </div>
                  <input
                    type="email"
                    placeholder="name@gmail.com"
                    style={{
                      width: '100%',
                      paddingLeft: 34,
                      paddingRight: 12,
                      height: 38,
                      borderRadius: 10,
                      fontSize: '0.84rem',
                      background: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-main)',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                      e.currentTarget.style.boxShadow = '0 0 0 2px rgba(74, 222, 128, 0.16)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div style={{ width: '100%' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: 2, display: 'block', color: 'var(--color-text-muted)', textAlign: 'left' }}>
                  Mật khẩu
                </label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <div style={{ position: 'absolute', left: 10, top: 11, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                    <IconLock size={15} color="var(--color-primary)" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      paddingLeft: 34,
                      paddingRight: 34,
                      height: 38,
                      borderRadius: 10,
                      fontSize: '0.84rem',
                      background: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-main)',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                      e.currentTarget.style.boxShadow = '0 0 0 2px rgba(74, 222, 128, 0.16)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.boxShadow = 'none';
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
                      right: 8,
                      top: 9,
                      background: 'none',
                      border: 'none',
                      color: showPassword ? 'var(--color-primary)' : 'var(--color-text-dim)',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                  >
                    {showPassword ? <IconEyeOff size={15} color="currentColor" /> : <IconEye size={15} color="currentColor" />}
                  </button>
                </div>

                {/* Compact Password Strength Meter Bar (Register Mode) */}
                {mode === 'register' && password && (
                  <div style={{ marginTop: 4, textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', marginBottom: 2 }}>
                      <span style={{ color: 'var(--color-text-dim)', fontWeight: 600 }}>Độ mạnh:</span>
                      <span style={{ fontWeight: 800, color: getPasswordStrength(password).color }}>
                        {getPasswordStrength(password).label}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 3, background: 'var(--color-bg-main)', borderRadius: 6, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${getPasswordStrength(password).percent}%`,
                          height: '100%',
                          background: getPasswordStrength(password).color,
                          transition: 'all 0.25s ease',
                          borderRadius: 6,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password Field (Register Mode) */}
              {mode === 'register' && (
                <div style={{ width: '100%' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: 2, display: 'block', color: 'var(--color-text-muted)', textAlign: 'left' }}>
                    Nhập lại mật khẩu
                  </label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <div style={{ position: 'absolute', left: 10, top: 11, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                      <IconShieldCheck size={15} color="var(--color-primary)" />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      style={{
                        width: '100%',
                        paddingLeft: 34,
                        paddingRight: 34,
                        height: 38,
                        borderRadius: 10,
                        fontSize: '0.84rem',
                        background: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-main)',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-primary)';
                        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(74, 222, 128, 0.16)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                        e.currentTarget.style.boxShadow = 'none';
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
                        right: 8,
                        top: 9,
                        background: 'none',
                        border: 'none',
                        color: showConfirmPassword ? 'var(--color-primary)' : 'var(--color-text-dim)',
                        cursor: 'pointer',
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                    >
                      {showConfirmPassword ? <IconEyeOff size={15} color="currentColor" /> : <IconEye size={15} color="currentColor" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Remember Me & Forgot Password Row (Login Mode) */}
              {mode === 'login' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '2px 0 0 0',
                    width: '100%',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.76rem',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      fontWeight: 600,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      style={{
                        accentColor: 'var(--color-primary)',
                        width: 14,
                        height: 14,
                        cursor: 'pointer',
                        borderRadius: 4,
                      }}
                    />
                    <span>Ghi nhớ đăng nhập</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleSwitchMode('forgot-password')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary)',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                  >
                    Quên mật khẩu?
                  </button>
                </div>
              )}

              {/* Submit Primary Button */}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  height: 38,
                  borderRadius: 10,
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  marginTop: 4,
                  boxSizing: 'border-box',
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isLoading ? 'wait' : 'pointer',
                  boxShadow: '0 3px 14px rgba(74, 222, 128, 0.35)',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={(e) => !isLoading && (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseLeave={(e) => !isLoading && (e.currentTarget.style.transform = 'translateY(0)')}
              >
                {isLoading ? 'Đang xử lý...' : mode === 'register' ? 'Đăng Ký Tài Khoản' : 'Đăng Nhập'}
              </button>
            </form>
          )}

          {/* 2. Forgot Password Request Form */}
          {mode === 'forgot-password' && (
            <form onSubmit={handleRequestResetEmail} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              <div style={{ width: '100%' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 4, display: 'block', color: 'var(--color-text-muted)', textAlign: 'left' }}>
                  Địa chỉ Email cá nhân (Outlook, Yahoo,...)
                </label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <div style={{ position: 'absolute', left: 12, top: 11, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                    <IconMail size={16} color="var(--color-primary)" />
                  </div>
                  <input
                    type="email"
                    placeholder="hoang@outlook.com"
                    style={{
                      width: '100%',
                      paddingLeft: 36,
                      paddingRight: 14,
                      height: 40,
                      borderRadius: 10,
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
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  height: 40,
                  borderRadius: 10,
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  marginTop: 2,
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isLoading ? 'wait' : 'pointer',
                  boxShadow: '0 3px 14px rgba(74, 222, 128, 0.35)',
                }}
              >
                {isLoading ? 'Đang phát Email khôi phục...' : 'Gửi Thư Khôi Phục Mật Khẩu'}
              </button>

              <button
                type="button"
                onClick={() => handleSwitchMode('login')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-dim)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  marginTop: 4,
                }}
              >
                <IconArrowLeft size={15} color="currentColor" />
                <span>Quay lại Đăng nhập</span>
              </button>
            </form>
          )}

          {/* 3. Reset Password Token Screen */}
          {mode === 'reset-password-token' && (
            <form onSubmit={handleResetPasswordWithToken} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              <div style={{ width: '100%' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 4, display: 'block', color: 'var(--color-text-muted)', textAlign: 'left' }}>
                  Mật khẩu mới của bạn
                </label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <div style={{ position: 'absolute', left: 12, top: 11, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                    <IconLock size={16} color="var(--color-primary)" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      paddingLeft: 36,
                      paddingRight: 36,
                      height: 40,
                      borderRadius: 10,
                      fontSize: '0.86rem',
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
                      right: 10,
                      top: 10,
                      background: 'none',
                      border: 'none',
                      color: showNewPassword ? 'var(--color-primary)' : 'var(--color-text-dim)',
                      cursor: 'pointer',
                      padding: 2,
                    }}
                    title={showNewPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                  >
                    {showNewPassword ? <IconEyeOff size={16} color="currentColor" /> : <IconEye size={16} color="currentColor" />}
                  </button>
                </div>
              </div>

              <div style={{ width: '100%' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 4, display: 'block', color: 'var(--color-text-muted)', textAlign: 'left' }}>
                  Nhập lại mật khẩu mới
                </label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <div style={{ position: 'absolute', left: 12, top: 11, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                    <IconShieldCheck size={16} color="var(--color-primary)" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      paddingLeft: 36,
                      paddingRight: 36,
                      height: 40,
                      borderRadius: 10,
                      fontSize: '0.86rem',
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
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  height: 40,
                  borderRadius: 10,
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  marginTop: 2,
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isLoading ? 'wait' : 'pointer',
                }}
              >
                {isLoading ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu Mới'}
              </button>
            </form>
          )}

          {/* 4. Direct 6-Digit OTP Code Verification Screen */}
          {mode === 'verify-code' && (
            <form onSubmit={handleVerifyOtpCode} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              <div style={{ width: '100%', textAlign: 'center' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--color-text-muted)' }}>
                  Mã xác nhận 6 chữ số
                </label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="8 4 9 2 0 1"
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      height: 46,
                      borderRadius: 12,
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      letterSpacing: '6px',
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
                <p style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)', marginTop: 6, marginBottom: 0 }}>
                  Kiểm tra hòm thư Email / Spam của <strong>{email}</strong>
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  height: 40,
                  borderRadius: 10,
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  marginTop: 2,
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isLoading ? 'wait' : 'pointer',
                }}
              >
                {isLoading ? 'Đang kích hoạt...' : 'Xác Nhận & Đăng Nhập Ngay'}
              </button>

              {/* Resend OTP Button with Cooldown Timer */}
              <div style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={handleResendOtpCode}
                  disabled={resendCooldown > 0 || isLoading}
                  style={{
                    background: 'rgba(74, 222, 128, 0.08)',
                    border: '1px solid rgba(74, 222, 128, 0.3)',
                    borderRadius: 8,
                    padding: '6px 12px',
                    color: resendCooldown > 0 ? 'var(--color-text-dim)' : 'var(--color-primary)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    width: '100%',
                  }}
                >
                  <IconRotateCw size={13} color="currentColor" style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
                  <span>{resendCooldown > 0 ? `Gửi lại sau (${resendCooldown}s)` : 'Gửi lại mã OTP mới'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleSwitchMode('login')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-dim)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  marginTop: 2,
                }}
              >
                <IconArrowLeft size={15} color="currentColor" />
                <span>Quay lại Đăng nhập</span>
              </button>
            </form>
          )}

          {/* Symmetrical Compact Divider & Google Button */}
          {(mode === 'register' || mode === 'login') && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  margin: '8px 0 6px 0',
                  fontSize: '0.72rem',
                  color: 'var(--color-text-dim)',
                  width: '100%',
                }}
              >
                <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                <span>Hoặc tiếp tục với</span>
                <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
              </div>

              {/* Google OAuth Login Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                style={{
                  width: '100%',
                  background: 'var(--color-bg-card)',
                  color: 'var(--color-text-main)',
                  border: isGoogleWarning ? '2px solid var(--color-warning)' : '1px solid var(--color-border)',
                  borderRadius: 10,
                  height: 38,
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: isGoogleWarning
                    ? '0 0 16px rgba(249, 115, 22, 0.4), 0 3px 10px rgba(0, 0, 0, 0.2)'
                    : 'var(--shadow-card)',
                  transition: 'all 0.18s ease',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.background = 'var(--color-bg-main)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = isGoogleWarning ? 'var(--color-warning)' : 'var(--color-border)';
                  e.currentTarget.style.background = 'var(--color-bg-card)';
                }}
              >
                <IconGoogle size={16} />
                <span>Đăng nhập nhanh bằng Google</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
