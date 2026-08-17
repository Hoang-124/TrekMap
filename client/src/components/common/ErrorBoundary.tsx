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
    console.error('⚠️ [TrekMap ErrorBoundary Captured Error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

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
              maxWidth: 580,
              width: '100%',
              textAlign: 'center',
              padding: '36px 28px',
              borderRadius: 20,
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--color-error)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 18px auto',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 8, color: 'var(--color-text-main)' }}>
              {this.props.fallbackTitle || 'Đã có lỗi hiển thị giao diện'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              Hệ thống đã tự động bảo vệ trạng thái ứng dụng. Bạn có thể làm mới bộ lọc tìm kiếm hoặc quay về Trang Chủ.
            </p>

            {this.state.error && (
              <pre
                style={{
                  textAlign: 'left',
                  background: 'var(--color-bg-main)',
                  padding: 12,
                  borderRadius: 10,
                  fontSize: '0.72rem',
                  color: 'var(--color-error)',
                  overflowX: 'auto',
                  marginBottom: 20,
                  border: '1px solid var(--color-border)',
                }}
              >
                {this.state.error.message}
              </pre>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => this.setState({ hasError: false })}
                className="btn btn-primary"
                style={{ padding: '10px 20px', borderRadius: 20, fontWeight: 700, fontSize: '0.85rem' }}
              >
                Thử Lại
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="btn btn-outline"
                style={{ padding: '10px 20px', borderRadius: 20, fontWeight: 700, fontSize: '0.85rem' }}
              >
                Về Trang Chủ
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
