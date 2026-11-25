import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

const CHUNK_RELOAD_KEY = 'lost_chunk_reload_at';

function isDynamicImportError(error: Error | null): boolean {
  const msg = String(error?.message || '').toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('chunkloaderror') ||
    msg.includes('outdated optimize dep')
  );
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[LOST ErrorBoundary Captured Error]:', error, errorInfo);
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    if (isDynamicImportError(error) && typeof window !== 'undefined' && isOnline) {
      try {
        const lastReload = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
        if (!Number.isFinite(lastReload) || Date.now() - lastReload > 12_000) {
          window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
          window.location.reload();
          return;
        }
      } catch {
        // Ignore storage restrictions and fall through to UI
      }
    }
    this.setState({ errorInfo });
  }

  private handleRetry = () => {
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    if (isDynamicImportError(this.state.error) && isOnline) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            background: 'var(--color-bg-main)',
            color: 'var(--color-text-main)',
            fontFamily: 'var(--font-family)',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 540,
              width: '100%',
              textAlign: 'center',
              padding: '36px 28px',
              borderRadius: 4,
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-strong)',
              borderTop: '3px solid var(--color-error)',
              boxShadow: 'var(--shadow-3d)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 4,
                background: 'color-mix(in srgb, var(--color-error) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-error) 34%, transparent)',
                color: 'var(--color-error-text, var(--color-error))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 18px auto',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h3 className="font-editorial" style={{ fontSize: '1.5rem', fontWeight: 500, marginBottom: 8, color: 'var(--color-text-main)' }}>
              {this.props.fallbackTitle || 'Trang này vừa gặp chút trục trặc'}
            </h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              {typeof navigator !== 'undefined' && navigator.onLine === false
                ? 'Thiết bị đang ngoại tuyến nên chưa tải được thành phần này. Bạn có thể quay về trang chủ hoặc thử lại khi có sóng.'
                : 'Có một lỗi nhỏ khiến màn hình này chưa hiện ra được. Bạn thử tải lại hoặc quay về trang chủ nhé.'}
            </p>

            {import.meta.env.DEV && this.state.error && (
              <pre
                style={{
                  textAlign: 'left',
                  background: 'var(--color-bg-main)',
                  padding: 12,
                  borderRadius: 4,
                  fontSize: '0.72rem',
                  color: 'var(--color-error-text, var(--color-error))',
                  overflowX: 'auto',
                  marginBottom: 20,
                  border: '1px solid var(--color-border)',
                }}
              >
                {this.state.error.message}
              </pre>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={this.handleRetry}
                className="btn btn-primary"
                style={{ padding: '9px 20px', fontSize: '0.84rem' }}
              >
                Thử lại
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="btn btn-outline"
                style={{ padding: '9px 20px', fontSize: '0.84rem' }}
              >
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
