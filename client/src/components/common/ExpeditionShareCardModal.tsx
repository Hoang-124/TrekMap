import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isTopmostFocusTrap, useFocusTrap } from '../../hooks/useFocusTrap.js';
import {
  renderExpeditionShareCardPng,
  type ExpeditionShareCardInput,
  type ShareCardFormat,
  type ShareCardTheme,
} from '../../utils/expeditionShareCard.js';
import {
  IconCheckCircle,
  IconDownload,
  IconImage,
  IconMountain,
  IconShare,
  IconX,
} from './SvgIcons.js';

export interface ExpeditionShareCardModalProps {
  isOpen: boolean;
  initialData: Omit<ExpeditionShareCardInput, 'format' | 'theme' | 'caption'> & {
    defaultCaption?: string;
  };
  onClose: () => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const IconPortraitSvg: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="6" y="3" width="12" height="18" rx="2" />
  </svg>
);

const IconLandscapeSvg: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="6" width="18" height="12" rx="2" />
  </svg>
);

function detectCurrentTheme(): ShareCardTheme {
  if (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light') {
    return 'light';
  }
  return 'dark';
}

export const ExpeditionShareCardModal: React.FC<ExpeditionShareCardModalProps> = ({
  isOpen,
  initialData,
  onClose,
  onShowToast,
}) => {
  const [format, setFormat] = useState<ShareCardFormat>('portrait');
  const [theme, setTheme] = useState<ShareCardTheme>(detectCurrentTheme);
  const [hikerName, setHikerName] = useState<string>(initialData.hikerName || 'Nhà Thám Hiểm LOST');
  const [caption, setCaption] = useState<string>(initialData.defaultCaption || '');
  const [prevSeedKey, setPrevSeedKey] = useState<string>(
    `${initialData.peakName}|${initialData.hikerName}`
  );
  const [wasOpen, setWasOpen] = useState<boolean>(isOpen);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{
    fileName: string;
    width: number;
    height: number;
    sizeKb: number;
  } | null>(null);
  const [isRendering, setIsRendering] = useState<boolean>(isOpen);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState<boolean>(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const activeBlobRef = useRef<Blob | null>(null);
  const activeUrlRef = useRef<string | null>(null);
  const renderSeqRef = useRef<number>(0);
  const onShowToastRef = useRef(onShowToast);

  useFocusTrap(isOpen, dialogRef);

  useEffect(() => {
    onShowToastRef.current = onShowToast;
  }, [onShowToast]);

  // Clear stale revoked preview on close and re-sync live app theme on fresh open (zero effect setState)
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    setPreviewUrl(null);
    setPreviewMeta(null);
    setRenderError(null);
    if (isOpen) {
      setTheme(detectCurrentTheme());
      setIsRendering(true);
    } else {
      setIsRendering(false);
    }
  }

  // Sync editable hikerName / caption only when target peak or user identity changes (never on mutable point counts)
  const seedKey = `${initialData.peakName}|${initialData.hikerName}`;
  if (seedKey !== prevSeedKey) {
    setPrevSeedKey(seedKey);
    setHikerName(initialData.hikerName || 'Nhà Thám Hiểm LOST');
    setCaption(initialData.defaultCaption || '');
  }

  // Revoke any active object URL cleanly on close or unmount
  useEffect(() => {
    if (!isOpen && activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = null;
      activeBlobRef.current = null;
    }
    return () => {
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = null;
      }
      activeBlobRef.current = null;
    };
  }, [isOpen]);

  // Capture-phase Escape closes ONLY this topmost modal and blocks underlying bubble listeners
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if (!isTopmostFocusTrap(dialogRef.current)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [isOpen, onClose]);

  // Debounced live procedural Canvas PNG render (strict race-ID guard + automatic blob revocation)
  useEffect(() => {
    if (!isOpen) return;
    const seq = ++renderSeqRef.current;
    let cancelled = false;

    const timerId = window.setTimeout(() => {
      setIsRendering(true);
      setRenderError(null);

      void renderExpeditionShareCardPng({
        peakName: initialData.peakName,
        province: initialData.province,
        region: initialData.region,
        altitudeM: initialData.altitudeM,
        distanceKm: initialData.distanceKm,
        elevationGainM: initialData.elevationGainM,
        durationLabel: initialData.durationLabel,
        dateLabel: initialData.dateLabel,
        hikerName: hikerName.trim() || initialData.hikerName || 'Nhà Thám Hiểm LOST',
        caption: caption.trim(),
        verifiedGps: initialData.verifiedGps,
        coordinates: initialData.coordinates,
        trackPoints: initialData.trackPoints,
        format,
        theme,
      })
        .then((res) => {
          if (cancelled || seq !== renderSeqRef.current) return;
          const nextUrl = URL.createObjectURL(res.blob);
          if (activeUrlRef.current) {
            URL.revokeObjectURL(activeUrlRef.current);
          }
          activeUrlRef.current = nextUrl;
          activeBlobRef.current = res.blob;
          setPreviewUrl(nextUrl);
          setPreviewMeta({
            fileName: res.fileName,
            width: res.width,
            height: res.height,
            sizeKb: Math.max(1, Math.round(res.blob.size / 1024)),
          });
          setRenderError(null);
        })
        .catch((err: unknown) => {
          if (cancelled || seq !== renderSeqRef.current) return;
          const msg = err instanceof Error ? err.message : 'Không thể dựng ảnh thẻ PNG lúc này.';
          setRenderError(msg);
        })
        .finally(() => {
          if (!cancelled && seq === renderSeqRef.current) {
            setIsRendering(false);
          }
        });
    }, 140);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [
    isOpen,
    format,
    theme,
    hikerName,
    caption,
    initialData.peakName,
    initialData.province,
    initialData.region,
    initialData.altitudeM,
    initialData.distanceKm,
    initialData.elevationGainM,
    initialData.durationLabel,
    initialData.dateLabel,
    initialData.hikerName,
    initialData.verifiedGps,
    initialData.coordinates,
    initialData.trackPoints,
  ]);

  const handleDownloadPng = (silentToast = false): boolean => {
    const blob = activeBlobRef.current;
    if (!blob || !previewMeta) return false;
    // Mint a dedicated short-lived download URL with 1500ms delayed revoke so concurrent re-renders never abort downloads
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = previewMeta.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
    if (!silentToast) {
      onShowToastRef.current?.(`Đã tải ảnh thẻ hành trình (${previewMeta.width}×${previewMeta.height} PNG)!`, 'success');
    }
    return true;
  };

  const handleNativeShare = async () => {
    const blob = activeBlobRef.current;
    if (!blob || !previewMeta || isSharing) return;
    setIsSharing(true);
    try {
      const file = new File([blob], previewMeta.fileName, { type: 'image/png' });
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (typeof nav.share === 'function' && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({
          files: [file],
          title: `LOST — ${initialData.peakName}`,
          text: `${initialData.peakName} (${initialData.altitudeM}m · ${initialData.distanceKm.toFixed(1)} km · +${initialData.elevationGainM}m) — LOST Vietnam Alpine Atlas`,
        });
        onShowToastRef.current?.('Đã chia sẻ thẻ hành trình LOST!', 'success');
        return;
      }
      // Fallback on desktop browsers without Web Share file support: trigger clean PNG download with single toast
      if (handleDownloadPng(true)) {
        onShowToastRef.current?.(
          'Trình duyệt máy tính chưa hỗ trợ chia sẻ tệp trực tiếp — đã tải sẵn ảnh PNG để bạn đăng Zalo/Facebook!',
          'info'
        );
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      handleDownloadPng(false);
    } finally {
      setIsSharing(false);
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-lightbox, 4000)' as unknown as number,
        background: 'var(--overlay-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(10px, 2.5vw, 20px)',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Xuất thẻ PNG hành trình ${initialData.peakName}`}
        tabIndex={-1}
        className="modal-content modal-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 920,
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: 'clamp(14px, 3vw, 22px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          outline: 'none',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div className="section-eyebrow" style={{ marginBottom: 4 }}>
              LOST OFFLINE EXPEDITION POSTER · 100% CANVAS PNG
            </div>
            <h2
              className="font-editorial"
              style={{
                fontSize: '1.3rem',
                color: 'var(--color-text-main)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                margin: 0,
              }}
            >
              <IconImage size={19} color="var(--color-primary)" />
              <span>Xuất Thẻ PNG Hành Trình — {initialData.peakName}</span>
            </h2>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: '6px 8px' }}
            onClick={onClose}
            aria-label="Đóng cửa sổ xuất thẻ PNG"
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Split Preview + Customization Controls */}
        <div className="route-planner-split" style={{ gap: 18, alignItems: 'start' }}>
          {/* Left: Live Rendered Canvas Preview */}
          <div
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 6,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              minHeight: 320,
            }}
          >
            {renderError ? (
              <div
                role="alert"
                style={{
                  color: 'var(--color-error-text, var(--banner-danger-text))',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  padding: 16,
                }}
              >
                {renderError}
              </div>
            ) : previewUrl ? (
              <img
                loading="lazy"
                decoding="async"
                src={previewUrl}
                alt={`Xem trước thẻ hành trình ${initialData.peakName}`}
                style={{
                  maxWidth: '100%',
                  maxHeight: format === 'portrait' ? 460 : 340,
                  borderRadius: 4,
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-card)',
                  display: 'block',
                  opacity: isRendering ? 0.65 : 1,
                  transition: 'opacity 0.16s ease',
                }}
              />
            ) : (
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.84rem', padding: 36 }}>
                Đang vẽ bản đồ địa hình &amp; lộ trình GPX lên thẻ PNG...
              </div>
            )}

            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                fontSize: '0.73rem',
                color: 'var(--color-text-dim)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <IconMountain size={13} color="var(--color-primary)" />
                <span>
                  {initialData.trackPoints && initialData.trackPoints.length >= 2
                    ? `Vẽ trực tiếp ${initialData.trackPoints.length} điểm GPX thực tế`
                    : 'Đồ họa địa hình thực địa ngoại tuyến'}
                </span>
              </span>
              {previewMeta && (
                <span>
                  {previewMeta.width}×{previewMeta.height}px · {previewMeta.sizeKb} KB PNG
                </span>
              )}
            </div>
          </div>

          {/* Right: Format, Theme, Caption & Download Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Format Switcher */}
            <div>
              <span className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                Khổ ảnh xuất
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 8 }}>
                <button
                  type="button"
                  aria-pressed={format === 'portrait'}
                  className={format === 'portrait' ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ padding: '8px 10px', fontSize: '0.78rem' }}
                  onClick={() => setFormat('portrait')}
                >
                  <IconPortraitSvg size={14} />
                  <span>Story 4:5 (1080×1350)</span>
                </button>
                <button
                  type="button"
                  aria-pressed={format === 'landscape'}
                  className={format === 'landscape' ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ padding: '8px 10px', fontSize: '0.78rem' }}
                  onClick={() => setFormat('landscape')}
                >
                  <IconLandscapeSvg size={14} />
                  <span>Ngang (1200×630)</span>
                </button>
              </div>
            </div>

            {/* Theme Switcher */}
            <div>
              <span className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                Phong cách Field-Atlas
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 8 }}>
                <button
                  type="button"
                  aria-pressed={theme === 'dark'}
                  className={theme === 'dark' ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ padding: '8px 10px', fontSize: '0.78rem' }}
                  onClick={() => setTheme('dark')}
                >
                  Obsidian Dark
                </button>
                <button
                  type="button"
                  aria-pressed={theme === 'light'}
                  className={theme === 'light' ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ padding: '8px 10px', fontSize: '0.78rem' }}
                  onClick={() => setTheme('light')}
                >
                  Field Paper Light
                </button>
              </div>
            </div>

            {/* Hiker Display Name */}
            <div>
              <label className="form-label" htmlFor="share-card-hiker-name" style={{ display: 'block', marginBottom: 4 }}>
                Tên nhà thám hiểm trên thẻ
              </label>
              <input
                id="share-card-hiker-name"
                type="text"
                maxLength={48}
                className="form-input"
                value={hikerName}
                onChange={(e) => setHikerName(e.target.value)}
                placeholder="VD: Nguyễn Minh Quân"
                style={{ width: '100%', fontSize: '0.84rem', padding: '7px 10px', borderRadius: 4 }}
              />
            </div>

            {/* Custom Field Caption */}
            <div>
              <label className="form-label" htmlFor="share-card-caption" style={{ display: 'block', marginBottom: 4 }}>
                Chú thích thực địa (tùy chọn)
              </label>
              <input
                id="share-card-caption"
                type="text"
                maxLength={90}
                className="form-input"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="VD: Đón bình minh biển mây 05:45 trên sống lưng..."
                style={{ width: '100%', fontSize: '0.84rem', padding: '7px 10px', borderRadius: 4 }}
              />
              <div
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--color-text-dim)',
                  textAlign: 'right',
                  marginTop: 3,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {caption.length}/90
              </div>
            </div>

            {/* Offline Guarantee Note */}
            <div
              style={{
                padding: '9px 11px',
                borderRadius: 4,
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-border)',
                fontSize: '0.76rem',
                color: 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 7,
                lineHeight: 1.45,
              }}
            >
              <IconCheckCircle size={15} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Vẽ 100% ngoại tuyến bằng Canvas (không cần 4G, không lỗi CORS) — sẵn sàng gửi Zalo, Facebook hoặc Instagram Story.
              </span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!previewUrl || isRendering}
                onClick={() => handleDownloadPng(false)}
                style={{ width: '100%', justifyContent: 'center', padding: '10px 14px', fontSize: '0.84rem' }}
              >
                <IconDownload size={15} />
                <span>{isRendering ? 'Đang kết xuất PNG...' : 'Tải Ảnh Thẻ PNG Ngay'}</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                disabled={!previewUrl || isRendering || isSharing}
                onClick={() => void handleNativeShare()}
                style={{ width: '100%', justifyContent: 'center', padding: '9px 14px', fontSize: '0.82rem' }}
              >
                <IconShare size={15} />
                <span>{isSharing ? 'Đang mở bảng chia sẻ...' : 'Chia Sẻ Nhanh (Zalo / Story)'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ExpeditionShareCardModal;
