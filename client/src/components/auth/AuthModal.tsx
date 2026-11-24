import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { UserProfile } from '../../types.js';
import { isTopmostFocusTrap, useFocusTrap } from '../../hooks/useFocusTrap.js';
import { LegalNoticesModal, type LegalNoticeTab } from '../legal/LegalNoticesModal.js';
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
  IconCheck,
} from '../common/SvgIcons.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  initialResetToken?: string | null;
  initialMode?: ModalMode;
}

const GOOGLE_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

type ModalMode = 'register' | 'login' | 'forgot-password' | 'reset-password-token' | 'verify-code';

interface GoogleTokenResponse {
  access_token?: string;
}

interface GoogleOAuthWindow extends Window {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (tokenResponse: GoogleTokenResponse) => void;
        }) => { requestAccessToken: () => void };
      };
    };
  };
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  onShowToast,
  initialResetToken,
  initialMode,
}) => {
  const [mode, setMode] = useState<ModalMode>(
    initialResetToken ? 'reset-password-token' : initialMode || 'register'
  );
  const [email, setEmail] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('lost_saved_email') || '';
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameCheckStatus, setUsernameCheckStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');
  const [usernameCheckMessage, setUsernameCheckMessage] = useState('');
  const [verifyNotice, setVerifyNotice] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('lost_remember_email') !== 'false';
  });

  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [legalTab, setLegalTab] = useState<LegalNoticeTab | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Debounced live username availability check on registration
  useEffect(() => {
    if (!isOpen || mode !== 'register') return;
    const trimmed = username.trim();
    if (!trimmed) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (trimmed.length < 3 || trimmed.length > 30 || !/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        setUsernameCheckStatus('invalid');
        setUsernameCheckMessage(
          'Handle gồm 3–30 ký tự không dấu, chữ số, gạch dưới (_) hoặc gạch ngang (-).'
        );
        setUsernameSuggestions([]);
        return;
      }

      setUsernameCheckStatus('checking');
      setUsernameCheckMessage('Đang kiểm tra tính khả dụng...');
      try {
        const res = await fetch(
          `/api/auth/check-username?username=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        const data = (await res.json().catch(() => ({}))) as {
          available?: boolean;
          isDuplicate?: boolean;
          suggestions?: string[];
          message?: string;
        };
        if (controller.signal.aborted) return;
        if (res.ok && data.available) {
          setUsernameCheckStatus('available');
          setUsernameCheckMessage(data.message || 'Tên tài khoản này có thể sử dụng!');
          setUsernameSuggestions([]);
        } else if (data.isDuplicate) {
          setUsernameCheckStatus('taken');
          setUsernameCheckMessage('Tên tài khoản đã có người sử dụng. Chọn một gợi ý bên dưới:');
          setUsernameSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        } else {
          setUsernameCheckStatus('invalid');
          setUsernameCheckMessage(data.message || 'Tên tài khoản không hợp lệ.');
          setUsernameSuggestions([]);
        }
      } catch {
        if (!controller.signal.aborted) {
          setUsernameCheckStatus('idle');
          setUsernameCheckMessage('');
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, mode, username]);

  const [resetToken, setResetToken] = useState(initialResetToken || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isGoogleWarning, setIsGoogleWarning] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [prevModalSync, setPrevModalSync] = useState({
    isOpen,
    initialMode,
    initialResetToken,
  });

  if (
    prevModalSync.isOpen !== isOpen ||
    prevModalSync.initialMode !== initialMode ||
    prevModalSync.initialResetToken !== initialResetToken
  ) {
    setPrevModalSync({ isOpen, initialMode, initialResetToken });
    if (!isOpen) {
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setFullName('');
      setUsername('');
      setUsernameCheckStatus('idle');
      setUsernameCheckMessage('');
      setVerifyNotice('');
      setOtpCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      setErrorMessage('');
      setUsernameSuggestions([]);
      setIsGoogleWarning(false);
      setShowPassword(false);
      setShowConfirmPassword(false);
      setShowNewPassword(false);
    } else {
      const targetMode: ModalMode = initialResetToken
        ? 'reset-password-token'
        : initialMode || mode;
      if (initialResetToken) {
        setResetToken(initialResetToken);
      }
      if (initialResetToken || initialMode) {
        setMode(targetMode);
      }
      if (targetMode === 'login' && typeof window !== 'undefined') {
        const saved = localStorage.getItem('lost_saved_email');
        if (saved) setEmail(saved);
      }
    }
  }

  const clearAllFormFields = useCallback((nextMode?: ModalMode) => {
    const savedEmail = nextMode === 'login' ? localStorage.getItem('lost_saved_email') || '' : '';
    setEmail(savedEmail);
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setUsername('');
    setUsernameCheckStatus('idle');
    setUsernameCheckMessage('');
    setVerifyNotice('');
    setOtpCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setErrorMessage('');
    setUsernameSuggestions([]);
    setIsGoogleWarning(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowNewPassword(false);
  }, []);

  const isLoadingRef = useRef(isLoading);
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const handleClose = useCallback(() => {
    if (isLoadingRef.current) return;
    clearAllFormFields();
    onClose();
  }, [clearAllFormFields, onClose]);

  const handleSwitchMode = (newMode: ModalMode) => {
    clearAllFormFields(newMode);
    setMode(newMode);
  };

  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryInputRef = useRef<HTMLInputElement>(null);
  useFocusTrap(isOpen, dialogRef, { initialFocusRef: primaryInputRef });

  // Focus active form field when switching modes while open
  useEffect(() => {
    if (!isOpen) return;
    const rafId = window.requestAnimationFrame(() => {
      if (isTopmostFocusTrap(dialogRef.current)) {
        primaryInputRef.current?.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [isOpen, mode]);

  // Escape key closes modal (strict LIFO via topmost focus trap, IME-guarded, blocked while request is in flight)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (!isTopmostFocusTrap(dialogRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (isLoadingRef.current) return;
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: 'Chưa nhập', color: 'var(--color-text-dim)', percent: 0 };
    if (pwd.length < 8)
      return {
        score: 0,
        label: 'Yếu (Cần từ 8 ký tự)',
        color: 'var(--color-error-text, var(--color-error))',
        percent: 25,
      };

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

    return { score: 0, label: 'Yếu', color: 'var(--color-error-text, var(--color-error))', percent: 25 };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsGoogleWarning(false);

    const cleanEmail = email.trim().toLowerCase();

    if (mode === 'register') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        setErrorMessage('Địa chỉ Email không đúng định dạng (Ví dụ: name@domain.com).');
        return;
      }
      if (!fullName.trim() || fullName.trim().length < 2) {
        setErrorMessage('Họ tên hiển thị phải có ít nhất 2 ký tự.');
        return;
      }
      const trimmedUsername = username.trim();
      if (trimmedUsername) {
        if (trimmedUsername.length < 3 || trimmedUsername.length > 30 || !/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
          setErrorMessage(
            'Tên tài khoản (handle) phải từ 3–30 ký tự, chỉ gồm chữ không dấu, số, gạch dưới (_) hoặc gạch ngang (-).'
          );
          return;
        }
        if (usernameCheckStatus === 'taken') {
          setErrorMessage('Tên tài khoản này đã có người sử dụng. Vui lòng chọn tên khác hoặc gợi ý bên dưới.');
          return;
        }
      }
      const strength = getPasswordStrength(password);
      if (strength.score < 2) {
        setErrorMessage(
          'Mật khẩu phải đạt chuẩn trở lên (Tối thiểu 8 ký tự, bao gồm chữ hoa A-Z, chữ thường a-z và chữ số 0-9).'
        );
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Mật khẩu nhập lại không trùng khớp.');
        return;
      }
    }

    setIsLoading(true);

    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const trimmedUsername = username.trim();
      const body =
        mode === 'register'
          ? {
              email: cleanEmail,
              password,
              fullName: fullName.trim(),
              ...(trimmedUsername ? { username: trimmedUsername } : {}),
            }
          : { email: cleanEmail, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      setIsLoading(false);

      if (!res.ok || !data.success) {
        // P0-11: Unverified existing registration (409) or unverified login (403) transitions directly to OTP verification
        if (
          mode === 'register' &&
          res.status === 409 &&
          (data.requiresActivation || data.isUnverifiedExisting)
        ) {
          const targetEmail =
            typeof data.email === 'string' && data.email.trim() ? data.email.trim() : cleanEmail;
          setEmail(targetEmail);
          setOtpCode('');
          setIsGoogleWarning(false);
          setErrorMessage('');
          setVerifyNotice(
            data.message ||
              `Email ${targetEmail} đã đăng ký nhưng chưa kích hoạt. Vui lòng nhập mã OTP 6 số hoặc bấm "Gửi lại mã OTP mới" bên dưới.`
          );
          setMode('verify-code');
          onShowToast?.(
            `Email ${targetEmail} chưa được kích hoạt. Hãy nhập mã OTP hoặc yêu cầu gửi lại mã mới.`,
            'info'
          );
          return;
        }

        if (mode === 'login' && res.status === 403 && data.isNotVerified) {
          const targetEmail =
            typeof data.email === 'string' && data.email.trim() ? data.email.trim() : cleanEmail;
          setEmail(targetEmail);
          setOtpCode('');
          setIsGoogleWarning(false);
          setErrorMessage('');
          setVerifyNotice(
            data.message ||
              `Tài khoản (${targetEmail}) chưa kích hoạt email. Vui lòng nhập mã OTP 6 số hoặc bấm "Gửi lại mã OTP mới" bên dưới.`
          );
          setMode('verify-code');
          onShowToast?.(
            `Tài khoản ${targetEmail} chưa xác thực email. Vui lòng hoàn tất xác thực OTP.`,
            'info'
          );
          return;
        }

        if (data.isGoogleWarning || data.isGoogleAccount) {
          setIsGoogleWarning(true);
        }
        setErrorMessage(data.message || 'Thao tác thất bại, vui lòng thử lại.');
        if (data.isDuplicateUsername && Array.isArray(data.suggestions)) {
          setUsernameSuggestions(data.suggestions);
          setUsernameCheckStatus('taken');
          setUsernameCheckMessage('Tên tài khoản đã có người sử dụng. Chọn một gợi ý bên dưới:');
        }
        return;
      }

      if (mode === 'register' && data.requiresActivation) {
        const targetEmail =
          typeof data.email === 'string' && data.email.trim() ? data.email.trim() : cleanEmail;
        setEmail(targetEmail);
        setVerifyNotice(
          data.message ||
            `Mã 6 số và liên kết kích hoạt đã gửi tới ${targetEmail}. Bạn có thể nhập mã bên dưới hoặc bấm liên kết trong email.`
        );
        onShowToast?.(
          data.message || `Mã 6 số đã gửi tới email ${targetEmail}. Vui lòng nhập mã để kích hoạt ngay!`,
          'info'
        );
        setMode('verify-code');
        setIsGoogleWarning(false);
        setErrorMessage('');
        return;
      }

      if (data.token) {
        localStorage.setItem('lost_token', data.token);
      }
      if (mode === 'login') {
        localStorage.setItem('lost_remember_email', String(rememberMe));
        if (rememberMe && cleanEmail) {
          localStorage.setItem('lost_saved_email', cleanEmail);
        } else {
          localStorage.removeItem('lost_saved_email');
        }
      }

      onShowToast?.(data.message || 'Đăng nhập thành công!', 'success');
      onAuthSuccess(data.user);
      window.dispatchEvent(
        new CustomEvent('lost:auth-changed', { detail: { authenticated: true, user: data.user } })
      );
      onClose();
    } catch {
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
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
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

      onShowToast?.(
        `Thư khôi phục đã gửi đến ${email}. Vui lòng mở hòm thư email cá nhân của bạn!`,
        'info'
      );
      setMode('login');
    } catch {
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
    if (getPasswordStrength(newPassword).score < 2) {
      setErrorMessage(
        'Mật khẩu mới phải có tối thiểu 8 ký tự, bao gồm chữ hoa A-Z, chữ thường a-z và chữ số 0-9.'
      );
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
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword }),
      });

      const data = await res.json();
      setIsLoading(false);

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Không thể đặt lại mật khẩu.');
        return;
      }

      onShowToast?.('Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay.', 'success');
      window.history.replaceState({}, document.title, window.location.pathname);
      setMode('login');
      setPassword(newPassword);
    } catch {
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
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: otpCode }),
      });

      const data = await res.json();
      setIsLoading(false);

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Mã xác thực không hợp lệ.');
        return;
      }

      if (data.token) {
        localStorage.setItem('lost_token', data.token);
      }

      onShowToast?.(data.message || 'Kích hoạt tài khoản thành công!', 'success');
      onAuthSuccess(data.user);
      window.dispatchEvent(
        new CustomEvent('lost:auth-changed', { detail: { authenticated: true, user: data.user } })
      );
      onClose();
    } catch {
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
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();
      setIsLoading(false);

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Không thể gửi lại mã OTP. Vui lòng thử lại.');
        return;
      }

      setOtpCode('');
      setResendCooldown(60);
      onShowToast?.(`Mã OTP 6 số mới đã được gửi tới email ${email}!`, 'success');
    } catch {
      setIsLoading(false);
      setErrorMessage('Lỗi máy chủ khi gửi lại mã OTP.');
    }
  };

  const handleGoogleLogin = () => {
    setErrorMessage('');
    setIsGoogleWarning(false);

    if (!GOOGLE_CLIENT_ID) {
      setErrorMessage(
        'Đăng nhập Google chưa được cấu hình trên môi trường này. Vui lòng sử dụng Email và Mật khẩu.'
      );
      return;
    }

    const googleOAuth =
      typeof window !== 'undefined'
        ? (window as GoogleOAuthWindow).google?.accounts?.oauth2
        : undefined;
    if (googleOAuth) {
      const client = googleOAuth.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'email profile openid',
        callback: async (tokenResponse: GoogleTokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            setIsLoading(true);
            try {
              const res = await fetch('/api/auth/google', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  token: tokenResponse.access_token,
                }),
              });

              const data = await res.json();
              setIsLoading(false);

              if (data.success) {
                localStorage.setItem('lost_token', data.token);
                onShowToast?.(
                  `Đăng nhập Google thành công! Chào mừng ${data.user.fullName || data.user.email}`,
                  'success'
                );
                onAuthSuccess(data.user);
                window.dispatchEvent(
                  new CustomEvent('lost:auth-changed', { detail: { authenticated: true, user: data.user } })
                );
                onClose();
              } else {
                setErrorMessage(data.message || 'Đăng nhập Google thất bại.');
              }
            } catch {
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

  const inputBaseStyle: React.CSSProperties = {
    width: '100%',
    paddingLeft: 34,
    paddingRight: 12,
    height: 38,
    borderRadius: 4,
    fontSize: '0.84rem',
    background: 'var(--color-bg-main)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-main)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <>
      {createPortal(
    <div
      className="modal-overlay"
      onClick={handleClose}
      style={{
        zIndex: 'var(--z-modal-nested, 3100)' as unknown as number,
        background: 'var(--overlay-bg)',
        padding: '20px 14px',
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Xác thực tài khoản LOST"
        className="modal-content modal-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 422,
          width: '100%',
          maxHeight: 'min(92vh, 760px)',
          overflowY: 'auto',
          padding: '22px 24px',
          borderRadius: 6,
          position: 'relative',
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: 'var(--shadow-3d)',
          boxSizing: 'border-box',
          margin: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
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
            borderRadius: 4,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          <IconX size={15} color="currentColor" />
        </button>

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 14, width: '100%' }}>
          <div
            style={{
              background: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border-strong)',
              width: 38,
              height: 38,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 8px auto',
              color: 'var(--color-primary)',
            }}
          >
            <IconCompass size={20} color="var(--color-primary)" />
          </div>

          <h2
            className="font-editorial"
            style={{
              fontSize: '1.45rem',
              fontWeight: 500,
              color: 'var(--color-text-main)',
              margin: 0,
              lineHeight: 1.15,
            }}
          >
            {mode === 'register'
              ? 'Tạo Tài Khoản LOST'
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
              marginTop: 3,
              marginBottom: 0,
              lineHeight: 1.35,
            }}
          >
            {mode === 'register'
              ? 'Gia nhập cộng đồng chia sẻ điểm trekking hoang sơ & cung ẩn Việt Nam'
              : mode === 'login'
                ? 'Chào mừng bạn quay trở lại với LOST'
                : mode === 'forgot-password'
                  ? 'Nhập email cá nhân để nhận liên kết khôi phục'
                  : mode === 'verify-code'
                    ? `Điền mã 6 số đã gửi tới email ${email}`
                    : 'Nhập mật khẩu mới an toàn cho tài khoản'}
          </p>
        </div>

        {/* Segmented Tab Switcher */}
        {(mode === 'register' || mode === 'login') && (
          <div
            role="tablist"
            style={{
              background: 'var(--color-bg-main)',
              padding: 3,
              borderRadius: 6,
              display: 'flex',
              position: 'relative',
              width: '100%',
              marginBottom: 12,
              border: '1px solid var(--color-border)',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 3,
                left: 3,
                width: 'calc(50% - 3px)',
                height: 'calc(100% - 6px)',
                borderRadius: 4,
                background: 'var(--color-primary)',
                transform: mode === 'register' ? 'translateX(0%)' : 'translateX(100%)',
                transition: 'transform 0.24s cubic-bezier(0.2, 0.9, 0.3, 1)',
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
                borderRadius: 4,
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: 'transparent',
                color: mode === 'register' ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                position: 'relative',
                zIndex: 2,
              }}
            >
              <IconUser
                size={15}
                color={mode === 'register' ? 'var(--color-on-primary)' : 'var(--color-text-muted)'}
              />
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
                borderRadius: 4,
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: 'transparent',
                color: mode === 'login' ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                position: 'relative',
                zIndex: 2,
              }}
            >
              <IconLock
                size={15}
                color={mode === 'login' ? 'var(--color-on-primary)' : 'var(--color-text-muted)'}
              />
              <span>Đăng nhập</span>
            </button>
          </div>
        )}

        <div key={mode} className="auth-form-fade" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {errorMessage && (
            <div
              role="alert"
              style={{
                background: isGoogleWarning
                  ? 'color-mix(in srgb, var(--color-warning) 13%, transparent)'
                  : 'color-mix(in srgb, var(--color-error) 13%, transparent)',
                border: `1px solid ${
                  isGoogleWarning
                    ? 'color-mix(in srgb, var(--color-warning) 42%, transparent)'
                    : 'color-mix(in srgb, var(--color-error) 42%, transparent)'
                }`,
                color: isGoogleWarning
                  ? 'var(--color-warning)'
                  : 'var(--color-error-text, var(--color-error))',
                borderRadius: 4,
                padding: '8px 12px',
                fontSize: '0.78rem',
                marginBottom: 10,
                textAlign: 'left',
                width: '100%',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 7,
                lineHeight: 1.35,
              }}
            >
              <IconAlertTriangle
                size={15}
                color={
                  isGoogleWarning
                    ? 'var(--color-warning)'
                    : 'var(--color-error-text, var(--color-error))'
                }
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <span style={{ fontWeight: 600 }}>{errorMessage}</span>
            </div>
          )}

          {/* 1. Register & Login Form */}
          {(mode === 'register' || mode === 'login') && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%' }}>
              {mode === 'register' && (
                <>
                  <div style={{ width: '100%' }}>
                    <label
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        marginBottom: 3,
                        display: 'block',
                        color: 'var(--color-text-muted)',
                        textAlign: 'left',
                      }}
                    >
                      Họ và tên hiển thị
                    </label>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <div style={{ position: 'absolute', left: 10, top: 11, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                        <IconUser size={15} color="var(--color-primary)" />
                      </div>
                      <input
                        ref={primaryInputRef}
                        type="text"
                        placeholder="Nguyễn Minh Khôi"
                        style={inputBaseStyle}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ width: '100%' }}>
                    <label
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        marginBottom: 3,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        color: 'var(--color-text-muted)',
                        textAlign: 'left',
                      }}
                    >
                      <span>Tên tài khoản / Handle (Tùy chọn)</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--color-text-dim)' }}>
                        Bỏ trống để tự tạo
                      </span>
                    </label>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          left: 11,
                          top: 9,
                          pointerEvents: 'none',
                          fontSize: '0.84rem',
                          fontWeight: 800,
                          color: 'var(--color-primary)',
                        }}
                      >
                        @
                      </span>
                      <input
                        type="text"
                        placeholder="minh_trekker"
                        maxLength={30}
                        style={{
                          ...inputBaseStyle,
                          paddingLeft: 28,
                          borderColor:
                            usernameCheckStatus === 'available'
                              ? 'var(--color-primary)'
                              : usernameCheckStatus === 'taken' || usernameCheckStatus === 'invalid'
                                ? 'var(--color-error)'
                                : 'var(--color-border)',
                        }}
                        value={username}
                        onChange={(e) => {
                          const nextVal = e.target.value;
                          setUsername(nextVal);
                          setUsernameSuggestions([]);
                          if (!nextVal.trim()) {
                            setUsernameCheckStatus('idle');
                            setUsernameCheckMessage('');
                          }
                        }}
                        autoComplete="username"
                      />
                    </div>

                    {username.trim() && usernameCheckStatus !== 'idle' && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: '0.71rem',
                          fontWeight: 600,
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          color:
                            usernameCheckStatus === 'available'
                              ? 'var(--color-primary)'
                              : usernameCheckStatus === 'checking'
                                ? 'var(--color-text-dim)'
                                : 'var(--color-error-text, var(--color-error))',
                        }}
                      >
                        {usernameCheckStatus === 'available' && <IconCheck size={12} color="var(--color-primary)" />}
                        {(usernameCheckStatus === 'taken' || usernameCheckStatus === 'invalid') && (
                          <IconAlertTriangle size={12} color="var(--color-error-text, var(--color-error))" />
                        )}
                        {usernameCheckStatus === 'checking' && (
                          <IconRotateCw size={12} color="currentColor" style={{ animation: 'spin 1s linear infinite' }} />
                        )}
                        <span>{usernameCheckMessage}</span>
                      </div>
                    )}

                    {usernameSuggestions.length > 0 && (
                      <div style={{ marginTop: 5, textAlign: 'left' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 700, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <IconSparkles size={12} color="var(--color-primary)" /> Gợi ý tên tài khoản khả dụng:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {usernameSuggestions.map((sug) => (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => {
                                setUsername(sug);
                                setUsernameSuggestions([]);
                                setUsernameCheckStatus('available');
                                setUsernameCheckMessage('Tên tài khoản này có thể sử dụng!');
                                setErrorMessage('');
                              }}
                              style={{
                                background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)',
                                color: 'var(--color-primary)',
                                borderRadius: 4,
                                padding: '2px 8px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              @{sug}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Email Field */}
              <div style={{ width: '100%' }}>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    marginBottom: 3,
                    display: 'block',
                    color: 'var(--color-text-muted)',
                    textAlign: 'left',
                  }}
                >
                  Địa chỉ Email
                </label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <div style={{ position: 'absolute', left: 10, top: 11, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                    <IconMail size={15} color="var(--color-primary)" />
                  </div>
                  <input
                    ref={mode === 'login' ? primaryInputRef : undefined}
                    type="email"
                    placeholder="email@domain.com"
                    style={inputBaseStyle}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div style={{ width: '100%' }}>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    marginBottom: 3,
                    display: 'block',
                    color: 'var(--color-text-muted)',
                    textAlign: 'left',
                  }}
                >
                  Mật khẩu
                </label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <div style={{ position: 'absolute', left: 10, top: 11, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                    <IconLock size={15} color="var(--color-primary)" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    style={{ ...inputBaseStyle, paddingRight: 34 }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
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
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                  >
                    {showPassword ? <IconEyeOff size={15} color="currentColor" /> : <IconEye size={15} color="currentColor" />}
                  </button>
                </div>

                {mode === 'register' && password && (
                  <div style={{ marginTop: 4, textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', marginBottom: 2 }}>
                      <span style={{ color: 'var(--color-text-dim)', fontWeight: 600 }}>Độ mạnh:</span>
                      <span style={{ fontWeight: 800, color: getPasswordStrength(password).color }}>
                        {getPasswordStrength(password).label}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 3, background: 'var(--color-bg-main)', borderRadius: 2, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${getPasswordStrength(password).percent}%`,
                          height: '100%',
                          background: getPasswordStrength(password).color,
                          transition: 'width 0.25s ease, background-color 0.25s ease',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {mode === 'register' && (
                <div style={{ width: '100%' }}>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      marginBottom: 3,
                      display: 'block',
                      color: 'var(--color-text-muted)',
                      textAlign: 'left',
                    }}
                  >
                    Nhập lại mật khẩu
                  </label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <div style={{ position: 'absolute', left: 10, top: 11, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                      <IconShieldCheck size={15} color="var(--color-primary)" />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      style={{ ...inputBaseStyle, paddingRight: 34 }}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
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
                      aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                    >
                      {showConfirmPassword ? (
                        <IconEyeOff size={15} color="currentColor" />
                      ) : (
                        <IconEye size={15} color="currentColor" />
                      )}
                    </button>
                  </div>
                </div>
              )}

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
                  >
                    Quên mật khẩu?
                  </button>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
                style={{
                  width: '100%',
                  height: 40,
                  borderRadius: 4,
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  marginTop: 4,
                  cursor: isLoading ? 'wait' : 'pointer',
                }}
              >
                {isLoading ? 'Đang xử lý...' : mode === 'register' ? 'Đăng Ký Tài Khoản' : 'Đăng Nhập'}
              </button>

              {mode === 'register' && (
                <p
                  style={{
                    margin: '2px 0 0 0',
                    fontSize: '0.72rem',
                    lineHeight: 1.5,
                    color: 'var(--color-text-dim)',
                    textAlign: 'center',
                  }}
                >
                  Bằng việc đăng ký tài khoản, bạn đồng ý với{' '}
                  <button
                    type="button"
                    onClick={() => setLegalTab('terms')}
                    style={{
                      color: 'var(--color-primary)',
                      fontWeight: 700,
                      fontSize: 'inherit',
                      textDecoration: 'underline',
                      textUnderlineOffset: 2,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Điều khoản &amp; Miễn trừ thực địa
                  </button>{' '}
                  và{' '}
                  <button
                    type="button"
                    onClick={() => setLegalTab('privacy')}
                    style={{
                      color: 'var(--color-primary)',
                      fontWeight: 700,
                      fontSize: 'inherit',
                      textDecoration: 'underline',
                      textUnderlineOffset: 2,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Chính sách bảo mật (NĐ 13/2023)
                  </button>{' '}
                  của LOST.
                </p>
              )}
            </form>
          )}

          {/* 2. Forgot Password Request Form */}
          {mode === 'forgot-password' && (
            <form onSubmit={handleRequestResetEmail} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              <div style={{ width: '100%' }}>
                <label
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    marginBottom: 4,
                    display: 'block',
                    color: 'var(--color-text-muted)',
                    textAlign: 'left',
                  }}
                >
                  Địa chỉ Email đăng ký
                </label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <div style={{ position: 'absolute', left: 10, top: 11, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                    <IconMail size={16} color="var(--color-primary)" />
                  </div>
                  <input
                    ref={primaryInputRef}
                    type="email"
                    placeholder="email@domain.com"
                    style={{ ...inputBaseStyle, height: 40 }}
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
                style={{
                  width: '100%',
                  height: 40,
                  borderRadius: 4,
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  marginTop: 2,
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
                  <div style={{ position: 'absolute', left: 10, top: 11, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                    <IconLock size={16} color="var(--color-primary)" />
                  </div>
                  <input
                    ref={primaryInputRef}
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    style={{ ...inputBaseStyle, height: 40, paddingRight: 36 }}
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
                    aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
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
                  <div style={{ position: 'absolute', left: 10, top: 11, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                    <IconShieldCheck size={16} color="var(--color-primary)" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    style={{ ...inputBaseStyle, height: 40, paddingRight: 36 }}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
                style={{
                  width: '100%',
                  height: 40,
                  borderRadius: 4,
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  marginTop: 2,
                }}
              >
                {isLoading ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu Mới'}
              </button>
            </form>
          )}

          {/* 4. 6-Digit OTP Verification Screen */}
          {mode === 'verify-code' && (
            <form onSubmit={handleVerifyOtpCode} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              {verifyNotice && (
                <div
                  role="status"
                  style={{
                    background: 'color-mix(in srgb, var(--color-sky) 12%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-sky) 40%, transparent)',
                    color: 'var(--color-text-main)',
                    borderRadius: 4,
                    padding: '8px 11px',
                    fontSize: '0.76rem',
                    lineHeight: 1.4,
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 7,
                  }}
                >
                  <IconShieldCheck size={15} color="var(--color-sky)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{verifyNotice}</span>
                </div>
              )}
              <div style={{ width: '100%', textAlign: 'center' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--color-text-muted)' }}>
                  Mã xác nhận 6 chữ số
                </label>
                <input
                  ref={primaryInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="8 4 9 2 0 1"
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    height: 46,
                    borderRadius: 4,
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
                <p style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)', marginTop: 6, marginBottom: 0 }}>
                  Kiểm tra hòm thư Email / Spam của <strong>{email}</strong>
                </p>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
                style={{
                  width: '100%',
                  height: 40,
                  borderRadius: 4,
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  marginTop: 2,
                }}
              >
                {isLoading ? 'Đang kích hoạt...' : 'Xác Nhận & Đăng Nhập Ngay'}
              </button>

              <button
                type="button"
                onClick={handleResendOtpCode}
                disabled={resendCooldown > 0 || isLoading}
                style={{
                  background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)',
                  borderRadius: 4,
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

          {/* Optional Google OAuth Login (shown when VITE_GOOGLE_CLIENT_ID is configured) */}
          {(mode === 'register' || mode === 'login') && GOOGLE_CLIENT_ID && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  margin: '10px 0 8px 0',
                  fontSize: '0.72rem',
                  color: 'var(--color-text-dim)',
                  width: '100%',
                }}
              >
                <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                <span>Hoặc tiếp tục với</span>
                <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="btn btn-outline"
                style={{
                  width: '100%',
                  background: 'var(--color-bg-card)',
                  color: 'var(--color-text-main)',
                  border: isGoogleWarning
                    ? '1.5px solid var(--color-warning)'
                    : '1px solid var(--color-border-strong)',
                  borderRadius: 4,
                  height: 38,
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <IconGoogle size={16} />
                <span>Đăng nhập bằng Google</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
      )}
      <LegalNoticesModal
        isOpen={legalTab !== null}
        initialTab={legalTab ?? 'terms'}
        onClose={() => setLegalTab(null)}
        nested
      />
    </>
  );
};
