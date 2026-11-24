import React, { useEffect, useState } from 'react';

export type AdminReadinessLevel = 'critical' | 'attention' | 'stable';

export interface AdminStatusBarProps {
  readiness: AdminReadinessLevel;
  readinessDetail?: string;
  activeCoords: { lat: number; lng: number } | null;
  isCoordLocked?: boolean;
  dbStatus: 'checking' | 'online' | 'connecting' | 'degraded' | 'offline';
  dbLabel: string;
  isSocketConnected: boolean;
}

const ICT_TIME_FORMATTER = (() => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return null;
  }
})();

const formatVietnamIctTime = (date: Date): string => {
  if (ICT_TIME_FORMATTER) {
    try {
      return ICT_TIME_FORMATTER.format(date);
    } catch {
      // fall through to manual UTC+7 calculation
    }
  }
  const ict = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const hh = String(ict.getUTCHours()).padStart(2, '0');
  const mm = String(ict.getUTCMinutes()).padStart(2, '0');
  const ss = String(ict.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const formatGpsReadout = (lat: number, lng: number): string => {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lng).toFixed(4)}° ${ew}`;
};

const READINESS_META: Record<
  AdminReadinessLevel,
  { label: string; lampClass: string; colorVar: string }
> = {
  critical: {
    label: 'KHẨN CẤP',
    lampClass: 'admin-readiness-lamp admin-readiness-lamp--danger',
    colorVar: 'var(--color-error-text, var(--color-error))',
  },
  attention: {
    label: 'CẦN XỬ LÝ',
    lampClass: 'admin-readiness-lamp admin-readiness-lamp--warn',
    colorVar: 'var(--color-sun)',
  },
  stable: {
    label: 'ỔN ĐỊNH',
    lampClass: 'admin-readiness-lamp admin-readiness-lamp--ok',
    colorVar: 'var(--color-primary)',
  },
};

const IctClockReadout: React.FC = React.memo(() => {
  const [clockText, setClockText] = useState<string>(() => formatVietnamIctTime(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockText(formatVietnamIctTime(new Date()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span
      className="admin-statusbar-item"
      title="Đồng hồ tác chiến chuẩn giờ Việt Nam (UTC+7 / ICT)"
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        color: 'var(--color-text-main)',
        fontWeight: 600,
      }}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-text-dim)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span>{clockText} ICT</span>
    </span>
  );
});

IctClockReadout.displayName = 'IctClockReadout';

export const AdminStatusBar: React.FC<AdminStatusBarProps> = React.memo(
  ({
    readiness,
    readinessDetail,
    activeCoords,
    isCoordLocked = false,
    dbStatus,
    dbLabel,
    isSocketConnected,
  }) => {
    const meta = READINESS_META[readiness];
    const dbDotClass =
      dbStatus === 'online'
        ? 'admin-dot admin-dot--ok'
        : dbStatus === 'connecting'
          ? 'admin-dot admin-dot--warn'
          : dbStatus === 'checking'
            ? 'admin-dot'
            : 'admin-dot admin-dot--danger';

    const hasValidCoords =
      activeCoords !== null &&
      Number.isFinite(activeCoords.lat) &&
      Number.isFinite(activeCoords.lng);

    return (
      <footer className="admin-statusbar" aria-label="Thanh công cụ trạng thái điều hành">
        {/* LEFT: Live ICT Clock + Operational Readiness */}
        <div className="admin-statusbar-group">
          <IctClockReadout />
          <span aria-hidden="true" style={{ opacity: 0.35 }}>
            |
          </span>
          <span
            className="admin-statusbar-item"
            title={readinessDetail || `Trạng thái vận hành: ${meta.label}`}
            style={{ color: meta.colorVar, fontWeight: 700, letterSpacing: '0.04em' }}
          >
            <span className={meta.lampClass} aria-hidden="true" />
            <span>{meta.label}</span>
          </span>
          {readinessDetail && (
            <span
              className="admin-statusbar-item"
              style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}
            >
              {readinessDetail}
            </span>
          )}
        </div>

        {/* CENTER: Live Pointer / Locked GPS Readout */}
        <div className="admin-statusbar-group">
          <span
            className="admin-statusbar-item"
            title={
              hasValidCoords
                ? isCoordLocked
                  ? 'Tọa độ mục tiêu đang khóa trong trình thanh tra'
                  : 'Tọa độ con trỏ thời gian thực trên radar VN-2000'
                : 'Hệ quy chiếu VN-2000 · Di chuột trên radar hoặc chọn mục để xem tọa độ'
            }
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              color: hasValidCoords ? 'var(--color-text-main)' : 'var(--color-text-dim)',
              minWidth: 196,
              justifyContent: 'center',
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke={hasValidCoords ? 'var(--color-primary)' : 'var(--color-text-dim)'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="7" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
            <span>
              {hasValidCoords
                ? `${isCoordLocked ? 'LOCK ' : ''}${formatGpsReadout(activeCoords.lat, activeCoords.lng)}`
                : 'VN-2000 · 16.0544° N, 108.2022° E'}
            </span>
          </span>
        </div>

        {/* RIGHT: Telemetry Links + Keyboard Shortcut Chips */}
        <div className="admin-statusbar-group">
          <span
            className="admin-statusbar-item"
            title={`MongoDB: ${dbLabel}`}
          >
            <span className={dbDotClass} aria-hidden="true" />
            <span>DB {dbStatus === 'online' ? 'OK' : dbLabel}</span>
          </span>

          <span
            className="admin-statusbar-item"
            title={isSocketConnected ? 'Socket.IO trực tuyến' : 'Đang đồng bộ lại Socket.IO'}
          >
            <span
              className={isSocketConnected ? 'admin-dot admin-dot--ok' : 'admin-dot admin-dot--warn'}
              aria-hidden="true"
            />
            <span>{isSocketConnected ? 'WS LIVE' : 'WS SYNC'}</span>
          </span>

          <span
            className="admin-statusbar-group admin-statusbar-group--hints"
            aria-label="Phím tắt bàn phím"
          >
            <span aria-hidden="true" style={{ opacity: 0.35 }}>
              |
            </span>
            <span className="admin-statusbar-item">
              <kbd className="admin-kbd-chip">[</kbd>
              <span aria-hidden="true">·</span>
              <kbd className="admin-kbd-chip">0–9</kbd>
              <span aria-hidden="true">·</span>
              <kbd className="admin-kbd-chip">/</kbd>
              <span aria-hidden="true">·</span>
              <kbd className="admin-kbd-chip">Esc</kbd>
            </span>
          </span>
        </div>
      </footer>
    );
  }
);

AdminStatusBar.displayName = 'AdminStatusBar';
